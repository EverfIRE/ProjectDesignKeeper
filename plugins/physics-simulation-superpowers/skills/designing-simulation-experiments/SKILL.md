---
name: designing-simulation-experiments
description: Use when planning physics-simulation comparisons, fixed-budget or fixed-quality benchmarks, reproducible ablations, 仿真实验设计, 公平对比, or schema-valid experiment-plan records.
---

# Designing Simulation Experiments

## Core principle

A comparison is evidence only when methods differ by the declared treatment while workload, fidelity, measurement, and decision rules stay matched. Historical results from different hardware, scenes, timesteps, resolutions, renderers, or metrics are hypotheses to retest, never ratio operands.

## Required workflow

Read [experiment-design.md](references/experiment-design.md) before drafting.

1. Start from a selected claim/evidence record produced by `reviewing-simulation-papers` or another shipped, source-anchored review. State what is author-reported, directly observed, inferred, contradictory, or unknown; turn one bounded claim into a falsifiable hypothesis.
2. Freeze a fairness contract: method revisions and tuning allowance; common hardware/software/precision; scene asset and initial-state hashes; timestep, horizon, resolution and particle/body budget; warm-up; timed boundary; synchronization; renderer; primary metric and decision rule. An unmatched factor is either an independent variable or a claim blocker.
3. Design fixed-budget and fixed-quality as separately labelled questions. Fixed-budget compares quality under equal caps. Fixed-quality compares time-to-target under one predeclared target and reports capped runs as censored.
4. Pair common seeds and initial states, block nuisance sessions, randomize treatment order within blocks, retain every run, and predeclare repetitions plus uncertainty analysis. Counts and confidence/tolerance values need scenario-specific rationale.
5. Bound preflight, confirmatory cells, ablations, failure reruns, storage and total wall/GPU time. Stop on safety/resource caps or missing claim-critical inputs; do not stop because a favorable result appears.

## Output contract

Produce an executable prose plan followed by exactly one fenced JSON object as the final response block. The prose covers claim scope and blockers, fairness, both comparison modes, measurement/statistics, ablations, resources, censoring and go/no-go logic.

The adapter uses exactly the fields in schemas/experiment-plan.schema.json and must pass scripts/validate_research_artifact.py experiment-plan. Arrays required by the schema contain strings or integers, not rich objects. Put detail inside those strings or the permitted nested objects. Never add convenience top-level keys.

When hardware, quality target, tolerance, confidence rule, seed count, repetition count, or per-run cost is unknown, keep the adapter structurally valid and truthfully scope it to a bounded preflight/blocked confirmatory phase. Unknown is not null: explain the missing decision in hypothesis, tolerances, resource_estimate, and stop_conditions. Do not claim that unavailable hardware will be used.

## Common mistakes

- Dividing numbers from different machines or scenes.
- Calling quality-at-budget time-to-target, or silently relaxing one method's target.
- Timing asynchronous launch rather than synchronized work.
- Dropping capped, failed, or inconvenient runs.
- Treating a pilot seed/repetition as a confirmatory sample-size justification.
- Returning scientifically careful prose with JSON that the existing validator rejects.
