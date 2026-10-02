// exerciseImages — map an exercise (by name) to its illustration.
//
// Images are white line-art figures (Hevy/Strava style) from @bryllim/workout-guide
// (illustrations © Bryl Lim / Everkinetic, CC BY-SA 4.0). We bundle one frame per
// matched exercise under public/exercise-img/<slug>.png so they precache for offline.
//
// Matching is by a hand-curated name→slug map (the library is small and some names
// are custom), with a normalized-name fallback for anything not in the map. Returns
// null when there's no match, so the UI can show a placeholder.

const BASE = '/exercise-img';

// Curated: your library name (normalized) → workout-guide slug.
// Keys are lowercased + punctuation-stripped (see normalize) so minor label edits
// still match.
const NAME_TO_SLUG = {
  'assisted wide grip dips': 'assisted-dip',
  'bench press': 'bench-press',
  'cable bicep curl': 'bicep-curl',
  'dumbbell lateral raise': 'lateral-raise',
  'dumbbell shoulder press': 'seated-dumbbell-press',
  'incline bench bicep curl': 'bicep-curl',
  'incline bench press': 'incline-bench-press',
  'incline dumbbell press': 'incline-dumbbell-press',
  'lat pulldown': 'lat-pulldown',
  'machine back fly': 'rear-delt-fly',
  'machine shoulder press': 'machine-shoulder-press',
  'overhead tricep extension': 'overhead-tricep-extension',
  'pec deck': 'pec-deck',
  'preacher curl': 'preacher-curl',
  'seated cable row': 'seated-row',
  'single arm cable lat raise': 'cable-lateral-raise',
  'single arm machine row': 'machine-row',
  'straight bar cable tricep pushdown': 'tricep-pushdown',
};

// The slugs we actually bundled (so the fallback never points at a missing file).
const BUNDLED = new Set(Object.values(NAME_TO_SLUG));

export function normalizeName(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Resolve a slug for an exercise name: curated map first, then a direct
// normalized-name→slug guess (e.g. "Pec Deck" → "pec-deck") if that slug is bundled.
export function resolveSlug(name) {
  const key = normalizeName(name);
  if (NAME_TO_SLUG[key]) return NAME_TO_SLUG[key];
  const guess = key.replace(/\s+/g, '-');
  return BUNDLED.has(guess) ? guess : null;
}

// Public URL of the illustration, or null if we have no image for this exercise.
export function exerciseImageUrl(name) {
  const slug = resolveSlug(name);
  return slug ? `${BASE}/${slug}.png` : null;
}
