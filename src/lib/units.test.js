import { describe, expect, it } from 'vitest';
import {
  fromDisplayWeight,
  kgToLb,
  lbToKg,
  toDisplayWeight,
  unitLabel,
  weightBounds,
  weightStep,
} from '@/lib/units';

describe('units', () => {
  it('converts lb <-> kg', () => {
    expect(lbToKg(100)).toBeCloseTo(45.359, 2);
    expect(kgToLb(45.359)).toBeCloseTo(100, 1);
  });

  it('display weight is unchanged for lb, rounded to 0.5 for kg', () => {
    expect(toDisplayWeight(135, 'lb')).toBe(135);
    expect(toDisplayWeight(100, 'kg')).toBe(45.5); // 45.359 -> 45.5
    expect(toDisplayWeight(45, 'kg')).toBe(20.5); // 20.41 -> 20.5
  });

  it('from-display returns lb unchanged for lb', () => {
    expect(fromDisplayWeight(135, 'lb')).toBe(135);
  });

  it('from-display converts kg back to lb (1 decimal)', () => {
    expect(fromDisplayWeight(45, 'kg')).toBeCloseTo(99.2, 1);
    expect(fromDisplayWeight(20, 'kg')).toBeCloseTo(44.1, 1);
  });

  it('round-trips a kg edit within tolerance', () => {
    const shown = toDisplayWeight(100, 'kg'); // 45.5
    const stored = fromDisplayWeight(shown, 'kg'); // ~100.3 lb
    expect(stored).toBeCloseTo(100, 0);
  });

  it('picks sane step per unit', () => {
    expect(weightStep('lb')).toBe(5);
    expect(weightStep('kg')).toBe(2.5);
  });

  it('converts bounds to the display unit', () => {
    const lb = { min: 0, max: 2000 };
    expect(weightBounds(lb, 'lb')).toEqual(lb);
    const kg = weightBounds(lb, 'kg');
    expect(kg.min).toBe(0);
    expect(kg.max).toBe(907); // 2000 lb -> ~907 kg
  });

  it('labels units', () => {
    expect(unitLabel('lb')).toBe('lb');
    expect(unitLabel('kg')).toBe('kg');
  });
});
