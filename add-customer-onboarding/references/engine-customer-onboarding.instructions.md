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

# Customer self-onboarding: the flow

In the mode `customer-tenants`, with Self-onboarding on, after steps 1 to 9 of the
[skill](../SKILL.md). A stranger signs up, confirms the email address from a link, signs in, creates
a company (a customer of the application, a tenant of its own) and lands in it.

The guide is for the Next.js App Router with `@supabase/ssr` session cookies, as the sign-in of the
`add-multitenancy` skill's guide `engine-customer-tenants` (section 5) is. Everything that holds
`BUILDPAD_ONBOARDING_KEY` runs on the app's server.

## 1. Files the skill writes

| File | Server only | Holds |
|---|---|---|
| `lib/onboarding/engine.ts` | yes (`import "server-only"`) | the only reader of `BUILDPAD_ONBOARDING_KEY`; `signUp`, `resend`, `verify`, `createCustomer`; the answer mapping |
| `lib/onboarding/client-address.ts` | yes | `clientAddress(request)` |
| `lib/onboarding/human-check.ts` | yes | `verifyHuman` (step 6) |
| `lib/onboarding/mail.ts` | yes | the three messages, built with the app's URL |
| `lib/onboarding/messages.ts` | yes | the person-facing sentences, and `refusalResponse` |
| `lib/mail/send.ts` | yes | `sendMail` (step 5) |
| `app/api/onboarding/signup/route.ts` | route | sign-up |
| `app/api/onboarding/resend/route.ts` | route | a new link |
| `app/api/onboarding/verify/route.ts` | route | verify |
| `app/api/onboarding/customers/route.ts` | route | create your company |
| `app/(auth)/sign-up/page.tsx` + `SignUpForm.tsx` (`'use client'`) | page | sign-up |
| `components/HumanCheck.tsx` (`'use client'`) | page | the bot-check vendor's widget (step 6), or the app's own |
| `app/(auth)/verify-email/page.tsx` + `VerifyEmail.tsx` (`'use client'`) | page | verify, and a new link |
| `app/(auth)/create-company/page.tsx` + `CreateCompanyForm.tsx` (`'use client'`) | page | create your company |
| `lib/auth/tenants.ts`, `app/api/auth/login/route.ts`, the sign-in page (step 4's) | changed | sign-in (section 8) |
| `lib/supabase/middleware.ts` (step 4's) | changed | the unbound session and the public pages (section 8) |

- **Paths.** The paths here are without a locale. In an app with a locale root (the CLI's scaffold
  has `app/[lang]/`), put the pages under it (`app/[lang]/(auth)/sign-up/…`); routes stay under
  `app/api/`. Links in mail and `window.location.assign` use the path without a locale: the
  middleware redirects it to the person's locale, and the `#code=` fragment survives that redirect.
- **Forms.** The pages below use plain `<input>`, `<label>` and `<button>` only to keep the logic
  visible. Build them with the app's own form components (the kit's Buildpad UI inputs and buttons,
  as its `CLAUDE.md` requires), keeping the same state and handlers.

No client component imports anything under `lib/onboarding/`. The routes answer each refusal with
the sentence the page shows, so a client component needs nothing from the server's modules. Never
give the key a `NEXT_PUBLIC_` prefix, and never read it in a client component.

## 2. The module that holds the key

```ts
// lib/onboarding/engine.ts — server only. The one place that reads BUILDPAD_ONBOARDING_KEY.
import "server-only";

const ENGINE = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // the Engine_URL (ES-1)
const CREATE = "/api/onboarding/customers";

export type OnboardingErrorKind =
  | "not_configured"   // no key in this deployment: unset, empty or `off` (404)
  | "key_invalid"      // 401 TOKEN_INVALID: the key is missing, unknown or revoked
  | "closed"           // 403 FORBIDDEN on sign-up, resend or verify
  | "create_closed"    // 403 FORBIDDEN on the create route
  | "quota"            // 403 QUOTA_EXCEEDED: the project's customer limit
  | "engine_too_old"   // 404: the Engine does not serve sign-up yet
  | "too_many"         // 429 REQUESTS_EXCEEDED: a budget; see retryAfter
  | "invalid_email"    // 400 INVALID_PAYLOAD on sign-up or resend
  | "invalid_code"     // 400 INVALID_TOKEN on verify
  | "unauthenticated"  // 401 UNAUTHENTICATED on the create route: no session
  | "no_release"       // 409: no published Release yet
  | "per_identity"     // 409: the person's company limit
  | "id_taken"         // 409: the id belongs to another tenant
  | "conflict"         // 409: any other
  | "busy"             // 503 on the create route: the template-copy lock
  | "unavailable";     // any other answer, or none

export class OnboardingError extends Error {
  constructor(
    public kind: OnboardingErrorKind,
    public status: number,
    public retryAfter?: number,
    public path?: string,
  ) {
    super(kind);
  }
}

/**
 * The key, or null when this deployment has none: unset, empty, or `off` in any case. The Platform
 * sets `off` on Production's branch, because Amplify drops an empty value: sign-up is Development's only.
 */
export function onboardingKey(): string | null {
  const k = process.env.BUILDPAD_ONBOARDING_KEY?.trim();
  return k && k.toLowerCase() !== "off" ? k : null;
}

/** Whether this deployment offers sign-up: the pages, the link and the routes exist only then. */
export const signUpOffered = (): boolean => onboardingKey() !== null;

function key(): string {
  const k = onboardingKey();
  if (!k) throw new OnboardingError("not_configured", 404);
  return k;
}

// The create route's three 409s share the code CONFLICT and carry no extensions. This is the one
// place the app reads an Engine message: by a fixed prefix, never shown to the person.
const NO_RELEASE = "This project has no published release yet";
const PER_IDENTITY = "You have reached the limit of";
const ID_TAKEN = "Another customer already has that id.";

async function mapRefusal(path: string, r: Response): Promise<OnboardingError> {
  const body = await r.json().catch(() => ({}));
  const first = body?.errors?.[0];
  const code: string | undefined = first?.extensions?.code;
  const seconds = Number(r.headers.get("Retry-After"));
  const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  const create = path === CREATE;
  let kind: OnboardingErrorKind = "unavailable";
  if (r.status === 401) kind = code === "UNAUTHENTICATED" ? "unauthenticated" : "key_invalid";
  else if (r.status === 403) kind = code === "QUOTA_EXCEEDED" ? "quota" : create ? "create_closed" : "closed";
  else if (r.status === 404) kind = "engine_too_old";
  else if (r.status === 429) kind = "too_many";
  else if (r.status === 400 && code === "INVALID_TOKEN") kind = "invalid_code";
  else if (r.status === 400 && !create) kind = "invalid_email";
  else if (r.status === 409 && create) {
    const message = String(first?.message ?? "");
    kind = message.startsWith(NO_RELEASE) ? "no_release"
      : message.startsWith(PER_IDENTITY) ? "per_identity"
      : message.startsWith(ID_TAKEN) ? "id_taken"
      : "conflict";
  } else if (r.status === 503 && create) kind = "busy";
  return new OnboardingError(kind, r.status, retryAfter, path);
}

async function call(path: string, body: unknown, opts: { address?: string | null; bearer?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Buildpad-Onboarding-Key": key(),
  };
  if (opts.address) headers["X-Onboarding-Client-Address"] = opts.address;
  if (opts.bearer) headers["Authorization"] = `Bearer ${opts.bearer}`;
  // No Origin header (the Engine refuses one), no X-Tenant-Id (the key names the project).
  let r: Response;
  try {
    r = await fetch(`${ENGINE}${path}`, {
      method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error",
    });
  } catch {
    throw new OnboardingError("unavailable", 502, undefined, path); // no answer
  }
  if (r.ok) return { status: r.status, data: (await r.json()).data };
  throw await mapRefusal(path, r);
}

export const signUp = (email: string, password: string, address: string | null) =>
  call("/api/auth/signup", { email, password }, { address });
export const resend = (email: string, address: string | null) =>
  call("/api/auth/signup/resend", { email }, { address });
export const verify = (code: string, address: string | null) =>
  call("/api/auth/signup/verify", { code }, { address });
export const createCustomer = (accessToken: string, name: string, id: string) =>
  call(CREATE, { name, id }, { bearer: accessToken });
```

- **Answer shapes:**
  - `signUp` and `resend` → `{existing: false, verification: {code, expires_at}}` or
    `{existing: true}`.
  - `verify` → `{identity: {id, email}}`.
  - `createCustomer` → `{id, name, state}`, 201, or 200 for the same person's retry.
- **No bearer on three routes.** Sign-up, resend and verify take no session: an unbound session
  sent there is refused. Only the create route takes the person's access token.
- **`mapRefusal`** reads the status and `errors[0].extensions.code`, and gives one kind per row of
  the skill's Refusals table. It reads the message only for the create route's 409s, which share a
  code. It records 429's `Retry-After` seconds.
- **Logs.** Log only the path, the status and the kind (`refusalResponse` in section 5 does). Never
  log the key, the code, the address, the email or the body.

## 3. The client address

The Engine limits sign-up and resend to 5 per 15 minutes per reported address and key. **Without
the header `X-Onboarding-Client-Address`, every request of the app shares one bucket of 5**, so a
real app must send it. Verify has no per-address limit; its only limit is 10 failures per 15
minutes per key and reported address, so sending the address also keeps one person's typos from
spending another's failures.

- `clientAddress(request)` answers the address the hosting platform set itself, never a value the
  browser could have sent.
- On Amplify Hosting, that is the `CloudFront-Viewer-Address` header without its port. CloudFront
  overwrites a value the browser sends.
- Do not read `X-Forwarded-For` there. CloudFront keeps whatever the browser sent at the front and
  appends the client and then its own edge address, so the first entry is forged and the last is
  CloudFront's.
- It answers `null` unless the value is an IPv4 or IPv6 literal. With `null` the header is not
  sent, and the shared bucket applies.

```ts
// lib/onboarding/client-address.ts — server only.
import "server-only";
import { isIP } from "node:net";

export function clientAddress(request: Request): string | null {
  // Set by CloudFront as "<address>:<port>"; a value the browser sends is overwritten.
  const viewer = request.headers.get("cloudfront-viewer-address")?.trim() ?? "";
  const colon = viewer.lastIndexOf(":");
  if (colon < 0) return null;
  const address = viewer.slice(0, colon).replace(/^\[(.*)\]$/, "$1");
  return isIP(address) ? address : null;
}
```

On another host, find which header that host sets itself, and read only that one. If no header is
reliable, answer `null`, and tell the developer that every sign-up then shares one budget of 5 per
15 minutes.

## 4. The bot check and the mail sender

Step 6 writes `verifyHuman`; step 5 writes `sendMail`. Their interfaces:

```ts
// lib/onboarding/human-check.ts — server only. Its secret is a server variable.
import "server-only";

/** True when the vendor confirms the token the page's widget gave. Never throws. */
export async function verifyHuman(token: string, address: string | null): Promise<boolean> {
  // Example for Cloudflare Turnstile; another vendor has its own verify endpoint.
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Without the secret every check fails: say so in the log, not only "Please complete the check."
    console.error(JSON.stringify({ event: "onboarding.human_check_not_configured" }));
    return false;
  }
  const form = new URLSearchParams({ secret, response: token });
  if (address) form.set("remoteip", address);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: form, cache: "no-store",
    });
    return r.ok && (await r.json()).success === true;
  } catch {
    return false;
  }
}
```

```ts
// lib/mail/send.ts — server only. Wraps the app's mail provider (step 5).
import "server-only";

export type Mail = { to: string; subject: string; text: string; html: string };

/** Sends one message; throws when the provider does not take it. */
export async function sendMail(mail: Mail): Promise<void> {
  // The provider's SDK or HTTP call (or SMTP), with its credentials from server variables the
  // developer names: an API key, or the SMTP host, port, user and password.
}
```

The widget's public site key may carry `NEXT_PUBLIC_`; the secret never does.

A bot-check token is good for one check only. After any refused submit, the form drops its token
and mounts the widget again (section 6), or every retry answers "Please complete the check."

```tsx
'use client';
// components/HumanCheck.tsx — Cloudflare Turnstile as the example. Remount it (a new React key) to reset.
import Script from "next/script";
import { useEffect, useRef } from "react";

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

export default function HumanCheck({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    const mount = () => {
      const turnstile = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (!turnstile || !box.current) return false;
      id = turnstile.render(box.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
      return true;
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!mount()) timer = setInterval(() => { if (mount()) clearInterval(timer); }, 200);
    return () => {
      clearInterval(timer);
      if (id) (window as unknown as { turnstile?: Turnstile }).turnstile?.remove(id);
    };
  }, [onToken]);
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={box} />
    </>
  );
}
```

## 5. Messages and mail

```ts
// lib/onboarding/messages.ts — server only. The sentences the pages show; never the Engine's own.
import "server-only";
import { NextResponse } from "next/server";
import { OnboardingError, signUpOffered, type OnboardingErrorKind } from "@/lib/onboarding/engine";

// The app's name as people see it: ask the developer (step 10). The mail uses it too.
export const APP_NAME = "<the app's name>";

export const SAY = {
  checkEmail: (address: string) => `Check your email. We sent a message to ${address}.`,
  fillIn: "Fill in every field.",
  passwordShort: "Use at least 8 characters.",
  passwordLong: "Use a shorter password.",
  humanCheck: "Please complete the check.",
  mailFailed: "We could not send the email. Try again.",
  companyName: "Enter your company's name (up to 100 characters).",
  signIn: "Sign in first.",
};

const REFUSAL: Record<OnboardingErrorKind, string> = {
  not_configured: "Sign-up is not available right now.",
  key_invalid: "Sign-up is not available right now.",
  engine_too_old: "Sign-up is not available right now.",
  closed: "Sign-ups are closed right now.",
  create_closed: "Creating companies is closed right now.",
  quota: `Sign-ups are full right now. Contact ${APP_NAME}'s team.`,
  too_many: "Too many attempts. Try again in a few minutes.",
  invalid_email: "Enter a valid email address.",
  invalid_code: "This link has expired or was already used.",
  unauthenticated: "Sign in first.",
  no_release: "Companies cannot be created yet. Try again later.",
  per_identity: "You have reached the number of companies you can create.",
  id_taken: "We could not create your company. Try again later.", // the form makes a new id first
  conflict: "We could not create your company. Try again later.",
  busy: "Creating your company is taking longer than usual…",
  unavailable: "Something went wrong. Try again.",
};

