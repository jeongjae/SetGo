import { describe, it, expect } from 'vitest';
import { calculateSuggestedVolume, countNormalizedHardSets } from './recommendation';
import type { WorkoutSet } from '../types';

describe('calculateSuggestedVolume', () => {
  const templatePlan = { plannedWeightKg: 50, plannedReps: 10, plannedSets: 3 };

  it('falls back to template values when there is no past history', () => {
    const suggested = calculateSuggestedVolume([], 'hypertrophy', 100, 'hypertrophy', templatePlan);
    expect(suggested.weightKg).toBe(52.5); // 50 + 2.5 hypertrophy overload
    expect(suggested.reps).toBe(10);
    expect(suggested.sets).toBe(3);
  });

  it('calculates hypertrophy overload based on history', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 80, reps: 8, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 80, reps: 8, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(82.5); // 80 + 2.5
    expect(suggested.sets).toBe(2); // Matches history completed sets count
  });

  it('maintains weight on hypertrophy phase if global goal is maintenance', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 80, reps: 8, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 100, 'maintenance');
    expect(suggested.weightKg).toBe(80); // Maintains same weight
  });

  it('calculates B/Maintenance session weight as 80% of hypertrophy history', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'maintenance', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(80); // 100 * 0.8
    expect(suggested.reps).toBe(12); // High reps (12) for maintenance/light day
  });

  it('applies deload weight and set reduction', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 100, reps: 10, isCompleted: true },
      { id: '3', workoutExerciseId: 'e1', setNo: 3, weightKg: 100, reps: 10, isCompleted: true },
      { id: '4', workoutExerciseId: 'e1', setNo: 4, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'deload', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(80); // 100 * 0.8
    expect(suggested.sets).toBe(2); // 4 sets * 50% = 2 sets
  });

  it('reduces 1 set if muscle recovery is low (< 50%)', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 100, reps: 10, isCompleted: true },
      { id: '3', workoutExerciseId: 'e1', setNo: 3, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 40, 'hypertrophy');
    expect(suggested.sets).toBe(2); // 3 sets - 1 = 2 sets
    expect(suggested.note).toContain('회복 주의');
  });
});

describe('countNormalizedHardSets', () => {
  it('counts standard hard sets normally', () => {
    const sets = [
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: true, workoutExerciseId: 'ex1' }, // Warmup set
    ];
    expect(countNormalizedHardSets(sets)).toBe(2);
  });

  it('collapses multiple myo_reps sets in the same exercise into 1 hard set count', () => {
    const sets = [
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex2' }, // Another standard exercise
    ];
    expect(countNormalizedHardSets(sets)).toBe(2); // 1 (myo_reps collapsed) + 1 (standard) = 2
  });
});
