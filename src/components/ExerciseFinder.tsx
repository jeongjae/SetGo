import { Search, Plus } from 'lucide-react';
import {
  exerciseCategoryOptions,
  exerciseMatchesFilters,
  exerciseStageOptions,
  getExerciseCategories,
  getExerciseName,
  getExerciseStages,
  labelForCategory,
  labelForStage,
} from '../domain/exercises';
import { exerciseCountLabel, t, type AppLocale } from '../i18n/i18n';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage } from '../types';
import { getExerciseIcon } from '../utils/exerciseIcon';

export type ExerciseFinderState = {
  query: string;
  category: ExerciseCategory | 'all';
  stage: ExerciseStage | 'all';
};

type ExerciseFinderProps = {
  ariaLabel: string;
  exercises: ExerciseMaster[];
  locale: AppLocale;
  state: ExerciseFinderState;
  onChange: (state: ExerciseFinderState) => void;
  onSelect: (exercise: ExerciseMaster) => void;
  limit?: number;
  title?: string;
};

const categoryEmojis: Record<string, string> = {
  all: '🌐',
  chest: '🏋️‍♂️',
  back: '🦅',
  shoulder: '🛡️',
  biceps: '💪',
  triceps: '💪',
  legs: '🦵',
  cardio: '🏃‍♂️',
  bodyweight: '🤸‍♂️',
  mobility: '🧘‍♂️',
};

const stageEmojis: Record<string, string> = {
  all: '🌐',
  warmup: '🧘‍♂️',
  main: '🏋️‍♂️',
  cooldown: '🧊',
};

const categoryFilters: Array<{ label: string; value: ExerciseCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  ...exerciseCategoryOptions.map((category) => ({ label: category.label, value: category.value })),
];

const stageFilters: Array<{ label: string; value: ExerciseStage | 'all' }> = [
  { label: 'All', value: 'all' },
  ...exerciseStageOptions.map((stage) => ({ label: stage.label, value: stage.value })),
];

export const emptyExerciseFinderState: ExerciseFinderState = {
  query: '',
  category: 'all',
  stage: 'all',
};

