````instructions
---
name: Chocolate Factory API Reference
description: How to embed a Chocolate Factory chat widget, drive any other AI-powered UI (charts, dashboards, generated documents) from an agent, or build a custom chat interface, using the official SDK once Chocolate Factory is connected via the Buildpad platform's Connectors page
applyTo: "**/*.{ts,tsx,js}"
---

# Chocolate Factory, via the official SDK

This doc assumes Chocolate Factory is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this). Unlike some other providers, Chocolate Factory is **self-hosted per deployment**, so it has no fixed `apiBaseUrl` — its base URL is itself one of its own env vars. `connectors[]` guarantees exactly two: `CHOCOLATE_FACTORY_API_KEY` and `CHOCOLATE_FACTORY_BASE_URL` — always read the exact names from `connectors[]`, don't hardcode them.

**`CHOCOLATE_FACTORY_AGENT_ID` is different — it is *not* in `connectors[]`.** Buildpad never stores or provisions a Chocolate Factory agent (only the org/project shell), so there is nothing for `get_project_detail` to report. The user picks an agent by browsing the Chocolate Factory platform directly and gives you its ID in conversation. If a feature needs an agent and no matching env var exists yet:

1. Ask the user for the Agent ID (and, if this project might use more than one agent for different features, ask what to call this one).
2. Name the env var `CHOCOLATE_FACTORY_AGENT_ID` if this is the first/only agent, or `CHOCOLATE_FACTORY_AGENT_ID_<LABEL>` (e.g. `CHOCOLATE_FACTORY_AGENT_ID_DASHBOARD_SUMMARY`) for an additional one.
3. Set it via `amplify_set_env_vars` + `amplify_redeploy` for the deployed app (see the `amplify-env-vars` skill), and add it to `.env.local` for local dev.

Every code sample below reads `process.env.CHOCOLATE_FACTORY_AGENT_ID` for the common single-agent case — substitute the actual env var name you and the user settled on if there's more than one.

**Running locally (`pnpm dev`):** the same `connectors[]` entry also carries `envVars` — the actual decrypted values, not just the names — for `CHOCOLATE_FACTORY_API_KEY`/`CHOCOLATE_FACTORY_BASE_URL` only. Write them into `.env.local` (don't commit, don't log them) and restart `pnpm dev`, since Next.js only reads `.env.local` at process start. Add the user-supplied `CHOCOLATE_FACTORY_AGENT_ID` value there too.

**Deploying:** connecting Chocolate Factory on the Connectors page only stores the credential in Buildpad — it does **not** push `CHOCOLATE_FACTORY_API_KEY`/`_BASE_URL` to the deployed app's Amplify environment. After adding the widget or an API route that reads them, also push that same `envVars` map with `amplify_set_env_vars` and follow with `amplify_redeploy` (see the `amplify-env-vars` skill) — otherwise the code works locally but the deployed app has no value to read. Include the user-supplied `CHOCOLATE_FACTORY_AGENT_ID` (or `_<LABEL>`) value in that same `amplify_set_env_vars` call — it isn't in `connectors[]`'s `envVars`, so it has to be added alongside it explicitly.

**Important — none of this runs from a DaaS custom service.** Custom services (`create-service` skill) execute as sandboxed JS with no `import`/`require` support, so the npm package can't load there — that sandbox is why Stripe's own reference doc calls the raw REST API instead. Chocolate Factory has an official SDK (`@the-chocolate-factory/sdk`); every pattern below runs from real Next.js code (Client Components and/or server-side API routes), where npm packages and `process.env` are both available.

**Two entry points — pick based on where the code runs.** The main `@the-chocolate-factory/sdk` entry point (the default `ChocolateFactory` class, `ChatClient`, the widget) bundles a browser-only custom element (`class CfChatWidget extends HTMLElement`), so importing it from a Next.js **API route or Server Component** crashes at import time with `ReferenceError: HTMLElement is not defined` — Node has no `HTMLElement` global. Use `@the-chocolate-factory/sdk/server` instead for anything that runs server-side (`AgentClient`, and `ChatClient` if you ever need it outside the browser); it has no DOM dependency. Reserve the main entry point for Client Components (`'use client'`) — the widget and `ChatClient` examples in step 2 and the custom chat UI below.

