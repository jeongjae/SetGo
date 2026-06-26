import { describe, expect, it } from 'vitest';
import { calculateSuggestedVolume, countNormalizedHardSets } from './recommendation';
import type { WorkoutSet } from '../types';

describe('calculateSuggestedVolume', () => {
  const templatePlan = { plannedWeightKg: 50, plannedReps: 10, plannedSets: 3 };

  it('falls back to template values when there is no past history', () => {
    const suggested = calculateSuggestedVolume([], 'hypertrophy', 100, 'hypertrophy', templatePlan);
    expect(suggested.weightKg).toBe(50);
    expect(suggested.reps).toBe(10);
    expect(suggested.sets).toBe(3);
  });

  it('calculates hypertrophy overload based on history', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 80, reps: 10, rir: 2, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 80, reps: 10, rir: 2, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(82.5);
    expect(suggested.sets).toBe(2);
  });

  it('maintains weight on hypertrophy phase if global goal is maintenance', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 80, reps: 8, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 100, 'maintenance');
    expect(suggested.weightKg).toBe(80);
  });

  it('calculates B session weight as 80% of hypertrophy history', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'maintenance', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(80);
    expect(suggested.reps).toBe(12);
  });

  it('applies deload weight and set reduction', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 100, reps: 10, isCompleted: true },
      { id: '3', workoutExerciseId: 'e1', setNo: 3, weightKg: 100, reps: 10, isCompleted: true },
      { id: '4', workoutExerciseId: 'e1', setNo: 4, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'deload', 100, 'hypertrophy');
    expect(suggested.weightKg).toBe(80);
    expect(suggested.sets).toBe(2);
  });

  it('reduces 1 set if muscle recovery is low', () => {
    const history: WorkoutSet[] = [
      { id: '1', workoutExerciseId: 'e1', setNo: 1, weightKg: 100, reps: 10, isCompleted: true },
      { id: '2', workoutExerciseId: 'e1', setNo: 2, weightKg: 100, reps: 10, isCompleted: true },
      { id: '3', workoutExerciseId: 'e1', setNo: 3, weightKg: 100, reps: 10, isCompleted: true },
    ];
    const suggested = calculateSuggestedVolume(history, 'hypertrophy', 40, 'hypertrophy');
    expect(suggested.sets).toBe(2);
    expect(suggested.note).toContain('Recovery is low');
  });
});

describe('countNormalizedHardSets', () => {
  it('counts standard hard sets normally', () => {
    const sets = [
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: true, workoutExerciseId: 'ex1' },
    ];
    expect(countNormalizedHardSets(sets)).toBe(2);
  });

  it('collapses multiple myo-reps sets in the same exercise into 1 hard set count', () => {
    const sets = [
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, intensityTechnique: 'myo_reps', workoutExerciseId: 'ex1' },
      { isCompleted: true, isWarmup: false, workoutExerciseId: 'ex2' },
    ];
    expect(countNormalizedHardSets(sets)).toBe(2);
  });
});
