import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import UserQuestionService from "@deepseek-ai/dsh-user-questions";
import ApprovalService from "@deepseek-ai/dsh-user-approval";
import * as keeperPlugin from "../dist/plugin.js";

const execFile = promisify(execFileCallback);

const sourceRoot = process.cwd();
const temporaryRoot = await mkdtemp(join(tmpdir(), "keeper-dsh-smoke-"));

async function createProjectFixture(root) {
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "docs", "evidence.txt"), "Keeper smoke evidence: moon-garden\n", "utf8");
  await writeFile(join(root, "assets", "sample.bin"), Buffer.from([0, 1, 2, 3, 255]));
  await execFile("git", ["init", "--initial-branch=main"], { cwd: root });
  await execFile("git", ["config", "user.email", "keeper@example.test"], { cwd: root });
  await execFile("git", ["config", "user.name", "Project Design Keeper smoke"], { cwd: root });
  await execFile("git", ["add", "docs/evidence.txt", "assets/sample.bin"], { cwd: root });
  await execFile("git", ["commit", "-m", "smoke baseline"], { cwd: root });
}

try {
  // The compiled bundle and skills tree are the installable payload.
  await Promise.all([
    import("../dist/plugin.js").then((module) => {
      assert.equal(typeof module.apply, "function", "compiled plugin must export apply");
    }),
    readFile(join(sourceRoot, "skills/distill-project-design/SKILL.md"), "utf8").then((skill) => {
      assert.match(skill, /^---\nname: distill-project-design\n/u);
      assert.match(skill, /^description: /mu);
    })
  ]);

  // Mount the compiled plugin on a scratch Cordis context.
  const ctx = new Context();
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(UserQuestionService);
  await ctx.plugin(ApprovalService);
  await ctx.plugin(keeperPlugin);

  const names = ctx.tools.schemas().map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "analyze_redundancy",
    "apply_update",
    "detect_drift",
    "preview_update",
    "query_context",
    "query_history",
    "scan_scope",
    "search_evidence",
    "validate_pack"
  ]);

  const projectRoot = join(temporaryRoot, "smoke-project");
  await createProjectFixture(projectRoot);

  const scan = await ctx.tools.execute({
    signal: new AbortController().signal,
    callId: "smoke-scan" ,
    name: "scan_scope",
    arguments: { root: projectRoot, view: "summary" }
  });
  assert.equal(scan.isError, false);
  assert.ok(scan.value);

  const preview = await ctx.tools.execute({
    signal: new AbortController().signal,
    callId: "smoke-preview",
    name: "preview_update",
    arguments: {
      root: projectRoot,
      changes: [{
        path: ".agents/skills/project-design-context/smoke.md",
        managedBlock: { recordId: "smoke.record", content: "# Smoke\n\nSMOKE-BODY\n" }
      }]
    }
  });
  assert.equal(preview.isError, false);
  const previewValue = preview.value;
  assert.ok(previewValue.changesetId);
  assert.equal(await readFile(join(projectRoot, ".agents", "skills", "project-design-context", "smoke.md"), "utf8")
    .then(() => true, () => false), false, "preview must not write the project");

  const applied = await ctx.tools.execute({
    signal: new AbortController().signal,
    callId: "smoke-apply",
    name: "apply_update",
    arguments: { root: projectRoot, changesetId: previewValue.changesetId },
    agent: {
      id: "smoke-agent",
      session: {
        id: "smoke-agent",
        events: [{ type: "turn/start" }, { type: "user/message" }],
        append: (_type, data) => ({ type: "event", data })
      }
    }
  });
  // Apply requires the harness approval seam; without an answerer it fails closed.
  assert.equal(applied.isError, true);
  const appliedText = applied.content.map((block) => block.type === "text" ? block.text : "").join("\n");
  assert.match(appliedText, /unavailable|declined|answerer|approval/i);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write("DSH smoke passed: compiled plugin mounts, registers nine tools, scans and previews a fixture, and apply fails closed without approval.\n");