## 1. Install the SDK

```bash
pnpm add @the-chocolate-factory/sdk
```

## 2. Embed the chat widget (the common case) — credentials stay server-side

**`baseUrl: ''` and `apiKey: 'proxied'` in the widget config below are deliberate, not leftover placeholders** — see the rationale in this section, and the SDK-bug callout in step (b) before "fixing" them.

The chat widget runs in the **browser**, so the SDK would normally need `apiKey`/`agentId`/`baseUrl` client-side. **Default to not doing that.** Chocolate Factory onboarding always issues Buildpad a project-scoped `cf_...` key (see `onboardChocolateFactoryProject` in `src/lib/chocolate-factory/onboarding.ts` — no `agent` object is ever sent, so no narrower `agk_...` key is provisioned this way), and a project key grants access to every agent in the project — so treat the credential as something that must never reach the browser, and route the widget's calls through a backend proxy instead.

This works because `ChatClient`'s URL builder is relative when `baseUrl` is `''` — it calls `/api/agents/<agentId>/run` on whatever origin it's running from. Point that at your own app instead of Chocolate Factory's, and implement that one route as a thin proxy that injects the real key server-side. **Pass `baseUrl: ''` explicitly — don't omit the key entirely** (see why in step (b) below).

### a. The proxy route — this is the actual credential boundary

**This route uses raw `fetch`, not the SDK — that's deliberate, not an oversight.** It isn't "calling an agent"; it's a byte-for-byte reverse proxy for the browser's own `ChatClient` instance (step b below), which already built the exact request body and expects to parse the exact SSE response itself. `ChatClient`/`AgentClient` from `@the-chocolate-factory/sdk/server` don't expose a way to forward an unmodified body in and stream an unmodified response back out — `AgentClient.run({ stream: true })` parses the SSE into plain text chunks (dropping tool-call frames), and `ChatClient` is a full stateful client, not a pass-through. Re-encoding through either would mean decoding the stream just to re-encode it, for no security or correctness benefit over forwarding the bytes as-is. Everywhere else in this doc that actually calls an agent (step 3) goes through `AgentClient` — use that, not raw `fetch`, unless you're building this exact kind of transparent proxy.

```typescript
// app/api/agents/[agentId]/run/route.ts
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  // Ignore whatever agentId a client sends — always target the one this
  // project is actually connected to. Otherwise a tampered request could
  // redirect our real credential at a different agent in the org.
  if (agentId !== process.env.CHOCOLATE_FACTORY_AGENT_ID) {
    return new Response('Not found', { status: 404 });
  }

  const upstream = await fetch(
    `${process.env.CHOCOLATE_FACTORY_BASE_URL}/api/agents/${agentId}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-api-key': process.env.CHOCOLATE_FACTORY_API_KEY!, // real key never leaves the server
      },
      body: await request.text(), // forward the SDK's request body as-is
    }
  );

  // Stream the SSE response straight through — the browser only ever talks to this route.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream' },
  });
}
```

### b. Client code: point the SDK at itself, not at Chocolate Factory

```typescript
// app/api/chocolate-factory/agent-id/route.ts — the only thing the browser needs, and it isn't a secret
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ agentId: process.env.CHOCOLATE_FACTORY_AGENT_ID });
}
```

```tsx
// components/ChocolateFactoryWidget.tsx
'use client';

import { useEffect, useRef } from 'react';
import ChocolateFactory from '@the-chocolate-factory/sdk';

