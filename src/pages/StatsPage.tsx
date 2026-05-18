import { AlertTriangle, BarChart3, ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { getExerciseCategories, getExerciseName } from '../domain/exercises';
import { getStoredLocale, t } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';
import type { ExerciseCategory, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

type StatsPageProps = {
  onBack: () => void;
};

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
  aiComment: string;
};

const muscleLabels: Record<MuscleGroup, string> = {
  chest: '가슴',
  back: '등',
  legs: '하체',
  shoulder: '어깨',
  biceps: '이두',
  triceps: '삼두',
  core: '코어',
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

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
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
  const warmupOnly = exercise.stage === 'warmup' && !exercise.stageTags?.includes('main');
  return set.isCompleted && !warmupOnly && set.rir !== undefined && set.rir <= 3;
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

function buildEmptyStats(): StatsView {
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
    })),
    performances: [],
    warnings: [],
    aiComment: '운동 기록이 쌓이면 주간 부하와 다음 주 조정 제안을 표시합니다.',
  };
}

function buildStats(
  sessions: WorkoutSession[],
  workoutExercises: WorkoutExercise[],
  workoutSets: WorkoutSet[],
  exercises: ExerciseMaster[],
  locale: 'ko' | 'en',
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
    }]),
  );

  completedWorkoutExercises
    .filter((item) => currentWeekSessionIds.has(item.sessionId))
    .forEach((workoutExercise) => {
      const exercise = exerciseById.get(workoutExercise.exerciseId);
      if (!exercise) return;

      const groups = toMuscleGroups(exercise);
      const sets = (setsByWorkoutExercise.get(workoutExercise.id) ?? []).filter((set) => set.isCompleted);
      groups.forEach((group) => {
        const stat = muscleMap.get(group);
        if (!stat) return;
        stat.volumeKg += sets.reduce((sum, set) => sum + setVolume(set), 0);
        stat.sets += sets.length;
        stat.hardSets += sets.filter((set) => isHardSet(set, exercise)).length;
      });
    });

  const muscleStats = Array.from(muscleMap.values()).map((stat) => ({
    ...stat,
    status: statusForSets(stat.sets, stat.recommendedMin, stat.recommendedMax),
  }));

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
    };
  }).sort((a, b) => b.recentVolumeKg - a.recentVolumeKg).slice(0, 12);

  const warnings: string[] = [];
  const completedDates = Array.from(new Set(completedSessions.map((session) => session.date))).sort();
  let streak = 0;
  for (let cursor = new Date(today); cursor >= addDays(today, -14); cursor = addDays(cursor, -1)) {
    if (completedDates.includes(formatDateKey(cursor))) streak += 1;
    else if (streak > 0) break;
  }
  if (streak >= 4) warnings.push(`연속 운동일이 ${streak}일입니다. 하루 회복일을 고려하세요.`);

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
    if (hasShortGap) warnings.push(`${muscleLabels[group]} 부위가 48시간 미만 간격으로 반복되었습니다.`);
  });

  const weekChange = pctChange(totalVolumeKg, previousWeekVolumeKg);
  if (weekChange !== undefined && weekChange >= 25) warnings.push(`주간 볼륨이 전주 대비 ${weekChange.toFixed(0)}% 증가했습니다.`);
  const hardSetRatio = currentWeekSets.length > 0 ? (hardSets / currentWeekSets.length) * 100 : 0;
  if (hardSetRatio > 70) warnings.push(`Hard Set 비율이 ${hardSetRatio.toFixed(0)}%입니다. 피로 누적을 확인하세요.`);

  const lowMuscles = muscleStats.filter((stat) => stat.status === 'low').map((stat) => muscleLabels[stat.group]);
  const highMuscles = muscleStats.filter((stat) => stat.status === 'high' || stat.status === 'caution').map((stat) => muscleLabels[stat.group]);
  const aiComment = [
    `이번 주는 ${currentWeekSessions.length}일 운동했고 총 ${Math.round(totalVolumeKg).toLocaleString()}kg, ${currentWeekSets.length}세트를 기록했습니다.`,
    lowMuscles.length > 0 ? `부족한 근육군은 ${lowMuscles.slice(0, 3).join(', ')}입니다.` : '주요 근육군 세트 수는 대체로 권장 범위 안에 있습니다.',
    highMuscles.length > 0 ? `${highMuscles.slice(0, 3).join(', ')}는 부하를 점검하세요.` : '과도한 부하 신호는 크지 않습니다.',
    warnings.length > 0 ? '다음 주에는 경고 항목을 우선 줄이는 방향으로 계획하세요.' : '다음 주에는 부족한 부위에 2-4세트를 추가하는 정도가 적절합니다.',
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
    aiComment,
  };
}

function Badge({ status }: { status: LoadStatus }) {
  const label = status === 'low' ? '부족' : status === 'normal' ? '적정' : status === 'high' ? '과다' : '주의';
  const className = status === 'normal'
    ? 'bg-emerald-400/15 text-emerald-300'
    : status === 'high'
    ? 'bg-red-400/15 text-red-300'
    : 'bg-amber-400/15 text-amber-300';

  return <span className={`rounded px-2 py-1 text-xs font-bold ${className}`}>{label}</span>;
}

function MiniBarChart({ weeks, metric }: { weeks: WeekStat[]; metric: 'sets' | 'workoutDays' }) {
  const maxValue = Math.max(1, ...weeks.map((week) => week[metric]));
  return (
    <div className="mt-4 flex h-28 items-end gap-2">
      {weeks.map((week) => (
        <div key={week.key} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t bg-cyan-400"
            style={{ height: `${Math.max(8, (week[metric] / maxValue) * 96)}px` }}
            aria-label={`${week.label} ${week[metric]}`}
          />
          <span className="text-[10px] text-slate-500">{week.label}</span>
        </div>
      ))}
    </div>
  );
}

