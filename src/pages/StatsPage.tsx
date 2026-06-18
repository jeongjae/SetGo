import { AlertTriangle, BarChart3, CalendarRange } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { getExerciseCategories, getExerciseName, isWarmupOnlyExercise } from '../domain/exercises';
import { getStoredLocale, t, tf } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

type Locale = 'ko' | 'en';
type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulder' | 'biceps' | 'triceps' | 'core';
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

function startOfWeek(date: Date): Date {
  const copyDate = new Date(date);
  copyDate.setHours(0, 0, 0, 0);
  const day = copyDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copyDate.setDate(copyDate.getDate() + mondayOffset);
  return copyDate;
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
  return set.isCompleted && !isWarmup && !isWarmupOnlyExercise(exercise) && set.rir !== undefined && set.rir <= 3;
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

function decorateMuscleStat(stat: Omit<MuscleStat, 'status' | 'targetPct' | 'deficitSets' | 'excessSets'>): MuscleStat {
  return {
    ...stat,
    status: statusForSets(stat.sets, stat.recommendedMin, stat.recommendedMax),
    targetPct: Math.min(100, Math.round((stat.sets / Math.max(1, stat.recommendedMax)) * 100)),
    deficitSets: Math.max(0, stat.recommendedMin - stat.sets),
    excessSets: Math.max(0, stat.sets - stat.recommendedMax),
  };
}

export function buildEmptyStats(locale: Locale): StatsView {
  return {
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
      hardSets: 0,
      recommendedMin: recommendedSets[group].min,
      recommendedMax: recommendedSets[group].max,
      status: 'low',
      targetPct: 0,
      deficitSets: recommendedSets[group].min,
      excessSets: 0,
    })),
    performances: [],
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
): StatsView {
  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const previousWeekStart = addDays(thisWeekStart, -7);
  const eightWeekStart = addDays(thisWeekStart, -49);
  const fourWeekStartKey = formatDateKey(addDays(today, -27));
  const previousFourWeekStartKey = formatDateKey(addDays(today, -55));
  const previousFourWeekEndKey = formatDateKey(addDays(today, -28));

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
  const currentWeekSessions = completedSessions.filter((session) => session.date >= formatDateKey(thisWeekStart));
  const currentWeekSessionIds = new Set(currentWeekSessions.map((session) => session.id));
  const previousWeekSessionIds = new Set(
    completedSessions
      .filter((session) => session.date >= formatDateKey(previousWeekStart) && session.date < formatDateKey(thisWeekStart))
      .map((session) => session.id),
  );

  const weekStats = Array.from({ length: 8 }, (_, index): WeekStat => {
    const start = addDays(eightWeekStart, index * 7);
    const end = addDays(start, 6);
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

  const currentWeekSets = setsForSessionIds(currentWeekSessionIds);
  const previousWeekSets = setsForSessionIds(previousWeekSessionIds);
  const totalVolumeKg = currentWeekSets.reduce((sum, set) => sum + setVolume(set), 0);
  const previousWeekVolumeKg = previousWeekSets.reduce((sum, set) => sum + setVolume(set), 0);
  const isWarmupSetForStats = (set: WorkoutSet) => {
    const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
    const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
    const isWarmup = set.type ? set.type === 'warmup' : set.isWarmup;
    return Boolean(isWarmup) || isWarmupOnlyExercise(exercise);
  };
  const currentWeekTrainingSets = currentWeekSets.filter((set) => !isWarmupSetForStats(set));
  const hardSets = currentWeekSets.filter((set) => {
    const workoutExercise = workoutExerciseById.get(set.workoutExerciseId);
    const exercise = workoutExercise ? exerciseById.get(workoutExercise.exerciseId) : undefined;
    return exercise ? isHardSet(set, exercise) : false;
  }).length;

  const muscleMap = new Map<MuscleGroup, MuscleStat>(
    trackedMuscles.map((group) => [group, {
      group,
      volumeKg: 0,
      sets: 0,
      hardSets: 0,
      recommendedMin: recommendedSets[group].min,
      recommendedMax: recommendedSets[group].max,
      status: 'low',
      targetPct: 0,
      deficitSets: recommendedSets[group].min,
      excessSets: 0,
    }]),
  );

  completedWorkoutExercises
    .filter((item) => currentWeekSessionIds.has(item.sessionId))
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

  const muscleStats = Array.from(muscleMap.values()).map(decorateMuscleStat);

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
    const currentFourWeekVolume = items
      .filter((item) => (sessionById.get(item.sessionId)?.date ?? '') >= fourWeekStartKey)
      .flatMap((item) => setsByWorkoutExercise.get(item.id) ?? [])
      .reduce((sum, set) => sum + setVolume(set), 0);
    const previousFourWeekVolume = items
      .filter((item) => {
        const date = sessionById.get(item.sessionId)?.date ?? '';
        return date >= previousFourWeekStartKey && date <= previousFourWeekEndKey;
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
      fourWeekChangePct: pctChange(currentFourWeekVolume, previousFourWeekVolume),
      oneRmHistory,
    };
  }).sort((a, b) => b.recentVolumeKg - a.recentVolumeKg).slice(0, 12);

  const twoWeekStart = addDays(today, -13);
  const cardioBySessionId = cardioRecords.reduce<Map<string, CardioRecord[]>>((map, record) => {
    const list = map.get(record.sessionId) ?? [];
    list.push(record);
    map.set(record.sessionId, list);
    return map;
  }, new Map());
  const dailyTrend = Array.from({ length: 14 }, (_, index): DailyTrendStat => {
    const date = addDays(twoWeekStart, index);
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
    if (!session || !exercise || !currentWeekSessionIds.has(session.id)) return;
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

  const weekChange = pctChange(totalVolumeKg, previousWeekVolumeKg);
  if (weekChange !== undefined && weekChange >= 25) {
    warnings.push(tf(locale, 'statsWarningVolumeSpike', { change: weekChange.toFixed(0) }));
  }
  const hardSetRatio = currentWeekTrainingSets.length > 0 ? (hardSets / currentWeekTrainingSets.length) * 100 : 0;
  if (hardSetRatio > 70) {
    warnings.push(tf(locale, 'statsWarningHardSetRatio', { ratio: hardSetRatio.toFixed(0) }));
  }

  const lowMuscles = muscleStats.filter((stat) => stat.status === 'low').map((stat) => muscleLabels[locale][stat.group]);
  const highMuscles = muscleStats.filter((stat) => stat.status === 'high' || stat.status === 'caution').map((stat) => muscleLabels[locale][stat.group]);
  const fourWeekAverageVolume = weekStats.slice(-4).reduce((sum, week) => sum + week.volumeKg, 0) / 4;
  const currentWeekVolumeVsAverage = pctChange(totalVolumeKg, fourWeekAverageVolume);
  const analysisComment = [
    tf(locale, 'statsAnalysisWeekSummary', {
      days: currentWeekSessions.length,
      volume: Math.round(totalVolumeKg).toLocaleString(),
      sets: currentWeekSets.length,
    }),
    currentWeekVolumeVsAverage !== undefined
      ? tf(locale, 'statsAnalysisVolumeVsAverage', { change: formatPct(currentWeekVolumeVsAverage) })
      : t(locale, 'statsAnalysisVolumeAveragePending'),
    tf(locale, 'statsAnalysisHardSetRatio', { ratio: hardSetRatio.toFixed(0) }),
    lowMuscles.length > 0
      ? tf(locale, 'statsAnalysisLowMuscles', { muscles: lowMuscles.slice(0, 3).join(', ') })
      : t(locale, 'statsAnalysisMusclesInRange'),
    highMuscles.length > 0
      ? tf(locale, 'statsAnalysisHighMuscles', { muscles: highMuscles.slice(0, 3).join(', ') })
      : t(locale, 'statsAnalysisNoOverload'),
    warnings.length > 0 ? t(locale, 'statsAnalysisReduceWarnings') : t(locale, 'statsAnalysisAddSets'),
  ].join(' ');
  const nextWeekSuggestions = [
    warnings.length > 0 ? t(locale, 'statsNextWeekRecovery') : t(locale, 'statsNextWeekHoldVolume'),
    lowMuscles.length > 0 ? t(locale, 'statsNextWeekAddLagging') : undefined,
    highMuscles.length > 0 ? t(locale, 'statsNextWeekReduceHigh') : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    workoutDays: currentWeekSessions.length,
    totalVolumeKg,
    totalSets: currentWeekSets.length,
    hardSets,
    weekOverWeekPct: weekChange,
    hardSetRatio,
    weeks: weekStats,
    dailyTrend,
    muscleStats,
    performances,
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
            className="w-full rounded-t bg-gradient-to-t from-[#2EC4B6] to-[#159A91]"
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
  const [stats, setStats] = useState<StatsView>(() => buildEmptyStats(locale));
  
  const c = useMemo(() => ({
    title: t(locale, 'statsTitle'),
    emptyTitle: t(locale, 'statsEmptyTitle'),
    emptyBody: t(locale, 'statsEmptyBody'),
    workoutDays: t(locale, 'statsWorkoutDays'),
    totalVolume: t(locale, 'statsTotalVolume'),
    totalSets: t(locale, 'statsTotalSets'),
    weekOverWeek: t(locale, 'statsWeekOverWeek'),
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

      setStats(buildStats(sessions, workoutExercises, workoutSets, exercises, locale, cardioRecords));
    }

    void loadStats();
  }, [locale]);

  const hasData = stats.totalSets > 0
    || stats.workoutDays > 0
    || stats.performances.length > 0
    || stats.dailyTrend.some((day) => day.strengthVolumeKg > 0 || day.cardioDistanceKm > 0)
    || stats.weeks.some((week) => week.volumeKg > 0 || week.sets > 0 || week.workoutDays > 0);
  const latestWeek = stats.weeks[stats.weeks.length - 1];
  const previousWeek = stats.weeks[stats.weeks.length - 2];
  const latestWeekVolumeChange = latestWeek && previousWeek
    ? pctChange(latestWeek.volumeKg, previousWeek.volumeKg)
    : undefined;
  const activeMuscleCount = stats.muscleStats.filter((muscle) => muscle.sets > 0).length;
  const warningSummary = stats.warnings.length > 0
    ? (locale === 'ko' ? `${stats.warnings.length}개 확인 필요` : `${stats.warnings.length} items to review`)
    : c.noWarnings;

  return (
    <section className="viewport-locked ios-screen mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3">
      <header className="shrink-0 px-1 pb-1 pt-1">
        <div className="flex items-center justify-between gap-2.5 pb-2.5">
          <div>
            <p className="text-sm font-bold text-[#159A91]">{t(locale, 'records')}</p>
            <h1 className="text-[2rem] font-black leading-none text-[#1C1C1E]">{c.title}</h1>
          </div>
          {!recordModeControl && onOpenActuals ? (
            <button
              type="button"
              onClick={onOpenActuals}
              className="ios-button-secondary flex min-h-9 items-center gap-1.5 px-2.5 text-xs"
            >
              <CalendarRange aria-hidden="true" size={14} />
              <span>{t(locale, 'actualsCalendar')}</span>
            </button>
          ) : null}
        </div>
        {recordModeControl}
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
        <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
          <section className="ios-card p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">
                  {locale === 'ko' ? '이번 주 요약' : 'This Week'}
                </p>
                <h2 className="mt-0.5 text-base font-black text-[#1C1C1E]">
                  {tf(locale, 'statsWorkoutDaysValue', { days: stats.workoutDays })} / {Math.round(stats.totalVolumeKg).toLocaleString()}kg
                </h2>
              </div>
              <div className="rounded-xl px-3 py-2 text-right bg-[#F2F2F7] border border-black/5">
                <p className="text-[11px] font-bold text-[#6E6E73] uppercase">{c.weekOverWeek}</p>
                <p className="text-sm font-black text-[#1C1C1E]">{formatPct(stats.weekOverWeekPct)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                [c.totalSets, `${stats.totalSets}`],
                [c.hardSets, `${stats.hardSets}`],
                [c.hardSetRatio, `${stats.hardSetRatio.toFixed(0)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-black/5 bg-[#F2F2F7] px-2 py-2 text-center">
                  <p className="text-[11px] font-bold text-[#6E6E73] uppercase">{label}</p>
                  <p className="mt-1 text-base font-black text-[#1C1C1E]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ios-card p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#1C1C1E]">{c.dailyTrend}</h2>
              <span className="text-xs font-semibold text-[#8E8E93]">{locale === 'ko' ? '최근 2주' : 'Last 2 weeks'}</span>
            </div>
            <DailyTrendChart days={stats.dailyTrend} locale={locale} />
          </section>

          <section className="ios-card p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#1C1C1E]">{c.recentTrend}</h2>
              <span className="text-xs font-semibold text-[#8E8E93]">{locale === 'ko' ? '볼륨' : 'Volume'}</span>
            </div>
            <MiniLineChart weeks={stats.weeks} locale={locale} peakLabel={c.peak} />
            {latestWeek ? (
              <p className="rounded-xl bg-[#F2F2F7] px-3.5 py-3 text-xs font-medium leading-relaxed text-[#6E6E73]">
                {tf(locale, 'statsTrendSummaryText', {
                  week: latestWeek.label,
                  days: latestWeek.workoutDays,
                  sets: latestWeek.sets,
                  volume: Math.round(latestWeek.volumeKg).toLocaleString(),
                  change: formatPct(latestWeekVolumeChange),
                })}
              </p>
            ) : null}
          </section>

          <section className="ios-card p-3.5 space-y-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle aria-hidden="true" size={17} className={stats.warnings.length > 0 ? 'text-danger' : 'text-[#34C759]'} />
              <div>
                <h2 className="text-sm font-black text-[#1C1C1E]">{c.recoveryWarnings}</h2>
                <p className={`mt-0.5 text-xs font-bold ${stats.warnings.length > 0 ? 'text-danger' : 'text-[#34C759]'}`}>
                  {warningSummary}
                </p>
              </div>
            </div>
            {stats.warnings.length > 0 ? (
              <p className="mt-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-rose-600">
                {stats.warnings[0]}
              </p>
            ) : null}
            {stats.warnings.length > 1 ? (
              <details className="mt-2 rounded-xl border border-black/5 bg-[#F2F2F7] px-3 py-2">
                <summary className="cursor-pointer text-xs font-bold text-[#159A91]">
                  {locale === 'ko' ? '전체 경고 보기' : 'View all warnings'}
                </summary>
                <div className="mt-2 grid gap-2">
                  {stats.warnings.slice(1).map((warning) => (
                    <p key={warning} className="text-xs font-bold leading-relaxed text-rose-600">{warning}</p>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <section className="ios-card p-3.5 space-y-2.5">
            <h2 className="text-sm font-black text-[#1C1C1E]">{t(locale, 'statsNextWeekPlan')}</h2>
            <div className="grid gap-2">
              {stats.nextWeekSuggestions.map((suggestion) => (
                <p key={suggestion} className="rounded-xl border border-[#2EC4B6]/20 bg-[#2EC4B6]/5 px-3 py-2 text-xs font-bold leading-relaxed text-accent-dark">
                  {suggestion}
                </p>
              ))}
            </div>
          </section>

          <p className="px-1 pt-1 text-xs font-bold uppercase tracking-wide text-[#8E8E93]">
            {locale === 'ko' ? '세부 분석' : 'Details'}
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
                      <span className="font-black text-[#1C1C1E]">{muscle.sets} / {muscle.recommendedMax} {c.perWeek}</span>
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
                  {performance.oneRmHistory.length > 0 ? (
                    <div className="border-t border-[#E5E5EA] pt-3">
                      <p className="text-xs font-bold uppercase text-[#8E8E93]">{c.oneRmHistory}</p>
                      <MiniSparkBars history={performance.oneRmHistory} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title={c.automaticAnalysis}
            summary={locale === 'ko' ? '분석 내용과 AI 프롬프트' : 'Analysis and AI prompt'}
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
