import { randomUUID } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { chmod, link, lstat, mkdir, open, opendir, readFile, readdir, realpath, rename, rm, rmdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { changesetLifetimeMs, type ServiceOptions } from "../types/schema.js";
import {
  createPublicationClaimOwner,
  parsePublicationClaimOwner,
  PUBLICATION_CLAIM_LEASE_MS,
  type PublicationClaimOwner
} from "./publication-claim.js";
import { probeProcessLiveness } from "./process-liveness.js";
import {
  changesetRemovalRecoveryLimits,
  CounterBudget,
  DeadlineBudget
} from "./limits.js";

export interface SecureCacheLayout {
  root: string;
  changesets: string;
  snapshots: string;
  indexes: string;
  locks: string;
}

export interface SecurePathIdentity {
  path: string;
  parent: string;
  dev: bigint | number;
  ino: bigint | number;
  kind: "directory" | "file";
  parentDev: bigint | number;
  parentIno: bigint | number;
}

export interface PublicationClaimCreationHooks {
  beforeClaimOwnerCreate?: (temporary: string) => Promise<void>;
  duringClaimOwnerWrite?: (temporary: string) => Promise<void>;
  beforeClaimOwnerIdentityCapture?: (temporary: string) => Promise<void>;
  beforeClaimLink?: (temporary: string, deterministic: string) => Promise<void>;
  afterClaimLink?: (temporary: string, deterministic: string) => Promise<void>;
  beforeClaimFinalFileSync?: (path: string, links: number) => Promise<void>;
  afterClaimFinalFileSync?: (path: string, links: number) => Promise<void>;
  beforeParentDirectoryOpen?: (directory: string) => Promise<void>;
  afterParentDirectorySync?: (directory: string, outcome: PublicationDirectorySyncOutcome) => Promise<void>;
}

export interface PublicationClaimCaptureHooks {
  afterClaimMetadataCapture?: (path: string, metadata: BigIntStats) => Promise<void>;
}

export type PublicationDirectorySyncOutcome = "synced" | "unsupported";

export interface SecureCachePublicationHooks extends PublicationClaimCreationHooks, SecureCacheValidationHooks {
  afterClaimAcquire?: (claim: PublicationClaim) => Promise<void>;
  beforeTemporaryCreate?: (temporary: string) => Promise<void>;
  afterTemporaryFileSync?: (temporary: string) => Promise<void>;
  afterTemporaryCreate?: (temporary: string) => Promise<void>;
  beforeLink?: (temporary: string, target: string) => Promise<void>;
  afterLink?: (temporary: string, target: string) => Promise<void>;
  afterPublishedIdentity?: (identity: SecurePathIdentity) => Promise<void>;
  beforeFinalTargetFileSync?: (path: string, links: number) => Promise<void>;
  afterFinalTargetFileSync?: (path: string, links: number) => Promise<void>;
  beforeTemporaryCleanup?: (temporary: string) => Promise<void>;
  afterTemporaryCleanup?: (temporary: string, target: string) => Promise<void>;
}

export interface SecureExactRemovalHooks extends Pick<
  PublicationClaimCreationHooks,
  "beforeParentDirectoryOpen" | "afterParentDirectorySync"
> {
  duringRemovalIntentCandidateWrite?: (candidatePath: string, finalPath: string) => Promise<void>;
  beforeRemovalIntentLink?: (candidatePath: string, finalPath: string) => Promise<void>;
  afterRemovalIntentLink?: (candidatePath: string, finalPath: string) => Promise<void>;
  beforeExactRemovalRecovery?: (intentPath: string) => Promise<void>;
  beforeExactRemovalCompletion?: (intentPath: string) => Promise<void>;
  beforeExactRemovalUnlink?: (path: string) => Promise<void>;
  afterRemovalIntentFileSync?: (intentPath: string, phase: "prepared" | "unlinked") => Promise<void>;
  afterExactRemovalUnlink?: (path: string, intentPath: string) => Promise<void>;
  beforeRemovalArtifactUse?: (
    path: string,
    kind: "candidate" | "intent" | "quarantine" | "legacy-quarantine"
  ) => Promise<void>;
  removalRecoveryNow?: () => number;
  writeRemovalIntentChunk?: (
    handle: Awaited<ReturnType<typeof open>>,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ) => Promise<number>;
  readRemovalIntentChunk?: (
    handle: Awaited<ReturnType<typeof open>>,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ) => Promise<number>;
  afterExactRemovalResourceAcquire?: (
    path: string,
    kind: "file" | "directory"
  ) => Promise<void>;
  closeExactRemovalResource?: (
    resource: { close(): Promise<void> },
    path: string,
    kind: "file" | "directory"
  ) => Promise<void>;
  afterExactRemovalQuarantineClaim?: (targetPath: string, quarantinePath: string) => Promise<void>;
  afterExactRemovalArtifactSync?: (path: string) => Promise<void>;
}

export interface SecureCacheValidationHooks {
  beforeFileModeRepair?: (path: string, identity: SecurePathIdentity) => Promise<void>;
  beforeEnumeratedTemporaryStat?: (temporary: string, target: string) => Promise<void>;
  beforeDeadTemporaryCleanup?: (temporary: string, target: string) => Promise<void>;
}

export interface SecureDirectoryCreationHooks {
  afterMkdir?: (identity: SecurePathIdentity) => Promise<void>;
}

export interface SecureDirectoryPublicationHooks {
  afterRename?: (target: string) => Promise<void>;
}

export interface PublicationClaimCleanupHooks extends Pick<PublicationClaimCreationHooks, "afterParentDirectorySync"> {
  afterRename?: (releasedPath: string) => Promise<void>;
}

export interface PublicationClaim extends SecurePathIdentity {
  kind: "file";
  owner: PublicationClaimOwner;
  initializationIdentity?: SecurePathIdentity;
}

export type PublicationClaimLiveness = "alive" | "dead" | "ambiguous";

export const PUBLICATION_CLAIM_WAIT_MS = 30_000;

export function resolveCacheDirectory(
  options: Pick<ServiceOptions, "cacheDirectory"> = {},
  environment: Record<string, string | undefined> = process.env,
  homeDirectory = homedir()
): string {
  if (options.cacheDirectory) return resolve(options.cacheDirectory);
  if (environment.PLUGIN_DATA) return resolve(environment.PLUGIN_DATA);
  if (environment.LOCALAPPDATA) return resolve(environment.LOCALAPPDATA, "project-design-keeper");
  if (environment.XDG_CACHE_HOME) return resolve(environment.XDG_CACHE_HOME, "project-design-keeper");
  return resolve(homeDirectory, ".cache", "project-design-keeper");
}

export function sameFilesystemPath(left: string, right: string): boolean {
  const normalize = (value: string) => process.platform === "win32"
    ? resolve(value).toLocaleLowerCase("en-US")
    : resolve(value);
  return normalize(left) === normalize(right);
}

function isStrictlyInside(root: string, candidate: string): boolean {
  const nested = relative(root, candidate);
  return nested !== "" && nested !== ".." && !nested.startsWith(`..${sep}`) && !isAbsolute(nested);
}

function isInsideOrSame(root: string, candidate: string): boolean {
  return sameFilesystemPath(root, candidate) || isStrictlyInside(root, candidate);
}

function pathComponents(path: string): string[] {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const parts = relative(root, absolute).split(sep).filter(Boolean);
  const paths = [root];
  for (const part of parts) paths.push(join(paths.at(-1)!, part));
  return paths;
}

async function optionalLstat(path: string) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT" ||
    /path component is missing|no such file|disappeared/i.test(String((error as Error).message));
}

const windowsUnsupportedDirectorySyncCodes = new Set(["EINVAL", "EISDIR", "ENOSYS", "ENOTSUP", "EPERM"]);

async function syncPublicationDirectory(
  directory: string,
  hooks: Pick<PublicationClaimCreationHooks, "beforeParentDirectoryOpen" | "afterParentDirectorySync"> = {}
): Promise<PublicationDirectorySyncOutcome> {
  await hooks.beforeParentDirectoryOpen?.(directory);
  // Directory-open failures are authority/path failures, not evidence that directory
  // fsync is unsupported. Keep the open outside the narrowly classified sync catch.
  const handle = await open(directory, "r");
  let outcome: PublicationDirectorySyncOutcome = "synced";
  try {
    try {
      await handle.sync();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || !code || !windowsUnsupportedDirectorySyncCodes.has(code)) throw error;
      outcome = "unsupported";
    }
  } finally {
    await handle.close();
  }
  await hooks.afterParentDirectorySync?.(directory, outcome);
  return outcome;
}

async function syncPublishedTarget(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  expectedLinks: bigint,
  hooks: Pick<SecureCachePublicationHooks, "beforeFinalTargetFileSync" | "afterFinalTargetFileSync">
): Promise<void> {
  const links = Number(expectedLinks);
  await hooks.beforeFinalTargetFileSync?.(identity.path, links);
  await validateSecurePathIdentity(layout, identity);
  // On Windows FlushFileBuffers requires a write-capable handle. Opening the final
  // name also lets us prove that the durable handle still names the published inode.
  const handle = await open(identity.path, "r+");
  try {
    const before = await handle.stat({ bigint: true });
    if (!sameStatIdentity(identity, before)) throw new Error("Published cache file identity changed before final-target sync");
    assertSecureOwnerFileMetadata(before, identity.path, expectedLinks);
    await handle.sync();
    const after = await handle.stat({ bigint: true });
    if (!sameStatIdentity(identity, after)) throw new Error("Published cache file identity changed during final-target sync");
    assertSecureOwnerFileMetadata(after, identity.path, expectedLinks);
  } finally {
    await handle.close();
  }
  await validateSecurePathIdentity(layout, identity);
  const settled = await lstat(identity.path, { bigint: true });
  if (!sameStatIdentity(identity, settled)) throw new Error("Published cache file identity changed after final-target sync");
  assertSecureOwnerFileMetadata(settled, identity.path, expectedLinks);
  await hooks.afterFinalTargetFileSync?.(identity.path, links);
}

