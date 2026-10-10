#!/usr/bin/env python3
"""lift — a tiny CLI for the Lift Tracker Supabase backend.

Lets Hermes (or you) edit the exercise library, log/edit workouts, and recall
history directly against the database the app uses — no UI puppeteering.

Credentials come from .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY);
nothing is hardcoded. Stdlib only (urllib) — no pip installs.

Usage examples:
  lift exercises                       # list the library
  lift exercises add "Face Pull" --muscle shoulders --custom
  lift exercises rename "Bicep Curl" "Dumbbell Curl"
  lift exercises rm "Face Pull"
  lift today                           # today's workout with sets
  lift log "Bench Press" 135 8 --rpe 8 # add a set (creates today's workout if needed)
  lift log "Squat" 225 5 --date 2026-09-25
  lift history --limit 5               # recent workouts
  lift sets rm <set_id>                # delete one set
  lift workout rm --date 2026-09-25    # delete a whole workout (its sets cascade)

Add --json to most commands for machine-readable output.

NOTE ON "TODAY": matches the app, which uses the LOCAL calendar date
(localToday in src/lib/defaults.js). Pass --date explicitly to be unambiguous.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import NoReturn

# ── Credentials ──────────────────────────────────────────────
def load_env():
    """Read Supabase URL + an API key from .env.local (repo root).

    Prefers SUPABASE_SERVICE_ROLE_KEY (full access, bypasses RLS — this is an admin
    CLI, so that's intended) and falls back to VITE_SUPABASE_ANON_KEY. NOTE: once
    RLS is locked to auth.uid(), the anon key (no login session) can no longer
    read/write — the service_role key is required for the CLI to keep working.
    """
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root, ".env.local")
    url = os.environ.get("VITE_SUPABASE_URL")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    anon = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "VITE_SUPABASE_URL" and not url:
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY" and not service:
                    service = v
                elif k == "VITE_SUPABASE_ANON_KEY" and not anon:
                    anon = v
    key = service or anon
    if not url or not key:
        die("Missing Supabase credentials — set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env.local")
    return url.rstrip("/"), key


def die(msg, code=1) -> NoReturn:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


# ── REST helper ──────────────────────────────────────────────
def rest(method, table, *, params=None, body=None, prefer=None):
    url, key = load_env()
    q = "?" + urllib.parse.urlencode(params) if params else ""
    endpoint = f"{url}/rest/v1/{table}{q}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(endpoint, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        die(f"{method} {table} -> HTTP {e.code}: {body_txt}")
    except urllib.error.URLError as e:
        die(f"network error: {e.reason}")


def today_local():
    # Local date (matches the app's localToday). NOT UTC — evening Pacific
    # workouts must not roll to tomorrow.
    return datetime.now().astimezone().strftime("%Y-%m-%d")


# ── Exercise resolution ──────────────────────────────────────
def resolve_exercise(ref):
    """Resolve an exercise by id (uuid) or name. Tries exact (case-insensitive)
    first, then falls back to substring match so 'curl' finds 'Bicep Curl'."""
    if len(ref) == 36 and ref.count("-") == 4:
        rows = rest("GET", "exercises", params={"id": f"eq.{ref}", "select": "*"})
        if not rows:
            die(f"no exercise matching '{ref}'")
        return rows[0]
    # exact (case-insensitive) first
    rows = rest("GET", "exercises", params={"name": f"ilike.{ref}", "select": "*"})
    if not rows:
        # substring fallback
        rows = rest("GET", "exercises", params={"name": f"ilike.*{ref}*", "select": "*"})
    if not rows:
        die(f"no exercise matching '{ref}'")
    if len(rows) > 1:
        names = ", ".join(r["name"] for r in rows)
        die(f"'{ref}' is ambiguous: {names} — be more specific")
    return rows[0]


def get_or_create_workout(date):
    rows = rest("GET", "workouts", params={
        "date": f"eq.{date}", "select": "*",
        "order": "created_at.desc", "limit": "1",
    })
    if rows:
        return rows[0]
    created = rest("POST", "workouts", body={"date": date},
                   prefer="return=representation")
    return created[0]


# ── Commands ─────────────────────────────────────────────────
def cmd_exercises(args):
    if args.action in (None, "list"):
        rows = rest("GET", "exercises", params={
            "select": "id,name,muscle_group,is_custom", "order": "muscle_group,name",
        })
        if args.json:
            print(json.dumps(rows, indent=2)); return
        for r in rows:
            tag = " (custom)" if r["is_custom"] else ""
            print(f"  {r['name']:<22} {r['muscle_group'] or '-':<10}{tag}")
        print(f"\n{len(rows)} exercises")
    elif args.action == "add":
        row = rest("POST", "exercises", body={
            "name": args.name, "muscle_group": args.muscle, "is_custom": args.custom,
        }, prefer="return=representation")
        print(f"added: {row[0]['name']} ({row[0]['id']})")
    elif args.action == "rename":
        ex = resolve_exercise(args.ref)
        rest("PATCH", "exercises", params={"id": f"eq.{ex['id']}"},
             body={"name": args.name})
        print(f"renamed: {ex['name']} -> {args.name}")
    elif args.action == "rm":
        ex = resolve_exercise(args.ref)
        rest("DELETE", "exercises", params={"id": f"eq.{ex['id']}"})
        print(f"removed: {ex['name']}")


def _print_workout(w, sets):
    print(f"\n{w['date']}  {w.get('name') or 'Workout'}  ({w['id']})")
    if not sets:
        print("  (no sets)"); return
    by_ex = {}
    for s in sets:
        by_ex.setdefault(s["exercises"]["name"], []).append(s)
    for name, ss in by_ex.items():
        print(f"  {name}")
        for s in sorted(ss, key=lambda x: x["set_order"]):
            rpe = f" @ RPE {s['rpe']}" if s["rpe"] is not None else ""
            print(f"    set {s['set_order']+1}: {s['weight']} lb x {s['reps']}{rpe}  [{s['id']}]")


def cmd_today(args):
    date = args.date or today_local()
    rows = rest("GET", "workouts", params={
        "date": f"eq.{date}", "select": "*", "order": "created_at.desc", "limit": "1",
    })
    if not rows:
        print(f"no workout for {date}"); return
    w = rows[0]
    sets = rest("GET", "set_entries", params={
        "workout_id": f"eq.{w['id']}",
        "select": "id,weight,reps,rpe,set_order,exercises(name)",
        "order": "set_order",
    })
    if args.json:
        print(json.dumps({"workout": w, "sets": sets}, indent=2)); return
    _print_workout(w, sets)


def cmd_log(args):
    date = args.date or today_local()
    ex = resolve_exercise(args.exercise)
    w = get_or_create_workout(date)
    # next set_order for this exercise within this workout
    existing = rest("GET", "set_entries", params={
        "workout_id": f"eq.{w['id']}", "exercise_id": f"eq.{ex['id']}",
        "select": "set_order", "order": "set_order.desc", "limit": "1",
    })
    next_order = (existing[0]["set_order"] + 1) if existing else 0
    row = rest("POST", "set_entries", body={
        "workout_id": w["id"], "exercise_id": ex["id"],
        "weight": args.weight, "reps": args.reps, "rpe": args.rpe,
        "set_order": next_order,
    }, prefer="return=representation")
    rpe = f" @ RPE {args.rpe}" if args.rpe is not None else ""
    print(f"logged: {ex['name']} {args.weight} lb x {args.reps}{rpe}  ({date})")


def cmd_history(args):
    workouts = rest("GET", "workouts", params={
        "select": "*", "order": "date.desc", "limit": str(args.limit),
    })
    if args.json:
        out = []
        for w in workouts:
            sets = rest("GET", "set_entries", params={
                "workout_id": f"eq.{w['id']}",
                "select": "id,weight,reps,rpe,set_order,exercises(name)", "order": "set_order",
            })
            out.append({"workout": w, "sets": sets})
        print(json.dumps(out, indent=2)); return
    if not workouts:
        print("no workouts yet"); return
    for w in workouts:
        sets = rest("GET", "set_entries", params={
            "workout_id": f"eq.{w['id']}",
            "select": "id,weight,reps,rpe,set_order,exercises(name)", "order": "set_order",
        })
        _print_workout(w, sets)


def cmd_sets(args):
    if args.action == "rm":
        rest("DELETE", "set_entries", params={"id": f"eq.{args.set_id}"})
        print(f"deleted set {args.set_id}")


def cmd_workout(args):
    if args.action == "rm":
        date = args.date or today_local()
        rest("DELETE", "workouts", params={"date": f"eq.{date}"})
        print(f"deleted workout(s) for {date}")


# ── Weekly schedule (user_schedule, migration 008) ───────────
# A schedule is a single 7-slot array per user, index = JS getDay() (0=Sun..6=Sat).
REST_TYPE = "Rest"
WORKOUT_TYPES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Arms"]
_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
# Accepts sun/sunday/0 … sat/saturday/6 (case-insensitive).
_DAY_ALIASES = {}
for _i, _full in enumerate(_DAY_NAMES):
    _DAY_ALIASES[_full.lower()] = _i
    _DAY_ALIASES[_full[:3].lower()] = _i
    _DAY_ALIASES[str(_i)] = _i


def _parse_day(ref):
    key = ref.strip().lower()
    if key not in _DAY_ALIASES:
        die(f"unknown day '{ref}' — use Mon/Tue/.../Sun or 0-6 (0=Sun)")
    return _DAY_ALIASES[key]


def _canon_type(ref):
    """Canonicalize a type string to a known WORKOUT_TYPES value or 'Rest'."""
    key = ref.strip().lower()
    if key in ("rest", "off"):
        return REST_TYPE
    for t in WORKOUT_TYPES:
        if t.lower() == key:
            return t
    die(f"unknown type '{ref}' — one of: {', '.join(WORKOUT_TYPES)}, Rest")


def account_user_id(override=None):
    """The user_id to own a schedule row. Explicit --user wins; otherwise infer
    from the most recent workout (single-user setup)."""
    if override:
        return override
    rows = rest("GET", "workouts", params={
        "select": "user_id", "order": "created_at.desc", "limit": "1",
    })
    uid = rows[0].get("user_id") if rows else None
    if not uid:
        die("could not determine user_id — pass --user <uuid>")
    return uid


def _fetch_schedule(uid):
    rows = rest("GET", "user_schedule", params={
        "user_id": f"eq.{uid}", "select": "schedule",
    })
    sched = rows[0]["schedule"] if rows else None
    if not isinstance(sched, list):
        sched = []
    # Normalize to 7 slots.
    return [(sched[i] if i < len(sched) and sched[i] else REST_TYPE) for i in range(7)]


def _print_schedule(sched):
    # Monday-first display, like the app.
    for dow in [1, 2, 3, 4, 5, 6, 0]:
        print(f"  {_DAY_NAMES[dow]:<10} {sched[dow]}")


def cmd_schedule(args):
    uid = account_user_id(getattr(args, "user", None))
    if args.action in (None, "show"):
        sched = _fetch_schedule(uid)
        if args.json:
            print(json.dumps(sched)); return
        _print_schedule(sched)
    elif args.action == "set":
        dow = _parse_day(args.day)
        wtype = _canon_type(args.type)
        sched = _fetch_schedule(uid)
        sched[dow] = wtype
        from datetime import timezone
        rest("POST", "user_schedule", body={
            "user_id": uid,
            "schedule": sched,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, prefer="resolution=merge-duplicates,return=minimal")
        print(f"set {_DAY_NAMES[dow]} → {wtype}")
        print("(reload the app to see it — it doesn't live-sync)")


def cmd_export(args):
    """Dump ALL workouts to a human-readable .txt (and a .json sidecar for exact
    restore). This is the plain-text backup — run it on a schedule so a lost
    offline session or a cleared cache can always be reconstructed."""
    import os
    workouts = rest("GET", "workouts", params={"select": "*", "order": "date.asc"})
    full = []
    total_sets = 0
    for w in workouts:
        sets = rest("GET", "set_entries", params={
            "workout_id": f"eq.{w['id']}",
            "select": "id,weight,reps,rpe,set_order,created_at,exercises(name)",
            "order": "set_order",
        })
        total_sets += len(sets)
        full.append({"workout": w, "sets": sets})

    # Human-readable text
    lines = []
    lines.append("LIFT TRACKER — WORKOUT BACKUP")
    lines.append(f"generated: {datetime.now().astimezone().isoformat(timespec='seconds')}")
    lines.append(f"workouts: {len(workouts)}   sets: {total_sets}")
    lines.append("=" * 48)
    for entry in full:
        w = entry["workout"]; sets = entry["sets"]
        wtype = w.get("type") or "—"
        locked = " [finished]" if w.get("finished_at") else ""
        lines.append("")
        lines.append(f"{w['date']}  ({wtype}){locked}")
        if not sets:
            lines.append("  (no sets)")
        # group by exercise, preserving order
        by_ex = []
        seen = {}
        for s in sets:
            name = (s.get("exercises") or {}).get("name") or "?"
            if name not in seen:
                seen[name] = []; by_ex.append(name)
            seen[name].append(s)
        for name in by_ex:
            lines.append(f"  {name}")
            for s in seen[name]:
                rpe = f" @ RPE {s['rpe']}" if s.get("rpe") is not None else ""
                lines.append(f"    - {s['weight']} lb × {s['reps']}{rpe}")
    text = "\n".join(lines) + "\n"

    out_dir = args.dir or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now().astimezone().strftime("%Y-%m-%d")
    txt_path = os.path.join(out_dir, f"workouts-{stamp}.txt")
    json_path = os.path.join(out_dir, f"workouts-{stamp}.json")
    latest_txt = os.path.join(out_dir, "workouts-latest.txt")
    with open(txt_path, "w") as f: f.write(text)
    with open(latest_txt, "w") as f: f.write(text)
    with open(json_path, "w") as f: json.dump(full, f, indent=2)
    print(f"backed up {len(workouts)} workouts / {total_sets} sets")
    print(f"  text: {txt_path}")
    print(f"  text: {latest_txt}")
    print(f"  json: {json_path}")


# ── Arg parsing ──────────────────────────────────────────────
def build_parser():
    p = argparse.ArgumentParser(prog="lift", description="Lift Tracker CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    # exercises
    ex = sub.add_parser("exercises", help="manage the exercise library")
    exsub = ex.add_subparsers(dest="action")
    exsub.add_parser("list", help="list exercises").add_argument("--json", action="store_true")
    a = exsub.add_parser("add", help="add an exercise")
    a.add_argument("name"); a.add_argument("--muscle", default=None)
    a.add_argument("--custom", action="store_true")
    r = exsub.add_parser("rename", help="rename an exercise")
    r.add_argument("ref"); r.add_argument("name")
    d = exsub.add_parser("rm", help="remove an exercise"); d.add_argument("ref")
    ex.add_argument("--json", action="store_true")
    ex.set_defaults(func=cmd_exercises)

    # today
    t = sub.add_parser("today", help="show a day's workout")
    t.add_argument("--date", default=None); t.add_argument("--json", action="store_true")
    t.set_defaults(func=cmd_today)

    # log
    lg = sub.add_parser("log", help="log a set")
    lg.add_argument("exercise"); lg.add_argument("weight", type=float)
    lg.add_argument("reps", type=int); lg.add_argument("--rpe", type=float, default=None)
    lg.add_argument("--date", default=None)
    lg.set_defaults(func=cmd_log)

    # history
    h = sub.add_parser("history", help="recent workouts")
    h.add_argument("--limit", type=int, default=10); h.add_argument("--json", action="store_true")
    h.set_defaults(func=cmd_history)

    # sets
    s = sub.add_parser("sets", help="edit individual sets")
    ssub = s.add_subparsers(dest="action", required=True)
    sr = ssub.add_parser("rm", help="delete a set"); sr.add_argument("set_id")
    s.set_defaults(func=cmd_sets)

    # workout
    w = sub.add_parser("workout", help="edit workouts")
    wsub = w.add_subparsers(dest="action", required=True)
    wr = wsub.add_parser("rm", help="delete a workout"); wr.add_argument("--date", default=None)
    w.set_defaults(func=cmd_workout)

    # schedule (weekly weekday→type plan, synced per-user)
    sc = sub.add_parser("schedule", help="show or set the weekly training schedule")
    scsub = sc.add_subparsers(dest="action")
    scshow = scsub.add_parser("show", help="show the weekly schedule")
    scshow.add_argument("--json", action="store_true")
    scshow.add_argument("--user", default=None, help="user_id override (uuid)")
    scset = scsub.add_parser("set", help="set a weekday's type")
    scset.add_argument("day", help="Mon/Tue/.../Sun or 0-6 (0=Sun)")
    scset.add_argument("type", help="Push/Pull/Legs/Upper/Lower/Full body/Arms/Rest")
    scset.add_argument("--user", default=None, help="user_id override (uuid)")
    sc.add_argument("--json", action="store_true")
    sc.add_argument("--user", default=None, help="user_id override (uuid)")
    sc.set_defaults(func=cmd_schedule)

    # export (plain-text + json backup of ALL workouts)
    ex2 = sub.add_parser("export", help="back up all workouts to plain text + json")
    ex2.add_argument("--dir", default=None, help="output dir (default: <repo>/backups)")
    ex2.set_defaults(func=cmd_export)

    return p


def main():
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