/** The JSON body, or null. Only application/json: a cross-site form cannot send it. */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return null;
  return request.json().catch(() => null);
}

/** The route's answer to a refusal: the page's sentence, and a log line for the developer. */
export function refusalResponse(e: unknown): NextResponse {
  const err = e instanceof OnboardingError ? e : new OnboardingError("unavailable", 502);
  // Only the path, the status and the kind: onboarding.key_invalid, onboarding.no_release, ...
  console.warn(JSON.stringify({ event: `onboarding.${err.kind}`, path: err.path, status: err.status }));
  let message = REFUSAL[err.kind];
  if (err.kind === "too_many" && err.retryAfter) {
    message = `Too many attempts. Try again in ${Math.max(1, Math.ceil(err.retryAfter / 60))} minutes.`;
  }
  // No key: the flow is not offered here (404). The browser never sees the key's 401 or the
  // Engine's 404 as such.
  const status = err.kind === "not_configured" ? 404
    : ["key_invalid", "engine_too_old"].includes(err.kind) ? 503
    : err.status >= 400 && err.status < 600 ? err.status : 502;
  const headers: Record<string, string> = err.retryAfter ? { "Retry-After": String(err.retryAfter) } : {};
  return NextResponse.json({ error: { kind: err.kind, message } }, { status, headers });
}

