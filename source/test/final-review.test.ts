import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

const execFile = promisify(execFileCallback);
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

function repositoryPath(path: string): string {
  return path.replaceAll("\\", "/");
}

async function commitFiles(...paths: string[]): Promise<void> {
  const root = project().repository;
  await execFile("git", ["-C", root, "add", "--", ...paths]);
  await execFile("git", ["-C", root, "commit", "-m", "review fixture"]);
}

function managedBlock(id: string, body: string): string {
  const hash = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  return `<!-- project-design-keeper:managed record-id="${id}" content-hash="${hash}" -->${body}<!-- /project-design-keeper:managed -->`;
}

function sourceRevision(path: string, content: string): Record<string, unknown> {
  return { files: { [path]: `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}` } };
}

function record(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "record.default",
    domain: "gameplay",
    scope: "project",
    statement: "Default evidence-backed statement",
    evidence: [],
    impact: ["Default downstream impact"],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    confidence: "high",
    ...overrides
  };
}

describe("final review canonical read APIs", () => {
  test("queryContext routes canonical records to their owning managed document", async () => {
    const source = join(project().repository, "Source", "Demo", "Private", "Garden.cpp");
    await mkdir(join(project().repository, "Source", "Demo", "Private"), { recursive: true });
    await writeFile(source, "Gravity garden contract\nUnrelated implementation detail\n", "utf8");
    await commitFiles("Source/Demo/Private/Garden.cpp");
    const sourcePath = repositoryPath(relative(project().repository, source));
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), JSON.stringify({
      managedBy: "project-design-keeper",
      schemaVersion: "1.0",
      sourceRevision: sourceRevision(sourcePath, "Gravity garden contract\nUnrelated implementation detail\n"),
      records: [
        record({
          id: "rule.garden-gravity",
          domain: "technical-architecture",
          scope: "module:garden",
          statement: "Garden gravity is a required module contract",
          evidence: [`${sourcePath}:1`],
          impact: ["Movement code must preserve the garden gravity contract"],
          status: "declared",
          strength: "required",
          approval: "confirmed",
          confidence: "high",
          supersedes: "rule.legacy-gravity",
          conflicts: ["Design intent and implementation radius differ"],
          openQuestions: ["Which radius is authoritative?"]
        }),
        record({
          id: "rule.legacy-gravity",
          scope: "module:legacy",
          statement: "Legacy gravity contract",
          evidence: [`${sourcePath}:2`],
          status: "superseded",
          supersededBy: "rule.garden-gravity"
        })
      ],
      documents: [
        { id: "document.architecture", path: "docs/project-design/architecture.md" },
        { id: "document.intent", path: "docs/project-design/intent.md" }
      ]
    }), "utf8");
    await writeFile(
      join(project().repository, "docs", "project-design", "architecture.md"),
      managedBlock("rule.garden-gravity", "# Garden architecture\n"),
      "utf8"
    );
    await writeFile(
      join(project().repository, "docs", "project-design", "intent.md"),
      managedBlock("rule.legacy-gravity", "# Legacy intent\n"),
      "utf8"
    );

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.context).toEqual([{ path: repositoryPath(relative(project().repository, source)), line: 1, text: "Gravity garden contract" }]);
    expect(result.records).toEqual([expect.objectContaining({ record: expect.objectContaining({
      id: "rule.garden-gravity",
      supersedes: "rule.legacy-gravity"
    }) })]);
    expect(result.documents).toEqual([{ id: "document.architecture", path: "docs/project-design/architecture.md" }]);
    expect(result.conflicts).toEqual(["Design intent and implementation radius differ"]);
    expect(result.openQuestions).toEqual(["Which radius is authoritative?"]);

    const legacy = await createProjectDesignKeeper().queryContext({ root: project().repository, modules: ["legacy"] });
    expect(legacy.records).toEqual([]);
    expect(legacy.withheld).toMatchObject({
      counts: { terminal: 1 },
      records: [expect.objectContaining({ id: "rule.legacy-gravity", reason: "terminal" })]
    });
  });

  test("queryContext requires a natural-language query and exact path/module selectors to match", async () => {
    const source = join(project().repository, "Source", "Garden.cpp");
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(source, "Garden movement contract\nUnrelated implementation detail\n", "utf8");
    await commitFiles("Source/Garden.cpp");
    const sourcePath = repositoryPath(relative(project().repository, source));
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    const gardenRecord = record({
      id: "rule.garden",
      scope: "module:garden",
      statement: "Garden locomotion preserves its authored acceleration contract",
      evidence: [`${sourcePath}:1`],
      impact: ["Movement tuning preserves the garden contract"]
    });
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), JSON.stringify({
      managedBy: "project-design-keeper",
      schemaVersion: "1.0",
      records: [gardenRecord],
      documents: []
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "Increase movement speed for the garden character",
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.records).toEqual([]);
    expect(result.context).toEqual([]);
  });

  test("queryContext rejects a traversal document even when its managed block owns the selected record", async () => {
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const outside = join(project().repository, "outside.md");
    await writeFile(outside, managedBlock("rule.traversal", "# Outside pack\n"), "utf8");
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), JSON.stringify({
      sourceRevision: sourceRevision(sourcePath, "Keeper evidence: moon-garden\n"),
      records: [record({ id: "rule.traversal", scope: "module:garden", evidence: [`${sourcePath}:1`] })],
      documents: [{ id: "document.traversal", path: "docs/project-design/../../outside.md" }]
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "rule.traversal" }) })]);
    expect(result.documents).toEqual([]);
  });

  test("queryContext rejects a managed document junction whose real target is outside the pack", async (context) => {
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const pack = join(project().repository, "docs", "project-design");
    const modules = join(pack, "modules");
    const outside = join(project().repository, "outside-pack");
    const outsideDocument = join(outside, "contract.md");
    const link = join(modules, "escape");
    await mkdir(modules, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(outsideDocument, managedBlock("rule.symlink", "# Outside pack junction target\n"), "utf8");
    try {
      await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    } catch {
      context.skip();
      return;
    }
    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      records: [record({ id: "rule.symlink", scope: "module:garden", evidence: [`${sourcePath}:1`] })],
      documents: [{ id: "document.symlink", path: "docs/project-design/modules/escape/contract.md" }]
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.documents).toEqual([]);
  });

  test("queryContext rejects unsafe documents from query and path fallbacks", async () => {
    const outside = join(project().repository, "fallback-outside.md");
    const unsafePath = "docs/project-design/../../fallback-outside.md";
    await writeFile(outside, managedBlock("rule.fallback", "# Fallback outside pack\n"), "utf8");
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), JSON.stringify({
      records: [],
      documents: [{ id: "document.unsafe-query", path: unsafePath }]
    }), "utf8");

    const [queryResult, pathResult] = await Promise.all([
      createProjectDesignKeeper().queryContext({ root: project().repository, query: "document.unsafe-query" }),
      createProjectDesignKeeper().queryContext({ root: project().repository, paths: [unsafePath] })
    ]);

    expect(queryResult.documents).toEqual([]);
    expect(pathResult.documents).toEqual([]);
  });

  test("queryContext routes a normal nested managed document", async () => {
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const pack = join(project().repository, "docs", "project-design");
    const modules = join(pack, "modules");
    await mkdir(modules, { recursive: true });
    await writeFile(join(modules, "garden.md"), managedBlock("rule.nested", "# Nested garden contract\n"), "utf8");
    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      sourceRevision: sourceRevision(sourcePath, "Keeper evidence: moon-garden\n"),
      records: [record({ id: "rule.nested", scope: "module:garden", evidence: [`${sourcePath}:1`] })],
      documents: [{ id: "document.nested", path: "docs/project-design/modules/garden.md" }]
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.documents).toEqual([{ id: "document.nested", path: "docs/project-design/modules/garden.md" }]);
  });

  test("queryContext reads ordinary canonical and legacy manifest files", async () => {
    const pack = join(project().repository, "docs", "project-design");
    await mkdir(pack, { recursive: true });
    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      sourceRevision: sourceRevision(".gitignore", "generated/\n"),
      records: [record({ id: "rule.canonical-manifest", statement: "ordinary-canonical-manifest-rule" })],
      documents: []
    }), "utf8");

    const canonical = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "ordinary-canonical-manifest-rule"
    });
    expect(canonical.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "rule.canonical-manifest" }) })]);

    await rm(join(pack, "manifest.json"));
    await writeFile(join(pack, "project-design-manifest.json"), JSON.stringify({
      sourceRevision: sourceRevision(".gitignore", "generated/\n"),
      records: [record({ id: "rule.legacy-manifest", statement: "ordinary-legacy-manifest-rule" })],
      documents: []
    }), "utf8");

    const legacy = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "ordinary-legacy-manifest-rule"
    });
    expect(legacy.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "rule.legacy-manifest" }) })]);
  });

  test("queryContext rejects an external file symlink used as the canonical manifest", async (context) => {
    const pack = join(project().repository, "docs", "project-design");
    const externalManifest = join(project().root, "external-manifest.json");
    await mkdir(pack, { recursive: true });
    await writeFile(externalManifest, JSON.stringify({
      records: [record({ id: "rule.external-file", statement: "external-file-symlink-rule" })],
      documents: []
    }), "utf8");
    try {
      await symlink(externalManifest, join(pack, "manifest.json"), "file");
    } catch {
      context.skip();
      return;
    }

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "external-file-symlink-rule"
    });

    expect(result.records).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("queryContext rejects a pack-external repository file symlink used as the canonical manifest", async (context) => {
    const pack = join(project().repository, "docs", "project-design");
    const outsidePackManifest = join(project().repository, "outside-pack-manifest.json");
    await mkdir(pack, { recursive: true });
    await writeFile(outsidePackManifest, JSON.stringify({
      records: [record({ id: "rule.outside-pack-file", statement: "outside-pack-file-symlink-rule" })],
      documents: []
    }), "utf8");
    try {
      await symlink(outsidePackManifest, join(pack, "manifest.json"), "file");
    } catch {
      context.skip();
      return;
    }

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "outside-pack-file-symlink-rule"
    });

    expect(result.records).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("queryContext does not fall back to legacy when canonical manifest is not an ordinary file", async () => {
    const pack = join(project().repository, "docs", "project-design");
    await mkdir(join(pack, "manifest.json"), { recursive: true });
    await writeFile(join(pack, "project-design-manifest.json"), JSON.stringify({
      records: [record({ id: "rule.masked-legacy", statement: "masked-legacy-directory-rule" })],
      documents: []
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "masked-legacy-directory-rule"
    });

    expect(result.records).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("queryContext does not fall back to legacy when canonical manifest is malformed", async () => {
    const pack = join(project().repository, "docs", "project-design");
    await mkdir(pack, { recursive: true });
    await writeFile(join(pack, "manifest.json"), "{ malformed canonical manifest", "utf8");
    await writeFile(join(pack, "project-design-manifest.json"), JSON.stringify({
      records: [record({ id: "rule.masked-malformed", statement: "masked-legacy-malformed-rule" })],
      documents: []
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      query: "masked-legacy-malformed-rule"
    });

    expect(result.records).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  test("queryContext rejects an external manifest behind a pack-root junction", async (context) => {
    const pack = join(project().repository, "docs", "project-design");
    const externalPack = join(project().root, "external-pack");
    await mkdir(externalPack, { recursive: true });
    await writeFile(join(externalPack, "manifest.json"), JSON.stringify({
      records: [record({ id: "rule.external", statement: "external-junction-rule" })],
      documents: []
    }), "utf8");
    try {
      await symlink(externalPack, pack, process.platform === "win32" ? "junction" : "dir");
    } catch {
      context.skip();
      return;
    }
    try {
      const api = createProjectDesignKeeper();
      const [result, scan] = await Promise.all([
        api.queryContext({ root: project().repository, query: "external-junction-rule" }),
        api.scanScope({ root: project().repository, view: "evidence" })
      ]);

      expect(result.records).toEqual([]);
      expect(result.documents).toEqual([]);
      expect(scan.items).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining("external-junction-rule") }));
    } finally {
      await rm(pack, { recursive: true, force: true });
    }
  });

  test("queryContext rejects the repository itself as a junction-backed pack root", async (context) => {
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const pack = join(project().repository, "docs", "project-design");
    await writeFile(join(project().repository, "outside.md"), managedBlock("rule.repo-root", "# Repository root document\n"), "utf8");
    await writeFile(join(project().repository, "manifest.json"), JSON.stringify({
      records: [record({ id: "rule.repo-root", scope: "module:garden", evidence: [`${sourcePath}:1`] })],
      documents: [{ id: "document.repo-root", path: "docs/project-design/outside.md" }]
    }), "utf8");
    try {
      await symlink(project().repository, pack, process.platform === "win32" ? "junction" : "dir");
    } catch {
      context.skip();
      return;
    }
    try {
      const result = await createProjectDesignKeeper().queryContext({
        root: project().repository,
        paths: [sourcePath],
        modules: ["garden"]
      });

      expect(result.records).toEqual([]);
      expect(result.documents).toEqual([]);
    } finally {
      await rm(pack, { recursive: true, force: true });
    }
  });

  test("queryContext rejects an NTFS alternate-data-stream document", async (context) => {
    if (process.platform !== "win32") {
      context.skip();
      return;
    }
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const pack = join(project().repository, "docs", "project-design");
    const carrier = join(pack, "carrier.md");
    const stream = `${carrier}:secret.md`;
    await mkdir(pack, { recursive: true });
    await writeFile(carrier, "Carrier\n", "utf8");
    try {
      await writeFile(stream, managedBlock("rule.ads", "# Hidden stream\n"), "utf8");
    } catch {
      context.skip();
      return;
    }
    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      records: [record({ id: "rule.ads", scope: "module:garden", evidence: [`${sourcePath}:1`] })],
      documents: [{ id: "document.ads", path: "docs/project-design/carrier.md:secret.md" }]
    }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({
      root: project().repository,
      paths: [sourcePath],
      modules: ["garden"]
    });

    expect(result.documents).toEqual([]);
  });

  test("queryContext rejects reserved and trailing-segment document spellings", async () => {
    const pack = join(project().repository, "docs", "project-design");
    const normalDirectory = join(pack, "normal");
    await mkdir(normalDirectory, { recursive: true });
    await writeFile(join(normalDirectory, "contract.md"), managedBlock("rule.syntax", "# Normal file behind unsafe spelling\n"), "utf8");
    const documents = [
      { id: "document.unsafe-syntax.con", path: "docs/project-design/con.md" },
      { id: "document.unsafe-syntax.aux", path: "docs/project-design/aux/contract.md" },
      { id: "document.unsafe-syntax.dot", path: "docs/project-design/normal./contract.md" },
      { id: "document.unsafe-syntax.space", path: "docs/project-design/normal /contract.md" }
    ];
    await writeFile(join(pack, "manifest.json"), JSON.stringify({ records: [], documents }), "utf8");

    const result = await createProjectDesignKeeper().queryContext({ root: project().repository, query: "document.unsafe-syntax" });

    expect(result.documents).toEqual([]);
  });

  test("searchEvidence applies singular canonical domain/status filters to exact record evidence only", async () => {
    const sourceA = join(project().repository, "Source", "Demo", "A.txt");
    const sourceB = join(project().repository, "Source", "Demo", "B.txt");
    await mkdir(join(project().repository, "Source", "Demo"), { recursive: true });
    await writeFile(sourceA, "shared-needle gameplay evidence\n", "utf8");
    await writeFile(sourceB, "shared-needle technical evidence\n", "utf8");
    await commitFiles("Source/Demo/A.txt", "Source/Demo/B.txt");
    const pathA = repositoryPath(relative(project().repository, sourceA));
    const pathB = repositoryPath(relative(project().repository, sourceB));
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), JSON.stringify({
      records: [
        record({ id: "rule.gameplay", domain: "gameplay", statement: "shared-needle gameplay rule", evidence: [`${pathA}:1`], status: "observed" }),
        record({ id: "rule.technical", domain: "technical", statement: "shared-needle technical rule", evidence: [`${pathB}:1`], status: "declared", approval: "confirmed" })
      ]
    }), "utf8");

    const result = await createProjectDesignKeeper().searchEvidence({
      root: project().repository,
      query: "shared-needle",
      domain: "gameplay",
      status: "observed"
    });

    expect(result.matches).toEqual([{ path: repositoryPath(relative(project().repository, sourceA)), line: 1, text: "shared-needle gameplay evidence" }]);
    expect(result.matches).not.toContainEqual(expect.objectContaining({ path: repositoryPath(relative(project().repository, sourceB)) }));
  });

  test("detectDrift associates deleted, modified, and line-invalid canonical evidence with record IDs", async () => {
    const modified = project().trackedText;
    const deleted = join(project().repository, "docs", "deleted-evidence.txt");
    await writeFile(deleted, "evidence that will be deleted\n", "utf8");
    await commitFiles("docs/deleted-evidence.txt");
    const before = await createProjectDesignKeeper().snapshot({ root: project().repository });
    const modifiedPath = repositoryPath(relative(project().repository, modified));
    const deletedPath = repositoryPath(relative(project().repository, deleted));
    await writeFile(modified, "Keeper evidence changed at the referenced line\n", "utf8");
    await rm(deleted);

    const result = await createProjectDesignKeeper().detectDrift({
      root: project().repository,
      previousSnapshot: before,
      pack: {
        records: [
          record({ id: "record.modified", evidence: [`${modifiedPath}:1`] }),
          record({ id: "record.deleted", evidence: [`${deletedPath}:1`] }),
          record({ id: "record.bad-line", evidence: [`${modifiedPath}:99`] })
        ]
      },
      view: "details"
    });

    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "modified-evidence", recordId: "record.modified", evidence: `${modifiedPath}:1` }),
      expect.objectContaining({ kind: "deleted-evidence", recordId: "record.deleted", evidence: `${deletedPath}:1` }),
      expect.objectContaining({ kind: "invalid-evidence", recordId: "record.bad-line", evidence: `${modifiedPath}:99` })
    ]));
  });

  test("detectDrift treats canonical manifest source paths as aliases of Windows scan paths", async () => {
    const before = await createProjectDesignKeeper().snapshot({ root: project().repository });
    const sourcePath = repositoryPath(relative(project().repository, project().trackedText));
    const canonicalFiles = Object.fromEntries(Object.entries(before.files).map(([path, fingerprint]) => [repositoryPath(path), fingerprint]));

    const result = await createProjectDesignKeeper().detectDrift({
      root: project().repository,
      pack: {
        sourceRevision: { kind: "git", files: canonicalFiles },
        records: [record({ id: "record.unchanged", evidence: [`${sourcePath}:1`] })]
      }
    });

    expect(result).toMatchObject({ freshness: "fresh", counts: { new: 0, modified: 0, deleted: 0, invalidated: 0 } });
  });
});

