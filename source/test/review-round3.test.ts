import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { persistedChangesetSchema } from "../src/types/schema.js";
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
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-review-round3-cache-"));
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

async function keeper(options: Record<string, unknown> = {}): Promise<Keeper> {
  return createTrustedTestKeeper({ cacheDirectory: cache(), ...options }) as Keeper;
}

function hash(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function block(recordId: string, content: string, declaredHash = hash(content)): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${declaredHash}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function skillEnvelope(content: string, description = "Use when implementation decisions need project design context."): string {
  return [
    "---",
    "name: project-design-context",
    `description: ${JSON.stringify(description)}`,
    "metadata:",
    "  managed-by: project-design-keeper",
    "---",
    block("skill-context", content),
    ""
  ].join("\n");
}

function changesetPath(id: unknown): string {
  return join(cache(), "changesets", `${String(id)}.json`);
}

async function mutateChangeset(id: unknown, mutate: (value: Record<string, any>) => void): Promise<void> {
  const path = changesetPath(id);
  const value = JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
  mutate(value);
  await writeFile(path, JSON.stringify(value), "utf8");
}

describe("Keeper-owned Skill envelope", () => {
  test("creates a quick-validator-compatible Skill and preserves its frontmatter bytes on managed-block updates", async () => {
    const api = await keeper();
    const path = ".agents/skills/project-design-context/SKILL.md";
    const original = skillEnvelope("first context");
    const prefix = original.slice(0, original.indexOf("<!-- project-design-keeper:managed"));
    const creation = await api.previewUpdate({
      root: project().repository,
      changes: [{ path, content: original }]
    });

    expect(creation).toMatchObject({ applicable: true, conflicts: [] });
    await api.applyUpdate({ root: project().repository, changesetId: creation.changesetId });
    const update = await api.previewUpdate({
      root: project().repository,
      changes: [{ path, managedBlock: { recordId: "skill-context", content: "second context" } }]
    });
    await api.applyUpdate({ root: project().repository, changesetId: update.changesetId });

    const written = await readFile(join(project().repository, ...path.split("/")), "utf8");
    expect(written.startsWith("---\n")).toBe(true);
    expect(written.slice(0, written.indexOf("<!-- project-design-keeper:managed"))).toBe(prefix);
    expect(written).toContain("name: project-design-context\n");
    expect(written).toContain("metadata:\n  managed-by: project-design-keeper\n");
    expect(written).toContain("second context");
  });

  test("rejects an existing SKILL.md whose frontmatter is not the Keeper Skill contract", async () => {
    const target = join(project().repository, ".agents", "skills", "project-design-context", "SKILL.md");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, skillEnvelope("old").replace("name: project-design-context", "name: impostor"), "utf8");
    const api = await keeper();

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", managedBlock: { recordId: "skill-context", content: "new" } }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/skill|frontmatter|ownership/i)] });
  });

  test("requires a nonempty trigger-only description and explicit managed-by metadata", async () => {
    const api = await keeper();
    const path = ".agents/skills/project-design-context/SKILL.md";
    const procedural = skillEnvelope("context", "Follow these steps to rewrite the project files.");
    const missingMetadata = skillEnvelope("context").replace("metadata:\n  managed-by: project-design-keeper\n", "");

    for (const content of [procedural, missingMetadata]) {
      const preview = await api.previewUpdate({ root: project().repository, changes: [{ path, content }] });
      expect(preview.applicable).toBe(false);
      expect(preview.conflicts).toEqual([expect.stringMatching(/skill|description|metadata|ownership/i)]);
    }
  });
});

