import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, opendir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageParent = resolve(root, ".package");
const target = resolve(packageParent, "project-design-keeper");
const allowlist = [".codex-plugin", ".mcp.json", "dist", "skills", "package.json"];
const textSuffixes = [".js", ".json", ".md", ".md.template", ".yaml", ".yml"];
const maximumEntries = 256;
const maximumDepth = 16;
const maximumFileBytes = 16 * 1024 * 1024;
const maximumTotalBytes = 64 * 1024 * 1024;

function samePath(left, right) {
  const normalize = (value) => process.platform === "win32"
    ? resolve(value).toLocaleLowerCase("en-US")
    : resolve(value);
  return normalize(left) === normalize(right);
}

function assertDirectChild(parent, candidate, label) {
  const nested = relative(parent, candidate);
  if (!nested || nested === ".." || nested.startsWith(`..${sep}`) || dirname(candidate) !== parent) {
    throw new Error(`${label} escaped its expected parent: ${candidate}`);
  }
}

function sameIdentity(left, right) {
  return BigInt(left.dev) === BigInt(right.dev) && BigInt(left.ino) === BigInt(right.ino);
}

function sameFileIdentity(left, right) {
  return sameIdentity(left, right) &&
    BigInt(left.nlink) === BigInt(right.nlink) &&
    BigInt(left.size) === BigInt(right.size) &&
    BigInt(left.mtimeNs) === BigInt(right.mtimeNs) &&
    BigInt(left.ctimeNs) === BigInt(right.ctimeNs);
}

async function secureDirectory(path, label) {
  const metadata = await lstat(path, { bigint: true });
  if (metadata.isSymbolicLink()) throw new Error(`${label} must not be a reparse point or symbolic link: ${path}`);
  if (!metadata.isDirectory()) throw new Error(`${label} must be a directory: ${path}`);
  const canonical = await realpath(path);
  if (!samePath(path, canonical)) throw new Error(`${label} must not resolve through a reparse point or symbolic link: ${path}`);
  return metadata;
}

async function assertDirectoryIdentity(path, expected, label) {
  const actual = await secureDirectory(path, label);
  if (!sameIdentity(actual, expected)) throw new Error(`${label} changed identity during packaging: ${path}`);
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function createByteBudget(label) {
  let used = 0;
  return {
    consume(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`${label} byte accounting is invalid`);
      if (used + bytes > maximumTotalBytes) {
        throw new Error(`${label} bytes exceed the aggregate limit of ${maximumTotalBytes}`);
      }
      used += bytes;
    }
  };
}

async function readBoundedFile(path, label, budget) {
  const beforePath = await lstat(path, { bigint: true });
  if (beforePath.isSymbolicLink()) throw new Error(`${label} is a reparse point or symbolic link: ${path}`);
  if (!beforePath.isFile()) throw new Error(`${label} is not a regular file: ${path}`);
  if (beforePath.nlink !== 1n) throw new Error(`${label} is hard linked with link count ${beforePath.nlink}: ${path}`);
  if (beforePath.size < 0n || beforePath.size > BigInt(maximumFileBytes)) {
    throw new Error(`${label} size exceeds the per-file limit of ${maximumFileBytes} bytes: ${path}`);
  }
  if (!samePath(path, await realpath(path))) throw new Error(`${label} resolves through a reparse point or symbolic link: ${path}`);
  const expected = Number(beforePath.size);
  budget.consume(expected);
  const handle = await open(path, "r");
  let contents;
  try {
    const beforeHandle = await handle.stat({ bigint: true });
    if (!beforeHandle.isFile() || beforeHandle.isSymbolicLink() || !sameFileIdentity(beforePath, beforeHandle)) {
      throw new Error(`${label} changed identity before its bounded read: ${path}`);
    }
    contents = Buffer.alloc(expected);
    let offset = 0;
    while (offset < expected) {
      const read = await handle.read(contents, offset, Math.min(64 * 1024, expected - offset), offset);
      if (read.bytesRead <= 0) throw new Error(`${label} ended during its bounded read: ${path}`);
      offset += read.bytesRead;
    }
    const overflow = Buffer.alloc(1);
    if ((await handle.read(overflow, 0, 1, expected)).bytesRead !== 0) {
      throw new Error(`${label} grew during its bounded read: ${path}`);
    }
    const afterHandle = await handle.stat({ bigint: true });
    if (!sameFileIdentity(beforeHandle, afterHandle)) throw new Error(`${label} changed identity during its bounded read: ${path}`);
  } finally {
    await handle.close();
  }
  const afterPath = await lstat(path, { bigint: true });
  if (afterPath.isSymbolicLink() || !afterPath.isFile() || !sameFileIdentity(beforePath, afterPath)) {
    throw new Error(`${label} changed pathname identity after its bounded read: ${path}`);
  }
  return {
    contents,
    digest: createHash("sha256").update(contents).digest("hex"),
    identity: beforePath
  };
}

