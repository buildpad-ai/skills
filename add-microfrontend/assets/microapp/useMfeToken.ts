// useMfeToken.ts — the token source for DaaSProviderWrapper inside the frame.
//
// Copy to: lib/bridge/useMfeToken.ts
//
// The CLI's DaaSProviderWrapper reads supabase.auth.onAuthStateChange, which never
// fires in a framed micro-app (there is no Supabase session on this origin — only
// the bridge cookie). This hook is the framed counterpart: it reads the token from
// /api/auth/token and re-reads whenever the bridge stores a new one.
//
// Wire it into the CLI wrapper with the pinned edit in
// references/auth-bridge.instructions.md — do not replace the wrapper.

'use client';

import { useEffect, useState } from 'react';
import { bridgeMessage } from './bridge-protocol';
import { isFramed, onAuthApplied, postToHost } from '@/components/MicroappBridgeProvider';

/**
 * Framed token state.
 *
 * `resolved` is what gates rendering: DaaSProvider renders {children}
 * unconditionally, and React runs CHILD effects before PARENT effects, so a
 * module's mount fetch fires before this hook's fetch even starts. Buildpad
 * module hooks are useCallback(..., []) — they never retry when the token
 * lands — so an ungated first paint means a permanent 401.
 */
export type MfeTokenState = {
  token: string | null;
  /** true once the framed token question is settled (or we are standalone). */
  resolved: boolean;
};

export function useMfeToken(): MfeTokenState {
  const [token, setToken] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    // Standalone (not framed): the Supabase session path in the CLI wrapper
    // handles auth. This hook only serves the framed case.
    if (!isFramed()) {
      // Standalone: nothing to wait for — the Supabase path owns auth.
      setResolved(true);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/auth/token', {
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        // response.ok alone is NOT enough: a redirect to /login returns 200
        // text/html, and response.json() would throw on it.
        const isJson = response.headers.get('content-type')?.includes('application/json');
        if (!response.ok || response.redirected || !isJson) {
          // Not authenticated yet — ask the host. Stay unresolved so the gate
          // holds; onAuthApplied re-runs load() once SET_AUTH is stored.
          postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
          return;
        }
        const { access_token } = (await response.json()) as { access_token: string };
        if (!cancelled) {
          setToken(access_token);
          setResolved(true);
        }
      } catch {
        postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
      }
    }

    void load();
    // Re-read after MicroappBridgeProvider stores a fresh token.
    const unsubscribe = onAuthApplied(() => void load());

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { token, resolved };
}
