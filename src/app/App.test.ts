import { describe, expect, it } from 'vitest';
import {
  shouldResetCalendarContextOnNavigate,
  workoutModeForHistoricalAdd,
  workoutReturnViewForStart,
  type AppView,
} from './App';

describe('app navigation state rules', () => {
  it('resets calendar context only for history and temporary planning calendar tabs', () => {
    const resetViews: AppView[] = ['calendar', 'history'];
    const preservedViews: AppView[] = ['today', 'more', 'routines', 'insights', 'exercises', 'weeklyPlan', 'export', 'workout'];

    expect(resetViews.map(shouldResetCalendarContextOnNavigate)).toEqual([true, true]);
    expect(preservedViews.map(shouldResetCalendarContextOnNavigate)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('returns dated workouts to History and today-started workouts to Today', () => {
    expect(workoutReturnViewForStart('2026-06-19')).toBe('history');
    expect(workoutReturnViewForStart()).toBe('today');
  });

  it('keeps same-day records active but opens past records in history edit mode', () => {
    expect(workoutModeForHistoricalAdd('2026-06-19', '2026-06-19')).toBe('active');
    expect(workoutModeForHistoricalAdd('2026-06-18', '2026-06-19')).toBe('history-edit');
  });
});
