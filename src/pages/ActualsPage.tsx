import { BarChart3, CalendarRange, Dumbbell, Footprints, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { deleteWorkoutSession, getWorkoutSummariesForDateRange, type WorkoutStartKind, type WorkoutSummary } from '../db/workouts';
import { getExerciseCategories } from '../domain/exercises';
import { getActiveRoutineDays, getRoutineDayDisplayName } from '../db/routines';
import { getStoredLocale, t, workoutStatusLabel } from '../i18n/i18n';
import { addDays, buildDateRange, formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, RoutineDay, WorkoutExercise, WorkoutSet, WorkoutStatus } from '../types';
import { IOSPageHeader } from '../components/IosPrimitives';

type ActualsPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  onAddHistoricalWorkout: (dateKey: string, kind: WorkoutStartKind, routineDayId?: string) => void;
  onEditHistoricalWorkout: (sessionId: string, dateKey: string) => void;
  onOpenStats: () => void;
  recordModeControl?: ReactNode;
};

export type ActualsCalendarDay = {
  date: Date;
  key: string;
  weekIndex: number;
};

function startOfSundayWeek(date: Date): Date {
  const copyDate = new Date(date);
  copyDate.setHours(0, 0, 0, 0);
  copyDate.setDate(copyDate.getDate() - copyDate.getDay());
  return copyDate;
}

export function buildActualsCalendarDays(referenceDate: Date): ActualsCalendarDay[] {
  return buildDateRange(addDays(startOfSundayWeek(referenceDate), -28), 35).map((date, index) => ({
    date,
    key: formatDateKey(date),
    weekIndex: Math.floor(index / 7),
  }));
}

function isRunningOnlySummary(summary: WorkoutSummary): boolean {
  return summary.session.entryKind === 'running'
    || (
      summary.cardioCount > 0
      && summary.exerciseCount === 0
      && summary.session.totalStrengthVolumeKg === 0
    );
}

function summarizeCardioDistance(records: CardioRecord[]): number {
  return records
    .filter((record) => record.isDraft !== true)
    .reduce((sum, record) => sum + (record.distanceKm ?? 0), 0);
}

function summarizeCardioMinutes(records: CardioRecord[]): number {
  return records
    .filter((record) => record.isDraft !== true)
    .reduce((sum, record) => {
      const startedAt = new Date(record.startedAt).getTime();
      const endedAt = new Date(record.endedAt).getTime();
      if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) return sum;
      return sum + Math.max(1, Math.round((endedAt - startedAt) / 60000));
    }, 0);
}

function countDisplayHardSets(sets: WorkoutSet[]): number {
  const countedMyoExercises = new Set<string>();
  let count = 0;

  for (const set of sets) {
    if (set.isHard !== true || set.type === 'warmup' || set.isWarmup === true) continue;
    if (set.intensityTechnique === 'myo_reps') {
      if (countedMyoExercises.has(set.workoutExerciseId)) continue;
      countedMyoExercises.add(set.workoutExerciseId);
    }
    count += 1;
  }

  return count;
}

export function actualsDayCellLabel(
  summaries: WorkoutSummary[],
  locale: 'ko' | 'en',
): string | undefined {
  const firstSummary = summaries[0];
  if (!firstSummary) return undefined;
  if (isRunningOnlySummary(firstSummary)) return locale === 'ko' ? '\uB7EC\uB2DD' : 'Run';
  if (firstSummary.session.entryKind === 'free') return locale === 'ko' ? '\uC790\uC720\uC6B4\uB3D9' : 'Free';

  return getRoutineDayDisplayName(firstSummary.routineDay, locale)
    ?? (locale === 'ko' ? '\uC6B4\uB3D9' : 'Workout');
}

export function actualsDayCellTextClass(hasWorkoutSummaries: boolean): string {
  return hasWorkoutSummaries ? 'text-current' : 'text-current';
}

export function countActualLoggedExercisesForSession(
  sessionId: string,
  workoutExercises: Array<Pick<WorkoutExercise, 'id' | 'sessionId'>>,
  workoutSets: Array<Pick<WorkoutSet, 'workoutExerciseId' | 'isCompleted'>>,
): number {
  const completedWorkoutExerciseIds = new Set(
    workoutSets
      .filter((set) => set.isCompleted)
      .map((set) => set.workoutExerciseId),
  );

  return workoutExercises.filter((exercise) => (
    exercise.sessionId === sessionId && completedWorkoutExerciseIds.has(exercise.id)
  )).length;
}

