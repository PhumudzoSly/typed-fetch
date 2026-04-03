# @phumudzo/typed-fetch

A privacy-first, status-aware `fetch` wrapper that observes real response shapes during development and generates TypeScript types from them — no schemas to write, no server changes required.

## Why not OpenAPI / tRPC / zod-fetch?

Those tools are great when you control the server or when the API already ships a schema. `typed-fetch` is for when you don't:

| Scenario | typed-fetch fits? |
|---|---|
| Third-party REST API with no OpenAPI spec | Yes |
| Internal API owned by another team | Yes |
| Legacy service with no TypeScript | Yes |
| API schema that drifts from reality | Yes |
| You control both client and server (tRPC / OpenAPI) | Probably not — use those instead |

Zero server changes. Zero schemas to write. Completely transparent — it's just `fetch` with an observation layer on top.

## Install

```bash
npm install @phumudzo/typed-fetch
# or
pnpm add @phumudzo/typed-fetch
```

Node.js 18+ is required.

## Quick Start

### Step 1 — Use `typedFetch` in your code

```ts
import { typedFetch } from "@phumudzo/typed-fetch";

const result = await typedFetch(
  "https://api.example.com/users/123",
  { method: "GET" },
  { endpointKey: "GET /users/:id" },
);
```

### Step 2 — Observe real traffic

Run your app or tests. `typed-fetch` records response shapes to `.typed-fetch/registry.json` automatically.

### Step 3 — Generate types

```bash
npx typed-fetch generate
```

From this point on, `result.data` is fully typed based on what the API actually returns.

## Full Usage Example

```ts
import { typedFetch } from "@phumudzo/typed-fetch";

export async function getUser(id: string) {
  const result = await typedFetch(
    `https://api.example.com/users/${id}`,
    { method: "GET" },
    { endpointKey: "GET /users/:id" },
  );

  // Network failure (DNS, timeout, CORS, etc.) — result.error is an Error
  if (result.error) {
    console.error("Network failure:", result.error.message);
    return null;
  }

  // Status narrowing — TypeScript narrows result.data by status code
  if (result.status === 200) {
    return result.data; // typed as the 200 response shape after generation
  }

  if (result.status === 404) {
    return null;
  }

  throw new Error(`Unexpected status ${result.status}`);
}
```

`typedFetch` never throws. Network failures are returned as a `TypedFetchNetworkError` with `status: 0` and an `error` field, so every failure path is handled without try/catch at the call site.

## Generated Type Output

After running `typed-fetch generate`, your `generated/typed-fetch.d.ts` augments the package:

```ts
declare module "@phumudzo/typed-fetch" {
  interface TypedFetchGeneratedResponses {
    "GET /users/:id": {
      200: { id: number; name: string; email: string; createdAt: string };
      404: { message: string };
    };
  }
}
```

Once this file is in your project, `result.data` is typed when you narrow by `status`. Commit the generated file so your whole team gets the same inference.

## How `endpointKey` Works

`endpointKey` is required on every call. It has two jobs:

1. **Registry key** — all observations for `"GET /users/:id"` are merged together, regardless of which specific user ID was fetched.
2. **Type lookup key** — after generation, TypeScript uses it to look up the exact response shape.

Format: `"METHOD /path/:param"`. Use `:param` for dynamic path segments.

```ts
// Good — stable key, dynamic segments use :param
{ endpointKey: "GET /users/:id" }
{ endpointKey: "POST /orders/:orderId/items" }

// Bad — the key includes a real value, so each user gets a separate registry entry
{ endpointKey: "GET /users/123" }
```

A runtime warning is emitted if the `endpointKey` method or path structure doesn't match the actual request URL.

## Type Overrides

If the inferred shape is wrong (e.g. a field is sometimes null but the API always sends it), use the `overrides` config to pin the type manually:

```json
{
  "overrides": {
    "GET /users/:id": {
      "200": "{ id: number; name: string; email: string }"
    }
  }
}
```

Overrides take precedence over inferred shapes during `typed-fetch generate`. Use them as a precision escape hatch, not as a replacement for observation.

## CI/CD: Fail Builds on Stale Types

Add `typed-fetch check` to your CI pipeline. It exits with code 1 if the generated file is out of sync with the registry:

```yaml
# GitHub Actions example
- name: Check typed-fetch types are up to date
  run: npx typed-fetch check
