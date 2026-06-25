import type { WorkoutSet } from '../types';

export type OverloadTarget = {
  weight: number;
  reps: number;
  rir?: number;
};

/**
 * Calculates progressive overload targets based on the previous session's performance.
 * For bodyweight exercises or when previous weight was 0, it suggests reps +1.
 * For weighted exercises, it suggests weight + weightIncrement.
 */
export function getOverloadTarget(
  setIndex: number,
  log: {
    exercise: { category: string; id: string };
    previousSets?: WorkoutSet[];
    weightIncrementKg: number;
  }
): OverloadTarget {
  const previousSets = log.previousSets || [];
  
  // Find previous set at same index, fallback to the last completed set in history
  const prev = previousSets[setIndex] || previousSets[previousSets.length - 1];

  if (!prev) {
    return { weight: 0, reps: 0 };
  }

  if (prev.isCompleted) {
    const isBodyweight = log.exercise.category === 'bodyweight' || prev.weightKg === 0;
    if (isBodyweight) {
      return {
        weight: prev.weightKg,
        reps: prev.reps + 1,
        rir: prev.rir,
      };
    } else {
      return {
        weight: prev.weightKg + log.weightIncrementKg,
        reps: prev.reps,
        rir: prev.rir,
      };
    }
  }

  // Fallback to previous set's exact values if not completed
  return {
    weight: prev.weightKg,
    reps: prev.reps,
    rir: prev.rir,
  };
}
