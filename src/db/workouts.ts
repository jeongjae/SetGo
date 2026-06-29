import { db } from './db';
import { getActiveRoutine, getRoutineScheduleForDate, getSuggestedCyclePlanItem } from './routines';
import type { CardioRecord, ExerciseMaster, RoutineCyclePlanItem, RoutineDay, RoutineExercisePlan, WorkoutExercise, WorkoutRecommendationExerciseTarget, WorkoutRecommendationSnapshot, WorkoutSession, WorkoutSessionKind, WorkoutSet } from '../types';
import { formatDateKey, getTimeBand } from '../utils/date';
import { calculateAverageSpeedKmh, calculateExerciseVolumeKg, calculateSessionStrengthVolumeKg } from '../domain/volume';
import { isWarmupOnlyExercise } from '../domain/exercises';
import { buildStats, toRecoveryMuscleGroups } from '../domain/stats';
import { recommendExerciseTarget, type ExerciseTargetRecommendation, type RecentExerciseSession, type TrainingGoal } from '../domain/recommendations';
import type { RecoverySnapshot } from '../domain/recovery';

export type ActiveWorkout = {
  session: WorkoutSession;
  routineName?: string;
  routineDay?: RoutineDay;
};

export type WorkoutSummary = ActiveWorkout & {
  exerciseCount: number;
  cardioCount: number;
};

export type WorkoutExerciseLog = {
  workoutExercise: WorkoutExercise;
  exercise: ExerciseMaster;
  sets: WorkoutSet[];
  previousSummary?: string;
  previousSets: WorkoutSet[];
  pastBestWeight?: number;
  pastBestVolume?: number;
  targetRecommendation?: ExerciseTargetRecommendation;
  weightIncrementKg: number;
};

export type WorkoutStartKind = WorkoutSessionKind;

export const DEFAULT_WEIGHT_INCREMENT_KG = 2.5;

export function calculateEstimatedOneRmKg(
  set: Pick<WorkoutSet, 'weightKg' | 'reps'>,
): number | undefined {
  if (!Number.isFinite(set.weightKg) || set.weightKg <= 0) return undefined;
  if (!Number.isFinite(set.reps) || set.reps <= 0) return undefined;
  return Math.round(set.weightKg * (1 + set.reps / 30) * 10) / 10;
}

export function resolveWeightIncrementKg(plan?: Pick<RoutineExercisePlan, 'preferredWeightIncrementKg'>): number {
  const value = plan?.preferredWeightIncrementKg;
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : DEFAULT_WEIGHT_INCREMENT_KG;
}

function getStoredTrainingGoal(): TrainingGoal {
  if (typeof localStorage === 'undefined') return 'hypertrophy';
  return localStorage.getItem('setgo-global-goal') === 'maintenance' ? 'maintenance' : 'hypertrophy';
}

async function getCurrentRecoverySnapshot(): Promise<RecoverySnapshot> {
  const [sessions, workoutExercises, workoutSets, exercises, cardioRecords] = await Promise.all([
    db.workoutSessions.toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
    db.exercises.toArray(),
    db.cardioRecords.toArray(),
  ]);

  return buildStats(sessions, workoutExercises, workoutSets, exercises, 'en', cardioRecords, 7).recovery;
}

function recoveryPercentForExercise(
  exercise: ExerciseMaster | undefined,
  recoverySnapshot: RecoverySnapshot | undefined,
): number | undefined {
  if (!exercise || !recoverySnapshot) return undefined;

  const groups = toRecoveryMuscleGroups(exercise).filter((group) => group !== 'cardio');
  if (groups.length === 0) return undefined;

  const recoveryByGroup = new Map(recoverySnapshot.groups.map((group) => [group.group, group.recoveryPercent]));
  const percents = groups
    .map((group) => recoveryByGroup.get(group))
    .filter((value): value is number => value !== undefined);

  return percents.length > 0 ? Math.min(...percents) : undefined;
}

export type WorkoutStartOptions = {
  createNew?: boolean;
  kind?: WorkoutStartKind;
  recommendationSnapshot?: WorkoutRecommendationSnapshot;
};

async function getWorkoutSessionsForDate(date: string): Promise<WorkoutSession[]> {
  try {
    return await db.workoutSessions
      .where('date')
      .equals(date)
      .toArray();
  } catch (error) {
    console.warn('Falling back to full workout session scan for date lookup', error);
    return (await db.workoutSessions.toArray()).filter((session) => session.date === date);
  }
}

export function selectReusableInProgressSession(
  sessions: WorkoutSession[],
  selectedRoutineDayId?: string,
  options: WorkoutStartOptions = {},
): WorkoutSession | undefined {
  if (options.createNew) return undefined;
  if (options.kind && options.kind !== 'planned') return undefined;

  const inProgressSessions = sessions
    .filter((session) => session.status === 'in_progress')
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));

  return selectedRoutineDayId
    ? inProgressSessions.find((session) => session.routineDayId === selectedRoutineDayId)
    : inProgressSessions[0];
}

