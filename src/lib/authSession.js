// authSession.js — resilient read of the Supabase-persisted auth session.
//
// supabase.auth.getSession() can STALL when offline with an expired access token:
// it awaits a token-refresh network call that never resolves, which would leave
// the app stuck on a "Loading…" gate and unusable offline. These pure helpers
// read the session Supabase already persisted to storage so the app can open
// offline (with cached data) and reconcile auth when back online.
//
// Supabase v2 persists the session as JSON under a key like `sb-<ref>-auth-token`.

// Parse one stored value into a session object (or null if absent/invalid).
export function parsePersistedSession(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed) return null;
  // v2 stores the session object directly; v1 wrapped it as { currentSession }.
  const session = parsed.currentSession ?? parsed;
  return session && session.user ? session : null;
}

// Scan a Storage-like object for the Supabase auth-token key and return its
// session, or null. Safe against any storage access throwing.
export function readPersistedSession(storage) {
  if (!storage) return null;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const session = parsePersistedSession(storage.getItem(key));
        if (session) return session;
      }
    }
  } catch {
    /* ignore — treat as no persisted session */
  }
  return null;
}
