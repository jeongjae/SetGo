import { BarChart3, CalendarRange } from 'lucide-react';
import { useState } from 'react';
import { ActualsPage } from './ActualsPage';
import { StatsPage } from './StatsPage';
import { IOSSegmentedControl } from '../components/IosPrimitives';
import type { WorkoutStartKind } from '../db/workouts';
import { getStoredLocale, t } from '../i18n/i18n';

type RecordsPageProps = {
  initialSelectedDateKey?: string;
  onSelectedDateChange?: (dateKey: string) => void;
  onAddHistoricalWorkout: (dateKey: string, kind: WorkoutStartKind, routineDayId?: string) => void;
  onEditHistoricalWorkout: (sessionId: string, dateKey: string) => void;
};

export type RecordsSubView = 'actuals' | 'stats';

export const recordsSubViews: RecordsSubView[] = ['actuals', 'stats'];

export function RecordsPage({
  initialSelectedDateKey,
  onSelectedDateChange,
  onAddHistoricalWorkout,
  onEditHistoricalWorkout,
}: RecordsPageProps) {
  const [locale] = useState(() => getStoredLocale());
  const [subView, setSubView] = useState<RecordsSubView>('actuals');
  const recordModeControl = (
    <IOSSegmentedControl
      value={subView}
      onChange={setSubView}
      columns={2}
      options={recordsSubViews.map((view) => ({
        value: view,
        icon: view === 'actuals' ? CalendarRange : BarChart3,
        label: view === 'actuals' ? t(locale, 'recordsCalendar') : t(locale, 'recordsAnalysis'),
      }))}
    />
  );

  if (subView === 'stats') {
    return <StatsPage onOpenActuals={() => setSubView('actuals')} recordModeControl={recordModeControl} />;
  }

  return (
    <ActualsPage
      initialSelectedDateKey={initialSelectedDateKey}
      onSelectedDateChange={onSelectedDateChange}
      onAddHistoricalWorkout={onAddHistoricalWorkout}
      onEditHistoricalWorkout={onEditHistoricalWorkout}
      onOpenStats={() => setSubView('stats')}
      recordModeControl={recordModeControl}
    />
  );
}
