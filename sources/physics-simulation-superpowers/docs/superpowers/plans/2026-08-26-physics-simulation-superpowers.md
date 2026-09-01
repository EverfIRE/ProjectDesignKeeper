# Physics Simulation Superpowers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, package, and locally install a 25-skill Codex plugin for real-time game physics development, research, analysis, and executable paper reproduction.

**Architecture:** A compact router selects development, adapter, or research workflows. Skills contain judgment and progressive-disclosure references; standard-library Python tools enforce manifests, evidence, comparisons, and reproducibility records. The source repository remains isolated until the final personal-marketplace installation task.

**Tech Stack:** Codex plugin/Agent Skills Markdown, JSON Schema-style documents, Python 3.14 standard library, `unittest`, Git, PowerShell.

**Spec:** `docs/superpowers/specs/2026-08-26-physics-simulation-superpowers-design.md`

## Global Constraints

- Plugin identifier is exactly `physics-simulation-superpowers`; version is `0.1.0`; license is `Apache-2.0`.
- Default target is stable playable 60 FPS real-time game physics, scalable to 30 and 120 FPS.
- Technical skill bodies are English; discovery metadata is bilingual where useful; the user guide is Chinese.
- Plugin scope is real-time game physics plus transferable graphics, robotics, multibody, differentiable, GPU, and real-time numerical simulation research.
- All bundled scripts use only the Python standard library and return `0=pass`, `1=valid-but-failed`, `2=invalid input or usage`.
- Skill descriptions begin with `Use when`, are third-person triggering conditions, and do not summarize the workflow.
- References use forward-slash relative paths and are linked directly from `SKILL.md`; no reference nesting.
- Unknown, noncommercial, or redistribution-incompatible material is not copied into the plugin.
- Each skill completes baseline evaluation, enabled evaluation, quick validation, review, and commit before the next skill starts.
- Third-party code execution is isolated and requires separate authorization for large downloads, paid compute, credentials, private data, or long GPU jobs.

---

### Task 1: Scaffold, manifest, and test harness

**Files:** Create `.codex-plugin/plugin.json`, `.gitignore`, `tests/test_plugin_structure.py`, `tests/evaluation_contract.py`, and the required top-level directories.

**Interfaces:** Produces a plugin root discoverable through `./skills/` and a reusable evaluation record contract with `scenario`, `baseline`, `enabled`, `verdict`, and `evidence` fields.

- [ ] Write `tests/test_plugin_structure.py` to load the manifest and assert the exact name, version, license, interface display name/category/capabilities, three-or-fewer Chinese default prompts, and absence of MCP/app fields.
- [ ] Run `py -3 -m unittest tests.test_plugin_structure -v`; verify RED because the manifest is absent.
- [ ] Run plugin-creator `create_basic_plugin.py physics-simulation-superpowers --path <repository-parent> --with-skills --with-scripts --with-assets`, then set the exact manifest fields and create `schemas/`, `references/`, `tests/`, and `evaluations/`.
- [ ] Implement `tests/evaluation_contract.py` so later tests can validate evaluation JSON without importing production tools.
- [ ] Run the focused test and `py -3 -m unittest discover -s tests -v`; verify GREEN with pristine output.
- [ ] Commit as `chore: scaffold physics simulation plugin`.

### Task 2: Schemas and manifest validation tools

**Files:** Create `schemas/physics-run.schema.json`, `schemas/paper-record.schema.json`, `schemas/experiment-plan.schema.json`, `schemas/reproduction-run.schema.json`, `scripts/validate_run_manifest.py`, `scripts/validate_research_artifact.py`, `tests/test_manifest_validation.py`, and fixtures under `tests/fixtures/manifests/`.

**Interfaces:** `validate_document(kind: str, data: dict) -> list[str]`; CLI output is one diagnostic per line with exit codes from the global contract.

- [ ] Write literal-fixture tests for one valid and at least two invalid documents per schema, including nonpositive timestep, missing claim evidence, empty baselines, and `pass` without observed results.
- [ ] Run `py -3 -m unittest tests.test_manifest_validation -v`; verify RED because the modules do not exist.
- [ ] Implement explicit structural and numeric validation with no third-party JSON Schema dependency; keep schemas as documented portable contracts.
- [ ] Run focused and full tests; verify GREEN.
- [ ] Commit as `feat: add simulation and research manifest validation`.

### Task 3: Physics trace, replay, and step-sweep analysis

