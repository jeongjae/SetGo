import { useEffect, useRef, useState } from 'react';
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
  { group: 'shoulder', x: 21.7, y: 19.5, w: 7.7, h: 4.1 },
  { group: 'shoulder', x: 34.5, y: 19.5, w: 7.6, h: 4.5 },
  { group: 'shoulder', x: 67, y: 19, w: 8, h: 4.1 },
  { group: 'shoulder', x: 77.7, y: 19, w: 8, h: 4.1 },
  { group: 'chest', x: 28.2, y: 24, w: 17.4, h: 9.8 },
  { group: 'back', x: 72, y: 23.4, w: 17.9, h: 9.2 },
  { group: 'back', x: 72.4, y: 29.7, w: 11.9, h: 7.9 },
  { group: 'core', x: 28.4, y: 35.4, w: 11, h: 15.9 },
  { group: 'core', x: 72.2, y: 36.8, w: 10.6, h: 8.4 },
  { group: 'biceps', x: 18.2, y: 27.1, w: 3.8, h: 8.8 },
  { group: 'biceps', x: 38.1, y: 26.9, w: 3.8, h: 8.9 },
  { group: 'triceps', x: 61.9, y: 28, w: 3.8, h: 9.6 },
  { group: 'triceps', x: 82.3, y: 28.2, w: 3.8, h: 10.6 },
  { group: 'legs', x: 23.7, y: 55, w: 5.9, h: 15.6 },
  { group: 'legs', x: 32.9, y: 54.9, w: 5.8, h: 15.6 },
  { group: 'legs', x: 66.9, y: 55.9, w: 5.2, h: 14.1 },
  { group: 'legs', x: 76.6, y: 55.9, w: 5.2, h: 14.1 },
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateMapSize = () => {
      const root = rootRef.current;
      if (!root) return;
      const availableWidth = root.getBoundingClientRect().width - 28;
      const maxSize = 304;
      setMapSize(Math.max(240, Math.min(availableWidth, maxSize)));
    };

    updateMapSize();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMapSize);
    if (rootRef.current && resizeObserver) resizeObserver.observe(rootRef.current);
    window.addEventListener('resize', updateMapSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMapSize);
    };
  }, []);

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
    <div
      ref={rootRef}
      className="relative flex flex-col rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm"
    >
      <div className="flex w-full items-center justify-between border-b border-[#F2F2F7] pb-2">
        <h2 className="text-sm font-black text-[#1C1C1E]">
          {locale === 'ko' ? '대화형 근육 회복도' : 'Interactive Recovery'}
        </h2>
        <span className="text-[10px] font-black uppercase text-[#8E8E93]">
          {locale === 'ko' ? '부위를 터치하여 확인' : 'Tap a region'}
        </span>
      </div>

      <div
        className="relative mx-auto mt-2.5 overflow-hidden rounded-xl bg-[#F2F2F7]"
        style={{
          width: mapSize ? `${mapSize}px` : 'min(100%, 19rem)',
          height: mapSize ? `${mapSize}px` : 'min(calc(100vw - 3rem), 19rem)',
          flexShrink: 0,
        }}
      >
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
                backgroundColor: `${color}${isActive ? '80' : '5C'}`,
                borderColor: `${color}${isActive ? 'F2' : 'D6'}`,
                boxShadow:
                  isActive
                    ? `0 0 0 4px ${color}2E, inset 0 0 0 1px rgba(255,255,255,0.82)`
                    : '0 1px 4px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(255,255,255,0.62)',
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
