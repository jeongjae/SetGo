import { ArrowDown, ArrowUp, Check, ChevronLeft, ClipboardList, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { getRoutineDayDisplayName } from '../db/routines';
import { getExerciseCategories, getExerciseName } from '../domain/exercises';
import { getStoredLocale, t } from '../i18n/i18n';
import {
  addExerciseToWorkout,
  addCardioRecordToWorkout,
  addSetToWorkoutExercise,
  completeWorkoutSession,
  deleteCardioRecord,
  deleteWorkoutExercise,
  deleteWorkoutSet,
  getWorkoutCardioRecords,
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
import type { CardioRecord, ExerciseMaster, WorkoutSet } from '../types';

type WorkoutPageProps = {
  onBack: () => void;
  onCompleted: () => void;
  onSkipped: () => void;
};

export function WorkoutPage({ onBack, onCompleted, onSkipped }: WorkoutPageProps) {
  const [workout, setWorkout] = useState<ActiveWorkout | undefined>();
  const [logs, setLogs] = useState<WorkoutExerciseLog[]>([]);
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [replacingWorkoutExerciseId, setReplacingWorkoutExerciseId] = useState<string | undefined>();
  const [locale] = useState(() => getStoredLocale());
  const [saveMessage, setSaveMessage] = useState(locale === 'ko' ? '로컬 저장됨' : 'Saved locally');

  async function loadWorkout() {
    const todayWorkout = await getTodayWorkout();
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
  }, []);

  async function handleAddExercise(exerciseId: string) {
    if (!workout) return;

    await addExerciseToWorkout(workout.session.id, exerciseId);
    setIsAdding(false);
    await loadWorkout();
  }

  async function handleSetChange(
    set: WorkoutSet,
    values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted'>>,
  ) {
    setSaveMessage(locale === 'ko' ? '저장 중...' : 'Saving...');
    await updateWorkoutSet(set.id, values);
    await loadWorkout();
    setSaveMessage(`${locale === 'ko' ? '저장됨' : 'Saved'} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  async function handleCopyPreviousSet(set: WorkoutSet, previousSet: WorkoutSet | undefined) {
    if (!previousSet) return;

    await updateWorkoutSet(set.id, {
      weightKg: previousSet.weightKg,
      reps: previousSet.reps,
      rir: previousSet.rir,
    });
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '이전 운동 세트를 복사했습니다' : 'Previous workout set copied');
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
    await addSetToWorkoutExercise(workoutExerciseId);
    await loadWorkout();
    setSaveMessage(locale === 'ko' ? '세트를 추가했습니다' : 'Set added');
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
  const totalSetCount = logs.reduce((sum, log) => sum + log.sets.length, 0);
  const completedSetCount = logs.reduce(
    (sum, log) => sum + log.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const workoutRoutineDayName = getRoutineDayDisplayName(workout?.routineDay, locale);
  const completedExerciseCount = logs.filter((log) => log.workoutExercise.status === 'completed').length;

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

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-slate-950">
            <ClipboardList aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{locale === 'ko' ? '세션 상태' : 'Session Status'}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {workout?.session.status ?? (locale === 'ko' ? '불러오는 중...' : 'Loading...')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {workout
                ? `${workout.session.date} / ${workout.session.timeBand} / ${workout.session.totalStrengthVolumeKg.toLocaleString()} kg`
                : locale === 'ko' ? '오늘의 로컬 운동 세션을 불러오는 중입니다.' : "Looking up today's local workout session."}
            </p>
            {workout ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-slate-800 px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{t(locale, 'exercises')}</p>
                  <p className="mt-1 text-sm font-bold text-white">{completedExerciseCount}/{logs.length}</p>
                </div>
                <div className="rounded-md bg-slate-800 px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">Sets</p>
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

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'routine')}</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {workout?.routineName ?? t(locale, 'freeWorkout')}
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
              {logs.length === 0 ? (locale === 'ko' ? '첫 운동을 추가하세요' : 'Add your first exercise') : `${logs.length} ${t(locale, 'exercises')}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400 text-slate-950"
            aria-label="Add exercise"
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        </div>

        {isAdding ? (
          <div className="mt-4 grid gap-2">
            {availableExercises.slice(0, 8).map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => void handleAddExercise(exercise.id)}
                className="flex items-center justify-between rounded-md bg-slate-800 px-3 py-3 text-left text-sm text-slate-100"
              >
                <span>{getExerciseName(exercise, locale)}</span>
                <span className="text-xs font-semibold text-cyan-300">{exercise.defaultEmoji}</span>
              </button>
            ))}
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
              onClick={() => setReplacingWorkoutExerciseId((current) => (
                current === log.workoutExercise.id ? undefined : log.workoutExercise.id
              ))}
              className="flex min-h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-semibold text-slate-100"
            >
              <RefreshCw aria-hidden="true" size={14} />
              <span>{locale === 'ko' ? '교체' : 'Replace'}</span>
            </button>
          </div>

          <div className="mt-3 rounded-md bg-slate-800 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-slate-500">{locale === 'ko' ? '이전 기록' : 'Previous'}</p>
            <p className="mt-1 text-sm leading-5 text-slate-200">
              {log.previousSummary ?? (locale === 'ko' ? '아직 이전 완료 기록이 없습니다' : 'No previous completed record yet')}
            </p>
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
            <div className="mt-4 grid gap-2">
              {getAvailableExercises(log.exercise.id).slice(0, 8).map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => void handleReplaceExercise(log.workoutExercise.id, exercise.id)}
                  className="flex items-center justify-between rounded-md bg-slate-800 px-3 py-3 text-left text-sm text-slate-100"
                >
                  <span>{getExerciseName(exercise, locale)}</span>
                  <span className="text-xs font-semibold text-cyan-300">{exercise.defaultEmoji}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {log.sets.map((set, setIndex) => (
              <div key={set.id} className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem_2rem_2rem] items-center gap-2">
                <span className="text-sm font-semibold text-slate-400">{set.setNo}</span>
                <input
                  aria-label={`${log.exercise.nameKo} set ${set.setNo} weight`}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  defaultValue={set.weightKg || ''}
                  placeholder="kg"
                  onBlur={(event) => void handleSetChange(set, { weightKg: Number(event.target.value) || 0 })}
                  className="min-w-0 rounded-md bg-slate-800 px-2 py-3 text-center text-sm text-white"
                />
                <input
                  aria-label={`${log.exercise.nameKo} set ${set.setNo} reps`}
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  defaultValue={set.reps || ''}
                  placeholder="reps"
                  onBlur={(event) => void handleSetChange(set, { reps: Number(event.target.value) || 0 })}
                  className="min-w-0 rounded-md bg-slate-800 px-2 py-3 text-center text-sm text-white"
                />
                <input
                  aria-label={`${log.exercise.nameKo} set ${set.setNo} RIR`}
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  defaultValue={set.rir ?? ''}
                  placeholder="RIR"
                  onBlur={(event) => {
                    const value = event.target.value;
                    void handleSetChange(set, { rir: value === '' ? undefined : Number(value) || 0 });
                  }}
                  className="min-w-0 rounded-md bg-slate-800 px-2 py-3 text-center text-sm text-white"
                />
                <input
                  aria-label={`${log.exercise.nameKo} set ${set.setNo} completed`}
                  type="checkbox"
                  checked={Boolean(set.isCompleted)}
                  onChange={(event) => void handleSetChange(set, { isCompleted: event.target.checked })}
                  className="h-6 w-6 accent-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyPreviousSet(set, log.previousSets[setIndex])}
                  disabled={!log.previousSets[setIndex]}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-100 disabled:text-slate-600"
                  aria-label={`Copy previous workout values to ${log.exercise.nameKo} set ${set.setNo}`}
                  title="Copy previous workout set"
                >
                  <Copy aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSet(set.id)}
                  disabled={log.sets.length === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-red-300 disabled:text-slate-600"
                  aria-label={`Delete ${log.exercise.nameKo} set ${set.setNo}`}
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </div>
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
    </section>
  );
}
