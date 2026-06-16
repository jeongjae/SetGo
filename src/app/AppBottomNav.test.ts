import { describe, expect, it } from 'vitest';
import { browseActiveView, primaryNavigationViews } from './AppBottomNav';

describe('bottom navigation model', () => {
  it('uses the 4-tab app skeleton', () => {
    expect(primaryNavigationViews).toEqual(['today', 'calendar', 'records', 'more']);
  });

  it('keeps management subpages under More', () => {
    expect(browseActiveView('routines')).toBe('more');
    expect(browseActiveView('exercises')).toBe('more');
    expect(browseActiveView('weeklyPlan')).toBe('more');
    expect(browseActiveView('export')).toBe('more');
  });
});
