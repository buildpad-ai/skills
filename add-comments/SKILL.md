---
name: add-comments
description: Add a standard comment (discussion) field to a Buildpad app, or bring an existing one up to the standard. A comment field always has social @mentions, images (paste from the clipboard, an Image button, thumbnails that open a viewer), replies at any depth, an emoji picker, one-click reactions, and email notifications for mentions and replies. Covers the data model (self-referencing parent and thread root, a photos column, a reactions table), the server hooks that stamp and validate every comment, the one shared editor component, the recursive thread list, silent refetching so the page never blanks after a post, and how to prove it with throwaway users. Use when the user says add comments, add a discussion or reply box, add a comment field, standardise our comment boxes, add social mention, paste images into a comment, add reactions, or add threaded replies. Not for a one-off text field that is not a discussion.
argument-hint: "[what the comments attach to, e.g. tickets, updates, reviews]"
---

# Add a Standard Comment Field

A "comment field" means the same thing in every Buildpad app. People who leave a comment expect to
tag a colleague, paste a screenshot, answer a single comment, react to it with an emoji, and be told
when someone answers them. Build all of it the first time, with one shared component, so the next
comment box costs minutes and the app has no weak box that lacks one of them.

## The standard (acceptance checklist)

A comment field is done only when every line is true:

| # | A comment field always has |
|---|---|
| C1 | **Social mention.** Typing `@` offers the people who can read the thing; the chosen person is a mention that is stored as a token, shown as a chip, and emailed. |
| C2 | **Images.** An Image button, and pasting an image from the clipboard (a screenshot) attaches it too. Images are stored as a list of file ids next to the text, shown as thumbnails that open a viewer. |
| C3 | **Replies at any depth.** A Reply button on every comment, not only the top one. The true parent is stored; the thread's first comment is stored as its root. |
| C4 | **Emoji.** An emoji picker in the editor's toolbar (typing or pasting an emoji works too). |
| C5 | **Reactions.** One-click reactions under each comment with counts; your own is highlighted; clicking it again takes it back. |
| C6 | **No blank screen.** Posting, replying or reacting never clears the list. The list stays on screen and is replaced quietly. |
| C7 | **Notifications.** A mention emails the person mentioned; a reply emails the author of the comment it answers. Never the author themself, never twice for one comment. |
| C8 | **The server is the authority.** Author, access and thread root are stamped by a hook, never sent by the browser. |

If the app already has comment boxes, audit each one against this table and list the gaps before
you change anything.

## Rules

1. **One editor, everywhere.** Every comment box uses the same editor component (formatting
   toolbar, emoji button, Image button, mentions, paste). Never ship a bare textarea as a comment
   box. Check the Buildpad catalogue first ([buildpad-reference](../buildpad-reference/SKILL.md));
   if it has no rich comment editor, build the one described here once and reuse it.
2. **Text, mentions and images are stored apart.** The text is a plain-text markup (bold,
   italic, underline, bullets). A mention is a token inside it: `@[Name](user:<uuid>)`. Images are a
   JSON list of file ids in a `photos` column, uploaded through the files API. Never embed an image
   or HTML in the text.
3. **Keep the true parent and the root.** A reply stores `parent` (the comment it answers) and
   `root` (the first comment of the thread). The hook stamps `root` as the parent's root, or the
   parent's id when the parent is a top-level comment. The browser sends only `parent`.
4. **Replies have no depth limit in the data.** The list indents each level a little less than the
   one before, so a long thread stays on screen. Do not flatten replies into one level.
5. **Every write goes through a hook.** A filter hook on create stamps who wrote it, copies the
   access from the parent or the thing commented on, trims and bounds the text, bounds the number
   of photos, and rewrites any mention token of a person who may not read it into plain `@Name`, so
   a forged id never notifies anyone. See step 3.
6. **Reactions are their own table.** One row per person per emoji per comment, from a fixed list
   the hook checks. Only the person who made a reaction can delete it. Reactions send no email.
7. **Refetch silently.** On a refetch, replace the data; clear it only when a different page opens.
   Reactions update at once (optimistic), then a quiet refetch confirms them.
8. **Never throw from a notification hook.** A mail problem must not undo the comment. Skip
   addresses that cannot receive mail (the `.test` domain, the system account).
9. **Test with throwaway people and remove what you made.** See step 7.

## Steps

### 1. Audit and decide

List every place the app has a comment box or a discussion list. For each, note what it lacks from
the checklist. Decide what the comment attaches to (a ticket, an update, a review) and who may
comment: the usual rule is that anyone who can read the thing may reply, a view-only person
included, while only people who can edit may start a new top-level comment.

