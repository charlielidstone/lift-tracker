// WorkoutView — the top of the logging UI: today's workout as a list of exercises.
// Renders an ExerciseCard per exercise, tracks which card is expanded, and has "add exercise".
//
// Workout state shape (local/in-memory for now; Supabase later):
//   { id, date, exercises: [ { id, exerciseId, name, sets: [...] }, ... ] }
//
// TODO (Charlie):
//   - useState for the workout (or just the exercises array) + which exercise id is expanded
//   - map exercises → <ExerciseCard>, passing expanded/onToggle/onChange/onRemove
//   - "add exercise": for v1 you can start with a hardcoded name or a simple prompt; the real
//     ExercisePicker (from the seeded library) comes later. On add, create an exercise entry
//     with ONE set pre-filled from DEFAULT_SET (design philosophy: zero-tap logged set).
//   - keep ALL math out of here — est. 1RM etc. lives in src/lib and gets called where displayed
//
// This is the component App renders. Wire it into App.jsx when you're ready.

import { useState } from 'react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { DEFAULT_SET } from '@/lib/defaults';

export function WorkoutView() {
  // TODO: workout state + expanded tracking + render ExerciseCards + add exercise
  return null;
}