/** Each onboarding route's first line: 404 where this deployment has no key, before anything else. */
export function notOffered(): NextResponse | null {
  return signUpOffered() ? null : refusalResponse(new OnboardingError("not_configured", 404));
}
```

```ts
// lib/onboarding/mail.ts — server only. The three messages, built with the app's configured URL.
import "server-only";
import { sendMail } from "@/lib/mail/send";
import { APP_NAME } from "@/lib/onboarding/messages";

// The app's public origin as lib/origin.ts reads it, never the request's Host: a forged host
// cannot point the mail elsewhere. Unset, no mail is built (the route answers "We could not send
// the email") rather than a link to "undefined/verify-email".
function appUrl(): string {
  const configured = process.env.HOST_ORIGIN ?? process.env.NEXT_PUBLIC_HOST_ORIGIN;
  if (!configured) {
    console.error(JSON.stringify({ event: "onboarding.origin_not_configured" }));
    throw new Error("HOST_ORIGIN is not set");
  }
  return new URL(configured).origin;
}

// The code travels in the fragment, so it reaches no server log and no Referer.
const verifyLink = (code: string) => `${appUrl()}/verify-email#code=${encodeURIComponent(code)}`;

export async function mailConfirm(to: string, code: string) {
  const link = verifyLink(code);
  await sendMail({
    to, subject: `Confirm your email for ${APP_NAME}`,
    text: `Open this link to confirm your email address for ${APP_NAME}: ${link}\nIt expires in 24 hours.`,
    html: `<p><a href="${link}">Confirm your email address</a>.</p><p>The link expires in 24 hours.</p>`,
  });
}

