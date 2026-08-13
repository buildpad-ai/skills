# Testing Patterns Reference

Quick reference for common testing patterns across the stack. Use alongside the `create-tests` skill.

## Test Structure (Arrange-Act-Assert)

```typescript
it("describes expected behavior", () => {
  // Arrange: Set up test data and preconditions
  const input = { title: "Test Task", priority: "high" };

  // Act: Perform the action being tested
  const result = createTask(input);

  // Assert: Verify the outcome
  expect(result.title).toBe("Test Task");
  expect(result.priority).toBe("high");
  expect(result.status).toBe("pending");
});
```

## Test Naming Conventions

```typescript
// Pattern: [unit] [expected behavior] [condition]
describe("TaskService.createTask", () => {
  it("creates a task with default pending status", () => {});
  it("throws ValidationError when title is empty", () => {});
  it("trims whitespace from title", () => {});
  it("generates a unique ID for each task", () => {});
});
```

## Common Assertions

```typescript
// Equality
expect(result).toBe(expected); // Strict equality (===)
expect(result).toEqual(expected); // Deep equality (objects/arrays)
expect(result).toStrictEqual(expected); // Deep equality + type matching

// Truthiness
expect(result).toBeTruthy();
expect(result).toBeFalsy();
expect(result).toBeNull();
expect(result).toBeDefined();

// Numbers
expect(result).toBeGreaterThan(5);
expect(result).toBeLessThanOrEqual(10);
expect(result).toBeCloseTo(0.3, 5); // Floating point

// Strings
expect(result).toMatch(/pattern/);
expect(result).toContain("substring");

// Arrays / Objects
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(object).toHaveProperty("key", "value");

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(ValidationError);

// Async
await expect(asyncFn()).resolves.toBe(value);
await expect(asyncFn()).rejects.toThrow(Error);
```

## Mocking Patterns

### Mock Functions

```typescript
const mockFn = jest.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: "test" });
mockFn.mockImplementation((x) => x * 2);

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(3);
```

### Mock at Boundaries Only

```
Mock these:                    Don't mock these:
├── Database calls             ├── Internal utility functions
├── HTTP requests              ├── Business logic
├── File system operations     ├── Data transformations
├── External API calls         ├── Validation functions
└── Time/Date (when needed)    └── Pure functions
```

## React/Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

describe("TaskForm", () => {
  it("submits the form with entered data", async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    // Find elements by accessible role/label (not test IDs)
    await screen.findByRole("textbox", { name: /title/i });
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
      target: { value: "New Task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: "New Task" });
    });
  });
});
```

## API / Integration Testing

```typescript
import { test, expect } from "@playwright/test";

test.describe("POST /api/tasks", () => {
  test("creates a task and returns 201", async ({ request }) => {
    const response = await request.post("/api/tasks", {
      data: { title: "Test Task" },
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      title: "Test Task",
      status: "pending",
    });
  });

  test("returns 422 for invalid input", async ({ request }) => {
    const response = await request.post("/api/tasks", {
      data: { title: "" },
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(response.status()).toBe(422);
  });

  test("returns 401 without authentication", async ({ request }) => {
    const response = await request.post("/api/tasks", {
      data: { title: "Test" },
    });
    expect(response.status()).toBe(401);
  });
});
```

## E2E Testing (Playwright)

```typescript
import { test, expect } from "@playwright/test";

test("user can create and complete a task", async ({ page }) => {
  await page.goto("/");
  await page.fill('[name="email"]', "test@example.com");
  await page.fill('[name="password"]', "testpass123");
  await page.click('button:has-text("Log in")');

  await page.click('button:has-text("New Task")');
  await page.fill('[name="title"]', "Buy groceries");
  await page.click('button:has-text("Create")');

  await expect(page.locator("text=Buy groceries")).toBeVisible();
});
```

## Test Anti-Patterns

| Anti-Pattern                   | Problem                        | Better Approach            |
| ------------------------------ | ------------------------------ | -------------------------- |
| Testing implementation details | Breaks on refactor             | Test inputs/outputs        |
| Snapshot everything            | No one reviews snapshot diffs  | Assert specific values     |
| Shared mutable state           | Tests pollute each other       | Setup/teardown per test    |
| Testing third-party code       | Wastes time, not your bug      | Mock the boundary          |
| Skipping tests to pass CI      | Hides real bugs                | Fix or delete the test     |
| Using `test.skip` permanently  | Dead code                      | Remove or fix it           |
| Overly broad assertions        | Doesn't catch regressions      | Be specific                |
| No async error handling        | Swallowed errors, false passes | Always `await` async tests |

## Coverage Scenarios

For every function or component:

| Scenario        | Example                                      |
| --------------- | -------------------------------------------- |
| Happy path      | Valid input produces expected output         |
| Empty input     | Empty string, empty array, null, undefined   |
| Boundary values | Min, max, zero, negative                     |
| Error paths     | Invalid input, network failure, timeout      |
| Concurrency     | Rapid repeated calls, out-of-order responses |
