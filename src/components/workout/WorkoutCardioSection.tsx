import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CardioRecord } from '../../types';
import { triggerSelectionHaptic } from '../../utils/haptics';

type CardioUpdate = Partial<Pick<
  CardioRecord,
  'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo' | 'inclinePercent' | 'isDraft' | 'speedKmh' | 'inclinePct'
>>;

type WorkoutCardioSectionProps = {
  locale: 'ko' | 'en';
  cardioRecords: CardioRecord[];
  loggedCardioCount: number;
  totalCardioDistance: number;
  totalCardioMinutes: number;
  isIndependentRunningWorkout: boolean;
  cardioLabel: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onAddCardio: () => void;
  onMoveCardio?: (direction: -1 | 1) => void;
  onUpdateCardio: (cardioRecord: CardioRecord, values: CardioUpdate) => void;
  onDeleteCardio: (cardioRecord: CardioRecord) => void;
  onSaveCardioAndContinue: (cardioRecord: CardioRecord) => void;
};

export function parseOptionalDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function getCardioMinutes(cardioRecord: CardioRecord): number {
  return Math.max(
    1,
    Math.round((new Date(cardioRecord.endedAt).getTime() - new Date(cardioRecord.startedAt).getTime()) / 60000),
  );
}

function updateCardioMinutes(cardioRecord: CardioRecord, minutes: number): string {
  return new Date(new Date(cardioRecord.startedAt).getTime() + minutes * 60000).toISOString();
}

function getCardioDisplayName(cardioRecord: CardioRecord, locale: 'ko' | 'en'): string {
  const machineLabels: Record<string, string> = {
    treadmill: locale === 'ko' ? '\uD2B8\uB808\uB4DC\uBC00' : 'Treadmill',
    indoor_bike: locale === 'ko' ? '\uC2E4\uB0B4 \uC790\uC804\uAC70' : 'Indoor Bike',
    stair_climber: locale === 'ko' ? '\uCC9C\uAD6D\uC758 \uACC4\uB2E8' : 'Stair Climber',
    elliptical: locale === 'ko' ? '\uC77C\uB9BD\uD2F0\uCEEC' : 'Elliptical',
  };

  if (cardioRecord.environment === 'outdoor') {
    return cardioRecord.location || (locale === 'ko' ? '\uC57C\uC678 \uB7EC\uB2DD/\uD2B8\uB799' : 'Outdoor Running');
  }

  return machineLabels[cardioRecord.machineType || ''] || (locale === 'ko' ? '\uC2E4\uB0B4 \uB7EC\uB2DD' : 'Indoor Running');
}

