/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#4A4A5A',
    background: '#FFF8F0',
    backgroundElement: '#FDEEF0',
    backgroundSelected: '#F9DDE2',
    textSecondary: '#8A8A9A',
    accent: '#F79BAF',
    accentSoft: '#FFD1DC',
    mint: '#9FDCC0',
    babyBlue: '#A8D5E8',
    cream: '#FFF8E7',
    danger: '#E8899A',
  },
  dark: {
    text: '#ECECF2',
    background: '#1C1B22',
    backgroundElement: '#28262F',
    backgroundSelected: '#353241',
    textSecondary: '#A5A2B3',
    accent: '#D9849A',
    accentSoft: '#8A5E6B',
    mint: '#6FA98F',
    babyBlue: '#7AA6BC',
    cream: '#3A362C',
    danger: '#C97485',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
