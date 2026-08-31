# physics-simulation-superpowers 0.1.0

This release adds the second installable plugin to the ProjectDesign marketplace.

## Release identity

- Tag: `physics-simulation-superpowers-v0.1.0`
- Plugin: `physics-simulation-superpowers` version `0.1.0`
- ZIP asset: `physics-simulation-superpowers-0.1.0.zip`
- Checksum asset: `SHA256SUMS.txt`
- License: Apache-2.0
- Imported source provenance: commit `690f0295d406a4007d50fa6133dc4671345092ad` from branch `feat/physics-simulation-superpowers`

The ZIP and checksum are generated from verified merged source as GitHub Release assets. They are not tracked repository files.

## Scope

The plugin contains 25 skills covering:

- real-time physics architecture and development;
- debugging, profiling, testing, and evidence analysis;
- research discovery, paper review, and controlled experiment design;
- isolated, reproducible paper and simulation artifact reproduction;
- translation of validated research into practical game-physics designs.

Unreal Engine / Chaos is the flagship target. Physics tasks 17–23 prioritize Unreal Engine; other engines are treated concisely unless they provide unusually strong physics systems, including focused native coverage for Jolt, PhysX, Rapier, and Box2D.

## Install and activate

Add or refresh the ProjectDesign marketplace:

```powershell
codex plugin marketplace add EverfIRE/ProjectDesign --ref main
codex plugin marketplace upgrade project-design
```

Restart Codex, open the Plugins Directory, and install `physics-simulation-superpowers`. Create a new task after installation and activate the plugin with `@physics-simulation-superpowers`; the installation task itself does not hot-refresh the plugin.

## Verification evidence

The release candidate was checked locally with the repository's required contracts:

- root distribution suite: 20 tests passed;
- complete physics suite: 623 tests ran on Python 3.11 with 2 intentional skips, and 623 tests ran on Python 3.14 with 1 intentional skip;
- physics repository source/release parity: 6 tests passed on both Python 3.11 and Python 3.14;
- repository validator: both physics plugin roots and all 25 released skills passed;
- tracked physics JSON validation: 56 files parsed;
- generated-artifact and public-release symlink-mode checks: no violations;
- deterministic source/install tree digest after regeneration: `dd907078ead26a0c108de41aa3417c543130890af520eeda04e91c2b7106b94c`.

The GitHub Actions workflow independently gates Project Design Keeper, Physics Simulation Superpowers, and the repository distribution. Publication proceeds only after those required checks pass on the pull request.

## Verify the downloaded SHA-256

Download both release assets into the same directory, then run:

```powershell
$expected = ((Get-Content .\SHA256SUMS.txt -Raw) -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash .\physics-simulation-superpowers-0.1.0.zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "SHA-256 mismatch: expected $expected, got $actual" }
"SHA-256 verified: $actual"
```

The value in `SHA256SUMS.txt` is produced from the final merged-main archive and is also independently rechecked after downloading the published GitHub Release assets.
