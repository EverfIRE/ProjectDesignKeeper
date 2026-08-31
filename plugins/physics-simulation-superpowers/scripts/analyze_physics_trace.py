"""Summarize JSONL or CSV physics traces using nearest-rank percentiles.

For percentile p, values are sorted and the one-based value at ceil(p * n) is
returned (clamped to the available range).  This module uses only stdlib.
"""
import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path


class TraceInputError(ValueError):
    """Raised when a trace cannot be parsed or violates the trace contract."""


_INTEGER_TEXT = re.compile(r"[+-]?\d+\Z")


def _json_loads(text):
    return json.loads(text, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonstandard constant " + value)))


def _format_for(path, explicit):
    if explicit:
        return explicit
    try:
        suffix = Path(path).suffix.lower()
    except (TypeError, ValueError) as error:
        raise TraceInputError("input path must be a string or path") from error
    if suffix in (".jsonl", ".csv"):
        return suffix[1:]
    raise TraceInputError("unable to detect format; use --format jsonl or csv")


def _read_rows(path, explicit_format=None):
    try:
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeError, TypeError, ValueError) as error:
        raise TraceInputError("unable to read input: " + str(error)) from error
    if not text.strip():
        raise TraceInputError("input is blank")
    fmt = _format_for(path, explicit_format)
    if fmt == "jsonl":
        rows = []
        for number, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                raise TraceInputError(f"line {number}: blank JSONL row")
            try:
                row = _json_loads(line)
            except (ValueError, json.JSONDecodeError) as error:
                raise TraceInputError(f"line {number}: invalid JSON: {error}") from error
            if not isinstance(row, dict):
                raise TraceInputError(f"line {number}: JSONL row must be an object")
            rows.append(row)
        return rows
    if fmt == "csv":
        try:
            reader = csv.reader(text.splitlines(), strict=True)
            header = next(reader)
        except (csv.Error, StopIteration) as error:
            raise TraceInputError("invalid CSV header") from error
        if not header or any(not name.strip() for name in header):
            raise TraceInputError("CSV column names must be nonempty")
        if len(set(header)) != len(header):
            raise TraceInputError("CSV contains duplicate column names")
        rows = []
        for number, values in enumerate(reader, 2):
            if len(values) != len(header):
                raise TraceInputError(f"line {number}: CSV row has wrong column count")
            rows.append(dict(zip(header, values)))
        if not rows:
            raise TraceInputError("input is blank")
        return rows
    raise TraceInputError("format must be jsonl or csv")


def _number(value, name, minimum=None, positive=False, integer=False):
    """Convert finite numeric input; bounds are opt-in and field-specific."""
    if isinstance(value, bool):
        raise TraceInputError(f"{name} must be {'an integer' if integer else 'a finite number'}")
    try:
        if integer:
            if isinstance(value, int):
                converted = value
            elif isinstance(value, str) and _INTEGER_TEXT.fullmatch(value):
                converted = int(value)
            else:
                raise ValueError
        elif isinstance(value, str) and _INTEGER_TEXT.fullmatch(value):
            converted = int(value)
        else:
            converted = value if isinstance(value, (int, float)) else float(value)
        finite_value = float(converted)
    except (TypeError, ValueError, OverflowError):
        raise TraceInputError(f"{name} must be {'an integer' if integer else 'a finite number'}") from None
    if not math.isfinite(finite_value):
        raise TraceInputError(f"{name} must be a finite number")
    if positive and converted <= 0:
        raise TraceInputError(f"{name} must be > 0")
    if minimum is not None and converted < minimum:
        raise TraceInputError(f"{name} must be >= {minimum}")
    return converted


def _require_string_keys(data, prefix):
    if any(not isinstance(key, str) for key in data):
        raise TraceInputError(f"{prefix} keys must be strings")


def parse_trace(path, input_format=None):
    """Parse and validate a trace file, returning records sorted by tick."""
    records = []
    is_csv = _format_for(path, input_format) == "csv"
    for index, raw in enumerate(_read_rows(path, input_format), 1):
        _require_string_keys(raw, f"row {index}")
        required = ("run_id", "tick", "sim_time_seconds", "dt_seconds")
        missing = [name for name in required if name not in raw or raw[name] == ""]
        if missing:
            raise TraceInputError(f"row {index}: missing required field {missing[0]}")
        run_id = raw["run_id"]
        if not isinstance(run_id, str) or not run_id.strip():
            raise TraceInputError(f"row {index}: run_id must be a nonempty string")
        record = dict(raw)
        record["run_id"] = run_id
        record["tick"] = _number(raw["tick"], f"row {index}: tick", minimum=0, integer=True)
        record["sim_time_seconds"] = _number(raw["sim_time_seconds"], f"row {index}: sim_time_seconds", minimum=0)
        record["dt_seconds"] = _number(raw["dt_seconds"], f"row {index}: dt_seconds", positive=True)
        if is_csv:
            for name, value in raw.items():
                if name in ("run_id", "tick", "sim_time_seconds", "dt_seconds") or value == "":
                    continue
                try:
                    numeric = _number(value, f"row {index}: {name}")
                except TraceInputError:
                    try:
                        float(value)
                    except ValueError:
                        continue
                    raise
                record[name] = numeric
        records.append(record)
    run_ids = {record["run_id"] for record in records}
    if len(run_ids) != 1:
        raise TraceInputError("trace must contain one run_id")
    ticks = [record["tick"] for record in records]
    if len(set(ticks)) != len(ticks):
        raise TraceInputError("trace contains duplicate ticks")
    return sorted(records, key=lambda record: record["tick"])


