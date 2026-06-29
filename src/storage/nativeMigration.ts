import { previewSetGoBackup, restoreBackup, type SetGoBackup } from '../db/backup';
import type { SetGoDataRepository, SetGoDataSnapshot } from './setgoDataRepository';

export type NativeMigrationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
};

export type NativeMigrationPreview = {
  canImport: boolean;
  kind: 'full' | 'settings' | 'invalid';
  version?: number;
  exportedAt?: string;
  estimatedBytes: number;
  counts: {
    exercises: number;
    routines: number;
    routineDays: number;
    weeklySchedules: number;
    routineCyclePlanItems: number;
    calendarPlanOverrides: number;
    routineExercisePlans: number;
    workoutSessions: number;
    workoutExercises: number;
    workoutSets: number;
    cardioRecords: number;
  };
  issues: NativeMigrationIssue[];
};

export type NativeMigrationImportResult = NativeMigrationPreview & {
  importedAt: string;
};

type BackupData = Partial<SetGoBackup['data']>;

const emptyCounts = {
  exercises: 0,
  routines: 0,
  routineDays: 0,
  weeklySchedules: 0,
  routineCyclePlanItems: 0,
  calendarPlanOverrides: 0,
  routineExercisePlans: 0,
  workoutSessions: 0,
  workoutExercises: 0,
  workoutSets: 0,
  cardioRecords: 0,
};

export function previewNativeBackupMigration(input: unknown): NativeMigrationPreview {
  const backupPreview = previewSetGoBackup(input);
  const backup = input as Partial<SetGoBackup>;
  const data = backup.data as BackupData | undefined;
  const issues: NativeMigrationIssue[] = backupPreview.issues.map((message) => ({
    severity: 'error',
    code: 'backup.invalid',
    message,
  }));

  if (backupPreview.kind === 'full' && data) {
    issues.push(...validateBackupRelationships(data));
  }

  return {
    canImport: issues.every((issue) => issue.severity !== 'error') && backupPreview.kind === 'full',
    kind: backupPreview.kind,
    version: backupPreview.version,
    exportedAt: backupPreview.exportedAt,
    estimatedBytes: estimateBackupBytes(input),
    counts: data ? countBackupData(data) : emptyCounts,
    issues,
  };
}

export async function importNativeBackupMigration(
  input: unknown,
  repository: SetGoDataRepository,
): Promise<NativeMigrationImportResult> {
  const preview = previewNativeBackupMigration(input);
  if (!preview.canImport) {
    throw new Error(`Native migration import blocked: ${preview.issues.map((issue) => issue.message).join(' ')}`);
  }

  await restoreBackup(input, repository);

  return {
    ...preview,
    importedAt: new Date().toISOString(),
  };
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function countBackupData(data: BackupData): NativeMigrationPreview['counts'] {
  return {
    exercises: countItems(data.exercises),
    routines: countItems(data.routines),
    routineDays: countItems(data.routineDays),
    weeklySchedules: countItems(data.weeklySchedules),
    routineCyclePlanItems: countItems(data.routineCyclePlanItems),
    calendarPlanOverrides: countItems(data.calendarPlanOverrides),
    routineExercisePlans: countItems(data.routineExercisePlans),
    workoutSessions: countItems(data.workoutSessions),
    workoutExercises: countItems(data.workoutExercises),
    workoutSets: countItems(data.workoutSets),
    cardioRecords: countItems(data.cardioRecords),
  };
}

function estimateBackupBytes(input: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(input)).length;
  } catch {
    return 0;
  }
}

