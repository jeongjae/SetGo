import { describe, expect, it } from 'vitest';
import {
  canCompleteWorkoutLog,
  countFullyCompletedExercises,
  formatCountdownSeconds,
  getElapsedMs,
  getLiveSessionElapsedMs,
} from './WorkoutPage';

describe('workout elapsed time', () => {
  it('measures UTC session time without timezone correction', () => {
    expect(getElapsedMs('2026-05-21T00:00:00.000Z', Date.parse('2026-05-21T00:15:00.000Z'))).toBe(900000);
  });

  it('supports local historical session timestamps', () => {
    const startedAt = '2026-05-10T12:00:00.000';
    expect(getElapsedMs(startedAt, new Date(startedAt).getTime() + 600000)).toBe(600000);
  });

  it('clamps invalid and future session timestamps', () => {
    expect(getElapsedMs('not-a-date', Date.now())).toBe(0);
    expect(getElapsedMs('2026-05-21T00:30:00.000Z', Date.parse('2026-05-21T00:15:00.000Z'))).toBe(0);
  });

  it("shows live elapsed time only for today's in-progress session", () => {
    const nowMs = new Date('2026-05-21T12:15:00').getTime();

    expect(getLiveSessionElapsedMs({
      date: '2026-05-21',
      startedAt: '2026-05-21T12:00:00',
      status: 'in_progress',
    }, nowMs)).toBe(900000);
    expect(getLiveSessionElapsedMs({
      date: '2026-05-20',
      startedAt: '2026-05-20T12:00:00',
      status: 'in_progress',
    }, nowMs)).toBeUndefined();
    expect(getLiveSessionElapsedMs({
      date: '2026-05-21',
      startedAt: '2026-05-21T12:00:00',
      status: 'completed',
    }, nowMs)).toBeUndefined();
  });
});

describe('rest countdown formatting', () => {
  it('uses a compact minutes and seconds countdown for rest surfaces', () => {
    expect(formatCountdownSeconds(90)).toBe('1:30');
    expect(formatCountdownSeconds(5)).toBe('0:05');
    expect(formatCountdownSeconds(-1)).toBe('0:00');
  });
});

describe('workout completion eligibility', () => {
  it('allows strength or cardio logs to complete a session', () => {
    expect(canCompleteWorkoutLog(1, 0)).toBe(true);
    expect(canCompleteWorkoutLog(0, 1)).toBe(true);
    expect(canCompleteWorkoutLog(0, 0)).toBe(false);
  });
});

describe('workout progress counters', () => {
  it('counts an exercise only after all of its sets are complete', () => {
    expect(countFullyCompletedExercises([
      { sets: [{ isCompleted: true }, { isCompleted: false }] },
      { sets: [{ isCompleted: true }] },
      { sets: [] },
    ])).toBe(1);
  });
});
