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

NOTE ON "TODAY": matches the app, which uses the UTC calendar date
(new Date().toISOString().slice(0,10)). Late-evening Pacific workouts may land on
the next UTC day; pass --date explicitly to be unambiguous.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import NoReturn

# ── Credentials ──────────────────────────────────────────────
def load_env():
    """Read VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local (repo root)."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root, ".env.local")
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                v = v.strip().strip('"').strip("'")
                if k.strip() == "VITE_SUPABASE_URL" and not url:
                    url = v
                elif k.strip() == "VITE_SUPABASE_ANON_KEY" and not key:
                    key = v
    if not url or not key:
        die("Missing Supabase credentials — set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local")
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


def today_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


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
    date = args.date or today_utc()
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
    date = args.date or today_utc()
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
        date = args.date or today_utc()
        rest("DELETE", "workouts", params={"date": f"eq.{date}"})
        print(f"deleted workout(s) for {date}")


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

    return p


def main():
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
