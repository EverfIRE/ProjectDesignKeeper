import { createHash } from "node:crypto";
import { z } from "zod";
import { keeperLimits } from "../security/limits.js";
import {
  archiveEntrySchema,
  isCompleteArchiveEntry,
  safeRepositoryPath,
  stableId,
  strictHistoryKnowledgeRecordSchema,
  tombstoneSchema,
  windowsRepositoryPathKey
} from "../types/schema.js";
import { decodeCanonicalJsonLines } from "./jsonl.js";

const sha256HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const historyPathSchema = z.string().refine((path) => safeRepositoryPath(path), "must be a canonical repository-relative path");
const managedDocumentPathSchema = z.string().refine(
  (path) => safeRepositoryPath(path) && path.startsWith("docs/project-design/") && path.endsWith(".md"),
  "must be a canonical Markdown path under docs/project-design"
);
const historyIdSchema = stableId.max(256);
const safeHistoryIntegerSchema = z.number().int().nonnegative().safe();

export const historyGenerationMetadataSchema = z.object({
  id: z.string().regex(/^generation-[0-9]{6}$/u),
  path: historyPathSchema,
  recordCount: safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords),
  createdAt: z.string().datetime()
}).strict();

const historyTombstoneMetadataSchema = z.object({
  path: historyPathSchema,
  count: safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords)
}).strict();

const strictHistoryPackSchema = z.object({
  managedBy: z.literal("project-design-keeper"),
  schemaVersion: z.literal("3.0"),
  maintenanceRevision: safeHistoryIntegerSchema,
  scope: z.object({
    root: z.literal("."),
    paths: z.array(historyPathSchema).nonempty().max(keeperLimits.scan.maxFiles).optional()
  }).passthrough(),
  sourceRevision: z.object({
    kind: z.string().min(1),
    files: z.record(historyPathSchema, sha256HashSchema).superRefine((files, context) => {
      const paths = Object.keys(files);
      if (paths.length === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "must contain source files" });
      }
      if (paths.length > keeperLimits.scan.maxFiles) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `must contain at most ${keeperLimits.scan.maxFiles} source files`
        });
      }
    })
  }).passthrough(),
  documents: z.array(z.object({
    id: historyIdSchema,
    path: managedDocumentPathSchema
  }).strict()).max(keeperLimits.pack.maxDocuments),
  records: z.array(strictHistoryKnowledgeRecordSchema).max(keeperLimits.pack.maxRecords),
  archive: z.object({
    generations: z.array(historyGenerationMetadataSchema).max(2),
    tombstones: historyTombstoneMetadataSchema
  }).strict(),
  dedupeExceptions: z.array(z.object({
    leftId: historyIdSchema,
    rightId: historyIdSchema,
    leftDigest: sha256HashSchema,
    rightDigest: sha256HashSchema
  }).strict()).max(keeperLimits.redundancy.maxDecisions)
}).strict();

export type CanonicalHistoryPack = z.infer<typeof strictHistoryPackSchema>;
export type HistoryGenerationMetadata = z.infer<typeof historyGenerationMetadataSchema>;
export type HistoricalArchiveEntry = z.infer<typeof archiveEntrySchema>;
export type HistoricalTombstone = z.infer<typeof tombstoneSchema>;
export type StrictHistoryKnowledgeRecord = z.infer<typeof strictHistoryKnowledgeRecordSchema>;

export interface ParsedArchiveGeneration {
  metadata: HistoryGenerationMetadata;
  entries: HistoricalArchiveEntry[];
  maintenanceRevision?: number;
}

function schemaError(label: string, error: z.ZodError): Error {
  const detail = error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : label;
    return `${path}: ${issue.message}`;
  }).join("; ");
  return new Error(`${label} is invalid${detail ? `: ${detail}` : ""}`);
}

