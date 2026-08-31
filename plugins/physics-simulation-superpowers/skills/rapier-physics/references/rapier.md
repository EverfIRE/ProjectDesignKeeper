# Rapier adapter reference

## Claim labels

- Official guarantee: a statement made by the pinned package, API, or source.
- Adapter policy: a conservative rule this integration enforces.
- Inference: a conclusion from source plus a measured project result; record both.
- Unavailable guarantee: do not promote a test, nearby version, or documentation drift into compatibility.

## Freeze the domain

Rust pins rapier2d and rapier3d 0.35.3, tag v0.35.3, commit b82079ac41310a8af438af95b49b8fa551ce650f, released 2026-08-28. Record dimension, f32/f64 precision, target, Cargo.lock, enabled features, and artifact hash.

JavaScript pins @dimforge/rapier2d and @dimforge/rapier3d 0.20.0, tag js-v0.20.0, commit 3e12c2679cb1940a876bde93af9cec0cf2f57944. This is the 0.35.0/0.35.1 source era, not current Rust 0.35.3; there is no API parity. Record package-lock, exact package tarball/WASM hash, browser/runtime, and initialization path.

Choose symbols from the selected artifact, not from nearby current documentation. No official source promises current Rust/JS parity.

## Choose JavaScript flavor

For the official cross-platform deterministic JavaScript flavor, pin @dimforge/rapier2d-deterministic@0.20.0 or @dimforge/rapier3d-deterministic@0.20.0. Its guarantee still assumes the same package, state, ordered inputs, and supported execution.

Ordinary packages are locally deterministic but have no cross-platform guarantee. A -simd package selects speed/performance and requires WASM SIMD support. A -compat package changes WASM packaging only, not determinism; deterministic-compat combines the deterministic flavor with that packaging. Never infer a determinism claim from compat or SIMD.

## Choose Rust features

For Rust 0.35.3, default four-lane SIMD has a scalar fallback. There is no simd-stable feature. simd8 plus enhanced-determinism is compile-time forbidden and produces a compile error; treat simd8 as a separate build/evidence domain.

parallel is compatible with enhanced-determinism. Upstream CI includes thread-count tests and parallel off/on parity, but parallel remains a measured deployment choice: measure before deployment on the exact artifact, target, worker counts, callbacks, and content. Pin every enabled feature instead of relying on defaults.

## Snapshot, restore, and identity

On Rust, enable serde-serialize and serialize a complete owned state bundle with a versioned codec and wrapper. Include integration parameters and all stateful body, collider, joint, island, broad-phase, narrow-phase, and CCD data used by the application. Stateless pipelines such as PhysicsPipeline and QueryPipeline are excluded and not serialized; reconstruct them. The application chooses and locks the codec, envelope schema, and recovery policy.

On JavaScript, call takeSnapshot(), then static World.restoreSnapshot(bytes) to obtain a new World. At a tick boundary, stop use of the old owner, drain EventQueue, invalidate old wrappers, controllers, and mappings, install the replacement world, and rebuild them. Call World.free() on the old World only after no old view is reachable; call free() on the manually owned EventQueue too. Do not restore in place or keep wrappers from the discarded world.

Unavailable guarantee: the pinned public package, API, and source do not promise a bounded memory profile for repeated restore cycles. Adapter policy: exercise the exact shipped artifact at and beyond the maximum restore cadence and session envelope. Record artifact identity, restore cadence, soak duration, WASM peak/steady memory, declared memory budget, and the acceptance decision; absent evidence blocks frequent-restore acceptance.

Store a snapshot manifest with binding, dimension, precision, exact version, package flavor, artifact hash, features, schema, and codec; reject every mismatch before decoding. There is no cross-version or Rust/JS snapshot guarantee. There is also no guaranteed Rust-to-JavaScript snapshot compatibility. Rapier handles are local generational locators; application IDs are durable, and mappings are checkpointed application state.

Fixed ticks, ordered lifecycle commands, owned gameplay state, and side-effect suppression are adapter inputs. Use architecting-real-time-physics and networked-deterministic-physics for the generic rollback design.

## Query, event, and controller lifetimes

Rust QueryPipeline is temporary: it borrows the broad phase and object sets, reuses the BVH updated by stepping, and observes end-of-last-step positions. JS queries are World methods over the world's current query structures. Use no manual update; manually updating a persistent QueryPipeline is the pre-0.27 model. If host code changes poses outside a step, use only the selected binding's documented propagation operation and test the resulting observation point.

Enable collider ActiveEvents deliberately. Collision/contact-force callbacks and contact details may be transient and substep-specific. Drain EventQueue immediately after the declared step, map local handles to application IDs while valid, copy required fields, normalize pair order, canonicalize, consume, and call free() at teardown. A later query of the narrow phase is not a reconstruction of every transient callback.

KinematicCharacterController is a reusable, translation-only query controller. After computeColliderMovement, read computedMovement, grounded state, numComputedCollisions, and each computedCollision from that last call; consume immediately before the next computation. Copy any gameplay-relevant result into application state. Keep configuration and tick phase fixed; route movement policy to character-controller-movement.

## Evidence matrix

Adapter policy: preserve exact input bits at every simulation boundary and add a negative cross-platform input-generation control that intentionally exercises divergent generators. Rust requires a strict IEEE-754-2008 target and nalgebra ComplexField/RealField instead of native transcendental functions. JavaScript Math.sin and Math.cos are not cross-platform deterministic; avoid them for independently generated deterministic initialization. Prefer serialized or bit-locked inputs shared by every peer, then verify the exact bits before stepping.

At every fixed tick, hash local snapshot bytes and a separate application-ID-keyed semantic projection. The semantic hash includes durable IDs, lifecycle, poses, velocities, sleep/enabled/CCD state, collider/joint state, controller/application state, canonical events and gameplay-affecting query results, tick, and configuration hash. Compare multiple runs plus uninterrupted versus restore-and-continue execution at every tick; report the first divergent field.

The project matrix covers native and WASM, the deterministic JS artifact, parallel off/on, multiple thread counts, and simd8 as a separate domain. Add every supported OS, architecture, compiler, browser, worker configuration, and build role. Reject manifest mismatch and verify that an intentional input-bit mutation is detected.

Pinned upstream snapshot portability, roundtrip, parallel parity, and thread-count tests are useful seeds, not proof of this application. Re-run applicable upstream tests, then add application roundtrips, native/WASM comparisons, repeated restore, add/remove handle reuse, callbacks, queries, controller cases, and shutdown ownership. Mark native/WASM snapshot portability as upstream evidence only; it is not a Rust/JS or cross-version promise.

Route contact/CCD details to rigid-body-collision-contact, joints to constraints-ragdolls-active-physics, reproduction to debugging-testing-physics, and budgets to profiling-scaling-physics.
