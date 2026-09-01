# Research venues and evidence contracts

Read the portable [source audit](source-audit.md) for claim-scoped links and limitations. This reference separates discovery from publisher and venue records, bibliographic authority, artifact evidence, and downstream readiness.

## Source map

| Need | Preferred source | Boundary |
|---|---|---|
| DOI identity and comparison | DOI Handbook | Preserve the original string; parse recognized URI/URN wrappers; percent-decode exactly once as UTF-8; compare ASCII A-Z case-insensitively; do not Unicode-normalize. |
| Deposited publication metadata | Crossref REST and relations | Metadata and relations are depositor supplied. A missing relation is not proof of no relation. |
| Preprint revision | arXiv identifier and version help | Preserve `arXiv:idvN`; an unversioned ID resolves to the latest version. |
| ACM publication | ACM Digital Library and event page | Verify the exact year, track, outlet, and review status. |
| Eurographics publication | Eurographics Digital Library and event page | Verify the record and year-specific proceedings or journal arrangement. |
| Robotics publication | IEEE RAS/IEEE Xplore and RSS proceedings | Search eligible venue years directly; verify the exact item and retain official URLs for records without DOI. |
| Candidate and citation discovery | OpenAlex or another declared index | Discovery only; reconcile at publisher, DOI, arXiv, or author sources. |
| Search reporting | PRISMA-S and PRISMA flow records | Log databases, interfaces, dates, queries, limits, counts, and exclusions. |
| Snowballing | Wohlin procedure plus declared citation index | Record seed, direction, round, index, retrieval date, and decision. |
| Repository revision and license | GitHub permanent link and license APIs | Pin commit links. Public visibility grants no reuse permission; inspect dependencies, data, models, and assets separately. |
| Archived artifact version | Zenodo version DOI | Use the version DOI for an exact archived release. |
| Artifact badge or stamp | ACM badging or Graphics Replicability Stamp | Report the badge's actual scope; it is not proof of every claim or production readiness. |

Venue series change publication arrangements. SIGGRAPH can separate journal and conference-proceedings tracks; SCA has used different publication outlets across years; I3D and HPG can include archival and non-archival tracks. Never infer `TOG`, `CGF`, `PACM CGIT`, peer review, or archival status from the series name alone.

## Canonical survey seams

Copy each applicable paragraph verbatim before custom detail. Keep facts and their limitations together.

### Primary-source venue map

Use the DOI Handbook, Crossref, arXiv, ACM Digital Library, Eurographics Digital Library, IEEE RAS or IEEE Xplore, and RSS proceedings as primary identity or publication sources; use OpenAlex as a discovery index, not final authority. Venue, track, review status, and publication outlet are year-specific: verify them at the publisher rather than inferring them from a series name.

### Identifier, version, and lineage

Preserve the original DOI; parse recognized URI and URN presentation wrappers, percent-decode the representation exactly once as UTF-8, and compare only ASCII letters with ASCII-only case folding and no Unicode normalization. Keep a versioned arXiv ID such as v1, an unversioned family ID, a conceptual work, and each manifestation separate. Record preprint and version of record lineage. A Crossref relation is a depositor assertion and may be missing; title similarity only creates a manual review queue, never an automatic merge.

### Query, snowballing, and updates

For every search record the platform/API version, exact endpoint or query verbatim, UTC time, filters, cursor, reported total, retrieved count, and raw-response checksum. For backward and forward snowballing, record the seed, citation direction, index, retrieval date, and round. Rerun saved queries at a declared cutoff date; publish a delta change log covering additions, metadata changes, withdrawn records, and retracted records.

### Screening, deduplication, and source table

Preserve every discovery row with candidate_id, raw title, raw URL, discovery source, query, and retrieval time. The normalized source table carries work_id, identity, venue, year, contribution_classes, primary_url, artifacts, license, relevance, evidence dimensions, current_decision, and reason. Retain excluded, duplicate, and superseded candidates plus append-only screening_events.

### Artifacts, licenses, and claim depth

Distinguish author-controlled artifacts, forks, mirrors, and third-party implementations; pin commit, release, and checksum. Audit code, data, model, and assets licenses separately. A no license repository is not open source. Label evidence as author-reported, directly reported in full text, artifact static inspection, artifact executed with logs, or independent validation; every claim keeps a source locator such as page, section, table, repository path, and evidence anchor.

### Resources and stopping

Freeze scope, cutoff, sources, queries, and screening rules before collection. If resource budget, person-hours, or work cap is not provided, mark it unknown and a blocker, keep the decision open, and ask the user; do not invent a number. Distinguish saturation, resource cap or budget/time stop, and API/access cap. Saturation requires a complete round with zero new eligible works. Report unscreened candidates and unresolved conflicts for every stop reason.

### Schema handoff

A survey record does not validate directly against paper-record.schema.json. After full text review, adapt a qualified record with claims, methods, conditions, artifacts, limitations, applicability, verdict, and confidence, then validate that adapter payload. Route it to reviewing-simulation-papers, designing-simulation-experiments, reproducing-simulation-papers, or translating-research-to-game-physics; while a named skill is not installed, emit pending_route rather than claiming execution. The handoff includes canonical identity, claim anchors, unknowns, target claim, artifact revision, and transfer assumptions.

## Minimum ledgers

Keep raw and normalized layers separate:

- `query_log`: platform/interface/API version, verbatim query or endpoint, filters, UTC time, cursor/page, reported total, retrieved count, coverage limit, raw-response checksum, error.
- `candidates`: immutable candidate ID, raw title/authors/identifier/URL, discovery source and rank, query run, retrieval time, resolution status.
- `works` and `publications`: canonical work identity, every manifestation, DOI/arXiv identifiers, venue/year/track/review basis, preprint/version-of-record lineage, current decision.
- `artifacts`: provenance class, author relationship, URL, exact revision, archive checksum, separate license observations for code/data/models/assets, access result.
- `screening_events` and `citation_edges`: append-only reviewer decisions, controlled exclusion reasons, duplicates/supersession, seed, direction, index, round, retrieval time.
- `evidence_claims` and `execution_runs`: bounded claim, source locator, inspection depth, environment, command, logs, deviations, result, independence.

Never overwrite verbatim metadata or delete exclusions. Store ambiguity as `unknown` or an unresolved relation with evidence. A publisher record controls publication claims; an author source can establish artifact provenance; an index can establish only what that index returned at the logged time.

## Stop and update decision

`SATURATED` means every mandatory source/query block and declared citation round completed and the preregistered zero-new threshold was met. `RESOURCE_LIMITED` means a user-approved time/work cap ended collection. `ACCESS_LIMITED` means pagination, API, authentication, or unavailable full text bounded coverage. These labels are not interchangeable and none proves absolute completeness.

For updates, advance the cutoff, rerun preserved queries, refresh forward citations and artifact revisions, deduplicate against historical identities, append decisions, and publish additions, removals, corrections, withdrawals, retractions, changed gates, unscreened queues, and unresolved conflicts.

## Downstream readiness

Survey rows remain survey records. Paper review requires full text or a declared access limitation and claim anchors; only its complete adapter payload can validate against `paper-record.schema.json`. Experiment design requires a target claim, observable, baseline, workload, and acceptance gate. Reproduction requires the exact publication and artifact revision, licensing path, environment, and deviations. Game transfer requires a bounded mechanism, target subsystem, interactive budget, degradation policy, and remaining unknowns. If a downstream skill is unavailable, store `pending_route` plus missing prerequisites. A badge, repository, abstract, or venue name alone never satisfies all downstream gates.
