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

async function v2Pack(): Promise<Record<string, unknown>> {
  const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
  const source = await readFile(project().trackedText);
  const definitions = [
    ["intent", "intent.md"],
    ["principle", "principles.md"],
    ["architecture", "architecture.md"],
    ["convention", "conventions.md"],
    ["decision", "decisions.md"],
    ["tuning", "tuning.md"],
    ["verification", "verification.md"],
    ["open-question", "open-questions.md"]
  ] as const;
  const navigation = ["index.md", "evidence-map.md"] as const;
  const directory = join(project().repository, "docs", "project-design");
  await mkdir(directory, { recursive: true });
  const documents = [...navigation.map((name) => ({ id: `document.${name.replace(".md", "")}`, path: `docs/project-design/${name}` })),
    ...definitions.map(([, name]) => ({ id: `document.${name.replace(".md", "")}`, path: `docs/project-design/${name}` }))];
  for (const name of navigation) {
    const documentId = `document.${name.replace(".md", "")}`;
    await writeFile(join(directory, name), derived(documentId, `# ${name}\n`), "utf8");
  }
  const records = definitions.map(([kind, name], index) => {
    const id = `record.${kind}`;
    const ownerDocument = `document.${name.replace(".md", "")}`;
    return {
      id, kind, ownerDocument, domain: "project-design", scope: "project",
      statement: `V2 statement ${index + 1}`, evidence: [`${sourcePath}:1`], impact: [`V2 impact ${index + 1}`],
      status: "observed", strength: "informational", approval: "not-required", confidence: "high"
    };
  });
  for (const [index, [, name]] of definitions.entries()) {
    await writeFile(join(directory, name), block(records[index].id, `V2 ${index + 1}\n`), "utf8");
  }
  return {
    managedBy: "project-design-keeper",
    schemaVersion: "2.0",
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash(source) } },
    documents,
    records
  };
}

