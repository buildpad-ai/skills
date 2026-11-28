---
name: Next.js Patterns
description: Next.js 16 App Router best practices and patterns
applyTo: "app/**/*.{ts,tsx}"
---

# Next.js 16 App Router Instructions

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

## Server Components (Default)

<!-- buildpad-backend: supabase -->
```tsx
// app/posts/page.tsx - Server Component (default)
import { createClient } from "@/lib/supabase/server";

export default async function PostsPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase.from("posts").select("*");

  return <PostList posts={posts} />;
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```tsx
// app/posts/page.tsx - Server Component (default)
// On an Engine project data comes from the Engine's data API, with the
// signed-in user's access token; the Supabase client is for sign-in only.
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

export default async function PostsPage() {
  const response = await fetch(`${getDaasUrl()}/api/items/posts?fields=*`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  const { data: posts } = await response.json();

  return <PostList posts={posts} />;
}
```
<!-- /buildpad-backend -->

## Client Components

```tsx
// Use 'use client' only when needed:
// - useState, useEffect, event handlers
// - Browser APIs
// - Third-party libraries requiring client

"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

## Data Fetching Patterns

### Server-Side

<!-- buildpad-backend: supabase -->
```tsx
// Direct database access in Server Components
const data = await supabase.from("table").select("*");
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```tsx
// Through the Engine's data API in Server Components, with the user's token
const { data } = await fetch(`${getDaasUrl()}/api/items/table`, {
  headers: await getAuthHeaders(),
  cache: "no-store",
}).then((r) => r.json());
```
<!-- /buildpad-backend -->

### Client-Side with React Query

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { ItemsService } from "@/lib/buildpad/services";

export function ClientDataComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ["items", collection],
    queryFn: () => new ItemsService(collection).readByQuery({ limit: 50 }),
  });
}
```

## API Routes

```tsx
// app/api/items/[collection]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  const { collection } = await params;
  // Handle GET request
  return NextResponse.json({ data: [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Handle POST request
  return NextResponse.json({ data: {} }, { status: 201 });
}
```

## Layouts and Templates

```tsx
// app/[lang]/layout.tsx - Root layout (app/layout.tsx in an app without locale routing)
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import "./design-tokens.css";
import "./globals.css";
import { theme } from "@/lib/theme";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
```

## Loading and Error States

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return <Skeleton height={200} />;
}

// app/posts/error.tsx
("use client");

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

## Metadata

```tsx
// Static metadata
export const metadata = {
  title: "Page Title",
  description: "Page description",
};

// Dynamic metadata
export async function generateMetadata({ params }: Props) {
  const post = await getPost(params.id);
  return { title: post.title };
}
```

## Route Handlers Best Practices

1. Use `NextResponse.json()` for JSON responses
2. Handle errors with appropriate status codes
3. Validate request body with Zod
4. Use query params via `request.nextUrl.searchParams`
5. Implement proper authentication checks
