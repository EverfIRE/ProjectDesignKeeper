# Changelog

## 2.0.0

- Native DeepSeek Harness plugin conversion: the Project Design Keeper MCP server and Codex marketplace distribution are replaced by a first-party Cordis plugin that registers the same nine tools directly on `ctx.tools`.
- Apply approval now flows through the harness approval seam (`ctx.approval`) plus an optional human digest confirmation (`ctx.userQuestions`), preserving the original digest-match guarantee without MCP elicitation.
- The plugin ships as a DeepSeek Harness bundle (`dsh.bundle` + `cordis.patch.yml`): the compiled plugin entry, the configuration layer, and the `distill-project-design` skill tree; the skill is mounted through a bundled `skill-filesystem` provider.
- Installs with `dsh plugin --profile <name> add`; the Codex marketplace catalog, activation script, MCP stdio runtime, and `@modelcontextprotocol/sdk` dependency are removed.
- All keeper business logic (`scope`, `transactions`, `knowledge`, `security`, `changesets`, `types`) is unchanged and remains fully covered by the existing suite.

## 1.0.1

- Uses `ProjectDesignKeeper` as the plugin and marketplace display name so the installed plugin can be mentioned as `@ProjectDesignKeeper`.
- Keeps `project-design-keeper` as the stable plugin identifier and component namespace.

## 1.0.0

- Initial public Codex marketplace release.
- Includes the `$distill-project-design` skill and local Project Design Keeper MCP server.
- Separates the installable plugin package from the complete TypeScript source tree.
