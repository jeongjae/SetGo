import { AlertTriangle, BarChart3, ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { getExerciseCategories, getExerciseName, isWarmupOnlyExercise } from '../domain/exercises';
import { getStoredLocale, t } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';
import type { ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

type StatsPageProps = {
  onBack: () => void;
};

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

type StatsView = {
  workoutDays: number;
  totalVolumeKg: number;
  totalSets: number;
  hardSets: number;
  weekOverWeekPct?: number;
  hardSetRatio: number;
  weeks: WeekStat[];
  muscleStats: MuscleStat[];
  performances: ExercisePerformance[];
  warnings: string[];
  analysisComment: string;
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
  };
}

export function buildStats(
  sessions: WorkoutSession[],
  workoutExercises: WorkoutExercise[],
  workoutSets: WorkoutSet[],
  exercises: ExerciseMaster[],
  locale: Locale,
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

  const warnings: string[] = [];
  const completedDates = Array.from(new Set(completedSessions.map((session) => session.date))).sort();
  let streak = 0;
  for (let cursor = new Date(today); cursor >= addDays(today, -14); cursor = addDays(cursor, -1)) {
    if (completedDates.includes(formatDateKey(cursor))) streak += 1;
    else if (streak > 0) break;
  }
  if (streak >= 4) {
    warnings.push(locale === 'ko'
      ? `연속 운동일이 ${streak}일입니다. 하루 회복일을 고려하세요.`
      : `You have trained ${streak} days in a row. Consider a recovery day.`);
  }

  const muscleHistory: Array<{ group: MuscleGroup; date: Date }> = [];
  completedWorkoutExercises.forEach((workoutExercise) => {
    const session = sessionById.get(workoutExercise.sessionId);
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    if (!session || !exercise) return;
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
      warnings.push(locale === 'ko'
        ? `${muscleLabels.ko[group]} 부위가 48시간 미만 간격으로 반복되었습니다.`
        : `${muscleLabels.en[group]} was repeated within 48 hours.`);
    }
  });

  const weekChange = pctChange(totalVolumeKg, previousWeekVolumeKg);
  if (weekChange !== undefined && weekChange >= 25) {
    warnings.push(locale === 'ko'
      ? `주간 볼륨이 전주 대비 ${weekChange.toFixed(0)}% 증가했습니다.`
      : `Weekly volume increased ${weekChange.toFixed(0)}% versus last week.`);
  }
  const hardSetRatio = currentWeekTrainingSets.length > 0 ? (hardSets / currentWeekTrainingSets.length) * 100 : 0;
  if (hardSetRatio > 70) {
    warnings.push(locale === 'ko'
      ? `Hard Set 비율이 ${hardSetRatio.toFixed(0)}%입니다. 피로 누적을 확인하세요.`
      : `Hard sets are ${hardSetRatio.toFixed(0)}% of sets. Watch accumulated fatigue.`);
  }

  const lowMuscles = muscleStats.filter((stat) => stat.status === 'low').map((stat) => muscleLabels[locale][stat.group]);
  const highMuscles = muscleStats.filter((stat) => stat.status === 'high' || stat.status === 'caution').map((stat) => muscleLabels[locale][stat.group]);
  const fourWeekAverageVolume = weekStats.slice(-4).reduce((sum, week) => sum + week.volumeKg, 0) / 4;
  const currentWeekVolumeVsAverage = pctChange(totalVolumeKg, fourWeekAverageVolume);
  const analysisComment = locale === 'ko'
    ? [
      `이번 주는 ${currentWeekSessions.length}일 운동했고 총 ${Math.round(totalVolumeKg).toLocaleString()}kg, ${currentWeekSets.length}세트를 기록했습니다.`,
      currentWeekVolumeVsAverage !== undefined ? `최근 4주 평균 대비 볼륨은 ${formatPct(currentWeekVolumeVsAverage)}입니다.` : '최근 4주 평균 비교는 기록이 더 쌓이면 표시됩니다.',
      `Hard Set 비율은 ${hardSetRatio.toFixed(0)}%입니다.`,
      lowMuscles.length > 0 ? `부족한 근육군은 ${lowMuscles.slice(0, 3).join(', ')}입니다.` : '주요 근육군 세트 수는 대체로 권장 범위 안에 있습니다.',
      highMuscles.length > 0 ? `${highMuscles.slice(0, 3).join(', ')}는 부하를 점검하세요.` : '과도한 부하 신호는 크지 않습니다.',
      warnings.length > 0 ? '다음 주에는 경고 항목을 우선 줄이는 방향으로 계획하세요.' : '다음 주에는 부족한 부위에 2-4세트를 추가하는 정도가 적절합니다.',
    ].join(' ')
    : [
      `This week has ${currentWeekSessions.length} workout days, ${Math.round(totalVolumeKg).toLocaleString()}kg total volume, and ${currentWeekSets.length} sets.`,
      currentWeekVolumeVsAverage !== undefined ? `Volume is ${formatPct(currentWeekVolumeVsAverage)} versus the recent 4-week average.` : 'The 4-week average comparison will appear after more history accumulates.',
      `Hard-set ratio is ${hardSetRatio.toFixed(0)}%.`,
      lowMuscles.length > 0 ? `Under-trained groups: ${lowMuscles.slice(0, 3).join(', ')}.` : 'Major muscle groups are mostly within the recommended range.',
      highMuscles.length > 0 ? `Review load for ${highMuscles.slice(0, 3).join(', ')}.` : 'No major overload signal is present.',
      warnings.length > 0 ? 'Next week, prioritize reducing the warning items.' : 'Next week, adding 2-4 sets to lagging areas looks reasonable.',
    ].join(' ');

  return {
    workoutDays: currentWeekSessions.length,
    totalVolumeKg,
    totalSets: currentWeekSets.length,
    hardSets,
    weekOverWeekPct: weekChange,
    hardSetRatio,
    weeks: weekStats,
    muscleStats,
    performances,
    warnings,
    analysisComment,
  };
}

