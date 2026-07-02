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
    <header className={`shrink-0 flex flex-col border-b border-sg-border ${isKeyboardOpen ? 'gap-1 pb-1.5' : 'gap-1.5 pb-2.5'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sg-border bg-sg-surface text-sg-label shadow-sm transition-all hover:bg-sg-fill active:scale-95"
            aria-label="Back to Today"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase leading-none text-sg-brand-strong">{workoutStatusLabel}</p>
            <h1 className={`${isKeyboardOpen ? 'max-w-[132px] text-base' : 'mt-0.5 max-w-[150px] text-lg'} truncate font-extrabold leading-tight text-sg-label md:max-w-[210px]`}>
              {workoutTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isCompletedEditMode && sessionElapsed ? (
            <div className="flex items-center gap-1 rounded-full border border-sg-border bg-sg-surface px-2.5 py-1 text-sm font-bold text-sg-label shadow-sm">
              <Clock3 size={13} className="text-sg-secondary-label" />
              <span className="font-mono tracking-wide">{sessionElapsed}</span>
            </div>
          ) : workoutDate && !isCompletedEditMode ? (
            <div className="rounded-full border border-sg-border bg-sg-surface px-2.5 py-1 text-sm font-bold text-sg-label shadow-sm">
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
              className="flex items-center gap-1 rounded-full border border-sg-border bg-sg-surface px-2.5 py-1 text-sm font-bold text-sg-label"
            >
              <span>Rest</span>
              <span className="font-mono tracking-wide">{restElapsed}</span>
            </button>
          ) : null}
          {totalStrengthVolumeKg !== undefined ? (
            <div className="flex items-center gap-1 rounded-full border border-sg-border bg-sg-surface px-2.5 py-1 text-sm font-bold text-sg-brand-strong shadow-sm">
              <span className="font-mono">{totalStrengthVolumeKg.toLocaleString()}kg</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${isKeyboardOpen ? 'max-h-0 overflow-hidden opacity-0' : 'mt-0.5 max-h-8 opacity-100'} flex items-center justify-between gap-2 px-0.5 text-xs font-medium text-sg-secondary-label transition-all`}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sg-brand-strong animate-pulse" />
          <span className="font-semibold text-sg-label">{saveMessage}</span>
        </div>
        <div className="font-bold text-sg-label">
          {completedExerciseCount}/{exerciseCount} {locale === 'ko' ? '\uC6B4\uB3D9' : 'Ex'} / {completedSetCount}/{totalSetCount} {locale === 'ko' ? '\uC138\uD2B8 \uC644\uB8CC' : 'Sets'}
        </div>
      </div>
    </header>
  );
}
