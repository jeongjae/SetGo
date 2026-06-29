import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { getExerciseName } from '../domain/exercises';
import { calculateAverageSpeedKmh, calculateExerciseVolumeKg } from '../domain/volume';
import { timeBandLabel, type AppLocale } from '../i18n/i18n';
import { getExerciseIcon } from './exerciseIcon';
import { getProgressLabel } from '../domain/workoutSession';

type ExerciseLogInput = {
  workoutExercise: WorkoutExercise;
  exercise: ExerciseMaster;
  sets: WorkoutSet[];
  previousSummary?: string;
  pastBestWeight?: number;
  pastBestVolume?: number;
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

  lines.push(isKo ? '# ⚡ SetGo 운동 완료 리포트' : '# ⚡ SetGo Workout Completion Report');
  lines.push('');
  lines.push(`📅 ${isKo ? '날짜' : 'Date'}: **${session.date}**`);
  lines.push(`⏰ ${isKo ? '시간대' : 'Time'}: ${timeBandLabel(locale, session.timeBand)}`);
  if (routineName) lines.push(`📋 ${isKo ? '루틴명' : 'Routine'}: **${routineName}**`);
  if (routineDayName) lines.push(`🏷️ ${isKo ? '루틴 데이' : 'Routine Day'}: ${routineDayName}`);
  lines.push(`💪 ${isKo ? '총 볼륨' : 'Total Volume'}: **${session.totalStrengthVolumeKg.toLocaleString()} kg**`);
  lines.push(`✅ ${isKo ? '완료 운동' : 'Completed Exercises'}: **${completedExercises.length} / ${exercises.length}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (exercises.length > 0) {
    lines.push(isKo ? '## 🏋️ 근력 운동 기록' : '## 🏋️ Strength Logs');
    lines.push('');

    for (const item of exercises) {
      const volume = calculateExerciseVolumeKg(item.sets);
      const prWeight = item.pastBestWeight;
      const prVolume = item.pastBestVolume;

      lines.push(`### ${getExerciseIcon(item.exercise.defaultEmoji)} ${getExerciseName(item.exercise, locale)}`);
      for (const set of item.sets.sort((a, b) => a.setNo - b.setNo)) {
        const isWarmup = set.isWarmup ?? (set.type === 'warmup');
        const isHard = set.isHard === true;
        const isDrop = set.type === 'drop';
        const isFailure = set.type === 'failure';
        
        let typePrefix = '';
        if (isWarmup) typePrefix = isKo ? '[준비] ' : '[Warm] ';
        else if (isHard) typePrefix = isKo ? '🔥 [하드] ' : '🔥 [Hard] ';
        else if (isDrop) typePrefix = isKo ? '💎 [드롭] ' : '💎 [Drop] ';
        else if (isFailure) typePrefix = isKo ? '⚠️ [실패] ' : '⚠️ [Fail] ';

        const status = set.isCompleted ? '' : isKo ? ' (미완료)' : ' (not completed)';
        const rir = set.rir === undefined ? '' : `, RIR ${set.rir}`;
        
        // PR tag
        const prLabel = getProgressLabel(set, prWeight, prVolume);
        const prTag = prLabel ? ` ⭐ **${prLabel}**` : '';

        lines.push(`- ${isKo ? '세트' : 'Set'} ${set.setNo}: ${typePrefix}${set.weightKg}kg x ${set.reps}회${rir}${status}${prTag}`);
      }
      lines.push(`- **${isKo ? '세션 볼륨' : 'Session Volume'}**: ${volume.toLocaleString()} kg`);
      if (item.previousSummary) lines.push(`- ${isKo ? '이전 기록' : 'Previous'}: ${item.previousSummary}`);
      if (item.workoutExercise.memo) lines.push(`- 📝 ${isKo ? '운동 메모' : 'Exercise Note'}: _${item.workoutExercise.memo}_`);
      lines.push('');
    }
  }

  if (cardioRecords.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(isKo ? '## 🏃 유산소 기록' : '## 🏃 Cardio Logs');
    lines.push('');

    for (const cardio of cardioRecords) {
      const speed = cardio.averageSpeedKmh
        ?? (cardio.distanceKm ? calculateAverageSpeedKmh(cardio.distanceKm, cardio.startedAt, cardio.endedAt) : undefined);

      const title = cardio.environment === 'indoor'
        ? `${isKo ? '실내' : 'Indoor'} ${cardio.machineType ?? (isKo ? '유산소' : 'cardio')}`
        : `${isKo ? '야외' : 'Outdoor'} ${cardio.location ?? (isKo ? '유산소' : 'cardio')}`;

      lines.push(`### 🏃 ${isKo ? '유산소' : 'Cardio'} - ${title}`);
      lines.push(`- 🕒 ${isKo ? '시작' : 'Start'}: ${cardio.startedAt}`);
      lines.push(`- 🕒 ${isKo ? '종료' : 'End'}: ${cardio.endedAt}`);
      if (cardio.distanceKm !== undefined) lines.push(`- 📏 ${isKo ? '거리' : 'Distance'}: **${cardio.distanceKm} km**`);
      if (speed !== undefined) lines.push(`- ⚡ ${isKo ? '평균 속도' : 'Average speed'}: **${speed} km/h**`);
      if (cardio.memo) lines.push(`- 📝 ${isKo ? '메모' : 'Memo'}: _${cardio.memo}_`);
      lines.push('');
    }
  }

  if (session.memo) {
    lines.push('---');
    lines.push('');
    lines.push(isKo ? '## 📝 세션 종합 메모' : '## 📝 Session Note');
    lines.push(`_${session.memo}_`);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}
