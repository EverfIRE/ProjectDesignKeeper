import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ProjectFixture } from "./fixtures.js";

const requiredDocuments = [
  "index.md",
  "intent.md",
  "principles.md",
  "architecture.md",
  "conventions.md",
  "decisions.md",
  "open-questions.md",
  "evidence-map.md"
] as const;

function hash(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function derived(documentId: string, content: string): string {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:derived -->`;
}

export async function writeCanonicalPackFixture(project: ProjectFixture): Promise<Record<string, unknown>> {
  const directory = join(project.repository, "docs", "project-design");
  const sourcePath = relative(project.repository, project.trackedText).replaceAll("\\", "/");
  const sourceBytes = await readFile(project.trackedText);
  await mkdir(directory, { recursive: true });
  const documents = requiredDocuments.map((name, index) => ({
    id: `document.${index + 1}`,
    path: `docs/project-design/${name}`
  }));
  const records = requiredDocuments.map((_name, index) => ({
    id: `record.${index + 1}`,
    domain: "project-design",
    scope: "base-documents",
    statement: `Base statement ${index + 1}`,
    evidence: [`${sourcePath}:1`],
    impact: [`Base impact ${index + 1}`],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    confidence: "high"
  }));
  for (const [index, document] of documents.entries()) {
    await writeFile(join(project.repository, ...document.path.split("/")), block(records[index].id, `Base ${index + 1}\n`), "utf8");
  }
  return {
    managedBy: "project-design-keeper",
    schemaVersion: "1.0",
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash(sourceBytes) } },
    documents,
    records
  };
}

export async function writeV3PackFixture(project: ProjectFixture): Promise<Record<string, unknown>> {
  const directory = join(project.repository, "docs", "project-design");
  const sourcePath = relative(project.repository, project.trackedText).replaceAll("\\", "/");
  const sourceBytes = await readFile(project.trackedText);
  const sourceLine = sourceBytes.toString("utf8").split(/\r?\n/u)[0];
  await mkdir(directory, { recursive: true });
  const names = [
    "index.md", "intent.md", "principles.md", "architecture.md", "conventions.md", "decisions.md",
    "tuning.md", "verification.md", "open-questions.md", "evidence-map.md"
  ] as const;
  const documents = names.map((name) => ({ id: `document.${name.replace(".md", "")}`, path: `docs/project-design/${name}` }));
  const kindByName: Record<string, string> = {
    "intent.md": "intent",
    "principles.md": "principle",
    "architecture.md": "architecture",
    "conventions.md": "convention",
    "decisions.md": "decision",
    "tuning.md": "tuning",
    "verification.md": "verification",
    "open-questions.md": "open-question"
  };
  const records = names.filter((name) => name in kindByName).map((name) => ({
    id: `record.${kindByName[name]}`,
    kind: kindByName[name],
    ownerDocument: `document.${name.replace(".md", "")}`,
    domain: "project-design",
    scope: "project",
    statement: `The project has an atomic ${kindByName[name]} record.`,
    evidence: [{ path: sourcePath, startLine: 1, role: "implementation", excerptHash: hash(sourceLine) }],
    impact: [kindByName[name]],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    assertedConfidence: "medium",
    lifecycle: { state: "active" }
  }));
  for (const document of documents) {
    const target = join(project.repository, ...document.path.split("/"));
    if (document.path.endsWith("index.md") || document.path.endsWith("evidence-map.md")) {
      await writeFile(target, derived(document.id, `# ${document.id}\n`), "utf8");
    } else {
      const name = document.path.split("/").at(-1)!;
      await writeFile(target, `${derived(document.id, `# ${kindByName[name]}\n`)}${block(`record.${kindByName[name]}`, `Record ${kindByName[name]}\n`)}`, "utf8");
    }
  }
  return {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 1,
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash(sourceBytes) } },
    documents,
    records,
    archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
    dedupeExceptions: []
  };
}
