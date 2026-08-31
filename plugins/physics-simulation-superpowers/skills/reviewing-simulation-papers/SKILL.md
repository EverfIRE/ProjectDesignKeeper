---
name: reviewing-simulation-papers
description: "Use when critically reviewing simulation, graphics, robotics, differentiable-physics, or real-time-physics papers and their equations, evaluations, artifacts, source versions, reproducibility, or game-transfer claims."
---

# Reviewing Simulation Papers

Build an evidence-bounded technical review, not an abstract paraphrase. Read both references before substantive review: [references/paper-review-contract.md](references/paper-review-contract.md) defines the output and epistemic contract; [references/source-audit.md](references/source-audit.md) supplies portable primary-source boundaries and the Vertex Block Descent example.

Treat the contract as a literal output template. Copy its 12 exact H1 headings verbatim, without numbering, suffixes, or translation; use its exact table columns and audit categories. A PDF `page` is the one-based PDF page index. End with the only fenced JSON object under the exact `# JSON adapter` heading.

Copy the contract's exact epistemic mapping, Review policy, and real-time tuple lines. Emit all five equation categories, the exact-field reproduction checklist, and exact-label-only Unknowns cells.

## Workflow

1. Inventory each manifestation separately: publisher paper, exact preprint version, author PDF/supplement, project page, video, repository snapshot, archive, and badge record. Title/abstract-only input permits only a provisional claim inventory. Retrieve full text or record the exact access boundary before a final verdict.
2. Assign stable source IDs and portable anchors. Pin repositories to full commit SHAs. Keep unknown revisions explicit; never substitute a branch name.
3. Normalize material claims, then audit equations, evaluated code paths, comparisons, negative results, artifacts, and real-time scope. A reported number is a fact about the authors' report, not independent validation.
4. Emit every applicable section in the reference's required order. Use stable epistemic IDs and make confidence no stronger than the weakest decisive claim.
5. Validate the final JSON adapter with `scripts/validate_research_artifact.py paper-record`; do not add fields outside `schemas/paper-record.schema.json`.

## Boundaries

- Qualitative media cannot establish numeric or universal claims. Stability is not convergence, accuracy, or production readiness.
- Public availability does not establish licensing, paper-version identity, execution, reproducibility, or an official badge.
- Never invent repetitions, duration, tolerances, hardware, gates, or runtime. Missing values remain blockers, proposals requiring user approval, or `[UNKNOWN]` records.
- Distinguish work performed now from author reports and static inspection. Compilation, smoke testing, result reproduction, and independent validation are separate states.

## Downstream routes

Route a claim-bound experiment to `designing-simulation-experiments`, authorized artifact execution to `reproducing-simulation-papers`, and bounded product adoption to `translating-research-to-game-physics`. Pass source IDs, anchors, unknowns, claim scope, artifact revision, and non-claims. If a route is unavailable or was not executed, emit `pending_route` and prerequisites rather than claiming completion.
