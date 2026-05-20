import { useState } from 'react';
import { PwaStatus } from './PwaStatus';
import { CalendarPage } from '../pages/CalendarPage';
import { ExportPage } from '../pages/ExportPage';
import { RoutineSetupPage } from '../pages/RoutineSetupPage';
import { StatsPage } from '../pages/StatsPage';
import { TodayPage } from '../pages/TodayPage';
import { WorkoutPage } from '../pages/WorkoutPage';
import { getOrCreateTodayWorkout, getOrCreateWorkoutForDate } from '../db/workouts';
import { formatDateKey } from '../utils/date';

export type AppView = 'today' | 'calendar' | 'routineSetup' | 'export' | 'stats' | 'workout';
type WorkoutReturnView = 'today' | 'calendar' | 'export';

function describeStartupError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export function App() {
  const [view, setView] = useState<AppView>('today');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeWorkoutSessionId, setActiveWorkoutSessionId] = useState<string | undefined>();
  const [workoutReturnView, setWorkoutReturnView] = useState<WorkoutReturnView>('today');
  const [calendarSelectedDateKey, setCalendarSelectedDateKey] = useState(() => formatDateKey(new Date()));

  function handleRoutineSaved() {
    setRefreshKey((current) => current + 1);
  }

  function handleWorkoutCompleted() {
    setRefreshKey((current) => current + 1);
    setView(workoutReturnView === 'calendar' ? 'calendar' : 'export');
  }

  function handleWorkoutSkipped() {
    setRefreshKey((current) => current + 1);
    setView('calendar');
  }

  function handleWorkoutBack() {
    setView(workoutReturnView === 'calendar' ? 'calendar' : 'today');
  }

  function handleTodayNavigate(nextView: AppView) {
    if (nextView === 'calendar') {
      setCalendarSelectedDateKey(formatDateKey(new Date()));
    }

    setView(nextView);
  }

  async function handleStartWorkout(routineDayId?: string, dateKey?: string, sessionId?: string, createNew = false) {
    if (dateKey) {
      setCalendarSelectedDateKey(dateKey);
      setWorkoutReturnView('calendar');
    } else {
      setWorkoutReturnView('today');
    }

    if (sessionId) {
      setActiveWorkoutSessionId(sessionId);
      setView('workout');
      return;
    }

    try {
      const workout = dateKey
        ? await getOrCreateWorkoutForDate(dateKey, routineDayId, { createNew })
        : await getOrCreateTodayWorkout(routineDayId);
      setActiveWorkoutSessionId(workout.session.id);
      setRefreshKey((current) => current + 1);
      setView('workout');
    } catch (error) {
      console.error('Failed to start workout', describeStartupError(error));
    }
  }

  const content = view === 'routineSetup'
    ? <RoutineSetupPage onBack={() => setView('today')} onRoutineSaved={handleRoutineSaved} />
    : view === 'calendar'
      ? (
        <CalendarPage
          initialSelectedDateKey={calendarSelectedDateKey}
          onBack={() => setView('today')}
          onSelectedDateChange={setCalendarSelectedDateKey}
          onStartWorkout={(routineDayId, dateKey, sessionId, createNew) => void handleStartWorkout(routineDayId, dateKey, sessionId, createNew)}
        />
      )
      : view === 'export'
        ? <ExportPage onBack={() => setView('today')} />
        : view === 'stats'
          ? <StatsPage onBack={() => setView('today')} />
          : view === 'workout'
            ? <WorkoutPage sessionId={activeWorkoutSessionId} onBack={handleWorkoutBack} onCompleted={handleWorkoutCompleted} onSkipped={handleWorkoutSkipped} />
            : <TodayPage refreshKey={refreshKey} onNavigate={handleTodayNavigate} onStartWorkout={(routineDayId) => void handleStartWorkout(routineDayId)} />;

  return (
    <main className="app-shell bg-slate-950 text-slate-100">
      <PwaStatus />
      {content}
    </main>
  );
}
