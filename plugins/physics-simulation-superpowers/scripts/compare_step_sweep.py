"""Compare a fixed-step sweep against one reference run."""
import argparse
import json
import math
import sys
from decimal import Decimal, InvalidOperation, localcontext

from analyze_physics_trace import TraceInputError, _number, _read_rows, _require_string_keys


class SweepInputError(ValueError):
    """Raised when step-sweep input or comparison configuration is invalid."""


def parse_sweep(path, input_format=None):
    try:
        rows = _read_rows(path, input_format)
    except TraceInputError as error:
        raise SweepInputError(str(error)) from error
    records = []
    for index, raw in enumerate(rows, 1):
        try:
            _require_string_keys(raw, f"row {index}")
        except TraceInputError as error:
            raise SweepInputError(str(error)) from error
        for name in ("run_id", "fixed_dt_seconds", "max_substeps"):
            if name not in raw or raw[name] == "":
                raise SweepInputError(f"row {index}: missing required field {name}")
        if not isinstance(raw["run_id"], str) or not raw["run_id"].strip():
            raise SweepInputError(f"row {index}: run_id must be a nonempty string")
        try:
            record = dict(raw)
            record["fixed_dt_seconds"] = _number(raw["fixed_dt_seconds"], f"row {index}: fixed_dt_seconds", positive=True)
            record["max_substeps"] = _number(raw["max_substeps"], f"row {index}: max_substeps", minimum=1, integer=True)
        except TraceInputError as error:
            raise SweepInputError(str(error)) from error
        records.append(record)
    if len({record["run_id"] for record in records}) != len(records):
        raise SweepInputError("sweep contains duplicate run_id values")
    return sorted(records, key=lambda record: record["run_id"])


def _tolerances(values, metrics, label):
    if values is not None and not isinstance(values, dict):
        raise SweepInputError(f"{label} tolerances must be a mapping")
    values = {} if values is None else dict(values)
    if any(not isinstance(name, str) or not name for name in values):
        raise SweepInputError(f"{label} tolerance names must be nonempty strings")
    unknown = sorted(set(values) - set(metrics))
    if unknown:
        raise SweepInputError(f"{label} tolerance names are not selected metrics: {', '.join(unknown)}")
    converted = {}
    for name, value in values.items():
        try:
            converted[name] = _number(value, f"{label} tolerance {name}", minimum=0)
        except TraceInputError as error:
            raise SweepInputError(str(error)) from error
    return converted