function MiniLineChart({ weeks }: { weeks: WeekStat[] }) {
  const points = useMemo(() => {
    const maxValue = Math.max(1, ...weeks.map((week) => week.volumeKg));
    return weeks.map((week, index) => {
      const x = weeks.length === 1 ? 0 : (index / (weeks.length - 1)) * 100;
      const y = 100 - (week.volumeKg / maxValue) * 88 - 6;
      return `${x},${y}`;
    }).join(' ');
  }, [weeks]);

  return (
    <div className="mt-4">
      <svg viewBox="0 0 100 100" className="h-32 w-full overflow-visible">
        <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 grid grid-cols-8 text-center text-[10px] text-slate-500">
        {weeks.map((week) => <span key={week.key}>{week.label}</span>)}
      </div>
    </div>
  );
}

export function StatsPage({ onBack }: StatsPageProps) {
  const [locale] = useState(() => getStoredLocale());
  const [stats, setStats] = useState<StatsView>(() => buildEmptyStats());

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

  const hasData = stats.totalSets > 0 || stats.workoutDays > 0;

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
          <h1 className="text-2xl font-bold text-white">운동 통계</h1>
        </div>
      </header>

      {!hasData ? (
        <section className="rounded-lg bg-slate-900 p-5 shadow">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-800 text-cyan-300">
            <BarChart3 aria-hidden="true" size={24} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">아직 분석할 운동 기록이 없습니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">운동을 완료하면 주간 볼륨, Hard Set, 근육군별 부하가 자동으로 계산됩니다.</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        {[
          ['운동일수', `${stats.workoutDays}일`],
          ['총 볼륨', `${Math.round(stats.totalVolumeKg).toLocaleString()}kg`],
          ['총 세트', `${stats.totalSets}`],
          ['Hard Set', `${stats.hardSets}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-900 p-4 shadow">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-lg bg-slate-900 p-4 shadow">
          <p className="text-xs font-semibold uppercase text-slate-500">전주 대비 변화율</p>
          <p className={`mt-2 text-3xl font-bold ${stats.weekOverWeekPct !== undefined && stats.weekOverWeekPct >= 25 ? 'text-amber-300' : 'text-white'}`}>
            {formatPct(stats.weekOverWeekPct)}
          </p>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">최근 8주 추세</h2>
        <p className="mt-4 text-sm font-semibold text-slate-300">총 볼륨</p>
        <MiniLineChart weeks={stats.weeks} />
        <p className="mt-5 text-sm font-semibold text-slate-300">총 세트 수</p>
        <MiniBarChart weeks={stats.weeks} metric="sets" />
        <p className="mt-5 text-sm font-semibold text-slate-300">운동일수</p>
        <MiniBarChart weeks={stats.weeks} metric="workoutDays" />
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">근육군별 분석</h2>
        <div className="mt-4 grid gap-3">
          {stats.muscleStats.map((muscle) => (
            <div key={muscle.group} className="rounded-md bg-slate-800 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-white">{muscleLabels[muscle.group]}</p>
                <Badge status={muscle.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-slate-500">볼륨</p><p className="font-bold text-white">{Math.round(muscle.volumeKg).toLocaleString()}kg</p></div>
                <div><p className="text-slate-500">세트</p><p className="font-bold text-white">{muscle.sets}</p></div>
                <div><p className="text-slate-500">Hard</p><p className="font-bold text-white">{muscle.hardSets}</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-400">권장 {muscle.recommendedMin}-{muscle.recommendedMax}세트/주</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <h2 className="text-lg font-bold text-white">운동별 성과</h2>
        <div className="mt-4 grid gap-3">
          {stats.performances.length === 0 ? (
            <p className="text-sm text-slate-300">완료한 운동 세트가 있으면 운동별 성과가 표시됩니다.</p>
          ) : stats.performances.map((performance) => (
            <div key={performance.id} className="rounded-md bg-slate-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-white">{performance.name}</h3>
                <span className="text-xs font-bold text-cyan-300">{formatPct(performance.fourWeekChangePct)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <p className="text-slate-400">최근 중량 <span className="font-bold text-white">{performance.recentWeightKg.toFixed(1)}kg</span></p>
                <p className="text-slate-400">최고 중량 <span className="font-bold text-white">{performance.bestWeightKg.toFixed(1)}kg</span></p>
                <p className="text-slate-400">최근 볼륨 <span className="font-bold text-white">{Math.round(performance.recentVolumeKg).toLocaleString()}kg</span></p>
                <p className="text-slate-400">최고 볼륨 <span className="font-bold text-white">{Math.round(performance.bestVolumeKg).toLocaleString()}kg</span></p>
                <p className="col-span-2 text-slate-400">예상 1RM <span className="font-bold text-white">{performance.estimatedOneRmKg.toFixed(1)}kg</span></p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" size={18} className="text-amber-300" />
          <h2 className="text-lg font-bold text-white">회복/부하 경고</h2>
        </div>
        <div className="mt-4 grid gap-2">
          {stats.warnings.length === 0 ? (
            <p className="rounded-md bg-emerald-400/10 px-3 py-3 text-sm text-emerald-300">현재 주요 경고는 없습니다.</p>
          ) : stats.warnings.map((warning) => (
            <p key={warning} className="rounded-md bg-amber-400/10 px-3 py-3 text-sm leading-6 text-amber-200">{warning}</p>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-cyan-300">AI 코멘트</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{stats.aiComment}</p>
      </section>
    </section>
  );
}
