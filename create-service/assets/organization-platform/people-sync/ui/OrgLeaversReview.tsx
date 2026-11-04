// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, List, Loader, Modal, Paper, Progress, ScrollArea, Stack, Text } from '@mantine/core';

/**
 * "Offboarding review": people the Organisation Platform listed to an import run and no longer lists or knows, so an
 * administrator can look into them and suspend the ones they choose.
 *
 *   1. Open: the candidates. Only people an import run recorded as listed on the platform are ever considered (so a
 *      colleague who was never on the platform cannot appear), and only if they are still active here and no longer on
 *      the platform's designation list.
 *   2. Each candidate is checked live. Only "the platform no longer knows this person" is listed. Someone it still knows
 *      (they just lost their designation) is not, and a check that failed lists nobody.
 *   3. The administrator ticks who to suspend one by one (no "select all"; nothing ticked for them) and confirms.
 *      Suspending removes the person from the @mention picker and refuses their sign-in. Nothing is deleted, and
 *      "Reactivate" on the Users page undoes it.
 *
 * A person whose name matches someone the platform lists under another address is marked: the platform may simply hold
 * a new address for them. The server re-verifies every person at suspend time, so this screen only requests.
 */

interface Candidate {
  email: string;
  name: string;
  holdsAdmin: boolean;
  similar: { email: string; name: string } | null;
}
interface Candidates {
  candidates: Candidate[];
  listed: number;
  tracked: number;
  batchSize: number;
}
type CheckState = 'left' | 'on-platform' | 'not-a-candidate' | 'error';
type CheckOutcome = { email: string; state: CheckState; message?: string };
type SuspendOutcome = { email: string; status: 'suspended' } | { email: string; status: 'refused'; reason: string } | { email: string; status: 'failed'; message: string };

type Phase = 'loading' | 'checking' | 'review' | 'suspending' | 'done' | 'error';

async function post<T>(payload: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/admin/users/leavers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.data) return { ok: false, message: body?.error ?? 'Something went wrong. Try again.' };
    return { ok: true, data: body.data as T };
  } catch {
    return { ok: false, message: 'Could not reach the server. Try again.' };
  }
}

