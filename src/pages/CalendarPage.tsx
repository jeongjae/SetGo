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
import { IOSPageHeader } from '../components/IosPrimitives';

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
  ko: ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function planKindLabel(kind: WorkoutPlanKind, locale: 'ko' | 'en') {
  if (kind === 'free') return locale === 'ko' ? '\uC790\uC720\uC6B4\uB3D9' : 'Free';
  if (kind === 'running') return locale === 'ko' ? '\uB7EC\uB2DD' : 'Running';
  if (kind === 'rest') return t(locale, 'rest');
  return locale === 'ko' ? '\uC6B4\uB3D9' : 'Workout';
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
  if (!dateKey) return new Date();
  const parsed = new Date(`${dateKey}T12:00:00`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
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
  if (isRunningOnlySummary(firstSummary)) return locale === 'ko' ? '\uB7EC\uB2DD' : 'Run';
  if (firstSummary.session.entryKind === 'free') return locale === 'ko' ? '\uC790\uC720\uC6B4\uB3D9' : 'Free';

  return getRoutineDayDisplayName(firstSummary.routineDay, locale)
    ?? firstSummary.routineName
    ?? (locale === 'ko' ? '\uC6B4\uB3D9' : 'Workout');
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
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    if (initialSelectedDateKey) {
      const parsed = new Date(`${initialSelectedDateKey}T12:00:00`);
      if (!isNaN(parsed.getTime())) return initialSelectedDateKey;
    }
    return todayKey;
  });
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

    const parsed = new Date(`${initialSelectedDateKey}T12:00:00`);
    if (!isNaN(parsed.getTime())) {
      setVisibleMonth(monthFromDate(parsed));
      setSelectedDateKey(initialSelectedDateKey);
    }
  }, [initialSelectedDateKey]);

  const getRoutineSummaryDescription = () => {
    if (!activeRoutine) return '';

    if (cycleItems.length > 0) {
      const cycleSequence = cycleItems
        .map((item) => {
          if (item.kind === 'rest') return t(locale, 'rest');
          if (item.kind === 'running') return locale === 'ko' ? '\uB7EC\uB2DD' : 'Running';
          if (item.kind === 'free') return locale === 'ko' ? '\uC790\uC720' : 'Free';
          const rDay = routineDays.find((d) => d.id === item.routineDayId);
          return rDay ? (getRoutineDayDisplayName(rDay, locale) ?? rDay.name) : (locale === 'ko' ? '\uB8E8\uD2F4' : 'Routine');
        })
        .join(' / ');
      return locale === 'ko'
        ? `${cycleItems.length}\uC77C \uC8FC\uAE30 \uC0AC\uC774\uD074: ${cycleSequence}`
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
            : (locale === 'ko' ? '\uC6B4\uB3D9' : 'Workout');
          return `${dayName}(${typeName})`;
        });
      if (activeDays.length > 0) {
        return locale === 'ko'
          ? `\uC8FC ${activeDays.length}\uD68C \uC6B4\uB3D9: ${activeDays.join(', ')}`
          : `${activeDays.length} workouts / week: ${activeDays.join(', ')}`;
      }
    }

    return locale === 'ko' ? '\uC77C\uC815 \uB610\uB294 \uC0AC\uC774\uD074\uC774 \uC544\uC9C1 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.' : 'No schedule or cycle set yet.';
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
    <section className="ios-page">
      <header className="shrink-0 px-0.5 pb-1 pt-1">
        <IOSPageHeader eyebrow={t(locale, 'planned')} title={t(locale, 'planCalendar')} />
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
        {/* Active Plan Summary */}
        {activeRoutine ? (
          <div className="ios-card flex flex-col gap-2 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">
              {locale === 'ko' ? '\uD65C\uC131 \uACC4\uD68D \uC694\uC57D' : 'Active Plan Summary'}
            </p>
            <div>
              <h3 className="text-lg font-black text-[#1C1C1E]">{activeRoutine.name}</h3>
              <div className="mt-1.5 rounded-xl bg-[#F2F2F7] px-3 py-2 text-xs font-medium leading-relaxed text-[#6E6E73]">
                {getRoutineSummaryDescription()}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D1D1D6] bg-white p-3.5 text-center text-xs text-[#8E8E93]">
            {locale === 'ko' ? '\uD65C\uC131\uD654\uB41C \uB8E8\uD2F4 \uD50C\uB79C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' : 'No active routine plan.'}
          </div>
        )}

        {/* Calendar area */}
        <section className="shrink-0 ios-card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/5 bg-white text-[#1C1C1E] shadow-sm transition-all active:scale-95 hover:bg-[#F2F2F7]"
            aria-label="Previous month"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <h2 className="text-base font-black text-[#1C1C1E]">{monthFormatter.format(visibleMonth)}</h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/5 bg-white text-[#1C1C1E] shadow-sm transition-all active:scale-95 hover:bg-[#F2F2F7]"
            aria-label="Next month"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-[#8E8E93]">
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
              cellStyle = 'bg-[#2EC4B6] border-transparent text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)] z-10';
            } else if (isToday) {
              cellStyle = 'bg-[#007AFF]/10 border-[#007AFF] text-[#007AFF] hover:bg-[#007AFF]/20';
            } else if (useActuals) {
              if (hasCompleted) {
                cellStyle = 'bg-[#FF9500]/10 border-transparent text-[#FF9500] hover:bg-[#FF9500]/20';
              } else if (hasInProgress) {
                cellStyle = 'bg-[#007AFF]/10 border-transparent text-[#007AFF] hover:bg-[#007AFF]/20';
              } else if (hasSkipped) {
                cellStyle = 'bg-[#FF3B30]/10 border-transparent text-[#FF3B30] hover:bg-[#FF3B30]/20';
              } else {
                cellStyle = 'bg-[#F2F2F7] border-transparent text-[#8E8E93] hover:bg-[#E5E5EA]';
              }
            } else {
              if (day.isCurrentMonth) {
                if (highlightsFuturePlan) {
                  cellStyle = 'bg-[#2EC4B6]/15 border-transparent text-[#159A91] hover:bg-[#2EC4B6]/25';
                } else {
                  cellStyle = 'bg-white border-[#E5E5EA] text-[#8E8E93] hover:bg-[#F2F2F7]';
                }
              } else {
                cellStyle = 'bg-transparent border-transparent text-[#D1D1D6] opacity-40';
              }
            }

            const borderDashed = (!useActuals && hasOverride && !isSelected && !isToday) ? ' border-dashed border-[#2EC4B6]' : '';
            const dayTextColor = isSelected ? 'text-white' : isToday ? 'text-[#007AFF]' : 'text-[#1C1C1E]';

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
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#2EC4B6]" />
                )}
                <div className={`flex w-full items-center justify-between ${dayTextColor}`}>
                  <span className="text-xs font-black">{day.date.getDate()}</span>
                  {useActuals && dayDistance > 0 ? <Footprints aria-hidden="true" size={13} /> : null}
                  {useActuals && dayDistance <= 0 && dayWorkoutSummaries.length > 0 ? <Dumbbell aria-hidden="true" size={13} /> : null}
                  {!useActuals && (displayKind === 'routine' || displayKind === 'free') ? <Dumbbell aria-hidden="true" size={13} /> : null}
                  {!useActuals && displayKind === 'running' ? <Footprints aria-hidden="true" size={13} /> : null}
                  {!useActuals && displayKind === 'rest' ? <Bed aria-hidden="true" size={13} /> : null}
                </div>
                {actualLabel ? (
                  <span className={`mt-0.5 truncate text-[11px] font-extrabold ${isSelected ? 'text-white' : 'text-[#1C1C1E]'}`}>
                    {actualLabel}
                  </span>
                ) : null}
                {displayKind ? (
                  <span className={`mt-0.5 truncate text-[11px] font-extrabold ${isSelected ? 'text-white/80' : 'text-[#6E6E73]'}`}>
                    {displayKind === 'routine' ? getRoutineDayDisplayName(dayPlan?.routineDay, locale) ?? planKindLabel(displayKind, locale) : planKindLabel(displayKind, locale)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#E5E5EA] pt-2.5 text-xs font-bold uppercase text-[#8E8E93]">
          <span className="flex items-center gap-1.5"><Dumbbell aria-hidden="true" size={13} />{locale === 'ko' ? '운동' : 'Workout'}</span>
          <span className="flex items-center gap-1.5"><Bed aria-hidden="true" size={13} />{t(locale, 'rest')}</span>
          <span className="flex items-center gap-1.5"><Footprints aria-hidden="true" size={13} />{locale === 'ko' ? '러닝' : 'Running'}</span>
        </div>
      </section>

        {/* Selected date details */}
      <section className="space-y-3 ios-card p-3.5">
        <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{t(locale, 'planDate')}</p>
            <h2 className="mt-0.5 text-base font-black text-[#1C1C1E]">{selectedDateKey}</h2>
          </div>
          {selectedDateKey !== todayKey ? (
            <button
              type="button"
              onClick={goToToday}
              className="ios-button-secondary min-h-8 px-3 text-xs font-bold"
            >
              {t(locale, 'backToToday')}
            </button>
          ) : null}
        </div>
        
        {canEditSelectedPlan ? (
          <div className="space-y-2.5">
            <p className="block text-xs font-bold text-[#6E6E73]">
              {locale === 'ko' ? '이 날짜의 운동계획 수정' : 'Modify plan for this date'}
            </p>
            {!activeRoutine ? (
              <div className="rounded-xl border border-dashed border-[#D1D1D6] p-3 text-center space-y-2.5 bg-white">
                <p className="text-xs text-[#8E8E93] font-bold leading-normal">
                  {locale === 'ko'
                    ? '\uD65C\uC131\uD654\uB41C \uB8E8\uD2F4\uC774 \uC5C6\uC5B4 \uC6B4\uB3D9 \uD50C\uB79C\uC744 \uC124\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'
                    : 'No active routine set. Workout plan settings are restricted.'}
                </p>
                {onNavigateToRoutines && (
                  <button
                    type="button"
                    onClick={onNavigateToRoutines}
                    className="ios-button-primary min-h-9 px-4 text-xs"
                  >
                    {locale === 'ko' ? '\uB8E8\uD2F4 \uC124\uC815\uC73C\uB85C \uAC00\uAE30' : 'Go to Routine Settings'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: '__cycle', label: locale === 'ko' ? '\uC0AC\uC774\uD074 \uB530\uB974\uAE30' : 'Follow Cycle', colorClass: 'border-[#D1D1D6] bg-white text-[#6E6E73] hover:bg-[#F2F2F7]' },
                  { value: 'rest', label: t(locale, 'rest'), colorClass: 'border-[#D1D1D6] bg-white text-[#6E6E73] hover:bg-[#F2F2F7]' },
                  { value: 'running', label: locale === 'ko' ? '\uB7EC\uB2DD' : 'Running', colorClass: 'border-[#007AFF]/20 bg-[#007AFF]/5 text-[#007AFF] hover:bg-[#007AFF]/15' },
                  { value: 'free', label: locale === 'ko' ? '\uC790\uC720' : 'Free', colorClass: 'border-[#5856D6]/20 bg-[#5856D6]/5 text-[#5856D6] hover:bg-[#5856D6]/15' },
                  ...routineDays.map(day => ({
                    value: `routine:${day.id}`,
                    label: getRoutineDayDisplayName(day, locale) ?? day.name,
                    colorClass: 'border-[#2EC4B6]/20 bg-[#2EC4B6]/5 text-[#159A91] hover:bg-[#2EC4B6]/15'
                  }))
                ].map((opt) => {
                  const active = selectedPlanValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => void handlePlanChange(opt.value)}
                      className={`min-h-10 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        active
                          ? 'border-transparent bg-[#2EC4B6] text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)]'
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
          <p className="rounded-xl bg-[#F2F2F7] px-3.5 py-3 text-xs font-medium leading-relaxed text-[#6E6E73]">
            {locale === 'ko'
              ? '\uC624\uB298 \uC774\uC804 \uB0A0\uC9DC\uB294 \uACC4\uD68D\uC774 \uC544\uB2C8\uB77C \uAE30\uB85D\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uACFC\uAC70 \uC6B4\uB3D9 \uAE30\uB85D \uC218\uC815\uC740 \uAE30\uB85D \uD0ED\uC5D0\uC11C \uCC98\uB9AC\uD569\uB2C8\uB2E4.'
              : 'Past dates show records, not plans. Use Records to edit historical workout records.'}
          </p>
        )}

        {!canEditSelectedPlan && onNavigateToRecords ? (
          <div className="rounded-xl border border-dashed border-[#D1D1D6] bg-white p-3 text-center space-y-2.5">
            <p className="text-xs text-[#8E8E93] font-bold leading-relaxed">
              {locale === 'ko'
                ? '\uACFC\uAC70 \uC6B4\uB3D9 \uAE30\uB85D \uCD94\uAC00, \uC218\uC815, \uC0AD\uC81C\uB294 \uAE30\uB85D \uD0ED\uC5D0\uC11C \uAD00\uB9AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
                : 'Historical workout logging, edits, and deletions are managed in the Records tab.'}
            </p>
            <button
              type="button"
              onClick={onNavigateToRecords}
              className="ios-button-primary min-h-9 px-4 text-xs"
            >
              {locale === 'ko' ? '\uAE30\uB85D \uD0ED\uC73C\uB85C \uAC00\uAE30' : 'Go to Records Tab'}
            </button>
          </div>
        ) : null}
        <p className="rounded-xl bg-[#F2F2F7] px-3.5 py-3 text-xs font-medium leading-relaxed text-[#6E6E73]">
          {locale === 'ko'
            ? '\uC774 \uD654\uBA74\uC5D0\uC11C\uB294 \uACC4\uD68D\uB9CC \uC218\uC815\uD569\uB2C8\uB2E4. \uB204\uB77D \uAE30\uB85D \uCD94\uAC00\uC640 \uACFC\uAC70 \uAE30\uB85D \uC218\uC815/\uC0AD\uC81C\uB294 \uAE30\uB85D \uD0ED\uC5D0\uC11C \uCC98\uB9AC\uD569\uB2C8\uB2E4.'
            : 'This screen only edits plans. Use Records to add missing records or edit/delete past workouts.'}
        </p>
      </section>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-[#E5E5EA] pt-2.5">
        {reviewingWeeklyPlan ? (
          <button
            type="button"
            onClick={onReturnToWeeklyPlan}
            className="ios-button-secondary flex min-h-11 w-full items-center justify-center px-3 text-sm"
          >
            {locale === 'ko' ? '\uC6B4\uB3D9\uACC4\uD68D\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30' : 'Return to workout plan'}
          </button>
        ) : null}
      </footer>
    </section>
  );
}


