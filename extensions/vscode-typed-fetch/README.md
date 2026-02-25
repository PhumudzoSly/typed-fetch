# Typed Fetch Tools

Typed Fetch Tools adds production-ready VS Code commands for `@phumudzo/typed-fetch` so you can generate type artifacts without leaving the editor.

## What this extension does

- Manual type generation from Command Palette: runs `npx typed-fetch generate`
- Listener controls: start/stop `npx typed-fetch listen`
- One-shot workflow: run current JS/TS file and then regenerate types
- Inline shortcuts:
  - CodeLens above `typedFetch(...)` and `tFetch(...)`
  - Hover actions on `typedFetch` and `tFetch`

All command output is written to the `Typed Fetch Tools` output channel.

## Requirements

- VS Code `1.90+`
- Node.js and `npx`
- A workspace with `typed-fetch` available to `npx` (local dependency recommended)

## Extension Settings

- `typedFetchTools.listenPort`: listener port (default `43111`)
- `typedFetchTools.allowNetwork`: pass `--allow-network` when starting listener

## Manual Generate Flow

Use `Typed Fetch: Generate Types` any time you want to refresh generated types. This is useful when:

- You changed endpoint contracts or response schemas
- You do not want long-running listeners
- You want deterministic generation as a pre-commit step

The command runs in the active file's workspace (or the first workspace folder if no editor is active).

## Local Development

```bash
cd extensions/vscode-typed-fetch
pnpm install
pnpm run build
```

Launch an Extension Development Host:

```bash
code --extensionDevelopmentPath="c:\Users\Phumu\Work\CLIs\next-typed-fetch\extensions\vscode-typed-fetch"
```

## Package for Distribution

```bash
cd extensions/vscode-typed-fetch
pnpm run publish:precheck
```

This generates a `.vsix` you can install locally or publish to the VS Code Marketplace.

## Publish to Marketplace

### 1) One-time setup

- Create a publisher in Visual Studio Marketplace (must match `"publisher": "phumudzo"` in `package.json`)
- Create a Personal Access Token (PAT) with Marketplace publish permissions
- Set token for current shell:

```bash
$env:VSCE_PAT="your-token-here"
```

### 2) Publish command

```bash
cd extensions/vscode-typed-fetch
pnpm run publish:marketplace
```

### 3) CI release path

Tag format for automated packaging + release:

```bash
git tag vscode-typed-fetch-v0.2.0
git push origin vscode-typed-fetch-v0.2.0
```

The workflow:

- Builds and packages the VSIX
- Uploads the VSIX as a build artifact
- Creates a GitHub release with attached VSIX
- Publishes to Marketplace when `VSCE_PAT` repository secret is configured
