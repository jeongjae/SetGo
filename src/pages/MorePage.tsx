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
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-2.5">
        <div>
          <p className="text-xs font-black uppercase text-cyan-300">{t(locale, 'settings')}</p>
          <h1 className="text-xl font-black text-slate-100">
            {locale === 'ko' ? '설정 및 데이터' : 'Settings and Data'}
          </h1>
        </div>
        <button
          type="button"
          aria-label={locale === 'ko' ? '데이터 저장 정보' : 'Data storage information'}
          aria-haspopup="dialog"
          aria-expanded={showStorageInfo}
          onClick={() => setShowStorageInfo(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750/90 text-cyan-300 shadow-md transition-all hover:bg-slate-650 active:scale-95"
        >
          <Info aria-hidden="true" size={21} />
        </button>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 py-0.5">
        <p className="px-0.5 text-sm font-semibold leading-5 text-slate-200">
          {locale === 'ko'
            ? '루틴, 운동 라이브러리와 로컬 백업을 관리합니다.'
            : 'Manage routines, the exercise library, and local backups.'}
        </p>
        {[
          { view: 'routines' as AppView, icon: Dumbbell, title: t(locale, 'routine'), detail: locale === 'ko' ? '루틴 선택 및 편집' : 'Choose and edit routines' },
          { view: 'exercises' as AppView, icon: Library, title: locale === 'ko' ? '운동 라이브러리' : t(locale, 'exerciseLibrary'), detail: locale === 'ko' ? '운동 검색, 추가, 변경' : 'Search, add and edit exercises' },
          { view: 'weeklyPlan' as AppView, icon: CalendarClock, title: locale === 'ko' ? '운동 사이클 계획' : t(locale, 'weeklyPlan'), detail: locale === 'ko' ? '운동/휴식/러닝 사이클' : 'Workout, rest, and running cycle' },
        ].map(({ view, icon: Icon, title, detail }, index) => (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 text-left shadow-lg transition-all hover:bg-slate-650 active:scale-[0.98]"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${index === 0 ? 'bg-cyan-400 text-slate-950' : 'border border-slate-650 bg-slate-850 text-cyan-300'}`}>
              <Icon aria-hidden="true" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-100">{title}</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-200">{detail}</span>
            </span>
            <ChevronRight aria-hidden="true" size={19} className="text-slate-200" />
          </button>
        ))}

        <button
          type="button"
          onClick={() => onNavigate('export')}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 text-left shadow-lg transition-all hover:bg-slate-650 active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-cyan-300">
            <FileDown aria-hidden="true" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-100">{t(locale, 'export')}</span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-200">
              {locale === 'ko' ? 'Markdown, JSON 백업, CSV 관리' : 'Markdown, JSON backup, CSV management'}
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={19} className="text-slate-200" />
        </button>

        <section className="flex w-full items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-lg">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-cyan-300">
            <Languages aria-hidden="true" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-100">{t(locale, 'language')}</span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-200">
              {locale === 'ko' ? '앱 표시 언어' : 'Display language'}
            </span>
          </span>
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-slate-650 bg-slate-850 p-1">
            {(['ko', 'en'] as AppLocale[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleLocaleChange(item)}
                className={`min-h-8 rounded-md px-2.5 text-xs font-extrabold transition-all active:scale-95 ${
                  locale === item
                    ? 'bg-cyan-400 text-slate-950 font-black shadow-sm'
                    : 'text-slate-100 hover:bg-slate-750 hover:text-slate-100'
                }`}
              >
                {item === 'ko' ? '한국어' : 'EN'}
              </button>
            ))}
          </div>
        </section>

      </div>

      {showStorageInfo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm"
          onClick={() => setShowStorageInfo(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-info-title"
            aria-describedby="storage-info-description"
            className="w-full max-w-sm rounded-2xl border border-slate-650 bg-slate-750 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-emerald-300">
                  <Database aria-hidden="true" size={21} />
                </span>
                <div>
                  <p id="storage-info-title" className="text-sm font-black text-slate-100">{t(locale, 'localData')}</p>
                  <p className="mt-0.5 text-xs font-bold text-emerald-300">IndexedDB</p>
                </div>
              </div>
              <button
                type="button"
                autoFocus
                aria-label={locale === 'ko' ? '닫기' : 'Close'}
                onClick={() => setShowStorageInfo(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-200 transition-all hover:bg-slate-650 hover:text-slate-100 active:scale-95"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>
            <p id="storage-info-description" className="mt-3 text-sm font-semibold leading-6 text-slate-200">
              {locale === 'ko'
                ? '저장 데이터는 이 기기에만 보관됩니다. 정기적으로 백업해 주세요.'
                : 'Your data stays on this device. Create backups regularly.'}
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
