````instructions
---
name: Chocolate Factory API Reference
description: How to embed a Chocolate Factory chat widget, drive any other AI-powered UI (charts, dashboards, generated documents) from an agent, or build a custom chat interface, by calling the raw `/api/agents/{agentId}/run` HTTP endpoint directly — no SDK — once Chocolate Factory is connected via the Buildpad platform's Connectors page
applyTo: "**/*.{ts,tsx,js}"
---

# Chocolate Factory, via the raw Run Endpoint (no SDK)

This doc assumes Chocolate Factory is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this). Unlike some other providers, Chocolate Factory is **self-hosted per deployment**, so it has no fixed `apiBaseUrl` — its base URL is itself one of its own env vars. `connectors[]` guarantees exactly two: `CHOCOLATE_FACTORY_API_KEY` and `CHOCOLATE_FACTORY_BASE_URL` — always read the exact names from `connectors[]`, don't hardcode them.

**`CHOCOLATE_FACTORY_AGENT_ID` is different — it is *not* in `connectors[]`.** Buildpad never stores or provisions a Chocolate Factory agent (only the org/project shell), so there is nothing for `get_project_detail` to report. The user picks an agent by browsing the Chocolate Factory platform directly and gives you its ID in conversation. If a feature needs an agent and no matching env var exists yet:

1. Ask the user for the Agent ID (and, if this project might use more than one agent for different features, ask what to call this one).
2. Name the env var `CHOCOLATE_FACTORY_AGENT_ID` if this is the first/only agent, or `CHOCOLATE_FACTORY_AGENT_ID_<LABEL>` (e.g. `CHOCOLATE_FACTORY_AGENT_ID_DASHBOARD_SUMMARY`) for an additional one.
3. Set it via `amplify_set_env_vars` + `amplify_redeploy` for the deployed app (see the `amplify-env-vars` skill), and add it to `.env.local` for local dev.

Every code sample below reads `process.env.CHOCOLATE_FACTORY_AGENT_ID` for the common single-agent case — substitute the actual env var name you and the user settled on if there's more than one.

**Running locally (`pnpm dev`):** the same `connectors[]` entry also carries `envVars` — the actual decrypted values, not just the names — for `CHOCOLATE_FACTORY_API_KEY`/`CHOCOLATE_FACTORY_BASE_URL` only. Write them into `.env.local` (don't commit, don't log them) and restart `pnpm dev`, since Next.js only reads `.env.local` at process start. Add the user-supplied `CHOCOLATE_FACTORY_AGENT_ID` value there too.

**Deploying:** connecting Chocolate Factory on the Connectors page only stores the credential in Buildpad — it does **not** push `CHOCOLATE_FACTORY_API_KEY`/`_BASE_URL` to the deployed app's Amplify environment. After adding any code that reads them, also push that same `envVars` map with `amplify_set_env_vars` and follow with `amplify_redeploy` (see the `amplify-env-vars` skill) — otherwise the code works locally but the deployed app has no value to read. Include the user-supplied `CHOCOLATE_FACTORY_AGENT_ID` (or `_<LABEL>`) value in that same `amplify_set_env_vars` call — it isn't in `connectors[]`'s `envVars`, so it has to be added alongside it explicitly.

## No official SDK — call the HTTP endpoint directly

There is exactly one HTTP entry point: `POST /api/agents/{agentId}/run` on `CHOCOLATE_FACTORY_BASE_URL`. Do **not** add `@the-chocolate-factory/sdk` (or any wrapper package) as a dependency — this project calls the endpoint with plain `fetch`, both from server-side API routes and directly from the browser. That keeps the integration to zero extra npm dependencies and avoids being coupled to an SDK's own bundling assumptions (e.g. browser-only custom elements that crash if ever imported server-side).

### Headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | `application/json`, or `multipart/form-data` for file uploads |
| `Accept` | No | `application/json` (default) or `text/event-stream` |
| `cf-api-key` | Yes (machine-to-machine) | The project-scoped `cf_...` key from `connectors[]` |

`Authorization: Bearer <supabase_jwt>` is the alternative auth mode for platform users with an active Supabase session — not the default for a Buildpad app calling its own connected agent; use `cf-api-key` unless the user asks specifically for platform-user auth.

### Request body — three execution modes, chosen by which field you send

| Field | Modes | Description |
|---|---|---|
| `message` | 1 (persisted) | Latest user turn only; Chocolate Factory loads/persists history server-side keyed by `conversationId` |
| `messages` | 2 (stateless) | Full client-owned transcript, sent in full on every request; nothing stored server-side |
| `conversationId` | 1 | Optional UUID; omit on the first turn, then reuse the `conversationId` the first response returned |
| `vars` | 1, 2, 3 | Template variables injected into the agent's system prompt; can combine with `message`/`messages` or be sent alone (Mode 3: prompt-only, no user turn) |

Provide either `message` or `messages`, never both. Default to **Mode 1 (persisted)** for a chat UI — it's the simplest to wire (no client-side transcript management) and matches what Chocolate Factory's own `/monitoring` dashboard expects for threaded conversations.

