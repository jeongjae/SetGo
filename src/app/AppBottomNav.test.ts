import { describe, expect, it } from 'vitest';
import { browseActiveView, primaryNavigationViews } from './AppBottomNav';

describe('bottom navigation model', () => {
  it('uses the v3 Strong/Hevy-style 5-tab app skeleton', () => {
    expect(primaryNavigationViews).toEqual(['today', 'routines', 'history', 'insights', 'more']);
  });

  it('keeps routine planning subpages under Routines and data tools under More', () => {
    expect(browseActiveView('routines')).toBe('routines');
    expect(browseActiveView('exercises')).toBe('routines');
    expect(browseActiveView('weeklyPlan')).toBe('routines');
    expect(browseActiveView('calendar')).toBe('routines');
    expect(browseActiveView('export')).toBe('more');
  });
});
