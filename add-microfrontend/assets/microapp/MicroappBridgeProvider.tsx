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
import { MFE_EXPIRES_COOKIE, SCOPE_COOKIE } from '@/lib/bridge/mfe-cookies';

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
 * Contract event shared with Buildpad's URL-aware list components
 * (@buildpad/hooks URL_STATE_EVENT). Dispatched after a programmatic URL
 * rewrite so those components re-read the URL — router.replace alone fires
 * neither popstate nor anything a framework-free component can hear.
 * Keep the literal identical to the hooks package.
 */
export const URL_STATE_EVENT = 'buildpad:urlchange';

/**
 * The query string most recently ANNOUNCED on URL_STATE_EVENT (no leading '?').
 * Router writes commit asynchronously, so location.search can lag the write
 * that was just announced; anything merging "current" params (useQueryParamSync)
 * must prefer this over a snapshot. null until the first announcement.
 */
export const lastAnnouncedSearchRef: { current: string | null } = { current: null };

/** Read the query string a URL_STATE_EVENT carries, falling back to the URL. */
function eventSearch(event: Event): string {
  const detail = (event as CustomEvent<{ search?: string }>).detail;
  if (detail && typeof detail.search === 'string') return detail.search;
  return window.location.search.replace(/^\?/, '');
}

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
  // SameSite=None + Partitioned: this cookie lives inside a cross-site frame.
  document.cookie = `${SCOPE_COOKIE}=${encodeURIComponent(resourceUri)}; path=/; SameSite=None; Secure; Partitioned`;
}

/**
 * Outbound URL mirror. Buildpad list managers (buildpad-ui ≥ the URL-state
 * release) write their settled search/filter/sort/page state to THIS frame's
 * URL via native history.replaceState and announce each write with the
 * URL_STATE_EVENT contract event. This observer re-reads the URL on that event
 * (and on popstate) and posts it up as QUERY_PARAMS_CHANGE, so the host URL
 * follows the module with no per-module wiring.
 *
 * Deliberately NOT useSearchParams: field-verified on Next 16, the app router
 * does not feed native replaceState back into useSearchParams, so a
 * router-based observer never fires. The event IS the contract.
 *
 * Echo-safe: a host-driven SET_QUERY_PARAMS records itself in lastFromHostRef
 * before router.replace + dispatch, so its own reflection is skipped.
 */
function useOutboundUrlMirror() {
  useEffect(() => {
    if (!isFramed()) return;

    const post = (event?: Event) => {
      const search =
        event && event.type === URL_STATE_EVENT ? eventSearch(event) : window.location.search;
      lastAnnouncedSearchRef.current = search.replace(/^\?/, '');
      const params = Object.fromEntries(new URLSearchParams(search).entries());
      const serialized = serializeParams(params);
      if (serialized === lastFromHostRef.current) return; // host echo — stop the loop
      lastFromHostRef.current = serialized;
      postToHost(bridgeMessage('QUERY_PARAMS_CHANGE', { params }));
    };

    const onPop = () => post();
    window.addEventListener(URL_STATE_EVENT, post);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(URL_STATE_EVENT, post);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
}

export function MicroappBridgeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setColorScheme } = useMantineColorScheme();
  useOutboundUrlMirror();
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastExpiresRef = useRef(0);

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
     *
     * The retry is CLAMPED to 5 s minimum. Never post immediately when leadMs <= 0:
     * if the host answers with an unchanged expires_at, an unclamped loop hammers
     * postMessage + Supabase Auth until rate limiting kills the session.
     */
    function scheduleRenewal(expiresAt: number) {
      clearTimeout(renewalTimerRef.current);
      const leadMs = expiresAt * 1000 - Date.now() - 60_000;
      renewalTimerRef.current = setTimeout(() => {
        postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
      }, Math.max(leadMs, 5_000));
    }

    const storedExpiry = Number(
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${MFE_EXPIRES_COOKIE}=`))
        ?.split('=')[1] ?? 0,
    );
    lastExpiresRef.current = storedExpiry;
    if (storedExpiry) scheduleRenewal(storedExpiry);

    async function applyAuth(accessToken: string, expiresAt: number, resourceUri?: string) {
      const response = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, expires_at: expiresAt, resource_uri: resourceUri }),
      });
      if (!response.ok) {
        // Do not go silent on failure — retry on the clamped cadence.
        scheduleRenewal(lastExpiresRef.current);
        return;
      }
      lastExpiresRef.current = expiresAt;
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
          // A token that does not advance expiry is a repeat of what we hold.
          // Re-applying it would re-run set-session on every retry tick.
          if (message.expires_at <= lastExpiresRef.current) {
            scheduleRenewal(lastExpiresRef.current);
            return;
          }
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
          // Wake URL-aware components (Buildpad list managers). Carry the applied
          // query: router.replace commits asynchronously, so listeners reading
          // location.search here would see the PRE-commit URL.
          lastAnnouncedSearchRef.current = query;
          window.dispatchEvent(new CustomEvent(URL_STATE_EVENT, { detail: { search: query } }));
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
