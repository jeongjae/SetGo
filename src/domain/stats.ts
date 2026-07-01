import { getExerciseCategories, getExerciseName, isWarmupOnlyExercise } from './exercises';
import { buildRecoverySnapshot, type RecoveryMuscleGroup, type RecoverySnapshot, type RecoveryStatus } from './recovery';
import { t, tf } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

export type Locale = 'ko' | 'en';
export type MuscleGroup = Exclude<RecoveryMuscleGroup, 'cardio'>;
export type LoadStatus = 'low' | 'normal' | 'high' | 'caution';

export type WeekStat = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  workoutDays: number;
  volumeKg: number;
  sets: number;
  hardSets: number;
};

export type MuscleStat = {
  group: MuscleGroup;
  volumeKg: number;
  sets: number;
  setsPerWeek: number;
  hardSets: number;
  recommendedMin: number;
  recommendedMax: number;
  status: LoadStatus;
  targetPct: number;
  deficitSets: number;
  excessSets: number;
};

export type ExercisePerformance = {
  id: string;
  name: string;
  recentWeightKg: number;
  bestWeightKg: number;
  recentVolumeKg: number;
  bestVolumeKg: number;
  estimatedOneRmKg: number;
  fourWeekChangePct?: number;
  oneRmHistory: Array<{ label: string; valueKg: number }>;
  chartHistory?: Array<{ label: string; oneRm: number; volume: number }>;
};

export type DailyTrendItem = {
  key: string;
  label: string;
  volumeKg: number;
  sets: number;
  distanceKm: number;
};

export type DailyTrendStat = {
  date: string;
  label: string;
  strengthVolumeKg: number;
  strengthSets: number;
  cardioDistanceKm: number;
  items: DailyTrendItem[];
};

export type DeloadRecommendation = {
  shouldDeload: boolean;
  severity: 'caution' | 'high';
  currentHardSets: number;
  baselineHardSets: number;
  hardSetRatio: number;
  volumeChangePct?: number;
  recoveryPercent: number;
  suggestedSetReductionPct: number;
  reasons: string[];
};

export type StatsView = {
  windowDays: number;
  weeksInPeriod: number;
  trendGranularity: 'daily' | 'weekly';
  workoutDays: number;
  totalVolumeKg: number;
  totalSets: number;
  hardSets: number;
  weekOverWeekPct?: number;
  hardSetRatio: number;
  weeks: WeekStat[];
  dailyTrend: DailyTrendStat[];
  muscleStats: MuscleStat[];
  performances: ExercisePerformance[];
  recovery: RecoverySnapshot;
  deloadRecommendation?: DeloadRecommendation;
  warnings: string[];
  analysisComment: string;
  nextWeekSuggestions: string[];
};

export const muscleLabels: Record<Locale, Record<MuscleGroup, string>> = {
  ko: {
    chest: '가슴',
    back: '등',
    legs: '하체',
    shoulder: '어깨',
    biceps: '이두',
    triceps: '삼두',
    core: '코어',
  },
  en: {
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    core: 'Core',
  },
};

export const recoveryLabels: Record<Locale, Record<RecoveryMuscleGroup, string>> = {
  ko: {
    chest: '가슴',
    back: '등',
    legs: '하체',
    shoulder: '어깨',
    biceps: '이두',
    triceps: '삼두',
    core: '코어',
    cardio: '유산소',
  },
  en: {
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    core: 'Core',
    cardio: 'Cardio',
  },
};

export const recommendedSets: Record<MuscleGroup, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  legs: { min: 10, max: 20 },
  shoulder: { min: 8, max: 16 },
  biceps: { min: 6, max: 14 },
  triceps: { min: 6, max: 14 },
  core: { min: 4, max: 12 },
};

export const trackedMuscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulder', 'biceps', 'triceps', 'core'];

export type AnalysisWindowId = 'p7' | 'p28' | 'p84';
export type AnalysisWindow = { id: AnalysisWindowId; days: number };
export const analysisWindows: AnalysisWindow[] = [
  { id: 'p7', days: 7 },
  { id: 'p28', days: 28 },
  { id: 'p84', days: 84 },
];
export const defaultAnalysisWindow: AnalysisWindowId = 'p7';
const ANALYSIS_WINDOW_KEY = 'setgo.statsWindow';

export function loadAnalysisWindow(): AnalysisWindowId {
  if (typeof localStorage === 'undefined') return defaultAnalysisWindow;
  const stored = localStorage.getItem(ANALYSIS_WINDOW_KEY);
  return analysisWindows.some((window) => window.id === stored) ? (stored as AnalysisWindowId) : defaultAnalysisWindow;
}

export function saveAnalysisWindow(id: AnalysisWindowId): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ANALYSIS_WINDOW_KEY, id);
}

export function analysisWindowDays(id: AnalysisWindowId): number {
  return analysisWindows.find((window) => window.id === id)?.days ?? 7;
}

export function addDays(date: Date, days: number): Date {
  const copyDate = new Date(date);
  copyDate.setDate(copyDate.getDate() + days);
  return copyDate;
}

