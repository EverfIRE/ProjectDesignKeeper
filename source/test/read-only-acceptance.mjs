import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readlink, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { isDeepStrictEqual } from "node:util";
import { createProjectDesignKeeper } from "../dist/index.js";

const execFile = promisify(execFileCallback);
const requiredDocuments = [
  ["index.md", undefined],
  ["intent.md", "intent"],
  ["principles.md", "principle"],
  ["architecture.md", "architecture"],
  ["conventions.md", "convention"],
  ["decisions.md", "decision"],
  ["tuning.md", "tuning"],
  ["verification.md", "verification"],
  ["open-questions.md", "open-question"],
  ["evidence-map.md", undefined]
];

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function git(root, args, encoding = "buffer") {
  const result = await execFile("git", ["-C", root, ...args], {
    encoding,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true
  });
  return result.stdout;
}

function parsePorcelainZ(raw) {
  const entries = [];
  let offset = 0;
  while (offset < raw.length) {
    const end = raw.indexOf(0, offset);
    if (end < 0) throw new Error("Invalid NUL-terminated Git status output");
    const item = raw.subarray(offset, end).toString("utf8");
    offset = end + 1;
    if (!item) continue;
    const code = item.slice(0, 2);
    entries.push({ code, path: item.slice(3) });
    if (code.includes("R") || code.includes("C")) {
      const originalEnd = raw.indexOf(0, offset);
      if (originalEnd < 0) throw new Error("Invalid renamed-path Git status output");
      entries.push({ code: `${code}:original`, path: raw.subarray(offset, originalEnd).toString("utf8") });
      offset = originalEnd + 1;
    }
  }
  return entries;
}

async function pathFingerprint(root, path) {
  const target = resolve(root, path);
  try {
    const metadata = await lstat(target);
    if (metadata.isFile()) return sha256(await readFile(target));
    if (metadata.isSymbolicLink()) return sha256(`symlink:${await readlink(target)}`);
    if (metadata.isDirectory()) return "<directory>";
    return "<non-regular>";
  } catch (error) {
    if (error && error.code === "ENOENT") return "<missing>";
    throw error;
  }
}

export async function captureRepositoryState(repositoryRoot) {
  const root = await realpath(repositoryRoot);
  // Captures the exact equivalent of: git status --porcelain=v1 -uall
  const status = await git(root, ["status", "--porcelain=v1", "-uall"], "utf8");
  const statusZ = await git(root, ["status", "--porcelain=v1", "-uall", "-z"]);
  const paths = parsePorcelainZ(statusZ);
  const workingPathHashes = {};
  for (const entry of paths) workingPathHashes[entry.path] = await pathFingerprint(root, entry.path);
  const trackedDiff = await git(root, ["diff", "--no-ext-diff", "--binary", "HEAD", "--"]);
  return {
    status,
    trackedDiffHash: sha256(trackedDiff),
    workingPathHashes
  };
}

function managedBlock(recordId, body) {
  return `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="${sha256(body)}" -->${body}<!-- /project-design-keeper:managed -->`;
}

function derivedBlock(documentId, body) {
  return `<!-- project-design-keeper:derived document-id="${documentId}" content-hash="${sha256(body)}" -->${body}<!-- /project-design-keeper:derived -->`;
}

function evidenceReference(match) {
  return `${match.path}:${match.line}`;
}

function repositoryPath(path) {
  return path.replaceAll("\\", "/");
}