def compare_step_sweep(records, reference_run_id, metrics, absolute_tolerances=None, relative_tolerances=None):
    """Compare each run; a metric passes absolute OR relative tolerance, else exact."""
    if not isinstance(reference_run_id, str) or not reference_run_id.strip():
        raise SweepInputError("reference_run_id must be a nonempty string")
    if metrics is None:
        raise SweepInputError("at least one metric is required")
    try:
        metrics = list(metrics)
    except TypeError as error:
        raise SweepInputError("metrics must be an iterable of nonempty strings") from error
    if any(not isinstance(metric, str) or not metric for metric in metrics):
        raise SweepInputError("metrics must contain nonempty strings")
    metrics = sorted(set(metrics))
    if not metrics:
        raise SweepInputError("at least one metric is required")
    if not isinstance(records, (list, tuple)):
        raise SweepInputError("records must be a list")
    indexed = {}
    for index, raw in enumerate(records, 1):
        if not isinstance(raw, dict):
            raise SweepInputError(f"row {index} must be an object")
        try:
            _require_string_keys(raw, f"row {index}")
        except TraceInputError as error:
            raise SweepInputError(str(error)) from error
        run_id = raw.get("run_id")
        if not isinstance(run_id, str) or not run_id.strip():
            raise SweepInputError(f"row {index}: run_id must be a nonempty string")
        if run_id in indexed:
            raise SweepInputError("sweep contains duplicate run_id values")
        try:
            item = dict(raw)
            item["fixed_dt_seconds"] = _number(raw.get("fixed_dt_seconds"), f"row {index}: fixed_dt_seconds", positive=True)
            item["max_substeps"] = _number(raw.get("max_substeps"), f"row {index}: max_substeps", minimum=1, integer=True)
            for metric in metrics:
                if metric not in raw or raw[metric] == "":
                    raise SweepInputError(f"row {index}: missing metric {metric}")
                item[metric] = _number(raw[metric], f"row {index}: {metric}")
        except TraceInputError as error:
            raise SweepInputError(str(error)) from error
        indexed[run_id] = item
    if reference_run_id not in indexed:
        raise SweepInputError("reference run_id was not found")
    absolute, relative = _tolerances(absolute_tolerances, metrics, "absolute"), _tolerances(relative_tolerances, metrics, "relative")
    reference = indexed[reference_run_id]
    comparisons = []
    for run_id in sorted(indexed):
        observed = indexed[run_id]
        metric_results = {}
        comparison_passed = True
        for metric in metrics:
            expected, actual = reference[metric], observed[metric]
            try:
                signed, absolute_deviation = actual - expected, abs(actual - expected)
                if not math.isfinite(float(signed)) or not math.isfinite(float(absolute_deviation)):
                    raise ValueError
                relative_deviation = 0 if expected == 0 and absolute_deviation == 0 else (None if expected == 0 else absolute_deviation / abs(expected))
                if relative_deviation is not None and not math.isfinite(float(relative_deviation)):
                    raise ValueError
            except (OverflowError, ValueError, ZeroDivisionError):
                raise SweepInputError(f"metric {metric} derived deviation is not finite") from None
            absolute_ok = metric not in absolute or _within_absolute(actual, expected, absolute[metric])
            relative_ok = metric not in relative or (relative_deviation is not None and _within_relative(actual, expected, relative[metric]))
            passed = (absolute_ok if metric in absolute else False) or (relative_ok if metric in relative else False) if (metric in absolute or metric in relative) else absolute_deviation == 0
            metric_results[metric] = {"absolute_deviation": absolute_deviation, "absolute_tolerance": absolute.get(metric), "observed": actual, "passed": passed, "reference": expected, "relative_deviation": relative_deviation, "relative_tolerance": relative.get(metric), "signed_deviation": signed}
            comparison_passed = comparison_passed and passed
        comparisons.append({"fixed_dt_seconds": observed["fixed_dt_seconds"], "max_substeps": observed["max_substeps"], "metrics": metric_results, "passed": comparison_passed, "run_id": run_id})
    return {"comparisons": comparisons, "passed": all(item["passed"] for item in comparisons), "reference": {"fixed_dt_seconds": reference["fixed_dt_seconds"], "max_substeps": reference["max_substeps"], "run_id": reference_run_id}}


def _decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise SweepInputError("comparison value is not a canonical finite number") from error


def _within_absolute(actual, reference, tolerance):
    """Compare accepted numeric values exactly in a high-precision decimal domain."""
    try:
        with localcontext() as context:
            context.prec = 1000
            return abs(_decimal(actual) - _decimal(reference)) <= _decimal(tolerance)
    except (InvalidOperation, ValueError):
        raise SweepInputError("unable to compare absolute tolerance exactly") from None


def _within_relative(actual, reference, tolerance):
    """Compare relative error without division rounding: delta <= tolerance * reference."""
    try:
        with localcontext() as context:
            context.prec = 1000
            actual_decimal, reference_decimal, tolerance_decimal = _decimal(actual), _decimal(reference), _decimal(tolerance)
            difference = abs(actual_decimal - reference_decimal)
            return difference == 0 if reference_decimal == 0 else difference <= tolerance_decimal * abs(reference_decimal)
    except (InvalidOperation, ValueError):
        raise SweepInputError("unable to compare relative tolerance exactly") from None


def _tolerance(text):
    if "=" not in text:
        raise argparse.ArgumentTypeError("tolerance must be NAME=VALUE")
    name, value = text.split("=", 1)
    if not name:
        raise argparse.ArgumentTypeError("tolerance metric name is required")
    try:
        return name, _number(value, "tolerance " + name)
    except TraceInputError as error:
        raise argparse.ArgumentTypeError(str(error)) from error


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("sweep")
    parser.add_argument("--format", choices=("jsonl", "csv"))
    parser.add_argument("--reference-run-id", required=True)
    parser.add_argument("--metric", action="append", required=True)
    parser.add_argument("--absolute-tolerance", action="append", type=_tolerance, default=[])
    parser.add_argument("--relative-tolerance", action="append", type=_tolerance, default=[])
    args = parser.parse_args(argv)
    try:
        result = compare_step_sweep(parse_sweep(args.sweep, args.format), args.reference_run_id, args.metric, dict(args.absolute_tolerance), dict(args.relative_tolerance))
        payload = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (SweepInputError, ValueError, OverflowError) as error:
        print(str(error), file=sys.stderr)
        return 2
    print(payload)
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
