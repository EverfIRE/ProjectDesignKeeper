---
name: nvidia-physx-sdk
description: "Use when integrating, upgrading, diagnosing, or validating the upstream NVIDIA PhysX native C++ SDK in a custom engine."
---

## Native PhysX gate

Own only PhysX-specific source, API, lifetime, CPU/GPU, migration, serialization, and observability facts. Route generic physics design. Read [the pinned integration reference](references/physx.md) before prescribing symbols, GPU behavior, or save/rollback behavior.

Treat NVIDIA-Omniverse tag `110.1-omni-and-physx-5.9.0`, released 2026-07-14 at commit `517a0073715120e114ee055b63b26c95e00d9039`, with `version.txt` `5.9.0.6d94eeb9`, read 2026-08-28, as snapshot, not binary proof. `ovphysx 0.5.10` is a separate pre-1.0 wrapper, not a stable native C++ 5.10 release. Freeze source, platform, toolchain, checked/release role, CUDA, GPU architecture, defines, modules, provenance.

The host owns allocator/error callbacks, Foundation, Physics, extensions, dispatcher, CUDA manager, diagnostics, scenes, and state. Track successful init stages. Check `PxCreateFoundation`/`PxCreatePhysics`, the `PxInitExtensions` bool, `PxSceneDesc::isValid`, and every factory result; failure-inject each boundary. Reverse-unwind only successful stages; call `PxCloseExtensions` only when init succeeded. Dependencies outlive consumers.

Current cooking uses `PxCookingParams` and `PxCook*`/`PxCreate*` free functions; keep no `PxCooking` singleton. Since 5.7, vehicles use `include/vehicle`, `PhysXVehicle`, and no `vehicle2` namespace. Removed `PxVehicleDrive4W` must port to the current component API or stay in an isolated 4.1 reference process/binary boundary; never carry it into native 5.9.

Use a fixed cadence. Pair every `simulate(dt > 0)` with one `fetchResults`; allow one writer/multiple readers and no upgrade. Queue callbacks. Request contact points with pair flags and `eNOTIFY_CONTACT_POINTS`; trigger persists is unsupported. Removed actor/shape pointers are invalid; `onAdvance` overlaps simulation; `PxQueryCache` bypasses filtering. `getActiveActors` may include actors released after the preceding fetch: consume immediately before releases, or use host validity/tombstone checks and skip without dereference, including `userData`.

Keep standard CPU, standard GPU dynamics, GPU broadphase, Direct GPU, and GPU-only FEM/PBD/SDF paths distinct. Direct GPU requires GPU dynamics, GPU broadphase, and sleeping disabled; it excludes enhanced determinism, CCTs, vehicles, CPU scene queries, CCD, triggers, contact modification, and origin shift. CPU getters may be stale and setters forbidden. Enhanced determinism has no GPU or cross-platform/build identity guarantee. Invalid CUDA, OOM, capacity overflow, or device loss must fail explicitly or rebuild from application state; never promise feature-equivalent fallback.

The pinned 5.9 `PxSceneDesc` header defaults to PGS, ePABP, and PCM. It overrides historical TGS prose. PhysX 5.9 removes particle cloth/rigids and deprecated soft-body/FEM aliases. PhysX 5.6 removed deterministic binary conversion and `PxBinaryConverter`. `PxCollection` is non-owning; in-place data keeps 128-byte-aligned backing memory alive. PVD is live transport; OmniPVD records OVD diagnostics. Neither is persistence or rollback state.

The public 5.9 tree has snippets, not an auditable SDK unit-test or benchmark target. Treat snippets as smoke seeds; validate checked builds, host contracts, shipped CPU/GPU, diagnostics, failures, soak, and performance.

Before the final answer, perform a final completeness pass. Use [the final-answer completeness pass](references/physx.md#final-answer-completeness-pass): synthesize all ten gates as cohesive local blocks; scattered mentions do not complete a gate.

Route architecture to `architecting-real-time-physics`; contacts and CCD to `rigid-body-collision-contact`; joints to `constraints-ragdolls-active-physics`; controllers to `character-controller-movement`; vehicles to `vehicle-physics`; cloth/soft bodies to `cloth-rope-soft-bodies`; fluids/particles to `real-time-fluids-particles`; authority/replay to `networked-deterministic-physics`; regressions to `debugging-testing-physics`; budgets to `profiling-scaling-physics`.
