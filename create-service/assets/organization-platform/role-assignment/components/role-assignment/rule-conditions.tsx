// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
'use client';

/**
 * RuleConditions: one Include or Exclude group of a rule, as the reference mock draws it.
 *
 *   When  [OU Path | System | Attribute]  [attribute]  [operator]  [value]  ✕
 *   and   ...
 *   + Add condition
 *
 * It is a view over the package's headless builder: every edit goes through the store
 * (so the engine's own validation decides what is allowed), and the controls offered for
 * a condition come from what the store says about its attribute: its operators, and the
 * values it can take (a live list of designations or units, a fixed list of choices, or
 * free text). Designations and units are chosen by name and stored by id.
 */

import { Group } from '@mantine/core';
import type { Condition, ConditionGroup, Operator } from '@xtremax/organisation-platform/engine';
import { unitPathOf, type AttributeDefinition, type BuilderState, type GroupKind, type RuleBuilder } from '@xtremax/organisation-platform/builder-core';
import { Input, SelectDropdown, SelectMultipleCheckbox, Tags } from '@/components/ui';
import { COLORS as IDP_COLORS } from './tokens';
import { isSystemAttribute } from '@/lib/org-rules/system-attributes';
import { addLink, eyebrow, fieldStyles, modePill } from './styles';

type ConditionType = 'path' | 'system' | 'attribute';

const TYPE_LABEL: Record<ConditionType, string> = { path: 'OU Path', system: 'System', attribute: 'Attribute' };

// System is what the app itself knows (its list is the app's, see lib/org-rules/system-attributes); Attribute is what
// the Organisation Platform says about the person.
const typeOf = (attr: string): ConditionType => (attr === 'orgUnit' ? 'path' : isSystemAttribute(attr) ? 'system' : 'attribute');
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isBlank = (value: Condition['value']) => (Array.isArray(value) ? value.length === 0 : value.trim() === '');

/** The line under a condition that says what it will match, for the ones where that is not obvious. */
function hintFor(condition: Condition, def: AttributeDefinition | undefined, builder: RuleBuilder): string {
  if (!def || def.type !== 'orgUnit' || isBlank(condition.value)) return '';
  const names = (Array.isArray(condition.value) ? condition.value : [condition.value]).map((v) => builder.describe().value(def, v)).join(', ');
  switch (condition.op) {
    case 'isUnder':
      return `Everything under ${names}, including sub-units`;
    case 'is':
      return `Only people placed exactly at ${names}`;
    case 'isNot':
      return `Everyone except people placed exactly at ${names}`;
    default:
      return '';
  }
}

interface ConditionRowProps {
  builder: RuleBuilder;
  /** Which group the row is in, so its controls have names that tell the groups apart. */
  kind: GroupKind;
  condition: Condition;
  index: number;
  mode: ConditionGroup['mode'];
  canRemove: boolean;
  disabled: boolean;
  /** Values seen among the platform's people, by attribute key, offered as shortcuts. */
  suggestions: Record<string, string[]>;
}

