// buildpad-backend-file: supabase
'use client';

/**
 * Role assignment: create a rule, or open one (they are one form).
 *
 *   <path>/new         -> a blank rule at the bottom of the list
 *   <path>/[ruleId]    -> the rule, with Delete
 *
 * The rule is edited in the package's headless builder, which holds the whole rule set
 * but is only ever asked about this one rule. Saving sends the whole set back with the
 * version it was loaded at, so someone else's change is never overwritten. A condition
 * left blank is dropped on save; anything else wrong with the rule keeps Save disabled,
 * and the server checks it all again.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Center, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { BuilderState, RuleBuilder } from '@xtremax/organisation-platform/builder-core';
import { Input } from '@/components/ui';
import { buildBuilderConfig } from '@/lib/org-rules/builder-config';
import { RULES_PATH, RULES_TEXT } from './config';
import { RuleBookNotices } from './notices';
import { RuleConditions } from './rule-conditions';
import { eyebrow, formCard, mutedLink, outlinePill, radioCard, radioDot } from './styles';
import { COLORS, primaryPillButton, secondaryPillButton } from './tokens';
import { EMPTY_CATALOGS, type RuleBookData } from './types';
import { useRuleBook } from './use-rule-book';
import { useRuleBuilder } from './use-rule-builder';

const isBlank = (value: string | string[]) => (Array.isArray(value) ? value.length === 0 : value.trim() === '');

/** The conditions of one rule that have a value, which is all a save keeps. */
function filledConditions(state: BuilderState, ruleId: string): number {
  const rule = state.ruleSet.rules.find((r) => r.id === ruleId);
  return [rule?.include, rule?.exclude].reduce((n, g) => n + (g?.conditions.filter((c) => !isBlank(c.value)).length ?? 0), 0);
}

/** Take out the conditions with no value, and any group that leaves empty. */
function dropBlankConditions(builder: RuleBuilder, ruleId: string): void {
  const rule = builder.getState().ruleSet.rules.find((r) => r.id === ruleId);
  for (const group of [rule?.include, rule?.exclude]) {
    for (const condition of group?.conditions ?? []) if (isBlank(condition.value)) builder.removeCondition(condition.id);
  }
}

interface FormProps {
  book: ReturnType<typeof useRuleBook>;
  data: RuleBookData;
  /** `null` for a new rule. */
  ruleId: string | null;
  onReload: () => void;
}

