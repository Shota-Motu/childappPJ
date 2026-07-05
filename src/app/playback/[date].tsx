import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useClipLoop } from '@/hooks/use-clip-loop';
import { useTheme } from '@/hooks/use-theme';
import { formatDateJa } from '@/lib/dates';
import { shareEntryVideo } from '@/lib/share';
import { type Entry, getAdjacentDates, getEntry } from '@/services/db';
import { storage } from '@/services/StorageService';

export default function PlaybackScreen() {
  const palette = useTheme();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [adjacent, setAdjacent] = useState<{ prev: string | null; next: string | null }>({
    prev: null,
    next: null,
  });

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    Promise.all([getEntry(date), getAdjacentDates(date)]).then(([e, adj]) => {
      if (cancelled) return;
      setEntry(e);
      setAdjacent(adj);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // 振り返り再生は音声あり（声が最大の感情価値）
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  const videoUri = entry ? storage.resolveUri(entry.video_path) : null;

  useEffect(() => {
    if (videoUri) {
      player
        .replaceAsync(videoUri)
        .then(() => player.play())
        .catch(() => {});
    }
  }, [videoUri, player]);

  useClipLoop(player, entry?.clip_start_ms ?? 0, videoUri !== null);

  const goTo = (target: string | null) => {
    if (target) router.setParams({ date: target });
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: date ? formatDateJa(date) : '' }} />
      {entry && videoUri ? (
        <View style={styles.body}>
          <View style={[styles.videoFrame, { borderColor: palette.accentSoft }]}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
          <View style={styles.controls}>
            <Pressable
              onPress={() => goTo(adjacent.prev)}
              disabled={!adjacent.prev}
              style={[styles.navButton, !adjacent.prev && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="前の日へ"
            >
              <Ionicons name="chevron-back" size={28} color={palette.accent} />
            </Pressable>
            <Pressable
              onPress={() => entry && shareEntryVideo(entry)}
              style={[styles.shareButton, { backgroundColor: palette.accent }]}
              accessibilityRole="button"
              accessibilityLabel="この1秒を共有する"
            >
              <ThemedText style={styles.shareText}>共有する</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => goTo(adjacent.next)}
              disabled={!adjacent.next}
              style={[styles.navButton, !adjacent.next && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="次の日へ"
            >
              <Ionicons name="chevron-forward" size={28} color={palette.accent} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <ThemedText style={{ color: palette.textSecondary }}>
            この日の記録はありません
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  videoFrame: {
    width: '90%',
    aspectRatio: 3 / 4,
    borderRadius: Spacing.four,
    borderWidth: 4,
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.five,
  },
  navButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.25 },
  shareButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  shareText: { color: '#fff', fontWeight: '600' },
});
