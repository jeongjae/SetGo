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

  return (
    <div className="relative flex flex-col items-center rounded-3xl border border-black/5 bg-[#F2F2F7]/50 p-4 shadow-sm backdrop-blur-md">
      <div className="flex w-full items-center justify-between border-b border-black/5 pb-2">
        <h2 className="text-sm font-extrabold text-[#1C1C1E]">{locale === 'ko' ? '대화형 근육 회복도' : 'Interactive Recovery'}</h2>
        <span className="text-[10px] font-black uppercase text-[#8E8E93]">
          {locale === 'ko' ? '부위를 터치하여 확인하세요' : 'Tap muscle to inspect'}
        </span>
      </div>

      <div className="relative mt-3 flex h-64 w-full items-center justify-center overflow-hidden">
        <svg viewBox="0 0 240 220" className="h-full w-auto select-none">
          <defs>
            <filter id="body-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" floodColor="#000000" />
            </filter>
          </defs>

          {/* ================================================================= */}
          {/* FRONT VIEW (Center X = 60) */}
          {/* ================================================================= */}
          <g filter="url(#body-shadow)">
            {/* FRONT Body Base Silhouette */}
            <path 
              d="M 60,12 
                 C 66,12 68,16 68,22 
                 C 68,28 66,30 63,31 
                 C 66,32 70,32 73,34 
                 C 78,36 82,39 84,45 
                 C 86,51 86,59 85,67 
                 C 84,73 82,82 82,90 
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
                 C 37,82 35,73 34,67
                 C 33,59 33,51 35,45
                 C 37,39 41,36 46,34
                 C 49,32 53,32 56,31
                 C 53,30 51,28 51,22
                 C 51,16 53,12 60,12 Z" 
              fill="#E5E5EA" 
            />

            {/* Front Head & Neck (Inactive) */}
            <circle cx="60" cy="21.5" r="7.5" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 57,28.5 C 57,32 58,34 60,34 C 62,34 63,32 63,28.5 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />

            {/* Left/Right Forearms & Hands (Inactive) */}
            <path d="M 32,65 C 30,70 27,82 28,90 C 29,91 31,91 32,88 C 34,80 34,71 34,65 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 88,65 C 90,70 93,82 92,90 C 91,91 89,91 88,88 C 86,80 86,71 86,65 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <circle cx="28" cy="93" r="2.5" fill="#D1D1D6" />
            <circle cx="92" cy="93" r="2.5" fill="#D1D1D6" />

            {/* Left/Right Lower Legs & Feet (Inactive) */}
            <path d="M 42,154 C 41,167 39,187 44,201 C 45,202 46,202 46,199 C 45,187 45,167 46,154 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 78,154 C 79,167 81,187 76,201 C 75,202 74,202 74,199 C 75,187 75,167 74,154 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 43,201 C 41,204 40,208 44,210 C 47,210 47,206 45,201 Z" fill="#D1D1D6" />
            <path d="M 77,201 C 79,204 80,208 76,210 C 73,210 73,206 75,201 Z" fill="#D1D1D6" />

            {/* Left Shoulder (Shoulder) */}
            <path
              d="M 46,33 C 40,34 36,38 35,45 C 37,49 43,47 45,43 Z"
              fill={getMuscleColor('shoulder')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('shoulder')}
              className={`transition-all duration-300 ${activeGroup === 'shoulder' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Right Shoulder (Shoulder) */}
            <path
              d="M 74,33 C 80,34 84,38 85,45 C 83,49 77,47 75,43 Z"
              fill={getMuscleColor('shoulder')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('shoulder')}
              className={`transition-all duration-300 ${activeGroup === 'shoulder' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Chest - Left (Chest) */}
            <path
              d="M 59,37 C 50,37 46,39 45,47 C 45,52 50,55 59,54 Z"
              fill={getMuscleColor('chest')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('chest')}
              className={`transition-all duration-300 ${activeGroup === 'chest' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Chest - Right (Chest) */}
            <path
              d="M 61,37 C 70,37 74,39 75,47 C 75,52 70,55 61,54 Z"
              fill={getMuscleColor('chest')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('chest')}
              className={`transition-all duration-300 ${activeGroup === 'chest' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Biceps - Left (Biceps) */}
            <path
              d="M 34,45 C 32,49 31,57 32,63 C 34,63 37,59 37,52 Z"
              fill={getMuscleColor('biceps')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('biceps')}
              className={`transition-all duration-300 ${activeGroup === 'biceps' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Biceps - Right (Biceps) */}
            <path
              d="M 86,45 C 88,49 89,57 88,63 C 86,63 83,59 83,52 Z"
              fill={getMuscleColor('biceps')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('biceps')}
              className={`transition-all duration-300 ${activeGroup === 'biceps' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Core / Abs (Core) */}
            <g
              onClick={() => handleMuscleClick('core')}
              className={`transition-all duration-300 cursor-pointer ${activeGroup === 'core' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            >
              <path
                d="M 46,55 C 45,68 47,84 49,93 C 52,95 68,95 71,93 C 73,84 75,68 74,55 Z"
                fill={getMuscleColor('core')}
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              {/* Detailed Anatomical Grid Lines for Abs */}
              <line x1="60" y1="56" x2="60" y2="92" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
              <line x1="48" y1="64" x2="72" y2="64" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
              <line x1="47" y1="73" x2="73" y2="73" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
              <line x1="48" y1="82" x2="72" y2="82" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
            </g>

            {/* Legs - Left Quad (Legs) */}
            <path
              d="M 49,95 C 43,104 41,124 43,147 C 46,148 53,148 54,137 C 54,119 54,105 52,95 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Legs - Right Quad (Legs) */}
            <path
              d="M 71,95 C 77,104 79,124 77,147 C 74,148 67,148 66,137 C 66,119 66,105 68,95 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            
            {/* Knees (Inactive) */}
            <circle cx="44.5" cy="151" r="2" fill="#D1D1D6" />
            <circle cx="75.5" cy="151" r="2" fill="#D1D1D6" />
          </g>

          {/* ================================================================= */}
          {/* BACK VIEW (Center X = 180) */}
          {/* ================================================================= */}
          <g filter="url(#body-shadow)">
            {/* BACK Body Base Silhouette */}
            <path 
              d="M 180,12 
                 C 186,12 188,16 188,22 
                 C 188,28 186,30 183,31 
                 C 186,32 190,32 193,34 
                 C 198,36 202,39 204,45 
                 C 206,51 206,59 205,67 
                 C 204,73 202,82 202,90 
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
                 C 157,82 155,73 154,67
                 C 153,59 153,51 155,45
                 C 157,39 161,36 166,34
                 C 169,32 173,32 176,31
                 C 173,30 171,28 171,22
                 C 171,16 173,12 180,12 Z" 
              fill="#E5E5EA" 
            />

            {/* Back Head & Neck (Inactive) */}
            <circle cx="180" cy="21.5" r="7.5" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 177,28.5 C 177,32 178,34 180,34 C 182,34 183,32 183,28.5 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />

            {/* Left/Right Forearms & Hands (Inactive) */}
            <path d="M 152,65 C 150,70 147,82 148,90 C 149,91 151,91 152,88 C 154,80 154,71 154,65 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 208,65 C 210,70 213,82 212,90 C 211,91 209,91 208,88 C 206,80 206,71 206,65 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <circle cx="148" cy="93" r="2.5" fill="#D1D1D6" />
            <circle cx="212" cy="93" r="2.5" fill="#D1D1D6" />

            {/* Left/Right Calves & Feet (Inactive) */}
            <path d="M 162,154 C 161,167 159,187 164,201 C 165,202 166,202 166,199 C 165,187 165,167 166,154 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 198,154 C 199,167 201,187 196,201 C 195,202 194,202 194,199 C 195,187 195,167 194,154 Z" fill="#D1D1D6" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 163,201 C 161,204 160,208 164,210 C 167,210 167,206 165,201 Z" fill="#D1D1D6" />
            <path d="M 197,201 C 199,204 200,208 196,210 C 193,210 193,206 195,201 Z" fill="#D1D1D6" />

            {/* Shoulder - Back Left (Shoulder) */}
            <path
              d="M 166,33 C 160,34 156,38 155,45 C 157,49 163,47 165,43 Z"
              fill={getMuscleColor('shoulder')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('shoulder')}
              className={`transition-all duration-300 ${activeGroup === 'shoulder' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Shoulder - Back Right (Shoulder) */}
            <path
              d="M 194,33 C 200,34 204,38 205,45 C 203,49 197,47 195,43 Z"
              fill={getMuscleColor('shoulder')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('shoulder')}
              className={`transition-all duration-300 ${activeGroup === 'shoulder' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Triceps - Left (Triceps) */}
            <path
              d="M 154,45 C 152,49 151,57 152,63 C 154,63 157,59 157,52 Z"
              fill={getMuscleColor('triceps')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('triceps')}
              className={`transition-all duration-300 ${activeGroup === 'triceps' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Triceps - Right (Triceps) */}
            <path
              d="M 206,45 C 208,49 209,57 208,63 C 206,63 203,59 203,52 Z"
              fill={getMuscleColor('triceps')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('triceps')}
              className={`transition-all duration-300 ${activeGroup === 'triceps' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Back / Lats (Back) */}
            <g
              onClick={() => handleMuscleClick('back')}
              className={`transition-all duration-300 cursor-pointer ${activeGroup === 'back' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            >
              {/* Left Back */}
              <path
                d="M 179,34 C 173,36 166,42 161,52 C 160,59 166,74 179,78 Z"
                fill={getMuscleColor('back')}
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              {/* Right Back */}
              <path
                d="M 181,34 C 187,36 194,42 199,52 C 200,59 194,74 181,78 Z"
                fill={getMuscleColor('back')}
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              {/* Lat/Trap definition lines */}
              <path d="M 170,36 C 174,43 177,48 180,51 C 183,48 186,43 190,36" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
              <line x1="180" y1="51" x2="180" y2="77" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.65" />
            </g>

            {/* Lower Back / Spinal Erectors (Core) */}
            <path
              d="M 170,79 C 169,84 171,90 172,94 C 175,95 185,95 188,94 C 189,90 191,84 190,79 Z"
              fill={getMuscleColor('core')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('core')}
              className={`transition-all duration-300 ${activeGroup === 'core' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Legs - Glutes (Legs) */}
            <path
              d="M 179,95 C 172,96 165,99 164,106 C 164,112 171,114 179,114 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Legs - Glutes Right (Legs) */}
            <path
              d="M 181,95 C 188,96 195,99 196,106 C 196,112 189,114 181,114 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />

            {/* Legs - Left Hamstring (Legs) */}
            <path
              d="M 165,115 C 161,123 159,138 163,147 C 165,148 172,148 173,137 C 173,123 174,118 173,115 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
            {/* Legs - Right Hamstring (Legs) */}
            <path
              d="M 195,115 C 199,123 201,138 197,147 C 195,148 188,148 187,137 C 187,123 186,118 187,115 Z"
              fill={getMuscleColor('legs')}
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinejoin="round"
              onClick={() => handleMuscleClick('legs')}
              className={`transition-all duration-300 ${activeGroup === 'legs' ? 'brightness-110 saturate-125' : 'hover:brightness-95'}`}
            />
          </g>

          {/* FRONT / BACK Labels */}
          <text x="60" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="900" letterSpacing="1">FRONT</text>
          <text x="180" y="218" textAnchor="middle" fill="#8E8E93" fontSize="9" fontWeight="900" letterSpacing="1">BACK</text>
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

      <div className="mt-3 flex items-center justify-center gap-4 border-t border-black/5 pt-2.5 text-[10px] font-extrabold uppercase text-[#6E6E73] w-full">
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

