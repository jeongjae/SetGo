import { describe, expect, it } from 'vitest';
import {
  actualsDayCellClass,
  actualsDayCellLabel,
  actualsDayCellMetric,
  actualsStatusLabel,
  buildActualsCalendarDays,
} from './ActualsPage';
import type { WorkoutSummary } from '../db/workouts';

describe('actuals calendar range', () => {
  it('builds the current week plus the previous four weeks without cutting by month', () => {
    const days = buildActualsCalendarDays(new Date('2026-06-04T12:00:00'));

    expect(days).toHaveLength(35);
    expect(days[0].key).toBe('2026-05-04');
    expect(days[34].key).toBe('2026-06-07');
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
});

describe('actuals day cell metric', () => {
  it('formats volume and distance separately from the workout label', () => {
    expect(actualsDayCellMetric(2400, 0)).toBe('2,400kg');
    expect(actualsDayCellMetric(0, 2.4)).toBe('2.4km');
    expect(actualsDayCellMetric(0, 0)).toBeUndefined();
  });
});

describe('actuals day cell style', () => {
  it('keeps completed styling when the day is selected', () => {
    const className = actualsDayCellClass({
      hasCompleted: true,
      hasInProgress: false,
      hasSkipped: false,
      isFuture: false,
      isSelected: true,
    });

    expect(className).toContain('bg-amber-300');
    expect(className).toContain('text-slate-950');
    expect(className).toContain('ring-cyan-400');
    expect(className).not.toContain('bg-emerald');
  });
});
