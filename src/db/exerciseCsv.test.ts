import { describe, expect, it } from 'vitest';
import { buildExerciseCsvImport, ExerciseCsvImportError } from './exerciseCsv';

function throwImportError(issues: string[]) {
  throw new ExerciseCsvImportError(issues);
}

describe('ExerciseCsvImportError', () => {
  it('keeps row-level validation issues available for the UI', () => {
    expect(() => throwImportError(['Row 2: nameKo is required', 'Row 3: invalid categoryTags foo']))
      .toThrow('Row 2: nameKo is required');

    try {
      throwImportError(['Row 2: nameKo is required', 'Row 3: invalid categoryTags foo']);
    } catch (error) {
      expect(error).toBeInstanceOf(ExerciseCsvImportError);
      expect((error as ExerciseCsvImportError).issues).toEqual([
        'Row 2: nameKo is required',
        'Row 3: invalid categoryTags foo',
      ]);
    }
  });

  it('correctly aggregates multiple validation warning issues (Scenario B)', () => {
    const error = new ExerciseCsvImportError([
      'Row 2: duplicate id "ex_chest_press"',
      'Row 5: nameKo is required for "ex_squat"',
      'Row 8: invalid categoryTags crossfit',
      'Row 10: isActive parse error',
    ]);

    expect(error.issues).toHaveLength(4);
    expect(error.issues[0]).toBe('Row 2: duplicate id "ex_chest_press"');
    expect(error.issues[1]).toContain('nameKo is required');
    expect(error.issues[2]).toContain('invalid categoryTags');
    expect(error.message).toContain('Row 5: nameKo is required');
  });
});

describe('buildExerciseCsvImport', () => {
  const now = '2026-05-21T09:30:00.000Z';

  it('rejects imports with missing required columns', () => {
    expect(() => buildExerciseCsvImport('id,nameKo\nbench_press,Bench Press KO', [], now))
      .toThrow('Missing required columns: nameEn, categoryTags, stageTags, description, icon, isActive');
  });

  it('aggregates row validation issues before any exercise write', () => {
    const csv = [
      'id,nameKo,nameEn,categoryTags,stageTags,description,icon,isActive',
      'bench_press,Bench Press KO,Bench Press,chest,main,,,true',
      'bench_press,,Bench Press,crossfit,finisher,,,maybe',
    ].join('\n');

    expect(() => buildExerciseCsvImport(csv, [], now)).toThrow(ExerciseCsvImportError);

    try {
      buildExerciseCsvImport(csv, [], now);
    } catch (error) {
      expect(error).toBeInstanceOf(ExerciseCsvImportError);
      expect((error as ExerciseCsvImportError).issues).toEqual(expect.arrayContaining([
        'Row 3: duplicate id "bench_press"',
        'Row 3: nameKo is required for "bench_press"',
        'Row 3: invalid categoryTags crossfit',
        'Row 3: invalid stageTags finisher',
        'Row 3: categoryTags is required for new exercise "bench_press"',
        'Row 3: stageTags is required for new exercise "bench_press"',
        'Row 3: Invalid boolean value: maybe',
      ]));
    }
  });
});
