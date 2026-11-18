---
name: add-notifications
description: Add the standard in-app notifications to a Buildpad app, or bring an existing bell up to the standard. Every Buildpad app has the same notification concept, so people can see and answer what happened without leaving the app. It always has a bell in the header with an unread badge, a /notifications inbox with day groups, tabs and a detail pane where the person can reply inline, a deep link from each notification to its record, mark read and mark all read, and an optional daily email digest. Covers the standard `notifications` collection, the permissions that keep each person to their own rows (admins included), the one `notify` service and the hooks that call it (mention, reply, assign), the `@buildpad/ui-notifications` components (`NotificationsProvider`, `NotificationBell`, `NotificationsInbox`, `NotificationDetail`), migrating an app's own bell table, and how to prove it with throwaway users. Use when the user says add notifications, add a bell, add an inbox, notify people when, standardise our notifications, users should see updates in the app, or move our notification table to the standard. Not for a one-off toast after a save, or for email-only alerts with nothing to read in the app.
argument-hint: "[what should notify people, e.g. mentions, replies, assignments, status changes]"
---

# Add Standard Notifications

A "notification" means the same thing in every Buildpad app: a row addressed to one person that
says what happened, who did it, and where to go. People expect a bell that tells them how many are
new, a page where they can read and answer them, and a link that opens the exact record. Build it
from the one module, `@buildpad/ui-notifications`, on the one standard collection, so every app
behaves the same and the next producer costs one call.

## The standard (acceptance checklist)

Notifications are done only when every line is true:

| # | The app always has |
|---|---|
| N1 | **A bell in the header.** An unread badge (`9+` above nine), a popover with the latest few, mark all read, and "See all notifications" to `/notifications`. |
| N2 | **An inbox page.** `/notifications`: two panes, grouped by day, tabs All / Unread plus one per app or source, paged with a keyset, the selection in the URL (`?filter=&id=`), one pane on a phone, keyboard up/down. |
| N3 | **Respond in place.** The detail pane previews the record and offers its actions; where the source is a discussion, the person can reply inline with the same comment editor. |
| N4 | **A deep link.** Each row stores its `link`; opening it lands on the record (and the comment), and marks it read. |
| N5 | **Only your own.** A person reads and updates only rows where they are the recipient, an admin included. They can change `read_at` and nothing else. Nobody creates rows from the browser. |
| N6 | **One producer.** Every notification goes through the `notify` service: never the actor themself, never twice for one event (`dedupe_key`), several unread of one kind merge ("3 new comments on X"). |
| N7 | **Email that respects the person.** An optional daily digest of unread, unemailed rows; `notification_prefs.email_mode = off` stops it. People without an account get the digest only. |
| N8 | **Fresh, not noisy.** The count polls while the tab is visible and pauses when it is hidden. |

If the app already has a bell or a notification table, audit it against this table and list the
gaps before you change anything.

## Rules

1. **Buildpad first.** Install the module with the Buildpad CLI (`notifications`, like
   `comments`); do not hand-build a bell, a list or a form. No `useForm`, no raw inputs. The inbox is
   a deliberate exception to "lists are `CollectionList`": it is a two-pane reader, not a table. Check
   [buildpad-reference](../buildpad-reference/SKILL.md) for the current part names.
2. **One collection, one shape.** The standard `notifications` collection (step 2) in every app.
   No app-specific `feedback_notifications` or `crm_notifications` next to it; migrate them.
3. **Store the link.** Write `link` when the row is made. Never derive links in the bell, the
   inbox and the email separately: they drift.
4. **The actor is a user id.** Store `actor` (uuid) and `actor_name` (for display and for people
   since removed). A name alone cannot be checked, avatared or excluded.
5. **Every producer calls `notify`.** Hooks, services, cron jobs and agents. `notify` removes the
   actor, dedupes on the unique `dedupe_key`, and merges into an unread row of the same kind.
6. **Never throw from a notification hook.** A failed notification must not undo the comment, the
   assignment or the save that caused it. Catch, log, return.
7. **Filter on the server.** Unread, tab and paging are query filters, never a filter over rows
   already loaded (that shows the wrong count and loses older rows).
8. **Gate with module access keys, never role names.** Who may see the inbox, or a tab, is a
   module access key ([grant-module-access](../grant-module-access/SKILL.md)).
9. **Keep the schema and hooks in version control.** The module ships them in its `schema/`
   folder; apply from there and commit any change you make. A hook edited live has no history.
10. **Test with throwaway people and remove what you made.** See step 7.

## Steps

### 1. Audit and decide

List every event that should tell someone: a mention, a reply to their comment, an assignment, a
status change on something they own, an agent asking a clarifying question. For each, name the
recipient, the title ("Ana mentioned you"), the link, and the `dedupe_key` (for example
`mention:<comment id>:<user id>`). List what is in the app now: a bell, a table, emails sent
straight from hooks.

**Migrating an app that already has its own bell.** Map the old columns onto the standard, backfill,
switch the producers to `notify`, switch the UI, then retire the old table (keep it read-only for a
release). Two shapes seen in practice:

