# Changelog

Every release of the skills is a git tag, and every tag has a section here. The GitHub Release of
a tag carries the same section. Install a release with `npx skills add buildpad-ai/skills#<tag>`
(see the [README](README.md#install)).

Versions follow these rules:

- **MAJOR** when what a Supabase project's agent reads changes in any file, when a skill is removed
  or renamed, or when the version of the "Establish the backend first" procedure changes.
- **MINOR** when a skill is added, or when text for Engine projects only changes.
- **PATCH** for anything else, such as a typo.

From `v2.0.0` on, each section has a subsection **Supabase projects** that lists every change to
what a Supabase project's agent reads, with its reason.

## v9.0.0

One skill is added, `add-comments`. Install it with `npx skills add buildpad-ai/skills#v9.0.0`.
This release also has lessons from moving a SaaS project (a main app and a Multi-Zones microapp)
to the Engine and connecting its app's own MCP server to Amazon Quick, and OAuth sign-in for the
hosted connectors of `add-mcp-server`. It is a MAJOR release, because two existing files that a
Supabase project's agent reads change (see **Supabase projects** below). No skill is removed or
renamed, and the "Establish the backend first" procedure stays at version 1.

- **New skill `add-comments`:** the standard comment (discussion) field of a Buildpad app, or an
  existing one brought up to the standard: social @mentions, pasted and uploaded images with a
  viewer, replies at any depth, an emoji picker, one-click reactions and email notifications for
  mentions and replies. It covers the data model (a self-referencing parent and thread root, a
  photos column, a reactions table), the server hooks that stamp and validate every comment, one
  shared editor component, the recursive thread list, silent refetching, and a proof with
  throwaway users.
- **Stored code's allowed hosts and keys** (`create-cron`, `create-service` and its Custom
  services and Stripe references, `hooks-extensions` and its Engine services reference,
  `daas-platform`'s built-in features, `add-microapp`'s cross-service communication and
  `migrate-to-engine`): on an Engine project, a host for `services.fetch`
  (`EXTENSION_ALLOWED_DOMAINS`) and a key for `services.env` are set by the user in the
  project's **Environment Variables** (the Engine list) on the Buildpad platform and applied, not
  asked of an operator. Engine text only.

- **`migrate-to-engine`, Part B step 6** and its App code reference: what the app scan does not
  catch. Scope items get new ids and each `uri_path` is nested under the project's own scope item
  (`/<project type id>:<tenant id>/<region type id>:<region id>`), so a hard-coded scope URI or
  region id is answered 403 `FORBIDDEN_SCOPE`; role ids can change, so find roles by name; and
  custom `daas_users` fields are not moved, so create them again (a boolean with a default
  nullable, because it cannot be added as not-null to a table with rows).
- **`add-external-oauth`:** the XAppHub connector registers only
  `https://<branch>.<Amplify default domain>/api/auth/callback` and the localhost callback. A
  custom domain, or a callback in a microapp or zone, is added in XAppHub by hand; XAppHub refuses
  any other redirect URI. Said in the Engine part's Step 1 and Troubleshooting, and in Step 0 and
  Step 3.
- **`add-mcp-server`, step 6, hosted connectors:** a new step for claude.ai, ChatGPT and Amazon
  Quick, which sign in with OAuth 2.1 (PKCE S256) and Dynamic Client Registration. The app is a
  stateless authorization server: its discovery documents, register, authorize, consent and token
  endpoints, each with the checks it makes. Redirect URLs are an exact-match allow-list in
  `MCP_ALLOWED_REDIRECT_URIS`, checked at register and again at authorize; `MCP_RESOURCE_URL` and
  `MCP_OAUTH_SECRET` are set with `amplify_set_env_vars` and written to `.env.production`. The
  connection gets a data API session of its own at consent, carried encrypted in the app's MCP
  tokens and refreshed at the token endpoint; on a Supabase project it is made with the service
  key (its only use, outside the tools), on an Engine project with a second sign-in on the consent
  page. Also Amazon Quick's Enterprise subscription and manual Sync, never sharing the browser's
  session (refresh-token rotation ends both), the default sign-out, and test steps.

### Supabase projects

This file is new:

- `add-comments/SKILL.md` (new-file): the standard comment field with social mentions, pasted
  images, replies at any depth, an emoji picker, reactions and notifications.

These files change, each with its reason:

- `add-external-oauth/SKILL.md` (text): Step 0 and Step 3 say that the XAppHub connector registers
  only the Amplify default domain's and localhost's `/api/auth/callback`, so a custom domain or a
  microapp or zone callback is added in XAppHub by hand.
- `add-mcp-server/SKILL.md` (text): a new step 6 lets hosted connectors (claude.ai, ChatGPT,
  Amazon Quick) sign in with OAuth: the endpoints and their checks, the redirect URLs as an
  exact-match allow-list in an Amplify variable, and a data API session of the connection's own,
  made at consent with `SUPABASE_SERVICE_ROLE_KEY` (`generateLink` + `verifyOtp`, outside the
  tools) and carried encrypted in the MCP tokens. Rules 1 and 2, the CORS note, the description,
  the tests and the checklist say the same.

## v8.0.0

Install it with `npx skills add buildpad-ai/skills#v8.0.0`. The Organisation Platform guide of
`create-service` gains its two recipes and their code, and the Engine text follows the Engine MCP
server's new tools (Engine 0.1.0-dev.18 and 0.1.0-dev.19). It is a MAJOR release, because existing
files that a Supabase project's agent reads change
(`create-service/references/organization-platform.instructions.md`, and the three files that carry
the reworded ES-9 in shared text). No skill is added, removed or renamed, and the "Establish the
backend first" procedure stays at version 1.

- These files were written on the Buildpad Platform (by Aditya Leksono) and shipped only in its
  vendored copy of the skills, so a sync of a release deleted them. Their text is unchanged.
- `create-service/references/organization-platform-role-assignment.instructions.md` is new: the
  exact recipe for **Automation > Role assignment** (the list, the rule form and the Test rules
  drawer on the headless `builder-core` store, the rule store, the routes and the sync), with the
  real apps' code under `create-service/assets/organization-platform/role-assignment/`.
- `create-service/references/organization-platform-people-sync.instructions.md` is new: importing
  people from the Organisation Platform as sign-in-less accounts, and an offboarding review that
  suspends (never deletes) the people the platform no longer knows, with the code under
  `create-service/assets/organization-platform/people-sync/`.
- Both recipes and their code hold for Supabase projects only. On an Engine project the guide says
  that no such code exists yet, and its rules still hold.
- The two new references carry the "Establish the backend first" procedure and each code asset its
  one-line pointer to it, as every Supabase-only file does. The help article
  `assets/organization-platform/role-assignment/content/role-assignment.mdx` carries no backend
  marker, because an MDX file cannot hold an HTML comment.
- The Organisation Platform guides and code name no company or internal app: the two apps the
  recipes come from are **App A** (multi-tenant) and **App B** (a single organisation). In the code,
  the app's own rule attributes are named `app.emailDomain` and `app.signInMethod`, and
  `ORG_COMPANY_DOMAINS` has no default domain: with none set, no account is a leaver candidate.
- **The Engine's MCP tools.** From Engine 0.1.0-dev.19 the MCP server serves `logs` (the
  application log, as `GET /api/logs` answers it) and `assets` (a file's content); the `scope` tool
  serves every scope route's action, not only `assign_user_role` and `create_config`; the `users`
  tool's `update` takes `add_roles` and `remove_roles`; `cron` gains `recent_history` and `stats`,
  and `services` gains `run_test`. From 0.1.0-dev.18 it serves `workflows` and
  `workflow_assignments`, and the `fields` tool adds and drops indexes and unique constraints
  (`create_index`, `drop_index`, `schema.is_unique`, `schema.add_index`) and renames a field. The
  MCP tools reference and `daas-platform` list them, with the version each needs and the REST route
  for an older Engine; `manage-scope` lets the agent set scopes up through the MCP;
  `add-i18n` makes the translation pair unique with `create_index`; `hooks-extensions` names the
  `utilities` tool; `create-rbac` and `manage-scope` say that `add_roles` binds a role at no scope.
- **ES-9 reworded** (CONTRIBUTING, and every file that carries it): scope types, items and
  collection settings are managed through the MCP `scope` tool or the routes; its reads follow the
  caller's grants and its writes are for administrators.

### Supabase projects

The new files are for Supabase projects only (each has the file marker `supabase`):

- `create-service/references/organization-platform-role-assignment.instructions.md` (new-file):
  build Automation > Role assignment from the real apps' code.
- `create-service/references/organization-platform-people-sync.instructions.md` (new-file): import
  people as sign-in-less accounts and review leavers for suspension.
- The code assets under `create-service/assets/organization-platform/` (new files), which the two
  references tell the agent to copy.
  - `create-service/assets/organization-platform/people-sync/app/api/admin/users/import/route.ts`
  - `create-service/assets/organization-platform/people-sync/app/api/admin/users/leavers/route.ts`
  - `create-service/assets/organization-platform/people-sync/app/api/admin/users/status/route.ts`
  - `create-service/assets/organization-platform/people-sync/lib/admin-user-create.ts`
  - `create-service/assets/organization-platform/people-sync/lib/admin-user-status.ts`
  - `create-service/assets/organization-platform/people-sync/lib/admin-users.ts`
  - `create-service/assets/organization-platform/people-sync/lib/org-platform/leavers.ts`
  - `create-service/assets/organization-platform/people-sync/lib/org-platform/people-import.ts`
  - `create-service/assets/organization-platform/people-sync/lib/org-platform/provenance.ts`
  - `create-service/assets/organization-platform/people-sync/sign-in-guard.patch`
  - `create-service/assets/organization-platform/people-sync/ui/OrgLeaversReview.tsx`
  - `create-service/assets/organization-platform/people-sync/ui/OrgPeopleImport.tsx`
  - `create-service/assets/organization-platform/people-sync/users-page-wiring.patch`
  - `create-service/assets/organization-platform/role-assignment/app/api/admin/org-platform/status/route.ts`
  - `create-service/assets/organization-platform/role-assignment/app/api/org-platform/sync/route.ts`
  - `create-service/assets/organization-platform/role-assignment/app/api/org-rules/route.ts`
  - `create-service/assets/organization-platform/role-assignment/app/api/org-rules/test/route.ts`
  - `create-service/assets/organization-platform/role-assignment/app/dashboard/automation/role-assignment/[ruleId]/page.tsx`
  - `create-service/assets/organization-platform/role-assignment/app/dashboard/automation/role-assignment/new/page.tsx`
  - `create-service/assets/organization-platform/role-assignment/app/dashboard/automation/role-assignment/page.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/api.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/config.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/connection-status.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/notices.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/role-assignment-list.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/rule-conditions.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/rule-form-page.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/styles.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/test-rules-drawer.tsx`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/tokens.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/types.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/use-rule-book.ts`
  - `create-service/assets/organization-platform/role-assignment/components/role-assignment/use-rule-builder.ts`
  - `create-service/assets/organization-platform/role-assignment/content/role-assignment.mdx`
  - `create-service/assets/organization-platform/role-assignment/lib/org-platform/client.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-platform/onboard.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-platform/sync-hint.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/access.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/account.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/builder-config.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/catalog.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/cleanup.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/constants.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/decide.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/outcomes.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/parse.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/store.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/system-attributes.ts`
  - `create-service/assets/organization-platform/role-assignment/lib/org-rules/system-defs.ts`
  - `create-service/assets/organization-platform/role-assignment/wiring.patch`

This file changes:

- `create-service/references/organization-platform.instructions.md` (text): the rules editor is
  built as three screens on the headless `builder-core` store, never the ready-made
  `<RulesBuilder>`; `GET /org-role-assignments` lists `firstName` and `lastName` (from a platform
  updated on 2026-10-26); a new section on people import and offboarding review points to the two
  new references.

These files change only by the reworded Engine statement ES-9, which they carry in shared text:

- `add-multitenancy/SKILL.md` (text)
- `add-multitenancy/references/multitenancy.instructions.md` (text)
- `create-feature/SKILL.md` (text)

## v7.0.0

Two skills are added. Install it with `npx skills add buildpad-ai/skills#v7.0.0`. It is a MAJOR
release, because five existing files that a Supabase project's agent reads now point to the new AI
Chat module (see **Supabase projects** below). No skill is removed or renamed, and the "Establish
the backend first" procedure stays at version 1.

- New skill `add-ai-chat`: installs the Buildpad UI AI Chat module (`@buildpad/ui-chat`) instead of
  a hand-built chat UI and SSE parser. It has the agent choose the backend first, each with its own
  CLI target: browser-direct (`ai-chat-routes`, `chocolateFactoryBackend`), the default and the only
  one that streams on Amplify; or the server proxy (`ai-chat-proxy-routes`, `routeBackend`), only on
  a long-lived Node server. It says plainly that browser-direct shows the key to the browser and,
  because Chocolate Factory's CORS headers do not allow `x-agent-key` yet, needs the project key
  (`cf_…`), which reaches every agent in the project; and that browser-direct keeps transcripts in
  the browser. It covers the environment (the connector's base URL and key, the Agent ID the user
  copies from the CF Portal, `AI_CHAT_SECRET` and `chatOwner` for the proxy), mounting
  `AiChatProvider`, `AiChatButton` and `AiChatPanel` (with the `--bp-ai-chat-offset` margin) or
  `AiChatWidget`, `storageKey`, `vars` with `AiChatContextChip`, `onNavigate`, `imageHosts`, keeping
  the agent's Memory off, validation, and pushing the variables to Amplify. It talks only to the
  Chocolate Factory agent, never to the data API, so it holds for both kinds of project. It needs
  a `@buildpad/cli` release that ships the `ai-chat`, `ai-chat-routes` and `ai-chat-proxy-routes`
  targets (the first after 3.5.2).
- New skill `add-mcp-server`: exposes the app's own data and actions as an MCP server, one stateless
  `/api/mcp` route whose tools forward the caller's own token to the data API.
- The AI Chat module is listed where the other opt-in modules are: `buildpad-reference`,
  `add-buildpad`, `add-microapp` and `add-microfrontend`. The Chocolate Factory reference of
  `create-service` points to it for a chat UI.

### Supabase projects

The Supabase steps, routes and guidance do not change. These files are new:

- `add-ai-chat/SKILL.md` (new-file): install the Buildpad UI AI Chat module (a chat with a
  Chocolate Factory agent) instead of hand-building a chat UI.
- `add-mcp-server/SKILL.md` (new-file): expose the app's own data and actions as an MCP server that
  forwards the caller's token.

These files change, each with its reason:

- `buildpad-reference/SKILL.md` (text): the Opt-in Modules table gains a row for the AI Chat module
  (`@buildpad/ui-chat`, CLI targets `ai-chat-routes` and `ai-chat-proxy-routes`) and its skill
  `add-ai-chat`.
- `add-buildpad/SKILL.md` (text): the Opt-in Modules list gains the AI Chat module's install
  commands (`add ai-chat-routes` for browser-direct, `add ai-chat-proxy-routes` for the server
  proxy), pointing to `add-ai-chat`.
- `add-microapp/SKILL.md` (text): Step 1's list of module skills gains `add-ai-chat` for an AI chat
  or assistant.
- `add-microfrontend/SKILL.md` (text): the table of domains that must use a module gains a row for an
  AI chat or assistant (`add-ai-chat`).
- `create-service/references/chocolate-factory.instructions.md` (text): a note before the
  hand-written chat example says to install the `ai-chat` module (`add-ai-chat`) for a chat UI
  instead of hand-rolling `ChocolateFactoryChat`, and that a browser call uses stateless mode and the
  project key, because Chocolate Factory's CORS headers expose no `X-Conversation-Id` and allow no
  `x-agent-key`; the rest is unchanged.

## v6.2.0

One Engine statement in the new skill was out of date. Install it with
`npx skills add buildpad-ai/skills#v6.2.0`. It stands only in text for Engine projects, so this is a
MINOR release.

- **`migrate-to-engine`, Part A step 7:** the migration tool now switches on, at cut-over, the
  items you rewrote as well as the items it copied. It finds a rewritten item by its kind and its
  name, so the step now says to keep each item's original name. It said before that rewritten items
  had to be switched on by hand.

## v6.1.0

One skill is added. Install it with `npx skills add buildpad-ai/skills#v6.1.0`. No existing
file changes, so this is a MINOR release.

- New skill `migrate-to-engine`: finishes moving a project from Supabase to the Buildpad Engine.
  Part A rewrites each hook, cron job and custom service that the move listed in
  `engine-plan/automation-to-review.json` for the Engine's JavaScript runtime: it explains each
  finding (`require`, `import`, `process`, `fetch`, timers, Node globals, the Supabase service),
  rewrites the body with the Engine's services (`services.env` for operator-exposed keys,
  `services.fetch` for allowed hosts, `services.items` for data), and creates it switched off in the
  Studio or with the Engine's MCP tools `extensions`, `cron` and `services`, to be switched on at
  cut-over. Part B is a checklist for the app's code: environment, password sign-in through a server
  route, data calls with `Authorization: Bearer`, files through the Engine's file routes and signed
  URLs, administrator code, schema and access rules, database functions, cross-origin settings,
  then build and tests. It also tells the agent to show the owner every copied permission rule
  whose dynamic variable resolved to `null` on Supabase and resolves on the Engine. Its references
  `automation-rewrites.instructions.md` and `app-code.instructions.md` hold the before-and-after
  code, for Engine projects only.

