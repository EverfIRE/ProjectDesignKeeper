"""Compare a reported finite scalar with one or more observed scalars."""

import argparse
import json
import math
import sys
from decimal import Decimal, DecimalException, InvalidOperation, localcontext


class ResultComparisonError(ValueError):
    """Raised when a result comparison input or derived result is invalid."""


def _number(value, label, *, nonnegative=False):
    """Accept JSON-number-compatible native values without silently rounding Decimal."""
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ResultComparisonError(f"{label} must be a finite number")
    if isinstance(value, Decimal) and not value.is_finite():
        raise ResultComparisonError(f"{label} must be a finite number")
    try:
        as_float = float(value)
    except (OverflowError, ValueError, TypeError) as error:
        raise ResultComparisonError(f"{label} must be representable as a finite number") from error
    if not math.isfinite(as_float):
        raise ResultComparisonError(f"{label} must be a finite number")
    if nonnegative and value < 0:
        raise ResultComparisonError(f"{label} must be nonnegative")
    return value


def _decimal(value, label):
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ResultComparisonError(f"{label} must be finite")
        return value
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as error:
        raise ResultComparisonError(f"{label} cannot be represented canonically") from error
    if not number.is_finite():
        raise ResultComparisonError(f"{label} must be finite")
    return number


def _context_precision(values):
    decimals = [value for value in values if value is not None and value != 0]
    if not decimals:
        return 1000
    lowest_exponent = min(value.as_tuple().exponent for value in decimals)
    highest_adjusted = max(value.adjusted() for value in decimals)
    digits = max(len(value.as_tuple().digits) for value in decimals)
    return max(1000, highest_adjusted - lowest_exponent + digits + 20)


def _json_number(value, label):
    if not value.is_finite():
        raise ResultComparisonError(f"derived {label} is not finite")
    if value == value.to_integral_value():
        result = int(value)
        try:
            if not math.isfinite(float(result)):
                raise OverflowError
        except (OverflowError, ValueError):
            raise ResultComparisonError(f"derived {label} is not representable as a finite number") from None
        return result
    try:
        result = float(value)
    except (OverflowError, ValueError) as error:
        raise ResultComparisonError(f"derived {label} is not representable as a finite number") from error
    if not math.isfinite(result):
        raise ResultComparisonError(f"derived {label} is not representable as a finite number")
    if math.isfinite(result) and Decimal(str(result)) == value:
        return result
    return value


def _compact_json(value):
    """Serialize finite Decimal values as JSON numbers without a float round-trip."""
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ResultComparisonError("output contains a non-finite decimal")
        return str(value)
    if value is None or isinstance(value, (bool, int, float, str)):
        try:
            return json.dumps(value, allow_nan=False, ensure_ascii=True, separators=(",", ":"))
        except (TypeError, ValueError, OverflowError) as error:
            raise ResultComparisonError("output is not JSON-serializable") from error
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(_compact_json(item) for item in value) + "]"
    if isinstance(value, dict):
        if any(not isinstance(key, str) for key in value):
            raise ResultComparisonError("output object key is not a string")
        return "{" + ",".join(
            json.dumps(key, ensure_ascii=True) + ":" + _compact_json(value[key])
            for key in sorted(value)
        ) + "}"
    raise ResultComparisonError("output is not JSON-serializable")


def _observations(observed):
    if isinstance(observed, (list, tuple)):
        if not observed:
            raise ResultComparisonError("observed must be a nonempty scalar list or tuple")
        values = list(observed)
    else:
        values = [observed]
    return [_number(value, f"observed[{index}]") for index, value in enumerate(values)]


