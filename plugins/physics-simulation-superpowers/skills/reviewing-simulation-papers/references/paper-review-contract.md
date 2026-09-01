# Simulation paper review contract

## Evidence gate

A title, citation, abstract, project teaser, or video creates a provisional claim inventory only. A final evidence verdict requires the relevant full paper and every decisive referenced surface, or an explicit access limitation. Treat the publisher record, versioned preprint, author PDF, supplement, project page, video, repository, archive, and badge registry as different sources. Record role, URL, manifestation/revision, access date for mutable sources, rights/license observation, inspection depth, and limitations.

Legacy request vocabulary maps into stable IDs:

- `AUTHOR_CLAIM` maps to `FACT` and is emitted as a `[FACT:F###]` record about what named authors explicitly report, with an exact anchor. It is not an independent observation of the underlying phenomenon.
- `DIRECT_OBSERVATION` maps to `FACT` and is emitted as a `[FACT:F###]` record only for a source actually read, an artifact statically inspected at a pinned revision, or code independently executed with retained logs. State which occurred. It is not independent validation unless the review actually performed and documented that validation.
- `INFERENCE`, `UNKNOWN`, and `CONTRADICTION` map to the stable forms below.

## Portable anchors

Use this syntax everywhere:

```text
[S:<source-id>@<revision>#<key>=<value>(;<key>=<value>)*]
```

The revision is an immutable DOI/version/full commit SHA. For unversioned mutable HTML, use `accessed:YYYY-MM-DD` plus fragment and paragraph. A PDF `page` is the **one-based PDF page index**: `page=1` is the first PDF page, never `page=0`. If printed numbering differs, record `printed_page` separately. PDF anchors include page and the narrowest section/equation/figure/table/row/algorithm. Repository anchors require a full commit SHA, path, and inclusive one-based lines. Video anchors require a timestamp. Percent-encode whitespace and delimiters inside values. `main`, `master`, and other mutable branches are not revisions. When no immutable repository revision is established, record that as an unknown and make no line-level repository fact claim.

## Epistemic records

- `[FACT:F###]`: explicitly stated or shown by a named source; attach an exact anchor. An author-reported numeric result is a fact about that report.
- `[INFERENCE:I### from=F001,F002]`: a bounded reasoning bridge from **FACT IDs only**. Never put a `U###` or `C###` ID in `from=`.
- `[UNKNOWN:U###]`: sources checked, decision impact, and next resolving action.
- `[CONTRADICTION:C###]`: same-scope claims that cannot both hold. Cite both. Different configurations, dates, versions, or reviewer opinions are not automatically contradictions.

Every material statement in Verdict, claim rows, Artifact status, Limits, Minimal reproduction target, and Unknowns starts with one record. The verdict cannot be stronger than the weakest decisive claim.

Every bracketed epistemic-looking token must match one complete grammar above. Do not emit shorthand such as `[FACT]`, derive an inference from an unknown, or place an ID outside its record grammar. Every material FACT/CONTRADICTION has an exact anchor in the same paragraph, bullet, or table row.

## Literal output skeleton

The output has exactly these 12 H1 headings, in this order. Copy them verbatim with no numbering, prefix, suffix, translation, or additional H1:

```text
# Verdict
# Core idea
# Source manifest
# Claim–evidence matrix
# Equations and assumptions
# Evaluation audit
# Artifact status
# Limits and contradictions
# Confidence
# Minimal reproduction target
# Unknowns
# JSON adapter
```

# Verdict

State the scoped decision, confidence tier, and strongest limiting reason. Separate scientific support, artifact evidence, and product-transfer readiness.

Use `insufficient-evidence` when decisive evidence needed to support the scoped claim is missing. Use `unsupported` only when evidence refutes the scoped claim. A high-confidence no-go can coexist with `insufficient-evidence` for go: confidence describes the bounded decision, not proof that the scientific claim is false.

# Core idea

Explain the formulation in dependency order. Separate exact mathematics, numerical approximation, optional safeguards, heuristics, and the evaluated code path.

# Source manifest

Use this exact table shape, with one independently populated row per source:

| source ID | role | stable URL | revision / access | access date | inspection depth | license / rights | support boundary | locator |
|---|---|---|---|---|---|---|---|---|

Never merge sources merely because authors link them. Every row includes a stable URL; revision/access, inspection, rights, support boundary, and locator remain separate cells.

Immediately after the table, copy this sentence verbatim:

Epistemic mapping: AUTHOR_CLAIM maps to FACT about what authors report. DIRECT_OBSERVATION maps to FACT only for a source actually read, an artifact statically inspected, or code independently executed; it is not independent validation.

# Claim–evidence matrix

Required columns:

| normalized claim | source wording anchor | scope/qualifiers | evidence type | evidence anchors | relation | coverage | confidence | linked contradiction/unknown IDs |
|---|---|---|---|---|---|---|---|---|

Evidence types are theorem/proof, derivation, controlled quantitative experiment, qualitative figure/video, ablation, stress/failure case, artifact inspection, and independent reproduction. Relations are `supports`, `partially_supports`, `limits`, `refutes`, and `unverified`. Qualitative media cannot upgrade numeric or universal coverage.

An UNKNOWN claim row may instead use literal evidence type `UNKNOWN`, but only with an `[UNKNOWN:U###]` claim, relation `unverified`, and `UNKNOWN` source/evidence anchors. FACT and INFERENCE rows never use evidence type `UNKNOWN`. Spaces after commas in linked IDs are allowed.

Each row is one independent record: exactly one relation and evidence type, bounded coverage, `low | medium | high` confidence, and linked `C###`/`U###` IDs or `none`. A supported/limited/refuted row repeats the same exact locator in source wording and evidence cells. An unverified UNKNOWN row uses explicit `UNKNOWN` evidence and self-links its unknown ID. A glossary row, combined relation list, or relocated keywords is invalid.

