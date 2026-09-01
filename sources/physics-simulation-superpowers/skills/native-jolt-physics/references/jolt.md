# Jolt v5.6.0 integration map

Source snapshot: upstream tag **v5.6.0**, released 2026-07-11, commit **e77f175595e64cb44218cc9d9d56fc365ad0e36a**, read 2026-08-28. The release is the stable contract; `master` was already ahead. See the repository [source audit](../../../references/native-jolt-physics-source-audit.md) for claim-level authority and limitations.

## Freeze the actual build

Record the exact tag/commit, compiler and standard library, platform/architecture, float or double precision, SIMD/FP policy, Jolt and host defines, debug/profile/release role, allocator and job model, enabled modules, content revision, and capture provenance. Verify all translation units share compatible definitions. The pinned snapshot tells you what v5.6.0 says; it cannot identify an unknown executable.

The v5.6 API-change boundary matters. Friction behavior changed. Earlier integration-substeps guidance and signatures are legacy: the pinned `PhysicsSystem::Update` contract has `collisionSteps`, not an extra integration-substeps prescription. `CharacterVirtual` contact names/payloads changed, and `PhysicsStepListener` uses a context. Binary saved shapes/state are not promised durable across versions. Architecture marks soft bodies WIP; the v5.6 release marks GPU hair WIP.

## Process and world lifetime

Application initialization follows dependency direction:

1. Call `RegisterDefaultAllocator` before any Jolt allocation or API use; install trace and assert hooks appropriate to the host.
2. Create `Factory::sInstance`, then call `RegisterTypes`.
3. Create long-lived temporary allocator, `JobSystem`, broad-phase interface, `ObjectVsBroadPhaseLayerFilter`, `ObjectLayerPairFilter`, and retained listeners.
4. Construct the world, call `PhysicsSystem::Init` with measured capacities and those retained filter objects, then register listeners and create/add bodies or constraints.

The application owns every object in step 3; Jolt does not choose an engine thread budget. Document callback threads, barriers, allocator exhaustion, job failure, and host shutdown. Stop update submission and callbacks, join workers, remove/destroy bodies and constraints, unregister listeners, destroy worlds and retained dependencies, call `UnregisterTypes`, then delete and clear `Factory::sInstance`. Repeated init/world/shutdown tests must expose dangling callbacks and dependency inversions.

## Layers, filters, and queries

`ObjectLayer` expresses gameplay pair policy. `BroadPhaseLayer` partitions broad-phase storage. `ObjectVsBroadPhaseLayerFilter` prunes object-layer queries against those partitions; `ObjectLayerPairFilter` decides object-pair collisions. These are separate decisions. Define a source-backed symmetric object-pair matrix, map object layers deliberately to broad-phase layers, and test both argument orders plus query/sensor masks. One layer with all pairs enabled is neither a correctness specification nor a scalable default.

Broad-phase AABBs can stay widened for several updates, changing hit membership as well as order. For deterministic `BroadPhaseQuery` use a custom `CollisionCollector`: in `AddHit`, repeat the query against the actual bounding box from `Body::GetWorldSpaceBounds`, accept only real overlaps, then order accepted results by stable engine identity. Sorting broad-phase hits alone cannot repair different membership. Narrow-phase collection order, callbacks, and active bodies still require stable normalization.

## Bodies, locks, and retained identity

The ownership sequence is `CreateBody` -> `AddBody` -> `RemoveBody` -> `DestroyBody`. `RemoveBody` retains the Body object and `BodyID` for a later `AddBody`; mark the host mapping removed/inactive but retain the same ID. If the Body is active, removal deactivates it, zeroes linear and angular velocity, then removes it from the broad phase. It does not preserve full state, activation, contacts/cache, or broad-phase membership. Only `DestroyBody` or world teardown invalidates the mapping. A `BodyID` remains world-local, reusable after destruction, and never a durable save/network identity.

`PhysicsSystem::SaveState` saves only in-broad-phase bodies, so it excludes a removed Body. For rollback that needs its pre-removal state, call `PhysicsSystem::SaveBodyState` before `RemoveBody` (or make an equivalent complete host-owned capture). Restore structure and the same ID, re-add the Body, then call `RestoreBodyState`. Retain the host mapping and ordered remove/add events throughout.

A lock can fail when a stale or destroyed ID is presented. Check the lock result before dereferencing. For multiple bodies, use `BodyLockMultiRead` or `BodyLockMultiWrite` so acquisition ordering is controlled. No-lock `BodyInterface` access belongs only inside a documented callback/lock condition that already grants exclusive or safe access; expose that precondition in the engine wrapper.

## Fixed stepping and errors

One host scheduler accumulates real time and consumes a fixed tick. For the 120 Hz case, each simulation tick calls `PhysicsSystem::Update` with fixed `deltaTime = 1 / 120`; measure `collisionSteps` rather than copying a sample. In v5.6 the last parameters are `TempAllocator*` and `JobSystem*`. Pass existing pointer variables directly; pass the object locals used by HelloWorld by address:

```cpp
EPhysicsUpdateError errors = physics_system.Update(
    fixed_delta, collision_steps, &temp_allocator, &job_system);
```

Review snippets from visible declared types and signatures: compatible base/derived raw pointers, parenthesized pointers, and compatible `std::unique_ptr<T>.get()` expressions are valid. Accept a custom derived type only when its visible base declaration proves `TempAllocator` or `JobSystem` compatibility. This bounded check is not full C++ type inference; compile the final call.

