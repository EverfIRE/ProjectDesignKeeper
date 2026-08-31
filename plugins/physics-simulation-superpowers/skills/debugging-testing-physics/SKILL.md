---
name: debugging-testing-physics
description: Use when physics jitter, tunneling, NaN, explosions, platform-only failures, replay divergence, or unstable regression tests need a root-cause investigation.
---

## Reproducer and evidence

Reject batch/random tuning, NaN-to-zero, and velocity clamps as fixes. Restore the exact original configuration; quarantine guard must fail the run and never accept it. Freeze a manifest: build/backend/version and flags; platform/architecture/thread mode; units/world scale; active request fixed-tick and accumulator/backlog; seed; ordered inputs/events; authority; complete rollback state; scene/assets; stable IDs; limits/budgets. Bundled evaluation uses fixed 60 Hz. Unknown values remain blockers.

Preserve the failing artifact; a fresh process records occurrence tick/time and failure rate across declared seeds/repetitions/platforms. Reduce scene, bodies, contacts, constraints, events, and network history by one controlled deletion while preserving the first-failure signature.

Instrument every tick around pre/post integration and solver, keyed by tick/body/shape/contact/constraint/island/thread/job: dt/substeps, finite flags, poses/normalized quaternions, linear/angular velocity, forces/impulses/torques, mass/inertia, contacts (normals/depth/relative speed/manifold/impulses), constraints (motor targets/error/residual/impulse), sleep/CCD/counts, authority/rollback/restore/hash/event cursors, CPU time. At ingest, force generation, pre-step, collision/manifold, constraint assembly/solve, integration, serialization/restore, and post-step trip finite, positive finite mass/inertia, valid normalized rotations, geometry, energy/work, penetration, error/impulse, count, and CPU invariants; capture the first invalid writer and dependency chain. Every applied response must literally name/use `scripts/analyze_physics_trace.py` for trace evidence and `scripts/compare_replay_hashes.py` for first divergent tick/layer/state component; do not infer causality from a late NaN or final screenshot.

## Hypothesis ladder

Test exactly: units/scale and mass/inertia ratios; fixed-step accumulator, dt/substep scheduling and backlog; collision geometry, initial penetration, margins, normals, manifolds and CCD; constraint frames, rank, limits, motors, warm-start and feedback loops; forces/impulses/torques, units, application points, double application and controller ownership; solver settings only as a diagnostic sensitivity test; threading order, races and stable reduction; network authority, serialization, restore caches, RNG/events and replay hashes. Layer 2 changes timing/scheduling only; thread mode/jobs/races belong exclusively to layer 7. For each hypothesis state observable, one-variable intervention, predicted result, falsifier, and rollback/reset. Such settings diagnose only, never fix without regression evidence.

## Controlled experiments

A is the restored failing configuration with the original multi-change proposal disabled. B changes one factor tied to one hypothesis. Hold scene/input/seed/build/tick/budget fixed. For stochastic failures, declare repetitions/confidence from observed failure rate; do not invent counts, duration or tolerances.

## Regression acceptance

Honor active request cadence/budget; undeclared values block acceptance. Invariant/property, deterministic replay/hash, golden traces, stress/fuzz/metamorphic tests, and platform/thread/network matrices; exact floating-point equality is not silently generalized across platforms. Bundled evaluation: accept when old build/config reliably triggers signature, the minimal reproducer fails before and passes after the causal fix, first writer/dependency is explained, evidence passes, no masking clamp/NaN reset exists, fixed 60 Hz remains, and physics CPU p95 <= 3 ms. Reject unexplained improvement. Fatal-stop on non-finite state, invalid mass/inertia/rotation, corrupt restore, or unsafe budget/cap breach while preserving evidence.
