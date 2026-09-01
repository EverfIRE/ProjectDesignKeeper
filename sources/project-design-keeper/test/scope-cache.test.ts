import { createHash } from "node:crypto";
import { cp, link, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import {
  claimOwnedSnapshotDirectory,
  createOwnedBuildDirectory,
  prepareSecureCache,
  publishExclusiveFile,
  safeRemoveOwnedPublicationClaim,
  type SecureCacheLayout,
  type SecurePathIdentity
} from "../src/security/cache.js";
import {
  persistScopeIndex,
  scopeCursorKey,
  scopePathsKey,
  scopeProjectKey,
  scopeSnapshotIdForContent,
  type PersistScopeIndexInput,
  type ScopeStoreIo
} from "../src/scope/store.js";

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const roots: string[] = [];

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function cacheFixture(prefix = "keeper-scope-cache-") {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  const projectRoot = join(root, "project");
  const cacheDirectory = join(root, "cache");
  await mkdir(projectRoot, { recursive: true });
  return { root, projectRoot, cacheDirectory };
}

function persistedInput(
  fixture: Awaited<ReturnType<typeof cacheFixture>>,
  index = 1,
  now = 1_000,
  evidenceText = `line-${index}`
): PersistScopeIndexInput {
  const path = `Source/File${index}.cpp`;
  const content = {
    options: { cacheDirectory: fixture.cacheDirectory, now: () => now },
    projectRoot: fixture.projectRoot,
    scopePaths: ["."],
    files: [{ path, fingerprint: digest(`${evidenceText}\n`), size: Buffer.byteLength(`${evidenceText}\n`), lineCount: 1 }],
    evidence: [{ path, line: 1, text: evidenceText }],
    candidateModules: [{ id: "source", paths: ["Source"], fileCount: 1, evidenceCount: 1 }],
    omissions: [{ path: "Source/Omitted.bin", reason: "binary", size: 4 }]
  } as Omit<PersistScopeIndexInput, "snapshotId">;
  return { ...content, snapshotId: scopeSnapshotIdForContent(content) };
}

interface LoadedIndex {
  cacheRoot: string;
  snapshotId: string;
  createdAt: number;
  expiresAt: number;
  scopeKey: string;
  cursorScopeKey: string;
  files: ReadonlyArray<Record<string, unknown>>;
  evidence: ReadonlyArray<Record<string, unknown>>;
  candidateModules: ReadonlyArray<Record<string, unknown>>;
  omissions: ReadonlyArray<Record<string, unknown>>;
  totals: Readonly<Record<string, number>>;
}

interface PruneLimits {
  now?: () => number;
  ttlMs?: number;
  maxSnapshotsPerScope?: number;
  maxProjectBytes?: number;
  maxGlobalBytes?: number;
}

interface Task7ScopeStore {
  loadScopeIndex(input: {
    options: PersistScopeIndexInput["options"];
    projectRoot: string;
    scopePaths?: string[];
    scopeKey?: string;
    snapshotId: string;
    now?: number;
  }, hooks?: ScopeStoreIo): Promise<LoadedIndex>;
  pruneScopeIndexes(
    layout: SecureCacheLayout,
    protectedSnapshot?: string,
    limits?: PruneLimits,
    hooks?: ScopeStoreIo
  ): Promise<{ removed: string[]; retainedBytes: number }>;
}

async function task7Store(): Promise<Task7ScopeStore> {
  return await import("../src/scope/store.js") as unknown as Task7ScopeStore;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function regularFileBytes(directory: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) throw new Error(`Expected a regular file in ${directory}: ${entry.name}`);
    bytes += (await lstat(join(directory, entry.name))).size;
  }
  return bytes;
}

function persistedInputForScope(
  fixture: Awaited<ReturnType<typeof cacheFixture>>,
  index: number,
  scopePath: string
): PersistScopeIndexInput {
  const path = `${scopePath}/File${index}.cpp`;
  const evidenceText = `line-${index}`;
  const content = {
    options: { cacheDirectory: fixture.cacheDirectory, now: () => index * 1_000 },
    projectRoot: fixture.projectRoot,
    scopePaths: [scopePath],
    files: [{ path, fingerprint: digest(`${evidenceText}\n`), size: Buffer.byteLength(`${evidenceText}\n`), lineCount: 1 }],
    evidence: [{ path, line: 1, text: evidenceText }],
    candidateModules: [{
      id: scopePath.toLocaleLowerCase("en-US"), paths: [scopePath], fileCount: 1, evidenceCount: 1
    }],
    omissions: [{ path: `${scopePath}/Omitted.bin`, reason: "binary", size: 4 }]
  } as Omit<PersistScopeIndexInput, "snapshotId">;
  return { ...content, snapshotId: scopeSnapshotIdForContent(content) };
}

async function markClaimAsExpiredAndDead(claimPath: string, target: string): Promise<void> {
  const owner = JSON.parse(await readFile(claimPath, "utf8")) as Record<string, unknown>;
  await writeFile(claimPath, `${JSON.stringify({
    ...owner,
    pid: 2_147_483_647,
    createdAtMs: 1,
    expiresAtMs: 30_001,
    targetName: basename(target)
  })}\n`, { encoding: "utf8", mode: 0o600 });
}

async function snapshotShard(cacheDirectory: string, name: "files.jsonl" | "evidence.jsonl" | "metadata.json"): Promise<string> {
  const pending = [join(cacheDirectory, "indexes")];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.name === name) return path;
    }
  }
  throw new Error(`Missing ${name}`);
}

function restartError(reason: "missing" | "expired" | "corrupt") {
  return expect.objectContaining({
    name: "ScopeSnapshotRestartError",
    reason,
    restartPagination: true,
    message: expect.stringMatching(/restart pagination/i)
  });
}

