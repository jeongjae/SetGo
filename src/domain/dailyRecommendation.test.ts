import { describe, expect, it } from 'vitest';
import { buildDailyWorkoutRecommendation, type BuildDailyWorkoutRecommendationInput } from './dailyRecommendation';
import type { RoutineDay } from '../types';

const upperDay: RoutineDay = {
  id: 'upper',
  routineId: 'routine',
  code: 'upper',
  name: 'Upper',
  sequence: 1,
};

const lowerDay: RoutineDay = {
  id: 'lower',
  routineId: 'routine',
  code: 'lower',
  name: 'Lower',
  sequence: 2,
};

function buildInput(
  input: Partial<BuildDailyWorkoutRecommendationInput>,
): BuildDailyWorkoutRecommendationInput {
  return {
    schedule: {
      kind: 'rest',
      isRestDay: true,
    },
    hasActiveRoutine: true,
    freeWorkoutLabel: 'Free workout',
    runningLabel: 'Running',
    restDayLabel: 'Rest day',
    noRoutineDayLabel: 'No routine day planned',
    getRoutineDayLabel: (routineDay) => routineDay?.name,
    ...input,
  };
}

describe('daily workout recommendations', () => {
  it('prefers a manual routine override over other planning sources', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      schedule: {
        override: { kind: 'routine', routineDayId: upperDay.id, isRestDay: false },
        routineDay: upperDay,
        kind: 'routine',
        isRestDay: false,
      },
    }))).toMatchObject({
      kind: 'routine',
      sessionKind: 'planned',
      routineDay: upperDay,
      label: 'Upper',
      source: 'override',
      reason: 'manualOverride',
      confidence: 'high',
    });
  });

  it('uses a cycle routine item as the daily recommendation', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      schedule: {
        cycleItem: { kind: 'routine', routineDayId: lowerDay.id },
        routineDay: lowerDay,
        kind: 'routine',
        isRestDay: false,
      },
    }))).toMatchObject({
      kind: 'routine',
      routineDay: lowerDay,
      source: 'cycle',
      reason: 'cycleRoutine',
      confidence: 'medium',
    });
  });

  it('maps planned running to a running session', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      schedule: {
        schedule: { isRestDay: false },
        kind: 'running',
        isRestDay: false,
      },
    }))).toMatchObject({
      kind: 'running',
      sessionKind: 'running',
      label: 'Running',
      reason: 'plannedRunning',
    });
  });

  it('prioritizes a recently skipped routine before the normal routine schedule', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      makeUpRoutineDay: lowerDay,
      schedule: {
        schedule: { routineDayId: upperDay.id, isRestDay: false },
        routineDay: upperDay,
        kind: 'routine',
        isRestDay: false,
      },
    }))).toMatchObject({
      kind: 'routine',
      routineDay: lowerDay,
      label: 'Lower',
      source: 'make-up',
      reason: 'makeUpSkippedWorkout',
      confidence: 'medium',
    });
  });

  it('suggests the next routine day when today is a rest day', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      nextRoutineDay: upperDay,
    }))).toMatchObject({
      kind: 'rest',
      sessionKind: 'planned',
      routineDay: upperDay,
      label: 'Upper',
      source: 'next-routine-day',
      reason: 'nextRoutineAfterLatestWorkout',
      confidence: 'medium',
    });
  });

  it('falls back to free workout when no active routine exists', () => {
    expect(buildDailyWorkoutRecommendation(buildInput({
      hasActiveRoutine: false,
    }))).toMatchObject({
      kind: 'free',
      sessionKind: 'free',
      label: 'Free workout',
      source: 'fallback',
      reason: 'noActiveRoutine',
      confidence: 'low',
    });
  });
});
