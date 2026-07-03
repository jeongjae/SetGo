import { describe, expect, it } from 'vitest';
import { buildRecoverySnapshot, calculateDecayedLoad, type RecoveryMuscleGroup } from './recovery';

describe('recovery model', () => {
  it('decays fatigue as time passes', () => {
    const load = calculateDecayedLoad(
      1000,
      new Date('2026-06-20T12:00:00.000Z'),
      new Date('2026-06-22T12:00:00.000Z'),
      0.4,
    );

    expect(load).toBeCloseTo(360, 0);
  });

  it('applies hard-set fatigue above normal work', () => {
    const asOf = new Date('2026-06-24T12:00:00.000Z');
    const normal = buildRecoverySnapshot([
      { date: '2026-06-24', completedAt: asOf.toISOString(), muscleGroups: ['chest'], load: 300 },
    ], { asOf });
    const hard = buildRecoverySnapshot([
      { date: '2026-06-24', completedAt: asOf.toISOString(), muscleGroups: ['chest'], load: 300, isHard: true },
    ], { asOf });

    expect(hard.groups.find((group) => group.group === 'chest')?.fatigueScore)
      .toBeGreaterThan(normal.groups.find((group) => group.group === 'chest')?.fatigueScore ?? 0);
  });

  it('discounts warmup sets so they do not suppress readiness like work sets', () => {
    const asOf = new Date('2026-06-24T12:00:00.000Z');
    const warmup = buildRecoverySnapshot([
      { date: '2026-06-24', completedAt: asOf.toISOString(), muscleGroups: ['legs'], load: 500, isWarmup: true },
    ], { asOf });
    const work = buildRecoverySnapshot([
      { date: '2026-06-24', completedAt: asOf.toISOString(), muscleGroups: ['legs'], load: 500 },
    ], { asOf });

    expect(warmup.groups.find((group) => group.group === 'legs')?.recoveryPercent)
      .toBeGreaterThan(work.groups.find((group) => group.group === 'legs')?.recoveryPercent ?? 0);
  });

  it('splits compound exercise load across multiple groups', () => {
    const asOf = new Date('2026-06-24T12:00:00.000Z');
    const snapshot = buildRecoverySnapshot([
      { date: '2026-06-24', completedAt: asOf.toISOString(), muscleGroups: ['back', 'biceps'], load: 2000 },
    ], { asOf });

    expect(snapshot.groups.find((group) => group.group === 'back')?.rawLoad).toBe(1000);
    expect(snapshot.groups.find((group) => group.group === 'biceps')?.rawLoad).toBe(1000);
  });

  it('lets a normal heavy lower-body day recover above the fatigue threshold after four days', () => {
    const asOf = new Date('2026-06-28T12:00:00.000Z');
    const inputs = Array.from({ length: 12 }, (_, index) => ({
      date: '2026-06-24',
      completedAt: '2026-06-24T12:00:00.000Z',
      muscleGroups: ['legs'] as RecoveryMuscleGroup[],
      load: 110,
      isHard: true,
      effortMultiplier: index < 2 ? 1.08 : 1,
    }));

    const snapshot = buildRecoverySnapshot(inputs, { asOf });
    const legs = snapshot.groups.find((group) => group.group === 'legs');

    expect(legs?.recoveryPercent).toBeGreaterThanOrEqual(60);
    expect(legs?.status).not.toBe('fatigued');
  });

  it('returns ready fallback values when no data exists', () => {
    const snapshot = buildRecoverySnapshot([], { asOf: new Date('2026-06-24T12:00:00.000Z') });

    expect(snapshot.averageRecoveryPercent).toBe(100);
    expect(snapshot.readinessStatus).toBe('ready');
    expect(snapshot.mostFatiguedGroups).toHaveLength(0);
  });
});
