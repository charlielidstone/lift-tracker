// send-reminders — Supabase Edge Function (Deno). The SERVER half of real push.
//
// It reads devices from `push_subscriptions` with the service_role key (bypasses
// RLS), signs each message with the VAPID private key, and hands it to the OS
// push service via the `web-push` library. This is the only place the VAPID
// PRIVATE key is used — it lives in Edge Function secrets, never in the client.
//
// INVOCATION (POST, body optional):
//   • Scheduled (what the cron sends): {}  → send to everyone DUE a reminder,
//     but ONLY at the configured local reminder hour (so the hourly cron is a
//     no-op the other 23 hours — this makes the fixed schedule DST-proof).
//   • Test:    { "userId": "<uuid>", "title"?, "body"?, "url"? } → send now to
//     that user's devices, ignoring due/hour logic.
//   • Debug:   { "force": true } bypasses the hour gate; { "dryRun": true }
//     returns who's due WITHOUT sending.
//
// AUTH: caller must present the service_role key as a Bearer token (deployed
// with --no-verify-jwt; we gate ourselves so pg_cron/pg_net can call it).
//
// SECRETS (supabase secrets set …): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, and optionally REMINDER_HOUR (0–23, default 17) / REMINDER_TZ
// (default America/Vancouver). Injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:charlie@charlielidstone.ca';
const REMINDER_HOUR = Number(Deno.env.get('REMINDER_HOUR') ?? '17'); // local hour 0–23
const REMINDER_TZ = Deno.env.get('REMINDER_TZ') ?? 'America/Vancouver';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const REST = 'Rest';
const DEFAULT_PAYLOAD = { title: 'Lift Tracker', body: 'Time to train. 💪', url: '/' };

// The current date/weekday/hour in the reminder timezone (server runs UTC, so we
// compute local parts explicitly rather than trusting the runtime clock's zone).
// weekday: 0=Sun … 6=Sat to match the schedule array (JS getDay() indexing).
function localNow(): { dateStr: string; weekday: number; hour: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[get('weekday')] ?? 0;
  // "24" at midnight in some runtimes → normalize to 0.
  const hour = Number(get('hour')) % 24;
  return { dateStr, weekday, hour };
}

// Who is due a reminder right now: for each user with a subscription, today's
// SCHEDULED type is a training type (not Rest) AND they have not logged any set
// today. (Deliberately the raw schedule, not catch-up — a reminder should be
// predictable and never fire on a Rest day.)
async function selectDueUsers(
  dateStr: string,
  weekday: number,
): Promise<Array<{ userId: string; type: string }>> {
  const { data: subs, error } = await admin.from('push_subscriptions').select('user_id');
  if (error) throw error;
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];

  const due: Array<{ userId: string; type: string }> = [];
  for (const userId of userIds) {
    const { data: sch } = await admin
      .from('user_schedule')
      .select('schedule')
      .eq('user_id', userId)
      .maybeSingle();
    const schedule = Array.isArray(sch?.schedule) ? (sch!.schedule as string[]) : [];
    const type = schedule[weekday] || REST;
    if (!type || type === REST) continue; // rest day → no reminder

    // Logged a set today? A workout row with ≥1 set_entries for today's date.
    const { data: workouts } = await admin
      .from('workouts')
      .select('id, set_entries(id)')
      .eq('user_id', userId)
      .eq('date', dateStr);
    const trained = (workouts ?? []).some(
      (w) => ((w.set_entries as unknown[] | null)?.length ?? 0) > 0,
    );
    if (!trained) due.push({ userId, type });
  }
  return due;
}

// Send one payload to every device a user has subscribed. Prunes subscriptions
// the push service reports as gone (404/410) so dead rows don't accumulate.
async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url: string },
): Promise<{ sent: number; failed: number; pruned: number }> {
  const { data: rows, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let pruned = 0;
  const body = JSON.stringify(payload);

  for (const row of rows ?? []) {
    try {
      await webpush.sendNotification(row.subscription, body);
      sent += 1;
      await admin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', row.endpoint);
    } catch (err) {
      failed += 1;
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = the device's subscription is gone for good → delete the row.
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        pruned += 1;
      }
    }
  }
  return { sent, failed, pruned };
}

Deno.serve(async (req) => {
  // Gate: require the service_role key as the Bearer token.
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let input: {
    userId?: string;
    title?: string;
    body?: string;
    url?: string;
    force?: boolean;
    dryRun?: boolean;
  } = {};
  try {
    input = await req.json();
  } catch {
    input = {};
  }

  try {
    // Test path: explicit userId → send now, ignore due/hour logic.
    if (input.userId) {
      const payload = {
        title: input.title ?? DEFAULT_PAYLOAD.title,
        body: input.body ?? DEFAULT_PAYLOAD.body,
        url: input.url ?? DEFAULT_PAYLOAD.url,
      };
      const result = await sendToUser(input.userId, payload);
      return new Response(JSON.stringify({ mode: 'test', ...result }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Scheduled path.
    const { dateStr, weekday, hour } = localNow();

    // Hour gate: the cron fires hourly; only the configured local hour sends.
    if (!input.force && hour !== REMINDER_HOUR) {
      return new Response(
        JSON.stringify({
          mode: 'scheduled',
          skipped: 'off-hour',
          hour,
          reminderHour: REMINDER_HOUR,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    const due = await selectDueUsers(dateStr, weekday);

    if (input.dryRun) {
      return new Response(JSON.stringify({ mode: 'scheduled', dryRun: true, dateStr, due }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const totals = { users: due.length, sent: 0, failed: 0, pruned: 0 };
    for (const { userId, type } of due) {
      const payload = {
        title: 'Lift Tracker',
        body: `${type} day — you haven't logged a workout yet. 💪`,
        url: '/',
      };
      const r = await sendToUser(userId, payload);
      totals.sent += r.sent;
      totals.failed += r.failed;
      totals.pruned += r.pruned;
    }
    return new Response(JSON.stringify({ mode: 'scheduled', dateStr, ...totals }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
