import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { BigIntStats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  assertSecureOwnerFileMetadata,
  captureSecurePathIdentity,
  sameFilesystemPath,
  validateSecurePathIdentity,
  type SecureCacheLayout,
  type SecurePathIdentity
} from "./cache.js";
import { probeProcessLiveness } from "./process-liveness.js";

const defaultTimeoutMs = 30_000;
const defaultLeaseMs = 30_000;
const maximumDurationMs = 5 * 60_000;
const maximumOwnerBytes = 4 * 1024;
const fixedOwnerBytes = 512;
const pollingIntervalMs = 25;
const finalReconcileMs = 5_000;

interface ProcessLeaseOwner {
  version: 1;
  pid: number;
  nonce: string;
  createdAtMs: number;
  renewedAtMs: number;
  leaseMs: number;
  projectDigest: string;
}

interface ObservedLease {
  owner: ProcessLeaseOwner;
  identity: SecurePathIdentity;
  metadata: BigIntStats;
  unresolvedWork?: PendingDeadlineOperation;
}

export interface ProjectLease {
  pid: number;
  nonce: string;
  createdAtMs: number;
  renewedAtMs: number;
  leaseMs: number;
  projectDigest: string;
  lockIdentity: SecurePathIdentity;
  assertOwned(): Promise<void>;
}

export interface ProcessLeaseOptions {
  layout: SecureCacheLayout;
  projectRoot: string;
  now: () => number;
  timeoutMs?: number;
  leaseMs?: number;
  monotonicNow?: () => number;
  waitForRetry?: (milliseconds: number) => Promise<void>;
  afterCreateConflict?: (path: string) => Promise<void>;
  beforeAcquireRetry?: (
    path: string,
    reason: "missing-after-conflict" | "transient-observation" | "dead-reclaimed" | "live-owner"
  ) => Promise<void>;
  afterLeaseCreate?: (path: string) => Promise<void>;
  beforeCreatedPathIdentityCapture?: (path: string) => Promise<void>;
  afterAcquire?: (path: string) => Promise<void>;
  beforeObservedLeaseRead?: (path: string) => Promise<void>;
  afterObservedLeaseReadChunk?: (path: string, offset: number) => Promise<void>;
  beforeLeaseRenewal?: (path: string) => Promise<void>;
  afterLeaseRenewalOpen?: (path: string) => Promise<void>;
  afterLeaseRenewalWrite?: (path: string) => Promise<void>;
  writeLeaseRenewal?: (handle: FileHandle, bytes: Buffer, offset: number) => Promise<{ bytesWritten: number }>;
  beforeLeaseRelease?: (path: string) => Promise<void>;
  afterLeaseReleaseQuarantineRename?: (path: string, quarantine: string) => Promise<void>;
}

const processLeaseQueues = new Map<string, { tail: Promise<void>; users: number }>();

interface NormalizedProcessLeaseOptions {
  layout: SecureCacheLayout;
  projectRoot: string;
  now: () => number;
  timeoutMs: number;
  leaseMs: number;
  monotonicNow: () => number;
  waitForRetry: (milliseconds: number) => Promise<void>;
  afterCreateConflict?: ProcessLeaseOptions["afterCreateConflict"];
  beforeAcquireRetry?: ProcessLeaseOptions["beforeAcquireRetry"];
  afterLeaseCreate?: ProcessLeaseOptions["afterLeaseCreate"];
  beforeCreatedPathIdentityCapture?: ProcessLeaseOptions["beforeCreatedPathIdentityCapture"];
  afterAcquire?: ProcessLeaseOptions["afterAcquire"];
  beforeObservedLeaseRead?: ProcessLeaseOptions["beforeObservedLeaseRead"];
  afterObservedLeaseReadChunk?: ProcessLeaseOptions["afterObservedLeaseReadChunk"];
  beforeLeaseRenewal?: ProcessLeaseOptions["beforeLeaseRenewal"];
  afterLeaseRenewalOpen?: ProcessLeaseOptions["afterLeaseRenewalOpen"];
  afterLeaseRenewalWrite?: ProcessLeaseOptions["afterLeaseRenewalWrite"];
  writeLeaseRenewal?: ProcessLeaseOptions["writeLeaseRenewal"];
  beforeLeaseRelease?: ProcessLeaseOptions["beforeLeaseRelease"];
  afterLeaseReleaseQuarantineRename?: ProcessLeaseOptions["afterLeaseReleaseQuarantineRename"];
}

interface MonotonicDeadline {
  readonly expiresAt: number;
  readonly reconcileExpiresAt: number;
  readonly now: () => number;
  last: number;
}

type DeadlineBoundary = "operation" | "reconcile";

type DeadlineSettlement<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; error: unknown };

interface PendingDeadlineOperation<T = unknown> {
  readonly context: string;
  readonly boundary: DeadlineBoundary;
  readonly settlement: Promise<DeadlineSettlement<T>>;
  settled: boolean;
}

class ProjectLeaseDeadlineError extends Error {
  pendingOperation?: PendingDeadlineOperation;
}
class ProjectLeaseClockError extends Error {}
class InvalidProcessLeaseOwnerError extends Error {}
class TransientProcessLeaseObservationError extends Error {}
class AmbiguousProcessLeaseCleanupError extends Error {}

function duration(value: number | undefined, fallback: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0 || selected > maximumDurationMs) {
    throw new Error(`${label} must be a positive bounded integer`);
  }
  return selected;
}

function wallTime(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Project lease timestamp is invalid");
  return value;
}

function monotonicTime(now: () => number, previous?: number): number {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new ProjectLeaseClockError("Project lease monotonic clock is invalid");
  if (previous !== undefined && value < previous) throw new ProjectLeaseClockError("Project lease monotonic clock moved backwards");
  return value;
}

function createDeadline(now: () => number, timeoutMs: number, reconcileMs = finalReconcileMs): MonotonicDeadline {
  const start = monotonicTime(now);
  const expiresAt = start + timeoutMs;
  const reconcileExpiresAt = expiresAt + reconcileMs;
  if (!Number.isFinite(expiresAt) || !Number.isFinite(reconcileExpiresAt)) {
    throw new ProjectLeaseClockError("Project lease monotonic deadline is invalid");
  }
  return { expiresAt, reconcileExpiresAt, now, last: start };
}

function deadlineRemaining(
  deadline: MonotonicDeadline,
  context: string,
  boundary: DeadlineBoundary = "operation"
): number {
  const current = monotonicTime(deadline.now, deadline.last);
  deadline.last = current;
  const remaining = (boundary === "operation" ? deadline.expiresAt : deadline.reconcileExpiresAt) - current;
  if (remaining <= 0) throw new ProjectLeaseDeadlineError(`Project lease timeout ${context}`);
  return remaining;
}

function deadlineFailure(error: unknown, seen = new Set<unknown>()): boolean {
  if (error === null || error === undefined || seen.has(error)) return false;
  seen.add(error);
  if (error instanceof ProjectLeaseDeadlineError || error instanceof ProjectLeaseClockError) return true;
  if (error instanceof AggregateError && error.errors.some((nested) => deadlineFailure(nested, seen))) return true;
  return error instanceof Error && error.cause !== undefined && deadlineFailure(error.cause, seen);
}

