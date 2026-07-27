import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoutineSetupPage } from './RoutineSetupPage';

vi.mock('../i18n/i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('../i18n/i18n')>(),
  getStoredLocale: () => 'en' as const,
}));

function buttonClassByLabel(markup: string, label: string): string | undefined {
  const buttons = markup.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs);

  for (const [, attributes, content] of buttons) {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text !== label) continue;
    return attributes.match(/class="([^"]*)"/)?.[1];
  }

  return undefined;
}

describe('RoutineSetupPage touch targets', () => {
  it('keeps setup segments and routine day chips at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <RoutineSetupPage
        initialSection="routine"
        onRoutineSaved={() => undefined}
        onReviewCalendar={() => undefined}
        onStartRoutineDay={() => undefined}
      />,
    );

    for (const label of ['Routine', 'Workout Cycle', 'Exercise Library']) {
      expect(buttonClassByLabel(markup, label), label).toContain('min-h-11');
    }

    expect(RoutineSetupPage.toString()).toContain('min-h-11 shrink-0 rounded-full');
  });

  it('keeps routine management controls at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <RoutineSetupPage
        initialSection="routine"
        onRoutineSaved={() => undefined}
        onReviewCalendar={() => undefined}
        onStartRoutineDay={() => undefined}
      />,
    );

    for (const label of ['Rename', 'Copy', 'Delete', 'Create new routine+']) {
      expect(buttonClassByLabel(markup, label), label).toContain('min-h-11');
    }
  });
});
