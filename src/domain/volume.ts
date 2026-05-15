import type { WorkoutSet } from '../types';

export function calculateSetVolumeKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * reps;
}

export function calculateExerciseVolumeKg(sets: Pick<WorkoutSet, 'weightKg' | 'reps' | 'isCompleted'>[]): number {
  return sets
    .filter((set) => set.isCompleted)
    .reduce((sum, set) => sum + calculateSetVolumeKg(set.weightKg, set.reps), 0);
}

export function calculateSessionStrengthVolumeKg(exerciseVolumes: number[]): number {
  return exerciseVolumes.reduce((sum, volume) => sum + Math.max(0, volume), 0);
}

export function calculateAverageSpeedKmh(distanceKm: number, startedAt: string, endedAt: string): number | undefined {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const durationHours = (end - start) / 1000 / 60 / 60;

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return undefined;
  if (!Number.isFinite(durationHours) || durationHours <= 0) return undefined;

  return Number((distanceKm / durationHours).toFixed(2));
}
