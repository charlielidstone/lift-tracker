// split.js — a user's gym split: named days mapped to muscle groups.
//
// A "split" is an ordered list of days:
//   [{ id, name, muscleGroups: string[] }, ...]
// e.g. { name: 'Push', muscleGroups: ['chest', 'shoulders', 'arms'] }.
// No weekly schedule in v1 — days are named templates. When today's workout TYPE
// matches a day's name, the recommended chips boost that day's muscle groups.
//
// Pure, no React. Persistence lives in SplitProvider.

// Common lifting muscle groups offered in the picker (unioned with whatever is
// actually in the library). Lowercase to match library muscle_group values.
export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function newDay(name = '', muscleGroups = []) {
  return { id: crypto.randomUUID(), name: name.trim(), muscleGroups: [...muscleGroups] };
}

// Find the split day whose name matches `typeName` (case-insensitive, trimmed).
// Returns the day or null. Used to connect the selected workout type → its groups.
export function findDayByName(split, typeName) {
  if (!typeName) return null;
  const want = String(typeName).trim().toLowerCase();
  return (split ?? []).find((d) => d.name.trim().toLowerCase() === want) ?? null;
}

// The muscle groups for a given workout type name, or [] if no matching day.
export function groupsForType(split, typeName) {
  return findDayByName(split, typeName)?.muscleGroups ?? [];
}

// Validate a day for saving: needs a non-empty name that's unique (case-insensitive)
// within the split (excluding itself by id). Returns an error string or null.
export function validateDay(split, day) {
  const name = day.name.trim();
  if (!name) return 'Name required';
  const clash = (split ?? []).some(
    (d) => d.id !== day.id && d.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (clash) return 'A day with that name already exists';
  return null;
}

// Upsert a day into the split (replace by id, else append). Returns a new array.
export function upsertDay(split, day) {
  const list = split ?? [];
  const idx = list.findIndex((d) => d.id === day.id);
  if (idx === -1) return [...list, day];
  const next = [...list];
  next[idx] = day;
  return next;
}

export function removeDay(split, id) {
  return (split ?? []).filter((d) => d.id !== id);
}
