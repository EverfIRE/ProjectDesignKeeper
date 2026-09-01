# Changelog

## Unreleased

- Migrated ProjectDesign to a two-plugin monorepo with hand-maintained trees under `sources/*` and deterministic installable releases under `plugins/*`.
- Added the `project-design` marketplace catalog, independent Keeper/physics CI gates, and a repository distribution gate shared by both plugins.

## physics-simulation-superpowers 0.1.0

- Adds 25 skills spanning real-time physics development, research, evidence analysis, experiment design, and paper reproduction.
- Prioritizes Unreal Engine / Chaos in physics tasks 17–23 while keeping other engines concise unless their physics systems are unusually strong.
- Publishes the deterministic installable tree at `plugins/physics-simulation-superpowers/`; the ZIP and `SHA256SUMS.txt` are generated only as GitHub Release assets.

## 1.0.1

- Uses `ProjectDesignKeeper` as the plugin and marketplace display name so the installed plugin can be mentioned as `@ProjectDesignKeeper`.
- Keeps `project-design-keeper` as the stable plugin identifier and component namespace.

## 1.0.0

- Initial public Codex marketplace release.
- Includes the `$distill-project-design` skill and local Project Design Keeper MCP server.
- Separates the installable plugin package from the complete TypeScript source tree.
