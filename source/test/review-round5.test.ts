import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createProjectFixture,
  removeProjectFixture,
  type ProjectFixture
} from "./fixtures.js";
import { createTrustedTestKeeper } from "./keeper.js";

type KeeperModule = typeof import("../src/index.js");
type Keeper = KeeperModule["projectDesignKeeper"];

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-review-round5-cache-"));
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

function cache(): string {
  if (!cacheDirectory) throw new Error("cache was not created");
  return cacheDirectory;
}

async function keeper(): Promise<Keeper> {
  return createTrustedTestKeeper({ cacheDirectory: cache() }) as Keeper;
}

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function canonicalSkill(content = "context"): string {
  return [
    "---",
    "name: project-design-context",
    'description: "Use when project design context is needed."',
    "metadata:",
    "  managed-by: project-design-keeper",
    "---",
    block("skill-context", content),
    ""
  ].join("\n");
}

function ownedJson(value: string): string {
  return `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", value }, null, 2)}\n`;
}

async function completeCandidate(contextValue: string): Promise<{
  pack: Record<string, unknown>;
  changes: Array<{ path: string; content: string }>;
}> {
  const names = [
    "index.md",
    "intent.md",
    "principles.md",
    "architecture.md",
    "conventions.md",
    "decisions.md",
    "open-questions.md",
    "evidence-map.md"
  ];
  const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
  const sourceContent = await readFile(project().trackedText, "utf8");
  const documents = names.map((name, index) => ({
    id: `document.${index + 1}`,
    path: `docs/project-design/${name}`
  }));
  const records = names.map((_name, index) => ({
    id: `base.${index + 1}`,
    domain: "project-design",
    scope: "required-base-documents",
    statement: `Required base document ${index + 1}`,
    evidence: [`${sourcePath}:1`],
    impact: [`Base document ${index + 1}`],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    confidence: "high"
  }));
  const pack = {
    managedBy: "project-design-keeper",
    schemaVersion: "1.0",
    scope: { root: ".", paths: [sourcePath] },
    sourceRevision: { kind: "git", files: { [sourcePath]: hash(sourceContent) } },
    documents,
    records
  };
  return {
    pack,
    changes: [
      ...documents.map((document, index) => ({ path: document.path, content: block(records[index].id, `Base ${index + 1}\n`) })),
      { path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` },
      { path: "docs/project-design/context.json", content: ownedJson(contextValue) }
    ]
  };
}

async function rejected(operation: Promise<unknown>): Promise<Error | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function makeLargeLoopingExternalTree(name: string): Promise<string> {
  const outside = join(project().root, name);
  let directory = outside;
  await mkdir(directory, { recursive: true });
  await writeFile(join(outside, "manifest.json"), '{"externalSecret":"must-not-be-fingerprinted"}\n', "utf8");
  for (let index = 0; index < 40; index += 1) {
    directory = join(directory, `level-${String(index).padStart(2, "0")}`);
    await mkdir(directory);
    await writeFile(join(directory, `external-${index}.md`), `external ${index}\n`, "utf8");
  }
  await symlink(outside, join(directory, "loop"), "junction");
  return outside;
}

describe("managed root entry guards", () => {
  test.skipIf(process.platform === "win32")("rejects a manifest leaf symlink before a skill-only preview reads outside or writes cache", async () => {
    const manifestDirectory = join(project().repository, "docs", "project-design");
    await mkdir(manifestDirectory, { recursive: true });
    await symlink(project().outsideFile, join(manifestDirectory, "manifest.json"), "file");
    const api = await keeper();

    const error = await rejected(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", content: canonicalSkill() }]
    }));

    expect.soft(error).toBeInstanceOf(Error);
    expect.soft(error?.message).toMatch(/manifest|symbolic|reparse|ordinary file|outside/i);
    expect(await readdir(cache())).toEqual([]);
  });

  test("rejects a docs root junction before a skill-only preview reads outside or writes cache", async () => {
    const outside = await makeLargeLoopingExternalTree("outside-docs-root");
    await symlink(outside, join(project().repository, "docs", "project-design"), "junction");
    const api = await keeper();

    const error = await rejected(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", content: canonicalSkill() }]
    }));

    expect.soft(error).toBeInstanceOf(Error);
    expect.soft(error?.message).toMatch(/managed root|symbolic|junction|reparse/i);
    expect(await readdir(cache())).toEqual([]);
  });

  test("rejects a skill root junction before a docs-only preview writes cache", async () => {
    const outside = join(project().root, "outside-skill-root");
    await mkdir(outside);
    await mkdir(join(project().repository, ".agents", "skills"), { recursive: true });
    await symlink(outside, join(project().repository, ".agents", "skills", "project-design-context"), "junction");
    const api = await keeper();

    const error = await rejected(api.previewUpdate({
      root: project().repository,
      pack: {},
      changes: [{ path: "docs/project-design/context.json", content: ownedJson("context") }]
    }));

    expect.soft(error).toBeInstanceOf(Error);
    expect.soft(error?.message).toMatch(/managed root|symbolic|junction|reparse/i);
    expect(await readdir(cache())).toEqual([]);
  });

  test("rejects apply when the unmodified docs root becomes a junction after skill preview", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", content: canonicalSkill() }]
    });
    const outside = join(project().root, "outside-docs-apply");
    await mkdir(outside);
    await symlink(outside, join(project().repository, "docs", "project-design"), "junction");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/managed root|symbolic|junction|reparse/i);
    await expect(readFile(join(project().repository, ".agents", "skills", "project-design-context", "SKILL.md"), "utf8"))
      .rejects.toThrow();
    await expect(readdir(outside)).resolves.toEqual([]);
  });

  test("rejects apply when the unmodified skill root becomes a junction after docs preview", async () => {
    const api = await keeper();
    const target = join(project().repository, "docs", "project-design", "context.json");
    const candidate = await completeCandidate("context");
    const preview = await api.previewUpdate({
      root: project().repository,
      ...candidate
    });
    const outside = join(project().root, "outside-skill-apply");
    await mkdir(outside);
    await mkdir(join(project().repository, ".agents", "skills"), { recursive: true });
    await symlink(outside, join(project().repository, ".agents", "skills", "project-design-context"), "junction");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/managed root|symbolic|junction|reparse/i);
    await expect(readFile(target, "utf8")).rejects.toThrow();
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
