import { Dumbbell, Footprints, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import {
  getActiveRoutineDays,
  getNextRoutineDayAfterLatestWorkout,
  getRoutineDayDisplayName,
  getRoutineScheduleForDate,
} from '../db/routines';
import { seedDefaultExercises } from '../db/seed';
import { deleteWorkoutSession, getRecentWorkoutSummaries, getTodayWorkout, getWorkoutCardioRecords, getWorkoutSummariesForDate, type WorkoutSummary } from '../db/workouts';
import { getExerciseName } from '../domain/exercises';
import { exerciseCountLabel, getStoredLocale, t, workoutStatusLabel } from '../i18n/i18n';
import type { CardioRecord, Routine, RoutineDay, WorkoutSession, WorkoutSessionKind } from '../types';
import { formatDateKey } from '../utils/date';

type TodayPageProps = {
  refreshKey: number;
  onStartWorkout: (routineDayId?: string, sessionId?: string, createNew?: boolean, kind?: WorkoutSessionKind) => void;
};

function getRoutinePlanPrefix(routine: Routine | undefined, locale: 'ko' | 'en'): string | undefined {
  if (!routine) return undefined;
  const splitNumber = routine.name.match(/(\d+)[-\s]?Day/i)?.[1] ?? routine.name.match(/(\d+)분할/)?.[1];
  if (splitNumber) return locale === 'ko' ? `${splitNumber}분할 루틴` : `${splitNumber}-Day Routine`;
  return routine.name;
}

export function todayWorkoutSummaryLabel(
  summary: Pick<WorkoutSummary, 'routineDay' | 'routineName'> & {
    session: Pick<WorkoutSession, 'entryKind'>;
  },
  locale: 'ko' | 'en',
): string {
  if (summary.session.entryKind === 'running') return locale === 'ko' ? '러닝' : 'Running';
  if (summary.session.entryKind === 'free') return t(locale, 'freeWorkout');
  return getRoutineDayDisplayName(summary.routineDay, locale) ?? summary.routineName ?? t(locale, 'freeWorkout');
}

export function summarizeRunningRecordsForTodayCard(
  records: Array<Pick<CardioRecord, 'distanceKm' | 'startedAt' | 'endedAt' | 'isDraft'>>,
  locale: 'ko' | 'en',
): string | undefined {
  const loggedRecords = records.filter((record) => record.isDraft !== true);
  if (loggedRecords.length === 0) return undefined;

  const distanceKm = loggedRecords.reduce((sum, record) => sum + (record.distanceKm ?? 0), 0);
  const minutes = loggedRecords.reduce((sum, record) => {
    const startedAt = new Date(record.startedAt).getTime();
    const endedAt = new Date(record.endedAt).getTime();
    if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) return sum;
    return sum + Math.max(1, Math.round((endedAt - startedAt) / 60000));
  }, 0);

  const minuteLabel = locale === 'ko' ? '분' : 'min';
  return `${distanceKm.toFixed(1)} km / ${minutes} ${minuteLabel}`;
}

