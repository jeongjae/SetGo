import { describe, expect, it } from 'vitest';
import {
  getCalendarExistingWorkoutStartArgs,
  getCalendarNewWorkoutStartArgs,
  shouldShowCalendarPlanIndicator,
} from './CalendarPage';

describe('calendar workout start args', () => {
  it('keeps the selected date when creating a new workout record', () => {
    expect(getCalendarNewWorkoutStartArgs('2026-05-14', 'routine_day_pull')).toEqual([
      'routine_day_pull',
      '2026-05-14',
      undefined,
      true,
    ]);
  });

  it('opens an existing selected-date session for edit instead of creating a replacement', () => {
    expect(getCalendarExistingWorkoutStartArgs('2026-05-14', {
      id: 'workout_2026-05-14',
      routineDayId: 'routine_day_pull',
    })).toEqual([
      'routine_day_pull',
      '2026-05-14',
      'workout_2026-05-14',
    ]);
  });

  it('shows a weekly plan alongside actual records while reviewing the saved schedule', () => {
    expect(shouldShowCalendarPlanIndicator(true, true, true, true)).toBe(true);
    expect(shouldShowCalendarPlanIndicator(true, true, true, false)).toBe(false);
  });

  it('does not show plan indicators outside the visible month or without a plan', () => {
    expect(shouldShowCalendarPlanIndicator(false, true, false, true)).toBe(false);
    expect(shouldShowCalendarPlanIndicator(true, false, false, true)).toBe(false);
  });
});
