import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pluginName = "project-design-keeper";
const repositoryURL = "https://github.com/EverfIRE/ProjectDesignKeeper";
const publisherURL = "https://github.com/EverfIRE";
const archiveHash = ["bf32", "d41b"].join("");
const execFile = promisify(execFileCallback);

async function readJSON(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function exists(relativePath) {
  try {
    await stat(path.join(repoRoot, relativePath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function repositoryPaths(directory = repoRoot) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".package", "coverage", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(repoRoot, absolute).replaceAll("\\", "/");
    results.push(relative);
    if (entry.isDirectory()) results.push(...(await repositoryPaths(absolute)));
  }
  return results;
}

async function treeFiles(root, directory = root) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await treeFiles(root, absolute)));
    if (entry.isFile()) results.push(path.relative(root, absolute).replaceAll("\\", "/"));
  }
  return results.sort();
}

test("repo marketplace resolves the installable release package", async () => {
  const marketplace = await readJSON(".agents/plugins/marketplace.json");
  assert.equal(marketplace.name, pluginName);
  assert.equal(marketplace.interface.displayName, "Project Design Keeper");
  assert.deepEqual(marketplace.plugins, [
    {
      name: pluginName,
      source: {
        source: "local",
        path: `./plugins/${pluginName}`,
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Developer Tools",
    },
  ]);

  assert.equal(await exists(`plugins/${pluginName}/.codex-plugin/plugin.json`), true);
  assert.equal(await exists(`plugins/${pluginName}/dist/index.js`), true);
});

test("release and complete source are separate trees", async () => {
  assert.equal(await exists("source/src/index.ts"), true);
  assert.equal(await exists("source/test"), true);
  assert.equal(await exists("source/scripts/package-plugin.mjs"), true);
  assert.equal(await exists(`plugins/${pluginName}/src`), false);
  assert.equal(await exists(`plugins/${pluginName}/test`), false);
  assert.equal(await exists(`plugins/${pluginName}/scripts`), false);

  const releasePackage = await readJSON(`plugins/${pluginName}/package.json`);
  assert.equal(releasePackage.name, pluginName);
  assert.equal(releasePackage.version, "1.0.0");
});

test("committed release exactly matches the source packager output", async () => {
  const sourceRoot = path.join(repoRoot, "source");
  await execFile(process.execPath, [path.join(sourceRoot, "scripts/package-plugin.mjs")], {
    cwd: sourceRoot,
  });

  const builtRoot = path.join(sourceRoot, ".package", pluginName);
  const releaseRoot = path.join(repoRoot, "plugins", pluginName);
  const builtFiles = await treeFiles(builtRoot);
  const releaseFiles = await treeFiles(releaseRoot);
  assert.deepEqual(releaseFiles, builtFiles);
  for (const relativePath of builtFiles) {
    assert.deepEqual(
      await readFile(path.join(releaseRoot, relativePath)),
      await readFile(path.join(builtRoot, relativePath)),
      `${relativePath} differs from the source packager output`,
    );
  }
});

test("published plugin metadata uses stable repository URLs", async () => {
  for (const manifestPath of [
    `plugins/${pluginName}/.codex-plugin/plugin.json`,
    "source/.codex-plugin/plugin.json",
  ]) {
    const manifest = await readJSON(manifestPath);
    assert.equal(manifest.name, pluginName);
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.author.url, publisherURL);
    assert.equal(manifest.homepage, repositoryURL);
    assert.equal(manifest.repository, repositoryURL);
    assert.equal(manifest.interface.websiteURL, repositoryURL);
  }

  const sourcePackage = await readJSON("source/package.json");
  assert.deepEqual(sourcePackage.author, { name: "EverfIRE", url: publisherURL });
  assert.equal(sourcePackage.homepage, `${repositoryURL}#readme`);
  assert.deepEqual(sourcePackage.repository, {
    type: "git",
    url: `${repositoryURL}.git`,
    directory: "source",
  });
  assert.deepEqual(sourcePackage.bugs, { url: `${repositoryURL}/issues` });
});

test("public distribution contains no generated hash suffix", async () => {
  const paths = await repositoryPaths();
  const hashSuffixed = paths.filter((entry) =>
    entry.split("/").some((part) => /-[a-f0-9]{8}(?:\.|$)/iu.test(part)),
  );
  assert.deepEqual(hashSuffixed, []);

  for (const relativePath of paths) {
    const absolute = path.join(repoRoot, relativePath);
    if (!(await stat(absolute)).isFile()) continue;
    const bytes = await readFile(absolute);
    assert.equal(
      bytes.includes(Buffer.from(archiveHash, "utf8")),
      false,
      `${relativePath} contains the generated archive hash`,
    );
  }
});
