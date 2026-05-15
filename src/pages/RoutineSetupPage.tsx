import { ArrowDown, ArrowUp, Check, ChevronLeft, EyeOff, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { seedDefaultExercises } from '../db/seed';
import {
  exerciseCategoryOptions,
  exerciseStageOptions,
  getExerciseCategories,
  getExerciseName,
  getExerciseStages,
  labelForCategory,
  labelForStage,
} from '../domain/exercises';
import { getStoredLocale, saveStoredLocale, t, type AppLocale } from '../i18n/i18n';
import {
  activateRoutineTemplate,
  addExerciseToRoutineDay,
  deleteRoutineExercisePlan,
  ensureActiveRoutineTemplateVersion,
  getActiveRoutine,
  getActiveRoutineDayPlans,
  getActiveWeeklySchedule,
  getRoutineDayDisplayName,
  getRoutineTemplateName,
  getRoutineTemplateSummary,
  getRoutineSplitName,
  moveRoutineExercisePlan,
  resetActiveRoutinePlansToTemplate,
  routineTemplates,
  saveWeeklyScheduleDay,
  updateActiveRoutineName,
  updateRoutineExercisePlan,
  updateRoutineDayName,
  type RoutineDayPlan,
  type WeeklyScheduleView,
} from '../db/routines';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage, Routine, RoutineExercisePlan, RoutineSplitType, Weekday } from '../types';

type RoutineSetupPageProps = {
  onBack: () => void;
  onRoutineSaved: () => void;
};

const weekdayLabels = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const exerciseCategories: Array<{ label: string; value: ExerciseCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  ...exerciseCategoryOptions.map((category) => ({ label: category.label, value: category.value })),
];
type SetupTab = 'routine' | 'library' | 'schedule';

