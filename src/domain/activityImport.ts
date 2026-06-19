import type { CardioActivityType, CardioRecord } from '../types';
import { calculateAverageSpeedKmh } from './volume';

export type ImportedActivity = {
  externalId?: string;
  sourceName: string;
  activityType?: CardioActivityType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  distanceKm?: number;
  memo?: string;
};

export type ImportedActivityResult =
  | { ok: true; record: CardioRecord }
  | { ok: false; error: 'missing-start' | 'missing-duration' | 'invalid-date' };

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';
}

function toEndedAt(startedAt: string, endedAt: string | undefined, durationSeconds: number | undefined): string | undefined {
  if (endedAt) return endedAt;
  if (durationSeconds === undefined) return undefined;

  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return undefined;
  return new Date(startMs + durationSeconds * 1000).toISOString();
}

export function normalizeImportedActivity(
  sessionId: string,
  activity: ImportedActivity,
  importedAt = new Date().toISOString(),
): ImportedActivityResult {
  if (!activity.startedAt) return { ok: false, error: 'missing-start' };
  if (!activity.endedAt && activity.durationSeconds === undefined) return { ok: false, error: 'missing-duration' };

  const endedAt = toEndedAt(activity.startedAt, activity.endedAt, activity.durationSeconds);
  const startMs = new Date(activity.startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Number.NaN;
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { ok: false, error: 'invalid-date' };
  }

  const durationSeconds = Math.round((endMs - startMs) / 1000);
  const sourceSlug = slug(activity.sourceName);
  const identity = activity.externalId ? slug(activity.externalId) : `${startMs}`;

  return {
    ok: true,
    record: {
      id: `${sessionId}_import_${sourceSlug}_${identity}`,
      sessionId,
      isDraft: false,
      source: 'imported',
      sourceName: activity.sourceName,
      externalId: activity.externalId,
      importedAt,
      activityType: activity.activityType ?? 'running',
      environment: 'outdoor',
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSeconds,
      distanceKm: activity.distanceKm,
      averageSpeedKmh: activity.distanceKm
        ? calculateAverageSpeedKmh(activity.distanceKm, new Date(startMs).toISOString(), new Date(endMs).toISOString())
        : undefined,
      memo: activity.memo,
    },
  };
}

export function isDuplicateImportedActivity(
  candidate: Pick<CardioRecord, 'sourceName' | 'externalId' | 'startedAt' | 'activityType' | 'distanceKm' | 'durationSeconds'>,
  existing: Pick<CardioRecord, 'sourceName' | 'externalId' | 'startedAt' | 'activityType' | 'distanceKm' | 'durationSeconds'>[],
): boolean {
  return existing.some((record) => {
    if (candidate.externalId && record.externalId) {
      return candidate.externalId === record.externalId && candidate.sourceName === record.sourceName;
    }

    return record.startedAt === candidate.startedAt
      && record.activityType === candidate.activityType
      && record.distanceKm === candidate.distanceKm
      && record.durationSeconds === candidate.durationSeconds;
  });
}