### Supabase projects

No existing file changes. This file is new:

- `migrate-to-engine/SKILL.md` (new-file): on a Supabase project it says that the skill applies
  after the move to the Buildpad Engine, points to the public guide, and stops.

## v6.0.0

One Engine statement was out of date. Install it with `npx skills add buildpad-ai/skills#v6.0.0`.
It is a MAJOR release, because three of the changed sentences stand in text that a Supabase
project's agent also reads (see **Supabase projects** below). No skill is added, removed or
renamed, and the "Establish the backend first" procedure stays at version 1.

- **Cron jobs run on their schedule on an Engine project.** Every Engine project runs the Engine's
  scheduler next to its data API, so an active cron job fires at its scheduled time. The skills
  said that the scheduler does not run yet and that a job runs only when it is run by hand. The
  Engine statement ES-13n in [CONTRIBUTING](CONTRIBUTING.md) is retired, and every folder that
  carried it has ES-13m in its place, or no sentence where it only warned: `add-cron`,
  `add-mobile-app`, `create-cron`, `create-feature`, `daas-platform`, `hooks-extensions` and
  `idea-refine`. A job can still be run by hand at any time (`POST /api/cron/:id/run`, the MCP
  `cron` tool's `run_now`, or `services.cron.trigger`).

The change is recorded in `.kiro/specs/backend-aware-skills/design.md` (Engine-fact corrections,
25 October 2026, I1), and task 10.1 is done.

### Supabase projects

The Supabase steps, routes and guidance do not change. These files change because a sentence that
names an Engine project stands in text that both kinds of project read. Each change, with its
reason:

- `add-mobile-app/SKILL.md` (text): Rule 19 drops its last sentence, which said that on an Engine project a cron job runs only when run by hand; an Engine project now runs its scheduler. The Supabase guidance is unchanged.
- `create-feature/SKILL.md` (text): The Engine-project sentence about cron jobs (ES-13n, retired) now says that an active cron job fires at its scheduled time (ES-13m); the Supabase guidance is unchanged.
- `idea-refine/SKILL.md` (text): The cron row drops its note that an Engine project's cron jobs run only when run by hand, because an Engine project now runs its scheduler; it reads as it did in v1.0.0.

## v5.2.0

One Engine statement was wrong. Install it with `npx skills add buildpad-ai/skills#v5.2.0`. The
statement stands only in text for Engine projects, so this is a MINOR release.

- **The Engine's MCP `scope` tool has two actions.** Besides `assign_user_role`, it serves
  `create_config`, which registers a collection as tenanted: it takes the body of
  `POST /api/scope/collection-config` under `config_data`, with that route's checks, to an
  administrator only. Every Engine release has served it. The skills said that the tool only
  assigns a role. The Engine statement ES-9 in [CONTRIBUTING](CONTRIBUTING.md) is reworded, and
  every folder that carries it has the new text. `daas-platform` (the MCP tool table and the
  `scope` section of `daas-mcp-tools`, with a `create_config` example) and `create-rbac` say the
  same. The tool still reads and edits no scope type or item: those stay on the `/api/scope`
  routes.

The change is recorded in `.kiro/specs/backend-aware-skills/design.md` (Engine-fact corrections,
23 October 2026, H5).

### Supabase projects

No file that a Supabase project's agent reads changes.

## v5.1.0

The Organisation Platform connector's guide is now part of the skills. Install it with
`npx skills add buildpad-ai/skills#v5.1.0`. No existing file changes, so this is a MINOR release.

- `create-service/references/organization-platform.instructions.md` is new. It tells the agent how
  to integrate with the Organisation Platform once a project has connected it on the Buildpad
  Platform's Connectors page: the `@xtremax/organisation-platform` package first, the raw external
  API where the package does not apply, and the Automation > Role assignment (rules) screen in the
  app's admin domain. The agent finds it as it finds every connector's guide, by the provider key
  (`organization-platform`) in `get_project_detail`'s `connectors[]`.
- The file was written on the Buildpad Platform and shipped only in its vendored copy of the
  skills, so every sync of a release deleted it. Its text is unchanged.

### Supabase projects

No existing file changes. This file is new:

- `create-service/references/organization-platform.instructions.md` (new-file)

## v5.0.0

Two Engine statements were out of date. Install it with
`npx skills add buildpad-ai/skills#v5.0.0`.

This is a MAJOR release because four of the changed sentences stand in text that a Supabase
project's agent also reads (see **Supabase projects** below). No skill is added, removed or
renamed, and the "Establish the backend first" procedure stays at version 1.

- **The Engine's MCP server serves cron jobs, hooks, custom services and settings.** From Engine
  0.1.0-dev.4 it serves the tools `cron`, `services`, `extensions`, `cors-settings`,
  `smtp-settings` and `module_access_keys`, to an administrator only. The token in a project's MCP
  configuration is an administrator's, so the agent can use them. The skills said that there is no
  MCP tool for any of them. `add-cron`, `add-microapp`, `context-engineering`, `create-cron`,
  `create-rbac`, `create-service`, `daas-platform`, `grant-module-access` and `hooks-extensions`
  now name each tool, with its actions. The Studio and the REST routes stay, for an Engine older
  than 0.1.0-dev.4. There is still no MCP tool for the application log, for a file's content or
  for the utilities.
- **A browser can send `X-Tenant-Id` to the Engine.** From Engine 0.1.0-dev.3 the Engine allows
  that header from any origin, without cookies or credentials. The skills said that a browser
  cannot send it. The Engine statements ES-4 and ES-11 in [CONTRIBUTING](CONTRIBUTING.md) are
  reworded, and every folder that carries them has the new text. The recommendation does not
  change: the sign-in is made by the application's own server route, and a file shown in a browser
  is loaded through a signed URL. `add-buildpad`, `authentication-proxy`, `create-project` and
  `debugging-and-error-recovery` say the same.
- The agent still changes no cross-origin setting (ES-15). The skills name the `cors-settings`
  tool only to say so.
- `tools/repo-check` no longer refuses the `cron`, `services` and `extensions` MCP tools in Engine
  text (its `x-pp29-tool` patterns are removed). The shared contract `backend-contract.json` does
  not change.

The changes are recorded in `.kiro/specs/backend-aware-skills/design.md` (Engine-fact corrections,
23 October 2026), and tasks 10.4 and 10.5 are done.

### Supabase projects

The Supabase steps, routes and guidance do not change. These files change because a sentence that
names an Engine project stands in text that both kinds of project read. Each change, with its
reason:

- `authentication-proxy/SKILL.md` (text): The Engine-project sentences (ES-4) now say that a browser can send X-Tenant-Id to the Engine from another origin, without credentials, and that the sign-in still goes through the application's own server route; the Supabase routes are unchanged.
- `authentication-proxy/references/authentication-proxy.instructions.md` (text): The Engine-project cross-origin sentence now says that a browser may send X-Tenant-Id to the Engine, without credentials, and that the sign-in is still made by the app's own server route; the Supabase text is unchanged.
- `buildpad-reference/SKILL.md` (text): The Engine-project file sentence (ES-11) no longer says a browser cannot name the tenant; it says a file shown in a browser is loaded through a signed URL because an img element or a link sends no X-Tenant-Id. The Supabase text is unchanged.
- `context-engineering/SKILL.md` (text): The extensions line of the MCP tool tree drops its note that the Engine's MCP server has no extensions tool, which the Engine now serves to administrators; it reads as it did in v1.0.0.

## v4.0.0

The identity provider that the skills called **My Apps** is now named **XAppHub**. Install it with
`npx skills add buildpad-ai/skills#v4.0.0`.

This is a MAJOR release because the new name stands in text that a Supabase project's agent also
reads (see **Supabase projects** below). Only the display name changes. The steps for both kinds
of project do not change. No skill is added, removed or renamed, and the "Establish the backend
first" procedure stays at version 1.

- The skills, the agent personas, the checklists, the README and [CONTRIBUTING](CONTRIBUTING.md)
  now say XAppHub where they said My Apps.
- No identifier changes. The provider and the connector are still `my-apps`, the Buildpad CLI
  modules are still `external-oauth` and `external-oauth-engine`, and environment names, example
  code, folder names and URLs stay as they were. An application that already signs users in with
  My Apps keeps working, and you do not have to change it.
- `add-external-oauth`: the naming note says that XAppHub was formerly called My Apps, and that
  its connector and provider are still named `my-apps`. It still keeps XAppHub apart from
  Microsoft's "My Apps" portal. A request for "SSO via XAppHub" or "SSO via MyApps" (with no
  mention of Azure, Entra ID or Microsoft) goes to the XAppHub steps.
