# Box2D v3.1.1 adapter reference

## Claim labels

Use four labels: official guarantee, adapter policy, inference, and unavailable guarantee.

## Freeze source and symbols

Box2D v3.1.1 was released on 2025-06-04 at commit 8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3. The release says there was no documentation update: website Doxygen 3.1.0 remains stale, so the v3.1.1 tagged public headers are the final API authority. Record source tree, public-header and library hashes, CMake options, compiler, precise floating-point flags, architecture, and adapter version.

Current `main` commit 617d32ab02570930625bbcb8479f54be9bf8d045 labels 3.2.0 and contains experimental snapshot, recording, state-hash, runtime-worker, and additional CCD APIs. They are outside stable 3.1.1 and must not leak into 3.1.1 code. Compile an adapter probe only against the pin. The 2.4 C++ object graph, pointers, fixtures, listeners, and iteration-pair `Step` overload are unavailable in this domain.

## IDs, ownership, and mutation

Initialize every definition with `b2DefaultWorldDef`, `b2DefaultBodyDef`, `b2DefaultShapeDef`, or `b2DefaultChainDef`. Opaque C IDs are generational; `IsValid` checks provide validation for up to 64K allocations, not durable identity. Store stable application IDs and adapter-owned mappings.

Destroying a world destroys all bodies, shapes, and joints. Destroying a body destroys attached shapes and joints. A chain is a body-owned aggregate with segment shape IDs; destroying the chain or body invalidates those segments. Normalize destruction at a tick boundary, invalidate mappings for every cascade, and never queue a Box2D ID as gameplay state.

`b2DestroyShape(shapeId, updateBodyMass)` and density changes make mass recomputation explicit. If deferred, call `b2Body_ApplyMassFromShapes`; sensor shapes may have mass. A shape cannot start or stop being a sensor after creation. These are C 3.1.1 rules: use no 2.4 fixtures, pointers, or contact listeners.

## Fixed step and task phase

Use fixed dt. Select substeps from a measured correctness/cost matrix, then freeze the substep count; do not react to render time. Consume events after each main step, not per internal substep.

`workerCount` above the serial default requires `enqueueTask` and `finishTask`; the application supplies the threads and correct worker indices. `b2World_Step` locks the world. Worker and collision callbacks must be thread-safe and perform no world mutation. Adapter policy also permits no world reads during the step: precompute immutable callback context, publish callback outputs to bounded thread-local or indexed storage, join tasks, then perform read-only queries in an outside-step phase.

## Events and sensors

`b2World_GetBodyEvents` has no opt-in flag. Sensor, contact, hit, and PreSolve shape flags default false. Event arrays are transient. Destruction-generated end-touch IDs may be invalid, so guard API dereference with `b2Shape_IsValid`, but decide identity from copied application IDs and tombstones. Sensors can detect sensors, and gameplay must canonicalize its persistent overlap set.

## Query and tree semantics

`b2World_OverlapAABB` returns approximate broadphase candidates, while `b2World_OverlapShape` supplies narrow-phase geometry. Multi-hit callbacks are unordered, so copy and sort by fraction plus durable identity. In v3.1.1 `b2World_CastShape` reports initial overlap as fraction zero, normal zero, and an arbitrary point. `b2World_CastRayClosest`, low-level rays starting inside, and `b2World_CastMover` ignore initial overlap. Use `b2World_CollideMover` for depenetration planes and never persist callback storage.

## One-way PreSolve boundary

Set `enablePreSolveEvents` only on required dynamic shapes, register `b2PreSolveFcn`, and decide before collision resolution. Contacts re-enable during collision processing, so re-disable every step. The callback runs in a parallel-for on worker threads: it must be thread-safe and must not read or write the world. Disabling after the step (`b2World_Step`) is too late because impulses were solved.

Official stable v3.1.1 documentation warns that this PreSolve technique does not work with high-speed collisions and may pause. Use the Platformer sample as a test seed, not proof. Gate one-way behavior with approach side, previous foot state, relative velocity, drop-through, moving/rotating platforms, spawn overlap, and fast crossings.

## Experimental geometric character mover

The stable 3.1.1 mover is experimental capsule geometry outside world ownership, not a dynamic body. Use `b2World_CollideMover` to gather collision planes and `b2World_CastMover` to bound motion; assemble planes, call `b2SolvePlanes` for translation, then `b2ClipVector` for velocity.

This is not a complete controller. The application owns steps and slopes, support/platform motion, persistent state, pushing, rotation, dynamic-body interaction, events, and replication. Compare this pipeline against a physical capsule as separate movement contracts; never combine body teleports with solver contacts.

## CCD boundary

Default CCD covers dynamic bodies versus static bodies. Bullet mode extends a sparse, measured body to static, kinematic, and dynamic targets, but not other bullets. Use bullets sparingly: the tagged header warns they are not general dynamic-versus-dynamic CCD and may interfere with joints.

Sensors have no CCD; use ray or shape casts for fast sensor crossings. Continuous-collision contacts do not generate ordinary events immediately, so events can appear on the next step. Declare required collision pairs, speed/radius/thickness envelope, impact angles, target motion, substeps, and event latency; compare bullet, ray, and shape-cast policies.

## Determinism is not rollback

