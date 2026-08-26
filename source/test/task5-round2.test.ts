import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createProjectDesignKeeper } from "../src/index.js";
import { createProjectFixture, removeProjectFixture, type ProjectFixture } from "./fixtures.js";

let fixture: ProjectFixture | undefined;
let cacheDirectory: string | undefined;

beforeEach(async () => {
  fixture = await createProjectFixture();
  cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-pack-gate-"));
});

afterEach(async () => {
  await removeProjectFixture(fixture);
  if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true });
  fixture = undefined;
  cacheDirectory = undefined;
});

function root(): string {
  if (!fixture) throw new Error("fixture missing");
  return fixture.repository;
}

function cache(): string {
  if (!cacheDirectory) throw new Error("cache missing");
  return cacheDirectory;
}

function managedChange(path: string) {
  return { path, managedBlock: { recordId: "gate.record", content: "# Gate\n" } };
}

const docsAliases = [
  "docs/project-design/gate.md",
  "./docs/project-design/gate.md",
  "docs\\project-design\\gate.md",
  "DOCS/PROJECT-DESIGN/gate.md"
] as const;

describe("core candidate pack gate", () => {
  test.each(docsAliases)("direct preview rejects packless docs alias %s before cache writes", async (path) => {
    const api = createProjectDesignKeeper({ cacheDirectory: cache() });
    await expect(api.previewUpdate({ root: root(), changes: [managedChange(path)] })).rejects.toThrow(/candidate pack/i);
    await expect(readdir(cache())).resolves.toEqual([]);
  });

  test("keeps a project-context Skill-only preview pack-optional", async () => {
    const api = createProjectDesignKeeper({ cacheDirectory: cache() });
    await expect(api.previewUpdate({
      root: root(),
      changes: [managedChange(".agents/skills/project-design-context/context.md")]
    })).resolves.toMatchObject({ applicable: true });
  });
});
