import type { ExerciseMaster, RoutineDay, RoutineExercisePlan, WorkoutSet } from '../types';

export type ExerciseProgressionStyle = NonNullable<RoutineExercisePlan['progressionStyle']>;
export type TrainingGoal = 'hypertrophy' | 'maintenance';
export type IntensityPhase = NonNullable<RoutineDay['intensityPhase']>;

export type RecentExerciseSession = {
  date: string;
  family?: string;
  intensityPhase?: IntensityPhase;
  sets: Array<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'type'>>;
};

export type ExerciseTargetRecommendation = {
  weightKg?: number;
  reps: number;
  sets: number;
  rir?: number;
  targetRepMin: number;
  targetRepMax: number;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Number((Math.round(value / increment) * increment).toFixed(2));
}

function workingSets(session: RecentExerciseSession) {
  return session.sets.filter((set) => (
    set.isCompleted
    && !set.isWarmup
    && set.type !== 'warmup'
    && set.type !== 'drop'
  ));
}

function bestSet(sets: RecentExerciseSession['sets']) {
  return sets
    .slice()
    .sort((a, b) => (b.weightKg * b.reps) - (a.weightKg * a.reps))[0];
}

function roundToHalfKg(value: number): number {
  return Number((Math.round(value * 2) / 2).toFixed(1));
}

function withLowRecoveryAdjustment(
  recommendation: ExerciseTargetRecommendation,
  recoveryPercent?: number,
): ExerciseTargetRecommendation {
  if (recoveryPercent === undefined || recoveryPercent >= 50) return recommendation;

  return {
    ...recommendation,
    sets: Math.max(2, recommendation.sets - 1),
    confidence: recommendation.confidence === 'high' ? 'medium' : recommendation.confidence,
    reason: `${recommendation.reason} Recovery is low (${recoveryPercent}%), so SetGo removes one working set.`,
  };
}

function inferProgressionStyle(
  exercise?: Pick<ExerciseMaster, 'category' | 'categoryTags'>,
): ExerciseProgressionStyle {
  const categories = exercise?.categoryTags?.length ? exercise.categoryTags : exercise ? [exercise.category] : [];
  if (categories.includes('bodyweight') || categories.includes('mobility') || categories.includes('cardio')) return 'bodyweight';
  if (categories.includes('biceps') || categories.includes('triceps') || categories.includes('shoulder')) return 'isolation';
  return 'compound';
}

function defaultIncrement(style: ExerciseProgressionStyle): number {
  if (style === 'compound') return 2.5;
  if (style === 'isolation') return 1;
  return 0;
}

export function resolveTargetRepRange(plan: Pick<RoutineExercisePlan, 'plannedReps' | 'targetRepMin' | 'targetRepMax'>): {
  min: number;
  max: number;
} {
  const plannedReps = Math.max(1, Math.round(plan.plannedReps ?? 10));
  const min = Math.max(1, Math.round(plan.targetRepMin ?? Math.max(1, plannedReps - 2)));
  const max = Math.max(min, Math.round(plan.targetRepMax ?? plannedReps));

  return { min, max };
}