async function validateOrdinaryPathComponents(
  path: string,
  leaf: "directory" | "file" | "missing-ok"
): Promise<void> {
  const components = pathComponents(path);
  for (const [index, component] of components.entries()) {
    const metadata = await optionalLstat(component);
    const isLeaf = index === components.length - 1;
    if (!metadata) {
      if (isLeaf && leaf === "missing-ok") return;
      throw new Error(`Cache path component is missing: ${component}`);
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
    if ((!isLeaf || leaf === "directory") && !metadata.isDirectory()) {
      throw new Error(`Cache path component is not a directory: ${component}`);
    }
    if (isLeaf && leaf !== "directory" && !metadata.isFile()) {
      throw new Error(`Cache path is not an ordinary regular file: ${component}`);
    }
    const canonical = await realpath(component);
    if (!sameFilesystemPath(canonical, component)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
  }
}

function assertOwner(metadata: Awaited<ReturnType<typeof lstat>>, path: string, kind: "file" | "directory"): void {
  if (process.platform !== "win32" && typeof process.getuid === "function" && metadata.uid !== BigInt(process.getuid())) {
    throw new Error(`Cache ${kind} ownership is not owner-only: ${path}`);
  }
}

function assertSameBigintIdentity(
  before: Awaited<ReturnType<typeof lstat>>,
  after: Awaited<ReturnType<typeof lstat>>,
  path: string
): void {
  if (before.dev !== after.dev || before.ino !== after.ino) throw new Error(`Cache path identity changed during permission repair: ${path}`);
}

async function enforceOwnerDirectoryMetadata(path: string): Promise<void> {
  let metadata = await lstat(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  assertOwner(metadata, path, "directory");
  if (process.platform !== "win32" && (metadata.mode & 0o777n) !== 0o700n) {
    const original = metadata;
    await chmod(path, 0o700);
    metadata = await lstat(path, { bigint: true });
    assertSameBigintIdentity(original, metadata, path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
    assertOwner(metadata, path, "directory");
    if ((metadata.mode & 0o777n) !== 0o700n) throw new Error(`Cache directory permissions are not owner-only: ${path}`);
  }
}

async function validateOwnerDirectoryMetadata(path: string): Promise<void> {
  const metadata = await lstat(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  assertOwner(metadata, path, "directory");
  if (process.platform !== "win32" && (metadata.mode & 0o777n) !== 0o700n) throw new Error(`Cache directory permissions are not owner-only: ${path}`);
}

async function validateOwnerDirectory(path: string): Promise<void> {
  await validateOrdinaryPathComponents(path, "directory");
  await validateOwnerDirectoryMetadata(path);
}

class UnexpectedLinkCountError extends Error {
  constructor(readonly metadata: Awaited<ReturnType<typeof lstat>>, path: string) {
    super(`Cache file has an unexpected hard-link count: ${path}`);
  }
}

function fileIdentity(path: string, parent: SecurePathIdentity, metadata: Awaited<ReturnType<typeof lstat>>): SecurePathIdentity {
  return {
    path,
    parent: parent.path,
    dev: metadata.dev,
    ino: metadata.ino,
    kind: "file",
    parentDev: parent.dev,
    parentIno: parent.ino
  };
}

export function assertSecureOwnerFileMetadata(
  metadata: Awaited<ReturnType<typeof lstat>>,
  path: string,
  expectedLinks?: bigint
): void {
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
  assertOwner(metadata, path, "file");
  if (expectedLinks !== undefined && metadata.nlink !== expectedLinks) {
    throw new Error(`Cache file has an unexpected hard-link count: ${path}`);
  }
  if (process.platform !== "win32" && (BigInt(metadata.mode) & 0o777n) !== 0o600n) {
    throw new Error(`Cache file permissions are not owner-only: ${path}`);
  }
}

async function validateOwnerFile(
  path: string,
  allowRepair: boolean,
  hooks: SecureCacheValidationHooks = {}
): Promise<void> {
  let metadata = await lstat(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
  assertOwner(metadata, path, "file");
  if (metadata.nlink !== 1n) throw new UnexpectedLinkCountError(metadata, path);
  if (process.platform !== "win32") {
    if ((metadata.mode & 0o777n) !== 0o600n) {
      if (!allowRepair) throw new Error(`Cache file permissions are not owner-only: ${path}`);
      const parent = await capturePathIdentity(dirname(path), "directory");
      const originalIdentity = fileIdentity(path, parent, metadata);
      await hooks.beforeFileModeRepair?.(path, originalIdentity);
      const immediatelyBefore = await lstat(path, { bigint: true });
      assertSameBigintIdentity(metadata, immediatelyBefore, path);
      if (immediatelyBefore.isSymbolicLink() || !immediatelyBefore.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
      assertOwner(immediatelyBefore, path, "file");
      if (immediatelyBefore.nlink !== 1n) throw new UnexpectedLinkCountError(immediatelyBefore, path);
      await chmod(path, 0o600);
      metadata = await lstat(path, { bigint: true });
      assertSameBigintIdentity(immediatelyBefore, metadata, path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
      assertOwner(metadata, path, "file");
      if ((metadata.mode & 0o777n) !== 0o600n) throw new Error(`Cache file permissions are not owner-only: ${path}`);
      if (metadata.nlink !== 1n) throw new UnexpectedLinkCountError(metadata, path);
    }
  }
}

async function createSecureDirectory(path: string): Promise<void> {
  for (const component of pathComponents(path)) {
    let metadata = await optionalLstat(component);
    if (!metadata) {
      try {
        await mkdir(component, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      metadata = await lstat(component, { bigint: true });
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Cache path contains a symbolic-link, junction, reparse, or non-directory component: ${component}`);
    }
    const canonical = await realpath(component);
    if (!sameFilesystemPath(canonical, component)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
  }
  await enforceOwnerDirectoryMetadata(path);
}

async function validateCacheDirectoryChain(root: string, target: string): Promise<void> {
  if (!isInsideOrSame(root, target)) throw new Error("Cache directory chain escapes the cache root");
  let current = root;
  await validateOwnerDirectoryMetadata(current);
  const nested = relative(root, target);
  if (!nested) return;
  for (const part of nested.split(sep).filter(Boolean)) {
    current = join(current, part);
    await validateOwnerDirectoryMetadata(current);
  }
}

async function enforceCacheDirectoryChain(root: string, target: string): Promise<void> {
  if (!isInsideOrSame(root, target)) throw new Error("Cache directory chain escapes the cache root");
  let current = root;
  await enforceOwnerDirectoryMetadata(current);
  const nested = relative(root, target);
  if (!nested) return;
  for (const part of nested.split(sep).filter(Boolean)) {
    current = join(current, part);
    await enforceOwnerDirectoryMetadata(current);
  }
}

function assertCacheChild(layout: SecureCacheLayout, path: string, kind: "file" | "directory"): string {
  const target = resolve(path);
  if (!isStrictlyInside(layout.root, target)) throw new Error(`Cache ${kind} path escapes the cache root`);
  return target;
}

export async function createSecureCacheDirectory(layout: SecureCacheLayout, path: string): Promise<string> {
  const target = assertCacheChild(layout, path, "directory");
  await createSecureDirectory(target);
  await enforceCacheDirectoryChain(layout.root, target);
  const canonical = await realpath(target);
  if (!isStrictlyInside(layout.root, canonical) || !sameFilesystemPath(canonical, target)) {
    throw new Error("Cache directory resolves outside the cache root through a symbolic-link, junction, or reparse component");
  }
  return canonical;
}

export async function prepareSecureCache(
  options: Pick<ServiceOptions, "cacheDirectory" | "environment" | "homeDirectory"> = {},
  projectRoot?: string
): Promise<SecureCacheLayout> {
  const root = resolveCacheDirectory(
    options,
    options.environment ?? process.env,
    options.homeDirectory ?? homedir()
  );
  const lexicalProject = projectRoot === undefined ? undefined : resolve(projectRoot);
  const project = lexicalProject === undefined ? undefined : await realpath(lexicalProject);
  if (lexicalProject && (
    sameFilesystemPath(lexicalProject, root) ||
    isStrictlyInside(lexicalProject, root) ||
    isStrictlyInside(root, lexicalProject)
  )) {
    throw new Error("Cache and project roots must be disjoint; neither may contain the other");
  }
  if (lexicalProject && project && !sameFilesystemPath(lexicalProject, project)) {
    throw new Error("Project root must use its canonical path; symbolic-link, junction, reparse, or alias roots are not allowed");
  }
  await createSecureDirectory(root);
  const canonicalRoot = await realpath(root);
  if (project && (
    sameFilesystemPath(project, canonicalRoot) ||
    isStrictlyInside(project, canonicalRoot) ||
    isStrictlyInside(canonicalRoot, project)
  )) {
    throw new Error("Cache and project roots must be disjoint; neither may contain the other");
  }
  const layout: SecureCacheLayout = {
    root: canonicalRoot,
    changesets: join(canonicalRoot, "changesets"),
    snapshots: join(canonicalRoot, "snapshots"),
    indexes: join(canonicalRoot, "indexes"),
    locks: join(canonicalRoot, "locks")
  };
  await Promise.all([
    createSecureDirectory(layout.changesets),
    createSecureDirectory(layout.snapshots),
    createSecureDirectory(layout.indexes),
    createSecureDirectory(layout.locks)
  ]);
  await validateCacheFile(layout, join(layout.root, "changeset-hmac.key"), true);
  return layout;
}

function publicationClaimPath(target: string): string {
  return join(dirname(target), `.publish-${basename(target)}`);
}

const maximumPublicationClaimOwnerBytes = 4 * 1024;

function sameStatIdentity(
  identity: Pick<SecurePathIdentity, "dev" | "ino">,
  metadata: Awaited<ReturnType<typeof lstat>>
): boolean {
  return identity.dev === metadata.dev && identity.ino === metadata.ino;
}

function samePublicationClaimFileVersion(
  left: BigIntStats,
  right: BigIntStats
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid &&
    left.mode === right.mode && left.nlink === right.nlink && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

function samePublicationClaimFileExceptSettlement(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid &&
    left.mode === right.mode && left.size === right.size && left.mtimeNs === right.mtimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

function isPublicationClaimSettlementTransition(left: BigIntStats, right: BigIntStats): boolean {
  return (left.nlink === 1n || left.nlink === 2n) && (right.nlink === 1n || right.nlink === 2n) &&
    samePublicationClaimFileExceptSettlement(left, right);
}

class PublicationClaimInitializationSettled extends Error {
  constructor(readonly claim?: PublicationClaim) {
    super("Publication claim initialization metadata is settling");
  }
}

interface OwnedFilePublicationWindow {
  claim: PublicationClaim;
  targetIdentity: SecurePathIdentity;
  temporaryIdentity: SecurePathIdentity;
}

async function targetConvergedToOneLink(
  target: string,
  identity: Pick<SecurePathIdentity, "dev" | "ino">
): Promise<boolean> {
  const settled = await lstat(target, { bigint: true });
  if (!sameStatIdentity(identity, settled) || settled.nlink !== 1n) return false;
  assertSecureOwnerFileMetadata(settled, target, 1n);
  return true;
}

async function validateOwnedPublicationWindow(
  layout: SecureCacheLayout,
  target: string,
  targetMetadata: Awaited<ReturnType<typeof lstat>>,
  expectedClaim?: PublicationClaim,
  hooks: SecureCacheValidationHooks = {}
): Promise<OwnedFilePublicationWindow | undefined> {
  if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile() || targetMetadata.nlink !== 2n) {
    throw new Error(`Cache file has an unexpected hard-link count: ${target}`);
  }
  assertSecureOwnerFileMetadata(targetMetadata, target, 2n);
  const parent = await capturePathIdentity(dirname(target), "directory");
  const targetIdentity = fileIdentity(target, parent, targetMetadata);
  let claim: PublicationClaim;
  try {
    claim = await capturePublicationClaim(layout, target);
  } catch (error) {
    if (isMissingPathError(error)) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return undefined;
      throw new Error("Cache file has an external or unowned hard link");
    }
    throw error;
  }
  if (expectedClaim && !samePublicationClaimEpoch(expectedClaim, claim)) {
    throw new Error("Cache publication claim identity changed");
  }
  if (!sameFilesystemPath(claim.parent, parent.path) || claim.parentDev !== parent.dev || claim.parentIno !== parent.ino) {
    throw new Error("Cache publication claim parent identity changed");
  }
  const expectedTemporary = join(parent.path, claim.owner.publicationName);
  for (let proofAttempt = 0; proofAttempt < 100; proofAttempt += 1) {
    const entries = await readdir(parent.path);
    const matchingTemporaries: SecurePathIdentity[] = [];
    let enumerationChurn = false;
    for (const name of entries) {
      if (!/^\.[a-f0-9-]{36}\.tmp$/iu.test(name)) continue;
      const temporary = join(parent.path, name);
      await hooks.beforeEnumeratedTemporaryStat?.(temporary, target);
      let metadata: Awaited<ReturnType<typeof lstat>>;
      try {
        metadata = await lstat(temporary, { bigint: true });
      } catch (error) {
        if (!isMissingPathError(error)) throw error;
        if (await targetConvergedToOneLink(target, targetIdentity)) {
          await validateOwnerFile(target, false);
          return undefined;
        }
        const settled = await lstat(target, { bigint: true });
        if (!sameStatIdentity(targetMetadata, settled) || settled.nlink !== 2n) {
          throw new Error("Cache file identity changed during publication proof");
        }
        enumerationChurn = true;
        break;
      }
      if (metadata.isSymbolicLink() || !metadata.isFile()) continue;
      if (metadata.dev === targetMetadata.dev && metadata.ino === targetMetadata.ino) {
        assertSecureOwnerFileMetadata(metadata, temporary, 2n);
        if (!sameFilesystemPath(temporary, expectedTemporary)) {
          throw new Error("Cache file has an external or unowned hard link");
        }
        matchingTemporaries.push(fileIdentity(temporary, parent, metadata));
      }
    }
    if (enumerationChurn) {
      await new Promise<void>((accept) => setTimeout(accept, 0));
      continue;
    }
    if (matchingTemporaries.length !== 1) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return undefined;
      throw new Error("Cache file has an external or unowned hard link");
    }
    try {
      await validatePublicationClaim(layout, claim);
    } catch (error) {
      if (isMissingPathError(error)) {
        if (await targetConvergedToOneLink(target, targetIdentity)) return undefined;
      }
      throw error;
    }
    let currentTarget: Awaited<ReturnType<typeof lstat>>;
    let currentTemporary: Awaited<ReturnType<typeof lstat>>;
    try {
      [currentTarget, currentTemporary] = await Promise.all([
        lstat(target, { bigint: true }),
        lstat(expectedTemporary, { bigint: true })
      ]);
    } catch (error) {
      if (isMissingPathError(error) && await targetConvergedToOneLink(target, targetIdentity)) return undefined;
      throw error;
    }
    if (!sameStatIdentity(targetIdentity, currentTarget) || !sameStatIdentity(targetIdentity, currentTemporary) ||
        currentTarget.nlink !== 2n || currentTemporary.nlink !== 2n) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return undefined;
      throw new Error("Cache file identity changed during publication proof");
    }
    assertSecureOwnerFileMetadata(currentTarget, target, 2n);
    assertSecureOwnerFileMetadata(currentTemporary, expectedTemporary, 2n);
    return { claim, targetIdentity, temporaryIdentity: matchingTemporaries[0]! };
  }
  throw new Error("Cache publication temporary enumeration did not stabilize");
}

async function recoverDeadOwnedPublicationWindow(
  layout: SecureCacheLayout,
  target: string,
  expected: OwnedFilePublicationWindow,
  hooks: SecureCacheValidationHooks = {}
): Promise<void> {
  const metadata = await lstat(target, { bigint: true });
  if (sameStatIdentity(expected.targetIdentity, metadata) && metadata.nlink === 1n) {
    await finishDeadPublicationRecovery(layout, target, expected);
    return;
  }
  let current = await validateOwnedPublicationWindow(layout, target, metadata, expected.claim, hooks);
  if (!current) {
    await validateOwnerFile(target, false);
    return;
  }
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await validatePublicationClaim(layout, current.claim);
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await hooks.beforeDeadTemporaryCleanup?.(current.temporaryIdentity.path, target);
  await validatePublicationClaim(layout, current.claim);
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  const afterHookMetadata = await lstat(target, { bigint: true });
  if (sameStatIdentity(expected.targetIdentity, afterHookMetadata) && afterHookMetadata.nlink === 1n) {
    await finishDeadPublicationRecovery(layout, target, expected);
    return;
  }
  const afterHookWindow = await validateOwnedPublicationWindow(layout, target, afterHookMetadata, current.claim);
  if (!afterHookWindow) {
    await finishDeadPublicationRecovery(layout, target, current);
    return;
  }
  current = afterHookWindow;
  try {
    await removeRecordedCacheFile(layout, current.temporaryIdentity);
  } catch (error) {
    if (!isMissingPathError(error) || !await targetConvergedToOneLink(target, current.targetIdentity)) throw error;
  }
  if (!await targetConvergedToOneLink(target, current.targetIdentity)) {
    throw new Error("Dead cache publication did not converge to the exact one-link target");
  }
  await finishDeadPublicationRecovery(layout, target, current);
  const settled = await lstat(target, { bigint: true });
  if (!sameStatIdentity(current.targetIdentity, settled) || settled.nlink !== 1n) {
    throw new Error("Recovered cache target identity changed after claim release");
  }
  assertSecureOwnerFileMetadata(settled, target, 1n);
}

async function finishDeadPublicationRecovery(
  layout: SecureCacheLayout,
  target: string,
  expected: OwnedFilePublicationWindow
): Promise<void> {
  let cleanupFailure: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!await targetConvergedToOneLink(target, expected.targetIdentity)) {
      throw new Error("Dead cache publication target did not remain the exact one-link inode");
    }
    await validateSecurePathIdentity(layout, expected.targetIdentity);
    await validateOwnerFile(target, false);
    const observation = await observePublicationClaim(layout, target);
    if (observation.state === "absent") {
      await validateSecurePathIdentity(layout, expected.targetIdentity);
      await validateOwnerFile(target, false);
      return;
    }
    if (!samePublicationClaimEpoch(expected.claim, observation.claim)) {
      throw new Error("Cache publication claim changed during dead-publisher recovery");
    }
    if (publicationClaimLiveness(observation.claim) !== "dead") {
      throw new Error("Cache file publication claim owner is not definitively dead");
    }
    try {
      await safeRemovePublicationClaim(layout, observation.claim, false);
    } catch (error) {
      cleanupFailure = error;
      continue;
    }
    await validateSecurePathIdentity(layout, expected.targetIdentity);
    await validateOwnerFile(target, false);
    return;
  }
  throw new Error("Dead cache publication claim cleanup did not stabilize", { cause: cleanupFailure });
}

async function validateOwnerFileWithPublicationWait(
  layout: SecureCacheLayout,
  target: string,
  allowRepair: boolean,
  hooks: SecureCacheValidationHooks
): Promise<void> {
  try {
    await validateOwnerFile(target, allowRepair, hooks);
    return;
  } catch (error) {
    if (!(error instanceof UnexpectedLinkCountError) || error.metadata.nlink !== 2n) throw error;
    const identity = { dev: error.metadata.dev, ino: error.metadata.ino };
    let window = await validateOwnedPublicationWindow(layout, target, error.metadata, undefined, hooks);
    if (!window) {
      await validateOwnerFile(target, allowRepair, hooks);
      return;
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const liveness = publicationClaimLiveness(window.claim);
      if (liveness === "dead") {
        await recoverDeadOwnedPublicationWindow(layout, target, window, hooks);
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      if (liveness === "ambiguous") {
        throw new Error("Cache file publication claim owner liveness is ambiguous");
      }
      await new Promise<void>((accept) => setTimeout(accept, 25));
      const metadata = await lstat(target, { bigint: true });
      if (!sameStatIdentity(identity, metadata)) throw new Error("Cache file identity changed during publication wait");
      if (metadata.nlink === 1n) {
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      const currentWindow = await validateOwnedPublicationWindow(layout, target, metadata, window.claim, hooks);
      if (!currentWindow) {
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      window = currentWindow;
    }
    throw new Error("Cache file publication did not settle to one link");
  }
}

export async function validateCacheFile(
  layout: SecureCacheLayout,
  path: string,
  allowMissing: boolean,
  hooks: SecureCacheValidationHooks = {}
): Promise<void> {
  const target = assertCacheChild(layout, path, "file");
  await validateOrdinaryPathComponents(target, allowMissing ? "missing-ok" : "file");
  const parent = await realpath(dirname(target));
  const canonicalRoot = await realpath(layout.root);
  if (!sameFilesystemPath(canonicalRoot, layout.root) || !isInsideOrSame(canonicalRoot, parent)) {
    throw new Error("Cache file parent resolves outside the cache root");
  }
  await validateCacheDirectoryChain(canonicalRoot, parent);
  if (await optionalLstat(target)) {
    await validateOwnerFileWithPublicationWait(layout, target, basename(target) === "changeset-hmac.key", hooks);
  }
}

export async function validateCacheFiles(
  layout: SecureCacheLayout,
  paths: readonly string[]
): Promise<void> {
  if (paths.length === 0) return;
  const targets = paths.map((path) => assertCacheChild(layout, path, "file"));
  const parent = dirname(targets[0]!);
  if (targets.some((target) => !sameFilesystemPath(dirname(target), parent))) {
    throw new Error("Batch cache-file validation requires one shared parent");
  }
  await validateOrdinaryPathComponents(parent, "directory");
  const canonicalParent = await realpath(parent);
  const canonicalRoot = await realpath(layout.root);
  if (!sameFilesystemPath(canonicalRoot, layout.root) ||
      !sameFilesystemPath(canonicalParent, parent) ||
      !isInsideOrSame(canonicalRoot, canonicalParent)) {
    throw new Error("Cache file parent resolves outside the cache root");
  }
  await validateCacheDirectoryChain(canonicalRoot, canonicalParent);
  await Promise.all(targets.map(async (target) => {
    const metadata = await lstat(target, { bigint: true });
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Cache path is not an ordinary regular file: ${target}`);
    }
    const canonical = await realpath(target);
    if (!sameFilesystemPath(canonical, target)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${target}`);
    }
    await validateOwnerFileWithPublicationWait(layout, target, basename(target) === "changeset-hmac.key", {});
  }));
}

async function capturePathIdentity(path: string, kind: "directory" | "file"): Promise<SecurePathIdentity> {
  const target = resolve(path);
  const canonical = await realpath(target);
  if (!sameFilesystemPath(canonical, path)) throw new Error("Cache path identity is not canonical");
  const parent = await realpath(dirname(canonical));
  const [metadata, parentMetadata] = await Promise.all([
    lstat(target, { bigint: true }),
    lstat(parent, { bigint: true })
  ]);
  if (metadata.isSymbolicLink() || (kind === "directory" ? !metadata.isDirectory() : !metadata.isFile())) {
    throw new Error(`Cache path identity is not an ordinary ${kind}`);
  }
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new Error("Cache path parent identity is not an ordinary directory");
  }
  if (kind === "directory") await validateOwnerDirectory(canonical);
  return {
    path: canonical,
    parent,
    dev: metadata.dev,
    ino: metadata.ino,
    kind,
    parentDev: parentMetadata.dev,
    parentIno: parentMetadata.ino
  };
}

export async function validateSecurePathIdentity(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity
): Promise<void> {
  const target = identity.kind === "directory" && sameFilesystemPath(layout.root, identity.path)
    ? layout.root
    : assertCacheChild(layout, identity.path, identity.kind);
  if (!sameFilesystemPath(target, identity.path) || !sameFilesystemPath(dirname(target), identity.parent)) {
    throw new Error("Cache path identity has an unexpected parent");
  }
  const current = await capturePathIdentity(target, identity.kind);
  if (
    current.dev !== identity.dev || current.ino !== identity.ino || current.kind !== identity.kind ||
    !sameFilesystemPath(current.path, identity.path) || !sameFilesystemPath(current.parent, identity.parent) ||
    current.parentDev !== identity.parentDev || current.parentIno !== identity.parentIno
  ) {
    throw new Error("Cache path identity changed");
  }
}

export async function captureSecurePathIdentity(
  layout: SecureCacheLayout,
  path: string,
  kind: "directory" | "file"
): Promise<SecurePathIdentity> {
  const target = kind === "directory" && sameFilesystemPath(layout.root, path)
    ? layout.root
    : assertCacheChild(layout, path, kind);
  return capturePathIdentity(target, kind);
}

function sameObjectIdentity(left: SecurePathIdentity, right: SecurePathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind;
}

async function removeRecordedCacheFile(layout: SecureCacheLayout, identity: SecurePathIdentity): Promise<void> {
  if (identity.kind !== "file") throw new Error("Recorded cache cleanup identity must describe a file");
  if (!await optionalLstat(identity.path)) throw new Error("Recorded cache file identity disappeared before cleanup");
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path);
}

function samePublicationClaimOwner(left: PublicationClaimOwner, right: PublicationClaimOwner): boolean {
  return left.version === right.version && left.pid === right.pid && left.nonce === right.nonce &&
    left.createdAtMs === right.createdAtMs && left.expiresAtMs === right.expiresAtMs && left.targetName === right.targetName &&
    left.initializationName === right.initializationName && left.publicationName === right.publicationName;
}

export function samePublicationClaimEpoch(left: PublicationClaim, right: PublicationClaim): boolean {
  return sameObjectIdentity(left, right) &&
    sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.parent, right.parent) &&
    left.parentDev === right.parentDev && left.parentIno === right.parentIno &&
    samePublicationClaimOwner(left.owner, right.owner);
}

async function readBoundedPublicationClaimOwner(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  metadata: BigIntStats,
  expectedTargetName: string
): Promise<PublicationClaimOwner> {
  if (metadata.size < 0n || metadata.size > BigInt(maximumPublicationClaimOwnerBytes)) {
    throw new Error(`Publication claim owner exceeds its byte limit of ${maximumPublicationClaimOwnerBytes}`);
  }
  const size = Number(metadata.size);
  const handle = await open(identity.path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    let settlementTransitionObserved = false;
    if (!samePublicationClaimFileVersion(metadata, opened)) {
      if (isPublicationClaimSettlementTransition(metadata, opened)) {
        settlementTransitionObserved = true;
      } else {
        throw new Error("Publication claim owner identity or metadata changed before bounded read");
      }
    }
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = await handle.read(bytes, offset, Math.min(4096, size - offset), offset);
      if (read.bytesRead <= 0) throw new Error("Publication claim owner ended during bounded read");
      offset += read.bytesRead;
    }
    const overflow = Buffer.allocUnsafe(1);
    if ((await handle.read(overflow, 0, 1, size)).bytesRead !== 0) {
      throw new Error("Publication claim owner exceeded its validated byte length during bounded read");
    }
    const owner = parsePublicationClaimOwner(JSON.parse(bytes.toString("utf8")), expectedTargetName);
    const [finalPath, finalHandle] = await Promise.all([
      lstat(identity.path, { bigint: true }),
      handle.stat({ bigint: true })
    ]);
    if (!samePublicationClaimFileVersion(opened, finalPath)) {
      if (!isPublicationClaimSettlementTransition(opened, finalPath)) {
        throw new Error("Publication claim owner identity or metadata changed during bounded read");
      }
      settlementTransitionObserved = true;
    }
    if (!samePublicationClaimFileVersion(opened, finalHandle)) {
      if (!isPublicationClaimSettlementTransition(opened, finalHandle)) {
        throw new Error("Publication claim owner identity or metadata changed during bounded read");
      }
      settlementTransitionObserved = true;
    }
    await validateSecurePathIdentity(layout, identity);
    if (settlementTransitionObserved) {
      throw new PublicationClaimInitializationSettled({ ...identity, kind: "file", owner });
    }
    return owner;
  } finally {
    await handle.close();
  }
}

async function capturePublicationClaim(
  layout: SecureCacheLayout,
  target: string,
  hooks: PublicationClaimCaptureHooks = {}
): Promise<PublicationClaim> {
  const claimPath = publicationClaimPath(target);
  let observedClaim: PublicationClaim | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const identity = await capturePathIdentity(claimPath, "file");
    const metadata = await lstat(claimPath, { bigint: true });
    if (!sameStatIdentity(identity, metadata)) throw new Error("Publication claim identity changed during capture");
    if (metadata.nlink !== 1n && metadata.nlink !== 2n) {
      throw new Error("Publication claim has an unexpected hard-link count");
    }
    assertSecureOwnerFileMetadata(metadata, claimPath, metadata.nlink);
    await hooks.afterClaimMetadataCapture?.(claimPath, metadata);
    let owner: PublicationClaimOwner;
    try {
      owner = await readBoundedPublicationClaimOwner(layout, identity, metadata, basename(target));
    } catch (error) {
      if (error instanceof PublicationClaimInitializationSettled) {
        if (error.claim) {
          if (observedClaim && !samePublicationClaimEpoch(observedClaim, error.claim)) {
            throw new Error("Publication claim identity or owner metadata changed while initialization settled");
          }
          observedClaim = error.claim;
        }
        continue;
      }
      throw error;
    }
    const candidate: PublicationClaim = { ...identity, kind: "file", owner };
    if (observedClaim && !samePublicationClaimEpoch(observedClaim, candidate)) {
      throw new Error("Publication claim identity or owner metadata changed while initialization settled");
    }
    observedClaim = candidate;
    const initializationPath = join(identity.parent, owner.initializationName);
    if (metadata.nlink === 1n) {
      const initializationMetadata = await optionalLstat(initializationPath);
      if (initializationMetadata) {
        const currentClaim = await optionalLstat(claimPath);
        if (currentClaim && isPublicationClaimSettlementTransition(metadata, initializationMetadata) &&
            isPublicationClaimSettlementTransition(metadata, currentClaim)) {
          continue;
        }
        throw new Error("Publication claim initialization path is ambiguous");
      }
      return { ...identity, kind: "file", owner };
    }
    let initializationMetadata: Awaited<ReturnType<typeof lstat>>;
    try {
      initializationMetadata = await lstat(initializationPath, { bigint: true });
    } catch (error) {
      if (isMissingPathError(error)) {
        const settled = await lstat(claimPath, { bigint: true });
        if (sameStatIdentity(identity, settled) && settled.nlink === 1n &&
            isPublicationClaimSettlementTransition(metadata, settled)) continue;
      }
      throw error;
    }
    if (!samePublicationClaimFileVersion(metadata, initializationMetadata)) {
      const currentClaim = await optionalLstat(claimPath);
      if (currentClaim && sameStatIdentity(identity, initializationMetadata) &&
          isPublicationClaimSettlementTransition(metadata, initializationMetadata) &&
          isPublicationClaimSettlementTransition(metadata, currentClaim)) {
        continue;
      }
      throw new Error("Publication claim initialization identity or metadata changed during capture");
    }
    assertSecureOwnerFileMetadata(initializationMetadata, initializationPath, 2n);
    if (!sameStatIdentity(identity, initializationMetadata)) {
      throw new Error("Publication claim initialization identity does not match the deterministic claim");
    }
    const initializationIdentity = fileIdentity(
      initializationPath,
      {
        path: identity.parent,
        parent: dirname(identity.parent),
        dev: identity.parentDev,
        ino: identity.parentIno,
        kind: "directory",
        parentDev: 0n,
        parentIno: 0n
      },
      initializationMetadata
    );
    const current = await lstat(claimPath, { bigint: true });
    if (!sameStatIdentity(identity, current)) throw new Error("Publication claim identity changed during capture");
    if (!samePublicationClaimFileVersion(metadata, current)) {
      if (isPublicationClaimSettlementTransition(metadata, current)) continue;
      throw new Error("Publication claim identity or metadata changed during capture");
    }
    return { ...identity, kind: "file", owner, initializationIdentity };
  }
  throw new Error("Publication claim initialization did not stabilize");
}

async function settlePublicationClaimInitialization(
  layout: SecureCacheLayout,
  expected: PublicationClaim
): Promise<PublicationClaim> {
  let current = await capturePublicationClaim(layout, join(expected.parent, expected.owner.targetName));
  if (!samePublicationClaimEpoch(expected, current)) throw new Error("Publication claim identity or owner metadata changed");
  if (!current.initializationIdentity) return current;
  try {
    await removeRecordedCacheFile(layout, current.initializationIdentity);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
  current = await capturePublicationClaim(layout, join(expected.parent, expected.owner.targetName));
  if (!samePublicationClaimEpoch(expected, current) || current.initializationIdentity) {
    throw new Error("Publication claim initialization did not converge to one link");
  }
  return current;
}

async function createPublicationClaim(
  layout: SecureCacheLayout,
  target: string,
  parent: SecurePathIdentity,
  hooks: PublicationClaimCreationHooks
): Promise<PublicationClaim> {
  const claimPath = publicationClaimPath(target);
  const initializationName = `.claim-${randomUUID()}.tmp`;
  const publicationName = `.${randomUUID()}.tmp`;
  const initializationPath = join(parent.path, initializationName);
  const owner = createPublicationClaimOwner(basename(target), initializationName, publicationName);
  const bytes = Buffer.from(`${JSON.stringify(owner)}\n`, "utf8");
  let initializationIdentity: SecurePathIdentity | undefined;
  let initializationOwned = false;
  let linked = false;
  let primaryError: unknown;
  try {
    await hooks.beforeClaimOwnerCreate?.(initializationPath);
    await validateSecurePathIdentity(layout, parent);
    const handle = await open(initializationPath, "wx", 0o600);
    initializationOwned = true;
    try {
      initializationIdentity = fileIdentity(initializationPath, parent, await handle.stat({ bigint: true }));
      const split = Math.max(1, Math.floor(bytes.byteLength / 2));
      await handle.write(bytes.subarray(0, split));
      await hooks.duringClaimOwnerWrite?.(initializationPath);
      await handle.write(bytes.subarray(split));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await hooks.beforeClaimOwnerIdentityCapture?.(initializationPath);
    const completed = await capturePathIdentity(initializationPath, "file");
    if (!initializationIdentity || !sameObjectIdentity(initializationIdentity, completed)) {
      throw new Error("Publication claim owner identity changed during creation");
    }
    await validateOwnerFile(initializationPath, false);
    const completedMetadata = await lstat(initializationPath, { bigint: true });
    assertSecureOwnerFileMetadata(completedMetadata, initializationPath, 1n);
    const parsed = await readBoundedPublicationClaimOwner(layout, completed, completedMetadata, basename(target));
    if (!samePublicationClaimOwner(owner, parsed)) throw new Error("Publication claim owner bytes changed during creation");
    await validateSecurePathIdentity(layout, parent);
    await validateSecurePathIdentity(layout, completed);
    await hooks.beforeClaimLink?.(initializationPath, claimPath);
    await validateSecurePathIdentity(layout, parent);
    await validateSecurePathIdentity(layout, completed);
    await link(initializationPath, claimPath);
    linked = true;
    await hooks.afterClaimLink?.(initializationPath, claimPath);
    const visible = await capturePublicationClaim(layout, target);
    if (!sameObjectIdentity(completed, visible) || !samePublicationClaimOwner(owner, visible.owner) ||
        !visible.initializationIdentity || !sameObjectIdentity(completed, visible.initializationIdentity)) {
      throw new Error("Publication claim was not atomically published from its complete owner record");
    }
    await syncPublishedTarget(layout, visible, 2n, {
      beforeFinalTargetFileSync: hooks.beforeClaimFinalFileSync,
      afterFinalTargetFileSync: hooks.afterClaimFinalFileSync
    });
    const settled = await settlePublicationClaimInitialization(layout, visible);
    initializationOwned = false;
    await syncPublishedTarget(layout, settled, 1n, {
      beforeFinalTargetFileSync: hooks.beforeClaimFinalFileSync,
      afterFinalTargetFileSync: hooks.afterClaimFinalFileSync
    });
    await syncPublicationDirectory(parent.path, hooks);
    return settled;
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors: unknown[] = [];
  if (linked && initializationIdentity) {
    try {
      const visible = await capturePublicationClaim(layout, target);
      if (!sameObjectIdentity(initializationIdentity, visible) || !samePublicationClaimOwner(owner, visible.owner)) {
        throw new Error("Publication claim changed before failed-creation cleanup");
      }
      const settled = await settlePublicationClaimInitialization(layout, visible);
      initializationOwned = false;
      await safeRemovePublicationClaim(layout, settled, false, hooks);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (initializationOwned && initializationIdentity) {
    try {
      await removeRecordedCacheFile(layout, initializationIdentity);
      await syncPublicationDirectory(parent.path, hooks);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "Publication claim creation failed and cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}

export type PublicationClaimObservation =
  | { state: "absent" }
  | { state: "owned"; claim: PublicationClaim };

async function observePublicationClaim(
  layout: SecureCacheLayout,
  target: string,
  hooks: PublicationClaimCaptureHooks = {}
): Promise<PublicationClaimObservation> {
  const claimPath = publicationClaimPath(target);
  if (!await optionalLstat(claimPath)) return { state: "absent" };
  try {
    return { state: "owned", claim: await capturePublicationClaim(layout, target, hooks) };
  } catch (error) {
    if (!await optionalLstat(claimPath)) return { state: "absent" };
    throw new Error("Occupied publication claim is malformed or ambiguous", { cause: error });
  }
}

export async function validatePublicationClaim(layout: SecureCacheLayout, claim: PublicationClaim): Promise<void> {
  const current = await capturePublicationClaim(layout, join(claim.parent, claim.owner.targetName));
  if (!samePublicationClaimEpoch(claim, current)) {
    throw new Error("Publication claim identity or owner metadata changed");
  }
}

export function publicationClaimLiveness(claim: PublicationClaim, now = Date.now()): PublicationClaimLiveness {
  if (now < claim.owner.expiresAtMs) return "alive";
  return probeProcessLiveness(claim.owner.pid);
}

export type CacheFilePublicationReconciliation =
  | { state: "absent" | "present" }
  | { state: "active"; claim: PublicationClaim };

/** Validate and reconcile the exact Task-2 publication claim for one cache-file target. */
export async function reconcileCacheFilePublication(
  layout: SecureCacheLayout,
  path: string
): Promise<CacheFilePublicationReconciliation> {
  const target = assertCacheChild(layout, path, "file");
  const observation = await observePublicationClaim(layout, target);
  if (observation.state === "absent") {
    return { state: await optionalLstat(target) ? "present" : "absent" };
  }
  const liveness = publicationClaimLiveness(observation.claim);
  if (liveness === "ambiguous") {
    throw new Error("Cache file publication claim owner liveness is ambiguous");
  }
  if (liveness === "alive") {
    await validatePublicationClaim(layout, observation.claim);
    return { state: "active", claim: observation.claim };
  }
  return { state: await reconcileDeadFilePublicationClaim(layout, target, observation.claim, {}) };
}

async function safeRemovePublicationClaim(
  layout: SecureCacheLayout,
  claim: PublicationClaim,
  requireSnapshotClaim: boolean,
  hooks: PublicationClaimCleanupHooks = {}
): Promise<void> {
  if (claim.kind !== "file") throw new Error("Owned publication claim identity must describe a file");
  const target = assertCacheChild(layout, claim.path, "file");
  if (!/^\.publish-/u.test(basename(target)) ||
      (requireSnapshotClaim && (!isStrictlyInside(layout.indexes, target) || !/^\.publish-[a-f0-9]{64}$/iu.test(basename(target))))) {
    throw new Error("Owned publication claim has an invalid path");
  }
  const settled = await settlePublicationClaimInitialization(layout, claim);
  const releasedPath = `${claim.path}.release-${claim.owner.nonce}`;
  assertCacheChild(layout, releasedPath, "file");
  if (await optionalLstat(releasedPath)) throw new Error(`Publication claim release path already exists: ${releasedPath}`);
  const parent = await capturePathIdentity(settled.parent, "directory");
  if (parent.dev !== settled.parentDev || parent.ino !== settled.parentIno) {
    throw new Error("Publication claim parent identity changed before release");
  }
  await validatePublicationClaim(layout, settled);
  await rename(settled.path, releasedPath);
  const releasedClaim: SecurePathIdentity = { ...settled, path: releasedPath };
  await hooks.afterRename?.(releasedPath);
  const capturedClaim = await capturePathIdentity(releasedPath, "file");
  const releasedMetadata = await lstat(releasedPath, { bigint: true });
  assertSecureOwnerFileMetadata(releasedMetadata, releasedPath, 1n);
  const releasedOwner = await readBoundedPublicationClaimOwner(
    layout,
    capturedClaim,
    releasedMetadata,
    settled.owner.targetName
  );
  if (!sameObjectIdentity(releasedClaim, capturedClaim) || !samePublicationClaimOwner(settled.owner, releasedOwner)) {
    throw new Error(`Released publication claim identity changed; retained exact path: ${releasedPath}`);
  }
  await removeRecordedCacheFile(layout, releasedClaim);
  await syncPublicationDirectory(settled.parent, hooks);
}

async function reconcileDeadFilePublicationClaim(
  layout: SecureCacheLayout,
  target: string,
  claim: PublicationClaim,
  hooks: SecureCacheValidationHooks
): Promise<"absent" | "present"> {
  await validatePublicationClaim(layout, claim);
  if (publicationClaimLiveness(claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  const targetMetadata = await optionalLstat(target);
  if (!targetMetadata) {
    await validatePublicationClaim(layout, claim);
    if (publicationClaimLiveness(claim) !== "dead") {
      throw new Error("Cache file publication claim owner is not definitively dead");
    }
    await safeRemovePublicationClaim(layout, claim, false);
    return await optionalLstat(target) ? "present" : "absent";
  }
  if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile()) {
    throw new Error("Dead cache publisher target is not an ordinary regular file");
  }
  if (targetMetadata.nlink === 2n) {
    const window = await validateOwnedPublicationWindow(layout, target, targetMetadata, claim, hooks);
    if (!window) return reconcileDeadFilePublicationClaim(layout, target, claim, hooks);
    await recoverDeadOwnedPublicationWindow(layout, target, window, hooks);
    return "present";
  }
  if (targetMetadata.nlink !== 1n) {
    throw new Error("Dead cache publisher target has an ambiguous hard-link count");
  }
  assertSecureOwnerFileMetadata(targetMetadata, target, 1n);
  const targetIdentity = await capturePathIdentity(target, "file");
  await validatePublicationClaim(layout, claim);
  if (publicationClaimLiveness(claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await safeRemovePublicationClaim(layout, claim, false);
  await validateSecurePathIdentity(layout, targetIdentity);
  await validateOwnerFile(target, false);
  return "present";
}

async function acquireFilePublicationClaim(
  layout: SecureCacheLayout,
  target: string,
  hooks: SecureCachePublicationHooks
): Promise<PublicationClaim> {
  const claimPath = publicationClaimPath(target);
  const parent = await capturePathIdentity(dirname(target), "directory");
  let observed: PublicationClaim | undefined;
  const deadline = performance.now() + PUBLICATION_CLAIM_WAIT_MS;
  for (;;) {
    if (performance.now() >= deadline) {
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    }
    try {
      const created = await createPublicationClaim(layout, target, parent, hooks);
      if (performance.now() < deadline) return created;
      try {
        await safeRemovePublicationClaim(layout, created, false);
      } catch (cleanupError) {
        throw new AggregateError(
          [new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`), cleanupError],
          "Cache file publication claim acquisition expired and cleanup was ambiguous"
        );
      }
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (performance.now() >= deadline) {
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    }
    const observation = await observePublicationClaim(layout, target);
    if (observation.state === "absent") {
      if (await optionalLstat(target)) throw Object.assign(new Error("Cache file target already exists"), { code: "EEXIST" });
      observed = undefined;
      if (performance.now() >= deadline) {
        throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
      }
      continue;
    }
    const current = observation.claim;
    if (!sameFilesystemPath(current.parent, parent.path) || current.parentDev !== parent.dev || current.parentIno !== parent.ino) {
      throw new Error("Cache file publication claim has an unexpected parent");
    }
    if (observed && !samePublicationClaimEpoch(observed, current)) throw new Error("Cache file publication claim identity changed");
    observed = current;
    const liveness = publicationClaimLiveness(current);
    if (liveness === "dead") {
      const resolution = await reconcileDeadFilePublicationClaim(layout, target, current, hooks);
      if (resolution === "present") throw Object.assign(new Error("Cache file target already exists"), { code: "EEXIST" });
      observed = undefined;
      continue;
    }
    if (liveness === "ambiguous") throw new Error("Cache file publication claim owner liveness is ambiguous");
    if (performance.now() >= deadline) throw new Error(`Cache file publication claim is still owned by a live process: ${claimPath}`);
    await new Promise<void>((accept) => setTimeout(accept, 25));
  }
}

export async function publishExclusiveFile(
  layout: SecureCacheLayout,
  path: string,
  bytes: string | Uint8Array,
  hooks: SecureCachePublicationHooks = {}
): Promise<void> {
  const target = assertCacheChild(layout, path, "file");
  const publicationClaim = await acquireFilePublicationClaim(layout, target, hooks);
  const temporary = join(dirname(target), publicationClaim.owner.publicationName);
  assertCacheChild(layout, temporary, "file");
  let parentIdentity: SecurePathIdentity | undefined;
  let temporaryOwned = false;
  let temporaryIdentity: SecurePathIdentity | undefined;
  let publishedIdentity: SecurePathIdentity | undefined;
  let primaryError: unknown;
  try {
    await hooks.afterClaimAcquire?.(publicationClaim);
    parentIdentity = await capturePathIdentity(dirname(target), "directory");
    if (!sameFilesystemPath(parentIdentity.path, publicationClaim.parent) ||
        parentIdentity.dev !== publicationClaim.parentDev || parentIdentity.ino !== publicationClaim.parentIno) {
      throw new Error("Cache file publication parent identity changed after claim acquisition");
    }
    await hooks.beforeTemporaryCreate?.(temporary);
    await validateSecurePathIdentity(layout, parentIdentity);
    const handle = await open(temporary, "wx", 0o600);
    temporaryOwned = true;
    try {
      const metadata = await handle.stat({ bigint: true });
      temporaryIdentity = {
        path: temporary,
        parent: parentIdentity.path,
        dev: metadata.dev,
        ino: metadata.ino,
        kind: "file",
        parentDev: parentIdentity.dev,
        parentIno: parentIdentity.ino
      };
      await handle.writeFile(bytes);
      await handle.sync();
      await hooks.afterTemporaryFileSync?.(temporary);
    } finally {
      await handle.close();
    }
    await validateOwnerFile(temporary, false);
    await hooks.afterTemporaryCreate?.(temporary);
    await validateSecurePathIdentity(layout, temporaryIdentity);
    await hooks.beforeLink?.(temporary, target);
    await validateSecurePathIdentity(layout, parentIdentity);
    await validateSecurePathIdentity(layout, temporaryIdentity);
    // Node exposes no directory-handle-relative linkat equivalent. These immediate identity
    // checks close the avoidable windows, but pathname resolution inside link remains a syscall TOCTOU.
    await link(temporary, target);
    await hooks.afterLink?.(temporary, target);
    const [temporaryAfterLink, targetAfterLink] = await Promise.all([
      capturePathIdentity(temporary, "file"),
      capturePathIdentity(target, "file")
    ]);
    if (!sameObjectIdentity(temporaryIdentity, temporaryAfterLink) || !sameObjectIdentity(temporaryIdentity, targetAfterLink)) {
      throw new Error("Published cache file identity does not match the owned temporary file");
    }
    const [temporaryMetadata, targetMetadata] = await Promise.all([
      lstat(temporary, { bigint: true }),
      lstat(target, { bigint: true })
    ]);
    if (temporaryMetadata.nlink !== 2n || targetMetadata.nlink !== 2n) {
      throw new Error("Published cache file has an unexpected hard-link count");
    }
    publishedIdentity = targetAfterLink;
    await hooks.afterPublishedIdentity?.(publishedIdentity);
    await syncPublishedTarget(layout, publishedIdentity, 2n, hooks);
    await syncPublicationDirectory(parentIdentity.path, hooks);
  } catch (error) {
    primaryError = error;
  }

  let cleanupError: unknown;
  if (temporaryOwned && !temporaryIdentity) {
    cleanupError = new Error("Owned temporary cache file identity could not be recorded for cleanup");
  } else if (temporaryIdentity) {
    try {
      await hooks.beforeTemporaryCleanup?.(temporary);
      await removeRecordedCacheFile(layout, temporaryIdentity);
      if (publishedIdentity) await syncPublishedTarget(layout, publishedIdentity, 1n, hooks);
      await syncPublicationDirectory(temporaryIdentity.parent, hooks);
      await hooks.afterTemporaryCleanup?.(temporary, target);
    } catch (error) {
      cleanupError = error;
    }
  }
  let completionError: unknown = primaryError;
  if (completionError === undefined && cleanupError !== undefined) completionError = cleanupError;
  if (primaryError !== undefined && cleanupError !== undefined) {
    completionError = new AggregateError(
      [primaryError, cleanupError],
      "Cache file publication failed and temporary cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  if (completionError === undefined) {
    try {
      if (!publishedIdentity) throw new Error("Cache file publication did not produce a target identity");
      await validateCacheFile(layout, target, false);
      const finalIdentity = await capturePathIdentity(target, "file");
      if (!sameObjectIdentity(publishedIdentity, finalIdentity)) {
        throw new Error("Published cache file identity changed after temporary cleanup");
      }
    } catch (error) {
      completionError = error;
    }
  }
  let claimCleanupError: unknown;
  try {
    await safeRemovePublicationClaim(layout, publicationClaim, false, hooks);
  } catch (error) {
    claimCleanupError = error;
  }
  if (completionError !== undefined && claimCleanupError !== undefined) {
    throw new AggregateError(
      [completionError, claimCleanupError],
      "Cache file publication failed and claim cleanup was ambiguous",
      { cause: completionError }
    );
  }
  if (completionError !== undefined) throw completionError;
  if (claimCleanupError !== undefined) throw claimCleanupError;
}

export async function safeRemoveCacheFile(layout: SecureCacheLayout, path: string): Promise<void> {
  const target = assertCacheChild(layout, path, "file");
  const metadata = await optionalLstat(target);
  if (!metadata) return;
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error("Cache file cleanup target is not an ordinary regular file");
  }
  await validateCacheFile(layout, target, false);
  const identity = await capturePathIdentity(target, "file");
  await removeRecordedCacheFile(layout, identity);
}

interface ExactRemovalIntent {
  version: 1;
  targetPath: string;
  targetParent: string;
  quarantinePath: string;
  dev: string;
  ino: string;
  parentDev: string;
  parentIno: string;
}

const exactRemovalIntentPattern = /^\.remove-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/u;
const exactRemovalCandidatePattern = new RegExp(
  "^\\.remove-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})" +
  "\\.owner-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp$",
  "u"
);
const exactRemovalQuarantinePattern = /^\.removed-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-((?:0|[1-9][0-9]*))-((?:0|[1-9][0-9]*))\.data$/u;
const legacyExactRemovalQuarantinePattern = /^\.removed-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.data$/u;
const maximumExactRemovalIntentBytes = 4 * 1024;

interface ExactRemovalBudgetContext {
  work: CounterBudget;
  deadline: DeadlineBudget;
}

interface ExactRemovalOperationContext extends ExactRemovalBudgetContext {
  readonly kind: "hookful";
  finalWindowDeadline: DeadlineBudget;
}

interface ExactRemovalFinalContext extends ExactRemovalBudgetContext {
  readonly kind: "final";
  readonly finalContextToken: "native-exact-removal-final";
}

function createExactRemovalOperationContext(hooks: SecureExactRemovalHooks): ExactRemovalOperationContext {
  return {
    kind: "hookful",
    work: new CounterBudget("Exact-removal recovery work", changesetRemovalRecoveryLimits.maxWork),
    deadline: new DeadlineBudget(
      "Exact-removal recovery",
      changesetRemovalRecoveryLimits.deadlineMs,
      hooks.removalRecoveryNow
    ),
    // Final critical windows cannot call the injectable clock: it is an
    // external callback and may mutate filesystem state. The production
    // monotonic clock still bounds every I/O performed inside those windows.
    finalWindowDeadline: new DeadlineBudget(
      "Exact-removal final critical window",
      changesetRemovalRecoveryLimits.deadlineMs
    )
  };
}

function exactRemovalStep(context: ExactRemovalBudgetContext): void {
  context.work.consume();
  context.deadline.check();
}

async function exactRemovalOperation<T>(
  context: ExactRemovalBudgetContext,
  operation: () => Promise<T>
): Promise<T> {
  exactRemovalStep(context);
  const result = await operation();
  context.deadline.check();
  return result;
}

async function withExactRemovalFinalWindow<T>(
  context: ExactRemovalOperationContext,
  operation: (finalContext: ExactRemovalFinalContext) => Promise<T>
): Promise<T> {
  // Let the injectable deadline callback run before the final inspectors. Any
  // mutation it performs is therefore observed by the callback-free rescan.
  context.deadline.check();
  const finalContext: ExactRemovalFinalContext = {
    kind: "final",
    finalContextToken: "native-exact-removal-final",
    work: context.work,
    deadline: context.finalWindowDeadline
  };
  return operation(finalContext);
}

type ExactRemovalResourceKind = "file" | "directory";
type ExactRemovalResource = { close(): Promise<void> };

async function closeExactRemovalResource(
  resource: ExactRemovalResource,
  path: string,
  kind: ExactRemovalResourceKind,
  hooks: SecureExactRemovalHooks
): Promise<void> {
  try {
    if (hooks.closeExactRemovalResource) {
      await hooks.closeExactRemovalResource(resource, path, kind);
    } else {
      await resource.close();
    }
  } catch (error) {
    if (kind === "directory" && (error as NodeJS.ErrnoException).code === "ERR_DIR_CLOSED") return;
    throw error;
  }
}

async function closeExactRemovalResourceAfterError(
  resource: ExactRemovalResource,
  path: string,
  kind: ExactRemovalResourceKind,
  hooks: SecureExactRemovalHooks,
  primaryError: unknown
): Promise<never> {
  try {
    await closeExactRemovalResource(resource, path, kind, hooks);
  } catch (cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `Exact-removal ${kind} cleanup failed while preserving the primary operation error`,
      { cause: primaryError }
    );
  }
  throw primaryError;
}

async function acquireExactRemovalResource<T extends ExactRemovalResource>(
  context: ExactRemovalOperationContext,
  hooks: SecureExactRemovalHooks,
  path: string,
  kind: ExactRemovalResourceKind,
  acquire: () => Promise<T>
): Promise<T> {
  exactRemovalStep(context);
  const resource = await acquire();
  try {
    if (hooks.afterExactRemovalResourceAcquire) {
      exactRemovalStep(context);
      await hooks.afterExactRemovalResourceAcquire(path, kind);
    }
    context.deadline.check();
    return resource;
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(resource, path, kind, hooks, primaryError);
  }
}

async function withExactRemovalResource<T extends ExactRemovalResource, R>(
  context: ExactRemovalOperationContext,
  hooks: SecureExactRemovalHooks,
  path: string,
  kind: ExactRemovalResourceKind,
  acquire: () => Promise<T>,
  use: (resource: T) => Promise<R>
): Promise<R> {
  const resource = await acquireExactRemovalResource(context, hooks, path, kind, acquire);
  let result: R;
  try {
    result = await use(resource);
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(resource, path, kind, hooks, primaryError);
  }
  await closeExactRemovalResource(resource, path, kind, hooks);
  return result;
}

async function closeExactRemovalFinalResource(
  resource: ExactRemovalResource,
  kind: ExactRemovalResourceKind
): Promise<void> {
  try {
    await resource.close();
  } catch (error) {
    if (kind === "directory" && (error as NodeJS.ErrnoException).code === "ERR_DIR_CLOSED") return;
    throw error;
  }
}

async function acquireExactRemovalFinalResource<T extends ExactRemovalResource>(
  context: ExactRemovalFinalContext,
  kind: ExactRemovalResourceKind,
  acquire: () => Promise<T>
): Promise<T> {
  exactRemovalStep(context);
  const resource = await acquire();
  try {
    context.deadline.check();
    return resource;
  } catch (primaryError) {
    try {
      await closeExactRemovalFinalResource(resource, kind);
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        `Exact-removal final ${kind} cleanup failed while preserving the primary operation error`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
}

async function withExactRemovalFinalResource<T extends ExactRemovalResource, R>(
  context: ExactRemovalFinalContext,
  kind: ExactRemovalResourceKind,
  acquire: () => Promise<T>,
  use: (resource: T) => Promise<R>
): Promise<R> {
  const resource = await acquireExactRemovalFinalResource(context, kind, acquire);
  let result: R;
  try {
    result = await use(resource);
  } catch (primaryError) {
    try {
      await closeExactRemovalFinalResource(resource, kind);
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        `Exact-removal final ${kind} cleanup failed while preserving the primary operation error`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  await closeExactRemovalFinalResource(resource, kind);
  return result;
}

async function syncExactRemovalDirectoryFinal(
  directory: string,
  context: ExactRemovalFinalContext
): Promise<PublicationDirectorySyncOutcome> {
  return withExactRemovalFinalResource(
    context,
    "directory",
    () => open(directory, "r"),
    async (handle) => {
      try {
        await exactRemovalOperation(context, () => handle.sync());
        return "synced";
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== "win32" || !code || !windowsUnsupportedDirectorySyncCodes.has(code)) throw error;
        return "unsupported";
      }
    }
  );
}

const exactRemovalJournalLocks = new Map<string, { tail: Promise<void>; users: number }>();

async function withExactRemovalJournalLock<T>(locksPath: string, operation: () => Promise<T>): Promise<T> {
  const key = process.platform === "win32" ? locksPath.toLocaleLowerCase("en-US") : locksPath;
  let state = exactRemovalJournalLocks.get(key);
  if (!state) {
    state = { tail: Promise.resolve(), users: 0 };
    exactRemovalJournalLocks.set(key, state);
  }
  state.users += 1;
  const predecessor = state.tail;
  let release!: () => void;
  const turn = new Promise<void>((resolveTurn) => { release = resolveTurn; });
  state.tail = predecessor.then(() => turn);
  await predecessor;
  try {
    return await operation();
  } finally {
    release();
    state.users -= 1;
    if (state.users === 0 && exactRemovalJournalLocks.get(key) === state) {
      exactRemovalJournalLocks.delete(key);
    }
  }
}

class ExactRemovalByteLedger {
  readonly #sizes = new Map<string, number>();
  #total = 0;

  charge(identity: SecurePathIdentity, size: bigint): number {
    if (size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Exact-removal artifact size is not safely countable");
    const numericSize = Number(size);
    const key = `${identity.dev}:${identity.ino}`;
    const previous = this.#sizes.get(key) ?? 0;
    const nextTotal = this.#total - previous + numericSize;
    if (nextTotal > changesetRemovalRecoveryLimits.maxBytes) {
      throw new Error(
        `Exact-removal recovery bytes exceed the limit of ${changesetRemovalRecoveryLimits.maxBytes} bytes`
      );
    }
    this.#sizes.set(key, numericSize);
    this.#total = nextTotal;
    return numericSize;
  }

  release(identity: SecurePathIdentity): void {
    const key = `${identity.dev}:${identity.ino}`;
    const previous = this.#sizes.get(key);
    if (previous === undefined) return;
    this.#sizes.delete(key);
    this.#total -= previous;
  }

  get total(): number { return this.#total; }
}

interface ExactRemovalVisibleState {
  entries: number;
  ledger: ExactRemovalByteLedger;
}

function exactRemovalIntent(identity: SecurePathIdentity, quarantinePath: string): ExactRemovalIntent {
  return {
    version: 1,
    targetPath: identity.path,
    targetParent: identity.parent,
    quarantinePath,
    dev: String(identity.dev),
    ino: String(identity.ino),
    parentDev: String(identity.parentDev),
    parentIno: String(identity.parentIno)
  };
}

function hasExactRemovalInspectionHooks(hooks: SecureExactRemovalHooks): boolean {
  return hooks.beforeRemovalArtifactUse !== undefined ||
    hooks.readRemovalIntentChunk !== undefined ||
    hooks.afterExactRemovalResourceAcquire !== undefined ||
    hooks.closeExactRemovalResource !== undefined;
}

function hasExactRemovalPostClaimHooks(hooks: SecureExactRemovalHooks): boolean {
  return hasExactRemovalInspectionHooks(hooks) ||
    hooks.afterExactRemovalQuarantineClaim !== undefined ||
    hooks.afterExactRemovalArtifactSync !== undefined ||
    hooks.beforeParentDirectoryOpen !== undefined ||
    hooks.afterParentDirectorySync !== undefined;
}

function canReuseRecoveryReservation(hooks: SecureExactRemovalHooks): boolean {
  const allowedOutsideRecovery = new Set([
    "duringRemovalIntentCandidateWrite",
    "beforeRemovalIntentLink",
    "afterRemovalIntentLink",
    "writeRemovalIntentChunk"
  ]);
  return Object.entries(hooks).every(([name, value]) => value === undefined || allowedOutsideRecovery.has(name));
}

function parseExactRemovalIntent(
  layout: SecureCacheLayout,
  intentPath: string,
  value: unknown
): { targetIdentity: SecurePathIdentity; quarantinePath: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Exact-removal intent is not an object");
  const record = value as Record<string, unknown>;
  const expectedKeys = ["dev", "ino", "parentDev", "parentIno", "quarantinePath", "targetParent", "targetPath", "version"];
  if (Object.keys(record).sort().join("\0") !== expectedKeys.join("\0") || record.version !== 1) {
    throw new Error("Exact-removal intent has an unexpected schema");
  }
  for (const key of ["dev", "ino", "parentDev", "parentIno"] as const) {
    if (typeof record[key] !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(record[key])) {
      throw new Error(`Exact-removal intent has an invalid ${key}`);
    }
  }
  if (typeof record.targetPath !== "string" || typeof record.targetParent !== "string" || typeof record.quarantinePath !== "string") {
    throw new Error("Exact-removal intent has an invalid target path");
  }
  const target = assertCacheChild(layout, record.targetPath, "file");
  const parent = resolve(record.targetParent);
  if (!sameFilesystemPath(target, record.targetPath) || !sameFilesystemPath(dirname(target), parent) ||
      !sameFilesystemPath(parent, record.targetParent)) {
    throw new Error("Exact-removal intent target has an unexpected parent");
  }
  const quarantinePath = assertCacheChild(layout, record.quarantinePath, "file");
  const intentId = basename(intentPath).slice(".remove-".length, -".json".length);
  const quarantineName = basename(quarantinePath);
  const boundQuarantine = exactRemovalQuarantinePattern.exec(quarantineName);
  const legacyQuarantine = quarantineName === `.removed-${intentId}.data` && legacyExactRemovalQuarantinePattern.test(quarantineName);
  if (!sameFilesystemPath(dirname(quarantinePath), layout.locks) || (!legacyQuarantine && (
      !boundQuarantine || boundQuarantine[1] !== intentId ||
      boundQuarantine[2] !== record.dev || boundQuarantine[3] !== record.ino
  ))) {
    throw new Error("Exact-removal intent has an invalid quarantine path");
  }
  return { targetIdentity: {
    path: target,
    parent,
    dev: BigInt(record.dev as string),
    ino: BigInt(record.ino as string),
    kind: "file",
    parentDev: BigInt(record.parentDev as string),
    parentIno: BigInt(record.parentIno as string)
  }, quarantinePath };
}

async function validateExactCacheFile(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  expectedLinks: bigint,
  context: ExactRemovalBudgetContext
): Promise<void> {
  if (identity.kind !== "file") throw new Error("Exact cache cleanup identity must describe a file");
  await exactRemovalOperation(context, () => validateSecurePathIdentity(layout, identity));
  const metadata = await exactRemovalOperation(context, () => lstat(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, metadata)) throw new Error("Exact cache cleanup identity changed before unlink");
  assertSecureOwnerFileMetadata(metadata, identity.path, expectedLinks);
}

async function validateExactOneLinkCacheFile(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  context: ExactRemovalBudgetContext
): Promise<void> {
  await validateExactCacheFile(layout, identity, 1n, context);
}

async function removeExactRemovalIntent(
  layout: SecureCacheLayout,
  intentIdentity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
): Promise<void> {
  await validateExactOneLinkCacheFile(layout, intentIdentity, context);
  await exactRemovalOperation(context, () => rm(intentIdentity.path));
  await exactRemovalOperation(context, () => syncPublicationDirectory(intentIdentity.parent, hooks));
}

type ExactRemovalArtifactKind = "candidate" | "intent" | "quarantine" | "legacy-quarantine";

function exactRemovalArtifactMaxBytes(kind: ExactRemovalArtifactKind): number {
  return kind === "candidate" || kind === "intent"
    ? maximumExactRemovalIntentBytes
    : changesetRemovalRecoveryLimits.maxArtifactBytes;
}

async function validateExactRemovalArtifactForUse(
  layout: SecureCacheLayout,
  path: string,
  identity: SecurePathIdentity,
  kind: ExactRemovalArtifactKind,
  expectedLinks: bigint,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger,
  invokeHook = true
): Promise<Awaited<ReturnType<typeof lstat>>> {
  const operationHooks: SecureExactRemovalHooks = invokeHook
    ? hooks
    : { removalRecoveryNow: hooks.removalRecoveryNow };
  if (invokeHook && hooks.beforeRemovalArtifactUse) {
    await exactRemovalOperation(context, () => hooks.beforeRemovalArtifactUse!(path, kind));
  }
  const metadata = await withExactRemovalResource(
    context,
    operationHooks,
    path,
    "file",
    () => open(path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) {
        throw new Error(`Exact-removal ${kind} identity changed before use`);
      }
      assertSecureOwnerFileMetadata(observed, path, expectedLinks);
      if (observed.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
        throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat(path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error(`Exact-removal ${kind} changed during final metadata validation`);
  }
  assertSecureOwnerFileMetadata(finalMetadata, path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
  return finalMetadata;
}

async function validateExactRemovalArtifactForUseFinal(
  layout: SecureCacheLayout,
  path: string,
  identity: SecurePathIdentity,
  kind: ExactRemovalArtifactKind,
  expectedLinks: bigint,
  context: ExactRemovalFinalContext,
  ledger: ExactRemovalByteLedger
): Promise<Awaited<ReturnType<typeof lstat>>> {
  const metadata = await withExactRemovalFinalResource(
    context,
    "file",
    () => open(path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) {
        throw new Error(`Exact-removal ${kind} identity changed before final use`);
      }
      assertSecureOwnerFileMetadata(observed, path, expectedLinks);
      if (observed.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
        throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat(path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error(`Exact-removal ${kind} changed during final metadata validation`);
  }
  assertSecureOwnerFileMetadata(finalMetadata, path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
  return finalMetadata;
}

async function readExactRemovalIntent(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedLinks: bigint,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger,
  invokeHooks = true
): Promise<{ intentIdentity: SecurePathIdentity; targetIdentity: SecurePathIdentity; quarantinePath: string; bytes: Buffer }> {
  const operationHooks: SecureExactRemovalHooks = invokeHooks
    ? hooks
    : { removalRecoveryNow: hooks.removalRecoveryNow };
  const target = assertCacheChild(layout, intentPath, "file");
  if (!sameFilesystemPath(dirname(target), layout.locks) || !exactRemovalIntentPattern.test(basename(target))) {
    throw new Error("Exact-removal intent has an invalid path");
  }
  await validateExactRemovalArtifactForUse(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    operationHooks,
    context,
    ledger,
    invokeHooks
  );
  const bytes = await withExactRemovalResource(
    context,
    operationHooks,
    target,
    "file",
    () => open(target, "r"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, before)) throw new Error("Exact-removal intent identity changed before read");
    assertSecureOwnerFileMetadata(before, target, expectedLinks);
    if (before.size > BigInt(maximumExactRemovalIntentBytes)) throw new Error("Exact-removal intent exceeds its byte limit");
    const expectedBytes = Number(before.size);
      const observed = Buffer.alloc(expectedBytes);
    let offset = 0;
    while (offset < expectedBytes) {
      const length = expectedBytes - offset;
      const bytesRead = await exactRemovalOperation(context, async () => invokeHooks && hooks.readRemovalIntentChunk
          ? hooks.readRemovalIntentChunk(handle, observed, offset, length, offset)
          : (await handle.read(observed, offset, length, offset)).bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > length) {
        throw new Error("Exact-removal intent reader returned an invalid bounded byte count");
      }
      if (bytesRead === 0) throw new Error("Exact-removal intent ended before its exact metadata length");
      offset += bytesRead;
    }
    const eof = Buffer.alloc(1);
    const eofBytes = await exactRemovalOperation(context, async () => invokeHooks && hooks.readRemovalIntentChunk
      ? hooks.readRemovalIntentChunk(handle, eof, 0, 1, expectedBytes)
      : (await handle.read(eof, 0, 1, expectedBytes)).bytesRead);
    if (eofBytes !== 0) throw new Error("Exact-removal intent grew beyond its exact metadata length");
    const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, after) || after.size !== before.size) {
      throw new Error("Exact-removal intent changed during bounded read");
    }
    assertSecureOwnerFileMetadata(after, target, expectedLinks);
      return observed;
    }
  );
  await validateExactRemovalArtifactForUse(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    operationHooks,
    context,
    ledger,
    false
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Exact-removal intent is not valid JSON", { cause: error });
  }
  const parsedIntent = parseExactRemovalIntent(layout, intentPath, parsed);
  return { intentIdentity, ...parsedIntent, bytes };
}

async function readExactRemovalIntentFinal(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedLinks: bigint,
  context: ExactRemovalFinalContext,
  ledger: ExactRemovalByteLedger
): Promise<{ intentIdentity: SecurePathIdentity; targetIdentity: SecurePathIdentity; quarantinePath: string; bytes: Buffer }> {
  const target = assertCacheChild(layout, intentPath, "file");
  if (!sameFilesystemPath(dirname(target), layout.locks) || !exactRemovalIntentPattern.test(basename(target))) {
    throw new Error("Exact-removal intent has an invalid path");
  }
  await validateExactRemovalArtifactForUseFinal(
    layout, target, intentIdentity, "intent", expectedLinks, context, ledger
  );
  const bytes = await withExactRemovalFinalResource(
    context,
    "file",
    () => open(target, "r"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, before)) throw new Error("Exact-removal intent identity changed before final read");
      assertSecureOwnerFileMetadata(before, target, expectedLinks);
      if (before.size > BigInt(maximumExactRemovalIntentBytes)) throw new Error("Exact-removal intent exceeds its byte limit");
      const expectedBytes = Number(before.size);
      const observed = Buffer.alloc(expectedBytes);
      let offset = 0;
      while (offset < expectedBytes) {
        const length = expectedBytes - offset;
        const bytesRead = await exactRemovalOperation(
          context,
          async () => (await handle.read(observed, offset, length, offset)).bytesRead
        );
        if (!Number.isSafeInteger(bytesRead) || bytesRead <= 0 || bytesRead > length) {
          throw new Error("Exact-removal final intent reader returned an invalid bounded byte count");
        }
        offset += bytesRead;
      }
      const eof = Buffer.alloc(1);
      const eofBytes = await exactRemovalOperation(
        context,
        async () => (await handle.read(eof, 0, 1, expectedBytes)).bytesRead
      );
      if (eofBytes !== 0) throw new Error("Exact-removal intent grew beyond its exact metadata length");
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, after) || after.size !== before.size) {
        throw new Error("Exact-removal intent changed during final bounded read");
      }
      assertSecureOwnerFileMetadata(after, target, expectedLinks);
      return observed;
    }
  );
  await validateExactRemovalArtifactForUseFinal(
    layout, target, intentIdentity, "intent", expectedLinks, context, ledger
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Exact-removal intent is not valid JSON", { cause: error });
  }
  return { intentIdentity, ...parseExactRemovalIntent(layout, intentPath, parsed), bytes };
}

function assertExactRemovalIntentSemantic(
  observed: { targetIdentity: SecurePathIdentity; quarantinePath: string },
  expectedTarget: SecurePathIdentity,
  expectedQuarantinePath: string
): void {
  if (!sameObjectIdentity(observed.targetIdentity, expectedTarget) ||
      !sameFilesystemPath(observed.targetIdentity.path, expectedTarget.path) ||
      !sameFilesystemPath(observed.targetIdentity.parent, expectedTarget.parent) ||
      !sameFilesystemPath(observed.quarantinePath, expectedQuarantinePath)) {
    throw new Error("Exact-removal intent semantic value does not match the authoritative expected removal");
  }
}

async function validateExpectedExactRemovalIntent(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedLinks: bigint,
  expectedBytes: Buffer,
  expectedTarget: SecurePathIdentity,
  expectedQuarantinePath: string,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  const observed = await readExactRemovalIntent(
    layout, intentPath, intentIdentity, expectedLinks, hooks, context, ledger
  );
  if (!observed.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes do not match the authoritative expected intent");
  }
  assertExactRemovalIntentSemantic(observed, expectedTarget, expectedQuarantinePath);
  const authoritative = await readExactRemovalIntent(
    layout, intentPath, intentIdentity, expectedLinks, hooks, context, ledger, false
  );
  if (!authoritative.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes changed after mutation hooks completed");
  }
  assertExactRemovalIntentSemantic(authoritative, expectedTarget, expectedQuarantinePath);
}

/**
 * Final intent inspector. This deliberately receives no mutation hooks: callers
 * use it only after every hookful preflight and keep the following mutation in
 * the same no-callback critical window.
 */
async function inspectExpectedExactRemovalIntentFinal(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedLinks: bigint,
  expectedBytes: Buffer,
  expectedTarget: SecurePathIdentity,
  expectedQuarantinePath: string,
  context: ExactRemovalFinalContext,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  const authoritative = await readExactRemovalIntentFinal(
    layout, intentPath, intentIdentity, expectedLinks, context, ledger
  );
  if (!authoritative.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes changed before the final critical mutation");
  }
  assertExactRemovalIntentSemantic(authoritative, expectedTarget, expectedQuarantinePath);
}

async function validateExactRemovalParent(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  context: ExactRemovalBudgetContext
): Promise<void> {
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, identity.parent));
  const parentMetadata = await exactRemovalOperation(context, () => lstat(identity.parent, { bigint: true }));
  if (parentMetadata.dev !== identity.parentDev || parentMetadata.ino !== identity.parentIno) {
    throw new Error("Exact cache cleanup parent identity changed");
  }
}

async function syncExactCacheFile(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  expectedLinks: bigint,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  maxBytes: number,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  await validateExactCacheFile(layout, identity, expectedLinks, context);
  await withExactRemovalResource(
    context,
    hooks,
    identity.path,
    "file",
    () => open(identity.path, "r+"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, before)) throw new Error("Exact cache cleanup quarantine identity changed before sync");
      assertSecureOwnerFileMetadata(before, identity.path, expectedLinks);
      if (before.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup object exceeds its byte limit before sync");
      ledger.charge(identity, before.size);
      await exactRemovalOperation(context, () => handle.sync());
      if (hooks.afterExactRemovalArtifactSync) {
        await exactRemovalOperation(context, () => hooks.afterExactRemovalArtifactSync!(identity.path));
      }
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, after)) throw new Error("Exact cache cleanup quarantine identity changed during sync");
      assertSecureOwnerFileMetadata(after, identity.path, expectedLinks);
      if (after.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup object exceeds its byte limit during sync");
      ledger.charge(identity, after.size);
    }
  );
  await validateExactCacheFile(layout, identity, expectedLinks, context);
  const finalMetadata = await exactRemovalOperation(context, () => lstat(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size > BigInt(maxBytes)) {
    throw new Error("Exact cache cleanup object changed or exceeds its byte limit after sync");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
}

async function syncExactOneLinkCacheFile(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  maxBytes: number,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  await syncExactCacheFile(layout, identity, 1n, hooks, context, maxBytes, ledger);
}

async function syncExactOneLinkCacheFileFinal(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  context: ExactRemovalFinalContext,
  maxBytes: number,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  await validateExactCacheFile(layout, identity, 1n, context);
  await withExactRemovalFinalResource(
    context,
    "file",
    () => open(identity.path, "r+"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, before)) throw new Error("Exact cache cleanup final identity changed before sync");
      assertSecureOwnerFileMetadata(before, identity.path, 1n);
      if (before.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup final object exceeds its byte limit before sync");
      ledger.charge(identity, before.size);
      await exactRemovalOperation(context, () => handle.sync());
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, after)) throw new Error("Exact cache cleanup final identity changed during sync");
      assertSecureOwnerFileMetadata(after, identity.path, 1n);
      if (after.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup final object exceeds its byte limit during sync");
      ledger.charge(identity, after.size);
    }
  );
  await validateExactCacheFile(layout, identity, 1n, context);
  const finalMetadata = await exactRemovalOperation(context, () => lstat(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size > BigInt(maxBytes)) {
    throw new Error("Exact cache cleanup final object changed or exceeds its byte limit after sync");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  ledger.charge(identity, finalMetadata.size);
}

async function quarantineExactRemovalTarget(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedIntentBytes: Buffer,
  targetIdentity: SecurePathIdentity,
  quarantinePath: string,
  locksIdentity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger,
  visibleState: ExactRemovalVisibleState,
  afterTargetUnlink: () => void = () => undefined,
  reuseFinalReservation = false
): Promise<SecurePathIdentity> {
  if (await exactRemovalOperation(context, () => optionalLstat(quarantinePath))) {
    throw new Error("Exact cache cleanup quarantine path is already occupied");
  }
  await validateExactRemovalParent(layout, targetIdentity, context);
  await exactRemovalOperation(context, () => validateSecurePathIdentity(layout, locksIdentity));
  if (hooks.beforeExactRemovalUnlink) {
    await exactRemovalOperation(context, () => hooks.beforeExactRemovalUnlink!(targetIdentity.path));
  }
  // Hookful preflight deliberately precedes the final callback-free reservation.
  // Resource/artifact/close hooks may mutate state here, but never after the
  // final inspectors and before the exclusive quarantine link.
  if (hasExactRemovalInspectionHooks(hooks)) {
    await inspectExactRemovalTargetSize(layout, targetIdentity, hooks, context);
    await inspectExactRemovalJournal(layout, hooks, context);
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
  }
  const { finalReservation, targetBytes } = await withExactRemovalFinalWindow(context, async (finalContext) => {
    const finalReservation = reuseFinalReservation
      ? { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger }
      : await inspectExactRemovalJournalFinal(layout, finalContext);
    const targetBytes = await inspectExactRemovalTargetSizeFinal(layout, targetIdentity, finalContext);
    await inspectExpectedExactRemovalIntentFinal(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, finalContext, finalReservation.ledger
    );
    if (await exactRemovalOperation(finalContext, () => optionalLstat(quarantinePath))) {
      throw new Error("Exact cache cleanup quarantine path became occupied before exclusive claim");
    }
    await validateExactRemovalParent(layout, targetIdentity, finalContext);
    await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
    await validateExactOneLinkCacheFile(layout, targetIdentity, finalContext);
    assertExactRemovalJournalHeadroom(
      finalReservation.totalEntries,
      1,
      finalReservation.ledger.total,
      targetBytes
    );
    // An exclusive hard-link claim cannot overwrite a raced destination.
    await exactRemovalOperation(finalContext, () => link(targetIdentity.path, quarantinePath));
    return { finalReservation, targetBytes };
  });
  visibleState.entries = finalReservation.totalEntries;
  visibleState.ledger = finalReservation.ledger;
  ledger = finalReservation.ledger;
  // Recovery recognizes this two-link state and settles it by exact target identity.
  visibleState.entries += 1;
  visibleState.ledger.charge(targetIdentity, BigInt(targetBytes));
  let metadata = await exactRemovalOperation(context, () => lstat(quarantinePath, { bigint: true }));
  if (!sameStatIdentity(targetIdentity, metadata)) throw new Error("Exact cache cleanup quarantine claim identity changed");
  assertSecureOwnerFileMetadata(metadata, quarantinePath, 2n);
  let quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, metadata);
  await syncExactCacheFile(
    layout, quarantineIdentity, 2n, hooks, context,
    changesetRemovalRecoveryLimits.maxArtifactBytes, visibleState.ledger
  );
  await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  if (hooks.afterExactRemovalQuarantineClaim) {
    await exactRemovalOperation(
      context,
      () => hooks.afterExactRemovalQuarantineClaim!(targetIdentity.path, quarantinePath)
    );
  }
  const postClaimNeedsRescan = hasExactRemovalPostClaimHooks(hooks);
  if (postClaimNeedsRescan) {
    await inspectExactRemovalJournal(layout, hooks, context);
  }
  if (hasExactRemovalInspectionHooks(hooks)) {
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
  }
  const beforeUnlink = await withExactRemovalFinalWindow(context, async (finalContext) => {
    const beforeUnlink = postClaimNeedsRescan
      ? await inspectExactRemovalJournalFinal(layout, finalContext)
      : { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger };
    await inspectExpectedExactRemovalIntentFinal(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, finalContext, beforeUnlink.ledger
    );
    const [claimedTarget, claimedQuarantine] = await Promise.all([
      exactRemovalOperation(finalContext, () => lstat(targetIdentity.path, { bigint: true })),
      exactRemovalOperation(finalContext, () => lstat(quarantinePath, { bigint: true }))
    ]);
    if (!sameStatIdentity(targetIdentity, claimedTarget) || !sameStatIdentity(targetIdentity, claimedQuarantine)) {
      throw new Error("Exact cache cleanup target or quarantine claim identity changed before unlink");
    }
    assertSecureOwnerFileMetadata(claimedTarget, targetIdentity.path, 2n);
    assertSecureOwnerFileMetadata(claimedQuarantine, quarantinePath, 2n);
    await validateExactCacheFile(layout, targetIdentity, 2n, finalContext);
    await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
    afterTargetUnlink();
    return beforeUnlink;
  });
  visibleState.entries = beforeUnlink.totalEntries;
  visibleState.ledger = beforeUnlink.ledger;
  ledger = beforeUnlink.ledger;
  metadata = await exactRemovalOperation(context, () => lstat(quarantinePath, { bigint: true }));
  if (!sameStatIdentity(targetIdentity, metadata)) throw new Error("Exact cache cleanup quarantine identity changed after target unlink");
  assertSecureOwnerFileMetadata(metadata, quarantinePath, 1n);
  quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, metadata);
  await validateExactRemovalArtifactForUse(
    layout, quarantinePath, quarantineIdentity, "quarantine", 1n,
    hooks, context, visibleState.ledger
  );
  await syncExactOneLinkCacheFile(
    layout, quarantineIdentity, hooks, context,
    changesetRemovalRecoveryLimits.maxArtifactBytes, visibleState.ledger
  );
  return quarantineIdentity;
}

async function finishExactRemoval(
  layout: SecureCacheLayout,
  intentPath: string,
  intentIdentity: SecurePathIdentity,
  expectedIntentBytes: Buffer,
  targetIdentity: SecurePathIdentity,
  quarantinePath: string,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger,
  visibleState: ExactRemovalVisibleState
): Promise<void> {
  const intentHandle = await acquireExactRemovalResource(
    context, hooks, intentPath, "file", () => open(intentPath, "r+")
  );
  let quarantineIdentity: SecurePathIdentity | undefined;
  try {
    const intentMetadata = await exactRemovalOperation(context, () => intentHandle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, intentMetadata)) throw new Error("Exact-removal intent identity changed before recovery");
    assertSecureOwnerFileMetadata(intentMetadata, intentPath, 1n);
    await validateExactOneLinkCacheFile(layout, intentIdentity, context);
    await validateExactRemovalParent(layout, targetIdentity, context);
    const locksIdentity = await exactRemovalOperation(context, () => capturePathIdentity(layout.locks, "directory"));
    const targetMetadata = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    const quarantineMetadata = await exactRemovalOperation(context, () => optionalLstat(quarantinePath));
    if (targetMetadata && quarantineMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata) || !sameStatIdentity(targetIdentity, quarantineMetadata)) {
        throw new Error("Exact cache cleanup found mismatched target and quarantine claim evidence");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 2n);
      assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 2n);
      if (hooks.beforeExactRemovalUnlink) {
        await exactRemovalOperation(context, () => hooks.beforeExactRemovalUnlink!(targetIdentity.path));
      }
      await validateExpectedExactRemovalIntent(
        layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
        targetIdentity, quarantinePath, hooks, context, ledger
      );
      const recoveryNeedsRescan = hooks.beforeExactRemovalUnlink !== undefined ||
        hasExactRemovalInspectionHooks(hooks);
      if (recoveryNeedsRescan) {
        await inspectExactRemovalJournal(layout, hooks, context);
      }
      const recoveredReservation = await withExactRemovalFinalWindow(context, async (finalContext) => {
        const recoveredReservation = recoveryNeedsRescan
          ? await inspectExactRemovalJournalFinal(layout, finalContext)
          : { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger };
        await inspectExpectedExactRemovalIntentFinal(
          layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
          targetIdentity, quarantinePath, finalContext, recoveredReservation.ledger
        );
        const [currentTarget, currentQuarantine] = await Promise.all([
          exactRemovalOperation(finalContext, () => lstat(targetIdentity.path, { bigint: true })),
          exactRemovalOperation(finalContext, () => lstat(quarantinePath, { bigint: true }))
        ]);
        if (!sameStatIdentity(targetIdentity, currentTarget) || !sameStatIdentity(targetIdentity, currentQuarantine)) {
          throw new Error("Exact cache cleanup quarantine claim changed during recovery");
        }
        assertSecureOwnerFileMetadata(currentTarget, targetIdentity.path, 2n);
        assertSecureOwnerFileMetadata(currentQuarantine, quarantinePath, 2n);
        await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
        return recoveredReservation;
      });
      visibleState.entries = recoveredReservation.totalEntries;
      visibleState.ledger = recoveredReservation.ledger;
      ledger = recoveredReservation.ledger;
      const settled = await exactRemovalOperation(context, () => lstat(quarantinePath, { bigint: true }));
      assertSecureOwnerFileMetadata(settled, quarantinePath, 1n);
      quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, settled);
      await validateExactRemovalArtifactForUse(
        layout, quarantinePath, quarantineIdentity, "quarantine", 1n, hooks, context, ledger
      );
      await syncExactOneLinkCacheFile(
        layout, quarantineIdentity, hooks, context,
        changesetRemovalRecoveryLimits.maxArtifactBytes, ledger
      );
    } else if (targetMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata)) {
        throw new Error("Exact-removal intent target was replaced during recovery; preserving evidence");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 1n);
      if (quarantineMetadata) throw new Error("Exact cache cleanup found both target and quarantine evidence");
      quarantineIdentity = await quarantineExactRemovalTarget(
        layout,
        intentPath,
        intentIdentity,
        expectedIntentBytes,
        targetIdentity,
        quarantinePath,
        locksIdentity,
        hooks,
        context,
        ledger,
        visibleState,
        undefined,
        canReuseRecoveryReservation(hooks)
      );
    } else if (quarantineMetadata) {
      if (!sameStatIdentity(targetIdentity, quarantineMetadata)) {
        throw new Error("Exact cache cleanup quarantine identity changed; preserving recovery evidence");
      }
      assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 1n);
      quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, quarantineMetadata);
      await validateExactRemovalArtifactForUse(
        layout,
        quarantinePath,
        quarantineIdentity,
        "quarantine",
        1n,
        hooks,
        context,
        ledger
      );
      await syncExactOneLinkCacheFile(
        layout, quarantineIdentity, hooks, context,
        changesetRemovalRecoveryLimits.maxArtifactBytes, ledger
      );
    }
    // Re-sync the write-ahead intent after the target has moved to its durable,
    // identity-validated quarantine name and before any fallible metadata cleanup.
    await exactRemovalOperation(context, () => intentHandle.sync());
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync!(intentPath, "unlinked"));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
    if (hooks.afterExactRemovalUnlink) {
      await exactRemovalOperation(context, () => hooks.afterExactRemovalUnlink!(targetIdentity.path, intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(targetIdentity.parent, hooks));
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
    if (quarantineIdentity) {
      const exactQuarantineIdentity = quarantineIdentity;
      await validateExactOneLinkCacheFile(layout, exactQuarantineIdentity, context);
      await exactRemovalOperation(context, () => rm(exactQuarantineIdentity.path));
      visibleState.entries -= 1;
      visibleState.ledger.release(exactQuarantineIdentity);
      await exactRemovalOperation(context, () => intentHandle.sync());
      await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    }
    if (hooks.beforeExactRemovalCompletion) {
      await exactRemovalOperation(context, () => hooks.beforeExactRemovalCompletion!(intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, expectedIntentBytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
    await validateExactOneLinkCacheFile(layout, intentIdentity, context);
    const completedTarget = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    const completedQuarantine = await exactRemovalOperation(context, () => optionalLstat(quarantinePath));
    if (completedTarget) {
      throw new Error("Exact-removal target was replaced before completion; preserving intent evidence");
    }
    if (completedQuarantine) {
      throw new Error("Exact-removal quarantine reappeared before completion; preserving intent evidence");
    }
    const completedIntent = await exactRemovalOperation(context, () => intentHandle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, completedIntent)) {
      throw new Error("Exact-removal intent epoch changed before completion");
    }
    assertSecureOwnerFileMetadata(completedIntent, intentPath, 1n);
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(intentHandle, intentPath, "file", hooks, primaryError);
  }
  await closeExactRemovalResource(intentHandle, intentPath, "file", hooks);
  await removeExactRemovalIntent(layout, intentIdentity, hooks, context);
  visibleState.entries -= 1;
  visibleState.ledger.release(intentIdentity);
}

/**
 * Recover fsynced exact-removal intents. A matching inode is removed idempotently;
 * an occupied replacement path is retained and reported as ambiguous.
 */
export interface ExactRemovalRecoveryUsage {
  retainedEntries: number;
  retainedBytes: number;
}

interface ExactRemovalArtifact {
  name: string;
  path: string;
  identity: SecurePathIdentity;
  metadata: Awaited<ReturnType<typeof lstat>>;
  kind: ExactRemovalArtifactKind;
  removalId: string;
  quarantineBinding?: { dev: string; ino: string };
}

interface ExactRemovalJournalScan {
  artifacts: ExactRemovalArtifact[];
  totalEntries: number;
}

interface ExactRemovalReconcileResult {
  usage: ExactRemovalRecoveryUsage;
  visibleState: ExactRemovalVisibleState;
}

async function scanExactRemovalJournal(
  layout: SecureCacheLayout,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  invokeHooks = true
): Promise<ExactRemovalJournalScan> {
  const operationHooks: SecureExactRemovalHooks = invokeHooks
    ? hooks
    : { removalRecoveryNow: hooks.removalRecoveryNow };
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, layout.locks));
  const entryBudget = new CounterBudget("Exact-removal lock-directory entries", changesetRemovalRecoveryLimits.maxEntries);
  const artifacts: ExactRemovalArtifact[] = [];
  let totalEntries = 0;
  await withExactRemovalResource(
    context,
    operationHooks,
    layout.locks,
    "directory",
    () => opendir(layout.locks),
    async (directory) => {
    for await (const entry of directory) {
      entryBudget.consume();
      exactRemovalStep(context);
      totalEntries += 1;
      const candidate = exactRemovalCandidatePattern.exec(entry.name);
      const intent = exactRemovalIntentPattern.test(entry.name)
        ? entry.name.slice(".remove-".length, -".json".length)
        : undefined;
      const quarantine = exactRemovalQuarantinePattern.exec(entry.name);
      const legacyQuarantine = legacyExactRemovalQuarantinePattern.test(entry.name)
        ? entry.name.slice(".removed-".length, -".data".length)
        : undefined;
      if (!candidate && !intent && !quarantine && !legacyQuarantine) continue;
      if (!entry.isFile()) throw new Error(`Exact-removal recovery artifact is not an ordinary file: ${entry.name}`);
      const path = join(layout.locks, entry.name);
      const identity = await exactRemovalOperation(context, () => capturePathIdentity(path, "file"));
      const metadata = await exactRemovalOperation(context, () => lstat(path, { bigint: true }));
      const kind = candidate ? "candidate" : intent ? "intent" : quarantine ? "quarantine" : "legacy-quarantine";
      if (metadata.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
        throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
      }
      assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
      if ((kind === "quarantine" || kind === "legacy-quarantine") &&
          metadata.nlink !== 1n && metadata.nlink !== 2n) {
        throw new Error("Exact-removal quarantine has an unexpected hard-link count");
      }
      artifacts.push({
        name: entry.name,
        path,
        identity,
        metadata,
        kind,
        removalId: candidate?.[1] ?? intent ?? quarantine?.[1] ?? legacyQuarantine!,
        ...(quarantine ? { quarantineBinding: { dev: quarantine[2]!, ino: quarantine[3]! } } : {})
      });
    }
    }
  );
  return { artifacts, totalEntries };
}