function assertUnique(values: string[], label: string): void {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = windowsRepositoryPathKey(value);
    const prior = seen.get(key);
    if (prior !== undefined) throw new Error(`${label} contains a duplicate or aliased value: ${value}`);
    seen.set(key, value);
  }
}

function kindOwnsPath(kind: StrictHistoryKnowledgeRecord["kind"], path: string): boolean {
  if (kind === "module") return path.startsWith("docs/project-design/modules/") && path.endsWith(".md");
  const expected: Record<Exclude<StrictHistoryKnowledgeRecord["kind"], "module">, string> = {
    intent: "docs/project-design/intent.md",
    principle: "docs/project-design/principles.md",
    architecture: "docs/project-design/architecture.md",
    convention: "docs/project-design/conventions.md",
    decision: "docs/project-design/decisions.md",
    tuning: "docs/project-design/tuning.md",
    verification: "docs/project-design/verification.md",
    "open-question": "docs/project-design/open-questions.md"
  };
  return expected[kind] === path;
}

function rawRecordById(value: unknown): Map<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Map();
  const records = (value as Record<string, unknown>).records;
  if (!Array.isArray(records)) return new Map();
  return new Map(records.flatMap((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record) || typeof (record as Record<string, unknown>).id !== "string") return [];
    return [[(record as Record<string, unknown>).id as string, record] as const];
  }));
}

