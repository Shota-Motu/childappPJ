import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { todayString } from '@/lib/dates';
import { getEntry, getSetting } from './db';

export const REMINDER_ENABLED_KEY = 'reminder_enabled';
export const REMINDER_TIME_KEY = 'reminder_time'; // 'HH:mm'
export const DEFAULT_REMINDER_TIME = '20:00';

/**
 * リマインドは「今後7日分の単発通知」を都度組み直す方式。
 * 繰り返しトリガーだと「撮影済みの当日だけスキップ」ができないため。
 * 組み直しタイミング：アプリ起動時 / 撮影確定時 / 取り込み時 / 設定変更時。
 * 制約：7日以上アプリを開かないと通知が止まる（DESIGN.md に明記）
 */
const DAYS_AHEAD = 7;

// フォアグラウンドでもバナー表示する（当日スキップ済みなので邪魔にならない）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminder', {
    name: '毎日のリマインド',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 通知権限を確認し、必要ならリクエストする。恒久拒否なら false */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function rescheduleReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const enabled = (await getSetting(REMINDER_ENABLED_KEY)) === 'true';
    if (!enabled) return;

    const time = (await getSetting(REMINDER_TIME_KEY)) ?? DEFAULT_REMINDER_TIME;
    const [hour, minute] = time.split(':').map(Number);
    const recordedToday = (await getEntry(todayString())) !== null;
    const now = new Date();

    for (let i = 0; i < DAYS_AHEAD; i++) {
      const fireAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + i,
        hour,
        minute,
        0,
      );
      if (fireAt <= now) continue;
      if (i === 0 && recordedToday) continue; // 今日はもう撮った

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '今日の1秒 📷',
          body: '今日の1秒、まだ撮ってないよ',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: 'reminder',
        },
      });
    }
  } catch (e) {
    // 通知は補助機能。失敗してもアプリ本体の動作は継続する
    console.warn('リマインドの再スケジュールに失敗しました', e);
  }
}
