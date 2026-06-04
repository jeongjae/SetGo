import { describe, expect, it } from 'vitest';
import { shouldShowCalendarPlanIndicator } from './CalendarPage';

describe('plan calendar indicators', () => {
  it('shows a weekly plan alongside actual records while reviewing the saved schedule', () => {
    expect(shouldShowCalendarPlanIndicator(true, true, true, true)).toBe(true);
    expect(shouldShowCalendarPlanIndicator(true, true, true, false)).toBe(false);
  });

  it('does not show plan indicators outside the visible month or without a plan', () => {
    expect(shouldShowCalendarPlanIndicator(false, true, false, true)).toBe(false);
    expect(shouldShowCalendarPlanIndicator(true, false, false, true)).toBe(false);
  });
});