async function captureTree(directory, label, selectedTopLevel) {
  await secureDirectory(directory, `${label} root`);
  const byteBudget = createByteBudget(label);
  const entries = [];
  let count = 0;

  const capture = async (path, name, depth) => {
    if (depth > maximumDepth) {
      throw new Error(`${label} depth exceeds the limit of ${maximumDepth}: ${name}`);
    }
    count += 1;
    if (count > maximumEntries) {
      throw new Error(`${label} entries exceed the limit of ${maximumEntries} items`);
    }
    const metadata = await lstat(path, { bigint: true });
    if (metadata.isSymbolicLink()) throw new Error(`${label} contains a reparse point or symbolic link: ${name}`);
    if (metadata.isDirectory()) {
      if (!samePath(path, await realpath(path))) throw new Error(`${label} directory resolves through a reparse point: ${name}`);
      entries.push({ path: name, kind: "directory", identity: metadata });
      const handle = await opendir(path);
      for await (const entry of handle) {
        await capture(resolve(path, entry.name), `${name}/${entry.name}`, depth + 1);
      }
      return;
    }
    if (!metadata.isFile()) throw new Error(`${label} contains an unknown non-regular entry: ${name}`);
    const evidence = await readBoundedFile(path, `${label.replace(/ inventory$/u, "")} file ${name}`, byteBudget);
    entries.push({ path: name, kind: "file", ...evidence });
  };

  if (selectedTopLevel) {
    for (const name of [...selectedTopLevel].sort()) await capture(resolve(directory, name), name, 1);
  } else {
    const handle = await opendir(directory);
    for await (const entry of handle) await capture(resolve(directory, entry.name), entry.name, 1);
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en-US"));
}

function assertSameSnapshot(expected, observed, label) {
  if (expected.length !== observed.length) throw new Error(`${label} entry count changed`);
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = observed[index];
    if (left.path !== right.path || left.kind !== right.kind || !sameIdentity(left.identity, right.identity)) {
      throw new Error(`${label} identity changed: ${left.path}`);
    }
    if (left.kind === "file" && (!sameFileIdentity(left.identity, right.identity) || left.digest !== right.digest)) {
      throw new Error(`${label} file content or identity changed: ${left.path}`);
    }
  }
}

function normalizedContents(path, contents) {
  if (!textSuffixes.some((suffix) => path.toLowerCase().endsWith(suffix))) return contents;
  return Buffer.from(contents.toString("utf8").replace(/\r\n?/gu, "\n"), "utf8");
}

function expectedPackageSnapshot(sourceSnapshot) {
  return sourceSnapshot.map((entry) => entry.kind === "directory"
    ? { path: entry.path, kind: entry.kind }
    : {
        path: entry.path,
        kind: entry.kind,
        contents: normalizedContents(entry.path, entry.contents),
        digest: createHash("sha256").update(normalizedContents(entry.path, entry.contents)).digest("hex")
      });
}

function assertSamePackageLayout(expected, observed, label) {
  if (expected.length !== observed.length) throw new Error(`${label} entry count changed`);
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = observed[index];
    if (left.path !== right.path || left.kind !== right.kind || (left.kind === "file" && left.digest !== right.digest)) {
      throw new Error(`${label} layout or content changed: ${left.path}`);
    }
  }
}

async function removeCapturedTree(directory, rootIdentity, snapshot, label) {
  const budget = createByteBudget(`${label} cleanup`);
  for (const entry of snapshot.filter((candidate) => candidate.kind === "file")) {
    const path = resolve(directory, ...entry.path.split("/"));
    const observed = await readBoundedFile(path, `${label} cleanup file ${entry.path}`, budget);
    if (!sameFileIdentity(entry.identity, observed.identity) || entry.digest !== observed.digest) {
      throw new Error(`${label} cleanup file changed before deletion: ${entry.path}`);
    }
    // Node exposes only pathname deletion. The immediately preceding handle-bound
    // identity check and non-recursive cleanup constrain the remaining syscall window.
    await unlink(path);
  }
  const directories = snapshot
    .filter((candidate) => candidate.kind === "directory")
    .sort((left, right) => right.path.split("/").length - left.path.split("/").length);
  for (const entry of directories) {
    const path = resolve(directory, ...entry.path.split("/"));
    await assertDirectoryIdentity(path, entry.identity, `${label} cleanup directory ${entry.path}`);
    await rmdir(path);
  }
  await assertDirectoryIdentity(directory, rootIdentity, `${label} cleanup root`);
  await rmdir(directory);
}

