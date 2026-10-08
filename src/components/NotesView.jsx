// NotesView — the Notes tab: one big text box, synced per-user.
//
// Offline-first, same philosophy as the workout cache: every keystroke writes
// through to localStorage instantly (so a reload — even offline — keeps your
// text) and pushes to the server on a debounce. On load we show the cached copy
// immediately, then reconcile with the server, keeping whichever was edited more
// recently (notes.pickNewerNote). If the server is unreachable (offline, or the
// table isn't created yet), the box still works locally and syncs later.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { fetchNote, saveNote } from '@/lib/workoutRepo';
import { loadNoteCache, saveNoteCache } from '@/lib/localCache';
import { pickNewerNote } from '@/lib/notes';

const SAVE_DEBOUNCE_MS = 800;

export function NotesView() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [content, setContent] = useState('');
  const [status, setStatus] = useState('saved'); // saved | saving | offline | error
  const hydratedRef = useRef(false); // don't write cache before the first load
  const timerRef = useRef(null);
  const contentRef = useRef('');

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Push the current text to the server; reflect sync status. Keeps the local
  // cache regardless, so nothing is lost if this fails.
  const pushToServer = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      await saveNote(contentRef.current);
      setStatus('saved');
    } catch (e) {
      setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
      console.error('[NotesView] save failed (kept locally)', e);
    }
  }, []);

  // ── Initial load: cache first (instant/offline), then reconcile with server ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    /* eslint-disable react/set-state-in-effect */
    const cached = loadNoteCache(userId);
    if (cached) setContent(cached.content ?? '');
    /* eslint-enable react/set-state-in-effect */
    hydratedRef.current = true;

    (async () => {
      try {
        const server = await fetchNote();
        if (cancelled) return;
        const winner = pickNewerNote(cached, server);
        setContent(winner.content);
        // Mirror the resolved copy into the cache so both sources agree.
        saveNoteCache(userId, winner.content, winner.updatedAt || Date.now());
        setStatus('saved');
      } catch (e) {
        if (cancelled) return;
        setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
        console.error('[NotesView] load failed (using cache)', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Flush pending text when the connection comes back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => pushToServer();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pushToServer]);

  const handleChange = (e) => {
    const next = e.target.value;
    setContent(next);
    setStatus('saving');
    // Write-through cache immediately so an offline reload keeps the text.
    if (hydratedRef.current) saveNoteCache(userId, next, Date.now());
    // Debounced server push.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(pushToServer, SAVE_DEBOUNCE_MS);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted-foreground">Sign in to use notes.</p>;
  }

  const statusText = {
    saving: 'Saving…',
    saved: 'Saved',
    offline: 'Offline — saved on this device, will sync later',
    error: "Couldn't sync — saved on this device",
  }[status];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Notes</p>
        <span
          className={
            status === 'offline' || status === 'error'
              ? 'text-xs text-amber-600'
              : 'text-xs text-muted-foreground'
          }
        >
          {statusText}
        </span>
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Jot anything down — PRs to chase, form cues, how you felt…"
        className="min-h-[60vh] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
