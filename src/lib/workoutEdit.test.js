import { describe, expect, it } from 'vitest';
import { diffWorkout, isEmptyDiff } from '@/lib/workoutEdit';

const base = {
  id: 'w1',
  date: '2026-10-04',
  type: 'Upper',
  exercises: [
    {
      id: 'bench',
      exerciseId: 'bench',
      name: 'Bench Press',
      sets: [
        { id: 's1', weight: 135, reps: 8, rpe: 7 },
        { id: 's2', weight: 145, reps: 6, rpe: 8 },
      ],
    },
    {
      id: 'row',
      exerciseId: 'row',
      name: 'Row',
      sets: [{ id: 's3', weight: 95, reps: 10, rpe: null }],
    },
  ],
};

// deep-ish clone so edits don't mutate base
const clone = (w) => JSON.parse(JSON.stringify(w));

describe('diffWorkout', () => {
  it('detects no changes', () => {
    const d = diffWorkout(base, clone(base));
    expect(isEmptyDiff(d)).toBe(true);
    expect(d.type.changed).toBe(false);
  });

  it('detects a type change', () => {
    const e = clone(base);
    e.type = 'Push';
    const d = diffWorkout(base, e);
    expect(d.type).toEqual({ changed: true, value: 'Push' });
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('clears the type (null)', () => {
    const e = clone(base);
    e.type = null;
    expect(diffWorkout(base, e).type).toEqual({ changed: true, value: null });
  });

  it('patches only changed set fields', () => {
    const e = clone(base);
    e.exercises[0].sets[0].weight = 155;
    const d = diffWorkout(base, e);
    expect(d.updates).toEqual([{ id: 's1', patch: { weight: 155 } }]);
  });

  it('patches multiple fields on one set', () => {
    const e = clone(base);
    e.exercises[0].sets[1] = { id: 's2', weight: 150, reps: 5, rpe: 9 };
    const d = diffWorkout(base, e);
    expect(d.updates).toHaveLength(1);
    expect(d.updates[0]).toEqual({ id: 's2', patch: { weight: 150, reps: 5, rpe: 9 } });
  });

  it('detects a deleted set', () => {
    const e = clone(base);
    e.exercises[0].sets = [e.exercises[0].sets[0]]; // drop s2
    const d = diffWorkout(base, e);
    expect(d.deletes).toEqual(['s2']);
    expect(d.updates).toHaveLength(0);
  });

  it('removing a whole exercise deletes all its sets', () => {
    const e = clone(base);
    e.exercises = [e.exercises[0]]; // drop the Row exercise (s3)
    const d = diffWorkout(base, e);
    expect(d.deletes).toEqual(['s3']);
  });

  it('detects an added set with its exercise + order', () => {
    const e = clone(base);
    e.exercises[0].sets.push({ id: 's9', weight: 135, reps: 8, rpe: 7 });
    const d = diffWorkout(base, e);
    expect(d.inserts).toEqual([
      { id: 's9', exerciseId: 'bench', weight: 135, reps: 8, rpe: 7, setOrder: 2 },
    ]);
  });

  it('treats null and undefined rpe as equal (no spurious update)', () => {
    const e = clone(base);
    delete e.exercises[1].sets[0].rpe; // was null
    const d = diffWorkout(base, e);
    expect(d.updates).toHaveLength(0);
  });

  it('is safe on empty/null input', () => {
    const d = diffWorkout(null, null);
    expect(isEmptyDiff(d)).toBe(true);
  });
});
