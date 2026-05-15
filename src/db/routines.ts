import { db } from './db';
import type {
  CalendarPlanOverride,
  ExerciseMaster,
  Routine,
  RoutineDay,
  RoutineExercisePlan,
  RoutineSplitType,
  Weekday,
  WeeklySchedule,
} from '../types';
import { formatDateKey } from '../utils/date';

export type RoutineTemplate = {
  splitType: RoutineSplitType;
  name: string;
  nameKo: string;
  days: string[];
  dayDescriptions: string[];
  dayDescriptionsKo: string[];
};

export const routineTemplates: RoutineTemplate[] = [
  {
    splitType: 'upper_lower_2',
    name: '2-Day Upper / Lower',
    nameKo: '2분할 상체/하체',
    days: ['Upper', 'Lower'],
    dayDescriptions: ['Chest / Back / Biceps / Triceps', 'Legs / Shoulders'],
    dayDescriptionsKo: ['상체: 가슴 / 등 / 이두 / 삼두', '하체: 하체 / 어깨'],
  },
  {
    splitType: 'chest_back_legs_3',
    name: '3-Day Chest / Back / Legs',
    nameKo: '3분할 가슴/등/하체',
    days: ['Chest', 'Back', 'Legs'],
    dayDescriptions: ['Chest + Biceps', 'Back + Triceps', 'Legs + Shoulders'],
    dayDescriptionsKo: ['가슴: 가슴 / 이두 운동하는 날', '등: 등 / 삼두 운동하는 날', '하체: 하체 / 어깨 운동하는 날'],
  },
  {
    splitType: 'push_pull_assist_3',
    name: '3-Day Push / Pull / Assist',
    nameKo: '3분할 푸시/풀/보충운동',
    days: ['Push', 'Pull', 'Assist'],
    dayDescriptions: ['Push movement pattern across upper and lower body', 'Pull movement pattern across upper and lower body', 'User-defined assistance work'],
    dayDescriptionsKo: ['푸시: 상하체 미는 동작', '풀: 상하체 당기는 동작', '보충운동: 사용자가 직접 구성'],
  },
  {
    splitType: 'upper_lower_4',
    name: '4-Day Upper / Lower',
    nameKo: '4분할 상체/하체 (강약)',
    days: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
    dayDescriptions: ['Upper growth day', 'Lower growth day', 'Upper maintenance / recovery day', 'Lower maintenance / recovery day'],
    dayDescriptionsKo: ['Upper A: 가슴 / 등 / 이두 / 삼두, 근육성장', 'Lower A: 하체 / 어깨, 근육성장', 'Upper B: 가슴 / 등 / 이두 / 삼두, 유지/회복', 'Lower B: 하체 / 어깨, 유지/회복'],
  },
];

const routineTemplateExerciseIds: Record<RoutineSplitType, string[][]> = {
  upper_lower_2: [
    ['bench_press', 'lat_pulldown', 'seated_cable_row', 'dumbbell_curl', 'cable_pushdown'],
    ['barbell_squat', 'romanian_deadlift', 'leg_press', 'shoulder_press', 'side_lateral_raise'],
  ],
  chest_back_legs_3: [
    ['bench_press', 'incline_bench_press', 'chest_press', 'dumbbell_curl'],
    ['lat_pulldown', 'seated_cable_row', 'pull_up', 'cable_pushdown'],
    ['barbell_squat', 'romanian_deadlift', 'leg_press', 'shoulder_press', 'side_lateral_raise'],
  ],
  push_pull_assist_3: [
    ['bench_press', 'shoulder_press', 'leg_press', 'push_up'],
    ['lat_pulldown', 'seated_cable_row', 'pull_up', 'romanian_deadlift'],
    [],
  ],
  upper_lower_4: [
    ['bench_press', 'incline_bench_press', 'lat_pulldown', 'dumbbell_curl', 'cable_pushdown'],
    ['barbell_squat', 'romanian_deadlift', 'leg_press', 'shoulder_press'],
    ['chest_press', 'seated_cable_row', 'pull_up', 'dumbbell_curl', 'cable_pushdown'],
    ['leg_press', 'romanian_deadlift', 'side_lateral_raise', 'joint_mobility'],
  ],
};

export function getRoutineTemplateName(template: RoutineTemplate, locale: 'ko' | 'en'): string {
  return locale === 'ko' ? template.nameKo : template.name;
}

