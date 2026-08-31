import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { writeV3PackFixture } from "./canonical-pack-fixture.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { createTrustedTestKeeper } from "./keeper.js";

type JsonObject = Record<string, unknown>;

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

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected object fixture");
  return value as JsonObject;
}

function records(pack: JsonObject): JsonObject[] {
  if (!Array.isArray(pack.records)) throw new Error("expected records fixture");
  return pack.records.map(object);
}

function archive(pack: JsonObject): JsonObject {
  return object(pack.archive);
}

function generationMetadata(recordCount = 1): JsonObject {
  return {
    id: "generation-000001",
    path: "docs/project-design/archive/generation-000001.records.jsonl",
    recordCount,
    createdAt: "2026-08-15T00:00:00.000Z"
  };
}

function archivedRecord(pack: JsonObject, successorIds: string[] = []): JsonObject {
  const source = structuredClone(records(pack).find((record) => record.id === "record.architecture"));
  if (!source) throw new Error("expected architecture fixture");
  return {
    ...source,
    id: "record.historical",
    statement: "Historical architecture was retained.",
    status: "superseded",
    lifecycle: {
      state: "terminal",
      reason: "superseded",
      sinceRevision: 0,
      confirmedRefreshes: 2,
      successorIds
    }
  };
}

function archiveEntry(record: JsonObject, maintenanceRevision: number, archivedAt: string): JsonObject {
  const managedBody = "Historical architecture\n";
  return {
    record,
    originalOwnerDocument: record.ownerDocument,
    managedBody,
    contentHash: hash(managedBody),
    evidenceHash: hash(JSON.stringify(record.evidence)),
    terminalReason: object(record.lifecycle).reason,
    maintenanceRevision,
    archivedAt
  };
}

function canonicalLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function withInvalidUtf8ForReplacementCharacter(contents: string): Buffer {
  const bytes = Buffer.from(contents, "utf8");
  const replacement = Buffer.from("\ufffd", "utf8");
  const offset = bytes.indexOf(replacement);
  if (offset < 0) throw new Error("fixture lacks a replacement character");
  return Buffer.concat([bytes.subarray(0, offset), Buffer.from([0x80]), bytes.subarray(offset + replacement.length)]);
}

