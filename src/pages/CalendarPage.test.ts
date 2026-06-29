import { describe, expect, it } from 'vitest';
import {
  actualSummaryLabel,
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

describe('plan calendar actual labels', () => {
  it('marks companion cardio auto-skipped running records distinctly', () => {
    expect(actualSummaryLabel([{
      session: {
        id: 'auto_skip',
        date: '2026-06-01',
        entryKind: 'running',
        status: 'skipped',
        autoSkipped: true,
        skipReason: 'companion_cardio_completed',
        timeBand: 'afternoon',
        totalStrengthVolumeKg: 0,
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
      exerciseCount: 0,
      cardioCount: 0,
    } as any], 'en')).toBe('Run auto-skipped');
  });

  it('keeps the strength label while noting an auto-skipped companion run', () => {
    expect(actualSummaryLabel([
      {
        session: {
          id: 'upper',
          date: '2026-06-01',
          entryKind: 'planned',
          status: 'completed',
          timeBand: 'afternoon',
          totalStrengthVolumeKg: 1000,
          createdAt: '2026-06-01T09:00:00.000Z',
          updatedAt: '2026-06-01T10:00:00.000Z',
        },
        routineName: 'Upper',
        exerciseCount: 3,
        cardioCount: 1,
      } as any,
      {
        session: {
          id: 'auto_skip',
          date: '2026-06-01',
          entryKind: 'running',
          status: 'skipped',
          autoSkipped: true,
          skipReason: 'companion_cardio_completed',
          timeBand: 'afternoon',
          totalStrengthVolumeKg: 0,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-01T10:00:00.000Z',
        },
        exerciseCount: 0,
        cardioCount: 0,
      } as any,
    ], 'en')).toBe('Upper + Run auto-skipped');
  });
});
