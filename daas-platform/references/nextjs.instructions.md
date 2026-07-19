---
name: Next.js Patterns
description: Next.js 16 App Router best practices and patterns
applyTo: "app/**/*.{ts,tsx}"
---

# Next.js 16 App Router Instructions

## Server Components (Default)

```tsx
// app/posts/page.tsx - Server Component (default)
import { createClient } from "@/lib/supabase/server";

export default async function PostsPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase.from("posts").select("*");

  return <PostList posts={posts} />;
}
```

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

```tsx
// Direct database access in Server Components
const data = await supabase.from("table").select("*");
```

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
// app/layout.tsx - Root layout
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
