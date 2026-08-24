import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  captureSecurePathIdentity,
  assertSecureOwnerFileMetadata,
  claimOwnedSnapshotDirectory,
  createOwnedBuildDirectory,
  createSecureCacheDirectory,
  observeOwnedSnapshotPublicationClaim,
  prepareSecureCache,
  PUBLICATION_CLAIM_WAIT_MS,
  publicationClaimLiveness,
  publishExclusiveFile,
  publishOwnedBuildDirectory,
  reconcileCacheFilePublication,
  safeRemoveExactCacheFile,
  safeRemoveOwnedBuildDirectory,
  safeRemoveOwnedPublicationClaim,
  safeRemoveOwnedSnapshotDirectory,
  samePublicationClaimEpoch,
  validateCacheFile,
  validateCacheFiles,
  validatePublicationClaim,
  validateSecurePathIdentity,
  type PublicationClaim,
  type SecureCacheLayout,
  type SecurePathIdentity
} from "../security/cache.js";
import { CounterBudget, DeadlineBudget, keeperLimits } from "../security/limits.js";
import {
  candidateModuleSchema,
  scopeDriftDetailSchema,
  scopeEvidenceSchema,
  scopeFileEntrySchema,
  scopeIndexMetadataV3Schema,
  scopeOmissionSchema,
  windowsRepositoryPathKey,
  type CandidateModule,
  type Evidence,
  type ScopeFileEntry,
  type ScopeIndexMetadataV3,
  type ScopeOmission,
  type ServiceOptions
} from "../types/schema.js";

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function scopeProjectKey(projectRoot: string): string {
  return hashKey(resolve(projectRoot));
}

export function scopePathsKey(scopePaths: string[]): string {
  return hashKey(JSON.stringify(scopePaths));
}

export function scopeCursorKey(projectRoot: string, scopeKey: string): string {
  return scopeCursorKeyFromProjectKey(scopeProjectKey(projectRoot), scopeKey);
}

function scopeCursorKeyFromProjectKey(projectKey: string, scopeKey: string): string {
  return hashKey(JSON.stringify({ projectKey, scopeKey }));
}

function jsonLines(values: unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n") + (values.length > 0 ? "\n" : "");
}

export interface PersistedScopeIndex {
  cacheRoot: string;
  scopeKey: string;
  cursorScopeKey: string;
  snapshotId: string;
  createdAt: number;
  expiresAt: number;
}

function structuredSnapshotId(sections: ReadonlyArray<readonly [string, readonly unknown[]]>): string {
  const digest = createHash("sha256");
  for (const [name, values] of sections) {
    digest.update(`${name}\0${values.length}\0`, "utf8");
    for (const value of values) {
      const serialized = JSON.stringify(canonicalSnapshotValue(value));
      digest.update(`${Buffer.byteLength(serialized, "utf8")}\0`, "ascii");
      digest.update(serialized, "utf8");
    }
  }
  return `sha256:${digest.digest("hex")}`;
}

function canonicalSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalSnapshotValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en-US"))
      .map(([key, nested]) => [key, canonicalSnapshotValue(nested)]));
  }
  return value;
}

export function scopeSnapshotIdForContent(input: {
  scopePaths: readonly string[];
  files: readonly ScopeFileEntry[];
  evidence: readonly Evidence[];
  candidateModules?: readonly CandidateModule[];
  omissions?: readonly ScopeOmission[];
  details?: readonly Record<string, unknown>[];
  driftSummary?: NonNullable<ScopeIndexMetadataV3["driftSummary"]>;
}): string {
  const sourceSnapshotId = structuredSnapshotId([
    ["scope-paths", input.scopePaths],
    ["files", input.files],
    ["evidence", input.evidence],
    ["candidate-modules", input.candidateModules ?? []],
    ["omissions", input.omissions ?? []]
  ]);
  if (input.details === undefined && input.driftSummary === undefined) return sourceSnapshotId;
  if (input.details === undefined || input.driftSummary === undefined) {
    throw new Error("Drift snapshot content requires both details and summary");
  }
  return structuredSnapshotId([
    ["source-snapshot", [sourceSnapshotId]],
    ["drift-summary", [input.driftSummary]],
    ["drift-details", input.details]
  ]);
}

function candidateModuleRoot(path: string): { id: string; path: string } {
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (parts.length === 1) return { id: "root", path: "." };
  const first = parts[0]!;
  const nestedRoots = new Set(["apps", "features", "lib", "modules", "packages", "plugins", "source", "src"]);
  const rootParts = nestedRoots.has(first.toLocaleLowerCase("en-US")) && parts.length > 2 ? [first, parts[1]!] : [first];
  const root = rootParts.join("/");
  const idParts = rootParts.map((part) => part.normalize("NFKD").toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, ""))
    .filter(Boolean);
  const fallback = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return { id: idParts.length > 0 ? idParts.join(".") : `module.${fallback}`, path: root };
}

export function scopeCandidateModulesForFiles(files: readonly ScopeFileEntry[]): CandidateModule[] {
  const modules = new Map<string, CandidateModule>();
  for (const file of files) {
    const candidate = candidateModuleRoot(file.path);
    const existing = modules.get(candidate.id);
    if (existing) {
      existing.fileCount += 1;
      existing.evidenceCount += file.lineCount;
      if (!existing.paths.includes(candidate.path)) existing.paths.push(candidate.path);
    } else {
      modules.set(candidate.id, {
        id: candidate.id,
        paths: [candidate.path],
        fileCount: 1,
        evidenceCount: file.lineCount
      });
    }
  }
  return [...modules.values()]
    .map((module) => ({ ...module, paths: [...module.paths].sort((left, right) => left.localeCompare(right, "en-US")) }))
    .sort((left, right) => left.id.localeCompare(right.id, "en-US") || left.paths[0]!.localeCompare(right.paths[0]!, "en-US"));
}

export interface ScopeStoreIo {
  beforeReadShard?: (path: string) => Promise<void>;
  beforeBuild?: (parent: string) => Promise<void>;
  writeShard?: (path: string, contents: string, operation: () => Promise<void>) => Promise<void>;
  afterShardWrites?: (build: SecurePathIdentity) => Promise<void>;
  beforePublish?: (build: SecurePathIdentity, target: string) => Promise<void>;
  afterTargetClaim?: (target: SecurePathIdentity) => Promise<void>;
  afterPublish?: (target: string) => Promise<void>;
  beforeTargetClaimAcquire?: () => Promise<void>;
  afterTargetClaimCollision?: () => Promise<void>;
  waitForTargetClaim?: (
    claim: SecurePathIdentity,
    attempt: number,
    operation: () => Promise<void>
  ) => Promise<"continue" | "deadline" | void>;
  afterBuildRename?: (target: string) => Promise<void>;
  afterSnapshotReads?: (target: string) => Promise<void>;
  afterTargetInspection?: (target: string, result: "missing" | "matching" | "invalid") => Promise<void>;
  afterTargetClaimRecheck?: (claim: PublicationClaim) => Promise<void>;
  afterStaleClaimRelease?: () => Promise<void>;
  nowMs?: () => number;
  beforeCleanup?: (build: SecurePathIdentity) => Promise<void>;
  afterLoadIdentity?: (target: SecurePathIdentity) => Promise<void>;
  beforeEvict?: (target: SecurePathIdentity) => Promise<void>;
  afterShardIdentity?: (target: SecurePathIdentity) => Promise<void>;
  beforeShardFinalIdentity?: (target: SecurePathIdentity) => Promise<void>;
  afterAccessPendingPublish?: (path: string) => Promise<void>;
  afterAccessPrimaryRemove?: (path: string) => Promise<void>;
  afterAccessPrimaryPublish?: (path: string) => Promise<void>;
  afterInitialAccessPublish?: (path: string) => Promise<void>;
  beforeUseClaimCleanup?: (claim: PublicationClaim) => Promise<void>;
  afterBoundedFileStat?: (path: string, size: number) => Promise<void>;
  afterPublicationArtifactStat?: (path: string) => Promise<void>;
  afterInventorySettlementRestart?: (artifactPath: string | undefined, epochEnded: boolean) => Promise<void>;
  onBoundedFileRead?: (path: string, bytes: number) => Promise<void>;
  prospectivePruneLimits?: () => ScopePruneLimits;
  inventoryNowMs?: () => number;
  onInventoryJoinWork?: (kind: "snapshot" | "active-claim" | "merge") => void;
}

const nodeScopeStoreIo: ScopeStoreIo = {};
type ExistingSnapshot = "missing" | "matching" | "invalid";

export interface PersistScopeIndexInput {
  options: ServiceOptions;
  projectRoot: string;
  scopePaths: string[];
  snapshotId: string;
  files: ScopeFileEntry[];
  evidence: Evidence[];
  candidateModules?: CandidateModule[];
  omissions?: ScopeOmission[];
  details?: Record<string, unknown>[];
  driftSummary?: NonNullable<ScopeIndexMetadataV3["driftSummary"]>;
}

interface SerializedScopeIndex {
  metadata: string;
  files: string;
  evidence: string;
  details?: string;
  parsedMetadata: ScopeIndexMetadataV3;
}

export class ScopeSnapshotRestartError extends Error {
  readonly restartPagination = true;

  constructor(readonly reason: "missing" | "expired" | "corrupt", options?: ErrorOptions) {
    super(`Scope snapshot is ${reason}; restart pagination from the first page`, options);
    this.name = "ScopeSnapshotRestartError";
  }
}

export interface LoadedScopeIndex {
  cacheRoot: string;
  snapshotId: string;
  createdAt: number;
  expiresAt: number;
  scopeKey: string;
  cursorScopeKey: string;
  scopePaths: ReadonlyArray<string>;
  files: ReadonlyArray<ScopeFileEntry>;
  evidence: ReadonlyArray<Evidence>;
  details?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  candidateModules: ReadonlyArray<CandidateModule>;
  omissions: ReadonlyArray<ScopeOmission>;
  totals: Readonly<ScopeIndexMetadataV3["totals"]>;
  driftSummary?: Readonly<NonNullable<ScopeIndexMetadataV3["driftSummary"]>>;
}

interface SnapshotBindings {
  projectKey: string;
  cursorScopeKey: string;
  snapshotId: string;
  scopeKey?: string;
  scopePaths?: string[];
}

interface ValidatedSnapshot {
  identity: SecurePathIdentity;
  metadata: ScopeIndexMetadataV3;
  metadataBytes: number;
  files: ScopeFileEntry[];
  evidence: Evidence[];
  details?: Record<string, unknown>[];
}

function missingPath(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT" ||
    /component is missing|no such file/i.test(String((error as Error).message));
}

function exactKeys(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort((left, right) => left.localeCompare(right, "en-US"));
  const expected = [...fields].sort((left, right) => left.localeCompare(right, "en-US"));
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
}

