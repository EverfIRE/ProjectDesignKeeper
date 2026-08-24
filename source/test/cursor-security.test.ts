import {
  execFile as execFileCallback,
  spawn,
  type ChildProcessWithoutNullStreams
} from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { createCursorCodec } from "../src/security/cursor.js";
import { pageItems } from "../src/scope/pagination.js";
import { scopeCursorKey } from "../src/scope/store.js";

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const execFile = promisify(execFileCallback);

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  await removeProjectFixture(fixture);
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

function cacheDirectory(): string {
  return join(project().root, "keeper-cache");
}

function bodyOf(token: string): Record<string, unknown> {
  const [body] = token.split(".");
  return JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Record<string, unknown>;
}

interface OwnedCursorChild {
  child: ChildProcessWithoutNullStreams;
  pid: number;
  completion: Promise<string>;
  closed: Promise<void>;
  terminate: () => Promise<void>;
  expectedCompletionFailure?: { reason: unknown };
}

interface CursorDescendantOwnership {
  parentPid: number;
  descendantPid: number;
  nonce: string;
}

interface CursorDescendantStop {
  nonce: string;
  stopPath: string;
  stoppedPath: string;
  ownership: () => CursorDescendantOwnership | undefined;
  timeoutMs?: number;
}

function parseCursorDescendantOwnership(
  value: unknown,
  ownedParentPid: number,
  expectedNonce: string
): CursorDescendantOwnership {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("cursor descendant ownership record is malformed");
  }
  const record = value as Record<string, unknown>;
  const parentPid = record.parentPid;
  const descendantPid = record.descendantPid;
  const nonce = record.nonce;
  if (
    typeof parentPid !== "number"
    || !Number.isSafeInteger(parentPid)
    || parentPid <= 0
    || typeof descendantPid !== "number"
    || !Number.isSafeInteger(descendantPid)
    || descendantPid <= 0
  ) {
    throw new Error("cursor descendant ownership record contains an unsafe PID");
  }
  if (parentPid !== ownedParentPid) {
    throw new Error("cursor descendant ownership record is not bound to the owned parent");
  }
  if (descendantPid === parentPid) {
    throw new Error("cursor descendant ownership record does not identify a distinct descendant");
  }
  if (typeof nonce !== "string" || nonce !== expectedNonce) {
    throw new Error("cursor descendant ownership record nonce does not match");
  }
  return { parentPid, descendantPid, nonce };
}

function parseCursorDescendantOwnershipText(
  text: string,
  ownedParentPid: number,
  expectedNonce: string
): CursorDescendantOwnership {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error("cursor descendant ownership record is malformed JSON", { cause: error });
  }
  return parseCursorDescendantOwnership(value, ownedParentPid, expectedNonce);
}

interface CursorChildControl {
  platform: NodeJS.Platform;
  taskkill: (pid: number) => Promise<void>;
}

type StopCursorChildrenOptions = {
  closeTimeoutMs?: number;
} & (
  | { hasOriginalError?: false; originalError?: never }
  | { hasOriginalError: true; originalError: unknown }
);

type BoundedSettlement<T> = PromiseSettledResult<T> | { status: "timed-out" };

async function boundedSettlement<T>(promise: Promise<T>, timeoutMs: number): Promise<BoundedSettlement<T>> {
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<{ status: "timed-out" }>((accept) => {
    timeout = setTimeout(() => accept({ status: "timed-out" }), timeoutMs);
  });
  try {
    return await Promise.race([
      promise.then<PromiseFulfilledResult<T>, PromiseRejectedResult>(
        (value) => ({ status: "fulfilled", value }),
        (reason: unknown) => ({ status: "rejected", reason })
      ),
      timedOut
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitUntil(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) return false;
    await new Promise<void>((accept) => setTimeout(accept, 10));
  }
  return true;
}

function processGroupIsAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

const nodeCursorChildControl: CursorChildControl = {
  platform: process.platform,
  taskkill: async (pid) => {
    await execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      timeout: 2_000
    });
  }
};

