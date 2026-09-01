import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prepareSecureCache, type SecureCacheLayout } from "../src/security/cache.js";
import { withProcessLease, type ProjectLease } from "../src/security/process-lock.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";
import { createTrustedTestKeeper } from "./keeper.js";

interface WorkerResult {
  applied?: boolean;
  changesetId?: string;
  error?: string;
  released?: boolean;
  evidence?: string[];
}

interface WorkerEvent {
  event: string;
  pid?: number;
  createdAtMs?: number;
  renewedAtMs?: number;
  result?: WorkerResult;
}

interface ApplyWorker {
  waitFor(event: string, timeoutMs?: number): Promise<WorkerEvent>;
  send(command: string): void;
  result(timeoutMs?: number): Promise<WorkerResult>;
  crash(): Promise<void>;
  terminate(): Promise<void>;
}

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;
const workers = new Set<ApplyWorker>();

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-process-lock-cache-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.allSettled([...workers].map((worker) => worker.terminate()));
  workers.clear();
  await removeProjectFixture(fixture);
  if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true });
  fixture = undefined;
  cacheDirectory = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function cache(): string {
  if (!cacheDirectory) throw new Error("cache was not created");
  return cacheDirectory;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

function deadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((accept, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); accept(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function errorMessages(error: unknown): string[] {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.flatMap((nested) => errorMessages(nested))];
  }
  if (error instanceof Error) {
    return [error.message, ...(error.cause === undefined ? [] : errorMessages(error.cause))];
  }
  return [String(error)];
}

function spawnApplyWorker(configuration: Record<string, unknown>): ApplyWorker {
  const viteNode = resolve("node_modules", "vite-node", "vite-node.mjs");
  const workerScript = resolve("test", "helpers", "apply-worker.mjs");
  const child = spawn(process.execPath, [viteNode, workerScript, JSON.stringify(configuration)], {
    cwd: resolve("."),
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  }) as ChildProcessWithoutNullStreams;
  const events: WorkerEvent[] = [];
  const waiters = new Map<string, Array<{ accept: (event: WorkerEvent) => void; reject: (error: Error) => void }>>();
  let stderr = "";
  let exited = false;
  const exit = new Promise<void>((accept) => {
    child.once("exit", () => { exited = true; accept(); });
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let event: WorkerEvent;
    try {
      event = JSON.parse(line) as WorkerEvent;
    } catch {
      return;
    }
    events.push(event);
    const pending = waiters.get(event.event)?.shift();
    pending?.accept(event);
  });
  child.once("exit", (code) => {
    for (const pending of waiters.values()) {
      for (const waiter of pending) waiter.reject(new Error(`worker exited ${code}: ${stderr}`));
    }
    waiters.clear();
  });

  const worker: ApplyWorker = {
    waitFor(eventName, timeoutMs = 5_000) {
      const found = events.find((event) => event.event === eventName);
      if (found) return Promise.resolve(found);
      return deadline(new Promise<WorkerEvent>((accept, reject) => {
        const pending = waiters.get(eventName) ?? [];
        pending.push({ accept, reject });
        waiters.set(eventName, pending);
      }), timeoutMs, `${eventName} worker event`);
    },
    send(command) {
      if (!exited) child.stdin.write(`${command}\n`);
    },
    async result(timeoutMs = 8_000) {
      return (await worker.waitFor("result", timeoutMs)).result!;
    },
    async crash() {
      if (exited) return;
      child.kill();
      await deadline(exit, 2_000, "crashed worker exit");
    },
    async terminate() {
      if (exited) return;
      child.stdin.write("release\n");
      try {
        await deadline(exit, 1_000, "graceful worker exit");
      } catch {
        child.kill();
        await deadline(exit, 2_000, "forced worker exit");
      }
    }
  };
  workers.add(worker);
  return worker;
}

async function leaseLayout(): Promise<SecureCacheLayout> {
  return prepareSecureCache({ cacheDirectory: cache() }, project().repository);
}

async function lockTemplate(layout: SecureCacheLayout): Promise<ProjectLease> {
  let captured!: ProjectLease;
  await withProcessLease({
    layout,
    projectRoot: project().repository,
    now: () => 10_000,
    timeoutMs: 500,
    leaseMs: 100
  }, async (lease) => { captured = lease; });
  return captured;
}

async function writeChurnLeaseOwner(
  path: string,
  template: ProjectLease,
  generation: number,
  options: { pid?: number; renewedAtMs?: number; leaseMs?: number } = {}
): Promise<void> {
  const owner = {
    version: 1,
    pid: options.pid ?? process.pid,
    nonce: generation.toString(16).padStart(32, "0"),
    createdAtMs: 10_000,
    renewedAtMs: options.renewedAtMs ?? 10_000,
    leaseMs: options.leaseMs ?? 1_000,
    projectDigest: template.projectDigest
  };
  const bytes = Buffer.from(`${JSON.stringify(owner)}\n`, "utf8");
  await writeFile(path, Buffer.from(bytes.toString("utf8").padEnd(512, " "), "utf8"), {
    flag: "wx",
    mode: 0o600
  });
}

async function recoveryNames(): Promise<string[]> {
  const snapshots = join(cache(), "snapshots");
  const projectDirectories = await readdir(snapshots);
  const names = await Promise.all(projectDirectories.map((directory) => readdir(join(snapshots, directory))));
  return names.flat();
}

describe("cross-process project leases", () => {
  test("rejects unsafe lease durations and clocks before callback dispatch", async () => {
    const layout = await leaseLayout();
    let entered = false;
    const operation = async () => { entered = true; };

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 0,
      leaseMs: 1_000
    }, operation)).rejects.toThrow(/timeout.*positive bounded integer/i);
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 300_001
    }, operation)).rejects.toThrow(/duration.*positive bounded integer/i);
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 1_000,
      monotonicNow: () => Number.NaN
    }, operation)).rejects.toThrow(/monotonic clock.*invalid/i);
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => -1,
      timeoutMs: 100,
      leaseMs: 1_000
    }, operation)).rejects.toThrow(/timestamp.*invalid/i);
    expect(entered).toBe(false);
  });

  test("bounds same-process queue wait with the monotonic acquisition timeout", async () => {
    const layout = await leaseLayout();
    let entered!: () => void;
    const enteredPromise = new Promise<void>((accept) => { entered = accept; });
    let release!: () => void;
    const releasePromise = new Promise<void>((accept) => { release = accept; });
    const first = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 500
    }, async () => {
      entered();
      await releasePromise;
    });
    await enteredPromise;
    const delayedRelease = setTimeout(release, 250);

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 75,
      leaseMs: 500
    }, async () => "unexpected")).rejects.toThrow(/timeout/i);
    clearTimeout(delayedRelease);
    release();
    await first;
  });

  test("bounds EEXIST to ENOENT claim churn with one injected monotonic deadline", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let monotonicMs = 0;
    let generations = 0;
    let entered = false;
    await writeChurnLeaseOwner(template.lockIdentity.path, template, generations);

    const acquiring = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 300,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs,
      waitForRetry: async () => { monotonicMs += 25; },
      afterCreateConflict: async (path: string) => {
        await rm(path);
        monotonicMs += 50;
      },
      beforeAcquireRetry: async (path: string, reason: string) => {
        expect(reason).toBe("missing-after-conflict");
        generations += 1;
        await writeChurnLeaseOwner(path, template, generations);
        monotonicMs += 50;
      }
    }, async () => {
      entered = true;
    });

    let failure: unknown;
    try {
      await deadline(acquiring, 150, "outer churn harness");
    } catch (error) {
      failure = error;
    } finally {
      await acquiring.catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/project lease/i);
    expect(generations).toBeGreaterThan(0);
    expect(entered).toBe(false);
  });

  test("rechecks the injected deadline after a local predecessor resolves", async () => {
    const layout = await leaseLayout();
    let firstEntered!: () => void;
    const firstEnteredPromise = new Promise<void>((accept) => { firstEntered = accept; });
    let releaseFirst!: () => void;
    const releaseFirstPromise = new Promise<void>((accept) => { releaseFirst = accept; });
    const first = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 1_000,
      leaseMs: 1_000
    }, async () => {
      firstEntered();
      await releaseFirstPromise;
    });
    await firstEnteredPromise;

    let monotonicMs = 0;
    let entered = false;
    const second = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 1_000,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs
    }, async () => {
      entered = true;
    });
    await delay(25);
    monotonicMs = 1_001;
    releaseFirst();

    await expect(second).rejects.toThrow(/project lease.*timeout|timed out.*project lease/i);
    await first;
    expect(entered).toBe(false);
  });

  test("bounds dead-owner reclaim churn with the original injected deadline", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const deadPid = 2_147_483_647;
    let monotonicMs = 0;
    let generations = 0;
    let entered = false;
    await writeChurnLeaseOwner(template.lockIdentity.path, template, generations, {
      pid: deadPid,
      leaseMs: 100
    });
    vi.spyOn(process, "kill").mockImplementation(() => {
      const error = new Error("no such process") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    });

    const acquiring = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 20_000,
      timeoutMs: 300,
      leaseMs: 100,
      monotonicNow: () => monotonicMs,
      waitForRetry: async () => { monotonicMs += 25; },
      beforeAcquireRetry: async (path: string, reason: string) => {
        expect(reason).toBe("dead-reclaimed");
        generations += 1;
        await writeChurnLeaseOwner(path, template, generations, {
          pid: deadPid,
          leaseMs: 100
        });
        monotonicMs += 75;
      }
    }, async () => {
      entered = true;
    });

    await expect(acquiring).rejects.toThrow(/project lease/i);
    expect(generations).toBeGreaterThan(0);
    expect(entered).toBe(false);
    await rm(template.lockIdentity.path, { force: true });
  });

  test("releases an exact lease created after the injected deadline", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let monotonicMs = 0;
    let entered = false;

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs,
      afterLeaseCreate: async () => { monotonicMs = 101; }
    }, async () => {
      entered = true;
    })).rejects.toThrow(/project lease/i);

    expect(entered).toBe(false);
    await expect(readFile(template.lockIdentity.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("removes the exact created inode when a fallible post-publication hook fails", async () => {
    const layout = await leaseLayout();
    const fault = new Error("post-publication identity hook failed");
    let createdPath = "";
    let entered = false;

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      beforeCreatedPathIdentityCapture: async (path) => {
        createdPath = path;
        throw fault;
      }
    }, async () => { entered = true; })).rejects.toBe(fault);

    expect(entered).toBe(false);
    await expect(lstat(createdPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_001,
      timeoutMs: 500,
      leaseMs: 1_000
    }, async () => "reacquired")).resolves.toBe("reacquired");
  });

  test("retains the exclusively created owner when its post-publication hook remains unresolved", async () => {
    const layout = await leaseLayout();
    let createdPath = "";
    let entered = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 40,
      leaseMs: 1_000,
      beforeCreatedPathIdentityCapture: async (path) => {
        createdPath = path;
        await new Promise<void>(() => undefined);
      }
    }, async () => { entered = true; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      expect.stringMatching(/created-path hook remains unresolved/i),
      expect.stringMatching(/preserving the exact published owner evidence/i)
    ]));
    expect(entered).toBe(false);
    await expect(lstat(createdPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("retains exact owner evidence when post-create work remains unresolved", async () => {
    const layout = await leaseLayout();
    let createdPath = "";
    let entered = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 40,
      leaseMs: 1_000,
      afterLeaseCreate: async (path) => {
        createdPath = path;
        await new Promise<void>(() => undefined);
      }
    }, async () => { entered = true; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      expect.stringMatching(/post-create work remains unresolved/i),
      expect.stringMatching(/preserving the exact created owner evidence/i)
    ]));
    expect(entered).toBe(false);
    await expect(lstat(createdPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("retains exact owner evidence when post-acquisition work remains unresolved", async () => {
    const layout = await leaseLayout();
    let acquiredPath = "";
    let entered = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 40,
      leaseMs: 1_000,
      afterAcquire: async (path) => {
        acquiredPath = path;
        await new Promise<void>(() => undefined);
      }
    }, async () => { entered = true; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      expect.stringMatching(/dispatch work remains unresolved/i),
      expect.stringMatching(/preserving exact owner evidence/i)
    ]));
    expect(entered).toBe(false);
    await expect(lstat(acquiredPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("bounds a pending custom retry wait with the acquisition deadline", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 1);
    let entered = false;
    const acquiring = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 60,
      leaseMs: 1_000,
      waitForRetry: async () => new Promise<void>(() => undefined)
    }, async () => { entered = true; });

    const failure = await deadline(acquiring, 250, "outer pending retry wait")
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/project lease.*timeout/i);
    expect(failure!.message).not.toMatch(/outer pending retry/i);
    expect(entered).toBe(false);
    await rm(template.lockIdentity.path, { force: true });
  });

  test("rechecks the original deadline after acquisition and before callback dispatch", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let monotonicMs = 0;
    let entered = false;

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs,
      afterAcquire: async () => { monotonicMs = 101; }
    }, async () => { entered = true; })).rejects.toThrow(/project lease.*timeout/i);

    expect(entered).toBe(false);
    await expect(readFile(template.lockIdentity.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("revalidates the exact persisted owner after acquisition and before callback dispatch", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const replacementNonce = "0000000000000000000000000000002c";
    let entered = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      afterAcquire: async (path: string) => {
        const replacement = {
          version: 1,
          pid: process.pid,
          nonce: replacementNonce,
          createdAtMs: 10_000,
          renewedAtMs: 10_000,
          leaseMs: 1_000,
          projectDigest: template.projectDigest
        };
        const serialized = Buffer.from(`${JSON.stringify(replacement)}\n`, "utf8");
        await writeFile(path, Buffer.from(serialized.toString("utf8").padEnd(512, " "), "utf8"));
      }
    }, async () => { entered = true; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(entered).toBe(false);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(replacementNonce);
  });

  test("detects an in-place owner rewrite during a bounded assertion read", async () => {
    const layout = await leaseLayout();
    let armed = false;
    let rewritten = false;
    let lockPath = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      afterAcquire: async (path) => { lockPath = path; },
      afterObservedLeaseReadChunk: async (path, offset) => {
        if (!armed || rewritten || offset === 0) return;
        rewritten = true;
        const owner = await readFile(path);
        owner[owner.byteLength - 1] = 0x0a;
        await writeFile(path, owner);
      }
    }, async (lease) => {
      armed = true;
      await lease.assertOwned();
    }).then(() => undefined, (error: Error) => error);

    expect(rewritten).toBe(true);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure).join("\n")).toMatch(/identity changed during bounded read/i);
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("detects a pathname replacement after a bounded owner read", async () => {
    const layout = await leaseLayout();
    let armed = false;
    let replaced = false;
    let lockPath = "";
    let ownedEvidence = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      afterAcquire: async (path) => { lockPath = path; },
      afterObservedLeaseReadChunk: async (path, offset) => {
        if (!armed || replaced || offset === 0) return;
        replaced = true;
        const owner = await readFile(path);
        ownedEvidence = `${path}.bounded-read-evidence`;
        await rename(path, ownedEvidence);
        await writeFile(path, owner, { flag: "wx", mode: 0o600 });
      }
    }, async (lease) => {
      armed = true;
      await lease.assertOwned();
    }).then(() => undefined, (error: Error) => error);

    expect(replaced).toBe(true);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure).join("\n")).toMatch(/identity changed during bounded read/i);
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
    await expect(lstat(ownedEvidence)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("preserves both inodes when the exclusively created lease pathname is replaced before capture", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const ownedEvidence = `${template.lockIdentity.path}.owned-evidence`;
    let entered = false;

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      beforeCreatedPathIdentityCapture: async (path: string) => {
        await rename(path, ownedEvidence);
        await writeChurnLeaseOwner(path, template, 41);
      }
    }, async () => { entered = true; })).rejects.toThrow(/identity|ambiguous/i);

    expect(entered).toBe(false);
    await expect(readFile(ownedEvidence, "utf8")).resolves.toContain(template.projectDigest);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain("00000000000000000000000000000029");
  });

  test("does not dispatch under an exclusively created inode whose persisted owner was rewritten", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const replacementNonce = "0000000000000000000000000000002a";
    let entered = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      beforeCreatedPathIdentityCapture: async (path: string) => {
        const replacement = {
          version: 1,
          pid: process.pid,
          nonce: replacementNonce,
          createdAtMs: 10_000,
          renewedAtMs: 10_000,
          leaseMs: 1_000,
          projectDigest: template.projectDigest
        };
        const serialized = Buffer.from(`${JSON.stringify(replacement)}\n`, "utf8");
        await writeFile(path, Buffer.from(serialized.toString("utf8").padEnd(512, " "), "utf8"));
      }
    }, async () => { entered = true; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(entered).toBe(false);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(replacementNonce);
  });

  test("does not swallow an invalid monotonic clock as a transient observation", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 1);
    let monotonicMs = 0;
    let hookRan = false;
    const retryReasons: string[] = [];

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs,
      waitForRetry: async () => { monotonicMs += 25; },
      beforeObservedLeaseRead: async () => {
        hookRan = true;
        monotonicMs = Number.NaN;
      },
      beforeAcquireRetry: async (_path: string, reason: string) => { retryReasons.push(reason); }
    }, async () => undefined)).rejects.toThrow(/monotonic clock.*invalid/i);

    expect(hookRan).toBe(true);
    expect(retryReasons).toEqual([]);
    await rm(template.lockIdentity.path, { force: true });
  });

  test("checks the acquisition deadline after every observed-owner read chunk", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 1);
    let monotonicMs = 0;
    const offsets: number[] = [];

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 100,
      leaseMs: 1_000,
      monotonicNow: () => monotonicMs,
      waitForRetry: async () => { monotonicMs += 25; },
      afterObservedLeaseReadChunk: async (_path: string, offset: number) => {
        offsets.push(offset);
        monotonicMs = 101;
      }
    }, async () => undefined)).rejects.toThrow(/project lease.*timeout/i);

    expect(offsets).toEqual([512]);
    await rm(template.lockIdentity.path, { force: true });
  });

  test("retries when a conflicting lease disappears after initial observation", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 1);
    let removed = false;
    let retryReason: string | undefined;
    let entered = false;

    await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      beforeObservedLeaseRead: async (path: string) => {
        if (removed) return;
        removed = true;
        await rm(path);
      },
      beforeAcquireRetry: async (_path: string, reason: string) => { retryReason = reason; }
    }, async () => { entered = true; });

    expect(removed).toBe(true);
    expect(retryReason).toBe("transient-observation");
    expect(entered).toBe(true);
  });

  test("joins an in-flight renewal and exposes only the persisted renewed owner", async () => {
    const layout = await leaseLayout();
    let wallTime = 10_000;
    let renewalEntered!: () => void;
    const renewalEnteredPromise = new Promise<void>((accept) => { renewalEntered = accept; });
    let releaseRenewal!: () => void;
    const releaseRenewalPromise = new Promise<void>((accept) => { releaseRenewal = accept; });

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => ++wallTime,
      timeoutMs: 1_000,
      leaseMs: 300,
      afterLeaseCreate: async () => undefined,
      beforeLeaseRenewal: async () => undefined,
      afterLeaseRenewalOpen: async () => undefined,
      afterLeaseRenewalWrite: async () => {
        renewalEntered();
        await releaseRenewalPromise;
      },
      beforeLeaseRelease: async () => undefined,
      afterLeaseReleaseQuarantineRename: async () => undefined
    }, async (lease) => {
      const initialRenewedAt = lease.renewedAtMs;
      expect(lease.pid).toBe(process.pid);
      expect(lease.nonce).toMatch(/^[a-f0-9]{32}$/u);
      expect(lease.createdAtMs).toBe(10_001);
      expect(lease.leaseMs).toBe(300);
      expect(lease.projectDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(lease.lockIdentity.kind).toBe("file");

      await deadline(renewalEnteredPromise, 1_000, "renewal entry");
      let assertionSettled = false;
      const assertion = lease.assertOwned().finally(() => { assertionSettled = true; });
      await delay(5);
      expect(assertionSettled).toBe(false);
      releaseRenewal();
      await assertion;

      expect(lease.renewedAtMs).toBeGreaterThan(initialRenewedAt);
      await expect(readFile(lease.lockIdentity.path, "utf8"))
        .resolves.toContain(`"renewedAtMs":${lease.renewedAtMs}`);
    })).resolves.toBeUndefined();
  });

  test("rejects a zero-progress renewal write and releases only after exact repair", async () => {
    const layout = await leaseLayout();
    let renewalAttempted!: () => void;
    const renewalAttemptedPromise = new Promise<void>((accept) => { renewalAttempted = accept; });
    let lockPath = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 600,
      monotonicNow: () => 0,
      afterAcquire: async (path) => { lockPath = path; },
      writeLeaseRenewal: async (handle: FileHandle) => {
        Object.defineProperty(handle, "sync", {
          configurable: true,
          value: async () => undefined
        });
        renewalAttempted();
        return { bytesWritten: 0 };
      }
    }, async (lease) => {
      await deadline(renewalAttemptedPromise, 1_000, "zero-progress renewal");
      await expect(lease.assertOwned()).rejects.toThrow(/renewal write was incomplete/i);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(errorMessages(failure).join("\n")).toMatch(/renewal write was incomplete/i);
    await expect(lstat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("detects a persisted owner rollback after an otherwise complete renewal write", async () => {
    const layout = await leaseLayout();
    let originalOwner = Buffer.alloc(0);
    let lockPath = "";
    let ownerRolledBack!: () => void;
    const ownerRolledBackPromise = new Promise<void>((accept) => { ownerRolledBack = accept; });
    let injected = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 180,
      afterAcquire: async (path) => {
        lockPath = path;
        originalOwner = await readFile(path);
      },
      afterLeaseRenewalWrite: async (path) => {
        if (injected) return;
        injected = true;
        await writeFile(path, originalOwner);
        ownerRolledBack();
      }
    }, async () => {
      await deadline(ownerRolledBackPromise, 1_000, "renewed owner rollback");
      await delay(10);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(errorMessages(failure).join("\n")).toMatch(/persisted owner.*changed after renewal/i);
    await expect(lstat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("refuses renewal after its exact owner pathname is replaced", async () => {
    const layout = await leaseLayout();
    let lockPath = "";
    let originalOwner = Buffer.alloc(0);
    let ownedEvidence = "";
    let ownerReplaced!: () => void;
    const ownerReplacedPromise = new Promise<void>((accept) => { ownerReplaced = accept; });
    let injected = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 180,
      afterAcquire: async (path) => {
        lockPath = path;
        originalOwner = await readFile(path);
      },
      beforeLeaseRenewal: async (path) => {
        if (injected) return;
        injected = true;
        ownedEvidence = `${path}.pre-renewal-evidence`;
        await rename(path, ownedEvidence);
        await writeFile(path, originalOwner, { flag: "wx", mode: 0o600 });
        ownerReplaced();
      }
    }, async () => {
      await deadline(ownerReplacedPromise, 1_000, "pre-renewal replacement");
      await delay(10);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure).join("\n")).toMatch(/ownership or identity changed before renewal/i);
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
    await expect(lstat(ownedEvidence)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("fails closed when a hard link appears after the renewal handle opens", async () => {
    const layout = await leaseLayout();
    let lockPath = "";
    let externalLink = "";
    let linked!: () => void;
    const linkedPromise = new Promise<void>((accept) => { linked = accept; });
    let injected = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 180,
      afterAcquire: async (path) => { lockPath = path; },
      afterLeaseRenewalOpen: async (path) => {
        if (injected) return;
        injected = true;
        externalLink = `${path}.renewal-hardlink`;
        await link(path, externalLink);
        linked();
      }
    }, async () => {
      await deadline(linkedPromise, 1_000, "renewal hard-link injection");
      await delay(10);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure).join("\n"))
      .toMatch(/security metadata changed before renewal write|unexpected hard-link count/i);
    await expect(lstat(lockPath, { bigint: true })).resolves.toSatisfy((metadata) => metadata.nlink === 2n);
    await expect(lstat(externalLink, { bigint: true })).resolves.toSatisfy((metadata) => metadata.nlink === 2n);
  });

  test("retains both inodes when a failed renewal races with pathname replacement", async () => {
    const layout = await leaseLayout();
    const renewalFault = new Error("renewal replacement fault");
    let lockPath = "";
    let originalOwner = Buffer.alloc(0);
    let ownedEvidence = "";
    let renewalAttempted!: () => void;
    const renewalAttemptedPromise = new Promise<void>((accept) => { renewalAttempted = accept; });
    let injected = false;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 180,
      afterAcquire: async (path) => {
        lockPath = path;
        originalOwner = await readFile(path);
      },
      writeLeaseRenewal: async (handle, bytes, offset) => {
        if (injected) return handle.write(bytes, offset, bytes.byteLength - offset, offset);
        injected = true;
        await handle.write(bytes, offset, Math.min(16, bytes.byteLength - offset), offset);
        ownedEvidence = `${lockPath}.renewal-evidence`;
        await rename(lockPath, ownedEvidence);
        await writeFile(lockPath, originalOwner, { flag: "wx", mode: 0o600 });
        renewalAttempted();
        throw renewalFault;
      }
    }, async () => {
      await deadline(renewalAttemptedPromise, 1_000, "replacement renewal");
      await delay(10);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      renewalFault.message,
      expect.stringMatching(/identity changed.*renewal repair|renewal.*repair.*ambiguous/i)
    ]));
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
    await expect(lstat(ownedEvidence)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("fails closed when the monotonic clock becomes invalid before renewal", async () => {
    const layout = await leaseLayout();
    let corruptClock = false;
    let lockPath = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 180,
      monotonicNow: () => corruptClock ? Number.NaN : performance.now(),
      afterAcquire: async (path) => { lockPath = path; }
    }, async () => {
      corruptClock = true;
      await delay(100);
    }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure).join("\n")).toMatch(/monotonic clock.*invalid/i);
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("bounds a pending renewal attempt and does not reschedule it", async () => {
    const layout = await leaseLayout();
    let renewalCalls = 0;
    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 90,
      beforeLeaseRenewal: async () => {
        renewalCalls += 1;
        await new Promise<void>(() => undefined);
      }
    }, async () => { await delay(220); });

    const failure = await deadline(running, 600, "outer pending renewal")
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/project lease.*(?:renewal|timeout)/i);
    expect(failure!.message).not.toMatch(/outer pending renewal/i);
    expect(renewalCalls).toBe(1);
  });

  test("bounds a never-settling renewal writer and shutdown join while retaining exact evidence", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let writerStarted!: () => void;
    const writerStartedPromise = new Promise<void>((accept) => { writerStarted = accept; });
    let writeCalls = 0;
    let closeCapturedHandle: (() => Promise<void>) | undefined;

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 90,
      writeLeaseRenewal: async (handle: FileHandle) => {
        writeCalls += 1;
        closeCapturedHandle = handle.close.bind(handle);
        writerStarted();
        return new Promise<{ bytesWritten: number }>(() => undefined);
      }
    }, async () => {
      await deadline(writerStartedPromise, 250, "renewal writer start");
      throw new Error("injected project operation primary");
    });

    try {
      const failure = await deadline(running, 650, "outer never-settling renewal writer")
        .then(() => undefined, (error: Error) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      const messages = errorMessages(failure).join("\n");
      expect(messages).toMatch(/injected project operation primary/i);
      expect(messages).toMatch(/lease renewal write chunk.*timeout|timeout.*lease renewal write chunk/i);
      expect(messages).toMatch(/cleanup|ambiguous|unresolved/i);
      expect(messages).not.toMatch(/outer never-settling renewal writer/i);
      expect(writeCalls).toBe(1);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
    } finally {
      await closeCapturedHandle?.().catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("bounds a pending lease-owned native handle close", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let closeCalls = 0;
    let closeCapturedHandle: (() => Promise<void>) | undefined;
    let closeEntered!: () => void;
    const closeEnteredPromise = new Promise<void>((accept) => { closeEntered = accept; });

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 600,
      monotonicNow: () => 0,
      writeLeaseRenewal: async (handle: FileHandle, bytes: Buffer, offset: number) => {
        const written = await handle.write(bytes, offset, bytes.byteLength - offset, offset);
        closeCapturedHandle = handle.close.bind(handle);
        Object.defineProperty(handle, "close", {
          configurable: true,
          value: () => {
            closeCalls += 1;
            closeEntered();
            return new Promise<void>(() => undefined);
          }
        });
        Object.defineProperty(handle, "sync", {
          configurable: true,
          value: async () => undefined
        });
        return written;
      }
    }, async () => {
      await deadline(closeEnteredPromise, 1_000, "renewal handle close entry");
    });

    try {
      const failure = await deadline(running, 1_500, "outer pending native close")
        .then(() => undefined, (error: Error) => error);
      expect(failure).toBeInstanceOf(Error);
      const messages = errorMessages(failure).join("\n");
      expect(messages).toMatch(/renewal handle close.*timeout|timeout.*renewal handle close/i);
      expect(messages).not.toMatch(/outer pending native close/i);
      expect(closeCalls).toBe(1);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
    } finally {
      await closeCapturedHandle?.().catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("does not repair or release while a late renewal writer remains unsettled", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let allowWriter!: () => void;
    const writerGate = new Promise<void>((accept) => { allowWriter = accept; });
    let writerStarted!: () => void;
    const writerStartedPromise = new Promise<void>((accept) => { writerStarted = accept; });
    let productionCloseCompleted!: () => void;
    const productionCloseCompletedPromise = new Promise<void>((accept) => { productionCloseCompleted = accept; });
    let closeCapturedHandle: (() => Promise<void>) | undefined;
    let productionCloseObserved = false;
    let closeCalls = 0;
    let releaseCalls = 0;

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 90,
      writeLeaseRenewal: async (handle: FileHandle, bytes: Buffer, offset: number) => {
        closeCapturedHandle = handle.close.bind(handle);
        Object.defineProperty(handle, "close", {
          configurable: true,
          value: async () => {
            closeCalls += 1;
            await closeCapturedHandle!();
            productionCloseCompleted();
          }
        });
        await handle.write(bytes, offset, bytes.byteLength - offset, offset);
        writerStarted();
        await writerGate;
        throw new Error("injected late renewal writer rejection");
      },
      beforeLeaseRelease: async () => { releaseCalls += 1; }
    }, async () => {
      await deadline(writerStartedPromise, 250, "late renewal writer start");
      await delay(120);
    });

    try {
      const failure = await deadline(running, 650, "outer late renewal writer")
        .then(() => undefined, (error: Error) => error);
      expect(failure).toBeInstanceOf(Error);
      const messages = errorMessages(failure).join("\n");
      expect(messages).toMatch(/lease renewal write chunk.*timeout|timeout.*lease renewal write chunk/i);
      expect(messages).not.toMatch(/outer late renewal writer/i);
      expect(releaseCalls).toBe(0);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
      allowWriter();
      productionCloseObserved = await deadline(productionCloseCompletedPromise, 150, "late writer production close")
        .then(() => true, () => false);
      expect(productionCloseObserved).toBe(true);
      expect(closeCalls).toBe(1);
    } finally {
      allowWriter();
      if (!productionCloseObserved) await closeCapturedHandle?.().catch(() => undefined);
      await running.catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("does not repair or release while a mutation-capable renewal hook remains unsettled", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let allowHook!: () => void;
    const hookGate = new Promise<void>((accept) => { allowHook = accept; });
    let hookStarted!: () => void;
    const hookStartedPromise = new Promise<void>((accept) => { hookStarted = accept; });
    let productionCloseCompleted!: () => void;
    const productionCloseCompletedPromise = new Promise<void>((accept) => { productionCloseCompleted = accept; });
    let closeCapturedHandle: (() => Promise<void>) | undefined;
    let productionCloseObserved = false;
    let closeCalls = 0;
    let releaseCalls = 0;

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 90,
      writeLeaseRenewal: async (handle: FileHandle, bytes: Buffer, offset: number) => {
        closeCapturedHandle = handle.close.bind(handle);
        Object.defineProperty(handle, "close", {
          configurable: true,
          value: async () => {
            closeCalls += 1;
            await closeCapturedHandle!();
            productionCloseCompleted();
          }
        });
        return handle.write(bytes, offset, bytes.byteLength - offset, offset);
      },
      afterLeaseRenewalWrite: async () => {
        hookStarted();
        await hookGate;
      },
      beforeLeaseRelease: async () => { releaseCalls += 1; }
    }, async () => {
      await deadline(hookStartedPromise, 250, "pending renewal hook start");
      await delay(120);
    });

    try {
      const failure = await deadline(running, 650, "outer pending mutation-capable hook")
        .then(() => undefined, (error: Error) => error);
      expect(failure).toBeInstanceOf(Error);
      const messages = errorMessages(failure).join("\n");
      expect(messages).toMatch(/post-renewal write hook.*timeout|timeout.*post-renewal write hook/i);
      expect(messages).not.toMatch(/outer pending mutation-capable hook/i);
      expect(releaseCalls).toBe(0);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
      allowHook();
      productionCloseObserved = await deadline(productionCloseCompletedPromise, 150, "late hook production close")
        .then(() => true, () => false);
      expect(productionCloseObserved).toBe(true);
      expect(closeCalls).toBe(1);
    } finally {
      allowHook();
      if (!productionCloseObserved) await closeCapturedHandle?.().catch(() => undefined);
      await running.catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("stops renewal and later assertions after assertion I/O becomes unresolved", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let armed = false;
    let allowObservation!: () => void;
    const observationGate = new Promise<void>((accept) => { allowObservation = accept; });
    let observationCalls = 0;
    let renewalWrites = 0;

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 90,
      beforeObservedLeaseRead: async () => {
        if (!armed) return;
        observationCalls += 1;
        await observationGate;
      },
      writeLeaseRenewal: async (handle: FileHandle, bytes: Buffer, offset: number) => {
        renewalWrites += 1;
        return handle.write(bytes, offset, bytes.byteLength - offset, offset);
      }
    }, async (lease) => {
      armed = true;
      const firstFailure = await deadline(lease.assertOwned(), 300, "first unresolved assertion")
        .then(() => undefined, (error: Error) => error);
      expect(errorMessages(firstFailure).join("\n")).toMatch(/observed-lease read hook.*timeout|timeout.*observed-lease read hook/i);
      await delay(120);
      const secondFailure = await deadline(lease.assertOwned(), 150, "second unresolved assertion")
        .then(() => undefined, (error: Error) => error);
      expect(errorMessages(secondFailure).join("\n")).toMatch(/unresolved|ambiguous/i);
    });

    try {
      const failure = await deadline(running, 650, "outer unresolved assertion state")
        .then(() => undefined, (error: Error) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(errorMessages(failure).join("\n")).not.toMatch(/outer unresolved assertion state/i);
      expect(observationCalls).toBe(1);
      expect(renewalWrites).toBe(0);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
    } finally {
      allowObservation();
      await running.catch(() => undefined);
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test.each([
    {
      kind: "deadline",
      advance: (setMonotonic: (value: number) => void) => { setMonotonic(101); },
      expected: /project lease.*timeout/i
    },
    {
      kind: "invalid clock",
      advance: (setMonotonic: (value: number) => void) => { setMonotonic(Number.NaN); },
      expected: /monotonic clock.*invalid/i
    }
  ])("preserves a typed $kind failure raised during transient acquisition retry", async ({ advance, expected }) => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeFile(template.lockIdentity.path, Buffer.alloc(0), { flag: "wx", mode: 0o600 });
    let monotonicMs = 0;
    let retryCalls = 0;

    try {
      const failure = await withProcessLease({
        layout,
        projectRoot: project().repository,
        now: () => 10_000,
        timeoutMs: 100,
        leaseMs: 1_000,
        monotonicNow: () => monotonicMs,
        beforeAcquireRetry: async (_path: string, reason: string) => {
          expect(reason).toBe("transient-observation");
          retryCalls += 1;
          advance((value) => { monotonicMs = value; });
        }
      }, async () => undefined).then(() => undefined, (error: Error) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(errorMessages(failure).join("\n")).toMatch(expected);
      expect(errorMessages(failure).join("\n")).not.toMatch(/publication is not complete/i);
      expect(retryCalls).toBe(1);
    } finally {
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("retains both a transient observation and an ordinary retry failure", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeFile(template.lockIdentity.path, Buffer.alloc(0), { flag: "wx", mode: 0o600 });

    try {
      const failure = await withProcessLease({
        layout,
        projectRoot: project().repository,
        now: () => 10_000,
        timeoutMs: 100,
        leaseMs: 1_000,
        beforeAcquireRetry: async () => { throw new Error("injected ordinary retry failure"); }
      }, async () => undefined).then(() => undefined, (error: Error) => error);

      expect(failure).toBeInstanceOf(AggregateError);
      const messages = errorMessages(failure).join("\n");
      expect(messages).toMatch(/publication is not complete/i);
      expect(messages).toMatch(/injected ordinary retry failure/i);
    } finally {
      await rm(template.lockIdentity.path, { force: true });
    }
  });

  test("retains both quarantine inodes when post-rename release work replaces the pathname", async () => {
    const layout = await leaseLayout();
    const releaseFault = new Error("post-quarantine replacement fault");
    let quarantine = "";
    let ownedEvidence = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      afterLeaseReleaseQuarantineRename: async (_path, releasedPath) => {
        quarantine = releasedPath;
        const owner = await readFile(releasedPath);
        ownedEvidence = `${releasedPath}.owned-evidence`;
        await rename(releasedPath, ownedEvidence);
        await writeFile(releasedPath, owner, { flag: "wx", mode: 0o600 });
        throw releaseFault;
      }
    }, async () => undefined).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      releaseFault.message,
      expect.stringMatching(/identity.*changed.*quarantine|release.*reconciliation.*ambiguous/i)
    ]));
    await expect(lstat(quarantine)).resolves.toSatisfy((metadata) => metadata.isFile());
    await expect(lstat(ownedEvidence)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("reports both an operation failure and an independent exact-release failure", async () => {
    const layout = await leaseLayout();
    const operationFault = new Error("operation fault");
    const releaseFault = new Error("release fault");
    let lockPath = "";

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 1_000,
      afterAcquire: async (path) => { lockPath = path; },
      beforeLeaseRelease: async () => { throw releaseFault; }
    }, async () => { throw operationFault; }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(errorMessages(failure)).toEqual(expect.arrayContaining([
      operationFault.message,
      releaseFault.message
    ]));
    await expect(lstat(lockPath)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("bounds a pending final release attempt and preserves the owned lock", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let releaseCalls = 0;
    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 500,
      leaseMs: 100,
      beforeLeaseRelease: async () => {
        releaseCalls += 1;
        await new Promise<void>(() => undefined);
      }
    }, async () => "done");

    const failure = await deadline(running, 500, "outer pending release")
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/project lease.*(?:release|timeout)/i);
    expect(failure!.message).not.toMatch(/outer pending release/i);
    expect(releaseCalls).toBe(1);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain("projectDigest");
    await rm(template.lockIdentity.path, { force: true });
  });

  test("reconciles the exact quarantine when the release deadline expires after rename", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let monotonicMs = 0;
    let entered = false;

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 500,
      leaseMs: 100,
      monotonicNow: () => monotonicMs,
      afterLeaseReleaseQuarantineRename: async () => { monotonicMs = 251; }
    }, async () => {
      entered = true;
      return "done";
    })).rejects.toThrow(/project lease.*timeout/i);

    expect(entered).toBe(true);
    await expect(readFile(template.lockIdentity.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await readdir(layout.locks)).filter((name) => name.startsWith(".task8-release-"))).toEqual([]);
  });

  test("reconciles a persisted renewal before exact final release when its post-write deadline expires", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let monotonicMs = 0;
    let wallMs = 10_000;
    let renewalWrites = 0;

    const running = withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => wallMs++,
      timeoutMs: 500,
      leaseMs: 90,
      monotonicNow: () => monotonicMs,
      afterLeaseRenewalWrite: async () => {
        renewalWrites += 1;
        monotonicMs = 31;
      }
    }, async () => { await delay(120); });

    await expect(running).rejects.toThrow(/project lease.*timeout/i);
    expect(renewalWrites).toBe(1);
    await expect(readFile(template.lockIdentity.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await readdir(layout.locks)).filter((name) => name.startsWith(".task8-release-"))).toEqual([]);
  });

  test("repairs a torn renewal owner before exact release when a later write throws", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    let wallMs = 10_000;
    let writeCalls = 0;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => wallMs++,
      timeoutMs: 500,
      leaseMs: 90,
      writeLeaseRenewal: async (handle: FileHandle, bytes: Buffer, offset: number) => {
        writeCalls += 1;
        if (writeCalls === 1) return handle.write(bytes, offset, 64, offset);
        throw new Error("injected partial renewal write");
      }
    }, async () => { await delay(120); }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/partial renewal write/i);
    expect(writeCalls).toBe(2);
    await expect(readFile(template.lockIdentity.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await readdir(layout.locks)).filter((name) => name.startsWith(".task8-release-"))).toEqual([]);
  });

  test("retains a same-inode owner rewrite between renewal observation and its first write", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const replacementNonce = "0000000000000000000000000000002b";
    let wallMs = 10_000;
    let gapHooks = 0;

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => wallMs++,
      timeoutMs: 500,
      leaseMs: 90,
      afterLeaseRenewalOpen: async (path: string) => {
        gapHooks += 1;
        const replacement = {
          version: 1,
          pid: process.pid,
          nonce: replacementNonce,
          createdAtMs: 10_000,
          renewedAtMs: 10_000,
          leaseMs: 90,
          projectDigest: template.projectDigest
        };
        const serialized = Buffer.from(`${JSON.stringify(replacement)}\n`, "utf8");
        await writeFile(path, Buffer.from(serialized.toString("utf8").padEnd(512, " "), "utf8"));
      }
    }, async () => { await delay(120); }).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(gapHooks).toBe(1);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(replacementNonce);
  });

  test("serializes two Node processes applying to the same canonical project", async () => {
    const api = createTrustedTestKeeper({ cacheDirectory: cache() });
    const path = ".agents/skills/project-design-context/cross-process.md";
    const [first, second] = await Promise.all([
      api.previewUpdate({ root: project().repository, changes: [{ path, managedBlock: { recordId: "first", content: "first" } }] }),
      api.previewUpdate({ root: project().repository, changes: [{ path, managedBlock: { recordId: "second", content: "second" } }] })
    ]);
    const firstWorker = spawnApplyWorker({
      root: project().repository,
      cacheDirectory: cache(),
      changesetId: first.changesetId,
      pauseAtCommit: true
    });
    await firstWorker.waitFor("at-commit");
    const secondWorker = spawnApplyWorker({
      root: project().repository,
      cacheDirectory: cache(),
      changesetId: second.changesetId,
      pauseAtCommit: true
    });

    await secondWorker.waitFor("authorized");
    await expect(secondWorker.waitFor("at-commit", 750)).rejects.toThrow(/timeout/i);
    firstWorker.send("release");
    const firstResult = await firstWorker.result();
    const secondResult = await secondWorker.result();

    expect(firstResult).toMatchObject({ applied: true, changesetId: first.changesetId });
    expect(secondResult).toMatchObject({
      applied: false,
      changesetId: second.changesetId,
      error: expect.stringMatching(/stale/i)
    });
  }, 20_000);

  test("does not serialize live leases for different canonical project roots", async () => {
    const secondProject = await createProjectFixture();
    try {
      const api = createTrustedTestKeeper({ cacheDirectory: cache() });
      const [first, second] = await Promise.all([
        api.previewUpdate({ root: project().repository, changes: [{ path: ".agents/skills/project-design-context/one.md", managedBlock: { recordId: "one", content: "one" } }] }),
        api.previewUpdate({ root: secondProject.repository, changes: [{ path: ".agents/skills/project-design-context/two.md", managedBlock: { recordId: "two", content: "two" } }] })
      ]);
      const firstWorker = spawnApplyWorker({ root: project().repository, cacheDirectory: cache(), changesetId: first.changesetId, pauseAtCommit: true });
      await firstWorker.waitFor("at-commit");
      const secondWorker = spawnApplyWorker({ root: secondProject.repository, cacheDirectory: cache(), changesetId: second.changesetId, pauseAtCommit: true });

      await secondWorker.waitFor("authorized");
      await expect(secondWorker.waitFor("at-commit", 3_000)).resolves.toMatchObject({ event: "at-commit" });
      secondWorker.send("release");
      const secondResult = await secondWorker.result();
      firstWorker.send("release");
      const firstResult = await firstWorker.result();
      expect([firstResult, secondResult]).toEqual([
        expect.objectContaining({ applied: true }),
        expect.objectContaining({ applied: true })
      ]);
    } finally {
      await removeProjectFixture(secondProject);
    }
  }, 20_000);

  test("fails closed when a conflicting owner timestamp is in the future", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 1, {
      renewedAtMs: 10_001,
      leaseMs: 1_000
    });

    const failure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 200,
      leaseMs: 1_000
    }, async () => undefined).then(() => undefined, (error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/timestamp is in the future/i);
    await expect(lstat(template.lockIdentity.path)).resolves.toSatisfy((metadata) => metadata.isFile());
  });

  test("times out on a renewed live lock and does not reclaim a possibly reused live PID", async () => {
    const worker = spawnApplyWorker({ mode: "lease", root: project().repository, cacheDirectory: cache(), timeoutMs: 1_000, leaseMs: 90 });
    await worker.waitFor("at-lock");
    await delay(180);

    await expect(withProcessLease({
      layout: await leaseLayout(),
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 150,
      leaseMs: 90
    }, async () => undefined)).rejects.toThrow(/live|timeout|lease/i);
    worker.send("release");
    await worker.result();
  }, 10_000);

  test("persists strict renewed owner evidence while a real operation outlives its lease", async () => {
    const layout = await leaseLayout();
    const canonical = await realpath(project().repository);
    const digestInput = process.platform === "win32" ? canonical.toLocaleLowerCase("en-US") : canonical;
    const digest = createHash("sha256").update(digestInput, "utf8").digest("hex");
    const lock = join(layout.locks, `task8-${digest}.lock`);
    const worker = spawnApplyWorker({
      mode: "lease",
      root: project().repository,
      cacheDirectory: cache(),
      timeoutMs: 1_000,
      leaseMs: 120
    });
    await worker.waitFor("at-lock");

    const firstBytes = await readFile(lock);
    const first = JSON.parse(firstBytes.toString("utf8").trim()) as Record<string, unknown>;
    const firstMetadata = await lstat(lock, { bigint: true });
    await delay(260);
    const renewedBytes = await readFile(lock);
    const renewed = JSON.parse(renewedBytes.toString("utf8").trim()) as Record<string, unknown>;
    const renewedMetadata = await lstat(lock, { bigint: true });

    expect(firstBytes.byteLength).toBe(512);
    expect(renewedBytes.byteLength).toBe(512);
    expect(Object.keys(first).sort()).toEqual([
      "createdAtMs",
      "leaseMs",
      "nonce",
      "pid",
      "projectDigest",
      "renewedAtMs",
      "version"
    ]);
    expect(Object.keys(renewed).sort()).toEqual(Object.keys(first).sort());
    expect(renewed).toMatchObject({
      version: 1,
      pid: first.pid,
      nonce: first.nonce,
      createdAtMs: first.createdAtMs,
      leaseMs: 120,
      projectDigest: digest
    });
    expect(Number(renewed.renewedAtMs)).toBeGreaterThan(Number(first.renewedAtMs));
    expect(firstMetadata.nlink).toBe(1n);
    expect(renewedMetadata.nlink).toBe(1n);
    if (process.platform !== "win32") {
      expect(Number(firstMetadata.mode & 0o777n)).toBe(0o600);
      expect(Number(renewedMetadata.mode & 0o777n)).toBe(0o600);
      if (typeof process.getuid === "function") {
        expect(firstMetadata.uid).toBe(BigInt(process.getuid()));
        expect(renewedMetadata.uid).toBe(BigInt(process.getuid()));
      }
    }

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 150,
      leaseMs: 120
    }, async () => undefined)).rejects.toThrow(/live|timeout|lease/i);
    worker.send("release");
    await worker.result();
  }, 10_000);

  test("a dead renewed worker remains protected until its persisted renewed expiry", async () => {
    const layout = await leaseLayout();
    const canonical = await realpath(project().repository);
    const digestInput = process.platform === "win32" ? canonical.toLocaleLowerCase("en-US") : canonical;
    const digest = createHash("sha256").update(digestInput, "utf8").digest("hex");
    const lock = join(layout.locks, `task8-${digest}.lock`);
    const leaseMs = 600;
    const worker = spawnApplyWorker({
      mode: "lease",
      root: project().repository,
      cacheDirectory: cache(),
      timeoutMs: 1_000,
      leaseMs,
      pauseAfterRenewal: true
    });
    const locked = await worker.waitFor("at-lock");
    const renewed = await worker.waitFor("renewed", 5_000);
    await worker.crash();
    const persisted = JSON.parse((await readFile(lock, "utf8")).trim()) as Record<string, unknown>;
    const createdAtMs = Number(persisted.createdAtMs);
    const renewedAtMs = Number(persisted.renewedAtMs);
    const protectedNow = Math.max(createdAtMs + leaseMs, renewedAtMs);

    expect(renewed).toMatchObject({
      event: "renewed",
      pid: locked.pid,
      createdAtMs,
      renewedAtMs
    });
    expect(renewedAtMs).toBeGreaterThan(createdAtMs);
    expect(protectedNow).toBeGreaterThanOrEqual(createdAtMs + leaseMs);
    expect(protectedNow).toBeLessThan(renewedAtMs + leaseMs);
    let monotonicMs = 0;
    let retryReason: string | undefined;
    let enteredTooEarly = false;
    const protectedFailure = await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => protectedNow,
      timeoutMs: 1_000,
      leaseMs,
      monotonicNow: () => monotonicMs,
      beforeAcquireRetry: async (_path, reason) => { retryReason = reason; },
      waitForRetry: async () => { monotonicMs = 1_001; }
    }, async () => { enteredTooEarly = true; }).then(() => undefined, (error: Error) => error);
    expect(protectedFailure).toBeInstanceOf(Error);
    expect(errorMessages(protectedFailure).join("\n")).toMatch(/project lease.*timeout/i);
    expect(retryReason).toBe("live-owner");
    expect(enteredTooEarly).toBe(false);
    await expect(readFile(lock, "utf8")).resolves.toContain(String(persisted.nonce));

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => renewedAtMs + leaseMs,
      timeoutMs: 1_000,
      leaseMs
    }, async () => "reclaimed after renewed expiry")).resolves.toBe("reclaimed after renewed expiry");
  }, 10_000);

  test("reclaims an expired lock only after its real owner process is dead", async () => {
    const layout = await leaseLayout();
    const canonical = await realpath(project().repository);
    const digestInput = process.platform === "win32" ? canonical.toLocaleLowerCase("en-US") : canonical;
    const lock = join(layout.locks, `task8-${createHash("sha256").update(digestInput, "utf8").digest("hex")}.lock`);
    const worker = spawnApplyWorker({ mode: "lease", root: project().repository, cacheDirectory: cache(), timeoutMs: 1_000, leaseMs: 75 });
    const locked = await worker.waitFor("at-lock");
    await expect(readFile(lock, "utf8")).resolves.toContain(`"pid":${locked.pid}`);
    await worker.crash();
    await expect(readFile(lock, "utf8")).resolves.toContain("projectDigest");
    await delay(120);

    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => Date.now(),
      timeoutMs: 1_000,
      leaseMs: 75
    }, async () => "reclaimed")).resolves.toBe("reclaimed");
  }, 10_000);

  test("fails closed for malformed and ambiguous stale lock state", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeFile(template.lockIdentity.path, "{", { mode: 0o600 });
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 20_000,
      timeoutMs: 100,
      leaseMs: 100
    }, async () => undefined)).rejects.toThrow(/invalid|malformed|ambiguous/i);
    await rm(template.lockIdentity.path);

    const ambiguousOwner = {
      version: 1,
      pid: 2_147_483_647,
      nonce: "a".repeat(32),
      createdAtMs: 1_000,
      renewedAtMs: 1_000,
      leaseMs: 100,
      projectDigest: template.projectDigest
    };
    await writeFile(template.lockIdentity.path, `${JSON.stringify(ambiguousOwner)}\n`, { mode: 0o600 });
    vi.spyOn(process, "kill").mockImplementation(() => {
      const error = new Error("permission denied") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    });
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 20_000,
      timeoutMs: 100,
      leaseMs: 100
    }, async () => undefined)).rejects.toThrow(/ambiguous|refus/i);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(ambiguousOwner.nonce);
  });

  test("fails closed and retains owner evidence with missing or extra lease keys", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    for (const mutation of ["missing", "extra"] as const) {
      await writeChurnLeaseOwner(template.lockIdentity.path, template, mutation === "missing" ? 10 : 11);
      const owner = JSON.parse((await readFile(template.lockIdentity.path, "utf8")).trim()) as Record<string, unknown>;
      if (mutation === "missing") delete owner.leaseMs;
      else owner.unexpected = true;
      const serialized = Buffer.from(`${JSON.stringify(owner)}\n`, "utf8");
      await writeFile(
        template.lockIdentity.path,
        Buffer.from(serialized.toString("utf8").padEnd(512, " "), "utf8")
      );
      let entered = false;
      await expect(withProcessLease({
        layout,
        projectRoot: project().repository,
        now: () => 10_000,
        timeoutMs: 5_000,
        leaseMs: 1_000
      }, async () => { entered = true; })).rejects.toThrow(/owner metadata.*invalid|ambiguous/i);
      expect(entered).toBe(false);
      await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(String(owner.nonce));
      await rm(template.lockIdentity.path);
    }
  });

  test.skipIf(process.platform === "win32")("fails closed and retains a lease with non-owner-only mode", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 12);
    await chmod(template.lockIdentity.path, 0o644);
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 5_000,
      leaseMs: 1_000
    }, async () => undefined)).rejects.toThrow(/owner-only|permissions/i);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
  });

  test("fails closed and retains a lease with an unexpected hard link", async () => {
    const layout = await leaseLayout();
    const template = await lockTemplate(layout);
    const linked = join(layout.locks, "task8-owner-evidence.link");
    await writeChurnLeaseOwner(template.lockIdentity.path, template, 13);
    await link(template.lockIdentity.path, linked);
    await expect(withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 10_000,
      timeoutMs: 5_000,
      leaseMs: 1_000
    }, async () => undefined)).rejects.toThrow(/hard-link|link count/i);
    await expect(readFile(template.lockIdentity.path, "utf8")).resolves.toContain(template.projectDigest);
    await expect(readFile(linked, "utf8")).resolves.toContain(template.projectDigest);
  });
});

