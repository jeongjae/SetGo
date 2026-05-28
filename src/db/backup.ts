import { db } from './db';
import { getStoredLocale, saveStoredLocale, type AppLocale } from '../i18n/i18n';
import type {
  CalendarPlanOverride,
  CardioRecord,
  ExerciseMaster,
  Routine,
  RoutineCyclePlanItem,
  RoutineDay,
  RoutineExercisePlan,
  WeeklySchedule,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../types';

export type SetGoBackup = {
  app: 'SetGo';
  version: 1;
  exportedAt: string;
  data: {
    exercises: ExerciseMaster[];
    routines: Routine[];
    routineDays: RoutineDay[];
    weeklySchedules: WeeklySchedule[];
    routineCyclePlanItems?: RoutineCyclePlanItem[];
    calendarPlanOverrides?: CalendarPlanOverride[];
    routineExercisePlans: RoutineExercisePlan[];
    workoutSessions: WorkoutSession[];
    workoutExercises: WorkoutExercise[];
    workoutSets: WorkoutSet[];
    cardioRecords: CardioRecord[];
  };
};

export type SetGoSettingsBackup = {
  app: 'SetGo';
  kind: 'settings';
  version: 1;
  exportedAt: string;
  settings: {
    locale: AppLocale;
  };
  data: Pick<
    SetGoBackup['data'],
    | 'exercises'
    | 'routines'
    | 'routineDays'
    | 'weeklySchedules'
    | 'routineCyclePlanItems'
    | 'calendarPlanOverrides'
    | 'routineExercisePlans'
  >;
};

export async function createBackup(): Promise<SetGoBackup> {
  const [
    exercises,
    routines,
    routineDays,
    weeklySchedules,
    routineCyclePlanItems,
    calendarPlanOverrides,
    routineExercisePlans,
    workoutSessions,
    workoutExercises,
    workoutSets,
    cardioRecords,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.routineDays.toArray(),
    db.weeklySchedules.toArray(),
    db.routineCyclePlanItems.toArray(),
    db.calendarPlanOverrides.toArray(),
    db.routineExercisePlans.toArray(),
    db.workoutSessions.toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
    db.cardioRecords.toArray(),
  ]);

  return {
    app: 'SetGo',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      exercises,
      routines,
      routineDays,
      weeklySchedules,
      routineCyclePlanItems,
      calendarPlanOverrides,
      routineExercisePlans,
      workoutSessions,
      workoutExercises,
      workoutSets,
      cardioRecords,
    },
  };
}

export async function createSettingsBackup(): Promise<SetGoSettingsBackup> {
  const [
    exercises,
    routines,
    routineDays,
    weeklySchedules,
    routineCyclePlanItems,
    calendarPlanOverrides,
    routineExercisePlans,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.routineDays.toArray(),
    db.weeklySchedules.toArray(),
    db.routineCyclePlanItems.toArray(),
    db.calendarPlanOverrides.toArray(),
    db.routineExercisePlans.toArray(),
  ]);

  return {
    app: 'SetGo',
    kind: 'settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      locale: getStoredLocale(),
    },
    data: {
      exercises,
      routines,
      routineDays,
      weeklySchedules,
      routineCyclePlanItems,
      calendarPlanOverrides,
      routineExercisePlans,
    },
  };
}

