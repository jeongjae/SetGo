import { BarChart3, CalendarRange, Dumbbell, Footprints, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { deleteWorkoutSession, getWorkoutSummariesForDateRange, type WorkoutSummary } from '../db/workouts';
import { getExerciseCategories } from '../domain/exercises';
import { getRoutineDayDisplayName } from '../db/routines';
import { getStoredLocale, t, workoutStatusLabel } from '../i18n/i18n';
import { buildRecentWeeksRange, formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSet, WorkoutStatus } from '../types';

type ActualsPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  onAddHistoricalWorkout: (dateKey: string) => void;
  onEditHistoricalWorkout: (sessionId: string, dateKey: string) => void;
  onOpenStats: () => void;
};

export type ActualsCalendarDay = {
  date: Date;
  key: string;
  weekIndex: number;
};

export function buildActualsCalendarDays(referenceDate: Date): ActualsCalendarDay[] {
  return buildRecentWeeksRange(referenceDate, 5).map((date, index) => ({
    date,
    key: formatDateKey(date),
    weekIndex: Math.floor(index / 7),
  }));
}

function isRunningOnlySummary(summary: WorkoutSummary): boolean {
  return summary.cardioCount > 0
    && summary.exerciseCount === 0
    && summary.session.totalStrengthVolumeKg === 0;
}

function summarizeCardioDistance(records: CardioRecord[]): number {
  return records
    .filter((record) => record.isDraft !== true)
    .reduce((sum, record) => sum + (record.distanceKm ?? 0), 0);
}

export function actualsDayCellLabel(
  summaries: WorkoutSummary[],
  locale: 'ko' | 'en',
): string | undefined {
  const firstSummary = summaries[0];
  if (!firstSummary) return undefined;
  if (firstSummary.cardioCount > 0 && firstSummary.exerciseCount === 0) {
    return locale === 'ko' ? '러닝' : 'Run';
  }

  return getRoutineDayDisplayName(firstSummary.routineDay, locale)
    ?? firstSummary.routineName
    ?? (locale === 'ko' ? '운동' : 'Workout');
}

export function actualsDayCellMetric(volumeKg: number, distanceKm: number): string | undefined {
  if (volumeKg > 0) return `${Math.round(volumeKg).toLocaleString()}kg`;
  if (distanceKm > 0) return `${distanceKm.toFixed(1)}km`;
  return undefined;
}

export function actualsStatusLabel(locale: 'ko' | 'en', status: WorkoutStatus, dateKey: string, todayKey: string): string {
  if (status === 'in_progress' && dateKey < todayKey) {
    return locale === 'ko' ? '작성 중' : 'Draft';
  }

  return workoutStatusLabel(locale, status);
}

