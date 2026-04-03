# typed-fetch Development Guide

This is a privacy-first, status-aware fetch wrapper that observes real response shapes during development and generates TypeScript types from them. The library is designed to work with third-party APIs where you don't control the server or have access to OpenAPI specs.

## Build, Test, and Lint

### Build
```bash
npm run build
```
Compiles TypeScript from `src/**/*.ts` to `dist/` with declarations, declaration maps, and source maps.

### Test
```bash
# Run all tests
npm test

# Run a single test file
node --test test/client.test.js
node --test test/registry.test.js
```
Tests use Node.js native test runner (`node:test`). All test files are in the `test/` directory with `.test.js` extension. Tests must be run after building (`npm test` does this automatically).

### CLI Commands
The package exposes a CLI (`dist/cli.js`). Test CLI commands directly after building:
```bash
node dist/cli.js generate
node dist/cli.js check
node dist/cli.js watch
```

## Architecture

### Core Observation Flow
1. **Request Phase**: `typedFetch()` wraps native `fetch()` with identical signature
2. **Response Observation**: Response shape is inferred via `inferShape()` in `src/core/shape.ts`
3. **Queueing**: Observations are queued in-memory via `queueRegistryObservation()` in `src/core/file-observer.ts`
4. **Batched Writing**: Observations flush to `.typed-fetch/registry.json` after 40ms delay OR after 20 observations (whichever comes first)
5. **Type Generation**: `generateTypes()` reads the registry and emits TypeScript declaration augmentation to `generated/typed-fetch.d.ts`

### Key Modules

**`src/tFetch.ts`** — Main entry point. Exports `typedFetch()` and `tFetch` (alias). Returns `TypedFetchResult<K>` which is a discriminated union based on status code. Network errors return `status: 0` with an `error` field (never throws).

**`src/client.ts`** — Optional client factory `createTypedFetchClient()` that binds a `baseUrl` so callers don't repeat it on every request.

**`src/core/shape.ts`** — Shape inference engine. `inferShape(value)` recursively walks JSON responses and produces a `ShapeNode` AST representing the TypeScript type. Handles unions, nullable fields, optional fields, and respects `maxDepth` and `maxArraySample` config limits.

**`src/core/registry.ts`** — Registry persistence. `observeManyToRegistryPath()` merges new observations into existing registry entries (performs shape union). `loadRegistry()` reads the JSON file. Registry format is `{ version: number, endpoints: { [endpointKey]: { responses: { [status]: ShapeNode }, meta: { ... } } } }`.

**`src/core/file-observer.ts`** — Queuing and batching layer. Observations are never written synchronously during request handling. The queue auto-flushes on `process.beforeExit`. Export `flushObservations()` (alias of `flushAllRegistryObservationQueues()`) forces immediate flush — use before `generateTypes()` in scripts.

**`src/generator.ts`** — Type generation. `generateTypes()` loads the registry, applies overrides from config, converts each `ShapeNode` to a TypeScript string via `shapeToTypeScript()`, and writes a declaration file that augments the `TypedFetchGeneratedResponses` interface.

**`src/core/config.ts`** — Config loading and merging. Supports JSON config file at project root. `loadConfig()` merges file config with runtime overrides.

**`src/cli.ts`** — Commander-based CLI with commands: `init`, `generate`, `check`, `clean`, `watch`, `export`, `import`.

### Status-Aware Type Narrowing
TypeScript narrows `result.data` based on `result.status` checks:
```ts
if (result.status === 200) {
  result.data; // typed as 200 response shape
}
if (result.status === 404) {
  result.data; // typed as 404 response shape
}
```
This is implemented via conditional types in `src/tFetch.ts` that map `status` to `TypedFetchGeneratedResponses[K][status]`.

## Key Conventions

### endpointKey Format
`endpointKey` must follow the format `"METHOD /path/:param"`:
- Use uppercase HTTP method
- Use `:param` for dynamic path segments (e.g. `"GET /users/:id"` not `"GET /users/123"`)
- Runtime validation warns if method or path structure doesn't match the actual request URL

Dynamic segments are auto-collapsed based on `dynamicSegmentPatterns` config (default: `["numeric", "uuid", "hash"]`). The normalization logic is in `src/core/normalize.ts`.

### Privacy-First Design
- **No values are ever stored** — only field names and types
- `strictPrivacyMode: true` (default) prevents raw request paths from being stored in the registry
- `ignoreFieldNames` config (default: `["password", "token", "secret", "authorization"]`) redacts sensitive field names to `unknown` before storage
- Shape inference in `src/core/shape.ts` respects these constraints

### Never-Throw Policy
`typedFetch()` never throws exceptions. Network errors (DNS, timeout, CORS, etc.) are returned as:
```ts
{ status: 0, ok: false, error: Error, data: undefined }
```
This ensures all failure paths can be handled without try/catch.

### Observer Mode
Configured via `observerMode` in config:
- `"auto"` (default): Only observe in Node.js environments (not browser)
- `"file"`: Always write observations
- `"none"`: Disable observation entirely (useful for tests)

Detection logic is in `src/tFetch.ts` and uses `typeof process !== "undefined"` check.

### Synchronous Flush
`flushObservations()` is **synchronous** and returns `void`. It immediately flushes all queued observations to disk. This is intentional — callers can invoke it and immediately call `generateTypes()` without awaiting.

### Test Patterns
- Tests use native Node.js test runner (`node:test` and `node:assert/strict`)
- Tests start ephemeral HTTP servers on random ports (`server.listen(0, "127.0.0.1")`)
- Tests typically set `config: { observerMode: "none" }` to avoid writing registry files during test runs
- Integration tests in `test/typed-fetch.integration.test.js` DO write to the registry and test the full observation flow

### Shape Merging (Union Logic)
When multiple observations occur for the same endpoint+status, shapes are merged via union in `src/core/shape.ts`. Example:
- First observation: `{ id: number }`
- Second observation: `{ id: number, name: string }`
- Merged shape: `{ id: number, name?: string }` (name becomes optional)

This is a "widening" merge — the registry accumulates all seen shapes over time.

## Generated Files
- `.typed-fetch/registry.json` — Observation data (add to `.gitignore`)
- `generated/typed-fetch.d.ts` — TypeScript declarations (commit this to repo)

Run `npm run init` to auto-configure `.gitignore`.

## VSCode Extension
There's a companion VSCode extension (`@phumudzo/typed-fetch-tools`) that adds CodeLens actions, hover menus, and watch mode integration. Extension source is in a separate repo but interacts with this CLI.