async function scanExactRemovalJournalFinal(
  layout: SecureCacheLayout,
  context: ExactRemovalFinalContext
): Promise<ExactRemovalJournalScan> {
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, layout.locks));
  const entryBudget = new CounterBudget("Exact-removal lock-directory entries", changesetRemovalRecoveryLimits.maxEntries);
  const artifacts: ExactRemovalArtifact[] = [];
  let totalEntries = 0;
  await withExactRemovalFinalResource(
    context,
    "directory",
    () => opendir(layout.locks),
    async (directory) => {
      for await (const entry of directory) {
        entryBudget.consume();
        exactRemovalStep(context);
        totalEntries += 1;
        const candidate = exactRemovalCandidatePattern.exec(entry.name);
        const intent = exactRemovalIntentPattern.test(entry.name)
          ? entry.name.slice(".remove-".length, -".json".length)
          : undefined;
        const quarantine = exactRemovalQuarantinePattern.exec(entry.name);
        const legacyQuarantine = legacyExactRemovalQuarantinePattern.test(entry.name)
          ? entry.name.slice(".removed-".length, -".data".length)
          : undefined;
        if (!candidate && !intent && !quarantine && !legacyQuarantine) continue;
        if (!entry.isFile()) throw new Error(`Exact-removal recovery artifact is not an ordinary file: ${entry.name}`);
        const path = join(layout.locks, entry.name);
        const identity = await exactRemovalOperation(context, () => capturePathIdentity(path, "file"));
        const metadata = await exactRemovalOperation(context, () => lstat(path, { bigint: true }));
        const kind = candidate ? "candidate" : intent ? "intent" : quarantine ? "quarantine" : "legacy-quarantine";
        if (metadata.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
          throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
        }
        assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
        if ((kind === "quarantine" || kind === "legacy-quarantine") &&
            metadata.nlink !== 1n && metadata.nlink !== 2n) {
          throw new Error("Exact-removal quarantine has an unexpected hard-link count");
        }
        artifacts.push({
          name: entry.name,
          path,
          identity,
          metadata,
          kind,
          removalId: candidate?.[1] ?? intent ?? quarantine?.[1] ?? legacyQuarantine!,
          ...(quarantine ? { quarantineBinding: { dev: quarantine[2]!, ino: quarantine[3]! } } : {})
        });
      }
    }
  );
  return { artifacts, totalEntries };
}

