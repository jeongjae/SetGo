import { describe, expect, it } from 'vitest';
import {
  createWorkoutExerciseSeed,
  createWorkoutSessionForDate,
  selectReusableInProgressSession,
  selectWorkoutStartSession,
} from './workouts';
import type { ExerciseMaster, RoutineExercisePlan, WorkoutRecommendationSnapshot, WorkoutSession } from '../types';

function session(
  id: string,
  status: WorkoutSession['status'],
  startedAt: string,
  routineDayId?: string,
): WorkoutSession {
  return {
    id,
    date: '2026-05-20',
    startedAt,
    timeBand: 'afternoon',
    routineDayId,
    status,
    totalStrengthVolumeKg: 0,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

describe('workout session reuse', () => {
  it('reuses the newest in-progress session for the selected date', () => {
    const reusable = selectReusableInProgressSession([
      session('completed', 'completed', '2026-05-20T08:00:00.000Z'),
      session('older', 'in_progress', '2026-05-20T09:00:00.000Z'),
      session('newer', 'in_progress', '2026-05-20T10:00:00.000Z'),
    ]);

    expect(reusable?.id).toBe('newer');
  });

  it('does not reuse another routine day when the user selected a specific routine day', () => {
    const reusable = selectReusableInProgressSession([
      session('push', 'in_progress', '2026-05-20T09:00:00.000Z', 'push'),
      session('pull', 'in_progress', '2026-05-20T10:00:00.000Z', 'pull'),
    ], 'push');

    expect(reusable?.id).toBe('push');
  });

  it('creates a separate record when calendar add flow requests a new workout', () => {
    const reusable = selectReusableInProgressSession([
      session('existing', 'in_progress', '2026-05-20T09:00:00.000Z', 'push'),
    ], 'push', { createNew: true });

    expect(reusable).toBeUndefined();
  });

  it('does not reuse a routine workout when starting a running-only workout', () => {
    const reusable = selectReusableInProgressSession([
      session('existing', 'in_progress', '2026-05-20T09:00:00.000Z', 'push'),
    ], undefined, { kind: 'running' });

    expect(reusable).toBeUndefined();
  });

  it('keeps the existing in-progress session when the start flow can resume it', () => {
    const existingSession = session('existing', 'in_progress', '2026-05-20T09:00:00.000Z', 'push');
    const selection = selectWorkoutStartSession(
      '2026-05-20',
      new Date('2026-05-21T09:30:00.000Z'),
      [existingSession],
      'push',
    );

    expect(selection).toEqual({ kind: 'reuse', session: existingSession });
  });

  it('creates a separate session when a new Calendar record is requested', () => {
    const selection = selectWorkoutStartSession(
      '2026-05-20',
      new Date('2026-05-21T09:30:00.000Z'),
      [session('existing', 'in_progress', '2026-05-20T09:00:00.000Z', 'push')],
      'push',
      { createNew: true },
      'routine_push_pull',
      'push',
    );

    expect(selection.kind).toBe('create');
    expect(selection.session).toMatchObject({
      id: 'workout_2026-05-20_1779355800000',
      date: '2026-05-20',
      routineId: 'routine_push_pull',
      routineDayId: 'push',
    });
  });
});

describe('workout and routine template isolation (Scenario A)', () => {
  it('ensures completed sets preserve historical values even if the routine template is modified', () => {
    const historicalCompletedSet = {
      id: 'workout_2026-05-19_set_1',
      workoutExerciseId: 'workout_2026-05-19_ex_1',
      setNo: 1,
      weightKg: 80,
      reps: 10,
      isCompleted: true,
    };

    const modifiedRoutinePlan = {
      id: 'plan_ex_1',
      exerciseId: 'ex_1',
      plannedWeightKg: 90,
      plannedReps: 8,
    };

    expect(historicalCompletedSet.weightKg).toBe(80);
    expect(historicalCompletedSet.reps).toBe(10);
    expect(historicalCompletedSet.weightKg).not.toBe(modifiedRoutinePlan.plannedWeightKg);
    expect(historicalCompletedSet.reps).not.toBe(modifiedRoutinePlan.plannedReps);
  });
});

describe('workout date binding and session creation safety (Scenario C)', () => {
  it('binds the first backdated calendar workout to the selected date', () => {
    const historicalSession = createWorkoutSessionForDate(
      '2026-05-10',
      new Date('2026-05-21T09:30:00.000Z'),
      0,
      'routine_push_pull',
      'routine_push_pull_day_1',
    );

    expect(historicalSession).toMatchObject({
      id: 'workout_2026-05-10_1779355800000',
      date: '2026-05-10',
      startedAt: '2026-05-10T12:00:00.000',
      timeBand: 'afternoon',
      routineId: 'routine_push_pull',
      routineDayId: 'routine_push_pull_day_1',
      status: 'in_progress',
    });
  });

  it('uses unique ids and current timestamps for extra records on the same date', () => {
    const now = new Date('2026-05-21T09:30:00.000Z');
    const extraSession = createWorkoutSessionForDate('2026-05-20', now, 1);

    expect(extraSession.id).toBe(`workout_2026-05-20_${now.getTime()}`);
    expect(extraSession.startedAt).toBe(now.toISOString());
  });

  it('marks explicit running and free workout sessions without assigning a routine', () => {
    const now = new Date('2026-05-21T09:30:00.000Z');

    expect(createWorkoutSessionForDate('2026-05-21', now, 0, undefined, undefined, 'running')).toMatchObject({
      routineId: undefined,
      routineDayId: undefined,
      entryKind: 'running',
    });
    expect(createWorkoutSessionForDate('2026-05-21', now, 0, undefined, undefined, 'free')).toMatchObject({
      routineId: undefined,
      routineDayId: undefined,
      entryKind: 'free',
    });
  });

  it('stores the recommendation snapshot used to start a workout', () => {
    const snapshot: WorkoutRecommendationSnapshot = {
      kind: 'routine',
      sessionKind: 'planned',
      routineDayId: 'routine_push_pull_day_1',
      label: 'Push',
      source: 'weekly-schedule',
      reason: 'weeklyRoutine',
      confidence: 'medium',
      createdAt: '2026-05-21T09:30:00.000Z',
    };

    expect(createWorkoutSessionForDate(
      '2026-05-21',
      new Date('2026-05-21T09:30:00.000Z'),
      0,
      'routine_push_pull',
      'routine_push_pull_day_1',
      'planned',
      snapshot,
    )).toMatchObject({
      recommendationSnapshot: snapshot,
    });
  });

  it('does not reuse the id of a deleted first session when the same date is started again', () => {
    const deletedSession = createWorkoutSessionForDate(
      '2026-05-20',
      new Date('2026-05-20T09:00:00.000Z'),
      0,
    );
    const replacementSession = createWorkoutSessionForDate(
      '2026-05-20',
      new Date('2026-05-20T10:00:00.000Z'),
      0,
    );

    expect(replacementSession.id).not.toBe(deletedSession.id);
  });
});

describe('routine plan seeding', () => {
  function exercise(id: string, stage: ExerciseMaster['stage']): ExerciseMaster {
    return {
      id,
      nameKo: id,
      nameEn: id,
      stage,
      stageTags: [stage],
      category: stage === 'warmup' ? 'mobility' : 'chest',
      categoryTags: [stage === 'warmup' ? 'mobility' : 'chest'],
      defaultEmoji: 'EX',
      isDefault: true,
      isActive: true,
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
    };
  }

  it('copies edited routine plan values only into a new workout seed', () => {
    const plan: RoutineExercisePlan = {
      id: 'routine_day_1_bench_press',
      routineDayId: 'routine_day_1',
      exerciseId: 'bench_press',
      order: 1,
      plannedSets: 4,
      plannedWeightKg: 82.5,
      plannedReps: 8,
      plannedRir: 1,
      plannedRestSeconds: 120,
    };

    const seed = createWorkoutExerciseSeed(
      'workout_2026-05-21',
      [plan],
      new Map([['bench_press', exercise('bench_press', 'main')]]),
    );

    expect(seed.workoutExercises).toEqual([{
      id: 'workout_2026-05-21_routine_day_1_bench_press',
      sessionId: 'workout_2026-05-21',
      exerciseId: 'bench_press',
      order: 1,
      status: 'planned',
      totalVolumeKg: 0,
      restSeconds: 120,
    }]);
    expect(seed.workoutSets).toHaveLength(4);
    expect(seed.workoutSets[0]).toMatchObject({
      weightKg: 82.5,
      reps: 8,
      rir: 1,
      isCompleted: false,
      isWarmup: false,
    });
  });

  it('marks warmup-only routine exercise seeds as warmup sets', () => {
    const plan: RoutineExercisePlan = {
      id: 'routine_day_1_joint_mobility',
      routineDayId: 'routine_day_1',
      exerciseId: 'joint_mobility',
      order: 1,
      plannedSets: 2,
      plannedReps: 12,
    };

    const seed = createWorkoutExerciseSeed(
      'workout_2026-05-21',
      [plan],
      new Map([['joint_mobility', exercise('joint_mobility', 'warmup')]]),
    );

    expect(seed.workoutSets.map((set) => set.isWarmup)).toEqual([true, true]);
  });

  it('prefills new workout sets from exercise target recommendations when available', () => {
    const plan: RoutineExercisePlan = {
      id: 'routine_day_1_bench_press',
      routineDayId: 'routine_day_1',
      exerciseId: 'bench_press',
      order: 1,
      plannedSets: 3,
      plannedWeightKg: 60,
      plannedReps: 10,
      plannedRir: 2,
    };

    const seed = createWorkoutExerciseSeed(
      'workout_2026-05-21',
      [plan],
      new Map([['bench_press', exercise('bench_press', 'main')]]),
      new Map([[
        plan.id,
        {
          weightKg: 62.5,
          reps: 8,
          sets: 4,
          rir: 2,
          targetRepMin: 8,
          targetRepMax: 10,
          reason: 'Last session reached the top of the range.',
          confidence: 'medium',
        },
      ]]),
    );

    expect(seed.workoutSets).toHaveLength(4);
    expect(seed.workoutSets.map((set) => ({
      weightKg: set.weightKg,
      reps: set.reps,
      rir: set.rir,
    }))).toEqual([
      { weightKg: 62.5, reps: 8, rir: 2 },
      { weightKg: 62.5, reps: 8, rir: 2 },
      { weightKg: 62.5, reps: 8, rir: 2 },
      { weightKg: 62.5, reps: 8, rir: 2 },
    ]);
    expect(seed.recommendationTargets).toEqual([{
      planId: plan.id,
      exerciseId: 'bench_press',
      weightKg: 62.5,
      reps: 8,
      sets: 4,
      rir: 2,
      targetRepMin: 8,
      targetRepMax: 10,
      confidence: 'medium',
      reason: 'Last session reached the top of the range.',
    }]);
  });
});