describe("cursor-first immutable scope loading", () => {
  test("does not persist an unconsumable snapshot for query-context freshness reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-context-read-");
    await writeFile(join(fixture.projectRoot, "context.txt"), "active context token\n", "utf8");
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });

    const result = await api.queryContext({ root: fixture.projectRoot, query: "active context token" });

    expect(result.context).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "context.txt" })
    ]));
    expect(repositoryReads).toBeGreaterThan(0);
    expect(await exists(fixture.cacheDirectory)).toBe(false);
  });

  test("does not persist an unconsumable snapshot for drift-summary freshness reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-summary-");
    await writeFile(join(fixture.projectRoot, "changed.txt"), "current\n", "utf8");
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });

    const result = await api.detectDrift({
      root: fixture.projectRoot,
      previousSnapshot: { files: {} },
      view: "summary"
    });

    expect(result.freshness).toBe("unknown");
    expect(result.counts).toEqual(expect.objectContaining({ new: 1 }));
    expect(repositoryReads).toBeGreaterThan(0);
    expect(await exists(fixture.cacheDirectory)).toBe(false);
  });

  test("loads a continuation page with zero repository discovery or content reads", async () => {
    const fixture = await cacheFixture();
    const source = join(fixture.projectRoot, "source.txt");
    await writeFile(source, "first\nsecond\nthird\n", "utf8");
    let discoveryReads = 0;
    let contentReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { discoveryReads += 1; },
        beforeRepositoryContentRead: async () => { contentReads += 1; }
      }
    } as never);
    const first = await api.scanScope({ root: fixture.projectRoot, view: "evidence", limit: 1 });
    expect(discoveryReads).toBeGreaterThan(0);
    expect(contentReads).toBeGreaterThan(0);
    discoveryReads = 0;
    contentReads = 0;
    await rename(source, join(fixture.root, "source-moved.txt"));

    const second = await api.scanScope({
      root: fixture.projectRoot,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    });

    expect(second.items).toEqual([{ path: "source.txt", line: 2, text: "second" }]);
    expect(discoveryReads).toBe(0);
    expect(contentReads).toBe(0);
  });

  test("preserves the path-only absolute public scope across a cache continuation", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-public-path-");
    await writeFile(join(fixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    const api = createProjectDesignKeeper({ cacheDirectory: fixture.cacheDirectory });

    const first = await api.scanScope({ path: fixture.projectRoot, view: "evidence", limit: 1 });
    expect(first.scope.paths).toEqual([fixture.projectRoot]);

    const second = await api.scanScope({
      path: fixture.projectRoot,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    });
    expect(second.scope.paths).toEqual([fixture.projectRoot]);
  });

  test("rejects a corrupt shard with a typed restart error and never rescans", async () => {
    const fixture = await cacheFixture();
    await writeFile(join(fixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    } as never);
    const first = await api.scanScope({ root: fixture.projectRoot, view: "evidence", limit: 1 });
    const shard = await snapshotShard(fixture.cacheDirectory, "evidence.jsonl");
    await writeFile(shard, "{}\n", "utf8");
    repositoryReads = 0;

    const error = await api.scanScope({
      root: fixture.projectRoot,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    }).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
    expect(repositoryReads).toBe(0);
  });

  test("rejects shard bytes re-described by tampered metadata under the old snapshot ID", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-content-binding-");
    await writeFile(join(fixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    const api = createProjectDesignKeeper({ cacheDirectory: fixture.cacheDirectory });
    const first = await api.scanScope({ root: fixture.projectRoot, view: "evidence", limit: 1 });
    const evidencePath = await snapshotShard(fixture.cacheDirectory, "evidence.jsonl");
    const metadataPath = join(dirname(evidencePath), "metadata.json");
    const evidence = (await readFile(evidencePath, "utf8")).trimEnd().split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    evidence[1]!.text = "tampered second";
    const rewritten = `${evidence.map((item) => JSON.stringify(item)).join("\n")}\n`;
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
    const shards = metadata.shards as Record<string, Record<string, unknown>>;
    shards.evidence!.bytes = Buffer.byteLength(rewritten);
    shards.evidence!.hash = digest(rewritten);
    await writeFile(evidencePath, rewritten, "utf8");
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    const error = await api.scanScope({
      root: fixture.projectRoot,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    }).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
  });

  test("recomputes scope bindings instead of trusting mutable metadata", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-scope-binding-");
    await writeFile(join(fixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    const api = createProjectDesignKeeper({ cacheDirectory: fixture.cacheDirectory });
    const first = await api.scanScope({ root: fixture.projectRoot, view: "evidence", limit: 1 });
    const metadataPath = await snapshotShard(fixture.cacheDirectory, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
    metadata.scopePaths = ["forged"];
    metadata.scopeKey = digest(JSON.stringify(["forged"])).slice("sha256:".length);
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    const error = await api.scanScope({
      root: fixture.projectRoot,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    }).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
  });

  test("missing and expired cursor snapshots require an explicit pagination restart", async () => {
    const missingFixture = await cacheFixture("keeper-scope-cache-missing-");
    await writeFile(join(missingFixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    const missingApi = createProjectDesignKeeper({ cacheDirectory: missingFixture.cacheDirectory });
    const missingFirst = await missingApi.scanScope({ root: missingFixture.projectRoot, view: "evidence", limit: 1 });
    const missingShard = await snapshotShard(missingFixture.cacheDirectory, "metadata.json");
    await rm(dirname(missingShard), { recursive: true, force: true });
    const missingError = await missingApi.scanScope({
      root: missingFixture.projectRoot, view: "evidence", limit: 1, cursor: missingFirst.page?.nextCursor
    }).catch((failure: unknown) => failure);
    expect(missingError).toEqual(restartError("missing"));

    const expiredFixture = await cacheFixture("keeper-scope-cache-expired-");
    await writeFile(join(expiredFixture.projectRoot, "source.txt"), "first\nsecond\n", "utf8");
    let now = Date.now();
    const expiredApi = createProjectDesignKeeper({ cacheDirectory: expiredFixture.cacheDirectory, now: () => now });
    const expiredFirst = await expiredApi.scanScope({ root: expiredFixture.projectRoot, view: "evidence", limit: 1 });
    now += sevenDaysMs;
    const expiredError = await expiredApi.scanScope({
      root: expiredFixture.projectRoot, view: "evidence", limit: 1, cursor: expiredFirst.page?.nextCursor
    }).catch((failure: unknown) => failure);
    expect(expiredError).toEqual(restartError("expired"));
  });

  test("loads drift-detail continuations from the exact cached snapshot with zero repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-");
    await Promise.all([
      writeFile(join(fixture.projectRoot, "a.txt"), "alpha\n", "utf8"),
      writeFile(join(fixture.projectRoot, "b.txt"), "beta\n", "utf8")
    ]);
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const first = await api.detectDrift({
      root: fixture.projectRoot,
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1
    });
    expect(repositoryReads).toBeGreaterThan(0);
    expect(await exists(fixture.cacheDirectory)).toBe(true);
    repositoryReads = 0;
    await Promise.all([
      rename(join(fixture.projectRoot, "a.txt"), join(fixture.root, "a-moved.txt")),
      rename(join(fixture.projectRoot, "b.txt"), join(fixture.root, "b-moved.txt"))
    ]);

    const second = await api.detectDrift({
      root: fixture.projectRoot,
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    });

    expect(second.items).toEqual([{ kind: "new", path: "b.txt" }]);
    expect(repositoryReads).toBe(0);
  });

  test("continues a pack-selected drift scope without reopening the pack or repository", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-selected-");
    await mkdir(join(fixture.projectRoot, "Source"), { recursive: true });
    await Promise.all([
      writeFile(join(fixture.projectRoot, "Source", "a.txt"), "alpha\n", "utf8"),
      writeFile(join(fixture.projectRoot, "Source", "b.txt"), "beta\n", "utf8"),
      writeFile(join(fixture.projectRoot, "outside.txt"), "outside\n", "utf8")
    ]);
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const request = {
      root: fixture.projectRoot,
      path: ".",
      pack: {
        scope: { root: ".", paths: ["Source"] },
        sourceRevision: { kind: "working-tree", files: {} },
        records: []
      },
      view: "details" as const,
      limit: 1
    };
    const first = await api.detectDrift(request);
    expect(repositoryReads).toBeGreaterThan(0);
    repositoryReads = 0;
    await rename(join(fixture.projectRoot, "Source"), join(fixture.root, "Source-moved"));

    const second = await api.detectDrift({
      ...request,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    });

    expect(second.items).toEqual([{ kind: "new", path: "Source/b.txt" }]);
    expect(repositoryReads).toBe(0);
  });

  test("continues a manifest-selected drift scope from its signed storage binding without repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-manifest-selected-");
    await Promise.all([
      mkdir(join(fixture.projectRoot, "Source"), { recursive: true }),
      mkdir(join(fixture.projectRoot, "docs", "project-design"), { recursive: true })
    ]);
    await Promise.all([
      writeFile(join(fixture.projectRoot, "Source", "a.txt"), "alpha\n", "utf8"),
      writeFile(join(fixture.projectRoot, "Source", "b.txt"), "beta\n", "utf8"),
      writeFile(join(fixture.projectRoot, "outside.txt"), "outside\n", "utf8"),
      writeFile(join(fixture.projectRoot, "docs", "project-design", "manifest.json"), `${JSON.stringify({
        scope: { root: ".", paths: ["Source"] },
        sourceRevision: { kind: "working-tree", files: {} },
        records: [],
        documents: []
      })}\n`, "utf8")
    ]);
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const request = { root: fixture.projectRoot, view: "details" as const, limit: 1 };
    const first = await api.detectDrift(request);
    repositoryReads = 0;
    await rename(join(fixture.projectRoot, "Source"), join(fixture.root, "Source-moved"));

    const second = await api.detectDrift({
      ...request,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    });

    expect(second.items).toEqual([{ kind: "new", path: "Source/b.txt" }]);
    expect(repositoryReads).toBe(0);
  });

  test("rejects a manifest-selected drift cursor replayed as an explicit dot request without repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-manifest-dot-replay-");
    await Promise.all([
      mkdir(join(fixture.projectRoot, "Source"), { recursive: true }),
      mkdir(join(fixture.projectRoot, "docs", "project-design"), { recursive: true })
    ]);
    await Promise.all([
      writeFile(join(fixture.projectRoot, "Source", "a.txt"), "alpha\n", "utf8"),
      writeFile(join(fixture.projectRoot, "Source", "b.txt"), "beta\n", "utf8"),
      writeFile(join(fixture.projectRoot, "docs", "project-design", "manifest.json"), `${JSON.stringify({
        scope: { root: ".", paths: ["Source"] },
        sourceRevision: { kind: "working-tree", files: {} },
        records: [],
        documents: []
      })}\n`, "utf8")
    ]);
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const first = await api.detectDrift({ root: fixture.projectRoot, view: "details", limit: 1 });
    repositoryReads = 0;

    const outcome = await api.detectDrift({
      root: fixture.projectRoot,
      path: ".",
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/cursor.*scope/iu);
    expect(repositoryReads).toBe(0);
  });

  test("rejects an explicit dot drift cursor replayed as an implicit manifest request without repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-dot-manifest-replay-");
    await Promise.all([
      writeFile(join(fixture.projectRoot, "a.txt"), "alpha\n", "utf8"),
      writeFile(join(fixture.projectRoot, "b.txt"), "beta\n", "utf8")
    ]);
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const first = await api.detectDrift({
      root: fixture.projectRoot,
      path: ".",
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1
    });
    await mkdir(join(fixture.projectRoot, "docs", "project-design"), { recursive: true });
    await writeFile(join(fixture.projectRoot, "docs", "project-design", "manifest.json"), `${JSON.stringify({
      scope: { root: ".", paths: ["Source"] },
      sourceRevision: { kind: "working-tree", files: {} },
      records: [],
      documents: []
    })}\n`, "utf8");
    repositoryReads = 0;

    const outcome = await api.detectDrift({
      root: fixture.projectRoot,
      view: "details",
      limit: 1,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/cursor.*scope/iu);
    expect(repositoryReads).toBe(0);
  });

  test("rejects a same-project drift cursor replayed under a different explicit path without repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-path-replay-");
    await Promise.all(["ScopeA", "ScopeB"].flatMap((scope) => ["a.txt", "b.txt"].map(async (file) => {
      const directory = join(fixture.projectRoot, scope);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, file), `${scope}-${file}\n`, "utf8");
    })));
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const first = await api.detectDrift({
      root: fixture.projectRoot,
      path: "ScopeA",
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1
    });
    repositoryReads = 0;

    const outcome = await api.detectDrift({
      root: fixture.projectRoot,
      path: "ScopeB",
      previousSnapshot: { files: {} },
      view: "details",
      limit: 1,
      cursor: (first.page as { nextCursor?: string }).nextCursor
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/cursor.*scope/iu);
    expect(repositoryReads).toBe(0);
  });

  test("rejects a same-project drift cursor replayed under a different pack scope without repository reads", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-drift-pack-replay-");
    await Promise.all(["PackA", "PackB"].flatMap((scope) => ["a.txt", "b.txt"].map(async (file) => {
      const directory = join(fixture.projectRoot, scope);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, file), `${scope}-${file}\n`, "utf8");
    })));
    let repositoryReads = 0;
    const api = createProjectDesignKeeper({
      cacheDirectory: fixture.cacheDirectory,
      scopeIo: {
        beforeRepositoryDiscovery: async () => { repositoryReads += 1; },
        beforeRepositoryContentRead: async () => { repositoryReads += 1; }
      }
    });
    const request = (path: string) => ({
      root: fixture.projectRoot,
      path: ".",
      pack: {
        scope: { root: ".", paths: [path] },
        sourceRevision: { kind: "working-tree", files: {} },
        records: []
      },
      view: "details" as const,
      limit: 1
    });
    const first = await api.detectDrift(request("PackA"));
    repositoryReads = 0;

    const outcome = await api.detectDrift({
      ...request("PackB"),
      cursor: (first.page as { nextCursor?: string }).nextCursor
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/cursor.*scope/iu);
    expect(repositoryReads).toBe(0);
  });
});

