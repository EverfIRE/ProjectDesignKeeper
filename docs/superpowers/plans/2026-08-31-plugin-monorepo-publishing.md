# ProjectDesign Plugin Monorepo Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `EverfIRE/ProjectDesign` into a two-plugin monorepo with isolated source and installable release trees, then publish `physics-simulation-superpowers` 0.1.0 as a verified GitHub Release.

**Architecture:** `sources/<plugin>/` is the only hand-maintained development tree and `plugins/<plugin>/` is a deterministic, committed release tree. Plugin-specific packagers build release trees; repository distribution tests enforce byte parity, marketplace integrity, and development-file exclusion before CI, merge, tag, or Release creation.

**Tech Stack:** Git, PowerShell, Node.js 20, npm, TypeScript, Vitest, Python 3.11+, `unittest`, deterministic ZIP, GitHub Actions, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-08-31-plugin-monorepo-publishing-design.md`

## Global Constraints

- Repository URL is exactly `https://github.com/EverfIRE/ProjectDesign`.
- Source roots are exactly `sources/project-design-keeper/` and `sources/physics-simulation-superpowers/`.
- Installable roots are exactly `plugins/project-design-keeper/` and `plugins/physics-simulation-superpowers/`.
- Repo marketplace is `.agents/plugins/marketplace.json`, named `project-design`, display name `ProjectDesign`.
- Physics import is commit `690f0295d406a4007d50fa6133dc4671345092ad`, branch `feat/physics-simulation-superpowers`.
- Physics stays version `0.1.0`, Apache-2.0; keeper stays version `1.0.1`.
- ZIP and `SHA256SUMS.txt` are generated artifacts, never committed.
- The independent physics repository remains intact.
- Existing ProjectDesignKeeper tags `v1.0.0` and `v1.0.1` remain untouched.
- No tag or Release before merge and green required CI.

## File Structure Map

- `.agents/plugins/marketplace.json`: two-plugin repo marketplace.
- `.github/workflows/ci.yml`: keeper, physics, and distribution jobs.
- `sources/project-design-keeper/`: renamed keeper development tree.
- `sources/physics-simulation-superpowers/`: imported physics development tree.
- `plugins/project-design-keeper/`: generated keeper release.
- `plugins/physics-simulation-superpowers/`: generated physics release.
- `test/distribution.test.mjs`: repository-wide contract.
- `docs/migrations/2026-08-31-physics-simulation-superpowers.md`: import evidence.

---

### Task 1: Move ProjectDesignKeeper Into the Unified Source Namespace

**Files:**
- Move: `source/` → `sources/project-design-keeper/`
- Modify: `test/distribution.test.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `sources/project-design-keeper/package.json`
- Modify: keeper source/release `.codex-plugin/plugin.json` and release `package.json`

**Interfaces:**
- Consumes: existing keeper npm build/package commands.
- Produces: canonical keeper source root and `EverfIRE/ProjectDesign` metadata.

- [ ] **Step 1: Write the failing path contract**

Add to `test/distribution.test.mjs` and update all source-side paths to use the constant:

```js
const keeperSource = "sources/project-design-keeper";
const repositoryURL = "https://github.com/EverfIRE/ProjectDesign";
test("legacy singular source root is absent", async () => {
  assert.equal(await exists("source"), false);
  assert.equal(await exists(`${keeperSource}/src/index.ts`), true);
  assert.equal(await exists(`${keeperSource}/test`), true);
  assert.equal(await exists(`${keeperSource}/scripts/package-plugin.mjs`), true);
});
```

- [ ] **Step 2: Prove RED**

Run `node --test test/distribution.test.mjs`. Expected: FAIL because the new root is absent.

- [ ] **Step 3: Move with Git tracking**

```powershell
New-Item -ItemType Directory -Path sources | Out-Null
git mv source sources/project-design-keeper
```

- [ ] **Step 4: Update keeper metadata**

Set homepage to `https://github.com/EverfIRE/ProjectDesign#readme`, bugs to `/issues`, repository URL to `https://github.com/EverfIRE/ProjectDesign.git`, repository directory to `sources/project-design-keeper`, and publisher URL to `https://github.com/EverfIRE`. Apply the same stable URLs to source and generated plugin manifests while preserving version and component paths.

- [ ] **Step 5: Update CI paths**

Use:

```yaml
working-directory: sources/project-design-keeper
cache-dependency-path: sources/project-design-keeper/package-lock.json
```

