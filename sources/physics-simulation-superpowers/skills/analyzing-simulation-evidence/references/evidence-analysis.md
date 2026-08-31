# Simulation evidence analysis contract

Use this reference when the claim needs numerical interpretation, uncertainty, sensitivity, ablation, a performance-quality frontier, failure accounting, or the bundled analysis scripts. It supplies analysis boundaries, not missing experimental choices.

## Evidence record and units

Start with a local record; do not scatter these categories across the report.

| Class | Required content |
|---|---|
| measured fact | Observed value, unit, run/configuration identifier, and source artifact |
| derived arithmetic | Formula, inputs, result, and assumptions; arithmetic does not add evidence |
| inference/hypothesis | Population or mechanism claim, experimental unit, estimator, and support status |
| unknown/blocker | Missing context and the exact claim it blocks |

A single observation has a descriptive mean equal to that observation. At n=1, sample standard deviation and the usual repeated-run mean interval are unavailable. Frames/ticks are dependent within-run samples, not independent run replicates. Between-run inference needs repeated independent runs or appropriately blocked runs, a justified experimental unit, declared aggregation/estimator, and a declared uncertainty method. Keep blocked runs in the analysis.

For comparisons, require matched workload and fidelity: method/build, hardware/software, scene/asset and initial state, timestep/substeps, resolution and particle/body count, horizon, warm-up, timed boundary, synchronization, renderer inclusion, tuning allowance, and a common quality/error metric. Unknown hardware, scene, seeds, repetition count, confidence policy, threshold, or quality metric remains an unknown/blocker.

## analyze_physics_trace.py

The script parses one `run_id` JSONL or CSV trace. Each row requires `run_id`, `tick`, `sim_time_seconds`, and `dt_seconds`; selected metrics must be finite numeric fields.

```powershell
py -3 -X utf8 scripts/analyze_physics_trace.py run.jsonl --metric frame_ms --threshold frame_ms=20
```

For each selected metric it reports count, mean, nearest-rank p50/p95/p99, and max. A declared threshold checks only whether `max > threshold`. It does not detect or exclude warm-up, estimate between-run uncertainty, establish independence, or produce a confidence interval. Prepare the trace with a declared common warm-up/timed boundary before invocation.

Exit 0 means the parsed trace passed all declared maximum thresholds; exit 1 means at least one declared maximum threshold failed; exit 2 means CLI/input/validation failure. A threshold is supplied policy, not a standard created by the tool.

## compare_reported_results.py

The JSON input is scalar-only: required `reported` and scalar-or-list `observed`, with optional `absolute_tolerance` and `relative_tolerance`.

```json
{"reported": 91, "observed": [91], "absolute_tolerance": 0}
```

```powershell
py -3 -X utf8 scripts/compare_reported_results.py comparison.json
```

It reports observed count/mean/min/max, sample standard deviation (`null` at n=1), signed/absolute/relative error, tolerance outcomes, and `passed`. Without tolerances, only exact equality passes. It accepts no metadata, no quality metric, no pairing/block model, and performs no causal or hypothesis test.

Exit 0 means its equality/tolerance rule passed; exit 1 means that rule failed; exit 2 means CLI/input/validation failure. Tolerance selection and scientific claim support remain external decisions.

## Sensitivity and controlled ablation

Sensitivity varies declared inputs over justified ranges, retains every evaluated configuration, and reports how the chosen outputs change. Label screening or post-hoc exploration as exploratory, not confirmatory evidence. Do not convert explored ranges into universal robustness.

A controlled ablation changes one documented component against the locked full method while holding workload, fidelity, budget, seeds/blocks, and measurement rules fixed. Report performance, quality, uncertainty, interactions, and failures. If multiple factors change, attribute only the observed bundle difference; do not name a single causal mechanism.

## Matched-budget Pareto frontier

