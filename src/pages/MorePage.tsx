import { CalendarClock, ChevronRight, Database, Dumbbell, FileDown, Info, Languages, Library, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredLocale, saveStoredLocale, t, type AppLocale } from '../i18n/i18n';
import type { AppView } from '../app/App';

type MorePageProps = {
  onNavigate: (view: AppView) => void;
  onLocaleChanged: () => void;
};

export function MorePage({ onNavigate, onLocaleChanged }: MorePageProps) {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const [showStorageInfo, setShowStorageInfo] = useState(false);

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

  return (
    <section className="ios-page gap-3.5 px-4 pb-4 pt-3.5">
      <header className="ios-page-header">
        <div>
          <p className="ios-eyebrow">{t(locale, 'more')}</p>
          <h1 className="ios-title">
            {locale === 'ko' ? '관리 및 데이터' : 'Management and Data'}
          </h1>
        </div>
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
      </header>

      <div className="inner-scroll min-h-0 space-y-4 py-0.5">
        <p className="ios-subtext px-0.5">
          {locale === 'ko'
            ? '루틴, 운동 라이브러리와 로컬 백업을 관리합니다.'
            : 'Manage routines, the exercise library, and local backups.'}
        </p>

        <div className="ios-group overflow-hidden">
          {[
            { view: 'routines' as AppView, icon: Dumbbell, bg: 'bg-[#007AFF]', title: t(locale, 'routine'), detail: locale === 'ko' ? '루틴 선택 및 편집' : 'Choose and edit routines' },
            { view: 'exercises' as AppView, icon: Library, bg: 'bg-[#FF9500]', title: locale === 'ko' ? '운동 라이브러리' : t(locale, 'exerciseLibrary'), detail: locale === 'ko' ? '운동 검색, 추가, 변경' : 'Search, add and edit exercises' },
            { view: 'weeklyPlan' as AppView, icon: CalendarClock, bg: 'bg-[#5856D6]', title: locale === 'ko' ? '운동 사이클 계획' : t(locale, 'weeklyPlan'), detail: locale === 'ko' ? '운동/휴식/러닝 사이클' : 'Workout, rest, and running cycle' },
          ].map(({ view, icon: Icon, bg, title, detail }) => (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left transition-all active:bg-[#F2F2F7]"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${bg}`}>
                <Icon aria-hidden="true" size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#1C1C1E]">{title}</span>
                <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">{detail}</span>
              </span>
              <ChevronRight aria-hidden="true" size={16} className="text-[#C7C7CC]" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => onNavigate('export')}
            className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left transition-all active:bg-[#F2F2F7]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#34C759] text-white">
              <FileDown aria-hidden="true" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1C1C1E]">{t(locale, 'export')}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">
                {locale === 'ko' ? 'Markdown, JSON 백업, CSV 관리' : 'Markdown, JSON backup, CSV management'}
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={16} className="text-[#C7C7CC]" />
          </button>

          <div className="ios-row flex w-full items-center gap-3 bg-white p-3.5 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8E8E93] text-white">
              <Languages aria-hidden="true" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1C1C1E]">{t(locale, 'language')}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#8E8E93]">
                {locale === 'ko' ? '앱 표시 언어' : 'Display language'}
              </span>
            </span>
            <div className="flex shrink-0 items-center rounded-xl bg-[#F2F2F7] p-0.5 border border-black/5">
              {(['ko', 'en'] as AppLocale[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleLocaleChange(item)}
                  className={`min-h-7 rounded-lg px-3 text-xs font-bold transition-all ${
                    locale === item
                      ? 'bg-white text-[#1C1C1E] shadow-sm font-black'
                      : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {item === 'ko' ? '한국어' : 'EN'}
                </button>
              ))}
            </div>
          </div>
        </div>

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
                className="mt-4 flex min-h-10 w-full items-center justify-center rounded-xl bg-accent-dark font-bold text-white transition-all active:scale-95"
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