function Badge({ status, locale }: { status: LoadStatus; locale: Locale }) {
  const labels = {
    ko: { low: '부족', normal: '적정', high: '과다', caution: '주의' },
    en: { low: 'Low', normal: 'Good', high: 'High', caution: 'Caution' },
  };
  const className = status === 'normal'
    ? 'bg-emerald-400/15 text-emerald-300'
    : status === 'high'
    ? 'bg-red-400/15 text-red-300'
    : 'bg-amber-400/15 text-amber-300';

  return <span className={`rounded px-2 py-1 text-xs font-bold ${className}`}>{labels[locale][status]}</span>;
}

function MiniBarChart({ weeks, metric }: { weeks: WeekStat[]; metric: 'sets' | 'workoutDays' }) {
  const maxValue = Math.max(1, ...weeks.map((week) => week[metric]));
  return (
    <div className="mt-4 flex h-28 items-end gap-2">
      {weeks.map((week) => (
        <div key={week.key} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-300">{week[metric]}</span>
          <div
            className="w-full rounded-t bg-cyan-400"
            style={{ height: `${Math.max(8, (week[metric] / maxValue) * 76)}px` }}
            aria-label={`${week.label} ${week[metric]}`}
          />
          <span className="text-[10px] text-slate-500">{week.label}</span>
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
      const y = 100 - (week.volumeKg / maxValue) * 88 - 6;
      return { x, y, value: week.volumeKg, label: week.label };
    });
  }, [weeks]);
  const points = plottedPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const latest = weeks[weeks.length - 1];
  const peak = weeks.slice().sort((a, b) => b.volumeKg - a.volumeKg)[0];

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{latest ? `${latest.label}: ${Math.round(latest.volumeKg).toLocaleString()}kg` : '0kg'}</span>
        <span>{peak ? `${peakLabel} ${peak.label}: ${Math.round(peak.volumeKg).toLocaleString()}kg` : ''}</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-32 w-full overflow-visible">
        <line x1="0" y1="94" x2="100" y2="94" stroke="#334155" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {plottedPoints.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="2" fill="#67e8f9" />
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-8 text-center text-[10px] text-slate-500">
        {weeks.map((week) => <span key={week.key}>{week.label}</span>)}
      </div>
    </div>
  );
}