export function pctChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return ((current - previous) / previous) * 100;
}

export function setVolume(set: WorkoutSet): number {
  return set.isCompleted ? set.weightKg * set.reps : 0;
}

export function estimatedOneRm(set: WorkoutSet): number {
  return set.weightKg * (1 + set.reps / 30);
}

export function isHardSet(set: WorkoutSet, exercise: ExerciseMaster): boolean {
  const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
  return set.isCompleted && !isWarmup && !isWarmupOnlyExercise(exercise) && set.isHard === true;
}

function normalizedHardSetCount(
  sets: WorkoutSet[],
  workoutExerciseById: Map<string, WorkoutExercise>,
  exerciseById: Map<string, ExerciseMaster>,
): number {
  const countedMyoExercises = new Set<string>();
  let count = 0;

  for (const set of sets) {
    const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
    const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
    if (!workoutExercise || !exercise || !isHardSet(set, exercise)) continue;

    if (set.intensityTechnique === 'myo_reps') {
      if (countedMyoExercises.has(set.workoutExerciseId)) continue;
      countedMyoExercises.add(set.workoutExerciseId);
    }
    count += 1;
  }

  return count;
}

export function toMuscleGroups(exercise: ExerciseMaster): MuscleGroup[] {
  const categories = getExerciseCategories(exercise);
  const mapped = categories
    .map((category): MuscleGroup | undefined => {
      if (category === 'chest' || category === 'back' || category === 'legs' || category === 'shoulder' || category === 'biceps' || category === 'triceps') {
        return category;
      }
      return undefined;
    })
    .filter((group): group is MuscleGroup => Boolean(group));

  const haystack = `${exercise.id} ${exercise.nameKo} ${exercise.nameEn ?? ''}`.toLowerCase();
  if (/(core|abs|abdominal|plank|crunch|코어|복근)/.test(haystack)) mapped.push('core');

  return Array.from(new Set(mapped));
}

export function toRecoveryMuscleGroups(exercise: ExerciseMaster): RecoveryMuscleGroup[] {
  const groups: RecoveryMuscleGroup[] = [...toMuscleGroups(exercise)];
  const categories = getExerciseCategories(exercise);
  if (categories.includes('cardio')) groups.push('cardio');
  if (groups.length === 0 && categories.includes('bodyweight')) groups.push('core');
  return Array.from(new Set(groups));
}

export function statusForSets(sets: number, min: number, max: number): LoadStatus {
  if (sets < min) return sets >= min * 0.7 ? 'caution' : 'low';
  if (sets > max) return sets <= max * 1.25 ? 'caution' : 'high';
  return 'normal';
}

