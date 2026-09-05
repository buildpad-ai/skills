````instructions
---
name: Get Feedback API Reference
description: How to embed the Get Feedback widget to collect bug reports, feature requests, ratings, and general feedback from a web application, once Get Feedback is connected via the Buildpad platform's Connectors page
applyTo: "**/*.{ts,tsx,js}"
---

# Get Feedback, via the embeddable widget

**Identity check — read this first if you arrived here from a user request like "add the Get Feedback widget" or "add a feedback button":** "Get Feedback" is the `displayName` of a specific connector on this project's Connectors page (`key: "get-feedback"` in `connectors[]`), not a generic phrase and not the unrelated third-party product "GetFeedback by Momentive." If `connectors[]` contains an entry with `key: "get-feedback"`, that is what the user means — proceed with this doc, do not ask the user to disambiguate between "third-party embed" vs. "custom-built feedback form" vs. "other." Only fall back to asking what they mean if `connectors[]` has no such entry (in which case: tell them to connect it on the Connectors page, or ask if they want a custom DaaS-collection-backed form instead — don't silently build the latter).

This doc assumes Get Feedback is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this). Like Chocolate Factory, Get Feedback is **self-hosted per environment**, so it has no fixed `apiBaseUrl` — its base URL is one of its own env vars. `connectors[]` guarantees exactly two: `GET_FEEDBACK_API_KEY` and `GET_FEEDBACK_BASE_URL` — always read the exact names from `connectors[]`, don't hardcode them.

**What was provisioned for you:** connecting Get Feedback creates one dedicated *tenant* on the Get Feedback service for this Buildpad project, containing a feedback project named "Buildpad" whose widget API key is the `GET_FEEDBACK_API_KEY` credential. Submissions collected by the widget land in that tenant, and the user who connected it can log into the Get Feedback dashboard (the `GET_FEEDBACK_BASE_URL` origin) as its Tenant Admin to triage them — statuses, assignment, and comments all live there, not in this app.

**The widget API key is publishable, not secret.** It identifies the feedback project (the service stores only a SHA-256 hash and rate-limits submissions per IP); it grants no read access to collected feedback. It is therefore fine for the key to appear in client-side markup — this is unlike `CHOCOLATE_FACTORY_API_KEY`, which must never reach the browser. Still avoid committing it: read it from an env var and render it into the page server-side.

