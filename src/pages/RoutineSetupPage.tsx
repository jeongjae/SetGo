import { ArrowDown, ArrowUp, Check, ChevronLeft, EyeOff, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ExerciseFinder, emptyExerciseFinderState, type ExerciseFinderState } from '../components/ExerciseFinder';
import { db } from '../db/db';
import { seedDefaultExercises } from '../db/seed';
import { getExerciseIcon } from '../utils/exerciseIcon';
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
import { exerciseCountLabel, getStoredLocale, saveStoredLocale, t, type AppLocale } from '../i18n/i18n';
import {
  activateRoutineTemplate,
  addExerciseToRoutineDay,
  deleteRoutineExercisePlan,
  getActiveRoutine,
  getActiveRoutineDayPlans,
  getActiveWeeklySchedule,
  getRoutineDayDisplayName,
  getRoutineTemplateName,
  getRoutineTemplateSummary,
  getRoutineSplitName,
  moveRoutineExercisePlan,
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
const exerciseStages: Array<{ label: string; value: ExerciseStage | 'all' }> = [
  { label: 'All', value: 'all' },
  ...exerciseStageOptions.map((stage) => ({ label: stage.label, value: stage.value })),
];
type SetupTab = 'routine' | 'library' | 'schedule';

type RoutinePlanSnapshot = {
  routineId: string;
  routineDayIds: string[];
  plans: RoutineExercisePlan[];
};

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
  const [exerciseStageFilter, setExerciseStageFilter] = useState<ExerciseStage | 'all'>('all');
  const [routineAddSearch, setRoutineAddSearch] = useState('');
  const [routineAddCategoryFilter, setRoutineAddCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [routineAddStageFilter, setRoutineAddStageFilter] = useState<ExerciseStage | 'all'>('all');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseNameEn, setNewExerciseNameEn] = useState('');
  const [newExerciseCategory, setNewExerciseCategory] = useState<ExerciseCategory>('chest');
  const [editingExerciseId, setEditingExerciseId] = useState<string | undefined>();
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const [setupTab, setSetupTab] = useState<SetupTab>('routine');
  const [resetStatus, setResetStatus] = useState<string | undefined>();
  const initialRoutinePlanSnapshot = useRef<RoutinePlanSnapshot | undefined>(undefined);

  async function loadSetup(captureRoutineSnapshot = false) {
    await seedDefaultExercises();

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

    if (captureRoutineSnapshot && routine) {
      initialRoutinePlanSnapshot.current = {
        routineId: routine.id,
        routineDayIds: plans.map((plan) => plan.routineDay.id),
        plans: plans.flatMap((plan) => plan.plans.map((item) => ({ ...item.plan }))),
      };
    }
  }

  useEffect(() => {
    void loadSetup(true);
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
    await loadSetup(true);
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

  async function handleRevertRoutineChanges() {
    const snapshot = initialRoutinePlanSnapshot.current;
    if (!snapshot) return;

    await db.transaction('rw', db.routineExercisePlans, async () => {
      await Promise.all(
        snapshot.routineDayIds.map((routineDayId) => (
          db.routineExercisePlans.where('routineDayId').equals(routineDayId).delete()
        )),
      );

      if (snapshot.plans.length > 0) {
        await db.routineExercisePlans.bulkPut(snapshot.plans.map((plan) => ({ ...plan })));
      }
    });

    setResetStatus(locale === 'ko' ? '화면 진입 시점의 루틴 운동으로 되돌렸습니다.' : 'Routine changes reverted to the state from when this screen opened.');
    onRoutineSaved();
    await loadSetup();
    window.setTimeout(() => setResetStatus(undefined), 1800);
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
    return exerciseMatchesFilters(exercise, {
      query: exerciseSearch,
      category: exerciseCategoryFilter,
      stage: exerciseStageFilter,
    });
  });
  const routineAddFinderState: ExerciseFinderState = {
    query: routineAddSearch,
    category: routineAddCategoryFilter,
    stage: routineAddStageFilter,
  };
  const updateRoutineAddFinderState = (state: ExerciseFinderState) => {
    setRoutineAddSearch(state.query);
    setRoutineAddCategoryFilter(state.category);
    setRoutineAddStageFilter(state.stage);
  };
  const resetRoutineAddFinderState = () => updateRoutineAddFinderState(emptyExerciseFinderState);
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
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4.5 px-4 py-6">
      <header className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 hover:text-white active:scale-95 transition-all duration-200"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-cyan-400">{t(locale, 'routineSetup')}</p>
          <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'setUpTraining')}</h1>
        </div>
      </header>

      <nav aria-label="Routine setup sections" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-950/80 border border-slate-900 p-1.5 shadow-2xl">
        {setupSections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSetupTab(item.id as SetupTab)}
            className={`min-h-10 rounded-xl px-2.5 text-xs font-black transition-all duration-200 active:scale-95 ${
              setupTab === item.id 
                ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-400/15' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 shadow-xl">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t(locale, 'language')}</p>
          <p className="mt-0.5 text-sm font-bold text-white">
            {locale === 'ko' ? '한국어 (KR)' : 'English (US)'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-900">
          {(['ko', 'en'] as AppLocale[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                saveStoredLocale(item);
                setLocale(item);
              }}
              className={`min-h-8 rounded-lg px-3 text-xs font-bold transition-all active:scale-95 ${
                locale === item 
                  ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-slate-950' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item === 'ko' ? '한국어' : 'EN'}
            </button>
          ))}
        </div>
      </section>

      {setupTab === 'routine' ? (
      <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t(locale, 'activeRoutine')}</p>
        {activeRoutine ? (
          <input
            aria-label="Active routine name"
            type="text"
            defaultValue={activeRoutineName}
            onBlur={(event) => void handleUpdateRoutineName(event.target.value)}
            className="mt-2.5 w-full rounded-xl bg-slate-950/80 border border-slate-850 px-3.5 py-3 text-lg font-bold text-white outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/80 transition-all"
          />
        ) : (
          <h2 className="mt-1 text-lg font-bold text-slate-500">{t(locale, 'noActiveRoutine')}</h2>
        )}
      </section>
      ) : null}

      {setupTab === 'library' ? (
      <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t(locale, 'exerciseLibrary')}</p>
            <h2 className="mt-0.5 text-lg font-bold text-white">
              {locale === 'ko' ? `${exerciseLibrary.length}개의 등록된 운동` : `${exerciseLibrary.length} Exercises`}
            </h2>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-950/80 border border-slate-900 px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-cyan-400 focus-within:border-cyan-400 transition-all">
          <Search aria-hidden="true" size={16} className="shrink-0 text-slate-500" />
          <input
            aria-label="Search exercise library"
            type="search"
            value={exerciseSearch}
            onChange={(event) => setExerciseSearch(event.target.value)}
            placeholder={t(locale, 'searchExercises')}
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {exerciseCategories.map((category) => (
            <button
              key={category.label}
              type="button"
              onClick={() => setExerciseCategoryFilter(category.value)}
              className={`min-h-8 shrink-0 rounded-lg px-3 text-[10px] font-black transition-all active:scale-95 duration-200 ${
                exerciseCategoryFilter === category.value
                  ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/10'
                  : 'bg-slate-950 border border-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {exerciseStages.map((stage) => (
            <button
              key={stage.value}
              type="button"
              onClick={() => setExerciseStageFilter(stage.value)}
              className={`min-h-8 shrink-0 rounded-lg px-3 text-[10px] font-black transition-all active:scale-95 duration-200 ${
                exerciseStageFilter === stage.value
                  ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/10'
                  : 'bg-slate-950 border border-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {stage.value === 'all' ? t(locale, 'all') : labelForStage(stage.value, locale)}
            </button>
          ))}
        </div>

        <div className="mt-4.5 grid gap-2">
          <input
            aria-label="New exercise Korean name"
            type="text"
            value={newExerciseName}
            onChange={(event) => setNewExerciseName(event.target.value)}
            placeholder={t(locale, 'koreanName')}
            className="min-h-11 min-w-0 rounded-xl bg-slate-950 border border-slate-900 px-3.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 placeholder:text-slate-650"
          />
          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <input
              aria-label="New exercise English name"
              type="text"
              value={newExerciseNameEn}
              onChange={(event) => setNewExerciseNameEn(event.target.value)}
              placeholder={t(locale, 'englishName')}
              className="min-h-11 min-w-0 rounded-xl bg-slate-950 border border-slate-900 px-3.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 placeholder:text-slate-650"
            />
            <select
              aria-label="New exercise category"
              value={newExerciseCategory}
              onChange={(event) => setNewExerciseCategory(event.target.value as ExerciseCategory)}
              className="min-h-11 rounded-xl bg-slate-950 border border-slate-900 px-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-400/50"
            >
              {exerciseCategoryOptions.map((category) => (
                <option key={category.value} value={category.value} className="bg-slate-950">
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
          className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 px-3 text-xs font-bold text-slate-950 shadow-md shadow-cyan-400/10 disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-500 disabled:border disabled:border-slate-850 disabled:shadow-none active:scale-95 transition-all duration-200"
        >
          <Plus aria-hidden="true" size={15} />
          <span>{t(locale, 'addExercise')}</span>
        </button>

        {/* 10개 제한 해제 및 세로 2열 썸네일 그리드 */}
        <div className="mt-5 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1.5 scrollbar-thin">
          {filteredExerciseLibrary.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => setEditingExerciseId(exercise.id)}
              className={`flex items-center rounded-xl p-2 text-left border transition-all active:scale-95 duration-200 ${
                editingExercise?.id === exercise.id
                  ? 'bg-cyan-400 border-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-400/10'
                  : 'bg-slate-950 border-slate-900 text-slate-350 hover:border-slate-800'
              }`}
            >
              <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm shadow-inner ${
                editingExercise?.id === exercise.id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 border border-slate-850'
              }`}>
                {getExerciseIcon(exercise.defaultEmoji)}
              </div>
              <div className="min-w-0 flex-1 ml-2">
                <span className="block truncate text-[11px] font-black leading-tight">{getExerciseName(exercise, locale)}</span>
                <span className={`block truncate text-[8.5px] mt-0.5 ${editingExercise?.id === exercise.id ? 'text-slate-950/70 font-medium' : 'text-slate-500'}`}>
                  {getExerciseCategories(exercise).map((c) => labelForCategory(c, locale)).join('/')}
                </span>
              </div>
            </button>
          ))}
        </div>

        {editingExercise ? (
          <div key={editingExercise.id} className="mt-4.5 rounded-2xl bg-slate-950/80 border border-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-base">
                  {getExerciseIcon(editingExercise.defaultEmoji)}
                </div>
                <h3 className="text-sm font-bold text-white leading-tight">{getExerciseName(editingExercise, locale)}</h3>
              </div>
              <button
                type="button"
                onClick={() => void handleDeactivateExercise(editingExercise.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 active:scale-95 transition-all"
                aria-label={`Deactivate ${getExerciseName(editingExercise, locale)}`}
              >
                <EyeOff aria-hidden="true" size={15} />
              </button>
            </div>

            <div className="mt-3.5 grid gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t(locale, 'koreanName')}
                <input
                  aria-label="Edit exercise Korean name"
                  type="text"
                  defaultValue={editingExercise.nameKo}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameKo: event.target.value.trim() || editingExercise.nameKo })}
                  className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-850 px-3.5 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t(locale, 'englishName')}
                <input
                  aria-label="Edit exercise English name"
                  type="text"
                  defaultValue={editingExercise.nameEn ?? ''}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameEn: event.target.value.trim() || undefined })}
                  className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-850 px-3.5 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t(locale, 'description')}
                <textarea
                  aria-label="Edit exercise description"
                  defaultValue={editingExercise.description ?? ''}
                  onBlur={(event) => void handleUpdateExercise(editingExercise.id, { description: event.target.value.trim() || undefined })}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl bg-slate-900 border border-slate-850 px-3.5 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </label>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(locale, 'categories')}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {exerciseCategoryOptions.map((category) => {
                  const selected = getExerciseCategories(editingExercise).includes(category.value);
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => void handleUpdateExercise(editingExercise.id, {
                        categoryTags: toggleCategory(editingExercise, category.value),
                      })}
                      className={`min-h-8 rounded-lg px-2.5 text-[10px] font-bold transition-all active:scale-95 duration-200 ${
                        selected 
                          ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/10' 
                          : 'bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-850 hover:text-slate-200'
                      }`}
                    >
                      {labelForCategory(category.value, locale)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(locale, 'stages')}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {exerciseStageOptions.map((stage) => {
                  const selected = getExerciseStages(editingExercise).includes(stage.value);
                  return (
                    <button
                      key={stage.value}
                      type="button"
                      onClick={() => void handleUpdateExercise(editingExercise.id, {
                        stageTags: toggleStage(editingExercise, stage.value),
                      })}
                      className={`min-h-8 rounded-lg px-2.5 text-[10px] font-bold transition-all active:scale-95 duration-200 ${
                        selected 
                          ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/10' 
                          : 'bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-850 hover:text-slate-200'
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
              className={`w-full rounded-2xl bg-slate-900/60 backdrop-blur-md border p-5 text-left transition-all active:scale-[0.98] shadow-2xl ${
                isActive 
                  ? 'border-cyan-400/80 shadow-[0_0_15px_-3px_rgba(34,211,238,0.15)] bg-slate-900/90' 
                  : 'border-slate-800/80 hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-white tracking-wide">{getRoutineTemplateName(template, locale)}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{getRoutineTemplateSummary(template, locale)}</p>
                </div>
                {isActive ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20">
                    <Check aria-hidden="true" size={16} />
                  </span>
                ) : null}
              </div>
              <p className={`mt-3.5 text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                {isSaving
                  ? locale === 'ko' ? '로컬 저장 중...' : 'Saving...'
                  : isActive ? locale === 'ko' ? '● 활성 루틴' : '● Active'
                  : locale === 'ko' ? '활성화하기' : 'Activate Plan'}
              </p>
            </button>
          );
        })}
      </div>
      ) : null}

      {dayPlans.length > 0 && setupTab !== 'library' ? (
        <section className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 shadow-2xl space-y-4">
          {setupTab === 'schedule' ? (
          <>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(locale, 'weeklyPlan')}</p>
          <div className="mt-2 rounded-xl bg-slate-950/80 border border-slate-900 px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t(locale, 'activeRoutine')}</p>
            <h2 className="mt-1 text-sm font-black text-white">{activeRoutineName ?? t(locale, 'noActiveRoutine')}</h2>
            <p className="mt-1 text-[10px] leading-normal text-slate-500">{t(locale, 'routinePlanFor')}</p>
          </div>
          <div className="mt-3.5 space-y-2">
            {weeklySchedule.map((schedule) => (
              <label
                key={schedule.weekday}
                className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-wider"
              >
                <span>{weekdayLabels[locale][schedule.weekday]}</span>
                <select
                  aria-label={`${weekdayLabels[locale][schedule.weekday]} routine day`}
                  value={schedule.isRestDay ? '' : schedule.routineDayId ?? ''}
                  onChange={(event) => void handleWeeklyScheduleChange(schedule.weekday, event.target.value)}
                  className="min-h-9 w-full rounded-xl bg-slate-950 border border-slate-850 px-3 text-xs font-bold text-slate-300 outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 transition-all cursor-pointer"
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
          <div className="mt-5 border-t border-slate-800/80 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(locale, 'routineDays')}</p>
            <button
              type="button"
              onClick={() => void handleRevertRoutineChanges()}
              className="flex min-h-8 items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 px-3 py-1.5 text-xs font-bold text-slate-200 transition-all active:scale-95 border border-slate-750"
            >
              <RotateCcw aria-hidden="true" size={13} />
              <span>{locale === 'ko' ? '변경 취소' : 'Undo changes'}</span>
            </button>
          </div>
          {resetStatus ? (
            <p className="mt-2 rounded-xl bg-cyan-950/80 border border-cyan-900/50 px-3.5 py-2 text-xs font-bold text-cyan-200">
              {resetStatus}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5 pb-1">
            {dayPlans.map((dayPlan) => (
              <button
                key={dayPlan.routineDay.id}
                type="button"
                onClick={() => setSelectedDayId(dayPlan.routineDay.id)}
                className={`min-h-8 rounded-full px-4 text-xs font-black transition-all active:scale-95 border ${
                  selectedDay?.routineDay.id === dayPlan.routineDay.id
                    ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850 hover:text-white'
                }`}
              >
	                {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
              </button>
            ))}
          </div>

          {selectedDay ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2.5">
                <input
                  aria-label="Routine day name"
                  type="text"
                  defaultValue={selectedDay.routineDay.name}
                  onBlur={(event) => void handleUpdateRoutineDayName(selectedDay.routineDay.id, event.target.value)}
                  className="min-w-0 flex-1 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-400/50 px-3.5 py-2 text-sm font-black text-white outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAddingDayId((current) => (
                      current === selectedDay.routineDay.id ? undefined : selectedDay.routineDay.id
                    ));
                    resetRoutineAddFinderState();
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 active:scale-95 transition-all shadow-md shadow-cyan-400/20"
                  aria-label={`Add exercise to ${selectedDay.routineDay.name}`}
                >
                  <Plus aria-hidden="true" size={18} />
                </button>
              </div>

              {addingDayId === selectedDay.routineDay.id ? (
                <div className="mt-3">
                  <ExerciseFinder
                    ariaLabel="Search exercises to add"
                    exercises={availableExercises}
                    locale={locale}
                    state={routineAddFinderState}
                    onChange={updateRoutineAddFinderState}
                    onSelect={(exercise) => void handleAddExercise(selectedDay.routineDay.id, exercise.id)}
                    title={t(locale, 'exerciseFinder')}
                  />
                </div>
              ) : null}

              <div className="mt-3.5 space-y-2.5">
                {selectedDay.plans.length === 0 ? (
                  <p className="rounded-2xl bg-slate-900/40 border border-slate-800/80 px-4 py-6 text-xs font-semibold text-slate-400 text-center leading-relaxed">
                    {t(locale, 'noPlannedExercises')}
                  </p>
                ) : selectedDay.plans.map(({ plan, exercise }, planIndex) => (
                  <div key={plan.id} className="rounded-2xl bg-slate-950/80 border border-slate-900 p-4 shadow-xl space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-base shrink-0">
                          {getExerciseIcon(exercise.defaultEmoji)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-white leading-tight truncate">{getExerciseName(exercise, locale)}</p>
                          <p className="mt-0.5 text-[9.5px] font-bold text-slate-500 truncate">
                            {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleMovePlan(plan.id, -1)}
                          disabled={planIndex === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-slate-450 border border-slate-850 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
                          aria-label={`Move ${getExerciseName(exercise, locale)} up`}
                        >
                          <ArrowUp aria-hidden="true" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMovePlan(plan.id, 1)}
                          disabled={planIndex === selectedDay.plans.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-slate-450 border border-slate-850 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
                          aria-label={`Move ${getExerciseName(exercise, locale)} down`}
                        >
                          <ArrowDown aria-hidden="true" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePlan(plan.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-slate-850 text-rose-455 hover:text-rose-400 hover:bg-rose-950/20 active:scale-95 transition-all"
                          aria-label={`Remove ${getExerciseName(exercise, locale)} from ${selectedDay.routineDay.name}`}
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-900">
                      <label className="block text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sets</span>
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned sets`}
                          type="text"
                          inputMode="numeric"
                          defaultValue={plan.plannedSets ?? 3}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedSets: Math.max(1, Number(event.target.value) || 1),
                          })}
                          className="w-full rounded-xl bg-slate-900 border border-slate-850 py-2.5 text-center text-xs font-black text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
                        />
                      </label>
                      <label className="block text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kg</span>
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned weight`}
                          type="text"
                          inputMode="decimal"
                          defaultValue={plan.plannedWeightKg ?? ''}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedWeightKg: Number(event.target.value) || undefined,
                          })}
                          className="w-full rounded-xl bg-slate-900 border border-slate-850 py-2.5 text-center text-xs font-black text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
                        />
                      </label>
                      <label className="block text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Reps</span>
                        <input
                          aria-label={`${getExerciseName(exercise, locale)} planned reps`}
                          type="text"
                          inputMode="numeric"
                          defaultValue={plan.plannedReps ?? 10}
                          onBlur={(event) => void handleUpdatePlan(plan.id, {
                            plannedReps: Math.max(0, Number(event.target.value) || 0),
                          })}
                          className="w-full rounded-xl bg-slate-900 border border-slate-850 py-2.5 text-center text-xs font-black text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
                        />
                      </label>
                      <label className="block text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">RIR</span>
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
                          className="w-full rounded-xl bg-slate-900 border border-slate-850 py-2.5 text-center text-xs font-black text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
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
