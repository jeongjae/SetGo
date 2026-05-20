import { ArrowDown, ArrowUp, Check, ChevronLeft, ClipboardList, Clock3, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    if (values.isCompleted === true && !set.isCompleted) {
      const now = Date.now();
      setRestTimerStartedAt(now);
      setRestRemaining(restDuration);
      setIsRestTimerActive(true);
    }
    await loadWorkout();
    setSaveMessage(`${locale === 'ko' ? '저장됨' : 'Saved'} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
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
    values: Partial<Pick<CardioRecord, 'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo'>>,
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

      {logs.map((log, index) => (
        <section key={log.workoutExercise.id} className="rounded-lg bg-slate-900 p-5 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-cyan-300">{log.exercise.defaultEmoji}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{getExerciseName(log.exercise, locale)}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleMoveExercise(log.workoutExercise.id, -1)}
                disabled={index === 0}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-slate-100 disabled:text-slate-600"
                aria-label={`Move ${log.exercise.nameKo} up`}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                onClick={() => void handleMoveExercise(log.workoutExercise.id, 1)}
                disabled={index === logs.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-slate-100 disabled:text-slate-600"
                aria-label={`Move ${log.exercise.nameKo} down`}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteExercise(log.workoutExercise.id)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-red-300"
                aria-label={`Delete ${log.exercise.nameKo}`}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-200">
              {log.workoutExercise.totalVolumeKg.toLocaleString()} kg
            </p>
              <button
                type="button"
                onClick={() => {
                  setReplacingWorkoutExerciseId((current) => (
                    current === log.workoutExercise.id ? undefined : log.workoutExercise.id
                  ));
                  resetExerciseFinderState();
                }}
              className="flex min-h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-semibold text-slate-100"
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
                className="min-h-9 shrink-0 rounded-md bg-slate-900 px-3 text-xs font-bold text-cyan-300 disabled:text-slate-600"
              >
                {locale === 'ko' ? '전체 복사' : 'Copy all'}
              </button>
            </div>
            {log.previousSets.length > 0 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
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
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          >
            <Plus aria-hidden="true" size={16} />
            <span>{locale === 'ko' ? '세트 추가' : 'Add Set'}</span>
          </button>
        </section>
      ))}

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
          {cardioRecords.map((cardioRecord) => {
            const minutes = Math.max(
              1,
              Math.round((new Date(cardioRecord.endedAt).getTime() - new Date(cardioRecord.startedAt).getTime()) / 60000),
            );

            return (
              <div key={cardioRecord.id} className="rounded-md bg-slate-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {cardioRecord.environment === 'indoor' ? cardioRecord.machineType ?? 'indoor' : cardioRecord.location || 'outdoor'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCardio(cardioRecord.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-red-300"
                    aria-label="Delete cardio"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-slate-400">
                    {locale === 'ko' ? '종류' : 'Type'}
                    <select
                      aria-label="Cardio environment"
                      defaultValue={cardioRecord.environment}
                      onChange={(event) => void handleUpdateCardio(cardioRecord, {
                        environment: event.target.value as CardioRecord['environment'],
                      })}
                      className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-sm text-white"
                    >
                      <option value="indoor">{locale === 'ko' ? '실내' : 'Indoor'}</option>
                      <option value="outdoor">{locale === 'ko' ? '야외' : 'Outdoor'}</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-400">
                    {locale === 'ko' ? '기구 / 장소' : 'Machine / place'}
                    <input
                      aria-label="Cardio machine or place"
                      type="text"
                      defaultValue={cardioRecord.environment === 'indoor' ? cardioRecord.machineType ?? '' : cardioRecord.location ?? ''}
                      onBlur={(event) => void handleUpdateCardio(cardioRecord, cardioRecord.environment === 'indoor'
                        ? { machineType: event.target.value as CardioRecord['machineType'] }
                        : { location: event.target.value })}
                      className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-400">
                    Km
                    <input
                      aria-label="Cardio distance"
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      defaultValue={cardioRecord.distanceKm || ''}
                      onBlur={(event) => void handleUpdateCardio(cardioRecord, {
                        distanceKm: Number(event.target.value) || undefined,
                      })}
                      className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-400">
                    Minutes
                    <input
                      aria-label="Cardio minutes"
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="done"
                      defaultValue={minutes}
                      onBlur={(event) => void handleUpdateCardio(cardioRecord, {
                        endedAt: updateCardioMinutes(cardioRecord, Number(event.target.value) || minutes),
                      })}
                      className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-sm text-white"
                    />
                  </label>
                </div>

                <label className="mt-3 block text-xs font-medium text-slate-400">
                  {locale === 'ko' ? '메모' : 'Memo'}
                  <input
                    aria-label="Cardio memo"
                    type="text"
                    defaultValue={cardioRecord.memo ?? ''}
                    onBlur={(event) => void handleUpdateCardio(cardioRecord, { memo: event.target.value || undefined })}
                    className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-sm text-white"
                  />
                </label>

                <p className="mt-3 text-sm text-slate-300">
                  {cardioRecord.averageSpeedKmh ? `${cardioRecord.averageSpeedKmh} km/h ${locale === 'ko' ? '평균' : 'average'}` : locale === 'ko' ? '거리를 저장하면 평균 속도가 표시됩니다.' : 'Average speed appears after distance is saved.'}
                </p>
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
          onClick={() => void handleCopyPreviousSet(set, log.previousSets[setIndex])}
          disabled={!log.previousSets[setIndex]}
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
