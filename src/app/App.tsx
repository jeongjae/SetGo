import { Suspense, lazy, useEffect, useState } from 'react';
import { PwaStatus } from './PwaStatus';
import { AppBottomNav } from './AppBottomNav';
import { getOrCreateTodayWorkout, getOrCreateWorkoutForDate, type WorkoutStartKind } from '../db/workouts';
import { formatDateKey } from '../utils/date';
import { requestPersistentStorage } from '../db/db';
import { getStoredLocale } from '../i18n/i18n';
import type { WorkoutRecommendationSnapshot } from '../types';

const CalendarPage = lazy(() => import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const ExportPage = lazy(() => import('../pages/ExportPage').then((module) => ({ default: module.ExportPage })));
const MorePage = lazy(() => import('../pages/MorePage').then((module) => ({ default: module.MorePage })));
const RecordsPage = lazy(() => import('../pages/RecordsPage').then((module) => ({ default: module.RecordsPage })));
const RoutineSetupPage = lazy(() => import('../pages/RoutineSetupPage').then((module) => ({ default: module.RoutineSetupPage })));
const TodayPage = lazy(() => import('../pages/TodayPage').then((module) => ({ default: module.TodayPage })));
const WorkoutPage = lazy(() => import('../pages/WorkoutPage').then((module) => ({ default: module.WorkoutPage })));

export type AppView = 'today' | 'calendar' | 'records' | 'more' | 'routines' | 'exercises' | 'weeklyPlan' | 'export' | 'workout';
export type WorkoutReturnView = 'today' | 'calendar' | 'records';
export type WorkoutMode = 'active' | 'history-edit';

export function shouldResetCalendarContextOnNavigate(nextView: AppView): boolean {
  return nextView === 'calendar' || nextView === 'records';
}

export function workoutReturnViewForStart(dateKey?: string): WorkoutReturnView {
  return dateKey ? 'calendar' : 'today';
}

export function workoutModeForHistoricalAdd(dateKey: string, todayKey: string): WorkoutMode {
  return dateKey === todayKey ? 'active' : 'history-edit';
}

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

  useEffect(() => {
    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--setgo-viewport-height', `${viewportHeight}px`);
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
    };
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
    if (shouldResetCalendarContextOnNavigate(nextView)) {
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
    recommendationSnapshot?: WorkoutRecommendationSnapshot,
  ) {
    setWorkoutMode('active');
    if (dateKey) {
      setCalendarSelectedDateKey(dateKey);
      setWorkoutReturnView(workoutReturnViewForStart(dateKey));
    } else {
      setWorkoutReturnView(workoutReturnViewForStart());
    }

    if (sessionId) {
      setActiveWorkoutSessionId(sessionId);
      setView('workout');
      return;
    }

    try {
      const workout = dateKey
        ? await getOrCreateWorkoutForDate(dateKey, routineDayId, { createNew, kind, recommendationSnapshot })
        : await getOrCreateTodayWorkout(routineDayId, { createNew, kind, recommendationSnapshot });
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
    setWorkoutMode(workoutModeForHistoricalAdd(dateKey, todayKey));

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
              onStartWorkout={(routineDayId, sessionId, createNew, kind, recommendationSnapshot) => void handleStartWorkout(routineDayId, undefined, sessionId, createNew, kind, recommendationSnapshot)}
            />;
  const loadingLabel = getStoredLocale() === 'ko' ? '불러오는 중...' : 'Loading...';

  return (
    <main className="app-shell ios-screen">
      <PwaStatus />
      <Suspense fallback={<div className="ios-page items-center justify-center text-sm font-bold text-[#6E6E73]">{loadingLabel}</div>}>
        {content}
      </Suspense>
      {view !== 'workout' ? <AppBottomNav activeView={view} onNavigate={handleNavigate} /> : null}
    </main>
  );
}
