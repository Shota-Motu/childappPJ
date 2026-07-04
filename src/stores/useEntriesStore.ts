import { create } from 'zustand';

import { todayString } from '@/lib/dates';
import { countEntries, type Entry, getEntry, getStreak } from '@/services/db';

interface EntriesState {
  todayEntry: Entry | null;
  streak: number;
  totalDays: number;
  loaded: boolean;
  refreshToday: () => Promise<void>;
}

export const useEntriesStore = create<EntriesState>((set) => ({
  todayEntry: null,
  streak: 0,
  totalDays: 0,
  loaded: false,
  refreshToday: async () => {
    const today = todayString();
    const [entry, streak, totalDays] = await Promise.all([
      getEntry(today),
      getStreak(today),
      countEntries(),
    ]);
    set({ todayEntry: entry, streak, totalDays, loaded: true });
  },
}));
