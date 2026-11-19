---
name: add-customer-onboarding
description: "Let strangers sign up, verify their email, create their own customer and land in it, on an Engine project with Customer_Tenants and Self-onboarding on."
---

# Add Customer Onboarding

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

**Step 1, on a Supabase project.** Customers that sign themselves up need a Buildpad Engine project with Customer tenants. Tell the developer so and stop.

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

## Step 2. The tenancy mode

Establish the tenancy mode with the [`add-multitenancy`](../add-multitenancy/SKILL.md) skill's Tenancy check.

In the mode `scope`:

On an Engine project in the mode `scope` a workspace that a person creates for themselves, as a scope node they own in the project's one tenant, is not available: no route lets a person who is not an administrator create a scope node or give roles at one. Tell the developer so and stop: build no substitute, and never give the application an administrator's credential to create one. Customers that sign themselves up, each a tenant of its own, are available in the mode `customer-tenants`, with the `add-customer-onboarding` skill.

In the mode `customer-tenants`, go on to step 3.

## Step 3. Whether customers may sign themselves up

**Establish whether customers may sign themselves up.** Find it with these steps, in order, and
stop at the first step that answers:

1. Read `.buildpad/project.json`. If its field `selfOnboarding` is `true` or `false`, that is the
   answer. If `.buildpad/onboarding-answer.json` says otherwise, tell the developer the two files
   disagree and follow `.buildpad/project.json`: a kit downloaded before sign-up was turned on says
   `false`, and the developer downloads the kit again or sets the field.
2. Otherwise read `.buildpad/onboarding-answer.json` in the same way.
3. Otherwise ask the developer once: "Has a project Admin turned on customer sign-up (Self-onboarding)
   for this project on the Buildpad platform's Customers page?" Write the answer to
   `.buildpad/onboarding-answer.json` as `{"buildpadOnboardingAnswer": 1, "selfOnboarding": true}`
   or `{"buildpadOnboardingAnswer": 1, "selfOnboarding": false}`, and ask the developer to commit
   that file. Never write `.buildpad/project.json`.

Do not open an environment file to find it, and do not call a tool that returns project credentials.

A file that is not JSON, or whose `selfOnboarding` is missing or not a boolean, gives no answer.
Write `.buildpad/onboarding-answer.json` exactly as shown, UTF-8, with a trailing newline.

On an Engine project with Customer_Tenants customers sign themselves up only while the project's Self_Onboarding is on, which `selfOnboarding` in `.buildpad/project.json` says. While it is off, tell the developer that a project Admin turns it on from the Platform's Customers page, and stop. While it is on, build it with the `add-customer-onboarding` skill: the application's own server routes call the Engine's sign-up, verification and customer routes with `BUILDPAD_ONBOARDING_KEY`, read on the server only and never sent to a browser. Never put the host administrator's credential or a call to `/api/tenants` in the application.

While the answer is `false`, the paragraph above applies: tell the developer that a project Admin
turns sign-up on from the Platform's Customers page, and stop. Who turns it on: a project Admin,
from the Platform's Customers page, once a host administrator has turned on the premium flag
Customer self-onboarding for the project. While the answer is `true`, go on with steps 4 to 11.

## Step 4. Sign-in comes first

If the app has no `lib/auth/tenants.ts` with `settleTenant`, build the sign-in of the mode
`customer-tenants` first, with the `add-multitenancy` skill's guide `engine-customer-tenants`
(section 5), then come back. This flow changes two things in that sign-in (the reference file,
section 8).

## Step 5. Mail_Sender

Look for a server function that sends one message (`sendMail`, `sendEmail`, a provider SDK client
under `lib/`).

- **Found:** wrap it as `sendMail({to, subject, text, html})` in `lib/mail/send.ts`.
- **Not found:** ask: "Which mail provider sends this app's email (for example Amazon SES, Resend,
  Postmark, SendGrid)? It needs a verified sending domain, and its API key set in the app's server
  environment." With an answer, write `lib/mail/send.ts` for that provider with
  `import "server-only"`, reading its key from a server variable the developer names.
- **No provider:** say "Verification mail needs a mail provider; this flow cannot be built without
  one" and stop.

## Step 6. Bot check

- **Found:** use the app's existing captcha.
- **Not found:** ask which one the developer uses (for example Cloudflare Turnstile, hCaptcha,
  reCAPTCHA). Then write `lib/onboarding/human-check.ts` (`import "server-only"`) with
  `verifyHuman(token, address): Promise<boolean>` against that vendor's verify endpoint. Its
  secret goes in a server variable; its public site key may carry `NEXT_PUBLIC_`.
- **No captcha:** stop with "The sign-up page needs a bot check; without one a script spends the
  project's sign-up budget and your mail provider's reputation."

## Step 7. The key

The Buildpad platform sets `BUILDPAD_ONBOARDING_KEY` in the app's hosting when a project Admin
turns sign-up on, or shows it once on the Customers page for another host. It is a server
variable: never give it a `NEXT_PUBLIC_` prefix and never read it in a client component.

Never open an environment file to check that it is set.

## Step 8. `amplify.yml`

