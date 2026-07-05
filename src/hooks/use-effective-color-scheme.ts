import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeStore } from '@/stores/useThemeStore';

/** ユーザー設定（ライト/ダーク/システム）と端末の配色設定を合成した実際の配色 */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
