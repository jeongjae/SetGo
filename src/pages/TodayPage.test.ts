import { describe, expect, it } from 'vitest';
import { summarizeRunningRecordsForTodayCard, todayWorkoutSummaryLabel } from './TodayPage';

describe('today workout summary label', () => {
  it('shows running for independent running workouts', () => {
    expect(todayWorkoutSummaryLabel({
      session: { entryKind: 'running' },
    }, 'en')).toBe('Running');
  });

  it('shows free workout for independent free workouts', () => {
    expect(todayWorkoutSummaryLabel({
      session: { entryKind: 'free' },
    }, 'en')).toBe('Free workout');
  });

  it('prefers the routine day name over the routine name', () => {
    expect(todayWorkoutSummaryLabel({
      session: {},
      routineName: '4-Day Routine',
      routineDay: { id: 'upper', routineId: 'routine', code: 'A', name: 'Upper', sequence: 1 },
    }, 'en')).toBe('Upper');
  });
});

describe('today running summary detail', () => {
  it('shows total running distance and time', () => {
    expect(summarizeRunningRecordsForTodayCard([
      {
        distanceKm: 2.4,
        startedAt: '2026-06-05T08:00:00.000',
        endedAt: '2026-06-05T08:15:00.000',
        isDraft: false,
      },
      {
        distanceKm: 1.6,
        startedAt: '2026-06-05T08:20:00.000',
        endedAt: '2026-06-05T08:30:00.000',
        isDraft: false,
      },
    ], 'en')).toBe('4.0 km / 25 min');
  });

  it('ignores draft running records', () => {
    expect(summarizeRunningRecordsForTodayCard([
      {
        distanceKm: 2,
        startedAt: '2026-06-05T08:00:00.000',
        endedAt: '2026-06-05T08:15:00.000',
        isDraft: true,
      },
    ], 'en')).toBeUndefined();
  });
});
