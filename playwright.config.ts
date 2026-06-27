import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Marketplace tests need LANGSTITCH_E2E_AUTH — run via playwright.marketplace.config.ts
  testIgnore: '**/marketplace.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:8787/api/health',
      // Always start a dedicated API for E2E so a developer's .env (auth on) cannot block tests.
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        LANGSTITCH_AUTH_ENABLED: 'false',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_APP_MODE: 'ide',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
