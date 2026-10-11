import crypto from 'crypto';
import { defineConfig, devices } from '@playwright/test';
import { TEST_ADMIN_PASSWORD } from './e2e/test-admin';

const PORT = 3100;

// Same format the server expects in production: scrypt$<salt-b64>$<hash-b64> (N=16384, r=8, p=1).
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(TEST_ADMIN_PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
const ADMIN_PASSWORD_HASH = `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;

export default defineConfig({
  testDir: './e2e',
  // One server and one throwaway database file per run, so specs run in order: the admin
  // lockout in 05 and the free-class state would otherwise leak between parallel workers.
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
    url: `http://localhost:${PORT}/api/health`,
    env: {
      PORT: String(PORT),
      // Test mode: a local file DB (wiped on start), emails captured in memory, no .env loaded.
      APP_ENV: 'test',
      LOCAL_DB_URL: 'file:.data/e2e.db',
      ADMIN_PASSWORD_HASH,
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
