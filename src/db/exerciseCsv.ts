import { db } from './db';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage } from '../types';
import { getCategoryAbbreviation } from '../utils/exerciseIcon';

const exerciseCategories: ExerciseCategory[] = [
  'chest',
  'back',
  'shoulder',
  'biceps',
  'triceps',
  'legs',
  'cardio',
  'bodyweight',
  'mobility',
];

const exerciseStages: ExerciseStage[] = ['warmup', 'main', 'cooldown'];

const csvHeaders = [
  'id',
  'nameKo',
  'nameEn',
  'categoryTags',
  'stageTags',
  'description',
  'icon',
  'preferredWeightIncrementKg',
  'isActive',
];

const requiredCsvHeaders = csvHeaders.filter((header) => header !== 'preferredWeightIncrementKg');

export class ExerciseCsvImportError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ExerciseCsvImportError';
  }
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

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

function splitTags<T extends string>(value: string, allowed: T[], fallback: T): T[] {
  const tags = value
    .split('|')
    .map((item) => item.trim())
    .filter((item): item is T => allowed.includes(item as T));

  return tags.length > 0 ? tags : [fallback];
}

function validateTags<T extends string>(value: string, allowed: T[]): T[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter((item): item is T => item.length > 0 && allowed.includes(item as T));
}

function invalidTags<T extends string>(value: string, allowed: T[]): string[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !allowed.includes(item as T));
}

function parseBoolean(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

export async function createExerciseCsv(): Promise<string> {
  return serializeExerciseCsv(await db.exercises.orderBy('id').toArray());
}

export function serializeExerciseCsv(exercises: ExerciseMaster[]): string {
  const rows = exercises.map((exercise) => [
    exercise.id,
    exercise.nameKo,
    exercise.nameEn ?? '',
    (exercise.categoryTags?.length ? exercise.categoryTags : [exercise.category]).join('|'),
    (exercise.stageTags?.length ? exercise.stageTags : [exercise.stage]).join('|'),
    exercise.description ?? '',
    exercise.defaultEmoji,
    exercise.preferredWeightIncrementKg ?? '',
    exercise.isActive ? 'true' : 'false',
  ]);

  return [csvHeaders, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}

function normalizeKoreanName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/펙/g, '팩');
}

function normalizeEnglishName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeIcon(iconVal: string, category: ExerciseCategory): string {
  const trimmed = iconVal.trim();
  if (!trimmed) return getCategoryAbbreviation(category);

  const upper = trimmed.toUpperCase();
  const validAbbreviations = ['CH', 'BK', 'SH', 'BI', 'TR', 'LG', 'BW', 'MO', 'CA'];
  if (validAbbreviations.includes(upper)) {
    return upper;
  }

  const categoryMap: Record<string, string> = {
    chest: 'CH',
    back: 'BK',
    shoulder: 'SH',
    biceps: 'BI',
    triceps: 'TR',
    legs: 'LG',
    bodyweight: 'BW',
    mobility: 'MO',
    cardio: 'CA',
  };
  if (categoryMap[trimmed.toLowerCase()]) {
    return categoryMap[trimmed.toLowerCase()];
  }

  return trimmed;
}

