import { AlertTriangle, BarChart3, CalendarRange, Dumbbell, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { getExerciseCategories, getExerciseName, isWarmupOnlyExercise } from '../domain/exercises';
import { buildRecoverySnapshot, type RecoveryMuscleGroup, type RecoverySnapshot, type RecoveryStatus } from '../domain/recovery';
import { getStoredLocale, t, tf } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { IOSPageHeader, IOSSegmentedControl } from '../components/IosPrimitives';
import { RecoveryBodyMap } from '../components/workout/RecoveryBodyMap';
import { MuscleVolumeRings } from '../components/stats/MuscleVolumeRings';
import { StaticLineChart } from '../components/stats/StaticLineChart';

type Locale = 'ko' | 'en';
type MuscleGroup = Exclude<RecoveryMuscleGroup, 'cardio'>;
type LoadStatus = 'low' | 'normal' | 'high' | 'caution';

type WeekStat = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  workoutDays: number;
  volumeKg: number;
  sets: number;
  hardSets: number;
};

type MuscleStat = {
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

type ExercisePerformance = {
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

type DailyTrendItem = {
  key: string;
  label: string;
  volumeKg: number;
  sets: number;
  distanceKm: number;
};

type DailyTrendStat = {
  date: string;
  label: string;
  strengthVolumeKg: number;
  strengthSets: number;
  cardioDistanceKm: number;
  items: DailyTrendItem[];
};

type StatsView = {
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
  warnings: string[];
  analysisComment: string;
  nextWeekSuggestions: string[];
};

const muscleLabels: Record<Locale, Record<MuscleGroup, string>> = {
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

const recoveryLabels: Record<Locale, Record<RecoveryMuscleGroup, string>> = {
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

const recommendedSets: Record<MuscleGroup, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  legs: { min: 10, max: 20 },
  shoulder: { min: 8, max: 16 },
  biceps: { min: 6, max: 14 },
  triceps: { min: 6, max: 14 },
  core: { min: 4, max: 12 },
};

const trackedMuscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulder', 'biceps', 'triceps', 'core'];

// Today-anchored rolling analysis windows. `days` drives every period metric so the
// whole screen reads against the same range (no mixed calendar-week vs rolling logic).
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

function addDays(date: Date, days: number): Date {
  const copyDate = new Date(date);
  copyDate.setDate(copyDate.getDate() + days);
  return copyDate;
}

function pctChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return ((current - previous) / previous) * 100;
}

function setVolume(set: WorkoutSet): number {
  return set.isCompleted ? set.weightKg * set.reps : 0;
}

function estimatedOneRm(set: WorkoutSet): number {
  return set.weightKg * (1 + set.reps / 30);
}

function isHardSet(set: WorkoutSet, exercise: ExerciseMaster): boolean {
  const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
  return set.isCompleted && !isWarmup && !isWarmupOnlyExercise(exercise) && set.isHard === true;
}

function toMuscleGroups(exercise: ExerciseMaster): MuscleGroup[] {
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

function toRecoveryMuscleGroups(exercise: ExerciseMaster): RecoveryMuscleGroup[] {
  const groups: RecoveryMuscleGroup[] = [...toMuscleGroups(exercise)];
  const categories = getExerciseCategories(exercise);
  if (categories.includes('cardio')) groups.push('cardio');
  if (groups.length === 0 && categories.includes('bodyweight')) groups.push('core');
  return Array.from(new Set(groups));
}

function statusForSets(sets: number, min: number, max: number): LoadStatus {
  if (sets < min) return sets >= min * 0.7 ? 'caution' : 'low';
  if (sets > max) return sets <= max * 1.25 ? 'caution' : 'high';
  return 'normal';
}

function formatPct(value?: number): string {
  if (value === undefined) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString()}kg`;
}

function signedTone(value?: number): string {
  if (value === undefined) return 'text-[#8E8E93]';
  if (value > 0) return 'text-[#159A91]';
  if (value < 0) return 'text-[#FF9500]';
  return 'text-[#6E6E73]';
}

function muscleTone(status: LoadStatus): string {
  if (status === 'normal') return 'bg-[#34C759]';
  if (status === 'high') return 'bg-[#FF3B30]';
  if (status === 'caution') return 'bg-[#FF9500]';
  return 'bg-[#8E8E93]';
}

function insightStatus(stats: StatsView): LoadStatus {
  if (stats.recovery.readinessStatus === 'fatigued') return 'high';
  if (stats.recovery.readinessStatus === 'moderate') return 'caution';
  if (stats.warnings.length > 0 || stats.hardSetRatio > 70) return 'caution';
  if (stats.workoutDays === 0 || stats.totalSets === 0) return 'low';
  return 'normal';
}

function insightLabel(status: LoadStatus, locale: Locale): string {
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

function insightMessage(stats: StatsView, locale: Locale): string {
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

function decorateMuscleStat(
  stat: Omit<MuscleStat, 'status' | 'targetPct' | 'deficitSets' | 'excessSets' | 'setsPerWeek'>,
  weeksInPeriod: number,
): MuscleStat {
  // Targets are defined per week, so normalize the period set count before comparing.
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
  // Current period is [today-(windowDays-1) .. today]; the previous period is the
  // equally long block immediately before it, so every comparison is like-for-like.
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
    .filter((session) => session.status === 'completed')
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

  // Rolling weekly buckets ending today; the trend rail and 4-week average read from these.
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
      hardSets: weekSets.filter((set) => {
        const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
        const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
        return exercise ? isHardSet(set, exercise) : false;
      }).length,
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
  const hardSets = currentPeriodSets.filter((set) => {
    const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
    const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
    return exercise ? isHardSet(set, exercise) : false;
  }).length;

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
        stat.hardSets += sets.filter((set) => isHardSet(set, exercise)).length;
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
  }).sort((a, b) => b.recentVolumeKg - a.recentVolumeKg).slice(0, 12);

  // Daily rail spans the selected window (capped at 14 bars for readability).
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

  const lowMuscles = muscleStats.filter((stat) => stat.status === 'low').map((stat) => muscleLabels[locale][stat.group]);
  const highMuscles = muscleStats.filter((stat) => stat.status === 'high' || stat.status === 'caution').map((stat) => muscleLabels[locale][stat.group]);
  // Normalize to a weekly rate so the period volume is comparable to the trailing weekly average.
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
    warnings,
    analysisComment,
    nextWeekSuggestions,
  };
}

function Badge({ status, locale }: { status: LoadStatus; locale: Locale }) {
  const labels = {
    ko: { low: '부족', normal: '적정', high: '과다', caution: '주의' },
    en: { low: 'Low', normal: 'Good', high: 'High', caution: 'Caution' },
  };
  const className = status === 'normal'
    ? 'bg-emerald-500/15 text-[#159A91] border border-emerald-500/20'
    : status === 'high'
    ? 'bg-rose-500/15 text-rose-600 border border-rose-500/20'
    : 'bg-amber-500/15 text-amber-600 border border-amber-500/20';

  return <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase ${className}`}>{labels[locale][status]}</span>;
}

function StatTile({
  label,
  value,
  helper,
  icon,
  tone = 'text-[#1C1C1E]',
}: {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[#F2F2F7] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#8E8E93]">{icon}</span>
        {helper ? <span className={`truncate text-[11px] font-black ${tone}`}>{helper}</span> : null}
      </div>
      <p className="mt-1 text-[11px] font-bold uppercase text-[#6E6E73]">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-black leading-none ${tone}`}>{value}</p>
    </div>
  );
}

function ReadinessPanel({ stats, locale }: { stats: StatsView; locale: Locale }) {
  const status = insightStatus(stats);
  const statusClass = status === 'normal'
    ? 'bg-[#2EC4B6] text-white'
    : status === 'high'
      ? 'bg-[#FF3B30] text-white'
    : status === 'caution'
      ? 'bg-[#FF9500] text-white'
      : 'bg-[#8E8E93] text-white';

  return (
    <section className="ios-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#159A91]">
            {locale === 'ko' ? '회복 판정' : 'Recovery read'}
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-[#1C1C1E]">
            {locale === 'ko'
              ? `${stats.recovery.averageRecoveryPercent}% 회복`
              : `${stats.recovery.averageRecoveryPercent}% recovered`}
          </h2>
          <p className="mt-0.5 text-[11px] font-black text-[#8E8E93]">
            {locale === 'ko'
              ? `${stats.workoutDays}일 / ${formatKg(stats.totalVolumeKg)}`
              : `${stats.workoutDays}d / ${formatKg(stats.totalVolumeKg)}`}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-[#6E6E73]">
            {insightMessage(stats, locale)}
          </p>
        </div>
        <span className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-black uppercase shadow-sm ${statusClass}`}>
          {insightLabel(status, locale)}
        </span>
      </div>
    </section>
  );
}

function recoveryBarClass(status: RecoveryStatus): string {
  if (status === 'ready') return 'bg-[#34C759]';
  if (status === 'moderate') return 'bg-[#FF9500]';
  return 'bg-[#FF3B30]';
}

function recoveryStatusLabel(status: RecoveryStatus, locale: Locale): string {
  if (locale === 'ko') {
    if (status === 'ready') return '좋음';
    if (status === 'moderate') return '보통';
    return '피로';
  }
  if (status === 'ready') return 'Ready';
  if (status === 'moderate') return 'Moderate';
  return 'Fatigued';
}

function RecoveryDashboardPanel({ recovery, locale }: { recovery: RecoverySnapshot; locale: Locale }) {
  const [showDetails, setShowDetails] = useState(false);
  const rows = recovery.groups
    .slice()
    .sort((a, b) => a.recoveryPercent - b.recoveryPercent || b.decayedLoad - a.decayedLoad)
    .slice(0, 8);
  const fatiguedGroups = recovery.mostFatiguedGroups.filter((group) => group.recoveryPercent < 60);
  const recommendation = locale === 'ko'
    ? fatiguedGroups.length > 0
      ? `${fatiguedGroups.slice(0, 2).map((group) => recoveryLabels.ko[group.group]).join(', ')} 회복을 우선하세요.`
      : '계획한 운동을 유지하거나 소폭 진행해도 됩니다.'
    : recovery.recommendation;

  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '회복 대시보드' : 'Recovery dashboard'}</h2>
          <p className="mt-0.5 truncate text-[11px] font-bold text-[#8E8E93]">
            {recommendation}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-lg bg-[#F2F2F7] px-2 py-1 text-[11px] font-black uppercase text-[#1C1C1E] whitespace-nowrap">
            {recoveryStatusLabel(recovery.readinessStatus, locale)}
          </span>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="rounded-lg bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-[#007AFF] px-2.5 py-1 text-[11px] font-black transition-all active:scale-95 whitespace-nowrap"
          >
            {showDetails ? (locale === 'ko' ? '접기' : '자세히') : (locale === 'ko' ? '자세히' : 'Details')}
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="mt-2.5 grid gap-2 border-t border-[#E5E5EA] pt-2.5 animate-fade-in">
          {rows.map((group) => (
            <div key={group.group} className="grid grid-cols-[4.7rem_1fr_3.2rem] items-center gap-2">
              <span className="truncate text-xs font-black text-[#1C1C1E]">{recoveryLabels[locale][group.group]}</span>
              <div className="h-2 overflow-hidden rounded-full bg-[#E5E5EA]">
                <span
                  className={`block h-full rounded-full ${recoveryBarClass(group.status)}`}
                  style={{ width: `${group.recoveryPercent}%` }}
                />
              </div>
              <span className="text-right text-[11px] font-black tabular-nums text-[#1C1C1E]">{group.recoveryPercent}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WeeklyLoadStrip({ weeks, locale }: { weeks: WeekStat[]; locale: Locale }) {
  const maxVolume = Math.max(1, ...weeks.map((week) => week.volumeKg));
  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  const latestChange = latest && previous ? pctChange(latest.volumeKg, previous.volumeKg) : undefined;

  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#1C1C1E]">
            {locale === 'ko' ? `${weeks.length}주 부하` : `${weeks.length}-week load`}
          </h2>
          <p className="mt-0.5 text-[11px] font-bold text-[#8E8E93]">
            {latest ? `${latest.label} ${formatKg(latest.volumeKg)}` : '0kg'}
          </p>
        </div>
        <span className={`text-sm font-black ${signedTone(latestChange)}`}>{formatPct(latestChange)}</span>
      </div>
      <div className="mt-2.5 flex h-16 items-end gap-1.5">
        {weeks.map((week, index) => {
          const isLatest = index === weeks.length - 1;
          return (
            <div key={week.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md ${isLatest ? 'bg-[#2EC4B6]' : 'bg-[#D1D1D6]'}`}
                style={{ height: `${Math.max(5, (week.volumeKg / maxVolume) * 48)}px` }}
                aria-label={`${week.label} ${Math.round(week.volumeKg)}kg`}
              />
              <span className={`text-[9px] font-bold ${isLatest ? 'text-[#159A91]' : 'text-[#8E8E93]'}`}>{week.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DailyLoadRail({ days, locale }: { days: DailyTrendStat[]; locale: Locale }) {
  const maxStrength = Math.max(1, ...days.map((day) => day.strengthVolumeKg));
  const maxCardio = Math.max(1, ...days.map((day) => day.cardioDistanceKm));

  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '일별 부하' : 'Daily load'}</h2>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-[#8E8E93]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#34C759]" />kg</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#007AFF]" />km</span>
        </div>
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const strengthHeight = day.strengthVolumeKg > 0 ? Math.max(8, (day.strengthVolumeKg / maxStrength) * 38) : 0;
          const cardioHeight = day.cardioDistanceKm > 0 ? Math.max(5, (day.cardioDistanceKm / maxCardio) * 22) : 0;
          const hasWork = strengthHeight > 0 || cardioHeight > 0;

          return (
            <div key={day.date} className="flex min-w-0 flex-col items-center gap-1">
              <div className={`flex h-12 w-full flex-col justify-end overflow-hidden rounded-md ${hasWork ? 'bg-white' : 'bg-[#F2F2F7]'}`}>
                {cardioHeight > 0 ? <span className="w-full bg-[#007AFF]" style={{ height: `${cardioHeight}px` }} /> : null}
                {strengthHeight > 0 ? <span className="w-full bg-[#34C759]" style={{ height: `${strengthHeight}px` }} /> : null}
              </div>
              <span className="text-[8px] font-bold text-[#8E8E93]">{day.label.split('/')[1]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MuscleBalancePanel({ muscles, locale }: { muscles: MuscleStat[]; locale: Locale }) {
  const [showBars, setShowBars] = useState(false);
  const sorted = muscles
    .slice()
    .sort((a, b) => {
      const statusRank = { high: 0, caution: 1, low: 2, normal: 3 } satisfies Record<LoadStatus, number>;
      return statusRank[a.status] - statusRank[b.status] || b.setsPerWeek - a.setsPerWeek;
    });

  const ringData = muscles.map((m) => ({
    group: m.group,
    label: muscleLabels[locale][m.group],
    setsPerWeek: m.setsPerWeek,
    recommendedMin: m.recommendedMin,
    recommendedMax: m.recommendedMax,
    status: m.status,
    targetPct: m.targetPct,
  }));

  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '부위 밸런스' : 'Muscle balance'}</h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-[#8E8E93] mr-1">{locale === 'ko' ? '목표 대비 세트' : 'sets vs target'}</span>
          <button
            type="button"
            onClick={() => setShowBars(!showBars)}
            className="rounded-lg bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-[#007AFF] px-2.5 py-1 text-[11px] font-black transition-all active:scale-95 whitespace-nowrap"
          >
            {showBars ? (locale === 'ko' ? '접기' : '자세히') : (locale === 'ko' ? '자세히' : 'Details')}
          </button>
        </div>
      </div>
      <MuscleVolumeRings muscles={ringData} locale={locale} />
      {showBars && (
        <div className="mt-3.5 grid gap-2 border-t border-[#E5E5EA] pt-3.5 animate-fade-in">
          {sorted.map((muscle) => {
            const minPct = Math.min(100, Math.round((muscle.recommendedMin / Math.max(1, muscle.recommendedMax)) * 100));
            const fillPct = muscle.setsPerWeek > 0 ? Math.max(3, muscle.targetPct) : 0;
            const targetLabel = `${muscle.setsPerWeek}/${muscle.recommendedMin}-${muscle.recommendedMax}`;

            return (
              <div key={muscle.group} className="grid grid-cols-[4.3rem_1fr_4.2rem] items-center gap-2">
                <span className="truncate text-xs font-black text-[#1C1C1E]">{muscleLabels[locale][muscle.group]}</span>
                <div
                  className="relative h-2 rounded-full bg-[#E5E5EA]"
                  aria-label={`${muscleLabels[locale][muscle.group]} ${targetLabel}`}
                >
                  <span
                    className="absolute top-0 h-2 rounded-r-full bg-white/55"
                    style={{ left: `${minPct}%`, width: `${100 - minPct}%` }}
                  />
                  <span
                    className="absolute top-[-3px] z-10 h-4 w-0.5 rounded-full bg-[#1C1C1E]/45"
                    style={{ left: `calc(${minPct}% - 1px)` }}
                  />
                  <span
                    className={`absolute left-0 top-0 z-0 h-2 rounded-full ${muscleTone(muscle.status)}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <span className="text-right text-[11px] font-black tabular-nums text-[#1C1C1E]">{targetLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionPanel({ stats, locale }: { stats: StatsView; locale: Locale }) {
  return (
    <section className="ios-card p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden="true" size={16} className={stats.warnings.length > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'} />
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '다음 액션' : 'Next actions'}</h2>
      </div>
      <div className="mt-2 grid gap-1.5">
        {stats.nextWeekSuggestions.map((suggestion) => (
          <p key={suggestion} className="rounded-lg bg-[#F2F2F7] px-2.5 py-2 text-xs font-bold leading-relaxed text-[#1C1C1E]">
            {suggestion}
          </p>
        ))}
        {stats.warnings.slice(0, 2).map((warning) => (
          <p key={warning} className="rounded-lg bg-[#FFF2F2] px-2.5 py-2 text-xs font-bold leading-relaxed text-[#C92A2A]">
            {warning}
          </p>
        ))}
      </div>
    </section>
  );
}

function PerformanceCompactList({
  performances,
  locale,
  labels,
}: {
  performances: ExercisePerformance[];
  locale: Locale;
  labels: {
    noPerformance: string;
    recentVolume: string;
    estimatedOneRm: string;
  };
}) {
  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '운동 성과 Top 5' : 'Top exercise signals'}</h2>
        <span className="text-[11px] font-bold text-[#8E8E93]">{locale === 'ko' ? '최근 볼륨순' : 'recent volume'}</span>
      </div>
      <div className="mt-2 grid gap-2">
        {performances.length === 0 ? (
          <p className="py-4 text-center text-xs font-bold text-[#8E8E93]">{labels.noPerformance}</p>
        ) : performances.slice(0, 5).map((performance, index) => (
          <div key={performance.id} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2 rounded-lg bg-[#F2F2F7] px-2.5 py-2">
            <span className="text-center text-xs font-black text-[#8E8E93]">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[#1C1C1E]">{performance.name}</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#6E6E73]">
                {labels.recentVolume} {formatKg(performance.recentVolumeKg)} · {labels.estimatedOneRm} {performance.estimatedOneRmKg.toFixed(1)}kg
              </p>
            </div>
            <span className={`text-xs font-black ${signedTone(performance.fourWeekChangePct)}`}>{formatPct(performance.fourWeekChangePct)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniBarChart({ weeks, metric }: { weeks: WeekStat[]; metric: 'sets' | 'workoutDays' }) {
  const maxValue = Math.max(1, ...weeks.map((week) => week[metric]));
  return (
    <div className="mt-3 flex h-28 items-end gap-1.5 px-1">
      {weeks.map((week) => (
        <div key={week.key} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-[11px] font-bold text-[#1C1C1E]">{week[metric]}</span>
          <div
            className="w-full rounded-t-lg bg-[#2EC4B6]"
            style={{ height: `${Math.max(8, (week[metric] / maxValue) * 72)}px` }}
            aria-label={`${week.label} ${week[metric]}`}
          />
          <span className="text-[10px] font-semibold text-[#8E8E93]">{week.label}</span>
        </div>
      ))}
    </div>
  );
}

function MiniLineChart({ weeks, locale, peakLabel }: { weeks: WeekStat[]; locale: Locale; peakLabel: string }) {
  const plottedPoints = useMemo(() => {
    const maxValue = Math.max(1, ...weeks.map((week) => week.volumeKg));
    return weeks.map((week, index) => {
      const x = weeks.length === 1 ? 0 : (index / (weeks.length - 1)) * 100;
      const y = 100 - (week.volumeKg / maxValue) * 82 - 10;
      return { x, y, value: week.volumeKg, label: week.label };
    });
  }, [weeks]);
  const points = plottedPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const latest = weeks[weeks.length - 1];
  const peak = weeks.slice().sort((a, b) => b.volumeKg - a.volumeKg)[0];

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-[#1C1C1E]">
        <span>{latest ? `${latest.label}: ${Math.round(latest.volumeKg).toLocaleString()}kg` : '0kg'}</span>
        <span className="text-[#159A91] font-bold">{peak ? `${peakLabel} ${peak.label}: ${Math.round(peak.volumeKg).toLocaleString()}kg` : ''}</span>
      </div>
      <div className="relative rounded-xl border border-black/5 bg-[#F2F2F7] p-2">
        <svg viewBox="0 0 100 100" className="h-32 w-full overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2EC4B6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="95" x2="100" y2="95" stroke="#E5E5EA" strokeWidth="1" />
          
          {/* Area fill under curve */}
          {plottedPoints.length > 0 && (
            <polygon
              points={`0,95 ${points} 100,95`}
              fill="url(#chartGradient)"
            />
          )}
          
          <polyline points={points} fill="none" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {plottedPoints.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r="2.5" fill="#2EC4B6" stroke="#FFFFFF" strokeWidth="1" />
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-8 text-center text-[10px] font-semibold text-[#8E8E93]">
        {weeks.map((week) => <span key={week.key}>{week.label}</span>)}
      </div>
    </div>
  );
}

function DailyTrendChart({ days, locale }: { days: DailyTrendStat[]; locale: Locale }) {
  const maxStrength = Math.max(1, ...days.map((day) => day.strengthVolumeKg));
  const maxCardio = Math.max(1, ...days.map((day) => day.cardioDistanceKm));
  const activeDays = days.filter((day) => day.strengthVolumeKg > 0 || day.cardioDistanceKm > 0);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex h-32 items-end gap-1 rounded-xl border border-black/5 bg-[#F2F2F7] px-2 pb-2 pt-3">
        {days.map((day) => {
          const strengthHeight = day.strengthVolumeKg > 0 ? Math.max(6, (day.strengthVolumeKg / maxStrength) * 76) : 0;
          const cardioHeight = day.cardioDistanceKm > 0 ? Math.max(6, (day.cardioDistanceKm / maxCardio) * 44) : 0;

          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full flex-col justify-end gap-0.5">
                {cardioHeight > 0 ? (
                  <div
                    className="w-full rounded-t bg-[#007AFF]"
                    style={{ height: `${cardioHeight}px` }}
                    aria-label={`${day.label} ${day.cardioDistanceKm.toFixed(1)}km`}
                  />
                ) : null}
                {strengthHeight > 0 ? (
                  <div
                    className="w-full rounded-t bg-[#34C759]"
                    style={{ height: `${strengthHeight}px` }}
                    aria-label={`${day.label} ${Math.round(day.strengthVolumeKg)}kg`}
                  />
                ) : null}
              </div>
              <span className="text-[9px] font-bold text-[#8E8E93]">{day.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 px-1 text-[11px] font-bold uppercase text-[#8E8E93]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34C759]" />{locale === 'ko' ? '근력 kg' : 'Strength kg'}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#007AFF]" />{locale === 'ko' ? '러닝 km' : 'Running km'}</span>
      </div>
      <div className="grid gap-1.5">
        {activeDays.length === 0 ? (
          <p className="rounded-xl border border-black/5 bg-[#F2F2F7] px-3 py-2 text-xs font-semibold text-[#8E8E93]">
            {locale === 'ko' ? '최근 2주간 기록된 운동이 없습니다.' : 'No workouts logged in the last two weeks.'}
          </p>
        ) : activeDays.slice(-7).map((day) => (
          <p key={day.date} className="rounded-xl border border-black/5 bg-[#F2F2F7] px-3 py-2 text-xs font-semibold leading-relaxed text-[#6E6E73]">
            <span className="font-bold text-[#1C1C1E]">{day.label}</span>{' '}
            {day.items.map((item) => (
              item.distanceKm > 0
                ? `${item.label} ${item.distanceKm.toFixed(1)}km`
                : `${item.label} ${Math.round(item.volumeKg).toLocaleString()}kg/${item.sets}${locale === 'ko' ? '세트' : ' sets'}`
            )).join(' · ')}
          </p>
        ))}
      </div>
    </div>
  );
}

function MiniSparkBars({ history }: { history: ExercisePerformance['oneRmHistory'] }) {
  const maxValue = Math.max(1, ...history.map((item) => item.valueKg));

  if (history.length === 0) return null;

  return (
    <div className="mt-3 flex h-16 items-end gap-1.5 px-0.5">
      {history.map((item) => (
        <div key={`${item.label}_${item.valueKg}`} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-[#1C1C1E]">{Math.round(item.valueKg)}</span>
          <div
            className="w-full rounded-t bg-accent"
            style={{ height: `${Math.max(6, (item.valueKg / maxValue) * 32)}px` }}
            aria-label={`${item.label} ${item.valueKg.toFixed(1)}kg`}
          />
          <span className="text-[10px] font-semibold text-[#8E8E93]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DetailSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group ios-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
        <div>
          <h2 className="text-sm font-black text-[#1C1C1E]">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-[#6E6E73]">{summary}</p>
        </div>
        <span className="shrink-0 text-lg font-black text-[#159A91] group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-[#E5E5EA] p-3.5 pt-3">{children}</div>
    </details>
  );
}

type StatsPageProps = {
  onOpenActuals?: () => void;
  recordModeControl?: ReactNode;
};

export function StatsPage({ onOpenActuals, recordModeControl }: StatsPageProps) {
  const [locale] = useState<Locale>(() => getStoredLocale());
  const [windowId, setWindowId] = useState<AnalysisWindowId>(() => loadAnalysisWindow());
  const [stats, setStats] = useState<StatsView>(() => buildEmptyStats(locale, analysisWindowDays(loadAnalysisWindow())));

  const c = useMemo(() => ({
    title: t(locale, 'statsTitle'),
    emptyTitle: t(locale, 'statsEmptyTitle'),
    emptyBody: t(locale, 'statsEmptyBody'),
    workoutDays: t(locale, 'statsWorkoutDays'),
    totalVolume: t(locale, 'statsTotalVolume'),
    totalSets: t(locale, 'statsTotalSets'),
    recentTrend: t(locale, 'statsRecentTrend'),
    dailyTrend: t(locale, 'statsDailyTrend'),
    muscleAnalysis: t(locale, 'statsMuscleAnalysis'),
    performance: t(locale, 'statsPerformance'),
    recoveryWarnings: t(locale, 'statsRecoveryWarnings'),
    noWarnings: t(locale, 'statsNoWarnings'),
    automaticAnalysis: t(locale, 'statsAutomaticAnalysis'),
    hardSets: t(locale, 'statsHardSets'),
    hardSetRatio: t(locale, 'statsHardSetRatio'),
    peak: t(locale, 'statsPeak'),
    weeklyTarget: t(locale, 'statsWeeklyTarget'),
    trendSummary: t(locale, 'statsTrendSummary'),
    oneRmHistory: t(locale, 'statsOneRmHistory'),
    volume: t(locale, 'statsVolume'),
    sets: t(locale, 'statsSets'),
    recommended: t(locale, 'statsRecommended'),
    perWeek: t(locale, 'statsPerWeek'),
    recentWeight: t(locale, 'statsRecentWeight'),
    bestWeight: t(locale, 'statsBestWeight'),
    recentVolume: t(locale, 'statsRecentVolume'),
    bestVolume: t(locale, 'statsBestVolume'),
    estimatedOneRm: t(locale, 'statsEstimatedOneRm'),
    noPerformance: t(locale, 'statsNoPerformance'),
    emptyAnalysis: t(locale, 'statsEmptyAnalysis'),
  }), [locale]);

  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    const promptText = buildAiPrompt(stats, locale);
    navigator.clipboard.writeText(promptText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  useEffect(() => {
    async function loadStats() {
      const [sessions, workoutExercises, workoutSets, exercises, cardioRecords] = await Promise.all([
        db.workoutSessions.toArray(),
        db.workoutExercises.toArray(),
        db.workoutSets.toArray(),
        db.exercises.toArray(),
        db.cardioRecords.toArray(),
      ]);

      setStats(buildStats(sessions, workoutExercises, workoutSets, exercises, locale, cardioRecords, analysisWindowDays(windowId)));
    }

    void loadStats();
  }, [locale, windowId]);

  const handleWindowChange = (next: AnalysisWindowId) => {
    setWindowId(next);
    saveAnalysisWindow(next);
  };

  const windowOptions = analysisWindows.map((window) => ({
    value: window.id,
    label: t(locale, window.id === 'p7' ? 'statsWindow7' : window.id === 'p28' ? 'statsWindow28' : 'statsWindow84'),
  }));

  const hasData = stats.totalSets > 0
    || stats.workoutDays > 0
    || stats.performances.length > 0
    || stats.dailyTrend.some((day) => day.strengthVolumeKg > 0 || day.cardioDistanceKm > 0)
    || stats.weeks.some((week) => week.volumeKg > 0 || week.sets > 0 || week.workoutDays > 0);
  const activeMuscleCount = stats.muscleStats.filter((muscle) => muscle.sets > 0).length;

  return (
    <section className="ios-page">
      <header className="shrink-0 space-y-2 px-0.5 pb-1 pt-1">
        <IOSPageHeader
          eyebrow={t(locale, 'insights')}
          title={c.title}
          action={!recordModeControl && onOpenActuals ? (
            <button
              type="button"
              onClick={onOpenActuals}
              className="ios-button-secondary flex min-h-9 items-center gap-1.5 px-2.5 text-xs"
            >
              <CalendarRange aria-hidden="true" size={14} />
              <span>{t(locale, 'actualsCalendar')}</span>
            </button>
          ) : null}
        />
        {recordModeControl}
        <IOSSegmentedControl value={windowId} options={windowOptions} onChange={handleWindowChange} />
      </header>

      {!hasData ? (
        <div className="inner-scroll min-h-0 w-full flex flex-col items-center justify-center p-2">
          <section className="flex w-full flex-col items-center space-y-3 ios-card p-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F3F3] text-accent-dark">
              <BarChart3 aria-hidden="true" size={24} />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-black text-[#1C1C1E] tracking-wide">{c.emptyTitle}</h2>
              <p className="text-xs leading-relaxed text-[#6E6E73] font-semibold max-w-xs">{c.emptyBody}</p>
            </div>
          </section>
        </div>
      ) : (
        <div className="inner-scroll min-h-0 space-y-2 pr-0.5">
          <ReadinessPanel stats={stats} locale={locale} />
          <RecoveryBodyMap recovery={stats.recovery} locale={locale} />
          <RecoveryDashboardPanel recovery={stats.recovery} locale={locale} />

          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#8E8E93]">
            {tf(locale, 'statsWindowRange', { days: stats.windowDays })}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label={c.totalSets}
              value={`${stats.totalSets}`}
              icon={<Dumbbell aria-hidden="true" size={15} />}
            />
            <StatTile
              label={c.hardSets}
              value={`${stats.hardSets}`}
              helper={`${stats.hardSetRatio.toFixed(0)}%`}
              icon={<Target aria-hidden="true" size={15} />}
              tone={stats.hardSetRatio > 70 ? 'text-[#FF9500]' : 'text-[#1C1C1E]'}
            />
            <StatTile
              label={t(locale, 'statsPeriodOverPeriod')}
              value={formatPct(stats.weekOverWeekPct)}
              icon={<TrendingUp aria-hidden="true" size={15} />}
              tone={signedTone(stats.weekOverWeekPct)}
            />
          </div>

          {stats.trendGranularity === 'daily' ? (
            <DailyLoadRail days={stats.dailyTrend} locale={locale} />
          ) : (
            <WeeklyLoadStrip weeks={stats.weeks.slice(-Math.round(stats.weeksInPeriod))} locale={locale} />
          )}
          <MuscleBalancePanel muscles={stats.muscleStats} locale={locale} />
          <ActionPanel stats={stats} locale={locale} />
          <PerformanceCompactList
            performances={stats.performances}
            locale={locale}
            labels={{
              noPerformance: c.noPerformance,
              recentVolume: c.recentVolume,
              estimatedOneRm: c.estimatedOneRm,
            }}
          />

          <p className="px-1 pt-1 text-xs font-black uppercase tracking-wide text-[#8E8E93]">
            {locale === 'ko' ? '상세 분석' : 'Details'}
          </p>

          <DetailSection
            title={locale === 'ko' ? '추이 상세' : 'Trend details'}
            summary={locale === 'ko' ? '세트와 운동일수 차트' : 'Sets and workout-day charts'}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#1C1C1E]">{c.totalSets}</p>
                <MiniBarChart weeks={stats.weeks} metric="sets" />
              </div>
              <div className="border-t border-[#E5E5EA] pt-4">
                <p className="text-xs font-bold uppercase text-[#1C1C1E]">{c.workoutDays}</p>
                <MiniBarChart weeks={stats.weeks} metric="workoutDays" />
              </div>
            </div>
          </DetailSection>

          <DetailSection
            title={c.muscleAnalysis}
            summary={locale === 'ko' ? `${activeMuscleCount}개 부위 기록 / 총 ${stats.muscleStats.length}개 부위` : `${activeMuscleCount} active of ${stats.muscleStats.length} groups`}
          >
            <div className="grid gap-2.5">
              {stats.muscleStats.map((muscle) => (
                <div key={muscle.group} className="space-y-2.5 rounded-2xl border border-black/5 bg-[#F2F2F7] p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#1C1C1E] tracking-wide">{muscleLabels[locale][muscle.group]}</p>
                    <Badge status={muscle.status} locale={locale} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-black/5 bg-white py-1.5 text-center">
                    <div>
                      <p className="text-[11px] font-bold text-[#6E6E73] uppercase">{c.volume}</p>
                      <p className="mt-0.5 text-xs font-black text-[#1C1C1E]">{Math.round(muscle.volumeKg).toLocaleString()}kg</p>
                    </div>
                    <div className="border-x border-[#E5E5EA]">
                      <p className="text-[11px] font-bold text-[#6E6E73] uppercase">{c.sets}</p>
                      <p className="mt-0.5 text-xs font-black text-[#1C1C1E]">{muscle.sets}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#6E6E73] uppercase">{c.hardSets}</p>
                      <p className="mt-0.5 text-xs font-black text-[#1C1C1E]">{muscle.hardSets}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#6E6E73]">
                      <span>{c.weeklyTarget}</span>
                      <span className="font-black text-[#1C1C1E]">{muscle.setsPerWeek} / {muscle.recommendedMax} {c.perWeek}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E5E5EA]">
                      <div
                        className={`h-full rounded-full ${
                          muscle.status === 'high' ? 'bg-[#FF3B30]' : muscle.status === 'normal' ? 'bg-[#34C759]' : 'bg-[#FF9500]'
                        }`}
                        style={{ width: `${muscle.targetPct}%` }}
                      />
                    </div>
                    <p className="text-xs font-bold text-[#6E6E73]">
                      {muscle.deficitSets > 0
                        ? tf(locale, 'statsBelowMinimum', { sets: muscle.deficitSets })
                        : muscle.excessSets > 0
                          ? tf(locale, 'statsAboveTarget', { sets: muscle.excessSets })
                          : t(locale, 'statsWithinTargetRange')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title={c.performance}
            summary={locale === 'ko' ? `${stats.performances.length}개 운동 기록` : `${stats.performances.length} tracked exercises`}
          >
            <div className="grid gap-2.5">
              {stats.performances.length === 0 ? (
                <p className="py-4 text-center text-xs font-bold text-[#8E8E93]">{c.noPerformance}</p>
              ) : stats.performances.map((performance) => (
                <div key={performance.id} className="space-y-2.5 rounded-2xl border border-black/5 bg-[#F2F2F7] p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-[#1C1C1E] tracking-wide">{performance.name}</h3>
                    <span className="rounded-lg border border-black/5 bg-white px-2 py-0.5 text-xs font-bold text-[#159A91]">{formatPct(performance.fourWeekChangePct)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-black/5 bg-white px-3 py-2.5 text-xs font-semibold text-[#6E6E73]">
                    <p>{c.recentWeight} <span className="font-bold text-[#1C1C1E]">{performance.recentWeightKg.toFixed(1)}kg</span></p>
                    <p>{c.bestWeight} <span className="font-bold text-[#1C1C1E]">{performance.bestWeightKg.toFixed(1)}kg</span></p>
                    <p>{c.recentVolume} <span className="font-bold text-[#1C1C1E]">{Math.round(performance.recentVolumeKg).toLocaleString()}kg</span></p>
                    <p>{c.bestVolume} <span className="font-bold text-[#1C1C1E]">{Math.round(performance.bestVolumeKg).toLocaleString()}kg</span></p>
                    <p className="col-span-2 border-t border-[#E5E5EA] pt-2 mt-0.5">{c.estimatedOneRm} <span className="font-bold text-[#159A91]">{performance.estimatedOneRmKg.toFixed(1)}kg</span></p>
                  </div>
                  {performance.chartHistory && performance.chartHistory.length > 0 ? (
                    <div className="border-t border-[#E5E5EA] pt-3">
                      <p className="text-xs font-bold uppercase text-[#8E8E93] mb-1.5">{locale === 'ko' ? '성과 추이 (1RM & 볼륨)' : 'Performance Trend (1RM & Vol)'}</p>
                      <StaticLineChart data={performance.chartHistory} locale={locale} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title={c.automaticAnalysis}
            summary={locale === 'ko' ? '\uBD84\uC11D \uB0B4\uC6A9\uACFC AI \uD504\uB86C\uD504\uD2B8' : 'Analysis and AI prompt'}
          >
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className={`w-full rounded-xl px-3 py-2.5 text-xs font-bold uppercase transition-all ${
                  copied
                    ? 'bg-[#34C759]/10 text-[#34C759] border border-transparent shadow-sm'
                    : 'ios-button-secondary text-xs min-h-9'
                }`}
              >
                {copied ? t(locale, 'copied') : t(locale, 'statsCopyAiPrompt')}
              </button>
              <div className="rounded-xl border border-black/5 bg-[#F2F2F7] p-4">
                <p className="text-xs font-semibold leading-relaxed text-[#6E6E73]">{stats.analysisComment}</p>
              </div>
              {copied ? <p className="text-center text-xs font-bold text-[#34C759]">{t(locale, 'statsAiPromptCopied')}</p> : null}
            </div>
          </DetailSection>

        </div>
      )}
    </section>
  );
}
