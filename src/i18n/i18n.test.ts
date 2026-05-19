import { describe, expect, it } from 'vitest';
import { exerciseCountLabel, routineNameLabel, timeBandLabel, workoutStatusLabel } from './i18n';

describe('i18n display helpers', () => {
  it('localizes workout statuses and time bands', () => {
    expect(workoutStatusLabel('ko', 'in_progress')).toBe('진행 중');
    expect(workoutStatusLabel('ko', 'skipped')).toBe('건너뜀');
    expect(workoutStatusLabel('en', 'completed')).toBe('Completed');
    expect(timeBandLabel('ko', 'morning')).toBe('오전');
    expect(timeBandLabel('en', 'evening')).toBe('Evening');
  });

  it('formats exercise counts and routine names for Korean screens', () => {
    expect(exerciseCountLabel('ko', 4)).toBe('4개 운동');
    expect(exerciseCountLabel('en', 4)).toBe('4 exercises');
    expect(routineNameLabel('ko', '4-Day Upper / Lower')).toBe('4분할 상체/하체 (강약)');
  });
});
