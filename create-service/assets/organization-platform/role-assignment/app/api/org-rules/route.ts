// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Role assignment rules — GET / PUT /api/org-rules
 *
 * One rule set per tenant, the tenant being the caller's active one. The rules are the
 * only thing that decides which role a person gets when they are placed from the
 * Organisation Platform. See lib/org-rules and .kiro/specs/org-platform-integration.
 *
 * GET  the rules, version, and everything the editor needs to draw itself: the roles a
 *      rule may give (Tenant Admin and Tenant Member, and nothing else), the live
 *      designation, unit and attribute lists, and the System attributes this app supplies
 *      itself. If the live lists cannot be read the answer says so (`catalogError`) and
 *      the editor goes read-only.
 * PUT  save rules. Re-validated here whatever the browser reported, the payload is rebuilt
 *      in lib/org-rules/store.ts and never forwarded, and a save based on a stale `version`
 *      is refused with 409 instead of overwriting.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RuleSet } from '@xtremax/organisation-platform/engine';
import { isPlatformConfigured } from '@/lib/org-platform/client';
import { resolveRulesCaller } from '@/lib/org-rules/access';
import { loadCatalogs } from '@/lib/org-rules/catalog';
import { RULE_LIMITS } from '@/lib/org-rules/constants';
import { roleOutcomes } from '@/lib/org-rules/outcomes';
import { emptyRuleSet, validateForSave } from '@/lib/org-rules/parse';
import { readRuleState, saveRuleState } from '@/lib/org-rules/store';
import { loadSystemAttributeDefs } from '@/lib/org-rules/system-defs';
import { systemAttributeDefs } from '@/lib/org-rules/system-attributes';

export async function GET(request: NextRequest) {
  const ctx = await resolveRulesCaller(request);
  if ('error' in ctx) return ctx.error;

  const configured = isPlatformConfigured();
  const [stored, catalog, system] = await Promise.all([
    readRuleState(ctx.tenantUri),
    configured ? loadCatalogs() : Promise.resolve(null),
    configured ? loadSystemAttributeDefs() : Promise.resolve(systemAttributeDefs()),
  ]);
  if (!stored.ok) {
    return NextResponse.json({ error: 'Could not load the rules' }, { status: 502 });
  }

  return NextResponse.json({
    data: {
      version: stored.state.version,
      // What is stored is set aside when it cannot be trusted; the editor starts clean and says why.
      rules: stored.state.ruleSet ?? emptyRuleSet(),
      problem: stored.state.problem,
      provisioned: stored.provisioned,
      configured,
      outcomes: roleOutcomes(),
      // What the app itself can say about a person: owned by this app, not the platform.
      system,
      limits: RULE_LIMITS,
      catalogs: catalog?.ok ? catalog.catalogs : null,
      catalogError: !configured ? null : catalog?.ok ? null : 'The Organisation Platform could not be reached',
    },
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await resolveRulesCaller(request);
  if ('error' in ctx) return ctx.error;

  let body: { rules?: unknown; baseVersion?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.baseVersion !== 'number' || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) {
    return NextResponse.json({ error: 'baseVersion must be a whole number, 0 or more' }, { status: 400 });
  }

  // Whatever the browser said about these rules, the server checks them again.
  const checked = validateForSave(body.rules);
  if (!checked.ok) {
    return NextResponse.json({ error: 'The rules are not valid', issues: checked.issues }, { status: 400 });
  }
  const ruleSet = body.rules as RuleSet;

  const saved = await saveRuleState(ctx.tenantUri, { ruleSet, baseVersion: body.baseVersion, userId: ctx.userId });

  if (saved.ok) {
    return NextResponse.json({ data: { version: saved.state.version, rules: saved.state.ruleSet } });
  }
  switch (saved.reason) {
    case 'conflict':
      return NextResponse.json(
        { error: 'Someone else changed the rules since you opened them. Reload to see their version.', currentVersion: saved.current.version },
        { status: 409 }
      );
    case 'not_provisioned':
      return NextResponse.json({ error: 'Rule storage is not set up on this deployment yet' }, { status: 503 });
    default:
      return NextResponse.json({ error: 'Could not save the rules' }, { status: 502 });
  }
}
