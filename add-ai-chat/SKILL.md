---
name: add-ai-chat
description: Scaffold the Buildpad AI Chat module — a ready-made chat with a Chocolate Factory agent (AiChatPanel docked on the right, AiChatWidget floating bubble, AiChatButton "Ask AI" header button, AiChat for a custom shell) with streaming Markdown answers, recent chats, image attachments and screenshots. Installed with the CLI target ai-chat-routes. Use when the user wants a chat, chatbot, AI assistant, "Ask AI" button, help assistant, Chocolate Factory chat or agent chat in the app. Never hand-build a chat UI or an SSE parser for it.
argument-hint: "[--cwd path/to/project]"
---

# Add the AI Chat Module

A ready-made chat with a Chocolate Factory (CF) agent, installed via the Buildpad CLI (Copy & Own — the code is copied into your project). It is the chat panel of the Buildpad Platform's "Ask Buildpad" assistant, made reusable. It talks only to the CF agent: it reads and writes nothing in the project's data service, so it works the same on every kind of Buildpad project.

What the user gets: streaming Markdown answers (code blocks with copy, tables, links), one "working" word while the agent searches or thinks, Stop, Try again, Copy answer, starter suggestions, new chat, recent chats (the last 8, removable), image attachments (paper clip, paste, drag and drop; PNG, JPEG, WebP or GIF; up to 4), Take a screenshot (drag-select a region of the page, then draw on it; the panel hides while capturing), keyboard support (Enter sends, Shift+Enter adds a line, Esc closes, ⌘I / Ctrl+I toggles), and English and Bahasa Indonesia strings.

Four shells ship together:

- **`AiChatPanel`** — a docked panel on the right. On screens of 75em or wider it docks and pushes the page; narrower it overlays; on phones it is full screen.
- **`AiChatWidget`** — a floating bubble that opens a chat window.
- **`AiChatButton`** — the header "Ask AI" button, with the ⌘I / Ctrl+I hint.
- **`AiChat`** — the chat itself (header, thread, composer), for a shell of your own.

## CRITICAL: Never Create These Manually

Like all Buildpad UI, the AI Chat module is CLI-installed and owned as source. Do **not** hand-write a chat component, a message thread, a composer, or a parser for CF's `text/event-stream` responses, and do **not** copy the hand-rolled `ChocolateFactoryChat` example from the Chocolate Factory reference of [create-service](../create-service/SKILL.md). Do not hand-write `components/ui/ai-chat/*`, `app/api/ai-chat/*` or `lib/ai-chat/server.ts` either — scaffold them. Do not add a CF SDK or wrapper package: the module calls CF's run endpoint itself.

## Prerequisites Check

```bash
node --version && pnpm --version && npx --version
```

Requires Node.js v24 LTS and pnpm v10+ (see [add-buildpad](../add-buildpad/SKILL.md) for install guidance), a Next.js app with Mantine (`buildpad init` sets it up), and the Buildpad i18n provider in place for the app-wide strings (see [add-i18n](../add-i18n/SKILL.md)).

Chocolate Factory must be connected to the project on the Buildpad Platform's Connectors page. Check `get_project_detail`'s `connectors[]` before you install anything: it carries `CHOCOLATE_FACTORY_BASE_URL` and `CHOCOLATE_FACTORY_API_KEY`. If it is not connected, ask the user to connect it first. The user also needs an agent in the CF Portal: Buildpad does not create one.

## Installation

The AI Chat module is **opt-in** — it is not part of `bootstrap`.

```bash
# The components (components/ui/ai-chat/), the config route
# (app/api/ai-chat/config/route.ts), the proxy routes (app/api/ai-chat/route.ts,
# app/api/ai-chat/history/route.ts) and lib/ai-chat/server.ts
npx @buildpad/cli@latest add ai-chat-routes --cwd /path/to/project
```

`ai-chat-routes` pulls in `ai-chat` (the components). To install only the components (no routes) — for an app that writes its own:

```bash
npx @buildpad/cli@latest add ai-chat --cwd /path/to/project
```

The components add these npm packages: `ai`, `@ai-sdk/react`, `react-markdown`, `remark-gfm`, `use-stick-to-bottom` and `@zumer/snapdom` (Mantine and Tabler icons are already in a Buildpad app).

> The docs use the shorthand `buildpad add ai-chat-routes` when the CLI is installed globally; `npx @buildpad/cli@latest add …` is the equivalent no-install form used across these skills.

> **If the CLI command fails, `@buildpad/cli` IS published to npm** — verify with `npm view @buildpad/cli version` before assuming otherwise. The CLI fetches its registry from `raw.githubusercontent.com`, so confirm the environment can reach **both** npm and the GitHub raw CDN. If `add ai-chat-routes` reports an unknown target, the installed CLI predates this module: use `@latest`.

## Step 1: Choose the Backend

The components take a **backend** object that decides how the chat reaches the CF agent. Two ship with the module. Choose by where the app runs:

