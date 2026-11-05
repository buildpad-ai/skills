// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * The "System" attributes of a rule: facts the app itself holds about a person.
 *
 * The Organisation Platform supplies a person's email, first and last name, designations,
 * units and its own custom attributes ("Attribute" in the rule editor, under their engine
 * keys `email`, `firstName`, `lastName`, `designation`, `attributes.<key>`). It can say
 * nothing about their account in this app, so this short list is owned by the app:
 *
 *   Email domain    what follows the @ (derived from the email; always available)
 *   Sign-in method  MyApps single sign-on, or Email and password
 *
 * The person's email itself comes from the platform's own attributes, so a separate
 * System email is not offered, and names and account status are not offered either.
 *
 * Sign-in method is read from the account's auth record (`app_metadata`), which the
 * sign-in callbacks write at creation: the provider for a single sign-on account and
 * `email` for one made with a password. It is a coarse signal, so it is offered as exactly
 * that: two values, and nothing finer than the record can tell.
 *
 * Namespace: the values travel to the engine as person attributes named
 * `app.<name>`, so they can never collide with a custom attribute of the
 * platform's, and a value supplied here always wins over one of that name.
 *
 * Pure and client-safe: no network, no server imports.
 */

import type { PersonLookup } from '@xtremax/organisation-platform/contract';
import type { RuleSet } from '@xtremax/organisation-platform/engine';

export const EMAIL_DOMAIN_KEY = 'attributes.app.emailDomain';
export const SIGN_IN_METHOD_KEY = 'attributes.app.signInMethod';

/** The person-attribute names the values are given to the engine under. */
const ATTRIBUTE_OF: Record<string, string> = {
  [EMAIL_DOMAIN_KEY]: 'app.emailDomain',
  [SIGN_IN_METHOD_KEY]: 'app.signInMethod',
};

export const SYSTEM_ATTRIBUTE_KEYS: readonly string[] = [EMAIL_DOMAIN_KEY, SIGN_IN_METHOD_KEY];

/** The ones whose value needs the person's account read (the email domain does not). */
export const ACCOUNT_ATTRIBUTE_KEYS: readonly string[] = [SIGN_IN_METHOD_KEY];
export const isSystemAttribute = (key: string): boolean => SYSTEM_ATTRIBUTE_KEYS.includes(key);

export type SignInMethod = 'sso' | 'email';

export const SIGN_IN_METHOD_OPTIONS: { value: SignInMethod; label: string }[] = [
  { value: 'sso', label: 'MyApps single sign-on' },
  { value: 'email', label: 'Email and password' },
];

/** What the account's auth record says, as far as rules care. `null` means it says nothing usable. */
export interface AccountFacts {
  signInMethod: SignInMethod | null;
}

/** One System attribute as the editor needs it. */
export interface SystemAttributeDef {
  key: string;
  label: string;
  type: 'text' | 'choice';
  /** For `choice`: everything the value can be. */
  options?: { value: string; label: string }[];
  /** For `text`: values seen among the platform's people, offered as shortcuts. They never limit what can be typed. */
  suggestions?: string[];
}

/** The System attributes, with what to suggest for the ones that take typed values. */
export function systemAttributeDefs(seen: { emailDomains?: string[] } = {}): SystemAttributeDef[] {
  return [
    { key: EMAIL_DOMAIN_KEY, label: 'Email domain', type: 'text', suggestions: seen.emailDomains ?? [] },
    { key: SIGN_IN_METHOD_KEY, label: 'Sign-in method', type: 'choice', options: SIGN_IN_METHOD_OPTIONS },
  ];
}

/** What follows the last @, lower-cased, or null when there is none. */
export function emailDomainOf(email: string | null | undefined): string | null {
  const at = (email ?? '').lastIndexOf('@');
  const domain = at >= 0 ? (email as string).slice(at + 1).trim().toLowerCase() : '';
  return domain === '' ? null : domain;
}

/**
 * How an account signs in, from its auth record's `app_metadata`. An account that has any
 * non-password provider signs in with single sign-on; one with only `email` uses a
 * password. `null` when the record says nothing usable, which the engine reads as "no value".
 */
export function signInMethodOf(meta: { provider?: unknown; providers?: unknown } | null | undefined): SignInMethod | null {
  if (!meta) return null;
  const names = [
    ...(Array.isArray(meta.providers) ? meta.providers : []),
    ...(typeof meta.provider === 'string' ? [meta.provider] : []),
  ]
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p !== '');
  if (names.length === 0) return null;
  return names.some((p) => p !== 'email') ? 'sso' : 'email';
}

/**
 * The person as the engine should see them: what the platform said, plus the app's
 * own facts. `account` is what the account record says; `undefined` (not read) or `null`
 * (no such account) leaves the account facts without a value rather than guessing one.
 */
export function withSystemAttributes(person: PersonLookup, account?: AccountFacts | null): PersonLookup {
  const attributes: PersonLookup['attributes'] = { ...person.attributes };
  // Whatever the platform said under these names is dropped: only this app can say them.
  for (const name of Object.values(ATTRIBUTE_OF)) delete attributes[name];

  const set = (key: string, value: string | null | undefined) => {
    const text = (value ?? '').trim();
    if (text !== '') attributes[ATTRIBUTE_OF[key]!] = text;
  };
  set(EMAIL_DOMAIN_KEY, emailDomainOf(person.email));
  set(SIGN_IN_METHOD_KEY, account?.signInMethod);
  return { ...person, attributes };
}

/** Whether any rule looks at a fact that needs the person's account read (the email domain needs no read). */
export function usesAccountFacts(ruleSet: RuleSet | null | undefined): boolean {
  return (ruleSet?.rules ?? []).some((rule) =>
    [rule?.include, rule?.exclude].some((group) => group?.conditions?.some((c) => ACCOUNT_ATTRIBUTE_KEYS.includes(c?.attr)))
  );
}
