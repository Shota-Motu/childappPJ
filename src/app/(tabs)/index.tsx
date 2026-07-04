import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useClipLoop } from '@/hooks/use-clip-loop';
import { useTheme } from '@/hooks/use-theme';
import { storage } from '@/services/StorageService';
import { useEntriesStore } from '@/stores/useEntriesStore';

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function TodayScreen() {
  const palette = useTheme();
  const { todayEntry, streak, totalDays, refreshToday } = useEntriesStore();
  const [muted, setMuted] = useState(true);

  useFocusEffect(
    useCallback(() => {
      refreshToday();
    }, [refreshToday]),
  );

  const videoUri = todayEntry ? storage.resolveUri(todayEntry.video_path) : null;

  // useVideoPlayer はソース引数を初期値としてしか読まないため、
  // URI の変化（初回ロード・撮り直し）は replaceAsync で明示的に反映する
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (videoUri) {
      player
        .replaceAsync(videoUri)
        .then(() => player.play())
        .catch(() => {});
    }
  }, [videoUri, player]);

  // expo-video の player はプロパティ代入で操作する外部システム
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  // 保存された動画は3秒。選んだ「ベスト1秒」だけをループ再生する
  useClipLoop(player, todayEntry?.clip_start_ms ?? 0, videoUri !== null);

  const toggleMute = () => setMuted((m) => !m);

  const share = async () => {
    if (!videoUri || !todayEntry) return;
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(videoUri, {
      dialogTitle: '今日の1秒を共有',
      mimeType: todayEntry.video_path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
    }).catch(() => {}); // ユーザーキャンセルは正常系
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">{formatToday()}</ThemedText>
          <View style={styles.stats}>
            {totalDays > 0 && (
              <ThemedText style={{ color: palette.textSecondary }}>
                合計 {totalDays}日分の思い出
              </ThemedText>
            )}
            {streak > 1 && (
              <ThemedText style={{ color: palette.accent }}>🔥 {streak}日連続</ThemedText>
            )}
          </View>
        </View>

        {todayEntry && videoUri ? (
          <View style={styles.recordedArea}>
            <Pressable
              onPress={toggleMute}
              style={[styles.videoFrame, { borderColor: palette.accentSoft }]}
              accessibilityRole="button"
              accessibilityLabel={muted ? '音声をオンにする' : '音声をオフにする'}
            >
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
              />
              <ThemedText style={styles.muteBadge}>{muted ? '🔇' : '🔊'}</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">今日の1秒、残せました 🎉</ThemedText>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={share}
                style={[styles.primaryAction, { backgroundColor: palette.accent }]}
                accessibilityRole="button"
                accessibilityLabel="今日の1秒を共有する"
              >
                <ThemedText style={styles.primaryActionText}>共有する</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.navigate('/camera')}
                style={[styles.secondaryButton, { borderColor: palette.accent }]}
                accessibilityRole="button"
              >
                <ThemedText style={{ color: palette.accent }}>撮り直す</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptyArea}>
            <ThemedText type="subtitle" style={styles.centerText}>
              今日の1秒を{'\n'}まだ撮っていません
            </ThemedText>
            <Pressable
              onPress={() => router.navigate('/camera')}
              style={[styles.recordButton, { backgroundColor: palette.accent }]}
              accessibilityRole="button"
              accessibilityLabel="今日の1秒を撮影する"
            >
              <View style={[styles.recordButtonInner, { borderColor: palette.background }]}>
                <ThemedText style={styles.recordButtonEmoji}>📷</ThemedText>
              </View>
            </Pressable>
            <ThemedText style={{ color: palette.textSecondary }}>
              タップして1秒だけ撮影
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center', padding: Spacing.four },
  header: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four },
  stats: { alignItems: 'center', gap: Spacing.half },
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  centerText: { textAlign: 'center' },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonEmoji: { fontSize: 40, lineHeight: 48 },
  recordedArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    alignSelf: 'stretch',
  },
  videoFrame: {
    width: '80%',
    aspectRatio: 3 / 4,
    borderRadius: Spacing.four,
    borderWidth: 4,
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },
  muteBadge: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    fontSize: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  primaryAction: {
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
  },
  primaryActionText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
  },
});
