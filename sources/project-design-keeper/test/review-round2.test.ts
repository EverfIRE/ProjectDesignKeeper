import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createProjectFixture,
  removeProjectFixture,
  type ProjectFixture
} from "./fixtures.js";
import { createTrustedTestKeeper } from "./keeper.js";

type KeeperModule = typeof import("../src/index.js");
type Keeper = KeeperModule["projectDesignKeeper"];

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-review-round2-cache-"));
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true });
  fixture = undefined;
  cacheDirectory = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function cache(): string {
  if (!cacheDirectory) throw new Error("cache was not created");
  return cacheDirectory;
}

async function keeper(options: Record<string, unknown> = {}): Promise<Keeper> {
  return createTrustedTestKeeper({ cacheDirectory: cache(), ...options }) as Keeper;
}

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function ownedJson(extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", ...extra }, null, 2)}\n`;
}

function changesetPath(id: unknown): string {
  return join(cache(), "changesets", `${String(id)}.json`);
}

async function mutateChangeset(id: unknown, mutate: (value: Record<string, any>) => void): Promise<void> {
  const path = changesetPath(id);
  const value = JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
  mutate(value);
  await writeFile(path, JSON.stringify(value), "utf8");
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("project-level apply serialization", () => {
  test("keeps a second same-root apply outside precommit until the first apply releases the project lock", async () => {
    const firstPrecommit = deferred();
    const secondPrecommit = deferred();
    const releaseFirst = deferred();
    let precommitCount = 0;
    const api = await keeper({
      beforeCommit: async () => {
        precommitCount += 1;
        if (precommitCount === 1) {
          firstPrecommit.resolve();
          await releaseFirst.promise;
        } else if (precommitCount === 2) {
          secondPrecommit.resolve();
        }
      }
    });
    const path = ".agents/skills/project-design-context/concurrent.md";
    const [first, second] = await Promise.all([
      api.previewUpdate({ root: project().repository, path: ".gitignore", changes: [{ path, managedBlock: { recordId: "one", content: "one" } }] }),
      api.previewUpdate({ root: project().repository, path: ".gitignore", changes: [{ path, managedBlock: { recordId: "two", content: "two" } }] })
    ]);

    const firstApply = api.applyUpdate({ root: project().repository, changesetId: first.changesetId });
    await firstPrecommit.promise;
    const secondApply = api.applyUpdate({ root: project().repository, changesetId: second.changesetId });
    const secondReachedPrecommit = await Promise.race([
      secondPrecommit.promise.then(() => true),
      pause(1_500).then(() => false)
    ]);
    releaseFirst.resolve();
    const results = await Promise.allSettled([firstApply, secondApply]);

    expect(secondReachedPrecommit).toBe(false);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: expect.objectContaining({ message: expect.stringMatching(/stale/i) }) }
    ]);
  });

  test("does not block an apply for a different canonical project root", async () => {
    const secondProject = await createProjectFixture();
    const firstPrecommit = deferred();
    const releaseFirst = deferred();
    let blockedRoot = "";
    const api = await keeper({
      beforeCommit: async (root: string) => {
        if (root === project().repository && !blockedRoot) {
          blockedRoot = root;
          firstPrecommit.resolve();
          await releaseFirst.promise;
        }
      }
    });
    try {
      const first = await api.previewUpdate({
        root: project().repository,
        changes: [{ path: ".agents/skills/project-design-context/one.md", managedBlock: { recordId: "one", content: "one" } }]
      });
      const second = await api.previewUpdate({
        root: secondProject.repository,
        changes: [{ path: ".agents/skills/project-design-context/two.md", managedBlock: { recordId: "two", content: "two" } }]
      });
      const firstApply = api.applyUpdate({ root: project().repository, changesetId: first.changesetId });
      await firstPrecommit.promise;
      const secondApply = api.applyUpdate({ root: secondProject.repository, changesetId: second.changesetId });

      const secondProgress = await Promise.race([secondApply.then(() => "applied"), pause(1_500).then(() => "timeout")]);
      releaseFirst.resolve();
      await expect(Promise.all([firstApply, secondApply])).resolves.toEqual([
        expect.objectContaining({ applied: true }),
        expect.objectContaining({ applied: true })
      ]);
      expect(secondProgress).toBe("applied");
    } finally {
      releaseFirst.resolve();
      await removeProjectFixture(secondProject);
    }
  });
});

