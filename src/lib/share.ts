import * as Sharing from 'expo-sharing';

import { type Entry } from '@/services/db';
import { storage } from '@/services/StorageService';

/** その日の動画を OS の共有シートで送る（LINE 等）。キャンセルは正常系 */
export async function shareEntryVideo(entry: Entry): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(storage.resolveUri(entry.video_path), {
    dialogTitle: 'この1秒を共有',
    mimeType: entry.video_path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
  }).catch(() => {});
}
