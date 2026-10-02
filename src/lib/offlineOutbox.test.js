import { describe, expect, it } from 'vitest';
import {
  loadSyncedSnapshot,
  loadWorkoutCache,
  saveSyncedSnapshot,
  saveWorkoutCache,
} from '@/lib/localCache';
import { diffOps, hasPendingOps, rowsToMap, snapshotSets } from '@/lib/syncDiff';

// End-to-end (logic-level) simulation of the offline outbox surviving a reload.
// No React here — we exercise the exact cache+diff functions the hook uses, with
// an in-memory storage standing in for localStorage.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

const ex = (id, exerciseId, sets) => ({ id, exerciseId, name: exerciseId, sets });
const set = (id, weight = 100) => ({ id, weight, reps: 10, rpe: 8 });

describe('offline outbox survives a reload', () => {
  it('detects an edit made offline after the app is reloaded offline', () => {
    const s = fakeStorage();
    const uid = 'u1';
    const date = '2026-09-28';

    // --- Initial online load: server had one set s1@100. Both caches written. ---
    const serverExercises = [ex('e1', 'bench', [set('s1', 100)])];
    saveWorkoutCache(uid, date, { workoutId: 'w1', type: 'Push', finished: false, exercises: serverExercises }, s);
    saveSyncedSnapshot(uid, date, [...snapshotSets(serverExercises).values()], s);

    // --- User goes OFFLINE and edits s1 to 135, adds s2. Write-through cache only. ---
    const offlineEdited = [ex('e1', 'bench', [set('s1', 135), set('s2', 100)])];
    saveWorkoutCache(uid, date, { workoutId: 'w1', type: 'Push', finished: false, exercises: offlineEdited }, s);
    // (synced snapshot NOT updated — the server never confirmed these)

    // --- RELOAD while still offline: hydrate desired from workout cache,
    //     baseline from the SYNCED snapshot (the fix). ---
    const cachedWorkout = loadWorkoutCache(uid, date, s);
    const cachedSynced = loadSyncedSnapshot(uid, date, s);
    const desired = snapshotSets(cachedWorkout.exercises);
    const baseline = rowsToMap(cachedSynced);

    // The pending edits must STILL be detected (not silently dropped).
    expect(hasPendingOps(desired, baseline)).toBe(true);
    const ops = diffOps(desired, baseline);
    expect(ops.updates.map((r) => r.id)).toEqual(['s1']); // s1 135 vs 100
    expect(ops.inserts.map((r) => r.id)).toEqual(['s2']); // s2 added offline
  });

  it('reports NO pending ops when synced snapshot matches desired (clean reload)', () => {
    const s = fakeStorage();
    const uid = 'u1';
    const date = '2026-09-28';
    const exercises = [ex('e1', 'bench', [set('s1', 100)])];
    saveWorkoutCache(uid, date, { workoutId: 'w1', exercises }, s);
    saveSyncedSnapshot(uid, date, [...snapshotSets(exercises).values()], s);

    const desired = snapshotSets(loadWorkoutCache(uid, date, s).exercises);
    const baseline = rowsToMap(loadSyncedSnapshot(uid, date, s));
    expect(hasPendingOps(desired, baseline)).toBe(false);
  });

  it('out-of-band server change is adopted when there are NO local edits', () => {
    // Reproduces the "CLI changed exercise, app showed stale name" bug.
    // cached desired == synced baseline (no local edits) → server copy should win.
    const baselineRows = [
      { id: 's1', exerciseId: 'benchId', weight: 25, reps: 12, rpe: 5, setOrder: 0 },
    ];
    const cachedDesired = new Map(baselineRows.map((r) => [r.id, r]));
    const syncedBaseline = new Map(baselineRows.map((r) => [r.id, { ...r }]));
    // Server now points the same set at a different exercise (preacherId).
    const serverSnap = new Map([
      ['s1', { id: 's1', exerciseId: 'preacherId', weight: 25, reps: 12, rpe: 5, setOrder: 0 }],
    ]);
    // The reconcile decision compares cached desired vs the SYNCED baseline.
    expect(hasPendingOps(cachedDesired, syncedBaseline)).toBe(false); // no local edits → adopt server
    // Comparing against the server (the OLD buggy test) would look like a change:
    expect(hasPendingOps(cachedDesired, serverSnap)).toBe(true);
  });

  it('genuine local edit is preserved against the synced baseline', () => {
    const syncedBaseline = new Map([
      ['s1', { id: 's1', exerciseId: 'a', weight: 100, reps: 10, rpe: 8, setOrder: 0 }],
    ]);
    const cachedDesired = new Map([
      ['s1', { id: 's1', exerciseId: 'a', weight: 145, reps: 10, rpe: 8, setOrder: 0 }],
    ]);
    expect(hasPendingOps(cachedDesired, syncedBaseline)).toBe(true); // keep local
  });

  it('advancing the synced snapshot (after a successful flush) clears pending', () => {
    const s = fakeStorage();
    const uid = 'u1';
    const date = '2026-09-28';
    const edited = [ex('e1', 'bench', [set('s1', 135)])];
    saveWorkoutCache(uid, date, { workoutId: 'w1', exercises: edited }, s);
    saveSyncedSnapshot(uid, date, [{ id: 's1', exerciseId: 'bench', weight: 100, reps: 10, rpe: 8, setOrder: 0 }], s);

    // before flush: pending
    let desired = snapshotSets(loadWorkoutCache(uid, date, s).exercises);
    let baseline = rowsToMap(loadSyncedSnapshot(uid, date, s));
    expect(hasPendingOps(desired, baseline)).toBe(true);

    // simulate flush success: synced snapshot advances to desired
    saveSyncedSnapshot(uid, date, [...desired.values()], s);
    baseline = rowsToMap(loadSyncedSnapshot(uid, date, s));
    expect(hasPendingOps(desired, baseline)).toBe(false);
  });
});
