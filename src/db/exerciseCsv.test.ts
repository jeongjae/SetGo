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
});
