import { describe, expect, it } from 'vitest';
import {
  canCompleteWorkoutLog,
  countLoggedCardioRecords,
  countFullyCompletedExercises,
  expandWorkoutExercise,
  formatCountdownSeconds,
  getElapsedMs,
  getLiveSessionElapsedMs,
  getNextIncompleteSetTarget,
  getWorkoutFinishSummary,
  getWorkoutSetProgressBadges,
  parseOptionalDecimalInput,
  shouldConfirmCardioDelete,
  shouldCompleteHistoricalSetOnSave,
  shouldConfirmWorkoutExerciseDelete,
  shouldConfirmWorkoutSetDelete,
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

  it("keeps today's in-progress workout live until the user completes it", () => {
    const nowMs = new Date('2026-05-21T12:15:00').getTime();

    expect(getLiveSessionElapsedMs({
      date: '2026-05-21',
      startedAt: '2026-05-21T12:00:00',
      status: 'in_progress',
    }, nowMs)).toBeDefined();
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
  it('requires a completed strength set or a cardio log to complete a session', () => {
    expect(canCompleteWorkoutLog(1, 0)).toBe(true);
    expect(canCompleteWorkoutLog(0, 1)).toBe(true);
    expect(canCompleteWorkoutLog(0, 0)).toBe(false);
  });

  it('auto-completes historical sets with entered values on save', () => {
    expect(shouldCompleteHistoricalSetOnSave({
      isCompleted: false,
      weightKg: 80,
      reps: 0,
      rir: undefined,
    })).toBe(true);
    expect(shouldCompleteHistoricalSetOnSave({
      isCompleted: false,
      weightKg: 0,
      reps: 10,
      rir: undefined,
    })).toBe(true);
    expect(shouldCompleteHistoricalSetOnSave({
      isCompleted: false,
      weightKg: 0,
      reps: 0,
      rir: 2,
    })).toBe(true);
    expect(shouldCompleteHistoricalSetOnSave({
      isCompleted: true,
      weightKg: 0,
      reps: 0,
      rir: undefined,
    })).toBe(false);
    expect(shouldCompleteHistoricalSetOnSave({
      isCompleted: false,
      weightKg: 0,
      reps: 0,
      rir: undefined,
    })).toBe(false);
  });

  it('does not auto-complete untouched planned routine sets in historical edits', () => {
    const plannedSet = {
      isCompleted: false,
      weightKg: 82.5,
      reps: 8,
      rir: 2,
    };

    expect(shouldCompleteHistoricalSetOnSave(plannedSet, {
      weightKg: 82.5,
      reps: 8,
      rir: 2,
    })).toBe(false);
    expect(shouldCompleteHistoricalSetOnSave({
      ...plannedSet,
      reps: 10,
    }, {
      weightKg: 82.5,
      reps: 8,
      rir: 2,
    })).toBe(true);
  });

  it('does not treat a new cardio draft as a logged cardio record', () => {
    expect(countLoggedCardioRecords([
      { isDraft: true },
      {},
      { isDraft: false },
    ])).toBe(2);
  });

  it('summarizes completed sets, hard sets, PRs, and cardio logs', () => {
    const summary = getWorkoutFinishSummary([
      {
        pastBestWeight: 100,
        pastBestVolume: 1000,
        sets: [
          { isCompleted: true, weightKg: 105, reps: 10, isWarmup: false, isHard: true },
          { isCompleted: false, weightKg: 80, reps: 8, isWarmup: false },
        ],
      },
    ] as any, [{ isDraft: false }, { isDraft: true }], 1050, 'en');

    expect(summary.completedSets).toBe(1);
    expect(summary.hardSets).toBe(1);
    expect(summary.prCount).toBe(1);
    expect(summary.cardioCount).toBe(1);
    expect(summary.metrics.map((metric) => metric.label)).toEqual(['Exercises', 'Sets', 'Hard', 'PR', 'Cardio']);
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

describe('next set focus target', () => {
  it('selects the next incomplete set across exercise cards', () => {
    expect(getNextIncompleteSetTarget([
      {
        workoutExercise: { id: 'leg_press' },
        sets: [
          { id: 'leg_press_1', isCompleted: true },
          { id: 'leg_press_2', isCompleted: true },
        ],
      },
      {
        workoutExercise: { id: 'rdl' },
        sets: [
          { id: 'rdl_1', isCompleted: false },
          { id: 'rdl_2', isCompleted: false },
        ],
      },
    ], 'leg_press_2')).toEqual({
      workoutExerciseId: 'rdl',
      inputId: 'weight_input_rdl_1',
    });
  });

  it('skips completed sets when choosing the next input', () => {
    expect(getNextIncompleteSetTarget([
      {
        workoutExercise: { id: 'press' },
        sets: [
          { id: 'press_1', isCompleted: true },
          { id: 'press_2', isCompleted: true },
          { id: 'press_3', isCompleted: false },
        ],
      },
    ], 'press_1')).toEqual({
      workoutExerciseId: 'press',
      inputId: 'weight_input_press_3',
    });
  });
});

describe('workout set progress badges', () => {
  it('marks completed sets that match or beat past bests', () => {
    expect(getWorkoutSetProgressBadges({
      isCompleted: true,
      weightKg: 100,
      reps: 5,
    }, 100, 480)).toEqual(['weight-pr', 'volume-pr']);
  });

  it('does not mark incomplete sets or empty past bests', () => {
    expect(getWorkoutSetProgressBadges({
      isCompleted: false,
      weightKg: 120,
      reps: 5,
    }, 100, 500)).toEqual([]);
    expect(getWorkoutSetProgressBadges({
      isCompleted: true,
      weightKg: 120,
      reps: 5,
    })).toEqual([]);
  });
});

describe('workout exercise expansion', () => {
  it('keeps current cards open while revealing the added exercise', () => {
    expect(expandWorkoutExercise({ existing: true }, 'added')).toEqual({
      existing: true,
      added: true,
    });
  });
});

describe('workout exercise deletion safety', () => {
  it('asks before deleting an exercise that has logs or notes', () => {
    expect(shouldConfirmWorkoutExerciseDelete({
      workoutExercise: { memo: 'bench setup' },
      sets: [],
    })).toBe(true);
    expect(shouldConfirmWorkoutExerciseDelete({
      workoutExercise: {},
      sets: [{ weightKg: 80, reps: 0, rir: undefined, isCompleted: false }],
    })).toBe(true);
    expect(shouldConfirmWorkoutExerciseDelete({
      workoutExercise: {},
      sets: [{ weightKg: 0, reps: 0, rir: undefined, isCompleted: false }],
    })).toBe(false);
  });
});

describe('workout set deletion safety', () => {
  it('asks before deleting a set that has logged values', () => {
    expect(shouldConfirmWorkoutSetDelete({
      weightKg: 0,
      reps: 0,
      rir: 2,
      isCompleted: false,
    })).toBe(true);
    expect(shouldConfirmWorkoutSetDelete({
      weightKg: 0,
      reps: 0,
      rir: undefined,
      isCompleted: false,
    })).toBe(false);
  });
});

describe('cardio deletion safety', () => {
  it('asks before deleting cardio entries with logged values', () => {
    expect(shouldConfirmCardioDelete({
      distanceKm: 4,
      inclinePercent: undefined,
      location: undefined,
      memo: undefined,
    })).toBe(true);
    expect(shouldConfirmCardioDelete({
      distanceKm: 0,
      inclinePercent: undefined,
      location: '',
      memo: '',
    })).toBe(false);
  });
});

describe('cardio distance input parsing', () => {
  it('keeps decimal kilometer values valid for running logs', () => {
    expect(parseOptionalDecimalInput('2.4')).toBe(2.4);
    expect(parseOptionalDecimalInput('10.25')).toBe(10.25);
    expect(parseOptionalDecimalInput('')).toBeUndefined();
    expect(parseOptionalDecimalInput('bad')).toBeUndefined();
  });
});