Keep presentation interpolation separate. Bound catch-up work and define backlog/overload recovery without stretching the simulation delta.

Besides `None`, v5.6 defines exactly three `EPhysicsUpdateError` bits:

- `ManifoldCacheFull`: total contacts between bodies are too high; some contacts are ignored. Increase `inMaxContactConstraints`.
- `BodyPairCacheFull`: too many bodies contacted; some contacts are ignored. Increase `inMaxBodyPairs`.
- `ContactConstraintsFull`: the contact-constraint buffer is full; some contacts are ignored. Increase `inMaxContactConstraints`.

Inspect all three every tick and declare stop, resize-at-safe-boundary, or resync policy. Temporary allocator exhaustion and job failure are separate fault channels, not returned `EPhysicsUpdateError` flags; test and handle them separately. HelloWorld capacities and its 10 MiB allocator are examples. Measure target high-water marks.

## StateRecorder and rollback boundary

`SaveState`/`RestoreState` through `StateRecorder` cover in-broad-phase Jolt simulation state, not removed bodies, every host configuration, gameplay variable, or structural history. Restore requires compatible settings and matching BodyIDs/call order. Do not assume it recreates bodies that the host added or removed between snapshots or restores removed-body state without the per-body capture above.

A rollback frame therefore retains the full Jolt stream, pre-removal body streams, stable host identity mapping, ordered structural remove/add events, ordered inputs, external character/vehicle/gameplay state, content/config version, and recovery metadata. Restore matching structure and IDs before state. Hash tick boundaries and retain authoritative correction/resync. Binary streams remain pinned-version artifacts, not cross-version storage formats.

## Cross-platform determinism evidence

`JPH_CROSS_PLATFORM_DETERMINISTIC` is a prerequisite, not a guarantee. Compare the same source, defines, precision/SIMD, content, inputs, and call order. Compile host code in precise mode (`-ffp-model=precise` or `/fp:precise`) and disable contraction with `-ffp-contract=off`. Keep nearest rounding and DAZ/FTZ identical on every thread. Use Jolt Sin/Cos instead of standard trig, `QuickSort` instead of `std::sort`, `BinaryHeapPush`/`BinaryHeapPop` instead of standard heaps, and `Hash` instead of `std::hash`.

Run an evidence matrix across each supported Windows/Linux compiler, architecture, and build role. First reproduce with the same binary, then replay identical tick-stamped commands on each target. Record per-tick state hashes and the first divergent tick; preserve inputs, structural events, job configuration, error flags, actual-bounds-filtered query results, normalized callbacks/active-body results, and build state for bisection. Neither the define nor sorting alone proves determinism.

## Module boundaries

- `CharacterVirtual`: it is host-owned and explicitly driven each fixed tick through the v5.6 `Update`/`ExtendedUpdate` path. Install the versioned `CharacterContactListener`; retain its callback payloads, supporting-body state, inputs, and other external controller state. A virtual character is not a rigid body in the world: ordinary queries and rigid bodies do not automatically see it. Choose and document the visibility boundary, including whether the optional inner body is created and which contacts it represents.
- `VehicleConstraint`: the host owns and retains the constraint, chassis, `VehicleCollisionTester`, and listeners. Register the vehicle with both `AddConstraint` and `AddStepListener`; constraint registration alone omits its step-listener update. The constraint constructs and owns `mController`, and its destructor deletes `mController`. `GetController()` returns a borrowed, non-owning pointer; the host must not separately delete it. Apply controller input in the declared fixed-tick order. During teardown call `RemoveStepListener` and `RemoveConstraint` before destruction of the vehicle, tester, listeners, or chassis. Retain external input/state for rollback rather than serializing a raw constraint pointer.
- Soft bodies: treat `SoftBodySharedSettings` as immutable shared data and keep it alive; combine it with per-instance `SoftBodyCreationSettings`, then create through `CreateAndAddSoftBody`. Check `IsSoftBody` before type-specific access and use `SoftBodyMotionProperties`; route contacts through `SoftBodyContactListener`. The v5.6 feature is WIP: there is no simulated soft-soft response and soft bodies do not use ordinary constraints. Relevant regular Body APIs may not apply. Define local-only, authoritative, or replicated scope and prove CPU, memory, collision, and recovery behavior.

Route generic controller, vehicle, cloth, constraint, networking, debugging, and profiling design to their repository skills; this reference owns only the Jolt-specific seams.

## Validation ladder

1. Build and run pinned v5.6.0 HelloWorld as initialization/update/shutdown smoke.
2. Build and run upstream UnitTests for the selected compiler/defines/precision.
3. Run the official Samples that exercise every used API: layers/queries, bodies/constraints, CharacterVirtual, vehicles, and soft bodies as applicable.
4. Run pinned determinism and StateRecorder save/restore validation; inject mismatched structure, stale IDs, and each exact update-error bit. Fault-inject temporary allocator and job-system paths separately.
5. Run host fixed-step, rollback, hash-divergence, spawn/despawn, callback-thread, shutdown, and authority/resync tests under jitter/loss/reordering.
6. Run PerformanceTest plus the host profiler on target builds/content. Report p50/p95/p99 tick time and budgets for capacities, temp memory, jobs, bodies, pairs, constraints, contacts, rollback memory, and bandwidth.

Promotion requires every used module and supported platform/build role to pass its rung. HelloWorld alone is not release evidence.
