import { useEffect, useState } from 'react';
import { PwaStatus } from './PwaStatus';
import { AppBottomNav } from './AppBottomNav';
import { CalendarPage } from '../pages/CalendarPage';
import { ExportPage } from '../pages/ExportPage';
import { MorePage } from '../pages/MorePage';
import { RecordsPage } from '../pages/RecordsPage';
import { RoutineSetupPage } from '../pages/RoutineSetupPage';
import { TodayPage } from '../pages/TodayPage';
import { WorkoutPage } from '../pages/WorkoutPage';
import { getOrCreateTodayWorkout, getOrCreateWorkoutForDate, type WorkoutStartKind } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { requestPersistentStorage } from '../db/db';

export type AppView = 'today' | 'calendar' | 'records' | 'more' | 'routines' | 'exercises' | 'weeklyPlan' | 'export' | 'workout';
type WorkoutReturnView = 'today' | 'calendar' | 'records';
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
    setView(workoutReturnView);
  }

  function handleWorkoutSkipped() {
    setRefreshKey((current) => current + 1);
    setView(workoutReturnView);
  }

  function handleWorkoutBack() {
    setView(workoutReturnView);
  }

  function handleNavigate(nextView: AppView) {
    if (nextView === 'calendar' || nextView === 'records') {
      setCalendarSelectedDateKey(formatDateKey(new Date()));
      setCalendarReviewingWeeklyPlan(false);
    }

    setView(nextView);
  }

  async function handleStartWorkout(
    routineDayId?: string,
    dateKey?: string,
    sessionId?: string,
    createNew = false,
    kind: WorkoutStartKind = 'planned',
  ) {
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
        ? await getOrCreateWorkoutForDate(dateKey, routineDayId, { createNew, kind })
        : await getOrCreateTodayWorkout(routineDayId, { createNew, kind });
      setActiveWorkoutSessionId(workout.session.id);
      setRefreshKey((current) => current + 1);
      setView('workout');
    } catch (error) {
      console.error('Failed to start workout', describeStartupError(error));
    }
  }

  function handleEditHistoricalWorkout(sessionId: string, dateKey: string) {
    setCalendarSelectedDateKey(dateKey);
    setWorkoutReturnView('records');
    setWorkoutMode('history-edit');
    setActiveWorkoutSessionId(sessionId);
    setView('workout');
  }

  async function handleAddHistoricalWorkout(dateKey: string, kind: WorkoutStartKind, routineDayId?: string) {
    setCalendarSelectedDateKey(dateKey);
    const todayKey = formatDateKey(new Date());
    setWorkoutReturnView('records');
    setWorkoutMode(dateKey === todayKey ? 'active' : 'history-edit');

    try {
      const workout = await getOrCreateWorkoutForDate(dateKey, routineDayId, {
        createNew: true,
        kind,
      });
      setActiveWorkoutSessionId(workout.session.id);
      setRefreshKey((current) => current + 1);
      setView('workout');
    } catch (error) {
      console.error('Failed to add historical workout', describeStartupError(error));
    }
  }

  const content = view === 'routines' || view === 'exercises' || view === 'weeklyPlan'
    ? (
      <RoutineSetupPage
        initialSection={view === 'routines' ? 'routine' : view === 'exercises' ? 'library' : 'schedule'}
        onBack={() => setView('more')}
        onRoutineSaved={handleRoutineSaved}
        onReviewCalendar={(dateKey) => {
          setCalendarSelectedDateKey(dateKey);
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
          reviewingWeeklyPlan={calendarReviewingWeeklyPlan}
          onReturnToWeeklyPlan={() => setView('weeklyPlan')}
          onNavigateToRecords={() => setView('records')}
          onNavigateToRoutines={() => setView('routines')}
        />
      )
      : view === 'records'
        ? (
          <RecordsPage
            initialSelectedDateKey={calendarSelectedDateKey}
            onSelectedDateChange={setCalendarSelectedDateKey}
            onAddHistoricalWorkout={(dateKey, kind, routineDayId) => void handleAddHistoricalWorkout(dateKey, kind, routineDayId)}
            onEditHistoricalWorkout={handleEditHistoricalWorkout}
          />
        )
      : view === 'export'
        ? <ExportPage onBack={() => setView('more')} />
        : view === 'more'
            ? <MorePage onNavigate={handleNavigate} onLocaleChanged={() => setLocaleRefreshKey((current) => current + 1)} />
          : view === 'workout'
            ? <WorkoutPage mode={workoutMode} sessionId={activeWorkoutSessionId} onBack={handleWorkoutBack} onCompleted={handleWorkoutCompleted} onSkipped={handleWorkoutSkipped} />
            : <TodayPage
              refreshKey={refreshKey}
              onStartWorkout={(routineDayId, sessionId, createNew, kind) => void handleStartWorkout(routineDayId, undefined, sessionId, createNew, kind)}
            />;

  return (
    <main className="app-shell ios-screen">
      <PwaStatus />
      {content}
      {view !== 'workout' ? <AppBottomNav activeView={view} onNavigate={handleNavigate} /> : null}
    </main>
  );
}
