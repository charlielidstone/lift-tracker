-- Migration 006: per-user notes scratchpad.
-- One free-text note per user (the "Notes" tab — one big text box). Owner-only RLS,
-- matching migration 005's per-user pattern. Run in the Supabase SQL Editor.

create table if not exists public.user_notes (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  content     text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.user_notes enable row level security;

-- Owner-only: a user sees and edits only their own note row.
create policy "own_user_notes_select" on public.user_notes
  for select using (auth.uid() = user_id);
create policy "own_user_notes_insert" on public.user_notes
  for insert with check (auth.uid() = user_id);
create policy "own_user_notes_update" on public.user_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_user_notes_delete" on public.user_notes
  for delete using (auth.uid() = user_id);
