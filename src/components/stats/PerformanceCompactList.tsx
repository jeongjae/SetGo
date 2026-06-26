import { formatKg, formatPct, type ExercisePerformance, type Locale } from '../../domain/stats';

type PerformanceCompactListProps = {
  performances: ExercisePerformance[];
  locale: Locale;
  labels: {
    noPerformance: string;
    recentVolume: string;
    estimatedOneRm: string;
  };
};

function signedTone(value?: number): string {
  if (value === undefined) return 'text-[#8E8E93]';
  if (value > 0) return 'text-[#159A91]';
  if (value < 0) return 'text-[#FF9500]';
  return 'text-[#6E6E73]';
}

export function PerformanceCompactList({
  performances,
  locale,
  labels,
}: PerformanceCompactListProps) {
  return (
    <section className="ios-card p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-[#1C1C1E]">
          {locale === 'ko' ? '운동 성과 Top 5' : 'Top exercise signals'}
        </h2>
        <span className="text-[11px] font-bold text-[#8E8E93]">
          {locale === 'ko' ? '최근 볼륨순' : 'recent volume'}
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {performances.length === 0 ? (
          <p className="py-4 text-center text-xs font-bold text-[#8E8E93]">{labels.noPerformance}</p>
        ) : (
          performances.slice(0, 5).map((performance, index) => (
            <div
              key={performance.id}
              className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2 rounded-lg bg-[#F2F2F7] px-2.5 py-2"
            >
              <span className="text-center text-xs font-black text-[#8E8E93]">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-[#1C1C1E]">{performance.name}</p>
                <p className="mt-0.5 text-[11px] font-bold text-[#6E6E73]">
                  {labels.recentVolume} {formatKg(performance.recentVolumeKg)} · {labels.estimatedOneRm}{' '}
                  {performance.estimatedOneRmKg.toFixed(1)}kg
                </p>
              </div>
              <span className={`text-xs font-black ${signedTone(performance.fourWeekChangePct)}`}>
                {formatPct(performance.fourWeekChangePct)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
