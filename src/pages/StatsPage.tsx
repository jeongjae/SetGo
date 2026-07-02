import { AlertTriangle, BarChart3, CalendarRange, Dumbbell, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import {
  buildStats,
  buildEmptyStats,
  buildAiPrompt,
  analysisWindowDays,
  loadAnalysisWindow,
  saveAnalysisWindow,
  muscleLabels,
  recoveryLabels,
  insightStatus,
  insightLabel,
  insightMessage,
  recoveryStatusLabel,
  formatPct,
  formatKg,
  analysisWindows,
  pctChange,
  type StatsView,
  type Locale,
  type AnalysisWindowId,
  type LoadStatus,
  type MuscleStat,
  type DailyTrendStat,
  type WeekStat,
  type ExercisePerformance
} from '../domain/stats';
import { IOSPageHeader, IOSSegmentedControl } from '../components/IosPrimitives';
import { RecoveryBodyMap } from '../components/workout/RecoveryBodyMap';
import { MuscleVolumeRings } from '../components/stats/MuscleVolumeRings';
import { StaticLineChart } from '../components/stats/StaticLineChart';
import { ReadinessPanel } from '../components/stats/ReadinessPanel';
import { PerformanceCompactList } from '../components/stats/PerformanceCompactList';
import { MiniBarChart, MiniLineChart, MiniSparkBars } from '../components/stats/MiniCharts';
import { t, tf } from '../i18n/i18n';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { buildRecoverySnapshot, type RecoveryMuscleGroup, type RecoverySnapshot, type RecoveryStatus } from '../domain/recovery';
import { getStoredLocale } from '../i18n/i18n';



function Badge({ status, locale }: { status: LoadStatus; locale: Locale }) {
  const labels = {
    ko: { low: '\uBD80\uC871', normal: '\uC801\uC815', high: '\uACFC\uB2E4', caution: '\uC8FC\uC758' },
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

function recoveryBarClass(status: RecoveryStatus): string {
  if (status === 'ready') return 'bg-[#34C759]';
  if (status === 'moderate') return 'bg-[#FF9500]';
  return 'bg-[#FF3B30]';
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
      ? `${fatiguedGroups.slice(0, 2).map((group) => recoveryLabels.ko[group.group]).join(', ')} \uD68C\uBCF5\uC744 \uC6B0\uC120\uD558\uC138\uC694.`
      : '\uACC4\uD68D\uD55C \uC6B4\uB3D9\uC744 \uC720\uC9C0\uD558\uAC70\uB098 \uAC00\uBCCD\uAC8C \uC9C4\uD589\uD574\uB3C4 \uB429\uB2C8\uB2E4.'
    : recovery.recommendation;

  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '\uD68C\uBCF5 \uB300\uC2DC\uBCF4\uB4DC' : 'Recovery dashboard'}</h2>
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
            {showDetails ? (locale === 'ko' ? '\uC811\uAE30' : 'Close') : (locale === 'ko' ? '\uC790\uC138\uD788' : 'Details')}
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
            {locale === 'ko' ? `${weeks.length}\uC8FC \uBD80\uD558` : `${weeks.length}-week load`}
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
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '\uC77C\uC77C \uBD80\uD558' : 'Daily load'}</h2>
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
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '\uBD80\uC704 \uBC38\uB7F0\uC2A4' : 'Muscle balance'}</h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-[#8E8E93] mr-1">{locale === 'ko' ? '\uBAA9\uD45C \uB300\uBE44 \uC138\uD2B8' : 'sets vs target'}</span>
          <button
            type="button"
            onClick={() => setShowBars(!showBars)}
            className="rounded-lg bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-[#007AFF] px-2.5 py-1 text-[11px] font-black transition-all active:scale-95 whitespace-nowrap"
          >
            {showBars ? (locale === 'ko' ? '\uC811\uAE30' : 'Close') : (locale === 'ko' ? '\uC790\uC138\uD788' : 'Details')}
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
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '\uB2E4\uC74C \uC561\uC158' : 'Next actions'}</h2>
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
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34C759]" />{locale === 'ko' ? '\uADFC\uB825 kg' : 'Strength kg'}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#007AFF]" />{locale === 'ko' ? '\uB7EC\uB2DD km' : 'Running km'}</span>
      </div>
      <div className="grid gap-1.5">
        {activeDays.length === 0 ? (
          <p className="rounded-xl border border-black/5 bg-[#F2F2F7] px-3 py-2 text-xs font-semibold text-[#8E8E93]">
            {locale === 'ko' ? '\uCD5C\uADFC 2\uC8FC\uAC04 \uAE30\uB85D\uB41C \uC6B4\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' : 'No workouts logged in the last two weeks.'}
          </p>
        ) : activeDays.slice(-7).map((day) => (
          <p key={day.date} className="rounded-xl border border-black/5 bg-[#F2F2F7] px-3 py-2 text-xs font-semibold leading-relaxed text-[#6E6E73]">
            <span className="font-bold text-[#1C1C1E]">{day.label}</span>{' '}
            {day.items.map((item) => (
              item.distanceKm > 0
                ? `${item.label} ${item.distanceKm.toFixed(1)}km`
                : `${item.label} ${Math.round(item.volumeKg).toLocaleString()}kg/${item.sets}${locale === 'ko' ? '\uC138\uD2B8' : ' sets'}`
            )).join(' \u00B7 ')}
          </p>
        ))}
      </div>
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
  const [showAllPerformances, setShowAllPerformances] = useState(false);

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
            {locale === 'ko' ? '\uC0C1\uC138 \uBD84\uC11D' : 'Details'}
          </p>

          <DetailSection
            title={locale === 'ko' ? '\uCD94\uC774 \uC0C1\uC138' : 'Trend details'}
            summary={locale === 'ko' ? '\uC138\uD2B8\uC640 \uC6B4\uB3D9\uC77C\uC218 \uCC28\uD2B8' : 'Sets and workout-day charts'}
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
            summary={locale === 'ko' ? `${activeMuscleCount}\uAC1C \uBD80\uC704 \uAE30\uB85D / \uCD1D ${stats.muscleStats.length}\uAC1C \uBD80\uC704` : `${activeMuscleCount} active of ${stats.muscleStats.length} groups`}
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
            summary={locale === 'ko' ? `${stats.performances.length}\uAC1C \uC6B4\uB3D9 \uAE30\uB85D` : `${stats.performances.length} tracked exercises`}
          >
            <div className="grid gap-2.5">
              {stats.performances.length === 0 ? (
                <p className="py-4 text-center text-xs font-bold text-[#8E8E93]">{c.noPerformance}</p>
              ) : (
                <>
                  {(showAllPerformances ? stats.performances : stats.performances.slice(0, 10)).map((performance) => (
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
                          <p className="text-xs font-bold uppercase text-[#8E8E93] mb-1.5">{locale === 'ko' ? '\uC131\uACFC \uCD94\uC774 (1RM & \uBCFC\uB968)' : 'Performance Trend (1RM & Vol)'}</p>
                          <StaticLineChart data={performance.chartHistory} locale={locale} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  
                  {stats.performances.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllPerformances((prev) => !prev)}
                      className="mt-2 w-full rounded-xl border border-black/5 bg-[#F2F2F7] py-2.5 text-xs font-bold text-accent-dark transition-all hover:bg-[#E5E5EA] active:scale-98"
                    >
                      {showAllPerformances
                        ? (locale === 'ko' ? '\uAC04\uB7B5\uD788 \uBCF4\uAE30' : 'Show Less')
                        : (locale === 'ko' ? `\uB354\uBCF4\uAE30 (${stats.performances.length - 10}\uAC1C \uCD94\uAC00)` : `Show More (${stats.performances.length - 10} more)`)}
                    </button>
                  )}
                </>
              )}
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
