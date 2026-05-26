import { Dumbbell, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import {
  getActiveRoutineDays,
  getNextRoutineDayAfterLatestWorkout,
  getRoutineDayDisplayName,
  getRoutineScheduleForDate,
  getRoutineSplitName,
} from '../db/routines';
import { seedDefaultExercises } from '../db/seed';
import { getRecentWorkoutSummaries, getTodayWorkout, type WorkoutSummary } from '../db/workouts';
import { getExerciseName } from '../domain/exercises';
import { exerciseCountLabel, getStoredLocale, t, workoutStatusLabel } from '../i18n/i18n';
import type { Routine, RoutineDay, WorkoutSession } from '../types';

type TodayPageProps = {
  refreshKey: number;
  onStartWorkout: (routineDayId?: string) => void;
};

export function TodayPage({ refreshKey, onStartWorkout }: TodayPageProps) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [inProgressSession, setInProgressSession] = useState<WorkoutSession | undefined>();
  const [selectedRoutineDayId, setSelectedRoutineDayId] = useState<string | undefined>();
  const [todayRoutineDay, setTodayRoutineDay] = useState<RoutineDay | undefined>();
  const [nextRoutineDay, setNextRoutineDay] = useState<RoutineDay | undefined>();
  const [plannedExerciseNames, setPlannedExerciseNames] = useState<string[]>([]);
  const [latestFinishedWorkout, setLatestFinishedWorkout] = useState<WorkoutSummary | undefined>();
  const [isTodayRestDay, setIsTodayRestDay] = useState(false);
  const [locale] = useState(() => getStoredLocale());

  const todayLabel = useMemo(() => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date()), [locale]);

  useEffect(() => {
    async function load() {
      try {
        await seedDefaultExercises();
        const [routine, days, todaySchedule, nextDay, todayWorkout, recentWorkouts] = await Promise.all([
          db.routines.filter((routineRecord) => routineRecord.isActive).first(),
          getActiveRoutineDays(),
          getRoutineScheduleForDate(),
          getNextRoutineDayAfterLatestWorkout(),
          getTodayWorkout(),
          getRecentWorkoutSummaries(10),
        ]);

        setActiveRoutine(routine);
        setRoutineDays(days);
        setInProgressSession(todayWorkout?.session);
        setTodayRoutineDay(todaySchedule.routineDay);
        setNextRoutineDay(nextDay);
        setLatestFinishedWorkout(recentWorkouts.find((summary) => summary.session.status !== 'in_progress'));
        setIsTodayRestDay(todaySchedule.isRestDay);
        setSelectedRoutineDayId((current) => {
          const scheduledRoutineDayId = todaySchedule.isRestDay ? undefined : todaySchedule.routineDay?.id;
          const nextSelection = todayWorkout?.session.routineDayId
            ?? scheduledRoutineDayId
            ?? (days.some((day) => day.id === current) ? current : undefined);

          return nextSelection;
        });
      } catch (error) {
        console.error('Failed to load local SetGo data', error);
      }
    }

    void load();
  }, [refreshKey]);

  useEffect(() => {
    async function loadPlannedExercises() {
      if (!selectedRoutineDayId) {
        setPlannedExerciseNames([]);
        return;
      }

      const plans = await db.routineExercisePlans.where('routineDayId').equals(selectedRoutineDayId).sortBy('order');
      const exercises = await Promise.all(plans.map((plan) => db.exercises.get(plan.exerciseId)));
      setPlannedExerciseNames(
        exercises
          .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== undefined)
          .map((exercise) => getExerciseName(exercise, locale)),
      );
    }

    void loadPlannedExercises();
  }, [locale, selectedRoutineDayId]);

  const selectedRoutineDay = routineDays.find((routineDay) => routineDay.id === selectedRoutineDayId);
  const activeRoutineName = activeRoutine
    ? getRoutineSplitName(activeRoutine.splitType, locale) ?? activeRoutine.name
    : undefined;
  const planLabel = inProgressSession
    ? `${t(locale, 'continueWorkout')}: ${getRoutineDayDisplayName(selectedRoutineDay ?? todayRoutineDay, locale) ?? t(locale, 'freeWorkout')}`
    : isTodayRestDay
      ? t(locale, 'restDay')
      : getRoutineDayDisplayName(todayRoutineDay, locale) ?? t(locale, 'noRoutineDayPlanned');
  const workoutCtaLabel = inProgressSession
    ? t(locale, 'continueTodayWorkout')
    : selectedRoutineDayId
      ? t(locale, 'startPlannedWorkout')
      : t(locale, 'startFreeWorkout');

  return (
    <section className="viewport-locked mx-auto max-w-md gap-2.5 p-3.5">
      
      {/* Hero Welcome Card */}
      <header className="shrink-0 overflow-hidden rounded-2xl border border-slate-650 bg-slate-750/95 p-3.5 shadow-xl">
        <p className="text-xs font-extrabold uppercase text-cyan-300">{t(locale, 'today')}</p>
        <h1 className="mt-0.5 text-[2rem] font-extrabold leading-none text-cyan-200">
          SetGo
        </h1>
        <p className="mt-1 text-sm font-bold text-slate-100">{todayLabel}</p>
      </header>

      {/* Middle Scrollable Section */}
      <div className="inner-scroll space-y-2.5 pr-0.5 py-0.5">

        {/* Active Routine Card */}
        <section className="flex flex-col gap-2.5 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 shadow-md shadow-cyan-500/20">
              <Dumbbell aria-hidden="true" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 truncate text-base font-bold text-white">
                {activeRoutineName ?? t(locale, 'noActiveRoutine')}
              </h2>
            </div>
          </div>

          <div className="rounded-xl border border-slate-650 bg-slate-850/85 px-3 py-2.5">
            <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'todaysPlan')}</p>
            <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-cyan-200">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
              {planLabel}
            </p>
          </div>

          <p className="text-sm font-medium leading-5 text-slate-100">
            {inProgressSession
              ? locale === 'ko' ? '진행 중인 운동을 이어서 기록합니다.' : 'An in-progress workout will continue from its saved routine day.'
              : isTodayRestDay && activeRoutine
              ? locale === 'ko' ? '휴식일에 운동한다면 다음 루틴을 선택하세요.' : 'Tap the next routine if you decide to train on this rest day.'
              : activeRoutine
              ? locale === 'ko' ? '주간 계획에 맞춰 오늘 루틴을 불러왔습니다. 시작 전 다른 루틴으로 바꿀 수 있습니다.' : 'Today is matched to your weekly schedule. You can choose a different routine day before starting.'
              : locale === 'ko' ? '루틴 설정에서 첫 운동 계획을 만들어 보세요.' : 'Choose Routine Setup to create your first local plan.'}
          </p>

          {isTodayRestDay && !inProgressSession && nextRoutineDay ? (
            <button
              type="button"
              onClick={() => setSelectedRoutineDayId(nextRoutineDay.id)}
              className={`min-h-10 w-full rounded-xl border px-3 text-left text-sm font-bold transition-all active:scale-98 ${
                selectedRoutineDayId === nextRoutineDay.id
                  ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                  : 'bg-slate-850 border-slate-650 text-slate-100 hover:bg-slate-750'
              }`}
            >
              {locale === 'ko' ? '💡 추천 다음 루틴' : '💡 Recommended Next'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
            </button>
          ) : null}

          {/* Dynamic Horizontal Split Planner Tags */}
          {routineDays.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {routineDays.map((routineDay) => (
                <button
                  key={routineDay.id}
                  type="button"
                  onClick={() => setSelectedRoutineDayId(routineDay.id)}
                  className={`min-h-9 rounded-full border px-3 text-sm font-bold transition-all active:scale-95 ${
                    selectedRoutineDayId === routineDay.id
                      ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                      : 'bg-slate-850 border-slate-650 text-slate-100 hover:bg-slate-750'
                  }`}
                >
                  {getRoutineDayDisplayName(routineDay, locale)}
                </button>
              ))}
            </div>
          ) : null}

          {/* Planned Exercises Pills Carousel */}
          {plannedExerciseNames.length > 0 ? (
            <div className="rounded-xl border border-slate-650 bg-slate-850/85 px-3 py-2.5">
              <p className="mb-1.5 text-xs font-extrabold uppercase text-slate-200">{t(locale, 'plannedExercises')}</p>
              <div className="flex flex-wrap gap-1.5">
                {plannedExerciseNames.slice(0, 6).map((exerciseName) => (
                  <span key={exerciseName} className="rounded-lg border border-slate-650 bg-slate-750 px-2.5 py-1 text-xs font-bold text-slate-100">
                    {exerciseName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Last Workout Summary Card */}
        <section className="rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
          <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'lastWorkout')}</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-bold text-white">
            {latestFinishedWorkout ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                <span className="text-slate-200">{latestFinishedWorkout.session.date}</span>
                <span className="text-slate-400">/</span>
                <span className="text-cyan-300 font-bold">
                  {getRoutineDayDisplayName(latestFinishedWorkout.routineDay, locale) ?? latestFinishedWorkout.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                </span>
              </>
            ) : (
              <span className="text-slate-350">{t(locale, 'noFinishedWorkout')}</span>
            )}
          </h2>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-100">
            {latestFinishedWorkout
              ? `${workoutStatusLabel(locale, latestFinishedWorkout.session.status)} • ${exerciseCountLabel(locale, latestFinishedWorkout.exerciseCount)} • ${latestFinishedWorkout.session.totalStrengthVolumeKg.toLocaleString()} kg`
              : locale === 'ko' ? '운동을 완료하거나 건너뛰면 기록이 누적됩니다.' : 'Complete or skip a session to build your local history.'}
          </p>
        </section>
      </div>

      <footer className="shrink-0 border-t border-slate-650 pt-2.5">
        <button
          type="button"
          onClick={() => onStartWorkout(selectedRoutineDayId)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-455 px-4 text-base font-black text-slate-955 shadow-lg shadow-cyan-400/20 transition-all hover:from-cyan-300 hover:to-cyan-400 active:scale-95"
        >
          <Play aria-hidden="true" size={19} />
          <span>{workoutCtaLabel}</span>
        </button>
      </footer>
    </section>
  );
}
