import { AlertTriangle, Dumbbell, Footprints, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IOSSegmentedControl } from '../components/IosPrimitives';
import { db } from '../db/db';
import {
  getActiveRoutineDays,
  getNextPlannedRoutineDayAfterDate,
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
import {
  loadAiCoachEndpoint,
  requestAiCoach,
  type AiCoachResponse,
} from '../domain/aiCoach';
import { getExerciseName } from '../domain/exercises';
import {
  exerciseRecoveryMuscleGroups,
  loadRecoverySnapshot,
  recoveryGroupLabel,
  recoveryWarningGroups,
} from '../domain/recoveryInputs';
import type { RecoveryMuscleGroup, RecoverySnapshot } from '../domain/recovery';
import { buildStats, type DeloadRecommendation } from '../domain/stats';
import { getStoredLocale, t, tf, type AppLocale } from '../i18n/i18n';
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

function plannedGroupScopeLabel(groups: RecoveryMuscleGroup[], locale: AppLocale): string {
  const strengthGroups = groups.filter((group) => group !== 'cardio');
  const hasLower = strengthGroups.includes('legs');
  const hasUpper = strengthGroups.some((group) => group !== 'legs' && group !== 'core');
  const hasCoreOnly = strengthGroups.length > 0 && strengthGroups.every((group) => group === 'core');

  if (hasUpper && hasLower) return locale === 'ko' ? '\uC804\uC2E0' : 'full-body';
  if (hasLower) return locale === 'ko' ? '\uD558\uCCB4' : 'lower-body';
  if (hasUpper) return locale === 'ko' ? '\uC0C1\uCCB4' : 'upper-body';
  if (hasCoreOnly) return locale === 'ko' ? '\uCF54\uC5B4' : 'core';
  if (groups.includes('cardio')) return locale === 'ko' ? '\uC720\uC0B0\uC18C' : 'cardio';
  return locale === 'ko' ? '\uC804\uC2E0' : 'full-body';
}

export function scopeDeloadRecommendationToPlannedGroups(
  recommendation: DeloadRecommendation | undefined,
  plannedGroups: RecoveryMuscleGroup[],
  recovery: RecoverySnapshot,
  locale: AppLocale,
): DeloadRecommendation | undefined {
  if (!recommendation) return undefined;
  if (plannedGroups.length === 0) return recommendation;

  const recoveryByGroup = new Map(recovery.groups.map((group) => [group.group, group]));
  const plannedRecovery = plannedGroups
    .map((group) => recoveryByGroup.get(group))
    .filter((group): group is RecoverySnapshot['groups'][number] => Boolean(group));
  const fatiguedPlannedGroups = plannedRecovery
    .filter((group) => group.recoveryPercent < 60)
    .sort((a, b) => a.recoveryPercent - b.recoveryPercent);
  const globalFatigue = recommendation.severity === 'high' && recovery.averageRecoveryPercent < 50;

  if (fatiguedPlannedGroups.length === 0 && !globalFatigue) return undefined;
  if (fatiguedPlannedGroups.length === 0) {
    const globalReason = locale === 'ko'
      ? `\uC804\uC2E0 \uD53C\uB85C\uAC00 \uB192\uC2B5\uB2C8\uB2E4. \uD3C9\uADE0 \uD68C\uBCF5\uB3C4\uAC00 ${recovery.averageRecoveryPercent}%\uC785\uB2C8\uB2E4.`
      : `Full-body fatigue is high. Average recovery is ${recovery.averageRecoveryPercent}%.`;
    return {
      ...recommendation,
      reasons: [globalReason, ...recommendation.reasons],
    };
  }

  const scopeLabel = plannedGroupScopeLabel(plannedGroups, locale);
  const labels = fatiguedPlannedGroups
    .slice(0, 2)
    .map((group) => recoveryGroupLabel(group.group, locale))
    .join(', ');
  const plannedReason = locale === 'ko'
    ? `\uC624\uB298 \uC608\uC815 \uC6B4\uB3D9\uC740 ${scopeLabel}\uC774\uBA70, ${labels} \uD68C\uBCF5\uB3C4\uAC00 ${fatiguedPlannedGroups[0].recoveryPercent}%\uC785\uB2C8\uB2E4.`
    : `Today's planned workout is ${scopeLabel}; ${labels} recovery is ${fatiguedPlannedGroups[0].recoveryPercent}%.`;

  return {
    ...recommendation,
    recoveryPercent: fatiguedPlannedGroups[0].recoveryPercent,
    reasons: [plannedReason, ...recommendation.reasons],
  };
}

function dailyRecommendationReasonLabel(reason: DailyWorkoutRecommendationReason, locale: AppLocale): string {
  if (reason === 'manualOverride') return t(locale, 'todayRecommendationManualOverride');
  if (reason === 'cycleRoutine') return t(locale, 'todayRecommendationCycleRoutine');
  if (reason === 'weeklyRoutine') return t(locale, 'todayRecommendationWeeklyRoutine');
  if (reason === 'makeUpSkippedWorkout') return t(locale, 'todayRecommendationMakeUp');
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
  const [recoveryWarning, setRecoveryWarning] = useState<string | undefined>();
  const [recentRoutineWorkouts, setRecentRoutineWorkouts] = useState<WorkoutSummary[]>([]);
  const [dailyRecommendation, setDailyRecommendation] = useState<DailyWorkoutRecommendation | undefined>();
  const [isTodayRestDay, setIsTodayRestDay] = useState(false);
  const [isTodayRunningPlan, setIsTodayRunningPlan] = useState(false);
  const [todayInProgressWorkouts, setTodayInProgressWorkouts] = useState<WorkoutSummary[]>([]);
  const [selectedWorkoutKind, setSelectedWorkoutKind] = useState<WorkoutSessionKind>('planned');
  const [reloadKey, setReloadKey] = useState(0);
  const [locale] = useState(() => getStoredLocale());
  const [showDeloadToast, setShowDeloadToast] = useState(false);
  const [deloadRecommendation, setDeloadRecommendation] = useState<DeloadRecommendation | undefined>();
  const [weeklyCardioMinutes, setWeeklyCardioMinutes] = useState(0);
  const [aiCoachStatus, setAiCoachStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [aiCoachResult, setAiCoachResult] = useState<AiCoachResponse | undefined>();
  const [aiCoachError, setAiCoachError] = useState<string | undefined>();

  const CARDIO_WEEKLY_TARGET_MINUTES = 60;
  const cardioProgressPercent = Math.min(100, Math.round((weeklyCardioMinutes / CARDIO_WEEKLY_TARGET_MINUTES) * 100));

  const todayLabel = useMemo(() => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date()), [locale]);

  useEffect(() => {
    if (showDeloadToast) {
      const timer = setTimeout(() => setShowDeloadToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showDeloadToast]);

  useEffect(() => {
    async function load() {
      try {
        await seedDefaultExercises();
        const [routine, days, todaySchedule, nextDay, todayWorkout, recentWorkouts, todayWorkouts] = await Promise.all([
          db.routines.filter((routineRecord) => routineRecord.isActive).first(),
          getActiveRoutineDays(),
          getRoutineScheduleForDate(),
          getNextPlannedRoutineDayAfterDate(),
          getTodayWorkout(),
          getRecentWorkoutSummaries(10),
          getWorkoutSummariesForDate(formatDateKey(new Date())),
        ]);

        setActiveRoutine(routine);
        setRoutineDays(days);
        setInProgressSession(todayWorkout?.session);
        setTodayRoutineDay(todaySchedule.routineDay);
        setNextRoutineDay(nextDay);
        const makeUpRoutineDay = recentWorkouts.find((summary) => (
          summary.session.status === 'skipped'
          && summary.session.entryKind !== 'running'
          && summary.session.entryKind !== 'free'
          && summary.routineDay
        ))?.routineDay;
        const recommendation = buildDailyWorkoutRecommendation({
          schedule: todaySchedule,
          nextRoutineDay: nextDay,
          makeUpRoutineDay,
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

        // 1. Calculate weekly completed cardio minutes (last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoStr = formatDateKey(oneWeekAgo);

        const recentSessions = await db.workoutSessions
          .where('date')
          .aboveOrEqual(oneWeekAgoStr)
          .toArray();
        const sessionIds = new Set(recentSessions.map(s => s.id));
        const allCardio = await db.cardioRecords.toArray();
        const weeklyCardio = allCardio
          .filter(r => sessionIds.has(r.sessionId) && r.isDraft !== true)
          .reduce((sum, r) => {
            const started = new Date(r.startedAt).getTime();
            const ended = new Date(r.endedAt).getTime();
            if (isNaN(started) || isNaN(ended)) return sum;
            return sum + Math.max(1, Math.round((ended - started) / 60000));
          }, 0);
        setWeeklyCardioMinutes(weeklyCardio);

        // 2. Trigger Deload Week toast notice if scheduled routine is deload
        if (todaySchedule.routineDay?.intensityPhase === 'deload') {
          setShowDeloadToast(true);
        } else {
          setShowDeloadToast(false);
        }

        const [sessions, workoutExercises, workoutSets, exercises, cardioRecords] = await Promise.all([
          db.workoutSessions.toArray(),
          db.workoutExercises.toArray(),
          db.workoutSets.toArray(),
          db.exercises.toArray(),
          db.cardioRecords.toArray(),
        ]);
        const stats = buildStats(sessions, workoutExercises, workoutSets, exercises, locale, cardioRecords, 7);
        const dismissedKey = `setgo.deloadRecommendation.dismissed.${formatDateKey(new Date())}`;
        const isDismissed = typeof localStorage !== 'undefined' && localStorage.getItem(dismissedKey) === 'true';
        const plannedRoutineDayId = todayWorkout?.session.routineDayId
          ?? (todaySchedule.kind === 'routine' && !todaySchedule.isRestDay ? todaySchedule.routineDay?.id : undefined)
          ?? recommendation.routineDay?.id;
        const plannedRoutinePlans = plannedRoutineDayId
          ? await db.routineExercisePlans.where('routineDayId').equals(plannedRoutineDayId).toArray()
          : [];
        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
        const plannedGroups = Array.from(new Set(
          plannedRoutinePlans.flatMap((plan) => {
            const exercise = exerciseById.get(plan.exerciseId);
            return exercise ? exerciseRecoveryMuscleGroups(exercise) : [];
          }),
        ));
        const scopedDeloadRecommendation = scopeDeloadRecommendationToPlannedGroups(
          stats.deloadRecommendation,
          plannedGroups,
          stats.recovery,
          locale,
        );
        setDeloadRecommendation(isDismissed ? undefined : scopedDeloadRecommendation);
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
        setRecoveryWarning(undefined);
        return;
      }

      const plans = await db.routineExercisePlans.where('routineDayId').equals(selectedRoutineDayId).sortBy('order');
      const exercises = (await Promise.all(plans.map((plan) => db.exercises.get(plan.exerciseId))))
        .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== undefined);
      setPlannedExerciseNames(exercises.map((exercise) => getExerciseName(exercise, locale)));

      // Warn when the planned day targets muscle groups that are still fatigued.
      const plannedGroups = Array.from(new Set(exercises.flatMap((exercise) => exerciseRecoveryMuscleGroups(exercise))));
      if (plannedGroups.length === 0) {
        setRecoveryWarning(undefined);
        return;
      }
      const snapshot = await loadRecoverySnapshot();
      const fatigued = recoveryWarningGroups(snapshot, plannedGroups);
      if (fatigued.length === 0) {
        setRecoveryWarning(undefined);
        return;
      }
      const groupLabels = fatigued.slice(0, 2).map((stat) => recoveryGroupLabel(stat.group, locale)).join(', ');
      setRecoveryWarning(tf(locale, 'todayRecoveryWarning', { groups: groupLabels, percent: fatigued[0].recoveryPercent }));
    }

    void loadPlannedExercises();
  }, [locale, selectedRoutineDayId, selectedWorkoutKind, refreshKey, reloadKey]);

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
  const displayedPlanLabel = activeRoutine ? planLabel : dailyRecommendation?.label ?? t(locale, 'freeWorkout');
  const matchingInProgressWorkout = todayInProgressWorkouts.find((summary) => {
    if (selectedWorkoutKind === 'running') return summary.session.entryKind === 'running';
    if (selectedWorkoutKind === 'free') return summary.session.entryKind === 'free';
    return summary.session.routineDayId === selectedRoutineDayId;
  });
  const selectedWorkoutLabel = selectedWorkoutKind === 'running'
    ? locale === 'ko' ? '러닝' : 'Running'
    : selectedWorkoutKind === 'free'
      ? t(locale, 'freeWorkout')
      : selectedRoutineDayLabel;
  const workoutRecordLabel = matchingInProgressWorkout
    ? locale === 'ko' ? '계속 기록하기' : 'Continue Logging'
    : locale === 'ko' ? `${selectedWorkoutLabel} 시작` : `Start ${selectedWorkoutLabel}`;
  const shouldShowDeloadRecommendation = Boolean(
    deloadRecommendation
    && selectedWorkoutKind === 'planned'
    && selectedRoutineDay
    && selectedRoutineDay.intensityPhase !== 'deload',
  );

  async function handleApplyDeloadRecommendation() {
    const targetDay = selectedRoutineDay ?? todayRoutineDay ?? dailyRecommendation?.routineDay;
    if (!targetDay) return;

    await db.routineDays.update(targetDay.id, { intensityPhase: 'deload' });
    setDeloadRecommendation(undefined);
    setShowDeloadToast(true);
    setReloadKey((current) => current + 1);
  }

  function handleDismissDeloadRecommendation() {
    const dismissedKey = `setgo.deloadRecommendation.dismissed.${formatDateKey(new Date())}`;
    if (typeof localStorage !== 'undefined') localStorage.setItem(dismissedKey, 'true');
    setDeloadRecommendation(undefined);
  }

  async function handleRequestAiCoach() {
    const endpoint = loadAiCoachEndpoint().trim();
    if (!endpoint) {
      setAiCoachStatus('error');
      setAiCoachError(locale === 'ko'
        ? '더보기에서 AI 코치 Worker endpoint를 먼저 저장하세요.'
        : 'Save the AI Coach Worker endpoint in More first.');
      return;
    }

    setAiCoachStatus('loading');
    setAiCoachError(undefined);
    try {
      const [sessions, workoutExercises, workoutSets, exercises, cardioRecords] = await Promise.all([
        db.workoutSessions.toArray(),
        db.workoutExercises.toArray(),
        db.workoutSets.toArray(),
        db.exercises.toArray(),
        db.cardioRecords.toArray(),
      ]);
      const stats = buildStats(sessions, workoutExercises, workoutSets, exercises, locale, cardioRecords, 7);
      const result = await requestAiCoach(endpoint, {
        locale,
        today: formatDateKey(new Date()),
        activeRoutineName,
        recommendation: dailyRecommendation ? {
          label: dailyRecommendation.label,
          reason: dailyRecommendation.reason,
          source: dailyRecommendation.source,
          confidence: dailyRecommendation.confidence,
        } : undefined,
        selectedRoutineDay: selectedRoutineDay ? {
          name: getRoutineDayDisplayName(selectedRoutineDay, locale) ?? selectedRoutineDay.name,
          intensityPhase: selectedRoutineDay.intensityPhase,
        } : undefined,
        plannedExercises: plannedExerciseNames,
        recoveryWarning,
        stats: {
          workoutDays: stats.workoutDays,
          totalVolumeKg: stats.totalVolumeKg,
          totalSets: stats.totalSets,
          hardSets: stats.hardSets,
          hardSetRatio: stats.hardSetRatio,
          recovery: {
            averageRecoveryPercent: stats.recovery.averageRecoveryPercent,
            readinessStatus: stats.recovery.readinessStatus,
          },
          warnings: stats.warnings,
          analysisComment: stats.analysisComment,
          nextWeekSuggestions: stats.nextWeekSuggestions,
        },
        deloadRecommendation: deloadRecommendation ? {
          severity: deloadRecommendation.severity,
          suggestedSetReductionPct: deloadRecommendation.suggestedSetReductionPct,
          reasons: deloadRecommendation.reasons,
        } : undefined,
      });
      setAiCoachResult(result);
      setAiCoachStatus('success');
    } catch (error) {
      setAiCoachError(error instanceof Error ? error.message : String(error));
      setAiCoachStatus('error');
    }
  }

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

        <section className="ios-card flex flex-col gap-2.5 p-3.5 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-[#8E8E93]">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 truncate text-lg font-black text-[#1C1C1E]">
                {activeRoutineName ?? t(locale, 'noActiveRoutine')}
              </h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F3F3] text-accent-dark">
              <Dumbbell aria-hidden="true" size={23} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#2EC4B6]/20 bg-[#E8F3F3] px-4 py-3.5 text-sg-label shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-sg-brand-strong">{t(locale, 'todayRecommendation')}</p>
              {selectedRoutineDay?.intensityPhase && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${
                  selectedRoutineDay.intensityPhase === 'hypertrophy'
                    ? 'bg-[#2EC4B6]/15 text-[#159A91]'
                    : selectedRoutineDay.intensityPhase === 'maintenance'
                      ? 'bg-[#34C759]/15 text-[#24963E]'
                      : selectedRoutineDay.intensityPhase === 'deload'
                        ? 'bg-[#FF9500]/15 text-[#B25E00]'
                        : 'bg-[#007AFF]/15 text-[#0051A8]'
                }`}>
                  {selectedRoutineDay.intensityPhase === 'hypertrophy'
                    ? (locale === 'ko' ? '강 / 근성장' : 'Heavy / Gain')
                    : selectedRoutineDay.intensityPhase === 'maintenance'
                      ? (locale === 'ko' ? '약 / 근유지' : 'Light / Keep')
                      : selectedRoutineDay.intensityPhase === 'deload'
                        ? (locale === 'ko' ? '회복 / 디로드' : 'Deload')
                        : (locale === 'ko' ? '유산소' : 'Cardio')}
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-2 text-[1.7rem] font-black leading-none text-sg-label">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sg-brand" />
              {displayedPlanLabel}
            </p>
            {dailyRecommendation ? (
              <p className="mt-2 text-sm font-semibold leading-5 text-sg-secondary-label">
                {dailyRecommendationReasonLabel(dailyRecommendation.reason, locale)}
              </p>
            ) : null}
            {recoveryWarning ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#FF9500]/10 px-2.5 py-2 text-[13px] font-semibold leading-4 text-[#B25E00]">
                <AlertTriangle aria-hidden="true" size={15} className="mt-px shrink-0 text-[#FF9500]" />
                <span>{recoveryWarning}</span>
              </p>
            ) : null}
            {shouldShowDeloadRecommendation && deloadRecommendation ? (
              <div className="mt-2 rounded-xl border border-[#FF9500]/20 bg-[#FFF7EA] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-[#FF9500]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black leading-4 text-[#1C1C1E]">
                      {locale === 'ko' ? '자동 디로드 권장' : 'Auto deload recommended'}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold leading-4 text-[#6E6E73]">
                      {locale === 'ko'
                        ? `최근 부하가 높습니다. 이번 운동은 세트를 약 ${deloadRecommendation.suggestedSetReductionPct}% 줄이는 디로드로 전환하세요.`
                        : `Recent load is high. Switch this workout to a deload and cut sets by about ${deloadRecommendation.suggestedSetReductionPct}%.`}
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-4 text-[#B25E00]">
                      {deloadRecommendation.reasons[0]}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApplyDeloadRecommendation()}
                    className="min-h-9 rounded-lg bg-[#FF9500] px-2 text-xs font-black text-white transition-all active:scale-95"
                  >
                    {locale === 'ko' ? '디로드 적용' : 'Apply deload'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissDeloadRecommendation}
                    className="min-h-9 rounded-lg bg-white px-2 text-xs font-black text-[#6E6E73] transition-all active:scale-95"
                  >
                    {locale === 'ko' ? '오늘은 유지' : 'Keep today'}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="hidden">
              <div className="flex items-start gap-2">
                <Sparkles aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-[#5856D6]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black leading-4 text-[#1C1C1E]">
                    {locale === 'ko' ? 'Kimi AI 코치' : 'Kimi AI Coach'}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-4 text-[#6E6E73]">
                    {aiCoachResult
                      ? (locale === 'ko' ? aiCoachResult.summaryKo : aiCoachResult.summaryEn ?? aiCoachResult.summaryKo)
                      : locale === 'ko'
                        ? 'SetGo 추천을 바탕으로 오늘 코칭 메모를 생성합니다.'
                        : 'Generate a coaching note from the SetGo recommendation.'}
                  </p>
                  {aiCoachResult?.warnings[0] ? (
                    <p className="mt-1 text-[11px] font-bold leading-4 text-[#5856D6]">
                      {locale === 'ko'
                        ? aiCoachResult.warnings[0].messageKo
                        : aiCoachResult.warnings[0].messageEn ?? aiCoachResult.warnings[0].messageKo}
                    </p>
                  ) : null}
                  {aiCoachError ? (
                    <p className="mt-1 text-[11px] font-bold leading-4 text-[#FF3B30]">{aiCoachError}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleRequestAiCoach()}
                disabled={aiCoachStatus === 'loading'}
                className="mt-2 min-h-9 w-full rounded-lg bg-[#5856D6] px-2 text-xs font-black text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {aiCoachStatus === 'loading'
                  ? (locale === 'ko' ? '코칭 생성 중...' : 'Generating...')
                  : aiCoachResult
                    ? (locale === 'ko' ? '다시 생성' : 'Regenerate')
                    : (locale === 'ko' ? 'AI 코칭 받기' : 'Get AI coaching')}
              </button>
            </div>
            {plannedExerciseNames.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {plannedExerciseNames.slice(0, 4).map((exerciseName) => (
                  <span key={exerciseName} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-sg-secondary-label">
                    {exerciseName}
                  </span>
                ))}
                {plannedExerciseNames.length > 4 ? (
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-sg-secondary-label">
                    +{plannedExerciseNames.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Cardio Filler Progress Bar */}
            {cardioProgressPercent < 70 && (
              <div className="hidden">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#6E6E73]">
                  <span>🏃 {locale === 'ko' ? '주간 유산소 달성도' : 'Weekly Cardio Progress'}</span>
                  <span>{cardioProgressPercent}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-[#E5E5EA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2EC4B6] to-[#34C759] transition-all duration-500"
                    style={{ width: `${cardioProgressPercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-semibold leading-normal text-[#159A91]">
                  {locale === 'ko'
                    ? `이번 주 러닝이 ${CARDIO_WEEKLY_TARGET_MINUTES - weeklyCardioMinutes}분 부족합니다. 운동 후 가벼운 러닝을 추가해 보세요!`
                    : `You need ${CARDIO_WEEKLY_TARGET_MINUTES - weeklyCardioMinutes} more mins of running this week. Add a light run after workout!`}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#5856D6]/15 bg-[#F4F3FF] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-sg-ai" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black leading-4 text-sg-label">
                  {locale === 'ko' ? 'Kimi AI 코치' : 'Kimi AI Coach'}
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-4 text-sg-secondary-label">
                  {aiCoachResult
                    ? (locale === 'ko' ? aiCoachResult.summaryKo : aiCoachResult.summaryEn ?? aiCoachResult.summaryKo)
                    : locale === 'ko'
                      ? 'SetGo 추천을 바탕으로 오늘 코칭 메모를 생성합니다.'
                      : 'Generate a coaching note from the SetGo recommendation.'}
                </p>
                {aiCoachResult?.warnings[0] ? (
                  <p className="mt-1 text-[11px] font-bold leading-4 text-sg-ai">
                    {locale === 'ko'
                      ? aiCoachResult.warnings[0].messageKo
                      : aiCoachResult.warnings[0].messageEn ?? aiCoachResult.warnings[0].messageKo}
                  </p>
                ) : null}
                {aiCoachError ? (
                  <p className="mt-1 text-[11px] font-bold leading-4 text-sg-danger">{aiCoachError}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRequestAiCoach()}
              disabled={aiCoachStatus === 'loading'}
              className="mt-2 min-h-9 w-full rounded-lg bg-sg-ai px-2 text-xs font-black text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {aiCoachStatus === 'loading'
                ? (locale === 'ko' ? '코칭 생성 중...' : 'Generating...')
                : aiCoachResult
                  ? (locale === 'ko' ? '다시 생성' : 'Regenerate')
                  : (locale === 'ko' ? 'AI 코칭 받기' : 'Get AI coaching')}
            </button>
          </div>

          {cardioProgressPercent < 70 ? (
            <div className="rounded-xl border border-sg-separator bg-sg-fill px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-sg-secondary-label">
                <span>{locale === 'ko' ? '주간 유산소 달성도' : 'Weekly Cardio Progress'}</span>
                <span>{cardioProgressPercent}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-sg-separator">
                <div
                  className="h-full rounded-full bg-sg-cardio transition-all duration-500"
                  style={{ width: `${cardioProgressPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold leading-normal text-sg-secondary-label">
                {locale === 'ko'
                  ? `이번 주 러닝이 ${CARDIO_WEEKLY_TARGET_MINUTES - weeklyCardioMinutes}분 부족합니다. 운동 후 가벼운 러닝을 추가해 보세요.`
                  : `You need ${CARDIO_WEEKLY_TARGET_MINUTES - weeklyCardioMinutes} more mins of running this week. Add a light run after workout.`}
              </p>
            </div>
          ) : null}

          {!activeRoutine ? (
            <p className="text-sm font-semibold leading-5 text-[#6E6E73]">
              {locale === 'ko' ? '루틴은 나중에 만들고, 지금은 바로 기록을 시작할 수 있습니다.' : 'You can start logging now and build a routine later.'}
            </p>
          ) : null}

          {isTodayRestDay && !inProgressSession && nextRoutineDay ? (
            <button
              type="button"
              onClick={() => {
                setSelectedWorkoutKind('planned');
                setSelectedRoutineDayId(nextRoutineDay.id);
              }}
              className={`min-h-11 w-full rounded-xl border px-3 text-left text-sm font-bold transition-all active:scale-95 ${
                selectedRoutineDayId === nextRoutineDay.id
                  ? 'border-transparent bg-sg-brand text-white shadow-brand'
                  : 'border-sg-border bg-sg-surface text-sg-label hover:bg-sg-fill'
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

          {selectedWorkoutKind === 'planned' && selectedRoutineDay ? (
            <div className="rounded-xl border border-[#2EC4B6]/20 bg-[#E8F3F3] px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#159A91]">
                {locale === 'ko' ? '선택한 루틴' : 'Selected routine'}
              </p>
              <p className="mt-0.5 truncate text-sm font-black text-[#1C1C1E]">{selectedRoutineDayLabel}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6E6E73]">
                {locale === 'ko'
                  ? '다른 루틴 데이는 루틴 탭에서 선택해 시작할 수 있습니다.'
                  : 'Use Routines to start a different routine day.'}
              </p>
            </div>
          ) : null}

          {selectedWorkoutKind === 'planned' && recentRoutineWorkouts.length > 0 ? (
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
      {showDeloadToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#FF9500] px-4 py-3 text-sm font-black text-white shadow-2xl transition-all duration-500 animate-slide-up">
          ⚠️ {locale === 'ko'
            ? '피로 회복 주간(디로드)이 활성화되었습니다. 강도가 20% 자동 감축되었습니다.'
            : 'Deload week active. Intensity reduced by 20% for recovery.'}
        </div>
      )}
    </section>
  );
}
