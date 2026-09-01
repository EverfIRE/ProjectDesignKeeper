# NVIDIA PhysX native C++ 5.9 integration reference

## Evidence envelope

Use the official NVIDIA-Omniverse tag `110.1-omni-and-physx-5.9.0`, released 2026-07-14 at commit `517a0073715120e114ee055b63b26c95e00d9039`; `physx/version.txt` is `5.9.0.6d94eeb9`. This source snapshot was read on 2026-08-28. Record the exact checkout, submodules, compiler, CRT/STL, architecture, precision and FP flags, PhysX defines, checked/profile/release role, CUDA toolkit/driver/GPU, enabled modules, patches, and artifact hashes. Do not infer a user's binary from the tag.

The release also labels `ovphysx 0.5.10`. That separate pre-1.0 wrapper is not a stable native C++ 5.10 release; do not mix its version or surface with native PhysX 5.9.

## Process, world, and cooking lifetimes

The host supplies a `PxAllocatorCallback` allocator callback and `PxErrorCallback` error callback; both outlive Foundation. Check every ordinary result: `PxCreateFoundation`, `PxCreatePhysics`, the `PxInitExtensions` bool, `PxSceneDesc::isValid`, and scene/resource factory returns. Track only successfully initialized stages. Create a dispatcher and optional `PxCudaContextManager` before scenes that reference them. Physics and resources outlive consumers; dispatcher and CUDA context manager outlive each scene. The application owns captured state and callback queues. Add failure-injection tests at every creation boundary.

Shutdown stops submissions, pairs/drains the final fetch, detaches listeners, drains host callback work, and releases actors/resources/scenes. Reverse-unwind only successfully initialized stages in reverse order. Release scenes before dispatcher and CUDA manager. Call `PxCloseExtensions` only if init succeeded, before Physics teardown; then release Physics, diagnostics/transport, and Foundation. Do not double-release borrowed pointers.

There is no long-lived PxCooking object or singleton in the current API. Retain `PxCookingParams`; use `PxCook*` functions to write cooked data or `PxCreate*` immediate-cooking functions with the required insertion callback. Cache cooked assets by full cooking parameters, source geometry, SDK snapshot, platform, and build policy—not only by mesh name.

## Scene defaults and migration

For the pinned 5.9 header, `PxSceneDesc` initializes solver type to PGS, broadphase to ePABP, and includes eENABLE_PCM. A historical manual sentence describing TGS as default loses to the pinned 5.9 header; record that conflict rather than silently copying old prose.

Since 5.7, vehicle headers live under `include/vehicle`, the library is `PhysXVehicle`, and the vehicle2 namespace has been removed. The old deprecated Vehicles API, including `PxVehicleDrive4W`, was removed. Port to the current component API, or isolate the PhysX 4.1 SDK behind a separate reference process and binary boundary; never carry `PxVehicleDrive4W` into native 5.9. PhysX 5.9 removes particle cloth, particle rigids, `PxSoftBody`, `PxFEMSoftBody`, and deprecated FEM aliases. No standalone `MigrationTo59` guide is present; the pinned changelog plus headers/source are authoritative.

## Fixed step, threading, callbacks, filtering, and queries

One host accumulator owns the fixed step, backlog policy, interpolation, and replay ordering. Each successful `simulate(dt > 0)` starts work and requires exactly one paired `fetchResults` before another simulate. Do not write the scene while work is outstanding. Respect one-writer/multiple-readers locking; a read lock cannot upgrade to a write lock. Lock calls do not make object lifetime or application containers safe.

Callbacks may arrive on simulation/fetch worker contexts. Keep them bounded, do not mutate the scene in `onAdvance`, copy stable IDs/data into a thread-safe callback queue, and consume after the fetch boundary. `onAdvance` overlaps simulation. `getActiveActors()` may include actors released after the preceding `fetchResults`. Never dereference an entry, including `userData`, unless consuming immediately after `fetchResults` and before any releases; otherwise use host validity/tombstone checks to skip released entries without dereference.

