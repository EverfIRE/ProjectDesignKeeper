import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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

function hash(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function derived(documentId: string, content: string): string {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:derived -->`;
}

async function v3Pack(): Promise<Record<string, unknown>> {
  await writeFile(project().trackedText, "Architecture intent.\nexport const implemented = true;\n", "utf8");
  const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
  const source = await readFile(project().trackedText);
  const directory = join(project().repository, "docs", "project-design");
  await mkdir(directory, { recursive: true });
  const documentNames = [
    "index.md", "intent.md", "principles.md", "architecture.md", "conventions.md",
    "decisions.md", "tuning.md", "verification.md", "open-questions.md", "evidence-map.md"
  ] as const;
  const documents = documentNames.map((name) => ({
    id: `document.${name.replace(".md", "")}`,
    path: `docs/project-design/${name}`
  }));
  for (const document of documents) {
    const target = join(project().repository, ...document.path.split("/"));
    if (document.path.endsWith("index.md") || document.path.endsWith("evidence-map.md")) {
      await writeFile(target, derived(document.id, `# ${document.id}\n`), "utf8");
    } else if (document.path.endsWith("architecture.md")) {
      await writeFile(target, `${derived(document.id, "# Architecture\n")}${block("record.architecture", "Architecture record\n")}`, "utf8");
    } else {
      await writeFile(target, derived(document.id, "# Empty\n"), "utf8");
    }
  }
  return {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 1,
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash(source) } },
    documents,
    records: [{
      id: "record.architecture",
      kind: "architecture",
      ownerDocument: "document.architecture",
      domain: "project-design",
      scope: "project",
      statement: "The architecture intent is implemented.",
      evidence: [
        { path: sourcePath, startLine: 1, role: "design", excerptHash: hash("Architecture intent.") },
        { path: sourcePath, startLine: 2, role: "implementation", excerptHash: hash("export const implemented = true;") }
      ],
      impact: ["Runtime architecture"],
      status: "observed",
      strength: "informational",
      approval: "not-required",
      assertedConfidence: "high",
      lifecycle: { state: "active" }
    }],
    archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
    dedupeExceptions: []
  };
}

describe("knowledge pack schema 3.0", () => {
  test("validates typed evidence and computes a high evidence ceiling", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack();

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result).toMatchObject({
      valid: true,
      errors: [],
      recordAssessments: [{ id: "record.architecture", effectiveConfidence: "high", reasons: [] }]
    });
  });

  test("rejects legacy confidence and missing lifecycle metadata", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    pack.records[0].confidence = "high";
    delete pack.records[0].assertedConfidence;
    delete pack.records[0].lifecycle;

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "record_asserted_confidence_required" }),
      expect.objectContaining({ code: "record_lifecycle_required" }),
      expect.objectContaining({ code: "record_legacy_confidence_forbidden" })
    ]));
  });

  test("caps architecture confidence when implementation evidence is missing", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    pack.records[0].evidence = [(pack.records[0].evidence as unknown[])[0]];

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result).toMatchObject({
      valid: true,
      recordAssessments: [{
        id: "record.architecture",
        effectiveConfidence: "medium",
        reasons: ["high confidence requires both normative design and implementation evidence"]
      }]
    });
  });

  test("queryContext uses the same evidence ceiling and validatePack reports pending knowledge sync", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    pack.records[0].evidence = [(pack.records[0].evidence as unknown[])[0]];
    await writeFile(
      join(project().repository, "docs/project-design/manifest.json"),
      `${JSON.stringify(pack, null, 2)}\n`,
      "utf8"
    );

    const context = await api.queryContext({ root: project().repository, query: "architecture intent" });
    expect(context.records).toEqual([expect.objectContaining({
      effectiveConfidence: "medium",
      reasons: ["high confidence requires both normative design and implementation evidence"]
    })]);

    pack.pendingSync = true;
    const validation = await api.validatePack({ root: project().repository, pack });
    expect(validation.errors).toContainEqual(expect.objectContaining({ code: "pending_knowledge_sync" }));
  });

  test("withholds evidence that is not bound to the source revision", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const omittedPath = "Source/omitted-evidence.ts";
    await mkdir(join(project().repository, "Source"), { recursive: true });
    await writeFile(join(project().repository, ...omittedPath.split("/")), "Architecture intent.\n", "utf8");
    pack.records[0].evidence = [{
      path: omittedPath,
      startLine: 1,
      role: "design",
      excerptHash: hash("Architecture intent.")
    }];

    const validation = await api.validatePack({ root: project().repository, pack });
    expect(validation.errors).toContainEqual(expect.objectContaining({
      code: "evidence_source_revision_missing",
      path: "records.0.evidence.0.path"
    }));

    await writeFile(
      join(project().repository, "docs/project-design/manifest.json"),
      `${JSON.stringify(pack, null, 2)}\n`,
      "utf8"
    );
    const context = await api.queryContext({ root: project().repository, query: "architecture intent" });
    expect(context.records).toEqual([]);
    expect(context.withheld).toMatchObject({
      counts: { unverified: 1 },
      records: [{ id: "record.architecture", reason: "unverified", reasons: ["evidence-source-unrevisioned"] }]
    });
  });

  test("reports excerpt hash drift and proposes only a unique relocation", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const evidence = (pack.records[0].evidence as Array<Record<string, unknown>>)[0];
    evidence.startLine = 2;

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "evidence_excerpt_hash_mismatch" }));
    expect(result.relocationCandidates).toEqual([{
      recordId: "record.architecture",
      evidenceIndex: 0,
      path: expect.any(String),
      from: { startLine: 2 },
      to: { startLine: 1 }
    }]);
  });

  test("detects typed-evidence relocation and terminal archive eligibility", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    pack.records[0].lifecycle = {
      state: "terminal",
      reason: "superseded",
      sinceRevision: 1,
      confirmedRefreshes: 2,
      successorIds: []
    };
    await writeFile(project().trackedText, "Inserted line.\nArchitecture intent.\nexport const implemented = true;\n", "utf8");

    const result = await api.detectDrift({ root: project().repository, pack });

    expect(result).toMatchObject({
      freshness: "stale",
      archiveEligibleRecordIds: ["record.architecture"],
      relocationCandidates: [
        expect.objectContaining({
          recordId: "record.architecture",
          evidenceIndex: 0,
          from: { startLine: 1 },
          to: { startLine: 2 }
        }),
        expect.objectContaining({
          recordId: "record.architecture",
          evidenceIndex: 1,
          from: { startLine: 2 },
          to: { startLine: 3 }
        })
      ]
    });
  });

  test("retains broken historical links in terminal bodies while rejecting them for active knowledge", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v3Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const architecturePath = join(project().repository, "docs", "project-design", "architecture.md");
    await writeFile(
      architecturePath,
      `${derived("document.architecture", "# Architecture\n")}${block("record.architecture", "[Deleted historical design](../missing-design.md)\n")}`,
      "utf8"
    );
    pack.records[0].status = "superseded";
    pack.records[0].lifecycle = {
      state: "terminal",
      reason: "superseded",
      sinceRevision: 1,
      confirmedRefreshes: 1,
      successorIds: []
    };

    const terminal = await api.validatePack({ root: project().repository, pack });
    expect(terminal.errors).not.toContainEqual(expect.objectContaining({ code: "markdown_link_missing" }));

    pack.records[0].status = "observed";
    pack.records[0].lifecycle = { state: "active" };
    const active = await api.validatePack({ root: project().repository, pack });
    expect(active.errors).toContainEqual(expect.objectContaining({ code: "markdown_link_missing" }));
  });
});
