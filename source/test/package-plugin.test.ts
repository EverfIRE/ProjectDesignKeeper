import { execFile as execFileCallback } from "node:child_process";
import { copyFile, cp, link, mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

const execFile = promisify(execFileCallback);
const pluginRoot = resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];
const exactPackageFiles = [
  "cordis.patch.yml",
  "dist/plugin.js",
  "package.json",
  "skills/distill-project-design/SKILL.md",
  "skills/distill-project-design/assets/knowledge-pack/architecture.md.template",
  "skills/distill-project-design/assets/knowledge-pack/archive-index.md.template",
  "skills/distill-project-design/assets/knowledge-pack/conventions.md.template",
  "skills/distill-project-design/assets/knowledge-pack/decisions.md.template",
  "skills/distill-project-design/assets/knowledge-pack/evidence-map.md.template",
  "skills/distill-project-design/assets/knowledge-pack/index.md.template",
  "skills/distill-project-design/assets/knowledge-pack/intent.md.template",
  "skills/distill-project-design/assets/knowledge-pack/manifest.json",
  "skills/distill-project-design/assets/knowledge-pack/module.md.template",
  "skills/distill-project-design/assets/knowledge-pack/open-questions.md.template",
  "skills/distill-project-design/assets/knowledge-pack/principles.md.template",
  "skills/distill-project-design/assets/knowledge-pack/tuning.md.template",
  "skills/distill-project-design/assets/knowledge-pack/verification.md.template",
  "skills/distill-project-design/assets/project-design-context/SKILL.md",
  "skills/distill-project-design/references/document-contract.md",
  "skills/distill-project-design/references/knowledge-model.md",
  "skills/distill-project-design/references/tool-contract.md",
  "skills/distill-project-design/references/workflow.md"
] as const;

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createVerifierFixture(): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "keeper-verify-package-"));
  temporaryRoots.push(root);
  for (const relativePath of exactPackageFiles) {
    const source = resolve(pluginRoot, ...relativePath.split("/"));
    const destination = resolve(root, ...relativePath.split("/"));
    await mkdir(resolve(destination, ".."), { recursive: true });
    await cp(source, destination);
  }
  await mkdir(join(root, "scripts"), { recursive: true });
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    copyFile(resolve(pluginRoot, "scripts/verify-package.mjs"), join(root, "scripts/verify-package.mjs"))
  ]);
  await execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], { cwd: root });
  return { root, target: join(root, ".package", "project-design-keeper") };
}