Update diff and smoke paths to `sources/project-design-keeper/dist/index.js` and `sources/project-design-keeper/.package/project-design-keeper`.

- [ ] **Step 6: Update README paths and repository links**

Replace single-plugin `source/` examples with `sources/project-design-keeper/` and describe `sources/` as multi-plugin development trees.

- [ ] **Step 7: Verify GREEN**

```powershell
Set-Location sources/project-design-keeper
npm run typecheck
npm run test:ci
npm run build
npm run smoke
npm run package:verify
Set-Location ../..
node --test test/distribution.test.mjs
```

Expected: PASS and generated keeper package matches `plugins/project-design-keeper` after metadata refresh.

- [ ] **Step 8: Commit**

```powershell
git add .github/workflows/ci.yml README.md test/distribution.test.mjs sources/project-design-keeper plugins/project-design-keeper
git commit -m "refactor: move keeper into unified source tree"
```

---

### Task 2: Import the Physics Source Snapshot With Provenance

**Files:**
- Create: `sources/physics-simulation-superpowers/**`
- Create: `docs/migrations/2026-08-31-physics-simulation-superpowers.md`
- Modify: `test/distribution.test.mjs`

**Interfaces:**
- Consumes: exact independent repository commit `690f0295d406a4007d50fa6133dc4671345092ad`.
- Produces: complete tracked physics source and immutable migration evidence.

- [ ] **Step 1: Write the failing import contract**

```js
const physicsName = "physics-simulation-superpowers";
const physicsSource = `sources/${physicsName}`;
test("physics source snapshot is complete", async () => {
  assert.equal(await exists(`${physicsSource}/.codex-plugin/plugin.json`), true);
  assert.equal(await exists(`${physicsSource}/skills/unreal-chaos-physics/SKILL.md`), true);
  assert.equal(await exists(`${physicsSource}/tests/test_packaging.py`), true);
  assert.equal(await exists(`${physicsSource}/evaluations`), true);
  const manifest = await readJSON(`${physicsSource}/.codex-plugin/plugin.json`);
  assert.equal(manifest.name, physicsName);
  assert.equal(manifest.version, "0.1.0");
});
```

- [ ] **Step 2: Prove RED**

Run `node --test test/distribution.test.mjs`. Expected: FAIL because the physics source root is absent.

- [ ] **Step 3: Verify the exact source**

```powershell
$physicsRepo = 'C:\Users\qiupeng\Documents\Codex\2026-08-26\new-chat\work\physics-simulation-superpowers'
git -C $physicsRepo status --short
git -C $physicsRepo rev-parse HEAD
git -C $physicsRepo branch --show-current
```

Expected: clean, exact HEAD above, exact branch above.

- [ ] **Step 4: Import only tracked bytes**

```powershell
$physicsRepo = 'C:\Users\qiupeng\Documents\Codex\2026-08-26\new-chat\work\physics-simulation-superpowers'
$target = 'D:\Projects\ProjectDesignKeeper\sources\physics-simulation-superpowers'
$archive = Join-Path ([IO.Path]::GetTempPath()) ('physics-source-' + [guid]::NewGuid().ToString('N') + '.tar')
if (Test-Path -LiteralPath $target) { throw "Import target exists: $target" }
New-Item -ItemType Directory -Path $target | Out-Null
git -C $physicsRepo archive --format=tar --output=$archive 690f0295d406a4007d50fa6133dc4671345092ad
tar -xf $archive -C $target
Remove-Item -LiteralPath $archive
```

Assert the target contains no `.git`, `.superpowers`, or `outputs`.

- [ ] **Step 5: Record provenance**

Create the migration record with source path, branch, commit, plugin/version, tree SHA-256 `d939c25f42f763778d9b018674eb7b8f6eabed249bc040c3830e692fbf411689`, ZIP SHA-256 `0298b627152df72c6c22b1dc43b24d581f7e7325663836b77ae23755252782a5`, and a statement that the independent repository remains unchanged.

- [ ] **Step 6: Verify GREEN**

```powershell
C:\Python314\python.exe -X utf8 -m unittest discover -s sources/physics-simulation-superpowers/tests -q
node --test test/distribution.test.mjs
```

Expected: 602 physics tests PASS and import contract PASS.

- [ ] **Step 7: Commit**

