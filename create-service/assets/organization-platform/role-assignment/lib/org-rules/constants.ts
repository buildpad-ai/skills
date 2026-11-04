// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Role assignment rules: shared constants.
 *
 * A tenant's role decisions come from its rules, and only from them. A tenant with no
 * enabled rule decides nothing: it grants no new role and nobody loses one.
 * See .kiro/specs/org-platform-integration/plan.md.
 */

/** Where a tenant's rule set lives. One row per tenant. */
export const RULE_SETS_COLLECTION = 'org_rule_sets';

/** Which role rows sign-in wrote, so it knows which ones it may change. One row per (person, tenant). */
export const ROLE_GRANTS_COLLECTION = 'org_role_grants';

/** The rule set format the stored `schema_version` refers to. */
export const RULE_SET_SCHEMA_VERSION = 1;

/** Caps on a rule set, enforced on save. They keep sign-in evaluation small and fast. */
export const RULE_LIMITS = { maxRules: 100, maxConditionsPerGroup: 20 } as const;

/** The module access key that shows Automation > Role assignment in the sidebar. */
export const ROLE_ASSIGNMENT_CAPABILITY = 'role-assignment:manage';