async function verifyFixture(root: string): Promise<{ exitCode: number; output: string }> {
  try {
    const result = await execFile(process.execPath, [join(root, "scripts/verify-package.mjs")], {
      cwd: root,
      encoding: "utf8"
    });
    return { exitCode: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}${failure.message}`
    };
  }
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await readFile(path);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function createCleanupRaceFixture(prefix: string): Promise<{
  root: string;
  target: string;
  barrier: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  const target = join(root, ".package", "project-design-keeper");
  const barrier = join(root, "package-test-barrier");
  await Promise.all([
    mkdir(join(root, "dist"), { recursive: true }),
    mkdir(join(root, "scripts"), { recursive: true }),
    mkdir(join(root, "skills"), { recursive: true }),
    mkdir(target, { recursive: true }),
    mkdir(barrier)
  ]);
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    writeFile(join(root, "cordis.patch.yml"), "# fixture patch\n", "utf8"),
    writeFile(join(root, "dist/plugin.js"), "export {};\n", "utf8"),
    writeFile(join(root, "package.json"), "{}\n", "utf8"),
    writeFile(join(root, "skills/SKILL.md"), "# Fixture\n", "utf8"),
    writeFile(join(target, "sentinel.txt"), "original package evidence\n", "utf8")
  ]);
  return { root, target, barrier };
}

function startCleanupRace(root: string, barrier: string, phase: string) {
  return execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      KEEPER_PACKAGE_TEST_ROOT: root,
      KEEPER_PACKAGE_TEST_BARRIER: barrier,
      KEEPER_PACKAGE_TEST_BARRIER_PHASE: phase
    }
  });
}

async function readBarrierMetadata(barrier: string): Promise<{ phase: string; quarantinePath: string }> {
  return JSON.parse(await readFile(join(barrier, "entered"), "utf8")) as {
    phase: string;
    quarantinePath: string;
  };
}

async function releaseCleanupRace(barrier: string): Promise<void> {
  await writeFile(join(barrier, "release"), "release\n", "utf8");
}

test("normalizes CRLF text when building the release package", async () => {
  const root = await mkdtemp(join(tmpdir(), "keeper-package-plugin-"));
  temporaryRoots.push(root);

  await Promise.all([
    mkdir(join(root, "dist"), { recursive: true }),
    mkdir(join(root, "scripts"), { recursive: true }),
    mkdir(join(root, "skills"), { recursive: true })
  ]);
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    writeFile(join(root, "cordis.patch.yml"), "# fixture patch\n", "utf8"),
    writeFile(join(root, "dist/plugin.js"), "export {}\r\n", "utf8"),
    writeFile(join(root, "package.json"), "{}\n", "utf8"),
    writeFile(join(root, "skills/SKILL.md"), "# Fixture\r\n\r\nBody\r\n", "utf8"),
    writeFile(join(root, "skills/document.md.template"), "# Template\r\n\r\nBody\r\n", "utf8"),
    writeFile(join(root, "skills/opaque.bin"), Buffer.from([0x00, 0x0d, 0x0a, 0xff]))
  ]);

  await execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], { cwd: root });

  await expect(readFile(join(root, ".package/project-design-keeper/skills/SKILL.md"), "utf8"))
    .resolves.toBe("# Fixture\n\nBody\n");
  await expect(readFile(join(root, ".package/project-design-keeper/skills/document.md.template"), "utf8"))
    .resolves.toBe("# Template\n\nBody\n");
  await expect(readFile(join(root, ".package/project-design-keeper/dist/plugin.js"), "utf8"))
    .resolves.toBe("export {}\n");
  await expect(readFile(join(root, ".package/project-design-keeper/skills/opaque.bin")))
    .resolves.toEqual(Buffer.from([0x00, 0x0d, 0x0a, 0xff]));
});

test("binds every Node release reader to high-resolution file version metadata", async () => {
  const packager = await readFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), "utf8");
  expect(packager).toMatch(/mtimeNs/u);
  expect(packager).toMatch(/ctimeNs/u);
  const verifier = await readFile(resolve(pluginRoot, "scripts/verify-package.mjs"), "utf8");
  expect(verifier).toMatch(/stat\([^)]*bigint/u);
});
test("captures package directory identities as bigint values before comparing file IDs", async () => {
  const source = await readFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), "utf8");
  const secureDirectory = source.slice(
    source.indexOf("async function secureDirectory"),
    source.indexOf("async function assertDirectoryIdentity")
  );

  expect(secureDirectory).toContain("lstat(path, { bigint: true })");
  expect(secureDirectory).not.toMatch(/await lstat\(path\);/u);
});

test.each([
  {
    name: "entry count",
    setup: async (root: string) => {
      await Promise.all(Array.from({ length: 257 }, (_, index) =>
        writeFile(join(root, "skills", `entry-${index}.md`), `# ${index}\n`, "utf8")));
    },
    pattern: /package source inventory.*(?:entries|items).*limit/i
  },
  {
    name: "depth",
    setup: async (root: string) => {
      const deep = Array.from({ length: 17 }, (_, index) => `level-${index}`).reduce(
        (parent, segment) => join(parent, segment),
        join(root, "skills")
      );
      await mkdir(deep, { recursive: true });
      await writeFile(join(deep, "deep.md"), "# Deep\n", "utf8");
    },
    pattern: /package source inventory.*depth.*limit/i
  },
  {
    name: "per-file bytes",
    setup: async (root: string) => {
      await writeFile(join(root, "skills", "oversized.bin"), Buffer.alloc(16 * 1024 * 1024 + 1, 0x61));
    },
    pattern: /package source file.*(?:bytes|size).*limit/i
  }
])("rejects an allowlisted source tree above the bounded $name limit", async ({ setup, pattern }) => {
  const root = await mkdtemp(join(tmpdir(), "keeper-package-bounds-"));
  temporaryRoots.push(root);
  await Promise.all([
    mkdir(join(root, "dist"), { recursive: true }),
    mkdir(join(root, "scripts"), { recursive: true }),
    mkdir(join(root, "skills"), { recursive: true })
  ]);
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    writeFile(join(root, "cordis.patch.yml"), "# fixture patch\n", "utf8"),
    writeFile(join(root, "dist/plugin.js"), "export {};\n", "utf8"),
    writeFile(join(root, "package.json"), "{}\n", "utf8"),
    writeFile(join(root, "skills/SKILL.md"), "# Fixture\n", "utf8")
  ]);
  await setup(root);

  await expect(execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], { cwd: root }))
    .rejects.toThrow(pattern);
});