function RuleForm({ book, data, ruleId, onReload }: FormProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const config = useMemo(
    () =>
      buildBuilderConfig({
        outcomes: data.outcomes,
        catalogs: data.catalogs ?? EMPTY_CATALOGS,
        system: data.system,
        limits: data.limits,
        // Without the live lists a condition could look like it names something it does not.
        readOnly: !(data.provisioned && data.configured && data.catalogs !== null),
      }),
    // The form is remounted (see the page below) when the data is reloaded, so this is made once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const { builder, state } = useRuleBuilder(config, data.rules, (b) => {
    if (ruleId) b.openRule(ruleId);
    else b.addRule();
  });

  const activeId = state.openRuleId;
  const rule = activeId ? state.ruleSet.rules.find((r) => r.id === activeId) : undefined;

  const backToList = () => router.push(RULES_PATH);
  const disabled = !book.editable;

  const back = (
    <div>
      <button type="button" style={mutedLink} onClick={backToList}>
        ← {RULES_TEXT.title}
      </button>
    </div>
  );

  if (!rule || !activeId) {
    return (
      <Stack gap={0} py="md">
        {back}
        <RuleBookNotices data={data} conflict={book.conflict} onReload={onReload} />
        <Alert color={ruleId ? 'red' : 'yellow'} mt="md" variant="light" title={ruleId ? 'Rule not found' : 'Cannot add a rule'}>
          {ruleId
            ? 'This rule no longer exists. It may have been deleted by someone else.'
            : !(data.provisioned && data.configured && data.catalogs !== null)
              ? 'Rules cannot be edited right now.'
              : `This tenant already has the most rules it can have (${data.limits.maxRules}). Delete one to add another.`}
        </Alert>
      </Stack>
    );
  }

  const filled = filledConditions(state, activeId);
  // Blank conditions are dropped on save, so they are not a reason to refuse it.
  const blocking = state.issues.filter((i) => i.severity === 'error' && i.ruleId === activeId && i.code !== 'blank-value');
  const warnings = state.issues.filter((i) => i.severity === 'warning' && i.ruleId === activeId);
  const outcomeKnown = rule.outcomeId !== '' && data.outcomes.some((o) => o.id === rule.outcomeId);
  const canSave = !disabled && rule.name.trim() !== '' && outcomeKnown && filled > 0 && blocking.length === 0;

  const save = async () => {
    if (!canSave) return;
    builder.setRuleName(activeId, rule.name.trim());
    dropBlankConditions(builder, activeId);
    const result = await book.commit(builder.getState().ruleSet);
    if (result.ok) {
      notifications.show({ color: 'green', message: 'Rule saved' });
      backToList();
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    // Taken from what is saved: the draft holds unsaved edits to this rule, which are being thrown away anyway.
    const next = { ...data.rules, rules: data.rules.rules.filter((r) => r.id !== activeId) };
    const result = await book.commit(next);
    if (result.ok) {
      notifications.show({ color: 'green', message: 'Rule deleted' });
      backToList();
    }
  };

  // Shortcuts for the typed System values (the email domains the platform's people use).
  const suggestions = Object.fromEntries(data.system.filter((d) => d.suggestions?.length).map((d) => [d.key, d.suggestions!]));
  const hasInclude = !!rule.include;
  const hasExclude = !!rule.exclude;
  // Weakest first, so a new rule defaults towards the safer Tenant Member.
  const outcomes = [...data.outcomes].reverse();

  return (
    <Stack gap={0} py="md">
      {back}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <Title order={2}>{ruleId ? 'Edit rule' : 'New rule'}</Title>
        <Text size="sm" c="dimmed">
          {ruleId ? 'Change who this rule matches and what it gives them.' : 'Choose who this rule matches and what it gives them.'}
        </Text>
      </div>
      <RuleBookNotices data={data} conflict={book.conflict} onReload={onReload} />

      <div style={{ ...formCard, marginTop: 16 }}>
        <Input
          label="Rule name"
          value={rule.name || null}
          onChange={(v) => builder.setRuleName(activeId, v === null ? '' : String(v))}
          placeholder="e.g. Product managers"
          readonly={disabled}
          maxLength={120}
        />
      </div>

      <div style={formCard}>
        {!hasInclude ? (
          <Group justify="space-between" align="center" gap={12} wrap="nowrap">
            <div>
              <div style={eyebrow}>Include</div>
              <div style={{ fontSize: 12, color: COLORS.body, marginTop: 4 }}>
                No include conditions: the rule applies to everyone except the people excluded below.
              </div>
            </div>
            <button type="button" disabled={disabled} style={outlinePill} onClick={() => builder.addGroup(activeId, 'include')}>
              + Add inclusion
            </button>
          </Group>
        ) : (
          <Stack gap={10}>
            <RuleConditions builder={builder} state={state} ruleId={activeId} kind="include" title="Include people who match" minConditions={hasExclude ? 0 : 1} disabled={disabled} suggestions={suggestions} />
            {hasExclude && (
              <div>
                <button type="button" disabled={disabled} style={mutedLink} onClick={() => builder.removeGroup(activeId, 'include')}>
                  Remove inclusion
                </button>
              </div>
            )}
          </Stack>
        )}
      </div>

      <div style={formCard}>
        {!hasExclude ? (
          <Group justify="space-between" align="center" gap={12} wrap="nowrap">
            <div>
              <div style={eyebrow}>Exclude</div>
              <div style={{ fontSize: 12, color: COLORS.body, marginTop: 4 }}>
                People who match these conditions never get this rule, even if they match above.
              </div>
            </div>
            <button type="button" disabled={disabled} style={outlinePill} onClick={() => builder.addGroup(activeId, 'exclude')}>
              + Add exclusion
            </button>
          </Group>
        ) : (
          <Stack gap={10}>
            <RuleConditions builder={builder} state={state} ruleId={activeId} kind="exclude" title="Exclude people who match" minConditions={0} disabled={disabled} suggestions={suggestions} />
            {hasInclude && (
              <div>
                <button type="button" disabled={disabled} style={mutedLink} onClick={() => builder.removeGroup(activeId, 'exclude')}>
                  Remove exclusion
                </button>
              </div>
            )}
          </Stack>
        )}
      </div>

      {warnings.length > 0 && (
        <Alert color="yellow" variant="light" mb="md" title="Check these conditions">
          {warnings.map((w) => w.message).join(' ')}
        </Alert>
      )}

      <div style={{ ...formCard, marginBottom: 0 }}>
        <div style={eyebrow}>{RULES_TEXT.outcomeHeading}</div>
        <div role="radiogroup" aria-label={RULES_TEXT.outcomeHeading} style={{ display: 'grid', gap: 4, marginTop: 10 }}>
          {outcomes.map((outcome) => {
            const on = rule.outcomeId === outcome.id;
            return (
              <button
                key={outcome.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={outcome.label}
                disabled={disabled}
                style={radioCard(on)}
                onClick={() => builder.setRuleOutcome(activeId, outcome.id)}
              >
                <span style={radioDot(on)} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{outcome.label}</span>
                  {outcome.description && <span style={{ fontSize: 12, color: COLORS.body }}>{outcome.description}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <Group justify="space-between" gap={10} mt={20}>
          <div>
            {ruleId && (
              <button type="button" disabled={disabled} style={{ ...mutedLink, padding: '9px 0' }} onClick={() => setConfirmDelete(true)}>
                Delete rule
              </button>
            )}
          </div>
          <Group gap={10}>
            <button type="button" style={secondaryPillButton} onClick={backToList}>
              Cancel
            </button>
            <button type="button" style={{ ...primaryPillButton, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }} disabled={!canSave} onClick={() => void save()}>
              {book.saving ? 'Saving…' : 'Save rule'}
            </button>
          </Group>
        </Group>
        {!canSave && !disabled && (
          <Text size="xs" c="dimmed" ta="right" mt={8}>
            {RULES_TEXT.needsOutcomeHint}
          </Text>
        )}
      </div>

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this rule?" centered>
        <Stack gap="sm">
          <Text size="sm">
            “{rule.name || 'This rule'}” {RULES_TEXT.deleteWarning}
          </Text>
          <Group justify="flex-end" gap="sm">
            <button type="button" style={secondaryPillButton} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button type="button" style={{ ...primaryPillButton, background: COLORS.danger, borderColor: COLORS.danger }} onClick={() => void remove()}>
              Delete rule
            </button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export function RuleFormPage({ ruleId }: { ruleId: string | null }) {
  const book = useRuleBook();
  // Bumped on an explicit reload so the form starts again from what is now saved.
  const [generation, setGeneration] = useState(0);

  if (book.error) {
    return (
      <Alert color="red" title="Error" mt="md">
        {book.error}
      </Alert>
    );
  }
  if (!book.data) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  const reload = async () => {
    await book.load();
    setGeneration((g) => g + 1);
  };

  return <RuleForm key={`${book.tenantUri}:${ruleId ?? 'new'}:${generation}`} book={book} data={book.data} ruleId={ruleId} onReload={() => void reload()} />;
}
