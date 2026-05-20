import { describe, expect, it } from 'vitest';
import { ExerciseCsvImportError } from './exerciseCsv';

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
