import { BarChart3, CalendarDays, ClipboardCheck, Home, Settings } from 'lucide-react';
import type { AppView } from './App';
import { getStoredLocale, t } from '../i18n/i18n';

type AppBottomNavProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

type BrowseView = 'today' | 'calendar' | 'actuals' | 'stats' | 'more';

const navigationItems = [
  { view: 'today', icon: Home, labelKey: 'today' },
  { view: 'calendar', icon: CalendarDays, labelKey: 'planned' },
  { view: 'actuals', icon: ClipboardCheck, labelKey: 'actuals' },
  { view: 'stats', icon: BarChart3, labelKey: 'stats' },
  { view: 'more', icon: Settings, labelKey: 'settings' },
] as const;

function browseActiveView(view: AppView): BrowseView {
  return view === 'routines' || view === 'exercises' || view === 'weeklyPlan' || view === 'export' ? 'more' : view as BrowseView;
}

export function AppBottomNav({ activeView, onNavigate }: AppBottomNavProps) {
  const locale = getStoredLocale();
  const selectedView = browseActiveView(activeView);

  return (
    <nav aria-label="Primary navigation" className="app-bottom-nav mx-auto grid w-full max-w-md shrink-0 grid-cols-5 border-t border-slate-650 bg-white/95 px-1.5 pt-2 text-slate-100 shadow-[0_-8px_24px_rgba(11,31,51,0.04)] backdrop-blur-md">
      {navigationItems.map(({ view, icon: Icon, labelKey }) => {
        const active = selectedView === view;

        return (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
              active ? 'text-accent-dark' : 'text-slate-350 hover:bg-accent-soft hover:text-text-primary'
            }`}
          >
            {active ? <span className="absolute left-4 right-4 top-0 h-0.5 rounded-full bg-accent" /> : null}
            <Icon aria-hidden="true" size={21} className={active ? 'text-accent-dark' : 'text-slate-350'} />
            <span>{t(locale, labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