def _statistic(values, percentile):
    ordered = sorted(values)
    return ordered[max(0, min(len(ordered) - 1, math.ceil(percentile * len(ordered)) - 1))]


def _mean(values):
    try:
        scale = max(abs(value) for value in values)
        mean = 0 if scale == 0 else math.fsum(value / scale for value in values) / len(values) * scale
        finite = math.isfinite(float(mean))
    except (OverflowError, ValueError):
        raise TraceInputError("metric mean is not finite") from None
    if not finite:
        raise TraceInputError("metric mean is not finite")
    return mean


def summarize_trace(records, metrics=None, thresholds=None):
    """Return a deterministic statistical summary for already parsed records."""
    if not isinstance(records, list) or not records:
        raise TraceInputError("trace must be a nonempty list")
    normalized = []
    for index, raw in enumerate(records, 1):
        if not isinstance(raw, dict):
            raise TraceInputError(f"row {index}: record must be an object")
        _require_string_keys(raw, f"row {index}")
        # Validate direct API input through a temporary record shape.
        required = ("run_id", "tick", "sim_time_seconds", "dt_seconds")
        if any(name not in raw for name in required):
            raise TraceInputError(f"row {index}: missing required field")
        run_id = raw["run_id"]
        if not isinstance(run_id, str) or not run_id.strip():
            raise TraceInputError(f"row {index}: run_id must be a nonempty string")
        item = dict(raw)
        item["tick"] = _number(raw["tick"], f"row {index}: tick", minimum=0, integer=True)
        item["sim_time_seconds"] = _number(raw["sim_time_seconds"], f"row {index}: sim_time_seconds", minimum=0)
        item["dt_seconds"] = _number(raw["dt_seconds"], f"row {index}: dt_seconds", positive=True)
        normalized.append(item)
    if len({row["run_id"] for row in normalized}) != 1:
        raise TraceInputError("trace must contain one run_id")
    if len({row["tick"] for row in normalized}) != len(normalized):
        raise TraceInputError("trace contains duplicate ticks")
    if thresholds is not None and not isinstance(thresholds, dict):
        raise TraceInputError("thresholds must be a mapping")
    thresholds = {} if thresholds is None else dict(thresholds)
    if any(not isinstance(name, str) or not name for name in thresholds):
        raise TraceInputError("threshold metric names must be nonempty strings")
    if metrics is None:
        metrics = sorted({name for row in normalized for name, value in row.items() if name not in ("run_id", "tick", "sim_time_seconds") and not isinstance(value, bool) and isinstance(value, (int, float))})
    else:
        try:
            metrics = list(metrics)
        except TypeError as error:
            raise TraceInputError("metrics must be an iterable of nonempty strings") from error
    if any(not isinstance(name, str) or not name for name in metrics):
        raise TraceInputError("metrics must contain nonempty strings")
    metrics = sorted(set(metrics))
    if not metrics:
        raise TraceInputError("no numeric metrics selected")
    if not set(thresholds).issubset(metrics):
        metrics = sorted(set(metrics) | set(thresholds))
    summary_metrics = {}
    for metric in metrics:
        values = []
        for index, row in enumerate(normalized, 1):
            if metric not in row or row[metric] == "":
                continue
            values.append(_number(row[metric], f"row {index}: {metric}"))
        if not values:
            raise TraceInputError(f"selected metric {metric} is absent")
        summary_metrics[metric] = {"count": len(values), "mean": _mean(values), "p50": _statistic(values, .5), "p95": _statistic(values, .95), "p99": _statistic(values, .99), "max": max(values)}
    failures = []
    for metric, threshold in sorted(thresholds.items()):
        threshold = _number(threshold, f"threshold {metric}")
        maximum = summary_metrics[metric]["max"]
        if maximum > threshold:
            failures.append({"metric": metric, "max": maximum, "threshold": threshold})
    ordered = sorted(normalized, key=lambda row: row["tick"])
    return {"metrics": summary_metrics, "passed": not failures, "row_count": len(ordered), "run_id": ordered[0]["run_id"], "threshold_failures": failures, "tick_range": {"first": ordered[0]["tick"], "last": ordered[-1]["tick"]}}


def _threshold(text):
    if "=" not in text:
        raise argparse.ArgumentTypeError("threshold must be NAME=VALUE")
    name, value = text.split("=", 1)
    if not name:
        raise argparse.ArgumentTypeError("threshold metric name is required")
    try:
        return name, _number(value, "threshold " + name)
    except TraceInputError as error:
        raise argparse.ArgumentTypeError(str(error)) from error


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace")
    parser.add_argument("--format", choices=("jsonl", "csv"))
    parser.add_argument("--metric", action="append", default=[])
    parser.add_argument("--threshold", action="append", type=_threshold, default=[])
    args = parser.parse_args(argv)
    try:
        result = summarize_trace(parse_trace(args.trace, args.format), args.metric or None, dict(args.threshold))
        payload = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (TraceInputError, ValueError, OverflowError) as error:
        print(str(error), file=sys.stderr)
        return 2
    print(payload)
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