| Standard | Chisel `feedback_notifications` (keyed by email) | XCRM `crm_notifications` (text + data JSON) |
|---|---|---|
| `recipient` | look up the user by `email`; null when no account | `user` |
| `recipient_email` | `email` (always kept) | the user's email |
| `type` | `kind` | `data.type` |
| `title` / `message` | `subject` / `body` | first line of `text` / the rest |
| `link` | build once from the ticket id | `data.url`, or build from `data.collection` + `data.id` |
| `actor` / `actor_name` | look up by `actor_email` / its name | `data.actor_id` / `data.actor_name` |
| `source_collection` / `source_id` | `'feedback'` / `ticket` | `data.collection` / `data.id` |
| `dedupe_key` | `legacy:feedback_notifications:<id>` | `legacy:crm_notifications:<id>` |
| `read_at` / `created_at` | `read_at` / `created_at` | `is_read ? updated_at : null` / `created_at` |

Backfill in batches with the elevated items service, dedupe on `dedupe_key` so a rerun is safe, and
compare row counts and unread counts per recipient before and after.

### 2. Data model

Apply `notifications.schema.json` from the module's `schema/` folder, or create it with the
backend's own tools:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `recipient` | many-to-one to the users, nullable | null only for a person without an account |
| `recipient_email` | string, nullable | the digest address for people without an account |
| `type` | string | `mention`, `reply`, `assign`, `clarification`, … |
| `title` | string | short, shown bold |
| `message` | text, nullable | one or two lines; for a merged row, the latest |
| `link` | string | app-relative path that opens the record |
| `actor` | many-to-one to the users, nullable | who caused it; null for the system |
| `actor_name` | string, nullable | display name at the time |
| `source_collection` / `source_id` | string / string | the record, for the preview and app tabs |
| `dedupe_key` | string, **unique** | one row per event |
| `read_at` | timestamp, nullable | null = unread |
| `emailed_at` | timestamp, nullable | set by the digest |
| `created_at` | timestamp | stamped by the service; index with `recipient` |

Optional `notification_prefs`: `user` (unique), `email_mode` (`daily` default, `immediate`, `off`).

### 3. Permissions

On `notifications`, for every app role: **read** where `recipient = $CURRENT_USER`; **update** with
the same rule and the field list `read_at` only; **no create, no delete**. Producers write with the
elevated service. Admins bypass the read rule, so the client always adds its own recipient clause
(Pitfalls). On `notification_prefs`: read, create and update where `user = $CURRENT_USER`.

### 4. Producers

The module's `notifications` service (stored code, [create-service](../create-service/SKILL.md))
exposes `notify(rows)`:

```js
// rows: [{ recipient, recipient_email, type, title, message, link, actor, actor_name,
//          source_collection, source_id, dedupe_key }]
for (const r of rows) {
  if (r.recipient && r.recipient === r.actor) continue;           // never notify yourself
  const open = await items.readByQuery({ filter: { recipient: { _eq: r.recipient },
    type: { _eq: r.type }, source_id: { _eq: r.source_id }, read_at: { _null: true } }, limit: 1 });
  if (open.length && r.merge !== false) {                           // "3 new comments on X"
    await items.updateOne(open[0].id, { title: mergedTitle(open[0], r), message: r.message,
      actor: r.actor, actor_name: r.actor_name, created_at: now() });
    continue;
  }
  try { await items.createOne({ ...r, created_at: now() }); }
  catch (e) { if (!isUniqueViolation(e)) throw e; }                 // dedupe_key already there
}
// then, for recipients with email_mode = 'immediate', send one email per new row
```

Hooks shipped in `schema/` (action hooks on create, each wrapped in try/catch, never throwing):

- **Comment mention:** each person mentioned who can read the record; `dedupe_key` `mention:<comment>:<user>`.
- **Comment reply:** the author of the comment answered (not someone already mentioned).
- **Assign:** the new assignee when the assignee field changes.
- **Read visibility (optional):** drop recipients who cannot read the source record.

`@buildpad/ui-comments` can create these itself: set `CONFIG.inAppNotifications` and do not also
install the comment hooks, or people get two rows.

**Agents** that need a human answer (a clarifying question) call the same service with a service
token scoped to `notify`, `type: 'clarification'`, `actor` the agent's service user, and a `link` to
the place the person can answer. Never give an agent create on the collection itself.

### 5. The components

Install with the CLI (`notifications`), then:

- **`NotificationsProvider`** wraps the app shell **inside** the current-user provider, with
  `adapter={notificationsItemsAdapter({ collection: 'notifications', meId })}` and `meId`; until it has the user
  id it fetches nothing. `useNotifications()` gives `unreadCount`, `latest`, `markRead`,
  `markUnread`, `markAllRead` and `refetch`. Write a custom adapter only when the app needs another
  fetcher.
- **`NotificationBell`** goes in the header next to the user menu. Pass
  `onNavigate={(href) => router.push(href)}` (the default is a full page load) and, when `link`
  is not enough, `resolveLink(n)`.
