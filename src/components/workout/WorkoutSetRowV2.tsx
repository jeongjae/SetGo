import { Check, Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FocusEvent } from 'react';
import type { WorkoutExerciseLog } from '../../db/workouts';
import type { WorkoutSet, WorkoutSetType } from '../../types';

export const WORKOUT_SET_GRID_CLASS = 'grid-cols-[1.65rem_2.75rem_minmax(4.5rem,1fr)_3rem_2.75rem_2.75rem]';

const SET_LABELS_KO: Record<WorkoutSetType, string> = {
  normal: '\uC77C\uBC18',
  warmup: '\uC900\uBE44',
  drop: '\uB4DC\uB86D',
  failure: '\uC2E4\uD328',
};

const SET_LABELS_EN: Record<WorkoutSetType, string> = {
  normal: 'Work',
  warmup: 'Warm',
  drop: 'Drop',
  failure: 'Fail',
};

type WorkoutSetRowV2Props = {
  set: WorkoutSet;
  setIndex: number;
  log: WorkoutExerciseLog;
  locale: 'ko' | 'en';
  compactInputMode?: boolean;
  isCurrentSet?: boolean;
  weightIncrementKg: number;
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

export function parseWorkoutSetDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getSetKindLabel(type: WorkoutSetType | undefined, isWarmup: boolean | undefined, locale: 'ko' | 'en'): string {
  const setType = type || (isWarmup ? 'warmup' : 'normal');
  return locale === 'ko' ? SET_LABELS_KO[setType] : SET_LABELS_EN[setType];
}

export function getNextSetType(type: WorkoutSetType | undefined, isWarmup: boolean | undefined): WorkoutSetType {
  const current = type || (isWarmup ? 'warmup' : 'normal');
  return current === 'warmup' ? 'normal' : 'warmup';
}

export function getProgressLabel(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps'>,
  pastBestWeight?: number,
  pastBestVolume?: number,
): string | undefined {
  if (!set.isCompleted) return undefined;

  const isWeightPr = pastBestWeight !== undefined && pastBestWeight > 0 && set.weightKg >= pastBestWeight;
  const isVolumePr = pastBestVolume !== undefined && pastBestVolume > 0 && (set.weightKg * set.reps) >= pastBestVolume;
  if (isWeightPr && isVolumePr) return 'PR';
  if (isWeightPr) return 'kg PR';
  if (isVolumePr) return 'vol PR';
  return undefined;
}

export function WorkoutSetRowV2({
  set,
  setIndex,
  log,
  locale,
  compactInputMode = false,
  isCurrentSet = false,
  weightIncrementKg,
  handleQuickAdjustSet,
  handleSetChange,
  handleToggleWarmup,
  handleToggleHardSet,
  handleCopyPreviousSet,
  handleDeleteSet,
}: WorkoutSetRowV2Props) {
  const [weight, setWeight] = useState(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '');
  const [rir, setRir] = useState(set.rir !== undefined ? String(set.rir) : '');
  const currentType = set.type || (set.isWarmup ? 'warmup' : 'normal');
  const progressLabel = getProgressLabel(set, log.pastBestWeight, log.pastBestVolume);
  const isHard = set.isHard === true;

  useEffect(() => {
    setWeight(set.weightKg ? String(set.weightKg) : '');
  }, [set.weightKg]);

  useEffect(() => {
    setReps(set.reps ? String(set.reps) : '');
  }, [set.reps]);

  useEffect(() => {
    setRir(set.rir !== undefined ? String(set.rir) : '');
  }, [set.rir]);

  const previousSet = useMemo(() => {
    if (!log.previousSets || log.previousSets.length === 0) return undefined;

    const sameTypeSets = log.sets.filter((item) => (item.type || (item.isWarmup ? 'warmup' : 'normal')) === currentType);
    const relativeIndex = sameTypeSets.indexOf(set);
    if (relativeIndex === -1) return log.previousSets[setIndex];

    const sameTypePreviousSets = log.previousSets.filter((item) => (item.type || (item.isWarmup ? 'warmup' : 'normal')) === currentType);
    return sameTypePreviousSets[relativeIndex] ?? log.previousSets[setIndex];
  }, [currentType, log.previousSets, log.sets, set, setIndex]);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleEnterKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const currentTabIndex = Number(event.currentTarget.getAttribute('tabindex'));
    const nextInput = document.querySelector(`[tabindex="${currentTabIndex + 1}"]`) as HTMLInputElement | null;
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    } else {
      event.currentTarget.blur();
    }
  };

  async function handleToggleSetType() {
    const nextType = getNextSetType(set.type, set.isWarmup);
    await handleSetChange(set, {
      type: nextType,
      isWarmup: nextType === 'warmup',
    });
  }

  const rowTone = set.isCompleted
    ? 'border-[#2EC4B6]/35 bg-[#F4FBFA]'
    : isCurrentSet
      ? 'border-[#007AFF]/65 bg-[#EAF4FF] shadow-[0_2px_10px_rgba(0,122,255,0.12)]'
      : 'border-[#D1D1D6] bg-white';
  const rowShadow = isCurrentSet ? '' : 'shadow-[0_1px_5px_rgba(0,0,0,0.03)]';

  return (
    <div className={`rounded-xl border ${rowTone} px-2.5 ${rowShadow} ${compactInputMode ? 'py-1.5' : 'py-2'}`}>
      <div className={`grid ${WORKOUT_SET_GRID_CLASS} items-center gap-1`}>
        <div className={`flex h-11 w-full items-center justify-center text-sm font-black ${isCurrentSet ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>
          {set.setNo}
        </div>

        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex h-11 w-full items-center justify-center rounded-lg text-[10px] font-black leading-none transition-all active:scale-95 ${
            currentType === 'warmup'
              ? 'border border-yellow-200 bg-yellow-50 text-yellow-800'
              : currentType === 'failure'
                ? 'border border-rose-100 bg-[#FFECEC] text-danger'
                : currentType === 'drop'
                  ? 'border border-accent/20 bg-[#E8F3F3] text-accent-dark'
                  : 'border border-black/5 bg-[#F2F2F7] text-[#1C1C1E]'
          }`}
          aria-label={`Set ${set.setNo} type: ${currentType}`}
        >
          {getSetKindLabel(set.type, set.isWarmup, locale)}
        </button>

        <div className="grid h-11 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] overflow-hidden rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] focus-within:border-accent">
          <button
            type="button"
            onClick={() => void handleQuickAdjustSet(set, 'weightKg', -weightIncrementKg)}
            className="flex items-center justify-center border-r border-[#D1D1D6] text-[#6E6E73] active:bg-[#E5E5EA]"
            aria-label={`Decrease weight by ${weightIncrementKg}kg`}
          >
            <Minus aria-hidden="true" size={13} />
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
            onChange={(event) => setWeight(event.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleEnterKey}
            onBlur={() => {
              const nextWeight = parseWorkoutSetDecimalInput(weight) ?? 0;
              if (nextWeight !== set.weightKg) void handleSetChange(set, { weightKg: nextWeight });
            }}
            className="min-w-0 bg-transparent px-0.5 text-center text-base font-black tabular-nums text-[#1C1C1E] outline-none placeholder:text-[#A0A3AA]"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => void handleQuickAdjustSet(set, 'weightKg', weightIncrementKg)}
            className="flex items-center justify-center border-l border-[#D1D1D6] text-accent-dark active:bg-[#E5E5EA]"
            aria-label={`Increase weight by ${weightIncrementKg}kg`}
          >
            <Plus aria-hidden="true" size={13} />
          </button>
        </div>

        <input
          id={`reps_input_${set.id}`}
          data-we-id={log.workoutExercise.id}
          aria-label={`${log.exercise.nameKo} set ${set.setNo} reps`}
          type="text"
          inputMode="numeric"
          enterKeyHint="next"
          tabIndex={setIndex * 3 + 2}
          value={reps}
          onChange={(event) => setReps(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleEnterKey}
          onBlur={() => {
            const nextReps = Math.round(Number(reps)) || 0;
            if (nextReps !== set.reps) void handleSetChange(set, { reps: nextReps });
          }}
          className="h-11 w-full rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] px-1 text-center text-base font-black tabular-nums text-[#1C1C1E] outline-none placeholder:text-[#A0A3AA] focus:border-accent"
          placeholder="0"
        />

        <input
          id={`rir_input_${set.id}`}
          data-we-id={log.workoutExercise.id}
          aria-label={`${log.exercise.nameKo} set ${set.setNo} RIR`}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          tabIndex={setIndex * 3 + 3}
          value={rir}
          onChange={(event) => setRir(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleEnterKey}
          onBlur={() => {
            const nextRir = rir === '' ? undefined : Number(rir) || 0;
            if (nextRir !== set.rir) void handleSetChange(set, { rir: nextRir });
          }}
          className="h-11 w-full rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] px-1 text-center text-base font-black tabular-nums text-[#1C1C1E] outline-none placeholder:text-[#A0A3AA] focus:border-accent"
          placeholder="-"
        />

        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`flex h-11 min-w-11 items-center justify-center rounded-lg transition-all active:scale-95 ${
            set.isCompleted
              ? 'bg-accent text-white'
              : 'border border-[#D1D1D6] bg-white text-[#1C1C1E]'
          }`}
          aria-label={set.isCompleted ? 'Mark set incomplete' : 'Complete set'}
        >
          <Check aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {previousSet ? (
            <span className="inline-flex min-h-8 items-center overflow-hidden rounded-md border border-black/5 bg-[#F2F2F7] text-[10px] font-black text-[#6E6E73]">
              <button
                type="button"
                onClick={() => void handleCopyPreviousSet(set, previousSet)}
                className="flex min-h-8 items-center gap-1 px-2 transition-all hover:bg-[#E8F3F3] hover:text-accent-dark active:scale-[0.98]"
                title={locale === 'ko' ? '\uC774\uC804 \uAE30\uB85D \uBCF5\uC0AC' : 'Copy previous values'}
              >
                <span>{locale === 'ko' ? '\uC774\uC804' : 'Prev'}:</span>
                <span className="font-mono">{previousSet.weightKg}kg x {previousSet.reps}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopyPreviousSet(set, previousSet)}
                className="flex h-8 w-8 items-center justify-center border-l border-black/5 bg-white text-[#6E6E73] hover:text-accent-dark active:bg-[#E5E5EA]"
                aria-label={locale === 'ko' ? '\uC774\uC804 \uAC12 \uBCF5\uC0AC' : 'Copy previous values'}
              >
                <Copy aria-hidden="true" size={12} />
              </button>
            </span>
          ) : (
            <span className="flex min-h-8 items-center rounded-md border border-black/[0.02] bg-[#F2F2F7]/50 px-2 text-[10px] font-bold text-[#C7C7CC]">
              {locale === 'ko' ? '\uC774\uC804 \uC5C6\uC74C' : 'No prev'}
            </span>
          )}
          {progressLabel ? (
            <span className="flex min-h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-[9px] font-black leading-none text-amber-700">
              {progressLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleToggleHardSet(set)}
            className={`flex min-h-8 items-center rounded-md border px-2 text-[9px] font-black leading-none transition-all active:scale-95 ${
              isHard
                ? 'border-rose-200 bg-rose-500 text-white shadow-[0_5px_12px_rgba(244,63,94,0.22)]'
                : 'border-[#D1D1D6] bg-white text-[#6E6E73]'
            }`}
            aria-pressed={isHard}
            aria-label={isHard ? 'Unset hard set' : 'Mark hard set'}
          >
            Hard
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleDeleteSet(set)}
          disabled={log.sets.length === 1}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFECEC] text-danger disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC]"
          aria-label={locale === 'ko' ? '\uC138\uD2B8 \uC0AD\uC81C' : 'Delete set'}
        >
          <Trash2 aria-hidden="true" size={13} />
        </button>
      </div>
    </div>
  );
}