test("preserves a late entry added to the quarantined existing package", async () => {
  const { root, barrier } = await createCleanupRaceFixture("keeper-package-late-entry-");
  const packaging = startCleanupRace(root, barrier, "after-quarantine-rename");
  await waitForFile(join(barrier, "entered"));

  const { quarantinePath } = await readBarrierMetadata(barrier);
  const lateEntry = join(quarantinePath, "late-user.txt");
  await writeFile(lateEntry, "late user evidence\n", "utf8");
  await releaseCleanupRace(barrier);

  await expect(packaging).rejects.toBeTruthy();
  await expect(readFile(lateEntry, "utf8")).resolves.toBe("late user evidence\n");
  await expect(readFile(join(quarantinePath, "sentinel.txt"), "utf8"))
    .resolves.toBe("original package evidence\n");
});

test("rejects a source change after capture before replacing the package", async () => {
  const { root, target, barrier } = await createCleanupRaceFixture("keeper-package-source-change-");
  const packaging = startCleanupRace(root, barrier, "before-cleanup");
  await waitForFile(join(barrier, "entered"));
  await writeFile(join(root, "skills", "SKILL.md"), "# Mutated\n", "utf8");
  await releaseCleanupRace(barrier);

  await expect(packaging).rejects.toBeTruthy();
  await expect(readFile(join(target, "sentinel.txt"), "utf8"))
    .resolves.toBe("original package evidence\n");
});

test.runIf(process.platform === "win32")("refuses a junction package parent before deleting external content", async () => {
  const root = await mkdtemp(join(tmpdir(), "keeper-package-parent-link-"));
  temporaryRoots.push(root);
  const external = await mkdtemp(join(tmpdir(), "keeper-package-external-"));
  temporaryRoots.push(external);
  await Promise.all([
    mkdir(join(root, "dist"), { recursive: true }),
    mkdir(join(root, "scripts"), { recursive: true }),
    mkdir(join(root, "skills"), { recursive: true }),
    mkdir(join(external, "project-design-keeper"), { recursive: true })
  ]);
  const sentinel = join(external, "project-design-keeper", "sentinel.txt");
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    writeFile(join(root, "cordis.patch.yml"), "# fixture patch\n", "utf8"),
    writeFile(join(root, "dist/plugin.js"), "export {};\n", "utf8"),
    writeFile(join(root, "package.json"), "{}\n", "utf8"),
    writeFile(join(root, "skills/SKILL.md"), "# Fixture\n", "utf8"),
    writeFile(sentinel, "outside package sentinel\n", "utf8")
  ]);
  await symlink(external, join(root, ".package"), "junction");

  await expect(execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], { cwd: root }))
    .rejects.toBeTruthy();
  await expect(readFile(sentinel, "utf8")).resolves.toBe("outside package sentinel\n");
});

