import { useState } from 'react';
import type { RecoverySnapshot, RecoveryMuscleGroup } from '../../domain/recovery';
import { recoveryGroupLabel } from '../../domain/recoveryInputs';

type RecoveryBodyMapProps = {
  recovery: RecoverySnapshot;
  locale: 'ko' | 'en';
};

export function RecoveryBodyMap({ recovery, locale }: RecoveryBodyMapProps) {
  const [activeGroup, setActiveGroup] = useState<RecoveryMuscleGroup | null>(null);

  // Helper to get recovery details of a specific muscle group
  const getMuscleStat = (group: RecoveryMuscleGroup) => {
    return recovery.groups.find((g) => g.group === group) || {
      group,
      recoveryPercent: 100,
      status: 'ready' as const,
    };
  };

  // Map recovery status to fill colors (Apple/iOS style harmonized colors)
  const getMuscleColor = (group: RecoveryMuscleGroup) => {
    const stat = getMuscleStat(group);
    if (stat.recoveryPercent >= 75) return '#34C759'; // Ready (Green)
    if (stat.recoveryPercent >= 50) return '#FF9500'; // Moderate (Orange)
    return '#FF3B30'; // Fatigued (Red)
  };

  const handleMuscleClick = (group: RecoveryMuscleGroup) => {
    setActiveGroup((prev) => (prev === group ? null : group));
  };

  const selectedStat = activeGroup ? getMuscleStat(activeGroup) : null;

  return (
    <div className="relative flex flex-col items-center rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
      <div className="flex w-full items-center justify-between border-b border-[#F2F2F7] pb-2">
        <h2 className="text-sm font-black text-[#1C1C1E]">{locale === 'ko' ? '대화형 근육 회복도' : 'Interactive Recovery'}</h2>
        <span className="text-[10px] font-black uppercase text-[#8E8E93]">
          {locale === 'ko' ? '부위를 터치하여 확인하세요' : 'Tap muscle to inspect'}
        </span>
      </div>

      {/* SVG Container holding Front and Back body outlines */}
      <div className="relative mt-2.5 flex h-60 w-full items-center justify-center overflow-hidden">
        <svg viewBox="0 0 240 220" className="h-full w-auto select-none">
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* BACKGROUND CONTOUR SILHOUETTES */}
          {/* Front Silhouette background contour */}
          <path d="M 60,15 C 65,15 67,23 68,26 C 73,26 88,29 93,37 C 95,40 94,49 93,65 C 92,72 90,82 89,95 C 87,112 80,123 79,132 C 79,152 79,178 77,208 C 76,211 73,212 71,212 C 68,212 67,208 67,192 C 67,175 64,152 60,140 C 56,152 53,175 53,192 C 53,208 52,212 49,212 C 47,212 44,211 43,208 C 41,178 41,152 41,132 C 40,123 33,112 31,95 C 30,82 28,72 27,65 C 26,49 25,40 27,37 C 32,29 47,26 52,26 C 53,23 55,15 60,15 Z" fill="#E5E5EA" />
          
          {/* Back Silhouette background contour */}
          <path d="M 180,15 C 185,15 187,23 188,26 C 193,26 208,29 213,37 C 215,40 214,49 213,65 C 212,72 210,82 209,95 C 207,112 200,123 199,132 C 199,152 199,178 197,208 C 196,211 193,212 191,212 C 188,212 187,208 187,192 C 187,175 184,152 180,140 C 176,152 173,175 173,192 C 173,208 172,212 169,212 C 167,212 164,211 163,208 C 161,178 161,152 161,132 C 160,123 153,112 151,95 C 150,82 148,72 147,65 C 146,49 145,40 147,37 C 152,29 167,26 172,26 C 173,23 175,15 180,15 Z" fill="#E5E5EA" />

          {/* FRONT VIEW MUSCLES (Center X = 60) */}
          <g filter="url(#shadow)" className="cursor-pointer">
            {/* Front Head - Dummy interactive placeholder */}
            <circle cx="60" cy="23" r="10" fill="#D1D1D6" />

            {/* Shoulder - Front Left */}
            <rect
              x="29" y="38" width="11" height="15" rx="5"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95 origin-center"
            />
            {/* Shoulder - Front Right */}
            <rect
              x="80" y="38" width="11" height="15" rx="5"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95 origin-center"
            />

            {/* Chest - Left */}
            <path
              d="M 43,44 L 59,44 L 59,62 L 44,60 Z"
              fill={getMuscleColor('chest')}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Chest - Right */}
            <path
              d="M 61,44 L 77,44 L 76,60 L 61,62 Z"
              fill={getMuscleColor('chest')}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Biceps - Left */}
            <rect
              x="26" y="56" width="9" height="20" rx="4"
              fill={getMuscleColor('biceps')}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Biceps - Right */}
            <rect
              x="85" y="56" width="9" height="20" rx="4"
              fill={getMuscleColor('biceps')}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Core / Abs */}
            <rect
              x="46" y="65" width="28" height="38" rx="4"
              fill={getMuscleColor('core')}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Legs (Quads) - Left */}
            <rect
              x="43" y="108" width="12" height="42" rx="6"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Legs (Quads) - Right */}
            <rect
              x="65" y="108" width="12" height="42" rx="6"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
          </g>

          {/* BACK VIEW MUSCLES (Center X = 180) */}
          <g filter="url(#shadow)" className="cursor-pointer">
            {/* Back Head - Dummy */}
            <circle cx="180" cy="23" r="10" fill="#D1D1D6" />

            {/* Shoulder - Back Left */}
            <rect
              x="149" y="38" width="11" height="15" rx="5"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Shoulder - Back Right */}
            <rect
              x="200" y="38" width="11" height="15" rx="5"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Triceps - Left */}
            <rect
              x="146" y="56" width="9" height="20" rx="4"
              fill={getMuscleColor('triceps')}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Triceps - Right */}
            <rect
              x="205" y="56" width="9" height="20" rx="4"
              fill={getMuscleColor('triceps')}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Back / Lats */}
            <path
              d="M 163,44 L 197,44 L 193,82 L 167,82 Z"
              fill={getMuscleColor('back')}
              onClick={() => handleMuscleClick('back')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Lower Back / Glutes (Represented via core mapping on backside) */}
            <rect
              x="166" y="85" width="28" height="18" rx="3"
              fill={getMuscleColor('core')}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Legs (Hamstrings/Calves) - Left */}
            <rect
              x="163" y="108" width="12" height="42" rx="6"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Legs (Hamstrings/Calves) - Right */}
            <rect
              x="185" y="108" width="12" height="42" rx="6"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
          </g>

          {/* Interactive labels for indicators */}
          <text x="60" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="bold">FRONT</text>
          <text x="180" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="bold">BACK</text>
        </svg>

        {/* Dynamic Tooltip overlay on tap */}
        {selectedStat && (
          <div className="absolute bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-black/5 bg-[#1C1C1E] px-3.5 py-2 text-white shadow-lg animate-fade-in">
            <span className="text-xs font-black">
              {recoveryGroupLabel(selectedStat.group, locale)}:
            </span>
            <span
              className="font-mono text-xs font-black"
              style={{
                color:
                  selectedStat.recoveryPercent >= 75
                    ? '#30D158'
                    : selectedStat.recoveryPercent >= 50
                    ? '#FF9F0A'
                    : '#FF453A',
              }}
            >
              {selectedStat.recoveryPercent}% {locale === 'ko' ? '회복됨' : 'recovered'}
            </span>
            <button
              type="button"
              onClick={() => setActiveGroup(null)}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-black leading-none hover:bg-white/30"
              aria-label="Close tooltip"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Legend guide */}
      <div className="mt-3 flex items-center justify-center gap-4 border-t border-[#F2F2F7] pt-2.5 text-[10px] font-extrabold uppercase text-[#6E6E73] w-full">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#34C759]" />
          {locale === 'ko' ? '좋음 (75%+)' : 'Ready'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF9500]" />
          {locale === 'ko' ? '보통 (50%+)' : 'Moderate'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF3B30]" />
          {locale === 'ko' ? '피로 (<50%)' : 'Fatigued'}
        </span>
      </div>
    </div>
  );
}
