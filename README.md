# @phumudzo/typed-fetch

[![npm version](https://img.shields.io/npm/v/@phumudzo/typed-fetch.svg)](https://www.npmjs.com/package/@phumudzo/typed-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

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

**Status-aware `fetch` wrapper that automatically learns API response shapes and generates TypeScript types from real traffic—without storing raw data.**

## ✨ Key Features

- **🔒 Privacy-first**: Only structure is recorded, never raw values
- **⚡ Zero-config type generation**: Types emerge from real API calls
- **📊 Status-aware**: Discriminated unions for every HTTP status
- **🌐 Works everywhere**: Node.js, browsers, mixed architectures
- **🚀 Never throws**: All errors returned as result objects
- **📦 Zero-dependencies**: No external dependencies for the core library

## Quick Start

### 1. Install

```bash
npm install @phumudzo/typed-fetch
```

Requires Node.js 18+

### 2. Use typedFetch

```ts
import { typedFetch } from '@phumudzo/typed-fetch';

const result = await typedFetch(
  'https://api.example.com/user/123',
  { method: 'GET' },
  { endpointKey: 'GET /user/:id' }
);

if (result.status === 200) {
  console.log(result.data); // typed!
}
```

### 3. Generate types

```bash
npx typed-fetch generate
```

### 4. Types are now available

After running your app to collect observations, generated types make `result.data` fully typed by status.

## Why typed-fetch?

- **No manual type definitions** — types emerge from real data
- **Privacy by default** — only structure recorded, never values
- **Never throws** — network errors return result objects
- **TypeScript native** — discriminated unions for status codes
- **Privacy-conscious** — designed for regulated industries

## Documentation

📖 **[Full Documentation](https://typed-fetch.vercel.app/)** – Complete guides, API reference, and examples

- [Getting Started](https://typed-fetch.vercel.app/docs)
- [Basic Usage](https://typed-fetch.vercel.app/docs/basic-usage)
- [Configuration](https://typed-fetch.vercel.app/docs/configuration)
- [CLI Commands](https://typed-fetch.vercel.app/docs/cli-commands)
- [React Examples](https://typed-fetch.vercel.app/docs/examples-react)
- [Node.js Examples](https://typed-fetch.vercel.app/docs/examples-node)
- [Error Handling](https://typed-fetch.vercel.app/docs/examples-errors)
- [Privacy & Data](https://typed-fetch.vercel.app/docs/privacy)

## Example Workflow

```bash
# 1. Initialize your project
npx typed-fetch init

# 2. Start listening for observations (development)
npx typed-fetch listen &

# 3. Run your app/tests
npm run dev

# 4. Generate types from observations
npx typed-fetch generate
```

## VS Code Extension

Use **[Typed Fetch Tools](https://marketplace.visualstudio.com/items?itemName=phumudzo.typed-fetch-tools)** for:
- In-editor type generation
- Listener control
- CodeLens on `typedFetch` calls
- Quick actions and hover info

## Configuration

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
  "strictPrivacyMode": true,
  "observerMode": "auto"
}
```

See the [Configuration Guide](https://typed-fetch.vercel.app/docs/configuration) for all options.

## License

MIT © Phumudzo

---

**[📖 Read the full documentation](https://typed-fetch.vercel.app/)**
=======
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
