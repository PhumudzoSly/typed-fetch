# Changelog

## 0.2.0

- Added command icons for light and dark themes.
- Added command menu placements in editor title and editor context for JS/TS files.
- Added release automation workflow to package VSIX, upload artifacts, create GitHub releases, and publish when `VSCE_PAT` is configured.
- Added marketplace publish script and README publish checklist.

## 0.1.0

- Added production package metadata for marketplace readiness:
  - repository, homepage, bugs, keywords, icon, gallery banner, packaged files
- Added packaging scripts for `pnpm` workflows.
- Improved command robustness:
  - Resolve workspace from active editor first
  - Show output channel automatically on command failures
  - Handle listener start errors explicitly
- Expanded README with manual type-generation workflow and distribution steps.
