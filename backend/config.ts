// The only module that reads process.env. Everything else asks for a resolved config.

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
}

const DEFAULT_EMAIL_FROM = 'Priyanshi · YogaPriyanshi <priyanshi@yogapriyanshi.com>';
const DEFAULT_TEST_DB = 'file:.data/e2e.db';
const DEFAULT_DEV_DB = 'file:.data/dev.db';

let cached: AppConfig | null = null;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
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
  };
  return cached;
}
