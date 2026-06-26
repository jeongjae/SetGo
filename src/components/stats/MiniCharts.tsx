import { useMemo } from 'react';
import type { WeekStat, Locale, ExercisePerformance } from '../../domain/stats';

type MiniBarChartProps = {
  weeks: WeekStat[];
  metric: 'sets' | 'workoutDays';
};

export function MiniBarChart({ weeks, metric }: MiniBarChartProps) {
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

type MiniLineChartProps = {
  weeks: WeekStat[];
  locale: Locale;
  peakLabel: string;
};

export function MiniLineChart({ weeks, locale, peakLabel }: MiniLineChartProps) {
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
        <span className="text-[#159A91] font-bold">
          {peak ? `${peakLabel} ${peak.label}: ${Math.round(peak.volumeKg).toLocaleString()}kg` : ''}
        </span>
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
          {plottedPoints.length > 0 && <polygon points={`0,95 ${points} 100,95`} fill="url(#chartGradient)" />}

          <polyline
            points={points}
            fill="none"
            stroke="#2EC4B6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {plottedPoints.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r="2.5" fill="#2EC4B6" stroke="#FFFFFF" strokeWidth="1" />
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-8 text-center text-[10px] font-semibold text-[#8E8E93]">
        {weeks.map((week) => (
          <span key={week.key}>{week.label}</span>
        ))}
      </div>
    </div>
  );
}

type MiniSparkBarsProps = {
  history: ExercisePerformance['oneRmHistory'];
};

export function MiniSparkBars({ history }: MiniSparkBarsProps) {
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
