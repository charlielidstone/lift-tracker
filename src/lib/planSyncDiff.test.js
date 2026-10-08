import { describe, it, expect } from 'vitest';
import {
  snapshotPlans,
  planExerciseChanged,
  snapshotToRows,
  rowsToSnapshot,
  diffPlanOps,
  hasPendingPlanOps,
} from './planSyncDiff';

const plan = (over = {}) => ({
  id: 'p1',
  type: 'Push',
  name: 'Default',
  exercises: [
    {
      id: 'pe1',
      exerciseId: 'x1',
      name: 'Machine chest press',
      targetSets: 3,
      repMin: 6,
      repMax: 8,
      rpe: 8,
      position: 0,
    },
  ],
  ...over,
});

describe('snapshotPlans', () => {
  it('flattens plans into parent + child maps', () => {
    const snap = snapshotPlans([plan()]);
    expect(snap.plans.get('p1')).toEqual({ id: 'p1', type: 'Push', name: 'Default' });
    expect(snap.exercises.get('pe1')).toMatchObject({
      id: 'pe1',
      planId: 'p1',
      exerciseId: 'x1',
      targetSets: 3,
      repMin: 6,
      repMax: 8,
      rpe: 8,
      position: 0,
    });
  });

  it('defaults position to array index and rpe to null', () => {
    const p = plan({ exercises: [{ id: 'pe1', exerciseId: 'x1', targetSets: 3, repMin: 8, repMax: 12 }] });
    const snap = snapshotPlans([p]);
    expect(snap.exercises.get('pe1').position).toBe(0);
    expect(snap.exercises.get('pe1').rpe).toBe(null);
  });
});

describe('planExerciseChanged', () => {
  const base = { targetSets: 3, repMin: 6, repMax: 8, rpe: 8, position: 0, exerciseId: 'x1', planId: 'p1' };
  it('is false for identical rows', () => {
    expect(planExerciseChanged(base, { ...base })).toBe(false);
  });
  it('detects a changed target', () => {
    expect(planExerciseChanged(base, { ...base, repMax: 10 })).toBe(true);
    expect(planExerciseChanged(base, { ...base, targetSets: 4 })).toBe(true);
    expect(planExerciseChanged(base, { ...base, rpe: null })).toBe(true);
  });
});

describe('snapshot round-trip', () => {
  it('serializes to rows and back without loss', () => {
    const snap = snapshotPlans([plan()]);
    const back = rowsToSnapshot(snapshotToRows(snap));
    expect([...back.plans.keys()]).toEqual(['p1']);
    expect(back.exercises.get('pe1')).toEqual(snap.exercises.get('pe1'));
  });
  it('rowsToSnapshot tolerates empty/missing input', () => {
    const snap = rowsToSnapshot(null);
    expect(snap.plans.size).toBe(0);
    expect(snap.exercises.size).toBe(0);
  });
});

describe('diffPlanOps', () => {
  const empty = snapshotPlans([]);

  it('inserts a new plan and its exercises', () => {
    const d = diffPlanOps(snapshotPlans([plan()]), empty);
    expect(d.planInserts.map((p) => p.id)).toEqual(['p1']);
    expect(d.exInserts.map((e) => e.id)).toEqual(['pe1']);
  });

  it('updates a changed plan exercise, not an unchanged one', () => {
    const synced = snapshotPlans([plan()]);
    const desired = snapshotPlans([
      plan({ exercises: [{ id: 'pe1', exerciseId: 'x1', targetSets: 4, repMin: 6, repMax: 8, rpe: 8, position: 0 }] }),
    ]);
    const d = diffPlanOps(desired, synced);
    expect(d.exUpdates.map((e) => e.id)).toEqual(['pe1']);
    expect(d.exInserts).toEqual([]);

    const same = diffPlanOps(snapshotPlans([plan()]), synced);
    expect(same.exUpdates).toEqual([]);
  });

  it('deletes a removed exercise, keeping the plan', () => {
    const synced = snapshotPlans([plan()]);
    const desired = snapshotPlans([plan({ exercises: [] })]);
    const d = diffPlanOps(desired, synced);
    expect(d.exDeletes).toEqual(['pe1']);
    expect(d.planDeletes).toEqual([]);
  });

  it('deletes a removed plan', () => {
    const synced = snapshotPlans([plan()]);
    const d = diffPlanOps(empty, synced);
    expect(d.planDeletes).toEqual(['p1']);
    expect(d.exDeletes).toEqual(['pe1']);
  });
});

describe('hasPendingPlanOps', () => {
  it('is false when desired matches the synced baseline', () => {
    const snap = snapshotPlans([plan()]);
    expect(hasPendingPlanOps(snap, snapshotPlans([plan()]))).toBe(false);
  });
  it('is true when there are un-synced edits', () => {
    expect(hasPendingPlanOps(snapshotPlans([plan()]), snapshotPlans([]))).toBe(true);
  });
});
