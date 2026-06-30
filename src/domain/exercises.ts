import type { ExerciseCategory, ExerciseMaster, ExerciseProgressionStyle, ExerciseStage } from '../types';

export const exerciseCategoryOptions: Array<{ label: string; labelKo: string; value: ExerciseCategory }> = [
  { label: 'Chest', labelKo: '가슴', value: 'chest' },
  { label: 'Back', labelKo: '등', value: 'back' },
  { label: 'Shoulder', labelKo: '어깨', value: 'shoulder' },
  { label: 'Biceps', labelKo: '이두', value: 'biceps' },
  { label: 'Triceps', labelKo: '삼두', value: 'triceps' },
  { label: 'Legs', labelKo: '하체', value: 'legs' },
  { label: 'Cardio', labelKo: '유산소', value: 'cardio' },
  { label: 'Bodyweight', labelKo: '맨손', value: 'bodyweight' },
  { label: 'Mobility', labelKo: '가동성', value: 'mobility' },
];

export const exerciseStageOptions: Array<{ label: string; labelKo: string; value: ExerciseStage }> = [
  { label: 'Warm-up', labelKo: '준비운동', value: 'warmup' },
  { label: 'Main', labelKo: '본운동', value: 'main' },
  { label: 'Cooldown', labelKo: '마무리', value: 'cooldown' },
];

export const exerciseProgressionStyleOptions: Array<{ label: string; labelKo: string; value: ExerciseProgressionStyle }> = [
  { label: 'Compound', labelKo: '복합운동', value: 'compound' },
  { label: 'Isolation', labelKo: '고립운동', value: 'isolation' },
  { label: 'Bodyweight', labelKo: '맨몸운동', value: 'bodyweight' },
  { label: 'Stable', labelKo: '유지형', value: 'stable' },
];

export function getExerciseCategories(exercise: ExerciseMaster): ExerciseCategory[] {
  return exercise.categoryTags?.length ? exercise.categoryTags : [exercise.category];
}

export function getExerciseStages(exercise: ExerciseMaster): ExerciseStage[] {
  return exercise.stageTags?.length ? exercise.stageTags : [exercise.stage];
}

export function inferExerciseProgressionStyle(
  exercise: Pick<ExerciseMaster, 'category' | 'categoryTags' | 'progressionStyle'>,
): ExerciseProgressionStyle {
  if (exercise.progressionStyle) return exercise.progressionStyle;

  const categories = exercise.categoryTags?.length ? exercise.categoryTags : [exercise.category];
  if (categories.includes('bodyweight') || categories.includes('mobility') || categories.includes('cardio')) return 'bodyweight';
  if (categories.includes('biceps') || categories.includes('triceps') || categories.includes('shoulder')) return 'isolation';
  return 'compound';
}

export function labelForProgressionStyle(style: ExerciseProgressionStyle, locale: 'ko' | 'en' = 'ko'): string {
  const option = exerciseProgressionStyleOptions.find((item) => item.value === style);
  return locale === 'ko' ? option?.labelKo ?? style : option?.label ?? style;
}

export function isWarmupOnlyExercise(exercise: Pick<ExerciseMaster, 'stage' | 'stageTags'> | undefined): boolean {
  if (!exercise) return false;

  const stages = exercise.stageTags?.length ? exercise.stageTags : [exercise.stage];
  return stages.includes('warmup') && !stages.includes('main');
}

export function getExerciseName(exercise: ExerciseMaster, locale: 'ko' | 'en' = 'ko'): string {
  if (locale === 'ko') return exercise.nameKo || exercise.nameEn || exercise.id;
  return exercise.nameEn || exercise.nameKo || exercise.id;
}

export function labelForCategory(category: ExerciseCategory, locale: 'ko' | 'en' = 'ko'): string {
  const option = exerciseCategoryOptions.find((item) => item.value === category);
  return locale === 'ko' ? option?.labelKo ?? category : option?.label ?? category;
}

export function labelForStage(stage: ExerciseStage, locale: 'ko' | 'en' = 'ko'): string {
  const option = exerciseStageOptions.find((item) => item.value === stage);
  return locale === 'ko' ? option?.labelKo ?? stage : option?.label ?? stage;
}

export function exerciseMatchesFilters(
  exercise: ExerciseMaster,
  filters: {
    query?: string;
    category?: ExerciseCategory | 'all';
    stage?: ExerciseStage | 'all';
  },
): boolean {
  const query = filters.query?.trim().toLowerCase() ?? '';
  const matchesSearch = !query
    || exercise.nameKo.toLowerCase().includes(query)
    || exercise.nameEn?.toLowerCase().includes(query)
    || exercise.description?.toLowerCase().includes(query)
    || getExerciseCategories(exercise).some((category) => category.includes(query))
    || getExerciseStages(exercise).some((stage) => stage.includes(query));
  const matchesCategory = !filters.category
    || filters.category === 'all'
    || getExerciseCategories(exercise).includes(filters.category);
  const matchesStage = !filters.stage
    || filters.stage === 'all'
    || getExerciseStages(exercise).includes(filters.stage);

  return matchesSearch && matchesCategory && matchesStage;
}
