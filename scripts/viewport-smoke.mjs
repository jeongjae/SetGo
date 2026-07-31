// Boots the production preview-equivalent dev server and walks the five primary
// tabs plus routine-created setup states at the target iPhone widths, asserting
// no horizontal overflow, undersized visible controls, or console/page errors.
// Run with: node ./scripts/viewport-smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const port = 4185;
const host = '127.0.0.1';
const url = `http://${host}:${port}`;
const minimumControlSizePx = 44;
const interactiveControlSelector = 'button, select, a[role="button"], [role="button"]';

// width x height for the supported 375/390/414/427-class iPhone viewports.
const viewports = [
  { label: '375x812', width: 375, height: 812 },
  { label: '390x844', width: 390, height: 844 },
  { label: '414x896', width: 414, height: 896 },
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

async function visibleContentControlCount(page) {
  return page.evaluate((selector) => {
    const primaryNav = document.querySelector('nav[aria-label="Primary navigation"]');
    return Array.from(document.querySelectorAll(selector))
      .filter((control) => !primaryNav?.contains(control) && control.checkVisibility())
      .length;
  }, interactiveControlSelector);
}

async function waitForVisibleControlsToSettle(page, timeoutMs = 5_000) {
  const startedAt = Date.now();
  let previousCount = -1;
  let stableSamples = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const count = await visibleContentControlCount(page);
    if (count > 0 && count === previousCount) {
      stableSamples += 1;
      if (stableSamples >= 5) return;
    } else {
      stableSamples = 0;
    }
    previousCount = count;
    await page.waitForTimeout(100);
  }

  throw new Error('Timed out waiting for visible controls to settle');
}

async function checkVisibleControlSizes(page) {
  return page.evaluate(({ minimumSizePx, selector }) => {
    const visibleControls = Array.from(document.querySelectorAll(selector))
      .filter((control) => control.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }));

    return {
      count: visibleControls.length,
      iconButtonCount: visibleControls.filter((control) => {
        if (!control.matches('button, a[role="button"], [role="button"]')) return false;
        const visibleText = control.innerText?.trim() ?? '';
        return visibleText.length === 0 || !/[\p{L}\p{N}]/u.test(visibleText);
      }).length,
      violations: visibleControls
        .map((control, index) => {
          const { height, width } = control.getBoundingClientRect();
          const visibleText = control.innerText?.trim() ?? '';
          const isIconButton = (
            control.matches('button, a[role="button"], [role="button"]')
            && (visibleText.length === 0 || !/[\p{L}\p{N}]/u.test(visibleText))
          );
          const textLabel = control.textContent?.trim();
          const label = (
            control.getAttribute('aria-label')
            || textLabel
            || control.getAttribute('title')
            || control.getAttribute('name')
            || `${control.tagName.toLowerCase()}#${index + 1}`
          ).trim().replace(/\s+/g, ' ').slice(0, 80);
          const failedDimensions = [];
          if (height < minimumSizePx) failedDimensions.push('height');
          if (isIconButton && width < minimumSizePx) failedDimensions.push('width');
          return {
            failedDimensions,
            height,
            isIconButton,
            label,
            tag: control.tagName.toLowerCase(),
            width,
          };
        })
        .filter(({ failedDimensions }) => failedDimensions.length > 0),
    };
  }, { minimumSizePx: minimumControlSizePx, selector: interactiveControlSelector });
}

async function checkState(page, viewportLabel, stateLabel, failures) {
  await waitForVisibleControlsToSettle(page);
  const overflow = await checkOverflow(page);
  if (overflow > 1) {
    failures.push(`${viewportLabel} ${stateLabel}: horizontal overflow ${overflow}px`);
  }

  const controlSizes = await checkVisibleControlSizes(page);
  for (const {
    failedDimensions, height, isIconButton, label, tag, width,
  } of controlSizes.violations) {
    const measurements = failedDimensions
      .map((dimension) => `${dimension} ${dimension === 'height' ? height.toFixed(2) : width.toFixed(2)}px`)
      .join(', ');
    failures.push(
      `${viewportLabel} ${stateLabel}: visible ${isIconButton ? 'icon ' : ''}${tag} `
      + `"${label}" ${measurements} < ${minimumControlSizePx}px`,
    );
  }

  return controlSizes;
}

async function createRoutineAndCheckSegments(page, viewportLabel, failures) {
  const creatorToggle = page.locator('button[aria-expanded]');
  if (await creatorToggle.count() !== 1) {
    throw new Error(`${viewportLabel}: expected one routine creator toggle`);
  }
  await creatorToggle.click();

  const createButtons = page.locator('button[aria-expanded="true"] + div > button');
  const createButtonCount = await createButtons.count();
  if (createButtonCount === 0) {
    throw new Error(`${viewportLabel}: routine creation actions did not appear`);
  }
  await createButtons.first().click();

  const activeRoutineSelect = page.locator('select').first();
  await activeRoutineSelect.waitFor({ state: 'visible', timeout: 5_000 });

  const setupSegments = page.locator('header').getByRole('button');
  const segmentCount = await setupSegments.count();
  if (segmentCount !== 3) {
    throw new Error(`${viewportLabel}: expected three routine setup segments, found ${segmentCount}`);
  }
  const segmentLabels = await setupSegments.allTextContents();
  const stateResults = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const segmentLabel = segmentLabels[index]?.trim() || `segment#${index}`;
    await setupSegments.nth(index).click();
    const result = await checkState(
      page,
      viewportLabel,
      `Routines / created / ${segmentLabel}`,
      failures,
    );
    stateResults.push(result);
  }

  return stateResults;
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
    let checkedControlCount = 0;
    let checkedIconButtonCount = 0;
    let checkedStateCount = 0;

    for (let index = 0; index < tabCount; index += 1) {
      const tabLabel = tabLabels[index]?.trim() || `tab#${index}`;
      await tabs.nth(index).click();
      const tabResult = await checkState(page, viewport.label, `${tabLabel} / empty`, failures);
      checkedControlCount += tabResult.count;
      checkedIconButtonCount += tabResult.iconButtonCount;
      checkedStateCount += 1;

      // The Routines tab is the second item in the product's fixed primary shell.
      if (index === 1) {
        const routineResults = await createRoutineAndCheckSegments(page, viewport.label, failures);
        for (const result of routineResults) {
          checkedControlCount += result.count;
          checkedIconButtonCount += result.iconButtonCount;
          checkedStateCount += 1;
        }
      }
    }

    if (errors.length > 0) {
      failures.push(`${viewport.label}: console/page errors -> ${errors.join(' | ')}`);
    }
    console.log(
      `  checked ${viewport.label}: ${checkedStateCount} states, ${checkedControlCount} visible controls `
      + `(${checkedIconButtonCount} icon buttons), size>=${minimumControlSizePx}px, `
      + `overflow<=1px, errors=${errors.length}`,
    );
    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    console.error('\nViewport smoke FAILURES:');
    failures.forEach((failure) => console.error(`  - ${failure}`));
    return 1;
  }
  console.log('\nViewport smoke passed for all target widths and routine setup states.');
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
