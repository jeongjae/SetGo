import { useEffect, useMemo, useState, type MouseEvent } from 'react';
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

const calibrationStorageKey = 'setgo.bodyMapCalibrationMarkers.v1';

const bodyMarkers: BodyMarker[] = [
  { group: 'shoulder', x: 21.2, y: 27.6, w: 4.8, h: 4.1 },
  { group: 'shoulder', x: 36.5, y: 27.6, w: 4.8, h: 4.1 },
  { group: 'shoulder', x: 64.3, y: 27.6, w: 4.8, h: 4.1 },
  { group: 'shoulder', x: 79.7, y: 27.6, w: 4.8, h: 4.1 },
  { group: 'chest', x: 29.1, y: 31.2, w: 10.6, h: 4.8 },
  { group: 'back', x: 69.1, y: 34.1, w: 5.8, h: 8.9 },
  { group: 'back', x: 74.9, y: 34.1, w: 5.8, h: 8.9 },
  { group: 'core', x: 29.1, y: 40.1, w: 7.2, h: 9.6 },
  { group: 'core', x: 72, y: 45.7, w: 8.2, h: 5.1 },
  { group: 'biceps', x: 19.2, y: 35.4, w: 3.8, h: 8.2 },
  { group: 'biceps', x: 39.1, y: 35.4, w: 3.8, h: 8.2 },
  { group: 'triceps', x: 61.9, y: 35.4, w: 3.8, h: 8.2 },
  { group: 'triceps', x: 82.1, y: 35.4, w: 3.8, h: 8.2 },
  { group: 'legs', x: 25.1, y: 54.9, w: 5.2, h: 11.8 },
  { group: 'legs', x: 32.9, y: 54.9, w: 5.2, h: 11.8 },
  { group: 'legs', x: 68.6, y: 54.9, w: 5.2, h: 11.8 },
  { group: 'legs', x: 75.4, y: 54.9, w: 5.2, h: 11.8 },
];

const bodyGroups: BodyMapGroup[] = ['chest', 'back', 'legs', 'shoulder', 'biceps', 'triceps', 'core'];
const bodyGroupSet = new Set<BodyMapGroup>(bodyGroups);

function isBodyMarker(value: unknown): value is BodyMarker {
  const marker = value as Partial<BodyMarker>;
  return (
    typeof marker === 'object' &&
    marker !== null &&
    typeof marker.group === 'string' &&
    bodyGroupSet.has(marker.group as BodyMapGroup) &&
    typeof marker.x === 'number' &&
    typeof marker.y === 'number' &&
    typeof marker.w === 'number' &&
    typeof marker.h === 'number'
  );
}