describe("persisted Markdown operations", () => {
  test("does not let a cached final-content edit replace human-authored spans", async () => {
    const path = ".agents/skills/project-design-context/human-and-managed.md";
    const target = join(project().repository, ...path.split("/"));
    const original = `Human prefix\n${block("record", "old")}\nHuman suffix\n`;
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path, managedBlock: { recordId: "record", content: "new" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => {
      stored.changes[0].content = `Attacker replacement\n${block("record", "new")}\n`;
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|tamper|changeset/i);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
  });
});

describe("commit race boundary", () => {
  test("rejects an ordinary parent replacement after staging by recorded directory identity", async () => {
    const parent = join(project().repository, ".agents", "skills", "project-design-context", "identity-swap");
    const moved = join(project().repository, ".agents", "skills", "project-design-context", "identity-swap-moved");
    await mkdir(parent, { recursive: true });
    let swapped = false;
    const api = await keeper({
      beforeMutationRename: async () => {
        if (swapped) return;
        swapped = true;
        await rename(parent, moved);
        await mkdir(parent);
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/identity-swap/output.md", managedBlock: { recordId: "identity", content: "safe" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/parent.*identity|containment/i);
    expect(swapped).toBe(true);
    await expect(readFile(join(parent, "output.md"), "utf8")).rejects.toThrow();
    await expect(readFile(join(moved, "output.md"), "utf8")).rejects.toThrow();
  });

  test("rechecks containment after beforeRename swaps a staged parent for a junction", async () => {
    const managedDirectory = join(project().repository, ".agents", "skills", "project-design-context");
    const movedDirectory = join(project().repository, ".agents", "skills", "project-design-context-before-swap");
    const outsideDirectory = join(project().root, "outside-race-target");
    await mkdir(outsideDirectory, { recursive: true });
    let hookCalled = false;
    const api = await keeper({
      beforeRename: async () => {
        hookCalled = true;
        await rename(managedDirectory, movedDirectory);
        await symlink(outsideDirectory, managedDirectory, "junction");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/race.md", managedBlock: { recordId: "race", content: "inside only" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/symbolic|junction|outside|containment/i);
    expect(hookCalled).toBe(true);
    await expect(readFile(join(outsideDirectory, "race.md"), "utf8")).rejects.toThrow();
  });

  test("never delegates the filesystem rename to a caller-supplied commit function", async () => {
    const outsideTarget = join(project().root, "caller-controlled-rename.md");
    let injectedRenameCalled = false;
    const api = await keeper({
      renameForCommit: async (_source: string, _destination: string) => {
        injectedRenameCalled = true;
        await writeFile(outsideTarget, "escaped", "utf8");
        throw new Error("caller rename was invoked");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/internal-rename.md", managedBlock: { recordId: "rename", content: "safe" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .resolves.toMatchObject({ applied: true });
    expect(injectedRenameCalled).toBe(false);
    await expect(readFile(outsideTarget, "utf8")).rejects.toThrow();
  });
});

describe("validation integrity", () => {
  test("reports managed-block hash, source-revision hash, and unlisted managed-block diagnostics", async () => {
    const api = await keeper();
    const sourcePath = relative(project().repository, project().trackedText).replaceAll("\\", "/");
    const documentPath = "docs/project-design/integrity.md";
    const documentTarget = join(project().repository, ...documentPath.split("/"));
    await mkdir(join(documentTarget, ".."), { recursive: true });
    await writeFile(documentTarget, `${block("known", "body", `sha256:${"0".repeat(64)}`)}\n${block("unlisted", "extra")}\n`, "utf8");
    const pack = {
      managedBy: "project-design-keeper",
      schemaVersion: "1.0",
      scope: { root: ".", paths: ["docs"] },
      sourceRevision: { kind: "working-tree", files: { [sourcePath]: `sha256:${"a".repeat(64)}` } },
      documents: [{ id: "document", path: documentPath }],
      records: [{
        id: "known",
        domain: "design",
        scope: "project",
        statement: "Known statement",
        evidence: [`${sourcePath}:1`],
        impact: ["implementation"],
        status: "observed",
        strength: "informational",
        approval: "not-required",
        confidence: "high"
      }]
    };

    const result = await api.validatePack({ root: project().repository, pack }) as { valid: boolean; errors: Array<{ code: string }> };

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "managed_block_hash_mismatch",
      "source_revision_hash_mismatch",
      "managed_block_unlisted"
    ]));
  });
});

describe("Windows-safe canonical paths", () => {
  test("rejects an NTFS alternate-data-stream delete at preview", async () => {
    const target = join(project().repository, "docs", "project-design", "victim.md");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, block("victim", "keep"), "utf8");
    const api = await keeper();

    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path: "docs/project-design/victim.md::$DATA", delete: true }]
    })).rejects.toThrow(/invalid Windows path component/i);
  });

  test.each([
    "docs/project-design/con.md",
    "docs/project-design/aux.txt",
    "docs/project-design/bad?.md",
    "docs/project-design/trailing.md. "
  ])("rejects invalid or reserved Windows path %s", async (path) => {
    const api = await keeper();
    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path, managedBlock: { recordId: "path", content: "content" } }]
    })).rejects.toThrow(/invalid Windows path component/i);
  });

  test("uses the same path policy when validating a persisted changeset", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/safe.md", managedBlock: { recordId: "safe", content: "content" } }]
    });
    const stored = JSON.parse(await readFile(changesetPath(preview.changesetId), "utf8")) as Record<string, any>;
    stored.changes[0].path = "docs/project-design/victim.md::$DATA";
    expect(persistedChangesetSchema.safeParse(stored).success).toBe(false);
    await writeFile(changesetPath(preview.changesetId), JSON.stringify(stored), "utf8");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication/i);
  });
});

describe("persistent changeset authentication", () => {
  test("creates a persistent random key with restrictive POSIX permissions", async () => {
    const api = await keeper();
    await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/key.md", managedBlock: { recordId: "key", content: "content" } }]
    });

    const keyPath = join(cache(), "changeset-hmac.key");
    expect((await readFile(keyPath)).byteLength).toBe(32);
    expect((await lstat(keyPath)).isSymbolicLink()).toBe(false);
    if (process.platform !== "win32") expect((await stat(keyPath)).mode & 0o777).toBe(0o600);
  });

  test("rejects timestamp extension even when the thirty-minute relation remains valid", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/time.md", managedBlock: { recordId: "time", content: "content" } }]
    });
    await mutateChangeset(preview.changesetId, (stored) => {
      stored.createdAt += 60_000;
      stored.expiresAt += 60_000;
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("allows a fresh service instance to verify and apply an unchanged changeset", async () => {
    const first = await keeper();
    const preview = await first.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/restart.md", managedBlock: { recordId: "restart", content: "content" } }]
    });
    const second = await keeper();

    await expect(second.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .resolves.toMatchObject({ applied: true });
  });

  test("rejects an invalid persistent key instead of silently replacing it", async () => {
    const first = await keeper();
    const preview = await first.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/invalid-key.md", managedBlock: { recordId: "key", content: "content" } }]
    });
    await writeFile(join(cache(), "changeset-hmac.key"), "invalid", "utf8");
    const second = await keeper();

    await expect(second.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/HMAC key|authentication key|signature/i);
  });
});
