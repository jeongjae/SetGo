import { formatDateKey } from '../utils/date';
import type { CardioRecord, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import type { WorkoutExerciseLog } from '../db/workouts';

export type WorkoutFinishSummary = {
  completedExercises: number;
  completedSets: number;
  hardSets: number;
  prCount: number;
  cardioCount: number;
  totalVolumeKg: number;
  primaryText: string;
  metrics: Array<{ label: string; value: string; tone?: 'success' | 'accent' | 'danger' }>;
};

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatCountdownSeconds(seconds: number): string {
  return formatElapsed(Math.max(0, seconds) * 1000);
}

export function getElapsedMs(startedAtStr: string, nowMs: number): number {
  const start = new Date(startedAtStr).getTime();
  if (Number.isNaN(start)) return 0;

  return Math.max(0, nowMs - start);
}

export function getLiveSessionElapsedMs(
  session: Pick<WorkoutSession, 'date' | 'startedAt' | 'status'>,
  nowMs: number,
): number | undefined {
  if (!session.startedAt || session.status !== 'in_progress') return undefined;
  if (session.date !== formatDateKey(new Date(nowMs))) return undefined;

  return getElapsedMs(session.startedAt, nowMs);
}

export function canCompleteWorkoutLog(completedStrengthSetCount: number, cardioRecordCount: number): boolean {
  return completedStrengthSetCount > 0 || cardioRecordCount > 0;
}

export function shouldCompleteHistoricalSetOnSave(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>,
  originalSet?: Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir'>,
): boolean {
  const hasLoggedValue = set.weightKg > 0 || set.reps > 0 || set.rir !== undefined;
  const hasChangedFromOriginal = !originalSet
    || set.weightKg !== originalSet.weightKg
    || set.reps !== originalSet.reps
    || set.rir !== originalSet.rir;

  return !set.isCompleted
    && hasLoggedValue
    && hasChangedFromOriginal;
}

export function countLoggedCardioRecords(cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>): number {
  return cardioRecords.filter((cardioRecord) => cardioRecord.isDraft !== true).length;
}

export function countFullyCompletedExercises(
  logs: Array<{ sets: Array<Pick<WorkoutSet, 'isCompleted'>> }>,
): number {
  return logs.filter((log) => log.sets.length > 0 && log.sets.every((set) => set.isCompleted)).length;
}

export function getProgressLabel(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps'>,
  pastBestWeight?: number,
  pastBestVolume?: number,
): string | undefined {
  if (!set.isCompleted) return undefined;

  const isWeightPr = pastBestWeight !== undefined && pastBestWeight > 0 && set.weightKg >= pastBestWeight;
  const isVolumePr = pastBestVolume !== undefined && pastBestVolume > 0 && (set.weightKg * set.reps) >= pastBestVolume;
  if (isWeightPr && isVolumePr) return 'PR';
  if (isWeightPr) return 'kg PR';
  if (isVolumePr) return 'vol PR';
  return undefined;
}

export function getWorkoutSetProgressBadges(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps'>,
  pastBestWeight?: number,
  pastBestVolume?: number,
): Array<'weight-pr' | 'volume-pr'> {
  if (!set.isCompleted) return [];

  const badges: Array<'weight-pr' | 'volume-pr'> = [];
  if (pastBestWeight !== undefined && pastBestWeight > 0 && set.weightKg >= pastBestWeight) {
    badges.push('weight-pr');
  }
  if (pastBestVolume !== undefined && pastBestVolume > 0 && (set.weightKg * set.reps) >= pastBestVolume) {
    badges.push('volume-pr');
  }

  return badges;
}

export function expandWorkoutExercise(
  expandedExercises: Record<string, boolean>,
  workoutExerciseId: string,
): Record<string, boolean> {
  return { ...expandedExercises, [workoutExerciseId]: true };
}

export function shouldConfirmWorkoutExerciseDelete(
  log: {
    workoutExercise: Pick<WorkoutExercise, 'memo'>;
    sets: Array<Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>>;
  },
): boolean {
  return Boolean(log.workoutExercise.memo?.trim())
    || log.sets.some((set) => (
      set.isCompleted
      || set.weightKg > 0
      || set.reps > 0
      || set.rir !== undefined
    ));
}

export function shouldConfirmWorkoutSetDelete(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>,
): boolean {
  return set.isCompleted
    || set.weightKg > 0
    || set.reps > 0
    || set.rir !== undefined;
}

export function getNextIncompleteSetTarget(
  logs: Array<{
    workoutExercise: Pick<WorkoutExercise, 'id'>;
    sets: Array<Pick<WorkoutSet, 'id' | 'isCompleted'>>;
  }>,
  completedSetId: string,
): { workoutExerciseId: string; inputId: string } | undefined {
  const orderedSets = logs.flatMap((log) => (
    log.sets.map((set) => ({
      set,
      workoutExerciseId: log.workoutExercise.id,
    }))
  ));
  const completedIndex = orderedSets.findIndex((item) => item.set.id === completedSetId);
  const nextItem = orderedSets
    .slice(Math.max(0, completedIndex + 1))
    .find((item) => !item.set.isCompleted);

  return nextItem
    ? { workoutExerciseId: nextItem.workoutExerciseId, inputId: `weight_input_${nextItem.set.id}` }
    : undefined;
}

export function getWorkoutFinishSummary(
  logs: WorkoutExerciseLog[],
  cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>,
  totalVolumeKg: number,
  locale: 'ko' | 'en',
): WorkoutFinishSummary {
  const completedSets = logs.flatMap((log) => log.sets).filter((set) => set.isCompleted);
  const hardSets = completedSets.filter((set) => !set.isWarmup && set.isHard === true).length;
  const prCount = logs.reduce((sum, log) => (
    sum + log.sets.filter((set) => getProgressLabel(set, log.pastBestWeight, log.pastBestVolume)).length
  ), 0);
  const completedExercises = countFullyCompletedExercises(logs);
  const cardioCount = countLoggedCardioRecords(cardioRecords);
  const primaryText = locale === 'ko'
    ? `${completedExercises}개 운동 / ${completedSets.length}세트 / ${totalVolumeKg.toLocaleString()}kg`
    : `${completedExercises} exercises / ${completedSets.length} sets / ${totalVolumeKg.toLocaleString()}kg`;
  const metrics = [
    {
      label: locale === 'ko' ? '운동' : 'Exercises',
      value: String(completedExercises),
    },
    {
      label: locale === 'ko' ? '세트' : 'Sets',
      value: String(completedSets.length),
    },
    {
      label: 'Hard',
      value: String(hardSets),
      tone: hardSets > 0 ? 'accent' as const : undefined,
    },
    {
      label: 'PR',
      value: String(prCount),
      tone: prCount > 0 ? 'success' as const : undefined,
    },
    {
      label: locale === 'ko' ? '러닝' : 'Cardio',
      value: String(cardioCount),
    },
  ];

  return {
    completedExercises,
    completedSets: completedSets.length,
    hardSets,
    prCount,
    cardioCount,
    totalVolumeKg,
    primaryText,
    metrics,
  };
}

export function shouldConfirmCardioDelete(
  cardioRecord: Pick<CardioRecord, 'distanceKm' | 'inclinePercent' | 'location' | 'memo'>,
): boolean {
  return (cardioRecord.distanceKm ?? 0) > 0
    || (cardioRecord.inclinePercent ?? 0) > 0
    || Boolean(cardioRecord.location?.trim())
    || Boolean(cardioRecord.memo?.trim());
}
