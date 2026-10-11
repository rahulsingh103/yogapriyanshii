import { getDb, withWriteTx } from './db.js';

// The only place the studio's addresses and links are read. They are data, not code.
export const SETTING_KEYS = ['notify_email', 'studio_email', 'drive_link'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rs = await db.execute({
    sql: 'SELECT key, value FROM settings WHERE key IN (?, ?, ?) LIMIT 10',
    args: [...SETTING_KEYS],
  });
  const out: Settings = { notify_email: '', studio_email: '', drive_link: '' };
  for (const row of rs.rows) out[String(row.key) as SettingKey] = String(row.value ?? '');
  return out;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await getSettings())[key];
}

export async function updateSettings(values: Partial<Settings>): Promise<Settings> {
  const entries = Object.entries(values).filter(([k, v]) => (SETTING_KEYS as readonly string[]).includes(k) && typeof v === 'string');
  if (entries.length) {
    await withWriteTx(async (tx) => {
      for (const [key, value] of entries) {
        await tx.execute({
          sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          args: [key, value as string],
        });
      }
    });
  }
  return getSettings();
}
