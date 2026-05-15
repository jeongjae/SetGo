import { describe, expect, it } from 'vitest';
import {
  calculateAverageSpeedKmh,
  calculateExerciseVolumeKg,
  calculateSessionStrengthVolumeKg,
  calculateSetVolumeKg,
} from './volume';

describe('volume calculation', () => {
  it('calculates set volume', () => {
    expect(calculateSetVolumeKg(60, 10)).toBe(600);
  });

  it('returns 0 for invalid set values', () => {
    expect(calculateSetVolumeKg(0, 10)).toBe(0);
    expect(calculateSetVolumeKg(60, 0)).toBe(0);
  });

  it('calculates completed exercise volume only', () => {
    expect(
      calculateExerciseVolumeKg([
        { weightKg: 60, reps: 10, isCompleted: true },
        { weightKg: 60, reps: 8, isCompleted: true },
        { weightKg: 60, reps: 10, isCompleted: false },
      ]),
    ).toBe(1080);
  });

  it('calculates session strength volume', () => {
    expect(calculateSessionStrengthVolumeKg([1080, 2400, 900])).toBe(4380);
  });

  it('calculates average speed', () => {
    expect(calculateAverageSpeedKmh('5' as unknown as number, '2026-05-14T09:00:00', '2026-05-14T09:30:00')).toBeUndefined();
    expect(calculateAverageSpeedKmh(5, '2026-05-14T09:00:00', '2026-05-14T09:30:00')).toBe(10);
  });
});
