// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Reading a stored rule set safely.
 *
 * What is stored is only as trustworthy as whoever last wrote it, and a bad rule
 * set must never decide who gets access. So anything that cannot be read, is of a
 * format this code does not know, or fails the same validation a save runs, is
 * treated as having NO rules: it makes no decisions, and the caller reports it.
 */

import { RuleSetError, migrate, validateRuleSet, type RuleSet } from '@xtremax/organisation-platform/engine';
import { RULE_LIMITS, RULE_SET_SCHEMA_VERSION } from './constants';
import { allowedOutcomeIds } from './outcomes';

export type ParsedRuleSet =
  | { ok: true; ruleSet: RuleSet }
  | { ok: false; problem: string };

export const emptyRuleSet = (): RuleSet => ({ version: 1, strategy: 'first-match', rules: [] });

/** The same check a save runs, with this app's ceiling and limits. */
export const validateForSave = (ruleSet: unknown) =>
  validateRuleSet(ruleSet, { allowedOutcomeIds: allowedOutcomeIds(), limits: RULE_LIMITS });

/** `raw` is the stored `rules` column: an object, or a JSON string of one. `null` means none yet. */
export function parseStoredRuleSet(raw: unknown, schemaVersion: unknown = RULE_SET_SCHEMA_VERSION): ParsedRuleSet {
  if (raw === null || raw === undefined) return { ok: true, ruleSet: emptyRuleSet() };
  if (schemaVersion !== RULE_SET_SCHEMA_VERSION) {
    return { ok: false, problem: `unsupported schema version ${String(schemaVersion)}` };
  }

  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, problem: 'the stored rules are not valid JSON' };
    }
  }

  let ruleSet: RuleSet;
  try {
    ruleSet = migrate(value);
  } catch (error) {
    return { ok: false, problem: error instanceof RuleSetError ? error.message : 'the stored rules cannot be read' };
  }

  // A rule with an error would be skipped by the engine anyway, but a rule set that
  // fails validation was not written by the save route, so none of it is trusted.
  const checked = validateForSave(ruleSet);
  if (!checked.ok) {
    return { ok: false, problem: `the stored rules fail validation (${checked.issues[0]?.message ?? 'unknown'})` };
  }
  return { ok: true, ruleSet };
}

/** Whether a rule set has at least one rule switched on. A tenant without one decides nothing. */
export const hasEnabledRules = (ruleSet: RuleSet | null | undefined): boolean => !!ruleSet?.rules?.some((rule) => rule.enabled);
