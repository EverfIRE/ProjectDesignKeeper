---
name: surveying-real-time-physics-research
description: "Use when building, updating, auditing, or scoping a reproducible literature and artifact survey for real-time physics, simulation, game physics, interactive graphics, or transferable robotics methods."
---

# Surveying Real-Time Physics Research

Build an auditable evidence map, not a prestige list. Read [references/research-venues.md](references/research-venues.md) and its portable [source audit](references/source-audit.md) before searching or emitting a protocol.

## Workflow

1. Freeze the scope, cutoff date, eligible contribution classes, source tiers, exact queries, screening rules, and stop-rule categories. If the user did not supply a resource budget, person-hours, or work cap, record it as unknown and ask before adopting a resource-limited stop; never invent a number.
2. Search publisher and venue records, DOI/Crossref metadata, arXiv, and author-controlled sources. For robotics scope, search IEEE RAS/IEEE Xplore and RSS proceedings directly. Use discovery indexes only to find candidates and citations. Verify venue, track, review status, outlet, and year at a primary publication source.
3. Log every query run before screening. Preserve each raw candidate, including exclusions and duplicates. Record platform/API version, endpoint or query, filters, cursor, UTC retrieval time, totals, counts, limits, and a raw-response checksum.
4. Resolve identity without destructive normalization. Preserve the original DOI; parse recognized URI/URN wrappers, percent-decode exactly once as UTF-8, and fold only ASCII A-Z in a comparison key with no Unicode normalization. Preserve versioned arXiv IDs, every publication manifestation, and work-family lineage. Treat deposited relations as bounded evidence. Title similarity opens manual review; it never merges automatically.
5. Snowball backward and forward in recorded rounds. Keep citation direction, seed, index, retrieval date, screening decision, and exclusion reason. Retain superseded and duplicate records through append-only events.
6. Classify artifact provenance, pin revisions, and audit code, data, model, and asset licenses separately. Distinguish author report, full-text inspection, static artifact inspection, execution with logs, and independent validation. Anchor every claim to a source location.
7. Stop with an explicit label: saturation, resource cap, or API/access cap. Report unscreened candidates and unresolved conflicts. Update by rerunning saved searches, refreshing citations and artifacts, and publishing a delta change log.

## Output contract

Before custom detail, copy every applicable paragraph from the reference's Canonical survey seams block verbatim; do not paraphrase or split it. Keep each seam cohesive and place source-specific limitations beside the claim they limit.

Emit a protocol, query log, raw candidate ledger, normalized work/publication/artifact tables, screening and citation events, claim evidence, execution runs, stop report, immutable snapshot manifest, and change log. Survey rows do not validate directly against `paper-record.schema.json`: after full-text review, build and validate a complete adapter payload with the schema's required review fields. Never discard raw discovery evidence.

## Scope routes

- Structured reading and claims: `reviewing-simulation-papers`.
- Hypotheses, metrics, and acceptance gates: `designing-simulation-experiments`.
- Exact paper and artifact execution: `reproducing-simulation-papers`.
- Bounded transfer into gameplay: `translating-research-to-game-physics`.

Pass canonical identity, claim anchors, unknowns, target claim, artifact revision, and transfer assumptions to the selected downstream skill. If that skill is not installed, emit `pending_route` and missing prerequisites instead of claiming execution.
