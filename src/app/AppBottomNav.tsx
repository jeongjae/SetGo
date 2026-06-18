import { CalendarDays, ClipboardList, Home, MoreHorizontal } from 'lucide-react';
import type { AppView } from './App';
import { getStoredLocale, t } from '../i18n/i18n';

type AppBottomNavProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

type BrowseView = 'today' | 'calendar' | 'records' | 'more';

const navigationItems = [
  { view: 'today', icon: Home, labelKey: 'today' },
  { view: 'calendar', icon: CalendarDays, labelKey: 'planned' },
  { view: 'records', icon: ClipboardList, labelKey: 'records' },
  { view: 'more', icon: MoreHorizontal, labelKey: 'more' },
] as const;

export const primaryNavigationViews = navigationItems.map((item) => item.view);

export function browseActiveView(view: AppView): BrowseView {
  return view === 'routines' || view === 'exercises' || view === 'weeklyPlan' || view === 'export' ? 'more' : view as BrowseView;
}

export function AppBottomNav({ activeView, onNavigate }: AppBottomNavProps) {
  const locale = getStoredLocale();
  const selectedView = browseActiveView(activeView);

  return (
    <nav aria-label="Primary navigation" className="app-bottom-nav mx-auto grid w-full max-w-md shrink-0 grid-cols-4 border-t border-[#D1D1D6] bg-white/90 px-2 pt-1.5 text-[#1C1C1E] shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {navigationItems.map(({ view, icon: Icon, labelKey }) => {
        const active = selectedView === view;

        return (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition-all active:scale-95 ${
              active ? 'text-accent-dark' : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]'
            }`}
          >
            <Icon aria-hidden="true" size={21} className={active ? 'text-accent-dark' : 'text-[#8E8E93]'} />
            <span>{t(locale, labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
