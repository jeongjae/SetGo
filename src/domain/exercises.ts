import type { ExerciseCategory, ExerciseMaster, ExerciseStage } from '../types';

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

export function getExerciseCategories(exercise: ExerciseMaster): ExerciseCategory[] {
  return exercise.categoryTags?.length ? exercise.categoryTags : [exercise.category];
}

export function getExerciseStages(exercise: ExerciseMaster): ExerciseStage[] {
  return exercise.stageTags?.length ? exercise.stageTags : [exercise.stage];
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
