// buildpad-backend-file: supabase
/**
 * Shapes shared by the Role assignment pages (list, create, detail).
 *
 * They are what `GET /api/org-rules` answers: one rule set per tenant, its version, and
 * everything the editor needs to draw itself.
 */

import type { RuleSet, Subject } from '@xtremax/organisation-platform/engine';
import type { SystemAttributeDef } from '@/lib/org-rules/system-attributes';

export interface Outcome { id: string; label: string; description?: string }

export interface Catalogs {
  designations: { id: string; name: string; status?: 'active' | 'inactive' }[];
  orgUnits: { id: string; name: string; parentId: string | null }[];
  personAttributes: { key: string; name: string; type: 'single_choice' | 'multiple_choice' | 'free_text'; options: string[] }[];
}

export interface RuleBookData {
  version: number;
  rules: RuleSet;
  problem: string | null;
  /** False when the rule storage has not been created on this deployment yet. */
  provisioned: boolean;
  /** False when the deployment has no Xtremax connection (no platform address or key). */
  configured: boolean;
  outcomes: Outcome[];
  /** What getFeedback itself can say about a person, supplied by this app (not the platform). */
  system: SystemAttributeDef[];
  limits: { maxRules: number; maxConditionsPerGroup: number };
  catalogs: Catalogs | null;
  catalogError: string | null;
}

export interface Placement { designationId: string; unitId: string; roleId: string }

export interface TestedPerson {
  root: string;
  person: { email: string; firstName: string | null; lastName: string | null };
  subject: Subject;
  unresolvedRoles: number;
  /** The role the rules give at each job, strongest per job. */
  rules: Placement[];
}

/** What getFeedback knows of the person tested, shown beside the result. */
export interface TestedAccount { exists: boolean; signInMethod: 'sso' | 'email' | null }

export const EMPTY_CATALOGS: Catalogs = { designations: [], orgUnits: [], personAttributes: [] };
