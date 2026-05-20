import { describe, expect, it } from 'vitest';
import { buildStats, buildEmptyStats, buildAiPrompt } from './StatsPage';
import { formatDateKey } from '../utils/date';
import type { ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

function exercise(
  id: string,
  stage: ExerciseMaster['stage'],
  stageTags: ExerciseMaster['stageTags'],
  category: ExerciseMaster['category'],
): ExerciseMaster {
  return {
    id,
    nameKo: id,
    nameEn: id,
    stage,
    stageTags,
    category,
    categoryTags: [category],
    defaultEmoji: 'EX',
    isDefault: true,
    isActive: true,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  };
}

describe('stats builder', () => {
  it('excludes warmup-only exercise sets from hard-set and muscle target counts', () => {
    const date = formatDateKey(new Date());
    const session: WorkoutSession = {
      id: 'session_1',
      date,
      startedAt: `${date}T12:00:00.000`,
      timeBand: 'afternoon',
      status: 'completed',
      totalStrengthVolumeKg: 0,
      createdAt: `${date}T12:00:00.000`,
      updatedAt: `${date}T12:00:00.000`,
    };
    const workoutExercises: WorkoutExercise[] = [
      {
        id: 'session_1_main',
        sessionId: session.id,
        exerciseId: 'bench_press',
        order: 1,
        status: 'completed',
        totalVolumeKg: 500,
      },
      {
        id: 'session_1_warmup',
        sessionId: session.id,
        exerciseId: 'joint_mobility',
        order: 2,
        status: 'completed',
        totalVolumeKg: 120,
      },
    ];
    const sets: WorkoutSet[] = [
      {
        id: 'main_set_1',
        workoutExerciseId: 'session_1_main',
        setNo: 1,
        weightKg: 50,
        reps: 10,
        rir: 2,
        isCompleted: true,
        isWarmup: false,
      },
      {
        id: 'warmup_set_1',
        workoutExerciseId: 'session_1_warmup',
        setNo: 1,
        weightKg: 10,
        reps: 12,
        rir: 1,
        isCompleted: true,
        isWarmup: false,
      },
    ];

    const stats = buildStats(
      [session],
      workoutExercises,
      sets,
      [
        exercise('bench_press', 'main', ['main'], 'chest'),
        exercise('joint_mobility', 'warmup', ['warmup', 'cooldown'], 'mobility'),
      ],
      'en',
    );

    expect(stats.totalSets).toBe(2);
    expect(stats.hardSets).toBe(1);
    expect(stats.hardSetRatio).toBe(100);
    expect(stats.muscleStats.find((item) => item.group === 'chest')?.sets).toBe(1);
  });

  it('generates high-quality AI analysis prompt for ChatGPT and Gemini in both ko and en', () => {
    const stats = buildEmptyStats('ko');
    // 테스트 데이터를 임의로 채워넣음
    stats.workoutDays = 3;
    stats.totalVolumeKg = 2500;
    stats.totalSets = 12;
    stats.hardSets = 5;
    stats.hardSetRatio = 41;
    stats.analysisComment = '이번 주는 3일 운동했고 총 2,500kg, 12세트를 기록했습니다.';
    stats.warnings = ['연속 운동일이 4일입니다. 하루 회복일을 고려하세요.'];

    // 1. 한국어 프롬프트 생성 검증
    const promptKo = buildAiPrompt(stats, 'ko');
    expect(promptKo).toContain('[역할 정의]');
    expect(promptKo).toContain('전문 피트니스 AI 코치');
    expect(promptKo).toContain('- 운동일수: 3일');
    expect(promptKo).toContain('2,500kg');
    expect(promptKo).toContain('연속 운동일이 4일입니다');

    // 2. 영어 프롬프트 생성 검증
    const promptEn = buildAiPrompt(stats, 'en');
    expect(promptEn).toContain('[Role Definition]');
    expect(promptEn).toContain('professional fitness AI coach');
    expect(promptEn).toContain('- Workout Days: 3d');
    expect(promptEn).toContain('2,500');
    expect(promptEn).toContain('Status: LOW');
  });
});
