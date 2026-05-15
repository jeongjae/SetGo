export type ExerciseStage = 'warmup' | 'main' | 'cooldown';

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'shoulder'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'cardio'
  | 'bodyweight'
  | 'mobility';

export type RoutineSplitType =
  | 'upper_lower_2'
  | 'chest_back_legs_3'
  | 'push_pull_assist_3'
  | 'upper_lower_4';

export type WorkoutStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export type WorkoutExerciseStatus = 'planned' | 'completed' | 'skipped';

export type TimeBand = 'early' | 'morning' | 'afternoon' | 'evening';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ExerciseMaster = {
  id: string;
  nameKo: string;
  nameEn?: string;
  stage: ExerciseStage;
  stageTags?: ExerciseStage[];
  category: ExerciseCategory;
  categoryTags?: ExerciseCategory[];
  description?: string;
  defaultEmoji: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Routine = {
  id: string;
  name: string;
  splitType: RoutineSplitType;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoutineDay = {
  id: string;
  routineId: string;
  code: string;
  name: string;
  sequence: number;
};

export type WeeklySchedule = {
  id: string;
  routineId: string;
  weekday: Weekday;
  routineDayId?: string;
  isRestDay: boolean;
};

export type CalendarPlanOverride = {
  id: string;
  date: string;
  routineId: string;
  routineDayId?: string;
  isRestDay: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoutineExercisePlan = {
  id: string;
  routineDayId: string;
  exerciseId: string;
  order: number;
  plannedWeightKg?: number;
  plannedReps?: number;
  plannedSets?: number;
  plannedRir?: number;
  note?: string;
};

export type WorkoutSession = {
  id: string;
  date: string;
  startedAt?: string;
  endedAt?: string;
  timeBand: TimeBand;
  routineId?: string;
  routineDayId?: string;
  status: WorkoutStatus;
  totalStrengthVolumeKg: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutExercise = {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  status: WorkoutExerciseStatus;
  totalVolumeKg: number;
  previousWorkoutExerciseId?: string;
  memo?: string;
};

export type WorkoutSet = {
  id: string;
  workoutExerciseId: string;
  setNo: number;
  weightKg: number;
  reps: number;
  rir?: number;
  isCompleted: boolean;
};

export type CardioRecord = {
  id: string;
  sessionId: string;
  environment: 'indoor' | 'outdoor';
  machineType?: 'treadmill' | 'indoor_bike' | 'trapmill';
  location?: string;
  startedAt: string;
  endedAt: string;
  distanceKm?: number;
  averageSpeedKmh?: number;
  memo?: string;
};