```powershell
git add sources/physics-simulation-superpowers docs/migrations/2026-08-31-physics-simulation-superpowers.md test/distribution.test.mjs
git commit -m "feat: import physics simulation plugin source"
```

---

### Task 3: Make the Physics Packager Produce a Curated Release Tree

**Files:**
- Modify: `sources/physics-simulation-superpowers/scripts/package_plugin.py`
- Modify: `sources/physics-simulation-superpowers/tests/test_packaging.py`
- Create: `sources/physics-simulation-superpowers/tests/test_repository_distribution.py`

**Interfaces:**
- Consumes: physics source root containing `.codex-plugin/plugin.json`.
- Produces: `collect_release_files`, `hash_tree`, `install_tree`, `write_archive`, and their existing CLI.

- [ ] **Step 1: Change the packaging fixture to define the release boundary**

Make the expected members exactly:

```python
[
    ".codex-plugin/plugin.json",
    "LICENSE",
    "README.zh-CN.md",
    "THIRD_PARTY_NOTICES.md",
    "assets/icon.svg",
    "references/sources.lock.json",
    "schemas/physics-run.schema.json",
    "scripts/tool.py",
    "skills/example/SKILL.md",
]
```

Add `docs/design.md`, `evaluations/example/evaluation.json`, and `tests/test_keep.py` to the fixture and assert they are absent.

- [ ] **Step 2: Prove RED**

From `sources/physics-simulation-superpowers`, run:

```powershell
C:\Python314\python.exe -X utf8 -m unittest tests.test_packaging -q
```

Expected: FAIL because the old collector includes development files.

- [ ] **Step 3: Add the explicit allowlist**

```python
RELEASE_ROOT_FILES = {"LICENSE", "README.zh-CN.md", "THIRD_PARTY_NOTICES.md"}
RELEASE_ROOT_DIRECTORIES = {
    ".codex-plugin", "assets", "references", "schemas", "scripts", "skills"
}
DEVELOPMENT_ONLY_ROOTS = {
    ".git", ".superpowers", "docs", "evaluations", "outputs", "tests"
}

def collect_release_files(source_root: Path | str) -> list[Path]:
    source = Path(source_root).expanduser().resolve()
    if not source.is_dir():
        raise FileNotFoundError(f"source directory does not exist: {source}")
    files: list[Path] = []
    for name in sorted(RELEASE_ROOT_FILES):
        path = source / name
        if not path.is_file():
            raise FileNotFoundError(f"required release file is missing: {name}")
        files.append(Path(name))
    for name in sorted(RELEASE_ROOT_DIRECTORIES):
        directory = source / name
        if not directory.is_dir():
            raise FileNotFoundError(f"required release directory is missing: {name}")
        for path in directory.rglob("*"):
            relative = path.relative_to(source)
            is_junction = getattr(path, "is_junction", lambda: False)()
            if path.is_symlink() or is_junction:
                raise ValueError(f"links and junctions are not packageable: {relative.as_posix()}")
            if path.is_file() and not is_excluded(relative):
                files.append(relative)
    return sorted(files, key=lambda item: item.as_posix())
```

Make `hash_tree`, `write_archive`, and `install_tree` use this collector. Preserve stable timestamps, sorted members, prefix, file mode, overwrite refusal, and post-copy hash checks.

- [ ] **Step 4: Add mutation coverage**

For each development root, assert it never appears in collected members. For each required file/directory, delete it independently and assert `FileNotFoundError` names it. Preserve junction, archive-path, deterministic-byte, drift, and overwrite-refusal tests.

- [ ] **Step 5: Add committed release parity tests**

Create `tests/test_repository_distribution.py`:

```python
import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1]
REPO = SOURCE.parents[1]
RELEASE = REPO / "plugins" / "physics-simulation-superpowers"

def load_packager():
    path = SOURCE / "scripts" / "package_plugin.py"
    spec = importlib.util.spec_from_file_location("physics_release_packager", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module

class RepositoryDistributionTests(unittest.TestCase):
    def test_committed_release_matches_curated_source_bytes(self):
        package_plugin = load_packager()
        self.assertTrue(RELEASE.is_dir())
        self.assertEqual(package_plugin.hash_tree(SOURCE), package_plugin.hash_tree(RELEASE))

    def test_archive_matches_committed_release(self):
        package_plugin = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "physics-simulation-superpowers.zip"
            result = package_plugin.write_archive(RELEASE, archive)
            digest = package_plugin.tree_digest(package_plugin.hash_tree(RELEASE))
            self.assertEqual(result["tree_sha256"], digest)
```