export function buildExerciseCsvImport(
  csv: string,
  existingExercises: ExerciseMaster[],
  now: string,
): ExerciseMaster[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, '').trim());
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];

  const headerIndex = new Map(headerRow.map((header, index) => [header.trim().replace(/^\uFEFF/, ''), index]));
  const missingHeaders = requiredCsvHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length > 0) {
    throw new ExerciseCsvImportError([`Missing required columns: ${missingHeaders.join(', ')}`]);
  }

  const existingById = new Map(existingExercises.map((exercise) => [exercise.id, exercise]));
  
  const existingByNameKo = new Map(
    existingExercises.map((exercise) => [normalizeKoreanName(exercise.nameKo), exercise])
  );
  const existingByNameEn = new Map(
    existingExercises
      .filter((exercise) => exercise.nameEn)
      .map((exercise) => [normalizeEnglishName(exercise.nameEn!), exercise])
  );

  const seenIds = new Set<string>();
  const issues: string[] = [];

  const nextExercises = dataRows
    .map((row, rowIndex): ExerciseMaster | undefined => {
      const csvLine = rowIndex + 2;
      const read = (key: string) => row[headerIndex.get(key) ?? -1]?.trim() ?? '';
      
      const rawId = read('id');
      const rawNameKo = read('nameKo');
      const rawNameEn = read('nameEn');

      let existing = rawId ? existingById.get(rawId) : undefined;
      if (!existing && rawNameKo) {
        existing = existingByNameKo.get(normalizeKoreanName(rawNameKo));
      }
      if (!existing && rawNameEn) {
        existing = existingByNameEn.get(normalizeEnglishName(rawNameEn));
      }

      const id = existing ? existing.id : (rawId || `custom_${Date.now()}_${rowIndex + 1}`);

      const invalidCategoryTags = invalidTags(read('categoryTags'), exerciseCategories);
      const invalidStageTags = invalidTags(read('stageTags'), exerciseStages);
      const categoryTags = validateTags(read('categoryTags'), exerciseCategories);
      const stageTags = validateTags(read('stageTags'), exerciseStages);
      const nameKo = rawNameKo || existing?.nameKo;
      const nameEn = rawNameEn || existing?.nameEn || nameKo;

      if (seenIds.has(id)) issues.push(`Row ${csvLine}: duplicate id "${id}"`);
      seenIds.add(id);
      if (!nameKo) issues.push(`Row ${csvLine}: nameKo is required for "${id}"`);
      if (invalidCategoryTags.length > 0) issues.push(`Row ${csvLine}: invalid categoryTags ${invalidCategoryTags.join('|')}`);
      if (invalidStageTags.length > 0) issues.push(`Row ${csvLine}: invalid stageTags ${invalidStageTags.join('|')}`);
      if (categoryTags.length === 0 && !existing) issues.push(`Row ${csvLine}: categoryTags is required for new exercise "${id}"`);
      if (stageTags.length === 0 && !existing) issues.push(`Row ${csvLine}: stageTags is required for new exercise "${id}"`);

      let isActive = existing?.isActive ?? true;
      try {
        isActive = parseBoolean(read('isActive'), existing?.isActive ?? true);
      } catch (error) {
        issues.push(`Row ${csvLine}: ${(error as Error).message}`);
      }

      if (!nameKo) return undefined;

      const nextCategoryTags = categoryTags.length > 0
        ? categoryTags
        : splitTags(read('categoryTags'), exerciseCategories, existing?.category ?? 'chest');
      const nextStageTags = stageTags.length > 0
        ? stageTags
        : splitTags(read('stageTags'), exerciseStages, existing?.stage ?? 'main');
      const rawWeightIncrement = read('preferredWeightIncrementKg');
      const preferredWeightIncrementKg: number | undefined = rawWeightIncrement
        ? Number(rawWeightIncrement)
        : existing?.preferredWeightIncrementKg;

      return {
        id,
        nameKo,
        nameEn,
        category: nextCategoryTags[0],
        categoryTags: nextCategoryTags,
        stage: nextStageTags[0],
        stageTags: nextStageTags,
        description: read('description') || undefined,
        defaultEmoji: normalizeIcon(read('icon') || existing?.defaultEmoji || '', nextCategoryTags[0]),
        preferredWeightIncrementKg: typeof preferredWeightIncrementKg === 'number' && Number.isFinite(preferredWeightIncrementKg) && preferredWeightIncrementKg > 0
          ? preferredWeightIncrementKg
          : undefined,
        isDefault: existing?.isDefault ?? false,
        isActive,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    })
    .filter((exercise): exercise is ExerciseMaster => Boolean(exercise));

  if (issues.length > 0) {
    throw new ExerciseCsvImportError(issues);
  }

  return nextExercises;
}

export async function importExerciseCsv(csv: string): Promise<number> {
  const nextExercises = buildExerciseCsvImport(
    csv,
    await db.exercises.toArray(),
    new Date().toISOString(),
  );

  if (nextExercises.length === 0) return 0;

  await db.exercises.bulkPut(nextExercises);
  return nextExercises.length;
}
