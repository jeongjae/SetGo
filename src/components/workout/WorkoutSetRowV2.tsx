import { Check, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FocusEvent } from 'react';
import type { WorkoutExerciseLog } from '../../db/workouts';
import type { WorkoutSet, WorkoutSetType } from '../../types';

type WorkoutSetRowV2Props = {
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

function parseDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function getSetKindLabel(type: WorkoutSetType | undefined, isWarmup: boolean | undefined, locale: 'ko' | 'en'): string {
  const setType = type || (isWarmup ? 'warmup' : 'normal');

  if (locale === 'ko') {
    if (setType === 'warmup') return '준비';
    if (setType === 'drop') return '드롭';
    if (setType === 'failure') return '실패';
    return '일반';
  }

  if (setType === 'warmup') return 'Warm';
  if (setType === 'drop') return 'Drop';
  if (setType === 'failure') return 'Fail';
  return 'Work';
}

function getNextSetType(type: WorkoutSetType | undefined, isWarmup: boolean | undefined): WorkoutSetType {
  const current = type || (isWarmup ? 'warmup' : 'normal');
  const nextTypes: Record<WorkoutSetType, WorkoutSetType> = {
    normal: 'warmup',
    warmup: 'drop',
    drop: 'failure',
    failure: 'normal',
  };

  return nextTypes[current];
}

function getProgressLabel(
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
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const currentType = set.type || (set.isWarmup ? 'warmup' : 'normal');
  const progressLabel = getProgressLabel(set, log.pastBestWeight, log.pastBestVolume);

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

  const referenceText = previousSet
    ? `${previousSet.weightKg}kg x ${previousSet.reps}${previousSet.rir !== undefined ? ` / RIR ${previousSet.rir}` : ''}`
    : locale === 'ko' ? '이전 없음' : 'No previous';

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
    window.setTimeout(() => {
      event.currentTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
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
    : 'border-[#D1D1D6] bg-white';

  return (
    <div className={`rounded-xl border ${rowTone} px-2.5 shadow-[0_1px_5px_rgba(0,0,0,0.03)] ${compactInputMode ? 'py-1' : 'py-2'}`}>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.9rem_2.7rem_2.6rem_2.4rem] items-center gap-1.5">
        <button
          type="button"
          onClick={() => void handleToggleSetType()}
          className={`flex h-10 flex-col items-center justify-center rounded-lg text-[10px] font-black leading-none transition-all active:scale-95 ${
            currentType === 'warmup'
              ? 'bg-yellow-100 text-yellow-800'
              : currentType === 'failure'
                ? 'bg-[#FFECEC] text-danger'
                : currentType === 'drop'
                  ? 'bg-[#E8F3F3] text-accent-dark'
                  : 'bg-[#F2F2F7] text-[#1C1C1E]'
          }`}
          aria-label={`Set ${set.setNo} type: ${currentType}`}
        >
          <span>{set.setNo}</span>
          <span className="mt-0.5 truncate">{getSetKindLabel(set.type, set.isWarmup, locale)}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleCopyPreviousSet(set, previousSet)}
          disabled={!previousSet}
          className="min-w-0 rounded-lg bg-[#F2F2F7] px-2 py-1.5 text-left transition-all active:scale-[0.99] disabled:text-[#8E8E93]"
          aria-label={locale === 'ko' ? '이전 세트 값 복사' : 'Copy previous set values'}
        >
          <span className="block truncate text-[10px] font-black uppercase text-[#6E6E73]">
            {locale === 'ko' ? '이전' : 'Prev'}
          </span>
          <span className="block truncate text-[11px] font-black text-[#1C1C1E]">{referenceText}</span>
        </button>

        <label className="min-w-0 text-[10px] font-black uppercase leading-none text-[#6E6E73]">
          kg
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
              const nextWeight = parseDecimalInput(weight) ?? 0;
              if (nextWeight !== set.weightKg) void handleSetChange(set, { weightKg: nextWeight });
            }}
            className="mt-0.5 h-9 w-full rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] px-1 text-center text-sm font-black text-[#1C1C1E] outline-none focus:border-accent"
            placeholder="kg"
          />
        </label>

        <label className="min-w-0 text-[10px] font-black uppercase leading-none text-[#6E6E73]">
          reps
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
            className="mt-0.5 h-9 w-full rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] px-1 text-center text-sm font-black text-[#1C1C1E] outline-none focus:border-accent"
            placeholder="0"
          />
        </label>

        <label className="min-w-0 text-[10px] font-black uppercase leading-none text-[#6E6E73]">
          RIR
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
            className="mt-0.5 h-9 w-full rounded-lg border border-[#D1D1D6] bg-[#F2F2F7] px-1 text-center text-sm font-black text-[#1C1C1E] outline-none focus:border-accent"
            placeholder="-"
          />
        </label>

        <button
          type="button"
          onClick={() => void handleSetChange(set, { isCompleted: !set.isCompleted })}
          className={`flex h-10 items-center justify-center rounded-lg transition-all active:scale-95 ${
            set.isCompleted
              ? 'bg-accent text-white'
              : 'border border-[#D1D1D6] bg-white text-[#1C1C1E]'
          }`}
          aria-label={set.isCompleted ? 'Mark set incomplete' : 'Complete set'}
        >
          <Check aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {progressLabel ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
              {progressLabel}
            </span>
          ) : null}
          {!set.isWarmup && set.isCompleted && set.rir !== undefined && set.rir <= 3 ? (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-600">
              Hard
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsActionsOpen((current) => !current)}
            className="flex h-7 items-center gap-1 rounded-lg border border-[#D1D1D6] bg-white px-2 text-[11px] font-black text-[#1C1C1E]"
            aria-expanded={isActionsOpen}
            aria-label={locale === 'ko' ? '세트 추가 작업' : 'More set actions'}
          >
            <MoreHorizontal aria-hidden="true" size={13} />
            {locale === 'ko' ? '더보기' : 'More'}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void handleQuickAdjustSet(set, 'weightKg', -2.5)}
            className="h-7 rounded-lg border border-[#D1D1D6] bg-white px-2 text-[11px] font-black text-[#6E6E73]"
          >
            -2.5
          </button>
          <button
            type="button"
            onClick={() => void handleQuickAdjustSet(set, 'weightKg', 2.5)}
            className="h-7 rounded-lg border border-[#D1D1D6] bg-white px-2 text-[11px] font-black text-accent-dark"
          >
            +2.5
          </button>
        </div>
      </div>

      {isActionsOpen ? (
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => void handleToggleWarmup(set)}
            className="min-h-8 rounded-lg border border-[#D1D1D6] bg-white px-2 text-[11px] font-black text-[#1C1C1E]"
          >
            {locale === 'ko' ? '준비' : 'Warm'}
          </button>
          <button
            type="button"
            onClick={() => void handleToggleHardSet(set)}
            className="min-h-8 rounded-lg border border-[#D1D1D6] bg-white px-2 text-[11px] font-black text-[#1C1C1E]"
          >
            Hard
          </button>
          <button
            type="button"
            onClick={() => void handleCopyPreviousSet(set, previousSet)}
            disabled={!previousSet}
            className="flex min-h-8 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] disabled:text-[#C7C7CC]"
            aria-label={locale === 'ko' ? '이전 값 복사' : 'Copy previous values'}
          >
            <Copy aria-hidden="true" size={13} />
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSet(set)}
            disabled={log.sets.length === 1}
            className="flex min-h-8 items-center justify-center rounded-lg bg-[#FFECEC] text-danger disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC]"
            aria-label={locale === 'ko' ? '세트 삭제' : 'Delete set'}
          >
            <Trash2 aria-hidden="true" size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
