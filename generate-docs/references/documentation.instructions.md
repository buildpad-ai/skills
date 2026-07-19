# Documentation Generation Instructions

This document defines how documentation should be generated and maintained alongside code changes in DaaS RAD Platform projects.

## 🔴 CRITICAL: Every Code Change MUST Update Documentation

**⛔ NEVER complete any code generation, implementation, or fix without updating the documentation!**

Documentation is a first-class deliverable, not an afterthought. All code changes must be accompanied by corresponding documentation updates in the `/docs` directory.

## Documentation Directory Structure

```
docs/
├── README.md                    # Documentation index & navigation
├── ARCHITECTURE.md              # System architecture overview
├── API_REFERENCE.md             # API endpoint documentation
├── COMPONENTS.md                # UI component catalog
├── HOOKS.md                     # Custom React hooks documentation
├── COLLECTIONS.md               # Data model & collections
├── WORKFLOWS.md                 # Workflow definitions & states
├── CHANGELOG.md                 # Detailed change history
├── api/                         # Detailed API documentation
│   ├── items.md                 # Items API
│   ├── collections.md           # Collections API
│   ├── fields.md                # Fields API
│   ├── relations.md             # Relations API
│   ├── versions.md              # Versioning API
│   ├── workflow.md              # Workflow API
│   └── [collection].md          # Per-collection API docs
├── components/                  # Component documentation
│   ├── forms/                   # Form components
│   ├── lists/                   # List/table components
│   ├── modals/                  # Modal dialogs
│   └── [component-name].md      # Individual component docs
├── features/                    # Feature documentation
│   └── [feature-name].md        # Feature-specific docs
├── guides/                      # How-to guides
│   ├── getting-started.md       # Quick start guide
│   ├── authentication.md        # Auth setup
│   ├── adding-collections.md    # Add new data models
│   ├── creating-workflows.md    # Workflow setup
│   └── testing.md               # Testing guide
└── schemas/                     # JSON schemas & examples
    ├── [collection].schema.json # Collection schemas
    └── [collection].example.json # Example data
```

## Documentation Requirements by Change Type

### When Creating API Routes

Update/Create these docs:

| Change              | Documentation Required                                             |
| ------------------- | ------------------------------------------------------------------ |
| New endpoint        | `docs/API_REFERENCE.md` - Add endpoint to table                    |
|                     | `docs/api/[collection].md` - Full endpoint documentation           |
|                     | `docs/schemas/[collection].schema.json` - Request/response schemas |
| Modified endpoint   | Update all affected docs above                                     |
| Deprecated endpoint | Mark as deprecated in docs, add migration notes                    |

**API Documentation Template:**

````markdown
## [METHOD] /api/[path]

[Brief description of what this endpoint does]

### Request

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| Authorization | Bearer {token} | Yes |
| Content-Type | application/json | Yes (for POST/PATCH) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| fields | string | \* | Comma-separated field names |
| filter | object | {} | Filter conditions |
| limit | number | 25 | Items per page |
| offset | number | 0 | Items to skip |

**Body (POST/PATCH):**

```json
{
  "field_name": "value"
}
```
````

### Response

**Success (200/201):**

```json
{
  "data": { ... }
}
```

**Error (4xx/5xx):**

```json
{
  "errors": [
    { "message": "Error description", "extensions": { "code": "ERROR_CODE" } }
  ]
}
```

### Examples

**cURL:**

```bash
curl -X GET "http://localhost:3001/api/items/[collection]" \
  -H "Authorization: Bearer $TOKEN"
```

**TypeScript:**

```typescript
const response = await fetch("/api/items/[collection]", {
  headers: { Authorization: `Bearer ${token}` },
});
const { data } = await response.json();
```

````

### When Creating Components

Update/Create these docs:

| Change | Documentation Required |
|--------|----------------------|
| New component | `docs/COMPONENTS.md` - Add to component catalog |
| | `docs/components/[name].md` - Full component documentation |
| Modified component | Update component docs with new props/behavior |
| Removed component | Remove from catalog, add deprecation notice |

**Component Documentation Template:**

```markdown
# [ComponentName]

[Brief description of the component]

## Import

```tsx
import { ComponentName } from '@/components/[path]';
````

## Props