export function ChocolateFactoryWidget() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    fetch('/api/chocolate-factory/agent-id')
      .then((res) => res.json())
      .then(({ agentId }) => {
        const cf = new ChocolateFactory({
          apiKey: 'proxied', // placeholder — ChatClient requires a non-empty apiKey/agentKey,
                              // but the proxy route above ignores whatever is sent and injects
                              // the real key itself, so this value is never checked or forwarded
          agentId,
          // Pass baseUrl explicitly as '' — do NOT omit this key. cf.chat.mount() routes
          // through CfChatWidget.configure(), which rebuilds this config as a fresh object
          // literal naming `baseUrl: cfg.baseUrl`. If baseUrl was never set, that read is
          // `undefined`, but naming it here still creates the key — which then overwrites
          // ChatClient's own '' default via its constructor's object spread, leaving
          // `this.config.baseUrl` as `undefined` and crashing the first message send with
          // "Cannot read properties of undefined (reading 'replace')" inside `_buildUrl()`.
          // An explicit '' survives that spread intact and still resolves to the relative
          // URL we want (/api/agents/<agentId>/run), landing on the proxy route above.
          baseUrl: '',
        });
        cf.chat.mount(document.body, {
          title: 'AI Assistant',
          welcomeMessage: 'Hi! How can I help you today?',
          theme: {
            // Matches this app's own brand color instead of the SDK's default blue.
            // `theme.primaryColor` is applied as a raw CSS custom property
            // (`--cf-primary-color`) on the widget's host element, so a CSS
            // variable *reference* works here, not just a literal color — it
            // resolves through the cascade and stays in sync if the brand
            // color ever changes. Buildpad-generated apps use Mantine, so this
            // is Mantine's own semantic primary-color variable; use whatever
            // this project's actual brand color variable is if it's not Mantine.
            primaryColor: 'var(--mantine-primary-color-filled)',
          },
        });
      });
  }, []);

  return null;
}
```

Render `<ChocolateFactoryWidget />` once near the root layout (e.g. in `app/layout.tsx`). `mount()` accepts more `ChatWidgetConfig` options — `avatarUrl`, `position`, `theme.primaryColor`, `theme.borderRadius`, `initialOpen`, `promptSuggestions` — see the SDK's own `chat-sdk.md` for the full list.

**Why not just fetch the real key into the browser?** Chocolate Factory's own docs do allow it (`docs/authentication.md`: *"For browser chat widgets, the Agent Key is necessarily visible to the end-user... as long as you restrict keys to read-only chat and the agent has appropriate guardrails"*) — but that guidance assumes a narrower, agent-scoped `agk_...` key. Chocolate Factory onboarding only ever issues Buildpad a project-scoped `cf_...` key (see `onboardChocolateFactoryProject` in `src/lib/chocolate-factory/onboarding.ts` — no `agent` object is sent, so no `agk_...` key is provisioned this way), which spans every agent in the project, so the proxy above is this doc's default. (If Chocolate Factory ever issues a properly agent-scoped `agk_...` key through this flow instead, skipping the proxy and fetching credentials straight to the browser becomes a valid alternative — it just isn't the current default.)

## 3. Beyond chat: agent output can drive any UI

`AgentClient.run()` calls the agent as a plain function — text (or `vars`) in, text out; pass `stream: true` for progressive output instead of a single JSON result. The chat widget is just one consumer of that text; the same call works for a dashboard card, a chart, a generated document, a form autofill, an email draft, anything. **The agent's system prompt decides the output shape, not the SDK** — if the UI needs structured data (e.g. to feed a chart), the agent must be instructed (in its own system prompt, configured on the Chocolate Factory side) to respond with well-formed JSON; the SDK itself only ever returns `result.text` as a plain string.

### One-off text generation

```typescript
// app/api/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AgentClient } from '@the-chocolate-factory/sdk/server';

