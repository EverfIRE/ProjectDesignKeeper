---
name: godot-jolt-physics
description: "Use when integrating, migrating, diagnosing, profiling, or version-gating Godot 4 2D/3D physics or built-in Jolt."
---

## Godot integration gate

Own Godot lifecycle, wrapper/API, project-version, 2D/3D, profiling, and routing boundaries only - not a native Jolt or generic physics manual. [This reference](references/godot-jolt.md) is a **2026-08-28** snapshot of **Godot 4.7.2-stable** and versioned 4.7 docs; it never proves an unknown project or export template.

Before naming an exact symbol, setting, default, or migration, freeze editor version/build/commit, export templates, platform/renderer/build role, `project.godot`, addons/extension state, selected 3D backend, physics/common settings, scene/assets/input/seed, and capture provenance. Inspect the frozen project: snapshot facts are not project facts.

Separate worlds: Godot 2D (`CharacterBody2D`, `RigidBody2D`, `PhysicsServer2D`) stays 2D. Built-in Jolt is a 3D backend (`CharacterBody3D`, `RigidBody3D`, `PhysicsServer3D`); 4.6 made it the default only for newly created 3D projects, so existing projects do not switch automatically. Never mix legacy extension assumptions with built-in settings.

For Godot 4, move script-controlled CharacterBody state in `_physics_process()`. `velocity` is per-second state and `move_and_slide()` is parameterless; use `velocity * delta` only as the motion vector for `move_and_collide()`. A simulated RigidBody owns its transform - do not write it each render frame. SceneTree owns ticks; do not invent a second `PhysicsServer` manual step. Interpolation is presentation, not collision, authority, or replay correctness.

Route architecture/ticks to `architecting-real-time-physics`; contacts/CCD to `rigid-body-collision-contact`; joints/ragdolls to `constraints-ragdolls-active-physics`; controllers to `character-controller-movement`; authority/replay to `networked-deterministic-physics`; repro/regression to `debugging-testing-physics`; budgets to `profiling-scaling-physics`; Jolt native API, jobs, layers, listeners, or internals to `native-jolt-physics` without projecting upstream guarantees onto Godot.

Profile matched target-build captures with Profiler and `Performance`; report p50/p95/p99 and declared budget. Godot documents physics as non-deterministic: choose authority and evidence, not cross-platform bitwise-lockstep promises.
