// buildpad-backend-file: supabase
'use client';

/**
 * useRuleBook: the active tenant's rule set, loaded once and saved with the version it
 * was loaded at.
 *
 * Every change the pages make (a toggle, a reorder, a deleted rule, a saved rule) is the
 * whole rule set sent back through `commit`. The server re-validates it, and refuses it
 * with 409 when someone else saved first, in which case nothing here is overwritten and
 * the page offers a reload instead.
 *
 * The data is the active tenant's, so it is read again when the tenant changes. Saving
 * always goes to the tenant the session names, never to the one a stale page was showing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { RuleSet } from '@xtremax/organisation-platform/engine';
import { useScope } from '@/lib/contexts/ScopeContext';
import { call, failureMessage } from './api';
import { RULES_API, RULES_TEXT } from './config';
import type { RuleBookData } from './types';

export type CommitResult = { ok: true } | { ok: false; reason: 'conflict' | 'refused' | 'busy'; message: string };

export function useRuleBook() {
  const { resourceUri, isLoading: scopeLoading } = useScope();
  const tenantUri = resourceUri ?? null;

  const [data, setData] = useState<RuleBookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  // One save at a time: a second click before the first answers would carry a version that is already stale.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await call<RuleBookData>(RULES_API).catch(() => null);
    if (!res || !res.ok || !res.body?.data) {
      setData(null);
      setError(res?.status === 403 ? RULES_TEXT.noPermission : (res?.body?.error ?? 'Could not load the rules.'));
      return;
    }
    setData(res.body.data);
    setConflict(false);
  }, []);

  useEffect(() => {
    if (scopeLoading) return;
    setData(null);
    void load();
  }, [scopeLoading, tenantUri, load]);

  const commit = useCallback(
    async (rules: RuleSet): Promise<CommitResult> => {
      if (!data) return { ok: false, reason: 'refused', message: 'The rules have not loaded.' };
      if (inFlight.current) return { ok: false, reason: 'busy', message: 'A save is already in progress.' };
      inFlight.current = true;
      setSaving(true);
      try {
        const res = await call<{ version: number; rules: RuleSet }>(RULES_API, {
          method: 'PUT',
          body: JSON.stringify({ rules, baseVersion: data.version }),
        });
        if (res.ok && res.body?.data) {
          const saved = res.body.data;
          setData((current) => (current ? { ...current, version: saved.version, rules: saved.rules, problem: null } : current));
          return { ok: true };
        }
        if (res.status === 409) {
          setConflict(true);
          return { ok: false, reason: 'conflict', message: res.body?.error ?? 'Someone else changed the rules.' };
        }
        const message = failureMessage(res, 'Could not save the rules.');
        notifications.show({ color: 'red', title: 'Not saved', message });
        return { ok: false, reason: 'refused', message };
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [data]
  );

  // Without the live lists a condition could look like it names something it does not, so editing waits for them.
  const editable = !!data && data.provisioned && data.configured && data.catalogs !== null && !conflict && !saving;

  return { data, error, conflict, saving, editable, load, commit, tenantUri };
}
