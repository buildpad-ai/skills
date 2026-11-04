// buildpad-backend-file: supabase
/**
 * Where the Role assignment screens read and write, and the words they use.
 *
 * getFeedback has one kind of rule (role assignment), kept per tenant, so this is a plain
 * constants file rather than the two-kind switch the reference app needs.
 */

export const RULES_API = '/api/org-rules';
export const RULES_TEST_API = '/api/org-rules/test';
export const RULES_PATH = '/dashboard/automation/role-assignment';

export const RULES_TEXT = {
  title: 'Role assignment',
  description: 'Give people a role in this tenant, based on who they are in the Organisation Platform. Only the highest-priority matching rule applies to each job (top of the list wins).',
  noPermission: 'You do not have permission to manage role assignment rules for this tenant.',
  outcomeHeader: 'Assign role',
  outcomeHeading: 'Assign this role',
  emptyList: 'No role assignment rules yet. Nobody gets a role in this tenant from this automation. Use “Create rule” to add one.',
  removedOutcome: 'No decision',
  deleteWarning: 'will be removed from the list. People it matched are decided by the rules that remain the next time they are placed, and nobody loses a role because no rule matches them.',
  needsOutcomeHint: 'To save, name the rule, give it at least one condition with a value, and choose a role.',
} as const;