export function formatPct(value?: number): string {
  if (value === undefined) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

export function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString()}kg`;
}

export function insightStatus(stats: StatsView): LoadStatus {
  if (stats.recovery.readinessStatus === 'fatigued') return 'high';
  if (stats.recovery.readinessStatus === 'moderate') return 'caution';
  if (stats.warnings.length > 0 || stats.hardSetRatio > 70) return 'caution';
  if (stats.workoutDays === 0 || stats.totalSets === 0) return 'low';
  return 'normal';
}

export function insightLabel(status: LoadStatus, locale: Locale): string {
  if (locale === 'ko') {
    if (status === 'normal') return '좋음';
    if (status === 'high') return '회복';
    if (status === 'caution') return '점검';
    return '부족';
  }

  if (status === 'normal') return 'Good';
  if (status === 'high') return 'Recover';
  if (status === 'caution') return 'Review';
  return 'Low';
}

export function recoveryStatusLabel(status: RecoveryStatus, locale: Locale): string {
  if (locale === 'ko') {
    if (status === 'ready') return '좋음';
    if (status === 'moderate') return '보통';
    return '피로';
  }
  if (status === 'ready') return 'Ready';
  if (status === 'moderate') return 'Moderate';
  return 'Fatigued';
}

export function insightMessage(stats: StatsView, locale: Locale): string {
  const fatiguedGroups = stats.recovery.mostFatiguedGroups.filter((group) => group.recoveryPercent < 60);
  const lowMuscles = stats.muscleStats.filter((muscle) => muscle.status === 'low');
  const highMuscles = stats.muscleStats.filter((muscle) => muscle.status === 'high' || muscle.status === 'caution');

  if (fatiguedGroups.length > 0) {
    const muscles = fatiguedGroups.slice(0, 2).map((muscle) => recoveryLabels[locale][muscle.group]).join(', ');
    return locale === 'ko' ? `${muscles} 회복도를 먼저 확인하세요.` : `Check recovery first for ${muscles}.`;
  }
  if (stats.warnings.length > 0) return stats.warnings[0];
  if (lowMuscles.length > 0) {
    const muscles = lowMuscles.slice(0, 2).map((muscle) => muscleLabels[locale][muscle.group]).join(', ');
    return locale === 'ko' ? `${muscles} 볼륨을 우선 보강하세요.` : `Add priority volume for ${muscles}.`;
  }
  if (highMuscles.length > 0) {
    const muscles = highMuscles.slice(0, 2).map((muscle) => muscleLabels[locale][muscle.group]).join(', ');
    return locale === 'ko' ? `${muscles} 부하를 줄이고 회복을 확인하세요.` : `Reduce load and check recovery for ${muscles}.`;
  }
  return locale === 'ko' ? '이번 주 부하는 안정적인 범위입니다.' : 'This week is inside a stable load range.';
}

export function buildDeloadRecommendation(
  weeks: WeekStat[],
  hardSetRatio: number,
  recovery: Pick<RecoverySnapshot, 'averageRecoveryPercent' | 'readinessStatus'>,
  locale: Locale,
): DeloadRecommendation | undefined {
  const currentWeek = weeks[weeks.length - 1];
  const previousWeeks = weeks
    .slice(Math.max(0, weeks.length - 5), Math.max(0, weeks.length - 1))
    .filter((week) => week.sets > 0 || week.hardSets > 0 || week.volumeKg > 0);

  if (!currentWeek || currentWeek.hardSets < 10 || previousWeeks.length < 2) return undefined;

  const baselineHardSets = previousWeeks.reduce((sum, week) => sum + week.hardSets, 0) / previousWeeks.length;
  const baselineVolume = previousWeeks.reduce((sum, week) => sum + week.volumeKg, 0) / previousWeeks.length;
  const hardSetIncreasePct = pctChange(currentWeek.hardSets, baselineHardSets) ?? 0;
  const volumeChangePct = pctChange(currentWeek.volumeKg, baselineVolume);
  const hasHardSetSpike = hardSetRatio >= 80 && hardSetIncreasePct >= 30;
  const hasVolumeSpike = volumeChangePct !== undefined && volumeChangePct >= 30 && hardSetRatio >= 65;
  const hasLowRecovery = recovery.readinessStatus === 'fatigued' || recovery.averageRecoveryPercent < 50;
  const hasSevereRecovery = recovery.averageRecoveryPercent < 40;
  const hasSevereLoadSpike = hardSetRatio >= 85 && hardSetIncreasePct >= 50;
  const driverCount = [hasHardSetSpike, hasVolumeSpike, hasLowRecovery].filter(Boolean).length;

  if (driverCount < 2 && !hasSevereLoadSpike && !(hasSevereRecovery && (hasHardSetSpike || hasVolumeSpike))) {
    return undefined;
  }

  const reasons: string[] = [];

  if (hasHardSetSpike) {
    reasons.push(locale === 'ko'
      ? `Hard 세트 비율이 ${hardSetRatio.toFixed(0)}%이고 최근 4주 평균보다 ${hardSetIncreasePct.toFixed(0)}% 많습니다.`
      : `Hard-set ratio is ${hardSetRatio.toFixed(0)}%, ${hardSetIncreasePct.toFixed(0)}% above the recent 4-week average.`);
  }
  if (hasVolumeSpike) {
    reasons.push(locale === 'ko'
      ? `주간 볼륨이 최근 4주 평균보다 ${volumeChangePct.toFixed(0)}% 높습니다.`
      : `Weekly volume is ${volumeChangePct.toFixed(0)}% above the recent 4-week average.`);
  }
  if (hasLowRecovery) {
    reasons.push(locale === 'ko'
      ? `평균 회복도가 ${recovery.averageRecoveryPercent}%로 낮습니다.`
      : `Average recovery is low at ${recovery.averageRecoveryPercent}%.`);
  }

  if (reasons.length === 0) return undefined;

  const severity: DeloadRecommendation['severity'] = (
    hasSevereRecovery
    || hardSetRatio >= 85
    || (volumeChangePct ?? 0) >= 40
  ) ? 'high' : 'caution';

  return {
    shouldDeload: true,
    severity,
    currentHardSets: currentWeek.hardSets,
    baselineHardSets: Math.round(baselineHardSets),
    hardSetRatio,
    volumeChangePct,
    recoveryPercent: recovery.averageRecoveryPercent,
    suggestedSetReductionPct: severity === 'high' ? 50 : 35,
    reasons,
  };
}

export function decorateMuscleStat(
  stat: Omit<MuscleStat, 'status' | 'targetPct' | 'deficitSets' | 'excessSets' | 'setsPerWeek'>,
  weeksInPeriod: number,
): MuscleStat {
  const setsPerWeek = Math.round(stat.sets / Math.max(1, weeksInPeriod));
  return {
    ...stat,
    setsPerWeek,
    status: statusForSets(setsPerWeek, stat.recommendedMin, stat.recommendedMax),
    targetPct: Math.min(100, Math.round((setsPerWeek / Math.max(1, stat.recommendedMax)) * 100)),
    deficitSets: Math.max(0, stat.recommendedMin - setsPerWeek),
    excessSets: Math.max(0, setsPerWeek - stat.recommendedMax),
  };
}

export function buildEmptyStats(locale: Locale, windowDays = analysisWindowDays(defaultAnalysisWindow)): StatsView {
  const weeksInPeriod = windowDays / 7;
  return {
    windowDays,
    weeksInPeriod,
    trendGranularity: windowDays <= 7 ? 'daily' : 'weekly',
    workoutDays: 0,
    totalVolumeKg: 0,
    totalSets: 0,
    hardSets: 0,
    weekOverWeekPct: undefined,
    hardSetRatio: 0,
    weeks: [],
    dailyTrend: [],
    muscleStats: trackedMuscles.map((group) => ({
      group,
      volumeKg: 0,
      sets: 0,
      setsPerWeek: 0,
      hardSets: 0,
      recommendedMin: recommendedSets[group].min,
      recommendedMax: recommendedSets[group].max,
      status: 'low',
      targetPct: 0,
      deficitSets: recommendedSets[group].min,
      excessSets: 0,
    })),
    performances: [],
    recovery: buildRecoverySnapshot([], { asOf: new Date() }),
    deloadRecommendation: undefined,
    warnings: [],
    analysisComment: t(locale, 'statsEmptyAnalysis'),
    nextWeekSuggestions: [t(locale, 'statsNextWeekHoldVolume')],
  };
}

export function buildStats(
  sessions: WorkoutSession[],
  workoutExercises: WorkoutExercise[],
  workoutSets: WorkoutSet[],
  exercises: ExerciseMaster[],
  locale: Locale,
  cardioRecords: CardioRecord[] = [],
  windowDays: number = analysisWindowDays(defaultAnalysisWindow),
): StatsView {
  const today = new Date();
  const weeksInPeriod = windowDays / 7;
  const trendGranularity: 'daily' | 'weekly' = windowDays <= 7 ? 'daily' : 'weekly';

  const todayKey = formatDateKey(today);
  const currentPeriodStartKey = formatDateKey(addDays(today, -(windowDays - 1)));
  const previousPeriodStartKey = formatDateKey(addDays(today, -(2 * windowDays - 1)));
  const previousPeriodEndKey = formatDateKey(addDays(today, -windowDays));

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const workoutExerciseById = new Map(workoutExercises.map((item) => [item.id, item]));
  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();

  workoutSets.forEach((set) => {
    const sets = setsByWorkoutExercise.get(set.workoutExerciseId) ?? [];
    sets.push(set);
    setsByWorkoutExercise.set(set.workoutExerciseId, sets);
  });

  const completedSessions = sessions
    .filter((session) => session.status === 'completed' && session.isDemo !== true)
    .sort((a, b) => a.date.localeCompare(b.date));
  const completedSessionIds = new Set(completedSessions.map((session) => session.id));
  const completedWorkoutExercises = workoutExercises.filter((item) => completedSessionIds.has(item.sessionId));
  const currentPeriodSessions = completedSessions.filter(
    (session) => session.date >= currentPeriodStartKey && session.date <= todayKey,
  );
  const currentPeriodSessionIds = new Set(currentPeriodSessions.map((session) => session.id));
  const previousPeriodSessionIds = new Set(
    completedSessions
      .filter((session) => session.date >= previousPeriodStartKey && session.date <= previousPeriodEndKey)
      .map((session) => session.id),
  );

  const weekStats = Array.from({ length: 12 }, (_, index): WeekStat => {
    const end = addDays(today, -7 * (11 - index));
    const start = addDays(end, -6);
    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);
    const weekSessions = completedSessions.filter((session) => session.date >= startKey && session.date <= endKey);
    const weekSessionIds = new Set(weekSessions.map((session) => session.id));
    const weekWorkoutExerciseIds = new Set(
      workoutExercises.filter((item) => weekSessionIds.has(item.sessionId)).map((item) => item.id),
    );
    const weekSets = workoutSets.filter((set) => weekWorkoutExerciseIds.has(set.workoutExerciseId) && set.isCompleted);

    return {
      key: startKey,
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      start,
      end,
      workoutDays: new Set(weekSessions.map((session) => session.date)).size,
      volumeKg: weekSets.reduce((sum, set) => sum + setVolume(set), 0),
      sets: weekSets.length,
      hardSets: normalizedHardSetCount(weekSets, workoutExerciseById, exerciseById),
    };
  });

  function setsForSessionIds(sessionIds: Set<string>) {
    const ids = new Set(workoutExercises.filter((item) => sessionIds.has(item.sessionId)).map((item) => item.id));
    return workoutSets.filter((set) => ids.has(set.workoutExerciseId) && set.isCompleted);
  }

  const currentPeriodSets = setsForSessionIds(currentPeriodSessionIds);
  const previousPeriodSets = setsForSessionIds(previousPeriodSessionIds);
  const totalVolumeKg = currentPeriodSets.reduce((sum, set) => sum + setVolume(set), 0);
  const previousPeriodVolumeKg = previousPeriodSets.reduce((sum, set) => sum + setVolume(set), 0);
  const isWarmupSetForStats = (set: WorkoutSet) => {
    const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
    const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
    const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
    return Boolean(isWarmup) || isWarmupOnlyExercise(exercise);
  };
  const currentPeriodTrainingSets = currentPeriodSets.filter((set) => !isWarmupSetForStats(set));
  const hardSets = normalizedHardSetCount(currentPeriodSets, workoutExerciseById, exerciseById);

  type MuscleAccumulator = Omit<MuscleStat, 'status' | 'targetPct' | 'deficitSets' | 'excessSets' | 'setsPerWeek'>;
  const muscleMap = new Map<MuscleGroup, MuscleAccumulator>(
    trackedMuscles.map((group) => [group, {
      group,
      volumeKg: 0,
      sets: 0,
      hardSets: 0,
      recommendedMin: recommendedSets[group].min,
      recommendedMax: recommendedSets[group].max,
    }]),
  );

  completedWorkoutExercises
    .filter((item) => currentPeriodSessionIds.has(item.sessionId))
    .forEach((workoutExercise) => {
      const exercise = exerciseById.get(workoutExercise.exerciseId);
      if (!exercise) return;

      const groups = toMuscleGroups(exercise);
      const sets = (setsByWorkoutExercise.get(workoutExercise.id) ?? []).filter((set) => set.isCompleted);
      const trainingSets = sets.filter((set) => !isWarmupSetForStats(set));
      groups.forEach((group) => {
        const stat = muscleMap.get(group);
        if (!stat) return;
        stat.volumeKg += sets.reduce((sum, set) => sum + setVolume(set), 0);
        stat.sets += trainingSets.length;
        stat.hardSets += normalizedHardSetCount(sets, workoutExerciseById, exerciseById);
      });
    });

  const muscleStats = Array.from(muscleMap.values()).map((stat) => decorateMuscleStat(stat, weeksInPeriod));

  const performances = Array.from(
    completedWorkoutExercises.reduce<Map<string, WorkoutExercise[]>>((map, item) => {
      const list = map.get(item.exerciseId) ?? [];
      list.push(item);
      map.set(item.exerciseId, list);
      return map;
    }, new Map()).entries(),
  ).map(([exerciseId, items]) => {
    const exercise = exerciseById.get(exerciseId);
    const sorted = items
      .slice()
      .sort((a, b) => (sessionById.get(b.sessionId)?.date ?? '').localeCompare(sessionById.get(a.sessionId)?.date ?? ''));
    const latest = sorted[0];
    const latestSets = latest ? (setsByWorkoutExercise.get(latest.id) ?? []).filter((set) => set.isCompleted) : [];
    const allSets = items.flatMap((item) => setsByWorkoutExercise.get(item.id) ?? []).filter((set) => set.isCompleted);
    const oneRmHistory = sorted
      .slice(0, 4)
      .map((item) => {
        const session = sessionById.get(item.sessionId);
        const sessionSets = (setsByWorkoutExercise.get(item.id) ?? []).filter((set) => set.isCompleted);
        return {
          label: session?.date.slice(5) ?? '',
          valueKg: Math.max(0, ...sessionSets.map(estimatedOneRm)),
        };
      })
      .filter((item) => item.valueKg > 0)
      .reverse();
    const chartHistory = sorted
      .slice(0, 6)
      .map((item) => {
        const session = sessionById.get(item.sessionId);
        const sessionSets = (setsByWorkoutExercise.get(item.id) ?? []).filter((set) => set.isCompleted);
        return {
          label: session ? `${session.date.slice(5, 7)}/${session.date.slice(8, 10)}` : '',
          oneRm: Math.max(0, ...sessionSets.map(estimatedOneRm)),
          volume: sessionSets.reduce((sum, set) => sum + setVolume(set), 0),
        };
      })
      .filter((item) => item.oneRm > 0 || item.volume > 0)
      .reverse();
    const currentPeriodVolume = items
      .filter((item) => {
        const date = sessionById.get(item.sessionId)?.date ?? '';
        return date >= currentPeriodStartKey && date <= todayKey;
      })
      .flatMap((item) => setsByWorkoutExercise.get(item.id) ?? [])
      .reduce((sum, set) => sum + setVolume(set), 0);
    const previousPeriodVolume = items
      .filter((item) => {
        const date = sessionById.get(item.sessionId)?.date ?? '';
        return date >= previousPeriodStartKey && date <= previousPeriodEndKey;
      })
      .flatMap((item) => setsByWorkoutExercise.get(item.id) ?? [])
      .reduce((sum, set) => sum + setVolume(set), 0);

    return {
      id: exerciseId,
      name: exercise ? getExerciseName(exercise, locale) : exerciseId,
      recentWeightKg: Math.max(0, ...latestSets.map((set) => set.weightKg)),
      bestWeightKg: Math.max(0, ...allSets.map((set) => set.weightKg)),
      recentVolumeKg: latestSets.reduce((sum, set) => sum + setVolume(set), 0),
      bestVolumeKg: Math.max(0, ...items.map((item) => (
        (setsByWorkoutExercise.get(item.id) ?? []).reduce((sum, set) => sum + setVolume(set), 0)
      ))),
      estimatedOneRmKg: Math.max(0, ...allSets.map(estimatedOneRm)),
      fourWeekChangePct: pctChange(currentPeriodVolume, previousPeriodVolume),
      oneRmHistory,
      chartHistory,
    };
  }).sort((a, b) => b.recentVolumeKg - a.recentVolumeKg);

  const dailyTrendLength = Math.min(Math.max(windowDays, 7), 14);
  const dailyTrendStart = addDays(today, -(dailyTrendLength - 1));
  const cardioBySessionId = cardioRecords.reduce<Map<string, CardioRecord[]>>((map, record) => {
    const list = map.get(record.sessionId) ?? [];
    list.push(record);
    map.set(record.sessionId, list);
    return map;
  }, new Map());
  const dailyTrend = Array.from({ length: dailyTrendLength }, (_, index): DailyTrendStat => {
    const date = addDays(dailyTrendStart, index);
    const dateKey = formatDateKey(date);
    const daySessions = completedSessions.filter((session) => session.date === dateKey);
    const daySessionIds = new Set(daySessions.map((session) => session.id));
    const dayWorkoutExercises = workoutExercises.filter((item) => daySessionIds.has(item.sessionId));
    const itemMap = new Map<string, DailyTrendItem>();

    dayWorkoutExercises.forEach((workoutExercise) => {
      const exercise = exerciseById.get(workoutExercise.exerciseId);
      if (!exercise) return;

      const sets = (setsByWorkoutExercise.get(workoutExercise.id) ?? []).filter((set) => set.isCompleted);
      const trainingSets = sets.filter((set) => !isWarmupSetForStats(set));
      const volumeKg = sets.reduce((sum, set) => sum + setVolume(set), 0);
      if (volumeKg <= 0 && trainingSets.length === 0) return;

      const label = getExerciseName(exercise, locale);
      const current = itemMap.get(workoutExercise.exerciseId) ?? {
        key: workoutExercise.exerciseId,
        label,
        volumeKg: 0,
        sets: 0,
        distanceKm: 0,
      };
      current.volumeKg += volumeKg;
      current.sets += trainingSets.length;
      itemMap.set(workoutExercise.exerciseId, current);
    });

    const cardioDistanceKm = daySessions.reduce((sum, session) => (
      sum + (cardioBySessionId.get(session.id) ?? [])
        .filter((record) => record.isDraft !== true)
        .reduce((cardioSum, record) => cardioSum + (record.distanceKm ?? 0), 0)
    ), 0);
    if (cardioDistanceKm > 0) {
      itemMap.set('cardio', {
        key: 'cardio',
        label: locale === 'ko' ? '러닝' : 'Running',
        volumeKg: 0,
        sets: 0,
        distanceKm: cardioDistanceKm,
      });
    }

    const items = Array.from(itemMap.values()).sort((a, b) => (b.volumeKg + b.distanceKm * 1000) - (a.volumeKg + a.distanceKm * 1000));

    return {
      date: dateKey,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      strengthVolumeKg: items.reduce((sum, item) => sum + item.volumeKg, 0),
      strengthSets: items.reduce((sum, item) => sum + item.sets, 0),
      cardioDistanceKm,
      items,
    };
  });

  const strengthRecoveryInputs = completedWorkoutExercises.flatMap((workoutExercise) => {
    const session = sessionById.get(workoutExercise.sessionId);
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    if (!session || !exercise) return [];

    const groups = toRecoveryMuscleGroups(exercise);
    if (groups.length === 0) return [];

    const completedAt = session.endedAt ?? session.startedAt ?? `${session.date}T12:00:00`;
    return (setsByWorkoutExercise.get(workoutExercise.id) ?? [])
      .filter((set) => set.isCompleted)
      .map((set) => ({
        date: session.date,
        completedAt,
        muscleGroups: groups,
        load: setVolume(set),
        isHard: isHardSet(set, exercise),
        isWarmup: isWarmupSetForStats(set),
      }));
  });
  const cardioRecoveryInputs = completedSessions.flatMap((session) => (
    (cardioBySessionId.get(session.id) ?? [])
      .filter((record) => record.isDraft !== true)
      .map((record) => {
        const distanceLoad = (record.distanceKm ?? 0) * 650;
        const durationLoad = (record.durationSeconds ?? 0) / 60 * 45;
        return {
          date: session.date,
          completedAt: record.endedAt ?? record.startedAt,
          muscleGroups: ['cardio'] as RecoveryMuscleGroup[],
          load: Math.max(distanceLoad, durationLoad),
        };
      })
  ));
  const recovery = buildRecoverySnapshot([...strengthRecoveryInputs, ...cardioRecoveryInputs], { asOf: today });

  const warnings: string[] = [];
  const completedDates = Array.from(new Set(completedSessions.map((session) => session.date))).sort();
  let streak = 0;
  for (let cursor = new Date(today); cursor >= addDays(today, -14); cursor = addDays(cursor, -1)) {
    if (completedDates.includes(formatDateKey(cursor))) streak += 1;
    else if (streak > 0) break;
  }
  if (streak >= 4) {
    warnings.push(tf(locale, 'statsWarningStreak', { days: streak }));
  }

  const muscleHistory: Array<{ group: MuscleGroup; date: Date }> = [];
  completedWorkoutExercises.forEach((workoutExercise) => {
    const session = sessionById.get(workoutExercise.sessionId);
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    if (!session || !exercise || !currentPeriodSessionIds.has(session.id)) return;
    const timestamp = new Date(session.startedAt ?? `${session.date}T12:00:00`);
    toMuscleGroups(exercise).forEach((group) => muscleHistory.push({ group, date: timestamp }));
  });
  trackedMuscles.forEach((group) => {
    const dates = muscleHistory
      .filter((item) => item.group === group)
      .map((item) => item.date)
      .sort((a, b) => a.getTime() - b.getTime());
    const hasShortGap = dates.some((date, index) => index > 0 && date.getTime() - dates[index - 1].getTime() < 48 * 60 * 60 * 1000);
    if (hasShortGap) {
      warnings.push(tf(locale, 'statsWarningMuscleGap', { muscle: muscleLabels[locale][group] }));
    }
  });

  const weekChange = pctChange(totalVolumeKg, previousPeriodVolumeKg);
  if (weekChange !== undefined && weekChange >= 25) {
    warnings.push(tf(locale, 'statsWarningVolumeSpike', { change: weekChange.toFixed(0) }));
  }
  const hardSetRatio = currentPeriodTrainingSets.length > 0 ? (hardSets / currentPeriodTrainingSets.length) * 100 : 0;
  if (hardSetRatio > 70) {
    warnings.push(tf(locale, 'statsWarningHardSetRatio', { ratio: hardSetRatio.toFixed(0) }));
  }
  const deloadRecommendation = buildDeloadRecommendation(weekStats, hardSetRatio, recovery, locale);

  const lowMuscles = muscleStats.filter((stat) => stat.status === 'low').map((stat) => muscleLabels[locale][stat.group]);
  const highMuscles = muscleStats.filter((stat) => stat.status === 'high' || stat.status === 'caution').map((stat) => muscleLabels[locale][stat.group]);
  const fourWeekAverageVolume = weekStats.slice(-4).reduce((sum, week) => sum + week.volumeKg, 0) / 4;
  const periodWeeklyVolume = totalVolumeKg / Math.max(1, weeksInPeriod);
  const periodVolumeVsAverage = pctChange(periodWeeklyVolume, fourWeekAverageVolume);
  const analysisComment = [
    tf(locale, 'statsAnalysisWeekSummary', {
      days: currentPeriodSessions.length,
      volume: Math.round(totalVolumeKg).toLocaleString(),
      sets: currentPeriodSets.length,
    }),
    periodVolumeVsAverage !== undefined
      ? tf(locale, 'statsAnalysisVolumeVsAverage', { change: formatPct(periodVolumeVsAverage) })
      : t(locale, 'statsAnalysisVolumeAveragePending'),
    tf(locale, 'statsAnalysisHardSetRatio', { ratio: hardSetRatio.toFixed(0) }),
    lowMuscles.length > 0
      ? tf(locale, 'statsAnalysisLowMuscles', { muscles: lowMuscles.slice(0, 3).join(', ') })
      : t(locale, 'statsAnalysisMusclesInRange'),
    highMuscles.length > 0
      ? tf(locale, 'statsAnalysisHighMuscles', { muscles: highMuscles.slice(0, 3).join(', ') })
      : t(locale, 'statsAnalysisNoOverload'),
    locale === 'ko'
      ? `평균 회복도는 ${recovery.averageRecoveryPercent}%입니다.`
      : `Average recovery is ${recovery.averageRecoveryPercent}%.`,
    warnings.length > 0 ? t(locale, 'statsAnalysisReduceWarnings') : t(locale, 'statsAnalysisAddSets'),
  ].join(' ');
  const recoverySuggestionGroups = recovery.mostFatiguedGroups.filter((group) => group.recoveryPercent < 60);
  const recoverySuggestion = recoverySuggestionGroups.length > 0
    ? locale === 'ko'
      ? `${recoverySuggestionGroups.slice(0, 2).map((group) => recoveryLabels.ko[group.group]).join(', ')}는 볼륨을 줄이고 회복을 우선하세요.`
      : `Reduce load and prioritize recovery for ${recoverySuggestionGroups.slice(0, 2).map((group) => recoveryLabels.en[group.group]).join(', ')}.`
    : undefined;
  const nextWeekSuggestions = [
    deloadRecommendation
      ? locale === 'ko'
        ? `다음 운동은 디로드로 전환하고 세트를 약 ${deloadRecommendation.suggestedSetReductionPct}% 줄이세요.`
        : `Switch the next workout to a deload and cut sets by about ${deloadRecommendation.suggestedSetReductionPct}%.`
      : undefined,
    recoverySuggestion,
    warnings.length > 0 ? t(locale, 'statsNextWeekRecovery') : t(locale, 'statsNextWeekHoldVolume'),
    lowMuscles.length > 0 ? t(locale, 'statsNextWeekAddLagging') : undefined,
    highMuscles.length > 0 ? t(locale, 'statsNextWeekReduceHigh') : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    windowDays,
    weeksInPeriod,
    trendGranularity,
    workoutDays: currentPeriodSessions.length,
    totalVolumeKg,
    totalSets: currentPeriodSets.length,
    hardSets,
    weekOverWeekPct: weekChange,
    hardSetRatio,
    weeks: weekStats,
    dailyTrend,
    muscleStats,
    performances,
    recovery,
    deloadRecommendation,
    warnings,
    analysisComment,
    nextWeekSuggestions,
  };
}

export function buildAiPrompt(stats: StatsView, locale: Locale): string {
  if (locale === 'ko') {
    const muscleLines = stats.muscleStats
      .map(
        (m) =>
          `- ${muscleLabels.ko[m.group]}: ${Math.round(m.volumeKg).toLocaleString()}kg, ${m.sets}세트 (Hard 세트: ${
            m.hardSets
          }, 상태: ${
            m.status === 'normal'
              ? '적정'
              : m.status === 'high'
              ? '과다'
              : m.status === 'caution'
              ? '주의'
              : '부족'
          })`,
      )
      .join('\n');

    const warningLines =
      stats.warnings.length > 0
        ? stats.warnings.map((w) => `- ${w}`).join('\n')
        : '- 특이사항 없음';

    return `[역할 정의]
