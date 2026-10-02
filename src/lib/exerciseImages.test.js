import { describe, expect, it } from 'vitest';
import { exerciseImageUrl, normalizeName, resolveSlug } from '@/lib/exerciseImages';

describe('exerciseImages', () => {
  it('normalizes names (case + punctuation)', () => {
    expect(normalizeName('Preacher Curl')).toBe('preacher curl');
    expect(normalizeName('Single-Arm  Cable Lat Raise!')).toBe('single arm cable lat raise');
    expect(normalizeName(null)).toBe('');
  });

  it('resolves curated library names to slugs', () => {
    expect(resolveSlug('Bench Press')).toBe('bench-press');
    expect(resolveSlug('Preacher Curl')).toBe('preacher-curl');
    // custom name that fuzzy-matching got wrong — curated map fixes it
    expect(resolveSlug('Single arm cable lat raise')).toBe('cable-lateral-raise');
    expect(resolveSlug('Machine back fly')).toBe('rear-delt-fly');
  });

  it('is tolerant of label edits (case/spacing)', () => {
    expect(resolveSlug('bench press')).toBe('bench-press');
    expect(resolveSlug('  Pec   Deck ')).toBe('pec-deck');
  });

  it('falls back to a normalized-name slug when it is bundled', () => {
    // "Lat Pulldown" → "lat-pulldown" is both curated AND a direct guess
    expect(resolveSlug('Lat Pulldown')).toBe('lat-pulldown');
  });

  it('returns null for unknown exercises', () => {
    expect(resolveSlug('Nordic Hamstring Curl')).toBeNull();
    expect(exerciseImageUrl('Totally Made Up Lift')).toBeNull();
  });

  it('builds a public URL for matched exercises', () => {
    expect(exerciseImageUrl('Bench Press')).toBe('/exercise-img/bench-press.png');
    expect(exerciseImageUrl('Overhead tricep extension')).toBe(
      '/exercise-img/overhead-tricep-extension.png',
    );
  });
});
