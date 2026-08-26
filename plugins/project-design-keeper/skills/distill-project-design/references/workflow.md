# Workflow Contract

## Operation and scope choice

| Operation | Purpose | Normal end state |
| --- | --- | --- |
| `initialize` | Create the first Keeper-owned knowledge pack and project context Skill | Validated preview, then confirmed apply |
| `refresh` | Reconcile changed evidence with an existing manifest revision | Drift report, validated preview, then confirmed apply |
| `audit` | Identify drift, conflicts, missing evidence, and invalid records | Read-only report; no preview/apply |
| `distill` | Answer a design-context question or prepare a bounded proposed update | Minimal context; preview only if a write was requested |

Choose one scope:

- `files`: call `scan_scope { root, path: <each-explicit-file>, view: "files" }` once per explicit file, then page `scan_scope { root, path: <each-explicit-file>, view: "evidence" }`. Never substitute a common parent directory.
- `feature`: when a feature path is known, call `scan_scope { root, path: <feature-path> }`. When only its name is known, call bounded `search_evidence { root, path?, query: <feature-name> }`; scan only matches and follow only their evidence-bearing references. Report that discovered boundary.
- `project`: call `scan_scope { root, view: "summary" }` once, then page `view: "files"` for SHA-256 fingerprints and `view: "evidence"` only for evidence needed by records. Follow every returned cursor until `complete: true`.

## Evidence order

1. Read confirmed decisions and design documents as intended behavior.
2. Read tests, code, configuration, and assets as implemented behavior.
3. Search only for unresolved terms, interfaces, dependencies, and contradictions.
4. Preserve exact repository-relative path and one-based line evidence.
5. Stop searching when every statement is supported or explicitly marked low-confidence/pending.

This order does not make intent automatically correct. A mismatch between declared intent and implementation is a drift/conflict record.

## Initialize

1. State operation, scope, language, and intended write set.
2. Scan and search bounded evidence.
3. Obtain semantic confirmation for every new normative rule, supersession, or chosen conflict resolution.
4. Render every required document and the project context Skill from assets using those confirmed semantics.
5. Pass the final manifest object as `pack` with the whole write set to preview. Candidate overlay validation checks schema, links, records, evidence, source hashes, ownership, and manifest equality.
6. Show diff, conflicts, and expiry; obtain separate confirmation to write that exact preview; apply once.
7. Validate and query a small representative context after apply.

Initialization emits schema 3.0 only. A refresh of schema 1.0 or 2.0 first renders a complete 3.0 migration candidate. Copy every compatible field that already exists; infer only a Schema 3-required field that is absent from the legacy input, and only when unambiguous. Schema 1.0 may lack `kind`, `ownerDocument`, and `lifecycle`; Schema 2.0 already has `kind` and `ownerDocument` but may still lack `lifecycle`. Preserve IDs, approval, evidence meaning, managed bodies, history, and supersession; report ambiguity or an unrepresentable legacy value as a conflict before preview.

### Schema 1.0/2.0 to 3.0 lossless migration recipe

Treat the schema change as a mechanical, lossless migration before proposing any semantic refresh. Snapshot the legacy manifest and every mapped document first. For each legacy record, apply this mapping:

| Legacy value | Schema 3.0 candidate |
| --- | --- |
| `id`, `domain`, `scope`, `statement`, `impact`, `strength`, `approval`, `supersedes`, `supersededBy` | Copy exactly. Do not rewrite or normalize them during migration. |
| Existing `kind`, `ownerDocument`, `lifecycle`, `conflicts`, `openQuestions`, `module`, `modules`, `path`, `paths`, `summary` | Deep-copy exactly when present. Schema 2.0 already requires `kind` and `ownerDocument`; never re-infer them. Preserve an existing lifecycle only when it is Schema 3-compatible and satisfies the migration rule; otherwise report a conflict and stop. |
| Existing managed block | Copy the complete marker and body bytes unchanged, including whitespace and line endings. A navigation-only record may move to a compatible owning document, but its complete managed block remains byte-for-byte identical. Preserve every unmanaged human span too. |
| `confidence` | Remove this legacy field and set `assertedConfidence` to the exact same value. Do not lower it to an accuracy ceiling: validation may compute a lower `effectiveConfidence` without changing the preserved assertion. |
| `evidence` | Deep-copy the exact legacy array to `legacyEvidence`. Separately create typed `evidence` entries for the same provenance and meaning, with repository-relative path, one-based span, role, and excerpt hash. |
| `status` | Copy exactly to `legacyStatus`; keep `status` unchanged for a mechanical migration. A separately confirmed semantic change may update current status, but never its legacy snapshot. |
| A Schema 1.0 record missing `kind` or `ownerDocument` | Infer only when unambiguous; otherwise report a conflict and stop. |
| A Schema 1.0 or 2.0 record missing `lifecycle` | Use `{ "state": "active" }` when legacy status is not `superseded`. A legacy `status: "superseded"` becomes terminal with `reason: "superseded"`, `confirmedRefreshes: 1`, `0 <= sinceRevision <= maintenanceRevision`, and preserved successor IDs. Preserve reciprocal supersession fields. |
| Any other passthrough field or incompatible existing lifecycle | Do not omit, coerce, or silently rewrite it. Report the exact field/value as a migration conflict and stop before preview because the candidate cannot yet be lossless. |

