import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { getExerciseName } from '../domain/exercises';
import { calculateAverageSpeedKmh, calculateExerciseVolumeKg } from '../domain/volume';
import type { AppLocale } from '../i18n/i18n';

type ExerciseLogInput = {
  workoutExercise: WorkoutExercise;
  exercise: ExerciseMaster;
  sets: WorkoutSet[];
  previousSummary?: string;
};

export type WorkoutMarkdownInput = {
  session: WorkoutSession;
  routineName?: string;
  routineDayName?: string;
  exercises: ExerciseLogInput[];
  cardioRecords?: CardioRecord[];
  locale?: AppLocale;
};

export function formatWorkoutMarkdown(input: WorkoutMarkdownInput): string {
  const { session, routineName, routineDayName, exercises, cardioRecords = [], locale = 'ko' } = input;
  const completedExercises = exercises.filter((item) => item.workoutExercise.status === 'completed');
  const isKo = locale === 'ko';

  const lines: string[] = [];

  lines.push(isKo ? '# SetGo 운동 기록' : '# SetGo Workout Log');
  lines.push('');
  lines.push(`- ${isKo ? '날짜' : 'Date'}: ${session.date}`);
  lines.push(`- ${isKo ? '시간대' : 'Time'}: ${session.timeBand}`);
  if (routineName) lines.push(`- ${isKo ? '루틴' : 'Routine'}: ${routineName}`);
  if (routineDayName) lines.push(`- ${isKo ? '루틴 데이' : 'Routine Day'}: ${routineDayName}`);
  lines.push(`- ${isKo ? '총 근력 볼륨' : 'Total strength volume'}: ${session.totalStrengthVolumeKg.toLocaleString()} kg`);
  lines.push(`- ${isKo ? '완료한 운동' : 'Completed exercises'}: ${completedExercises.length} / ${exercises.length}`);
  lines.push('');

  if (exercises.length > 0) {
    lines.push(isKo ? '## 근력 운동' : '## Strength');
    lines.push('');

    for (const item of exercises) {
      const volume = calculateExerciseVolumeKg(item.sets);

      lines.push(`### ${item.exercise.defaultEmoji} ${getExerciseName(item.exercise, locale)}`);
      for (const set of item.sets.sort((a, b) => a.setNo - b.setNo)) {
        const status = set.isCompleted ? '' : isKo ? ' (미완료)' : ' (not completed)';
        const rir = set.rir === undefined ? '' : `, RIR ${set.rir}`;
        lines.push(`- ${isKo ? '세트' : 'Set'} ${set.setNo}: ${set.weightKg}kg x ${set.reps}${rir}${status}`);
      }
      lines.push(`- ${isKo ? '볼륨' : 'Volume'}: ${volume.toLocaleString()} kg`);
      if (item.previousSummary) lines.push(`- ${isKo ? '이전 기록' : 'Previous'}: ${item.previousSummary}`);
      if (item.workoutExercise.memo) lines.push(`- ${isKo ? '메모' : 'Memo'}: ${item.workoutExercise.memo}`);
      lines.push('');
    }
  }

  if (cardioRecords.length > 0) {
    lines.push(isKo ? '## 유산소' : '## Cardio');
    lines.push('');

    for (const cardio of cardioRecords) {
      const speed = cardio.averageSpeedKmh
        ?? (cardio.distanceKm ? calculateAverageSpeedKmh(cardio.distanceKm, cardio.startedAt, cardio.endedAt) : undefined);

      const title = cardio.environment === 'indoor'
        ? `${isKo ? '실내' : 'Indoor'} ${cardio.machineType ?? (isKo ? '유산소' : 'cardio')}`
        : `${isKo ? '야외' : 'Outdoor'} ${cardio.location ?? (isKo ? '유산소' : 'cardio')}`;

      lines.push(`### ${isKo ? '유산소' : 'Cardio'} - ${title}`);
      lines.push(`- ${isKo ? '시작' : 'Start'}: ${cardio.startedAt}`);
      lines.push(`- ${isKo ? '종료' : 'End'}: ${cardio.endedAt}`);
      if (cardio.distanceKm !== undefined) lines.push(`- ${isKo ? '거리' : 'Distance'}: ${cardio.distanceKm} km`);
      if (speed !== undefined) lines.push(`- ${isKo ? '평균 속도' : 'Average speed'}: ${speed} km/h`);
      if (cardio.memo) lines.push(`- ${isKo ? '메모' : 'Memo'}: ${cardio.memo}`);
      lines.push('');
    }
  }

  if (session.memo) {
    lines.push(isKo ? '## 메모' : '## Notes');
    lines.push(session.memo);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}
