# Document Contract

## Required map

| Path | Purpose |
| --- | --- |
| `docs/project-design/index.md` | Scope, source revision, update time, loading routes, document map |
| `docs/project-design/intent.md` | Product/gameplay goals, audience, design thinking, non-goals, constraints |
| `docs/project-design/principles.md` | Confirmed and descriptive product, technical, and cross-domain principles/habits |
| `docs/project-design/architecture.md` | System boundaries, data/control flows, integration points, major dependencies |
| `docs/project-design/modules/<slug>.md` | One module's contract and extension surface |
| `docs/project-design/conventions.md` | Stable naming, layout, configuration, error-handling, and technical boundary rules |
| `docs/project-design/decisions.md` | Design/technical decisions, alternatives, rationale, approval, supersession history |
| `docs/project-design/tuning.md` | Mutable defaults, thresholds, and environment/platform variants |
| `docs/project-design/verification.md` | Verification methods, current results, and release checks |
| `docs/project-design/open-questions.md` | Conflicts, undecided items, risks, and missing evidence |
| `docs/project-design/evidence-map.md` | Human-readable record-to-source mapping |
| `docs/project-design/manifest.json` | Machine-readable schema, scope, revision, document map, and record index |
| `docs/project-design/archive/index.md` | Derived navigation for retained archive generations and tombstones |
| `docs/project-design/archive/generation-NNNNNN.records.jsonl` | Complete terminal records for one immutable archive generation |
| `docs/project-design/archive/tombstones.jsonl` | Permanent minimal identity and relationship history older than two generations |
| `.agents/skills/project-design-context/SKILL.md` | Minimal-context routing and task preflight for later agents |

Use one stable document ID per mapped file. Add one `modules/<slug>.md` per material module; derive a lowercase, filesystem-safe slug and preserve it across refreshes.

## Common Markdown shape

Render canonical sections inside stable managed record blocks. Every record declares one compatible `ownerDocument`. Schema 3.0 documents carry a derived header; index, evidence-map, and archive index contain derived navigation/provenance only. New files must be fully Keeper-owned. After initialization, preserve human spans outside managed blocks.

Every statement that can constrain later work carries or resolves to its record ID, status, strength, approval, asserted/effective confidence, typed evidence, lifecycle, and impact. Keep summaries short and route details rather than copying them into multiple documents.

## Module file

Each module file contains:

1. purpose and responsibilities;
2. public interfaces/events/data contracts;
3. dependencies and dependents;
4. invariants and lifecycle/control flow;
5. extension points and approved variation;
6. related tuning, verification, decisions, and open-question record links.

Put mutable parameters in `tuning.md`, test evidence in `verification.md`, and unresolved items in `open-questions.md`; module documents link to those records instead of copying them.

Distinguish a declared contract from an observed implementation in every section. Do not imply that a public symbol is a confirmed architectural rule.

## Index routing

The index is always the first read. Include:

- scope mode and bounded paths/feature;
- source revision kind and last update time;
- task routes such as product intent, gameplay behavior, technical architecture, module, conventions, decisions, and risks;
- links to every required document and module;
- a short instruction to use `query_context` for minimal task context.

All Markdown links remain repository-relative and resolve inside the repository.

## Language

Use the user's current language for prose. Preserve identifiers, filenames, API names, engine terms, and established domain vocabulary exactly. A later language change may translate prose but must not change IDs, hashes, paths, evidence, or decision meaning.

## Templates

`assets/knowledge-pack/` contains the canonical manifest example and twelve `.md.template` files. `{{...}}` tokens are render-time placeholders, not content to commit. `{{MANAGED_BLOCK:<id> BEGIN/END}}` denotes a canonical record block; `{{DERIVED_BLOCK:<document-id> BEGIN/END}}` denotes a derived header or navigation block whose exact rendered body must also be hashed.
