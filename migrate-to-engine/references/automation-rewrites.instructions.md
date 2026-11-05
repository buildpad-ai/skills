---
name: Automation Rewrites (Engine project)
description: Before-and-after rewrites of hooks, cron jobs and custom services for the Engine's JavaScript runtime, one for each finding the move reports (require, import, module, process, fetch, timers, eval, supabase, node-global, services-member), plus the differences the scan does not flag.
---

<!-- buildpad-backend-file: engine -->
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

# Automation Rewrites (Engine project)

One example for each finding of `engine-plan/automation-to-review.json`. Each keeps the behaviour of
the original and uses only what the Engine's runtime has. The runtime table, the steps and how to
create the rewritten item are in this skill's [SKILL.md](../SKILL.md); every service signature is in
[hooks-extensions](../../hooks-extensions/SKILL.md) (its Engine services API reference).

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the Engine runtime table in this skill's [SKILL.md](../SKILL.md) lists; for each interface it lacks, the table says what replaces it.

## `require`, `import`, `module`

There are no modules. A small helper is written into the body; code that several items share
becomes a custom service; work that needs a package moves into an API route of the app.

```javascript
// Before (custom service "slug_helpers")
const slugify = require('slugify');
module.exports = {
  toSlug(text) { return slugify(text, { lower: true, strict: true }); },
};
```

```javascript
// After: a custom service body returns its object; the helper is written out
return {
  toSlug(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },
};
```

A hook or cron job that used it:

```javascript
const slugs = await services.custom('slug_helpers');  // await services.custom
payload.slug = slugs.toSlug(payload.title);
return payload;
```

## `process`

`process.env` becomes `services.env` (`context.env` in a custom service). It holds only the keys the
Engine's operator exposes, and it is empty by default: tell the developer which keys to ask the
operator for. Never write the secret into the code instead: every administrator can read stored
code in the Studio.

```javascript
// Before
const apiKey = process.env.MAILCHIMP_API_KEY;
```

```javascript
// After
const apiKey = services.env.MAILCHIMP_API_KEY;
if (!apiKey) throw new Error('Ask the Engine operator to expose MAILCHIMP_API_KEY');
```

## `fetch`

The global `fetch` becomes `services.fetch(url, init)`. Only the hosts in the project's `EXTENSION_ALLOWED_DOMAINS`
can be reached (with their subdomains); tell the user to add each host the code calls in the project's **Environment Variables** and apply it. The
answer has `ok`, `status`, `headers.get()`, `json()` and `text()`. Send a string `body`: an object
is sent as `[object Object]`. There is no `AbortController`: the item's `timeout_ms` bounds the run.

```javascript
// Before (action hook, orders.items.create)
await fetch('https://hooks.slack.com/services/' + process.env.SLACK_PATH, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: `New order ${meta.key}` }),
});
```

```javascript
// After: hooks.slack.com must be on the operator's allowed list, SLACK_PATH exposed
const res = await services.fetch('https://hooks.slack.com/services/' + services.env.SLACK_PATH, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: `New order ${meta.key}` }),
});
if (!res.ok) console.error('Slack answered', res.status);
```

A host outside the list throws `403 FORBIDDEN` before any request is sent; an upstream failure
throws `502 RUNTIME_FETCH_FAILED`.

## `timers`

There is no delay inside a run. A wait becomes a row that a cron job picks up later; a retry loops
at once, a few times, inside the run.

```javascript
// Before (action hook, invoices.items.create): send a reminder in an hour
setTimeout(async () => {
  await sendReminder(meta.key);
}, 60 * 60 * 1000);
```

```javascript
// After, part 1 (the same hook): record what is due
await services.items('reminders', { elevated: true }).createOne({
  invoice: meta.key,
  email: meta.payload.customer_email,
  due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: 'pending',
});
```

```javascript
// After, part 2 (cron job "send-due-reminders", schedule "*/5 * * * *"): send what is due
const reminders = services.items('reminders');
const due = await reminders.readByQuery({
  filter: { status: { _eq: 'pending' }, due_at: { _lte: new Date().toISOString() } },
  limit: 200,
});
for (const r of due) {
  const sent = services.mail({ to: r.email, subject: 'Invoice reminder', text: `Invoice ${r.invoice} is due.` });
  await reminders.updateOne(r.id, { status: sent.success ? 'sent' : 'failed' });
}
```

The `reminders` collection is new: create it on the Engine first (see
[create-collection](../../create-collection/SKILL.md)). To run a job at once from a hook, call
`services.cron.trigger('send-due-reminders')`.

## `eval`

