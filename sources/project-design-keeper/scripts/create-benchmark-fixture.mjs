import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const pluginRoot = resolve(import.meta.dirname, "..");
const fixtureRoot = resolve(pluginRoot, ".plugin-eval", "fixture");
const allowedRoot = `${resolve(pluginRoot, ".plugin-eval")}\\`;
if (!fixtureRoot.startsWith(allowedRoot)) throw new Error("Benchmark fixture escaped .plugin-eval");

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function managed(recordId, body) {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${sha256(body)}" -->${body}<!-- /project-design-keeper:managed -->`;
}

async function write(relativePath, contents) {
  const target = join(fixtureRoot, ...relativePath.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

async function createV1Pack(project, scopePath, sourceContents) {
  const definitions = [
    ["index", "index.md"],
    ["intent", "intent.md"],
    ["principles", "principles.md"],
    ["architecture", "architecture.md"],
    ["conventions", "conventions.md"],
    ["decisions", "decisions.md"],
    ["open-questions", "open-questions.md"],
    ["evidence-map", "evidence-map.md"]
  ];
  const documents = [];
  const records = [];
  for (const [slug, name] of definitions) {
    const documentId = `doc.${slug}`;
    const recordId = `legacy.${slug}`;
    const body = `# ${slug}\n\nStable fixture knowledge for ${slug}.\n`;
    documents.push({ id: documentId, path: `docs/project-design/${name}` });
    records.push({
      id: recordId,
      domain: "project-design",
      scope: "fixture",
      statement: `Stable fixture knowledge for ${slug}`,
      evidence: [`${scopePath}:1`],
      impact: [`Preserve ${slug} behavior during migration`],
      status: slug === "open-questions" ? "proposed" : "observed",
      strength: slug === "open-questions" ? "pending" : "informational",
      approval: slug === "open-questions" ? "pending" : "not-required",
      confidence: "high"
    });
    await write(`${project}/docs/project-design/${name}`, managed(recordId, body));
  }
  await write(`${project}/docs/project-design/manifest.json`, `${JSON.stringify({
    managedBy: "project-design-keeper",
    schemaVersion: "1.0",
    scope: { root: ".", paths: [scopePath] },
    sourceRevision: { kind: "git", files: { [scopePath]: sha256(sourceContents) } },
    documents,
    records
  }, null, 2)}\n`);
}

await rm(fixtureRoot, { recursive: true, force: true });
await write("small-project/Source/main.ts", "export const designGoal = 'small project';\n");
await write("small-project/README.md", "Small Project\n");

const existingSource = "export const existingDesign = 'preserve history';\n";
await write("existing-project/Source/design.ts", existingSource);
await createV1Pack("existing-project", "Source/design.ts", existingSource);

const scopedSource = "int ScopedDesign = 1;\n";
await write("scoped-project/Source/Scoped.cpp", scopedSource);
await write("scoped-project/Plugins/VibeUE/Unrelated.cpp", "int Unrelated = 1;\n");
await createV1Pack("scoped-project", "Source/Scoped.cpp", scopedSource);

await write("untracked-project/README.md", "Create an explicit untracked source beside this file.\n");

const largeFiles = Array.from({ length: 1000 }, (_, index) => {
  const name = `File${String(index).padStart(4, "0")}.txt`;
  const lines = Array.from({ length: 20 }, (__, line) => `${name} line ${line} bounded-index-content`).join("\n");
  return write(`large-project/Source/${name}`, `${lines}\n`);
});
await Promise.all(largeFiles);

await execFile("git", ["init"], { cwd: fixtureRoot, windowsHide: true });
await execFile("git", ["add", "."], { cwd: fixtureRoot, windowsHide: true });
await execFile("git", ["-c", "user.name=Project Design Keeper", "-c", "user.email=keeper@example.invalid", "commit", "-m", "benchmark fixture"], {
  cwd: fixtureRoot,
  windowsHide: true
});
process.stdout.write(`${fixtureRoot}\n`);
