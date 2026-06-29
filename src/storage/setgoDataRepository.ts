import { db } from '../db/db';
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

export type SetGoDataSnapshot = {
  exercises: ExerciseMaster[];
  routines: Routine[];
  routineDays: RoutineDay[];
  weeklySchedules: WeeklySchedule[];
  routineCyclePlanItems: RoutineCyclePlanItem[];
  calendarPlanOverrides: CalendarPlanOverride[];
  routineExercisePlans: RoutineExercisePlan[];
  workoutSessions: WorkoutSession[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
  cardioRecords: CardioRecord[];
};

export type SetGoSettingsDataSnapshot = Pick<
  SetGoDataSnapshot,
  | 'exercises'
  | 'routines'
  | 'routineDays'
  | 'weeklySchedules'
  | 'routineCyclePlanItems'
  | 'calendarPlanOverrides'
  | 'routineExercisePlans'
>;

export type ExercisePreservationContext = Pick<SetGoDataSnapshot, 'exercises' | 'workoutExercises'>;

export type SetGoDataRepository = {
  readBackupData(): Promise<SetGoDataSnapshot>;
  readSettingsBackupData(): Promise<SetGoSettingsDataSnapshot>;
  readExercisePreservationContext(): Promise<ExercisePreservationContext>;
  replaceBackupData(data: SetGoDataSnapshot): Promise<void>;
  replaceSettingsData(data: SetGoSettingsDataSnapshot): Promise<void>;
};

export const dexieSetGoDataRepository: SetGoDataRepository = {
  async readBackupData() {
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
    };
  },

  async readSettingsBackupData() {
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
      exercises,
      routines,
      routineDays,
      weeklySchedules,
      routineCyclePlanItems,
      calendarPlanOverrides,
      routineExercisePlans,
    };
  },

  async readExercisePreservationContext() {
    const [exercises, workoutExercises] = await Promise.all([
      db.exercises.toArray(),
      db.workoutExercises.toArray(),
    ]);
    return { exercises, workoutExercises };
  },

  async replaceBackupData(data) {
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

      await db.exercises.bulkPut(data.exercises);
      await db.routines.bulkPut(data.routines);
      await db.routineDays.bulkPut(data.routineDays);
      await db.weeklySchedules.bulkPut(data.weeklySchedules);
      await db.routineCyclePlanItems.bulkPut(data.routineCyclePlanItems);
      await db.calendarPlanOverrides.bulkPut(data.calendarPlanOverrides);
      await db.routineExercisePlans.bulkPut(data.routineExercisePlans);
      await db.workoutSessions.bulkPut(data.workoutSessions);
      await db.workoutExercises.bulkPut(data.workoutExercises);
      await db.workoutSets.bulkPut(data.workoutSets);
      await db.cardioRecords.bulkPut(data.cardioRecords);
    });
  },

  async replaceSettingsData(data) {
    await db.transaction('rw', [
      db.exercises,
      db.routines,
      db.routineDays,
      db.weeklySchedules,
      db.routineCyclePlanItems,
      db.calendarPlanOverrides,
      db.routineExercisePlans,
    ], async () => {
      await Promise.all([
        db.routineExercisePlans.clear(),
        db.weeklySchedules.clear(),
        db.routineCyclePlanItems.clear(),
        db.calendarPlanOverrides.clear(),
        db.routineDays.clear(),
        db.routines.clear(),
        db.exercises.clear(),
      ]);

      await db.exercises.bulkPut(data.exercises);
      await db.routines.bulkPut(data.routines);
      await db.routineDays.bulkPut(data.routineDays);
      await db.weeklySchedules.bulkPut(data.weeklySchedules);
      await db.routineCyclePlanItems.bulkPut(data.routineCyclePlanItems);
      await db.calendarPlanOverrides.bulkPut(data.calendarPlanOverrides);
      await db.routineExercisePlans.bulkPut(data.routineExercisePlans);
    });
  },
};

