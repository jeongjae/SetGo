import { describe, expect, it } from 'vitest';
import { isWarmupOnlyExercise } from './exercises';

describe('exercise stage helpers', () => {
  it('treats warmup exercises without a main tag as warmup-only', () => {
    expect(isWarmupOnlyExercise({ stage: 'warmup', stageTags: ['warmup'] })).toBe(true);
    expect(isWarmupOnlyExercise({ stage: 'warmup', stageTags: ['warmup', 'cooldown'] })).toBe(true);
  });

  it('keeps exercises with main work available as training sets', () => {
    expect(isWarmupOnlyExercise({ stage: 'main', stageTags: ['main'] })).toBe(false);
    expect(isWarmupOnlyExercise({ stage: 'warmup', stageTags: ['warmup', 'main'] })).toBe(false);
    expect(isWarmupOnlyExercise(undefined)).toBe(false);
  });
});
