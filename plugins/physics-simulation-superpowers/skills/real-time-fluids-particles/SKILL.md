---
name: real-time-fluids-particles
description: Use when fluid/water/liquid/particles/PBF/SPH/grid/shallow water/free surface/incompressibility/buoyancy/coupling or 流体、水体、液体、粒子、浅水、不可压缩、浮力、耦合 problems need diagnosis.
---

Sources: primary PBF/SPH, FLIP/grid, shallow-water, free-surface, fluid-rigid coupling, real-time reconstruction research; audited official backends. APIs adapter-owned.

## Fluid contract

- Gameplay/cosmetic-role; unique local/server-authority; network-state/events/checkpoints; determinism/replay-scope; 2D/2.5D/3D method per near-interaction/far-surface/spray.
- Domain/world-scale, coordinates/units/gravity, initial/boundary-volume, water-depth/range, active-regions; density/viscosity/surface tension, compressibility/free-surface-target, phase/material, temperature(if-needed).
- Timing: active request gameplay-tick, render-sampling/interpolation, measured solver-step, CFL/stability-rule, substeps/iterations/caps; bundled evaluation: 60-Hz gameplay-tick.
- Representation: particles/grid/cells/kernels/neighbors or shallow-water-height/velocity/bathymetry; transfers/advection/projection; mass/volume-bookkeeping. Boundaries: static/moving/open-boundaries, SDF/collider-resolution, inflow/outflow/gates, initial-overlap, leakage/fast-body-policy.
- Coupling: one-/two-way rigid/character-coupling, displaced-volume, buoyancy/drag/pressure/impulse-reaction, authority/order, force-caps. Rendering: surface reconstruction/meshing/normals, spray/foam/bubbles/wetness, render-only feedback exclusion.
- Declare GPU/CPU/memory/bandwidth-budgets, active-counts, observables/fallbacks/stop-rules. Unknown gameplay role, authority, dimensionality, scale, method, coupling, active counts, hardware, memory, network, or error budgets each block method selection, tuning, and acceptance. Never infer one-million particles, eight pressure-iterations, higher viscosity/surface-tension, all-particle-sync, or numeric tuning.

## Method selection and pipeline

Requirement table: persistent-volume/flow, depth-variation/overturning, breaking/spray, object-blocking/displacement, two-way-gameplay-forces, domain-size, budgets. After declaration, map cosmetic-particles=no-gameplay-mass; shallow-water=horizontal-height-fields; PBF/SPH=local-free-surface-topology; FLIP-like-grid=volumetric-incompressibility; hybrid=explicit-conservation-seams. rejected-alternatives/revisit-evidence.

Pipeline: fixed-tick-event/kinematic-sample; active-domain-update; boundary/gate/inflow/outflow-update; source/sink-mass-ledger; advection/prediction; forces; neighbor/grid-transfer; incompressibility/density solve declared residual/caps; collisions/two-way-reaction; velocity/state-commit; surface/foam-reconstruction; render-interpolation; telemetry/checkpoint.

Validate rest-water and manufactured/known-flow before coupling; one-gate/rigid-body/character/explosion-forcing. Separate leakage/divergence/density/advection/boundary/coupling/render-errors.

## Coupling, rendering, and degradation

Gameplay bodies share boundary-geometry/frame-history. Apply equal/opposite reaction exactly-once in declared order. Cosmetic spray/foam never feeds mass/pressure/buoyancy/blocking/authority.

Near/far representations declare mass/height/velocity exchange, overlap/blend-region, conservation-error/hysteresis. LOD may shrink active-3D-domains, coarsen grids/particles, reduce reconstruction/foam, or switch far-water; preserve gates, gameplay-displacement, flooding-state, authoritative-coupling, bounded-mass; never skip random ticks/cells/bodies.

Degradation is reversible: measured down/up thresholds with hysteresis; upshift restores conservative mass/height/velocity/state before authority transfer.

Replicate compact authoritative gates/sources, height/low-dimensional-state or checkpoints/corrections; never all-particle-positions. Missing bandwidth/correction-tolerance blocks network-acceptance.

## Acceptance

First identical-seed/input A/B: A=current cosmetic GPU particles + proposed one-million SPH/eight-iteration/high-viscosity/high-surface-tension/all-particle-sync; B=selected scoped method/hybrid. Bundled evaluation: physics stays 60-Hz; render=30/60/120-FPS; otherwise active-request cadence.

Cover still-water-rest, hydrostatic/buoyancy-body, floating/blocking-box, moving-character, gate-dam-break/flood-fill, inflow/outflow-balance, moving/fast-boundary, explosion-wave/splash, near/far-seam, worst-declared-active-counts/network-faults.

Record mass/volume/source/sink/boundary-flux/drift; density/divergence/pressure-residuals/cap-hits; free-surface/height/wave/gate-timing-error; leakage/penetration/CCD-misses; displaced-volume, impulses, equal/opposite-mismatch; momentum/energy/work; neighbor/cell/particle/active-domain-counts; near/far-transfer-error/pops; replay-first-divergence; correction/bandwidth; GPU/CPU-p50/p95/p99, peak-memory, allocation/transfer-time.

Honor active request CPU/GPU budget; undeclared values block acceptance. Bundled evaluation: accept-only-declared physical/gameplay/visual/replay/network-tolerances, finite-bounded-mass/state, one-time-coupling, GPU-p95<=3-ms, CPU-p95<=1-ms. Ordinary reject nonfatal tolerance/budget/cap-misses. Fatal stop/rollback on nonfinite-state, growing mass/divergence/energy/leakage, boundary/coupling-sign-error, silent-cap-loss, unrecoverable replay/network-divergence, or either-p95-failure.
