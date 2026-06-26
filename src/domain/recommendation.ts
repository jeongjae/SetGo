import type { WorkoutSet } from '../types';

export type SuggestedVolume = {
  weightKg: number;
  reps: number;
  sets: number;
  note?: string;
  technique: 'straight' | 'drop_set' | 'myo_reps';
};

/**
 * Calculates the suggested weight, reps, and sets for an exercise based on:
 * 1. History of the corresponding Hypertrophy (A) session.
 * 2. The current session's intensity phase (Hypertrophy, Maintenance, or Deload).
 * 3. The current muscle recovery percentage (fatigue level).
 * 4. The global goal (Hypertrophy vs Maintenance).
 * 5. Fallback template default plan values.
 */
export function calculateSuggestedVolume(
  lastHypertrophySets: WorkoutSet[],
  currentPhase: 'hypertrophy' | 'maintenance' | 'deload',
  recoveryPercent: number,
  globalGoal: 'hypertrophy' | 'maintenance',
  templatePlan?: { plannedWeightKg?: number; plannedReps?: number; plannedSets?: number },
  locale: 'ko' | 'en' = 'ko'
): SuggestedVolume {
  const completedSets = lastHypertrophySets.filter((s) => s.isCompleted);

  // Fallback chain for base values
  let baseWeight = 20;
  let baseReps = 10;
  let baseSets = 3;

  if (completedSets.length > 0) {
    // Sort sets to find the best performing set (by volume = weight * reps)
    const bestSet = [...completedSets].sort((a, b) => (b.weightKg * b.reps) - (a.weightKg * a.reps))[0];
    baseWeight = bestSet.weightKg;
    baseReps = bestSet.reps;
    baseSets = completedSets.length;
  } else if (templatePlan) {
    baseWeight = templatePlan.plannedWeightKg ?? baseWeight;
    baseReps = templatePlan.plannedReps ?? baseReps;
    baseSets = templatePlan.plannedSets ?? baseSets;
  }

  let note = '';

  // 1. Apply Intensity Phase Rules
  if (currentPhase === 'maintenance') {
    // B/Maintenance phase: 80% weight of A (hypertrophy) session, high reps (e.g. 12 reps)
    baseWeight = Math.round((baseWeight * 0.8) * 2) / 2; // Round to nearest 0.5kg
    baseReps = 12;
    note = locale === 'ko' 
      ? '약(B) 세션: 피로 회복을 위해 강(A) 대비 80% 강도로 설정되었습니다.' 
      : 'Light (B) session: Set to 80% weight of Heavy (A) session for active recovery.';
  } else if (currentPhase === 'hypertrophy') {
    // A/Hypertrophy phase: Progressive Overload
    if (globalGoal === 'hypertrophy') {
      baseWeight += 2.5; // Suggest 2.5kg increase
      note = locale === 'ko'
        ? '강(A) 세션: 점진적 과부하를 위해 2.5kg 증량이 제안되었습니다.'
        : 'Heavy (A) session: 2.5kg increase suggested for progressive overload.';
    } else {
      note = locale === 'ko'
        ? '강(A) 세션: 현재 근육 유지를 목적으로 동결 중량으로 진행합니다.'
        : 'Heavy (A) session: Weight maintained to preserve current muscle gains.';
    }
  }

  // 2. Apply Deload Rules
  if (currentPhase === 'deload') {
    baseWeight = Math.round((baseWeight * 0.8) * 2) / 2; // -20% weight
    baseSets = Math.max(1, Math.round(baseSets * 0.5)); // -50% sets
    baseReps = 10;
    note = locale === 'ko'
      ? '디로드 주간: 부하 해소를 위해 중량 -20%, 세트 수 -50% 처방되었습니다.'
      : 'Deload week: -20% weight and -50% sets prescribed to release fatigue.';
  }

  // 3. Adjust sets based on muscle recovery status (Fitbod style fatigue adjustments)
  if (recoveryPercent < 50 && currentPhase !== 'deload') {
    baseSets = Math.max(2, baseSets - 1); // Decrease by 1 set, min 2 sets
    note += locale === 'ko'
      ? ` [회복 주의: 근육 회복도 ${recoveryPercent}%로 낮음. 안전을 위해 1세트 감축]`
      : ` [Fatigue Warning: Muscle recovery is low (${recoveryPercent}%). 1 set reduced for safety]`;
  }

  return {
    weightKg: baseWeight,
    reps: baseReps,
    sets: baseSets,
    note: note.trim(),
    technique: 'straight',
  };
}

/**
 * Normalizes completed sets count for stats calculation by collapsing Myo-reps mini-sets.
 * All myo_reps sets in the same exercise session are counted as 1 hard set.
 */
export function countNormalizedHardSets(sets: Array<{ isCompleted: boolean; isWarmup?: boolean; intensityTechnique?: string; workoutExerciseId: string }>): number {
  let count = 0;
  const myoRepsWorkoutExercises = new Set<string>();

  for (const set of sets) {
    if (set.isCompleted && !set.isWarmup) {
      if (set.intensityTechnique === 'myo_reps') {
        if (!myoRepsWorkoutExercises.has(set.workoutExerciseId)) {
          myoRepsWorkoutExercises.add(set.workoutExerciseId);
          count += 1; // Count first myo-reps set as 1 hard set
        }
      } else {
        count += 1; // Count standard and drop sets normally
      }
    }
  }

  return count;
}
