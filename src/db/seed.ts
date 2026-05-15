import { db } from './db';
import type { ExerciseMaster } from '../types';

const now = () => new Date().toISOString();

const exercise = (
  id: string,
  nameKo: string,
  nameEn: string,
  category: ExerciseMaster['category'],
  icon: string,
  stage: ExerciseMaster['stage'] = 'main',
  categoryTags: ExerciseMaster['categoryTags'] = [category],
  stageTags: ExerciseMaster['stageTags'] = [stage],
  description?: string,
): ExerciseMaster => ({
  id,
  nameKo,
  nameEn,
  stage,
  stageTags,
  category,
  categoryTags,
  description,
  defaultEmoji: icon,
  isDefault: true,
  isActive: true,
  createdAt: now(),
  updatedAt: now(),
});

export const defaultExercises: ExerciseMaster[] = [
  exercise('bench_press', '벤치프레스', 'Bench Press', 'chest', 'CH', 'main', ['chest', 'triceps'], ['main']),
  exercise('incline_bench_press', '인클라인 벤치프레스', 'Incline Bench Press', 'chest', 'CH', 'main', ['chest', 'shoulder', 'triceps'], ['main']),
  exercise('chest_press', '체스트 프레스', 'Chest Press', 'chest', 'CH', 'main', ['chest', 'triceps'], ['main']),
  exercise('lat_pulldown', '랫풀다운', 'Lat Pulldown', 'back', 'BK'),
  exercise('pull_up', '풀업', 'Pull-up', 'back', 'BK', 'main', ['back', 'bodyweight'], ['main']),
  exercise('seated_cable_row', '시티드 케이블 로우', 'Seated Cable Row', 'back', 'BK'),
  exercise('shoulder_press', '숄더 프레스', 'Shoulder Press', 'shoulder', 'SH'),
  exercise('side_lateral_raise', '사이드 레터럴 레이즈', 'Side Lateral Raise', 'shoulder', 'SH'),
  exercise('dumbbell_curl', '덤벨 컬', 'Dumbbell Curl', 'biceps', 'BI'),
  exercise('cable_pushdown', '케이블 푸시다운', 'Cable Pushdown', 'triceps', 'TR'),
  exercise('barbell_squat', '바벨 스쿼트', 'Barbell Squat', 'legs', 'LG'),
  exercise('leg_press', '레그 프레스', 'Leg Press', 'legs', 'LG'),
  exercise('romanian_deadlift', '루마니안 데드리프트', 'Romanian Deadlift', 'legs', 'LG'),
  exercise('joint_mobility', '관절 가동성', 'Joint Mobility', 'mobility', 'MO', 'warmup', ['mobility'], ['warmup', 'cooldown']),
  exercise('push_up', '푸시업', 'Push-up', 'bodyweight', 'BW', 'warmup', ['bodyweight', 'chest', 'triceps'], ['warmup', 'main'], '준비운동, 맨손 가슴 운동, 마무리 운동으로 사용할 수 있습니다.'),
  exercise('treadmill', '트레드밀', 'Treadmill', 'cardio', 'CA', 'warmup'),
  exercise('indoor_bike', '실내 자전거', 'Indoor Bike', 'cardio', 'CA', 'warmup'),
  exercise('outdoor_running', '야외 러닝', 'Outdoor Running', 'cardio', 'CA'),
];

export async function seedDefaultExercises() {
  await db.exercises.bulkPut(defaultExercises);
}
