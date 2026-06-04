import { db } from './db';
import { getActiveRoutine, getRoutineScheduleForDate } from './routines';
import type { CardioRecord, ExerciseMaster, RoutineDay, RoutineExercisePlan, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { formatDateKey, getTimeBand } from '../utils/date';
import { calculateAverageSpeedKmh, calculateExerciseVolumeKg, calculateSessionStrengthVolumeKg } from '../domain/volume';
import { isWarmupOnlyExercise } from '../domain/exercises';

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
  options: { createNew?: boolean } = {},
): WorkoutSession | undefined {
  if (options.createNew) return undefined;

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
  options: { createNew?: boolean } = {},
  routineId?: string,
  routineDayId?: string,
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
    ),
  };
}

export async function getOrCreateWorkoutForDate(
  date: string,
  selectedRoutineDayId?: string,
  options: { createNew?: boolean } = {},
): Promise<ActiveWorkout> {
  const now = new Date();
  const sessionDate = new Date(`${date}T12:00:00`);
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
  const scheduledPlan = selectedRoutineDayId
    ? undefined
    : await getRoutineScheduleForDate(sessionDate).catch((error) => {
      console.warn('Failed to load scheduled plan while starting workout', error);
      return undefined;
    });
  const scheduledRoutineDay = scheduledPlan?.kind === 'routine' ? scheduledPlan.routineDay : undefined;
  const shouldSeedRunning = !selectedRoutineDayId && scheduledPlan?.kind === 'running';
  const routineDay = routineDays.find((day) => day.id === selectedRoutineDayId)
    ?? scheduledRoutineDay;

  const existingSessions = await getWorkoutSessionsForDate(date);
  const sessionSelection = selectWorkoutStartSession(
    date,
    now,
    existingSessions,
    selectedRoutineDayId,
    options,
    activeRoutine?.id,
    routineDay?.id,
  );

  if (sessionSelection.kind === 'reuse') {
    const existingSession = sessionSelection.session;
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
      routineName: activeRoutine?.name,
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
    routineName: activeRoutine?.name,
    routineDay,
  };
}

export async function getOrCreateTodayWorkout(selectedRoutineDayId?: string): Promise<ActiveWorkout> {
  return getOrCreateWorkoutForDate(formatDateKey(new Date()), selectedRoutineDayId);
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
): { workoutExercises: WorkoutExercise[]; workoutSets: WorkoutSet[] } {
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSets: WorkoutSet[] = [];

  plans.forEach((plan, index) => {
    const workoutExerciseId = `${sessionId}_${plan.id}`;
    const plannedSets = Math.max(1, plan.plannedSets ?? 3);
    const exercise = exerciseById.get(plan.exerciseId);
    const isWarmup = isWarmupOnlyExercise(exercise);

    workoutExercises.push({
      id: workoutExerciseId,
      sessionId,
      exerciseId: plan.exerciseId,
      order: index + 1,
      status: 'planned',
      totalVolumeKg: 0,
    });
    workoutSets.push(...Array.from({ length: plannedSets }, (_, setIndex) => ({
      id: `${workoutExerciseId}_set_${setIndex + 1}`,
      workoutExerciseId,
      setNo: setIndex + 1,
      weightKg: plan.plannedWeightKg ?? 0,
      reps: plan.plannedReps ?? 0,
      rir: plan.plannedRir,
      isCompleted: false,
      isWarmup,
    })));
  });

  return { workoutExercises, workoutSets };
}

async function seedWorkoutExercisesFromRoutineDay(sessionId: string, routineDayId?: string): Promise<void> {
  if (!routineDayId) return;

  const plans = await db.routineExercisePlans.where('routineDayId').equals(routineDayId).sortBy('order');
  if (plans.length === 0) return;

  const planExercises = await Promise.all(plans.map((plan) => db.exercises.get(plan.exerciseId)));
  const exerciseById = new Map(plans.map((plan, index) => [plan.exerciseId, planExercises[index]]));
  const seed = createWorkoutExerciseSeed(sessionId, plans, exerciseById);

  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    await db.workoutExercises.bulkPut(seed.workoutExercises);
    await db.workoutSets.bulkPut(seed.workoutSets);
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

  return Promise.all(
    workoutExercises.map(async (workoutExercise) => {
      const [exercise, sets] = await Promise.all([
        db.exercises.get(workoutExercise.exerciseId),
        db.workoutSets.where('workoutExerciseId').equals(workoutExercise.id).sortBy('setNo'),
      ]);

      if (!exercise) {
        throw new Error(`Exercise not found: ${workoutExercise.exerciseId}`);
      }

      return {
        workoutExercise,
        exercise,
        sets,
        ...(await getPreviousExerciseRecord(workoutExercise.sessionId, workoutExercise.exerciseId)),
      };
    }),
  );
}

export async function getWorkoutCardioRecords(sessionId: string): Promise<CardioRecord[]> {
  return db.cardioRecords.where('sessionId').equals(sessionId).toArray();
}

export async function addCardioRecordToWorkout(sessionId: string): Promise<void> {
  const now = new Date();
  const startedAt = now.toISOString();
  const endedAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

  await db.cardioRecords.put({
    id: `${sessionId}_cardio_${Date.now()}`,
    sessionId,
    isDraft: true,
    environment: 'indoor',
    machineType: 'treadmill',
    startedAt,
    endedAt,
    distanceKm: 0,
    averageSpeedKmh: undefined,
  });
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

  const order = await db.workoutExercises.where('sessionId').equals(sessionId).count() + 1;
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return undefined;

  const isWarmup = isWarmupOnlyExercise(exercise);
  const workoutExerciseId = `${sessionId}_${exerciseId}_${Date.now()}`;
  const workoutExercise: WorkoutExercise = {
    id: workoutExerciseId,
    sessionId,
    exerciseId,
    order,
    status: 'planned',
    totalVolumeKg: 0,
  };

  const sets: WorkoutSet[] = [1, 2, 3].map((setNo) => ({
    id: `${workoutExerciseId}_set_${setNo}`,
    workoutExerciseId,
    setNo,
    weightKg: 0,
    reps: 0,
    rir: undefined,
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
    rir: lastSet?.rir,
    isCompleted: false,
    isWarmup: lastSet?.isWarmup ?? false,
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

export async function moveWorkoutExercise(workoutExerciseId: string, direction: -1 | 1): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;

  const workoutExercises = await db.workoutExercises.where('sessionId').equals(workoutExercise.sessionId).sortBy('order');
  const index = workoutExercises.findIndex((item) => item.id === workoutExerciseId);
  const target = workoutExercises[index + direction];

  if (index < 0 || !target) return;

  await db.transaction('rw', db.workoutExercises, async () => {
    await db.workoutExercises.update(workoutExercise.id, { order: target.order });
    await db.workoutExercises.update(target.id, { order: workoutExercise.order });
  });
}

export async function updateWorkoutSet(
  setId: string,
  values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'type'>>,
): Promise<void> {
  const existingSet = await db.workoutSets.get(setId);
  if (!existingSet) return;

  await db.transaction('rw', db.workoutSets, db.workoutExercises, db.workoutSessions, async () => {
    await db.workoutSets.update(setId, values);

    const updatedSet = { ...existingSet, ...values };
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

export async function completeWorkoutSession(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'completed',
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function skipWorkoutSession(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'skipped',
    endedAt: new Date().toISOString(),
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