export function ExerciseFinder({
  ariaLabel,
  exercises,
  locale,
  state,
  onChange,
  onSelect,
  limit,
  title,
}: ExerciseFinderProps) {
  const filteredExercises = exercises.filter((exercise) => exerciseMatchesFilters(exercise, state));
  
  // We remove the hard slice limit to allow browsing all matching exercises, but support fallback if passed explicitly.
  const visibleExercises = limit ? filteredExercises.slice(0, limit) : filteredExercises;
  const hasFilters = state.query.trim().length > 0 || state.category !== 'all' || state.stage !== 'all';

  function updateState(nextState: Partial<ExerciseFinderState>) {
    onChange({ ...state, ...nextState });
  }

  return (
    <div className="rounded-2xl border border-slate-650 bg-slate-750/95 p-3.5 shadow-2xl">
      {title ? (
        <p className="mb-2 text-xs font-extrabold uppercase text-slate-200">{title}</p>
      ) : null}
      
      {/* Modern Sticky Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-650 bg-slate-850/90 px-3 py-2 transition-all focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400">
        <Search aria-hidden="true" size={18} className="shrink-0 text-slate-200" />
        <input
          aria-label={ariaLabel}
          type="search"
          value={state.query}
          onChange={(event) => updateState({ query: event.target.value })}
          placeholder={t(locale, 'searchExercises')}
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-white outline-none placeholder:text-slate-400"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onChange(emptyExerciseFinderState)}
            className="min-h-7 rounded-lg bg-slate-650 px-2.5 text-xs font-bold text-slate-100 transition-all hover:bg-slate-600 active:scale-95"
          >
            {locale === 'ko' ? '초기화' : 'Clear'}
          </button>
        ) : null}
      </div>

      {/* Category Horizontal Snap-Scroll Tag Badges */}
      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-650 scroll-smooth snap-x">
        {categoryFilters.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => updateState({ category: category.value })}
            className={`min-h-9 shrink-0 snap-start flex items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-all active:scale-95 ${
              state.category === category.value
                ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20'
                : 'border border-slate-650 bg-slate-850 text-slate-100 hover:bg-slate-700'
            }`}
          >
            <span className="text-sm shrink-0">{categoryEmojis[category.value]}</span>
            <span>
              {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
            </span>
          </button>
        ))}
      </div>

      {/* Stage Horizontal Snap-Scroll Tag Badges */}
      <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-650 scroll-smooth snap-x">
        {stageFilters.map((stage) => (
          <button
            key={stage.value}
            type="button"
            onClick={() => updateState({ stage: stage.value })}
            className={`min-h-9 shrink-0 snap-start flex items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-all active:scale-95 ${
              state.stage === stage.value
                ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20'
                : 'border border-slate-650 bg-slate-850 text-slate-100 hover:bg-slate-700'
            }`}
          >
            <span className="text-sm shrink-0">{stageEmojis[stage.value]}</span>
            <span>
              {stage.value === 'all' ? t(locale, 'all') : labelForStage(stage.value, locale)}
            </span>
          </button>
        ))}
      </div>

      {/* Dynamic Summary Match Count Badge */}
      <div className="mt-2.5 flex items-center justify-between px-1">
        <p className="text-xs font-extrabold uppercase text-slate-200">
          {exerciseCountLabel(locale, filteredExercises.length)} {locale === 'ko' ? '검색됨' : 'found'}
        </p>
      </div>

      {/* High-Fidelity Exercises Scroll List */}
      <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-650">
        {visibleExercises.length === 0 ? (
          <p className="rounded-xl border border-slate-650 bg-slate-850 px-4 py-5 text-center text-sm font-semibold text-slate-200">
            {t(locale, 'noMatchingExercises')}
          </p>
        ) : (
          visibleExercises.map((exercise) => {
            const isCustom = !exercise.isDefault;
            return (
              <button
                key={exercise.id}
                type="button"
                onClick={() => onSelect(exercise)}
                className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-slate-650 bg-slate-850 px-3 py-2.5 text-left transition-all hover:bg-slate-700 active:scale-[0.98]"
              >
                {/* Visual Avatar Square & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Left-Aligned Rounded Square Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-xl shadow-inner transition-colors group-hover:border-cyan-400/40">
                    {getExerciseIcon(exercise.defaultEmoji)}
                  </div>
                  
                  {/* Exercise Name & Tags */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="block truncate text-base font-bold text-white transition-colors group-hover:text-cyan-300">
                        {getExerciseName(exercise, locale)}
                      </span>
                      {isCustom && (
                        <span className="shrink-0 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-amber-300">
                          My
                        </span>
                      )}
                    </div>
                    <span className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span className="rounded-full border border-slate-650 bg-slate-750 px-2 py-0.5 text-xs font-semibold text-slate-100">
                        {getExerciseCategories(exercise)
                          .map((cat) => labelForCategory(cat, locale))
                          .join(' / ')}
                      </span>
                      <span className="text-xs font-bold text-slate-200">•</span>
                      <span className="text-xs font-semibold text-slate-100">
                        {getExerciseStages(exercise)
                          .map((stg) => labelForStage(stg, locale))
                          .join(' / ')}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Right-Aligned Interactive Plus Action Button */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-650 bg-slate-750 text-cyan-300 shadow-sm transition-all group-hover:border-cyan-400 group-hover:bg-cyan-400 group-hover:text-slate-950">
                  <Plus size={15} strokeWidth={3} />
                </div>
              </button>
            );
          })
        )}
      </div>

      {filteredExercises.length > visibleExercises.length ? (
        <p className="mt-2 rounded-xl border border-slate-650 bg-slate-850 px-3 py-2 text-center text-xs font-semibold text-slate-200">
          {locale === 'ko'
            ? '검색어나 필터를 추가하면 더 빠르게 찾을 수 있습니다.'
            : 'Add a search term or filter to narrow the remaining exercises.'}
        </p>
      ) : null}
    </div>
  );
}
