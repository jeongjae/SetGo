import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StatsPage } from './StatsPage';

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

describe('StatsPage touch targets', () => {
  it('keeps the records-calendar control at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <StatsPage onOpenActuals={() => undefined} />,
    );

    expect(buttonClassByLabel(markup, 'Records calendar')).toContain('min-h-11');
  });
});
