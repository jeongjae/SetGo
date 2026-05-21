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
    <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-4 shadow-2xl">
      {title ? (
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</p>
      ) : null}
      
      {/* Modern Sticky Search Bar */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800/80 px-3 py-2.5 transition-all focus-within:ring-2 focus-within:ring-cyan-400 focus-within:border-cyan-400">
        <Search aria-hidden="true" size={18} className="shrink-0 text-slate-400" />
        <input
          aria-label={ariaLabel}
          type="search"
          value={state.query}
          onChange={(event) => updateState({ query: event.target.value })}
          placeholder={t(locale, 'searchExercises')}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 font-medium"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onChange(emptyExerciseFinderState)}
            className="min-h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 px-2.5 text-xs font-bold text-slate-200 transition-all"
          >
            {locale === 'ko' ? '초기화' : 'Clear'}
          </button>
        ) : null}
      </div>

      {/* Category Horizontal Snap-Scroll Tag Badges */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scroll-smooth snap-x">
        {categoryFilters.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => updateState({ category: category.value })}
            className={`min-h-9 shrink-0 snap-start flex items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all active:scale-95 ${
              state.category === category.value
                ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-850'
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
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scroll-smooth snap-x">
        {stageFilters.map((stage) => (
          <button
            key={stage.value}
            type="button"
            onClick={() => updateState({ stage: stage.value })}
            className={`min-h-9 shrink-0 snap-start flex items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all active:scale-95 ${
              state.stage === stage.value
                ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-850'
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
      <div className="mt-3 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          {exerciseCountLabel(locale, filteredExercises.length)} {locale === 'ko' ? '검색됨' : 'found'}
        </p>
      </div>

      {/* High-Fidelity Exercises Scroll List */}
      <div className="mt-2.5 max-h-80 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
        {visibleExercises.length === 0 ? (
          <p className="rounded-xl bg-slate-950 border border-slate-900 px-4 py-6 text-center text-sm font-semibold text-slate-400">
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
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-900 px-3.5 py-3 text-left transition-all active:scale-[0.98] group"
              >
                {/* Visual Avatar Square & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Left-Aligned Rounded Square Avatar */}
                  <div className="w-11 h-11 bg-slate-900 border border-slate-800 group-hover:border-cyan-400/40 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-inner transition-colors">
                    {getExerciseIcon(exercise.defaultEmoji)}
                  </div>
                  
                  {/* Exercise Name & Tags */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="block truncate text-sm font-bold text-white tracking-wide group-hover:text-cyan-400 transition-colors">
                        {getExerciseName(exercise, locale)}
                      </span>
                      {isCustom && (
                        <span className="shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          My
                        </span>
                      )}
                    </div>
                    <span className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span className="bg-slate-900 text-slate-400 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-slate-800/80">
                        {getExerciseCategories(exercise)
                          .map((cat) => labelForCategory(cat, locale))
                          .join(' / ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">•</span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {getExerciseStages(exercise)
                          .map((stg) => labelForStage(stg, locale))
                          .join(' / ')}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Right-Aligned Interactive Plus Action Button */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-slate-950 group-hover:border-cyan-400 shadow-sm transition-all">
                  <Plus size={15} strokeWidth={3} />
                </div>
              </button>
            );
          })
        )}
      </div>

      {filteredExercises.length > visibleExercises.length ? (
        <p className="mt-2 rounded-xl bg-slate-950 border border-slate-900 px-3 py-2 text-center text-xs font-semibold text-slate-500">
          {locale === 'ko'
            ? '검색어나 필터를 추가하면 더 빠르게 찾을 수 있습니다.'
            : 'Add a search term or filter to narrow the remaining exercises.'}
        </p>
      ) : null}
    </div>
  );
}
