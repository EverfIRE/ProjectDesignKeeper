# Godot/Jolt integration reference

**Snapshot boundary.** Read 2026-08-28: Godot **4.7.2-stable**, using the versioned 4.7 documentation. This is evidence about that release/documentation snapshot, not a statement that any project, export template, extension, platform build, or default is the same. Freeze the editor/full build or commit, export templates, target OS/architecture/renderer/build role, `project.godot`, addons and `.gdextension` state, selected 3D backend, relevant project settings, scene/assets/input/seed, and capture provenance. Verify exact symbols and setting paths in that frozen build.

## Backend and migration boundary

Godot 4.4 introduced Jolt as an alternative built-in **3D** engine. The 4.6 migration material is for migration/breaking-setting context. The official [Godot 4.6 release](https://godotengine.org/releases/4.6/) records experimental removal and says Jolt became the default only for **new 3D projects**; existing projects are unaffected until deliberately migrated. Jolt selection does not convert 2D: `CharacterBody2D`, `RigidBody2D`, and `PhysicsServer2D` remain a different world from `CharacterBody3D`, `RigidBody3D`, and `PhysicsServer3D`.

Before a migration, inventory backend/configuration and old extension state. Do not combine a historical Godot Jolt extension, its old configuration, and built-in settings by name. Make a project-specific compatibility matrix for shapes, joints, margins, ray face index, kinematic contacts, sleeping, CCD, contacts and extension-to-built-in setting moves; A/B those cases under the frozen target build. Native Jolt code, allocators, `JobSystem`, `BodyInterface`, broad/object layers, listeners, serialization, build flags, and upstream determinism claims belong to `native-jolt-physics`. They do not become guarantees of the Godot wrapper.

## Nodes, ownership, and processing

Godot 3 `KinematicBody` advice is migration input, not a current prescription. In Godot 4 use `CharacterBody2D` or `CharacterBody3D`. Script-controlled character collision movement belongs in `_physics_process(delta)`, not `_process(delta)`. `velocity` is a CharacterBody property measured per second and `move_and_slide()` takes no motion argument; do **not** multiply its velocity by `delta` a second time. `move_and_collide(motion)` instead consumes a one-step motion vector, so `velocity * delta` can be appropriate there.

`RigidBody2D`/`RigidBody3D` are simulation-controlled. Give a simulated rigid body one physics-state writer (forces, impulses, intended velocity control, or the documented integration hook as applicable); never continuously write its transform from a render frame. For a script/animation-driven platform, select the body class intentionally. Teleport/reset is a separate version-gated operation: update the supported physical state and then use the documented interpolation reset path instead of competing with the solver.

## Tick, server, and presentation boundary

Physics processing has a fixed cadence distinct from idle/render processing. SceneTree drives the active world at its configured tick. `PhysicsServer2D` and `PhysicsServer3D` are separate low-level RID/object interfaces and world/space boundaries; do not fabricate a second manual server-step loop for a running SceneTree, or double-step it. If an unusual supported controlled stepping surface is needed, establish its exact version, ownership, order, callbacks, synchronization, and test evidence first.

Physics interpolation smooths the presentation between completed physics states. It does not improve collision solving, repair authority/replay, or prove determinism. Apply it only after state-write ownership is corrected. A teleport, respawn, world-origin change, or equivalent discontinuity must use the documented interpolation reset for the frozen version.

## Evidence, authority, and routes

Use the Godot Profiler and the actual `Performance` monitors exposed by the frozen version; Visual Profiler excludes scripting and physics. Capture target release/server builds on target hardware with identical workload/seed, then report p50/p95/p99, physics/frame time, active bodies/contacts or other available monitors, tick backlog, and the cost of one change at a time. Do not invent monitor names or global solver settings; validate a local hypothesis (scale, shapes, mass/inertia, filters, CCD, contact/constraint cost, cadence) before tuning.

Godot documents physics as non-deterministic regardless of backend. Declare server authority, ticked inputs, snapshots/corrections, state/event history, version/platform/configuration/scene/seed identity, and replay/hash acceptance. Interpolation and copying only transforms are display techniques, not collision or replay evidence; do not promise cross-platform bitwise lockstep merely by selecting Jolt.

Routes: `architecting-real-time-physics` (cadence/ownership); `rigid-body-collision-contact` (contacts, queries, CCD); `constraints-ragdolls-active-physics` (joints/ragdolls); `character-controller-movement` (controller design); `networked-deterministic-physics` (authority/prediction/replay); `debugging-testing-physics` (reproducer/regression); `profiling-scaling-physics` (budget/capture); `native-jolt-physics` (native Jolt internals).

## Official anchors

- [Godot 4.7.2 archive](https://godotengine.org/download/archive/4.7.2-stable/) and [release record](https://godotengine.org/article/maintenance-release-godot-4-7-2/).
- [Using Jolt Physics](https://docs.godotengine.org/en/4.7/tutorials/physics/using_jolt_physics.html), [4.6 migration](https://docs.godotengine.org/en/4.7/tutorials/migrating/upgrading_to_godot_4.6.html), [4.6 release](https://godotengine.org/releases/4.6/), and [4.7 release](https://godotengine.org/releases/4.7/).
- [Physics introduction](https://docs.godotengine.org/en/4.7/tutorials/physics/physics_introduction.html), [CharacterBody](https://docs.godotengine.org/en/4.7/tutorials/physics/using_character_body_2d.html), [idle versus physics](https://docs.godotengine.org/en/4.7/tutorials/scripting/idle_and_physics_processing.html), [interpolation introduction](https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/physics_interpolation_introduction.html), and [interpolation usage/reset](https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/using_physics_interpolation.html).
- [`PhysicsServer2D`](https://docs.godotengine.org/en/4.7/classes/class_physicsserver2d.html), [`PhysicsServer3D`](https://docs.godotengine.org/en/4.7/classes/class_physicsserver3d.html), [`Performance`](https://docs.godotengine.org/en/4.7/classes/class_performance.html), [Debugger panel/Profiler](https://docs.godotengine.org/en/4.7/tutorials/scripting/debug/debugger_panel.html), [release policy](https://docs.godotengine.org/en/4.7/about/release_policy.html), [3-to-4 migration](https://docs.godotengine.org/en/4.7/tutorials/migrating/upgrading_to_godot_4.html), and [official Jolt upstream](https://github.com/jrouwe/JoltPhysics).
