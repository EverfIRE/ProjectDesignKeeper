"""Validate physics-run JSON manifests using only the Python standard library."""

import json
import math
import sys


USAGE = "usage: validate_run_manifest.py FILE.json"


def _nonempty_string(data, path, diagnostics):
    value = data.get(path) if isinstance(data, dict) else None
    if not isinstance(value, str) or not value.strip():
        diagnostics.append(f"{path} must be a nonempty string" if path in data else f"{path} is required")


def _number(data, field, diagnostics, minimum, strictly_positive=False, integer=False, path=None):
    path = path or field
    value = data.get(field) if isinstance(data, dict) else None
    if isinstance(value, bool) or not isinstance(value, int if integer else (int, float)):
        diagnostics.append(f"{path} must be {'an integer' if integer else 'a number'}" + (" >= 1" if integer and minimum == 1 else ""))
    elif not integer and not math.isfinite(value):
        diagnostics.append(f"{path} must be a finite number")
    elif (strictly_positive and value <= 0) or (not strictly_positive and value < minimum):
        diagnostics.append(f"{path} must be > 0" if strictly_positive else f"{path} must be >= {minimum}")


def _unknown_keys(data, allowed, prefix, diagnostics):
    for key in sorted((key for key in data if not isinstance(key, str)), key=_key_label):
        diagnostics.append(f"{prefix}key {_key_label(key)} must be a string")
    for key in sorted(key for key in data if isinstance(key, str) and key not in allowed):
        diagnostics.append(f"{prefix}{key} is not allowed")


def _key_label(key):
    if key is None or isinstance(key, (bool, int, float)):
        return repr(key)
    return type(key).__name__


def validate_document(kind: str, data: dict) -> list[str]:
    """Return deterministic dotted-path diagnostics for a physics-run document."""
    if kind != "physics-run":
        return ["kind must be: physics-run"]
    if not isinstance(data, dict):
        return ["document must be an object"]
    diagnostics = []
    _unknown_keys(data, ("schema_version", "run_id", "engine", "units", "timing", "authority", "network", "platform", "budget", "seed"), "", diagnostics)
    for field in ("schema_version", "run_id", "engine", "units", "authority", "network", "platform"):
        _nonempty_string(data, field, diagnostics)
    timing = data.get("timing")
    if not isinstance(timing, dict):
        diagnostics.append("timing must be an object")
    else:
        _unknown_keys(timing, ("render_fps_target", "physics_hz", "fixed_dt_seconds", "max_substeps"), "timing.", diagnostics)
        _number(timing, "render_fps_target", diagnostics, 0, strictly_positive=True, path="timing.render_fps_target")
        _number(timing, "physics_hz", diagnostics, 0, strictly_positive=True, path="timing.physics_hz")
        _number(timing, "fixed_dt_seconds", diagnostics, 0, strictly_positive=True, path="timing.fixed_dt_seconds")
        _number(timing, "max_substeps", diagnostics, 1, integer=True, path="timing.max_substeps")

    budget = data.get("budget")
    if not isinstance(budget, dict):
        diagnostics.append("budget must be an object")
    else:
        _unknown_keys(budget, ("cpu_ms", "gpu_ms", "memory_mb"), "budget.", diagnostics)
        for field in ("cpu_ms", "gpu_ms", "memory_mb"):
            _number(budget, field, diagnostics, 0, path=f"budget.{field}")
    _number(data, "seed", diagnostics, 0, integer=True)
    return diagnostics


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv in (["--help"], ["-h"]):
        print(USAGE)
        return 0
    if len(argv) != 1:
        print(USAGE)
        return 2
    try:
        with open(argv[0], encoding="utf-8") as source:
            data = json.load(source, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"nonstandard constant {value}")))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"unable to parse JSON: {error}")
        return 2
    diagnostics = validate_document("physics-run", data)
    for diagnostic in diagnostics:
        print(diagnostic)
    return 0 if not diagnostics else 2


if __name__ == "__main__":
    raise SystemExit(main())
