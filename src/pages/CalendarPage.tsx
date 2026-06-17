import { Bed, ChevronLeft, ChevronRight, Dumbbell, Footprints, Play, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  clearCalendarPlanOverride,
  getActiveRoutine,
  getCyclePlanItemForDate,
  getRoutineCyclePlan,
  getActiveRoutineDays,
  getActiveWeeklySchedule,
  isRoutineScheduledForDate,
  getRoutineDayDisplayName,
  saveCalendarPlanOverride,
  type WeeklyScheduleView,
} from '../db/routines';
import { getWorkoutSummariesForDateRange, type WorkoutSummary } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { db } from '../db/db';
import { getStoredLocale, t } from '../i18n/i18n';
import type { CalendarPlanOverride, CardioRecord, RoutineDay, WorkoutPlanKind, WorkoutSessionKind, Routine, RoutineCyclePlanItem } from '../types';

type CalendarPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  reviewingWeeklyPlan?: boolean;
  onReturnToWeeklyPlan?: () => void;
  onNavigateToRecords?: () => void;
  onNavigateToRoutines?: () => void;
};

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
};

type CalendarPlan = {
  date: string;
  routineDay?: RoutineDay;
  kind: WorkoutPlanKind;
};

const weekdayLabels = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function planKindLabel(kind: WorkoutPlanKind, locale: 'ko' | 'en') {
  if (kind === 'free') return locale === 'ko' ? '자유운동' : 'Free';
  if (kind === 'running') return locale === 'ko' ? '러닝' : 'Running';
  if (kind === 'rest') return t(locale, 'rest');
  return locale === 'ko' ? '운동' : 'Workout';
}

function buildCalendarDays(year: number, monthIndex: number): CalendarDay[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startDate = new Date(year, monthIndex, 1 - firstDay.getDay());
  const totalCells = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      key: formatDateKey(date),
      isCurrentMonth: date.getMonth() === monthIndex,
    };
  });
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function monthFromDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getOverrideKind(override: CalendarPlanOverride): WorkoutPlanKind {
  if (override.kind) return override.kind;
  if (override.isRestDay || !override.routineDayId) return 'rest';
  return 'routine';
}

export function shouldShowCalendarPlanIndicator(
  isCurrentMonth: boolean,
  hasPlan: boolean,
  hasWorkoutSummaries: boolean,
  reviewingWeeklyPlan: boolean,
): boolean {
  return isCurrentMonth && hasPlan && (reviewingWeeklyPlan || !hasWorkoutSummaries);
}

export function shouldUseActualsInPlanCalendar(dateKey: string, todayKey: string): boolean {
  return dateKey < todayKey;
}

export function canEditCalendarPlan(dateKey: string, todayKey: string): boolean {
  return dateKey >= todayKey;
}

function summarizeCardioDistance(records: CardioRecord[]): number {
  return records
    .filter((record) => record.isDraft !== true)
    .reduce((sum, record) => sum + (record.distanceKm ?? 0), 0);
}

function isRunningOnlySummary(summary: WorkoutSummary): boolean {
  return summary.session.entryKind === 'running'
    || (
      summary.cardioCount > 0
      && summary.exerciseCount === 0
      && summary.session.totalStrengthVolumeKg === 0
    );
}

function actualSummaryLabel(summaries: WorkoutSummary[], locale: 'ko' | 'en'): string | undefined {
  const firstSummary = summaries[0];
  if (!firstSummary) return undefined;
  if (isRunningOnlySummary(firstSummary)) return locale === 'ko' ? '러닝' : 'Run';
  if (firstSummary.session.entryKind === 'free') return locale === 'ko' ? '자유운동' : 'Free';

  return getRoutineDayDisplayName(firstSummary.routineDay, locale)
    ?? firstSummary.routineName
    ?? (locale === 'ko' ? '운동' : 'Workout');
}

