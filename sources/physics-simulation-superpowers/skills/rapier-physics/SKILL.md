---
name: rapier-physics
description: "Use when integrating or reviewing Rapier across Rust and JavaScript/WASM, especially binding/version, package flavor, Cargo features, snapshots, determinism, queries, events, or character-controller boundaries."
---

# Rapier Physics

Pin the exact domain before emitting symbols. Read [references/rapier.md](references/rapier.md) for versioned decisions and evidence limits.

## Decision workflow

1. Identify binding, 2D/3D, f32/f64, exact crate or npm artifact, native/WASM runtime, and the claim domain: local repeatability, cross-platform determinism, snapshot continuation, or compatibility.
2. Use Rust rapier2d/rapier3d 0.35.3 at v0.35.3 and commit b82079ac41310a8af438af95b49b8fa551ce650f, or JavaScript 0.20.0 at js-v0.20.0 and commit 3e12c2679cb1940a876bde93af9cec0cf2f57944. Do not pair them as API-identical sources.
3. Select the Rust feature matrix or npm flavor deliberately. Keep packaging, SIMD speed, threading, and determinism as separate axes.
4. Lock package files and artifact hashes. Store a snapshot manifest and reject binding, dimension, precision, version, flavor, feature, artifact, schema, or codec mismatches.
5. Step at fixed tick boundaries. Treat Rapier handles as local generational locators and application IDs as durable identity.
6. Restore JavaScript into a replacement World and rebuild wrappers/controllers/mappings; serialize Rust as a complete owned bundle. Respect current query freshness, immediate event draining, and controller-result lifetimes.
7. Hash snapshot bytes and an application-ID-keyed semantic projection every tick. Compare repeated, uninterrupted, restored, native/WASM, deterministic-JS, parallel, thread-count, and SIMD domains.
8. State each conclusion as official guarantee, adapter policy, inference, or unavailable guarantee.

Unavailable guarantee: pinned public sources do not promise bounded memory across repeated restore cycles. Adapter policy: measure the shipped artifact at the maximum restore cadence and session envelope, record WASM peak/steady memory, and block acceptance when the declared memory budget lacks that soak evidence.

Adapter policy: preserve exact input bits and run a negative cross-platform input-generation control. Rust uses a strict IEEE-754-2008 target and nalgebra ComplexField/RealField instead of native transcendental functions. JavaScript Math.sin and Math.cos are not cross-platform deterministic; avoid them for independently generated deterministic initialization.

## Scope routes

- Cadence and ownership: architecting-real-time-physics.
- Contacts and CCD: rigid-body-collision-contact.
- Joints: constraints-ragdolls-active-physics.
- Movement design: character-controller-movement.
- Authority, replay, and transport: networked-deterministic-physics.
- Reproduction and evidence: debugging-testing-physics.
- Budgets and scaling: profiling-scaling-physics.
