import { Bed, ChevronLeft, ChevronRight, Dumbbell, Footprints, Play } from 'lucide-react';
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
import { getMonthlyWorkoutSummaries, getOrCreateWorkoutForDate, skipWorkoutSession, unskipWorkoutSession, type WorkoutSummary } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { db } from '../db/db';
import { exerciseCountLabel, getStoredLocale, t, workoutStatusLabel } from '../i18n/i18n';
import type { CalendarPlanOverride, RoutineDay, WorkoutPlanKind, WorkoutSession } from '../types';

type CalendarPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  onStartWorkout: (routineDayId?: string, dateKey?: string, sessionId?: string, createNew?: boolean) => void;
  onEditHistoricalWorkout: (sessionId: string, dateKey: string) => void;
  reviewingWeeklyPlan?: boolean;
  onReturnToWeeklyPlan?: () => void;
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

type CalendarWorkoutStartArgs = [
  routineDayId?: string,
  dateKey?: string,
  sessionId?: string,
  createNew?: boolean,
];

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

function hasWorkoutSummaryContent(summary: WorkoutSummary): boolean {
  return summary.exerciseCount > 0
    || summary.cardioCount > 0
    || summary.session.totalStrengthVolumeKg > 0;
}

function isRunningOnlySummary(summary: WorkoutSummary): boolean {
  return summary.cardioCount > 0
    && summary.exerciseCount === 0
    && summary.session.totalStrengthVolumeKg === 0;
}

function getSummaryPlanValue(summary: WorkoutSummary): string | undefined {
  if (isRunningOnlySummary(summary)) return 'running';
  if (summary.exerciseCount > 0 || summary.session.totalStrengthVolumeKg > 0) {
    return summary.session.routineDayId ? `routine:${summary.session.routineDayId}` : 'free';
  }
  return undefined;
}

function shouldShowWorkoutSummaryCard(summary: WorkoutSummary): boolean {
  return summary.session.status === 'in_progress'
    || summary.session.status === 'skipped'
    || hasWorkoutSummaryContent(summary);
}

export function getCalendarNewWorkoutStartArgs(
  selectedDateKey: string,
  routineDayId?: string,
): CalendarWorkoutStartArgs {
  return [routineDayId, selectedDateKey, undefined, true];
}

export function getCalendarExistingWorkoutStartArgs(
  selectedDateKey: string,
  session: Pick<WorkoutSession, 'id' | 'routineDayId'>,
): CalendarWorkoutStartArgs {
  return [session.routineDayId, selectedDateKey, session.id];
}

export function shouldShowCalendarPlanIndicator(
  isCurrentMonth: boolean,
  hasPlan: boolean,
  hasWorkoutSummaries: boolean,
  reviewingWeeklyPlan: boolean,
): boolean {
  return isCurrentMonth && hasPlan && (reviewingWeeklyPlan || !hasWorkoutSummaries);
}