export function createWorkoutSessionForDate(
  date: string,
  now: Date,
  _existingSessionCount: number,
  routineId?: string,
  routineDayId?: string,
  entryKind: WorkoutStartKind = 'planned',
  recommendationSnapshot?: WorkoutRecommendationSnapshot,
  cyclePlanItemId?: string,
): WorkoutSession {
  const timestamp = now.toISOString();
  const isFirstBackdatedSession = _existingSessionCount === 0 && date !== formatDateKey(now);

  return {
    id: `workout_${date}_${now.getTime()}`,
    date,
    startedAt: isFirstBackdatedSession ? `${date}T12:00:00.000` : timestamp,
    timeBand: getTimeBand(new Date(`${date}T12:00:00`)),
    routineId,
    routineDayId,
    cyclePlanItemId,
    entryKind: entryKind === 'planned' ? undefined : entryKind,
    recommendationSnapshot,
    status: 'in_progress',
    totalStrengthVolumeKg: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type WorkoutStartSessionSelection =
  | { kind: 'reuse'; session: WorkoutSession }
  | { kind: 'create'; session: WorkoutSession };

export function selectWorkoutStartSession(
  date: string,
  now: Date,
  existingSessions: WorkoutSession[],
  selectedRoutineDayId?: string,
  options: WorkoutStartOptions = {},
  routineId?: string,
  routineDayId?: string,
  cyclePlanItemId?: string,
): WorkoutStartSessionSelection {
  const existingSession = selectReusableInProgressSession(existingSessions, selectedRoutineDayId, options);
  if (existingSession) {
    return { kind: 'reuse', session: existingSession };
  }

  return {
    kind: 'create',
    session: createWorkoutSessionForDate(
      date,
      now,
      existingSessions.length,
      routineId,
      routineDayId,
      options.kind ?? 'planned',
      options.recommendationSnapshot,
      cyclePlanItemId,
    ),
  };
}

export function resolveAutoSkippedRunningItem(
  completedSession: Pick<WorkoutSession, 'cyclePlanItemId' | 'entryKind' | 'routineDayId' | 'routineId'>,
  cycleItems: RoutineCyclePlanItem[],
): RoutineCyclePlanItem | undefined {
  if (completedSession.entryKind === 'running' || completedSession.entryKind === 'free' || !completedSession.routineId) {
    return undefined;
  }

  let lastItemIndex = -1;
  if (completedSession.cyclePlanItemId) {
    lastItemIndex = cycleItems.findIndex((item) => item.id === completedSession.cyclePlanItemId);
  }
  if (lastItemIndex === -1 && completedSession.routineDayId) {
    lastItemIndex = cycleItems.findIndex((item) => item.routineDayId === completedSession.routineDayId);
  }
  if (lastItemIndex === -1) return undefined;

  const nextItem = cycleItems[(lastItemIndex + 1) % cycleItems.length];
  return nextItem?.kind === 'running' ? nextItem : undefined;
}

export async function getOrCreateWorkoutForDate(
  date: string,
  selectedRoutineDayId?: string,
  options: WorkoutStartOptions = {},
): Promise<ActiveWorkout> {
  const now = new Date();
  const sessionDate = new Date(`${date}T12:00:00`);
  const startKind = options.kind ?? 'planned';
  const activeRoutine = await getActiveRoutine().catch((error) => {
    console.warn('Failed to load active routine while starting workout', error);
    return undefined;
  });
  const routineDays = activeRoutine
    ? await db.routineDays.where('routineId').equals(activeRoutine.id).sortBy('sequence').catch((error) => {
      console.warn('Failed to load routine days while starting workout', error);
      return [] as RoutineDay[];
    })
    : [];
  const shouldUsePlannedRoutine = startKind === 'planned';
  const scheduledPlan = selectedRoutineDayId || !shouldUsePlannedRoutine
    ? undefined
    : await getRoutineScheduleForDate(sessionDate).catch((error) => {
      console.warn('Failed to load scheduled plan while starting workout', error);
      return undefined;
    });
  const scheduledRoutineDay = scheduledPlan?.kind === 'routine' ? scheduledPlan.routineDay : undefined;
  const shouldSeedRunning = startKind === 'running' || (!selectedRoutineDayId && scheduledPlan?.kind === 'running');
  const routineDay = shouldUsePlannedRoutine
    ? routineDays.find((day) => day.id === selectedRoutineDayId) ?? scheduledRoutineDay
    : undefined;

  let cyclePlanItemId = scheduledPlan?.cycleItem?.id;
  if (!cyclePlanItemId && activeRoutine && routineDay) {
    const { nextItem } = await getSuggestedCyclePlanItem(activeRoutine).catch(() => ({ nextItem: undefined }));
    if (nextItem && nextItem.routineDayId === routineDay.id) {
      cyclePlanItemId = nextItem.id;
    }
  }

  const existingSessions = await getWorkoutSessionsForDate(date);
  const sessionSelection = selectWorkoutStartSession(
    date,
    now,
    existingSessions,
    selectedRoutineDayId,
    options,
    routineDay ? activeRoutine?.id : undefined,
    routineDay?.id,
    cyclePlanItemId,
  );

  if (sessionSelection.kind === 'reuse') {
    let existingSession = sessionSelection.session;
    if (options.recommendationSnapshot && !existingSession.recommendationSnapshot) {
      existingSession = {
        ...existingSession,
        recommendationSnapshot: options.recommendationSnapshot,
        updatedAt: now.toISOString(),
      };
      await db.workoutSessions.put(existingSession);
    }
    const existingExerciseCount = await db.workoutExercises.where('sessionId').equals(existingSession.id).count();
    if (existingExerciseCount === 0 && existingSession.routineDayId) {
      await seedWorkoutExercisesFromRoutineDay(existingSession.id, existingSession.routineDayId);
    }
    if (shouldSeedRunning) {
      await ensureRunningDraft(existingSession.id);
    }
    await dedupeWorkoutExercisesByExercise(existingSession.id);

    const existingRoutineDay = existingSession.routineDayId
      ? await db.routineDays.get(existingSession.routineDayId)
      : undefined;

    return {
      session: existingSession,
      routineName: existingRoutineDay ? activeRoutine?.name : undefined,
      routineDay: existingRoutineDay,
    };
  }

  const session = sessionSelection.session;

  await clearWorkoutSessionRecords(session.id);
  await db.workoutSessions.put(session);
  await seedWorkoutExercisesFromRoutineDay(session.id, routineDay?.id);
  if (shouldSeedRunning) {
    await ensureRunningDraft(session.id);
  }

  return {
    session,
    routineName: routineDay ? activeRoutine?.name : undefined,
    routineDay,
  };
}

export async function getOrCreateTodayWorkout(
  selectedRoutineDayId?: string,
  options: WorkoutStartOptions = {},
): Promise<ActiveWorkout> {
  return getOrCreateWorkoutForDate(formatDateKey(new Date()), selectedRoutineDayId, options);
}

export async function getWorkoutBySessionId(sessionId: string): Promise<ActiveWorkout | undefined> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return undefined;

  const existingExerciseCount = await db.workoutExercises.where('sessionId').equals(session.id).count();
  if (existingExerciseCount === 0 && session.routineDayId) {
    await seedWorkoutExercisesFromRoutineDay(session.id, session.routineDayId);
  }
  await dedupeWorkoutExercisesByExercise(session.id);

  const [routine, routineDay] = await Promise.all([
    session.routineId ? db.routines.get(session.routineId) : undefined,
    session.routineDayId ? db.routineDays.get(session.routineDayId) : undefined,
  ]);

  return {
    session,
    routineName: routine?.name,
    routineDay,
  };
}

async function dedupeWorkoutExercisesByExercise(sessionId: string): Promise<void> {
  const workoutExercises = await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order');
  const seenExerciseIds = new Set<string>();
  const keptExercises: WorkoutExercise[] = [];
  const duplicateExercises: WorkoutExercise[] = [];

  for (const workoutExercise of workoutExercises) {
    if (seenExerciseIds.has(workoutExercise.exerciseId)) {
      duplicateExercises.push(workoutExercise);
      continue;
    }

    seenExerciseIds.add(workoutExercise.exerciseId);
    keptExercises.push(workoutExercise);
  }

  if (duplicateExercises.length === 0) return;

  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    for (const duplicateExercise of duplicateExercises) {
      await db.workoutSets.where('workoutExerciseId').equals(duplicateExercise.id).delete();
      await db.workoutExercises.delete(duplicateExercise.id);
    }

    await Promise.all(
      keptExercises.map((workoutExercise, index) => (
        workoutExercise.order === index + 1
          ? Promise.resolve()
          : db.workoutExercises.update(workoutExercise.id, { order: index + 1 })
      )),
    );
  });

  await refreshSessionVolume(sessionId);
}

