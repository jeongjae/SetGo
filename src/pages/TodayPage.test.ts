import { describe, expect, it } from 'vitest';
import { scopeDeloadRecommendationToPlannedGroups, summarizeRunningRecordsForTodayCard, todayWorkoutSummaryLabel } from './TodayPage';
import type { RecoverySnapshot } from '../domain/recovery';
import type { DeloadRecommendation } from '../domain/stats';

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

describe('planned deload recommendation scope', () => {
  const recommendation: DeloadRecommendation = {
    shouldDeload: true,
    severity: 'caution',
    currentHardSets: 10,
    baselineHardSets: 6,
    hardSetRatio: 80,
    recoveryPercent: 70,
    suggestedSetReductionPct: 35,
    reasons: ['Global load is elevated.'],
  };
  const recovery: RecoverySnapshot = {
    generatedAt: '2026-06-30T00:00:00.000Z',
    averageRecoveryPercent: 70,
    readinessStatus: 'moderate',
    mostFatiguedGroups: [],
    bestRecoveredGroups: [],
    recommendation: '',
    groups: [
      { group: 'chest', rawLoad: 1000, adjustedLoad: 1000, decayedLoad: 1000, fatigueScore: 60, recoveryPercent: 40, status: 'fatigued' },
      { group: 'legs', rawLoad: 100, adjustedLoad: 100, decayedLoad: 100, fatigueScore: 15, recoveryPercent: 85, status: 'ready' },
    ],
  };

  it('hides global deload prompts when the planned muscle groups are recovered', () => {
    expect(scopeDeloadRecommendationToPlannedGroups(recommendation, ['legs'], recovery, 'ko')).toBeUndefined();
  });

  it('keeps deload prompts when the planned muscle groups are fatigued', () => {
    const scoped = scopeDeloadRecommendationToPlannedGroups(recommendation, ['chest'], recovery, 'ko');

    expect(scoped?.recoveryPercent).toBe(40);
    expect(scoped?.reasons[0]).toContain('상체');
    expect(scoped?.reasons[0]).toContain('가슴');
  });

  it('keeps high-severity global deload prompts when full-body recovery is very low', () => {
    const scoped = scopeDeloadRecommendationToPlannedGroups(
      { ...recommendation, severity: 'high' },
      ['legs'],
      { ...recovery, averageRecoveryPercent: 45 },
      'ko',
    );

    expect(scoped?.reasons[0]).toContain('전신');
  });
});
