# @phumudzo/typed-fetch

[![npm version](https://img.shields.io/npm/v/@phumudzo/typed-fetch.svg)](https://www.npmjs.com/package/@phumudzo/typed-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

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
