import { insightStatus, insightMessage, insightLabel, formatKg, type StatsView, type Locale } from '../../domain/stats';

type ReadinessPanelProps = {
  stats: StatsView;
  locale: Locale;
};

export function ReadinessPanel({ stats, locale }: ReadinessPanelProps) {
  const status = insightStatus(stats);
  const statusClass =
    status === 'normal'
      ? 'bg-[#2EC4B6] text-white'
      : status === 'high'
      ? 'bg-[#FF3B30] text-white'
      : status === 'caution'
      ? 'bg-[#FF9500] text-white'
      : 'bg-[#8E8E93] text-white';

  return (
    <section className="ios-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#159A91]">
            {locale === 'ko' ? '회복 판정' : 'Recovery read'}
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-[#1C1C1E]">
            {locale === 'ko'
              ? `${stats.recovery.averageRecoveryPercent}% 회복`
              : `${stats.recovery.averageRecoveryPercent}% recovered`}
          </h2>
          <p className="mt-0.5 text-[11px] font-black text-[#8E8E93]">
            {locale === 'ko'
              ? `${stats.workoutDays}일 / ${formatKg(stats.totalVolumeKg)}`
              : `${stats.workoutDays}d / ${formatKg(stats.totalVolumeKg)}`}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-[#6E6E73]">
            {insightMessage(stats, locale)}
          </p>
        </div>
        <span className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-black uppercase shadow-sm ${statusClass}`}>
          {insightLabel(status, locale)}
        </span>
      </div>
    </section>
  );
}
