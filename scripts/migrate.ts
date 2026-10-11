// Applies db/migrations to a database.
//   npm run db:migrate        -> the local dev file (LOCAL_DB_URL, default file:.data/dev.db)
//   npm run db:migrate:live   -> the live Turso DB (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Human-run only.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { Client } from '@libsql/client';
import { migrate } from '../backend/migrate.js';

dotenv.config({ quiet: true });

const live = process.argv.includes('--live');

async function connect(): Promise<{ client: Client; label: string }> {
  if (live) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set for --live.');
    const { createClient } = await import('@libsql/client/web');
    return { client: createClient({ url, authToken }), label: 'live Turso database' };
  }
  const url = process.env.LOCAL_DB_URL?.trim() || 'file:.data/dev.db';
  if (!url.startsWith('file:')) throw new Error('LOCAL_DB_URL must be a file: URL. Use --live for Turso.');
  fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
  const { createClient } = await import('@libsql/client');
  return { client: createClient({ url }), label: url };
}

try {
  const { client, label } = await connect();
  console.log(`Migrating ${label}`);
  const applied = await migrate(client, (line) => console.log(line));
  console.log(applied.length ? `Done: ${applied.length} migration(s) applied.` : 'Already up to date.');
  client.close();
} catch (err) {
  console.error(`Migration failed: ${(err as Error).message}`);
  process.exitCode = 1;
}