/**
 * Recover the only state that no longer has an intent but still proves its
 * target: a filename-bound quarantine inode with exactly one other managed
 * cache link. The bounded walk never follows links and all final operations use
 * native resources without mutation/test callbacks.
 */
async function settleLostIntentTwoLinkQuarantine(
  layout: SecureCacheLayout,
  quarantine: ExactRemovalArtifact,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  ledger: ExactRemovalByteLedger
): Promise<void> {
  if (!quarantine.quarantineBinding || quarantine.metadata.nlink !== 2n) {
    throw new Error("Lost exact-removal intent does not have a bound two-link quarantine claim");
  }
  if (String(quarantine.identity.dev) !== quarantine.quarantineBinding.dev ||
      String(quarantine.identity.ino) !== quarantine.quarantineBinding.ino) {
    throw new Error("Exact-removal quarantine identity does not match its durable filename binding");
  }
  const noMutationHooks: SecureExactRemovalHooks = { removalRecoveryNow: hooks.removalRecoveryNow };
  const pendingDirectories = [layout.changesets, layout.snapshots, layout.indexes];
  const matches: SecurePathIdentity[] = [];
  while (pendingDirectories.length > 0) {
    const directoryPath = pendingDirectories.pop()!;
    await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, directoryPath));
    const directoryIdentity = await exactRemovalOperation(context, () => capturePathIdentity(directoryPath, "directory"));
    await withExactRemovalResource(
      context,
      noMutationHooks,
      directoryPath,
      "directory",
      () => opendir(directoryPath),
      async (directory) => {
        for await (const entry of directory) {
          exactRemovalStep(context);
          const path = join(directoryPath, entry.name);
          if (entry.isSymbolicLink()) throw new Error("Lost-intent recovery encountered a symbolic-link cache entry");
          if (entry.isDirectory()) {
            pendingDirectories.push(path);
            continue;
          }
          if (!entry.isFile()) throw new Error("Lost-intent recovery encountered a non-regular cache entry");
          const metadata = await exactRemovalOperation(context, () => lstat(path, { bigint: true }));
          if (metadata.dev !== BigInt(quarantine.quarantineBinding!.dev) ||
              metadata.ino !== BigInt(quarantine.quarantineBinding!.ino)) continue;
          assertSecureOwnerFileMetadata(metadata, path, 2n);
          matches.push(fileIdentity(path, directoryIdentity, metadata));
          if (matches.length > 1) {
            throw new Error("Lost-intent quarantine has multiple managed target links; preserving ambiguous evidence");
          }
        }
      }
    );
  }
  if (matches.length !== 1) {
    throw new Error("Lost-intent quarantine has no unique managed target link; preserving recovery evidence");
  }
  const targetIdentity = matches[0]!;
  await withExactRemovalFinalWindow(context, async (finalContext) => {
    await validateExactCacheFile(layout, targetIdentity, 2n, finalContext);
    await validateExactCacheFile(layout, quarantine.identity, 2n, finalContext);
    const [targetMetadata, quarantineMetadata] = await Promise.all([
      exactRemovalOperation(finalContext, () => lstat(targetIdentity.path, { bigint: true })),
      exactRemovalOperation(finalContext, () => lstat(quarantine.path, { bigint: true }))
    ]);
    if (!sameStatIdentity(targetIdentity, targetMetadata) ||
        !sameStatIdentity(quarantine.identity, quarantineMetadata) ||
        !sameStatIdentity(targetIdentity, quarantineMetadata)) {
      throw new Error("Lost-intent target or quarantine identity changed before exact unlink");
    }
    assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 2n);
    assertSecureOwnerFileMetadata(quarantineMetadata, quarantine.path, 2n);
    await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
    const settled = await exactRemovalOperation(finalContext, () => lstat(quarantine.path, { bigint: true }));
    if (!sameStatIdentity(quarantine.identity, settled)) {
      throw new Error("Lost-intent quarantine identity changed after exact target unlink");
    }
    assertSecureOwnerFileMetadata(settled, quarantine.path, 1n);
    await syncExactOneLinkCacheFileFinal(
      layout,
      quarantine.identity,
      finalContext,
      changesetRemovalRecoveryLimits.maxArtifactBytes,
      ledger
    );
    await syncExactRemovalDirectoryFinal(targetIdentity.parent, finalContext);
    await syncExactRemovalDirectoryFinal(layout.locks, finalContext);
    const durable = await exactRemovalOperation(finalContext, () => lstat(quarantine.path, { bigint: true }));
    if (!sameStatIdentity(quarantine.identity, durable)) {
      throw new Error("Lost-intent quarantine identity changed during durable settlement");
    }
    assertSecureOwnerFileMetadata(durable, quarantine.path, 1n);
    await exactRemovalOperation(finalContext, () => rm(quarantine.path));
    await syncExactRemovalDirectoryFinal(layout.locks, finalContext);
    if (await exactRemovalOperation(finalContext, () => optionalLstat(quarantine.path))) {
      throw new Error("Lost-intent quarantine reappeared after exact deletion");
    }
  });
}

