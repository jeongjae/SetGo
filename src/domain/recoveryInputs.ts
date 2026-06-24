import { db } from '../db/db';
import { getExerciseCategories, isWarmupOnlyExercise } from './exercises';
import {
  buildRecoverySnapshot,
  type RecoveryGroupStat,
  type RecoveryLoadInput,
  type RecoveryMuscleGroup,
  type RecoverySnapshot,
} from './recovery';
import type { AppLocale } from '../i18n/i18n';
import type {
  CardioRecord,
  ExerciseMaster,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../types';

// Strength muscle groups exclude cardio, mirroring the stats pipeline.
export type StrengthMuscleGroup = Exclude<RecoveryMuscleGroup, 'cardio'>;

// The helpers below mirror the recovery load logic used by StatsPage so the
// Today recovery warning and the Insights dashboard stay in sync.
export function setVolume(set: WorkoutSet): number {
  return set.isCompleted ? set.weightKg * set.reps : 0;
}

export function isHardSet(set: WorkoutSet, exercise: ExerciseMaster): boolean {
  const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
  return set.isCompleted && !isWarmup && !isWarmupOnlyExercise(exercise) && set.isHard === true;
}

export function isWarmupSet(set: WorkoutSet, exercise?: ExerciseMaster): boolean {
  const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
  return Boolean(isWarmup) || isWarmupOnlyExercise(exercise);
}

export function exerciseMuscleGroups(exercise: ExerciseMaster): StrengthMuscleGroup[] {
  const categories = getExerciseCategories(exercise);
  const mapped = categories
    .map((category): StrengthMuscleGroup | undefined => {
      if (
        category === 'chest'
        || category === 'back'
        || category === 'legs'
        || category === 'shoulder'
        || category === 'biceps'
        || category === 'triceps'
      ) {
        return category;
      }
      return undefined;
    })
    .filter((group): group is StrengthMuscleGroup => Boolean(group));

  const haystack = `${exercise.id} ${exercise.nameKo} ${exercise.nameEn ?? ''}`.toLowerCase();
  if (/(core|abs|abdominal|plank|crunch|코어|복근)/.test(haystack)) mapped.push('core');

  return Array.from(new Set(mapped));
}

export function exerciseRecoveryMuscleGroups(exercise: ExerciseMaster): RecoveryMuscleGroup[] {
  const groups: RecoveryMuscleGroup[] = [...exerciseMuscleGroups(exercise)];
  const categories = getExerciseCategories(exercise);
  if (categories.includes('cardio')) groups.push('cardio');
  if (groups.length === 0 && categories.includes('bodyweight')) groups.push('core');
  return Array.from(new Set(groups));
}

export type RecoveryDataset = {
  sessions: WorkoutSession[];
  workoutExercises: WorkoutExercise[];
  sets: WorkoutSet[];
  cardio: CardioRecord[];
  exercises: ExerciseMaster[];
};

// Convert completed workout and cardio rows into recovery load inputs.
export function buildRecoveryInputs(dataset: RecoveryDataset): RecoveryLoadInput[] {
  const { sessions, workoutExercises, sets, cardio, exercises } = dataset;
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
  sets.forEach((set) => {
    const list = setsByWorkoutExercise.get(set.workoutExerciseId) ?? [];
    list.push(set);
    setsByWorkoutExercise.set(set.workoutExerciseId, list);
  });

  const completedSessionIds = new Set(
    sessions.filter((session) => session.status === 'completed').map((session) => session.id),
  );
  const completedWorkoutExercises = workoutExercises.filter((item) => completedSessionIds.has(item.sessionId));

  const strengthInputs = completedWorkoutExercises.flatMap((workoutExercise) => {
    const session = sessionById.get(workoutExercise.sessionId);
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    if (!session || !exercise) return [];
    const groups = exerciseRecoveryMuscleGroups(exercise);
    if (groups.length === 0) return [];
    const completedAt = session.endedAt ?? session.startedAt ?? `${session.date}T12:00:00`;
    return (setsByWorkoutExercise.get(workoutExercise.id) ?? [])
      .filter((set) => set.isCompleted)
      .map((set) => ({
        date: session.date,
        completedAt,
        muscleGroups: groups,
        load: setVolume(set),
        isHard: isHardSet(set, exercise),
        isWarmup: isWarmupSet(set, exercise),
      }));
  });

  const cardioBySessionId = new Map<string, CardioRecord[]>();
  cardio.forEach((record) => {
    const list = cardioBySessionId.get(record.sessionId) ?? [];
    list.push(record);
    cardioBySessionId.set(record.sessionId, list);
  });
  const cardioInputs = sessions
    .filter((session) => completedSessionIds.has(session.id))
    .flatMap((session) => (cardioBySessionId.get(session.id) ?? [])
      .filter((record) => record.isDraft !== true)
      .map((record) => {
        const distanceLoad = (record.distanceKm ?? 0) * 650;
        const durationLoad = (record.durationSeconds ?? 0) / 60 * 45;
        return {
          date: session.date,
          completedAt: record.endedAt ?? record.startedAt,
          muscleGroups: ['cardio'] as RecoveryMuscleGroup[],
          load: Math.max(distanceLoad, durationLoad),
        };
      }));

  return [...strengthInputs, ...cardioInputs];
}

// Load all workout data and build a recovery snapshot as of the given moment.
export async function loadRecoverySnapshot(asOf: Date = new Date()): Promise<RecoverySnapshot> {
  const [sessions, workoutExercises, sets, exercises, cardio] = await Promise.all([
    db.workoutSessions.toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
    db.exercises.toArray(),
    db.cardioRecords.toArray(),
  ]);
  const inputs = buildRecoveryInputs({ sessions, workoutExercises, sets, cardio, exercises });
  return buildRecoverySnapshot(inputs, { asOf });
}

// Return the planned groups whose recovery is still below the warning threshold, worst first.
export function recoveryWarningGroups(
  snapshot: RecoverySnapshot,
  groups: RecoveryMuscleGroup[],
  threshold = 50,
): RecoveryGroupStat[] {
  const wanted = new Set(groups);
  return snapshot.groups
    .filter((stat) => wanted.has(stat.group) && stat.recoveryPercent < threshold)
    .sort((a, b) => a.recoveryPercent - b.recoveryPercent);
}

const recoveryGroupLabels: Record<AppLocale, Record<RecoveryMuscleGroup, string>> = {
  en: {
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    core: 'Core',
    cardio: 'Cardio',
  },
  ko: {
    chest: '가슴',
    back: '등',
    legs: '하체',
    shoulder: '어깨',
    biceps: '이두',
    triceps: '삼두',
    core: '코어',
    cardio: '유산소',
  },
};

export function recoveryGroupLabel(group: RecoveryMuscleGroup, locale: AppLocale): string {
  return recoveryGroupLabels[locale][group];
}
