// buildpad-backend-file: supabase
/**
 * Suspend or reactivate one account — POST /api/admin/users/status   { id, status: 'active' | 'suspended' }
 *
 * Global Administrators only. Reactivating is how an administrator undoes an Offboarding review. Nothing is deleted.
 * An administrator cannot suspend themselves, and system / test accounts are not people to manage here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireGlobalAdmin } from '@/lib/api/admin-guard';
import { isSettableStatus, setUserStatus } from '@/lib/admin-user-status';
import { isExcludedEmail } from '@/lib/mentionable-users';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const guard = await requireGlobalAdmin();
  if (guard.error) return guard.error;

  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return NextResponse.json({ error: 'id must be a user id' }, { status: 400 });
  if (!isSettableStatus(body.status)) return NextResponse.json({ error: "status must be 'active' or 'suspended'" }, { status: 400 });
  if (body.status === 'suspended' && body.id === guard.session.user.id) {
    return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: target, error } = await supabase.from('daas_users').select('id,email').eq('id', body.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not read the user.' }, { status: 502 });
  if (!target) return NextResponse.json({ error: 'No such user.' }, { status: 404 });
  if (isExcludedEmail((target as { email?: string | null }).email)) {
    return NextResponse.json({ error: 'System and test accounts are not managed here.' }, { status: 400 });
  }

  if (!(await setUserStatus(supabase, body.id, body.status))) return NextResponse.json({ error: 'Could not change the account.' }, { status: 502 });
  return NextResponse.json({ data: { id: body.id, status: body.status } });
}
