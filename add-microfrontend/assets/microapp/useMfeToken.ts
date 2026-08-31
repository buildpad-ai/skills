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

export function useMfeToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Standalone (not framed): the Supabase session path in the CLI wrapper
    // handles auth. This hook only serves the framed case.
    if (!isFramed()) return;

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
          postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
          return;
        }
        const { access_token } = (await response.json()) as { access_token: string };
        if (!cancelled) setToken(access_token);
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

  return token;
}