export function recommendExerciseTarget({
  plan,
  recentSessions,
  exercise,
  currentFamily,
  currentPhase = 'hypertrophy',
  globalGoal = 'hypertrophy',
  recoveryPercent,
}: {
  plan: Pick<
    RoutineExercisePlan,
    'plannedWeightKg' | 'plannedReps' | 'plannedSets' | 'plannedRir' | 'targetRepMin' | 'targetRepMax' | 'progressionStyle' | 'preferredWeightIncrementKg'
  >;
  recentSessions: RecentExerciseSession[];
  exercise?: Pick<ExerciseMaster, 'category' | 'categoryTags'>;
  currentFamily?: string;
  currentPhase?: IntensityPhase;
  globalGoal?: TrainingGoal;
  recoveryPercent?: number;
}): ExerciseTargetRecommendation {
  const targetRange = resolveTargetRepRange(plan);
  const plannedSets = Math.max(1, Math.round(plan.plannedSets ?? 3));
  const plannedReps = clamp(Math.round(plan.plannedReps ?? targetRange.max), targetRange.min, targetRange.max);
  const plannedRir = plan.plannedRir;
  const style = plan.progressionStyle ?? inferProgressionStyle(exercise);
  const increment = plan.preferredWeightIncrementKg ?? defaultIncrement(style);
  const completedSessions = recentSessions
    .map((session) => ({ session, sets: workingSets(session) }))
    .filter((item) => item.sets.length > 0);
  const last = completedSessions[0];

  if (currentPhase === 'maintenance') {
    const matchedHypertrophy = completedSessions.find((item) => (
      item.session.intensityPhase === 'hypertrophy'
      && (!currentFamily || !item.session.family || item.session.family === currentFamily)
    ));
    const source = matchedHypertrophy ?? last;
    const sourceBest = source ? bestSet(source.sets) : undefined;
    const sourceWeight = sourceBest?.weightKg ?? plan.plannedWeightKg;

    return withLowRecoveryAdjustment({
      weightKg: sourceWeight === undefined ? undefined : roundToHalfKg(sourceWeight * 0.8),
      reps: 12,
      sets: source ? Math.max(plannedSets, source.sets.length) : plannedSets,
      rir: plannedRir ?? 3,
      targetRepMin: Math.min(targetRange.min, 10),
      targetRepMax: Math.max(targetRange.max, 12),
      reason: source
        ? 'Light session: SetGo uses 80% of the latest matching heavy-session weight for active recovery.'
        : 'Light session: no heavy-session history yet, so SetGo starts from the routine target.',
      confidence: matchedHypertrophy ? 'high' : source ? 'medium' : 'low',
    }, recoveryPercent);
  }

  if (!last) {
    return withLowRecoveryAdjustment({
      weightKg: plan.plannedWeightKg,
      reps: plannedReps,
      sets: plannedSets,
      rir: plannedRir,
      targetRepMin: targetRange.min,
      targetRepMax: targetRange.max,
      reason: 'No completed history yet, so SetGo uses the routine target.',
      confidence: 'low',
    }, currentPhase === 'deload' ? undefined : recoveryPercent);
  }

  const lastSets = last.sets;
  const lastBest = bestSet(lastSets);
  const finalSet = lastSets[lastSets.length - 1];
  const baseWeight = lastBest?.weightKg ?? plan.plannedWeightKg ?? 0;
  const baseRir = finalSet?.rir ?? plannedRir;
  const allReachedTop = lastSets.every((set) => set.reps >= targetRange.max);
  const anyBelowMin = lastSets.some((set) => set.reps < targetRange.min);
  const finalWasMaxEffort = finalSet?.rir !== undefined && finalSet.rir <= 0;
  const repeatedMaxEffort = completedSessions.length >= 2 && completedSessions.slice(0, 2).every((item) => {
    const lastCompletedSet = item.sets[item.sets.length - 1];
    return lastCompletedSet?.rir !== undefined && lastCompletedSet.rir <= 0;
  });
  const recentSetCount = Math.max(plannedSets, Math.round(lastSets.length || plannedSets));

  if (currentPhase === 'deload') {
    return {
      weightKg: roundToHalfKg(baseWeight * 0.8),
      reps: Math.min(10, Math.max(1, plannedReps)),
      sets: Math.max(1, Math.round(recentSetCount * 0.5)),
      rir: plannedRir ?? 4,
      targetRepMin: targetRange.min,
      targetRepMax: targetRange.max,
      reason: 'Deload session: SetGo reduces recent working weight by 20% and cuts set count by about half.',
      confidence: 'high',
    };
  }

  if (allReachedTop && baseRir !== undefined && baseRir >= 1 && baseRir <= 3 && increment > 0) {
    const shouldIncrease = globalGoal === 'hypertrophy';
    return withLowRecoveryAdjustment({
      weightKg: shouldIncrease ? roundToIncrement(baseWeight + increment, increment) : baseWeight,
      reps: targetRange.min,
      sets: recentSetCount,
      rir: plannedRir ?? 2,
      targetRepMin: targetRange.min,
      targetRepMax: targetRange.max,
      reason: shouldIncrease
        ? `Last session reached ${targetRange.max} reps across working sets with RIR ${baseRir}, so SetGo suggests a small weight increase.`
        : `Last session reached ${targetRange.max} reps, but the global goal is maintenance, so SetGo holds weight steady.`,
      confidence: completedSessions.length >= 2 ? 'high' : 'medium',
    }, recoveryPercent);
  }

  if (repeatedMaxEffort) {
    return withLowRecoveryAdjustment({
      weightKg: baseWeight,
      reps: Math.max(targetRange.min, Math.min(finalSet?.reps ?? targetRange.min, targetRange.max)),
      sets: recentSetCount,
      rir: plannedRir ?? 2,
      targetRepMin: targetRange.min,
      targetRepMax: targetRange.max,
      reason: 'The last two sessions ended at RIR 0, so SetGo holds weight steady before progressing.',
      confidence: 'medium',
    }, recoveryPercent);
  }

  if (anyBelowMin) {
    const shouldReduce = finalWasMaxEffort && increment > 0;
    return withLowRecoveryAdjustment({
      weightKg: shouldReduce ? roundToIncrement(Math.max(0, baseWeight - increment), increment) : baseWeight,
      reps: targetRange.min,
      sets: recentSetCount,
      rir: plannedRir ?? 2,
      targetRepMin: targetRange.min,
      targetRepMax: targetRange.max,
      reason: shouldReduce
        ? `A working set fell below ${targetRange.min} reps at max effort, so SetGo suggests a small reduction.`
        : `A working set fell below ${targetRange.min} reps, so SetGo holds weight and targets the low end of the range.`,
      confidence: 'medium',
    }, recoveryPercent);
  }

  const bestReps = Math.max(...lastSets.map((set) => set.reps));
  const nextReps = style === 'isolation' || increment === 0
    ? clamp(bestReps + 1, targetRange.min, targetRange.max)
    : clamp(bestReps, targetRange.min, targetRange.max);

  return withLowRecoveryAdjustment({
    weightKg: baseWeight || plan.plannedWeightKg,
    reps: nextReps,
    sets: recentSetCount,
    rir: plannedRir ?? baseRir,
    targetRepMin: targetRange.min,
    targetRepMax: targetRange.max,
    reason: 'Recent work is inside the target range, so SetGo keeps the weight stable and nudges reps within range.',
    confidence: completedSessions.length >= 2 ? 'high' : 'medium',
  }, recoveryPercent);
}
