# Vite typed-fetch Test App

Strict React + TypeScript app for validating `@phumudzo/typed-fetch` type generation.

## Run

```bash
pnpm install
pnpm typegen
pnpm dev
```

## What this tests

- Runtime calls to real public endpoints (`jsonplaceholder.typicode.com`)
- Generated declaration merging into `@phumudzo/typed-fetch`
- Status-aware narrowing in `src/App.tsx`

## Type generation

- Config: `typed-fetch.config.json`
- Output declarations: `src/generated/typed-fetch.d.ts`
- Seed script: `scripts/seed-and-generate.ts`

Re-run `pnpm typegen` whenever endpoint observations change.
