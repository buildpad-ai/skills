// MicroappIframe.tsx — the only place the Main App embeds a micro-app.
//
// Copy to: components/MicroappIframe.tsx
// AGENT: copy this file unchanged. Configure it through props at each call site.

'use client';

import { Alert, Button, Skeleton, Stack } from '@mantine/core';
import { useMicroappHost } from '@/lib/bridge/useMicroappHost';

/**
 * Default sandbox. Read references/security.md before you change it.
 *  - allow-modals is deliberately absent. It is what blocks window.confirm/alert/prompt
 *    inside the frame. Do not add it. Micro-apps use Mantine Modal instead.
 *  - allow-downloads is required for CSV export and for the Files module.
 *  - allow-top-navigation must never be added: it lets a micro-app replace the host page.
 *  - allow-popups-to-escape-sandbox is required only when the micro-app uses
 *    add-external-oauth, because an OAuth popup otherwise inherits this sandbox.
 */
export const DEFAULT_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads';

export interface MicroappIframeProps {
  /** Micro-app origin, from MICROAPP_URLS in config/app-urls.ts. */
  src: string;
  /** Accessible title. Playwright also selects the frame by this value. */
  title: string;
  /** Route inside the micro-app. */
  path?: string;
  /** Query parameters that may cross the boundary in either direction. */
  allowedParams?: readonly string[];
  /** Override only when the micro-app needs an extra capability. */
  sandbox?: string;
  /** Container height. The micro-app scrolls inside the frame. */
  height?: string;
  /** Error state deadline. Raise it for a cold Amplify SSR start. */
  loadTimeoutMs?: number;
}

export function MicroappIframe({
  src,
  title,
  path = '/',
  allowedParams = [],
  sandbox = DEFAULT_SANDBOX,
  height = '100%',
  loadTimeoutMs = 15000,
}: MicroappIframeProps) {
  const { iframeRef, initialSrc, isLoading, hasError, retry } = useMicroappHost({
    src,
    path,
    allowedParams,
    loadTimeoutMs,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      {isLoading && (
        <Skeleton height="100%" width="100%" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      )}

      {hasError && (
        <Alert color="red" title="This section did not load" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <Stack align="flex-start" gap="sm">
            <span>The embedded application did not respond. Check that it is deployed and that its CSP allows this page to frame it.</span>
            <Button size="xs" variant="light" onClick={retry}>
              Try again
            </Button>
          </Stack>
        </Alert>
      )}

      {/*
        `src` is frozen for the life of this mount. Host-side parameter changes are
        delivered as SET_QUERY_PARAMS messages. Rewriting `src` would reload the
        micro-app on every synced keystroke.
      */}
      <iframe
        ref={iframeRef}
        src={initialSrc}
        title={title}
        sandbox={sandbox}
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: isLoading || hasError ? 'none' : 'block',
        }}
      />
    </div>
  );
}
