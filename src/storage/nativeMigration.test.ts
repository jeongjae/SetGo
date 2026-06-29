import { describe, expect, it } from 'vitest';
import {
  importNativeBackupMigration,
  previewNativeBackupMigration,
} from './nativeMigration';
import { SETGO_V5_MIGRATION_FIXTURE_BACKUP } from './nativeMigrationFixture';
import {
  readNativeMigrationReceipt,
  SETGO_NATIVE_MIGRATION_RECEIPT_KEY,
  type NativeMigrationReceiptStore,
} from './nativeMigrationReceipt';
import type { SetGoDataRepository, SetGoDataSnapshot, SetGoSettingsDataSnapshot } from './setgoDataRepository';

class MemoryReceiptStore implements NativeMigrationReceiptStore {
  values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function emptySnapshot(overrides: Partial<SetGoDataSnapshot> = {}): SetGoDataSnapshot {
  return {
    exercises: [],
    routines: [],
    routineDays: [],
    weeklySchedules: [],
    routineCyclePlanItems: [],
    calendarPlanOverrides: [],
    routineExercisePlans: [],
    workoutSessions: [],
    workoutExercises: [],
    workoutSets: [],
    cardioRecords: [],
    ...overrides,
  };
}

function emptySettingsSnapshot(overrides: Partial<SetGoSettingsDataSnapshot> = {}): SetGoSettingsDataSnapshot {
  return {
    exercises: [],
    routines: [],
    routineDays: [],
    weeklySchedules: [],
    routineCyclePlanItems: [],
    calendarPlanOverrides: [],
    routineExercisePlans: [],
    ...overrides,
  };
}

describe('native migration preview and import', () => {
  it('previews a valid representative backup as importable', () => {
    const preview = previewNativeBackupMigration(SETGO_V5_MIGRATION_FIXTURE_BACKUP);

    expect(preview.canImport).toBe(true);
    expect(preview.counts).toMatchObject({
      exercises: 2,
      routines: 1,
      workoutSessions: 2,
      workoutSets: 3,
      cardioRecords: 1,
    });
    expect(preview.estimatedBytes).toBeGreaterThan(1000);
    expect(preview.issues).toEqual([]);
  });

  it('blocks import when required references are missing', async () => {
    const brokenBackup = structuredClone(SETGO_V5_MIGRATION_FIXTURE_BACKUP);
    brokenBackup.data.workoutExercises[0].exerciseId = 'missing_exercise';

    const preview = previewNativeBackupMigration(brokenBackup);
    expect(preview.canImport).toBe(false);
    expect(preview.issues).toContainEqual({
      severity: 'error',
      code: 'backup.missingReference',
      message: 'workoutExercises.exerciseId on fixture_workout_bench references missing id missing_exercise.',
    });

    const repository: SetGoDataRepository = {
      readBackupData: async () => emptySnapshot(),
      readSettingsBackupData: async () => emptySettingsSnapshot(),
      readExercisePreservationContext: async () => ({ exercises: [], workoutExercises: [] }),
      replaceBackupData: async () => {
        throw new Error('replaceBackupData should not run for invalid migration input');
      },
      replaceSettingsData: async () => {},
    };

    await expect(importNativeBackupMigration(brokenBackup, repository)).rejects.toThrow('Native migration import blocked');
  });

  it('warns but allows import when duplicate imported cardio ids appear inside the backup', () => {
    const duplicateBackup = structuredClone(SETGO_V5_MIGRATION_FIXTURE_BACKUP);
    duplicateBackup.data.cardioRecords.push({
      ...duplicateBackup.data.cardioRecords[0],
      id: 'fixture_cardio_run_duplicate',
    });

    const preview = previewNativeBackupMigration(duplicateBackup);

    expect(preview.canImport).toBe(true);
    expect(preview.counts.cardioRecords).toBe(2);
    expect(preview.issues).toContainEqual({
      severity: 'warning',
      code: 'backup.duplicateCardioExternalId',
      message: 'cardioRecords contains duplicate imported activity imported:fixture-health-running-001.',
    });
  });

  it('imports valid migration input through the provided repository', async () => {
    let restored: SetGoDataSnapshot | undefined;
    const receiptStore = new MemoryReceiptStore();
    const repository: SetGoDataRepository = {
      readBackupData: async () => emptySnapshot(),
      readSettingsBackupData: async () => emptySettingsSnapshot(),
      readExercisePreservationContext: async () => ({ exercises: [], workoutExercises: [] }),
      replaceBackupData: async (data) => {
        restored = data;
      },
      replaceSettingsData: async () => {},
    };

    const result = await importNativeBackupMigration(SETGO_V5_MIGRATION_FIXTURE_BACKUP, repository, {
      saveReceipt: true,
      receiptStore,
    });

    expect(result.canImport).toBe(true);
    expect(result.importedAt).toEqual(expect.any(String));
    expect(result.receipt?.counts.workoutSessions).toBe(2);
    expect(receiptStore.values.has(SETGO_NATIVE_MIGRATION_RECEIPT_KEY)).toBe(true);
    await expect(readNativeMigrationReceipt(receiptStore)).resolves.toEqual(result.receipt);
    expect(restored?.workoutSessions).toHaveLength(2);
    expect(restored?.cardioRecords[0].externalId).toBe('fixture-health-running-001');
  });
});
