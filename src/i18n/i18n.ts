export type AppLocale = 'ko' | 'en';

export const defaultLocale: AppLocale =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';

export function getStoredLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return defaultLocale;
  const stored = localStorage.getItem('setgo-locale');
  return stored === 'ko' || stored === 'en' ? stored : defaultLocale;
}

export function saveStoredLocale(locale: AppLocale): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('setgo-locale', locale);
  }
}

const messages = {
  ko: {
    activeRoutine: '활성 루틴',
    addExercise: '운동 추가',
    addToRoutine: '루틴에 추가',
    all: '전체',
    backToToday: '오늘로 돌아가기',
    backupJson: '백업',
    backupRestore: '백업 / 복원',
    calendar: '캘린더',
    cardio: '유산소',
    categories: '분류',
    completed: '완료',
    completedExercises: '완료한 운동',
    continueTodayWorkout: '오늘 운동 계속하기',
    continueWorkout: '운동 계속하기',
    copied: '복사 완료',
    copy: '복사',
    customPlan: '사용자 지정 계획',
    date: '날짜',
    deactivate: '비활성화',
    description: '간단 설명',
    downloaded: '저장 완료',
    editExercise: '운동 편집',
    englishName: '영문명',
    exerciseLibrary: '운동 라이브러리',
    exerciseFinder: '운동 찾기',
    exercises: '운동',
    export: '내보내기/가져오기',
    followingWeeklySchedule: '주간 계획을 따릅니다.',
    freeWorkout: '자유 운동',
    inProgress: '진행 중',
    koreanName: '한글명',
    lastWorkout: '최근 운동',
    localData: '로컬 데이터',
    localDataNote: '전체 백업에는 운동 기록, 루틴, 운동 라이브러리, 주간계획, 날짜별 계획이 모두 포함됩니다.',
    markdownWorkoutLog: '마크다운 운동 기록',
    missed: '놓침',
    monthlyWorkoutLog: '월간 운동 기록',
    noActiveRoutine: '아직 활성 루틴이 없습니다',
    noFinishedWorkout: '아직 완료한 운동이 없습니다',
    noMarkdown: '내보낼 마크다운 기록이 없습니다.',
    noRoutineDayPlanned: '계획된 루틴이 없습니다',
    planned: '계획',
    plannedExercises: '계획 운동',
    plannedValues: '계획값은 새 운동 세션에 복사됩니다.',
    planDate: '날짜 계획',
    rest: '휴식',
    restDay: '휴식일',
    restoreCancelled: '복원 취소',
    restoreFailed: '복원 실패',
    restored: '복원 완료',
    restoreJson: '복원',
    routine: '루틴',
    routineDays: '운동 루틴',
    routineSetup: '루틴 설정',
    settings: '설정',
    save: '저장',
    searchExercises: '운동 검색',
    setUpTraining: '운동 설정',
    language: '언어',
    noMatchingExercises: '일치하는 운동이 없습니다.',
    noPlannedExercises: '아직 계획된 운동이 없습니다.',
    routinePlanFor: '이 주간 계획은 현재 활성 루틴에 적용됩니다.',
    stages: '용도',
    startFreeWorkout: '자유 운동 시작',
    startPlannedWorkout: '계획 운동 시작',
    startWorkout: '운동 시작하기',
    stats: '통계',
    today: '오늘',
    todaysPlan: '오늘의 계획',
    totalStrengthVolume: '총 근력 볼륨',
    useWeeklySchedule: '주간 계획 사용',
    workoutSession: '운동 세션',
    workoutSessions: '운동 세션',
    weeklyPlan: '주간 계획',
    resting: '휴식 중...',
    restTime: '휴식 시간',
    skip: '건너뛰기',
    timerFinished: '휴식 완료!',
    
    // Stats Page Strings (Korean)
    statsTitle: '운동 통계',
    statsEmptyTitle: '아직 분석할 운동 기록이 없습니다',
    statsEmptyBody: '운동을 완료하면 주간 볼륨, Hard Set, 근육군별 부하가 자동으로 계산됩니다.',
    statsWorkoutDays: '운동일수',
    statsTotalVolume: '총 볼륨',
    statsTotalSets: '총 세트',
    statsWeekOverWeek: '전주 대비 변화율',
    statsRecentTrend: '최근 8주 추세',
    statsMuscleAnalysis: '근육군별 분석',
    statsPerformance: '운동별 성과',
    statsRecoveryWarnings: '회복/부하 경고',
    statsNoWarnings: '현재 주요 경고는 없습니다.',
    statsAutomaticAnalysis: '자동 분석',
    statsHardSets: 'Hard Set',
    statsHardSetRatio: 'Hard Set 비율',
    statsPeak: '최고',
    statsWeeklyTarget: '주간 목표',
    statsTrendSummary: '추세 요약',
    statsOneRmHistory: '1RM 추세',
    statsVolume: '볼륨',
    statsSets: '세트',
    statsRecommended: '권장',
    statsPerWeek: '세트/주',
    statsRecentWeight: '최근 중량',
    statsBestWeight: '최고 중량',
    statsRecentVolume: '최근 볼륨',
    statsBestVolume: '최고 볼륨',
    statsEstimatedOneRm: '예상 1RM',
    statsNoPerformance: '완료한 운동 세트가 있으면 운동별 성과가 표시됩니다.',
    statsEmptyAnalysis: '운동 기록이 쌓이면 주간 부하와 다음 주 조정 제안을 표시합니다.',
    statsCopyAiPrompt: 'AI 분석용 프롬프트 복사',
    statsAiPromptCopied: '클립보드에 프롬프트가 복사되었습니다! ChatGPT나 Gemini에 붙여넣어 피드백을 받아보세요.',
  },
  en: {
    activeRoutine: 'Active Routine',
    addExercise: 'Add Exercise',
    addToRoutine: 'Add to routine',
    all: 'All',
    backToToday: 'Back to Today',
    backupJson: 'Backup',
    backupRestore: 'Backup / restore',
    calendar: 'Calendar',
    cardio: 'Cardio',
    categories: 'Categories',
    completed: 'Completed',
    completedExercises: 'Completed exercises',
    continueTodayWorkout: 'Continue Today Workout',
    continueWorkout: 'Continue Workout',
    copied: 'Copied',
    copy: 'Copy',
    customPlan: 'Custom plan',
    date: 'Date',
    deactivate: 'Deactivate',
    description: 'Description',
    downloaded: 'Downloaded',
    editExercise: 'Edit Exercise',
    englishName: 'English name',
    exerciseLibrary: 'Exercise Library',
    exerciseFinder: 'Exercise Finder',
    exercises: 'exercises',
    export: 'Export/Restore',
    followingWeeklySchedule: 'Following weekly schedule.',
    freeWorkout: 'Free workout',
    inProgress: 'In progress',
    koreanName: 'Korean name',
    lastWorkout: 'Last Workout',
    localData: 'Local Data',
    localDataNote: 'Full backup includes workout logs, routines, exercise library, weekly plans, and date plans.',
    markdownWorkoutLog: 'Markdown workout log',
    missed: 'Missed',
    monthlyWorkoutLog: 'Monthly workout log',
    noActiveRoutine: 'No active routine yet',
    noFinishedWorkout: 'No finished workout yet',
    noMarkdown: 'No Markdown export available.',
    noRoutineDayPlanned: 'No routine day planned',
    planned: 'Planned',
    plannedExercises: 'Planned Exercises',
    plannedValues: 'Planned values copy into new workout sessions.',
    planDate: 'Plan Date',
    rest: 'Rest',
    restDay: 'Rest day',
    restoreCancelled: 'Restore cancelled',
    restoreFailed: 'Restore failed',
    restored: 'Restored',
    restoreJson: 'Restore',
    routine: 'Routine',
    routineDays: 'Routine Days',
    routineSetup: 'Routine Setup',
    settings: 'Settings',
    save: 'Save',
    searchExercises: 'Search exercises',
    setUpTraining: 'Set up training',
    language: 'Language',
    noMatchingExercises: 'No matching exercises.',
    noPlannedExercises: 'No planned exercises yet.',
    routinePlanFor: 'This weekly plan applies to the active routine.',
    stages: 'Uses',
    startFreeWorkout: 'Start Free Workout',
    startPlannedWorkout: 'Start Planned Workout',
    startWorkout: 'Start Workout',
    stats: 'Stats',
    today: 'Today',
    todaysPlan: "Today's Plan",
    totalStrengthVolume: 'Total strength volume',
    useWeeklySchedule: 'Use weekly schedule',
    workoutSession: 'Workout Session',
    workoutSessions: 'workout sessions',
    weeklyPlan: 'Weekly Plan',
    resting: 'Resting...',
    restTime: 'Rest Time',
    skip: 'Skip',
    timerFinished: 'Rest Finished!',

    // Stats Page Strings (English)
    statsTitle: 'Workout Stats',
    statsEmptyTitle: 'No workout records to analyze yet',
    statsEmptyBody: 'Weekly volume, hard sets, and muscle-group load will be calculated after workouts are completed.',
    statsWorkoutDays: 'Workout days',
    statsTotalVolume: 'Total volume',
    statsTotalSets: 'Total sets',
    statsWeekOverWeek: 'Week over week',
    statsRecentTrend: 'Recent 8-week trend',
    statsMuscleAnalysis: 'Muscle-group analysis',
    statsPerformance: 'Exercise performance',
    statsRecoveryWarnings: 'Recovery/load warnings',
    statsNoWarnings: 'No major warnings right now.',
    statsAutomaticAnalysis: 'Automatic analysis',
    statsHardSets: 'Hard sets',
    statsHardSetRatio: 'Hard set ratio',
    statsPeak: 'Peak',
    statsWeeklyTarget: 'Weekly target',
    statsTrendSummary: 'Trend summary',
    statsOneRmHistory: '1RM trend',
    statsVolume: 'Volume',
    statsSets: 'Sets',
    statsRecommended: 'Recommended',
    statsPerWeek: 'sets/week',
    statsRecentWeight: 'Recent weight',
    statsBestWeight: 'Best weight',
    statsRecentVolume: 'Recent volume',
    statsBestVolume: 'Best volume',
    statsEstimatedOneRm: 'Estimated 1RM',
    statsNoPerformance: 'Exercise performance appears after completed sets are logged.',
    statsEmptyAnalysis: 'Weekly load and next-week adjustment suggestions will appear after workout history accumulates.',
    statsCopyAiPrompt: 'Copy AI Prompt',
    statsAiPromptCopied: 'Prompt copied to clipboard! Paste it into ChatGPT or Gemini to get expert feedback.',
  },
} satisfies Record<AppLocale, Record<string, string>>;

