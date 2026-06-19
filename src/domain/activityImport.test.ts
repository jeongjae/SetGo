import { describe, expect, it } from 'vitest';
import { isDuplicateImportedActivity, normalizeImportedActivity } from './activityImport';

describe('activity import normalization', () => {
  it('normalizes an imported running activity into a cardio record', () => {
    const result = normalizeImportedActivity('workout_2026-05-21', {
      externalId: 'apple-123',
      sourceName: 'Apple Health',
      activityType: 'running',
      startedAt: '2026-05-21T09:00:00.000Z',
      durationSeconds: 1800,
      distanceKm: 5,
    }, '2026-05-21T10:00:00.000Z');

    expect(result).toMatchObject({
      ok: true,
      record: {
        id: 'workout_2026-05-21_import_apple-health_apple-123',
        sessionId: 'workout_2026-05-21',
        source: 'imported',
        sourceName: 'Apple Health',
        externalId: 'apple-123',
        importedAt: '2026-05-21T10:00:00.000Z',
        activityType: 'running',
        startedAt: '2026-05-21T09:00:00.000Z',
        endedAt: '2026-05-21T09:30:00.000Z',
        durationSeconds: 1800,
        distanceKm: 5,
        averageSpeedKmh: 10,
      },
    });
  });

  it('rejects imports that have neither end time nor duration', () => {
    expect(normalizeImportedActivity('workout_2026-05-21', {
      sourceName: 'CSV',
      startedAt: '2026-05-21T09:00:00.000Z',
    })).toEqual({ ok: false, error: 'missing-duration' });
  });

  it('detects duplicates by source and external id first', () => {
    expect(isDuplicateImportedActivity({
      sourceName: 'Apple Health',
      externalId: 'apple-123',
      startedAt: '2026-05-21T09:00:00.000Z',
      activityType: 'running',
    }, [{
      sourceName: 'Apple Health',
      externalId: 'apple-123',
      startedAt: '2026-05-20T09:00:00.000Z',
      activityType: 'walking',
    }])).toBe(true);
  });

  it('falls back to date, type, distance, and duration when there is no external id', () => {
    expect(isDuplicateImportedActivity({
      sourceName: 'CSV',
      startedAt: '2026-05-21T09:00:00.000Z',
      activityType: 'running',
      distanceKm: 5,
      durationSeconds: 1800,
    }, [{
      sourceName: 'Manual Export',
      startedAt: '2026-05-21T09:00:00.000Z',
      activityType: 'running',
      distanceKm: 5,
      durationSeconds: 1800,
    }])).toBe(true);
  });
});
