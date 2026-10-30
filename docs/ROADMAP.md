# Lift Tracker — Roadmap

Open and planned work. For _why_ decisions were made, see `DECISIONS.md`; this file is
_what's next_. Move items to a "Shipped" note (or delete) once done. Nothing here is committed
to a date — it's an unordered backlog Charlie prioritises.

## Deferred features

- **Rep-max board** — a PR / estimated-1RM screen (best est. 1RM per exercise, Epley, computed
  on read). The metric already exists on charts; this is a dedicated board. (DECISIONS.md #4.)
- **Advanced set input** — tap-a-number-to-type entry for big weight jumps, alongside the
  existing +/− stepper. Progressive disclosure: steppers stay the default.
- **Plan variants** — Push A / Push B per session type. Schema already supports it (just extra
  `plans` rows, `plans.name` defaults to 'Default'); UI to create/pick a variant isn't built.

## Documented upgrade paths (designed, not built)

- **Per-slot editable substitutions** — move from today's curated hardcoded equivalence groups
  (`substitutions.js`) to a `plan_exercise_substitutes` join table (owner-only RLS) editable
  in-app, with the curated groups kept as the seed. `substitutesFor()` is the only resolution
  point that changes, so this is additive. (See the header in `src/lib/substitutions.js`.)
- **Full exercise-library import** — bulk-import the whole 302-exercise Bryllim pack (vs the
  current ~140 gym subset) via `scripts/expand_library.py` + its `manifest.json`. Gated on the
  ~12 MB PWA precache cost (all images are precached); needs Charlie's sign-off on scope, or a
  switch to lazy-loaded images. (See lift-tracker-app skill, "Library expansion".)

## Ideas / unscoped

_(none yet — add candidate features here before they're committed to above)_
