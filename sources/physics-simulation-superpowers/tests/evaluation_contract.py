"""Validation shared by evaluation records without production-tool imports."""

from typing import Any


def _is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_evaluation_record(data: dict) -> list[str]:
    """Return contract violations for one skill evaluation record."""
    if not isinstance(data, dict):
        return ["evaluation record must be a dictionary"]

    errors: list[str] = []
    for field in ("skill", "scenario"):
        if not _is_nonempty_string(data.get(field)):
            errors.append(f"{field} must be a nonempty string")

    for field in ("baseline", "enabled"):
        outcome = data.get(field)
        if not isinstance(outcome, dict):
            errors.append(f"{field} must be a dictionary")
            continue
        for outcome_field in ("response", "observations"):
            if not _is_nonempty_string(outcome.get(outcome_field)):
                errors.append(f"{field}.{outcome_field} must be a nonempty string")

    if data.get("verdict") not in {"pass", "fail", "accept_with_limitations"}:
        errors.append("verdict must be 'pass', 'fail', or 'accept_with_limitations'")

    evidence = data.get("evidence")
    if not isinstance(evidence, list) or not evidence or not all(
        _is_nonempty_string(item) for item in evidence
    ):
        errors.append("evidence must be a nonempty list of strings")

    return errors
