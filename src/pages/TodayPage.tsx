import { Dumbbell, Footprints, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IOSSegmentedControl } from '../components/IosPrimitives';
import { db } from '../db/db';
import {
  getActiveRoutineDays,
  getNextRoutineDayAfterLatestWorkout,
  getRoutineDayDisplayName,
  getRoutineScheduleForDate,
} from '../db/routines';
import { seedDefaultExercises } from '../db/seed';
import {
  deleteWorkoutSession,
  getRecentWorkoutSummaries,
  getTodayWorkout,
  getWorkoutSummariesForDate,
  type WorkoutSummary,
} from '../db/workouts';
import {
  buildDailyWorkoutRecommendation,
  type DailyWorkoutRecommendation,
  type DailyWorkoutRecommendationReason,
} from '../domain/dailyRecommendation';
import { getExerciseName } from '../domain/exercises';
import { getStoredLocale, t, type AppLocale } from '../i18n/i18n';
import type { CardioRecord, Routine, RoutineDay, WorkoutRecommendationSnapshot, WorkoutSession, WorkoutSessionKind } from '../types';
import { formatDateKey } from '../utils/date';

type TodayPageProps = {
  refreshKey: number;
  onStartWorkout: (routineDayId?: string, sessionId?: string, createNew?: boolean, kind?: WorkoutSessionKind, recommendationSnapshot?: WorkoutRecommendationSnapshot) => void;
};

function getRoutinePlanPrefix(routine: Routine | undefined, locale: 'ko' | 'en'): string | undefined {
  if (!routine) return undefined;
  const splitNumber = routine.name.match(/(\d+)[-\s]?Day/i)?.[1] ?? routine.name.match(/(\d+)분할/)?.[1];
  if (splitNumber) return locale === 'ko' ? `${splitNumber}분할 루틴` : `${splitNumber}-Day Routine`;
  return routine.name;
}

function dailyRecommendationReasonLabel(reason: DailyWorkoutRecommendationReason, locale: AppLocale): string {
  if (reason === 'manualOverride') return t(locale, 'todayRecommendationManualOverride');
  if (reason === 'cycleRoutine') return t(locale, 'todayRecommendationCycleRoutine');
  if (reason === 'weeklyRoutine') return t(locale, 'todayRecommendationWeeklyRoutine');
  if (reason === 'plannedRunning') return t(locale, 'todayRecommendationRunning');
  if (reason === 'restDay') return t(locale, 'todayRecommendationRestDay');
  if (reason === 'nextRoutineAfterLatestWorkout') return t(locale, 'todayRecommendationNextRoutine');
  return t(locale, 'todayRecommendationNoRoutine');
}

