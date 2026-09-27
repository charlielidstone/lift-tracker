// Supabase client — single shared instance for the app.
// Keys come from env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY); see .env.example.
// The anon key is public by design; row-level security protects the data.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Whether the app is configured to talk to Supabase at all. Lets the UI fall back
// gracefully (e.g. in-memory only) when keys aren't set yet.
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Not fatal — the app can still run in-memory. Warn so it's obvious in dev.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — running without persistence. See .env.example.',
  );
}

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
