# @phumudzo/typed-fetch

Status-aware `fetch` wrapper that learns response shapes and generates TypeScript types from real traffic.

## Install

```bash
npm install @phumudzo/typed-fetch
```

Node.js `18+` is required.

## VS Code extension

Use **Typed Fetch Tools** in VS Code for in-editor workflows:

- Generate types manually from the Command Palette
- Start/stop listener without leaving your editor
- Run current JS/TS file and regenerate types in one step
- Use inline CodeLens and hover actions on `typedFetch`/`tFetch`

Marketplace: https://marketplace.visualstudio.com/items?itemName=phumudzo.typed-fetch-tools

## Real app workflow

1. Use `typedFetch` in your app code.
2. Pass a stable `endpointKey` per call.
3. Run your app/tests to collect response shapes.
4. Run `typed-fetch generate` to emit declaration types.
5. Commit generated types so your team gets the same inference.

## Example: API client in your app

```ts
import { typedFetch } from "@phumudzo/typed-fetch";

export async function getTodo(todoId: number) {
  const result = await typedFetch(
    `https://jsonplaceholder.typicode.com/todos/${todoId}`,
    { method: "GET" },
    { endpointKey: "GET /todos/:param" },
  );

  if (result.status === 200) {
    return result.data;
  }

  throw new Error(`Request failed with status ${result.status}`);
}
```

## Generated typing behavior

After `typed-fetch generate`, your generated file augments:

```ts
declare module "@phumudzo/typed-fetch" {
  interface TypedFetchGeneratedResponses {
    "GET /todos/:param": {
      200: { id: number; title: string; completed: boolean; userId: number };
    };
  }
}
```

Then `result.data` is typed when you narrow by `status`.

## Manual request body typing

Response types are generated from observed traffic, while request body types are defined manually by you.

Create a declaration file (for example `types/typed-fetch.requests.d.ts`):

```ts
declare module "@phumudzo/typed-fetch" {
  interface TypedFetchGeneratedRequests {
    "POST /todos": { title: string; completed?: boolean };
    "PATCH /todos/:param": { title?: string; completed?: boolean };
  }
}
```

Now `typedFetch` validates body shape from the `endpointKey`:

```ts
await typedFetch(
  "https://api.example.com/todos",
  {
    method: "POST",
    body: { title: "Ship typed requests", completed: false },
  },
  { endpointKey: "POST /todos" },
);

// TypeScript error (title must be string)
await typedFetch(
  "https://api.example.com/todos",
  {
    method: "POST",
    body: { title: 123 },
  },
  { endpointKey: "POST /todos" },
);
```

When `body` is a plain object/array/primitive, `typedFetch` will JSON-stringify it and set `content-type: application/json` if missing.

You can also build JSON body payloads explicitly:

```ts
import { typedFetch, typedJsonBody } from "@phumudzo/typed-fetch";

await typedFetch(
  "https://api.example.com/todos",
  {
    method: "POST",
    ...typedJsonBody({ title: "Use helper" }),
  },
  { endpointKey: "POST /todos" },
);
```

## Required contract

`endpointKey` is required.  
Without it, compile-time endpoint typing is not reliable.

## Files created in your project

- `.typed-fetch/registry.json`: captured shape metadata
- `generated/typed-fetch.d.ts`: generated declaration types

No raw response values are persisted, only structure.
When `strictPrivacyMode` is enabled (default), raw observed request paths are not stored.

## Use in browser + server apps

For mixed client/server traffic, run the listener in your dev environment:

```bash
typed-fetch listen
```

Then set in `typed-fetch.config.json`:

```json
{
  "syncUrl": "http://127.0.0.1:43111/sync"
}
```

This lets browser and server observations merge into one registry and auto-generate types while listening.

## Config (`typed-fetch.config.json`)

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
  "browserStorageKey": "__typed_fetch_registry__",
  "syncUrl": "http://127.0.0.1:43111/sync",
  "syncTimeoutMs": 1500
}
```

## CLI commands

```bash
typed-fetch init
typed-fetch generate
typed-fetch check
typed-fetch clean
typed-fetch listen
```

All commands accept `--config <path>` for monorepos or custom config locations.
