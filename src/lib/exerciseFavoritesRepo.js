// Data access for exercise favourites — the ONLY module that talks to Supabase for
// the exercise_favorites table (see migration 011). One row per user+exercise.
//
// Favourites are low-stakes UI state (losing a star is not a data-loss incident like
// a lost set), so this is a plain optimistic + write-through-cache pattern, NOT the
// durable outbox used for workout sets. fetchFavorites throws on a real error so the
// caller can distinguish "table missing / offline" (→ feature unavailable, show all)
// from "loaded, zero favourites".

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// Returns an array of favourited exercise ids. Throws on error (table missing/offline).
export async function fetchFavorites() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('exercise_favorites').select('exercise_id');
  if (error) throw error;
  return data.map((r) => r.exercise_id);
}

export async function addFavorite(exerciseId) {
  if (!isSupabaseConfigured) return;
  const uid = await currentUserId();
  const { error } = await supabase
    .from('exercise_favorites')
    .upsert({ user_id: uid, exercise_id: exerciseId }, { onConflict: 'user_id,exercise_id' });
  if (error) throw error;
}

export async function removeFavorite(exerciseId) {
  if (!isSupabaseConfigured) return;
  const uid = await currentUserId();
  const { error } = await supabase
    .from('exercise_favorites')
    .delete()
    .eq('user_id', uid)
    .eq('exercise_id', exerciseId);
  if (error) throw error;
}