export async function mailNewLink(to: string, code: string) {
  const link = verifyLink(code);
  await sendMail({
    to, subject: `Your new confirmation link for ${APP_NAME}`,
    text: `Here is a new link to confirm your email address: ${link}\nIt expires in 24 hours. Earlier links no longer work.`,
    html: `<p><a href="${link}">Confirm your email address</a>.</p><p>The link expires in 24 hours. Earlier links no longer work.</p>`,
  });
}

export async function mailExisting(to: string) {
  const link = `${appUrl()}/login`;
  await sendMail({
    to, subject: `You already have an account at ${APP_NAME}`,
    text: `Someone tried to sign up at ${APP_NAME} with this address, which already has an account. Sign in: ${link}`,
    html: `<p>Someone tried to sign up at ${APP_NAME} with this address, which already has an account.</p><p><a href="${link}">Sign in</a>.</p>`,
  });
}
```

`HOST_ORIGIN` (or `NEXT_PUBLIC_HOST_ORIGIN`, which `lib/origin.ts` also reads) holds the app's
public origin, for example `https://app.example.com`. Nothing sets it for you: section 10 lists it
with the other variables.

## 6. Sign-up

`POST /api/onboarding/signup` takes `{email, password, humanToken}`:

1. The body holds exactly these three strings, and the password is 8 to 72 bytes, else 400. 72 is
   the Engine's only rule; 8 is the app's own floor, because the Engine enforces no password
   policy.
2. `verifyHuman(humanToken, address)`; false → 400 "Please complete the check."
3. `signUp(email, password, address)`.
4. The mail: `existing: false` → "Confirm your email", with the link; `existing: true` → "You
   already have an account", with no code.
5. `200 {ok: true}` in both cases. The page shows the same text either way.

```ts
// app/api/onboarding/signup/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { signUp } from "@/lib/onboarding/engine";
import { clientAddress } from "@/lib/onboarding/client-address";
import { verifyHuman } from "@/lib/onboarding/human-check";
import { mailConfirm, mailExisting } from "@/lib/onboarding/mail";
import { SAY, notOffered, readJson, refusalResponse } from "@/lib/onboarding/messages";

const bad = (message: string) =>
  NextResponse.json({ error: { kind: "invalid_request", message } }, { status: 400 });

export async function POST(request: NextRequest) {
  const off = notOffered();
  if (off) return off;
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const keys = body && typeof body === "object" ? Object.keys(body).sort().join(",") : "";
  if (!body || keys !== "email,humanToken,password"
    || ![body.email, body.password, body.humanToken].every((v) => typeof v === "string")) {
    return bad(SAY.fillIn);
  }
  const { email, password, humanToken } = body as Record<string, string>;
  const bytes = new TextEncoder().encode(password).length;
  if (bytes < 8) return bad(SAY.passwordShort);
  if (bytes > 72) return bad(SAY.passwordLong);

  const address = clientAddress(request);
  if (!(await verifyHuman(humanToken, address))) return bad(SAY.humanCheck); // before the Engine

  let answer;
  try {
    answer = (await signUp(email, password, address)).data;
  } catch (e) {
    return refusalResponse(e);
  }
  try {
    if (answer.existing) await mailExisting(email);
    else await mailConfirm(email, answer.verification.code);
  } catch {
    console.error(JSON.stringify({ event: "onboarding.mail_failed", path: "signup" }));
    return NextResponse.json({ error: { kind: "mail_failed", message: SAY.mailFailed } }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

If the mail fails, the sign-up stands: the person asks for a new link (section 7).

```tsx
// app/(auth)/sign-up/page.tsx — a server component.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signUpOffered } from "@/lib/onboarding/engine";
import SignUpForm from "./SignUpForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  if (!signUpOffered()) notFound(); // no key in this deployment (Production's is `off`)
  return (
    <main>
      <h1>Create your account</h1>
      <SignUpForm />
    </main>
  );
}
```

```tsx
'use client';
// app/(auth)/sign-up/SignUpForm.tsx
import { useState } from "react";
import Link from "next/link";
import HumanCheck from "@/components/HumanCheck"; // the bot-check vendor's widget (step 6)

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [humanToken, setHumanToken] = useState("");
  const [checkKey, setCheckKey] = useState(0); // a new key remounts the widget: tokens are single-use
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/onboarding/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, humanToken }),
    }).catch(() => null);
    const body = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) {
      setSentTo(email);
      return;
    }
    setError(body?.error?.message ?? "Something went wrong. Try again.");
    setHumanToken("");          // the token was spent on this submit
    setCheckKey((k) => k + 1);  // a fresh check for the next one
  }

  if (sentTo) {
    // The same text for a new and an existing address.
    return <p>Check your email. We sent a message to {sentTo}.</p>;
  }
  return (
    <form onSubmit={submit}>
      <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <HumanCheck key={checkKey} onToken={setHumanToken} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || !humanToken}>Sign up</button>
      <p>Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
