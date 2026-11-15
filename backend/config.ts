// The only module that reads process.env. Everything else asks for a resolved config.
import crypto from 'crypto';

export type AppMode = 'test' | 'development' | 'production';

export type DbTarget =
  | { kind: 'file'; url: string }
  | { kind: 'remote'; url: string; authToken: string }
  | { kind: 'none'; reason: string };

export type EmailTransport =
  | { kind: 'resend'; apiKey: string }
  | { kind: 'outbox' }
  | { kind: 'log' }
  | { kind: 'none' };

export interface AppConfig {
  mode: AppMode;
  onVercel: boolean;
  db: DbTarget;
  email: EmailTransport;
  emailFrom: string;
  adminPasswordHash: string | null;
  testRoutes: boolean;
  /** Keys the login-code and rate-limit HMACs. Null only in production without ACCOUNT_SECRET: accounts answer 503. */
  accountSecret: string | null;
  /** Session cookies carry Secure in production only. */
  secureCookies: boolean;
  /** The base of the links in emails. */
  siteUrl: string;
}

const DEFAULT_EMAIL_FROM = 'Priyanshi · YogaPriyanshi <priyanshi@yogapriyanshi.com>';
const DEFAULT_TEST_DB = 'file:.data/e2e.db';
const DEFAULT_DEV_DB = 'file:.data/dev.db';
/** Equal to SITE_URL in src/lib/page-meta.ts (spec 16 checks it; backend/ never imports from src/). */
export const PRODUCTION_SITE_URL = 'https://www.yogapriyanshi.com';

let cached: AppConfig | null = null;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** Shorter than 32 characters is too weak to key the HMACs, so it counts as not set. */
const MIN_SECRET_LENGTH = 32;
export function accountSecretFrom(value: string | undefined): string | null {
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

function resolveMode(): AppMode {
  if (env('APP_ENV') === 'test') return 'test';
  if (env('VERCEL_ENV') === 'production') return 'production';
  if (env('VERCEL')) return 'production'; // previews are handled below: they get no DB
  // Off Vercel, NODE_ENV=production alone never reaches the live database or real email:
  // it also needs an explicit ALLOW_LIVE=1. Without it, it runs exactly like development.
  if (env('NODE_ENV') === 'production' && env('ALLOW_LIVE') === '1') return 'production';
  return 'development';
}

function remoteDb(): DbTarget {
  const url = env('TURSO_DATABASE_URL');
  const authToken = env('TURSO_AUTH_TOKEN');
  if (!url || !authToken) return { kind: 'none', reason: 'database not configured' };
  return { kind: 'remote', url, authToken };
}

export function getConfig(): AppConfig {
  if (cached) return cached;
  const mode = resolveMode();
  const onVercel = Boolean(env('VERCEL'));
  const emailFrom = env('EMAIL_FROM') ?? DEFAULT_EMAIL_FROM;
  const adminPasswordHash = env('ADMIN_PASSWORD_HASH') ?? null;

  if (mode === 'test') {
    if (onVercel) throw new Error('APP_ENV=test is not allowed on Vercel.');
    const url = env('LOCAL_DB_URL') ?? DEFAULT_TEST_DB;
    // Tests must never reach a remote database or a real mail provider.
    if (!url.startsWith('file:')) throw new Error('Test mode requires a file: LOCAL_DB_URL.');
    cached = {
      mode,
      onVercel,
      db: { kind: 'file', url },
      email: { kind: 'outbox' },
      emailFrom,
      adminPasswordHash,
      testRoutes: true,
      // Per boot: codes and limits don't outlive this server, and test mode wipes the database anyway.
      accountSecret: accountSecretFrom(env('ACCOUNT_SECRET')) ?? crypto.randomBytes(32).toString('hex'),
      secureCookies: false,
      // Preview links stay on this machine.
      siteUrl: `http://localhost:${env('PORT') ?? '3000'}`,
    };
    return cached;
  }

  if (mode === 'development') {
    const useTurso = env('DB_TARGET') === 'turso';
    const local = env('LOCAL_DB_URL') ?? DEFAULT_DEV_DB;
    const resendKey = env('RESEND_API_KEY');
    cached = {
      mode,
      onVercel,
      db: useTurso ? remoteDb() : local.startsWith('file:') ? { kind: 'file', url: local } : { kind: 'none', reason: 'LOCAL_DB_URL must be a file: URL' },
      email: env('EMAIL_TRANSPORT') === 'resend' && resendKey ? { kind: 'resend', apiKey: resendKey } : { kind: 'log' },
      emailFrom,
      adminPasswordHash,
      testRoutes: false,
      accountSecret: accountSecretFrom(env('ACCOUNT_SECRET')) ?? crypto.randomBytes(32).toString('hex'),
      secureCookies: false,
      siteUrl: PRODUCTION_SITE_URL,
    };
    return cached;
  }

  // production
  const isPreview = onVercel && env('VERCEL_ENV') !== 'production';
  const resendKey = env('RESEND_API_KEY');
  cached = {
    mode,
    onVercel,
    db: isPreview ? { kind: 'none', reason: 'preview deployments have no database' } : remoteDb(),
    email: !isPreview && resendKey ? { kind: 'resend', apiKey: resendKey } : { kind: 'none' },
    emailFrom,
    adminPasswordHash: isPreview ? null : adminPasswordHash,
    testRoutes: false,
    accountSecret: isPreview ? null : accountSecretFrom(env('ACCOUNT_SECRET')),
    secureCookies: true,
    siteUrl: PRODUCTION_SITE_URL,
  };
  return cached;
}