async function reconcileExactRemovalIntentsUnlocked(
  layout: SecureCacheLayout,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext
): Promise<ExactRemovalReconcileResult> {
  const { artifacts, totalEntries } = await scanExactRemovalJournal(layout, hooks, context);
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of artifacts) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      hooks,
      context,
      ledger
    );
  }
  const visibleState: ExactRemovalVisibleState = { entries: totalEntries, ledger };

  const candidates = artifacts.filter((artifact) => artifact.kind === "candidate")
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const intents = artifacts.filter((artifact) => artifact.kind === "intent")
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const quarantines = artifacts.filter((artifact) => artifact.kind === "quarantine" || artifact.kind === "legacy-quarantine")
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const intentById = new Map(intents.map((artifact) => [artifact.removalId, artifact]));
  const parsedIntents = new Map<string, Awaited<ReturnType<typeof readExactRemovalIntent>>>();
  let retainedEntries = 0;
  const retainedArtifacts: ExactRemovalArtifact[] = [];
  const retain = (artifact: ExactRemovalArtifact): void => {
    retainedEntries += 1;
    retainedArtifacts.push(artifact);
  };

  for (const candidate of candidates) {
    exactRemovalStep(context);
    const intent = intentById.get(candidate.removalId);
    if (candidate.metadata.nlink === 1n) {
      if (intent) throw new Error("Exact-removal candidate does not match the occupied final intent");
      const metadata = await validateExactRemovalArtifactForUse(
        layout,
        candidate.path,
        candidate.identity,
        "candidate",
        1n,
        hooks,
        context,
        ledger
      );
      if (Date.now() - Number(metadata.mtimeMs) >= changesetLifetimeMs) {
        await validateExactOneLinkCacheFile(layout, candidate.identity, context);
        await exactRemovalOperation(context, () => rm(candidate.path));
        visibleState.entries -= 1;
        visibleState.ledger.release(candidate.identity);
        await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
      } else {
        retain(candidate);
      }
      continue;
    }
    if (candidate.metadata.nlink !== 2n || !intent || intent.metadata.nlink !== 2n ||
        !sameStatIdentity(candidate.identity, intent.metadata)) {
      throw new Error("Exact-removal candidate publication identity is ambiguous");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      candidate.path,
      candidate.identity,
      "candidate",
      2n,
      hooks,
      context,
      ledger
    );
    const parsed = await readExactRemovalIntent(
      layout,
      intent.path,
      intent.identity,
      2n,
      hooks,
      context,
      ledger
    );
    if (!sameObjectIdentity(candidate.identity, parsed.intentIdentity)) {
      throw new Error("Exact-removal candidate and final intent identity changed before recovery parsing");
    }
    parsedIntents.set(intent.removalId, parsed);
    await validateExactCacheFile(layout, candidate.identity, 2n, context);
    await exactRemovalOperation(context, () => rm(candidate.path));
    visibleState.entries -= 1;
    await syncExactOneLinkCacheFile(
      layout, intent.identity, hooks, context, maximumExactRemovalIntentBytes, ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  }

  for (const intent of intents) {
    exactRemovalStep(context);
    if (!await exactRemovalOperation(context, () => optionalLstat(intent.path))) continue;
    const { intentIdentity, targetIdentity, quarantinePath, bytes } = parsedIntents.get(intent.removalId) ??
      await readExactRemovalIntent(layout, intent.path, intent.identity, 1n, hooks, context, ledger);
    const targetMetadata = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    if (targetMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata)) {
        throw new Error("Exact-removal intent target was replaced; preserving cleanup evidence");
      }
      if (targetMetadata.nlink !== 1n && targetMetadata.nlink !== 2n) {
        throw new Error("Exact-removal intent target has an ambiguous hard-link count");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, targetMetadata.nlink);
    }
    if (hooks.beforeExactRemovalRecovery) {
      await exactRemovalOperation(context, () => hooks.beforeExactRemovalRecovery!(intentIdentity.path));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentIdentity.path, intentIdentity, 1n, bytes,
      targetIdentity, quarantinePath, hooks, context, ledger
    );
    await finishExactRemoval(
      layout,
      intentIdentity.path,
      intentIdentity,
      bytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger,
      visibleState
    );
  }

  for (const quarantine of quarantines) {
    exactRemovalStep(context);
    if (!await exactRemovalOperation(context, () => optionalLstat(quarantine.path))) continue;
    const metadata = await validateExactRemovalArtifactForUse(
      layout,
      quarantine.path,
      quarantine.identity,
      quarantine.kind,
      BigInt(quarantine.metadata.nlink),
      hooks,
      context,
      ledger
    );
    if (!quarantine.quarantineBinding) {
      retain(quarantine);
      continue;
    }
    if (String(quarantine.identity.dev) !== quarantine.quarantineBinding.dev ||
        String(quarantine.identity.ino) !== quarantine.quarantineBinding.ino) {
      throw new Error("Exact-removal quarantine identity does not match its durable filename binding; preserving replacement evidence");
    }
    if (metadata.nlink === 2n) {
      await settleLostIntentTwoLinkQuarantine(layout, quarantine, hooks, context, ledger);
      visibleState.entries -= 1;
      visibleState.ledger.release(quarantine.identity);
      continue;
    }
    const quarantineIdentity = quarantine.identity;
    await syncExactOneLinkCacheFile(
      layout, quarantineIdentity, hooks, context,
      changesetRemovalRecoveryLimits.maxArtifactBytes, ledger
    );
    await validateExactOneLinkCacheFile(layout, quarantineIdentity, context);
    await exactRemovalOperation(context, () => rm(quarantine.path));
    visibleState.entries -= 1;
    visibleState.ledger.release(quarantineIdentity);
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  }
  // Run mutation hooks before the authoritative pass, then perform one hook-free
  // pass so no earlier retained size can be stale when usage is returned.
  for (const artifact of retainedArtifacts) {
    await validateExactRemovalArtifactForUse(
      layout, artifact.path, artifact.identity, artifact.kind, 1n,
      hooks, context, ledger
    );
  }
  const retainedSizes = new Map<string, number>();
  for (const artifact of retainedArtifacts) {
    const metadata = await validateExactRemovalArtifactForUse(
      layout, artifact.path, artifact.identity, artifact.kind, 1n,
      hooks, context, ledger, false
    );
    retainedSizes.set(`${artifact.identity.dev}:${artifact.identity.ino}`, Number(metadata.size));
  }
  return {
    usage: {
      retainedEntries,
      retainedBytes: [...retainedSizes.values()].reduce((total, size) => total + size, 0)
    },
    visibleState
  };
}

