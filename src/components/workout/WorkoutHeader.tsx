import { ChevronLeft, Clock3 } from 'lucide-react';

type WorkoutHeaderProps = {
  locale: 'ko' | 'en';
  isKeyboardOpen: boolean;
  isCompletedEditMode: boolean;
  workoutStatusLabel: string;
  workoutTitle: string;
  sessionElapsed?: string;
  workoutDate?: string;
  isRestTimerActive: boolean;
  restRemaining: number;
  restElapsed: string;
  totalStrengthVolumeKg?: number;
  saveMessage: string;
  completedExerciseCount: number;
  exerciseCount: number;
  completedSetCount: number;
  totalSetCount: number;
  onBack: () => void;
  onRestartRestTimer: () => void;
  formatCountdownSeconds: (seconds: number) => string;
};

export function WorkoutHeader({
  locale,
  isKeyboardOpen,
  isCompletedEditMode,
  workoutStatusLabel,
  workoutTitle,
  sessionElapsed,
  workoutDate,
  isRestTimerActive,
  restRemaining,
  restElapsed,
  totalStrengthVolumeKg,
  saveMessage,
  completedExerciseCount,
  exerciseCount,
  completedSetCount,
  totalSetCount,
  onBack,
  onRestartRestTimer,
  formatCountdownSeconds,
}: WorkoutHeaderProps) {
  return (
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
            <p className="text-xs font-black uppercase leading-none text-accent-dark">{workoutStatusLabel}</p>
            <h1 className={`${isKeyboardOpen ? 'max-w-[132px] text-base' : 'mt-0.5 max-w-[150px] text-lg'} truncate font-extrabold leading-tight text-[#1C1C1E] md:max-w-[210px]`}>
              {workoutTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isCompletedEditMode && sessionElapsed ? (
            <div className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm">
              <Clock3 size={13} className="text-[#6E6E73]" />
              <span className="font-mono tracking-wide">{sessionElapsed}</span>
            </div>
          ) : workoutDate && !isCompletedEditMode ? (
            <div className="rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm">
              <span className="font-mono">{workoutDate}</span>
            </div>
          ) : null}
          {isRestTimerActive && restRemaining > 0 ? (
            <button
              type="button"
              onClick={onRestartRestTimer}
              className="flex items-center gap-1 rounded-full bg-yellow-200 px-2.5 py-1 text-sm font-bold text-[#1C1C1E] shadow-sm animate-pulse"
            >
              <span>Rest</span>
              <span className="font-mono tracking-wide">{formatCountdownSeconds(restRemaining)}</span>
            </button>
          ) : restElapsed !== '--:--' && !isCompletedEditMode ? (
            <button
              type="button"
              onClick={onRestartRestTimer}
              className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-[#1C1C1E]"
            >
              <span>Rest</span>
              <span className="font-mono tracking-wide">{restElapsed}</span>
            </button>
          ) : null}
          {totalStrengthVolumeKg !== undefined ? (
            <div className="flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-sm font-bold text-accent-dark shadow-sm">
              <span className="font-mono">{totalStrengthVolumeKg.toLocaleString()}kg</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0' : 'mt-0.5 max-h-8 opacity-100'} flex items-center justify-between gap-2 px-0.5 text-xs font-medium text-[#6E6E73] transition-all`}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-dark animate-pulse" />
          <span className="font-semibold text-[#1C1C1E]">{saveMessage}</span>
        </div>
        <div className="font-bold text-[#1C1C1E]">
          {completedExerciseCount}/{exerciseCount} {locale === 'ko' ? '운동' : 'Ex'} / {completedSetCount}/{totalSetCount} {locale === 'ko' ? '세트 완료' : 'Sets'}
        </div>
      </div>
    </header>
  );
}
