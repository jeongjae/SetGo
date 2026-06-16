import { describe, expect, it } from 'vitest';
import { recordsSubViews } from './RecordsPage';

describe('records tab structure', () => {
  it('starts with the actuals calendar and keeps analysis as the second view', () => {
    expect(recordsSubViews).toEqual(['actuals', 'stats']);
  });
});