export function createWorkoutExerciseSeed(
  sessionId: string,
  plans: RoutineExercisePlan[],
  exerciseById: Map<string, ExerciseMaster | undefined>,
  recommendationByPlanId: Map<string, ExerciseTargetRecommendation> = new Map(),
): { workoutExercises: WorkoutExercise[]; workoutSets: WorkoutSet[]; recommendationTargets: WorkoutRecommendationExerciseTarget[] } {
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSets: WorkoutSet[] = [];
  const recommendationTargets: WorkoutRecommendationExerciseTarget[] = [];

  plans.forEach((plan, index) => {
    const workoutExerciseId = `${sessionId}_${plan.id}`;
    const plannedSets = Math.max(1, plan.plannedSets ?? 3);
    const exercise = exerciseById.get(plan.exerciseId);
    const isWarmup = isWarmupOnlyExercise(exercise);
    const recommendation = recommendationByPlanId.get(plan.id);
    const targetSets = Math.max(1, recommendation?.sets ?? plannedSets);
    recommendationTargets.push({
      planId: plan.id,
      exerciseId: plan.exerciseId,
      weightKg: recommendation?.weightKg ?? plan.plannedWeightKg ?? 0,
      reps: recommendation?.reps ?? plan.plannedReps ?? 0,
      sets: targetSets,
      rir: recommendation?.rir ?? plan.plannedRir,
      targetRepMin: recommendation?.targetRepMin ?? plan.targetRepMin,
      targetRepMax: recommendation?.targetRepMax ?? plan.targetRepMax,
      confidence: recommendation?.confidence ?? 'low',
      reason: recommendation?.reason ?? 'Routine plan default.',
    });

    workoutExercises.push({
      id: workoutExerciseId,
      sessionId,
      exerciseId: plan.exerciseId,
      order: index + 1,
      status: 'planned',
      totalVolumeKg: 0,
      restSeconds: plan.plannedRestSeconds ?? 90,
    });
    workoutSets.push(...Array.from({ length: targetSets }, (_, setIndex) => ({
      id: `${workoutExerciseId}_set_${setIndex + 1}`,
      workoutExerciseId,
      setNo: setIndex + 1,
      weightKg: recommendation?.weightKg ?? plan.plannedWeightKg ?? 0,
      reps: recommendation?.reps ?? plan.plannedReps ?? 0,
      estimatedOneRmKg: calculateEstimatedOneRmKg({
        weightKg: recommendation?.weightKg ?? plan.plannedWeightKg ?? 0,
        reps: recommendation?.reps ?? plan.plannedReps ?? 0,
      }),
      rir: recommendation?.rir ?? plan.plannedRir,
      isCompleted: false,
      isWarmup,
    })));
  });

  return { workoutExercises, workoutSets, recommendationTargets };
}

async function getRecentExerciseSessions(
  currentSessionId: string,
  exerciseId: string,
  limit = 5,
): Promise<RecentExerciseSession[]> {
  const currentSession = await db.workoutSessions.get(currentSessionId);
  const currentStartedAt = currentSession?.startedAt ?? new Date().toISOString();
  const workoutExercises = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((item) => item.sessionId !== currentSessionId)
    .toArray();

  const candidates = await Promise.all(workoutExercises.map(async (workoutExercise) => {
    const [session, sets] = await Promise.all([
      db.workoutSessions.get(workoutExercise.sessionId),
      db.workoutSets.where('workoutExerciseId').equals(workoutExercise.id).sortBy('setNo'),
    ]);

    return { session, sets };
  }));

  const recentCandidates = candidates
    .filter((candidate): candidate is { session: WorkoutSession; sets: WorkoutSet[] } => (
      candidate.session !== undefined
      && candidate.session.status === 'completed'
      && candidate.session.startedAt !== undefined
      && candidate.session.startedAt < currentStartedAt
      && candidate.sets.some((set) => set.isCompleted)
    ))
    .sort((a, b) => (b.session.startedAt ?? '').localeCompare(a.session.startedAt ?? ''))
    .slice(0, limit)
    .map((candidate) => ({
      date: candidate.session.date,
      sets: candidate.sets,
      session: candidate.session,
    }));

  return Promise.all(recentCandidates.map(async (candidate) => {
    const routineDay = candidate.session.routineDayId
      ? await db.routineDays.get(candidate.session.routineDayId)
      : undefined;
    return {
      date: candidate.date,
      family: routineDay?.family,
      intensityPhase: routineDay?.intensityPhase,
      sets: candidate.sets,
    };
  }));
}

async function getPlanRecommendation(
  sessionId: string,
  plan: RoutineExercisePlan,
  exercise: ExerciseMaster | undefined,
  routineDay?: RoutineDay,
  recoverySnapshot?: RecoverySnapshot,
): Promise<ExerciseTargetRecommendation> {
  const recentSessions = await getRecentExerciseSessions(sessionId, plan.exerciseId);
  return recommendExerciseTarget({
    plan,
    recentSessions,
    exercise,
    currentFamily: routineDay?.family,
    currentPhase: routineDay?.intensityPhase,
    globalGoal: getStoredTrainingGoal(),
    recoveryPercent: recoveryPercentForExercise(exercise, recoverySnapshot),
  });
}

