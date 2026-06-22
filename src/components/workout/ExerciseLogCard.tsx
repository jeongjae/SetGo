import { ArrowDown, ArrowUp, BarChart3, ClipboardList, History, MoreHorizontal, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ExerciseFinder, type ExerciseFinderState } from '../ExerciseFinder';
import type { WorkoutExerciseLog } from '../../db/workouts';
import { getExerciseName } from '../../domain/exercises';
import type { ExerciseMaster, WorkoutSet } from '../../types';
import { getExerciseIcon } from '../../utils/exerciseIcon';
import { WorkoutSetRowV2 } from './WorkoutSetRowV2';

type ExerciseLogCardProps = {
  log: WorkoutExerciseLog;
  index: number;
  totalExerciseCount: number;
  locale: 'ko' | 'en';
  isExpanded: boolean;
  isKeyboardOpen: boolean;
  isMemoOpen: boolean;
  isActionsOpen: boolean;
  isReplacing: boolean;
  exerciseFinderState: ExerciseFinderState;
  replacementExercises: ExerciseMaster[];
  onToggleExpanded: (workoutExerciseId: string) => void;
  onViewHistory: (exerciseId: string) => void;
  onToggleActions: (workoutExerciseId: string) => void;
  onMoveExercise: (workoutExerciseId: string, direction: -1 | 1) => void;
  onDeleteExercise: (log: WorkoutExerciseLog) => void;
  onToggleMemo: (workoutExerciseId: string) => void;
  onToggleReplace: (workoutExerciseId: string) => void;
  onUpdateExerciseMemo: (workoutExerciseId: string, memo: string) => void;
  onExerciseFinderChange: (state: ExerciseFinderState) => void;
  onReplaceExercise: (workoutExerciseId: string, exerciseId: string) => void;
  onAddSet: (workoutExerciseId: string) => void;
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

export function ExerciseLogCard({
  log,
  index,
  totalExerciseCount,
  locale,
  isExpanded,
  isKeyboardOpen,
  isMemoOpen,
  isActionsOpen,
  isReplacing,
  exerciseFinderState,
  replacementExercises,
  onToggleExpanded,
  onViewHistory,
  onToggleActions,
  onMoveExercise,
  onDeleteExercise,
  onToggleMemo,
  onToggleReplace,
  onUpdateExerciseMemo,
  onExerciseFinderChange,
  onReplaceExercise,
  onAddSet,
  handleQuickAdjustSet,
  handleSetChange,
  handleToggleWarmup,
  handleToggleHardSet,
  handleCopyPreviousSet,
  handleDeleteSet,
}: ExerciseLogCardProps) {
  const allCompleted = log.sets.length > 0 && log.sets.every((set) => set.isCompleted);
  const completedCount = log.sets.filter((set) => set.isCompleted).length;
  const totalCount = log.sets.length;
  const hasExerciseMemo = Boolean(log.workoutExercise.memo?.trim());
  const workoutExerciseId = log.workoutExercise.id;
  const targetRecommendation = log.targetRecommendation;
  const targetSummary = targetRecommendation
    ? [
        targetRecommendation.weightKg ? `${targetRecommendation.weightKg}kg` : undefined,
        `${targetRecommendation.reps} reps`,
        `${targetRecommendation.sets} sets`,
        targetRecommendation.rir !== undefined ? `RIR ${targetRecommendation.rir}` : undefined,
      ].filter(Boolean).join(' x ')
    : undefined;

  return (
    <section
      id={`exercise-card-${workoutExerciseId}`}
      className="ios-card scroll-mt-3 overflow-hidden transition-all duration-300"
    >
      <button
        type="button"
        onClick={() => onToggleExpanded(workoutExerciseId)}
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
                onClick={(event) => {
                  event.stopPropagation();
                  onViewHistory(log.exercise.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onViewHistory(log.exercise.id);
                  }
                }}
                className="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#F2F2F7] text-accent-dark transition-all active:scale-90"
                aria-label={locale === 'ko' ? '운동 히스토리 보기' : 'View exercise history'}
              >
                <History aria-hidden="true" size={11} />
              </div>
              {allCompleted ? (
                <span className="shrink-0 rounded-full bg-[#E8F3F3] px-2 py-0.5 text-[11px] font-black text-accent-dark">
                  {locale === 'ko' ? '완료' : 'Done'}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-bold text-accent-dark flex flex-wrap items-center gap-1.5">
              <span>{completedCount} / {totalCount} Sets</span>
              {log.workoutExercise.totalVolumeKg > 0 ? (
                <span className="font-mono font-semibold text-[#8E8E93]">· {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
              ) : null}
              {targetRecommendation && targetSummary ? (
                <span className="rounded-md border border-[#2EC4B6]/30 bg-[#E8F3F3] px-1.5 py-0.5 text-[9px] font-black text-accent-dark tracking-tight leading-none shrink-0">
                  🎯 {targetRecommendation.weightKg ? `${targetRecommendation.weightKg}kg ` : ''}{targetRecommendation.reps}{locale === 'ko' ? '회' : 'r'}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs font-bold uppercase text-[#6E6E73]">
            {isExpanded ? (locale === 'ko' ? '접기' : 'Hide') : (locale === 'ko' ? '열기' : 'Show')}
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

      {isExpanded ? (
        <div className={`border-t border-[#E5E5EA] bg-white px-3 ${isKeyboardOpen ? 'pb-2 pt-1.5' : 'pb-3 pt-2'}`}>
          <div className={`flex items-center justify-between gap-2 border-b border-[#F2F2F7] pb-2 transition-all duration-300 ${
            isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0 pb-0' : 'max-h-10 opacity-100'
          }`}>
            <span className="text-[11px] font-black text-[#8E8E93]">{locale === 'ko' ? '운동 관리' : 'Manage Exercise'}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onMoveExercise(workoutExerciseId, -1)}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                title={locale === 'ko' ? '위로 이동' : 'Move Up'}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onMoveExercise(workoutExerciseId, 1)}
                disabled={index === totalExerciseCount - 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                title={locale === 'ko' ? '아래로 이동' : 'Move Down'}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => onToggleMemo(workoutExerciseId)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isMemoOpen || hasExerciseMemo
                    ? 'border-transparent bg-[#E8F3F3] text-accent-dark'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
                title={locale === 'ko' ? '메모' : 'Memo'}
              >
                <ClipboardList size={14} />
              </button>
              <button
                type="button"
                onClick={() => onToggleReplace(workoutExerciseId)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isReplacing
                    ? 'border-transparent bg-[#F2F2F7] text-[#6E6E73]'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
                title={locale === 'ko' ? '교체' : 'Replace'}
              >
                <RefreshCw size={13} className={isReplacing ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => onViewHistory(log.exercise.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8F3F3] text-accent-dark transition-all hover:bg-[#D8EFEF] active:scale-95"
                title={locale === 'ko' ? '기록' : 'History'}
              >
                <BarChart3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDeleteExercise(log)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFECEC] text-danger transition-all hover:bg-[#FFD1D1] active:scale-95"
                title={locale === 'ko' ? '삭제' : 'Delete'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {isMemoOpen ? (
            <label className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 text-xs font-black uppercase text-[#1C1C1E]">
              <span className="flex min-h-8 min-w-12 items-center justify-center rounded-md border border-violet-300 bg-violet-100 px-2.5 text-violet-950 shadow-sm">
                {locale === 'ko' ? '메모' : 'Memo'}
              </span>
              <input
                aria-label={`${log.exercise.nameKo} memo`}
                type="text"
                defaultValue={log.workoutExercise.memo ?? ''}
                onBlur={(event) => onUpdateExerciseMemo(workoutExerciseId, event.target.value)}
                className="h-8 min-w-0 rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] px-2 text-sm font-bold text-[#1C1C1E] outline-none transition-all placeholder:text-[#8E8E93] focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder={locale === 'ko' ? '그립, 자세, 세팅' : 'Grip, setup, cues'}
              />
            </label>
          ) : null}

          {targetRecommendation && targetSummary ? (
            <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-[#2EC4B6]/20 bg-[#E8F3F3] px-3 py-2.5 text-xs font-bold text-accent-dark shadow-sm">
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#2EC4B6] text-[10px] text-white">🎯</span>
              <div className="space-y-0.5 min-w-0">
                <p className="leading-tight text-accent-dark">
                  {locale === 'ko' ? '추천 목표' : 'Suggested target'}: <span className="font-mono font-black">{targetSummary}</span>
                </p>
                <p className="text-[11px] font-medium leading-tight text-[#6E6E73] truncate">
                  {locale === 'ko' ? '최근 기록과 루틴 목표 기준' : targetRecommendation.reason}
                </p>
              </div>
            </div>
          ) : null}

          {isReplacing ? (
            <div className="mt-3 border-t border-[#E5E5EA] pt-3">
              <ExerciseFinder
                ariaLabel={`Search replacement for ${getExerciseName(log.exercise, locale)}`}
                exercises={replacementExercises}
                locale={locale}
                state={exerciseFinderState}
                onChange={onExerciseFinderChange}
                onSelect={(exercise) => onReplaceExercise(workoutExerciseId, exercise.id)}
                limit={24}
                title={locale === 'ko' ? '교체 운동 찾기' : 'Find replacement'}
              />
            </div>
          ) : null}

          <div className={`${isKeyboardOpen ? 'mt-1' : 'mt-2'} flex flex-col ${isKeyboardOpen ? 'gap-1' : 'gap-1.5'}`}>
            {log.sets.length > 0 && (
              <div className="grid grid-cols-[1.8rem_3rem_minmax(0,1fr)_3.2rem_3rem_2.4rem] gap-1.5 px-[11px] text-center text-[10px] font-black uppercase text-[#8E8E93] pb-1 border-b border-[#F2F2F7]">
                <div className="truncate">#</div>
                <div className="truncate">{locale === 'ko' ? '구분' : 'Type'}</div>
                <div className="truncate">kg</div>
                <div className="truncate">{locale === 'ko' ? '횟수' : 'Reps'}</div>
                <div className="truncate">RIR</div>
                <div className="truncate">{locale === 'ko' ? '완료' : 'Done'}</div>
              </div>
            )}
            {log.sets.map((set, setIndex) => (
              <WorkoutSetRowV2
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
            onClick={() => onAddSet(workoutExerciseId)}
            className="ios-button-secondary mt-2 flex min-h-9 w-full items-center justify-center gap-2 px-3 text-sm"
          >
            <Plus aria-hidden="true" size={15} />
            <span>{locale === 'ko' ? '세트 추가' : 'Add Set'}</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
