---
name: context-engineering
description: Feeds agents the right information at the right time. Use when starting a session, switching tasks, or when output quality drops due to missing context.
---

# Context Engineering

## Overview

Feed AI agents the right information at the right time — rules files, context packing, MCP integrations, and skill activation. The quality of agent output is directly proportional to the quality of context provided. Bad context = bad code.

## When to Use

- Starting a new coding session
- Switching between tasks or features
- Agent output quality is declining (hallucinations, wrong patterns)
- Setting up a new project for AI-assisted development
- Debugging why the agent is making wrong decisions

## Context Hierarchy

```
System Prompt (copilot-instructions.md)
  ├── Core Rules (always active)
  ├── Background Skills (auto-loaded)
  │   ├── daas-platform
  │   ├── authentication-proxy
  │   ├── buildpad-reference
  │   └── hooks-extensions
  └── Active Skills (loaded on demand via /slash commands)
      ├── User-invokable skills
      └── Reference checklists
```

## Context Types

### 1. Rules (Always Active)

Defined in `.github/copilot-instructions.md`:
- Buildpad-First component rule
- Two-tier architecture (Frontend → DaaS → Supabase)
- Server-side proxy pattern
- Backend-first logic
- Phased development

### 2. Skills (On-Demand)

Loaded when the agent detects relevant keywords or via slash commands:
- `/create-collection` → full collection skill
- `/review-code` → review skill + reference checklists
- Background skills auto-loaded for context

### 3. MCP Tools (Live Data)

```
DaaS MCP Server:
  ├── schema → Live collection/field definitions
  ├── items → Real data operations
  ├── permissions → Current RBAC state
  └── extensions → Runtime hooks
  
Buildpad MCP Server:
  ├── list_components → Available components
  ├── get_component → Component source code
  └── generate_form → Form generation from schema
```

### 4. Project Files (Read on Demand)

```
High-value context files:
  ├── .env.local → Actual credentials and URLs
  ├── PHASES.md → Current project progress
  ├── package.json → Dependencies and scripts
  ├── next.config.ts → Build configuration
  └── app/ → Existing code patterns
```

## Context Loading Strategy

### Session Start

1. Read `.env.local` for environment configuration
2. Check `PHASES.md` for current project state
3. Scan `app/` directory structure for existing patterns
4. Load relevant background skills based on task

### Task Switch

1. Commit current work
2. Clear working context (agent memory)
3. Load context for new task
4. Verify understanding before proceeding

### Quality Drop Recovery

When agent output degrades:

```
Output quality dropping?
├── Missing domain knowledge → Load relevant skill SKILL.md
├── Wrong component patterns → Load buildpad-reference skill
├── Wrong API patterns → Load daas-platform skill
├── Wrong auth patterns → Load authentication-proxy skill
├── Stale schema → Query DaaS MCP for current schema
└── Context overflow → Summarize and restart with fresh context
```

## Best Practices

1. **Progressive disclosure** — Load skills only when needed, not all at once
2. **MCP over assumptions** — Query live data instead of guessing schema/state
3. **Verify before acting** — Read existing code before modifying
4. **Explicit context** — Tell the agent what you're working on and what phase you're in
5. **Reference, don't duplicate** — Point to skill files instead of pasting content

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The agent should just know this" | Agents have no persistent memory. Provide context every session. |
| "Loading skills is slow" | Loading the wrong skill wastes more time than loading the right one. |
| "I'll just tell it what to do" | Structured skills produce more consistent output than ad-hoc instructions. |
| "MCP is overkill" | MCP provides live data. Hardcoded assumptions become stale. |

## Verification

- [ ] Agent output follows project conventions
- [ ] Buildpad components used instead of raw Mantine
- [ ] API calls go through proxy pattern
- [ ] Generated code matches existing patterns in the project
- [ ] MCP tools used for live schema/permission data
