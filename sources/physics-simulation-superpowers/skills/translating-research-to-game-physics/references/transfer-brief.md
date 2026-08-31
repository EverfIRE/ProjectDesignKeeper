# Research-to-Game Physics Transfer Brief Protocol

## Purpose and evidence boundary

A paper result is evidence inside its declared validation domain. Transfer begins by preserving that domain, then testing each added claim. Do not translate "worked offline" into "real time," "one trajectory" into "interactive contacts," "one object" into "many objects," or "lower error" into "players prefer it."

NASA-STD-7009B treats model credibility as dependent on intended use, validation domain, verification, validation, and uncertainty characterization. Use that logic as a boundary for game decisions; this workflow is not a NASA certification. Label each statement as:

- `fact`: source-anchored or measured evidence;
- `assumption`: a declared planning premise;
- `unknown`: information still required;
- `derived hypothesis`: a proposed threshold or design choice that needs an owner and test.

Keep a claim ledger with paper version and anchor, workload, inputs, horizon, timestep, baseline, metric, reported result, reproduction result and uncertainty, hardware/software, cost, and every deviation. A partial reproduction stays partial.

## Three independent decisions

| Lane | Question | Valid evidence | Invalid shortcut |
|---|---|---|---|
| scientific validity | Does the retained claim hold for the tested domain and tolerance? | source audit, reproduction, uncertainty, sensitivity, ablation | a visually convincing demo |
| implementation feasibility | Can a bounded runtime artifact meet target-engine correctness, latency, memory, authority, and scale constraints? | instrumented prototype on target hardware and workload | paper speedup, fewer iterations, average-only timing |
| product value | Does the feature improve a preregistered player outcome without violating guardrails? | powered randomized experiment or an explicitly weaker study | engineering success or stakeholder enthusiasm |

Give each lane its own verdict: `supported`, `partial`, `unsupported`, or `unknown`, plus evidence, missing evidence, and next test. One lane never inherits another lane's verdict.

## Why direct differentiable-runtime adoption is usually a no-go

