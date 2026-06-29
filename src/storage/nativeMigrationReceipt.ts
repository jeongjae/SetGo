import { Preferences } from '@capacitor/preferences';
import type { NativeMigrationImportResult, NativeMigrationPreview } from './nativeMigration';

export const SETGO_NATIVE_MIGRATION_RECEIPT_KEY = 'setgo-native-migration-receipt';

export type NativeMigrationReceipt = {
  schema: 'setgo.nativeMigrationReceipt';
  version: 1;
  importedAt: string;
  backupExportedAt?: string;
  backupVersion?: number;
  estimatedBytes: number;
  counts: NativeMigrationPreview['counts'];
  warningCount: number;
};

export type NativeMigrationReceiptStore = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export const capacitorPreferencesReceiptStore: NativeMigrationReceiptStore = {
  async get(key) {
    const result = await Preferences.get({ key });
    return result.value ?? undefined;
  },

  async set(key, value) {
    await Preferences.set({ key, value });
  },

  async remove(key) {
    await Preferences.remove({ key });
  },
};

export function createNativeMigrationReceipt(result: NativeMigrationImportResult): NativeMigrationReceipt {
  return {
    schema: 'setgo.nativeMigrationReceipt',
    version: 1,
    importedAt: result.importedAt,
    backupExportedAt: result.exportedAt,
    backupVersion: result.version,
    estimatedBytes: result.estimatedBytes,
    counts: result.counts,
    warningCount: result.issues.filter((issue) => issue.severity === 'warning').length,
  };
}

export async function saveNativeMigrationReceipt(
  receipt: NativeMigrationReceipt,
  store: NativeMigrationReceiptStore = capacitorPreferencesReceiptStore,
): Promise<void> {
  await store.set(SETGO_NATIVE_MIGRATION_RECEIPT_KEY, JSON.stringify(receipt));
}

export async function readNativeMigrationReceipt(
  store: NativeMigrationReceiptStore = capacitorPreferencesReceiptStore,
): Promise<NativeMigrationReceipt | undefined> {
  const value = await store.get(SETGO_NATIVE_MIGRATION_RECEIPT_KEY);
  if (!value) return undefined;

  try {
    const receipt = JSON.parse(value) as Partial<NativeMigrationReceipt>;
    if (receipt.schema !== 'setgo.nativeMigrationReceipt' || receipt.version !== 1) {
      return undefined;
    }
    return receipt as NativeMigrationReceipt;
  } catch {
    return undefined;
  }
}

export async function clearNativeMigrationReceipt(
  store: NativeMigrationReceiptStore = capacitorPreferencesReceiptStore,
): Promise<void> {
  await store.remove(SETGO_NATIVE_MIGRATION_RECEIPT_KEY);
}
