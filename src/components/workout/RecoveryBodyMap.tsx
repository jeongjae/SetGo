import { useState } from 'react';
import bodyMapHumanUrl from '../../assets/body-map-human-v2.png';
import type { RecoveryMuscleGroup, RecoverySnapshot, RecoveryStatus } from '../../domain/recovery';
import { recoveryGroupLabel } from '../../domain/recoveryInputs';

type RecoveryBodyMapProps = {
  recovery: RecoverySnapshot;
  locale: 'ko' | 'en';
};

type BodyMapGroup = Exclude<RecoveryMuscleGroup, 'cardio'>;

type BodyMarker = {
  group: BodyMapGroup;
  x: number;
  y: number;
  w: number;
  h: number;
};

const bodyMarkers: BodyMarker[] = [
  { group: 'shoulder', x: 18.4, y: 31, w: 7.2, h: 5.4 },
  { group: 'shoulder', x: 38.8, y: 31, w: 7.2, h: 5.4 },
  { group: 'shoulder', x: 61.7, y: 31, w: 7.2, h: 5.4 },
  { group: 'shoulder', x: 82.1, y: 31, w: 7.2, h: 5.4 },
  { group: 'chest', x: 28.6, y: 35, w: 13.4, h: 7 },
  { group: 'back', x: 71.6, y: 40, w: 13.8, h: 17.5 },
  { group: 'core', x: 28.7, y: 45, w: 10, h: 12 },
  { group: 'core', x: 71.6, y: 51, w: 11.5, h: 7.5 },
  { group: 'biceps', x: 16.1, y: 40, w: 5.1, h: 11.5 },
  { group: 'biceps', x: 41.5, y: 40, w: 5.1, h: 11.5 },
  { group: 'triceps', x: 59.2, y: 40, w: 5.1, h: 11.5 },
  { group: 'triceps', x: 84.1, y: 40, w: 5.1, h: 11.5 },
  { group: 'legs', x: 23.5, y: 63.2, w: 6.5, h: 18.8 },
  { group: 'legs', x: 33.7, y: 63.2, w: 6.5, h: 18.8 },
  { group: 'legs', x: 66.7, y: 63.2, w: 6.5, h: 18.8 },
  { group: 'legs', x: 76.5, y: 63.2, w: 6.5, h: 18.8 },
];

const bodyGroups: BodyMapGroup[] = ['chest', 'back', 'legs', 'shoulder', 'biceps', 'triceps', 'core'];

function recoveryColor(status: RecoveryStatus): string {
  if (status === 'ready') return '#34C759';
  if (status === 'moderate') return '#FF9500';
  return '#FF3B30';
}

function recoveryToneClass(status: RecoveryStatus): string {
  if (status === 'ready') return 'bg-[#34C759]/15 text-[#1F7A3A]';
  if (status === 'moderate') return 'bg-[#FF9500]/15 text-[#8A4B00]';
  return 'bg-[#FF3B30]/15 text-[#B42318]';
}

export function RecoveryBodyMap({ recovery, locale }: RecoveryBodyMapProps) {
  const [activeGroup, setActiveGroup] = useState<BodyMapGroup | null>(null);

  const getMuscleStat = (group: BodyMapGroup) => {
    return recovery.groups.find((item) => item.group === group) ?? {
      group,
      rawLoad: 0,
      adjustedLoad: 0,
      decayedLoad: 0,
      fatigueScore: 0,
      recoveryPercent: 100,
      status: 'ready' as const,
    };
  };

  const selectedStat = activeGroup ? getMuscleStat(activeGroup) : null;
  const weakestGroup = bodyGroups
    .map((group) => getMuscleStat(group))
    .sort((a, b) => a.recoveryPercent - b.recoveryPercent)[0];

  return (
    <div className="relative flex flex-col rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
      <div className="flex w-full items-center justify-between border-b border-[#F2F2F7] pb-2">
        <h2 className="text-sm font-black text-[#1C1C1E]">
          {locale === 'ko' ? '대화형 근육 회복도' : 'Interactive Recovery'}
        </h2>
        <span className="text-[10px] font-black uppercase text-[#8E8E93]">
          {locale === 'ko' ? '부위를 터치하여 확인' : 'Tap a region'}
        </span>
      </div>

      <div className="relative mx-auto mt-2.5 aspect-square h-auto max-h-[19rem] w-full overflow-hidden rounded-xl bg-[#F2F2F7]">
        <img
          src={bodyMapHumanUrl}
          alt={locale === 'ko' ? '앞면과 뒷면 인체 회복도' : 'Front and back recovery body map'}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_8px_18px_rgba(60,60,67,0.16)]"
          draggable={false}
        />

        {bodyMarkers.map((marker, index) => {
          const stat = getMuscleStat(marker.group);
          const color = recoveryColor(stat.status);
          const isActive = activeGroup === marker.group;
          const label = recoveryGroupLabel(marker.group, locale);

          return (
            <button
              key={`${marker.group}-${index}`}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label} ${stat.recoveryPercent}%`}
              onClick={() => setActiveGroup((current) => (current === marker.group ? null : marker.group))}
              className="absolute rounded-full border transition duration-150 hover:scale-105 active:scale-95"
              style={{
                left: `${marker.x - marker.w / 2}%`,
                top: `${marker.y - marker.h / 2}%`,
                width: `${marker.w}%`,
                height: `${marker.h}%`,
                backgroundColor: `${color}${isActive ? '66' : '38'}`,
                borderColor: `${color}${isActive ? 'F2' : '99'}`,
                boxShadow: isActive ? `0 0 0 4px ${color}22, inset 0 0 0 1px rgba(255,255,255,0.72)` : 'inset 0 0 0 1px rgba(255,255,255,0.5)',
              }}
            />
          );
        })}

        <div className="pointer-events-none absolute bottom-2.5 left-[28.8%] -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-[#6E6E73] shadow-sm">
          FRONT
        </div>
        <div className="pointer-events-none absolute bottom-2.5 left-[72.5%] -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-[#6E6E73] shadow-sm">
          BACK
        </div>
      </div>

      <div className="mt-3 min-h-[3.2rem] rounded-xl bg-[#F9F9FB] px-3 py-2.5">
        {selectedStat ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[#1C1C1E]">
                {recoveryGroupLabel(selectedStat.group, locale)}
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-[#6E6E73]">
                {locale === 'ko' ? '남은 피로를 반영한 추정치' : 'Estimated from recent training stimulus'}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${recoveryToneClass(selectedStat.status)}`}>
              {selectedStat.recoveryPercent}%
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[#1C1C1E]">
                {locale === 'ko' ? '가장 낮은 회복 부위' : 'Lowest recovery'}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-[#6E6E73]">
                {recoveryGroupLabel(weakestGroup.group, locale)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${recoveryToneClass(weakestGroup.status)}`}>
              {weakestGroup.recoveryPercent}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 border-t border-[#F2F2F7] pt-2.5 text-[10px] font-extrabold text-[#6E6E73]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#34C759]" />
          {locale === 'ko' ? '좋음 75%+' : 'Ready 75%+'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF9500]" />
          {locale === 'ko' ? '보통 50%+' : 'Moderate 50%+'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF3B30]" />
          {locale === 'ko' ? '피로 50% 미만' : 'Fatigued <50%'}
        </span>
      </div>
    </div>
  );
}