| Backend | Use when | How it works |
|---|---|---|
| `chocolateFactoryBackend(config)` — **browser-direct (default)** | The app is hosted on Amplify (a Buildpad app's default), or you are not sure | The browser calls `POST {baseUrl}/api/agents/{agentId}/run` with `Accept: text/event-stream`. No Lambda is in the path, so answers stream on Amplify. The key is visible in the browser — use an agent API key (`agk_…`), which reaches only that agent. The config comes from `useChocolateFactoryConfig()`, which reads `GET /api/ai-chat/config`. |
| `routeBackend({ api: '/api/ai-chat' })` — **server proxy** | The app runs on a long-lived Node server (self-hosted, EC2, a container) **and** the key must not reach the browser | The app's own route adds the key, so the key never reaches the browser. Each conversation is bound to the browser with an HMAC-signed token (`AI_CHAT_SECRET`), so a leaked conversation id cannot be read or continued from another browser. |

**Never use the server proxy on Amplify Hosting.** There the route runs as a buffered Lambda with a limit of about 30 seconds: the answer arrives all at once instead of streaming, and a long answer times out. It works in `pnpm dev` and then breaks in production.

Remove the route your backend does not use, so that the app exposes no route it does not need:

- **Browser-direct:** remove `app/api/ai-chat/route.ts` and `app/api/ai-chat/history/route.ts`.
- **Server proxy:** remove `app/api/ai-chat/config/route.ts`. It hands the key to the browser, which would defeat the proxy.

## Step 2: Set the Environment Variables

| Variable | Where the value comes from | Needed for |
|---|---|---|
| `CHOCOLATE_FACTORY_BASE_URL` | `connectors[]` (the Chocolate Factory connector) | both |
| `CHOCOLATE_FACTORY_API_KEY` | `connectors[]` — the project key (`cf_…`) | both (browser-direct uses it only when no agent key is set) |
| `CHOCOLATE_FACTORY_AGENT_ID` | **Ask the user.** They copy it from the agent in the CF Portal | both |
| `CHOCOLATE_FACTORY_AGENT_KEY` | **Ask the user** to create an agent API key (`agk_…`) for that agent in the CF Portal | browser-direct (optional, strongly recommended) |
| `AI_CHAT_SECRET` | Generate it: 32 or more random characters, for example `openssl rand -base64 32` | server proxy only |

The module reads exactly these names: do not rename them.

1. **Ask the user for the Agent ID.** It is not in `connectors[]`: Buildpad never stores or provisions a CF agent. Do not guess one and do not take one from another project.
2. **For browser-direct, recommend an agent key.** The config route returns `CHOCOLATE_FACTORY_AGENT_KEY` when it is set and `CHOCOLATE_FACTORY_API_KEY` otherwise, and the browser sends it with every message. An agent key (`agk_…`, sent as `x-agent-key`) reaches only this agent. The project key (`cf_…`, sent as `cf-api-key`) works too, but anyone who opens the page can read it and use it to call **every** agent in the CF project. If the user declines an agent key, tell them this plainly before you go on: it is a real security trade-off, not a formality.
3. **Local development:** the connector's `envVars` carries the real values of `CHOCOLATE_FACTORY_BASE_URL` and `CHOCOLATE_FACTORY_API_KEY`. Write them, the Agent ID, the agent key and (server proxy only) `AI_CHAT_SECRET` into `.env.local`. Do not commit, log or print them. Restart `pnpm dev`: Next.js reads `.env.local` only at start.
4. **Deployed app:** connecting CF on the Connectors page does **not** push anything to the deployed app. Push the same values with `amplify_set_env_vars`, then `amplify_redeploy` (see the [amplify-env-vars](../amplify-env-vars/SKILL.md) skill). Include the Agent ID, the agent key and `AI_CHAT_SECRET` in that same call — they are not in the connector's `envVars`. Without this step the chat works locally and finds no configuration once deployed.

**Set up the agent in the CF Portal: keep its Memory off.** Every user of the app reaches the agent with the same key, so CF sees them all as one user. With Memory on, what one user tells the agent can come back in another user's answers. Ask the user to switch Memory off on the agent.

## Step 3: Mount the Chat

`AiChatProvider` holds the open state that `AiChatButton` and `AiChatPanel` share, registers the hotkey (`hotkey` prop, default `mod+I`; `null` turns it off), and remembers the open state per browser tab. Put it around the authenticated shell (in a starter, `components/layout/AuthenticatedShell.tsx`), the button in the header, and the panel beside the page.

```tsx
// components/assistant.tsx
'use client';

import {
  AiChatPanel,
  chocolateFactoryBackend,
  useChocolateFactoryConfig,
} from '@/components/ui/ai-chat';

export function Assistant({ userId }: { userId: string }) {
  const config = useChocolateFactoryConfig(); // GET /api/ai-chat/config
  if (!config) return null;
  return (
    <AiChatPanel
      backend={chocolateFactoryBackend(config)}
      title="Ask Acme"
      storageKey={userId}
      suggestions={['How do I reset my password?']}
    />
  );
}
```

```tsx
// In the shell (a client component):
<AiChatProvider>
  {/* header */}
  <AiChatButton />
  {/* … */}
  <main style={{ marginInlineEnd: 'var(--bp-ai-chat-offset, 0)' }}>{children}</main>
  <Assistant userId={user.id} />
</AiChatProvider>
```

With the server proxy, pass `routeBackend({ api: '/api/ai-chat' })` as `backend` and drop `useChocolateFactoryConfig()`.

**Make room for the docked panel.** While it is open and docked, `AiChatPanel` sets `--bp-ai-chat-offset` on `<html>`. Give the app's main area `margin-inline-end: var(--bp-ai-chat-offset, 0)` (in a Mantine `AppShell`, on `AppShell.Main`), or the panel covers the right side of the page. Without `opened` and `onClose`, the panel reads `useAiChat()`; pass them to control it yourself. `width` sets its width (default 420).

**Or use the floating widget** instead of the button and the panel — no provider, header button or margin needed:

```tsx
<AiChatWidget backend={chocolateFactoryBackend(config)} title="Ask Acme" storageKey={userId} position="bottom-right" />
```

`AiChatWidget` adds `position` (`'bottom-right'` or `'bottom-left'`), `defaultOpened` and `launcherLabel`.

### Props that matter

`AiChat`, `AiChatPanel` and `AiChatWidget` share these props:

| Prop | Purpose |
|---|---|
| `backend` (required) | `chocolateFactoryBackend(config)` or `routeBackend(opts)` |
| `storageKey` | Scopes the recent chats kept in `localStorage` (default `"default"`). **Pass the signed-in user's id**, so that two people on one browser do not see each other's chats |
| `vars` | CF template variables sent with every message: an object, or a function that returns one at send time. Use it for page and user context (see below) |
| `title` / `badge` / `greeting` / `description` | Header title (default "Assistant"), a badge such as "Beta", and the empty-state heading (default "How can I help?") and text |
| `suggestions` | Starter questions shown as buttons |
| `placeholder` / `disclaimer` | Composer placeholder and the line under the composer |
| `context` | A slot above the composer, for example a "sharing this page" chip |
| `features` | `{ attachments?, screenshot?, recentChats? }` — all on by default; set one to `false` to turn it off |
| `linkTarget` | `(href) => '_self' \| '_blank'` — default: same origin opens in place, other origins in a new tab |
| `imageHosts` | Hosts an answer may show images from; images from other hosts render as links |
| `translations` | Per-instance strings. App-wide strings come from `BuildpadI18nProvider` |
| `onError` | Called with each error (default `console.error`) |

**Pass page context with `vars`.** CF injects the variables into the agent's system prompt, so the agent can answer about the page the user is on. Use a function so the value is read when the user sends, and add matching template variables to the agent's prompt in the CF Portal:

```tsx
const pathname = usePathname();
<AiChatPanel backend={backend} storageKey={user.id} vars={() => ({ page: pathname, userName: user.name })} />
```

Send only what the agent needs: every variable goes to CF with every message. Never put a token, a key or a password in `vars`.

## Security Notes (IMPORTANT)

- On browser-direct, the key is in the browser. That is why an agent key (`agk_…`) is recommended, and why the agent's Memory stays off.
- The config route hands the key to the browser. Mount the chat under the signed-in layout when the agent is not meant for the public, but treat the key as readable by anyone who can open the app.
- On the server proxy, keep `AI_CHAT_SECRET` secret and remove the config route (Step 1).
- What the agent may do is set on the agent in the CF Portal (its tools and integrations), not in this module. An agent that can act on the project's data acts with whatever its integrations hold, not with the signed-in user's rights.

## Post-Install Validation

```bash
npx @buildpad/cli@latest status --cwd /path/to/project
npx @buildpad/cli@latest validate --cwd /path/to/project
cd /path/to/project && pnpm build
```

Then run `pnpm dev`, open a page that mounts the chat, press ⌘I (Ctrl+I) or the "Ask AI" button, and ask a question. The answer streams in word by word. In the browser's network panel:

- **Browser-direct:** `GET /api/ai-chat/config` answers with the base URL and agent id, then a request goes to `{CHOCOLATE_FACTORY_BASE_URL}/api/agents/{agentId}/run`. A 401 or 403 means a wrong key, or a key that does not reach this agent. A 404 means a wrong Agent ID. A 400 can mean the agent is inactive.
- **Server proxy:** requests go to `/api/ai-chat` only, and no response holds the key.

After deploying, ask one long question on the deployed app: the answer must stream, not arrive all at once. If it arrives all at once on Amplify, the chat uses the server proxy — switch to browser-direct.

## Related

- [create-service](../create-service/SKILL.md) — its Chocolate Factory reference covers CF calls other than a chat: one-off server-side calls and structured output for charts and documents.
- [amplify-env-vars](../amplify-env-vars/SKILL.md) — push the environment variables to the deployed app.
- [add-i18n](../add-i18n/SKILL.md) — the i18n provider that supplies the chat's app-wide strings.
- [add-buildpad](../add-buildpad/SKILL.md) — the underlying CLI.
- [buildpad-reference](../buildpad-reference/SKILL.md) — full component catalog.