async function waitAtTestBarrier(phase, metadata = {}) {
  const configuredBarrier = process.env.KEEPER_PACKAGE_TEST_BARRIER;
  if (!configuredBarrier) return;
  const configuredPhase = process.env.KEEPER_PACKAGE_TEST_BARRIER_PHASE ?? "before-cleanup";
  if (!["before-cleanup", "before-quarantine-rename", "after-quarantine-rename"].includes(configuredPhase)) {
    throw new Error(`Unknown package test barrier phase: ${configuredPhase}`);
  }
  if (configuredPhase !== phase) return;
  const configuredTestRoot = process.env.KEEPER_PACKAGE_TEST_ROOT;
  if (process.env.NODE_ENV !== "test" || !configuredTestRoot || !samePath(configuredTestRoot, root)) {
    throw new Error("Package test barrier requires NODE_ENV=test and the exact package fixture root");
  }
  const barrier = resolve(configuredBarrier);
  assertDirectChild(root, barrier, "Package test barrier");
  const barrierIdentity = await secureDirectory(barrier, "Package test barrier");
  await writeFile(resolve(barrier, "entered"), `${JSON.stringify({ phase, ...metadata })}\n`, { flag: "wx" });
  const deadline = Date.now() + 30_000;
  while (!(await pathExists(resolve(barrier, "release")))) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for package test barrier release");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  await assertDirectoryIdentity(barrier, barrierIdentity, "Package test barrier");
}

assertDirectChild(root, packageParent, "Package parent");
assertDirectChild(packageParent, target, "Package target");
const rootIdentity = await secureDirectory(root, "Plugin root");
const sourceSnapshot = await captureTree(root, "Package source inventory", allowlist);
const expectedPackage = expectedPackageSnapshot(sourceSnapshot);
const assertSourceUnchanged = async (phase) => {
  await assertDirectoryIdentity(root, rootIdentity, `Plugin root ${phase}`);
  const observed = await captureTree(root, `Package source inventory ${phase}`, allowlist);
  assertSameSnapshot(sourceSnapshot, observed, `Package source ${phase}`);
};
await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
if (!(await pathExists(packageParent))) await mkdir(packageParent);
const parentIdentity = await secureDirectory(packageParent, "Package parent");
await assertDirectoryIdentity(root, rootIdentity, "Plugin root");

if (await pathExists(target)) {
  const existingTargetIdentity = await secureDirectory(target, "Existing package target");
  const existingSnapshot = await captureTree(target, "Existing package target inventory");
  await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
  await waitAtTestBarrier("before-cleanup", { targetPath: target });
  await assertSourceUnchanged("before existing-package cleanup");
  await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
  await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
  await assertDirectoryIdentity(target, existingTargetIdentity, "Existing package target");
  assertSameSnapshot(existingSnapshot, await captureTree(target, "Existing package target inventory"), "Existing package target");
  const quarantine = resolve(packageParent, `.project-design-keeper.cleanup-${randomUUID()}`);
  assertDirectChild(packageParent, quarantine, "Package cleanup quarantine");
  await waitAtTestBarrier("before-quarantine-rename", { targetPath: target, quarantinePath: quarantine });
  await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
  await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
  await assertDirectoryIdentity(target, existingTargetIdentity, "Existing package target");
  assertSameSnapshot(existingSnapshot, await captureTree(target, "Existing package target inventory"), "Existing package target");
  if (await pathExists(quarantine)) throw new Error(`Random package cleanup quarantine already exists: ${quarantine}`);
  await rename(target, quarantine);
  await waitAtTestBarrier("after-quarantine-rename", { targetPath: target, quarantinePath: quarantine });
  await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
  await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
  if (await pathExists(target)) throw new Error(`Package target was replaced during cleanup: ${target}`);
  await assertDirectoryIdentity(quarantine, existingTargetIdentity, "Package cleanup quarantine");
  assertSameSnapshot(existingSnapshot, await captureTree(quarantine, "Package cleanup quarantine inventory"), "Package cleanup quarantine");
  await removeCapturedTree(quarantine, existingTargetIdentity, existingSnapshot, "Package cleanup quarantine");
  await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
  await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
  if (await pathExists(quarantine)) throw new Error(`Package cleanup quarantine remained after bounded cleanup: ${quarantine}`);
  if (await pathExists(target)) throw new Error(`Package target was replaced after bounded cleanup: ${target}`);
}

await assertSourceUnchanged("before new-package copy");
await mkdir(target);
const targetIdentity = await secureDirectory(target, "New package target");
await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
for (const entry of expectedPackage.filter((candidate) => candidate.kind === "directory")
  .sort((left, right) => left.path.split("/").length - right.path.split("/").length)) {
  await mkdir(resolve(target, ...entry.path.split("/")));
}
for (const entry of expectedPackage.filter((candidate) => candidate.kind === "file")) {
  await writeFile(resolve(target, ...entry.path.split("/")), entry.contents, { flag: "wx" });
}
await assertDirectoryIdentity(root, rootIdentity, "Plugin root");
await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
await assertDirectoryIdentity(target, targetIdentity, "New package target");
const packagedSnapshot = await captureTree(target, "New package target inventory");
assertSamePackageLayout(expectedPackage, packagedSnapshot, "New package target");
await assertSourceUnchanged("after new-package copy");
await assertDirectoryIdentity(packageParent, parentIdentity, "Package parent");
await assertDirectoryIdentity(target, targetIdentity, "Normalized package target");
process.stdout.write(`${target}\n`);
