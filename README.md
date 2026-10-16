# Lift Tracker

A fast, mobile-first weightlifting logger that works **offline**. Open it between sets,
tap to log weight × reps × RPE, and it syncs to the cloud when you're back online. Built as a
PWA you can install to your home screen like a native app.

Live: **[lift.charlielidstone.ca](https://lift.charlielidstone.ca)**

- **Stack:** Vite + React 19 + Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth) backend,
  deployed on AWS Amplify (auto-deploy on push to `main`).
- **Offline-first:** edits land in React state → localStorage → Supabase (or a durable outbox
  that flushes on reconnect). The whole app shell is precached, so it cold-starts with no network.
- **Installable:** `vite-plugin-pwa` with a hand-written service worker for offline + Web Push.

---

## Table of contents

1. [How it's built (architecture)](#how-its-built-architecture)
2. [Project layout](#project-layout)
3. [Reproduce it from scratch](#reproduce-it-from-scratch)
4. [Local development](#local-development)
5. [Database & migrations](#database--migrations)
6. [Authentication](#authentication)
7. [Push notifications (optional)](#push-notifications-optional)
8. [Deployment (AWS Amplify)](#deployment-aws-amplify)
9. [The `lift.py` CLI](#the-liftpy-cli)
10. [Backups & data safety](#backups--data-safety)
11. [Testing, linting & conventions](#testing-linting--conventions)

---

## How it's built (architecture)

### Local-first data flow
Every edit updates React state immediately, writes a localStorage **cache** (`lift-tracker:v1:`
keys), and then syncs to Supabase. When offline, changes queue in a durable **outbox** and flush
automatically on reconnect. The client mints UUIDs so local records and DB rows share the same
ids (making the sync diff trivial).

- `lib/localCache.js` — pure cache read/write. Keeps two snapshots: the *desired* state and a
  separate *last-server-confirmed* baseline.
- `lib/syncDiff.js` / `lib/planSyncDiff.js` — pure functions that compute the outbox ops
  (inserts/updates/deletes) from `desired` vs `baseline`.
- **Reconcile rule:** on load, adopt the **server** copy unless the cache differs from the
  *synced baseline* (i.e. there are genuine un-synced local edits). This prevents an out-of-band
  DB edit (e.g. the CLI) from being mistaken for a pending local edit.

### The app shell (navigation)
`App.jsx` is a `position:fixed inset-0 flex-col` shell where only `<main>` scrolls and
`BottomNav.jsx` is an in-flow bottom sibling (never `position:fixed`). This avoids iOS
rubber-band drag and the installed-PWA `100dvh` under-reporting bug. Tabs:

- **Library** — browse/search the exercise library, create custom exercises.
- **Plan** — a weekly weekday→type schedule *and* a per-type exercise template (sets × reps).
- **Workout** — the core logger: Today + History + Notes sub-tabs.
- **Progress** — charts and stats (est. 1RM, volume, weekly stats).
- **Settings** — units (lb/kg), app icon, notifications, data export, attribution.

### Key feature modules
- **Units:** weight is stored canonical **lb** everywhere; lb/kg is display-only
  (`lib/units.js`, converted at the edge in `SetRow`).
- **Smart defaults:** a new exercise opens at the weight from its most recent session
  (`lib/lastWeight.js`).
- **Recommendations:** one-tap exercise chips ranked by history (`lib/recommend.js`).
- **Plans:** `plans` + `plan_exercises` tables; a plan is an *unordered checklist* of
  sets × rep-range (+ optional RPE). Weight is not planned — it auto-fills from history.
- **Exercise images:** white line-art (CC BY-SA 4.0, Everkinetic / Bryl Lim) bundled as PNGs in
  `public/exercise-img/`, mapped name→slug in `lib/exerciseImages.js`, rendered by
  `ExerciseThumb.jsx`.
- **PWA / offline:** `vite-plugin-pwa` (`injectManifest`) + hand-written `src/sw.js` with
  `skipWaiting`/`clientsClaim`, precache, SPA nav fallback, Supabase `NetworkOnly`, and `push`
  handlers.

---

## Project layout

```
lift-tracker/
├── src/
│   ├── components/      # UI — one component per file, named exports
│   │   └── ui/          # shadcn/ui primitives (owned; import from @/components/ui/*)
│   ├── hooks/           # React state/context providers (useAuth, WorkoutProvider, …)
│   ├── lib/             # PURE logic (no React) + colocated *.test.js vitest files
│   ├── sw.js            # hand-written service worker (precache + push)
│   ├── App.jsx          # app shell + nav
│   └── main.jsx         # entry
├── supabase/
│   ├── schema.sql       # v1 baseline schema (run once)
│   ├── migrations/      # 002…010 — run manually in the SQL Editor, in order
│   └── functions/
│       └── send-reminders/   # Deno Edge Function for Web Push reminders
├── scripts/
│   └── lift.py          # CLI for workouts/sets/schedule/export over PostgREST
├── public/              # icons, exercise images, manifest assets
├── docs/                # DECISIONS.md, DEV_FLOW.md, STANDARDS.md, architecture.html
├── amplify.yml          # AWS Amplify build config
├── vite.config.js       # Vite + PWA config
├── .env.example         # copy to .env.local
└── package.json
```

---

## Reproduce it from scratch

### Prerequisites
- **Node.js ≥ 20** (developed on v26). npm comes with it.
- A free **Supabase** account (Postgres + Auth + Edge Functions).
- (Deploy) an **AWS Amplify** app, or any static host that can build a Vite project.
- (Optional, for the CLI/backups) **Python 3.11+**.

### 1. Clone & install
```bash
git clone https://github.com/charlielidstone/lift-tracker.git
cd lift-tracker
npm install
```

### 2. Create a Supabase project
In [supabase.com](https://supabase.com) → **New project**. Once it's provisioned, grab from
**Project Settings → API**:
- the **Project URL** (`https://<ref>.supabase.co`)
- the **anon public** key (safe for the browser — RLS protects the data)

### 3. Set up the database
Open the Supabase **SQL Editor** and run, in order:
1. `supabase/schema.sql` (creates `exercises`, `workouts`, `set_entries`, seeds the library).
2. Each migration `supabase/migrations/002_*.sql` … `010_*.sql`, one at a time.

See [Database & migrations](#database--migrations) for what each does. Migration 005 switches on
per-user auth, so run everything through at least 005 if you want logins.

### 4. Configure environment
```bash
cp .env.example .env.local
```
Fill in `.env.local`:
```ini
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
VITE_REQUIRE_AUTH=false          # true once auth (migration 005) is in place
VITE_VAPID_PUBLIC_KEY=           # only for push notifications (see below)
```
> Vite only exposes vars prefixed with `VITE_` to the client. `.env.local` is gitignored.

### 5. Run it
```bash
npm run dev          # http://localhost:5173
```

---

## Local development

```bash
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build → dist/
npm run preview      # serve the production build locally
npm run test         # run the vitest suite once
npm run test:watch   # vitest in watch mode
npm run lint         # oxlint
npm run format       # prettier --write .
```

Notes:
- **The dev service worker is disabled** (`vite.config.js` → `devOptions.enabled: false`).
  Anything needing a service worker — offline precache, `showNotification`, Web Push — must be
  tested on the **deployed build**, not `localhost`.
- After any `.env.local` change, **restart** the dev server (Vite reads env only at startup).
- `npm run dev` spawns a child process; to stop it reliably use `fuser -k 5173/tcp` rather than
  killing the npm PID.

---

## Database & migrations

The schema has three core tables plus per-user feature tables. Weight is stored in **pounds**
everywhere; est. 1RM is computed on read (`lib/oneRepMax.js`), never stored.

| File | What it does |
|------|--------------|
| `schema.sql` | v1 baseline: `exercises`, `workouts`, `set_entries` + seed library + Phase-1 permissive RLS. |
| `002_one_workout_per_day.sql` | Unique index: one workout per date. |
| `003_add_workout_type.sql` | `workouts.type` (Push/Pull/Legs/…). |
| `004_add_workout_finished.sql` | `workouts.finished_at` lock (read-only when finished). |
| `005_lock_rls_per_user.sql` | **Switches to per-user auth** — drops permissive policies, adds `auth.uid() = user_id` owner RLS. Open signup. |
| `006_add_notes.sql` | `user_notes` — one scratchpad row per user (Notes tab). |
| `007_add_plans.sql` | `plans` + `plan_exercises` — per-type session templates. |
| `008_add_schedule.sql` | `user_schedule` — 7-slot weekday→type grid (synced across devices). |
| `009_add_push_subscriptions.sql` | `push_subscriptions` — one row per device for Web Push. |
| `010_add_reminders_cron.sql` | `pg_cron` hourly ping to the reminders Edge Function (needs Vault — see file header). |

> There's no local DB connection in this repo — DDL is run **manually** in the Supabase SQL
> Editor. The REST/service-role path is data-only (PostgREST), not DDL.

---

## Authentication

Email + password, open signup, per-user row-level security (`auth.uid() = user_id`). Gated by
the `VITE_REQUIRE_AUTH` flag:

- `false` — single-user / dev mode, no login wall.
- `true` — `App.jsx` shows the `Login` screen until authenticated; `useAuth.jsx` provides the
  context.

Auth resolves offline via a race between `getSession()` and a 2s timeout, falling back to the
session Supabase persisted in localStorage — so the app opens offline with cached data.

> ⚠️ Don't run `VITE_REQUIRE_AUTH=false` against a real database you care about: with auth off,
> `userId` is null and RLS hides your real rows, so the app can insert empty duplicate workouts.
> Use auth-off only for layout previews.

---

## Push notifications (optional)

Real closed-app workout reminders. The full pipe: subscribe → store → Edge Function → VAPID
sign → OS push service → service-worker `push` handler. iOS Web Push works **only** in an
installed PWA over HTTPS, and the permission prompt must come from a user tap.

Setup:
1. **Generate a VAPID keypair** (P-256): `npx web-push generate-vapid-keys`.
2. Put the **public** key in `.env.local` as `VITE_VAPID_PUBLIC_KEY` **and** in your Amplify env
   vars (Vite bakes it in at build time).
3. Put the **private** key only into Supabase Edge Function secrets
   (`supabase secrets set VAPID_PRIVATE_KEY=…`) — never commit it.
4. Run migration `009` (subscriptions table) and `010` (hourly cron; also do the one-time
   `vault.create_secret('reminder_service_key', …)` described in the migration header).
5. Deploy the function:
   ```bash
   npx supabase login              # once, with your token
   npx supabase link --project-ref <ref>
   npx supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set REMINDER_HOUR=6    # local reminder hour (0–23)
   ```

The function reminds you when today's **scheduled** training type isn't "Rest" and you've logged
no sets yet. All date/hour math is done in `America/Vancouver` so it's DST-proof. See
`supabase/functions/send-reminders/README.md` for details.

---

## Deployment (AWS Amplify)

Connected to the GitHub repo; **every push to `main` auto-deploys**. Config is `amplify.yml`:
it runs `npm ci`, writes the console `VITE_*` env vars into `.env.production` (so Vite inlines
them at build time), then `npm run build`, publishing `dist/`.

To set up your own:
1. Amplify Console → **New app → Host web app** → connect the repo/branch (`main`).
2. Amplify auto-detects `amplify.yml`.
3. Add environment variables (**App settings → Environment variables**):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REQUIRE_AUTH`, and (if using push)
   `VITE_VAPID_PUBLIC_KEY`.
4. Deploy. Add your custom domain under **Domain management** if desired.

> The service worker needs HTTPS — it works on Amplify but not a plain-http IP. Verify a deploy
> landed by fetching the live hashed `/assets/index-*.js` bundle and grepping for your change
> (the hash changes per deploy). Installed iOS PWAs cache aggressively: a JS/CSS change is picked
> up by closing + reopening the app once or twice; an `index.html`/manifest change needs a full
> reinstall.

---

## The `lift.py` CLI

`scripts/lift.py` talks to Supabase over PostgREST (reads `VITE_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`). Useful for quick logging, inspection, and backups
without opening the app.

```bash
python3 scripts/lift.py exercises     # manage the exercise library
python3 scripts/lift.py today         # show a day's workout
python3 scripts/lift.py log           # log a set
python3 scripts/lift.py history       # recent workouts
python3 scripts/lift.py sets          # edit individual sets
python3 scripts/lift.py workout       # edit workouts
python3 scripts/lift.py schedule      # show/set the weekly schedule
python3 scripts/lift.py export        # back up all workouts to text + json
```
Add `--help` to any subcommand for its flags.

---

## Backups & data safety

This is an offline-sync app, so there are hard rules against data loss (learned the hard way):

- **Finishing a workout flushes sets to the server first** and refuses to lock on a sync failure
  — otherwise you'd get a finished-but-empty workout server-side while real sets sit unsynced.
- **Never clear site data / reinstall the PWA while a sync is pending.** The app shows a loud
  amber offline/syncing badge (`SyncStatusBadge.jsx`); wait for it to clear.
- **Plain-text backups:** `python3 scripts/lift.py export` dumps every workout to
  `backups/workouts-<date>.txt` + a `.json` sidecar (gitignored — personal data). The `.json` is
  the source of truth when reconstructing a lost session.

---

## Testing, linting & conventions

- **Tests:** Vitest. Pure logic in `src/lib/` has colocated `*.test.js` files. Never assert
  `toBe` on a float — use `toBeCloseTo`.
- **Lint:** oxlint (`no-undef: error` is on — it catches dropped imports that would white-screen
  on component expand). One pre-existing `button.jsx only-export-components` warning is expected.
- **Format:** Prettier (`.prettierrc.yaml`).
- **Conventions:** one component per file, named exports. UI logic in `components/`, pure logic
  in `lib/`, React state in `hooks/`. Import UI from `@/components/ui/<name>` (shadcn), never
  `radix-ui/*`. Conventional commits, one logical change each.
- **"Today" is always the local calendar date** (`localToday()` in `defaults.js`) — never
  `toISOString()`/UTC, which rolls over ~7h early in the Pacific evening.

See `docs/DECISIONS.md` (what we decided and why), `docs/STANDARDS.md` (coding standards), and
`docs/DEV_FLOW.md` (the build loop) for deeper context.
