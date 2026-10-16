// exerciseSort — pure helpers for how the exercise library is filtered and ordered
// wherever it's shown (the Today picker, the Plan editor picker, the Library tab).
//
// Favourites drive the behaviour:
//   * No search query  → show ONLY favourites (keeps the add-exercise list uncluttered
//     now that the library is large).
//   * With a query      → show ALL matches, but favourites first.
// `favoriteIds` is a Set of exercise ids, OR null when the favourites feature isn't
// available yet (e.g. the DB table doesn't exist / hasn't loaded). null means "don't
// filter" — fall back to showing the whole library alphabetically, so the app still
// works before the migration runs.

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

export function matchesQuery(name, q) {
  return name.toLowerCase().includes(q);
}

// Ordered/filtered list for an exercise picker.
export function pickerExercises(library, query, favoriteIds) {
  const q = (query ?? '').trim().toLowerCase();
  const list = q ? library.filter((e) => matchesQuery(e.name, q)) : [...library];

  // No favourites filter active → plain alphabetical (legacy behaviour).
  if (!favoriteIds) return list.sort(byName);

  // No query → favourites only.
  if (!q) return list.filter((e) => favoriteIds.has(e.id)).sort(byName);

  // Query → all matches, favourites first, each group alphabetical.
  const fav = [];
  const rest = [];
  for (const e of list) (favoriteIds.has(e.id) ? fav : rest).push(e);
  fav.sort(byName);
  rest.sort(byName);
  return [...fav, ...rest];
}

// Library-tab list: favourites first always (with or without a query), then the rest.
export function libraryExercises(library, query, favoriteIds) {
  const q = (query ?? '').trim().toLowerCase();
  const list = q ? library.filter((e) => matchesQuery(e.name, q)) : [...library];
  if (!favoriteIds) return list.sort(byName);
  const fav = [];
  const rest = [];
  for (const e of list) (favoriteIds.has(e.id) ? fav : rest).push(e);
  fav.sort(byName);
  rest.sort(byName);
  return [...fav, ...rest];
}

// Keep only recommended (history-ranked) exercises that are favourites. null favourites
// → unavailable, so pass everything through unchanged.
export function filterRecsToFavorites(recs, favoriteIds) {
  if (!favoriteIds) return recs;
  return recs.filter((r) => favoriteIds.has(r.exerciseId));
}
