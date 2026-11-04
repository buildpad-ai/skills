// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Deciding which tenant role a person's jobs mean: one tenant's rules, run on the person
 * one job (a designation held at a unit) at a time.
 *
 * The one function sign-in, the tester and any preview share, so what an admin is shown is
 * what sign-in will do. "No decision" (null role) is the safe answer: the caller grants
 * nothing and a job nobody decided blocks revocation.
 */

import { toSubject } from '@xtremax/organisation-platform/adapter';
import type { PersonLookup } from '@xtremax/organisation-platform/contract';
import { evaluate, type RuleSet } from '@xtremax/organisation-platform/engine';
import { isGrantableRole, roleStrength } from './outcomes';

/** The job a decision is about: a designation held at a unit. */
export const placementKey = (designationId: string, unitId: string): string => `${designationId}\u0000${unitId}`;

/**
 * What the rules decide for this person. Each job is checked on its own, and a job that
 * more than one rule matched gets the strongest role. An outcome that is not a tenant
 * role is dropped, whoever wrote the rule.
 */
export function decideByRules(ruleSet: RuleSet, person: PersonLookup): Map<string, string> {
  const out = new Map<string, string>();
  for (const result of evaluate(ruleSet, toSubject(person)).results) {
    if (!result.designationId || !result.unitId || !isGrantableRole(result.outcomeId)) continue;
    const key = placementKey(result.designationId, result.unitId);
    const current = out.get(key);
    if (current === undefined || roleStrength(result.outcomeId) < roleStrength(current)) out.set(key, result.outcomeId);
  }
  return out;
}

export interface TenantDecision {
  /** The strongest role any job earns, or null for no decision. */
  roleId: string | null;
  /** Jobs the platform could not place at a unit. Unresolved is not "none", and blocks revocation. */
  unresolvedJobs: number;
  /** Jobs no rule gave a role to. They grant nothing and block revocation. */
  undecidedJobs: number;
}

/** What one tenant's rules say about this person, with the facts revocation needs. */
export function decideForTenant(ruleSet: RuleSet, person: PersonLookup): TenantDecision {
  const decisions = decideByRules(ruleSet, person);
  let roleId: string | null = null;
  let unresolvedJobs = 0;
  let undecidedJobs = 0;

  for (const job of person.roles) {
    if (!job.orgUnitId) {
      unresolvedJobs += 1;
      continue;
    }
    const role = decisions.get(placementKey(job.orgRoleId, job.orgUnitId));
    if (!role) {
      undecidedJobs += 1;
      continue;
    }
    if (roleId === null || roleStrength(role) < roleStrength(roleId)) roleId = role;
  }
  return { roleId, unresolvedJobs, undecidedJobs };
}

/** Taking a role away needs a complete picture: nothing unresolved and nothing undecided. */
export const mayRevoke = (decision: TenantDecision): boolean => decision.unresolvedJobs === 0 && decision.undecidedJobs === 0;
