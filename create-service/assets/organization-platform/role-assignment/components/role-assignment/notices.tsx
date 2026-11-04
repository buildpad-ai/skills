// buildpad-backend-file: supabase
'use client';

/**
 * The banners every Role assignment page shows when the rules cannot safely be edited,
 * so the reason is always said rather than the controls just not working.
 */

import { Alert } from '@mantine/core';
import { rowAction } from './tokens';
import type { RuleBookData } from './types';

export function RuleBookNotices({ data, conflict, onReload }: { data: RuleBookData; conflict: boolean; onReload: () => void }) {
  return (
    <>
      {!data.provisioned && (
        <Alert color="yellow" mt="md" variant="light" title="Not set up here yet">
          Rule storage has not been set up on this deployment, so rules cannot be saved yet.
        </Alert>
      )}
      {!data.configured && (
        <Alert color="yellow" mt="md" variant="light" title="Xtremax connection not configured">
          This deployment is not connected to the Organisation Platform yet, so there are no designations or units to write rules about. Ask whoever manages the server settings to add the connection.
        </Alert>
      )}
      {data.catalogError && (
        <Alert color="red" mt="md" variant="light" title="Editing is paused">
          {data.catalogError}. The rules are shown read-only until the Organisation Platform can be reached, so nothing is saved against a partial list.
        </Alert>
      )}
      {data.problem && (
        <Alert color="red" mt="md" variant="light" title="The saved rules were set aside">
          They could not be used ({data.problem}), so they make no decisions and nobody loses a role because of them. Saving replaces them.
        </Alert>
      )}
      {conflict && (
        <Alert color="orange" mt="md" variant="light" title="Someone else changed the rules">
          Your change was not saved.{' '}
          <button type="button" style={rowAction} onClick={onReload}>
            Reload to see their version
          </button>
        </Alert>
      )}
    </>
  );
}
