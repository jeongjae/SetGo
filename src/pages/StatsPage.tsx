import { BarChart3, ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { getExerciseName } from '../domain/exercises';
import { getStoredLocale, t } from '../i18n/i18n';
import { formatDateKey } from '../utils/date';

type StatsPageProps = {
  onBack: () => void;
};

type ExerciseVolumeStat = {
  exerciseName: string;
  volumeKg: number;
};

type StatsView = {
  completedSessions: number;
  skippedSessions: number;
  totalVolumeKg: number;
  completedSets: number;
  topExercises: ExerciseVolumeStat[];
};

export function StatsPage({ onBack }: StatsPageProps) {
  const [locale] = useState(() => getStoredLocale());
  const [stats, setStats] = useState<StatsView>({
    completedSessions: 0,
    skippedSessions: 0,
    totalVolumeKg: 0,
    completedSets: 0,
    topExercises: [],
  });

  useEffect(() => {
    async function loadStats() {
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - 29);

      const [sessions, workoutExercises, workoutSets, exercises] = await Promise.all([
        db.workoutSessions
          .where('date')
          .between(formatDateKey(start), formatDateKey(end), true, true)
          .toArray(),
        db.workoutExercises.toArray(),
        db.workoutSets.toArray(),
        db.exercises.toArray(),
      ]);

      const sessionIds = new Set(sessions.map((session) => session.id));
      const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
      const topExercises = workoutExercises
        .filter((workoutExercise) => sessionIds.has(workoutExercise.sessionId))
        .reduce<Record<string, ExerciseVolumeStat>>((byExercise, workoutExercise) => {
          const exercise = exerciseById.get(workoutExercise.exerciseId);
          const key = workoutExercise.exerciseId;
          byExercise[key] = {
            exerciseName: exercise ? getExerciseName(exercise, locale) : key,
            volumeKg: (byExercise[key]?.volumeKg ?? 0) + workoutExercise.totalVolumeKg,
          };
          return byExercise;
        }, {});

      setStats({
        completedSessions: sessions.filter((session) => session.status === 'completed').length,
        skippedSessions: sessions.filter((session) => session.status === 'skipped').length,
        totalVolumeKg: sessions.reduce((sum, session) => sum + session.totalStrengthVolumeKg, 0),
        completedSets: workoutSets.filter((set) => set.isCompleted).length,
        topExercises: Object.values(topExercises)
          .sort((a, b) => b.volumeKg - a.volumeKg)
          .slice(0, 5),
      });
    }

    void loadStats();
  }, [locale]);

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
          <h1 className="text-2xl font-bold text-white">{locale === 'ko' ? '최근 30일' : 'Last 30 days'}</h1>
        </div>
      </header>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-slate-950">
            <BarChart3 aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{t(locale, 'totalStrengthVolume')}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              {stats.totalVolumeKg.toLocaleString()} kg
            </h2>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-900 p-3 text-center shadow">
          <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, 'completed')}</p>
          <p className="mt-1 text-xl font-bold text-white">{stats.completedSessions}</p>
        </div>
        <div className="rounded-lg bg-slate-900 p-3 text-center shadow">
          <p className="text-xs font-semibold uppercase text-slate-500">{locale === 'ko' ? '건너뜀' : 'Skipped'}</p>
          <p className="mt-1 text-xl font-bold text-white">{stats.skippedSessions}</p>
        </div>
        <div className="rounded-lg bg-slate-900 p-3 text-center shadow">
          <p className="text-xs font-semibold uppercase text-slate-500">Sets</p>
          <p className="mt-1 text-xl font-bold text-white">{stats.completedSets}</p>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{locale === 'ko' ? '상위 운동' : 'Top Exercises'}</p>
        <div className="mt-4 grid gap-3">
          {stats.topExercises.length === 0 ? (
            <p className="text-sm text-slate-300">
              {locale === 'ko' ? '운동을 완료하면 볼륨 통계가 쌓입니다.' : 'Complete a workout to build volume stats.'}
            </p>
          ) : stats.topExercises.map((exercise) => (
            <div key={exercise.exerciseName} className="rounded-md bg-slate-800 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{exercise.exerciseName}</p>
                <p className="text-sm font-semibold text-cyan-300">{exercise.volumeKg.toLocaleString()} kg</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
