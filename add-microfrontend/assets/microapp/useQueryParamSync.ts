// useQueryParamSync.ts — keep one micro-app query parameter set in step with the host URL.
//
// Copy to: hooks/useQueryParamSync.ts
// AGENT: copy this file unchanged.
//
// This hook no longer sends MICROAPP_LOADED. MicroappBridgeProvider does that, so a
// page that never calls this hook still reports itself to the host.

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { bridgeMessage, serializeParams } from '@/lib/bridge/bridge-protocol';
import { lastFromHostRef, postToHost } from '@/components/MicroappBridgeProvider';

export function useQueryParamSync({ debounceMs = 300 }: { debounceMs?: number } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateQueryParams = useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }

      const query = next.toString();
      // replace, not push: every keystroke would otherwise add an entry to the
      // joint session history and trap the host back button inside the frame.
      router.replace(pathname + (query ? `?${query}` : ''), { scroll: false });

      const asRecord = Object.fromEntries(next.entries());
      // Drop the echo: this exact set arrived from the host a moment ago.
      if (serializeParams(asRecord) === lastFromHostRef.current) return;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        postToHost(bridgeMessage('QUERY_PARAMS_CHANGE', { params: asRecord }));
      }, debounceMs);
    },
    [searchParams, pathname, router, debounceMs],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return { updateQueryParams, searchParams };
}
