import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  // The server keeps all data in memory, so specs run one at a time against a
  // fresh server each run (admin lockout and free-class state would otherwise leak).
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx tsx server.ts',
    url: `http://localhost:${PORT}/api/classes`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
