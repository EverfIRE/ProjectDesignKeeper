# Unity real-time physics integration map

This is a concise map, not an engine manual. Sources were read on **2026-08-28** with visible **Unity 6.3 LTS (6000.3)** labels. That snapshot is not evidence for an unknown project patch. First record `Application.unityVersion`, `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, `Packages/packages-lock.json`, build/target role, backend, Physics and Time settings, scene/assets/input/seed, and capture provenance. Exact symbols, package versions, settings, and UI paths require inspection or compilation in that frozen project.

## Backend and world boundary

| Backend | Unity boundary | Rule |
| --- | --- | --- |
| Built-in 3D | Object-oriented Nvidia PhysX: `Rigidbody`, `Collider`, `Joint`, `PhysicsScene` | Keep simulation, contacts, and queries in its 3D world. |
| Built-in 2D | Separate Box2D: `Rigidbody2D`, `Collider2D`, `Joint2D`, `PhysicsScene2D` | Never substitute 3D types or settings. |
| Unity Physics | DOTS/ECS `com.unity.physics` | Gate every component, system, and query surface on exact Unity Physics and Entities versions; do not mechanically translate MonoBehaviour code. `CollisionWorld` queries see the broadphase built for a particular tick/state. |

## API and ownership gate

The 6.3 snapshot exposes `Rigidbody.linearVelocity`, `Rigidbody.linearDamping`, `Rigidbody.angularDamping`, and `Physics.simulationMode`. Treat `Rigidbody.velocity`, `drag`, `angularDrag`, and `Physics.autoSimulation` as legacy migration inputs, not replacements to search-and-replace; compile the target project first.

Give each body one motion-state writer. `Update` samples input; the declared fixed simulation boundary applies intent. A simulated dynamic body uses forces/impulses or an explicitly owned velocity controller. `MovePosition`/`MoveRotation` are kinematic motion surfaces; teleport/reset is isolated. Never use direct per-frame `Transform` writes for a simulated dynamic body.

## Cadence, presentation, and queries

`FixedUpdate` is not wall-clock-exact 60 Hz: a rendered frame may observe zero or multiple fixed steps. Record accumulator, catch-up, capped/lost simulation time, and the owner of any manual simulation; manual stepping is deliberate ownership, not a default fix. Interpolation is presentation latency/smoothing, not collision or network correctness. Apply CCD only after step-relative motion evidence; do not blanket `ContinuousDynamic` or invent iterations. Keep joints and queries backend/world/tick-specific. For DOTS, broadphase timing determines `CollisionWorld` observations.

## Evidence and network contract

Use the active request's declared cadence and total budget unchanged; if undeclared, block acceptance. Use target-player `Profiler` evidence, not Editor FPS alone. Run matched baseline/A-B captures with one change, reporting simulation plus script/query/sync cost; active bodies, contacts, constraints, and query counts; fixed-step/catch-up counts; p50/p95/p99. Bundled evaluation only: physics CPU p95 `<= 2 ms`.

Declare server authority; predicted, interpolated, and cosmetic roles; input/state history; correction and replay semantics; and state/hash comparison. Transform-only replication and cross-backend/version/platform bitwise determinism are not proof. Stop on non-finite state, unknown/unsupported surface, authority/history corruption, missing provenance, or an unmet safety/performance budget.

## Route map

Use `architecting-real-time-physics` for cadence/ownership/manual stepping; `rigid-body-collision-contact` for collision/query/contact/CCD; `constraints-ragdolls-active-physics` for joints/constraints/ragdolls; `character-controller-movement` for characters; `networked-deterministic-physics` for authority/prediction/replay/determinism; `debugging-testing-physics` for evidence/regression; and `profiling-scaling-physics` for performance. Route only confirmed Built-in 3D native PhysX internals to `nvidia-physx-sdk`, retaining Unity wrapper/version gates. A future `box2d-physics` adapter can own 2D engine internals.
