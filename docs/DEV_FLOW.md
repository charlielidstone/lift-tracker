# Dev Flow — agentic build cycle

Our repeatable loop for building projects with Hermes leading-with-the-human, not for-the-human.
Charlie leads; Hermes advises, unblocks, and executes on direction. Reusable across projects.

## The cycle

1. **Decide before code.** Nail scope + data model + key tradeoffs _in plain language_ first.
   Record decisions with their _why_ (see DECISIONS.md). Locks intent before typing.
2. **Diagram before building.** Draw the whole app's structure (layers, components, data
   flow) BEFORE writing feature code — use the `architecture-diagram` skill, save to
   `docs/architecture.html`. Surfaces the shape + naming while it's still cheap to change,
   and becomes the shared map for humans and delegated agents. Update it as structure evolves.
   Do this for every project.
3. **Small, named commits.** One logical change per commit, conventional-commit style
   (`chore:`, `feat:`, `fix:`, `docs:`). Repo stays bisectable + readable.
   Push after each commit (or at least end of session) so `origin` stays current + backed up.
4. **Build in vertical slices.** Ship one working thing end-to-end (e.g. log a set → see it)
   before breadth. Prefer local/in-memory state first, wire the backend in after the shape is right.
5. **Human leads the wheel.** Hermes proposes options + tradeoffs, waits for the call on
   anything that shapes the product. Hermes doesn't silently build big pieces unasked.
6. **Explain the unfamiliar.** When a concept is new (e.g. est. 1RM, RLS), explain it inline
   so the human owns the decision, not just approves it.
7. **Delegate later.** Once the cycle is smooth, Hermes fans work out to sub-agents for
   parallel/independent tasks — reserved for when the flow is proven. (Not yet active.)

## Guardrails

- Don't fabricate results — run it, show real output.
- Verify servers/ports are actually up/down (curl check), don't assume.
- Capture reusable lessons back into this doc as the flow evolves.
