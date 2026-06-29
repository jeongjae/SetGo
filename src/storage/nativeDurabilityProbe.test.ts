import { describe, expect, it } from 'vitest';
import {
  createNativeDurabilityProbeSnapshot,
  SETGO_NATIVE_PROBE_SESSION_ID,
} from './nativeDurabilityProbe';

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
});