**Running locally (`pnpm dev`):** the `connectors[]` entry also carries `envVars` — the actual decrypted values, not just the names. Write them into `.env.local` (don't commit them) and restart `pnpm dev`.

**Deploying:** connecting Get Feedback on the Connectors page only stores the credential in Buildpad — it does **not** push `GET_FEEDBACK_API_KEY`/`GET_FEEDBACK_BASE_URL` to the deployed app's Amplify environment. After adding the widget, push that same `envVars` map with `amplify_set_env_vars` and follow with `amplify_redeploy` (see the `amplify-env-vars` skill) — otherwise the code works locally but the deployed app has no value to read.

## 1. Embed the widget (the common case)

The widget is a self-contained IIFE bundle served by the Get Feedback deployment itself. It reads `data-api-key` off its own `<script>` tag, fetches this project's widget configuration (position, colour, button label, enabled feedback types), and renders a floating feedback button in a shadow root. No npm install, no SDK.

In a Next.js App Router app, add it via `next/script` in the root layout so every page gets the button. Render it in a Server Component so the env vars are read server-side and inlined into the HTML:

```tsx
// app/layout.tsx (Server Component — no 'use client')
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const feedbackBaseUrl = process.env.GET_FEEDBACK_BASE_URL;
  const feedbackApiKey = process.env.GET_FEEDBACK_API_KEY;

  return (
    <html lang="en">
      <body>
        {children}
        {feedbackBaseUrl && feedbackApiKey && (
          <Script
            src={`${feedbackBaseUrl}/api/widget/v1/widget.js`}
            data-api-key={feedbackApiKey}
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  );
}
```

For a plain HTML page it's a single tag:

```html
<script src="https://<get-feedback-host>/api/widget/v1/widget.js" data-api-key="<GET_FEEDBACK_API_KEY value>" async></script>
```

That's the entire integration. The widget handles the form UI, optional screenshot capture, validation, and submission on its own. It also exposes a small global for programmatic control: `window.FeedbackWidget.open()` and `.close()` — useful for wiring a "Give feedback" item in your own nav instead of (or alongside) the floating button.

**Widget appearance and enabled feedback types are configured on the Get Feedback dashboard** (the provisioned defaults: bottom-right position, `#0066CC`, "Feedback" label, all four types enabled, screenshots off). Don't build config UI for these in this app — direct the user to the dashboard.

**Avoiding overlap with another floating element (e.g. an existing chat bubble):** the widget's own on-screen position (corner, offset) is dashboard-configured, not something this app's code controls — grep the codebase first (`position: fixed`, `bottom-right`, common chat SDK names) to find what's already floating there, then either move *that* element's offset/z-index in its own code, or tell the user to change the Get Feedback widget's corner on the dashboard so the two no longer collide. Don't ask the user to identify their chat tool by name before checking the code yourself.

**Suppressing the floating launcher button (menu-triggered feedback only):** `WidgetConfig` has no visibility flag — position is always one of the four corners, there is no "hidden" state and no dashboard toggle for it either. **Do not tell the user this requires a dashboard change; it doesn't exist there.** It's a legitimate in-app DOM workaround instead: the widget mounts a `<div id="feedback-widget-host">` on `document.body` with an **open** shadow root (`attachShadow({ mode: 'open' })`), so app code can reach into it. The launcher is `<button class="feedback-button">` inside that shadow root. One catch: the widget's own `closeForm()` resets the button back to `display: flex` whenever the form closes (including a close triggered from your menu-opened form), so a one-time hide isn't enough — watch it with a `MutationObserver` and re-hide on every change:

```tsx
// components/HideFeedbackLauncher.tsx — client component, mount once (e.g. in the authenticated layout)
'use client';
import { useEffect } from 'react';

export function HideFeedbackLauncher() {
  useEffect(() => {
    let observer: MutationObserver | null = null;

    const hide = (button: HTMLElement) => {
      if (button.style.display !== 'none') button.style.display = 'none';
    };

    const poll = setInterval(() => {
      const button = document
        .getElementById('feedback-widget-host')
        ?.shadowRoot?.querySelector<HTMLButtonElement>('.feedback-button');
      if (!button) return; // widget config fetch is async — keep polling until it mounts
      clearInterval(poll);
      hide(button);
      observer = new MutationObserver(() => hide(button));
      observer.observe(button, { attributes: true, attributeFilter: ['style'] });
    }, 100);

    return () => {
      clearInterval(poll);
      observer?.disconnect();
    };
  }, []);

  return null;
}
```

Render `<HideFeedbackLauncher />` once alongside the `<Script>` tag. `window.FeedbackWidget.open()`/`.close()` keep working normally for a "Give feedback" menu item — only the always-on floating launcher is suppressed. This depends on the widget's current DOM structure (`#feedback-widget-host` / `.feedback-button`); if a future widget version changes these, re-verify against the widget bundle before reusing this snippet.

## 2. The underlying HTTP API (only if the widget doesn't fit)

If the user explicitly wants a custom feedback form instead of the widget, the same public endpoints the widget uses are callable directly. All live on `GET_FEEDBACK_BASE_URL`, are CORS-open, and authenticate with the widget API key:

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/widget/v1/config?key=<apiKey>` | query param | Returns the widget config; 401 invalid key, 403 project deactivated |
| `POST /api/widget/v1/submit` | `api_key` in JSON body | Rate limited 10 submissions/IP/minute (429 with `Retry-After`) |
| `POST /api/files/upload` | `x-api-key` header | `multipart/form-data` screenshot upload; returns a file id for `screenshot_file_id` |

`POST /api/widget/v1/submit` body:

```json
{
  "api_key": "<GET_FEEDBACK_API_KEY value>",
  "feedback_type": "bug_report",
  "description": "Checkout button does nothing on mobile",
  "rating": 4,
  "screenshot_file_id": null,
  "page_url": "https://app.example.com/checkout",
  "user_agent": "Mozilla/5.0 ..."
}
```

- `feedback_type` is one of `bug_report | general_feedback | feature_request | rating`; `rating` (1–5) only applies when the type is `rating`.
- `description` is required, max 2000 characters (HTML is stripped server-side).
- There is no read API with this key — collected feedback is only visible in the Get Feedback dashboard.

**None of this needs a DaaS custom service.** These are plain HTTPS calls to the Get Feedback deployment; make them from the browser (the key is publishable) or from a Next.js API route — not from the sandboxed custom-service runtime.
````
