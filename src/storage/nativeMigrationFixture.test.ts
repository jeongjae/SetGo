import { describe, expect, it } from 'vitest';
import { previewSetGoBackup, restoreBackup } from '../db/backup';
import {
  createNativeSqliteDataRepository,
  initializeNativeSqliteSchema,
  type NativeSqliteDriver,
  type NativeSqliteQueryResult,
  type NativeSqliteRow,
} from './nativeSqliteRepository';
import { SETGO_V5_MIGRATION_FIXTURE_BACKUP } from './nativeMigrationFixture';

class MigrationFixtureSqliteDriver implements NativeSqliteDriver {
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

function parseQuotedColumns(value: string): string[] {
  return Array.from(value.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

describe('native migration fixture', () => {
  it('previews representative PWA backup counts before native import', () => {
    expect(previewSetGoBackup(SETGO_V5_MIGRATION_FIXTURE_BACKUP)).toMatchObject({
      kind: 'full',
      version: 1,
      sessionCount: 2,
      exerciseCount: 2,
      routineCount: 1,
      routinePlanCount: 2,
      cardioCount: 1,
      issues: [],
    });
  });

  it('imports the fixture backup through the native SQLite repository adapter', async () => {
    const driver = new MigrationFixtureSqliteDriver();
    const repository = createNativeSqliteDataRepository(driver);

    await initializeNativeSqliteSchema(driver);
    await restoreBackup(SETGO_V5_MIGRATION_FIXTURE_BACKUP, repository);

    const restored = await repository.readBackupData();

    expect(restored.exercises.map((exercise) => exercise.id)).toEqual([
      'fixture_bench_press',
      'fixture_lat_pulldown',
    ]);
    expect(restored.workoutSessions.map((session) => session.id)).toEqual([
      'fixture_strength_session',
      'fixture_running_session',
    ]);
    expect(restored.workoutSessions[0].recommendationSnapshot?.exerciseTargets?.[0]).toMatchObject({
      planId: 'fixture_plan_bench',
      weightKg: 80,
      confidence: 'high',
    });
    expect(restored.workoutSets).toHaveLength(3);
    expect(restored.workoutSets.every((set) => set.isCompleted)).toBe(true);
    expect(restored.cardioRecords[0]).toMatchObject({
      source: 'imported',
      externalId: 'fixture-health-running-001',
      distanceKm: 5.2,
    });
    expect(driver.transactionCount).toBe(1);
  });
});
