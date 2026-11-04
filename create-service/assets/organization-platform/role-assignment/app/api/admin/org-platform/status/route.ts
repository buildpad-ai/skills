// buildpad-backend-file: supabase
/**
 * Is the Xtremax connection working? — GET /api/admin/org-platform/status
 *
 * Global Administrators only, and read-only: it says whether the configured key can reach
 * the Xtremax root and what the root is called. The key itself is never returned, shown or
 * accepted; it is a server setting, changed by whoever manages the deployment.
 */

import { NextResponse } from 'next/server';
import { requireGlobalAdmin } from '@/lib/api/admin-guard';
import { isPlacementEnabled, isPlatformConfigured, platformClient } from '@/lib/org-platform/client';

export async function GET() {
  const guard = await requireGlobalAdmin();
  if (guard.error) return guard.error;

  const base = { configured: isPlatformConfigured(), placementEnabled: isPlacementEnabled() };
  if (!base.configured) return NextResponse.json({ data: { ...base, reachable: false, rootName: null } });

  try {
    const units = await platformClient().orgUnits({ timeoutMs: 10_000, retry: false });
    // The key's own root has no parent: you cannot see, and must not infer, anything above it.
    const root = units.find((u) => u.parentId === null) ?? null;
    return NextResponse.json({ data: { ...base, reachable: true, rootName: root?.name ?? null } });
  } catch (err) {
    console.warn('[org-platform/status] check failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ data: { ...base, reachable: false, rootName: null } });
  }
}