describe("cross-process recovery publication", () => {
  test("uses collision-free recovery names across processes", async () => {
    const epoch = 100_000;
    const api = createTrustedTestKeeper({ cacheDirectory: cache(), now: () => epoch });
    const previews = await Promise.all(["one", "two"].map((name) => api.previewUpdate({
      root: project().repository,
      changes: [{ path: `.agents/skills/project-design-context/${name}.md`, managedBlock: { recordId: name, content: name } }]
    })));
    const applying = previews.map((preview) => spawnApplyWorker({
      root: project().repository,
      cacheDirectory: cache(),
      changesetId: preview.changesetId,
      nowMs: epoch,
      pauseAfterAuthorization: true
    }));

    await Promise.all(applying.map((worker) => worker.waitFor("authorized")));
    applying.forEach((worker) => worker.send("apply"));
    const results = await Promise.all(applying.map((worker) => worker.result()));
    const names = await recoveryNames();

    expect(results).toEqual([expect.objectContaining({ applied: true }), expect.objectContaining({ applied: true })]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(2);
    expect(names.every((name) => /^[0-9]+-[0-9a-f-]+-[0-9a-f-]+\.json$/u.test(name))).toBe(true);
  }, 20_000);

  test("binds a lease path to the digest of the canonical project root", async () => {
    const layout = await leaseLayout();
    let lease!: ProjectLease;
    await withProcessLease({
      layout,
      projectRoot: project().repository,
      now: () => 1_000,
      timeoutMs: 500,
      leaseMs: 100
    }, async (owned) => { lease = owned; });
    const canonical = await realpath(project().repository);
    const digestInput = process.platform === "win32" ? canonical.toLocaleLowerCase("en-US") : canonical;
    const expectedDigest = createHash("sha256").update(digestInput, "utf8").digest("hex");

    expect(lease).toMatchObject({ pid: process.pid, projectDigest: expectedDigest, createdAtMs: 1_000, renewedAtMs: 1_000 });
    expect(lease.nonce).toMatch(/^[a-f0-9]{32}$/u);
    expect(basename(lease.lockIdentity.path)).toContain(expectedDigest);
  });
});
