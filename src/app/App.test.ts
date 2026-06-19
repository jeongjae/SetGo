import { describe, expect, it } from 'vitest';
import {
  shouldResetCalendarContextOnNavigate,
  workoutModeForHistoricalAdd,
  workoutReturnViewForStart,
  type AppView,
} from './App';

describe('app navigation state rules', () => {
  it('resets calendar context only for primary planning and records tabs', () => {
    const resetViews: AppView[] = ['calendar', 'records'];
    const preservedViews: AppView[] = ['today', 'more', 'routines', 'exercises', 'weeklyPlan', 'export', 'workout'];

    expect(resetViews.map(shouldResetCalendarContextOnNavigate)).toEqual([true, true]);
    expect(preservedViews.map(shouldResetCalendarContextOnNavigate)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('returns calendar-started workouts to the plan tab and today-started workouts to Today', () => {
    expect(workoutReturnViewForStart('2026-06-19')).toBe('calendar');
    expect(workoutReturnViewForStart()).toBe('today');
  });

  it('keeps same-day records active but opens past records in history edit mode', () => {
    expect(workoutModeForHistoricalAdd('2026-06-19', '2026-06-19')).toBe('active');
    expect(workoutModeForHistoricalAdd('2026-06-18', '2026-06-19')).toBe('history-edit');
  });
});
