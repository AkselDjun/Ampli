import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  },
  projects: [
    { name: 'phone', testIgnore: /perf\.spec/, use: { ...devices['Pixel 7'] } },
    { name: 'desktop', testIgnore: /perf\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'perf', testMatch: /perf\.spec/, fullyParallel: false, use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  }
});
