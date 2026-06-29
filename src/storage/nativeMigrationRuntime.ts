import { createCapacitorSqliteDriver } from './capacitorSqliteDriver';
import {
  importNativeBackupMigration,
  previewNativeBackupMigration,
  type NativeMigrationImportResult,
  type NativeMigrationPreview,
} from './nativeMigration';
import type { NativeMigrationReceiptStore } from './nativeMigrationReceipt';
import {
  createNativeSqliteDataRepository,
  initializeNativeSqliteSchema,
  type NativeSqliteDriver,
} from './nativeSqliteRepository';

export type NativeMigrationRuntimeOptions = {
  createDriver?: () => Promise<NativeSqliteDriver>;
  receiptStore?: NativeMigrationReceiptStore;
};

const emptyCounts: NativeMigrationPreview['counts'] = {
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

export function previewNativeBackupJson(jsonText: string): NativeMigrationPreview {
  try {
    return previewNativeBackupMigration(JSON.parse(jsonText));
  } catch {
    return {
      canImport: false,
      kind: 'invalid',
      estimatedBytes: estimateTextBytes(jsonText),
      counts: emptyCounts,
      issues: [{
        severity: 'error',
        code: 'backup.parseJson',
        message: 'Backup file is not valid JSON.',
      }],
    };
  }
}

export async function importNativeBackupJsonToNativeStorage(
  jsonText: string,
  options: NativeMigrationRuntimeOptions = {},
): Promise<NativeMigrationImportResult> {
  let backup: unknown;
  try {
    backup = JSON.parse(jsonText);
  } catch {
    throw new Error('Native migration import blocked: Backup file is not valid JSON.');
  }

  const driver = await (options.createDriver ?? (() => createCapacitorSqliteDriver()))();
  await initializeNativeSqliteSchema(driver);

  const repository = createNativeSqliteDataRepository(driver);
  return importNativeBackupMigration(backup, repository, {
    saveReceipt: true,
    receiptStore: options.receiptStore,
  });
}

function estimateTextBytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}
