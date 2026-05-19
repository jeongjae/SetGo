import { db } from './db';
import { getActiveRoutine, getSuggestedRoutineDayForDate } from './routines';
import type { CardioRecord, ExerciseMaster, RoutineDay, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { formatDateKey, getTimeBand } from '../utils/date';
import { calculateAverageSpeedKmh, calculateExerciseVolumeKg, calculateSessionStrengthVolumeKg } from '../domain/volume';

export type ActiveWorkout = {
  session: WorkoutSession;
  routineName?: string;
  routineDay?: RoutineDay;
};

export type WorkoutSummary = ActiveWorkout & {
  exerciseCount: number;
};

export type WorkoutExerciseLog = {
  workoutExercise: WorkoutExercise;
  exercise: ExerciseMaster;
  sets: WorkoutSet[];
  previousSummary?: string;
  previousSets: WorkoutSet[];
};

export async function getOrCreateWorkoutForDate(
  date: string,
  selectedRoutineDayId?: string,
  options: { createNew?: boolean } = {},
): Promise<ActiveWorkout> {
  const now = new Date();
  const sessionDate = new Date(`${date}T12:00:00`);
  const activeRoutine = await getActiveRoutine();
  const routineDays = activeRoutine
    ? await db.routineDays.where('routineId').equals(activeRoutine.id).sortBy('sequence')
    : [];
  const scheduledRoutineDay = selectedRoutineDayId ? undefined : await getSuggestedRoutineDayForDate(sessionDate);
  const routineDay = routineDays.find((day) => day.id === selectedRoutineDayId)
    ?? scheduledRoutineDay;

  const existingSessions = await db.workoutSessions
    .where('date')
    .equals(date)
    .toArray();
  const inProgressSessions = existingSessions
    .filter((session) => session.status === 'in_progress')
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
  const existingSession = options.createNew
    ? undefined
    : selectedRoutineDayId
      ? inProgressSessions.find((session) => session.routineDayId === selectedRoutineDayId)
      : inProgressSessions[0];

  if (existingSession) {
    const existingExerciseCount = await db.workoutExercises.where('sessionId').equals(existingSession.id).count();
    if (existingExerciseCount === 0 && existingSession.routineDayId) {
      await seedWorkoutExercisesFromRoutineDay(existingSession.id, existingSession.routineDayId);
    }

    const existingRoutineDay = existingSession.routineDayId
      ? await db.routineDays.get(existingSession.routineDayId)
      : undefined;

    return {
      session: existingSession,
      routineName: activeRoutine?.name,
      routineDay: existingRoutineDay,
    };
  }

  const timestamp = now.toISOString();
  const session: WorkoutSession = {
    id: existingSessions.length === 0 ? `workout_${date}` : `workout_${date}_${now.getTime()}`,
    date,
    startedAt: existingSessions.length === 0 ? `${date}T12:00:00.000` : timestamp,
    timeBand: getTimeBand(sessionDate),
    routineId: activeRoutine?.id,
    routineDayId: routineDay?.id,
    status: 'in_progress',
    totalStrengthVolumeKg: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.workoutSessions.put(session);
  await seedWorkoutExercisesFromRoutineDay(session.id, routineDay?.id);

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

async function seedWorkoutExercisesFromRoutineDay(sessionId: string, routineDayId?: string): Promise<void> {
  if (!routineDayId) return;

  const plans = await db.routineExercisePlans.where('routineDayId').equals(routineDayId).sortBy('order');
  if (plans.length === 0) return;

  await db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    for (const [index, plan] of plans.entries()) {
      const workoutExerciseId = `${sessionId}_${plan.exerciseId}_${Date.now()}_${index + 1}`;
      const plannedSets = Math.max(1, plan.plannedSets ?? 3);
      const exercise = await db.exercises.get(plan.exerciseId);
      const isWarmup = exercise?.stage === 'warmup' && !exercise.stageTags?.includes('main');

      await db.workoutExercises.put({
        id: workoutExerciseId,
        sessionId,
        exerciseId: plan.exerciseId,
        order: index + 1,
        status: 'planned',
        totalVolumeKg: 0,
      });

      await db.workoutSets.bulkPut(
        Array.from({ length: plannedSets }, (_, setIndex) => ({
          id: `${workoutExerciseId}_set_${setIndex + 1}`,
          workoutExerciseId,
          setNo: setIndex + 1,
          weightKg: plan.plannedWeightKg ?? 0,
          reps: plan.plannedReps ?? 0,
          rir: plan.plannedRir,
          isCompleted: false,
          isWarmup,
        })),
      );
    }
  });
}

export async function getTodayWorkout(): Promise<ActiveWorkout | undefined> {
  const date = formatDateKey(new Date());
  const session = await db.workoutSessions
    .where('date')
    .equals(date)
    .filter((workoutSession) => workoutSession.status === 'in_progress')
    .first();

  if (!session) return undefined;

  const existingExerciseCount = await db.workoutExercises.where('sessionId').equals(session.id).count();
  if (existingExerciseCount === 0 && session.routineDayId) {
    await seedWorkoutExercisesFromRoutineDay(session.id, session.routineDayId);
  }

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
    environment: 'indoor',
    machineType: 'treadmill',
    startedAt,
    endedAt,
    distanceKm: 0,
    averageSpeedKmh: undefined,
  });
}

export async function updateCardioRecord(
  cardioRecordId: string,
  values: Partial<Pick<CardioRecord, 'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo'>>,
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
  const [routine, routineDay, exerciseCount] = await Promise.all([
    session.routineId ? db.routines.get(session.routineId) : undefined,
    session.routineDayId ? db.routineDays.get(session.routineDayId) : undefined,
    db.workoutExercises.where('sessionId').equals(session.id).count(),
  ]);

  return {
    session,
    routineName: routine?.name,
    routineDay,
    exerciseCount,
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

export async function getLatestWorkoutSummary(): Promise<WorkoutSummary | undefined> {
  const session = (await db.workoutSessions.toArray())
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))[0];
  return session ? getWorkoutSummary(session) : undefined;
}

export async function addExerciseToWorkout(sessionId: string, exerciseId: string): Promise<void> {
  const existing = await db.workoutExercises
    .where('sessionId')
    .equals(sessionId)
    .filter((workoutExercise) => workoutExercise.exerciseId === exerciseId)
    .first();

  if (existing) return;

  const order = await db.workoutExercises.where('sessionId').equals(sessionId).count() + 1;
  const exercise = await db.exercises.get(exerciseId);
  const isWarmup = exercise?.stage === 'warmup' && !exercise.stageTags?.includes('main');
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

  await db.workoutExercises.update(workoutExerciseId, { exerciseId });
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
  values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup'>>,
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