describe("pre-stage fault isolation", () => {
  test("leaves both targets unchanged when a later pre-stage hook fails", async () => {
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const firstTarget = join(directory, "first.json");
    const secondTarget = join(directory, "second.json");
    const firstBefore = ownedJson({ value: "first before" });
    const secondBefore = ownedJson({ value: "second before" });
    await mkdir(directory, { recursive: true });
    await writeFile(firstTarget, firstBefore, "utf8");
    await writeFile(secondTarget, secondBefore, "utf8");
    const api = await keeper({
      beforeStageWrite: async (_path: string, index: number) => {
        if (index === 1) throw new Error("forced second pre-stage failure");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/first.json", content: ownedJson({ value: "first committed" }) },
        { path: ".agents/skills/project-design-context/second.json", content: ownedJson({ value: "second committed" }) }
      ]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/forced second pre-stage failure/i);
    await expect(readFile(firstTarget, "utf8")).resolves.toBe(firstBefore);
    await expect(readFile(secondTarget, "utf8")).resolves.toBe(secondBefore);
    await expect(readdir(join(cache(), "snapshots"))).resolves.toHaveLength(1);
  });
});

describe("creation ownership", () => {
  test("rejects new manual Markdown, mixed Markdown, and unowned JSON content", async () => {
    const api = await keeper();
    const previews = await Promise.all([
      api.previewUpdate({ root: project().repository, changes: [{ path: ".agents/skills/project-design-context/manual.md", content: "# Manual\n" }] }),
      api.previewUpdate({ root: project().repository, changes: [{ path: ".agents/skills/project-design-context/mixed.md", content: `${block("mixed", "generated")}\nmanual\n` }] }),
      api.previewUpdate({ root: project().repository, changes: [{ path: ".agents/skills/project-design-context/unowned.json", content: "{}\n" }] })
    ]);

    for (const preview of previews) {
      expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/ownership|owned|managed/i)] });
    }
  });

  test("creates owned Markdown and JSON that remain updateable", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/owned.md", managedBlock: { recordId: "owned", content: "one" } },
        { path: ".agents/skills/project-design-context/owned.json", content: ownedJson({ value: 1 }) }
      ]
    });
    await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });

    const update = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/owned.md", managedBlock: { recordId: "owned", content: "two" } },
        { path: ".agents/skills/project-design-context/owned.json", content: ownedJson({ value: 2 }) }
      ]
    });
    expect(update).toMatchObject({ applicable: true, conflicts: [] });
  });

  test("rejects cached creation content whose ownership was removed after preview", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/cached.json", content: ownedJson({ value: 1 }) }]
    });
    await mutateChangeset(preview.changesetId, (stored) => { stored.changes[0].content = "{}\n"; });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });
});

