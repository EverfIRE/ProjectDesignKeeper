# Simulation experiment design contract

This reference translates claim/evidence records into a fair, resource-bounded experiment-plan. The sources justify the design principles below; they do not supply universal physics thresholds, seed counts, repetitions, warm-up durations, confidence levels, timesteps, or acceptance margins.

## Claim and evidence intake

Select one reviewed claim/evidence record and retain its source scope, stable paper identity, and evidence labels. A useful hypothesis names treatment, comparator, workload domain, primary metric direction, and decision criterion. Example: “Under the declared equal compute cap on the locked scenes, Method A reduces the primary error relative to Method B; under the owner-approved quality target, Method A reduces contiguous synchronized time-to-target.” If the target or margin is not yet approved, this remains a conditional hypothesis and the confirmatory claim is blocked.

Historical cross-system numbers are reconnaissance. Hardware, OS/driver/runtime, precision, timestep, resolution/particle count, scene, initial state, renderer, warm-up, timed window, metric and tuning allowance must match. Any factor that cannot match becomes an intentional independent variable with a narrower claim.

## Fairness record

| Record | Required content |
|---|---|
| methods/baselines | immutable version or commit, build flags, dependencies, configuration, precision, equal tuning allowance |
| scenes | asset/generator version, initial-state hash, scale, horizon, boundary/contact model, output times, reference if any |
| environment | actual common hardware availability, OS, driver/runtime, clocks/power, affinity, memory cap |
| fidelity | timestep/substeps, iterations/tolerances, resolution, particle/body count, horizon, sampling |
| timing boundary | warm-up rule, contiguous region, loading/JIT/allocation/transfer/I/O/render inclusion, GPU synchronization |
| run schedule | complete integer seeds, deterministic sub-seeds, pair IDs, blocks, randomized order, repetitions |
| decision | one primary metric, direction, units, estimator, margin/target source, uncertainty method, failure/censoring rule |

Common scenes should cover contrasting workload classes. A result on one friendly scene does not generalize to the whole suite.

## Two separate comparisons

Fixed-budget holds the wall-time/step/iteration and memory caps, fidelity, horizon, output schedule and tuning allowance equal. Compare resulting primary quality and stability, and report actual cost used. It answers quality under equal resources.

Fixed-quality locks the primary estimator, target/margin, evaluation interval and maximum cap. Measure the first contiguous synchronized time that reaches the target. A run that never reaches it is capped/censored, not deleted. It answers cost to the same quality.

A frontier is exploratory unless configurations, selection rule, metrics and aggregation were predeclared. Report every evaluated point. A requested “2x” claim needs its effect scale, direction, uncertainty rule and decision threshold fixed before confirmatory runs; the desired ratio 2 does not supply the missing quality target, confidence level, or non-inferiority margin.

## Measurement and analysis

Name one primary decision metric with unit, direction, estimator and sampling scope. Add secondary performance, quality, stability and real-time diagnostics without combining them into an undeclared score. Useful categories include synchronized wall time/step or time-to-target, peak memory, reference/trajectory error, constraint or penetration error, drift, NaN/divergence/failure rate, latency quantiles, over-budget rate and longest over-budget streak.

Warm up by a fixed predeclared rule and exclude the same region for every treatment. Log component timings and use device/manual synchronization where host launch time omits GPU completion. Retain raw per-run output, exact commands, configuration hash, machine fingerprint and randomized schedule.

Pair methods on the same seed, initial state and scene. Block controllable session effects, then randomize order within each block. Balance repetitions and report every failure. State variability source and interval calculation. Equivalence/non-inferiority requires a predeclared margin, confidence level, test/interval, direction and aggregation. Otherwise report estimates and uncertainty only.

## Unknown inputs and the current schema

The schema forbids extra top-level keys and null substitutes. Use all and only:

schema_version, hypothesis, independent_variables, dependent_variables, baselines, fixed_budgets, scenes, metrics, seeds, repetitions, tolerances, ablations, resource_estimate, stop_conditions.

String arrays carry auditable compact records. fixed_budgets, tolerances and resource_estimate may hold nested details.

If a confirmatory input is absent:

- State the missing owner/scientific decision and the blocked claim in hypothesis and tolerances.
- Keep fixed_budgets within supplied caps; distinguish preflight from confirmatory work.
- seeds and repetitions describe only the currently executable phase. A deterministic pilot seed and one pilot repetition may test feasibility, but they do not justify a confirmatory sample size. resource_estimate records that confirmatory seed/repetition counts remain pending measured variance, per-run cost and an approved precision/power rule.
- baselines and scenes remain nonempty strings that demand locked revisions/assets rather than pretending unknown versions are known.
- stop_conditions block the affected claim or confirmatory phase until common hardware, target, tolerance and analysis rule exist.

This makes the adapter valid without converting “unknown” into fabricated evidence.

## Ablations, resources and stopping

An ablation changes one documented component of the locked full method at a time; all budgets, scenes, seeds and measurement rules stay fixed. State the expected mechanism. An unavailable switch is recorded, not invented.

Compute planned cells as methods/configurations × scenes × seeds × repetitions. Include warm-up and timed duration, expected and worst-case wall time, GPU/CPU/RAM/storage and total cap. Use preflight measurements to decide whether the confirmatory matrix fits; reduce operating points before sacrificing pairing or substituting scenes.

Stop on the declared hard resource/safety cap, missing claim-critical input, unreliable timing, numerical invalidity or completion of all balanced cells. Preserve capped and failed cells with status, consumed budget and reason. Never adaptively stop for a favorable p-value or frontier point without a predeclared sequential design.

## Primary-source anchors

| Source | Supported use | Boundary |
|---|---|---|
| [NIST factorial design](https://www.itl.nist.gov/div898/handbook/pri/section3/pri331.htm) | randomized run order and balanced replication | general DOE guidance |
| [NIST blocking](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm) | block controllable nuisance factors and compare within blocks | experimenter selects meaningful blocks |
| [NIST tolerance guidance](https://www.itl.nist.gov/div898/handbook/prc/section2/prc263.htm) | engineering tolerances are externally prescribed | supplies no physics threshold |
| [Google Benchmark user guide](https://google.github.io/benchmark/user_guide.html) | explicit warm-up/duration, repetitions, interleaving and GPU timing | tool defaults are not scientific standards |
| [MLPerf Training Rules](https://github.com/mlcommons/training_policies/blob/master/training_rules.adoc) | fixed quality target/protocol, seeds, contiguous timing and independent runs | exact MLPerf run counts do not transfer automatically |
| [ACM Artifact Review and Badging](https://prod-www.acm.bloomreach.cloud/publications/policies/artifact-review-and-badging-current) | tolerance may replace bit identity if the main claim is preserved | experiment-specific tolerance still required |
| [Broadmark](https://diglib.eg.org/bitstreams/d1ac9824-285d-4dfa-8184-17e165bdacfd/download) | common contrasting scenes and explicit timed work | broad-phase-specific |
| [RPI-MATLAB-Simulator](https://diglib.eg.org/bitstream/handle/10.2312/PE.vriphys.vriphys13.071-080/071-080.pdf?sequence=1) | per-step timing/state/constraint logging on common problems | not an acceptance standard |
| [NeurIPS Paper Checklist](https://neurips.cc/public/guides/PaperChecklist) | variability calculation and compute reporting | submission guidance, not a prescribed design |
