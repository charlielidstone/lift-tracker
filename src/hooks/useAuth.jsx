// useAuth — thin React context over Supabase auth.
//
// Provides the current session/user and login/signup/logout actions. Safe to use
// even when auth is not yet enforced: components can read `user` (null when logged
// out) without breaking. Whether the app REQUIRES login is controlled separately
// by VITE_REQUIRE_AUTH (see App.jsx) so we can ship this scaffold without locking
// anyone out.

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { readPersistedSession } from '@/lib/authSession';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

// How long to wait for supabase.auth.getSession() before falling back to the
// session persisted in localStorage. getSession() can stall offline when the
// token is expired (it awaits a refresh), so we must not block the app on it.
const AUTH_INIT_TIMEOUT_MS = 2000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    let mounted = true;
    let settled = false;

    // Resolve the initial session exactly once, from whichever comes first:
    // getSession() (authoritative, online) or — if that stalls — the session
    // Supabase already persisted to localStorage (so the app opens offline).
    const settle = (s) => {
      if (!mounted || settled) return;
      settled = true;
      setSession(s);
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => settle(data.session))
      .catch(() => settle(readPersistedSession(window.localStorage)));

    // Safety net: if getSession() neither resolves nor rejects (the offline
    // token-refresh hang), fall back to the persisted session after a timeout.
    const timer = setTimeout(
      () => settle(readPersistedSession(window.localStorage)),
      AUTH_INIT_TIMEOUT_MS,
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      // Reflect later auth changes (login/logout/refresh); don't gate loading.
      if (mounted) setSession(s);
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // If email confirmation is ON, there's no session yet — caller should tell the
    // user to check their email. Return whether a session was created.
    return { needsConfirmation: !data.session };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