export function OrgLeaversReview({ onChanged }: { onChanged: () => void }) {
  const [opened, setOpened] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [plan, setPlan] = useState<Candidates | null>(null);
  const [checks, setChecks] = useState<Map<string, CheckOutcome>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suspended, setSuspended] = useState<Set<string>>(new Set());
  const [problems, setProblems] = useState<SuspendOutcome[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const cancelled = useRef(false);
  const changed = useRef(false);

  const checkAll = useCallback(async (emails: string[], batchSize: number) => {
    setPhase('checking');
    for (let i = 0; i < emails.length && !cancelled.current; i += batchSize) {
      const res = await post<{ results: CheckOutcome[] }>({ mode: 'check', emails: emails.slice(i, i + batchSize) });
      if (!res.ok) {
        setMessage(`${res.message} Open this review again to continue: what was checked is not lost.`);
        break;
      }
      setChecks((prev) => {
        const next = new Map(prev);
        for (const r of res.data.results) next.set(r.email, r);
        return next;
      });
    }
    setPhase('review');
  }, []);

  const start = useCallback(async () => {
    cancelled.current = false;
    changed.current = false;
    setPhase('loading');
    setMessage(null);
    setChecks(new Map());
    setSelected(new Set());
    setSuspended(new Set());
    setProblems([]);
    const res = await post<Candidates>({ mode: 'candidates' });
    if (!res.ok) {
      setMessage(res.message);
      setPhase('error');
      return;
    }
    setPlan(res.data);
    if (res.data.candidates.length === 0) setPhase('review');
    else await checkAll(res.data.candidates.map((c) => c.email), res.data.batchSize);
  }, [checkAll]);

  useEffect(() => {
    if (opened) void start();
    return () => {
      cancelled.current = true;
    };
  }, [opened, start]);

  const byEmail = new Map((plan?.candidates ?? []).map((c) => [c.email, c]));
  const left = (plan?.candidates ?? []).filter((c) => checks.get(c.email)?.state === 'left' && !suspended.has(c.email));
  const onPlatform = (plan?.candidates ?? []).filter((c) => checks.get(c.email)?.state === 'on-platform').length;
  const unchecked = (plan?.candidates ?? []).filter((c) => {
    const state = checks.get(c.email)?.state;
    return state === 'error' || state === undefined;
  });
  const chosen = left.filter((c) => selected.has(c.email));
  const chosenAdmins = chosen.filter((c) => c.holdsAdmin).length;

  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const suspend = async () => {
    setConfirming(false);
    if (!plan) return;
    setPhase('suspending');
    setMessage(null);
    const emails = chosen.map((c) => c.email);
    const notDone: SuspendOutcome[] = [];
    for (let i = 0; i < emails.length; i += plan.batchSize) {
      const res = await post<{ results: SuspendOutcome[] }>({ mode: 'suspend', emails: emails.slice(i, i + plan.batchSize) });
      if (!res.ok) {
        setMessage(`${res.message} Nothing further was suspended.`);
        break;
      }
      for (const r of res.data.results) {
        if (r.status === 'suspended') {
          changed.current = true;
          setSuspended((prev) => new Set(prev).add(r.email));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(r.email);
            return next;
          });
        } else notDone.push(r);
      }
    }
    setProblems(notDone);
    setPhase('done');
  };

  const close = () => {
    if (phase === 'suspending') return;
    cancelled.current = true;
    if (changed.current) onChanged();
    setOpened(false);
  };

  const checkedCount = (plan?.candidates ?? []).filter((c) => checks.has(c.email)).length;
  const total = plan?.candidates.length ?? 0;

  return (
    <>
      <Button variant="default" onClick={() => setOpened(true)}>
        Offboarding review
      </Button>

      <Modal opened={opened} onClose={close} title="Offboarding review" size="lg" centered closeOnClickOutside={phase !== 'suspending'}>
        <Stack gap="sm">
          {phase === 'loading' && (
            <Group justify="center" py="lg">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Reading the Organisation Platform…
              </Text>
            </Group>
          )}

          {phase === 'error' && (
            <Alert color="red" variant="light">
              {message}
            </Alert>
          )}

          {plan && phase !== 'loading' && phase !== 'error' && (
            <>
              <Text size="sm">
                {plan.tracked === 0 ? (
                  <>
                    No one has been recorded from the Organisation Platform yet. Run <b>Import from Organisation Platform</b> first: only people an import saw on the platform can be reviewed here.
                  </>
                ) : (
                  <>
                    <b>{plan.tracked}</b> {plan.tracked === 1 ? 'person was' : 'people were'} recorded from the Organisation Platform by an import. Of them, <b>{total}</b> still{' '}
                    {total === 1 ? 'has' : 'have'} an active account here but {total === 1 ? 'is' : 'are'} no longer on its list of {plan.listed} people, and each is checked with the platform individually.
                  </>
                )}
              </Text>

              {phase === 'checking' && (
                <>
                  <Progress value={(checkedCount / Math.max(total, 1)) * 100} animated aria-label="Checking accounts" />
                  <Text size="sm" aria-live="polite">
                    Checking… {checkedCount} of {total}
                  </Text>
                </>
              )}

              {phase !== 'checking' && total === 0 && plan.tracked > 0 && (
                <Alert color="blue" variant="light">
                  Nobody to offboard: everyone recorded is still on the platform’s list, or no longer has an active account here.
                </Alert>
              )}

              {phase !== 'checking' && total > 0 && (
                <>
                  {left.length > 0 && (
                    <Alert color="yellow" variant="light" title="Confirm before suspending">
                      The platform no longer knows these people, which usually means they left, but it can also mean it now holds a different email address for them. Check with their manager first.
                    </Alert>
                  )}
                  {left.length === 0 ? (
                    <Alert color="blue" variant="light">
                      {suspended.size > 0 ? 'No one else to review.' : 'Nobody to offboard: everyone recorded is still on the platform or no longer has an active account.'}
                    </Alert>
                  ) : (
                    <>
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>
                          No longer on the platform ({left.length})
                        </Text>
                        {selected.size > 0 && (
                          <Button variant="subtle" size="compact-sm" onClick={() => setSelected(new Set())}>
                            Clear selection
                          </Button>
                        )}
                      </Group>
                      <Paper withBorder>
                        <ScrollArea.Autosize mah={240} type="auto">
                          <Stack gap={0}>
                            {left.map((c) => (
                              <Group key={c.email} wrap="nowrap" align="flex-start" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                                <Checkbox checked={selected.has(c.email)} onChange={() => toggle(c.email)} aria-label={`Suspend ${c.name}`} mt={2} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <Text size="sm" fw={600}>
                                    {c.name}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {c.email}
                                  </Text>
                                  {c.similar && (
                                    <Text size="xs" c="orange" mt={2}>
                                      Possibly the same person as {c.similar.name} ({c.similar.email}) on the platform.
                                    </Text>
                                  )}
                                </div>
                                {c.holdsAdmin && (
                                  <Badge color="red" variant="light">
                                    Administrator
                                  </Badge>
                                )}
                              </Group>
                            ))}
                          </Stack>
                        </ScrollArea.Autosize>
                      </Paper>
                    </>
                  )}

                  {onPlatform > 0 && (
                    <Text size="xs" c="dimmed">
                      {onPlatform} {onPlatform === 1 ? 'account is' : 'accounts are'} on the platform without a designation. They are not listed.
                    </Text>
                  )}
                  {unchecked.length > 0 && phase !== 'suspending' && (
                    <Alert color="yellow" variant="light">
                      {unchecked.length} {unchecked.length === 1 ? 'account' : 'accounts'} could not be checked, so {unchecked.length === 1 ? 'it is' : 'they are'} not listed. Use “Check again”.
                    </Alert>
                  )}
                </>
              )}

              {phase === 'suspending' && (
                <Text size="sm" aria-live="polite">
                  Suspending…
                </Text>
              )}
              {suspended.size > 0 && (
                <Alert color="green" variant="light">
                  Suspended {suspended.size} {suspended.size === 1 ? 'account' : 'accounts'}. They no longer appear in @mentions and cannot sign in. Use “Reactivate” on the Users page to undo it.
                </Alert>
              )}
              {problems.length > 0 && (
                <Alert color="red" variant="light" title={`${problems.length} not suspended`}>
                  <List size="sm" spacing={2}>
                    {problems.slice(0, 6).map((p) => (
                      <List.Item key={p.email}>
                        {byEmail.get(p.email)?.name ?? p.email}: {p.status === 'refused' ? p.reason : p.status === 'failed' ? p.message : ''}
                      </List.Item>
                    ))}
                  </List>
                </Alert>
              )}
              {message && (
                <Alert color="yellow" variant="light">
                  {message}
                </Alert>
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button variant="default" disabled={phase === 'suspending'} onClick={close}>
              {phase === 'done' || (phase === 'review' && suspended.size > 0) ? 'Close' : 'Cancel'}
            </Button>
            {(phase === 'review' || phase === 'done') && unchecked.length > 0 && plan && (
              <Button variant="default" onClick={() => void checkAll(unchecked.map((c) => c.email), plan.batchSize)}>
                Check {unchecked.length} again
              </Button>
            )}
            {(phase === 'review' || phase === 'done') && chosen.length > 0 && (
              <Button color="red" onClick={() => setConfirming(true)}>
                Suspend {chosen.length} {chosen.length === 1 ? 'person' : 'people'}
              </Button>
            )}
            {phase === 'error' && <Button onClick={() => void start()}>Try again</Button>}
          </Group>
        </Stack>
      </Modal>

      <Modal opened={confirming} onClose={() => setConfirming(false)} title={`Suspend ${chosen.length} ${chosen.length === 1 ? 'person' : 'people'}?`} centered>
        <Stack gap="sm">
          <Text size="sm">
            They are no longer on the Organisation Platform. Suspended accounts disappear from @mentions and can no longer sign in. Their comments and feedback stay as they are and nothing is deleted. You can reactivate anyone on
            the Users page.
          </Text>
          {chosenAdmins > 0 && (
            <Text size="sm">
              <b>
                {chosenAdmins} of them {chosenAdmins === 1 ? 'is an Administrator' : 'are Administrators'}.
              </b>{' '}
              The last administrator is never suspended.
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Roles they hold in tenants are not changed. Review the Members page of any tenant they belonged to.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => void suspend()}>
              Suspend
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
