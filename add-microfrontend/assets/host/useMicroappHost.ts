// useMicroappHost.ts — Main App (host) side of the bridge.
//
// Copy to: lib/bridge/useMicroappHost.ts
// AGENT: copy this file unchanged. The only project-specific value is the login
// route in `handleSessionMissing`, marked below.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  bridgeMessage,
  isBridgeMessage,
  pickParams,
  serializeParams,
  BRIDGE_VERSION,
  type HostMessage,
} from './bridge-protocol';

/* ------------------------------ mounted frame registry ------------------------------ */
// The host must reach every mounted micro-app at logout and at tenant switch, not only
// the frame that sent the last message.

type Frame = { window: Window; origin: string };
const frames = new Set<Frame>();

function post(frame: Frame, message: HostMessage) {
  frame.window.postMessage(message, frame.origin);
}

/** Send one message to every mounted micro-app. */
export function broadcastToMicroapps(message: HostMessage) {
  for (const frame of frames) post(frame, message);
}

/**
 * Clear every micro-app session, then the host session.
 * Call this from the logout button. Never call /api/auth/logout on its own:
 * each micro-app holds its own cookie on its own origin, and the host cannot
 * delete a cookie it does not own.
 */
export async function logoutAllMicroapps() {
  broadcastToMicroapps(bridgeMessage('LOGOUT'));
  // Give each frame one tick to fire its own /api/auth/logout request.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** Push a new tenant/scope to every mounted micro-app. Call this after a scope switch. */
export function broadcastScope(resourceUri: string) {
  broadcastToMicroapps(bridgeMessage('SET_SCOPE', { resource_uri: resourceUri }));
}

/** Push the host color scheme to every mounted micro-app. */
export function broadcastTheme(colorScheme: 'light' | 'dark') {
  broadcastToMicroapps(bridgeMessage('SET_THEME', { colorScheme }));
}

function readScopeCookie(): string | undefined {
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('daas_resource_uri='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : undefined;
}

/* ------------------------------------- the hook ------------------------------------- */

export interface UseMicroappHostOptions {
  /** Micro-app origin, from MICROAPP_URLS in config/app-urls.ts. */
  src: string;
  /** Route inside the micro-app, for example /users. */
  path?: string;
  /** Query parameters that may cross the boundary in either direction. */
  allowedParams?: readonly string[];
  /** Show the error state when no MICROAPP_LOADED arrives inside this budget. */
  loadTimeoutMs?: number;
  /** Called on a RESIZE message. Only wire this up for height-following embeds. */
  onResize?: (height: number) => void;
}

export function useMicroappHost({
  src,
  path = '/',
  allowedParams = [],
  loadTimeoutMs = 15000,
  onResize,
}: UseMicroappHostOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const resolvedOrigin = useMemo(() => new URL(src).origin, [src]);

  // Freeze the parameters that were on the host URL at mount. Later host changes
  // travel as SET_QUERY_PARAMS messages, never as a new `src`.
  const initialParamsRef = useRef<Record<string, string> | null>(null);
  if (initialParamsRef.current === null) {
    initialParamsRef.current = pickParams(new URLSearchParams(searchParams.toString()), allowedParams);
  }

  /**
   * The iframe `src`. It depends on `src` and `path` only.
   * Never add `searchParams` here: writing a new `src` reloads the micro-app,
   * which drops focus and input state on every synced keystroke.
   */
  const initialSrc = useMemo(() => {
    const url = new URL(path, src);
    for (const [key, value] of Object.entries(initialParamsRef.current ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }, [src, path]);

  // The last parameter set that came up from the micro-app. Used to drop the echo.
  const lastFromMicroappRef = useRef<string>(serializeParams(initialParamsRef.current ?? {}));
  const loadedRef = useRef(false);
  const allowedRef = useRef(allowedParams);
  allowedRef.current = allowedParams;

  const sendToMicroapp = useCallback(
    (message: HostMessage) => {
      const target = iframeRef.current?.contentWindow;
      if (target) target.postMessage(message, resolvedOrigin);
    },
    [resolvedOrigin],
  );

  /* --- register this frame so logout and scope switches can reach it --- */
  useEffect(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const frame: Frame = { window: target, origin: resolvedOrigin };
    frames.add(frame);
    return () => {
      frames.delete(frame);
    };
  }, [resolvedOrigin, initialSrc]);

  /* --- inbound messages --- */
  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      // Three checks, in this order. Origin alone is not enough: two frames of the
      // same micro-app on one page would each process the other's messages.
      if (event.origin !== resolvedOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isBridgeMessage(event.data) || event.data.v !== BRIDGE_VERSION) return;

      const message = event.data as Record<string, unknown> & { type: string };

      switch (message.type) {
        case 'MICROAPP_LOADED': {
          loadedRef.current = true;
          setIsLoading(false);
          setHasError(false);
          // The host URL may have moved while the frame was loading. The frame only
          // ever saw the parameters that were baked into its `src`.
          {
            const current = pickParams(
              new URLSearchParams(window.location.search),
              allowedRef.current,
            );
            if (serializeParams(current) !== lastFromMicroappRef.current) {
              sendToMicroapp(bridgeMessage('SET_QUERY_PARAMS', { params: current }));
            }
          }
          break;
        }

        case 'MICROAPP_NEEDS_AUTH': {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          // Track the narrowed session in its own variable: reassigning `data`
          // after the null check widens the type back and fails strict tsc.
          let session = data.session;
          if (!session) {
            // Only the HOST losing its session is a reason to go to login.
            // AGENT: set this to the Main App login route.
            router.push('/login');
            return;
          }
          // "The host owns refresh" needs code behind it: when the session is
          // inside the renewal window, getSession() alone returns the SAME
          // expires_at and the frame asks again forever. Refresh here, actively.
          // (90 s > the frame's 60 s lead, so the windows always overlap.)
          const msLeft = (session.expires_at ?? 0) * 1000 - Date.now();
          if (msLeft < 90_000) {
            const refreshed = await supabase.auth.refreshSession();
            if (refreshed.data.session) session = refreshed.data.session;
          }
          sendToMicroapp(
            bridgeMessage('SET_AUTH', {
              access_token: session.access_token,
              expires_at: session.expires_at ?? 0,
              resource_uri: readScopeCookie(),
            }),
          );
          break;
        }

        case 'QUERY_PARAMS_CHANGE': {
          const params = message.params;
          if (typeof params !== 'object' || params === null) return;
          const filtered = pickParams(params as Record<string, string>, allowedRef.current);
          lastFromMicroappRef.current = serializeParams(filtered);

          const next = new URLSearchParams(window.location.search);
          for (const key of allowedRef.current) {
            const value = filtered[key];
            if (value) next.set(key, value);
            else next.delete(key);
          }
          const query = next.toString();
          // replace, not push: an iframe keystroke must not add a history entry.
          router.replace(window.location.pathname + (query ? `?${query}` : ''), { scroll: false });
          break;
        }

        case 'NAVIGATE': {
          // A host-level section change is a real navigation, so push is correct here.
          if (typeof message.path === 'string' && message.path.startsWith('/')) {
            router.push(message.path);
          }
          break;
        }

        case 'RESIZE': {
          if (typeof message.height === 'number' && onResize) onResize(message.height);
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resolvedOrigin, router, sendToMicroapp, onResize]);

  /* --- host URL changes travel as a message, not as a new src --- */
  useEffect(() => {
    const current = pickParams(new URLSearchParams(searchParams.toString()), allowedRef.current);
    const serialized = serializeParams(current);
    if (serialized === lastFromMicroappRef.current) return; // echo of what the micro-app just sent
    if (!loadedRef.current) return; // the frame reads its own URL on first load
    sendToMicroapp(bridgeMessage('SET_QUERY_PARAMS', { params: current }));
  }, [searchParams, sendToMicroapp]);

  /* --- load watchdog --- */
  // `<iframe onError>` does not fire for HTTP errors, network failures, or a frame
  // blocked by CSP. A cross-origin load failure is opaque to the host, so the only
  // reliable signal is the absence of MICROAPP_LOADED.
  useEffect(() => {
    loadedRef.current = false;
    setIsLoading(true);
    setHasError(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        setHasError(true);
        setIsLoading(false);
      }
    }, loadTimeoutMs);
    return () => clearTimeout(timer);
    // `attempt` is in the deps so that a retry re-arms the watchdog. Without it a
    // second failure leaves the skeleton on screen for good.
  }, [initialSrc, loadTimeoutMs, attempt]);

  const retry = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = initialSrc;
    setAttempt((value) => value + 1);
  }, [initialSrc]);

  return { iframeRef, initialSrc, resolvedOrigin, isLoading, hasError, retry, sendToMicroapp };
}
