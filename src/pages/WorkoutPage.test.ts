import { describe, expect, it } from 'vitest';
import { getElapsedMs } from './WorkoutPage';

describe('workout elapsed time', () => {
  it('measures UTC session time without timezone correction', () => {
    expect(getElapsedMs('2026-05-21T00:00:00.000Z', Date.parse('2026-05-21T00:15:00.000Z'))).toBe(900000);
  });

  it('supports local historical session timestamps', () => {
    const startedAt = '2026-05-10T12:00:00.000';
    expect(getElapsedMs(startedAt, new Date(startedAt).getTime() + 600000)).toBe(600000);
  });

  it('clamps invalid and future session timestamps', () => {
    expect(getElapsedMs('not-a-date', Date.now())).toBe(0);
    expect(getElapsedMs('2026-05-21T00:30:00.000Z', Date.parse('2026-05-21T00:15:00.000Z'))).toBe(0);
  });
});