export function getRoutineSplitName(splitType: RoutineSplitType, locale: 'ko' | 'en'): string | undefined {
  const template = routineTemplates.find((item) => item.splitType === splitType);
  return template ? getRoutineTemplateName(template, locale) : undefined;
}

export function getRoutineTemplateSummary(template: RoutineTemplate, locale: 'ko' | 'en'): string {
  const descriptions = locale === 'ko' ? template.dayDescriptionsKo : template.dayDescriptions;
  return descriptions.join(' / ');
}

export function getRoutineDayDisplayName(routineDay: Pick<RoutineDay, 'name'> | undefined, locale: 'ko' | 'en'): string | undefined {
  if (!routineDay) return undefined;
  if (locale === 'en') return routineDay.name;

  const labels: Record<string, string> = {
    Upper: '상체',
    Lower: '하체',
    Chest: '가슴',
    Back: '등',
    Legs: '하체',
    'Upper A': '상체 A',
    'Lower A': '하체 A',
    'Upper B': '상체 B',
    'Lower B': '하체 B',
  };

  return labels[routineDay.name] ?? routineDay.name;
}

export type RoutineDayPlan = {
  routineDay: RoutineDay;
  plans: Array<{
    plan: RoutineExercisePlan;
    exercise: ExerciseMaster;
  }>;
};

export type WeeklyScheduleView = {
  weekday: Weekday;
  routineDayId?: string;
  isRestDay: boolean;
};

export type RoutineScheduleForDate = {
  schedule?: WeeklyScheduleView;
  override?: CalendarPlanOverride;
  routineDay?: RoutineDay;
  isRestDay: boolean;
};

const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export async function getActiveRoutine() {
  return db.routines.filter((routine) => routine.isActive).first();
}

export async function getActiveRoutineDays(): Promise<RoutineDay[]> {
  const routine = await getActiveRoutine();
  if (!routine) return [];

  return db.routineDays.where('routineId').equals(routine.id).sortBy('sequence');
}

export async function getActiveWeeklySchedule(): Promise<WeeklyScheduleView[]> {
  const [routine, days] = await Promise.all([getActiveRoutine(), getActiveRoutineDays()]);
  if (!routine) return weekdays.map((weekday) => ({ weekday, isRestDay: true }));

  const savedSchedule = await db.weeklySchedules.where('routineId').equals(routine.id).toArray();
  const scheduleByWeekday = new Map(savedSchedule.map((schedule) => [schedule.weekday, schedule]));

  return weekdays.map((weekday, index) => {
    const saved = scheduleByWeekday.get(weekday);
    if (saved) {
      return {
        weekday,
        routineDayId: saved.routineDayId,
        isRestDay: saved.isRestDay,
      };
    }

    const defaultRoutineDay = days[index % Math.max(days.length, 1)];
    return {
      weekday,
      routineDayId: defaultRoutineDay?.id,
      isRestDay: days.length === 0,
    };
  });
}

export async function saveWeeklyScheduleDay(weekday: Weekday, routineDayId?: string): Promise<void> {
  const routine = await getActiveRoutine();
  if (!routine) return;

  const schedule: WeeklySchedule = {
    id: `${routine.id}_weekday_${weekday}`,
    routineId: routine.id,
    weekday,
    routineDayId,
    isRestDay: !routineDayId,
  };

  await db.weeklySchedules.put(schedule);
}

export async function getSuggestedRoutineDayForDate(date = new Date()): Promise<RoutineDay | undefined> {
  const scheduledRoutineDay = await getRoutineScheduleForDate(date);
  return scheduledRoutineDay.routineDay;
}

export async function getNextRoutineDayAfterLatestWorkout(): Promise<RoutineDay | undefined> {
  const [routine, days] = await Promise.all([getActiveRoutine(), getActiveRoutineDays()]);
  if (!routine || days.length === 0) return undefined;

  const latestWorkout = (await db.workoutSessions.toArray())
    .filter((session) => session.routineId === routine.id && session.routineDayId)
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))[0];

  if (!latestWorkout?.routineDayId) return days[0];

  const latestIndex = days.findIndex((day) => day.id === latestWorkout.routineDayId);
  return days[(latestIndex + 1) % days.length] ?? days[0];
}

