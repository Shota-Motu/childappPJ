import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportBackup, importBackup, LAST_BACKUP_AT_KEY } from '@/services/BackupService';
import { getSetting, setSetting } from '@/services/db';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_ENABLED_KEY,
  REMINDER_TIME_KEY,
  requestNotificationPermission,
  rescheduleReminders,
} from '@/services/NotificationService';
import { useEntriesStore } from '@/stores/useEntriesStore';
import { type ThemePreference, useThemeStore } from '@/stores/useThemeStore';

function timeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: 'sunny-outline' | 'moon-outline' | 'phone-portrait-outline' }[] = [
  { value: 'light', label: 'ライト', icon: 'sunny-outline' },
  { value: 'dark', label: 'ダーク', icon: 'moon-outline' },
  { value: 'system', label: 'システム', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const palette = useTheme();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const refreshToday = useEntriesStore((s) => s.refreshToday);
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setReminderEnabled((await getSetting(REMINDER_ENABLED_KEY)) === 'true');
        setReminderTime((await getSetting(REMINDER_TIME_KEY)) ?? DEFAULT_REMINDER_TIME);
        setLastBackupAt(await getSetting(LAST_BACKUP_AT_KEY));
      })();
    }, []),
  );

  const toggleReminder = async (next: boolean) => {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          '通知が許可されていません',
          'リマインドを使うには OS の設定で通知を許可してください。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '設定を開く', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    setReminderEnabled(next);
    await setSetting(REMINDER_ENABLED_KEY, String(next));
    await rescheduleReminders();
  };

  const onTimeChange = async (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type !== 'set' || !date) return;
    const time = dateToTime(date);
    setReminderTime(time);
    await setSetting(REMINDER_TIME_KEY, time);
    await rescheduleReminders();
  };

  const onExport = async () => {
    setBusy('export');
    try {
      const result = await exportBackup();
      if (result) {
        setLastBackupAt(new Date().toISOString());
        Alert.alert(
          'バックアップ完了',
          `${result.copied}/${result.total}日分をコピーしました。このフォルダを消さずに保管してください。`,
        );
      }
    } catch (e) {
      console.error('バックアップに失敗しました', e);
      Alert.alert('バックアップに失敗しました', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const result = await importBackup();
      if (result) {
        await refreshToday();
        await rescheduleReminders();
        Alert.alert(
          '復元完了',
          `${result.restored}日分を復元しました（スキップ ${result.skipped}件）。`,
        );
      }
    } catch (e) {
      console.error('復元に失敗しました', e);
      Alert.alert('復元に失敗しました', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.pageTitle}>
          設定
        </ThemedText>

        <View style={[styles.section, { backgroundColor: palette.backgroundElement }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="color-palette-outline" size={18} color={palette.textSecondary} />
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              外観
            </ThemedText>
          </View>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map((opt) => {
              const selected = themePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemePreference(opt.value)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: selected ? palette.accent : palette.background,
                      borderColor: selected ? palette.accent : palette.backgroundSelected,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`外観を${opt.label}にする`}
                >
                  <Ionicons name={opt.icon} size={20} color={selected ? '#fff' : palette.text} />
                  <ThemedText style={{ color: selected ? '#fff' : palette.text }}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: palette.backgroundElement }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="notifications-outline" size={18} color={palette.textSecondary} />
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              毎日のリマインド
            </ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText>リマインド通知</ThemedText>
            <Switch
              value={reminderEnabled}
              onValueChange={toggleReminder}
              trackColor={{ true: palette.accent }}
              accessibilityLabel="リマインド通知のオン・オフ"
            />
          </View>
          {reminderEnabled && (
            <Pressable
              style={styles.row}
              onPress={() => setShowTimePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="通知時刻を変更する"
            >
              <ThemedText>通知時刻</ThemedText>
              <ThemedText style={{ color: palette.accent }}>{reminderTime}</ThemedText>
            </Pressable>
          )}
          {showTimePicker && (
            <DateTimePicker
              value={timeToDate(reminderTime)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            その日の1秒を撮り終えていれば通知は届きません
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: palette.backgroundElement }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="cloud-upload-outline" size={18} color={palette.textSecondary} />
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              バックアップ
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            すべての記録を選んだフォルダ（iCloud Drive・Google ドライブ等）へコピーします。
            端末の紛失・機種変更に備えて定期的に作成してください。
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
            onPress={onExport}
            disabled={busy !== null}
            accessibilityRole="button"
          >
            {busy === 'export' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>バックアップを作成</ThemedText>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: palette.accent }]}
            onPress={onImport}
            disabled={busy !== null}
            accessibilityRole="button"
          >
            {busy === 'import' ? (
              <ActivityIndicator color={palette.accent} />
            ) : (
              <ThemedText style={{ color: palette.accent }}>バックアップから復元</ThemedText>
            )}
          </Pressable>
          {lastBackupAt && (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              最終バックアップ: {new Date(lastBackupAt).toLocaleString('ja-JP')}
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  pageTitle: { marginTop: Spacing.two },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sectionTitle: { opacity: 0.8 },
  themeOptions: { flexDirection: 'row', gap: Spacing.two },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