- **`/notifications`** renders `NotificationsInbox` inside `<Suspense>`. Pass
  `urlState={nextUrlState(useSearchParams(), useRouter(), usePathname())}` so `?filter=` and `?id=`
  live in the URL (the default keeps them in memory and deep links do nothing). Every signed-in user
  sees their own notifications; gate the route with a module access key only if the app restricts it.
- **`NotificationsInbox`** takes the app's extra `tabs` (e.g.
  `{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }`), `typeStyles`, and the detail slots: `renderPreview(n)` per
  record kind (switch on `source_collection`: a ticket card, a deal summary); `renderActions(n)` for
  the record's own buttons (Open, Approve, Assign to me); `renderReply(n)` drops in the ui-comments
  `Composer` bound to `source_collection`/`source_id`, so a reply posts a real comment (which
  notifies the other side).

### 6. Email digest

Install the module's `notification-digest` cron job (daily, the team's morning;
[create-cron](../create-cron/SKILL.md)). For each recipient with unread rows where `emailed_at` is
null and `email_mode` is not `off`: **claim** the rows (set `emailed_at`, filtered on
`emailed_at _null`), send one email listing them with their links, and on a send failure **release**
them (`emailed_at = null`) so tomorrow retries. `recipient_email` rows without a recipient are
digest-only. Skip addresses that cannot receive mail (`.test`, the system account).

### 7. Prove it

Run the built app on a free port and drive it with Playwright as two throwaway users, A and B, on a
reserved test domain (`@example.test`), one of them an admin. Check, as
data and screenshots:

- B mentions A: A's badge goes up within one poll, B's does not (self-exclusion);
- a second mention on the same record merges; a replayed event adds no row (`dedupe_key`);
- **A never sees B's rows**, in the bell, the inbox and a direct API read, even when A is an admin;
- A cannot change `title` or `recipient`, and cannot create a row; only `read_at` updates;
- opening a row deep-links to the record and marks it read; mark all read empties the badge;
- Unread and app tabs and "load older" ask the server (watch the requests), and `?filter=&id=` reloads to the same selection;
- an inline reply posts a comment and notifies B;
- at phone width the inbox is one pane with a back button;
- the digest claims, sends and, on a forced failure, releases.

Then **remove everything you made, by explicit id**: notifications, comments, prefs, then the
throwaway users. Compare row counts with the ones you took before.

## Pitfalls

- **Admins bypass the `$CURRENT_USER` read rule.** An admin's bell shows everyone's rows. Always
  add `recipient = <me>` in the client query, and do not fetch before the user id is known (a fetch
  with an empty id returns every row to an admin).
- **Send the filter as one JSON value** (`filter={"recipient":{"_eq":"…"}}`). Bracket-style
  filters (`filter[recipient][_eq]=`) are silently dropped and you get everything.
- **`limit=-1` is rejected.** Page explicitly.
- **You cannot sort on a second field descending.** Page with a keyset on `created_at` (`_lte` the
  last seen) and dedupe the overlap by id; do not rely on `-created_at,-id`.
- **Filter on the server, never over loaded rows.** Counts and older pages go wrong otherwise.
- **`{ keys, data }` batch PATCH is rejected.** Mark all read with one PATCH that carries a filter
  query (`recipient = me`, `read_at _null`).
- **Pause polling on a hidden tab** (`visibilitychange`), and refresh once when it comes back.
- **Check-then-insert dedupe races.** Two hooks firing together both see "no row". Rely on the
  unique `dedupe_key` and swallow the unique violation.
- **Never throw from a notification hook.** It rolls back the user's own action.
- **Links derived in three places drift.** Store `link`.
- **A name is not an actor.** Without the uuid you cannot exclude the actor or show an avatar.
- **Schema and hooks edited live** have no history; keep them in the repo and apply from there.
- **Two producers for one event** (ui-comments `inAppNotifications` and the comment hooks) give
  duplicate rows with different keys. Pick one.
- **Role names in gates** break when roles are renamed or added. Use module access keys.
- **Asking for a field the read permission does not grant is a 403**, not a dropped column. Request
  only the readable fields (`READABLE_NOTIFICATION_FIELDS`); `recipient_email`, `dedupe_key` and
  `emailed_at` are server-only.
- **Only app-relative links.** A `link` must start with one `/` (not `//`, `/\`, `javascript:` or
  `https://`); `notify()` stores anything else as null. A custom `resolveLink` must keep that rule.
- **A row you already emailed** (e.g. the comment mention email) goes to `notify()` with
  `emailed: true`, or the digest emails it again the next morning.
- **The digest runs as the system**, so the read-visibility hook does not apply to it. If records
  can stop being readable, turn on its `checkAccess` with one access filter per source collection.

## Related skills

[add-comments](../add-comments/SKILL.md) (mentions and replies that produce notifications, the
`Composer` for inline reply), [create-service](../create-service/SKILL.md) (the `notify` service),
[hooks-extensions](../hooks-extensions/SKILL.md) (stored-code rules), [create-cron](../create-cron/SKILL.md)
(the digest), [grant-module-access](../grant-module-access/SKILL.md) (gating the inbox),
[create-rbac](../create-rbac/SKILL.md) (the recipient rule), [create-tests](../create-tests/SKILL.md)
(Playwright setup).