**Files:** Create `scripts/analyze_physics_trace.py`, `scripts/compare_replay_hashes.py`, `scripts/compare_step_sweep.py`, `tests/test_physics_analysis.py`, and trace fixtures.

**Interfaces:** Parse JSONL/CSV; emit deterministic JSON summaries. Percentiles use nearest-rank with documented behavior. Replay comparison emits `first_divergent_tick` or `null`.

- [ ] Write tests with hand-derived mean/p50/p95/p99, threshold pass/fail, malformed rows, missing ticks, mismatched hashes, and reference-step deviations.
- [ ] Run the focused tests and verify RED for missing modules.
- [ ] Implement parsers, statistics, diagnostics, and CLI exit behavior.
- [ ] Run focused and full tests; verify GREEN.
- [ ] Commit as `feat: add physics trace and replay analyzers`.

### Task 4: Research artifact inventory and result comparison

**Files:** Create `scripts/inventory_artifact.py`, `scripts/compare_reported_results.py`, `tests/test_research_tools.py`, and fixtures under `tests/fixtures/research/`.

**Interfaces:** Inventory emits sorted relative paths, byte sizes, and SHA-256; excludes `.git`, caches, and caller-provided patterns. Result comparison accepts scalar reported/observed values, absolute/relative tolerances, and repeated observations.

- [ ] Write tests for stable hashing/order, exclusions, missing files, exact match, absolute/relative tolerance boundaries, repeated-sample summaries, and invalid numeric input.
- [ ] Run focused tests and verify RED.
- [ ] Implement both tools and CLI contracts.
- [ ] Run focused and full tests; verify GREEN.
- [ ] Commit as `feat: add research artifact evidence tools`.

### Task 5: `using-physics-simulation-superpowers`

**Files:** Create `skills/using-physics-simulation-superpowers/SKILL.md`, `agents/openai.yaml`, `evaluations/using-physics-simulation-superpowers/evaluation.json`.

**Interfaces:** Routes by intent, domain, engine/backend, 2D/3D, authoritative/cosmetic role, network model, platform, and budget; emits selected skill names and missing context.

- [ ] Record a fresh-agent baseline against a mixed Chinese request for a networked Chaos vehicle paper reproduction; capture any failure to separate research, reproduction, adapter, and development lanes.
- [ ] Author a sub-200-word router that selects the minimum relevant skills and keeps traditional CAE/MD/offline CFD out of scope.
- [ ] Run the same scenario with the skill and record whether it chooses the research, reproduction, Chaos, vehicle, network, and profiling paths without loading unrelated skills.
- [ ] Run quick validation and repository tests; commit as `feat: add physics simulation router skill`.

### Task 6: `architecting-real-time-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Produces a physics contract covering gameplay authority, units/scale, fixed tick, substeps, collision representation, determinism, platform budget, observability, and degradation policy.

- [ ] Baseline-test a request that jumps directly to force tuning without specifying scale, timestep, authority, or budget.
- [ ] Author the minimal decision contract with 60 FPS default and explicit 30/120 FPS scaling.
- [ ] Re-test for a complete contract rather than arbitrary tuning constants.
- [ ] Validate, run tests, and commit as `feat: add real-time physics architecture skill`.

### Task 7: `rigid-body-collision-contact`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Covers body types, shapes, broad/narrow phase, manifolds, friction/restitution, CCD, sleeping/islands, mass/inertia, and contact diagnostics.

- [ ] Baseline-test a high-speed projectile tunneling and stacked-body jitter case.
- [ ] Author a diagnosis-first workflow that distinguishes discrete collision, solver/contact, scale, and timestep failures.
- [ ] Re-test for appropriate CCD/shape/step recommendations and measurable checks.
- [ ] Validate, run tests, and commit as `feat: add rigid body collision skill`.

### Task 8: `constraints-ragdolls-active-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Covers joints, motors/drives, constraint frames, iteration budgets, ragdolls, physical animation, PBD/XPBD compliance, and recovery diagnostics.

- [ ] Baseline-test an unstable active ragdoll with conflicting animation and constraints.
- [ ] Author guidance that establishes frames, mass ratios, drive targets, compliance, limits, and staged activation before gain tuning.
- [ ] Re-test for stable incremental diagnosis and measurable constraint error.
- [ ] Validate, run tests, and commit as `feat: add constraints and ragdolls skill`.

### Task 9: `character-controller-movement`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Chooses kinematic, dynamic, or hybrid control and handles grounding, slopes, steps, moving platforms, crouch resizing, pushing, and fixed-tick input.

