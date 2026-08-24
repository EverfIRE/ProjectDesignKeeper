# Project Design Keeper Four Safety Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all four audited safeguards in source, compiled runtime, verified allowlist package, and the currently installed personal-plugin artifact.

**Architecture:** Keep the three existing trust-boundary fixes as behavioral baselines. Refactor only the scope-index publisher behind a narrow filesystem interface, validate immutable targets before adoption, and use atomic rename plus winner validation to make concurrent publication idempotent. Build the MCP runtime from the verified source and activate only the clean packaged tree through a recoverable staged swap.

**Tech Stack:** Node.js 20, TypeScript, Vitest, esbuild, MCP SDK, PowerShell for the local staged installation.

## Global Constraints

- Preserve the nine MCP tool names and Schema 3.0 contracts.
- Preserve changeset HMAC, 30-minute expiry, ownership boundaries, manifest-last ordering, atomic apply, and rollback behavior.
- Every complete MCP envelope must be at most 1 MiB.
- Do not introduce SQLite, native Node extensions, network services, or new runtime dependencies.
- Do not modify or stage existing `.plugin-eval/` artifacts.
- Use test-first red-green-refactor for every new production change.
- Install only the output of `npm run package:verify`; never copy the development repository as a plugin package.

---

### Task 1: Establish the Three Existing Safeguards as Baselines

**Files:**
- Verify: `src/transactions.ts`
- Verify: `src/mcp.ts`
- Verify: `src/knowledge/history.ts`
- Verify: `test/transactions.test.ts`
- Verify: `test/mcp.test.ts`
- Verify: `test/history.test.ts`

**Interfaces:**
- Consumes: existing `previewUpdate`, `applyUpdate`, MCP `toolResult`, and `queryHistory` behavior.
- Produces: fresh evidence that the authoritative source already rejects stale exact evidence, bounds MCP envelopes, and rejects forged history cursors.

- [ ] **Step 1: Run the exact-source regression**

Run:

```powershell
npx vitest run test/transactions.test.ts --maxWorkers=1 -t "rechecks every candidate-pack source even when preview path is narrower"
```

Expected: PASS. The test must change a candidate-pack source outside the preview path and observe `Selected source snapshot is stale` during apply.

- [ ] **Step 2: Run the complete-envelope regression**

Run:

```powershell
npx vitest run test/mcp.test.ts --maxWorkers=1 -t "keeps the complete MCP envelope within one MiB without duplicating large structured results"
```

Expected: PASS. Both the 700-KiB structured result and the bounded oversized error serialize below 1 MiB.

- [ ] **Step 3: Run the history-cursor forgery regression**

Run:

```powershell
npx vitest run test/history.test.ts --maxWorkers=1 -t "rejects a cursor whose offset was changed and publicly rehashed"
```

Expected: PASS with the forged offset rejected as malformed or tampered.

- [ ] **Step 4: Record the baseline without editing production code**

Run:

```powershell
git status --short
```

Expected: only the implementation-plan file and the pre-existing `.plugin-eval/` files are uncommitted. If any baseline test fails, stop and debug that protection before starting the scope-store change.

---

### Task 2: Reject Invalid Existing Immutable Snapshot Targets

**Files:**
- Create: `test/scope-store.test.ts`
- Modify: `src/scope/store.ts`

**Interfaces:**
- Consumes: `persistScopeIndex(input, io?)`, with production callers continuing to pass only `input`.
- Produces: `ScopeStoreIo`, `nodeScopeStoreIo`, and an internal target inspection result of `missing`, `matching`, or `invalid`.

- [ ] **Step 1: Write the failing invalid-target test**

Create `test/scope-store.test.ts` with a reusable real temporary cache fixture and this behavior:

