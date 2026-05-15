import { db } from './db';
import type {
  CalendarPlanOverride,
  CardioRecord,
  ExerciseMaster,
  Routine,
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
    calendarPlanOverrides?: CalendarPlanOverride[];
    routineExercisePlans: RoutineExercisePlan[];
    workoutSessions: WorkoutSession[];
    workoutExercises: WorkoutExercise[];
    workoutSets: WorkoutSet[];
    cardioRecords: CardioRecord[];
  };
};

export async function createBackup(): Promise<SetGoBackup> {
  const [
    exercises,
    routines,
    routineDays,
    weeklySchedules,
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
      calendarPlanOverrides,
      routineExercisePlans,
      workoutSessions,
      workoutExercises,
      workoutSets,
      cardioRecords,
    },
  };
}

export async function restoreBackup(input: unknown): Promise<void> {
  const backup = input as SetGoBackup;
  if (backup?.app !== 'SetGo' || backup.version !== 1 || !backup.data) {
    throw new Error('Invalid SetGo backup file');
  }

  await db.transaction('rw', [
    db.exercises,
    db.routines,
    db.routineDays,
    db.weeklySchedules,
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
        db.calendarPlanOverrides.clear(),
        db.routineDays.clear(),
        db.routines.clear(),
        db.exercises.clear(),
      ]);

      await db.exercises.bulkPut(backup.data.exercises ?? []);
      await db.routines.bulkPut(backup.data.routines ?? []);
      await db.routineDays.bulkPut(backup.data.routineDays ?? []);
      await db.weeklySchedules.bulkPut(backup.data.weeklySchedules ?? []);
      await db.calendarPlanOverrides.bulkPut(backup.data.calendarPlanOverrides ?? []);
      await db.routineExercisePlans.bulkPut(backup.data.routineExercisePlans ?? []);
      await db.workoutSessions.bulkPut(backup.data.workoutSessions ?? []);
      await db.workoutExercises.bulkPut(backup.data.workoutExercises ?? []);
      await db.workoutSets.bulkPut(backup.data.workoutSets ?? []);
      await db.cardioRecords.bulkPut(backup.data.cardioRecords ?? []);
    },
  );
}