### 2. Data model

Add to the comment collection (create it if it does not exist). Use the backend's own tools for
collections, fields and relations; a many-to-one field is created with its relation in one call.

| Field | Type | Notes |
|---|---|---|
| `parent` | many-to-one to the same collection | null on a top-level comment; `SET NULL` on delete |
| `root` | many-to-one to the same collection | the thread's first comment; null on a top-level comment |
| `author` | many-to-one to the users | stamped by the hook |
| `body` | text | the markup above, up to a bound such as 20 000 characters |
| `photos` | json | list of file ids, null when none, at most 20 |
| `created_at` | timestamp | stamped by the hook |
| access columns | as the app already does | copied from the thing commented on or from the parent |

A new `reactions` collection: `id`, `emoji` (string, up to 16), `reacted_by` (users), `created_at`,
the access columns, and one nullable many-to-one per kind of thing that can be reacted to
(`target_comment`, and one more per other kind). Give each target field an alias (a one-to-many
field named `reactions` on the target collection) so a read can nest `reactions.id,reactions.emoji,
reactions.reacted_by` with the comment in one request.

Name columns away from reserved words: `user`, `order`, `update`, `group`, `end`. Use
`reacted_by`, not `user`. The create call refuses `user`.

If comments already exist, **backfill** `root` for every existing reply (`root = parent` when all
of them are one level deep) before the new list reads it. Add the fields first, change the hooks
second, deploy the app last: each step is backward compatible with the one before it, which
matters when the backend is shared with a live app.

### 3. Permissions and hooks

Permissions on the comment collection: read by the same rule as the thing commented on; create
with only the fields the browser may send (`parent`, `body`, `photos`, and the target); **no
update** (comments are immutable; a correction is a new reply) unless the app needs edits; delete
as the app decides. On the reactions collection: read by access, create with `target_*` and
`emoji` only, **delete only where `reacted_by` is the caller**, no update.

The create hook for comments (stored code, a filter on create). Use only `services.items`,
`services.custom` and `services.mail`; do not rely on a raw database client:

```js
const acc = context.accountability || {};
if (!acc.user) throw new Error('Not authenticated');
if (Array.isArray(payload)) throw new Error('Comment one at a time');
const db = async (c) => await services.items(c, { elevated: true });

let parent = null;
if (payload.parent) {
  parent = await (await db('comments')).readOne(payload.parent);
  if (!parent) throw new Error('The comment you are answering was not found');
}
const thing = await (await db('things')).readOne(parent ? parent.thing : payload.thing);
if (!thing) throw new Error('Not found');
if (!canRead(thing, acc.user)) throw new Error('You do not have access');   // the app's own access rule

const body = String(payload.body == null ? '' : payload.body).trim();
const photos = Array.isArray(payload.photos) ? payload.photos : null;
if (photos && (photos.length > 20 || photos.some((p) => typeof p !== 'string'))) throw new Error('Invalid photos');
if (!body && !(photos && photos.length)) throw new Error('A comment needs some text or a photo');
if (body.length > 20000) throw new Error('The comment is too long');

// A mention of someone who cannot read this becomes plain @Name.
const readers = readerIds(thing);                                           // lower-case user ids
const clean = body.replace(/@\[([^\]\n]{1,100})\]\(user:([0-9a-f-]{36})\)/gi,
  (all, name, id) => (readers.includes(id.toLowerCase()) ? all : '@' + name));

return {
  thing: thing.id,
  parent: parent ? parent.id : null,
  root: parent ? (parent.root || parent.id) : null,
  author: acc.user,
  body: clean || null,
  photos: photos && photos.length ? photos : null,
  created_at: new Date().toISOString(),
  // plus the access columns, copied from `parent` or `thing`
};
```

The create hook for reactions checks the emoji against the fixed list (compare with the variation
selector `️` removed, then store the canonical one, so ❤ and ❤️ are the same reaction),
requires exactly one target, requires that the caller can read it, rejects a duplicate
(`reacted_by` + target + `emoji`), and stamps `reacted_by`, the access columns and `created_at`.
A reaction on a draft is refused if the thing has drafts.

### 4. The components

Build once under the app's shared components, and reuse them in every comment box:

- **`EmojiPicker`**: a toolbar button that opens a popover with about 100 curated emojis in four
  tabs (Smileys, Gestures, Work, Other). No dependency. Its buttons use `onMouseDown`
  `preventDefault` so clicking does not steal the text selection from the editor. The editor
  inserts with `editor.chain().focus().insertContent(emoji).run()`.
