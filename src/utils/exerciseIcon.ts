import type { ExerciseCategory } from '../types';

export function getExerciseIcon(defaultEmoji: string): string {
  const mapping: Record<string, string> = {
    CH: '🏋️‍♂️',
    BK: '🦅',
    SH: '🛡️',
    BI: '💪',
    TR: '💪',
    LG: '🦵',
    BW: '🤸‍♂️',
    MO: '🧘‍♂️',
    CA: '🏃‍♂️',
  };
  return mapping[defaultEmoji.toUpperCase()] || defaultEmoji;
}

export function getCategoryAbbreviation(category: ExerciseCategory): string {
  const mapping: Record<ExerciseCategory, string> = {
    chest: 'CH',
    back: 'BK',
    shoulder: 'SH',
    biceps: 'BI',
    triceps: 'TR',
    legs: 'LG',
    bodyweight: 'BW',
    mobility: 'MO',
    cardio: 'CA',
  };
  return mapping[category] || category.slice(0, 2).toUpperCase();
}
