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

test("repo bundle source resolves the installable release package", async () => {
  const patch = await readFile(path.join(repoRoot, "source", "cordis.patch.yml"), "utf8");
  assert.match(patch, /name: project-design-keeper/u);
  assert.match(patch, /@deepseek-ai\/dsh-skill-filesystem/u);
  assert.doesNotMatch(patch, /codex|marketplace|mcp/iu);

  assert.equal(await exists(`plugins/${pluginName}/dist/plugin.js`), true);
  assert.equal(await exists(`plugins/${pluginName}/cordis.patch.yml`), true);
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
  assert.equal(releasePackage.version, "1.0.1");
  assert.equal(releasePackage.main, "dist/plugin.js");
  assert.equal(releasePackage.dsh?.bundle?.patch, "./cordis.patch.yml");
  assert.equal(Object.hasOwn(releasePackage, "scripts"), false);
  assert.equal(Object.hasOwn(releasePackage, "devDependencies"), false);
  const releaseSkill = await readFile(path.join(repoRoot, "plugins", pluginName, "skills", "distill-project-design", "SKILL.md"), "utf8");
  assert.match(releaseSkill, /dsh plugin/u);
  assert.doesNotMatch(releaseSkill, /codex plugin marketplace upgrade/u);
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
  const bundleManifest = await readJSON(`plugins/${pluginName}/package.json`);
  assert.equal(bundleManifest.name, pluginName);
  assert.equal(bundleManifest.version, "1.0.1");
  assert.equal(bundleManifest.homepage, `${repositoryURL}#readme`);
  assert.deepEqual(bundleManifest.repository, {
    type: "git",
    url: `${repositoryURL}.git`,
    directory: "source",
  });

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

test("CI rebuilds the runtime before distribution checks and covers Linux", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  const install = workflow.indexOf("npm ci");
  const build = workflow.indexOf("npm run build");
  const packageVerify = workflow.indexOf("npm run package:verify");
  const distribution = workflow.indexOf("node --test test/distribution.test.mjs");
  assert.ok(install >= 0 && build > install && packageVerify > build && distribution > packageVerify);
  assert.match(workflow, /git diff --exit-code -- source\/dist\/plugin\.js/u);
  assert.match(workflow, /runs-on:\s*ubuntu-latest/u);
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
      bytes.toString("utf8").toLowerCase().includes(archiveHash.toLowerCase()),
      false,
      `${relativePath} contains the generated archive hash`,
    );
  }
});
