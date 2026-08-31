# Task 2: Schemas and manifest validation tools

## TDD evidence

RED was captured before production modules existed:

```text
py -3 -m unittest tests.test_manifest_validation -v
ModuleNotFoundError: No module named 'validate_research_artifact'
Ran 1 test in 0.000s
FAILED (errors=1)
```

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 15 tests in 0.147s
OK

py -3 -m unittest discover -s tests -v
Ran 17 tests in 0.143s
OK
```

Additional verification completed successfully:

```text
py -3 -m compileall -q scripts tests
py -3 -c "import json, pathlib; [json.loads(path.read_text(encoding='utf-8')) for path in pathlib.Path('schemas').glob('*.schema.json')]"
git diff --check
```

## Files

- `schemas/physics-run.schema.json`
- `schemas/paper-record.schema.json`
- `schemas/experiment-plan.schema.json`
- `schemas/reproduction-run.schema.json`
- `scripts/validate_run_manifest.py`
- `scripts/validate_research_artifact.py`
- `tests/test_manifest_validation.py`
- `tests/fixtures/manifests/*.json` (one valid and two invalid literal fixtures per kind)

## Self-review

- Both modules expose `validate_document(kind: str, data: dict) -> list[str]` and use standard-library JSON parsing only.
- Diagnostics use stable field paths, accumulate errors, and validators reject booleans where numeric values are required.
- CLIs print one diagnostic per line and use exit `0` for valid input and `2` otherwise; no path returns `1`.
- The false-pass guard rejects compilation/installation-only observations and missing evidence.

## Concerns

None identified. Schemas are portable documented contracts; runtime validation is deliberately explicit rather than dependent on a JSON Schema package.

## Review-fix wave

Added parity coverage for fixed-shape unknown keys, typed nested array items, structured reproduction observations, and non-finite numbers.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 22 tests in 0.200s
FAILED (failures=7)
```

The failures were the intended gaps: non-finite physics values, nonstandard JSON constants, unknown fixed-shape keys, invalid nested array items, and string-only false-pass observations.

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 22 tests in 0.197s
OK

py -3 -m unittest discover -s tests -v
Ran 24 tests in 0.190s
OK
```

`py -3 -m compileall -q scripts tests`, standard-library parsing of all four schemas, and `git diff --check` also completed successfully. The revised reproduction result contract requires a `metric` and finite scalar/string `value`; a `pass` also requires evidence. Free-form artifact/configuration objects remain open by design.

## Second review-fix wave

Replaced generic observed-result records with claim-linked comparisons. Each result now includes an anchor, comparison type, metric, observed/expected values, outcome, and evidence path. A `pass` must include a valid successful comparison whose evidence path is also declared at the top level.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 26 tests in 0.207s
FAILED (failures=7, errors=1)
```

The failures captured the old result shape, unsafe non-string direct-API keys, and missing schema whitespace patterns.

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 26 tests in 0.192s
OK

py -3 -m unittest discover -s tests -v
Ran 28 tests in 0.206s
OK
```

All four schemas were parsed by the Python standard library after the update; `compileall` and `git diff --check` passed. No concerns identified.

## Final review-fix wave

Expected results now form a unique, structured claim registry. Observed comparisons reference those claim IDs and must match their registered type, metric, and unit. Lifecycle-only build/install/setup claims are rejected, and malformed evidence paths cannot satisfy a pass.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 31 tests in 0.214s
FAILED (failures=10, errors=1)
```

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 31 tests in 0.201s
OK

py -3 -m unittest discover -s tests -v
Ran 33 tests in 0.219s
OK
```

Standard-library compilation and parsing of all four schemas, plus `git diff --check`, completed successfully. Non-string direct-API keys are now rendered without memory addresses. No concerns identified.

## Narrow eligibility fix

Claim lookup now occurs only after a claim ID passes nonempty-string validation, so malformed/unhashable direct API data yields diagnostics rather than exceptions. Status `pass` requires an eligible numeric, performance, or image-backed figure comparison; qualitative behavior is retained as supporting evidence but cannot independently pass.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 34 tests in 0.215s
FAILED (failures=9, errors=2)
```

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 34 tests in 0.209s
OK

py -3 -m unittest discover -s tests -v
Ran 36 tests in 0.206s
OK
```

The reproduction schema adds conditional `if`/`then` type rules for expected and observed values. `compileall`, parsing of all four schemas, and `git diff --check` passed. No concerns identified.

## Target-bound reproduction fix

The top-level reproduction target is now a structured, source-anchored claim. Its category maps to exactly one expected claim and only a successful eligible observation of that target claim can establish `pass`; supporting observations cannot. Target and target-claim lifecycle/preflight descriptions are rejected conservatively.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 37 tests in 0.216s
FAILED (failures=13, errors=1)
```

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 37 tests in 0.203s
OK

py -3 -m unittest discover -s tests -v
Ran 39 tests in 0.202s
OK
```

All schema files parsed with the standard library, `compileall` passed, and `git diff --check` was clean. No concerns identified.

## Category and preflight guard

Target categories are now type-checked before lookup, so unhashable direct API values produce the normal category diagnostic. The conservative target lifecycle gate now explicitly includes `preflight`.

RED evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 39 tests in 0.203s
FAILED (failures=1, errors=1)
```

GREEN evidence:

```text
py -3 -m unittest tests.test_manifest_validation -v
Ran 39 tests in 0.210s
OK

py -3 -m unittest discover -s tests -v
Ran 41 tests in 0.203s
OK
```

`compileall`, standard-library schema parsing, and `git diff --check` passed. No concerns identified.