`eval` and `Function` are removed. Write the code out; a rule table kept as data (JSON in a
collection) and read with `services.items` replaces generated code.

## `supabase`

The Supabase service is refused permanently, and there is no SQL. Each table call becomes a
`services.items` call on the collection of the same name.

```javascript
// Before (cron job)
const { data: stale } = await services.supabase
  .from('sessions')
  .select('id')
  .lt('updated_at', cutoff)
  .eq('status', 'pending');
await services.supabase.from('sessions').delete().in('id', stale.map((s) => s.id));
```

```javascript
// After: read the keys, then delete them (no query-wide delete)
const sessions = services.items('sessions');
const stale = await sessions.readByQuery({
  fields: ['id'],
  filter: { updated_at: { _lt: cutoff }, status: { _eq: 'pending' } },
  limit: 1000,
});
if (stale.length) await sessions.deleteMany(stale.map((s) => s.id));
```

| Supabase call | Engine call |
|---|---|
| `.select(cols)` with `.eq`, `.lt`, `.in`, `.order`, `.limit` | `readByQuery({ fields, filter: { col: { _eq / _lt / _in } }, sort, limit })` |
| `.select().single()` by id | `readOne(id)` |
| `.insert(row)` / `.insert(rows)` | `createOne(row)` / `createMany(rows)` |
| `.update(data).eq('id', id)` | `updateOne(id, data)` |
| `.update(data)` on a filter | `readByQuery({ fields: ['id'], filter })`, then `updateMany(keys, data)` |
| `.delete()` on a filter | `readByQuery({ fields: ['id'], filter })`, then `deleteMany(keys)` |
| A call to the client's `rpc` method | The function's logic as `services.items` calls, in the item or in a custom service |
| The Supabase administration API (accounts) | No path from stored code: an administrator manages accounts in the Studio |

In a hook, `services.items` calls are checked against the grants of the user who fired it. The
Supabase service bypassed every check, so where the original wrote rows that user may not write,
pass `{ elevated: true }`. A cron job runs as the Engine's system account and needs no flag.

## `node-global`

| Global | Replacement |
|---|---|
| `URL`, `URLSearchParams` | Build the string: `'?q=' + encodeURIComponent(q) + '&page=' + page` |
| `structuredClone` | `JSON.parse(JSON.stringify(value))` |
| `crypto.randomUUID()` | A `uuid` field fills the id; for a token, move the work into an API route |
| `crypto` hashing or signing, `Buffer`, `TextEncoder`, `atob`, `btoa` | Move the work into an API route of the app, which has Node's `crypto` and `Buffer` |
| `window`, `localStorage`, `navigator`, `XMLHttpRequest`, `WebSocket` | Browser code does not belong in stored code: remove it |
| `queueMicrotask`, `AbortController`, `Headers`, `FormData`, `Blob` | Not needed: call the service directly; send a string body to `services.fetch` |

An API route runs with the signed-in user's session, so the app calls it, not stored code. Where an
event must start that work, the hook writes a row (for example with `status: 'pending'`) and the
app's route processes the pending rows.

## `services-member`

The finding names a `services.<name>` that the Engine does not have, such as a utilities, users or
activity service. Use `services.items(collection)` on the collection the code meant, where the
Engine allows it, and drop the call where there is none: tell the developer what it did. The
members are `items`, `collections`, `fields`, `relations`, `files`, `versions`, `mail`, `custom`,
`cron`, `fetch` and `env`.

## Differences the scan does not flag

```javascript
// Before (action hook, articles.items.update)
const { data: article } = await services.items('articles').readByQuery({ filter: { id: { _eq: meta.key } } });
await services.mail({ to: article[0].author_email, subject: 'Updated', text: 'Your article changed.' });
```

```javascript
// After: readByQuery returns the array; update hooks carry meta.keys; mail answers { success }
const articles = await services.items('articles').readMany(meta.keys, { fields: ['id', 'author_email'] });
for (const article of articles) {
  const sent = services.mail({ to: article.author_email, subject: 'Updated', text: 'Your article changed.' });
  if (!sent.success) console.error('Mail not sent for', article.id);
}
```

- A filter hook refuses a write with `throw new HookError(message, status, code)`; it returns the
  payload (or nothing, to keep it as it stands).
- Only `fields`, `filter`, `sort`, `limit`, `page`, `offset` and `search` are accepted in a query;
  a read without `limit` returns 25 rows, and `limit` is capped at 1000.
- A filter reaches one relation deep; read the related collection first for anything deeper.
- `console` is not in scope in a custom service body: return what should be recorded.
- `Intl` is not in the runtime: format numbers and dates by hand.
