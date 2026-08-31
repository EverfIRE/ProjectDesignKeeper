---
name: unreal-chaos-physics
description: "Use when UE5 or Unreal Engine Chaos collision, async physics, networked physics, vehicles, Physics Assets, cloth, flesh, Geometry Collections, CVD, Unreal Insights, migration, profiling, or multiplayer."
---

## Version gate and ownership

Gate Blueprint/C++ symbols, console/config keys, editor/debug paths, and plugin claims on UE major/minor/patch, Launcher or source commit, platform/build target, enabled plugins, and feature maturity. Unknowns block surfaces. Every applied answer explicitly marks Blueprint/C++/console-config/editor-debug surfaces as feature/version-gated. Establish dedicated-server/client/replay authority; game thread, physics thread, async callback/state-handoff boundaries; asset/plugin ownership; authoritative versus cosmetic state. Reject as legacy—not guessed replacements—`PhysXScene`, `PxScene`, PVD/PhysX Visual Debugger, `UDestructibleComponent`/APEX Destruction, and `PxVehicleDrive4W`/PhysX Vehicles.

Before finalizing, treat response as incomplete unless prose or compact tables expose gates, routes, evidence, migration/source records, and verification/stop conditions; no fixed answer template required.

## Chaos workflow map

Build/plugins/platform/config/map/assets/seed/ordered inputs; 60 Hz cadence/accumulator/backlog; fixed/substep/async/tick groups; scale/geometry/filters/mass/inertia/CCD/sleep; domain counts; authority/history/correction/rewind/replay/resimulation/RTT/jitter/loss; budgets/invariants/tolerances/capture provenance.

After the gate, read only relevant sections of [references/unreal-chaos.md](references/unreal-chaos.md). Route collision/query/contact/CCD and simple-versus-complex geometry to `rigid-body-collision-contact`; cadence/thread/lifecycle to `architecting-real-time-physics`; Physics Asset constraints/drives/ragdolls to `constraints-ragdolls-active-physics`; characters/controllers to `character-controller-movement`; network to `networked-deterministic-physics`; Chaos Vehicles to `vehicle-physics`; Cloth/Flesh to `cloth-rope-soft-bodies`; Geometry Collections/Fracture/Fields to `destruction-fracture-fields`; evidence to `debugging-testing-physics`; cost to `profiling-scaling-physics`; when research applies, explicitly name `surveying-real-time-physics-research`; when paper reproduction applies, explicitly name `reproducing-simulation-papers`. Every workflow row names plugin/asset/runtime context, evidence, owner/core route, and version/maturity boundary. Own only UE/Chaos mapping.

## Evidence and migration

Separate fixed cadence, frame-dependent steps, substeps, and async state handoff; no callback/read-write surface is thread-safe until verified. Never stack toggles or prescribe values: compare capture IDs with exactly one change. Diagnose piles/tunneling: scale/geometry/filters/mass/inertia/velocity/CCD eligibility/contacts/constraints/sleep/cadence.

Every applied answer explicitly pairs version-supported CVD physics-state/query/solver evidence with Unreal Insights or documented p50/p95/p99 timing; CVD/FPS alone cannot attribute CPU. It states replication/prediction model, history length, correction thresholds, event semantics, packet-fault matrix, hash/state comparison, and replay/resimulation acceptance—not bitwise determinism or transform-only proof. It emits an official source/version/maturity/surface matrix and a migration ledger containing old advice, last verified context, current Chaos concept, supported surface, verification source, owner, replacement status, and test. Community posts cannot establish APIs.

## Acceptance

Honor active request cadence/budget; undeclared values block acceptance. Bundled evaluation: target-hardware 60 Hz and server physics CPU p95 <= 3 ms. Require gate/repro/routes/matrices; matched one-change CVD/timing; collision/constraint/network invariants; packet/replay/rollback; isolated vehicle/cloth/flesh/destruction tests. Exact symbols compile; verify nodes/settings in declared build. State fatal-stop conditions: non-finite state, authority/history corruption, thread-unsafe access, unsupported geometry/plugin/API, missing provenance, unsafe budget breach, or irreproducible migration advice.
