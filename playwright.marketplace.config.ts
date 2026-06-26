import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(fileURLToPath(import.meta.url))
const e2eDb = path.join(root, '.e2e-marketplace.db')
const e2eArtifacts = path.join(root, '.e2e-artifacts')
const apiPort = 8791
const webPort = 5175
const apiUrl = `http://127.0.0.1:${apiPort}`
const webUrl = `http://127.0.0.1:${webPort}`

const marketplaceApiEnv = {
  LANGSTITCH_AUTH_ENABLED: 'true',
  LANGSTITCH_E2E_AUTH: 'true',
  LANGSTITCH_DATABASE_URL: `sqlite:///${e2eDb.replace(/\\/g, '/')}`,
  LANGSTITCH_ARTIFACTS_ROOT: e2eArtifacts,
  LANGSTITCH_FRONTEND_URL: webUrl,
  LANGSTITCH_API_BASE_URL: apiUrl,
  LANGSTITCH_ADMIN_EMAILS: 'dev@langstitch.com',
  LANGSTITCH_REVIEW_EMAIL: 'dev@langstitch.com',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'marketplace.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-marketplace' }]],
  timeout: 90_000,
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `python -m uvicorn server.main:app --reload --host 127.0.0.1 --port ${apiPort}`,
      url: `${apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: marketplaceApiEnv,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_PROXY_TARGET: apiUrl,
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
