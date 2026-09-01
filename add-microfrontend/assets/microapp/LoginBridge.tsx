// LoginBridge.tsx — what /login renders when the micro-app is inside the host frame.
//
// Copy to: components/LoginBridge.tsx, and use it from app/login/page.tsx:
//
//   export default function LoginPage() {
//     return <LoginBridge fallback={<YourNormalLoginForm />} />;
//   }
//
// A micro-app never shows its own login form inside the frame. The host is already
// signed in; this component collects a token from it and moves on.
//
// AGENT: copy this file unchanged.

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/app-urls';
import { isFramed, onAuthApplied, requestAuthFromHost } from '@/components/MicroappBridgeProvider';

export function LoginBridge({ fallback }: { fallback: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [handshakeFailed, setHandshakeFailed] = useState(false);
  const [framed, setFramed] = useState<boolean | null>(null);

  useEffect(() => {
    const inFrame = isFramed();
    setFramed(inFrame);
    if (!inFrame) return;

    const unsubscribe = onAuthApplied(() => {
      // Read `next` from the LIVE URL at replace time, never from a captured
      // useSearchParams snapshot: on a statically prerendered /login the first
      // render's searchParams are EMPTY, and a handshake that completes inside
      // that window would replace to the paramless default route — dropping a
      // deep link's query (?next=/users%3Fsearch%3D...). Deployed-only: dev
      // renders the page dynamically and hides the race.
      const next = new URLSearchParams(window.location.search).get('next');
      const target = next && next.startsWith('/') ? next : DEFAULT_AUTHENTICATED_ROUTE;
      // replace, not assign: the failed /login attempt must not stay in history.
      window.location.replace(target);
    });

    // MicroappBridgeProvider holds the SET_AUTH listener and stores the token.
    // This only drives the request side, and it retries: a cold host can still be
    // attaching its listener when this frame finishes loading.
    const stopAsking = requestAuthFromHost({ onGiveUp: () => setHandshakeFailed(true) });

    return () => {
      unsubscribe();
      stopAsking();
    };
  }, []);

  if (framed === null) return null;

  if (framed && !handshakeFailed) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Signing you in…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (framed && handshakeFailed) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Text fw={600}>This section could not sign you in.</Text>
          <Text size="sm" c="dimmed">
            Reload the page. If it happens again, sign out of the main application and sign in again.
          </Text>
        </Stack>
      </Center>
    );
  }

  return <>{fallback}</>;
}
