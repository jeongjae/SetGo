import { ArrowDown, ArrowUp, BarChart3, ClipboardList, History, Plus, RefreshCw, Target, Trash2 } from 'lucide-react';
import { ExerciseFinder, type ExerciseFinderState } from '../ExerciseFinder';
import type { WorkoutExerciseLog } from '../../db/workouts';
import { getExerciseName } from '../../domain/exercises';
import type { ExerciseMaster, WorkoutSet } from '../../types';
import { getExerciseIcon } from '../../utils/exerciseIcon';
import { WorkoutSetRowV2, WORKOUT_SET_GRID_CLASS } from './WorkoutSetRowV2';

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
  onAddWarmupSets: (workoutExerciseId: string) => void;
  handleQuickAdjustSet: (set: WorkoutSet, field: 'weightKg' | 'reps' | 'rir', delta: number) => Promise<void>;
  handleSetChange: (
    set: WorkoutSet,
    values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'isCompleted' | 'isWarmup' | 'isHard' | 'type'>>,
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
  isReplacing,
  exerciseFinderState,
  replacementExercises,
  onToggleExpanded,
  onViewHistory,
  onMoveExercise,
  onDeleteExercise,
  onToggleMemo,
  onToggleReplace,
  onUpdateExerciseMemo,
  onExerciseFinderChange,
  onReplaceExercise,
  onAddSet,
  onAddWarmupSets,
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
  const currentSetId = log.sets.find((set) => !set.isCompleted)?.id;
  const targetRecommendation = log.targetRecommendation;
  const weightIncrementKg = log.weightIncrementKg;
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
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F2F2F7] text-xl">
            {getExerciseIcon(log.exercise.defaultEmoji)}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h2 className="min-w-0 truncate text-base font-extrabold leading-tight text-[#1C1C1E]">
                {getExerciseName(log.exercise, locale)}
              </h2>
              <span
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
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#F2F2F7] text-accent-dark transition-all active:scale-90"
                aria-label={locale === 'ko' ? '\uC6B4\uB3D9 \uD788\uC2A4\uD1A0\uB9AC \uBCF4\uAE30' : 'View exercise history'}
              >
                <History aria-hidden="true" size={12} />
              </span>
              {allCompleted ? (
                <span className="shrink-0 rounded-full bg-[#E8F3F3] px-2 py-0.5 text-[11px] font-black text-accent-dark">
                  {locale === 'ko' ? '\uC644\uB8CC' : 'Done'}
                </span>
              ) : null}
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-accent-dark">
              <span>{completedCount} / {totalCount} Sets</span>
              {log.workoutExercise.totalVolumeKg > 0 ? (
                <span className="font-mono font-semibold text-[#8E8E93]">| {log.workoutExercise.totalVolumeKg.toLocaleString()}kg</span>
              ) : null}
              {targetRecommendation && targetSummary ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#2EC4B6]/30 bg-[#E8F3F3] px-1.5 py-0.5 text-[9px] font-black leading-none tracking-tight text-accent-dark">
                  <Target aria-hidden="true" size={10} />
                  {targetRecommendation.weightKg ? `${targetRecommendation.weightKg}kg ` : ''}{targetRecommendation.reps}{locale === 'ko' ? '\uD68C' : 'r'}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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

      {isExpanded ? (
        <div className={`border-t border-[#E5E5EA] bg-white px-3 ${isKeyboardOpen ? 'pb-2 pt-1.5' : 'pb-3 pt-2'}`}>
          <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-[#F2F2F7] pb-2 transition-all duration-300 ${
            isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0 pb-0' : 'max-h-12 opacity-100'
          }`}>
            <div className="flex min-w-0 items-center">
              <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#F2F2F7] px-2 text-[10px] font-black leading-none text-[#6E6E73]">
                {locale === 'ko' ? `\uC911\uB7C9\uB2E8\uC704: ${weightIncrementKg}kg` : `Weight step: ${weightIncrementKg}kg`}
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                type="button"
                onClick={() => onAddWarmupSets(workoutExerciseId)}
                className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#007AFF]/20 bg-[#EAF4FF] px-2 text-[11px] font-extrabold leading-none text-[#007AFF] transition-all hover:bg-[#D5E8FF] active:scale-95"
                title={locale === 'ko' ? '\uC6DC\uC5C5 \uC138\uD2B8 \uC0DD\uC131' : 'Generate warmup sets'}
              >
                <Plus aria-hidden="true" size={13} />
                <span>{locale === 'ko' ? '\uC6DC\uC5C5' : 'Warm'}</span>
              </button>
              <button
                type="button"
                onClick={() => onMoveExercise(workoutExerciseId, -1)}
                disabled={index === 0}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                title={locale === 'ko' ? '\uC704\uB85C \uC774\uB3D9' : 'Move Up'}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onMoveExercise(workoutExerciseId, 1)}
                disabled={index === totalExerciseCount - 1}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                title={locale === 'ko' ? '\uC544\uB798\uB85C \uC774\uB3D9' : 'Move Down'}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => onToggleMemo(workoutExerciseId)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isMemoOpen || hasExerciseMemo
                    ? 'border-transparent bg-[#E8F3F3] text-accent-dark'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
                title={locale === 'ko' ? '\uBA54\uBAA8' : 'Memo'}
              >
                <ClipboardList size={14} />
              </button>
              <button
                type="button"
                onClick={() => onToggleReplace(workoutExerciseId)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isReplacing
                    ? 'border-transparent bg-[#F2F2F7] text-[#6E6E73]'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
                title={locale === 'ko' ? '\uAD50\uCCB4' : 'Replace'}
              >
                <RefreshCw size={13} className={isReplacing ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => onViewHistory(log.exercise.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F3F3] text-accent-dark transition-all hover:bg-[#D8EFEF] active:scale-95"
                title={locale === 'ko' ? '\uAE30\uB85D' : 'History'}
              >
                <BarChart3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDeleteExercise(log)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFECEC] text-danger transition-all hover:bg-[#FFD1D1] active:scale-95"
                title={locale === 'ko' ? '\uC0AD\uC81C' : 'Delete'}
              >
                <Trash2 size={14} />
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
                onBlur={(event) => onUpdateExerciseMemo(workoutExerciseId, event.target.value)}
                className="h-9 min-w-0 rounded-xl border border-[#D1D1D6] bg-[#F2F2F7] px-2 text-sm font-bold text-[#1C1C1E] outline-none transition-all placeholder:text-[#8E8E93] focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder={locale === 'ko' ? '\uADF8\uB9BD, \uC790\uC138, \uC14B\uD305' : 'Grip, setup, cues'}
              />
            </label>
          ) : null}

          {targetRecommendation && targetSummary ? (
            <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-[#2EC4B6]/20 bg-[#E8F3F3] px-3 py-2.5 text-xs font-bold text-accent-dark shadow-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2EC4B6] text-white">
                <Target aria-hidden="true" size={12} />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="leading-tight text-accent-dark">
                  {locale === 'ko' ? '\uCD94\uCC9C \uBAA9\uD45C' : 'Suggested target'}: <span className="font-mono font-black">{targetSummary}</span>
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
                title={locale === 'ko' ? '\uAD50\uCCB4 \uC6B4\uB3D9 \uCC3E\uAE30' : 'Find replacement'}
              />
            </div>
          ) : null}

          <div className={`${isKeyboardOpen ? 'mt-1' : 'mt-2'} flex flex-col ${isKeyboardOpen ? 'gap-1' : 'gap-1.5'}`}>
            {log.sets.length > 0 && (
              <div className={`grid ${WORKOUT_SET_GRID_CLASS} gap-1 px-2.5 pb-1 text-center text-[10px] font-black uppercase text-[#8E8E93]`}>
                <div className="truncate">#</div>
                <div className="truncate">{locale === 'ko' ? '\uAD6C\uBD84' : 'Type'}</div>
                <div className="truncate">kg</div>
                <div className="truncate">{locale === 'ko' ? '\uD69F\uC218' : 'Reps'}</div>
                <div className="truncate">RIR</div>
                <div className="truncate">{locale === 'ko' ? '\uC644\uB8CC' : 'Done'}</div>
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
                isCurrentSet={set.id === currentSetId}
                weightIncrementKg={weightIncrementKg}
                handleQuickAdjustSet={handleQuickAdjustSet}
                handleSetChange={handleSetChange}
                handleToggleWarmup={handleToggleWarmup}
                handleToggleHardSet={handleToggleHardSet}
                handleCopyPreviousSet={handleCopyPreviousSet}
                handleDeleteSet={handleDeleteSet}
              />
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onAddSet(workoutExerciseId)}
              className="ios-button-secondary flex-1 flex min-h-11 items-center justify-center gap-2 px-3 text-sm"
            >
              <Plus aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '\uC138\uD2B8 \uCD94\uAC00' : 'Add Set'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