export async function restoreBackup(input: unknown): Promise<void> {
  const backup = input as SetGoBackup;
  if (backup?.app !== 'SetGo' || backup.version !== 1 || !backup.data) {
    throw new Error('Invalid SetGo backup file');
  }

  const routines = backup.data.routines ?? [];
  if (routines.length > 0) {
    const hasActive = routines.some((r) => r.isActive);
    if (!hasActive) {
      routines[0].isActive = true;
    }
  }

  await db.transaction('rw', [
    db.exercises,
    db.routines,
    db.routineDays,
    db.weeklySchedules,
    db.routineCyclePlanItems,
    db.calendarPlanOverrides,
    db.routineExercisePlans,
    db.workoutSessions,
    db.workoutExercises,
    db.workoutSets,
    db.cardioRecords,
  ], async () => {
      await Promise.all([
        db.cardioRecords.clear(),
        db.workoutSets.clear(),
        db.workoutExercises.clear(),
        db.workoutSessions.clear(),
        db.routineExercisePlans.clear(),
        db.weeklySchedules.clear(),
        db.routineCyclePlanItems.clear(),
        db.calendarPlanOverrides.clear(),
        db.routineDays.clear(),
        db.routines.clear(),
        db.exercises.clear(),
      ]);

      await db.exercises.bulkPut(backup.data.exercises ?? []);
      await db.routines.bulkPut(routines);
      await db.routineDays.bulkPut(backup.data.routineDays ?? []);
      await db.weeklySchedules.bulkPut(backup.data.weeklySchedules ?? []);
      await db.routineCyclePlanItems.bulkPut(backup.data.routineCyclePlanItems ?? []);
      await db.calendarPlanOverrides.bulkPut(backup.data.calendarPlanOverrides ?? []);
      await db.routineExercisePlans.bulkPut(backup.data.routineExercisePlans ?? []);
      await db.workoutSessions.bulkPut(backup.data.workoutSessions ?? []);
      await db.workoutExercises.bulkPut(backup.data.workoutExercises ?? []);
      await db.workoutSets.bulkPut(backup.data.workoutSets ?? []);
      await db.cardioRecords.bulkPut(backup.data.cardioRecords ?? []);
    },
  );
}

export async function restoreSettingsBackup(input: unknown): Promise<void> {
  const backup = input as SetGoSettingsBackup;
  if (backup?.app !== 'SetGo' || backup.kind !== 'settings' || backup.version !== 1 || !backup.data) {
    throw new Error('Invalid SetGo settings backup file');
  }

  const routines = backup.data.routines ?? [];
  if (routines.length > 0) {
    const hasActive = routines.some((r) => r.isActive);
    if (!hasActive) {
      routines[0].isActive = true;
    }
  }

  await db.transaction('rw', [
    db.exercises,
    db.routines,
    db.routineDays,
    db.weeklySchedules,
    db.routineCyclePlanItems,
    db.calendarPlanOverrides,
    db.routineExercisePlans,
    db.workoutExercises,
  ], async () => {
    const [existingExercises, workoutExercises] = await Promise.all([
      db.exercises.toArray(),
      db.workoutExercises.toArray(),
    ]);
    const existingById = new Map(existingExercises.map((exercise) => [exercise.id, exercise]));
    const backupExerciseIds = new Set((backup.data.exercises ?? []).map((exercise) => exercise.id));
    const referencedExerciseIds = new Set(workoutExercises.map((workoutExercise) => workoutExercise.exerciseId));
    const preservedLogExercises = Array.from(referencedExerciseIds)
      .filter((exerciseId) => !backupExerciseIds.has(exerciseId))
      .map((exerciseId) => existingById.get(exerciseId))
      .filter((exercise): exercise is ExerciseMaster => Boolean(exercise))
      .map((exercise) => ({
        ...exercise,
        isActive: false,
        updatedAt: new Date().toISOString(),
      }));

    await Promise.all([
      db.routineExercisePlans.clear(),
      db.weeklySchedules.clear(),
      db.routineCyclePlanItems.clear(),
      db.calendarPlanOverrides.clear(),
      db.routineDays.clear(),
      db.routines.clear(),
      db.exercises.clear(),
    ]);

    await db.exercises.bulkPut([...(backup.data.exercises ?? []), ...preservedLogExercises]);
    await db.routines.bulkPut(routines);
    await db.routineDays.bulkPut(backup.data.routineDays ?? []);
    await db.weeklySchedules.bulkPut(backup.data.weeklySchedules ?? []);
    await db.routineCyclePlanItems.bulkPut(backup.data.routineCyclePlanItems ?? []);
    await db.calendarPlanOverrides.bulkPut(backup.data.calendarPlanOverrides ?? []);
    await db.routineExercisePlans.bulkPut(backup.data.routineExercisePlans ?? []);
  });

  if (backup.settings?.locale) {
    saveStoredLocale(backup.settings.locale);
  }
}
