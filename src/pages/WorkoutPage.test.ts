import { describe, expect, it } from 'vitest';
import { getElapsedMs, getLiveSessionElapsedMs } from './WorkoutPage';

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

  it("shows live elapsed time only for today's in-progress session", () => {
    const nowMs = new Date('2026-05-21T12:15:00').getTime();

    expect(getLiveSessionElapsedMs({
      date: '2026-05-21',
      startedAt: '2026-05-21T12:00:00',
      status: 'in_progress',
    }, nowMs)).toBe(900000);
    expect(getLiveSessionElapsedMs({
      date: '2026-05-20',
      startedAt: '2026-05-20T12:00:00',
      status: 'in_progress',
    }, nowMs)).toBeUndefined();
    expect(getLiveSessionElapsedMs({
      date: '2026-05-21',
      startedAt: '2026-05-21T12:00:00',
      status: 'completed',
    }, nowMs)).toBeUndefined();
  });
});