export function parseCanonicalPackStructure(value: unknown): CanonicalHistoryPack {
  const parsed = strictHistoryPackSchema.safeParse(value);
  if (!parsed.success) throw schemaError("History manifest", parsed.error);
  const pack = parsed.data;

  const allIds = [...pack.documents.map((document) => document.id), ...pack.records.map((record) => record.id)];
  if (new Set(allIds).size !== allIds.length) throw new Error("History manifest contains duplicate document or active record IDs");
  assertUnique(pack.documents.map((document) => document.path), "History manifest document paths");
  assertUnique(pack.scope.paths ?? [], "History manifest scope paths");
  assertUnique(Object.keys(pack.sourceRevision.files), "History manifest source revision paths");

  const documents = new Map(pack.documents.map((document) => [document.id, document.path]));
  const revisionPaths = new Set(Object.keys(pack.sourceRevision.files).map(windowsRepositoryPathKey));
  for (const record of pack.records) {
    const ownerPath = documents.get(record.ownerDocument);
    if (!ownerPath || !kindOwnsPath(record.kind, ownerPath)) {
      throw new Error(`History record owner is missing or incompatible: ${record.id}`);
    }
    for (const evidence of record.evidence) {
      if (!revisionPaths.has(windowsRepositoryPathKey(evidence.path))) {
        throw new Error(`History record evidence is not bound to sourceRevision.files: ${record.id}`);
      }
    }
  }

  const generationIds = pack.archive.generations.map((generation) => generation.id);
  const generationPaths = pack.archive.generations.map((generation) => generation.path);
  if (new Set(generationIds).size !== generationIds.length) throw new Error("History archive contains duplicate generation IDs");
  assertUnique(generationPaths, "History archive generation paths");
  for (const [index, generation] of pack.archive.generations.entries()) {
    const number = Number(generation.id.slice("generation-".length));
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(`History archive generation ID is invalid: ${generation.id}`);
    const expectedPath = `docs/project-design/archive/${generation.id}.records.jsonl`;
    if (generation.path !== expectedPath) throw new Error(`History archive generation path must be ${expectedPath}`);
    const prior = pack.archive.generations[index - 1];
    if (prior) {
      const priorNumber = Number(prior.id.slice("generation-".length));
      if (number !== priorNumber + 1 || Date.parse(generation.createdAt) <= Date.parse(prior.createdAt)) {
        throw new Error("History archive generations must be consecutive and ordered by ID and timestamp");
      }
    }
  }
  if (pack.archive.tombstones.path !== "docs/project-design/archive/tombstones.jsonl") {
    throw new Error("History tombstone path must be docs/project-design/archive/tombstones.jsonl");
  }

  const activeIds = new Set(pack.records.map((record) => record.id));
  const rawRecords = rawRecordById(value);
  const exceptionPairs = new Set<string>();
  for (const exception of pack.dedupeExceptions) {
    if (exception.leftId === exception.rightId || !activeIds.has(exception.leftId) || !activeIds.has(exception.rightId)) {
      throw new Error("History dedupe exception references invalid active record IDs");
    }
    const pair = [exception.leftId, exception.rightId].sort().join("\0");
    if (exceptionPairs.has(pair)) throw new Error("History dedupe exceptions contain a duplicate pair");
    exceptionPairs.add(pair);
    const digest = (record: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex")}`;
    if (digest(rawRecords.get(exception.leftId)) !== exception.leftDigest ||
        digest(rawRecords.get(exception.rightId)) !== exception.rightDigest) {
      throw new Error("History dedupe exception digests do not match active records");
    }
  }
  return pack;
}

export function parseArchiveGeneration(bytes: Buffer, metadata: unknown): ParsedArchiveGeneration {
  const parsedMetadata = historyGenerationMetadataSchema.safeParse(metadata);
  if (!parsedMetadata.success) throw schemaError("History archive generation metadata", parsedMetadata.error);
  const canonicalMetadata = parsedMetadata.data;
  const expectedPath = `docs/project-design/archive/${canonicalMetadata.id}.records.jsonl`;
  if (canonicalMetadata.path !== expectedPath) throw new Error(`History archive generation path must be ${expectedPath}`);
  const lines = decodeCanonicalJsonLines(bytes, `History archive ${canonicalMetadata.path}`, {
    expectedCount: canonicalMetadata.recordCount
  });
  const entries = lines.map(({ value, line }) => {
    const parsed = archiveEntrySchema.safeParse(value);
    if (!parsed.success) throw schemaError(`History archive record at line ${line}`, parsed.error);
    if (!isCompleteArchiveEntry(parsed.data)) throw new Error(`History archive record is incomplete at line ${line}`);
    if (parsed.data.archivedAt !== canonicalMetadata.createdAt) {
      throw new Error(`History archive record timestamp does not match ${canonicalMetadata.id}`);
    }
    return parsed.data;
  });
  const ids = entries.map((entry) => entry.record.id);
  if (new Set(ids).size !== ids.length) throw new Error(`History archive generation contains duplicate record IDs: ${canonicalMetadata.id}`);
  const revisions = new Set(entries.map((entry) => entry.maintenanceRevision));
  if (revisions.size > 1) throw new Error(`History archive generation contains inconsistent maintenance revisions: ${canonicalMetadata.id}`);
  return {
    metadata: canonicalMetadata,
    entries,
    ...(entries[0] ? { maintenanceRevision: entries[0].maintenanceRevision } : {})
  };
}

export function parseTombstones(bytes: Buffer, expectedCount: unknown): HistoricalTombstone[] {
  const parsedCount = safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords).safeParse(expectedCount);
  if (!parsedCount.success) throw schemaError("History tombstone count", parsedCount.error);
  const lines = decodeCanonicalJsonLines(bytes, "History tombstone", { expectedCount: parsedCount.data });
  const tombstones = lines.map(({ value, line }) => {
    const parsed = tombstoneSchema.safeParse(value);
    if (!parsed.success) throw schemaError(`History tombstone at line ${line}`, parsed.error);
    return parsed.data;
  });
  const ids = tombstones.map((tombstone) => tombstone.id);
  if (new Set(ids).size !== ids.length) throw new Error("History tombstones contain duplicate record IDs");
  return tombstones;
}

interface RelationNode {
  id: string;
  record?: StrictHistoryKnowledgeRecord;
  successorIds: string[];
  tier: string;
}

function terminalSuccessors(record: StrictHistoryKnowledgeRecord): string[] {
  return record.lifecycle.state === "terminal" ? record.lifecycle.successorIds : [];
}

