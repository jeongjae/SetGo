// Boots the production preview-equivalent dev server and walks the five primary
// tabs at the three target iPhone widths, asserting no horizontal overflow,
// undersized visible buttons, or console/page errors.
// Run with: node ./scripts/viewport-smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const port = 4185;
const host = '127.0.0.1';
const url = `http://${host}:${port}`;
const minimumButtonHeightPx = 44;

// width x height for 375/390/427-class iPhone viewports.
const viewports = [
  { label: '375x812', width: 375, height: 812 },
  { label: '390x844', width: 390, height: 844 },
  { label: '427x926', width: 427, height: 926 },
];

function spawnProcess(command, args) {
  return spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true });
}

async function waitForServer(timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
}

async function visibleContentButtonCount(page) {
  return page.evaluate(() => {
    const primaryNav = document.querySelector('nav[aria-label="Primary navigation"]');
    return Array.from(document.querySelectorAll('button'))
      .filter((button) => !primaryNav?.contains(button) && button.checkVisibility())
      .length;
  });
}

async function waitForVisibleButtonsToSettle(page, timeoutMs = 5_000) {
  const startedAt = Date.now();
  let previousCount = -1;
  let stableSamples = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const count = await visibleContentButtonCount(page);
    if (count > 0 && count === previousCount) {
      stableSamples += 1;
      if (stableSamples >= 5) return;
    } else {
      stableSamples = 0;
    }
    previousCount = count;
    await page.waitForTimeout(100);
  }

  throw new Error('Timed out waiting for visible tab buttons to settle');
}

async function checkVisibleButtonHeights(page) {
  return page.evaluate((minimumHeightPx) => {
    const visibleButtons = Array.from(document.querySelectorAll('button'))
      .filter((button) => button.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }));

    return {
      count: visibleButtons.length,
      violations: visibleButtons
        .map((button, index) => {
          const height = button.getBoundingClientRect().height;
          const textLabel = button.textContent?.trim();
          const label = (
            button.getAttribute('aria-label')
            || textLabel
            || button.getAttribute('title')
            || `button#${index + 1}`
          ).trim().replace(/\s+/g, ' ').slice(0, 80);
          return { height, label };
        })
        .filter(({ height }) => height < minimumHeightPx),
    };
  }, minimumButtonHeightPx);
}

async function run() {
  const browser = await chromium.launch();
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(url);
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const tabs = nav.getByRole('button');
    const tabCount = await tabs.count();
    const tabLabels = await tabs.allTextContents();
    let checkedButtonCount = 0;

    for (let index = 0; index < tabCount; index += 1) {
      const tabLabel = tabLabels[index]?.trim() || `tab#${index}`;
      await tabs.nth(index).click();
      await waitForVisibleButtonsToSettle(page);
      const overflow = await checkOverflow(page);
      if (overflow > 1) {
        failures.push(`${viewport.label} ${tabLabel}: horizontal overflow ${overflow}px`);
      }

      const buttonHeights = await checkVisibleButtonHeights(page);
      checkedButtonCount += buttonHeights.count;
      for (const { height, label } of buttonHeights.violations) {
        failures.push(
          `${viewport.label} ${tabLabel}: visible button "${label}" height `
          + `${height.toFixed(2)}px < ${minimumButtonHeightPx}px`,
        );
      }
    }

    if (errors.length > 0) {
      failures.push(`${viewport.label}: console/page errors -> ${errors.join(' | ')}`);
    }
    console.log(
      `  checked ${viewport.label}: ${tabCount} tabs, ${checkedButtonCount} visible buttons, `
      + `height>=${minimumButtonHeightPx}px, overflow<=1px, errors=${errors.length}`,
    );
    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    console.error('\nViewport smoke FAILURES:');
    failures.forEach((failure) => console.error(`  - ${failure}`));
    return 1;
  }
  console.log('\nViewport smoke passed for all target widths.');
  return 0;
}

async function main() {
  const server = spawnProcess(process.execPath, [
    './node_modules/vite/bin/vite.js', '--host', host, '--port', String(port), '--strictPort',
  ]);
  const stopServer = () => {
    if (!server.killed) server.kill('SIGTERM');
  };
  try {
    await waitForServer();
    const code = await run();
    stopServer();
    process.exit(code);
  } catch (error) {
    stopServer();
    console.error(error);
    process.exit(1);
  }
}

void main();
