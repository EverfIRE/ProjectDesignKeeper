import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function hash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function writeHistoryPack(): Promise<void> {
  const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
  const directory = join(project().repository, "docs", "project-design");
  const archiveDirectory = join(directory, "archive");
  await mkdir(archiveDirectory, { recursive: true });
  await writeFile(project().trackedText, "changed source\n", "utf8");
  const record = (id: string, lifecycle: Record<string, unknown>) => ({
    id,
    kind: "decision",
    ownerDocument: "document.decisions",
    domain: "project-design",
    scope: "history",
    statement: `${id} historical statement`,
    evidence: [{ path: sourcePath, startLine: 1, role: "design", excerptHash: hash("old source") }],
    impact: ["history"],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    assertedConfidence: "high",
    lifecycle
  });
  const manifest = {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 2,
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash("old source\n") } },
    documents: [{ id: "document.decisions", path: "docs/project-design/decisions.md" }],
    records: [
      record("record.stale", { state: "active" }),
      record("record.terminal", { state: "terminal", reason: "superseded", sinceRevision: 1, confirmedRefreshes: 2, successorIds: [] })
    ],
    archive: {
      generations: [{
        id: "generation-000001",
        path: "docs/project-design/archive/generation-000001.records.jsonl",
        recordCount: 1,
        createdAt: "2026-08-15T00:00:00.000Z"
      }],
      tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 1 }
    },
    dedupeExceptions: []
  };
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const archivedRecord = record("record.archived", {
    state: "terminal",
    reason: "merged",
    sinceRevision: 1,
    confirmedRefreshes: 2,
    successorIds: ["record.stale"]
  });
  await writeFile(join(archiveDirectory, "generation-000001.records.jsonl"), `${JSON.stringify({
    record: archivedRecord,
    originalOwnerDocument: "document.decisions",
    managedBody: "Archived body",
    contentHash: hash("Archived body"),
    evidenceHash: hash(JSON.stringify(archivedRecord.evidence)),
    terminalReason: "merged",
    maintenanceRevision: 1,
    archivedAt: "2026-08-15T00:00:00.000Z"
  })}\n`, "utf8");
  await writeFile(join(archiveDirectory, "tombstones.jsonl"), `${JSON.stringify({
    id: "record.tombstone",
    reason: "resolved",
    successorIds: [],
    contentHash: hash("old tombstone"),
    archivedAt: "2026-08-14T00:00:00.000Z"
  })}\n`, "utf8");
}

