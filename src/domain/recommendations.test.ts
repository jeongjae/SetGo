import { describe, expect, it } from 'vitest';
import { recommendExerciseTarget, resolveTargetRepRange, type RecentExerciseSession } from './recommendations';

function session(date: string, sets: RecentExerciseSession['sets']): RecentExerciseSession {
  return { date, sets };
}

describe('exercise target recommendations', () => {
  it('uses the routine target when there is no completed history', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        plannedSets: 3,
        plannedRir: 2,
      },
      recentSessions: [],
    })).toMatchObject({
      weightKg: 60,
      reps: 10,
      sets: 3,
      rir: 2,
      confidence: 'low',
    });
  });

  it('increases compound weight after all working sets reach the top of range with controlled RIR', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 62.5,
      reps: 8,
      sets: 3,
      rir: 2,
      confidence: 'medium',
    });
  });

  it('does not increase weight when one top-range set was a max effort', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 60, reps: 10, rir: 0, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 60,
      reps: 10,
    });
  });

  it('uses estimated strength instead of raw volume when selecting the base set', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 80,
        plannedReps: 8,
        plannedSets: 3,
        targetRepMin: 6,
        targetRepMax: 8,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 100, reps: 6, rir: 2, isCompleted: true },
          { weightKg: 70, reps: 12, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 100,
      reps: 8,
    });
  });

  it('uses the exercise library weight increment before the legacy routine plan increment', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
        preferredWeightIncrementKg: 2.5,
      },
      exercise: {
        category: 'biceps',
        categoryTags: ['biceps'],
        preferredWeightIncrementKg: 1,
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 20, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 20, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 21,
      reps: 8,
    });
  });

  it('uses 80% of the matching hypertrophy history for maintenance phase', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 70,
        plannedReps: 10,
        plannedSets: 3,
        plannedRir: 2,
      },
      currentFamily: 'upper',
      currentPhase: 'maintenance',
      recentSessions: [
        session('2026-06-20', [
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 8, rir: 2, isCompleted: true },
        ]),
      ].map((item) => ({ ...item, family: 'upper', intensityPhase: 'hypertrophy' })),
    })).toMatchObject({
      weightKg: 80,
      reps: 12,
      sets: 3,
      confidence: 'high',
    });
  });

  it('keeps maintenance volume at the planned set count even when the heavy source had extra sets', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 70,
        plannedReps: 10,
        plannedSets: 3,
        plannedRir: 2,
      },
      currentFamily: 'upper',
      currentPhase: 'maintenance',
      recentSessions: [
        session('2026-06-20', [
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 95, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 90, reps: 10, rir: 2, isCompleted: true },
        ]),
      ].map((item) => ({ ...item, family: 'upper', intensityPhase: 'hypertrophy' })),
    })).toMatchObject({
      weightKg: 80,
      reps: 12,
      sets: 3,
    });
  });

  it('cuts load and sets for deload phase', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 90,
        plannedReps: 10,
        plannedSets: 4,
        plannedRir: 2,
      },
      currentPhase: 'deload',
      recentSessions: [
        session('2026-06-20', [
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 100, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 80,
      reps: 10,
      sets: 2,
      confidence: 'high',
    });
  });

  it('holds weight when the global goal is maintenance', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      globalGoal: 'maintenance',
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 60,
      reps: 8,
      sets: 3,
    });
  });

  it('holds weight when recent working sets are inside the target range', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 60, reps: 9, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 60,
      reps: 9,
      sets: 3,
      confidence: 'medium',
    });
  });

  it('does not copy a one-off extra set into the next recommendation', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        plannedSets: 3,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 60, reps: 9, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 55, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 50, reps: 12, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      sets: 3,
    });
  });

  it('adds at most one set after repeated higher-volume sessions', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        plannedSets: 3,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-25', [
          { weightKg: 60, reps: 9, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 55, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 50, reps: 12, rir: 2, isCompleted: true },
        ]),
        session('2026-06-18', [
          { weightKg: 60, reps: 9, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
          { weightKg: 55, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      sets: 4,
    });
  });

  it('prefers rep progression for isolation exercises before weight jumps', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 12,
        plannedReps: 12,
        targetRepMin: 10,
        targetRepMax: 12,
        progressionStyle: 'isolation',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 12, reps: 10, rir: 2, isCompleted: true },
          { weightKg: 12, reps: 10, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 12,
      reps: 11,
    });
  });

  it('reduces weight after missing the low end of range at max effort', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 100,
        plannedReps: 8,
        targetRepMin: 6,
        targetRepMax: 8,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-18', [
          { weightKg: 100, reps: 6, rir: 1, isCompleted: true },
          { weightKg: 100, reps: 5, rir: 0, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 97.5,
      reps: 6,
      confidence: 'medium',
    });
  });

  it('sorts recent sessions defensively and uses the latest history first', () => {
    expect(recommendExerciseTarget({
      plan: {
        plannedWeightKg: 60,
        plannedReps: 10,
        targetRepMin: 8,
        targetRepMax: 10,
        progressionStyle: 'compound',
      },
      recentSessions: [
        session('2026-06-01', [
          { weightKg: 80, reps: 10, rir: 2, isCompleted: true },
        ]),
        session('2026-06-18', [
          { weightKg: 60, reps: 8, rir: 2, isCompleted: true },
        ]),
      ],
    })).toMatchObject({
      weightKg: 60,
      reps: 8,
    });
  });

  it('derives a default rep range from the planned reps', () => {
    expect(resolveTargetRepRange({ plannedReps: 10 })).toEqual({ min: 8, max: 10 });
  });
});
