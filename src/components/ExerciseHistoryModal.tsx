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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-lg">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2EC4B6] border-t-transparent" />
          <p className="text-sm font-bold text-[#6E6E73]">
            {locale === 'ko' ? '기록을 불러오는 중...' : 'Loading history...'}
          </p>
        </div>
      </div>
    );
  }

  if (!exercise || !details) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-6 text-center shadow-lg">
          <p className="text-sm font-black text-[#1C1C1E]">
            {locale === 'ko' ? '운동 정보를 찾을 수 없습니다.' : 'Exercise not found.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ios-button-primary mt-4 px-4 py-2 text-xs font-bold"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[92vh] w-full max-w-md flex-col rounded-t-3xl border-t border-[#D1D1D6] bg-[#F2F2F7] shadow-2xl sm:h-[85vh] sm:rounded-3xl sm:border overflow-hidden text-[#1C1C1E]">
        {/* 모달 헤더 */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#D1D1D6] px-4 py-3.5 bg-white shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2F2F7] text-xl border border-black/5 shadow-inner">
              {getExerciseIcon(exercise.defaultEmoji)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold leading-tight text-[#1C1C1E]">
                {getExerciseName(exercise, locale)}
              </h2>
              <p className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                {locale === 'ko' ? '운동 분석 및 기록' : 'Exercise Analysis & History'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#8E8E93] transition-all hover:bg-[#F2F2F7] active:scale-95"
            aria-label="Close modal"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {/* 모달 바디 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4.5 scrollbar-thin">
          {/* 베스트 스펙 카드 그리드 */}
          <section className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-black/5 bg-white p-3 flex flex-col justify-between min-h-[4.5rem] shadow-sm">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                <Trophy size={11} />
                <span>Best 1RM</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#1C1C1E] font-mono">
                {details.bestEstimated1RM > 0 ? `${details.bestEstimated1RM.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-3 flex flex-col justify-between min-h-[4.5rem] shadow-sm">
              <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-600 uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 중량' : 'Best Weight'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#1C1C1E] font-mono">
                {details.bestWeight > 0 ? `${details.bestWeight.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-3 flex flex-col justify-between min-h-[4.5rem] shadow-sm">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 세트볼륨' : 'Best Set Vol'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#1C1C1E] font-mono">
                {details.bestVolume > 0 ? `${details.bestVolume.toLocaleString()} kg` : '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-3 flex flex-col justify-between min-h-[4.5rem] shadow-sm">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#5856D6] uppercase tracking-wider">
                <Trophy size={11} />
                <span>{locale === 'ko' ? '최고 세션볼륨' : 'Best Session Vol'}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#1C1C1E] font-mono">
                {details.bestSessionVolume > 0 ? `${details.bestSessionVolume.toLocaleString()} kg` : '-'}
              </p>
            </div>
          </section>

          {/* 5세션 볼륨 트렌드 미니 차트 */}
          {recent5.length > 0 ? (
            <section className="ios-card p-3.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#159A91] uppercase tracking-wider">
                <BarChart3 size={13} />
                <span>{locale === 'ko' ? '최근 5세션 볼륨 트렌드' : 'Recent 5-Session Volume Trend'}</span>
              </div>
              <div className="mt-5 flex h-28 items-end justify-between px-2 gap-4">
                {recent5.map((h, i) => {
                  const pct = Math.max(10, Math.round((h.totalVolumeKg / maxVolume) * 100));
                  return (
                    <div key={h.sessionId} className="flex flex-1 flex-col items-center h-full justify-end group">
                      <span className="mb-1.5 text-[10px] font-bold text-[#6E6E73] font-mono opacity-80 scale-90">
                        {h.totalVolumeKg.toLocaleString()}
                      </span>
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full rounded-t-lg bg-gradient-to-t from-[#2EC4B6]/50 to-[#2EC4B6] transition-all group-hover:to-[#159A91]"
                      />
                      <span className="mt-2 text-[9px] font-bold text-[#8E8E93] font-mono">
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
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#159A91] uppercase tracking-wider">
              <TrendingUp size={13} />
              <span>{locale === 'ko' ? '세션 히스토리' : 'Session History'}</span>
            </div>
            {details.history.length === 0 ? (
              <p className="rounded-2xl border border-black/5 bg-white py-8 text-center text-xs font-bold text-[#8E8E93] shadow-sm">
                {locale === 'ko' ? '완료된 이전 세션 기록이 없습니다.' : 'No completed session records yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {details.history.map((entry) => (
                  <div key={entry.sessionId} className="rounded-2xl border border-black/5 bg-white p-3.5 space-y-2 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E]">
                        <Calendar size={13} className="text-[#8E8E93]" />
                        <span>{entry.date}</span>
                        {entry.routineName && (
                          <span className="rounded-md border border-black/5 bg-[#F2F2F7] px-1.5 py-0.5 text-[10px] text-[#6E6E73] font-bold truncate max-w-[9rem]">
                            {entry.routineName}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] font-bold text-[#6E6E73]">
                        Vol: {entry.totalVolumeKg.toLocaleString()} kg
                      </span>
                    </div>
                    {/* 세트 목록 */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#E5E5EA]">
                      {entry.sets.map((set, sIdx) => {
                        const isWeightPR = set.isCompleted && set.weightKg === details.bestWeight;
                        const isVolPR = set.isCompleted && (set.weightKg * set.reps) === details.bestVolume;

                        return (
                          <div key={set.id} className="flex items-center justify-between rounded-lg bg-[#F2F2F7] px-2 py-1 text-[11px] font-medium text-[#1C1C1E]">
                            <span className="font-bold text-[#6E6E73]">
                              {sIdx + 1}S
                            </span>
                            <span className="font-mono text-[#1C1C1E]">
                              {set.weightKg}kg x {set.reps}
                            </span>
                            {(isWeightPR || isVolPR) ? (
                              <span className="ml-1 scale-90 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-500" title="PR">
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