test.runIf(process.platform === "win32")("rechecks package identities immediately before recursive cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "keeper-package-parent-swap-"));
  temporaryRoots.push(root);
  const external = await mkdtemp(join(tmpdir(), "keeper-package-swap-external-"));
  temporaryRoots.push(external);
  const barrier = join(root, "package-test-barrier");
  await Promise.all([
    mkdir(join(root, "dist"), { recursive: true }),
    mkdir(join(root, "scripts"), { recursive: true }),
    mkdir(join(root, "skills"), { recursive: true }),
    mkdir(join(root, ".package", "project-design-keeper"), { recursive: true }),
    mkdir(join(external, "project-design-keeper"), { recursive: true }),
    mkdir(barrier)
  ]);
  const sentinel = join(external, "project-design-keeper", "sentinel.txt");
  await Promise.all([
    copyFile(resolve(pluginRoot, "scripts/package-plugin.mjs"), join(root, "scripts/package-plugin.mjs")),
    writeFile(join(root, "cordis.patch.yml"), "# fixture patch\n", "utf8"),
    writeFile(join(root, "dist/plugin.js"), "export {};\n", "utf8"),
    writeFile(join(root, "package.json"), "{}\n", "utf8"),
    writeFile(join(root, "skills/SKILL.md"), "# Fixture\n", "utf8"),
    writeFile(join(root, ".package", "project-design-keeper", "original.txt"), "original package\n", "utf8"),
    writeFile(sentinel, "outside package sentinel\n", "utf8")
  ]);

  const packaging = execFile(process.execPath, [join(root, "scripts/package-plugin.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      KEEPER_PACKAGE_TEST_ROOT: root,
      KEEPER_PACKAGE_TEST_BARRIER: barrier
    }
  });
  await waitForFile(join(barrier, "entered"));
  await rename(join(root, ".package"), join(root, ".package-original"));
  await symlink(external, join(root, ".package"), "junction");
  await writeFile(join(barrier, "release"), "release\n", "utf8");

  await expect(packaging).rejects.toBeTruthy();
  await expect(readFile(sentinel, "utf8")).resolves.toBe("outside package sentinel\n");
  await expect(readFile(join(root, ".package-original", "project-design-keeper", "original.txt"), "utf8"))
    .resolves.toBe("original package\n");
});

test.runIf(process.platform === "win32")("never overwrites a random quarantine collision", async () => {
  const { root, target, barrier } = await createCleanupRaceFixture("keeper-package-quarantine-collision-");
  const packaging = startCleanupRace(root, barrier, "before-quarantine-rename");
  await waitForFile(join(barrier, "entered"));

  let quarantinePath = "";
  let setupFailure: unknown;
  try {
    const metadata = await readBarrierMetadata(barrier);
    quarantinePath = metadata.quarantinePath;
    expect(metadata.phase).toBe("before-quarantine-rename");
    expect(dirname(quarantinePath)).toBe(join(root, ".package"));
    await mkdir(quarantinePath);
    await writeFile(join(quarantinePath, "collision.txt"), "collision evidence\n", "utf8");
  } catch (error) {
    setupFailure = error;
  } finally {
    await releaseCleanupRace(barrier);
  }
  if (setupFailure !== undefined) {
    await packaging.catch(() => undefined);
    throw setupFailure;
  }

  await expect(packaging).rejects.toBeTruthy();
  await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("original package evidence\n");
  await expect(readFile(join(quarantinePath, "collision.txt"), "utf8")).resolves.toBe("collision evidence\n");
});

