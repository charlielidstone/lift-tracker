import { describe, expect, it } from 'vitest';
import { recommendExercises } from '@/lib/recommend';

const wk = (type, ...names) => ({
  type,
  exercises: names.map((n) => ({ exerciseId: n.toLowerCase(), name: n })),
});

const history = [
  wk('Push', 'Bench Press', 'Pec deck', 'Overhead tricep'),
  wk('Push', 'Bench Press', 'Pec deck'),
  wk('Push', 'Bench Press'),
  wk('Pull', 'Lat pulldown', 'Bicep Curl'),
  wk('Pull', 'Lat pulldown'),
];

describe('recommendExercises', () => {
  it('ranks by frequency within the selected type', () => {
    const rec = recommendExercises(history, { type: 'Push' });
    expect(rec.map((r) => r.name)).toEqual(['Bench Press', 'Pec deck', 'Overhead tricep']);
  });

  it('only considers the matching type', () => {
    const rec = recommendExercises(history, { type: 'Pull' });
    expect(rec.map((r) => r.name)).toEqual(['Lat pulldown', 'Bicep Curl']);
  });

  it('falls back to overall frequency when no type set', () => {
    const rec = recommendExercises(history, { type: null });
    // Bench Press (3) is the single most frequent overall
    expect(rec[0].name).toBe('Bench Press');
  });

  it('falls back to overall when the type has no history', () => {
    const rec = recommendExercises(history, { type: 'Legs' });
    expect(rec.length).toBeGreaterThan(0); // not empty — used overall
    expect(rec[0].name).toBe('Bench Press');
  });

  it('excludes ids already in today', () => {
    const rec = recommendExercises(history, { type: 'Push', excludeIds: ['bench press'] });
    expect(rec.map((r) => r.name)).not.toContain('Bench Press');
    expect(rec[0].name).toBe('Pec deck');
  });

  it('respects the limit', () => {
    const rec = recommendExercises(history, { type: 'Push', limit: 2 });
    expect(rec).toHaveLength(2);
  });

  it('breaks frequency ties alphabetically', () => {
    const h = [wk('Push', 'Zebra', 'Apple')]; // both count 1
    const rec = recommendExercises(h, { type: 'Push' });
    expect(rec.map((r) => r.name)).toEqual(['Apple', 'Zebra']);
  });

  it('handles empty history', () => {
    expect(recommendExercises([], { type: 'Push' })).toEqual([]);
    expect(recommendExercises(null, { type: null })).toEqual([]);
  });
});
