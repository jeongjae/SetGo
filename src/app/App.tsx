import { useEffect, useState } from 'react';
import { PwaStatus } from './PwaStatus';
import { AppBottomNav } from './AppBottomNav';
import { CalendarPage } from '../pages/CalendarPage';
import { ExportPage } from '../pages/ExportPage';
import { MorePage } from '../pages/MorePage';
import { RoutineSetupPage } from '../pages/RoutineSetupPage';
import { StatsPage } from '../pages/StatsPage';
import { TodayPage } from '../pages/TodayPage';
import { WorkoutPage } from '../pages/WorkoutPage';
import { getOrCreateTodayWorkout, getOrCreateWorkoutForDate } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { requestPersistentStorage } from '../db/db';

export type AppView = 'today' | 'calendar' | 'stats' | 'more' | 'routines' | 'exercises' | 'weeklyPlan' | 'export' | 'workout';
type WorkoutReturnView = 'today' | 'calendar';
type WorkoutMode = 'active' | 'history-edit';

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
  const [, setLocaleRefreshKey] = useState(0);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);
  const [activeWorkoutSessionId, setActiveWorkoutSessionId] = useState<string | undefined>();
  const [workoutMode, setWorkoutMode] = useState<WorkoutMode>('active');
  const [calendarReviewingWeeklyPlan, setCalendarReviewingWeeklyPlan] = useState(false);
  const [workoutReturnView, setWorkoutReturnView] = useState<WorkoutReturnView>('today');
  const [calendarSelectedDateKey, setCalendarSelectedDateKey] = useState(() => formatDateKey(new Date()));

  function handleRoutineSaved() {
    setRefreshKey((current) => current + 1);
  }

  function handleWorkoutCompleted() {
    setRefreshKey((current) => current + 1);
    setView(workoutReturnView === 'calendar' ? 'calendar' : 'today');
  }

  function handleWorkoutSkipped() {
    setRefreshKey((current) => current + 1);
    setView('calendar');
  }

  function handleWorkoutBack() {
    setView(workoutReturnView === 'calendar' ? 'calendar' : 'today');
  }

  function handleNavigate(nextView: AppView) {
    if (nextView === 'calendar') {
      setCalendarSelectedDateKey(formatDateKey(new Date()));
      setCalendarReviewingWeeklyPlan(false);
    }

    setView(nextView);
  }

  async function handleStartWorkout(routineDayId?: string, dateKey?: string, sessionId?: string, createNew = false) {
    setWorkoutMode('active');
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

  function handleEditHistoricalWorkout(sessionId: string, dateKey: string) {
    setCalendarSelectedDateKey(dateKey);
    setWorkoutReturnView('calendar');
    setWorkoutMode('history-edit');
    setActiveWorkoutSessionId(sessionId);
    setView('workout');
  }

  const content = view === 'routines' || view === 'exercises' || view === 'weeklyPlan'
    ? (
      <RoutineSetupPage
        initialSection={view === 'routines' ? 'routine' : view === 'exercises' ? 'library' : 'schedule'}
        onBack={() => setView('more')}
        onRoutineSaved={handleRoutineSaved}
        onReviewCalendar={() => {
          setCalendarReviewingWeeklyPlan(true);
          setView('calendar');
        }}
      />
    )
    : view === 'calendar'
      ? (
        <CalendarPage
          initialSelectedDateKey={calendarSelectedDateKey}
          onSelectedDateChange={setCalendarSelectedDateKey}
          onStartWorkout={(routineDayId, dateKey, sessionId, createNew) => void handleStartWorkout(routineDayId, dateKey, sessionId, createNew)}
          onEditHistoricalWorkout={handleEditHistoricalWorkout}
          reviewingWeeklyPlan={calendarReviewingWeeklyPlan}
          onReturnToWeeklyPlan={() => setView('weeklyPlan')}
        />
      )
      : view === 'export'
        ? <ExportPage onBack={() => setView('more')} />
        : view === 'stats'
          ? <StatsPage />
          : view === 'more'
            ? <MorePage onNavigate={handleNavigate} onLocaleChanged={() => setLocaleRefreshKey((current) => current + 1)} />
          : view === 'workout'
            ? <WorkoutPage mode={workoutMode} sessionId={activeWorkoutSessionId} onBack={handleWorkoutBack} onCompleted={handleWorkoutCompleted} onSkipped={handleWorkoutSkipped} />
            : <TodayPage refreshKey={refreshKey} onStartWorkout={(routineDayId) => void handleStartWorkout(routineDayId)} />;

  return (
    <main className="app-shell bg-[#131b26] text-slate-100">
      <PwaStatus />
      {content}
      {view !== 'workout' ? <AppBottomNav activeView={view} onNavigate={handleNavigate} /> : null}
    </main>
  );
}
