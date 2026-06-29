import { describe, expect, it } from 'vitest';
import { SETGO_V5_MIGRATION_FIXTURE_BACKUP } from './nativeMigrationFixture';
import {
  importNativeBackupJsonToNativeStorage,
  previewNativeBackupJson,
} from './nativeMigrationRuntime';
import {
  readNativeMigrationReceipt,
  type NativeMigrationReceiptStore,
} from './nativeMigrationReceipt';
import type {
  NativeSqliteDriver,
  NativeSqliteQueryResult,
  NativeSqliteRow,
} from './nativeSqliteRepository';

class RuntimeSqliteDriver implements NativeSqliteDriver {
  readonly rows = new Map<string, NativeSqliteRow[]>();
  readonly statements: string[] = [];
  transactionCount = 0;

  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.statements.push(sql);

    const deleteMatch = sql.match(/^DELETE FROM "([^"]+)";$/);
    if (deleteMatch) {
      this.rows.set(deleteMatch[1], []);
      return;
    }

    const insertMatch = sql.match(/^INSERT OR REPLACE INTO "([^"]+)" \((.+)\) VALUES \((.+)\);$/);
    if (!insertMatch) return;

    const tableName = insertMatch[1];
    const columns = parseQuotedColumns(insertMatch[2]);
    const row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
    const tableRows = this.rows.get(tableName) ?? [];
    const existingIndex = tableRows.findIndex((item) => item.id === row.id);

    if (existingIndex >= 0) {
      tableRows[existingIndex] = row;
    } else {
      tableRows.push(row);
    }
    this.rows.set(tableName, tableRows);
  }

  async query<T extends NativeSqliteRow = NativeSqliteRow>(sql: string): Promise<NativeSqliteQueryResult<T>> {
    this.statements.push(sql);

    const selectMatch = sql.match(/^SELECT (.+) FROM "([^"]+)";$/);
    if (!selectMatch) return { values: [] };

    const columns = parseQuotedColumns(selectMatch[1]);
    const tableName = selectMatch[2];
    const values = (this.rows.get(tableName) ?? []).map((row) => (
      Object.fromEntries(columns.map((column) => [column, row[column]]))
    ));

    return { values: values as T[] };
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return work();
  }
}

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

function parseQuotedColumns(value: string): string[] {
  return Array.from(value.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

describe('native migration runtime', () => {
  it('previews valid backup JSON', () => {
    const preview = previewNativeBackupJson(JSON.stringify(SETGO_V5_MIGRATION_FIXTURE_BACKUP));

    expect(preview.canImport).toBe(true);
    expect(preview.counts.workoutSessions).toBe(2);
    expect(preview.counts.cardioRecords).toBe(1);
    expect(preview.issues).toEqual([]);
  });

  it('previews invalid JSON without throwing', () => {
    const preview = previewNativeBackupJson('{not-json');

    expect(preview.canImport).toBe(false);
    expect(preview.kind).toBe('invalid');
    expect(preview.issues).toContainEqual({
      severity: 'error',
      code: 'backup.parseJson',
      message: 'Backup file is not valid JSON.',
    });
  });

  it('imports valid backup JSON into native storage and saves a receipt', async () => {
    const driver = new RuntimeSqliteDriver();
    const receiptStore = new MemoryReceiptStore();

    const result = await importNativeBackupJsonToNativeStorage(
      JSON.stringify(SETGO_V5_MIGRATION_FIXTURE_BACKUP),
      {
        createDriver: async () => driver,
        receiptStore,
      },
    );

    expect(result.canImport).toBe(true);
    expect(result.receipt?.counts.workoutSessions).toBe(2);
    expect(driver.statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS "workout_sessions"'))).toBe(true);
    expect(driver.rows.get('workout_sessions')).toHaveLength(2);
    expect(driver.rows.get('cardio_records')).toHaveLength(1);
    await expect(readNativeMigrationReceipt(receiptStore)).resolves.toEqual(result.receipt);
  });

  it('blocks invalid JSON before creating a native driver', async () => {
    let driverCreated = false;

    await expect(importNativeBackupJsonToNativeStorage('{not-json', {
      createDriver: async () => {
        driverCreated = true;
        return new RuntimeSqliteDriver();
      },
    })).rejects.toThrow('Backup file is not valid JSON');

    expect(driverCreated).toBe(false);
  });
});
