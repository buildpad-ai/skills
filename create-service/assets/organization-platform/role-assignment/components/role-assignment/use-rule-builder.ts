// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
'use client';

/**
 * useRuleBuilder: the package's headless rule builder as React state.
 *
 * The store owns the rules being edited and every edit method returns whether it
 * changed anything; the snapshot it publishes is frozen and replaced on every change,
 * so `useSyncExternalStore` re-renders exactly when something changed.
 */

import { useState, useSyncExternalStore } from 'react';
import { createRuleBuilder, type BuilderConfig, type BuilderState, type RuleBuilder } from '@xtremax/organisation-platform/builder-core';
import type { RuleSet } from '@xtremax/organisation-platform/engine';

export function useRuleBuilder(config: BuilderConfig, value: RuleSet, init?: (builder: RuleBuilder) => void): { builder: RuleBuilder; state: BuilderState } {
  // Made once per mount. A page that must start over (another tenant, a reload) remounts this with a key.
  const [builder] = useState(() => {
    const created = createRuleBuilder({ config, value });
    init?.(created);
    return created;
  });
  const state = useSyncExternalStore(builder.subscribe, builder.getState, builder.getState);
  return { builder, state };
}