describe("validated v3 scope snapshots", () => {
  test("persists exact v3 shard bindings and returns a deeply immutable load", async () => {
    const fixture = await cacheFixture();
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const filesBytes = `${JSON.stringify(input.files[0])}\n`;
    const evidenceBytes = `${JSON.stringify(input.evidence[0])}\n`;
    const metadata = JSON.parse(await readFile(join(persisted.cacheRoot, "metadata.json"), "utf8")) as Record<string, unknown>;

    expect(metadata).toEqual({
      version: 3,
      createdAt: 1_000,
      expiresAt: 1_000 + sevenDaysMs,
      projectKey: scopeProjectKey(fixture.projectRoot),
      scopeKey: scopePathsKey(["."]),
      cursorScopeKey: scopeCursorKey(fixture.projectRoot, scopePathsKey(["."])),
      scopePaths: ["."],
      snapshotId: input.snapshotId,
      shards: {
        files: { path: "files.jsonl", bytes: Buffer.byteLength(filesBytes), hash: digest(filesBytes), count: 1 },
        evidence: { path: "evidence.jsonl", bytes: Buffer.byteLength(evidenceBytes), hash: digest(evidenceBytes), count: 1 }
      },
      totals: { files: 1, evidence: 1, omitted: 1 },
      candidateModules: input.candidateModules,
      omissions: input.omissions
    });

    const loaded = await (await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    });
    expect(loaded).toMatchObject({
      snapshotId: input.snapshotId,
      files: input.files,
      evidence: input.evidence,
      candidateModules: input.candidateModules,
      omissions: input.omissions,
      totals: { files: 1, evidence: 1, omitted: 1 }
    });
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.files)).toBe(true);
    expect(Object.isFrozen(loaded.files[0])).toBe(true);
    expect(() => (loaded.files as Array<Record<string, unknown>>).push({})).toThrow();
    expect(() => { (loaded.files[0] as Record<string, unknown>).path = "changed"; }).toThrow();
  });

  test("does not return loaded data when the use claim cannot be removed exactly", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-load-claim-cleanup-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const claimPath = join(dirname(persisted.cacheRoot), `.publish-${basename(persisted.cacheRoot)}`);
    let cleanupHookCalled = false;
    const hooks = {
      beforeUseClaimCleanup: async () => {
        cleanupHookCalled = true;
        await rename(claimPath, `${claimPath}.owned`);
        await writeFile(claimPath, "replacement", "utf8");
      }
    } as ScopeStoreIo & { beforeUseClaimCleanup: () => Promise<void> };

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, hooks)).rejects.toMatchObject(restartError("corrupt"));
    expect(cleanupHookCalled).toBe(true);
  });

  test("canonicalizes object insertion order for content-addressed snapshot IDs", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-canonical-id-");
    const base = persistedInput(fixture);
    const file = base.files[0]!;
    const content = {
      ...base,
      files: [{ size: file.size, path: file.path, lineCount: file.lineCount, fingerprint: file.fingerprint }]
    };
    const input = { ...content, snapshotId: scopeSnapshotIdForContent(content) };
    const persisted = await persistScopeIndex(input);

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    })).resolves.toMatchObject({ cacheRoot: persisted.cacheRoot, snapshotId: input.snapshotId });
  });

  test.each([
    ["length", async (root: string) => writeFile(join(root, "files.jsonl"), "{}\n", "utf8")],
    ["count", async (root: string) => {
      const path = join(root, "metadata.json");
      const metadata = JSON.parse(await readFile(path, "utf8")) as { shards: { files: { count: number } } };
      metadata.shards.files.count += 1;
      await writeFile(path, `${JSON.stringify(metadata)}\n`, "utf8");
    }],
    ["schema", async (root: string) => {
      const path = join(root, "files.jsonl");
      await writeFile(path, `${JSON.stringify({ path: "bad", fingerprint: "bad", size: -1, lineCount: -1 })}\n`, "utf8");
    }]
  ])("rejects %s corruption without returning partial snapshot data", async (_kind, corrupt) => {
    const fixture = await cacheFixture();
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    await corrupt(persisted.cacheRoot);

    const error = await (await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
  });

  test("rejects aggregate shard metadata before opening any data shard", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-aggregate-load-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const metadataPath = join(persisted.cacheRoot, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
      shards: { files: { bytes: number }; evidence: { bytes: number } };
    };
    metadata.shards.files.bytes = 140 * 1024 * 1024;
    metadata.shards.evidence.bytes = 140 * 1024 * 1024;
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    let dataShardReads = 0;

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, {
      beforeReadShard: async (path) => {
        if (path !== metadataPath) dataShardReads += 1;
      }
    })).rejects.toMatchObject(restartError("corrupt"));
    expect(dataShardReads).toBe(0);
  });

  test("classifies a partial snapshot with missing metadata as corrupt, not missing", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-partial-metadata-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    await rm(join(persisted.cacheRoot, "metadata.json"));

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    })).rejects.toMatchObject(restartError("corrupt"));
  });

  test("bounds metadata reads to the identity-checked stat length when the file grows", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-bounded-metadata-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const metadataPath = join(persisted.cacheRoot, "metadata.json");
    const originalBytes = (await lstat(metadataPath)).size;
    let grew = false;
    let readOperations = 0;
    let readBytes = 0;

    const error = await (await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, {
      afterBoundedFileStat: async (path) => {
        if (path !== metadataPath || grew) return;
        grew = true;
        await writeFile(path, Buffer.alloc(9 * 1024 * 1024), { flag: "a" });
      },
      onBoundedFileRead: async (path, bytes) => {
        if (path !== metadataPath) return;
        readOperations += 1;
        readBytes += bytes;
      }
    } as ScopeStoreIo).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
    expect(readOperations).toBeGreaterThan(0);
    expect(readBytes).toBe(originalBytes);
  });

  test("rejects candidate-module totals not derived from loaded file evidence", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-module-count-");
    const base = persistedInput(fixture);
    const candidateModules = [{ ...base.candidateModules![0]!, fileCount: 0, evidenceCount: 0 }];
    const content = { ...base, candidateModules };

    await expect(persistScopeIndex({
      ...content,
      snapshotId: scopeSnapshotIdForContent(content)
    })).rejects.toThrow(/candidate|module|count|evidence/i);
  });

  test("rejects Windows-equivalent aliases in immutable snapshot scope paths", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-path-alias-");
    const base = persistedInput(fixture);
    const content = { ...base, scopePaths: ["Source", "source"] };

    await expect(persistScopeIndex({
      ...content,
      snapshotId: scopeSnapshotIdForContent(content)
    })).rejects.toThrow(/scope path|alias|unique|duplicate/i);
  });

  test("authenticates access records outside immutable snapshot directories", async () => {
    const fixture = await cacheFixture();
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const store = await task7Store();
    await store.loadScopeIndex({
      options: input.options, projectRoot: input.projectRoot, scopePaths: input.scopePaths,
      snapshotId: input.snapshotId, now: 2_000
    });
    expect(await readdir(persisted.cacheRoot)).toEqual(["evidence.jsonl", "files.jsonl", "metadata.json"]);
    const accessPath = join(
      fixture.cacheDirectory,
      "indexes", "v3", "access",
      scopeProjectKey(fixture.projectRoot),
      scopeCursorKey(fixture.projectRoot, scopePathsKey(["."])),
      `${input.snapshotId.slice(7)}.json`
    );
    const access = JSON.parse(await readFile(accessPath, "utf8")) as Record<string, unknown>;
    expect(access).toMatchObject({ version: 1, snapshotId: input.snapshotId, accessedAt: 2_000, hmac: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await writeFile(accessPath, `${JSON.stringify({ ...access, accessedAt: 9_999 })}\n`, "utf8");

    const error = await store.loadScopeIndex({
      options: input.options, projectRoot: input.projectRoot, scopePaths: input.scopePaths,
      snapshotId: input.snapshotId, now: 3_000
    }).catch((failure: unknown) => failure);
    expect(error).toEqual(restartError("corrupt"));
  });

  test("rejects a same-byte shard identity swap even when the original path is restored", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-handle-race-");
    const input = persistedInput(fixture);
    await persistScopeIndex(input);
    const moved = join(fixture.root, "owned-files.jsonl");
    const replacement = join(fixture.root, "replacement-files.jsonl");
    let swapped = false;

    const error = await (await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, {
      afterShardIdentity: async (identity: SecurePathIdentity) => {
        if (basename(identity.path) !== "files.jsonl" || swapped) return;
        swapped = true;
        const bytes = await readFile(identity.path);
        await rename(identity.path, moved);
        await writeFile(identity.path, bytes);
      },
      beforeShardFinalIdentity: async (identity: SecurePathIdentity) => {
        if (basename(identity.path) !== "files.jsonl" || !swapped) return;
        await rename(identity.path, replacement);
        await rename(moved, identity.path);
      }
    } as ScopeStoreIo).catch((failure: unknown) => failure);

    expect(error).toEqual(restartError("corrupt"));
  });

  test("recovers an authenticated access update interrupted after durable fallback publication", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-interrupt-");
    const input = persistedInput(fixture);
    await persistScopeIndex(input);
    const store = await task7Store();
    const interrupted = await store.loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, {
      afterAccessPendingPublish: async () => { throw new Error("interrupted access update"); }
    } as ScopeStoreIo).catch((failure: unknown) => failure);
    expect(interrupted).toEqual(restartError("corrupt"));

    await expect(store.loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 3_000
    })).resolves.toMatchObject({ snapshotId: input.snapshotId });

    const accessDirectory = join(
      fixture.cacheDirectory, "indexes", "v3", "access", scopeProjectKey(fixture.projectRoot),
      scopeCursorKey(fixture.projectRoot, scopePathsKey(["."]))
    );
    const entries = await readdir(accessDirectory);
    expect(entries).toEqual([`${input.snapshotId.slice(7)}.json`]);
    expect(JSON.parse(await readFile(join(accessDirectory, entries[0]!), "utf8"))).toMatchObject({ accessedAt: 3_000 });
  });

  test("never moves authenticated LRU access time backwards", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-monotonic-");
    const input = persistedInput(fixture);
    await persistScopeIndex(input);
    const store = await task7Store();
    for (const now of [3_000, 2_000]) {
      await store.loadScopeIndex({
        options: input.options,
        projectRoot: input.projectRoot,
        scopePaths: input.scopePaths,
        snapshotId: input.snapshotId,
        now
      });
    }
    const accessDirectory = join(
      fixture.cacheDirectory, "indexes", "v3", "access", scopeProjectKey(fixture.projectRoot),
      scopeCursorKey(fixture.projectRoot, scopePathsKey(["."]))
    );
    const [entry] = await readdir(accessDirectory);
    expect(JSON.parse(await readFile(join(accessDirectory, entry!), "utf8"))).toMatchObject({ accessedAt: 3_000 });
  });

  test("rejects non-exact drift detail objects before publication", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-detail-schema-");
    const base = persistedInput(fixture);
    const driftSummary = {
      freshness: "stale" as const,
      counts: { new: 1, modified: 0, deleted: 0, invalidated: 0 },
      invalidatedRecordIds: [],
      relocationCandidates: [],
      archiveEligibleRecordIds: []
    };
    const details = [{ kind: "new", path: "Source/New.cpp", unexpected: true }];
    const content = { ...base, details, driftSummary };

    await expect(persistScopeIndex({
      ...content,
      snapshotId: scopeSnapshotIdForContent(content)
    })).rejects.toThrow(/detail|schema|unrecognized|exact/i);
  });

  test("rejects drift summary counts that do not match exact details", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-detail-count-");
    const base = persistedInput(fixture);
    const driftSummary = {
      freshness: "stale" as const,
      counts: { new: 0, modified: 0, deleted: 0, invalidated: 0 },
      invalidatedRecordIds: [],
      relocationCandidates: [],
      archiveEligibleRecordIds: []
    };
    const details = [{ kind: "new", path: "Source/New.cpp" }];
    const content = { ...base, details, driftSummary };

    await expect(persistScopeIndex({
      ...content,
      snapshotId: scopeSnapshotIdForContent(content)
    })).rejects.toThrow(/detail|count|summary/i);
  });
});

