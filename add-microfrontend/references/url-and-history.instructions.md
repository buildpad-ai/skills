# URL, History, Layout

## Rule: the iframe `src` is frozen at mount

`src` depends on the micro-app origin and the route path only. It must never depend on
the host `searchParams`.

A `src` that reads `searchParams` creates a loop:

1. The user types in the micro-app search box.
2. The micro-app posts `QUERY_PARAMS_CHANGE`.
3. The host calls `router.replace()` with the new query string.
4. The host `searchParams` changes, so the computed `src` changes.
5. React writes the new `src`, and the browser reloads the frame.
6. The micro-app remounts. Focus and input state are lost.

Every debounced keystroke reloads the micro-app.

Host-side changes travel as `SET_QUERY_PARAMS` messages instead. `useMicroappHost.ts`
implements this.

## Rule: every embedding page needs a Suspense boundary

`useMicroappHost` reads `useSearchParams()`. On Next.js 16, a statically prerendered
page that renders `MicroappIframe` without a `Suspense` boundary fails `next build`
with "useSearchParams() should be wrapped in a suspense boundary". Wrap the frame
(SKILL Step 3 shows the pattern); the same applies to the `/login` page around
`LoginBridge`.

## Rule: drop the echo on both sides

The host records the parameter set it received in `lastFromMicroappRef`. Before it
sends `SET_QUERY_PARAMS`, it compares the current host parameters with that value and
skips a match.

The micro-app records the parameter set it received in `lastFromHostRef`. Before it
posts `QUERY_PARAMS_CHANGE`, it compares and skips a match.

Without both guards the two apps push the same value back and forth.

## Rule: `replace` for state, `push` for sections

Iframe navigations enter the browser's joint session history. Without this rule the
host back button walks through invisible micro-app states.

| Change                                    | Call                                              |
| ----------------------------------------- | ------------------------------------------------- |
| Search, filter, sort, page inside a frame | `router.replace()` on both sides                  |
| Redirect after the auth handshake         | `window.location.replace()`                       |
| A different record inside the same frame  | `router.push()` in the micro-app only             |
| A different host section                  | `NAVIGATE` message, then `router.push()` in host  |

Never use `window.location.href = ...` after the handshake. It leaves the failed
`/login` attempt in history, and the back button returns to it.

## Rule: one scroll container

The frame fills its area in the host shell. The micro-app scrolls inside the frame.

- The host container sets a fixed height and `overflow: hidden`.
- The host page around the frame does not scroll.
- The micro-app body scrolls normally.

Do not combine this with a growing frame. Two scrollbars appear when the host page and
the frame both scroll.

`RESIZE` exists for the other strategy: a short embedded widget that must show all its
content with no inner scrollbar. Use `RESIZE` only for that case. Wire it up with the
`onResize` option of `useMicroappHost`, and set the frame height from the reported
value.

## Limit: a framed modal stops being modal

A framed Mantine `Modal` is **not** clipped. Measured framed against standalone, at
1440x900 and at 1280x720, and stress-tested with bodies grown by 400, 1200, and 3000
pixels:

- `Modal.Inner` is `position: fixed` in the **frame** viewport, so it centres in the
  frame.
- Its height is capped at 90% of the frame viewport and its width at 100%, so it always
  fits. A tall body scrolls inside the modal.
- Nothing was cut off at the top, bottom, or right in any of the cases, and the confirm
  button hit-tested and was reachable by scrolling in every one.

The only size cost is a smaller budget: 712.8 px of modal height inside the frame
against 810 px standalone at a 1440x900 host. Do not go hunting a clipping bug.

What actually breaks is **modality**. The overlay and the focus trap end at the frame
edge:

- The host sidebar, header, and buttons stay undimmed and stay clickable while the
  dialog is open.
- One stray click in the host chrome navigates the host and discards the dialog. In a
  measured run, a click on the host `Users` nav link while a destructive
  bulk-delete confirm was open navigated `/files` → `/users`, destroying both the
  pending confirmation and the file selection. Going back remounted the frame with the
  modal closed and the selection empty.
- Escape does close the framed modal, and Tab focus does stay inside the frame.

Escalate to the host for **any destructive or unsaved-state confirmation**: send
`NAVIGATE`, or add an `OPEN_MODAL` message to the protocol and render the dialog in the
host, where the overlay covers the whole page. A read-only dialog the user only reads
inside the section can stay in the frame.

Notifications and floating elements near the frame edge are bounded by the frame in the
same way.

Native dialogs never work: `window.confirm`, `window.alert`, and `window.prompt` are
blocked because the sandbox omits `allow-modals`. Do not add that flag. Use Mantine
`Modal` or `modals.openConfirmModal`.

## Theme and locale

The host color scheme and locale do not reach the micro-app on their own.

- Send `SET_THEME` when the host color scheme changes.
  `MicroappBridgeProvider` applies it with `useMantineColorScheme().setColorScheme`.
- Send `SET_LOCALE` the same way, or forward the locale as an allowlisted query
  parameter at mount.

Send the current value once after `MICROAPP_LOADED` as well. A frame that mounts later
than the last theme change would otherwise keep the default.

## `allowedParams`

Only listed parameters cross the boundary, in either direction. `pickParams()` drops
everything else on **both** sides. Keep the list short, and derive it from what the
framed page really syncs:

```tsx
// The users section syncs the selected record id, and nothing else.
<MicroappIframe allowedParams={['user']} />
```

A parameter the micro-app posts and the host does not allow is discarded in silence. It
looks like a working sync inside the frame and never reaches the host URL. This was
measured: the users wrapper posted `user`, the host allowed
`['search','page','sort','status']`, and clicking a row changed the frame while the host
URL stayed on `/users` — after which browser Back left the app entirely.

A generic `['search','page','sort','status']` default is wrong for a CLI module. Those
modules hold `search`, `page`, `sort`, and `view` in private `useState` and expose no
controlled prop, so none of those names is reachable. See SKILL Step 4 for what can be
synced instead.

Internal micro-app state, for example `_tab` or `_modal`, stays inside the frame.

## Limit: the bridge mirrors query parameters, not paths

`QUERY_PARAMS_CHANGE` carries a query string. There is no path-change message from the
micro-app, so a `router.push('/policies/<id>')` inside the frame moves the frame while
the host URL and breadcrumb stay on the old section. The result is unshareable and
un-backable.

Two consequences when a module ships cross-links (the Users module links a user to
`/policies/<id>`):

1. Give the host a page for every framed route the module can reach, and add each to
   the host navigation. A module route with no host counterpart is dead in the product.
2. Send the existing `NAVIGATE` micro-app → host message on a cross-section link, and
   let the host `router.push()` its own route. Nothing sends it by default.

A URL-sync wrapper over a module route also leaves that module's own `[id]` route
unused: `/users?user=<id>` becomes the live detail view while `/users/<id>` stays
reachable only by direct URL. **Do not delete or rewrite it** — it carries
`@buildpad-origin` and Rule 9 applies. Leave it in place: standalone visits and deep
links still use it, and an unused route costs nothing.
