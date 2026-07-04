import { Directory, File, Paths } from 'expo-file-system';

import { todayString } from '@/lib/dates';
import { type Entry, getAllEntries, getEntry, restoreEntry, setSetting } from './db';

/**
 * バックアップは zip ではなく「フォルダコピー + manifest.json」方式。
 * - 数GB級の動画でもメモリに載せずにコピーできる（JS zip は全読み込みで破綻する）
 * - 保存先はユーザーが選ぶ（iOS: Files/iCloud Drive、Android: SAF 経由で Drive/SD 等）
 * - manifest.json に entries の全メタデータ（clip_start_ms・タイムスタンプ含む）を持つ
 */

const MANIFEST_NAME = 'manifest.json';
const MANIFEST_VERSION = 1;
export const LAST_BACKUP_AT_KEY = 'last_backup_at';

interface Manifest {
  app: 'child-app';
  manifest_version: number;
  exported_at: string;
  entries: Entry[];
}

export interface ExportResult {
  total: number;
  copied: number;
  folderName: string;
}

export interface ImportResult {
  restored: number;
  skipped: number;
}

/** ユーザーが選んだフォルダへ全記録をコピーする。キャンセル時は null */
export async function exportBackup(): Promise<ExportResult | null> {
  let destination: Directory;
  try {
    destination = await Directory.pickDirectoryAsync();
  } catch {
    return null; // ピッカーのキャンセルは正常系
  }

  const entries = await getAllEntries();
  const folderName = `1sec-album-backup-${todayString()}-${Date.now()}`;
  const root = destination.createDirectory(folderName);
  const videos = root.createDirectory('videos');
  const thumbs = root.createDirectory('thumbs');

  let copied = 0;
  for (const entry of entries) {
    try {
      const video = new File(Paths.document, entry.video_path);
      if (video.exists) {
        await video.copy(videos);
        copied += 1;
      }
      if (entry.thumb_path) {
        const thumb = new File(Paths.document, entry.thumb_path);
        if (thumb.exists) await thumb.copy(thumbs);
      }
    } catch (e) {
      // 1件の失敗で全体を止めない（結果の copied/total 差分で気づける）
      console.warn(`バックアップに失敗: ${entry.date}`, e);
    }
  }

  const manifest: Manifest = {
    app: 'child-app',
    manifest_version: MANIFEST_VERSION,
    exported_at: new Date().toISOString(),
    entries,
  };
  root.createFile(MANIFEST_NAME, 'application/json').write(JSON.stringify(manifest));

  await setSetting(LAST_BACKUP_AT_KEY, new Date().toISOString());
  return { total: entries.length, copied, folderName };
}

/**
 * バックアップフォルダ（1sec-album-backup-…）を選んで復元する。
 * 同じ日付が両方にある場合は updated_at が新しい方が勝つ。キャンセル時は null
 */
export async function importBackup(): Promise<ImportResult | null> {
  let source: Directory;
  try {
    source = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }

  // SAF/セキュリティスコープ URI は文字列結合で辿れないため list() で探す
  const items = source.list();
  const manifestFile = items.find(
    (i): i is File => i instanceof File && i.name === MANIFEST_NAME,
  );
  if (!manifestFile) {
    throw new Error('選択したフォルダに manifest.json が見つかりません');
  }
  const manifest = JSON.parse(await manifestFile.text()) as Manifest;
  if (manifest.app !== 'child-app' || !Array.isArray(manifest.entries)) {
    throw new Error('バックアップの形式が正しくありません');
  }

  const backupVideos = items.find(
    (i): i is Directory => i instanceof Directory && i.name === 'videos',
  );
  const backupThumbs = items.find(
    (i): i is Directory => i instanceof Directory && i.name === 'thumbs',
  );
  const videoByName = new Map(
    (backupVideos?.list() ?? [])
      .filter((i): i is File => i instanceof File)
      .map((f) => [f.name, f]),
  );
  const thumbByName = new Map(
    (backupThumbs?.list() ?? [])
      .filter((i): i is File => i instanceof File)
      .map((f) => [f.name, f]),
  );

  const localVideos = new Directory(Paths.document, 'videos');
  const localThumbs = new Directory(Paths.document, 'thumbs');
  if (!localVideos.exists) localVideos.create({ intermediates: true, idempotent: true });
  if (!localThumbs.exists) localThumbs.create({ intermediates: true, idempotent: true });

  let restored = 0;
  let skipped = 0;
  for (const entry of manifest.entries) {
    try {
      const existing = await getEntry(entry.date, entry.child_id);
      if (existing && existing.updated_at >= entry.updated_at) {
        skipped += 1;
        continue;
      }

      const videoName = entry.video_path.split('/').pop() ?? '';
      const backupVideo = videoByName.get(videoName);
      if (!backupVideo) {
        skipped += 1;
        continue;
      }
      // ファイルを先にコピーし、DB は最後に更新する（DB が欠損ファイルを指さないように）
      const localVideo = new File(Paths.document, entry.video_path);
      if (!localVideo.exists) await backupVideo.copy(localVideos);

      if (entry.thumb_path) {
        const thumbName = entry.thumb_path.split('/').pop() ?? '';
        const backupThumb = thumbByName.get(thumbName);
        const localThumb = new File(Paths.document, entry.thumb_path);
        if (backupThumb && !localThumb.exists) await backupThumb.copy(localThumbs);
      }

      await restoreEntry(entry);
      restored += 1;
    } catch (e) {
      console.warn(`復元に失敗: ${entry.date}`, e);
      skipped += 1;
    }
  }
  return { restored, skipped };
}
