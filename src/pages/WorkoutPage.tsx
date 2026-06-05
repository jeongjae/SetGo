import { ArrowDown, ArrowUp, Check, ChevronLeft, ClipboardList, Clock3, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { db } from '../db/db';
import { getAllRoutines, getRoutineDayDisplayName, getRoutineDays } from '../db/routines';
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
): boolean {
  return !set.isCompleted
    && (set.weightKg > 0 || set.reps > 0 || set.rir !== undefined);
}

export function countLoggedCardioRecords(cardioRecords: Array<Pick<CardioRecord, 'isDraft'>>): number {
  return cardioRecords.filter((cardioRecord) => cardioRecord.isDraft !== true).length;
}

export function countFullyCompletedExercises(
  logs: Array<{ sets: Array<Pick<WorkoutSet, 'isCompleted'>> }>,
): number {
  return logs.filter((log) => log.sets.length > 0 && log.sets.every((set) => set.isCompleted)).length;
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
  const [saveMessage, setSaveMessage] = useState(locale === 'ko' ? '로컬 저장됨' : 'Saved locally');
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<number | undefined>();
  const [restDuration, setRestDuration] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [savedRoutines, setSavedRoutines] = useState<Routine[]>([]);
  const [historyRoutineId, setHistoryRoutineId] = useState('');
  const [historyRoutineDayId, setHistoryRoutineDayId] = useState('');
  const [historyRoutineDays, setHistoryRoutineDays] = useState<RoutineDay[]>([]);
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

    const setsToComplete = logs.flatMap((log) => (
      log.sets.filter(shouldCompleteHistoricalSetOnSave)
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
    setSaveMessage(locale === 'ko' ? '저장 중...' : 'Saving...');
    await updateWorkoutSet(set.id, values);
    
    const wasCompleted = set.isCompleted;
    const isNowCompleted = values.isCompleted === true;

    if (isNowCompleted && !wasCompleted) {
      const now = Date.now();
      setRestTimerStartedAt(now);
      setRestRemaining(restDuration);
      setIsRestTimerActive(true);
    }
    
    await loadWorkout();
    setSaveMessage(`${locale === 'ko' ? '저장됨' : 'Saved'} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

    if (isNowCompleted && !wasCompleted) {
      autoTransitionAccordion(set.workoutExerciseId);
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
    setSaveMessage(locale === 'ko' ? '이전 운동 세트를 복사했습니다' : 'Previous workout set copied');
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
    setSaveMessage(locale === 'ko' ? '이전 운동 세트를 모두 복사했습니다' : 'All previous sets copied');
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

  async function handleSkipWorkout() {
    if (!workout) return;

    await skipWorkoutSession(workout.session.id);
    onSkipped();
  }

  async function handleAddSet(workoutExerciseId: string) {
    const log = logs.find((l) => l.workoutExercise.id === workoutExerciseId);
    const nextSetNo = log ? log.sets.length + 1 : 1;

    await addSetToWorkoutExercise(workoutExerciseId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '세트를 추가했습니다' : 'Set added');

    setTimeout(() => {
      const targetId = `weight_input_${workoutExerciseId}_set_${nextSetNo}`;
      const inputEl = document.getElementById(targetId) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }

  async function handleDeleteSet(set: WorkoutSet) {
    if (shouldConfirmWorkoutSetDelete(set)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '기록값이 있는 세트입니다. 이 세트를 삭제할까요?'
          : 'This set has logged values. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteWorkoutSet(set.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '세트를 삭제했습니다' : 'Set deleted');
  }

  async function handleDeleteExercise(log: WorkoutExerciseLog) {
    if (shouldConfirmWorkoutExerciseDelete(log)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '기록된 세트나 메모가 있는 운동입니다. 이 운동을 삭제할까요?'
          : 'This exercise has logged sets or notes. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteWorkoutExercise(log.workoutExercise.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '운동을 삭제했습니다' : 'Exercise deleted');
  }

  async function handleMoveExercise(workoutExerciseId: string, direction: -1 | 1) {
    await moveWorkoutExercise(workoutExerciseId, direction);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '운동 순서를 저장했습니다' : 'Exercise order saved');
  }

  async function handleReplaceExercise(workoutExerciseId: string, exerciseId: string) {
    await replaceWorkoutExercise(workoutExerciseId, exerciseId);
    setReplacingWorkoutExerciseId(undefined);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '운동을 교체했습니다' : 'Exercise replaced');
  }

  async function handleAddCardio() {
    if (!workout) return;

    await addCardioRecordToWorkout(workout.session.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '러닝을 추가했습니다' : 'Running added');
  }

  async function handleUpdateCardio(
    cardioRecord: CardioRecord,
    values: Partial<Pick<CardioRecord, 'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo' | 'inclinePercent' | 'isDraft'>>,
  ) {
    await updateCardioRecord(cardioRecord.id, values);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '러닝을 저장했습니다' : 'Running saved');
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
    if (cardioRecord.isDraft) {
      await handleUpdateCardio(cardioRecord, { isDraft: false });
      setSaveMessage(locale === 'ko' ? '러닝을 기록했습니다' : 'Running logged');
    }

    continueWorkoutAfterCardio();
  }

  async function handleUpdateSessionMemo(memo: string) {
    if (!workout) return;

    await updateWorkoutSessionMemo(workout.session.id, memo);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '메모를 저장했습니다' : 'Memo saved');
  }

  async function handleUpdateExerciseMemo(workoutExerciseId: string, memo: string) {
    await updateWorkoutExerciseMemo(workoutExerciseId, memo);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '운동 메모를 저장했습니다' : 'Exercise memo saved');
  }

  async function handleDeleteCardio(cardioRecord: CardioRecord) {
    if (shouldConfirmCardioDelete(cardioRecord)) {
      const shouldDelete = window.confirm(
        locale === 'ko'
          ? '기록값이 있는 러닝 항목입니다. 이 항목을 삭제할까요?'
          : 'This running record has logged values. Delete it?',
      );
      if (!shouldDelete) return;
    }

    await deleteCardioRecord(cardioRecord.id);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '러닝을 삭제했습니다' : 'Running deleted');
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
  const isRunningOnlyWorkout = logs.length === 0 && cardioRecords.length > 0;
  const workoutTitle = isRunningOnlyWorkout
    ? (locale === 'ko' ? '러닝' : 'Running')
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

  return (
    <section className="viewport-locked mx-auto flex max-w-md select-none flex-col overflow-hidden bg-background px-3.5 py-3 text-slate-100">
      {/* 1. 상단 고정 헤더 영역 (shrink-0) */}
      <header className="shrink-0 flex flex-col gap-1.5 border-b border-slate-650 pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 shadow-md transition-all hover:bg-slate-650 active:scale-95"
              aria-label="Back to Today"
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase leading-none text-cyan-300">
                {workout ? workoutStatusLabel(locale, workout.session.status) : (locale === 'ko' ? '불러오는 중...' : 'Loading...')}
              </p>
              <h1 className="mt-0.5 max-w-[150px] truncate text-lg font-extrabold leading-tight text-slate-100 md:max-w-[210px]">
                {workoutTitle}
              </h1>
            </div>
          </div>

          {/* 콤팩트 실시간 대시보드 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isCompletedEditMode && sessionElapsed ? (
              <div className="flex items-center gap-1 rounded-xl border border-slate-650 bg-slate-850 px-2.5 py-1 text-sm font-bold text-slate-100 shadow-inner">
                <Clock3 size={13} className="text-slate-200" />
                <span className="font-mono tracking-wide">{sessionElapsed}</span>
              </div>
            ) : workout && !isCompletedEditMode ? (
              <div className="rounded-xl border border-slate-650 bg-slate-850 px-2.5 py-1 text-sm font-bold text-slate-100 shadow-inner">
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
                className="flex items-center gap-1 rounded-xl border border-emerald-700/70 bg-emerald-950/80 px-2.5 py-1 text-sm font-bold text-emerald-200 shadow-md animate-pulse"
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
                className="flex items-center gap-1 rounded-xl border border-slate-650 bg-slate-850 px-2.5 py-1 text-sm font-bold text-slate-100 hover:text-slate-100"
              >
                <span>Rest</span>
                <span className="font-mono tracking-wide">{restElapsed}</span>
              </button>
            ) : null}
            {workout && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-650 bg-slate-850 px-2.5 py-1 text-sm font-bold text-emerald-300 shadow-inner">
                <span className="font-mono">{workout.session.totalStrengthVolumeKg.toLocaleString()}kg</span>
              </div>
            )}
          </div>
        </div>

        {/* 세션 상태 정보 바 */}
        <div className="mt-0.5 flex items-center justify-between gap-2 px-0.5 text-xs font-medium text-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]"></span>
            <span className="font-semibold text-slate-100">{saveMessage}</span>
          </div>
          <div className="font-bold text-slate-100">
            {completedExerciseCount}/{logs.length} {locale === 'ko' ? '운동' : 'Ex'} • {completedSetCount}/{totalSetCount} {locale === 'ko' ? '세트 완료' : 'Sets'}
          </div>
        </div>
      </header>

      {/* 2. 가로 스냅 스크롤링 운동 탭바 (헤더 하부 shrink-0) */}
      {logs.length > 0 && (
        <nav className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-650 bg-slate-850/60 py-2 scrollbar-none scroll-smooth">
          {logs.map((log) => {
            const allCompleted = log.sets.length > 0 && log.sets.every((s) => s.isCompleted);
            const completedCount = log.sets.filter((s) => s.isCompleted).length;
            const totalCount = log.sets.length;
            const isCurrentExpanded = !!expandedExercises[log.workoutExercise.id];

            return (
              <button
                key={log.workoutExercise.id}
                type="button"
                onClick={() => {
                  setExpandedExercises((prev) => ({
                    ...prev,
                    [log.workoutExercise.id]: true,
                  }));
                  setTimeout(() => {
                    const el = document.getElementById(`exercise-card-${log.workoutExercise.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                  isCurrentExpanded
                    ? 'bg-cyan-400 text-slate-950 ring-4 ring-cyan-400/20 shadow-lg'
                    : allCompleted
                      ? 'bg-emerald-950/65 text-emerald-300 border border-emerald-800/60'
                      : 'bg-slate-750 text-slate-100 border border-slate-650 hover:bg-slate-650'
                }`}
              >
                <span className="text-[13px] shrink-0">{getExerciseIcon(log.exercise.defaultEmoji)}</span>
                <span className="truncate max-w-[80px]">{getExerciseName(log.exercise, locale)}</span>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-black ${
                  isCurrentExpanded 
                    ? 'bg-cyan-500/30 text-slate-900' 
                    : allCompleted 
                      ? 'bg-emerald-900/40 text-emerald-400' 
                      : 'bg-slate-850 text-slate-200'
                }`}>
                  {completedCount}/{totalCount}
                </span>
                {allCompleted && (
                  <Check size={11} className="text-emerald-400 shrink-0 stroke-[3px]" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* 3. 중앙 본문 스크롤 영역 (flex-1 overflow-y-auto overscroll-contain) */}
      <div className="inner-scroll -mx-2 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2 py-2.5 scrollbar-none">

        {isCompletedEditMode ? (
          <section className="shrink-0 rounded-2xl border border-cyan-500/40 bg-cyan-950/25 p-3 shadow-lg animate-fade-in">
            <p className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]"></span>
              {locale === 'ko' ? '완료된 운동기록 편집 중' : 'Editing a finished workout'}
            </p>
            <p className="mt-1 text-sm font-medium leading-5 text-slate-100">
              {locale === 'ko'
                ? isHistoricalEditMode
                  ? '수정 내용은 저장할 때 통계와 내보내기에 반영됩니다.'
                  : '세트, 운동, 메모를 수정하면 통계와 내보내기에 바로 반영됩니다.'
                : isHistoricalEditMode
                  ? 'Your changes update stats and exports when saved.'
                  : 'Set, exercise, and memo edits update stats and exports immediately.'}
            </p>
          </section>
        ) : null}

        {isHistoricalEditMode && workout && !isRunningOnlyWorkout ? (
          <section className="shrink-0 space-y-2.5 rounded-2xl border border-slate-650 bg-slate-750/90 p-3 shadow-md">
            <div>
              <p className="text-xs font-black uppercase text-slate-200">{locale === 'ko' ? '운동 유형' : 'Workout type'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-100">
                {locale === 'ko' ? '기존 운동과 세트는 유지하고 소속만 변경합니다.' : 'Existing exercises and sets remain unchanged.'}
              </p>
            </div>
            <select
              aria-label="Historical workout routine"
              value={historyRoutineId}
              onChange={(event) => void handleHistoryRoutineChange(event.target.value)}
              className="min-h-10 w-full rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100"
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
                className="min-h-10 w-full rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100"
              >
                {historyRoutineDays.map((day) => (
                  <option key={day.id} value={day.id}>{getRoutineDayDisplayName(day, locale) ?? day.name}</option>
                ))}
              </select>
            ) : null}
          </section>
        ) : null}

        {/* 세션 메모 영역 */}
        <section className="shrink-0 rounded-2xl border border-slate-650 bg-slate-750/75 p-3 shadow-md">
          <label className="block text-sm font-bold text-slate-100">
            {locale === 'ko' ? '📝 세션 전체 메모' : '📝 Overall Session Notes'}
            <textarea
              aria-label="Session memo"
              defaultValue={workout?.session.memo ?? ''}
              onBlur={(event) => void handleUpdateSessionMemo(event.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-650 bg-slate-850 px-3 py-2 text-sm font-medium text-slate-100 outline-none transition-all placeholder:text-slate-350 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50"
              placeholder={locale === 'ko' ? '컨디션, 특이사항, 오늘 목표 등' : 'Energy level, injuries, or today\'s goals'}
            />
          </label>
        </section>

        {/* 운동검색/추가 폼 (isAdding일 때 스크롤 뷰 내 상단에 띄움) */}
        {isAdding && (
          <section id="workout-exercise-finder" className="shrink-0 rounded-2xl border border-cyan-500/30 bg-slate-750/90 p-3 shadow-xl animate-fade-in">
            <ExerciseFinder
              ariaLabel="Search exercises to add"
              exercises={availableExercises}
              locale={locale}
              state={exerciseFinderState}
              onChange={updateExerciseFinderState}
              onSelect={(exercise) => void handleAddExercise(exercise.id)}
              title={t(locale, 'exerciseFinder')}
            />
          </section>
        )}

        {/* 개별 운동 세트 아코디언 카드 그룹 */}
        <div className="flex flex-col gap-2.5">
          {logs.map((log, index) => {
            const isExpanded = !!expandedExercises[log.workoutExercise.id];
            const allCompleted = log.sets.length > 0 && log.sets.every((s) => s.isCompleted);
            const completedCount = log.sets.filter((s) => s.isCompleted).length;
            const totalCount = log.sets.length;

            return (
              <section
                key={log.workoutExercise.id}
                id={`exercise-card-${log.workoutExercise.id}`}
                className="scroll-mt-3 overflow-hidden rounded-2xl border border-slate-650 bg-slate-750/75 shadow-md transition-all duration-300"
              >
                {/* 아코디언 헤더 */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedExercises((prev) => ({
                      ...prev,
                      [log.workoutExercise.id]: !prev[log.workoutExercise.id],
                    }));
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-slate-650/40 active:bg-slate-650/60"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-xl shadow-inner">
                      {getExerciseIcon(log.exercise.defaultEmoji)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-base font-extrabold leading-tight text-slate-100">
                          {getExerciseName(log.exercise, locale)}
                        </h2>
                        {allCompleted && (
                          <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-black text-emerald-300">
                            {locale === 'ko' ? '완료' : 'Done'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-cyan-200">
                        {completedCount} / {totalCount} Sets
                        {log.workoutExercise.totalVolumeKg > 0 && (
                          <span className="text-slate-300 font-semibold font-mono"> • {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold uppercase text-slate-200">
                      {isExpanded ? (locale === 'ko' ? '접기' : 'Hide') : (locale === 'ko' ? '열기' : 'Show')}
                    </span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* 아코디언 바디 */}
                {isExpanded && (
                  <div className="border-t border-slate-650 bg-slate-850/35 px-3 pb-3 pt-2">
                    {/* 운동조작 버튼(순서 이동, 삭제, 교체) */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleMoveExercise(log.workoutExercise.id, -1)}
                          disabled={index === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 transition-all duration-200 hover:bg-slate-650 hover:text-slate-100 disabled:border-transparent disabled:bg-slate-950/20 disabled:text-slate-700 active:scale-95"
                          aria-label={`Move ${log.exercise.nameKo} up`}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMoveExercise(log.workoutExercise.id, 1)}
                          disabled={index === logs.length - 1}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 transition-all duration-200 hover:bg-slate-650 hover:text-slate-100 disabled:border-transparent disabled:bg-slate-950/20 disabled:text-slate-700 active:scale-95"
                          aria-label={`Move ${log.exercise.nameKo} down`}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteExercise(log)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-rose-300 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95"
                          aria-label={`Delete ${log.exercise.nameKo}`}
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
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
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'border-slate-650 bg-slate-750 text-slate-100 hover:bg-slate-650'
                        }`}
                      >
                        <RefreshCw aria-hidden="true" size={12} className={replacingWorkoutExerciseId === log.workoutExercise.id ? 'animate-spin' : ''} />
                        <span>{locale === 'ko' ? '교체' : 'Replace'}</span>
                      </button>
                    </div>

                    {/* 지난 운동 기록 복사 영역 */}
                    <div className="mt-2.5 rounded-xl border border-slate-650 bg-slate-850 px-3 py-2.5 shadow-inner">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-extrabold uppercase text-slate-200">{locale === 'ko' ? '지난 기록' : 'Previous Log'}</p>
                          <p className="mt-1 text-sm font-semibold leading-5 text-slate-100">
                            {log.previousSummary ?? (locale === 'ko' ? '이전 완료 기록이 없습니다' : 'No previous completed record yet')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyPreviousExercise(log)}
                          disabled={log.previousSets.length === 0}
                          className="min-h-8 shrink-0 rounded-lg border border-slate-650 bg-slate-750 px-3 text-xs font-bold text-cyan-200 transition-all hover:bg-slate-650 disabled:border-transparent disabled:bg-slate-950/30 disabled:text-slate-500 active:scale-95"
                        >
                          {locale === 'ko' ? '전체 복사' : 'Copy all'}
                        </button>
                      </div>
                      {log.previousSets.length > 0 ? (
                        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {log.previousSets.slice(0, 6).map((previousSet) => (
                            <span key={previousSet.id} className="shrink-0 rounded-lg border border-slate-650 bg-slate-750 px-2.5 py-1 font-mono text-xs font-bold text-slate-100 shadow-sm">
                              {previousSet.weightKg}kg x {previousSet.reps}{previousSet.rir !== undefined ? ` / RIR ${previousSet.rir}` : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* 운동 개별 메모 */}
                    <label className="mt-2.5 block text-xs font-bold uppercase text-slate-200">
                      {locale === 'ko' ? '운동 개별 메모' : 'Exercise Notes'}
                      <input
                        aria-label={`${log.exercise.nameKo} memo`}
                        type="text"
                        defaultValue={log.workoutExercise.memo ?? ''}
                        onBlur={(event) => void handleUpdateExerciseMemo(log.workoutExercise.id, event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-850 px-3 py-2 text-sm font-medium text-slate-100 outline-none transition-all placeholder:text-slate-350 focus:border-cyan-400/85 focus:ring-1 focus:ring-cyan-400/50"
                        placeholder={locale === 'ko' ? '그립, 자세, 기구 세팅 메모' : 'Grip type, machine setup, or form cues'}
                      />
                    </label>

                    {/* 운동교체 찾기 영역 (교체 활성화 시 노출) */}
                    {replacingWorkoutExerciseId === log.workoutExercise.id && (
                      <div className="mt-3 border-t border-slate-800/80 pt-3">
                        <ExerciseFinder
                          ariaLabel={`Search replacement for ${getExerciseName(log.exercise, locale)}`}
                          exercises={getAvailableExercises(log.exercise.id)}
                          locale={locale}
                          state={exerciseFinderState}
                          onChange={updateExerciseFinderState}
                          onSelect={(exercise) => void handleReplaceExercise(log.workoutExercise.id, exercise.id)}
                          title={locale === 'ko' ? '교체 운동 찾기' : 'Find replacement'}
                        />
                      </div>
                    )}

                    {/* 세트 리스트 */}
                    <div className="mt-3 flex flex-col gap-2">
                      {log.sets.map((set, setIndex) => (
                        <WorkoutSetRow
                          key={set.id}
                          set={set}
                          setIndex={setIndex}
                          log={log}
                          locale={locale}
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
                      className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100 transition-all duration-200 hover:bg-slate-750 active:scale-95"
                    >
                      <Plus aria-hidden="true" size={15} />
                      <span>{locale === 'ko' ? '세트 추가' : 'Add Set'}</span>
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Running input area */}
        <section className="shrink-0 rounded-2xl border border-slate-650 bg-slate-750/75 p-3 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'cardio')}</p>
              <h2 className="mt-0.5 text-base font-bold text-slate-100">
                {cardioRecords.length === 0 ? (locale === 'ko' ? '러닝' : 'Optional Running') : `${cardioRecords.length} ${t(locale, 'cardio')}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleAddCardio()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 active:scale-95 transition-all shadow-md shrink-0"
              aria-label="Add cardio"
            >
              <Plus aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {loggedCardioCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-cyan-950/40 border border-cyan-500/20 px-3.5 py-2.5 text-xs font-bold text-cyan-300 shadow-inner">
                <span>🏃‍♂️ {locale === 'ko' ? '오늘 러닝 누적 요약' : 'Running Summary'}</span>
                <span className="font-mono">
                  {totalCardioDistance.toFixed(1)} km / {totalCardioMinutes} {locale === 'ko' ? '분' : 'min'}
                </span>
              </div>
            )}

            {cardioRecords.map((cardioRecord) => {
              const minutes = Math.max(
                1,
                Math.round((new Date(cardioRecord.endedAt).getTime() - new Date(cardioRecord.startedAt).getTime()) / 60000),
              );

              const machineLabels: Record<string, string> = {
                treadmill: locale === 'ko' ? '트레드밀' : 'Treadmill',
                indoor_bike: locale === 'ko' ? '실내 자전거' : 'Indoor Bike',
                stair_climber: locale === 'ko' ? '천국의 계단' : 'Stair Climber',
                elliptical: locale === 'ko' ? '엘립티컬' : 'Elliptical',
              };
              const displayName = cardioRecord.environment === 'outdoor'
                ? (cardioRecord.location || (locale === 'ko' ? '야외 러닝/워킹' : 'Outdoor Running'))
                : (machineLabels[cardioRecord.machineType || ''] || (locale === 'ko' ? '실내 러닝' : 'Indoor Running'));

              return (
                <div key={cardioRecord.id} className="rounded-xl border border-slate-650 bg-slate-850/85 p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {cardioRecord.environment === 'indoor' ? '🏠' : '🌳'}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-100">
                          {displayName}
                        </p>
                        {cardioRecord.isDraft ? (
                          <span className="mt-0.5 inline-flex rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-black text-amber-200">
                            {locale === 'ko' ? '입력 중' : 'Draft'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCardio(cardioRecord)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                      aria-label="Delete cardio"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>

                  {/* 실내 / 야외 전환 탭 */}
                  <div className="mb-2.5 flex rounded-xl border border-slate-650 bg-slate-750 p-1">
                    <button
                      type="button"
                      onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'indoor', machineType: 'treadmill' })}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                        cardioRecord.environment === 'indoor'
                          ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50'
                          : 'text-slate-100 hover:bg-slate-650 hover:text-slate-100'
                      }`}
                    >
                      {locale === 'ko' ? '실내 러닝' : 'Indoor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'outdoor', location: '' })}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                        cardioRecord.environment === 'outdoor'
                          ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/50'
                          : 'text-slate-100 hover:bg-slate-650 hover:text-slate-100'
                      }`}
                    >
                      {locale === 'ko' ? '야외 러닝' : 'Outdoor'}
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {/* 기구 / 장소 입력 */}
                    {cardioRecord.environment === 'indoor' ? (
                      <label className="text-xs font-bold uppercase text-slate-200">
                        {locale === 'ko' ? '기구 선택' : 'Machine Select'}
                        <select
                          aria-label="Cardio machine select"
                          value={cardioRecord.machineType || 'treadmill'}
                          onChange={(event) => void handleUpdateCardio(cardioRecord, {
                            machineType: event.target.value as CardioRecord['machineType'],
                          })}
                          className="mt-1 min-h-10 w-full rounded-xl border border-slate-650 bg-slate-750 px-3 text-sm font-medium text-slate-100 outline-none"
                        >
                          <option value="treadmill">{locale === 'ko' ? '🏃‍♂️ 트레드밀 (러닝머신)' : '🏃‍♂️ Treadmill'}</option>
                          <option value="indoor_bike">{locale === 'ko' ? '🚴‍♂️ 실내 자전거' : '🚴‍♂️ Indoor Bike'}</option>
                          <option value="stair_climber">{locale === 'ko' ? '🧗‍♂️ 천국의 계단' : '🧗‍♂️ Stair Climber'}</option>
                          <option value="elliptical">{locale === 'ko' ? '🎿 엘립티컬' : '🎿 Elliptical'}</option>
                        </select>
                      </label>
                    ) : (
                      <label className="text-xs font-bold uppercase text-slate-200">
                        {locale === 'ko' ? '장소 입력' : 'Place'}
                        <input
                          aria-label="Cardio place input"
                          type="text"
                          defaultValue={cardioRecord.location ?? ''}
                          onBlur={(event) => void handleUpdateCardio(cardioRecord, { location: event.target.value.trim() })}
                          placeholder={locale === 'ko' ? '예: 동네 공원, 러닝 트랙 등' : 'e.g. Park, track, river'}
                          className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-750 px-3.5 py-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-400"
                        />
                      </label>
                    )}

                    {/* 퀵 증감 계기판 */}
                    <div className={`grid gap-2.5 ${cardioRecord.environment === 'indoor' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <label className="text-xs font-bold uppercase text-slate-200">
                        Km
                        <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 focus-within:ring-1 focus-within:ring-cyan-400">
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Math.max(0, Number(((cardioRecord.distanceKm || 0) - 0.5).toFixed(1)));
                              void handleUpdateCardio(cardioRecord, { distanceKm: nextVal || undefined });
                            }}
                            className="min-h-10 text-sm font-bold text-slate-100 hover:text-slate-100 active:bg-slate-850/50"
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
                            className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-black text-slate-100 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Number(((cardioRecord.distanceKm || 0) + 0.5).toFixed(1));
                              void handleUpdateCardio(cardioRecord, { distanceKm: nextVal });
                            }}
                            className="min-h-10 text-sm font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50"
                          >
                            +
                          </button>
                        </div>
                      </label>

                      <label className="text-xs font-bold uppercase text-slate-200">
                        {locale === 'ko' ? '분' : 'Min'}
                        <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 focus-within:ring-1 focus-within:ring-cyan-400">
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Math.max(1, minutes - 5);
                              void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                            }}
                            className="min-h-10 text-sm font-bold text-slate-100 hover:text-slate-100 active:bg-slate-850/50"
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
                            className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-black text-slate-100 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = minutes + 5;
                              void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                            }}
                            className="min-h-10 text-sm font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50"
                          >
                            +
                          </button>
                        </div>
                      </label>

                      {cardioRecord.environment === 'indoor' && (
                        <label className="text-xs font-bold uppercase text-slate-200">
                          {locale === 'ko' ? '경사 (%)' : 'Inc (%)'}
                          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 focus-within:ring-1 focus-within:ring-cyan-400">
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = Math.max(0, (cardioRecord.inclinePercent || 0) - 1);
                                void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                              }}
                              className="min-h-10 text-sm font-bold text-slate-100 hover:text-slate-100 active:bg-slate-850/50"
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
                              className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-black text-slate-100 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = (cardioRecord.inclinePercent || 0) + 1;
                                void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                              }}
                              className="min-h-10 text-sm font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50"
                            >
                              +
                            </button>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  <label className="mt-2.5 block text-xs font-bold uppercase text-slate-200">
                    {locale === 'ko' ? '메모' : 'Memo'}
                    <input
                      aria-label="Cardio memo"
                      type="text"
                      defaultValue={cardioRecord.memo ?? ''}
                      onBlur={(event) => void handleUpdateCardio(cardioRecord, { memo: event.target.value.trim() || undefined })}
                      placeholder={locale === 'ko' ? '속도 변경, 컨디션 피드백 등' : 'e.g. Speed changes, energy feedback'}
                      className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-750 px-3.5 py-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleSaveCardioAndContinue(cardioRecord)}
                    className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-sm font-black text-slate-950 shadow-md shadow-cyan-400/15 transition-all hover:bg-cyan-300 active:scale-95"
                  >
                    <Check aria-hidden="true" size={15} />
                    <span>
                      {cardioRecord.isDraft
                        ? locale === 'ko' ? '기록하고 운동 계속' : 'Log cardio and continue'
                        : locale === 'ko' ? '운동 기록 계속' : 'Continue workout log'}
                    </span>
                  </button>

                  {cardioRecord.averageSpeedKmh ? (
                    <p className="mt-3 text-xs font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-500/10 rounded-lg px-2.5 py-1.5 inline-block">
                      ⚡ {locale === 'ko' ? '평균 속도' : 'Average speed'}: <span className="font-mono">{cardioRecord.averageSpeedKmh.toFixed(1)} km/h</span>
                    </p>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-slate-100">
                      ℹ️ {locale === 'ko' ? '거리를 입력하면 평균 속도가 계산됩니다.' : 'Enter distance to calculate average speed.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 4. 하단 고정 조작 푸터 영역 (shrink-0) */}
      <footer className="mt-auto flex shrink-0 flex-col gap-2 border-t border-slate-650 bg-background pb-1 pt-2.5">
        {isHistoricalEditMode ? (
          <>
            <button
              type="button"
              onClick={() => {
                setIsAdding((current) => !current);
                resetExerciseFinderState();
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-650 bg-slate-750 text-sm font-bold text-slate-100"
            >
              <Plus aria-hidden="true" size={16} />
              {locale === 'ko' ? '개별 운동 추가' : 'Add individual exercise'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCancelHistoricalEdit()}
                className="flex min-h-12 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 px-4 text-sm font-bold text-slate-100"
              >
                {locale === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveHistoricalEdit()}
                className="flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 shadow-md"
              >
                {t(locale, 'save')}
              </button>
            </div>
          </>
        ) : isCompletedEditMode ? (
          <button type="button" onClick={onBack} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-300 active:scale-95 transition-all shadow-md">
            {locale === 'ko' ? '편집 완료' : 'Done Editing'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding((current) => !current);
                resetExerciseFinderState();
              }}
              className={`flex h-12 px-3.5 items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 shrink-0 border ${
                isAdding
                  ? 'border-slate-650 bg-slate-650 text-slate-100'
                  : 'border-slate-650 bg-slate-750 text-slate-100 hover:bg-slate-650'
              }`}
            >
              <Plus size={16} className={`transition-transform duration-300 ${isAdding ? 'rotate-45' : ''}`} />
              <span>{locale === 'ko' ? '운동 추가' : 'Add'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCompleteWorkout()}
              disabled={!workout || !canCompleteWorkout}
              className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/10 transition-all disabled:bg-slate-750 disabled:text-slate-400 active:scale-95"
            >
              <Check aria-hidden="true" size={16} />
              <span>{locale === 'ko' ? '운동 완료' : 'Complete'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSkipWorkout()}
              disabled={!workout}
              className="flex h-12 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 px-3 text-sm font-extrabold text-slate-100 transition-all hover:bg-slate-650 disabled:text-slate-500 active:scale-95"
            >
              {locale === 'ko' ? '패스' : 'Skip'}
            </button>
          </div>
        )}
      </footer>

      {/* 5. 플로팅 휴식 타이머 오버레이 (휴식 타이머 활성화 및 카운트 다운 중일 때) */}
      {isRestTimerActive && restRemaining > 0 && (
        <div className="fixed bottom-[4.5rem] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-blue-300 bg-blue-100/95 px-3.5 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 text-blue-700 animate-pulse">
                <Clock3 size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary">{t(locale, 'resting')}</p>
                <p className="text-lg font-black text-primary tracking-wider font-mono">
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
                className="flex h-8 items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-2.5 text-xs font-bold text-blue-700 transition-all active:scale-95 active:bg-blue-200"
              >
                +30s
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestDuration((prev) => Math.max(1, prev - 30));
                }}
                className="flex h-8 items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-2.5 text-xs font-bold text-primary transition-all active:scale-95 active:bg-blue-200"
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
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${(restRemaining / restDuration) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

type WorkoutSetRowProps = {
  set: WorkoutSet;
  setIndex: number;
  log: WorkoutExerciseLog;
  locale: 'ko' | 'en';
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
      className: 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
    },
    warmup: {
      labelKo: '준비',
      labelEn: 'Warmup',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.05)] hover:bg-amber-500/20'
    },
    drop: {
      labelKo: '드롭',
      labelEn: 'Drop',
      className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.05)] hover:bg-cyan-500/20'
    },
    failure: {
      labelKo: '실패',
      labelEn: 'Failure',
      className: 'bg-rose-500/10 text-rose-300 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.05)] hover:bg-rose-500/20'
    }
  };

  return (
    <div className="rounded-xl border border-slate-650 bg-slate-850/85 px-3 py-2.5 shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-black transition-all hover:brightness-110 active:scale-95 ${typeBadges[currentType].className}`}
          aria-label={`Toggle type for Set ${set.setNo}, current: ${currentType}`}
        >
          <span>{locale === 'ko' ? '세트' : 'Set'} {set.setNo}</span>
          <span className="opacity-90 tracking-wide uppercase">
            {locale === 'ko' ? typeBadges[currentType].labelKo : typeBadges[currentType].labelEn}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {!set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3 ? (
            <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-black text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.1)]">
              Hard
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <label className="text-xs font-extrabold uppercase text-slate-200">
          kg
          <div className="mt-1 grid grid-cols-[1.75rem_1fr_1.75rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 shadow-inner transition-all focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', -2.5)}
              className="min-h-10 text-base font-bold text-slate-100 transition-all hover:text-slate-100 active:scale-90 active:bg-slate-650"
            >
              -
            </button>
            <input
              id={`weight_input_${set.id}`}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} weight`}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              tabIndex={setIndex * 3 + 1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => {
                const num = Number(weight) || 0;
                if (num !== set.weightKg) {
                  void handleSetChange(set, { weightKg: num });
                }
              }}
              placeholder="kg"
              className="min-w-0 bg-transparent px-1 py-1.5 text-center text-base font-black text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', 2.5)}
              className="min-h-10 text-base font-bold text-cyan-200 transition-all hover:text-cyan-100 active:scale-90 active:bg-slate-650"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.weightKg > 0 && (
            <span className="mt-1 block truncate text-[11px] font-bold normal-case leading-none text-slate-300">
              {locale === 'ko' ? `지난: ${previousSet.weightKg}kg` : `Prev: ${previousSet.weightKg}kg`}
            </span>
          )}
        </label>

        <label className="text-xs font-extrabold uppercase text-slate-200">
          reps
          <div className="mt-1 grid grid-cols-[1.75rem_1fr_1.75rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 shadow-inner transition-all focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', -1)}
              className="min-h-10 text-base font-bold text-slate-100 transition-all hover:text-slate-100 active:scale-90 active:bg-slate-650"
            >
              -
            </button>
            <input
              id={`reps_input_${set.id}`}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} reps`}
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              tabIndex={setIndex * 3 + 2}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onBlur={() => {
                const num = Math.round(Number(reps)) || 0;
                if (num !== set.reps) {
                  void handleSetChange(set, { reps: num });
                }
              }}
              placeholder="reps"
              className="min-w-0 bg-transparent px-1 py-1.5 text-center text-base font-black text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', 1)}
              className="min-h-10 text-base font-bold text-cyan-200 transition-all hover:text-cyan-100 active:scale-90 active:bg-slate-650"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.reps > 0 && (
            <span className="mt-1 block truncate text-[11px] font-bold normal-case leading-none text-slate-300">
              {locale === 'ko' ? `지난: ${previousSet.reps}회` : `Prev: ${previousSet.reps} reps`}
            </span>
          )}
        </label>

        <label className="text-xs font-extrabold uppercase text-slate-200">
          RIR
          <div className="mt-1 grid grid-cols-[1.75rem_1fr_1.75rem] overflow-hidden rounded-xl border border-slate-650 bg-slate-750 shadow-inner transition-all focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', -1)}
              className="min-h-10 text-base font-bold text-slate-100 transition-all hover:text-slate-100 active:scale-90 active:bg-slate-650"
            >
              -
            </button>
            <input
              id={`rir_input_${set.id}`}
              aria-label={`${log.exercise.nameKo} set ${set.setNo} RIR`}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              tabIndex={setIndex * 3 + 3}
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              onBlur={() => {
                const val = rir === '' ? undefined : Number(rir) || 0;
                if (val !== set.rir) {
                  void handleSetChange(set, { rir: val });
                }
              }}
              placeholder="RIR"
              className="min-w-0 bg-transparent px-1 py-1.5 text-center text-base font-black text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', 1)}
              className="min-h-10 text-base font-bold text-cyan-200 transition-all hover:text-cyan-100 active:scale-90 active:bg-slate-650"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.rir !== undefined && (
            <span className="mt-1 block truncate text-[11px] font-bold normal-case leading-none text-slate-300">
              {locale === 'ko' ? `지난: RIR ${previousSet.rir}` : `Prev: RIR ${previousSet.rir}`}
            </span>
          )}
        </label>
      </div>

      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => void handleToggleWarmup(set)}
          className={`min-h-9 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 ${
            set.isWarmup
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-md shadow-amber-400/20'
              : 'bg-slate-750 text-slate-100 border border-slate-650 hover:bg-slate-650 hover:text-slate-100'
          }`}
        >
          {locale === 'ko' ? '준비' : 'Warm'}
        </button>
        <button
          type="button"
          onClick={() => void handleToggleHardSet(set)}
          className={`min-h-9 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 ${
            !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3
              ? 'bg-rose-500 text-slate-100 font-extrabold shadow-md shadow-rose-500/20'
              : 'bg-slate-750 text-slate-100 border border-slate-650 hover:bg-slate-650 hover:text-slate-100'
          }`}
        >
          Hard
        </button>
        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`min-h-9 rounded-xl text-sm font-black transition-all duration-300 active:scale-95 ${
            set.isCompleted
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
              : 'bg-slate-750 text-slate-100 border border-slate-650 hover:bg-slate-650 hover:text-slate-100'
          }`}
        >
          {set.isCompleted ? (locale === 'ko' ? '완료됨' : 'Done') : (locale === 'ko' ? '완료' : 'Complete')}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          disabled={!previousSet}
          className="flex min-h-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 transition-all hover:bg-slate-650 hover:text-slate-100 disabled:border-transparent disabled:bg-slate-950/20 disabled:text-slate-700 active:scale-95"
          aria-label="Copy previous values"
          title="Copy previous workout set"
        >
          <Copy aria-hidden="true" size={13} />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteSet(set)}
          disabled={log.sets.length === 1}
          className="flex min-h-9 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-rose-300 transition-all hover:bg-rose-500/10 disabled:border-transparent disabled:bg-slate-950/20 disabled:text-slate-700 active:scale-95"
          aria-label="Delete set"
        >
          <Trash2 aria-hidden="true" size={13} />
        </button>
      </div>
    </div>
  );
}
