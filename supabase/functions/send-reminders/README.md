# send-reminders — deploy & test

Supabase Edge Function that sends Web Push notifications. The **server half** of
real notifications: reads `push_subscriptions` with the service_role key, signs
each message with the VAPID **private** key, and delivers it via `web-push`.

> No `supabase` CLI on the dev machine — deploy with `npx supabase ...` once
> logged in, or paste the function in the Dashboard (Edge Functions → new).

## 1. Set secrets (once)

The VAPID private key lives ONLY here — never in git or the client. Values are in
`.vapid-keys.local.txt` (gitignored).

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY='BEyZtrvAB-lg1eSaFEtl92xZfodYt7G3w6BTn89jBH_i54ComNHkNOL9waf1Bsf5qDcx35CXb9q0kIjrT-V2lMo' \
  VAPID_PRIVATE_KEY='<private key from .vapid-keys.local.txt>' \
  VAPID_SUBJECT='mailto:charlie@charlielidstone.ca'
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 2. Deploy

```bash
# --no-verify-jwt: the function gates on the service_role Bearer itself, so
# pg_cron / pg_net (step 6) and the test call below can invoke it directly.
npx supabase functions deploy send-reminders --no-verify-jwt
```

## 3. Test the whole pipe

1. Open the app on your installed iPhone PWA, Settings → **Turn on reminders**
   (this writes a row to `push_subscriptions`).
2. Find your user id (`select id from auth.users;` or the CLI), then:

```bash
curl -X POST 'https://mnrljxvyhlcydpkuaikb.functions.supabase.co/send-reminders' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'content-type: application/json' \
  -d '{"userId":"<your-uuid>","title":"Lift Tracker","body":"Pipe works 💪"}'
```

Expect `{"mode":"test","sent":1,"failed":0,"pruned":0}` and a notification on the
phone — even with the app fully closed.

## Modes

- `{ "userId": "…" }` → send now to that user's devices (test).
- `{}` → scheduled path (what the cron sends): send to everyone **due** —
  today's scheduled type is a training type (not Rest) AND no set logged today —
  but ONLY when the local hour equals `REMINDER_HOUR`. Dates/weekday/hour are
  computed in `REMINDER_TZ` (America/Vancouver), so the fixed time is DST-proof.
- `{ "force": true }` → bypass the hour gate (test the scheduled path any time).
- `{ "dryRun": true }` → return who's due WITHOUT sending.

Dead subscriptions (push service returns 404/410) are deleted automatically.

## Cron (migration 010)

`supabase/migrations/010_add_reminders_cron.sql` schedules an **hourly** ping via
`pg_cron` + `pg_net`; the function's hour gate makes 23 of those a no-op. The
service_role key is read from **Vault** at run time (never committed). Run the
migration in the SQL Editor, and run the one-time `vault.create_secret(...)` with
your real key (see the migration's step 2 — do NOT commit the key).

Change the reminder time (local 24h hour, default 17 = 5pm):

```bash
npx supabase secrets set REMINDER_HOUR=8
```

Inspect cron runs: `select * from cron.job_run_details order by start_time desc;`