export function RoutineSetupPage({ onBack, onRoutineSaved }: RoutineSetupPageProps) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [savingSplitType, setSavingSplitType] = useState<RoutineSplitType | undefined>();
  const [dayPlans, setDayPlans] = useState<RoutineDayPlan[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseMaster[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleView[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>();
  const [addingDayId, setAddingDayId] = useState<string | undefined>();
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [routineAddSearch, setRoutineAddSearch] = useState('');
  const [routineAddCategoryFilter, setRoutineAddCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseNameEn, setNewExerciseNameEn] = useState('');
  const [newExerciseCategory, setNewExerciseCategory] = useState<ExerciseCategory>('chest');
  const [editingExerciseId, setEditingExerciseId] = useState<string | undefined>();
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const [setupTab, setSetupTab] = useState<SetupTab>('routine');

  async function loadSetup() {
    await seedDefaultExercises();
    await ensureActiveRoutineTemplateVersion();

    const [routine, plans, schedule, exerciseMasters, allExerciseMasters] = await Promise.all([
      getActiveRoutine(),
      getActiveRoutineDayPlans(),
      getActiveWeeklySchedule(),
      db.exercises.filter((exercise) => exercise.isActive && !getExerciseCategories(exercise).includes('cardio')).toArray(),
      db.exercises.filter((exercise) => exercise.isActive).toArray(),
    ]);

    setActiveRoutine(routine);
    setDayPlans(plans);
    setWeeklySchedule(schedule);
    setExercises(exerciseMasters);
    setExerciseLibrary(allExerciseMasters);
    setSelectedDayId((current) => current ?? plans[0]?.routineDay.id);
  }

  useEffect(() => {
    void loadSetup();
  }, []);

  async function handleActivate(splitType: RoutineSplitType) {
    const template = routineTemplates.find((item) => item.splitType === splitType);
    if (!template) return;

    setSavingSplitType(splitType);
    const routine = await activateRoutineTemplate(template);
    setActiveRoutine(routine);
    setSelectedDayId(undefined);
    setSavingSplitType(undefined);
    onRoutineSaved();
    await loadSetup();
  }

  async function handleAddExercise(routineDayId: string, exerciseId: string) {
    await addExerciseToRoutineDay(routineDayId, exerciseId);
    setAddingDayId(undefined);
    setRoutineAddSearch('');
    await loadSetup();
  }

  async function handleDeletePlan(planId: string) {
    await deleteRoutineExercisePlan(planId);
    await loadSetup();
  }

  async function handleUpdatePlan(
    planId: string,
    values: Partial<Pick<RoutineExercisePlan, 'plannedSets' | 'plannedWeightKg' | 'plannedReps' | 'plannedRir'>>,
  ) {
    await updateRoutineExercisePlan(planId, values);
    await loadSetup();
  }

  async function handleWeeklyScheduleChange(weekday: Weekday, routineDayId: string) {
    await saveWeeklyScheduleDay(weekday, routineDayId || undefined);
    await loadSetup();
  }

  async function handleUpdateRoutineName(name: string) {
    await updateActiveRoutineName(name);
    onRoutineSaved();
    await loadSetup();
  }

  async function handleUpdateRoutineDayName(routineDayId: string, name: string) {
    await updateRoutineDayName(routineDayId, name);
    onRoutineSaved();
    await loadSetup();
  }

  async function handleMovePlan(planId: string, direction: -1 | 1) {
    await moveRoutineExercisePlan(planId, direction);
    await loadSetup();
  }

  async function handleResetRoutineTemplate() {
    await resetActiveRoutinePlansToTemplate();
    onRoutineSaved();
    await loadSetup();
  }

  async function handleCreateExercise() {
    const name = newExerciseName.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const id = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`;

    await db.exercises.put({
      id,
      nameKo: name,
      nameEn: newExerciseNameEn.trim() || name,
      stage: 'main',
      stageTags: ['main'],
      category: newExerciseCategory,
      categoryTags: [newExerciseCategory],
      defaultEmoji: newExerciseCategory.slice(0, 2).toUpperCase(),
      isDefault: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    setNewExerciseName('');
    setNewExerciseNameEn('');
    await loadSetup();
  }

  async function handleDeactivateExercise(exerciseId: string) {
    await db.exercises.update(exerciseId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    await loadSetup();
  }

  async function handleUpdateExercise(
    exerciseId: string,
    values: Partial<Pick<ExerciseMaster, 'nameKo' | 'nameEn' | 'description' | 'categoryTags' | 'stageTags'>>,
  ) {
    const existing = await db.exercises.get(exerciseId);
    if (!existing) return;

    const categoryTags = values.categoryTags ?? getExerciseCategories(existing);
    const stageTags = values.stageTags ?? getExerciseStages(existing);
    await db.exercises.update(exerciseId, {
      ...values,
      category: categoryTags[0] ?? existing.category,
      categoryTags,
      stage: stageTags[0] ?? existing.stage,
      stageTags,
      updatedAt: new Date().toISOString(),
    });
    await loadSetup();
  }

  function toggleCategory(exercise: ExerciseMaster, category: ExerciseCategory): ExerciseCategory[] {
    const current = getExerciseCategories(exercise);
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    return next.length > 0 ? next : [category];
  }

  function toggleStage(exercise: ExerciseMaster, stage: ExerciseStage): ExerciseStage[] {
    const current = getExerciseStages(exercise);
    const next = current.includes(stage)
      ? current.filter((item) => item !== stage)
      : [...current, stage];
    return next.length > 0 ? next : [stage];
  }

  const selectedDay = dayPlans.find((dayPlan) => dayPlan.routineDay.id === selectedDayId) ?? dayPlans[0];
  const selectedExerciseIds = new Set(selectedDay?.plans.map((item) => item.exercise.id) ?? []);
  const availableExercises = exercises.filter((exercise) => !selectedExerciseIds.has(exercise.id));
  const filteredExerciseLibrary = exerciseLibrary.filter((exercise) => {
    const matchesCategory = exerciseCategoryFilter === 'all'
      || getExerciseCategories(exercise).includes(exerciseCategoryFilter);
    const query = exerciseSearch.trim().toLowerCase();
    const matchesSearch = !query
      || exercise.nameKo.toLowerCase().includes(query)
      || exercise.nameEn?.toLowerCase().includes(query)
      || exercise.description?.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });
  const filteredAvailableExercises = availableExercises.filter((exercise) => {
    const matchesCategory = routineAddCategoryFilter === 'all'
      || getExerciseCategories(exercise).includes(routineAddCategoryFilter);
    const query = routineAddSearch.trim().toLowerCase();
    const matchesSearch = !query
      || exercise.nameKo.toLowerCase().includes(query)
      || exercise.nameEn?.toLowerCase().includes(query)
      || exercise.description?.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });
  const editingExercise = exerciseLibrary.find((exercise) => exercise.id === editingExerciseId) ?? filteredExerciseLibrary[0];
  const setupSections: Array<{ id: SetupTab; label: string }> = [
    { id: 'routine', label: t(locale, 'routine') },
    { id: 'library', label: t(locale, 'exercises') },
    { id: 'schedule', label: t(locale, 'weeklyPlan') },
  ];
  const activeRoutineName = activeRoutine
    ? getRoutineSplitName(activeRoutine.splitType, locale) ?? activeRoutine.name
    : undefined;

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-slate-100"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-sm font-medium text-cyan-300">{t(locale, 'routineSetup')}</p>
          <h1 className="text-2xl font-bold text-white">{t(locale, 'setUpTraining')}</h1>
        </div>
      </header>

      <nav aria-label="Routine setup sections" className="grid grid-cols-3 gap-2 rounded-lg bg-slate-900 p-2 shadow">
        {setupSections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSetupTab(item.id as SetupTab)}
            className={`min-h-10 rounded-md px-2 text-sm font-semibold ${
              setupTab === item.id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 shadow">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'language')}</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {locale === 'ko' ? '한국어' : 'English'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-800 p-1">
          {(['ko', 'en'] as AppLocale[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                saveStoredLocale(item);
                setLocale(item);
              }}
              className={`min-h-9 rounded px-3 text-xs font-semibold ${
                locale === item ? 'bg-cyan-400 text-slate-950' : 'text-slate-200'
              }`}
            >
              {item === 'ko' ? '한국어' : 'EN'}
            </button>
          ))}
        </div>
      </section>

      {setupTab === 'routine' ? (
      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'activeRoutine')}</p>
        {activeRoutine ? (
          <input
            aria-label="Active routine name"
            type="text"
            defaultValue={activeRoutineName}
            onBlur={(event) => void handleUpdateRoutineName(event.target.value)}
            className="mt-2 w-full rounded-md bg-slate-800 px-3 py-3 text-xl font-semibold text-white"
          />
        ) : (
          <h2 className="mt-1 text-xl font-semibold text-white">{t(locale, 'noActiveRoutine')}</h2>
        )}
      </section>
      ) : null}

      {setupTab === 'library' ? (
      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">{t(locale, 'exerciseLibrary')}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {locale === 'ko' ? `${exerciseLibrary.length}개의 ${t(locale, 'exercises')}` : `${exerciseLibrary.length} ${t(locale, 'exercises')}`}
            </h2>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2">
          <Search aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
          <input
            aria-label="Search exercise library"
            type="search"
            value={exerciseSearch}
            onChange={(event) => setExerciseSearch(event.target.value)}
            placeholder={t(locale, 'searchExercises')}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {exerciseCategories.map((category) => (
            <button
              key={category.label}
              type="button"
              onClick={() => setExerciseCategoryFilter(category.value)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold ${
                exerciseCategoryFilter === category.value
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-100'
              }`}
            >
              {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <input
            aria-label="New exercise Korean name"
            type="text"
            value={newExerciseName}
            onChange={(event) => setNewExerciseName(event.target.value)}
            placeholder={t(locale, 'koreanName')}
            className="min-h-11 min-w-0 rounded-md bg-slate-800 px-3 text-sm text-white placeholder:text-slate-500"
          />
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input
              aria-label="New exercise English name"
              type="text"
              value={newExerciseNameEn}
              onChange={(event) => setNewExerciseNameEn(event.target.value)}
              placeholder={t(locale, 'englishName')}
              className="min-h-11 min-w-0 rounded-md bg-slate-800 px-3 text-sm text-white placeholder:text-slate-500"
            />
            <select
              aria-label="New exercise category"
              value={newExerciseCategory}
              onChange={(event) => setNewExerciseCategory(event.target.value as ExerciseCategory)}
              className="min-h-11 rounded-md bg-slate-800 px-2 text-sm text-white"
            >
              {exerciseCategoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {labelForCategory(category.value, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateExercise()}
          disabled={!newExerciseName.trim()}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 text-sm font-semibold text-slate-950 disabled:bg-slate-800 disabled:text-slate-500"
        >
          <Plus aria-hidden="true" size={16} />
          <span>{t(locale, 'addExercise')}</span>
        </button>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filteredExerciseLibrary.slice(0, 10).map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => setEditingExerciseId(exercise.id)}
              className={`min-w-36 rounded-md px-3 py-2 text-left text-sm ${
                editingExercise?.id === exercise.id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-100'
              }`}
            >
              <span className="block truncate font-semibold">{getExerciseName(exercise, locale)}</span>
              <span className="mt-1 block truncate text-xs opacity-80">
                {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
              </span>
            </button>
          ))}
        </div>
        {editingExercise ? (
          <div key={editingExercise.id} className="mt-4 rounded-md bg-slate-800 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{getExerciseName(editingExercise, locale)}</h3>
              </div>
              <button
                type="button"
                onClick={() => void handleDeactivateExercise(editingExercise.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-slate-300"
                aria-label={`Deactivate ${getExerciseName(editingExercise, locale)}`}
              >
                <EyeOff aria-hidden="true" size={15} />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              <label className="text-xs font-medium text-slate-400">
                {t(locale, 'koreanName')}
                <input
                  aria-label="Edit exercise Korean name"
                  type="text"
                  defaultValue={editingExercise.nameKo}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameKo: event.target.value.trim() || editingExercise.nameKo })}
                  className="mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs font-medium text-slate-400">
                {t(locale, 'englishName')}
                <input
                  aria-label="Edit exercise English name"
                  type="text"
                  defaultValue={editingExercise.nameEn ?? ''}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameEn: event.target.value.trim() || undefined })}
                  className="mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs font-medium text-slate-400">
                {t(locale, 'description')}
                <textarea
                  aria-label="Edit exercise description"
                  defaultValue={editingExercise.description ?? ''}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { description: event.target.value.trim() || undefined })}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'categories')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exerciseCategoryOptions.map((category) => {
                  const selected = getExerciseCategories(editingExercise).includes(category.value);
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => void handleUpdateExercise(editingExercise.id, {
                        categoryTags: toggleCategory(editingExercise, category.value),
                      })}
                      className={`min-h-9 rounded-md px-3 text-xs font-semibold ${
                        selected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-200'
                      }`}
                    >
                      {labelForCategory(category.value, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'stages')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exerciseStageOptions.map((stage) => {
                  const selected = getExerciseStages(editingExercise).includes(stage.value);
                  return (
                    <button
                      key={stage.value}
                      type="button"
                      onClick={() => void handleUpdateExercise(editingExercise.id, {
                        stageTags: toggleStage(editingExercise, stage.value),
                      })}
                      className={`min-h-9 rounded-md px-3 text-xs font-semibold ${
                        selected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-200'
                      }`}
                    >
                      {labelForStage(stage.value, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {setupTab === 'routine' ? (
      <div className="grid gap-3">
        {routineTemplates.map((template) => {
          const isActive = activeRoutine?.splitType === template.splitType;
          const isSaving = savingSplitType === template.splitType;

          return (
            <button
              key={template.splitType}
              type="button"
              onClick={() => void handleActivate(template.splitType)}
              className="rounded-lg bg-slate-900 p-4 text-left shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{getRoutineTemplateName(template, locale)}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{getRoutineTemplateSummary(template, locale)}</p>
                </div>
                {isActive ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400 text-slate-950">
                    <Check aria-hidden="true" size={18} />
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-medium text-cyan-300">
                {isSaving
                  ? locale === 'ko' ? '로컬 저장 중...' : 'Saving locally...'
                  : isActive ? locale === 'ko' ? '활성 루틴' : 'Active'
                  : locale === 'ko' ? '활성화' : 'Set active'}
              </p>
            </button>
          );
        })}
      </div>
      ) : null}

      {dayPlans.length > 0 && setupTab !== 'library' ? (
        <section className="rounded-lg bg-slate-900 p-5 shadow">
          {setupTab === 'schedule' ? (
          <>
          <p className="text-sm font-medium text-slate-400">{t(locale, 'weeklyPlan')}</p>
          <div className="mt-2 rounded-md bg-slate-800 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'activeRoutine')}</p>
            <h2 className="mt-1 text-base font-semibold text-white">{activeRoutineName ?? t(locale, 'noActiveRoutine')}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">{t(locale, 'routinePlanFor')}</p>
          </div>
          <div className="mt-3 grid gap-2">
            {weeklySchedule.map((schedule) => (
              <label
                key={schedule.weekday}
                className="grid grid-cols-[3.5rem_1fr] items-center gap-3 text-sm font-semibold text-slate-300"
              >
                <span>{weekdayLabels[locale][schedule.weekday]}</span>
                <select
                  aria-label={`${weekdayLabels[locale][schedule.weekday]} routine day`}
                  value={schedule.isRestDay ? '' : schedule.routineDayId ?? ''}
                  onChange={(event) => void handleWeeklyScheduleChange(schedule.weekday, event.target.value)}
                  className="min-h-10 rounded-md bg-slate-800 px-3 text-sm text-white"
                >
                  <option value="">{t(locale, 'rest')}</option>
                  {dayPlans.map((dayPlan) => (
                    <option key={dayPlan.routineDay.id} value={dayPlan.routineDay.id}>
	                      {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          </>
          ) : null}

          {setupTab === 'routine' ? (
          <div className="mt-5 border-t border-slate-800 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-400">{t(locale, 'routineDays')}</p>
            <button
              type="button"
              onClick={() => void handleResetRoutineTemplate()}
              className="flex min-h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-100"
            >
              <RotateCcw aria-hidden="true" size={14} />
              <span>{locale === 'ko' ? '템플릿 정리' : 'Reset template'}</span>
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {dayPlans.map((dayPlan) => (
              <button
                key={dayPlan.routineDay.id}
                type="button"
                onClick={() => setSelectedDayId(dayPlan.routineDay.id)}
                className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                  selectedDay?.routineDay.id === dayPlan.routineDay.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
	                {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
              </button>
            ))}
          </div>

          {selectedDay ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  aria-label="Routine day name"
                  type="text"
                  defaultValue={selectedDay.routineDay.name}
                  onBlur={(event) => void handleUpdateRoutineDayName(selectedDay.routineDay.id, event.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-slate-800 px-3 py-2 text-lg font-semibold text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAddingDayId((current) => (
                      current === selectedDay.routineDay.id ? undefined : selectedDay.routineDay.id
                    ));
                    setRoutineAddSearch('');
                    setRoutineAddCategoryFilter('all');
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-400 text-slate-950"
                  aria-label={`Add exercise to ${selectedDay.routineDay.name}`}
                >
                  <Plus aria-hidden="true" size={20} />
                </button>
              </div>

              {addingDayId === selectedDay.routineDay.id ? (
                <div className="mt-3 rounded-md bg-slate-800 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'exerciseFinder')}</p>
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2">
                    <Search aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
                    <input
                      aria-label="Search exercises to add"
                      type="search"
                      value={routineAddSearch}
                      onChange={(event) => setRoutineAddSearch(event.target.value)}
                      placeholder={t(locale, 'searchExercises')}
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {exerciseCategories.map((category) => (
                      <button
                        key={category.label}
                        type="button"
                        onClick={() => setRoutineAddCategoryFilter(category.value)}
                        className={`min-h-8 rounded-md px-3 text-xs font-semibold ${
                          routineAddCategoryFilter === category.value
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-900 text-slate-100'
                        }`}
                      >
                        {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {filteredAvailableExercises.length} {t(locale, 'exercises')}
                  </p>
                  <div className="mt-2 max-h-72 overflow-y-auto pr-1">
                    <div className="grid gap-2">
                      {filteredAvailableExercises.length === 0 ? (
                        <p className="rounded-md bg-slate-900 px-3 py-3 text-sm text-slate-300">
                          {t(locale, 'noMatchingExercises')}
                        </p>
                      ) : filteredAvailableExercises.map((exercise) => (
                        <button
                          key={exercise.id}
                          type="button"
                          onClick={() => void handleAddExercise(selectedDay.routineDay.id, exercise.id)}
                          className="rounded-md bg-slate-900 px-3 py-3 text-left text-sm text-slate-100"
                        >
                          <span className="block font-semibold">{getExerciseName(exercise, locale)}</span>
                          <span className="mt-1 block text-xs text-slate-400">
                            {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 grid gap-2">
                {selectedDay.plans.length === 0 ? (
                  <p className="rounded-md bg-slate-800 px-3 py-3 text-sm text-slate-300">
                    {t(locale, 'noPlannedExercises')}
                  </p>
                ) : selectedDay.plans.map(({ plan, exercise }, planIndex) => (
                  <div key={plan.id} className="rounded-md bg-slate-800 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{getExerciseName(exercise, locale)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleMovePlan(plan.id, -1)}
                          disabled={planIndex === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-slate-100 disabled:text-slate-600"
                          aria-label={`Move ${getExerciseName(exercise, locale)} up`}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMovePlan(plan.id, 1)}
                          disabled={planIndex === selectedDay.plans.length - 1}
                          className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-slate-100 disabled:text-slate-600"
                          aria-label={`Move ${getExerciseName(exercise, locale)} down`}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePlan(plan.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-red-300"
                          aria-label={`Remove ${getExerciseName(exercise, locale)} from ${selectedDay.routineDay.name}`}
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <label className="text-xs font-medium text-slate-400">
                        Sets
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned sets`}
                          type="text"
                          inputMode="numeric"
                          defaultValue={plan.plannedSets ?? 3}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedSets: Math.max(1, Number(event.target.value) || 1),
                          })}
                          className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-center text-sm text-white"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-400">
                        Kg
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned weight`}
                          type="text"
                          inputMode="decimal"
                          defaultValue={plan.plannedWeightKg ?? ''}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedWeightKg: Number(event.target.value) || undefined,
                          })}
                          className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-center text-sm text-white"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-400">
                        Reps
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned reps`}
                          type="text"
                          inputMode="numeric"
                          defaultValue={plan.plannedReps ?? 10}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedReps: Math.max(0, Number(event.target.value) || 0),
                          })}
                          className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-center text-sm text-white"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-400">
                        RIR
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned RIR`}
                          type="text"
                          inputMode="numeric"
                          defaultValue={plan.plannedRir ?? 2}
                          onBlur={(event) => {
                            const value = event.target.value;
                            void handleUpdatePlan(plan.id, {
                              plannedRir: value === '' ? undefined : Math.max(0, Number(value) || 0),
                            });
                          }}
                          className="mt-1 w-full rounded-md bg-slate-900 px-2 py-2 text-center text-sm text-white"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