function startCursorChildWithControl(
  timeoutMs: number,
  control: CursorChildControl,
  ...args: string[]
): OwnedCursorChild {
  const viteNode = resolve("node_modules", "vite-node", "vite-node.mjs");
  const childFixture = resolve("test", "fixtures", "cursor-child.ts");
  const child = spawn(process.execPath, [viteNode, childFixture, ...args], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    windowsHide: true,
    shell: false
  });
  const pid = child.pid;
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) {
    child.kill();
    throw new Error("cursor child did not receive an owned PID");
  }
  let stdout = "";
  let stderr = "";
  let spawnError: unknown;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let closedDirectly = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  child.once("error", (error) => { spawnError = error; });
  const closed = new Promise<void>((accept) => {
    child.once("close", (code, signal) => {
      exitCode = code;
      exitSignal = signal;
      closedDirectly = true;
      accept();
    });
  });

  let termination: Promise<void> | undefined;
  const terminate = (): Promise<void> => {
    termination ??= (async () => {
      if (closedDirectly) return;
      try {
        if (control.platform === "win32") {
          await control.taskkill(pid);
          if (!await waitUntil(() => closedDirectly, 2_000)) {
            child.kill("SIGKILL");
            if (!await waitUntil(() => closedDirectly, 2_000)) {
              throw new Error(`owned cursor child ${pid} did not close after tree termination`);
            }
          }
        } else {
          try {
            process.kill(-pid, "SIGTERM");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
          const terminated = await waitUntil(() => closedDirectly && !processGroupIsAlive(pid), 500);
          if (!terminated) {
            try {
              process.kill(-pid, "SIGKILL");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
            }
            if (!await waitUntil(() => closedDirectly && !processGroupIsAlive(pid), 2_000)) {
              throw new Error(`owned cursor process group ${pid} did not exit after escalation`);
            }
          }
        }
      } finally {
        if (!closedDirectly) {
          child.kill("SIGKILL");
          if (!await waitUntil(() => closedDirectly, 2_000)) {
            throw new Error(`owned cursor child ${pid} did not emit close after forced termination`);
          }
        }
      }
    })();
    return termination;
  };

  const operation = closed.then(() => {
    if (spawnError !== undefined) throw spawnError;
    if (exitCode === 0) return stdout.trim();
    throw new Error(`cursor child failed (${exitCode ?? exitSignal ?? "unknown"}): ${stderr.trim()}`);
  });
  const timeoutError = new Error("cursor child timed out");
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_accept, reject) => {
    timeout = setTimeout(() => reject(timeoutError), timeoutMs);
  });
  const completion = (async () => {
    try {
      return await Promise.race([operation, timedOut]);
    } catch (error) {
      if (error === timeoutError) {
        try {
          await terminate();
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], "cursor child timed out and cleanup failed");
        }
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  })();
  void completion.catch(() => undefined);
  return { child, pid, completion, closed, terminate };
}

function startCursorChildWithTimeout(timeoutMs: number, ...args: string[]): OwnedCursorChild {
  return startCursorChildWithControl(timeoutMs, nodeCursorChildControl, ...args);
}

function startCursorChild(...args: string[]): OwnedCursorChild {
  return startCursorChildWithTimeout(20_000, ...args);
}

async function stopCursorChildren(
  children: OwnedCursorChild[],
  options: StopCursorChildrenOptions = {}
): Promise<void> {
  const closeTimeoutMs = options.closeTimeoutMs ?? 2_000;
  const terminations = await Promise.allSettled(children.map(({ terminate }) => terminate()));
  const closes = await Promise.all(children.map(({ closed }) => boundedSettlement(closed, closeTimeoutMs)));
  const completions = await Promise.all(
    children.map(({ completion }) => boundedSettlement(completion, closeTimeoutMs))
  );
  const cleanupFailures: unknown[] = [];
  const completionFailures: unknown[] = [];
  for (const [index, termination] of terminations.entries()) {
    if (termination.status === "rejected") cleanupFailures.push(termination.reason);
    const close = closes[index]!;
    if (close.status === "timed-out") {
      cleanupFailures.push(new Error(
        `owned cursor child ${children[index]!.pid} close timed out after ${closeTimeoutMs} ms`
      ));
    } else if (close.status === "rejected") {
      cleanupFailures.push(close.reason);
    }
    const completion = completions[index]!;
    if (completion.status === "timed-out") {
      cleanupFailures.push(new Error(
        `owned cursor child ${children[index]!.pid} completion timed out after ${closeTimeoutMs} ms`
      ));
    } else if (completion.status === "rejected") {
      const expectedFailure = children[index]!.expectedCompletionFailure;
      if (expectedFailure === undefined || expectedFailure.reason !== completion.reason) {
        completionFailures.push(completion.reason);
      }
    }
  }
  if (cleanupFailures.length > 0 || completionFailures.length > 0) {
    const evidence = [
      ...(options.hasOriginalError ? [options.originalError] : []),
      ...cleanupFailures,
      ...completionFailures
    ];
    throw new AggregateError(evidence, "cursor child cleanup failed", {
      ...(options.hasOriginalError ? { cause: options.originalError } : {})
    });
  }
}

async function runCursorChild(...args: string[]): Promise<string> {
  const owned = startCursorChild(...args);
  return await withCursorChildren([owned], async () => await owned.completion);
}

async function withCursorChildren<T>(
  children: OwnedCursorChild[],
  operation: () => Promise<T>
): Promise<T> {
  let outcome: PromiseSettledResult<T>;
  try {
    outcome = { status: "fulfilled", value: await operation() };
  } catch (reason) {
    outcome = { status: "rejected", reason };
  }
  await stopCursorChildren(children, outcome.status === "rejected"
    ? { hasOriginalError: true, originalError: outcome.reason }
    : { hasOriginalError: false });
  if (outcome.status === "rejected") throw outcome.reason;
  return outcome.value;
}

async function waitForFile(path: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await stat(path);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (Date.now() >= deadline) throw new Error(`child readiness timed out: ${path}`);
    await new Promise<void>((accept) => setTimeout(accept, 10));
  }
}

async function waitForExactFile(path: string, expected: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastObserved: string | undefined;
  for (;;) {
    try {
      lastObserved = await readFile(path, "utf8");
      if (lastObserved === expected) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        lastObserved === undefined
          ? `cursor descendant stop acknowledgement timed out after ${timeoutMs} ms`
          : "cursor descendant stop acknowledgement did not match its nonce"
      );
    }
    await new Promise<void>((accept) => setTimeout(accept, 10));
  }
}

