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
} from '../db/routines';
import { getWorkoutSummariesForDateRange, type WorkoutSummary } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { db } from '../db/db';
import { getStoredLocale, t } from '../i18n/i18n';
import type { CalendarPlanOverride, CardioRecord, RoutineDay, WorkoutPlanKind, WorkoutSessionKind } from '../types';

type CalendarPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  reviewingWeeklyPlan?: boolean;
  onReturnToWeeklyPlan?: () => void;
  onAddWorkoutForDate?: (dateKey: string, kind: WorkoutSessionKind, routineDayId?: string) => void;
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
  onAddWorkoutForDate,
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
      {/* ?щ젰 ?곸뿭: ?믪씠 怨좎젙 (shrink-0) 諛??ㅼ뾽 ?ㅽ???*/}
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
            let cellStyle = '';
            if (isSelected) {
              cellStyle = 'bg-emerald-600/90 border-emerald-300 text-slate-100 ring-1 ring-emerald-300/70 shadow-[0_0_14px_-2px_rgba(46,196,182,0.45)]';
            } else if (day.key === todayKey) {
              cellStyle = 'bg-rose-100/90 border-rose-300 text-slate-950 hover:bg-rose-100';
            } else if (useActuals && hasCompleted) {
              cellStyle = 'bg-amber-300 border-amber-500 text-black hover:bg-amber-200';
            } else if (useActuals && hasInProgress) {
              cellStyle = 'bg-blue-100 border-blue-300 text-black hover:bg-blue-50';
            } else if (useActuals && hasSkipped) {
              cellStyle = 'bg-rose-200 border-rose-500 text-black hover:bg-rose-100';
            } else if (day.isCurrentMonth && highlightsFuturePlan) {
              cellStyle = 'bg-sky-100/90 border-sky-300 text-slate-950 hover:bg-sky-100';
            } else if (day.isCurrentMonth) {
              cellStyle = 'bg-slate-850/75 border-slate-650 text-slate-100 hover:bg-slate-700';
            } else {
              cellStyle = 'bg-slate-900/40 border-transparent text-slate-500';
            }
            const todayOutline = day.key === todayKey
              ? ' ring-2 ring-rose-300 border-rose-400'
              : '';

            return (
              <button
                type="button"
                key={day.key}
                onClick={() => selectDate(day.key)}
                aria-label={`${day.key} ${actualLabel ?? (displayKind ? planKindLabel(displayKind, locale) : '')}`.trim()}
                className={`flex aspect-square min-h-12 flex-col rounded-xl p-1.5 border transition-all duration-200 active:scale-95 ${cellStyle}${todayOutline}`}
              >
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
          <div className="space-y-1">
            <label htmlFor="calendar-workout-plan-select" className="block text-xs font-extrabold text-slate-100">
              {locale === 'ko' ? '이 날짜의 운동계획 수정' : 'Modify plan for this date'}
            </label>
            <select
              id="calendar-workout-plan-select"
              aria-label="Selected date workout plan"
              value={selectedPlanValue}
              onChange={(event) => void handlePlanChange(event.target.value)}
              className="min-h-10 w-full cursor-pointer rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-semibold text-slate-100 outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            >
              <option value="__none" disabled className="bg-slate-900 text-slate-200">{locale === 'ko' ? '없음' : 'None'}</option>
              <option value="__cycle" className="bg-slate-900 text-slate-200">{locale === 'ko' ? '운동사이클 따르기' : 'Follow workout cycle'}</option>
              <option value="rest" className="bg-slate-900 text-slate-200">{t(locale, 'rest')}</option>
              <option value="running" className="bg-slate-900 text-slate-200">{locale === 'ko' ? '러닝' : 'Running'}</option>
              <option value="free" className="bg-slate-900 text-slate-200">{locale === 'ko' ? '자유운동' : 'Free workout'}</option>
              {routineDays.map((routineDay) => (
                <option key={routineDay.id} value={`routine:${routineDay.id}`} className="bg-slate-900 text-slate-200">
                  {getRoutineDayDisplayName(routineDay, locale)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-650 bg-slate-850/75 px-3 py-2.5 text-xs font-bold leading-relaxed text-slate-200">
            {locale === 'ko'
              ? '오늘 이전 날짜는 계획이 아니라 실적을 표시합니다. 과거 운동 기록 수정은 실적 메뉴에서 처리합니다.'
              : 'Past dates show actual records, not plans. Use Actuals to edit historical workout records.'}
          </p>
        )}

        {canAddSelectedDateWorkout && onAddWorkoutForDate ? (
          <div className="rounded-xl border border-accent/25 bg-accent-soft/60 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-primary">
                {locale === 'ko' ? '선택 날짜 기록' : 'Log selected date'}
              </p>
              <span className="text-[11px] font-bold text-text-secondary">
                {selectedWorkoutSummaries.length > 0
                  ? (locale === 'ko' ? `${selectedWorkoutSummaries.length}개 기록 있음` : `${selectedWorkoutSummaries.length} records`)
                  : (locale === 'ko' ? '아직 기록 없음' : 'No records yet')}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onAddWorkoutForDate(selectedDateKey, 'free')}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-slate-650 bg-white px-2 text-xs font-black text-primary active:scale-95"
              >
                <Plus aria-hidden="true" size={14} />
                <span>{locale === 'ko' ? '자유' : 'Free'}</span>
              </button>
              <button
                type="button"
                onClick={() => onAddWorkoutForDate(selectedDateKey, 'running')}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-sky-400/40 bg-white px-2 text-xs font-black text-primary active:scale-95"
              >
                <Footprints aria-hidden="true" size={14} />
                <span>{locale === 'ko' ? '러닝' : 'Run'}</span>
              </button>
              <button
                type="button"
                onClick={() => selectedRoutineDayForStart
                  ? onAddWorkoutForDate(selectedDateKey, 'planned', selectedRoutineDayForStart.id)
                  : undefined}
                disabled={!selectedRoutineDayForStart}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-emerald-500/35 bg-white px-2 text-xs font-black text-primary active:scale-95 disabled:border-slate-650 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Play aria-hidden="true" size={14} />
                <span>{locale === 'ko' ? '루틴' : 'Routine'}</span>
              </button>
            </div>
          </div>
        ) : null}
        <p className="rounded-xl border border-slate-650 bg-slate-850/75 px-3 py-2.5 text-xs font-bold leading-relaxed text-slate-200">
          {locale === 'ko'
            ? '이 화면에서는 계획만 수정합니다. 누락 기록 추가와 과거 기록 수정/삭제는 실적 메뉴에서 처리합니다.'
            : 'This screen only edits plans. Use Actuals to add missing records or edit/delete past workouts.'}
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


