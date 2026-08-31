### Task 3: Physics trace, replay, and step-sweep analysis

**Files:** Create `scripts/analyze_physics_trace.py`, `scripts/compare_replay_hashes.py`, `scripts/compare_step_sweep.py`, `tests/test_physics_analysis.py`, literal JSONL/CSV fixtures under `tests/fixtures/traces/`, and `.superpowers/sdd/2026-08-26-physics-simulation-superpowers/task-3-report.md`.

## Shared contracts

- Use only the Python standard library. Each tool accepts UTF-8 JSONL or CSV, auto-detected from `.jsonl`/`.csv` unless an explicit format option is supplied, and emits exactly one deterministic JSON document on stdout (sorted keys, no NaN/Infinity). Actionable invalid-input diagnostics go to stderr.
- Exit codes are `0=valid and passed`, `1=valid but a threshold/comparison failed`, and `2=usage, parsing, schema, or other invalid input`. Direct library functions raise a documented `ValueError` subclass or return a deterministic result; they must never leak `KeyError`, `TypeError`, division-by-zero, or implementation addresses for malformed user data.
- Reject blank input, malformed JSONL/CSV rows, duplicate column names, non-object JSONL rows, missing required fields, booleans used as integers/numbers, non-finite numbers, duplicate ticks/run identifiers where uniqueness is required, and invalid/negative tolerances. Input order must not affect semantic output; diagnostics and result arrays are sorted deterministically.
- Tests must exercise direct Python APIs and subprocess CLIs. Fixtures are literal and small enough that expected statistics/deviations can be checked by hand.

## `analyze_physics_trace.py`

- Trace rows follow the design contract: required nonempty string `run_id`; integer `tick >= 0`; finite numeric `sim_time_seconds >= 0`; finite numeric `dt_seconds > 0`; optional known/custom metric values must be finite numeric values when selected. A trace contains one `run_id` and unique ticks.
- Expose a small importable parsing API and `summarize_trace(records, metrics=None, thresholds=None) -> dict`. The CLI accepts a trace path, repeatable `--metric NAME`, and repeatable upper-bound `--threshold NAME=VALUE`. If no metrics are named, summarize present numeric fields other than `tick` and `sim_time_seconds`; do include `dt_seconds`.
- Output includes total row count, run identifier, tick range, per-metric `count`, `mean`, `p50`, `p95`, `p99`, and `max`, plus a sorted list of threshold failures and an overall `passed` boolean. A selected/thresholded metric absent from all rows is invalid input, not a threshold failure.
- Percentiles use nearest-rank: sort ascending, rank is `ceil(p * n)` for `p` in `(0, 1]`, use the one-based rank (clamped to `1..n`), and preserve exact integer results where practical. Document this rule in the module help/docstring.
- Tests include a hand-derived dataset with exact mean/p50/p95/p99/max, sparse optional metrics, threshold pass and equality, threshold failure, malformed rows, invalid numeric values, and stable JSON output.

## `compare_replay_hashes.py`

- Each replay row requires integer `tick >= 0` and nonempty string `state_hash`; optional `run_id` is accepted. Ticks must be unique within each replay.
- Expose `compare_replays(reference_records, candidate_records) -> dict`. Compare ticks in ascending union order. The earliest tick absent on either side or carrying unequal hashes is `first_divergent_tick`; identical tick/hash maps emit JSON `null`. Include deterministic reason (`missing_in_reference`, `missing_in_candidate`, or `hash_mismatch`), counts, and an overall `passed` boolean. If both sides are identical, reason is `null`.
- CLI accepts reference and candidate paths. It exits `0` when identical, `1` on a valid divergence, and `2` on malformed/duplicate data. Tests cover identical traces, mismatched hashes, a tick missing from each side in separate cases, unsorted input, and literal `null` serialization.

## `compare_step_sweep.py`

- Each row requires unique nonempty string `run_id`, finite numeric `fixed_dt_seconds > 0`, integer `max_substeps >= 1`, and finite numeric values for each selected metric.
- Expose `compare_step_sweep(records, reference_run_id, metrics, absolute_tolerances=None, relative_tolerances=None) -> dict`. The CLI accepts one sweep path, required `--reference-run-id`, repeatable required `--metric NAME`, and repeatable `--absolute-tolerance NAME=VALUE` / `--relative-tolerance NAME=VALUE`. Unknown tolerance metric names and missing reference/metric values are invalid. A metric passes when its absolute deviation is within its declared absolute tolerance **or** its relative deviation is within its declared relative tolerance; if neither is declared, require exact equality. At zero reference, relative deviation is `0` for exact equality and JSON `null` otherwise, so no division-by-zero or Infinity is emitted.
- Output identifies the reference run and its step settings, then emits comparisons sorted by `run_id`, each with step settings and per-metric reference/observed values, signed and absolute deviation, relative deviation, tolerances, and `passed`; include overall `passed`. The reference row may be represented explicitly but must not create a false failure.
- CLI exits `0` when all comparisons pass, `1` when at least one valid comparison exceeds tolerance, and `2` for invalid input. Tests cover exact/reference rows, absolute and relative boundary equality, a reference-step deviation failure, zero-reference behavior, unknown reference, missing metrics, invalid tolerance syntax/value, and deterministic ordering.

## TDD, verification, and handoff

- First write the tests and fixtures only. Run `py -3 -m unittest tests.test_physics_analysis -v` and record the expected RED caused by missing production modules. Do not weaken or replace existing tests.
- Then implement the minimum production code using `apply_patch`, run the focused suite and `py -3 -m unittest discover -s tests -v`, and refactor only while green.
- Also run `py -3 -m compileall -q scripts tests`, CLI smoke tests for all three exit-code classes, `git diff --check 981b637..HEAD`, and inspect `git status --short`.
- Write the task report with exact RED/GREEN commands and outcomes, public interfaces, fixture list, self-review, and residual concerns. Commit implementation and report as `feat: add physics trace and replay analyzers`.

## Scope and safety

- Work only in `C:/Users/qiupeng/Documents/Codex/2026-08-26/new-chat/work/physics-simulation-superpowers` on branch `feat/physics-simulation-superpowers` and build on `981b637` plus the controller-authored progress/brief files already present.
- Preserve Tasks 1-2 behavior. Do not edit schemas, manifest validators, skills, source governance, marketplace entries, `C:/Users/qiupeng/plugins`, or final archives.
- Do not edit the shared progress ledger. Do not dispatch subagents. Do not perform network research. Do not amend or rewrite prior commits.
