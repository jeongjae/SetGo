import { Check, ClipboardList, Plus } from 'lucide-react';
import type { WorkoutFinishSummary } from '../../domain/workoutSession';

type WorkoutFooterActionsProps = {
  locale: 'ko' | 'en';
  isHistoricalEditMode: boolean;
  isCompletedEditMode: boolean;
  isKeyboardOpen: boolean;
  isAdding: boolean;
  canCompleteWorkout: boolean;
  hasWorkout: boolean;
  finishSummary: WorkoutFinishSummary;
  completeHint: string;
  saveLabel: string;
  isRunningOnlyWorkout?: boolean;
  isRestTimerVisible?: boolean;
  onToggleAddExercise: () => void;
  onAddCardio?: () => void;
  onCreateRoutineFromWorkout: () => void;
  onCancelHistoricalEdit: () => void;
  onSaveHistoricalEdit: () => void;
  onDoneEditing: () => void;
  onCompleteWorkout: () => void;
  onSkipWorkout: () => void;
};

export function WorkoutFooterActions({
  locale,
  isHistoricalEditMode,
  isCompletedEditMode,
  isKeyboardOpen,
  isAdding,
  canCompleteWorkout,
  hasWorkout,
  finishSummary,
  completeHint,
  saveLabel,
  isRunningOnlyWorkout = false,
  isRestTimerVisible = false,
  onToggleAddExercise,
  onAddCardio,
  onCreateRoutineFromWorkout,
  onCancelHistoricalEdit,
  onSaveHistoricalEdit,
  onDoneEditing,
  onCompleteWorkout,
  onSkipWorkout,
}: WorkoutFooterActionsProps) {
  return (
    <footer className={`mt-auto flex shrink-0 flex-col gap-2 border-t border-[#D1D1D6] bg-[#F2F2F7] pb-1 pt-2.5 ${isKeyboardOpen ? 'hidden' : ''}`}>
      {isHistoricalEditMode ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleAddExercise}
              className="ios-button-secondary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
            >
              <Plus aria-hidden="true" size={16} />
              {locale === 'ko' ? '\uC6B4\uB3D9 \uCD94\uAC00' : 'Add exercise'}
            </button>
            <button
              type="button"
              onClick={onCreateRoutineFromWorkout}
              className="ios-button-primary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
            >
              <ClipboardList aria-hidden="true" size={15} />
              {locale === 'ko' ? '\uB8E8\uD2F4 \uC800\uC7A5' : 'Save routine'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancelHistoricalEdit}
              className="ios-button-secondary flex min-h-12 items-center justify-center px-4 text-sm"
            >
              {locale === 'ko' ? '\uCDE8\uC18C' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={onSaveHistoricalEdit}
              className="ios-button-primary flex min-h-12 items-center justify-center px-4 text-sm"
            >
              {saveLabel}
            </button>
          </div>
        </>
      ) : isCompletedEditMode ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCreateRoutineFromWorkout}
            className="ios-button-secondary flex min-h-12 items-center justify-center gap-1.5 px-3 text-xs"
          >
            <ClipboardList aria-hidden="true" size={15} />
            <span>{locale === 'ko' ? '\uB8E8\uD2F4 \uC800\uC7A5' : 'Save routine'}</span>
          </button>
          <button type="button" onClick={onDoneEditing} className="ios-button-primary flex min-h-12 items-center justify-center px-4 text-sm">
            {locale === 'ko' ? '\uD3B8\uC9D1 \uC644\uB8CC' : 'Done Editing'}
          </button>
        </div>
      ) : (
        <div className={isKeyboardOpen ? 'space-y-0' : 'space-y-1.5'}>
          <div className={`rounded-2xl px-3 transition-all ${
            isKeyboardOpen
              ? 'max-h-0 overflow-hidden py-0 opacity-0'
              : isRestTimerVisible
                ? 'max-h-0 overflow-hidden py-0 opacity-0'
              : 'py-2 opacity-100'
          } ${
            canCompleteWorkout
              ? 'bg-white'
              : 'bg-[#FFF6DF]'
          }`}>
            <p className={`text-[11px] font-black uppercase ${canCompleteWorkout ? 'text-accent-dark' : 'text-[#1C1C1E]'}`}>
              {locale === 'ko' ? '\uC644\uB8CC \uC804 \uC694\uC57D' : 'Finish summary'}
            </p>
            <p className="mt-0.5 text-xs font-black leading-snug text-[#1C1C1E]">{finishSummary.primaryText}</p>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {finishSummary.metrics.map((metric) => (
                <div key={metric.label} className="min-w-0 rounded-lg bg-[#F2F2F7] px-1.5 py-1 text-center">
                  <p className={`truncate text-[10px] font-black uppercase ${
                    metric.tone === 'success'
                      ? 'text-[#34C759]'
                      : metric.tone === 'accent'
                        ? 'text-[#159A91]'
                        : metric.tone === 'danger'
                          ? 'text-[#FF3B30]'
                          : 'text-[#8E8E93]'
                  }`}>{metric.label}</p>
                  <p className="mt-0.5 truncate text-xs font-black tabular-nums text-[#1C1C1E]">{metric.value}</p>
                </div>
              ))}
            </div>
            <p className={`mt-1 text-[11px] font-bold leading-snug ${canCompleteWorkout ? 'text-muted' : 'text-danger'}`}>
              {completeHint}
            </p>
          </div>
          <div className="flex gap-2">
            {isRunningOnlyWorkout ? (
              <button
                type="button"
                onClick={onAddCardio}
                className={`flex ${isKeyboardOpen ? 'h-10 px-3' : 'h-12 px-3.5'} shrink-0 items-center justify-center gap-1.5 rounded-xl border border-accent-dark bg-[#E8F3F3] text-xs font-extrabold text-accent-dark transition-all active:scale-95`}
              >
                <Plus size={16} />
                <span>{locale === 'ko' ? '\uB7EC\uB2DD \uCD94\uAC00' : 'Add Run'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleAddExercise}
                className={`flex ${isKeyboardOpen ? 'h-10 px-3' : 'h-12 px-3.5'} shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition-all active:scale-95 ${
                  isAdding
                    ? 'border-transparent bg-[#E5E5EA] text-[#1C1C1E]'
                    : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                }`}
              >
                <Plus size={16} className={`transition-transform duration-300 ${isAdding ? 'rotate-45' : ''}`} />
                <span>{locale === 'ko' ? '\uC6B4\uB3D9 \uCD94\uAC00' : 'Add'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCompleteWorkout}
              disabled={!hasWorkout || !canCompleteWorkout}
              className={`ios-button-primary flex ${isKeyboardOpen ? 'min-h-10' : 'min-h-12'} flex-1 items-center justify-center gap-1.5 px-4 text-sm disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] disabled:shadow-none`}
            >
              <Check aria-hidden="true" size={16} />
              <span>{locale === 'ko' ? '\uC6B4\uB3D9 \uC644\uB8CC' : 'Complete'}</span>
            </button>

            <button
              type="button"
              onClick={onSkipWorkout}
              disabled={!hasWorkout}
              className={`flex ${isKeyboardOpen ? 'h-10' : 'h-12'} shrink-0 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-extrabold text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95`}
            >
              {locale === 'ko' ? '\uD328\uC2A4' : 'Skip'}
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
