### Task 4: Research artifact inventory and result comparison

**Files:** Create `scripts/inventory_artifact.py`, `scripts/compare_reported_results.py`, `tests/test_research_tools.py`, literal fixtures under `tests/fixtures/research/`, and `.superpowers/sdd/2026-08-26-physics-simulation-superpowers/task-4-report.md`.

## Shared contract

- Use only the Python standard library. Importable APIs raise documented subclasses of `ValueError` for invalid user input and never leak raw `TypeError`, `OverflowError`, filesystem implementation details, or tracebacks from the CLI.
- CLI stdout is exactly one deterministic compact JSON document (`sort_keys=True`, `allow_nan=False`) for a valid input. Invalid-input diagnostics go to stderr with empty stdout. Exit codes are `0=pass`, `1=valid comparison failed`, and `2=usage/parse/invalid input`. Inventory has no pass target, so it uses only `0` and `2`.
- Reject booleans as numbers, non-finite/unrepresentable numbers, nonstandard JSON constants, unexpected object fields, invalid UTF-8, and malformed caller collections/keys. Derived numeric fields must be finite and JSON-serializable or fail as controlled invalid input.
- Write literal, hand-checkable fixtures and exercise both direct APIs and subprocess CLIs, including exact stdout stability and all applicable exit classes.

## `inventory_artifact.py`

- Expose `inventory_artifact(root, exclude_patterns=None) -> dict`. `root` must resolve to an existing directory. Never follow symbolic links or traverse outside the resolved root; reject an encountered symlink with an actionable `ArtifactInventoryError` so an apparently complete evidence inventory cannot silently omit/escape content.
- Inventory regular files recursively. Built-in exclusions are directory components `.git`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.tox`, and `.venv`, matched case-insensitively. Caller patterns are repeatable POSIX-style glob patterns applied to each root-relative forward-slash path and basename; a matching directory excludes its entire subtree. Reject blank, absolute, parent-traversal (`..`), backslash, and non-string patterns.
- Each file record is exactly `{"path": <forward-slash relative path>, "bytes": <nonnegative integer>, "sha256": <lowercase 64-hex>}`. Sort records lexicographically by relative path. Output also includes `algorithm: "sha256"`, `file_count`, and `total_bytes`; do not expose an absolute machine path or timestamp.
- Hash raw bytes. Detect files that disappear/change into non-regular files during traversal and return a controlled error; unreadable files are invalid input. Empty directories yield a valid zero-file inventory. Output must be independent of directory enumeration order.
- CLI: `inventory_artifact.py ROOT [--exclude PATTERN ...]`. Tests cover stable order/hash/size/aggregate values, binary and empty files, built-in VCS/cache exclusions, caller file and directory patterns, empty directory, missing/non-directory roots, invalid patterns, symlinks when supported, invalid UTF-8 paths/arguments where reproducible, and stable JSON/exit `0|2`.

## `compare_reported_results.py`

- Expose `compare_results(reported, observed, absolute_tolerance=None, relative_tolerance=None) -> dict`. `reported` is one finite scalar. `observed` is either one finite scalar or a nonempty list/tuple of finite scalars. Tolerances are optional finite nonnegative scalars. If neither tolerance is declared, require exact canonical equality; if one or both are declared, pass when absolute **or** relative tolerance passes.
- Compare the observed arithmetic mean to the reported value. Use an overflow-safe mean. Exact tolerance decisions use canonical decimal representations (`Decimal(str(value))`) in a context large enough for every accepted finite double-range value, so human decimal boundaries such as `0.4 - 0.3 <= 0.1` pass but materially larger or zero-tolerance deviations do not.
- Output contains `reported`, `observed` summary with `count`, `mean`, `min`, `max`, and sample standard deviation (`null` for one observation), `signed_error`, `absolute_error`, `relative_error` (`null` when reported is zero and mean differs; `0` for exact zero match), both tolerance values or JSON `null`, per-rule booleans or `null`, and overall `passed`. Sample standard deviation uses denominator `n-1` and must be finite; document the convention.
- Direct input numeric types normalize consistently with JSON: preserve exact integers where practical; reject lossy exotic numeric types rather than silently truncate. If a mathematically derived error or standard deviation cannot be represented as a finite output number, return `ResultComparisonError` / CLI `2`, never a false pass or invalid JSON.
- CLI: `compare_reported_results.py INPUT.json`. The UTF-8 JSON object accepts exactly `reported`, `observed`, optional `absolute_tolerance`, and optional `relative_tolerance`. Tests cover exact scalar match, scalar mismatch with no tolerance, absolute/relative boundary equality and slight overage, OR behavior, zero reported value, repeated mean/min/max/sample-standard-deviation by hand, stable integer types, empty/malformed observations, negative/non-finite/huge tolerance and value inputs, unexpected fields/non-object JSON/invalid UTF-8, derived overflow, deterministic output, and exit `0|1|2`.

## TDD, verification, and handoff

- First author tests and fixtures only. Run `py -3 -m unittest tests.test_research_tools -v` and record RED due to missing production modules. Then implement the minimum code with `apply_patch` and refactor only while green.
- Run focused tests, `py -3 -m unittest discover -s tests -v`, `py -3 -m compileall -q scripts tests`, representative CLI smoke tests for all applicable exit classes, `git diff --check 57c6a0c..HEAD`, and `git status --short`.
- Write the report with exact RED/GREEN evidence, public interfaces, fixtures, hashing/exclusion and statistical/tolerance conventions, self-review, and residual risks. Commit implementation/report/brief as `feat: add research artifact evidence tools`.

## Scope

- Work only in `C:/Users/qiupeng/Documents/Codex/2026-08-26/new-chat/work/physics-simulation-superpowers` on branch `feat/physics-simulation-superpowers`, building on `57c6a0c` plus controller-authored ignored SDD files.
- Preserve Tasks 1-3 behavior. Do not edit schemas, existing analyzers, skills, source governance, marketplace entries, `C:/Users/qiupeng/plugins`, or archives. Do not edit the shared progress ledger.
- Do not dispatch subagents, perform network research, amend prior commits, or weaken existing tests.