- The Engine statements ES-4, ES-5, ES-7 and ES-16 in [CONTRIBUTING](CONTRIBUTING.md) change only
  in the name, and every folder that carries them has the new text.
- Other text for Engine projects only, which now names XAppHub: `add-buildpad`, `add-i18n`,
  `agents/security-auditor.md`, `agents/test-engineer.md`, `create-api-route`, `create-project`,
  `create-rbac`, `create-tests`, `daas-platform`, `grant-module-access`, `manage-scope`,
  `references/module-access-checklist.md`, `references/security-checklist.md` and
  `security-and-hardening`.
- The README catalogue row of `add-external-oauth`, the README's note on what an Engine project
  lacks, and the `add-external-oauth` row of `tools/repo-check/skill-map.json` now name XAppHub.

The released sections of this file and the released change-file entries keep the name My Apps, as
they were written. The rename is recorded in `.kiro/specs/backend-aware-skills/design.md`
(Product rename, 22 October 2026).

### Supabase projects

The Supabase steps, routes and guidance do not change. These files change because a sentence
that names the identity provider stands in text that both kinds of project read. Each change,
with its reason:

- `add-external-oauth/SKILL.md` (description): The description names the identity provider product XAppHub (formerly My Apps); the provider id my-apps and what the Skill does are unchanged.
- `add-external-oauth/SKILL.md` (text): The identity provider product formerly called My Apps is now named XAppHub, and the naming note says so and keeps Microsoft's My Apps portal apart; the connector and provider id my-apps and the Supabase steps are unchanged.
- `add-users/SKILL.md` (text): Engine statement ES-7 names the identity provider product XAppHub (formerly My Apps); the Supabase steps are unchanged.
- `authentication-proxy/SKILL.md` (text): The Engine-project sentences, ES-4 and ES-5 among them, name the identity provider product XAppHub (formerly My Apps); the provider id my-apps, the Supabase routes and the external OAuth section are unchanged.
- `authentication-proxy/references/authentication-proxy.instructions.md` (text): The Engine-project sentences, ES-5 among them, name the identity provider product XAppHub (formerly My Apps); the Supabase text is unchanged.
- `create-feature/SKILL.md` (text): Engine statement ES-16 names the identity provider product XAppHub (formerly My Apps); the module names and the Supabase guidance are unchanged.
- `subagent-delegation/SKILL.md` (text): The Engine-project OAuth review names the identity provider product XAppHub (formerly My Apps); the Supabase routing is unchanged.