| Prop  | Type    | Default | Required | Description |
| ----- | ------- | ------- | -------- | ----------- |
| prop1 | string  | -       | Yes      | Description |
| prop2 | boolean | false   | No       | Description |

## Usage

### Basic Usage

```tsx
<ComponentName prop1="value" />
```

### With All Options

```tsx
<ComponentName prop1="value" prop2={true} onEvent={(e) => handleEvent(e)} />
```

## Examples

### Example 1: [Use Case]

```tsx
// Full working example
```

## Related Components

- [RelatedComponent1](./related1.md)
- [RelatedComponent2](./related2.md)

## Changelog

| Version | Date       | Changes                |
| ------- | ---------- | ---------------------- |
| 1.0.0   | 2026-01-22 | Initial implementation |

````

### When Creating Collections/Data Models

Update/Create these docs:

| Change | Documentation Required |
|--------|----------------------|
| New collection | `docs/COLLECTIONS.md` - Add collection overview |
| | `docs/api/[collection].md` - API documentation |
| | `docs/schemas/[collection].schema.json` - JSON schema |
| | `docs/schemas/[collection].example.json` - Example data |
| Modified schema | Update schema files, add migration notes |

**Collection Documentation Template:**

```markdown
# [Collection Name]

[Brief description of the collection purpose]

## Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | Yes | Primary key |
| field1 | string | Yes | Description |
| created_at | timestamp | Yes | Auto-generated |

## Relationships

| Relation | Type | Target Collection | Description |
|----------|------|-------------------|-------------|
| author | M2O | users | Item author |
| tags | M2M | tags | Associated tags |

## Permissions

| Role | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| admin | ✅ | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ✅ | ❌ |
| viewer | ❌ | ✅ | ❌ | ❌ |

## API Endpoints

See [API Reference](../api/[collection].md) for detailed endpoint documentation.

## Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "field1": "value",
  "created_at": "2026-01-22T10:30:00Z"
}
````

````

### When Creating Features

Update/Create these docs:

| Change | Documentation Required |
|--------|----------------------|
| New feature | `docs/features/[feature].md` - Complete feature documentation |
| | Update `docs/README.md` - Add to feature list |
| | Update relevant guides if needed |
| Modified feature | Update feature docs, add to CHANGELOG |

**Feature Documentation Template:**

```markdown
# [Feature Name]

## Overview

[What this feature does and why it exists]

## User Stories

- As a [user], I want to [action] so that [benefit]
- ...

## Components

- [Component1](../components/component1.md) - Description
- [Component2](../components/component2.md) - Description

## API Endpoints

- `GET /api/[endpoint]` - Description
- `POST /api/[endpoint]` - Description

## User Flow

1. User navigates to [page]
2. User performs [action]
3. System responds with [result]

## Configuration

```typescript
// Configuration options
const config = {
  option1: 'value',
  option2: true
};
````

## Testing

Test files: `tests/[type]/[feature].spec.ts`

```bash
pnpm test tests/[type]/[feature].spec.ts
```

## Related

- [Related Feature 1](./related1.md)
- [Related Feature 2](./related2.md)

````

### When Creating Hooks

Update/Create these docs:

| Change | Documentation Required |
|--------|----------------------|
| New hook | `docs/HOOKS.md` - Add to hooks catalog |
| Modified hook | Update hook documentation |

**Hook Documentation Format (in HOOKS.md):**

```markdown
## useHookName

[Brief description]

### Import

```tsx
import { useHookName } from '@/lib/buildpad/hooks';
````

### Signature

```typescript
function useHookName(param1: Type1, param2?: Type2): ReturnType;
```

### Parameters

| Parameter | Type  | Required | Description |
| --------- | ----- | -------- | ----------- |
| param1    | Type1 | Yes      | Description |
| param2    | Type2 | No       | Description |

### Returns

| Property | Type     | Description      |
| -------- | -------- | ---------------- |
| data     | DataType | The fetched data |
| loading  | boolean  | Loading state    |
| error    | Error    | Error if any     |

### Example

```tsx
function MyComponent() {
  const { data, loading, error } = useHookName("param");

  if (loading) return <Loader />;
  if (error) return <Error />;

  return <div>{data}</div>;
}
```

````

## Documentation Maintenance Rules

### Mandatory Actions for Every Code Change

1. **Before Writing Code:**
   - Check existing documentation for the area being changed
   - Note what docs will need updating

2. **After Writing Code:**
   - Update/create all required documentation
   - Update `docs/CHANGELOG.md` with the change
   - Verify all cross-references are valid

3. **Completion Checklist:**
   - [ ] ✅ All new public APIs documented
   - [ ] ✅ All new components documented
   - [ ] ✅ All new hooks documented
   - [ ] ✅ Schema files updated if data model changed
   - [ ] ✅ CHANGELOG.md updated
   - [ ] ✅ Related docs cross-linked

### CHANGELOG.md Format

```markdown
# Changelog

