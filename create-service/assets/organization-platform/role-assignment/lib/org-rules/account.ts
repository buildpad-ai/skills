// buildpad-backend-file: supabase
/**
 * Reading the getFeedback account facts a rule may ask about (see ./system-attributes).
 *
 * Server-only. "No account" is an answer (the person has not been created here yet), and
 * is not the same as "could not be read": the first leaves the account facts without a
 * value, the second makes the caller write nothing, because a rule such as "Sign-in method
 * is not MyApps single sign-on" is true of a missing value and must not be decided on a
 * failed read.
 */

import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { signInMethodOf, type AccountFacts } from './system-attributes';

export type AccountRead = { ok: true; found: boolean; account: AccountFacts | null } | { ok: false };

const PER_PAGE = 1000;
const MAX_PAGES = 20;

/** What the auth record of the account with this email says. `found: false` means there is no such account. */
export async function readAccountByEmail(email: string): Promise<AccountRead> {
  try {
    const supabase = createSupabaseAdmin();
    const wanted = email.trim().toLowerCase();
    // There is no getUserByEmail() in the Admin API, so page through, as sign-in provisioning does.
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
      if (error || !data) return { ok: false };
      const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
      if (hit) return { ok: true, found: true, account: { signInMethod: signInMethodOf(hit.app_metadata) } };
      if (data.users.length < PER_PAGE) return { ok: true, found: false, account: null };
    }
    // Ran out of pages without an answer either way.
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
