import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CalendarScreen() {
  return (
    <ThemedView style={styles.center}>
      <ThemedText type="subtitle">🗓 カレンダー</ThemedText>
      <ThemedText type="small">撮影済みの日をサムネイルで表示します（実装予定）</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