## v3.0.0

Engine projects can now sign users in with **My Apps**. Install it with
`npx skills add buildpad-ai/skills#v3.0.0`.

This is a MAJOR release because some of the changed sentences stand in text that a Supabase
project's agent also reads (see **Supabase projects** below). The steps for a Supabase project do
not change. No skill is added, removed or renamed, and the "Establish the backend first" procedure
stays at version 1.

- `add-external-oauth`: on an Engine project the skill no longer stops for every request. While
  the project's My Apps connector is connected, it adds My Apps sign-in. The application's server
  finishes the OpenID Connect authorization-code flow with My Apps (PKCE, `state`, and a nonce
  whose SHA-256 digest goes to My Apps), then signs in to the Engine with the Supabase client's
  `signInWithIdToken` (provider `my-apps`). The skill covers the connector check, the environment,
  the Buildpad CLI's `external-oauth-engine` module (`@buildpad/cli` 3.4.0 and later install it on
  an Engine project in place of `external-oauth`), the login button, accounts that hold no role
  yet (a pending-access page; an administrator gives the role), security and troubleshooting.
  Sign-in with any other provider is still not available on an Engine project, and the skill
  stops.
- The Engine statements ES-4, ES-5, ES-7 and ES-16 in [CONTRIBUTING](CONTRIBUTING.md) are reworded
  for My Apps sign-in, and every folder that carries them has the new text:
  - ES-4: My Apps sign-in also takes its tenant from `X-Tenant-Id`, sent by the application's own
    server route.
  - ES-5: My Apps sign-in works through the Supabase client; OAuth sign-in with any other provider
    does not. An account that holds no role is refused at password sign-in; after a My Apps
    sign-in the application ends that account's session. The code exchange that is not available
    is the Supabase client's.
  - ES-7: a user's first My Apps sign-in creates the account, with no role. An administrator still
    creates every user who signs in with a password, and gives every role.
  - ES-16: the OAuth routes that cannot be used are those of the CLI's `external-oauth` module.
    The routes of `external-oauth-engine` serve My Apps sign-in.
