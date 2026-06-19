import { Check, ClipboardList, Plus } from 'lucide-react';

type WorkoutFooterActionsProps = {
  locale: 'ko' | 'en';
  isHistoricalEditMode: boolean;
  isCompletedEditMode: boolean;
  isKeyboardOpen: boolean;
  isAdding: boolean;
  canCompleteWorkout: boolean;
  hasWorkout: boolean;
  finishSummary: string;
  completeHint: string;
  saveLabel: string;
  onToggleAddExercise: () => void;
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
  onToggleAddExercise,
  onCreateRoutineFromWorkout,
  onCancelHistoricalEdit,
  onSaveHistoricalEdit,
  onDoneEditing,
  onCompleteWorkout,
  onSkipWorkout,
}: WorkoutFooterActionsProps) {
  return (
    <footer className="mt-auto flex shrink-0 flex-col gap-2 border-t border-[#D1D1D6] bg-[#F2F2F7] pb-1 pt-2.5">
      {isHistoricalEditMode ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleAddExercise}
              className="ios-button-secondary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
            >
              <Plus aria-hidden="true" size={16} />
              {locale === 'ko' ? '운동 추가' : 'Add exercise'}
            </button>
            <button
              type="button"
              onClick={onCreateRoutineFromWorkout}
              className="ios-button-primary flex min-h-11 items-center justify-center gap-2 px-2 text-xs"
            >
              <ClipboardList aria-hidden="true" size={15} />
              {locale === 'ko' ? '루틴 저장' : 'Save routine'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancelHistoricalEdit}
              className="ios-button-secondary flex min-h-12 items-center justify-center px-4 text-sm"
            >
              {locale === 'ko' ? '취소' : 'Cancel'}
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
            <span>{locale === 'ko' ? '루틴 저장' : 'Save routine'}</span>
          </button>
          <button type="button" onClick={onDoneEditing} className="ios-button-primary flex min-h-12 items-center justify-center px-4 text-sm">
            {locale === 'ko' ? '편집 완료' : 'Done Editing'}
          </button>
        </div>
      ) : (
        <div className={isKeyboardOpen ? 'space-y-0' : 'space-y-1.5'}>
          <div className={`rounded-2xl px-3 transition-all ${
            isKeyboardOpen
              ? 'max-h-0 overflow-hidden py-0 opacity-0'
              : 'py-2 opacity-100'
          } ${
            canCompleteWorkout
              ? 'bg-white'
              : 'bg-[#FFF6DF]'
          }`}>
            <p className={`text-[11px] font-black uppercase ${canCompleteWorkout ? 'text-accent-dark' : 'text-[#1C1C1E]'}`}>
              {locale === 'ko' ? '완료 전 요약' : 'Finish summary'}
            </p>
            <p className="mt-0.5 text-xs font-black leading-snug text-[#1C1C1E]">{finishSummary}</p>
            <p className={`mt-1 text-[11px] font-bold leading-snug ${canCompleteWorkout ? 'text-muted' : 'text-danger'}`}>
              {completeHint}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleAddExercise}
              className={`flex ${isKeyboardOpen ? 'h-10 px-3' : 'h-12 px-3.5'} items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 shrink-0 border ${
                isAdding
                  ? 'border-transparent bg-[#E5E5EA] text-[#1C1C1E]'
                  : 'border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
              }`}
            >
              <Plus size={16} className={`transition-transform duration-300 ${isAdding ? 'rotate-45' : ''}`} />
              <span>{locale === 'ko' ? '운동 추가' : 'Add'}</span>
            </button>

            <button
              type="button"
              onClick={onCompleteWorkout}
              disabled={!hasWorkout || !canCompleteWorkout}
              className={`ios-button-primary flex ${isKeyboardOpen ? 'min-h-10' : 'min-h-12'} flex-1 items-center justify-center gap-1.5 px-4 text-sm disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] disabled:shadow-none`}
            >
              <Check aria-hidden="true" size={16} />
              <span>{locale === 'ko' ? '운동 완료' : 'Complete'}</span>
            </button>

            <button
              type="button"
              onClick={onSkipWorkout}
              disabled={!hasWorkout}
              className={`flex ${isKeyboardOpen ? 'h-10' : 'h-12'} shrink-0 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-extrabold text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95`}
            >
              {locale === 'ko' ? '패스' : 'Skip'}
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
