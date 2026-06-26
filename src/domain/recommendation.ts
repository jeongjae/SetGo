import type { RoutineExercisePlan, WorkoutSet } from '../types';
import {
  recommendExerciseTarget,
  type IntensityPhase,
  type TrainingGoal,
} from './recommendations';

export type SuggestedVolume = {
  weightKg: number;
  reps: number;
  sets: number;
  note?: string;
  technique: 'straight' | 'drop_set' | 'myo_reps';
};

export function calculateSuggestedVolume(
  lastHypertrophySets: WorkoutSet[],
  currentPhase: Extract<IntensityPhase, 'hypertrophy' | 'maintenance' | 'deload'>,
  recoveryPercent: number,
  globalGoal: TrainingGoal,
  templatePlan?: Pick<RoutineExercisePlan, 'plannedWeightKg' | 'plannedReps' | 'plannedSets'>,
): SuggestedVolume {
  const completedSets = lastHypertrophySets
    .filter((set) => set.isCompleted)
    .map((set) => ({
      weightKg: set.weightKg,
      reps: set.reps,
      rir: set.rir ?? 2,
      isCompleted: true,
      isWarmup: set.isWarmup,
      type: set.type,
    }));

  const recommendation = recommendExerciseTarget({
    plan: {
      plannedWeightKg: templatePlan?.plannedWeightKg ?? completedSets[0]?.weightKg ?? 20,
      plannedReps: templatePlan?.plannedReps ?? completedSets[0]?.reps ?? 10,
      plannedSets: templatePlan?.plannedSets ?? Math.max(1, completedSets.length || 3),
      plannedRir: 2,
      targetRepMin: 8,
      targetRepMax: 10,
      preferredWeightIncrementKg: 2.5,
    },
    recentSessions: completedSets.length > 0
      ? [{
        date: new Date().toISOString().slice(0, 10),
        family: 'compat',
        intensityPhase: 'hypertrophy',
        sets: completedSets,
      }]
      : [],
    currentFamily: 'compat',
    currentPhase,
    globalGoal,
    recoveryPercent,
  });

  return {
    weightKg: recommendation.weightKg ?? 0,
    reps: recommendation.reps,
    sets: recommendation.sets,
    note: recommendation.reason,
    technique: 'straight',
  };
}

export function countNormalizedHardSets(
  sets: Array<{ isCompleted: boolean; isWarmup?: boolean; intensityTechnique?: string; workoutExerciseId: string }>,
): number {
  let count = 0;
  const myoRepsWorkoutExercises = new Set<string>();

  for (const set of sets) {
    if (!set.isCompleted || set.isWarmup) continue;
    if (set.intensityTechnique === 'myo_reps') {
      if (myoRepsWorkoutExercises.has(set.workoutExerciseId)) continue;
      myoRepsWorkoutExercises.add(set.workoutExerciseId);
    }
    count += 1;
  }

  return count;
}
