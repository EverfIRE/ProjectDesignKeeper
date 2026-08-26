import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

const skillRoot = resolve(import.meta.dirname, "../skills/distill-project-design");
const templateNames = [
  ["index.md.template", "docs/project-design/index.md"],
  ["intent.md.template", "docs/project-design/intent.md"],
  ["principles.md.template", "docs/project-design/principles.md"],
  ["architecture.md.template", "docs/project-design/architecture.md"],
  ["module.md.template", "docs/project-design/modules/example.md"],
  ["conventions.md.template", "docs/project-design/conventions.md"],
  ["decisions.md.template", "docs/project-design/decisions.md"],
  ["tuning.md.template", "docs/project-design/tuning.md"],
  ["verification.md.template", "docs/project-design/verification.md"],
  ["open-questions.md.template", "docs/project-design/open-questions.md"],
  ["evidence-map.md.template", "docs/project-design/evidence-map.md"]
] as const;

const recordMetadata = {
  "doc.intent.core": { kind: "intent", ownerDocument: "doc.intent" },
  "doc.principles.catalog": { kind: "principle", ownerDocument: "doc.principles" },
  "doc.architecture.system": { kind: "architecture", ownerDocument: "doc.architecture" },
  "module.example.contract": { kind: "module", ownerDocument: "doc.module.example" },
  "doc.conventions.catalog": { kind: "convention", ownerDocument: "doc.conventions" },
  "doc.decisions.log": { kind: "decision", ownerDocument: "doc.decisions" },
  "doc.tuning.catalog": { kind: "tuning", ownerDocument: "doc.tuning" },
  "doc.verification.catalog": { kind: "verification", ownerDocument: "doc.verification" },
  "doc.open-questions.catalog": { kind: "open-question", ownerDocument: "doc.open-questions" }
} as const;

