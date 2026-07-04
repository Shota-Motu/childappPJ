import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ensureAndroidChannel, rescheduleReminders } from '@/services/NotificationService';
import { storage } from '@/services/StorageService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const palette = useTheme();

  useEffect(() => {
    // 前回セッションで確定されなかった一時録画ファイルを掃除
    storage.cleanPending();
    // リマインドは「今後7日分」方式なので、起動のたびに窓を転がす
    ensureAndroidChannel().then(() => rescheduleReminders());
  }, []);

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      primary: palette.accent,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="camera"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="playback/[date]" options={{ headerBackTitle: '戻る' }} />
      </Stack>
    </ThemeProvider>
  );
}
