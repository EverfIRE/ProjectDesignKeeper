import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  loadScopeIndex,
  persistScopeIndex,
  scopeCandidateModulesForFiles,
  scopeSnapshotIdForContent,
  type ScopeStoreIo
} from "../src/scope/store.js";
import {
  claimOwnedSnapshotDirectory,
  prepareSecureCache,
  publishExclusiveFile,
  safeRemoveOwnedPublicationClaim,
  type SecurePathIdentity
} from "../src/security/cache.js";

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
  const scopePaths = ["."];
  await mkdir(projectRoot, { recursive: true });
  const projectKey = key(resolve(projectRoot));
  const scopeKey = key(JSON.stringify(scopePaths));
  const cursorScopeKey = key(JSON.stringify({ projectKey, scopeKey }));
  const parent = join(cacheDirectory, "indexes", "v3", "snapshots", projectKey, cursorScopeKey);
  const files = [{ path: "Source/Test.cpp", fingerprint: `sha256:${"b".repeat(64)}`, size: 7, lineCount: 1 }];
  const content = {
    files,
    evidence: [{ path: "Source/Test.cpp", line: 1, text: "content" }],
    candidateModules: scopeCandidateModulesForFiles(files)
  };
  const snapshotId = scopeSnapshotIdForContent({ scopePaths, ...content });
  const target = join(parent, snapshotId.slice(7));
  const input = { options: { cacheDirectory }, projectRoot, scopePaths, snapshotId, ...content };
  return { input, parent, target };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

interface Round3ScopeStoreIo extends ScopeStoreIo {
  beforeTargetClaimAcquire?: () => Promise<void>;
  afterTargetClaimCollision?: () => Promise<void>;
  waitForTargetClaim?: (
    claim: SecurePathIdentity,
    attempt: number,
    operation: () => Promise<void>
  ) => Promise<"continue" | "deadline" | void>;
  afterBuildRename?: (target: string) => Promise<void>;
  afterSnapshotReads?: (target: string) => Promise<void>;
  afterTargetInspection?: (target: string, result: "missing" | "matching" | "invalid") => Promise<void>;
  afterStaleClaimRelease?: () => Promise<void>;
  nowMs?: () => number;
}

async function markClaimAsExpiredAndDead(claimPath: string, target: string): Promise<void> {
  const claimMetadata = await lstat(claimPath, { bigint: true });
  const ownerPath = claimMetadata.isDirectory() ? join(claimPath, "owner.json") : claimPath;
  const owner = JSON.parse(await readFile(ownerPath, "utf8")) as Record<string, unknown>;
  await writeFile(ownerPath, `${JSON.stringify({
    ...owner,
    pid: 2_147_483_647,
    createdAtMs: 1,
    expiresAtMs: 30_001,
    targetName: basename(target)
  })}\n`, { encoding: "utf8", mode: 0o600 });
}

test("derives bounded candidate modules for roots, nested roots, and normalized ID collisions", () => {
  const file = (path: string, lineCount: number) => ({
    path,
    fingerprint: `sha256:${"b".repeat(64)}`,
    size: lineCount,
    lineCount
  });

  expect(scopeCandidateModulesForFiles([
    file("README.md", 1),
    file("Source/Feature/A.cpp", 2),
    file("Source/Feature/B.cpp", 3),
    file("A B/One.cpp", 4),
    file("A-B/Two.cpp", 5),
    file("模块/File.cpp", 6)
  ])).toEqual([
    { id: "a-b", paths: ["A B", "A-B"], fileCount: 2, evidenceCount: 9 },
    { id: "module.b07e5088", paths: ["模块"], fileCount: 1, evidenceCount: 6 },
    { id: "root", paths: ["."], fileCount: 1, evidenceCount: 1 },
    { id: "source.feature", paths: ["Source/Feature"], fileCount: 2, evidenceCount: 5 }
  ]);
});

test.each([
  {
    name: "details without summary",
    content: { details: [{ kind: "new", path: "Source/New.cpp" }] }
  },
  {
    name: "summary without details",
    content: {
      driftSummary: {
        freshness: "fresh" as const,
        counts: { new: 0, modified: 0, deleted: 0, invalidated: 0 },
        invalidatedRecordIds: [],
        relocationCandidates: [],
        archiveEligibleRecordIds: []
      }
    }
  }
])("rejects drift snapshot $name", ({ content }) => {
  expect(() => scopeSnapshotIdForContent({ scopePaths: ["."], files: [], evidence: [], ...content }))
    .toThrow(/requires both details and summary/i);
});