```ts
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { persistScopeIndex, type ScopeStoreIo } from "../src/scope/store.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function key(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function scopeStoreFixture() {
  const root = await mkdtemp(join(tmpdir(), "keeper-scope-store-"));
  roots.push(root);
  const projectRoot = join(root, "project");
  const cacheDirectory = join(root, "cache");
  const snapshotId = `sha256:${"a".repeat(64)}`;
  const scopePaths = ["."];
  await mkdir(projectRoot, { recursive: true });
  const parent = join(cacheDirectory, "indexes", "v2", key(resolve(projectRoot)), key(JSON.stringify(scopePaths)));
  const target = join(parent, snapshotId.slice(7));
  const input = {
    options: { cacheDirectory }, projectRoot, scopePaths, snapshotId,
    files: [{ path: "Source/Test.cpp", fingerprint: `sha256:${"b".repeat(64)}`, size: 7, lineCount: 1 }],
    evidence: [{ path: "Source/Test.cpp", line: 1, text: "content" }]
  };
  return { input, parent, target };
}

test("rejects an incomplete pre-existing immutable snapshot instead of adopting it", async () => {
  const { input, target } = await scopeStoreFixture();
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "metadata.json"), "{}\n", "utf8");

  await expect(persistScopeIndex(input)).rejects.toThrow(/existing.*scope.*index|snapshot.*invalid/i);
});
```

This test catches the current bug: `lstat(target)` succeeds and the implementation silently adopts an incomplete directory.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
npx vitest run test/scope-store.test.ts --maxWorkers=1
```

Expected: FAIL because `persistScopeIndex` resolves instead of rejecting the invalid target.

- [ ] **Step 3: Introduce the narrow filesystem boundary and target inspection**

In `src/scope/store.ts`, define an internal default backed by real Node functions:

```ts
export interface ScopeStoreIo {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  rename: typeof rename;
  rm: typeof rm;
  writeFile: typeof writeFile;
}

const nodeScopeStoreIo: ScopeStoreIo = { lstat, mkdir, readFile, rename, rm, writeFile };
type ExistingSnapshot = "missing" | "matching" | "invalid";
```

Extract the existing anonymous input type verbatim into `PersistScopeIndexInput`, build the expected metadata once, then implement `inspectExistingSnapshot(target, expectedMetadata, io)` so it:

```ts
const targetStat = await io.lstat(target);
if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) return "invalid";
const [metadataStat, metadata, filesStat, evidenceStat] = await Promise.all([
  io.lstat(join(target, "metadata.json")),
  io.readFile(join(target, "metadata.json"), "utf8"),
  io.lstat(join(target, "files.jsonl")),
  io.lstat(join(target, "evidence.jsonl"))
]);
if (!metadataStat.isFile() || metadataStat.isSymbolicLink() ||
    !filesStat.isFile() || filesStat.isSymbolicLink() ||
    !evidenceStat.isFile() || evidenceStat.isSymbolicLink()) return "invalid";