export function WorkoutCardioSection({
  locale,
  cardioRecords,
  loggedCardioCount,
  totalCardioDistance,
  totalCardioMinutes,
  isIndependentRunningWorkout,
  cardioLabel,
  canMoveUp = false,
  canMoveDown = false,
  onAddCardio,
  onMoveCardio,
  onUpdateCardio,
  onDeleteCardio,
  onSaveCardioAndContinue,
}: WorkoutCardioSectionProps) {
  const [isExpanded, setIsExpanded] = useState(() => cardioRecords.length > 0);

  useEffect(() => {
    if (cardioRecords.length > 0) setIsExpanded(true);
  }, [cardioRecords.length]);

  function handleHeaderAction() {
    if (cardioRecords.length === 0) {
      setIsExpanded(true);
      onAddCardio();
      return;
    }

    setIsExpanded((current) => !current);
  }

  return (
    <section className="shrink-0 space-y-3 ios-card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{cardioLabel}</p>
          <h2 className="mt-0.5 truncate text-base font-black text-[#1C1C1E]">
            {cardioRecords.length === 0 ? (locale === 'ko' ? '\uB7EC\uB2DD' : 'Optional Running') : `${cardioRecords.length} ${cardioLabel}`}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {cardioRecords.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => onMoveCardio?.(-1)}
                disabled={!canMoveUp}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                aria-label={locale === 'ko' ? '\uB7EC\uB2DD \uC704\uB85C \uC774\uB3D9' : 'Move running up'}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                onClick={() => onMoveCardio?.(1)}
                disabled={!canMoveDown}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D1D1D6] bg-white text-[#1C1C1E] transition-all hover:bg-[#F2F2F7] disabled:border-transparent disabled:bg-[#F2F2F7] disabled:text-[#C7C7CC] active:scale-95"
                aria-label={locale === 'ko' ? '\uB7EC\uB2DD \uC544\uB798\uB85C \uC774\uB3D9' : 'Move running down'}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleHeaderAction}
            className={`flex h-11 shrink-0 items-center justify-center transition-all active:scale-95 ${
              cardioRecords.length === 0
                ? 'ios-button-primary w-11'
                : 'rounded-xl px-2 text-xs font-bold uppercase text-[#6E6E73] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]'
            }`}
            aria-expanded={cardioRecords.length > 0 ? isExpanded : undefined}
            aria-label={cardioRecords.length === 0 ? 'Add cardio' : isExpanded ? 'Collapse cardio' : 'Expand cardio'}
          >
            {cardioRecords.length === 0 ? (
              <Plus aria-hidden="true" size={20} />
            ) : (
              <>
                <span>{isExpanded ? (locale === 'ko' ? '\uC811\uAE30' : 'Hide') : (locale === 'ko' ? '\uC5F4\uAE30' : 'Show')}</span>
                <ChevronDown aria-hidden="true" size={16} className={`ml-1 transition-transform ${isExpanded ? 'rotate-180 text-accent-dark' : ''}`} />
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-3 flex flex-col gap-3">
          {loggedCardioCount > 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-[#F2F2F7] px-3.5 py-2.5 text-xs font-bold text-[#1C1C1E]">
              <span>{locale === 'ko' ? '\uC624\uB298 \uB7EC\uB2DD \uC694\uC57D' : 'Running Summary'}</span>
              <span className="font-mono">
                {totalCardioDistance.toFixed(1)} km / {totalCardioMinutes} {locale === 'ko' ? '\uBD84' : 'min'}
              </span>
            </div>
          ) : null}

          {cardioRecords.map((cardioRecord) => {
            const minutes = getCardioMinutes(cardioRecord);

            return (
              <div key={cardioRecord.id} className="rounded-xl border border-black/5 bg-[#F2F2F7] p-3">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-sm">
                      {cardioRecord.environment === 'indoor' ? '\uC2E4\uB0B4' : '\uC57C\uC678'}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-bold text-[#1C1C1E]">
                        {getCardioDisplayName(cardioRecord, locale)}
                      </p>
                      {cardioRecord.isDraft ? (
                        <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold leading-none text-amber-700">
                          {locale === 'ko' ? '\uC785\uB825 \uC911' : 'Draft'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCardio(cardioRecord)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 transition-all duration-200 active:scale-95"
                    aria-label="Delete cardio"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>

                <div className="mb-2.5 flex rounded-xl border border-black/5 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => onUpdateCardio(cardioRecord, { environment: 'indoor', machineType: 'treadmill' })}
                    className={`flex min-h-10 flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      cardioRecord.environment === 'indoor'
                        ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                        : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                    }`}
                  >
                    {locale === 'ko' ? '\uC2E4\uB0B4 \uB7EC\uB2DD' : 'Indoor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateCardio(cardioRecord, { environment: 'outdoor', location: '' })}
                    className={`flex min-h-10 flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      cardioRecord.environment === 'outdoor'
                        ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                        : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                    }`}
                  >
                    {locale === 'ko' ? '\uC57C\uC678 \uB7EC\uB2DD' : 'Outdoor'}
                  </button>
                </div>

                <div className="grid gap-3">
                  {cardioRecord.environment === 'indoor' ? (
                    <label className="text-xs font-bold uppercase text-[#6E6E73]">
                      {locale === 'ko' ? '\uAE30\uAD6C \uC120\uD0DD' : 'Machine Select'}
                      <select
                        aria-label="Cardio machine select"
                        value={cardioRecord.machineType || 'treadmill'}
                        onChange={(event) => onUpdateCardio(cardioRecord, {
                          machineType: event.target.value as CardioRecord['machineType'],
                        })}
                        className="mt-1 min-h-11 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                      >
                        <option value="treadmill">{locale === 'ko' ? '\uD2B8\uB808\uB4DC\uBC00' : 'Treadmill'}</option>
                        <option value="indoor_bike">{locale === 'ko' ? '\uC2E4\uB0B4 \uC790\uC804\uAC70' : 'Indoor Bike'}</option>
                        <option value="stair_climber">{locale === 'ko' ? '\uCC9C\uAD6D\uC758 \uACC4\uB2E8' : 'Stair Climber'}</option>
                        <option value="elliptical">{locale === 'ko' ? '\uC77C\uB9BD\uD2F0\uCEEC' : 'Elliptical'}</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-xs font-bold uppercase text-[#6E6E73]">
                      {locale === 'ko' ? '\uC7A5\uC18C \uC785\uB825' : 'Place'}
                      <input
                        aria-label="Cardio place input"
                        type="text"
                        defaultValue={cardioRecord.location ?? ''}
                        onBlur={(event) => onUpdateCardio(cardioRecord, { location: event.target.value.trim() })}
                        placeholder={locale === 'ko' ? '\uC608: \uB3D9\uB124 \uACF5\uC6D0, \uB7EC\uB2DD \uD2B8\uB799' : 'e.g. Park, track, river'}
                        className="mt-1 min-h-11 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                      />
                    </label>
                  )}

                  <div className="grid gap-2.5 grid-cols-2">
                    <label className="text-xs font-bold uppercase text-[#6E6E73]">
                      Km
                      <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(0, Number(((cardioRecord.distanceKm || 0) - 0.5).toFixed(1)));
                            onUpdateCardio(cardioRecord, { distanceKm: nextVal || undefined });
                          }}
                          className="min-h-11 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                        >
                          -
                        </button>
                        <input
                          aria-label="Cardio distance"
                          type="text"
                          inputMode="decimal"
                          enterKeyHint="done"
                          defaultValue={cardioRecord.distanceKm ?? ''}
                          onBlur={(event) => onUpdateCardio(cardioRecord, {
                            distanceKm: parseOptionalDecimalInput(event.target.value),
                          })}
                          placeholder="0.0"
                          className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Number(((cardioRecord.distanceKm || 0) + 0.5).toFixed(1));
                            onUpdateCardio(cardioRecord, { distanceKm: nextVal });
                          }}
                          className="min-h-11 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <label className="text-xs font-bold uppercase text-[#6E6E73]">
                      {locale === 'ko' ? '\uBD84' : 'Min'}
                      <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(1, minutes - 5);
                            onUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                          }}
                          className="min-h-11 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                        >
                          -
                        </button>
                        <input
                          aria-label="Cardio minutes"
                          type="text"
                          inputMode="numeric"
                          enterKeyHint="done"
                          value={minutes}
                          onChange={(event) => {
                            const value = Math.max(1, Math.round(Number(event.target.value)) || 1);
                            onUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, value) });
                          }}
                          placeholder="min"
                          className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = minutes + 5;
                            onUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                          }}
                          className="min-h-11 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                        >
                          +
                        </button>
                      </div>
                    </label>
                  </div>

                  {/* 2-Column Grid for Speed and Incline with toggles and sliders */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Speed Selector */}
                    <div className="flex flex-col gap-1.5 rounded-xl border border-black/5 bg-white p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#6E6E73]">
                          {locale === 'ko' ? '속도 (km/h)' : 'Speed (km/h)'}
                        </span>
                        <input
                          aria-label="Toggle speed input"
                          type="checkbox"
                          checked={cardioRecord.speedKmh !== undefined}
                          onChange={(e) => {
                            triggerSelectionHaptic();
                            onUpdateCardio(cardioRecord, {
                              speedKmh: e.target.checked ? 8.0 : undefined,
                            });
                          }}
                          className="h-4 w-7 rounded-full bg-[#E5E5EA] transition-all cursor-pointer accent-[#2EC4B6]"
                        />
                      </div>
                      {cardioRecord.speedKmh !== undefined ? (
                        <div className="space-y-1">
                          <input
                            aria-label="Cardio speed slider"
                            type="range"
                            min="0"
                            max="20"
                            step="0.5"
                            value={cardioRecord.speedKmh ?? 8.0}
                            onChange={(e) => {
                              onUpdateCardio(cardioRecord, {
                                speedKmh: parseFloat(e.target.value),
                              });
                            }}
                            className="w-full h-1 bg-[#F2F2F7] rounded-lg appearance-none cursor-pointer accent-[#2EC4B6]"
                          />
                          <input
                            aria-label="Cardio speed text input"
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={cardioRecord.speedKmh ?? ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onUpdateCardio(cardioRecord, {
                                speedKmh: isNaN(val) ? undefined : val,
                              });
                            }}
                            className="w-full text-center text-xs font-black tabular-nums text-[#1C1C1E] bg-[#F2F2F7] rounded-md py-0.5 border border-black/5 outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-center text-[11px] font-bold text-[#8E8E93] py-2.5">
                          {locale === 'ko' ? '입력 안 함' : 'None'}
                        </span>
                      )}
                    </div>

                    {/* Incline Selector */}
                    <div className="flex flex-col gap-1.5 rounded-xl border border-black/5 bg-white p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#6E6E73]">
                          {locale === 'ko' ? '경사 (%)' : 'Incline (%)'}
                        </span>
                        <input
                          aria-label="Toggle incline input"
                          type="checkbox"
                          checked={cardioRecord.inclinePct !== undefined}
                          onChange={(e) => {
                            triggerSelectionHaptic();
                            const nextVal = e.target.checked ? 0 : undefined;
                            onUpdateCardio(cardioRecord, {
                              inclinePct: nextVal,
                              inclinePercent: nextVal,
                            });
                          }}
                          className="h-4 w-7 rounded-full bg-[#E5E5EA] transition-all cursor-pointer accent-[#2EC4B6]"
                        />
                      </div>
                      {cardioRecord.inclinePct !== undefined ? (
                        <div className="space-y-1">
                          <input
                            aria-label="Cardio incline slider"
                            type="range"
                            min="0"
                            max="15"
                            step="1"
                            value={cardioRecord.inclinePct ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateCardio(cardioRecord, {
                                inclinePct: val,
                                inclinePercent: val,
                              });
                            }}
                            className="w-full h-1 bg-[#F2F2F7] rounded-lg appearance-none cursor-pointer accent-[#2EC4B6]"
                          />
                          <input
                            aria-label="Cardio incline text input"
                            type="number"
                            min="0"
                            max="15"
                            step="1"
                            value={cardioRecord.inclinePct ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateCardio(cardioRecord, {
                                inclinePct: isNaN(val) ? undefined : val,
                                inclinePercent: isNaN(val) ? undefined : val,
                              });
                            }}
                            className="w-full text-center text-xs font-black tabular-nums text-[#1C1C1E] bg-[#F2F2F7] rounded-md py-0.5 border border-black/5 outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-center text-[11px] font-bold text-[#8E8E93] py-2.5">
                          {locale === 'ko' ? '입력 안 함' : 'None'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <label className="mt-2.5 block text-xs font-bold uppercase text-[#6E6E73]">
                  {locale === 'ko' ? '\uBA54\uBAA8' : 'Memo'}
                  <input
                    aria-label="Cardio memo"
                    type="text"
                    defaultValue={cardioRecord.memo ?? ''}
                    onBlur={(event) => onUpdateCardio(cardioRecord, { memo: event.target.value.trim() || undefined })}
                    placeholder={locale === 'ko' ? '\uC18D\uB3C4 \uBCC0\uD654, \uCEE8\uB514\uC158 \uD53C\uB4DC\uBC31' : 'e.g. Speed changes, energy feedback'}
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onSaveCardioAndContinue(cardioRecord)}
                  className="ios-button-primary mt-2.5 flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm"
                >
                  <Check aria-hidden="true" size={15} />
                  <span>
                    {cardioRecord.isDraft
                      ? isIndependentRunningWorkout
                        ? locale === 'ko' ? '\uB7EC\uB2DD \uC800\uC7A5' : 'Save running'
                        : locale === 'ko' ? '\uC800\uC7A5' : 'Save'
                      : isIndependentRunningWorkout
                        ? locale === 'ko' ? '\uB7EC\uB2DD \uC800\uC7A5\uB428' : 'Running saved'
                        : locale === 'ko' ? '\uC800\uC7A5' : 'Save'}
                  </span>
                </button>

                {cardioRecord.averageSpeedKmh ? (
                  <p className="mt-3 inline-block rounded-lg border border-[#2EC4B6]/20 bg-[#E8F3F3] px-2.5 py-1.5 text-xs font-bold text-[#159A91]">
                    {locale === 'ko' ? '\uD3C9\uADE0 \uC18D\uB3C4' : 'Average speed'}: <span className="font-mono">{cardioRecord.averageSpeedKmh.toFixed(1)} km/h</span>
                  </p>
                ) : (
                  <p className="mt-3 text-xs font-medium text-[#6E6E73]">
                    {locale === 'ko' ? '\uAC70\uB9AC\uB97C \uC785\uB825\uD558\uBA74 \uD3C9\uADE0 \uC18D\uB3C4\uAC00 \uACC4\uC0B0\uB429\uB2C8\uB2E4.' : 'Enter distance to calculate average speed.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