Add exactly one separate derived header block to every Schema 3 mapped document; never nest a managed block inside it. Schema 3 navigation documents (`index.md`, `evidence-map.md`, and the archive index) contain zero managed blocks. Move a legacy navigation managed block unchanged to a semantically compatible owning document. If `kind`, owner, statement boundary, evidence role, lifecycle, or successor mapping is not uniquely supported, report that exact ambiguity as a conflict and stop before preview instead of choosing a convenient category.

The following is a minimal structurally valid migrated-record example. Its referenced predecessor and successor records must also exist with reciprocal relationships in the complete candidate pack.

<!-- schema-migration-example -->
```json
{
  "legacySchemaVersion": "2.0",
  "maintenanceRevision": 2,
  "legacyManagedBody": "# Cache policy\n\nKeep cache state repository-local.\n",
  "candidateManagedBody": "# Cache policy\n\nKeep cache state repository-local.\n",
  "legacy": {
    "id": "decision.cache-policy",
    "kind": "decision",
    "ownerDocument": "doc.decisions",
    "domain": "architecture",
    "scope": "cache",
    "statement": "Cache state is repository-local.",
    "evidence": ["Source/cache.ts:7"],
    "impact": ["Repositories do not share mutable cache state."],
    "status": "superseded",
    "strength": "informational",
    "approval": "not-required",
    "confidence": "high",
    "lifecycle": {
      "state": "terminal",
      "reason": "superseded",
      "sinceRevision": 1,
      "confirmedRefreshes": 1,
      "successorIds": ["decision.cache-policy-v2"]
    },
    "supersedes": "decision.earlier-policy",
    "supersededBy": "decision.cache-policy-v2",
    "conflicts": ["Legacy review note remains unresolved."],
    "openQuestions": ["Should the replacement share storage?"],
    "module": "cache",
    "modules": ["cache"],
    "path": "docs/project-design/decisions.md",
    "paths": ["Source/cache.ts"],
    "summary": "Repository-local cache policy."
  },
  "candidate": {
    "id": "decision.cache-policy",
    "kind": "decision",
    "ownerDocument": "doc.decisions",
    "domain": "architecture",
    "scope": "cache",
    "statement": "Cache state is repository-local.",
    "evidence": [{
      "path": "Source/cache.ts",
      "startLine": 7,
      "role": "implementation",
      "excerptHash": "sha256:dd8c50a1593e00455a958d40179a4ad4ee8960db57248fbecb14808e1e467054"
    }],
    "legacyEvidence": ["Source/cache.ts:7"],
    "impact": ["Repositories do not share mutable cache state."],
    "status": "superseded",
    "legacyStatus": "superseded",
    "strength": "informational",
    "approval": "not-required",
    "assertedConfidence": "high",
    "lifecycle": {
      "state": "terminal",
      "reason": "superseded",
      "sinceRevision": 1,
      "confirmedRefreshes": 1,
      "successorIds": ["decision.cache-policy-v2"]
    },
    "supersedes": "decision.earlier-policy",
    "supersededBy": "decision.cache-policy-v2",
    "conflicts": ["Legacy review note remains unresolved."],
    "openQuestions": ["Should the replacement share storage?"],
    "module": "cache",
    "modules": ["cache"],
    "path": "docs/project-design/decisions.md",
    "paths": ["Source/cache.ts"],
    "summary": "Repository-local cache policy."
  },
  "missingLifecycleRules": {
    "legacySchemaVersions": ["1.0", "2.0"],
    "nonterminalCandidateLifecycle": { "state": "active" },
    "superseded": {
      "legacyStatus": "superseded",
      "supersededBy": "decision.cache-policy-v2",
      "candidateLifecycle": {
        "state": "terminal",
        "reason": "superseded",
        "sinceRevision": 0,
        "confirmedRefreshes": 1,
        "successorIds": ["decision.cache-policy-v2"]
      }
    }
  },
  "unsupportedLegacyExtension": {
    "field": "compatibilityExtension",
    "action": "conflict-stop"
  },
  "incompatibleExistingLifecycle": {
    "example": "legacy superseded lifecycle with confirmedRefreshes other than 1",
    "action": "conflict-stop"
  },
  "documentRule": {
    "derivedBlocksPerMappedDocument": 1,
    "placement": "separate",
    "managedBlocksNestedInsideDerived": false,
    "navigationManagedBlocks": 0
  }
}
```

