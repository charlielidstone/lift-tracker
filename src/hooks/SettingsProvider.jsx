// SettingsProvider — app-wide user preferences (persisted to localStorage).
// Currently: weight display unit (lb|kg). Weight is ALWAYS stored in lb; this
// only changes display + stepping. Kept separate from workout state so any screen
// can read/write a preference.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UNITS } from '@/lib/units';

const SettingsContext = createContext(null);
const KEY = 'lift-tracker:v1:settings';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

export function SettingsProvider({ children }) {
  const [unit, setUnitState] = useState(() => {
    const saved = load().unit;
    return UNITS.includes(saved) ? saved : 'lb';
  });

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...load(), unit }));
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, [unit]);

  const setUnit = useCallback((next) => {
    if (UNITS.includes(next)) setUnitState(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ unit, setUnit }}>{children}</SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