- [ ] Baseline-test a controller that jitters on slopes and loses moving-platform velocity.
- [ ] Author a controller contract with explicit collision queries and ground-state transitions.
- [ ] Re-test for slope/step/platform handling without engine-specific stale APIs.
- [ ] Validate, run tests, and commit as `feat: add character movement skill`.

### Task 10: `vehicle-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Covers arcade-to-simulation fidelity, suspension, tires, drivetrain, aero, weight transfer, contacts, controls, telemetry, and network authority.

- [ ] Baseline-test a vehicle that hops, flips, and changes behavior with frame rate.
- [ ] Author staged tuning from scale/inertia through suspension, tire forces, assists, and telemetry.
- [ ] Re-test for fixed-step and force-budget reasoning rather than magic coefficients.
- [ ] Validate, run tests, and commit as `feat: add vehicle physics skill`.

### Task 11: `cloth-rope-soft-bodies`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Covers mass-spring/PBD/XPBD choices, compliance, iterations, collision/self-collision, attachments, skinning, LOD, and failure metrics.

- [ ] Baseline-test stretching cloth with self-collision explosions under a 2 ms budget.
- [ ] Author a budget-aware workflow that separates timestep, compliance, topology, collision thickness, and LOD.
- [ ] Re-test for a measurable stretch/penetration plan and graceful degradation.
- [ ] Validate, run tests, and commit as `feat: add deformable simulation skill`.

### Task 12: `destruction-fracture-fields`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Covers prefracture/runtime fracture, clustering, support graphs, strain/damage, fields, debris lifetime, collision simplification, caching, and authority.

- [ ] Baseline-test cinematic destruction that exceeds CPU and network budgets.
- [ ] Author a gameplay/cosmetic partition with piece/contact budgets and deterministic event replication.
- [ ] Re-test for scalable tiers and failure containment.
- [ ] Validate, run tests, and commit as `feat: add real-time destruction skill`.

### Task 13: `real-time-fluids-particles`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Selects particles/VFX, PBF/SPH, grids, shallow water, or hybrid coupling by gameplay need and budget.

- [ ] Baseline-test a request for physically realistic interactive water at 60 FPS without specifying scale or coupling.
- [ ] Author a method-selection and validation contract covering incompressibility, stability, boundaries, coupling, visual reconstruction, and fallback.
- [ ] Re-test for a scoped method and fixed-budget evidence plan.
- [ ] Validate, run tests, and commit as `feat: add real-time fluids skill`.

### Task 14: `networked-deterministic-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Selects server authority, prediction/interpolation, rollback/resimulation, or lockstep; covers fixed tick, snapshots, quantization, input/state history, hashes, correction, and cosmetic separation.

- [ ] Baseline-test a multiplayer physics game that assumes identical floating-point outcomes across platforms.
- [ ] Author a network contract that distinguishes local, same-binary, and cross-platform determinism.
- [ ] Re-test for explicit authority, divergence detection, correction, and replay evidence.
- [ ] Validate, run tests, and commit as `feat: add networked deterministic physics skill`.

### Task 15: `debugging-testing-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Produces a minimal reproducer, invariants, instrumentation, hypothesis ladder, golden/replay tests, and regression acceptance criteria.

- [ ] Baseline-test a NaN/jitter/explosion report where the agent suggests random parameter changes.
- [ ] Author a root-cause workflow ordered by scale, step, collisions, constraints, forces, solver, threading, and network state.
- [ ] Re-test for falsifiable hypotheses and a regression test rather than tuning churn.
- [ ] Validate, run tests, and commit as `feat: add physics debugging and testing skill`.

### Task 16: `profiling-scaling-physics`

**Files:** Create the skill, UI metadata, and evaluation record.

**Interfaces:** Defines CPU/GPU budgets, capture conditions, p50/p95/p99, active counts, islands, contacts, shape/query cost, threading, GPU offload, LOD, culling, and worst-case scenes.

- [ ] Baseline-test an FPS-only physics performance comparison.
- [ ] Author a fixed-budget profiling contract using frame-time distributions and scene counters.
- [ ] Re-test for bottleneck attribution and reversible quality tiers.
- [ ] Validate, run tests, and commit as `feat: add physics profiling skill`.

### Task 17: `unreal-chaos-physics`

**Files:** Create the skill, `references/unreal-chaos.md`, UI metadata, and evaluation record.

**Depth:** Flagship engine adapter. Keep the entrypoint compact through conditional loading, but make the one-level reference and evaluation substantially broader than every other engine adapter.

