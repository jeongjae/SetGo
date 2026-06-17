import { X, Calendar, Dumbbell, Trophy, TrendingUp, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { getExerciseHistory, type ExerciseHistoryDetails } from '../db/workouts';
import { getExerciseIcon } from '../utils/exerciseIcon';
import { getExerciseName } from '../domain/exercises';
import type { ExerciseMaster } from '../types';

type ExerciseHistoryModalProps = {
  exerciseId: string;
  onClose: () => void;
  locale: 'ko' | 'en';
};

export function ExerciseHistoryModal({ exerciseId, onClose, locale }: ExerciseHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseMaster | undefined>();
  const [details, setDetails] = useState<ExerciseHistoryDetails | undefined>();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [ex, hist] = await Promise.all([
          db.exercises.get(exerciseId),
          getExerciseHistory(exerciseId),
        ]);
        setExercise(ex);
        setDetails(hist);
      } catch (e) {
        console.error('Failed to load exercise history', e);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [exerciseId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-bold text-slate-350">
            {locale === 'ko' ? '기록을 불러오는 중...' : 'Loading history...'}
          </p>
        </div>
      </div>
    );
  }

  if (!exercise || !details) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-slate-650 bg-slate-850 p-6 text-center">
          <p className="text-sm font-black text-slate-100">
            {locale === 'ko' ? '운동 정보를 찾을 수 없습니다.' : 'Exercise not found.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950"
          >
            {locale === 'ko' ? '닫기' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  const recent5 = details.history.slice(0, 5).reverse();
  const maxVolume = Math.max(...recent5.map((h) => h.totalVolumeKg), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[92vh] w-full max-w-md flex-col rounded-t-3xl border-t border-slate-650 bg-slate-900 shadow-2xl sm:h-[85vh] sm:rounded-3xl sm:border border-slate-650/80 overflow-hidden">
        {/* 모달 헤더 */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3.5 bg-slate-900/90 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xl border border-slate-750 shadow-inner">
              {getExerciseIcon(exercise.defaultEmoji)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold leading-tight text-slate-100">
                {getExerciseName(exercise, locale)}
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {locale === 'ko' ? '운동 분석 및 기록' : 'Exercise Analysis & History'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-750 bg-slate-800 text-slate-350 transition-all hover:bg-slate-700 active:scale-95"
            aria-label="Close modal"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {/* 모달 바디 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4.5 scrollbar-thin">
          {/* 베스트 스펙 카드 그리드 */}
          <section className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-slate-800 bg-slate-850/50 p-3 flex flex-col justify-between min-h-[4.5rem]">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                <Trophy size={11} />
                <span>Best 1RM</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-slate-100 font-mono">
                {details.bestEstimated1RM > 0 ? `${details.bestEstimated1RM.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-850/50 p-3 flex flex-col justify-between min-h-[4.5rem]">
              <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 중량' : 'Best Weight'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-slate-100 font-mono">
                {details.bestWeight > 0 ? `${details.bestWeight.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-850/50 p-3 flex flex-col justify-between min-h-[4.5rem]">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 세트볼륨' : 'Best Set Vol'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-slate-100 font-mono">
                {details.bestVolume > 0 ? `${details.bestVolume.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-850/50 p-3 flex flex-col justify-between min-h-[4.5rem]">
              <div className="flex items-center gap-1 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 세션볼륨' : 'Best Session Vol'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-slate-100 font-mono">
                {details.bestSessionVolume > 0 ? `${details.bestSessionVolume.toLocaleString()} kg` : '-'}
              </p>
            </div>
          </section>

          {/* 5세션 볼륨 트렌드 미니 차트 */}
          {recent5.length > 0 ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-850/40 p-3.5 shadow-md">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider">
                <BarChart3 size={13} />
                <span>{locale === 'ko' ? '최근 5세션 볼륨 트렌드' : 'Recent 5-Session Volume Trend'}</span>
              </div>
              <div className="mt-5 flex h-28 items-end justify-between px-2 gap-4">
                {recent5.map((h, i) => {
                  const pct = Math.max(10, Math.round((h.totalVolumeKg / maxVolume) * 100));
                  return (
                    <div key={h.sessionId} className="flex flex-1 flex-col items-center h-full justify-end group">
                      <span className="mb-1.5 text-[10px] font-black text-slate-200 font-mono opacity-80 scale-90">
                        {h.totalVolumeKg.toLocaleString()}
                      </span>
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full rounded-t-lg bg-gradient-to-t from-cyan-600/40 to-cyan-400/90 shadow-[0_-2px_8px_rgba(34,211,238,0.2)] transition-all group-hover:to-cyan-300"
                      />
                      <span className="mt-2 text-[9px] font-black text-slate-400 font-mono">
                        {h.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* 세션 기록 리스트 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider">
              <TrendingUp size={13} />
              <span>{locale === 'ko' ? '세션 히스토리' : 'Session History'}</span>
            </div>
            {details.history.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-850/30 py-8 text-center text-xs font-bold text-slate-400">
                {locale === 'ko' ? '완료된 이전 세션 기록이 없습니다.' : 'No completed session records yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {details.history.map((entry) => (
                  <div key={entry.sessionId} className="rounded-2xl border border-slate-800 bg-slate-850/60 p-3.5 space-y-2 shadow-inner">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-200">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{entry.date}</span>
                        {entry.routineName && (
                          <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-bold truncate max-w-[9rem]">
                            {entry.routineName}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] font-black text-slate-400">
                        Vol: {entry.totalVolumeKg.toLocaleString()} kg
                      </span>
                    </div>
                    {/* 세트 목록 */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-900/50">
                      {entry.sets.map((set, sIdx) => {
                        const isWeightPR = set.isCompleted && set.weightKg === details.bestWeight;
                        const isVolPR = set.isCompleted && (set.weightKg * set.reps) === details.bestVolume;

                        return (
                          <div key={set.id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-2 py-1 text-[11px] font-medium text-slate-200">
                            <span className="font-bold text-slate-400">
                              {sIdx + 1}S
                            </span>
                            <span className="font-mono text-slate-100">
                              {set.weightKg}kg x {set.reps}
                            </span>
                            {(isWeightPR || isVolPR) ? (
                              <span className="ml-1 scale-90 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400" title="PR">
                                👑
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