### Response — always request `Accept: application/json` in this project

```json
{
  "text": "Generated output from the agent",
  "usage": { "inputTokens": 123, "outputTokens": 456, "totalTokens": 579 },
  "finishReason": "stop",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`text/event-stream` (SSE, the AI SDK UI Message Stream protocol) is the other option the endpoint supports, and it's what a hand-rolled chat widget reaches for to get progressive token-by-token output. Whether it's safe to use depends entirely on where the call happens — see the Amplify caveat below:

- **Direct from the browser** (no Next.js API route in the path) — SSE is fine. There's no Lambda buffering the stream, so a chat widget can request `Accept: text/event-stream` and render deltas as they arrive.
- **Routed through a Next.js API route** — always `Accept: application/json`, never SSE. Amplify's Lambda buffers the whole response before the caller sees anything, so a "stream" proxied this way just arrives all at once anyway, and a slow one can hit the Lambda's own timeout first. Render `data.text` once the full JSON response arrives.

## 🔴 Amplify caveat — this is why the pattern below looks the way it does

Buildpad apps deploy to **AWS Amplify Hosting**, which runs Next.js API routes as Lambda functions with two properties that break the "obvious" integration:

1. **Buffered invocation.** Nothing reaches the caller until the Lambda function returns — there is no streaming-response invoke mode exposed. An SSE stream proxied through a Next.js API route accumulates silently inside the Lambda instead of trickling out chunk-by-chunk, so a chat UI built around `Accept: text/event-stream` through a proxy route works in `pnpm dev` (Node's dev server writes straight to the socket) and then **breaks in production** the moment a response takes more than an instant.
2. **~30 second hard timeout.** Whether streamed or not, a Lambda-backed API route that takes too long to resolve dies as a raw 500 (the Lambda's own timeout) or a 504 (Amplify's SSR layer cutting off a slow response first).

**The fix: call `CHOCOLATE_FACTORY_BASE_URL` directly from the browser and skip both problems at once** — no Lambda sits in the request path at all, so there's nothing to buffer and nothing to time out mid-response (Chocolate Factory's own server still has to finish generating within whatever its own timeout is, but that's outside Amplify's 30s Lambda budget entirely). This is the default for chat UI. Because there's no Lambda in the path, the browser is also free to request `Accept: text/event-stream` for progressive rendering — that's the one place in this doc where SSE is the recommended choice, not just a tolerated one.

**The tradeoff, accepted deliberately:** `CHOCOLATE_FACTORY_API_KEY` is exposed to any client that loads the page. It's the project-scoped `cf_...` key (grants access to every agent in the project, not narrowed to one agent) — tell the user this explicitly if they haven't already accepted it; it's a real security tradeoff, not a formality. A proxy route that injects the key server-side would avoid this, but only works for calls that reliably finish well under ~30s **and never stream** — see "When a server-side proxy is still fine" below.

### The pattern: a tiny env route + direct fetch from the browser

Don't inline credentials into the client bundle as `NEXT_PUBLIC_*` vars — that bakes them into the build rather than reading live env state. Instead, expose them through a route the browser calls once on mount:

```typescript
// app/api/chocolate-factory/env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    baseUrl: process.env.CHOCOLATE_FACTORY_BASE_URL,
    apiKey: process.env.CHOCOLATE_FACTORY_API_KEY,
    agentId: process.env.CHOCOLATE_FACTORY_AGENT_ID,
  });
}
```

Then call the run endpoint straight from the client component, with plain `fetch` — no SDK:

```tsx
// components/ChocolateFactoryChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export function ChocolateFactoryChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const configRef = useRef<{ baseUrl: string; apiKey: string; agentId: string } | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    fetch('/api/chocolate-factory/env')
      .then((res) => res.json())
      .then((config) => { configRef.current = config; });
  }, []);

  async function send(text: string) {
    const config = configRef.current;
    if (!config || sending) return;
    setSending(true);
    setTurns((prev) => [...prev, { role: 'user', text }]);

    // Add an empty assistant turn and append streamed deltas into it.
    let assistantIndex = -1;
    setTurns((prev) => { assistantIndex = prev.length; return [...prev, { role: 'assistant', text: '' }]; });

    try {
      const res = await fetch(`${config.baseUrl}/api/agents/${config.agentId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream', // browser-direct call — SSE is fine here, see Amplify caveat above
          'cf-api-key': config.apiKey,
        },
        body: JSON.stringify({
          conversationId: conversationIdRef.current, // undefined on the first turn
          message: { role: 'user', parts: [{ type: 'text', text }] },
        }),
      });

      const headerConversationId = res.headers.get('X-Conversation-Id');
      if (headerConversationId) conversationIdRef.current = headerConversationId;
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          const chunk = JSON.parse(payload);
          if (chunk.conversationId) conversationIdRef.current = chunk.conversationId;
          const delta = chunk.delta ?? chunk.textDelta;
          if (typeof delta === 'string') {
            setTurns((prev) => {
              const next = [...prev];
              next[assistantIndex] = { ...next[assistantIndex], text: next[assistantIndex].text + delta };
              return next;
            });
          }
        }
      }
    } finally {
      setSending(false);
    }
  }

  // ...render `turns`, an input, and call send(input) on submit
  return null;
}
```

`conversationId` can come back either as the `X-Conversation-Id` response header (readable as soon as headers arrive, before the body finishes streaming) or as a field on an individual SSE chunk — check both, since which one the agent actually sends isn't guaranteed by this doc. Store it (a `ref`, component state, or `localStorage` if the conversation should survive a refresh) and echo it back on every later turn so Chocolate Factory appends to the same conversation record instead of starting a new one each time — this is what makes the exchange show up as one thread in Chocolate Factory's own `/monitoring` dashboard.

The exact SSE chunk shape isn't nailed down by this doc beyond "AI SDK UI Message Stream protocol" — `delta`/`textDelta` above is a best-effort field-name guess. Wrap chunk parsing in try/catch and skip frames that don't match rather than crashing the stream, and verify the actual field names against a real agent response before shipping.

Render this component directly on the page where the chat should appear (e.g. the dashboard home page) — no special mount point needed, since this is a plain React component, not a custom-element widget.

### When a server-side proxy route is still fine

The direct-from-browser pattern above is the default for chat. A server-side call is still fine — and keeps the credential off the browser, which is strictly better when it works — for a **one-off, non-streaming** call that reliably finishes in a few seconds: a dashboard summary, a generated description, a template-driven document. Route it through a normal API route with `Accept: application/json` and don't stream — see the Amplify caveat above for why a server-routed call can't use SSE the way the browser-direct chat widget does:

```typescript
// app/api/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { message, vars } = await request.json();

  const res = await fetch(
    `${process.env.CHOCOLATE_FACTORY_BASE_URL}/api/agents/${process.env.CHOCOLATE_FACTORY_AGENT_ID}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'cf-api-key': process.env.CHOCOLATE_FACTORY_API_KEY!,
      },
      body: JSON.stringify({ message, vars }),
    }
  );

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error }, { status: res.status });
  return NextResponse.json(data); // { text, usage, finishReason, conversationId }
}
```

Never route a `text/event-stream` request through a Next.js API route — that's exactly the pattern the Amplify caveat above rules out.

### Structured output for non-chat UI (e.g. a chart)

Same endpoint, `vars`-only (Mode 3, no `message`/`messages`), and the agent's system prompt (configured on the Chocolate Factory side, not something this doc controls) is written to return JSON instead of prose:

```typescript
// app/api/sales-summary/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(
    `${process.env.CHOCOLATE_FACTORY_BASE_URL}/api/agents/${process.env.CHOCOLATE_FACTORY_AGENT_ID}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'cf-api-key': process.env.CHOCOLATE_FACTORY_API_KEY!,
      },
      // Template-driven: no `message`/`messages`, just vars — the agent's own
      // system prompt is a Handlebars template that only needs runtime vars.
      body: JSON.stringify({ vars: { salesData: await getSalesRows() } }),
    }
  );

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error }, { status: res.status });

  // { labels: string[], values: number[] } — shape is a contract with
  // that agent's system prompt, not something the endpoint enforces.
  const chartData = JSON.parse(data.text);
  return NextResponse.json(chartData);
}
```

