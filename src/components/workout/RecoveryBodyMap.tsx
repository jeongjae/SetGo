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

      <div className="relative mt-2.5 flex h-60 w-full items-center justify-center overflow-hidden">
        <svg viewBox="0 0 240 220" className="h-full w-auto select-none">
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* FRONT BACKGROUND BODY OUTLINE (Center X = 60) */}
          <path 
            d="M 60,15 
               C 65,15 67,19 67,23 
               C 67,27 65,29 63,30 
               C 64,30 68,31 71,32 
               C 75,33 79,36 82,41 
               C 85,46 87,55 86,64 
               C 85,73 83,82 82,90 
               C 81,95 81,100 80,105
               C 78,112 75,118 73,123
               C 73,142 72,165 70,195
               C 69,207 68,211 65,211
               C 63,211 62,207 62,185
               C 62,165 61,142 60,132
               C 59,142 58,165 58,185
               C 58,207 57,211 55,211
               C 52,211 51,207 50,195
               C 48,165 47,142 47,123
               C 45,118 42,112 40,105
               C 39,100 39,95 38,90
               C 37,82 35,73 34,64
               C 33,55 35,46 38,41
               C 41,36 45,33 49,32
               C 52,31 56,30 57,30
               C 55,29 53,27 53,23
               C 53,19 55,15 60,15 Z" 
            fill="#E5E5EA" 
          />
          
          {/* BACK BACKGROUND BODY OUTLINE (Center X = 180) */}
          <path 
            d="M 180,15 
               C 185,15 187,19 187,23 
               C 187,27 185,29 183,30 
               C 184,30 188,31 191,32 
               C 195,33 199,36 202,41 
               C 205,46 207,55 206,64 
               C 205,73 203,82 202,90 
               C 201,95 201,100 200,105
               C 198,112 195,118 193,123
               C 193,142 192,165 190,195
               C 189,207 188,211 185,211
               C 183,211 182,207 182,185
               C 182,165 181,142 180,132
               C 179,142 178,165 178,185
               C 178,207 177,211 175,211
               C 172,211 171,207 170,195
               C 168,165 167,142 167,123
               C 165,118 162,112 160,105
               C 159,100 159,95 158,90
               C 157,82 155,73 154,64
               C 153,55 155,46 158,41
               C 161,36 165,33 169,32
               C 172,31 176,30 177,30
               C 175,29 173,27 173,23
               C 173,19 175,15 180,15 Z" 
            fill="#E5E5EA" 
          />

          {/* FRONT VIEW MUSCLES */}
          <g filter="url(#shadow)" className="cursor-pointer">
            {/* Front Head */}
            <circle cx="60" cy="23" r="8" fill="#D1D1D6" />

            {/* Left Shoulder */}
            <path
              d="M 46,34 C 38,36 34,42 34,51 C 37,53 43,49 46,45 Z"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Right Shoulder */}
            <path
              d="M 74,34 C 82,36 86,42 86,51 C 83,53 77,49 74,45 Z"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Chest - Left */}
            <path
              d="M 44,44 C 44,56 50,59 59,59 C 59,48 56,44 44,44 Z"
              fill={getMuscleColor('chest')}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Chest - Right */}
            <path
              d="M 76,44 C 76,56 70,59 61,59 C 61,48 64,44 76,44 Z"
              fill={getMuscleColor('chest')}
              onClick={() => handleMuscleClick('chest')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Biceps - Left */}
            <path
              d="M 33,53 C 29,57 28,67 31,76 C 34,74 36,67 36,58 Z"
              fill={getMuscleColor('biceps')}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Biceps - Right */}
            <path
              d="M 87,53 C 91,57 92,67 89,76 C 86,74 84,67 84,58 Z"
              fill={getMuscleColor('biceps')}
              onClick={() => handleMuscleClick('biceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Core / Abs */}
            <path
              d="M 47,61 C 45,74 46,89 49,101 C 54,104 66,104 71,101 C 74,89 75,74 73,61 Z"
              fill={getMuscleColor('core')}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Legs - Left */}
            <path
              d="M 36,108 C 36,128 38,155 45,165 C 50,165 54,142 54,108 Z"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Legs - Right */}
            <path
              d="M 84,108 C 84,128 82,155 75,165 C 70,165 66,142 66,108 Z"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
          </g>

          {/* BACK VIEW MUSCLES */}
          <g filter="url(#shadow)" className="cursor-pointer">
            {/* Back Head */}
            <circle cx="180" cy="23" r="8" fill="#D1D1D6" />

            {/* Shoulder - Back Left */}
            <path
              d="M 166,34 C 158,36 154,42 154,51 C 157,53 163,49 166,45 Z"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Shoulder - Back Right */}
            <path
              d="M 194,34 C 202,36 206,42 206,51 C 203,53 197,49 194,45 Z"
              fill={getMuscleColor('shoulder')}
              onClick={() => handleMuscleClick('shoulder')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Triceps - Left */}
            <path
              d="M 153,53 C 149,57 148,67 151,76 C 154,74 156,67 156,58 Z"
              fill={getMuscleColor('triceps')}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Triceps - Right */}
            <path
              d="M 207,53 C 211,57 212,67 209,76 C 206,74 204,67 204,58 Z"
              fill={getMuscleColor('triceps')}
              onClick={() => handleMuscleClick('triceps')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Back / Lats */}
            <path
              d="M 180,36 C 163,38 159,48 159,60 C 165,72 175,77 180,81 C 185,77 195,72 201,60 C 201,48 197,38 180,36 Z"
              fill={getMuscleColor('back')}
              onClick={() => handleMuscleClick('back')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Lower Back / Glutes */}
            <path
              d="M 164,84 C 161,96 163,104 180,104 C 197,104 199,96 196,84 Z"
              fill={getMuscleColor('core')}
              onClick={() => handleMuscleClick('core')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />

            {/* Legs - Left */}
            <path
              d="M 156,108 C 156,128 158,155 165,165 C 170,165 174,142 174,108 Z"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
            {/* Legs - Right */}
            <path
              d="M 204,108 C 204,128 202,155 195,165 C 190,165 186,142 186,108 Z"
              fill={getMuscleColor('legs')}
              onClick={() => handleMuscleClick('legs')}
              className="transition-all duration-300 hover:brightness-95 active:scale-95"
            />
          </g>

          <text x="60" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="bold">FRONT</text>
          <text x="180" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="bold">BACK</text>
        </svg>

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
