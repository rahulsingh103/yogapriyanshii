import fs from 'fs';
import path from 'path';
import type { Client, Transaction } from '@libsql/client';
import { getConfig } from './config.js';
import { migrate } from './migrate.js';
import { HttpError } from './validate.js';

const UNAVAILABLE = "Booking is temporarily unavailable. Please try again shortly or contact the studio directly.";

let clientPromise: Promise<Client> | null = null;
let isFileDb = false;

function filePathOf(url: string): string {
  return url.replace(/^file:/, '');
}

async function open(): Promise<Client> {
  const { db, mode } = getConfig();
  if (db.kind === 'none') throw new HttpError(503, UNAVAILABLE);

  if (db.kind === 'remote') {
    // The web client speaks HTTP only, so it runs on Vercel without native modules.
    const { createClient } = await import('@libsql/client/web');
    return createClient({ url: db.url, authToken: db.authToken });
  }

  const file = filePathOf(db.url);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  if (mode === 'test') {
    // Every test run starts from an empty database.
    for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(path.resolve(file) + suffix, { force: true });
  }
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url: db.url });
  isFileDb = true;
  await client.execute('PRAGMA journal_mode = WAL');
  // Local files migrate themselves; the live Turso DB only migrates via `npm run db:migrate:live`.
  await migrate(client);
  return client;
}

export function getDb(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = open().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function isBusy(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const text = `${e?.code ?? ''} ${e?.message ?? ''}`;
  return /SQLITE_BUSY|database is locked/i.test(text);
}

// Local file DBs run their transactions one at a time inside this process: the native driver
// blocks the event loop while waiting on a lock, so two overlapping writers would deadlock.
let fileTxChain: Promise<unknown> = Promise.resolve();

async function runOnce<T>(client: Client, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await client.transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* the transaction may already be closed */
    }
    throw err;
  } finally {
    tx.close();
  }
}

/** Runs `fn` in one write transaction. Retries SQLITE_BUSY 3 times, then answers 503. */
export async function withWriteTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const client = await getDb();
  const attempt = async (): Promise<T> => {
    for (let i = 0; ; i++) {
      try {
        return await runOnce(client, fn);
      } catch (err) {
        if (!isBusy(err)) throw err;
        if (i >= 3) throw new HttpError(503, 'The studio is busy right now. Please try again in a moment.');
        await new Promise((r) => setTimeout(r, 50 * (i + 1) + Math.floor(Math.random() * 50)));
      }
    }
  };
  if (!isFileDb) return attempt();
  const run = fileTxChain.then(attempt, attempt);
  fileTxChain = run.catch(() => undefined);
  return run;
}
