import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, link, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createProjectFixture,
  removeProjectFixture,
  type ProjectFixture
} from "./fixtures.js";
import { createTrustedTestKeeper } from "./keeper.js";

const execFile = promisify(execFileCallback);
const quickValidatorPath = join(
  process.env.CODEX_HOME ?? join(homedir(), ".codex"),
  "skills",
  ".system",
  "skill-creator",
  "scripts",
  "quick_validate.py"
);
const quickValidatorAvailable = existsSync(quickValidatorPath);
type KeeperModule = typeof import("../src/index.js");
type Keeper = KeeperModule["projectDesignKeeper"];

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-review-round4-cache-"));
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

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function block(recordId: string, content: string): string {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${hash(content)}" -->${content}<!-- /project-design-keeper:managed -->`;
}

function ownedJson(value: string): string {
  return `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", value }, null, 2)}\n`;
}

function canonicalSkill(description: string, content = "context"): string {
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

async function transactionArtifacts(root: string): Promise<string[]> {
  const found: string[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(path);
      if (/\.(?:stage|rollback|quarantine)$/u.test(entry.name)) found.push(path);
    }
  }
  await visit(root);
  return found.sort();
}

describe("canonical Keeper Skill frontmatter", () => {
  test.skipIf(!quickValidatorAvailable)("creates an exact JSON-quoted envelope that passes the real quick validator", async () => {
    const api = await keeper();
    const path = ".agents/skills/project-design-context/SKILL.md";
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path, content: canonicalSkill("Use when a feature needs project design context.") }]
    });
    await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });

    const skillDirectory = join(project().repository, ".agents", "skills", "project-design-context");
    const result = await execFile("python", [
      quickValidatorPath,
      skillDirectory
    ]);
    expect(result.stdout).toContain("Skill is valid!");
  });

  test("rejects a YAML-looking unquoted description containing a colon", async () => {
    const api = await keeper();
    const noncanonical = canonicalSkill("Use when foo bar.")
      .replace('description: "Use when foo bar."', "description: Use when foo: bar");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", content: noncanonical }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/canonical|frontmatter|skill/i)] });
  });

  test("rejects additional frontmatter fields outside the unique canonical envelope", async () => {
    const api = await keeper();
    const noncanonical = canonicalSkill("Use when context is needed.").replace("metadata:\n", "license: MIT\nmetadata:\n");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/SKILL.md", content: noncanonical }]
    });

    expect(preview.applicable).toBe(false);
  });
});