function pendingDeadlineOperation(error: unknown, seen = new Set<unknown>()): PendingDeadlineOperation | undefined {
  if (error === null || error === undefined || seen.has(error)) return undefined;
  seen.add(error);
  if (error instanceof ProjectLeaseDeadlineError && error.pendingOperation) return error.pendingOperation;
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      const pending = pendingDeadlineOperation(nested, seen);
      if (pending) return pending;
    }
  }
  if (error instanceof Error && error.cause !== undefined) return pendingDeadlineOperation(error.cause, seen);
  return undefined;
}

function unresolvedLeaseWork(observed: ObservedLease): PendingDeadlineOperation | undefined {
  return observed.unresolvedWork;
}

function deferHandleCloseAfterSettlement(
  handle: Awaited<ReturnType<typeof open>>,
  pending: PendingDeadlineOperation
): void {
  void pending.settlement
    .then(() => {
      let closing: Promise<void>;
      try {
        closing = handle.close();
      } catch {
        return;
      }
      // The public deadline has already won, so this is an unjoined, exactly-once
      // resource close after the prerequisite settles. Observe rejection, but do
      // not start a timer, retry, pathname cleanup, or lease progression.
      void closing.catch(() => undefined);
    })
    .catch(() => undefined);
}

function deferLateOpenedHandleClose(
  pending: PendingDeadlineOperation<Awaited<ReturnType<typeof open>>>
): void {
  void pending.settlement
    .then((outcome) => {
      if (outcome.status !== "fulfilled") return;
      let closing: Promise<void>;
      try {
        closing = outcome.value.close();
      } catch {
        return;
      }
      // A late exclusive open can have published an inode. Close only its returned
      // handle and retain pathname evidence; never guess at an unlink or retry.
      void closing.catch(() => undefined);
    })
    .catch(() => undefined);
}