```

`HumanCheck` (section 4) renders the vendor's widget with its public site key and calls `onToken`
with the token. Use the app's existing one when step 6 found it, with the same reset.

## 7. Verify, and a new link

- **The page** reads `location.hash` once, then calls
  `history.replaceState(null, "", location.pathname)`, so the code leaves the address bar and the
  locale stays. It posts `{code}` to `/api/onboarding/verify`. Its
  `metadata` sets `referrer: "no-referrer"`.
- **On 200** the page says "Your email is confirmed. Sign in to create your company." and links to
  the sign-in page.
- **On `INVALID_TOKEN`** it says "This link has expired or was already used." and offers the
  resend form (email only), which posts to `/api/onboarding/resend` and shows the same "Check your
  email" text whatever the answer.
- **Without a code** (the sign-in page sends an unverified person here) it shows the resend form.

```ts
// app/api/onboarding/verify/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { verify } from "@/lib/onboarding/engine";
import { clientAddress } from "@/lib/onboarding/client-address";
import { SAY, notOffered, readJson, refusalResponse } from "@/lib/onboarding/messages";

export async function POST(request: NextRequest) {
  const off = notOffered();
  if (off) return off;
  const body = (await readJson(request)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Object.keys(body).join(",") !== "code" || typeof body.code !== "string") {
    return NextResponse.json({ error: { kind: "invalid_request", message: SAY.fillIn } }, { status: 400 });
  }
  try {
    await verify(body.code, clientAddress(request));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return refusalResponse(e);
  }
}
```

```ts
// app/api/onboarding/resend/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/onboarding/engine";
import { clientAddress } from "@/lib/onboarding/client-address";
import { mailExisting, mailNewLink } from "@/lib/onboarding/mail";
import { SAY, notOffered, readJson, refusalResponse } from "@/lib/onboarding/messages";

