import { ArrowDown, ArrowUp, BarChart3, Check, ChevronLeft, ClipboardList, Clock3, Copy, History, Plus, RefreshCw, Trash2, Trophy } from 'lucide-react';
import { useEffect, useRef, useState, useMemo, type FocusEvent } from 'react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { ExerciseHistoryModal } from '../components/ExerciseHistoryModal';
import { db } from '../db/db';
import { createRoutineFromWorkoutSession, getAllRoutines, getRoutineDayDisplayName, getRoutineDays } from '../db/routines';
import { getExerciseIcon } from '../utils/exerciseIcon';
import { formatDateKey } from '../utils/date';
import {
  getExerciseCategories,
  getExerciseName,
} from '../domain/exercises';
import { exerciseCountLabel, getStoredLocale, routineNameLabel, t, timeBandLabel, workoutStatusLabel } from '../i18n/i18n';
import {
  addExerciseToWorkout,
  addCardioRecordToWorkout,
  addSetToWorkoutExercise,
  completeWorkoutSession,
  deleteCardioRecord,
  deleteWorkoutExercise,
  deleteWorkoutSet,
  getWorkoutCardioRecords,
  getWorkoutBySessionId,
  getTodayWorkout,
  getWorkoutExerciseLogs,
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

function getWorkoutFinishSummary(
  logs: WorkoutExerciseLog[],
  cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>,
  totalVolumeKg: number,
  locale: 'ko' | 'en',
): string {
  const completedSets = logs.flatMap((log) => log.sets).filter((set) => set.isCompleted);
  const hardSets = completedSets.filter((set) => !set.isWarmup && set.rir !== undefined && set.rir <= 3).length;
  const completedExercises = countFullyCompletedExercises(logs);
  const cardioCount = countLoggedCardioRecords(cardioRecords);

  if (locale === 'ko') {
    return `${completedExercises}\uAC1C \uC6B4\uB3D9 / ${completedSets.length}\uC138\uD2B8 / Hard ${hardSets}\uC138\uD2B8 / ${totalVolumeKg.toLocaleString()}kg${cardioCount ? ` / \uB7EC\uB2DD ${cardioCount}\uAC74` : ''}`;
  }

  return `${completedExercises} exercises / ${completedSets.length} sets / ${hardSets} hard / ${totalVolumeKg.toLocaleString()}kg${cardioCount ? ` / ${cardioCount} cardio` : ''}`;
}

export function shouldConfirmCardioDelete(
  cardioRecord: Pick<CardioRecord, 'distanceKm' | 'inclinePercent' | 'location' | 'memo'>,
): boolean {
  return (cardioRecord.distanceKm ?? 0) > 0
    || (cardioRecord.inclinePercent ?? 0) > 0
    || Boolean(cardioRecord.location?.trim())
    || Boolean(cardioRecord.memo?.trim());
}

export function parseOptionalDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [memoOpenExercises, setMemoOpenExercises] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    const baselineHeight = window.innerHeight;
    const updateKeyboardState = () => {
      const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
      setIsKeyboardOpen(baselineHeight - visibleHeight > 140);
    };

    updateKeyboardState();
    window.visualViewport?.addEventListener('resize', updateKeyboardState);
    window.visualViewport?.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardState);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
    };
  }, []);

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
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      }, 500);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRestTimerActive, restTimerStartedAt, restDuration]);

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
    values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'type'>>,
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
        window.setTimeout(() => {
          const inputEl = document.getElementById(nextFocusTarget.inputId) as HTMLInputElement | null;
          inputEl?.focus();
          inputEl?.select();
          inputEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
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
      isCompleted: nextWarmup ? true : set.isCompleted,
    });
  }

  async function handleToggleHardSet(set: WorkoutSet) {
    const isHardSet = !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3;
    await handleSetChange(set, {
      isWarmup: false,
      type: 'normal',
      isCompleted: true,
      rir: isHardSet ? 4 : Math.min(set.rir ?? 3, 3),
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

  function updateCardioMinutes(cardioRecord: CardioRecord, minutes: number) {
    const startedAt = new Date(cardioRecord.startedAt);
    return new Date(startedAt.getTime() + Math.max(1, minutes) * 60 * 1000).toISOString();
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

  return (
    <section className={`viewport-locked ios-screen mx-auto flex max-w-md select-none flex-col overflow-hidden px-3.5 text-[#1C1C1E] ${isKeyboardOpen ? 'py-2' : 'py-3'}`}>
      {/* Fixed header */}
      <header className={`shrink-0 flex flex-col border-b border-[#D1D1D6] ${isKeyboardOpen ? 'gap-1 pb-1.5' : 'gap-1.5 pb-2.5'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#D1D1D6] bg-white text-[#1C1C1E] shadow-sm transition-all hover:bg-[#F2F2F7] active:scale-95"
              aria-label="Back to Today"
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase leading-none text-accent-dark">
                {workout ? workoutStatusLabel(locale, workout.session.status) : (locale === 'ko' ? '\uBD88\uB7EC\uC624\uB294 \uC911...' : 'Loading...')}
              </p>
              <h1 className={`${isKeyboardOpen ? 'max-w-[132px] text-base' : 'mt-0.5 max-w-[150px] text-lg'} truncate font-extrabold leading-tight text-[#1C1C1E] md:max-w-[210px]`}>
                {workoutTitle}
              </h1>
            </div>
          </div>

          {/* Compact live dashboard */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isCompletedEditMode && sessionElapsed ? (
                <div className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm">
                <Clock3 size={13} className="text-[#6E6E73]" />
                <span className="font-mono tracking-wide">{sessionElapsed}</span>
              </div>
            ) : workout && !isCompletedEditMode ? (
                <div className="rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm">
                <span className="font-mono">{workout.session.date}</span>
              </div>
            ) : null}
            {isRestTimerActive && restRemaining > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setRestTimerStartedAt(Date.now());
                  setRestRemaining(restDuration);
                  setIsRestTimerActive(true);
                }}
                className="flex items-center gap-1 rounded-full bg-yellow-200 px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm animate-pulse"
              >
                <span>Rest</span>
                <span className="font-mono tracking-wide">{formatCountdownSeconds(restRemaining)}</span>
              </button>
            ) : restTimerStartedAt && !isCompletedEditMode ? (
              <button
                type="button"
                onClick={() => {
                  setRestTimerStartedAt(Date.now());
                  setRestRemaining(restDuration);
                  setIsRestTimerActive(true);
                }}
                className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E]"
              >
                <span>Rest</span>
                <span className="font-mono tracking-wide">{restElapsed}</span>
              </button>
            ) : null}
            {workout && (
              <div className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-accent-dark shadow-sm">
                <span className="font-mono">{workout.session.totalStrengthVolumeKg.toLocaleString()}kg</span>
              </div>
            )}
          </div>
        </div>

        {/* Session status bar */}
        <div className={`${isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0' : 'mt-0.5 max-h-8 opacity-100'} flex items-center justify-between gap-2 px-0.5 text-xs font-medium text-[#6E6E73] transition-all`}>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-dark animate-pulse"></span>
            <span className="font-semibold text-[#1C1C1E]">{saveMessage}</span>
          </div>
          <div className="font-bold text-[#1C1C1E]">
            {completedExerciseCount}/{logs.length} {locale === 'ko' ? '\uC6B4\uB3D9' : 'Ex'} / {completedSetCount}/{totalSetCount} {locale === 'ko' ? '\uC138\uD2B8 \uC644\uB8CC' : 'Sets'}
          </div>
        </div>
      </header>

      {/* Exercise quick navigation is intentionally hidden for compactness. */}
      {false && logs.length > 0 && null}

      {/* Main scroll area */}
      <div className="inner-scroll -mx-2 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2 py-2.5 scrollbar-none">

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

        {/* Exercise finder */}
        {isAdding && (
          <section id="workout-exercise-finder" className="shrink-0 ios-card p-3 shadow-md animate-fade-in">
            <ExerciseFinder
              ariaLabel="Search exercises to add"
              exercises={availableExercises}
              locale={locale}
              state={exerciseFinderState}
              onChange={updateExerciseFinderState}
              onSelect={(exercise) => void handleAddExercise(exercise.id)}
              limit={24}
              title={t(locale, 'exerciseFinder')}
            />
          </section>
        )}

        {/* Exercise cards */}
        <div className="flex flex-col gap-2.5">
          {logs.map((log, index) => {
            const isExpanded = !!expandedExercises[log.workoutExercise.id];
            const allCompleted = log.sets.length > 0 && log.sets.every((s) => s.isCompleted);
            const completedCount = log.sets.filter((s) => s.isCompleted).length;
            const totalCount = log.sets.length;
            const isMemoOpen = !!memoOpenExercises[log.workoutExercise.id];
            const hasExerciseMemo = Boolean(log.workoutExercise.memo?.trim());

            return (
              <section
                key={log.workoutExercise.id}
                id={`exercise-card-${log.workoutExercise.id}`}
                className="ios-card scroll-mt-3 overflow-hidden transition-all duration-300"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedExercises((prev) => ({
                      ...prev,
                      [log.workoutExercise.id]: !prev[log.workoutExercise.id],
                    }));
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#F2F2F7] active:bg-[#E5E5EA]"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F2F2F7] text-xl">
                      {getExerciseIcon(log.exercise.defaultEmoji)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-base font-extrabold leading-tight text-[#1C1C1E]">
                          {getExerciseName(log.exercise, locale)}
                        </h2>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHistoryExerciseId(log.exercise.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedHistoryExerciseId(log.exercise.id);
                            }
                          }}
                          className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-[#F2F2F7] text-accent-dark active:scale-90 transition-all cursor-pointer"
                          aria-label={locale === 'ko' ? '\uC6B4\uB3D9 \uD788\uC2A4\uD1A0\uB9AC \uBCF4\uAE30' : 'View exercise history'}
                        >
                          <History aria-hidden="true" size={11} />
                        </div>
                        {allCompleted && (
                            <span className="shrink-0 rounded-full bg-[#E8F3F3] px-2 py-0.5 text-[11px] font-black text-accent-dark">
                            {locale === 'ko' ? '\uC644\uB8CC' : 'Done'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-accent-dark">
                        {completedCount} / {totalCount} Sets
                        {log.workoutExercise.totalVolumeKg > 0 && (
                          <span className="text-[#8E8E93] font-semibold font-mono"> ? {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold uppercase text-[#6E6E73]">
                      {isExpanded ? (locale === 'ko' ? '\uC811\uAE30' : 'Hide') : (locale === 'ko' ? '\uC5F4\uAE30' : 'Show')}
                    </span>
                    <svg
                      className={`h-4 w-4 text-[#8E8E93] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-accent-dark' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Accordion body */}
                {isExpanded && (
                  <div className={`border-t border-[#E5E5EA] bg-white px-3 ${isKeyboardOpen ? 'pb-2 pt-1.5' : 'pb-3 pt-2'}`}>
                    {/* Exercise actions */}
                    <div className={`flex items-center justify-between gap-3 transition-all ${isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0' : 'max-h-10 opacity-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleMoveExercise(log.workoutExercise.id, -1)}
                          disabled={index === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all duration-200 hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                          aria-label={`Move ${log.exercise.nameKo} up`}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMoveExercise(log.workoutExercise.id, 1)}
                          disabled={index === logs.length - 1}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all duration-200 hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                          aria-label={`Move ${log.exercise.nameKo} down`}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteExercise(log)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFECEC] text-danger transition-all duration-200 active:scale-95"
                          aria-label={`Delete ${log.exercise.nameKo}`}
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setMemoOpenExercises((current) => ({
                              ...current,
                              [log.workoutExercise.id]: !current[log.workoutExercise.id],
                            }));
                          }}
                          className={`flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 duration-200 ${
                            isMemoOpen || hasExerciseMemo
                              ? 'border-transparent bg-[#E8F3F3] text-accent-dark'
                              : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                          }`}
                        >
                          <ClipboardList aria-hidden="true" size={13} />
                          <span>{locale === 'ko' ? '\uBA54\uBAA8' : 'Memo'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingWorkoutExerciseId((current) => (
                              current === log.workoutExercise.id ? undefined : log.workoutExercise.id
                            ));
                            resetExerciseFinderState();
                          }}
                          className={`flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 duration-200 ${
                            replacingWorkoutExerciseId === log.workoutExercise.id
                              ? 'border-transparent bg-[#F2F2F7] text-[#6E6E73]'
                              : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                          }`}
                        >
                          <RefreshCw aria-hidden="true" size={12} className={replacingWorkoutExerciseId === log.workoutExercise.id ? 'animate-spin' : ''} />
                          <span>{locale === 'ko' ? '\uAD50\uCCB4' : 'Replace'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryExerciseId(log.exercise.id)}
                          className="flex min-h-9 items-center gap-1.5 rounded-xl bg-[#E8F3F3] px-3 text-xs font-bold text-accent-dark transition-all hover:bg-[#D8EFEF] active:scale-95"
                        >
                          <BarChart3 aria-hidden="true" size={13} />
                          <span>{locale === 'ko' ? '\uAE30\uB85D' : 'History'}</span>
                        </button>
                      </div>
                    </div>

                    {isMemoOpen ? (
                      <label className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 text-xs font-black uppercase text-[#1C1C1E]">
                        <span className="flex min-h-8 min-w-12 items-center justify-center rounded-md border border-violet-300 bg-violet-100 px-2.5 text-violet-950 shadow-sm">
                          {locale === 'ko' ? '\uBA54\uBAA8' : 'Memo'}
                        </span>
                        <input
                          aria-label={`${log.exercise.nameKo} memo`}
                          type="text"
                          defaultValue={log.workoutExercise.memo ?? ''}
                          onBlur={(event) => void handleUpdateExerciseMemo(log.workoutExercise.id, event.target.value)}
                          className="h-8 min-w-0 rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] px-2 text-sm font-bold text-[#1C1C1E] outline-none transition-all placeholder:text-[#8E8E93] focus:border-accent focus:ring-1 focus:ring-accent"
                          placeholder={locale === 'ko' ? '\uADF8\uB9BD, \uC790\uC138, \uC138\uD305' : 'Grip, setup, cues'}
                        />
                      </label>
                    ) : null}

                    {/* Replacement exercise finder */}
                    {replacingWorkoutExerciseId === log.workoutExercise.id && (
                      <div className="mt-3 border-t border-[#E5E5EA] pt-3">
                        <ExerciseFinder
                          ariaLabel={`Search replacement for ${getExerciseName(log.exercise, locale)}`}
                          exercises={getAvailableExercises(log.exercise.id)}
                          locale={locale}
                          state={exerciseFinderState}
                          onChange={updateExerciseFinderState}
                          onSelect={(exercise) => void handleReplaceExercise(log.workoutExercise.id, exercise.id)}
                          limit={24}
                          title={locale === 'ko' ? '\uAD50\uCCB4 \uC6B4\uB3D9 \uCC3E\uAE30' : 'Find replacement'}
                        />
                      </div>
                    )}

                    {/* Set rows */}
                    <div className={`${isKeyboardOpen ? 'mt-1' : 'mt-2'} flex flex-col ${isKeyboardOpen ? 'gap-1' : 'gap-1.5'}`}>
                      {log.sets.map((set, setIndex) => (
                        <WorkoutSetRow
                          key={set.id}
                          set={set}
                          setIndex={setIndex}
                          log={log}
                          locale={locale}
                          compactInputMode={isKeyboardOpen}
                          handleQuickAdjustSet={handleQuickAdjustSet}
                          handleSetChange={handleSetChange}
                          handleToggleWarmup={handleToggleWarmup}
                          handleToggleHardSet={handleToggleHardSet}
                          handleCopyPreviousSet={handleCopyPreviousSet}
                          handleDeleteSet={handleDeleteSet}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleAddSet(log.workoutExercise.id)}
                      className="ios-button-secondary mt-2 flex min-h-9 w-full items-center justify-center gap-2 px-3 text-sm"
                    >
                      <Plus aria-hidden="true" size={15} />
                      <span>{locale === 'ko' ? '\uC138\uD2B8 \uCD94\uAC00' : 'Add Set'}</span>
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Running input area */}
        <section className="shrink-0 ios-card p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{t(locale, 'cardio')}</p>
              <h2 className="mt-0.5 text-base font-black text-[#1C1C1E]">
                {cardioRecords.length === 0 ? (locale === 'ko' ? '\uB7EC\uB2DD' : 'Optional Running') : `${cardioRecords.length} ${t(locale, 'cardio')}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleAddCardio()}
              className="ios-button-primary flex h-10 w-10 items-center justify-center shrink-0"
              aria-label="Add cardio"
            >
              <Plus aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {loggedCardioCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[#F2F2F7] border border-black/5 px-3.5 py-2.5 text-xs font-bold text-[#1C1C1E]">
                <span>{locale === 'ko' ? '\uC624\uB298 \uB7EC\uB2DD \uC694\uC57D' : 'Running Summary'}</span>
                <span className="font-mono">
                  {totalCardioDistance.toFixed(1)} km / {totalCardioMinutes} {locale === 'ko' ? '\uBD84' : 'min'}
                </span>
              </div>
            )}

            {cardioRecords.map((cardioRecord) => {
              const minutes = Math.max(
                1,
                Math.round((new Date(cardioRecord.endedAt).getTime() - new Date(cardioRecord.startedAt).getTime()) / 60000),
              );

              const machineLabels: Record<string, string> = {
                treadmill: locale === 'ko' ? '\uD2B8\uB808\uB4DC\uBC00' : 'Treadmill',
                indoor_bike: locale === 'ko' ? '\uC2E4\uB0B4 \uC790\uC804\uAC70' : 'Indoor Bike',
                stair_climber: locale === 'ko' ? '\uCC9C\uAD6D\uC758 \uACC4\uB2E8' : 'Stair Climber',
                elliptical: locale === 'ko' ? '\uC77C\uB9BD\uD2F0\uCEEC' : 'Elliptical',
              };
              const displayName = cardioRecord.environment === 'outdoor'
                ? (cardioRecord.location || (locale === 'ko' ? '\uC57C\uC678 \uB7EC\uB2DD/\uD2B8\uB799' : 'Outdoor Running'))
                : (machineLabels[cardioRecord.machineType || ''] || (locale === 'ko' ? '\uC2E4\uB0B4 \uB7EC\uB2DD' : 'Indoor Running'));

              return (
                <div key={cardioRecord.id} className="rounded-xl border border-black/5 bg-[#F2F2F7] p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {cardioRecord.environment === 'indoor' ? '\uC2E4\uB0B4' : '\uC57C\uC678'}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#1C1C1E]">
                          {displayName}
                        </p>
                        {cardioRecord.isDraft ? (
                          <span className="mt-0.5 inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-750">
                            {locale === 'ko' ? '\uC785\uB825 \uC911' : 'Draft'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCardio(cardioRecord)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 transition-all active:scale-95 duration-200"
                      aria-label="Delete cardio"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>

                  {/* Indoor/outdoor switch */}
                  <div className="mb-2.5 flex rounded-xl bg-white p-0.5 border border-black/5">
                    <button
                      type="button"
                      onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'indoor', machineType: 'treadmill' })}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 ${
                        cardioRecord.environment === 'indoor'
                          ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                          : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                      }`}
                    >
                      {locale === 'ko' ? '\uC2E4\uB0B4 \uB7EC\uB2DD' : 'Indoor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'outdoor', location: '' })}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 ${
                        cardioRecord.environment === 'outdoor'
                          ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                          : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                      }`}
                    >
                      {locale === 'ko' ? '\uC57C\uC678 \uB7EC\uB2DD' : 'Outdoor'}
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {/* Machine or place input */}
                    {cardioRecord.environment === 'indoor' ? (
                      <label className="text-xs font-bold uppercase text-[#6E6E73]">
                        {locale === 'ko' ? '\uAE30\uAD6C \uC120\uD0DD' : 'Machine Select'}
                        <select
                          aria-label="Cardio machine select"
                          value={cardioRecord.machineType || 'treadmill'}
                          onChange={(event) => void handleUpdateCardio(cardioRecord, {
                            machineType: event.target.value as CardioRecord['machineType'],
                          })}
                          className="mt-1 min-h-10 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                        >
                          <option value="treadmill">{locale === 'ko' ? '\uD2B8\uB808\uB4DC\uBC00' : 'Treadmill'}</option>
                          <option value="indoor_bike">{locale === 'ko' ? '\uC2E4\uB0B4 \uC790\uC804\uAC70' : 'Indoor Bike'}</option>
                          <option value="stair_climber">{locale === 'ko' ? '\uCC9C\uAD6D\uC758 \uACC4\uB2E8' : 'Stair Climber'}</option>
                          <option value="elliptical">{locale === 'ko' ? '\uC77C\uB9BD\uD2F0\uCEEC' : 'Elliptical'}</option>
                        </select>
                      </label>
                    ) : (
                      <label className="text-xs font-bold uppercase text-[#6E6E73]">
                        {locale === 'ko' ? '\uC7A5\uC18C \uC785\uB825' : 'Place'}
                        <input
                          aria-label="Cardio place input"
                          type="text"
                          defaultValue={cardioRecord.location ?? ''}
                          onBlur={(event) => void handleUpdateCardio(cardioRecord, { location: event.target.value.trim() })}
                          placeholder={locale === 'ko' ? '\uC608: \uB3D9\uB124 \uACF5\uC6D0, \uB7EC\uB2DD \uD2B8\uB799' : 'e.g. Park, track, river'}
                          className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                        />
                      </label>
                    )}

                    {/* Running metrics */}
                    <div className={`grid gap-2.5 ${cardioRecord.environment === 'indoor' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <label className="text-xs font-bold uppercase text-[#6E6E73]">
                        Km
                        <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Math.max(0, Number(((cardioRecord.distanceKm || 0) - 0.5).toFixed(1)));
                              void handleUpdateCardio(cardioRecord, { distanceKm: nextVal || undefined });
                            }}
                            className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                          >
                            -
                          </button>
                          <input
                            aria-label="Cardio distance"
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="done"
                            defaultValue={cardioRecord.distanceKm ?? ''}
                            onBlur={(event) => void handleUpdateCardio(cardioRecord, {
                              distanceKm: parseOptionalDecimalInput(event.target.value),
                            })}
                            placeholder="0.0"
                            className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Number(((cardioRecord.distanceKm || 0) + 0.5).toFixed(1));
                              void handleUpdateCardio(cardioRecord, { distanceKm: nextVal });
                            }}
                            className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                          >
                            +
                          </button>
                        </div>
                      </label>

                      <label className="text-xs font-bold uppercase text-[#6E6E73]">
                        {locale === 'ko' ? '\uBD84' : 'Min'}
                        <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Math.max(1, minutes - 5);
                              void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                            }}
                            className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                          >
                            -
                          </button>
                          <input
                            aria-label="Cardio minutes"
                            type="text"
                            inputMode="numeric"
                            enterKeyHint="done"
                            value={minutes}
                            onChange={(event) => {
                              const val = Math.max(1, Math.round(Number(event.target.value)) || 1);
                              void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, val) });
                            }}
                            placeholder="min"
                            className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = minutes + 5;
                              void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                            }}
                            className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                          >
                            +
                          </button>
                        </div>
                      </label>

                      {cardioRecord.environment === 'indoor' && (
                        <label className="text-xs font-bold uppercase text-[#6E6E73]">
                          {locale === 'ko' ? '\uACBD\uC0AC (%)' : 'Inc (%)'}
                          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.max(0, (cardioRecord.inclinePercent || 0) - 1);
                                void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                              }}
                              className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                            >
                              -
                            </button>
                            <input
                              aria-label="Cardio incline"
                              type="text"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={cardioRecord.inclinePercent ?? ''}
                              onChange={(event) => {
                                const val = event.target.value === '' ? undefined : Number(event.target.value) || 0;
                                void handleUpdateCardio(cardioRecord, { inclinePercent: val });
                              }}
                              placeholder="%"
                              className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = (cardioRecord.inclinePercent || 0) + 1;
                                void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                              }}
                              className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                            >
                              +
                            </button>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  <label className="mt-2.5 block text-xs font-bold uppercase text-[#6E6E73]">
                    {locale === 'ko' ? '\uBA54\uBAA8' : 'Memo'}
                    <input
                      aria-label="Cardio memo"
                      type="text"
                      defaultValue={cardioRecord.memo ?? ''}
                      onBlur={(event) => void handleUpdateCardio(cardioRecord, { memo: event.target.value.trim() || undefined })}
                      placeholder={locale === 'ko' ? '\uC18D\uB3C4 \uBCC0\uD654, \uCEE8\uB514\uC158 \uD53C\uB4DC\uBC31' : 'e.g. Speed changes, energy feedback'}
                      className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleSaveCardioAndContinue(cardioRecord)}
                    className="ios-button-primary flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm mt-2.5"
                  >
                    <Check aria-hidden="true" size={15} />
                    <span>
                      {cardioRecord.isDraft
                        ? isIndependentRunningWorkout
                          ? locale === 'ko' ? '\uB7EC\uB2DD \uC800\uC7A5' : 'Save running'
                          : locale === 'ko' ? '\uAE30\uB85D\uD558\uACE0 \uC6B4\uB3D9 \uACC4\uC18D' : 'Log cardio and continue'
                        : isIndependentRunningWorkout
                          ? locale === 'ko' ? '\uB7EC\uB2DD \uC800\uC7A5\uB428' : 'Running saved'
                          : locale === 'ko' ? '\uC6B4\uB3D9 \uAE30\uB85D \uACC4\uC18D' : 'Continue workout log'}
                    </span>
                  </button>

                  {cardioRecord.averageSpeedKmh ? (
                    <p className="mt-3 text-xs font-bold text-[#159A91] bg-[#E8F3F3] border border-[#2EC4B6]/20 rounded-lg px-2.5 py-1.5 inline-block">
                      {locale === 'ko' ? '\uD3C9\uADE0 \uC18D\uB3C4' : 'Average speed'}: <span className="font-mono">{cardioRecord.averageSpeedKmh.toFixed(1)} km/h</span>
                    </p>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-[#6E6E73]">
                      {locale === 'ko' ? '\uAC70\uB9AC\uB97C \uC785\uB825\uD558\uBA74 \uD3C9\uADE0 \uC18D\uB3C4\uAC00 \uACC4\uC0B0\uB429\uB2C8\uB2E4.' : 'Enter distance to calculate average speed.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Fixed footer actions */}
      <footer className="mt-auto flex shrink-0 flex-col gap-2 border-t border-[#D1D1D6] bg-[#F2F2F7] pb-1 pt-2.5">
        {isHistoricalEditMode ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding((current) => !current);
                  resetExerciseFinderState();
                }}
                className="ios-button-secondary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
              >
                <Plus aria-hidden="true" size={16} />
                {locale === 'ko' ? '\uC6B4\uB3D9 \uCD94\uAC00' : 'Add exercise'}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateRoutineFromWorkout()}
                className="ios-button-primary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
              >
                <ClipboardList aria-hidden="true" size={15} />
                {locale === 'ko' ? '\uB8E8\uD2F4 \uC800\uC7A5' : 'Save routine'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCancelHistoricalEdit()}
                className="ios-button-secondary flex min-h-12 items-center justify-center px-4 text-sm"
              >
                {locale === 'ko' ? '\uCDE8\uC18C' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveHistoricalEdit()}
                className="ios-button-primary flex min-h-12 items-center justify-center px-4 text-sm"
              >
                {t(locale, 'save')}
              </button>
            </div>
          </>
        ) : isCompletedEditMode ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleCreateRoutineFromWorkout()}
              className="ios-button-secondary flex min-h-12 items-center justify-center gap-1.5 px-3 text-xs"
            >
              <ClipboardList aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '\uB8E8\uD2F4 \uC800\uC7A5' : 'Save routine'}</span>
            </button>
            <button type="button" onClick={onBack} className="ios-button-primary flex min-h-12 items-center justify-center px-4 text-sm">
              {locale === 'ko' ? '\uD3B8\uC9D1 \uC644\uB8CC' : 'Done Editing'}
            </button>
          </div>
        ) : (
          <div className={isKeyboardOpen ? 'space-y-0' : 'space-y-1.5'}>
            <div className={`rounded-2xl px-3 transition-all ${
              isKeyboardOpen
                ? 'max-h-0 overflow-hidden py-0 opacity-0'
                : 'py-2 opacity-100'
            } ${
              canCompleteWorkout
                ? 'bg-white'
                : 'bg-[#FFF6DF]'
            }`}>
              <p className={`text-[11px] font-black uppercase ${canCompleteWorkout ? 'text-accent-dark' : 'text-[#1C1C1E]'}`}>
                {locale === 'ko' ? '\uC644\uB8CC \uC804 \uC694\uC57D' : 'Finish summary'}
              </p>
              <p className="mt-0.5 text-xs font-black leading-snug text-[#1C1C1E]">{finishSummary}</p>
              <p className={`mt-1 text-[11px] font-bold leading-snug ${canCompleteWorkout ? 'text-muted' : 'text-danger'}`}>
                {completeHint}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding((current) => !current);
                  resetExerciseFinderState();
                }}
                className={`flex ${isKeyboardOpen ? 'h-10 px-3' : 'h-12 px-3.5'} items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 shrink-0 border ${
                  isAdding
                    ? 'border-transparent bg-[#E5E5EA] text-[#1C1C1E]'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
              >
                <Plus size={16} className={`transition-transform duration-300 ${isAdding ? 'rotate-45' : ''}`} />
                <span>{locale === 'ko' ? '\uC6B4\uB3D9 \uCD94\uAC00' : 'Add'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCompleteWorkout()}
                disabled={!workout || !canCompleteWorkout}
                className={`ios-button-primary flex ${isKeyboardOpen ? 'min-h-10' : 'min-h-12'} flex-1 items-center justify-center gap-1.5 px-4 text-sm disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] disabled:shadow-none`}
              >
                <Check aria-hidden="true" size={16} />
                <span>{locale === 'ko' ? '\uC6B4\uB3D9 \uC644\uB8CC' : 'Complete'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSkipWorkout()}
                disabled={!workout}
                className={`flex ${isKeyboardOpen ? 'h-10' : 'h-12'} shrink-0 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-extrabold text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95`}
              >
                {locale === 'ko' ? '\uD328\uC2A4' : 'Skip'}
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* Floating rest timer */}
      {isRestTimerActive && restRemaining > 0 && !isKeyboardOpen && (
        <div className="fixed bottom-[4.5rem] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-yellow-400 bg-yellow-200/95 px-3.5 py-3 shadow-2xl shadow-yellow-500/20 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 text-yellow-950 animate-pulse">
                <Clock3 size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-yellow-950">{t(locale, 'resting')}</p>
                <p className="text-lg font-black text-yellow-950 tracking-wider font-mono">
                  {formatCountdownSeconds(restRemaining)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRestDuration((prev) => prev + 30);
                }}
                className="flex h-8 items-center justify-center rounded-lg border border-yellow-500 bg-yellow-50 px-2.5 text-xs font-bold text-yellow-950 transition-all active:scale-95 active:bg-yellow-300"
              >
                +30s
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestDuration((prev) => Math.max(1, prev - 30));
                }}
                className="flex h-8 items-center justify-center rounded-lg border border-yellow-500 bg-yellow-50 px-2.5 text-xs font-bold text-yellow-950 transition-all active:scale-95 active:bg-yellow-300"
              >
                -30s
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRestTimerActive(false);
                  setRestRemaining(0);
                }}
                className="flex h-8 items-center justify-center rounded-lg border border-danger/45 bg-danger/15 px-2.5 text-xs font-black text-danger transition-all hover:bg-danger/25 active:scale-95"
              >
                {t(locale, 'skip')}
              </button>
            </div>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-yellow-100">
            <div
              className="h-full bg-yellow-600 transition-all duration-500 ease-out"
              style={{ width: `${(restRemaining / restDuration) * 100}%` }}
            />
          </div>
        </div>
      )}
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

type WorkoutSetRowProps = {
  set: WorkoutSet;
  setIndex: number;
  log: WorkoutExerciseLog;
  locale: 'ko' | 'en';
  compactInputMode?: boolean;
  handleQuickAdjustSet: (set: WorkoutSet, field: 'weightKg' | 'reps' | 'rir', delta: number) => Promise<void>;
  handleSetChange: (
    set: WorkoutSet,
    values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'type'>>,
  ) => Promise<void>;
  handleToggleWarmup: (set: WorkoutSet) => Promise<void>;
  handleToggleHardSet: (set: WorkoutSet) => Promise<void>;
  handleCopyPreviousSet: (set: WorkoutSet, previousSet: WorkoutSet | undefined) => Promise<void>;
  handleDeleteSet: (set: WorkoutSet) => Promise<void>;
};

function WorkoutSetRow({
  set,
  setIndex,
  log,
  locale,
  compactInputMode = false,
  handleQuickAdjustSet,
  handleSetChange,
  handleToggleWarmup,
  handleToggleHardSet,
  handleCopyPreviousSet,
  handleDeleteSet,
}: WorkoutSetRowProps) {
  const [weight, setWeight] = useState(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '');
  const [rir, setRir] = useState(set.rir !== undefined ? String(set.rir) : '');
  const [weightStep, setWeightStep] = useState(2.5);
  const progressBadges = getWorkoutSetProgressBadges(set, log.pastBestWeight, log.pastBestVolume);

  useEffect(() => {
    setWeight(set.weightKg ? String(set.weightKg) : '');
  }, [set.weightKg]);

  useEffect(() => {
    setReps(set.reps ? String(set.reps) : '');
  }, [set.reps]);

  useEffect(() => {
    setRir(set.rir !== undefined ? String(set.rir) : '');
  }, [set.rir]);

  const currentType = set.type || (set.isWarmup ? 'warmup' : 'normal');

  const previousSet = useMemo(() => {
    const currentSets = log.sets;
    const previousSets = log.previousSets;

    if (!previousSets || previousSets.length === 0) return undefined;

    const sameTypeSetsInCurrent = currentSets.filter(
      (s) => (s.type || (s.isWarmup ? 'warmup' : 'normal')) === currentType
    );
    const relativeIndex = sameTypeSetsInCurrent.indexOf(set);

    if (relativeIndex === -1) {
      return previousSets[setIndex];
    }

    const sameTypeSetsInPrevious = previousSets.filter(
      (s) => (s.type || (s.isWarmup ? 'warmup' : 'normal')) === currentType
    );

    if (sameTypeSetsInPrevious[relativeIndex]) {
      return sameTypeSetsInPrevious[relativeIndex];
    }

    return previousSets[setIndex];
  }, [set, log.sets, log.previousSets, setIndex, currentType]);
  const enteredWeight = parseOptionalDecimalInput(weight) ?? set.weightKg ?? 0;
  const displayBestWeight = Math.max(log.pastBestWeight ?? 0, enteredWeight, previousSet?.weightKg ?? 0);
  const handleSetInputFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
    window.setTimeout(() => {
      event.currentTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
  };

  const handleToggleSetType = async () => {
    const NEXT_TYPES: Record<WorkoutSetType, WorkoutSetType> = {
      normal: 'warmup',
      warmup: 'drop',
      drop: 'failure',
      failure: 'normal',
    };
    const nextType = NEXT_TYPES[currentType] || 'normal';
    const isWarmup = nextType === 'warmup';

    await handleSetChange(set, {
      type: nextType,
      isWarmup,
    });
  };

  const typeBadges: Record<WorkoutSetType, { labelKo: string; labelEn: string; className: string }> = {
    normal: {
      labelKo: '일반',
      labelEn: 'Normal',
      className: 'bg-[#F2F2F7] text-[#6E6E73] border-transparent hover:bg-[#E5E5EA]'
    },
    warmup: {
      labelKo: '준비',
      labelEn: 'Warmup',
      className: 'bg-yellow-100 text-yellow-800 border-transparent hover:bg-yellow-200'
    },
    drop: {
      labelKo: '드롭',
      labelEn: 'Drop',
      className: 'bg-[#E8F3F3] text-accent-dark border-transparent hover:bg-[#D8EFEF]'
    },
    failure: {
      labelKo: '실패',
      labelEn: 'Failure',
      className: 'bg-[#FFECEC] text-danger border-transparent hover:bg-[#FFDADA]'
    }
  };

  return (
    <div className={`rounded-xl border border-[#E5E5EA] bg-white px-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] ${compactInputMode ? 'py-1' : 'py-1.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-black transition-all hover:brightness-110 active:scale-95 ${typeBadges[currentType].className}`}
          aria-label={`Toggle type for Set ${set.setNo}, current: ${currentType}`}
        >
          <span>{locale === 'ko' ? '세트' : 'Set'} {set.setNo}</span>
          <span className="opacity-90 tracking-wide uppercase">
            {locale === 'ko' ? typeBadges[currentType].labelKo : typeBadges[currentType].labelEn}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded-md border border-[#D1D1D6] bg-[#F2F2F7]">
            {[1, 2.5].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setWeightStep(step)}
                className={`px-1.5 py-0.5 text-[11px] font-bold ${
                  weightStep === step ? 'bg-[#2EC4B6] text-white' : 'text-[#6E6E73]'
                }`}
                aria-label={`Set weight step to ${step}kg`}
              >
                {step}kg
              </button>
            ))}
          </div>
          {!set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3 ? (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-455 shadow-[0_0_8px_rgba(244,63,94,0.05)]">
              Hard
            </span>
          ) : null}
          {progressBadges.length > 0 ? (
            <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
              <Trophy aria-hidden="true" size={11} />
              {progressBadges.includes('weight-pr') && progressBadges.includes('volume-pr')
                ? 'PR'
                : progressBadges.includes('weight-pr')
                  ? (locale === 'ko' ? '중량 PR' : 'Weight PR')
                  : (locale === 'ko' ? '볼륨 PR' : 'Volume PR')}
            </span>
          ) : null}
        </div>
      </div>

      {previousSet && !compactInputMode ? (
        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          className="mt-1 flex min-h-6 w-full items-center gap-1 overflow-hidden rounded-lg bg-[#E8F3F3] px-2 py-0.5 text-left text-[11px] font-black text-[#1C1C1E] transition-all hover:bg-[#D8EFEF] active:scale-[0.99]"
        >
          <span className="shrink-0 font-black text-emerald-900">{locale === 'ko' ? '\uCD5C\uADFC:' : 'Recent:'}</span>
          <span className="min-w-0 truncate font-mono font-black text-emerald-950">
            {previousSet.weightKg}kg x {previousSet.reps}{previousSet.rir !== undefined ? ` / RIR ${previousSet.rir}` : ''}
          </span>
          {displayBestWeight > 0 ? (
            <span className="shrink-0 font-black text-emerald-950">
              {locale === 'ko' ? `\uCD5C\uACE0 ${displayBestWeight.toLocaleString()}kg` : `best ${displayBestWeight.toLocaleString()}kg`}
            </span>
          ) : null}
        </button>
      ) : null}

      <div className={`${compactInputMode ? 'mt-0.5' : 'mt-1'} grid grid-cols-3 gap-1`}>
        <label className="text-[11px] font-extrabold uppercase leading-none text-[#6E6E73]">
          kg
          <div className="mt-0.5 grid grid-cols-[1.35rem_1fr_1.35rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', -weightStep)}
              aria-label={`Decrease weight by ${weightStep}kg`}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-[#6E6E73] transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              -
            </button>
            <input
              id={`weight_input_${set.id}`}
              data-we-id={log.workoutExercise.id}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} weight`}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              tabIndex={setIndex * 3 + 1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={handleSetInputFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const currentTabIndex = Number(e.currentTarget.getAttribute('tabindex'));
                  const nextInput = document.querySelector(`[tabindex="${currentTabIndex + 1}"]`) as HTMLInputElement | null;
                  if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                  } else {
                    e.currentTarget.blur();
                  }
                }
              }}
              onBlur={() => {
                const num = Number(weight) || 0;
                if (num !== set.weightKg) {
                  void handleSetChange(set, { weightKg: num });
                }
              }}
              placeholder="kg"
              className="min-w-0 bg-transparent px-0.5 py-0 text-center text-base font-black leading-none text-[#1C1C1E] outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', weightStep)}
              aria-label={`Increase weight by ${weightStep}kg`}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-accent-dark transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              +
            </button>
          </div>
          {previousSet && previousSet.weightKg > 0 && (
            <span className="hidden truncate text-[11px] font-bold normal-case leading-none text-[#8E8E93]">
              {locale === 'ko' ? `최근: ${previousSet.weightKg}kg` : `Recent: ${previousSet.weightKg}kg`}
            </span>
          )}
        </label>

        <label className="text-[11px] font-extrabold uppercase leading-none text-[#6E6E73]">
          reps
          <div className="mt-0.5 grid grid-cols-[1.35rem_1fr_1.35rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', -1)}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-[#6E6E73] transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              -
            </button>
            <input
              id={`reps_input_${set.id}`}
              data-we-id={log.workoutExercise.id}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} reps`}
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              tabIndex={setIndex * 3 + 2}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onFocus={handleSetInputFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const currentTabIndex = Number(e.currentTarget.getAttribute('tabindex'));
                  const nextInput = document.querySelector(`[tabindex="${currentTabIndex + 1}"]`) as HTMLInputElement | null;
                  if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                  } else {
                    e.currentTarget.blur();
                  }
                }
              }}
              onBlur={() => {
                const num = Math.round(Number(reps)) || 0;
                if (num !== set.reps) {
                  void handleSetChange(set, { reps: num });
                }
              }}
              placeholder="reps"
              className="min-w-0 bg-transparent px-0.5 py-0 text-center text-base font-black leading-none text-[#1C1C1E] outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', 1)}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-accent-dark transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              +
            </button>
          </div>
          {previousSet && previousSet.reps > 0 && (
            <span className="hidden truncate text-[11px] font-bold normal-case leading-none text-[#8E8E93]">
              {locale === 'ko' ? `최근: ${previousSet.reps}회` : `Recent: ${previousSet.reps} reps`}
            </span>
          )}
        </label>

        <label className="text-[11px] font-extrabold uppercase leading-none text-[#6E6E73]">
          RIR
          <div className="mt-0.5 grid grid-cols-[1.35rem_1fr_1.35rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', -1)}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-[#6E6E73] transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              -
            </button>
            <input
              id={`rir_input_${set.id}`}
              data-we-id={log.workoutExercise.id}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} RIR`}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              tabIndex={setIndex * 3 + 3}
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              onFocus={handleSetInputFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const currentTabIndex = Number(e.currentTarget.getAttribute('tabindex'));
                  const nextInput = document.querySelector(`[tabindex="${currentTabIndex + 1}"]`) as HTMLInputElement | null;
                  if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                  } else {
                    e.currentTarget.blur();
                  }
                }
              }}
              onBlur={() => {
                const val = rir === '' ? undefined : Number(rir) || 0;
                if (val !== set.rir) {
                  void handleSetChange(set, { rir: val });
                }
              }}
              placeholder="RIR"
              className="min-w-0 bg-transparent px-0.5 py-0 text-center text-base font-black leading-none text-[#1C1C1E] outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', 1)}
              className={`${compactInputMode ? 'h-7' : 'h-8'} text-sm font-bold text-accent-dark transition-all active:scale-90 active:bg-[#E5E5EA]`}
            >
              +
            </button>
          </div>
          {previousSet && previousSet.rir !== undefined && (
            <span className="hidden truncate text-[11px] font-bold normal-case leading-none text-[#8E8E93]">
              {locale === 'ko' ? `최근: RIR ${previousSet.rir}` : `Recent: RIR ${previousSet.rir}`}
            </span>
          )}
        </label>
      </div>

      <div className={`${compactInputMode ? 'mt-0.5' : 'mt-1'} grid grid-cols-6 gap-1`}>
        <button
          type="button"
          onClick={() => void handleToggleWarmup(set)}
          className={`${compactInputMode ? 'min-h-7' : 'min-h-8'} rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
            set.isWarmup
              ? 'bg-yellow-100 text-yellow-800 font-extrabold'
              : 'border border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
          }`}
        >
          {locale === 'ko' ? '준비' : 'Warm'}
        </button>
        <button
          type="button"
          onClick={() => void handleToggleHardSet(set)}
          className={`${compactInputMode ? 'min-h-7' : 'min-h-8'} rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
            !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3
              ? 'bg-[#FF375F] text-white font-extrabold'
              : 'border border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
          }`}
        >
          Hard
        </button>
        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`col-span-2 ${compactInputMode ? 'min-h-7' : 'min-h-8'} rounded-lg text-xs font-black transition-all duration-300 active:scale-95 ${
            set.isCompleted
              ? 'bg-accent text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)]'
              : 'border border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
          }`}
        >
          {set.isCompleted ? (locale === 'ko' ? '완료됨' : 'Done') : (locale === 'ko' ? '완료' : 'Complete')}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          disabled={!previousSet}
          className={`flex ${compactInputMode ? 'min-h-7' : 'min-h-8'} items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95`}
          aria-label="Copy previous values"
          title="Copy previous workout set"
        >
          <Copy aria-hidden="true" size={13} />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteSet(set)}
          disabled={log.sets.length === 1}
          className={`flex ${compactInputMode ? 'min-h-7' : 'min-h-8'} items-center justify-center rounded-lg bg-[#FFECEC] text-danger transition-all disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95`}
          aria-label="Delete set"
        >
          <Trash2 aria-hidden="true" size={13} />
        </button>
      </div>
    </div>
  );
}