## [Date] - [Version or Feature Name]

### Added
- New feature/component/API description
- Link to documentation: [docs/path/to/doc.md](docs/path/to/doc.md)

### Changed
- What was modified and why
- Migration notes if breaking change

### Fixed
- Bug fixes with issue references

### Deprecated
- Features scheduled for removal

### Removed
- Features that were removed
````

## Documentation Style Guide

### Writing Style

- Use clear, concise language
- Write in present tense ("Returns data" not "Will return data")
- Use active voice ("The function returns" not "Data is returned by")
- Include practical examples for every feature

### Code Examples

- All code examples must be complete and runnable
- Include imports in examples
- Use TypeScript for type safety
- Test examples before including them

### Cross-Referencing

- Link to related documentation
- Use relative paths for internal links
- Include "See also" sections where helpful

### Versioning

- Date all documentation changes
- Note breaking changes prominently
- Include migration guides for breaking changes

## Automated Documentation Checks

When implementing CI/CD, include these checks:

```yaml
# .github/workflows/docs-check.yml
name: Documentation Check

on: [pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for documentation updates
        run: |
          # Check if code was changed without docs
          CODE_CHANGED=$(git diff --name-only HEAD~1 | grep -E '\.(ts|tsx|js|jsx)$' | wc -l)
          DOCS_CHANGED=$(git diff --name-only HEAD~1 | grep -E '^docs/' | wc -l)

          if [ $CODE_CHANGED -gt 0 ] && [ $DOCS_CHANGED -eq 0 ]; then
            echo "⚠️ Warning: Code was changed but no documentation was updated"
            echo "Please ensure all changes are documented in /docs"
          fi

      - name: Check broken links
        run: |
          # Install and run markdown link checker
          npx markdown-link-check docs/**/*.md
```

## Integration with Agents

All agents must follow documentation requirements:

| Agent        | Documentation Responsibility                    |
| ------------ | ----------------------------------------------- |
| `@scaffold`  | Create doc stubs for new files                  |
| `@implement` | Complete documentation for implemented features |
| `@reviewer`  | Verify documentation completeness in reviews    |
| `@tester`    | Document test coverage                          |
| `@database`  | Document schema changes                         |

## Quick Reference: What to Document Where

```
┌─────────────────────────┬─────────────────────────────────────┐
│ What You Created        │ Documentation Location              │
├─────────────────────────┼─────────────────────────────────────┤
│ API endpoint            │ docs/API_REFERENCE.md              │
│                         │ docs/api/[collection].md           │
├─────────────────────────┼─────────────────────────────────────┤
│ React component         │ docs/COMPONENTS.md                 │
│                         │ docs/components/[name].md          │
├─────────────────────────┼─────────────────────────────────────┤
│ Custom hook             │ docs/HOOKS.md                       │
├─────────────────────────┼─────────────────────────────────────┤
│ Collection/schema       │ docs/COLLECTIONS.md                 │
│                         │ docs/schemas/[name].schema.json    │
├─────────────────────────┼─────────────────────────────────────┤
│ Feature                 │ docs/features/[name].md            │
├─────────────────────────┼─────────────────────────────────────┤
│ Workflow                │ docs/WORKFLOWS.md                   │
├─────────────────────────┼─────────────────────────────────────┤
│ Configuration change    │ docs/guides/getting-started.md     │
├─────────────────────────┼─────────────────────────────────────┤
│ Any change              │ docs/CHANGELOG.md (always!)        │
└─────────────────────────┴─────────────────────────────────────┘
```