export function validateHistoryRelationships(
  pack: CanonicalHistoryPack,
  generations: ParsedArchiveGeneration[],
  tombstones: HistoricalTombstone[]
): void {
  if (generations.length !== pack.archive.generations.length) {
    throw new Error("History archive generations are incomplete");
  }
  const documents = new Map(pack.documents.map((document) => [document.id, document.path]));
  const identities = new Set<string>();
  for (const document of pack.documents) {
    if (identities.has(document.id)) throw new Error(`History contains a duplicate ID: ${document.id}`);
    identities.add(document.id);
  }

  const nodes = new Map<string, RelationNode>();
  const addNode = (node: RelationNode) => {
    if (identities.has(node.id)) throw new Error(`History contains a duplicate ID across tiers: ${node.id}`);
    identities.add(node.id);
    nodes.set(node.id, node);
  };
  const validateOwner = (record: StrictHistoryKnowledgeRecord) => {
    const owner = documents.get(record.ownerDocument);
    if (!owner || !kindOwnsPath(record.kind, owner)) {
      throw new Error(`History record owner is missing or incompatible: ${record.id}`);
    }
  };

  for (const record of pack.records) {
    validateOwner(record);
    if (record.lifecycle.state === "terminal" && record.lifecycle.sinceRevision > pack.maintenanceRevision) {
      throw new Error(`History terminal record revision is in the future: ${record.id}`);
    }
    addNode({ id: record.id, record, successorIds: terminalSuccessors(record), tier: "active" });
  }

  let priorGenerationRevision = -1;
  for (const [index, generation] of generations.entries()) {
    const expected = pack.archive.generations[index];
    if (!expected || JSON.stringify(generation.metadata) !== JSON.stringify(expected)) {
      throw new Error("History archive generation metadata changed during validation");
    }
    if (generation.maintenanceRevision === undefined) {
      if (generation.metadata.recordCount !== 0) throw new Error(`History archive generation revision is missing: ${generation.metadata.id}`);
    } else {
      if (generation.maintenanceRevision > pack.maintenanceRevision || generation.maintenanceRevision <= priorGenerationRevision) {
        throw new Error("History archive generation revisions must be ordered and not exceed the pack revision");
      }
      priorGenerationRevision = generation.maintenanceRevision;
    }
    for (const entry of generation.entries) {
      validateOwner(entry.record);
      if (entry.originalOwnerDocument !== entry.record.ownerDocument ||
          entry.record.lifecycle.state !== "terminal" ||
          entry.record.lifecycle.confirmedRefreshes < 2 ||
          entry.record.lifecycle.sinceRevision > entry.maintenanceRevision) {
        throw new Error(`History archive record owner, lifecycle, or revision is invalid: ${entry.record.id}`);
      }
      addNode({
        id: entry.record.id,
        record: entry.record,
        successorIds: entry.record.lifecycle.successorIds,
        tier: `archive:${generation.metadata.id}`
      });
    }
  }
  for (const tombstone of tombstones) {
    addNode({ id: tombstone.id, successorIds: tombstone.successorIds, tier: "tombstone" });
  }

  const edges = new Map<string, Set<string>>([...nodes.keys()].map((id) => [id, new Set<string>()]));
  let edgeCount = 0;
  const maximumEdges = keeperLimits.pack.maxRecords * 4;
  const addEdge = (successorId: string, predecessorId: string, label: string) => {
    if (!nodes.has(successorId)) throw new Error(`${label} references an unknown successor: ${successorId}`);
    if (!nodes.has(predecessorId)) throw new Error(`${label} references an unknown predecessor: ${predecessorId}`);
    if (successorId === predecessorId) throw new Error(`${label} contains a self relationship: ${successorId}`);
    const outgoing = edges.get(successorId)!;
    if (!outgoing.has(predecessorId)) {
      edgeCount += 1;
      if (edgeCount > maximumEdges) throw new Error(`History successor relationships exceed the limit of ${maximumEdges}`);
      outgoing.add(predecessorId);
    }
  };

  for (const node of nodes.values()) {
    if (new Set(node.successorIds).size !== node.successorIds.length) {
      throw new Error(`History successor IDs contain duplicates: ${node.id}`);
    }
    for (const successorId of node.successorIds) {
      addEdge(successorId, node.id, `History successor relationship for ${node.id}`);
      const successor = nodes.get(successorId)?.record;
      if (successor?.supersedes !== undefined && successor.supersedes !== node.id) {
        throw new Error(`History successor encodings contradict each other: ${successorId}`);
      }
    }
    const record = node.record;
    if (!record) continue;
    if (record.supersedes !== undefined) {
      const predecessor = nodes.get(record.supersedes);
      if (!predecessor) throw new Error(`History supersedes relationship is broken: ${record.id}`);
      if (predecessor.record?.lifecycle.state === "active") {
        throw new Error(`History record cannot supersede an active predecessor: ${record.id}`);
      }
      if (!predecessor.successorIds.includes(record.id)) {
        throw new Error(`History supersedes relationship is not reciprocal: ${record.id}`);
      }
      if (predecessor.record?.supersededBy !== undefined && predecessor.record.supersededBy !== record.id) {
        throw new Error(`History supersedes relationship contradicts supersededBy: ${record.id}`);
      }
      addEdge(record.id, record.supersedes, `History supersedes relationship for ${record.id}`);
    }
    if (record.supersededBy !== undefined) {
      if (record.lifecycle.state !== "terminal") {
        throw new Error(`History active record cannot declare supersededBy: ${record.id}`);
      }
      if (!node.successorIds.includes(record.supersededBy)) {
        throw new Error(`History supersededBy relationship is not reciprocal: ${record.id}`);
      }
      const successor = nodes.get(record.supersededBy)?.record;
      if (successor?.supersedes !== undefined && successor.supersedes !== record.id) {
        throw new Error(`History supersededBy relationship contradicts supersedes: ${record.id}`);
      }
      addEdge(record.supersededBy, record.id, `History supersededBy relationship for ${record.id}`);
    }
  }

  const indegree = new Map<string, number>([...nodes.keys()].map((id) => [id, 0]));
  for (const outgoing of edges.values()) {
    for (const target of outgoing) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  for (let index = 0; index < ready.length; index += 1) {
    const id = ready[index];
    visited += 1;
    for (const target of edges.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) ready.push(target);
    }
  }
  if (visited !== nodes.size) throw new Error("History successor graph contains a cycle");
}

