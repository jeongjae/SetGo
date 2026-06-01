import { Dumbbell, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import {
  getActiveRoutineDays,
  getNextRoutineDayAfterLatestWorkout,
  getRoutineDayDisplayName,
  getRoutineScheduleForDate,
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

function getRoutinePlanPrefix(routine: Routine | undefined, locale: 'ko' | 'en'): string | undefined {
  if (!routine) return undefined;
  const splitNumber = routine.name.match(/(\d+)[-\s]?Day/i)?.[1] ?? routine.name.match(/(\d+)분할/)?.[1];
  if (splitNumber) return locale === 'ko' ? `${splitNumber}분할 루틴` : `${splitNumber}-Day Routine`;
  return routine.name;
}

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
  const [isTodayRunningPlan, setIsTodayRunningPlan] = useState(false);
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
        setIsTodayRunningPlan(todaySchedule.kind === 'running');
        setSelectedRoutineDayId((current) => {
          const scheduledRoutineDayId = todaySchedule.kind === 'routine' && !todaySchedule.isRestDay ? todaySchedule.routineDay?.id : undefined;
          return todayWorkout?.session.routineDayId
            ?? scheduledRoutineDayId
            ?? (days.some((day) => day.id === current) ? current : undefined);
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
  const activeRoutineName = activeRoutine?.name;
  const routinePlanPrefix = getRoutinePlanPrefix(activeRoutine, locale);
  const selectedRoutineDayLabel = getRoutineDayDisplayName(selectedRoutineDay ?? todayRoutineDay, locale) ?? t(locale, 'freeWorkout');
  const planLabel = inProgressSession
    ? `${routinePlanPrefix ?? t(locale, 'routine')}: ${selectedRoutineDayLabel}`
    : isTodayRunningPlan
      ? locale === 'ko' ? '러닝' : 'Running'
    : isTodayRestDay
      ? t(locale, 'restDay')
      : getRoutineDayDisplayName(todayRoutineDay, locale) ?? t(locale, 'noRoutineDayPlanned');
  const workoutRecordLabel = locale === 'ko' ? '운동 기록' : 'Log workout';

  return (
    <section className="viewport-locked mx-auto max-w-md gap-3 bg-background p-3.5 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-3">
      <header className="relative min-h-[9.5rem] shrink-0 overflow-hidden rounded-[1.75rem] border border-slate-650 bg-white px-5 py-4 shadow-card [@media(max-height:820px)]:min-h-[7.5rem] [@media(max-height:820px)]:px-4 [@media(max-height:820px)]:py-3">
        <div aria-hidden="true" className="absolute -right-10 -top-14 h-56 w-56 rounded-full border border-accent-soft" />
        <div aria-hidden="true" className="absolute -right-4 -top-7 h-44 w-44 rounded-full border border-accent-soft" />
        <div aria-hidden="true" className="absolute right-6 top-3 h-32 w-32 rounded-full border border-accent-soft" />
        <p className="relative text-sm font-extrabold text-accent-dark">{t(locale, 'today')}</p>
        <h1 className="relative mt-2 text-[2.75rem] font-black leading-none text-primary [@media(max-height:820px)]:mt-1 [@media(max-height:820px)]:text-[2.25rem]">SetGo</h1>
        <p className="relative mt-3 text-base font-bold text-text-secondary [@media(max-height:820px)]:mt-2 [@media(max-height:820px)]:text-sm">{todayLabel}</p>
      </header>

      <div className="inner-scroll space-y-3 py-0.5 pr-0.5 [@media(max-height:820px)]:space-y-2">
        <section className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-650 bg-white p-4 shadow-card [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent-soft text-accent-dark">
              <Dumbbell aria-hidden="true" size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-secondary">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 truncate text-xl font-black text-primary">
                {activeRoutineName ?? t(locale, 'noActiveRoutine')}
              </h2>
            </div>
          </div>

          <div className="rounded-2xl border border-accent/15 bg-accent-soft/55 px-4 py-3">
            <p className="text-sm font-bold text-text-secondary">{t(locale, 'todaysPlan')}</p>
            <p className="mt-1.5 flex items-center gap-2 text-lg font-black text-accent-dark">
              <span className="inline-block h-3 w-3 rounded-full bg-accent-dark" />
              {planLabel}
            </p>
          </div>

          <p className="text-sm font-medium leading-5 text-text-secondary">
            {inProgressSession
              ? locale === 'ko' ? '진행 중인 운동을 이어서 기록합니다.' : 'An in-progress workout will continue from its saved routine day.'
              : isTodayRestDay && activeRoutine
              ? locale === 'ko' ? '휴식일에 운동한다면 다음 루틴을 선택하세요.' : 'Tap the next routine if you decide to train on this rest day.'
              : activeRoutine
              ? locale === 'ko' ? '운동 사이클에 맞춰 오늘 루틴을 불러왔습니다. 시작 전 다른 루틴으로 바꿀 수 있습니다.' : 'Today is matched to your workout cycle. You can choose a different routine day before starting.'
              : locale === 'ko' ? '루틴 설정에서 첫 운동 계획을 만들어 보세요.' : 'Choose Routine Setup to create your first local plan.'}
          </p>

          {isTodayRestDay && !inProgressSession && nextRoutineDay ? (
            <button
              type="button"
              onClick={() => setSelectedRoutineDayId(nextRoutineDay.id)}
              className={`min-h-11 w-full rounded-xl border px-3 text-left text-sm font-bold transition-all active:scale-95 ${
                selectedRoutineDayId === nextRoutineDay.id
                  ? 'border-accent-dark bg-accent-dark text-white shadow-accent'
                  : 'border-slate-650 bg-white text-primary hover:bg-accent-soft'
              }`}
            >
              {locale === 'ko' ? '추천 다음 루틴' : 'Recommended Next'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
            </button>
          ) : null}

          {routineDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {routineDays.map((routineDay) => (
                <button
                  key={routineDay.id}
                  type="button"
                  onClick={() => setSelectedRoutineDayId(routineDay.id)}
                  className={`min-h-11 rounded-2xl border px-4 text-sm font-bold transition-all active:scale-95 ${
                    selectedRoutineDayId === routineDay.id
                      ? 'border-accent-dark bg-accent-dark text-white shadow-accent'
                      : 'border-slate-650 bg-white text-primary hover:bg-accent-soft'
                  }`}
                >
                  {getRoutineDayDisplayName(routineDay, locale)}
                </button>
              ))}
            </div>
          ) : null}

          {plannedExerciseNames.length > 0 ? (
            <div className="rounded-2xl border border-slate-650 bg-surface-muted px-3 py-3">
              <p className="mb-2 text-sm font-bold text-text-secondary">{t(locale, 'plannedExercises')}</p>
              <div className="flex flex-wrap gap-2">
                {plannedExerciseNames.slice(0, 6).map((exerciseName) => (
                  <span key={exerciseName} className="rounded-xl border border-accent-dark/65 bg-white px-2.5 py-1.5 text-xs font-bold text-primary">
                    {exerciseName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[1.5rem] border border-slate-650 bg-white p-4 shadow-card [@media(max-height:820px)]:p-3">
          <p className="text-sm font-bold text-text-secondary">{t(locale, 'lastWorkout')}</p>
          <h2 className="mt-1.5 flex items-center gap-2 text-base font-black text-primary">
            {latestFinishedWorkout ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full bg-success" />
                <span>{latestFinishedWorkout.session.date}</span>
                <span className="text-slate-400">/</span>
                <span className="font-black text-success">
                  {getRoutineDayDisplayName(latestFinishedWorkout.routineDay, locale) ?? latestFinishedWorkout.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                </span>
              </>
            ) : (
              <span className="text-text-muted">{t(locale, 'noFinishedWorkout')}</span>
            )}
          </h2>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-text-secondary">
            {latestFinishedWorkout
              ? `${workoutStatusLabel(locale, latestFinishedWorkout.session.status)} · ${exerciseCountLabel(locale, latestFinishedWorkout.exerciseCount)} · ${latestFinishedWorkout.session.totalStrengthVolumeKg.toLocaleString()} kg`
              : locale === 'ko' ? '운동을 완료하면 기록이 쌓입니다.' : 'Complete a session to build your local history.'}
          </p>
        </section>
      </div>

      <footer className="shrink-0 pt-1">
        <button
          type="button"
          onClick={() => onStartWorkout(selectedRoutineDayId)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-hover px-4 text-lg font-black text-white shadow-lg shadow-primary/15 transition-all active:scale-95"
        >
          <Play aria-hidden="true" size={20} />
          <span>{workoutRecordLabel}</span>
        </button>
      </footer>
    </section>
  );
}
