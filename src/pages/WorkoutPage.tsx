import { ArrowDown, ArrowUp, Check, ChevronLeft, ClipboardList, Clock3, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { db } from '../db/db';
import { getRoutineDayDisplayName } from '../db/routines';
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
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-slate-100"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-sm font-medium text-cyan-300">{t(locale, 'startWorkout')}</p>
          <h1 className="text-2xl font-bold text-white">{locale === 'ko' ? '오늘 운동 세션' : "Today's session"}</h1>
        </div>
      </header>

      {isCompletedEditMode ? (
        <section className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-4">
          <p className="text-sm font-bold text-cyan-200">
            {locale === 'ko' ? '완료된 운동기록 편집 중' : 'Editing a finished workout'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {locale === 'ko'
              ? '세트, 운동, 메모를 수정하면 통계와 내보내기에 바로 반영됩니다.'
              : 'Set, exercise, and memo edits update stats and exports immediately.'}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-slate-950">
            <ClipboardList aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{locale === 'ko' ? '세션 상태' : 'Session Status'}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {workout ? workoutStatusLabel(locale, workout.session.status) : (locale === 'ko' ? '불러오는 중...' : 'Loading...')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {workout
                ? `${workout.session.date} / ${timeBandLabel(locale, workout.session.timeBand)} / ${workout.session.totalStrengthVolumeKg.toLocaleString()} kg`
                : locale === 'ko' ? '오늘의 로컬 운동 세션을 불러오는 중입니다.' : "Looking up today's local workout session."}
            </p>
            {workout ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-slate-800 px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{t(locale, 'exercises')}</p>
                  <p className="mt-1 text-sm font-bold text-white">{completedExerciseCount}/{logs.length}</p>
                </div>
                <div className="rounded-md bg-slate-800 px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{locale === 'ko' ? '세트' : 'Sets'}</p>
                  <p className="mt-1 text-sm font-bold text-white">{completedSetCount}/{totalSetCount}</p>
                </div>
                <div className="rounded-md bg-slate-800 px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{locale === 'ko' ? '볼륨' : 'Volume'}</p>
                  <p className="mt-1 text-sm font-bold text-white">{workout.session.totalStrengthVolumeKg.toLocaleString()}</p>
                </div>
              </div>
            ) : null}
            {workout ? (
              <p className="mt-3 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-cyan-300">
                {saveMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {!isCompletedEditMode ? (
        <section className="rounded-lg bg-slate-900 p-4 shadow">
          <div className="flex items-center gap-2 text-cyan-300">
            <Clock3 aria-hidden="true" size={18} />
            <p className="text-sm font-semibold">{locale === 'ko' ? '타이머' : 'Timers'}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-slate-800 px-3 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{locale === 'ko' ? '운동 시간' : 'Session'}</p>
              <p className="mt-1 text-2xl font-bold text-white">{sessionElapsed}</p>
            </div>
            <button
              type="button"
              onClick={() => setRestTimerStartedAt(Date.now())}
              className="rounded-md bg-slate-800 px-3 py-3 text-left"
            >
              <p className="text-xs font-semibold uppercase text-slate-500">{locale === 'ko' ? '휴식 시간' : 'Rest'}</p>
              <p className="mt-1 text-2xl font-bold text-white">{restElapsed}</p>
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'routine')}</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {routineNameLabel(locale, workout?.routineName) ?? t(locale, 'freeWorkout')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {workout?.routineDay
            ? locale === 'ko' ? `${workoutRoutineDayName} 루틴으로 오늘 운동을 시작합니다.` : `${workoutRoutineDayName} is attached as today's starter day.`
            : locale === 'ko' ? '자유 운동입니다. 운동을 직접 추가하세요.' : 'Free workout. Add exercises manually for this session.'}
        </p>
        <label className="mt-4 block text-xs font-medium text-slate-400">
          {locale === 'ko' ? '세션 메모' : 'Session memo'}
          <textarea
            aria-label="Session memo"
            defaultValue={workout?.session.memo ?? ''}
            onBlur={(event) => void handleUpdateSessionMemo(event.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
            placeholder={locale === 'ko' ? '컨디션, 통증, 수면, 코칭 메모' : 'Energy, pain, sleep, or coaching notes'}
          />
        </label>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">{locale === 'ko' ? '운동 기록' : 'Workout Log'}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {logs.length === 0 ? (locale === 'ko' ? '첫 운동을 추가하세요' : 'Add your first exercise') : exerciseCountLabel(locale, logs.length)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAdding((current) => !current);
              resetExerciseFinderState();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400 text-slate-950"
            aria-label="Add exercise"
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        </div>

        {isAdding ? (
          <div className="mt-4">
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

      {/* 가로 스크롤링 운동 미니 네비게이터 */}
      {logs.length > 0 && (
        <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto bg-slate-950/90 backdrop-blur-md px-4 py-3.5 scrollbar-none border-b border-slate-800/80 -mx-4 shadow-md">
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
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                  isCurrentExpanded
                    ? 'bg-cyan-400 text-slate-950 ring-4 ring-cyan-400/20 shadow-lg shadow-cyan-400/10'
                    : allCompleted
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-850'
                }`}
              >
                <span className="text-[13px]">{log.exercise.defaultEmoji}</span>
                <span>{getExerciseName(log.exercise, locale)}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded font-mono ${
                  isCurrentExpanded 
                    ? 'bg-cyan-500/30 text-slate-900' 
                    : allCompleted 
                      ? 'bg-emerald-900/40 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {completedCount}/{totalCount}
                </span>
                {allCompleted && (
                  <Check size={12} className="text-emerald-300 shrink-0 stroke-[3px]" />
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
            className="rounded-lg bg-slate-900 shadow transition-all duration-300 border border-slate-800/80 overflow-hidden"
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
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-850/50 transition-colors"
            >
              <div className="flex flex-col gap-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">{log.exercise.defaultEmoji}</span>
                  <h2 className="text-base font-bold text-white leading-tight">
                    {getExerciseName(log.exercise, locale)}
                  </h2>
                  {allCompleted && (
                    <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60 shrink-0">
                      {locale === 'ko' ? '완료' : 'Done'}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-cyan-400">
                  {completedCount} / {totalCount} Sets
                  {log.workoutExercise.totalVolumeKg > 0 && (
                    <span className="text-slate-400"> • {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500">
                  {isExpanded ? (locale === 'ko' ? '접기' : 'Collapse') : (locale === 'ko' ? '보기' : 'Expand')}
                </span>
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* 아코디언 바디 */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleMoveExercise(log.workoutExercise.id, -1)}
                      disabled={index === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-slate-100 disabled:text-slate-600 hover:bg-slate-750 transition-colors"
                      aria-label={`Move ${log.exercise.nameKo} up`}
                    >
                      <ArrowUp aria-hidden="true" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoveExercise(log.workoutExercise.id, 1)}
                      disabled={index === logs.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-slate-100 disabled:text-slate-600 hover:bg-slate-750 transition-colors"
                      aria-label={`Move ${log.exercise.nameKo} down`}
                    >
                      <ArrowDown aria-hidden="true" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExercise(log.workoutExercise.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-red-300 hover:bg-slate-750 transition-colors"
                      aria-label={`Delete ${log.exercise.nameKo}`}
                    >
                      <Trash2 aria-hidden="true" size={16} />
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
                    className="flex min-h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-750 transition-colors"
                  >
                    <RefreshCw aria-hidden="true" size={14} />
                    <span>{locale === 'ko' ? '교체' : 'Replace'}</span>
                  </button>
                </div>

                <div className="mt-3 rounded-md bg-slate-800 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">{locale === 'ko' ? '이전 기록' : 'Previous'}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-200">
                        {log.previousSummary ?? (locale === 'ko' ? '아직 이전 완료 기록이 없습니다' : 'No previous completed record yet')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyPreviousExercise(log)}
                      disabled={log.previousSets.length === 0}
                      className="min-h-9 shrink-0 rounded-md bg-slate-900 px-3 text-xs font-bold text-cyan-300 disabled:text-slate-600 hover:bg-slate-955 transition-colors"
                    >
                      {locale === 'ko' ? '전체 복사' : 'Copy all'}
                    </button>
                  </div>
                  {log.previousSets.length > 0 ? (
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {log.previousSets.slice(0, 6).map((previousSet) => (
                        <span key={previousSet.id} className="shrink-0 rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-300">
                          {previousSet.weightKg}kg x {previousSet.reps}{previousSet.rir !== undefined ? ` / RIR ${previousSet.rir}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <label className="mt-3 block text-xs font-medium text-slate-400">
                  {locale === 'ko' ? '운동 메모' : 'Exercise memo'}
                  <input
                    aria-label={`${log.exercise.nameKo} memo`}
                    type="text"
                    defaultValue={log.workoutExercise.memo ?? ''}
                    onBlur={(event) => void handleUpdateExerciseMemo(log.workoutExercise.id, event.target.value)}
                    className="mt-1 w-full rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
                    placeholder={locale === 'ko' ? '그립, 템포, 기구, 자세 메모' : 'Grip, tempo, machine, or form notes'}
                  />
                </label>

                {replacingWorkoutExerciseId === log.workoutExercise.id ? (
                  <div className="mt-4">
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

                <div className="mt-4 grid gap-2">
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
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-750 transition-colors"
                >
                  <Plus aria-hidden="true" size={16} />
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
    <div className="rounded-md bg-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-all hover:brightness-110 active:scale-95 ${typeBadges[currentType].className}`}
          aria-label={`Toggle type for Set ${set.setNo}, current: ${currentType}`}
        >
          <span>{locale === 'ko' ? '세트' : 'Set'} {set.setNo}</span>
          <span className="text-[10px] opacity-85 font-medium tracking-wide uppercase">
            {locale === 'ko' ? typeBadges[currentType].labelKo : typeBadges[currentType].labelEn}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {!set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3 ? (
            <span className="rounded bg-red-400/15 px-2 py-1 text-[11px] font-bold text-red-200 border border-red-400/10">
              Hard
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="text-[11px] font-semibold uppercase text-slate-500">
          kg
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', -2.5)}
              className="min-h-10 text-sm font-bold text-slate-300"
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
              className="min-w-0 bg-transparent px-1 py-3 text-center text-base font-bold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'weightKg', 2.5)}
              className="min-h-10 text-sm font-bold text-cyan-300"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.weightKg > 0 && (
            <span className="mt-1 block text-[10px] font-medium text-slate-400 normal-case leading-none">
              {locale === 'ko' ? `지난번: ${previousSet.weightKg}kg` : `Prev: ${previousSet.weightKg}kg`}
            </span>
          )}
        </label>

        <label className="text-[11px] font-semibold uppercase text-slate-500">
          reps
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', -1)}
              className="min-h-10 text-sm font-bold text-slate-300"
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
              className="min-w-0 bg-transparent px-1 py-3 text-center text-base font-bold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'reps', 1)}
              className="min-h-10 text-sm font-bold text-cyan-300"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.reps > 0 && (
            <span className="mt-1 block text-[10px] font-medium text-slate-400 normal-case leading-none">
              {locale === 'ko' ? `지난번: ${previousSet.reps}회` : `Prev: ${previousSet.reps} reps`}
            </span>
          )}
        </label>

        <label className="text-[11px] font-semibold uppercase text-slate-500">
          RIR
          <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-md bg-slate-900">
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', -1)}
              className="min-h-10 text-sm font-bold text-slate-300"
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
              className="min-w-0 bg-transparent px-1 py-3 text-center text-base font-bold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handleQuickAdjustSet(set, 'rir', 1)}
              className="min-h-10 text-sm font-bold text-cyan-300"
            >
              +
            </button>
          </div>
          {previousSet && previousSet.rir !== undefined && (
            <span className="mt-1 block text-[10px] font-medium text-slate-400 normal-case leading-none">
              {locale === 'ko' ? `지난번: RIR ${previousSet.rir}` : `Prev: RIR ${previousSet.rir}`}
            </span>
          )}
        </label>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => void handleToggleWarmup(set)}
          className={`min-h-10 rounded-md px-2 text-xs font-bold ${
            set.isWarmup ? 'bg-amber-300 text-slate-950' : 'bg-slate-900 text-slate-200'
          }`}
        >
          {locale === 'ko' ? '준비' : 'Warmup'}
        </button>
        <button
          type="button"
          onClick={() => void handleToggleHardSet(set)}
          className={`min-h-10 rounded-md px-2 text-xs font-bold ${
            !set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3
              ? 'bg-red-300 text-slate-950'
              : 'bg-slate-900 text-slate-200'
          }`}
        >
          Hard
        </button>
        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`min-h-10 rounded-md px-2 text-xs font-bold ${
            set.isCompleted ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-200'
          }`}
        >
          {set.isCompleted ? (locale === 'ko' ? '완료' : 'Done') : (locale === 'ko' ? '미완료' : 'Open')}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          disabled={!previousSet}
          className="flex min-h-10 items-center justify-center rounded-md bg-slate-900 text-slate-100 disabled:text-slate-600"
          aria-label={`Copy previous workout values to ${log.exercise.nameKo} set ${set.setNo}`}
          title="Copy previous workout set"
        >
          <Copy aria-hidden="true" size={14} />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteSet(set.id)}
          disabled={log.sets.length === 1}
          className="flex min-h-10 items-center justify-center rounded-md bg-slate-900 text-red-300 disabled:text-slate-600"
          aria-label={`Delete ${log.exercise.nameKo} set ${set.setNo}`}
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  );
}
