---
name: add-keyboard-shortcuts
description: "Add Atlassian-style keyboard shortcuts to a Buildpad app, or bring existing ones up to the standard: single keys (c to create, / to search, [ to fold the sidebar, ] for the details panel), two-key sequences (g then h to go home), Ctrl/Cmd+K, Esc that closes only the topmost layer, j/k to move through lists, and a ? dialog that lists every shortcut. Covers the one shortcut registry, the shared hook, the rule that shortcuts never fire while typing, macOS vs Windows labels, aria-keyshortcuts and tooltips, keys pressed inside sandboxed iframes, a per-user switch to turn shortcuts off, and how to prove it with Playwright. Use when the user says add keyboard shortcuts, hotkeys, key bindings, shortcuts like Jira or Confluence, a ? help dialog, press / to search, or g then something to navigate. Not for a text editor's own formatting keys (bold, italic), which belong to the editor."
argument-hint: "[the screens or actions to bind, e.g. issues list, create ticket, search]"
---

# Add Keyboard Shortcuts

Keyboard shortcuts mean the same thing in every Buildpad app, and they follow the conventions
people already know from Jira and Confluence. Someone who presses `?` sees every shortcut. Someone
who presses `c` starts creating the main thing on the screen. Someone who is typing in a field never
triggers a shortcut by accident. Build all of it once, with one registry and one hook, so the next
screen only adds rows to a list.

This skill does not depend on the backend: shortcuts live in the browser and call the same actions
as the buttons. It works the same in Engine and Supabase projects.

## The standard (acceptance checklist)

Shortcuts are done only when every line is true:

| # | Keyboard shortcuts always |
|---|---|
| K1 | **Never fire while typing.** No single-key or sequence shortcut fires in an `input`, `textarea`, `select`, a `contenteditable` element or anything with `role="textbox"`. Only Esc and modifier shortcuts (Ctrl/Cmd+K, Ctrl/Cmd+Enter) work there. |
| K2 | **Come from one registry.** Every shortcut is a row in one list (key, label, group, scope). The help dialog, the tooltips and the handlers all read that list, so they cannot disagree. |
| K3 | **Have a `?` dialog.** `?` (Shift+/) opens a dialog that lists every shortcut active on this screen, grouped (Global, Navigation, This page), with each key drawn as a `<kbd>`. |
| K4 | **Show on the button.** Every button with a shortcut has `aria-keyshortcuts` and a tooltip such as `Create (c)`. |
| K5 | **Respect layers.** Esc closes only the topmost layer (menu, then dialog, then drawer, then full view). While a dialog or menu is open, page shortcuts are off. |
| K6 | **Label the right modifier.** Show `⌘` on macOS and `Ctrl` elsewhere; the handler accepts `metaKey` on macOS and `ctrlKey` elsewhere. |
| K7 | **Do not take the browser's keys.** Never bind Ctrl/Cmd+T, W, N, L, R, P, Tab or F5, and never call `preventDefault` on a key you do not handle. |
| K8 | **Can be turned off.** A user setting (stored per user, not per browser) turns off single-key shortcuts. Modifier shortcuts and Esc stay on. |
| K9 | **Work inside embedded pages.** A sandboxed iframe that the app renders forwards the app's shortcut keys to the parent page. |

If the app already has shortcuts, list every `keydown` listener (`grep -rn "keydown" app components lib`),
audit each against this table, and list the gaps before you change anything.

## The default key map

Use these keys unless the app already teaches others. They are the Atlassian conventions, so people
coming from Jira or Confluence know them already. Bind only the ones that make sense for the app.

