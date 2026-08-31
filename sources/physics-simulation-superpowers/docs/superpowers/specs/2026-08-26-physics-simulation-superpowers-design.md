# Physics Simulation Superpowers Design

## Objective

Create a locally installable Codex plugin named `physics-simulation-superpowers` that combines high-quality real-time game physics development guidance with research discovery, evidence analysis, experiment design, and executable paper reproduction. It must be callable through the Codex plugin/skill UI and remain portable as a source archive.

## Product Contract

- Default target: stable, playable real-time physics at 60 FPS, with explicit scaling guidance for 30 and 120 FPS.
- Domain: real-time game physics plus adjacent graphics, robotics, multibody, differentiable, GPU, and real-time numerical simulation research.
- Languages: English technical skill bodies; bilingual discovery metadata and a Chinese user guide; reports follow the user's language while preserving original equations and terminology.
- Distribution: personal marketplace installation plus a portable `physics-simulation-superpowers-0.1.0.zip`.
- Runtime dependencies: all bundled analysis tools use Python 3 standard library only.
- Safety: third-party research code is untrusted. Skills must require preflight license/dependency/resource inspection and an isolated execution environment. Large downloads, paid compute, credentials, private data, or long GPU jobs require separate authorization.
- Licensing: plugin-authored content is Apache-2.0. Direct adaptation is allowed only from clearly licensed MIT, Apache-2.0, BSD, or CC BY sources with attribution. Unknown, noncommercial, or redistribution-incompatible content is excluded from the package.

## Plugin Shape

The plugin contains `.codex-plugin/plugin.json`, `skills/`, `scripts/`, `schemas/`, `references/`, `tests/`, `evaluations/`, `assets/`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `README.zh-CN.md`. No MCP server or app manifest is needed in v0.1.0.

The manifest identifier is `physics-simulation-superpowers`, version `0.1.0`, display name `Physics Simulation Superpowers`, category `Developer Tools`, and capabilities `Research`, `Analysis`, and `Code`. It exposes at most three concise Chinese default prompts.

## Skill Catalog

### Router and development core

1. `using-physics-simulation-superpowers`
2. `architecting-real-time-physics`
3. `rigid-body-collision-contact`
4. `constraints-ragdolls-active-physics`
5. `character-controller-movement`
6. `vehicle-physics`
7. `cloth-rope-soft-bodies`
8. `destruction-fracture-fields`
9. `real-time-fluids-particles`
10. `networked-deterministic-physics`
11. `debugging-testing-physics`
12. `profiling-scaling-physics`

### Engine and SDK adapters

13. `unreal-chaos-physics`
14. `unity-real-time-physics`
15. `godot-jolt-physics`
16. `native-jolt-physics`
17. `nvidia-physx-sdk`
18. `rapier-physics`
19. `box2d-physics`

Adapters own versioned API names, engine tooling, deprecated-pattern warnings, and mappings into the core workflows. They do not duplicate core numerical guidance. If a user's version differs from the source snapshot, the adapter identifies the version before emitting symbols.

Adapter depth is intentionally asymmetric. `unreal-chaos-physics` is the flagship engine lane and owns the broadest current-version workflow map, conditional reference, debugging/tooling guidance, and evaluation surface. `native-jolt-physics` and `nvidia-physx-sdk` retain deep coverage because they are strong standalone physics systems whose integration contracts materially affect correctness. `rapier-physics` and `box2d-physics` stay focused on their distinctive high-quality runtime/2D capabilities. `unity-real-time-physics` and `godot-jolt-physics` are concise engine-integration maps: version/backend boundaries, essential APIs, tooling, pitfalls, and routes into core skills only. No non-Unreal adapter expands into a second copy of the development core.

### Research lane

20. `surveying-real-time-physics-research`
21. `reviewing-simulation-papers`
22. `designing-simulation-experiments`
23. `analyzing-simulation-evidence`
24. `reproducing-simulation-papers`
25. `translating-research-to-game-physics`

The research lane forms a single evidence flow: question -> source set -> claim/evidence records -> experiment plan -> reproduction run -> transfer brief. It distinguishes an author-artifact rerun from an independent reimplementation.

## Skill Authoring Contract

- Each `SKILL.md` has lowercase hyphenated `name` and a third-person `description` beginning with `Use when` and containing English plus Chinese trigger terms where useful.
- Frequently loaded routing text stays under 200 words; other entrypoints target under 500 words and use one-level-deep references for conditional detail.
- Each skill states a core principle, a bounded workflow or decision contract, output expectations, source anchors, and common mistakes. It does not restate generic model knowledge or copy full manuals.
- Automatic discovery remains enabled. Each `agents/openai.yaml` has a short display name, 25-64 character UI description, and a one-sentence default prompt that explicitly names `$skill-name`.
- Each skill receives an evaluation before authoring, a post-skill behavioral evaluation, quick validation, task review, and a commit before the next skill begins.

