import { describe, expect, it } from 'vitest';
import { buildRecoverySnapshot } from './recovery';
import { buildRecoveryInputs, recoveryGroupLabel, recoveryWarningGroups, type RecoveryDataset } from './recoveryInputs';
import type { CardioRecord, ExerciseMaster, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

function exercise(id: string, category: string, nameKo = id): ExerciseMaster {
  return {
    id,
    nameKo,
    category,
    stage: 'main',
    isDefault: true,
    isActive: true,
  } as unknown as ExerciseMaster;
}

function session(id: string, date: string, status: WorkoutSession['status']): WorkoutSession {
  return {
    id,
    date,
    timeBand: 'morning',
    status,
    totalStrengthVolumeKg: 0,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    endedAt: `${date}T12:00:00.000Z`,
  } as unknown as WorkoutSession;
}

function workoutExercise(id: string, sessionId: string, exerciseId: string): WorkoutExercise {
  return { id, sessionId, exerciseId, order: 0, status: 'completed', totalVolumeKg: 0 } as WorkoutExercise;
}

function set(id: string, workoutExerciseId: string, weightKg: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id, workoutExerciseId, setNo: 1, weightKg, reps, isCompleted: true, ...extra } as WorkoutSet;
}

const asOf = new Date('2026-06-24T18:00:00.000Z');

describe('buildRecoveryInputs', () => {
  it('maps completed strength sets to their muscle groups', () => {
    const dataset: RecoveryDataset = {
      sessions: [session('s1', '2026-06-24', 'completed')],
      workoutExercises: [workoutExercise('we1', 's1', 'bench')],
      sets: [set('set1', 'we1', 100, 5, { isHard: true })],
      cardio: [],
      exercises: [exercise('bench', 'chest', '벤치프레스')],
    };

    const inputs = buildRecoveryInputs(dataset);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].muscleGroups).toContain('chest');
    expect(inputs[0].load).toBe(500);
    expect(inputs[0].isHard).toBe(true);
  });

  it('ignores sessions that are not completed', () => {
    const dataset: RecoveryDataset = {
      sessions: [session('s1', '2026-06-24', 'in_progress')],
      workoutExercises: [workoutExercise('we1', 's1', 'bench')],
      sets: [set('set1', 'we1', 100, 5)],
      cardio: [],
      exercises: [exercise('bench', 'chest')],
    };

    expect(buildRecoveryInputs(dataset)).toHaveLength(0);
  });

  it('produces cardio load from completed cardio records', () => {
    const cardio: CardioRecord = {
      id: 'c1',
      sessionId: 's1',
      environment: 'outdoor',
      startedAt: '2026-06-24T11:00:00.000Z',
      endedAt: '2026-06-24T11:40:00.000Z',
      distanceKm: 5,
    } as CardioRecord;
    const dataset: RecoveryDataset = {
      sessions: [session('s1', '2026-06-24', 'completed')],
      workoutExercises: [],
      sets: [],
      cardio: [cardio],
      exercises: [],
    };

    const inputs = buildRecoveryInputs(dataset);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].muscleGroups).toEqual(['cardio']);
    expect(inputs[0].load).toBeGreaterThan(0);
  });
});

describe('recoveryWarningGroups', () => {
  it('only warns about planned groups below the threshold', () => {
    const snapshot = buildRecoverySnapshot(
      [
        // Heavy recent legs work keeps legs fatigued.
        { date: '2026-06-24', completedAt: '2026-06-24T12:00:00.000Z', muscleGroups: ['legs'], load: 60000, isHard: true },
        // Light chest work stays recovered (above threshold).
        { date: '2026-06-24', completedAt: '2026-06-24T12:00:00.000Z', muscleGroups: ['chest'], load: 800 },
      ],
      { asOf },
    );

    const warned = recoveryWarningGroups(snapshot, ['legs', 'chest', 'back']);
    expect(warned.map((stat) => stat.group)).toEqual(['legs']);
    expect(warned.every((stat) => stat.recoveryPercent < 50)).toBe(true);
  });

  it('returns nothing when planned groups are recovered', () => {
    const snapshot = buildRecoverySnapshot([], { asOf });
    expect(recoveryWarningGroups(snapshot, ['legs', 'chest'])).toHaveLength(0);
  });
});

describe('recoveryGroupLabel', () => {
  it('localizes group names', () => {
    expect(recoveryGroupLabel('legs', 'ko')).toBe('하체');
    expect(recoveryGroupLabel('legs', 'en')).toBe('Legs');
  });
});