Because the endpoint doesn't validate the shape of `text`, wrap `JSON.parse` in a try/catch and treat a parse failure as the agent misbehaving (bad prompt or model drift), not a client bug.

## File attachments

Attach files as `FileUIPart` entries in the `parts` array of `message` (or the last item of `messages`):

```json
{
  "type": "file",
  "url": "https://example.com/report.pdf",
  "filename": "report.pdf",
  "mediaType": "application/pdf"
}
```

`url` is either an HTTPS URL to an already-hosted file, or a `data:` URL (base64) that Chocolate Factory uploads server-side automatically. Supported: JPEG/PNG/GIF/WebP images and PDF/TXT/MD/DOCX/XLSX/XLS documents, 25MB max per file.

## Errors

A non-2xx response has a JSON body shaped `{ "error": "..." }` — always check `res.ok` before reading `data.text`, and surface `data.error` to the user/log rather than a generic message.

| Status | Meaning |
|---|---|
| 400 | Bad request — agent inactive, or both/neither of `message`/`messages` provided |
| 401 | Missing or invalid `cf-api-key` |
| 403 | Key doesn't have access to this agent |
| 404 | Agent not found |
| 500 | Chocolate Factory server error |

## Beyond this

For anything not covered here (the `x-agent-payload` header for forwarding extra data to MCP integrations, retrieving stored history via `GET /api/agents/{agentId}/conversations/{conversationId}`, multipart file uploads from non-browser callers, etc.), consult Chocolate Factory's own Run Endpoint reference. This doc bootstraps the common cases for a Buildpad/Amplify app — direct-from-browser streaming chat, a non-streaming server-side proxy for one-off calls, and structured/template-driven output — not a full mirror of every endpoint capability.
````
