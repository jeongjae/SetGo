import { describe, expect, it } from 'vitest';
import { actualsDayCellLabel, actualsStatusLabel, buildActualsCalendarDays } from './ActualsPage';
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
    expect(actualsStatusLabel('ko', 'in_progress', '2026-06-02', '2026-06-04')).toBe('작성 중');
    expect(actualsStatusLabel('en', 'in_progress', '2026-06-02', '2026-06-04')).toBe('Draft');
  });

  it('keeps today in-progress records as active progress', () => {
    expect(actualsStatusLabel('ko', 'in_progress', '2026-06-04', '2026-06-04')).toBe('진행 중');
  });
});

describe('actuals day cell label', () => {
  it('does not repeat the date on empty actuals days', () => {
    expect(actualsDayCellLabel([], 0, 0, 'ko')).toBeUndefined();
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
      routineDay: { id: 'day_1', routineId: 'routine_1', code: 'A', name: '상체A', sequence: 1 },
      exerciseCount: 7,
      cardioCount: 0,
    } as WorkoutSummary;

    expect(actualsDayCellLabel([summary], 0, 0, 'ko')).toBe('상체A');
  });
});