- Other text for Engine projects only, which now names My Apps sign-in where it said that an
  Engine project has no OAuth sign-in:
  - `add-buildpad`: a CLI that installs `external-oauth-engine` (check `installedLib` in
    `buildpad.json`) writes OAuth routes for My Apps sign-in.
  - `add-i18n`: `/auth/pending-access` is a public route when My Apps sign-in is installed; its
    callback lies under `/api/auth`.
  - `agents/security-auditor.md`: a sign-in flow that offers a provider other than My Apps is a
    finding, and a My Apps sign-in must keep the client secret on the server, compare `state`, use
    PKCE and send My Apps the digest of the nonce it gives the Engine.
  - `create-api-route`: My Apps sign-in has its own callback route, written by the CLI.
  - `create-project`: an OAuth callback route is a deliverable only when My Apps sign-in is asked
    for, and the Platform registers its redirect URLs when the My Apps connector is connected.
  - `references/security-checklist.md` and `security-and-hardening`: the checks name OAuth sign-in
    with any provider other than My Apps, and roles for the accounts My Apps sign-in creates.
- The README catalogue row of `add-external-oauth` and the README's list of what an Engine project
  lacks now name My Apps sign-in. In `tools/repo-check/skill-map.json`, `add-external-oauth` has
  both paths (plan `BP`).