- [ ] **Step 6: Verify focused GREEN**

Run `C:\Python314\python.exe -X utf8 -m unittest tests.test_packaging -q`. Expected: PASS. Repository parity intentionally remains RED until Task 4.

- [ ] **Step 7: Commit**

```powershell
git add sources/physics-simulation-superpowers/scripts/package_plugin.py sources/physics-simulation-superpowers/tests/test_packaging.py sources/physics-simulation-superpowers/tests/test_repository_distribution.py
git commit -m "feat: curate physics plugin release contents"
```

---

### Task 4: Publish the Physics Release Tree and Metadata

**Files:**
- Modify: physics source `.codex-plugin/plugin.json` and `README.zh-CN.md`
- Create: `plugins/physics-simulation-superpowers/**`
- Test: `sources/physics-simulation-superpowers/tests/test_repository_distribution.py`

**Interfaces:**
- Consumes: Task 3 package APIs.
- Produces: installable committed release with source/release/archive hash parity.

- [ ] **Step 1: Add failing metadata assertions**

```python
def test_published_manifest_uses_project_design_metadata(self):
    manifest = json.loads((RELEASE / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
    self.assertEqual(manifest["name"], "physics-simulation-superpowers")
    self.assertEqual(manifest["version"], "0.1.0")
    self.assertEqual(manifest["license"], "Apache-2.0")
    self.assertEqual(manifest["homepage"], "https://github.com/EverfIRE/ProjectDesign")
    self.assertEqual(manifest["repository"], "https://github.com/EverfIRE/ProjectDesign")
    self.assertEqual(manifest["author"], {
        "name": "EverfIRE", "url": "https://github.com/EverfIRE"
    })
```

- [ ] **Step 2: Prove RED**

Run `C:\Python314\python.exe -X utf8 -m unittest tests.test_repository_distribution -q` from the physics source. Expected: missing release failure.

- [ ] **Step 3: Update source metadata and install docs**

Preserve description, skills, capabilities, prompt, version, and license. Set author, homepage, repository, `interface.developerName`, and `interface.websiteURL` to EverfIRE/ProjectDesign. Document:

```powershell
codex plugin marketplace add EverfIRE/ProjectDesign --ref main
codex plugin marketplace upgrade project-design
```

State that restart, marketplace install, and new-task `@physics-simulation-superpowers` activation are required.

- [ ] **Step 4: Generate into a fresh exact target**

```powershell
$source = 'sources\physics-simulation-superpowers'
$target = 'plugins\physics-simulation-superpowers'
if (Test-Path -LiteralPath $target) { throw "Release target exists: $target" }
C:\Python314\python.exe -X utf8 "$source\scripts\package_plugin.py" --source $source --archive "$env:TEMP\physics-simulation-superpowers-0.1.0.zip" --install-dir $target
```

Expected: JSON reports equal source/installed tree digests.

- [ ] **Step 5: Validate and verify GREEN**

Run the full physics suite, `test_repository_distribution`, official plugin validator, and `quick_validate.py` for all 25 release skills. Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add sources/physics-simulation-superpowers/.codex-plugin/plugin.json sources/physics-simulation-superpowers/README.zh-CN.md plugins/physics-simulation-superpowers
git commit -m "build: add installable physics plugin release"
```

---

### Task 5: Publish a Two-Plugin Repo Marketplace and Distribution Gate

**Files:**
- Modify: `.agents/plugins/marketplace.json`
- Modify: `test/distribution.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: both release roots.
- Produces: marketplace `project-design` and cross-plugin isolation gate.

- [ ] **Step 1: Write failing marketplace expectations**

```js
const expectedPlugins = [
  {
    name: "project-design-keeper",
    source: { source: "local", path: "./plugins/project-design-keeper" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  },
  {
    name: "physics-simulation-superpowers",
    source: { source: "local", path: "./plugins/physics-simulation-superpowers" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  },
];
test("repo marketplace exposes both releases", async () => {
  const marketplace = await readJSON(".agents/plugins/marketplace.json");
  assert.equal(marketplace.name, "project-design");
  assert.equal(marketplace.interface.displayName, "ProjectDesign");
  assert.deepEqual(marketplace.plugins, expectedPlugins);
});
```