## Machine-Readable Interfaces

### `physics-run.schema.json`

Requires `schema_version`, `run_id`, `engine`, `units`, `timing`, `authority`, `network`, `platform`, `budget`, and `seed`. Timing includes `render_fps_target`, `physics_hz`, `fixed_dt_seconds`, and `max_substeps`. Budget includes `cpu_ms`, `gpu_ms`, and `memory_mb`.

### Physics trace JSONL

Each line requires `run_id`, `tick`, `sim_time_seconds`, and `dt_seconds`; optional metrics include CPU/GPU time, active bodies, contacts, islands, maximum penetration, maximum constraint error, NaN count, state hash, and custom counters.

### `paper-record.schema.json`

Requires paper identity, contribution type, claims, evidence anchors, methods/assumptions, experimental conditions, artifacts, limitations, real-time applicability, verdict, and confidence.

### `experiment-plan.schema.json`

Requires hypothesis, independent/dependent variables, baselines, fixed budgets, scenes, metrics, seeds, repetitions, tolerances, ablations, resource estimate, and stop conditions.

### `reproduction-run.schema.json`

Requires target, reproduction mode, artifact identity and commit, inventory hashes, environment, commands, inputs, expected results, observed results, tolerances, patch log, deviations, evidence paths, and status. Status is one of `pass`, `partial`, `fail`, or `blocked`. Compilation or installation alone never qualifies as `pass`.

## Bundled Tools

1. `validate_run_manifest.py`: validate required physics-run structure and numeric ranges.
2. `analyze_physics_trace.py`: compute count, mean, p50, p95, p99, maximums, and threshold failures from JSONL/CSV traces.
3. `compare_replay_hashes.py`: find the first missing or divergent tick between replay traces.
4. `compare_step_sweep.py`: compare metrics across fixed-step/substep runs against a declared reference.
5. `validate_research_artifact.py`: validate paper records, experiment plans, and reproduction runs.
6. `inventory_artifact.py`: inventory files with sizes and SHA-256 hashes while excluding VCS/cache directories.
7. `compare_reported_results.py`: compare reported and observed scalar results with absolute/relative tolerances and optional repeated samples.

All tools accept JSON, JSONL, or CSV where their interface calls for it, print actionable diagnostics, and return `0` for pass, `1` for valid input that fails a target/threshold, and `2` for invalid input or usage.

## Source Governance

`references/source-audit.md` records every candidate with URL, retrieval date, commit/tag, license, authority, real-time relevance, actionability, maintenance, version clarity, test evidence, score, decision, and influenced skills. Admission requires at least 24/30 and nonzero correctness and licensing scores. `references/sources.lock.json` is the machine-readable snapshot.

Primary technical anchors include official OpenAI plugin/skill documentation; official Unreal Chaos, Unity, Godot/Jolt, NVIDIA PhysX, Jolt, Rapier, and Box2D documentation; ACM artifact guidance; NeurIPS reproducibility guidance; and primary papers/talks for fixed stepping, contact/constraints, PBD/XPBD, CCD, determinism, rollback, fluids, and differentiable simulation.

## Verification and Acceptance

- Every Python behavior demonstrates a failing test before implementation, then focused and full-suite green runs.
- Every skill has baseline and enabled evaluations that exercise observable decisions, not source-text matching.
- Router evaluations cover Chinese and English prompts, explicit invocation, implicit discovery, and negative boundaries.
- Research evaluations cover abstract overclaiming, unfair baselines, missing hardware for real-time claims, unavailable artifacts, blocked reproduction, numerical mismatch, and independent reimplementation.
- `quick_validate.py` passes for all 25 skills and `validate_plugin.py` passes for the plugin.
- The complete test suite passes with pristine output; source and license audits show no unresolved blockers.
- The personal marketplace preserves existing entries, adds the new plugin, and a fresh Codex task exposes the plugin/skills through `@` discovery. Because this environment uses Codex CLI 0.111.0, CLI installation and desktop discovery are verified separately; a CLI feature absence is not treated as proof that the desktop plugin is unavailable.
- The installed source tree and portable zip have identical content except VCS, caches, test scratch, and the zip itself.

## Scope Boundaries

Traditional CAE, molecular dynamics, and offline scientific CFD are outside v0.1.0. Real-time fluids, deformables, destruction, robotics, and differentiable simulation are included only where they inform interactive game simulation. Paper writing and journal submission workflows are not included.
