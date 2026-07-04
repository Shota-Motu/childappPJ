import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type SyncStatus = 'local' | 'pending' | 'synced';
export type EntrySource = 'camera' | 'import';

export interface Entry {
  date: string; // 'YYYY-MM-DD'（1日1本の制約 = 主キー）
  video_path: string; // documentDirectory からの相対パス
  thumb_path: string;
  duration_ms: number;
  source: EntrySource;
  content_hash: string | null;
  sync_status: SyncStatus;
  remote_url: string | null;
  created_at: string;
  updated_at: string;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS entries (
      date         TEXT PRIMARY KEY,
      video_path   TEXT NOT NULL,
      thumb_path   TEXT NOT NULL,
      duration_ms  INTEGER NOT NULL DEFAULT 1000,
      source       TEXT NOT NULL DEFAULT 'camera',
      content_hash TEXT,
      sync_status  TEXT NOT NULL DEFAULT 'local',
      remote_url   TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('child-app.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

export async function upsertEntry(
  entry: Omit<Entry, 'created_at' | 'updated_at' | 'sync_status' | 'remote_url'>,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  // 同日上書き（撮り直し）は updated_at ベースで「新しい方が勝つ」仕様
  await db.runAsync(
    `INSERT INTO entries (date, video_path, thumb_path, duration_ms, source, content_hash, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'local', ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       video_path   = excluded.video_path,
       thumb_path   = excluded.thumb_path,
       duration_ms  = excluded.duration_ms,
       source       = excluded.source,
       content_hash = excluded.content_hash,
       sync_status  = 'local',
       updated_at   = excluded.updated_at`,
    entry.date,
    entry.video_path,
    entry.thumb_path,
    entry.duration_ms,
    entry.source,
    entry.content_hash,
    now,
    now,
  );
}

export async function getEntry(date: string): Promise<Entry | null> {
  const db = await getDb();
  return db.getFirstAsync<Entry>('SELECT * FROM entries WHERE date = ?', date);
}

/** month: 'YYYY-MM' */
export async function getEntriesForMonth(month: string): Promise<Entry[]> {
  const db = await getDb();
  return db.getAllAsync<Entry>(
    "SELECT * FROM entries WHERE date LIKE ? || '-%' ORDER BY date ASC",
    month,
  );
}

export async function countEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entries');
  return row?.n ?? 0;
}

/** 今日（または昨日）から遡った連続記録日数 */
export async function getStreak(today: string): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM entries WHERE date <= ? ORDER BY date DESC LIMIT 366',
    today,
  );
  if (rows.length === 0) return 0;

  const cursor = new Date(`${today}T00:00:00`);
  const recorded = new Set(rows.map((r) => r.date));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // 今日が未記録でも昨日まで続いていればストリーク継続とみなす
  if (!recorded.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (recorded.has(fmt(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