Add assertions that every path starts `./plugins/`, resolves inside the repo, names an existing manifest, and that physics release lacks `tests`, `evaluations`, `docs`, `.superpowers`, and `outputs`.

- [ ] **Step 2: Prove RED**

Run `node --test test/distribution.test.mjs`. Expected: old one-plugin marketplace failure.

- [ ] **Step 3: Write exact marketplace metadata**

Set top-level name/display name above and write the two `expectedPlugins` entries in that order.

- [ ] **Step 4: Ignore generated artifacts**

```gitignore
/artifacts/
/sources/*/.package/
/sources/physics-simulation-superpowers/outputs/
```

- [ ] **Step 5: Verify GREEN and commit**

Run root distribution test and physics repository parity test. Then:

```powershell
git add .agents/plugins/marketplace.json .gitignore test/distribution.test.mjs
git commit -m "feat: publish two-plugin repository marketplace"
```

---

### Task 6: Expand CI into Independent Keeper, Physics, and Distribution Gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `test/distribution.test.mjs`

**Interfaces:**
- Consumes: both source roots, both committed release roots, and the repository marketplace.
- Produces: three independently diagnosable CI gates; distribution cannot pass when either plugin gate fails.

- [ ] **Step 1: Add a failing workflow-structure test**

Extend `test/distribution.test.mjs`:

```js
test("CI verifies both plugins and repository distribution independently", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /^  project-design-keeper:/mu);
  assert.match(workflow, /^  physics-simulation-superpowers:/mu);
  assert.match(workflow, /^  distribution:/mu);
  assert.match(workflow, /sources\/project-design-keeper/);
  assert.match(workflow, /sources\/physics-simulation-superpowers/);
  assert.match(workflow, /test_repository_distribution/);
  assert.match(workflow, /distribution:[\s\S]*needs:[\s\S]*project-design-keeper[\s\S]*physics-simulation-superpowers/);
});
```

- [ ] **Step 2: Prove RED**

Run `node --test test/distribution.test.mjs`. Expected: the old workflow has neither the new source paths nor the three required job names.

- [ ] **Step 3: Preserve and rename the Keeper gate**

Move all existing ProjectDesignKeeper checks to `project-design-keeper`, change every working directory/path from `source` to `sources/project-design-keeper`, and retain both Windows package verification and Ubuntu portability coverage. Do not weaken fixture-safety assertions.

- [ ] **Step 4: Add the physics gate**

On Ubuntu with Python 3.11:

```yaml
- run: python -m json.tool sources/physics-simulation-superpowers/.codex-plugin/plugin.json
- run: python -m unittest discover -s tests -p "test_*.py"
  working-directory: sources/physics-simulation-superpowers
- run: python -m unittest tests.test_repository_distribution -q
  working-directory: sources/physics-simulation-superpowers
- run: git ls-files "*.zip" | tee tracked-zips.txt && test ! -s tracked-zips.txt
```

Also parse every tracked physics `*.json` file, run the repository-shipped validator against the physics source plugin and every released skill, and verify there are exactly 25 released skills. The job must fail on malformed JSON or any missing, extra, or modified release file.

- [ ] **Step 5: Add the repository distribution gate**

Create `distribution` with `needs: [project-design-keeper, physics-simulation-superpowers]`. It checks out the merge candidate and runs:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: node --test test/distribution.test.mjs
```

- [ ] **Step 6: Verify GREEN locally**

Run the root distribution test, the complete Keeper suite and package verifier, and the complete physics suite and repository parity test. Expected: all PASS and no tracked ZIP files.

- [ ] **Step 7: Commit**

```powershell
git add .github/workflows/ci.yml test/distribution.test.mjs
git commit -m "ci: verify both plugin distributions"
```

---

### Task 7: Document the Unified Repository and Prepare Release Notes

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/releases/physics-simulation-superpowers-0.1.0.md`
- Modify: `test/distribution.test.mjs`

**Interfaces:**
- Consumes: final repository layout and marketplace commands.
- Produces: user-facing install/activation instructions and the exact GitHub Release body.

- [ ] **Step 1: Add failing documentation assertions**

