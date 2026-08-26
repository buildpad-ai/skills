---
name: buildpad-hol-guard
description: Protect state-changing Buildpad development workflows with HOL Guard on supported local AI coding-agent harnesses. Use before agent-run migrations, deployments, auth or permission changes, data mutations, external integrations, and destructive shell or CLI work.
---

# HOL Guard Runtime Safety for Buildpad

Use HOL Guard as a local pre-tool runtime protection layer for supported AI coding-agent harnesses before high-impact Buildpad work. This complements Buildpad's existing security, authorization, validation, testing, backup, and review controls. It does not replace them.

## When to Use

Enable this skill before an agent performs work such as:

- schema migrations, seeds, resets, or other database mutations
- authentication, RBAC, OAuth, permission, or scope changes
- state-changing API or admin operations
- deployment, environment, worker, queue, or integration changes
- destructive shell, package, filesystem, or infrastructure commands

For read-only design, documentation, and inspection work, keep using the normal Buildpad skills unless the user specifically asks for Guard setup or evidence.

## Install and Protect the Current Harness

If `hol-guard` is missing, prefer an isolated CLI install:

```bash
pipx install hol-guard
```

Detect the local harness rather than maintaining a hard-coded harness list:

```bash
hol-guard status
hol-guard detect --json
```

Then use the exact harness identifier reported by `hol-guard detect --json`:

```bash
hol-guard bootstrap
hol-guard install <detected-harness>
hol-guard run <detected-harness> --dry-run
hol-guard run <detected-harness>
hol-guard status
```

Do not claim the workspace is protected until a HOL Guard command proves the active status. Prefer Guard-owned setup commands over hand-editing harness configuration.

## Buildpad Workflow

1. Inspect `git status --short` and preserve existing user changes.
2. Run `hol-guard detect --json` and confirm the agent's actual harness.
3. Install or repair protection with HOL Guard if needed.
4. Run the supported harness through HOL Guard before starting the state-changing Buildpad workflow.
5. Continue to obey the relevant Buildpad skill, DaaS permission model, validation, tests, previews, backups, and human-approval requirements.
6. If Guard blocks or queues a request, stop the downstream mutation and review the request instead of bypassing the decision.
7. Verify both the Buildpad result and the Guard evidence after the operation.

## Approval and Evidence

When Guard blocks or queues work:

```bash
hol-guard approvals
hol-guard approvals open
hol-guard receipts
hol-guard diff <detected-harness>
```

Only approve after reviewing the risk reason and requested scope. Never bypass a Guard approval or represent a queued request as completed.

For post-change evidence:

```bash
hol-guard status
hol-guard receipts
git status --short
```

Report which Guard command ran, what Guard found, what remains blocked or risky, and what Buildpad-native verification was completed.

## Boundaries

- HOL Guard protects supported local AI harness tool execution. It is not a replacement for Buildpad backend authorization, RBAC, validation, backups, tests, or deployment controls.
- Do not claim that Guard intercepts a Buildpad service directly unless the active harness integration proves that path.
- Never read or expose `.env` contents or secrets to prove Guard setup.
- Do not manually edit user-level harness configuration when a HOL Guard command owns the mutation.
- Treat Guard errors or unavailable protection as a reason to stop high-impact agent mutations until the boundary is restored or the user explicitly chooses another safe path.