Filtering decides which pairs exist and which notifications are requested. Contact points require pair flags including `eNOTIFY_CONTACT_POINTS`; touch found/persist/lost flags are separate. Trigger persists notifications are unsupported. Removed actor and removed shape flags warn that reported pointers can be invalid; do not dereference them.

A `PxQueryCache` can test its cached shape first and bypass prefilter/postfilter for that shape. Treat cache entries as short-lived acceleration hints, invalidate them on removal/reuse, validate returned application identity, and never use them as authority or permission.

## CPU, GPU, and Direct GPU decision table

| Mode | Contract | Failure boundary |
| --- | --- | --- |
| Standard CPU | CPU rigid dynamics, CPU broadphase/query access, documented host getters/setters | Establish the correctness oracle and capacity budgets. |
| Standard GPU dynamics | `eENABLE_GPU_DYNAMICS` accelerates supported rigid-body stages | Requires a valid CUDA manager; unsupported features may remain CPU-side, but measure transfers and feature limits. |
| GPU broadphase | `PxBroadPhaseType::eGPU` is independent of standard GPU dynamics | Budget GPU pair/aggregate capacities; overflow is an explicit error, not success. |
| Direct GPU | Separate device-buffer access contract; requires GPU dynamics, GPU broadphase, and sleeping disabled | CCTs, vehicles, CPU scene queries, CCD, triggers, contact modification, and `shiftOrigin` are incompatible. CPU getters can be stale and setters forbidden after initialization. |
| GPU-only simulation | FEM/deformable bodies, PBD particles, and SDF collision use feature-specific GPU APIs | Do not project standard rigid-body CPU fallback, query, event, or serialization behavior onto them. |

`eENABLE_ENHANCED_DETERMINISM` is not currently supported on GPU. Even on CPU it does not guarantee cross-platform, compiler, build, SIMD/FP, thread-schedule, or source-version bit identity. For authority/rollback, store host state and ordered commands/events, rebuild the same structure, and verify hashes under a frozen build. Never serialize raw pointers or promise same-seed determinism.

Classify invalid CUDA context/driver, out-of-memory (OOM), configured capacity overflow, lost device/device loss, and unsupported combinations before mutation. Fail the requested mode or rebuild from authoritative application state. Standard CPU is a deliberate separately validated mode, not an automatic feature-equivalent fallback for Direct GPU or GPU-only features.

## Serialization and observability

PhysX 5.6 removed binary data conversion/platform conversion, `PxSerialization::serializeCollectionToBinaryDeterministic`, and `PxBinaryConverter`. Therefore binary collections are build/platform contracts, not durable cross-version saves or network snapshots. `PxCollection` is a non-owning container; releasing the collection does not delete contained objects.

In-place binary deserialization needs 128-byte-aligned backing memory. Keep that memory block alive and unmoved for the entire lifetime of every deserialized object, including objects added through collections; release objects before freeing it. Keep external references, insertion callback, collection object, contained objects, and backing memory ownership distinct.

PVD uses a live transport to the PhysX Visual Debugger. OmniPVD records an OVD file/stream for later inspection. Enable the required scene flags/channels and preserve build/step metadata. Both are diagnostic observability—not persistence, a save format, authoritative rollback state, or proof of performance.

## Public validation boundary

The public 5.9 tree exposes snippets as smoke/reference seeds. Inspection found no auditable public SDK unit-test or benchmark target; do not invent one from internal changelog names. Build and run the exact selected snippets and checked configuration, then add host-owned lifecycle, filter-matrix, callback/removal, query-cache invalidation, fixed-step/replay/hash, serialization ownership, capacity/OOM/device-loss, and Direct GPU denial tests.

Cover Windows 10+ and Linux Ubuntu 22.04/24.04 CPU configurations actually shipped. For GPU, pin the release baseline (CUDA 12.8, Volta or newer) and the deployed driver/GPU, then run checked diagnostics, ASan/UBSan where applicable, Nsight and Compute Sanitizer, PVD/OmniPVD captures, long soak, and target-scene p50/p95/p99 performance/capacity evidence. A snippet passing is not conformance or a release gate.

