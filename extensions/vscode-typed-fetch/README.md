# Typed Fetch Tools (VS Code Extension)

This extension adds editor commands for `@phumudzo/typed-fetch`:

- Generate types (`npx typed-fetch generate`)
- Start listener (`npx typed-fetch listen`)
- Stop listener
- Run current JS/TS file and then generate (experimental)

## Commands

- `Typed Fetch: Generate Types`
- `Typed Fetch: Start Listener`
- `Typed Fetch: Stop Listener`
- `Typed Fetch: Run Current File + Generate`

## Inline actions

- CodeLens above `typedFetch(...)` / `tFetch(...)`
- Hover actions on `typedFetch` / `tFetch`

## Build

```bash
cd extensions/vscode-typed-fetch
npm install
npm run build
```

Then load this folder as an unpacked extension in VS Code.