test("binds a complete empty drift snapshot while normalizing omitted optional source sections", () => {
  const source = { scopePaths: ["."], files: [], evidence: [] };
  expect(scopeSnapshotIdForContent(source)).toBe(scopeSnapshotIdForContent({
    ...source,
    candidateModules: [],
    omissions: []
  }));
  expect(scopeSnapshotIdForContent({
    ...source,
    details: [],
    driftSummary: {
      freshness: "fresh",
      counts: { new: 0, modified: 0, deleted: 0, invalidated: 0 },
      invalidatedRecordIds: [],
      relocationCandidates: [],
      archiveEligibleRecordIds: []
    }
  })).toMatch(/^sha256:[a-f0-9]{64}$/u);
});

test("persists empty source shards as canonical zero-byte files", async () => {
  const { input, parent } = await scopeStoreFixture();
  input.files = [];
  input.evidence = [];
  input.candidateModules = [];
  input.snapshotId = scopeSnapshotIdForContent({
    scopePaths: input.scopePaths,
    files: [],
    evidence: [],
    candidateModules: []
  });
  const target = join(parent, input.snapshotId.slice(7));

  await persistScopeIndex(input);

  await expect(readFile(join(target, "files.jsonl"))).resolves.toHaveLength(0);
  await expect(readFile(join(target, "evidence.jsonl"))).resolves.toHaveLength(0);
});

test.each([
  { name: "negative", now: -1 },
  { name: "fractional", now: 1.5 },
  { name: "overflowing expiry", now: Number.MAX_SAFE_INTEGER - 7 * 24 * 60 * 60 * 1000 + 1 }
])("rejects a $name scope snapshot clock before publishing", async ({ now }) => {
  const { input } = await scopeStoreFixture();

  await expect(persistScopeIndex({
    ...input,
    options: { ...input.options, now: () => now }
  })).rejects.toThrow(/scope snapshot clock is invalid/i);
});

test("rejects a snapshot ID that does not bind the exact source content", async () => {
  const { input } = await scopeStoreFixture();
  input.snapshotId = `sha256:${"0".repeat(64)}`;

  await expect(persistScopeIndex(input)).rejects.toThrow(/snapshot ID does not bind its exact content/i);
});

test.each([
  {
    name: "malformed snapshot ID",
    load: (input: Awaited<ReturnType<typeof scopeStoreFixture>>["input"]) => ({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: "not-a-snapshot"
    })
  },
  {
    name: "missing cursor scope binding",
    load: (input: Awaited<ReturnType<typeof scopeStoreFixture>>["input"]) => ({
      options: input.options,
      projectRoot: input.projectRoot,
      snapshotId: input.snapshotId
    })
  }
])("classifies a $name as a corrupt scope continuation", async ({ load }) => {
  const { input } = await scopeStoreFixture();

  await expect(loadScopeIndex(load(input))).rejects.toMatchObject({
    reason: "corrupt",
    restartPagination: true
  });
});

test.each([
  { name: "metadata", shard: "metadata.json" },
  { name: "data shard", shard: "files.jsonl" }
])("rejects a same-byte $name path replacement after secure identity capture", async ({ shard }) => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const path = join(target, shard);
  const bytes = await readFile(path);
  let replaced = false;

  await expect(loadScopeIndex({
    options: input.options,
    projectRoot: input.projectRoot,
    scopePaths: input.scopePaths,
    snapshotId: input.snapshotId
  }, {
    afterShardIdentity: async (identity) => {
      if (identity.path !== path || replaced) return;
      await rename(path, `${path}.captured`);
      await writeFile(path, bytes, { mode: 0o600 });
      replaced = true;
    }
  })).rejects.toMatchObject({ reason: "corrupt", restartPagination: true });
  expect(replaced).toBe(true);
});

test("rejects an incomplete pre-existing immutable snapshot instead of adopting it", async () => {
  const { input, target } = await scopeStoreFixture();
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "metadata.json"), "{}\n", "utf8");

  await expect(persistScopeIndex(input)).rejects.toThrow(/existing.*scope.*index|snapshot.*invalid/i);
});

