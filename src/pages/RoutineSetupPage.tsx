import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, Copy, Play, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
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
  deleteStoredRoutine,
  duplicateStoredRoutine,
  getActiveRoutineCyclePlan,
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
  saveRoutineCyclePlan,
  updateActiveRoutineName,
  updateRoutineExercisePlan,
  updateRoutineDayName,
  type RoutineDayPlan,
  type RoutineCyclePlanView,
  type WeeklyScheduleView,
} from '../db/routines';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage, Routine, RoutineDay, RoutineExercisePlan, RoutineSplitType, Weekday, WorkoutPlanKind } from '../types';

type RoutineSetupPageProps = {
  initialSection: SetupTab;
  onBack?: () => void;
  onRoutineSaved: () => void;
  onReviewCalendar: (dateKey: string) => void;
  onStartRoutineDay: (routineDayId: string) => void;
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

export function RoutineSetupPage({
  initialSection,
  onBack,
  onRoutineSaved,
  onReviewCalendar,
  onStartRoutineDay,
}: RoutineSetupPageProps) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | undefined>();
  const [savedRoutines, setSavedRoutines] = useState<Routine[]>([]);
  const [showRoutineCreator, setShowRoutineCreator] = useState(false);
  const [showRoutineRename, setShowRoutineRename] = useState(false);
  const [savingSplitType, setSavingSplitType] = useState<RoutineSplitType | undefined>();
  const [dayPlans, setDayPlans] = useState<RoutineDayPlan[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseMaster[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleView[]>([]);
  const [cyclePlan, setCyclePlan] = useState<RoutineCyclePlanView[]>([]);
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
  const [setupTab, setSetupTab] = useState<SetupTab>(initialSection);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | undefined>();
  const [resetStatus, setResetStatus] = useState<string | undefined>();
  const initialRoutinePlanSnapshot = useRef<RoutinePlanSnapshot | undefined>(undefined);
  const initialExerciseSnapshot = useRef<ExerciseMaster | undefined>(undefined);

  async function loadSetup(captureRoutineSnapshot = false) {
    await seedDefaultExercises();

    const [routine, plans, schedule, savedCyclePlan, exerciseMasters, allExerciseMasters, routines] = await Promise.all([
      getActiveRoutine(),
      getActiveRoutineDayPlans(),
      getActiveWeeklySchedule(),
      getActiveRoutineCyclePlan(),
      db.exercises.filter((exercise) => exercise.isActive && !getExerciseCategories(exercise).includes('cardio')).toArray(),
      db.exercises.toArray(),
      getAllRoutines(),
    ]);

    setActiveRoutine(routine);
    setDayPlans(plans);
    setWeeklySchedule(schedule);
    setCyclePlan(savedCyclePlan.map((item) => ({
      id: item.id,
      order: item.order,
      kind: item.kind,
      routineDayId: item.routineDayId,
    })));
    setExercises(exerciseMasters);
    setExerciseLibrary(allExerciseMasters);
    setSavedRoutines(routines);
    setSelectedDayId((current) => current ?? plans[0]?.routineDay.id);
    const today = new Date().toISOString().slice(0, 10);
    setScheduleStartDate(routine?.endDate ? routine.startDate : today);
    setScheduleEndDate(addDays(routine?.startDate ?? today, 60));
    setScheduleDirty(false);

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

  useEffect(() => {
    setSetupTab(initialSection);
  }, [initialSection]);

  async function handleActivate(splitType: RoutineSplitType) {
    const template = routineTemplates.find((item) => item.splitType === splitType);
    if (!template) return;

    setSavingSplitType(splitType);
    const routine = await activateRoutineTemplate(template);
    setActiveRoutine(routine);
    setSelectedDayId(undefined);
    setSavingSplitType(undefined);
    setShowRoutineCreator(false);
    setShowRoutineRename(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleCreateCustomRoutine() {
    const routine = await createCustomRoutine(locale === 'ko' ? '나의 루틴' : 'My Routine');
    setActiveRoutine(routine);
    setSelectedDayId(undefined);
    setShowRoutineCreator(false);
    setShowRoutineRename(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleSelectStoredRoutine(routineId: string) {
    await activateStoredRoutine(routineId);
    setSelectedDayId(undefined);
    setShowRoutineRename(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleDuplicateActiveRoutine() {
    if (!activeRoutine) return;

    await duplicateStoredRoutine(
      activeRoutine.id,
      locale === 'ko' ? `${activeRoutine.name} 복사본` : `${activeRoutine.name} Copy`,
    );
    setSelectedDayId(undefined);
    setShowRoutineRename(true); // Automatically show rename input for copied routine
    onRoutineSaved();
    await loadSetup(true);
  }

  async function handleDeleteActiveRoutine() {
    if (!activeRoutine) return;
    const confirmMsg = locale === 'ko'
      ? `"${activeRoutine.name}" 루틴을 정말 삭제하시겠습니까? 연결된 모든 세부 계획과 일정이 완전히 삭제됩니다.`
      : `Are you sure you want to delete "${activeRoutine.name}"? All associated detailed plans and schedules will be completely removed.`;

    if (!window.confirm(confirmMsg)) return;

    await deleteStoredRoutine(activeRoutine.id);
    setSelectedDayId(undefined);
    setShowRoutineRename(false);
    onRoutineSaved();
    await loadSetup(true);
  }

  const getRoutineSummaryInfo = () => {
    if (!activeRoutine) return null;
    const dayCount = dayPlans.length;
    const totalExercises = dayPlans.reduce((sum, d) => sum + d.plans.length, 0);

    let scheduleSummary = '';
    if (cyclePlan && cyclePlan.length > 0) {
      scheduleSummary = locale === 'ko'
        ? `${cyclePlan.length}일 주기 사이클`
        : `${cyclePlan.length}-day rotation cycle`;
    } else if (weeklySchedule && weeklySchedule.length > 0) {
      const activeDays = weeklySchedule
        .filter((w) => !w.isRestDay)
        .map((w) => weekdayLabels[locale as 'ko' | 'en'][w.weekday]);
      if (activeDays.length > 0) {
        scheduleSummary = locale === 'ko'
          ? `주 ${activeDays.length}회 (${activeDays.join(', ')})`
          : `${activeDays.length}x / week (${activeDays.join(', ')})`;
      } else {
        scheduleSummary = locale === 'ko' ? '설정된 운동 일정 없음' : 'No workout schedule set';
      }
    } else {
      scheduleSummary = locale === 'ko' ? '설정된 운동 일정 없음' : 'No workout schedule set';
    }

    return {
      dayCount,
      totalExercises,
      scheduleSummary,
    };
  };

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
    values: Partial<Pick<RoutineExercisePlan, 'plannedSets' | 'plannedWeightKg' | 'plannedReps' | 'plannedRir' | 'plannedRestSeconds' | 'preferredWeightIncrementKg'>>,
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

  function createDefaultCyclePlan(): RoutineCyclePlanView[] {
    const routineItems = dayPlans.map((dayPlan, index) => ({
      order: index + 1,
      kind: 'routine' as const,
      routineDayId: dayPlan.routineDay.id,
    }));

    return [
      ...routineItems,
      {
        order: routineItems.length + 1,
        kind: 'rest' as const,
      },
    ];
  }

  function normalizeCyclePlanOrder(items: RoutineCyclePlanView[]): RoutineCyclePlanView[] {
    return items.map((item, index) => ({ ...item, order: index + 1 }));
  }

  function handleStartCyclePlan() {
    setCyclePlan(createDefaultCyclePlan());
    setScheduleDirty(true);
  }

  function handleAddCycleItem(kind: WorkoutPlanKind) {
    setCyclePlan((current) => normalizeCyclePlanOrder([
      ...current,
      {
        order: current.length + 1,
        kind,
        routineDayId: kind === 'routine' ? dayPlans[0]?.routineDay.id : undefined,
      },
    ]));
    setScheduleDirty(true);
  }

  function handleCycleItemChange(index: number, value: string) {
    setCyclePlan((current) => normalizeCyclePlanOrder(current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (value === 'rest' || value === 'running') {
        return { ...item, kind: value, routineDayId: undefined };
      }

      return {
        ...item,
        kind: 'routine',
        routineDayId: value.replace(/^routine:/, ''),
      };
    })));
    setScheduleDirty(true);
  }

  function handleMoveCycleItem(index: number, direction: -1 | 1) {
    setCyclePlan((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = current.slice();
      const currentItem = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = currentItem;
      return normalizeCyclePlanOrder(next);
    });
    setScheduleDirty(true);
  }

  function handleDeleteCycleItem(index: number) {
    setCyclePlan((current) => normalizeCyclePlanOrder(current.filter((_, itemIndex) => itemIndex !== index)));
    setScheduleDirty(true);
  }

  async function handleSaveWeeklySchedule() {
    if (!activeRoutine || !scheduleStartDate || cyclePlan.length === 0) return;
    const parsedDate = new Date(`${scheduleStartDate}T12:00:00`);
    if (isNaN(parsedDate.getTime())) {
      setScheduleStatus(locale === 'ko' ? '올바른 시작일을 입력해 주세요.' : 'Please enter a valid start date.');
      window.setTimeout(() => setScheduleStatus(undefined), 2000);
      return;
    }
    await saveRoutineCyclePlan(activeRoutine.id, scheduleStartDate, cyclePlan);
    setScheduleDirty(false);
    setScheduleStatus(locale === 'ko' ? '운동 사이클 계획을 저장했습니다.' : 'Weekly plan saved.');
    onRoutineSaved();
    window.setTimeout(() => setScheduleStatus(undefined), 1600);
  }

  async function handleReviewCycleCalendar() {
    if (!activeRoutine || !scheduleStartDate || cyclePlan.length === 0) return;
    const parsedDate = new Date(`${scheduleStartDate}T12:00:00`);
    if (isNaN(parsedDate.getTime())) {
      setScheduleStatus(locale === 'ko' ? '올바른 시작일을 입력해 주세요.' : 'Please enter a valid start date.');
      window.setTimeout(() => setScheduleStatus(undefined), 2000);
      return;
    }
    if (scheduleDirty) {
      await saveRoutineCyclePlan(activeRoutine.id, scheduleStartDate, cyclePlan);
      setScheduleDirty(false);
      onRoutineSaved();
    }
    onReviewCalendar(scheduleStartDate);
  }

  async function handleCancelWeeklySchedule() {
    await loadSetup();
    setScheduleStatus(locale === 'ko' ? '변경을 취소했습니다.' : 'Changes discarded.');
    window.setTimeout(() => setScheduleStatus(undefined), 1600);
  }

  async function handleUpdateRoutineName(name: string) {
    await updateActiveRoutineName(name);
    setShowRoutineRename(false);
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
  const selectedDayLabel = selectedDay ? getRoutineDayDisplayName(selectedDay.routineDay, locale) : undefined;
  const selectedDayExerciseCount = selectedDay?.plans.length ?? 0;
  const routineSummary = getRoutineSummaryInfo();

  return (
    <section className="viewport-locked ios-screen mx-auto flex max-w-md select-none flex-col gap-0 overflow-hidden px-3.5 py-3 text-[#1C1C1E]">
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-[#D1D1D6] pb-2.5">
        <div className="flex items-center gap-2.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#1C1C1E] shadow-md transition-all hover:bg-[#F2F2F7] active:scale-95"
              aria-label={locale === 'ko' ? '이전 화면으로 돌아가기' : 'Back'}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
          ) : null}
          <div>
            <p className="text-xs font-black uppercase leading-none text-accent-dark">{t(locale, 'routines')}</p>
            <h1 className="mt-0.5 text-lg font-extrabold text-[#1C1C1E]">
              {setupTab === 'routine' ? t(locale, 'routine') : setupTab === 'library' ? t(locale, 'exerciseLibrary') : t(locale, 'weeklyPlan')}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F2F2F7] p-1">
          {([
            ['routine', t(locale, 'routine')],
            ['library', t(locale, 'exerciseLibrary')],
            ['schedule', t(locale, 'weeklyPlan')],
          ] as Array<[SetupTab, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSetupTab(value)}
              className={`min-h-9 rounded-lg px-1.5 text-xs font-black transition-all active:scale-95 ${
                setupTab === value
                  ? 'bg-white text-[#1C1C1E] shadow-sm'
                  : 'text-[#6E6E73] hover:text-[#1C1C1E]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main scrolling content */}
      <div className="inner-scroll -mx-2 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2 py-2.5 scrollbar-none">
        {/* 루틴 설정 */}
        {setupTab === 'routine' && (
          <div className="flex flex-col gap-2.5">
            <section className="ios-card shrink-0 space-y-3.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase text-[#8E8E93]">{t(locale, 'activeRoutine')}</p>
                  <h2 className="mt-1 truncate text-xl font-black leading-tight text-[#1C1C1E]">
                    {activeRoutineName ?? t(locale, 'noActiveRoutine')}
                  </h2>
                  {selectedDayLabel ? (
                    <p className="mt-1 text-xs font-bold text-[#159A91]">
                      {locale === 'ko'
                        ? `선택한 운동: ${selectedDayLabel}`
                        : `Selected day: ${selectedDayLabel}`}
                    </p>
                  ) : null}
                </div>
                {savedRoutines.length > 0 ? (
                  <select
                    aria-label={locale === 'ko' ? '활성 루틴 선택' : 'Select active routine'}
                    value={activeRoutine?.id ?? ''}
                    onChange={(event) => void handleSelectStoredRoutine(event.target.value)}
                    className="min-h-9 max-w-[8rem] shrink-0 rounded-xl border border-[#D1D1D6] bg-white px-2 text-xs font-bold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                  >
                    {savedRoutines.map((routine) => (
                      <option key={routine.id} value={routine.id}>{routine.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>

              {activeRoutine ? (
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-black/5 bg-[#F2F2F7] p-2.5 text-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-[#8E8E93]">
                      {locale === 'ko' ? '분할' : 'Days'}
                    </span>
                    <span className="mt-0.5 block text-sm font-black text-[#1C1C1E]">{routineSummary?.dayCount ?? 0}</span>
                  </div>
                  <div className="border-x border-[#E5E5EA]">
                    <span className="block text-[10px] font-bold uppercase text-[#8E8E93]">
                      {locale === 'ko' ? '운동' : 'Exercises'}
                    </span>
                    <span className="mt-0.5 block text-sm font-black text-[#1C1C1E]">{routineSummary?.totalExercises ?? 0}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-[#8E8E93]">
                      {locale === 'ko' ? '일정' : 'Schedule'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-black text-[#1C1C1E]" title={routineSummary?.scheduleSummary ?? ''}>
                      {routineSummary?.scheduleSummary ?? '-'}
                    </span>
                  </div>
                </div>
              ) : null}

              {dayPlans.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {dayPlans.map((dayPlan) => (
                      <button
                        key={dayPlan.routineDay.id}
                        type="button"
                        onClick={() => setSelectedDayId(dayPlan.routineDay.id)}
                        className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-black transition-all active:scale-95 ${
                          selectedDay?.routineDay.id === dayPlan.routineDay.id
                            ? 'border-transparent bg-[#2EC4B6] text-white shadow-sm'
                            : 'border-[#D1D1D6] bg-white text-[#6E6E73] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]'
                        }`}
                      >
                        {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedDay && onStartRoutineDay(selectedDay.routineDay.id)}
                    disabled={!selectedDay}
                    className="ios-button-primary flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm disabled:pointer-events-none disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] disabled:shadow-none"
                  >
                    <Play aria-hidden="true" size={16} />
                    <span>
                      {selectedDayLabel
                        ? locale === 'ko'
                          ? `${selectedDayLabel} 시작`
                          : `Start ${selectedDayLabel}`
                        : t(locale, 'startWorkout')}
                    </span>
                  </button>
                  <p className="text-center text-[11px] font-semibold text-[#8E8E93]">
                    {locale === 'ko'
                      ? `${selectedDayExerciseCount}개 운동으로 바로 기록을 시작합니다.`
                      : `Starts logging with ${selectedDayExerciseCount} exercises.`}
                  </p>
                </div>
              ) : null}

              {activeRoutine && showRoutineRename ? (
                <label className="block text-xs font-bold text-[#6E6E73]">
                  {locale === 'ko' ? '새 이름' : 'New name'}
                  <input
                    key={activeRoutine.id}
                    aria-label="Active routine name"
                    type="text"
                    defaultValue={activeRoutineName}
                    onBlur={(event) => void handleUpdateRoutineName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleUpdateRoutineName(event.currentTarget.value);
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-base font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                  />
                  <span className="mt-1 block text-[10px] text-[#8E8E93] font-medium">
                    {locale === 'ko' ? '💡 엔터를 누르거나 포커스를 해제하면 저장됩니다.' : '💡 Press Enter or focus away to save.'}
                  </span>
                </label>
              ) : null}
              {/* Copied Routine Warning Banner */}
              {activeRoutine && (activeRoutine.name.endsWith('Copy') || activeRoutine.name.endsWith('복사본') || activeRoutine.name.includes('Copy') || activeRoutine.name.includes('복사본')) && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-700">
                  ⚠️ {locale === 'ko'
                    ? '복사된 루틴을 편집 중입니다. 루틴 이름을 지정해 주세요.'
                    : 'You are editing a copied routine. Please set a name for this routine.'}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 border-t border-[#E5E5EA] pt-3">
                <button
                  type="button"
                  onClick={() => setShowRoutineRename((current) => !current)}
                  disabled={!activeRoutine}
                  className="min-h-9 rounded-xl border border-black/5 bg-[#F2F2F7] px-1 text-[11px] font-bold text-[#1C1C1E] transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {locale === 'ko' ? '이름' : 'Rename'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDuplicateActiveRoutine()}
                  disabled={!activeRoutine}
                  className="flex min-h-9 items-center justify-center gap-0.5 rounded-xl border border-[#2EC4B6]/20 bg-[#2EC4B6]/10 px-1 text-[11px] font-black text-[#159A91] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Copy aria-hidden="true" size={11} />
                  <span>{locale === 'ko' ? '복제' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteActiveRoutine()}
                  disabled={!activeRoutine}
                  className="flex min-h-9 items-center justify-center gap-0.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-1 text-[11px] font-black text-rose-600 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 aria-hidden="true" size={11} />
                  <span>{locale === 'ko' ? '삭제' : 'Delete'}</span>
                </button>
              </div>
              <button
                type="button"
                aria-expanded={showRoutineCreator}
                onClick={() => setShowRoutineCreator((current) => !current)}
                className="flex min-h-10 w-full items-center justify-between rounded-xl border border-black/5 bg-[#F2F2F7] px-3 text-sm font-bold text-[#1C1C1E] transition-all active:scale-[0.98]"
              >
                <span>{locale === 'ko' ? '새 루틴 만들기' : 'Create new routine'}</span>
                <span className="text-[#159A91]">{showRoutineCreator ? '-' : '+'}</span>
              </button>
              {showRoutineCreator ? (
                <div className="grid gap-2 border-t border-[#E5E5EA] pt-2.5">
                  <button
                    type="button"
                    onClick={() => void handleCreateCustomRoutine()}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2EC4B6] px-3 text-sm font-black text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)] transition-all active:scale-[0.98]"
                  >
                    <Plus aria-hidden="true" size={15} />
                    <span>{locale === 'ko' ? '직접 만들기' : 'Create from scratch'}</span>
                  </button>
                  <p className="pt-1 text-xs font-extrabold uppercase text-[#8E8E93]">
                    {locale === 'ko' ? '템플릿에서 시작' : 'Start from template'}
                  </p>
                  {routineTemplates.map((template) => {
                    const isSaving = savingSplitType === template.splitType;
                    return (
                      <button
                        key={template.splitType}
                        type="button"
                        onClick={() => void handleActivate(template.splitType)}
                        className="rounded-xl border border-black/5 bg-white p-3 text-left transition-all hover:bg-[#F2F2F7] active:scale-[0.98]"
                      >
                        <h2 className="text-sm font-black text-[#1C1C1E]">{getRoutineTemplateName(template, locale)}</h2>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-[#6E6E73]">{getRoutineTemplateSummary(template, locale)}</p>
                        <p className="mt-2 text-xs font-black uppercase text-[#159A91]">
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

        {/* 주간 계획 */}
        {setupTab === 'schedule' && (
          <section className="ios-card shrink-0 space-y-3.5 p-4">
            <p className="text-xs font-bold uppercase text-[#8E8E93]">{t(locale, 'weeklyPlan')}</p>
            <div className="rounded-xl border border-black/5 bg-[#F2F2F7] px-3.5 py-2.5">
              <p className="text-xs font-extrabold uppercase text-[#8E8E93]">{t(locale, 'activeRoutine')}</p>
              <h2 className="mt-0.5 text-sm font-black text-[#1C1C1E]">{activeRoutineName ?? t(locale, 'noActiveRoutine')}</h2>
              <p className="mt-1 text-xs font-medium leading-normal text-[#6E6E73]">{t(locale, 'routinePlanFor')}</p>
            </div>
            <label className="block text-xs font-bold text-[#6E6E73]">
              {locale === 'ko' ? '시작일' : 'Start date'}
              <input
                type="date"
                value={scheduleStartDate}
                onChange={(event) => {
                  setScheduleStartDate(event.target.value);
                  setScheduleDirty(true);
                }}
                className="mt-1 min-h-10 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-semibold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
              />
            </label>
            {cyclePlan.length === 0 ? (
              <button
                type="button"
                onClick={handleStartCyclePlan}
                disabled={!activeRoutine}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2EC4B6] px-3 text-sm font-black text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus aria-hidden="true" size={16} />
                <span>{locale === 'ko' ? '운동사이클 정하기' : 'Set workout cycle'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                {cyclePlan.map((item, index) => (
                  <div key={`${item.id ?? 'new'}_${index}`} className="grid grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-1.5 rounded-xl border border-black/5 bg-[#F2F2F7] p-2">
                    <span className="text-center text-xs font-black text-[#159A91]">{index + 1}</span>
                    <select
                      aria-label={`Cycle item ${index + 1}`}
                      value={item.kind === 'routine' ? `routine:${item.routineDayId ?? ''}` : item.kind}
                      onChange={(event) => handleCycleItemChange(index, event.target.value)}
                      className="min-h-9 min-w-0 cursor-pointer rounded-lg border border-[#D1D1D6] bg-white px-2 text-sm font-bold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    >
                      {dayPlans.map((dayPlan) => (
                        <option key={dayPlan.routineDay.id} value={`routine:${dayPlan.routineDay.id}`}>
                          {getRoutineDayDisplayName(dayPlan.routineDay, locale)}
                        </option>
                      ))}
                      <option value="rest">{t(locale, 'rest')}</option>
                      <option value="running">{locale === 'ko' ? '러닝' : 'Running'}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMoveCycleItem(index, -1)}
                      disabled={index === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/5 bg-white text-[#1C1C1E] shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Move cycle item up"
                    >
                      <ArrowUp aria-hidden="true" size={14} className="text-[#1C1C1E]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCycleItem(index, 1)}
                      disabled={index === cyclePlan.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/5 bg-white text-[#1C1C1E] shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Move cycle item down"
                    >
                      <ArrowDown aria-hidden="true" size={14} className="text-[#1C1C1E]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCycleItem(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 transition-all active:scale-95"
                      aria-label="Delete cycle item"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => handleAddCycleItem('routine')} className="min-h-10 rounded-xl border border-black/5 bg-white text-xs font-bold text-[#1C1C1E] transition-all active:scale-95">
                    {locale === 'ko' ? '운동 추가' : 'Workout'}
                  </button>
                  <button type="button" onClick={() => handleAddCycleItem('running')} className="min-h-10 rounded-xl border border-black/5 bg-white text-xs font-bold text-[#1C1C1E] transition-all active:scale-95">
                    {locale === 'ko' ? '러닝 추가' : 'Running'}
                  </button>
                  <button type="button" onClick={() => handleAddCycleItem('rest')} className="min-h-10 rounded-xl border border-black/5 bg-white text-xs font-bold text-[#1C1C1E] transition-all active:scale-95">
                    {locale === 'ko' ? '휴식 추가' : 'Rest'}
                  </button>
                </div>
              </div>
            )}
            {scheduleStatus ? <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-bold text-accent-dark border border-[#2EC4B6]/20">{scheduleStatus}</p> : null}
            <div className="grid grid-cols-3 gap-2 border-t border-[#E5E5EA] pt-2.5">
              <button
                type="button"
                onClick={() => void handleReviewCycleCalendar()}
                disabled={!activeRoutine || !scheduleStartDate || cyclePlan.length === 0}
                className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#2EC4B6]/20 bg-white px-2 text-xs font-bold text-[#159A91] shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <CalendarDays aria-hidden="true" size={15} />
                <span>{locale === 'ko' ? '캘린더 확인' : 'Calendar'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCancelWeeklySchedule()}
                className="min-h-11 rounded-xl border border-black/5 bg-white text-sm font-bold text-[#1C1C1E] shadow-sm transition-all active:scale-95"
              >
                {locale === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveWeeklySchedule()}
                disabled={!activeRoutine || !scheduleDirty || !scheduleStartDate || cyclePlan.length === 0}
                className="min-h-11 rounded-xl bg-[#2EC4B6] text-sm font-black text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                {t(locale, 'save')}
              </button>
            </div>
          </section>
        )}

        {/* Exercise library settings */}
        {setupTab === 'library' && (
          <section className="ios-card shrink-0 space-y-3 p-3.5">
            <div>
              <p className="text-xs font-extrabold uppercase text-[#6E6E73]">{t(locale, 'exerciseLibrary')}</p>
              <h2 className="mt-0.5 text-base font-bold text-[#1C1C1E]">
                {locale === 'ko' ? `${exerciseLibrary.length}개의 등록된 운동` : `${exerciseLibrary.length} Exercises`}
              </h2>
            </div>

            <nav className="grid grid-cols-2 gap-1 rounded-xl bg-[#F2F2F7] p-1 border border-black/5">
              {([
                ['browse', locale === 'ko' ? '검색 / 변경' : 'Search / Edit'],
                ['add', locale === 'ko' ? '운동 추가' : 'Add Exercise'],
              ] as Array<[ExerciseLibraryMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void handleExerciseLibraryModeChange(value)}
                  className={`min-h-9 rounded-lg text-sm font-bold transition-all ${exerciseLibraryMode === value ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#6E6E73] hover:text-[#1C1C1E]'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Exercise search */}
            {exerciseLibraryMode === 'browse' ? (
              <div className="grid gap-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 focus-within:border-[#2EC4B6]">
                  <Search aria-hidden="true" size={15} className="shrink-0 text-[#6E6E73]" />
                  <input
                    aria-label="Search exercise library"
                    type="search"
                    value={exerciseSearch}
                    onChange={(event) => setExerciseSearch(event.target.value)}
                    placeholder={t(locale, 'searchExercises')}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1C1C1E] outline-none placeholder:text-[#8E8E93]"
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    aria-label="Exercise category filter"
                    value={exerciseCategoryFilter}
                    onChange={(event) => setExerciseCategoryFilter(event.target.value as ExerciseCategory | 'all')}
                    className="min-h-10 rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-bold text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
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
                    className="ios-button-secondary min-h-10 px-3 text-xs font-bold"
                  >
                    {showHiddenExercises ? (locale === 'ko' ? '사용 중' : 'Active') : (locale === 'ko' ? '숨긴 운동' : 'Hidden')}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Exercise library two-column grid */}
            {exerciseLibraryMode === 'browse' ? <div className="grid min-h-[24rem] max-h-[calc(100dvh-22rem)] auto-rows-[3.75rem] grid-cols-2 content-start gap-2 overflow-y-auto border-t border-[#E5E5EA] pt-3 pr-1 scrollbar-thin">
              {filteredExerciseLibrary.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => handleSelectExercise(exercise)}
                  className={`flex h-full items-center rounded-xl p-2 text-left border transition-all active:scale-95 ${
                    editingExercise?.id === exercise.id
                      ? 'bg-[#E8F3F3] border-[#2EC4B6]/30 text-[#159A91] font-bold shadow-sm'
                      : 'border-black/5 bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'
                  }`}
                >
                  <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm shadow-inner ${
                    editingExercise?.id === exercise.id ? 'bg-black/5 text-[#1C1C1E]' : 'border border-[#D1D1D6] bg-white'
                  }`}>
                    {getExerciseIcon(exercise.defaultEmoji)}
                  </div>
                  <div className="min-w-0 flex-1 ml-2">
                    <span className="block truncate text-xs font-black leading-tight">{getExerciseName(exercise, locale)}</span>
                    <span className={`mt-0.5 block truncate text-[11px] ${editingExercise?.id === exercise.id ? 'font-semibold text-[#159A91]' : 'text-[#6E6E73]'}`}>
                      {getExerciseCategories(exercise).map((c) => labelForCategory(c, locale)).join('/')}
                    </span>
                  </div>
                </button>
              ))}
            </div> : null}

            {/* Selected exercise detail and editor */}
            {editingExercise && (
              <div key={editingExercise.id} className="space-y-3 rounded-2xl border border-black/5 bg-[#F2F2F7] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-sm">
                      {getExerciseIcon(editingExercise.defaultEmoji)}
                    </div>
                    <h3 className="text-xs font-bold text-[#1C1C1E] leading-tight">
                      {editingExercise.nameKo ? getExerciseName(editingExercise, locale) : (locale === 'ko' ? '새 운동' : 'New exercise')}
                    </h3>
                  </div>
                  {!exerciseEditorOpen ? (
                    <button
                      type="button"
                      onClick={() => handleBeginExerciseEdit(editingExercise)}
                      className="ios-button-primary min-h-8 px-3 text-xs font-bold"
                    >
                      {locale === 'ko' ? '변경' : 'Edit'}
                    </button>
                  ) : editingExercise.isActive && exerciseLibraryMode !== 'add' ? (
                    <button
                      type="button"
                      onClick={() => void handleDeactivateExercise(editingExercise.id)}
                      className="min-h-8 shrink-0 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 text-xs font-bold text-rose-600"
                    >
                      {locale === 'ko' ? '목록에서 숨기기' : 'Hide from list'}
                    </button>
                  ) : exerciseLibraryMode !== 'add' ? (
                    <button
                      type="button"
                      onClick={() => void handleRestoreExercise(editingExercise.id)}
                      className="min-h-8 shrink-0 rounded-lg border border-[#2EC4B6]/20 bg-[#E8F3F3] px-2.5 text-xs font-bold text-[#159A91]"
                    >
                      {locale === 'ko' ? '목록에 복원' : 'Restore'}
                    </button>
                  ) : null}
                </div>

                {exerciseEditorOpen ? (
                  <>
                <div className="grid gap-2.5">
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {t(locale, 'koreanName')}
                    <input
                      aria-label="Edit exercise Korean name"
                      type="text"
                      defaultValue={editingExercise.nameKo}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameKo: event.target.value.trim() || editingExercise.nameKo })}
                      className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {t(locale, 'englishName')}
                    <input
                      aria-label="Edit exercise English name"
                      type="text"
                      defaultValue={editingExercise.nameEn ?? ''}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { nameEn: event.target.value.trim() || undefined })}
                      className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {t(locale, 'description')}
                    <textarea
                      aria-label="Edit exercise description"
                      defaultValue={editingExercise.description ?? ''}
                      onBlur={(event) => void handleUpdateExercise(editingExercise.id, { description: event.target.value.trim() || undefined })}
                      rows={2}
                      className="mt-1 w-full resize-none rounded-xl border border-[#D1D1D6] bg-white px-3 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    />
                  </label>
                </div>

                <div className="space-y-3.5 pt-1 border-t border-[#E5E5EA]">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#6E6E73]">{t(locale, 'categories')}</p>
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
                                ? 'bg-[#2EC4B6] text-white font-bold shadow-sm'
                                : 'border border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                            }`}
                          >
                            {labelForCategory(category.value, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-[#6E6E73]">{t(locale, 'stages')}</p>
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
                                ? 'bg-[#2EC4B6] text-white font-bold shadow-sm'
                                : 'border border-[#D1D1D6] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7]'
                            }`}
                          >
                            {labelForStage(stage.value, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-[#D1D1D6] pt-3">
                  <button
                    type="button"
                    onClick={() => void handleCancelExerciseChanges()}
                    className="ios-button-secondary min-h-10 px-4 text-sm font-bold"
                  >
                    {locale === 'ko' ? '취소' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveExerciseChanges()}
                    disabled={!editingExercise.nameKo.trim()}
                    className="ios-button-primary min-h-10 px-4 text-sm font-bold disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] disabled:shadow-none"
                  >
                    {t(locale, 'save')}
                  </button>
                </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-black/5 bg-white p-3 text-xs">
                      <div>
                        <p className="font-bold uppercase text-[#8E8E93]">{t(locale, 'koreanName')}</p>
                        <p className="mt-1 text-sm font-bold text-[#1C1C1E]">{editingExercise.nameKo}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase text-[#8E8E93]">{t(locale, 'englishName')}</p>
                        <p className="mt-1 text-sm font-bold text-[#1C1C1E]">{editingExercise.nameEn ?? '-'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/5 bg-white p-3">
                      <p className="text-xs font-bold uppercase text-[#8E8E93]">{t(locale, 'description')}</p>
                      <p className="mt-1 text-sm font-medium leading-5 text-[#1C1C1E]">
                        {editingExercise.description || (locale === 'ko' ? '설명이 없습니다.' : 'No description.')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-black/5 bg-white p-3">
                        <p className="text-xs font-bold uppercase text-[#8E8E93]">{t(locale, 'categories')}</p>
                        <p className="mt-1 text-sm font-bold text-[#1C1C1E]">
                          {getExerciseCategories(editingExercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white p-3">
                        <p className="text-xs font-bold uppercase text-[#8E8E93]">{t(locale, 'stages')}</p>
                        <p className="mt-1 text-sm font-bold text-[#1C1C1E]">
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

        {/* 날짜별 계획 목록과 루틴 운동 계획 편집 */}
        {dayPlans.length > 0 && setupTab === 'routine' && (
          <section className="ios-card shrink-0 space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-3 border-b border-[#D1D1D6] pb-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-[#6E6E73]">{t(locale, 'routineDays')}</p>
                <p className="mt-0.5 truncate text-sm font-black text-[#1C1C1E]">
                  {selectedDayLabel ?? t(locale, 'noRoutineDayPlanned')}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleRevertRoutineChanges()}
                  className="ios-button-secondary flex min-h-8 px-2 text-xs font-bold"
                >
                  <RotateCcw aria-hidden="true" size={12} />
                  <span>{locale === 'ko' ? '취소' : 'Cancel'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveRoutineChanges()}
                  className="ios-button-primary min-h-8 px-3 text-xs font-bold"
                >
                  {t(locale, 'save')}
                </button>
              </div>
            </div>
            {resetStatus && (
              <p className="rounded-xl bg-[#E8F3F3] border border-[#2EC4B6]/20 px-3 py-2 text-xs font-bold text-[#159A91]">
                {resetStatus}
              </p>
            )}

            {selectedDay && (
              <div className="space-y-3.5">
                {/* 루틴 날짜 이름 수정 입력 */}
                <div className="flex items-center justify-between gap-2.5">
                  <input
                    key={selectedDay.routineDay.id}
                    aria-label="Routine day name"
                    type="text"
                    defaultValue={selectedDay.routineDay.name}
                    onBlur={(event) => void handleUpdateRoutineDayName(selectedDay.routineDay.id, event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-base font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddingDayId((current) => (
                        current === selectedDay.routineDay.id ? undefined : selectedDay.routineDay.id
                      ));
                      resetRoutineAddFinderState();
                    }}
                    className="ios-button-primary flex h-9 w-9 shrink-0 items-center justify-center"
                    aria-label={`Add exercise to ${selectedDay.routineDay.name}`}
                  >
                    <Plus aria-hidden="true" size={18} />
                  </button>
                </div>

                {/* Add exercise finder for selected routine day */}
                {addingDayId === selectedDay.routineDay.id && (
                  <div className="rounded-xl border border-[#2EC4B6]/20 bg-white p-2.5 shadow-inner">
                    <ExerciseFinder
                      ariaLabel="Search exercises to add"
                      exercises={availableExercises}
                      locale={locale}
                      state={routineAddFinderState}
                      onChange={updateRoutineAddFinderState}
                      onSelect={(exercise) => void handleAddExercise(selectedDay.routineDay.id, exercise.id)}
                      limit={24}
                      title={t(locale, 'exerciseFinder')}
                    />
                  </div>
                )}

                {/* 루틴 계획 운동 목록 */}
                <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1 scrollbar-thin">
                  {selectedDay.plans.length === 0 ? (
                    <p className="rounded-2xl border border-black/5 bg-[#F2F2F7] px-4 py-5 text-center text-sm font-semibold leading-relaxed text-[#6E6E73]">
                      {t(locale, 'noPlannedExercises')}
                    </p>
                  ) : (
                    selectedDay.plans.map(({ plan, exercise }, planIndex) => (
                      <div key={plan.id} className="space-y-2.5 rounded-2xl border border-black/5 bg-[#F2F2F7] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8.5 h-8.5 flex items-center justify-center rounded-xl bg-white border border-[#D1D1D6] text-base shrink-0">
                              {getExerciseIcon(exercise.defaultEmoji)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black leading-tight text-[#1C1C1E]">{getExerciseName(exercise, locale)}</p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-[#6E6E73]">
                                {getExerciseCategories(exercise).map((category) => labelForCategory(category, locale)).join(' / ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleMovePlan(plan.id, -1)}
                              disabled={planIndex === 0}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:pointer-events-none disabled:opacity-30 active:scale-95"
                              aria-label={`Move ${getExerciseName(exercise, locale)} up`}
                            >
                              <ArrowUp aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleMovePlan(plan.id, 1)}
                              disabled={planIndex === selectedDay.plans.length - 1}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:pointer-events-none disabled:opacity-30 active:scale-95"
                              aria-label={`Move ${getExerciseName(exercise, locale)} down`}
                            >
                              <ArrowDown aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePlan(plan.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFECEC] text-rose-600 transition-all active:scale-95"
                              aria-label={`Remove ${getExerciseName(exercise, locale)} from ${selectedDay.routineDay.name}`}
                            >
                              <Trash2 aria-hidden="true" size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Planned set, weight, rep, RIR, and rest controls */}
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#E5E5EA]">
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">Sets</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned sets`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={plan.plannedSets ?? 3}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedSets: Math.max(1, Number(event.target.value) || 1),
                              })}
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">Kg</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned weight`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={plan.plannedWeightKg ?? ''}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedWeightKg: Number(event.target.value) || undefined,
                              })}
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">Reps</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned reps`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={plan.plannedReps ?? 10}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedReps: Math.max(0, Number(event.target.value) || 0),
                              })}
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">RIR</span>
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
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">Rest</span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} planned rest seconds`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={plan.plannedRestSeconds ?? 90}
                              onBlur={(event) => void handleUpdatePlan(plan.id, {
                                plannedRestSeconds: Math.max(15, Number(event.target.value) || 90),
                              })}
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
                            />
                          </label>
                          <label className="block text-center">
                            <span className="mb-1 block text-xs font-bold uppercase text-[#6E6E73]">
                              {locale === 'ko' ? '단위' : 'Step'}
                            </span>
                            <input
                              aria-label={`${getExerciseName(exercise, locale)} weight increment`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={plan.preferredWeightIncrementKg ?? 2.5}
                              onBlur={(event) => {
                                const value = Number(event.target.value);
                                void handleUpdatePlan(plan.id, {
                                  preferredWeightIncrementKg: Number.isFinite(value) && value > 0 ? value : undefined,
                                });
                              }}
                              className="w-full rounded-xl border border-[#D1D1D6] bg-white py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none transition-all focus:border-[#2EC4B6]"
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