These follow the Engine-fact corrections of 20 October 2026 (G1 to G4) in
`.kiro/specs/backend-aware-skills/design.md`.

### Supabase projects

The Supabase steps, routes and guidance do not change. These files change because an
Engine-project sentence, or a description, stands in text that both kinds of project read. Each
change, with its reason:

- `add-external-oauth/SKILL.md` (description): The description is true for both kinds of project: on an Engine project the Skill now adds My Apps sign-in through the Engine's ID-token sign-in, and stops for any other provider.
- `add-users/SKILL.md` (text): Engine statement ES-7 reworded: an administrator creates every user who signs in with a password, and a user's first My Apps sign-in creates an account without a role; the Supabase steps are unchanged.
- `authentication-proxy/SKILL.md` (text): The Engine-project sentences now say that My Apps sign-in is available there through the CLI's external-oauth-engine module and signInWithIdToken, and that every other OAuth provider is not (ES-4 and ES-5 reworded); the Supabase routes and the external OAuth section are unchanged.
- `authentication-proxy/references/authentication-proxy.instructions.md` (text): The Engine-project sentences now say that My Apps sign-in is available there, with its callback redirect, and that every other OAuth provider is not (ES-5 reworded); the Supabase text is unchanged.
- `create-feature/SKILL.md` (text): Engine statement ES-16 reworded: the OAuth routes that cannot be used on an Engine project are those of the external-oauth module, and the external-oauth-engine module's routes serve My Apps sign-in; the Supabase guidance is unchanged.
- `subagent-delegation/SKILL.md` (text): On an Engine project the OAuth review covers My Apps sign-in, the only OAuth sign-in there, instead of saying there is none; the Supabase routing is unchanged.