async function cacheEntries(cacheDirectory: string): Promise<string[]> {
  try {
    return await readdir(join(cacheDirectory, "changesets"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function initialCandidate(options: {
  maintenanceRevision?: number;
  successorIds?: string[];
  encode?: (line: string) => string;
} = {}) {
  const cacheDirectory = join(project().root, "keeper-cache");
  const api = createTrustedTestKeeper({ cacheDirectory });
  const pack = await writeV3PackFixture(project());
  const generation = generationMetadata();
  const record = archivedRecord(pack, options.successorIds);
  const entry = archiveEntry(
    record,
    options.maintenanceRevision ?? Number(pack.maintenanceRevision),
    String(generation.createdAt)
  );
  archive(pack).generations = [generation];
  const line = canonicalLine(entry);
  return {
    api,
    cacheDirectory,
    pack,
    generation,
    entry,
    changes: [
      { path: String(generation.path), content: options.encode?.(line) ?? line },
      { path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` }
    ]
  };
}

async function migrationCandidate(schemaVersion: "1.0" | "2.0") {
  const result = await initialCandidate({ successorIds: ["record.missing"] });
  result.pack.maintenanceRevision = 0;
  result.entry.maintenanceRevision = 0;
  result.changes[0].content = canonicalLine(result.entry);
  const typedRecords = records(result.pack).map((record) => structuredClone(record));
  const legacyRecords = typedRecords.map((record) => {
    const evidence = (record.evidence as JsonObject[]).map((item) => `${String(item.path)}:${String(item.startLine)}`);
    const legacy: JsonObject = {
      ...record,
      evidence,
      confidence: record.assertedConfidence
    };
    delete legacy.assertedConfidence;
    delete legacy.lifecycle;
    return legacy;
  });
  const legacyPack: JsonObject = {
    ...structuredClone(result.pack),
    schemaVersion,
    records: legacyRecords
  };
  delete legacyPack.maintenanceRevision;
  delete legacyPack.archive;
  delete legacyPack.dedupeExceptions;
  await writeFile(
    join(project().repository, "docs/project-design/manifest.json"),
    `${JSON.stringify(legacyPack, null, 2)}\n`,
    "utf8"
  );
  result.pack.records = typedRecords.map((record, index) => ({
    ...record,
    legacyEvidence: legacyRecords[index].evidence,
    legacyStatus: legacyRecords[index].status
  }));
  result.changes[1].content = `${JSON.stringify(result.pack, null, 2)}\n`;
  return result;
}

async function retainedCandidate(options: { successorIds?: string[]; replacementBody?: boolean } = {}) {
  const cacheDirectory = join(project().root, "keeper-cache");
  const api = createTrustedTestKeeper({ cacheDirectory });
  const currentPack = await writeV3PackFixture(project());
  const generation = generationMetadata();
  const record = archivedRecord(currentPack, options.successorIds);
  const entry = archiveEntry(record, 1, String(generation.createdAt));
  if (options.replacementBody) {
    entry.managedBody = "\ufffd";
    entry.contentHash = hash("\ufffd");
  }
  archive(currentPack).generations = [generation];
  const generationPath = String(generation.path);
  await mkdir(join(project().repository, "docs/project-design/archive"), { recursive: true });
  await writeFile(join(project().repository, ...generationPath.split("/")), canonicalLine(entry), "utf8");
  await writeFile(
    join(project().repository, "docs/project-design/manifest.json"),
    `${JSON.stringify(currentPack, null, 2)}\n`,
    "utf8"
  );
  const candidatePack = structuredClone(currentPack);
  candidatePack.maintenanceRevision = 2;
  return { api, cacheDirectory, currentPack, candidatePack, generation, entry, generationPath };
}

describe("candidate historical integrity", () => {
  test("rejects an initial Schema 3 archive revision beyond the candidate pack before publication", async () => {
    const candidate = await initialCandidate({ maintenanceRevision: 2 });

    const result = await candidate.api.previewUpdate({
      root: project().repository,
      pack: candidate.pack,
      changes: candidate.changes
    });

    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toMatch(/history|archive|revision/i);
    expect(result).not.toHaveProperty("changesetId");
    await expect(cacheEntries(candidate.cacheDirectory)).resolves.toEqual([]);
    await expect(readFile(join(project().repository, ...String(candidate.generation.path).split("/")))).rejects.toThrow();
    await expect(readFile(join(project().repository, "docs/project-design/manifest.json"))).rejects.toThrow();
  });

  test.each(["1.0", "2.0"] as const)(
    "rejects a Schema %s to 3.0 candidate with a broken archived successor before publication",
    async (schemaVersion) => {
      const candidate = await migrationCandidate(schemaVersion);
      const manifestPath = join(project().repository, "docs/project-design/manifest.json");
      const before = await readFile(manifestPath);

      const result = await candidate.api.previewUpdate({
        root: project().repository,
        pack: candidate.pack,
        changes: candidate.changes
      });

      expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
      expect(JSON.stringify(result)).toMatch(/history|archive|successor/i);
      expect(result).not.toHaveProperty("changesetId");
      await expect(cacheEntries(candidate.cacheDirectory)).resolves.toEqual([]);
      await expect(readFile(manifestPath)).resolves.toEqual(before);
    }
  );

  test("rejects a Schema 3 to 3 candidate whose retained archive has a broken successor", async () => {
    const candidate = await retainedCandidate({ successorIds: ["record.missing"] });
    const manifestPath = join(project().repository, "docs/project-design/manifest.json");
    const before = await readFile(manifestPath);

    const result = await candidate.api.previewUpdate({
      root: project().repository,
      pack: candidate.candidatePack,
      changes: [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate.candidatePack, null, 2)}\n` }]
    });

    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toMatch(/history|archive|successor/i);
    expect(result).not.toHaveProperty("changesetId");
    await expect(cacheEntries(candidate.cacheDirectory)).resolves.toEqual([]);
    await expect(readFile(manifestPath)).resolves.toEqual(before);
  });

  test("does not treat an existing no-current tombstone file as absent from the candidate overlay", async () => {
    const cacheDirectory = join(project().root, "keeper-cache");
    const api = createTrustedTestKeeper({ cacheDirectory });
    const pack = await writeV3PackFixture(project());
    const tombstonePath = "docs/project-design/archive/tombstones.jsonl";
    const tombstone = {
      id: "record.preexisting",
      reason: "resolved",
      successorIds: [],
      contentHash: hash("preexisting"),
      archivedAt: "2026-08-15T00:00:00.000Z"
    };
    await mkdir(join(project().repository, "docs/project-design/archive"), { recursive: true });
    await writeFile(join(project().repository, ...tombstonePath.split("/")), canonicalLine(tombstone), "utf8");

    const result = await api.previewUpdate({
      root: project().repository,
      pack,
      changes: [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` }]
    });

    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toMatch(/history|tombstone|count/i);
    expect(result).not.toHaveProperty("changesetId");
    await expect(cacheEntries(cacheDirectory)).resolves.toEqual([]);
    await expect(readFile(join(project().repository, "docs/project-design/manifest.json"))).rejects.toThrow();
  });
});

describe("canonical candidate JSONL", () => {
  test.each([
    { name: "leading blank line", encode: (line: string) => `\n${line}` },
    { name: "duplicate terminating newline", encode: (line: string) => `${line}\n` },
    { name: "CRLF terminator", encode: (line: string) => line.replace(/\n$/u, "\r\n") },
    { name: "missing terminating newline", encode: (line: string) => line.replace(/\n$/u, "") },
    { name: "trailing whitespace before LF", encode: (line: string) => line.replace(/\n$/u, " \n") },
    { name: "UTF-8 BOM", encode: (line: string) => `\ufeff${line}` }
  ])("rejects a candidate generation with a $name before publication", async ({ encode }) => {
    const candidate = await initialCandidate({ encode });

    const result = await candidate.api.previewUpdate({
      root: project().repository,
      pack: candidate.pack,
      changes: candidate.changes
    });

    expect(result).toMatchObject({ applicable: false });
    expect(result).not.toHaveProperty("changesetId");
    await expect(cacheEntries(candidate.cacheDirectory)).resolves.toEqual([]);
    await expect(readFile(join(project().repository, ...String(candidate.generation.path).split("/")))).rejects.toThrow();
  });

  test("rejects invalid UTF-8 retained by the candidate overlay before publication", async () => {
    const candidate = await retainedCandidate({ replacementBody: true });
    const generationTarget = join(project().repository, ...candidate.generationPath.split("/"));
    await writeFile(generationTarget, withInvalidUtf8ForReplacementCharacter(canonicalLine(candidate.entry)));
    const manifestPath = join(project().repository, "docs/project-design/manifest.json");
    const before = await readFile(manifestPath);

    const result = await candidate.api.previewUpdate({
      root: project().repository,
      pack: candidate.candidatePack,
      changes: [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate.candidatePack, null, 2)}\n` }]
    });

    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toMatch(/history|archive|utf-8|jsonl/i);
    expect(result).not.toHaveProperty("changesetId");
    await expect(cacheEntries(candidate.cacheDirectory)).resolves.toEqual([]);
    await expect(readFile(manifestPath)).resolves.toEqual(before);
  });

  test.each([
    { name: "blank line", corrupt: (line: string) => Buffer.from(`\n${line}`, "utf8") },
    { name: "UTF-8 BOM", corrupt: (line: string) => Buffer.from(`\ufeff${line}`, "utf8") },
    {
      name: "invalid UTF-8",
      corrupt: (_line: string, entry: JsonObject) => {
        const changed = { ...entry, managedBody: "\ufffd", contentHash: hash("\ufffd") };
        return withInvalidUtf8ForReplacementCharacter(canonicalLine(changed));
      }
    }
  ])("rejects apply after a retained history dependency changes to $name without consuming the pair", async ({ corrupt }) => {
    const candidate = await retainedCandidate();
    const preview = await candidate.api.previewUpdate({
      root: project().repository,
      pack: candidate.candidatePack,
      changes: [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(candidate.candidatePack, null, 2)}\n` }]
    });
    if (preview.applicable !== true || typeof preview.changesetId !== "string") {
      throw new Error(`expected valid preview: ${JSON.stringify(preview)}`);
    }
    const manifestPath = join(project().repository, "docs/project-design/manifest.json");
    const before = await readFile(manifestPath);
    await writeFile(
      join(project().repository, ...candidate.generationPath.split("/")),
      corrupt(canonicalLine(candidate.entry), candidate.entry)
    );

    await expect(candidate.api.applyUpdate({
      root: project().repository,
      changesetId: preview.changesetId
    })).rejects.toThrow(/history|dependency|stale/i);
    await expect(readFile(manifestPath)).resolves.toEqual(before);
    await expect(candidate.api.inspectChangesetForApproval({
      root: project().repository,
      changesetId: preview.changesetId
    })).resolves.toMatchObject({ changesetId: preview.changesetId });
  });
});