describe("knowledge pack schema 2.0", () => {
  test("validates records with one compatible owning document", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v2Pack();

    await expect(api.validatePack({ root: project().repository, pack })).resolves.toMatchObject({ valid: true, errors: [] });
  });

  test("rejects a v2 record without kind and ownerDocument", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v2Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    delete pack.records[0].kind;
    delete pack.records[0].ownerDocument;

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "record_kind_required" }),
      expect.objectContaining({ code: "record_owner_required" })
    ]));
  });

  test("rejects canonical records owned by navigation-only documents", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v2Pack() as { records: Array<Record<string, unknown>> } & Record<string, unknown>;
    pack.records[0].ownerDocument = "document.index";

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "record_owner_incompatible" }));
  });

  test("previews a derived navigation document without treating it as a knowledge record", async () => {
    const module = await import("../src/index.js");
    const pack = await v2Pack();
    const content = derived("document.index", "# Updated navigation\n");

    const result = await module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/cache` }).previewUpdate({
      root: project().repository,
      pack,
      changes: [
        { path: "docs/project-design/index.md", content },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` }
      ]
    });

    expect(result).toMatchObject({ applicable: true, conflicts: [] });
  });

  test("allows a fully owned v1 navigation record to migrate to a v2 derived document", async () => {
    const module = await import("../src/index.js");
    const pack = await v2Pack();
    await writeFile(
      join(project().repository, "docs", "project-design", "index.md"),
      block("legacy.index.summary", "# Legacy navigation\n"),
      "utf8"
    );

    const result = await module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/cache` }).previewUpdate({
      root: project().repository,
      pack,
      changes: [
        { path: "docs/project-design/index.md", content: derived("document.index", "# Derived navigation\n") },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` }
      ]
    });

    expect(result).toMatchObject({ applicable: true, conflicts: [], validation: { valid: true } });
    await expect(readFile(join(project().repository, "docs", "project-design", "index.md"), "utf8")).resolves.toContain("legacy.index.summary");
  });

  test("previews a complete v2 to v3 migration while preserving record IDs and capping inherited confidence", async () => {
    const module = await import("../src/index.js");
    const legacy = await v2Pack() as { documents: Array<Record<string, string>>; records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    const sourceLine = (await readFile(project().trackedText, "utf8")).split(/\r?\n/u)[0];
    await writeFile(
      join(project().repository, "docs/project-design/manifest.json"),
      `${JSON.stringify(legacy, null, 2)}\n`,
      "utf8"
    );
    const roleByKind: Record<string, string> = {
      intent: "design",
      principle: "design",
      decision: "design",
      tuning: "configuration",
      verification: "test",
      architecture: "implementation",
      convention: "implementation",
      "open-question": "design"
    };
    const records: Array<Record<string, unknown>> = legacy.records.map((record): Record<string, unknown> => ({
      ...record,
      evidence: [{ path: sourcePath, startLine: 1, role: roleByKind[String(record.kind)], excerptHash: hash(sourceLine) }],
      legacyEvidence: record.evidence,
      legacyStatus: record.status,
      assertedConfidence: record.confidence,
      lifecycle: { state: "active" },
      confidence: undefined
    })).map(({ confidence: _confidence, ...record }) => record);
    const candidate = {
      ...legacy,
      schemaVersion: "3.0",
      maintenanceRevision: 0,
      records,
      archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
      dedupeExceptions: []
    };
    const recordByOwner = new Map(records.map((record) => [String(record.ownerDocument), record]));
    const changes = [] as Array<Record<string, unknown>>;
    for (const document of legacy.documents) {
      const owner = recordByOwner.get(document.id);
      const body = owner
        ? `${derived(document.id, `# ${String(owner.kind)}\n`)}${await readFile(join(project().repository, ...document.path.split("/")), "utf8")}`
        : derived(document.id, `# ${document.id}\n`);
      changes.push({ path: document.path, content: body });
    }
    changes.push({ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate, null, 2)}\n` });

    const result = await module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/cache` }).previewUpdate({
      root: project().repository,
      pack: candidate,
      changes
    });

    if (!result.applicable) throw new Error(JSON.stringify(result, null, 2));
    expect(result).toMatchObject({ applicable: true, validation: { valid: true } });
    expect(records.map((record) => record.id)).toEqual(legacy.records.map((record) => record.id));
    expect((result.validation as Record<string, unknown>).recordAssessments).toContainEqual(expect.objectContaining({
      id: "record.architecture",
      effectiveConfidence: "medium"
    }));
    expect(JSON.parse(await readFile(join(project().repository, "docs/project-design/manifest.json"), "utf8"))).toMatchObject({ schemaVersion: "2.0" });
  });

  test("moves an unchanged legacy navigation record to its schema 3 owner without losing migration history", async () => {
    const module = await import("../src/index.js");
    const legacy = await v2Pack() as { documents: Array<Record<string, string>>; records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    const sourceLine = (await readFile(project().trackedText, "utf8")).split(/\r?\n/u)[0];
    const navigationBody = "# Legacy navigation conclusion\n";
    const navigationRecord = {
      id: "record.legacy-navigation", domain: "navigation", scope: "project",
      statement: "The old index restated an architectural conclusion.", evidence: [`${sourcePath}:1`],
      impact: ["The conclusion must survive migration without remaining in derived navigation."],
      status: "observed", strength: "informational", approval: "not-required", confidence: "medium"
    };
    legacy.records.push(navigationRecord);
    await writeFile(join(project().repository, "docs", "project-design", "index.md"), block(navigationRecord.id, navigationBody), "utf8");
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

    const records = legacy.records.map((record): Record<string, unknown> => ({
      ...record,
      ...(record.id === navigationRecord.id ? { kind: "architecture", ownerDocument: "document.architecture" } : {}),
      evidence: [{ path: sourcePath, startLine: 1, role: "implementation", excerptHash: hash(sourceLine) }],
      legacyEvidence: record.evidence,
      legacyStatus: record.status,
      assertedConfidence: record.confidence,
      lifecycle: record.id === navigationRecord.id
        ? { state: "terminal", reason: "merged", sinceRevision: 0, confirmedRefreshes: 0, successorIds: ["record.architecture"] }
        : { state: "active" },
      status: record.id === navigationRecord.id ? "superseded" : record.status,
      confidence: undefined
    })).map(({ confidence: _confidence, ...record }) => record);
    const candidate = {
      ...legacy,
      schemaVersion: "3.0",
      maintenanceRevision: 0,
      records,
      archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
      dedupeExceptions: []
    };
    const recordByOwner = new Map<string, Array<Record<string, unknown>>>();
    for (const record of records) {
      const owner = String(record.ownerDocument);
      recordByOwner.set(owner, [...(recordByOwner.get(owner) ?? []), record]);
    }
    const changes: Array<Record<string, unknown>> = [];
    for (const document of legacy.documents) {
      const bodies: string[] = [];
      for (const record of recordByOwner.get(document.id) ?? []) {
        if (record.id === navigationRecord.id) bodies.push(block(navigationRecord.id, navigationBody));
        else bodies.push(await readFile(join(project().repository, ...document.path.split("/")), "utf8"));
      }
      changes.push({ path: document.path, content: `${derived(document.id, `# ${document.id}\n`)}${bodies.join("")}` });
    }
    changes.push({ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate, null, 2)}\n` });

    const result = await module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/cache` }).previewUpdate({
      root: project().repository,
      pack: candidate,
      changes
    });

    expect(result).toMatchObject({ applicable: true, conflicts: [], validation: { valid: true } });
    expect(result.diff).toContain(navigationRecord.id);
    await expect(readFile(join(project().repository, "docs", "project-design", "index.md"), "utf8")).resolves.toContain(navigationRecord.id);
  });

  test("rejects a schema 3 migration that rewrites a managed body or drops legacy evidence history", async () => {
    const module = await import("../src/index.js");
    const legacy = await v2Pack() as { documents: Array<Record<string, string>>; records: Array<Record<string, unknown>> } & Record<string, unknown>;
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    const sourceLine = (await readFile(project().trackedText, "utf8")).split(/\r?\n/u)[0];
    legacy.records[1].status = "superseded";
    await writeFile(join(project().repository, "docs", "project-design", "manifest.json"), `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
    const records = legacy.records.map((record, index): Record<string, unknown> => ({
      ...record,
      evidence: [{ path: sourcePath, startLine: 1, role: "implementation", excerptHash: hash(sourceLine) }],
      ...(index === 0 ? {} : { legacyEvidence: record.evidence }),
      legacyStatus: record.status,
      assertedConfidence: record.confidence,
      lifecycle: { state: "active" },
      confidence: undefined
    })).map(({ confidence: _confidence, ...record }) => record);
    const candidate = {
      ...legacy,
      schemaVersion: "3.0",
      maintenanceRevision: 0,
      records,
      archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
      dedupeExceptions: []
    };
    const changes: Array<Record<string, unknown>> = [];
    for (const document of legacy.documents) {
      const existing = await readFile(join(project().repository, ...document.path.split("/")), "utf8");
      const navigation = document.path.endsWith("/index.md") || document.path.endsWith("/evidence-map.md");
      const body = navigation ? "" : document.id === "document.intent" ? block(String(records[0].id), "Rewritten during migration\n") : existing;
      changes.push({ path: document.path, content: `${derived(document.id, `# ${document.id}\n`)}${body}` });
    }
    changes.push({ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate, null, 2)}\n` });

    const result = await module.createProjectDesignKeeper({ cacheDirectory: `${project().root}/cache` }).previewUpdate({
      root: project().repository,
      pack: candidate,
      changes
    });

    expect(result).toMatchObject({ applicable: false, conflicts: ["Candidate pack validation failed"], validation: { valid: false } });
    expect((result.validation as { errors: Array<Record<string, unknown>> }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "migration_managed_body_changed" }),
      expect.objectContaining({ code: "migration_evidence_history_missing" }),
      expect.objectContaining({ code: "migration_terminal_lifecycle_invalid" })
    ]));
  });

  test("validatePack reports the same stale source revision used by queryContext", async () => {
    const api = (await import("../src/index.js")).projectDesignKeeper;
    const pack = await v2Pack();
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    await writeFile(project().trackedText, "changed after pack creation\n", "utf8");

    const result = await api.validatePack({ root: project().repository, pack });

    expect(result.freshness).toMatchObject({
      status: "stale",
      changedFiles: [sourcePath],
      deletedFiles: [],
      invalidatedRecordIds: expect.arrayContaining(["record.intent", "record.verification"])
    });
  });
});
