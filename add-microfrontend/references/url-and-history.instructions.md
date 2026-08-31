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

## Limit: modals and notifications are clipped

A Mantine `Modal` inside a micro-app cannot paint outside the frame. It covers the
frame area, not the host shell. The same is true of notifications and of any floating
element near the frame edge.

Accept this for anything the user reads inside the section. For a confirmation that
must cover the whole page, send `NAVIGATE` or add an `OPEN_MODAL` message to the
protocol and render the dialog in the host.

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

Only listed parameters cross the boundary, in either direction. Keep the list short.

```tsx
<MicroappIframe allowedParams={['search', 'page', 'sort', 'status']} />
```

Internal micro-app state, for example `_tab` or `_modal`, stays inside the frame.
