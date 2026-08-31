import { spawn } from "node:child_process";
import { rename, stat, writeFile } from "node:fs/promises";
import { createCursorCodec } from "../../src/security/cursor.js";

const stoppableDescendantProgram = String.raw`
const { readFileSync, writeFileSync } = require("node:fs");
const [stopPath, stoppedPath, nonce] = process.argv.slice(1);
const command = nonce + "\n";
const interval = setInterval(() => {
  try {
    if (readFileSync(stopPath, "utf8") !== command) return;
    clearInterval(interval);
    try {
      writeFileSync(stoppedPath, command, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST" || readFileSync(stoppedPath, "utf8") !== command) throw error;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}, 10);
`;

async function waitForBarrier(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      await stat(path);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (Date.now() >= deadline) throw new Error("cursor child barrier timed out");
    await new Promise<void>((accept) => setTimeout(accept, 10));
  }
}

async function publishReadyRecord(path: string, content: string, delayBeforePublish: boolean): Promise<void> {
  const stagingPath = `${path}.writing-${process.pid}`;
  await writeFile(stagingPath, content, { encoding: "utf8", flag: "wx" });
  if (delayBeforePublish) {
    await new Promise<void>((accept) => setTimeout(accept, 100));
  }
  await rename(stagingPath, path);
}

async function main(): Promise<void> {
  const [action, cacheDirectory, value, ...actionArguments] = process.argv.slice(2);
  if (!action || !cacheDirectory || value === undefined) throw new Error("cursor child arguments are incomplete");
  if (action === "hang-with-descendant") {
    const [readyPath, nonce, stopPath, stoppedPath, recordMode = "valid"] = actionArguments;
    if (!readyPath || !nonce || !stopPath || !stoppedPath) {
      throw new Error("cursor hanging-child control arguments are incomplete");
    }
    if (
      recordMode !== "valid"
      && recordMode !== "delayed-valid"
      && recordMode !== "malformed-json"
      && recordMode !== "nonce-mismatch"
    ) {
      throw new Error("cursor hanging-child record mode is invalid");
    }
    const descendant = spawn(process.execPath, [
      "-e",
      stoppableDescendantProgram,
      stopPath,
      stoppedPath,
      nonce
    ], {
      detached: process.platform === "win32",
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
    if (!descendant.pid) throw new Error("cursor descendant did not receive a PID");
    const record = recordMode === "malformed-json"
      ? "{malformed"
      : JSON.stringify({
        parentPid: process.pid,
        descendantPid: descendant.pid,
        nonce: recordMode === "nonce-mismatch" ? `${nonce}-mismatch` : nonce
      });
    await publishReadyRecord(readyPath, record, recordMode === "delayed-valid");
    await new Promise<void>(() => undefined);
  } else if (action === "create-after-barrier") {
    const [barrier, ready] = actionArguments;
    if (!barrier || !ready) throw new Error("cursor child barrier arguments are incomplete");
    await writeFile(ready, `${process.pid}\n`, { encoding: "utf8", flag: "wx" });
    await waitForBarrier(barrier);
  } else if (action !== "create" && action !== "decode") {
    throw new Error("cursor child action is invalid");
  }
  const codec = await createCursorCodec({ cacheDirectory });
  if (action === "decode") {
    process.stdout.write(JSON.stringify(codec.decode(value, (payload) => payload)));
    return;
  }
  process.stdout.write(codec.encode(JSON.parse(value) as Record<string, unknown>));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "cursor child failed"}\n`);
  process.exitCode = 1;
});