async function getTargetRecommendationForWorkoutExercise(
  session: WorkoutSession,
  workoutExercise: WorkoutExercise,
  exercise: ExerciseMaster,
  currentSets: WorkoutSet[],
  routinePlan?: RoutineExercisePlan,
  routineDay?: RoutineDay,
  recoverySnapshot?: RecoverySnapshot,
): Promise<ExerciseTargetRecommendation> {
  const firstSet = currentSets[0];
  const fallbackPlan: RoutineExercisePlan = {
    id: `${workoutExercise.id}_target_plan`,
    routineDayId: session.routineDayId ?? '',
    exerciseId: workoutExercise.exerciseId,
    order: workoutExercise.order,
    plannedSets: Math.max(1, currentSets.length || 3),
    plannedWeightKg: firstSet?.weightKg || undefined,
    plannedReps: firstSet?.reps || 10,
    plannedRir: firstSet?.rir ?? 2,
    plannedRestSeconds: workoutExercise.restSeconds ?? 90,
  };

  return getPlanRecommendation(session.id, routinePlan ?? fallbackPlan, exercise, routineDay, recoverySnapshot);
}

async function seedWorkoutExercisesFromRoutineDay(sessionId: string, routineDayId?: string): Promise<void> {
  if (!routineDayId) return;

  const plans = await db.routineExercisePlans.where('routineDayId').equals(routineDayId).sortBy('order');
  if (plans.length === 0) return;

  const [routineDay, planExercises] = await Promise.all([
    db.routineDays.get(routineDayId),
    Promise.all(plans.map((plan) => db.exercises.get(plan.exerciseId))),
  ]);
  const exerciseById = new Map(plans.map((plan, index) => [plan.exerciseId, planExercises[index]]));
  const recoverySnapshot = await getCurrentRecoverySnapshot();
  const recommendations = await Promise.all(
    plans.map((plan, index) => getPlanRecommendation(sessionId, plan, planExercises[index], routineDay, recoverySnapshot)),
  );
  const recommendationByPlanId = new Map(plans.map((plan, index) => [plan.id, recommendations[index]]));
  const seed = createWorkoutExerciseSeed(sessionId, plans, exerciseById, recommendationByPlanId);

  await db.transaction('rw', db.workoutSessions, db.workoutExercises, db.workoutSets, async () => {
    await db.workoutExercises.bulkPut(seed.workoutExercises);
    await db.workoutSets.bulkPut(seed.workoutSets);
    const session = await db.workoutSessions.get(sessionId);
    if (session?.recommendationSnapshot) {
      await db.workoutSessions.update(sessionId, {
        recommendationSnapshot: {
          ...session.recommendationSnapshot,
          exerciseTargets: seed.recommendationTargets,
        },
      });
    }
  });
}

export async function getTodayWorkout(): Promise<ActiveWorkout | undefined> {
  const date = formatDateKey(new Date());
  const session = (await getWorkoutSessionsForDate(date))
    .filter((workoutSession) => workoutSession.status === 'in_progress')
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))[0];

  if (!session) return undefined;

  const existingExerciseCount = await db.workoutExercises.where('sessionId').equals(session.id).count();
  if (existingExerciseCount === 0 && session.routineDayId) {
    await seedWorkoutExercisesFromRoutineDay(session.id, session.routineDayId);
  }
  await dedupeWorkoutExercisesByExercise(session.id);

  const [routine, routineDay] = await Promise.all([
    session.routineId ? db.routines.get(session.routineId) : undefined,
    session.routineDayId ? db.routineDays.get(session.routineDayId) : undefined,
  ]);

  return {
    session,
    routineName: routine?.name,
    routineDay,
  };
}

export async function getWorkoutSummariesForDate(date: string): Promise<WorkoutSummary[]> {
  const sessions = (await getWorkoutSessionsForDate(date))
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
  return Promise.all(sessions.map(getWorkoutSummary));
}

export async function getWorkoutExerciseLogs(sessionId: string): Promise<WorkoutExerciseLog[]> {
  const workoutExercises = await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order');
  const session = await db.workoutSessions.get(sessionId);
  const recoverySnapshot = await getCurrentRecoverySnapshot();

  return Promise.all(
    workoutExercises.map(async (workoutExercise) => {
      const [exercise, sets, routinePlan] = await Promise.all([
        db.exercises.get(workoutExercise.exerciseId),
        db.workoutSets.where('workoutExerciseId').equals(workoutExercise.id).sortBy('setNo'),
        session?.routineDayId
          ? db.routineExercisePlans
            .where('routineDayId')
            .equals(session.routineDayId)
            .filter((plan) => plan.exerciseId === workoutExercise.exerciseId)
            .first()
          : undefined,
      ]);

      if (!exercise) {
        throw new Error(`Exercise not found: ${workoutExercise.exerciseId}`);
      }

      const prevRecord = await getPreviousExerciseRecord(workoutExercise.sessionId, workoutExercise.exerciseId);
      const pastBests = await getExercisePastBests(workoutExercise.sessionId, workoutExercise.exerciseId);
      const routineDay = session?.routineDayId ? await db.routineDays.get(session.routineDayId) : undefined;
      const targetRecommendation = session
        ? await getTargetRecommendationForWorkoutExercise(session, workoutExercise, exercise, sets, routinePlan, routineDay, recoverySnapshot)
        : undefined;

      return {
        workoutExercise,
        exercise,
        sets,
        ...prevRecord,
        pastBestWeight: pastBests.bestWeight,
        pastBestVolume: pastBests.bestVolume,
        targetRecommendation,
        weightIncrementKg: resolveWeightIncrementKg(routinePlan),
      };
    }),
  );
}

async function getNextWorkoutItemOrder(sessionId: string): Promise<number> {
  const [workoutExercises, cardioRecords] = await Promise.all([
    db.workoutExercises.where('sessionId').equals(sessionId).toArray(),
    db.cardioRecords.where('sessionId').equals(sessionId).toArray(),
  ]);
  const maxOrder = Math.max(
    0,
    ...workoutExercises.map((item) => item.order),
    ...cardioRecords.map((item) => item.order ?? 0),
  );

  return maxOrder + 1;
}

export async function getWorkoutCardioRecords(sessionId: string): Promise<CardioRecord[]> {
  const [workoutExercises, cardioRecords] = await Promise.all([
    db.workoutExercises.where('sessionId').equals(sessionId).toArray(),
    db.cardioRecords.where('sessionId').equals(sessionId).toArray(),
  ]);
  const fallbackStart = workoutExercises.length + 1;

  return cardioRecords
    .map((record, index) => ({ record, order: record.order ?? fallbackStart + index }))
    .sort((a, b) => a.order - b.order || a.record.startedAt.localeCompare(b.record.startedAt))
    .map((item) => item.record);
}

export function calculateCardioDurationSeconds(startedAt: string, endedAt: string): number | undefined {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return undefined;
  return Math.round((endMs - startMs) / 1000);
}

