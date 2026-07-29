import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MorePage } from './MorePage';

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

describe('MorePage touch targets', () => {
  it('keeps goal, language, and save controls at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <MorePage onNavigate={() => undefined} onLocaleChanged={() => undefined} />,
    );

    for (const label of ['Gain', 'Keep', '한국어', 'EN', 'Save']) {
      expect(buttonClassByLabel(markup, label), label).toContain('min-h-11');
    }
  });

  it('keeps the EN language control at least 44px wide', () => {
    const markup = renderToStaticMarkup(
      <MorePage onNavigate={() => undefined} onLocaleChanged={() => undefined} />,
    );

    expect(buttonClassByLabel(markup, 'EN')).toContain('min-w-11');
  });
});