Official Box2D cross-platform determinism targets 64-bit platforms. Multithreaded order derives from creation order and includes reported events. Precise math is used on MSVC; floating-point contraction is disabled on Clang and GCC; official evidence covers x64 and ARM and custom trig functions. Preserve exact build flags and deterministic application creation, command, input, callback, and event ordering.

The pinned determinism test uses `1.0f / 60.0f`, 4 substeps, worker counts 1-5, expected sleep step 288, and expected hash `0x35467e1e`. Re-run it on the exact artifact. It is not proof that the application is deterministic.

Stable v3.1.1 provides no public snapshot and no rollback support. Transforms are insufficient to restore hidden contact, solver, sleep, joint, and application state. There is no cross-version or arbitrary-build guarantee. Qualify only the pinned exact build by reconstructing the same initial world and replaying the complete ordered history. Hash a durable-ID-keyed semantic projection every tick, compare worker/build/platform lanes, and retain the first divergent tick and structured field diff.

## Canonical response seams

## Source snapshot and drift

Box2D v3.1.1 was released on 2025-06-04 at commit 8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3. The release says there was no documentation update: website Doxygen 3.1.0 remains stale, so the v3.1.1 tagged public headers are the final API authority. Current main commit 617d32ab02570930625bbcb8479f54be9bf8d045 labels 3.2.0 and contains experimental snapshot, recording, and state-hash APIs; these are outside stable 3.1.1 and must not leak into 3.1.1 code.

## IDs, ownership, and mutation

Initialize definitions with b2DefaultWorldDef, b2DefaultBodyDef, b2DefaultShapeDef, and b2DefaultChainDef. Opaque C IDs are generational and validity checks cover up to 64K allocations, so durable application IDs own identity. Destroying a world destroys its objects; destroying a body destroys attached shapes and joints; a chain owns segment shape IDs, which are invalidated with the chain. b2DestroyShape's updateBodyMass choice and b2Body_ApplyMassFromShapes define mass recompute; sensor shapes may have mass and a shape cannot start or stop being a sensor. Use no 2.4 fixtures, pointers, or contact listeners.

## Fixed step and task phase

Use fixed dt; select substeps from measured stability and cost, then freeze the substep count, with events consumed after each main step. workerCount requires enqueueTask and finishTask. b2World_Step locks the world; callbacks and worker tasks are thread-safe and perform no world mutation. Adapter policy permits no world reads during the step either, and confines read-only queries to an outside-step phase.

## Events and sensors

Body move events have no opt-in flag and are available after every step, and with sleeping disabled every dynamic and kinematic body produces move events. Sensor, contact, hit, and PreSolve shape flags default false, and drain all borrowed event arrays after every step. End touch events can contain destroyed IDs, so use b2Shape_IsValid as an invalid-access guard before API dereference, never as identity, translate/copy to stable application IDs, tombstone destroyed identities, and never queue raw elements. Sensors can detect other sensors. Engine event order is not gameplay semantic order, so canonicalize a persistent gameplay overlap set.

## Queries and tree semantics

OverlapAABB is an approximate broadphase bounding-box candidate query, and use OverlapShape or another narrow-phase exact test. Ray-cast and shape-cast callbacks arrive in arbitrary order, so collect multiple hits and sort by fraction plus durable identity. In v3.1.1, b2World_CastShape reports an initial overlap with zero fraction, zero normal, and an arbitrary point. b2World_CastRayClosest ignores initial overlap, ray casts starting inside treat the shape as a miss, and b2World_CastMover also ignores initial overlap, so use b2World_CollideMover for depenetration planes. Consume callback results immediately with no persistence.

## One-way PreSolve

Set enablePreSolveEvents and use b2PreSolveFcn before collision resolution. Contacts re-enable, so re-disable every step. The callback runs in a parallel-for/worker thread, must be thread-safe, must not read or write the world, and disabling after the step is too late. Stable v3.1.1 documents a high-speed limitation that may pause; keep the Platformer sample as a test seed and add project cases.

## Experimental character mover

The stable 3.1.1 experimental mover is a geometric capsule outside world ownership, not a body. Call b2World_CollideMover and b2World_CastMover, assemble collision planes, run b2SolvePlanes for translation, then b2ClipVector for velocity. It is not a complete controller: gameplay owns steps, slopes, persistent state, pushing, rotation, support, and replication policy.

## CCD boundary

Default CCD covers dynamic bodies versus static bodies. Bullet mode extends a sparse tested body to static, kinematic, and dynamic targets but not other bullets; use it sparingly because it may interfere with joints. Sensors have no CCD. Continuous-collision contact events can appear on the next step, so gameplay must not require same-step delivery.

## Determinism is not rollback

The official cross-platform claim is for 64-bit targets and creation-order-derived simulation/events: precise FP on MSVC, floating-point contraction disabled on Clang/GCC, tested on x64 and ARM. The pinned determinism test uses 1/60, 4 substeps, worker counts 1-5, expected sleep step 288, and hash 0x35467e1e; application determinism is still required, so this is not proof. Stable v3.1.1 has no public snapshot and no rollback support; transforms are insufficient, there is no cross-version guarantee, and only the pinned exact build plus complete replay can be qualified.
