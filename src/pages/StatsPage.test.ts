import { describe, expect, it } from 'vitest';
import { buildStats, buildEmptyStats, buildAiPrompt } from './StatsPage';
import { formatDateKey } from '../utils/date';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

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
        isHard: true,
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

  it('accurately counts hard sets and training volumes taking new set types (drop, failure) and backward compatibility into account', () => {
    const date = formatDateKey(new Date());
    const session: WorkoutSession = {
      id: 'session_2',
      date,
      startedAt: `${date}T12:00:00.000`,
      timeBand: 'evening',
      status: 'completed',
      totalStrengthVolumeKg: 0,
      createdAt: `${date}T12:00:00.000`,
      updatedAt: `${date}T12:00:00.000`,
    };
    const workoutExercises: WorkoutExercise[] = [
      {
        id: 'session_2_ex1',
        sessionId: session.id,
        exerciseId: 'deadlift',
        order: 1,
        status: 'completed',
        totalVolumeKg: 1000,
      },
    ];
    const sets: WorkoutSet[] = [
      {
        id: 'set_warmup_type',
        workoutExerciseId: 'session_2_ex1',
        setNo: 1,
        weightKg: 60,
        reps: 5,
        isCompleted: true,
        type: 'warmup',
      },
      {
        id: 'set_normal_type',
        workoutExerciseId: 'session_2_ex1',
        setNo: 2,
        weightKg: 100,
        reps: 5,
        rir: 2,
        isCompleted: true,
        type: 'normal',
        isHard: true,
      },
      {
        id: 'set_drop_type',
        workoutExerciseId: 'session_2_ex1',
        setNo: 3,
        weightKg: 80,
        reps: 8,
        rir: 1,
        isCompleted: true,
        type: 'drop',
        isHard: true,
      },
      {
        id: 'set_failure_type',
        workoutExerciseId: 'session_2_ex1',
        setNo: 4,
        weightKg: 100,
        reps: 4,
        rir: 0,
        isCompleted: true,
        type: 'failure',
        isHard: true,
      },
      {
        id: 'set_legacy_warmup',
        workoutExerciseId: 'session_2_ex1',
        setNo: 5,
        weightKg: 60,
        reps: 5,
        isCompleted: true,
        isWarmup: true,
      },
    ];

    const stats = buildStats(
      [session],
      workoutExercises,
      sets,
      [exercise('deadlift', 'main', ['main'], 'back')],
      'en',
    );

    expect(stats.totalSets).toBe(5);
    expect(stats.hardSets).toBe(3);
    expect(stats.hardSetRatio).toBe(100);
    expect(stats.muscleStats.find((item) => item.group === 'back')?.sets).toBe(3);
  });

  it('exposes recovery readiness from recent hard muscle load', () => {
    const date = formatDateKey(new Date());
    const session: WorkoutSession = {
      id: 'session_recovery',
      date,
      startedAt: `${date}T12:00:00.000`,
      endedAt: `${date}T13:00:00.000`,
      timeBand: 'afternoon',
      status: 'completed',
      totalStrengthVolumeKg: 0,
      createdAt: `${date}T12:00:00.000`,
      updatedAt: `${date}T13:00:00.000`,
    };
    const workoutExercises: WorkoutExercise[] = [{
      id: 'session_recovery_squat',
      sessionId: session.id,
      exerciseId: 'squat',
      order: 1,
      status: 'completed',
      totalVolumeKg: 7200,
    }];
    const sets: WorkoutSet[] = [{
      id: 'recovery_set_1',
      workoutExerciseId: 'session_recovery_squat',
      setNo: 1,
      weightKg: 180,
      reps: 40,
      isCompleted: true,
      isWarmup: false,
      isHard: true,
    }];

    const stats = buildStats(
      [session],
      workoutExercises,
      sets,
      [exercise('squat', 'main', ['main'], 'legs')],
      'en',
    );

    expect(stats.recovery.readinessStatus).toBe('fatigued');
    expect(stats.recovery.mostFatiguedGroups[0]?.group).toBe('legs');
    expect(stats.nextWeekSuggestions[0]).toContain('Legs');
  });

  it('builds a 14-day daily trend with strength volume and running distance', () => {
    const date = formatDateKey(new Date());
    const session: WorkoutSession = {
      id: 'session_daily',
      date,
      startedAt: `${date}T12:00:00.000`,
      timeBand: 'afternoon',
      status: 'completed',
      totalStrengthVolumeKg: 0,
      createdAt: `${date}T12:00:00.000`,
      updatedAt: `${date}T12:00:00.000`,
    };
    const workoutExercises: WorkoutExercise[] = [{
      id: 'session_daily_bench',
      sessionId: session.id,
      exerciseId: 'bench_press',
      order: 1,
      status: 'completed',
      totalVolumeKg: 500,
    }];
    const sets: WorkoutSet[] = [{
      id: 'daily_set_1',
      workoutExerciseId: 'session_daily_bench',
      setNo: 1,
      weightKg: 50,
      reps: 10,
      rir: 2,
      isCompleted: true,
      isWarmup: false,
    }];
    const cardioRecords: CardioRecord[] = [{
      id: 'daily_cardio',
      sessionId: session.id,
      isDraft: false,
      environment: 'outdoor',
      startedAt: `${date}T12:30:00.000`,
      endedAt: `${date}T13:00:00.000`,
      distanceKm: 2.4,
    }];

    const stats = buildStats(
      [session],
      workoutExercises,
      sets,
      [exercise('bench_press', 'main', ['main'], 'chest')],
      'en',
      cardioRecords,
    );
    const todayTrend = stats.dailyTrend.find((item) => item.date === date);

    expect(stats.dailyTrend).toHaveLength(14);
    expect(todayTrend?.strengthVolumeKg).toBe(500);
    expect(todayTrend?.strengthSets).toBe(1);
    expect(todayTrend?.cardioDistanceKm).toBe(2.4);
  });

  it('does not warn about short muscle gaps from records outside the current week', () => {
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(today.getDate() - 14);
    const oldDateKey = formatDateKey(oldDate);
    const oldNextDate = new Date(oldDate);
    oldNextDate.setDate(oldDate.getDate() + 1);
    const oldNextDateKey = formatDateKey(oldNextDate);
    const sessions: WorkoutSession[] = [
      {
        id: 'old_session_1',
        date: oldDateKey,
        startedAt: `${oldDateKey}T12:00:00.000`,
        timeBand: 'afternoon',
        status: 'completed',
        totalStrengthVolumeKg: 0,
        createdAt: `${oldDateKey}T12:00:00.000`,
        updatedAt: `${oldDateKey}T12:00:00.000`,
      },
      {
        id: 'old_session_2',
        date: oldNextDateKey,
        startedAt: `${oldNextDateKey}T12:00:00.000`,
        timeBand: 'afternoon',
        status: 'completed',
        totalStrengthVolumeKg: 0,
        createdAt: `${oldNextDateKey}T12:00:00.000`,
        updatedAt: `${oldNextDateKey}T12:00:00.000`,
      },
    ];
    const workoutExercises: WorkoutExercise[] = sessions.map((session, index) => ({
      id: `${session.id}_bench`,
      sessionId: session.id,
      exerciseId: 'bench_press',
      order: 1,
      status: 'completed',
      totalVolumeKg: 500,
    }));
    const sets: WorkoutSet[] = workoutExercises.map((workoutExercise, index) => ({
      id: `old_set_${index}`,
      workoutExerciseId: workoutExercise.id,
      setNo: 1,
      weightKg: 50,
      reps: 10,
      rir: 2,
      isCompleted: true,
      isWarmup: false,
    }));

    const stats = buildStats(
      sessions,
      workoutExercises,
      sets,
      [exercise('bench_press', 'main', ['main'], 'chest')],
      'en',
    );

    expect(stats.warnings.some((warning) => warning.includes('Chest was repeated within 48 hours'))).toBe(false);
  });
});