export function ActualsPage({
  initialSelectedDateKey,
  onSelectedDateChange,
  onAddHistoricalWorkout,
  onEditHistoricalWorkout,
  onOpenStats,
}: ActualsPageProps) {
  const [locale] = useState(() => getStoredLocale());
  const todayKey = formatDateKey(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedDateKey ?? todayKey);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(4);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const actualDays = useMemo(() => buildActualsCalendarDays(new Date()), []);
  const startKey = actualDays[0]?.key ?? todayKey;
  const endKey = actualDays[actualDays.length - 1]?.key ?? todayKey;

  useEffect(() => {
    async function loadActuals() {
      const loadedSummaries = await getWorkoutSummariesForDateRange(startKey, endKey);
      const sessionIds = new Set(loadedSummaries.map((summary) => summary.session.id));
      const [loadedWorkoutExercises, loadedWorkoutSets, loadedCardioRecords, loadedExercises] = await Promise.all([
        db.workoutExercises.toArray(),
        db.workoutSets.toArray(),
        db.cardioRecords.toArray(),
        db.exercises.toArray(),
      ]);

      setSummaries(loadedSummaries);
      setWorkoutExercises(loadedWorkoutExercises.filter((item) => sessionIds.has(item.sessionId)));
      setWorkoutSets(loadedWorkoutSets);
      setCardioRecords(loadedCardioRecords.filter((record) => sessionIds.has(record.sessionId)));
      setExercises(loadedExercises);
    }

    void loadActuals();
  }, [endKey, reloadKey, startKey]);

  useEffect(() => {
    if (!initialSelectedDateKey) return;

    setSelectedDateKey(initialSelectedDateKey);
    const matchingDay = actualDays.find((day) => day.key === initialSelectedDateKey);
    if (matchingDay) setSelectedWeekIndex(matchingDay.weekIndex);
  }, [actualDays, initialSelectedDateKey]);

  const summariesByDate = useMemo(() => {
    return summaries.reduce<Record<string, WorkoutSummary[]>>((byDate, summary) => {
      byDate[summary.session.date] = [...(byDate[summary.session.date] ?? []), summary];
      return byDate;
    }, {});
  }, [summaries]);

  const cardioBySessionId = useMemo(() => {
    return cardioRecords.reduce<Record<string, CardioRecord[]>>((bySession, record) => {
      bySession[record.sessionId] = [...(bySession[record.sessionId] ?? []), record];
      return bySession;
    }, {});
  }, [cardioRecords]);

  const selectedSummaries = summariesByDate[selectedDateKey] ?? [];
  const selectedWeekDays = actualDays.filter((day) => day.weekIndex === selectedWeekIndex);
  const selectedWeekKeys = new Set(selectedWeekDays.map((day) => day.key));
  const selectedWeekSummaries = summaries.filter((summary) => selectedWeekKeys.has(summary.session.date) && summary.session.status === 'completed');
  const selectedWeekSessionIds = new Set(selectedWeekSummaries.map((summary) => summary.session.id));
  const selectedWeekWorkoutExerciseIds = new Set(
    workoutExercises.filter((item) => selectedWeekSessionIds.has(item.sessionId)).map((item) => item.id),
  );
  const selectedWeekSets = workoutSets.filter((set) => selectedWeekWorkoutExerciseIds.has(set.workoutExerciseId) && set.isCompleted);
  const selectedWeekCardioDistance = cardioRecords
    .filter((record) => selectedWeekSessionIds.has(record.sessionId) && record.isDraft !== true)
    .reduce((sum, record) => sum + (record.distanceKm ?? 0), 0);
  const hardSets = selectedWeekSets.filter((set) => set.rir !== undefined && set.rir <= 3 && set.type !== 'warmup' && !set.isWarmup).length;
  const totalVolume = selectedWeekSummaries.reduce((sum, summary) => sum + summary.session.totalStrengthVolumeKg, 0);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const categoryCounts = new Map<string, number>();
  workoutExercises
    .filter((item) => selectedWeekSessionIds.has(item.sessionId))
    .forEach((item) => {
      const exercise = exerciseById.get(item.exerciseId);
      if (!exercise) return;
      getExerciseCategories(exercise).forEach((category) => {
        if (category === 'cardio' || category === 'mobility' || category === 'bodyweight') return;
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      });
    });
  const topCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const canEditSelectedDate = selectedDateKey <= todayKey;

  function selectDate(day: ActualsCalendarDay) {
    setSelectedDateKey(day.key);
    setSelectedWeekIndex(day.weekIndex);
    onSelectedDateChange?.(day.key);
  }

  async function handleDeleteSession(sessionId: string) {
    const shouldDelete = window.confirm(
      locale === 'ko'
        ? '이 운동 기록을 삭제할까요? 입력한 세트와 러닝 기록도 함께 삭제됩니다.'
        : 'Delete this workout record? Its sets and running records will also be removed.',
    );
    if (!shouldDelete) return;

    await deleteWorkoutSession(sessionId);
    setReloadKey((current) => current + 1);
  }

  return (
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <div>
          <p className="text-xs font-extrabold uppercase text-cyan-300">{t(locale, 'actuals')}</p>
          <h1 className="text-xl font-black text-slate-100">{t(locale, 'actualsCalendar')}</h1>
        </div>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
        <section className="rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-200">{locale === 'ko' ? '최근 5주' : 'Recent 5 weeks'}</p>
              <h2 className="mt-0.5 text-sm font-black text-slate-100">{startKey} - {endKey}</h2>
            </div>
            <CalendarRange aria-hidden="true" size={19} className="text-cyan-300" />
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-black uppercase text-slate-200">
            {(locale === 'ko' ? ['월', '화', '수', '목', '금', '토', '일'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {actualDays.map((day) => {
              const daySummaries = summariesByDate[day.key] ?? [];
              const hasCompleted = daySummaries.some((summary) => summary.session.status === 'completed');
              const hasInProgress = daySummaries.some((summary) => summary.session.status === 'in_progress');
              const hasSkipped = daySummaries.some((summary) => summary.session.status === 'skipped');
              const dayVolume = daySummaries.reduce((sum, summary) => sum + summary.session.totalStrengthVolumeKg, 0);
              const dayDistance = daySummaries.reduce((sum, summary) => sum + summarizeCardioDistance(cardioBySessionId[summary.session.id] ?? []), 0);
              const dayLabel = actualsDayCellLabel(daySummaries, locale);
              const dayMetric = actualsDayCellMetric(dayVolume, dayDistance);
              const isSelected = selectedDateKey === day.key;
              const isFuture = day.key > todayKey;
              let cellStyle = 'bg-slate-850/75 border-slate-650 text-slate-100 hover:bg-slate-700';
              if (isSelected) {
                cellStyle = 'bg-emerald-600/90 border-emerald-300 text-white ring-1 ring-emerald-300/70';
              } else if (hasCompleted) {
                cellStyle = 'bg-yellow-100/90 border-yellow-300 text-slate-950 hover:bg-yellow-100';
              } else if (hasInProgress) {
                cellStyle = 'bg-cyan-100/90 border-cyan-300 text-slate-950 hover:bg-cyan-100';
              } else if (hasSkipped) {
                cellStyle = 'bg-rose-100/90 border-rose-300 text-slate-950 hover:bg-rose-100';
              } else if (isFuture) {
                cellStyle = 'bg-slate-900/40 border-transparent text-slate-500';
              }

              return (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => selectDate(day)}
                  className={`flex aspect-square min-h-12 flex-col rounded-xl border p-1.5 transition-all active:scale-95 ${cellStyle}`}
                  aria-label={`${day.key} ${hasCompleted ? t(locale, 'completed') : ''}`.trim()}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-black">{day.date.getDate()}</span>
                    {dayDistance > 0 ? <Footprints aria-hidden="true" size={12} /> : daySummaries.length > 0 ? <Dumbbell aria-hidden="true" size={12} /> : null}
                  </div>
                  {dayLabel ? (
                    <span className="mt-0.5 w-full truncate text-[10px] font-black leading-none">{dayLabel}</span>
                  ) : null}
                  {dayMetric ? (
                    <span className="mt-0.5 w-full truncate text-[9px] font-extrabold leading-none opacity-85">{dayMetric}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-200">{locale === 'ko' ? '선택 주간 요약' : 'Selected week'}</p>
              <h2 className="mt-0.5 text-sm font-black text-slate-100">
                {selectedWeekDays[0]?.key} - {selectedWeekDays[selectedWeekDays.length - 1]?.key}
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenStats}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-slate-850 px-2.5 text-xs font-black text-cyan-300 active:scale-95"
            >
              <BarChart3 aria-hidden="true" size={14} />
              <span>{locale === 'ko' ? '통계' : 'Stats'}</span>
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              [locale === 'ko' ? '운동일수' : 'Days', `${new Set(selectedWeekSummaries.map((summary) => summary.session.date)).size}`],
              [locale === 'ko' ? '볼륨' : 'Volume', `${Math.round(totalVolume).toLocaleString()}kg`],
              [locale === 'ko' ? '세트' : 'Sets', `${selectedWeekSets.length}`],
              [locale === 'ko' ? 'Hard' : 'Hard', `${hardSets}`],
              [locale === 'ko' ? '러닝' : 'Run', `${selectedWeekCardioDistance.toFixed(1)}km`],
              [locale === 'ko' ? '최다부위' : 'Top', topCategory ?? '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-650 bg-slate-850/80 px-2 py-2 text-center">
                <p className="text-[11px] font-black uppercase text-slate-300">{label}</p>
                <p className="mt-1 truncate text-sm font-black text-slate-100">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-650 pb-2">
            <div>
              <p className="text-xs font-black uppercase text-slate-200">{locale === 'ko' ? '선택 날짜' : 'Selected date'}</p>
              <h2 className="mt-0.5 text-base font-black text-slate-100">{selectedDateKey}</h2>
            </div>
            <button
              type="button"
              onClick={() => onAddHistoricalWorkout(selectedDateKey)}
              disabled={!canEditSelectedDate}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-black text-emerald-300 active:scale-95 disabled:border-slate-650 disabled:bg-slate-850 disabled:text-slate-500"
            >
              <Plus aria-hidden="true" size={14} />
              <span>{locale === 'ko' ? '누락 추가' : 'Add missing'}</span>
            </button>
          </div>

          {selectedSummaries.length === 0 ? (
            <p className="rounded-xl border border-slate-650 bg-slate-850/75 px-3 py-3 text-xs font-bold text-slate-300">
              {locale === 'ko' ? '이 날짜에는 기록된 운동이 없습니다.' : 'No workout record on this date.'}
            </p>
          ) : (
            <div className="grid gap-2.5">
              {selectedSummaries.map((summary) => {
                const isRunningOnly = isRunningOnlySummary(summary);
                const distance = summarizeCardioDistance(cardioBySessionId[summary.session.id] ?? []);

                return (
                  <div key={summary.session.id} className="space-y-2.5 rounded-2xl border border-slate-650 bg-slate-850/85 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-100">
                          {isRunningOnly
                            ? (locale === 'ko' ? '러닝' : 'Running')
                            : getRoutineDayDisplayName(summary.routineDay, locale) ?? summary.routineName ?? (locale === 'ko' ? '운동' : 'Workout')}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-300">
                          {distance > 0
                            ? `${distance.toFixed(2)}km`
                            : `${summary.exerciseCount}${locale === 'ko' ? '개 운동' : ' exercises'} / ${summary.session.totalStrengthVolumeKg.toLocaleString()}kg`}
                        </p>
                      </div>
                      <span className="rounded-lg border border-slate-650 bg-slate-750 px-2.5 py-1 text-xs font-black text-cyan-200">
                        {actualsStatusLabel(locale, summary.session.status, summary.session.date, todayKey)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onEditHistoricalWorkout(summary.session.id, selectedDateKey)}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-650 bg-slate-800 px-3 text-xs font-black text-cyan-300 active:scale-95"
                      >
                        <Pencil aria-hidden="true" size={14} />
                        <span>{locale === 'ko' ? '기록 수정' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(summary.session.id)}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 text-xs font-black text-danger active:scale-95"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                        <span>{locale === 'ko' ? '삭제' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
