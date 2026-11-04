// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
'use client';

/**
 * Test rules: the reference's right-hand drawer.
 *
 * The reference lets you pick a sample person. Here a person is looked up live by email
 * (nothing about people is ever stored), then the SAVED rules are run on what the
 * Organisation Platform says about them, one designation at a unit at a time, with the
 * reason: which rule decided, by its position in the list, so it is clear why before
 * anyone trusts a rule. Nothing is saved or changed.
 */

import { useMemo, useState } from 'react';
import { Alert, Drawer, Loader, Text } from '@mantine/core';
import { evaluate, type RuleSet } from '@xtremax/organisation-platform/engine';
import { Input } from '@/components/ui';
import { COLORS as IDP_COLORS, primaryPillButton } from './tokens';
import { call, failureMessage } from './api';
import { rolePill } from './styles';
import type { TestedAccount, TestedPerson } from './types';

export interface Names {
  designation: (id: string) => string;
  unit: (id: string) => string;
  role: (id: string | null) => string;
}

const keyOf = (p: { designationId: string; unitId: string }) => `${p.designationId}\u0000${p.unitId}`;

/** Which rule(s) matched this placement, as the reference words it ("Rule 2: Engineering managers"). */
function reasonFor(rules: RuleSet, person: TestedPerson, designationId: string, unitId: string): string {
  try {
    const trace = evaluate(rules, person.subject).trace.find((c) => c.designationId === designationId && c.unitId === unitId);
    const matched = (trace?.matchedRuleIds ?? [])
      .map((id) => rules.rules.findIndex((r) => r.id === id))
      .filter((i) => i >= 0)
      .map((i) => `Rule ${i + 1}: ${rules.rules[i]!.name}`);
    return matched.length > 0 ? matched.join(' · ') : '';
  } catch {
    return '';
  }
}

export function TestRulesDrawer({ opened, onClose, rules, names }: { opened: boolean; onClose: () => void; rules: RuleSet; names: Names }) {
  const [email, setEmail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<TestedPerson[] | null>(null);
  const [account, setAccount] = useState<TestedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!email) return;
    setTesting(true);
    setError(null);
    try {
      // No rules in the body: the server runs the saved ones.
      const res = await call<{ people: TestedPerson[]; account: TestedAccount }>('/api/org-rules/test', { method: 'POST', body: JSON.stringify({ email }) });
      if (!res.ok || !res.body?.data) {
        setTested(null);
        setError(failureMessage(res, 'Could not check this person.'));
        return;
      }
      setTested(res.body.data.people);
      setAccount(res.body.data.account);
    } catch {
      setTested(null);
      setError('Could not check this person.');
    } finally {
      setTesting(false);
    }
  };

  const results = useMemo(
    () =>
      (tested ?? []).map((t) => {
        // Every placement the person holds, so one no rule matched is shown as such rather than left out.
        const placements = t.subject.assignments.map((a) => ({ designationId: a.designationId, unitId: a.unitId }));
        return {
          t,
          rows: placements.map((p) => ({
            key: keyOf(p),
            ...p,
            role: t.rules.find((r) => keyOf(r) === keyOf(p))?.roleId ?? null,
            reason: reasonFor(rules, t, p.designationId, p.unitId),
          })),
        };
      }),
    [tested, rules]
  );

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size={440} title={<span style={{ fontSize: 18, fontWeight: 600, color: IDP_COLORS.ink }}>Test rules</span>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Text size="xs" c="dimmed">
          Enter a person’s email to look them up in the Organisation Platform. The enabled, saved rules are evaluated on what it says about them. Nothing is saved or changed.
        </Text>
        <div style={{ display: 'grid', gap: 10 }}>
          <Input label="Person’s email" value={email} onChange={(v) => setEmail(v === null ? null : String(v))} placeholder="someone@example.com" />
          <div>
            <button type="button" style={primaryPillButton} onClick={() => void check()} disabled={!email || testing}>
              {testing ? 'Checking…' : 'Check this person'}
            </button>
          </div>
        </div>

        {testing && <Loader size="sm" />}
        {error && <Alert color="red" variant="light">{error}</Alert>}

        {tested && account && (
          <Text size="xs" c="dimmed">
            {account.exists
              ? account.signInMethod
                ? `getFeedback account: signs in with ${account.signInMethod === 'sso' ? 'MyApps single sign-on' : 'email and password'}.`
                : 'getFeedback account found, but it does not record how they sign in, so a rule on Sign-in method cannot match.'
              : 'No getFeedback account yet, so a rule on Sign-in method cannot match until they sign in.'}
          </Text>
        )}

        {results.map(({ t, rows }) => (
          <div key={t.root} style={{ background: IDP_COLORS.surface, borderRadius: 10, padding: 14, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: IDP_COLORS.muted }}>
              Result · {[t.person.firstName, t.person.lastName].filter(Boolean).join(' ') || t.person.email}
            </div>
            {t.unresolvedRoles > 0 && (
              <Text size="xs" c="dimmed">{t.unresolvedRoles} designation(s) could not be placed on a unit and are not shown.</Text>
            )}
            {rows.length === 0 ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={rolePill}>Role assignment</span>
                <span style={{ fontSize: 14, color: IDP_COLORS.ink, fontWeight: 600 }}>No rule matched</span>
                <span style={{ color: IDP_COLORS.body, fontSize: 12 }}>This person holds no designation the rules can act on.</span>
              </div>
            ) : (
              rows.map((row) => (
                <div key={row.key} style={{ display: 'grid', gap: 4 }}>
                  <span style={rolePill}>Role assignment</span>
                  <span style={{ fontSize: 12, color: IDP_COLORS.body }}>
                    {names.designation(row.designationId)} at {names.unit(row.unitId)}
                  </span>
                  <span style={{ fontSize: 14, color: IDP_COLORS.ink, fontWeight: 600 }}>{row.role ? names.role(row.role) : 'No rule matched'}</span>
                  {row.reason && <span style={{ color: IDP_COLORS.body, fontSize: 12 }}>{row.reason}</span>}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