def compare_results(reported, observed, absolute_tolerance=None, relative_tolerance=None):
    """Compare native ``int``/``float``/``Decimal`` inputs without lossy truncation.

    Decimal inputs are accepted so callers can preserve JSON numeric lexemes;
    other numeric classes are rejected rather than coerced. Returned numeric
    fields are native numbers or finite ``Decimal`` values for the CLI's
    lossless compact encoder when no float round-trip is exact.
    """
    reported_value = _number(reported, "reported")
    observed_values = _observations(observed)
    absolute_value = None if absolute_tolerance is None else _number(absolute_tolerance, "absolute_tolerance", nonnegative=True)
    relative_value = None if relative_tolerance is None else _number(relative_tolerance, "relative_tolerance", nonnegative=True)
    decimal_values = [_decimal(value, "observed") for value in observed_values]
    reported_decimal = _decimal(reported_value, "reported")
    absolute_decimal = None if absolute_value is None else _decimal(absolute_value, "absolute_tolerance")
    relative_decimal = None if relative_value is None else _decimal(relative_value, "relative_tolerance")
    with localcontext() as context:
        try:
            context.prec = _context_precision([reported_decimal, *decimal_values, absolute_decimal, relative_decimal])
            mean = sum(decimal_values, Decimal(0)) / len(decimal_values)
            minimum, maximum = min(decimal_values), max(decimal_values)
            signed_error = mean - reported_decimal
            absolute_error = abs(signed_error)
            if reported_decimal == 0:
                relative_error = Decimal(0) if absolute_error == 0 else None
            else:
                relative_error = absolute_error / abs(reported_decimal)
            if len(decimal_values) == 1:
                standard_deviation = None
            else:
                variance = sum((value - mean) ** 2 for value in decimal_values) / (len(decimal_values) - 1)
                standard_deviation = variance.sqrt()
        except (DecimalException, ValueError, OverflowError, ZeroDivisionError) as error:
            raise ResultComparisonError("derived comparison statistic is not finite") from error
        absolute_ok = None if absolute_decimal is None else absolute_error <= absolute_decimal
        if relative_decimal is None:
            relative_ok = None
        elif reported_decimal == 0 and absolute_error != 0:
            relative_ok = False
        else:
            relative_ok = (relative_error or Decimal(0)) <= relative_decimal
        if absolute_ok is None and relative_ok is None:
            passed = absolute_error == 0
        else:
            passed = bool(absolute_ok) or bool(relative_ok)
        return {
            "reported": _json_number(reported_decimal, "reported"),
            "observed": {
                "count": len(observed_values),
                "mean": _json_number(mean, "mean"),
                "min": _json_number(minimum, "minimum"),
                "max": _json_number(maximum, "maximum"),
                "sample_standard_deviation": None if standard_deviation is None else _json_number(standard_deviation, "sample standard deviation"),
            },
            "signed_error": _json_number(signed_error, "signed error"),
            "absolute_error": _json_number(absolute_error, "absolute error"),
            "relative_error": None if relative_error is None else _json_number(relative_error, "relative error"),
            "absolute_tolerance": None if absolute_decimal is None else _json_number(absolute_decimal, "absolute tolerance"),
            "relative_tolerance": None if relative_decimal is None else _json_number(relative_decimal, "relative tolerance"),
            "absolute_within_tolerance": absolute_ok,
            "relative_within_tolerance": relative_ok,
            "passed": passed,
        }


def _parse_json(path):
    def reject_constant(value):
        raise ValueError(f"nonstandard JSON constant {value}")

    def object_from_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON object field {key}")
            result[key] = value
        return result

    def parse_decimal(value):
        try:
            return Decimal(value)
        except (DecimalException, ValueError, OverflowError) as error:
            raise ValueError("JSON number has an unrepresentable decimal exponent") from error

    try:
        with open(path, "r", encoding="utf-8", newline="") as source:
            data = json.load(
                source,
                parse_float=parse_decimal,
                parse_constant=reject_constant,
                object_pairs_hook=object_from_pairs,
            )
    except (OSError, UnicodeError, json.JSONDecodeError, DecimalException, ValueError, TypeError, RecursionError) as error:
        raise ResultComparisonError(f"unable to parse input JSON: {error}") from error
    if not isinstance(data, dict):
        raise ResultComparisonError("input JSON must be an object")
    allowed = {"reported", "observed", "absolute_tolerance", "relative_tolerance"}
    unknown = sorted(key for key in data if key not in allowed)
    if unknown:
        raise ResultComparisonError("unexpected input field: " + ", ".join(unknown))
    for key in ("reported", "observed"):
        if key not in data:
            raise ResultComparisonError(f"input JSON requires {key}")
    for key in ("absolute_tolerance", "relative_tolerance"):
        if key in data and data[key] is None:
            raise ResultComparisonError(f"{key} must be a finite number when declared")
    return data


def main(argv=None):
    parser = argparse.ArgumentParser(prog="compare_reported_results.py")
    parser.add_argument("input", metavar="INPUT.json")
    try:
        arguments = parser.parse_args(argv)
    except SystemExit as error:
        return error.code
    try:
        request = _parse_json(arguments.input)
        result = compare_results(
            request["reported"],
            request["observed"],
            request.get("absolute_tolerance"),
            request.get("relative_tolerance"),
        )
        payload = _compact_json(result)
    except (ResultComparisonError, OSError, TypeError, ValueError, OverflowError, UnicodeError, DecimalException, RecursionError) as error:
        print(str(error) or "invalid comparison input", file=sys.stderr)
        return 2
    print(payload)
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