async function stopCursorDescendant(control: CursorDescendantStop): Promise<void> {
  const timeoutMs = control.timeoutMs ?? 2_000;
  const ownership = control.ownership();
  if (ownership !== undefined && !processIsAlive(ownership.descendantPid)) return;
  const command = `${control.nonce}\n`;
  try {
    await writeFile(control.stopPath, command, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readFile(control.stopPath, "utf8") !== command) {
      throw new Error("cursor descendant stop command already exists with a different nonce");
    }
  }
  await waitForExactFile(control.stoppedPath, command, timeoutMs);
  if (
    ownership !== undefined
    && !await waitUntil(() => !processIsAlive(ownership.descendantPid), timeoutMs)
  ) {
    throw new Error(
      "cursor descendant PID identity is ambiguous after nonce-bound stop; refusing a PID signal"
    );
  }
}

async function withCursorDescendantStop<T>(
  control: CursorDescendantStop,
  operation: () => Promise<T>
): Promise<T> {
  let outcome: PromiseSettledResult<T>;
  try {
    outcome = { status: "fulfilled", value: await operation() };
  } catch (reason) {
    outcome = { status: "rejected", reason };
  }
  try {
    await stopCursorDescendant(control);
  } catch (cleanupError) {
    throw new AggregateError(
      [...(outcome.status === "rejected" ? [outcome.reason] : []), cleanupError],
      "cursor descendant cleanup failed",
      { ...(outcome.status === "rejected" ? { cause: outcome.reason } : {}) }
    );
  }
  if (outcome.status === "rejected") throw outcome.reason;
  return outcome.value;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function errorEvidence(error: unknown): string[] {
  if (!(error instanceof Error)) return [String(error)];
  const nested = error instanceof AggregateError ? error.errors.flatMap(errorEvidence) : [];
  const cause = "cause" in error && error.cause !== undefined ? errorEvidence(error.cause) : [];
  return [error.message, ...nested, ...cause];
}

async function assertDistinctRootCursorIsolation(leftRoot: string, rightRoot: string): Promise<void> {
  const codec = await createCursorCodec({ cacheDirectory: cacheDirectory() });
  const storageScopeKey = "a".repeat(64);
  const leftScopeKey = scopeCursorKey(leftRoot, storageScopeKey);
  const rightScopeKey = scopeCursorKey(rightRoot, storageScopeKey);
  expect(leftScopeKey).not.toBe(rightScopeKey);
  const first = await pageItems({
    items: ["first", "second"], limit: 1, codec, now: 100, expiresAt: 200,
    snapshotId: "same-snapshot", scopeKey: leftScopeKey, view: "files"
  });
  await expect(pageItems({
    items: ["first", "second"], limit: 1, codec, now: 100, expiresAt: 200,
    snapshotId: "same-snapshot", scopeKey: rightScopeKey, view: "files", cursor: first.page.nextCursor
  })).rejects.toThrow(/cursor.*scope|cursor.*project/i);
}

describe("authenticated cursor codec", () => {
  test("uses canonical JSON and one persistent key under concurrent creation", async () => {
    const [left, right] = await Promise.all([
      createCursorCodec({ cacheDirectory: cacheDirectory() }),
      createCursorCodec({ cacheDirectory: cacheDirectory() })
    ]);

    const first = left.encode({ z: [3, { b: 2, a: 1 }], a: "bound" });
    const second = right.encode({ a: "bound", z: [3, { a: 1, b: 2 }] });

    expect(first).toBe(second);
    expect(first.split(".")).toHaveLength(2);
    expect(Buffer.from(first.split(".")[0]!, "base64url").toString("utf8"))
      .toBe('{"a":"bound","z":[3,{"a":1,"b":2}]}');
    expect((await readFile(join(cacheDirectory(), "cursor-hmac.key"))).byteLength).toBe(32);
  });

  test("rejects body, MAC, part-count, base64, and oversized token tampering", async () => {
    const codec = await createCursorCodec({ cacheDirectory: cacheDirectory() });
    const parse = (value: unknown) => value as Record<string, unknown>;
    const token = codec.encode({ version: 2, offset: 1 });
    const [body, mac] = token.split(".");
    const changedBody = Buffer.from('{"offset":2,"version":2}', "utf8").toString("base64url");
    const changedMac = `${mac!.slice(0, -1)}${mac!.endsWith("A") ? "B" : "A"}`;

    for (const malformed of [
      `${changedBody}.${mac}`,
      `${body}.${changedMac}`,
      `${body}.${mac}.extra`,
      `${body}.`,
      `${body}.${mac}=`,
      `*.${mac}`,
      "a".repeat(5000)
    ]) {
      expect(() => codec.decode(malformed, parse)).toThrow(/cursor.*malformed|cursor.*tampered/i);
    }
  });

  test("keeps a cursor verifiable after the codec module is reloaded", async () => {
    const first = await createCursorCodec({ cacheDirectory: cacheDirectory() });
    const token = first.encode({ version: 2, stable: true });
    vi.resetModules();
    const reloaded = await import("../src/security/cursor.js");
    const second = await reloaded.createCursorCodec({ cacheDirectory: cacheDirectory() });

    expect(second.decode(token, (value) => value)).toEqual({ stable: true, version: 2 });
  });

  test("creates in one child process and consumes in another", async () => {
    const token = await runCursorChild("create", cacheDirectory(), JSON.stringify({ process: "creator", version: 2 }));
    const decoded = JSON.parse(await runCursorChild("decode", cacheDirectory(), token));

    expect(decoded).toEqual({ process: "creator", version: 2 });
  }, 30_000);

  test("adopts one first-key winner across simultaneous child processes", async () => {
    const barrier = join(project().root, "cursor-child-start");
    const readyA = join(project().root, "cursor-child-a.ready");
    const readyB = join(project().root, "cursor-child-b.ready");
    const children = [
      startCursorChild(
        "create-after-barrier", cacheDirectory(), JSON.stringify({ process: "a", version: 2 }), barrier, readyA
      ),
      startCursorChild(
        "create-after-barrier", cacheDirectory(), JSON.stringify({ process: "b", version: 2 }), barrier, readyB
      )
    ];
    await withCursorChildren(children, async () => {
      await Promise.all([waitForFile(readyA), waitForFile(readyB)]);
      expect(await readFile(readyA, "utf8")).not.toBe(await readFile(readyB, "utf8"));
      await writeFile(barrier, "start\n", { encoding: "utf8", flag: "wx" });
      const [tokenA, tokenB] = await Promise.all(children.map(({ completion }) => completion));

      await expect(runCursorChild("decode", cacheDirectory(), tokenA)).resolves.toContain('"process":"a"');
      await expect(runCursorChild("decode", cacheDirectory(), tokenB)).resolves.toContain('"process":"b"');
      expect((await readFile(join(cacheDirectory(), "cursor-hmac.key"))).byteLength).toBe(32);
    });
  }, 30_000);

  test("terminates and settles live creators when the parent fails before barrier release", async () => {
    const barrier = join(project().root, "cursor-child-never-released");
    const readyA = join(project().root, "cursor-child-cleanup-a.ready");
    const readyB = join(project().root, "cursor-child-cleanup-b.ready");
    const children = [
      startCursorChild(
        "create-after-barrier", cacheDirectory(), JSON.stringify({ process: "cleanup-a" }), barrier, readyA
      ),
      startCursorChild(
        "create-after-barrier", cacheDirectory(), JSON.stringify({ process: "cleanup-b" }), barrier, readyB
      )
    ];
    const injectedFailure = new Error("injected parent barrier failure");
    const observed = await withCursorChildren(children, async () => {
      await Promise.all([waitForFile(readyA), waitForFile(readyB)]);
      throw injectedFailure;
    }).catch((error: unknown) => error);

    expect(observed).toBeInstanceOf(AggregateError);
    expect((observed as AggregateError).cause).toBe(injectedFailure);
    expect((observed as AggregateError).errors[0]).toBe(injectedFailure);
    expect(errorEvidence(observed).filter((message) => /cursor child failed/i.test(message))).toHaveLength(2);
    expect(children.every(({ child }) => child.exitCode !== null || child.signalCode !== null)).toBe(true);
    await expect(Promise.allSettled(children.map(({ completion }) => completion)))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ status: "rejected" })]));
  }, 30_000);

  test("does not settle a timeout until the owned child tree has exited", async () => {
    const ready = join(project().root, "cursor-child-hanging-tree.ready");
    const stopPath = join(project().root, "cursor-child-hanging-tree.stop");
    const stoppedPath = join(project().root, "cursor-child-hanging-tree.stopped");
    const nonce = randomUUID();
    let ownership: CursorDescendantOwnership | undefined;
    const owned = startCursorChildWithTimeout(
      2_000,
      "hang-with-descendant",
      cacheDirectory(),
      JSON.stringify({ process: "hanging" }),
      ready,
      nonce,
      stopPath,
      stoppedPath,
      "valid"
    );
    await withCursorChildren([owned], async () => {
      await withCursorDescendantStop({
        nonce,
        stopPath,
        stoppedPath,
        ownership: () => ownership
      }, async () => {
        await waitForFile(ready, 2_000);
        ownership = parseCursorDescendantOwnershipText(
          await readFile(ready, "utf8"),
          owned.pid,
          nonce
        );

        const failure = await owned.completion.catch((error: unknown) => error);
        expect(errorEvidence(failure)).toContain("cursor child timed out");
        owned.expectedCompletionFailure = { reason: failure };

        expect(owned.child.exitCode !== null || owned.child.signalCode !== null).toBe(true);
        expect(processIsAlive(ownership.parentPid)).toBe(false);
        expect(processIsAlive(ownership.descendantPid)).toBe(false);
      });
    });
  }, 10_000);

  test("bounds every close wait and preserves every cleanup failure", async () => {
    const neverCloses = new Promise<void>(() => undefined);
    const firstCompletion = Promise.reject(new Error("first completion evidence"));
    const secondCompletion = Promise.reject(new Error("second completion evidence"));
    void firstCompletion.catch(() => undefined);
    void secondCompletion.catch(() => undefined);
    const children = [
      {
        child: {} as ChildProcessWithoutNullStreams,
        pid: 101,
        completion: firstCompletion,
        closed: neverCloses,
        terminate: async () => { throw new Error("first termination failure"); }
      },
      {
        child: {} as ChildProcessWithoutNullStreams,
        pid: 202,
        completion: secondCompletion,
        closed: neverCloses,
        terminate: async () => { throw new Error("second termination failure"); }
      }
    ];
    const original = new Error("original operation failure");
    const outcome = await Promise.race([
      stopCursorChildren(children, { closeTimeoutMs: 25, hasOriginalError: true, originalError: original })
        .then(() => "unexpected success" as const)
        .catch((error: unknown) => error),
      new Promise<"unbounded">((accept) => setTimeout(() => accept("unbounded"), 250))
    ]);

    expect(outcome).not.toBe("unbounded");
    expect(outcome).toBeInstanceOf(AggregateError);
    const evidence = errorEvidence(outcome);
    expect(evidence).toEqual(expect.arrayContaining([
      "original operation failure",
      "first termination failure",
      "second termination failure",
      "first completion evidence",
      "second completion evidence",
      expect.stringMatching(/owned cursor child 101.*close.*timed out/i),
      expect.stringMatching(/owned cursor child 202.*close.*timed out/i)
    ]));
  });

  test("aggregates completion failure with the original operation after bounded cleanup succeeds", async () => {
    const completion = Promise.reject(new Error("cancelled child completion evidence"));
    const undefinedCompletion = Promise.reject(undefined);
    void completion.catch(() => undefined);
    void undefinedCompletion.catch(() => undefined);
    const original = new Error("early operation failure");
    const children = [
      {
        child: {} as ChildProcessWithoutNullStreams,
        pid: 303,
        completion,
        closed: Promise.resolve(),
        terminate: async () => undefined
      },
      {
        child: {} as ChildProcessWithoutNullStreams,
        pid: 404,
        completion: undefinedCompletion,
        closed: Promise.resolve(),
        terminate: async () => undefined
      }
    ];

    const outcome = await stopCursorChildren(children, {
      closeTimeoutMs: 25,
      hasOriginalError: true,
      originalError: original
    })
      .then(() => "unexpected success" as const)
      .catch((error: unknown) => error);

    expect(outcome).toBeInstanceOf(AggregateError);
    expect((outcome as AggregateError).cause).toBe(original);
    expect(errorEvidence(outcome)).toEqual(expect.arrayContaining([
      "early operation failure",
      "cancelled child completion evidence",
      "undefined"
    ]));
  });

  test("preserves an undefined operation rejection after cursor child cleanup succeeds", async () => {
    const child = {
      child: {} as ChildProcessWithoutNullStreams,
      pid: 505,
      completion: Promise.resolve("completed"),
      closed: Promise.resolve(),
      terminate: async () => undefined
    };

    const outcome = await boundedSettlement(withCursorChildren([child], async () => {
      throw undefined;
    }), 250);

    expect(outcome).toEqual({ status: "rejected", reason: undefined });
  });

  test("retains an undefined operation rejection before cursor child completion failure", async () => {
    const completionFailure = new Error("completion after undefined operation rejection");
    const completion = Promise.reject(completionFailure);
    void completion.catch(() => undefined);
    const child = {
      child: {} as ChildProcessWithoutNullStreams,
      pid: 606,
      completion,
      closed: Promise.resolve(),
      terminate: async () => undefined
    };

    const outcome = await boundedSettlement(withCursorChildren([child], async () => {
      throw undefined;
    }), 250);

    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.reason).toBeInstanceOf(AggregateError);
    expect((outcome.reason as AggregateError).errors).toEqual([undefined, completionFailure]);
    expect(Object.hasOwn(outcome.reason as object, "cause")).toBe(true);
    expect((outcome.reason as AggregateError).cause).toBeUndefined();
  });

  test("preserves an undefined operation rejection after descendant stop succeeds", async () => {
    const nonce = "undefined-operation-cleanup-success";
    const stopPath = join(project().root, `${nonce}.stop`);
    const stoppedPath = join(project().root, `${nonce}.stopped`);
    await writeFile(stoppedPath, `${nonce}\n`, "utf8");

    const outcome = await boundedSettlement(withCursorDescendantStop({
      nonce,
      stopPath,
      stoppedPath,
      ownership: () => undefined,
      timeoutMs: 25
    }, async () => {
      throw undefined;
    }), 250);

    expect(outcome).toEqual({ status: "rejected", reason: undefined });
  });

  test("retains an undefined operation rejection before descendant stop failure", async () => {
    const nonce = "undefined-operation-cleanup-failure";
    const stopPath = join(project().root, `${nonce}.stop`);
    const stoppedPath = join(project().root, `${nonce}.stopped`);
    await writeFile(stopPath, "different-nonce\n", "utf8");

    const outcome = await boundedSettlement(withCursorDescendantStop({
      nonce,
      stopPath,
      stoppedPath,
      ownership: () => undefined,
      timeoutMs: 25
    }, async () => {
      throw undefined;
    }), 250);

    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.reason).toBeInstanceOf(AggregateError);
    expect((outcome.reason as AggregateError).errors[0]).toBeUndefined();
    expect((outcome.reason as AggregateError).errors[1]).toEqual(
      expect.objectContaining({ message: expect.stringMatching(/different nonce/i) })
    );
    expect(Object.hasOwn(outcome.reason as object, "cause")).toBe(true);
    expect((outcome.reason as AggregateError).cause).toBeUndefined();
  });

  test("rejects malformed or unbound descendant ownership records before PID authority is assigned", () => {
    const ownedParentPid = 303;
    const nonce = "parent-created-test-nonce";
    const invalidRecords: unknown[] = [
      null,
      { parentPid: 0, descendantPid: 404, nonce },
      { parentPid: Number.MAX_SAFE_INTEGER + 1, descendantPid: 404, nonce },
      { parentPid: ownedParentPid + 1, descendantPid: 404, nonce },
      { parentPid: ownedParentPid, descendantPid: 0, nonce },
      { parentPid: ownedParentPid, descendantPid: Number.MAX_SAFE_INTEGER + 1, nonce },
      { parentPid: ownedParentPid, descendantPid: ownedParentPid, nonce },
      { parentPid: ownedParentPid, descendantPid: 404, nonce: `${nonce}-mismatch` }
    ];

    for (const record of invalidRecords) {
      expect(
        () => parseCursorDescendantOwnership(record, ownedParentPid, nonce)
      ).toThrow(/descendant ownership record/i);
    }
    expect(parseCursorDescendantOwnership(
      { parentPid: ownedParentPid, descendantPid: 404, nonce },
      ownedParentPid,
      nonce
    )).toEqual({ parentPid: ownedParentPid, descendantPid: 404, nonce });
  });

  test.each([
    { failure: "readiness", recordMode: "valid", evidence: /child readiness timed out/i },
    { failure: "parse", recordMode: "malformed-json", evidence: /ownership record is malformed JSON/i },
    { failure: "nonce", recordMode: "nonce-mismatch", evidence: /ownership record nonce does not match/i },
    { failure: "assertion", recordMode: "valid", evidence: /injected post-ownership assertion failure/i }
  ])(
    "settles the owned tree after an early $failure failure without signaling a ready-file PID",
    async ({ failure, recordMode, evidence }) => {
      const suffix = `${failure}-${randomUUID()}`;
      const ready = join(project().root, `cursor-child-${suffix}.ready`);
      const missingReady = join(project().root, `cursor-child-${suffix}.missing`);
      const stopPath = join(project().root, `cursor-child-${suffix}.stop`);
      const stoppedPath = join(project().root, `cursor-child-${suffix}.stopped`);
      const nonce = randomUUID();
      const treeSignalTargets: number[] = [];
      const control: CursorChildControl = {
        ...nodeCursorChildControl,
        taskkill: async (pid) => {
          treeSignalTargets.push(pid);
          await nodeCursorChildControl.taskkill(pid);
        }
      };
      let ownership: CursorDescendantOwnership | undefined;
      const owned = startCursorChildWithControl(
        5_000,
        control,
        "hang-with-descendant",
        cacheDirectory(),
        JSON.stringify({ process: `early-${failure}` }),
        ready,
        nonce,
        stopPath,
        stoppedPath,
        recordMode
      );
      const outcome = await boundedSettlement(withCursorChildren([owned], async () => {
        await withCursorDescendantStop({
          nonce,
          stopPath,
          stoppedPath,
          ownership: () => ownership,
          timeoutMs: 2_000
        }, async () => {
          if (failure === "readiness") {
            await waitForFile(missingReady, 25);
            return;
          }
          await waitForFile(ready, 2_000);
          ownership = parseCursorDescendantOwnershipText(
            await readFile(ready, "utf8"),
            owned.pid,
            nonce
          );
          if (failure === "assertion") {
            expect(
              ownership.descendantPid,
              "injected post-ownership assertion failure"
            ).toBe(owned.pid);
          }
        });
      }), 5_000);

      expect(outcome.status).toBe("rejected");
      if (outcome.status !== "rejected") return;
      expect(errorEvidence(outcome.reason).some((message) => evidence.test(message))).toBe(true);
      expect(owned.child.exitCode !== null || owned.child.signalCode !== null).toBe(true);
      expect(treeSignalTargets).toEqual(process.platform === "win32" ? [owned.pid] : []);
      expect(await readFile(stoppedPath, "utf8")).toBe(`${nonce}\n`);
    },
    10_000
  );

  test("reports partial Windows tree cleanup when taskkill fails after the parent closes", async () => {
    const ready = join(project().root, "cursor-child-partial-tree.ready");
    const stopPath = join(project().root, "cursor-child-partial-tree.stop");
    const stoppedPath = join(project().root, "cursor-child-partial-tree.stopped");
    const nonce = randomUUID();
    let ownership: CursorDescendantOwnership | undefined;
    const owned = startCursorChildWithControl(
      2_000,
      {
        platform: "win32",
        taskkill: async () => { throw new Error("injected taskkill partial-tree failure"); }
      },
      "hang-with-descendant",
      cacheDirectory(),
      JSON.stringify({ process: "partial-tree" }),
      ready,
      nonce,
      stopPath,
      stoppedPath,
      "delayed-valid"
    );
    const outcome = await withCursorChildren([owned], async () => {
      await withCursorDescendantStop({
        nonce,
        stopPath,
        stoppedPath,
        ownership: () => ownership
      }, async () => {
        await waitForFile(ready, 2_000);
        ownership = parseCursorDescendantOwnershipText(
          await readFile(ready, "utf8"),
          owned.pid,
          nonce
        );

        const error = await owned.completion.catch((failure: unknown) => failure);

        expect(error).toBeInstanceOf(AggregateError);
        expect(errorEvidence(error)).toEqual(expect.arrayContaining([
          "cursor child timed out",
          "injected taskkill partial-tree failure"
        ]));
        expect(processIsAlive(ownership.parentPid)).toBe(false);
        expect(processIsAlive(ownership.descendantPid)).toBe(true);
      });
    }).catch((error: unknown) => error);

    expect(outcome).toBeInstanceOf(AggregateError);
    expect(errorEvidence(outcome)).toEqual(expect.arrayContaining([
      "cursor child timed out",
      "injected taskkill partial-tree failure"
    ]));
    expect(ownership).toBeDefined();
    expect(await readFile(stoppedPath, "utf8")).toBe(`${nonce}\n`);
    expect(processIsAlive(ownership!.parentPid)).toBe(false);
    expect(processIsAlive(ownership!.descendantPid)).toBe(false);
  }, 10_000);
});