Compare evaluated points under matched budget/fidelity and common, direction-declared performance and quality metrics. A point is non-dominated only relative to the evaluated set, those metric definitions, and the declared aggregation. The frontier is not global optimality, acceptability, statistical significance, or an “overall better” verdict. Show intervals or run-level results and retain dominated points.

## Failure cases

Retain successful, failed, invalid, non-converging, timeout, OOM, and capped attempts. Record status, attempted denominator, cap/consumed budget, quality status, logs, exclusion rule, and reason. Analyze selection and censoring explicitly; do not summarize only completed runs or choose the most favorable run.

## Claim-support verdict

For the blind example, the measured facts are one 143 FPS observation and one 91 FPS observation. The derived arithmetic `143 / 91 = 1.571428...` is descriptive only. A publishable speedup, winner, or “overall better” claim is unsupported because independent replication, matched hardware/scene/fidelity/timing, uncertainty policy, common quality metric, and failed/capped attempts are missing.

Keep verdicts claim-local: name the precise claim, evidence, experimental unit, scope, uncertainty, comparability, failure coverage, and unknown/blocker. Use “supported” only within that scope; otherwise say conditionally supported or unsupported. Route acquisition or experiment redesign to `designing-simulation-experiments`.

## Source boundaries

| Authoritative source | Supported use | Boundary / limitation |
|---|---|---|
| [NIST confidence limits for a mean](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) | The usual unknown-variance mean interval uses sample SD, N, and t with N-1 degrees of freedom. | It supplies no universal confidence level or simulation repetition count. |
| [Hurlbert on pseudoreplication](https://doi.org/10.2307/1942661) | Unreplicated treatments or non-independent samples cannot support treatment-level inference. | The ecological setting supplies no simulator seed or run-duration rule. |
| [NIST randomized blocks](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm) | Compare treatments within meaningful blocks and randomize remaining nuisance influence. | Pairing/blocking must match the actual experimental unit. |
| [NeurIPS checklist, Q7-Q8](https://neurips.cc/public/guides/PaperChecklist) | Identify variability source, interval/error-bar method, assumptions, and compute including failures. | Submission guidance is not a mandatory physics statistic. |
| [MLPerf Inference Rules](https://github.com/mlcommons/inference_policies/blob/master/inference_rules.adoc) | Disclose the performance-relevant system, canonical workload, quality requirements, seeds, and replicability. | MLPerf durations, metrics, and quality targets do not transfer as simulator defaults. |
| [SPEC CPU 2017 Run Rules](https://www.spec.org/cpu2017/Docs/runrules.html) | Declare untimed work, timed work, validation, and reproducibility context. | SPEC's workload sequence is not a universal warm-up rule. |
| [Morris sensitivity screening](https://doi.org/10.1080/00401706.1991.10484804) | Planned perturbations can screen model-input effects. | One screening method does not replace independent stochastic replication. |
| [NIST factorial designs](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3331.htm) | Factorial designs expose main effects and interactions under a suitable matrix. | Confounded or post-hoc ablations do not become causal. |
| [Deb et al., NSGA-II](https://doi.org/10.1109/4235.996017) | Non-domination represents multi-objective trade-offs. | An evaluated frontier does not prove global optimality or acceptable quality. |
| [NIST censoring](https://www.itl.nist.gov/div898/handbook/apr/section1/apr131.htm) | Preserve observed status and time/cap information for censored items. | A generic timeout does not mandate a survival estimator. |
| [MLPerf Training Rules](https://github.com/mlcommons/training_policies/blob/master/training_rules.adoc) | Use independent runs, retain logs, and prohibit selecting the most favorable result. | MLPerf's exact run counts and trimming rules are not general defaults. |
| [ACM SIGSIM PADS artifact evaluation](https://sigsim.acm.org/conf/pads/2024/blog/artifact-evaluation/) | Distinguish author rerun, artifact reproduction, and independent reproduction scope. | Artifact status is not a statistical or causal test. |
