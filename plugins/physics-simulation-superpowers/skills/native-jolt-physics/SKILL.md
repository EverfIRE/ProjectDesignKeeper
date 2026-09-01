---
name: native-jolt-physics
description: "Use when integrating, upgrading, diagnosing, or validating upstream Jolt Physics directly in a custom C++ engine."
---

## Native Jolt gate

Own upstream Jolt build/API, lifecycle, allocation/jobs, layers/filters, listeners, handles, and official tool mapping. Route generic physics design. Read [the pinned integration reference](references/jolt.md) before prescribing Jolt symbols or rollback behavior.

Treat **v5.6.0**, commit **e77f175595e64cb44218cc9d9d56fc365ad0e36a**, read **2026-08-28**, as a source snapshot, not proof of the user's binary. Before symbols, freeze tag/commit, compiler, precision, SIMD/FP policy, defines, platform, build role, job model, modules, and captured provenance. Reject `master`-based assumptions.

The application owns the temporary allocator, `JobSystem`, layer/filter objects, listeners, and callback-thread contract. Initialize allocator before any Jolt call, then diagnostics, `Factory`, `RegisterTypes`, long-lived dependencies, `PhysicsSystem::Init`, listeners, and bodies. Stop updates/callbacks and reverse dependencies at shutdown through `UnregisterTypes` and factory deletion.

Keep `ObjectLayer` pair policy separate from `BroadPhaseLayer` partitioning and object-vs-broad-phase pruning. Make pair policy symmetric and test the matrix. Body lifetime is create -> add -> remove -> destroy. `BodyID` is world-local and reusable; validate locks, use multi-lock helpers, and expose no-lock access only under a proved lock/callback guarantee.

`RemoveBody` retains the Body object and `BodyID`, but active removal deactivates it, zeroes linear/angular velocity, and removes it from broad phase; it does not preserve full state, activation, contacts/cache, or broad-phase membership. Full `PhysicsSystem::SaveState` contains only in-broad-phase bodies and excludes removed bodies. Before `RemoveBody`, use `PhysicsSystem::SaveBodyState` (or equivalent host capture); restore structure/same ID, re-add, then `RestoreBodyState`. Retain ordered remove/add events and host mapping. Only destruction invalidates mapping.

One host fixed-step accumulator owns v5.6 `PhysicsSystem::Update(deltaTime, collisionSteps, tempAllocator, jobSystem)`, backlog, interpolation, and errors. Its only nonzero `EPhysicsUpdateError` bits are `ManifoldCacheFull`, `BodyPairCacheFull`, and `ContactConstraintsFull`; allocator/job faults are separate. `StateRecorder` needs host state/events plus matching IDs/call order.

Cross-platform replay needs the define plus matched source/order/FP and evidence. For `BroadPhaseQuery`, a custom `CollisionCollector::AddHit` must retest the query against `Body::GetWorldSpaceBounds` before stable ordering. Match precise FP, contraction, nearest rounding, DAZ/FTZ; use Jolt trig, `QuickSort`, `BinaryHeapPush`/`BinaryHeapPop`, and `Hash`.

Version-gate module seams. `CharacterVirtual` uses `CharacterContactListener`; ordinary queries and rigid bodies do not automatically see it, so decide whether to add an optional inner body. The host owns the `VehicleConstraint`, chassis, `VehicleCollisionTester`, and listeners. Register it with both `AddConstraint` and `AddStepListener`, then remove both registrations before destruction. `VehicleConstraint` owns and deletes `mController`; `GetController()` is borrowed/non-owning and must not be separately deleted. Soft bodies combine immutable/shared `SoftBodySharedSettings`, `SoftBodyCreationSettings`, `CreateAndAddSoftBody`, type-specific motion/contact APIs, and explicit WIP limits. Do not project ordinary Body/constraint behavior onto them.

Route tick architecture to `architecting-real-time-physics`; contacts to `rigid-body-collision-contact`; joints to `constraints-ragdolls-active-physics`; controllers to `character-controller-movement`; vehicles to `vehicle-physics`; cloth to `cloth-rope-soft-bodies`; authority/replay to `networked-deterministic-physics`; regressions to `debugging-testing-physics`; budgets to `profiling-scaling-physics`.

Validation progresses from pinned HelloWorld to UnitTests, used Samples, determinism/state tests, host rollback/hash/fault tests, then target PerformanceTest/profiler p50/p95/p99 evidence. Do not ship on a smoke test.