[DiffTaichi](https://arxiv.org/abs/1910.00935) demonstrates differentiable programming for physical simulation and discusses tape/global-state history, checkpointing, and gradients through collisions. [ChainQueen](https://cdfg.mit.edu/assets/files/chain_queen_0.pdf) reports GPU-accelerated differentiable MPM, while caching simulation states for reverse-mode use. [DiffPD](https://arxiv.org/abs/2101.05917) accelerates differentiable projective dynamics under its tested formulation and contact assumptions. These are important research results, not evidence that Python/CUDA optimization belongs inside an authoritative multiplayer physics tick or that their numbers transfer to Chaos.

Gradient methods also face stiffness, contact discontinuity, conditioning, and long-horizon sensitivity; see [Suh et al., ICML 2022](https://proceedings.mlr.press/v162/suh22b.html). A forward trajectory that looks plausible does not by itself validate its gradients or a new runtime domain.

Default boundary: use the expensive differentiable system as an offline teacher. Runtime consumes the smallest bounded artifact that independently passes its own tests:

1. fitted physical parameters or a lookup table;
2. reduced-order or analytic approximation;
3. bounded surrogate or distilled policy;
4. only then, a more complex learned runtime component.

Distillation transfers behavior under sampled data; it does not guarantee conservation laws, contact stability, determinism, or out-of-distribution safety. Validate the student independently against both the teacher and a production baseline.

## Approximation and minimal implementation slice

Write a one-page interface before implementation:

- input features, units, ranges, normalization, temporal window, and missing-value policy;
- output values, units, bounds, and how they affect physics state;
- owned state, lifetime, reset behavior, and serialization boundary;
- OOD score, threshold, debounce, clamping, and fallback;
- one representative object and one fixed-seed scene;
- control/baseline and treatment running the same input trace;
- accuracy, stability, wall-time, memory, and state-correction metrics;
- evidence paths for raw traces, profiler captures, build identity, and configuration.

Gate 1 must remain minimal: one object, one bounded scene, one target-hardware class, and one comparison protocol. It answers whether the runtime artifact deserves scale/network testing. It does not authorize production or prove player value.

## Data, assets, and learned artifacts

Record provenance for every dataset, mesh, material, trajectory, checkpoint, and generated derivative: canonical URI, retrieval time, version/commit, SHA-256, author/owner, license or terms, permitted use, transformation lineage, and retention constraints. SPDX identifiers and the [REUSE specification](https://reuse.software/spec-3.3/) help express licensing; [W3C PROV-O](https://www.w3.org/TR/prov-o/) can express lineage. Neither proves ownership or truth.

For learned artifacts, record generation code and environment, random seeds, train/validation/test split identities and hashes, preprocessing, leakage checks, hyperparameters, checkpoint hash, calibration data, and model card. Keep near-duplicate scenes and trajectories in a single split. Test collision-rich, high-energy, edge-of-range, and deliberately OOD cases.

## Unreal Engine runtime production contract

Pin the exact Unreal Engine version, Chaos configuration, platform, build, CPU/GPU class, compiler, and network mode before naming code symbols. When version is unknown, say so and use only concept-level probes. The official [Unreal Engine Networked Physics Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networked-physics-overview) describes server-authoritative modes, prediction/interpolation, resimulation, and history costs; it is not proof that a chosen mode fits the target.

Separate the render target (for example 60 FPS) from physics tick frequency, fixed-step/substep policy, async execution, game-thread/physics-thread ownership, and replication cadence. Record which clock each metric uses.

Use official profiling surfaces appropriate to the pinned version: [Timing Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/timing-insights-in-unreal-engine), [Memory Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/memory-insights-in-unreal-engine), [Networking Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-insights-in-unreal-engine), and [Chaos Visual Debugger](https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-visual-debugger-in-unreal-engine). Treat tool names as concepts until version compatibility is verified. Never invent an Unreal or Chaos API.

### Budget accounting

Copy supplied incremental caps exactly. Do not silently allocate them among feature packing, inference, solver work, serialization, telemetry, models, tables, or history. Measure those components and report p50, p95, p99, maximum, sample count, warm-up, capture interval, synchronized GPU boundary, hardware, build, and scene. If a component cap is useful, mark it as a derived hypothesis, name an owner, explain how it was derived, and require approval before it becomes acceptance policy.

Budget both normal and adversarial workloads. Track CPU, GPU, resident and peak memory, allocation churn, replication bandwidth, correction frequency and magnitude, rollback/resimulation cost, OOD rate, LOD transition cost, NaN/Inf, energy growth, and penetration depth/duration.

### Authority, determinism, LOD, and fallback

The server owns authoritative physics. Clients send input intent, not accepted transforms or physics state. Cosmetic prediction must reconcile to server truth with measured correction magnitude and convergence time. Define determinism scope: identical build/hardware, cross-platform, replay, rollback, or only server authority. Test the declared scope with fixed inputs and seeds.

For each physics LOD, define enter and exit thresholds, hysteresis, minimum dwell, state mapping, energy/momentum handling, replicated-mode signal, and anti-thrashing telemetry. Validate transitions under contact and latency. The fallback must be independently stable, feature-flagged, reversible without corrupting state, and exercised in tests; it cannot be a paper-only promise.

## Four gates

### Gate 1 - one-object feasibility

Entry: frozen claim ledger, pinned artifact and target build, minimal interface, data provenance, baseline, fixed trace, and stop rules. Pass only when the candidate produces finite, stable outputs, improves the declared comparison metric within a predeclared tolerance, and fits the supplied total incremental caps on target hardware. A pass authorizes Gate 2 only. Fail or stop on NaN/Inf, unsafe contact, uncontrolled OOD, missing evidence, or cap breach.

### Gate 2 - scale and network feasibility

Exercise the declared maximum object count, representative collision density, server authority, latency/jitter/loss, prediction/reconciliation, replication bandwidth, LOD transitions, rollback/resimulation if applicable, and worst-case workload. Pass only when p95/p99 and worst-case CPU, GPU, memory, and bandwidth remain within the supplied caps, correction and penetration thresholds pass, fixed-seed repeatability matches the declared determinism scope, and fallback works.

### Gate 3 - product value

Preregister the primary player metric, guardrails, randomization unit, eligibility, duration, sample-size/power analysis, exposure logging, exclusions, and decision rule. Compare feature-on with the production baseline. Guardrails include crashes, stalls, correction artifacts, accessibility, retention or session-health metrics as appropriate. A statistically unclear result remains unknown; it is not rescued by engineering success.

### Gate 4 - staged rollout

Ship only behind a reversible feature flag with versioned artifact/configuration, canary cohort, telemetry, on-call owner, rollback drill, and automatic/manual stop thresholds. Ramp in stages after each evidence review. Stop on correctness regression, budget breach, OOD spike, correction spike, LOD thrashing, crash/stall guardrail, or missing telemetry. Preserve the known-good fallback and audit trail.

## Required transfer-brief shape

Use exactly four H2 sections: `Transfer decision`, `Approximation and implementation slice`, `Runtime production contract`, and `Gates and acceptance`. Under the last one, use four H3 headings beginning `Gate 1` through `Gate 4`.

The brief must retain the exact claim and reproduction limits; show the three lane verdicts; define teacher/student boundary, interface, data and assets; pin or mark unknown the Unreal/Chaos version; separate render FPS and physics tick; state total budgets without invented sub-allocation; preserve server authority; define LOD and fallback; and make every gate name its owner, evidence artifact, entry condition, pass/fail threshold, stop rule, and next authorized decision.

## Primary sources

- [NASA-STD-7009B, Standard for Models and Simulations](https://standards.nasa.gov/standard/NASA/NASA-STD-7009)
- [DiffTaichi](https://arxiv.org/abs/1910.00935)
- [ChainQueen](https://cdfg.mit.edu/assets/files/chain_queen_0.pdf)
- [DiffPD](https://arxiv.org/abs/2101.05917)
- [Suh et al., Differentiable Physics](https://proceedings.mlr.press/v162/suh22b.html)
- [Unreal Engine Networked Physics Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networked-physics-overview)
- [Microsoft Research, trustworthy online controlled experiments](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/)
- [Google SRE Workbook, Canarying Releases](https://sre.google/workbook/canarying-releases/)
- [Datasheets for Datasets](https://arxiv.org/abs/1803.09010) and [Model Cards](https://arxiv.org/abs/1810.03993)
