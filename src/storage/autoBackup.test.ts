import { describe, expect, it } from 'vitest';
import { snapshotHasUserData } from './autoBackup';
import type { SetGoDataSnapshot } from './setgoDataRepository';

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

describe('auto backup user-data detection', () => {
  it('does not treat default-only exercise seeds as user data', () => {
    expect(snapshotHasUserData(emptySnapshot({
      exercises: [{ id: 'bench', isDefault: true } as SetGoDataSnapshot['exercises'][number]],
    }))).toBe(false);
  });

  it('treats routines, workout logs, cardio, and custom exercises as user data', () => {
    expect(snapshotHasUserData(emptySnapshot({
      routines: [{ id: 'routine' } as SetGoDataSnapshot['routines'][number]],
    }))).toBe(true);
    expect(snapshotHasUserData(emptySnapshot({
      workoutSessions: [{ id: 'session' } as SetGoDataSnapshot['workoutSessions'][number]],
    }))).toBe(true);
    expect(snapshotHasUserData(emptySnapshot({
      cardioRecords: [{ id: 'run' } as SetGoDataSnapshot['cardioRecords'][number]],
    }))).toBe(true);
    expect(snapshotHasUserData(emptySnapshot({
      exercises: [{ id: 'custom', isDefault: false } as SetGoDataSnapshot['exercises'][number]],
    }))).toBe(true);
  });
});
