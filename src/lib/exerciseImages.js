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
  'cable lat raises': 'cable-lateral-raise',
  'dumbbell lateral raise': 'lateral-raise',
  'dumbbell shoulder press': 'seated-dumbbell-press',
  'flat dumbbell press': 'flat-dumbbell-press',
  'hip thrust': 'hip-thrust',
  'incline bench bicep curl': 'bicep-curl',
  'incline bench press': 'incline-bench-press',
  'incline dumbbell press': 'incline-dumbbell-press',
  'lat pulldown': 'lat-pulldown',
  'leg extension': 'leg-extension',
  'leg press': 'leg-press',
  'lying leg curl': 'lying-leg-curl',
  'machine back fly': 'reverse-pec-deck',
  'machine shoulder press': 'machine-shoulder-press',
  'overhead tricep extension': 'overhead-tricep-extension',
  'pec deck': 'pec-deck',
  'preacher curl': 'preacher-curl',
  'seated cable row': 'seated-row',
  'seated calf raise': 'seated-calf-raise',
  'seated leg curl': 'seated-leg-curl',
  'single arm cable lat raise': 'cable-lateral-raise',
  'single arm machine row': 'machine-row',
  'standing calf raise': 'standing-calf-raise',
  'straight bar cable tricep pushdown': 'tricep-pushdown',

  // Common-exercise library expansion (built-in staples, art from the same pack).
  'ab wheel': 'ab-wheel',
  'arnold press': 'arnold-press',
  'back extension': 'back-extension',
  'back squat': 'squat',
  'barbell row': 'barbell-row',
  'bench dip': 'bench-dip',
  'bicep curl': 'bicep-curl',
  'bicycle crunch': 'bicycle-crunch',
  'bulgarian split squat': 'bulgarian-split-squat',
  'cable crunch': 'cable-crunch',
  'cable curl': 'cable-curl',
  'cable fly': 'cable-fly',
  'calf raise': 'calf-raise',
  'chest dip': 'chest-dip',
  'chest supported row': 'chest-supported-row',
  'chin up': 'chin-up',
  'close grip bench press': 'close-grip-bench-press',
  'concentration curl': 'concentration-curl',
  'crunch': 'crunch',
  'deadlift': 'deadlift',
  'decline bench press': 'decline-bench-press',
  'dumbbell fly': 'dumbbell-fly',
  'ez bar curl': 'ez-bar-curl',
  'face pull': 'face-pull',
  'front raise': 'front-raise',
  'front squat': 'front-squat',
  'glute bridge': 'glute-bridge',
  'goblet squat': 'goblet-squat',
  'good morning': 'good-morning',
  'hack squat': 'hack-squat',
  'hammer curl': 'hammer-curl',
  'hanging knee raise': 'hanging-knee-raise',
  'hanging leg raise': 'hanging-leg-raise',
  'inverted row': 'inverted-row',
  'leg curl': 'leg-curl',
  'machine lateral raise': 'machine-lateral-raise',
  'one arm dumbbell row': 'one-arm-dumbbell-row',
  'overhead press': 'overhead-press',
  'plank': 'plank',
  'pull up': 'pull-up',
  'push up': 'push-up',
  'rear delt fly': 'rear-delt-fly',
  'reverse pec deck': 'reverse-pec-deck',
  'romanian deadlift': 'romanian-deadlift',
  'rope tricep pushdown': 'rope-tricep-pushdown',
  'russian twist': 'russian-twist',
  'seated dumbbell press': 'seated-dumbbell-press',
  'shrug': 'shrug',
  'side plank': 'side-plank',
  'skull crusher': 'skull-crusher',
  'step up': 'step-up',
  'straight arm pulldown': 'straight-arm-pulldown',
  'sumo deadlift': 'sumo-deadlift',
  't bar row': 't-bar-row',
  'tricep kickback': 'tricep-kickback',
  'tricep pushdown': 'tricep-pushdown',
  'upright row': 'upright-row',
  'walking lunge': 'walking-lunge',
  'wide grip lat pulldown': 'wide-grip-lat-pulldown',
  'wrist curl': 'wrist-curl',
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
