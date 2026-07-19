---
name: Environment Setup
description: Instructions for configuring environment variables
applyTo: "**/.env*"
---

# Environment Configuration Instructions

## Prerequisites

Before configuring environment or running any project commands, verify required tools:

```bash
node --version && pnpm --version && git --version
```

If missing, see [prerequisites.instructions.md](prerequisites.instructions.md) for installation by OS.

## Architecture Overview

Generated DaaS applications use a **two-tier architecture** with a **server-side proxy**:

1. **Frontend App** (this project) - Next.js application with proxy API routes
2. **DaaS Backend** (DaaS) - DaaS-compatible API server

```
┌─────────────────┐      ┌─────────────────────────┐      ┌──────────────┐
│  Frontend App   │ ──── │  DaaS   │ ──── │   Supabase   │
│  (Next.js)      │ API  │  (DaaS Backend)         │      │  (Database)  │
└─────────────────┘      └─────────────────────────┘      └──────────────┘
     Same-origin            Cross-origin (proxied)
     /api/* routes           Server-side only
```

**All browser requests go to `/api/*` proxy routes on the same origin.**
**The proxy routes forward requests to the DaaS backend server-side (no CORS).**

## Required Environment Variables

### For Frontend Apps (main-nextjs pattern)

```env
# Supabase - For client-side auth only
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# DaaS Backend - The API server
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

### For DaaS Backend (DaaS)

```env
# Supabase - Full access for backend operations
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# MCP Server (optional)
MCP_ENABLED=true
```

## Setup Steps

1. **Start the DaaS Backend first**:

   ```bash
   cd DaaS
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   pnpm dev
   ```

2. **Configure Frontend App**:
   ```bash
   cd your-app
   cp .env.local.example .env.local
   # Set NEXT_PUBLIC_BUILDPAD_DAAS_URL to the backend URL
   pnpm dev
   ```

## Common Issues

### CORS errors when calling DaaS backend

- The browser must NEVER call the DaaS backend directly
- All requests go through `/api/*` proxy routes (same-origin)
- Verify login page uses `fetch('/api/auth/login')` not `supabase.auth.signInWithPassword()`
- See [authentication-proxy.instructions.md](../../authentication-proxy/references/authentication-proxy.instructions.md)

### "Unauthorized" or 401 errors

- Check that the DaaS backend is running
- Verify NEXT_PUBLIC_BUILDPAD_DAAS_URL is correct
- Ensure user is authenticated

### "Connection refused" errors

- Start the DaaS backend server first
- Check the port matches the URL

### Auth not working

- Verify Supabase URL and anon key are set
- Check Supabase project has auth enabled
- Ensure redirect URLs are configured in Supabase dashboard
