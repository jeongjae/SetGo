import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  clearCalendarPlanOverride,
  getActiveRoutine,
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
import type { CalendarPlanOverride, RoutineDay, WorkoutSession } from '../types';

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
  status: 'planned' | 'missed';
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

function statusLabel(status: CalendarPlan['status'], locale: 'ko' | 'en') {
  return status === 'missed' ? t(locale, 'missed') : t(locale, 'planned');
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

function statusColor(status: WorkoutSummary['session']['status']) {
  if (status === 'completed') return 'bg-emerald-400 shadow-[0_0_6px_#34d399]';
  if (status === 'in_progress') return 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]';
  if (status === 'skipped') return 'bg-slate-400';
  return 'bg-amber-300';
}

function planColor(status: CalendarPlan['status']) {
  return status === 'missed' ? 'bg-rose-500' : 'bg-cyan-400';
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
      const [monthlySummaries, schedule, loadedRoutineDays, overrides] = await Promise.all([
        getMonthlyWorkoutSummaries(visibleMonth.getFullYear(), visibleMonth.getMonth()),
        getActiveWeeklySchedule(),
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
            if (override.isRestDay || !override.routineDayId) return [];

            return [{
              date: day.key,
              routineDay: routineDayById.get(override.routineDayId),
              status: day.key < todayKey ? 'missed' : 'planned',
            } satisfies CalendarPlan];
          }

          if (!isRoutineScheduledForDate(activeRoutine, day.key)) return [];

          const daySchedule = schedule.find((item) => item.weekday === day.date.getDay());
          if (!daySchedule || daySchedule.isRestDay || !daySchedule.routineDayId) return [];

          return [{
            date: day.key,
            routineDay: routineDayById.get(daySchedule.routineDayId),
            status: day.key < todayKey ? 'missed' : 'planned',
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
    if (value === '__weekly') {
      await clearCalendarPlanOverride(selectedDateKey);
    } else {
      await saveCalendarPlanOverride(selectedDateKey, value || undefined);
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
    const isSelectedDateVisible = calendarDays.some((day) => day.key === selectedDateKey && day.isCurrentMonth);
    if (!isSelectedDateVisible) {
      selectDate(formatDateKey(visibleMonth));
    }
  }, [calendarDays, selectedDateKey, visibleMonth]);

  useEffect(() => {
    if (!initialSelectedDateKey) return;

    const initialDate = dateFromKey(initialSelectedDateKey);
    setVisibleMonth(monthFromDate(initialDate));
    setSelectedDateKey(initialSelectedDateKey);
  }, [initialSelectedDateKey]);

  const selectedOverride = overridesByDate[selectedDateKey];
  const selectedSummaries = summariesByDate[selectedDateKey] ?? [];
  const selectedPlan = plansByDate[selectedDateKey];
  const selectedPlanValue = selectedOverride
    ? selectedOverride.isRestDay ? '' : selectedOverride.routineDayId ?? ''
    : selectedPlan?.routineDay ? '__weekly' : '';
  const selectedInProgressSession = selectedSummaries.find((summary) => summary.session.status === 'in_progress');
  const selectedOverrideRoutineDayId = selectedPlanValue !== '__weekly' ? selectedPlanValue || undefined : undefined;
  const startWorkoutRoutineDayId = selectedOverrideRoutineDayId ?? selectedPlan?.routineDay?.id;
  const shouldContinueSelectedSession = selectedInProgressSession !== undefined;
  const primaryActionLabel = shouldContinueSelectedSession
    ? selectedDateKey === todayKey ? t(locale, 'continueTodayWorkout') : t(locale, 'continueWorkout')
    : startWorkoutRoutineDayId
      ? t(locale, 'startPlannedWorkout')
      : t(locale, 'startFreeWorkout');

  return (
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <div>
          <p className="text-xs font-extrabold uppercase text-cyan-300">{t(locale, 'calendar')}</p>
          <h1 className="text-xl font-black text-white">{t(locale, 'monthlyWorkoutLog')}</h1>
        </div>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
      {/* 달력 영역: 높이 고정 (shrink-0) 및 톤업 스타일 */}
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
            const hasSkipped = daySummaries.some((s) => s.session.status === 'skipped');
            const hasCompleted = daySummaries.some((s) => s.session.status === 'completed');
            const hasInProgress = daySummaries.some((s) => s.session.status === 'in_progress');
            const showPlanDot = shouldShowCalendarPlanIndicator(
              day.isCurrentMonth,
              Boolean(dayPlan),
              daySummaries.length > 0,
              reviewingWeeklyPlan,
            );
            const totalVolume = daySummaries.reduce((sum, summary) => sum + summary.session.totalStrengthVolumeKg, 0);

            const isSelected = selectedDateKey === day.key;
            let cellStyle = '';
            if (isSelected) {
              cellStyle = 'bg-cyan-950/70 border-cyan-400 text-white ring-1 ring-cyan-400/50 shadow-[0_0_12px_-2px_rgba(34,211,238,0.35)]';
            } else if (hasCompleted) {
              cellStyle = 'bg-emerald-950/40 border-emerald-500/60 text-slate-100 hover:bg-emerald-950/60 shadow-[0_0_8px_-2px_rgba(16,185,129,0.25)]';
            } else if (hasInProgress) {
              cellStyle = 'bg-cyan-950/40 border-cyan-500/60 text-slate-100 hover:bg-cyan-950/60 shadow-[0_0_8px_-2px_rgba(34,211,238,0.25)]';
            } else if (day.isCurrentMonth) {
              cellStyle = 'bg-slate-850/75 border-slate-650 text-slate-100 hover:bg-slate-700';
            } else {
              cellStyle = 'bg-slate-900/40 border-transparent text-slate-500';
            }

            return (
              <button
                type="button"
                key={day.key}
                onClick={() => selectDate(day.key)}
                aria-label={`${day.key} ${dayPlan ? getRoutineDayDisplayName(dayPlan.routineDay, locale) ?? statusLabel(dayPlan.status, locale) : ''}`.trim()}
                className={`flex aspect-square min-h-12 flex-col rounded-xl p-1.5 border transition-all duration-200 active:scale-95 ${cellStyle}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-black ${isSelected ? 'text-cyan-200' : 'text-slate-100'}`}>{day.date.getDate()}</span>
                  {hasCompleted && <span className="text-[11px] filter drop-shadow">🏋️‍♂️</span>}
                </div>
                <div className="mt-auto flex items-center gap-0.5">
                  {daySummaries.slice(0, 3).map((summary) => (
                    <span
                      key={summary.session.id}
                      className={`h-1.5 w-1.5 rounded-full ${statusColor(summary.session.status)}`}
                      aria-label={`${summary.session.date} ${workoutStatusLabel(locale, summary.session.status)}`}
                    />
                  ))}
                  {showPlanDot ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${planColor(dayPlan.status)}`}
                      aria-label={`${day.key} ${statusLabel(dayPlan.status, locale)}`}
                    />
                  ) : null}
                </div>
                {totalVolume > 0 ? (
                  <span className="mt-0.5 truncate text-[11px] font-black text-emerald-300">
                    {totalVolume.toLocaleString()}kg
                  </span>
                ) : hasSkipped ? (
                  <span className="mt-0.5 inline-block rounded border border-slate-650 bg-slate-750 px-1 py-0.2 text-[10px] font-black uppercase text-slate-100">
                    {locale === 'ko' ? '스킵' : 'Skip'}
                  </span>
                ) : showPlanDot ? (
                  <span className={`mt-0.5 truncate text-[11px] font-extrabold ${
                    dayPlan.status === 'missed' ? 'text-rose-450' : 'text-cyan-400'
                  }`}>
                    {getRoutineDayDisplayName(dayPlan.routineDay, locale) ?? statusLabel(dayPlan.status, locale)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-650 pt-2.5 text-xs font-black uppercase text-slate-100">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />{t(locale, 'completed')}</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />{t(locale, 'inProgress')}</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-cyan-400" />{t(locale, 'planned')}</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{t(locale, 'missed')}</span>
        </div>
      </section>

      {/* 운동 상세 정보 및 조작부: 내부 스크롤 적용 (inner-scroll) */}
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
            {locale === 'ko' ? '이 날의 계획 수정' : 'Modify plan for this date'}
          </label>
          <select
            id="calendar-workout-plan-select"
            aria-label="Selected date workout plan"
            value={selectedPlanValue}
            onChange={(event) => void handlePlanChange(event.target.value)}
            className="min-h-10 w-full cursor-pointer rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-semibold text-slate-100 outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          >
            <option value="__weekly" className="bg-slate-900 text-slate-200">{t(locale, 'useWeeklySchedule')}</option>
            <option value="" className="bg-slate-900 text-slate-200">{t(locale, 'rest')}</option>
            {routineDays.map((routineDay) => (
              <option key={routineDay.id} value={routineDay.id} className="bg-slate-900 text-slate-200">
                {getRoutineDayDisplayName(routineDay, locale)}
              </option>
            ))}
          </select>
        </div>

        {selectedSummaries.length > 0 ? (
          <div className="grid gap-3">
            {selectedSummaries.map((summary) => (
              <div key={summary.session.id} className="space-y-2.5 rounded-2xl border border-slate-650 bg-slate-850/85 p-3.5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black text-white tracking-wide">
                    {getRoutineDayDisplayName(summary.routineDay, locale) ?? summary.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                  </h3>
                  <span className="rounded-lg border border-slate-650 bg-slate-750 px-2.5 py-1 text-xs font-black text-cyan-200">
                    {workoutStatusLabel(locale, summary.session.status)}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-300">
                  {exerciseCountLabel(locale, summary.exerciseCount)} / <span className="text-emerald-450 font-black">{summary.session.totalStrengthVolumeKg.toLocaleString()} kg</span>
                </p>
                <div className="flex gap-2 pt-1">
                  {summary.session.status === 'skipped' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleUnskipSession(summary.session.id)}
                        className="flex-1 min-h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 px-3 text-xs font-black text-slate-950 active:scale-95 transition-all shadow-md shadow-cyan-400/20"
                      >
                        {locale === 'ko' ? '스킵 취소' : 'Unskip'}
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
                        {locale === 'ko' ? '운동기록 수정' : 'Edit record'}
                      </button>
                      {summary.session.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => void handleSkipSession(summary.session.id)}
                          className="min-h-10 flex-1 rounded-xl border border-slate-650 bg-slate-850 px-3 text-xs font-black text-slate-100 transition-all hover:bg-slate-700 active:scale-95"
                        >
                          {locale === 'ko' ? '스킵하기' : 'Skip Workout'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!shouldContinueSelectedSession ? (
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
            {(selectedPlan || selectedDateKey < todayKey) && (
              <button
                type="button"
                onClick={() => void handleSkipNewSession()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-850 px-3 text-xs font-bold text-rose-400 active:scale-95 transition-all"
              >
                <span>
                  {locale === 'ko' ? '운동 스킵 (Skip Workout)' : 'Skip Workout'}
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
            {locale === 'ko' ? '주간 계획으로 돌아가기' : 'Return to weekly plan'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onStartWorkout(...(
            shouldContinueSelectedSession
              ? getCalendarExistingWorkoutStartArgs(selectedDateKey, selectedInProgressSession.session)
              : getCalendarNewWorkoutStartArgs(selectedDateKey, startWorkoutRoutineDayId)
          ))}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-455 px-3 text-sm font-black text-slate-955 shadow-lg shadow-cyan-400/20 transition-all hover:from-cyan-300 hover:to-cyan-400 active:scale-95"
        >
          <Play aria-hidden="true" size={18} />
          <span>{primaryActionLabel}</span>
        </button>
      </footer>
    </section>
  );
}
