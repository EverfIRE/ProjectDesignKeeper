---
name: distill-project-design
description: Use when a project needs its product, gameplay, technical architecture, module contracts, design decisions, or engineering conventions initialized, refreshed, audited for drift, or distilled into reusable agent context.
---

# Distill Project Design

## Overview

Maintain an evidence-backed Project Design Keeper memory layer. Initialize, refresh, audit, or distill task context; never substitute stored knowledge for a user decision.

## Start the Run

State four choices before calling a tool:

- operation: `initialize`, `refresh`, `audit`, or `distill`;
- exactly one scope mode: `files`, `feature`, or `project`;
- document language, following the user's current language while preserving code identifiers, filenames, and domain terms;
- write intent: read-only or a proposed pack update.

Apply scope literally:

- `files`: for every explicit file, call `scan_scope { root, path: <each-explicit-file>, view: "files" }` separately, then page `view: "evidence"`; never scan their common parent;
- `feature`: if its path is known, scan that path; otherwise start with bounded `search_evidence { root, path?, query: <feature-name> }`, then follow only matched paths and their evidence-bearing references;
- `project`: call `scan_scope { root, view: "summary" }`, then page `view: "files"` for fingerprints and `view: "evidence"` only as needed.

Read [workflow.md](references/workflow.md) when choosing an operation/scope, refreshing, auditing, handling a failure, or deciding whether confirmation is required.

## Run the Evidence Workflow

1. Execute the exact scope mapping above. Search only for unanswered questions; keep repository-relative paths and line numbers.
2. Classify each statement from its actual source. Code, tests, and configuration remain `observed` and `informational` unless the user confirms them as normative. Record intent-versus-implementation disagreement as `conflicted` plus an open question.
3. If the evidence suggests a new normative rule, supersession, or chosen conflict resolution, ask for **semantic confirmation now**, before rendering a normative candidate.
4. After semantic confirmation, synthesize an atomic schema 3.0 record with `kind`, one `ownerDocument`, typed evidence, `assertedConfidence`, and lifecycle. Render confirmed rules as `required|preferred` with `approval: confirmed`; for supersession, include the new decision and reciprocal history. Use `assets/knowledge-pack/` for initialization.
5. Audit with `validate_pack`. For writes, call `preview_update` with the final `pack` and every change.
6. Show the validated diff, ownership/merge/validation conflicts, and 30-minute expiry. Obtain a separate explicit **write confirmation** for this exact preview.
7. Apply only that confirmed, unexpired changeset; then validate and query representative context.

If semantics change after preview, discard the changeset, rebuild the candidate, and preview again before asking for write confirmation.

End audit/read-only operations before `preview_update` or `apply_update` unless the user separately asks to refresh. If an existing output lacks Keeper ownership, stop at the conflict preview.

Read [knowledge-model.md](references/knowledge-model.md) before creating records, IDs, strengths, managed blocks, conflicts, or supersession links. Read [document-contract.md](references/document-contract.md) before generating or reorganizing the pack. Read [tool-contract.md](references/tool-contract.md) for tool boundaries and inputs/outputs.

## Preserve History and Human Work

Preserve human spans and stable IDs. Never overwrite a hash conflict, restate derived navigation as canonical knowledge, or silently delete history. Use `query_history` for non-current knowledge and `analyze_redundancy` for user-decided merge candidates. Archive only after two confirmed terminal refreshes; keep two full generations and permanent tombstones. Follow the knowledge-model and document-contract references for exact fields and ownership.

## Install and Activate in DeepSeek Harness

Project Design Keeper is a DeepSeek Harness bundle: one Cordis plugin row registers the nine native tools, and a bundled skill-filesystem provider exposes `$distill-project-design` through the harness `skill` tool. The installable runtime intentionally omits repository development scripts.

Install the release bundle into a profile with `dsh plugin add` (Git, npm, or a tarball), then start or restart the Harness host:

```text
dsh plugin --profile <name> add github:EverfIRE/ProjectDesignKeeper
```

Upgrade by re-adding the bundle and restarting the host. Changing plugin code never hot-swaps already-mounted tools: after an upgrade, start a new session or restart the host before relying on the new runtime.

Manual package verification is a developer-only operation run from the repository's `source/` checkout after reading the release verification section in [workflow.md](references/workflow.md): `npm run build && npm run package:verify`. The packaged bundle is a bounded, exact-topology copy of the compiled plugin, the patch layer, and the skills tree; verification re-captures the source before and after publication so a concurrent source change cannot produce a successful mixed-version package.

## Keeper Unavailable

For ordinary downstream task context, read `docs/project-design/index.md` and its mapped Markdown directly. For initialize, refresh, preview/apply, or any maintenance write, stop and explain that transaction protection is unavailable. Do not emulate Keeper writes with direct filesystem edits.

The generated project-local Skill template is `assets/project-design-context/SKILL.md`; install it only through the preview/apply transaction.
