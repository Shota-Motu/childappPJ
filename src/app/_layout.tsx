import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { useEffectiveColorScheme } from '@/hooks/use-effective-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ensureAndroidChannel, rescheduleReminders } from '@/services/NotificationService';
import { storage } from '@/services/StorageService';
import { useThemeStore } from '@/stores/useThemeStore';

export default function RootLayout() {
  const colorScheme = useEffectiveColorScheme();
  const palette = useTheme();
  const loadThemePreference = useThemeStore((s) => s.load);

  useEffect(() => {
    // 前回セッションで確定されなかった一時録画ファイルを掃除
    storage.cleanPending();
    // リマインドは「今後7日分」方式なので、起動のたびに窓を転がす
    ensureAndroidChannel().then(() => rescheduleReminders());
    loadThemePreference();
  }, [loadThemePreference]);

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