return metadata === expectedMetadata ? "matching" : "invalid";
```

Return `missing` only for `ENOENT`; treat malformed metadata, missing shards, reparse entries, and other mismatches as invalid. Change the function signature to:

```ts
export async function persistScopeIndex(input: PersistScopeIndexInput, io: ScopeStoreIo = nodeScopeStoreIo): Promise<PersistedScopeIndex>
```

Before building a temporary directory, return the target only for `matching` and throw `Existing scope index snapshot is invalid` for `invalid`. For a missing target, build the temporary directory and call `io.rename(temporary, target)` directly. Do not yet recover from a losing rename race; that is Task 3's RED case.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npx vitest run test/scope-store.test.ts --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 5: Run scope-engine regressions**

Run:

```powershell
npx vitest run test/scope-v2.test.ts test/scope-store.test.ts --maxWorkers=1
```

Expected: PASS with no warnings.

- [ ] **Step 6: Commit the independently reviewable target-validation change**

```powershell
git add -- src/scope/store.ts test/scope-store.test.ts
git diff --cached --check
git commit -m "fix: validate immutable scope index targets"
```

---

### Task 3: Adopt a Valid Winner After a Concurrent Rename Race

**Files:**
- Modify: `test/scope-store.test.ts`
- Modify: `src/scope/store.ts`

**Interfaces:**
- Consumes: `ScopeStoreIo`, `inspectExistingSnapshot`, and fully written `.build-<uuid>` directories from Task 2.
- Produces: idempotent publication when a competing process atomically publishes the same snapshot first.

- [ ] **Step 1: Write the deterministic losing-race test**

Add a test that supplies real filesystem operations except for synchronized `lstat` and `rename` boundaries. Both initial target probes must observe `ENOENT`; the first rename publishes normally and the second simulates Windows `EPERM` after the winner is present:

```ts
test("adopts a complete concurrent winner and removes the losing build directory", async () => {
  const { input, parent, target } = await scopeStoreFixture();
  const initialChecks = deferred<void>();
  const firstPublished = deferred<void>();
  let targetChecks = 0;
  let renameCalls = 0;
  const io: ScopeStoreIo = {
    lstat: async (path) => {
      if (String(path) === target && targetChecks < 2) {
        targetChecks += 1;
        if (targetChecks === 2) initialChecks.resolve();
        await initialChecks.promise;
        throw Object.assign(new Error("missing before publication"), { code: "ENOENT" });
      }
      return lstat(path);
    },
    mkdir, readFile, rm, writeFile,
    rename: async (from, to) => {
      renameCalls += 1;
      if (renameCalls === 1) {
        await rename(from, to);
        firstPublished.resolve();
        return;
      }
      await firstPublished.promise;
      throw Object.assign(new Error("simulated concurrent publish"), { code: "EPERM" });
    }
  };

  const [first, second] = await Promise.all([
    persistScopeIndex(input, io),
    persistScopeIndex(input, io)
  ]);
  expect(first).toEqual(second);
  expect(await readdir(target)).toEqual(expect.arrayContaining(["evidence.jsonl", "files.jsonl", "metadata.json"]));
  expect((await readdir(parent)).filter((name) => name.startsWith(".build-"))).toEqual([]);
});
```

Import the real `lstat`, `readFile`, `readdir`, `rename`, and `ScopeStoreIo`. Use the same literal `input` for both calls so the two builders represent the same immutable snapshot.

Define the test-local deferred helper without relying on Node versions newer than 20:

```ts
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}
```

- [ ] **Step 2: Run the race test and verify RED**

Run:

```powershell
npx vitest run test/scope-store.test.ts --maxWorkers=1 -t "adopts a complete concurrent winner"
```

Expected: FAIL with `simulated concurrent publish`, proving the completed winner is not yet adopted.

- [ ] **Step 3: Implement winner validation without masking errors**

Wrap only the atomic rename:

```ts
try {
  await io.rename(temporary, target);
} catch (publishError) {
  const winner = await inspectExistingSnapshot(target, expectedMetadata, io);
  if (winner !== "matching") throw publishError;
}
```

In the outer `finally`, remove the temporary directory with `force: true`. If cleanup itself fails while another error is active, preserve and rethrow the original publish/build error. Do not special-case error codes: success depends on proving the winner, not on trusting `EPERM`, `EEXIST`, or `ENOTEMPTY`.

- [ ] **Step 4: Run the race test and verify GREEN**

Run:

```powershell
npx vitest run test/scope-store.test.ts --maxWorkers=1
```

Expected: both tests PASS, the three winner files exist, and no `.build-*` directory remains.

- [ ] **Step 5: Run the affected subsystem**

Run:

```powershell
npx vitest run test/scope-store.test.ts test/scope-v2.test.ts test/contracts.test.ts --maxWorkers=1
npm run typecheck
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the race-safe publisher**

```powershell
git add -- src/scope/store.ts test/scope-store.test.ts
git diff --cached --check
git commit -m "fix: make scope index publication race-safe"
```

---

### Task 4: Build and Verify the Authoritative Release Artifact

