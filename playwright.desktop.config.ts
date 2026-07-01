import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/desktop',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  globalSetup: './e2e/desktop/global-setup.ts',
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
    },
  ],
})
