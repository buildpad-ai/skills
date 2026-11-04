// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Who may read and write a tenant's rules, and which tenant that is.
 *
 * Which role a person gets in a tenant is that tenant's own call, so authoring its rules
 * has one boundary:
 *
 *  - the caller must be a Tenant Admin of the active tenant (an exact-scope role lookup,
 *    not `/permissions/me`, which leaks grants across tenants), or a global Administrator;
 *  - the tenant is always the one the session names. It is never read from a request body,
 *    so there is no way to ask about, or write to, another tenant's rules.
 *
 * What a rule may grant is capped separately (`./outcomes`): Tenant Admin and Tenant
 * Member, never the global Administrator, whoever is asking.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDaasUrl } from '@/lib/api/auth-headers';
import { isGlobalAdmin } from '@/lib/api/admin';
import { isTenantAdminAtScope } from '@/lib/api/tenant-role';

export interface RulesCaller {
  userId: string;
  email: string;
  isGlobalAdmin: boolean;
  /** The tenant this call is about: the session's active one. */
  tenantUri: string;
}

/** The signed-in session, or a ready-made 401. Shared by the routes that need no tenant. */
export async function requireSession(): Promise<{ error: NextResponse } | { accessToken: string; userId: string; email: string }> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { accessToken: session.access_token, userId: user.id, email: user.email ?? '' };
}

/** Whether this uri is a real tenant (a scope item of the tenant type). */
async function isTenantScope(uri: string): Promise<boolean> {
  const typeId = process.env.TENANT_SCOPE_TYPE_ID;
  if (!typeId) return false;
  try {
    const res = await fetch(
      `${getDaasUrl()}/items/daas_scope_items?filter[uri_path][_eq]=${encodeURIComponent(uri)}&filter[scope_type_id][_eq]=${encodeURIComponent(typeId)}&fields[]=id&limit=1`,
      { headers: { Authorization: `Bearer ${process.env.SERVICE_ACCOUNT_KEY}` }, cache: 'no-store' }
    );
    if (!res.ok) return false;
    const rows = ((await res.json().catch(() => null)) as { data?: unknown[] } | null)?.data;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function resolveRulesCaller(request: NextRequest): Promise<{ error: NextResponse } | RulesCaller> {
  const session = await requireSession();
  if ('error' in session) return session;

  const tenantUri = request.headers.get('x-resource-uri') ?? request.cookies.get('daas_resource_uri')?.value ?? null;
  if (!tenantUri) return { error: NextResponse.json({ error: 'No active tenant selected' }, { status: 400 }) };

  const admin = await isGlobalAdmin(session.accessToken);
  if (admin) {
    // A global Administrator may pass without a role row, so what they name must really be a tenant.
    if (!(await isTenantScope(tenantUri))) return { error: NextResponse.json({ error: 'No active tenant selected' }, { status: 400 }) };
  } else if (!(await isTenantAdminAtScope(session.accessToken, tenantUri, session.userId))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: session.userId, email: session.email, isGlobalAdmin: admin, tenantUri };
}
