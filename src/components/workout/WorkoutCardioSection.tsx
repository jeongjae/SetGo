import { Check, Plus, Trash2 } from 'lucide-react';
import type { CardioRecord } from '../../types';

type CardioUpdate = Partial<Pick<
  CardioRecord,
  'environment' | 'machineType' | 'location' | 'startedAt' | 'endedAt' | 'distanceKm' | 'memo' | 'inclinePercent' | 'isDraft'
>>;

type WorkoutCardioSectionProps = {
  locale: 'ko' | 'en';
  cardioRecords: CardioRecord[];
  loggedCardioCount: number;
  totalCardioDistance: number;
  totalCardioMinutes: number;
  isIndependentRunningWorkout: boolean;
  cardioLabel: string;
  onAddCardio: () => void;
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
    treadmill: locale === 'ko' ? '트레드밀' : 'Treadmill',
    indoor_bike: locale === 'ko' ? '실내 자전거' : 'Indoor Bike',
    stair_climber: locale === 'ko' ? '천국의 계단' : 'Stair Climber',
    elliptical: locale === 'ko' ? '일립티컬' : 'Elliptical',
  };

  if (cardioRecord.environment === 'outdoor') {
    return cardioRecord.location || (locale === 'ko' ? '야외 러닝/트랙' : 'Outdoor Running');
  }

  return machineLabels[cardioRecord.machineType || ''] || (locale === 'ko' ? '실내 러닝' : 'Indoor Running');
}