export function actualsSessionDetailLabel({
  actualExerciseCount,
  totalStrengthVolumeKg,
  cardioDistanceKm,
  cardioMinutes,
  locale,
}: {
  actualExerciseCount: number;
  totalStrengthVolumeKg: number;
  cardioDistanceKm: number;
  cardioMinutes: number;
  locale: 'ko' | 'en';
}): string {
  const parts: string[] = [];
  if (actualExerciseCount > 0 || totalStrengthVolumeKg > 0) {
    parts.push(`${actualExerciseCount}${locale === 'ko' ? '\uAC1C \uC6B4\uB3D9' : ' exercises'} / ${totalStrengthVolumeKg.toLocaleString()}kg`);
  }
  if (cardioDistanceKm > 0 || cardioMinutes > 0) {
    const minuteLabel = locale === 'ko' ? '\uBD84' : 'min';
    parts.push(`${locale === 'ko' ? '\uB7EC\uB2DD' : 'Running'} / ${cardioMinutes}${minuteLabel}, ${cardioDistanceKm.toFixed(2)}km`);
  }

  return parts.join(', ') || (locale === 'ko' ? '\uAE30\uB85D \uC5C6\uC74C' : 'No logged detail');
}

export function actualsStatusLabel(locale: 'ko' | 'en', status: WorkoutStatus, dateKey: string, todayKey: string): string {
  if (status === 'in_progress' && dateKey < todayKey) {
    return locale === 'ko' ? '\uC791\uC131 \uC911' : 'Draft';
  }

  return workoutStatusLabel(locale, status);
}

export function actualsSessionCardClass(status: WorkoutStatus, dateKey: string, todayKey: string): string {
  if (status === 'completed') return 'border-[#2EC4B6]/20 bg-[#F2FFFD]';
  if (status === 'skipped') return 'border-[#FF3B30]/20 bg-[#FFF2F2]';
  if (status === 'in_progress' && dateKey < todayKey) return 'border-[#FF9500]/20 bg-[#FFF6DF]';
  if (status === 'in_progress') return 'border-[#007AFF]/20 bg-[#F0F7FF]';
  return 'border-black/5 bg-[#F2F2F7]';
}

export function actualsDayCellClass({
  hasCompleted,
  hasInProgress,
  hasSkipped,
  isFuture,
  isSelected,
  isToday,
}: {
  hasCompleted: boolean;
  hasInProgress: boolean;
  hasSkipped: boolean;
  isFuture: boolean;
  isSelected: boolean;
  isToday: boolean;
}): string {
  let cellStyle = 'bg-white border-transparent text-[#8E8E93] hover:bg-[#F2F2F7]';
  if (isSelected) {
    cellStyle = 'bg-[#2EC4B6] border-transparent text-white shadow-[0_8px_18px_rgba(46,196,182,0.22)] z-10';
  } else if (hasCompleted) {
    cellStyle = 'bg-[#FF9500]/10 border-transparent text-[#FF9500] hover:bg-[#FF9500]/20';
  } else if (hasInProgress) {
    cellStyle = 'bg-[#007AFF]/10 border-transparent text-[#007AFF] hover:bg-[#007AFF]/20';
  } else if (hasSkipped) {
    cellStyle = 'bg-[#FF3B30]/10 border-transparent text-[#FF3B30] hover:bg-[#FF3B30]/20';
  } else if (isToday) {
    cellStyle = 'bg-[#007AFF]/10 border-[#007AFF] text-[#007AFF] hover:bg-[#007AFF]/20';
  } else if (isFuture) {
    cellStyle = 'bg-transparent border-transparent text-[#D1D1D6] opacity-40';
  }

  return isToday && !isSelected ? `${cellStyle} ring-2 ring-[#007AFF]/30` : cellStyle;
}

export function actualsSelectedWeekIndexForDate(
  actualDays: ActualsCalendarDay[],
  dateKey: string,
  fallbackWeekIndex: number,
): number {
  return actualDays.find((day) => day.key === dateKey)?.weekIndex ?? fallbackWeekIndex;
}

