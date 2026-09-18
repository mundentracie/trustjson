import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
  // serves test/sample.json so the e2e test can open a JSON document
  webServer: {
    command: 'npx --yes http-server test -p 8080 -s',
    port: 8080,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