**Files:**
- Regenerate: `dist/index.js`
- Regenerate: `.package/project-design-keeper/**` (ignored release staging output)
- Create: `scripts/smoke-installed-plugin.mjs`
- Verify: `scripts/package-plugin.mjs`
- Verify: `scripts/verify-package.mjs`

**Interfaces:**
- Consumes: the fully tested TypeScript source.
- Produces: one clean package whose `dist/index.js` contains all four fixes and whose tree contains no development content.

- [ ] **Step 1: Run the complete unit and integration suite**

```powershell
npm run typecheck
npm test -- --maxWorkers=1
```

Expected: exit 0 with zero failed tests.

- [ ] **Step 2: Run coverage and inspect thresholds**

```powershell
npm run test:coverage
```

Expected: exit 0; total lines/statements at least 85%, branches at least 80%, and the new scope-store paths covered by both invalid-target and race tests.

- [ ] **Step 3: Build and smoke-test the compiled MCP runtime**

```powershell
npm run build
npm run smoke
```

Expected: both commands exit 0. `smoke` launches the tracked `dist/index.js` from a relocated path and lists exactly nine tools.

- [ ] **Step 4: Build and verify the allowlisted package**

```powershell
npm run package:verify
```

Expected: output `Verified 25 allowlisted package files`; the package contains `.codex-plugin`, `.mcp.json`, `dist`, `skills`, and required metadata, but not `src`, `test`, `.plugin-eval`, `.superpowers`, `coverage`, `node_modules`, or lockfiles.

- [ ] **Step 5: Add an installed-root MCP smoke runner**

Create `scripts/smoke-installed-plugin.mjs`:

```js
import assert from "node:assert/strict";
import { stat, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const installedRoot = process.env.KEEPER_INSTALLED_ROOT;
const projectRoot = process.env.KEEPER_SMOKE_PROJECT;
assert.ok(installedRoot && isAbsolute(installedRoot), "KEEPER_INSTALLED_ROOT must be absolute");
assert.ok(projectRoot && isAbsolute(projectRoot), "KEEPER_SMOKE_PROJECT must be absolute");
assert.ok((await stat(installedRoot)).isDirectory(), "installed root must be a directory");
assert.ok((await stat(projectRoot)).isDirectory(), "smoke project must be a directory");

const configuration = JSON.parse(await readFile(resolve(installedRoot, ".mcp.json"), "utf8"));
const parameters = configuration.mcpServers?.["project-design-keeper"];
assert.equal(typeof parameters?.command, "string");
assert.ok(Array.isArray(parameters?.args));
assert.equal(parameters.cwd, ".");

const transport = new StdioClientTransport({
  command: parameters.command,
  args: parameters.args,
  cwd: installedRoot,
  stderr: "pipe"
});
const client = new Client({ name: "keeper-installed-smoke", version: "1.0.0" });
let stderr = "";
transport.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "analyze_redundancy", "apply_update", "detect_drift", "preview_update",
    "query_context", "query_history", "scan_scope", "search_evidence", "validate_pack"
  ]);
  const scan = await client.callTool({ name: "scan_scope", arguments: { root: projectRoot } });
  assert.equal(scan.isError, undefined, stderr);
  assert.ok(scan.structuredContent);
} finally {
  await client.close();
}
```

Run it first against `.package/project-design-keeper` with a temporary project:

```powershell
$packageSmokeProject = Join-Path ([IO.Path]::GetTempPath()) ("keeper-package-smoke-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $packageSmokeProject | Out-Null
Set-Content -LiteralPath (Join-Path $packageSmokeProject 'evidence.txt') -Value "packaged keeper evidence" -Encoding utf8
$env:KEEPER_INSTALLED_ROOT = (Resolve-Path -LiteralPath '.package\project-design-keeper').Path
$env:KEEPER_SMOKE_PROJECT = $packageSmokeProject
try {
  node scripts/smoke-installed-plugin.mjs
  if ($LASTEXITCODE -ne 0) { throw "Package smoke failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item -LiteralPath $packageSmokeProject -Recurse -Force
}
```

