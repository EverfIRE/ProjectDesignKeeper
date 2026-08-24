# Project Design Keeper Four Safety Fixes Design

## Goal

Close four audited defects in Project Design Keeper and ensure the fixes reach the plugin that Codex actually runs:

1. Bind a previewed changeset to every exact source path declared by the candidate knowledge pack.
2. Keep every complete MCP response envelope within one MiB without duplicating large structured results.
3. Authenticate `query_history` cursors so callers cannot modify offsets or bindings and recompute a public digest.
4. Make immutable scope-index publication safe when independent Keeper processes build the same cold snapshot concurrently.

The delivery includes source tests, the compiled runtime, the allowlisted package, and replacement of the currently installed personal-plugin artifact after all verification gates pass.

## Current State

The latest source already implements and tests the first three protections:

- `src/transactions.ts` persists `sourcePaths` from `candidatePack.sourceRevision.files` and rechecks them with `exactSourceFingerprint` during apply.
- `src/mcp.ts` enforces a one-MiB envelope budget and suppresses duplicated text when the structured response is large.
- `src/knowledge/history.ts` signs cursors with a process-private HMAC key and compares signatures with `timingSafeEqual`.

The installed `1.0.0` cache still runs an older `dist/index.js`, so those protections are not active. `src/scope/store.ts` still uses a check-then-rename sequence that can fail when two builders publish the same target directory.

## Selected Approach

Use the source repository as the only authority. Preserve the three existing fixes, add behavioral coverage that reaches the built/package artifact where appropriate, implement an idempotent atomic publisher for the fourth issue, then build and verify a clean allowlisted package before updating the installed plugin.

Directly hot-patching the installed cache is excluded because it is not reviewable or reproducible and can be overwritten by the next plugin installation.

## Components and Data Flow

### Exact source binding

`previewUpdate` derives a sorted, canonical `sourcePaths` list from the candidate pack's `sourceRevision.files`. The authenticated changeset stores both that list and the declared fingerprints. `applyUpdate` fingerprints those exact paths immediately before and during atomic commit. A changed, removed, type-changed, escaped, or aliased path makes the changeset stale.

Legacy previews without a candidate source revision continue using the bounded `sourceScope` fingerprint for compatibility. No candidate-pack write may silently fall back when a non-empty source revision exists.

### MCP response budget

The MCP adapter measures serialized UTF-8 bytes for the complete response shape. Small results may include both text and structured content. Large valid results return structured content with a short text notice. A structured result that cannot fit beneath the one-MiB hard limit becomes a bounded MCP error instructing the caller to narrow or paginate the request.

The budget applies uniformly to success and error responses.

### History cursor authentication

The cursor body contains version, snapshot ID, filter digest, and offset. It is base64url encoded and signed with HMAC-SHA-256 using a process-private random key. Decoding rejects malformed envelopes, extra fields, incorrect signature lengths, signature mismatches, negative or non-integer offsets, and snapshot/filter mismatches.

Cursors intentionally expire when the local MCP process restarts. Cross-process cursor portability is not required for this local plugin.

### Concurrent scope-index publication

Each builder writes all three snapshot files into its own `.build-<uuid>` directory. Publication uses directory rename as the atomic arbiter:

1. If the immutable target already exists and is a complete matching snapshot, discard the temporary directory and reuse the target.
2. Otherwise attempt to rename the completed temporary directory to the target.
3. If rename loses a concurrent race, validate the winner at the target. Treat the operation as successful only when metadata and required shard files prove it is the same complete snapshot.
4. If no valid winner exists, rethrow the original publish error.
5. Always remove the losing temporary directory.

Validation checks ordinary files, metadata version, resolved project root, exact scope paths, snapshot ID, and declared file/evidence totals. It does not accept a symlink, junction, incomplete directory, or mismatched snapshot merely because the platform returned `EPERM`, `EEXIST`, or `ENOTEMPTY`.

## Error Handling and Safety

- No fix broadens the managed write roots or weakens changeset HMAC, expiry, ownership, atomic apply, manifest-last, or rollback behavior.
- Concurrent publication errors remain visible unless a complete matching winner is proven.
- Temporary build cleanup is best-effort only after the primary failure has been preserved; cleanup must not hide the root error.
- Installation occurs only from the verified `.package` allowlist output. Existing development artifacts are not copied into the active plugin directory.
- The active plugin is replaced only after source tests, build, smoke, and package verification succeed.

## Test Strategy

Use red-green-refactor for the remaining concurrency defect. The regression test creates two independent Keeper services with the same project and cache, synchronizes them so both build the same previously absent snapshot, and asserts:

- both scans succeed;
- both return the same snapshot ID and persisted cache root;
- the target contains complete metadata, files, and evidence shards;
- no `.build-*` directory remains;
- an invalid pre-existing target is rejected rather than adopted.

Existing behavioral tests for exact source invalidation, bounded MCP envelopes, and HMAC cursor tampering remain mandatory. Add packaged-runtime coverage if an existing source-only test cannot detect a stale `dist` artifact.

Final verification runs, in order:

```text
npm run typecheck
npm test -- --maxWorkers=1
npm run test:coverage
npm run build
npm run smoke
npm run package:verify
```

After installing the verified package, run a live MCP smoke check against the installed `dist/index.js` and confirm that the four behavioral signatures are present in the active runtime.

## Acceptance Criteria

- Candidate-pack changesets become stale when any exact declared source changes after preview, including explicit untracked files outside the preview path.
- Every MCP result envelope is at most 1 MiB, and large structured responses are not duplicated as full text.
- Recomputing a digest after modifying a history cursor is rejected.
- Concurrent cold builds of the same snapshot complete without transient publish failure or leftover build directories.
- The verified package contains only the release allowlist and the installed runtime matches that package byte-for-byte.
- The full verification suite passes with no new warnings or failures.