export async function reconcileExactRemovalIntents(
  layout: SecureCacheLayout,
  hooks: SecureExactRemovalHooks = {}
): Promise<ExactRemovalRecoveryUsage> {
  return withExactRemovalJournalLock(layout.locks, async () =>
    (await reconcileExactRemovalIntentsUnlocked(layout, hooks, createExactRemovalOperationContext(hooks))).usage);
}

async function inspectExactRemovalJournal(
  layout: SecureCacheLayout,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  invokeHooks = true
): Promise<{ totalEntries: number; physicalBytes: number; ledger: ExactRemovalByteLedger }> {
  const scan = await scanExactRemovalJournal(layout, hooks, context, invokeHooks);
  const operationHooks: SecureExactRemovalHooks = invokeHooks
    ? hooks
    : { removalRecoveryNow: hooks.removalRecoveryNow };
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of scan.artifacts.sort((left, right) => left.name.localeCompare(right.name, "en-US"))) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      operationHooks,
      context,
      ledger,
      invokeHooks
    );
  }
  return { totalEntries: scan.totalEntries, physicalBytes: ledger.total, ledger };
}

async function inspectExactRemovalJournalFinal(
  layout: SecureCacheLayout,
  context: ExactRemovalFinalContext
): Promise<{ totalEntries: number; physicalBytes: number; ledger: ExactRemovalByteLedger }> {
  const scan = await scanExactRemovalJournalFinal(layout, context);
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of scan.artifacts.sort((left, right) => left.name.localeCompare(right.name, "en-US"))) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUseFinal(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      context,
      ledger
    );
  }
  return { totalEntries: scan.totalEntries, physicalBytes: ledger.total, ledger };
}

