import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.SETGO_E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4183 --strictPort',
        url: 'http://127.0.0.1:4183',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        locale: 'ko-KR',
      },
    },
  ],
});