# Equations and assumptions

For every decisive equation or dependency group record:

| purpose | symbols/dimensions/units/domains | dependencies | status | derivation check | implementation mapping | numerical hazards | claim impact |
|---|---|---|---|---|---|---|---|

Status is `verified`, `plausible`, `gap`, `mismatch`, or `not_checked`. Check signs, dimensions, domains, conditioning, definiteness, discontinuities, regularization, floating-point precision, stopping criteria, and whether a pinned implementation maps to the exact equation. A mathematical guarantee applies only when its preconditions and evaluated path match.

Use three or more complete rows. Prefix purpose cells with the literal applicable category names so the rows themselves, not prose outside the table, explicitly distinguish `exact mathematics`, `numerical approximation`, `optional safeguard`, `heuristic`, and `evaluated code path`. Put at least one complete epistemic record somewhere in every row; it need not precede the purpose category. Every row has local status, derivation check, implementation mapping (anchor or UNKNOWN), hazard, and claim impact.

All five literal categories must appear in table records. If no heuristic is applicable, still add a `heuristic` row as `[UNKNOWN:U###]` with status `not_checked`, sources checked, and its claim impact; do not silently omit the category.

# Evaluation audit

Copy these two sentences verbatim before filling the audit:

Review policy: required audit dimensions are target type, time step, substeps, iterations, collision cadence, line searches, work budget, pipeline inclusions, hardware/software/precision, baseline provenance, scene coverage, metrics, variability, ablations, and stress/failure cases.

The real-time tuple is scene complexity, target Hz, end-to-end frame time, hardware, precision, and pipeline inclusions.

Write every required dimension explicitly in this section, preferably as a local table or checklist. Do not rely on a nearby equation, source, or artifact section to imply that a dimension was audited.

When using a table, use exactly `audit dimension | evidence-bounded audit`, with one nonempty evidence row for each of the fifteen Review policy dimensions in their listed order. A keyword paragraph is not a populated audit.

Solver milliseconds are not an end-to-end frame when collision, transfers, synchronization, rendering, I/O, networking, or multiple substeps are excluded. Stability is not convergence, accuracy, or production readiness.

# Artifact status

Keep these independent:

```text
artifact_presence
author_authenticity
paper_revision_identified
immutable_archive
license_clarity
pinned_dependencies
build_instructions
smoke_test_status
complete_paper_inputs
complete_baselines
raw_outputs
figure/table_scripts
independent_reproduction
official_badges
```

Emit a three-column `field | status | evidence / next action` table with exactly one row for each field. A semicolon list or shared aggregate status is invalid.

A public repository is not automatically open source, complete, executable, tied to the publication, reproducible, independently validated, or officially badged. Compilation and smoke testing do not reproduce a paper result.

# Limits and contradictions

List author-disclosed limitations and negative/failure cases first, then reviewer inferences. Preserve scope, configuration, and version. Use contradiction IDs only for same-scope incompatibilities.

If no same-scope contradiction is established, write exactly `No same-scope contradiction established.` or the bilingual equivalent `本文没有同一 scope 的互斥来源主张，故无 CONTRADICTION 记录。`; do not fabricate a contradiction record.

# Confidence

Give a bounded value or tier and its evidence basis. Reduce confidence for missing decisive sources, mutable artifact provenance, incomplete comparison budgets, absent variability, or unresolved contradictions.

# Minimal reproduction target

Use a structured table or checklist with these literal field labels, then fill every field:

- `figure/table/scene/metric:`
- `publication revision:`
- `artifact revision:`
- `configuration:`
- `measurement:`
- `pass/fail criterion:`
- `expected resources/runtime:`
- `deviations/non-claims:`
- `logs and hashes:`

Bind one exact target to the publication and artifact revisions. Never invent numeric gates, repetitions, duration, hardware, or tolerances. Missing values are blockers or proposals requiring user approval. A minimal probe must say which broader claims it cannot validate.

# Unknowns

For each decision-relevant unknown, list sources checked, effect on the verdict, and the next concrete resolving action. Absence after a bounded search is not proof of nonexistence.

Use an `unknown record | sources checked | verdict effect | resolving action` closure table. Every UNKNOWN ID used anywhere in the review appears exactly once in this table, including artifact and evaluation unknowns.

Each `unknown record` cell contains only one exact `[UNKNOWN:U###]` token. Put the unknown statement in adjacent cells or immediately before the table; never append prose to the first cell.

# JSON adapter

Under the exact `# JSON adapter` heading, emit the **only fenced JSON object** in the response, using an opening ```json fence and a closing ``` fence. Do not emit the adapter as raw unfenced braces. The object contains exactly the current schema fields:

Earlier non-JSON code fences are allowed when needed; they do not count as JSON objects. The JSON adapter remains the final fenced block and the section has no trailing prose.

```text
schema_version, paper, contribution_type, claims, methods_assumptions,
experimental_conditions, artifacts, limitations, real_time_applicability,
verdict, confidence
```

Each claim has only `claim` and `evidence_anchors`. Use `supported`, `mixed`, `unsupported`, or `insufficient-evidence` for verdict. Do not add review-only fields to the adapter; keep richer evidence in the preceding review. Validate with:

```text
py -3 scripts/validate_research_artifact.py paper-record adapter.json
```

## Routing boundary

An unexecuted downstream action is `pending_route`. Pass the target claim, exact publication and artifact revisions, anchors, unknowns, assumptions, and non-claims to `designing-simulation-experiments`, `reproducing-simulation-papers`, or `translating-research-to-game-physics` without claiming those workflows ran.