function assertExactRemovalJournalHeadroom(
  currentEntries: number,
  additionalEntries: number,
  currentBytes: number,
  additionalBytes: number
): void {
  if (currentEntries + additionalEntries > changesetRemovalRecoveryLimits.maxEntries) {
    throw new Error(
      `Exact-removal journal cannot reserve ${additionalEntries} entry headroom within ` +
      `${changesetRemovalRecoveryLimits.maxEntries} entries`
    );
  }
  if (currentBytes + additionalBytes > changesetRemovalRecoveryLimits.maxBytes) {
    throw new Error(
      `Exact-removal journal cannot reserve byte headroom within ${changesetRemovalRecoveryLimits.maxBytes} bytes`
    );
  }
}

async function inspectExactRemovalTargetSize(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext,
  invokeHooks = true
): Promise<number> {
  const operationHooks: SecureExactRemovalHooks = invokeHooks
    ? hooks
    : { removalRecoveryNow: hooks.removalRecoveryNow };
  await validateExactRemovalParent(layout, identity, context);
  const metadata = await withExactRemovalResource(
    context,
    operationHooks,
    identity.path,
    "file",
    () => open(identity.path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) throw new Error("Exact-removal target identity changed before reservation");
      assertSecureOwnerFileMetadata(observed, identity.path, 1n);
      if (observed.size > BigInt(changesetRemovalRecoveryLimits.maxArtifactBytes)) {
        throw new Error("Exact-removal target exceeds its artifact byte limit");
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error("Exact-removal target changed during reservation validation");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  return Number(finalMetadata.size);
}

async function inspectExactRemovalTargetSizeFinal(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  context: ExactRemovalFinalContext
): Promise<number> {
  await validateExactRemovalParent(layout, identity, context);
  const metadata = await withExactRemovalFinalResource(
    context,
    "file",
    () => open(identity.path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) throw new Error("Exact-removal target identity changed before final reservation");
      assertSecureOwnerFileMetadata(observed, identity.path, 1n);
      if (observed.size > BigInt(changesetRemovalRecoveryLimits.maxArtifactBytes)) {
        throw new Error("Exact-removal target exceeds its artifact byte limit");
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error("Exact-removal target changed during final reservation validation");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  return Number(finalMetadata.size);
}

async function writeAllExactRemovalBytes(
  handle: Awaited<ReturnType<typeof open>>,
  bytes: Buffer,
  start: number,
  end: number,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext
): Promise<void> {
  let offset = start;
  while (offset < end) {
    const length = end - offset;
    const bytesWritten = await exactRemovalOperation(context, async () => hooks.writeRemovalIntentChunk
      ? hooks.writeRemovalIntentChunk(handle, bytes, offset, length, offset)
      : (await handle.write(bytes, offset, length, offset)).bytesWritten);
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 0 || bytesWritten > length) {
      throw new Error("Exact-removal intent writer returned an invalid bounded byte count");
    }
    if (bytesWritten === 0) throw new Error("Exact-removal intent writer made zero-byte progress");
    offset += bytesWritten;
  }
}

async function writeAllExactRemovalBytesFinal(
  handle: Awaited<ReturnType<typeof open>>,
  bytes: Buffer,
  context: ExactRemovalFinalContext,
  start = 0,
  end = bytes.byteLength
): Promise<void> {
  let offset = start;
  while (offset < end) {
    const length = end - offset;
    const bytesWritten = await exactRemovalOperation(
      context,
      async () => (await handle.write(bytes, offset, length, offset)).bytesWritten
    );
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 0 || bytesWritten > length) {
      throw new Error("Exact-removal final intent writer returned an invalid bounded byte count");
    }
    if (bytesWritten === 0) throw new Error("Exact-removal final intent writer made zero-byte progress");
    offset += bytesWritten;
  }
}

async function validateWrittenExactRemovalCandidate(
  handle: Awaited<ReturnType<typeof open>>,
  candidateIdentity: SecurePathIdentity,
  candidatePath: string,
  bytes: Buffer,
  context: ExactRemovalBudgetContext
): Promise<void> {
  const metadata = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
  if (!sameStatIdentity(candidateIdentity, metadata) || metadata.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate size or identity changed after bounded write");
  }
  assertSecureOwnerFileMetadata(metadata, candidatePath, 1n);
  const observed = Buffer.alloc(bytes.byteLength);
  let offset = 0;
  while (offset < observed.byteLength) {
    const bytesRead = await exactRemovalOperation(
      context,
      async () => (await handle.read(observed, offset, observed.byteLength - offset, offset)).bytesRead
    );
    if (bytesRead === 0) throw new Error("Exact-removal candidate ended before its exact written length");
    offset += bytesRead;
  }
  const eof = Buffer.alloc(1);
  const eofBytes = await exactRemovalOperation(
    context,
    async () => (await handle.read(eof, 0, 1, observed.byteLength)).bytesRead
  );
  if (eofBytes !== 0 || !observed.equals(bytes)) {
    throw new Error("Exact-removal candidate bytes or EOF do not match the complete intent");
  }
  const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
  if (!sameStatIdentity(candidateIdentity, after) || after.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate changed during complete-byte verification");
  }
  assertSecureOwnerFileMetadata(after, candidatePath, 1n);
  const finalMetadata = await exactRemovalOperation(context, () => lstat(candidatePath, { bigint: true }));
  if (!sameStatIdentity(candidateIdentity, finalMetadata) || finalMetadata.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate final path changed before publication");
  }
  assertSecureOwnerFileMetadata(finalMetadata, candidatePath, 1n);
}

/** Identity-check and durably record a captured cache object before exact removal. */
export async function safeRemoveExactCacheFile(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks = {}
): Promise<void> {
  return withExactRemovalJournalLock(layout.locks, () =>
    safeRemoveExactCacheFileUnlocked(layout, identity, hooks, createExactRemovalOperationContext(hooks)));
}

async function safeRemoveExactCacheFileUnlocked(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  hooks: SecureExactRemovalHooks,
  context: ExactRemovalOperationContext
): Promise<void> {
  if (identity.kind !== "file") throw new Error("Exact cache cleanup identity must describe a file");
  await reconcileExactRemovalIntentsUnlocked(layout, hooks, context);
  await validateExactRemovalParent(layout, identity, context);
  await validateExactOneLinkCacheFile(layout, identity, context);
  // Complete target/resource hooks before the callback-free reservation/create window.
  await inspectExactRemovalTargetSize(layout, identity, hooks, context);
  const locksIdentity = await exactRemovalOperation(context, () => capturePathIdentity(layout.locks, "directory"));
  const removalId = randomUUID();
  const intentPath = join(layout.locks, `.remove-${removalId}.json`);
  const candidatePath = join(layout.locks, `.remove-${removalId}.owner-${randomUUID()}.tmp`);
  const quarantinePath = join(layout.locks, `.removed-${removalId}-${identity.dev}-${identity.ino}.data`);
  const bytes = Buffer.from(`${JSON.stringify(exactRemovalIntent(identity, quarantinePath))}\n`, "utf8");
  if (bytes.byteLength > maximumExactRemovalIntentBytes) throw new Error("Exact-removal intent exceeds its byte limit");
  let intentIdentity: SecurePathIdentity | undefined;
  let candidateIdentity: SecurePathIdentity | undefined;
  let intentPublished = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let handlePath = candidatePath;
  let targetUnlinked = false;
  let preserveCandidateEvidence = false;
  let visibleState: ExactRemovalVisibleState | undefined;
  // Read every pre-link callback/accessor before entering the final window.
  // When none are present, candidate creation, native write/sync/validation,
  // and final hard-link publication can share one authoritative reservation.
  const publishIntentInCandidateFinalWindow =
    hooks.writeRemovalIntentChunk === undefined &&
    hooks.duringRemovalIntentCandidateWrite === undefined &&
    hooks.beforeRemovalIntentLink === undefined &&
    !hasExactRemovalInspectionHooks(hooks);
  try {
    const candidateReservation = await withExactRemovalFinalWindow(context, async (finalContext) => {
      const reservation = await inspectExactRemovalJournalFinal(layout, finalContext);
      const targetBytes = await inspectExactRemovalTargetSizeFinal(layout, identity, finalContext);
      // Candidate and final are two directory entries for one physical intent inode.
      // Reserve both names plus the later quarantine physical inode before wx+.
      assertExactRemovalJournalHeadroom(
        reservation.totalEntries,
        2,
        reservation.physicalBytes,
        bytes.byteLength + targetBytes
      );
      await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
      await validateExactOneLinkCacheFile(layout, identity, finalContext);
      const prepareCandidate = async (candidateHandle: Awaited<ReturnType<typeof open>>): Promise<void> => {
        const created = await exactRemovalOperation(finalContext, () => candidateHandle.stat({ bigint: true }));
        assertSecureOwnerFileMetadata(created, candidatePath, 1n);
        if (created.size !== 0n) throw new Error("Exact-removal candidate was not empty at exclusive creation");
        candidateIdentity = fileIdentity(candidatePath, locksIdentity, created);
        const visible = await exactRemovalOperation(finalContext, () => lstat(candidatePath, { bigint: true }));
        if (!sameStatIdentity(candidateIdentity!, visible) || visible.size !== 0n) {
          throw new Error("Exact-removal candidate identity changed at first visibility");
        }
        assertSecureOwnerFileMetadata(visible, candidatePath, 1n);
      };
      if (publishIntentInCandidateFinalWindow) {
        await withExactRemovalFinalResource(
          finalContext,
          "file",
          () => open(candidatePath, "wx+", 0o600),
          async (candidateHandle) => {
            await prepareCandidate(candidateHandle);
            await writeAllExactRemovalBytesFinal(candidateHandle, bytes, finalContext);
            await exactRemovalOperation(finalContext, () => candidateHandle.sync());
            await validateWrittenExactRemovalCandidate(
              candidateHandle, candidateIdentity!, candidatePath, bytes, finalContext
            );
            await exactRemovalOperation(finalContext, () => link(candidatePath, intentPath));
            intentPublished = true;
          }
        );
      } else {
        handle = await acquireExactRemovalFinalResource(
          finalContext,
          "file",
          () => open(candidatePath, "wx+", 0o600)
        );
        await prepareCandidate(handle);
      }
      return reservation;
    });
    if (!candidateIdentity) {
      throw new Error("Exact-removal candidate creation did not produce an authenticated file");
    }
    const preparedCandidateIdentity = candidateIdentity;
    if (publishIntentInCandidateFinalWindow) {
      visibleState = { entries: candidateReservation.totalEntries + 2, ledger: candidateReservation.ledger };
    } else {
      if (!handle) throw new Error("Exact-removal candidate handle was not retained for hookful preparation");
      const split = Math.max(1, Math.floor(bytes.byteLength / 2));
      await writeAllExactRemovalBytes(handle, bytes, 0, split, hooks, context);
      if (hooks.duringRemovalIntentCandidateWrite) {
        // The callback may consume the candidate's previously reserved byte
        // headroom by growing another journal artifact. Until a callback-free
        // rescan proves the partial candidate plus its remaining bytes fit,
        // retain the exact partial inode as bounded recovery evidence.
        preserveCandidateEvidence = true;
        await exactRemovalOperation(context, () => hooks.duringRemovalIntentCandidateWrite!(candidatePath, intentPath));
        await withExactRemovalFinalWindow(context, async (finalContext) => {
          const reservation = await inspectExactRemovalJournalFinal(layout, finalContext);
          const partial = await exactRemovalOperation(finalContext, () => handle!.stat({ bigint: true }));
          if (!sameStatIdentity(preparedCandidateIdentity, partial) || partial.size !== BigInt(split)) {
            throw new Error("Exact-removal partial candidate changed before remaining-byte reservation");
          }
          assertSecureOwnerFileMetadata(partial, candidatePath, 1n);
          await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, finalContext);
          const remainingBytes = bytes.byteLength - Number(partial.size);
          assertExactRemovalJournalHeadroom(
            reservation.totalEntries,
            0,
            reservation.physicalBytes,
            remainingBytes
          );
          await writeAllExactRemovalBytesFinal(
            handle!, bytes, finalContext, Number(partial.size), bytes.byteLength
          );
          await exactRemovalOperation(finalContext, () => handle!.sync());
          await validateWrittenExactRemovalCandidate(
            handle!, preparedCandidateIdentity, candidatePath, bytes, finalContext
          );
        });
        preserveCandidateEvidence = false;
      } else {
        await writeAllExactRemovalBytes(handle, bytes, split, bytes.byteLength, hooks, context);
        await exactRemovalOperation(context, () => handle!.sync());
        await validateWrittenExactRemovalCandidate(handle, preparedCandidateIdentity, candidatePath, bytes, context);
      }
      await closeExactRemovalResource(handle, candidatePath, "file", hooks);
      handle = undefined;
      await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, context);

      if (hooks.beforeRemovalIntentLink) {
        preserveCandidateEvidence = true;
        await exactRemovalOperation(context, () => hooks.beforeRemovalIntentLink!(candidatePath, intentPath));
      }
      await withExactRemovalResource(
        context,
        hooks,
        candidatePath,
        "file",
        () => open(candidatePath, "r"),
        async (candidateHandle) => validateWrittenExactRemovalCandidate(
          candidateHandle, preparedCandidateIdentity, candidatePath, bytes, context
        )
      );
      // Complete every hookful inspection first. The final reservation, target,
      // and candidate inspectors below are callback-free through the exclusive link.
      if (hasExactRemovalInspectionHooks(hooks)) {
        await inspectExactRemovalTargetSize(layout, identity, hooks, context);
        await inspectExactRemovalJournal(layout, hooks, context);
      }
      const beforeLink = await withExactRemovalFinalWindow(context, async (finalContext) => {
        const finalReservation = await inspectExactRemovalJournalFinal(layout, finalContext);
        const currentTargetBytes = await inspectExactRemovalTargetSizeFinal(layout, identity, finalContext);
        await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
        await withExactRemovalFinalResource(
          finalContext,
          "file",
          () => open(candidatePath, "r"),
          async (candidateHandle) => validateWrittenExactRemovalCandidate(
            candidateHandle, preparedCandidateIdentity, candidatePath, bytes, finalContext
          )
        );
        await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, finalContext);
        preserveCandidateEvidence = false;
        assertExactRemovalJournalHeadroom(
          finalReservation.totalEntries,
          1,
          finalReservation.physicalBytes,
          currentTargetBytes
        );
        await exactRemovalOperation(finalContext, () => link(candidatePath, intentPath));
        return finalReservation;
      });
      intentPublished = true;
      visibleState = { entries: beforeLink.totalEntries + 1, ledger: beforeLink.ledger };
    }
    if (hooks.afterRemovalIntentLink) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentLink!(candidatePath, intentPath));
    }
    const candidateMetadata = await exactRemovalOperation(context, () => lstat(candidatePath, { bigint: true }));
    const intentMetadata = await exactRemovalOperation(context, () => lstat(intentPath, { bigint: true }));
    if (!sameStatIdentity(preparedCandidateIdentity, candidateMetadata)
      || !sameStatIdentity(preparedCandidateIdentity, intentMetadata)) {
      throw new Error("Published exact-removal intent identity does not match its synced candidate");
    }
    assertSecureOwnerFileMetadata(candidateMetadata, candidatePath, 2n);
    assertSecureOwnerFileMetadata(intentMetadata, intentPath, 2n);
    intentIdentity = fileIdentity(intentPath, locksIdentity, intentMetadata);
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 2n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
    await validateExactCacheFile(layout, preparedCandidateIdentity, 2n, context);
    await exactRemovalOperation(context, () => rm(candidatePath));
    visibleState.entries -= 1;
    await syncExactOneLinkCacheFile(
      layout, intentIdentity, hooks, context, maximumExactRemovalIntentBytes, visibleState.ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    handlePath = intentPath;
    handle = await acquireExactRemovalResource(
      context, hooks, intentPath, "file", () => open(intentPath, "r+")
    );
    const preparedIntentMetadata = await exactRemovalOperation(context, () => handle!.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, preparedIntentMetadata)) {
      throw new Error("Exact-removal intent identity changed after candidate cleanup");
    }
    assertSecureOwnerFileMetadata(preparedIntentMetadata, intentPath, 1n);
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync!(intentPath, "prepared"));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
    await quarantineExactRemovalTarget(
      layout,
      intentPath,
      intentIdentity,
      bytes,
      identity,
      quarantinePath,
      locksIdentity,
      hooks,
      context,
      visibleState.ledger,
      visibleState,
      () => { targetUnlinked = true; }
    );
    await exactRemovalOperation(context, () => handle!.sync());
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync!(intentPath, "unlinked"));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
    if (hooks.afterExactRemovalUnlink) {
      await exactRemovalOperation(context, () => hooks.afterExactRemovalUnlink!(identity.path, intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(identity.parent, hooks));
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
    const quarantineMetadata = await exactRemovalOperation(context, () => lstat(quarantinePath, { bigint: true }));
    if (!sameStatIdentity(identity, quarantineMetadata)) throw new Error("Exact cache cleanup quarantine identity changed before unlink");
    assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 1n);
    const quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, quarantineMetadata);
    await validateExactRemovalArtifactForUse(
      layout,
      quarantinePath,
      quarantineIdentity,
      "quarantine",
      1n,
      hooks,
      context,
      visibleState.ledger
    );
    await validateExactOneLinkCacheFile(layout, quarantineIdentity, context);
    await exactRemovalOperation(context, () => rm(quarantinePath));
    visibleState.entries -= 1;
    visibleState.ledger.release(quarantineIdentity);
    await exactRemovalOperation(context, () => handle!.sync());
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout, intentPath, intentIdentity, 1n, bytes,
      identity, quarantinePath, hooks, context, visibleState.ledger
    );
  } catch (primaryError) {
    let closeError: unknown;
    try {
      if (handle) await closeExactRemovalResource(handle, handlePath, "file", hooks);
    } catch (error) { closeError = error; }
    handle = undefined;
    if (targetUnlinked || intentPublished) {
      if (closeError !== undefined) {
        throw new AggregateError([primaryError, closeError], "Exact cache cleanup failed after unlink and intent close was ambiguous", { cause: primaryError });
      }
      throw primaryError;
    }
    let cleanupError: unknown = closeError;
    if (candidateIdentity && !preserveCandidateEvidence) {
      try {
        await validateExactOneLinkCacheFile(layout, candidateIdentity, context);
        await exactRemovalOperation(context, () => rm(candidateIdentity!.path));
        await exactRemovalOperation(context, () => syncPublicationDirectory(candidateIdentity!.parent, hooks));
      } catch (error) {
        cleanupError = cleanupError === undefined ? error : new AggregateError([cleanupError, error]);
      }
    }
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [primaryError, cleanupError],
        "Exact cache cleanup failed before unlink and intent cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  } finally {
    if (handle) await closeExactRemovalResource(handle, handlePath, "file", hooks);
  }
  if (!intentIdentity) throw new Error("Exact cache cleanup did not capture its durable intent identity");
  await removeExactRemovalIntent(layout, intentIdentity, hooks, context);
}

