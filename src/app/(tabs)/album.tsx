import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AlbumScreen() {
  return (
    <ThemedView style={styles.center}>
      <ThemedText type="subtitle">🖼 アルバム</ThemedText>
      <ThemedText type="small">月ごとのサムネイルグリッドを表示します（実装予定）</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