export async function POST(request: NextRequest) {
  const { message, vars } = await request.json();
  const agent = new AgentClient({
    apiKey: process.env.CHOCOLATE_FACTORY_API_KEY,
    agentId: process.env.CHOCOLATE_FACTORY_AGENT_ID,
    baseUrl: process.env.CHOCOLATE_FACTORY_BASE_URL,
  });
  const result = await agent.run({ message, vars }); // { text, usage, finishReason }
  return NextResponse.json(result);
}
```

`agent.run({ message, vars, stream: true })` returns an async generator of text chunks instead, for progressive output (e.g. a document rendering line-by-line as it's generated). (`agent.stream({ message, vars })` still works as a deprecated alias for the same call.)

### Structured output for non-chat UI (e.g. a chart)

Same call, but the agent's system prompt is written to return JSON instead of prose, and the route parses it before handing it to the client:

```typescript
// app/api/sales-summary/route.ts
import { NextResponse } from 'next/server';
import { AgentClient } from '@the-chocolate-factory/sdk/server';

export async function GET() {
  const agent = new AgentClient({
    apiKey: process.env.CHOCOLATE_FACTORY_API_KEY,
    agentId: process.env.CHOCOLATE_FACTORY_AGENT_ID, // configured to respond with JSON only
    baseUrl: process.env.CHOCOLATE_FACTORY_BASE_URL,
  });

  // Template-driven: no `message`, just data — see agent-sdk.md's
  // "Template-driven execution" for when the agent's own prompt is a
  // Handlebars template that only needs runtime vars, not an instruction.
  const result = await agent.run({ vars: { salesData: await getSalesRows() } });

  // { labels: string[], values: number[] } — shape is a contract with
  // that agent's system prompt, not something the SDK enforces.
  const chartData = JSON.parse(result.text);
  return NextResponse.json(chartData);
}
```

The calling component then renders `chartData` with whatever charting/graph library the app already uses — nothing chat-specific about it from here on. Because the SDK doesn't validate the shape, wrap `JSON.parse` in a try/catch and treat a parse failure as the agent misbehaving (bad prompt or model drift), not a client bug.

### Custom chat UI (build your own interface)

If it *is* a chat-style UI but the widget's fixed panel/theme doesn't fit, use `ChatClient` directly instead of `cf.chat.mount(...)` and render the message list yourself. It's event-driven — subscribe with `.on(...)` before calling `send()`, or streamed chunks arrive with nothing listening. Runs in the **browser**, so reuse the exact same proxy route and placeholder-`apiKey`/explicit-`baseUrl: ''` pattern from step 2 rather than fetching real credentials to the client.

```tsx
// components/CustomChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatClient } from '@the-chocolate-factory/sdk';
import type { UIMessage } from '@the-chocolate-factory/sdk';