describe("final review preview and scan contracts", () => {
  test("previewUpdate returns one exact unified diff covering create, modify, and delete", async () => {
    const skillRoot = join(project().repository, ".agents", "skills", "project-design-context");
    const cache = join(project().root, "keeper cache");
    await mkdir(skillRoot, { recursive: true });
    const changedPath = join(skillRoot, "changed.json");
    const deletedPath = join(skillRoot, "deleted.md");
    await writeFile(changedPath, `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", value: "old" }, null, 2)}\n`, "utf8");
    await writeFile(deletedPath, managedBlock("record.deleted", "# Delete me\n"), "utf8");

    const preview = await createProjectDesignKeeper({ cacheDirectory: cache }).previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/created.json", content: `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", value: "created" }, null, 2)}\n` },
        { path: ".agents/skills/project-design-context/changed.json", content: `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", value: "new" }, null, 2)}\n` },
        { path: ".agents/skills/project-design-context/deleted.md", delete: true }
      ]
    });

    expect(preview).toMatchObject({ applicable: true, diff: expect.any(String) });
    const diff = String(preview.diff);
    expect(diff).toContain("--- /dev/null\n+++ b/.agents/skills/project-design-context/created.json\n@@ -0,0");
    expect(diff).toContain("--- a/.agents/skills/project-design-context/changed.json\n+++ b/.agents/skills/project-design-context/changed.json\n@@ -1,");
    expect(diff).toContain('-  "value": "old"');
    expect(diff).toContain('+  "value": "new"');
    expect(diff).toContain("--- a/.agents/skills/project-design-context/deleted.md\n+++ /dev/null\n@@ -1,");
    expect(diff).toContain("-<!-- project-design-keeper:managed");
  });

  test("scanScope returns deterministic candidate modules for common and Demo-shaped paths", async () => {
    const files = [
      ["Source/Demo/Private/Movement.cpp", "movement\ncontract\n"],
      ["Source/Demo/Public/Movement.h", "movement api\n"],
      ["packages/ui/src/index.ts", "export const ui = true;\n"]
    ] as const;
    for (const [path, contents] of files) {
      await mkdir(join(project().repository, ...path.split("/").slice(0, -1)), { recursive: true });
      await writeFile(join(project().repository, ...path.split("/")), contents, "utf8");
    }
    await commitFiles(...files.map(([path]) => path));

    const first = await createProjectDesignKeeper().scanScope({ root: project().repository });
    const second = await createProjectDesignKeeper().scanScope({ root: project().repository });

    expect(first.candidateModules).toEqual(second.candidateModules);
    expect(first.candidateModules).toEqual(expect.arrayContaining([
      { id: "packages.ui", paths: ["packages/ui"], fileCount: 1, evidenceCount: 1 },
      { id: "source.demo", paths: ["Source/Demo"], fileCount: 2, evidenceCount: 3 }
    ]));
    expect(first.candidateModules.map((module) => module.id)).toEqual([...first.candidateModules.map((module) => module.id)].sort());
  });
});
