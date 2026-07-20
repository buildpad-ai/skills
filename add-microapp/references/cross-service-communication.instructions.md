````markdown
# Cross-Domain Data Access

## Overview

In the single shared DaaS architecture, all micro-apps connect to the **same DaaS backend**. Cross-domain data access is straightforward — any app can query any collection directly from the browser, subject to the user's RBAC permissions.

Apps call DaaS **directly** using `Authorization: Bearer <supabase-jwt>` headers. No Next.js proxy routes are needed. CORS is configured on DaaS via `CORS_ORIGINS`.

## Data Access Patterns

### 1. Direct Collection Query (Primary Pattern)

The simplest and most common approach — a micro-app queries a collection from another domain directly:

```typescript
import { useDaaSContext } from '@/lib/buildpad/services';

// billing-app needs user profile data
// Just query the profiles collection — it's in the same DaaS!
export function useProfile(userId: string) {
  const { buildUrl, getHeaders } = useDaaSContext();

  return useEffect(() => {
    fetch(buildUrl(`/api/items/profiles/${userId}`), { headers: getHeaders() })
      .then(r => r.json())
      .then(({ data: profile }) => setProfile(profile));
  }, [userId]);
}
```

**When to use:**

- Any time you need data from another domain's collection
- Simple lookups (get by ID, filter by field)
- This is the default approach — no extra setup needed

**Why it works:**

- All apps share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`
- DaaS has CORS configured via `CORS_ORIGINS` env var
- DaaS RBAC controls what the authenticated user can access

### 2. DaaS Relational Fields (Recommended for Related Data)

When collections have relationships (M2O, O2M, M2M), use DaaS deep queries to fetch related data in a single request:

```typescript
import { useDaaSContext } from '@/lib/buildpad/services';

export function useInvoiceWithUser(invoiceId: string) {
  const { buildUrl, getHeaders } = useDaaSContext();

  return useEffect(() => {
    // Fetch invoice with user profile data in ONE request
    fetch(buildUrl(`/api/items/invoices/${invoiceId}?fields=*,user_id.display_name,user_id.email`), {
      headers: getHeaders()
    })
      .then(r => r.json())
      .then(({ data: invoice }) => {
        // invoice.user_id = { display_name: 'John Doe', email: 'john@example.com' }
        setInvoice(invoice);
      });
  }, [invoiceId]);
}
```

**When to use:**

- Collections have defined relational fields in DaaS schema
- You need data from related collections on the same page
- Performance matters (one request vs. multiple)

**Setup (via MCP):**

```json
// Define M2O relation: invoices.user_id → profiles.id
// mcp_daas_fields -> action: create
// Setting meta.options.related_collection auto-creates the FK constraint + daas_relations row
{
  "collection": "invoices",
  "field": "user_id",
  "type": "uuid",
  "meta": {
    "interface": "list-m2o",
    "special": ["m2o"],
    "options": {
      "related_collection": "profiles",
      "on_delete": "SET NULL"
    }
  }
}
```

> **Non-PK FK target:** If the FK references a non-PK column (e.g. `uri_path` instead of `id`), add `"related_field": "uri_path"` inside `options`. For UUID primary key targets, `related_field` can be omitted (defaults to the PK).

### 3. Data Denormalization (Performance Pattern)

Store a read-only copy of frequently needed cross-domain data:

```typescript
// Invoice stores user_display_name directly
// Instead of fetching from profiles on every read
{
  "id": "inv-001",
  "user_id": "user-123",
  "user_display_name": "John Doe",  // Denormalized from profiles
  "amount": 99.99
}
```

**When to use:**

- High-frequency reads where the relational query adds latency
- Data that changes infrequently (display names, emails)
- Reporting/analytics where historical accuracy matters

**Keeping it fresh:**

- Use DaaS action hooks: when a profile updates, update denormalized fields
- Accept staleness for display-only fields
- Use relational queries for real-time accuracy when needed

### 4. DaaS Runtime Extensions (Event-Based)

Use DaaS action hooks to trigger cross-domain side effects:

```javascript
// DaaS action hook: after invoices.create
// Automatically create an analytics event when an invoice is created
module.exports = function registerHook({ action }) {
  action(
    "invoices.items.create",
    async ({ payload, accountability }, { services }) => {
      const { ItemsService } = services;
      const eventsService = new ItemsService("events", { accountability });

      await eventsService.createOne({
        type: "invoice.created",
        source_collection: "invoices",
        source_id: payload.id,
        user_id: accountability.user,
        metadata: { amount: payload.amount },
      });
    },
  );
};
```

**When to use:**

- Automatic side effects across domains (audit trail, notifications)
- Data synchronization between collections
- Business rules that span multiple domains

## Typed Data Access

### Service Module Pattern

Create typed accessor modules for cross-domain data:

```typescript
// lib/data/profiles.ts (used in billing-app)
import type { UserProfile } from "@/types/contracts/users";
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';

