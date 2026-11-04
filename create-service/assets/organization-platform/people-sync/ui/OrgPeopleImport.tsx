// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
'use client';

import { useCallback, useRef, useState } from 'react';
import { Alert, Button, Group, List, Loader, Modal, Progress, ScrollArea, Stack, Text } from '@mantine/core';
import { IconUsersGroup } from '@tabler/icons-react';

interface Preview {
  total: number;
  toCreate: string[];
  existing: number;
  skipped: { email: string; reason: 'invalid' | 'system-or-test' }[];
  withoutEmail: number;
  batchSize: number;
}

type Outcome =
  | { email: string; status: 'created'; name: string }
  | { email: string; status: 'existing' }
  | { email: string; status: 'not-listed' }
  | { email: string; status: 'failed'; message: string };

type Phase = 'loading' | 'preview' | 'running' | 'done' | 'error';

async function post<T>(body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/admin/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json.error ?? 'Something went wrong.' };
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, message: 'Could not reach the server.' };
  }
}

/**
 * Import Xtremax people from the Organisation Platform so they can be @mentioned before they have signed in.
 * Shows a preview first and creates nothing until the Administrator confirms. The browser sends the people to
 * create in small batches; the server checks each one against the platform again, so this list is only a request.
 */
export function OrgPeopleImport({ onImported }: { onImported: () => void }) {
  const [opened, setOpened] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [stoppedEarly, setStoppedEarly] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cancelled = useRef(false);

  const loadPreview = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setOutcomes([]);
    setStoppedEarly(false);
    setNote(null);
    const res = await post<Preview>({ mode: 'preview' });
    if (!res.ok) {
      setError(res.message);
      setPhase('error');
      return;
    }
    setPreview(res.data);
    setPhase('preview');
  }, []);

  const open = () => {
    cancelled.current = false;
    setOpened(true);
    void loadPreview();
  };

  const close = () => {
    cancelled.current = true;
    setOpened(false);
    if (outcomes.some((o) => o.status === 'created')) onImported();
  };

  const run = async () => {
    if (!preview) return;
    cancelled.current = false;
    setPhase('running');
    setOutcomes([]);
    setStoppedEarly(false);
    for (let i = 0; i < preview.toCreate.length; i += preview.batchSize) {
      if (cancelled.current) {
        setStoppedEarly(true);
        break;
      }
      const batch = preview.toCreate.slice(i, i + preview.batchSize);
      const res = await post<{ results: Outcome[] }>({ mode: 'run', emails: batch });
      if (!res.ok) {
        setError(res.message);
        setStoppedEarly(true);
        break;
      }
      setOutcomes((current) => [...current, ...res.data.results]);
    }
    // Remember the listed people who already had an account too, so a later Offboarding review can see them. Best-effort.
    await post<{ recorded: number }>({ mode: 'record-existing' });
    setPhase('done');
    onImported();
  };

  /** Nothing to create, but people already here are listed: just remember them. */
  const recordOnly = async () => {
    setPhase('running');
    const res = await post<{ recorded: number }>({ mode: 'record-existing' });
    setNote(res.ok ? `Recorded ${res.data.recorded} ${res.data.recorded === 1 ? 'person' : 'people'} who already have accounts as listed on the platform.` : res.message);
    setPhase('done');
  };

  const created = outcomes.filter((o) => o.status === 'created').length;
  const failed = outcomes.filter((o): o is Extract<Outcome, { status: 'failed' }> => o.status === 'failed');
  const existingNow = outcomes.filter((o) => o.status === 'existing').length;
  const total = preview?.toCreate.length ?? 0;

  return (
    <>
      <Button variant="default" leftSection={<IconUsersGroup size={16} />} onClick={open}>
        Import from Organisation Platform
      </Button>

      <Modal opened={opened} onClose={close} title="Import from the Organisation Platform" size="lg" centered closeOnClickOutside={phase !== 'running'}>
        <Stack gap="sm">
          {phase === 'loading' && (
            <Group justify="center" py="lg">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Reading who is listed…
              </Text>
            </Group>
          )}

          {phase === 'error' && (
            <>
              <Alert color="red" variant="light">
                {error}
              </Alert>
              <Group justify="flex-end">
                <Button variant="default" onClick={close}>
                  Close
                </Button>
                <Button onClick={() => void loadPreview()}>Try again</Button>
              </Group>
            </>
          )}

          {phase === 'preview' && preview && (
            <>
              <Text size="sm">
                The Organisation Platform lists <b>{preview.total}</b> people who hold a designation.{' '}
                <b>{preview.toCreate.length}</b> of them do not have a getFeedback account yet; <b>{preview.existing}</b> already do
                {preview.skipped.length > 0 ? `, and ${preview.skipped.length} are skipped.` : '.'} Nothing has been created.
              </Text>
              <Alert color="blue" variant="light">
                Each person is added so they can be @mentioned. They get no tenant role, and sign in later through MyApps onto the same account.
                Everyone added will appear in the mention list for all users.
              </Alert>

              {preview.toCreate.length > 0 ? (
                <>
                  <Text size="sm" fw={600}>
                    Will be added ({preview.toCreate.length})
                  </Text>
                  <ScrollArea.Autosize mah={240} type="auto">
                    <List size="sm" spacing={2} withPadding>
                      {preview.toCreate.map((email) => (
                        <List.Item key={email}>{email}</List.Item>
                      ))}
                    </List>
                  </ScrollArea.Autosize>
                </>
              ) : (
                <Alert color="green" variant="light">
                  Everyone listed already has an account. There is nothing to add.
                  {preview.existing > 0 && ' You can still record them as listed on the platform, so the Offboarding review can notice if they later leave.'}
                </Alert>
              )}

              {(preview.skipped.length > 0 || preview.withoutEmail > 0) && (
                <Text size="xs" c="dimmed">
                  Skipped: {preview.skipped.filter((s) => s.reason === 'system-or-test').length} system or test accounts,{' '}
                  {preview.skipped.filter((s) => s.reason === 'invalid').length} invalid addresses, {preview.withoutEmail} assignments with no email.
                </Text>
              )}

              <Group justify="flex-end">
                <Button variant="default" onClick={close}>
                  Cancel
                </Button>
                {preview.toCreate.length === 0 && preview.existing > 0 && (
                  <Button variant="default" onClick={() => void recordOnly()}>
                    Record {preview.existing} {preview.existing === 1 ? 'person' : 'people'} as listed
                  </Button>
                )}
                <Button disabled={preview.toCreate.length === 0} onClick={() => void run()}>
                  Add {preview.toCreate.length} {preview.toCreate.length === 1 ? 'person' : 'people'}
                </Button>
              </Group>
            </>
          )}

          {(phase === 'running' || phase === 'done') && (
            <>
              <Progress value={total === 0 ? 100 : (outcomes.length / total) * 100} animated={phase === 'running'} />
              <Text size="sm">
                {phase === 'running' ? 'Adding people… ' : ''}
                {outcomes.length} of {total} processed: <b>{created}</b> added
                {existingNow > 0 ? `, ${existingNow} already existed` : ''}
                {failed.length > 0 ? `, ${failed.length} could not be added` : ''}.
              </Text>

              {phase === 'running' && (
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    onClick={() => {
                      cancelled.current = true;
                    }}
                  >
                    Stop after this batch
                  </Button>
                </Group>
              )}

              {phase === 'done' && (
                <>
                  {note && (
                    <Alert color="green" variant="light">
                      {note}
                    </Alert>
                  )}
                  {error && (
                    <Alert color="red" variant="light">
                      {error} The import stopped early; run it again to continue. Everyone already added is kept.
                    </Alert>
                  )}
                  {!error && stoppedEarly && (
                    <Alert color="yellow" variant="light">
                      Stopped early. Run the import again to add the rest.
                    </Alert>
                  )}
                  {failed.length > 0 && (
                    <Alert color="orange" variant="light" title="Could not be added">
                      <List size="sm" spacing={2}>
                        {failed.map((f) => (
                          <List.Item key={f.email}>
                            {f.email}: {f.message}
                          </List.Item>
                        ))}
                      </List>
                      <Text size="xs" mt={6}>
                        Running the import again retries these and skips everyone already added.
                      </Text>
                    </Alert>
                  )}
                  <Group justify="flex-end">
                    <Button onClick={close}>Done</Button>
                  </Group>
                </>
              )}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