function ConditionRow({ builder, kind, condition, index, mode, canRemove, disabled, suggestions }: ConditionRowProps) {
  const attributes = builder.getConfig().attributes;
  const def = attributes.find((a) => a.key === condition.attr);
  const type = typeOf(condition.attr);
  const operators = builder.operatorsFor(condition.attr);
  const options = builder.optionsFor(condition.attr);
  const id = condition.id;

  const keysOfType = (t: ConditionType) => attributes.filter((a) => typeOf(a.key) === t).map((a) => a.key);
  const types = (['path', 'system', 'attribute'] as const).filter((t) => keysOfType(t).length > 0);

  // Units are a tree. The dropdown indents them inside its options only (the selected value is shown plainly);
  // the checkbox list wraps, so a unit there is named by where it sits ("ID › Software Development").
  const orgUnits = builder.getConfig().catalogs.orgUnits;
  const depthOf = new Map(options.map((o) => [o.value, o.depth ?? 0]));
  const suffix = (o: { inactive?: boolean }) => (o.inactive ? ' (inactive)' : '');
  const plainChoices = options.map((o) => ({ value: o.value, text: `${o.label}${suffix(o)}` }));
  const listChoices = options.map((o) => ({
    value: o.value,
    text: def?.type === 'orgUnit' ? unitPathOf(orgUnits, o.value).slice(1).map((u) => u.name).join(' › ') || o.label : `${o.label}${suffix(o)}`,
  }));
  const multi = condition.op === 'isOneOf';
  const list = Array.isArray(condition.value) ? condition.value : [];
  const single = Array.isArray(condition.value) ? '' : condition.value;
  const hint = hintFor(condition, def, builder);
  const seen = (suggestions[condition.attr] ?? []).filter((v) => (multi ? !list.includes(v) : v !== single));

  const label = `${kind === 'include' ? 'Include' : 'Exclude'}: ${TYPE_LABEL[type]} condition ${index + 1}`;
  const placeholder = def?.type === 'text' ? 'Type a value' : 'Select a value';

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 124px minmax(0,1.1fr) minmax(0,1fr) minmax(0,2fr) 32px', gap: 10, alignItems: multi && def?.type !== 'text' ? 'start' : 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: IDP_COLORS.muted, paddingTop: multi && def?.type !== 'text' ? 8 : 0 }}>
          {index === 0 ? 'When' : mode === 'all' ? 'and' : 'or'}
        </div>
        <SelectDropdown
          label=""
          value={type}
          onChange={(v) => {
            const next = keysOfType((v as ConditionType) ?? type)[0];
            if (next) builder.setConditionAttribute(id, next);
          }}
          choices={types.map((t) => ({ value: t, text: TYPE_LABEL[t] }))}
          disabled={disabled}
          selectProps={{ size: 'sm', 'aria-label': `${label} type`, styles: { ...fieldStyles, input: { ...fieldStyles.input, fontWeight: 600, background: IDP_COLORS.surface } } }}
        />
        {type === 'path' ? (
          <div style={{ fontSize: 13, color: IDP_COLORS.body, padding: '0 4px' }}>Organisation path</div>
        ) : (
          <SelectDropdown
            label=""
            value={condition.attr}
            onChange={(v) => v && builder.setConditionAttribute(id, String(v))}
            choices={keysOfType(type).map((key) => ({ value: key, text: attributes.find((a) => a.key === key)?.label ?? key }))}
            disabled={disabled}
            selectProps={{ size: 'sm', 'aria-label': `${label} attribute`, styles: fieldStyles }}
          />
        )}
        <SelectDropdown
          label=""
          value={condition.op}
          onChange={(v) => v && builder.setConditionOperator(id, v as Operator)}
          choices={operators.map((op) => ({ value: op, text: sentenceCase(builder.describe().operator(op)) }))}
          disabled={disabled}
          selectProps={{ size: 'sm', 'aria-label': `${label} operator`, styles: fieldStyles }}
        />
        <div style={{ minWidth: 0 }}>
          {def?.type === 'text' && !multi && (
            <Input
              label=""
              value={single || null}
              onChange={(v) => builder.setConditionValue(id, v === null ? '' : String(v))}
              placeholder={placeholder}
              readonly={disabled}
              aria-label={`${label} value`}
            />
          )}
          {def?.type === 'text' && multi && (
            <Tags
              value={list}
              onChange={(v) => builder.setConditionValue(id, v ?? [])}
              placeholder="Type a value and press Enter"
              disabled={disabled}
            />
          )}
          {def?.type !== 'text' && !multi && (
            <SelectDropdown
              label=""
              value={single || null}
              onChange={(v) => builder.setConditionValue(id, v === null ? '' : String(v))}
              choices={plainChoices}
              placeholder={placeholder}
              searchable
              disabled={disabled}
              selectProps={{
                size: 'sm',
                'aria-label': `${label} value`,
                styles: fieldStyles,
                nothingFoundMessage: 'Nothing matches',
                renderOption: ({ option }) => <span style={{ paddingLeft: (depthOf.get(option.value) ?? 0) * 14 }}>{option.label}</span>,
              }}
            />
          )}
          {def?.type !== 'text' && multi && (
            <div role="group" aria-label={`${label} value`} style={{ border: '1px solid #c8c8c8', borderRadius: 8, padding: '8px 10px', maxHeight: 160, overflowY: 'auto' }}>
              <SelectMultipleCheckbox
                value={list}
                onChange={(v) => builder.setConditionValue(id, (v ?? []).map(String))}
                choices={listChoices}
                disabled={disabled}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={() => canRemove && builder.removeCondition(id)}
          disabled={!canRemove || disabled}
          style={{ width: 32, height: 32, border: 'none', background: 'none', color: IDP_COLORS.muted, fontSize: 13, cursor: canRemove && !disabled ? 'pointer' : 'default', opacity: canRemove && !disabled ? 1 : 0.35 }}
        >
          ✕
        </button>
      </div>
      {hint && <div style={{ marginLeft: 50, fontSize: 12, color: IDP_COLORS.body }}>{hint}</div>}
      {seen.length > 0 && !disabled && (
        <div style={{ marginLeft: 50, fontSize: 12, color: IDP_COLORS.body, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          Seen here:
          {seen.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Use ${value}`}
              onClick={() => (multi ? builder.toggleConditionValue(id, value) : builder.setConditionValue(id, value))}
              style={{ border: `1px solid ${IDP_COLORS.border}`, background: IDP_COLORS.surface, borderRadius: 999, padding: '2px 10px', fontSize: 12, color: IDP_COLORS.ink, cursor: 'pointer' }}
            >
              {value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface RuleConditionsProps {
  builder: RuleBuilder;
  state: BuilderState;
  ruleId: string;
  kind: GroupKind;
  title: string;
  /** How few conditions the group may be left with. `0` lets the last ✕ remove the group. */
  minConditions: number;
  disabled?: boolean;
  /** Values seen among the platform's people, by attribute key. */
  suggestions?: Record<string, string[]>;
}

export function RuleConditions({ builder, state, ruleId, kind, title, minConditions, disabled = false, suggestions = {} }: RuleConditionsProps) {
  const group = state.ruleSet.rules.find((r) => r.id === ruleId)?.[kind];
  if (!group) return null;

  const canRemove = group.conditions.length > minConditions;

  return (
    <div>
      <Group justify="space-between" align="center" gap={12} mb={12} wrap="wrap">
        <div style={eyebrow}>{title}</div>
        <Group gap={8} align="center" style={{ fontSize: 13, color: IDP_COLORS.body }}>
          Match
          <button type="button" aria-pressed={group.mode === 'all'} disabled={disabled} style={modePill(group.mode === 'all')} onClick={() => builder.setGroupMode(ruleId, kind, 'all')}>All</button>
          <button type="button" aria-pressed={group.mode === 'any'} disabled={disabled} style={modePill(group.mode === 'any')} onClick={() => builder.setGroupMode(ruleId, kind, 'any')}>Any</button>
          of these
        </Group>
      </Group>
      <div style={{ display: 'grid', gap: 12 }}>
        {group.conditions.map((condition, index) => (
          <ConditionRow key={condition.id} builder={builder} kind={kind} condition={condition} index={index} mode={group.mode} canRemove={canRemove} disabled={disabled} suggestions={suggestions} />
        ))}
      </div>
      <button type="button" disabled={disabled} style={{ ...addLink, marginTop: 12 }} onClick={() => builder.addCondition(ruleId, kind)}>
        + Add condition
      </button>
    </div>
  );
}