async function withinDeadline<T>(
  deadline: MonotonicDeadline,
  context: string,
  operation: () => Promise<T>,
  options: { boundary?: DeadlineBoundary } = {}
): Promise<T> {
  const boundary = options.boundary ?? "operation";
  const remaining = deadlineRemaining(deadline, `before ${context}`, boundary);
  let timer: NodeJS.Timeout | undefined;
  try {
    let tracked!: PendingDeadlineOperation<T>;
    const pending = Promise.resolve().then(operation);
    const settlement = pending.then<DeadlineSettlement<T>, DeadlineSettlement<T>>(
      (value) => {
        tracked.settled = true;
        return { status: "fulfilled", value };
      },
      (error: unknown) => {
        tracked.settled = true;
        return { status: "rejected", error };
      }
    );
    tracked = { context, boundary, settlement, settled: false };
    const timedOut = Symbol("project-lease-timeout");
    const selected = await Promise.race([
      settlement,
      new Promise<typeof timedOut>((accept) => {
        timer = setTimeout(() => accept(timedOut), remaining);
        timer.unref?.();
      })
    ]);
    if (selected === timedOut) {
      const error = new ProjectLeaseDeadlineError(`Project lease timeout during ${context}`);
      error.pendingOperation = tracked;
      throw error;
    }
    if (selected.status === "rejected") throw selected.error;
    deadlineRemaining(deadline, `after ${context}`, boundary);
    return selected.value;
  } catch (error) {
    if (deadlineFailure(error)) throw error;
    deadlineRemaining(deadline, `after failed ${context}`, boundary);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function mandatoryClose(
  handle: Awaited<ReturnType<typeof open>>,
  deadline: MonotonicDeadline,
  context: string,
  blockedBy?: PendingDeadlineOperation
): Promise<void> {
  if (blockedBy && !blockedBy.settled) {
    deferHandleCloseAfterSettlement(handle, blockedBy);
    throw new AmbiguousProcessLeaseCleanupError(
      `Project lease ${context} was deferred behind unresolved ${blockedBy.context}; preserving owned evidence`
    );
  }
  await withinDeadline(deadline, context, () => handle.close(), { boundary: "reconcile" });
}

function canonicalDigest(path: string): string {
  const normalized = process.platform === "win32" ? path.toLocaleLowerCase("en-US") : path;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function lockPath(layout: SecureCacheLayout, projectDigest: string): string {
  return join(layout.locks, `task8-${projectDigest}.lock`);
}

function sameIdentity(left: SecurePathIdentity, right: SecurePathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind &&
    left.parentDev === right.parentDev && left.parentIno === right.parentIno &&
    sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.parent, right.parent);
}

function sameIdentityAcrossRename(left: SecurePathIdentity, right: SecurePathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind &&
    left.parentDev === right.parentDev && left.parentIno === right.parentIno &&
    sameFilesystemPath(left.parent, right.parent);
}

function sameLeaseFileVersion(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid &&
    left.mode === right.mode && left.nlink === right.nlink && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs &&
    left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}

function sameOwner(left: ProcessLeaseOwner, right: ProcessLeaseOwner): boolean {
  return left.version === right.version && left.pid === right.pid && left.nonce === right.nonce &&
    left.createdAtMs === right.createdAtMs && left.renewedAtMs === right.renewedAtMs &&
    left.leaseMs === right.leaseMs && left.projectDigest === right.projectDigest;
}

function ownerBytes(owner: ProcessLeaseOwner): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(owner)}\n`, "utf8");
  if (bytes.byteLength > fixedOwnerBytes) throw new Error("Project lease owner metadata exceeds its bound");
  return Buffer.from(bytes.toString("utf8").padEnd(fixedOwnerBytes, " "), "utf8");
}

function invalidOwner(): never {
  throw new InvalidProcessLeaseOwnerError("Project lease owner metadata is invalid or ambiguous");
}

function parseOwner(value: unknown, expectedProjectDigest: string): ProcessLeaseOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidOwner();
  const record = value as Record<string, unknown>;
  const expectedKeys = ["createdAtMs", "leaseMs", "nonce", "pid", "projectDigest", "renewedAtMs", "version"];
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en-US"));
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) invalidOwner();
  if (
    record.version !== 1 ||
    !Number.isSafeInteger(record.pid) || Number(record.pid) <= 0 || Number(record.pid) > 2_147_483_647 ||
    typeof record.nonce !== "string" || !/^[a-f0-9]{32}$/u.test(record.nonce) ||
    !Number.isSafeInteger(record.createdAtMs) || Number(record.createdAtMs) < 0 ||
    !Number.isSafeInteger(record.renewedAtMs) || Number(record.renewedAtMs) < Number(record.createdAtMs) ||
    !Number.isSafeInteger(record.leaseMs) || Number(record.leaseMs) <= 0 || Number(record.leaseMs) > maximumDurationMs ||
    typeof record.projectDigest !== "string" || !/^[a-f0-9]{64}$/u.test(record.projectDigest) ||
    record.projectDigest !== expectedProjectDigest
  ) invalidOwner();
  return {
    version: 1,
    pid: Number(record.pid),
    nonce: record.nonce,
    createdAtMs: Number(record.createdAtMs),
    renewedAtMs: Number(record.renewedAtMs),
    leaseMs: Number(record.leaseMs),
    projectDigest: record.projectDigest
  };
}

async function optionalObservedLease(
  layout: SecureCacheLayout,
  path: string,
  projectDigest: string,
  deadline: MonotonicDeadline,
  boundary: DeadlineBoundary = "operation",
  hooks: Pick<NormalizedProcessLeaseOptions, "beforeObservedLeaseRead" | "afterObservedLeaseReadChunk"> = {}
): Promise<ObservedLease | undefined> {
  let metadata;
  try {
    metadata = await withinDeadline(deadline, "lease-path metadata read", () => lstat(path, { bigint: true }), { boundary });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    assertSecureOwnerFileMetadata(metadata, path, 1n);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown owner metadata failure";
    throw new InvalidProcessLeaseOwnerError(`Project lease owner file security metadata is invalid: ${detail}`, { cause: error });
  }
  if (metadata.size <= 0n) {
    throw new TransientProcessLeaseObservationError("Project lease owner publication is not complete");
  }
  if (metadata.size > BigInt(maximumOwnerBytes)) invalidOwner();
  const identity = await withinDeadline(
    deadline,
    "lease-path identity capture",
    () => captureSecurePathIdentity(layout, path, "file"),
    { boundary }
  );
  if (hooks.beforeObservedLeaseRead) {
    await withinDeadline(
      deadline,
      "observed-lease read hook",
      () => hooks.beforeObservedLeaseRead!(path),
      { boundary }
    );
  }
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let bytes: Buffer | undefined;
  let primaryError: unknown;
  try {
    try {
      handle = await withinDeadline(deadline, "lease owner handle open", () => open(path, "r"), { boundary });
    } catch (error) {
      const pending = pendingDeadlineOperation(error) as
        PendingDeadlineOperation<Awaited<ReturnType<typeof open>>> | undefined;
      if (pending) deferLateOpenedHandleClose(pending);
      throw error;
    }
    const before = await withinDeadline(
      deadline,
      "lease owner initial handle metadata",
      () => handle!.stat({ bigint: true }),
      { boundary }
    );
    if (!sameLeaseFileVersion(metadata, before) || before.dev !== identity.dev || before.ino !== identity.ino) {
      throw new TransientProcessLeaseObservationError("Project lease identity changed during bounded read");
    }
    try {
      assertSecureOwnerFileMetadata(before, path, 1n);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown owner metadata failure";
      throw new InvalidProcessLeaseOwnerError(`Project lease owner handle security metadata is invalid: ${detail}`, { cause: error });
    }
    const buffer = Buffer.alloc(maximumOwnerBytes + 1);
    let offset = 0;
    for (;;) {
      deadlineRemaining(deadline, "before a lease-owner read iteration", boundary);
      const read = await withinDeadline(
        deadline,
        "lease owner bounded read chunk",
        () => handle!.read(buffer, offset, buffer.byteLength - offset, offset),
        { boundary }
      );
      offset += read.bytesRead;
      if (hooks.afterObservedLeaseReadChunk) {
        await withinDeadline(
          deadline,
          "lease owner read-chunk hook",
          () => hooks.afterObservedLeaseReadChunk!(path, offset),
          { boundary }
        );
      }
      if (read.bytesRead === 0) break;
      if (offset === buffer.byteLength) invalidOwner();
    }
    bytes = buffer.subarray(0, offset);
    const after = await withinDeadline(
      deadline,
      "lease owner final handle metadata",
      () => handle!.stat({ bigint: true }),
      { boundary }
    );
    if (!sameLeaseFileVersion(before, after) || after.dev !== identity.dev ||
        after.ino !== identity.ino || after.size !== BigInt(offset)) {
      throw new TransientProcessLeaseObservationError("Project lease identity changed during bounded read");
    }
  } catch (error) {
    primaryError = error;
  }
  let closeError: unknown;
  if (handle) {
    try {
      await mandatoryClose(handle, deadline, "owner-read handle close", pendingDeadlineOperation(primaryError));
    } catch (error) {
      closeError = error;
    }
  }
  if (primaryError !== undefined && closeError !== undefined) {
    throw new AggregateError(
      [primaryError, closeError],
      "Project lease owner read and handle cleanup both failed",
      { cause: primaryError }
    );
  }
  if (primaryError !== undefined) throw primaryError;
  if (closeError !== undefined) throw closeError;
  const [finalMetadata, finalParentMetadata, finalCanonical] = await withinDeadline(
    deadline,
    "lease owner final path and parent validation",
    () => Promise.all([
      lstat(path, { bigint: true }),
      lstat(identity.parent, { bigint: true }),
      realpath(path)
    ]),
    { boundary }
  );
  if (!sameLeaseFileVersion(metadata, finalMetadata) ||
      finalParentMetadata.dev !== identity.parentDev || finalParentMetadata.ino !== identity.parentIno ||
      finalParentMetadata.isSymbolicLink() || !finalParentMetadata.isDirectory() ||
      !sameFilesystemPath(finalCanonical, identity.path)) {
    throw new TransientProcessLeaseObservationError("Project lease version changed after bounded read");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes!.toString("utf8"));
  } catch {
    invalidOwner();
  }
  deadlineRemaining(deadline, "after lease owner parse", boundary);
  return { owner: parseOwner(parsed, projectDigest), identity, metadata: finalMetadata };
}

async function createLease(
  layout: SecureCacheLayout,
  path: string,
  owner: ProcessLeaseOwner,
  deadline: MonotonicDeadline,
  hooks: Pick<NormalizedProcessLeaseOptions, "beforeCreatedPathIdentityCapture">
): Promise<ObservedLease | undefined> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let parentIdentity: SecurePathIdentity | undefined;
  let primaryError: unknown;
  let publicationCompleted = false;
  let publishedMetadata: BigIntStats | undefined;
  try {
    handle = await withinDeadline(deadline, "exclusive lease create", () => open(path, "wx", 0o600));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return undefined;
    const pending = pendingDeadlineOperation(error) as
      PendingDeadlineOperation<Awaited<ReturnType<typeof open>>> | undefined;
    if (pending) deferLateOpenedHandleClose(pending);
    throw error;
  }
  try {
    parentIdentity = await withinDeadline(
      deadline,
      "lease parent identity capture",
      () => captureSecurePathIdentity(layout, layout.locks, "directory"),
      { boundary: primaryError === undefined ? "operation" : "reconcile" }
    );
  } catch (error) {
    primaryError = primaryError === undefined
      ? error
      : new AggregateError([primaryError, error], "Project lease parent identity capture failed", { cause: primaryError });
  }
  let created: Awaited<ReturnType<NonNullable<typeof handle>["stat"]>> | undefined;
  try {
    if (!pendingDeadlineOperation(primaryError)) {
      created = await withinDeadline(
        deadline,
        "created lease handle metadata",
        () => handle!.stat({ bigint: true }),
        { boundary: primaryError === undefined ? "operation" : "reconcile" }
      );
      assertSecureOwnerFileMetadata(created, path, 1n);
    }
    if (primaryError === undefined) {
      if (!created) throw new Error("Project lease handle identity was unavailable before owner publication");
      await withinDeadline(deadline, "lease owner write", () => handle!.writeFile(ownerBytes(owner)));
      await withinDeadline(deadline, "lease owner file sync", () => handle!.sync());
      publishedMetadata = await withinDeadline(
        deadline,
        "published lease handle metadata",
        () => handle!.stat({ bigint: true })
      );
      assertSecureOwnerFileMetadata(publishedMetadata, path, 1n);
      if (publishedMetadata.dev !== created.dev || publishedMetadata.ino !== created.ino) {
        throw new Error("Project lease handle identity changed during owner publication");
      }
      publicationCompleted = true;
    }
  } catch (error) {
    primaryError = primaryError === undefined
      ? error
      : new AggregateError([primaryError, error], "Project lease creation steps failed", { cause: primaryError });
  }
  try {
    await mandatoryClose(handle!, deadline, "creation handle close", pendingDeadlineOperation(primaryError));
  } catch (error) {
    primaryError = primaryError === undefined
      ? error
      : new AggregateError([primaryError, error], "Project lease creation and handle cleanup both failed", { cause: primaryError });
  }
  if (pendingDeadlineOperation(primaryError)) {
    const ambiguity = new AmbiguousProcessLeaseCleanupError(
      "Project lease creation has unresolved lease-owned I/O; preserving the exclusively created inode"
    );
    throw new AggregateError(
      [primaryError, ambiguity],
      "Project lease creation timed out and owned-file cleanup remains ambiguous",
      { cause: primaryError }
    );
  }
  if (primaryError === undefined && hooks.beforeCreatedPathIdentityCapture) {
    try {
      await withinDeadline(
        deadline,
        "pre-created-path identity hook",
        () => hooks.beforeCreatedPathIdentityCapture!(path)
      );
    } catch (error) {
      primaryError = error;
    }
  }
  if (pendingDeadlineOperation(primaryError)) {
    const ambiguity = new AmbiguousProcessLeaseCleanupError(
      "Project lease created-path hook remains unresolved; preserving the exact published owner evidence"
    );
    throw new AggregateError(
      [primaryError, ambiguity],
      "Project lease creation timed out and created-path reconciliation remains ambiguous",
      { cause: primaryError }
    );
  }
  if (!created) {
    const captureError = new Error("Project lease identity was not captured from the owned handle");
    primaryError = primaryError === undefined
      ? captureError
      : new AggregateError([primaryError, captureError], "Project lease handle identity capture failed", { cause: primaryError });
  }
  let identity: SecurePathIdentity;
  try {
    identity = await withinDeadline(
      deadline,
      "created lease path identity capture",
      () => captureSecurePathIdentity(layout, path, "file"),
      { boundary: "reconcile" }
    );
  } catch (error) {
    throw primaryError === undefined
      ? error
      : new AggregateError(
          [primaryError, error],
          "Project lease creation failed and created identity capture was ambiguous",
          { cause: primaryError }
        );
  }
  const pathIsExactCreatedInode = created !== undefined && created.dev === identity.dev && created.ino === identity.ino;
  const parentIsExact = parentIdentity !== undefined && identity.parentDev === parentIdentity.dev &&
    identity.parentIno === parentIdentity.ino && sameFilesystemPath(identity.parent, parentIdentity.path);
  if (!parentIsExact || !pathIsExactCreatedInode) {
    const identityError = new Error("Project lease identity changed during exclusive creation");
    primaryError = primaryError === undefined
      ? identityError
      : new AggregateError([primaryError, identityError], "Project lease creation identity was ambiguous", { cause: primaryError });
  }
  let verifiedLease: ObservedLease | undefined;
  if (publicationCompleted && publishedMetadata && pathIsExactCreatedInode && parentIsExact) {
    try {
      const observed = await optionalObservedLease(
        layout,
        path,
        owner.projectDigest,
        deadline,
        "reconcile"
      );
      if (!observed || !sameIdentity(observed.identity, identity) || !sameOwner(observed.owner, owner) ||
          !sameLeaseFileVersion(observed.metadata, publishedMetadata)) {
        throw new Error("Project lease persisted owner or version changed during exclusive creation");
      }
      verifiedLease = observed;
    } catch (error) {
      primaryError = primaryError === undefined
        ? error
        : new AggregateError([primaryError, error], "Project lease persisted owner verification was ambiguous", { cause: primaryError });
    }
  }
  if (primaryError === undefined) {
    try {
      deadlineRemaining(deadline, "after exclusive lease creation");
    } catch (error) {
      primaryError = error;
    }
  }
  if (primaryError !== undefined) {
    // If the pathname no longer names the inode returned by our exclusive handle,
    // it belongs to an ambiguous replacement and must be retained as evidence.
    if (!pathIsExactCreatedInode || !parentIsExact || (publicationCompleted && !verifiedLease)) throw primaryError;
    try {
      if (publicationCompleted) {
        const current = await optionalObservedLease(
          layout,
          path,
          owner.projectDigest,
          deadline,
          "reconcile"
        );
        if (!current || !verifiedLease || !sameIdentity(current.identity, verifiedLease.identity) ||
            !sameOwner(current.owner, owner) || !sameLeaseFileVersion(current.metadata, verifiedLease.metadata)) {
          throw new Error("Project lease persisted owner changed before failed-create cleanup");
        }
        identity = current.identity;
      }
      await withinDeadline(
        deadline,
        "failed-create exact identity validation",
        () => validateSecurePathIdentity(layout, identity),
        { boundary: "reconcile" }
      );
      const cleanupMetadata = await withinDeadline(
        deadline,
        "failed-create exact metadata validation",
        () => lstat(identity.path, { bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(cleanupMetadata, identity.path, 1n);
      if (cleanupMetadata.dev !== identity.dev || cleanupMetadata.ino !== identity.ino) {
        throw new Error("Project lease created identity changed before failed-create cleanup");
      }
      await withinDeadline(
        deadline,
        "failed-create exact unlink",
        () => unlink(identity.path),
        { boundary: "reconcile" }
      );
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        "Project lease creation failed and owned-file cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  if (!verifiedLease) throw new Error("Project lease persisted owner was not verified after exclusive creation");
  return verifiedLease;
}

async function removeObservedLease(
  layout: SecureCacheLayout,
  path: string,
  expected: ObservedLease,
  deadline: MonotonicDeadline,
  boundary: DeadlineBoundary = "operation",
  hooks: Pick<NormalizedProcessLeaseOptions, "beforeLeaseRelease" | "afterLeaseReleaseQuarantineRename" | "beforeObservedLeaseRead" | "afterObservedLeaseReadChunk"> = {}
): Promise<void> {
  if (hooks.beforeLeaseRelease) {
    await withinDeadline(
      deadline,
      "lease release hook",
      () => hooks.beforeLeaseRelease!(path),
      { boundary }
    );
  }
  const current = await optionalObservedLease(layout, path, expected.owner.projectDigest, deadline, boundary, hooks);
  if (!current || !sameIdentity(current.identity, expected.identity) || !sameOwner(current.owner, expected.owner) ||
      !sameLeaseFileVersion(current.metadata, expected.metadata)) {
    throw new Error("Project lease ownership or identity changed before release");
  }
  const quarantine = join(layout.locks, `.task8-release-${randomUUID()}.lock`);
  try {
    await withinDeadline(deadline, "release quarantine absence check", () => lstat(quarantine), { boundary });
    throw new Error("Project lease release quarantine was unexpectedly occupied");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await withinDeadline(
    deadline,
    "pre-release lease identity validation",
    () => validateSecurePathIdentity(layout, expected.identity),
    { boundary }
  );
  let renamed = false;
  let unlinked = false;
  let primaryError: unknown;
  const exactQuarantineCleanup = async (cleanupBoundary: DeadlineBoundary): Promise<void> => {
    const quarantined = await optionalObservedLease(
      layout,
      quarantine,
      expected.owner.projectDigest,
      deadline,
      cleanupBoundary,
      hooks
    );
    if (!quarantined || !sameIdentityAcrossRename(expected.identity, quarantined.identity) ||
        !sameOwner(expected.owner, quarantined.owner)) {
      throw new Error("Project lease identity or ownership changed across release quarantine rename");
    }
    await withinDeadline(
      deadline,
      "released lease identity validation",
      () => validateSecurePathIdentity(layout, quarantined.identity),
      { boundary: cleanupBoundary }
    );
    const cleanupMetadata = await withinDeadline(
      deadline,
      "released lease exact metadata validation",
      () => lstat(quarantine, { bigint: true }),
      { boundary: cleanupBoundary }
    );
    assertSecureOwnerFileMetadata(cleanupMetadata, quarantine, 1n);
    if (!sameLeaseFileVersion(cleanupMetadata, quarantined.metadata)) {
      throw new Error("Project lease quarantine identity changed before exact unlink");
    }
    await withinDeadline(deadline, "released lease quarantine unlink", async () => {
      await unlink(quarantine);
      unlinked = true;
    }, { boundary: cleanupBoundary });
  };
  try {
    await withinDeadline(deadline, "lease release quarantine rename", async () => {
      await rename(path, quarantine);
      renamed = true;
    }, { boundary });
    if (hooks.afterLeaseReleaseQuarantineRename) {
      await withinDeadline(
        deadline,
        "post-release quarantine rename hook",
        () => hooks.afterLeaseReleaseQuarantineRename!(path, quarantine),
        { boundary }
      );
    }
    await exactQuarantineCleanup(boundary);
    return;
  } catch (error) {
    primaryError = error;
  }
  if (pendingDeadlineOperation(primaryError)) {
    throw new AggregateError(
      [
        primaryError,
        new AmbiguousProcessLeaseCleanupError(
          "Project lease release has unresolved lease-owned I/O; preserving lock or quarantine evidence"
        )
      ],
      "Project lease release timed out and exact reconciliation remains ambiguous",
      { cause: primaryError }
    );
  }
  if (!renamed || unlinked) throw primaryError;
  try {
    await exactQuarantineCleanup("reconcile");
  } catch (reconcileError) {
    throw new AggregateError(
      [primaryError, reconcileError],
      "Project lease release failed after quarantine rename and exact reconciliation was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}

async function writeExactRenewalOwner(
  handle: FileHandle,
  bytes: Buffer,
  deadline: MonotonicDeadline,
  boundary: DeadlineBoundary,
  writeChunk?: NonNullable<ProcessLeaseOptions["writeLeaseRenewal"]>,
  onWriteAttempt?: () => void
): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    deadlineRemaining(deadline, "before a lease-renewal write iteration", boundary);
    const written = await withinDeadline(
      deadline,
      "lease renewal write chunk",
      () => {
        onWriteAttempt?.();
        return writeChunk
          ? writeChunk(handle, bytes, offset)
          : handle.write(bytes, offset, bytes.byteLength - offset, offset);
      },
      { boundary }
    );
    if (!Number.isSafeInteger(written.bytesWritten) || written.bytesWritten <= 0 ||
        written.bytesWritten > bytes.byteLength - offset) {
      throw new Error("Project lease renewal write was incomplete");
    }
    offset += written.bytesWritten;
  }
}

async function renewLease(
  layout: SecureCacheLayout,
  path: string,
  observed: ObservedLease,
  now: () => number,
  deadline: MonotonicDeadline,
  hooks: Pick<NormalizedProcessLeaseOptions, "beforeLeaseRenewal" | "afterLeaseRenewalOpen" | "afterLeaseRenewalWrite" | "writeLeaseRenewal" | "beforeObservedLeaseRead" | "afterObservedLeaseReadChunk"> = {}
): Promise<void> {
  if (hooks.beforeLeaseRenewal) {
    await withinDeadline(
      deadline,
      "lease renewal hook",
      () => hooks.beforeLeaseRenewal!(path)
    );
  }
  const current = await optionalObservedLease(layout, path, observed.owner.projectDigest, deadline, "operation", hooks);
  if (!current || !sameIdentity(current.identity, observed.identity) || !sameOwner(current.owner, observed.owner) ||
      !sameLeaseFileVersion(current.metadata, observed.metadata)) {
    throw new Error("Project lease ownership or identity changed before renewal");
  }
  deadlineRemaining(deadline, "before renewal wall-clock sample");
  const renewedAtMs = wallTime(now);
  deadlineRemaining(deadline, "after renewal wall-clock sample");
  if (renewedAtMs < observed.owner.renewedAtMs) throw new Error("Project lease clock moved backwards during renewal");
  const renewed: ProcessLeaseOwner = { ...observed.owner, renewedAtMs };
  const bytes = ownerBytes(renewed);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let primaryError: unknown;
  let writeMayHaveChangedOwner = false;
  let renewedHandleMetadata: BigIntStats | undefined;
  try {
    try {
      handle = await withinDeadline(deadline, "renewal handle open", () => open(path, "r+"));
    } catch (error) {
      const pending = pendingDeadlineOperation(error) as
        PendingDeadlineOperation<Awaited<ReturnType<typeof open>>> | undefined;
      if (pending) deferLateOpenedHandleClose(pending);
      throw error;
    }
    if (hooks.afterLeaseRenewalOpen) {
      await withinDeadline(
        deadline,
        "post-renewal handle-open hook",
        () => hooks.afterLeaseRenewalOpen!(path)
      );
    }
    const before = await withinDeadline(
      deadline,
      "pre-renewal handle metadata",
      () => handle!.stat({ bigint: true })
    );
    try {
      assertSecureOwnerFileMetadata(before, path, 1n);
    } catch (error) {
      throw new InvalidProcessLeaseOwnerError("Project lease owner security metadata changed before renewal write", { cause: error });
    }
    if (!sameLeaseFileVersion(current.metadata, before) ||
        before.dev !== observed.identity.dev || before.ino !== observed.identity.ino) {
      throw new Error("Project lease owner version or identity changed before renewal write");
    }
    await writeExactRenewalOwner(
      handle!,
      bytes,
      deadline,
      "operation",
      hooks.writeLeaseRenewal,
      () => { writeMayHaveChangedOwner = true; }
    );
    if (hooks.afterLeaseRenewalWrite) {
      await withinDeadline(
        deadline,
        "post-renewal write hook",
        () => hooks.afterLeaseRenewalWrite!(path)
      );
    }
    await withinDeadline(deadline, "lease renewal truncate", () => handle!.truncate(bytes.byteLength));
    await withinDeadline(deadline, "lease renewal file sync", () => handle!.sync());
    renewedHandleMetadata = await withinDeadline(
      deadline,
      "post-renewal handle metadata",
      () => handle!.stat({ bigint: true })
    );
    assertSecureOwnerFileMetadata(renewedHandleMetadata, path, 1n);
    if (renewedHandleMetadata.dev !== observed.identity.dev || renewedHandleMetadata.ino !== observed.identity.ino ||
        renewedHandleMetadata.size !== BigInt(bytes.byteLength)) {
      throw new Error("Project lease identity changed during renewal");
    }
  } catch (error) {
    primaryError = error;
  }
  if (primaryError !== undefined && !pendingDeadlineOperation(primaryError) && writeMayHaveChangedOwner && handle) {
    try {
      const repairBefore = await withinDeadline(
        deadline,
        "ambiguous renewal repair handle metadata",
        () => handle!.stat({ bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(repairBefore, path, 1n);
      if (repairBefore.dev !== observed.identity.dev || repairBefore.ino !== observed.identity.ino) {
        throw new Error("Project lease handle identity changed before ambiguous renewal repair");
      }
      const repairPathIdentity = await withinDeadline(
        deadline,
        "ambiguous renewal repair path identity",
        () => captureSecurePathIdentity(layout, path, "file"),
        { boundary: "reconcile" }
      );
      if (!sameIdentity(repairPathIdentity, observed.identity)) {
        throw new Error("Project lease path identity changed before ambiguous renewal repair");
      }
      await withinDeadline(
        deadline,
        "ambiguous renewal repair path validation",
        () => validateSecurePathIdentity(layout, repairPathIdentity),
        { boundary: "reconcile" }
      );
      await writeExactRenewalOwner(handle, bytes, deadline, "reconcile");
      await withinDeadline(
        deadline,
        "ambiguous renewal repair truncate",
        () => handle!.truncate(bytes.byteLength),
        { boundary: "reconcile" }
      );
      await withinDeadline(
        deadline,
        "ambiguous renewal repair sync",
        () => handle!.sync(),
        { boundary: "reconcile" }
      );
      renewedHandleMetadata = await withinDeadline(
        deadline,
        "ambiguous renewal repaired handle metadata",
        () => handle!.stat({ bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(renewedHandleMetadata, path, 1n);
      if (renewedHandleMetadata.dev !== observed.identity.dev || renewedHandleMetadata.ino !== observed.identity.ino ||
          renewedHandleMetadata.size !== BigInt(bytes.byteLength)) {
        throw new Error("Project lease identity changed during ambiguous renewal repair");
      }
    } catch (repairError) {
      primaryError = new AggregateError(
        [primaryError, repairError],
        "Project lease renewal failed and exact owner repair was ambiguous",
        { cause: primaryError }
      );
    }
  }
  let closeError: unknown;
  if (handle) {
    try {
      await mandatoryClose(handle, deadline, "renewal handle close", pendingDeadlineOperation(primaryError));
    } catch (error) {
      closeError = error;
    }
  }
  let unresolvedWork = pendingDeadlineOperation(primaryError) ?? pendingDeadlineOperation(closeError);
  if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
  const errors: unknown[] = [];
  if (primaryError !== undefined) errors.push(primaryError);
  if (closeError !== undefined) errors.push(closeError);
  let verifiedRenewed: ObservedLease | undefined;
  if (errors.length === 0) {
    try {
      const persisted = await optionalObservedLease(
        layout,
        path,
        observed.owner.projectDigest,
        deadline,
        "operation",
        hooks
      );
      if (!persisted || !sameIdentity(persisted.identity, observed.identity) ||
          !sameOwner(persisted.owner, renewed) ||
          (renewedHandleMetadata && !sameLeaseFileVersion(persisted.metadata, renewedHandleMetadata))) {
        throw new Error("Project lease persisted owner or version changed after renewal");
      }
      verifiedRenewed = persisted;
    } catch (error) {
      errors.push(error);
      unresolvedWork = pendingDeadlineOperation(error) ?? unresolvedWork;
      if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
    }
  }
  if (errors.length > 0 && writeMayHaveChangedOwner && !unresolvedWork) {
    try {
      const persisted = await optionalObservedLease(
        layout,
        path,
        observed.owner.projectDigest,
        deadline,
        "reconcile",
        hooks
      );
      if (!persisted || !sameIdentity(persisted.identity, observed.identity)) {
        throw new Error("Project lease identity changed during ambiguous renewal reconciliation");
      }
      if (sameOwner(persisted.owner, renewed)) {
        observed.owner = renewed;
        observed.metadata = persisted.metadata;
      } else if (!sameOwner(persisted.owner, observed.owner)) {
        throw new Error("Project lease owner changed during ambiguous renewal reconciliation");
      } else {
        observed.metadata = persisted.metadata;
      }
    } catch (error) {
      errors.push(error);
      unresolvedWork = pendingDeadlineOperation(error) ?? unresolvedWork;
      if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Project lease renewal or exact reconciliation was ambiguous", { cause: errors[0] });
  }
  if (!verifiedRenewed) throw new Error("Project lease renewed owner was not verified");
  observed.owner = verifiedRenewed.owner;
  observed.identity = verifiedRenewed.identity;
  observed.metadata = verifiedRenewed.metadata;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

async function retryAcquire(
  options: NormalizedProcessLeaseOptions,
  deadline: MonotonicDeadline,
  path: string,
  reason: "missing-after-conflict" | "transient-observation" | "dead-reclaimed" | "live-owner"
): Promise<void> {
  if (options.beforeAcquireRetry) {
    await withinDeadline(
      deadline,
      `${reason} retry hook`,
      () => options.beforeAcquireRetry!(path, reason)
    );
  }
  const remaining = deadlineRemaining(deadline, `before ${reason} retry wait`);
  await withinDeadline(
    deadline,
    `${reason} retry wait`,
    () => options.waitForRetry(Math.min(pollingIntervalMs, remaining))
  );
}

async function acquireLease(
  options: NormalizedProcessLeaseOptions,
  deadline: MonotonicDeadline,
  path: string,
  projectDigest: string
): Promise<{ path: string; observed: ObservedLease }> {
  for (;;) {
    deadlineRemaining(deadline, "before an acquisition iteration");
    deadlineRemaining(deadline, "before acquisition wall-clock sample");
    const createdAtMs = wallTime(options.now);
    deadlineRemaining(deadline, "after acquisition wall-clock sample");
    deadlineRemaining(deadline, "before acquisition nonce generation");
    const owner: ProcessLeaseOwner = {
      version: 1,
      pid: process.pid,
      nonce: randomBytes(16).toString("hex"),
      createdAtMs,
      renewedAtMs: createdAtMs,
      leaseMs: options.leaseMs,
      projectDigest
    };
    deadlineRemaining(deadline, "after acquisition nonce generation");
    deadlineRemaining(deadline, "before exclusive creation");
    const created = await createLease(options.layout, path, owner, deadline, options);
    if (created) {
      let deadlineError: unknown;
      try {
        deadlineRemaining(deadline, "after exclusive creation");
        if (options.afterLeaseCreate) {
          await withinDeadline(deadline, "post-create hook", () => options.afterLeaseCreate!(path));
        }
      } catch (error) {
        deadlineError = error;
      }
      if (deadlineError !== undefined) {
        const pending = pendingDeadlineOperation(deadlineError);
        if (pending) {
          created.unresolvedWork = pending;
          throw new AggregateError(
            [
              deadlineError,
              new AmbiguousProcessLeaseCleanupError(
                "Project lease post-create work remains unresolved; preserving the exact created owner evidence"
              )
            ],
            "Project lease timed out after exclusive creation and exact release remains ambiguous",
            { cause: deadlineError }
          );
        }
        try {
          await removeObservedLease(options.layout, path, created, deadline, "reconcile", options);
        } catch (releaseError) {
          throw new AggregateError(
            [deadlineError, releaseError],
            "Project lease timed out after exclusive creation and exact release was ambiguous",
            { cause: deadlineError }
          );
        }
        throw deadlineError;
      }
      return { path, observed: created };
    }
    deadlineRemaining(deadline, "after exclusive-create conflict");
    if (options.afterCreateConflict) {
      await withinDeadline(
        deadline,
        "exclusive-create conflict hook",
        () => options.afterCreateConflict!(path)
      );
    }

    let occupied: ObservedLease | undefined;
    try {
      occupied = await withinDeadline(
        deadline,
        "conflicting lease observation",
        () => optionalObservedLease(options.layout, path, projectDigest, deadline, "operation", options)
      );
    } catch (error) {
      if (deadlineFailure(error)) throw error;
      if (error instanceof InvalidProcessLeaseOwnerError) throw error;
      if (!(error instanceof TransientProcessLeaseObservationError) &&
          (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // open(..., "wx") makes the zero-length inode visible before its owner bytes
      // are flushed, and an in-place renewal can likewise overlap a bounded read.
      // Retry only within the monotonic acquisition deadline; persistent malformed
      // state is never reclaimed and ultimately fails closed with its original error.
      try {
        await retryAcquire(options, deadline, path, "transient-observation");
      } catch (retryError) {
        if (deadlineFailure(retryError)) throw retryError;
        throw new AggregateError(
          [error, retryError],
          "Transient project lease observation and acquisition retry both failed",
          { cause: error }
        );
      }
      continue;
    }
    if (!occupied) {
      await retryAcquire(options, deadline, path, "missing-after-conflict");
      continue;
    }
    deadlineRemaining(deadline, "before observed-owner wall-clock sample");
    const currentWallTime = wallTime(options.now);
    deadlineRemaining(deadline, "after observed-owner wall-clock sample");
    if (currentWallTime < occupied.owner.renewedAtMs) {
      throw new Error("Project lease timestamp is in the future; refusing ambiguous lock state");
    }
    if (currentWallTime - occupied.owner.renewedAtMs >= occupied.owner.leaseMs) {
      deadlineRemaining(deadline, "before observed-owner liveness probe");
      const liveness = probeProcessLiveness(occupied.owner.pid);
      deadlineRemaining(deadline, "after observed-owner liveness probe");
      if (liveness === "ambiguous") {
        throw new Error("Project lease owner liveness is ambiguous; refusing stale-lock recovery");
      }
      if (liveness === "dead") {
        await withinDeadline(
          deadline,
          "dead-owner exact reclaim",
          () => removeObservedLease(options.layout, path, occupied!, deadline, "operation", options)
        );
        await retryAcquire(options, deadline, path, "dead-reclaimed");
        continue;
      }
    }
    await retryAcquire(options, deadline, path, "live-owner");
  }
}

async function withLocalQueue<T>(
  key: string,
  deadline: MonotonicDeadline,
  operation: () => Promise<T>
): Promise<T> {
  const normalized = process.platform === "win32" ? key.toLocaleLowerCase("en-US") : key;
  let state = processLeaseQueues.get(normalized);
  if (!state) {
    state = { tail: Promise.resolve(), users: 0 };
    processLeaseQueues.set(normalized, state);
  }
  state.users += 1;
  const predecessor = state.tail;
  let release!: () => void;
  const turn = new Promise<void>((accept) => { release = accept; });
  state.tail = predecessor.then(() => turn);
  try {
    await withinDeadline(deadline, "local queue predecessor", () => predecessor);
    deadlineRemaining(deadline, "after the local queue predecessor resolved");
    return await operation();
  } finally {
    release();
    state.users -= 1;
    if (state.users === 0 && processLeaseQueues.get(normalized) === state) processLeaseQueues.delete(normalized);
  }
}

export async function withProcessLease<T>(
  options: ProcessLeaseOptions,
  operation: (lease: ProjectLease) => Promise<T>
): Promise<T> {
  const timeoutMs = duration(options.timeoutMs, defaultTimeoutMs, "Project lease timeout");
  const leaseMs = duration(options.leaseMs, defaultLeaseMs, "Project lease duration");
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const normalized: NormalizedProcessLeaseOptions = {
    ...options,
    timeoutMs,
    leaseMs,
    monotonicNow,
    waitForRetry: options.waitForRetry ?? wait
  };
  const deadline = createDeadline(monotonicNow, timeoutMs);
  const canonicalRoot = await withinDeadline(
    deadline,
    "canonical project-root resolution",
    () => realpath(options.projectRoot)
  );
  const digest = canonicalDigest(canonicalRoot);
  const path = lockPath(options.layout, digest);
  return withLocalQueue(path, deadline, async () => {
    deadlineRemaining(deadline, "before process-lease acquisition");
    const acquired = await acquireLease(normalized, deadline, path, digest);
    let dispatchError: unknown;
    try {
      if (normalized.afterAcquire) {
        await withinDeadline(
          deadline,
          "post-acquisition hook",
          () => normalized.afterAcquire!(path)
        );
      }
      const dispatchOwner = await optionalObservedLease(
        options.layout,
        acquired.path,
        acquired.observed.owner.projectDigest,
        deadline,
        "operation",
        normalized
      );
      if (!dispatchOwner || !sameIdentity(dispatchOwner.identity, acquired.observed.identity) ||
          !sameOwner(dispatchOwner.owner, acquired.observed.owner) ||
          !sameLeaseFileVersion(dispatchOwner.metadata, acquired.observed.metadata)) {
        throw new Error("Project lease ownership or version changed before callback dispatch");
      }
      acquired.observed = dispatchOwner;
      deadlineRemaining(deadline, "before project-operation callback dispatch");
    } catch (error) {
      dispatchError = error;
    }
    if (dispatchError !== undefined) {
      const pending = pendingDeadlineOperation(dispatchError) ?? acquired.observed.unresolvedWork;
      if (pending) {
        acquired.observed.unresolvedWork = pending;
        throw new AggregateError(
          [
            dispatchError,
            new AmbiguousProcessLeaseCleanupError(
              "Project lease dispatch work remains unresolved; preserving exact owner evidence"
            )
          ],
          "Project lease acquisition expired and exact release remains ambiguous",
          { cause: dispatchError }
        );
      }
      try {
        await removeObservedLease(options.layout, acquired.path, acquired.observed, deadline, "reconcile", normalized);
      } catch (releaseError) {
        throw new AggregateError(
          [dispatchError, releaseError],
          "Project lease acquisition expired and exact release was ambiguous",
          { cause: dispatchError }
        );
      }
      throw dispatchError;
    }
    let renewalTimer: NodeJS.Timeout | undefined;
    let renewalInFlight: Promise<void> | undefined;
    let assertionInFlight: Promise<void> | undefined;
    let renewalError: unknown;
    let stopped = false;
    const intervalMs = Math.max(10, Math.min(1_000, Math.floor(leaseMs / 3)));
    const renewalBudgetMs = Math.max(10, Math.min(intervalMs, leaseMs - intervalMs));
    const assertionBudgetMs = Math.max(10, leaseMs);
    const releaseBudgetMs = Math.max(250, leaseMs);
    const scheduleRenewal = () => {
      if (stopped || renewalError !== undefined || acquired.observed.unresolvedWork ||
          assertionInFlight || renewalInFlight || renewalTimer) return;
      renewalTimer = setTimeout(() => {
        renewalTimer = undefined;
        if (stopped || renewalError !== undefined || acquired.observed.unresolvedWork || assertionInFlight) return;
        let renewalDeadline: MonotonicDeadline;
        try {
          renewalDeadline = createDeadline(monotonicNow, renewalBudgetMs, renewalBudgetMs);
        } catch (error) {
          renewalError = error;
          return;
        }
        renewalInFlight = renewLease(
          options.layout,
          acquired.path,
          acquired.observed,
          options.now,
          renewalDeadline,
          normalized
        )
          .catch((error) => {
            const pending = pendingDeadlineOperation(error);
            if (pending) acquired.observed.unresolvedWork = pending;
            renewalError = error;
          })
          .finally(() => {
            renewalInFlight = undefined;
            scheduleRenewal();
          });
      }, intervalMs);
      renewalTimer.unref?.();
    };
    const performAssertOwned = async () => {
      if (renewalTimer) {
        clearTimeout(renewalTimer);
        renewalTimer = undefined;
      }
      const unresolvedBeforeAssertion = unresolvedLeaseWork(acquired.observed);
      if (unresolvedBeforeAssertion) {
        throw new AmbiguousProcessLeaseCleanupError(
          `Project lease assertion is blocked behind unresolved ${unresolvedBeforeAssertion.context}`
        );
      }
      const assertionDeadline = createDeadline(monotonicNow, assertionBudgetMs, assertionBudgetMs);
      if (renewalInFlight) {
        try {
          await withinDeadline(
            assertionDeadline,
            "in-flight renewal join",
            () => renewalInFlight!
          );
        } catch (error) {
          const pending = pendingDeadlineOperation(error);
          if (pending) acquired.observed.unresolvedWork = pending;
          throw error;
        }
      }
      const unresolvedAfterJoin = unresolvedLeaseWork(acquired.observed);
      if (unresolvedAfterJoin) {
        throw new AmbiguousProcessLeaseCleanupError(
          `Project lease assertion is blocked behind unresolved ${unresolvedAfterJoin.context}`
        );
      }
      if (renewalError !== undefined) throw renewalError;
      let current: ObservedLease | undefined;
      try {
        current = await optionalObservedLease(
          options.layout,
          acquired.path,
          acquired.observed.owner.projectDigest,
          assertionDeadline,
          "operation",
          normalized
        );
      } catch (error) {
        const pending = pendingDeadlineOperation(error);
        if (pending) acquired.observed.unresolvedWork = pending;
        throw error;
      }
      if (!current || !sameIdentity(current.identity, acquired.observed.identity) ||
          !sameOwner(current.owner, acquired.observed.owner) ||
          !sameLeaseFileVersion(current.metadata, acquired.observed.metadata)) {
        throw new Error("Project lease ownership or identity changed");
      }
    };
    const assertOwned = (): Promise<void> => {
      if (assertionInFlight) return assertionInFlight;
      let currentAssertion!: Promise<void>;
      currentAssertion = performAssertOwned().finally(() => {
        if (assertionInFlight === currentAssertion) assertionInFlight = undefined;
        scheduleRenewal();
      });
      assertionInFlight = currentAssertion;
      return currentAssertion;
    };
    const lease: ProjectLease = {
      get pid() { return acquired.observed.owner.pid; },
      get nonce() { return acquired.observed.owner.nonce; },
      get createdAtMs() { return acquired.observed.owner.createdAtMs; },
      get renewedAtMs() { return acquired.observed.owner.renewedAtMs; },
      get leaseMs() { return acquired.observed.owner.leaseMs; },
      get projectDigest() { return acquired.observed.owner.projectDigest; },
      get lockIdentity() { return acquired.observed.identity; },
      assertOwned
    };
    scheduleRenewal();
    let result: T | undefined;
    let operationError: unknown;
    try {
      result = await operation(lease);
      await assertOwned();
    } catch (error) {
      const pending = pendingDeadlineOperation(error);
      if (pending) acquired.observed.unresolvedWork = pending;
      operationError = error;
    }
    stopped = true;
    if (renewalTimer) {
      clearTimeout(renewalTimer);
      renewalTimer = undefined;
    }
    if (renewalInFlight) {
      try {
        const shutdownDeadline = createDeadline(monotonicNow, assertionBudgetMs, assertionBudgetMs);
        await withinDeadline(shutdownDeadline, "renewal shutdown join", () => renewalInFlight!);
      } catch (error) {
        const pending = pendingDeadlineOperation(error);
        if (pending) acquired.observed.unresolvedWork = pending;
        renewalError = renewalError === undefined
          ? error
          : new AggregateError([renewalError, error], "Project lease renewal shutdown was ambiguous", { cause: renewalError });
      }
    }
    let releaseError: unknown;
    if (acquired.observed.unresolvedWork) {
      releaseError = new AmbiguousProcessLeaseCleanupError(
        `Project lease cleanup was suppressed behind unresolved ${acquired.observed.unresolvedWork.context}; preserving exact owner evidence`
      );
    } else {
      try {
        const releaseDeadline = createDeadline(monotonicNow, releaseBudgetMs, releaseBudgetMs);
        await removeObservedLease(
          options.layout,
          acquired.path,
          acquired.observed,
          releaseDeadline,
          "operation",
          normalized
        );
      } catch (error) {
        releaseError = error;
      }
    }
    const completionErrors: unknown[] = [];
    if (operationError !== undefined) completionErrors.push(operationError);
    if (renewalError !== undefined && renewalError !== operationError) completionErrors.push(renewalError);
    if (releaseError !== undefined) completionErrors.push(releaseError);
    if (completionErrors.length === 1) throw completionErrors[0];
    if (completionErrors.length > 1) {
      throw new AggregateError(
        completionErrors,
        "Project lease operation, renewal, or cleanup was incomplete",
        { cause: operationError ?? renewalError ?? releaseError }
      );
    }
    return result as T;
  });
}
