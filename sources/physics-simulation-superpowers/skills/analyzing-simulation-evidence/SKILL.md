---
name: analyzing-simulation-evidence
description: Use when simulation benchmark results, traces, ablations, sensitivity studies, performance-quality trade-offs, or publication claims need evidence-calibrated analysis.
---

# Analyzing Simulation Evidence

## Overview

Separate what was measured from what can be claimed. A descriptive difference is not automatically an independent-run effect, a causal mechanism, or a general winner.

## Analysis contract

1. Create a local evidence record with four labels: measured fact, derived arithmetic, inference/hypothesis, and unknown/blocker. Preserve provenance and units for every entry.
2. Identify the experimental unit. Summarize frames/ticks within one run descriptively; use independent runs or justified blocks for between-run inference. State the aggregation and uncertainty method.
3. Check matched workload, fidelity, environment, warm-up, timed boundary, synchronization, renderer inclusion, and quality metric before comparing methods. Missing claim-critical context remains blocking.
4. Analyze sensitivity over declared ranges; interpret controlled ablations without assigning a component effect when several factors changed.
5. Build a matched-budget Pareto view only from common performance and quality metrics. Retain failed/capped runs with their consumed budget and reason.
6. End with a claim-support verdict local to each claim: supported, conditionally supported, or unsupported, followed by its evidence and limits.

For tool contracts, executable examples, source boundaries, and detailed analysis rules, read [the evidence analysis reference](references/evidence-analysis.md).

## Tool-output requirement

If a response discusses either bundled tool, state locally its input, capabilities, limitations, whether it was executed, and the exact outcome mapping:

- `analyze_physics_trace.py`: exit 0 means all declared maximum thresholds pass; exit 1 means at least one threshold fails; exit 2 means CLI/input/validation failure.
- `compare_reported_results.py`: exit 0 means the equality/tolerance rule passes; exit 1 means that rule fails; exit 2 means CLI/input/validation failure.

## Boundaries

Never invent hardware, scenes, seeds, repetitions, confidence policy, thresholds, warm-up, or quality metrics. Do not treat frames/ticks as independent runs or claim that an unexecuted tool ran. Route experiment redesign to `designing-simulation-experiments`; this skill analyzes supplied evidence.

## Common mistakes

- Reporting a single observation as a publishable speedup.
- Calling an explored Pareto set globally optimal.
- Dropping failures, caps, or inconvenient runs.
- Turning a confounded ablation into a causal explanation.
