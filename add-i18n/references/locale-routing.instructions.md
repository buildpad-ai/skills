---
name: Locale Routing
description: Copy-pasteable implementation of locale-prefixed routing for a Buildpad app — locale config, middleware negotiation composed with the Supabase auth middleware, the app/[lang] root layout, server-loaded dictionaries handed to an I18nProvider, locale-aware navigation, the LanguageSwitcher, and micro-app propagation.
applyTo: "**/*.{ts,tsx,json}"
---

# Locale Routing

All code below assumes the CLI-scaffolded layout (`buildpad bootstrap`): Supabase middleware in `lib/supabase/middleware.ts`, `publicOrigin()` in `lib/origin.ts`, Buildpad components in `components/ui`, and `lib/buildpad/*`. Adjust import paths if the project uses `src/`.

---

## 1. Locale config

`lib/i18n/config.ts` — the only file that knows which locales exist.

```ts
/**
 * Locale configuration — single source of truth for middleware negotiation,
 * the [lang] route param, dictionaries, and the DaaS `languages.code` values.
 */
export const locales = ["en", "id"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeMeta: Record<Locale, { name: string; direction: "ltr" | "rtl" }> = {
  en: { name: "English", direction: "ltr" },
  id: { name: "Bahasa Indonesia", direction: "ltr" },
};

/** Written by the LanguageSwitcher; read by middleware before Accept-Language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function hasLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** "/id/content/articles" → "id"; "/content" → null */
export function getLocaleFromPathname(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return hasLocale(first) ? first : null;
}

/** "/id/content/articles" → "/content/articles"; "/id" → "/" */
export function stripLocale(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname;
  return pathname.slice(locale.length + 1) || "/";
}

/** localeHref("id", "/content") → "/id/content". API and absolute URLs pass through. */
export function localeHref(locale: Locale, path: string): string {
  if (path.startsWith("/api/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const clean = stripLocale(path);
  return `/${locale}${clean === "/" ? "" : clean}`;
}
```

The `code` column of the DaaS `languages` collection must contain exactly these values (`en`, `id`) — see the content-translations reference.

---

## 2. Middleware

### 2a. Negotiation — `lib/i18n/negotiate.ts`

```ts
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import { defaultLocale, hasLocale, locales, LOCALE_COOKIE, type Locale } from "./config";

/** Precedence: NEXT_LOCALE cookie (explicit choice) → Accept-Language → defaultLocale. */
export function negotiateLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(cookie)) return cookie;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const languages = new Negotiator({ headers }).languages();

  try {
    const matched = match(languages, locales as unknown as string[], defaultLocale);
    return hasLocale(matched) ? matched : defaultLocale;
  } catch {
    return defaultLocale; // Negotiator can yield "*" or malformed tags; match() throws on them
  }
}
```

### 2b. Root middleware — `middleware.ts` (or `proxy.ts` on Next.js 16)

Replaces the CLI template (`@buildpad/origin: middleware`). The locale redirect runs **before** `updateSession`, so it never discards a refreshed session cookie; the prefixed request that follows goes through the full session refresh.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { publicOrigin } from "@/lib/origin";
import { getLocaleFromPathname } from "@/lib/i18n/config";
import { negotiateLocale } from "@/lib/i18n/negotiate";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Page request without a locale prefix → redirect to the negotiated locale.
  // /api/* is never prefixed and goes straight to the session refresh.
  if (!pathname.startsWith("/api") && !getLocaleFromPathname(pathname)) {
    const locale = negotiateLocale(request);
    // publicOrigin(): behind a proxy request.nextUrl names the server process,
    // and redirects emit an absolute Location header (see lib/origin.ts).
    const url = new URL(`/${locale}${pathname === "/" ? "" : pathname}`, publicOrigin(request));
    url.search = search;
    return NextResponse.redirect(url);
  }

  const response = await updateSession(request);
  // Every response depends on session state — never let a shared cache store it.
  response.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
