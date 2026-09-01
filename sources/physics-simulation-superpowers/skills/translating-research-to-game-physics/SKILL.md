---
name: translating-research-to-game-physics
description: "Use when a simulation paper, differentiable method, learned model, or research artifact is being considered for real-time game physics or Unreal Engine production."
---

# Translating Research to Game Physics

Turn a research result into a bounded transfer decision, not a demo-driven promise. Read [the transfer brief protocol](references/transfer-brief.md) before proposing a prototype or production path.

## Contract

1. Freeze the retained claim: source anchor, workload, metric, baseline, reported result, reproduction result and uncertainty, hardware, cost, and deviations. Never widen a paper claim to interactive, collision-rich, networked, or player-value claims without evidence.
2. Issue three independent verdicts: `scientific validity`, `implementation feasibility`, and `product value`. A favorable verdict in one lane cannot satisfy another.
3. Treat differentiable simulation or expensive optimization as an `offline teacher` unless runtime fitness is measured. Prefer the smallest independently validated runtime artifact: fitted parameters or lookup table, then reduced-order model, then bounded surrogate. Shipping runtime must not run reverse-mode optimization by default.
4. Define one minimal implementation slice with explicit input, output, state, OOD detector, clamping, baseline/control, treatment, scene, seed, and metric. Record data and asset source, license, hash, split, preprocessing, and leakage checks.
5. Pin the exact Unreal Engine and Chaos version before naming APIs. Until then, describe only concepts and verification probes. Keep render FPS separate from physics tick.
6. Preserve server authority. Clients send input intent; cosmetic prediction is reconciled and never becomes authoritative state. State fixed-step policy, determinism scope, correction metric, and replication evidence.
7. Keep supplied CPU, GPU, memory, and bandwidth caps as total incremental caps. Report p50/p95/p99 and worst case; do not invent sub-budgets. Any derived allocation is a hypothesis requiring an owner and measurement.
8. Specify LOD with enter/exit thresholds, hysteresis, minimum dwell, state handoff, and anti-thrashing telemetry. Every candidate needs a tested, reversible fallback and stop rule.

## Required output

Return exactly these H2 sections:

1. `Transfer decision`
2. `Approximation and implementation slice`
3. `Runtime production contract`
4. `Gates and acceptance`

Inside the last section use `### Gate 1`, `### Gate 2`, `### Gate 3`, and `### Gate 4`. Gate 1 is a one-object feasibility prototype; passing it authorizes Gate 2 only, not production. Gate 2 covers scale, networking, and budgets. Gate 3 tests player value with a preregistered experiment and guardrails. Gate 4 is staged rollout behind a feature flag with fallback and stop criteria.

Mark facts, assumptions, unknowns, and derived hypotheses. End each gate with owner, evidence artifact, entry condition, pass/fail threshold, and the next decision it authorizes. Include regression checks for CPU, GPU, memory, bandwidth, NaN/Inf, penetration, correction, OOD, fixed-seed repeatability, and telemetry.
