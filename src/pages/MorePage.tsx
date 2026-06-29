import { Capacitor } from '@capacitor/core';
import { Database, FileDown, Info, Languages, Library } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppView } from '../app/App';
import { IOSListRow, IOSPageHeader } from '../components/IosPrimitives';
import { getStoredLocale, saveStoredLocale, t, type AppLocale } from '../i18n/i18n';
import type { NativeDurabilityProbeResult } from '../storage/nativeDurabilityProbe';
import { triggerSelectionHaptic } from '../utils/haptics';

type MorePageProps = {
  onNavigate: (view: AppView) => void;
  onLocaleChanged: () => void;
};

export function MorePage({ onNavigate, onLocaleChanged }: MorePageProps) {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const [showStorageInfo, setShowStorageInfo] = useState(false);
  const [nativeProbeStatus, setNativeProbeStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [nativeProbeResult, setNativeProbeResult] = useState<NativeDurabilityProbeResult | undefined>();
  const [nativeProbeError, setNativeProbeError] = useState<string | undefined>();
  const isNativeApp = Capacitor.isNativePlatform();

  const [globalGoal, setGlobalGoal] = useState<'hypertrophy' | 'maintenance'>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('setgo-global-goal');
      if (stored === 'maintenance') return 'maintenance';
    }
    return 'hypertrophy';
  });

  useEffect(() => {
    if (!showStorageInfo) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowStorageInfo(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showStorageInfo]);

  function handleLocaleChange(nextLocale: AppLocale) {
    saveStoredLocale(nextLocale);
    setLocale(nextLocale);
    onLocaleChanged();
  }

  function handleGoalChange(nextGoal: 'hypertrophy' | 'maintenance') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('setgo-global-goal', nextGoal);
    }
    setGlobalGoal(nextGoal);
    triggerSelectionHaptic();
  }

  async function handleNativeProbe() {
    setNativeProbeStatus('running');
    setNativeProbeError(undefined);
    try {
      const { runNativeDurabilityProbe } = await import('../storage/nativeDurabilityProbe');
      const result = await runNativeDurabilityProbe();
      setNativeProbeResult(result);
      setNativeProbeStatus('success');
      triggerSelectionHaptic();
    } catch (error) {
      setNativeProbeError(error instanceof Error ? error.message : String(error));
      setNativeProbeStatus('failed');
    }
  }

  const managementRows = [
    {
      view: 'exercises' as AppView,
      icon: Library,
      bg: 'bg-[#FF9500]',
      title: t(locale, 'exerciseLibrary'),
      detail: locale === 'ko' ? '운동 검색, 추가, 변경' : 'Search, add and edit exercises',
    },
  ];

  return (
    <section className="ios-page gap-3.5 px-4 pb-4 pt-3.5">
      <IOSPageHeader
        eyebrow={t(locale, 'more')}
        title={locale === 'ko' ? '관리 및 데이터' : 'Management and Data'}
        action={(
          <button
            type="button"
            aria-label={locale === 'ko' ? '데이터 저장 정보' : 'Data storage information'}
            aria-haspopup="dialog"
            aria-expanded={showStorageInfo}
            onClick={() => setShowStorageInfo(true)}
            className="ios-icon-button"
          >
            <Info aria-hidden="true" size={20} />
          </button>
        )}
      />

      <div className="inner-scroll min-h-0 space-y-4 py-0.5">
        <p className="ios-subtext px-0.5">
          {locale === 'ko'
            ? '운동 라이브러리, 로컬 백업, 언어와 저장소 설정을 관리합니다.'
            : 'Manage the exercise library, local backups, language, and storage.'}
        </p>

        <div className="ios-group overflow-hidden">
          {managementRows.map(({ view, icon, bg, title, detail }) => (
            <IOSListRow
              key={view}
              icon={icon}
              iconClassName={bg}
              title={title}
              detail={detail}
              onClick={() => onNavigate(view)}
            />
          ))}

          <IOSListRow
            icon={FileDown}
            iconClassName="bg-[#34C759]"
            title={t(locale, 'export')}
            detail={locale === 'ko' ? 'Markdown, JSON 백업, CSV 관리' : 'Markdown, JSON backup, CSV management'}
            onClick={() => onNavigate('export')}
          />

          {/* Global Training Goal */}
          <div className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left border-b border-black/[0.04]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF2D55] text-white">
              <span className="text-sm font-bold">🎯</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1C1C1E]">
                {locale === 'ko' ? '훈련 목적 설정' : 'Global Goal'}
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">
                {locale === 'ko' ? '근성장(과부하) vs 유지 관리(피로 조절)' : 'Hypertrophy vs Maintenance'}
              </span>
            </span>
            <div className="flex shrink-0 items-center rounded-xl border border-black/5 bg-[#F2F2F7] p-0.5">
              {(['hypertrophy', 'maintenance'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleGoalChange(item)}
                  className={`min-h-7 rounded-lg px-3 text-xs font-bold transition-all ${
                    globalGoal === item
                      ? 'bg-white font-black text-[#1C1C1E] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {item === 'hypertrophy' ? (locale === 'ko' ? '근성장' : 'Gain') : (locale === 'ko' ? '유지' : 'Keep')}
                </button>
              ))}
            </div>
          </div>

          <div className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8E8E93] text-white">
              <Languages aria-hidden="true" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1C1C1E]">{t(locale, 'language')}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">
                {locale === 'ko' ? '표시 언어' : 'Display language'}
              </span>
            </span>
            <div className="flex shrink-0 items-center rounded-xl border border-black/5 bg-[#F2F2F7] p-0.5">
              {(['ko', 'en'] as AppLocale[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleLocaleChange(item)}
                  className={`min-h-7 rounded-lg px-3 text-xs font-bold transition-all ${
                    locale === item
                      ? 'bg-white font-black text-[#1C1C1E] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {item === 'ko' ? '한국어' : 'EN'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isNativeApp ? (
          <div className="ios-group overflow-hidden">
            <div className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5856D6] text-white">
                <Database aria-hidden="true" size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#1C1C1E]">
                  {locale === 'ko' ? 'Native 저장소 점검' : 'Native Storage Check'}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">
                  {nativeProbeStatus === 'running'
                    ? (locale === 'ko' ? 'SQLite 점검 중...' : 'Checking SQLite...')
                    : nativeProbeStatus === 'success'
                      ? (nativeProbeResult?.previousRun
                        ? (locale === 'ko' ? '이전 실행 데이터 확인됨' : 'Previous run found')
                        : (locale === 'ko' ? '첫 native 기록 저장 완료' : 'First native record saved'))
                      : nativeProbeStatus === 'failed'
                        ? (locale === 'ko' ? '점검 실패' : 'Check failed')
                        : (locale === 'ko' ? '별도 DB에 테스트 기록을 저장/조회합니다' : 'Writes and reads an isolated probe DB')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleNativeProbe()}
                disabled={nativeProbeStatus === 'running'}
                className="min-h-8 rounded-lg bg-[#F2F2F7] px-3 text-xs font-black text-[#1C1C1E] disabled:opacity-50"
              >
                {nativeProbeStatus === 'running' ? (locale === 'ko' ? '확인 중' : 'Checking') : (locale === 'ko' ? '실행' : 'Run')}
              </button>
            </div>
            {nativeProbeResult || nativeProbeError ? (
              <div className="border-t border-black/[0.04] bg-white px-3.5 py-3 text-xs font-semibold leading-relaxed text-[#6E6E73]">
                {nativeProbeResult ? (
                  <p>
                    {locale === 'ko'
                      ? `DB ${nativeProbeResult.database}: 세션 ${nativeProbeResult.currentRun.sessionCount}, 세트 ${nativeProbeResult.currentRun.setCount}, 유산소 ${nativeProbeResult.currentRun.cardioCount}.`
                      : `DB ${nativeProbeResult.database}: ${nativeProbeResult.currentRun.sessionCount} session, ${nativeProbeResult.currentRun.setCount} set, ${nativeProbeResult.currentRun.cardioCount} cardio.`}
                  </p>
                ) : null}
                {nativeProbeResult?.previousRun ? (
                  <p className="mt-1">
                    {locale === 'ko'
                      ? `이전 저장: ${nativeProbeResult.previousRun.writtenAt}`
                      : `Previous write: ${nativeProbeResult.previousRun.writtenAt}`}
                  </p>
                ) : null}
                {nativeProbeError ? <p className="text-[#FF3B30]">{nativeProbeError}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showStorageInfo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
          onClick={() => setShowStorageInfo(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-info-title"
            aria-describedby="storage-info-description"
            className="w-full max-w-xs rounded-3xl border border-black/5 bg-white p-5 shadow-2xl animate-fade-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F3F3] text-accent-dark shadow-sm">
                <Database aria-hidden="true" size={24} />
              </span>
              <h2 id="storage-info-title" className="mt-3 text-base font-black text-[#1C1C1E]">
                {t(locale, 'localData')}
              </h2>
              <p className="mt-0.5 text-xs font-bold text-accent-dark">IndexedDB</p>
              <p id="storage-info-description" className="mt-2 text-sm font-semibold leading-relaxed text-[#6E6E73]">
                {locale === 'ko'
                  ? '저장 데이터는 이 기기에만 보관됩니다. 정기적으로 백업해 주세요.'
                  : 'Your data stays on this device. Create backups regularly.'}
              </p>
              <button
                type="button"
                autoFocus
                onClick={() => setShowStorageInfo(false)}
                className="ios-button-primary mt-4 flex min-h-10 w-full items-center justify-center text-sm"
              >
                {locale === 'ko' ? '확인' : 'OK'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
