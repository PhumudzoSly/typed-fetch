# @phumu/typed-fetch

Privacy-first, status-aware typed fetch that learns response shapes and generates TypeScript types.

## Install

```bash
npm install @phumu/typed-fetch
```

## Runtime Usage

```ts
import { typedFetch } from "@phumu/typed-fetch";

const result = await typedFetch("https://api.example.com/users/123?include=posts", {
  method: "GET",
});

if (result.status === 200) {
  console.log(result.data);
}
```

`typedFetch`:
- auto-detects endpoint keys (`METHOD /path?queryKeys`)
- captures response shape by HTTP status
- stores only structural metadata (never payload values)
- returns `{ endpoint, status, ok, data, response }`

Observation runtime behavior:
- `observerMode: "auto"` (default): filesystem in Node, `localStorage` in browser if available
- `observerMode: "file"`: force filesystem registry writes
- `observerMode: "localStorage"`: force browser storage writes
- `observerMode: "none"`: disable observation
- `syncUrl`: optional listener endpoint to persist observations from both browser and server

## Generate Types

```bash
npm run build
npm run generate
```

This emits `generated/typed-fetch.d.ts` and augments:

```ts
declare module "@phumu/typed-fetch" {
  interface TypedFetchGeneratedResponses {
    "GET /users/:param?include": {
      200: { id: number; name: string };
      404: { message: string };
    };
  }
}
```

## CLI

```bash
typed-fetch generate
typed-fetch check
typed-fetch clean
typed-fetch listen
typed-fetch clean --generated
typed-fetch clean --registry
```

Sync listener endpoint:
- `POST /sync` with observation payloads (used by `syncUrl`)
- `GET /health` for health checks
- default safety: localhost-only clients and local origins only
- auto type generation on every sync event (debounced)

## Config

Use `typed-fetch.config.json` in your project root:

```json
{
  "registryPath": ".typed-fetch/registry.json",
  "generatedPath": "generated/typed-fetch.d.ts",
  "include": ["/api/**"],
  "exclude": ["/api/internal/**"],
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

Persistence workflow:
1. Run `typed-fetch listen` during development.
2. Use `typedFetch` in both server and client with `syncUrl` set.
3. Commit `.typed-fetch/registry.json` and generated type files to keep types persistent across pushes.