export type MessageKey = keyof typeof messages.ko;

export function t(locale: AppLocale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

export function workoutStatusLabel(locale: AppLocale, status: 'planned' | 'in_progress' | 'completed' | 'skipped'): string {
  if (status === 'completed') return t(locale, 'completed');
  if (status === 'in_progress') return t(locale, 'inProgress');
  if (status === 'skipped') return locale === 'ko' ? '건너뜀' : 'Skipped';
  return t(locale, 'planned');
}

export function timeBandLabel(locale: AppLocale, timeBand: string): string {
  if (locale === 'en') {
    if (timeBand === 'early') return 'Early';
    if (timeBand === 'morning') return 'Morning';
    if (timeBand === 'afternoon') return 'Afternoon';
    if (timeBand === 'evening') return 'Evening';
    return timeBand;
  }

  if (timeBand === 'early') return '새벽';
  if (timeBand === 'morning') return '오전';
  if (timeBand === 'afternoon') return '오후';
  if (timeBand === 'evening') return '저녁';
  return timeBand;
}

export function exerciseCountLabel(locale: AppLocale, count: number): string {
  return locale === 'ko' ? `${count}개 운동` : `${count} exercises`;
}

export function routineNameLabel(locale: AppLocale, routineName?: string): string | undefined {
  if (!routineName || locale === 'en') return routineName;

  const labels: Record<string, string> = {
    '2-Day Upper / Lower': '2분할 상체/하체',
    '3-Day Chest / Back / Legs': '3분할 가슴/등/하체',
    '3-Day Push / Pull / Assist': '3분할 푸시/풀/보충운동',
    '4-Day Upper / Lower': '4분할 상체/하체 (강약)',
  };

  return labels[routineName] ?? routineName;
}