- **The editor** (text + toolbar + Image button): the toolbar has bold, italic, underline, list,
  the emoji button and the Image button. Mentions use the editor's mention extension, fed with the
  people who can read the thing. The app's existing rich-text editor (TipTap) is the usual base.
- **Paste an image.** Wrap the editor in a container with `onPasteCapture`: if the clipboard
  holds an `image/*` file, call `preventDefault()`, give it a name if it has none
  (`pasted-<time>.png`), and run it through the same upload function as the Image button, with the
  same checks (an image, at most 10 MB). Do not touch a paste that holds only text.
- **`ReactionBar`**: one chip per emoji in use (count, highlighted when mine, the names in the
  tooltip), a "+" that opens the allowed emojis, and a click that adds or removes my own reaction.
  Update local state first, call the API, then ask the page to refetch quietly. On failure, put the
  state back and show the message.
- **The thread list.** Build a tree from the flat list (children by `parent`, oldest first at each
  level, a comment whose parent is not loaded stays at the top with a "replying to" line). Render it
  recursively: each comment shows its text, its photos, its reactions and a Reply button that opens
  the editor under that comment. Indent each level less than the last (for example 41 px for the
  first level and 22 px for each deeper one). Guard the recursion against a cycle.

### 5. Loading

One query for the thread, whatever the depth: read the top-level comments, then the replies with
`root` in the top-level ids (batch the ids in groups of 40). Nest `photos` and the reactions with
the comment (`reactions.id,reactions.emoji,reactions.reacted_by`). Keep the data on screen while it
refetches: clear it only when the key (the page, the week, the record) changes, with a ref that
remembers what is shown.

### 6. Notifications

Write one service (stored code) and two action hooks (create). Skip the author, skip anyone already
mentioned (they get the mention email only), skip addresses that cannot receive mail, and never
throw out of the hook:

- **Mention:** email each person mentioned in a new comment who can read it (at most 10).
- **Reply:** email the author of the comment that was answered. Say "your comment" when that comment
  is itself a reply, "your update" (or the app's word) when it is the top one.
- Give the email a link that opens the page on that comment.

### 7. Prove it

Run the built app on a free port and drive it with Playwright as two throwaway users (an owner and
an editor on a reserved test domain such as `@example.test`, which the mail code skips). Check, as
data and as screenshots:

- a thread four levels deep renders in one thread, and a reply to the deepest comment nests under it;
- `parent` and `root` are stored as expected for every reply;
- the emoji picker inserts into the editor, and the emoji is stored in the body;
- an image pasted from the clipboard attaches and is stored in `photos` (dispatch a `ClipboardEvent`
  with a `DataTransfer` holding a `File`);
- reactions toggle, counts add up across two people, a duplicate and an emoji outside the list are
  refused, and only your own reaction can be deleted;
- while a reply posts, the list never disappears (sample the page every 15 ms and count blank frames);
- a mention of a non-reader becomes plain text.

Then **remove everything you made, by explicit id**: reactions first, then comments deepest first
(a child is always newer than its parent, so delete by `created_at` descending), then files, then
the throwaway users. Compare the row counts with the ones you took before. Never delete files or
rows from a filtered list you have not checked, because some tools ignore the filter.

## Pitfalls

- **Reserved column names** (`user`, `update`, `order`) fail at create time. Rename them.
- **A hook change is live at once** and has no history. Save the old code before replacing it, and
  keep the order: fields, hooks, then the app.
- **Emoji with a variation selector** (❤️) compare unequal to their bare form. Normalise both sides.
- **A nested block contains its children's text.** When a test looks for "the reply that says X",
  match the innermost block (`.last()`), or it will click the parent's button.
- **Screenshots of emoji** in a headless Linux browser may show empty boxes for newer emoji: the
  machine has no colour-emoji font. The data is right; do not "fix" the app for it.
- **Do not make replies one level deep "to keep it simple".** It is the one limit people notice
  first, and it forces a second migration later.
- **A comment box that clears its list on refetch** looks like the page crashed. Test it.

## Related skills

[create-component](../create-component/SKILL.md) (check the catalogue before you build a component),
[hooks-extensions](../hooks-extensions/SKILL.md) (the stored-code rules), [create-service](../create-service/SKILL.md)
(the notification service), [add-files](../add-files/SKILL.md) (the upload hook the Image button uses),
[create-tests](../create-tests/SKILL.md) (Playwright setup).