```

Workflow: run your integration tests first (which populate the registry), then run `typed-fetch generate`, then commit the generated file. `typed-fetch check` in CI catches cases where a developer forgot to regenerate.

## Watch Mode

During local development, run `typed-fetch watch` to automatically regenerate types whenever the registry changes:

```bash
npx typed-fetch watch
```

The watcher polls until the registry exists, then uses `fs.watch` to debounce regeneration on every write. Ideal for keeping types fresh while running a dev server.

## Programmatic API

Use `flushObservations()` and `generateTypes()` in test scripts or seeding scripts to populate the registry without running a full server:

```ts
import { typedFetch, flushObservations, generateTypes } from "@phumudzo/typed-fetch";

// Make requests to seed the registry
await typedFetch("https://api.example.com/users/1", undefined, {
  endpointKey: "GET /users/:id",
});

await typedFetch("https://api.example.com/products", undefined, {
  endpointKey: "GET /products",
});

// Flush pending observations to disk
await flushObservations();

// Generate the types file
const result = generateTypes();
console.log("Types written to:", result.outputPath);
```

This is the recommended pattern for CI seeding: run a script before type-checking to ensure the registry is populated.

## Config Reference

Place a `typed-fetch.config.json` at your project root, or pass `--config <path>` to any CLI command.

```json
{
  "registryPath": ".typed-fetch/registry.json",
  "generatedPath": "generated/typed-fetch.d.ts",
  "include": [],
  "exclude": [],
  "dynamicSegmentPatterns": ["numeric", "uuid", "hash"],
  "maxDepth": 8,
  "maxArraySample": 32,
  "ignoreFieldNames": ["password", "token", "secret", "authorization"],
  "strictPrivacyMode": true,
  "observerMode": "auto",
  "overrides": {}
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `registryPath` | `string` | `.typed-fetch/registry.json` | Where observed shapes are stored |
| `generatedPath` | `string` | `generated/typed-fetch.d.ts` | Where generated types are written |
| `include` | `string[]` | `[]` | Glob patterns — only matching paths are observed (empty = all) |
| `exclude` | `string[]` | `[]` | Glob patterns — matching paths are never observed |
| `dynamicSegmentPatterns` | `string[]` | `["numeric","uuid","hash"]` | Path segment patterns collapsed to `:param` |
| `maxDepth` | `number` | `8` | Max nesting depth for shape inference |
| `maxArraySample` | `number` | `32` | Max array items sampled during shape inference |
| `ignoreFieldNames` | `string[]` | `["password","token","secret","authorization"]` | Field names redacted before storage |
| `strictPrivacyMode` | `boolean` | `true` | When true, raw request paths are not stored in the registry |
| `observerMode` | `"auto"\|"file"\|"none"` | `"auto"` | Controls when observations are written: `auto` = Node.js only, `file` = always, `none` = disabled |
| `overrides` | `Record<string, Record<string, string>>` | `{}` | Manual type strings per endpoint+status, overriding inference |

## CLI Reference

Initialize config and `.gitignore` entries:
```bash
npx typed-fetch init [--config <path>] [--force]
```

Generate TypeScript types from the registry:
```bash
npx typed-fetch generate [--config <path>]
```

Check if generated types are up to date (exits 1 if stale — use in CI):
```bash
npx typed-fetch check [--config <path>]
```

Remove generated files and/or the registry:
```bash
npx typed-fetch clean [--config <path>] [--generated] [--registry]
```

Watch the registry and regenerate on every change:
```bash
npx typed-fetch watch [--config <path>]
```

Export registry to stdout or a file (for team sharing):
```bash
npx typed-fetch export [--output <path>] [--config <path>]
```

Import a registry file and merge it into the local registry:
```bash
npx typed-fetch import <file> [--config <path>]
```

## VS Code Extension

**Typed Fetch Tools** adds in-editor workflows:

- CodeLens on every `typedFetch`/`tFetch` call to generate types or run the file
- Hover menu with quick actions
- Watch mode terminal launcher
- Command Palette entries for all operations

Marketplace: [Typed Fetch Tools](https://marketplace.visualstudio.com/items?itemName=phumudzo.typed-fetch-tools)

## Privacy

`typed-fetch` is designed to be safe in production-like environments:

**`strictPrivacyMode: true` (default)**
Raw request paths (which may contain user IDs or other identifiers) are not stored in the registry. Only the inferred shape structure is kept.

**`ignoreFieldNames`**
Field names in this list are replaced with `unknown` in the registry. By default this covers `password`, `token`, `secret`, and `authorization`. Add any domain-specific sensitive field names here.

**No values are ever stored.** The registry only records the TypeScript shape of a response — field names and types — never actual values.

## Files Created

- `.typed-fetch/registry.json` — observed shape metadata (add to `.gitignore`)
- `generated/typed-fetch.d.ts` — generated declaration types (commit this)

Run `typed-fetch init` to set up `.gitignore` entries automatically.
