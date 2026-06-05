import { describe, expect, it } from 'vitest';
import {
  actualsDayCellClass,
  actualsDayCellLabel,
  actualsDayCellTextClass,
  actualsSelectedWeekIndexForDate,
  actualsSessionDetailLabel,
  actualsStatusLabel,
  buildActualsCalendarDays,
  countActualLoggedExercisesForSession,
} from './ActualsPage';
import type { WorkoutSummary } from '../db/workouts';

describe('actuals calendar range', () => {
  it('builds the current Sunday-start week plus the previous four weeks', () => {
    const days = buildActualsCalendarDays(new Date('2026-06-04T12:00:00'));

    expect(days).toHaveLength(35);
    expect(days[0].key).toBe('2026-05-03');
    expect(days[34].key).toBe('2026-06-06');
    expect(days[0].weekIndex).toBe(0);
    expect(days[34].weekIndex).toBe(4);
  });
});

describe('actuals status label', () => {
  it('labels past in-progress records as drafts instead of active workouts', () => {
    expect(actualsStatusLabel('en', 'in_progress', '2026-06-02', '2026-06-04')).toBe('Draft');
  });

  it('keeps today in-progress records as active progress', () => {
    expect(actualsStatusLabel('en', 'in_progress', '2026-06-04', '2026-06-04')).toBe('In progress');
  });
});

describe('actuals day cell label', () => {
  it('does not repeat the date on empty actuals days', () => {
    expect(actualsDayCellLabel([], 'en')).toBeUndefined();
  });

  it('shows a workout label when a completed record has no volume yet', () => {
    const summary = {
      session: {
        id: 'session_1',
        date: '2026-05-16',
        status: 'completed',
        totalStrengthVolumeKg: 0,
        timeBand: 'afternoon',
        createdAt: '2026-05-16T12:00:00.000',
        updatedAt: '2026-05-16T12:00:00.000',
      },
      routineDay: { id: 'day_1', routineId: 'routine_1', code: 'A', name: 'Upper A', sequence: 1 },
      exerciseCount: 7,
      cardioCount: 0,
    } as WorkoutSummary;

    expect(actualsDayCellLabel([summary], 'en')).toBe('Upper A');
  });

  it('does not use the routine name as the calendar cell label', () => {
    const summary = {
      session: {
        id: 'session_1',
        date: '2026-05-16',
        status: 'completed',
        totalStrengthVolumeKg: 1000,
        timeBand: 'afternoon',
        createdAt: '2026-05-16T12:00:00.000',
        updatedAt: '2026-05-16T12:00:00.000',
      },
      routineName: '4-Day Routine',
      exerciseCount: 7,
      cardioCount: 0,
    } as WorkoutSummary;

    expect(actualsDayCellLabel([summary], 'en')).toBe('Workout');
  });
});

describe('actuals logged exercise count', () => {
  it('counts only exercises with completed sets, not every seeded routine exercise', () => {
    const workoutExercises = Array.from({ length: 6 }, (_, index) => ({
      id: `workout_exercise_${index + 1}`,
      sessionId: 'session_1',
    }));
    const workoutSets = [
      { workoutExerciseId: 'workout_exercise_1', isCompleted: true },
      { workoutExerciseId: 'workout_exercise_2', isCompleted: false },
      { workoutExerciseId: 'workout_exercise_3', isCompleted: false },
      { workoutExerciseId: 'workout_exercise_4', isCompleted: false },
      { workoutExerciseId: 'workout_exercise_5', isCompleted: false },
      { workoutExerciseId: 'workout_exercise_6', isCompleted: false },
    ];

    expect(countActualLoggedExercisesForSession('session_1', workoutExercises, workoutSets)).toBe(1);
  });
});

describe('actuals session detail label', () => {
  it('combines completed strength work and running detail', () => {
    expect(actualsSessionDetailLabel({
      actualExerciseCount: 3,
      totalStrengthVolumeKg: 5000,
      cardioDistanceKm: 3,
      cardioMinutes: 20,
      locale: 'ko',
    })).toBe('3개 운동 / 5,000kg, 러닝 / 20분, 3.00km');
  });

  it('keeps running-only records visible without hiding strength logic', () => {
    expect(actualsSessionDetailLabel({
      actualExerciseCount: 0,
      totalStrengthVolumeKg: 0,
      cardioDistanceKm: 3,
      cardioMinutes: 20,
      locale: 'ko',
    })).toBe('러닝 / 20분, 3.00km');
  });
});

describe('actuals day cell style', () => {
  it('uses the plan calendar selected styling when selected', () => {
    const className = actualsDayCellClass({
      hasCompleted: true,
      hasInProgress: false,
      hasSkipped: false,
      isFuture: false,
      isSelected: true,
      isToday: false,
    });

    expect(className).toContain('bg-emerald-600/90');
    expect(className).toContain('border-emerald-300');
    expect(className).toContain('ring-emerald-300/70');
    expect(className).not.toContain('bg-amber-300');
  });

  it('uses dark text for days with workout records', () => {
    expect(actualsDayCellTextClass(true)).toBe('text-black');
    expect(actualsDayCellTextClass(false)).toBe('text-current');
  });

  it('keeps in-progress days from looking selected', () => {
    const className = actualsDayCellClass({
      hasCompleted: false,
      hasInProgress: true,
      hasSkipped: false,
      isFuture: false,
      isSelected: false,
      isToday: false,
    });

    expect(className).toContain('bg-blue-100');
    expect(className).not.toContain('bg-cyan-200');
    expect(className).not.toContain('bg-emerald-600/90');
  });

  it('marks today like the plan calendar', () => {
    const className = actualsDayCellClass({
      hasCompleted: false,
      hasInProgress: false,
      hasSkipped: false,
      isFuture: false,
      isSelected: false,
      isToday: true,
    });

    expect(className).toContain('bg-rose-100/90');
    expect(className).toContain('border-rose-400');
    expect(className).toContain('ring-rose-300');
    expect(className).toContain('text-black');
  });
});

describe('actuals selected week index', () => {
  it('moves the selected week when another calendar day is selected', () => {
    const days = buildActualsCalendarDays(new Date('2026-06-04T12:00:00'));

    expect(actualsSelectedWeekIndexForDate(days, '2026-05-11', 4)).toBe(1);
    expect(actualsSelectedWeekIndexForDate(days, '2026-06-02', 4)).toBe(4);
  });
});