test.runIf(process.platform === "win32")(
  "preserves original and replacement evidence when quarantine identity changes before cleanup",
  async () => {
    const { root, barrier } = await createCleanupRaceFixture("keeper-package-quarantine-replacement-");
    const external = join(root, "external-cleanup-sentinel");
    await mkdir(external);
    await writeFile(join(external, "sentinel.txt"), "external evidence\n", "utf8");
    const packaging = startCleanupRace(root, barrier, "after-quarantine-rename");
    await waitForFile(join(barrier, "entered"));

    let quarantinePath = "";
    let originalEvidence = "";
    let setupFailure: unknown;
    try {
      const metadata = await readBarrierMetadata(barrier);
      quarantinePath = metadata.quarantinePath;
      originalEvidence = `${quarantinePath}.original`;
      expect(metadata.phase).toBe("after-quarantine-rename");
      expect(dirname(quarantinePath)).toBe(join(root, ".package"));
      await rename(quarantinePath, originalEvidence);
      await symlink(external, quarantinePath, "junction");
    } catch (error) {
      setupFailure = error;
    } finally {
      await releaseCleanupRace(barrier);
    }
    if (setupFailure !== undefined) {
      await packaging.catch(() => undefined);
      throw setupFailure;
    }

    await expect(packaging).rejects.toBeTruthy();
    await expect(readFile(join(originalEvidence, "sentinel.txt"), "utf8"))
      .resolves.toBe("original package evidence\n");
    await expect(readFile(join(quarantinePath, "sentinel.txt"), "utf8"))
      .resolves.toBe("external evidence\n");
    await expect(readFile(join(external, "sentinel.txt"), "utf8"))
      .resolves.toBe("external evidence\n");
  }
);

test("verifies a valid normalized bundle package", async () => {
  const { root } = await createVerifierFixture();

  const result = await verifyFixture(root);

  expect(result.exitCode).toBe(0);
  expect(result.output).toMatch(new RegExp(`Verified bundle.*${exactPackageFiles.length} files`, "u"));
});

test("verifies a valid package whose independent source and package trees each exceed 32 MiB", async () => {
  const { root, target } = await createVerifierFixture();
  const payload = Buffer.alloc(11 * 1024 * 1024, 0x61);
  const enlarged = [
    "skills/distill-project-design/references/document-contract.md",
    "skills/distill-project-design/references/knowledge-model.md",
    "skills/distill-project-design/assets/project-design-context/SKILL.md"
  ];
  for (const relativePath of enlarged) {
    await Promise.all([
      writeFile(resolve(root, ...relativePath.split("/")), payload),
      writeFile(resolve(target, ...relativePath.split("/")), payload)
    ]);
  }

  const result = await verifyFixture(root);

  expect(result.exitCode).toBe(0);
  expect(result.output).toMatch(new RegExp(`Verified bundle.*${exactPackageFiles.length} files`, "u"));
});

test("rejects a bundle with a forbidden legacy Codex entry", async () => {
  const { root, target } = await createVerifierFixture();
  const agents = join(target, "skills", "distill-project-design", "agents");
  await mkdir(agents, { recursive: true });
  await writeFile(join(agents, "openai.yaml"), "interface: {}\n", "utf8");

  const result = await verifyFixture(root);

  expect(result.exitCode).not.toBe(0);
  expect(result.output).toMatch(/forbidden|openai|mcp-tools|codex/i);
});

test("rejects a bundle whose compiled plugin still imports the MCP SDK", async () => {
  const { root, target } = await createVerifierFixture();
  const pluginPath = join(target, "dist", "plugin.js");
  await writeFile(pluginPath, `${await readFile(pluginPath, "utf8")}\nimport x from "@modelcontextprotocol/sdk/server/mcp.js";\n`, "utf8");

  const result = await verifyFixture(root);

  expect(result.exitCode).not.toBe(0);
  expect(result.output).toMatch(/MCP SDK/i);
});

test("rejects an allowlisted JSON manifest above the bounded JSON byte limit", async () => {
  const { root, target } = await createVerifierFixture();
  const oversized = `${JSON.stringify({
    name: "project-design-keeper",
    version: "1.0.0",
    padding: "x".repeat(256 * 1024)
  })}\n`;
  await Promise.all([
    writeFile(join(root, "package.json"), oversized, "utf8"),
    writeFile(join(target, "package.json"), oversized, "utf8")
  ]);

  const result = await verifyFixture(root);

  expect(result.exitCode).not.toBe(0);
  expect(result.output).toMatch(/package\.JSON.*(?:byte|bytes|size).*limit/i);
});
