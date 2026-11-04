// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * What a rule may give here: Tenant Admin and Tenant Member, and nothing else.
 *
 * This list is the ceiling on what role assignment may ever grant. A rule that named the
 * global Administrator (or the base User role) would mint platform admins at sign-in for
 * everyone it matched, so the list is not editable by whoever authors the rules and not
 * overridable by a global Administrator.
 *
 * Ordered strongest first, which is how a person who matches two jobs ends up with the
 * stronger role. The ids come from the server environment, as everywhere else in the app.
 */

import type { Outcome } from '@xtremax/organisation-platform/builder-core';

const LABELS = { admin: 'Tenant Admin', member: 'Tenant Member' } as const;

const DESCRIPTIONS = {
  admin: 'Everything a member can do, plus managing projects, widget settings, API keys and invitations in this tenant.',
  member: 'Triage and comment on feedback in this tenant. Cannot manage projects or settings.',
} as const;

/** The grantable role ids, strongest first. Empty when the deployment does not configure them. */
export function allowedOutcomeIds(): string[] {
  return [process.env.TENANT_ADMIN_ROLE_ID, process.env.TENANT_MEMBER_ROLE_ID].filter((id): id is string => !!id);
}

/** The roles as the rule builder offers them, strongest first. */
export function roleOutcomes(): Outcome[] {
  const out: Outcome[] = [];
  if (process.env.TENANT_ADMIN_ROLE_ID) out.push({ id: process.env.TENANT_ADMIN_ROLE_ID, label: LABELS.admin, description: DESCRIPTIONS.admin });
  if (process.env.TENANT_MEMBER_ROLE_ID) out.push({ id: process.env.TENANT_MEMBER_ROLE_ID, label: LABELS.member, description: DESCRIPTIONS.member });
  return out;
}

/** Smaller is stronger. `-1` for anything that is not a tenant role. */
export const roleStrength = (roleId: string): number => allowedOutcomeIds().indexOf(roleId);

/** Whether this role may be granted by rules. Checked on save, on evaluation and again at grant time. */
export const isGrantableRole = (roleId: string | null | undefined): roleId is string => !!roleId && allowedOutcomeIds().includes(roleId);

/** Whether this is the Tenant Admin role. */
export const isAdminRole = (roleId: string): boolean => !!process.env.TENANT_ADMIN_ROLE_ID && roleId === process.env.TENANT_ADMIN_ROLE_ID;
