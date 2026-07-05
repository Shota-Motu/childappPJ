import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function AlbumScreen() {
  const palette = useTheme();
  return (
    <ThemedView style={styles.center}>
      <Ionicons name="images-outline" size={32} color={palette.textSecondary} />
      <ThemedText type="subtitle">アルバム</ThemedText>
      <ThemedText type="small">月ごとのサムネイルグリッドを表示します（実装予定）</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
