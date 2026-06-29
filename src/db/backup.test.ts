import { describe, expect, it } from 'vitest';
import { createBackup, restoreBackup, restoreSettingsBackup, previewSetGoBackup } from './backup';
import type { SetGoDataRepository, SetGoDataSnapshot, SetGoSettingsDataSnapshot } from '../storage/setgoDataRepository';

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

describe('backup preview', () => {
  it('summarizes full backup counts before restore', () => {
    const preview = previewSetGoBackup({
      app: 'SetGo',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      data: {
        exercises: [{ id: 'bench' }],
        routines: [{ id: 'routine' }],
        routineExercisePlans: [{ id: 'plan' }, { id: 'plan_2' }],
        workoutSessions: [{ id: 'session' }],
        cardioRecords: [{ id: 'cardio' }],
      },
    });

    expect(preview).toMatchObject({
      kind: 'full',
      sessionCount: 1,
      exerciseCount: 1,
      routineCount: 1,
      routinePlanCount: 2,
      cardioCount: 1,
      issues: [],
    });
  });

  it('summarizes settings backup counts without workout sessions', () => {
    const preview = previewSetGoBackup({
      app: 'SetGo',
      kind: 'settings',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      data: {
        exercises: [{ id: 'bench' }],
        routines: [{ id: 'routine' }],
        routineExercisePlans: [{ id: 'plan' }],
      },
    });

    expect(preview.kind).toBe('settings');
    expect(preview.sessionCount).toBe(0);
    expect(preview.exerciseCount).toBe(1);
  });

  it('reports invalid backups with issues', () => {
    const preview = previewSetGoBackup({ app: 'Other', version: 9 });

    expect(preview.kind).toBe('invalid');
    expect(preview.issues.length).toBeGreaterThan(0);
  });

  it('reports unsupported version backup as invalid with issues', () => {
    const preview = previewSetGoBackup({
      app: 'SetGo',
      version: 99,
      data: {
        exercises: [],
        routines: [],
        routineExercisePlans: [],
        workoutSessions: [],
        cardioRecords: [],
      },
    });

    expect(preview.kind).toBe('invalid');
    expect(preview.issues).toContain('Unsupported backup version 99.');
  });

  it('creates a full backup through the storage repository boundary', async () => {
    const snapshot = emptySnapshot({
      exercises: [{ id: 'bench' } as SetGoDataSnapshot['exercises'][number]],
      workoutSessions: [{ id: 'session' } as SetGoDataSnapshot['workoutSessions'][number]],
    });
    const repository: SetGoDataRepository = {
      readBackupData: async () => snapshot,
      readSettingsBackupData: async () => emptySettingsSnapshot(),
      readExercisePreservationContext: async () => ({ exercises: [], workoutExercises: [] }),
      replaceBackupData: async () => {},
      replaceSettingsData: async () => {},
    };

    const backup = await createBackup(repository);

    expect(backup.data.exercises).toEqual(snapshot.exercises);
    expect(backup.data.workoutSessions).toEqual(snapshot.workoutSessions);
  });

  it('restores full backups through the repository and activates the first routine when needed', async () => {
    let restored: SetGoDataSnapshot | undefined;
    const repository: SetGoDataRepository = {
      readBackupData: async () => emptySnapshot(),
      readSettingsBackupData: async () => emptySettingsSnapshot(),
      readExercisePreservationContext: async () => ({ exercises: [], workoutExercises: [] }),
      replaceBackupData: async (data) => {
        restored = data;
      },
      replaceSettingsData: async () => {},
    };

    await restoreBackup({
      app: 'SetGo',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      data: {
        routines: [{ id: 'routine_a', isActive: false }, { id: 'routine_b', isActive: false }],
      },
    }, repository);

    expect(restored?.routines[0]?.isActive).toBe(true);
    expect(restored?.routineCyclePlanItems).toEqual([]);
    expect(restored?.calendarPlanOverrides).toEqual([]);
  });

  it('preserves logged exercises that are referenced by workouts during settings restore', async () => {
    let restored: SetGoSettingsDataSnapshot | undefined;
    const repository: SetGoDataRepository = {
      readBackupData: async () => emptySnapshot(),
      readSettingsBackupData: async () => emptySettingsSnapshot(),
      readExercisePreservationContext: async () => ({
        exercises: [
          { id: 'legacy_exercise', isActive: true, updatedAt: '2026-06-01T00:00:00.000Z' } as SetGoDataSnapshot['exercises'][number],
        ],
        workoutExercises: [
          { id: 'workout_exercise', exerciseId: 'legacy_exercise' } as SetGoDataSnapshot['workoutExercises'][number],
        ],
      }),
      replaceBackupData: async () => {},
      replaceSettingsData: async (data) => {
        restored = data;
      },
    };

    await restoreSettingsBackup({
      app: 'SetGo',
      kind: 'settings',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      settings: { locale: 'en' },
      data: {
        exercises: [{ id: 'bench' }],
        routines: [],
        routineDays: [],
        weeklySchedules: [],
        routineExercisePlans: [],
      },
    }, repository);

    const preserved = restored?.exercises.find((exercise) => exercise.id === 'legacy_exercise');
    expect(preserved?.isActive).toBe(false);
    expect(restored?.exercises.map((exercise) => exercise.id)).toEqual(['bench', 'legacy_exercise']);
  });
});
