import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { createCursorCodec } from "../src/security/cursor.js";
import { pageItems, scanLimit, scanView } from "../src/scope/pagination.js";

type Keeper = ReturnType<typeof import("../src/index.js").createProjectDesignKeeper>;

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

async function keeper(): Promise<Keeper> {
  const module = await import("../src/index.js");
  return module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/keeper-cache` });
}

describe("scope engine v2 contract", () => {
  test("pagination rejects malformed and out-of-range inputs while allowing a stable empty terminal page", async () => {
    const codec = await createCursorCodec({ cacheDirectory: `${project().root}/keeper-cache` });
    await expect(pageItems({
      items: [], limit: 10, codec, now: 1, expiresAt: 2, snapshotId: "snapshot", scopeKey: "scope", view: "files"
    })).resolves.toEqual({
      items: [],
      page: { limit: 10, complete: true }
    });
    await expect(pageItems({
      items: ["only"],
      limit: 1,
      codec,
      now: 1,
      expiresAt: 2,
      snapshotId: "snapshot",
      scopeKey: "scope",
      view: "files",
      cursor: codec.encode({
        version: 2, snapshotId: "snapshot", scopeKey: "scope", view: "files", offset: 2, issuedAt: 1, expiresAt: 2
      })
    })).rejects.toThrow(/offset/i);
    await expect(pageItems({
      items: ["only"], limit: 1, codec, now: 1, expiresAt: 2,
      snapshotId: "snapshot", scopeKey: "scope", view: "files", cursor: "tampered"
    })).rejects.toThrow(/cursor/i);
    expect(scanLimit(undefined)).toBe(200);
    expect(scanLimit(1000)).toBe(1000);
    expect(() => scanLimit(0)).toThrow(/limit/i);
    expect(scanView(undefined)).toBe("summary");
    expect(scanView("evidence")).toBe("evidence");
    expect(() => scanView("legacy")).toThrow(/view/i);
  });

  test("scanScope defaults to a bounded summary without legacy evidence arrays", async () => {
    const api = await keeper();

    const result = await api.scanScope({ root: project().repository });

    expect(result).toMatchObject({
      schemaVersion: 2,
      snapshotId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      scope: { root: project().repository, paths: ["."] },
      totals: { files: 2, evidence: 2, omitted: 1 },
      candidateModules: expect.any(Array)
    });
    expect(result).not.toHaveProperty("chunks");
    expect(result).not.toHaveProperty("evidence");
    expect(result).not.toHaveProperty("fingerprints");
  });

  test("scanScope pages evidence deterministically and rejects a cursor from another scope", async () => {
    const api = await keeper();

    const first = await api.scanScope({ root: project().repository, view: "evidence", limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.page).toMatchObject({ limit: 1, complete: false, nextCursor: expect.any(String) });

    const second = await api.scanScope({
      root: project().repository,
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    });
    expect(second.items).toHaveLength(1);
    expect(second.items).not.toEqual(first.items);
    expect(second.page).toEqual({ limit: 1, complete: true });

    await expect(api.scanScope({
      root: project().repository,
      path: "docs",
      view: "evidence",
      limit: 1,
      cursor: first.page?.nextCursor
    })).rejects.toThrow(/cursor/i);
  });

  test("scanScope includes an explicitly selected untracked text file", async () => {
    const api = await keeper();
    const untracked = `${project().repository}/Source/Untracked.cpp`;
    await mkdir(`${project().repository}/Source`, { recursive: true });
    await writeFile(untracked, "void UntrackedFeature() {}\n", "utf8");

    const result = await api.scanScope({ root: project().repository, path: "Source/Untracked.cpp", view: "files" });

    expect(result.items).toEqual([
      expect.objectContaining({
        path: "Source/Untracked.cpp",
        fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        lineCount: 1
      })
    ]);
  });

  test("uses paths relative to a supplied project root nested inside a parent Git repository", async () => {
    const api = await keeper();
    const nestedRoot = join(project().repository, "docs");

    const result = await api.scanScope({ root: nestedRoot, view: "files" });

    expect(result.items).toEqual([
      expect.objectContaining({ path: relative(nestedRoot, project().trackedText).replaceAll("\\", "/") })
    ]);
    expect(result.scope.paths).toEqual(["."]);
  });

  test("scanScope keeps every serialized evidence page below one MiB", async () => {
    const api = await keeper();
    const source = `${project().repository}/large-evidence.txt`;
    const line = "x".repeat(16 * 1024);
    await writeFile(source, `${Array.from({ length: 80 }, () => line).join("\n")}\n`, "utf8");

    const result = await api.scanScope({ root: project().repository, path: "large-evidence.txt", view: "evidence", limit: 1000 });

    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThanOrEqual(1024 * 1024);
    expect(result.page).toMatchObject({ complete: false, nextCursor: expect.any(String) });
  });

  test("queryContext applies natural-language and module selectors with AND semantics", async () => {
    const api = await keeper();
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    await mkdir(`${project().repository}/docs/project-design`, { recursive: true });
    await writeFile(`${project().repository}/docs/project-design/manifest.json`, JSON.stringify({
      records: [
        {
          id: "garden.moon", domain: "gameplay", scope: "module:garden",
          statement: "Moon navigation", evidence: [`${sourcePath}:1`], impact: [], status: "observed",
          strength: "informational", approval: "not-required", confidence: "high"
        },
        {
          id: "garden.sun", domain: "gameplay", scope: "module:garden",
          statement: "Sun navigation", evidence: [`${sourcePath}:1`], impact: [], status: "observed",
          strength: "informational", approval: "not-required", confidence: "high"
        }
      ],
      documents: []
    }), "utf8");

    const result = await api.queryContext({ root: project().repository, query: "Moon navigation", modules: ["garden"] });

    expect(result.records).toEqual([]);
    expect(result.withheld).toEqual({
      counts: { stale: 0, unverified: 1, terminal: 0 },
      records: [{ id: "garden.moon", reason: "unverified", reasons: [] }]
    });
  });

  test("detectDrift limits new and changed files to the pack scope", async () => {
    const api = await keeper();
    const scoped = `${project().repository}/Source/Scoped.cpp`;
    const unrelated = `${project().repository}/Plugins/VibeUE/Unrelated.cpp`;
    await mkdir(`${project().repository}/Source`, { recursive: true });
    await writeFile(scoped, "int Scoped = 1;\n", "utf8");
    const before = await api.snapshot({ root: project().repository, path: "Source" });
    await writeFile(scoped, "int Scoped = 2;\n", "utf8");
    await mkdir(`${project().repository}/Plugins/VibeUE`, { recursive: true });
    await writeFile(unrelated, "int Unrelated = 1;\n", "utf8");

    const result = await api.detectDrift({
      root: project().repository,
      pack: {
        scope: { root: ".", paths: ["Source"] },
        sourceRevision: { kind: "working-tree", files: before.files },
        records: []
      }
    });

    expect(result).toMatchObject({
      freshness: "stale",
      counts: { new: 0, modified: 1, deleted: 0, invalidated: 0 },
      invalidatedRecordIds: []
    });
    expect(result).not.toHaveProperty("changed");
    expect(result).not.toHaveProperty("new");
    expect(result).not.toHaveProperty("deleted");
  });

  test("detectDrift keeps an explicitly scoped untracked file present", async () => {
    const api = await keeper();
    const source = `${project().repository}/Source/Explicit.cpp`;
    await mkdir(`${project().repository}/Source`, { recursive: true });
    await writeFile(source, "int Explicit = 1;\n", "utf8");
    const before = await api.snapshot({ root: project().repository, path: "Source/Explicit.cpp" });

    const result = await api.detectDrift({
      root: project().repository,
      pack: {
        scope: { root: ".", paths: ["Source/Explicit.cpp"] },
        sourceRevision: { kind: "working-tree", files: before.files },
        records: []
      }
    });

    expect(result).toMatchObject({ freshness: "fresh", counts: { new: 0, modified: 0, deleted: 0, invalidated: 0 } });
  });

  test("queryContext withholds records with changed evidence and reports why", async () => {
    const api = await keeper();
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    const before = await api.snapshot({ root: project().repository, path: sourcePath });
    await mkdir(`${project().repository}/docs/project-design`, { recursive: true });
    await writeFile(`${project().repository}/docs/project-design/manifest.json`, JSON.stringify({
      schemaVersion: "1.0",
      scope: { root: ".", paths: [sourcePath] },
      sourceRevision: { kind: "git", files: before.files },
      records: [{
        id: "garden.moon", domain: "gameplay", scope: "module:garden", statement: "Moon navigation",
        evidence: [`${sourcePath}:1`], impact: [], status: "observed", strength: "informational",
        approval: "not-required", confidence: "high"
      }],
      documents: []
    }), "utf8");
    await writeFile(project().trackedText, "Keeper evidence changed: moon-garden\n", "utf8");

    const result = await api.queryContext({ root: project().repository, query: "Moon navigation" });

    expect(result.freshness).toMatchObject({
      status: "stale",
      comparedFiles: 1,
      changedFiles: [sourcePath],
      deletedFiles: [],
      invalidatedRecordIds: ["garden.moon"]
    });
    expect(result.records).toEqual([]);
    expect(result.withheld).toEqual({
      counts: { stale: 1, unverified: 0, terminal: 0 },
      records: [{ id: "garden.moon", reason: "stale", reasons: ["evidence-source-modified"] }]
    });
  });
});