export function createDraftCardioRecord(sessionId: string, now = new Date(), order?: number): CardioRecord {
  const startedAt = now.toISOString();
  const endedAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

  return {
    id: `${sessionId}_cardio_${now.getTime()}`,
    sessionId,
    order,
    isDraft: true,
    source: 'manual',
    activityType: 'running',
    environment: 'indoor',
    machineType: 'treadmill',
    startedAt,
    endedAt,
    durationSeconds: calculateCardioDurationSeconds(startedAt, endedAt),
    distanceKm: 0,
    averageSpeedKmh: undefined,
  };
}

export async function addCardioRecordToWorkout(sessionId: string): Promise<void> {
  const existingCardio = await db.cardioRecords.where('sessionId').equals(sessionId).toArray();
  const existingCardioOrder = existingCardio
    .map((record) => record.order)
    .filter((order): order is number => order !== undefined)
    .sort((a, b) => a - b)[0];
  const order = existingCardioOrder ?? await getNextWorkoutItemOrder(sessionId);

  await db.cardioRecords.put(createDraftCardioRecord(sessionId, new Date(), order));
}

async function ensureRunningDraft(sessionId: string): Promise<void> {
  const existingCount = await db.cardioRecords.where('sessionId').equals(sessionId).count();
  if (existingCount > 0) return;

  await addCardioRecordToWorkout(sessionId);
}

export async function updateCardioRecord(
  cardioRecordId: string,
  values: Partial<CardioRecord>,
): Promise<void> {
  const existing = await db.cardioRecords.get(cardioRecordId);
  if (!existing) return;

  const updated = { ...existing, ...values };
  await db.cardioRecords.update(cardioRecordId, {
    ...values,
    durationSeconds: calculateCardioDurationSeconds(updated.startedAt, updated.endedAt),
    averageSpeedKmh: updated.distanceKm
      ? calculateAverageSpeedKmh(updated.distanceKm, updated.startedAt, updated.endedAt)
      : undefined,
  });
}

export async function deleteCardioRecord(cardioRecordId: string): Promise<void> {
  await db.cardioRecords.delete(cardioRecordId);
}

async function getPreviousExerciseRecord(
  currentSessionId: string,
  exerciseId: string,
): Promise<Pick<WorkoutExerciseLog, 'previousSummary' | 'previousSets'>> {
  const currentSession = await db.workoutSessions.get(currentSessionId);
  const workoutExercises = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((item) => item.sessionId !== currentSessionId)
    .toArray();

  const candidates = await Promise.all(
    workoutExercises.map(async (workoutExercise) => {
      const [session, sets] = await Promise.all([
        db.workoutSessions.get(workoutExercise.sessionId),
        db.workoutSets.where('workoutExerciseId').equals(workoutExercise.id).sortBy('setNo'),
      ]);

      return { session, sets };
    }),
  );

  const previous = candidates
    .filter((candidate) => (
      candidate.session
      && candidate.session.status === 'completed'
      && candidate.session.startedAt !== undefined
      && candidate.session.startedAt < (currentSession?.startedAt ?? new Date().toISOString())
      && candidate.sets.some((set) => set.isCompleted)
    ))
    .sort((a, b) => (b.session?.startedAt ?? '').localeCompare(a.session?.startedAt ?? ''))[0];

  if (!previous?.session) return { previousSets: [] };

  const completedSets = previous.sets.filter((set) => set.isCompleted);
  const bestSet = completedSets
    .slice()
    .sort((a, b) => (b.weightKg * b.reps) - (a.weightKg * a.reps))[0];
  const volume = calculateExerciseVolumeKg(previous.sets);

  if (!bestSet) return { previousSets: [] };

  const rir = bestSet.rir === undefined ? '' : `, RIR ${bestSet.rir}`;
  return {
    previousSummary: `${previous.session.date}: ${completedSets.length} sets, best ${bestSet.weightKg}kg x ${bestSet.reps}${rir}, ${volume.toLocaleString()} kg`,
    previousSets: completedSets,
  };
}

export async function getWorkoutSummary(session: WorkoutSession): Promise<WorkoutSummary> {
  const [routine, routineDay, exerciseCount, cardioCount] = await Promise.all([
    session.routineId ? db.routines.get(session.routineId) : undefined,
    session.routineDayId ? db.routineDays.get(session.routineDayId) : undefined,
    db.workoutExercises.where('sessionId').equals(session.id).count(),
    db.cardioRecords
      .where('sessionId')
      .equals(session.id)
      .filter((record) => record.isDraft !== true)
      .count(),
  ]);

  return {
    session,
    routineName: routine?.name,
    routineDay,
    exerciseCount,
    cardioCount,
  };
}

export async function getRecentWorkoutSummaries(limit = 7): Promise<WorkoutSummary[]> {
  const sessions = (await db.workoutSessions.toArray())
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))
    .slice(0, limit);
  return Promise.all(sessions.map(getWorkoutSummary));
}

export async function getMonthlyWorkoutSummaries(year: number, monthIndex: number): Promise<WorkoutSummary[]> {
  const start = formatDateKey(new Date(year, monthIndex, 1));
  const end = formatDateKey(new Date(year, monthIndex + 1, 0));
  const sessions = (await db.workoutSessions.toArray())
    .filter((session) => session.date >= start && session.date <= end)
    .sort((a, b) => (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt));

  return Promise.all(sessions.map(getWorkoutSummary));
}

export async function getWorkoutSummariesForDateRange(startDate: string, endDate: string): Promise<WorkoutSummary[]> {
  const sessions = (await db.workoutSessions.toArray())
    .filter((session) => session.date >= startDate && session.date <= endDate)
    .sort((a, b) => (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt));

  return Promise.all(sessions.map(getWorkoutSummary));
}

export async function getLatestWorkoutSummary(): Promise<WorkoutSummary | undefined> {
  const session = (await db.workoutSessions.toArray())
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))[0];
  return session ? getWorkoutSummary(session) : undefined;
}

