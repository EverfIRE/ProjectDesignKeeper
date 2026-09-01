---
name: box2d-physics
description: "Use when integrating, migrating, debugging, or reviewing Box2D 3.x, especially C API drift, IDs and ownership, stepping and tasks, events, queries, one-way contacts, character movers, CCD, determinism, or rollback boundaries."
---

# Box2D Physics

Pin the exact API domain before emitting symbols. Read [references/box2d.md](references/box2d.md) for versioned contracts and evidence limits.

## Decision workflow

1. Identify exact tag, commit, public-header and library hashes, build flags, platform, compiler, task system, and gameplay claim. Stable work uses Box2D v3.1.1 at commit 8c661469c9507d3ad6fbd2fea3f1aa71669c2fe3; do not import experimental 3.2 `main` APIs.
2. Use only the 3.x C interface: default definitions, opaque value IDs, free functions, shapes, and `b2World_Step`. Translate local generational IDs to durable application IDs and model world/body/chain cascades explicitly.
3. Run a fixed tick. Measure and freeze substeps and workers. Treat `b2World_Step` as an exclusive locked phase; task and collision callbacks are thread-safe, bounded, and do not read or mutate the world.
4. Drain body, sensor, and contact event arrays after every main step. Copy fields and application IDs immediately. Treat queries as outside-step observations; canonicalize multi-hit results.
5. Choose one character contract: solver-driven physical body or experimental geometric mover. One-way solids use per-shape PreSolve before resolution, with a precomputed immutable context and a high-speed qualification gate.
6. Keep CCD scoped. Default continuous collision, bullets, sensors, and casts cover different pairs and timing; test the declared projectile envelope.
7. Separate official engine determinism from application replay. Stable v3.1.1 has no public snapshot/rollback API. Qualify exact builds using per-tick semantic hashes and first-divergence diffs.
8. Label conclusions as official guarantee, adapter policy, inference, or unavailable guarantee. Pin upstream tests as seeds, never application proof.

## Output contract

Before optional detail, copy every applicable paragraph from the reference's Canonical response seams block verbatim; do not paraphrase or split it.

For each applicable seam, before optional detail, write exactly one canonical sentence or checklist item as one compact paragraph or one compact checklist item. Keep coupled preconditions, phase/lifetime boundary, limitation, adapter policy, and evidence gate together. Omit inapplicable seams and do not scatter one seam across distant sections, bullets, tables, or a glossary.

Keep at most five sentences or semicolon-separated semantic clauses per seam. Preserve every applicable fact and its exact public symbol, version, and full commit, including negative guarantees and official test and sample seeds from the reference. Do not compress coordinated nouns or negations: give every condition an explicit referent.

In the canonical sentence use commas and parentheses, not semicolons, and avoid the clause splitters but, however, yet, or then. Use the reference seams--source drift, ID ownership, step/tasks, events/sensors, queries, PreSolve, mover, CCD, and determinism/rollback--and when all nine seams apply to a scenario, emit all nine.

## Scope routes

- Cadence, phase, and ownership: architecting-real-time-physics.
- Contacts, queries, one-way behavior, and CCD: rigid-body-collision-contact.
- Joints and lifts: constraints-ragdolls-active-physics.
- Physical versus geometric movement: character-controller-movement.
- Input logs, replay, hashes, compatibility, and rollback windows: networked-deterministic-physics.
- Reproduction and adversarial evidence: debugging-testing-physics.
- Profiles, counters, percentiles, and scaling: profiling-scaling-physics.