describe("historical knowledge queries", () => {
  test("pages stale active, terminal, and archived records without tombstones by default", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper as unknown as {
      queryHistory(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    };

    const first = await api.queryHistory({ root: project().repository, limit: 2 });
    expect(first).toMatchObject({
      items: [
        { source: "active-stale", record: { id: "record.stale" } },
        { source: "active-terminal", record: { id: "record.terminal" } }
      ],
      page: { limit: 2, complete: false, nextCursor: expect.any(String) }
    });

    const second = await api.queryHistory({ root: project().repository, limit: 2, cursor: (first.page as Record<string, unknown>).nextCursor });
    expect(second).toMatchObject({
      items: [{ source: "archive", generationId: "generation-000001", record: { id: "record.archived" } }],
      page: { limit: 2, complete: true }
    });
    expect(JSON.stringify(first) + JSON.stringify(second)).not.toContain("record.tombstone");
  });

  test("includes permanent tombstones only when explicitly requested", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper as unknown as {
      queryHistory(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    };

    const result = await api.queryHistory({ root: project().repository, recordIds: ["record.tombstone"], includeTombstones: true });

    expect(result).toMatchObject({
      items: [{ source: "tombstone", tombstone: { id: "record.tombstone" } }],
      page: { complete: true }
    });
  });

  test("rejects a cursor reused with different filters", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper as unknown as {
      queryHistory(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    };
    const first = await api.queryHistory({ root: project().repository, limit: 1 });

    await expect(api.queryHistory({
      root: project().repository,
      query: "archived",
      limit: 1,
      cursor: (first.page as Record<string, unknown>).nextCursor
    })).rejects.toThrow(/cursor/i);
  });

  test("rejects a non-string cursor after validating the current history snapshot", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper;

    await expect(api.queryHistory({ root: project().repository, cursor: 0 }))
      .rejects.toThrow(/history cursor must be a string/i);
  });

  test("rejects a cursor whose offset is recomputed from public cursor data", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const first = await api.queryHistory({ root: project().repository, limit: 1 });
    const token = String((first.page as Record<string, unknown>).nextCursor);
    let forged: string;
    if (token.includes(".")) {
      const [body, signature] = token.split(".");
      const cursor = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
      cursor.offset = 2;
      forged = `${Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")}.${signature}`;
    } else {
      const envelope = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
        cursor: Record<string, unknown>;
        digest: string;
      };
      envelope.cursor.offset = 2;
      envelope.digest = hash(JSON.stringify(envelope.cursor));
      forged = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    }

    await expect(api.queryHistory({ root: project().repository, limit: 1, cursor: forged })).rejects.toThrow(/cursor|tampered/i);
  });

  test("rejects a cursor after a revision source changes between pages", async () => {
    await writeHistoryPack();
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const first = await api.queryHistory({ root: project().repository, limit: 1 });
    await writeFile(project().trackedText, "old source\n", "utf8");

    await expect(api.queryHistory({
      root: project().repository,
      limit: 1,
      cursor: (first.page as Record<string, unknown>).nextCursor
    })).rejects.toThrow(/cursor|snapshot/i);
  });

  test("keeps a history cursor valid after a service-module restart with the same cache", async () => {
    await writeHistoryPack();
    const cacheDirectory = join(project().root, "keeper-cache");
    const firstModule = await import("../src/index.js");
    const first = firstModule.createProjectDesignKeeper({ cacheDirectory });
    const page = await first.queryHistory({ root: project().repository, limit: 1 });
    const token = String((page.page as Record<string, unknown>).nextCursor);
    expect(JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString("utf8")))
      .toMatchObject({ version: 2, issuedAt: expect.any(Number), expiresAt: expect.any(Number) });

    vi.resetModules();
    const secondModule = await import("../src/index.js");
    const second = secondModule.createProjectDesignKeeper({ cacheDirectory });
    await expect(second.queryHistory({ root: project().repository, limit: 1, cursor: token }))
      .resolves.toMatchObject({ page: { complete: expect.any(Boolean) } });
  });

  test("rejects project-overlapping history caches before creating the cursor key", async () => {
    await writeHistoryPack();
    const { createProjectDesignKeeper } = await import("../src/index.js");
    for (const cacheDirectory of [project().repository, join(project().repository, ".keeper-cache")]) {
      const api = createProjectDesignKeeper({ cacheDirectory });
      await expect(api.queryHistory({ root: project().repository, limit: 1 }))
        .rejects.toThrow(/cache.*project.*disjoint/i);
      await expect(lstat(join(cacheDirectory, "cursor-hmac.key"))).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  test("validates history cursor clocks including the exact maximum boundary", async () => {
    await writeHistoryPack();
    const { createProjectDesignKeeper } = await import("../src/index.js");
    const cacheDirectory = join(project().root, "keeper-cache");
    const lifetime = 7 * 24 * 60 * 60 * 1000;
    const maximumIssuedAt = Number.MAX_SAFE_INTEGER - lifetime;
    for (const now of [-1, 1.5, maximumIssuedAt + 1]) {
      const api = createProjectDesignKeeper({ cacheDirectory, now: () => now });
      await expect(api.queryHistory({ root: project().repository, limit: 1 }))
        .rejects.toThrow(/cursor.*clock|cursor.*expiry|cursor.*time/i);
    }

    const api = createProjectDesignKeeper({ cacheDirectory, now: () => maximumIssuedAt });
    const first = await api.queryHistory({ root: project().repository, limit: 1 });
    const cursor = JSON.parse(Buffer.from(
      String((first.page as Record<string, unknown>).nextCursor).split(".")[0], "base64url"
    ).toString("utf8")) as Record<string, unknown>;
    expect(cursor).toMatchObject({ issuedAt: maximumIssuedAt, expiresAt: Number.MAX_SAFE_INTEGER });
  });

  test("tolerates an absent zero-count tombstone file and bounds oversized history records", async () => {
    await writeHistoryPack();
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const archive = manifest.archive as { tombstones: { count: number } };
    archive.tombstones.count = 0;
    const records = manifest.records as Array<Record<string, unknown>>;
    records[1].statement = "historical-detail-".repeat(100_000);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
    await rm(join(project().repository, "docs", "project-design", "archive", "tombstones.jsonl"));
    const api = (await import("../src/index.js")).projectDesignKeeper;

    const result = await api.queryHistory({
      root: project().repository,
      recordIds: ["record.terminal"],
      includeTombstones: true
    });

    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThanOrEqual(1024 * 1024);
    expect(result.items).toEqual([expect.objectContaining({ source: "active-terminal", truncated: true, originalBytes: expect.any(Number) })]);
  });

  test("rejects a tombstone with an unknown injected field", async () => {
    await writeHistoryPack();
    const tombstonePath = join(project().repository, "docs/project-design", "archive", "tombstones.jsonl");
    await writeFile(tombstonePath, `${JSON.stringify({
      id: "record.tombstone",
      reason: "resolved",
      successorIds: [],
      contentHash: hash("old tombstone"),
      archivedAt: "2026-08-14T00:00:00.000Z",
      injectedPayload: "x".repeat(2 * 1024 * 1024)
    })}\n`, "utf8");
    const api = (await import("../src/index.js")).projectDesignKeeper;

    await expect(api.queryHistory({
      root: project().repository,
      recordIds: ["record.tombstone"],
      includeTombstones: true
    })).rejects.toThrow(/tombstone.*invalid|limit/i);
  });

  test("rejects a UTF-8 BOM before parsing the canonical history manifest", async () => {
    await writeHistoryPack();
    const manifestPath = join(project().repository, "docs", "project-design", "manifest.json");
    const manifestBytes = await readFile(manifestPath);
    await writeFile(manifestPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), manifestBytes]));
    const api = (await import("../src/index.js")).projectDesignKeeper;

    await expect(api.queryHistory({ root: project().repository }))
      .rejects.toThrow(/history manifest is invalid.*UTF-8 BOM/i);
  });
});
