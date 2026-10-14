// send-reminders — Supabase Edge Function (Deno). The SERVER half of real push.
//
// It reads devices from `push_subscriptions` with the service_role key (bypasses
// RLS), signs each message with the VAPID private key, and hands it to the OS
// push service via the `web-push` library. This is the only place the VAPID
// PRIVATE key is used — it lives in Edge Function secrets, never in the client.
//
// INVOCATION (two modes):
//   • Test:      POST { "userId": "<uuid>", "title"?, "body"?, "url"? }
//                → sends immediately to that user's devices. Use this to prove
//                  the whole pipe once your phone is subscribed.
//   • Scheduled: POST { }  (what the cron will send in step 6)
//                → selects who's DUE a reminder and sends. selectDueUsers() is a
//                  STUB until step 6 wires the schedule/workout logic.
//
// AUTH: the function requires the caller to present the service_role key as a
// Bearer token (the cron and your test both send it). We also keep Supabase's
// default JWT verification OFF for this function (see README) and gate on the
// service_role match ourselves so pg_cron/pg_net can call it with that key.
//
// SECRETS (set with `supabase secrets set ...`, never committed):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain)
// Auto-injected by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:charlie@charlielidstone.ca';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_PAYLOAD = {
  title: 'Lift Tracker',
  body: 'Time to train. 💪',
  url: '/',
};

// STEP 6 STUB: decide which user_ids are due a reminder right now (schedule says
// today is a training day AND they haven't logged a workout yet, etc.). Returns
// [] for now so the scheduled path is a safe no-op until step 6 fills it in.
async function selectDueUsers(): Promise<string[]> {
  return [];
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

  let input: { userId?: string; title?: string; body?: string; url?: string } = {};
  try {
    input = await req.json();
  } catch {
    input = {};
  }

  const payload = {
    title: input.title ?? DEFAULT_PAYLOAD.title,
    body: input.body ?? DEFAULT_PAYLOAD.body,
    url: input.url ?? DEFAULT_PAYLOAD.url,
  };

  try {
    // Test path: explicit userId → send now.
    if (input.userId) {
      const result = await sendToUser(input.userId, payload);
      return new Response(JSON.stringify({ mode: 'test', ...result }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Scheduled path: send to everyone who's due (step 6).
    const due = await selectDueUsers();
    const totals = { users: due.length, sent: 0, failed: 0, pruned: 0 };
    for (const userId of due) {
      const r = await sendToUser(userId, payload);
      totals.sent += r.sent;
      totals.failed += r.failed;
      totals.pruned += r.pruned;
    }
    return new Response(JSON.stringify({ mode: 'scheduled', ...totals }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
