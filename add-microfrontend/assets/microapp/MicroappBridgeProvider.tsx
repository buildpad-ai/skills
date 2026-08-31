// MicroappBridgeProvider.tsx — micro-app side of the bridge.
//
// Copy to: components/MicroappBridgeProvider.tsx
// Mount it in the micro-app ROOT layout, inside MantineProvider and above everything
// else. It must run on public pages too, otherwise a page that does not use the URL
// sync hook never reports that it loaded and the host shows its error state.
//
// AGENT: copy this file unchanged.

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMantineColorScheme } from '@mantine/core';
import { HOST_ORIGIN } from '@/config/app-urls';
import {
  bridgeMessage,
  isBridgeMessage,
  serializeParams,
  BRIDGE_VERSION,
  type MicroappMessage,
} from '@/lib/bridge/bridge-protocol';

/** Send one message up to the host. No-op when the app is not framed. */
export function postToHost(message: MicroappMessage) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(message, HOST_ORIGIN);
}

/** True when this app is running inside the host frame. */
export function isFramed() {
  return typeof window !== 'undefined' && window.parent !== window;
}

/**
 * The last parameter set the host pushed down. useQueryParamSync compares against
 * this value so that a host-originated change is not sent straight back up.
 */
export const lastFromHostRef = { current: '' };

/**
 * Ask the host for an access token, and keep asking until it answers.
 * A single shot is not enough: a cold host can still be mounting its message
 * listener when the frame finishes loading.
 */
export function requestAuthFromHost(options?: {
  intervalMs?: number;
  timeoutMs?: number;
  onGiveUp?: () => void;
}) {
  const intervalMs = options?.intervalMs ?? 500;
  const timeoutMs = options?.timeoutMs ?? 15000;
  if (!isFramed()) {
    options?.onGiveUp?.();
    return () => {};
  }

  postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
  const interval = setInterval(() => postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH')), intervalMs);
  const deadline = setTimeout(() => {
    clearInterval(interval);
    options?.onGiveUp?.();
  }, timeoutMs);

  return () => {
    clearInterval(interval);
    clearTimeout(deadline);
  };
}

/**
 * Subscribe to the moment a host token has been stored locally. The login bridge
 * uses this to leave /login once the handshake succeeds.
 */
const authAppliedListeners = new Set<() => void>();
export function onAuthApplied(listener: () => void) {
  authAppliedListeners.add(listener);
  return () => {
    authAppliedListeners.delete(listener);
  };
}

/** Write the scope cookie that DaaSProvider.getHeaders forwards as X-Resource-Uri. */
export function writeScopeCookie(resourceUri: string) {
  document.cookie = `daas_resource_uri=${encodeURIComponent(resourceUri)}; path=/; SameSite=None; Secure`;
}

export function MicroappBridgeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setColorScheme } = useMantineColorScheme();
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Tell the host this frame is alive. The host hides its skeleton on this message
  // and shows its error state if it never arrives.
  useEffect(() => {
    postToHost(bridgeMessage('MICROAPP_LOADED'));
  }, []);

  useEffect(() => {
    if (!isFramed()) return;

    /**
     * Ask for the next token one minute before this one dies.
     * This must also run on a plain page load. The handshake happens on /login and
     * then the app does a full navigation, so the provider that scheduled the first
     * renewal is gone by the time the real page renders.
     */
    function scheduleRenewal(expiresAt: number) {
      clearTimeout(renewalTimerRef.current);
      const leadMs = expiresAt * 1000 - Date.now() - 60_000;
      if (leadMs <= 0) {
        postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
        return;
      }
      renewalTimerRef.current = setTimeout(() => {
        postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
      }, leadMs);
    }

    const storedExpiry = Number(
      document.cookie
        .split('; ')
        .find((row) => row.startsWith('mfe_expires_at='))
        ?.split('=')[1] ?? 0,
    );
    if (storedExpiry) scheduleRenewal(storedExpiry);

    async function applyAuth(accessToken: string, expiresAt: number, resourceUri?: string) {
      const response = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, expires_at: expiresAt, resource_uri: resourceUri }),
      });
      if (!response.ok) return;
      if (resourceUri) writeScopeCookie(resourceUri);
      scheduleRenewal(expiresAt);

      for (const listener of authAppliedListeners) listener();
      router.refresh();
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== HOST_ORIGIN) return;
      if (event.source !== window.parent) return;
      if (!isBridgeMessage(event.data) || event.data.v !== BRIDGE_VERSION) return;

      const message = event.data as Record<string, unknown> & { type: string };

      switch (message.type) {
        case 'SET_AUTH': {
          if (typeof message.access_token !== 'string' || typeof message.expires_at !== 'number') return;
          void applyAuth(
            message.access_token,
            message.expires_at,
            typeof message.resource_uri === 'string' ? message.resource_uri : undefined,
          );
          break;
        }

        case 'SET_SCOPE': {
          if (typeof message.resource_uri !== 'string') return;
          writeScopeCookie(message.resource_uri);
          router.refresh();
          break;
        }

        case 'SET_QUERY_PARAMS': {
          const params = message.params;
          if (typeof params !== 'object' || params === null) return;
          const next = new URLSearchParams(params as Record<string, string>);
          lastFromHostRef.current = serializeParams(params as Record<string, string>);
          const query = next.toString();
          // replace, not push: host-driven parameter changes must not grow the
          // joint session history that the host back button walks through.
          router.replace(window.location.pathname + (query ? `?${query}` : ''), { scroll: false });
          break;
        }

        case 'SET_THEME': {
          if (message.colorScheme === 'light' || message.colorScheme === 'dark') {
            setColorScheme(message.colorScheme);
          }
          break;
        }

        case 'LOGOUT': {
          clearTimeout(renewalTimerRef.current);
          void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(renewalTimerRef.current);
    };
  }, [router, setColorScheme]);

  return <>{children}</>;
}
