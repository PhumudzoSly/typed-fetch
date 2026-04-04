# @phumudzo/typed-fetch

[![npm version](https://img.shields.io/npm/v/@phumudzo/typed-fetch.svg)](https://www.npmjs.com/package/@phumudzo/typed-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

A privacy-first, status-aware `fetch` wrapper that observes real response shapes during development and generates TypeScript types from them.

Use it when you do not control the API or do not have an OpenAPI spec.

## Why typed-fetch

- No schema authoring required
- Status-aware type narrowing (`result.status` narrows `result.data`)
- Never throws on network failures (`status: 0` with `error`)
- Privacy-first observation (shape only, no raw values)

## Quick Start

### 1. Install

```bash
pnpm add @phumudzo/typed-fetch
```

Node.js 18+ is required.

### 2. Make requests with `typedFetch`

```ts
import { typedFetch } from "@phumudzo/typed-fetch";

const result = await typedFetch(
  "https://api.example.com/users/123",
  { method: "GET" },
  { endpointKey: "GET /users/:id" },
);

if (result.status === 200) {
  console.log(result.data);
}
```

### 3. Generate types

```bash
npx typed-fetch generate
```

After you run your app or tests, generated declarations make `result.data` typed by status.

## Endpoint Keys

`endpointKey` is required and should use this format:

`METHOD /path/:param`

Examples:

- `GET /users/:id`
- `POST /orders/:orderId/items`

This key is used for both observation grouping and generated type lookup.

## Config Example

Create `typed-fetch.config.json` in your project root:

```json
{
  "registryPath": ".typed-fetch/registry.json",
  "generatedPath": "generated/typed-fetch.d.ts",
  "strictPrivacyMode": true,
  "observerMode": "auto"
}
```

## CLI Commands

- `npx typed-fetch init`
- `npx typed-fetch generate`
- `npx typed-fetch check`
- `npx typed-fetch clean`
- `npx typed-fetch watch`
- `npx typed-fetch export`
- `npx typed-fetch import <file>`

## Server Adapters

typed-fetch also ships server-side adapters for observing JSON responses from your route handlers:

- `@phumudzo/typed-fetch/adapters/hono`
- `@phumudzo/typed-fetch/adapters/next`
- `@phumudzo/typed-fetch/adapters/generic`

### Hono

```ts
import { Hono } from "hono";
import { typedFetchObserver } from "@phumudzo/typed-fetch/adapters/hono";

const app = new Hono();
app.use("*", typedFetchObserver());
```

### Next.js App Router

```ts
import { withTypedFetchObserver } from "@phumudzo/typed-fetch/adapters/next";

export const GET = withTypedFetchObserver(
  "GET /api/users/:id",
  async () => Response.json({ id: 1, name: "Alice" }),
);
```

### Generic Adapter

```ts
import { observeResponse } from "@phumudzo/typed-fetch/adapters/generic";

const response = Response.json({ ok: true }, { status: 200 });
await observeResponse("GET /health", response);
```

Adapters only observe in `NODE_ENV=development` and never block the response path.

## VS Code Extension

[Typed Fetch Tools](https://marketplace.visualstudio.com/items?itemName=phumudzo.typed-fetch-tools) adds CodeLens and quick actions for generation and listener workflows directly in VS Code.

## License

MIT © Phumudzo