export async function addExerciseToWorkout(sessionId: string, exerciseId: string): Promise<string | undefined> {
  const existing = await db.workoutExercises
    .where('sessionId')
    .equals(sessionId)
    .filter((workoutExercise) => workoutExercise.exerciseId === exerciseId)
    .first();

  if (existing) return existing.id;

  const order = await getNextWorkoutItemOrder(sessionId);
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return undefined;

  const isWarmup = isWarmupOnlyExercise(exercise);
  const workoutExerciseId = `${sessionId}_${exerciseId}_${Date.now()}`;
  const session = await db.workoutSessions.get(sessionId);
  const routineDay = session?.routineDayId ? await db.routineDays.get(session.routineDayId) : undefined;
  const recoverySnapshot = await getCurrentRecoverySnapshot();
  const recommendation = await getPlanRecommendation(sessionId, {
    id: `${workoutExerciseId}_free_plan`,
    routineDayId: routineDay?.id ?? '',
    exerciseId,
    order,
    plannedSets: 3,
    plannedReps: isWarmup ? 12 : 10,
    plannedRir: isWarmup ? undefined : 2,
    plannedRestSeconds: 90,
  }, exercise, routineDay, recoverySnapshot);
  const workoutExercise: WorkoutExercise = {
    id: workoutExerciseId,
    sessionId,
    exerciseId,
    order,
    status: 'planned',
    totalVolumeKg: 0,
    restSeconds: 90,
  };

  const targetSetCount = Math.max(1, recommendation.sets);
  const sets: WorkoutSet[] = Array.from({ length: targetSetCount }, (_, index) => index + 1).map((setNo) => ({
    id: `${workoutExerciseId}_set_${setNo}`,
    workoutExerciseId,
    setNo,
    weightKg: recommendation.weightKg ?? 0,
    reps: recommendation.reps ?? 0,
    rir: recommendation.rir,
    isCompleted: false,
    isWarmup,
  }));

  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    await db.workoutExercises.put(workoutExercise);
    await db.workoutSets.bulkPut(sets);
  });

  return workoutExerciseId;
}

export async function replaceWorkoutExercise(workoutExerciseId: string, exerciseId: string): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise || workoutExercise.exerciseId === exerciseId) return;

  const duplicate = await db.workoutExercises
    .where('sessionId')
    .equals(workoutExercise.sessionId)
    .filter((item) => item.id !== workoutExerciseId && item.exerciseId === exerciseId)
    .first();

  if (duplicate) return;

  const exercise = await db.exercises.get(exerciseId);
  const isWarmup = isWarmupOnlyExercise(exercise);

  await db.transaction('rw', db.workoutExercises, db.workoutSets, db.workoutSessions, async () => {
    await db.workoutExercises.update(workoutExerciseId, { exerciseId });
    const sets = await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray();
    await Promise.all(sets.map((set) => db.workoutSets.update(set.id, { isWarmup })));
    await refreshExerciseVolume(workoutExerciseId);
  });
}

async function refreshSessionVolume(sessionId: string): Promise<void> {
  const workoutExercises = await db.workoutExercises.where('sessionId').equals(sessionId).toArray();
  const sessionVolume = calculateSessionStrengthVolumeKg(workoutExercises.map((item) => item.totalVolumeKg));

  await db.workoutSessions.update(sessionId, {
    totalStrengthVolumeKg: sessionVolume,
    updatedAt: new Date().toISOString(),
  });
}

async function refreshExerciseVolume(workoutExerciseId: string): Promise<void> {
  const [workoutExercise, sets] = await Promise.all([
    db.workoutExercises.get(workoutExerciseId),
    db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray(),
  ]);

  if (!workoutExercise) return;

  const exerciseVolume = calculateExerciseVolumeKg(sets);
  const exerciseStatus = sets.some((set) => set.isCompleted) ? 'completed' : 'planned';

  await db.workoutExercises.update(workoutExerciseId, {
    status: exerciseStatus,
    totalVolumeKg: exerciseVolume,
  });
  await refreshSessionVolume(workoutExercise.sessionId);
}

export async function addSetToWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const existingSets = await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNo');
  const lastSet = existingSets[existingSets.length - 1];
  const nextSetNo = existingSets.length + 1;

  await db.workoutSets.put({
    id: `${workoutExerciseId}_set_${nextSetNo}`,
    workoutExerciseId,
    setNo: nextSetNo,
    weightKg: lastSet?.weightKg ?? 0,
    reps: lastSet?.reps ?? 0,
    estimatedOneRmKg: calculateEstimatedOneRmKg({
      weightKg: lastSet?.weightKg ?? 0,
      reps: lastSet?.reps ?? 0,
    }),
    rir: lastSet?.rir,
    isCompleted: false,
    isWarmup: lastSet?.isWarmup ?? false,
  });
}

export async function addWarmupSetsToWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;

  const exercise = await db.exercises.get(workoutExercise.exerciseId);
  const isBodyweight = exercise?.category === 'bodyweight';

  const session = await db.workoutSessions.get(workoutExercise.sessionId);
  let weightIncrementKg = DEFAULT_WEIGHT_INCREMENT_KG;
  if (session?.routineDayId) {
    const plan = await db.routineExercisePlans
      .where('routineDayId')
      .equals(session.routineDayId)
      .filter((p) => p.exerciseId === workoutExercise.exerciseId)
      .first();
    weightIncrementKg = resolveWeightIncrementKg(plan);
  }

  // Get existing sets to base warmup calculations on
  const existingSets = await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNo');
  
  // Find first non-warmup completed/planned set, or fallback to the first set, or default values
  const baseSet = existingSets.find((s) => !s.isWarmup && s.type !== 'warmup') || existingSets[0];

  const targetWeight = baseSet?.weightKg ?? 20;
  const targetReps = baseSet?.reps ?? 10;

  const roundWeight = (w: number, inc: number) => {
    if (w <= 0) return 0;
    const rounded = Math.round(w / inc) * inc;
    return rounded > 0 ? rounded : inc;
  };

  await db.transaction('rw', db.workoutSets, db.workoutExercises, db.workoutSessions, async () => {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNo');
    
    // Shift all existing sets by +3
    for (const set of sets) {
      await db.workoutSets.update(set.id, { setNo: set.setNo + 3 });
    }

    const now = Date.now();
    const warmupSets: WorkoutSet[] = [
      {
        id: `${workoutExerciseId}_warmup_1_${now}`,
        workoutExerciseId,
        setNo: 1,
        weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.5, weightIncrementKg)),
        reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.5)) : 10,
        estimatedOneRmKg: calculateEstimatedOneRmKg({
          weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.5, weightIncrementKg)),
          reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.5)) : 10,
        }),
        isCompleted: false,
        isWarmup: true,
        type: 'warmup',
      },
      {
        id: `${workoutExerciseId}_warmup_2_${now}`,
        workoutExerciseId,
        setNo: 2,
        weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.7, weightIncrementKg)),
        reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.7)) : 5,
        estimatedOneRmKg: calculateEstimatedOneRmKg({
          weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.7, weightIncrementKg)),
          reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.7)) : 5,
        }),
        isCompleted: false,
        isWarmup: true,
        type: 'warmup',
      },
      {
        id: `${workoutExerciseId}_warmup_3_${now}`,
        workoutExerciseId,
        setNo: 3,
        weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.9, weightIncrementKg)),
        reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.9)) : 2,
        estimatedOneRmKg: calculateEstimatedOneRmKg({
          weightKg: isBodyweight ? 0 : Math.min(targetWeight, roundWeight(targetWeight * 0.9, weightIncrementKg)),
          reps: isBodyweight ? Math.max(1, Math.round(targetReps * 0.9)) : 2,
        }),
        isCompleted: false,
        isWarmup: true,
        type: 'warmup',
      },
    ];

    await db.workoutSets.bulkPut(warmupSets);
    await refreshExerciseVolume(workoutExerciseId);
  });
}