If the repository has an `amplify.yml` whose build commands lack `BUILDPAD_ONBOARDING_KEY`, add the
Platform's exact line before the build command:

```yaml
        # Self-onboarding: the app's server reads the onboarding key at run time. Server only; never NEXT_PUBLIC_.
        - '[ -z "$BUILDPAD_ONBOARDING_KEY" ] || echo "BUILDPAD_ONBOARDING_KEY=$BUILDPAD_ONBOARDING_KEY" >> .env.production'
```

Tell the developer that the app reads the key only after the next deployment. On another host,
tell the developer to set it there as a server-only variable. `amplify.yml` is not an environment
file, so you may open it.

## Step 9. The Release and the Engine version

No customer can be created until the project has a published Release; the Engine answers 409 until
then. Sign-up also needs the Engine release the Platform names on the Customers page; the Platform
turns sign-up on only for a project that runs it.

Read neither fact. The [Refusals](#refusals) table maps the Engine's answers when either is
missing.

## Step 10. Build

Build the flow as [the reference file](references/engine-customer-onboarding.instructions.md)
says: the module that holds the key, the client address, the four routes, the three pages, and the
two changes to the sign-in of step 4.

## Step 11. Review

Review against the [`security-and-hardening`](../security-and-hardening/SKILL.md) skill's checks.
For this flow they are:

- `BUILDPAD_ONBOARDING_KEY` is read only in one server-only module (`lib/onboarding/engine.ts`),
  never with a `NEXT_PUBLIC_` prefix and never in a client component; no client component imports
  anything under `lib/onboarding/`.
- The sign-up route checks the bot-check token before it calls the Engine.
- The sign-up page shows the same text for a new and an existing address.

## Refusals

Keyed by the Engine's status and code. The person-facing text never repeats the Engine's message.

| Route | Engine answer | Cause | The page says | Next |
|---|---|---|---|---|
| any | 401 `TOKEN_INVALID` | The key is missing, unknown or revoked (on the create route it may also be an expired session: the route refreshes the session once and retries before treating it as the key) | "Sign-up is not available right now." | Log `onboarding.key_invalid` for the developer; no retry |
| any | 403 `FORBIDDEN` on sign-up, resend or verify | Sign-ups are turned off (Stop sign-ups or turned off) | "Sign-ups are closed right now." | No retry |
| any | 404 | The project's Engine is older than the release that serves sign-up | "Sign-up is not available right now." | Log `onboarding.engine_too_old`; the developer asks the project Admin |
| any | 429 `REQUESTS_EXCEEDED` | A budget: per key, per address, resend per person, or verify failures | "Too many attempts. Try again in N minutes." (from `Retry-After`) | After `Retry-After` |
| signup, resend | 400 `INVALID_PAYLOAD` | A malformed address or a password over 72 bytes | "Enter a valid email address." / "Use a shorter password." | The person corrects it |
| verify | 400 `INVALID_TOKEN` | The code is unknown, used or expired | "This link has expired or was already used." | Resend |
| login | GoTrue `email_not_confirmed` | Not yet verified | "Confirm your email first." | Resend |
| customers | 401 `UNAUTHENTICATED` | No session | (redirect) | Sign in |
| customers | 403 `FORBIDDEN` | Sign-ups are off (or, rarely, the person is not verified) | "Creating companies is closed right now." | No retry |
| customers | 403 `QUOTA_EXCEEDED` | The project's customer limit is reached | "Sign-ups are full right now. Contact <app>'s team." | No retry |
| customers | 409 `CONFLICT`, message `MsgOnboardingNoRelease` | No published Release yet | "Companies cannot be created yet. Try again later." | Log `onboarding.no_release` |
| customers | 409 `CONFLICT`, message `MsgOnboardingPerIdentity` | The person's company limit (`per_identity`) | "You have reached the number of companies you can create." | No retry |
| customers | 409 `CONFLICT`, message `MsgOnboardingIDTaken` | The id belongs to another tenant | (never seen by a person: the form makes a new id and resubmits once) | New id, once |
| customers | 503 `SERVICE_UNAVAILABLE` | The template-copy lock's deadline | "Creating your company is taking longer than usual…" | Same id: 2 s (route), 5 s, 10 s (form) |
| any | 5xx other, or no answer | The Engine is down | "Something went wrong. Try again." | The person retries |

The three 409s on the create route share the code `CONFLICT` and carry no `extensions`. The module
tells them apart by a fixed prefix of the Engine's message:

- "This project has no published release yet" → no Release (`MsgOnboardingNoRelease`);
- "You have reached the limit of" → the company limit (`MsgOnboardingPerIdentity`);
- "Another customer already has that id." → the id (`MsgOnboardingIDTaken`).

Any other 409 shows "We could not create your company. Try again later." The message is never
shown to the person. This is the one place the flow reads an Engine message: until the Engine gives
each of these refusals a code of its own, the prefix is the only way to tell them apart.

## Reference

- [Customer self-onboarding: the flow](references/engine-customer-onboarding.instructions.md): the
  files, the module that holds the key, the client address, the routes and pages, the changes to
  sign-in, and the `amplify.yml` line.
<!-- /buildpad-backend -->