describe("persisted changeset internal invariants", () => {
  test("rejects canonical Windows-key aliases that bypass preview grouping", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/Alias.md", managedBlock: { recordId: "one", content: "one" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => {
      stored.changes.push({ ...stored.changes[0], path: ".agents/skills/project-design-context/alias.md" });
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("rejects source-file aliases under Windows canonicalization", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/source-alias.md", managedBlock: { recordId: "one", content: "one" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => {
      stored.sourceFiles["Source/Game.ts"] = `sha256:${"a".repeat(64)}`;
      stored.sourceFiles["source/game.ts"] = `sha256:${"b".repeat(64)}`;
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("rejects a source scope rooted somewhere other than the changeset root", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/root.md", managedBlock: { recordId: "one", content: "one" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => { stored.sourceScope.root = project().nonGitDirectory; });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("rejects a cache entry whose expiry is not exactly thirty minutes after creation", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/expiry.md", managedBlock: { recordId: "one", content: "one" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => { stored.expiresAt = stored.createdAt + 30 * 60 * 1000 + 1; });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("rejects a cached delete for a target that did not exist at preview", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/delete.md", managedBlock: { recordId: "one", content: "one" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => {
      stored.changes[0] = { path: ".agents/skills/project-design-context/delete.md", delete: true, previousHash: null };
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });
});

interface PackRecord {
  id: string;
  statement: string;
  evidence: string[];
  [key: string]: unknown;
}

function record(id = "combat.damage", statement = "Damage is authoritative.", evidence = ["Source/game.ts:1"]): PackRecord {
  return {
    id,
    domain: "combat",
    scope: "damage",
    statement,
    evidence,
    impact: ["Network damage"],
    status: "declared",
    strength: "required",
    approval: "confirmed",
    confidence: "high"
  };
}

function pack(records: PackRecord[] = [record()], documents: Array<Record<string, unknown>> = [
  ...["index.md", "intent.md", "principles.md", "architecture.md", "conventions.md", "decisions.md", "open-questions.md", "evidence-map.md"]
    .map((name) => ({ id: name.replace(/\.md$/u, ""), path: `docs/project-design/${name}` })),
  { id: "overview", path: "docs/project-design/overview.md" }
]): Record<string, unknown> {
  return {
    managedBy: "project-design-keeper",
    schemaVersion: "1.0",
    scope: { root: ".", paths: ["Source"] },
    sourceRevision: { kind: "snapshot", files: { "Source/game.ts": hash("line one\nline two\n") } },
    documents,
    records
  };
}

async function writeValidationFiles(markdown: string): Promise<void> {
  await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
  await mkdir(join(project().repository, "Source"), { recursive: true });
  await writeFile(join(project().repository, "Source", "game.ts"), "line one\nline two\n", "utf8");
  for (const name of ["index.md", "intent.md", "principles.md", "architecture.md", "conventions.md", "decisions.md", "open-questions.md", "evidence-map.md"]) {
    await writeFile(join(project().repository, "docs", "project-design", name), "", "utf8");
  }
  await writeFile(join(project().repository, "docs", "project-design", "overview.md"), markdown, "utf8");
}

describe("repository-aware pack validation", () => {
  test("returns structured diagnostics for a valid mapped pack", async () => {
    await writeValidationFiles(`# Overview\n[Source](../../Source/game.ts)\n${block("combat.damage", "record")}`);
    const api = await keeper();

    await expect(api.validatePack({ root: project().repository, pack: pack() })).resolves.toMatchObject({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  test("reports missing documents and Markdown links that escape or do not exist", async () => {
    await writeValidationFiles(`[escape](../../../outside.txt)\n[missing](../../Source/missing.ts)\n${block("combat.damage", "record")}`);
    const api = await keeper();
    const result = await api.validatePack({
      root: project().repository,
      pack: pack([record()], [
        { id: "overview", path: "docs/project-design/overview.md" },
        { id: "missing", path: "docs/project-design/missing.md" }
      ])
    });

    expect(result).toMatchObject({ valid: false, warnings: expect.any(Array) });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "document_missing" }),
      expect.objectContaining({ code: "markdown_link_outside_root" }),
      expect.objectContaining({ code: "markdown_link_missing" })
    ]));
  });

  test("rejects document mappings that resolve through a junction outside the repository", async () => {
    const directory = join(project().repository, "docs", "project-design");
    const outside = join(project().root, "external-docs");
    await mkdir(directory, { recursive: true });
    await mkdir(outside);
    await writeFile(join(outside, "overview.md"), block("combat.damage", "record"), "utf8");
    await symlink(outside, join(directory, "external"), "junction");
    const api = await keeper();
    const result = await api.validatePack({
      root: project().repository,
      pack: pack([record("combat.damage", "Damage", [])], [{ id: "overview", path: "docs/project-design/external/overview.md" }])
    });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "document_outside_root" })
    ]));
  });

  test("reports a Windows-absolute Markdown file link instead of treating it as a URI scheme", async () => {
    await writeValidationFiles(`[absolute](C:/outside.txt)\n${block("combat.damage", "record")}`);
    const api = await keeper();
    const result = await api.validatePack({ root: project().repository, pack: pack() });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "markdown_link_outside_root" })
    ]));
  });

  test("reports orphan records and semantically duplicate statements under different IDs", async () => {
    const first = record("combat.one", "Damage   Is Authoritative!");
    const second = record("combat.two", "damage is authoritative");
    const orphan = record("combat.orphan", "Orphan statement");
    await writeValidationFiles(`${block("combat.one", "one")}\n${block("combat.two", "two")}`);
    const api = await keeper();
    const result = await api.validatePack({ root: project().repository, pack: pack([first, second, orphan]) });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "record_statement_duplicate" }),
      expect.objectContaining({ code: "record_orphan" })
    ]));
  });

  test("reports invalid evidence source paths and one-based lines", async () => {
    await writeValidationFiles(block("combat.damage", "record"));
    const api = await keeper();
    const result = await api.validatePack({
      root: project().repository,
      pack: pack([record("combat.damage", "Damage", ["../outside.txt:1", "Source/missing.ts:1", "Source/game.ts:99", "Source/game.ts:0"])])
    });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "evidence_path_invalid" }),
      expect.objectContaining({ code: "evidence_source_missing" }),
      expect.objectContaining({ code: "evidence_line_invalid" })
    ]));
  });

  test("returns a structured warning for a mapped record with no evidence", async () => {
    const noEvidence = { ...record("combat.damage", "Damage", []), strength: "informational", approval: "not-required" };
    await writeValidationFiles(block("combat.damage", "record"));
    const api = await keeper();
    const result = await api.validatePack({ root: project().repository, pack: pack([noEvidence]) });

    expect(result).toMatchObject({ valid: true, errors: [] });
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "record_evidence_empty", path: "records.0.evidence" })
    ]);
  });
});

describe("precommit path containment", () => {
  test("rejects a parent replaced by a junction after staging and before commit", async () => {
    const managedDirectory = join(project().repository, ".agents", "skills", "project-design-context");
    const parent = join(managedDirectory, "swap");
    const movedParent = join(managedDirectory, "swap-original");
    const outside = join(project().root, "outside-output");
    await mkdir(parent, { recursive: true });
    await mkdir(outside);
    const api = await keeper({
      beforeCommit: async () => {
        await rename(parent, movedParent);
        await symlink(outside, parent, "junction");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/swap/output.md", managedBlock: { recordId: "swap", content: "safe" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/symbolic|junction|managed root/i);
    await expect(readFile(join(outside, "output.md"), "utf8")).rejects.toThrow();
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