export function CalendarPage({
  initialSelectedDateKey,
  onSelectedDateChange,
  onStartWorkout,
  onEditHistoricalWorkout,
  reviewingWeeklyPlan = false,
  onReturnToWeeklyPlan,
}: CalendarPageProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => (
    monthFromDate(initialSelectedDateKey ? dateFromKey(initialSelectedDateKey) : today)
  ));
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
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

  const summariesByDate = useMemo(() => {
    return summaries.reduce<Record<string, WorkoutSummary[]>>((byDate, summary) => {
      byDate[summary.session.date] = [...(byDate[summary.session.date] ?? []), summary];
      return byDate;
    }, {});
  }, [summaries]);

  const plansByDate = useMemo(() => {
    return plans.reduce<Record<string, CalendarPlan>>((byDate, plan) => {
      byDate[plan.date] = plan;
      return byDate;
    }, {});
  }, [plans]);

  useEffect(() => {
    async function loadMonth() {
      const activeRoutine = await getActiveRoutine();
      const [monthlySummaries, schedule, cycleItems, loadedRoutineDays, overrides] = await Promise.all([
        getMonthlyWorkoutSummaries(visibleMonth.getFullYear(), visibleMonth.getMonth()),
        getActiveWeeklySchedule(),
        activeRoutine ? getRoutineCyclePlan(activeRoutine.id) : [],
        getActiveRoutineDays(),
        activeRoutine ? db.calendarPlanOverrides.where('routineId').equals(activeRoutine.id).toArray() : [],
      ]);

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

      setSummaries(monthlySummaries);
      setRoutineDays(loadedRoutineDays);
      setOverridesByDate(overridesByDateMap);
      setPlans(plannedDays);
    }

    void loadMonth();
  }, [reloadKey, todayKey, visibleMonth]);

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
    if (value === '__cycle') {
      await clearCalendarPlanOverride(selectedDateKey);
    } else if (value === 'rest' || value === 'running' || value === 'free') {
      await saveCalendarPlanOverride(selectedDateKey, value);
    } else {
      await saveCalendarPlanOverride(selectedDateKey, 'routine', value.replace(/^routine:/, ''));
    }

    setReloadKey((current) => current + 1);
  }

  async function handleSkipNewSession() {
    const activeWorkout = await getOrCreateWorkoutForDate(selectedDateKey, startWorkoutRoutineDayId, { createNew: true });
    await skipWorkoutSession(activeWorkout.session.id);
    setReloadKey((current) => current + 1);
  }

  async function handleSkipSession(sessionId: string) {
    await skipWorkoutSession(sessionId);
    setReloadKey((current) => current + 1);
  }

  async function handleUnskipSession(sessionId: string) {
    await unskipWorkoutSession(sessionId);
    setReloadKey((current) => current + 1);
  }

  useEffect(() => {
    if (!initialSelectedDateKey) return;

    const initialDate = dateFromKey(initialSelectedDateKey);
    setVisibleMonth(monthFromDate(initialDate));
    setSelectedDateKey(initialSelectedDateKey);
  }, [initialSelectedDateKey]);

  const selectedOverride = overridesByDate[selectedDateKey];
  const selectedSummaries = summariesByDate[selectedDateKey] ?? [];
  const visibleSelectedSummaries = selectedSummaries.filter(shouldShowWorkoutSummaryCard);
  const selectedPlan = plansByDate[selectedDateKey];
  const selectedRecordPlanValue = selectedSummaries
    .map(getSummaryPlanValue)
    .find((value): value is string => value !== undefined);
  const selectedPlanValue = selectedOverride
    ? selectedRecordPlanValue ?? (
      getOverrideKind(selectedOverride) === 'routine'
        ? `routine:${selectedOverride.routineDayId ?? ''}`
        : getOverrideKind(selectedOverride)
    )
    : selectedRecordPlanValue ?? (selectedPlan ? '__cycle' : 'rest');
  const selectedInProgressSession = selectedSummaries.find((summary) => summary.session.status === 'in_progress');
  const selectedOverrideRoutineDayId = selectedPlanValue.startsWith('routine:') ? selectedPlanValue.replace(/^routine:/, '') : undefined;
  const startWorkoutRoutineDayId = selectedOverrideRoutineDayId ?? (selectedPlan?.kind === 'routine' ? selectedPlan.routineDay?.id : undefined);
  const selectedPlanKind: WorkoutPlanKind = selectedPlanValue.startsWith('routine:')
    ? 'routine'
    : selectedPlanValue === '__cycle'
      ? selectedPlan?.kind ?? 'rest'
      : (selectedPlanValue as WorkoutPlanKind);
  const shouldContinueSelectedSession = selectedInProgressSession !== undefined;
  const recordActionLabel = shouldContinueSelectedSession
    ? selectedDateKey === todayKey ? t(locale, 'continueTodayWorkout') : t(locale, 'continueWorkout')
    : locale === 'ko' ? '운동 기록 하기' : 'Log workout';
  const recordActionDisabled = !shouldContinueSelectedSession && selectedPlanKind === 'rest';

  function handleRecordSelectedDate() {
    if (shouldContinueSelectedSession) {
      onStartWorkout(...getCalendarExistingWorkoutStartArgs(selectedDateKey, selectedInProgressSession.session));
      return;
    }

    if (selectedPlanKind === 'rest') return;
    onStartWorkout(...getCalendarNewWorkoutStartArgs(selectedDateKey, startWorkoutRoutineDayId));
  }

  return (
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <div>
          <p className="text-xs font-extrabold uppercase text-cyan-300">{t(locale, 'calendar')}</p>
          <h1 className="text-xl font-black text-white">{t(locale, 'monthlyWorkoutLog')}</h1>
        </div>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
      {/* ?щ젰 ?곸뿭: ?믪씠 怨좎젙 (shrink-0) 諛??ㅼ뾽 ?ㅽ???*/}
      <section className="shrink-0 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-slate-100 transition-all hover:bg-slate-700 hover:text-white active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <h2 className="text-base font-black text-white">{monthFormatter.format(visibleMonth)}</h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-slate-100 transition-all hover:bg-slate-700 hover:text-white active:scale-95"
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
            const daySummaries = summariesByDate[day.key] ?? [];
            const dayPlan = plansByDate[day.key];
            const hasCompleted = daySummaries.some((s) => s.session.status === 'completed');
            const hasInProgress = daySummaries.some((s) => s.session.status === 'in_progress');
            const totalVolume = daySummaries.reduce((sum, summary) => sum + summary.session.totalStrengthVolumeKg, 0);
            const hasRecord = hasCompleted || hasInProgress;
            const hasRunningRecord = daySummaries.some((summary) => summary.cardioCount > 0 && summary.exerciseCount === 0);
            const hasStrengthRecord = daySummaries.some((summary) => summary.exerciseCount > 0 || summary.session.totalStrengthVolumeKg > 0);
            const displayKind: WorkoutPlanKind | undefined = hasRunningRecord
              ? 'running'
              : hasStrengthRecord
                ? 'routine'
                : dayPlan?.kind ?? (day.isCurrentMonth ? 'rest' : undefined);
            const highlightsFuturePlan = Boolean(displayKind && displayKind !== 'rest');
            const usesLightCellText = hasRecord || day.key === todayKey || (day.key > todayKey && highlightsFuturePlan);

            const isSelected = selectedDateKey === day.key;
            let cellStyle = '';
            if (isSelected) {
              cellStyle = 'bg-emerald-600/90 border-emerald-300 text-white ring-1 ring-emerald-300/70 shadow-[0_0_14px_-2px_rgba(52,211,153,0.45)]';
            } else if (hasRecord && day.key <= todayKey) {
              cellStyle = 'bg-yellow-100/90 border-yellow-300 text-slate-950 hover:bg-yellow-100';
            } else if (day.key === todayKey) {
              cellStyle = 'bg-rose-100/90 border-rose-300 text-slate-950 hover:bg-rose-100';
            } else if (day.key > todayKey && day.isCurrentMonth && highlightsFuturePlan) {
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
                aria-label={`${day.key} ${displayKind ? planKindLabel(displayKind, locale) : ''}`.trim()}
                className={`flex aspect-square min-h-12 flex-col rounded-xl p-1.5 border transition-all duration-200 active:scale-95 ${cellStyle}${todayOutline}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-black ${isSelected ? 'text-white' : usesLightCellText ? 'text-slate-950' : 'text-slate-100'}`}>{day.date.getDate()}</span>
                  {displayKind === 'routine' || displayKind === 'free' ? <Dumbbell aria-hidden="true" size={13} /> : null}
                  {displayKind === 'running' ? <Footprints aria-hidden="true" size={13} /> : null}
                  {displayKind === 'rest' ? <Bed aria-hidden="true" size={13} /> : null}
                </div>
                {totalVolume > 0 ? (
                  <span className="mt-0.5 truncate text-[11px] font-black text-emerald-300">
                    {totalVolume.toLocaleString()}kg
                  </span>
                ) : displayKind ? (
                  <span className="mt-0.5 truncate text-[11px] font-extrabold text-current">
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
            <h2 className="mt-0.5 text-base font-black text-white">{selectedDateKey}</h2>
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

        {visibleSelectedSummaries.length > 0 ? (
          <div className="grid gap-3">
            {visibleSelectedSummaries.map((summary) => {
              const isRunningOnly = isRunningOnlySummary(summary);

              return (
                <div key={summary.session.id} className="space-y-2.5 rounded-2xl border border-slate-650 bg-slate-850/85 p-3.5 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-white tracking-wide">
                      {isRunningOnly
                        ? planKindLabel('running', locale)
                        : getRoutineDayDisplayName(summary.routineDay, locale) ?? summary.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                    </h3>
                    <span className="rounded-lg border border-slate-650 bg-slate-750 px-2.5 py-1 text-xs font-black text-cyan-200">
                      {workoutStatusLabel(locale, summary.session.status)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    {isRunningOnly
                      ? `${summary.cardioCount}${locale === 'ko' ? '개 러닝 기록' : ' running record'}`
                      : (
                        <>
                          {exerciseCountLabel(locale, summary.exerciseCount)} / <span className="text-emerald-450 font-black">{summary.session.totalStrengthVolumeKg.toLocaleString()} kg</span>
                        </>
                      )}
                  </p>
                  <div className="flex gap-2 pt-1">
                    {summary.session.status === 'skipped' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleUnskipSession(summary.session.id)}
                          className="flex-1 min-h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 px-3 text-xs font-black text-slate-950 active:scale-95 transition-all shadow-md shadow-cyan-400/20"
                        >
                          {locale === 'ko' ? '건너뛰기 취소' : 'Unskip'}
                        </button>
                        <button
                          type="button"
                          onClick={() => summary.session.status === 'completed'
                            ? onEditHistoricalWorkout(summary.session.id, selectedDateKey)
                            : onStartWorkout(...getCalendarExistingWorkoutStartArgs(selectedDateKey, summary.session))}
                          className="flex-1 min-h-10 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 text-xs font-black text-slate-200 active:scale-95 transition-all"
                        >
                          {locale === 'ko' ? '기록 보기/수정' : 'View/Edit'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => summary.session.status === 'completed'
                            ? onEditHistoricalWorkout(summary.session.id, selectedDateKey)
                            : onStartWorkout(...getCalendarExistingWorkoutStartArgs(selectedDateKey, summary.session))}
                          className="flex-1 min-h-10 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 text-xs font-black text-cyan-400 active:scale-95 transition-all"
                        >
                          {locale === 'ko' ? `${isRunningOnly ? '러닝' : '운동'}기록 수정` : 'Edit record'}
                        </button>
                        {false && summary.session.status === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => void handleSkipSession(summary.session.id)}
                            className="min-h-10 flex-1 rounded-xl border border-slate-650 bg-slate-850 px-3 text-xs font-black text-slate-100 transition-all hover:bg-slate-700 active:scale-95"
                          >
                            {locale === 'ko' ? '건너뛰기' : 'Skip Workout'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 border-t border-slate-750 pt-3">
          <button
            type="button"
            onClick={handleRecordSelectedDate}
            disabled={recordActionDisabled}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-650 bg-slate-850 px-3 text-xs font-black text-slate-100 transition-all hover:bg-slate-700 active:scale-95 disabled:text-slate-500 disabled:hover:bg-slate-850"
          >
            <Play aria-hidden="true" size={15} />
            <span>{recordActionLabel}</span>
          </button>
        </div>

        {false && !shouldContinueSelectedSession ? (
          <div className="grid grid-cols-1 gap-2 border-t border-slate-750 pt-3">
            {startWorkoutRoutineDayId ? (
              <button
                type="button"
                onClick={() => onStartWorkout(...getCalendarNewWorkoutStartArgs(selectedDateKey))}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-650 bg-slate-850 px-3 text-xs font-black text-slate-100 transition-all hover:bg-slate-700 active:scale-95"
              >
                <Play aria-hidden="true" size={15} />
                <span>{locale === 'ko' ? '자유 운동으로 기록 추가' : 'Add free workout record'}</span>
              </button>
            ) : null}
            {false && (selectedPlan || selectedDateKey < todayKey) && (
              <button
                type="button"
                onClick={() => void handleSkipNewSession()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-850 px-3 text-xs font-bold text-rose-400 active:scale-95 transition-all"
              >
                <span>
                  {locale === 'ko' ? '운동 건너뛰기' : 'Skip Workout'}
                </span>
              </button>
            )}
          </div>
        ) : null}
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
        {false && <button
          type="button"
          onClick={() => onStartWorkout(...(
            shouldContinueSelectedSession
              ? getCalendarExistingWorkoutStartArgs(selectedDateKey, selectedInProgressSession.session)
              : getCalendarNewWorkoutStartArgs(selectedDateKey, startWorkoutRoutineDayId)
          ))}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-455 px-3 text-sm font-black text-slate-955 shadow-lg shadow-cyan-400/20 transition-all hover:from-cyan-300 hover:to-cyan-400 active:scale-95"
        >
          <Play aria-hidden="true" size={18} />
          <span>{recordActionLabel}</span>
        </button>}
      </footer>
    </section>
  );
}