```

On Next.js 16 with `proxy.ts`, the body is identical: `export default async function proxy(request: NextRequest) { ... }`.

### 2c. Supabase middleware — `lib/supabase/middleware.ts`

Only the route-gating block changes (`@buildpad/origin: supabase/middleware`). Everything above `supabase.auth.getUser()` stays exactly as scaffolded.

```ts
import { defaultLocale, getLocaleFromPathname, stripLocale } from "@/lib/i18n/config";
// ...existing imports and createServerClient setup unchanged...

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const path = stripLocale(pathname); // compare routes without the locale prefix

  const publicRoutes = ["/login", "/signup", "/auth", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));
  const isApiRoute = path.startsWith("/api");

  if (!user && !isPublicRoute && !isApiRoute) {
    const url = new URL(`/${locale}/login`, publicOrigin(request));
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
```

If the app also redirects signed-in users away from `/login`, prefix that target too (`/${locale}/`).

---

## 3. Route tree — retrofit map

Move pages and layouts; keep API routes and static assets. `app/layout.tsx` must not survive alongside `app/[lang]/layout.tsx`.

| CLI-scaffolded target | New location |
| --- | --- |
| `app/layout.tsx` | `app/[lang]/layout.tsx` (rewritten, §4) |
| `app/(authenticated)/layout.tsx` | `app/[lang]/(authenticated)/layout.tsx` |
| `app/(authenticated)/page.tsx` | `app/[lang]/(authenticated)/page.tsx` |
| `app/login/page.tsx` | `app/[lang]/login/page.tsx` |
| `app/content/**` | `app/[lang]/content/**` |
| `app/(authenticated)/{users,roles,policies,module-access-keys}/**` | `app/[lang]/(authenticated)/…` |
| `app/(authenticated)/files/**`, `forms/**` | `app/[lang]/(authenticated)/…` |
| `app/select-scope/page.tsx` | `app/[lang]/select-scope/page.tsx` |
| `app/api/**` | **unchanged** |
| `app/globals.css`, `app/design-tokens.css` | **unchanged** (imported as `../globals.css`) |

Playwright tests that `goto('/content/...')` still work (the middleware redirects), but assertions on `page.url()` must expect the prefix.

---

## 4. Root layout — `app/[lang]/layout.tsx`

Derived from the CLI's `app/layout.tsx`; this is the only server component in the app, so all locale plumbing lives here.

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ColorSchemeScript,
  DirectionProvider,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "../design-tokens.css";
import "../globals.css";
import { theme } from "@/lib/theme";
import { hasLocale, locales, localeMeta } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

type Params = Promise<{ lang: string }>;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dictionary = await getDictionary(lang);
  return { title: dictionary.app.brand, description: dictionary.app.description };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Params }>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  const direction = localeMeta[lang].direction;

  return (
    <html lang={lang} dir={direction} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body className={inter.variable}>
        <DirectionProvider initialDirection={direction} detectDirection={false}>
          <MantineProvider theme={theme} defaultColorScheme="auto">
            <ModalsProvider>
              <Notifications position="top-right" />
              {/* Static locale + dictionary only — safe in the root layout (Bug 22 concerns auth state). */}
              <I18nProvider locale={lang} dictionary={dictionary}>
                {children}
              </I18nProvider>
            </ModalsProvider>
          </MantineProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
```

`hreflang`: only public pages are crawlable (everything else sits behind the auth redirect). If the user wants it, add `alternates: { languages: { en: "/en/login", id: "/id/login", "x-default": "/en/login" } }` to `generateMetadata` in `app/[lang]/login/page.tsx` — not in the layout, where it would mislabel every authenticated route.

---

## 5. Dictionaries and provider

### 5a. `lib/i18n/types.ts`

```ts
import type en from "./dictionaries/en.json";

