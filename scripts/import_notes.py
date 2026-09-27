#!/usr/bin/env python3
"""One-off import of Charlie's Notes-app workouts (Sept 14-25, 2026) into Supabase.
Resets the exercise library to the 15 he actually does, then logs every set.
'f' sets -> RPE 10. Assisted dips stored as weight -55 (bodyweight minus 55)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))
# reuse the CLI's REST helper + credentials
import importlib.util
_here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("lift", os.path.join(_here, "lift.py"))
lift = importlib.util.module_from_spec(spec); spec.loader.exec_module(lift)
rest = lift.rest

# 15 canonical exercises (name -> muscle_group, all is_custom=True since user-specific)
LIBRARY = [
    ("Pec deck", "chest"),
    ("Incline dumbbell press", "chest"),
    ("Assisted wide grip dips", "chest"),
    ("Machine shoulder press", "shoulders"),
    ("Dumbbell shoulder press", "shoulders"),
    ("Dumbbell lateral raise", "shoulders"),
    ("Single arm cable lat raise", "shoulders"),
    ("Machine back fly", "shoulders"),
    ("Lat pulldown", "back"),
    ("Seated cable row", "back"),
    ("Single arm machine row", "back"),
    ("Cable bicep curl", "arms"),
    ("Incline bench bicep curl", "arms"),
    ("Overhead tricep extension", "arms"),
    ("Straight bar cable tricep pushdown", "arms"),
]

# Sets as (weight, reps, fail?). Canonical exercise names used throughout.
# fail=True -> rpe 10.
def S(*sets):  # helper: each arg is (w, r) or (w, r, 'f')
    out = []
    for s in sets:
        w, r = s[0], s[1]
        fail = len(s) > 2 and s[2] == "f"
        out.append((w, r, fail))
    return out

WORKOUTS = {
    "2026-09-14": {  # Push
        "Machine shoulder press": S((100,12),(110,8),(120,9,"f"),(130,6,"f")),
        "Dumbbell shoulder press": S((30,5,"f"),(30,6,"f"),(30,5,"f"),(20,8)),
        "Straight bar cable tricep pushdown": S((80,12),(95,8),(100,8),(105,8),(110,7,"f")),
        "Pec deck": S((90,8),(90,8),(105,8),(110,7,"f")),
    },
    "2026-09-15": {  # Pull
        "Lat pulldown": S((120,12),(135,8),(140,8),(150,8)),
        "Seated cable row": S((120,8),(135,8),(140,8,"f"),(140,8,"f")),
        "Single arm machine row": S((90,8),(105,8),(120,8),(135,8,"f")),
        "Machine back fly": S((120,8),(135,8,"f"),(135,6,"f"),(120,8)),
    },
    "2026-09-17": {  # Push
        "Incline dumbbell press": S((20,16),(30,10),(35,7,"f"),(35,8,"f")),
        "Dumbbell shoulder press": S((30,5,"f"),(30,4,"f"),(20,8),(20,8)),
        "Machine shoulder press": S((120,6,"f"),(110,8),(110,8,"f"),(110,5,"f")),
        "Overhead tricep extension": S((70,8),(75,8),(80,8),(80,10,"f")),
        "Dumbbell lateral raise": S((20,8),(20,10),(20,8),(20,10)),
        "Pec deck": S((90,8),(100,8),(105,12),(110,8,"f")),
    },
    "2026-09-18": {  # Pull
        "Lat pulldown": S((135,10),(150,8)),
        "Seated cable row": S((140,8),(140,8)),
        "Cable bicep curl": S((95,8),(100,8)),
        "Machine back fly": S((135,12,"f"),(135,12,"f")),
        "Incline bench bicep curl": S((25,6,"f"),(20,8)),
    },
    "2026-09-20": {  # Push
        "Incline dumbbell press": S((30,12),(35,11,"f"),(35,9,"f")),
        "Single arm cable lat raise": S((20,8),(20,8,"f")),
        "Overhead tricep extension": S((75,12),(80,12),(90,9,"f")),
        "Machine shoulder press": S((110,12),(110,10,"f"),(120,8,"f")),
        "Dumbbell shoulder press": S((20,11,"f"),(25,7,"f"),(25,6,"f")),
        "Assisted wide grip dips": S((-55,6,"f"),(-55,6,"f")),
        "Pec deck": S((105,8),(110,11,"f"),(115,8,"f")),
    },
    "2026-09-21": {  # Pull
        "Single arm machine row": S((135,12),(140,12),(145,12)),
        "Lat pulldown": S((150,8,"f"),(135,9),(135,8,"f")),
        "Seated cable row": S((140,8),(145,8),(145,7,"f")),
        "Cable bicep curl": S((95,12),(100,10,"f"),(105,8,"f")),
        "Machine back fly": S((135,12),(140,12,"f"),(145,8,"f")),
    },
    "2026-09-25": {  # Upper
        "Pec deck": S((110,12),(115,12)),
        "Machine back fly": S((145,12),(150,10,"f")),
        "Machine shoulder press": S((120,12),(120,11,"f")),
        "Seated cable row": S((145,12),(150,10,"f")),
        "Lat pulldown": S((145,12),(150,8,"f")),
        "Overhead tricep extension": S((80,12),(90,10,"f")),
        "Cable bicep curl": S((100,12),(105,12)),
        "Dumbbell lateral raise": S((20,10),(20,10)),
        "Single arm machine row": S((135,8),(120,10)),
    },
}

def main():
    # 1. Wipe existing workouts (cascades set_entries), then the library.
    old_workouts = rest("GET", "workouts", params={"select": "id"})
    for w in old_workouts:
        rest("DELETE", "workouts", params={"id": f"eq.{w['id']}"})
    print(f"cleared {len(old_workouts)} old workouts")
    existing = rest("GET", "exercises", params={"select": "id"})
    for e in existing:
        rest("DELETE", "exercises", params={"id": f"eq.{e['id']}"})
    print(f"cleared {len(existing)} old exercises")

    # 2. Insert canonical library, capture ids.
    ids = {}
    for name, mg in LIBRARY:
        row = rest("POST", "exercises",
                   body={"name": name, "muscle_group": mg, "is_custom": True},
                   prefer="return=representation")
        ids[name] = row[0]["id"]
    print(f"added {len(ids)} exercises")

    # 3. Import workouts.
    total_sets = 0
    for date in sorted(WORKOUTS):
        w = rest("POST", "workouts", body={"date": date}, prefer="return=representation")[0]
        for ex_name, sets in WORKOUTS[date].items():
            ex_id = ids[ex_name]
            for order, (weight, reps, fail) in enumerate(sets):
                rest("POST", "set_entries", body={
                    "workout_id": w["id"], "exercise_id": ex_id,
                    "weight": weight, "reps": reps,
                    "rpe": 10 if fail else None, "set_order": order,
                })
                total_sets += 1
        print(f"  {date}: {len(WORKOUTS[date])} exercises")
    print(f"\ndone: {len(WORKOUTS)} workouts, {total_sets} sets")

if __name__ == "__main__":
    main()
