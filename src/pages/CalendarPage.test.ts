import { describe, expect, it } from 'vitest';
import {
  getCalendarExistingWorkoutStartArgs,
  getCalendarNewWorkoutStartArgs,
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
});