export function buildCandidate(scan, gameplayMatches, technicalMatches) {
  if (gameplayMatches.length === 0 || technicalMatches.length === 0) {
    throw new Error("Both gameplay and technical evidence are required");
  }
  const selected = [gameplayMatches[0], technicalMatches[0]].map((match) => ({
    ...match,
    path: repositoryPath(match.path)
  }));
  const normalizedFingerprints = Object.fromEntries((scan.items ?? []).map((file) => [repositoryPath(file.path), file.fingerprint]));
  const sourcePaths = [...new Set(selected.map((match) => match.path))];
  const sourceFiles = Object.fromEntries(sourcePaths.map((path) => {
    const fingerprint = normalizedFingerprints[path];
    if (typeof fingerprint !== "string") throw new Error(`Missing scan fingerprint for evidence path: ${path}`);
    return [path, fingerprint];
  }));
  const documents = [];
  const records = [];
  const changes = [];
  for (const [index, [name, kind]] of requiredDocuments.entries()) {
    const slug = name.replace(/\.md$/u, "");
    const recordId = `record.acceptance.${slug}`;
    const path = `docs/project-design/${name}`;
    const evidence = selected[index % selected.length];
    const body = `# ${slug}\n\nRead-only acceptance candidate ${index + 1}.\n`;
    const documentId = `document.acceptance.${slug}`;
    const navigation = `# ${slug}\n\nDerived navigation for ${documentId}.\n`;
    documents.push({ id: documentId, path });
    if (kind) {
      records.push({
        id: recordId,
        kind,
        ownerDocument: documentId,
        domain: index % 2 === 0 ? "gameplay-design" : "technical-architecture",
        scope: "read-only-acceptance",
        statement: `Evidence-backed acceptance statement ${index + 1}`,
        evidence: [{
          path: evidence.path,
          startLine: evidence.line,
          role: kind === "intent" || kind === "principle" || kind === "decision" || kind === "open-question"
            ? "design"
            : kind === "tuning" ? "configuration" : kind === "verification" ? "test" : "implementation",
          excerptHash: sha256(evidence.text)
        }],
        impact: [`Routes downstream design context ${index + 1}`],
        status: kind === "open-question" ? "proposed" : "observed",
        strength: kind === "open-question" ? "pending" : "informational",
        approval: kind === "open-question" ? "pending" : "not-required",
        assertedConfidence: "medium",
        lifecycle: { state: "active" }
      });
      changes.push({ path, content: `${derivedBlock(documentId, navigation)}${managedBlock(recordId, body)}` });
    } else {
      changes.push({ path, content: derivedBlock(documentId, navigation) });
    }
  }
  const pack = {
    managedBy: "project-design-keeper",
    schemaVersion: "3.0",
    maintenanceRevision: 0,
    scope: { root: ".", paths: sourcePaths },
    sourceRevision: { kind: "git", files: sourceFiles },
    documents,
    records,
    archive: { generations: [], tombstones: { path: "docs/project-design/archive/tombstones.jsonl", count: 0 } },
    dedupeExceptions: []
  };
  changes.push({ path: "docs/project-design/manifest.json", content: `${JSON.stringify(pack, null, 2)}\n` });
  return { pack, changes };
}

function compactState(state) {
  const sortedHashes = Object.fromEntries(Object.entries(state.workingPathHashes).sort(([left], [right]) => left.localeCompare(right)));
  return {
    statusHash: sha256(state.status),
    statusEntryCount: Object.keys(state.workingPathHashes).length,
    trackedDiffHash: state.trackedDiffHash,
    workingPathSetHash: sha256(JSON.stringify(sortedHashes))
  };
}

export async function runAcceptance(repositoryRoot, gameplayQuery, technicalQuery) {
  if (!repositoryRoot || !gameplayQuery || !technicalQuery) {
    throw new Error("Usage: node test/read-only-acceptance.mjs <repository-root> <gameplay-query> <technical-query>");
  }
  const root = await realpath(repositoryRoot);
  const cacheDirectory = await mkdtemp(join(tmpdir(), "project-design-keeper-acceptance-"));
  try {
    const before = await captureRepositoryState(root);
    const service = createProjectDesignKeeper({ cacheDirectory });
    const summary = await service.scanScope({ root, path: ".", view: "summary" });
    const items = [];
    let cursor;
    do {
      const page = await service.scanScope({ root, path: ".", view: "files", limit: 1000, ...(cursor ? { cursor } : {}) });
      items.push(...(page.items ?? []));
      cursor = page.page?.nextCursor;
    } while (cursor);
    const scan = { ...summary, items };
    const gameplay = await service.searchEvidence({ root, path: ".", query: gameplayQuery });
    const technical = await service.searchEvidence({ root, path: ".", query: technicalQuery });
    const gameplayMatches = gameplay.matches ?? [];
    const technicalMatches = technical.matches ?? [];
    const candidate = buildCandidate(scan, gameplayMatches, technicalMatches);
    const preview = await service.previewUpdate({ root, path: ".", pack: candidate.pack, changes: candidate.changes });
    if (preview.applicable !== true || preview.validation?.valid !== true) {
      throw new Error(`Candidate preview was not applicable and valid: ${JSON.stringify({ conflicts: preview.conflicts, validation: preview.validation })}`);
    }
    const after = await captureRepositoryState(root);
    if (!isDeepStrictEqual(before, after)) throw new Error("Repository state or bytes changed during read-only acceptance");
    return {
      repository: basename(root),
      filesScanned: scan.totals.files,
      evidenceChunks: scan.totals.evidence,
      gameplayEvidenceCount: gameplayMatches.length,
      technicalEvidenceCount: technicalMatches.length,
      sourceFingerprintCount: Object.keys(candidate.pack.sourceRevision.files).length,
      candidateDocumentCount: candidate.pack.documents.length,
      candidateRecordCount: candidate.pack.records.length,
      proposedChangeCount: candidate.changes.length,
      applicable: true,
      validationValid: true,
      changesetIssued: typeof preview.changesetId === "string",
      unchanged: true,
      before: compactState(before),
      after: compactState(after)
    };
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
}

function directExecution() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (directExecution()) {
  runAcceptance(process.argv[2], process.argv[3], process.argv[4])
    .then((summary) => process.stdout.write(`${JSON.stringify(summary)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Read-only acceptance failed"}\n`);
      process.exitCode = 1;
    });
}
