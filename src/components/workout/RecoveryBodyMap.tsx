import { useState } from 'react';
import type { RecoverySnapshot, RecoveryMuscleGroup } from '../../domain/recovery';
import { recoveryGroupLabel } from '../../domain/recoveryInputs';

type RecoveryBodyMapProps = {
  recovery: RecoverySnapshot;
  locale: 'ko' | 'en';
};

export function RecoveryBodyMap({ recovery, locale }: RecoveryBodyMapProps) {
  const [activeGroup, setActiveGroup] = useState<RecoveryMuscleGroup | null>(null);

  const getMuscleStat = (group: RecoveryMuscleGroup) => {
    return recovery.groups.find((g) => g.group === group) || {
      group,
      recoveryPercent: 100,
      status: 'ready' as const,
    };
  };

  const getMuscleColor = (group: RecoveryMuscleGroup) => {
    const stat = getMuscleStat(group);
    if (stat.recoveryPercent >= 75) return '#30D158'; // iOS Green
    if (stat.recoveryPercent >= 50) return '#FF9F0A'; // iOS Orange
    return '#FF453A'; // iOS Red
  };

  const handleMuscleClick = (group: RecoveryMuscleGroup) => {
    setActiveGroup((prev) => (prev === group ? null : group));
  };

  const selectedStat = activeGroup ? getMuscleStat(activeGroup) : null;

  // Active or fatigues opacity helper
  const getMuscleOpacity = (group: RecoveryMuscleGroup) => {
    if (activeGroup === group) return 0.55;
    const stat = getMuscleStat(group);
    if (stat.recoveryPercent < 75) return 0.35; // Show fatigue overlay
    return 0; // Transparent for fully recovered to show high-quality background image
  };

  return (
    <div className="relative flex flex-col items-center rounded-3xl border border-black/5 bg-[#1C1C1E] p-4 shadow-xl">
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-sm font-extrabold text-white">{locale === 'ko' ? '대화형 근육 회복도' : 'Interactive Recovery'}</h2>
        <span className="text-[10px] font-black uppercase text-[#8E8E93]">
          {locale === 'ko' ? '부위를 터치하여 확인하세요' : 'Tap muscle to inspect'}
        </span>
      </div>

      <div className="relative mt-3 flex h-72 w-full items-center justify-center overflow-hidden rounded-2xl bg-black/40">
        <svg viewBox="0 0 416 493" className="h-full w-auto select-none">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* High-Quality Anatomical Background Image */}
          <image 
            href="/images/body_image.jpg" 
            x="0" 
            y="0" 
            width="416" 
            height="493" 
            className="pointer-events-none opacity-90"
          />

          {/* ================================================================= */}
          {/* FRONT VIEW OVERLAYS (Center X: 104, scale coordinates from original 240x220) */}
          {/* ================================================================= */}
          <g transform="translate(10, 18) scale(1.58, 2.1)" className="cursor-pointer">
            {/* Left Shoulder (Shoulder) */}
            <path
              d="M 46,33 C 40,34 36,38 35,45 C 37,49 43,47 45,43 Z"
              fill={getMuscleColor('shoulder')}
              opacity={getMuscleOpacity('shoulder')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'shoulder' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'shoulder' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Right Shoulder (Shoulder) */}
            <path
              d="M 74,33 C 80,34 84,38 85,45 C 83,49 77,47 75,43 Z"
              fill={getMuscleColor('shoulder')}
              opacity={getMuscleOpacity('shoulder')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'shoulder' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'shoulder' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Chest - Left (Chest) */}
            <path
              d="M 59,37 C 50,37 46,39 45,47 C 45,52 50,55 59,54 Z"
              fill={getMuscleColor('chest')}
              opacity={getMuscleOpacity('chest')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'chest' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'chest' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Chest - Right (Chest) */}
            <path
              d="M 61,37 C 70,37 74,39 75,47 C 75,52 70,55 61,54 Z"
              fill={getMuscleColor('chest')}
              opacity={getMuscleOpacity('chest')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'chest' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'chest' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Biceps - Left (Biceps) */}
            <path
              d="M 34,45 C 32,49 31,57 32,63 C 34,63 37,59 37,52 Z"
              fill={getMuscleColor('biceps')}
              opacity={getMuscleOpacity('biceps')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'biceps' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'biceps' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Biceps - Right (Biceps) */}
            <path
              d="M 86,45 C 88,49 89,57 88,63 C 86,63 83,59 83,52 Z"
              fill={getMuscleColor('biceps')}
              opacity={getMuscleOpacity('biceps')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'biceps' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'biceps' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Core / Abs (Core) */}
            <path
              d="M 46,55 C 45,68 47,84 49,93 C 52,95 68,95 71,93 C 73,84 75,68 74,55 Z"
              fill={getMuscleColor('core')}
              opacity={getMuscleOpacity('core')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'core' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'core' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Legs - Left Quad (Legs) */}
            <path
              d="M 49,95 C 43,104 41,124 43,147 C 46,148 53,148 54,137 C 54,119 54,105 52,95 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Legs - Right Quad (Legs) */}
            <path
              d="M 71,95 C 77,104 79,124 77,147 C 74,148 67,148 66,137 C 66,119 66,105 68,95 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />
          </g>

          {/* ================================================================= */}
          {/* BACK VIEW OVERLAYS (Center X: 312) */}
          {/* ================================================================= */}
          <g transform="translate(28, 18) scale(1.58, 2.1)" className="cursor-pointer">
            {/* Shoulder - Back Left (Shoulder) */}
            <path
              d="M 166,33 C 160,34 156,38 155,45 C 157,49 163,47 165,43 Z"
              fill={getMuscleColor('shoulder')}
              opacity={getMuscleOpacity('shoulder')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'shoulder' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'shoulder' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Shoulder - Back Right (Shoulder) */}
            <path
              d="M 194,33 C 200,34 204,38 205,45 C 203,49 197,47 195,43 Z"
              fill={getMuscleColor('shoulder')}
              opacity={getMuscleOpacity('shoulder')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'shoulder' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'shoulder' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Triceps - Left (Triceps) */}
            <path
              d="M 154,45 C 152,49 151,57 152,63 C 154,63 157,59 157,52 Z"
              fill={getMuscleColor('triceps')}
              opacity={getMuscleOpacity('triceps')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'triceps' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'triceps' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Triceps - Right (Triceps) */}
            <path
              d="M 206,45 C 208,49 209,57 208,63 C 206,63 203,59 203,52 Z"
              fill={getMuscleColor('triceps')}
              opacity={getMuscleOpacity('triceps')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'triceps' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'triceps' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Back / Lats (Back) */}
            <g
              onClick={() => handleMuscleClick('back')}
              className="transition-all duration-300"
            >
              {/* Left Back */}
              <path
                d="M 179,34 C 173,36 166,42 161,52 C 160,59 166,74 179,78 Z"
                fill={getMuscleColor('back')}
                opacity={getMuscleOpacity('back')}
                stroke="#FFFFFF"
                strokeWidth={activeGroup === 'back' ? "1.8" : "1.0"}
                strokeLinejoin="round"
                filter={activeGroup === 'back' ? "url(#glow)" : undefined}
              />
              {/* Right Back */}
              <path
                d="M 181,34 C 187,36 194,42 199,52 C 200,59 194,74 181,78 Z"
                fill={getMuscleColor('back')}
                opacity={getMuscleOpacity('back')}
                stroke="#FFFFFF"
                strokeWidth={activeGroup === 'back' ? "1.8" : "1.0"}
                strokeLinejoin="round"
                filter={activeGroup === 'back' ? "url(#glow)" : undefined}
              />
            </g>

            {/* Lower Back / Spinal Erectors (Core) */}
            <path
              d="M 170,79 C 169,84 171,90 172,94 C 175,95 185,95 188,94 C 189,90 191,84 190,79 Z"
              fill={getMuscleColor('core')}
              opacity={getMuscleOpacity('core')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'core' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'core' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Legs - Glutes Left (Legs) */}
            <path
              d="M 179,95 C 172,96 165,99 164,106 C 164,112 171,114 179,114 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Legs - Glutes Right (Legs) */}
            <path
              d="M 181,95 C 188,96 195,99 196,106 C 196,112 189,114 181,114 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.8" : "1.0"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />

            {/* Legs - Left Hamstring (Legs) */}
            <path
              d="M 165,115 C 161,123 159,138 163,147 C 165,148 172,148 173,137 C 173,123 174,118 173,115 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />
            {/* Legs - Right Hamstring (Legs) */}
            <path
              d="M 195,115 C 199,123 201,138 197,147 C 195,148 188,148 187,137 C 187,123 186,118 187,115 Z"
              fill={getMuscleColor('legs')}
              opacity={getMuscleOpacity('legs')}
              stroke="#FFFFFF"
              strokeWidth={activeGroup === 'legs' ? "1.5" : "0.8"}
              strokeLinejoin="round"
              filter={activeGroup === 'legs' ? "url(#glow)" : undefined}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:opacity-40"
            />
          </g>

          {/* FRONT / BACK Labels */}
          <text x="104" y="475" textAnchor="middle" fill="#FFFFFF" opacity="0.75" fontSize="10" fontWeight="900" letterSpacing="1.5">FRONT</text>
          <text x="312" y="475" textAnchor="middle" fill="#FFFFFF" opacity="0.75" fontSize="10" fontWeight="900" letterSpacing="1.5">BACK</text>
        </svg>

        {selectedStat && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#1C1C1E] px-3.5 py-2 text-white shadow-xl animate-fade-in">
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

      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/10 pt-2.5 text-[10px] font-extrabold uppercase text-[#6E6E73] w-full">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#30D158]" />
          {locale === 'ko' ? '좋음 (75%+)' : 'Ready'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF9F0A]" />
          {locale === 'ko' ? '보통 (50%+)' : 'Moderate'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF453A]" />
          {locale === 'ko' ? '피로 (<50%)' : 'Fatigued'}
        </span>
      </div>
    </div>
  );
}
