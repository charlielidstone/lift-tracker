import { describe, expect, it } from 'vitest';
import {
  isSignedOutMidSession,
  wouldDropLocalSets,
  hasPendingOps,
  snapshotSets,
  rowsToMap,
} from '@/lib/syncDiff';
import {
  loadSyncedSnapshot,
  loadWorkoutCache,
  saveSyncedSnapshot,
  saveWorkoutCache,
} from '@/lib/localCache';

// ── Guards against the AUTH-FLAP data-loss class (fourth incident) ──
// When a background Supabase token refresh fails (e.g. a DNS/network blip), the
// session drops and an UNauthenticated server fetch returns an empty/partial copy.
// These pure guards stop that empty copy from overwriting real, un-synced local
// sets. See useWorkout reconcile + flush.

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
  };
}
const ex = (id, exerciseId, sets) => ({ id, exerciseId, name: exerciseId, sets });
const set = (id, weight = 100) => ({ id, weight, reps: 10, rpe: 8 });

describe('isSignedOutMidSession', () => {
  it('is true only when auth is required AND there is no user', () => {
    expect(isSignedOutMidSession({ authRequired: true, userId: null })).toBe(true);
    expect(isSignedOutMidSession({ authRequired: true, userId: undefined })).toBe(true);
  });
  it('is false when a user is present', () => {
    expect(isSignedOutMidSession({ authRequired: true, userId: 'u1' })).toBe(false);
  });
  it('is false in anonymous mode (auth not required)', () => {
    // Single-user dev build (VITE_REQUIRE_AUTH=false): userId is always null but
    // writes SHOULD still happen — the guard must not fire here.
    expect(isSignedOutMidSession({ authRequired: false, userId: null })).toBe(false);
  });
});

describe('wouldDropLocalSets', () => {
  it('is true when the server copy has fewer sets than the non-empty local desired', () => {
    expect(wouldDropLocalSets({ serverSetCount: 3, desiredSetCount: 17 })).toBe(true);
    expect(wouldDropLocalSets({ serverSetCount: 0, desiredSetCount: 17 })).toBe(true);
  });
  it('is false when the server has the same or more sets (a normal/clean adopt)', () => {
    expect(wouldDropLocalSets({ serverSetCount: 17, desiredSetCount: 17 })).toBe(false);
    expect(wouldDropLocalSets({ serverSetCount: 20, desiredSetCount: 17 })).toBe(false);
  });
  it('is false when the local desired is empty (nothing to protect)', () => {
    // An empty local workout adopting an empty server is fine; and the
    // finished-wipe self-heal (empty local, server has sets) is handled elsewhere.
    expect(wouldDropLocalSets({ serverSetCount: 0, desiredSetCount: 0 })).toBe(false);
  });
});

describe('auth-flap scenario: empty server must NOT wipe non-empty local cache', () => {
  it('keeps local sets when an unauthenticated reconcile sees an empty server', () => {
    const s = fakeStorage();
    const uid = 'u1';
    const date = '2026-10-20';

    // User logged a full session locally; only the baseline the SERVER confirmed
    // may be stale/empty (the flush never fully landed during the flap).
    const localSession = [
      ex('e1', 'row', [set('s1'), set('s2'), set('s3')]),
      ex('e2', 'curl', [set('s4'), set('s5'), set('s6')]),
    ];
    saveWorkoutCache(uid, date, { workoutId: 'w1', exercises: localSession }, s);
    saveSyncedSnapshot(uid, date, [], s); // nothing confirmed by the server yet

    const cachedDesired = snapshotSets(loadWorkoutCache(uid, date, s).exercises);
    const baseline = rowsToMap(loadSyncedSnapshot(uid, date, s));

    // The reconcile sees an EMPTY server copy (unauthenticated fetch).
    const serverSetCount = 0;

    // There ARE pending local ops (6 inserts) — so even the normal path keeps local,
    // but the guard must ALSO hold when the baseline is poisoned to look synced.
    expect(hasPendingOps(cachedDesired, baseline)).toBe(true);
    // The explicit guard: an empty/partial server must never drop these 6 sets.
    expect(
      wouldDropLocalSets({ serverSetCount, desiredSetCount: cachedDesired.size }),
    ).toBe(true);
  });

  it('still adopts the server for a same-count out-of-band edit (CLI change)', () => {
    // The legit case the app supports: server changed a set in place (same count).
    // The guard must NOT fire, so the adopt-server path still works.
    expect(wouldDropLocalSets({ serverSetCount: 1, desiredSetCount: 1 })).toBe(false);
  });
});
