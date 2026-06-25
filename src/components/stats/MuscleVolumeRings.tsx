import React from 'react';

type MuscleVolumeRingsProps = {
  muscles: Array<{
    group: string;
    label: string;
    setsPerWeek: number;
    recommendedMin: number;
    recommendedMax: number;
    status: 'low' | 'normal' | 'high' | 'caution';
    targetPct: number;
  }>;
  locale: 'ko' | 'en';
};

export function MuscleVolumeRings({ muscles, locale }: MuscleVolumeRingsProps) {
  const radius = 28;
  const strokeWidth = 5.5;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const colorMap = {
    normal: '#2EC4B6',  // SetGo main green
    high: '#FF3B30',    // Red for overload
    caution: '#FF9500', // Orange for warning
    low: '#8E8E93',     // Gray for low volume
  };

  const bgToneMap = {
    normal: 'bg-[#E8F3F3]/40 border-[#2EC4B6]/10',
    high: 'bg-[#FFECEC]/40 border-[#FF3B30]/10',
    caution: 'bg-[#FFF9EC]/40 border-[#FF9500]/10',
    low: 'bg-[#F2F2F7]/50 border-black/[0.03]',
  };

  return (
    <div className="grid grid-cols-4 gap-2.5 py-1">
      {muscles.map((muscle) => {
        const pct = Math.min(100, Math.max(0, muscle.targetPct));
        const strokeDashoffset = circumference - (pct / 100) * circumference;

        return (
          <div
            key={muscle.group}
            className={`flex flex-col items-center justify-center rounded-2xl border p-2 text-center transition-all ${
              bgToneMap[muscle.status]
            } shadow-[0_2px_8px_rgba(0,0,0,0.015)]`}
          >
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
                {/* Track Circle */}
                <circle
                  className="text-[#E5E5EA]"
                  stroke="currentColor"
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                {/* Progress Circle */}
                <circle
                  stroke={colorMap[muscle.status]}
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>
              {/* Inner Label */}
              <div className="flex flex-col items-center justify-center">
                <span className="text-[11px] font-black tabular-nums text-[#1C1C1E] leading-none">
                  {muscle.setsPerWeek}
                </span>
                <span className="text-[8px] font-bold text-[#8E8E93] leading-none mt-0.5">
                  /{muscle.recommendedMax}
                </span>
              </div>
            </div>
            {/* Label */}
            <span className="mt-1 text-center text-[10px] font-black text-[#1C1C1E] truncate w-full">
              {muscle.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
