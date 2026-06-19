import { Clock3 } from 'lucide-react';

type FloatingRestTimerProps = {
  label: string;
  skipLabel: string;
  remainingSeconds: number;
  durationSeconds: number;
  formatCountdownSeconds: (seconds: number) => string;
  onIncreaseDuration: () => void;
  onDecreaseDuration: () => void;
  onSkip: () => void;
};

export function FloatingRestTimer({
  label,
  skipLabel,
  remainingSeconds,
  durationSeconds,
  formatCountdownSeconds,
  onIncreaseDuration,
  onDecreaseDuration,
  onSkip,
}: FloatingRestTimerProps) {
  const progressPercent = durationSeconds > 0
    ? (remainingSeconds / durationSeconds) * 100
    : 0;

  return (
    <div className="fixed bottom-[4.5rem] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-yellow-400 bg-yellow-200/95 px-3.5 py-3 shadow-2xl shadow-yellow-500/20 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 text-yellow-950 animate-pulse">
            <Clock3 size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-yellow-950">{label}</p>
            <p className="text-lg font-black text-yellow-950 tracking-wider font-mono">
              {formatCountdownSeconds(remainingSeconds)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onIncreaseDuration}
            className="flex h-8 items-center justify-center rounded-lg border border-yellow-500 bg-yellow-50 px-2.5 text-xs font-bold text-yellow-950 transition-all active:scale-95 active:bg-yellow-300"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={onDecreaseDuration}
            className="flex h-8 items-center justify-center rounded-lg border border-yellow-500 bg-yellow-50 px-2.5 text-xs font-bold text-yellow-950 transition-all active:scale-95 active:bg-yellow-300"
          >
            -30s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex h-8 items-center justify-center rounded-lg border border-danger/45 bg-danger/15 px-2.5 text-xs font-black text-danger transition-all hover:bg-danger/25 active:scale-95"
          >
            {skipLabel}
          </button>
        </div>
      </div>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-yellow-100">
        <div
          className="h-full bg-yellow-600 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
