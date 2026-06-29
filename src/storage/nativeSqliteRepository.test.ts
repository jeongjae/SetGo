import { describe, expect, it } from 'vitest';
import type { SetGoDataSnapshot } from './setgoDataRepository';
import { SETGO_NATIVE_TABLES } from './nativeSchema';
import {
  createNativeSqliteDataRepository,
  getNativeTableForSnapshotKey,
  initializeNativeSqliteSchema,
  type NativeSqliteDriver,
  type NativeSqliteQueryResult,
  type NativeSqliteRow,
} from './nativeSqliteRepository';

class FakeNativeSqliteDriver implements NativeSqliteDriver {
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
    if (insertMatch) {
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

describe('native SQLite repository adapter', () => {
  it('initializes the schema with table and index SQL', async () => {
    const driver = new FakeNativeSqliteDriver();

    await initializeNativeSqliteSchema(driver);

    expect(driver.statements[0]).toContain('CREATE TABLE IF NOT EXISTS "exercises"');
    expect(driver.statements).toContain('CREATE INDEX IF NOT EXISTS "idx_cardio_records_source_externalId" ON "cardio_records" ("source", "externalId");');
    expect(driver.statements.length).toBeGreaterThan(SETGO_NATIVE_TABLES.length);
  });

  it('roundtrips a full backup snapshot through SQL rows', async () => {
    const driver = new FakeNativeSqliteDriver();
    const repository = createNativeSqliteDataRepository(driver);
    const recommendationSnapshot = {
      kind: 'routine',
      sessionKind: 'planned',
      label: 'Upper Day',
      source: 'weekly-schedule',
      reason: 'weeklyRoutine',
      confidence: 'high',
      createdAt: '2026-06-29T08:00:00.000Z',
    } satisfies SetGoDataSnapshot['workoutSessions'][number]['recommendationSnapshot'];
    const data = emptySnapshot({
      exercises: [{
        id: 'bench',
        nameKo: 'Bench Press',
        stage: 'main',
        stageTags: ['main'],
        category: 'chest',
        categoryTags: ['chest'],
        defaultEmoji: 'B',
        isDefault: false,
        isActive: true,
        createdAt: '2026-06-29T08:00:00.000Z',
        updatedAt: '2026-06-29T08:00:00.000Z',
      }],
      routines: [{
        id: 'routine',
        name: 'Base',
        splitType: 'custom',
        startDate: '2026-06-29',
        isActive: true,
        createdAt: '2026-06-29T08:00:00.000Z',
        updatedAt: '2026-06-29T08:00:00.000Z',
      }],
      routineDays: [{
        id: 'routine_day',
        routineId: 'routine',
        code: 'A',
        name: 'Upper',
        sequence: 1,
        family: 'upper',
        intensityPhase: 'hypertrophy',
      }],
      weeklySchedules: [{
        id: 'weekly',
        routineId: 'routine',
        weekday: 1,
        routineDayId: 'routine_day',
        isRestDay: false,
      }],
      routineExercisePlans: [{
        id: 'plan',
        routineDayId: 'routine_day',
        exerciseId: 'bench',
        order: 1,
        plannedWeightKg: 80,
        plannedReps: 8,
        plannedSets: 3,
      }],
      workoutSessions: [{
        id: 'session',
        date: '2026-06-29',
        timeBand: 'morning',
        routineId: 'routine',
        routineDayId: 'routine_day',
        entryKind: 'planned',
        recommendationSnapshot,
        status: 'completed',
        totalStrengthVolumeKg: 2400,
        autoSkipped: false,
        isDemo: false,
        createdAt: '2026-06-29T08:00:00.000Z',
        updatedAt: '2026-06-29T09:00:00.000Z',
      }],
      workoutExercises: [{
        id: 'workout_exercise',
        sessionId: 'session',
        exerciseId: 'bench',
        order: 1,
        status: 'completed',
        totalVolumeKg: 2400,
        restSeconds: 120,
      }],
      workoutSets: [{
        id: 'set',
        workoutExerciseId: 'workout_exercise',
        setNo: 1,
        weightKg: 100,
        reps: 8,
        estimatedOneRmKg: 126.7,
        rir: 2,
        isCompleted: true,
        isWarmup: false,
        isHard: true,
        type: 'normal',
        intensityTechnique: 'straight',
      }],
      cardioRecords: [{
        id: 'cardio',
        sessionId: 'session',
        order: 1,
        isDraft: false,
        source: 'imported',
        sourceName: 'Health',
        externalId: 'activity-1',
        activityType: 'running',
        environment: 'outdoor',
        startedAt: '2026-06-29T07:00:00.000Z',
        endedAt: '2026-06-29T07:30:00.000Z',
        durationSeconds: 1800,
        distanceKm: 5,
      }],
    });

    await repository.replaceBackupData(data);

    const workoutSessionTable = getNativeTableForSnapshotKey('workoutSessions').name;
    expect(driver.rows.get(workoutSessionTable)?.[0].recommendationSnapshot).toBe(JSON.stringify(recommendationSnapshot));
    expect(driver.rows.get(workoutSessionTable)?.[0].autoSkipped).toBe(0);
    expect(driver.rows.get('workout_sets')?.[0].isCompleted).toBe(1);
    expect(driver.rows.get('exercises')?.[0].stageTags).toBe(JSON.stringify(['main']));

    const restored = await repository.readBackupData();

    expect(restored.workoutSessions[0].recommendationSnapshot).toEqual(recommendationSnapshot);
    expect(restored.workoutSessions[0].autoSkipped).toBe(false);
    expect(restored.workoutSets[0].isCompleted).toBe(true);
    expect(restored.exercises[0].categoryTags).toEqual(['chest']);
    expect(restored.cardioRecords[0].isDraft).toBe(false);
    expect(driver.transactionCount).toBe(1);
  });

  it('replaces settings tables without clearing workout history tables', async () => {
    const driver = new FakeNativeSqliteDriver();
    const repository = createNativeSqliteDataRepository(driver);

    await repository.replaceBackupData(emptySnapshot({
      workoutSessions: [{
        id: 'session',
        date: '2026-06-29',
        timeBand: 'morning',
        status: 'completed',
        totalStrengthVolumeKg: 100,
        createdAt: '2026-06-29T08:00:00.000Z',
        updatedAt: '2026-06-29T09:00:00.000Z',
      }],
    }));

    await repository.replaceSettingsData({
      exercises: [],
      routines: [],
      routineDays: [],
      weeklySchedules: [],
      routineCyclePlanItems: [],
      calendarPlanOverrides: [],
      routineExercisePlans: [],
    });

    expect(driver.rows.get('workout_sessions')).toHaveLength(1);
  });
});
