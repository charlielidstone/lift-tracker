// units.js — weight unit conversion for DISPLAY only.
//
// Weight is stored canonically in POUNDS (lb) everywhere (DB, cache, state). The
// kg setting changes only how weight is shown + stepped; on edit we convert the
// displayed value back to lb before storing. Values the user doesn't touch keep
// their exact stored lb — display is a derived, rounded view (no drift).

export const UNITS = ['lb', 'kg'];
const LB_PER_KG = 2.20462262;

export function lbToKg(lb) {
  return lb / LB_PER_KG;
}
export function kgToLb(kg) {
  return kg * LB_PER_KG;
}

// Round helpers: kg shown to the nearest 0.5 (plate-ish), lb kept whole.
function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

// lb (canonical) -> number shown in the chosen unit.
export function toDisplayWeight(lb, unit) {
  return unit === 'kg' ? roundHalf(lbToKg(lb)) : lb;
}

// A value the user just set in the chosen unit -> lb to store.
// kg is rounded to 1 decimal to keep the DB tidy and avoid float-noise writes.
export function fromDisplayWeight(value, unit) {
  return unit === 'kg' ? Math.round(kgToLb(value) * 10) / 10 : value;
}

// Per-tap increment in the chosen unit (5 lb / 2.5 kg are the natural jumps).
export function weightStep(unit) {
  return unit === 'kg' ? 2.5 : 5;
}

// Clamp bounds (from canonical lb bounds) expressed in the chosen unit.
export function weightBounds(lbBounds, unit) {
  if (unit !== 'kg') return lbBounds;
  return {
    min: Math.round(lbToKg(lbBounds.min)),
    max: Math.round(lbToKg(lbBounds.max)),
  };
}

export function unitLabel(unit) {
  return unit === 'kg' ? 'kg' : 'lb';
}
