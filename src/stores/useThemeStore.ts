import { create } from 'zustand';

import { getSetting, setSetting } from '@/services/db';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_PREFERENCE_KEY = 'theme_preference';

interface ThemeState {
  preference: ThemePreference;
  loaded: boolean;
  load: () => Promise<void>;
  setPreference: (pref: ThemePreference) => Promise<void>;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  loaded: false,
  load: async () => {
    const value = await getSetting(THEME_PREFERENCE_KEY);
    set({ preference: isThemePreference(value) ? value : 'system', loaded: true });
  },
  setPreference: async (preference) => {
    set({ preference });
    await setSetting(THEME_PREFERENCE_KEY, preference);
  },
}));
