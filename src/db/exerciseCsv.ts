import { db } from './db';
import type { ExerciseCategory, ExerciseMaster, ExerciseStage } from '../types';

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
  'isActive',
];

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

export async function createExerciseCsv(): Promise<string> {
  const exercises = await db.exercises.orderBy('id').toArray();
  const rows = exercises.map((exercise) => [
    exercise.id,
    exercise.nameKo,
    exercise.nameEn ?? '',
    (exercise.categoryTags?.length ? exercise.categoryTags : [exercise.category]).join('|'),
    (exercise.stageTags?.length ? exercise.stageTags : [exercise.stage]).join('|'),
    exercise.description ?? '',
    exercise.defaultEmoji,
    exercise.isActive ? 'true' : 'false',
  ]);

  return [csvHeaders, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}

export async function importExerciseCsv(csv: string): Promise<number> {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, '').trim());
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return 0;

  const headerIndex = new Map(headerRow.map((header, index) => [header.trim().replace(/^\uFEFF/, ''), index]));
  const now = new Date().toISOString();
  const existingExercises = await db.exercises.toArray();
  const existingById = new Map(existingExercises.map((exercise) => [exercise.id, exercise]));

  const nextExercises = dataRows
    .map((row): ExerciseMaster | undefined => {
      const read = (key: string) => row[headerIndex.get(key) ?? -1]?.trim() ?? '';
      const id = read('id') || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const existing = existingById.get(id);
      const categoryTags = splitTags(read('categoryTags'), exerciseCategories, existing?.category ?? 'chest');
      const stageTags = splitTags(read('stageTags'), exerciseStages, existing?.stage ?? 'main');
      const nameKo = read('nameKo') || existing?.nameKo;
      const nameEn = read('nameEn') || existing?.nameEn || nameKo;

      if (!nameKo) return undefined;

      return {
        id,
        nameKo,
        nameEn,
        category: categoryTags[0],
        categoryTags,
        stage: stageTags[0],
        stageTags,
        description: read('description') || undefined,
        defaultEmoji: read('icon') || existing?.defaultEmoji || categoryTags[0].slice(0, 2).toUpperCase(),
        isDefault: existing?.isDefault ?? false,
        isActive: read('isActive').toLowerCase() !== 'false',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    })
    .filter((exercise): exercise is ExerciseMaster => Boolean(exercise));

  if (nextExercises.length === 0) return 0;

  await db.exercises.bulkPut(nextExercises);
  return nextExercises.length;
}
