````instructions
---
name: xBot Reference
description: What it means for this project's repository that the xBot software factory is connected, which branches and pull requests are xBot's, and how to hand a problem to xBot through its signal API
applyTo: "**/*"
---

# xBot, the software factory working on this repository

**Identity check — read this first.** "xBot" is the `displayName` of a connector on this project's Connectors page (`key: "xbot"` in `get_project_detail`'s `connectors[]`). When that entry is present with `status: "connected"`, the xBot software factory fixes problems reported for this project automatically: it reads the reported problem, writes the fix on a branch of this repository, opens a pull request, and follows the deploy. When there is no such entry, none of this applies and xBot does not touch the repository.

`connectors[]` lists xBot with its status and `externalId` (xBot's id for this app). It carries **no credential**: xBot holds a token of its own, limited to reading the project and obtaining short-lived repository credentials. Nothing in this project needs an xBot key to work with xBot's branches.

## Branches and pull requests that belong to xBot

- Branches named `xbot/*` are xBot's working branches. **Do not delete, rename, rebase, force-push or commit to them**, and do not reuse the `xbot/` prefix for your own branches. xBot rewrites them itself while it works on a fix.
- Pull requests whose title starts with `xbot:` were opened by xBot. Their description says which problem they fix, which checks ran and which files changed.
- xBot never pushes to the default branch (`main`). Whether it may **merge** its pull requests is the project team's choice on the Connectors page ("Allow xBot to merge to main", off by default); while it is off, people merge xBot's pull requests.
- To ask xBot to change one of its pull requests, comment on that pull request with a line that starts with `/xbot fix`, followed by what to change:

  ```
  /xbot fix The date must be shown in the user's time zone, not UTC.
  ```

  xBot updates the same branch and pull request. Comments without `/xbot fix` are read by people only.
- If you need to change code an open xBot pull request also changes, prefer commenting with `/xbot fix` on it, or wait until it is merged or closed, to avoid merge conflicts on xBot's branch.

## Handing a problem to xBot (its signal API)

A problem reaches xBot as a **signal**. Users' feedback reaches it on its own when the project's Get Feedback connector was set up by auto-provisioning. To send problems from this app's own code (an error handler, a support form, a monitoring hook), call xBot's signal API from a **server-side** route:

- **Address:** `POST <xBot address>/api/v1/signals`. The xBot address is the xBot connector's `apiBaseUrl` in `connectors[]`.
- **Key:** an xBot API key (`xbk_…`) that a member of the xBot factory creates for this app on xBot's **Integrations** page. Keep it in a server-only environment variable (for example `XBOT_SIGNAL_API_KEY`, not `NEXT_PUBLIC_…`), set on Amplify with `amplify_set_env_vars`. Never send it to the browser.
- **Request:** `Authorization: Bearer <key>`, `Content-Type: application/json`, a body of at most these fields:

  | Field | Required | Value |
  | --- | --- | --- |
  | `appId` | yes | The xBot connector's `externalId` |
  | `title` | yes | 1 to 200 characters |
  | `description` | yes | 1 to 10,000 characters: what happened, where, how to see it |
  | `type` | yes | `bug_report`, `feature_request`, `error_alert` or `other` |
  | `severityHint` | no | `critical`, `high`, `medium` or `low` |
  | `externalId` | no | Your own id for the problem; sending the same id again answers the first signal instead of creating a second |
  | `links` | no | Up to 10 `https://` links |
  | `reporterRef` | no | An opaque reference to who reported it; never a name, an email or a phone number |

- **Answers:** `201` with `{ id, status: "received", statusUrl }`; `200` with the earlier signal for a repeated `externalId`; `400` with `error.issues` for a field; `401` for a missing or wrong key; `403` for a key of another app; `429` with `Retry-After` when too many are sent. `GET <statusUrl>` with the same key reports what xBot did with it.

```ts
// app/api/report-problem/route.ts (server side only)
export async function POST(request: Request) {
  const { title, description } = await request.json();
  const res = await fetch(`${process.env.XBOT_BASE_URL}/api/v1/signals`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.XBOT_SIGNAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: process.env.XBOT_APP_ID, title, description, type: 'bug_report' }),
  });
  return Response.json(await res.json(), { status: res.status });
}
```

The text of a signal is treated by xBot as untrusted input from users: do not put secrets, tokens or personal data in it.
````
