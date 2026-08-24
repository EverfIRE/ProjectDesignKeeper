import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { writeV3PackFixture } from "./canonical-pack-fixture.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { validateArchiveTransition } from "../src/knowledge/archive.js";
import { createTrustedTestKeeper } from "./keeper.js";

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

function derived(documentId: string, content: string): string {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:derived -->`;
}

describe("archive transactions", () => {
  test("rotates a third generation only when the oldest full history becomes immutable tombstones", async () => {
    const terminal = (id: string) => ({
      id,
      domain: "archive",
      scope: "history",
      statement: `Archived statement for ${id}`,
      evidence: [],
      impact: ["history"],
      status: "superseded",
      strength: "informational",
      approval: "not-required",
      assertedConfidence: "low",
      kind: "decision",
      ownerDocument: "document.decisions",
      lifecycle: { state: "terminal", reason: "merged", sinceRevision: 1, confirmedRefreshes: 2, successorIds: ["record.successor"] }
    });
    const entry = (id: string, maintenanceRevision: number, archivedAt: string) => {
      const record = terminal(id);
      const managedBody = `body:${id}`;
      return {
        record,
        originalOwnerDocument: record.ownerDocument,
        managedBody,
        contentHash: hash(managedBody),
        evidenceHash: hash(JSON.stringify(record.evidence)),
        terminalReason: record.lifecycle.reason,
        maintenanceRevision,
        archivedAt
      };
    };
    const generation = (number: number) => ({
      id: `generation-${String(number).padStart(6, "0")}`,
      path: `docs/project-design/archive/generation-${String(number).padStart(6, "0")}.records.jsonl`,
      recordCount: 1,
      createdAt: `2026-08-${String(10 + number).padStart(2, "0")}T00:00:00.000Z`
    });
    const first = generation(1);
    const second = generation(2);
    const third = generation(3);
    const currentPack = {
      schemaVersion: "3.0",
      maintenanceRevision: 2,
      records: [terminal("record.third")],
      documents: [{ id: "document.decisions", path: "docs/project-design/decisions.md" }],
      archive: { generations: [first, second], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
    };
    const expectedTombstone = {
      id: "record.first",
      reason: "merged",
      successorIds: ["record.successor"],
      contentHash: hash("body:record.first"),
      archivedAt: String(first.createdAt)
    };
    const candidatePack = {
      schemaVersion: "3.0",
      maintenanceRevision: 3,
      records: [],
      archive: { generations: [second, third], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 1 } }
    };
    const current = new Map<string, Buffer>([
      [String(first.path), Buffer.from(`${JSON.stringify(entry("record.first", 1, String(first.createdAt)))}\n`)],
      [String(second.path), Buffer.from(`${JSON.stringify(entry("record.second", 2, String(second.createdAt)))}\n`)],
      ["docs/project-design/decisions.md", Buffer.from(`<!-- project-design-keeper:managed record-id="record.third" content-hash="${hash("body:record.third")}" -->body:record.third<!-- /project-design-keeper:managed -->`)]
    ]);
    const candidate = new Map(current);
    candidate.set(String(third.path), Buffer.from(`${JSON.stringify(entry("record.third", 3, String(third.createdAt)))}\n`));
    candidate.set("docs/project-design/archive/tombstones.jsonl", Buffer.from(`${JSON.stringify(expectedTombstone)}\n`));

    await expect(validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    })).resolves.toEqual([]);

    candidate.set("docs/project-design/archive/tombstones.jsonl", Buffer.from(""));
    const rejected = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(rejected).toContainEqual(expect.objectContaining({ code: "archive_generation_not_tombstoned" }));

    const missing = new Map(current);
    missing.delete(String(first.path));
    const missingIssues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => missing.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(missingIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_source_missing" }));

    const malformed = new Map(current);
    malformed.set(String(first.path), Buffer.from("not-json\n"));
    const malformedIssues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => malformed.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(malformedIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_source_invalid" }));

    const truncated = new Map(current);
    truncated.set(String(first.path), Buffer.from(""));
    const truncatedIssues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => truncated.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(truncatedIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_record_count_mismatch" }));

    const incomplete = new Map(current);
    const incompleteEntry = entry("record.first", 1, String(first.createdAt));
    delete (incompleteEntry as Partial<typeof incompleteEntry>).evidenceHash;
    incomplete.set(String(first.path), Buffer.from(`${JSON.stringify(incompleteEntry)}\n`));
    candidate.set("docs/project-design/archive/tombstones.jsonl", Buffer.from(`${JSON.stringify(expectedTombstone)}\n`));
    const incompleteIssues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => incomplete.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(incompleteIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_entry_invalid" }));

    const legacyEvidence = new Map(current);
    const legacyEvidenceEntry = entry("record.first", 1, String(first.createdAt));
    legacyEvidenceEntry.record.evidence = ["Source/Legacy.cpp:1"] as never[];
    legacyEvidenceEntry.evidenceHash = hash(JSON.stringify(legacyEvidenceEntry.record.evidence));
    legacyEvidence.set(String(first.path), Buffer.from(`${JSON.stringify(legacyEvidenceEntry)}\n`));
    const legacyEvidenceIssues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => legacyEvidence.get(path),
      readCandidate: async (path) => candidate.get(path),
      now: () => Date.parse(String(third.createdAt))
    });
    expect(legacyEvidenceIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_entry_invalid" }));
  });

  test("rejects revision skips, archive rewrites, tombstone loss, lifecycle jumps, and unpreserved records", async () => {
    const generation = (number: number, createdAt = "2026-08-15T00:00:00.000Z") => ({
      id: `generation-${String(number).padStart(6, "0")}`,
      path: `docs/project-design/archive/generation-${String(number).padStart(6, "0")}.records.jsonl`,
      recordCount: 1,
      createdAt
    });
    const active = (id: string) => ({ id, lifecycle: { state: "active" } });
    const terminal = (id: string, confirmedRefreshes = 2) => ({
      id,
      lifecycle: { state: "terminal", reason: "merged", sinceRevision: 4, confirmedRefreshes, successorIds: ["record.successor"] }
    });
    const first = generation(1);
    const malformed = generation(0);
    const currentPack = {
      schemaVersion: "3.0",
      maintenanceRevision: 5,
      records: [
        active("record.new-terminal"),
        terminal("record.reactivated"),
        terminal("record.jumped"),
        active("record.removed"),
        active("record.ineligible-archive")
      ],
      archive: { generations: [malformed, first], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 1 } }
    };
    const candidatePack = {
      schemaVersion: "3.0",
      maintenanceRevision: 7,
      records: [
        terminal("record.new-terminal", 2),
        active("record.reactivated"),
        { ...terminal("record.jumped", 4), lifecycle: { state: "terminal", reason: "resolved", sinceRevision: 6, confirmedRefreshes: 4, successorIds: [] } }
      ],
      archive: {
        generations: [generation(2), generation(1, "2026-08-16T00:00:00.000Z"), generation(3)],
        tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 }
      }
    };
    const currentTombstone = { id: "record.old", reason: "merged", successorIds: [], contentHash: hash("old"), archivedAt: "2026-08-01T00:00:00.000Z" };
    const ineligibleEntry = {
      record: terminal("record.ineligible-archive"),
      contentHash: hash("body"),
      archivedAt: "2026-08-15T00:00:00.000Z"
    };
    const currentFiles = new Map<string, Buffer>([
      [String(malformed.path), Buffer.from("not-json\n")],
      ["docs/project-design/archive/tombstones.jsonl", Buffer.from(`${JSON.stringify(currentTombstone)}\n`)]
    ]);
    const candidateFiles = new Map<string, Buffer>([
      ["docs/project-design/archive/generation-000003.records.jsonl", Buffer.from(`${JSON.stringify(ineligibleEntry)}\n`)],
      ["docs/project-design/archive/tombstones.jsonl", Buffer.from("")]
    ]);

    const issues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => currentFiles.get(path),
      readCandidate: async (path) => candidateFiles.get(path)
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "maintenance_revision_transition_invalid",
      "archive_generation_order_invalid",
      "archive_generation_metadata_changed",
      "tombstone_history_removed",
      "terminal_refresh_transition_invalid",
      "terminal_record_reactivated",
      "terminal_history_changed",
      "archive_record_transition_ineligible",
      "active_record_history_removed"
    ]));
    await expect(validateArchiveTransition({
      currentPack: { schemaVersion: "2.0" },
      candidatePack,
      readCurrent: async () => undefined,
      readCandidate: async () => undefined
    })).resolves.toEqual([]);
    await expect(validateArchiveTransition({
      currentPack: { schemaVersion: "3.0", maintenanceRevision: 0, records: [], archive: { generations: [null] } },
      candidatePack: { schemaVersion: "3.0", maintenanceRevision: 1, records: [] },
      readCurrent: async () => undefined,
      readCandidate: async () => undefined
    })).resolves.toEqual([]);
  });

  test("rejects rewriting retained generation bytes and dropping a generation outside a two-to-three rotation", async () => {
    const generation = (number: number) => ({
      id: `generation-${String(number).padStart(6, "0")}`,
      path: `docs/project-design/archive/generation-${String(number).padStart(6, "0")}.records.jsonl`,
      recordCount: 1,
      createdAt: "2026-08-15T00:00:00.000Z"
    });
    const first = generation(1);
    const second = generation(2);
    const currentPack = {
      schemaVersion: "3.0",
      maintenanceRevision: 2,
      records: [],
      archive: { generations: [first, second], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
    };
    const current = new Map<string, Buffer>([
      [String(first.path), Buffer.from("old-first\n")],
      [String(second.path), Buffer.from("old-second\n")]
    ]);
    const rewritten = new Map(current);
    rewritten.set(String(second.path), Buffer.from("rewritten-second\n"));
    const retainedRewrite = await validateArchiveTransition({
      currentPack,
      candidatePack: { ...currentPack, maintenanceRevision: 3 },
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => rewritten.get(path)
    });
    expect(retainedRewrite).toContainEqual(expect.objectContaining({ code: "archive_generation_content_changed" }));

    const tombstone = {
      id: "record.first",
      reason: "merged",
      successorIds: [],
      contentHash: hash("first"),
      archivedAt: "2026-08-15T00:00:00.000Z"
    };
    const firstEntry = {
      record: { id: "record.first", lifecycle: { state: "terminal", reason: "merged", successorIds: [] } },
      contentHash: tombstone.contentHash,
      archivedAt: tombstone.archivedAt
    };
    current.set(String(first.path), Buffer.from(`${JSON.stringify(firstEntry)}\n`));
    const candidate = new Map(current);
    candidate.set("docs/project-design/archive/tombstones.jsonl", Buffer.from(`${JSON.stringify(tombstone)}\n`));
    const arbitraryDrop = await validateArchiveTransition({
      currentPack,
      candidatePack: {
        ...currentPack,
        maintenanceRevision: 3,
        archive: { generations: [second], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 1 } }
      },
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => candidate.get(path)
    });
    expect(arbitraryDrop).toContainEqual(expect.objectContaining({ code: "archive_rotation_invalid" }));

    const backfilled = generation(0);
    const backfillIssues = await validateArchiveTransition({
      currentPack: {
        ...currentPack,
        archive: { generations: [first], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      candidatePack: {
        ...currentPack,
        maintenanceRevision: 3,
        archive: { generations: [backfilled, first], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => path === backfilled.path ? Buffer.from("") : current.get(path)
    });
    expect(backfillIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_sequence_invalid" }));

    const future = { ...generation(2), createdAt: "2099-08-15T00:00:00.000Z" };
    const futureIssues = await validateArchiveTransition({
      currentPack: {
        ...currentPack,
        archive: { generations: [first], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      candidatePack: {
        ...currentPack,
        maintenanceRevision: 3,
        archive: { generations: [first, future], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => path === future.path ? Buffer.from("") : current.get(path),
      now: () => Date.parse("2026-08-15T08:00:00.000Z")
    });
    expect(futureIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_timestamp_invalid" }));

    const ancient = { ...generation(1), createdAt: "2000-01-01T00:00:00.000Z", recordCount: 0 };
    const ancientIssues = await validateArchiveTransition({
      currentPack: {
        schemaVersion: "3.0",
        maintenanceRevision: 1,
        records: [],
        archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      candidatePack: {
        schemaVersion: "3.0",
        maintenanceRevision: 2,
        records: [],
        archive: { generations: [ancient], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
      },
      readCurrent: async () => undefined,
      readCandidate: async (path) => path === ancient.path ? Buffer.from("") : undefined,
      now: () => Date.parse("2026-08-15T08:00:00.000Z")
    });
    expect(ancientIssues).toContainEqual(expect.objectContaining({ code: "archive_generation_timestamp_invalid" }));
  });

  test("rejects tombstones not derived from the generation rotated in the same changeset", async () => {
    const tombstonePath = "docs/project-design/archive/tombstones.jsonl";
    const invented = {
      id: "record.invented",
      reason: "resolved",
      successorIds: [],
      contentHash: hash("invented"),
      archivedAt: "2026-08-15T00:00:00.000Z"
    };
    const currentPack = {
      schemaVersion: "3.0",
      maintenanceRevision: 1,
      records: [],
      archive: { generations: [], tombstones: { path: tombstonePath, count: 0 } }
    };
    const candidatePack = {
      ...currentPack,
      maintenanceRevision: 2,
      archive: { generations: [], tombstones: { path: tombstonePath, count: 1 } }
    };
    const issues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async () => undefined,
      readCandidate: async (path) => path === tombstonePath ? Buffer.from(`${JSON.stringify(invented)}\n`) : undefined
    });
    expect(issues).toContainEqual(expect.objectContaining({ code: "tombstone_unexpected" }));
  });

  test("requires a new archive entry to preserve the exact terminal record and owning managed body", async () => {
    const currentRecord = {
      id: "record.archived",
      ownerDocument: "document.architecture",
      statement: "Original statement",
      lifecycle: { state: "terminal", reason: "superseded", sinceRevision: 1, confirmedRefreshes: 2, successorIds: [] }
    };
    const generation = {
      id: "generation-000001",
      path: "docs/project-design/archive/generation-000001.records.jsonl",
      recordCount: 1,
      createdAt: "2026-08-15T00:00:00.000Z"
    };
    const currentPack = {
      schemaVersion: "3.0",
      maintenanceRevision: 1,
      documents: [{ id: "document.architecture", path: "docs/project-design/architecture.md" }],
      records: [currentRecord],
      archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
    };
    const candidatePack = {
      ...currentPack,
      maintenanceRevision: 2,
      records: [],
      archive: { generations: [generation], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } }
    };
    const managedBody = "Original managed body\n";
    const entry = {
      record: { ...currentRecord, statement: "Rewritten during archive" },
      originalOwnerDocument: "document.architecture",
      managedBody: "Different managed body\n",
      contentHash: hash("Different managed body\n"),
      evidenceHash: hash("[]"),
      terminalReason: "superseded",
      maintenanceRevision: 0,
      archivedAt: "2026-08-15T01:00:00.000Z"
    };
    const current = new Map<string, Buffer>([[
      "docs/project-design/architecture.md",
      Buffer.from(`<!-- project-design-keeper:managed record-id="record.archived" content-hash="${hash(managedBody)}" -->${managedBody}<!-- /project-design-keeper:managed -->`)
    ]]);
    const candidate = new Map<string, Buffer>([[String(generation.path), Buffer.from(`${JSON.stringify(entry)}\n`)]]);

    const issues = await validateArchiveTransition({
      currentPack,
      candidatePack,
      readCurrent: async (path) => current.get(path),
      readCandidate: async (path) => candidate.get(path)
    });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "archive_record_content_changed" }),
      expect.objectContaining({ code: "archive_record_managed_body_changed" }),
      expect.objectContaining({ code: "archive_record_revision_invalid" }),
      expect.objectContaining({ code: "archive_record_timestamp_invalid" })
    ]));
  });

  test("atomically removes an eligible managed record and creates a validated JSONL generation", async () => {
    const archiveNow = Date.parse("2026-08-15T00:00:00.000Z");
    const approvals: Array<{ archiveActions?: unknown }> = [];
    const api = createTrustedTestKeeper({
      cacheDirectory: join(project().root, "keeper-cache"),
      now: () => archiveNow,
      trustedApprovalProvider: async (summary) => {
        approvals.push(summary);
        return { approved: true };
      }
    });
    const pack = await writeV3PackFixture(project()) as {
      maintenanceRevision: number;
      documents: Array<Record<string, unknown>>;
      records: Array<Record<string, unknown>>;
      archive: { generations: Array<Record<string, unknown>>; tombstones: Record<string, unknown> };
    } & Record<string, unknown>;
    const architectureRecord = pack.records.find((record) => record.id === "record.architecture")!;
    const archivedRecord: Record<string, unknown> = {
      ...architectureRecord,
      lifecycle: { state: "terminal", reason: "superseded", sinceRevision: 1, confirmedRefreshes: 2, successorIds: [] }
    };
    Object.assign(architectureRecord, archivedRecord);
    await writeFile(
      join(project().repository, "docs/project-design/manifest.json"),
      `${JSON.stringify(pack, null, 2)}\n`,
      "utf8"
    );
    const managedBody = "Record architecture\n";
    const entry = {
      record: archivedRecord,
      originalOwnerDocument: "document.architecture",
      managedBody,
      contentHash: hash(managedBody),
      evidenceHash: hash(JSON.stringify(archivedRecord.evidence)),
      terminalReason: "superseded",
      maintenanceRevision: 2,
      archivedAt: "2026-08-15T00:00:00.000Z"
    };
    const archivePath = "docs/project-design/archive/generation-000001.records.jsonl";
    const archiveIndexPath = "docs/project-design/archive/index.md";
    const archiveIndex = derived("document.archive-index", "# Archive\n\n- generation-000001\n");
    const candidatePack = {
      ...pack,
      maintenanceRevision: 2,
      documents: [...pack.documents, { id: "document.archive-index", path: archiveIndexPath }],
      records: pack.records.filter((record) => record.id !== "record.architecture"),
      archive: {
        ...pack.archive,
        generations: [{
          id: "generation-000001",
          path: archivePath,
          recordCount: 1,
          createdAt: "2026-08-15T00:00:00.000Z"
        }]
      }
    };

    const preview = await api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes: [
        { path: "docs/project-design/architecture.md", managedBlock: { recordId: "record.architecture", delete: true } },
        { path: archivePath, content: `${JSON.stringify(entry)}\n` },
        { path: archiveIndexPath, content: archiveIndex },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }
      ]
    });

    expect(preview).toMatchObject({ applicable: true, conflicts: [], validation: { valid: true } });
    const applied = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });
    expect(applied).toMatchObject({ applied: true });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].archiveActions).toEqual({
      archivedRecordIds: ["record.architecture"],
      tombstonedRecordIds: []
    });
    await expect(readFile(join(project().repository, archivePath), "utf8")).resolves.toContain("record.architecture");
    await expect(readFile(join(project().repository, "docs/project-design/architecture.md"), "utf8")).resolves.not.toContain("record.architecture");
    await expect(api.validatePack({ root: project().repository, pack: candidatePack })).resolves.toMatchObject({ valid: true, errors: [] });
    await expect(api.queryHistory({ root: project().repository, recordIds: ["record.architecture"] })).resolves.toMatchObject({
      items: [{ source: "archive", record: { id: "record.architecture" } }]
    });

    await writeFile(join(project().repository, archivePath), `${JSON.stringify({ ...entry, contentHash: hash("wrong body") })}\n`, "utf8");
    const invalidHash = await api.validatePack({ root: project().repository, pack: candidatePack });
    expect(invalidHash.errors).toContainEqual(expect.objectContaining({ code: "archive_record_content_hash_mismatch" }));

    await writeFile(join(project().repository, archivePath), "", "utf8");
    const corrupted = await api.validatePack({ root: project().repository, pack: candidatePack });
    expect(corrupted).toMatchObject({ valid: false });
    expect(corrupted.errors).toContainEqual(expect.objectContaining({ code: "archive_record_count_mismatch" }));

    await writeFile(join(project().repository, archivePath), `${JSON.stringify(entry)}\n`, "utf8");
    const tombstonePath = join(project().repository, "docs/project-design/archive/tombstones.jsonl");
    await writeFile(tombstonePath, `${JSON.stringify({
      id: "record.forged",
      reason: "resolved",
      successorIds: [],
      contentHash: hash("forged"),
      archivedAt: "2026-08-15T00:00:00.000Z",
      payload: "must not be retained"
    })}\n`, "utf8");
    const packWithStrictTombstone = {
      ...candidatePack,
      archive: { ...candidatePack.archive, tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 1 } }
    };
    const invalidTombstone = await api.validatePack({ root: project().repository, pack: packWithStrictTombstone });
    expect(invalidTombstone.errors).toContainEqual(expect.objectContaining({ code: "tombstone_invalid" }));
  });

  test("summarizes a generation rotation as both archive and tombstone record actions", async () => {
    const archiveNow = Date.parse("2026-08-15T00:00:00.000Z");
    const api = createTrustedTestKeeper({
      cacheDirectory: join(project().root, "keeper-cache"),
      now: () => archiveNow
    });
    const currentPack = await writeV3PackFixture(project()) as {
      maintenanceRevision: number;
      records: Array<Record<string, unknown>>;
      archive: { generations: Array<Record<string, unknown>>; tombstones: { path: string; count: number } };
    } & Record<string, unknown>;
    currentPack.maintenanceRevision = 3;
    const architecture = currentPack.records.find((record) => record.id === "record.architecture")!;
    architecture.lifecycle = {
      state: "terminal",
      reason: "superseded",
      sinceRevision: 1,
      confirmedRefreshes: 2,
      successorIds: []
    };
    const historicalRecord = (id: string): Record<string, unknown> => ({
      ...structuredClone(architecture),
      id,
      statement: `Historical ${id}`
    });
    const archiveEntry = (
      record: Record<string, unknown>,
      managedBody: string,
      maintenanceRevision: number,
      archivedAt: string
    ) => ({
      record,
      originalOwnerDocument: record.ownerDocument,
      managedBody,
      contentHash: hash(managedBody),
      evidenceHash: hash(JSON.stringify(record.evidence)),
      terminalReason: (record.lifecycle as Record<string, unknown>).reason,
      maintenanceRevision,
      archivedAt
    });
    const first = {
      id: "generation-000001",
      path: "docs/project-design/archive/generation-000001.records.jsonl",
      recordCount: 1,
      createdAt: "2026-08-13T00:00:00.000Z"
    };
    const second = {
      id: "generation-000002",
      path: "docs/project-design/archive/generation-000002.records.jsonl",
      recordCount: 1,
      createdAt: "2026-08-14T00:00:00.000Z"
    };
    const third = {
      id: "generation-000003",
      path: "docs/project-design/archive/generation-000003.records.jsonl",
      recordCount: 1,
      createdAt: "2026-08-15T00:00:00.000Z"
    };
    const firstBody = "Archived record.first\n";
    const firstEntry = archiveEntry(historicalRecord("record.first"), firstBody, 2, first.createdAt);
    const secondBody = "Archived record.second\n";
    const secondEntry = archiveEntry(historicalRecord("record.second"), secondBody, 3, second.createdAt);
    currentPack.archive.generations = [first, second];
    await mkdir(join(project().repository, "docs/project-design/archive"), { recursive: true });
    await writeFile(join(project().repository, ...first.path.split("/")), `${JSON.stringify(firstEntry)}\n`, "utf8");
    await writeFile(join(project().repository, ...second.path.split("/")), `${JSON.stringify(secondEntry)}\n`, "utf8");
    await writeFile(
      join(project().repository, "docs/project-design/manifest.json"),
      `${JSON.stringify(currentPack, null, 2)}\n`,
      "utf8"
    );

    const candidatePack = structuredClone(currentPack);
    candidatePack.maintenanceRevision = 4;
    candidatePack.records = candidatePack.records.filter((record) => record.id !== "record.architecture");
    candidatePack.archive.generations = [second, third];
    candidatePack.archive.tombstones.count = 1;
    const thirdEntry = archiveEntry(structuredClone(architecture), "Record architecture\n", 4, third.createdAt);
    const tombstone = {
      id: "record.first",
      reason: "superseded",
      successorIds: [],
      contentHash: firstEntry.contentHash,
      archivedAt: first.createdAt
    };
    const preview = await api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes: [
        { path: "docs/project-design/architecture.md", managedBlock: { recordId: "record.architecture", delete: true } },
        { path: third.path, content: `${JSON.stringify(thirdEntry)}\n` },
        { path: candidatePack.archive.tombstones.path, content: `${JSON.stringify(tombstone)}\n` },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }
      ]
    });
    expect(preview).toMatchObject({ applicable: true, validation: { valid: true } });

    await expect(api.inspectChangesetForApproval({
      root: project().repository,
      changesetId: preview.changesetId
    })).resolves.toMatchObject({
      archiveActions: {
        archivedRecordIds: ["record.architecture"],
        tombstonedRecordIds: ["record.first"]
      }
    });
    await writeFile(join(project().repository, ...second.path.split("/")), `${JSON.stringify(secondEntry)}\n\n`, "utf8");
    await expect(api.applyUpdate({
      root: project().repository,
      changesetId: preview.changesetId
    })).rejects.toThrow(/archive|history|dependency|stale/i);
  });

  test("summarizes archive and tombstone records in an initial Schema 3.0 import", async () => {
    const archiveNow = Date.parse("2026-08-15T00:00:00.000Z");
    const api = createTrustedTestKeeper({
      cacheDirectory: join(project().root, "keeper-cache"),
      now: () => archiveNow
    });
    const candidatePack = await writeV3PackFixture(project()) as {
      records: Array<Record<string, unknown>>;
      archive: { generations: Array<Record<string, unknown>>; tombstones: { path: string; count: number } };
    } & Record<string, unknown>;
    const architecture = candidatePack.records.find((record) => record.id === "record.architecture")!;
    const archivedArchitecture: Record<string, unknown> = {
      ...structuredClone(architecture),
      lifecycle: {
        state: "terminal",
        reason: "superseded",
        sinceRevision: 1,
        confirmedRefreshes: 2,
        successorIds: []
      }
    };
    candidatePack.records = candidatePack.records.filter((record) => record.id !== "record.architecture");
    const generation = {
      id: "generation-000001",
      path: "docs/project-design/archive/generation-000001.records.jsonl",
      recordCount: 1,
      createdAt: "2026-08-15T00:00:00.000Z"
    };
    candidatePack.archive.generations = [generation];
    candidatePack.archive.tombstones.count = 1;
    const archiveBody = "Record architecture\n";
    const entry = {
      record: archivedArchitecture,
      originalOwnerDocument: archivedArchitecture.ownerDocument,
      managedBody: archiveBody,
      contentHash: hash(archiveBody),
      evidenceHash: hash(JSON.stringify(archivedArchitecture.evidence)),
      terminalReason: "superseded",
      maintenanceRevision: 1,
      archivedAt: generation.createdAt
    };
    const tombstone = {
      id: "record.bootstrap-tombstone",
      reason: "resolved",
      successorIds: [],
      contentHash: hash("bootstrap tombstone"),
      archivedAt: generation.createdAt
    };
    await mkdir(join(project().repository, "docs/project-design/archive"), { recursive: true });
    await writeFile(join(project().repository, ...generation.path.split("/")), `${JSON.stringify(entry)}\n`, "utf8");
    await writeFile(
      join(project().repository, ...candidatePack.archive.tombstones.path.split("/")),
      `${JSON.stringify(tombstone)}\n`,
      "utf8"
    );
    const omittedHistoryPreview = await api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes: [
        { path: "docs/project-design/architecture.md", managedBlock: { recordId: "record.architecture", delete: true } },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }
      ]
    });
    expect(omittedHistoryPreview).toMatchObject({
      applicable: false,
      conflicts: ["Candidate pack validation failed"],
      validation: { valid: false }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      pack: candidatePack,
      changes: [
        { path: "docs/project-design/architecture.md", managedBlock: { recordId: "record.architecture", delete: true } },
        { path: generation.path, content: `${JSON.stringify(entry)}\n` },
        { path: candidatePack.archive.tombstones.path, content: `${JSON.stringify(tombstone)}\n` },
        { path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidatePack, null, 2)}\n` }
      ]
    });
    expect(preview).toMatchObject({ applicable: true, validation: { valid: true } });

    await expect(api.inspectChangesetForApproval({
      root: project().repository,
      changesetId: preview.changesetId
    })).resolves.toMatchObject({
      archiveActions: {
        archivedRecordIds: ["record.architecture"],
        tombstonedRecordIds: ["record.bootstrap-tombstone"]
      }
    });
  });
});
