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

  // Notify host on mount
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "MICROAPP_LOADED" }, hostOrigin);
    }
  }, [hostOrigin]);

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

For host-to-micro-app sync (e.g., the Main App has a global filter), forward params via the iframe `src`:

```typescript
function buildIframeSrc(base, path, searchParams, allowedParams) {
  const url = new URL(path, base);
  for (const param of allowedParams) {
    const value = searchParams.get(param);
    if (value) url.searchParams.set(param, value);
  }
  return url.toString();
}
```

When the Main App URL changes (e.g., browser back/forward), the iframe `src` updates, causing a re-load of the micro-app with the correct params.

## Security

1. **Always validate `event.origin`** against the expected micro-app origin
2. **Never use `'*'` as target origin** in postMessage calls
3. **Allowlist params explicitly** — never blindly forward all params
4. **Type-check message payloads** before using them

```typescript
// BAD — accepts messages from any origin
window.addEventListener("message", (event) => {
  // No origin check!
  router.replace(event.data.path);
});

// GOOD — strict origin and type validation
window.addEventListener("message", (event) => {
  if (event.origin !== EXPECTED_ORIGIN) return;
  if (event.data?.type !== "QUERY_PARAMS_CHANGE") return;
  if (typeof event.data.params !== "object") return;
  // ... safe to process
});
```

## Edge Cases

1. **Rapid typing**: Debounce prevents flooding the host with messages (default: 300ms)
2. **Browser back/forward**: Main App URL changes trigger iframe `src` update
3. **Initial load**: Micro-app reads initial params from its own URL (forwarded by `buildIframeSrc`)
4. **Empty params**: Explicitly delete params when value is null/empty to keep URLs clean
````
