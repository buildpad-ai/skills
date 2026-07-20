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
