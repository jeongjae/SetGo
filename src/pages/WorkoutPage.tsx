import { useEffect, useRef, useState, useMemo } from 'react';
import { Dumbbell, Plus, X } from 'lucide-react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { useKeyboardViewport } from '../hooks/useKeyboardViewport';
import { ExerciseHistoryModal } from '../components/ExerciseHistoryModal';
import { FloatingRestTimer } from '../components/workout/FloatingRestTimer';
import { ExerciseLogCard } from '../components/workout/ExerciseLogCard';
import { WorkoutCardioSection } from '../components/workout/WorkoutCardioSection';
import { WorkoutFooterActions } from '../components/workout/WorkoutFooterActions';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { getProgressLabel } from '../components/workout/WorkoutSetRowV2';
import { db } from '../db/db';
import { createRoutineFromWorkoutSession, getAllRoutines, getRoutineDayDisplayName, getRoutineDays } from '../db/routines';
import { formatDateKey } from '../utils/date';
import {
  disableWakeLock,
  enableWakeLock,
  isNotificationSupported,
  loadRestNotifyPref,
  notifyRestComplete,
  requestRestNotifyPermission,
  saveRestNotifyPref,
  vibrate,
} from '../utils/deviceTimer';
import {
  getExerciseCategories,
} from '../domain/exercises';
import { exerciseCountLabel, getStoredLocale, routineNameLabel, t, timeBandLabel, workoutStatusLabel } from '../i18n/i18n';
import {
  addExerciseToWorkout,
  addCardioRecordToWorkout,
  addSetToWorkoutExercise,
  addWarmupSetsToWorkoutExercise,
  completeWorkoutSession,
  deleteCardioRecord,
  deleteWorkoutExercise,
  deleteWorkoutSet,
  getWorkoutCardioRecords,
  getWorkoutBySessionId,
  getTodayWorkout,
  getWorkoutExerciseLogs,
  moveWorkoutCardioBlock,
  moveWorkoutExercise,
  replaceWorkoutExercise,
  skipWorkoutSession,
  updateCardioRecord,
  updateWorkoutExerciseMemo,
  updateWorkoutSessionRoutine,
  updateWorkoutSessionMemo,
  updateWorkoutSet,
  type ActiveWorkout,
  type WorkoutExerciseLog,
} from '../db/workouts';
import type { CardioRecord, ExerciseCategory, ExerciseMaster, ExerciseStage, Routine, RoutineDay, WorkoutExercise, WorkoutSession, WorkoutSet, WorkoutSetType } from '../types';

export { parseOptionalDecimalInput } from '../components/workout/WorkoutCardioSection';

type WorkoutPageProps = {
  mode?: 'active' | 'history-edit';
  sessionId?: string;
  onBack: () => void;
  onCompleted: () => void;
  onSkipped: () => void;
};

type HistoryEditSnapshot = {
  session: WorkoutSession;
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
  cardioRecords: CardioRecord[];
};