Before `preview_update`, self-check every legacy ID: it appears exactly once; all existing compatible fields and the managed body compare exactly; no unknown passthrough field disappeared; `assertedConfidence === confidence`; `legacyEvidence` deep-equals old `evidence`; `legacyStatus === old status`; typed evidence retains the same meaning; `sinceRevision <= maintenanceRevision`; and supersession/lifecycle links are reciprocal. Confirm every mapped document has exactly one separate derived block, navigation documents have no managed blocks, and the complete pack has Schema 3.0 `maintenanceRevision`, archive metadata, and `dedupeExceptions`. Run `validate_pack`; any `migration_*` diagnostic means the candidate is still incomplete and must not be presented or applied.

## Refresh

1. Run `detect_drift` from manifest source revision to current source. Start with the summary and request `view: "details"` pages only when exact paths or invalidated records are needed.
2. Re-read only added/modified evidence and records whose evidence was removed or invalidated.
3. Preserve stable IDs for unchanged meanings. Create a new record for changed meaning.
4. Reconcile managed blocks while preserving human spans.
5. Increment a terminal record's `confirmedRefreshes` only when this successful refresh confirms the same terminal state. At two confirmations it becomes archive-eligible.
6. Run `analyze_redundancy` when records overlap. Obtain a per-candidate `merge`, `keep-separate`, or `defer` decision; bind rejected-pair exceptions to both content digests.
7. Obtain semantic confirmation for normative changes, render the final confirmed candidate, preview with `pack`, obtain separate write confirmation, apply, and validate again.

If the manifest revision, source fingerprints, target hashes, or changeset expiry changes after preview, discard the changeset and create a fresh preview.

## Audit and task distillation

An audit reports new, modified, deleted, and invalid evidence; orphaned/duplicate records; rule conflicts; broken links; and open questions. It remains read-only.

Task distillation calls `query_context { root: <repo>, query: <task>, paths: [...], modules: [...] }`: ordinary context contains only active verified records. If relevant IDs are withheld as stale or terminal, call `query_history { root: <repo>, recordIds: [...] }` and label them historical risk. Return only context that changes planning: goals, applicable rules, contracts, open questions, and conflicts.

## Archive maintenance

Archive only terminal records with two confirmed refreshes. A single preview atomically removes their managed blocks and active records, writes `archive/generation-NNNNNN.records.jsonl`, updates the derived archive index and manifest, and rotates history. Retain two complete generations; when creating the third, delete the oldest complete JSONL and append permanent tombstones in the same changeset. Never archive, relocate evidence, merge, or tombstone without explicit preview/apply confirmation.

## Confirmation gates

First require semantic confirmation when a proposal:

- turns an observation/inference into `required` or `preferred`;
- creates a new normative rule;
- overrides/supersedes an existing decision;
- resolves an intent/implementation conflict by choosing one side.

Only after semantic confirmation may the candidate encode `required|preferred` with `approval: confirmed` and reciprocal supersession history. Then validate/preview that final candidate, show its exact diff, and require a separate write confirmation immediately before apply. If semantic confirmation changes after preview, discard that changeset and preview again. Ordinary read-only queries need no confirmation.

## Release install and verification

End users install the DeepSeek Harness bundle into a profile and restart the host:

```text
dsh plugin --profile <name> add github:EverfIRE/ProjectDesignKeeper
```

Upgrades re-add the bundle and restart the host; changing plugin code never hot-swaps already-mounted tools. The installable runtime does not ship repository development scripts. The manual flow below is for plugin developers working from this repository's `source/` checkout. Build and verify the exact package first:

```powershell
cd C:\absolute\ProjectDesignKeeper\source
npm run build
npm run package:verify
```

Packaging captures a bounded allowlisted topology (the compiled plugin, the patch layer, and the skills tree) with a per-file and aggregate byte budget. It binds reads to file identity plus high-resolution change timestamps, copies only the captured bytes, and re-captures the source before and after publication so a concurrent source change cannot produce a successful mixed-version package. Verification re-checks the packaged topology, manifest, and digests without following reparse points or hard links.

The packaged bundle is installed with the `dsh` CLI (npm, Git, or tarball); there is no separate activation script. After an upgrade, start a new session or restart the host before claiming the new runtime is active. `npm run smoke` runs an in-process harness smoke that mounts the plugin on a scratch Cordis context, confirms the nine tools register and the skill catalog is discoverable, scans a disposable fixture, and previews an owned temporary output. Normal writes still require the harness approval plus digest confirmation for the exact confirmed preview, and an expired changeset must be rebuilt and reconfirmed.

## Failure handling

- Ownership conflict: show target and reason; do not replace the file.
- Human edit inside a managed block: surface a merge conflict and request resolution.
- Validation error: keep the pack unapplied and list actionable diagnostics.
- Stale/expired changeset: rescan/revalidate and issue a new preview.
- Missing or invalid evidence: lower confidence or create an open question; never fabricate a source.
- Keeper tools unavailable: allow mapped Markdown fallback only for downstream read context; block all maintenance writes.
