// localCache — a tiny read/write cache over localStorage so the app shows today's
// workout instantly and survives an offline reload.
//
// PURE + INJECTABLE: every function takes an optional `storage` (defaults to
// localStorage) so it's unit-testable with a fake and safe when storage is absent
// (private mode / SSR / quota errors never throw out of here).
//
// Keying: entries are namespaced by user id + date so two accounts on one device
// (or two days) never collide. Anonymous/no-auth falls back to 'anon'.

const NS = 'lift-tracker:v1';

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access itself can throw in locked-down browsers
  }
}

export function workoutKey(userId, date) {
  return `${NS}:workout:${userId || 'anon'}:${date}`;
}

export function libraryKey(userId) {
  return `${NS}:library:${userId || 'anon'}`;
}

function readJSON(storage, key) {
  const s = safeStorage(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/unparseable → treat as cache miss
  }
}

function writeJSON(storage, key, value) {
  const s = safeStorage(storage);
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded / disabled → silently skip
  }
}

// ── Today's workout ──────────────────────────────────────────
// payload shape: { workoutId, type, finished, exercises }
export function saveWorkoutCache(userId, date, payload, storage) {
  return writeJSON(storage, workoutKey(userId, date), {
    ...payload,
    cachedAt: Date.now(),
  });
}

export function loadWorkoutCache(userId, date, storage) {
  return readJSON(storage, workoutKey(userId, date));
}

// ── Exercise library ─────────────────────────────────────────
export function saveLibraryCache(userId, library, storage) {
  return writeJSON(storage, libraryKey(userId), { library, cachedAt: Date.now() });
}

export function loadLibraryCache(userId, storage) {
  const entry = readJSON(storage, libraryKey(userId));
  return entry?.library ?? null;
}
