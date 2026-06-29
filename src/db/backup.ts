import { getStoredLocale, saveStoredLocale, type AppLocale } from '../i18n/i18n';
import {
  dexieSetGoDataRepository,
  type SetGoDataRepository,
  type SetGoDataSnapshot,
  type SetGoSettingsDataSnapshot,
} from '../storage/setgoDataRepository';
import type {
  ExerciseMaster,
} from '../types';

type BackupData = SetGoDataSnapshot & {
  routineCyclePlanItems?: SetGoDataSnapshot['routineCyclePlanItems'];
  calendarPlanOverrides?: SetGoDataSnapshot['calendarPlanOverrides'];
};

export type SetGoBackup = {
  app: 'SetGo';
  version: 1;
  exportedAt: string;
  data: BackupData;
};

export type SetGoSettingsBackup = {
  app: 'SetGo';
  kind: 'settings';
  version: 1;
  exportedAt: string;
  settings: {
    locale: AppLocale;
  };
  data: Pick<
    SetGoBackup['data'],
    | 'exercises'
    | 'routines'
    | 'routineDays'
    | 'weeklySchedules'
    | 'routineCyclePlanItems'
    | 'calendarPlanOverrides'
    | 'routineExercisePlans'
  >;
};

export type SetGoBackupPreview = {
  kind: 'full' | 'settings' | 'invalid';
  version?: number;
  exportedAt?: string;
  sessionCount: number;
  exerciseCount: number;
  routineCount: number;
  routinePlanCount: number;
  cardioCount: number;
  issues: string[];
};

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function ensureActiveRoutine<T extends { isActive: boolean }>(routines: T[]): T[] {
  if (routines.length === 0 || routines.some((routine) => routine.isActive)) return routines;
  return routines.map((routine, index) => index === 0 ? { ...routine, isActive: true } : routine);
}

function normalizeBackupData(data: Partial<BackupData> | undefined): SetGoDataSnapshot {
  return {
    exercises: data?.exercises ?? [],
    routines: ensureActiveRoutine(data?.routines ?? []),
    routineDays: data?.routineDays ?? [],
    weeklySchedules: data?.weeklySchedules ?? [],
    routineCyclePlanItems: data?.routineCyclePlanItems ?? [],
    calendarPlanOverrides: data?.calendarPlanOverrides ?? [],
    routineExercisePlans: data?.routineExercisePlans ?? [],
    workoutSessions: data?.workoutSessions ?? [],
    workoutExercises: data?.workoutExercises ?? [],
    workoutSets: data?.workoutSets ?? [],
    cardioRecords: data?.cardioRecords ?? [],
  };
}

function normalizeSettingsData(data: Partial<SetGoSettingsDataBackup> | undefined): SetGoSettingsDataSnapshot {
  return {
    exercises: data?.exercises ?? [],
    routines: ensureActiveRoutine(data?.routines ?? []),
    routineDays: data?.routineDays ?? [],
    weeklySchedules: data?.weeklySchedules ?? [],
    routineCyclePlanItems: data?.routineCyclePlanItems ?? [],
    calendarPlanOverrides: data?.calendarPlanOverrides ?? [],
    routineExercisePlans: data?.routineExercisePlans ?? [],
  };
}

export function previewSetGoBackup(input: unknown): SetGoBackupPreview {
  const backup = input as Partial<SetGoBackup & SetGoSettingsBackup>;
  const issues: string[] = [];
  const data = backup?.data as Partial<SetGoBackup['data']> | undefined;
  const kind = backup?.kind === 'settings' ? 'settings' : backup?.app === 'SetGo' ? 'full' : 'invalid';

  if (backup?.app !== 'SetGo') issues.push('Not a SetGo backup.');
  if (backup?.version !== 1) issues.push(`Unsupported backup version ${String(backup?.version ?? 'unknown')}.`);
  if (!data) issues.push('Backup data is missing.');
  if (kind === 'settings' && backup.kind !== 'settings') issues.push('Settings backup marker is missing.');

  return {
    kind: issues.length > 0 ? 'invalid' : kind,
    version: typeof backup?.version === 'number' ? backup.version : undefined,
    exportedAt: typeof backup?.exportedAt === 'string' ? backup.exportedAt : undefined,
    sessionCount: countItems(data?.workoutSessions),
    exerciseCount: countItems(data?.exercises),
    routineCount: countItems(data?.routines),
    routinePlanCount: countItems(data?.routineExercisePlans),
    cardioCount: countItems(data?.cardioRecords),
    issues,
  };
}

export async function createBackup(repository: SetGoDataRepository = dexieSetGoDataRepository): Promise<SetGoBackup> {
  const data = await repository.readBackupData();

  return {
    app: 'SetGo',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function createSettingsBackup(repository: SetGoDataRepository = dexieSetGoDataRepository): Promise<SetGoSettingsBackup> {
  const data = await repository.readSettingsBackupData();

  return {
    app: 'SetGo',
    kind: 'settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      locale: getStoredLocale(),
    },
    data,
  };
}

export async function restoreBackup(input: unknown, repository: SetGoDataRepository = dexieSetGoDataRepository): Promise<void> {
  const backup = input as SetGoBackup;
  if (backup?.app !== 'SetGo' || backup.version !== 1 || !backup.data) {
    throw new Error('Invalid SetGo backup file');
  }

  await repository.replaceBackupData(normalizeBackupData(backup.data));
}

type SetGoSettingsDataBackup = SetGoSettingsBackup['data'];

export async function restoreSettingsBackup(input: unknown, repository: SetGoDataRepository = dexieSetGoDataRepository): Promise<void> {
  const backup = input as SetGoSettingsBackup;
  if (backup?.app !== 'SetGo' || backup.kind !== 'settings' || backup.version !== 1 || !backup.data) {
    throw new Error('Invalid SetGo settings backup file');
  }

  const context = await repository.readExercisePreservationContext();
  const existingById = new Map(context.exercises.map((exercise) => [exercise.id, exercise]));
  const backupExerciseIds = new Set((backup.data.exercises ?? []).map((exercise) => exercise.id));
  const referencedExerciseIds = new Set(context.workoutExercises.map((workoutExercise) => workoutExercise.exerciseId));
  const preservedLogExercises = Array.from(referencedExerciseIds)
    .filter((exerciseId) => !backupExerciseIds.has(exerciseId))
    .map((exerciseId) => existingById.get(exerciseId))
    .filter((exercise): exercise is ExerciseMaster => Boolean(exercise))
    .map((exercise) => ({
      ...exercise,
      isActive: false,
      updatedAt: new Date().toISOString(),
    }));

  const settingsData = normalizeSettingsData(backup.data);
  await repository.replaceSettingsData({
    ...settingsData,
    exercises: [...settingsData.exercises, ...preservedLogExercises],
  });

  if (backup.settings?.locale) {
    saveStoredLocale(backup.settings.locale);
  }
}
