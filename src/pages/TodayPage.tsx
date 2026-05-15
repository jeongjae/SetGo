import { BarChart3, CalendarDays, Download, Dumbbell, Play, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import {
  ensureActiveRoutineTemplateVersion,
  getActiveRoutineDays,
  getNextRoutineDayAfterLatestWorkout,
  getRoutineDayDisplayName,
  getRoutineScheduleForDate,
  getRoutineSplitName,
} from '../db/routines';
import { seedDefaultExercises } from '../db/seed';
import { getRecentWorkoutSummaries, getTodayWorkout, type WorkoutSummary } from '../db/workouts';
import { getExerciseName } from '../domain/exercises';
import { getStoredLocale, t, type MessageKey } from '../i18n/i18n';
import type { AppView } from '../app/App';
import type { Routine, RoutineDay, WorkoutSession } from '../types';

type TodayPageProps = {
  refreshKey: number;
  onNavigate: (view: AppView) => void;
  onStartWorkout: (routineDayId?: string) => void;
};

const todayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const actions: Array<{
  labelKey: MessageKey;
  icon: typeof Play;
  primary?: boolean;
  view?: AppView;
}> = [
  { labelKey: 'startWorkout', icon: Play, primary: true },
  { labelKey: 'calendar', icon: CalendarDays, view: 'calendar' },
  { labelKey: 'stats', icon: BarChart3, view: 'stats' },
  { labelKey: 'settings', icon: Settings, view: 'routineSetup' },
  { labelKey: 'export', icon: Download, view: 'export' },
];

export function TodayPage({ refreshKey, onNavigate, onStartWorkout }: TodayPageProps) {
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

  const todayLabel = useMemo(() => todayFormatter.format(new Date()), []);

  useEffect(() => {
    async function load() {
      try {
        await seedDefaultExercises();
        await ensureActiveRoutineTemplateVersion();

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

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-cyan-300">{t(locale, 'today')}</p>
        <h1 className="mt-1 text-3xl font-bold text-white">SetGo</h1>
        <p className="mt-2 text-base text-slate-200">{todayLabel}</p>
      </header>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-slate-950">
            <Dumbbell aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{t(locale, 'activeRoutine')}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {activeRoutineName ?? t(locale, 'noActiveRoutine')}
            </h2>
            <div className="mt-3 rounded-md bg-slate-800 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'todaysPlan')}</p>
              <p className="mt-1 text-base font-semibold text-white">{planLabel}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {inProgressSession
                ? locale === 'ko' ? '진행 중인 운동을 이어서 기록합니다.' : 'An in-progress workout will continue from its saved routine day.'
                : isTodayRestDay && activeRoutine
                ? locale === 'ko' ? '휴식일에 운동한다면 다음 루틴을 선택하세요.' : 'Tap the next routine if you decide to train on this rest day.'
                : activeRoutine
                ? locale === 'ko' ? '주간 계획에 맞춰 오늘 루틴을 불러왔습니다. 시작 전 다른 루틴으로 바꿀 수 있습니다.' : 'Today is matched to your weekly schedule. You can choose a different routine day before starting.'
                : locale === 'ko' ? '루틴 설정에서 첫 운동 계획을 만들어 보세요.' : 'Choose Routine Setup to create your first local plan.'}
            </p>
          </div>
        </div>
        {isTodayRestDay && !inProgressSession && nextRoutineDay ? (
          <button
            type="button"
            onClick={() => setSelectedRoutineDayId(nextRoutineDay.id)}
            className={`mt-4 min-h-11 w-full rounded-md px-3 text-left text-sm font-semibold ${
              selectedRoutineDayId === nextRoutineDay.id
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-800 text-slate-100'
            }`}
          >
            {locale === 'ko' ? '다음 루틴' : 'Next routine'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
          </button>
        ) : null}
        {routineDays.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {routineDays.map((routineDay) => (
              <button
                key={routineDay.id}
                type="button"
                onClick={() => setSelectedRoutineDayId(routineDay.id)}
                className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                  selectedRoutineDayId === routineDay.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                {getRoutineDayDisplayName(routineDay, locale)}
              </button>
            ))}
          </div>
        ) : null}
        {plannedExerciseNames.length > 0 ? (
          <div className="mt-3 rounded-md bg-slate-800 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'plannedExercises')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {plannedExerciseNames.slice(0, 4).map((exerciseName) => (
                <span key={exerciseName} className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200">
                  {exerciseName}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'lastWorkout')}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {latestFinishedWorkout
            ? `${latestFinishedWorkout.session.date} / ${getRoutineDayDisplayName(latestFinishedWorkout.routineDay, locale) ?? latestFinishedWorkout.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}`
            : t(locale, 'noFinishedWorkout')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {latestFinishedWorkout
            ? `${latestFinishedWorkout.session.status} / ${latestFinishedWorkout.exerciseCount} exercises / ${latestFinishedWorkout.session.totalStrengthVolumeKg.toLocaleString()} kg`
            : locale === 'ko' ? '운동을 완료하거나 건너뛰면 기록이 쌓입니다.' : 'Complete or skip a session to build your local history.'}
        </p>
      </section>

      <nav aria-label="Today actions" className="grid grid-cols-2 gap-3">
        {actions.map(({ labelKey, icon: Icon, primary, view }) => (
          <button
            key={labelKey}
            type="button"
            onClick={() => {
              if (labelKey === 'startWorkout') {
                onStartWorkout(selectedRoutineDayId);
                return;
              }

              if (view) onNavigate(view);
            }}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold shadow ${
              primary
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-800 text-slate-100'
            }`}
          >
            <Icon aria-hidden="true" size={18} />
            <span>
              {labelKey === 'startWorkout' && !inProgressSession && isTodayRestDay && !selectedRoutineDayId
                ? t(locale, 'startFreeWorkout')
                : t(locale, labelKey)}
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