function MiniSparkBars({ history }: { history: ExercisePerformance['oneRmHistory'] }) {
  const maxValue = Math.max(1, ...history.map((item) => item.valueKg));

  if (history.length === 0) return null;

  return (
    <div className="mt-3 flex h-16 items-end gap-2">
      {history.map((item) => (
        <div key={`${item.label}_${item.valueKg}`} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-emerald-300"
            style={{ height: `${Math.max(8, (item.valueKg / maxValue) * 44)}px` }}
            aria-label={`${item.label} ${item.valueKg.toFixed(1)}kg`}
          />
          <span className="text-[10px] text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsPage({ onBack }: StatsPageProps) {
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
      const [sessions, workoutExercises, workoutSets, exercises] = await Promise.all([
        db.workoutSessions.toArray(),
        db.workoutExercises.toArray(),
        db.workoutSets.toArray(),
        db.exercises.toArray(),
      ]);

      setStats(buildStats(sessions, workoutExercises, workoutSets, exercises, locale));
    }

    void loadStats();
  }, [locale]);

  const hasData = stats.totalSets > 0
    || stats.workoutDays > 0
    || stats.performances.length > 0
    || stats.weeks.some((week) => week.volumeKg > 0 || week.sets > 0 || week.workoutDays > 0);
  const latestWeek = stats.weeks[stats.weeks.length - 1];
  const previousWeek = stats.weeks[stats.weeks.length - 2];
  const latestWeekVolumeChange = latestWeek && previousWeek
    ? pctChange(latestWeek.volumeKg, previousWeek.volumeKg)
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
          <p className="text-sm font-medium text-cyan-300">{t(locale, 'stats')}</p>
          <h1 className="text-2xl font-bold text-white">{c.title}</h1>
        </div>
      </header>

      {!hasData ? (
        <section className="rounded-lg bg-slate-900 p-5 shadow">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-800 text-cyan-300">
            <BarChart3 aria-hidden="true" size={24} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">{c.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{c.emptyBody}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        {[
          [c.workoutDays, locale === 'ko' ? `${stats.workoutDays}일` : `${stats.workoutDays}d`],
          [c.totalVolume, `${Math.round(stats.totalVolumeKg).toLocaleString()}kg`],
          [c.totalSets, `${stats.totalSets}`],
          [c.hardSets, `${stats.hardSets}`],
          [c.hardSetRatio, `${stats.hardSetRatio.toFixed(0)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-900 p-4 shadow">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
        <div className="rounded-lg bg-slate-900 p-4 shadow">
          <p className="text-xs font-semibold uppercase text-slate-500">{c.weekOverWeek}</p>
          <p className={`mt-2 text-3xl font-bold ${stats.weekOverWeekPct !== undefined && stats.weekOverWeekPct >= 25 ? 'text-amber-300' : 'text-white'}`}>
            {formatPct(stats.weekOverWeekPct)}
          </p>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{c.recentTrend}</h2>
        <p className="mt-4 text-sm font-semibold text-slate-300">{c.totalVolume}</p>
        <MiniLineChart weeks={stats.weeks} locale={locale} peakLabel={c.peak} />
        <p className="mt-5 text-sm font-semibold text-slate-300">{c.totalSets}</p>
        <MiniBarChart weeks={stats.weeks} metric="sets" />
        <p className="mt-5 text-sm font-semibold text-slate-300">{c.workoutDays}</p>
        <MiniBarChart weeks={stats.weeks} metric="workoutDays" />
        {latestWeek ? (
          <div className="mt-5 rounded-md bg-slate-800 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{c.trendSummary}</p>
            <p className="mt-1 text-sm leading-6 text-slate-200">
              {locale === 'ko'
                ? `${latestWeek.label} 주간은 ${latestWeek.workoutDays}일 운동, ${latestWeek.sets}세트, ${Math.round(latestWeek.volumeKg).toLocaleString()}kg입니다. 전주 대비 ${formatPct(latestWeekVolumeChange)}.`
                : `${latestWeek.label} has ${latestWeek.workoutDays} workout days, ${latestWeek.sets} sets, and ${Math.round(latestWeek.volumeKg).toLocaleString()}kg. Week-over-week: ${formatPct(latestWeekVolumeChange)}.`}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{c.muscleAnalysis}</h2>
        <div className="mt-4 grid gap-3">
          {stats.muscleStats.map((muscle) => (
            <div key={muscle.group} className="rounded-md bg-slate-800 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-white">{muscleLabels[locale][muscle.group]}</p>
                <Badge status={muscle.status} locale={locale} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-slate-500">{c.volume}</p><p className="font-bold text-white">{Math.round(muscle.volumeKg).toLocaleString()}kg</p></div>
                <div><p className="text-slate-500">{c.sets}</p><p className="font-bold text-white">{muscle.sets}</p></div>
                <div><p className="text-slate-500">{c.hardSets}</p><p className="font-bold text-white">{muscle.hardSets}</p></div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">{c.weeklyTarget}</span>
                  <span className="text-slate-300">
                    {muscle.sets}/{muscle.recommendedMax}{c.perWeek}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={`h-full rounded-full ${
                      muscle.status === 'high' ? 'bg-red-300' : muscle.status === 'normal' ? 'bg-emerald-300' : 'bg-amber-300'
                    }`}
                    style={{ width: `${muscle.targetPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {muscle.deficitSets > 0
                    ? locale === 'ko' ? `최소 목표까지 ${muscle.deficitSets}세트 부족` : `${muscle.deficitSets} sets below minimum`
                    : muscle.excessSets > 0
                      ? locale === 'ko' ? `권장 상한보다 ${muscle.excessSets}세트 많음` : `${muscle.excessSets} sets above target`
                      : locale === 'ko' ? '권장 범위 안에 있습니다' : 'Within target range'}
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-400">{c.recommended} {muscle.recommendedMin}-{muscle.recommendedMax}{c.perWeek}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{c.performance}</h2>
        <div className="mt-4 grid gap-3">
          {stats.performances.length === 0 ? (
            <p className="text-sm text-slate-300">{c.noPerformance}</p>
          ) : stats.performances.map((performance) => (
            <div key={performance.id} className="rounded-md bg-slate-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-white">{performance.name}</h3>
                <span className="text-xs font-bold text-cyan-300">{formatPct(performance.fourWeekChangePct)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <p className="text-slate-400">{c.recentWeight} <span className="font-bold text-white">{performance.recentWeightKg.toFixed(1)}kg</span></p>
                <p className="text-slate-400">{c.bestWeight} <span className="font-bold text-white">{performance.bestWeightKg.toFixed(1)}kg</span></p>
                <p className="text-slate-400">{c.recentVolume} <span className="font-bold text-white">{Math.round(performance.recentVolumeKg).toLocaleString()}kg</span></p>
                <p className="text-slate-400">{c.bestVolume} <span className="font-bold text-white">{Math.round(performance.bestVolumeKg).toLocaleString()}kg</span></p>
                <p className="col-span-2 text-slate-400">{c.estimatedOneRm} <span className="font-bold text-white">{performance.estimatedOneRmKg.toFixed(1)}kg</span></p>
              </div>
              {performance.oneRmHistory.length > 0 ? (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{c.oneRmHistory}</p>
                  <MiniSparkBars history={performance.oneRmHistory} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" size={18} className="text-amber-300" />
          <h2 className="text-lg font-bold text-white">{c.recoveryWarnings}</h2>
        </div>
        <div className="mt-4 grid gap-2">
          {stats.warnings.length === 0 ? (
            <p className="rounded-md bg-emerald-400/10 px-3 py-3 text-sm text-emerald-300">{c.noWarnings}</p>
          ) : stats.warnings.map((warning) => (
            <p key={warning} className="rounded-md bg-amber-400/10 px-3 py-3 text-sm leading-6 text-amber-200">{warning}</p>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-cyan-300">{c.automaticAnalysis}</p>
          {hasData && (
            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {copied ? t(locale, 'copied') : t(locale, 'statsCopyAiPrompt')}
            </button>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">{stats.analysisComment}</p>
        {copied && (
          <p className="mt-2 text-[11px] leading-4 text-emerald-300 animate-pulse">
            {t(locale, 'statsAiPromptCopied')}
          </p>
        )}
      </section>
    </section>
  );
}