function earlyDirectoryIdentity(
  path: string,
  parent: SecurePathIdentity,
  metadata: Awaited<ReturnType<typeof lstat>>
): SecurePathIdentity {
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  return {
    path,
    parent: parent.path,
    dev: metadata.dev,
    ino: metadata.ino,
    kind: "directory",
    parentDev: parent.dev,
    parentIno: parent.ino
  };
}

async function removeExactEmptyCreatedDirectory(identity: SecurePathIdentity): Promise<void> {
  const metadata = await optionalLstat(identity.path);
  if (!metadata) throw new Error(`Owned directory cleanup could not find the exact created identity; retained path is ambiguous: ${identity.path}`);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !sameStatIdentity(identity, metadata)) {
    throw new Error(`Owned directory cleanup retained exact path after identity changed: ${identity.path}`);
  }
  await rmdir(identity.path);
}

async function createOwnedDirectoryExact(
  layout: SecureCacheLayout,
  path: string,
  parentIdentity: SecurePathIdentity,
  hooks: SecureDirectoryCreationHooks
): Promise<SecurePathIdentity> {
  let created = false;
  let identity: SecurePathIdentity | undefined;
  let primaryError: unknown;
  try {
    await validateSecurePathIdentity(layout, parentIdentity);
    await mkdir(path, { mode: 0o700 });
    created = true;
    identity = earlyDirectoryIdentity(path, parentIdentity, await lstat(path, { bigint: true }));
    await hooks.afterMkdir?.(identity);
    const immediatelyBeforeRepair = await lstat(path, { bigint: true });
    if (!sameStatIdentity(identity, immediatelyBeforeRepair)) throw new Error(`Owned directory identity changed after creation: ${path}`);
    await enforceOwnerDirectoryMetadata(path);
    await validateSecurePathIdentity(layout, parentIdentity);
    const completed = await capturePathIdentity(path, "directory");
    if (!sameObjectIdentity(identity, completed) ||
        completed.parentDev !== parentIdentity.dev || completed.parentIno !== parentIdentity.ino ||
        !sameFilesystemPath(completed.parent, parentIdentity.path)) {
      throw new Error(`Owned directory or parent identity changed during creation: ${path}`);
    }
    return completed;
  } catch (error) {
    primaryError = error;
  }
  if (!created) throw primaryError;
  let cleanupError: unknown;
  if (!identity) {
    cleanupError = new Error(`Owned directory identity could not be recorded; exact path retained: ${path}`);
  } else {
    try {
      await removeExactEmptyCreatedDirectory(identity);
    } catch (error) {
      cleanupError = error;
    }
  }
  if (cleanupError !== undefined) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `Owned directory creation failed and cleanup was ambiguous: ${path}`,
      { cause: primaryError }
    );
  }
  throw primaryError;
}

export async function createOwnedBuildDirectory(
  layout: SecureCacheLayout,
  parent: string,
  hooks: SecureDirectoryCreationHooks = {}
): Promise<SecurePathIdentity> {
  const canonicalParent = await createSecureCacheDirectory(layout, parent);
  const parentIdentity = await capturePathIdentity(canonicalParent, "directory");
  for (;;) {
    const path = join(canonicalParent, `.build-${randomUUID()}`);
    try {
      return await createOwnedDirectoryExact(layout, path, parentIdentity, hooks);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

export async function claimOwnedSnapshotDirectory(
  layout: SecureCacheLayout,
  path: string,
  hooks: PublicationClaimCreationHooks = {}
): Promise<PublicationClaim> {
  const target = assertCacheChild(layout, path, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot claim path is not an owned index snapshot target");
  }
  const parent = await createSecureCacheDirectory(layout, dirname(target));
  const parentIdentity = await capturePathIdentity(parent, "directory");
  return createPublicationClaim(layout, target, parentIdentity, hooks);
}

export async function safeRemoveOwnedPublicationClaim(
  layout: SecureCacheLayout,
  identity: PublicationClaim,
  hooks: PublicationClaimCleanupHooks = {}
): Promise<void> {
  await safeRemovePublicationClaim(layout, identity, true, hooks);
}

export async function captureOwnedSnapshotPublicationClaim(
  layout: SecureCacheLayout,
  targetPath: string
): Promise<PublicationClaim> {
  const target = assertCacheChild(layout, targetPath, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot publication target is invalid");
  }
  const claim = await capturePublicationClaim(layout, target);
  if (!/^\.publish-[a-f0-9]{64}$/iu.test(basename(claim.path))) throw new Error("Snapshot publication claim path is invalid");
  return claim;
}

export async function observeOwnedSnapshotPublicationClaim(
  layout: SecureCacheLayout,
  targetPath: string,
  hooks: PublicationClaimCaptureHooks = {}
): Promise<PublicationClaimObservation> {
  const target = assertCacheChild(layout, targetPath, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot publication target is invalid");
  }
  return observePublicationClaim(layout, target, hooks);
}

export async function publishOwnedBuildDirectory(
  layout: SecureCacheLayout,
  build: SecurePathIdentity,
  targetPath: string,
  claim: PublicationClaim,
  hooks: SecureDirectoryPublicationHooks = {}
): Promise<SecurePathIdentity> {
  if (build.kind !== "directory" || claim.kind !== "file") throw new Error("Snapshot build and publication-claim identities have invalid types");
  const target = assertCacheChild(layout, targetPath, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot publication target is invalid");
  }
  if (!sameFilesystemPath(claim.path, publicationClaimPath(target))) throw new Error("Snapshot publication claim path is invalid");
  if (!sameFilesystemPath(build.parent, dirname(target)) || !sameFilesystemPath(claim.parent, dirname(target))) {
    throw new Error("Snapshot publication identities do not share the target parent");
  }
  if (await optionalLstat(target)) throw Object.assign(new Error("Snapshot publication target already exists"), { code: "EEXIST" });
  const parent = await capturePathIdentity(dirname(target), "directory");
  if (parent.dev !== build.parentDev || parent.ino !== build.parentIno ||
      parent.dev !== claim.parentDev || parent.ino !== claim.parentIno) {
    throw new Error("Snapshot publication parent identity changed");
  }
  await validateSecurePathIdentity(layout, build);
  await validatePublicationClaim(layout, claim);
  await validateSecurePathIdentity(layout, parent);
  if (await optionalLstat(target)) throw Object.assign(new Error("Snapshot publication target already exists"), { code: "EEXIST" });
  // Node exposes no directory-handle-relative renameat2(RENAME_NOREPLACE). The final
  // pathname lookup remains the documented irreducible syscall boundary.
  await rename(build.path, target);
  const renamedIdentity: SecurePathIdentity = { ...build, path: target, parent: dirname(target) };
  let primaryError: unknown;
  try {
    await hooks.afterRename?.(target);
    const published = await capturePathIdentity(target, "directory");
    if (!sameObjectIdentity(build, published) || published.parentDev !== parent.dev || published.parentIno !== parent.ino) {
      throw new Error("Published snapshot directory identity changed");
    }
    return published;
  } catch (error) {
    primaryError = error;
  }
  try {
    await safeRemoveOwnedSnapshotDirectory(layout, renamedIdentity, true);
  } catch (cleanupError) {
    throw new AggregateError(
      [primaryError, new Error(`Published snapshot target was retained because exact cleanup was ambiguous: ${target}`, { cause: cleanupError })],
      "Snapshot publication failed after rename and target cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}

export async function safeRemoveOwnedSnapshotDirectory(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity,
  requirePresent = false
): Promise<void> {
  if (identity.kind !== "directory") throw new Error("Owned snapshot identity must describe a directory");
  assertCacheChild(layout, identity.path, "directory");
  if (!isStrictlyInside(layout.indexes, identity.path) || !/^[a-f0-9]{64}$/iu.test(basename(identity.path))) {
    throw new Error("Owned snapshot identity has an invalid snapshot-directory path");
  }
  if (!await optionalLstat(identity.path)) {
    if (requirePresent) throw new Error(`Published snapshot target disappeared before exact cleanup: ${identity.path}`);
    return;
  }
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path, { recursive: true });
}

export async function safeRemoveOwnedBuildDirectory(
  layout: SecureCacheLayout,
  identity: SecurePathIdentity
): Promise<void> {
  if (identity.kind !== "directory") throw new Error("Owned build identity must describe a directory");
  assertCacheChild(layout, identity.path, "directory");
  if (!/^\.build-[a-f0-9-]{36}$/iu.test(basename(identity.path))) {
    throw new Error("Owned build identity has an invalid build-directory name");
  }
  const metadata = await optionalLstat(identity.path);
  if (!metadata) return;
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path, { recursive: true });
}
