import { isWarmupOnlyExercise } from './exercises';
import type { CardioRecord, ExerciseMaster, WorkoutSet } from '../types';

const STANDARD_SET_VOLUME_KG = 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function setVolume(set: WorkoutSet): number {
  return set.isCompleted ? set.weightKg * set.reps : 0;
}

export function isWarmupSet(set: WorkoutSet, exercise?: ExerciseMaster): boolean {
  const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
  return Boolean(isWarmup) || isWarmupOnlyExercise(exercise);
}

export function isHardSet(set: WorkoutSet, exercise: ExerciseMaster): boolean {
  return set.isCompleted && !isWarmupSet(set, exercise) && set.isHard === true;
}

function setVolumeFactor(set: WorkoutSet): number {
  const volume = setVolume(set);
  if (volume <= 0) return 0.85;
  return clamp(Math.log1p(volume) / Math.log1p(STANDARD_SET_VOLUME_KG), 0.75, 1.2);
}

export function recoveryEffortMultiplier(set: WorkoutSet): number {
  const rir = set.rir;
  let multiplier = 1;

  if (set.type === 'failure' || (rir !== undefined && rir <= 0)) multiplier = 1.15;
  else if (rir !== undefined && rir <= 1) multiplier = 1.08;
  else if (rir !== undefined && rir <= 3) multiplier = 1;
  else if (rir !== undefined && rir <= 5) multiplier = 0.85;
  else if (rir !== undefined) multiplier = 0.7;

  if (set.type === 'drop' || set.intensityTechnique === 'drop_set') multiplier *= 1.08;
  if (set.intensityTechnique === 'myo_reps') multiplier *= 1.08;

  return clamp(multiplier, 0.6, 1.25);
}

export function strengthSetRecoveryLoad(set: WorkoutSet): number {
  if (!set.isCompleted) return 0;
  return Math.round(100 * setVolumeFactor(set));
}

export function cardioRecoveryLoad(record: CardioRecord): number {
  const distanceLoad = (record.distanceKm ?? 0) * 90;
  const durationLoad = ((record.durationSeconds ?? 0) / 60) * 10;
  return Math.round(clamp(Math.max(distanceLoad, durationLoad), 0, 1200));
}