async function readBoundedCacheFile(
  layout: SecureCacheLayout,
  path: string,
  maximumBytes: number,
  hooks: ScopeStoreIo = {}
): Promise<{ bytes: Buffer; identity: SecurePathIdentity }> {
  await validateCacheFile(layout, path, false);
  const identity = await captureSecurePathIdentity(layout, path, "file");
  await hooks.afterShardIdentity?.(identity);
  const initialPath = await lstat(path, { bigint: true });
  assertSecureOwnerFileMetadata(initialPath, path, 1n);
  if (initialPath.dev !== BigInt(identity.dev) || initialPath.ino !== BigInt(identity.ino)) {
    throw new Error("Scope cache file path identity changed before bounded read");
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    if (!samePublicationArtifactVersion(initialPath, opened)) {
      throw new Error("Scope cache file handle identity or metadata does not match the captured path");
    }
    if (opened.size > BigInt(maximumBytes)) throw new Error("Scope cache file exceeds its byte budget");
    const size = Number(opened.size);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Scope cache file length is invalid");
    await hooks.afterBoundedFileStat?.(path, size);
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = await handle.read(bytes, offset, Math.min(64 * 1024, size - offset), offset);
      if (read.bytesRead < 1) throw new Error("Scope cache file was truncated during bounded read");
      offset += read.bytesRead;
      await hooks.onBoundedFileRead?.(path, read.bytesRead);
    }
    await hooks.beforeShardFinalIdentity?.(identity);
    await validateSecurePathIdentity(layout, identity);
    const [finalPath, finalHandle] = await Promise.all([
      lstat(path, { bigint: true }),
      handle.stat({ bigint: true })
    ]);
    if (!samePublicationArtifactVersion(opened, finalPath) ||
        !samePublicationArtifactVersion(opened, finalHandle)) {
      throw new Error("Scope cache file identity or metadata changed during bounded read");
    }
    return { bytes, identity };
  } finally {
    await handle.close();
  }
}

async function exactSnapshotEntries(target: string, metadata: ScopeIndexMetadataV3): Promise<void> {
  const expected = ["evidence.jsonl", "files.jsonl", "metadata.json", ...(metadata.shards.details ? ["details.jsonl"] : [])]
    .sort((left, right) => left.localeCompare(right, "en-US"));
  const actual: string[] = [];
  const budget = new CounterBudget("Scope snapshot directory entries", expected.length + 1);
  const directory = await opendir(target);
  try {
    for await (const entry of directory) {
      budget.consume();
      if (!entry.isFile()) throw new Error("Scope snapshot contains a non-file entry");
      actual.push(entry.name);
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  actual.sort((left, right) => left.localeCompare(right, "en-US"));
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    throw new Error("Scope snapshot does not contain the exact shard set");
  }
}

type JsonLineParser<T> = (value: unknown) => T;

async function readJsonLinesShard<T>(
  layout: SecureCacheLayout,
  path: string,
  expected: ScopeIndexMetadataV3["shards"]["files"],
  parse: JsonLineParser<T>,
  hooks: ScopeStoreIo = {}
): Promise<{ values: T[]; identity: SecurePathIdentity }> {
  if (expected.bytes > keeperLimits.scan.maxAggregateBytes || expected.count > keeperLimits.scan.maxEvidence) {
    throw new Error("Scope shard metadata exceeds the hard limits");
  }
  await validateCacheFile(layout, path, false);
  const identity = await captureSecurePathIdentity(layout, path, "file");
  await hooks.afterShardIdentity?.(identity);
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== BigInt(identity.dev) || opened.ino !== BigInt(identity.ino)) {
      throw new Error("Scope shard handle identity does not match the captured path");
    }
    assertSecureOwnerFileMetadata(opened, path, 1n);
    if (opened.size !== BigInt(expected.bytes)) throw new Error("Scope shard length does not match metadata");
    const digest = createHash("sha256");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const values: T[] = [];
    let consumed = 0;
    let pending = "";
    let pendingBytes = 0;
    const finish = (line: string) => {
      if (line.length === 0) throw new Error("Scope shard contains an empty JSON line");
      const parsed = JSON.parse(line) as unknown;
      if (JSON.stringify(parsed) !== line) throw new Error("Scope shard JSON line is not canonical");
      values.push(parse(parsed));
      if (values.length > expected.count) throw new Error("Scope shard count exceeds metadata");
    };
    for await (const value of handle.createReadStream({ autoClose: false, highWaterMark: 64 * 1024 })) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      consumed += chunk.byteLength;
      if (consumed > expected.bytes) throw new Error("Scope shard length exceeds metadata");
      await hooks.onBoundedFileRead?.(path, chunk.byteLength);
      digest.update(chunk);
      const decoded = decoder.decode(chunk, { stream: true });
      let start = 0;
      for (;;) {
        const newline = decoded.indexOf("\n", start);
        if (newline < 0) break;
        const part = decoded.slice(start, newline);
        pending += part;
        pendingBytes += Buffer.byteLength(part, "utf8");
        if (pendingBytes > maximumJsonLineBytes) throw new Error("Scope shard JSON line exceeds its byte budget");
        finish(pending);
        pending = "";
        pendingBytes = 0;
        start = newline + 1;
      }
      const remainder = decoded.slice(start);
      pending += remainder;
      pendingBytes += Buffer.byteLength(remainder, "utf8");
      if (pendingBytes > maximumJsonLineBytes) throw new Error("Scope shard JSON line exceeds its byte budget");
    }
    const tail = decoder.decode();
    if (tail.length > 0) {
      pending += tail;
      pendingBytes += Buffer.byteLength(tail, "utf8");
    }
    if (pending.length > 0 || (expected.bytes > 0 && values.length === 0)) {
      throw new Error("Scope shard must end with a newline");
    }
    if (consumed !== expected.bytes || values.length !== expected.count ||
        `sha256:${digest.digest("hex")}` !== expected.hash) {
      throw new Error("Scope shard hash, length, or count does not match metadata");
    }
    const finalHandle = await handle.stat({ bigint: true });
    if (finalHandle.dev !== opened.dev || finalHandle.ino !== opened.ino || finalHandle.size !== opened.size) {
      throw new Error("Scope shard handle identity changed during read");
    }
    assertSecureOwnerFileMetadata(finalHandle, path, 1n);
    await hooks.beforeShardFinalIdentity?.(identity);
    await validateSecurePathIdentity(layout, identity);
    return { values, identity };
  } finally {
    await handle.close();
  }
}

function parseDetail(value: unknown): Record<string, unknown> {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maximumJsonLineBytes) throw new Error("Scope detail exceeds its byte budget");
  return scopeDriftDetailSchema.parse(value) as Record<string, unknown>;
}

function validateScopeShardRelationships(files: ScopeFileEntry[], evidence: Evidence[]): void {
  const byPath = new Map<string, ScopeFileEntry>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const key = windowsRepositoryPathKey(file.path);
    if (byPath.has(key)) throw new Error("Scope file shard paths contain a Windows-equivalent alias");
    if (index > 0 && windowsRepositoryPathKey(files[index - 1]!.path).localeCompare(key, "en-US") >= 0) {
      throw new Error("Scope file shard paths must be unique and strictly ordered");
    }
    byPath.set(key, file);
  }
  const evidenceCounts = new Map<string, number>();
  for (let index = 0; index < evidence.length; index += 1) {
    const item = evidence[index]!;
    const key = windowsRepositoryPathKey(item.path);
    const file = byPath.get(key);
    if (!file || item.line > file.lineCount) throw new Error("Scope evidence does not bind to its file line count");
    if (file.path !== item.path) throw new Error("Scope evidence path casing does not exactly bind to its file");
    if (index > 0) {
      const previous = evidence[index - 1]!;
      if (windowsRepositoryPathKey(previous.path).localeCompare(key, "en-US") > 0 ||
          (previous.path === item.path && previous.line >= item.line)) {
        throw new Error("Scope evidence paths and lines must be unique and strictly ordered");
      }
    }
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1);
  }
  for (const file of files) {
    if ((evidenceCounts.get(windowsRepositoryPathKey(file.path)) ?? 0) !== file.lineCount) {
      throw new Error("Scope file line count does not match its evidence records");
    }
  }
}

function validateCandidateModules(metadata: ScopeIndexMetadataV3, files: ScopeFileEntry[]): void {
  if (JSON.stringify(metadata.candidateModules) !== JSON.stringify(scopeCandidateModulesForFiles(files))) {
    throw new Error("Scope candidate module counts do not match loaded file evidence");
  }
}

function validateDriftShardRelationships(
  metadata: ScopeIndexMetadataV3,
  details: Record<string, unknown>[] | undefined
): void {
  if (!metadata.driftSummary && details === undefined) return;
  if (!metadata.driftSummary || details === undefined) throw new Error("Scope drift summary and detail shard must be paired");
  const counts = { new: 0, modified: 0, deleted: 0 };
  const invalidated = new Set<string>();
  for (const detail of details) {
    if (detail.kind === "new" || detail.kind === "modified" || detail.kind === "deleted") counts[detail.kind] += 1;
    if (typeof detail.recordId === "string") invalidated.add(detail.recordId);
  }
  if (counts.new !== metadata.driftSummary.counts.new || counts.modified !== metadata.driftSummary.counts.modified ||
      counts.deleted !== metadata.driftSummary.counts.deleted) {
    throw new Error("Scope drift summary counts do not match exact details");
  }
  const declared = [...metadata.driftSummary.invalidatedRecordIds].sort((left, right) => left.localeCompare(right, "en-US"));
  const actual = [...invalidated].sort((left, right) => left.localeCompare(right, "en-US"));
  if (JSON.stringify(declared) !== JSON.stringify(actual)) {
    throw new Error("Scope drift invalidated record IDs do not match exact details");
  }
}

async function validateSnapshotDirectory(
  layout: SecureCacheLayout,
  target: string,
  bindings: SnapshotBindings,
  hooks: ScopeStoreIo = {}
): Promise<ValidatedSnapshot> {
  const identity = await captureSecurePathIdentity(layout, target, "directory");
  const metadataPath = join(target, "metadata.json");
  await hooks.beforeReadShard?.(metadataPath);
  const metadataFile = await readBoundedCacheFile(layout, metadataPath, maximumMetadataBytes, hooks);
  let metadataValue: unknown;
  try {
    metadataValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(metadataFile.bytes));
  } catch {
    throw new Error("Scope snapshot metadata is not valid JSON");
  }
  const metadata = scopeIndexMetadataV3Schema.parse(metadataValue);
  const declaredSnapshotBytes = metadataFile.bytes.byteLength + metadata.shards.files.bytes +
    metadata.shards.evidence.bytes + (metadata.shards.details?.bytes ?? 0);
  if (!Number.isSafeInteger(declaredSnapshotBytes) || declaredSnapshotBytes > keeperLimits.scan.maxAggregateBytes ||
      declaredSnapshotBytes > scopeProjectByteLimit) {
    throw new Error("Scope snapshot aggregate shard metadata exceeds the hard byte limit");
  }
  const derivedScopeKey = scopePathsKey(metadata.scopePaths);
  const derivedCursorScopeKey = scopeCursorKeyFromProjectKey(metadata.projectKey, derivedScopeKey);
  if (metadata.scopeKey !== derivedScopeKey || metadata.cursorScopeKey !== derivedCursorScopeKey) {
    throw new Error("Scope snapshot metadata scope binding is invalid");
  }
  if (metadata.projectKey !== bindings.projectKey || metadata.cursorScopeKey !== bindings.cursorScopeKey ||
      metadata.snapshotId !== bindings.snapshotId || (bindings.scopeKey !== undefined && metadata.scopeKey !== bindings.scopeKey) ||
      (bindings.scopePaths !== undefined && JSON.stringify(metadata.scopePaths) !== JSON.stringify(bindings.scopePaths))) {
    throw new Error("Scope snapshot metadata binding is invalid");
  }
  await validateSecurePathIdentity(layout, identity);
  await exactSnapshotEntries(target, metadata);
  const filesPath = join(target, metadata.shards.files.path);
  const evidencePath = join(target, metadata.shards.evidence.path);
  await hooks.beforeReadShard?.(filesPath);
  const filesShard = await readJsonLinesShard(layout, filesPath, metadata.shards.files, (value) => scopeFileEntrySchema.parse(value), hooks);
  const files = filesShard.values;
  await hooks.beforeReadShard?.(evidencePath);
  const evidenceShard = await readJsonLinesShard(layout, evidencePath, metadata.shards.evidence, (value) => scopeEvidenceSchema.parse(value), hooks);
  const evidence = evidenceShard.values;
  let details: Record<string, unknown>[] | undefined;
  let detailsIdentity: SecurePathIdentity | undefined;
  if (metadata.shards.details) {
    const detailsPath = join(target, metadata.shards.details.path);
    await hooks.beforeReadShard?.(detailsPath);
    const detailsShard = await readJsonLinesShard(layout, detailsPath, metadata.shards.details, parseDetail, hooks);
    details = detailsShard.values;
    detailsIdentity = detailsShard.identity;
  }
  validateScopeShardRelationships(files, evidence);
  validateCandidateModules(metadata, files);
  validateDriftShardRelationships(metadata, details);
  const derivedSnapshotId = scopeSnapshotIdForContent({
    scopePaths: metadata.scopePaths,
    files,
    evidence,
    candidateModules: metadata.candidateModules,
    omissions: metadata.omissions,
    ...(details === undefined ? {} : { details }),
    ...(metadata.driftSummary === undefined ? {} : { driftSummary: metadata.driftSummary })
  });
  if (metadata.snapshotId !== derivedSnapshotId) throw new Error("Scope snapshot content binding is invalid");
  await hooks.afterSnapshotReads?.(target);
  await validateSecurePathIdentity(layout, identity);
  await exactSnapshotEntries(target, metadata);
  await Promise.all([
    validateSecurePathIdentity(layout, metadataFile.identity),
    validateSecurePathIdentity(layout, filesShard.identity),
    validateSecurePathIdentity(layout, evidenceShard.identity),
    ...(detailsIdentity ? [validateSecurePathIdentity(layout, detailsIdentity)] : [])
  ]);
  return { identity, metadata, metadataBytes: metadataFile.bytes.byteLength, files, evidence, ...(details ? { details } : {}) };
}

const scopeSnapshotLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const scopeProjectByteLimit = 256 * 1024 * 1024;
const scopeGlobalByteLimit = 1024 * 1024 * 1024;
const maximumMetadataBytes = 8 * 1024 * 1024;
const maximumJsonLineBytes = 8 * 1024 * 1024 + 1024;

function shardMetadata(path: "files.jsonl" | "evidence.jsonl" | "details.jsonl", contents: string, count: number) {
  return {
    path,
    bytes: Buffer.byteLength(contents, "utf8"),
    hash: `sha256:${createHash("sha256").update(contents, "utf8").digest("hex")}`,
    count
  } as const;
}

function logicalNow(input: PersistScopeIndexInput): number {
  const now = input.options.now?.() ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + scopeSnapshotLifetimeMs)) {
    throw new Error("Scope snapshot clock is invalid");
  }
  return now;
}

function serializeScopeIndex(input: PersistScopeIndexInput): SerializedScopeIndex {
  const createdAt = logicalNow(input);
  const projectKey = scopeProjectKey(input.projectRoot);
  const scopeKey = scopePathsKey(input.scopePaths);
  const cursorScopeKey = scopeCursorKey(input.projectRoot, scopeKey);
  const normalizedFiles = input.files.map((value) => scopeFileEntrySchema.parse(value));
  const normalizedEvidence = input.evidence.map((value) => scopeEvidenceSchema.parse(value));
  const normalizedModules = (input.candidateModules ?? []).map((value) => candidateModuleSchema.parse(value));
  const normalizedOmissions = (input.omissions ?? []).map((value) => scopeOmissionSchema.parse(value));
  const normalizedDetails = input.details?.map((value) => parseDetail(value));
  const files = jsonLines(normalizedFiles);
  const evidence = jsonLines(normalizedEvidence);
  const details = normalizedDetails === undefined ? undefined : jsonLines(normalizedDetails);
  const parsedMetadata: ScopeIndexMetadataV3 = {
    version: 3,
    createdAt,
    expiresAt: createdAt + scopeSnapshotLifetimeMs,
    projectKey,
    scopeKey,
    cursorScopeKey,
    scopePaths: input.scopePaths,
    snapshotId: input.snapshotId,
    shards: {
      files: shardMetadata("files.jsonl", files, normalizedFiles.length),
      evidence: shardMetadata("evidence.jsonl", evidence, normalizedEvidence.length),
      ...(details === undefined ? {} : { details: shardMetadata("details.jsonl", details, normalizedDetails!.length) })
    },
    totals: {
      files: normalizedFiles.length,
      evidence: normalizedEvidence.length,
      omitted: normalizedOmissions.length,
      ...(details === undefined ? {} : { details: normalizedDetails!.length })
    },
    candidateModules: normalizedModules,
    omissions: normalizedOmissions,
    ...(input.driftSummary === undefined ? {} : { driftSummary: input.driftSummary })
  };
  const parsed = scopeIndexMetadataV3Schema.parse(parsedMetadata);
  validateScopeShardRelationships(normalizedFiles, normalizedEvidence);
  validateCandidateModules(parsed, normalizedFiles);
  validateDriftShardRelationships(parsed, normalizedDetails);
  const derivedSnapshotId = scopeSnapshotIdForContent({
    scopePaths: parsed.scopePaths,
    files: normalizedFiles,
    evidence: normalizedEvidence,
    candidateModules: normalizedModules,
    omissions: normalizedOmissions,
    ...(normalizedDetails === undefined ? {} : { details: normalizedDetails }),
    ...(parsed.driftSummary === undefined ? {} : { driftSummary: parsed.driftSummary })
  });
  if (input.snapshotId !== derivedSnapshotId) throw new Error("Scope snapshot ID does not bind its exact content");
  const metadata = `${JSON.stringify(parsed, null, 2)}\n`;
  if (Buffer.byteLength(metadata, "utf8") > maximumMetadataBytes ||
      parsed.shards.files.bytes > keeperLimits.scan.maxAggregateBytes ||
      parsed.shards.evidence.bytes > keeperLimits.scan.maxAggregateBytes ||
      (parsed.shards.details?.bytes ?? 0) > keeperLimits.scan.maxAggregateBytes) {
    throw new Error("Scope snapshot serialization exceeds its byte budget");
  }
  const snapshotBytes = Buffer.byteLength(metadata, "utf8") + parsed.shards.files.bytes +
    parsed.shards.evidence.bytes + (parsed.shards.details?.bytes ?? 0);
  if (snapshotBytes > scopeProjectByteLimit || snapshotBytes > scopeGlobalByteLimit) {
    throw new Error("Scope snapshot cannot fit within the project and global cache quotas");
  }
  return { metadata, files, evidence, ...(details === undefined ? {} : { details }), parsedMetadata: parsed };
}

async function inspectExistingSnapshot(
  target: string,
  expected: SerializedScopeIndex,
  hooks: ScopeStoreIo,
  layout: SecureCacheLayout
): Promise<ExistingSnapshot> {
  try {
    const validated = await validateSnapshotDirectory(layout, target, {
      projectKey: expected.parsedMetadata.projectKey,
      scopeKey: expected.parsedMetadata.scopeKey,
      cursorScopeKey: expected.parsedMetadata.cursorScopeKey,
      scopePaths: expected.parsedMetadata.scopePaths,
      snapshotId: expected.parsedMetadata.snapshotId
    }, hooks);
    const comparableActual = {
      ...validated.metadata,
      createdAt: 0,
      expiresAt: scopeSnapshotLifetimeMs
    };
    const comparableExpected = {
      ...expected.parsedMetadata,
      createdAt: 0,
      expiresAt: scopeSnapshotLifetimeMs
    };
    return JSON.stringify(comparableActual) === JSON.stringify(comparableExpected) ? "matching" : "invalid";
  } catch (error) {
    return missingPath(error) ? "missing" : "invalid";
  }
}

type ClaimResolution = "matching" | "retry" | "deadline";

interface ClaimEpochState {
  claim?: PublicationClaim;
}

async function reconcileSnapshotPublication(
  target: string,
  expected: SerializedScopeIndex,
  hooks: ScopeStoreIo,
  layout: SecureCacheLayout,
  deadline: number,
  nowMs: () => number,
  epoch: ClaimEpochState
): Promise<ClaimResolution> {
  let attempt = 0;
  for (;;) {
    if (nowMs() >= deadline) return "deadline";
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "absent") {
      epoch.claim = undefined;
      const winner = await inspectExistingSnapshot(target, expected, hooks, layout);
      await hooks.afterTargetInspection?.(target, winner);
      const afterInspection = await observeOwnedSnapshotPublicationClaim(layout, target);
      if (afterInspection.state !== "absent") {
        epoch.claim = afterInspection.claim;
        await hooks.afterTargetClaimRecheck?.(afterInspection.claim);
        continue;
      }
      if (winner === "matching") return "matching";
      if (winner === "invalid") throw new Error("Concurrent scope snapshot target is invalid");
      return nowMs() >= deadline ? "deadline" : "retry";
    }
    if (epoch.claim && !samePublicationClaimEpoch(epoch.claim, observation.claim)) {
      throw new Error("Concurrent scope snapshot publication claim identity or owner metadata changed");
    }
    epoch.claim = observation.claim;
    const liveness = publicationClaimLiveness(observation.claim);
    if (liveness === "dead") {
      await safeRemoveOwnedPublicationClaim(layout, observation.claim);
      epoch.claim = undefined;
      await hooks.afterStaleClaimRelease?.();
      continue;
    }
    if (liveness === "ambiguous") {
      throw new Error("Concurrent scope snapshot publication claim owner liveness is ambiguous");
    }
    attempt += 1;
    const remaining = deadline - nowMs();
    if (remaining <= 0) return "deadline";
    const operation = async () => {
      await new Promise<void>((accept) => setTimeout(accept, Math.min(25, remaining)));
    };
    const waitResult = hooks.waitForTargetClaim
      ? await hooks.waitForTargetClaim(observation.claim, attempt, operation)
      : await operation().then(() => "continue" as const);
    if (waitResult === "deadline" || nowMs() >= deadline) return "deadline";
  }
}

