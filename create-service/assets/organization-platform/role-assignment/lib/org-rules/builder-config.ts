// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * The rule builder's configuration, made from what `GET /api/org-rules` answered.
 *
 * Client-safe: it only touches the package's headless builder, never the platform
 * client. A condition can check:
 *
 *   - System attributes: what the app itself knows about the account (Email domain,
 *     Sign-in method), taken from the list the server sent, because this app owns it;
 *   - Attribute: what the Organisation Platform says, which every platform person has
 *     (Email, First name, Last name, Designation) plus whichever custom attributes it defined;
 *   - Organisation unit, offered as "OU Path".
 *
 * The roles a rule may give are the ones the server sent (Tenant Admin and Tenant
 * Member, and nothing else).
 */

import { BUILTIN_ATTRIBUTES, customAttribute, type AttributeDefinition, type BuilderConfig } from '@xtremax/organisation-platform/builder-core';
import type { Catalogs, Outcome } from '@/components/role-assignment/types';
import { isSystemAttribute, type SystemAttributeDef } from './system-attributes';

export interface BuilderConfigInput {
  outcomes: Outcome[];
  catalogs: Catalogs;
  system: SystemAttributeDef[];
  limits: { maxRules: number; maxConditionsPerGroup: number };
  readOnly: boolean;
}

const systemAttribute = (def: SystemAttributeDef): AttributeDefinition =>
  def.type === 'choice'
    ? { key: def.key, label: def.label, type: 'choice', scope: 'person', options: def.options ?? [] }
    : { key: def.key, label: def.label, type: 'text', scope: 'person' };

export function buildBuilderConfig({ outcomes, catalogs, system, limits, readOnly }: BuilderConfigInput): BuilderConfig {
  return {
    outcomes,
    attributes: [
      // The platform's own attributes first, so a new rule starts on Email as the platform names it.
      ...BUILTIN_ATTRIBUTES.filter((a) => !isSystemAttribute(a.key)),
      ...catalogs.personAttributes.map(customAttribute),
      ...system.map(systemAttribute),
    ],
    catalogs: { designations: catalogs.designations, orgUnits: catalogs.orgUnits },
    limits,
    readOnly,
    // A new rule starts unnamed: the admin names it.
    newRuleName: '',
  };
}
