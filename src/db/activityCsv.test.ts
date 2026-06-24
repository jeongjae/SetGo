import { describe, expect, it } from 'vitest';
import { ActivityCsvImportError, buildActivityCsvImport } from './activityCsv';
import type { CardioRecord, WorkoutSession } from '../types';

const now = '2026-06-24T08:00:00.000Z';

function session(id: string, date: string, entryKind: WorkoutSession['entryKind'] = 'running'): WorkoutSession {
  return {
    id,
    date,
    startedAt: `${date}T12:00:00.000`,
    timeBand: 'afternoon',
    entryKind,
    status: 'completed',
    totalStrengthVolumeKg: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function record(id: string, overrides: Partial<CardioRecord> = {}): CardioRecord {
  return {
    id,
    sessionId: 'session_1',
    source: 'imported',
    sourceName: 'Apple Health',
    externalId: 'apple-1',
    activityType: 'running',
    environment: 'outdoor',
    startedAt: '2026-06-20T09:00:00.000Z',
    endedAt: '2026-06-20T09:30:00.000Z',
    durationSeconds: 1800,
    distanceKm: 5,
    ...overrides,
  };
}

describe('buildActivityCsvImport', () => {
  it('creates completed running sessions and normalized cardio records from CSV rows', () => {
    const csv = [
      'externalId,sourceName,activityType,startedAt,durationSeconds,distanceKm,memo',
      'apple-1,Apple Health,running,2026-06-20T09:00:00.000Z,1800,5,Morning run',
      'walk-1,Apple Health,walking,2026-06-21T10:00:00.000Z,1200,1.5,Walk',
    ].join('\n');

    const result = buildActivityCsvImport(csv, [], [], now);

    expect(result.importedCount).toBe(2);
    expect(result.sessionCount).toBe(2);
    expect(result.sessions.map((item) => item.date)).toEqual(['2026-06-20', '2026-06-21']);
    expect(result.sessions[0]).toMatchObject({
      entryKind: 'running',
      status: 'completed',
      totalStrengthVolumeKg: 0,
    });
    expect(result.records[0]).toMatchObject({
      sessionId: result.sessions[0].id,
      source: 'imported',
      sourceName: 'Apple Health',
      externalId: 'apple-1',
      activityType: 'running',
      durationSeconds: 1800,
      distanceKm: 5,
      averageSpeedKmh: 10,
    });
  });

  it('reuses existing sessions for the same date', () => {
    const existing = session('existing_running', '2026-06-20');
    const csv = [
      'startedAt,durationSeconds,distanceKm',
      '2026-06-20T09:00:00.000Z,1800,5',
    ].join('\n');

    const result = buildActivityCsvImport(csv, [existing], [], now);

    expect(result.sessionCount).toBe(0);
    expect(result.sessions).toEqual([]);
    expect(result.records[0].sessionId).toBe('existing_running');
  });

  it('skips duplicate source ids without failing the whole import', () => {
    const csv = [
      'externalId,sourceName,activityType,startedAt,durationSeconds,distanceKm',
      'apple-1,Apple Health,running,2026-06-20T09:00:00.000Z,1800,5',
    ].join('\n');

    const result = buildActivityCsvImport(csv, [session('existing', '2026-06-20')], [record('existing_record')], now);

    expect(result.importedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it('aggregates row issues for invalid values', () => {
    const csv = [
      'activityType,startedAt,durationSeconds,distanceKm',
      'swimming,2026-06-20T09:00:00.000Z,1800,5',
      'running,not-a-date,1800,5',
      'running,2026-06-20T09:00:00.000Z,nope,5',
    ].join('\n');

    const result = buildActivityCsvImport(csv, [], [], now);

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(3);
    expect(result.issues).toEqual([
      'Row 2: activityType must be running, walking, cycling, elliptical, or other.',
      'Row 3: startedAt must be a valid date/time.',
      'Row 4: durationSeconds must be a number.',
    ]);
  });

  it('rejects files without startedAt', () => {
    expect(() => buildActivityCsvImport('durationSeconds,distanceKm\n1800,5', [], [], now))
      .toThrow(ActivityCsvImportError);
  });
});
