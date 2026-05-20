import { Search } from 'lucide-react';
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
  limit = 12,
  title,
}: ExerciseFinderProps) {
  const filteredExercises = exercises.filter((exercise) => exerciseMatchesFilters(exercise, state));
  const visibleExercises = filteredExercises.slice(0, limit);
  const hasFilters = state.query.trim().length > 0 || state.category !== 'all' || state.stage !== 'all';
  const remainingCount = Math.max(0, filteredExercises.length - visibleExercises.length);

  function updateState(nextState: Partial<ExerciseFinderState>) {
    onChange({ ...state, ...nextState });
  }

  return (
    <div className="rounded-md bg-slate-800 p-3">
      {title ? (
        <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      ) : null}
      <div className={title ? 'mt-2 flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2' : 'flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2'}>
        <Search aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
        <input
          aria-label={ariaLabel}
          type="search"
          value={state.query}
          onChange={(event) => updateState({ query: event.target.value })}
          placeholder={t(locale, 'searchExercises')}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onChange(emptyExerciseFinderState)}
            className="min-h-8 rounded-md bg-slate-800 px-2 text-xs font-semibold text-slate-200"
          >
            {locale === 'ko' ? '초기화' : 'Clear'}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {categoryFilters.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => updateState({ category: category.value })}
            className={`min-h-8 rounded-md px-3 text-xs font-semibold ${
              state.category === category.value
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-900 text-slate-100'
            }`}
          >
            {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {stageFilters.map((stage) => (
          <button
            key={stage.value}
            type="button"
            onClick={() => updateState({ stage: stage.value })}
            className={`min-h-8 rounded-md px-3 text-xs font-semibold ${
              state.stage === stage.value
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-900 text-slate-100'
            }`}
          >
            {stage.value === 'all' ? t(locale, 'all') : labelForStage(stage.value, locale)}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {exerciseCountLabel(locale, filteredExercises.length)}
        {remainingCount > 0 ? ` / ${visibleExercises.length}${locale === 'ko' ? '개 표시' : ' shown'}` : ''}
      </p>

      <div className="mt-2 max-h-72 overflow-y-auto pr-1">
        <div className="grid gap-2">
          {visibleExercises.length === 0 ? (
            <p className="rounded-md bg-slate-900 px-3 py-3 text-sm text-slate-300">
              {t(locale, 'noMatchingExercises')}
            </p>
          ) : visibleExercises.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onSelect(exercise)}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-900 px-3 py-3 text-left text-sm text-slate-100"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{getExerciseName(exercise, locale)}</span>
                <span className="mt-1 block text-xs text-slate-400">
                  {[...getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)), ...getExerciseStages(exercise).map((stage) => labelForStage(stage, locale))].join(' / ')}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-cyan-300">{exercise.defaultEmoji}</span>
            </button>
          ))}
        </div>
      </div>

      {remainingCount > 0 ? (
        <p className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-400">
          {locale === 'ko'
            ? '검색어나 필터를 추가하면 더 빠르게 찾을 수 있습니다.'
            : 'Add a search term or filter to narrow the remaining exercises.'}
        </p>
      ) : null}
    </div>
  );
}