test("rejects a matching-metadata snapshot with a truncated files shard before creating a build directory", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  await writeFile(join(target, "files.jsonl"), "{\"path\":\"Source/Test.cpp\"", "utf8");

  let buildCalls = 0;
  const hooks: ScopeStoreIo = {
    beforeBuild: async () => { buildCalls += 1; }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/existing.*scope.*index|snapshot.*invalid/i);
  expect(buildCalls).toBe(0);
});

test("rejects a matching-metadata snapshot with a truncated evidence shard before creating a build directory", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  await writeFile(join(target, "evidence.jsonl"), "{\"path\":\"Source/Test.cpp\"", "utf8");

  let buildCalls = 0;
  const hooks: ScopeStoreIo = {
    beforeBuild: async () => { buildCalls += 1; }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/existing.*scope.*index|snapshot.*invalid/i);
  expect(buildCalls).toBe(0);
});

test("rejects a symbolic-link shard before reading its contents", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const outside = join(input.projectRoot, "outside-snapshot");
  await rename(target, outside);
  await symlink(outside, target, process.platform === "win32" ? "junction" : "dir");

  let shardReads = 0;
  const hooks: ScopeStoreIo = {
    beforeReadShard: async (path) => {
      if (path === join(target, "files.jsonl")) shardReads += 1;
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/existing.*scope.*index|snapshot.*invalid/i);
  expect(shardReads).toBe(0);
});

test("rejects a scope cache that overlaps its project", async () => {
  const { input } = await scopeStoreFixture();
  input.options.cacheDirectory = join(input.projectRoot, ".cache");

  await expect(persistScopeIndex(input)).rejects.toThrow(/cache.*project.*disjoint/i);
});