/** Every locale file must match this shape — a missing key is a type error in dictionaries.ts. */
export type Dictionary = typeof en;
```

### 5b. `lib/i18n/dictionaries.ts`

```ts
import "server-only";
import type { Locale } from "./config";
import type { Dictionary } from "./types";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  id: () => import("./dictionaries/id.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
```

### 5c. `lib/i18n/dictionaries/en.json`

Two namespaces: `app` for your pages, `buildpad` for the overrides Buildpad components accept today. Keep content out of here.

```json
{
  "app": {
    "brand": "Buildpad App",
    "description": "DaaS-ready Next.js app",
    "common": {
      "language": "Language",
      "loading": "Loading...",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "search": "Search",
      "noResults": "No results",
      "showing": "Showing {start} to {end} of {total}"
    },
    "nav": { "home": "Home", "content": "Content", "files": "Files", "users": "Users" },
    "login": {
      "title": "Sign in",
      "email": "Email",
      "password": "Password",
      "submit": "Sign in",
      "emailRequired": "Email is required",
      "emailInvalid": "Invalid email",
      "failed": "Sign in failed"
    }
  },
  "buildpad": {
    "table": { "loading": "Loading...", "noItems": "No items" },
    "listM2M": {
      "create_new": "Create New",
      "add_existing": "Add Existing",
      "no_items": "No related items",
      "loading": "Loading...",
      "search_placeholder": "Search...",
      "select_items": "Select Items",
      "add_selected": "Add Selected",
      "item_count_one": "1 item",
      "item_count_other": "{count} items",
      "edit": "Edit",
      "remove": "Remove"
    }
  }
}
```

### 5d. `lib/i18n/provider.tsx`

```tsx
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { localeMeta, type Locale } from "./config";
import type { Dictionary } from "./types";

type Values = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  dictionary: Dictionary;
  /** t("app.login.submit") · t("app.common.showing", { start: 1, end: 10, total: 42 }) */
  t: (path: string, values?: Values) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Same `{placeholder}` convention as the ListM2M `translations` prop. */
export function interpolate(template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(/{(\w+)}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

function lookup(dictionary: Dictionary, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>(
    (node, key) =>
      node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
    dictionary,
  );
  return typeof value === "string" ? value : undefined;
}

export function I18nProvider({
  locale,
  dictionary,
  timeZone = process.env.NEXT_PUBLIC_TIMEZONE ?? "UTC",
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  /** Pin a zone so server and client render the same date string (avoids hydration mismatches). */
  timeZone?: string;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: localeMeta[locale].direction,
      dictionary,
      t: (path, values) => interpolate(lookup(dictionary, path) ?? path, values),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(locale, { timeZone, ...(options ?? { dateStyle: "medium" }) }).format(
          new Date(input),
        ),
      formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
    }),
    [locale, dictionary, timeZone],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() must be used under <I18nProvider> — mount it in app/[lang]/layout.tsx");
  }
  return ctx;
}
```

### 5e. Using the dictionary

```tsx
"use client";
import { useI18n } from "@/lib/i18n/provider";
import { ListM2M, VForm, VTable } from "@/components/ui";

export function Example() {
  const { t, locale, dictionary, formatDate } = useI18n();
  return (
    <>
      <h1>{t("app.nav.content")}</h1>
      <span>{formatDate(item.date_created)}</span>

      {/* Overrides the Buildpad components accept today */}
      <ListM2M translations={dictionary.buildpad.listM2M} /* ...props */ />
      <VTable loadingText={t("buildpad.table.loading")} noItemsText={t("buildpad.table.noItems")} /* ... */ />
      <VForm locale={locale} /* field labels resolve from daas_fields.translations */ />
    </>
  );
}
```

`CollectionList`, `CollectionForm`, `FileManager`, `UsersManager`, and the remaining interfaces expose no text props — leave their English chrome alone until Buildpad UI ships its provider.

---

## 6. Locale-aware navigation — `lib/i18n/navigation.ts`

```ts
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { hasLocale, localeHref, LOCALE_COOKIE, stripLocale } from "./config";
import { useI18n } from "./provider";

/** Drop-in for useRouter() whose push/replace prefix the active locale. */
export function useLocaleRouter() {
  const router = useRouter();
  const { locale } = useI18n();
  return useMemo(
    () => ({
      locale,
      href: (path: string) => localeHref(locale, path),
      push: (path: string) => router.push(localeHref(locale, path)),
      replace: (path: string) => router.replace(localeHref(locale, path)),
      back: () => router.back(),
    }),
    [router, locale],
  );
}

/** Writes the cookie the middleware reads, then re-enters the current route under the new prefix. */
export function useSwitchLocale() {
  const router = useRouter();
  return useCallback(
    (next: string) => {
      if (!hasLocale(next) || typeof window === "undefined") return;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      const rest = stripLocale(window.location.pathname);
      router.push(`${localeHref(next, rest)}${window.location.search}`);
    },
    [router],
  );
}
```

Migration pattern for scaffolded pages:

```tsx
// before
const router = useRouter();
router.push(`/content/${collection}/${item.id}`);

// after
const router = useLocaleRouter();
router.push(`/content/${collection}/${item.id}`);
```

Links: `<Link href={localeHref(locale, "/users")}>`. Active-state checks: `stripLocale(pathname).startsWith("/content")`.

`AuthenticatedShell` (`components/layout/AuthenticatedShell.tsx`, design-system module) renders `navItems[].href` directly and derives the active item from `pathname`. Wrap it: create `components/layout/LocalizedShell.tsx` (`'use client'`) that maps `DEFAULT_NAV_ITEMS` through `localeHref` and passes `navItems`, then render the wrapper from `app/[lang]/(authenticated)/layout.tsx`. This keeps the shell file itself pristine for upgrades.

---

## 7. LanguageSwitcher — `components/LanguageSwitcher.tsx`

```tsx
"use client";

import { SelectDropdown } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { hasLocale, locales, localeMeta } from "@/lib/i18n/config";
import { useSwitchLocale } from "@/lib/i18n/navigation";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Best-effort: remember the choice on the DaaS user profile so it can seed the
 * cookie on the next device. DaaS allows a user to PATCH their own `language`
 * via /api/users/me. Direct DaaS call — same pattern as lib/buildpad/hooks/useUsers.ts,
 * which requires DaaS CORS to list this app's origin explicitly.
 */
async function persistUserLanguage(language: string) {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL}/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language }),
    });
  } catch {
    // The cookie already carries the choice; the profile is a convenience.
  }
}

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const switchLocale = useSwitchLocale();

  return (
    <SelectDropdown
      value={locale}
      allowNone={false}
      placeholder={t("app.common.language")}
      choices={locales.map((code) => ({ text: localeMeta[code].name, value: code }))}
      onChange={(value) => {
        if (typeof value !== "string" || !hasLocale(value) || value === locale) return;
        void persistUserLanguage(value);
        switchLocale(value);
      }}
    />
  );
}
```

Seeding from the profile: `/api/auth/user` proxies DaaS `/users/me`, whose payload includes `language`. If the app wants the stored preference to win on first visit, have the authenticated layout's client wrapper compare `user.language` with the active locale **once** when no `NEXT_LOCALE` cookie exists and call `switchLocale` — never in middleware (it would need a DaaS call per request).

---

## 8. Micro-app locale propagation

The reference `MicroappIframe` (from add-microfrontend) syncs **query params only** (`allowedParams`, both directions) and sends exactly one host-to-child message, `SET_AUTH`. Path segments never cross the boundary.

**Baseline (no contract change):** run add-i18n in each micro-app, then interpolate the host locale into the iframe path. A locale switch changes `src`, so the iframe reloads — acceptable.

```tsx
// host: app/[lang]/(authenticated)/admin/users/page.tsx
const { locale } = useI18n();
<MicroappIframe app="users" path={`/${locale}/users`} allowedParams={["search", "page", "sort"]} />
```

**Live switching (optional):** add a `SET_LOCALE` message modeled on `SET_AUTH`.

```ts
// host, next to the SET_AUTH send — same targetOrigin rules (never "*")
iframeRef.current?.contentWindow?.postMessage({ type: "SET_LOCALE", locale }, resolvedOrigin);

// micro-app: in the same `message` listener that validates event.origin === HOST_ORIGIN
if (event.data?.type === "SET_LOCALE" && hasLocale(event.data.locale)) {
  document.cookie = `${LOCALE_COOKIE}=${event.data.locale}; path=/; max-age=31536000; SameSite=Lax`;
  router.replace(localeHref(event.data.locale, stripLocale(window.location.pathname)));
}
```

**Auth bridge:** the micro-app's post-`SET_AUTH` redirect (`window.location.href = '/content'`) must become `localeHref(getLocaleFromPathname(window.location.pathname) ?? defaultLocale, '/content')`, and its `publicRoutes` gate must strip the locale as in §2c.

Document both additions in the project's micro-app contract notes (the "coupling list" in add-microfrontend's iframe-composition reference).