describe("hooks run before any staging bytes exist", () => {
  test("quarantines a delete by rename and restores it when the post-rename step fails", async () => {
    const relativePath = ".agents/skills/project-design-context/delete.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("delete-me");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let observedQuarantine = "";
    const api = await keeper({
      beforePostRenameIdentityCapture: async (path: string, phase: string, quarantineName?: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        observedQuarantine = String(quarantineName);
        await expect(readFile(target, "utf8")).rejects.toThrow();
        await expect(readFile(join(target, "..", observedQuarantine), "utf8")).resolves.toBe(original);
        throw new Error("fault after quarantine rename");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, delete: true }] });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/fault after quarantine rename/i);
    expect(observedQuarantine).toMatch(/^\.delete\.json\.project-design-keeper-[0-9a-f-]+\.quarantine$/u);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
    expect(await transactionArtifacts(project().repository)).toEqual([]);
    await expect(readdir(join(cache(), "snapshots"))).resolves.toHaveLength(1);
  });

  test("rolls back a creation when identity inspection fails immediately after its rename", async () => {
    const relativePath = ".agents/skills/project-design-context/post-rename.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const api = await keeper({
      beforePostRenameIdentityCapture: async (path: string, phase: string) => {
        if (path === relativePath && phase === "replacement") {
          throw new Error("post-rename identity capture fault");
        }
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: relativePath, content: ownedJson("created") }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/post-rename identity capture fault/i);
    await expect(readFile(target, "utf8")).rejects.toThrow();
    expect(await transactionArtifacts(project().repository)).toEqual([]);
    await expect(readdir(join(cache(), "snapshots"))).resolves.toHaveLength(1);
  });

  test("retains and reports a rollback quarantine when its post-rename identity capture is ambiguous", async () => {
    const relativePath = ".agents/skills/project-design-context/rollback-evidence.json";
    const target = join(project().repository, ...relativePath.split("/"));
    let rollbackName = "";
    const api = await keeper({
      beforePostRenameIdentityCapture: async (path: string, phase: string, quarantineName?: string) => {
        if (path !== relativePath) return;
        if (phase === "replacement") throw new Error("trigger rollback after replacement rename");
        if (phase === "rollback-target") {
          rollbackName = String(quarantineName);
          throw new Error("rollback identity capture fault");
        }
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: relativePath, content: ownedJson("created") }]
    });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(rollbackName).toMatch(/^\.rollback-evidence\.json\.project-design-keeper-[0-9a-f-]+\.rollback$/u);
    expect(failure!.message).toContain(rollbackName);
    expect(failure!.message).not.toContain(project().repository);
    await expect(readFile(target, "utf8")).rejects.toThrow();
    expect((await transactionArtifacts(project().repository)).map((path) => path.split(/[\\/]/u).at(-1)))
      .toEqual([rollbackName]);
    await expect(readdir(join(cache(), "snapshots"))).resolves.toHaveLength(1);
  });

  test("preserves replacement quarantine and recovery evidence when cleanup identity becomes ambiguous", async () => {
    const relativePath = ".agents/skills/project-design-context/cleanup.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let replacementEvidence = "";
    const api = await keeper({
      beforeQuarantineCleanup: async (_path: string, quarantineName: string) => {
        const quarantine = join(target, "..", quarantineName);
        replacementEvidence = `${quarantine}.replacement`;
        await rename(quarantine, replacementEvidence);
        await writeFile(quarantine, "unowned replacement", "utf8");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/cleanup|rollback|ambiguous|quarantine/i);
    expect(failure!.message).not.toContain(project().repository);
    await expect(readFile(replacementEvidence, "utf8")).resolves.toBe(original);
    await expect(readdir(join(cache(), "snapshots"))).resolves.toHaveLength(1);
  });

  test("rejects an in-place same-length rewrite of the owned temporary inode", async () => {
    const relativePath = ".agents/skills/project-design-context/temp-rewrite.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    const attacker = ownedJson("evil!");
    expect(Buffer.byteLength(attacker)).toBe(Buffer.byteLength(replacement));
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper({
      beforeMutationRename: async (path: string, _index: number, phase: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        const temporary = (await transactionArtifacts(project().repository)).find((entry) => entry.endsWith(".stage"));
        if (!temporary) throw new Error("temporary artifact was not found");
        await writeFile(temporary, attacker, "utf8");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/temporary|identity|stale|changed/i);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
  });

  test("rejects growth of the owned temporary inode before publication", async () => {
    const relativePath = ".agents/skills/project-design-context/temp-growth.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper({
      beforeMutationRename: async (path: string, _index: number, phase: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        const temporary = (await transactionArtifacts(project().repository)).find((entry) => entry.endsWith(".stage"));
        if (!temporary) throw new Error("temporary artifact was not found");
        await writeFile(temporary, `${replacement}attacker-growth`, "utf8");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/temporary|identity|stale|changed/i);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
  });

  test("rejects a new hard link to the owned temporary inode", async () => {
    const relativePath = ".agents/skills/project-design-context/temp-link.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    const linked = join(target, "..", "temp-link-evidence");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper({
      beforeMutationRename: async (path: string, _index: number, phase: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        const temporary = (await transactionArtifacts(project().repository)).find((entry) => entry.endsWith(".stage"));
        if (!temporary) throw new Error("temporary artifact was not found");
        await link(temporary, linked);
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/temporary|identity|link|ambiguous/i);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
    await expect(readFile(linked, "utf8")).resolves.toBe(replacement);
  });

  test.skipIf(process.platform === "win32")("rejects a chmod of the owned temporary inode", async () => {
    const relativePath = ".agents/skills/project-design-context/temp-mode.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper({
      beforeMutationRename: async (path: string, _index: number, phase: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        const temporary = (await transactionArtifacts(project().repository)).find((entry) => entry.endsWith(".stage"));
        if (!temporary) throw new Error("temporary artifact was not found");
        await chmod(temporary, 0o400);
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/temporary|identity|mode|changed/i);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
  });

  test("does not overwrite a destination occupied immediately before the final replacement rename", async () => {
    const relativePath = ".agents/skills/project-design-context/occupied-destination.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    const attacker = ownedJson("attacker");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    const api = await keeper({
      beforeMutationRename: async (path: string, _index: number, phase: string) => {
        if (path === relativePath && phase === "replacement") {
          await writeFile(target, attacker, { encoding: "utf8", flag: "wx" });
        }
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: relativePath, content: replacement }]
    });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/identity|missing|rename|rollback|cleanup|ambiguous/i);
    expect(failure!.message).not.toContain(project().repository);
    await expect(readFile(target, "utf8")).resolves.toBe(attacker);
    const evidence = await transactionArtifacts(project().repository);
    expect(evidence.some((path) => path.endsWith(".quarantine"))).toBe(true);
    await expect(Promise.all(evidence.filter((path) => path.endsWith(".quarantine"))
      .map((path) => readFile(path, "utf8")))).resolves.toContain(original);
  });

  test("retains a same-length rewritten quarantine instead of restoring corrupted bytes", async () => {
    const relativePath = ".agents/skills/project-design-context/quarantine-rewrite.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const attacker = ownedJson("evil!!");
    expect(Buffer.byteLength(attacker)).toBe(Buffer.byteLength(original));
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let quarantineName = "";
    const api = await keeper({
      afterMutationRename: async (path: string, phase: string, name?: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        quarantineName = String(name);
        await writeFile(join(target, "..", quarantineName), attacker, "utf8");
        throw new Error("force rollback after quarantine rewrite");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: ownedJson("after!") }] });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toContain(quarantineName);
    expect(failure!.message).not.toContain(project().repository);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "..", quarantineName), "utf8")).resolves.toBe(attacker);
  });

  test("retains a newly hard-linked quarantine instead of restoring it", async () => {
    const relativePath = ".agents/skills/project-design-context/quarantine-link.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const linked = join(target, "..", "quarantine-link-evidence");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let quarantineName = "";
    const api = await keeper({
      afterMutationRename: async (path: string, phase: string, name?: string) => {
        if (path !== relativePath || phase !== "quarantine") return;
        quarantineName = String(name);
        await link(join(target, "..", quarantineName), linked);
        throw new Error("force rollback after quarantine link");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: ownedJson("after") }] });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toContain(quarantineName);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "..", quarantineName), "utf8")).resolves.toBe(original);
    await expect(readFile(linked, "utf8")).resolves.toBe(original);
  });

  test("retains and reports a same-length rewritten rollback-discard artifact", async () => {
    const relativePath = ".agents/skills/project-design-context/rollback-rewrite.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    const attacker = ownedJson("evil!");
    expect(Buffer.byteLength(attacker)).toBe(Buffer.byteLength(replacement));
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let rollbackName = "";
    const api = await keeper({
      afterMutationRename: async (path: string, phase: string) => {
        if (path === relativePath && phase === "replacement") throw new Error("force rollback after replacement");
      },
      beforePostRenameIdentityCapture: async (path: string, phase: string, name?: string) => {
        if (path !== relativePath || phase !== "rollback-target") return;
        rollbackName = String(name);
        await writeFile(join(target, "..", rollbackName), attacker, "utf8");
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toContain(rollbackName);
    expect(failure!.message).not.toContain(project().repository);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "..", rollbackName), "utf8")).resolves.toBe(attacker);
  });

  test("retains and reports a newly hard-linked rollback-discard artifact", async () => {
    const relativePath = ".agents/skills/project-design-context/rollback-link.json";
    const target = join(project().repository, ...relativePath.split("/"));
    const original = ownedJson("before");
    const replacement = ownedJson("after");
    const linked = join(target, "..", "rollback-link-evidence");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, original, "utf8");
    let rollbackName = "";
    const api = await keeper({
      afterMutationRename: async (path: string, phase: string) => {
        if (path === relativePath && phase === "replacement") throw new Error("force rollback after replacement");
      },
      beforePostRenameIdentityCapture: async (path: string, phase: string, name?: string) => {
        if (path !== relativePath || phase !== "rollback-target") return;
        rollbackName = String(name);
        await link(join(target, "..", rollbackName), linked);
      }
    });
    const preview = await api.previewUpdate({ root: project().repository, changes: [{ path: relativePath, content: replacement }] });

    const failure = await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId })
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toContain(rollbackName);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "..", rollbackName), "utf8")).resolves.toBe(replacement);
    await expect(readFile(linked, "utf8")).resolves.toBe(replacement);
  });

  test("beforeCommit observes no stage file and a thrown hook leaves every location clean", async () => {
    const target = join(project().repository, ".agents", "skills", "project-design-context", "hook.json");
    await mkdir(join(target, ".."), { recursive: true });
    const original = ownedJson("before");
    await writeFile(target, original, "utf8");
    let observedDuringHook: string[] = [];
    const api = await keeper({
      beforeCommit: async () => {
        observedDuringHook = await transactionArtifacts(project().root);
        throw new Error("precommit fault");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/hook.json", content: ownedJson("after") }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/precommit fault/i);
    expect(observedDuringHook).toEqual([]);
    await expect(readFile(target, "utf8")).resolves.toBe(original);
    expect(await transactionArtifacts(project().root)).toEqual([]);
    expect(await transactionArtifacts(cache())).toEqual([]);
  });

  test("a beforeRename parent swap is rejected without residue in the original, moved, outside, or cache trees", async () => {
    const parent = join(project().repository, ".agents", "skills", "project-design-context", "swap");
    const moved = join(project().repository, ".agents", "skills", "project-design-context", "swap-moved");
    const outside = join(project().root, "outside-swap");
    await mkdir(parent, { recursive: true });
    await mkdir(outside, { recursive: true });
    const api = await keeper({
      beforeRename: async () => {
        await rename(parent, moved);
        await symlink(outside, parent, "junction");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/swap/output.md", managedBlock: { recordId: "swap", content: "content" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/symbolic|junction|outside|containment/i);
    await expect(readFile(join(moved, "output.md"), "utf8")).rejects.toThrow();
    await expect(readdir(outside)).resolves.toEqual([]);
    expect(await transactionArtifacts(project().repository)).toEqual([]);
    expect(await transactionArtifacts(moved)).toEqual([]);
    expect(await transactionArtifacts(outside)).toEqual([]);
    expect(await transactionArtifacts(cache())).toEqual([]);
  });

  test("a later beforeStageWrite fault occurs before any internal stage write", async () => {
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const one = join(directory, "one.json");
    const two = join(directory, "two.json");
    await mkdir(directory, { recursive: true });
    const beforeOne = ownedJson("one-before");
    const beforeTwo = ownedJson("two-before");
    await writeFile(one, beforeOne, "utf8");
    await writeFile(two, beforeTwo, "utf8");
    const api = await keeper({
      beforeStageWrite: async (_path: string, index: number) => {
        if (index === 1) throw new Error("second pre-stage fault");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/one.json", content: ownedJson("one-after") },
        { path: ".agents/skills/project-design-context/two.json", content: ownedJson("two-after") }
      ]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/second pre-stage fault/i);
    await expect(readFile(one, "utf8")).resolves.toBe(beforeOne);
    await expect(readFile(two, "utf8")).resolves.toBe(beforeTwo);
    expect(await transactionArtifacts(project().root)).toEqual([]);
  });

  test("ignores the removed writeForStage seam and performs the write internally", async () => {
    const api = await keeper({
      writeForStage: async () => { throw new Error("external stage writer invoked"); }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/internal-stage.md", managedBlock: { recordId: "stage", content: "content" } }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .resolves.toMatchObject({ applied: true });
  });
});

describe("cache boundary and filesystem safety", () => {
  test("rejects a cache directory inside the project before creating cache files", async () => {
    cacheDirectory = join(project().repository, ".keeper-cache");
    const api = await keeper();

    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/cache-inside.md", managedBlock: { recordId: "cache", content: "content" } }]
    })).rejects.toThrow(/cache.*project|project.*cache/i);
    await expect(readFile(join(cache(), "changeset-hmac.key"))).rejects.toThrow();
    await expect(readFile(join(project().repository, ".agents", "skills", "project-design-context", "cache-inside.md"))).rejects.toThrow();
  });

  test("rejects a project nested inside the cache root", async () => {
    cacheDirectory = project().root;
    const api = await keeper();

    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/project-inside.md", managedBlock: { recordId: "cache", content: "content" } }]
    })).rejects.toThrow(/cache.*project|project.*cache/i);
  });

  test("rejects a changesets junction into the project before writing through it", async () => {
    const before = (await readdir(project().repository)).sort();
    await symlink(project().repository, join(cache(), "changesets"), "junction");
    const api = await keeper();

    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/junction.md", managedBlock: { recordId: "junction", content: "content" } }]
    })).rejects.toThrow(/cache.*symbolic|junction|reparse/i);
    await expect(readdir(project().repository)).resolves.toEqual(before);
  });

  test("validates the snapshots directory during preview even before a snapshot is needed", async () => {
    await symlink(project().repository, join(cache(), "snapshots"), "junction");
    const api = await keeper();

    await expect(api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/snapshot-junction.md", managedBlock: { recordId: "snapshot", content: "content" } }]
    })).rejects.toThrow(/cache.*symbolic|junction|reparse/i);
  });

  test.skipIf(process.platform === "win32")("repairs cache directories and the HMAC key to owner-only permissions", async () => {
    await chmod(cache(), 0o755);
    const first = await keeper();
    const preview = await first.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/permissions.md", managedBlock: { recordId: "permissions", content: "content" } }]
    });
    const key = join(cache(), "changeset-hmac.key");
    await chmod(key, 0o644);
    const second = await keeper();
    await second.applyUpdate({ root: project().repository, changesetId: preview.changesetId });

    expect((await stat(cache())).mode & 0o777).toBe(0o700);
    expect((await stat(join(cache(), "changesets"))).mode & 0o777).toBe(0o700);
    expect((await stat(join(cache(), "snapshots"))).mode & 0o777).toBe(0o700);
    expect((await stat(key)).mode & 0o777).toBe(0o600);
  });

  test("two fresh services initialize one key and can concurrently preview then apply", async () => {
    const [first, second] = await Promise.all([keeper(), keeper()]);
    const [one, two] = await Promise.all([
      first.previewUpdate({
        root: project().repository,
        changes: [{ path: ".agents/skills/project-design-context/concurrent-one.md", managedBlock: { recordId: "one", content: "one" } }]
      }),
      second.previewUpdate({
        root: project().repository,
        changes: [{ path: ".agents/skills/project-design-context/concurrent-two.md", managedBlock: { recordId: "two", content: "two" } }]
      })
    ]);

    await expect(Promise.all([
      first.applyUpdate({ root: project().repository, changesetId: one.changesetId }),
      second.applyUpdate({ root: project().repository, changesetId: two.changesetId })
    ])).resolves.toEqual([
      expect.objectContaining({ applied: true }),
      expect.objectContaining({ applied: true })
    ]);
    expect((await readFile(join(cache(), "changeset-hmac.key"))).byteLength).toBe(32);
  });
});