## v2.1.0

One skill is added, and two Engine-project texts are corrected. Install it with
`npx skills add buildpad-ai/skills#v2.1.0`.

- New skill `add-mobile-app`: wraps the deployed web app as an iOS and Android app with Capacitor
  in server-URL mode, and says when to use platform-managed mobile builds or an Expo mobile
  microapp. It holds for both kinds of project and has no step for one backend only.
- Text for Engine projects only:
  - `create-project/references/environment.instructions.md`: to check that the Engine serves the
    project, send `GET /api/server/info` with the header `X-Tenant-Id`. It answers `200` when the
    project's tenant is served, `403` when that tenant is not served yet or the id is wrong, and
    `503` when the Engine cannot read its tenants. `/api/health` says only that the Engine is up.
  - `debugging-and-error-recovery/SKILL.md`: a browser also blocks a call to the Engine that carries
    a header the Engine does not accept from another origin, such as `X-Tenant-Id`. Send that header
    only from the application's own server route.

  Both follow the Engine-fact corrections of 18 October 2026 (F1 and F2) in
  `.kiro/specs/backend-aware-skills/design.md`, which also record what changes for Engine projects
  when the Engine's approved specifications are implemented.

### Supabase projects

No existing file changes. The skill `add-mobile-app` is new, with these files:

- `add-mobile-app/SKILL.md` (new-file)
- `add-mobile-app/assets/android/MainActivity.java` (new-file)
- `add-mobile-app/assets/lib/apps/launch-url.ts` (new-file)
- `add-mobile-app/assets/lib/native/platform.ts` (new-file)
- `add-mobile-app/references/limitations.instructions.md` (new-file)
- `add-mobile-app/references/native-back-navigation.instructions.md` (new-file)
- `add-mobile-app/references/troubleshooting.instructions.md` (new-file)

## v2.0.0

The skills now serve **Engine projects** (backend: the Buildpad Engine) as well as **Supabase
projects**. Install it with `npx skills add buildpad-ai/skills#v2.0.0`.

- Each file whose steps differ by backend opens with the procedure "Establish the backend first"
  (version 1). The agent reads `.buildpad/project.json`, then `.buildpad/backend-answer.json`,
  then looks for a `supabase/` project folder, and otherwise asks the developer once. Then it
  follows only the parts for that backend.
- All 44 skills, personas and reference folders that mention the backend are converted. Where the
  Engine has no counterpart yet (external OAuth sign-in, database migrations, the micro-frontend
  skills), the skill says so and stops.
- New Engine-only reference files: `create-api-route/references/engine-api-routes.instructions.md`,
  `hooks-extensions/references/engine-hooks.instructions.md`,
  `hooks-extensions/references/engine-services-api.instructions.md`,
  `hooks-extensions/references/engine-utilities-api.instructions.md`,
  `manage-scope/references/engine-scope-management.instructions.md` and
  `manage-scope/references/engine-scope-permissions.instructions.md`.
- New repository check (`tools/repo-check/`, see [CONTRIBUTING](CONTRIBUTING.md)). It runs in CI
  on every pull request and on every tag push.
- `add-microfrontend` and `add-microfrontend-zones` now install with the skills CLI. Their
  front matter did not parse as YAML, so the CLI skipped them.

No skill is added, removed or renamed.

### Supabase projects

Supabase projects get the same steps as in `v1.0.0`, with two kinds of change. First, the
"Establish the backend first" procedure is added at the top of 75 files. On a Supabase project it
finds the backend and then follows the Supabase parts, which are the `v1.0.0` text. Second, the
changes below, each with its reason:

- `add-external-oauth/SKILL.md` (description): The description names the kind of project: it says the Skill is for Supabase projects only and stops on an Engine project, where OAuth sign-in is not available.
- `add-microfrontend-zones/SKILL.md` (description): The description now says the skill is for Supabase projects only for now and not yet available on an Engine project.
- `add-microfrontend-zones/SKILL.md` (text): The front-matter description and argument-hint are now quoted, so the front matter parses as YAML; the values are unchanged. At v1.0.0 the unquoted argument-hint did not parse, and the skills CLI skipped the skill on install.
- `add-microfrontend/SKILL.md` (description): The description now says the skill is for Supabase projects only for now and not yet available on an Engine project.
- `add-multitenancy/SKILL.md` (text): Engine-project sentences added: the project is one tenant with every scope below its tenant node (ES-9), and the scope column's foreign key to daas_scope_items(uri_path); the delegation to manage-scope is unchanged.
- `add-multitenancy/references/multitenancy.instructions.md` (text): The same Engine-project sentences added, and the listed manage-scope references named as a Supabase project's, since manage-scope's SKILL.md names the references for each kind of project.
- `add-users/SKILL.md` (text): Reworded so every statement is true for both kinds of project: the cross-origin setup is qualified as a Supabase-project step, and Engine-project sentences on static tokens, cross-origin and creating users with a role in the tenant are added; the Supabase steps are unchanged.
- `agents/security-auditor.md` (description): The description now names access rules in a way true for both kinds of project (RLS on a Supabase project) and says the persona serves either kind.
- `authentication-proxy/SKILL.md` (text): Reworded so every statement is true for both kinds of project: the OAuth routes and the external OAuth section are qualified as Supabase-project only, and the Engine-project address, sign-in, tenant, token and multi-factor sentences (ES-1, ES-2, ES-4, ES-5, ES-6) are added; the Supabase steps are unchanged.
- `authentication-proxy/references/authentication-proxy.instructions.md` (text): Reworded so every statement is true for both kinds of project: the diagram and the environment block are named as a Supabase project's, and the Engine-project address, cross-origin, sign-in and environment sentences (ES-1, ES-3, ES-5) are added with an Engine environment block; the Supabase steps are unchanged.
- `buildpad-reference/SKILL.md` (text): Sentences added so the file is true for both kinds of project: where an Engine project serves file content and how a browser shows a file there (ES-11), and that the Engine answers a delete with 204 and no body; the Supabase guidance is unchanged.
- `buildpad-reference/references/react-components.instructions.md` (text): The DaaSProvider examples take the address from NEXT_PUBLIC_BUILDPAD_DAAS_URL instead of a sample host, and the token rule is stated for both kinds of project (a static token on a Supabase project, a signed-in user's access token on an Engine project, ES-2).
- `buildpad-steering-custom/SKILL.md` (text): The skill carries the Gate and now records in custom steering the backend the Gate established, never inferred from dependency or variable names; the templates and rules are unchanged.
- `buildpad-steering/SKILL.md` (text): The skill carries the Gate, and bootstrap's tech analysis now records the backend the Gate established, never inferred from dependency or variable names; the templates and rules are unchanged.
- `context-engineering/SKILL.md` (text): Qualified so each line is true for both kinds of project: the architecture, the MCP server (the Engine's has no extensions tool) and the environment file name the Engine project's one address for data and sign-in; the Supabase guidance is unchanged.
- `create-api-route/SKILL.md` (description): The description names both kinds of project: on an Engine project the Skill writes routes that forward the signed-in user's session to the Engine, and on a Supabase project the Supabase auth routes it wrote before.
- `create-collection/SKILL.md` (description): The description says "with its schema" instead of "with database migration", so it is true for both kinds of project.
- `create-feature/SKILL.md` (text): Qualified sentences added so the planning guidance is true for both kinds of project: scopes sit below the project's tenant on an Engine project (ES-9), the server-side module-access check goes through /api/permissions/me there (ES-16), and a cron job's body and schedule there follow the Engine's runtime (ES-10, ES-13n); the Supabase guidance is unchanged.
- `create-feature/references/vform-usage.instructions.md` (text): Names where the collection schema is stored on each kind of project (the DaaS, or the Engine).
- `create-form-builder/SKILL.md` (text): Qualified so each statement is true for both kinds of project: the cross-origin setup is a Supabase-project step (an Engine project needs none, ES-15), create-migration is named for Supabase projects only, and the Engine's list cap of 1000 and 204 delete answer are stated; the Supabase steps are unchanged.
- `create-form-builder/references/form-builder.instructions.md` (text): Scope wording: per-scope overrides instead of per-tenant, and on an Engine project permission presets are not applied, so the scope comes from the create-time default.
- `create-migration/SKILL.md` (description): The description names the kind of project: it says the Skill is for Supabase projects only, and that on an Engine project it writes no file, stops, and names the skills that change structure and access there.
- `create-project/SKILL.md` (description): The description now says the skill initializes a Buildpad application on the Buildpad Engine or on Supabase, instead of naming Supabase only.
- `create-tests/SKILL.md` (description): The description now names RLS tests as a Supabase-project case, so it holds for Engine and Supabase projects alike.
- `daas-platform/SKILL.md` (description): The front-matter description now names both kinds of project (Engine projects and Supabase projects) instead of describing a Supabase integration only.
- `idea-refine/SKILL.md` (text): The stack is named as Next.js and the project's Buildpad backend (DaaS and Supabase, or the Buildpad Engine), and the cron and scope rows say how they differ on an Engine project.
- `incremental-implementation/SKILL.md` (text): The first data slice defines the collection through create-collection, which writes a migration on a Supabase project and calls the Engine on an Engine project, instead of naming a migration.
- `performance-optimization/SKILL.md` (text): Engine-project sentences added: a field is indexed through schema.add_index when it is created, deep is ignored, and limit is capped at 1000; the Supabase guidance is unchanged.
- `planning-and-task-breakdown/SKILL.md` (text): The data tasks define the collection through create-collection (a migration on a Supabase project, the Engine's API on an Engine project) instead of naming a migration file path, and the access criterion names RLS for Supabase projects and roles, policies and permissions for Engine projects.
- `relational-permissions/SKILL.md` (removed-link): The link to RELATIONAL_PERMISSIONS.md under References pointed outside this repository and resolved in no install, so it is removed.
- `review-code/SKILL.md` (text): Qualified so each check holds for both kinds of project: on an Engine project any service-role key reference and any Supabase client call other than sign-in are findings, and the proxy and backend-first checks name the Engine's counterparts; the Supabase checks are unchanged.
- `spec-driven-development/SKILL.md` (text): The scope item says that on an Engine project the hierarchy begins beneath the project's tenant node; the Supabase guidance is unchanged.
- `subagent-delegation/SKILL.md` (text): Qualified for both kinds of project: RLS is named as a Supabase project's access rule, OAuth review as a Supabase-project check (OAuth sign-in is not available on an Engine project), and strict ordering covers collection definitions as well as migrations.

Read through by Rudy on 17 October 2026, on the candidate commit `a8ce84d`.

## v1.0.0

The Baseline_Revision: the last revision of `main` before the skills learned to serve Engine
projects (commit `7ed910f`). It is the skills exactly as Supabase projects used them until then.
Stay on it with `npx skills add buildpad-ai/skills#v1.0.0`.