export async function POST(request: NextRequest) {
  const off = notOffered();
  if (off) return off;
  const body = (await readJson(request)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Object.keys(body).join(",") !== "email" || typeof body.email !== "string") {
    return NextResponse.json({ error: { kind: "invalid_request", message: SAY.fillIn } }, { status: 400 });
  }
  let answer;
  try {
    answer = (await resend(body.email, clientAddress(request))).data;
  } catch (e) {
    return refusalResponse(e);
  }
  try {
    if (answer.existing) await mailExisting(body.email);
    else await mailNewLink(body.email, answer.verification.code); // earlier codes are spent
  } catch {
    console.error(JSON.stringify({ event: "onboarding.mail_failed", path: "resend" }));
    return NextResponse.json({ error: { kind: "mail_failed", message: SAY.mailFailed } }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

```tsx
// app/(auth)/verify-email/page.tsx — a server component.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signUpOffered } from "@/lib/onboarding/engine";
import VerifyEmail from "./VerifyEmail";

// No Referer leaves this page, so nothing it links to learns the address it was opened at.
export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

export default function VerifyEmailPage() {
  if (!signUpOffered()) notFound();
  return (
    <main>
      <VerifyEmail />
    </main>
  );
}
```

```tsx
'use client';
// app/(auth)/verify-email/VerifyEmail.tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type State =
  | { step: "checking" }
  | { step: "confirmed" }
  | { step: "resend"; message: string | null }
  | { step: "sent"; to: string }
  | { step: "failed"; message: string };

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
    .catch(() => ({ ok: false, body: {} as any }));

export default function VerifyEmail() {
  const [state, setState] = useState<State>({ step: "checking" });
  const [email, setEmail] = useState("");
  const read = useRef(false);

  useEffect(() => {
    if (read.current) return; // read the fragment once, also under React's development double run
    read.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname); // the code leaves the address bar
    if (!code) {
      setState({ step: "resend", message: null });
      return;
    }
    post("/api/onboarding/verify", { code }).then(({ ok, body }) => {
      if (ok) setState({ step: "confirmed" });
      else if (body?.error?.kind === "invalid_code") setState({ step: "resend", message: body.error.message });
      else setState({ step: "failed", message: body?.error?.message ?? "Something went wrong. Try again." });
    });
  }, []);

  async function sendAgain(e: React.FormEvent) {
    e.preventDefault();
    const { ok, body } = await post("/api/onboarding/resend", { email });
    if (ok) setState({ step: "sent", to: email }); // the same text whatever the answer
    else setState({ step: "resend", message: body?.error?.message ?? "Something went wrong. Try again." });
  }

  switch (state.step) {
    case "checking":
      return <p>Confirming your email…</p>;
    case "confirmed":
      return <p>Your email is confirmed. <Link href="/login">Sign in</Link> to create your company.</p>;
    case "sent":
      return <p>Check your email. We sent a message to {state.to}.</p>;
    case "failed":
      return <p role="alert">{state.message}</p>;
    case "resend":
      return (
        <form onSubmit={sendAgain}>
          {state.message && <p role="alert">{state.message}</p>}
          <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button type="submit">Send a new link</button>
        </form>
      );
  }
}
```

## 8. Sign-in: four changes to step 4's code

The login route, `settleTenant` and the middleware stay as the `add-multitenancy` skill's guide
`engine-customer-tenants` (section 5) writes them, with four changes.

**An unverified sign-in.** `signInWithPassword` answers the GoTrue error code
`email_not_confirmed`. The login route maps it to 403, in the shape of its other answers, before
its other refusals:

```ts
  // app/api/auth/login/route.ts — after signInWithPassword (add-customer-onboarding)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    return NextResponse.json(
      { errors: [{ message: "Confirm your email first.", extensions: { code: "EMAIL_NOT_CONFIRMED" } }] },
      { status: 403 },
    );
  }
```

**The sign-in page.** It sends the browser where the login route's answer says, shows the
unverified message with a link to `/verify-email` (which offers a new link), and offers sign-up
where this deployment has a key. The page, a server component, passes `signUpOffered()` to the form
as a boolean prop; the form, a client component, imports nothing under `lib/onboarding/`:

```tsx
  // The sign-in form's handling of POST /api/auth/login (add-customer-onboarding)
  const body = await r.json().catch(() => ({}));
  if (r.ok) {
    const d = body?.data ?? {};
    window.location.assign(d.create ? "/create-company" : d.choose ? "/choose-customer" : "/");
    return;
  }
  const first = body?.errors?.[0];
  setUnverified(first?.extensions?.code === "EMAIL_NOT_CONFIRMED");
  setError(first?.message ?? "Something went wrong. Try again.");

  // Under the form:
  // signUpOffered: the prop the server page set from signUpOffered() of lib/onboarding/engine.
  {signUpOffered && unverified && <p><Link href="/verify-email">Send a new confirmation link</Link></p>}
  {signUpOffered && <p>New here? <Link href="/sign-up">Create an account</Link></p>}
```

**An empty tenant list.** In an app that has this flow, `settleTenant`'s branch for
`tenants.length === 0` no longer signs out with `NO_CUSTOMER`. It keeps the unbound session and
answers `{create: true}`:

```ts
// lib/auth/tenants.ts — the constant, set to true by add-customer-onboarding.
export const SELF_ONBOARDING = true;
```

```ts
  if (tenants.length === 0) {                                     // belongs to no customer yet
    // add-customer-onboarding; signUpOffered from "@/lib/onboarding/engine" (both server only)
    if (SELF_ONBOARDING && signUpOffered()) return { create: true as const };
    await supabase.auth.signOut();
    return { error: "NO_CUSTOMER" as const };
  }
```

- `SELF_ONBOARDING` is a constant in code. Never read it from the environment or the request.
- `signUpOffered()` is false where the deployment has no key, as on Production's branch: there a
  person with no customer gets `NO_CUSTOMER`, as in an app without this flow, and is never sent to
  a page that is not found.
- The login route answers `{data: {create: true}}` as it answers any other settled result, and the
  sign-in page sends the browser to `/create-company` (`window.location.assign`). The layout never
  runs `settleTenant`: with no current customer it redirects to `/choose-customer`, which sends a
  person with no tenant to `/create-company`.
- An app without this flow keeps the `NO_CUSTOMER` answer.
- **The chooser** (several tenants) gains a "Create another company" link to `/create-company`,
  shown where `signUpOffered()` is true. The app cannot read the project's limit of companies per
  person, so the link is shown there whatever the limit, and the 409 at the limit explains itself.
- **The unbound session's routes.** A session bound to no customer is used for nothing but the four
  routes of section 5 of the guide `engine-customer-tenants` and a fifth,
  `/api/onboarding/customers`, which sends its access token to the Engine's
  `POST /api/onboarding/customers` only.

**The middleware.** Change `lib/supabase/middleware.ts` as section 5.6 of the guide says, then
fill in its three Self-onboarding lists:

```ts
  const publicRoutes = ['/login', '/signup', '/auth', '/api/auth', '/sign-up', '/verify-email'];
  // ...
    const unboundPages = ['/choose-customer', '/create-company'];
    const unboundApi = ['/api/auth/', '/api/onboarding/customers'];
```

Without it, a person who has just signed in with `{create: true}` is read as signed out, because
the Engine refuses the unbound session at `GET /auth/v1/user`, and loops back to sign-in.
`/api/onboarding/` needs no entry in `publicRoutes`: the middleware lets every `/api/` path through
for a signed-out request, and the routes check what they need.

## 9. Create your company

- **The page** (`/create-company`, a server component): with no session, it redirects to sign-in.
  With a session already bound to a customer, its heading is "Create another company". It renders
  `CreateCompanyForm`.
- **The form** keeps one `requestId` (`crypto.randomUUID()`) in `sessionStorage` for the name it
  submits. The id is reused until the creation succeeds or the name changes, so a reload or a
  second click retries the same creation.
- **The route** takes `{name, id}`: `name` of 1 to 100 characters after trimming, and `id` a UUID,
  else 400. It reads the access token from the session (none → 401), and calls
  `createCustomer(token, name, id)`. It sends no administrator, email or template: the person is the
  administrator because the token is theirs.
- **On 503** the route waits 2 seconds and calls again once with the same `id`. A second 503
  answers `503 {retry: true, id}`.
- **On 201 or 200** it runs `switchTenant(token, created.id)`, then `supabase.auth.setSession` with
  the answered pair, and answers `{tenant: {id, name}}`.
- **On 409 at the person's limit** it first lists the person's tenants, up to three times a second
  apart (the first request may still be committing). When one has the requested `id`, a same-id request raced the first (the Engine counts the limit before it sees its own
  creation in flight), so the route switches into it and answers as on 200. Otherwise the 409
  stands.
- **The form on `503 {retry: true}`** says "Creating your company is taking longer than usual…" It
  posts again with the same `id` after 5 seconds, then after 10 seconds. After three tries in all it
  shows "We are busy creating other companies. Try again in a minute." and keeps the id and the
  name for the person's own retry.
- **After success** the browser loads `/` (`window.location.assign`), so every cache starts in the
  new customer. The layout shows the customer's name from the session.

The Engine copies every new customer from the Blueprint under one lock for the whole Engine, about
one a second, and a creation that waits past 10 seconds answers 503 without creating anything
half-way. So a 503 here means a burst of sign-ups is queued, not an outage: retrying with the same
id is safe, because the Engine answers 200 with the existing customer when the same person retries
the same id and name, and refuses anyone else's.

The longest a person waits is about 30 seconds of retries, plus the Engine's 10-second deadline per
attempt. No single route call exceeds about 25 seconds (two Engine attempts and one 2-second wait),
which stays within a hosted route's time limit.

```tsx
// app/(auth)/create-company/page.tsx — a server component.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/auth/tenants";
import { signUpOffered } from "@/lib/onboarding/engine";
import CreateCompanyForm from "./CreateCompanyForm";

export default async function CreateCompanyPage() {
  if (!signUpOffered()) notFound();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const bound = (await listTenants(session.access_token)).some((t) => t.current);
  return (
    <main>
      <h1>{bound ? "Create another company" : "Create your company"}</h1>
      <CreateCompanyForm />
    </main>
  );
}
```

```ts
// app/api/onboarding/customers/route.ts — the fifth route an unbound session may use.
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCustomer, OnboardingError } from "@/lib/onboarding/engine";
import { listTenants, switchTenant } from "@/lib/auth/tenants";
import { SAY, notOffered, readJson, refusalResponse } from "@/lib/onboarding/messages";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isKind = (e: unknown, kind: string) => e instanceof OnboardingError && e.kind === kind;

export async function POST(request: NextRequest) {
  const off = notOffered();
  if (off) return off;
  const body = (await readJson(request)) as Record<string, string> | null;
  const shaped = body && typeof body === "object"
    && Object.keys(body).sort().join(",") === "id,name"
    && typeof body.name === "string" && typeof body.id === "string";
  const name = shaped ? body.name.trim() : "";
  if (!shaped || name.length < 1 || name.length > 100 || !UUID.test(body.id)) {
    return NextResponse.json({ error: { kind: "invalid_request", message: SAY.companyName } }, { status: 400 });
  }
  const id: string = body.id;

  const supabase = await createClient();
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: { kind: "unauthenticated", message: SAY.signIn } }, { status: 401 });
  }

  // The template-copy lock: on 503, once more with the same id after 2 seconds.
  const create = async (token: string) => {
    try {
      return await createCustomer(token, name, id);
    } catch (e) {
      if (!isKind(e, "busy")) throw e;
      await wait(2000);
      return await createCustomer(token, name, id);
    }
  };

  try {
    let created;
    try {
      created = await create(session.access_token);
    } catch (e) {
      // A 401 TOKEN_INVALID here may be an expired session: refresh once before treating it as the key.
      if (!isKind(e, "key_invalid")) throw e;
      const { data } = await supabase.auth.refreshSession();
      if (!data.session) throw e;
      session = data.session;
      created = await create(session.access_token);
    }
    const tenant = created.data as { id: string; name: string; state: string };
    const pair = await switchTenant(session.access_token, tenant.id);
    await supabase.auth.setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    return NextResponse.json({ tenant: { id: tenant.id, name: tenant.name } }, { status: created.status });
  } catch (e) {
    if (isKind(e, "busy")) return NextResponse.json({ retry: true, id }, { status: 503 });
    // A same-id request that raced the first (a double click, or the form's retry while the first is
    // still copying) is refused at the person's limit although its company exists. Land in it.
    const token = session?.access_token;
    if (isKind(e, "per_identity") && token) {
      // The first request may not have committed yet: look up to three times, a second apart.
      let mine;
      for (let look = 0; look < 3 && !mine; look++) {
        if (look > 0) await wait(1000);
        mine = (await listTenants(token).catch(() => [])).find((t) => t.id === id);
      }
      if (mine) {
        const pair = await switchTenant(token, mine.id).catch(() => null);
        if (pair) {
          await supabase.auth.setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
          return NextResponse.json({ tenant: { id: mine.id, name: mine.name } }, { status: 200 });
        }
      }
    }
    return refusalResponse(e);
  }
}
```

If the switch fails after the creation, the route answers the refusal; the form keeps the id, and
the person's retry gets the same customer back (200) and switches again.

```tsx
'use client';
// app/(auth)/create-company/CreateCompanyForm.tsx
import { useEffect, useState } from "react";

const SAVED = "create-company"; // sessionStorage: {name, id} of the creation not yet done
const WAITS = [5000, 10000];    // after the route's own retry: 5 s, then 10 s

function load(): { name: string; id: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? "null");
    return typeof v?.name === "string" && typeof v?.id === "string" ? v : null;
  } catch {
    return null;
  }
}

function save(v: { name: string; id: string } | null) {
  try {
    if (v) sessionStorage.setItem(SAVED, JSON.stringify(v));
    else sessionStorage.removeItem(SAVED);
  } catch {}
}

/** The id for this name: the saved one while the name is unchanged, else a new one. */
function idFor(name: string, fresh = false): string {
  const saved = load();
  if (!fresh && saved?.name === name) return saved.id;
  const id = crypto.randomUUID();
  save({ name, id });
  return id;
}

export default function CreateCompanyForm() {
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = load();
    if (saved) setName(saved.name); // a reload keeps the name and its id
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    let id = idFor(trimmed);
    let newIdUsed = false;
    let waits = 0;
    setBusy(true);
    setNote(null);
    for (;;) {
      const r = await fetch("/api/onboarding/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, id }),
      }).catch(() => null);
      const body = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) {
        save(null);
        window.location.assign("/"); // every cache starts in the new customer
        return;
      }
      if (r?.status === 503 && body?.retry) {
        if (waits < WAITS.length) {
          setNote("Creating your company is taking longer than usual…");
          await new Promise((resolve) => setTimeout(resolve, WAITS[waits++]));
          continue;
        }
        setNote("We are busy creating other companies. Try again in a minute.");
        break;
      }
      if (body?.error?.kind === "id_taken" && !newIdUsed) {
        newIdUsed = true; // the id belongs to another tenant: a new id, once
        id = idFor(trimmed, true);
        continue;
      }
      if (r?.status === 401) {
        window.location.assign("/login");
        return;
      }
      setNote(body?.error?.message ?? "Something went wrong. Try again.");
      break;
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <label>Company name <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
      {note && <p role="status">{note}</p>}
      <button type="submit" disabled={busy}>Create</button>
    </form>
  );
}
```

## 10. `amplify.yml` and the variables

The flow reads these variables. Set each in the app's hosting (the [`amplify-env-vars`](../../amplify-env-vars/SKILL.md)
skill for Amplify Hosting) before the deployment that uses it:

| Variable | Server only | Who sets it | Unset |
|---|---|---|---|
| `BUILDPAD_ONBOARDING_KEY` | yes | the Platform: the key on `main` when sign-up is turned on, `off` on `production` | no sign-up link, the pages are not found, and the routes answer 404 "Sign-up is not available right now." with `onboarding.not_configured` (also when the value is `off`) |
| the mail provider's credentials (an API key, or SMTP host, port, user and password) | yes | the developer | "We could not send the email.", `onboarding.mail_failed` |
| `TURNSTILE_SECRET_KEY` (or the vendor's secret) | yes | the developer | every check fails, `onboarding.human_check_not_configured` |
| `HOST_ORIGIN` | yes | the developer | no mail is sent, `onboarding.origin_not_configured` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (or the vendor's site key) | no: read in the browser, built into the bundle | the developer | the widget does not render |

On Amplify Hosting a server-only variable reaches the running app only through `.env.production`,
so each one needs a line like the key's. A `NEXT_PUBLIC_` variable is read at build time, so it only
needs to be set on the Amplify app before the build. Next.js expands `$` in `.env` files: a secret
that contains `$` is written there with each `$` escaped as `\$`.

Step 8 of the skill adds the Platform's line before the build command, when the build commands lack
`BUILDPAD_ONBOARDING_KEY`:

```yaml
        # Self-onboarding: the app's server reads the onboarding key at run time. Server only; never NEXT_PUBLIC_.
        - '[ -z "$BUILDPAD_ONBOARDING_KEY" ] || echo "BUILDPAD_ONBOARDING_KEY=$BUILDPAD_ONBOARDING_KEY" >> .env.production'
```

Then one line of the same form for each other server-only variable of the table, for example:

```yaml
        - '[ -z "$TURNSTILE_SECRET_KEY" ] || echo "TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY" >> .env.production'
        - '[ -z "$HOST_ORIGIN" ] || echo "HOST_ORIGIN=$HOST_ORIGIN" >> .env.production'
```

The app reads the key only after the next deployment. With no key at run time (unset, empty, or
`off` in any case) the app offers no sign-up: the sign-in page shows no link, the three pages are not
found, and the four routes answer 404 "Sign-up is not available right now." and log
`onboarding.not_configured`. On Development that log means the `amplify.yml` line is missing; on
Production it is expected, because the Platform sets `off` there.

A kit's `amplify.yml` may also carry a line for `BUILDPAD_SIGNUP_MAIL`. It belongs to mail that the
Engine sends, which this flow does not use: leave the line as it is.

## 11. Refusals

Each onboarding route answers a refusal as `{error: {kind, message}}`, where `message` is the
sentence of the [skill's Refusals table](../SKILL.md#refusals) and never the Engine's own. The sign-in
routes of step 4 keep the shape of the app's other routes, `{errors: [{message, extensions: {code}}]}`,
and so does the login route's `EMAIL_NOT_CONFIRMED` (section 8). Each page reads the shape of the
route it calls. The pages show `message`
as it is. Keep `onboarding.key_invalid`, `onboarding.engine_too_old`, `onboarding.no_release` and
`onboarding.not_configured` in the app's logs for the developer.
