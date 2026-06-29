import Dexie, { type Table } from 'dexie';
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

export class SetGoDatabase extends Dexie {
  exercises!: Table<ExerciseMaster, string>;
  routines!: Table<Routine, string>;
  routineDays!: Table<RoutineDay, string>;
  weeklySchedules!: Table<WeeklySchedule, string>;
  routineCyclePlanItems!: Table<RoutineCyclePlanItem, string>;
  calendarPlanOverrides!: Table<CalendarPlanOverride, string>;
  routineExercisePlans!: Table<RoutineExercisePlan, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  workoutExercises!: Table<WorkoutExercise, string>;
  workoutSets!: Table<WorkoutSet, string>;
  cardioRecords!: Table<CardioRecord, string>;

  constructor() {
    super('setgo');

    this.version(1).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      calendarPlanOverrides: 'id, date, routineId, routineDayId',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment',
    });

    this.version(2).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      calendarPlanOverrides: 'id, date, routineId, routineDayId',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment',
    });

    this.version(3).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      calendarPlanOverrides: 'id, date, routineId, routineDayId',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment',
    });

    this.version(4).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      routineCyclePlanItems: 'id, routineId, order, routineDayId, kind',
      calendarPlanOverrides: 'id, date, routineId, routineDayId, kind',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment',
    });

    this.version(5).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      routineCyclePlanItems: 'id, routineId, order, routineDayId, kind',
      calendarPlanOverrides: 'id, date, routineId, routineDayId, kind',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment, order',
    });

    this.version(6).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      routineCyclePlanItems: 'id, routineId, order, routineDayId, kind',
      calendarPlanOverrides: 'id, date, routineId, routineDayId, kind',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo',
      cardioRecords: 'id, sessionId, environment, order',
    }).upgrade((tx) => (
      tx.table('workoutSets').toCollection().modify((set) => {
        if (set.isHard === undefined && !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3) {
          set.isHard = true;
        }
      })
    ));

    this.version(7).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence, family, intensityPhase',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      routineCyclePlanItems: 'id, routineId, order, routineDayId, kind',
      calendarPlanOverrides: 'id, date, routineId, routineDayId, kind',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, cyclePlanItemId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo, intensityTechnique',
      cardioRecords: 'id, sessionId, environment, order',
    }).upgrade((tx) => {
      return tx.table('routineDays').toCollection().modify((day) => {
        const name = (day.name || '').toLowerCase();
        day.family = name.includes('upper') || name.includes('상체') ? 'upper' : 
                     name.includes('lower') || name.includes('하체') ? 'lower' : 'full_body';
        day.intensityPhase = 'hypertrophy';
      });
    });

    this.version(8).stores({
      exercises: 'id, category, stage, isDefault, isActive',
      routines: 'id, splitType, isActive, startDate',
      routineDays: 'id, routineId, sequence, family, intensityPhase',
      weeklySchedules: 'id, routineId, weekday, routineDayId',
      routineCyclePlanItems: 'id, routineId, order, routineDayId, kind',
      calendarPlanOverrides: 'id, date, routineId, routineDayId, kind',
      routineExercisePlans: 'id, routineDayId, exerciseId, order',
      workoutSessions: 'id, date, routineId, routineDayId, cyclePlanItemId, status',
      workoutExercises: 'id, sessionId, exerciseId, order, status',
      workoutSets: 'id, workoutExerciseId, setNo, intensityTechnique',
      cardioRecords: 'id, sessionId, environment, order',
    }).upgrade((tx) => (
      tx.table('workoutSets').toCollection().modify((set) => {
        const weightKg = Number(set.weightKg);
        const reps = Number(set.reps);
        set.estimatedOneRmKg = Number.isFinite(weightKg) && weightKg > 0 && Number.isFinite(reps) && reps > 0
          ? Math.round(weightKg * (1 + reps / 30) * 10) / 10
          : undefined;
      })
    ));
  }
}

export const db = new SetGoDatabase();

/**
 * Request persistent storage permission from the browser.
 * Returns true if the storage is persistent, false otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch (e) {
      console.warn('Failed to request storage persistence:', e);
      return false;
    }
  }
  return false;
}

/**
 * Check if the storage is already persistent.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch (e) {
      console.warn('Failed to check storage persistence:', e);
      return false;
    }
  }
  return false;
}