function validateBackupRelationships(data: BackupData): NativeMigrationIssue[] {
  const issues: NativeMigrationIssue[] = [];
  const exerciseIds = ids(data.exercises);
  const routineIds = ids(data.routines);
  const routineDayIds = ids(data.routineDays);
  const cycleItemIds = ids(data.routineCyclePlanItems);
  const sessionIds = ids(data.workoutSessions);
  const workoutExerciseIds = ids(data.workoutExercises);

  for (const day of data.routineDays ?? []) {
    requireReference(issues, 'routineDays.routineId', day.id, day.routineId, routineIds);
  }

  for (const schedule of data.weeklySchedules ?? []) {
    requireReference(issues, 'weeklySchedules.routineId', schedule.id, schedule.routineId, routineIds);
    requireOptionalReference(issues, 'weeklySchedules.routineDayId', schedule.id, schedule.routineDayId, routineDayIds);
  }

  for (const item of data.routineCyclePlanItems ?? []) {
    requireReference(issues, 'routineCyclePlanItems.routineId', item.id, item.routineId, routineIds);
    requireOptionalReference(issues, 'routineCyclePlanItems.routineDayId', item.id, item.routineDayId, routineDayIds);
  }

  for (const override of data.calendarPlanOverrides ?? []) {
    requireReference(issues, 'calendarPlanOverrides.routineId', override.id, override.routineId, routineIds);
    requireOptionalReference(issues, 'calendarPlanOverrides.routineDayId', override.id, override.routineDayId, routineDayIds);
  }

  for (const plan of data.routineExercisePlans ?? []) {
    requireReference(issues, 'routineExercisePlans.routineDayId', plan.id, plan.routineDayId, routineDayIds);
    requireReference(issues, 'routineExercisePlans.exerciseId', plan.id, plan.exerciseId, exerciseIds);
  }

  for (const session of data.workoutSessions ?? []) {
    requireOptionalReference(issues, 'workoutSessions.routineId', session.id, session.routineId, routineIds);
    requireOptionalReference(issues, 'workoutSessions.routineDayId', session.id, session.routineDayId, routineDayIds);
    requireOptionalReference(issues, 'workoutSessions.cyclePlanItemId', session.id, session.cyclePlanItemId, cycleItemIds);
  }

  for (const workoutExercise of data.workoutExercises ?? []) {
    requireReference(issues, 'workoutExercises.sessionId', workoutExercise.id, workoutExercise.sessionId, sessionIds);
    requireReference(issues, 'workoutExercises.exerciseId', workoutExercise.id, workoutExercise.exerciseId, exerciseIds);
  }

  for (const set of data.workoutSets ?? []) {
    requireReference(issues, 'workoutSets.workoutExerciseId', set.id, set.workoutExerciseId, workoutExerciseIds);
  }

  for (const cardio of data.cardioRecords ?? []) {
    requireReference(issues, 'cardioRecords.sessionId', cardio.id, cardio.sessionId, sessionIds);
  }

  issues.push(...findDuplicateCardioImportWarnings(data.cardioRecords));
  return issues;
}

function ids<T extends { id: string }>(items: T[] | undefined): Set<string> {
  return new Set((items ?? []).map((item) => item.id));
}

function requireReference(
  issues: NativeMigrationIssue[],
  field: string,
  recordId: string,
  value: string,
  allowedIds: Set<string>,
): void {
  if (!allowedIds.has(value)) {
    issues.push({
      severity: 'error',
      code: 'backup.missingReference',
      message: `${field} on ${recordId} references missing id ${value}.`,
    });
  }
}

function requireOptionalReference(
  issues: NativeMigrationIssue[],
  field: string,
  recordId: string,
  value: string | undefined,
  allowedIds: Set<string>,
): void {
  if (value) {
    requireReference(issues, field, recordId, value, allowedIds);
  }
}

function findDuplicateCardioImportWarnings(
  cardioRecords: SetGoDataSnapshot['cardioRecords'] | undefined,
): NativeMigrationIssue[] {
  const seen = new Set<string>();
  const issues: NativeMigrationIssue[] = [];

  for (const record of cardioRecords ?? []) {
    if (!record.source || !record.externalId) continue;
    const key = `${record.source}:${record.externalId}`;
    if (seen.has(key)) {
      issues.push({
        severity: 'warning',
        code: 'backup.duplicateCardioExternalId',
        message: `cardioRecords contains duplicate imported activity ${key}.`,
      });
    }
    seen.add(key);
  }

  return issues;
}