describe("scope cursor security", () => {
  test("rejects a scope cursor with a caller-modified offset", async () => {
    const { createProjectDesignKeeper } = await import("../src/index.js");
    const api = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
    const first = await api.scanScope({ root: project().repository, view: "evidence", limit: 1 });
    const [body, mac] = String(first.page?.nextCursor).split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Record<string, unknown>;
    payload.offset = Number(payload.offset) + 5;
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;

    await expect(api.scanScope({
      root: project().repository,
      view: "evidence",
      limit: 1,
      cursor: forged
    })).rejects.toThrow(/cursor.*tampered/i);
  });

  test("binds version-2 cursors to scope, view, snapshot, and retention expiry", async () => {
    const { createProjectDesignKeeper } = await import("../src/index.js");
    const api = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
    const first = await api.scanScope({ root: project().repository, view: "evidence", limit: 1 });
    const token = String(first.page?.nextCursor);
    const body = bodyOf(token);
    expect(body).toEqual({
      expiresAt: expect.any(Number),
      issuedAt: expect.any(Number),
      offset: 1,
      scopeKey: expect.stringMatching(/^[a-f0-9]{64}$/u),
      snapshotId: first.snapshotId,
      version: 2,
      view: "evidence"
    });
    expect(Number(body.expiresAt) - Number(body.issuedAt)).toBeGreaterThan(0);
    expect(Number(body.expiresAt) - Number(body.issuedAt)).toBeLessThanOrEqual(sevenDaysMs);

    await expect(api.scanScope({
      root: project().repository,
      path: "docs",
      view: "evidence",
      limit: 1,
      cursor: token
    })).rejects.toThrow(/cursor/i);
    await expect(api.scanScope({
      root: project().repository,
      view: "files",
      limit: 1,
      cursor: token
    })).rejects.toThrow(/cursor/i);
    await writeFile(project().trackedText, "changed after cursor\n", "utf8");
    const continuation = await api.scanScope({
      root: project().repository,
      view: "evidence",
      limit: 1,
      cursor: token
    });
    expect(continuation.snapshotId).toBe(first.snapshotId);
    expect(JSON.stringify(continuation.items)).not.toContain("changed after cursor");
  });

  test("rejects expired and future-issued cursors before reading offsets", async () => {
    const codec = await createCursorCodec({ cacheDirectory: cacheDirectory() });
    const common = {
      version: 2,
      snapshotId: "sha256:" + "a".repeat(64),
      scopeKey: "b".repeat(64),
      view: "files" as const,
      offset: 999
    };

    await expect(pageItems({
      items: ["only"], limit: 1, codec, now: 101, expiresAt: 200,
      snapshotId: common.snapshotId, scopeKey: common.scopeKey, view: common.view,
      cursor: codec.encode({ ...common, issuedAt: 1, expiresAt: 100 })
    })).rejects.toThrow(/cursor.*expired/i);
    await expect(pageItems({
      items: ["only"], limit: 1, codec, now: 99, expiresAt: 200,
      snapshotId: common.snapshotId, scopeKey: common.scopeKey, view: common.view,
      cursor: codec.encode({ ...common, issuedAt: 100, expiresAt: 200 })
    })).rejects.toThrow(/cursor.*future|cursor.*issued/i);
  });

  test("preserves empty pages and stable ordering with authenticated offsets", async () => {
    const codec = await createCursorCodec({ cacheDirectory: cacheDirectory() });
    await expect(pageItems({
      items: [], limit: 10, codec, now: 10, expiresAt: 20,
      snapshotId: "snapshot", scopeKey: "scope", view: "files"
    })).resolves.toEqual({ items: [], page: { limit: 10, complete: true } });
    const first = await pageItems({
      items: ["first", "second", "third"], limit: 2, codec, now: 10, expiresAt: 20,
      snapshotId: "snapshot", scopeKey: "scope", view: "files"
    });
    const second = await pageItems({
      items: ["first", "second", "third"], limit: 2, codec, now: 11, expiresAt: 20,
      snapshotId: "snapshot", scopeKey: "scope", view: "files", cursor: first.page.nextCursor
    });

    expect(first.items).toEqual(["first", "second"]);
    expect(second).toEqual({ items: ["third"], page: { limit: 2, complete: true } });
  });

  test("rejects scan cursors and mismatched retention expiry across identical projects", async () => {
    const other = await createProjectFixture();
    try {
      const { createProjectDesignKeeper } = await import("../src/index.js");
      const firstApi = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
      const secondApi = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
      const first = await firstApi.scanScope({ root: project().repository, view: "evidence", limit: 1 });
      await new Promise<void>((accept) => setTimeout(accept, 1_100));
      const second = await secondApi.scanScope({ root: other.repository, view: "evidence", limit: 1 });
      const firstToken = String(first.page?.nextCursor);
      const secondToken = String(second.page?.nextCursor);
      expect(first.snapshotId).toBe(second.snapshotId);
      expect(bodyOf(firstToken).expiresAt).not.toBe(bodyOf(secondToken).expiresAt);
      expect(bodyOf(firstToken).scopeKey).not.toBe(bodyOf(secondToken).scopeKey);

      await expect(secondApi.scanScope({
        root: other.repository, view: "evidence", limit: 1, cursor: firstToken
      })).rejects.toThrow(/cursor.*scope|cursor.*project|cursor.*expiry/i);

      const secondBody = bodyOf(secondToken);
      const codec = await createCursorCodec({ cacheDirectory: cacheDirectory() }, other.repository);
      const wrongExpiry = codec.encode({ ...secondBody, expiresAt: Number(secondBody.expiresAt) + 1 });
      const error = await secondApi.scanScope({
        root: other.repository, view: "evidence", limit: 1, cursor: wrongExpiry
      }).catch((failure: unknown) => failure);
      expect(error).toMatchObject({
        name: "ScopeSnapshotRestartError",
        reason: "corrupt",
        restartPagination: true
      });
    } finally {
      await removeProjectFixture(other);
    }
  });

  test("rejects drift cursors across identical projects with distinct snapshot deadlines", async () => {
    const other = await createProjectFixture();
    try {
      const { createProjectDesignKeeper } = await import("../src/index.js");
      const firstApi = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
      const secondApi = createProjectDesignKeeper({ cacheDirectory: cacheDirectory() });
      const beforeA = await firstApi.snapshot({ root: project().repository });
      const beforeB = await secondApi.snapshot({ root: other.repository });
      await Promise.all([
        writeFile(project().trackedText, "same changed evidence\n", "utf8"),
        writeFile(other.trackedText, "same changed evidence\n", "utf8"),
        writeFile(join(project().repository, ".gitignore"), "generated/\nsame change\n", "utf8"),
        writeFile(join(other.repository, ".gitignore"), "generated/\nsame change\n", "utf8")
      ]);
      const first = await firstApi.detectDrift({
        root: project().repository, previousSnapshot: beforeA, view: "details", limit: 1
      });
      await new Promise<void>((accept) => setTimeout(accept, 1_100));
      const second = await secondApi.detectDrift({
        root: other.repository, previousSnapshot: beforeB, view: "details", limit: 1
      });
      const firstToken = String((first.page as Record<string, unknown>).nextCursor);
      const secondToken = String((second.page as Record<string, unknown>).nextCursor);
      expect(bodyOf(firstToken).snapshotId).toBe(bodyOf(secondToken).snapshotId);
      expect(bodyOf(firstToken).expiresAt).not.toBe(bodyOf(secondToken).expiresAt);
      expect(bodyOf(firstToken).scopeKey).not.toBe(bodyOf(secondToken).scopeKey);

      await expect(secondApi.detectDrift({
        root: other.repository,
        previousSnapshot: beforeB,
        view: "details",
        limit: 1,
        cursor: firstToken
      })).rejects.toThrow(/cursor.*scope|cursor.*project|cursor.*expiry|snapshot.*missing|restart pagination/i);
    } finally {
      await removeProjectFixture(other);
    }
  });

  test("keeps normalization-equivalent distinct canonical roots isolated at equal expiry", async ({ skip }) => {
    const parent = await mkdtemp(join(tmpdir(), "keeper-cursor-unicode-"));
    try {
      const nfc = join(parent, "\u00e9");
      const nfd = join(parent, "e\u0301");
      await mkdir(nfc);
      try {
        await mkdir(nfd);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") skip();
        throw error;
      }
      const [canonicalNfc, canonicalNfd] = await Promise.all([realpath(nfc), realpath(nfd)]);
      if (canonicalNfc === canonicalNfd) skip();
      await Promise.all([
        writeFile(join(nfc, "same.txt"), "identical\n", "utf8"),
        writeFile(join(nfd, "same.txt"), "identical\n", "utf8")
      ]);
      await assertDistinctRootCursorIsolation(canonicalNfc, canonicalNfd);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  test.runIf(process.platform === "win32")(
    "keeps supported case-sensitive Windows roots isolated at equal expiry",
    async ({ skip }) => {
      const parent = await mkdtemp(join(tmpdir(), "keeper-cursor-case-"));
      try {
        try {
          await execFile("fsutil.exe", ["file", "setCaseSensitiveInfo", parent, "enable"], { windowsHide: true });
        } catch {
          skip();
        }
        const upper = join(parent, "Root");
        const lower = join(parent, "root");
        await mkdir(upper);
        try {
          await mkdir(lower);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") skip();
          throw error;
        }
        const [canonicalUpper, canonicalLower] = await Promise.all([realpath(upper), realpath(lower)]);
        if (canonicalUpper === canonicalLower) skip();
        await Promise.all([
          writeFile(join(upper, "same.txt"), "identical\n", "utf8"),
          writeFile(join(lower, "same.txt"), "identical\n", "utf8")
        ]);
        await assertDistinctRootCursorIsolation(canonicalUpper, canonicalLower);
      } finally {
        await rm(parent, { recursive: true, force: true });
      }
    }
  );
});