**Interfaces:** Maps core workflows to current Unreal Chaos collision, constraints, fixed/substepped/async physics, Chaos Visual Debugger and profiling evidence, networked physics, vehicles, cloth, flesh, and Geometry Collections; rejects PhysX/APEX-era UE APIs and distinguishes supported Blueprint, C++, console/config, editor, and debugging surfaces by version.

- [ ] Baseline-test a UE5 request answered with deprecated PhysX/APEX symbols.
- [ ] Author the flagship adapter from current official Epic sources with a source/version matrix, conditional reference loading, core-skill routing, and task-oriented Chaos workflows rather than an API dump.
- [ ] Re-test collision/constraint/tick/network/vehicle/cloth/flesh/destruction routing, CVD/profiler evidence, stale-symbol rejection, and version qualification.
- [ ] Validate, run tests, and commit as `feat: add Unreal Chaos adapter`.

### Task 18: `unity-real-time-physics`

**Files:** Create the skill, `references/unity-physics.md`, UI metadata, and evaluation record.

**Depth:** Concise engine-integration map. Route numerical, networking, debugging, and profiling work to the core skills; do not recreate a Unity physics manual or duplicate the PhysX SDK adapter.

**Interfaces:** Maps only the essential Unity 6 3D/2D fixed-step, interpolation, CCD, joints, queries, profiler, DOTS/Unity Physics, and authority boundaries needed to choose the correct core workflow.

- [x] Baseline-test stale Unity Rigidbody APIs and transform writes on dynamic bodies.
- [x] Author a short version-pinned adapter using official Unity documentation, with a compact API/pitfall matrix and explicit routes to core and PhysX skills.
- [x] Re-test for correct fixed-tick APIs and backend distinctions.
- [x] Validate, run tests, and commit as `feat: add Unity physics adapter`.

### Task 19: `godot-jolt-physics`

**Files:** Create the skill, `references/godot-jolt.md`, UI metadata, and evaluation record.

**Depth:** Concise engine-integration map. Keep Godot lifecycle/API distinctions here and route Jolt internals to `native-jolt-physics` plus numerical guidance to the core.

**Interfaces:** Maps essential Godot 4 2D versus Jolt-backed 3D physics, CharacterBody, PhysicsServer, stepping/settings, profiling, and determinism boundaries without duplicating Jolt internals.

- [x] Baseline-test Godot 3-era movement APIs and unsupported determinism assumptions.
- [x] Author a short current-version adapter from official Godot/Jolt sources with explicit routing to the native Jolt skill.
- [x] Re-test for correct CharacterBody/Jolt distinctions and explicit version checks.
- [x] Validate, run tests, and commit as `feat: add Godot Jolt adapter`.

### Task 20: `native-jolt-physics`

**Files:** Create the skill, `references/jolt.md`, UI metadata, and evaluation record.

**Depth:** Deep standalone-physics adapter. Preserve integration and correctness detail because Jolt is a strong native physics system, while still routing generic numerical workflows to the core.

**Interfaces:** Covers C++ lifecycle/integration order, allocators/job system, layers/filters, bodies/shapes, character/vehicle/soft-body modules, state recording/restore, determinism tiers, debugging, profiling, and sample-backed validation.

- [x] Baseline-test a custom-engine integration that omits job-system, layer, and lifetime requirements.
- [x] Author the deep adapter from official Jolt docs/samples with a pinned source snapshot and integration-order decision contract.
- [x] Re-test for integration order, deterministic build conditions, and sample-backed API guidance.
- [x] Validate, run tests, and commit as `feat: add native Jolt adapter`.

### Task 21: `nvidia-physx-sdk`

**Files:** Create the skill, `references/physx.md`, UI metadata, and evaluation record.

**Depth:** Deep standalone-physics SDK adapter. Preserve PhysX 5 CPU/GPU, feature-availability, tooling, and migration detail, but do not duplicate engine wrappers or core numerical guidance.

**Interfaces:** Covers current PhysX 5 CPU/GPU scenes, rigid bodies, contacts, CCD, articulations, vehicles, deformables/particles, PVD/Omniverse tooling, compatibility, hardware requirements, and versioned migration boundaries.

- [x] Baseline-test advice copied from PhysX 3/4 without version qualification.
- [x] Author the deep adapter from current NVIDIA sources, clearly separating SDK, GPU-only, extension/tool, and engine-integration features.
- [x] Re-test for current API concepts and hardware/tool evidence.
- [x] Validate, run tests, and commit as `feat: add NVIDIA PhysX adapter`.