export function CalendarPage({
  initialSelectedDateKey,
  onSelectedDateChange,
  reviewingWeeklyPlan = false,
  onReturnToWeeklyPlan,
  onNavigateToRecords,
  onNavigateToRoutines,
}: CalendarPageProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => (
    monthFromDate(initialSelectedDateKey ? dateFromKey(initialSelectedDateKey) : today)
  ));
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([]);
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [overridesByDate, setOverridesByDate] = useState<Record<string, CalendarPlanOverride>>({});
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [cycleItems, setCycleItems] = useState<RoutineCyclePlanItem[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleView[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedDateKey ?? todayKey);
  const [reloadKey, setReloadKey] = useState(0);
  const [locale] = useState(() => getStoredLocale());
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }), [locale]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );

  const plansByDate = useMemo(() => {
    return plans.reduce<Record<string, CalendarPlan>>((byDate, plan) => {
      byDate[plan.date] = plan;
      return byDate;
    }, {});
  }, [plans]);

  const workoutSummariesByDate = useMemo(() => {
    return workoutSummaries.reduce<Record<string, WorkoutSummary[]>>((byDate, summary) => {
      byDate[summary.session.date] = [...(byDate[summary.session.date] ?? []), summary];
      return byDate;
    }, {});
  }, [workoutSummaries]);

  const cardioBySessionId = useMemo(() => {
    return cardioRecords.reduce<Record<string, CardioRecord[]>>((bySession, record) => {
      bySession[record.sessionId] = [...(bySession[record.sessionId] ?? []), record];
      return bySession;
    }, {});
  }, [cardioRecords]);

  useEffect(() => {
    async function loadMonth() {
      const activeRoutine = await getActiveRoutine();
      const startKey = calendarDays[0]?.key ?? formatDateKey(visibleMonth);
      const endKey = calendarDays[calendarDays.length - 1]?.key ?? formatDateKey(visibleMonth);
      const [schedule, cycleItems, loadedRoutineDays, overrides, loadedWorkoutSummaries] = await Promise.all([
        getActiveWeeklySchedule(),
        activeRoutine ? getRoutineCyclePlan(activeRoutine.id) : [],
        getActiveRoutineDays(),
        activeRoutine ? db.calendarPlanOverrides.where('routineId').equals(activeRoutine.id).toArray() : [],
        getWorkoutSummariesForDateRange(startKey, endKey),
      ]);
      const sessionIds = new Set(loadedWorkoutSummaries.map((summary) => summary.session.id));
      const loadedCardioRecords = (await db.cardioRecords.toArray())
        .filter((record) => sessionIds.has(record.sessionId));

      const routineDayById = new Map(loadedRoutineDays.map((routineDay) => [routineDay.id, routineDay]));
      const overridesByDateMap = overrides.reduce<Record<string, CalendarPlanOverride>>((byDate, override) => {
        byDate[override.date] = override;
        return byDate;
      }, {});
      const plannedDays = buildCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth())
        .filter((day) => day.isCurrentMonth)
        .flatMap((day) => {
          const override = overridesByDateMap[day.key];
          if (override) {
            const kind = getOverrideKind(override);
            const routineDay = override.routineDayId ? routineDayById.get(override.routineDayId) : undefined;

            return [{
              date: day.key,
              kind,
              routineDay,
            } satisfies CalendarPlan];
          }

          if (!isRoutineScheduledForDate(activeRoutine, day.key)) return [];

          const cycleItem = getCyclePlanItemForDate(activeRoutine, cycleItems, day.key);
          if (cycleItem) {
            return [{
              date: day.key,
              kind: cycleItem.kind,
              routineDay: cycleItem.routineDayId ? routineDayById.get(cycleItem.routineDayId) : undefined,
            } satisfies CalendarPlan];
          }

          const daySchedule = schedule.find((item) => item.weekday === day.date.getDay());
          if (!daySchedule || daySchedule.isRestDay || !daySchedule.routineDayId) return [];

          return [{
            date: day.key,
            routineDay: routineDayById.get(daySchedule.routineDayId),
            kind: 'routine',
          } satisfies CalendarPlan];
        });

      setRoutineDays(loadedRoutineDays);
      setOverridesByDate(overridesByDateMap);
      setPlans(plannedDays);
      setWorkoutSummaries(loadedWorkoutSummaries);
      setCardioRecords(loadedCardioRecords);
      setActiveRoutine(activeRoutine);
      setCycleItems(cycleItems);
      setWeeklySchedule(schedule);
    }

    void loadMonth();
  }, [calendarDays, reloadKey, todayKey, visibleMonth]);

  function changeMonth(direction: -1 | 1) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    onSelectedDateChange?.(dateKey);
  }

  function goToToday() {
    setVisibleMonth(monthFromDate(today));
    selectDate(todayKey);
  }

  async function handlePlanChange(value: string) {
    if (!canEditCalendarPlan(selectedDateKey, todayKey)) return;

    if (value === '__cycle') {
      await clearCalendarPlanOverride(selectedDateKey);
    } else if (value === 'rest' || value === 'running' || value === 'free') {
      await saveCalendarPlanOverride(selectedDateKey, value);
    } else {
      await saveCalendarPlanOverride(selectedDateKey, 'routine', value.replace(/^routine:/, ''));
    }

    setReloadKey((current) => current + 1);
  }

  useEffect(() => {
    if (!initialSelectedDateKey) return;

    const initialDate = dateFromKey(initialSelectedDateKey);
    setVisibleMonth(monthFromDate(initialDate));
    setSelectedDateKey(initialSelectedDateKey);
  }, [initialSelectedDateKey]);

  const getRoutineSummaryDescription = () => {
    if (!activeRoutine) return '';

    if (cycleItems.length > 0) {
      const cycleSequence = cycleItems
        .map((item) => {
          if (item.kind === 'rest') return t(locale, 'rest');
          if (item.kind === 'running') return locale === 'ko' ? '러닝' : 'Running';
          if (item.kind === 'free') return locale === 'ko' ? '자유' : 'Free';
          const rDay = routineDays.find((d) => d.id === item.routineDayId);
          return rDay ? (getRoutineDayDisplayName(rDay, locale) ?? rDay.name) : (locale === 'ko' ? '루틴' : 'Routine');
        })
        .join(' → ');
      return locale === 'ko'
        ? `${cycleItems.length}일 주기 사이클: ${cycleSequence}`
        : `${cycleItems.length}-day cycle: ${cycleSequence}`;
    }

    if (weeklySchedule.length > 0) {
      const activeDays = weeklySchedule
        .filter((w) => !w.isRestDay)
        .map((w) => {
          const rDay = routineDays.find((d) => d.id === w.routineDayId);
          const dayName = weekdayLabels[locale as 'ko' | 'en'][w.weekday];
          const typeName = rDay
            ? (getRoutineDayDisplayName(rDay, locale) ?? rDay.name)
            : (locale === 'ko' ? '운동' : 'Workout');
          return `${dayName}(${typeName})`;
        });
      if (activeDays.length > 0) {
        return locale === 'ko'
          ? `주 ${activeDays.length}회 운동: ${activeDays.join(', ')}`
          : `${activeDays.length} workouts / week: ${activeDays.join(', ')}`;
      }
    }

    return locale === 'ko' ? '일정 또는 사이클이 아직 설정되지 않았습니다.' : 'No schedule or cycle set yet.';
  };

  const selectedOverride = overridesByDate[selectedDateKey];
  const selectedPlan = plansByDate[selectedDateKey];
  const canEditSelectedPlan = canEditCalendarPlan(selectedDateKey, todayKey);
  const canAddSelectedDateWorkout = selectedDateKey <= todayKey;
  const selectedWorkoutSummaries = workoutSummariesByDate[selectedDateKey] ?? [];
  const selectedRoutineDayForStart = selectedPlan?.kind === 'routine' ? selectedPlan.routineDay : undefined;
  const selectedCyclePlanValue = selectedPlan
    ? selectedPlan.kind === 'routine'
      ? `routine:${selectedPlan.routineDay?.id ?? ''}`
      : selectedPlan.kind
    : '__none';
  const selectedPlanValue = selectedOverride
    ? getOverrideKind(selectedOverride) === 'routine'
        ? `routine:${selectedOverride.routineDayId ?? ''}`
        : getOverrideKind(selectedOverride)
    : selectedCyclePlanValue;

  return (
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <div>
          <p className="text-xs font-extrabold uppercase text-cyan-300">{t(locale, 'planned')}</p>
          <h1 className="text-xl font-black text-slate-100">{t(locale, 'planCalendar')}</h1>
        </div>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
        {/* Active Plan Summary */}
        {activeRoutine ? (
          <div className="rounded-2xl border border-slate-650 bg-slate-750/60 p-3.5 text-xs space-y-1 text-slate-300">
            <p className="font-extrabold text-cyan-300 uppercase tracking-wider text-[10px]">
              {locale === 'ko' ? '활성 계획 요약' : 'Active Plan Summary'}
            </p>
            <div>
              <h3 className="font-black text-slate-100 text-sm">{activeRoutine.name}</h3>
              <p className="mt-1 text-slate-400 font-medium leading-relaxed">
                {getRoutineSummaryDescription()}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-600 p-3.5 text-center text-xs text-slate-400">
            {locale === 'ko' ? '활성화된 루틴 플랜이 없습니다.' : 'No active routine plan.'}
          </div>
        )}

        {/* 달력 영역 */}
        <section className="shrink-0 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-slate-100 transition-all hover:bg-slate-700 hover:text-slate-100 active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <h2 className="text-base font-black text-slate-100">{monthFormatter.format(visibleMonth)}</h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-slate-100 transition-all hover:bg-slate-700 hover:text-slate-100 active:scale-95"
            aria-label="Next month"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-7 gap-1 text-center text-xs font-black uppercase text-slate-200">
          {weekdayLabels[locale].map((weekday) => (
            <div key={weekday}>{weekday}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayPlan = plansByDate[day.key];
            const dayWorkoutSummaries = workoutSummariesByDate[day.key] ?? [];
            const useActuals = shouldUseActualsInPlanCalendar(day.key, todayKey);
            const displayKind: WorkoutPlanKind | undefined = useActuals
              ? undefined
              : dayPlan?.kind ?? (day.isCurrentMonth ? 'rest' : undefined);
            const highlightsFuturePlan = Boolean(displayKind && displayKind !== 'rest');
            const hasCompleted = dayWorkoutSummaries.some((summary) => summary.session.status === 'completed');
            const hasInProgress = dayWorkoutSummaries.some((summary) => summary.session.status === 'in_progress');
            const hasSkipped = dayWorkoutSummaries.some((summary) => summary.session.status === 'skipped');
            const dayDistance = dayWorkoutSummaries.reduce((sum, summary) => (
              sum + summarizeCardioDistance(cardioBySessionId[summary.session.id] ?? [])
            ), 0);
            const actualLabel = useActuals ? actualSummaryLabel(dayWorkoutSummaries, locale) : undefined;

            const isSelected = selectedDateKey === day.key;
            const isToday = day.key === todayKey;
            const hasOverride = Boolean(overridesByDate[day.key]);

            let cellStyle = '';
            if (isSelected) {
              cellStyle = 'bg-emerald-600/95 border-emerald-400 text-slate-100 ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.3)] z-10';
            } else if (isToday) {
              cellStyle = 'bg-cyan-950/90 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/30 hover:bg-cyan-900/90';
            } else if (useActuals) {
              if (hasCompleted) {
                cellStyle = 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30';
              } else if (hasInProgress) {
                cellStyle = 'bg-blue-500/20 border-blue-500/60 text-blue-300 hover:bg-blue-500/30';
              } else if (hasSkipped) {
                cellStyle = 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20';
              } else {
                cellStyle = 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-850/50';
              }
            } else {
              if (day.isCurrentMonth) {
                if (highlightsFuturePlan) {
                  cellStyle = 'bg-sky-200 border-sky-400 text-black hover:bg-sky-300';
                } else {
                  cellStyle = 'bg-slate-850/80 border-slate-750 text-slate-300 hover:bg-slate-800';
                }
              } else {
                cellStyle = 'bg-slate-900/30 border-transparent text-slate-650';
              }
            }

            const borderDashed = (!useActuals && hasOverride && !isSelected && !isToday) ? ' border-dashed border-sky-400/80' : '';
            const todayOutline = '';

            return (
              <button
                type="button"
                key={day.key}
                onClick={() => selectDate(day.key)}
                aria-label={`${day.key} ${actualLabel ?? (displayKind ? planKindLabel(displayKind, locale) : '')}`.trim()}
                className={`relative flex aspect-square min-h-12 flex-col rounded-xl p-1.5 border transition-all duration-200 active:scale-95 ${cellStyle}${borderDashed}`}
              >
                {/* Override dot indicator */}
                {!useActuals && hasOverride && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                )}
                <div className="flex w-full items-center justify-between text-primary">
                  <span className="text-xs font-black text-primary">{day.date.getDate()}</span>
                  {useActuals && dayDistance > 0 ? <Footprints aria-hidden="true" size={13} /> : null}
                  {useActuals && dayDistance <= 0 && dayWorkoutSummaries.length > 0 ? <Dumbbell aria-hidden="true" size={13} /> : null}
                  {!useActuals && (displayKind === 'routine' || displayKind === 'free') ? <Dumbbell aria-hidden="true" size={13} /> : null}
                  {!useActuals && displayKind === 'running' ? <Footprints aria-hidden="true" size={13} /> : null}
                  {!useActuals && displayKind === 'rest' ? <Bed aria-hidden="true" size={13} /> : null}
                </div>
                {actualLabel ? (
                  <span className="mt-0.5 truncate text-[11px] font-extrabold text-black">
                    {actualLabel}
                  </span>
                ) : null}
                {displayKind ? (
                  <span className="mt-0.5 truncate text-[11px] font-extrabold text-primary">
                    {displayKind === 'routine' ? getRoutineDayDisplayName(dayPlan?.routineDay, locale) ?? planKindLabel(displayKind, locale) : planKindLabel(displayKind, locale)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-650 pt-2.5 text-xs font-black uppercase text-slate-100">
          <span className="flex items-center gap-1.5"><Dumbbell aria-hidden="true" size={13} />{locale === 'ko' ? '운동' : 'Workout'}</span>
          <span className="flex items-center gap-1.5"><Bed aria-hidden="true" size={13} />{t(locale, 'rest')}</span>
          <span className="flex items-center gap-1.5"><Footprints aria-hidden="true" size={13} />{locale === 'ko' ? '러닝' : 'Running'}</span>
        </div>
      </section>

        {/* Selected date details */}
      <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-650 pb-2">
          <div>
            <p className="text-xs font-black uppercase text-slate-200">{t(locale, 'planDate')}</p>
            <h2 className="mt-0.5 text-base font-black text-slate-100">{selectedDateKey}</h2>
          </div>
          {selectedDateKey !== todayKey ? (
            <button
              type="button"
              onClick={goToToday}
              className="min-h-8 rounded-lg border border-slate-650 bg-slate-850 px-3 text-xs font-bold text-slate-100 transition-all hover:bg-slate-700 active:scale-95"
            >
              {t(locale, 'backToToday')}
            </button>
          ) : null}
        </div>
        
        {canEditSelectedPlan ? (
          <div className="space-y-2">
            <p className="block text-xs font-extrabold text-slate-200">
              {locale === 'ko' ? '이 날짜의 운동계획 수정' : 'Modify plan for this date'}
            </p>
            {!activeRoutine ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-center space-y-2.5">
                <p className="text-xs text-slate-400 font-bold leading-normal">
                  {locale === 'ko'
                    ? '활성화된 루틴이 없어 운동 플랜을 설정할 수 없습니다.'
                    : 'No active routine set. Workout plan settings are restricted.'}
                </p>
                {onNavigateToRoutines && (
                  <button
                    type="button"
                    onClick={onNavigateToRoutines}
                    className="min-h-9 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md"
                  >
                    {locale === 'ko' ? '루틴 설정하러 가기' : 'Go to Routine Settings'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: '__cycle', label: locale === 'ko' ? '사이클 따르기' : 'Follow Cycle', colorClass: 'border-slate-650 bg-slate-850 text-slate-350 active:bg-slate-850' },
                  { value: 'rest', label: t(locale, 'rest'), colorClass: 'border-slate-650 bg-slate-850/50 text-slate-300 active:bg-slate-800' },
                  { value: 'running', label: locale === 'ko' ? '러닝' : 'Running', colorClass: 'border-sky-500/25 bg-sky-950/20 text-sky-300 active:bg-sky-900/35' },
                  { value: 'free', label: locale === 'ko' ? '자유' : 'Free', colorClass: 'border-slate-650 bg-slate-850 text-slate-100 active:bg-slate-800' },
                  ...routineDays.map(day => ({
                    value: `routine:${day.id}`,
                    label: getRoutineDayDisplayName(day, locale) ?? day.name,
                    colorClass: 'border-cyan-500/25 bg-cyan-950/20 text-cyan-300 active:bg-cyan-900/35'
                  }))
                ].map((opt) => {
                  const active = selectedPlanValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => void handlePlanChange(opt.value)}
                      className={`min-h-10 px-3.5 py-1.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${
                        active
                          ? 'bg-sky-200 border-sky-400 text-black shadow-sm'
                          : `${opt.colorClass}`
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-650 bg-slate-850/75 px-3 py-2.5 text-xs font-bold leading-relaxed text-slate-200">
            {locale === 'ko'
              ? '오늘 이전 날짜는 계획이 아니라 기록을 표시합니다. 과거 운동 기록 수정은 기록 탭에서 처리합니다.'
              : 'Past dates show records, not plans. Use Records to edit historical workout records.'}
          </p>
        )}

        {!canEditSelectedPlan && onNavigateToRecords ? (
          <div className="rounded-xl border border-slate-650 bg-slate-850/50 p-3 text-center space-y-2.5">
            <p className="text-xs text-slate-350 font-bold leading-relaxed">
              {locale === 'ko'
                ? '과거 운동 기록의 추가, 수정, 삭제는 기록 탭에서 관리할 수 있습니다.'
                : 'Historical workout logging, edits, and deletions are managed in the Records tab.'}
            </p>
            <button
              type="button"
              onClick={onNavigateToRecords}
              className="min-h-9 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md"
            >
              {locale === 'ko' ? '기록 탭으로 가기' : 'Go to Records Tab'}
            </button>
          </div>
        ) : null}
        <p className="rounded-xl border border-slate-650 bg-slate-850/75 px-3 py-2.5 text-xs font-bold leading-relaxed text-slate-200">
          {locale === 'ko'
            ? '이 화면에서는 계획만 수정합니다. 누락 기록 추가와 과거 기록 수정/삭제는 기록 탭에서 처리합니다.'
            : 'This screen only edits plans. Use Records to add missing records or edit/delete past workouts.'}
        </p>
      </section>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-slate-650 pt-2.5">
        {reviewingWeeklyPlan ? (
          <button
            type="button"
            onClick={onReturnToWeeklyPlan}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-850 px-3 text-sm font-bold text-cyan-300"
          >
            {locale === 'ko' ? '운동계획으로 돌아가기' : 'Return to workout plan'}
          </button>
        ) : null}
      </footer>
    </section>
  );
}


