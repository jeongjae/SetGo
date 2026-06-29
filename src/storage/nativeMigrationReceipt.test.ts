import { describe, expect, it } from 'vitest';
import type { NativeMigrationImportResult } from './nativeMigration';
import {
  clearNativeMigrationReceipt,
  createNativeMigrationReceipt,
  readNativeMigrationReceipt,
  saveNativeMigrationReceipt,
  SETGO_NATIVE_MIGRATION_RECEIPT_KEY,
  type NativeMigrationReceiptStore,
} from './nativeMigrationReceipt';

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

function migrationResult(overrides: Partial<NativeMigrationImportResult> = {}): NativeMigrationImportResult {
  return {
    canImport: true,
    kind: 'full',
    version: 1,
    exportedAt: '2026-06-29T10:00:00.000Z',
    estimatedBytes: 4096,
    importedAt: '2026-06-29T11:00:00.000Z',
    counts: {
      exercises: 2,
      routines: 1,
      routineDays: 1,
      weeklySchedules: 2,
      routineCyclePlanItems: 1,
      calendarPlanOverrides: 1,
      routineExercisePlans: 2,
      workoutSessions: 2,
      workoutExercises: 2,
      workoutSets: 3,
      cardioRecords: 1,
    },
    issues: [],
    ...overrides,
  };
}

describe('native migration receipt', () => {
  it('creates a compact receipt from an import result', () => {
    const receipt = createNativeMigrationReceipt(migrationResult({
      issues: [{
        severity: 'warning',
        code: 'backup.duplicateCardioExternalId',
        message: 'duplicate',
      }],
    }));

    expect(receipt).toMatchObject({
      schema: 'setgo.nativeMigrationReceipt',
      version: 1,
      importedAt: '2026-06-29T11:00:00.000Z',
      backupExportedAt: '2026-06-29T10:00:00.000Z',
      backupVersion: 1,
      estimatedBytes: 4096,
      warningCount: 1,
    });
    expect(receipt.counts.workoutSessions).toBe(2);
  });

  it('saves, reads, and clears receipt storage', async () => {
    const store = new MemoryReceiptStore();
    const receipt = createNativeMigrationReceipt(migrationResult());

    await saveNativeMigrationReceipt(receipt, store);

    expect(store.values.has(SETGO_NATIVE_MIGRATION_RECEIPT_KEY)).toBe(true);
    await expect(readNativeMigrationReceipt(store)).resolves.toEqual(receipt);

    await clearNativeMigrationReceipt(store);
    await expect(readNativeMigrationReceipt(store)).resolves.toBeUndefined();
  });

  it('ignores malformed or unsupported receipts', async () => {
    const store = new MemoryReceiptStore();

    await store.set(SETGO_NATIVE_MIGRATION_RECEIPT_KEY, '{"schema":"other","version":1}');
    await expect(readNativeMigrationReceipt(store)).resolves.toBeUndefined();

    await store.set(SETGO_NATIVE_MIGRATION_RECEIPT_KEY, 'not-json');
    await expect(readNativeMigrationReceipt(store)).resolves.toBeUndefined();
  });
});
