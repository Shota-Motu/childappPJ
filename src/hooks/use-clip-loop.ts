/* eslint-disable react-hooks/immutability --
   expo-video の player は currentTime 代入でシークする外部システム */
import type { VideoPlayer } from 'expo-video';
import { useEffect } from 'react';

/**
 * player の再生を [startMs, startMs + windowMs) の1秒ウィンドウにループさせる。
 * 動画ファイルは3秒のまま保存し、再生側で「ベスト1秒」だけを見せる方式
 * （ffmpeg なしでクリップ選択を実現する。物理的な切り出しは年間ムービー書き出し時）
 */
export function useClipLoop(
  player: VideoPlayer,
  startMs: number,
  enabled: boolean,
  windowMs = 1000,
): void {
  useEffect(() => {
    if (!enabled) return;

    const startSec = startMs / 1000;
    const endSec = (startMs + windowMs) / 1000;
    player.currentTime = startSec;

    // ウィンドウ末尾へ達したら（または player.loop で先頭へ巻き戻ったら）開始位置へ戻す
    const id = setInterval(() => {
      const t = player.currentTime;
      if (t >= endSec || t < startSec - 0.25) {
        player.currentTime = startSec;
      }
    }, 100);
    return () => clearInterval(id);
  }, [player, startMs, enabled, windowMs]);
}