function readSavedCalibrationMarkers(): BodyMarker[] {
  if (typeof window === 'undefined') return bodyMarkers;

  try {
    const saved = window.localStorage.getItem(calibrationStorageKey);
    if (!saved) return bodyMarkers;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length !== bodyMarkers.length || !parsed.every(isBodyMarker)) {
      return bodyMarkers;
    }

    return parsed;
  } catch {
    return bodyMarkers;
  }
}

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
  const isCalibrationMode =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bodyMapDebug');
  const [calibrationMarkers, setCalibrationMarkers] = useState<BodyMarker[]>(() =>
    isCalibrationMode ? readSavedCalibrationMarkers() : bodyMarkers,
  );
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState('Saved in this browser');
  const visibleMarkers = isCalibrationMode ? calibrationMarkers : bodyMarkers;
  const calibrationOutput = useMemo(
    () =>
      calibrationMarkers
        .map(
          (marker) =>
            `  { group: '${marker.group}', x: ${marker.x}, y: ${marker.y}, w: ${marker.w}, h: ${marker.h} },`,
        )
        .join('\n'),
    [calibrationMarkers],
  );

  useEffect(() => {
    if (!isCalibrationMode || typeof window === 'undefined') return;

    window.localStorage.setItem(calibrationStorageKey, JSON.stringify(calibrationMarkers));
    setCalibrationStatus('Saved in this browser');
  }, [calibrationMarkers, isCalibrationMode]);

  const updateCalibrationMarker = (index: number, nextMarker: BodyMarker) => {
    setCalibrationMarkers((current) =>
      current.map((marker, markerIndex) =>
        markerIndex === index
          ? {
              ...nextMarker,
              x: Number(nextMarker.x.toFixed(1)),
              y: Number(nextMarker.y.toFixed(1)),
              w: Number(Math.max(1, nextMarker.w).toFixed(1)),
              h: Number(Math.max(1, nextMarker.h).toFixed(1)),
            }
          : marker,
      ),
    );
  };

  const moveCalibrationMarker = (index: number, x: number, y: number) => {
    setCalibrationMarkers((current) =>
      current.map((marker, markerIndex) =>
        markerIndex === index
          ? {
              ...marker,
              x: Number(Math.max(0, Math.min(100, x)).toFixed(1)),
              y: Number(Math.max(0, Math.min(100, y)).toFixed(1)),
            }
          : marker,
      ),
    );
  };

  const handleCalibrationMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isCalibrationMode || (event.target as HTMLElement).closest('button')) return;

    const rect = event.currentTarget.getBoundingClientRect();
    moveCalibrationMarker(
      calibrationIndex,
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  };

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
      className={
        isCalibrationMode
          ? 'fixed inset-0 z-[999] flex flex-col overflow-auto bg-white p-4'
          : 'relative flex flex-col rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm'
      }
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
        className={
          isCalibrationMode
            ? 'relative mx-auto mt-3 aspect-square h-auto w-full max-w-[min(92vw,820px)] overflow-hidden rounded-xl bg-[#F2F2F7]'
            : 'relative mx-auto mt-2.5 aspect-square h-auto max-h-[19rem] w-full overflow-hidden rounded-xl bg-[#F2F2F7]'
        }
        onClick={handleCalibrationMapClick}
      >
        <img
          src={bodyMapHumanUrl}
          alt={locale === 'ko' ? '앞면과 뒷면 인체 회복도' : 'Front and back recovery body map'}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_8px_18px_rgba(60,60,67,0.16)]"
          draggable={false}
        />

        {visibleMarkers.map((marker, index) => {
          const stat = getMuscleStat(marker.group);
          const color = recoveryColor(stat.status);
          const isActive = activeGroup === marker.group;
          const isCalibrating = isCalibrationMode && calibrationIndex === index;
          const label = recoveryGroupLabel(marker.group, locale);

          return (
            <button
              key={`${marker.group}-${index}`}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label} ${stat.recoveryPercent}%`}
              onClick={(event) => {
                if (isCalibrationMode) {
                  event.stopPropagation();
                  setCalibrationIndex(index);
                }
                setActiveGroup((current) => (current === marker.group ? null : marker.group));
              }}
              className="absolute rounded-full border transition duration-150 hover:scale-105 active:scale-95"
              style={{
                left: `${marker.x - marker.w / 2}%`,
                top: `${marker.y - marker.h / 2}%`,
                width: `${marker.w}%`,
                height: `${marker.h}%`,
                backgroundColor: `${color}${isActive || isCalibrating ? '80' : '5C'}`,
                borderColor: isCalibrating ? '#007AFF' : `${color}${isActive ? 'F2' : 'D6'}`,
                boxShadow:
                  isActive || isCalibrating
                    ? `0 0 0 4px ${isCalibrating ? '#007AFF' : color}2E, inset 0 0 0 1px rgba(255,255,255,0.82)`
                    : '0 1px 4px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(255,255,255,0.62)',
              }}
            >
              {isCalibrationMode ? (
                <span className="absolute left-1/2 top-1/2 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/25 bg-white px-1.5 text-sm font-black tabular-nums text-[#1C1C1E] shadow-[0_2px_8px_rgba(0,0,0,0.34)]">
                  {index + 1}
                </span>
              ) : null}
            </button>
          );
        })}

        <div className="pointer-events-none absolute bottom-2.5 left-[28.8%] -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-[#6E6E73] shadow-sm">
          FRONT
        </div>
        <div className="pointer-events-none absolute bottom-2.5 left-[72.5%] -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-[#6E6E73] shadow-sm">
          BACK
        </div>
      </div>

      {isCalibrationMode ? (
        <div className="mt-3 rounded-xl border border-[#007AFF]/30 bg-[#F2F8FF] p-3 text-xs text-[#1C1C1E]">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black">Body map calibration</p>
            <button
              type="button"
              className="rounded-full bg-[#007AFF] px-3 py-1 text-[11px] font-black text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(calibrationOutput);
                setCalibrationStatus('Copied final coordinates');
              }}
            >
              Copy markers
            </button>
          </div>
          <p className="mt-1 text-[11px] font-bold text-[#6E6E73]">
            Select a marker, edit x/y/w/h, or tap the body image to move its center.
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-black text-[#007AFF]">{calibrationStatus}</p>
            <button
              type="button"
              className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#FF3B30] shadow-sm ring-1 ring-[#FF3B30]/30"
              onClick={() => {
                window.localStorage.removeItem(calibrationStorageKey);
                setCalibrationMarkers(bodyMarkers);
                setCalibrationIndex(0);
                setCalibrationStatus('Reset to default markers');
              }}
            >
              Reset
            </button>
          </div>
          <select
            className="mt-2 w-full rounded-lg border border-[#C7C7CC] bg-white px-2 py-1.5 font-bold"
            value={calibrationIndex}
            onChange={(event) => setCalibrationIndex(Number(event.target.value))}
          >
            {calibrationMarkers.map((marker, index) => (
              <option key={`${marker.group}-${index}`} value={index}>
                {index + 1}. {marker.group} x:{marker.x} y:{marker.y} w:{marker.w} h:{marker.h}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(['x', 'y', 'w', 'h'] as const).map((field) => (
              <label key={field} className="font-black uppercase text-[#6E6E73]">
                {field}
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-full rounded-lg border border-[#C7C7CC] bg-white px-2 py-1 font-bold text-[#1C1C1E]"
                  value={calibrationMarkers[calibrationIndex][field]}
                  onChange={(event) =>
                    updateCalibrationMarker(calibrationIndex, {
                      ...calibrationMarkers[calibrationIndex],
                      [field]: Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <textarea
            className="mt-2 h-24 w-full rounded-lg border border-[#C7C7CC] bg-white p-2 font-mono text-[10px] leading-4 text-[#1C1C1E]"
            readOnly
            value={calibrationOutput}
          />
        </div>
      ) : null}

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
