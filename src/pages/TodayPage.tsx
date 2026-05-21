import { BarChart3, CalendarDays, Download, Dumbbell, Play, Settings } from 'lucide-react';
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
import { exerciseCountLabel, getStoredLocale, t, workoutStatusLabel, type MessageKey } from '../i18n/i18n';
import type { AppView } from '../app/App';
import type { Routine, RoutineDay, WorkoutSession } from '../types';

type TodayPageProps = {
  refreshKey: number;
  onNavigate: (view: AppView) => void;
  onStartWorkout: (routineDayId?: string) => void;
};

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
  const actionLabel = (labelKey: MessageKey) => {
    if (labelKey === 'startWorkout') return locale === 'ko' ? '운동일지' : 'Workout Log';
    if (labelKey === 'export') return locale === 'ko' ? '가져오기/내보내기' : 'Export/Restore';
    return t(locale, labelKey);
  };

  return (
    <section className="viewport-locked mx-auto max-w-md p-4 gap-3.5">
      
      {/* Hero Welcome Card - Glassmorphism */}
      <header className="relative overflow-hidden rounded-2xl bg-slate-800/85 backdrop-blur-md border border-slate-700/80 p-4.5 shadow-2xl shrink-0">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-cyan-500/10 blur-xl"></div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">{t(locale, 'today')}</p>
        <h1 className="mt-0.5 text-4xl font-extrabold bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.25)]">
          SetGo
        </h1>
        <p className="mt-1.5 text-[13px] font-bold text-slate-200">{todayLabel}</p>
      </header>

      {/* Middle Scrollable Section */}
      <div className="inner-scroll space-y-3.5 pr-0.5 py-0.5">

        {/* Active Routine Glass Card */}
        <section className="rounded-2xl bg-slate-800/80 backdrop-blur-md border border-slate-700/80 p-5 shadow-2xl flex flex-col gap-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <Dumbbell aria-hidden="true" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wide">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 text-lg font-bold text-white truncate">
                {activeRoutineName ?? t(locale, 'noActiveRoutine')}
              </h2>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t(locale, 'todaysPlan')}</p>
            <p className="mt-1 text-[15px] font-bold text-cyan-300 flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
              {planLabel}
            </p>
          </div>

          <p className="text-[13px] leading-5 text-slate-300 font-medium">
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
              className={`mt-1 min-h-11 w-full rounded-xl px-4 text-left text-xs font-bold transition-all active:scale-98 border ${
                selectedRoutineDayId === nextRoutineDay.id
                  ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                  : 'bg-slate-900 border-slate-850 text-slate-200 hover:bg-slate-850'
              }`}
            >
              {locale === 'ko' ? '💡 추천 다음 루틴' : '💡 Recommended Next'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
            </button>
          ) : null}

          {/* Dynamic Horizontal Split Planner Tags */}
          {routineDays.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-2 pb-1">
              {routineDays.map((routineDay) => (
                <button
                  key={routineDay.id}
                  type="button"
                  onClick={() => setSelectedRoutineDayId(routineDay.id)}
                  className={`min-h-9 rounded-full px-4 text-xs font-bold transition-all active:scale-95 border ${
                    selectedRoutineDayId === routineDay.id
                      ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {getRoutineDayDisplayName(routineDay, locale)}
                </button>
              ))}
            </div>
          ) : null}

          {/* Planned Exercises Pills Carousel */}
          {plannedExerciseNames.length > 0 ? (
            <div className="mt-1 rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">{t(locale, 'plannedExercises')}</p>
              <div className="flex flex-wrap gap-1.5">
                {plannedExerciseNames.slice(0, 6).map((exerciseName) => (
                  <span key={exerciseName} className="rounded-lg bg-slate-800 border border-slate-700/80 px-2.5 py-1 text-xs font-bold text-slate-200">
                    {exerciseName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Last Workout Summary Glass Card */}
        <section className="rounded-2xl bg-slate-800/80 backdrop-blur-md border border-slate-700/80 p-5 shadow-2xl">
          <p className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wide">{t(locale, 'lastWorkout')}</p>
          <h2 className="mt-1.5 text-sm font-bold text-white flex items-center gap-2">
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
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300">
            {latestFinishedWorkout
              ? `${workoutStatusLabel(locale, latestFinishedWorkout.session.status)} • ${exerciseCountLabel(locale, latestFinishedWorkout.exerciseCount)} • ${latestFinishedWorkout.session.totalStrengthVolumeKg.toLocaleString()} kg`
              : locale === 'ko' ? '운동을 완료하거나 건너뛰면 기록이 누적됩니다.' : 'Complete or skip a session to build your local history.'}
          </p>
        </section>
      </div>

      {/* Grid of Dynamic Premium Navigation Actions */}
      <nav aria-label="Today actions" className="grid grid-cols-2 gap-3 shrink-0">
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
            className={`flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-bold transition-all border active:scale-95 shadow-lg ${
              primary
                ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 border-cyan-400 text-slate-950 shadow-cyan-500/20 hover:opacity-95'
                : 'bg-slate-800/80 backdrop-blur-sm border-slate-700/80 text-slate-200 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <Icon aria-hidden="true" size={20} className={primary ? 'animate-pulse shrink-0' : 'shrink-0'} />
            <span className="tracking-wide text-[13px]">
              {labelKey === 'startWorkout' && !inProgressSession && isTodayRestDay && !selectedRoutineDayId
                ? t(locale, 'startFreeWorkout')
                : actionLabel(labelKey)}
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