async function finalReconcileSnapshotPublication(
  target: string,
  expected: SerializedScopeIndex,
  hooks: ScopeStoreIo,
  layout: SecureCacheLayout,
  mayReclaimDead: boolean,
  epoch: ClaimEpochState
): Promise<"matching"> {
  let canReclaimDead = mayReclaimDead;
  const handleOwned = async (claim: PublicationClaim): Promise<void> => {
    if (epoch.claim && !samePublicationClaimEpoch(epoch.claim, claim)) {
      throw new Error("Concurrent scope snapshot publication claim identity or owner metadata changed at the acquisition deadline");
    }
    epoch.claim = claim;
    const liveness = publicationClaimLiveness(claim);
    if (liveness === "ambiguous") {
      throw new Error("Concurrent scope snapshot publication claim owner liveness is ambiguous at the acquisition deadline");
    }
    if (liveness === "alive") {
      throw new Error("Concurrent scope snapshot publication is still owned by a live process at the acquisition deadline");
    }
    if (!canReclaimDead) throw new Error("Scope snapshot acquisition deadline expired during stale-claim churn");
    await safeRemoveOwnedPublicationClaim(layout, claim);
    epoch.claim = undefined;
    canReclaimDead = false;
    await hooks.afterStaleClaimRelease?.();
  };

  let useHooks = true;
  for (;;) {
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "owned") {
      await handleOwned(observation.claim);
      continue;
    }
    epoch.claim = undefined;
    const inspectionHooks = useHooks ? hooks : {};
    const winner = await inspectExistingSnapshot(target, expected, inspectionHooks, layout);
    if (useHooks) await hooks.afterTargetInspection?.(target, winner);
    useHooks = false;
    const afterInspection = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (afterInspection.state === "owned") {
      await handleOwned(afterInspection.claim);
      continue;
    }
    epoch.claim = undefined;
    // The authoritative target read is deliberately after the final claim-absence
    // observation, closing the claim -> target -> claim -> fresh-target deadline window.
    const freshWinner = await inspectExistingSnapshot(target, expected, {}, layout);
    if (freshWinner === "matching") return "matching";
    if (freshWinner === "invalid") throw new Error("Concurrent scope snapshot target is invalid at the acquisition deadline");
    throw new Error("Scope snapshot acquisition deadline expired before a publisher or matching target won");
  }
}

async function writeBuildShard(
  layout: SecureCacheLayout,
  path: string,
  contents: string,
  hooks: ScopeStoreIo
): Promise<void> {
  const operation = async () => { await publishExclusiveFile(layout, path, contents); };
  if (hooks.writeShard) await hooks.writeShard(path, contents, operation);
  else await operation();
  await validateCacheFile(layout, path, false);
}

interface ScopeAccessBody {
  version: 1;
  projectKey: string;
  cursorScopeKey: string;
  snapshotId: string;
  createdAt: number;
  expiresAt: number;
  accessedAt: number;
}

interface ScopeAccessRecord extends ScopeAccessBody {
  hmac: string;
}

const scopeAccessKeyBytes = 32;
const maximumAccessRecordBytes = 4096;

function accessBodyJson(body: ScopeAccessBody): string {
  return JSON.stringify({
    version: body.version,
    projectKey: body.projectKey,
    cursorScopeKey: body.cursorScopeKey,
    snapshotId: body.snapshotId,
    createdAt: body.createdAt,
    expiresAt: body.expiresAt,
    accessedAt: body.accessedAt
  });
}

function accessMac(key: Buffer, body: ScopeAccessBody): string {
  return createHmac("sha256", key).update(accessBodyJson(body), "utf8").digest("hex");
}

async function loadOrCreateAccessKey(layout: SecureCacheLayout): Promise<Buffer> {
  const path = join(layout.root, "scope-index-hmac.key");
  const read = async (): Promise<Buffer | undefined> => {
    try {
      const result = await readBoundedCacheFile(layout, path, scopeAccessKeyBytes);
      if (result.bytes.byteLength !== scopeAccessKeyBytes) throw new Error("Scope access registry key is invalid");
      return result.bytes;
    } catch (error) {
      if (missingPath(error)) return undefined;
      throw error;
    }
  };
  const existing = await read();
  if (existing) return existing;
  try {
    await publishExclusiveFile(layout, path, randomBytes(scopeAccessKeyBytes));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const created = await read();
  if (!created) throw new Error("Scope access registry key could not be created");
  return created;
}

function accessPath(layout: SecureCacheLayout, metadata: Pick<ScopeIndexMetadataV3, "projectKey" | "cursorScopeKey" | "snapshotId">): string {
  return join(
    layout.indexes,
    "v3",
    "access",
    metadata.projectKey,
    metadata.cursorScopeKey,
    `${metadata.snapshotId.slice("sha256:".length)}.json`
  );
}

function pendingAccessPath(
  layout: SecureCacheLayout,
  metadata: Pick<ScopeIndexMetadataV3, "projectKey" | "cursorScopeKey" | "snapshotId">
): string {
  return `${accessPath(layout, metadata)}.pending`;
}

function accessRecordBytes(record: ScopeAccessRecord): string {
  return `${JSON.stringify(record)}\n`;
}

function accessRecordPhysicalBytes(metadata: ScopeAccessMetadata, accessedAt: number): number {
  return Buffer.byteLength(accessRecordBytes({
    version: 1,
    projectKey: metadata.projectKey,
    cursorScopeKey: metadata.cursorScopeKey,
    snapshotId: metadata.snapshotId,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    accessedAt,
    hmac: "0".repeat(64)
  }), "utf8");
}

type ScopeAccessMetadata = Pick<
  ScopeIndexMetadataV3,
  "projectKey" | "cursorScopeKey" | "snapshotId" | "createdAt" | "expiresAt"
>;

async function readAccessFile(
  layout: SecureCacheLayout,
  path: string,
  metadata: ScopeAccessMetadata | undefined,
  key: Buffer,
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<{ record: ScopeAccessRecord; identity: SecurePathIdentity; physicalBytes: number } | undefined> {
  let file: Awaited<ReturnType<typeof readBoundedCacheFile>>;
  try {
    file = await readBoundedCacheFile(layout, path, maximumAccessRecordBytes, hooks);
  } catch (error) {
    if (missingPath(error)) return undefined;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes));
  } catch {
    throw new Error("Scope access registry record is not valid JSON");
  }
  if (!exactKeys(value, [
    "version", "projectKey", "cursorScopeKey", "snapshotId", "createdAt", "expiresAt", "accessedAt", "hmac"
  ])) {
    throw new Error("Scope access registry record schema is invalid");
  }
  const object = value as Record<string, unknown>;
  if (object.version !== 1 || typeof object.projectKey !== "string" || !/^[a-f0-9]{64}$/u.test(object.projectKey) ||
      typeof object.cursorScopeKey !== "string" || !/^[a-f0-9]{64}$/u.test(object.cursorScopeKey) ||
      typeof object.snapshotId !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(object.snapshotId) ||
      !Number.isSafeInteger(object.createdAt) || !Number.isSafeInteger(object.expiresAt) ||
      Number(object.createdAt) < 0 || Number(object.expiresAt) - Number(object.createdAt) !== scopeSnapshotLifetimeMs ||
      !Number.isSafeInteger(object.accessedAt) || Number(object.accessedAt) < 0 ||
      typeof object.hmac !== "string" || !/^[a-f0-9]{64}$/u.test(object.hmac)) {
    throw new Error("Scope access registry record binding is invalid");
  }
  if (metadata && (object.projectKey !== metadata.projectKey || object.cursorScopeKey !== metadata.cursorScopeKey ||
      object.snapshotId !== metadata.snapshotId || object.createdAt !== metadata.createdAt || object.expiresAt !== metadata.expiresAt)) {
    throw new Error("Scope access registry record binding is invalid");
  }
  const body: ScopeAccessBody = {
    version: 1,
    projectKey: object.projectKey,
    cursorScopeKey: object.cursorScopeKey,
    snapshotId: object.snapshotId,
    createdAt: Number(object.createdAt),
    expiresAt: Number(object.expiresAt),
    accessedAt: Number(object.accessedAt)
  };
  const expected = Buffer.from(accessMac(key, body), "hex");
  const supplied = Buffer.from(object.hmac, "hex");
  if (supplied.byteLength !== expected.byteLength || !timingSafeEqual(supplied, expected)) {
    throw new Error("Scope access registry record authentication failed");
  }
  return { record: { ...body, hmac: object.hmac }, identity: file.identity, physicalBytes: file.bytes.byteLength };
}

function samePhysicalFile(left: SecurePathIdentity, right: SecurePathIdentity): boolean {
  return BigInt(left.dev) === BigInt(right.dev) && BigInt(left.ino) === BigInt(right.ino);
}

