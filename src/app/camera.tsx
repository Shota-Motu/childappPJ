import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayString } from '@/lib/dates';
import { storage } from '@/services/StorageService';
import { useEntriesStore } from '@/stores/useEntriesStore';

type Phase = 'idle' | 'recording' | 'preview' | 'saving';

export default function CameraScreen() {
  const palette = useTheme();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const pendingUriRef = useRef<string | null>(null);
  const confirmedRef = useRef(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [progressWidth] = useState(() =>
    progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
  );
  const refreshToday = useEntriesStore((s) => s.refreshToday);

  // 画面を離れたら未確定の一時ファイルは自動削除
  useEffect(() => {
    return () => {
      if (!confirmedRef.current && pendingUriRef.current) {
        storage.discardPending(pendingUriRef.current);
      }
    };
  }, []);

  const previewPlayer = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (pendingUri) {
      previewPlayer.replaceAsync(pendingUri).then(() => previewPlayer.play());
    }
  }, [pendingUri, previewPlayer]);

  if (!cameraPermission || !micPermission) {
    return <ThemedView style={styles.center} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.permissionText}>
          1秒動画を撮るために{'\n'}カメラとマイクの許可が必要です
        </ThemedText>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          onPress={async () => {
            if (!cameraPermission.granted) await requestCameraPermission();
            if (!micPermission.granted) await requestMicPermission();
          }}
        >
          <ThemedText style={styles.primaryButtonText}>許可する</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={{ color: palette.textSecondary }}>あとで</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const record = async () => {
    const camera = cameraRef.current;
    if (!camera || phase !== 'idle') return;

    setPhase('recording');
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    try {
      // maxDuration で1秒（1000ms）録画し自動停止を待つ
      const result = await camera.recordAsync({ maxDuration: 1 });
      if (result?.uri) {
        pendingUriRef.current = result.uri;
        setPendingUri(result.uri);
        setPhase('preview');
      } else {
        setPhase('idle');
      }
    } catch {
      setPhase('idle');
    }
  };

  const retake = () => {
    if (pendingUriRef.current) {
      storage.discardPending(pendingUriRef.current);
      pendingUriRef.current = null;
    }
    setPendingUri(null);
    setPhase('idle');
  };

  const confirm = async () => {
    if (!pendingUriRef.current || phase === 'saving') return;
    setPhase('saving');
    try {
      await storage.finalize(todayString(), pendingUriRef.current);
      confirmedRef.current = true;
      pendingUriRef.current = null;
      await refreshToday();
      router.back();
    } catch (e) {
      console.error('保存に失敗しました', e);
      setPhase('preview');
    }
  };

  return (
    <ThemedView style={styles.container}>
      {phase === 'preview' || phase === 'saving' ? (
        <View style={styles.fill}>
          <VideoView
            player={previewPlayer}
            style={styles.fill}
            contentFit="cover"
            nativeControls={false}
          />
          <SafeAreaView style={styles.overlay}>
            <ThemedText type="subtitle" style={styles.overlayTitle}>
              この1秒でいい？
            </ThemedText>
            <View style={styles.previewActions}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: '#fff' }]}
                onPress={retake}
                disabled={phase === 'saving'}
              >
                <ThemedText style={styles.overlayButtonText}>撮り直す</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: palette.accent }]}
                onPress={confirm}
                disabled={phase === 'saving'}
              >
                {phase === 'saving' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>この1秒を残す</ThemedText>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        <View style={styles.fill}>
          <CameraView
            ref={cameraRef}
            style={styles.fill}
            mode="video"
            facing={facing}
            videoQuality="720p"
            mirror={facing === 'front'}
          />
          <SafeAreaView style={styles.overlay}>
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <ThemedText style={styles.overlayButtonText}>✕</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                hitSlop={12}
                disabled={phase === 'recording'}
              >
                <ThemedText style={styles.overlayButtonText}>🔄</ThemedText>
              </Pressable>
            </View>

            <View style={styles.bottomArea}>
              {phase === 'recording' ? (
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: progressWidth, backgroundColor: palette.accent },
                    ]}
                  />
                </View>
              ) : (
                <ThemedText style={styles.overlayButtonText}>
                  ボタンを押すと1秒だけ録画します
                </ThemedText>
              )}
              <Pressable
                onPress={record}
                disabled={phase !== 'idle'}
                style={[
                  styles.shutter,
                  { borderColor: '#fff' },
                  phase === 'recording' && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.shutterInner, { backgroundColor: palette.accent }]} />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  permissionText: { textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between' },
  bottomArea: { alignItems: 'center', gap: Spacing.four },
  overlayTitle: {
    color: '#fff',
    textAlign: 'center',
    marginTop: Spacing.six,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  overlayButtonText: {
    color: '#fff',
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32 },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
