-- Migration 009: Web Push subscriptions (real server-sent notifications).
-- One row per DEVICE (each installed PWA mints its own PushSubscription). The
-- `endpoint` is the device's unique mailbox at the push service, so it's the
-- natural unique key — re-subscribing the same device upserts rather than dupes.
-- Owner-only RLS (matches 005/006). The Edge Function reads these with the
-- service_role key (bypasses RLS) to find who to notify. Run in the SQL Editor.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  -- the full PushSubscription JSON (endpoint + keys.p256dh + keys.auth) that
  -- web-push needs to encrypt and deliver a message to this device.
  subscription jsonb not null,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Owner-only: a user manages only their own device subscriptions.
create policy "own_push_subscriptions_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "own_push_subscriptions_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "own_push_subscriptions_update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_push_subscriptions_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
