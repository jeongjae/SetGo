import { describe, expect, it } from 'vitest';
import { getOverloadTarget } from './overloadCalc';
import type { WorkoutSet } from '../types';

describe('overload calculation', () => {
  it('returns zero values if no previous sets exist', () => {
    const target = getOverloadTarget(0, {
      exercise: { category: 'chest', id: 'bench_press' },
      weightIncrementKg: 2.5,
    });
    expect(target.weight).toBe(0);
    expect(target.reps).toBe(0);
  });

  it('proposes weight increase for completed weighted exercises', () => {
    const prevSet: WorkoutSet = {
      id: 's1',
      workoutExerciseId: 'we1',
      setNo: 1,
      weightKg: 60,
      reps: 10,
      rir: 2,
      isCompleted: true,
    };
    
    const target = getOverloadTarget(0, {
      exercise: { category: 'chest', id: 'bench_press' },
      previousSets: [prevSet],
      weightIncrementKg: 2.5,
    });
    
    expect(target.weight).toBe(62.5); // 60 + 2.5
    expect(target.reps).toBe(10);
    expect(target.rir).toBe(2);
  });

  it('proposes rep increase for bodyweight exercises', () => {
    const prevSet: WorkoutSet = {
      id: 's1',
      workoutExerciseId: 'we1',
      setNo: 1,
      weightKg: 0,
      reps: 8,
      rir: 1,
      isCompleted: true,
    };
    
    const target = getOverloadTarget(0, {
      exercise: { category: 'bodyweight', id: 'pull_up' },
      previousSets: [prevSet],
      weightIncrementKg: 1.25,
    });
    
    expect(target.weight).toBe(0);
    expect(target.reps).toBe(9); // 8 + 1
    expect(target.rir).toBe(1);
  });

  it('copies exact previous values if the set was not completed', () => {
    const prevSet: WorkoutSet = {
      id: 's1',
      workoutExerciseId: 'we1',
      setNo: 1,
      weightKg: 50,
      reps: 8,
      rir: 3,
      isCompleted: false,
    };
    
    const target = getOverloadTarget(0, {
      exercise: { category: 'chest', id: 'bench_press' },
      previousSets: [prevSet],
      weightIncrementKg: 2.5,
    });
    
    expect(target.weight).toBe(50);
    expect(target.reps).toBe(8);
  });
});
