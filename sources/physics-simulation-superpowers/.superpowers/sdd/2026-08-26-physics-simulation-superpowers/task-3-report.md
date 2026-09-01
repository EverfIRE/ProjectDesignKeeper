# Task 3 Report: Physics trace, replay, and step-sweep analysis

## Scope

Added standard-library JSONL/CSV tools for trace summaries, deterministic replay-hash comparison, and fixed-step sweep comparison. Public APIs are `parse_trace` / `summarize_trace`, `parse_replay` / `compare_replays`, and `parse_sweep` / `compare_step_sweep`; their input errors inherit `ValueError` through documented module-specific subclasses.

## TDD evidence

RED command:

```text
py -3 -m unittest tests.test_physics_analysis -v
```

RED outcome: the new test module failed to import with the expected `ModuleNotFoundError: No module named 'analyze_physics_trace'`. No production analyzer modules existed at that point.

GREEN commands and outcomes:

```text
py -3 -m unittest tests.test_physics_analysis -v
```

Passed: 9 focused tests.

```text
py -3 -m unittest discover -s tests -v
```

Passed: 50 tests across the repository.

```text
py -3 -m compileall -q scripts tests
```

Passed with exit code 0 and no output.

The CSV default-metric behavior was also exercised as a separate RED/GREEN cycle: its new test initially failed because `contacts` was not selected from CSV; after numeric CSV optional-field normalization, the focused suite passed.

## Fixtures

- `physics-trace.jsonl`: hand-derived three-row trace with sparse `energy` values.
- `physics-trace.csv`: unsorted CSV trace proving auto-detection and default numeric metric selection.
- `physics-trace-invalid.jsonl`: duplicate tick diagnostic.
- `replay-reference.jsonl`, `replay-identical.jsonl`, and `replay-mismatch.jsonl`: unsorted identical and divergent replay cases.
- `step-sweep.csv`: reference, coarse, and fine step settings with exact and boundary-tolerance values.

## CLI smoke evidence

For each tool, pass/fail/invalid invocations returned `0`, `1`, and `2` respectively. The trace threshold-equality case passed; the `contacts=7` case failed; replay mismatch reported tick 1; and the zero/invalid comparisons emitted JSON `null` rather than non-finite values.

## Self-review

- Output JSON uses sorted keys, compact deterministic encoding, and `allow_nan=False`.
- Parsers reject blank input, duplicate CSV headers, malformed row widths, non-object JSONL rows, duplicate ticks/run IDs, non-finite numbers when selected, and boolean numeric fields.
- Results are sorted by tick, metric name, or run ID as applicable; no dictionary iteration determines semantic output.
- Nearest-rank percentile behavior is documented in the trace module docstring.
- No Task 1/2 files, schema files, shared progress ledger, marketplace entries, or archives were changed.

## Residual concerns

CSV has no native type system: unselected nonnumeric custom cells remain metadata, while selected custom metrics are strictly validated as finite numeric values. This follows the selected-metric contract and keeps arbitrary CSV annotations usable.

## Hardening follow-up (`157ebf0`)

Additional RED command:

```text
py -3 -m unittest tests.test_physics_analysis -v
```

RED outcome: 15 tests ran, with the expected six defects exposed: signed metrics and signed upper thresholds were rejected; invalid UTF-8 raised `UnicodeDecodeError`; empty replay sides were accepted; CSV `NaN` was silently ignored; integer percentiles were converted to floats; and `max_substeps`/decimal-boundary paths failed through the old numeric policy.

GREEN outcomes after the minimal hardening changes:

```text
py -3 -m unittest tests.test_physics_analysis -v
```

Passed: 16 focused tests.

```text
py -3 -m unittest discover -s tests -v
py -3 -m compileall -q scripts tests
```

Passed: 57 repository tests and compilation with exit code 0. Fresh smoke checks verified every analyzer's `0` (pass), `1` (valid comparison/threshold failure), and `2` (invalid input) exit class. UTF-8 diagnostics had empty stdout and actionable stderr.

Hardening details: metrics and upper thresholds are signed finite values while timing/count fields and tolerances retain their explicit bounds; parsers and direct APIs enforce `max_substeps >= 1`; nonfinite CSV numeric-looking cells fail; a scaled finite mean avoids overflow for finite large values; empty replay sides are invalid; and integer percentile/max values remain JSON integers when the source values are integers. The earlier tolerance-roundoff policy is superseded below.

Residual concern: superseded by the exact decimal tolerance policy below.

## Numeric normalization follow-up

RED command:

```text
py -3 -m unittest tests.test_physics_analysis -v
```

RED outcome: 20 tests ran; four regressions failed as expected: CSV integral lexemes emitted float JSON unlike JSONL, huge integers passed through numeric conversion, unrepresentable step-sweep deviations did not become invalid-input errors, and the blanket `1e-12` relative slack accepted a materially over-tolerance comparison.

GREEN evidence:

```text
py -3 -m unittest tests.test_physics_analysis -v
py -3 -m unittest discover -s tests -v
py -3 -m compileall -q scripts tests
```

Passed: 20 focused tests, 61 repository tests, and compilation with exit code 0. Fresh analyzer/replay/sweep smoke checks exercised valid (`0`), valid-failure (`1`), and invalid (`2`) paths.

This wave losslessly accepts only integer objects or integer-form strings for integral fields; rejects non-finite/unrepresentable numeric values before arithmetic; checks every step-sweep derived deviation; wraps final JSON serialization at each CLI boundary; and normalizes CSV integer lexemes to match JSONL output. Its earlier ULP tolerance implementation is superseded by the exact decimal comparison below.

Residual concern: superseded by the exact decimal tolerance policy below.

## Exact tolerance follow-up

RED command:

```text
py -3 -m unittest tests.test_physics_analysis.PhysicsAnalysisTests.test_step_tolerances_use_exact_canonical_decimal_values -v
```

RED outcome: the new regression failed because an operand-ULP allowance incorrectly passed `10**16 + 2` with absolute tolerance `1`.

GREEN evidence:

```text
py -3 -m unittest tests.test_physics_analysis -v
py -3 -m unittest discover -s tests -v
py -3 -m compileall -q scripts tests
```

Passed: 21 focused tests, 62 repository tests, and compilation with exit code 0. Fresh analyzer/replay/sweep smoke checks exercised valid (`0`), valid-failure (`1`), and invalid (`2`) paths.

Tolerance predicates now construct `Decimal(str(value))` for accepted canonical values inside a local precision-1000 context. Absolute decisions compare exact decimal deltas; relative decisions compare `delta <= tolerance * abs(reference)`, avoiding rounded division. Zero tolerances require exact canonical equality. Reported signed/absolute/relative deviations retain their finite numeric output contract and remain independently checked before serialization.

Residual concern: canonical float values use Python's shortest round-trippable string, so exact comparison is exact for the accepted API value, not for a source literal that was already rounded by a caller before entering the API.