### Task 22: `rapier-physics`

**Files:** Create the skill, `references/rapier.md`, UI metadata, and evaluation record.

**Depth:** Focused strong-library adapter. Keep only Rapier-distinct binding/version, snapshot, SIMD/parallel, and enhanced-determinism guidance; route generic physics work to the core.

**Interfaces:** Covers the essential Rust/JavaScript 2D/3D world, body/collider, joint/query/character, snapshot, SIMD/parallelism, and enhanced-determinism boundaries.

- [x] Baseline-test a web rollback request that treats ordinary builds as cross-platform deterministic.
- [x] Author a concise adapter from official Rapier docs with binding/version distinctions and core-skill routes.
- [x] Re-test for enhanced-determinism requirements and snapshot/hash workflow.
- [x] Validate, run tests, and commit as `feat: add Rapier adapter`.

### Task 23: `box2d-physics`

**Files:** Create the skill, `references/box2d.md`, UI metadata, and evaluation record.

**Depth:** Focused best-in-class 2D adapter. Retain Box2D-specific fixed-step, contact/event, character/query, determinism, and profiling insight while avoiding generic 3D/core duplication.

**Interfaces:** Covers current Box2D fixed stepping, body/shape/joint, CCD, sensors/events, character/query patterns, determinism limits, and profiling for 2D games.

- [x] Baseline-test a variable-dt 2D platformer with unstable contacts.
- [x] Author a concise, high-signal adapter from current Box2D documentation and primary Erin Catto material, routing general workflows to the core.
- [x] Re-test for fixed-step, shape-cast/controller, and reproducibility guidance.
- [x] Validate, run tests, and commit as `feat: add Box2D adapter`.

### Task 24: `surveying-real-time-physics-research`

**Files:** Create the skill, `references/research-venues.md`, UI metadata, and evaluation record.

**Interfaces:** Produces a deduplicated source table with identity, venue/year, contribution class, primary links, artifact links, license, relevance, evidence quality, and inclusion decision.

- [x] Baseline-test a survey request that returns unsourced recommendations or duplicate arXiv/publisher versions.
- [x] Author a primary-source-first search, snowballing, deduplication, screening, and stopping workflow.
- [x] Re-test for traceable inclusion/exclusion and bounded claims.
- [x] Validate, run tests, and commit as `feat: add simulation research survey skill`.

### Task 25: `reviewing-simulation-papers`

**Files:** Create the skill, `references/paper-review-contract.md`, UI metadata, and evaluation record.

**Interfaces:** Produces Verdict, Core idea, claim-evidence matrix, equations/assumptions, evaluation audit, limits, confidence, and a minimal reproduction target with exact anchors.

- [x] Baseline-test a paper review based only on title/abstract.
- [x] Author an evidence-first review workflow covering paper, supplement, code, project page, figures, tables, equations, and failure cases.
- [x] Re-test for anchored evidence and explicit inference labels.
- [x] Validate, run tests, and commit as `feat: add simulation paper review skill`.

### Task 26: `designing-simulation-experiments`

**Files:** Create the skill, `references/experiment-design.md`, UI metadata, and evaluation record.

**Interfaces:** Produces a valid experiment-plan record with falsifiable hypothesis, fairness contract, metrics, seeds/repetitions, ablations, resource estimate, and stopping criteria.

- [ ] Baseline-test a quality comparison with different hardware, timestep, resolution, and scene budgets.
- [ ] Author fixed-budget and fixed-quality experiment patterns with appropriate statistics.
- [ ] Re-test for a falsifiable, resource-bounded plan accepted by `validate_research_artifact.py`.
- [ ] Validate, run tests, and commit as `feat: add simulation experiment design skill`.

### Task 27: `analyzing-simulation-evidence`

**Files:** Create the skill, `references/evidence-analysis.md`, UI metadata, and evaluation record.

**Interfaces:** Produces descriptive statistics, uncertainty, sensitivity, ablation interpretation, performance-quality frontier, failure cases, and claim-support verdicts without causal overreach.

- [ ] Baseline-test a single-run FPS claim with no variance, hardware, or scene context.
- [ ] Author analysis guidance tied to the bundled trace and reported-result tools.
- [ ] Re-test for uncertainty, matched budgets, and evidence-calibrated conclusions.
- [ ] Validate, run tests, and commit as `feat: add simulation evidence analysis skill`.

