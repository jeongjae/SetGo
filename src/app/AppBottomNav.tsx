import { BarChart3, CalendarDays, Home, Menu } from 'lucide-react';
import type { AppView } from './App';
import { getStoredLocale, t } from '../i18n/i18n';

type AppBottomNavProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

type BrowseView = 'today' | 'calendar' | 'stats' | 'more';

const navigationItems = [
  { view: 'today', icon: Home, labelKey: 'today' },
  { view: 'calendar', icon: CalendarDays, labelKey: 'calendar' },
  { view: 'stats', icon: BarChart3, labelKey: 'stats' },
  { view: 'more', icon: Menu, labelKey: 'more' },
] as const;

function browseActiveView(view: AppView): BrowseView {
  return view === 'routineSetup' || view === 'export' ? 'more' : view as BrowseView;
}

export function AppBottomNav({ activeView, onNavigate }: AppBottomNavProps) {
  const locale = getStoredLocale();
  const selectedView = browseActiveView(activeView);

  return (
    <nav aria-label="Primary navigation" className="app-bottom-nav mx-auto grid w-full max-w-md shrink-0 grid-cols-4 border-t border-slate-650 bg-[#131b26]/98 px-2 pt-2 text-slate-100 backdrop-blur-md">
      {navigationItems.map(({ view, icon: Icon, labelKey }) => {
        const active = selectedView === view;

        return (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              active ? 'text-cyan-300' : 'text-slate-350 hover:bg-slate-750/60 hover:text-white'
            }`}
          >
            {active ? <span className="absolute left-4 right-4 top-0 h-0.5 rounded-full bg-cyan-400" /> : null}
            <Icon aria-hidden="true" size={21} className={active ? 'text-cyan-300' : 'text-slate-350'} />
            <span>{t(locale, labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
