import Dexie, { type Table } from 'dexie';
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

export class SetGoDatabase extends Dexie {
  exercises!: Table<ExerciseMaster, string>;
  routines!: Table<Routine, string>;
  routineDays!: Table<RoutineDay, string>;
  weeklySchedules!: Table<WeeklySchedule, string>;
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
  }
}

export const db = new SetGoDatabase();
