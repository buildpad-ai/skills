// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Role rules tester — POST /api/org-rules/test   { email, rules? }
 *
 * "What would these rules do for this person?" Looks the person up LIVE through the
 * Organisation Platform (nothing about people is ever stored here) and evaluates the draft
 * rules the editor sends, or the tenant's saved ones if none are sent, and says which rule
 * decided each job, so an admin can see why before trusting a rule. Writes nothing.
 *
 * Off the sign-in path, so it can wait out a slow platform: a failure to ask is a 502,
 * never "this person has no designations".
 *
 * Any Tenant Admin may look up any person in the organisation here and see their name, jobs and custom
 * attributes. That is accepted because the app is internal to one organisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toSubject, unresolvedRoles } from '@xtremax/organisation-platform/adapter';
import type { RuleSet } from '@xtremax/organisation-platform/engine';
import { fetchPerson, isPlatformConfigured } from '@/lib/org-platform/client';
import { resolveRulesCaller } from '@/lib/org-rules/access';
import { readAccountByEmail } from '@/lib/org-rules/account';
import { decideByRules } from '@/lib/org-rules/decide';
import { emptyRuleSet, validateForSave } from '@/lib/org-rules/parse';
import { readRuleState } from '@/lib/org-rules/store';
import { withSystemAttributes } from '@/lib/org-rules/system-attributes';

const MAX_EMAIL_LENGTH = 254;

const PLATFORM_UNAVAILABLE = 'The Organisation Platform could not be reached';

export async function POST(request: NextRequest) {
  const ctx = await resolveRulesCaller(request);
  if ('error' in ctx) return ctx.error;

  let body: { email?: unknown; rules?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter an email address' }, { status: 400 });
  }
  if (!isPlatformConfigured()) {
    return NextResponse.json({ error: 'The Organisation Platform connection is not configured on this deployment' }, { status: 409 });
  }

  let ruleSet: RuleSet;
  if (body.rules !== undefined) {
    const checked = validateForSave(body.rules);
    if (!checked.ok) return NextResponse.json({ error: 'The rules are not valid', issues: checked.issues }, { status: 400 });
    ruleSet = body.rules as RuleSet;
  } else {
    const stored = await readRuleState(ctx.tenantUri);
    if (!stored.ok) return NextResponse.json({ error: 'Could not load the rules' }, { status: 502 });
    ruleSet = stored.state.ruleSet ?? emptyRuleSet();
  }

  let asked;
  try {
    asked = await fetchPerson(email);
  } catch (err) {
    console.warn('[api/org-rules/test] people lookup failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: PLATFORM_UNAVAILABLE }, { status: 502 });
  }

  // What the app itself knows about this person, which rules may ask about. No account is an answer
  // (nothing to check); one that cannot be read is an error, never "no sign-in method".
  const account = await readAccountByEmail(email);
  if (!account.ok) {
    return NextResponse.json({ error: 'Could not read this person’s account in this app' }, { status: 502 });
  }

  const person = withSystemAttributes(asked, account.account);
  const decisions = [...decideByRules(ruleSet, person)].map(([key, roleId]) => {
    const [designationId, unitId] = key.split('\u0000');
    return { designationId, unitId, roleId };
  });

  return NextResponse.json({
    data: {
      people: [
        {
          root: 'organisation',
          person: { email: person.email, firstName: person.firstName, lastName: person.lastName, attributes: person.attributes },
          // What the rule editor's own test panel takes, so it can show the engine's reasons.
          subject: toSubject(person),
          unresolvedRoles: unresolvedRoles(person).length,
          rules: decisions,
        },
      ],
      // Shown beside the result so a rule on an account fact is not read as "no match" for a person with no account yet.
      account: { exists: account.found, signInMethod: account.account?.signInMethod ?? null },
    },
  });
}
