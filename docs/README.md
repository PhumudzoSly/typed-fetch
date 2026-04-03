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
pnpm types:check
pnpm lint
pnpm format
```

## Project Structure

- `content/docs`: MDX documentation pages
- `src/app/docs`: docs routing and page rendering
- `src/app/api/search/route.ts`: local search API endpoint
- `src/components/mdx.tsx`: MDX component mappings
- `source.config.ts`: Fumadocs content source configuration

## References

- Next.js docs: https://nextjs.org/docs
- Fumadocs docs: https://fumadocs.dev
