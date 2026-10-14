-- Migration 010: hourly cron that pings the send-reminders Edge Function.
-- The function itself only sends at the configured local reminder hour, so an
-- hourly ping is correct AND DST-proof (no fixed-UTC drift). Run in the Supabase
-- SQL Editor. Requires pg_cron, pg_net, and Supabase Vault (all available).
--
-- SECURITY: this is a PUBLIC repo — the service_role key must NOT be committed.
-- The key is stored in Vault (step 2, run MANUALLY with the real key, not saved
-- here) and read at run time by the job, so the committed SQL holds no secret.

-- 1. Extensions (no-op if already enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store the service_role key in Vault. RUN THIS ONCE in the SQL Editor with
--    your REAL key (Dashboard → Project Settings → API → service_role). Do NOT
--    paste the key into this file or commit it. If re-running, delete the old
--    secret first (select vault.delete_secret('reminder_service_key');).
--
--    select vault.create_secret(
--      '<YOUR_SERVICE_ROLE_KEY>',
--      'reminder_service_key',
--      'service_role key for the send-reminders cron'
--    );

-- 3. Schedule the hourly ping. The key is read from Vault at run time, never
--    stored in the job definition. Re-running updates the existing job.
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://mnrljxvyhlcydpkuaikb.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'reminder_service_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Housekeeping:
--   • Change the time → set the function secret, NOT this cron:
--       supabase secrets set REMINDER_HOUR=8   (0–23, local America/Vancouver)
--   • Inspect runs → select * from cron.job_run_details order by start_time desc;
--   • Stop it     → select cron.unschedule('send-reminders-hourly');