```js
test("README explains source/release separation and both plugin activations", async () => {
  const readme = await readFile("README.md", "utf8");
  for (const required of [
    "sources/project-design-keeper",
    "sources/physics-simulation-superpowers",
    "plugins/project-design-keeper",
    "plugins/physics-simulation-superpowers",
    "codex plugin marketplace add EverfIRE/ProjectDesign --ref main",
    "@project-design-keeper",
    "@physics-simulation-superpowers",
  ]) assert.ok(readme.includes(required), `README missing ${required}`);
});
```

- [ ] **Step 2: Prove RED**

Run `node --test test/distribution.test.mjs`. Expected: the current single-plugin README fails the new contract.

- [ ] **Step 3: Rewrite the repository README**

Explain that `ProjectDesign` is a two-plugin monorepo, that `sources/*` is the only hand-maintained source and `plugins/*` contains deterministic installable trees, and that physics focuses Unreal Engine while treating other engines briefly unless their physics systems are unusually strong. Include marketplace add/upgrade, restart, install, and new-task `@` activation steps for both plugins.

- [ ] **Step 4: Write exact physics release notes**

`docs/releases/physics-simulation-superpowers-0.1.0.md` must contain:

- tag and artifact names;
- 25-skill scope covering development, research, analysis, and paper reproduction;
- Unreal Engine priority and other-engine policy;
- marketplace installation and `@physics-simulation-superpowers` activation;
- source commit provenance and test/validator evidence;
- SHA-256 verification command;
- notice that the ZIP is a generated GitHub Release asset, not a tracked repository file.

- [ ] **Step 5: Update the changelog**

Add an unreleased monorepo migration entry and a `physics-simulation-superpowers 0.1.0` release entry without rewriting existing Keeper history.

- [ ] **Step 6: Verify GREEN and commit**

Run `node --test test/distribution.test.mjs` and `git diff --check`. Then:

```powershell
git add README.md CHANGELOG.md docs/releases/physics-simulation-superpowers-0.1.0.md test/distribution.test.mjs
git commit -m "docs: document ProjectDesign plugin distribution"
```

---

### Task 8: Final Verification, Review, Merge, Tag, and GitHub Release

**Files:**
- Generated locally only: `artifacts/physics-simulation-superpowers-0.1.0.zip`
- Generated locally only: `artifacts/SHA256SUMS.txt`
- Read-only verification: all files changed by Tasks 1-7

**Interfaces:**
- Consumes: a fully green feature branch and approved release notes.
- Produces: merged `main`, tag `physics-simulation-superpowers-v0.1.0`, GitHub Release assets, and independently re-verified downloaded hashes.

- [ ] **Step 1: Run the complete local verification matrix**

Run, from the repository root:

```powershell
node --test test/distribution.test.mjs
npm test --prefix sources/project-design-keeper
npm run package --prefix sources/project-design-keeper
npm run verify-package --prefix sources/project-design-keeper
C:\Python314\python.exe -X utf8 -m unittest discover -s tests -p "test_*.py"
C:\Python314\python.exe -X utf8 -m unittest tests.test_repository_distribution -q
git diff --check
git status --short
```

The two Python commands run with `sources/physics-simulation-superpowers` as their working directory. Re-run the official plugin validator on both committed release roots and `quick_validate.py` on every released physics skill. Verify `git ls-files "*.zip"` is empty.

- [ ] **Step 2: Request an independent code review**

Use `superpowers:requesting-code-review` against the design commit through feature-branch HEAD. The review must check architecture, packaging allowlists, source/release parity, marketplace paths, CI dependency structure, documentation, and release safety. Resolve every P0-P2 finding with tests and repeat Step 1; do not dismiss findings without evidence.

- [ ] **Step 3: Verify remote identity and release preconditions**

```powershell
git remote get-url origin
gh auth status
gh repo view EverfIRE/ProjectDesign --json nameWithOwner,defaultBranchRef,url
gh release view physics-simulation-superpowers-v0.1.0 --repo EverfIRE/ProjectDesign
git ls-remote --tags origin physics-simulation-superpowers-v0.1.0
```

Expected: origin and `gh repo view` both resolve to `EverfIRE/ProjectDesign`, default branch is `main`, and neither the tag nor release exists. If a tag or release already exists, stop and report the collision instead of overwriting it.

- [ ] **Step 4: Push the feature branch and open the PR**

```powershell
git push -u origin feat/plugin-monorepo-publishing
gh pr create --repo EverfIRE/ProjectDesign --base main --head feat/plugin-monorepo-publishing --title "Publish physics simulation plugin in unified monorepo" --body-file docs/releases/physics-simulation-superpowers-0.1.0.md
```

