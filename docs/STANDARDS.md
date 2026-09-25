# Coding Standards

Living document. Charlie edits this freely as our system evolves — it's the source of truth
for how we build, not a fixed decree. When a rule changes, change it here.

## Git

- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **One logical change per commit.** Small, bisectable, readable.
- **Branching:** straight to `main` while it's just us. Feature branches (`feat/x`) once
  there are real users/stakes.

## Tooling (enforced by tools, not willpower)

- **oxlint** — linting (shipped with the Vite scaffold; fast Rust linter). `npm run lint`.
- **Prettier** — formatting. `npm run format`. No manual style debates.
- **Vitest** — tests for logic that's painful if wrong. `npm run test`.

## Code structure

- `src/components/` — UI, one component per file, named exports.
- `src/lib/` — business logic, formulas (e.g. 1RM), Supabase client. **No React here** →
  keeps logic pure + testable.
- `src/hooks/` — reusable React hooks.
- Keep business logic OUT of components.
- **Import UI from `@/components/ui/<name>`, never from `radix-ui/*` directly.** The shadcn
  wrappers we own render correctly standalone; raw Radix primitives (e.g. `radix-ui/toolbar`
  Button) require specific parent wrappers and crash the whole app if rendered alone. The
  `<name>` must match a real file — run `ls src/components/ui/` if unsure (button/card/input…).

## Testing

- Test the risky logic (1RM calc, PR detection, unit conversion), not everything.
- Write the test alongside the function, not "later."
- Not chasing coverage %; chasing confidence on the stuff that matters.

## Units (project-specific)

- **Store one canonical unit: pounds (lb).** kg/lb is a DISPLAY toggle only, converts on
  render. Never store the display unit → switching units can't corrupt history or PR math.

## Quality gate

- Bigger changes: run the `requesting-code-review` skill before commit (security + quality).
- Small slices: lint + format + tests passing is enough.

## Decision trail

- Every non-obvious choice gets a line in `DECISIONS.md` with its _why_.
