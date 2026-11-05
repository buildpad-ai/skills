<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

<!-- buildpad-backend: supabase -->
````instructions
---
name: Stripe API Reference
description: Common Stripe API calls for a DaaS custom service, once Stripe is connected via the Buildpad platform's Connectors page
applyTo: "**/*.{ts,tsx,js}"
---

# Stripe, from a custom service

This doc assumes Stripe is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this — it tells you the exact env var name, base URL, and auth header style; don't hardcode them). As of this writing that's `STRIPE_SECRET_KEY`, base URL `https://api.stripe.com/v1`, Bearer auth.

Stripe's request bodies are **form-encoded** (`application/x-www-form-urlencoded`), not JSON — this is the most common mistake when calling it from a custom service.

## Create a customer

```javascript
const { services, env } = context;

const response = await services.fetch('https://api.stripe.com/v1/customers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ email, name }),
});
const customer = await response.json();
// customer.id -> "cus_..."
```

## Create a charge (PaymentIntent)

```javascript
const response = await services.fetch('https://api.stripe.com/v1/payment_intents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    amount: String(amountInCents),
    currency: 'usd',
    customer: customerId,
  }),
});
const paymentIntent = await response.json();
```

## Errors

Stripe returns a 4xx with a JSON body shaped like `{ error: { type, code, message } }` — check `response.ok` before assuming `response.json()` is the resource you asked for.

## Beyond this

For anything not covered here (subscriptions, webhooks, refunds, etc.), see Stripe's own API reference: https://stripe.com/docs/api. This doc is a bootstrap for the common cases, not a full mirror of Stripe's API.
````
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
````instructions
---
name: Stripe API Reference
description: Common Stripe API calls for a custom service on the Buildpad Engine, once Stripe is connected via the Buildpad platform's Connectors page
applyTo: "**/*.{ts,tsx,js}"
---

# Stripe, from a custom service

This doc assumes Stripe is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this — it tells you the exact env var name, base URL, and auth header style; don't hardcode them). As of this writing that's `STRIPE_SECRET_KEY`, base URL `https://api.stripe.com/v1`, Bearer auth.

On an Engine project the custom service runs inside the Engine, so two settings of the Engine must be in place before it can call Stripe. Both are variables in the project's **Environment Variables** (Engine list), on the Buildpad platform's Details page. Tell the user to add them and apply; never assume either:

- **The key.** `services.env` holds only the variables the project's Environment Variables name. The user sets `STRIPE_SECRET_KEY` as an Engine variable and names it, for example `RUNTIME_ENV_WHITELIST_CUSTOM_SERVICE=STRIPE_SECRET_KEY`. The application's `.env.local` and Amplify environment do not reach the Engine.
- **The host.** `services.fetch` reaches only the hosts in `EXTENSION_ALLOWED_DOMAINS`. The user adds `api.stripe.com` to it.

Stripe's request bodies are **form-encoded** (`application/x-www-form-urlencoded`), not JSON — this is the most common mistake when calling it from a custom service. The Engine's runtime has no `URLSearchParams`, so build the body by hand.

## Create a customer

```javascript
const { services, env } = context;

const form = (fields) =>
  Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const response = await services.fetch('https://api.stripe.com/v1/customers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: form({ email, name }),
});
const customer = await response.json();
// customer.id -> "cus_..."
```

## Create a charge (PaymentIntent)

```javascript
const response = await services.fetch('https://api.stripe.com/v1/payment_intents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: form({
    amount: String(amountInCents),
    currency: 'usd',
    customer: customerId,
  }),
});
const paymentIntent = await response.json();
```

## Errors

Stripe returns a 4xx with a JSON body shaped like `{ error: { type, code, message } }` — check `response.ok` before assuming `response.json()` is the resource you asked for. A host the operator has not allowed is refused before any request is sent, with `403 FORBIDDEN`; an empty `env.STRIPE_SECRET_KEY` means the operator has not named the key.

## Beyond this

For anything not covered here (subscriptions, webhooks, refunds, etc.), see Stripe's own API reference: https://stripe.com/docs/api. This doc is a bootstrap for the common cases, not a full mirror of Stripe's API.
````
<!-- /buildpad-backend -->
