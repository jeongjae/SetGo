import { db } from './db';
import type {
  CalendarPlanOverride,
  ExerciseMaster,
  Routine,
  RoutineCyclePlanItem,
  RoutineDay,
  RoutineExercisePlan,
  RoutineSplitType,
  Weekday,
  WeeklySchedule,
  WorkoutPlanKind,
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
  {
    splitType: 'full_body_3',
    name: '3-Day Full Body Starter',
    nameKo: '주 3회 입문자 무분할 루틴',
    days: ['Full Body'],
    dayDescriptions: ['Squat / Bench / Lat Pulldown / Press / Curl / Plank'],
    dayDescriptionsKo: ['전신: 스쿼트 / 벤치 / 랫풀다운 / 밀프 / 컬 / 플랭크'],
  },
  {
    splitType: 'classic_5',
    name: 'Classic 5-Day Bodypart Split',
    nameKo: '전통 5분할 루틴 (가슴/등/하체/어깨/팔)',
    days: ['Chest Focus', 'Back Focus', 'Legs Focus', 'Shoulders Focus', 'Arms Focus'],
    dayDescriptions: ['Chest focus', 'Back focus', 'Legs focus', 'Shoulders focus', 'Arms focus'],
    dayDescriptionsKo: ['가슴: 대흉근 융단폭격', '등: 광배근/등 전체 집중', '하체: 대퇴사두/햄스트링/종아리', '어깨: 삼각근 전측후면 타겟', '팔: 이두/삼두 슈퍼세트/동시훈련'],
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
  full_body_3: [
    ['barbell_squat', 'bench_press', 'lat_pulldown', 'military_press', 'barbell_curl', 'plank'],
  ],
  classic_5: [
    ['bench_press', 'incline_bench_press', 'dumbbell_fly', 'peck_deck_fly', 'dips'],
    ['pull_up', 'lat_pulldown', 'barbell_row', 'seated_cable_row', 'deadlift'],
    ['barbell_squat', 'leg_press', 'leg_extension', 'lying_leg_curl', 'calf_raise'],
    ['military_press', 'shoulder_press', 'side_lateral_raise', 'bentover_lateral_raise', 'face_pull'],
    ['barbell_curl', 'cable_pushdown', 'dumbbell_curl', 'lying_triceps_extension', 'hammer_curl', 'overhead_triceps_extension'],
  ],
  custom: [],
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
    'Full Body': '전신',
    'Chest Focus': '가슴',
    'Back Focus': '등',
    'Legs Focus': '하체',
    'Shoulders Focus': '어깨',
    'Arms Focus': '팔',
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

export type RoutineCyclePlanView = {
  id?: string;
  order: number;
  kind: WorkoutPlanKind;
  routineDayId?: string;
};

export type RoutineScheduleForDate = {
  schedule?: WeeklyScheduleView;
  cycleItem?: RoutineCyclePlanItem;
  override?: CalendarPlanOverride;
  routineDay?: RoutineDay;
  kind: WorkoutPlanKind;
  isRestDay: boolean;
};

const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function diffDays(startDateKey: string, dateKey: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((parseDateKey(dateKey).getTime() - parseDateKey(startDateKey).getTime()) / msPerDay);
}

function normalizePlanKind(item: Pick<CalendarPlanOverride, 'kind' | 'routineDayId' | 'isRestDay'>): WorkoutPlanKind {
  if (item.kind) return item.kind;
  if (item.isRestDay || !item.routineDayId) return 'rest';
  return 'routine';
}

function normalizeCycleItem(
  item: RoutineCyclePlanView,
  routineId: string,
  index: number,
): RoutineCyclePlanItem {
  const order = index + 1;
  return {
    id: item.id ?? `${routineId}_cycle_${order}_${Date.now()}`,
    routineId,
    order,
    kind: item.kind,
    routineDayId: item.kind === 'routine' ? item.routineDayId : undefined,
  };
}

async function getCalendarPlanOverrideForRoutineDate(
  routineId: string,
  dateKey: string,
): Promise<CalendarPlanOverride | undefined> {
  try {
    return await db.calendarPlanOverrides
      .where('date')
      .equals(dateKey)
      .filter((item) => item.routineId === routineId)
      .first();
  } catch (error) {
    console.warn('Falling back to full calendar override scan for date lookup', error);
    return (await db.calendarPlanOverrides.toArray()).find((item) => (
      item.routineId === routineId && item.date === dateKey
    ));
  }
}

export async function getActiveRoutine() {
  return db.routines.filter((routine) => routine.isActive).first();
}

export async function getAllRoutines(): Promise<Routine[]> {
  return db.routines.toArray();
}

export async function getRoutineDays(routineId: string): Promise<RoutineDay[]> {
  return db.routineDays.where('routineId').equals(routineId).sortBy('sequence');
}

export function buildRoutineDuplicateRecords(
  sourceRoutine: Routine,
  sourceDays: RoutineDay[],
  sourcePlans: RoutineExercisePlan[],
  sourceCycleItems: RoutineCyclePlanItem[],
  sourceWeeklySchedules: WeeklySchedule[],
  nextRoutineId: string,
  now: string,
  name?: string,
): {
  routine: Routine;
  days: RoutineDay[];
  plans: RoutineExercisePlan[];
  cycleItems: RoutineCyclePlanItem[];
  weeklySchedules: WeeklySchedule[];
} {
  const dayIdBySourceId = new Map<string, string>();
  const routine: Routine = {
    ...sourceRoutine,
    id: nextRoutineId,
    name: name?.trim() || `${sourceRoutine.name} Copy`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const days: RoutineDay[] = sourceDays.map((day) => {
    const nextDayId = `${nextRoutineId}_${day.code || `day_${day.sequence}`}`;
    dayIdBySourceId.set(day.id, nextDayId);
    return {
      ...day,
      id: nextDayId,
      routineId: nextRoutineId,
    };
  });
  const plans: RoutineExercisePlan[] = sourcePlans.map((plan) => ({
    ...plan,
    id: `${dayIdBySourceId.get(plan.routineDayId) ?? nextRoutineId}_${plan.exerciseId}_${plan.order}`,
    routineDayId: dayIdBySourceId.get(plan.routineDayId) ?? plan.routineDayId,
  }));
  const cycleItems: RoutineCyclePlanItem[] = sourceCycleItems.map((item) => ({
    ...item,
    id: `${nextRoutineId}_cycle_${item.order}`,
    routineId: nextRoutineId,
    routineDayId: item.routineDayId ? dayIdBySourceId.get(item.routineDayId) : undefined,
  }));
  const weeklySchedules: WeeklySchedule[] = sourceWeeklySchedules.map((schedule) => ({
    ...schedule,
    id: `${nextRoutineId}_weekday_${schedule.weekday}`,
    routineId: nextRoutineId,
    routineDayId: schedule.routineDayId ? dayIdBySourceId.get(schedule.routineDayId) : undefined,
  }));

  return {
    routine,
    days,
    plans,
    cycleItems,
    weeklySchedules,
  };
}

export async function duplicateStoredRoutine(routineId: string, name?: string): Promise<Routine | undefined> {
  const sourceRoutine = await db.routines.get(routineId);
  if (!sourceRoutine) return undefined;

  const [sourceDays, sourceCycleItems, sourceWeeklySchedules] = await Promise.all([
    db.routineDays.where('routineId').equals(routineId).sortBy('sequence'),
    db.routineCyclePlanItems.where('routineId').equals(routineId).sortBy('order'),
    db.weeklySchedules.where('routineId').equals(routineId).toArray(),
  ]);
  const sourcePlans = sourceDays.length > 0
    ? await db.routineExercisePlans.where('routineDayId').anyOf(sourceDays.map((day) => day.id)).toArray()
    : [];

  const now = new Date().toISOString();
  const nextRoutineId = `routine_copy_${Date.now()}`;
  const duplicate = buildRoutineDuplicateRecords(
    sourceRoutine,
    sourceDays,
    sourcePlans,
    sourceCycleItems,
    sourceWeeklySchedules,
    nextRoutineId,
    now,
    name,
  );

  await db.transaction('rw', [db.routines, db.routineDays, db.routineExercisePlans, db.routineCyclePlanItems, db.weeklySchedules], async () => {
    const routines = await db.routines.toArray();
    await db.routines.bulkPut(routines.map((routine) => ({ ...routine, isActive: false, updatedAt: now })));
    await db.routines.put(duplicate.routine);
    if (duplicate.days.length > 0) await db.routineDays.bulkPut(duplicate.days);
    if (duplicate.plans.length > 0) await db.routineExercisePlans.bulkPut(duplicate.plans);
    if (duplicate.cycleItems.length > 0) await db.routineCyclePlanItems.bulkPut(duplicate.cycleItems);
    if (duplicate.weeklySchedules.length > 0) await db.weeklySchedules.bulkPut(duplicate.weeklySchedules);
  });

  return duplicate.routine;
}

export async function deleteStoredRoutine(routineId: string): Promise<void> {
  const routineToDelete = await db.routines.get(routineId);
  if (!routineToDelete) return;

  const days = await db.routineDays.where('routineId').equals(routineId).toArray();
  const dayIds = days.map((day) => day.id);

  await db.transaction('rw', [
    db.routines,
    db.routineDays,
    db.routineExercisePlans,
    db.routineCyclePlanItems,
    db.weeklySchedules,
    db.calendarPlanOverrides,
  ], async () => {
    if (dayIds.length > 0) {
      await db.routineExercisePlans.where('routineDayId').anyOf(dayIds).delete();
    }
    await db.routineDays.where('routineId').equals(routineId).delete();
    await db.routineCyclePlanItems.where('routineId').equals(routineId).delete();
    await db.weeklySchedules.where('routineId').equals(routineId).delete();
    await db.calendarPlanOverrides.where('routineId').equals(routineId).delete();
    await db.routines.delete(routineId);

    if (routineToDelete.isActive) {
      const remainingRoutines = await db.routines.toArray();
      const anotherRoutine = remainingRoutines.find((r) => r.id !== routineId);
      if (anotherRoutine) {
        await db.routines.update(anotherRoutine.id, {
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function activateStoredRoutine(routineId: string): Promise<void> {
  const now = new Date().toISOString();
  const routines = await db.routines.toArray();
  await db.routines.bulkPut(routines.map((routine) => ({
    ...routine,
    isActive: routine.id === routineId,
    updatedAt: now,
  })));
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

export async function saveWeeklySchedule(
  routineId: string,
  startDate: string,
  endDate: string,
  schedule: WeeklyScheduleView[],
): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction('rw', db.routines, db.weeklySchedules, async () => {
    const routines = await db.routines.toArray();
    await db.routines.bulkPut(routines.map((routine) => ({
      ...routine,
      isActive: routine.id === routineId,
      ...(routine.id === routineId ? { startDate, endDate } : {}),
      updatedAt: now,
    })));
    await db.weeklySchedules.where('routineId').equals(routineId).delete();
    await db.weeklySchedules.bulkPut(schedule.map((entry) => ({
      id: `${routineId}_weekday_${entry.weekday}`,
      routineId,
      weekday: entry.weekday,
      routineDayId: entry.routineDayId,
      isRestDay: entry.isRestDay,
    })));
  });
}

export async function getRoutineCyclePlan(routineId: string): Promise<RoutineCyclePlanItem[]> {
  return db.routineCyclePlanItems.where('routineId').equals(routineId).sortBy('order');
}

export async function getActiveRoutineCyclePlan(): Promise<RoutineCyclePlanItem[]> {
  const routine = await getActiveRoutine();
  return routine ? getRoutineCyclePlan(routine.id) : [];
}

export function getCyclePlanItemForDate(
  routine: Pick<Routine, 'startDate'> | undefined,
  cycleItems: RoutineCyclePlanItem[],
  dateKey: string,
): RoutineCyclePlanItem | undefined {
  if (!routine || cycleItems.length === 0) return undefined;

  const daysFromStart = diffDays(routine.startDate, dateKey);
  if (daysFromStart < 0) return undefined;

  return cycleItems[daysFromStart % cycleItems.length];
}

export async function saveRoutineCyclePlan(
  routineId: string,
  startDate: string,
  cycleItems: RoutineCyclePlanView[],
): Promise<void> {
  const now = new Date().toISOString();
  const normalizedItems = cycleItems
    .filter((item) => item.kind !== 'routine' || item.routineDayId)
    .map((item, index) => normalizeCycleItem(item, routineId, index));

  await db.transaction('rw', db.routines, db.routineCyclePlanItems, async () => {
    await db.routines.update(routineId, {
      startDate,
      endDate: undefined,
      updatedAt: now,
    });
    await db.routineCyclePlanItems.where('routineId').equals(routineId).delete();
    if (normalizedItems.length > 0) {
      await db.routineCyclePlanItems.bulkPut(normalizedItems);
    }
  });
}

export function buildCyclePlanPreview(
  routine: Pick<Routine, 'startDate'> | undefined,
  cycleItems: RoutineCyclePlanItem[],
  startDate: string,
  dayCount: number,
): Array<{ date: string; item?: RoutineCyclePlanItem }> {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = parseDateKey(startDate);
    date.setDate(date.getDate() + index);
    const dateKey = formatDateKey(date);
    return {
      date: dateKey,
      item: getCyclePlanItemForDate(routine ? { ...routine, startDate } : undefined, cycleItems, dateKey),
    };
  });
}

export function isRoutineScheduledForDate(
  routine: Pick<Routine, 'startDate' | 'endDate'> | undefined,
  dateKey: string,
): boolean {
  if (!routine) return false;
  if (dateKey < routine.startDate) return false;
  return !routine.endDate || dateKey <= routine.endDate;
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
  const [days, schedule, cycleItems] = await Promise.all([
    getActiveRoutineDays(),
    getActiveWeeklySchedule(),
    routine ? getRoutineCyclePlan(routine.id) : Promise.resolve([]),
  ]);
  const dateKey = formatDateKey(date);
  const override = routine
    ? await getCalendarPlanOverrideForRoutineDate(routine.id, dateKey)
    : undefined;

  if (override) {
    const kind = normalizePlanKind(override);
    const routineDay = override.routineDayId
      ? days.find((day) => day.id === override.routineDayId)
      : undefined;

    return {
      override,
      routineDay,
      kind,
      isRestDay: kind === 'rest' || (kind === 'routine' && !routineDay),
    };
  }

  if (!isRoutineScheduledForDate(routine, dateKey)) {
    return { kind: 'rest', isRestDay: true };
  }

  const cycleItem = getCyclePlanItemForDate(routine, cycleItems, dateKey);
  if (cycleItem) {
    const routineDay = cycleItem.routineDayId
      ? days.find((day) => day.id === cycleItem.routineDayId)
      : undefined;

    return {
      cycleItem,
      routineDay,
      kind: cycleItem.kind,
      isRestDay: cycleItem.kind === 'rest' || (cycleItem.kind === 'routine' && !routineDay),
    };
  }

  const todaySchedule = schedule.find((item) => item.weekday === date.getDay());

  if (!todaySchedule) {
    return {
      kind: 'rest',
      isRestDay: true,
    };
  }

  if (todaySchedule.isRestDay || !todaySchedule.routineDayId) {
    return {
      schedule: todaySchedule,
      kind: 'rest',
      isRestDay: true,
    };
  }

  const routineDay = days.find((day) => day.id === todaySchedule.routineDayId);

  return {
    schedule: todaySchedule,
    routineDay,
    kind: routineDay ? 'routine' : 'rest',
    isRestDay: !routineDay,
  };
}

export async function saveCalendarPlanOverride(
  dateKey: string,
  kindOrRoutineDayId?: WorkoutPlanKind | string,
  routineDayId?: string,
): Promise<void> {
  const routine = await getActiveRoutine();
  if (!routine) return;

  const now = new Date().toISOString();
  const existing = await getCalendarPlanOverrideForRoutineDate(routine.id, dateKey);
  const isExplicitKind = kindOrRoutineDayId === 'routine'
    || kindOrRoutineDayId === 'rest'
    || kindOrRoutineDayId === 'running'
    || kindOrRoutineDayId === 'free';
  const kind = isExplicitKind
    ? kindOrRoutineDayId
    : kindOrRoutineDayId ? 'routine' : 'rest';
  const nextRoutineDayId = kind === 'routine'
    ? (isExplicitKind ? routineDayId : kindOrRoutineDayId)
    : undefined;

  await db.calendarPlanOverrides.put({
    id: existing?.id ?? `${routine.id}_${dateKey}`,
    date: dateKey,
    routineId: routine.id,
    kind,
    routineDayId: nextRoutineDayId,
    isRestDay: kind === 'rest',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function clearCalendarPlanOverride(dateKey: string): Promise<void> {
  const routine = await getActiveRoutine();
  if (!routine) return;

  const existing = await getCalendarPlanOverrideForRoutineDate(routine.id, dateKey);

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
          plannedRestSeconds: 90,
        }))
      ));

      await db.routineExercisePlans.bulkPut(starterPlans);
    }
  });

  return routine;
}

export async function createCustomRoutine(name: string): Promise<Routine> {
  const now = new Date().toISOString();
  const routineId = `routine_custom_${Date.now()}`;
  const routine: Routine = {
    id: routineId,
    name: name.trim() || '나의 루틴',
    splitType: 'custom',
    startDate: formatDateKey(new Date()),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.routines, db.routineDays, async () => {
    const routines = await db.routines.toArray();
    await db.routines.bulkPut(routines.map((item) => ({ ...item, isActive: false, updatedAt: now })));
    await db.routines.put(routine);
    await db.routineDays.put({
      id: `${routineId}_day_1`,
      routineId,
      code: 'day_1',
      name: '운동 A',
      sequence: 1,
    });
  });

  return routine;
}

export async function createRoutineFromWorkoutSession(sessionId: string, name?: string): Promise<Routine | undefined> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return undefined;

  const workoutExercises = await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order');
  if (workoutExercises.length === 0) return undefined;

  const now = new Date().toISOString();
  const routineId = `routine_from_workout_${Date.now()}`;
  const routineDayId = `${routineId}_day_1`;
  const routine: Routine = {
    id: routineId,
    name: name?.trim() || `Workout ${session.date}`,
    splitType: 'custom',
    startDate: formatDateKey(new Date()),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const routineDay: RoutineDay = {
    id: routineDayId,
    routineId,
    code: 'day_1',
    name: session.date,
    sequence: 1,
  };

  const plans = await Promise.all(workoutExercises.map(async (workoutExercise, index): Promise<RoutineExercisePlan> => {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(workoutExercise.id).sortBy('setNo');
    const completedSets = sets.filter((set) => set.isCompleted);
    const sourceSets = completedSets.length > 0 ? completedSets : sets;
    const bestSet = sourceSets
      .slice()
      .sort((a, b) => (b.weightKg * b.reps) - (a.weightKg * a.reps))[0];

    return {
      id: `${routineDayId}_${workoutExercise.exerciseId}_${index + 1}`,
      routineDayId,
      exerciseId: workoutExercise.exerciseId,
      order: index + 1,
      plannedSets: Math.max(1, sourceSets.length || 3),
      plannedWeightKg: bestSet?.weightKg,
      plannedReps: bestSet?.reps || 10,
      plannedRir: bestSet?.rir,
      plannedRestSeconds: workoutExercise.restSeconds ?? 90,
      note: workoutExercise.memo,
    };
  }));

  await db.transaction('rw', db.routines, db.routineDays, db.routineExercisePlans, async () => {
    const routines = await db.routines.toArray();
    await db.routines.bulkPut(routines.map((item) => ({ ...item, isActive: false, updatedAt: now })));
    await db.routines.put(routine);
    await db.routineDays.put(routineDay);
    await db.routineExercisePlans.bulkPut(plans);
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
          plannedRestSeconds: 90,
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
    plannedRestSeconds: 90,
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
  values: Partial<Pick<RoutineExercisePlan, 'plannedSets' | 'plannedWeightKg' | 'plannedReps' | 'plannedRir' | 'plannedRestSeconds' | 'preferredWeightIncrementKg'>>,
): Promise<void> {
  await db.routineExercisePlans.update(planId, values);
}
