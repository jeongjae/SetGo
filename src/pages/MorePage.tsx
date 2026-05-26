import { ChevronRight, Database, Dumbbell, FileDown, Languages } from 'lucide-react';
import { useState } from 'react';
import { getStoredLocale, saveStoredLocale, t, type AppLocale } from '../i18n/i18n';
import type { AppView } from '../app/App';

type MorePageProps = {
  onNavigate: (view: AppView) => void;
  onLocaleChanged: () => void;
};

export function MorePage({ onNavigate, onLocaleChanged }: MorePageProps) {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());

  function handleLocaleChange(nextLocale: AppLocale) {
    saveStoredLocale(nextLocale);
    setLocale(nextLocale);
    onLocaleChanged();
  }

  return (
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <div>
          <p className="text-xs font-black uppercase text-cyan-300">{t(locale, 'settings')}</p>
          <h1 className="text-xl font-black text-white">
            {locale === 'ko' ? '설정 및 데이터' : 'Settings and Data'}
          </h1>
        </div>
      </header>

      <div className="inner-scroll min-h-0 space-y-2.5 py-0.5">
        <p className="px-0.5 text-sm font-semibold leading-5 text-slate-200">
          {locale === 'ko'
            ? '루틴, 운동 라이브러리와 로컬 백업을 관리합니다.'
            : 'Manage routines, the exercise library, and local backups.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('routineSetup')}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 text-left shadow-lg transition-all hover:bg-slate-650 active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950">
            <Dumbbell aria-hidden="true" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">{t(locale, 'routineSetup')}</span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-200">
              {locale === 'ko' ? '루틴, 운동 목록, 주간 계획' : 'Routines, exercises, weekly plan'}
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={19} className="text-slate-200" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('export')}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 text-left shadow-lg transition-all hover:bg-slate-650 active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-850 text-cyan-300">
            <FileDown aria-hidden="true" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">{t(locale, 'export')}</span>
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
            <span className="block text-sm font-black text-white">{t(locale, 'language')}</span>
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
                    : 'text-slate-100 hover:bg-slate-750 hover:text-white'
                }`}
              >
                {item === 'ko' ? '한국어' : 'EN'}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-lg">
          <Database aria-hidden="true" size={19} className="shrink-0 text-emerald-300" />
          <div>
            <p className="text-xs font-black text-white">{t(locale, 'localData')} · IndexedDB</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-200">
              {locale === 'ko'
                ? '저장 데이터는 이 기기에만 보관됩니다. 정기적으로 백업해 주세요.'
                : 'Your data stays on this device. Create backups regularly.'}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
