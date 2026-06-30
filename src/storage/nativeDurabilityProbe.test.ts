import { describe, expect, it } from 'vitest';
import {
  createNativeDurabilityProbeSnapshot,
  runNativeDurabilityProbeAgainstRepository,
  SETGO_NATIVE_PROBE_SESSION_ID,
} from './nativeDurabilityProbe';
import type { SetGoDataRepository, SetGoDataSnapshot, SetGoSettingsDataSnapshot } from './setgoDataRepository';

function createEmptySnapshot(): SetGoDataSnapshot {
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
  };
}

class MemorySetGoDataRepository implements SetGoDataRepository {
  private data = createEmptySnapshot();

  async readBackupData(): Promise<SetGoDataSnapshot> {
    return structuredClone(this.data);
  }

  async readSettingsBackupData(): Promise<SetGoSettingsDataSnapshot> {
    const {
      exercises,
      routines,
      routineDays,
      weeklySchedules,
      routineCyclePlanItems,
      calendarPlanOverrides,
      routineExercisePlans,
    } = this.data;

    return structuredClone({
      exercises,
      routines,
      routineDays,
      weeklySchedules,
      routineCyclePlanItems,
      calendarPlanOverrides,
      routineExercisePlans,
    });
  }

  async readExercisePreservationContext() {
    return structuredClone({
      exercises: this.data.exercises,
      workoutExercises: this.data.workoutExercises,
    });
  }

  async replaceBackupData(data: SetGoDataSnapshot): Promise<void> {
    this.data = structuredClone(data);
  }

  async replaceSettingsData(data: SetGoSettingsDataSnapshot): Promise<void> {
    this.data = {
      ...this.data,
      ...structuredClone(data),
    };
  }
}

describe('native durability probe snapshot', () => {
  it('creates a complete isolated backup snapshot for native SQLite verification', () => {
    const snapshot = createNativeDurabilityProbeSnapshot('2026-06-29T09:30:00.000Z');

    expect(snapshot.exercises).toHaveLength(1);
    expect(snapshot.routines).toHaveLength(1);
    expect(snapshot.routineDays).toHaveLength(1);
    expect(snapshot.weeklySchedules).toHaveLength(1);
    expect(snapshot.routineCyclePlanItems).toHaveLength(1);
    expect(snapshot.routineExercisePlans).toHaveLength(1);
    expect(snapshot.workoutSessions).toHaveLength(1);
    expect(snapshot.workoutExercises).toHaveLength(1);
    expect(snapshot.workoutSets).toHaveLength(1);
    expect(snapshot.cardioRecords).toHaveLength(1);
  });

  it('marks the probe session as demo data and stores recommendation evidence', () => {
    const snapshot = createNativeDurabilityProbeSnapshot('2026-06-29T09:30:00.000Z');

    expect(snapshot.workoutSessions[0]).toMatchObject({
      id: SETGO_NATIVE_PROBE_SESSION_ID,
      isDemo: true,
      recommendationSnapshot: {
        label: 'Native SQLite Probe',
        confidence: 'high',
      },
    });
    expect(snapshot.workoutSets[0]).toMatchObject({
      estimatedOneRmKg: 126.7,
      isCompleted: true,
      isHard: true,
    });
    expect(snapshot.cardioRecords[0]).toMatchObject({
      sourceName: 'SetGo Native Probe',
      activityType: 'running',
      distanceKm: 1.5,
    });
  });

  it('detects a previous native probe run after storage survives a relaunch-like second read', async () => {
    const repository = new MemorySetGoDataRepository();

    const firstRun = await runNativeDurabilityProbeAgainstRepository(repository, '2026-06-29T09:30:00.000Z');
    const secondRun = await runNativeDurabilityProbeAgainstRepository(repository, '2026-06-29T10:45:00.000Z');

    expect(firstRun.previousRun).toBeUndefined();
    expect(firstRun.currentRun).toMatchObject({
      writtenAt: '2026-06-29T09:30:00.000Z',
      sessionCount: 1,
      setCount: 1,
      cardioCount: 1,
    });

    expect(secondRun.previousRun).toEqual({
      writtenAt: '2026-06-29T09:30:00.000Z',
      sessionCount: 1,
      setCount: 1,
      cardioCount: 1,
    });
    expect(secondRun.currentRun.writtenAt).toBe('2026-06-29T10:45:00.000Z');
  });
});
