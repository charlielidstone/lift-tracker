import { describe, expect, it } from 'vitest';
import {
  pickerExercises,
  libraryExercises,
  filterRecsToFavorites,
  matchesQuery,
} from '@/lib/exerciseSort';

const ex = (id, name) => ({ id, name, muscle_group: 'x' });

const lib = [
  ex('a', 'Bench Press'),
  ex('b', 'Deadlift'),
  ex('c', 'Arnold Press'),
  ex('d', 'Zercher Squat'),
];

const favs = new Set(['a', 'c']); // Bench Press, Arnold Press

describe('pickerExercises', () => {
  it('no favourites filter (null) → whole library alphabetical', () => {
    expect(pickerExercises(lib, '', null).map((e) => e.name)).toEqual([
      'Arnold Press',
      'Bench Press',
      'Deadlift',
      'Zercher Squat',
    ]);
  });

  it('with favourites + no query → favourites only, alphabetical', () => {
    expect(pickerExercises(lib, '', favs).map((e) => e.name)).toEqual([
      'Arnold Press',
      'Bench Press',
    ]);
  });

  it('with favourites + query → all matches, favourites first', () => {
    // "press" matches Bench Press (fav), Arnold Press (fav) — both favourites here.
    expect(pickerExercises(lib, 'press', favs).map((e) => e.name)).toEqual([
      'Arnold Press',
      'Bench Press',
    ]);
  });

  it('query surfaces non-favourites but after favourites', () => {
    const favsOnlyBench = new Set(['a']);
    // query 's' matches Bench Press(a,fav), Deadlift? no. Arnold Press? no 's'... has 's'? "Arnold Press" has no s? yes "Press" has s. Zercher Squat has s.
    const got = pickerExercises(lib, 's', favsOnlyBench).map((e) => e.name);
    // favourites first (Bench Press), then rest alphabetical (Arnold Press, Zercher Squat)
    expect(got[0]).toBe('Bench Press');
    expect(got.slice(1)).toEqual(['Arnold Press', 'Zercher Squat']);
  });

  it('empty favourites set + no query → empty (a real empty favourites list)', () => {
    expect(pickerExercises(lib, '', new Set())).toEqual([]);
  });
});

describe('libraryExercises', () => {
  it('always lists favourites first, then the rest alphabetical', () => {
    expect(libraryExercises(lib, '', favs).map((e) => e.name)).toEqual([
      'Arnold Press',
      'Bench Press',
      'Deadlift',
      'Zercher Squat',
    ]);
  });

  it('null favourites → plain alphabetical', () => {
    expect(libraryExercises(lib, '', null).map((e) => e.name)).toEqual([
      'Arnold Press',
      'Bench Press',
      'Deadlift',
      'Zercher Squat',
    ]);
  });
});

describe('filterRecsToFavorites', () => {
  const recs = [
    { exerciseId: 'a', name: 'Bench Press' },
    { exerciseId: 'b', name: 'Deadlift' },
    { exerciseId: 'c', name: 'Arnold Press' },
  ];

  it('keeps only favourites', () => {
    expect(filterRecsToFavorites(recs, favs).map((r) => r.name)).toEqual([
      'Bench Press',
      'Arnold Press',
    ]);
  });

  it('null favourites → unchanged (feature unavailable)', () => {
    expect(filterRecsToFavorites(recs, null)).toHaveLength(3);
  });
});

describe('matchesQuery', () => {
  it('is case-insensitive substring', () => {
    expect(matchesQuery('Bench Press', 'press')).toBe(true);
    expect(matchesQuery('Bench Press', 'xyz')).toBe(false);
  });
});
