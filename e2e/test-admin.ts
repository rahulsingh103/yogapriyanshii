// A password that exists only for the e2e run. playwright.config.ts hashes it into
// ADMIN_PASSWORD_HASH for the test server; it is never valid anywhere else.
export const TEST_ADMIN_PASSWORD = 'e2e-only-admin-password-not-real';
