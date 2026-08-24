import { createInterface } from "node:readline";
import { createProjectDesignKeeper } from "../../src/index.ts";
import { prepareSecureCache } from "../../src/security/cache.ts";
import { withProcessLease } from "../../src/security/process-lock.ts";

const configuration = JSON.parse(process.argv[2] ?? "{}");

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function errorEvidence(error) {
  if (!(error instanceof Error)) return [String(error)];
  const nested = error instanceof AggregateError
    ? error.errors.flatMap((candidate) => errorEvidence(candidate))
    : error.cause
      ? errorEvidence(error.cause)
      : [];
  return [error.message, ...nested];
}

function waitForCommand(expected) {
  return new Promise((resolve, reject) => {
    const input = createInterface({ input: process.stdin });
    const timeout = setTimeout(() => {
      input.close();
      reject(new Error("worker release timeout"));
    }, 10_000);
    input.once("line", (line) => {
      clearTimeout(timeout);
      input.close();
      if (line.trim() !== expected) reject(new Error("worker received an invalid command"));
      else resolve();
    });
  });
}

async function runApply() {
  const now = Number.isSafeInteger(configuration.nowMs)
    ? () => configuration.nowMs
    : undefined;
  const keeper = createProjectDesignKeeper({
    cacheDirectory: configuration.cacheDirectory,
    trustedApprovalProvider: async () => {
      emit({ event: "authorized", pid: process.pid });
      if (configuration.pauseAfterAuthorization) await waitForCommand("apply");
      return { approved: true };
    },
    ...(now ? { now } : {}),
    ...(Number.isSafeInteger(configuration.timeoutMs)
      ? { processLeaseTimeoutMs: configuration.timeoutMs }
      : {}),
    ...(Number.isSafeInteger(configuration.leaseMs)
      ? { processLeaseMs: configuration.leaseMs }
      : {}),
    ...(configuration.pauseAtCommit
      ? {
          beforeCommit: async () => {
            emit({ event: "at-commit", pid: process.pid });
            await waitForCommand("release");
          }
        }
      : {
          beforeCommit: async () => {
            emit({ event: "at-commit", pid: process.pid });
          }
        })
  });
  return keeper.applyUpdate({
    root: configuration.root,
    changesetId: configuration.changesetId
  });
}

async function runLease() {
  const layout = await prepareSecureCache({ cacheDirectory: configuration.cacheDirectory }, configuration.root);
  return withProcessLease({
    layout,
    projectRoot: configuration.root,
    now: () => Date.now(),
    timeoutMs: configuration.timeoutMs,
    leaseMs: configuration.leaseMs
  }, async () => {
    emit({ event: "at-lock", pid: process.pid });
    await waitForCommand("release");
    return { released: true };
  });
}

try {
  const result = configuration.mode === "lease" ? await runLease() : await runApply();
  emit({ event: "result", result });
} catch (error) {
  emit({
    event: "result",
    result: {
      applied: false,
      changesetId: configuration.changesetId,
      error: error instanceof Error ? error.message : String(error),
      evidence: errorEvidence(error)
    }
  });
  process.exitCode = 1;
}
