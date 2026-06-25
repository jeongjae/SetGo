import { normalizeImportedActivity, isDuplicateImportedActivity, type ImportedActivity } from '../domain/activityImport';
import type { CardioActivityType, CardioRecord, WorkoutSession } from '../types';
import { formatDateKey, getTimeBand } from '../utils/date';
import { db } from './db';

const activityTypes: CardioActivityType[] = ['running', 'walking', 'cycling', 'elliptical', 'other'];
const requiredHeaders = ['startedAt'];

export class ActivityCsvImportError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ActivityCsvImportError';
  }
}

export type ActivityCsvImportSummary = {
  importedCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  sessionCount: number;
  issues: string[];
};

type ActivityCsvBuildResult = ActivityCsvImportSummary & {
  sessions: WorkoutSession[];
  records: CardioRecord[];
};

function parseDelimitedRows(input: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);

  return rows;
}

function parseCsvRows(csv: string): string[][] {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  return parseDelimitedRows(csv, delimiter);
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseActivityType(value: string): CardioActivityType | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return activityTypes.includes(normalized as CardioActivityType)
    ? normalized as CardioActivityType
    : undefined;
}

function normalizeRowDate(startedAt: string): string | undefined {
  const date = new Date(startedAt);
  return Number.isNaN(date.getTime()) ? undefined : formatDateKey(date);
}

function createImportedRunningSession(date: string, now: string, index: number): WorkoutSession {
  const startedAt = `${date}T12:00:00.000`;
  return {
    id: `workout_${date}_imported_cardio_${index + 1}`,
    date,
    startedAt,
    endedAt: startedAt,
    timeBand: getTimeBand(new Date(`${date}T12:00:00`)),
    entryKind: 'running',
    status: 'completed',
    totalStrengthVolumeKg: 0,
    memo: 'Imported cardio activities',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildActivityCsvImport(
  csv: string,
  existingSessions: WorkoutSession[],
  existingRecords: CardioRecord[],
  now = new Date().toISOString(),
): ActivityCsvBuildResult {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, '').trim());
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) {
    throw new ActivityCsvImportError(['CSV is empty.']);
  }

  const headerIndex = new Map(headerRow.map((header, index) => [header.trim().replace(/^\uFEFF/, ''), index]));
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length > 0) {
    throw new ActivityCsvImportError([`Missing required columns: ${missingHeaders.join(', ')}`]);
  }

  const readCell = (row: string[], key: string) => row[headerIndex.get(key) ?? -1]?.trim() ?? '';
  const sessionsByDate = new Map(
    existingSessions
      .filter((session) => session.entryKind === 'running' || session.status === 'completed')
      .map((session) => [session.date, session]),
  );
  const createdSessions = new Map<string, WorkoutSession>();
  const acceptedRecords: CardioRecord[] = [];
  const issues: string[] = [];
  let skippedDuplicateCount = 0;
  let failedCount = 0;

  dataRows.forEach((row, rowIndex) => {
    const csvLine = rowIndex + 2;
    const startedAt = readCell(row, 'startedAt') || readCell(row, 'startTime') || readCell(row, 'startDate');
    const endedAt = readCell(row, 'endedAt') || readCell(row, 'endTime') || readCell(row, 'endDate');
    const durationSeconds = parseNumber(readCell(row, 'durationSeconds'));
    const distanceKm = parseNumber(readCell(row, 'distanceKm'));
    const activityType = parseActivityType(readCell(row, 'activityType') || readCell(row, 'type'));

    if (Number.isNaN(durationSeconds)) {
      issues.push(`Row ${csvLine}: durationSeconds must be a number.`);
      failedCount += 1;
      return;
    }
    if (durationSeconds !== undefined && durationSeconds < 0) {
      issues.push(`Row ${csvLine}: durationSeconds cannot be negative.`);
      failedCount += 1;
      return;
    }
    if (Number.isNaN(distanceKm)) {
      issues.push(`Row ${csvLine}: distanceKm must be a number.`);
      failedCount += 1;
      return;
    }
    if (distanceKm !== undefined && distanceKm < 0) {
      issues.push(`Row ${csvLine}: distanceKm cannot be negative.`);
      failedCount += 1;
      return;
    }
    if ((readCell(row, 'activityType') || readCell(row, 'type')) && !activityType) {
      issues.push(`Row ${csvLine}: activityType must be running, walking, cycling, elliptical, or other.`);
      failedCount += 1;
      return;
    }

    const date = normalizeRowDate(startedAt);
    if (!date) {
      issues.push(`Row ${csvLine}: startedAt must be a valid date/time.`);
      failedCount += 1;
      return;
    }

    const startMs = new Date(startedAt).getTime();
    const nowMs = new Date(now).getTime();
    if (startMs > nowMs) {
      issues.push(`Row ${csvLine}: startedAt cannot be in the future.`);
      failedCount += 1;
      return;
    }

    let session = sessionsByDate.get(date) ?? createdSessions.get(date);
    if (!session) {
      session = createImportedRunningSession(date, now, createdSessions.size);
      createdSessions.set(date, session);
    }

    const activity: ImportedActivity = {
      externalId: readCell(row, 'externalId') || undefined,
      sourceName: readCell(row, 'sourceName') || 'CSV Import',
      activityType,
      startedAt,
      endedAt: endedAt || undefined,
      durationSeconds,
      distanceKm,
      memo: readCell(row, 'memo') || undefined,
    };
    const result = normalizeImportedActivity(session.id, activity, now);
    if (!result.ok) {
      const message = result.error === 'missing-duration'
        ? 'endedAt or durationSeconds is required.'
        : result.error === 'missing-start'
          ? 'startedAt is required.'
          : 'startedAt/endedAt must form a valid time range.';
      issues.push(`Row ${csvLine}: ${message}`);
      failedCount += 1;
      return;
    }

    const duplicatePool = [...existingRecords, ...acceptedRecords];
    if (isDuplicateImportedActivity(result.record, duplicatePool)) {
      skippedDuplicateCount += 1;
      return;
    }

    acceptedRecords.push(result.record);
  });

  return {
    sessions: [...createdSessions.values()],
    records: acceptedRecords,
    importedCount: acceptedRecords.length,
    skippedDuplicateCount,
    failedCount,
    sessionCount: createdSessions.size,
    issues,
  };
}

export async function importActivityCsv(csv: string): Promise<ActivityCsvImportSummary> {
  const importResult = buildActivityCsvImport(
    csv,
    await db.workoutSessions.toArray(),
    await db.cardioRecords.toArray(),
  );

  if (importResult.records.length > 0 || importResult.sessions.length > 0) {
    await db.transaction('rw', db.workoutSessions, db.cardioRecords, async () => {
      if (importResult.sessions.length > 0) {
        await db.workoutSessions.bulkPut(importResult.sessions);
      }
      if (importResult.records.length > 0) {
        await db.cardioRecords.bulkPut(importResult.records);
      }
    });
  }

  return {
    importedCount: importResult.importedCount,
    skippedDuplicateCount: importResult.skippedDuplicateCount,
    failedCount: importResult.failedCount,
    sessionCount: importResult.sessionCount,
    issues: importResult.issues,
  };
}
