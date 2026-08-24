import { createHash } from "node:crypto";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createProjectFixture,
  removeProjectFixture,
  type ProjectFixture
} from "./fixtures.js";

type Keeper = typeof import("../src/index.js").projectDesignKeeper;

async function keeper(): Promise<Keeper> {
  const entryPoint = "../src/index.js";
  return ((await import(/* @vite-ignore */ entryPoint)) as { projectDesignKeeper: Keeper }).projectDesignKeeper;
}

let fixture: ProjectFixture | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  fixture = undefined;
});

function project(): ProjectFixture {
  if (!fixture) throw new Error("fixture was not created");
  return fixture;
}

function canonicalRecord(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "record.default",
    domain: "project-design",
    scope: "project",
    statement: "Evidence-backed project statement",
    evidence: [],
    impact: ["Routes downstream work"],
    status: "observed",
    strength: "informational",
    approval: "not-required",
    confidence: "high",
    ...overrides
  };
}

function contentHash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function managedBlock(recordId: string, content: string): string {
  const hash = contentHash(content);
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash}" -->${content}<!-- /project-design-keeper:managed -->`;
}

describe("Project Design Keeper read-only core", () => {
  test("resolveScope canonicalizes a standalone root and rejects absolute root escapes", async () => {
    const subject = project();
    const api = await keeper();

    await expect(api.resolveScope({ path: subject.nonGitDirectory })).resolves.toMatchObject({
      root: subject.nonGitDirectory,
      target: subject.nonGitDirectory,
      isGitRepository: false
    });
    await expect(api.resolveScope({ path: subject.outsideFile, root: subject.repository })).rejects.toThrow();
  });

  test("scanScope provides stable text fingerprints and line-aware chunks without generated or binary files", async () => {
    const subject = project();
    const api = await keeper();
    const generated = `${subject.nonGitDirectory}/node_modules/generated.txt`;
    const binary = `${subject.nonGitDirectory}/image.dat`;
    await mkdir(`${subject.nonGitDirectory}/node_modules`, { recursive: true });
    await writeFile(generated, "generated\n", "utf8");
    await writeFile(binary, Buffer.from([65, 0, 66]));

    const files = await api.scanScope({ path: subject.nonGitDirectory, view: "files" });
    const evidence = await api.scanScope({ path: subject.nonGitDirectory, view: "evidence" });
    const note = relative(subject.nonGitDirectory, `${subject.nonGitDirectory}/notes.txt`);
    expect(files.items).toEqual([expect.objectContaining({ path: note, fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) })]);
    expect(evidence.items).toContainEqual(expect.objectContaining({ path: note, line: 1, text: "not a Git worktree" }));
    await expect(api.snapshot({ path: subject.nonGitDirectory })).resolves.toMatchObject({ files: expect.any(Object) });
  });

  test("scanScope skips a non-Git symlink whose real path escapes the selected root", async () => {
    const subject = project();
    const api = await keeper();
    const escapedLink = `${subject.nonGitDirectory}/outside link.txt`;
    try {
      await symlink(subject.outsideFile, escapedLink, "file");
    } catch {
      return;
    }

    const files = await api.scanScope({ path: subject.nonGitDirectory, view: "files" });
    const evidence = await api.scanScope({ path: subject.nonGitDirectory, view: "evidence" });
    expect(files.items).toEqual([expect.objectContaining({ path: "notes.txt" })]);
    expect(evidence.items).not.toContainEqual(expect.objectContaining({ text: "must not be reachable through a project path" }));
  });

  test("scanScope includes Git repository metadata for a Git-selected scope", async () => {
    const subject = project();
    const api = await keeper();

    await expect(api.scanScope({ path: subject.repository })).resolves.toMatchObject({
      repository: { root: subject.repository, head: expect.any(String) }
    });
  });

  test("searchEvidence returns exact lines and applies manifest domain and status filters", async () => {
    const subject = project();
    const api = await keeper();
    await mkdir(`${subject.repository}/docs/project-design`, { recursive: true });
    const sourcePath = relative(subject.repository, subject.trackedText).replaceAll("\\", "/");
    await writeFile(`${subject.repository}/docs/project-design/manifest.json`, JSON.stringify({
      sourceRevision: { files: { [sourcePath]: contentHash("Keeper evidence: moon-garden\n") } },
      records: [
        canonicalRecord({ id: "moon", domain: "ui", statement: "moon-garden UI rule", evidence: [`${sourcePath}:1`], status: "observed" }),
        canonicalRecord({ id: "sun", domain: "api", statement: "moon-garden API rule", evidence: [`${sourcePath}:1`], status: "proposed", approval: "pending" })
      ]
    }), "utf8");

    const result = await api.searchEvidence({
      root: subject.repository,
      query: "moon-garden",
      domain: "ui",
      status: "observed"
    });
    expect(result.matches).toEqual([{
      path: relative(subject.repository, subject.trackedText).replaceAll("\\", "/"),
      line: 1,
      text: "Keeper evidence: moon-garden"
    }]);
  });

  test("Git root plus a relative path scopes scan, search, context, and snapshots to that target", async () => {
    const subject = project();
    const api = await keeper();
    const tracked = relative(subject.repository, subject.trackedText).replaceAll("\\", "/");
    const scoped = { root: subject.repository, path: "docs" };

    await expect(api.scanScope({ ...scoped, view: "files" })).resolves.toMatchObject({ items: [expect.objectContaining({ path: tracked })] });
    await expect(api.searchEvidence({ ...scoped, query: "generated" })).resolves.toEqual({ matches: [] });
    await expect(api.queryContext({ ...scoped, query: "generated" })).resolves.toMatchObject({ context: [] });
    await expect(api.snapshot(scoped)).resolves.toMatchObject({ files: { [tracked]: expect.any(String) } });
  });

  test("queryContext returns only matching manifest summaries, conflicts, and open questions", async () => {
    const subject = project();
    const api = await keeper();
    await mkdir(`${subject.repository}/docs/project-design`, { recursive: true });
    const sourcePath = relative(subject.repository, subject.trackedText).replaceAll("\\", "/");
    await writeFile(`${subject.repository}/docs/project-design/manifest.json`, JSON.stringify({
      sourceRevision: { files: { [sourcePath]: contentHash("Keeper evidence: moon-garden\n") } },
      records: [
        canonicalRecord({
          id: "moon", scope: "module:garden", statement: "Moon garden layout uses moon-garden evidence", evidence: [`${sourcePath}:1`],
          conflicts: ["Needs contrast review"], openQuestions: ["Which moon phase?"]
        }),
        canonicalRecord({ id: "sun", scope: "module:solar", statement: "Sun garden layout", evidence: [`${sourcePath}:1`] })
      ]
    }), "utf8");

    const result = await api.queryContext({ root: subject.repository, query: "moon-garden", modules: ["garden"] });
    expect(result.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "moon", statement: "Moon garden layout uses moon-garden evidence" }) })]);
    expect(result.conflicts).toEqual(["Needs contrast review"]);
    expect(result.openQuestions).toEqual(["Which moon phase?"]);
    expect(result.records).not.toContainEqual(expect.objectContaining({ id: "sun" }));
  });

  test("queryContext paths constrain source evidence and concise manifest record/document summaries", async () => {
    const subject = project();
    const api = await keeper();
    const sourcePath = relative(subject.repository, subject.trackedText).replaceAll("\\", "/");
    const manifestSourcePath = sourcePath.replaceAll("\\", "/");
    await writeFile(`${subject.repository}/.gitignore`, "generated/\nmoon-garden\n", "utf8");
    await mkdir(`${subject.repository}/docs/project-design`, { recursive: true });
    await writeFile(`${subject.repository}/docs/project-design/manifest.json`, JSON.stringify({
      sourceRevision: {
        files: {
          [manifestSourcePath]: contentHash("Keeper evidence: moon-garden\n"),
          ".gitignore": contentHash("generated/\nmoon-garden\n")
        }
      },
      records: [
        canonicalRecord({ id: "moon", statement: "Moon source", evidence: [`${manifestSourcePath}:1`] }),
        canonicalRecord({ id: "ignore", statement: "Ignored source", evidence: [".gitignore:2"] })
      ],
      documents: [
        { id: "moon-doc", path: "docs/project-design/architecture.md" },
        { id: "ignore-doc", path: "docs/project-design/intent.md" }
      ]
    }), "utf8");
    await writeFile(`${subject.repository}/docs/project-design/architecture.md`, managedBlock("moon", "Moon architecture\n"), "utf8");
    await writeFile(`${subject.repository}/docs/project-design/intent.md`, managedBlock("ignore", "Ignored intent\n"), "utf8");

    const result = await api.queryContext({ root: subject.repository, query: "moon-garden", paths: [sourcePath] });
    expect(result.context).toEqual([{ path: sourcePath, line: 1, text: "Keeper evidence: moon-garden" }]);
    expect(result.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "moon", statement: "Moon source", evidence: [`${manifestSourcePath}:1`] }) })]);
    expect(result.documents).toEqual([{ id: "moon-doc", path: "docs/project-design/architecture.md" }]);
  });

  test("queryContext modules constrain evidence and preserve only relevant conflicts and questions", async () => {
    const subject = project();
    const api = await keeper();
    const sourcePath = relative(subject.repository, subject.trackedText).replaceAll("\\", "/");
    const manifestSourcePath = sourcePath.replaceAll("\\", "/");
    await writeFile(`${subject.repository}/.gitignore`, "generated/\nmoon-garden\n", "utf8");
    await mkdir(`${subject.repository}/docs/project-design`, { recursive: true });
    await writeFile(`${subject.repository}/docs/project-design/manifest.json`, JSON.stringify({
      sourceRevision: {
        files: {
          [manifestSourcePath]: contentHash("Keeper evidence: moon-garden\n"),
          ".gitignore": contentHash("generated/\nmoon-garden\n")
        }
      },
      records: [
        canonicalRecord({
          id: "moon", scope: "module:garden", statement: "Moon module", evidence: [`${manifestSourcePath}:1`],
          conflicts: ["Moon contrast"], openQuestions: ["Moon phase?"], internal: "omit"
        }),
        canonicalRecord({ id: "solar", scope: "module:solar", statement: "Solar module", evidence: [".gitignore:2"], conflicts: ["Solar conflict"] })
      ],
      documents: [
        { id: "moon-doc", path: "docs/project-design/architecture.md" },
        { id: "solar-doc", path: "docs/project-design/intent.md" }
      ]
    }), "utf8");
    await writeFile(`${subject.repository}/docs/project-design/architecture.md`, managedBlock("moon", "Moon architecture\n"), "utf8");
    await writeFile(`${subject.repository}/docs/project-design/intent.md`, managedBlock("solar", "Solar intent\n"), "utf8");

    const result = await api.queryContext({ root: subject.repository, query: "moon-garden", modules: ["garden"] });
    expect(result.context).toEqual([{ path: sourcePath, line: 1, text: "Keeper evidence: moon-garden" }]);
    expect(result.records).toEqual([expect.objectContaining({ record: expect.objectContaining({ id: "moon", scope: "module:garden", statement: "Moon module" }) })]);
    expect(result.documents).toEqual([{ id: "moon-doc", path: "docs/project-design/architecture.md" }]);
    expect(result.conflicts).toEqual(["Moon contrast"]);
    expect(result.openQuestions).toEqual(["Moon phase?"]);
  });

  test("queryContext ranks a line with more query evidence ahead of a weaker match", async () => {
    const subject = project();
    const api = await keeper();
    await writeFile(subject.trackedText, "moon-garden\nmoon-garden moon-garden\n", "utf8");

    const result = await api.queryContext({ root: subject.repository, query: "moon-garden" });
    expect(result.context).toEqual([
      { path: relative(subject.repository, subject.trackedText).replaceAll("\\", "/"), line: 2, text: "moon-garden moon-garden" },
      { path: relative(subject.repository, subject.trackedText).replaceAll("\\", "/"), line: 1, text: "moon-garden" }
    ]);
  });

  test("snapshot and detectDrift report changed new and deleted non-Git sources", async () => {
    const subject = project();
    const api = await keeper();
    await writeFile(`${subject.nonGitDirectory}/old.txt`, "old\n", "utf8");
    const before = await api.snapshot({ path: subject.nonGitDirectory });
    await writeFile(`${subject.nonGitDirectory}/notes.txt`, "changed\n", "utf8");
    await writeFile(`${subject.nonGitDirectory}/new.txt`, "new\n", "utf8");
    await rm(`${subject.nonGitDirectory}/old.txt`);

    const after = await api.snapshot({ path: subject.nonGitDirectory, previousSnapshot: before });
    expect(after.new).toEqual(["new.txt"]);
    expect(after.deleted).toEqual(["old.txt"]);
    expect(after.changed).toEqual(["notes.txt"]);

    const drift = await api.detectDrift({
      root: subject.nonGitDirectory,
      previousSnapshot: before,
      pack: { requiredEvidence: ["missing-evidence"] },
      view: "details"
    });
    expect(drift.counts).toEqual({ modified: 1, new: 1, deleted: 1, invalidated: 0 });
    expect(drift.items).toContainEqual(expect.objectContaining({ kind: "modified", path: "notes.txt" }));
    expect(drift.items).toContainEqual(expect.objectContaining({ kind: "new", path: "new.txt" }));
    expect(drift.items).toContainEqual(expect.objectContaining({ kind: "deleted", path: "old.txt" }));
    expect(drift.items).toContainEqual(expect.objectContaining({ evidence: "missing-evidence" }));
  });

  test("detectDrift uses a manifest source revision when no previous snapshot is supplied", async () => {
    const subject = project();
    const api = await keeper();
    const before = await api.snapshot({ path: subject.repository });
    await mkdir(`${subject.repository}/docs/project-design`, { recursive: true });
    await writeFile(`${subject.repository}/docs/project-design/manifest.json`, JSON.stringify({ sourceRevision: before }), "utf8");
    await writeFile(subject.trackedText, "Keeper evidence: moon-garden\nchanged\n", "utf8");

    await expect(api.detectDrift({ root: subject.repository })).resolves.toMatchObject({
      freshness: "stale",
      counts: { modified: 1 }
    });
  });
});