test("revalidates the owned build identity before publishing a scope snapshot", async () => {
  const { input } = await scopeStoreFixture();
  const hooks: ScopeStoreIo = {
    afterShardWrites: async (build) => {
      await rename(build.path, `${build.path}.moved`);
      await mkdir(build.path);
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toSatisfy((error: unknown) =>
    error instanceof AggregateError &&
    error.errors.length >= 2 &&
    error.errors.every((nested) => /identity/i.test(String((nested as Error).message)))
  );
});

test("bounds hidden build directory enumeration before publishing a scope snapshot", async () => {
  const { input } = await scopeStoreFixture();
  const hooks: ScopeStoreIo = {
    afterShardWrites: async (build) => {
      await Promise.all(Array.from({ length: 32 }, (_, index) =>
        writeFile(join(build.path, `extra-${index}.json`), "{}\n", { encoding: "utf8", mode: 0o600 })));
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/snapshot directory entries.*limit of 4 items/i);
});

test("adopts a complete concurrent winner and removes the losing build directory", async () => {
  const { input, parent, target } = await scopeStoreFixture();
  const claimAcquired = deferred<void>();
  const releaseClaim = deferred<void>();
  const hooks: ScopeStoreIo = {
    afterTargetClaim: async () => {
      claimAcquired.resolve();
      await releaseClaim.promise;
    }
  };

  const firstPersistence = persistScopeIndex(input, hooks);
  await claimAcquired.promise;
  const secondPersistence = persistScopeIndex(input);
  releaseClaim.resolve();
  const [first, second] = await Promise.all([firstPersistence, secondPersistence]);
  expect(first).toEqual(second);
  expect(await readdir(target)).toEqual(expect.arrayContaining(["evidence.jsonl", "files.jsonl", "metadata.json"]));
  expect((await readdir(parent)).filter((name) => name.startsWith(".build-"))).toEqual([]);
});

test("rethrows the original publish error when a concurrent winner has a truncated shard", async () => {
  const { input, parent, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const [metadata, evidence] = await Promise.all([
    readFile(join(target, "metadata.json"), "utf8"),
    readFile(join(target, "evidence.jsonl"), "utf8")
  ]);
  await rm(target, { recursive: true, force: true });

  const publishError = new Error("simulated concurrent publish failure");
  const hooks: ScopeStoreIo = {
    beforePublish: async (_build, winner) => {
      await mkdir(winner);
      await Promise.all([
        writeFile(join(winner, "metadata.json"), metadata, { encoding: "utf8", mode: 0o600 }),
        writeFile(join(winner, "files.jsonl"), "{\"path\":\"Source/Test.cpp\"", { encoding: "utf8", mode: 0o600 }),
        writeFile(join(winner, "evidence.jsonl"), evidence, { encoding: "utf8", mode: 0o600 })
      ]);
      throw publishError;
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toBe(publishError);
  expect((await readdir(parent)).filter((name) => name.startsWith(".build-"))).toEqual([]);
});

test("does not let a legacy aggregate IO object bypass shared symlink validation", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const outside = join(input.projectRoot, "outside-snapshot");
  await rename(target, outside);
  await symlink(outside, target, process.platform === "win32" ? "junction" : "dir");

  const legacyIo = {
    mkdir, readFile, rename, rm, writeFile,
    lstat: async (path: Parameters<typeof lstat>[0]) => {
      if (String(path) === target) {
        return { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
      }
      return lstat(path);
    }
  } as unknown as ScopeStoreIo;

  await expect(persistScopeIndex(input, legacyIo)).rejects.toThrow(/symbolic|junction|reparse|invalid/i);
});

test("never overwrites an empty target inserted immediately before snapshot publication", async () => {
  const { input, target } = await scopeStoreFixture();
  const hooks: ScopeStoreIo = {
    beforePublish: async () => { await mkdir(target); }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow();
  await expect(readdir(target)).resolves.toEqual([]);
});

test("waits for every shard write to settle before identity-checked cleanup", async () => {
  const { input, parent } = await scopeStoreFixture();
  const heldStarted = deferred<void>();
  const releaseHeld = deferred<void>();
  const cleanupStarted = deferred<void>();
  const primary = new Error("files shard failed");
  const writeBehavior = async (path: string, operation: () => Promise<void>) => {
    if (path.endsWith("files.jsonl")) throw primary;
    if (path.endsWith("evidence.jsonl")) {
      heldStarted.resolve();
      await releaseHeld.promise;
    }
    await operation();
  };
  const hooks: ScopeStoreIo = {
    writeShard: (path, _contents, operation) => writeBehavior(path, operation),
    beforeCleanup: async () => { cleanupStarted.resolve(); }
  };

  const persistence = persistScopeIndex(input, hooks);
  await heldStarted.promise;
  const cleanupOrder = await Promise.race([
    cleanupStarted.promise.then(() => "cleanup"),
    new Promise<"held">((accept) => setTimeout(() => accept("held"), 50))
  ]);
  releaseHeld.resolve();

  await expect(persistence).rejects.toBe(primary);
  expect(cleanupOrder).toBe("held");
  expect((await readdir(parent)).filter((name) => name.startsWith(".build-"))).toEqual([]);
});

test("keeps the deterministic target absent while a publisher claim is held and lets a late arrival adopt", async () => {
  const { input, target } = await scopeStoreFixture();
  const claimHeld = deferred<void>();
  const releaseClaim = deferred<void>();
  let claims = 0;
  let claimPath = "";
  const hooks: ScopeStoreIo = {
    afterTargetClaim: async (claim) => {
      claims += 1;
      claimPath = claim.path;
      claimHeld.resolve();
      await releaseClaim.promise;
    }
  };

  const publisher = persistScopeIndex(input, hooks);
  await claimHeld.promise;
  const targetWasAbsent = await lstat(target).then(() => false, (error: NodeJS.ErrnoException) => error.code === "ENOENT");
  const lateArrival = persistScopeIndex(input);
  releaseClaim.resolve();

  const settled = await Promise.allSettled([publisher, lateArrival]);
  expect(claimPath).not.toBe(target);
  expect(targetWasAbsent).toBe(true);
  expect(settled).toEqual([
    { status: "fulfilled", value: expect.objectContaining({ cacheRoot: target }) },
    { status: "fulfilled", value: expect.objectContaining({ cacheRoot: target }) }
  ]);
  expect(claims).toBe(1);
});

test("revalidates a snapshot after beforeReadShard replaces it with a junction", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const outside = join(input.projectRoot, "read-hook-snapshot");
  let swapped = false;
  const hooks: ScopeStoreIo = {
    beforeReadShard: async () => {
      if (swapped) return;
      swapped = true;
      await rename(target, outside);
      await symlink(outside, target, process.platform === "win32" ? "junction" : "dir");
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/symbolic|junction|reparse|invalid|identity/i);
});

test("revalidates a shard hard-link swap performed by beforeReadShard", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const shard = join(target, "files.jsonl");
  const outside = join(input.projectRoot, "read-hook-files.jsonl");
  let swapped = false;
  const hooks: ScopeStoreIo = {
    beforeReadShard: async () => {
      if (swapped) return;
      swapped = true;
      await rename(shard, outside);
      const { link } = await import("node:fs/promises");
      await link(outside, shard);
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/hard.?link|link count|invalid/i);
});

test("revalidates exact snapshot identity and contents after afterPublish", async () => {
  const { input, target } = await scopeStoreFixture();
  const outside = join(input.projectRoot, "after-publish-snapshot");
  const hooks: ScopeStoreIo = {
    afterPublish: async () => {
      await rename(target, outside);
      await symlink(outside, target, process.platform === "win32" ? "junction" : "dir");
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toSatisfy((error: unknown) =>
    error instanceof AggregateError &&
    error.errors.some((nested) => /symbolic|junction|reparse|invalid|identity/i.test(String((nested as Error).message)))
  );
});

test("revalidates exact snapshot contents after afterPublish hard-links a shard", async () => {
  const { input, target } = await scopeStoreFixture();
  const shard = join(target, "files.jsonl");
  const outside = join(input.projectRoot, "after-publish-files.jsonl");
  const hooks: ScopeStoreIo = {
    afterPublish: async () => {
      await rename(shard, outside);
      const { link } = await import("node:fs/promises");
      await link(outside, shard);
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/hard.?link|link count|invalid|cleanup|changed/i);
});

test("keeps a late snapshot inspector behind the claim while a hidden shard has two links", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const linked = deferred<void>();
  const release = deferred<void>();
  let held = false;
  const hooks: ScopeStoreIo = {
    writeShard: async (path, contents, operation) => {
      if (!held && path.endsWith("files.jsonl")) {
        held = true;
        await publishExclusiveFile(layout, path, contents, {
          afterLink: async () => {
            linked.resolve();
            await release.promise;
          }
        });
        return;
      }
      await operation();
    }
  };

  const publisher = persistScopeIndex(input, hooks);
  await linked.promise;
  const lateInspector = persistScopeIndex(input);
  await expect(Promise.race([
    lateInspector.then(() => "finished"),
    new Promise<"held">((accept) => setTimeout(() => accept("held"), 50))
  ])).resolves.toBe("held");
  release.resolve();

  await expect(Promise.all([publisher, lateInspector])).resolves.toEqual([
    expect.objectContaining({ cacheRoot: target }),
    expect.objectContaining({ cacheRoot: target })
  ]);
});

test("keeps a late arrival behind the claim until post-publication validation finishes", async () => {
  const { input, target } = await scopeStoreFixture();
  const targetVisible = deferred<void>();
  const releaseValidation = deferred<void>();
  const hooks: ScopeStoreIo = {
    afterPublish: async () => {
      targetVisible.resolve();
      await releaseValidation.promise;
    }
  };

  const publisher = persistScopeIndex(input, hooks);
  await targetVisible.promise;
  await expect(lstat(target)).resolves.toSatisfy((metadata) => metadata.isDirectory());
  const lateArrival = persistScopeIndex(input);
  await expect(Promise.race([
    lateArrival.then(() => "finished"),
    new Promise<"held">((accept) => setTimeout(() => accept("held"), 50))
  ])).resolves.toBe("held");
  releaseValidation.resolve();

  await expect(Promise.all([publisher, lateArrival])).resolves.toEqual([
    expect.objectContaining({ cacheRoot: target }),
    expect.objectContaining({ cacheRoot: target })
  ]);
});

test("rejects an otherwise matching snapshot with an extra regular file", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  await writeFile(join(target, "extra.json"), "{}", { mode: 0o600 });

  await expect(persistScopeIndex(input)).rejects.toThrow(/exact|extra|invalid|snapshot/i);
});

test("rejects an otherwise matching snapshot with an extra reparse entry", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const outside = join(input.projectRoot, "extra-directory");
  await mkdir(outside);
  await symlink(outside, join(target, "extra"), process.platform === "win32" ? "junction" : "dir");

  await expect(persistScopeIndex(input)).rejects.toThrow(/exact|extra|invalid|snapshot/i);
});

test("reconciles EEXIST when the competing claim disappears and a complete target appears", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const stagedWinner = `${target}.winner`;
  await rename(target, stagedWinner);
  let competingClaim: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let collisions = 0;
  const hooks: Round3ScopeStoreIo = {
    beforeTargetClaimAcquire: async () => {
      if (!competingClaim) competingClaim = await claimOwnedSnapshotDirectory(
        await prepareSecureCache(input.options, input.projectRoot),
        target
      );
    },
    afterTargetClaimCollision: async () => {
      collisions += 1;
      await rename(stagedWinner, target);
      await safeRemoveOwnedPublicationClaim(
        await prepareSecureCache(input.options, input.projectRoot),
        competingClaim!
      );
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(collisions).toBe(1);
  await expect(readdir(target)).resolves.toEqual(["evidence.jsonl", "files.jsonl", "metadata.json"]);
});

test("retries claim acquisition when EEXIST reconciles to no claim and no target", async () => {
  const { input, target } = await scopeStoreFixture();
  let competingClaim: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let collisions = 0;
  const hooks: Round3ScopeStoreIo = {
    beforeTargetClaimAcquire: async () => {
      if (!competingClaim) competingClaim = await claimOwnedSnapshotDirectory(
        await prepareSecureCache(input.options, input.projectRoot),
        target
      );
    },
    afterTargetClaimCollision: async () => {
      collisions += 1;
      await safeRemoveOwnedPublicationClaim(
        await prepareSecureCache(input.options, input.projectRoot),
        competingClaim!
      );
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(collisions).toBe(1);
  await expect(readdir(target)).resolves.toEqual(["evidence.jsonl", "files.jsonl", "metadata.json"]);
});

test("performs one final claim-target reconciliation when the claim disappears at the deadline", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  let waits = 0;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async (_identity, _attempt, _operation) => {
      waits += 1;
      await safeRemoveOwnedPublicationClaim(layout, claim);
      return "deadline";
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(waits).toBe(1);
});

test("rechecks claim absence after asynchronous target inspection before adopting", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  let insertedClaim: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let waits = 0;
  const hooks: Round3ScopeStoreIo = {
    afterSnapshotReads: async () => {
      if (!insertedClaim) insertedClaim = await claimOwnedSnapshotDirectory(layout, target);
    },
    waitForTargetClaim: async () => {
      waits += 1;
      await safeRemoveOwnedPublicationClaim(layout, insertedClaim!);
      return "deadline";
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(waits).toBe(1);
});

test("starts a new claim epoch after A is absent and B appears during target inspection", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claimA = await claimOwnedSnapshotDirectory(layout, target);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let waits = 0;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      waits += 1;
      if (waits === 1) await safeRemoveOwnedPublicationClaim(layout, claimA);
      else await safeRemoveOwnedPublicationClaim(layout, claimB!);
      return "continue";
    },
    afterTargetInspection: async (_path, result) => {
      if (result === "missing" && waits === 1 && !claimB) {
        claimB = await claimOwnedSnapshotDirectory(layout, target);
      }
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(claimB).toBeDefined();
  expect(waits).toBe(2);
});

test("binds B after an absence so a continuous B-to-C replacement is rejected", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let claimC: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  const hooks: Round3ScopeStoreIo = {
    afterTargetInspection: async (_path, result) => {
      if (result === "missing" && !claimB) claimB = await claimOwnedSnapshotDirectory(layout, target);
    },
    afterTargetClaimRecheck: async () => {
      await safeRemoveOwnedPublicationClaim(layout, claimB!);
      claimC = await claimOwnedSnapshotDirectory(layout, target);
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/claim.*(owner|metadata|identity).*changed/i);
  await safeRemoveOwnedPublicationClaim(layout, claimC!);
});

test("starts a new claim epoch when B appears after exact stale-A reclamation", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claimA = await claimOwnedSnapshotDirectory(layout, target);
  await markClaimAsExpiredAndDead(claimA.path, target);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  let waits = 0;
  const hooks: Round3ScopeStoreIo = {
    afterStaleClaimRelease: async () => {
      if (!claimB) claimB = await claimOwnedSnapshotDirectory(layout, target);
    },
    waitForTargetClaim: async () => {
      waits += 1;
      await safeRemoveOwnedPublicationClaim(layout, claimB!);
      return "continue";
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(claimB).toBeDefined();
  expect(waits).toBe(1);
});

test("rejects a claim identity change while the deterministic path stayed continuously occupied", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claimA = await claimOwnedSnapshotDirectory(layout, target);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      await safeRemoveOwnedPublicationClaim(layout, claimA);
      claimB = await claimOwnedSnapshotDirectory(layout, target);
      return "continue";
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/claim identity(?: or owner metadata)? changed/i);
  await safeRemoveOwnedPublicationClaim(layout, claimB!);
});

test("rejects a same-inode publication-owner rewrite within one continuous claim epoch", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  let rewritten = false;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      if (!rewritten) {
        rewritten = true;
        await markClaimAsExpiredAndDead(claim.path, target);
      }
      return "continue";
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/claim.*(owner|metadata|identity).*changed/i);
  await expect(lstat(claim.path)).resolves.toSatisfy((metadata) => metadata.isFile());
});

test("preserves the bound claim epoch when entering final deadline reconciliation", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claimA = await claimOwnedSnapshotDirectory(layout, target);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      await safeRemoveOwnedPublicationClaim(layout, claimA);
      claimB = await claimOwnedSnapshotDirectory(layout, target);
      await markClaimAsExpiredAndDead(claimB.path, target);
      return "deadline";
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/claim.*(owner|metadata|identity).*changed/i);
  await expect(lstat(claimB!.path)).resolves.toSatisfy((metadata) => metadata.isFile());
});

test("adopts a winner that completes during the final missing-target inspection", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  let published = false;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      await safeRemoveOwnedPublicationClaim(layout, claim);
      return "deadline";
    },
    afterTargetInspection: async (_path, result) => {
      if (result === "missing" && !published) {
        published = true;
        await persistScopeIndex(input);
      }
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(published).toBe(true);
});

test("inspects the target after the one allowed final dead-claim reclamation", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const stagedWinner = `${target}.staged-winner`;
  await rename(target, stagedWinner);
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claimA = await claimOwnedSnapshotDirectory(layout, target);
  let claimB: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async () => {
      await safeRemoveOwnedPublicationClaim(layout, claimA);
      return "deadline";
    },
    afterTargetInspection: async (_path, result) => {
      if (result !== "missing" || claimB) return;
      await rename(stagedWinner, target);
      claimB = await claimOwnedSnapshotDirectory(layout, target);
      await markClaimAsExpiredAndDead(claimB.path, target);
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  await expect(lstat(claimB!.path)).rejects.toMatchObject({ code: "ENOENT" });
});

test("uses one total acquisition deadline across repeated claim collisions", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  let now = 0;
  let acquisitionAttempts = 0;
  let collisions = 0;
  let competitor: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;
  const hooks: Round3ScopeStoreIo = {
    nowMs: () => now,
    beforeTargetClaimAcquire: async () => {
      acquisitionAttempts += 1;
      if (acquisitionAttempts > 2) throw new Error("deadline budget reset and reached a third acquisition");
      competitor = await claimOwnedSnapshotDirectory(layout, target);
    },
    afterTargetClaimCollision: async () => {
      collisions += 1;
      await safeRemoveOwnedPublicationClaim(layout, competitor!);
      competitor = undefined;
      now += 20_000;
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/deadline|timed out|timeout/i);
  expect(acquisitionAttempts).toBe(2);
  expect(collisions).toBe(2);
});

test("continues waiting for a live exact claim beyond the former poll bound", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  let waits = 0;
  const hooks: Round3ScopeStoreIo = {
    waitForTargetClaim: async (_identity, _attempt, _operation) => {
      waits += 1;
      if (waits === 101) await safeRemoveOwnedPublicationClaim(layout, claim);
      return "continue";
    }
  };

  await expect(persistScopeIndex(input, hooks)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  expect(waits).toBe(101);
});

test("reclaims an expired dead orphan claim before target publication and retries", async () => {
  const { input, target } = await scopeStoreFixture();
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  await markClaimAsExpiredAndDead(claim.path, target);

  await expect(persistScopeIndex(input)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  await expect(readdir(target)).resolves.toEqual(["evidence.jsonl", "files.jsonl", "metadata.json"]);
});

test("reclaims an expired dead orphan claim after target publication and adopts", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const claim = await claimOwnedSnapshotDirectory(layout, target);
  await markClaimAsExpiredAndDead(claim.path, target);

  await expect(persistScopeIndex(input)).resolves.toEqual(expect.objectContaining({ cacheRoot: target }));
  await expect(lstat(claim.path)).rejects.toMatchObject({ code: "ENOENT" });
});

test("owns post-rename cleanup when target capture fails", async () => {
  const { input, target } = await scopeStoreFixture();
  const captureFault = new Error("post-rename capture fault");
  const hooks: Round3ScopeStoreIo = {
    afterBuildRename: async () => { throw captureFault; }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toBe(captureFault);
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
});

test("retains and reports a replacement when target identity changes after rename", async () => {
  const { input, target } = await scopeStoreFixture();
  const movedOwnedTarget = `${target}.owned-moved`;
  const marker = join(target, "replacement.txt");
  const hooks: Round3ScopeStoreIo = {
    afterBuildRename: async () => {
      await rename(target, movedOwnedTarget);
      await mkdir(target, { mode: 0o700 });
      await writeFile(marker, "replacement", { encoding: "utf8", mode: 0o600 });
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toSatisfy((error: unknown) =>
    error instanceof AggregateError && /identity|capture/i.test(String(error.errors[0])) && /retained|cleanup|target/i.test(String(error.errors[1]))
  );
  await expect(readFile(marker, "utf8")).resolves.toBe("replacement");
  await expect(lstat(movedOwnedTarget)).resolves.toSatisfy((metadata) => metadata.isDirectory());
});

test("reports retained ambiguity when the exact published target disappears before capture", async () => {
  const { input, target } = await scopeStoreFixture();
  const movedOwnedTarget = `${target}.owned-moved`;
  const hooks: Round3ScopeStoreIo = {
    afterBuildRename: async () => {
      await rename(target, movedOwnedTarget);
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toSatisfy((error: unknown) =>
    error instanceof AggregateError && error.errors.length >= 2 && /retained|ambiguous|target/i.test(String(error.errors[1]))
  );
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(lstat(movedOwnedTarget)).resolves.toSatisfy((metadata) => metadata.isDirectory());
});

test("rejects a hidden build extra entry before the public target is created", async () => {
  const { input, target } = await scopeStoreFixture();
  let restoredAfterRename = false;
  const hooks: Round3ScopeStoreIo = {
    beforePublish: async (build) => {
      await writeFile(join(build.path, "extra.json"), "{}\n", { encoding: "utf8", mode: 0o600 });
    },
    beforeReadShard: async () => {
      if (restoredAfterRename) return;
      restoredAfterRename = true;
      await rm(join(target, "extra.json"));
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/exact|extra|snapshot|build/i);
  expect(restoredAfterRename).toBe(false);
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
});

test("rejects in-place hidden shard byte changes before the public target is created", async () => {
  const { input, target } = await scopeStoreFixture();
  let originalFiles = "";
  let restoredAfterRename = false;
  const hooks: Round3ScopeStoreIo = {
    beforePublish: async (build) => {
      originalFiles = await readFile(join(build.path, "files.jsonl"), "utf8");
      await writeFile(join(build.path, "files.jsonl"), "{}\n", { encoding: "utf8", mode: 0o600 });
    },
    beforeReadShard: async () => {
      if (restoredAfterRename) return;
      restoredAfterRename = true;
      await writeFile(join(target, "files.jsonl"), originalFiles, { encoding: "utf8", mode: 0o600 });
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/contents|matching|snapshot|build|invalid/i);
  expect(restoredAfterRename).toBe(false);
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
});

test("repeats exact snapshot enumeration after reads before adopting", async () => {
  const { input, target } = await scopeStoreFixture();
  await persistScopeIndex(input);
  let mutated = false;
  const hooks: Round3ScopeStoreIo = {
    afterSnapshotReads: async () => {
      mutated = true;
      await writeFile(join(target, "late-extra.json"), "{}\n", { encoding: "utf8", mode: 0o600 });
    }
  };

  await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/existing|exact|invalid|snapshot/i);
  expect(mutated).toBe(true);
});
