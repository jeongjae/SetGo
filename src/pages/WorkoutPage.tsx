import { ArrowDown, ArrowUp, Check, ChevronLeft, ClipboardList, Clock3, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { db } from '../db/db';
import { getRoutineDayDisplayName } from '../db/routines';
import { getExerciseIcon } from '../utils/exerciseIcon';
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
  updateWorkoutSessionMemo,
  updateWorkoutSet,
  type ActiveWorkout,
  type WorkoutExerciseLog,
} from '../db/workouts';
import type { CardioRecord, ExerciseCategory, ExerciseMaster, ExerciseStage, WorkoutSet, WorkoutSetType } from '../types';

type WorkoutPageProps = {
  sessionId?: string;
  onBack: () => void;
  onCompleted: () => void;
  onSkipped: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function WorkoutPage({ sessionId, onBack, onCompleted, onSkipped }: WorkoutPageProps) {
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

  const totalCardioDistance = useMemo(() => {
    return cardioRecords.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  }, [cardioRecords]);

  const totalCardioMinutes = useMemo(() => {
    return cardioRecords.reduce((acc, curr) => {
      const min = Math.max(
        1,
        Math.round((new Date(curr.endedAt).getTime() - new Date(curr.startedAt).getTime()) / 60000)
      );
      return acc + min;
    }, 0);
  }, [cardioRecords]);

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
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  }

  useEffect(() => {
    void loadWorkout();
  }, [sessionId]);

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

    await addExerciseToWorkout(workout.session.id, exerciseId);
    setIsAdding(false);
    await loadWorkout();
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

  async function handleDeleteSet(setId: string) {
    await deleteWorkoutSet(setId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '세트를 삭제했습니다' : 'Set deleted');
  }

  async function handleDeleteExercise(workoutExerciseId: string) {
    await deleteWorkoutExercise(workoutExerciseId);
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
    setSaveMessage(locale === 'ko' ? '유산소를 추가했습니다' : 'Cardio added');
  }

  async function handleUpdateCardio(
    cardioRecord: CardioRecord,
    values: Partial<Pick<CardioRecord, 'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo' | 'inclinePercent'>>,
  ) {
    await updateCardioRecord(cardioRecord.id, values);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '유산소를 저장했습니다' : 'Cardio saved');
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

  async function handleDeleteCardio(cardioRecordId: string) {
    await deleteCardioRecord(cardioRecordId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '유산소를 삭제했습니다' : 'Cardio deleted');
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
  const completedExerciseCount = logs.filter((log) => log.workoutExercise.status === 'completed').length;
  const sessionElapsed = workout?.session.startedAt
    ? formatElapsed(timerNow - new Date(workout.session.startedAt).getTime())
    : '0:00';
  const restElapsed = restTimerStartedAt ? formatElapsed(timerNow - restTimerStartedAt) : '--:--';
  const isCompletedEditMode = workout?.session.status === 'completed' || workout?.session.status === 'skipped';

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-850 active:scale-95 transition-all shadow-md shrink-0"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">{t(locale, 'startWorkout')}</p>
          <h1 className="text-2xl font-extrabold text-white bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.1)] animate-fade-in">
            {locale === 'ko' ? '오늘의 운동기록' : "Today's Session"}
          </h1>
        </div>
      </header>

      {isCompletedEditMode ? (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-md p-4 shadow-lg shadow-cyan-950/10 animate-fade-in">
          <p className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]"></span>
            {locale === 'ko' ? '완료된 운동기록 편집 중' : 'Editing a finished workout'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400 font-medium">
            {locale === 'ko'
              ? '세트, 운동, 메모를 수정하면 통계와 내보내기에 바로 반영됩니다.'
              : 'Set, exercise, and memo edits update stats and exports immediately.'}
          </p>
        </section>
      ) : null}

      {/* Session Overview Card */}
      <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl"></div>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <ClipboardList aria-hidden="true" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{locale === 'ko' ? '세션 상태' : 'Session Status'}</p>
            <h2 className="mt-0.5 text-lg font-bold text-white truncate">
              {workout ? workoutStatusLabel(locale, workout.session.status) : (locale === 'ko' ? '불러오는 중...' : 'Loading...')}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {workout ? `${workout.session.date} • ${timeBandLabel(locale, workout.session.timeBand)}` : ''}
            </p>
          </div>
        </div>

        {workout ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-950/80 border border-slate-850 p-2.5 text-center transition-all duration-200 hover:border-slate-800">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t(locale, 'exercises')}</p>
              <p className="mt-1 text-base font-extrabold text-white">{completedExerciseCount} <span className="text-xs text-slate-500">/ {logs.length}</span></p>
            </div>
            <div className="rounded-xl bg-slate-950/80 border border-slate-850 p-2.5 text-center transition-all duration-200 hover:border-slate-800">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{locale === 'ko' ? '세트' : 'Sets'}</p>
              <p className="mt-1 text-base font-extrabold text-white">{completedSetCount} <span className="text-xs text-slate-500">/ {totalSetCount}</span></p>
            </div>
            <div className="rounded-xl bg-slate-950/80 border border-slate-850 p-2.5 text-center transition-all duration-200 hover:border-slate-800">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{locale === 'ko' ? '볼륨' : 'Volume'}</p>
              <p className="mt-1 text-base font-extrabold text-emerald-450 font-mono tracking-tight">{workout.session.totalStrengthVolumeKg.toLocaleString()} <span className="text-[9px] text-slate-500">kg</span></p>
            </div>
          </div>
        ) : null}

        {workout ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-950/80 border border-slate-850 px-3 py-2 text-xs font-bold text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]"></span>
            {saveMessage}
          </div>
        ) : null}
      </section>

      {!isCompletedEditMode ? (
        <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-xs uppercase tracking-wider">
            <Clock3 aria-hidden="true" size={16} />
            <p>{locale === 'ko' ? '실시간 타이머 대시보드' : 'Real-time Timer Dashboard'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-950/80 border border-slate-850 p-3 text-center">
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{locale === 'ko' ? '진행 시간' : 'Workout'}</p>
              <p className="mt-1 text-3xl font-black font-mono tracking-wider text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">{sessionElapsed}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRestTimerStartedAt(Date.now());
                setRestRemaining(restDuration);
                setIsRestTimerActive(true);
              }}
              className="rounded-xl bg-slate-950/80 border border-slate-850 p-3 text-center active:scale-95 transition-all hover:bg-slate-900/80 hover:border-slate-700"
            >
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{locale === 'ko' ? '휴식 타이머' : 'Rest Timer'}</p>
              <p className="mt-1 text-3xl font-black font-mono tracking-wider text-emerald-450 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]">{restElapsed}</p>
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t(locale, 'routine')}</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">
            {routineNameLabel(locale, workout?.routineName) ?? t(locale, 'freeWorkout')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400 font-medium">
            {workout?.routineDay
              ? locale === 'ko' ? `${workoutRoutineDayName} 루틴 기반 운동을 수행 중입니다.` : `Currently logging ${workoutRoutineDayName} routine plan.`
              : locale === 'ko' ? '자유 운동 세션입니다. 운동을 리스트에 추가해 보세요.' : 'Free workout session. Add exercises directly.'}
          </p>
        </div>

        <label className="mt-1 block text-xs font-bold text-slate-400">
          {locale === 'ko' ? '📝 오늘 세션 전체 메모' : '📝 Overall Session Notes'}
          <textarea
            aria-label="Session memo"
            defaultValue={workout?.session.memo ?? ''}
            onBlur={(event) => void handleUpdateSessionMemo(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl bg-slate-950/80 border border-slate-850 px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/80 transition-all placeholder:text-slate-600"
            placeholder={locale === 'ko' ? '컨디션, 특이사항, 오늘 목표 등' : 'Energy level, injuries, or today\'s goals'}
          />
        </label>
      </section>

      <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{locale === 'ko' ? '기록 리스트' : 'Logged Exercises'}</p>
            <h2 className="mt-0.5 text-lg font-bold text-white">
              {logs.length === 0 ? (locale === 'ko' ? '운동을 추가하세요' : 'Add exercises') : exerciseCountLabel(locale, logs.length)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAdding((current) => !current);
              resetExerciseFinderState();
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-95 ${
              isAdding
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-slate-950 shadow-md shadow-cyan-400/20'
            }`}
            aria-label="Add exercise"
          >
            <Plus aria-hidden="true" size={22} className={`transition-transform duration-300 ${isAdding ? 'rotate-45' : ''}`} />
          </button>
        </div>

        {isAdding ? (
          <div className="mt-2 border-t border-slate-800/60 pt-4">
            <ExerciseFinder
              ariaLabel="Search exercises to add"
              exercises={availableExercises}
              locale={locale}
              state={exerciseFinderState}
              onChange={updateExerciseFinderState}
              onSelect={(exercise) => void handleAddExercise(exercise.id)}
              title={t(locale, 'exerciseFinder')}
            />
          </div>
        ) : null}
      </section>

      {/* 가로 스냅 스크롤링 운동 탭바 */}
      {logs.length > 0 && (
        <nav className="sticky top-0 z-20 flex gap-2.5 overflow-x-auto bg-slate-950/80 backdrop-blur-md px-4 py-3 scrollbar-none border-b border-slate-900 -mx-4 shadow-xl scroll-smooth">
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
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                  isCurrentExpanded
                    ? 'bg-cyan-400 text-slate-950 ring-4 ring-cyan-400/20 shadow-lg shadow-cyan-400/10'
                    : allCompleted
                      ? 'bg-emerald-950/65 text-emerald-300 border border-emerald-800/60'
                      : 'bg-slate-900 text-slate-400 border border-slate-800/80 hover:bg-slate-850'
                }`}
              >
                <span className="text-[14px] shrink-0">{getExerciseIcon(log.exercise.defaultEmoji)}</span>
                <span className="truncate max-w-[90px]">{getExerciseName(log.exercise, locale)}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded font-mono ${
                  isCurrentExpanded 
                    ? 'bg-cyan-500/30 text-slate-900' 
                    : allCompleted 
                      ? 'bg-emerald-900/40 text-emerald-400' 
                      : 'bg-slate-800 text-slate-500'
                }`}>
                  {completedCount}/{totalCount}
                </span>
                {allCompleted && (
                  <Check size={12} className="text-emerald-400 shrink-0 stroke-[3px]" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {logs.map((log, index) => {
        const isExpanded = !!expandedExercises[log.workoutExercise.id];
        const allCompleted = log.sets.length > 0 && log.sets.every((s) => s.isCompleted);
        const completedCount = log.sets.filter((s) => s.isCompleted).length;
        const totalCount = log.sets.length;

        return (
          <section 
            key={log.workoutExercise.id} 
            id={`exercise-card-${log.workoutExercise.id}`}
            className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/85 shadow-2xl transition-all duration-300 overflow-hidden"
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
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-800/30 transition-colors active:bg-slate-800/40"
            >
              <div className="flex items-center gap-3 pr-4">
                <div className="w-11 h-11 shrink-0 flex items-center justify-center bg-slate-950 border border-slate-800/80 rounded-xl text-xl shadow-inner shadow-slate-900/50">
                  {getExerciseIcon(log.exercise.defaultEmoji)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-[15px] font-bold text-white leading-tight">
                      {getExerciseName(log.exercise, locale)}
                    </h2>
                    {allCompleted && (
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.1)] shrink-0">
                        {locale === 'ko' ? '완료' : 'Done'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-cyan-400">
                    {completedCount} / {totalCount} Sets
                    {log.workoutExercise.totalVolumeKg > 0 && (
                      <span className="text-slate-400 font-medium font-mono"> • {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-extrabold text-slate-500 tracking-wide uppercase">
                  {isExpanded ? (locale === 'ko' ? '접기' : 'Collapse') : (locale === 'ko' ? '보기' : 'Expand')}
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
              <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 bg-slate-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleMoveExercise(log.workoutExercise.id, -1)}
                      disabled={index === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:text-slate-700 disabled:border-slate-800/40 disabled:bg-slate-950/20 hover:bg-slate-800 hover:text-white transition-all active:scale-95 duration-200"
                      aria-label={`Move ${log.exercise.nameKo} up`}
                    >
                      <ArrowUp aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoveExercise(log.workoutExercise.id, 1)}
                      disabled={index === logs.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:text-slate-700 disabled:border-slate-800/40 disabled:bg-slate-950/20 hover:bg-slate-800 hover:text-white transition-all active:scale-95 duration-200"
                      aria-label={`Move ${log.exercise.nameKo} down`}
                    >
                      <ArrowDown aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExercise(log.workoutExercise.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all active:scale-95 duration-200"
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
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <RefreshCw aria-hidden="true" size={12} className={replacingWorkoutExerciseId === log.workoutExercise.id ? 'animate-spin' : ''} />
                    <span>{locale === 'ko' ? '교체' : 'Replace'}</span>
                  </button>
                </div>

                <div className="mt-3.5 rounded-xl bg-slate-950/60 border border-slate-900 px-4 py-3 shadow-inner">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{locale === 'ko' ? '지난 기록' : 'Previous Log'}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300 font-semibold">
                        {log.previousSummary ?? (locale === 'ko' ? '이전 완료 기록이 없습니다' : 'No previous completed record yet')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyPreviousExercise(log)}
                      disabled={log.previousSets.length === 0}
                      className="min-h-8 shrink-0 rounded-lg bg-slate-900 border border-slate-850 px-3 text-xs font-bold text-cyan-400 disabled:text-slate-600 disabled:border-transparent disabled:bg-slate-950 hover:bg-slate-800 hover:text-cyan-300 active:scale-95 transition-all"
                    >
                      {locale === 'ko' ? '전체 복사' : 'Copy all'}
                    </button>
                  </div>
                  {log.previousSets.length > 0 ? (
                    <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {log.previousSets.slice(0, 6).map((previousSet) => (
                        <span key={previousSet.id} className="shrink-0 rounded-lg bg-slate-900 border border-slate-850 px-2.5 py-1 text-[10px] font-bold text-slate-400 font-mono shadow-sm">
                          {previousSet.weightKg}kg x {previousSet.reps}{previousSet.rir !== undefined ? ` / RIR ${previousSet.rir}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {locale === 'ko' ? '운동 개별 메모' : 'Exercise Notes'}
                  <input
                    aria-label={`${log.exercise.nameKo} memo`}
                    type="text"
                    defaultValue={log.workoutExercise.memo ?? ''}
                    onBlur={(event) => void handleUpdateExerciseMemo(log.workoutExercise.id, event.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-slate-950/80 border border-slate-850 px-3.5 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/80 transition-all placeholder:text-slate-600"
                    placeholder={locale === 'ko' ? '그립, 자세, 기구 세팅 메모' : 'Grip type, machine setup, or form cues'}
                  />
                </label>

                {replacingWorkoutExerciseId === log.workoutExercise.id ? (
                  <div className="mt-4 border-t border-slate-800/40 pt-4">
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
                ) : null}

                <div className="mt-4 grid gap-2.5">
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
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-800 active:scale-95 transition-all duration-200"
                >
                  <Plus aria-hidden="true" size={15} />
                  <span>{locale === 'ko' ? '세트 추가' : 'Add Set'}</span>
                </button>
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">{t(locale, 'cardio')}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {cardioRecords.length === 0 ? (locale === 'ko' ? '선택 입력' : 'Optional manual entry') : `${cardioRecords.length} ${t(locale, 'cardio')}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleAddCardio()}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400 text-slate-950"
            aria-label="Add cardio"
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
        {cardioRecords.length > 0 && (
          <div className="mt-3.5 flex items-center justify-between rounded-lg bg-cyan-950/40 border border-cyan-500/20 px-4 py-3 text-xs font-semibold text-cyan-300">
            <span>{locale === 'ko' ? '🏃‍♂️ 오늘 유산소 누적 요약' : '🏃‍♂️ Cardio Summary'}</span>
            <span>
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
              ? (cardioRecord.location || (locale === 'ko' ? '야외 러닝/워킹' : 'Outdoor Cardio'))
              : (machineLabels[cardioRecord.machineType || ''] || (locale === 'ko' ? '실내 유산소' : 'Indoor Cardio'));

            return (
              <div key={cardioRecord.id} className="rounded-md bg-slate-800 p-3.5 border border-slate-750">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">
                      {cardioRecord.environment === 'indoor' ? '🏠' : '🌳'}
                    </span>
                    <p className="text-sm font-bold text-white">
                      {displayName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCardio(cardioRecord.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 hover:bg-slate-950 text-red-400 active:scale-95 transition-all"
                    aria-label="Delete cardio"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </div>

                {/* 실내 / 야외 전환 탭 */}
                <div className="flex rounded-lg bg-slate-900 p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'indoor', machineType: 'treadmill' })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                      cardioRecord.environment === 'indoor'
                        ? 'bg-slate-800 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {locale === 'ko' ? '실내 유산소' : 'Indoor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateCardio(cardioRecord, { environment: 'outdoor', location: '' })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                      cardioRecord.environment === 'outdoor'
                        ? 'bg-slate-800 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {locale === 'ko' ? '야외 유산소' : 'Outdoor'}
                  </button>
                </div>

                <div className="grid gap-3">
                  {/* 기구 / 장소 입력 */}
                  {cardioRecord.environment === 'indoor' ? (
                    <label className="text-[11px] font-semibold uppercase text-slate-500">
                      {locale === 'ko' ? '기구 선택' : 'Machine Select'}
                      <select
                        aria-label="Cardio machine select"
                        value={cardioRecord.machineType || 'treadmill'}
                        onChange={(event) => void handleUpdateCardio(cardioRecord, {
                          machineType: event.target.value as CardioRecord['machineType'],
                        })}
                        className="mt-1 min-h-10 w-full rounded-md bg-slate-900 px-3 text-sm text-white border border-slate-700/50"
                      >
                        <option value="treadmill">{locale === 'ko' ? '🏃‍♂️ 트레드밀 (러닝머신)' : '🏃‍♂️ Treadmill'}</option>
                        <option value="indoor_bike">{locale === 'ko' ? '🚴‍♂️ 실내 자전거' : '🚴‍♂️ Indoor Bike'}</option>
                        <option value="stair_climber">{locale === 'ko' ? '🧗‍♂️ 천국의 계단' : '🧗‍♂️ Stair Climber'}</option>
                        <option value="elliptical">{locale === 'ko' ? '🎿 엘립티컬' : '🎿 Elliptical'}</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-[11px] font-semibold uppercase text-slate-500">
                      {locale === 'ko' ? '장소 입력' : 'Place'}
                      <input
                        aria-label="Cardio place input"
                        type="text"
                        defaultValue={cardioRecord.location ?? ''}
                        onBlur={(event) => void handleUpdateCardio(cardioRecord, { location: event.target.value.trim() })}
                        placeholder={locale === 'ko' ? '예: 동네 공원, 러닝 트랙 등' : 'e.g. Park, track, river'}
                        className="mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white border border-slate-700/50 outline-none focus:border-cyan-400"
                      />
                    </label>
                  )}

                  {/* 퀵 증감 계기판 */}
                  <div className={`grid gap-2 ${cardioRecord.environment === 'indoor' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <label className="text-[11px] font-semibold uppercase text-slate-500">
                      Km
                      <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(0, Number(((cardioRecord.distanceKm || 0) - 0.5).toFixed(1)));
                            void handleUpdateCardio(cardioRecord, { distanceKm: nextVal || undefined });
                          }}
                          className="min-h-10 text-sm font-bold text-slate-300"
                        >
                          -
                        </button>
                        <input
                          aria-label="Cardio distance"
                          type="text"
                          inputMode="decimal"
                          enterKeyHint="done"
                          value={cardioRecord.distanceKm || ''}
                          onChange={(event) => {
                            const val = event.target.value === '' ? undefined : Number(event.target.value) || 0;
                            void handleUpdateCardio(cardioRecord, { distanceKm: val });
                          }}
                          placeholder="0.0"
                          className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Number(((cardioRecord.distanceKm || 0) + 0.5).toFixed(1));
                            void handleUpdateCardio(cardioRecord, { distanceKm: nextVal });
                          }}
                          className="min-h-10 text-sm font-bold text-cyan-300"
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <label className="text-[11px] font-semibold uppercase text-slate-500">
                      {locale === 'ko' ? '분' : 'Min'}
                      <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(1, minutes - 5);
                            void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                          }}
                          className="min-h-10 text-sm font-bold text-slate-300"
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
                          className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = minutes + 5;
                            void handleUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                          }}
                          className="min-h-10 text-sm font-bold text-cyan-300"
                        >
                          +
                        </button>
                      </div>
                    </label>

                    {cardioRecord.environment === 'indoor' && (
                      <label className="text-[11px] font-semibold uppercase text-slate-500">
                        {locale === 'ko' ? '경사도 (%)' : 'Incline (%)'}
                        <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = Math.max(0, (cardioRecord.inclinePercent || 0) - 1);
                              void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                            }}
                            className="min-h-10 text-sm font-bold text-slate-300"
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
                            className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = (cardioRecord.inclinePercent || 0) + 1;
                              void handleUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                            }}
                            className="min-h-10 text-sm font-bold text-cyan-300"
                          >
                            +
                          </button>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <label className="mt-3.5 block text-[11px] font-semibold uppercase text-slate-500">
                  {locale === 'ko' ? '메모' : 'Memo'}
                  <input
                    aria-label="Cardio memo"
                    type="text"
                    defaultValue={cardioRecord.memo ?? ''}
                    onBlur={(event) => void handleUpdateCardio(cardioRecord, { memo: event.target.value.trim() || undefined })}
                    placeholder={locale === 'ko' ? '속도 변경, 컨디션 피드백 등' : 'e.g. Speed changes, energy feedback'}
                    className="mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white border border-slate-700/50 outline-none focus:border-cyan-400"
                  />
                </label>

                {cardioRecord.averageSpeedKmh ? (
                  <p className="mt-3 text-xs font-semibold text-cyan-400 bg-cyan-950/30 rounded px-2.5 py-1.5 inline-block">
                    ⚡ {locale === 'ko' ? '평균 속도' : 'Average speed'}: <span className="font-mono">{cardioRecord.averageSpeedKmh.toFixed(1)} km/h</span>
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] font-medium text-slate-400">
                    ℹ️ {locale === 'ko' ? '거리를 입력하면 평균 속도가 계산됩니다.' : 'Enter distance to calculate average speed.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isCompletedEditMode ? (
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-14 items-center justify-center rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950"
        >
          {locale === 'ko' ? '편집 완료' : 'Done Editing'}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void handleCompleteWorkout()}
            disabled={!workout || logs.length === 0}
            className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Check aria-hidden="true" size={18} />
            <span>{locale === 'ko' ? '운동 완료' : 'Complete Workout'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSkipWorkout()}
            disabled={!workout}
            className="flex min-h-12 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-semibold text-slate-300 disabled:text-slate-600"
          >
            {locale === 'ko' ? '운동 건너뛰기' : 'Skip Workout'}
          </button>
        </>
      )}

      {isRestTimerActive && restRemaining > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-slate-700/50 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 animate-pulse">
                <Clock3 size={16} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400">{t(locale, 'resting')}</p>
                <p className="text-lg font-bold text-white tracking-wider">
                  {Math.floor(restRemaining / 60)}:{(restRemaining % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRestDuration((prev) => prev + 30);
                }}
                className="flex h-8 items-center justify-center rounded-md bg-slate-900 px-2.5 text-xs font-bold text-cyan-300 border border-cyan-400/20 active:bg-cyan-500/20"
              >
                +30s
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestDuration((prev) => Math.max(1, prev - 30));
                }}
                className="flex h-8 items-center justify-center rounded-md bg-slate-900 px-2.5 text-xs font-bold text-slate-400 border border-slate-700 active:bg-slate-800"
              >
                -30s
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRestTimerActive(false);
                  setRestRemaining(0);
                }}
                className="flex h-8 items-center justify-center rounded-md bg-red-500/25 px-2.5 text-xs font-bold text-red-200 hover:bg-red-500/40"
              >
                {t(locale, 'skip')}
              </button>
            </div>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400 transition-all duration-500 ease-out"
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
  handleDeleteSet: (setId: string) => Promise<void>;
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
      className: 'bg-slate-700/50 text-slate-300 border border-slate-600/30'
    },
    warmup: {
      labelKo: '준비',
      labelEn: 'Warmup',
      className: 'bg-amber-400/15 text-amber-300 border border-amber-400/20 shadow-[0_0_8px_rgba(251,191,36,0.05)]'
    },
    drop: {
      labelKo: '드롭',
      labelEn: 'Drop',
      className: 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.05)]'
    },
    failure: {
      labelKo: '실패',
      labelEn: 'Failure',
      className: 'bg-rose-500/15 text-rose-300 border border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.05)]'
    }
  };

  return (
    <div className="rounded-xl bg-slate-950/40 border border-slate-900 px-4 py-3.5 shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black transition-all hover:brightness-110 active:scale-95 border ${typeBadges[currentType].className}`}
          aria-label={`Toggle type for Set ${set.setNo}, current: ${currentType}`}
        >
          <span>{locale === 'ko' ? '세트' : 'Set'} {set.setNo}</span>
          <span className="opacity-90 tracking-wide uppercase">
            {locale === 'ko' ? typeBadges[currentType].labelKo : typeBadges[currentType].labelEn}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {!set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3 ? (
            <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[9px] font-black text-rose-400 border border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.1)]">
              Hard
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          kg
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl bg-slate-900 border border-slate-800/80 focus-within:ring-1 focus-within:ring-cyan-400 focus-within:border-cyan-450 transition-all">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', -2.5)}
              className="min-h-10 text-xs font-bold text-slate-400 hover:text-slate-200 active:bg-slate-850/50 transition-all"
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
              className="min-w-0 bg-transparent px-1 py-2.5 text-center text-sm font-black text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', 2.5)}
              className="min-h-10 text-xs font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50 transition-all"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.weightKg > 0 && (
            <span className="mt-1 block text-[9px] font-semibold text-slate-500 normal-case leading-none truncate">
              {locale === 'ko' ? `지난: ${previousSet.weightKg}kg` : `Prev: ${previousSet.weightKg}kg`}
            </span>
          )}
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          reps
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl bg-slate-900 border border-slate-800/80 focus-within:ring-1 focus-within:ring-cyan-400 focus-within:border-cyan-450 transition-all">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', -1)}
              className="min-h-10 text-xs font-bold text-slate-400 hover:text-slate-200 active:bg-slate-850/50 transition-all"
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
              className="min-w-0 bg-transparent px-1 py-2.5 text-center text-sm font-black text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', 1)}
              className="min-h-10 text-xs font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50 transition-all"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.reps > 0 && (
            <span className="mt-1 block text-[9px] font-semibold text-slate-500 normal-case leading-none truncate">
              {locale === 'ko' ? `지난: ${previousSet.reps}회` : `Prev: ${previousSet.reps} reps`}
            </span>
          )}
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          RIR
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl bg-slate-900 border border-slate-800/80 focus-within:ring-1 focus-within:ring-cyan-400 focus-within:border-cyan-450 transition-all">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', -1)}
              className="min-h-10 text-xs font-bold text-slate-400 hover:text-slate-200 active:bg-slate-850/50 transition-all"
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
              className="min-w-0 bg-transparent px-1 py-2.5 text-center text-sm font-black text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', 1)}
              className="min-h-10 text-xs font-bold text-cyan-400 hover:text-cyan-300 active:bg-slate-850/50 transition-all"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.rir !== undefined && (
            <span className="mt-1 block text-[9px] font-semibold text-slate-500 normal-case leading-none truncate">
              {locale === 'ko' ? `지난: RIR ${previousSet.rir}` : `Prev: RIR ${previousSet.rir}`}
            </span>
          )}
        </label>
      </div>

      <div className="mt-3.5 grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => void handleToggleWarmup(set)}
          className={`min-h-10 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
            set.isWarmup
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-md shadow-amber-400/20'
              : 'bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-850 hover:text-slate-200'
          }`}
        >
          {locale === 'ko' ? '준비' : 'Warm'}
        </button>
        <button
          type="button"
          onClick={() => void handleToggleHardSet(set)}
          className={`min-h-10 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
            !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3
              ? 'bg-rose-500 text-white font-extrabold shadow-md shadow-rose-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-850 hover:text-slate-200'
          }`}
        >
          Hard
        </button>
        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`min-h-10 rounded-xl text-xs font-black transition-all duration-300 active:scale-95 ${
            set.isCompleted
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/35 ring-2 ring-emerald-400/20'
              : 'bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-850 hover:text-slate-200'
          }`}
        >
          {set.isCompleted ? (locale === 'ko' ? '완료' : 'Done') : (locale === 'ko' ? '기록' : 'Log')}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          disabled={!previousSet}
          className="flex min-h-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-850 text-slate-300 hover:bg-slate-850 hover:text-white disabled:text-slate-700 disabled:border-transparent disabled:bg-slate-950 transition-all active:scale-95"
          aria-label={`Copy previous values`}
          title="Copy previous workout set"
        >
          <Copy aria-hidden="true" size={14} />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteSet(set.id)}
          disabled={log.sets.length === 1}
          className="flex min-h-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-850 text-rose-400 hover:bg-rose-500/10 disabled:text-slate-700 disabled:border-transparent disabled:bg-slate-950 transition-all active:scale-95"
          aria-label={`Delete set`}
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  );
}
