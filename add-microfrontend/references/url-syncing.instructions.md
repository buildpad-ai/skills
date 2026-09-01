````markdown
# URL Syncing Deep Dive

## Overview

Browser URL syncing keeps the Main App's URL bar in sync with the micro-app's internal state (search queries, filters, pagination, sort). This uses the `postMessage` API with strict origin validation.

## Flow

```
User types in micro-app search box
  → Micro-app updates its own URL via router.replace()
  → Micro-app posts QUERY_PARAMS_CHANGE message to host
  → Main App validates origin
  → Main App filters by allowedParams
  → Main App updates its own URL via router.replace()
  → Browser URL bar reflects combined state
```

## useQueryParamSync Hook (Micro-App Side)

### Full Implementation

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface UseQueryParamSyncOptions {
  hostOrigin: string;
  debounceMs?: number;
}

export function useQueryParamSync({
  hostOrigin,
  debounceMs = 300,
}: UseQueryParamSyncOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // MICROAPP_LOADED is NOT sent from here. It belongs in MicroappBridgeProvider in the
  // micro-app root layout, so that a page which does not use this hook still reports
  // that it loaded. See iframe-composition.instructions.md.

  const updateQueryParams = useCallback(
    (params: Record<string, string | null>) => {
      const currentParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") {
          currentParams.delete(key);
        } else {
          currentParams.set(key, value);
        }
      }

      const queryString = currentParams.toString();
      const newPath = pathname + (queryString ? `?${queryString}` : "");
      router.replace(newPath, { scroll: false });

      // Debounce the postMessage to host
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: "QUERY_PARAMS_CHANGE",
              params: Object.fromEntries(currentParams.entries()),
            },
            hostOrigin,
          );
        }
      }, debounceMs);
    },
    [searchParams, pathname, router, hostOrigin, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { updateQueryParams, searchParams };
}
```

### Usage in a Component

```typescript
'use client';

import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { useQueryParamSync } from '@/hooks/useQueryParamSync';

const HOST_ORIGIN = process.env.NEXT_PUBLIC_HOST_ORIGIN!;

export function UsersListTable() {
  const { updateQueryParams, searchParams } = useQueryParamSync({
    hostOrigin: HOST_ORIGIN,
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    updateQueryParams({ search: value || null });
  }

  return (
    <TextInput
      data-testid="search-input"
      placeholder="Search users..."
      value={searchQuery}
      onChange={(e) => handleSearchChange(e.currentTarget.value)}
    />
  );
}
```

## MicroappIframe Host-Side Handler (Main App)

The Main App's `MicroappIframe` component listens for messages and updates the host URL:

```typescript
useEffect(() => {
  function handleMessage(event: MessageEvent) {
    if (event.origin !== resolvedOrigin) return;

    if (event.data?.type === "QUERY_PARAMS_CHANGE") {
      const params = event.data.params as Record<string, string>;
      const currentParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(params)) {
        if (allowedParams.includes(key)) {
          if (value) {
            currentParams.set(key, value);
          } else {
            currentParams.delete(key);
          }
        }
      }

      const queryString = currentParams.toString();
      const newPath =
        window.location.pathname + (queryString ? `?${queryString}` : "");
      router.replace(newPath, { scroll: false });
    }
  }

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, [resolvedOrigin, allowedParams, searchParams, router]);
```

### allowedParams Filtering

Only explicitly listed params are synced from micro-app to host. This prevents the micro-app from polluting the host URL with internal state:

```typescript
// Only these params will be reflected in the Main App URL
<MicroappIframe
  allowedParams={['search', 'page', 'sort', 'status']}
/>
```

Internal micro-app params (e.g., `_tab`, `_modal`) are ignored by the host.

## Bidirectional Sync

The iframe `src` carries the initial params **once**, at mount. After that, host-to-micro-app changes travel as a `SET_QUERY_PARAMS` message.

> **Never recompute `src` from `searchParams`.** Doing so creates a loop: the micro-app posts `QUERY_PARAMS_CHANGE`, the host calls `router.replace()`, `searchParams` changes, the computed `src` changes, React writes the new `src` attribute, and the browser reloads the frame. Every debounced keystroke remounts the micro-app and drops focus and input state.

```typescript
// Host: computed ONCE per (src, path). searchParams is deliberately not a dependency.
const iframeSrc = useMemo(() => {
  const url = new URL(path, src);
  for (const [key, value] of Object.entries(initialParamsRef.current ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}, [src, path]);

// Host: a later change (browser back/forward, a host filter) is a message.
useEffect(() => {
  const current = pickParams(new URLSearchParams(searchParams.toString()), allowedParams);
  if (serializeParams(current) === lastFromMicroappRef.current) return; // echo, skip
  if (!loadedRef.current) return;
  sendToMicroapp({ type: 'SET_QUERY_PARAMS', params: current });
}, [searchParams, sendToMicroapp]);
```

The micro-app applies `SET_QUERY_PARAMS` with `router.replace()` and records the value, so `useQueryParamSync` does not post it straight back.

## Security

1. **Validate `event.origin`** against the expected origin
2. **Validate `event.source`** — origin alone is not enough. Two frames of the same micro-app on one page each pass an origin check for the other's messages, and a same-origin popup or nested frame passes it too
3. **Validate the envelope** — every message carries `source: 'buildpad-mfe'` and `v: 1`, so bridge traffic can be told apart from other postMessage traffic and from an unknown version
4. **Never use `'*'` as target origin** in postMessage calls
5. **Allowlist params explicitly** — never blindly forward all params
6. **Type-check message payloads** before using them

```typescript
// BAD — accepts messages from any origin
window.addEventListener("message", (event) => {
  // No origin check!
  router.replace(event.data.path);
});

// GOOD — origin, source, envelope, then payload shape
window.addEventListener("message", (event) => {
  if (event.origin !== EXPECTED_ORIGIN) return;
  if (event.source !== iframeRef.current?.contentWindow) return; // host side
  if (event.data?.source !== BRIDGE_SOURCE || event.data?.v !== BRIDGE_VERSION) return;
  if (event.data.type !== "QUERY_PARAMS_CHANGE") return;
  if (typeof event.data.params !== "object" || event.data.params === null) return;
  // ... safe to process
});
```

## Echo Suppression (required on both sides)

Without this, the two apps push the same value back and forth forever.

- The **host** records the set it received in `lastFromMicroappRef`. Before it sends `SET_QUERY_PARAMS`, it compares the current host params against that value and skips a match.
- The **micro-app** records the set it received in `lastFromHostRef`. Before it posts `QUERY_PARAMS_CHANGE`, it compares and skips a match.

## History

Iframe navigations enter the browser's joint session history. Use `router.replace()` for search, filter, sort, and page changes on both sides, or the host back button walks through invisible micro-app states.

## Edge Cases

1. **Rapid typing**: Debounce prevents flooding the host with messages (default: 300ms)
2. **Browser back/forward**: the host sends `SET_QUERY_PARAMS`; the frame is not reloaded
3. **Initial load**: the micro-app reads initial params from its own URL, baked into `src` at mount
4. **Loaded late**: the host re-sends the current params on `MICROAPP_LOADED`, in case the host URL moved while the frame was loading
5. **Empty params**: Explicitly delete params when value is null/empty to keep URLs clean
````