function isRunningWorkoutSummary(summary: WorkoutSummary): boolean {
  return summary.session.entryKind === 'running'
    || (summary.cardioCount > 0 && summary.exerciseCount === 0);
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
  const [latestFinishedCardioRecords, setLatestFinishedCardioRecords] = useState<CardioRecord[]>([]);
  const [recentRoutineWorkouts, setRecentRoutineWorkouts] = useState<WorkoutSummary[]>([]);
  const [isTodayRestDay, setIsTodayRestDay] = useState(false);
  const [isTodayRunningPlan, setIsTodayRunningPlan] = useState(false);
  const [todayInProgressWorkouts, setTodayInProgressWorkouts] = useState<WorkoutSummary[]>([]);
  const [selectedWorkoutKind, setSelectedWorkoutKind] = useState<WorkoutSessionKind>('planned');
  const [reloadKey, setReloadKey] = useState(0);
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
        const [routine, days, todaySchedule, nextDay, todayWorkout, recentWorkouts, todayWorkouts] = await Promise.all([
          db.routines.filter((routineRecord) => routineRecord.isActive).first(),
          getActiveRoutineDays(),
          getRoutineScheduleForDate(),
          getNextRoutineDayAfterLatestWorkout(),
          getTodayWorkout(),
          getRecentWorkoutSummaries(10),
          getWorkoutSummariesForDate(formatDateKey(new Date())),
        ]);

        setActiveRoutine(routine);
        setRoutineDays(days);
        setInProgressSession(todayWorkout?.session);
        setTodayRoutineDay(todaySchedule.routineDay);
        setNextRoutineDay(nextDay);
        const latestCompletedWorkout = recentWorkouts.find((summary) => summary.session.status === 'completed');
        const seenRoutineDayIds = new Set<string>();
        const recentCompletedRoutineWorkouts = recentWorkouts
          .filter((summary) => (
            summary.session.status === 'completed'
            && summary.session.entryKind !== 'running'
            && summary.session.entryKind !== 'free'
            && Boolean(summary.session.routineDayId)
          ))
          .filter((summary) => {
            const routineDayId = summary.session.routineDayId;
            if (!routineDayId || seenRoutineDayIds.has(routineDayId)) return false;
            seenRoutineDayIds.add(routineDayId);
            return true;
          })
          .slice(0, 3);
        const latestCardioRecords = latestCompletedWorkout
          ? await getWorkoutCardioRecords(latestCompletedWorkout.session.id)
          : [];

        setLatestFinishedWorkout(latestCompletedWorkout);
        setLatestFinishedCardioRecords(latestCardioRecords);
        setRecentRoutineWorkouts(recentCompletedRoutineWorkouts);
        setIsTodayRestDay(todaySchedule.isRestDay);
        setIsTodayRunningPlan(todaySchedule.kind === 'running');
        setTodayInProgressWorkouts(todayWorkouts.filter((summary) => summary.session.status === 'in_progress'));
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
  }, [refreshKey, reloadKey]);

  useEffect(() => {
    async function loadPlannedExercises() {
      if (selectedWorkoutKind !== 'planned' || !selectedRoutineDayId) {
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
  }, [locale, selectedRoutineDayId, selectedWorkoutKind]);

  const selectedRoutineDay = routineDays.find((routineDay) => routineDay.id === selectedRoutineDayId);
  const selectedKindLabel = selectedWorkoutKind === 'running'
    ? locale === 'ko' ? '러닝' : 'Running'
    : selectedWorkoutKind === 'free'
      ? t(locale, 'freeWorkout')
      : undefined;
  const activeRoutineName = activeRoutine?.name;
  const routinePlanPrefix = getRoutinePlanPrefix(activeRoutine, locale);
  const selectedRoutineDayLabel = selectedKindLabel
    ?? getRoutineDayDisplayName(selectedRoutineDay ?? todayRoutineDay, locale)
    ?? t(locale, 'freeWorkout');
  const planLabel = inProgressSession
    ? `${routinePlanPrefix ?? t(locale, 'routine')}: ${selectedRoutineDayLabel}`
    : isTodayRunningPlan
      ? locale === 'ko' ? '러닝' : 'Running'
    : isTodayRestDay
      ? t(locale, 'restDay')
      : getRoutineDayDisplayName(todayRoutineDay, locale) ?? t(locale, 'noRoutineDayPlanned');
  const workoutRecordLabel = locale === 'ko' ? '운동 기록' : 'Log workout';
  const matchingInProgressWorkout = todayInProgressWorkouts.find((summary) => {
    if (selectedWorkoutKind === 'running') return summary.session.entryKind === 'running';
    if (selectedWorkoutKind === 'free') return summary.session.entryKind === 'free';
    return summary.session.routineDayId === selectedRoutineDayId;
  });
  const latestWorkoutDetail = latestFinishedWorkout && isRunningWorkoutSummary(latestFinishedWorkout)
    ? summarizeRunningRecordsForTodayCard(latestFinishedCardioRecords, locale)
    : undefined;

  function handleStartSelectedWorkout() {
    if (matchingInProgressWorkout) {
      onStartWorkout(matchingInProgressWorkout.session.routineDayId, matchingInProgressWorkout.session.id);
      return;
    }

    if (todayInProgressWorkouts.length > 0) {
      const shouldCreate = window.confirm(
        locale === 'ko'
          ? '오늘 진행 중인 운동 기록이 있습니다. 선택한 루틴으로 추가 운동 기록을 새로 만들까요?'
          : 'There is already an in-progress workout today. Start an additional workout for the selected routine?',
      );
      if (!shouldCreate) return;
    }

    const routineDayId = selectedWorkoutKind === 'planned' ? selectedRoutineDayId : undefined;
    onStartWorkout(
      routineDayId,
      undefined,
      todayInProgressWorkouts.length > 0 || selectedWorkoutKind !== 'planned',
      selectedWorkoutKind,
    );
  }

  async function handleDeleteTodayWorkout(sessionId: string) {
    const shouldDelete = window.confirm(
      locale === 'ko'
        ? '이 운동 기록을 삭제할까요? 입력한 세트와 러닝 기록도 함께 삭제됩니다.'
        : 'Delete this workout record? Its sets and running records will also be removed.',
    );
    if (!shouldDelete) return;

    await deleteWorkoutSession(sessionId);
    setReloadKey((current) => current + 1);
  }

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
              onClick={() => {
                setSelectedWorkoutKind('planned');
                setSelectedRoutineDayId(nextRoutineDay.id);
              }}
              className={`min-h-11 w-full rounded-xl border px-3 text-left text-sm font-bold transition-all active:scale-95 ${
                selectedRoutineDayId === nextRoutineDay.id
                  ? 'border-accent-dark bg-accent-dark text-white'
                  : 'border-slate-650 bg-white text-primary hover:bg-accent-soft'
              }`}
            >
              {locale === 'ko' ? '추천 다음 루틴' : 'Recommended Next'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
            </button>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedWorkoutKind('planned')}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black transition-all active:scale-95 ${
                selectedWorkoutKind === 'planned'
                  ? 'border-accent-dark bg-accent-dark text-white'
                  : 'border-slate-650 bg-white text-primary hover:bg-accent-soft'
              }`}
            >
              <Dumbbell aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '루틴' : 'Routine'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedWorkoutKind('running')}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black transition-all active:scale-95 ${
                selectedWorkoutKind === 'running'
                  ? 'border-sky-500 bg-sky-500 text-white'
                  : 'border-slate-650 bg-white text-primary hover:bg-sky-50'
              }`}
            >
              <Footprints aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '러닝' : 'Running'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedWorkoutKind('free')}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black transition-all active:scale-95 ${
                selectedWorkoutKind === 'free'
                  ? 'border-cyan-500 bg-cyan-500 text-white'
                  : 'border-slate-650 bg-white text-primary hover:bg-cyan-50'
              }`}
            >
              <Plus aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '자유' : 'Free'}</span>
            </button>
          </div>

          {routineDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {routineDays.map((routineDay) => (
                <button
                  key={routineDay.id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkoutKind('planned');
                    setSelectedRoutineDayId(routineDay.id);
                  }}
                  className={`min-h-11 rounded-2xl border px-4 text-sm font-bold transition-all active:scale-95 ${
                    selectedWorkoutKind === 'planned' && selectedRoutineDayId === routineDay.id
                      ? 'border-accent-dark bg-accent-dark text-white'
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

          {recentRoutineWorkouts.length > 0 ? (
            <div className="rounded-2xl border border-accent/20 bg-accent-soft/55 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-primary">{locale === 'ko' ? '최근 루틴 빠른 시작' : 'Recent routine starts'}</p>
                <span className="text-[11px] font-bold text-text-secondary">{locale === 'ko' ? 'Hevy식 바로 기록' : 'Tap to log'}</span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {recentRoutineWorkouts.map((summary) => (
                  <button
                    key={summary.session.id}
                    type="button"
                    onClick={() => onStartWorkout(summary.session.routineDayId)}
                    className="min-h-11 shrink-0 rounded-xl border border-accent/25 bg-white px-3 text-left shadow-sm active:scale-95"
                  >
                    <span className="block text-sm font-black text-primary">
                      {todayWorkoutSummaryLabel(summary, locale)}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-text-secondary">
                      {summary.session.date} / {summary.session.totalStrengthVolumeKg.toLocaleString()}kg
                    </span>
                  </button>
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
                  {todayWorkoutSummaryLabel(latestFinishedWorkout, locale)}
                </span>
              </>
            ) : (
              <span className="text-text-muted">{t(locale, 'noFinishedWorkout')}</span>
            )}
          </h2>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-text-secondary">
            {latestFinishedWorkout
              ? latestWorkoutDetail
                ? `${workoutStatusLabel(locale, latestFinishedWorkout.session.status)} · ${latestWorkoutDetail}`
                : `${workoutStatusLabel(locale, latestFinishedWorkout.session.status)} · ${exerciseCountLabel(locale, latestFinishedWorkout.exerciseCount)} · ${latestFinishedWorkout.session.totalStrengthVolumeKg.toLocaleString()} kg`
              : locale === 'ko' ? '운동을 완료하면 기록이 쌓입니다.' : 'Complete a session to build your local history.'}
          </p>
        </section>

        {todayInProgressWorkouts.length > 0 ? (
          <section className="space-y-2 rounded-[1.5rem] border border-accent/20 bg-accent-soft/45 p-4 shadow-card [@media(max-height:820px)]:p-3">
            <p className="text-sm font-black text-primary">
              {locale === 'ko' ? '오늘 진행 중인 운동' : 'In-progress workouts today'}
            </p>
            {todayInProgressWorkouts.map((summary) => (
              <div key={summary.session.id} className="flex items-center gap-2 rounded-xl border border-slate-650 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => onStartWorkout(summary.session.routineDayId, summary.session.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-black text-primary">
                    {todayWorkoutSummaryLabel(summary, locale)}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-text-secondary">
                    {locale === 'ko' ? '이어 기록하기' : 'Continue logging'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteTodayWorkout(summary.session.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger transition-all active:scale-95"
                  aria-label={locale === 'ko' ? '운동 기록 삭제' : 'Delete workout record'}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </section>
        ) : null}
      </div>

      <footer className="shrink-0 pt-1">
        <button
          type="button"
          onClick={handleStartSelectedWorkout}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-success to-emerald-500 px-4 text-lg font-black text-white shadow-lg shadow-success/20 transition-all active:scale-95"
        >
          <Play aria-hidden="true" size={20} />
          <span>{workoutRecordLabel}</span>
        </button>
      </footer>
    </section>
  );
}
