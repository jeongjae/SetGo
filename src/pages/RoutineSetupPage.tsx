import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
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
import { exerciseCountLabel, getStoredLocale, t } from '../i18n/i18n';
import {
  activateStoredRoutine,
  activateRoutineTemplate,
  addExerciseToRoutineDay,
  createCustomRoutine,
  deleteRoutineExercisePlan,
  getActiveRoutine,
  getActiveRoutineDayPlans,
  getActiveWeeklySchedule,
  getRoutineDayDisplayName,
  getAllRoutines,
  getRoutineTemplateName,
  getRoutineTemplateSummary,
  moveRoutineExercisePlan,
  routineTemplates,
  saveWeeklySchedule,
  updateActiveRoutineName,
  updateRoutineExercisePlan,
  updateRoutineDayName,
  type RoutineDayPlan,
  type WeeklyScheduleView,
} from '../db/routines';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage, Routine, RoutineDay, RoutineExercisePlan, RoutineSplitType, Weekday } from '../types';

type RoutineSetupPageProps = {
  initialSection: SetupTab;
  onBack: () => void;
  onRoutineSaved: () => void;
  onReviewCalendar: () => void;
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
type ExerciseLibraryMode = 'browse' | 'add';

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

type RoutinePlanSnapshot = {
  routineId: string;
  routineName: string;
  routineDays: RoutineDay[];
  plans: RoutineExercisePlan[];
};

export function RoutineSetupPage({ initialSection, onBack, onRoutineSaved, onReviewCalendar }: RoutineSetupPageProps) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [savedRoutines, setSavedRoutines] = useState<Routine[]>([]);
  const [showRoutineTemplates, setShowRoutineTemplates] = useState(false);
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
  const [routineAddStageFilter, setRoutineAddStageFilter] = useState<ExerciseStage | 'all'>('all');
  const [editingExerciseId, setEditingExerciseId] = useState<string | undefined>();
  const [pendingExerciseDraft, setPendingExerciseDraft] = useState<ExerciseMaster | undefined>();
  const [exerciseLibraryMode, setExerciseLibraryMode] = useState<ExerciseLibraryMode>('browse');
  const [isEditingExercise, setIsEditingExercise] = useState(false);
  const [showHiddenExercises, setShowHiddenExercises] = useState(false);
  const [locale] = useState(() => getStoredLocale());
  const [setupTab] = useState<SetupTab>(initialSection);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | undefined>();
  const [resetStatus, setResetStatus] = useState<string | undefined>();
  const initialRoutinePlanSnapshot = useRef<RoutinePlanSnapshot | undefined>(undefined);
  const initialExerciseSnapshot = useRef<ExerciseMaster | undefined>(undefined);

  async function loadSetup(captureRoutineSnapshot = false) {
    await seedDefaultExercises();

    const [routine, plans, schedule, exerciseMasters, allExerciseMasters, routines] = await Promise.all([
      getActiveRoutine(),
      getActiveRoutineDayPlans(),
      getActiveWeeklySchedule(),
      db.exercises.filter((exercise) => exercise.isActive && !getExerciseCategories(exercise).includes('cardio')).toArray(),
      db.exercises.toArray(),
      getAllRoutines(),
    ]);

    setActiveRoutine(routine);
    setDayPlans(plans);
    setWeeklySchedule(schedule);
    setExercises(exerciseMasters);
    setExerciseLibrary(allExerciseMasters);
    setSavedRoutines(routines);
    setSelectedDayId((current) => current ?? plans[0]?.routineDay.id);
    const today = new Date().toISOString().slice(0, 10);
    setScheduleStartDate(routine?.endDate ? routine.startDate : today);
    setScheduleEndDate(routine?.endDate ?? addDays(today, 27));
    setScheduleDirty(Boolean(routine && !routine.endDate));

    if (captureRoutineSnapshot && routine) {
      initialRoutinePlanSnapshot.current = {
        routineId: routine.id,
        routineName: routine.name,
        routineDays: plans.map((plan) => ({ ...plan.routineDay })),
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
    setShowRoutineTemplates(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleCreateCustomRoutine() {
    const routine = await createCustomRoutine(locale === 'ko' ? '나의 루틴' : 'My Routine');
    setActiveRoutine(routine);
    setSelectedDayId(undefined);
    setShowRoutineTemplates(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleSelectStoredRoutine(routineId: string) {
    await activateStoredRoutine(routineId);
    setSelectedDayId(undefined);
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

  function handleWeeklyScheduleChange(weekday: Weekday, routineDayId: string) {
    setWeeklySchedule((current) => current.map((entry) => (
      entry.weekday === weekday
        ? { ...entry, routineDayId: routineDayId || undefined, isRestDay: !routineDayId }
        : entry
    )));
    setScheduleDirty(true);
  }

  async function handleSaveWeeklySchedule() {
    if (!activeRoutine || !scheduleStartDate || !scheduleEndDate || scheduleEndDate < scheduleStartDate) return;
    await saveWeeklySchedule(activeRoutine.id, scheduleStartDate, scheduleEndDate, weeklySchedule);
    setScheduleDirty(false);
    setScheduleStatus(locale === 'ko' ? '주간 계획을 저장했습니다.' : 'Weekly plan saved.');
    onRoutineSaved();
    window.setTimeout(() => setScheduleStatus(undefined), 1600);
  }

  async function handleCancelWeeklySchedule() {
    await loadSetup();
    setScheduleStatus(locale === 'ko' ? '변경을 취소했습니다.' : 'Changes discarded.');
    window.setTimeout(() => setScheduleStatus(undefined), 1600);
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

  async function handleSaveRoutineChanges() {
    setResetStatus(locale === 'ko' ? '루틴 변경을 저장했습니다.' : 'Routine changes saved.');
    onRoutineSaved();
    await loadSetup(true);
    window.setTimeout(() => setResetStatus(undefined), 1800);
  }

  async function handleRevertRoutineChanges() {
    const snapshot = initialRoutinePlanSnapshot.current;
    if (!snapshot) return;

    await db.transaction('rw', db.routines, db.routineDays, db.routineExercisePlans, async () => {
      await db.routines.update(snapshot.routineId, {
        name: snapshot.routineName,
        updatedAt: new Date().toISOString(),
      });
      if (snapshot.routineDays.length > 0) {
        await db.routineDays.bulkPut(snapshot.routineDays.map((day) => ({ ...day })));
      }
      await Promise.all(
        snapshot.routineDays.map((routineDay) => (
          db.routineExercisePlans.where('routineDayId').equals(routineDay.id).delete()
        )),
      );

      if (snapshot.plans.length > 0) {
        await db.routineExercisePlans.bulkPut(snapshot.plans.map((plan) => ({ ...plan })));
      }
    });

    setResetStatus(locale === 'ko' ? '루틴 변경을 취소했습니다.' : 'Routine changes discarded.');
    onRoutineSaved();
    await loadSetup();
    window.setTimeout(() => setResetStatus(undefined), 1800);
  }

  function handleStartAddExercise() {
    const now = new Date().toISOString();
    const draft: ExerciseMaster = {
      id: `custom_${Date.now()}`,
      nameKo: '',
      nameEn: '',
      stage: 'main',
      stageTags: ['main'],
      category: 'chest',
      categoryTags: ['chest'],
      defaultEmoji: 'CH',
      isDefault: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    setPendingExerciseDraft(draft);
    setEditingExerciseId(draft.id);
    setExerciseLibraryMode('add');
    setIsEditingExercise(true);
    initialExerciseSnapshot.current = undefined;
  }

  async function handleDeactivateExercise(exerciseId: string) {
    if (!window.confirm(locale === 'ko' ? '이 운동을 목록에서 숨길까요?' : 'Hide this exercise from the list?')) return;
    await db.exercises.update(exerciseId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    setEditingExerciseId(undefined);
    setExerciseLibraryMode('browse');
    setIsEditingExercise(false);
    setPendingExerciseDraft(undefined);
    await loadSetup();
  }

  async function handleRestoreExercise(exerciseId: string) {
    await db.exercises.update(exerciseId, {
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    await loadSetup();
  }

  function handleSelectExercise(exercise: ExerciseMaster) {
    setEditingExerciseId(exercise.id);
    setExerciseLibraryMode('browse');
    setIsEditingExercise(false);
    setPendingExerciseDraft(undefined);
  }

  function handleBeginExerciseEdit(exercise: ExerciseMaster) {
    setEditingExerciseId(exercise.id);
    setIsEditingExercise(true);
    initialExerciseSnapshot.current = { ...exercise };
    setPendingExerciseDraft(undefined);
  }

  async function handleSaveExerciseChanges() {
    if (!editingExercise?.nameKo.trim()) return;
    if (pendingExerciseDraft) {
      await db.exercises.put({ ...pendingExerciseDraft });
      setPendingExerciseDraft(undefined);
    }
    initialExerciseSnapshot.current = editingExercise ? { ...editingExercise } : undefined;
    setExerciseLibraryMode('browse');
    setIsEditingExercise(false);
    await loadSetup();
  }

  async function handleCancelExerciseChanges() {
    if (!pendingExerciseDraft && initialExerciseSnapshot.current) {
      await db.exercises.put({ ...initialExerciseSnapshot.current });
    }
    setPendingExerciseDraft(undefined);
    setEditingExerciseId(undefined);
    setExerciseLibraryMode('browse');
    setIsEditingExercise(false);
    await loadSetup();
  }

  async function handleExerciseLibraryModeChange(nextMode: ExerciseLibraryMode) {
    if (nextMode === exerciseLibraryMode && !isEditingExercise) return;
    if (isEditingExercise) {
      await handleCancelExerciseChanges();
    }
    if (nextMode === 'add') {
      handleStartAddExercise();
      return;
    }
    setExerciseLibraryMode('browse');
    setPendingExerciseDraft(undefined);
    setEditingExerciseId(undefined);
    setIsEditingExercise(false);
  }

  async function handleUpdateExercise(
    exerciseId: string,
    values: Partial<Pick<ExerciseMaster, 'nameKo' | 'nameEn' | 'description' | 'categoryTags' | 'stageTags'>>,
  ) {
    if (pendingExerciseDraft?.id === exerciseId) {
      const categoryTags = values.categoryTags ?? getExerciseCategories(pendingExerciseDraft);
      const stageTags = values.stageTags ?? getExerciseStages(pendingExerciseDraft);
      setPendingExerciseDraft({
        ...pendingExerciseDraft,
        ...values,
        category: categoryTags[0] ?? pendingExerciseDraft.category,
        categoryTags,
        stage: stageTags[0] ?? pendingExerciseDraft.stage,
        stageTags,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
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
    return (showHiddenExercises ? !exercise.isActive : exercise.isActive) && exerciseMatchesFilters(exercise, {
      query: exerciseSearch,
      category: exerciseCategoryFilter,
      stage: 'all',
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
  const editingExercise = pendingExerciseDraft?.id === editingExerciseId
    ? pendingExerciseDraft
    : exerciseLibrary.find((exercise) => exercise.id === editingExerciseId);
  const exerciseEditorOpen = exerciseLibraryMode === 'add' || isEditingExercise;
  const activeRoutineName = activeRoutine?.name;

  return (
    <section className="viewport-locked mx-auto flex max-w-md select-none flex-col gap-0 overflow-hidden bg-[#131b26] px-3.5 py-3 text-slate-100">
      {/* 설정 하위 화면 헤더 */}
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-slate-650 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 shadow-md transition-all hover:bg-slate-650 active:scale-95"
            aria-label={locale === 'ko' ? '설정으로 돌아가기' : 'Back to Settings'}
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <div>
            <p className="text-xs font-black uppercase leading-none text-cyan-300">{t(locale, 'settings')}</p>
            <h1 className="mt-0.5 text-lg font-extrabold text-white">
              {setupTab === 'routine' ? t(locale, 'routine') : setupTab === 'library' ? t(locale, 'exerciseLibrary') : t(locale, 'weeklyPlan')}
            </h1>
          </div>
        </div>
      </header>

      {/* 2. 중앙 본문 스크롤 영역 (flex-1 overflow-y-auto overscroll-contain) */}
      <div className="inner-scroll -mx-2 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2 py-2.5 scrollbar-none">
        {/* 탭: 루틴 설정 */}
        {setupTab === 'routine' && (
          <div className="flex flex-col gap-2.5">
            <section className="shrink-0 space-y-2.5 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-md">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'activeRoutine')}</p>
                <button
                  type="button"
                  onClick={() => void handleCreateCustomRoutine()}
                  className="flex min-h-8 items-center gap-1 rounded-lg border border-cyan-500/45 bg-slate-850 px-2.5 text-xs font-bold text-cyan-300 active:scale-95"
                >
                  <Plus aria-hidden="true" size={13} />
                  <span>{locale === 'ko' ? '직접 만들기' : 'New'}</span>
                </button>
              </div>
              {savedRoutines.length > 0 ? (
                <select
                  aria-label={locale === 'ko' ? '활성 루틴 선택' : 'Select active routine'}
                  value={activeRoutine?.id ?? ''}
                  onChange={(event) => void handleSelectStoredRoutine(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  {savedRoutines.map((routine) => (
                    <option key={routine.id} value={routine.id}>{routine.name}</option>
                  ))}
                </select>
              ) : (
                <h2 className="text-sm font-bold text-slate-200">{t(locale, 'noActiveRoutine')}</h2>
              )}
              {activeRoutine ? (
                <label className="block text-xs font-bold text-slate-200">
                  {locale === 'ko' ? '루틴 이름' : 'Routine name'}
                  <input
                    key={activeRoutine.id}
                    aria-label="Active routine name"
                    type="text"
                    defaultValue={activeRoutineName}
                    onBlur={(event) => void handleUpdateRoutineName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-850 px-3.5 py-2 text-base font-bold text-white outline-none transition-all focus:ring-1 focus:ring-cyan-400"
                  />
                </label>
              ) : null}
              <button
                type="button"
                aria-expanded={showRoutineTemplates}
                onClick={() => setShowRoutineTemplates((current) => !current)}
                className="flex min-h-10 w-full items-center justify-between rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100"
              >
                <span>{locale === 'ko' ? '템플릿에서 시작' : 'Start from template'}</span>
                <span className="text-cyan-300">{showRoutineTemplates ? '−' : '+'}</span>
              </button>
              {showRoutineTemplates ? (
                <div className="grid gap-2 border-t border-slate-650 pt-2.5">
                  {routineTemplates.map((template) => {
                    const isSaving = savingSplitType === template.splitType;
                    return (
                      <button
                        key={template.splitType}
                        type="button"
                        onClick={() => void handleActivate(template.splitType)}
                        className="rounded-xl border border-slate-650 bg-slate-850 p-3 text-left transition-all hover:bg-slate-700 active:scale-[0.98]"
                      >
                        <h2 className="text-sm font-black text-white">{getRoutineTemplateName(template, locale)}</h2>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-100">{getRoutineTemplateSummary(template, locale)}</p>
                        <p className="mt-2 text-xs font-black uppercase text-cyan-300">
                          {isSaving ? (locale === 'ko' ? '생성 중...' : 'Creating...') : (locale === 'ko' ? '선택' : 'Choose')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        )}

        {/* 탭: 주간 계획 */}
        {setupTab === 'schedule' && (
          <section className="shrink-0 space-y-2.5 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-md">
            <p className="text-xs font-bold uppercase text-slate-200">{t(locale, 'weeklyPlan')}</p>
            <div className="rounded-xl border border-slate-650 bg-slate-850 px-3.5 py-2.5">
              <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 text-sm font-black text-white">{activeRoutineName ?? t(locale, 'noActiveRoutine')}</h2>
              <p className="mt-1 text-xs font-medium leading-normal text-slate-100">{t(locale, 'routinePlanFor')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-slate-100">
                {locale === 'ko' ? '시작일' : 'Start date'}
                <input
                  type="date"
                  value={scheduleStartDate}
                  onChange={(event) => {
                    setScheduleStartDate(event.target.value);
                    setScheduleDirty(true);
                  }}
                  className="mt-1 min-h-10 w-full rounded-xl border border-slate-650 bg-slate-850 px-2 text-sm font-semibold text-white"
                />
              </label>
              <label className="text-xs font-bold text-slate-100">
                {locale === 'ko' ? '종료일' : 'End date'}
                <input
                  type="date"
                  value={scheduleEndDate}
                  onChange={(event) => {
                    setScheduleEndDate(event.target.value);
                    setScheduleDirty(true);
                  }}
                  className="mt-1 min-h-10 w-full rounded-xl border border-slate-650 bg-slate-850 px-2 text-sm font-semibold text-white"
                />
              </label>
            </div>
            <div className="space-y-2">
              {weeklySchedule.map((schedule) => (
                <label
                  key={schedule.weekday}
                  className="grid grid-cols-[4rem_1fr] items-center gap-3 text-xs font-black uppercase text-slate-100"
                >
                  <span>{weekdayLabels[locale][schedule.weekday]}</span>
                  <select
                    aria-label={`${weekdayLabels[locale][schedule.weekday]} routine day`}
                    value={schedule.isRestDay ? '' : schedule.routineDayId ?? ''}
                    onChange={(event) => handleWeeklyScheduleChange(schedule.weekday, event.target.value)}
                    className="min-h-9 w-full cursor-pointer rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100 outline-none focus:ring-1 focus:ring-cyan-400"
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
            {scheduleStatus ? <p className="rounded-xl bg-cyan-950 px-3 py-2 text-xs font-bold text-cyan-200">{scheduleStatus}</p> : null}
            <div className="grid grid-cols-2 gap-2 border-t border-slate-650 pt-2.5">
              <button
                type="button"
                onClick={() => void handleCancelWeeklySchedule()}
                className="min-h-11 rounded-xl border border-slate-650 bg-slate-850 text-sm font-bold text-slate-100"
              >
                {locale === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveWeeklySchedule()}
                disabled={!activeRoutine || !scheduleDirty || !scheduleStartDate || !scheduleEndDate || scheduleEndDate < scheduleStartDate}
                className="min-h-11 rounded-xl bg-cyan-400 text-sm font-black text-slate-950 disabled:bg-slate-650 disabled:text-slate-400"
              >
                {t(locale, 'save')}
              </button>
            </div>
            <button
              type="button"
              onClick={onReviewCalendar}
              disabled={scheduleDirty || !activeRoutine}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-850 text-sm font-bold text-cyan-300 disabled:border-slate-650 disabled:text-slate-500"
            >
              <CalendarDays aria-hidden="true" size={17} />
              <span>{scheduleDirty ? (locale === 'ko' ? '저장 후 캘린더에서 확인' : 'Save before preview') : (locale === 'ko' ? '캘린더에서 확인' : 'Review in calendar')}</span>
            </button>
          </section>
        )}

        {/* 탭: 운동 설정 (라이브러리) */}
        {setupTab === 'library' && (
          <section className="shrink-0 space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-md">
            <div>
              <p className="text-xs font-extrabold uppercase text-slate-200">{t(locale, 'exerciseLibrary')}</p>
              <h2 className="mt-0.5 text-base font-bold text-white">
                {locale === 'ko' ? `${exerciseLibrary.length}개의 등록된 운동` : `${exerciseLibrary.length} Exercises`}
              </h2>
            </div>

            <nav className="grid grid-cols-2 gap-1 rounded-xl border border-slate-650 bg-slate-850 p-1">
              {([
                ['browse', locale === 'ko' ? '검색 / 변경' : 'Search / Edit'],
                ['add', locale === 'ko' ? '운동 추가' : 'Add Exercise'],
              ] as Array<[ExerciseLibraryMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void handleExerciseLibraryModeChange(value)}
                  className={`min-h-9 rounded-lg text-sm font-bold ${exerciseLibraryMode === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* 운동 검색 */}
            {exerciseLibraryMode === 'browse' ? (
              <div className="grid gap-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-650 bg-slate-850 px-3.5 py-2 shadow-inner focus-within:ring-1 focus-within:ring-cyan-400">
                  <Search aria-hidden="true" size={15} className="shrink-0 text-slate-200" />
                  <input
                    aria-label="Search exercise library"
                    type="search"
                    value={exerciseSearch}
                    onChange={(event) => setExerciseSearch(event.target.value)}
                    placeholder={t(locale, 'searchExercises')}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    aria-label="Exercise category filter"
                    value={exerciseCategoryFilter}
                    onChange={(event) => setExerciseCategoryFilter(event.target.value as ExerciseCategory | 'all')}
                    className="min-h-10 rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-white"
                  >
                    {exerciseCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.value === 'all' ? t(locale, 'all') : labelForCategory(category.value, locale)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowHiddenExercises((current) => !current)}
                    className="min-h-10 rounded-xl border border-slate-650 bg-slate-850 px-3 text-xs font-bold text-slate-100"
                  >
                    {showHiddenExercises ? (locale === 'ko' ? '사용 중' : 'Active') : (locale === 'ko' ? '숨긴 운동' : 'Hidden')}
                  </button>
                </div>
              </div>
            ) : null}

            {/* 운동 목록 세로 2열 그리드 */}
            {exerciseLibraryMode === 'browse' ? <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 border-t border-slate-900 pt-3 scrollbar-thin">
              {filteredExerciseLibrary.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => handleSelectExercise(exercise)}
                  className={`flex items-center rounded-xl p-2 text-left border transition-all active:scale-95 ${
                    editingExercise?.id === exercise.id
                      ? 'bg-cyan-400 border-cyan-400 text-slate-950 font-bold shadow-sm'
                      : 'border-slate-650 bg-slate-850 text-slate-100 hover:border-cyan-400/50 hover:bg-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm shadow-inner ${
                    editingExercise?.id === exercise.id ? 'bg-slate-950/20 text-slate-950' : 'border border-slate-650 bg-slate-750'
                  }`}>
                    {getExerciseIcon(exercise.defaultEmoji)}
                  </div>
                  <div className="min-w-0 flex-1 ml-2">
                    <span className="block truncate text-xs font-black leading-tight">{getExerciseName(exercise, locale)}</span>
                    <span className={`mt-0.5 block truncate text-[11px] ${editingExercise?.id === exercise.id ? 'font-semibold text-slate-950/80' : 'text-slate-200'}`}>
                      {getExerciseCategories(exercise).map((c) => labelForCategory(c, locale)).join('/')}
                    </span>
                  </div>
                </button>
              ))}
            </div> : null}

            {/* 선택 운동 상세 조회 및 명시적 편집 */}
            {editingExercise && (
              <div key={editingExercise.id} className="space-y-3 rounded-2xl border border-slate-650 bg-slate-850/85 p-3.5 shadow-inner">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-650 bg-slate-750 text-sm">
                      {getExerciseIcon(editingExercise.defaultEmoji)}
                    </div>
                    <h3 className="text-xs font-bold text-white leading-tight">
                      {editingExercise.nameKo ? getExerciseName(editingExercise, locale) : (locale === 'ko' ? '새 운동' : 'New exercise')}
                    </h3>
                  </div>
                  {!exerciseEditorOpen ? (
                    <button
                      type="button"
                      onClick={() => handleBeginExerciseEdit(editingExercise)}
                      className="min-h-8 shrink-0 rounded-lg bg-cyan-400 px-3 text-xs font-black text-slate-950"
                    >
                      {locale === 'ko' ? '변경' : 'Edit'}
                    </button>
                  ) : editingExercise.isActive && exerciseLibraryMode !== 'add' ? (
                    <button
                      type="button"
                      onClick={() => void handleDeactivateExercise(editingExercise.id)}
                      className="min-h-8 shrink-0 rounded-lg border border-slate-650 bg-slate-750 px-2.5 text-xs font-bold text-rose-300"
                    >
                      {locale === 'ko' ? '목록에서 숨기기' : 'Hide from list'}
                    </button>
                  ) : exerciseLibraryMode !== 'add' ? (
                    <button
                      type="button"
                      onClick={() => void handleRestoreExercise(editingExercise.id)}
                      className="min-h-8 shrink-0 rounded-lg border border-cyan-500/40 bg-slate-750 px-2.5 text-xs font-bold text-cyan-300"
                    >
                      {locale === 'ko' ? '목록에 복원' : 'Restore'}
                    </button>
                  ) : null}
                </div>

                {exerciseEditorOpen ? (
                  <>
                <div className="grid gap-2.5">
                  <label className="text-xs font-bold uppercase text-slate-200">
                    {t(locale, 'koreanName')}
                    <input
                      aria-label="Edit exercise Korean name"
                      type="text"
                      defaultValue={editingExercise.nameKo}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameKo: event.target.value.trim() || editingExercise.nameKo })}
                      className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-750 px-3 py-2 text-sm font-medium text-slate-100 outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-slate-200">
                    {t(locale, 'englishName')}
                    <input
                      aria-label="Edit exercise English name"
                      type="text"
                      defaultValue={editingExercise.nameEn ?? ''}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameEn: event.target.value.trim() || undefined })}
                      className="mt-1 w-full rounded-xl border border-slate-650 bg-slate-750 px-3 py-2 text-sm font-medium text-slate-100 outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-slate-200">
                    {t(locale, 'description')}
                    <textarea
                      aria-label="Edit exercise description"
                      defaultValue={editingExercise.description ?? ''}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { description: event.target.value.trim() || undefined })}
                      rows={2}
                      className="mt-1 w-full resize-none rounded-xl border border-slate-650 bg-slate-750 px-3 py-2 text-sm font-medium text-slate-100 outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </label>
                </div>

                <div className="space-y-3.5 pt-1 border-t border-slate-900">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-200">{t(locale, 'categories')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {exerciseCategoryOptions.map((category) => {
                        const selected = getExerciseCategories(editingExercise).includes(category.value);
                        return (
                          <button
                            key={category.value}
                            type="button"
                            onClick={() => void handleUpdateExercise(editingExercise.id, {
                              categoryTags: toggleCategory(editingExercise, category.value),
                            })}
                            className={`min-h-8 rounded-lg px-2.5 text-xs font-bold transition-all active:scale-95 ${
                              selected
                                ? 'bg-cyan-400 text-slate-950 font-black shadow-sm'
                                : 'border border-slate-650 bg-slate-750 text-slate-100 hover:bg-slate-650'
                            }`}
                          >
                            {labelForCategory(category.value, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-200">{t(locale, 'stages')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {exerciseStageOptions.map((stage) => {
                        const selected = getExerciseStages(editingExercise).includes(stage.value);
                        return (
                          <button
                            key={stage.value}
                            type="button"
                            onClick={() => void handleUpdateExercise(editingExercise.id, {
                              stageTags: toggleStage(editingExercise, stage.value),
                            })}
                            className={`min-h-8 rounded-lg px-2.5 text-xs font-bold transition-all active:scale-95 ${
                              selected
                                ? 'bg-cyan-400 text-slate-950 font-black shadow-sm'
                                : 'border border-slate-650 bg-slate-750 text-slate-100 hover:bg-slate-650'
                            }`}
                          >
                            {labelForStage(stage.value, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-650 pt-3">
                  <button
                    type="button"
                    onClick={() => void handleCancelExerciseChanges()}
                    className="min-h-10 rounded-xl border border-slate-650 bg-slate-750 text-sm font-bold text-slate-100"
                  >
                    {locale === 'ko' ? '취소' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveExerciseChanges()}
                    disabled={!editingExercise.nameKo.trim()}
                    className="min-h-10 rounded-xl bg-cyan-400 text-sm font-black text-slate-950 disabled:bg-slate-650 disabled:text-slate-400"
                  >
                    {t(locale, 'save')}
                  </button>
                </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-650 bg-slate-750 p-3 text-xs">
                      <div>
                        <p className="font-bold uppercase text-slate-300">{t(locale, 'koreanName')}</p>
                        <p className="mt-1 text-sm font-bold text-white">{editingExercise.nameKo}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase text-slate-300">{t(locale, 'englishName')}</p>
                        <p className="mt-1 text-sm font-bold text-white">{editingExercise.nameEn ?? '-'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-650 bg-slate-750 p-3">
                      <p className="text-xs font-bold uppercase text-slate-300">{t(locale, 'description')}</p>
                      <p className="mt-1 text-sm font-medium leading-5 text-slate-100">
                        {editingExercise.description || (locale === 'ko' ? '설명이 없습니다.' : 'No description.')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-650 bg-slate-750 p-3">
                        <p className="text-xs font-bold uppercase text-slate-300">{t(locale, 'categories')}</p>
                        <p className="mt-1 text-sm font-bold text-white">
                          {getExerciseCategories(editingExercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-650 bg-slate-750 p-3">
                        <p className="text-xs font-bold uppercase text-slate-300">{t(locale, 'stages')}</p>
                        <p className="mt-1 text-sm font-bold text-white">
                          {getExerciseStages(editingExercise).map((stage) => labelForStage(stage, locale)).join(' / ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 요일별 계획 목록 & 운동 세부 계획 편집 (루틴 설정 탭 내부) */}
        {dayPlans.length > 0 && setupTab === 'routine' && (
          <section className="shrink-0 space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-md">
            <div className="flex items-center justify-between gap-3 border-b border-slate-650 pb-2.5">
              <p className="text-xs font-bold uppercase text-slate-200">{t(locale, 'routineDays')}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleRevertRoutineChanges()}
                  className="flex min-h-8 items-center gap-1 rounded-lg border border-slate-650 bg-slate-850 px-2 text-xs font-bold text-slate-100"
                >
                  <RotateCcw aria-hidden="true" size={12} />
                  <span>{locale === 'ko' ? '취소' : 'Cancel'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveRoutineChanges()}
                  className="min-h-8 rounded-lg bg-cyan-400 px-3 text-xs font-black text-slate-950"
                >
                  {t(locale, 'save')}
                </button>
              </div>
            </div>
            {resetStatus && (
              <p className="rounded-xl bg-cyan-950/80 border border-cyan-900/50 px-3 py-2 text-xs font-bold text-cyan-200">
                {resetStatus}
              </p>
            )}

            {/* 요일 칩 가로 스크롤 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {dayPlans.map((dayPlan) => (
                <button
                  key={dayPlan.routineDay.id}
                  type="button"
                  onClick={() => setSelectedDayId(dayPlan.routineDay.id)}
                  className={`min-h-8 shrink-0 rounded-full px-3.5 text-xs font-black transition-all active:scale-95 border ${
                    selectedDay?.routineDay.id === dayPlan.routineDay.id
                      ? 'bg-cyan-400 border-cyan-400 text-slate-950 shadow-sm'
                      : 'border-slate-650 bg-slate-850 text-slate-100 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
                </button>
              ))}
            </div>

            {selectedDay && (
              <div className="space-y-3.5">
                {/* 루틴 요일 이름 수정 인풋 */}
                <div className="flex items-center justify-between gap-2.5">
                  <input
                    key={selectedDay.routineDay.id}
                    aria-label="Routine day name"
                    type="text"
                    defaultValue={selectedDay.routineDay.name}
                    onBlur={(event) => void handleUpdateRoutineDayName(selectedDay.routineDay.id, event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-slate-650 bg-slate-850 px-3.5 py-2 text-base font-black text-white outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddingDayId((current) => (
                        current === selectedDay.routineDay.id ? undefined : selectedDay.routineDay.id
                      ));
                      resetRoutineAddFinderState();
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 active:scale-95 transition-all shadow-md"
                    aria-label={`Add exercise to ${selectedDay.routineDay.name}`}
                  >
                    <Plus aria-hidden="true" size={18} />
                  </button>
                </div>

                {/* 운동 추가 검색창 (해당 요일에 활성화 시 노출) */}
                {addingDayId === selectedDay.routineDay.id && (
                  <div className="rounded-xl border border-cyan-500/25 bg-slate-850 p-2.5 shadow-inner">
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
                )}

                {/* 루틴 계획 운동 목록 */}
                <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1 scrollbar-thin">
                  {selectedDay.plans.length === 0 ? (
                    <p className="rounded-2xl border border-slate-650 bg-slate-850/70 px-4 py-5 text-center text-sm font-semibold leading-relaxed text-slate-100">
                      {t(locale, 'noPlannedExercises')}
                    </p>
                  ) : (
                    selectedDay.plans.map(({ plan, exercise }, planIndex) => (
                      <div key={plan.id} className="space-y-2.5 rounded-2xl border border-slate-650 bg-slate-850/85 p-3 shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8.5 h-8.5 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-base shrink-0">
                              {getExerciseIcon(exercise.defaultEmoji)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black leading-tight text-white">{getExerciseName(exercise, locale)}</p>
                              <p className="mt-0.5 truncate text-xs font-bold text-slate-200">
                                {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleMovePlan(plan.id, -1)}
                              disabled={planIndex === 0}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-650 bg-slate-750 text-slate-100 transition-all hover:bg-slate-650 hover:text-white disabled:pointer-events-none disabled:opacity-30 active:scale-95"
                              aria-label={`Move ${getExerciseName(exercise, locale)} up`}
                            >
                              <ArrowUp aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleMovePlan(plan.id, 1)}
                              disabled={planIndex === selectedDay.plans.length - 1}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-650 bg-slate-750 text-slate-100 transition-all hover:bg-slate-650 hover:text-white disabled:pointer-events-none disabled:opacity-30 active:scale-95"
                              aria-label={`Move ${getExerciseName(exercise, locale)} down`}
                            >
                              <ArrowDown aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePlan(plan.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-slate-850 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 active:scale-95 transition-all"
                              aria-label={`Remove ${getExerciseName(exercise, locale)} from ${selectedDay.routineDay.name}`}
                            >
                              <Trash2 aria-hidden="true" size={13} />
                            </button>
                          </div>
                        </div>

                        {/* 계획 세트 및 횟수 설정 계기판 */}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-900">
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-slate-200">Sets</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned sets`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={plan.plannedSets ?? 3}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedSets: Math.max(1, Number(event.target.value) || 1),
                              })}
                              className="w-full rounded-xl border border-slate-650 bg-slate-750 py-2 text-center text-sm font-black text-slate-100 outline-none transition-all focus:ring-1 focus:ring-cyan-400"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-slate-200">Kg</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned weight`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={plan.plannedWeightKg ?? ''}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedWeightKg: Number(event.target.value) || undefined,
                              })}
                              className="w-full rounded-xl border border-slate-650 bg-slate-750 py-2 text-center text-sm font-black text-slate-100 outline-none transition-all focus:ring-1 focus:ring-cyan-400"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-slate-200">Reps</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned reps`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={plan.plannedReps ?? 10}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedReps: Math.max(0, Number(event.target.value) || 0),
                              })}
                              className="w-full rounded-xl border border-slate-650 bg-slate-750 py-2 text-center text-sm font-black text-slate-100 outline-none transition-all focus:ring-1 focus:ring-cyan-400"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-slate-200">RIR</span>
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
                              className="w-full rounded-xl border border-slate-650 bg-slate-750 py-2 text-center text-sm font-black text-slate-100 outline-none transition-all focus:ring-1 focus:ring-cyan-400"
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