Record the PR URL. Confirm the remote diff contains no unexpected files, credentials, caches, tracked ZIPs, or changes outside the approved monorepo migration.

- [ ] **Step 5: Wait for required checks and merge**

```powershell
gh pr checks --repo EverfIRE/ProjectDesign --watch --fail-fast
gh pr merge --repo EverfIRE/ProjectDesign --squash --delete-branch
git switch main
git pull --ff-only origin main
```

Do not merge with failing or pending required checks. Record the merged commit SHA and re-run the root distribution test against merged `main`.

- [ ] **Step 6: Build deterministic release assets from merged main**

Build twice from `sources/physics-simulation-superpowers` into two fresh temporary install roots using `scripts/package_plugin.py`. Require both temporary trees to match the committed `plugins/physics-simulation-superpowers` tree byte-for-byte. Then create two archives from that verified committed release tree and require byte-identical archives. Copy one verified archive to:

```text
artifacts/physics-simulation-superpowers-0.1.0.zip
```

Generate `artifacts/SHA256SUMS.txt` from that archive with the repository packaging script, in the format:

```text
<lowercase-sha256>  physics-simulation-superpowers-0.1.0.zip
```

Extract the archive into a fresh temporary directory and run the official plugin validator, all 25 skill validators, and the repository parity test against its contents. Confirm the archive root is exactly `physics-simulation-superpowers/` and contains no development-only paths.

- [ ] **Step 7: Create and push the immutable tag**

```powershell
git tag -a physics-simulation-superpowers-v0.1.0 -m "physics-simulation-superpowers 0.1.0"
git push origin physics-simulation-superpowers-v0.1.0
```

Verify the pushed tag resolves to the merged `main` commit before publishing the release.

- [ ] **Step 8: Publish the GitHub Release**

```powershell
gh release create physics-simulation-superpowers-v0.1.0 artifacts/physics-simulation-superpowers-0.1.0.zip artifacts/SHA256SUMS.txt --repo EverfIRE/ProjectDesign --title "physics-simulation-superpowers 0.1.0" --notes-file docs/releases/physics-simulation-superpowers-0.1.0.md --verify-tag
```

- [ ] **Step 9: Download and independently verify the published assets**

```powershell
$releaseCheck = Join-Path $env:TEMP "project-design-release-check-0.1.0"
if (Test-Path -LiteralPath $releaseCheck) { throw "Verification target already exists: $releaseCheck" }
New-Item -ItemType Directory -Path $releaseCheck
gh release download physics-simulation-superpowers-v0.1.0 --repo EverfIRE/ProjectDesign --dir $releaseCheck
```

Compute the downloaded ZIP SHA-256 independently and compare it with both downloaded `SHA256SUMS.txt` and the pre-upload local hash. Validate the downloaded ZIP again. Verify the public release page exposes exactly the two intended assets.

- [ ] **Step 10: Report publication evidence**

Report the PR URL, merged commit SHA, tag, release URL, artifact SHA-256, final verification totals, marketplace install command, and new-task `@physics-simulation-superpowers` activation. If the current Codex session cannot hot-refresh the marketplace, record restart/install/new-task activation as the remaining external UI smoke check rather than claiming it passed. State explicitly that the ZIP is not committed and that the original independent physics repository was not modified or removed.

---

## Plan Self-Review

- [x] Every approved design requirement maps to at least one task and acceptance check.
- [x] Every hand-maintained path lives below `sources/*`; every marketplace path lives below `plugins/*`.
- [x] ProjectDesignKeeper and physics source, release, tests, and CI remain structurally isolated.
- [x] Physics development, research, analysis, and paper-reproduction capabilities remain included, with Unreal Engine dominant in Tasks 17-23 and other engines concise except for exceptional physics systems.
- [x] Packaging is allowlist-based, rejects unsafe paths, is reproducible, and proves source/install/archive parity.
- [x] No ZIP is tracked; the release ZIP and checksum are created only after merged-main verification.
- [x] Remote mutation is ordered PR → green CI → merge → tag → release → downloaded-asset verification.
- [x] Tag/release collisions and any P0-P2 review finding block publication.
- [x] Commands, paths, test locations, working directories, artifact names, and repository identifiers are internally consistent.
- [x] `git diff --check`, prohibited-placeholder scan, and plan/spec coverage review pass before this plan is committed.
