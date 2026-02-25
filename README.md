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