### Task 28: `reproducing-simulation-papers`

**Files:** Create the skill, `references/reproduction-protocol.md`, UI metadata, and evaluation record.

**Interfaces:** Produces a validated reproduction-run record, exact environment/commands, original-path evidence, patch log, comparisons, and `pass|partial|fail|blocked` result.

- [ ] Baseline-test pressure to run unknown author code with host credentials and to call compilation a successful reproduction.
- [ ] Author a permission-aware, isolated, minimal-target protocol aligned with ACM/NeurIPS artifact guidance.
- [ ] Re-test for preflight refusal of unsafe execution, correct status, and complete evidence chain.
- [ ] Validate, run tests, and commit as `feat: add simulation paper reproduction skill`.

### Task 29: `translating-research-to-game-physics`

**Files:** Create the skill, `references/transfer-brief.md`, UI metadata, and evaluation record.

**Interfaces:** Produces a transfer brief with retained claim, approximations, implementation slice, data/assets, engine mapping, frame/memory budget, authority, LOD/fallback, risks, and regression acceptance.

- [ ] Baseline-test direct adoption of an offline differentiable simulation method into a 60 FPS multiplayer game.
- [ ] Author a transfer workflow that separates scientific validity, implementation feasibility, and product value.
- [ ] Re-test for an explicit approximation/budget/evidence plan and a minimal prototype gate.
- [ ] Validate, run tests, and commit as `feat: add research to game transfer skill`.

### Task 30: Source audit, notices, and Chinese guide

**Files:** Create `references/source-audit.md`, `references/sources.lock.json`, `THIRD_PARTY_NOTICES.md`, `LICENSE`, and `README.zh-CN.md`; update reference links as required.

**Interfaces:** The lock file contains source identity, pinned version/commit, license, score breakdown, decision, and influenced skills. README documents install, `@` invocation, script interfaces, research flow, safety boundaries, and examples.

- [ ] Write tests that parse the lock file, require every adapter/research skill to have official primary anchors, enforce the 24/30 threshold for adopted community sources, and reject unknown/NC licenses.
- [ ] Run tests and verify RED because governance artifacts are absent.
- [ ] Populate the audited source snapshot, Apache-2.0 license, notices, and concise Chinese guide; do not copy large upstream text.
- [ ] Run focused/full tests and all skill quick validators; verify GREEN.
- [ ] Commit as `docs: add source governance and Chinese guide`.

### Task 31: Portable packaging and personal marketplace installation

**Files:** Create `scripts/package_plugin.py`, `tests/test_packaging.py`; install source to `C:/Users/qiupeng/plugins/physics-simulation-superpowers`; update personal marketplace through plugin-creator; create `outputs/physics-simulation-superpowers-0.1.0.zip`.

**Interfaces:** Packaging excludes `.git`, `.superpowers`, `__pycache__`, test scratch, and existing archives; archive paths begin with `physics-simulation-superpowers/`; installed and archived content hashes match the source exclusions.

- [ ] Write packaging tests for deterministic member order, exclusions, archive prefix, and hash parity; verify RED.
- [ ] Implement the standard-library packager and run focused/full tests to GREEN.
- [ ] Validate the personal marketplace name, copy the verified source to the personal plugin path, and use plugin-creator scaffold/update commands to append—not replace—the marketplace entry.
- [ ] Run `codex plugin add physics-simulation-superpowers@personal` if supported by the installed CLI; otherwise record the unsupported CLI result and verify desktop discovery through the personal marketplace path.
- [ ] Commit as `build: package and install physics simulation plugin`.

### Task 32: Full audit, final review, and handoff

**Files:** Update only defects found by the audit; write final evidence to the SDD report/ledger, not the plugin archive.

**Interfaces:** Completion evidence maps every design requirement to a file, command output, evaluation, installation state, or archive hash.

- [ ] Run `py -3 -m unittest discover -s tests -v`, all 25 `quick_validate.py` checks, `validate_plugin.py`, JSON parsing for every schema/lock/evaluation, archive listing/hash comparison, marketplace parsing, and Git status inspection.
- [ ] Run router and representative development/research/reproduction forward evaluations in fresh contexts.
- [ ] Generate a whole-branch review package and dispatch the final most-capable reviewer; apply exactly one reviewed fix wave if needed.
- [ ] Re-run the full verification set after any fix and inspect every requirement against authoritative evidence.
- [ ] Use `superpowers:finishing-a-development-branch`; commit final verified changes and provide Codex View/Share links plus the portable archive link.
