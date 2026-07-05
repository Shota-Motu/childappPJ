import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayString } from '@/lib/dates';
import { type Entry, getEntriesForMonth } from '@/services/db';
import { rescheduleReminders } from '@/services/NotificationService';
import { storage } from '@/services/StorageService';
import { useEntriesStore } from '@/stores/useEntriesStore';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Month {
  year: number;
  month: number; // 1-12
}

function currentMonth(): Month {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthKey({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function shiftMonth({ year, month }: Month, delta: number): Month {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function CalendarScreen() {
  const palette = useTheme();
  const [cursor, setCursor] = useState<Month>(currentMonth);
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map());
  const [importing, setImporting] = useState(false);
  const refreshToday = useEntriesStore((s) => s.refreshToday);

  const loadMonth = useCallback(async (m: Month) => {
    const list = await getEntriesForMonth(monthKey(m));
    setEntries(new Map(list.map((e) => [e.date, e])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMonth(cursor);
    }, [cursor, loadMonth]),
  );

  const today = todayString();
  const isCurrentMonth = monthKey(cursor) === monthKey(currentMonth());

  const importForDate = async (date: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImporting(true);
    try {
      const staged = await storage.stagePending(asset.uri);
      await storage.finalize(date, staged, {
        source: 'import',
        durationMs: asset.duration ? Math.round(asset.duration) : 1000,
      });
      await Promise.all([loadMonth(cursor), refreshToday()]);
      rescheduleReminders();
      router.push(`/playback/${date}`);
    } catch (e) {
      console.error('取り込みに失敗しました', e);
      Alert.alert('取り込みに失敗しました', 'もう一度お試しください。');
    } finally {
      setImporting(false);
    }
  };

  const onPressEmptyDay = (date: string, day: number) => {
    Alert.alert(
      `${cursor.month}月${day}日`,
      'この日の記録はまだありません。フォトライブラリから動画を取り込みますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '取り込む', onPress: () => importForDate(date) },
      ],
    );
  };

  // グリッド構築：先頭の曜日オフセット + 月の日数 → 週ごとの行に分割
  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // 6週分に固定してカレンダーの縦幅を月ごとに変えない（レイアウトのガタつき防止）
  while (cells.length < 42) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setCursor((c) => shiftMonth(c, -1))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="前の月へ"
          >
            <Ionicons name="chevron-back" size={26} color={palette.accent} />
          </Pressable>
          <ThemedText type="subtitle">
            {cursor.year}年{cursor.month}月
          </ThemedText>
          <Pressable
            onPress={() => setCursor((c) => shiftMonth(c, 1))}
            hitSlop={12}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel="次の月へ"
          >
            <Ionicons
              name="chevron-forward"
              size={26}
              color={palette.accent}
              style={{ opacity: isCurrentMonth ? 0.25 : 1 }}
            />
          </Pressable>
        </View>

        <ThemedText style={{ color: palette.textSecondary }}>
          この月の記録 {entries.size}/{daysInMonth}日
        </ThemedText>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((w) => (
            <ThemedText key={w} type="small" style={styles.weekday}>
              {w}
            </ThemedText>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) {
                  return <View key={`pad-${wi}-${di}`} style={styles.cell} />;
                }
                const date = `${monthKey(cursor)}-${String(day).padStart(2, '0')}`;
                const entry = entries.get(date);
                const isFuture = date > today;
                const isToday = date === today;

                return (
                  <Pressable
                    key={date}
                    style={[
                      styles.cell,
                      { backgroundColor: palette.backgroundElement },
                      isToday && { borderWidth: 2, borderColor: palette.accent },
                      isFuture && styles.future,
                    ]}
                    disabled={isFuture || importing}
                    onPress={() =>
                      entry ? router.push(`/playback/${date}`) : onPressEmptyDay(date, day)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={entry ? `${day}日の記録を再生` : `${day}日（未記録）`}
                  >
                    {entry ? (
                      entry.thumb_path ? (
                        <Image
                          source={{ uri: storage.resolveUri(entry.thumb_path) }}
                          style={styles.thumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.thumbFallback}>
                          <Ionicons
                            name="videocam-outline"
                            size={18}
                            color={palette.textSecondary}
                          />
                        </View>
                      )
                    ) : null}
                    <ThemedText
                      type="small"
                      style={[styles.dayLabel, entry ? styles.dayLabelOnThumb : null]}
                    >
                      {day}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {importing && (
          <View style={styles.importingOverlay}>
            <ActivityIndicator color={palette.accent} size="large" />
            <ThemedText>取り込み中…</ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
    marginTop: Spacing.two,
  },
  weekdayRow: { flexDirection: 'row', alignSelf: 'stretch' },
  weekday: { flex: 1, textAlign: 'center', opacity: 0.6 },
  grid: {
    flex: 1,
    alignSelf: 'stretch',
    gap: CELL_GAP,
  },
  weekRow: { flex: 1, flexDirection: 'row', gap: CELL_GAP },
  cell: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  future: { opacity: 0.3 },
  thumb: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  thumbFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { margin: 3, fontSize: 11, lineHeight: 13 },
  dayLabelOnThumb: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  importingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
