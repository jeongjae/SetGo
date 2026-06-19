import type { CalendarPlanOverride, RoutineDay, WorkoutPlanKind, WorkoutSessionKind } from '../types';

export type DailyWorkoutRecommendationSource =
  | 'override'
  | 'cycle'
  | 'weekly-schedule'
  | 'next-routine-day'
  | 'rest'
  | 'fallback';

export type DailyWorkoutRecommendationReason =
  | 'manualOverride'
  | 'cycleRoutine'
  | 'weeklyRoutine'
  | 'plannedRunning'
  | 'restDay'
  | 'nextRoutineAfterLatestWorkout'
  | 'noActiveRoutine';

export type DailyWorkoutRecommendation = {
  kind: WorkoutPlanKind;
  sessionKind: WorkoutSessionKind;
  routineDay?: RoutineDay;
  label: string;
  source: DailyWorkoutRecommendationSource;
  reason: DailyWorkoutRecommendationReason;
  confidence: 'low' | 'medium' | 'high';
};

export type RoutineScheduleSnapshot = {
  override?: Pick<CalendarPlanOverride, 'kind' | 'routineDayId' | 'isRestDay'>;
  cycleItem?: { kind: WorkoutPlanKind; routineDayId?: string };
  schedule?: { routineDayId?: string; isRestDay: boolean };
  routineDay?: RoutineDay;
  kind: WorkoutPlanKind;
  isRestDay: boolean;
};

export type BuildDailyWorkoutRecommendationInput = {
  schedule: RoutineScheduleSnapshot;
  nextRoutineDay?: RoutineDay;
  hasActiveRoutine: boolean;
  freeWorkoutLabel: string;
  runningLabel: string;
  restDayLabel: string;
  noRoutineDayLabel: string;
  getRoutineDayLabel: (routineDay: RoutineDay | undefined) => string | undefined;
};

export function buildDailyWorkoutRecommendation(
  input: BuildDailyWorkoutRecommendationInput,
): DailyWorkoutRecommendation {
  const {
    schedule,
    nextRoutineDay,
    hasActiveRoutine,
    freeWorkoutLabel,
    runningLabel,
    restDayLabel,
    noRoutineDayLabel,
    getRoutineDayLabel,
  } = input;

  if (!hasActiveRoutine) {
    return {
      kind: 'free',
      sessionKind: 'free',
      label: freeWorkoutLabel,
      source: 'fallback',
      reason: 'noActiveRoutine',
      confidence: 'low',
    };
  }

  const routineLabel = getRoutineDayLabel(schedule.routineDay);
  if (schedule.kind === 'routine' && schedule.routineDay && routineLabel) {
    return {
      kind: 'routine',
      sessionKind: 'planned',
      routineDay: schedule.routineDay,
      label: routineLabel,
      source: schedule.override ? 'override' : schedule.cycleItem ? 'cycle' : 'weekly-schedule',
      reason: schedule.override ? 'manualOverride' : schedule.cycleItem ? 'cycleRoutine' : 'weeklyRoutine',
      confidence: schedule.override ? 'high' : 'medium',
    };
  }

  if (schedule.kind === 'running') {
    return {
      kind: 'running',
      sessionKind: 'running',
      label: runningLabel,
      source: schedule.override ? 'override' : schedule.cycleItem ? 'cycle' : 'weekly-schedule',
      reason: schedule.override ? 'manualOverride' : 'plannedRunning',
      confidence: schedule.override ? 'high' : 'medium',
    };
  }

  if (schedule.kind === 'free') {
    return {
      kind: 'free',
      sessionKind: 'free',
      label: freeWorkoutLabel,
      source: schedule.override ? 'override' : 'fallback',
      reason: schedule.override ? 'manualOverride' : 'noActiveRoutine',
      confidence: schedule.override ? 'high' : 'low',
    };
  }

  if (schedule.isRestDay) {
    return {
      kind: 'rest',
      sessionKind: 'planned',
      routineDay: nextRoutineDay,
      label: nextRoutineDay ? getRoutineDayLabel(nextRoutineDay) ?? restDayLabel : restDayLabel,
      source: nextRoutineDay ? 'next-routine-day' : 'rest',
      reason: nextRoutineDay ? 'nextRoutineAfterLatestWorkout' : 'restDay',
      confidence: nextRoutineDay ? 'medium' : 'high',
    };
  }

  return {
    kind: 'free',
    sessionKind: 'free',
    label: noRoutineDayLabel,
    source: 'fallback',
    reason: 'noActiveRoutine',
    confidence: 'low',
  };
}
