import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ActualsPage } from './ActualsPage';

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

describe('ActualsPage touch targets', () => {
  it('keeps analysis and add-workout controls at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <ActualsPage
        onAddHistoricalWorkout={() => undefined}
        onEditHistoricalWorkout={() => undefined}
        onOpenStats={() => undefined}
      />,
    );

    for (const label of ['View analysis', 'Add workout']) {
      expect(buttonClassByLabel(markup, label), label).toContain('min-h-11');
    }
  });
});
