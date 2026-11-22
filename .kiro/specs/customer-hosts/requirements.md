# Customer hosts — requirements and design (lightweight spec)

A small change: one new Platform dependency, two Tenancy statements and one section of the
Mode_Guide. Requirements and design are in one file; the tasks are in `tasks.md`.

## Context

On 22 November 2026 the Buildpad Platform serves every customer of a project with Customer_Tenants
on a host name of its own, `<slug>.<customer domain>` (for xLMS, `*.lms.apps.buildpad.ai`).
`get_project_detail` lists each customer as `{ id, name, slug, state }`. The Engine still maps no
host name to a tenant, and its `GET /api/auth/tenants` entries carry no slug.

The pattern was built and tested first in the xLMS application (its spec `host-tenant-routing`,
pull request 90 on the project's main repository, open when this was written). Its unit tests, and the end-to-end
runs against the Engine (a member entered without a chooser, a person in two customers entered
without a chooser, a non-member refused with no session kept), are the evidence for section 14.

## Decisions (user, 22 November 2026)

- **D-1 Platform feature.** Customer hosts are a Platform feature for every project with
  Customer_Tenants, not one project's setup. Registered as **TD-18**, met 22 November 2026.
- **D-2 Split TS-N2.** TS-N2 forbade "a customer's tenant id in the application", which the host
  map needs. A public (signed-out) page of one customer is still not available (TD-8), so TS-N2 is
  retired and **TS-N2m** keeps that, without the ban on a sign-in map. **TS-H1** is new and states
  the customer-host rules.
- **D-3 Delivery.** One branch and one pull request, with the v10.3.0 changelog and install tag.

## Requirements (EARS)

1. When TD-18 is met, the registry shall retire TS-N2 (`until` gains TD-18) and make TS-N2m
   (requires TD-18, until TD-8) and TS-H1 (requires TD-18) live, each in every file its `in` names.
2. The Mode_Guide `engine-customer-tenants` shall hold TS-N2m in section 4, and a section 14 that
   holds TS-H1 and tells the agent how to build:
   2.1 the committed map from `customers[]` (slug → tenant id and name), and an Edge-safe matcher
       that accepts one DNS label of the customer domain only;
   2.2 404 from the middleware for a subdomain that the map does not name;
   2.3 on a customer's host: the sign-in entering that customer with no chooser; a non-member
       refused with 403 `NOT_A_MEMBER`, with this host's new cookies dropped and no sign-out; the
       list, switch and decline limited to the host's customer; the current customer read from it;
   2.4 `publicOrigin()` putting the request's mapped customer host first, rebuilt from the checked
       name, so that a redirect never goes to a lookalike or unmapped host;
   2.5 development on `<slug>.localhost`, the unit tests (lookalike hosts included), and Playwright
       naming the host with `X-Forwarded-Host`;
   2.6 how a new customer host is added, and how to check a deploy.
3. `create-api-route`'s Engine routes reference and `authentication-proxy`'s reference shall hold
   TS-N2m and TS-H1 in place of TS-N2, with what changes in the routes and in `publicOrigin()`.
4. `add-mcp-server` shall say how the consent runs on a customer's host; `debugging-and-error-recovery`
   shall name the three new symptoms.
5. No text a Supabase project's agent reads shall change (a MINOR release).

## Not in scope

- A public page per customer (TD-8, unchanged: TS-N2m holds until it is met).
- The MCP server per customer host: discovery stays on `MCP_RESOURCE_URL`.
- A field in `get_project_detail` or `.buildpad/project.json` naming the customer domain: until the
  Platform adds one, the agent asks the developer once.
