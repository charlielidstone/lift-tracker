import { describe, expect, it } from 'vitest';
import {
  loadLibraryCache,
  loadWorkoutCache,
  saveLibraryCache,
  saveWorkoutCache,
  workoutKey,
  libraryKey,
} from '@/lib/localCache';

// A minimal in-memory fake of the Web Storage API — lets us test the cache
// without a real browser. `throwOnSet` simulates quota-exceeded / disabled storage.
function fakeStorage({ throwOnSet = false, throwOnGet = false } = {}) {
  const map = new Map();
  return {
    getItem(k) {
      if (throwOnGet) throw new Error('blocked');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (throwOnSet) throw new Error('quota');
      map.set(k, v);
    },
    removeItem(k) {
      map.delete(k);
    },
    _map: map,
  };
}

describe('localCache keys', () => {
  it('namespaces workout keys by user and date', () => {
    expect(workoutKey('u1', '2026-09-27')).not.toBe(workoutKey('u2', '2026-09-27'));
    expect(workoutKey('u1', '2026-09-27')).not.toBe(workoutKey('u1', '2026-09-28'));
  });

  it('falls back to anon when no user id', () => {
    expect(workoutKey(null, '2026-09-27')).toContain('anon');
    expect(libraryKey(undefined)).toContain('anon');
  });
});

describe('workout cache round-trip', () => {
  it('saves and loads a payload', () => {
    const s = fakeStorage();
    const payload = { workoutId: 'w1', type: 'Push', finished: false, exercises: [{ id: 'e1' }] };
    saveWorkoutCache('u1', '2026-09-27', payload, s);
    const got = loadWorkoutCache('u1', '2026-09-27', s);
    expect(got.workoutId).toBe('w1');
    expect(got.type).toBe('Push');
    expect(got.exercises).toEqual([{ id: 'e1' }]);
    expect(typeof got.cachedAt).toBe('number');
  });

  it('returns null on a cache miss', () => {
    expect(loadWorkoutCache('u1', '2026-09-27', fakeStorage())).toBeNull();
  });

  it('isolates different users', () => {
    const s = fakeStorage();
    saveWorkoutCache('u1', '2026-09-27', { workoutId: 'a' }, s);
    saveWorkoutCache('u2', '2026-09-27', { workoutId: 'b' }, s);
    expect(loadWorkoutCache('u1', '2026-09-27', s).workoutId).toBe('a');
    expect(loadWorkoutCache('u2', '2026-09-27', s).workoutId).toBe('b');
  });
});

describe('library cache round-trip', () => {
  it('saves and loads the library array', () => {
    const s = fakeStorage();
    const lib = [{ id: 'x', name: 'Bench Press' }];
    saveLibraryCache('u1', lib, s);
    expect(loadLibraryCache('u1', s)).toEqual(lib);
  });

  it('returns null when unset', () => {
    expect(loadLibraryCache('u1', fakeStorage())).toBeNull();
  });
});

describe('graceful failure (never throws)', () => {
  it('save returns false instead of throwing on quota error', () => {
    const s = fakeStorage({ throwOnSet: true });
    expect(saveWorkoutCache('u1', '2026-09-27', { workoutId: 'w' }, s)).toBe(false);
  });

  it('load returns null instead of throwing when storage is blocked', () => {
    const s = fakeStorage({ throwOnGet: true });
    expect(loadWorkoutCache('u1', '2026-09-27', s)).toBeNull();
  });

  it('load returns null on corrupt JSON', () => {
    const s = fakeStorage();
    s.setItem(workoutKey('u1', '2026-09-27'), '{not valid json');
    expect(loadWorkoutCache('u1', '2026-09-27', s)).toBeNull();
  });
});