export async function getProfile(userId: string): Promise<UserProfile> {
  const response = await fetch(buildApiUrl(`/api/items/profiles/${userId}`), { headers: getApiHeaders() });
  if (!response.ok)
    throw new Error(`Failed to fetch profile: ${response.status}`);
  const body = await response.json();
  return body.data;
}

export async function listProfiles(
  params?: URLSearchParams,
): Promise<UserProfile[]> {
  const query = params?.toString() || "";
  const response = await fetch(buildApiUrl(`/api/items/profiles?${query}`), { headers: getApiHeaders() });
  if (!response.ok)
    throw new Error(`Failed to fetch profiles: ${response.status}`);
  const body = await response.json();
  return body.data;
}
```

```typescript
// Using the accessor in a server component
import { getProfile } from '@/lib/data/profiles';

export default async function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const invoice = await getInvoice(invoiceId);
  const profile = await getProfile(invoice.user_id);

  return (
    <div>
      <h1>Invoice #{invoice.id}</h1>
      <p>Customer: {profile.display_name}</p>
    </div>
  );
}
```

### Shared Types Package

Define interfaces for all domain collections:

```typescript
// packages/shared-types/src/users.ts
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

// packages/shared-types/src/billing.ts
export interface Invoice {
  id: string;
  user_id: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue";
  created_at: string;
  // Relational (populated via ?fields=*,user_id.*)
  user_id_detail?: UserProfile;
}
```

## Error Handling

Even though all apps share the same DaaS, handle errors gracefully:

```typescript
// lib/data/profiles.ts
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';

export async function getProfileSafe(
  userId: string,
): Promise<UserProfile | null> {
  try {
    const response = await fetch(buildApiUrl(`/api/items/profiles/${userId}`), { headers: getApiHeaders() });
    if (response.status === 403) {
      // RBAC: user doesn't have permission to read profiles
      console.warn("No permission to read profiles");
      return null;
    }
    if (!response.ok) {
      console.error(`Profiles API error: ${response.status}`);
      return null;
    }
    const body = await response.json();
    return body.data;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
}
```

### Graceful Degradation in UI

```typescript
// Show invoice even if profile fetch fails
export default async function InvoicePage({ invoiceId }: { invoiceId: string }) {
  const invoice = await getInvoice(invoiceId);
  const profile = await getProfileSafe(invoice.user_id);

  return (
    <div>
      <h1>Invoice #{invoice.id}</h1>
      <p>Customer: {profile?.display_name ?? `User ${invoice.user_id}`}</p>
    </div>
  );
}
```

## RBAC Considerations

The user's role determines what data they can access across all apps:

| Scenario                                   | What Happens                                |
| ------------------------------------------ | ------------------------------------------- |
| Billing app queries `profiles` collection  | DaaS checks user's role has read permission |
| Users app queries `invoices` collection    | DaaS returns 403 if role lacks permission   |
| Admin queries any collection from any app  | Full access (admin role has CRUD on all)    |
| Viewer queries write endpoint from any app | DaaS returns 403 (read-only role)           |

**Design RBAC with cross-domain access in mind:**

```json
// billing_manager needs to read profiles (to show customer names)
{ "role": "billing_manager", "collection": "profiles", "action": "read", "fields": ["id", "display_name", "email"] }

// analytics_viewer needs to read across domains for reports
{ "role": "analytics_viewer", "collection": "invoices", "action": "read", "fields": ["id", "amount", "status", "created_at"] }
{ "role": "analytics_viewer", "collection": "profiles", "action": "read", "fields": ["id", "display_name"] }
{ "role": "analytics_viewer", "collection": "events", "action": "read", "fields": ["*"] }
```

## Anti-Patterns

| Anti-Pattern                    | Why It's Bad                     | Correct Approach                              |
| ------------------------------- | -------------------------------- | --------------------------------------------- |
| API-to-API calls between apps   | Unnecessary — same DaaS backend  | Query the collection directly                 |
| Duplicating collections per app | Schema drift, data inconsistency | One collection, shared access                 |
| Creating data proxy API routes  | Unnecessary extra layer          | Call DaaS directly with useDaaSContext headers|
| Hardcoding collection names     | Fragile to schema changes        | Use constants/enums from shared-types         |
| Ignoring fetch errors           | Silent failures                  | Handle 403, 404, 500 gracefully               |
````
