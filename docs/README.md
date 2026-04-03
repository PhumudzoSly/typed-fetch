# typed-fetch Docs Site

This folder contains the documentation website for typed-fetch, built with Next.js and Fumadocs.

## Development

Run from this `docs` directory:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm test:typed-fetch
pnpm test:safe
pnpm types:check
pnpm lint
pnpm format
```

## Safe package verification

When you add or update `@phumudzo/typed-fetch`, use this before deploying docs:

```bash
pnpm test:safe
```

This runs a lightweight runtime package smoke test and then verifies docs still compile (`types:check` + `build`) without changing production docs behavior.

## Project Structure

- `content/docs`: MDX documentation pages
- `src/app/docs`: docs routing and page rendering
- `src/app/api/search/route.ts`: local search API endpoint
- `src/components/mdx.tsx`: MDX component mappings
- `source.config.ts`: Fumadocs content source configuration

## References

- Next.js docs: https://nextjs.org/docs
- Fumadocs docs: https://fumadocs.dev
