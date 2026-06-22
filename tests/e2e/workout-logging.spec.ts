import { expect, test, type Page } from '@playwright/test';

async function expectNoAppConsoleErrors(page: Page, action: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await action();

  expect(errors).toEqual([]);
}

test('renders the mobile Today screen without framework errors', async ({ page }) => {
  await expectNoAppConsoleErrors(page, async () => {
    await page.goto('/');

    await expect(page).toHaveTitle('SetGo');
    await expect(page.getByText('SetGo')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(nav.getByRole('button', { name: '오늘' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '계획' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '기록' })).toBeVisible();
    await expect(nav.getByRole('button', { name: '더보기' })).toBeVisible();
    await expect(page.getByText(/Internal server error|Failed to fetch|Something went wrong/)).toHaveCount(0);
  });
});

test('starts a free workout and logs the first bench press set', async ({ page }) => {
  await expectNoAppConsoleErrors(page, async () => {
    await page.goto('/');

    await page.getByRole('button', { name: '자유', exact: true }).click();
    await page.getByRole('button', { name: '자유 운동 시작' }).click();

    await expect(page.getByLabel('Session memo')).toBeVisible();
    await expect(page.getByText('로컬 저장됨')).toBeVisible();

    await page.getByRole('button', { name: '운동 추가' }).first().click();
    await expect(page.getByLabel('Search exercises to add')).toBeVisible();

    await page.getByRole('button', { name: /^🏋️‍♂️ 벤치프레스/ }).click();
    await expect(page.getByLabel('벤치프레스 set 1 weight')).toBeVisible();

    await page.getByLabel('벤치프레스 set 1 weight').fill('60');
    await page.getByLabel('벤치프레스 set 1 reps').fill('8');
    await page.getByLabel('벤치프레스 set 1 RIR').fill('2');
    await page.getByRole('button', { name: 'Complete set' }).first().click();

    await expect(page.getByText('1 / 3 Sets')).toBeVisible();
    await expect(page.getByText(/완료 전 요약/)).toBeVisible();
  });
});
