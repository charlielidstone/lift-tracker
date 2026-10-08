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

// ── Synced snapshot (outbox baseline) ────────────────────────
// The set-rows the SERVER last confirmed. Kept separate from the desired-state
// workout cache so that, after an offline reload, diff(desired, synced) still
// yields the pending un-synced writes (the outbox). Without this, an offline
// reload would treat local edits as already-saved and silently drop them.
export function syncedKey(userId, date) {
  return `${NS}:synced:${userId || 'anon'}:${date}`;
}

export function saveSyncedSnapshot(userId, date, rows, storage) {
  return writeJSON(storage, syncedKey(userId, date), { rows, cachedAt: Date.now() });
}

export function loadSyncedSnapshot(userId, date, storage) {
  const entry = readJSON(storage, syncedKey(userId, date));
  return entry?.rows ?? null;
}

// ── Workout history (read-only cache for offline viewing) ────
export function historyKey(userId) {
  return `${NS}:history:${userId || 'anon'}`;
}

export function saveHistoryCache(userId, workouts, storage) {
  return writeJSON(storage, historyKey(userId), { workouts, cachedAt: Date.now() });
}

export function loadHistoryCache(userId, storage) {
  const entry = readJSON(storage, historyKey(userId));
  return entry?.workouts ?? null;
}

// ── Session plans (per-type exercise templates, offline-readable) ──
// The PlansProvider owns writes; cached so the Plan tab and Today checklist show
// instantly and survive an offline reload. Plans are low-stakes templates, so this
// is a plain desired-state cache (no synced-baseline outbox like workouts).
export function plansKey(userId) {
  return `${NS}:plans:${userId || 'anon'}`;
}

export function savePlansCache(userId, plans, storage) {
  return writeJSON(storage, plansKey(userId), { plans, cachedAt: Date.now() });
}

export function loadPlansCache(userId, storage) {
  const entry = readJSON(storage, plansKey(userId));
  return entry?.plans ?? null;
}

// Plans synced baseline (outbox baseline — the last SERVER-CONFIRMED snapshot).
// Kept separate from the desired-state plans cache so an offline reload still
// yields the pending un-synced ops via diffPlanOps(desired, synced).
export function plansSyncedKey(userId) {
  return `${NS}:plans-synced:${userId || 'anon'}`;
}

export function savePlansSynced(userId, rows, storage) {
  return writeJSON(storage, plansSyncedKey(userId), { rows, cachedAt: Date.now() });
}

export function loadPlansSynced(userId, storage) {
  const entry = readJSON(storage, plansSyncedKey(userId));
  return entry?.rows ?? null;
}

// ── Weekly schedule (read-only access for the workout provider) ──
// The ScheduleProvider owns writes to this key; useWorkout reads it to pre-set
// today's type on an untouched workout. Stored as a plain 7-slot array.
export function loadScheduleCache(storage) {
  return readJSON(storage, `${NS}:schedule`);
}

// ── Notes scratchpad (per-user single text blob, synced) ─────
// Offline-first: the Notes tab writes here on every keystroke and pushes to the
// server debounced. `updatedAt` (epoch ms) lets load() pick the newer of the
// cached vs server copy.
export function noteKey(userId) {
  return `${NS}:note:${userId || 'anon'}`;
}

export function saveNoteCache(userId, content, updatedAt, storage) {
  return writeJSON(storage, noteKey(userId), {
    content,
    updatedAt: updatedAt ?? Date.now(),
  });
}

export function loadNoteCache(userId, storage) {
  return readJSON(storage, noteKey(userId)); // { content, updatedAt } | null
}