export function CustomChat() {
  const clientRef = useRef<ChatClient | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    fetch('/api/chocolate-factory/agent-id')
      .then((res) => res.json())
      .then(({ agentId }) => {
        // apiKey is a placeholder and baseUrl is explicit '' for the same reason
        // as the widget in step 2 — calls land on our own /api/agents/[agentId]/run
        // proxy route, which holds the real key, not on Chocolate Factory directly.
        // (This direct-ChatClient path doesn't actually hit the SDK's baseUrl-omission
        // bug from step 2 — that only fires through cf.chat.mount()'s internal
        // CfChatWidget.configure() — but stay consistent so this snippet is never
        // copy-pasted into a mount() call without the fix.)
        const client = new ChatClient({ apiKey: 'proxied', agentId, baseUrl: '' });
        client.on('status-change', ({ status }) => setStreaming(status === 'streaming'));
        client.on('message-chunk', () => setMessages([...client.messages]));
        client.on('message-end', () => setMessages([...client.messages]));
        client.on('error', (e) => console.error('Chat error:', e.error?.message));
        clientRef.current = client;
      });
  }, []);

  const handleSend = async () => {
    if (!clientRef.current || !input.trim()) return;
    const text = input;
    setInput('');
    await clientRef.current.send({ text });
  };

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.parts.map((p, i) => p.type === 'text' && <p key={i}>{p.text}</p>)}
        </div>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)} disabled={streaming} />
      <button onClick={handleSend} disabled={streaming}>Send</button>
    </div>
  );
}
```

`send({ text, vars, conversationId })`: `vars` injects Handlebars template variables into the agent's system prompt, same as `agent.run`'s `vars` above; `conversationId` persists the conversation server-side across sends instead of only in the client's in-memory `chat.messages`. Also available: `clearHistory()`, `loadHistory(messages)` (restore from `localStorage` on mount), `setSessionId(id)`.

### Tool call visibility (`ChatClient`/widget only)

If the agent has MCP tools attached, `ChatClient` (and the pre-built widget, which uses the same events internally) can show which tool ran and with what input/output. **This is not available from `AgentClient`** — `agent.run()`'s JSON response only ever carries `{ text, usage, finishReason }`, and `agent.run({ stream: true })` only extracts plain text deltas from the SSE stream, discarding tool-call frames entirely. So a backend-only integration (step 3 above) has no way to know which tools an agent used; tool visibility requires going through the browser-side chat client.

Two ways to read tool calls off `ChatClient`:

```typescript
// 1. Events, fired on each tool state transition — good for a live "using tool X…" badge.
client.on('tool-start', (e) => {
  console.log(`Started: ${e.tool?.name}`); // input isn't guaranteed populated yet here
});
client.on('tool-end', (e) => {
  // Fires once state reaches output-available / output-error / output-denied.
  console.log(`${e.tool?.name}`, { input: e.tool?.input, output: e.tool?.output, state: e.tool?.state });
});

// 2. Reading it directly off message parts — good for rendering after the fact
// (e.g. re-hydrating from loadHistory()), not just live during a send().
for (const part of message.parts) {
  const isTool = part.type === 'dynamic-tool' || part.type.startsWith('tool-');
  if (!isTool) continue;
  const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);
  console.log(toolName, part.state, part.input, part.output); // part.errorText set if state is output-error
}
```

`state` moves through `input-streaming` → `input-available` → one of `output-available` / `output-error` / `output-denied`. Only trust `input`/`output` once state has reached one of those three terminal values — treat earlier states as still-arriving.

For the server-side `AgentClient` calls above, `apiKey` is the right field to pass the real credential as, regardless of whether the connected key is an org-level `cf_...` key or an agent-scoped `agk_...` key — the SDK sends it as `cf-api-key`, matching how this connector's credential is used everywhere else in this project. `AgentClient` needs no proxy in the first place: it only ever runs from a Next.js API route (never `'use client'`), so the real key never leaves the server to begin with — the proxy pattern in step 2 exists specifically because `ChatClient`/the widget run in the browser. Import it from `@the-chocolate-factory/sdk/server` there, not the main entry point (see the callout right after step 1) — same reasoning, `AgentClient`'s only job is running server-side, and the `/server` entry point is the one build of the SDK that's actually safe to load in Node.

## Errors

`agent.run()` throws on a non-2xx response with a message like `Agent run failed (<status>): <body>` — wrap backend/`AgentClient` calls in try/catch (this also covers the structured-output pattern above: a thrown error means no `result.text` to `JSON.parse`). `ChatClient` surfaces the same failures through its `'error'` event instead of a rejected promise — always wire that listener. The pre-built widget handles its own errors internally (shown inline in the chat panel); no extra handling needed for it.

| Status | Meaning |
|---|---|
| 401 | Missing or invalid `cf-api-key` |
| 403 | Key doesn't have access to this agent |
| 404 | Agent not found |
| 400 | Bad request, or the agent is inactive |
| 500 | Chocolate Factory server error |

## Beyond this

For anything not covered here (widget theming details, the HTML attribute/CDN embed API, `agentPayload` for forwarding extra data to MCP integrations, etc.), see the `@the-chocolate-factory/sdk` package's own docs. This doc bootstraps the common cases — chat widget, agent-as-a-function for any UI, custom chat UI — not a full mirror of the SDK.
````
