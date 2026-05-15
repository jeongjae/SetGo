import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  clearCalendarPlanOverride,
  getActiveRoutine,
  getActiveRoutineDays,
  getActiveWeeklySchedule,
  getRoutineDayDisplayName,
  saveCalendarPlanOverride,
} from '../db/routines';
import { getMonthlyWorkoutSummaries, type WorkoutSummary } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { db } from '../db/db';
import { getStoredLocale, t } from '../i18n/i18n';
import type { CalendarPlanOverride, RoutineDay } from '../types';

type CalendarPageProps = {
  onBack: () => void;
  onStartWorkout: (routineDayId?: string) => void;
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

const weekdayLabels = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function statusLabel(status: CalendarPlan['status'], locale: 'ko' | 'en') {
  if (status === 'missed') return t(locale, 'missed');
  return t(locale, 'planned');
}

function workoutStatusLabel(status: WorkoutSummary['session']['status'], locale: 'ko' | 'en') {
  if (status === 'completed') return t(locale, 'completed');
  if (status === 'in_progress') return t(locale, 'inProgress');
  if (status === 'skipped') return locale === 'ko' ? '건너뜀' : 'Skipped';
  return t(locale, 'planned');
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

function statusColor(status: WorkoutSummary['session']['status']) {
  if (status === 'completed') return 'bg-emerald-400';
  if (status === 'in_progress') return 'bg-cyan-400';
  if (status === 'skipped') return 'bg-slate-500';
  return 'bg-amber-300';
}

function planColor(status: CalendarPlan['status']) {
  if (status === 'missed') return 'bg-red-400';
  return 'bg-amber-300';
}

export function CalendarPage({ onBack, onStartWorkout }: CalendarPageProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [overridesByDate, setOverridesByDate] = useState<Record<string, CalendarPlanOverride>>({});
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [reloadKey, setReloadKey] = useState(0);
  const [locale] = useState(() => getStoredLocale());
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : undefined, {
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

          const daySchedule = schedule.find((item) => item.weekday === day.date.getDay());
          if (!daySchedule || daySchedule.isRestDay || !daySchedule.routineDayId) return [];

          const plan: CalendarPlan = {
            date: day.key,
            routineDay: routineDayById.get(daySchedule.routineDayId),
            status: day.key < todayKey ? 'missed' : 'planned',
          };

          return [plan];
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

  function goToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(todayKey);
  }

  async function handlePlanChange(value: string) {
    if (value === '__weekly') {
      await clearCalendarPlanOverride(selectedDateKey);
    } else {
      await saveCalendarPlanOverride(selectedDateKey, value || undefined);
    }

    setReloadKey((current) => current + 1);
  }

  useEffect(() => {
    const isSelectedDateVisible = calendarDays.some((day) => day.key === selectedDateKey && day.isCurrentMonth);
    if (!isSelectedDateVisible) {
      setSelectedDateKey(formatDateKey(visibleMonth));
    }
  }, [calendarDays, selectedDateKey, visibleMonth]);

  const selectedOverride = overridesByDate[selectedDateKey];
  const selectedSummaries = summariesByDate[selectedDateKey] ?? [];
  const selectedPlan = plansByDate[selectedDateKey];
  const selectedPlanValue = selectedOverride
    ? selectedOverride.isRestDay ? '' : selectedOverride.routineDayId ?? ''
    : '__weekly';
  const selectedTodaySession = selectedDateKey === todayKey
    ? selectedSummaries.find((summary) => summary.session.status === 'in_progress')
    : undefined;
  const canStartSelectedDate = selectedDateKey === todayKey;
  const selectedOverrideRoutineDayId = selectedPlanValue !== '__weekly' ? selectedPlanValue || undefined : undefined;
  const startWorkoutRoutineDayId = selectedOverrideRoutineDayId ?? selectedPlan?.routineDay?.id ?? selectedTodaySession?.session.routineDayId;

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-slate-100"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-sm font-medium text-cyan-300">{t(locale, 'calendar')}</p>
          <h1 className="text-2xl font-bold text-white">{t(locale, 'monthlyWorkoutLog')}</h1>
        </div>
      </header>

      <section className="rounded-lg bg-slate-900 p-4 shadow">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <h2 className="text-lg font-semibold text-white">{monthFormatter.format(visibleMonth)}</h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-100"
            aria-label="Next month"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {weekdayLabels[locale].map((weekday) => (
            <div key={weekday}>{weekday}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const daySummaries = summariesByDate[day.key] ?? [];
            const dayPlan = plansByDate[day.key];
            const dayOverride = overridesByDate[day.key];
            const showPlanDot = day.isCurrentMonth && dayPlan && daySummaries.length === 0;
            const totalVolume = daySummaries.reduce((sum, summary) => sum + summary.session.totalStrengthVolumeKg, 0);

            return (
              <button
                type="button"
                key={day.key}
                onClick={() => setSelectedDateKey(day.key)}
                className={`flex aspect-square min-h-14 flex-col rounded-md p-1.5 ${
                  selectedDateKey === day.key
                    ? 'bg-cyan-950 text-white ring-2 ring-cyan-400'
                    : day.isCurrentMonth ? 'bg-slate-800 text-slate-100' : 'bg-slate-900 text-slate-600'
                }`}
              >
                <span className="text-xs font-semibold">{day.date.getDate()}</span>
                {dayOverride ? (
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-300" aria-label={`${day.key} custom plan`} />
                ) : null}
                <div className="mt-auto flex items-center gap-1">
                  {daySummaries.slice(0, 3).map((summary) => (
                    <span
                      key={summary.session.id}
                      className={`h-2 w-2 rounded-full ${statusColor(summary.session.status)}`}
                      aria-label={`${summary.session.date} ${workoutStatusLabel(summary.session.status, locale)}`}
                    />
                  ))}
                  {showPlanDot ? (
                    <span
                      className={`h-2 w-2 rounded-full ${planColor(dayPlan.status)}`}
                      aria-label={`${day.key} ${statusLabel(dayPlan.status, locale)}`}
                    />
                  ) : null}
                </div>
                {totalVolume > 0 ? (
                  <span className="mt-1 truncate text-[10px] font-medium text-cyan-300">
                    {totalVolume.toLocaleString()}kg
                  </span>
                ) : showPlanDot ? (
                  <span className={`mt-1 truncate text-[10px] font-medium ${
                    dayPlan.status === 'missed' ? 'text-red-300' : 'text-amber-200'
                  }`}>
                    {getRoutineDayDisplayName(dayPlan.routineDay, locale) ?? statusLabel(dayPlan.status, locale)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-slate-300">
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />{t(locale, 'completed')}</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-400" />{t(locale, 'inProgress')}</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-300" />{t(locale, 'planned')}</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-red-400" />{t(locale, 'missed')}</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-300" />{t(locale, 'customPlan')}</span>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'planDate')}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{selectedDateKey}</h2>
        <select
          aria-label="Selected date workout plan"
          value={selectedPlanValue}
          onChange={(event) => void handlePlanChange(event.target.value)}
          className="mt-4 min-h-11 w-full rounded-md bg-slate-800 px-3 text-sm text-white"
        >
          <option value="__weekly">{t(locale, 'useWeeklySchedule')}</option>
          <option value="">{t(locale, 'rest')}</option>
          {routineDays.map((routineDay) => (
            <option key={routineDay.id} value={routineDay.id}>
              {getRoutineDayDisplayName(routineDay, locale)}
            </option>
          ))}
        </select>
        <p className="mt-3 text-sm text-slate-300">
          {selectedSummaries.length > 0
            ? t(locale, 'workoutSession')
            : selectedPlan?.routineDay
              ? `${getRoutineDayDisplayName(selectedPlan.routineDay, locale)} ${t(locale, 'planned')}`
              : selectedOverride?.isRestDay
                ? t(locale, 'restDay')
                : t(locale, 'followingWeeklySchedule')}
        </p>
        {selectedSummaries.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {selectedSummaries.map((summary) => (
              <div key={summary.session.id} className="rounded-md bg-slate-800 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">
                    {getRoutineDayDisplayName(summary.routineDay, locale) ?? summary.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                  </h3>
                  <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200">
                    {workoutStatusLabel(summary.session.status, locale)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {summary.exerciseCount} {t(locale, 'exercises')} / {summary.session.totalStrengthVolumeKg.toLocaleString()} kg
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {selectedOverride ? (
          <p className="mt-2 rounded-md bg-violet-950 px-3 py-2 text-xs font-semibold text-violet-100">
            {locale === 'ko' ? '이 날짜에 사용자 지정 계획이 저장되었습니다.' : 'Custom plan saved for this date.'}
          </p>
        ) : null}
        {selectedDateKey !== todayKey ? (
          <button
            type="button"
            onClick={goToToday}
            className="mt-4 min-h-11 w-full rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          >
            {t(locale, 'backToToday')}
          </button>
        ) : null}
        {canStartSelectedDate ? (
          <button
            type="button"
            onClick={() => onStartWorkout(startWorkoutRoutineDayId)}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 text-sm font-semibold text-slate-950"
          >
            <Play aria-hidden="true" size={17} />
            <span>
              {selectedTodaySession
                ? t(locale, 'continueTodayWorkout')
                : startWorkoutRoutineDayId
                  ? t(locale, 'startPlannedWorkout')
                  : t(locale, 'startFreeWorkout')}
            </span>
          </button>
        ) : null}
      </section>

    </section>
  );
}
