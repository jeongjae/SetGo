import { describe, expect, it } from 'vitest';
import {
  getNextSetType,
  getProgressLabel,
  getSetKindLabel,
  parseWorkoutSetDecimalInput,
} from './WorkoutSetRowV2';

describe('WorkoutSetRowV2 presentation helpers', () => {
  it('parses non-negative decimal input for workout set fields', () => {
    expect(parseWorkoutSetDecimalInput('62.5')).toBe(62.5);
    expect(parseWorkoutSetDecimalInput(' 10 ')).toBe(10);
    expect(parseWorkoutSetDecimalInput('')).toBeUndefined();
    expect(parseWorkoutSetDecimalInput('-1')).toBeUndefined();
    expect(parseWorkoutSetDecimalInput('bad')).toBeUndefined();
  });

  it('cycles set types in a predictable order', () => {
    expect(getNextSetType(undefined, false)).toBe('warmup');
    expect(getNextSetType('normal', false)).toBe('warmup');
    expect(getNextSetType('warmup', true)).toBe('drop');
    expect(getNextSetType('drop', false)).toBe('failure');
    expect(getNextSetType('failure', false)).toBe('normal');
  });

  it('labels set types for Korean and English workout rows', () => {
    expect(getSetKindLabel('normal', false, 'en')).toBe('Work');
    expect(getSetKindLabel('warmup', true, 'en')).toBe('Warm');
    expect(getSetKindLabel('drop', false, 'en')).toBe('Drop');
    expect(getSetKindLabel('failure', false, 'en')).toBe('Fail');
    expect(getSetKindLabel('normal', false, 'ko')).toBe('일반');
    expect(getSetKindLabel('warmup', true, 'ko')).toBe('준비');
  });

  it('shows progress labels only for completed PR-level sets', () => {
    expect(getProgressLabel({ isCompleted: false, weightKg: 100, reps: 5 }, 100, 480)).toBeUndefined();
    expect(getProgressLabel({ isCompleted: true, weightKg: 100, reps: 5 }, 100, 480)).toBe('PR');
    expect(getProgressLabel({ isCompleted: true, weightKg: 100, reps: 4 }, 100, 500)).toBe('kg PR');
    expect(getProgressLabel({ isCompleted: true, weightKg: 90, reps: 6 }, 100, 500)).toBe('vol PR');
  });
});
