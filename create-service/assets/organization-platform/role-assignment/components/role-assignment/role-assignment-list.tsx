// buildpad-backend-file: supabase
'use client';

/**
 * Role assignment: the list of the active tenant's rules.
 *
 * Rules are in priority order (the top one that matches a job wins), so the list shows a
 * Priority column and arrows. The rules are the only thing that decides which role a
 * person gets when they are placed from the Organisation Platform. Each row opens the
 * rule; the toggle and the arrows save straight away, because each is one small change to
 * the whole rule set. Every save carries the version the page loaded, so a change made
 * elsewhere is never silently overwritten. A tenant with no enabled rule grants nobody a
 * new role and takes none away.
 *
 * Not a Buildpad CollectionList, deliberately: these are the entries of a single JSON rule
 * set held per tenant, not records in a collection, and their order is the data.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { createDescriber } from '@xtremax/organisation-platform/builder-core';
import type { RuleSet } from '@xtremax/organisation-platform/engine';
import { Toggle } from '@/components/ui';
import { buildBuilderConfig } from '@/lib/org-rules/builder-config';
import { ConnectionStatus } from './connection-status';
import { RULES_PATH, RULES_TEXT } from './config';
import { RuleBookNotices } from './notices';
import { TestRulesDrawer, type Names } from './test-rules-drawer';
import { COLORS, emptyState, tableHead, tableRow, tableWrap } from './tokens';
import { EMPTY_CATALOGS } from './types';
import { useRuleBook } from './use-rule-book';

const COLUMNS = '72px 1.1fr 2.2fr 1.5fr 70px 64px';

const arrowButton = {
  borderRadius: 6,
  border: `1px solid ${COLORS.border}`,
  background: '#fff',
  color: COLORS.ink,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  width: 28,
  height: 28,
} as const;

export function RoleAssignmentList() {
  const router = useRouter();
  const book = useRuleBook();
  const { data } = book;

  const [testOpen, setTestOpen] = useState(false);

  const catalogs = data?.catalogs ?? EMPTY_CATALOGS;
  const describer = useMemo(
    () => (data ? createDescriber(buildBuilderConfig({ outcomes: data.outcomes, catalogs, system: data.system, limits: data.limits, readOnly: true })) : null),
    [data, catalogs]
  );
  const names: Names = useMemo(() => {
    const designations = new Map(catalogs.designations.map((d) => [d.id, d.name]));
    const units = new Map(catalogs.orgUnits.map((u) => [u.id, u.name]));
    const roles = new Map((data?.outcomes ?? []).map((o) => [o.id, o.label]));
    return {
      designation: (id) => designations.get(id) ?? '(removed)',
      unit: (id) => units.get(id) ?? '(removed)',
      role: (id) => (id ? (roles.get(id) ?? id) : 'No decision'),
    };
  }, [catalogs, data?.outcomes]);

  if (book.error) {
    return (
      <Alert color="red" title="Error" mt="md">
        {book.error}
      </Alert>
    );
  }
  if (!data || !describer) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  const rules = data.rules.rules;
  const editable = book.editable;

  const save = (next: RuleSet) => void book.commit(next);
  const toggle = (id: string) => save({ ...data.rules, rules: rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) });

  const move = (id: string, direction: -1 | 1) => {
    const from = rules.findIndex((r) => r.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= rules.length) return;
    const next = [...rules];
    [next[from], next[to]] = [next[to]!, next[from]!];
    save({ ...data.rules, rules: next });
  };

  const open = (id: string) => router.push(`${RULES_PATH}/${id}`);

  return (
    <Stack gap={0} py="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>{RULES_TEXT.title}</Title>
          <Text size="sm" c="dimmed" maw={640}>
            {data.rules.strategy !== 'first-match'
              ? 'Give people a role in this tenant. Every matching rule applies, and a person who matches more than one gets the strongest role.'
              : RULES_TEXT.description}
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          {rules.length > 0 && (
            <Button variant="default" onClick={() => setTestOpen(true)} disabled={!data.configured}>
              Test rules
            </Button>
          )}
          <Button disabled={!editable} onClick={() => router.push(`${RULES_PATH}/new`)}>
            Create rule
          </Button>
        </Group>
      </Group>

      <ConnectionStatus />
      <RuleBookNotices data={data} conflict={book.conflict} onReload={() => void book.load()} />

      <div style={{ ...tableWrap, marginTop: 24 }}>
        <div style={tableHead(COLUMNS)}>
          <div>Priority</div>
          <div>Rule</div>
          <div>When</div>
          <div>{RULES_TEXT.outcomeHeader}</div>
          <div>Enabled</div>
          <div />
        </div>
        {rules.length === 0 ? (
          <div style={{ ...emptyState, borderTop: `1px solid ${COLORS.border}`, padding: '28px 16px' }}>{RULES_TEXT.emptyList}</div>
        ) : (
          rules.map((rule, index) => (
            <div
              key={rule.id}
              role="link"
              tabIndex={0}
              aria-label={`Open rule ${rule.name}`}
              style={tableRow(COLUMNS, true)}
              onClick={() => open(rule.id)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  open(rule.id);
                }
              }}
            >
              <div style={{ color: COLORS.muted, fontWeight: 600 }}>{index + 1}</div>
              <div style={{ color: COLORS.ink, fontWeight: 600 }}>{rule.name}</div>
              <div style={{ color: COLORS.body, fontSize: 12, lineHeight: 1.5 }}>{describer.rule(rule)}</div>
              <div style={{ color: COLORS.ink, fontWeight: 600 }}>
                {data.outcomes.some((o) => o.id === rule.outcomeId) ? describer.outcome(rule.outcomeId) : RULES_TEXT.removedOutcome}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle
                  label=""
                  value={rule.enabled}
                  onChange={() => toggle(rule.id)}
                  disabled={!editable}
                  switchProps={{ 'aria-label': `${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}` }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label={`Move ${rule.name} up`} disabled={!editable || index === 0} onClick={() => move(rule.id, -1)} style={{ ...arrowButton, opacity: editable && index > 0 ? 1 : 0.35 }}>
                  <IconArrowUp size={14} />
                </button>
                <button type="button" aria-label={`Move ${rule.name} down`} disabled={!editable || index === rules.length - 1} onClick={() => move(rule.id, 1)} style={{ ...arrowButton, opacity: editable && index < rules.length - 1 ? 1 : 0.35 }}>
                  <IconArrowDown size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <TestRulesDrawer opened={testOpen} onClose={() => setTestOpen(false)} rules={data.rules} names={names} />
    </Stack>
  );
}