export type WorkoutFinishSummary = {
  completedExercises: number;
  completedSets: number;
  hardSets: number;
  prCount: number;
  cardioCount: number;
  totalVolumeKg: number;
  primaryText: string;
  metrics: Array<{ label: string; value: string; tone?: 'success' | 'accent' | 'danger' }>;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatCountdownSeconds(seconds: number): string {
  return formatElapsed(Math.max(0, seconds) * 1000);
}

export function getElapsedMs(startedAtStr: string, nowMs: number): number {
  const start = new Date(startedAtStr).getTime();
  if (Number.isNaN(start)) return 0;

  return Math.max(0, nowMs - start);
}

export function getLiveSessionElapsedMs(
  session: Pick<WorkoutSession, 'date' | 'startedAt' | 'status'>,
  nowMs: number,
): number | undefined {
  if (!session.startedAt || session.status !== 'in_progress') return undefined;
  if (session.date !== formatDateKey(new Date(nowMs))) return undefined;

  return getElapsedMs(session.startedAt, nowMs);
}

export function canCompleteWorkoutLog(completedStrengthSetCount: number, cardioRecordCount: number): boolean {
  return completedStrengthSetCount > 0 || cardioRecordCount > 0;
}

export function shouldCompleteHistoricalSetOnSave(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>,
  originalSet?: Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir'>,
): boolean {
  const hasLoggedValue = set.weightKg > 0 || set.reps > 0 || set.rir !== undefined;
  const hasChangedFromOriginal = !originalSet
    || set.weightKg !== originalSet.weightKg
    || set.reps !== originalSet.reps
    || set.rir !== originalSet.rir;

  return !set.isCompleted
    && hasLoggedValue
    && hasChangedFromOriginal;
}

export function countLoggedCardioRecords(cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>): number {
  return cardioRecords.filter((cardioRecord) => cardioRecord.isDraft !== true).length;
}

export function countFullyCompletedExercises(
  logs: Array<{ sets: Array<Pick<WorkoutSet, 'isCompleted'>> }>,
): number {
  return logs.filter((log) => log.sets.length > 0 && log.sets.every((set) => set.isCompleted)).length;
}

export function getWorkoutSetProgressBadges(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps'>,
  pastBestWeight?: number,
  pastBestVolume?: number,
): Array<'weight-pr' | 'volume-pr'> {
  if (!set.isCompleted) return [];

  const badges: Array<'weight-pr' | 'volume-pr'> = [];
  if (pastBestWeight !== undefined && pastBestWeight > 0 && set.weightKg >= pastBestWeight) {
    badges.push('weight-pr');
  }
  if (pastBestVolume !== undefined && pastBestVolume > 0 && (set.weightKg * set.reps) >= pastBestVolume) {
    badges.push('volume-pr');
  }

  return badges;
}

export function expandWorkoutExercise(
  expandedExercises: Record<string, boolean>,
  workoutExerciseId: string,
): Record<string, boolean> {
  return { ...expandedExercises, [workoutExerciseId]: true };
}

export function shouldConfirmWorkoutExerciseDelete(
  log: {
    workoutExercise: Pick<WorkoutExercise, 'memo'>;
    sets: Array<Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>>;
  },
): boolean {
  return Boolean(log.workoutExercise.memo?.trim())
    || log.sets.some((set) => (
      set.isCompleted
      || set.weightKg > 0
      || set.reps > 0
      || set.rir !== undefined
    ));
}

export function shouldConfirmWorkoutSetDelete(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'rir'>,
): boolean {
  return set.isCompleted
    || set.weightKg > 0
    || set.reps > 0
    || set.rir !== undefined;
}

export function getNextIncompleteSetTarget(
  logs: Array<{
    workoutExercise: Pick<WorkoutExercise, 'id'>;
    sets: Array<Pick<WorkoutSet, 'id' | 'isCompleted'>>;
  }>,
  completedSetId: string,
): { workoutExerciseId: string; inputId: string } | undefined {
  const orderedSets = logs.flatMap((log) => (
    log.sets.map((set) => ({
      set,
      workoutExerciseId: log.workoutExercise.id,
    }))
  ));
  const completedIndex = orderedSets.findIndex((item) => item.set.id === completedSetId);
  const nextItem = orderedSets
    .slice(Math.max(0, completedIndex + 1))
    .find((item) => !item.set.isCompleted);

  return nextItem
    ? { workoutExerciseId: nextItem.workoutExerciseId, inputId: `weight_input_${nextItem.set.id}` }
    : undefined;
}

export function getWorkoutFinishSummary(
  logs: WorkoutExerciseLog[],
  cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>,
  totalVolumeKg: number,
  locale: 'ko' | 'en',
): WorkoutFinishSummary {
  const completedSets = logs.flatMap((log) => log.sets).filter((set) => set.isCompleted);
  const hardSets = completedSets.filter((set) => !set.isWarmup && set.isHard === true).length;
  const prCount = logs.reduce((sum, log) => (
    sum + log.sets.filter((set) => getProgressLabel(set, log.pastBestWeight, log.pastBestVolume)).length
  ), 0);
  const completedExercises = countFullyCompletedExercises(logs);
  const cardioCount = countLoggedCardioRecords(cardioRecords);
  const primaryText = locale === 'ko'
    ? `${completedExercises}개 운동 / ${completedSets.length}세트 / ${totalVolumeKg.toLocaleString()}kg`
    : `${completedExercises} exercises / ${completedSets.length} sets / ${totalVolumeKg.toLocaleString()}kg`;
  const metrics = [
    {
      label: locale === 'ko' ? '운동' : 'Exercises',
      value: String(completedExercises),
    },
    {
      label: locale === 'ko' ? '세트' : 'Sets',
      value: String(completedSets.length),
    },
    {
      label: 'Hard',
      value: String(hardSets),
      tone: hardSets > 0 ? 'accent' as const : undefined,
    },
    {
      label: 'PR',
      value: String(prCount),
      tone: prCount > 0 ? 'success' as const : undefined,
    },
    {
      label: locale === 'ko' ? '러닝' : 'Cardio',
      value: String(cardioCount),
    },
  ];

  return {
    completedExercises,
    completedSets: completedSets.length,
    hardSets,
    prCount,
    cardioCount,
    totalVolumeKg,
    primaryText,
    metrics,
  };
}

export function shouldConfirmCardioDelete(
  cardioRecord: Pick<CardioRecord, 'distanceKm' | 'inclinePercent' | 'location' | 'memo'>,
): boolean {
  return (cardioRecord.distanceKm ?? 0) > 0
    || (cardioRecord.inclinePercent ?? 0) > 0
    || Boolean(cardioRecord.location?.trim())
    || Boolean(cardioRecord.memo?.trim());
}

export function WorkoutPage({ mode = 'active', sessionId, onBack, onCompleted, onSkipped }: WorkoutPageProps) {
  const [workout, setWorkout] = useState<ActiveWorkout | undefined>();
  const [logs, setLogs] = useState<WorkoutExerciseLog[]>([]);
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [exerciseStageFilter, setExerciseStageFilter] = useState<ExerciseStage | 'all'>('all');
  const [replacingWorkoutExerciseId, setReplacingWorkoutExerciseId] = useState<string | undefined>();
  const [locale] = useState(() => getStoredLocale());
  const [saveMessage, setSaveMessage] = useState(locale === 'ko' ? '\uB85C\uCEEC \uC800\uC7A5\uB428' : 'Saved locally');
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | undefined>();
  const [restDuration, setRestDuration] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restNotifyEnabled, setRestNotifyEnabled] = useState(() => loadRestNotifyPref());
  const isKeyboardOpen = useKeyboardViewport();
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [memoOpenExercises, setMemoOpenExercises] = useState<Record<string, boolean>>({});
  const [actionOpenExercises, setActionOpenExercises] = useState<Record<string, boolean>>({});
  const [savedRoutines, setSavedRoutines] = useState<Routine[]>([]);
  const [historyRoutineId, setHistoryRoutineId] = useState('');
  const [historyRoutineDayId, setHistoryRoutineDayId] = useState('');
  const [historyRoutineDays, setHistoryRoutineDays] = useState<RoutineDay[]>([]);
  const [selectedHistoryExerciseId, setSelectedHistoryExerciseId] = useState<string | undefined>();
  const historyEditSnapshot = useRef<HistoryEditSnapshot | undefined>(undefined);

  const loggedCardioRecords = useMemo(() => {
    return cardioRecords.filter((cardioRecord) => cardioRecord.isDraft !== true);
  }, [cardioRecords]);

  const totalCardioDistance = useMemo(() => {
    return loggedCardioRecords.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  }, [loggedCardioRecords]);

  const totalCardioMinutes = useMemo(() => {
    return loggedCardioRecords.reduce((acc, curr) => {
      const min = Math.max(
        1,
        Math.round((new Date(curr.endedAt).getTime() - new Date(curr.startedAt).getTime()) / 60000)
      );
      return acc + min;
    }, 0);
  }, [loggedCardioRecords]);

  const autoTransitionAccordion = (completedWorkoutExerciseId: string) => {
    setTimeout(() => {
      setLogs((currentLogs) => {
        const currentLogIndex = currentLogs.findIndex((l) => l.workoutExercise.id === completedWorkoutExerciseId);
        if (currentLogIndex === -1) return currentLogs;

        const currentLog = currentLogs[currentLogIndex];
        const allCompleted = currentLog.sets.every((s) => s.isCompleted);
        if (!allCompleted) return currentLogs;

        const nextUncompletedLog = currentLogs
          .slice(currentLogIndex + 1)
          .find((l) => !l.sets.every((s) => s.isCompleted))
          ?? currentLogs.find((l, idx) => idx !== currentLogIndex && !l.sets.every((s) => s.isCompleted));

        setExpandedExercises((prev) => {
          const nextState = { ...prev };
          nextState[completedWorkoutExerciseId] = false;
          if (nextUncompletedLog) {
            nextState[nextUncompletedLog.workoutExercise.id] = true;

            setTimeout(() => {
              const el = document.getElementById(`exercise-card-${nextUncompletedLog.workoutExercise.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
          }
          return nextState;
        });

        return currentLogs;
      });
    }, 300);
  };

  useEffect(() => {
    if (logs.length > 0 && Object.keys(expandedExercises).length === 0) {
      const firstUncompleted = logs.find((log) => !log.sets.every((set) => set.isCompleted));
      if (firstUncompleted) {
        setExpandedExercises({ [firstUncompleted.workoutExercise.id]: true });
      } else if (logs[0]) {
        setExpandedExercises({ [logs[0].workoutExercise.id]: true });
      }
    }
  }, [logs]);


  async function loadWorkout() {
    const todayWorkout = sessionId ? await getWorkoutBySessionId(sessionId) : await getTodayWorkout();
    setWorkout(todayWorkout);

    if (!todayWorkout) {
      setLogs([]);
      setCardioRecords([]);
      return;
    }

    const [workoutLogs, cardio, exerciseMasters] = await Promise.all([
      getWorkoutExerciseLogs(todayWorkout.session.id),
      getWorkoutCardioRecords(todayWorkout.session.id),
      db.exercises.filter((exercise) => exercise.isActive && !getExerciseCategories(exercise).includes('cardio')).toArray(),
    ]);

    setLogs(workoutLogs);
    setCardioRecords(cardio);
    setExercises(exerciseMasters);

    if (mode === 'history-edit') {
      if (historyEditSnapshot.current?.session.id !== todayWorkout.session.id) {
        historyEditSnapshot.current = {
          session: { ...todayWorkout.session },
          workoutExercises: workoutLogs.map((log) => ({ ...log.workoutExercise })),
          workoutSets: workoutLogs.flatMap((log) => log.sets.map((set) => ({ ...set }))),
          cardioRecords: cardio.map((record) => ({ ...record })),
        };
      }
      const routines = await getAllRoutines();
      setSavedRoutines(routines);
      setHistoryRoutineId(todayWorkout.session.routineId ?? '');
      setHistoryRoutineDayId(todayWorkout.session.routineDayId ?? '');
      setHistoryRoutineDays(todayWorkout.session.routineId ? await getRoutineDays(todayWorkout.session.routineId) : []);
    }
  }

  useEffect(() => {
    void loadWorkout();
  }, [sessionId, mode]);

  async function handleHistoryRoutineChange(routineId: string) {
    setHistoryRoutineId(routineId);
    if (!routineId) {
      setHistoryRoutineDayId('');
      setHistoryRoutineDays([]);
      return;
    }
    const days = await getRoutineDays(routineId);
    setHistoryRoutineDays(days);
    setHistoryRoutineDayId(days[0]?.id ?? '');
  }

  async function handleSaveHistoricalEdit() {
    if (!workout) return;
    await updateWorkoutSessionRoutine(
      workout.session.id,
      historyRoutineId || undefined,
      historyRoutineId ? historyRoutineDayId || undefined : undefined,
    );

    const originalSetById = new Map(
      historyEditSnapshot.current?.workoutSets.map((set) => [set.id, set]) ?? [],
    );
    const setsToComplete = logs.flatMap((log) => (
      log.sets.filter((set) => shouldCompleteHistoricalSetOnSave(set, originalSetById.get(set.id)))
    ));
    await Promise.all(setsToComplete.map((set) => updateWorkoutSet(set.id, { isCompleted: true })));

    const completedSetCountAfterSave = completedSetCount + setsToComplete.length;
    if (
      workout.session.status === 'in_progress'
      && canCompleteWorkoutLog(completedSetCountAfterSave, loggedCardioCount)
    ) {
      await completeWorkoutSession(workout.session.id);
    }
    onBack();
  }

  async function handleCancelHistoricalEdit() {
    const snapshot = historyEditSnapshot.current;
    if (!workout || !snapshot) {
      onBack();
      return;
    }

    await db.transaction('rw', db.workoutSessions, db.workoutExercises, db.workoutSets, db.cardioRecords, async () => {
      const currentExercises = await db.workoutExercises.where('sessionId').equals(workout.session.id).toArray();
      if (currentExercises.length > 0) {
        await db.workoutSets.where('workoutExerciseId').anyOf(currentExercises.map((exercise) => exercise.id)).delete();
      }
      await db.workoutExercises.where('sessionId').equals(workout.session.id).delete();
      await db.cardioRecords.where('sessionId').equals(workout.session.id).delete();
      await db.workoutSessions.put({ ...snapshot.session });
      if (snapshot.workoutExercises.length > 0) {
        await db.workoutExercises.bulkPut(snapshot.workoutExercises.map((exercise) => ({ ...exercise })));
      }
      if (snapshot.workoutSets.length > 0) {
        await db.workoutSets.bulkPut(snapshot.workoutSets.map((set) => ({ ...set })));
      }
      if (snapshot.cardioRecords.length > 0) {
        await db.cardioRecords.bulkPut(snapshot.cardioRecords.map((record) => ({ ...record })));
      }
    });
    onBack();
  }

  useEffect(() => {
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (isRestTimerActive && restTimerStartedAt) {
      interval = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - restTimerStartedAt) / 1000);
        const remaining = Math.max(0, restDuration - elapsedSec);
        setRestRemaining(remaining);
        if (remaining <= 0) {
          setIsRestTimerActive(false);
          vibrate([200, 100, 200]);
          notifyRestComplete(t(locale, 'timerFinished'), t(locale, 'restAlertBody'));
        }
      }, 500);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRestTimerActive, restTimerStartedAt, restDuration, locale]);

  // Keep the screen awake while a workout is in progress (no-op where unsupported).
  useEffect(() => {
    if (workout?.session.status !== 'in_progress') return undefined;
    enableWakeLock();
    return () => {
      void disableWakeLock();
    };
  }, [workout?.session.status]);

  async function handleToggleRestNotify() {
    if (restNotifyEnabled) {
      setRestNotifyEnabled(false);
      saveRestNotifyPref(false);
      return;
    }
    if (!isNotificationSupported()) {
      setSaveMessage(t(locale, 'restNotifyUnsupported'));
      return;
    }
    const permission = await requestRestNotifyPermission();
    if (permission === 'granted') {
      setRestNotifyEnabled(true);
      saveRestNotifyPref(true);
      return;
    }
    setSaveMessage(t(locale, permission === 'denied' ? 'restNotifyBlocked' : 'restNotifyUnsupported'));
  }

  async function handleAddExercise(exerciseId: string) {
    if (!workout) return;

    const addedWorkoutExerciseId = await addExerciseToWorkout(workout.session.id, exerciseId);
    setIsAdding(false);
    await loadWorkout();

    if (!addedWorkoutExerciseId) return;

    setExpandedExercises((current) => expandWorkoutExercise(current, addedWorkoutExerciseId));
    window.setTimeout(() => {
      document.getElementById(`exercise-card-${addedWorkoutExerciseId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }

  async function handleSetChange(
    set: WorkoutSet,
    values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'isHard' | 'type' | 'intensityTechnique'>>,
  ) {
    setSaveMessage(locale === 'ko' ? '\uC800\uC7A5 \uC911...' : 'Saving...');
    const wasCompleted = set.isCompleted;
    const isNowCompleted = values.isCompleted === true;
    const nextFocusTarget = isNowCompleted && !wasCompleted
      ? getNextIncompleteSetTarget(logs, set.id)
      : undefined;
    const completedLog = logs.find((log) => log.workoutExercise.id === set.workoutExerciseId);
    const shouldCollapseCompletedExercise = Boolean(
      completedLog?.sets.every((item) => (item.id === set.id ? true : item.isCompleted)),
    );

    await updateWorkoutSet(set.id, values);

    if (isNowCompleted && !wasCompleted) {
      const now = Date.now();
      const logForSet = logs.find((log) => log.workoutExercise.id === set.workoutExerciseId);
      const nextRestDuration = logForSet?.workoutExercise.restSeconds ?? restDuration;
      setRestDuration(nextRestDuration);
      setRestTimerStartedAt(now);
      setRestRemaining(nextRestDuration);
      setIsRestTimerActive(true);
    }

    await loadWorkout();
    setSaveMessage(`${locale === 'ko' ? '\uC800\uC7A5\uB428' : 'Saved'} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

    if (isNowCompleted && !wasCompleted) {
      if (nextFocusTarget) {
        setExpandedExercises((current) => ({
          ...current,
          [set.workoutExerciseId]: shouldCollapseCompletedExercise ? false : current[set.workoutExerciseId],
          [nextFocusTarget.workoutExerciseId]: true,
        }));
        // Reveal the next set but do NOT auto-focus its input. Re-focusing would
        // reopen the keyboard right after completion, hiding the rest timer that
        // just appeared (the "flickering" timer). Let the rest timer stay visible
        // and let the lifter tap the next set when they're ready to log it.
        window.setTimeout(() => {
          document.getElementById(nextFocusTarget.inputId)?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }, 240);
      } else {
        autoTransitionAccordion(set.workoutExerciseId);
      }
    }
  }

  async function handleCopyPreviousSet(set: WorkoutSet, previousSet: WorkoutSet | undefined) {
    if (!previousSet) return;

    await updateWorkoutSet(set.id, {
      weightKg: previousSet.weightKg,
      reps: previousSet.reps,
      rir: previousSet.rir,
      isWarmup: previousSet.isWarmup ?? false,
      isHard: previousSet.isHard ?? false,
      type: previousSet.type ?? (previousSet.isWarmup ? 'warmup' : 'normal'),
    });
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uCD5C\uADFC \uC6B4\uB3D9 \uC138\uD2B8\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4' : 'Recent workout set copied');
  }

  async function handleCopyPreviousExercise(log: WorkoutExerciseLog) {
    const pairs = log.sets
      .map((set, index) => ({ set, previousSet: log.previousSets[index] }))
      .filter((pair): pair is { set: WorkoutSet; previousSet: WorkoutSet } => pair.previousSet !== undefined);

    if (pairs.length === 0) return;

    await Promise.all(pairs.map(({ set, previousSet }) => updateWorkoutSet(set.id, {
      weightKg: previousSet.weightKg,
      reps: previousSet.reps,
      rir: previousSet.rir,
      isWarmup: previousSet.isWarmup ?? false,
      isHard: previousSet.isHard ?? false,
      type: previousSet.type ?? (previousSet.isWarmup ? 'warmup' : 'normal'),
    })));
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uCD5C\uADFC \uC6B4\uB3D9 \uC138\uD2B8\uB97C \uBAA8\uB450 \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4' : 'All recent sets copied');
  }

  async function handleQuickAdjustSet(
    set: WorkoutSet,
    field: 'weightKg' | 'reps' | 'rir',
    delta: number,
  ) {
    const currentValue = field === 'rir' ? set.rir ?? 0 : set[field];
    const nextValue = field === 'weightKg'
      ? Math.max(0, Number((currentValue + delta).toFixed(1)))
      : Math.max(0, Math.round(currentValue + delta));

    await handleSetChange(set, { [field]: nextValue });
  }

  async function handleToggleWarmup(set: WorkoutSet) {
    const nextWarmup = !set.isWarmup;
    await handleSetChange(set, {
      isWarmup: nextWarmup,
      type: nextWarmup ? 'warmup' : 'normal',
      isHard: nextWarmup ? false : set.isHard,
      isCompleted: nextWarmup ? true : set.isCompleted,
    });
  }

  async function handleToggleHardSet(set: WorkoutSet) {
    await handleSetChange(set, {
      isWarmup: false,
      type: 'normal',
      isCompleted: true,
      isHard: !set.isHard,
    });
  }

  async function handleCompleteWorkout() {
    if (!workout) return;

    await completeWorkoutSession(workout.session.id);
    onCompleted();
  }

  async function handleCreateRoutineFromWorkout() {
    if (!workout) return;

    const baseName = workoutRoutineDayName ?? workout.routineName ?? workout.session.date;
    const routine = await createRoutineFromWorkoutSession(
      workout.session.id,
      locale === 'ko' ? `${baseName}\uC5D0\uC11C \uB9CC\uB4E0 \uB8E8\uD2F4` : `${baseName} routine`,
    );
    setSaveMessage(
      routine
        ? (locale === 'ko' ? '\uC774 \uAE30\uB85D\uC744 \uD65C\uC131 \uB8E8\uD2F4\uC73C\uB85C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Saved this workout as the active routine')
        : (locale === 'ko' ? '\uB8E8\uD2F4\uC73C\uB85C \uC800\uC7A5\uD560 \uC6B4\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4' : 'No workout exercises to save as a routine'),
    );
    await loadWorkout();
  }

  async function handleSkipWorkout() {
    if (!workout) return;

    await skipWorkoutSession(workout.session.id);
    onSkipped();
  }

  async function handleAddSet(workoutExerciseId: string) {
    await addSetToWorkoutExercise(workoutExerciseId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC138\uD2B8\uB97C \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4' : 'Set added');

    setTimeout(() => {
      const inputs = document.querySelectorAll(`input[data-we-id="${workoutExerciseId}"]`) as NodeListOf<HTMLInputElement>;
      if (inputs.length >= 3) {
        const weightInput = inputs[inputs.length - 3];
        weightInput.focus();
        weightInput.select();
        weightInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  }

  async function handleAddWarmup(workoutExerciseId: string) {
    await addWarmupSetsToWorkoutExercise(workoutExerciseId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '웜업 세트를 생성했습니다' : 'Warmup sets generated');
  }

  async function handleDeleteSet(set: WorkoutSet) {
    if (shouldConfirmWorkoutSetDelete(set)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '\uAE30\uB85D\uAC12\uC774 \uC788\uB294 \uC138\uD2B8\uC785\uB2C8\uB2E4. \uC774 \uC138\uD2B8\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694?'
          : 'This set has logged values. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteWorkoutSet(set.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC138\uD2B8\uB97C \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4' : 'Set deleted');
  }

  async function handleDeleteExercise(log: WorkoutExerciseLog) {
    if (shouldConfirmWorkoutExerciseDelete(log)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '\uAE30\uB85D\uB41C \uC138\uD2B8\uB098 \uBA54\uBAA8\uAC00 \uC788\uB294 \uC6B4\uB3D9\uC785\uB2C8\uB2E4. \uC774 \uC6B4\uB3D9\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?'
          : 'This exercise has logged sets or notes. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteWorkoutExercise(log.workoutExercise.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC6B4\uB3D9\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4' : 'Exercise deleted');
  }

  async function handleMoveExercise(workoutExerciseId: string, direction: -1 | 1) {
    await moveWorkoutExercise(workoutExerciseId, direction);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC6B4\uB3D9 \uC21C\uC11C\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Exercise order saved');
  }

  async function handleMoveCardio(direction: -1 | 1) {
    if (!workout) return;

    await moveWorkoutCardioBlock(workout.session.id, direction);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD \uC21C\uC11C\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Running order saved');
  }

  async function handleReplaceExercise(workoutExerciseId: string, exerciseId: string) {
    await replaceWorkoutExercise(workoutExerciseId, exerciseId);
    setReplacingWorkoutExerciseId(undefined);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC6B4\uB3D9\uC744 \uAD50\uCCB4\uD588\uC2B5\uB2C8\uB2E4' : 'Exercise replaced');
  }

  async function handleAddCardio() {
    if (!workout) return;

    await addCardioRecordToWorkout(workout.session.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD\uC744 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4' : 'Running added');
  }

  async function handleUpdateCardio(
    cardioRecord: CardioRecord,
    values: Partial<Pick<CardioRecord, 'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo' | 'inclinePercent' | 'isDraft'>>,
  ) {
    await updateCardioRecord(cardioRecord.id, values);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Running saved');
  }

  function continueWorkoutAfterCardio() {
    const nextLog = logs.find((log) => !log.sets.every((set) => set.isCompleted)) ?? logs[0];

    if (nextLog) {
      setExpandedExercises((current) => expandWorkoutExercise(current, nextLog.workoutExercise.id));
      window.setTimeout(() => {
        document.getElementById(`exercise-card-${nextLog.workoutExercise.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
      return;
    }

    setIsAdding(true);
    resetExerciseFinderState();
    window.setTimeout(() => {
      document.getElementById('workout-exercise-finder')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }

  async function handleSaveCardioAndContinue(cardioRecord: CardioRecord) {
    if (workout?.session.entryKind === 'running') {
      if (cardioRecord.isDraft) {
        await handleUpdateCardio(cardioRecord, { isDraft: false });
        setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Running saved');
      }
      return;
    }

    if (cardioRecord.isDraft) {
      await handleUpdateCardio(cardioRecord, { isDraft: false });
      setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD\uC744 \uAE30\uB85D\uD588\uC2B5\uB2C8\uB2E4' : 'Running logged');
    }

    continueWorkoutAfterCardio();
  }

  async function handleUpdateSessionMemo(memo: string) {
    if (!workout) return;

    await updateWorkoutSessionMemo(workout.session.id, memo);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uBA54\uBAA8\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Memo saved');
  }

  async function handleUpdateExerciseMemo(workoutExerciseId: string, memo: string) {
    await updateWorkoutExerciseMemo(workoutExerciseId, memo);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC6B4\uB3D9 \uBA54\uBAA8\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Exercise memo saved');
  }

  async function handleUpdateExerciseRestSeconds(workoutExerciseId: string, restSeconds: number) {
    void workoutExerciseId;
    void restSeconds;
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uC6B4\uB3D9\uBCC4 \uD734\uC2DD \uC2DC\uAC04\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4' : 'Exercise rest time saved');
  }

  async function handleDeleteCardio(cardioRecord: CardioRecord) {
    if (shouldConfirmCardioDelete(cardioRecord)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '\uAE30\uB85D\uAC12\uC774 \uC788\uB294 \uB7EC\uB2DD \uD56D\uBAA9\uC785\uB2C8\uB2E4. \uC774 \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?'
          : 'This running record has logged values. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteCardioRecord(cardioRecord.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '\uB7EC\uB2DD\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4' : 'Running deleted');
  }

  const getAvailableExercises = (currentExerciseId?: string) => {
    const addedExerciseIds = new Set(
      logs
        .map((log) => log.exercise.id)
        .filter((exerciseId) => exerciseId !== currentExerciseId),
    );

    return exercises.filter((exercise) => !addedExerciseIds.has(exercise.id));
  };

  const availableExercises = getAvailableExercises();
  const exerciseFinderState: ExerciseFinderState = {
    query: exerciseSearch,
    category: exerciseCategoryFilter,
    stage: exerciseStageFilter,
  };
  const updateExerciseFinderState = (state: ExerciseFinderState) => {
    setExerciseSearch(state.query);
    setExerciseCategoryFilter(state.category);
    setExerciseStageFilter(state.stage);
  };
  const resetExerciseFinderState = () => updateExerciseFinderState(emptyExerciseFinderState);
  const totalSetCount = logs.reduce((sum, log) => sum + log.sets.length, 0);
  const completedSetCount = logs.reduce(
    (sum, log) => sum + log.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const workoutRoutineDayName = getRoutineDayDisplayName(workout?.routineDay, locale);
  const completedExerciseCount = countFullyCompletedExercises(logs);
  const loggedCardioCount = countLoggedCardioRecords(cardioRecords);
  const isIndependentRunningWorkout = workout?.session.entryKind === 'running';
  const isRunningOnlyWorkout = isIndependentRunningWorkout || (logs.length === 0 && cardioRecords.length > 0);
  const workoutTitle = isRunningOnlyWorkout
    ? (locale === 'ko' ? '\uB7EC\uB2DD' : 'Running')
    : workout?.session.entryKind === 'free'
      ? t(locale, 'freeWorkout')
      : routineNameLabel(locale, workout?.routineName) ?? t(locale, 'freeWorkout');
  const cardioOrder = cardioRecords.length > 0
    ? Math.min(...cardioRecords.map((record, index) => record.order ?? logs.length + index + 1))
    : undefined;
  const workoutDisplayItems = [
    ...logs.map((log) => ({
      kind: 'strength' as const,
      id: log.workoutExercise.id,
      order: log.workoutExercise.order,
      log,
    })),
    ...(cardioOrder !== undefined ? [{
      kind: 'cardio' as const,
      id: 'cardio',
      order: cardioOrder,
    }] : []),
  ].sort((a, b) => a.order - b.order);

  const liveSessionElapsed = workout
    ? getLiveSessionElapsedMs(workout.session, timerNow)
    : undefined;
  const sessionElapsed = liveSessionElapsed === undefined
    ? undefined
    : formatElapsed(liveSessionElapsed);

  const restElapsed = restTimerStartedAt ? formatElapsed(timerNow - restTimerStartedAt) : '--:--';
  const isHistoricalEditMode = mode === 'history-edit';
  const isCompletedEditMode = isHistoricalEditMode || workout?.session.status === 'completed' || workout?.session.status === 'skipped';
  const canCompleteWorkout = canCompleteWorkoutLog(completedSetCount, loggedCardioCount);
  const incompleteSetCount = Math.max(0, totalSetCount - completedSetCount);
  const finishSummary = getWorkoutFinishSummary(
    logs,
    cardioRecords,
    workout?.session.totalStrengthVolumeKg ?? 0,
    locale,
  );
  const completeHint = locale === 'ko'
    ? completedSetCount === 0 && loggedCardioCount === 0
      ? '\uC644\uB8CC\uD55C \uC138\uD2B8\uB098 \uB7EC\uB2DD \uAE30\uB85D\uC774 \uC788\uC5B4\uC57C \uC6B4\uB3D9\uC744 \uC644\uB8CC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
      : incompleteSetCount > 0
        ? `${incompleteSetCount}\uAC1C \uC138\uD2B8\uAC00 \uC544\uC9C1 \uBBF8\uC644\uB8CC\uC785\uB2C8\uB2E4. \uC644\uB8CC\uD574\uB3C4 \uAE30\uB85D\uC740 \uC800\uC7A5\uB429\uB2C8\uB2E4.`
        : '\uBAA8\uB4E0 \uC138\uD2B8\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
    : completedSetCount === 0 && loggedCardioCount === 0
      ? 'Complete at least one set or running record before finishing.'
      : incompleteSetCount > 0
        ? `${incompleteSetCount} sets are still open. You can finish anyway.`
        : 'All sets are complete.';
  const isFloatingRestTimerVisible = isRestTimerActive && restRemaining > 0 && !isKeyboardOpen;
  const scrollBottomPaddingClass = isKeyboardOpen
    ? 'pb-48'
    : isFloatingRestTimerVisible
      ? 'pb-64'
      : 'pb-36';

  return (
    <section className={`viewport-locked ios-screen mx-auto flex max-w-md select-none flex-col overflow-hidden px-3.5 text-[#1C1C1E] ${isKeyboardOpen ? 'py-2' : 'py-3'}`}>
      <WorkoutHeader
        locale={locale}
        isKeyboardOpen={isKeyboardOpen}
        isCompletedEditMode={isCompletedEditMode}
        workoutStatusLabel={workout ? workoutStatusLabel(locale, workout.session.status) : (locale === 'ko' ? '\uBD88\uB7EC\uC624\uB294 \uC911...' : 'Loading...')}
        workoutTitle={workoutTitle}
        sessionElapsed={sessionElapsed}
        workoutDate={workout?.session.date}
        isRestTimerActive={isRestTimerActive}
        restRemaining={restRemaining}
        restElapsed={restTimerStartedAt ? restElapsed : '--:--'}
        totalStrengthVolumeKg={workout?.session.totalStrengthVolumeKg}
        saveMessage={saveMessage}
        completedExerciseCount={completedExerciseCount}
        exerciseCount={logs.length}
        completedSetCount={completedSetCount}
        totalSetCount={totalSetCount}
        onBack={onBack}
        onRestartRestTimer={() => {
          setRestTimerStartedAt(Date.now());
          setRestRemaining(restDuration);
          setIsRestTimerActive(true);
        }}
        formatCountdownSeconds={formatCountdownSeconds}
      />

      {/* Exercise quick navigation is intentionally hidden for compactness. */}
      {false && logs.length > 0 && null}

      {/* Main scroll area */}
      <div className={`inner-scroll -mx-2 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2 pt-2.5 scrollbar-none ${scrollBottomPaddingClass}`}>

        {isCompletedEditMode ? (
          <section className="shrink-0 ios-card p-3 border-[#2EC4B6]/20 bg-[#2EC4B6]/5 shadow-sm animate-fade-in">
            <p className="text-sm font-bold text-[#159A91] flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2EC4B6] animate-pulse"></span>
              {locale === 'ko' ? '\uC644\uB8CC\uD55C \uC6B4\uB3D9 \uAE30\uB85D \uD3B8\uC9D1 \uC911' : 'Editing a finished workout'}
            </p>
            <p className="mt-1 text-xs font-bold text-[#159A91]">
              {locale === 'ko'
                ? isHistoricalEditMode
                  ? '\uC218\uC815 \uB0B4\uC6A9\uC740 \uC800\uC7A5 \uD6C4 \uD1B5\uACC4\uC640 \uB0B4\uBCF4\uB0B4\uAE30\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4.'
                  : '\uC138\uD2B8, \uC6B4\uB3D9, \uBA54\uBAA8 \uC218\uC815\uC740 \uD1B5\uACC4\uC640 \uB0B4\uBCF4\uB0B4\uAE30\uC5D0 \uBC14\uB85C \uBC18\uC601\uB429\uB2C8\uB2E4.'
                : isHistoricalEditMode
                  ? 'Your changes update stats and exports when saved.'
                  : 'Set, exercise, and memo edits update stats and exports immediately.'}
            </p>
          </section>
        ) : null}

        {isHistoricalEditMode && workout && !isIndependentRunningWorkout ? (
          <section className="shrink-0 ios-card p-3 space-y-2.5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{locale === 'ko' ? '\uC6B4\uB3D9 \uC720\uD615' : 'Workout type'}</p>
              <p className="mt-1 text-xs font-medium text-[#6E6E73]">
                {locale === 'ko' ? '\uAE30\uC874 \uC6B4\uB3D9\uACFC \uC138\uD2B8\uB294 \uC720\uC9C0\uD558\uACE0 \uC18C\uC18D\uB9CC \uBCC0\uACBD\uD569\uB2C8\uB2E4.' : 'Existing exercises and sets remain unchanged.'}
              </p>
            </div>
            <select
              aria-label="Historical workout routine"
              value={historyRoutineId}
              onChange={(event) => void handleHistoryRoutineChange(event.target.value)}
              className="min-h-10 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-bold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
            >
              <option value="">{t(locale, 'freeWorkout')}</option>
              {savedRoutines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              ))}
            </select>
            {historyRoutineId ? (
              <select
                aria-label="Historical workout routine day"
                value={historyRoutineDayId}
                onChange={(event) => setHistoryRoutineDayId(event.target.value)}
                className="min-h-10 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-bold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
              >
                {historyRoutineDays.map((day) => (
                  <option key={day.id} value={day.id}>{getRoutineDayDisplayName(day, locale) ?? day.name}</option>
                ))}
              </select>
            ) : null}
          </section>
        ) : null}

        {/* Session memo */}
        <section className="shrink-0 ios-card px-3 py-2.5">
          <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs font-bold text-[#1C1C1E]">
            <span className="shrink-0 rounded-md border border-violet-500/20 bg-[#5856D6]/10 px-2.5 py-1 text-[#5856D6] font-bold">
              {locale === 'ko' ? '\uC138\uC158 \uBA54\uBAA8' : 'Session Memo'}
            </span>
            <input
              aria-label="Session memo"
              type="text"
              defaultValue={workout?.session.memo ?? ''}
              onBlur={(event) => void handleUpdateSessionMemo(event.target.value)}
              className="h-8 min-w-0 rounded-md border border-[#D1D1D6] bg-white px-2.5 text-sm font-medium text-[#1C1C1E] outline-none transition-all placeholder:text-[#8E8E93] focus:border-[#2EC4B6]"
              placeholder={locale === 'ko' ? '\uCEE8\uB514\uC158, \uD2B9\uC774\uC0AC\uD56D, \uC624\uB298 \uBAA9\uD45C \uB4F1' : 'Energy, notes, today goals'}
            />
          </label>
        </section>

        {/* Empty state placeholder when there are no exercises and no running records */}
        {logs.length === 0 && cardioRecords.length === 0 ? (
          <section className="flex flex-col items-center justify-center p-6 text-center ios-card gap-4 my-auto shrink-0 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F3F3] text-accent-dark shadow-sm">
              <Dumbbell size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-[#1C1C1E]">
                {locale === 'ko' ? '오늘의 운동을 기록해보세요' : 'Build Your Workout Today'}
              </h3>
              <p className="text-xs font-bold text-[#6E6E73] max-w-[280px] leading-snug">
                {locale === 'ko'
                  ? '아직 추가된 운동이 없습니다. 아래 버튼이나 하단바를 사용하여 운동/러닝 기록을 추가하세요.'
                  : 'No exercises added yet. Use the buttons below or the footer to add exercise or running logs.'}
              </p>
            </div>
            <div className="flex gap-2.5 w-full max-w-[280px]">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  resetExerciseFinderState();
                }}
                className="flex-1 ios-button-secondary flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-extrabold"
              >
                <Plus size={14} />
                <span>{locale === 'ko' ? '운동 추가' : 'Add Exercise'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleAddCardio()}
                className="flex-1 ios-button-primary flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-extrabold"
              >
                <Plus size={14} />
                <span>{locale === 'ko' ? '러닝 추가' : 'Add Run'}</span>
              </button>
            </div>
          </section>
        ) : null}

        {/* Workout item cards */}
        <div className="flex flex-col gap-2.5">
          {workoutDisplayItems.map((item, displayIndex) => {
            if (item.kind === 'cardio') {
              return (
                <WorkoutCardioSection
                  key="cardio"
                  locale={locale}
                  cardioRecords={cardioRecords}
                  loggedCardioCount={loggedCardioCount}
                  totalCardioDistance={totalCardioDistance}
                  totalCardioMinutes={totalCardioMinutes}
                  isIndependentRunningWorkout={isIndependentRunningWorkout}
                  cardioLabel={t(locale, 'cardio')}
                  canMoveUp={displayIndex > 0}
                  canMoveDown={displayIndex < workoutDisplayItems.length - 1}
                  onMoveCardio={(direction) => void handleMoveCardio(direction)}
                  onAddCardio={() => void handleAddCardio()}
                  onUpdateCardio={(cardioRecord, values) => void handleUpdateCardio(cardioRecord, values)}
                  onDeleteCardio={(cardioRecord) => void handleDeleteCardio(cardioRecord)}
                  onSaveCardioAndContinue={(cardioRecord) => void handleSaveCardioAndContinue(cardioRecord)}
                />
              );
            }

            const log = item.log;
            return (
              <ExerciseLogCard
                key={log.workoutExercise.id}
                log={log}
                index={displayIndex}
                totalExerciseCount={workoutDisplayItems.length}
                locale={locale}
                isExpanded={!!expandedExercises[log.workoutExercise.id]}
                isKeyboardOpen={isKeyboardOpen}
                isMemoOpen={!!memoOpenExercises[log.workoutExercise.id]}
                isActionsOpen={!!actionOpenExercises[log.workoutExercise.id]}
                isReplacing={replacingWorkoutExerciseId === log.workoutExercise.id}
                exerciseFinderState={exerciseFinderState}
                replacementExercises={getAvailableExercises(log.exercise.id)}
                onToggleExpanded={(workoutExerciseId) => {
                  setExpandedExercises((prev) => ({
                    ...prev,
                    [workoutExerciseId]: !prev[workoutExerciseId],
                  }));
                }}
                onViewHistory={setSelectedHistoryExerciseId}
                onToggleActions={(workoutExerciseId) => {
                  setActionOpenExercises((current) => ({
                    ...current,
                    [workoutExerciseId]: !current[workoutExerciseId],
                  }));
                }}
                onMoveExercise={(workoutExerciseId, direction) => void handleMoveExercise(workoutExerciseId, direction)}
                onDeleteExercise={(exerciseLog) => void handleDeleteExercise(exerciseLog)}
                onToggleMemo={(workoutExerciseId) => {
                  setMemoOpenExercises((current) => ({
                    ...current,
                    [workoutExerciseId]: !current[workoutExerciseId],
                  }));
                }}
                onToggleReplace={(workoutExerciseId) => {
                  setReplacingWorkoutExerciseId((current) => (current === workoutExerciseId ? undefined : workoutExerciseId));
                  resetExerciseFinderState();
                }}
                onUpdateExerciseMemo={(workoutExerciseId, memo) => void handleUpdateExerciseMemo(workoutExerciseId, memo)}
                onExerciseFinderChange={updateExerciseFinderState}
                onReplaceExercise={(workoutExerciseId, exerciseId) => void handleReplaceExercise(workoutExerciseId, exerciseId)}
                onAddSet={(workoutExerciseId) => void handleAddSet(workoutExerciseId)}
                onAddWarmupSets={(workoutExerciseId) => void handleAddWarmup(workoutExerciseId)}
                handleQuickAdjustSet={handleQuickAdjustSet}
                handleSetChange={handleSetChange}
                handleToggleWarmup={handleToggleWarmup}
                handleToggleHardSet={handleToggleHardSet}
                handleCopyPreviousSet={handleCopyPreviousSet}
                handleDeleteSet={handleDeleteSet}
              />
            );
          })}
        </div>
        {cardioRecords.length === 0 ? (
          <WorkoutCardioSection
            locale={locale}
            cardioRecords={cardioRecords}
            loggedCardioCount={loggedCardioCount}
            totalCardioDistance={totalCardioDistance}
            totalCardioMinutes={totalCardioMinutes}
            isIndependentRunningWorkout={isIndependentRunningWorkout}
            cardioLabel={t(locale, 'cardio')}
            onAddCardio={() => void handleAddCardio()}
            onUpdateCardio={(cardioRecord, values) => void handleUpdateCardio(cardioRecord, values)}
            onDeleteCardio={(cardioRecord) => void handleDeleteCardio(cardioRecord)}
            onSaveCardioAndContinue={(cardioRecord) => void handleSaveCardioAndContinue(cardioRecord)}
          />
        ) : null}
      </div>

      <WorkoutFooterActions
        locale={locale}
        isHistoricalEditMode={isHistoricalEditMode}
        isCompletedEditMode={isCompletedEditMode}
        isKeyboardOpen={isKeyboardOpen}
        isAdding={isAdding}
        canCompleteWorkout={canCompleteWorkout}
        hasWorkout={Boolean(workout)}
        finishSummary={finishSummary}
        completeHint={completeHint}
        saveLabel={t(locale, 'save')}
        isRunningOnlyWorkout={isRunningOnlyWorkout}
        isRestTimerVisible={isFloatingRestTimerVisible}
        onToggleAddExercise={() => {
          setIsAdding((current) => !current);
          resetExerciseFinderState();
        }}
        onAddCardio={() => void handleAddCardio()}
        onCreateRoutineFromWorkout={() => void handleCreateRoutineFromWorkout()}
        onCancelHistoricalEdit={() => void handleCancelHistoricalEdit()}
        onSaveHistoricalEdit={() => void handleSaveHistoricalEdit()}
        onDoneEditing={onBack}
        onCompleteWorkout={() => void handleCompleteWorkout()}
        onSkipWorkout={() => void handleSkipWorkout()}
      />

      {isAdding ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-16 backdrop-blur-[2px]">
          <section
            id="workout-exercise-finder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-exercise-finder-title"
            className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[#D1D1D6] bg-white shadow-2xl animate-fade-in"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[#E5E5EA] px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">
                  {locale === 'ko' ? '운동 추가' : 'Add exercise'}
                </p>
                <h2 id="workout-exercise-finder-title" className="text-base font-black text-[#1C1C1E]">
                  {t(locale, 'exerciseFinder')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#8E8E93] transition-all hover:bg-[#F2F2F7] active:scale-95"
                aria-label={locale === 'ko' ? '운동 검색 닫기' : 'Close exercise search'}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              <ExerciseFinder
                ariaLabel="Search exercises to add"
                exercises={availableExercises}
                locale={locale}
                state={exerciseFinderState}
                onChange={updateExerciseFinderState}
                onSelect={(exercise) => void handleAddExercise(exercise.id)}
                limit={24}
              />
            </div>
          </section>
        </div>
      ) : null}

      {isFloatingRestTimerVisible ? (
        <FloatingRestTimer
          label={t(locale, 'resting')}
          skipLabel={t(locale, 'skip')}
          remainingSeconds={restRemaining}
          durationSeconds={restDuration}
          formatCountdownSeconds={formatCountdownSeconds}
          notifySupported={isNotificationSupported()}
          notifyEnabled={restNotifyEnabled}
          notifyLabel={t(locale, restNotifyEnabled ? 'restNotifyOn' : 'restNotifyOff')}
          onToggleNotify={() => void handleToggleRestNotify()}
          onIncreaseDuration={() => {
            setRestDuration((prev) => prev + 30);
          }}
          onDecreaseDuration={() => {
            setRestDuration((prev) => Math.max(1, prev - 30));
          }}
          onSkip={() => {
            setIsRestTimerActive(false);
            setRestRemaining(0);
          }}
        />
      ) : null}
      {selectedHistoryExerciseId ? (
        <ExerciseHistoryModal
          exerciseId={selectedHistoryExerciseId}
          locale={locale}
          onClose={() => setSelectedHistoryExerciseId(undefined)}
        />
      ) : null}
    </section>
  );
}

