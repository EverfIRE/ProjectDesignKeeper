# Task 4 report: research artifact inventory and result comparison

## Deliverables

- `scripts/inventory_artifact.py` exposes `inventory_artifact(root,
  exclude_patterns=None) -> dict` and `ArtifactInventoryError`.
- `scripts/compare_reported_results.py` exposes `compare_results(reported,
  observed, absolute_tolerance=None, relative_tolerance=None) -> dict` and
  `ResultComparisonError`.
- `tests/test_research_tools.py` provides direct-API and subprocess coverage;
  its literal fixtures are under `tests/fixtures/research/`.

Both CLIs produce exactly one compact, sorted JSON object on valid input using
`allow_nan=False`. Diagnostics use stderr with empty stdout. Inventory returns
`0` or `2`; comparison returns `0` (pass), `1` (valid mismatch), or `2`
(usage, parse, or invalid input).

## TDD evidence

Tests and fixtures were authored before either production module existed.

RED, before implementation:

```text
py -3 -m unittest tests.test_research_tools -v
ModuleNotFoundError: No module named 'compare_reported_results'
FAILED (errors=1)
```

GREEN, after the minimum implementations and test-fixture correction for the
literal UTF-8 binary file's trailing newline:

```text
py -3 -m unittest tests.test_research_tools -v
Ran 12 tests in 0.961s
OK
```

Full verification:

```text
py -3 -m unittest discover -s tests -v
Ran 74 tests in 2.117s
OK

py -3 -m compileall -q scripts tests
exit 0
```

Representative command-line smoke tests recorded these exit classes:

```text
inventory_artifact.py artifact-root                 -> 0
inventory_artifact.py missing-root                  -> 2
compare_reported_results.py comparison-pass.json    -> 0
compare_reported_results.py comparison-fail.json    -> 1
compare_reported_results.py comparison-invalid-nan.json -> 2
```

## Fixtures and conventions

The artifact fixture contains a text file, a UTF-8 raw-byte file, an empty
file, and a nested file. Tests assert its hand-checked SHA-256 records,
ordering, byte totals, and empty-file digest. Temporary copies exercise
case-insensitive VCS/cache exclusions and caller file/directory patterns.

Inventory walks sorted directory entries, rejects every symbolic link and
other non-regular entry, hashes raw bytes, and rejects unreadable or
identity/type-changing files. Built-ins are `.git`, `__pycache__`,
`.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.tox`, and `.venv`.
Caller patterns are validated POSIX-style relative glob patterns matched
against both forward-slash relative paths and basenames.

Comparison accepts finite built-in `int`/`float` scalars only (never booleans)
and uses the observed arithmetic mean. Tolerance decisions use
`Decimal(str(value))` under a high-precision context, so canonical decimal
boundaries compare as users express them; declared absolute and relative rules
are combined with OR. The sample standard deviation uses denominator `n - 1`
and is `null` for a single observation. Derived output numbers are rejected if
they cannot be represented as finite JSON numbers.

## Self-review

- Re-read the brief against both public interfaces, JSON/exit contracts,
  exclusions, symlink behavior, numeric validation, overflow handling, and
  fixture coverage.
- Manually inspected the compact CLI output for pass, mismatch, and invalid
  cases; valid output is sorted and diagnostics did not leak to stdout.
- Mutation checks: changing file ordering/hash inputs, dropping an exclusion,
  changing exact/tolerance decisions, using AND instead of OR, changing the
  standard-deviation denominator, or accepting invalid input would fail a
  focused behavioral test.

## Residual risks

The implementation detects ordinary concurrent identity/type changes during
file opening and reading, but a hostile filesystem race on a platform without
`O_NOFOLLOW` remains inherently limited by Python's portable standard-library
directory APIs. It returns a controlled error on detected changes and never
intentionally follows an encountered symlink.

## Follow-up hardening (commit `fix: harden research evidence tools`)

Independent review found that the initial CLI parsed JSON fractions through
binary `float`, which could erase materially significant decimal digits, and
that an underflowed derived statistic could be serialized as `0.0`. The
comparison CLI now uses `json.load(parse_float=Decimal)` and its own compact,
sorted JSON encoder. The public function documents acceptance of native
`int`, `float`, and `Decimal`; it rejects other numeric classes rather than
coercing them. Integrals remain `int`, exactly round-trippable values may be
`float`, and a finite non-integral value that would lose digits or underflow
as a float remains a `Decimal` until the encoder emits it as a JSON number.
Derived values exceeding finite double range still produce controlled invalid
input, preserving the original overflow contract.

The parser now controls `RecursionError`, tests raw invalid UTF-8 bytes as
well as a separate malformed escape sequence, and confirms a deeply nested
JSON document exits `2` without stdout or traceback.

Inventory now rejects blank text roots and exceptions raised by a malformed
`os.PathLike` implementation. Before root resolution and before nested
traversal it rejects symbolic links, Windows junctions, and other Windows
reparse points using `Path.is_junction()` with a reparse-attribute fallback.
Slash-containing patterns now use `PurePosixPath.full_match`, preserving
root-relative path components so `nested/*.txt` does not match
`nested/deep/c.txt`; basename matching remains available for patterns without
a slash.

Follow-up RED evidence:

```text
py -3 -m unittest tests.test_research_tools -v
Ran 17 tests in 1.299s
FAILED (failures=5)
```

The failures showed the precise-decimal CLI incorrectly returned `0`, the
subnormal mean was `0.0`, blank roots were accepted, junctions were traversed,
and a slash glob excluded a nested descendant.

Follow-up GREEN and final full-suite evidence:

```text
py -3 -m unittest tests.test_research_tools -v
Ran 17 tests in 1.624s
OK

py -3 -m unittest discover -s tests -v
Ran 79 tests in 2.535s
OK
```

## Input-edge closure (commit `fix: close research tool input edge cases`)

`inventory_artifact` now calls `os.fspath(root)` exactly once inside a
controlled boundary before examining the normalized text. This closes the
remaining route where a custom `os.PathLike` returned an empty or whitespace
path and `Path` interpreted it as the current directory. Bytes, blank
normalized text, and exceptions from `__fspath__` all raise
`ArtifactInventoryError`.

The result-comparison JSON parser now wraps `Decimal` construction in a
controlled `parse_float` callback and catches `DecimalException` at parsing
and CLI boundaries. An unrepresentable exponent exits `2` with empty stdout.
Precision planning now ignores zero values' presentation quantum/exponent and
uses the baseline context when all comparison values are zero. Context
precision assignment is within the controlled arithmetic boundary, so direct
calls raise `ResultComparisonError` rather than a raw `ValueError`.

New direct and CLI tests cover blank/whitespace `PathLike` inputs, an
unrepresentable JSON exponent, and exact match for
`Decimal("0e-1000000000000000000")`.

RED:

```text
py -3 -m unittest tests.test_research_tools -v
Ran 19 tests in 2.311s
FAILED (failures=2, errors=1)
```

The failures showed PathLike blank roots being accepted, the huge exponent
exiting `1`, and a raw `ValueError` from context precision.

GREEN:

```text
py -3 -m unittest tests.test_research_tools -v
Ran 19 tests in 1.549s
OK
```

Final verification for this closure:

```text
py -3 -m unittest discover -s tests -v
Ran 81 tests in 2.927s
OK

py -3 -m compileall -q scripts tests
exit 0

inventory pass/invalid exits: 0/2
comparison pass/fail/invalid exits: 0/1/2
```
