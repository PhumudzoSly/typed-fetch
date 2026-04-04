# Changelog

All notable changes to `@phumudzo/typed-fetch` are documented here.

## [0.1.11] — 2026-04-04

### Added

- New server adapters:
  - `@phumudzo/typed-fetch/adapters/generic` (`observeResponse`)
  - `@phumudzo/typed-fetch/adapters/hono` (`typedFetchObserver`)
  - `@phumudzo/typed-fetch/adapters/next` (`withTypedFetchObserver`)
- Optional `hono` peer dependency metadata for framework integration.
- New docs section for framework adapters with setup and usage examples.

## [0.1.8] — 2026-04-03

### Fixed

- Added `error?: undefined` to known endpoint success result variants so `if (result.error)` and related discriminant checks type-check reliably after generated declaration merging.

## [0.1.6] — 2026-04-03

### Fixed

- Runtime endpoint key validation now runs before issuing the network request and rejects malformed keys (for JS users and dynamic endpoint keys).
- `typed-fetch import` now validates imported registry JSON without mutating or deleting the source import file when invalid.

### Added

- Direct test coverage for `matchesAnyGlob` in `core/glob.ts`.
- Validation parser tests for registry JSON parsing.

## [0.1.5] — 2024-04-03

### Added

- JSDoc comments on all public API exports: `typedFetch`, `tFetch`, `TypedFetchResult`, `TypedFetchNetworkError`, `flushObservations`, `generateTypes`, `checkTypes`, `cleanArtifacts`.

## [0.1.4] — 2024-03-28

### Added

- Source maps and declaration maps in the compiled output.
- `.npmignore` to exclude test files, examples, and development artifacts from the published package.

## [0.1.3] — 2024-03-21

### Added

- Full pipeline integration test covering: observe → flush → generate → check → stale check.

## [0.1.2] — 2024-03-14

### Added

- Type overrides — an escape hatch for when inference produces the wrong shape. Set `overrides` in config to pin specific endpoint+status types as raw TypeScript strings. Overrides take precedence over inferred shapes during generation.

## [0.1.1] — 2024-03-07

### Added

- Runtime warning when `endpointKey` method or path structure doesn't match the actual request. Emitted via `process.emitWarning` in Node.js and `console.warn` elsewhere.

## [0.1.0] — 2024-02-29

### Added

- `TypedFetchNetworkError` — a typed result for network-level failures (DNS, timeout, connection refused, CORS). Returned with `status: 0`, `ok: false`, and an `error` field. `typedFetch` never throws.

## [0.0.9] — 2024-02-22

### Added

- `watch` CLI command — watches the registry file for changes and automatically regenerates types. Polls until the registry exists, then debounces on writes.

## [0.0.8] — 2024-02-15

### Added

- `flushObservations()` exported from the public API for programmatic workflows. Flushes all pending registry observation queues to disk synchronously. Useful in test scripts and CI seeding scripts.

## [0.0.7] — 2024-02-08

### Changed

- Simplified corrupt registry handling: instead of creating a backup file, a warning is emitted and the corrupt file is deleted. The registry starts fresh.

## [0.0.6] — 2024-02-01

### Changed

- Replaced hand-rolled glob matching with [picomatch](https://github.com/micromatch/picomatch) for the `include`/`exclude` config filters. More reliable glob semantics.

## [0.0.5] — 2024-01-25

### Changed

- Simplified config loading — removed deep coercion of config values. Config is now validated and merged shallowly, reducing edge cases with unexpected type conversions.

## [0.0.4] — 2024-01-18

### Removed

- Browser observer path: `browser-registry`, sync server, listener, and the `listen` CLI command have all been removed.
- Config fields `browserStorageKey`, `syncUrl`, and `syncTimeoutMs` are no longer supported.
- The `listen` command has been removed from the CLI.

This simplifies the architecture significantly. All observation now happens in Node.js via the file observer.

## [0.0.3] — 2024-01-11

### Removed

- CLI cosmetics: removed `figlet` and `boxen` dependencies. The CLI output is now plain text with color from `picocolors`.

## [0.0.2] — 2024-01-04

### Fixed

- Updated `version` field in `package.json` to `0.0.2`.
