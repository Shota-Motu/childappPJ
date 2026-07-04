import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { type Entry, upsertEntry } from './db';

/**
 * 保存レイヤーの抽象化。
 * フェーズ3でクラウドバックアップを載せる際は、このインターフェースの
 * 実装を差し替える（画面側は StorageService 経由でしか触らない）。
 */
export interface StorageService {
  /** 一時録画ファイルを正規の保存先へ確定し、サムネイル生成と DB 登録まで行う */
  finalize(date: string, pendingUri: string, source?: Entry['source']): Promise<void>;
  /** 未確定の一時ファイルを破棄する */
  discardPending(pendingUri: string): void;
  /** pending ディレクトリと迷子の一時ファイルを掃除する（画面離脱・起動時） */
  cleanPending(): void;
  /** DB に保存された相対パス → 再生可能な URI */
  resolveUri(relativePath: string): string;
}

const videosDir = () => new Directory(Paths.document, 'videos');
const thumbsDir = () => new Directory(Paths.document, 'thumbs');

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

async function computeHash(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // ハッシュはクラウド同期の差分検出用。失敗しても記録自体は成立させる
    return null;
  }
}

class LocalStorageService implements StorageService {
  async finalize(
    date: string,
    pendingUri: string,
    source: Entry['source'] = 'camera',
  ): Promise<void> {
    ensureDir(videosDir());
    ensureDir(thumbsDir());

    // 1. 動画を videos/YYYY-MM-DD.mp4 へ移動（同日既存は上書き = 1日1本を保証）
    const video = new File(videosDir(), `${date}.mp4`);
    if (video.exists) video.delete();
    const pending = new File(pendingUri);
    await pending.move(video);

    // 2. サムネイル生成 → thumbs/YYYY-MM-DD.jpg
    const VideoThumbnails = await import('expo-video-thumbnails');
    const { uri: tmpThumbUri } = await VideoThumbnails.getThumbnailAsync(video.uri, {
      time: 0,
    });
    const thumb = new File(thumbsDir(), `${date}.jpg`);
    if (thumb.exists) thumb.delete();
    await new File(tmpThumbUri).move(thumb);

    // 3. メタデータを upsert
    await upsertEntry({
      date,
      video_path: `videos/${date}.mp4`,
      thumb_path: `thumbs/${date}.jpg`,
      duration_ms: 1000,
      source,
      content_hash: await computeHash(video),
    });
  }

  discardPending(pendingUri: string): void {
    try {
      const file = new File(pendingUri);
      if (file.exists) file.delete();
    } catch {
      // 破棄失敗は致命的でない（cleanPending が後で回収する）
    }
  }

  cleanPending(): void {
    // expo-camera の録画一時ファイルは Paths.cache 直下に作られる。
    // ここではアプリ管理下の pending ディレクトリのみ掃除する
    try {
      const pending = new Directory(Paths.cache, 'pending');
      if (pending.exists) pending.delete();
    } catch {
      /* noop */
    }
  }

  resolveUri(relativePath: string): string {
    return new File(Paths.document, relativePath).uri;
  }
}

export const storage: StorageService = new LocalStorageService();
