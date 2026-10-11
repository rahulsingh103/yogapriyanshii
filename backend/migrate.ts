import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Client } from '@libsql/client';

function migrationsDir(): string {
  return fileURLToPath(new URL('../db/migrations/', import.meta.url));
}

/** Splits a migration file into statements. Statements end with `;` at the end of a line. */
function statementsOf(sql: string): string[] {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Applies every `db/migrations/NNN_*.sql` not yet recorded in `schema_migrations`, in order.
 * Each file runs as one atomic batch, so a failed file leaves nothing behind. Safe to re-run.
 */
export async function migrate(client: Client, log: (line: string) => void = () => {}): Promise<string[]> {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)'
  );
  const appliedRows = await client.execute('SELECT version FROM schema_migrations');
  const applied = new Set(appliedRows.rows.map((r) => String(r.version)));

  const dir = migrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort();

  const done: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await client.batch(
      [
        ...statementsOf(sql),
        { sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', args: [version, new Date().toISOString()] },
      ],
      'write'
    );
    done.push(version);
    log(`applied ${version}`);
  }
  return done;
}