describe("deterministic secure scope eviction", () => {
  test("refreshes authenticated access for LRU and recreates an expired same-content snapshot", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-refresh-");
    const persisted = [];
    for (let index = 1; index <= 8; index += 1) {
      persisted.push(await persistScopeIndex(persistedInput(fixture, index, index * 1_000)));
    }
    const store = await task7Store();
    await store.loadScopeIndex({
      options: { cacheDirectory: fixture.cacheDirectory },
      projectRoot: fixture.projectRoot,
      scopePaths: ["."],
      snapshotId: persisted[0]!.snapshotId,
      now: 8_500
    });
    const ninth = await persistScopeIndex(persistedInput(fixture, 9, 9_000));
    expect(await exists(persisted[0]!.cacheRoot)).toBe(true);
    expect(await exists(persisted[1]!.cacheRoot)).toBe(false);
    expect(await exists(ninth.cacheRoot)).toBe(true);

    const expiredInput = persistedInput(fixture, 20, 10_000);
    const first = await persistScopeIndex(expiredInput);
    const recreated = await persistScopeIndex({
      ...expiredInput,
      options: { ...expiredInput.options, now: () => 10_000 + sevenDaysMs }
    });
    const recreatedMetadata = JSON.parse(await readFile(join(recreated.cacheRoot, "metadata.json"), "utf8")) as { createdAt: number };
    expect(first.createdAt).toBe(10_000);
    expect(recreated.createdAt).toBe(10_000 + sevenDaysMs);
    expect(recreatedMetadata.createdAt).toBe(10_000 + sevenDaysMs);
  }, 20_000);

  test("enforces eight snapshots per project scope by authenticated LRU", async () => {
    const fixture = await cacheFixture();
    const persisted: Awaited<ReturnType<typeof persistScopeIndex>>[] = [];
    for (let index = 1; index <= 8; index += 1) {
      persisted.push(await persistScopeIndex(persistedInput(fixture, index, index * 1_000)));
    }
    let checkedProspectiveHeadroom = false;
    persisted.push(await persistScopeIndex(persistedInput(fixture, 9, 9_000), {
      beforeBuild: async () => {
        checkedProspectiveHeadroom = true;
        expect(await exists(persisted[0]!.cacheRoot)).toBe(false);
      }
    }));

    expect(checkedProspectiveHeadroom).toBe(true);
    expect(await exists(persisted[0]!.cacheRoot)).toBe(false);
    await expect(Promise.all(persisted.slice(1).map((entry) => lstat(entry.cacheRoot)))).resolves.toHaveLength(8);
  }, 20_000);

  test("evicts expired snapshots and preserves an explicitly protected snapshot", async () => {
    const fixture = await cacheFixture();
    const expired = await persistScopeIndex(persistedInput(fixture, 1, 1_000));
    const protectedSnapshot = await persistScopeIndex(persistedInput(fixture, 2, 2_000));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const store = await task7Store();

    await store.pruneScopeIndexes(layout, protectedSnapshot.cacheRoot, {
      now: () => sevenDaysMs + 1_001,
      maxSnapshotsPerScope: 0
    });

    expect(await exists(expired.cacheRoot)).toBe(false);
    expect(await exists(protectedSnapshot.cacheRoot)).toBe(true);
  });

  test("applies project and global byte quotas with deterministic oldest-access eviction", async () => {
    const first = await cacheFixture("keeper-scope-cache-quota-");
    const secondProject = join(first.root, "project-two");
    await mkdir(secondProject);
    const firstA = await persistScopeIndex(persistedInput(first, 1, 1_000, "a".repeat(2_000)));
    const firstB = await persistScopeIndex(persistedInput(first, 2, 2_000, "b".repeat(2_000)));
    const secondInput = { ...persistedInput(first, 3, 3_000, "c".repeat(2_000)), projectRoot: secondProject };
    const second = await persistScopeIndex(secondInput);
    const layout = await prepareSecureCache({ cacheDirectory: first.cacheDirectory });
    const store = await task7Store();
    const firstAccessPath = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(first.projectRoot),
      firstA.cursorScopeKey,
      `${firstA.snapshotId.slice("sha256:".length)}.json`
    );
    const oneSnapshotBytes = await regularFileBytes(firstA.cacheRoot) + (await lstat(firstAccessPath)).size;

    await store.pruneScopeIndexes(layout, undefined, {
      now: () => 4_000,
      maxProjectBytes: oneSnapshotBytes + 128,
      maxGlobalBytes: oneSnapshotBytes * 2 + 256
    });

    expect(await exists(firstA.cacheRoot)).toBe(false);
    expect(await exists(firstB.cacheRoot)).toBe(true);
    expect(await exists(second.cacheRoot)).toBe(true);
  });

  test("accounts authenticated primary and pending access files in retained physical bytes", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-bytes-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    await expect(persistScopeIndex(input, {
      afterAccessPendingPublish: async () => { throw new Error("leave authenticated pending access"); }
    })).rejects.toThrow(/authenticated pending access/iu);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const accessDirectory = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey
    );
    expect((await readdir(accessDirectory)).sort()).toEqual([
      `${input.snapshotId.slice("sha256:".length)}.json`,
      `${input.snapshotId.slice("sha256:".length)}.json.pending`
    ]);
    const snapshotBytes = await regularFileBytes(persisted.cacheRoot);
    const accessBytes = await regularFileBytes(accessDirectory);

    const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 });

    expect(accessBytes).toBeGreaterThan(0);
    expect(outcome.retainedBytes).toBe(snapshotBytes + accessBytes);
  });

  test("rejects a same-inode access mutation before returning physical accounting", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-accounting-race-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const exactAccessPath = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey,
      `${input.snapshotId.slice("sha256:".length)}.json`
    );
    let mutated = false;

    const outcome = await (await task7Store()).pruneScopeIndexes(
      layout,
      undefined,
      { now: () => 2_000 },
      {
        beforeShardFinalIdentity: async (identity) => {
          if (mutated || identity.path !== exactAccessPath) return;
          mutated = true;
          await writeFile(identity.path, " ", { encoding: "utf8", flag: "a" });
        }
      }
    ).catch((failure: unknown) => failure);

    expect(mutated).toBe(true);
    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/access|cache file|identity|metadata|changed/iu);
  });

  test("serializes access replacement behind physical quota inventory", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-prune-race-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const store = await task7Store();
    const exactAccessPath = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey,
      `${input.snapshotId.slice("sha256:".length)}.json`
    );
    let releaseInventory!: () => void;
    const inventoryHeld = new Promise<void>((accept) => { releaseInventory = accept; });
    let inventoryPaused!: () => void;
    const inventoryReached = new Promise<void>((accept) => { inventoryPaused = accept; });
    let paused = false;
    const pruning = store.pruneScopeIndexes(layout, undefined, { now: () => 2_000 }, {
      afterBoundedFileStat: async (path) => {
        if (paused || path !== exactAccessPath) return;
        paused = true;
        inventoryPaused();
        await inventoryHeld;
      }
    });
    await inventoryReached;

    let releasePending!: () => void;
    const pendingHeld = new Promise<void>((accept) => { releasePending = accept; });
    let pendingPublished!: () => void;
    const pendingReached = new Promise<void>((accept) => { pendingPublished = accept; });
    let loadValidated!: () => void;
    const loadReady = new Promise<void>((accept) => { loadValidated = accept; });
    const loading = store.loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 3_000
    }, {
      afterLoadIdentity: async () => { loadValidated(); },
      afterAccessPendingPublish: async () => {
        pendingPublished();
        await pendingHeld;
      }
    });
    await loadReady;

    const whileInventoryHeld = await Promise.race([
      pendingReached.then(() => "published" as const),
      new Promise<"blocked">((accept) => setTimeout(() => accept("blocked"), 1_000))
    ]);
    releaseInventory();
    await pruning;
    await pendingReached;
    releasePending();
    await loading;

    expect(whileInventoryHeld).toBe("blocked");
  });

  test("reserves the authenticated access replacement peak before publishing pending", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-update-headroom-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const accessDirectory = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey
    );
    const primaryBytes = await regularFileBytes(accessDirectory);
    const snapshotBytes = await regularFileBytes(persisted.cacheRoot);
    const limits: PruneLimits = { now: () => 2_000 };
    let pendingPublished = false;
    const claimPath = join(dirname(persisted.cacheRoot), `.publish-${input.snapshotId.slice("sha256:".length)}`);
    const hooks = {
      afterLoadIdentity: async () => {
        const claimBytes = (await lstat(claimPath)).size;
        const justTooSmall = snapshotBytes + primaryBytes + claimBytes + primaryBytes + 4 * 1024 - 1;
        limits.maxProjectBytes = justTooSmall;
        limits.maxGlobalBytes = justTooSmall;
      },
      prospectivePruneLimits: () => limits,
      afterAccessPendingPublish: async () => { pendingPublished = true; }
    } as ScopeStoreIo & { prospectivePruneLimits: () => PruneLimits };

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, hooks)).rejects.toMatchObject(restartError("corrupt"));
    expect(pendingPublished).toBe(false);
    expect((await readdir(accessDirectory)).filter((name) => name.endsWith(".pending"))).toEqual([]);
  });

  test.each(["project", "global"] as const)(
    "includes stable access bytes when enforcing the %s physical quota",
    async (quota) => {
      const fixture = await cacheFixture(`keeper-scope-cache-${quota}-access-quota-`);
      const input = persistedInput(fixture);
      const persisted = await persistScopeIndex(input);
      const layout = await prepareSecureCache(input.options, fixture.projectRoot);
      const accessDirectory = join(
        layout.indexes,
        "v3",
        "access",
        scopeProjectKey(fixture.projectRoot),
        persisted.cursorScopeKey
      );
      const physicalBytes = await regularFileBytes(persisted.cacheRoot) + await regularFileBytes(accessDirectory);
      const limits = {
        now: () => 2_000,
        maxProjectBytes: quota === "project" ? physicalBytes - 1 : physicalBytes * 4,
        maxGlobalBytes: quota === "global" ? physicalBytes - 1 : physicalBytes * 4
      };

      const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, limits);

      expect(outcome.removed).toContain(persisted.cacheRoot);
      expect(outcome.retainedBytes).toBe(0);
      expect(await exists(persisted.cacheRoot)).toBe(false);
      expect(await readdir(accessDirectory)).toEqual([]);
    }
  );

  test("reserves the mandatory access sidecar and bounded Task-2 owner before building", async () => {
    const reference = await cacheFixture("keeper-scope-cache-access-reservation-reference-");
    const referenceInput = persistedInput(reference);
    const referencePersisted = await persistScopeIndex(referenceInput);
    const referenceLayout = await prepareSecureCache(referenceInput.options, reference.projectRoot);
    const referenceAccessDirectory = join(
      referenceLayout.indexes,
      "v3",
      "access",
      scopeProjectKey(reference.projectRoot),
      referencePersisted.cursorScopeKey
    );
    const snapshotBytes = await regularFileBytes(referencePersisted.cacheRoot);
    const accessBytes = await regularFileBytes(referenceAccessDirectory);

    const fixture = await cacheFixture("keeper-scope-cache-access-reservation-");
    const input = persistedInput(fixture);
    const prospectiveLimits: PruneLimits = { now: () => 1_000 };
    let beforeBuild = false;
    let claimBytes = 0;
    const hooks = {
      afterTargetClaim: async (claim: SecurePathIdentity) => {
        claimBytes = (await lstat(claim.path)).size;
        const justTooSmall = claimBytes + snapshotBytes + accessBytes + 4 * 1024 - 1;
        prospectiveLimits.maxProjectBytes = justTooSmall;
        prospectiveLimits.maxGlobalBytes = justTooSmall;
      },
      prospectivePruneLimits: () => prospectiveLimits,
      beforeBuild: async () => { beforeBuild = true; }
    } as ScopeStoreIo & { prospectivePruneLimits: () => PruneLimits };

    await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/prospective|headroom|quota/iu);
    expect(claimBytes).toBeGreaterThan(0);
    expect(beforeBuild).toBe(false);
  });

  test("sizes the prospective access record from the immutable snapshot clock", async () => {
    const reference = await cacheFixture("keeper-scope-cache-access-clock-reference-");
    const referenceBase = persistedInput(reference);
    const referenceInput = { ...referenceBase, options: { ...referenceBase.options, now: () => 9_999 } };
    const referencePersisted = await persistScopeIndex(referenceInput);
    const referenceLayout = await prepareSecureCache(referenceInput.options, reference.projectRoot);
    const referenceAccessDirectory = join(
      referenceLayout.indexes,
      "v3",
      "access",
      scopeProjectKey(reference.projectRoot),
      referencePersisted.cursorScopeKey
    );
    const snapshotBytes = await regularFileBytes(referencePersisted.cacheRoot);
    const accessBytes = await regularFileBytes(referenceAccessDirectory);

    const fixture = await cacheFixture("keeper-scope-cache-access-clock-");
    const base = persistedInput(fixture);
    let clockReads = 0;
    const input = {
      ...base,
      options: { ...base.options, now: () => clockReads++ === 0 ? 9_999 : 10_000 }
    };
    const prospectiveLimits: PruneLimits = { now: () => 9_999 };
    const hooks = {
      afterTargetClaim: async (claim: SecurePathIdentity) => {
        const exactPhysicalPeak = (await lstat(claim.path)).size + snapshotBytes + accessBytes + 4 * 1024;
        prospectiveLimits.maxProjectBytes = exactPhysicalPeak;
        prospectiveLimits.maxGlobalBytes = exactPhysicalPeak;
      },
      prospectivePruneLimits: () => prospectiveLimits
    } as ScopeStoreIo & { prospectivePruneLimits: () => PruneLimits };

    await expect(persistScopeIndex(input, hooks)).resolves.toMatchObject({ createdAt: 9_999 });
    expect(clockReads).toBe(1);
  });

  test("joins active snapshot claims with inventoried snapshots using linear bounded work", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-linear-claim-join-");
    const inputs = Array.from({ length: 6 }, (_, offset) =>
      persistedInputForScope(fixture, offset + 1, `Scope${offset + 1}`)
    );
    const persisted = [];
    for (const input of inputs) persisted.push(await persistScopeIndex(input));
    const layout = await prepareSecureCache(inputs[0]!.options, fixture.projectRoot);
    const claims = [];
    for (const entry of persisted) claims.push(await claimOwnedSnapshotDirectory(layout, entry.cacheRoot));
    let joinWork = 0;
    const hooks = {
      onInventoryJoinWork: () => { joinWork += 1; }
    } as ScopeStoreIo & { onInventoryJoinWork: () => void };

    try {
      await expect((await task7Store()).pruneScopeIndexes(
        layout,
        undefined,
        { now: () => 7_000 },
        hooks
      )).resolves.toMatchObject({ removed: [] });
      expect(joinWork).toBe(persisted.length * 3);
    } finally {
      await Promise.all(claims.map((claim) => safeRemoveOwnedPublicationClaim(layout, claim)));
    }
  }, 30_000);

  test("stops active-claim inventory joins at the deterministic deadline", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-claim-join-deadline-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const claim = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
    let clock = 0;
    const hooks = {
      inventoryNowMs: () => clock,
      onInventoryJoinWork: () => { clock = 30_000; }
    } as ScopeStoreIo & { inventoryNowMs: () => number; onInventoryJoinWork: () => void };

    try {
      await expect((await task7Store()).pruneScopeIndexes(
        layout,
        undefined,
        { now: () => 2_000 },
        hooks
      )).rejects.toThrow(/scope prune.*deadline/iu);
    } finally {
      await safeRemoveOwnedPublicationClaim(layout, claim);
    }
  });

  test("does not delete an active load, active builder, interrupted build, or raced replacement", async () => {
    const fixture = await cacheFixture();
    const store = await task7Store();
    const active = await persistScopeIndex(persistedInput(fixture, 1, 1_000));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    let releaseLoad!: () => void;
    const loadHeld = new Promise<void>((accept) => { releaseLoad = accept; });
    let loadIdentity: SecurePathIdentity | undefined;
    const loading = store.loadScopeIndex({
      options: { cacheDirectory: fixture.cacheDirectory }, projectRoot: fixture.projectRoot,
      scopePaths: ["."], snapshotId: active.snapshotId, now: 2_000
    }, {
      afterLoadIdentity: async (identity: SecurePathIdentity) => {
        loadIdentity = identity;
        await loadHeld;
      }
    } as ScopeStoreIo);
    while (!loadIdentity) await new Promise<void>((accept) => setTimeout(accept, 1));
    await store.pruneScopeIndexes(layout, undefined, { now: () => 3_000, maxSnapshotsPerScope: 0 });
    expect(await exists(active.cacheRoot)).toBe(true);
    releaseLoad();
    await expect(loading).resolves.toMatchObject({ snapshotId: active.snapshotId });

    let releaseBuild!: () => void;
    const buildHeld = new Promise<void>((accept) => { releaseBuild = accept; });
    let buildIdentity: SecurePathIdentity | undefined;
    const building = persistScopeIndex(persistedInput(fixture, 2, 4_000), {
      afterShardWrites: async (identity) => {
        buildIdentity = identity;
        await buildHeld;
      }
    });
    while (!buildIdentity) await new Promise<void>((accept) => setTimeout(accept, 1));
    const builderPrune = store.pruneScopeIndexes(layout, undefined, { now: () => 5_000 });
    await expect(Promise.race([
      builderPrune.then(() => "finished"),
      new Promise<"held">((accept) => setTimeout(() => accept("held"), 50))
    ])).resolves.toBe("held");
    expect(await exists(buildIdentity!.path)).toBe(true);
    releaseBuild();
    await expect(building).resolves.toMatchObject({ cacheRoot: expect.any(String) });
    await expect(builderPrune).resolves.toMatchObject({ removed: expect.any(Array) });

    await expect(persistScopeIndex(persistedInput(fixture, 3, 6_000), {
      afterShardWrites: async () => { throw new Error("interrupted build"); }
    })).rejects.toThrow(/interrupted build/i);
    const scopeParent = dirname((await persistScopeIndex(persistedInput(fixture, 4, 7_000))).cacheRoot);
    expect((await readdir(scopeParent)).filter((name) => name.startsWith(".build-"))).toEqual([]);

    const raced = await persistScopeIndex(persistedInput(fixture, 5, 8_000));
    const moved = `${raced.cacheRoot}.owned`;
    const marker = join(raced.cacheRoot, "replacement.txt");
    await store.pruneScopeIndexes(layout, undefined, { now: () => 9_000, maxSnapshotsPerScope: 0 }, {
      beforeEvict: async (identity: SecurePathIdentity) => {
        if (identity.path !== raced.cacheRoot) return;
        await rename(raced.cacheRoot, moved);
        await mkdir(raced.cacheRoot);
        await writeFile(marker, "replacement", "utf8");
      }
    } as ScopeStoreIo).catch(() => undefined);
    expect(await readFile(marker, "utf8")).toBe("replacement");
  }, 20_000);

  test("bounds snapshot use-claim churn even when every stale release is replaced", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-use-claim-churn-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const stale = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
    await markClaimAsExpiredAndDead(stale.path, persisted.cacheRoot);
    let clock = 0;
    let staleReleases = 0;

    await expect((await task7Store()).loadScopeIndex({
      options: input.options,
      projectRoot: input.projectRoot,
      scopePaths: input.scopePaths,
      snapshotId: input.snapshotId,
      now: 2_000
    }, {
      nowMs: () => clock,
      afterStaleClaimRelease: async () => {
        staleReleases += 1;
        const replacement = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
        await markClaimAsExpiredAndDead(replacement.path, persisted.cacheRoot);
        clock = 1_000_000;
      }
    })).rejects.toMatchObject(restartError("corrupt"));
    expect(staleReleases).toBe(1);
  });

  test("evicts the next deterministic candidate when the oldest snapshot is actively loaded", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-active-oldest-");
    const persisted = await Promise.all(Array.from({ length: 8 }, (_, offset) =>
      persistScopeIndex(persistedInput(fixture, offset + 1, (offset + 1) * 1_000))
    ));
    const store = await task7Store();
    let releaseLoad!: () => void;
    const held = new Promise<void>((accept) => { releaseLoad = accept; });
    let loadActive = false;
    const loading = store.loadScopeIndex({
      options: { cacheDirectory: fixture.cacheDirectory },
      projectRoot: fixture.projectRoot,
      scopePaths: ["."],
      snapshotId: persisted[0]!.snapshotId,
      now: 8_500
    }, {
      afterLoadIdentity: async () => {
        loadActive = true;
        await held;
      }
    });
    while (!loadActive) await new Promise<void>((accept) => setTimeout(accept, 1));

    try {
      const ninth = await persistScopeIndex(persistedInput(fixture, 9, 9_000));
      expect(await exists(persisted[0]!.cacheRoot)).toBe(true);
      expect(await exists(persisted[1]!.cacheRoot)).toBe(false);
      expect(await exists(ninth.cacheRoot)).toBe(true);
    } finally {
      releaseLoad();
      await loading;
    }
  }, 20_000);

  test("public prune falls through an active oldest snapshot to restore its scope quota", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-public-active-oldest-");
    const persisted = await Promise.all(Array.from({ length: 3 }, (_, offset) =>
      persistScopeIndex(persistedInput(fixture, offset + 1, (offset + 1) * 1_000))
    ));
    const store = await task7Store();
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    let releaseLoad!: () => void;
    const held = new Promise<void>((accept) => { releaseLoad = accept; });
    let loadActive = false;
    const loading = store.loadScopeIndex({
      options: { cacheDirectory: fixture.cacheDirectory },
      projectRoot: fixture.projectRoot,
      scopePaths: ["."],
      snapshotId: persisted[0]!.snapshotId,
      now: 3_500
    }, {
      afterLoadIdentity: async () => {
        loadActive = true;
        await held;
      }
    });
    while (!loadActive) await new Promise<void>((accept) => setTimeout(accept, 1));

    try {
      await store.pruneScopeIndexes(layout, undefined, { now: () => 4_000, maxSnapshotsPerScope: 2 });
      expect(await exists(persisted[0]!.cacheRoot)).toBe(true);
      expect(await exists(persisted[1]!.cacheRoot)).toBe(false);
      expect(await exists(persisted[2]!.cacheRoot)).toBe(true);
    } finally {
      releaseLoad();
      await loading;
    }
  }, 15_000);

  test("quota fallback never evicts an older snapshot from an unrelated scope", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-unrelated-fallback-");
    const unrelatedContent = { ...persistedInput(fixture, 99, 500), scopePaths: ["Unrelated"] };
    const unrelated = await persistScopeIndex({
      ...unrelatedContent,
      snapshotId: scopeSnapshotIdForContent(unrelatedContent)
    });
    const scoped = await Promise.all(Array.from({ length: 3 }, (_, offset) =>
      persistScopeIndex(persistedInput(fixture, offset + 1, (offset + 1) * 1_000))
    ));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);

    await (await task7Store()).pruneScopeIndexes(layout, undefined, {
      now: () => 4_000,
      maxSnapshotsPerScope: 2
    });

    expect(await exists(unrelated.cacheRoot)).toBe(true);
    expect(await exists(scoped[0]!.cacheRoot)).toBe(false);
    expect(await exists(scoped[1]!.cacheRoot)).toBe(true);
    expect(await exists(scoped[2]!.cacheRoot)).toBe(true);
  }, 15_000);

  test("refuses prospective publication when all eight retained snapshots are actively loaded", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-active-headroom-");
    const persisted = await Promise.all(Array.from({ length: 8 }, (_, offset) =>
      persistScopeIndex(persistedInput(fixture, offset + 1, (offset + 1) * 1_000))
    ));
    const store = await task7Store();
    let releaseLoads!: () => void;
    const held = new Promise<void>((accept) => { releaseLoads = accept; });
    let activeLoads = 0;
    const loads = persisted.map((entry) => store.loadScopeIndex({
      options: { cacheDirectory: fixture.cacheDirectory },
      projectRoot: fixture.projectRoot,
      scopePaths: ["."],
      snapshotId: entry.snapshotId,
      now: 9_000
    }, {
      afterLoadIdentity: async () => {
        activeLoads += 1;
        await held;
      }
    } as ScopeStoreIo));
    while (activeLoads < 8) await new Promise<void>((accept) => setTimeout(accept, 1));
    let buildStarted = false;

    await expect(persistScopeIndex(persistedInput(fixture, 9, 10_000), {
      beforeBuild: async () => { buildStarted = true; }
    })).rejects.toThrow(/prospective|headroom|quota/i);
    expect(buildStarted).toBe(false);

    releaseLoads();
    await expect(Promise.all(loads)).resolves.toHaveLength(8);
  }, 30_000);

  test.each(["project", "scope", "snapshot"] as const)(
    "fails closed on an unknown %s entry in the owned snapshot namespace",
    async (level) => {
      const fixture = await cacheFixture(`keeper-scope-cache-unknown-${level}-`);
      const input = persistedInput(fixture);
      await persistScopeIndex(input);
      const layout = await prepareSecureCache(input.options, fixture.projectRoot);
      const snapshots = join(layout.indexes, "v3", "snapshots");
      const projectKey = scopeProjectKey(fixture.projectRoot);
      const cursorScopeKey = scopeCursorKey(fixture.projectRoot, scopePathsKey(input.scopePaths));
      const unknown = level === "project"
        ? join(snapshots, "unknown-project")
        : level === "scope"
          ? join(snapshots, projectKey, "unknown-scope")
          : join(snapshots, projectKey, cursorScopeKey, "unknown-snapshot");
      await mkdir(unknown, { recursive: true });
      await writeFile(join(unknown, "payload.bin"), "unaccounted", "utf8");

      const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, {
        now: () => 2_000
      }).catch((failure: unknown) => failure);

      expect(outcome).toBeInstanceOf(Error);
      expect(String((outcome as Error).message)).toMatch(/unexpected|unknown|inventory/iu);
      expect(await exists(unknown)).toBe(true);
    }
  );

  test("fails closed on a noncanonical access publication artifact instead of excluding its bytes", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-artifact-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const accessDirectory = join(
      layout.indexes,
      "v3",
      "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey
    );
    const artifact = join(accessDirectory, `.claim-${"a".repeat(36)}.tmp`);
    await writeFile(artifact, Buffer.alloc(64 * 1024), { mode: 0o600 });

    const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, {
      now: () => 2_000
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/access|publication|artifact|unexpected/iu);
    expect(await exists(artifact)).toBe(true);
  });

  test.each(["release", "initialization"] as const)(
    "fails closed on an incomplete managed snapshot %s artifact instead of excluding its bytes",
    async (kind) => {
      const fixture = await cacheFixture(`keeper-scope-cache-snapshot-${kind}-artifact-`);
      const input = persistedInput(fixture);
      const persisted = await persistScopeIndex(input);
      const layout = await prepareSecureCache(input.options, fixture.projectRoot);
      const scopeDirectory = dirname(persisted.cacheRoot);
      const uuid = "12345678-1234-4123-8123-123456789abc";
      const nonce = "a".repeat(32);
      const snapshotName = input.snapshotId.slice("sha256:".length);
      const artifact = join(
        scopeDirectory,
        kind === "release" ? `.publish-${snapshotName}.release-${nonce}` : `.claim-${uuid}.tmp`
      );
      await writeFile(artifact, "{}\n", { encoding: "utf8", mode: 0o600 });

      const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, {
        now: () => 2_000
      }).catch((failure: unknown) => failure);

      expect(outcome).toBeInstanceOf(Error);
      expect(String((outcome as Error).message)).toMatch(/snapshot|publication|artifact|incomplete/iu);
      expect(await exists(artifact)).toBe(true);
    }
  );

  test("coordinates an active Task-2 snapshot claim release window without excluding its bytes", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-live-snapshot-release-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const claim = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
    let resumeRelease!: () => void;
    const held = new Promise<void>((accept) => { resumeRelease = accept; });
    let releaseVisible = false;
    const cleanup = safeRemoveOwnedPublicationClaim(layout, claim, {
      afterRename: async () => {
        releaseVisible = true;
        await held;
      }
    });
    while (!releaseVisible) await new Promise<void>((accept) => setTimeout(accept, 1));

    try {
      const outcome = await (await task7Store()).pruneScopeIndexes(layout, undefined, {
        now: () => 2_000
      }).catch((failure: unknown) => failure);
      expect(outcome).toBeInstanceOf(Error);
      expect(String((outcome as Error).message)).toMatch(/snapshot|publication|incomplete|retry/iu);
      expect((await readdir(dirname(persisted.cacheRoot))).some((name) =>
        name === `.publish-${input.snapshotId.slice("sha256:".length)}.release-${claim.owner.nonce}`
      )).toBe(true);
    } finally {
      resumeRelease();
      await cleanup;
    }

    await expect((await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 }))
      .resolves.toMatchObject({ retainedBytes: expect.any(Number) });
  });

  test("bounds a growing Task-2 claim owner before publishing its initialization artifact", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-growing-claim-init-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    let linkAttempted = false;

    const outcome = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot, {
      beforeClaimOwnerIdentityCapture: async (path) => {
        await writeFile(path, Buffer.alloc(64 * 1024, 0x20), { flag: "a" });
      },
      beforeClaimLink: async () => { linkAttempted = true; }
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/publication|claim|owner|byte|limit|changed/iu);
    expect(linkAttempted).toBe(false);
  });

  test("bounds a growing Task-2 release owner and retains the exact ambiguous artifact", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-growing-claim-release-");
    const input = persistedInput(fixture);
    const persisted = await persistScopeIndex(input);
    const layout = await prepareSecureCache(input.options, fixture.projectRoot);
    const claim = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
    let releasedPath: string | undefined;

    const outcome = await safeRemoveOwnedPublicationClaim(layout, claim, {
      afterRename: async (path) => {
        releasedPath = path;
        await writeFile(path, Buffer.alloc(64 * 1024, 0x20), { flag: "a" });
      }
    }).catch((failure: unknown) => failure);

    expect(outcome).toBeInstanceOf(Error);
    expect(String((outcome as Error).message)).toMatch(/publication|claim|owner|byte|limit|changed/iu);
    expect(releasedPath).toBeDefined();
    expect(await exists(releasedPath!)).toBe(true);
  });

  test("fails closed instead of dropping a corrupt physical snapshot from quota inventory", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-corrupt-inventory-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    await rm(join(persisted.cacheRoot, "evidence.jsonl"));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const store = await task7Store();

    await expect(store.pruneScopeIndexes(layout, undefined, {
      now: () => 2_000,
      maxSnapshotsPerScope: 0,
      maxProjectBytes: 0,
      maxGlobalBytes: 0
    })).rejects.toThrow(/cannot be safely inventoried|missing|corrupt/i);
    expect(await exists(persisted.cacheRoot)).toBe(true);
  });

  test("recovers a hidden build directory left by a killed builder before applying quotas", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-dead-build-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const abandoned = await createOwnedBuildDirectory(layout, dirname(persisted.cacheRoot));
    await writeFile(join(abandoned.path, "partial-shard"), Buffer.alloc(256 * 1024, 1));
    const store = await task7Store();

    await expect(store.pruneScopeIndexes(layout, persisted.cacheRoot, {
      now: () => 2_000,
      maxProjectBytes: 1024 * 1024,
      maxGlobalBytes: 1024 * 1024
    })).resolves.toMatchObject({ retainedBytes: expect.any(Number) });
    expect(await exists(abandoned.path)).toBe(false);
    expect(await exists(persisted.cacheRoot)).toBe(true);
  });

  test("removes authenticated access sidecars orphaned by a killed eviction", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-orphan-access-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    const accessDirectory = join(
      fixture.cacheDirectory,
      "indexes", "v3", "access",
      scopeProjectKey(fixture.projectRoot),
      persisted.cursorScopeKey
    );
    expect(await readdir(accessDirectory)).toHaveLength(1);
    await rm(persisted.cacheRoot, { recursive: true });
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const store = await task7Store();

    await expect(store.pruneScopeIndexes(layout, undefined, { now: () => 2_000 })).resolves.toMatchObject({
      removed: []
    });
    expect(await readdir(accessDirectory)).toEqual([]);
  });

  test("does not treat a live Task-2 access publication window as registry corruption", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-live-access-publish-");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const projectKey = scopeProjectKey(fixture.projectRoot);
    const cursorScopeKey = scopeCursorKey(fixture.projectRoot, scopePathsKey(["."]));
    const accessDirectory = join(fixture.cacheDirectory, "indexes", "v3", "access", projectKey, cursorScopeKey);
    await mkdir(accessDirectory, { recursive: true, mode: 0o700 });
    const target = join(accessDirectory, `${"a".repeat(64)}.json`);
    let release!: () => void;
    const held = new Promise<void>((accept) => { release = accept; });
    let claimed = false;
    let claimPath: string | undefined;
    const publishing = publishExclusiveFile(layout, target, "{}\n", {
      afterClaimAcquire: async (claim) => {
        claimPath = claim.path;
        claimed = true;
        await held;
      }
    });
    while (!claimed) await new Promise<void>((accept) => setTimeout(accept, 1));

    try {
      const claimBytes = (await lstat(claimPath!)).size;
      await expect((await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 }))
        .resolves.toEqual({ removed: [], retainedBytes: claimBytes });
    } finally {
      release();
      await publishing;
    }
  });

  test("restarts snapshot-claim accounting when its link count settles", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-snapshot-claim-settle-");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const first = await persistScopeIndex(persistedInput(fixture, 1));
    const next = persistedInput(fixture, 2);
    const target = join(dirname(first.cacheRoot), next.snapshotId.slice("sha256:".length));
    const owned = await claimOwnedSnapshotDirectory(layout, target);
    const transientLink = join(layout.locks, `.inventory-${basename(target)}.tmp`);
    await link(owned.path, transientLink);
    let released = false;
    let artifactCaptures = 0;

    try {
      await expect((await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 }, {
        afterPublicationArtifactStat: async (path) => {
          if (path !== owned.path) return;
          artifactCaptures += 1;
          if (released) return;
          released = true;
          await rm(transientLink);
        }
      })).resolves.toMatchObject({ removed: [] });
      expect(released).toBe(true);
      expect(artifactCaptures).toBeGreaterThanOrEqual(2);
    } finally {
      await rm(transientLink, { force: true });
      await safeRemoveOwnedPublicationClaim(layout, owned);
    }
  }, 30_000);

  test("admits a new snapshot-claim epoch only after inventory confirms an absent boundary", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-snapshot-claim-epoch-");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const first = await persistScopeIndex(persistedInput(fixture, 1));
    const next = persistedInput(fixture, 2);
    const target = join(dirname(first.cacheRoot), next.snapshotId.slice("sha256:".length));
    const original = await claimOwnedSnapshotDirectory(layout, target);
    const transientLink = join(layout.locks, `.inventory-${basename(target)}.tmp`);
    await link(original.path, transientLink);
    let artifactCaptures = 0;
    let originalRemoved = false;
    let replacement: Awaited<ReturnType<typeof claimOwnedSnapshotDirectory>> | undefined;

    try {
      await expect((await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 }, {
        afterPublicationArtifactStat: async (path) => {
          if (path !== original.path) return;
          artifactCaptures += 1;
          if (artifactCaptures === 1) await rm(transientLink);
          if (artifactCaptures === 2) {
            await safeRemoveOwnedPublicationClaim(layout, original);
            originalRemoved = true;
          }
        },
        afterInventorySettlementRestart: async (path, epochEnded) => {
          if (!epochEnded || path !== original.path || replacement) return;
          replacement = await claimOwnedSnapshotDirectory(layout, target);
        }
      })).resolves.toMatchObject({ removed: [] });
      expect(artifactCaptures).toBeGreaterThanOrEqual(3);
      expect(replacement).toBeDefined();
    } finally {
      await rm(transientLink, { force: true });
      if (!originalRemoved) await safeRemoveOwnedPublicationClaim(layout, original);
      if (replacement) await safeRemoveOwnedPublicationClaim(layout, replacement);
    }
  }, 30_000);

  test("restarts access-claim accounting when its link count settles", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-access-claim-settle-");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const projectKey = scopeProjectKey(fixture.projectRoot);
    const cursorScopeKey = scopeCursorKey(fixture.projectRoot, scopePathsKey(["."]));
    const accessDirectory = join(fixture.cacheDirectory, "indexes", "v3", "access", projectKey, cursorScopeKey);
    await mkdir(accessDirectory, { recursive: true, mode: 0o700 });
    const target = join(accessDirectory, `${"c".repeat(64)}.json`);
    const acquired = deferred<void>();
    const releasePublication = deferred<void>();
    let claimPath = "";
    const publishing = publishExclusiveFile(layout, target, "{}\n", {
      afterClaimAcquire: async (claim) => {
        claimPath = claim.path;
        acquired.resolve();
        await releasePublication.promise;
      }
    });
    await acquired.promise;
    const transientLink = join(layout.locks, `.inventory-${basename(target)}.tmp`);
    await link(claimPath, transientLink);
    let released = false;
    let artifactCaptures = 0;

    try {
      await expect((await task7Store()).pruneScopeIndexes(layout, undefined, { now: () => 2_000 }, {
        afterPublicationArtifactStat: async (path) => {
          if (path !== claimPath) return;
          artifactCaptures += 1;
          if (released) return;
          released = true;
          await rm(transientLink);
        }
      })).resolves.toMatchObject({ removed: [] });
      expect(released).toBe(true);
      expect(artifactCaptures).toBeGreaterThanOrEqual(2);
    } finally {
      await rm(transientLink, { force: true });
      releasePublication.resolve();
      await publishing.catch(() => undefined);
    }
  }, 30_000);

  test("rejects same-inode claim growth after artifact accounting instead of reading or undercounting it", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-growing-access-claim-");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const projectKey = scopeProjectKey(fixture.projectRoot);
    const cursorScopeKey = scopeCursorKey(fixture.projectRoot, scopePathsKey(["."]));
    const accessDirectory = join(fixture.cacheDirectory, "indexes", "v3", "access", projectKey, cursorScopeKey);
    await mkdir(accessDirectory, { recursive: true, mode: 0o700 });
    const target = join(accessDirectory, `${"b".repeat(64)}.json`);
    let release!: () => void;
    const held = new Promise<void>((accept) => { release = accept; });
    let claimed = false;
    const publishing = publishExclusiveFile(layout, target, "{}\n", {
      afterClaimAcquire: async () => {
        claimed = true;
        await held;
      }
    });
    while (!claimed) await new Promise<void>((accept) => setTimeout(accept, 1));
    let mutated = false;

    try {
      const hooks = {
        afterPublicationArtifactStat: async (path: string) => {
          if (mutated || basename(path) !== `.publish-${basename(target)}`) return;
          await writeFile(path, Buffer.alloc(1024, 0x20), { flag: "a" });
          mutated = true;
        }
      } as ScopeStoreIo & { afterPublicationArtifactStat: (path: string) => Promise<void> };
      const outcome = await (await task7Store()).pruneScopeIndexes(
        layout,
        undefined,
        { now: () => 2_000 },
        hooks
      ).catch((failure: unknown) => failure);

      expect(mutated).toBe(true);
      expect(outcome).toBeInstanceOf(Error);
      expect(String((outcome as Error).message)).toMatch(/publication|claim|artifact|identity|byte|size|changed/iu);
    } finally {
      release();
      await publishing.catch(() => undefined);
    }
  });

  test("publishes authenticated access before making a snapshot visible", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-missing-access-");
    const input = persistedInput(fixture);
    const snapshotId = input.snapshotId.slice("sha256:".length);
    const target = join(
      fixture.cacheDirectory,
      "indexes", "v3", "snapshots",
      scopeProjectKey(fixture.projectRoot),
      scopeCursorKey(fixture.projectRoot, scopePathsKey(input.scopePaths)),
      snapshotId
    );
    let hookCalled = false;
    const hooks = {
      afterInitialAccessPublish: async () => {
        hookCalled = true;
        expect(await exists(target)).toBe(false);
        throw new Error("interrupted before snapshot publication");
      }
    } as ScopeStoreIo & { afterInitialAccessPublish: (path: string) => Promise<void> };

    await expect(persistScopeIndex(input, hooks)).rejects.toThrow(/interrupted before snapshot publication/iu);
    expect(hookCalled).toBe(true);
    expect(await exists(target)).toBe(false);
  });

  test("does not re-authenticate missing access from an unrelated dead snapshot claim", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-dead-claim-missing-access-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    const accessDirectory = join(
      fixture.cacheDirectory, "indexes", "v3", "access", scopeProjectKey(fixture.projectRoot), persisted.cursorScopeKey
    );
    const [record] = await readdir(accessDirectory);
    await rm(join(accessDirectory, record!));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const deadClaim = await claimOwnedSnapshotDirectory(layout, persisted.cacheRoot);
    await markClaimAsExpiredAndDead(deadClaim.path, persisted.cacheRoot);

    await expect((await task7Store()).pruneScopeIndexes(layout, persisted.cacheRoot, { now: () => 2_000 }))
      .rejects.toThrow(/access|authentication|inventoried|publisher claim/iu);
    expect(await readdir(accessDirectory)).toEqual([]);
  });

  test("does not re-authenticate a snapshot whose access sidecar vanished without a dead publisher claim", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-unclaimed-missing-access-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    const accessDirectory = join(
      fixture.cacheDirectory, "indexes", "v3", "access", scopeProjectKey(fixture.projectRoot), persisted.cursorScopeKey
    );
    const [record] = await readdir(accessDirectory);
    await rm(join(accessDirectory, record!));
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);

    await expect((await task7Store()).pruneScopeIndexes(layout, persisted.cacheRoot, { now: () => 2_000 }))
      .rejects.toThrow(/access|authentication|inventoried|publisher claim/i);
    expect(await readdir(accessDirectory)).toEqual([]);
  });

  test("does not trust unauthenticated metadata to extend snapshot retention", async () => {
    const fixture = await cacheFixture("keeper-scope-cache-retention-binding-");
    const persisted = await persistScopeIndex(persistedInput(fixture));
    const metadataPath = join(persisted.cacheRoot, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as { createdAt: number; expiresAt: number };
    metadata.createdAt += sevenDaysMs;
    metadata.expiresAt += sevenDaysMs;
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    const layout = await prepareSecureCache({ cacheDirectory: fixture.cacheDirectory }, fixture.projectRoot);
    const store = await task7Store();

    await expect(store.pruneScopeIndexes(layout, undefined, {
      now: () => persisted.expiresAt + 1
    })).rejects.toThrow(/access|authentication|binding|inventoried/i);
    expect(await exists(persisted.cacheRoot)).toBe(true);
  });
});
