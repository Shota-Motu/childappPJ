import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { toDateString } from '@/lib/dates';

export type SyncStatus = 'local' | 'pending' | 'synced';
export type EntrySource = 'camera' | 'import';

/** 複数の子供対応（フェーズ3）まではこの固定IDを使う */
export const DEFAULT_CHILD_ID = 1;

export interface Entry {
  child_id: number;
  date: string; // 'YYYY-MM-DD'（child_id との複合主キー = 1日1本の制約）
  video_path: string; // documentDirectory からの相対パス
  thumb_path: string; // サムネイル生成に失敗した場合は ''（表示側でプレースホルダー）
  duration_ms: number; // 動画ファイル全体の長さ（約3000ms。再生窓は1秒）
  clip_start_ms: number; // 「ベスト1秒」の開始位置。再生・書き出しはここから1秒
  source: EntrySource;
  content_hash: string | null;
  sync_status: SyncStatus;
  remote_url: string | null;
  created_at: string;
  updated_at: string;
}

// PRAGMA user_version で管理する順序付きマイグレーション。
// スキーマ変更は必ず末尾に追記する（過去の要素は書き換えない）
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS entries (
    child_id     INTEGER NOT NULL DEFAULT 1,
    date         TEXT NOT NULL,
    video_path   TEXT NOT NULL,
    thumb_path   TEXT NOT NULL DEFAULT '',
    duration_ms  INTEGER NOT NULL DEFAULT 1000,
    source       TEXT NOT NULL DEFAULT 'camera',
    content_hash TEXT,
    sync_status  TEXT NOT NULL DEFAULT 'local',
    remote_url   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    PRIMARY KEY (child_id, date)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  `,
  // v2: 3秒録画からベスト1秒を選ぶ方式（再生ウィンドウ）
  `ALTER TABLE entries ADD COLUMN clip_start_ms INTEGER NOT NULL DEFAULT 0;`,
];

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.execAsync(MIGRATIONS[v]);
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
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
  entry: Omit<
    Entry,
    'child_id' | 'created_at' | 'updated_at' | 'sync_status' | 'remote_url'
  > & { child_id?: number },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  // 同日上書き（撮り直し）は updated_at ベースで「新しい方が勝つ」仕様
  await db.runAsync(
    `INSERT INTO entries (child_id, date, video_path, thumb_path, duration_ms, clip_start_ms, source, content_hash, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)
     ON CONFLICT(child_id, date) DO UPDATE SET
       video_path    = excluded.video_path,
       thumb_path    = excluded.thumb_path,
       duration_ms   = excluded.duration_ms,
       clip_start_ms = excluded.clip_start_ms,
       source        = excluded.source,
       content_hash  = excluded.content_hash,
       sync_status   = 'local',
       updated_at    = excluded.updated_at`,
    entry.child_id ?? DEFAULT_CHILD_ID,
    entry.date,
    entry.video_path,
    entry.thumb_path,
    entry.duration_ms,
    entry.clip_start_ms,
    entry.source,
    entry.content_hash,
    now,
    now,
  );
}

export async function getEntry(
  date: string,
  childId: number = DEFAULT_CHILD_ID,
): Promise<Entry | null> {
  const db = await getDb();
  return db.getFirstAsync<Entry>(
    'SELECT * FROM entries WHERE child_id = ? AND date = ?',
    childId,
    date,
  );
}

/** month: 'YYYY-MM' */
export async function getEntriesForMonth(
  month: string,
  childId: number = DEFAULT_CHILD_ID,
): Promise<Entry[]> {
  const db = await getDb();
  return db.getAllAsync<Entry>(
    "SELECT * FROM entries WHERE child_id = ? AND date LIKE ? || '-%' ORDER BY date ASC",
    childId,
    month,
  );
}

export async function countEntries(childId: number = DEFAULT_CHILD_ID): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM entries WHERE child_id = ?',
    childId,
  );
  return row?.n ?? 0;
}

/** 今日（または昨日）から遡った連続記録日数 */
export async function getStreak(
  today: string,
  childId: number = DEFAULT_CHILD_ID,
): Promise<number> {
  const db = await getDb();
  // 10年分あれば実用上十分
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM entries WHERE child_id = ? AND date <= ? ORDER BY date DESC LIMIT 3660',
    childId,
    today,
  );
  if (rows.length === 0) return 0;

  const cursor = new Date(`${today}T00:00:00`);
  const recorded = new Set(rows.map((r) => r.date));

  // 今日が未記録でも昨日まで続いていればストリーク継続とみなす
  if (!recorded.has(toDateString(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (recorded.has(toDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
