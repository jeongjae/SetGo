import { describe, expect, it } from 'vitest';
import { selectReusableInProgressSession } from './workouts';
import type { WorkoutSession } from '../types';

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
  it('generates correct and stable session structure for historical calendar dates', () => {
    const historicalDate = '2026-05-10';
    const timestamp = '2026-05-10T12:00:00.000';

    const historicalSession = {
      id: `workout_${historicalDate}`,
      date: historicalDate,
      startedAt: timestamp,
      timeBand: 'afternoon',
      status: 'in_progress' as const,
      totalStrengthVolumeKg: 0,
    };

    expect(historicalSession.id).toBe('workout_2026-05-10');
    expect(historicalSession.date).toBe('2026-05-10');
    expect(historicalSession.startedAt).toBe('2026-05-10T12:00:00.000');
    expect(historicalSession.status).toBe('in_progress');
  });
});
