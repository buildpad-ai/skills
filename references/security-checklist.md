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

# Security Checklist

Quick reference for web application security. Use alongside the `security-and-hardening` and `review-code` skills.

## Pre-Commit Checks

- [ ] No secrets in code (`git diff --cached | grep -i "password\|secret\|api_key\|token"`)
- [ ] `.gitignore` covers: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example` uses placeholder values (not real secrets)

<!-- buildpad-backend: supabase -->
## Authentication

- [ ] Passwords hashed with bcrypt (≥12 rounds), scrypt, or argon2
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] Session expiration configured (reasonable max-age)
- [ ] Rate limiting on login endpoint (≤10 attempts per 15 minutes)
- [ ] Password reset tokens: time-limited (≤1 hour), single-use
- [ ] Account lockout after repeated failures (optional, with notification)
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Authentication

- [ ] Passwords are hashed and checked by the Engine: the application stores no password and holds no hashing code
- [ ] If the application keeps the session in cookies for its own routes: `httpOnly`, `secure`, `sameSite: 'lax'`; the data API takes no cookie session, so every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`
- [ ] An expired session is refreshed through the Supabase client, or the user signs in again
- [ ] Rate limiting on the application's sign-in route (≤10 attempts per 15 minutes)
- [ ] No password recovery flow and no password change through the Supabase client: neither is available on an Engine project, and an administrator resets a user's password in the Studio's Users module
- [ ] An account that holds no role in the project's tenant is refused at password sign-in, and the application ends an XAppHub session of such an account: every user is given a role there when it is created, and an administrator gives one to each account that XAppHub sign-in creates
- [ ] Account lockout after repeated failures (optional, with notification)

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.
<!-- /buildpad-backend -->

## Authorization

- [ ] Every protected endpoint checks authentication
- [ ] Every resource access checks ownership/role (prevents IDOR)
- [ ] Admin endpoints require admin role verification
- [ ] API keys scoped to minimum necessary permissions
- [ ] JWT tokens validated (signature, expiration, issuer)

## Input Validation

- [ ] All user input validated at system boundaries (API routes, form handlers)
- [ ] Validation uses allowlists (not denylists)
- [ ] String lengths constrained (min/max)
- [ ] Numeric ranges validated
- [ ] File uploads: type restricted, size limited, content verified
- [ ] SQL queries parameterized (no string concatenation)
- [ ] HTML output encoded (use framework auto-escaping)
- [ ] URLs validated before redirect (prevent open redirect)

## Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (disabled, rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

<!-- buildpad-backend: supabase -->
## CORS Configuration

```typescript
// Restrictive (recommended)
cors({
  origin: ["https://yourdomain.com", "https://app.yourdomain.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// NEVER use in production:
cors({ origin: "*" }); // Allows any origin
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## CORS Configuration

On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.

- [ ] The data API's cross-origin setting is the provisioned any-origin-without-credentials: that is not a finding
- [ ] No code sends cookies to the data API or changes its cross-origin setting
- [ ] The application's own API routes allow no other origin unless a named origin needs them
<!-- /buildpad-backend -->

## Data Protection

- [ ] Sensitive fields excluded from API responses (`passwordHash`, `resetToken`, etc.)
- [ ] Sensitive data not logged (passwords, tokens, full CC numbers)
- [ ] PII encrypted at rest (if required by regulation)
- [ ] HTTPS for all external communication
- [ ] Database backups encrypted

## Dependency Security

```bash
# Audit dependencies
npm audit

# Fix automatically where possible
npm audit fix

# Check for critical vulnerabilities
npm audit --audit-level=critical

# Keep dependencies updated
npx npm-check-updates
```

## Error Handling

```typescript
// Production: generic error, no internals
res.status(500).json({
  error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
});

// NEVER in production:
res.status(500).json({
  error: err.message,
  stack: err.stack, // Exposes internals
  query: err.sql, // Exposes database details
});
```

## OWASP Top 10 Quick Reference

| #   | Vulnerability             | Prevention                                            |
| --- | ------------------------- | ----------------------------------------------------- |
| 1   | Broken Access Control     | Auth checks on every endpoint, ownership verification |
| 2   | Cryptographic Failures    | HTTPS, strong hashing, no secrets in code             |
| 3   | Injection                 | Parameterized queries, input validation               |
| 4   | Insecure Design           | Threat modeling, spec-driven development              |
| 5   | Security Misconfiguration | Security headers, minimal permissions, audit deps     |
| 6   | Vulnerable Components     | `npm audit`, keep deps updated, minimal deps          |
| 7   | Auth Failures             | Strong passwords, rate limiting, session management   |
| 8   | Data Integrity Failures   | Verify updates/dependencies, signed artifacts         |
| 9   | Logging Failures          | Log security events, don't log secrets                |
| 10  | SSRF                      | Validate/allowlist URLs, restrict outbound requests   |

## DaaS-Specific Security

<!-- buildpad-backend: supabase -->
- [ ] All browser→DaaS calls go through Next.js API proxy (no direct CORS)
- [ ] Supabase auth never called from client (use `/api/auth/*` routes)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used server-side (never `NEXT_PUBLIC_*`)
- [ ] CORS origins explicitly listed (no wildcard when credentials used)
- [ ] DaaS permissions checked via RBAC, not client-side gating
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- [ ] Every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK; the token in the project's MCP configuration is sent only to the MCP endpoint `/api/mcp`, never to the data API
- [ ] The Supabase client is used for sign-in only (password sign-in, session refresh, reading the signed-in user, sign-out), through the `/api/auth/*` routes
- [ ] No service-role key or Supabase secret appears anywhere (code, `NEXT_PUBLIC_*` or other environment variables, pipeline secrets): an Engine project has none
- [ ] The data API's cross-origin setting is the provisioned any-origin-without-credentials, unchanged
- [ ] Access is enforced by roles, policies and permissions on every request, not by client-side gating
- [ ] On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes of the `external-oauth` module, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`. For XAppHub sign-in the CLI installs the `external-oauth-engine` module in place of `external-oauth`; its routes are used as the `add-external-oauth` skill says.
- [ ] In the mode `customer-tenants`:
  - [ ] No tenant id is taken from user input except the one the switch route receives, and the Engine checks it
  - [ ] No host credential or host session is present anywhere
  - [ ] No request reaches two customers with one token, and no server code holds two customers' sessions at once
  - [ ] No cache in the application (server or browser) is keyed without the current customer, and a switch reloads the page
<!-- /buildpad-backend -->
