import { describe, expect, it } from 'vitest';
import {
  diffOps,
  hasPendingOps,
  mapToRows,
  rowChanged,
  rowsToMap,
  snapshotSets,
} from '@/lib/syncDiff';

// Build a UI-shaped exercises array quickly.
const ex = (id, exerciseId, sets) => ({ id, exerciseId, name: exerciseId, sets });
const set = (id, weight = 100, reps = 10, rpe = 8) => ({ id, weight, reps, rpe });

describe('snapshotSets', () => {
  it('flattens exercises to a setId→row map with setOrder', () => {
    const map = snapshotSets([ex('e1', 'bench', [set('s1'), set('s2')])]);
    expect(map.size).toBe(2);
    expect(map.get('s1')).toMatchObject({ id: 's1', exerciseId: 'bench', setOrder: 0 });
    expect(map.get('s2').setOrder).toBe(1);
  });

  it('normalizes missing rpe to null', () => {
    const map = snapshotSets([ex('e1', 'bench', [{ id: 's1', weight: 100, reps: 10 }])]);
    expect(map.get('s1').rpe).toBeNull();
  });
});

describe('rowChanged', () => {
  const base = { weight: 100, reps: 10, rpe: 8, setOrder: 0, exerciseId: 'a' };
  it('false when identical', () => {
    expect(rowChanged(base, { ...base })).toBe(false);
  });
  it.each(['weight', 'reps', 'rpe', 'setOrder', 'exerciseId'])('true when %s differs', (field) => {
    expect(rowChanged(base, { ...base, [field]: 'X' })).toBe(true);
  });
});

describe('rowsToMap / mapToRows round-trip', () => {
  it('preserves rows', () => {
    const rows = [{ id: 's1', weight: 100 }, { id: 's2', weight: 105 }];
    expect(mapToRows(rowsToMap(rows))).toEqual(rows);
  });
  it('rowsToMap tolerates null/undefined', () => {
    expect(rowsToMap(null).size).toBe(0);
    expect(rowsToMap(undefined).size).toBe(0);
  });
});

describe('diffOps — the outbox core', () => {
  it('no changes → all empty', () => {
    const cur = snapshotSets([ex('e1', 'bench', [set('s1')])]);
    const ops = diffOps(cur, cur);
    expect(ops).toEqual({ inserts: [], updates: [], setDeletes: [], exerciseDeletes: [] });
  });

  it('new set → insert', () => {
    const saved = snapshotSets([ex('e1', 'bench', [set('s1')])]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1'), set('s2')])]);
    const ops = diffOps(desired, saved);
    expect(ops.inserts.map((r) => r.id)).toEqual(['s2']);
    expect(ops.updates).toEqual([]);
  });

  it('edited weight → update', () => {
    const saved = snapshotSets([ex('e1', 'bench', [set('s1', 100)])]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1', 135)])]);
    const ops = diffOps(desired, saved);
    expect(ops.updates.map((r) => r.id)).toEqual(['s1']);
    expect(ops.inserts).toEqual([]);
  });

  it('removed single set → setDelete', () => {
    const saved = snapshotSets([ex('e1', 'bench', [set('s1'), set('s2')])]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1')])]);
    const ops = diffOps(desired, saved);
    expect(ops.setDeletes).toEqual(['s2']);
    expect(ops.exerciseDeletes).toEqual([]);
  });

  it('removed whole exercise → one exerciseDelete, not N setDeletes', () => {
    const saved = snapshotSets([
      ex('e1', 'bench', [set('s1'), set('s2')]),
      ex('e2', 'squat', [set('s3')]),
    ]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1'), set('s2')])]);
    const ops = diffOps(desired, saved);
    expect(ops.exerciseDeletes).toEqual(['squat']);
    expect(ops.setDeletes).toEqual([]); // collapsed, not individual
  });

  it('accumulates multiple offline edits (insert+update+delete together)', () => {
    const saved = snapshotSets([ex('e1', 'bench', [set('s1', 100), set('s2', 100)])]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1', 145), set('s3', 100)])]);
    const ops = diffOps(desired, saved);
    expect(ops.updates.map((r) => r.id)).toEqual(['s1']); // s1 changed
    expect(ops.inserts.map((r) => r.id)).toEqual(['s3']); // s3 new
    expect(ops.setDeletes).toEqual(['s2']); // s2 gone
  });
});

describe('hasPendingOps', () => {
  it('false when in sync', () => {
    const cur = snapshotSets([ex('e1', 'bench', [set('s1')])]);
    expect(hasPendingOps(cur, cur)).toBe(false);
  });
  it('true with any pending change', () => {
    const saved = snapshotSets([ex('e1', 'bench', [set('s1', 100)])]);
    const desired = snapshotSets([ex('e1', 'bench', [set('s1', 105)])]);
    expect(hasPendingOps(desired, saved)).toBe(true);
  });
});
