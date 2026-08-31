---
name: cloth-rope-soft-bodies
description: Use when cloth/cape/rope/cable/soft body/deformable/PBD/XPBD/compliance/self-collision/tearing/LOD or 布料、披风、绳索、软体、形变、自碰撞、撕裂 problems need diagnosis.
---

Sources: primary PBD/XPBD, cloth, rope, FEM/projective, collision, and tearing literature; audited official backends. APIs adapter-owned.

## Deformable contract

- gameplay role/authority/topology class; choose mass-spring/PBD/XPBD/FEM-projective/cosmetic per-object by gameplay/budget; justify. Unknown method choices block tuning and acceptance.
- world/gravity/units; rest geometry; particle/element masses or densities and distribution; fixed-dt; render-input/kinematic-target sampling; fixed-tick consumption; interpolation.
- stretch/shear/bend/area/volume constraints-or-energies; constitutive/compliance parameters; damping/drag; solver order/warm-start/substep-iteration policy; label values physical or iteration-dependent.
- local attachment frames; one-/two-way coupling and reaction transfer; previous/current animated-collider transforms; teleport/discontinuity policy.
- proxies/masks/sidedness/thickness-margin; discrete/continuous collision; initial overlaps/friction; self-collision adjacency exclusions/broad phase/contact caps.
- tearing/plasticity trigger/hysteresis/topology mutation/conservation/limits/authority/replication; skinning/normals/simulation-render mapping; LOD state transfer; sleep/wake/offscreen behavior.
- determinism and replay scope; active counts; memory/CPU budgets; observables/tolerances/rollback/degradation. Missing size/topology/count/material/cap/error data block. Never infer 20 iterations, 4 substeps, doubled thickness, or all-vertex self-collision.

## Staged diagnosis

1. freeze one pose/state authority; verify units/rest/mass/targets; remove render-dt.
2. isolate cloth, rope, and soft-body representations without collision; verify gradients/signs/conservation/finiteness.
3. sweep fixed dt/substeps/iterations only as controlled variables; keep XPBD compliance dt-consistent.
4. add attachments and animated colliders; bound teleport reset/reprojection/detach.
5. add external collision before self-collision; separate tunneling/recovery; sweep fast motion.
6. add budgeted self-collision; validate element-scale thickness/exclusions/persistence/friction/caps.
7. add area/volume preservation, then tearing/plasticity; validate topology/constraints/mass/state.
8. profile worst-case declared active counts; validate reversible tiers/transitions.

## Collision, coupling, and LOD

rest-relative stretch and signed oriented-rest-volume error; signed proxy/thickness separation; local anchors/collider history; direct particle teleport is reset-only; no duplicate/opposed pair contacts; cap hits observable. Tears: atomic topology/adjacency/render/state/conservation update plus authority event. Tier resolution/candidates/frequency/far-rate/cosmetics; preserve attachments/gameplay contacts/authority/collision safety/bounded state through projection/state transfer and hysteresis; never skip random bodies/ticks.

## Acceptance

First experiment: identical-seed/input A/B: Reject A=current render-dependent/high-stiffness/all-self-collision/doubled-thickness/iteration proposal; B=staged fixed-tick candidate; render 30/60/120 FPS; physics 60 Hz in bundled evaluation. Honor active request cadence. Cover hanging/sag/prescribed deformation/attachment/collider/fold/rope/soft-body/tear/teleport/sleep/LOD/worst-count.

Record max/p50/p95 stretch error, shear error, bend error, area error, volume error, and attachment error; penetration duration; candidate/contact/exclusion/duplicate/cap counts; force residual; multipliers/impulses/energy/work/nonfinite state; tear topology counts and mass change; LOD transition counts and projection/pop evidence; active particles/elements/bodies; memory; CPU p50/p95/p99.

Honor active request budget; undeclared values block acceptance. Bundled evaluation: accept declared finite-bounded render-invariant tolerances/semantics, with CPU p95 <=2 ms. Ordinary reject exceeded tolerance. Fatal stop and roll back on nonfinite/growing error-energy-penetration, corrupt/duplicate topology, exhausted solver/contact/collision caps, unsafe transfer, or p95 failure. Undeclared method decisions, tolerances, or active counts block tuning and acceptance.
