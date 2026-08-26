# Project Design Keeper

Project Design Keeper is a DeepSeek Harness plugin that distills repository evidence into validated design documentation and reusable project context. The plugin registers nine native harness tools and bundles the `distill-project-design` skill.

## Install from the DeepSeek Harness CLI

Install the release bundle into a profile, then restart the Harness host:

```powershell
dsh plugin --profile <name> add github:EverfIRE/ProjectDesignKeeper
```

The bundle contributes two composition rows: the keeper plugin (the nine tools) and a bundled `skill-filesystem` provider that exposes `distill-project-design` through the harness `skill` tool. After installation, mention the skill in the composer to run the knowledge-maintenance workflow, or call the tools directly (`scan_scope`, `preview_update`, `apply_update`, …).

To upgrade, re-add the bundle and restart the host. Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to this repository for discoverability.

## Repository layout

| Path | Purpose |
| --- | --- |
| `source/` | Complete TypeScript source, tests, build scripts, and package metadata |
| `source/cordis.patch.yml` | Bundle configuration layer (tools row + skill-filesystem row) |
| `plugins/project-design-keeper/` | Installable release bundle only |
| `test/distribution.test.mjs` | Repository-level release/source separation and bundle checks |

The release bundle intentionally contains only the compiled plugin, the patch layer, and the skill resources; development sources and tests remain under `source/`.

## Build and verify from source

Node.js 20 or newer is required. The development dependencies link the DeepSeek Harness checkout at `../../DSHarness/deepseek-harness` from `source/` (the same layout CI bootstraps).

```powershell
cd source
npm ci
npm run typecheck
npm run test:ci
npm run build
npm run smoke
npm run package:verify
```

Verify the repository distribution contract from the repository root:

```powershell
node --test test/distribution.test.mjs
```

## Apply approval

`apply_update` routes confirmation through the session approval seam and, by default, requires the human to type the final eight hexadecimal digest characters of the changeset diff (through the user-questions capability). A declined, cancelled, unavailable, or mismatched confirmation fails the apply closed. Digest confirmation can be disabled in the plugin configuration when a trusted approval provider is used.

## Links

- [Repository](https://github.com/EverfIRE/ProjectDesignKeeper)
- [Issues](https://github.com/EverfIRE/ProjectDesignKeeper/issues)
- [Publisher](https://github.com/EverfIRE)
