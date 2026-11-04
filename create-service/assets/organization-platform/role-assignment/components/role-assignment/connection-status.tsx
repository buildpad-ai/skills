// buildpad-backend-file: supabase
'use client';

/**
 * Is the Xtremax connection working? A read-only status line for global Administrators.
 *
 * The connection is a server setting (platform address and API key in the environment),
 * so this only reports whether the configured key reaches the Xtremax root. It never shows
 * or accepts the key. Everyone else sees nothing: the status route answers 403 and this
 * renders nothing.
 */

import { useEffect, useState } from 'react';
import { Alert } from '@mantine/core';
import { call } from './api';

interface Status {
  configured: boolean;
  placementEnabled: boolean;
  reachable: boolean;
  rootName: string | null;
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<Status>('/api/admin/org-platform/status')
      .then((res) => {
        if (!cancelled && res.ok && res.body?.data) setStatus(res.body.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  if (!status.configured) {
    return (
      <Alert color="yellow" mt="md" variant="light" title="Xtremax connection">
        Not configured. Set the Organisation Platform address and API key in the server settings.
      </Alert>
    );
  }
  if (!status.reachable) {
    return (
      <Alert color="red" mt="md" variant="light" title="Xtremax connection">
        The configured key could not reach the Organisation Platform.
      </Alert>
    );
  }
  return (
    <Alert color="green" mt="md" variant="light" title="Xtremax connection">
      Connected{status.rootName ? ` to ${status.rootName}` : ''}.{' '}
      {status.placementEnabled ? 'People are placed by these rules when they sign in.' : 'Placement at sign-in is switched off, so rules are saved but nobody is placed yet.'}
    </Alert>
  );
}
