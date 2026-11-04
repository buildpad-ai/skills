// buildpad-backend-file: supabase
/**
 * Rules for the Administrator "Users" page, where an admin adds a person so they can be
 * @mentioned before they have ever signed in.
 */

import { isExcludedEmail } from '@/lib/mentionable-users';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewUserInput {
  email: string;
  firstName: string;
  lastName: string;
}

export type NewUserCheck = { ok: true; value: NewUserInput } | { ok: false; error: string };

/** Lower-cased, trimmed email — the form duplicates are compared in. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate the add-user form. Rejects malformed addresses and the system / test addresses that
 * the mention picker hides anyway, so an admin can't add someone who could never be tagged.
 */
export function checkNewUser(input: { email?: unknown; firstName?: unknown; lastName?: unknown }): NewUserCheck {
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  if (!email) return { ok: false, error: 'Email is required.' };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (isExcludedEmail(email)) return { ok: false, error: 'That address belongs to a system or test account and cannot be added.' };

  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : '';
  if (firstName.length > 100 || lastName.length > 100) return { ok: false, error: 'Names must be 100 characters or fewer.' };

  return {
    ok: true,
    // Same fallback the sign-in flow uses, so the picker always has something to show.
    value: { email, firstName: firstName || email.split('@')[0], lastName },
  };
}

/** Escape LIKE wildcards so an email is matched literally by a case-insensitive `ilike`. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
