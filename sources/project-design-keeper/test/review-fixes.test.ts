import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-review-cache-"));
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

function ownedJson(extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ managedBy: "project-design-keeper", schemaVersion: "1.0", ...extra }, null, 2)}\n`;
}

function canonicalPack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0",
    scope: { root: ".", paths: ["Source"] },
    sourceRevision: { kind: "snapshot", files: { "Source/game.ts": hash("source line\n") } },
    documents: [{ id: "overview", path: "docs/project-design/overview.md" }],
    records: [{
      id: "combat.damage",
      domain: "combat",
      scope: "damage",
      statement: "Damage is authoritative.",
      evidence: ["Source/game.ts:1"],
      impact: ["Network damage"],
      status: "declared",
      strength: "required",
      approval: "confirmed",
      confidence: "high"
    }],
    ...overrides
  };
}

function changesetPath(id: unknown): string {
  return join(cache(), "changesets", `${String(id)}.json`);
}

describe("canonical managed output paths", () => {
  test("rejects a repository-internal symlink used as a managed output root", async () => {
    const api = await keeper();
    const destination = join(project().repository, "internal-output");
    await mkdir(destination);
    await symlink(destination, join(project().repository, "docs", "project-design"), "junction");

    await expect(api.previewUpdate({
      root: project().repository,
      pack: {},
      changes: [{ path: "docs/project-design/new.md", content: "new\n" }]
    })).rejects.toThrow(/symbolic|symlink/i);
  });

  test("rejects an existing target symlink even when it resolves inside the managed root", async () => {
    const api = await keeper();
    const directory = join(project().repository, "docs", "project-design");
    await mkdir(directory, { recursive: true });
    const realDirectory = join(directory, "real-directory");
    await mkdir(realDirectory);
    const realTarget = join(realDirectory, "real.md");
    await writeFile(realTarget, block("record", "old"), "utf8");
    await symlink(realDirectory, join(directory, "alias-directory"), "junction");

    await expect(api.previewUpdate({
      root: project().repository,
      pack: {},
      changes: [{ path: "docs/project-design/alias-directory/real.md", managedBlock: { recordId: "record", content: "new" } }]
    })).rejects.toThrow(/symbolic|symlink/i);
  });

  test("canonicalizes separator and dot aliases before grouping a target", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/./aliases.md", managedBlock: { recordId: "one", content: "one" } },
        { path: ".AGENTS\\SKILLS\\PROJECT-DESIGN-CONTEXT\\aliases.md", managedBlock: { recordId: "two", content: "two" } }
      ]
    });

    expect(preview.changes).toHaveLength(1);
    await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });
    const contents = await readFile(join(project().repository, ".agents", "skills", "project-design-context", "aliases.md"), "utf8");
    expect(contents).toContain(block("one", "one"));
    expect(contents).toContain(block("two", "two"));
  });
});

describe("Keeper ownership boundaries", () => {
  test("returns a conflict instead of overwriting an existing manual target", async () => {
    const api = await keeper();
    const target = join(project().repository, ".agents", "skills", "project-design-context", "manual.md");
    await mkdir(join(project().repository, ".agents", "skills", "project-design-context"), { recursive: true });
    await writeFile(target, "manual text\n", "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/manual.md", content: "replacement\n" }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/unmanaged|owned/i)] });
    expect(preview).not.toHaveProperty("changesetId");
  });

  test("returns a conflict instead of deleting an existing manual target", async () => {
    const api = await keeper();
    const target = join(project().repository, ".agents", "skills", "project-design-context", "manual.md");
    await mkdir(join(project().repository, ".agents", "skills", "project-design-context"), { recursive: true });
    await writeFile(target, "manual text\n", "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/manual.md", delete: true }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/unmanaged|owned/i)] });
  });

  test("requires explicit Keeper ownership and schema before updating a manifest", async () => {
    const api = await keeper();
    const directory = join(project().repository, "docs", "project-design");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "manifest.json"), "{}\n", "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      pack: {},
      changes: [{ path: "docs/project-design/manifest.json", content: ownedJson({ records: [] }) }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/ownership|schema|unmanaged/i)] });
  });

  test("requires a replacement JSON document to retain Keeper ownership and schema", async () => {
    const api = await keeper();
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "owned.json"), ownedJson({ value: "before" }), "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/owned.json", content: "{}\n" }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/ownership|schema/i)] });
  });

  test("requires structurally valid managed markers rather than a marker substring", async () => {
    const api = await keeper();
    const directory = join(project().repository, "docs", "project-design");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "fake.md"), "<!-- project-design-keeper:managed record-id=broken -->\n", "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      pack: {},
      changes: [{ path: "docs/project-design/new.md", content: "new\n" }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/unmanaged|marker/i)] });
  });

  test("requires managed-block operations for later Markdown updates", async () => {
    const api = await keeper();
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "managed.md"), block("record", "old"), "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/managed.md", content: "full replacement\n" }]
    });

    expect(preview).toMatchObject({ applicable: false, conflicts: [expect.stringMatching(/managed block/i)] });
  });

  test("groups multiple record updates into one managed-file change", async () => {
    const api = await keeper();
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "multi.md"), `${block("one", "old one")}\n${block("two", "old two")}`, "utf8");

    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/multi.md", managedBlock: { recordId: "one", content: "new one" } },
        { path: ".agents/skills/project-design-context/multi.md", managedBlock: { recordId: "two", content: "new two" } }
      ]
    });

    expect(preview.changes).toHaveLength(1);
    await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });
    await expect(readFile(join(directory, "multi.md"), "utf8")).resolves.toBe(`${block("one", "new one")}\n${block("two", "new two")}`);
  });
});

describe("deep canonical pack validation", () => {
  test("rejects every schema version except the supported 1.0 version", async () => {
    const api = await keeper();

    await expect(api.validatePack({ root: project().repository, pack: canonicalPack({ schemaVersion: "2.0" }) }))
      .resolves.toMatchObject({ valid: false });
  });

  test("rejects empty or untyped scope and source revision metadata", async () => {
    const api = await keeper();

    await expect(api.validatePack({ root: project().repository, pack: canonicalPack({ scope: {}, sourceRevision: {} }) }))
      .resolves.toMatchObject({ valid: false });
  });

  test("rejects duplicate document or knowledge-record identifiers", async () => {
    const api = await keeper();
    const base = (canonicalPack().records as Array<Record<string, unknown>>)[0];
    const packs = [canonicalPack({ documents: [
        { id: "duplicate", path: "docs/project-design/one.md" },
        { id: "duplicate", path: "docs/project-design/two.md" }
      ] }), canonicalPack({ records: [{ ...base, id: "duplicate" }, { ...base, id: "duplicate" }] })];

    for (const pack of packs) {
      await expect(api.validatePack({ root: project().repository, pack })).resolves.toMatchObject({ valid: false });
    }
  });

  test("rejects noncanonical or unsafe document paths", async () => {
    const api = await keeper();
    const pack = canonicalPack({ documents: [{ id: "unsafe", path: "docs/project-design/../outside.md" }] });

    await expect(api.validatePack({ root: project().repository, pack })).resolves.toMatchObject({ valid: false });
  });

  test("rejects missing, self-referential, or cyclic supersession graph edges", async () => {
    const api = await keeper();
    const base = (canonicalPack().records as Array<Record<string, unknown>>)[0];
    const packs = [
      canonicalPack({ records: [{ ...base, supersedes: "missing" }] }),
      canonicalPack({ records: [{ ...base, supersedes: base.id }] }),
      canonicalPack({ records: [{ ...base, id: "one", supersedes: "two" }, { ...base, id: "two", supersedes: "one" }] })
    ];

    for (const pack of packs) {
      await expect(api.validatePack({ root: project().repository, pack })).resolves.toMatchObject({ valid: false });
    }
  });
});

describe("persisted changeset integrity", () => {
  test("round-trips an explicitly selected repository-root source scope", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      path: ".",
      changes: [{ path: ".agents/skills/project-design-context/root-scope.md", content: block("root-scope", "new\n") }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .resolves.toMatchObject({ applied: true });
  });

  test("deep-validates cached change content before applying it", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/corrupt.md", content: block("corrupt", "new\n") }]
    });
    const path = changesetPath(preview.changesetId);
    const stored = JSON.parse(await readFile(path, "utf8"));
    stored.changes[0].content = 42;
    await writeFile(path, JSON.stringify(stored), "utf8");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/malformed|changeset/i);
  });

  test("rejects a cached changeset whose internal UUID differs from its filename", async () => {
    const api = await keeper();
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/id.md", content: block("id", "new\n") }]
    });
    const path = changesetPath(preview.changesetId);
    const stored = JSON.parse(await readFile(path, "utf8"));
    stored.changesetId = "00000000-0000-4000-8000-000000000000";
    await writeFile(path, JSON.stringify(stored), "utf8");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

  test("rechecks output ownership after loading a cached JSON update", async () => {
    const api = await keeper();
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "owned.json"), ownedJson({ value: "before" }), "utf8");
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/owned.json", content: ownedJson({ value: "after" }) }]
    });
    const path = changesetPath(preview.changesetId);
    const stored = JSON.parse(await readFile(path, "utf8"));
    stored.changes[0].content = "{}\n";
    await writeFile(path, JSON.stringify(stored), "utf8");

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/signature|authentication|tamper/i);
  });

});

describe("apply commit-window safety", () => {
  test("rejects a target mutation that occurs while outputs are being staged", async () => {
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const target = join(directory, "owned.json");
    await mkdir(directory, { recursive: true });
    await writeFile(target, ownedJson({ value: "before" }), "utf8");
    const api = await keeper({
      beforeCommit: async () => {
        await writeFile(target, ownedJson({ value: "external" }), "utf8");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/owned.json", content: ownedJson({ value: "after" }) }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/stale/i);
    await expect(readFile(target, "utf8")).resolves.toBe(ownedJson({ value: "external" }));
  });

  test("rechecks the manifest after staging but before commit", async () => {
    const directory = join(project().repository, "docs", "project-design");
    const manifest = join(directory, "manifest.json");
    await mkdir(directory, { recursive: true });
    await writeFile(manifest, ownedJson({ records: [] }), "utf8");
    const api = await keeper({
      beforeCommit: async () => {
        await writeFile(manifest, ownedJson({ records: ["external"] }), "utf8");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/context.md", content: block("context", "new\n") }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/manifest|source|stale/i);
    await expect(readFile(join(project().repository, ".agents", "skills", "project-design-context", "context.md"), "utf8"))
      .rejects.toThrow();
  });

  test("rechecks selected source files after staging but before commit", async () => {
    const api = await keeper({
      beforeCommit: async () => {
        await writeFile(project().trackedText, "external source mutation\n", "utf8");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [{ path: ".agents/skills/project-design-context/source-check.md", content: block("source-check", "new\n") }]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/source|stale/i);
    await expect(readFile(join(project().repository, ".agents", "skills", "project-design-context", "source-check.md"), "utf8"))
      .rejects.toThrow();
  });

  test("removes nested directories created before a pre-stage hook failure", async () => {
    const api = await keeper({
      beforeStageWrite: async (_path: string, index: number) => {
        if (index === 1) throw new Error("nested staging failure");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/deep/one.md", content: block("one", "one\n") },
        { path: ".agents/skills/project-design-context/deep/two.md", content: block("two", "two\n") }
      ]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/nested staging failure/i);
    await expect(stat(join(project().repository, ".agents", "skills", "project-design-context"))).rejects.toThrow();
  });

  test("preserves regular targets and their original mode after a pre-stage fault", async () => {
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const one = join(directory, "one.json");
    const two = join(directory, "two.json");
    await mkdir(directory, { recursive: true });
    await writeFile(one, ownedJson({ value: "one before" }), "utf8");
    await writeFile(two, ownedJson({ value: "two before" }), "utf8");
    await chmod(one, 0o600);
    const originalMode = (await stat(one)).mode & 0o777;
    const api = await keeper({
      beforeStageWrite: async (_path: string, index: number) => {
        if (index === 1) throw new Error("commit failure");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/one.json", content: ownedJson({ value: "one after" }) },
        { path: ".agents/skills/project-design-context/two.json", content: ownedJson({ value: "two after" }) }
      ]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/commit failure/i);
    expect((await stat(one)).mode & 0o777).toBe(originalMode);
    await expect(readFile(one, "utf8")).resolves.toBe(ownedJson({ value: "one before" }));
    await expect(readFile(two, "utf8")).resolves.toBe(ownedJson({ value: "two before" }));
  });

  test("leaves both targets unchanged after a pure pre-stage fault", async () => {
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const one = join(directory, "committed.json");
    const two = join(directory, "uncommitted.json");
    await mkdir(directory, { recursive: true });
    await writeFile(one, ownedJson({ value: "one before" }), "utf8");
    await writeFile(two, ownedJson({ value: "two before" }), "utf8");
    const api = await keeper({
      beforeStageWrite: async (_path: string, index: number) => {
        if (index === 1) throw new Error("second commit failure");
      }
    });
    const preview = await api.previewUpdate({
      root: project().repository,
      changes: [
        { path: ".agents/skills/project-design-context/committed.json", content: ownedJson({ value: "one after" }) },
        { path: ".agents/skills/project-design-context/uncommitted.json", content: ownedJson({ value: "two after" }) }
      ]
    });

    await expect(api.applyUpdate({ root: project().repository, changesetId: preview.changesetId }))
      .rejects.toThrow(/second commit failure/i);
    await expect(readFile(one, "utf8")).resolves.toBe(ownedJson({ value: "one before" }));
    await expect(readFile(two, "utf8")).resolves.toBe(ownedJson({ value: "two before" }));
  });
});

describe("deterministic recovery snapshots", () => {
  test("uses collision-free recovery files with existed, content, mode, and type and keeps latest ten", async () => {
    let clock = 1_900_000_000_000;
    const api = await keeper({ now: () => clock++ });
    const directory = join(project().repository, ".agents", "skills", "project-design-context");
    const target = join(directory, "history.json");
    await mkdir(directory, { recursive: true });
    await writeFile(target, ownedJson({ value: 0 }), "utf8");

    for (let value = 1; value <= 11; value += 1) {
      const preview = await api.previewUpdate({
        root: project().repository,
        changes: [{ path: ".agents/skills/project-design-context/history.json", content: ownedJson({ value }) }]
      });
      await api.applyUpdate({ root: project().repository, changesetId: preview.changesetId });
    }

    const [projectDirectory] = await readdir(join(cache(), "snapshots"));
    const names = (await readdir(join(cache(), "snapshots", projectDirectory))).sort();
    expect(names).toHaveLength(10);
    expect(names.every((name) => /^[0-9]+-[0-9a-f-]+-[0-9a-f-]+\.json$/u.test(name))).toBe(true);
    const snapshots = await Promise.all(names.map(async (name) =>
      JSON.parse(await readFile(join(cache(), "snapshots", projectDirectory, name), "utf8"))));
    const newest = snapshots.sort((left, right) => right.createdAt - left.createdAt)[0];
    expect(newest).toMatchObject({ files: {
      ".agents/skills/project-design-context/history.json": {
        existed: true,
        content: expect.any(String),
        mode: expect.any(Number),
        type: "file"
      }
    } });
  }, 20_000);
});
