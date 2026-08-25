# Project Design Keeper

Project Design Keeper is a Codex plugin that distills repository evidence into validated design documentation and reusable project context. The plugin bundles the `$distill-project-design` skill with a local MCP server.

## Install from the Codex plugin marketplace

Add this repository as a marketplace source:

```powershell
codex plugin marketplace add EverfIRE/ProjectDesignKeeper
```

For the immutable `1.0.1` release, pin the marketplace to the release tag:

```powershell
codex plugin marketplace add EverfIRE/ProjectDesignKeeper --ref v1.0.1
```

Restart the ChatGPT desktop app, open the Plugins Directory, select **ProjectDesignKeeper**, and install `project-design-keeper`. After installation, mention `@ProjectDesignKeeper` in the composer to use the plugin, or invoke `$distill-project-design` directly for its knowledge-maintenance workflow.

To inspect or update the marketplace later:

```powershell
codex plugin marketplace list
codex plugin marketplace upgrade project-design-keeper
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `.agents/plugins/marketplace.json` | Repository marketplace catalog read by Codex |
| `plugins/project-design-keeper/` | Installable release package only |
| `source/` | Complete TypeScript source, tests, build scripts, and package metadata |
| `test/distribution.test.mjs` | Repository-level release/source separation and metadata checks |

The release package intentionally contains compiled runtime files and plugin resources, while development sources and tests remain under `source/`.

## Build and verify from source

Node.js 20 or newer is required.

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

## Links

- [Repository](https://github.com/EverfIRE/ProjectDesignKeeper)
- [Issues](https://github.com/EverfIRE/ProjectDesignKeeper/issues)
- [Publisher](https://github.com/EverfIRE)
