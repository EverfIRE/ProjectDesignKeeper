---
name: unity-real-time-physics
description: "Use when integrating, diagnosing, profiling, or version-gating Unity real-time physics across Built-in 3D, 2D, or DOTS Unity Physics."
---

## Unity integration gate

Own only Unity integration, current wrapper/API boundaries, version gating, essential tooling, and routes; do not duplicate general collision, networking, or engine-internal manuals. The Unity 6.3 LTS (6000.3) material in [references/unity-physics.md](references/unity-physics.md) is a 2026-08-28 documentation snapshot, never proof of an unknown project patch.

Every applied answer explicitly distinguishes that dated snapshot from the frozen project manifest/lockfile, names selected routes verbatim, and says exact project surfaces must be inspected or compiled—never guessed. Where this all-backend scenario applies, name `architecting-real-time-physics`, `rigid-body-collision-contact`, `constraints-ragdolls-active-physics`, `character-controller-movement`, `networked-deterministic-physics`, `debugging-testing-physics`, `profiling-scaling-physics`, and `nvidia-physx-sdk`.

Before prescribing symbols, settings, packages, or UI paths, freeze `Application.unityVersion`, `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, `Packages/packages-lock.json`, target/build role, backend, physics/time settings, scene/assets/input/seed, and capture provenance. Inspect or compile the exact project; do not guess.

Choose one backend: Built-in 3D (`Rigidbody`/`Collider`/`Joint`/`PhysicsScene`, Nvidia PhysX), Built-in 2D (`Rigidbody2D`/`Collider2D`/`Joint2D`/`PhysicsScene2D`, Box2D), or ECS `com.unity.physics` (Unity Physics). They are separate worlds. Gate DOTS component, system, and query names on exact Physics and Entities packages. Use one motion-state writer: sample input in `Update`, apply intent on the chosen fixed boundary, and never per-frame write a simulated dynamic `Transform`.

Route cadence, ownership, and manual stepping to `architecting-real-time-physics`; collision, queries, contacts, and CCD to `rigid-body-collision-contact`; joints, constraints, and ragdolls to `constraints-ragdolls-active-physics`; character/controller design to `character-controller-movement`; authority, prediction, replay, and determinism to `networked-deterministic-physics`; evidence and regression to `debugging-testing-physics`; performance and budgets to `profiling-scaling-physics`; only confirmed Built-in 3D engine-internal/native PhysX questions to `nvidia-physx-sdk`, preserving Unity wrapper and version boundaries.

Use the reference for fixed-step catch-up, current-versus-legacy surfaces, presentation, profiling, and acceptance evidence.