| Group | Key | Action |
|---|---|---|
| Global | `?` | Open the keyboard shortcuts dialog |
| Global | `/` | Focus the search box |
| Global | Ctrl/⌘ + `K` | Open search, or the command palette if the app has one |
| Global | `c` | Create the main item of this screen (the same action as the page's Create button) |
| Global | `[` | Show or hide the sidebar |
| Global | `]` | Show or hide the details or comments panel |
| Global | Esc | Close the topmost layer |
| Navigation | `g` then `h` | Go home (dashboard) |
| Navigation | `g` then `s` | Go to search |
| Navigation | `g` then `n` | Go to notifications |
| Navigation | `g` then `p` | Go to my profile or settings |
| Lists | `j` / `k` | Next / previous row |
| Lists | `o` or Enter | Open the selected row |
| Lists | `x` | Select or clear the selected row (when the list has bulk actions) |
| This item | `e` | Edit |
| This item | `m` | Add a comment (focus the comment box) |
| This item | `a` | Assign to someone (when the item has an assignee) |
| This item | `i` | Assign to me |
| Forms | Ctrl/⌘ + Enter | Submit the form or comment |

A sequence (`g` then `h`) waits at most one second for the second key. While it waits, a small hint
such as `g …` may show in a corner.

## Build it

### 1. The registry

One file holds every shortcut. Screens add rows; they never add their own `keydown` listener.

```ts
// lib/shortcuts/registry.ts
export type ShortcutGroup = "Global" | "Navigation" | "Lists" | "This item" | "Forms";

export type Shortcut = {
  id: string;            // "create", "go-home"
  keys: string;          // "c", "g h" (a sequence), "mod+k" (mod = ⌘ on macOS, Ctrl elsewhere), "shift+?"
  label: string;         // "Create", shown in the dialog and the tooltip
  group: ShortcutGroup;
  /** Fires even while typing. Only for Esc and modifier shortcuts (K1). */
  allowInInput?: boolean;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "help", keys: "?", label: "Keyboard shortcuts", group: "Global" },
  { id: "search", keys: "/", label: "Search", group: "Global" },
  { id: "palette", keys: "mod+k", label: "Search everything", group: "Global", allowInInput: true },
  { id: "create", keys: "c", label: "Create", group: "Global" },
  { id: "sidebar", keys: "[", label: "Show or hide the sidebar", group: "Global" },
  { id: "panel", keys: "]", label: "Show or hide the details panel", group: "Global" },
  { id: "go-home", keys: "g h", label: "Go home", group: "Navigation" },
  { id: "go-notifications", keys: "g n", label: "Go to notifications", group: "Navigation" },
  { id: "next", keys: "j", label: "Next row", group: "Lists" },
  { id: "prev", keys: "k", label: "Previous row", group: "Lists" },
  { id: "open", keys: "o", label: "Open the selected row", group: "Lists" },
  { id: "submit", keys: "mod+enter", label: "Submit", group: "Forms", allowInInput: true },
];

export const byId = (id: string) => SHORTCUTS.find((s) => s.id === id);
```

### 2. The provider and hook

A single document listener matches keys against the registry and calls whatever handler the
mounted screen registered for that id. Screens register handlers with `useShortcut(id, fn)`; when
they unmount, the handler goes away, so the dialog lists only what works on this screen.

```tsx
// lib/shortcuts/ShortcutsProvider.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SHORTCUTS, type Shortcut } from "./registry";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.closest) return false;
  return el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');
}

/** A dialog, menu or popover is open: page shortcuts are off (K5). Adjust the selector to the app's layers. */
const layerOpen = () => !!document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]');

function matchesChord(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.toLowerCase().split("+");
  const key = parts.pop()!;
  const mod = parts.includes("mod");
  const wantCtrl = mod ? !isMac() : parts.includes("ctrl");
  const wantMeta = mod ? isMac() : parts.includes("meta");
  if (e.ctrlKey !== wantCtrl || e.metaKey !== wantMeta || e.altKey !== parts.includes("alt")) return false;
  // "?" and other shifted characters: compare e.key, which already includes Shift.
  return e.key.toLowerCase() === key || (key === "enter" && e.key === "Enter");
}

type Ctx = {
  register: (id: string, fn: (e: KeyboardEvent) => void) => () => void;
  active: () => Shortcut[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};
const ShortcutsContext = createContext<Ctx | null>(null);

export function ShortcutsProvider({ children, initialEnabled = true, onEnabledChange }: {
  children: React.ReactNode;
  initialEnabled?: boolean;                 // from the user's stored setting (K8)
  onEnabledChange?: (v: boolean) => void;   // save it to the user's record
}) {
  const handlers = useRef(new Map<string, (e: KeyboardEvent) => void>());
  const pending = useRef<{ first: string; at: number } | null>(null);
  const [enabled, setEnabledState] = useState(initialEnabled);
  const setEnabled = useCallback((v: boolean) => { setEnabledState(v); onEnabledChange?.(v); }, [onEnabledChange]);

  const register = useCallback((id: string, fn: (e: KeyboardEvent) => void) => {
    handlers.current.set(id, fn);
    return () => { if (handlers.current.get(id) === fn) handlers.current.delete(id); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const typing = isTyping(e.target);
      const layer = layerOpen();

      for (const s of SHORTCUTS) {
        const fn = handlers.current.get(s.id);
        if (!fn) continue;
        const single = !s.keys.includes(" ") && !s.keys.includes("+");
        if (typing && !s.allowInInput) continue;           // K1
        if (layer && !s.allowInInput) continue;            // K5
        if (!enabled && single) continue;                  // K8
        if (s.keys.includes(" ")) {
          const [first, second] = s.keys.split(" ");
          const p = pending.current;
          if (p && p.first === first && Date.now() - p.at < 1000 && e.key.toLowerCase() === second && !e.ctrlKey && !e.metaKey && !e.altKey) {
            pending.current = null; e.preventDefault(); fn(e); return;
          }
          continue;
        }
        if (matchesChord(e, s.keys)) { pending.current = null; e.preventDefault(); fn(e); return; }
      }
      // Remember the first key of a sequence ("g"), only when no single shortcut took it.
      if (!typing && !layer && enabled && !e.ctrlKey && !e.metaKey && !e.altKey &&
          SHORTCUTS.some((s) => s.keys.startsWith(e.key.toLowerCase() + " "))) {
        pending.current = { first: e.key.toLowerCase(), at: Date.now() };
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);

  const active = useCallback(() => SHORTCUTS.filter((s) => handlers.current.has(s.id)), []);
  const value = useMemo(() => ({ register, active, enabled, setEnabled }), [register, active, enabled, setEnabled]);
  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts() {
  const c = useContext(ShortcutsContext);
  if (!c) throw new Error("useShortcuts must be used inside ShortcutsProvider");
  return c;
}

/** Bind a registry id to a handler while this component is mounted. */
export function useShortcut(id: string, fn: (e: KeyboardEvent) => void) {
  const { register } = useShortcuts();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => register(id, (e) => ref.current(e)), [id, register]);
}

/** "mod+k" -> "⌘K" on macOS, "Ctrl+K" elsewhere; "g h" -> ["G", "then", "H"]. */
export function keyLabel(keys: string): string[] {
  if (keys.includes(" ")) return keys.split(" ").flatMap((k, i) => (i ? ["then", k.toUpperCase()] : [k.toUpperCase()]));
  return [keys.split("+").map((p) => (p === "mod" ? (isMac() ? "⌘" : "Ctrl") : p === "enter" ? "Enter" : p.length === 1 ? p.toUpperCase() : p)).join(isMac() ? "" : "+")];
}
```

Mount the provider once, in the authenticated layout, inside the Mantine provider. Read
`initialEnabled` from the user's record and save changes back with `services.items` or the users
service; never only `localStorage` (K8).

### 3. Use it on a screen

The shortcut calls the same function as the button, and the button names its key (K4):

```tsx
const create = () => setCreateOpen(true);
useShortcut("create", create);

<Tooltip label="Create (c)">
  <Button onClick={create} aria-keyshortcuts="c">Create</Button>
</Tooltip>
```

For `j`/`k` in a list, keep the selected index in state, give the selected row
`aria-selected="true"` and a visible focus style, and call `scrollIntoView({ block: "nearest" })`
when it changes. `o` or Enter opens the selected row with the same function as a click.

### 4. The `?` dialog

```tsx
// components/shortcuts/ShortcutsDialog.tsx
"use client";
import { Modal, Group, Stack, Text, Kbd, Switch } from "@mantine/core";
import { useState } from "react";
import { useShortcut, useShortcuts, keyLabel } from "@/lib/shortcuts/ShortcutsProvider";

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { active, enabled, setEnabled } = useShortcuts();
  useShortcut("help", () => setOpen(true));
  const list = open ? active() : [];
  const groups = [...new Set(list.map((s) => s.group))];
  return (
    <Modal opened={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" size="lg">
      <Stack>
        {groups.map((g) => (
          <Stack key={g} gap={4}>
            <Text fw={600} size="sm">{g}</Text>
            {list.filter((s) => s.group === g).map((s) => (
              <Group key={s.id} justify="space-between">
                <Text size="sm">{s.label}</Text>
                <Group gap={4}>{keyLabel(s.keys).map((k, i) => k === "then" ? <Text key={i} size="xs" c="dimmed">then</Text> : <Kbd key={i}>{k}</Kbd>)}</Group>
              </Group>
            ))}
          </Stack>
        ))}
        <Switch checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} label="Single-key shortcuts" />
      </Stack>
    </Modal>
  );
}
```

Mount it once next to the provider. Add a "Keyboard shortcuts" item to the user menu or help menu
that opens the same dialog, so people who never press `?` can find it.

### 5. Esc and layers

Mantine's `Modal`, `Drawer` and `Menu` already close on Esc while focus is inside them. Add a
document-level Esc handler only for a layer that must close when focus has left it (for example
after a confirmation dialog closes), and make it close only the topmost one:

```ts
// Esc closes this drawer only when it is the topmost one and no confirmation is open.
if (e.key !== "Escape" || e.defaultPrevented) return;
if (document.querySelector(".app-confirm-root")) return;
const roots = document.querySelectorAll(".app-drawer-root");
if (roots[roots.length - 1] !== rootRef.current) return;
if (rootRef.current?.contains(document.activeElement)) return; // the drawer's own handler takes it
onClose();
```

### 6. Keys pressed inside an iframe (K9)

A key pressed inside a sandboxed iframe never reaches the parent's `document`. If the app renders
user HTML, a microapp or a report in an iframe, inject a small listener into the frame that forwards
the app's keys, and replay them in the parent:

```js
// injected into the frame
window.addEventListener("keydown", function (e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (["Escape", "[", "]", "?"].indexOf(e.key) < 0) return;
  var t = e.target;
  if (t && t.closest && t.closest("input,textarea,select,[contenteditable],[role=textbox]")) return;
  parent.postMessage({ type: "hotkey", key: e.key }, "*");
});
```

```ts
// in the parent: accept only messages from this frame, and only the forwarded keys
if (e.source !== frameRef.current?.contentWindow) return;
if (e.data?.type === "hotkey" && ["Escape", "[", "]", "?"].includes(e.data.key)) {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: e.data.key, bubbles: true, cancelable: true }));
}
```

Forward a short, fixed list of keys, never everything the frame sends.

## Prove it

Write a Playwright test that covers each line of the checklist:

1. `?` opens the dialog and it lists the shortcuts of this screen; Esc closes it.
2. `c` opens the create form; typing `c` inside a text field does not (K1).
3. `/` focuses search; `g` then `h` goes home; `g`, a 1.5-second wait, then `h` does nothing.
4. `j`, `j`, `o` opens the second row.
5. With a dialog open, `c` does nothing (K5); Esc closes the dialog, then the drawer under it.
6. With single-key shortcuts turned off in the dialog, `c` does nothing; after reload it is still
   off (stored per user); Ctrl/⌘+K still works.
7. Every button with a shortcut has `aria-keyshortcuts` (query `[aria-keyshortcuts]` and compare
   with the registry).

Run it in Chromium and WebKit so both the Ctrl and ⌘ labels are checked.

## Done when

- [ ] K1 to K9 are true on every screen that has shortcuts.
- [ ] No component other than the provider adds a `keydown` listener for a shortcut (Esc on a layer,
      iframe forwarding and editor keys are the exceptions).
- [ ] The help dialog is reachable from both `?` and a menu item.
- [ ] The Playwright test passes.
