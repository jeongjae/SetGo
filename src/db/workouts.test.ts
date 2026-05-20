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
