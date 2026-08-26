import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, ".package", "project-design-keeper");

const requiredFiles = [
  "package.json",
  "cordis.patch.yml",
  "dist/plugin.js",
  "skills/distill-project-design/SKILL.md",
  "skills/distill-project-design/references/tool-contract.md",
  "skills/distill-project-design/references/workflow.md"
];
const maximumFileBytes = 16 * 1024 * 1024;
const maximumJsonBytes = 256 * 1024;

async function readJson(relativePath) {
  const absolute = join(target, relativePath);
  const metadata = await stat(absolute, { bigint: true });
  if (metadata.size > BigInt(maximumJsonBytes)) throw new Error(`${relativePath} exceeds the JSON byte limit of ${maximumJsonBytes} bytes`);
  return JSON.parse(await readFile(absolute, "utf8"));
}

async function treeFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await treeFiles(absolute)));
    if (entry.isFile()) results.push(relative(target, absolute).replaceAll("\\", "/"));
  }
  return results.sort();
}

for (const relativePath of requiredFiles) {
  const metadata = await stat(join(target, relativePath), { bigint: true });
  if (!metadata.isFile()) throw new Error(`Missing required bundle file: ${relativePath}`);
  if (metadata.size > BigInt(maximumFileBytes)) throw new Error(`${relativePath} exceeds the file limit of ${maximumFileBytes} bytes`);
}

const manifest = await readJson("package.json");
if (manifest.name !== "project-design-keeper") throw new Error("Bundle manifest name mismatch");
if (manifest.version !== "1.0.1") throw new Error("Bundle manifest version mismatch");
if (manifest.type !== "module") throw new Error("Bundle manifest must be ESM");
if (manifest.main !== "dist/plugin.js") throw new Error(`Bundle entry must be dist/plugin.js, got ${manifest.main}`);
if (manifest.dsh?.bundle?.patch !== "./cordis.patch.yml") {
  throw new Error("Bundle manifest must declare dsh.bundle.patch = ./cordis.patch.yml");
}
for (const field of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-tools", "@deepseek-ai/dsh-user-approval", "@deepseek-ai/dsh-user-questions", "@deepseek-ai/schemastery"]) {
  if (!(field in (manifest.peerDependencies ?? {}))) {
    throw new Error(`Bundle manifest must declare peer dependency ${field}`);
  }
}
if (manifest.scripts || manifest.devDependencies) {
  throw new Error("Bundle manifest must not carry repository development scripts or devDependencies");
}

const patch = await readFile(join(target, "cordis.patch.yml"), "utf8");
if (!patch.includes("name: project-design-keeper")) throw new Error("Patch layer must register the keeper plugin row");
if (!patch.includes("@deepseek-ai/dsh-skill-filesystem")) throw new Error("Patch layer must register the skill-filesystem provider");
if (!patch.includes("customSkillDirs")) throw new Error("Patch layer must mount the bundled skills directory");

const plugin = await readFile(join(target, "dist/plugin.js"), "utf8");
if (plugin.includes("@modelcontextprotocol")) {
  throw new Error("Compiled plugin must not depend on the MCP SDK");
}
for (const external of ["@deepseek-ai/dsh-tools", "@deepseek-ai/schemastery"]) {
  if (!plugin.includes(external)) throw new Error(`Compiled plugin must keep ${external} as an external harness import`);
}
if (!plugin.includes("apply_update") || !plugin.includes("scan_scope") || !plugin.includes("validate_pack")) {
  throw new Error("Compiled plugin must register the keeper tools");
}

const skill = await readFile(join(target, "skills/distill-project-design/SKILL.md"), "utf8");
if (/codex plugin marketplace upgrade/u.test(skill)) {
  throw new Error("Skill must not reference the Codex marketplace upgrade path");
}
if (!/dsh plugin/u.test(skill)) {
  throw new Error("Skill must document the DeepSeek Harness install path");
}

const files = await treeFiles(target);
const forbidden = files.filter((entry) =>
  entry.includes("mcp-tools") ||
  entry.includes("openai.yaml") ||
  entry.includes(".codex-plugin") ||
  entry.includes(".mcp.json") ||
  entry === "dist/index.js" ||
  entry.startsWith("src/") ||
  entry.startsWith("test/") ||
  entry.startsWith("scripts/")
);
if (forbidden.length > 0) {
  throw new Error(`Bundle contains forbidden entries: ${forbidden.join(", ")}`);
}

process.stdout.write(`Verified bundle at ${target}: ${files.length} files\n`);