const documentIds: Record<string, string> = {
  "docs/project-design/index.md": "doc.index",
  "docs/project-design/intent.md": "doc.intent",
  "docs/project-design/principles.md": "doc.principles",
  "docs/project-design/architecture.md": "doc.architecture",
  "docs/project-design/modules/example.md": "doc.module.example",
  "docs/project-design/conventions.md": "doc.conventions",
  "docs/project-design/decisions.md": "doc.decisions",
  "docs/project-design/tuning.md": "doc.tuning",
  "docs/project-design/verification.md": "doc.verification",
  "docs/project-design/open-questions.md": "doc.open-questions",
  "docs/project-design/evidence-map.md": "doc.evidence-map"
};

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-candidate-cache-"));
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true });
  fixture = undefined;
  cacheDirectory = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function sha256(contents: Buffer | string): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${sha256(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function derivedBlock(documentId: string, content: string): string {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${sha256(content)}" -->${content}<!-- /project-design-keeper:derived -->`;
}

async function renderTemplate(templateName: string, replacements: Record<string, string> = {}): Promise<{ content: string; recordId?: string; documentId?: string }> {
  let template = await readFile(join(skillRoot, "assets", "knowledge-pack", templateName), "utf8");
  template = template.replaceAll("{{MODULE_SLUG}}", "example");
  for (const [name, value] of Object.entries(replacements)) template = template.replaceAll(`{{${name}}}`, value);
  template = template.replace(/\{\{[A-Z][A-Z0-9_]*\}\}/gu, "Example evidence-backed content.");
  let recordId: string | undefined;
  let documentId: string | undefined;
  template = template.replace(/\{\{DERIVED_BLOCK:([A-Za-z0-9][A-Za-z0-9._:-]*) BEGIN\}\}\r?\n([\s\S]*?)\r?\n\{\{DERIVED_BLOCK:\1 END\}\}/gu,
    (_match, id: string, body: string) => {
      documentId = id;
      return derivedBlock(id, `${body}\n`);
    });
  template = template.replace(/\{\{MANAGED_BLOCK:([A-Za-z0-9][A-Za-z0-9._:-]*) BEGIN\}\}\r?\n([\s\S]*?)\r?\n\{\{MANAGED_BLOCK:\1 END\}\}/gu,
    (_match, id: string, body: string) => {
      recordId = id;
      return block(id, `${body}\n`);
    });
  if (!documentId || /\{\{(?:DERIVED|MANAGED)_BLOCK:/u.test(template)) {
    throw new Error(`Template ${templateName} did not render as a Schema 3.0 owned document`);
  }
  return { content: template.trim(), ...(recordId ? { recordId } : {}), documentId };
}

interface Candidate {
  pack: Record<string, unknown>;
  changes: Array<{ path: string; content: string } | { path: string; delete: true }>;
}

function contentChange(draft: Candidate, index: number): { path: string; content: string } {
  const change = draft.changes.at(index);
  if (!change || !("content" in change)) throw new Error("Expected a content change");
  return change;
}

async function candidate(overrides: { brokenLink?: boolean; omitLastRecord?: boolean; badSourceHash?: boolean; badManagedHash?: boolean; manifestPack?: Record<string, unknown> } = {}): Promise<Candidate> {
  const rendered: Array<{ path: string; content: string; recordId?: string; documentId?: string }> = [];
  const validLinks = templateNames.map(([, path]) => `- [${path}](${path.replace("docs/project-design/", "")})`).join("\n");
  for (const [template, path] of templateNames) {
    const result = await renderTemplate(template, template === "index.md.template"
      ? { DOCUMENT_LINKS: overrides.brokenLink ? "[Missing](missing.md)" : validLinks }
      : {});
    rendered.push({ path, ...result });
  }
  if (overrides.badManagedHash) {
    const managed = rendered.find((document) => document.recordId);
    if (!managed) throw new Error("Expected a managed candidate document");
    managed.content = managed.content.replace(/sha256:[a-f0-9]{64}/u, `sha256:${"0".repeat(64)}`);
  }

  const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
  const sourceBytes = await readFile(project().trackedText);
  const sourceLine = sourceBytes.toString("utf8").split(/\r?\n/u)[0];
  const records = rendered.filter((document): document is typeof document & { recordId: keyof typeof recordMetadata } => Boolean(document.recordId)).map(({ recordId }, index) => ({
    id: recordId,
    ...recordMetadata[recordId],
    domain: "project-design",
    scope: "candidate-preview",
    statement: `Candidate statement ${index + 1}`,
    evidence: [{ path: sourcePath, startLine: 1, role: "implementation", excerptHash: sha256(sourceLine) }],
    impact: [`Candidate impact ${index + 1}`],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    assertedConfidence: "medium",
    lifecycle: { state: "active" }
  }));
  if (overrides.omitLastRecord) records.pop();
  const pack: Record<string, unknown> = {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 0,
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: {
      kind: "git",
      files: { [sourcePath]: overrides.badSourceHash ? `sha256:${"0".repeat(64)}` : sha256(sourceBytes) }
    },
    documents: rendered.map(({ path }) => ({ id: documentIds[path], path })),
    records,
    archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
    dedupeExceptions: []
  };
  const manifestPack = overrides.manifestPack ?? pack;
  return {
    pack,
    changes: [
      ...rendered.map(({ path, content }) => ({ path, content })),
      { path: "docs/project-design/manifest.json", content: `${JSON.stringify(manifestPack, null, 2)}\n` }
    ]
  };
}

async function preview(candidatePack: Candidate): Promise<Record<string, unknown>> {
  const api = createProjectDesignKeeper({ cacheDirectory });
  return api.previewUpdate({
    root: project().repository,
    pack: candidatePack.pack,
    changes: candidatePack.changes
  });
}

describe("candidate project-design pack preview", () => {
  test("renders every template as fully owned and previews a complete overlay without project writes", async () => {
    const draft = await candidate();
    await expect(preview(draft)).resolves.toMatchObject({ applicable: true, conflicts: [], validation: { valid: true } });
    for (const change of draft.changes) {
      await expect(readFile(join(project().repository, ...change.path.split("/")))).rejects.toThrow();
    }
  });

  test.each([
    ["bad schema", async () => { const value = await candidate(); value.pack.schemaVersion = "4.0"; contentChange(value, -1).content = `${JSON.stringify(value.pack)}\n`; return value; }, "schema_invalid"],
    ["broken link", () => candidate({ brokenLink: true }), "markdown_link_missing"],
    ["unlisted block", () => candidate({ omitLastRecord: true }), "managed_block_unlisted"],
    ["stale source hash", () => candidate({ badSourceHash: true }), "source_revision_hash_mismatch"],
    ["bad managed hash", () => candidate({ badManagedHash: true }), "managed_block_hash_mismatch"]
  ])("rejects %s before writing", async (_name, build, code) => {
    const draft = await build();
    const result = await preview(draft);
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain(code);
    for (const change of draft.changes) {
      await expect(readFile(join(project().repository, ...change.path.split("/")))).rejects.toThrow();
    }
  });

  test("rejects a manifest candidate that does not equal the validated pack", async () => {
    const draft = await candidate({ manifestPack: { managedBy: "project-design-keeper", schemaVersion: "1.0" } });
    await expect(preview(draft)).resolves.toMatchObject({ applicable: false, validation: { valid: false } });
  });

  test("rejects a managed block id duplicated across mapped documents", async () => {
    const draft = await candidate();
    const managedChanges = draft.changes.filter((change): change is { path: string; content: string } => "content" in change && change.content.includes("project-design-keeper:managed"));
    const [first, second] = managedChanges;
    const firstId = /record-id="([^"]+)"/u.exec(first.content)![1];
    const secondId = /record-id="([^"]+)"/u.exec(second.content)![1];
    second.content = second.content.replace(`record-id="${secondId}"`, `record-id="${firstId}"`);
    draft.pack.records = (draft.pack.records as Array<{ id: string }>).filter((record) => record.id !== secondId);
    contentChange(draft, -1).content = `${JSON.stringify(draft.pack, null, 2)}\n`;
    const result = await preview(draft);
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("managed_block_duplicate");
  });

  test("rejects candidate Markdown that has records but no document mapping", async () => {
    const draft = await candidate();
    const sourceRecord = (draft.pack.records as Array<Record<string, unknown>>)[0];
    (draft.pack.records as Array<Record<string, unknown>>).push({
      ...sourceRecord,
      id: "extra.unmapped",
      statement: "Candidate statement for an unmapped document"
    });
    draft.changes.splice(-1, 0, {
      path: "docs/project-design/extra.md",
      content: block("extra.unmapped", "# Extra\n")
    });
    contentChange(draft, -1).content = `${JSON.stringify(draft.pack, null, 2)}\n`;
    const result = await preview(draft);
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("document_unmapped");
  });

  test("rejects an existing owned Markdown document omitted from the final manifest", async () => {
    const oldPath = join(project().repository, "docs", "project-design", "old.md");
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(oldPath, block("old.record", "# Old\n"), "utf8");
    const result = await preview(await candidate());
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("document_unmapped");
  });

  test("accepts the final view when an omitted existing owned Markdown document is deleted", async () => {
    const oldPath = join(project().repository, "docs", "project-design", "old.md");
    await mkdir(join(project().repository, "docs", "project-design"), { recursive: true });
    await writeFile(oldPath, block("old.record", "# Old\n"), "utf8");
    const draft = await candidate();
    draft.changes.splice(-1, 0, { path: "docs/project-design/old.md", delete: true });
    await expect(preview(draft)).resolves.toMatchObject({ applicable: true, validation: { valid: true } });
    await expect(readFile(oldPath, "utf8")).resolves.toContain("old.record");
  });

  test("fails closed on a non-regular Markdown entry in the managed tree", async () => {
    await mkdir(join(project().repository, "docs", "project-design", "directory.md"), { recursive: true });
    const result = await preview(await candidate());
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("managed_document_not_regular");
  });

  test("rejects a manifest-only pack with no required base documents", async () => {
    const draft = await candidate();
    draft.pack.documents = [];
    draft.pack.records = [];
    draft.changes = [{ path: "docs/project-design/manifest.json", content: `${JSON.stringify(draft.pack, null, 2)}\n` }];
    const result = await preview(draft);
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("required_document_missing");
  });

  test("rejects a pack missing a canonical required base document", async () => {
    const draft = await candidate();
    const missingPath = "docs/project-design/intent.md";
    const missingChange = draft.changes.find((change) => change.path === missingPath && "content" in change) as { content: string };
    const missingRecord = /record-id="([^"]+)"/u.exec(missingChange.content)![1];
    draft.pack.documents = (draft.pack.documents as Array<{ path: string }>).filter((document) => document.path !== missingPath);
    draft.pack.records = (draft.pack.records as Array<{ id: string }>).filter((record) => record.id !== missingRecord);
    draft.changes = draft.changes.filter((change) => change.path !== missingPath);
    (draft.changes.at(-1) as { content: string }).content = `${JSON.stringify(draft.pack, null, 2)}\n`;
    const result = await preview(draft);
    expect(result).toMatchObject({ applicable: false, validation: { valid: false } });
    expect(JSON.stringify(result)).toContain("required_document_missing");
  });
});