너는 전문 피트니스 AI 코치야. 아래의 내 이번 주 운동 데이터를 바탕으로 내 훈련량과 신체 상태를 정밀 분석하고, 다음 주 운동 계획 및 정체기 극복, 부상 방지를 위한 구체적이고 전문적인 피드백을 제공해줘.

[내 이번 주 운동 데이터]
- 운동일수: ${stats.workoutDays}일
- 총 볼륨: ${Math.round(stats.totalVolumeKg).toLocaleString()}kg
- 총 세트: ${stats.totalSets}세트 (Hard 세트: ${stats.hardSets}세트, 비율: ${stats.hardSetRatio.toFixed(0)}%)
- 평균 회복도: ${stats.recovery.averageRecoveryPercent}% (${recoveryStatusLabel(stats.recovery.readinessStatus, locale)})
- 전주 대비 변화율: ${formatPct(stats.weekOverWeekPct)}

[근육군별 분석 (권장 세트 수와 비교)]
${muscleLines}

[발생한 경고 및 피드백]
${warningLines}

[로컬 자동 분석 결과]
${stats.analysisComment}

[요청 사항]
이 데이터들을 정밀 진단해서:
1. 내 현재 훈련 볼륨과 세트 수가 적절한지 평가해줘.
2. 경고 사항(연속 운동일, 특정 부위 중복, 급격한 볼륨 증가 등)이 있다면 이를 개선하기 위한 회복 팁을 줘.
3. 다음 주에 각 근육군별 세트 수와 볼륨을 어떻게 조정해야 점진적 과부하를 안전하게 달성할 수 있을지 구체적인 세트/횟수 가이드를 제시해줘.`;
  } else {
    const muscleLines = stats.muscleStats
      .map(
        (m) =>
          `- ${muscleLabels.en[m.group]}: ${Math.round(m.volumeKg).toLocaleString()}kg, ${m.sets} sets (Hard sets: ${
            m.hardSets
          }, Status: ${m.status.toUpperCase()})`,
      )
      .join('\n');

    const warningLines =
      stats.warnings.length > 0
        ? stats.warnings.map((w) => `- ${w}`).join('\n')
        : '- No warnings';

    return `[Role Definition]
You are a professional fitness AI coach. Based on my workout data this week below, please analyze my training volume and fatigue levels, and provide specific, professional feedback for my next week's schedule, overcoming plateaus, and preventing injuries.

[My Workout Data This Week]
- Workout Days: ${stats.workoutDays}d
- Total Volume: ${Math.round(stats.totalVolumeKg).toLocaleString()}kg
- Total Sets: ${stats.totalSets} (Hard Sets: ${stats.hardSets}, Ratio: ${stats.hardSetRatio.toFixed(0)}%)
- Average Recovery: ${stats.recovery.averageRecoveryPercent}% (${recoveryStatusLabel(stats.recovery.readinessStatus, locale)})
- Week-over-Week Change: ${formatPct(stats.weekOverWeekPct)}

[Muscle-Group Analysis]
${muscleLines}

[Warnings & Recovery Feedback]
${warningLines}

[Local Auto-Analysis]
${stats.analysisComment}

[Request]
Please evaluate my data and:
1. Assess whether my current training volume and set counts are appropriate.
2. Provide recovery tips to address any warnings (consecutive training days, muscle overlaps, rapid volume surges).
3. Offer a concrete guide on how to adjust my sets and volume next week for safe, progressive overload.`;
  }
}
