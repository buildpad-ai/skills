// Copy to: lib/shell/usePublicPathname.ts (every app, unchanged).
// lib/shell/usePublicPathname.ts — add-microfrontend-zones Step 6. Identical in every app.
'use client';

import { usePathname } from 'next/navigation';
import { OWN_PREFIX } from '@/config/app-urls';

/** usePathname() does not contain basePath. Add the prefix back for comparisons. */
export function usePublicPathname() {
  const pathname = usePathname();
  return `${OWN_PREFIX}${pathname === '/' ? '' : pathname}` || '/';
}