export async function deleteWorkoutSet(setId: string): Promise<void> {
  const set = await db.workoutSets.get(setId);
  if (!set) return;

  await db.transaction('rw', db.workoutSets, db.workoutExercises, db.workoutSessions, async () => {
    await db.workoutSets.delete(setId);

    const remainingSets = await db.workoutSets.where('workoutExerciseId').equals(set.workoutExerciseId).sortBy('setNo');
    await Promise.all(
      remainingSets.map((remainingSet, index) => db.workoutSets.update(remainingSet.id, { setNo: index + 1 })),
    );
    await refreshExerciseVolume(set.workoutExerciseId);
  });
}

export async function deleteWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;

  await db.transaction('rw', db.workoutExercises, db.workoutSets, db.workoutSessions, async () => {
    await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).delete();
    await db.workoutExercises.delete(workoutExerciseId);

    const remainingExercises = await db.workoutExercises.where('sessionId').equals(workoutExercise.sessionId).sortBy('order');
    await Promise.all(
      remainingExercises.map((remainingExercise, index) => (
        db.workoutExercises.update(remainingExercise.id, { order: index + 1 })
      )),
    );
    await refreshSessionVolume(workoutExercise.sessionId);
  });
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  await clearWorkoutSessionRecords(sessionId, true);
}

async function clearWorkoutSessionRecords(sessionId: string, deleteSession = false): Promise<void> {
  const workoutExercises = await db.workoutExercises.where('sessionId').equals(sessionId).toArray();

  await db.transaction('rw', db.workoutSessions, db.workoutExercises, db.workoutSets, db.cardioRecords, async () => {
    if (workoutExercises.length > 0) {
      await db.workoutSets.where('workoutExerciseId').anyOf(workoutExercises.map((exercise) => exercise.id)).delete();
    }
    await db.workoutExercises.where('sessionId').equals(sessionId).delete();
    await db.cardioRecords.where('sessionId').equals(sessionId).delete();
    if (deleteSession) {
      await db.workoutSessions.delete(sessionId);
    }
  });
}

type WorkoutOrderItem = {
  kind: 'strength' | 'cardio';
  id: string;
  sessionId: string;
  order: number;
};

async function getWorkoutOrderItems(sessionId: string): Promise<WorkoutOrderItem[]> {
  const [workoutExercises, cardioRecords] = await Promise.all([
    db.workoutExercises.where('sessionId').equals(sessionId).toArray(),
    db.cardioRecords.where('sessionId').equals(sessionId).toArray(),
  ]);
  const cardioOrders = cardioRecords
    .map((record, index) => record.order ?? workoutExercises.length + index + 1);
  const cardioOrder = cardioOrders.length > 0 ? Math.min(...cardioOrders) : undefined;

  return [
    ...workoutExercises.map((item): WorkoutOrderItem => ({
      kind: 'strength',
      id: item.id,
      sessionId,
      order: item.order,
    })),
    ...(cardioOrder !== undefined ? [{
      kind: 'cardio' as const,
      id: 'cardio',
      sessionId,
      order: cardioOrder,
    }] : []),
  ].sort((a, b) => a.order - b.order);
}

async function updateWorkoutOrderItem(item: WorkoutOrderItem, order: number): Promise<void> {
  if (item.kind === 'strength') {
    await db.workoutExercises.update(item.id, { order });
    return;
  }

  const cardioRecords = await db.cardioRecords.where('sessionId').equals(item.sessionId).toArray();
  await Promise.all(cardioRecords.map((record) => db.cardioRecords.update(record.id, { order })));
}

async function moveWorkoutOrderItem(item: WorkoutOrderItem, direction: -1 | 1): Promise<void> {
  const items = await getWorkoutOrderItems(item.sessionId);
  const index = items.findIndex((candidate) => candidate.kind === item.kind && candidate.id === item.id);
  const target = items[index + direction];

  if (index < 0 || !target) return;

  await db.transaction('rw', db.workoutExercises, db.cardioRecords, async () => {
    await updateWorkoutOrderItem(item, target.order);
    await updateWorkoutOrderItem(target, item.order);
  });
}

export async function moveWorkoutExercise(workoutExerciseId: string, direction: -1 | 1): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;

  await moveWorkoutOrderItem({
    kind: 'strength',
    id: workoutExercise.id,
    sessionId: workoutExercise.sessionId,
    order: workoutExercise.order,
  }, direction);
}

export async function moveWorkoutCardioBlock(sessionId: string, direction: -1 | 1): Promise<void> {
  const items = await getWorkoutOrderItems(sessionId);
  const cardioItem = items.find((item) => item.kind === 'cardio');
  if (!cardioItem) return;

  await moveWorkoutOrderItem(cardioItem, direction);
}

export async function updateWorkoutSet(
  setId: string,
  values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'isHard' | 'type' | 'intensityTechnique'>>,
): Promise<void> {
  const existingSet = await db.workoutSets.get(setId);
  if (!existingSet) return;

  await db.transaction('rw', db.workoutSets, db.workoutExercises, db.workoutSessions, async () => {
    const updatedSet = { ...existingSet, ...values };
    await db.workoutSets.update(setId, {
      ...values,
      estimatedOneRmKg: calculateEstimatedOneRmKg(updatedSet),
    });

    await refreshExerciseVolume(updatedSet.workoutExerciseId);
  });
}