export function WorkoutCardioSection({
  locale,
  cardioRecords,
  loggedCardioCount,
  totalCardioDistance,
  totalCardioMinutes,
  isIndependentRunningWorkout,
  cardioLabel,
  onAddCardio,
  onUpdateCardio,
  onDeleteCardio,
  onSaveCardioAndContinue,
}: WorkoutCardioSectionProps) {
  return (
    <section className="shrink-0 ios-card p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#8E8E93]">{cardioLabel}</p>
          <h2 className="mt-0.5 text-base font-black text-[#1C1C1E]">
            {cardioRecords.length === 0 ? (locale === 'ko' ? '러닝' : 'Optional Running') : `${cardioRecords.length} ${cardioLabel}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onAddCardio}
          className="ios-button-primary flex h-10 w-10 items-center justify-center shrink-0"
          aria-label="Add cardio"
        >
          <Plus aria-hidden="true" size={20} />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {loggedCardioCount > 0 ? (
          <div className="flex items-center justify-between rounded-xl bg-[#F2F2F7] border border-black/5 px-3.5 py-2.5 text-xs font-bold text-[#1C1C1E]">
            <span>{locale === 'ko' ? '오늘 러닝 요약' : 'Running Summary'}</span>
            <span className="font-mono">
              {totalCardioDistance.toFixed(1)} km / {totalCardioMinutes} {locale === 'ko' ? '분' : 'min'}
            </span>
          </div>
        ) : null}

        {cardioRecords.map((cardioRecord) => {
          const minutes = getCardioMinutes(cardioRecord);

          return (
            <div key={cardioRecord.id} className="rounded-xl border border-black/5 bg-[#F2F2F7] p-3">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">
                    {cardioRecord.environment === 'indoor' ? '실내' : '야외'}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#1C1C1E]">
                      {getCardioDisplayName(cardioRecord, locale)}
                    </p>
                    {cardioRecord.isDraft ? (
                      <span className="mt-0.5 inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-750">
                        {locale === 'ko' ? '입력 중' : 'Draft'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteCardio(cardioRecord)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 transition-all active:scale-95 duration-200"
                  aria-label="Delete cardio"
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </div>

              <div className="mb-2.5 flex rounded-xl bg-white p-0.5 border border-black/5">
                <button
                  type="button"
                  onClick={() => onUpdateCardio(cardioRecord, { environment: 'indoor', machineType: 'treadmill' })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 ${
                    cardioRecord.environment === 'indoor'
                      ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {locale === 'ko' ? '실내 러닝' : 'Indoor'}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCardio(cardioRecord, { environment: 'outdoor', location: '' })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 ${
                    cardioRecord.environment === 'outdoor'
                      ? 'bg-[#F2F2F7] text-[#1C1C1E] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {locale === 'ko' ? '야외 러닝' : 'Outdoor'}
                </button>
              </div>

              <div className="grid gap-3">
                {cardioRecord.environment === 'indoor' ? (
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {locale === 'ko' ? '기구 선택' : 'Machine Select'}
                    <select
                      aria-label="Cardio machine select"
                      value={cardioRecord.machineType || 'treadmill'}
                      onChange={(event) => onUpdateCardio(cardioRecord, {
                        machineType: event.target.value as CardioRecord['machineType'],
                      })}
                      className="mt-1 min-h-10 w-full rounded-xl border border-[#D1D1D6] bg-white px-3 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    >
                      <option value="treadmill">{locale === 'ko' ? '트레드밀' : 'Treadmill'}</option>
                      <option value="indoor_bike">{locale === 'ko' ? '실내 자전거' : 'Indoor Bike'}</option>
                      <option value="stair_climber">{locale === 'ko' ? '천국의 계단' : 'Stair Climber'}</option>
                      <option value="elliptical">{locale === 'ko' ? '일립티컬' : 'Elliptical'}</option>
                    </select>
                  </label>
                ) : (
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {locale === 'ko' ? '장소 입력' : 'Place'}
                    <input
                      aria-label="Cardio place input"
                      type="text"
                      defaultValue={cardioRecord.location ?? ''}
                      onBlur={(event) => onUpdateCardio(cardioRecord, { location: event.target.value.trim() })}
                      placeholder={locale === 'ko' ? '예: 동네 공원, 러닝 트랙' : 'e.g. Park, track, river'}
                      className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                    />
                  </label>
                )}

                <div className={`grid gap-2.5 ${cardioRecord.environment === 'indoor' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    Km
                    <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(0, Number(((cardioRecord.distanceKm || 0) - 0.5).toFixed(1)));
                          onUpdateCardio(cardioRecord, { distanceKm: nextVal || undefined });
                        }}
                        className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
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
                        className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                      >
                        +
                      </button>
                    </div>
                  </label>

                  <label className="text-xs font-bold uppercase text-[#6E6E73]">
                    {locale === 'ko' ? '분' : 'Min'}
                    <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, minutes - 5);
                          onUpdateCardio(cardioRecord, { endedAt: updateCardioMinutes(cardioRecord, nextVal) });
                        }}
                        className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
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
                        className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                      >
                        +
                      </button>
                    </div>
                  </label>

                  {cardioRecord.environment === 'indoor' ? (
                    <label className="text-xs font-bold uppercase text-[#6E6E73]">
                      {locale === 'ko' ? '경사 (%)' : 'Inc (%)'}
                      <div className="mt-1 grid grid-cols-[2rem_1fr_2rem] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white focus-within:border-[#2EC4B6]">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(0, (cardioRecord.inclinePercent || 0) - 1);
                            onUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                          }}
                          className="min-h-10 text-sm font-bold text-[#6E6E73] hover:text-[#1C1C1E] active:bg-[#F2F2F7]"
                        >
                          -
                        </button>
                        <input
                          aria-label="Cardio incline"
                          type="text"
                          inputMode="numeric"
                          enterKeyHint="done"
                          value={cardioRecord.inclinePercent ?? ''}
                          onChange={(event) => {
                            const value = event.target.value === '' ? undefined : Number(event.target.value) || 0;
                            onUpdateCardio(cardioRecord, { inclinePercent: value });
                          }}
                          placeholder="%"
                          className="min-w-0 bg-transparent px-1 py-2 text-center text-sm font-bold text-[#1C1C1E] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = (cardioRecord.inclinePercent || 0) + 1;
                            onUpdateCardio(cardioRecord, { inclinePercent: nextVal });
                          }}
                          className="min-h-10 text-sm font-bold text-[#159A91] hover:text-[#2EC4B6] active:bg-[#F2F2F7]"
                        >
                          +
                        </button>
                      </div>
                    </label>
                  ) : null}
                </div>
              </div>

              <label className="mt-2.5 block text-xs font-bold uppercase text-[#6E6E73]">
                {locale === 'ko' ? '메모' : 'Memo'}
                <input
                  aria-label="Cardio memo"
                  type="text"
                  defaultValue={cardioRecord.memo ?? ''}
                  onBlur={(event) => onUpdateCardio(cardioRecord, { memo: event.target.value.trim() || undefined })}
                  placeholder={locale === 'ko' ? '속도 변화, 컨디션 피드백' : 'e.g. Speed changes, energy feedback'}
                  className="mt-1 w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#2EC4B6]"
                />
              </label>

              <button
                type="button"
                onClick={() => onSaveCardioAndContinue(cardioRecord)}
                className="ios-button-primary flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm mt-2.5"
              >
                <Check aria-hidden="true" size={15} />
                <span>
                  {cardioRecord.isDraft
                    ? isIndependentRunningWorkout
                      ? locale === 'ko' ? '러닝 저장' : 'Save running'
                      : locale === 'ko' ? '기록하고 운동 계속' : 'Log cardio and continue'
                    : isIndependentRunningWorkout
                      ? locale === 'ko' ? '러닝 저장됨' : 'Running saved'
                      : locale === 'ko' ? '운동 기록 계속' : 'Continue workout log'}
                </span>
              </button>

              {cardioRecord.averageSpeedKmh ? (
                <p className="mt-3 text-xs font-bold text-[#159A91] bg-[#E8F3F3] border border-[#2EC4B6]/20 rounded-lg px-2.5 py-1.5 inline-block">
                  {locale === 'ko' ? '평균 속도' : 'Average speed'}: <span className="font-mono">{cardioRecord.averageSpeedKmh.toFixed(1)} km/h</span>
                </p>
              ) : (
                <p className="mt-3 text-xs font-medium text-[#6E6E73]">
                  {locale === 'ko' ? '거리를 입력하면 평균 속도가 계산됩니다.' : 'Enter distance to calculate average speed.'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