export interface ValidatedHistoryOverlay {
  pack: CanonicalHistoryPack;
  generations: ParsedArchiveGeneration[];
  tombstones: HistoricalTombstone[];
}

/** Validates one complete candidate/history view using only caller-supplied overlay bytes. */
export async function loadAndValidateHistoryOverlay(
  value: unknown,
  read: (path: string) => Promise<Buffer | undefined>
): Promise<ValidatedHistoryOverlay> {
  const pack = parseCanonicalPackStructure(value);
  const generations: ParsedArchiveGeneration[] = [];
  for (const metadata of pack.archive.generations) {
    const bytes = await read(metadata.path);
    if (!bytes) throw new Error(`History archive generation is missing: ${metadata.path}`);
    generations.push(parseArchiveGeneration(bytes, metadata));
  }
  const tombstoneBytes = await read(pack.archive.tombstones.path);
  if (!tombstoneBytes && pack.archive.tombstones.count !== 0) {
    throw new Error(`History tombstone file is missing: ${pack.archive.tombstones.path}`);
  }
  const tombstones = tombstoneBytes
    ? parseTombstones(tombstoneBytes, pack.archive.tombstones.count)
    : [];
  validateHistoryRelationships(pack, generations, tombstones);
  return { pack, generations, tombstones };
}
