import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { type Entry, getEntry, upsertEntry } from './db';

/**
 * 保存レイヤーの抽象化。
 * フェーズ3でクラウドバックアップを載せる際は、このインターフェースの
 * 実装を差し替える（画面側は StorageService 経由でしか触らない）。
 */
export interface FinalizeOptions {
  source?: Entry['source'];
  /** 「ベスト1秒」の開始位置（ms）。サムネイルもこの位置から生成する */
  clipStartMs?: number;
  /** 動画ファイル全体の長さ（ms） */
  durationMs?: number;
}

export interface StorageService {
  /** 録画直後の一時ファイルをアプリ管理下の pending 領域へ移す */
  stagePending(recordedUri: string): Promise<string>;
  /** 一時ファイルを正規の保存先へ確定し、サムネイル生成と DB 登録まで行う */
  finalize(date: string, pendingUri: string, options?: FinalizeOptions): Promise<void>;
  /** 未確定の一時ファイルを破棄する */
  discardPending(pendingUri: string): void;
  /** pending ディレクトリの残骸を掃除する（アプリ起動時に呼ぶ） */
  cleanPending(): void;
  /** DB に保存された相対パス → 再生可能な URI */
  resolveUri(relativePath: string): string;
}

const videosDir = () => new Directory(Paths.document, 'videos');
const thumbsDir = () => new Directory(Paths.document, 'thumbs');
const pendingDir = () => new Directory(Paths.cache, 'pending');

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

/** iOS の録画は .mov、Android は .mp4。拡張子はコンテナ形式なので維持する */
function extnameOf(uri: string): string {
  const match = /\.[A-Za-z0-9]+$/.exec(uri.split('?')[0]);
  return match ? match[0].toLowerCase() : '.mp4';
}

function deleteQuietly(relativePath: string): void {
  if (!relativePath) return;
  try {
    const file = new File(Paths.document, relativePath);
    if (file.exists) file.delete();
  } catch {
    /* 掃除の失敗は無視してよい（次回 finalize でも参照されない） */
  }
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
  async stagePending(recordedUri: string): Promise<string> {
    try {
      ensureDir(pendingDir());
      const staged = new File(pendingDir(), `${Date.now()}${extnameOf(recordedUri)}`);
      await new File(recordedUri).move(staged);
      return staged.uri;
    } catch {
      // ステージングに失敗しても録画済みファイルはそのまま使える
      return recordedUri;
    }
  }

  async finalize(
    date: string,
    pendingUri: string,
    options: FinalizeOptions = {},
  ): Promise<void> {
    const { source = 'camera', clipStartMs = 0, durationMs = 1000 } = options;
    ensureDir(videosDir());
    ensureDir(thumbsDir());

    const previous = await getEntry(date);

    // ファイル名にタイムスタンプを含めることで、撮り直し時も常に新しい URI になり
    // プレイヤーや Image の URI キャッシュ・再生中ファイルの上書きを回避できる。
    // 「1日1本」は DB の主キー (child_id, date) が保証する
    const version = Date.now();
    const videoName = `${date}_${version}${extnameOf(pendingUri)}`;
    const video = new File(videosDir(), videoName);
    await new File(pendingUri).move(video);

    // サムネイル生成の失敗は非致命扱い（動画と DB 登録は成立させる）
    let thumbPath = '';
    try {
      const VideoThumbnails = await import('expo-video-thumbnails');
      const { uri: tmpThumbUri } = await VideoThumbnails.getThumbnailAsync(video.uri, {
        time: clipStartMs,
      });
      const thumb = new File(thumbsDir(), `${date}_${version}.jpg`);
      await new File(tmpThumbUri).move(thumb);
      thumbPath = `thumbs/${date}_${version}.jpg`;
    } catch (e) {
      console.warn('サムネイル生成に失敗しました', e);
    }

    await upsertEntry({
      date,
      video_path: `videos/${videoName}`,
      thumb_path: thumbPath,
      duration_ms: durationMs,
      clip_start_ms: clipStartMs,
      source,
      content_hash: await computeHash(video),
    });

    // DB 更新が成功してから旧バージョンのファイルを削除
    if (previous) {
      deleteQuietly(previous.video_path);
      deleteQuietly(previous.thumb_path);
    }
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
    // アプリ起動時に前回セッションの未確定ファイルをまとめて回収する
    try {
      const pending = pendingDir();
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