function toWorkoutRecommendationSnapshot(
  recommendation: DailyWorkoutRecommendation | undefined,
): WorkoutRecommendationSnapshot | undefined {
  if (!recommendation) return undefined;

  return {
    kind: recommendation.kind,
    sessionKind: recommendation.sessionKind,
    routineDayId: recommendation.routineDay?.id,
    label: recommendation.label,
    source: recommendation.source,
    reason: recommendation.reason,
    confidence: recommendation.confidence,
    createdAt: new Date().toISOString(),
  };
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

export function TodayPage({ refreshKey, onStartWorkout }: TodayPageProps) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [inProgressSession, setInProgressSession] = useState<WorkoutSession | undefined>();
  const [selectedRoutineDayId, setSelectedRoutineDayId] = useState<string | undefined>();
  const [todayRoutineDay, setTodayRoutineDay] = useState<RoutineDay | undefined>();
  const [nextRoutineDay, setNextRoutineDay] = useState<RoutineDay | undefined>();
  const [plannedExerciseNames, setPlannedExerciseNames] = useState<string[]>([]);
  const [recentRoutineWorkouts, setRecentRoutineWorkouts] = useState<WorkoutSummary[]>([]);
  const [dailyRecommendation, setDailyRecommendation] = useState<DailyWorkoutRecommendation | undefined>();
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
        const recommendation = buildDailyWorkoutRecommendation({
          schedule: todaySchedule,
          nextRoutineDay: nextDay,
          hasActiveRoutine: Boolean(routine),
          freeWorkoutLabel: t(locale, 'freeWorkout'),
          runningLabel: locale === 'ko' ? '러닝' : 'Running',
          restDayLabel: t(locale, 'restDay'),
          noRoutineDayLabel: t(locale, 'noRoutineDayPlanned'),
          getRoutineDayLabel: (routineDay) => getRoutineDayDisplayName(routineDay, locale),
        });
        setDailyRecommendation(recommendation);

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

        setRecentRoutineWorkouts(recentCompletedRoutineWorkouts);
        setIsTodayRestDay(todaySchedule.isRestDay);
        setIsTodayRunningPlan(todaySchedule.kind === 'running');
        setTodayInProgressWorkouts(todayWorkouts.filter((summary) => summary.session.status === 'in_progress'));
        setSelectedWorkoutKind((current) => (
          todayWorkout?.session.entryKind
            ?? (current === 'planned' ? recommendation.sessionKind : current)
        ));
        setSelectedRoutineDayId((current) => {
          const scheduledRoutineDayId = todaySchedule.kind === 'routine' && !todaySchedule.isRestDay
            ? todaySchedule.routineDay?.id
            : undefined;

          return todayWorkout?.session.routineDayId
            ?? scheduledRoutineDayId
            ?? recommendation.routineDay?.id
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
      toWorkoutRecommendationSnapshot(dailyRecommendation),
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
    <section className="viewport-locked ios-screen mx-auto max-w-md gap-2.5 p-3.5 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-3">
      <header className="shrink-0 px-1 pb-1 pt-1">
        <p className="text-sm font-bold text-accent-dark">{t(locale, 'today')}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="text-[2rem] font-black leading-none text-[#1C1C1E]">SetGo</h1>
          <p className="pb-0.5 text-sm font-semibold text-[#6E6E73]">{todayLabel}</p>
        </div>
      </header>

      <div className="inner-scroll space-y-2.5 py-0.5 pr-0.5 [@media(max-height:820px)]:space-y-2">
        <section className="ios-card flex flex-col gap-2.5 p-3.5 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8F3F3] text-accent-dark">
              <Dumbbell aria-hidden="true" size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 truncate text-xl font-black text-[#1C1C1E]">
                {activeRoutineName ?? t(locale, 'noActiveRoutine')}
              </h2>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F2F2F7] px-3.5 py-3">
            <p className="text-sm font-bold text-[#6E6E73]">{t(locale, 'todaysPlan')}</p>
            <p className="mt-1.5 flex items-center gap-2 text-lg font-black text-[#1C1C1E]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-dark" />
              {planLabel}
            </p>
            {dailyRecommendation ? (
              <p className="mt-1.5 text-xs font-bold leading-4 text-[#6E6E73]">
                {t(locale, 'todayRecommendation')}: {dailyRecommendation.label} - {dailyRecommendationReasonLabel(dailyRecommendation.reason, locale)}
              </p>
            ) : null}
          </div>

          <p className="text-sm font-medium leading-5 text-[#6E6E73]">
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
                  ? 'border-accent-dark bg-accent-dark text-white shadow-sm'
                  : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
              }`}
            >
              {locale === 'ko' ? '추천 다음 루틴' : 'Recommended Next'}: {getRoutineDayDisplayName(nextRoutineDay, locale)}
            </button>
          ) : null}

          <IOSSegmentedControl
            value={selectedWorkoutKind}
            onChange={setSelectedWorkoutKind}
            columns={3}
            options={[
              { value: 'planned', label: locale === 'ko' ? '루틴' : 'Routine', icon: Dumbbell },
              { value: 'running', label: locale === 'ko' ? '러닝' : 'Running', icon: Footprints },
              { value: 'free', label: locale === 'ko' ? '자유' : 'Free', icon: Plus },
            ]}
          />

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
                  className={`min-h-10 rounded-full border px-4 text-sm font-bold transition-all active:scale-95 ${
                    selectedWorkoutKind === 'planned' && selectedRoutineDayId === routineDay.id
                      ? 'border-transparent bg-accent-dark text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)]'
                      : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                  }`}
                >
                  {getRoutineDayDisplayName(routineDay, locale)}
                </button>
              ))}
            </div>
          ) : null}

          {plannedExerciseNames.length > 0 ? (
            <div className="flex min-h-10 items-start gap-2 rounded-2xl bg-[#F2F2F7] px-3 py-2">
              <p className="shrink-0 pt-0.5 text-sm font-black text-[#6E6E73]">{t(locale, 'plannedExercises')}</p>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {plannedExerciseNames.slice(0, 6).map((exerciseName) => (
                  <span key={exerciseName} className="shrink-0 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-[11px] font-bold leading-none text-[#1C1C1E]">
                    {exerciseName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {recentRoutineWorkouts.length > 0 ? (
            <div className="rounded-2xl bg-[#F2F2F7] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-primary">{locale === 'ko' ? '최근 루틴 빠른 시작' : 'Recent routine starts'}</p>
                <span className="text-[11px] font-bold text-text-secondary">{locale === 'ko' ? '바로 기록' : 'Tap to log'}</span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {recentRoutineWorkouts.map((summary) => (
                  <button
                    key={summary.session.id}
                    type="button"
                    onClick={() => onStartWorkout(summary.session.routineDayId)}
                    className="min-h-11 shrink-0 rounded-2xl border border-black/5 bg-white px-3 text-left shadow-sm active:scale-95"
                  >
                    <span className="block text-sm font-black text-[#1C1C1E]">
                      {todayWorkoutSummaryLabel(summary, locale)}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-[#6E6E73]">
                      {summary.session.date} / {summary.session.totalStrengthVolumeKg.toLocaleString()}kg
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {todayInProgressWorkouts.length > 0 ? (
          <section className="ios-card space-y-2 p-3.5 [@media(max-height:820px)]:p-3">
            <p className="text-sm font-black text-[#1C1C1E]">
              {locale === 'ko' ? '오늘 진행 중인 운동' : 'In-progress workouts today'}
            </p>
            {todayInProgressWorkouts.map((summary) => (
              <div key={summary.session.id} className="flex items-center gap-2 rounded-2xl bg-[#F2F2F7] px-3 py-2">
                <button
                  type="button"
                  onClick={() => onStartWorkout(summary.session.routineDayId, summary.session.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-black text-[#1C1C1E]">
                    {todayWorkoutSummaryLabel(summary, locale)}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-[#6E6E73]">
                    {locale === 'ko' ? '이어 기록하기' : 'Continue logging'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteTodayWorkout(summary.session.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFECEC] text-danger transition-all active:scale-95"
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
          className="ios-button-primary flex min-h-14 w-full items-center justify-center gap-2 px-4 text-lg"
        >
          <Play aria-hidden="true" size={20} />
          <span>{workoutRecordLabel}</span>
        </button>
      </footer>
    </section>
  );
}
