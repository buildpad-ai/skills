// buildpad-backend-file: supabase
/**
 * Changing whether a directory account is active. `suspended` takes the person out of the @mention picker (it lists
 * active users only) and out of sign-in (see `isAccountBlocked`); `active` brings them back. Never a delete: comments,
 * feedback and history stay exactly as they are.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type SettableStatus = 'active' | 'suspended';

export const isSettableStatus = (value: unknown): value is SettableStatus => value === 'active' || value === 'suspended';

/** What a suspended person is told at sign-in. */
export const ACCOUNT_SUSPENDED_MESSAGE = 'Your account has been suspended. Contact an administrator.';

/** Statuses that must not sign in. Anything else (active, invited, draft, ...) keeps today's behaviour. */
export const BLOCKED_STATUSES: readonly string[] = ['suspended', 'terminated'];

/** Set one account's status. True when a row was changed. */
export async function setUserStatus(supabase: SupabaseClient, userId: string, status: SettableStatus): Promise<boolean> {
  const { data, error } = await supabase.from('daas_users').update({ status }).eq('id', userId).select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

/** Whether this account may not sign in. Unknown or unreadable counts as "may sign in": a lookup problem must not lock people out. */
export async function isAccountBlocked(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('daas_users').select('status').eq('id', userId).maybeSingle();
  if (error || !data) return false;
  return BLOCKED_STATUSES.includes(String((data as { status?: string | null }).status ?? ''));
}