Expected: exit 0 and exactly nine tools.

- [ ] **Step 6: Verify source, package, and Git state**

```powershell
$sourceDist = (Get-FileHash -Algorithm SHA256 -LiteralPath 'dist\index.js').Hash
$packageDist = (Get-FileHash -Algorithm SHA256 -LiteralPath '.package\project-design-keeper\dist\index.js').Hash
if ($sourceDist -ne $packageDist) { throw 'Packaged dist does not match the verified source build' }
git diff --check
git status --short
```

Expected: hashes are equal. Only intentional source/test/dist changes plus pre-existing `.plugin-eval/` artifacts appear.

- [ ] **Step 7: Commit the compiled runtime and installed-root verifier**

```powershell
git add -- dist/index.js scripts/smoke-installed-plugin.mjs
git diff --cached --check
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m "build: refresh keeper runtime after safety fixes"
} elseif ($LASTEXITCODE -ne 0) {
  throw "git diff --cached --quiet failed with exit code $LASTEXITCODE"
}
```

---

### Task 5: Activate the Verified Package Recoverably

**Files:**
- Source package: `C:/Users/17421/plugins/project-design-keeper/.package/project-design-keeper/**`
- Installed target: `C:/Users/17421/.codex/plugins/cache/personal/project-design-keeper/1.0.0/**`
- Recovery backup: sibling `1.0.0.backup-<timestamp>/`

**Interfaces:**
- Consumes: the verified allowlist package from Task 4.
- Produces: an installed tree that is byte-for-byte equal to that package, with the previous mixed cache retained as a recoverable sibling backup.

- [ ] **Step 1: Resolve and validate all absolute paths before moving anything**

```powershell
$packageRoot = (Resolve-Path -LiteralPath 'C:\Users\17421\plugins\project-design-keeper\.package\project-design-keeper').Path
$targetRoot = (Resolve-Path -LiteralPath 'C:\Users\17421\.codex\plugins\cache\personal\project-design-keeper\1.0.0').Path
$targetParent = (Resolve-Path -LiteralPath (Split-Path -Parent $targetRoot)).Path
if ($packageRoot -ne 'C:\Users\17421\plugins\project-design-keeper\.package\project-design-keeper') { throw 'Unexpected package root' }
if ($targetRoot -ne 'C:\Users\17421\.codex\plugins\cache\personal\project-design-keeper\1.0.0') { throw 'Unexpected plugin target' }
```

Expected: exact path checks pass. Do not use globs or unresolved environment variables for the move.

- [ ] **Step 2: Create a clean sibling staging directory and verify its hashes**

Use a GUID-named child of `$targetParent`, copy the verified package recursively, then compare its exact file set and hashes:

```powershell
$stagingRoot = Join-Path $targetParent ("1.0.0.installing-" + [guid]::NewGuid().ToString('N'))
Copy-Item -LiteralPath $packageRoot -Destination $stagingRoot -Recurse

function Get-VerifiedTree([string]$root) {
  $resolvedRoot = (Resolve-Path -LiteralPath $root).Path
  $entries = @(Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Force)
  $reparse = @($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
  if ($reparse.Count -ne 0) { throw "Tree contains a reparse entry: $($reparse[0].FullName)" }
  return @($entries | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    [pscustomobject]@{
      Relative = [IO.Path]::GetRelativePath($resolvedRoot, $_.FullName).Replace('\', '/')
      Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  } | Sort-Object Relative)
}

$packageTree = @(Get-VerifiedTree $packageRoot)
$stagingTree = @(Get-VerifiedTree $stagingRoot)
if (($packageTree | ConvertTo-Json -Compress) -ne ($stagingTree | ConvertTo-Json -Compress)) {
  throw 'Staged plugin tree differs from verified package'
}
```

Expected: staging contains exactly the allowlisted regular files and no reparse entry.

- [ ] **Step 3: Perform a recoverable two-rename swap**

Set `$backupRoot` to an explicit sibling and execute the two renames with rollback:

