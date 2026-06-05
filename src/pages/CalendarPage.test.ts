import { describe, expect, it } from 'vitest';
import {
  canEditCalendarPlan,
  shouldShowCalendarPlanIndicator,
  shouldUseActualsInPlanCalendar,
} from './CalendarPage';

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

describe('plan calendar past dates', () => {
  it('uses actual records before today and plans from today forward', () => {
    expect(shouldUseActualsInPlanCalendar('2026-06-01', '2026-06-02')).toBe(true);
    expect(shouldUseActualsInPlanCalendar('2026-06-02', '2026-06-02')).toBe(false);
    expect(shouldUseActualsInPlanCalendar('2026-06-03', '2026-06-02')).toBe(false);
  });

  it('disables plan editing before today', () => {
    expect(canEditCalendarPlan('2026-06-01', '2026-06-02')).toBe(false);
    expect(canEditCalendarPlan('2026-06-02', '2026-06-02')).toBe(true);
    expect(canEditCalendarPlan('2026-06-03', '2026-06-02')).toBe(true);
  });
});