export async function updateWorkoutSessionMemo(sessionId: string, memo: string): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    memo: memo.trim() || undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateWorkoutSessionRoutine(
  sessionId: string,
  routineId?: string,
  routineDayId?: string,
): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    routineId,
    routineDayId,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateWorkoutExerciseMemo(workoutExerciseId: string, memo: string): Promise<void> {
  await db.workoutExercises.update(workoutExerciseId, {
    memo: memo.trim() || undefined,
  });
}

export async function updateWorkoutExerciseRestSeconds(workoutExerciseId: string, restSeconds: number): Promise<void> {
  await db.workoutExercises.update(workoutExerciseId, {
    restSeconds: Math.max(15, Math.min(600, Math.round(restSeconds))),
  });
}

async function recordAutoSkippedCompanionCardio(sessionId: string, now: Date): Promise<void> {
  const completedSession = await db.workoutSessions.get(sessionId);
  if (
    !completedSession
    || completedSession.entryKind === 'running'
    || completedSession.entryKind === 'free'
    || !completedSession.routineId
  ) {
    return;
  }

  const companionCardio = await db.cardioRecords
    .where('sessionId')
    .equals(sessionId)
    .filter((record) => record.isDraft !== true && (record.distanceKm ?? 0) > 0)
    .first();
  if (!companionCardio) return;

  const routine = await db.routines.get(completedSession.routineId);
  if (!routine) return;

  const cycleItems = await db.routineCyclePlanItems
    .where('routineId')
    .equals(routine.id)
    .sortBy('order');
  if (cycleItems.length === 0) return;

  const skippedRunningItem = resolveAutoSkippedRunningItem(completedSession, cycleItems);
  if (!skippedRunningItem) return;

  const { nextItem, shouldSkipCardio } = await getSuggestedCyclePlanItem(routine);
  if (!shouldSkipCardio || nextItem.id === skippedRunningItem.id) return;

  const existingSkip = await db.workoutSessions
    .where('routineId')
    .equals(routine.id)
    .filter((session) => (
      session.date === completedSession.date
      && session.cyclePlanItemId === skippedRunningItem.id
      && session.status === 'skipped'
      && session.autoSkipped === true
    ))
    .first();
  if (existingSkip) return;

  const timestamp = now.toISOString();
  await db.workoutSessions.put({
    id: `workout_${completedSession.date}_auto_skip_${skippedRunningItem.id}_${now.getTime()}`,
    date: completedSession.date,
    startedAt: timestamp,
    endedAt: timestamp,
    timeBand: completedSession.timeBand,
    routineId: routine.id,
    cyclePlanItemId: skippedRunningItem.id,
    entryKind: 'running',
    status: 'skipped',
    totalStrengthVolumeKg: 0,
    autoSkipped: true,
    skipReason: 'companion_cardio_completed',
    memo: 'Auto-skipped because cardio was completed inside the companion strength workout.',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function completeWorkoutSession(sessionId: string): Promise<void> {
  const now = new Date();
  await db.workoutSessions.update(sessionId, {
    status: 'completed',
    endedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  await recordAutoSkippedCompanionCardio(sessionId, now);
}

export async function skipWorkoutSession(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'skipped',
    endedAt: new Date().toISOString(),
    skipReason: 'manual',
    updatedAt: new Date().toISOString(),
  });
}

export async function unskipWorkoutSession(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'in_progress',
    endedAt: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export type ExerciseHistoryEntry = {
  date: string;
  sessionId: string;
  routineName?: string;
  totalVolumeKg: number;
  sets: WorkoutSet[];
};

export type ExerciseHistoryDetails = {
  history: ExerciseHistoryEntry[];
  bestWeight: number;
  bestVolume: number;
  bestSessionVolume: number;
  bestEstimated1RM: number;
};

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistoryDetails> {
  const workoutExercises = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .toArray();

  const historyEntries: ExerciseHistoryEntry[] = [];
  let bestWeight = 0;
  let bestVolume = 0;
  let bestSessionVolume = 0;
  let bestEstimated1RM = 0;

  for (const we of workoutExercises) {
    const session = await db.workoutSessions.get(we.sessionId);
    if (!session || session.status !== 'completed') continue;

    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(we.id)
      .sortBy('setNo');

    const completedSets = sets.filter((s) => s.isCompleted);
    if (completedSets.length === 0) continue;

    let routineName: string | undefined;
    if (session.routineId) {
      const routine = await db.routines.get(session.routineId);
      routineName = routine?.name;
    }

    const totalVolumeKg = completedSets.reduce((sum, s) => sum + (s.weightKg * s.reps), 0);

    for (const s of completedSets) {
      if (s.weightKg > bestWeight) bestWeight = s.weightKg;
      const setVol = s.weightKg * s.reps;
      if (setVol > bestVolume) bestVolume = setVol;

      const est1RM = s.reps > 0 ? s.weightKg / (1.0278 - 0.0278 * s.reps) : 0;
      if (est1RM > bestEstimated1RM) bestEstimated1RM = est1RM;
    }

    if (totalVolumeKg > bestSessionVolume) bestSessionVolume = totalVolumeKg;

    historyEntries.push({
      date: session.date,
      sessionId: session.id,
      routineName,
      totalVolumeKg,
      sets,
    });
  }

  historyEntries.sort((a, b) => b.date.localeCompare(a.date) || b.sessionId.localeCompare(a.sessionId));

  return {
    history: historyEntries,
    bestWeight,
    bestVolume,
    bestSessionVolume,
    bestEstimated1RM: Math.round(bestEstimated1RM * 10) / 10,
  };
}

export type ExercisePastBests = {
  bestWeight: number;
  bestVolume: number;
};

export async function getExercisePastBests(
  currentSessionId: string,
  exerciseId: string,
): Promise<ExercisePastBests> {
  const currentSession = await db.workoutSessions.get(currentSessionId);
  const workoutExercises = await db.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((item) => item.sessionId !== currentSessionId)
    .toArray();

  let bestWeight = 0;
  let bestVolume = 0;

  for (const we of workoutExercises) {
    const session = await db.workoutSessions.get(we.sessionId);
    if (!session || session.status !== 'completed') continue;
    if (currentSession && (session.startedAt ?? session.createdAt) >= (currentSession.startedAt ?? currentSession.createdAt)) continue;

    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(we.id)
      .toArray();

    const completedSets = sets.filter((s) => s.isCompleted);
    for (const s of completedSets) {
      if (s.weightKg > bestWeight) bestWeight = s.weightKg;
      const setVol = s.weightKg * s.reps;
      if (setVol > bestVolume) bestVolume = setVol;
    }
  }

  return {
    bestWeight,
    bestVolume,
  };
}