export async function getRoutineScheduleForDate(date = new Date()): Promise<RoutineScheduleForDate> {
  const routine = await getActiveRoutine();
  const [days, schedule] = await Promise.all([getActiveRoutineDays(), getActiveWeeklySchedule()]);
  const dateKey = formatDateKey(date);
  const override = routine
    ? await db.calendarPlanOverrides.where('date').equals(dateKey).filter((item) => item.routineId === routine.id).first()
    : undefined;

  if (override) {
    const routineDay = override.routineDayId
      ? days.find((day) => day.id === override.routineDayId)
      : undefined;

    return {
      override,
      routineDay,
      isRestDay: override.isRestDay || !routineDay,
    };
  }

  const todaySchedule = schedule.find((item) => item.weekday === date.getDay());

  if (!todaySchedule) {
    return {
      isRestDay: true,
    };
  }

  if (todaySchedule.isRestDay || !todaySchedule.routineDayId) {
    return {
      schedule: todaySchedule,
      isRestDay: true,
    };
  }

  const routineDay = days.find((day) => day.id === todaySchedule.routineDayId);

  return {
    schedule: todaySchedule,
    routineDay,
    isRestDay: !routineDay,
  };
}

export async function saveCalendarPlanOverride(dateKey: string, routineDayId?: string): Promise<void> {
  const routine = await getActiveRoutine();
  if (!routine) return;

  const now = new Date().toISOString();
  const existing = await db.calendarPlanOverrides
    .where('date')
    .equals(dateKey)
    .filter((item) => item.routineId === routine.id)
    .first();

  await db.calendarPlanOverrides.put({
    id: existing?.id ?? `${routine.id}_${dateKey}`,
    date: dateKey,
    routineId: routine.id,
    routineDayId,
    isRestDay: !routineDayId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function clearCalendarPlanOverride(dateKey: string): Promise<void> {
  const routine = await getActiveRoutine();
  if (!routine) return;

  const existing = await db.calendarPlanOverrides
    .where('date')
    .equals(dateKey)
    .filter((item) => item.routineId === routine.id)
    .first();

  if (existing) await db.calendarPlanOverrides.delete(existing.id);
}

export async function getActiveRoutineDayPlans(): Promise<RoutineDayPlan[]> {
  const routine = await getActiveRoutine();
  if (!routine) return [];

  const days = await db.routineDays.where('routineId').equals(routine.id).sortBy('sequence');

  return Promise.all(
    days.map(async (routineDay) => {
      const plans = await db.routineExercisePlans.where('routineDayId').equals(routineDay.id).sortBy('order');
      const hydratedPlans = await Promise.all(
        plans.map(async (plan) => {
          const exercise = await db.exercises.get(plan.exerciseId);
          return exercise ? { plan, exercise } : undefined;
        }),
      );

      return {
        routineDay,
        plans: hydratedPlans.filter((item): item is { plan: RoutineExercisePlan; exercise: ExerciseMaster } => item !== undefined),
      };
    }),
  );
}

export async function activateRoutineTemplate(template: RoutineTemplate): Promise<Routine> {
  const now = new Date().toISOString();
  const routineId = `routine_${template.splitType}`;

  const routine: Routine = {
    id: routineId,
    name: template.name,
    splitType: template.splitType,
    startDate: formatDateKey(new Date()),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.routines, db.routineDays, db.routineExercisePlans, async () => {
    const routines = await db.routines.toArray();
    await db.routines.bulkPut(
      routines.map((existingRoutine) => ({
        ...existingRoutine,
        isActive: false,
        updatedAt: now,
      })),
    );

    await db.routines.put(routine);
    const routineDays: RoutineDay[] = template.days.map((dayName, index) => ({
        id: `${routineId}_day_${index + 1}`,
        routineId,
        code: dayName.toLowerCase().replace(/\s+/g, '_'),
        name: dayName,
        sequence: index + 1,
      }));

    await db.routineDays.bulkPut(routineDays);

    const existingPlanCount = await db.routineExercisePlans
      .where('routineDayId')
      .anyOf(routineDays.map((routineDay) => routineDay.id))
      .count();

    if (existingPlanCount === 0) {
      const templateExerciseIds = routineTemplateExerciseIds[template.splitType];
      const starterPlans = routineDays.flatMap((routineDay, dayIndex) => (
        (templateExerciseIds[dayIndex] ?? []).map((exerciseId, exerciseIndex) => ({
          id: `${routineDay.id}_${exerciseId}`,
          routineDayId: routineDay.id,
          exerciseId,
          order: exerciseIndex + 1,
          plannedSets: 3,
          plannedReps: exerciseId === 'joint_mobility' ? 12 : 10,
          plannedRir: 2,
        }))
      ));

      await db.routineExercisePlans.bulkPut(starterPlans);
    }
  });

  return routine;
}

export async function resetActiveRoutinePlansToTemplate(): Promise<void> {
  const [routine, days] = await Promise.all([getActiveRoutine(), getActiveRoutineDays()]);
  if (!routine || days.length === 0) return;

  const templateExerciseIds = routineTemplateExerciseIds[routine.splitType];
  if (!templateExerciseIds) return;

  await db.transaction('rw', db.routineExercisePlans, async () => {
    for (const [dayIndex, routineDay] of days.entries()) {
      await db.routineExercisePlans.where('routineDayId').equals(routineDay.id).delete();
      await db.routineExercisePlans.bulkPut(
        (templateExerciseIds[dayIndex] ?? []).map((exerciseId, exerciseIndex) => ({
          id: `${routineDay.id}_${exerciseId}`,
          routineDayId: routineDay.id,
          exerciseId,
          order: exerciseIndex + 1,
          plannedSets: 3,
          plannedReps: exerciseId === 'joint_mobility' ? 12 : 10,
          plannedRir: 2,
        })),
      );
    }
  });
}

export async function ensureActiveRoutineTemplateVersion(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const routine = await getActiveRoutine();
  if (!routine) return;

  const templateVersion = 'upper-lower-muscle-groups-v2';
  const storageKey = `setgo-routine-template-version:${routine.id}`;
  if (localStorage.getItem(storageKey) === templateVersion) return;

  await resetActiveRoutinePlansToTemplate();
  localStorage.setItem(storageKey, templateVersion);
}

export async function addExerciseToRoutineDay(routineDayId: string, exerciseId: string): Promise<void> {
  const existing = await db.routineExercisePlans
    .where('routineDayId')
    .equals(routineDayId)
    .filter((plan) => plan.exerciseId === exerciseId)
    .first();

  if (existing) return;

  const order = await db.routineExercisePlans.where('routineDayId').equals(routineDayId).count() + 1;

  await db.routineExercisePlans.put({
    id: `${routineDayId}_${exerciseId}_${Date.now()}`,
    routineDayId,
    exerciseId,
    order,
    plannedSets: 3,
    plannedReps: 10,
    plannedRir: 2,
  });
}

export async function updateActiveRoutineName(name: string): Promise<void> {
  const routine = await getActiveRoutine();
  const trimmedName = name.trim();
  if (!routine || !trimmedName) return;

  await db.routines.update(routine.id, {
    name: trimmedName,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateRoutineDayName(routineDayId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  await db.routineDays.update(routineDayId, {
    name: trimmedName,
    code: trimmedName.toLowerCase().replace(/\s+/g, '_'),
  });
}

export async function moveRoutineExercisePlan(planId: string, direction: -1 | 1): Promise<void> {
  const plan = await db.routineExercisePlans.get(planId);
  if (!plan) return;

  const plans = await db.routineExercisePlans.where('routineDayId').equals(plan.routineDayId).sortBy('order');
  const index = plans.findIndex((item) => item.id === planId);
  const target = plans[index + direction];

  if (index < 0 || !target) return;

  await db.transaction('rw', db.routineExercisePlans, async () => {
    await db.routineExercisePlans.update(plan.id, { order: target.order });
    await db.routineExercisePlans.update(target.id, { order: plan.order });
  });
}

export async function deleteRoutineExercisePlan(planId: string): Promise<void> {
  const plan = await db.routineExercisePlans.get(planId);
  if (!plan) return;

  await db.transaction('rw', db.routineExercisePlans, async () => {
    await db.routineExercisePlans.delete(planId);
    const remainingPlans = await db.routineExercisePlans.where('routineDayId').equals(plan.routineDayId).sortBy('order');
    await Promise.all(
      remainingPlans.map((remainingPlan, index) => db.routineExercisePlans.update(remainingPlan.id, { order: index + 1 })),
    );
  });
}

export async function updateRoutineExercisePlan(
  planId: string,
  values: Partial<Pick<RoutineExercisePlan, 'plannedSets' | 'plannedWeightKg' | 'plannedReps' | 'plannedRir'>>,
): Promise<void> {
  await db.routineExercisePlans.update(planId, values);
}
