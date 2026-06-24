// Drives the app at an iPhone viewport, seeds a quick workout, and saves screenshots
// of Today / Workout(+rest timer) / Insights for visual HIG review.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const port = 4186;
const host = '127.0.0.1';
const url = `http://${host}:${port}`;
const outDir = 'test-results/ui';

function spawnProcess(command, args) {
  return spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true });
}

async function waitForServer(timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
  await page.goto(url);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/01-today.png` });

  // Seed a free workout and log one set so Insights + rest timer have content.
  try {
    await page.locator('main > section footer button').first().click();
    await page.waitForTimeout(400);
    await page.locator('footer button').first().click();
    await page.waitForTimeout(400);
    await page.locator('button.group').first().click();
    await page.waitForTimeout(400);
    await page.getByLabel(/set 1 weight$/).fill('60');
    await page.getByLabel(/set 1 reps$/).fill('8');
    await page.getByLabel(/set 1 RIR$/).fill('2');
    await page.getByRole('button', { name: 'Complete set' }).first().click();
    await page.waitForTimeout(600);
    // Blur inputs so the floating rest timer (with notify toggle) is visible.
    await page.mouse.click(10, 400);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/02-workout-timer.png` });

    // Finish the workout so Insights has a completed session.
    await page.getByRole('button', { name: /운동 완료|^Complete$/ }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/03-finish.png` });
  } catch (error) {
    console.error('workout seeding failed:', error.message);
    await page.screenshot({ path: `${outDir}/02-workout-failed.png` });
  }

  // Navigate to Insights (4th of 5 primary tabs).
  try {
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    await nav.getByRole('button').nth(3).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/04-insights.png`, fullPage: true });
    const seg = page.locator('.ios-segmented button');
    if (await seg.count() >= 2) {
      await seg.nth(1).click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${outDir}/05-insights-4w.png`, fullPage: true });
    }
  } catch (error) {
    console.error('insights nav failed:', error.message);
    await page.screenshot({ path: `${outDir}/04-insights-failed.png`, fullPage: true });
  }

  await context.close();
  await browser.close();
  console.log('screenshots saved to', outDir);
}

async function main() {
  const server = spawnProcess(process.execPath, [
    './node_modules/vite/bin/vite.js', '--host', host, '--port', String(port), '--strictPort',
  ]);
  const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
  try {
    await waitForServer();
    await run();
    stop();
    process.exit(0);
  } catch (error) {
    stop();
    console.error(error);
    process.exit(1);
  }
}

void main();
