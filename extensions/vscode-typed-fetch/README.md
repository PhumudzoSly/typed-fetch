# Typed Fetch Tools

Typed Fetch Tools adds production-ready VS Code commands for `@phumudzo/typed-fetch` so you can generate type artifacts without leaving the editor.

## What this extension does

- Manual type generation from Command Palette: runs `typed-fetch generate`
- Watch mode: start auto-regeneration via `typed-fetch watch`
- Initialization: run `typed-fetch init` (one-time project setup)
- Type validation: run `typed-fetch check` to verify artifacts
- Cleanup: remove generated artifacts with `typed-fetch clean`
- One-shot workflow: run current JS/TS file and then regenerate types
- Inline shortcuts:
  - CodeLens above `typedFetch(...)` and `tFetch(...)`
  - Hover actions on `typedFetch` and `tFetch`

All command output is written to the `Typed Fetch Tools` output channel.

## Requirements

- VS Code `1.90+`
- Node.js and `npx`
- A workspace with `typed-fetch` available to `npx` (local dependency recommended)

## Settings

- `typedFetchTools.configPath`: Path to typed-fetch config file (default `./typed-fetch.config.ts`). Passed as `--config` to all CLI commands.

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
code --extensionDevelopmentPath="./extensions/vscode-typed-fetch"
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
