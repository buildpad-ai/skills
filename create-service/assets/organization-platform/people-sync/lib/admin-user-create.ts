// buildpad-backend-file: supabase
/**
 * Creating one directory user without a sign-in, shared by the Administrator "Add user" form
 * and the Organisation Platform import so both make exactly the same kind of account.
 *
 * Creates the Supabase auth user (email already confirmed, no password) and the matching
 * `daas_users` row with the SAME id. The sign-in flow (`findOrCreateUser`) finds the auth user
 * by email, so the person's first MyApps / xapphub login attaches to this account instead of
 * creating a second one. No tenant role is granted: tagging doesn't need one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeLike, type NewUserInput } from '@/lib/admin-users';

export type CreateUserResult =
  | { status: 'created'; id: string; email: string; name: string }
  /** The person is already in the directory, or already has a sign-in account. Nothing was written. */
  | { status: 'duplicate'; message: string }
  | { status: 'failed'; message: string };

export async function createDirectoryUser(supabase: SupabaseClient, input: NewUserInput): Promise<CreateUserResult> {
  const { email, firstName, lastName } = input;

  // Case-insensitive duplicate check against the directory.
  const { data: existing, error: lookupError } = await supabase.from('daas_users').select('id').ilike('email', escapeLike(email)).limit(1);
  if (lookupError) return { status: 'failed', message: 'Could not check for an existing user.' };
  if (existing && existing.length > 0) return { status: 'duplicate', message: `${email} already exists.` };

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    // These accounts have no password and can only be entered through single sign-on. Without this, Supabase
    // records them as `email` accounts, and a role assignment rule on "Sign-in method" would misjudge them
    // after their first MyApps sign-in (which does not rewrite app_metadata).
    app_metadata: { provider: 'oauth', providers: ['oauth'] },
    user_metadata: { first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(' ') },
  });
  if (createError || !created?.user) {
    // An auth account with no directory row (e.g. an interrupted earlier sign-in).
    if (createError && /already|registered|exists/i.test(createError.message)) {
      return { status: 'duplicate', message: `${email} already has a sign-in account.` };
    }
    return { status: 'failed', message: 'Could not create the user.' };
  }

  const { error: insertError } = await supabase
    .from('daas_users')
    .upsert({ id: created.user.id, email, first_name: firstName, last_name: lastName, status: 'active', provider: 'oauth' }, { onConflict: 'id' });
  if (insertError) {
    // Don't leave an auth user with no directory row behind.
    await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return { status: 'failed', message: 'Could not create the user.' };
  }

  return { status: 'created', id: created.user.id, email, name: [firstName, lastName].filter(Boolean).join(' ') };
}