```powershell
$backupRoot = Join-Path $targetParent ("1.0.0.backup-" + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))
if (Test-Path -LiteralPath $backupRoot) { throw "Backup target already exists: $backupRoot" }

try {
  Move-Item -LiteralPath $targetRoot -Destination $backupRoot
} catch {
  throw "Active plugin directory could not be moved; leave staging intact and restart Codex before retrying. $($_.Exception.Message)"
}

try {
  Move-Item -LiteralPath $stagingRoot -Destination $targetRoot
} catch {
  $installError = $_
  if (Test-Path -LiteralPath $targetRoot) { throw "Install target unexpectedly exists after failed staging move" }
  Move-Item -LiteralPath $backupRoot -Destination $targetRoot
  throw $installError
}
```

If the first move reports access denied because the current MCP process holds the directory, leave the verified staging tree intact, make no changes to the active target, and request a Codex restart before retrying this exact step. Do not terminate an ambiguous `node dist/index.js` process because multiple plugins use that command line.

- [ ] **Step 4: Verify the installed tree byte-for-byte**

Enumerate the installed target and package again using `Get-VerifiedTree`. Require identical relative file sets and identical SHA-256 for every regular file:

```powershell
$installedTree = @(Get-VerifiedTree $targetRoot)
if (($packageTree | ConvertTo-Json -Compress) -ne ($installedTree | ConvertTo-Json -Compress)) {
  throw 'Installed plugin tree differs from verified package'
}
$packageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $packageRoot 'dist\index.js')).Hash
$installedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $targetRoot 'dist\index.js')).Hash
if ($packageHash -ne $installedHash) { throw 'Installed runtime differs from verified package' }
```

- [ ] **Step 5: Smoke-test the installed runtime as a fresh process**

Run the installed entry point as a fresh MCP process using the SDK already installed in the source repository:

```powershell
$smokeProject = Join-Path ([IO.Path]::GetTempPath()) ("keeper-installed-smoke-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $smokeProject | Out-Null
Set-Content -LiteralPath (Join-Path $smokeProject 'evidence.txt') -Value "installed keeper evidence" -Encoding utf8
$env:KEEPER_INSTALLED_ROOT = $targetRoot
$env:KEEPER_SMOKE_PROJECT = $smokeProject
node scripts/smoke-installed-plugin.mjs
$smokeExit = $LASTEXITCODE
Remove-Item -LiteralPath $smokeProject -Recurse -Force
if ($smokeExit -ne 0) { throw "Installed plugin smoke failed with exit code $smokeExit" }

npx vitest run test/transactions.test.ts --maxWorkers=1 -t "rechecks every candidate-pack source even when preview path is narrower"
npx vitest run test/mcp.test.ts --maxWorkers=1 -t "keeps the complete MCP envelope within one MiB without duplicating large structured results"
npx vitest run test/history.test.ts --maxWorkers=1 -t "rejects a cursor whose offset was changed and publicly rehashed"
npx vitest run test/scope-store.test.ts --maxWorkers=1
```

Use the `scripts/smoke-installed-plugin.mjs` verifier created in Task 4. It remains development-only infrastructure and is excluded by the package allowlist.

Expected: the fresh installed process starts successfully and all four protections pass. Keep the backup until the user has restarted Codex and confirmed the personal plugin loads normally.

---

## Completion Audit

- [ ] Exact candidate source changes invalidate previewed changesets.
- [ ] Complete MCP envelopes remain at or below 1 MiB without large text duplication.
- [ ] Publicly rehashed history cursors are rejected.
- [ ] Concurrent cold snapshot builders both succeed and leave no temporary directory.
- [ ] Invalid existing immutable snapshot targets are rejected.
- [ ] Typecheck, full tests, coverage, build, smoke, and package verification all exit 0.
- [ ] Source and packaged `dist/index.js` hashes match.
- [ ] Installed and packaged file sets and hashes match.
- [ ] Previous active cache remains recoverable as a sibling backup.
