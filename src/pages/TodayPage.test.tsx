import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TodayPage } from './TodayPage';

vi.mock('../i18n/i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('../i18n/i18n')>(),
  getStoredLocale: () => 'en' as const,
}));

function buttonClassesByLabel(markup: string, label: string): string[] {
  return [...markup.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs)]
    .filter(([, , content]) => content.replace(/<[^>]+>/g, '').trim() === label)
    .map(([, attributes]) => attributes.match(/class="([^"]*)"/)?.[1] ?? '');
}

describe('TodayPage touch targets', () => {
  it('keeps every AI coaching control at least 44px high', () => {
    const markup = renderToStaticMarkup(
      <TodayPage refreshKey={0} onStartWorkout={() => undefined} />,
    );
    const classes = buttonClassesByLabel(markup, 'Get AI coaching');

    expect(classes.length).toBeGreaterThan(0);
    for (const className of classes) {
      expect(className).toContain('min-h-11');
    }
  });
});
