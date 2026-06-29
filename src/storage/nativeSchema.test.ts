import { describe, expect, it } from 'vitest';
import {
  createNativeSchemaSql,
  createTableSql,
  nativeSchemaSummary,
  nativeTableNames,
  SETGO_NATIVE_SCHEMA_VERSION,
  SETGO_NATIVE_SNAPSHOT_KEYS,
  SETGO_NATIVE_TABLES,
} from './nativeSchema';

describe('native schema contract', () => {
  it('tracks the current native schema version', () => {
    expect(SETGO_NATIVE_SCHEMA_VERSION).toBe(1);
  });

  it('covers every backup snapshot table', () => {
    expect(SETGO_NATIVE_SNAPSHOT_KEYS).toEqual([
      'exercises',
      'routines',
      'routineDays',
      'weeklySchedules',
      'routineCyclePlanItems',
      'calendarPlanOverrides',
      'routineExercisePlans',
      'workoutSessions',
      'workoutExercises',
      'workoutSets',
      'cardioRecords',
    ]);
  });

  it('uses stable native table names', () => {
    expect(nativeTableNames()).toEqual([
      'exercises',
      'routines',
      'routine_days',
      'weekly_schedules',
      'routine_cycle_plan_items',
      'calendar_plan_overrides',
      'routine_exercise_plans',
      'workout_sessions',
      'workout_exercises',
      'workout_sets',
      'cardio_records',
    ]);
  });

  it('keeps recommendation snapshots as JSON payloads on workout sessions', () => {
    const table = SETGO_NATIVE_TABLES.find((item) => item.name === 'workout_sessions');
    expect(table?.columns).toContainEqual({
      name: 'recommendationSnapshot',
      type: 'json',
      nullable: true,
    });
    expect(table?.indexes.map((index) => index.columns)).toContainEqual(['cyclePlanItemId']);
  });

  it('adds cardio import indexes for native duplicate detection', () => {
    const table = SETGO_NATIVE_TABLES.find((item) => item.name === 'cardio_records');
    expect(table?.indexes.map((index) => index.columns)).toContainEqual(['source', 'externalId']);
    expect(table?.indexes.map((index) => index.columns)).toContainEqual(['startedAt']);
    expect(table?.indexes.map((index) => index.columns)).toContainEqual(['activityType']);
  });

  it('generates SQLite-compatible table and index statements', () => {
    const workoutSets = SETGO_NATIVE_TABLES.find((item) => item.name === 'workout_sets');
    expect(workoutSets).toBeDefined();

    expect(createTableSql(workoutSets!)).toContain('"id" TEXT PRIMARY KEY');
    expect(createTableSql(workoutSets!)).toContain('"estimatedOneRmKg" REAL');

    const sql = createNativeSchemaSql();
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_workout_sets_intensityTechnique" ON "workout_sets" ("intensityTechnique");');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_cardio_records_source_externalId" ON "cardio_records" ("source", "externalId");');
  });

  it('summarizes tables for migration diagnostics', () => {
    expect(nativeSchemaSummary().workout_sessions).toMatchObject({
      snapshotKey: 'workoutSessions',
    });
    expect(nativeSchemaSummary().workout_sessions.columns).toContain('recommendationSnapshot');
  });
});