## Final-answer completeness pass

Source snapshot block: pin native C++ tag 110.1-omni-and-physx-5.9.0, commit 517a0073715120e114ee055b63b26c95e00d9039, released 2026-07-14; state that version.txt is 5.9.0.6d94eeb9. The separate ovphysx 0.5.10 artifact is a pre-1.0 wrapper and not a stable native C++ 5.10 release.

Current vehicle/cooking block: since 5.7, headers live under include/vehicle, the library is PhysXVehicle, and the vehicle2 namespace has been removed. Retain PxCookingParams; use PxCook* and PxCreate* free and immediate cooking functions. Do not retain a PxCooking singleton. The removed old API includes PxVehicleDrive4W: port to the current component API, or isolate 4.1 in a separate reference process and binary boundary; never carry PxVehicleDrive4W into native 5.9.

Defaults/removals block: the pinned 5.9 header sets PxSceneDesc defaults to PGS, ePABP, and eENABLE_PCM. PhysX 5.9 removed particle cloth, particle rigids, PxSoftBody, PxFEMSoftBody, and deprecated aliases. There is no standalone MigrationTo59; the pinned changelog plus headers/source are the migration authority.

Direct GPU product/safety block: distinguish standard CPU, standard GPU dynamics, GPU broadphase, Direct GPU, and GPU-only FEM, PBD, and SDF products. Direct GPU requires GPU dynamics, GPU broadphase, and sleeping disabled; it excludes CCTs, vehicles, CPU scene queries, CCD, triggers, contact modification, and shiftOrigin/origin shift. CPU getters can be stale and setter calls are forbidden. Enhanced determinism has no GPU support and does not guarantee cross-platform, compiler, or build identity. Invalid CUDA, OOM, capacity overflow, or device loss must fail or rebuild from application state; there is no feature-equivalent fallback.

Step/thread/callback block: every simulate(dt > 0) has exactly one fetchResults before another simulate; do not write while work is outstanding or in-flight. Use one writer/multiple readers; a read lock cannot upgrade. Copy callbacks into a thread-safe callback queue for host processing.

Event/query block: pair flags request reports and contact points require eNOTIFY_CONTACT_POINTS; trigger persists is unsupported. Removed actor or removed shape pointers can be invalid, so do not dereference them. onAdvance overlaps simulation while simulation is running. The active actor list is fetch-boundary data; getActiveActors may include actors released after the preceding fetchResults. Never dereference, including userData: consume immediately after fetchResults and before any releases, or use host validity/tombstone checks to skip released entries without dereference. A PxQueryCache/query cache can bypass filtering.

Lifetime block: allocator/error callback owners outlive Foundation; dispatcher and CUDA manager outlive scenes. Check PxCreateFoundation, PxCreatePhysics, the PxInitExtensions bool, PxSceneDesc::isValid, and every scene/resource factory result. Track only successfully initialized stages and reverse-unwind them. Call PxCloseExtensions only when init succeeded. Add failure-injection tests for every boundary.

Serialization/observability blocks: PhysX 5.6 removed binary data conversion/platform conversion, PxSerialization::serializeCollectionToBinaryDeterministic, and PxBinaryConverter. PxCollection is non-owning; releasing it does not delete contained objects. Keep 128-byte-aligned backing memory alive and unmoved for the entire lifetime of all in-place objects. PVD is live transport; OmniPVD records an OVD stream/file. Both are diagnostic, not persistence or rollback state.

Public-validation block: the public 5.9 tree offers snippets as smoke/reference seeds, not conformance, and has no auditable public SDK unit-test or benchmark target. The validation ladder is exact snippets, checked builds, host lifecycle/filter/event/replay tests, Windows/Linux CPU and supported CUDA, sanitizers, Nsight and Compute Sanitizer, PVD/OmniPVD captures, capacity/error/device-loss tests, soak, and target performance evidence.
