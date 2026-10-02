// SplitProvider — the user's gym split (named days → muscle groups), persisted
// to localStorage. Separate from workout state so any screen can read it (the
// Plan tab edits it; the Today chips read it). No server sync in v1 — a split is
// a lightweight personal template.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { removeDay as removeDayPure, upsertDay as upsertDayPure } from '@/lib/split';

const SplitContext = createContext(null);
const KEY = 'lift-tracker:v1:split';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SplitProvider({ children }) {
  const [split, setSplit] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(split));
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, [split]);

  const saveDay = useCallback((day) => setSplit((prev) => upsertDayPure(prev, day)), []);
  const deleteDay = useCallback((id) => setSplit((prev) => removeDayPure(prev, id)), []);

  return (
    <SplitContext.Provider value={{ split, saveDay, deleteDay }}>{children}</SplitContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSplit() {
  const ctx = useContext(SplitContext);
  if (!ctx) throw new Error('useSplit must be used within SplitProvider');
  return ctx;
}