async function readAccessRecord(
  layout: SecureCacheLayout,
  metadata: ScopeAccessMetadata,
  key: Buffer,
  required: boolean,
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<{
  record?: ScopeAccessRecord;
  identity?: SecurePathIdentity;
  primaryIdentity?: SecurePathIdentity;
  pendingIdentity?: SecurePathIdentity;
  physicalBytes: number;
}> {
  const [primary, pending] = await Promise.all([
    readAccessFile(layout, accessPath(layout, metadata), metadata, key, hooks),
    readAccessFile(layout, pendingAccessPath(layout, metadata), metadata, key, hooks)
  ]);
  if (!primary && !pending) {
    if (required) throw Object.assign(new Error("Scope access registry record is missing"), { code: "ENOENT" });
    return { physicalBytes: 0 };
  }
  if (primary && pending && samePhysicalFile(primary.identity, pending.identity)) {
    throw new Error("Scope access registry primary and pending records alias one physical file");
  }
  const selected = !primary ? pending! : !pending ? primary :
    pending.record.accessedAt > primary.record.accessedAt ? pending : primary;
  return {
    record: selected.record,
    identity: selected.identity,
    physicalBytes: (primary?.physicalBytes ?? 0) + (pending?.physicalBytes ?? 0),
    ...(primary ? { primaryIdentity: primary.identity } : {}),
    ...(pending ? { pendingIdentity: pending.identity } : {})
  };
}

async function writeAccessRecord(
  layout: SecureCacheLayout,
  metadata: ScopeAccessMetadata,
  accessedAt: number,
  requireExisting: boolean,
  hooks: ScopeStoreIo = {},
  heldPruneClaim?: PublicationClaim
): Promise<void> {
  if (heldPruneClaim) {
    await validatePublicationClaim(layout, heldPruneClaim);
    await writeAccessRecordUnderPruneLock(
      layout, metadata, accessedAt, requireExisting, hooks, heldPruneClaim, false
    );
    await validatePublicationClaim(layout, heldPruneClaim);
    return;
  }
  const ownedPruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
  let failure: unknown;
  try {
    await validatePublicationClaim(layout, ownedPruneClaim);
    await writeAccessRecordUnderPruneLock(
      layout, metadata, accessedAt, requireExisting, hooks, ownedPruneClaim, true
    );
    await validatePublicationClaim(layout, ownedPruneClaim);
  } catch (error) {
    failure = error;
  }
  try {
    await safeRemoveOwnedPublicationClaim(layout, ownedPruneClaim);
  } catch (cleanupError) {
    if (failure !== undefined) {
      throw new AggregateError(
        [failure, cleanupError],
        "Scope access update and prune-claim cleanup both failed",
        { cause: failure }
      );
    }
    throw cleanupError;
  }
  if (failure !== undefined) throw failure;
}

async function writeAccessRecordUnderPruneLock(
  layout: SecureCacheLayout,
  metadata: ScopeAccessMetadata,
  accessedAt: number,
  requireExisting: boolean,
  hooks: ScopeStoreIo,
  pruneClaim: PublicationClaim,
  reserveUpdatePeak: boolean
): Promise<void> {
  if (!Number.isSafeInteger(accessedAt) || accessedAt < 0) throw new Error("Scope access time is invalid");
  const key = await loadOrCreateAccessKey(layout);
  const path = accessPath(layout, metadata);
  const pendingPath = pendingAccessPath(layout, metadata);
  await createSecureCacheDirectory(layout, dirname(path));
  const accessRecord = (time: number): ScopeAccessRecord => {
    const body: ScopeAccessBody = {
      version: 1,
      projectKey: metadata.projectKey,
      cursorScopeKey: metadata.cursorScopeKey,
      snapshotId: metadata.snapshotId,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      accessedAt: time
    };
    return { ...body, hmac: accessMac(key, body) };
  };
  const reserveAccessPublication = async (record: ScopeAccessRecord): Promise<void> => {
    if (!reserveUpdatePeak) return;
    const protectedSnapshot = join(
      layout.indexes,
      "v3",
      "snapshots",
      metadata.projectKey,
      metadata.cursorScopeKey,
      metadata.snapshotId.slice("sha256:".length)
    );
    await pruneScopeIndexesUnderLock(layout, protectedSnapshot, {
      now: () => accessedAt,
      ...hooks.prospectivePruneLimits?.()
    }, hooks, {
      projectKey: metadata.projectKey,
      cursorScopeKey: metadata.cursorScopeKey,
      bytes: Buffer.byteLength(accessRecordBytes(record), "utf8") + Number(maximumSnapshotClaimArtifactBytes),
      snapshotCount: 0
    });
    await validatePublicationClaim(layout, pruneClaim);
  };
  let previous = await readAccessRecord(layout, metadata, key, requireExisting, hooks);
  if (!previous.primaryIdentity && !previous.pendingIdentity) {
    await publishExclusiveFile(layout, path, accessRecordBytes(accessRecord(accessedAt)));
    await hooks.afterInitialAccessPublish?.(path);
    return;
  }
  if (!previous.primaryIdentity && previous.record) {
    await reserveAccessPublication(previous.record);
    await publishExclusiveFile(layout, path, accessRecordBytes(previous.record));
    previous = await readAccessRecord(layout, metadata, key, true, hooks);
  }
  if (!previous.primaryIdentity) throw new Error("Scope access registry primary record could not be recovered");
  const effectiveAccessedAt = Math.max(accessedAt, previous.record?.accessedAt ?? accessedAt);
  const record = accessRecord(effectiveAccessedAt);
  await reserveAccessPublication(record);
  if (previous.pendingIdentity) await safeRemoveExactCacheFile(layout, previous.pendingIdentity);
  await publishExclusiveFile(layout, pendingPath, accessRecordBytes(record));
  await hooks.afterAccessPendingPublish?.(pendingPath);
  await safeRemoveExactCacheFile(layout, previous.primaryIdentity);
  await hooks.afterAccessPrimaryRemove?.(path);
  await publishExclusiveFile(layout, path, accessRecordBytes(record));
  await hooks.afterAccessPrimaryPublish?.(path);
  const completed = await readAccessRecord(layout, metadata, key, true, hooks);
  if (!completed.pendingIdentity || !completed.primaryIdentity || completed.record?.accessedAt !== effectiveAccessedAt) {
    throw new Error("Scope access registry replacement did not publish both authenticated records");
  }
  await safeRemoveExactCacheFile(layout, completed.pendingIdentity);
}

async function removeAccessRecordFiles(
  layout: SecureCacheLayout,
  access: Awaited<ReturnType<typeof readAccessRecord>>
): Promise<void> {
  if (access.primaryIdentity) await safeRemoveExactCacheFile(layout, access.primaryIdentity);
  if (access.pendingIdentity) await safeRemoveExactCacheFile(layout, access.pendingIdentity);
}

export async function persistScopeIndex(
  input: PersistScopeIndexInput,
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<PersistedScopeIndex> {
  const nowMs = hooks.nowMs ?? (() => performance.now());
  const acquisitionDeadline = nowMs() + PUBLICATION_CLAIM_WAIT_MS;
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const projectKey = scopeProjectKey(input.projectRoot);
  const scopeKey = scopePathsKey(input.scopePaths);
  const cursorScopeKey = scopeCursorKey(input.projectRoot, scopeKey);
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.snapshotId)) throw new Error("Scope snapshot ID is invalid");
  const parent = join(layout.indexes, "v3", "snapshots", projectKey, cursorScopeKey);
  await createSecureCacheDirectory(layout, parent);
  const target = join(parent, input.snapshotId.slice("sha256:".length));
  const expected = serializeScopeIndex(input);
  const prospectiveSnapshotBytes = Buffer.byteLength(expected.metadata, "utf8") + Buffer.byteLength(expected.files, "utf8") +
    Buffer.byteLength(expected.evidence, "utf8") + (expected.details === undefined ? 0 : Buffer.byteLength(expected.details, "utf8"));
  const prospectiveBytes = prospectiveSnapshotBytes +
    accessRecordPhysicalBytes(expected.parsedMetadata, expected.parsedMetadata.createdAt) + Number(maximumSnapshotClaimArtifactBytes);
  const persistedResult = (metadata: ScopeIndexMetadataV3): PersistedScopeIndex => ({
    cacheRoot: target,
    scopeKey: metadata.scopeKey,
    cursorScopeKey: metadata.cursorScopeKey,
    snapshotId: metadata.snapshotId,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt
  });
  const existingResult = async (): Promise<PersistedScopeIndex> => {
    const useClaim = await acquireSnapshotUseClaim(layout, target, hooks);
    let recreate = false;
    let value: PersistedScopeIndex | undefined;
    let failure: unknown;
    try {
      const validated = await validateSnapshotDirectory(layout, target, {
        projectKey, scopeKey, cursorScopeKey, scopePaths: input.scopePaths, snapshotId: input.snapshotId
      });
      const now = logicalNow(input);
      if (now >= validated.metadata.expiresAt) {
        const key = await loadOrCreateAccessKey(layout);
        const access = await readAccessRecord(layout, validated.metadata, key, false, hooks);
        await validatePublicationClaim(layout, useClaim);
        await validateSecurePathIdentity(layout, validated.identity);
        await safeRemoveOwnedSnapshotDirectory(layout, validated.identity, true);
        await removeAccessRecordFiles(layout, access);
        recreate = true;
      } else {
        await writeAccessRecord(layout, validated.metadata, now, true, hooks);
        value = persistedResult(validated.metadata);
      }
    } catch (error) {
      failure = error;
    }
    try {
      await safeRemoveOwnedPublicationClaim(layout, useClaim);
    } catch (cleanupError) {
      if (failure !== undefined) {
        throw new AggregateError([failure, cleanupError], "Scope snapshot reuse and claim cleanup both failed", { cause: failure });
      }
      throw cleanupError;
    }
    if (failure !== undefined) throw failure;
    if (recreate) return persistScopeIndex(input, hooks);
    if (!value) throw new Error("Scope snapshot reuse did not produce a result");
    await pruneScopeIndexes(layout, value.cacheRoot, { now: () => logicalNow(input) }, hooks);
    return value;
  };
  const claimEpoch: ClaimEpochState = {};
  let claim: PublicationClaim | undefined;
  while (!claim) {
    const resolution = await reconcileSnapshotPublication(target, expected, hooks, layout, acquisitionDeadline, nowMs, claimEpoch);
    if (resolution === "matching") return existingResult();
    if (resolution === "deadline") {
      await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
      return existingResult();
    }
    await hooks.beforeTargetClaimAcquire?.();
    if (nowMs() >= acquisitionDeadline) {
      await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
      return existingResult();
    }
    try {
      const acquired = await claimOwnedSnapshotDirectory(layout, target);
      if (nowMs() >= acquisitionDeadline) {
        await safeRemoveOwnedPublicationClaim(layout, acquired);
        await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
        return existingResult();
      }
      claim = acquired;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await hooks.afterTargetClaimCollision?.();
      if (nowMs() >= acquisitionDeadline) {
        await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
        return existingResult();
      }
    }
  }
  let build: SecurePathIdentity | undefined;
  let pruneClaim: PublicationClaim | undefined;
  let publishedIdentity: SecurePathIdentity | undefined;
  let result: PersistedScopeIndex | undefined;
  let primaryError: unknown;
  try {
    await hooks.afterTargetClaim?.(claim);
    await validatePublicationClaim(layout, claim);
    pruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
    await validatePublicationClaim(layout, pruneClaim);
    await pruneScopeIndexesUnderLock(layout, undefined, {
      now: () => logicalNow(input),
      ...hooks.prospectivePruneLimits?.()
    }, hooks, {
      projectKey,
      cursorScopeKey,
      bytes: prospectiveBytes,
      snapshotCount: 1
    });
    await validatePublicationClaim(layout, pruneClaim);
    await validatePublicationClaim(layout, claim);
    await hooks.beforeBuild?.(parent);
    build = await createOwnedBuildDirectory(layout, parent);
    const writes = await Promise.allSettled([
      writeBuildShard(layout, join(build.path, "files.jsonl"), expected.files, hooks),
      writeBuildShard(layout, join(build.path, "evidence.jsonl"), expected.evidence, hooks),
      writeBuildShard(layout, join(build.path, "metadata.json"), expected.metadata, hooks),
      ...(expected.details === undefined
        ? []
        : [writeBuildShard(layout, join(build.path, "details.jsonl"), expected.details, hooks)])
    ]);
    const failedWrite = writes.find((write): write is PromiseRejectedResult => write.status === "rejected");
    if (failedWrite) throw failedWrite.reason;
    await hooks.afterShardWrites?.(build);
    await validateSecurePathIdentity(layout, build);
    const shardPaths = [
      join(build.path, "files.jsonl"),
      join(build.path, "evidence.jsonl"),
      join(build.path, "metadata.json"),
      ...(expected.details === undefined ? [] : [join(build.path, "details.jsonl")])
    ];
    await validateCacheFiles(layout, shardPaths);
    await exactSnapshotEntries(build.path, expected.parsedMetadata);
    await validateSecurePathIdentity(layout, build);
    await validateSecurePathIdentity(layout, build);
    await hooks.beforePublish?.(build, target);
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    await validatePublicationClaim(layout, pruneClaim);
    const hiddenBuild = await inspectExistingSnapshot(build.path, expected, {}, layout);
    if (hiddenBuild !== "matching") throw new Error("Scope snapshot build contents are invalid before publication");
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    // Authenticate the immutable binding before the directory becomes visible. A
    // crash can now leave only an authenticated orphan sidecar, which inventory
    // can safely remove, never a visible snapshot with no authenticated access.
    await writeAccessRecord(
      layout,
      expected.parsedMetadata,
      expected.parsedMetadata.createdAt,
      false,
      hooks,
      pruneClaim
    );
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    await validatePublicationClaim(layout, pruneClaim);
    publishedIdentity = await publishOwnedBuildDirectory(layout, build, target, claim, {
      afterRename: hooks.afterBuildRename
    });
    const published = await inspectExistingSnapshot(target, expected, hooks, layout);
    if (published !== "matching") throw new Error("Published scope index snapshot is invalid");
    await hooks.afterPublish?.(target);
    await validateSecurePathIdentity(layout, publishedIdentity);
    const afterHook = await inspectExistingSnapshot(target, expected, {}, layout);
    if (afterHook !== "matching") throw new Error("Published scope index snapshot changed after publication hook");
    await validatePublicationClaim(layout, pruneClaim);
    result = persistedResult(expected.parsedMetadata);
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (primaryError !== undefined && publishedIdentity) {
    try {
      await safeRemoveOwnedSnapshotDirectory(layout, publishedIdentity);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (primaryError !== undefined) {
    try {
      const key = await loadOrCreateAccessKey(layout);
      const access = await readAccessRecord(layout, expected.parsedMetadata, key, false, hooks);
      await removeAccessRecordFiles(layout, access);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (build) {
    try {
      await hooks.beforeCleanup?.(build);
      await safeRemoveOwnedBuildDirectory(layout, build);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (pruneClaim) {
    try {
      await safeRemoveOwnedPublicationClaim(layout, pruneClaim);
    } catch (error) { cleanupErrors.push(error); }
  }
  try {
    await safeRemoveOwnedPublicationClaim(layout, claim);
  } catch (error) { cleanupErrors.push(error); }

  if (primaryError !== undefined) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [primaryError, ...cleanupErrors],
        "Scope snapshot persistence failed and cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  if (cleanupErrors.length === 1) throw cleanupErrors[0];
  if (cleanupErrors.length > 1) throw new AggregateError(cleanupErrors, "Scope snapshot cleanup was ambiguous");
  if (!result) throw new Error("Scope snapshot persistence did not produce a result");
  return result;
}

async function acquireSnapshotUseClaim(
  layout: SecureCacheLayout,
  target: string,
  hooks: ScopeStoreIo = {}
): Promise<PublicationClaim> {
  const nowMs = hooks.nowMs ?? (() => performance.now());
  const deadline = nowMs() + PUBLICATION_CLAIM_WAIT_MS;
  for (;;) {
    if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
    try {
      return await claimOwnedSnapshotDirectory(layout, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "absent") {
      if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
      continue;
    }
    const liveness = publicationClaimLiveness(observation.claim);
    if (liveness === "dead") {
      await safeRemoveOwnedPublicationClaim(layout, observation.claim);
      await hooks.afterStaleClaimRelease?.();
      if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
      continue;
    }
    if (liveness === "ambiguous") throw new Error("Scope snapshot use claim owner liveness is ambiguous");
    if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
    await new Promise<void>((accept) => setTimeout(accept, 25));
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export interface LoadScopeIndexInput {
  options: ServiceOptions;
  projectRoot: string;
  scopePaths?: string[];
  /** Project-bound cursor scope key when scopePaths are intentionally unavailable on continuation. */
  scopeKey?: string;
  snapshotId: string;
  now?: number;
}

export async function loadScopeIndex(
  input: LoadScopeIndexInput,
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<LoadedScopeIndex> {
  let claim: PublicationClaim | undefined;
  let loadedResult: LoadedScopeIndex | undefined;
  let snapshotDirectoryObserved = false;
  let primaryError: unknown;
  try {
    if (!/^sha256:[a-f0-9]{64}$/u.test(input.snapshotId)) throw new Error("Scope snapshot ID is invalid");
    const layout = await prepareSecureCache(input.options, input.projectRoot);
    const projectKey = scopeProjectKey(input.projectRoot);
    const rawScopeKey = input.scopePaths === undefined ? undefined : scopePathsKey(input.scopePaths);
    const cursorScopeKey = input.scopePaths === undefined
      ? input.scopeKey
      : scopeCursorKey(input.projectRoot, rawScopeKey!);
    if (typeof cursorScopeKey !== "string" || !/^[a-f0-9]{64}$/u.test(cursorScopeKey)) {
      throw new Error("Scope snapshot cursor binding is invalid");
    }
    const target = join(
      layout.indexes,
      "v3",
      "snapshots",
      projectKey,
      cursorScopeKey,
      input.snapshotId.slice("sha256:".length)
    );
    claim = await acquireSnapshotUseClaim(layout, target, hooks);
    await validatePublicationClaim(layout, claim);
    await captureSecurePathIdentity(layout, target, "directory");
    snapshotDirectoryObserved = true;
    const validated = await validateSnapshotDirectory(layout, target, {
      projectKey,
      cursorScopeKey,
      snapshotId: input.snapshotId,
      ...(rawScopeKey === undefined ? {} : { scopeKey: rawScopeKey, scopePaths: input.scopePaths })
    }, hooks);
    await hooks.afterLoadIdentity?.(validated.identity);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, validated.identity);
    const now = input.now ?? input.options.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Scope snapshot validation clock is invalid");
    if (now >= validated.metadata.expiresAt) throw new ScopeSnapshotRestartError("expired");
    await writeAccessRecord(layout, validated.metadata, now, true, hooks);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, validated.identity);
    loadedResult = deepFreeze<LoadedScopeIndex>({
      cacheRoot: target,
      snapshotId: validated.metadata.snapshotId,
      createdAt: validated.metadata.createdAt,
      expiresAt: validated.metadata.expiresAt,
      scopeKey: validated.metadata.scopeKey,
      cursorScopeKey: validated.metadata.cursorScopeKey,
      scopePaths: validated.metadata.scopePaths,
      files: validated.files,
      evidence: validated.evidence,
      ...(validated.details === undefined ? {} : { details: validated.details }),
      candidateModules: validated.metadata.candidateModules,
      omissions: validated.metadata.omissions,
      totals: validated.metadata.totals,
      ...(validated.metadata.driftSummary === undefined ? {} : { driftSummary: validated.metadata.driftSummary })
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (claim) {
      try {
        await hooks.beforeUseClaimCleanup?.(claim);
        await safeRemoveOwnedPublicationClaim(await prepareSecureCache(input.options, input.projectRoot), claim);
      } catch (cleanupError) {
        if (primaryError !== undefined) {
          primaryError = new AggregateError([primaryError, cleanupError], "Scope snapshot load and claim cleanup both failed", { cause: primaryError });
        } else {
          primaryError = cleanupError;
        }
      }
    }
  }
  if (primaryError instanceof ScopeSnapshotRestartError) throw primaryError;
  if (primaryError !== undefined) {
    throw new ScopeSnapshotRestartError(
      missingPath(primaryError) && !snapshotDirectoryObserved ? "missing" : "corrupt",
      { cause: primaryError }
    );
  }
  if (!loadedResult) throw new ScopeSnapshotRestartError("corrupt");
  return loadedResult;
}

export interface ScopePruneLimits {
  now?: () => number;
  ttlMs?: number;
  maxSnapshotsPerScope?: number;
  maxProjectBytes?: number;
  maxGlobalBytes?: number;
}

interface ScopePruneReservation {
  projectKey: string;
  cursorScopeKey: string;
  bytes: number;
  snapshotCount: 0 | 1;
}

interface ScopeInventoryEntry {
  path: string;
  identity: SecurePathIdentity;
  metadata: ScopeIndexMetadataV3;
  accessedAt: number;
  accessBytes: number;
  bytes: number;
}

interface ScopeInventory {
  entries: ScopeInventoryEntry[];
  projectArtifactBytes: Map<string, number>;
}

const defaultScopePruneLimits = Object.freeze({
  ttlMs: scopeSnapshotLifetimeMs,
  maxSnapshotsPerScope: 8,
  maxProjectBytes: scopeProjectByteLimit,
  maxGlobalBytes: scopeGlobalByteLimit
});

function pruneLimit(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return value;
}

function scopePruneLockTarget(layout: SecureCacheLayout): string {
  return join(layout.indexes, "v3", "prune", hashKey("scope-index-prune-lock"));
}

function sameResolvedPath(left: string, right: string): boolean {
  const leftPath = resolve(left);
  const rightPath = resolve(right);
  return process.platform === "win32"
    ? leftPath.toLocaleLowerCase("en-US") === rightPath.toLocaleLowerCase("en-US")
    : leftPath === rightPath;
}

async function boundedDirectoryEntries(
  path: string,
  work: CounterBudget,
  deadline: DeadlineBudget
): Promise<Awaited<ReturnType<typeof opendir>> extends infer _ ? Array<{ name: string; directory: boolean }> : never> {
  const values: Array<{ name: string; directory: boolean }> = [];
  let directory: Awaited<ReturnType<typeof opendir>>;
  try {
    directory = await opendir(path);
  } catch (error) {
    if (missingPath(error)) return values;
    throw error;
  }
  try {
    for await (const entry of directory) {
      deadline.check();
      work.consume();
      values.push({ name: entry.name, directory: entry.isDirectory() });
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  return values.sort((left, right) => left.name.localeCompare(right.name, "en-US"));
}

const canonicalUuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const publicationNoncePattern = "[a-f0-9]{32}";
const snapshotBuildPattern = new RegExp(`^\\.build-${canonicalUuidPattern}$`, "u");
const snapshotClaimPattern = /^\.publish-([a-f0-9]{64})$/u;
const snapshotClaimReleasePattern = new RegExp(`^\\.publish-[a-f0-9]{64}\\.release-${publicationNoncePattern}$`, "u");
const snapshotClaimInitializationPattern = new RegExp(`^\\.claim-${canonicalUuidPattern}\\.tmp$`, "u");
const accessClaimReleasePattern = new RegExp(
  `^\\.publish-[a-f0-9]{64}\\.json(?:\\.pending)?\\.release-${publicationNoncePattern}$`,
  "u"
);
const accessClaimInitializationPattern = new RegExp(`^\\.claim-${canonicalUuidPattern}\\.tmp$`, "u");
const accessPublicationTemporaryPattern = new RegExp(`^\\.${canonicalUuidPattern}\\.tmp$`, "u");
const maximumSnapshotClaimArtifactBytes = 4096n;

interface BoundedPublicationArtifact {
  path: string;
  metadata: BigIntStats;
  bytes: number;
}

function samePublicationArtifactVersion(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid &&
    left.mode === right.mode && left.nlink === right.nlink && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

function isPublicationArtifactSettlementTransition(left: BigIntStats, right: BigIntStats): boolean {
  return (left.nlink === 1n || left.nlink === 2n) && (right.nlink === 1n || right.nlink === 2n) &&
    left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid &&
    left.mode === right.mode && left.size === right.size && left.mtimeNs === right.mtimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

class ScopeInventorySettlementRestart extends Error {
  constructor(
    message: string,
    readonly artifactPath?: string,
    readonly epochEnded = false
  ) {
    super(message);
  }
}

async function validateBoundedPublicationArtifact(
  path: string,
  allowLinkedInitialization: boolean,
  hooks: ScopeStoreIo
): Promise<BoundedPublicationArtifact> {
  let metadata: BigIntStats;
  try {
    metadata = await lstat(path, { bigint: true });
  } catch (error) {
    if (missingPath(error)) {
      throw new ScopeInventorySettlementRestart("Scope publication artifact settled during inventory", path, true);
    }
    throw error;
  }
  const allowedLinks = allowLinkedInitialization ? metadata.nlink === 1n || metadata.nlink === 2n : metadata.nlink === 1n;
  if (!allowedLinks || metadata.size < 0n || metadata.size > maximumSnapshotClaimArtifactBytes) {
    throw new Error("Scope snapshot publication artifact metadata is invalid");
  }
  assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
  await hooks.afterPublicationArtifactStat?.(path);
  return { path, metadata, bytes: Number(metadata.size) };
}

async function validatePublicationArtifactFinalVersion(artifact: BoundedPublicationArtifact): Promise<void> {
  let final: BigIntStats;
  try {
    final = await lstat(artifact.path, { bigint: true });
  } catch (error) {
    if (missingPath(error)) {
      throw new ScopeInventorySettlementRestart(
        "Scope publication artifact settled during inventory",
        artifact.path,
        true
      );
    }
    throw error;
  }
  if (!samePublicationArtifactVersion(artifact.metadata, final)) {
    if (isPublicationArtifactSettlementTransition(artifact.metadata, final)) {
      throw new ScopeInventorySettlementRestart("Scope publication artifact metadata settled during inventory");
    }
    throw new Error("Scope snapshot publication artifact identity or metadata changed during inventory");
  }
}

async function reconcileSnapshotClaimArtifact(
  layout: SecureCacheLayout,
  scopePath: string,
  snapshotId: string,
  deadline: DeadlineBudget
): Promise<PublicationClaim | undefined> {
  const target = join(scopePath, snapshotId);
  const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
  deadline.check();
  if (observation.state === "absent") return undefined;
  const liveness = publicationClaimLiveness(observation.claim);
  if (liveness === "ambiguous") throw new Error("Scope prune found an ambiguously owned snapshot claim");
  if (liveness === "dead") {
    await safeRemoveOwnedPublicationClaim(layout, observation.claim);
    deadline.check();
    return undefined;
  }
  await validatePublicationClaim(layout, observation.claim);
  deadline.check();
  return observation.claim;
}

function bindInventoryPublicationClaim(
  claims: Map<string, PublicationClaim>,
  path: string,
  claim: PublicationClaim
): void {
  const observed = claims.get(path);
  if (observed && !samePublicationClaimEpoch(observed, claim)) {
    throw new Error("Scope publication claim identity or owner metadata changed while inventory restarted");
  }
  claims.set(path, claim);
}

async function sweepOrphanAccessRecords(
  layout: SecureCacheLayout,
  work: CounterBudget,
  deadline: DeadlineBudget,
  key: Buffer,
  hooks: ScopeStoreIo,
  observedPublicationClaims: Map<string, PublicationClaim>
): Promise<Map<string, number>> {
  const activeArtifactBytes = new Map<string, number>();
  const accessRoot = join(layout.indexes, "v3", "access");
  for (const project of await boundedDirectoryEntries(accessRoot, work, deadline)) {
    if (!project.directory || !/^[a-f0-9]{64}$/u.test(project.name)) {
      throw new Error("Scope access registry contains an unexpected project entry");
    }
    const projectPath = join(accessRoot, project.name);
    for (const scope of await boundedDirectoryEntries(projectPath, work, deadline)) {
      if (!scope.directory || !/^[a-f0-9]{64}$/u.test(scope.name)) {
        throw new Error("Scope access registry contains an unexpected scope entry");
      }
      const scopePath = join(projectPath, scope.name);
      for (const entry of await boundedDirectoryEntries(scopePath, work, deadline)) {
        const match = /^([a-f0-9]{64})\.json(?:\.pending)?$/u.exec(entry.name);
        const publication = /^\.publish-([a-f0-9]{64}\.json(?:\.pending)?)$/u.exec(entry.name);
        if (publication) {
          if (entry.directory) throw new Error("Scope access publication claim is not a regular file");
          const artifactPath = join(scopePath, entry.name);
          const artifact = await validateBoundedPublicationArtifact(artifactPath, true, hooks);
          const state = await reconcileCacheFilePublication(layout, join(scopePath, publication[1]!));
          if (state.state === "active") {
            bindInventoryPublicationClaim(observedPublicationClaims, artifactPath, state.claim);
            await validatePublicationArtifactFinalVersion(artifact);
            activeArtifactBytes.set(project.name, (activeArtifactBytes.get(project.name) ?? 0) + artifact.bytes);
          } else {
            throw new ScopeInventorySettlementRestart(
              "Scope access publication completed during inventory",
              artifactPath,
              true
            );
          }
          deadline.check();
          continue;
        }
        if (accessClaimInitializationPattern.test(entry.name) || accessPublicationTemporaryPattern.test(entry.name) ||
            accessClaimReleasePattern.test(entry.name)) {
          if (entry.directory) throw new Error("Scope access publication artifact is not a regular file");
          await validateBoundedPublicationArtifact(join(scopePath, entry.name), true, hooks);
          throw new ScopeInventorySettlementRestart("Scope access publication is settling");
        }
        if (entry.directory || !match) throw new Error("Scope access registry contains an unexpected record entry");
        const path = join(scopePath, entry.name);
        const access = await readAccessFile(layout, path, undefined, key, hooks);
        if (!access || access.record.projectKey !== project.name || access.record.cursorScopeKey !== scope.name ||
            access.record.snapshotId !== `sha256:${match[1]}`) {
          throw new Error("Scope access registry path binding is invalid");
        }
        const target = join(layout.indexes, "v3", "snapshots", project.name, scope.name, match[1]!);
        let targetExists = true;
        try {
          await lstat(target, { bigint: true });
        } catch (error) {
          if (!missingPath(error)) throw error;
          targetExists = false;
        }
        deadline.check();
        if (!targetExists) await safeRemoveExactCacheFile(layout, access.identity);
      }
    }
  }
  return activeArtifactBytes;
}

async function inventoryScopeSnapshotsAttempt(
  layout: SecureCacheLayout,
  hooks: ScopeStoreIo,
  work: CounterBudget,
  joinWork: CounterBudget,
  deadline: DeadlineBudget,
  key: Buffer,
  observedPublicationClaims: Map<string, PublicationClaim>
): Promise<ScopeInventory> {
  const result: ScopeInventoryEntry[] = [];
  const consumeJoinWork = (kind: "snapshot" | "active-claim" | "merge") => {
    deadline.check();
    joinWork.consume();
    hooks.onInventoryJoinWork?.(kind);
    deadline.check();
  };
  const snapshots = join(layout.indexes, "v3", "snapshots");
  const inventoryHooks: ScopeStoreIo = {
    ...hooks,
    beforeReadShard: async (path) => {
      deadline.check();
      await hooks.beforeReadShard?.(path);
      deadline.check();
    },
    onBoundedFileRead: async (path, bytes) => {
      deadline.check();
      await hooks.onBoundedFileRead?.(path, bytes);
      deadline.check();
    },
    beforeShardFinalIdentity: async (identity) => {
      deadline.check();
      await hooks.beforeShardFinalIdentity?.(identity);
      deadline.check();
    },
    afterSnapshotReads: async (target) => {
      deadline.check();
      await hooks.afterSnapshotReads?.(target);
      deadline.check();
    },
    afterPublicationArtifactStat: async (path) => {
      deadline.check();
      await hooks.afterPublicationArtifactStat?.(path);
      deadline.check();
    }
  };
  const projectArtifactBytes = await sweepOrphanAccessRecords(
    layout,
    work,
    deadline,
    key,
    inventoryHooks,
    observedPublicationClaims
  );
  for (const project of await boundedDirectoryEntries(snapshots, work, deadline)) {
    if (!/^[a-f0-9]{64}$/u.test(project.name)) {
      throw new Error("Scope snapshot namespace contains an unexpected project entry");
    }
    if (!project.directory) throw new Error("Scope snapshot project entry is not a directory");
    const projectPath = join(snapshots, project.name);
    for (const scope of await boundedDirectoryEntries(projectPath, work, deadline)) {
      if (!/^[a-f0-9]{64}$/u.test(scope.name)) {
        throw new Error("Scope snapshot namespace contains an unexpected scope entry");
      }
      if (!scope.directory) throw new Error("Scope snapshot scope entry is not a directory");
      const scopePath = join(projectPath, scope.name);
      const activeClaimBytes = new Map<string, number>();
      const scopeEntries = new Map<string, ScopeInventoryEntry>();
      for (const snapshot of await boundedDirectoryEntries(scopePath, work, deadline)) {
        if (snapshotBuildPattern.test(snapshot.name)) {
          if (!snapshot.directory) throw new Error("Scope snapshot build entry is not a directory");
          const build = await captureSecurePathIdentity(layout, join(scopePath, snapshot.name), "directory");
          deadline.check();
          await safeRemoveOwnedBuildDirectory(layout, build);
          deadline.check();
          continue;
        }
        const claim = snapshotClaimPattern.exec(snapshot.name);
        if (claim) {
          if (snapshot.directory) throw new Error("Scope snapshot publication claim is not a regular file");
          const artifactPath = join(scopePath, snapshot.name);
          const artifact = await validateBoundedPublicationArtifact(artifactPath, true, inventoryHooks);
          const activeClaim = await reconcileSnapshotClaimArtifact(layout, scopePath, claim[1]!, deadline);
          if (activeClaim) {
            bindInventoryPublicationClaim(observedPublicationClaims, artifactPath, activeClaim);
            await validatePublicationArtifactFinalVersion(artifact);
            consumeJoinWork("active-claim");
            if (activeClaimBytes.has(claim[1]!)) {
              throw new Error("Scope snapshot inventory contains an ambiguous active claim key");
            }
            activeClaimBytes.set(claim[1]!, artifact.bytes);
          } else {
            throw new ScopeInventorySettlementRestart(
              "Scope snapshot publication completed during inventory",
              artifactPath,
              true
            );
          }
          continue;
        }
        if (snapshotClaimReleasePattern.test(snapshot.name)) {
          if (snapshot.directory) throw new Error("Scope snapshot publication release artifact is not a regular file");
          await validateBoundedPublicationArtifact(join(scopePath, snapshot.name), false, inventoryHooks);
          throw new ScopeInventorySettlementRestart("Scope snapshot publication release is settling");
        }
        if (snapshotClaimInitializationPattern.test(snapshot.name)) {
          if (snapshot.directory) throw new Error("Scope snapshot publication initialization artifact is not a regular file");
          await validateBoundedPublicationArtifact(join(scopePath, snapshot.name), true, inventoryHooks);
          throw new ScopeInventorySettlementRestart("Scope snapshot publication initialization is settling");
        }
        if (!/^[a-f0-9]{64}$/u.test(snapshot.name)) {
          throw new Error("Scope snapshot namespace contains an unexpected snapshot entry");
        }
        if (!snapshot.directory) throw new Error("Scope snapshot entry is not a directory");
        const target = join(scopePath, snapshot.name);
        const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
        if (observation.state === "owned") {
          const liveness = publicationClaimLiveness(observation.claim);
          if (liveness === "ambiguous") throw new Error("Scope prune found an ambiguously owned snapshot claim");
          if (liveness === "dead") {
            await safeRemoveOwnedPublicationClaim(layout, observation.claim);
          }
          else await validatePublicationClaim(layout, observation.claim);
        }
        try {
          const validated = await validateSnapshotDirectory(layout, target, {
            projectKey: project.name,
            cursorScopeKey: scope.name,
            snapshotId: `sha256:${snapshot.name}`
          }, inventoryHooks);
          const access = await readAccessRecord(layout, validated.metadata, key, true, inventoryHooks);
          if (!access.record) throw new Error("Scope access registry record is missing");
          const bytes = validated.metadataBytes + validated.metadata.shards.files.bytes +
            validated.metadata.shards.evidence.bytes + (validated.metadata.shards.details?.bytes ?? 0) +
            access.physicalBytes;
          const entry: ScopeInventoryEntry = {
            path: target,
            identity: validated.identity,
            metadata: validated.metadata,
            accessedAt: access.record.accessedAt,
            accessBytes: access.physicalBytes,
            bytes
          };
          consumeJoinWork("snapshot");
          if (scopeEntries.has(snapshot.name)) {
            throw new Error("Scope snapshot inventory contains an ambiguous snapshot key");
          }
          scopeEntries.set(snapshot.name, entry);
          result.push(entry);
        } catch (error) {
          throw new Error(`Scope snapshot cannot be safely inventoried: ${target}`, { cause: error });
        }
      }
      for (const [snapshotId, bytes] of activeClaimBytes) {
        consumeJoinWork("merge");
        const entry = scopeEntries.get(snapshotId);
        if (entry) entry.bytes += bytes;
        else projectArtifactBytes.set(project.name, (projectArtifactBytes.get(project.name) ?? 0) + bytes);
      }
    }
  }
  return { entries: result, projectArtifactBytes };
}

async function inventoryScopeSnapshots(
  layout: SecureCacheLayout,
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<ScopeInventory> {
  const maximumInventoryEntries = keeperLimits.scan.maxFiles * 4 + 1024;
  const work = new CounterBudget("Scope prune directory work", maximumInventoryEntries);
  const joinWork = new CounterBudget("Scope prune inventory join work", maximumInventoryEntries * 2);
  const deadline = new DeadlineBudget("Scope prune", 30_000, hooks.inventoryNowMs);
  const key = await loadOrCreateAccessKey(layout);
  const observedPublicationClaims = new Map<string, PublicationClaim>();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await inventoryScopeSnapshotsAttempt(
        layout,
        hooks,
        work,
        joinWork,
        deadline,
        key,
        observedPublicationClaims
      );
    } catch (error) {
      if (!(error instanceof ScopeInventorySettlementRestart)) throw error;
      if (error.epochEnded && error.artifactPath) observedPublicationClaims.delete(error.artifactPath);
      await hooks.afterInventorySettlementRestart?.(error.artifactPath, error.epochEnded);
      deadline.check();
    }
  }
  throw new Error("Scope publication artifacts did not stabilize during bounded inventory");
}

function inventoryOrder(left: ScopeInventoryEntry, right: ScopeInventoryEntry): number {
  return left.accessedAt - right.accessedAt || left.metadata.createdAt - right.metadata.createdAt ||
    left.path.localeCompare(right.path, "en-US");
}

async function tryEvictScopeSnapshot(
  layout: SecureCacheLayout,
  entry: ScopeInventoryEntry,
  hooks: ScopeStoreIo
): Promise<boolean> {
  let claim: PublicationClaim;
  try {
    claim = await claimOwnedSnapshotDirectory(layout, entry.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  try {
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, entry.identity);
    const key = await loadOrCreateAccessKey(layout);
    const currentAccess = await readAccessRecord(layout, entry.metadata, key, true, hooks);
    if (!currentAccess.record || (!currentAccess.primaryIdentity && !currentAccess.pendingIdentity) ||
        currentAccess.record.accessedAt !== entry.accessedAt || currentAccess.physicalBytes !== entry.accessBytes) return false;
    await hooks.beforeEvict?.(entry.identity);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, entry.identity);
    if (currentAccess.primaryIdentity) await validateSecurePathIdentity(layout, currentAccess.primaryIdentity);
    if (currentAccess.pendingIdentity) await validateSecurePathIdentity(layout, currentAccess.pendingIdentity);
    await safeRemoveOwnedSnapshotDirectory(layout, entry.identity, true);
    await removeAccessRecordFiles(layout, currentAccess);
    return true;
  } finally {
    await safeRemoveOwnedPublicationClaim(layout, claim);
  }
}

async function pruneScopeIndexesUnderLock(
  layout: SecureCacheLayout,
  protectedSnapshot?: string,
  overrides: ScopePruneLimits = {},
  hooks: ScopeStoreIo = nodeScopeStoreIo,
  reservation?: ScopePruneReservation
): Promise<{ removed: string[]; retainedBytes: number }> {
  const now = overrides.now?.() ?? Date.now();
  const ttlMs = pruneLimit("Scope snapshot TTL", overrides.ttlMs ?? defaultScopePruneLimits.ttlMs);
  const maxSnapshotsPerScope = pruneLimit(
    "Maximum snapshots per scope",
    overrides.maxSnapshotsPerScope ?? defaultScopePruneLimits.maxSnapshotsPerScope
  );
  const maxProjectBytes = pruneLimit("Maximum project scope bytes", overrides.maxProjectBytes ?? defaultScopePruneLimits.maxProjectBytes);
  const maxGlobalBytes = pruneLimit("Maximum global scope bytes", overrides.maxGlobalBytes ?? defaultScopePruneLimits.maxGlobalBytes);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Scope prune clock is invalid");
  if (reservation && (!Number.isSafeInteger(reservation.bytes) || reservation.bytes < 0 ||
      (reservation.snapshotCount !== 0 && reservation.snapshotCount !== 1))) {
    throw new Error("Prospective scope snapshot bytes are invalid");
  }
  if (reservation && (reservation.bytes > maxProjectBytes || reservation.bytes > maxGlobalBytes ||
      maxSnapshotsPerScope < reservation.snapshotCount)) {
    throw new Error("Prospective scope snapshot cannot fit within retention quotas");
  }

  const inventory = await inventoryScopeSnapshots(layout, hooks);
  const entries = inventory.entries;
  const artifactGlobalBytes = [...inventory.projectArtifactBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
  if ([...inventory.projectArtifactBytes.values()].some((bytes) => bytes > maxProjectBytes) || artifactGlobalBytes > maxGlobalBytes) {
    throw new Error("Active scope publication artifacts exceed retention quotas");
  }
    const protectedPath = protectedSnapshot === undefined ? undefined : resolve(protectedSnapshot);
    const removable = (entry: ScopeInventoryEntry) => protectedPath === undefined || !sameResolvedPath(entry.path, protectedPath);
    const marked = new Set<string>();
    const mark = (entry: ScopeInventoryEntry) => { if (removable(entry)) marked.add(entry.path); };

    for (const entry of entries) {
      if (now >= entry.metadata.createdAt + ttlMs) mark(entry);
    }

    const byScope = new Map<string, ScopeInventoryEntry[]>();
    for (const entry of entries) {
      const key = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
      const group = byScope.get(key) ?? [];
      group.push(entry);
      byScope.set(key, group);
    }
    for (const group of [...byScope.values()]) {
      const retained = group.filter((entry) => !marked.has(entry.path)).sort(inventoryOrder);
      const reserved = reservation && group[0]?.metadata.projectKey === reservation.projectKey &&
        group[0]?.metadata.cursorScopeKey === reservation.cursorScopeKey ? reservation.snapshotCount : 0;
      let excess = retained.length + reserved - maxSnapshotsPerScope;
      for (const entry of retained) {
        if (excess <= 0) break;
        if (!removable(entry)) continue;
        mark(entry);
        excess -= 1;
      }
    }

    const byProject = new Map<string, ScopeInventoryEntry[]>();
    for (const entry of entries) {
      const group = byProject.get(entry.metadata.projectKey) ?? [];
      group.push(entry);
      byProject.set(entry.metadata.projectKey, group);
    }
    const projectKeys = new Set([...byProject.keys(), ...inventory.projectArtifactBytes.keys()]);
    for (const projectKey of projectKeys) {
      const group = byProject.get(projectKey) ?? [];
      let bytes = group.filter((entry) => !marked.has(entry.path)).reduce((sum, entry) => sum + entry.bytes, 0) +
        (inventory.projectArtifactBytes.get(projectKey) ?? 0) +
        (reservation?.projectKey === projectKey ? reservation.bytes : 0);
      for (const entry of group.filter((candidate) => !marked.has(candidate.path)).sort(inventoryOrder)) {
        if (bytes <= maxProjectBytes) break;
        if (!removable(entry)) continue;
        mark(entry);
        bytes -= entry.bytes;
      }
    }

    let globalBytes = artifactGlobalBytes + entries.filter((entry) => !marked.has(entry.path)).reduce((sum, entry) => sum + entry.bytes, 0) +
      (reservation?.bytes ?? 0);
    for (const entry of entries.filter((candidate) => !marked.has(candidate.path)).sort(inventoryOrder)) {
      if (globalBytes <= maxGlobalBytes) break;
      if (!removable(entry)) continue;
      mark(entry);
      globalBytes -= entry.bytes;
    }

    const removed: string[] = [];
    const removedSet = new Set<string>();
    let retainedBytes = artifactGlobalBytes + entries.reduce((sum, entry) => sum + entry.bytes, 0);
    const retainedScopeCounts = new Map<string, number>();
    const retainedProjectByteCounts = new Map<string, number>();
    for (const [projectKey, bytes] of inventory.projectArtifactBytes) {
      retainedProjectByteCounts.set(projectKey, bytes);
    }
    for (const entry of entries) {
      const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
      retainedScopeCounts.set(scopeKey, (retainedScopeCounts.get(scopeKey) ?? 0) + 1);
      retainedProjectByteCounts.set(
        entry.metadata.projectKey,
        (retainedProjectByteCounts.get(entry.metadata.projectKey) ?? 0) + entry.bytes
      );
    }
    const reservationScopeKey = reservation ? `${reservation.projectKey}:${reservation.cursorScopeKey}` : undefined;
    const overScopeQuota = new Set([...retainedScopeCounts].flatMap(([key, count]) =>
      count + (key === reservationScopeKey ? reservation?.snapshotCount ?? 0 : 0) > maxSnapshotsPerScope ? [key] : []));
    const overProjectQuota = new Set([...retainedProjectByteCounts].flatMap(([key, bytes]) =>
      bytes + (reservation?.projectKey === key ? reservation.bytes : 0) > maxProjectBytes ? [key] : []));
    const entryNeedsQuotaReduction = (entry: ScopeInventoryEntry) => {
      const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
      return overScopeQuota.has(scopeKey) ||
        overProjectQuota.has(entry.metadata.projectKey) ||
        retainedBytes + (reservation?.bytes ?? 0) > maxGlobalBytes;
    };
    for (const entry of [...entries].sort(inventoryOrder)) {
      if (!marked.has(entry.path) && !entryNeedsQuotaReduction(entry)) continue;
      if (!removable(entry)) continue;
      if (!await tryEvictScopeSnapshot(layout, entry, hooks)) continue;
      removed.push(entry.path);
      removedSet.add(entry.path);
      retainedBytes -= entry.bytes;
      const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
      const scopeCount = (retainedScopeCounts.get(scopeKey) ?? 1) - 1;
      retainedScopeCounts.set(scopeKey, scopeCount);
      if (scopeCount + (scopeKey === reservationScopeKey ? reservation?.snapshotCount ?? 0 : 0) <= maxSnapshotsPerScope) {
        overScopeQuota.delete(scopeKey);
      }
      const projectBytes = (retainedProjectByteCounts.get(entry.metadata.projectKey) ?? entry.bytes) - entry.bytes;
      retainedProjectByteCounts.set(entry.metadata.projectKey, projectBytes);
      if (projectBytes + (reservation?.projectKey === entry.metadata.projectKey ? reservation.bytes : 0) <= maxProjectBytes) {
        overProjectQuota.delete(entry.metadata.projectKey);
      }
    }
    const retained = entries.filter((entry) => !removedSet.has(entry.path));
    if (reservation) {
      const retainedScopeCount = retainedScopeCounts.get(reservationScopeKey!) ?? 0;
      const retainedProjectBytes = retainedProjectByteCounts.get(reservation.projectKey) ?? 0;
      if (retainedScopeCount + reservation.snapshotCount > maxSnapshotsPerScope ||
          retainedProjectBytes + reservation.bytes > maxProjectBytes ||
          retainedBytes + reservation.bytes > maxGlobalBytes) {
        throw new Error("Prospective scope snapshot headroom could not be established safely");
      }
    }
    return { removed, retainedBytes };
}

export async function pruneScopeIndexes(
  layout: SecureCacheLayout,
  protectedSnapshot?: string,
  overrides: ScopePruneLimits = {},
  hooks: ScopeStoreIo = nodeScopeStoreIo
): Promise<{ removed: string[]; retainedBytes: number }> {
  const pruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
  try {
    await validatePublicationClaim(layout, pruneClaim);
    const result = await pruneScopeIndexesUnderLock(layout, protectedSnapshot, overrides, hooks);
    await validatePublicationClaim(layout, pruneClaim);
    return result;
  } finally {
    await safeRemoveOwnedPublicationClaim(layout, pruneClaim);
  }
}
