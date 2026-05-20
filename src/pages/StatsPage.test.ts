import { describe, expect, it } from 'vitest';
import { buildStats } from './StatsPage';
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
});
