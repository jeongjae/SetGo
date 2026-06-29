import { createCapacitorSqliteDriver } from './capacitorSqliteDriver';
import {
  createNativeSqliteDataRepository,
  initializeNativeSqliteSchema,
} from './nativeSqliteRepository';
import type { SetGoDataSnapshot } from './setgoDataRepository';

export const SETGO_NATIVE_PROBE_DATABASE = 'setgo_probe';
export const SETGO_NATIVE_PROBE_SESSION_ID = 'native_probe_session';

export type NativeDurabilityProbeResult = {
  ok: boolean;
  database: string;
  previousRun?: {
    writtenAt: string;
    sessionCount: number;
    setCount: number;
    cardioCount: number;
  };
  currentRun: {
    writtenAt: string;
    sessionCount: number;
    setCount: number;
    cardioCount: number;
  };
};

export function createNativeDurabilityProbeSnapshot(writtenAt: string): SetGoDataSnapshot {
  return {
    exercises: [{
      id: 'native_probe_bench',
      nameKo: 'Native Probe Bench',
      nameEn: 'Native Probe Bench',
      stage: 'main',
      stageTags: ['main'],
      category: 'chest',
      categoryTags: ['chest'],
      description: 'Native SQLite durability probe exercise.',
      defaultEmoji: 'P',
      isDefault: false,
      isActive: true,
      createdAt: writtenAt,
      updatedAt: writtenAt,
    }],
    routines: [{
      id: 'native_probe_routine',
      name: 'Native Probe Routine',
      splitType: 'custom',
      startDate: writtenAt.slice(0, 10),
      isActive: true,
      createdAt: writtenAt,
      updatedAt: writtenAt,
    }],
    routineDays: [{
      id: 'native_probe_day',
      routineId: 'native_probe_routine',
      code: 'P',
      name: 'Probe Day',
      sequence: 1,
      family: 'probe',
      intensityPhase: 'hypertrophy',
    }],
    weeklySchedules: [{
      id: 'native_probe_weekly',
      routineId: 'native_probe_routine',
      weekday: 1,
      routineDayId: 'native_probe_day',
      isRestDay: false,
    }],
    routineCyclePlanItems: [{
      id: 'native_probe_cycle',
      routineId: 'native_probe_routine',
      order: 1,
      kind: 'routine',
      routineDayId: 'native_probe_day',
    }],
    calendarPlanOverrides: [],
    routineExercisePlans: [{
      id: 'native_probe_plan',
      routineDayId: 'native_probe_day',
      exerciseId: 'native_probe_bench',
      order: 1,
      plannedWeightKg: 80,
      plannedReps: 8,
      plannedSets: 3,
      plannedRir: 2,
      plannedRestSeconds: 120,
      targetRepMin: 6,
      targetRepMax: 10,
      progressionStyle: 'compound',
      preferredWeightIncrementKg: 2.5,
      note: 'Native SQLite durability probe plan.',
    }],
    workoutSessions: [{
      id: SETGO_NATIVE_PROBE_SESSION_ID,
      date: writtenAt.slice(0, 10),
      startedAt: writtenAt,
      endedAt: writtenAt,
      timeBand: 'morning',
      routineId: 'native_probe_routine',
      routineDayId: 'native_probe_day',
      cyclePlanItemId: 'native_probe_cycle',
      entryKind: 'planned',
      recommendationSnapshot: {
        kind: 'routine',
        sessionKind: 'planned',
        routineDayId: 'native_probe_day',
        label: 'Native SQLite Probe',
        source: 'fallback',
        reason: 'noActiveRoutine',
        confidence: 'high',
        createdAt: writtenAt,
      },
      status: 'completed',
      totalStrengthVolumeKg: 2400,
      memo: 'Native SQLite durability probe session.',
      autoSkipped: false,
      isDemo: true,
      createdAt: writtenAt,
      updatedAt: writtenAt,
    }],
    workoutExercises: [{
      id: 'native_probe_workout_exercise',
      sessionId: SETGO_NATIVE_PROBE_SESSION_ID,
      exerciseId: 'native_probe_bench',
      order: 1,
      status: 'completed',
      totalVolumeKg: 2400,
      restSeconds: 120,
      memo: 'Native SQLite durability probe exercise log.',
    }],
    workoutSets: [{
      id: 'native_probe_set',
      workoutExerciseId: 'native_probe_workout_exercise',
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
      id: 'native_probe_cardio',
      sessionId: SETGO_NATIVE_PROBE_SESSION_ID,
      order: 1,
      isDraft: false,
      source: 'manual',
      sourceName: 'SetGo Native Probe',
      externalId: `native-probe-${writtenAt}`,
      importedAt: writtenAt,
      activityType: 'running',
      environment: 'outdoor',
      startedAt: writtenAt,
      endedAt: writtenAt,
      durationSeconds: 600,
      distanceKm: 1.5,
      averageSpeedKmh: 9,
      memo: 'Native SQLite durability probe cardio record.',
    }],
  };
}

export async function runNativeDurabilityProbe(): Promise<NativeDurabilityProbeResult> {
  const driver = await createCapacitorSqliteDriver({ database: SETGO_NATIVE_PROBE_DATABASE });
  await initializeNativeSqliteSchema(driver);

  const repository = createNativeSqliteDataRepository(driver);
  const before = await repository.readBackupData();
  const previousSession = before.workoutSessions.find((session) => session.id === SETGO_NATIVE_PROBE_SESSION_ID);
  const previousRun = previousSession
    ? {
      writtenAt: previousSession.updatedAt,
      sessionCount: before.workoutSessions.length,
      setCount: before.workoutSets.length,
      cardioCount: before.cardioRecords.length,
    }
    : undefined;

  const writtenAt = new Date().toISOString();
  await repository.replaceBackupData(createNativeDurabilityProbeSnapshot(writtenAt));

  const after = await repository.readBackupData();
  const currentSession = after.workoutSessions.find((session) => session.id === SETGO_NATIVE_PROBE_SESSION_ID);
  const currentSet = after.workoutSets.find((set) => set.id === 'native_probe_set');
  const currentCardio = after.cardioRecords.find((record) => record.id === 'native_probe_cardio');

  if (!currentSession || !currentSet || !currentCardio) {
    throw new Error('Native SQLite probe write/read verification failed.');
  }

  return {
    ok: true,
    database: SETGO_NATIVE_PROBE_DATABASE,
    previousRun,
    currentRun: {
      writtenAt: currentSession.updatedAt,
      sessionCount: after.workoutSessions.length,
      setCount: after.workoutSets.length,
      cardioCount: after.cardioRecords.length,
    },
  };
}
