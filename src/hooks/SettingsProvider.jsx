// SettingsProvider — app-wide user preferences (persisted to localStorage).
// Currently: weight display unit (lb|kg) and the app/home-screen icon. Weight is
// ALWAYS stored in lb; the unit only changes display + stepping. Kept separate
// from workout state so any screen can read/write a preference.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { APP_ICON_IDS, applyAppIcon, DEFAULT_APP_ICON } from '@/lib/appIcon';
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

  const [appIcon, setAppIconState] = useState(() => {
    const saved = load().appIcon;
    return APP_ICON_IDS.includes(saved) ? saved : DEFAULT_APP_ICON;
  });

  // Body profile for strength-standard benchmarking (Progress tab). Weight is
  // canonical lb like everywhere else; the unit toggle handles display. Empty
  // until the user fills it in Settings → the Progress benchmark prompts for it.
  const [profile, setProfileState] = useState(() => {
    const saved = load().profile;
    return {
      bodyweightLb: Number.isFinite(saved?.bodyweightLb) ? saved.bodyweightLb : null,
      age: Number.isFinite(saved?.age) ? saved.age : null,
      sex: saved?.sex === 'female' ? 'female' : saved?.sex === 'male' ? 'male' : null,
    };
  });

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...load(), unit }));
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, [unit]);

  // Persist + repoint the apple-touch-icon link whenever the choice changes
  // (also runs on mount so the page advertises the saved icon).
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...load(), appIcon }));
    } catch {
      // ignore storage failures
    }
    applyAppIcon(appIcon);
  }, [appIcon]);

  // Persist profile on change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...load(), profile }));
    } catch {
      // ignore storage failures
    }
  }, [profile]);

  const setUnit = useCallback((next) => {
    if (UNITS.includes(next)) setUnitState(next);
  }, []);

  const setAppIcon = useCallback((next) => {
    if (APP_ICON_IDS.includes(next)) setAppIconState(next);
  }, []);

  // Merge a partial profile update ({bodyweightLb?, age?, sex?}); null clears a
  // field. Numbers are coerced, non-finite → null, sex constrained to m/f/null.
  const setProfile = useCallback((patch) => {
    setProfileState((prev) => {
      const next = { ...prev };
      if ('bodyweightLb' in patch) {
        const n = Number(patch.bodyweightLb);
        next.bodyweightLb = Number.isFinite(n) && n > 0 ? n : null;
      }
      if ('age' in patch) {
        const n = Number(patch.age);
        next.age = Number.isFinite(n) && n > 0 ? n : null;
      }
      if ('sex' in patch) {
        next.sex = patch.sex === 'female' ? 'female' : patch.sex === 'male' ? 'male' : null;
      }
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider
      value={{ unit, setUnit, appIcon, setAppIcon, profile, setProfile }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
