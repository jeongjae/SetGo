import { useState } from 'react';
import { PwaStatus } from './PwaStatus';
import { CalendarPage } from '../pages/CalendarPage';
import { ExportPage } from '../pages/ExportPage';
import { RoutineSetupPage } from '../pages/RoutineSetupPage';
import { StatsPage } from '../pages/StatsPage';
import { TodayPage } from '../pages/TodayPage';
import { WorkoutPage } from '../pages/WorkoutPage';
import { getOrCreateTodayWorkout } from '../db/workouts';

export type AppView = 'today' | 'calendar' | 'routineSetup' | 'export' | 'stats' | 'workout';

export function App() {
  const [view, setView] = useState<AppView>('today');
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRoutineSaved() {
    setRefreshKey((current) => current + 1);
  }

  function handleWorkoutCompleted() {
    setRefreshKey((current) => current + 1);
    setView('export');
  }

  function handleWorkoutSkipped() {
    setRefreshKey((current) => current + 1);
    setView('calendar');
  }

  async function handleStartWorkout(routineDayId?: string) {
    await getOrCreateTodayWorkout(routineDayId);
    setRefreshKey((current) => current + 1);
    setView('workout');
  }

  const content = view === 'routineSetup'
    ? <RoutineSetupPage onBack={() => setView('today')} onRoutineSaved={handleRoutineSaved} />
    : view === 'calendar'
      ? <CalendarPage onBack={() => setView('today')} onStartWorkout={(routineDayId) => void handleStartWorkout(routineDayId)} />
      : view === 'export'
        ? <ExportPage onBack={() => setView('today')} />
        : view === 'stats'
          ? <StatsPage onBack={() => setView('today')} />
          : view === 'workout'
            ? <WorkoutPage onBack={() => setView('today')} onCompleted={handleWorkoutCompleted} onSkipped={handleWorkoutSkipped} />
            : <TodayPage refreshKey={refreshKey} onNavigate={setView} onStartWorkout={(routineDayId) => void handleStartWorkout(routineDayId)} />;

  return (
    <main className="app-shell bg-slate-950 text-slate-100">
      <PwaStatus />
      {content}
    </main>
  );
}