export function ActualsPage({
  initialSelectedDateKey,
  onSelectedDateChange,
  onAddHistoricalWorkout,
  onEditHistoricalWorkout,
  onOpenStats,
  recordModeControl,
}: ActualsPageProps) {
  const [locale] = useState(() => getStoredLocale());
  const todayKey = formatDateKey(new Date());
  const actualDays = useMemo(() => buildActualsCalendarDays(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedDateKey ?? todayKey);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(() => (
    actualsSelectedWeekIndexForDate(actualDays, initialSelectedDateKey ?? todayKey, 4)
  ));
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseMaster[]>([]);
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuMode, setAddMenuMode] = useState<'kind' | 'routine'>('kind');

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
    async function loadRoutineDays() {
      const days = await getActiveRoutineDays();
      setRoutineDays(days);
    }

    void loadRoutineDays();
  }, []);

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
  const hardSets = countDisplayHardSets(selectedWeekSets);
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
    setIsAddMenuOpen(false);
    setAddMenuMode('kind');
    setSelectedWeekIndex(actualsSelectedWeekIndexForDate(actualDays, day.key, day.weekIndex));
    onSelectedDateChange?.(day.key);
  }

  async function handleDeleteSession(sessionId: string) {
    const shouldDelete = window.confirm(
      locale === 'ko'
        ? '\uC774 \uC6B4\uB3D9 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694? \uC785\uB825\uD55C \uC138\uD2B8\uC640 \uB7EC\uB2DD \uAE30\uB85D\uB3C4 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.'
        : 'Delete this workout record? Its sets and running records will also be removed.',
    );
    if (!shouldDelete) return;

    await deleteWorkoutSession(sessionId);
    setReloadKey((current) => current + 1);
  }

  return (
    <section className="ios-page">
      <header className="shrink-0 space-y-2 px-0.5 pb-1 pt-1">
        <IOSPageHeader eyebrow={t(locale, 'history')} title={t(locale, 'actualsCalendar')} />
        {recordModeControl}
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
        <section className="shrink-0 ios-card p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{locale === 'ko' ? '\uCD5C\uADFC 5\uC8FC' : 'Recent 5 weeks'}</p>
              <h2 className="mt-0.5 text-sm font-black text-[#1C1C1E]">{startKey} - {endKey}</h2>
            </div>
            <CalendarRange aria-hidden="true" size={19} className="text-[#159A91]" />
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-[#8E8E93]">
            {(locale === 'ko' ? ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {actualDays.map((day) => {
              const daySummaries = summariesByDate[day.key] ?? [];
              const hasCompleted = daySummaries.some((summary) => summary.session.status === 'completed');
              const hasInProgress = daySummaries.some((summary) => summary.session.status === 'in_progress');
              const hasSkipped = daySummaries.some((summary) => summary.session.status === 'skipped');
              const dayDistance = daySummaries.reduce((sum, summary) => sum + summarizeCardioDistance(cardioBySessionId[summary.session.id] ?? []), 0);
              const dayLabel = actualsDayCellLabel(daySummaries, locale);
              const isSelected = selectedDateKey === day.key;
              const isToday = day.key === todayKey;
              const isFuture = day.key > todayKey;
              const cellStyle = actualsDayCellClass({
                hasCompleted,
                hasInProgress,
                hasSkipped,
                isFuture,
                isSelected,
                isToday,
              });

              const dayTextColor = isSelected ? 'text-white' : isToday ? 'text-[#007AFF]' : 'text-[#1C1C1E]';

              return (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => selectDate(day)}
                  className={`flex aspect-square min-h-12 flex-col rounded-xl border p-1.5 transition-all active:scale-95 ${cellStyle}`}
                  aria-label={`${day.key} ${hasCompleted ? t(locale, 'completed') : ''}`.trim()}
                >
                  <div className={`flex w-full items-center justify-between ${dayTextColor}`}>
                    <span className="text-xs font-black">{day.date.getDate()}</span>
                    {dayDistance > 0 ? <Footprints aria-hidden="true" size={12} /> : daySummaries.length > 0 ? <Dumbbell aria-hidden="true" size={12} /> : null}
                  </div>
                  {dayLabel ? (
                    <span className={`mt-0.5 w-full truncate text-[11px] font-black leading-tight ${dayTextColor}`}>{dayLabel}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="ios-card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{locale === 'ko' ? '\uC120\uD0DD \uC8FC\uAC04 \uC694\uC57D' : 'Selected week'}</p>
              <h2 className="mt-0.5 text-sm font-black text-[#1C1C1E]">
                {selectedWeekDays[0]?.key} - {selectedWeekDays[selectedWeekDays.length - 1]?.key}
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenStats}
              className="ios-button-secondary flex min-h-9 items-center gap-1.5 px-2.5 text-xs"
            >
              <BarChart3 aria-hidden="true" size={14} />
              <span>{t(locale, 'viewAnalysis')}</span>
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              [locale === 'ko' ? '\uC6B4\uB3D9\uC77C\uC218' : 'Days', `${new Set(selectedWeekSummaries.map((summary) => summary.session.date)).size}`],
              [locale === 'ko' ? '\uBCFC\uB968' : 'Volume', `${Math.round(totalVolume).toLocaleString()}kg`],
              [locale === 'ko' ? '\uC138\uD2B8' : 'Sets', `${selectedWeekSets.length}`],
              [locale === 'ko' ? 'Hard' : 'Hard', `${hardSets}`],
              [locale === 'ko' ? '\uB7EC\uB2DD' : 'Run', `${selectedWeekCardioDistance.toFixed(1)}km`],
              [locale === 'ko' ? '\uCD5C\uB2E4 \uBD80\uC704' : 'Top', topCategory ?? '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-black/5 bg-[#F2F2F7] px-2 py-2 text-center">
                <p className="text-[11px] font-bold uppercase text-[#6E6E73]">{label}</p>
                <p className="mt-1 truncate text-sm font-black text-[#1C1C1E]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 ios-card p-3.5">
          <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{locale === 'ko' ? '\uC120\uD0DD \uB0A0\uC9DC' : 'Selected date'}</p>
              <h2 className="mt-0.5 text-base font-black text-[#1C1C1E]">{selectedDateKey}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAddMenuOpen((current) => !current);
                setAddMenuMode('kind');
              }}
              disabled={!canEditSelectedDate}
              className="ios-button-primary flex min-h-9 items-center gap-1.5 px-2.5 text-xs disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus aria-hidden="true" size={14} />
              <span>{locale === 'ko' ? '\uC6B4\uB3D9 \uCD94\uAC00' : 'Add workout'}</span>
            </button>
          </div>

          {isAddMenuOpen ? (
            <div className="space-y-2 rounded-xl border border-black/5 bg-[#F2F2F7] p-2">
              {addMenuMode === 'kind' ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMenuMode('routine')}
                    className="min-h-11 rounded-xl border border-[#D1D1D6] bg-white px-2 text-sm font-bold text-[#1C1C1E] transition-all active:scale-95"
                  >
                    {locale === 'ko' ? '\uB8E8\uD2F4' : 'Routine'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      setAddMenuMode('kind');
                      onAddHistoricalWorkout(selectedDateKey, 'free');
                    }}
                    className="min-h-11 rounded-xl border border-[#5856D6]/20 bg-[#5856D6]/5 px-2 text-sm font-black text-[#5856D6] transition-all active:scale-95"
                  >
                    {locale === 'ko' ? '\uC790\uC720\uC6B4\uB3D9' : 'Free'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      setAddMenuMode('kind');
                      onAddHistoricalWorkout(selectedDateKey, 'running');
                    }}
                    className="min-h-11 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/5 px-2 text-sm font-black text-[#007AFF] transition-all active:scale-95"
                  >
                    {locale === 'ko' ? '\uB7EC\uB2DD' : 'Running'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{locale === 'ko' ? '\uB8E8\uD2F4 \uC6B4\uB3D9 \uC120\uD0DD' : 'Select routine day'}</p>
                    <button
                      type="button"
                      onClick={() => setAddMenuMode('kind')}
                      className="ios-button-secondary min-h-8 px-2.5 text-xs"
                    >
                      {locale === 'ko' ? '\uB4A4\uB85C' : 'Back'}
                    </button>
                  </div>
                  {routineDays.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {routineDays.map((routineDay) => (
                        <button
                          key={routineDay.id}
                          type="button"
                          onClick={() => {
                            setIsAddMenuOpen(false);
                            setAddMenuMode('kind');
                            onAddHistoricalWorkout(selectedDateKey, 'planned', routineDay.id);
                          }}
                          className="min-h-10 rounded-xl border border-[#2EC4B6]/20 bg-[#2EC4B6]/5 px-3 text-sm font-bold text-[#159A91] transition-all active:scale-95"
                        >
                          {getRoutineDayDisplayName(routineDay, locale) ?? routineDay.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-[#D1D1D6] bg-white px-3 py-2 text-xs font-bold text-[#8E8E93]">
                      {locale === 'ko' ? '\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uB8E8\uD2F4 \uC6B4\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' : 'No routine days available.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {selectedSummaries.length === 0 ? (
            <p className="rounded-xl bg-[#F2F2F7] px-3.5 py-3 text-xs font-medium leading-relaxed text-[#6E6E73]">
              {locale === 'ko' ? '\uC774 \uB0A0\uC9DC\uC5D0\uB294 \uAE30\uB85D\uB41C \uC6B4\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' : 'No workout record on this date.'}
            </p>
          ) : (
            <div className="grid gap-2.5">
              {selectedSummaries.map((summary) => {
                const isRunningOnly = isRunningOnlySummary(summary);
                const sessionCardioRecords = cardioBySessionId[summary.session.id] ?? [];
                const distance = summarizeCardioDistance(sessionCardioRecords);
                const cardioMinutes = summarizeCardioMinutes(sessionCardioRecords);
                const actualExerciseCount = countActualLoggedExercisesForSession(
                  summary.session.id,
                  workoutExercises,
                  workoutSets,
                );
                const sessionWorkoutExerciseIds = new Set(
                  workoutExercises
                    .filter((item) => item.sessionId === summary.session.id)
                    .map((item) => item.id),
                );
                const sessionCompletedSets = workoutSets.filter((set) => (
                  sessionWorkoutExerciseIds.has(set.workoutExerciseId) && set.isCompleted
                ));
                const sessionHardSetCount = countDisplayHardSets(sessionCompletedSets);
                const sessionCardClass = actualsSessionCardClass(summary.session.status, summary.session.date, todayKey);
                const metricItems = [
                  [locale === 'ko' ? '볼륨' : 'Volume', `${Math.round(summary.session.totalStrengthVolumeKg).toLocaleString()}kg`],
                  [locale === 'ko' ? '세트' : 'Sets', String(sessionCompletedSets.length)],
                  ['Hard', String(sessionHardSetCount)],
                  [locale === 'ko' ? '러닝' : 'Run', distance > 0 ? `${distance.toFixed(1)}km` : '-'],
                ];

                return (
                  <div key={summary.session.id} className={`space-y-2.5 rounded-2xl border p-3.5 ${sessionCardClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[#1C1C1E]">
                          {isRunningOnly
                            ? (locale === 'ko' ? '\uB7EC\uB2DD' : 'Running')
                            : summary.session.entryKind === 'free'
                              ? (locale === 'ko' ? '\uC790\uC720\uC6B4\uB3D9' : 'Free workout')
                              : getRoutineDayDisplayName(summary.routineDay, locale) ?? (locale === 'ko' ? '\uC6B4\uB3D9' : 'Workout')}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-[#6E6E73]">
                          {actualsSessionDetailLabel({
                            actualExerciseCount,
                            totalStrengthVolumeKg: summary.session.totalStrengthVolumeKg,
                            cardioDistanceKm: distance,
                            cardioMinutes,
                            locale,
                          })}
                        </p>
                      </div>
                      <span className="rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs font-bold text-[#1C1C1E]">
                        {actualsStatusLabel(locale, summary.session.status, summary.session.date, todayKey)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {metricItems.map(([label, value]) => (
                        <div key={label} className="min-w-0 rounded-lg border border-black/5 bg-white/80 px-1.5 py-1.5 text-center">
                          <p className="truncate text-[10px] font-black uppercase text-[#8E8E93]">{label}</p>
                          <p className="mt-0.5 truncate text-xs font-black tabular-nums text-[#1C1C1E]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onEditHistoricalWorkout(summary.session.id, selectedDateKey)}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-black/5 bg-white px-3 text-xs font-bold text-[#1C1C1E] transition-all active:scale-95"
                      >
                        <Pencil aria-hidden="true" size={14} />
                        <span>{locale === 'ko' ? '\uAE30\uB85D \uC218\uC815' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(summary.session.id)}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-black text-rose-600 transition-all active:scale-95"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                        <span>{locale === 'ko' ? '\uC0AD\uC81C' : 'Delete'}</span>
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
