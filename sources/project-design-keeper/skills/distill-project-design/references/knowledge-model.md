# Knowledge Model

## Canonical pack

`docs/project-design/manifest.json` is Keeper-owned Schema `3.0`. It contains scope and source fingerprints, stable document mappings, canonical active records, `maintenanceRevision`, archive generation metadata, tombstone metadata, and content-bound dedupe exceptions. Runtime may read Schema 1.0/2.0, but initialization and refresh write only 3.0.

Each record is one trimmed atomic statement with exactly one compatible `ownerDocument`. IDs remain stable while meaning remains stable.

```ts
type EvidenceRef = {
  path: string; startLine: number; endLine?: number;
  role: "design" | "implementation" | "test" | "configuration" | "runtime";
  excerptHash: `sha256:${string}`;
};

type RecordLifecycle =
  | { state: "active" }
  | { state: "terminal"; reason: "superseded" | "resolved" | "replaced" | "merged";
      sinceRevision: number; confirmedRefreshes: number; successorIds: string[] };
```

Records retain `kind`, domain, scope, statement, impact, status, strength, approval and reciprocal supersession. Schema 3.0 replaces `confidence` with `assertedConfidence`; validation computes `effectiveConfidence` from fresh typed evidence.

## Accuracy ceilings

- Intent, principle, and decision reach high only with confirmation or normative design evidence.
- Architecture, module, and convention reach high with fresh normative design plus implementation evidence.
- Tuning reaches high with configuration plus test/runtime evidence.
- Verification reaches high only with a current result or runtime evidence; a test definition alone is at most medium.
- Unsupported knowledge is at most low. Stale, unverified, and terminal records are withheld from ordinary context.

An excerpt hash mismatch creates a relocation candidate only when the exact excerpt has one unique new location. Relocation remains a previewed write.

## Lifecycle and history

Non-terminal records remain active even when stale, but `query_context` returns only verified active records. `query_history` reads stale active, terminal, two complete JSONL archive generations, and opt-in tombstones.

A terminal record becomes archive-eligible after two successful refreshes confirm the same terminal state. Archive entries preserve the complete record, original owner, exact managed body, hashes, terminal reason, revision, and archive time. Keep two full generations; collapse older generations to permanent tombstones containing IDs, relations, hashes, reason, time, and successors.

## Redundancy

`analyze_redundancy` recalls candidates using NFKC character trigrams, evidence and impact overlap, kind, scope, and owner. The Agent proposes meaning-level action; the user confirms each `merge`, `keep-separate`, or `defer`. Merges never promote strength, approval, or confidence. A keep-separate exception is valid only while both stored content digests match.

## Ownership

Managed record blocks retain exact body hashes and preserve human text outside them. Schema 3.0 documents contain a derived document header; `index.md`, `evidence-map.md`, and `archive/index.md` contain only that derived navigation block, while owning documents may also contain managed records.

Keeper JSON requires `managedBy` and `schemaVersion`. Archive JSONL is allowed only under `docs/project-design/archive/` and must match the generation or tombstone schema. Every knowledge, archive, relocation, merge, and tombstone write uses the complete candidate pack, preview, separate confirmation, and apply transaction.
