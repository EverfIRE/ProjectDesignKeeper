import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export interface ProjectFixture {
  root: string;
  repository: string;
  nonGitDirectory: string;
  trackedText: string;
  binaryFile: string;
  ignoredFile: string;
  outsideFile: string;
  symlinkEscape?: string;
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFile("git", args, { cwd });
}

/**
 * Creates an on-disk project that exercises file-system boundaries without
 * depending on the production scanner or a mocked Git implementation.
 */
export async function createProjectFixture(): Promise<ProjectFixture> {
  const root = await mkdtemp(join(tmpdir(), "project design keeper 空格-"));
  const repository = join(root, "repository with spaces");
  const nonGitDirectory = join(root, "non git 目录");
  const trackedText = join(repository, "docs", "设计 evidence.txt");
  const binaryFile = join(repository, "assets", "sample.bin");
  const ignoredFile = join(repository, "generated", "ignored.txt");
  const outsideFile = join(root, "outside.txt");

  await Promise.all([
    mkdir(join(repository, "docs"), { recursive: true }),
    mkdir(join(repository, "assets"), { recursive: true }),
    mkdir(join(repository, "generated"), { recursive: true }),
    mkdir(nonGitDirectory, { recursive: true })
  ]);
  await Promise.all([
    writeFile(trackedText, "Keeper evidence: moon-garden\n", "utf8"),
    writeFile(binaryFile, Buffer.from([0, 1, 2, 3, 255])),
    writeFile(ignoredFile, "generated and ignored\n", "utf8"),
    writeFile(join(repository, ".gitignore"), "generated/\n", "utf8"),
    writeFile(join(nonGitDirectory, "notes.txt"), "not a Git worktree\n", "utf8"),
    writeFile(outsideFile, "must not be reachable through a project path\n", "utf8")
  ]);

  await git(repository, "init", "--initial-branch=main");
  await git(repository, "config", "user.email", "keeper@example.test");
  await git(repository, "config", "user.name", "Project Design Keeper tests");
  await git(repository, "add", ".gitignore", "assets/sample.bin", "docs/设计 evidence.txt");
  await git(repository, "commit", "-m", "fixture baseline");

  let symlinkEscape: string | undefined;
  const candidate = join(repository, "escape link.txt");
  try {
    await symlink(outsideFile, candidate, "file");
    symlinkEscape = candidate;
  } catch {
    // Windows can deny symlink creation without developer mode or elevation.
  }

  return {
    root,
    repository,
    nonGitDirectory,
    trackedText,
    binaryFile,
    ignoredFile,
    outsideFile,
    symlinkEscape
  };
}

export async function removeProjectFixture(fixture: ProjectFixture | undefined): Promise<void> {
  if (fixture) {
    await rm(fixture.root, { recursive: true, force: true });
  }
}
