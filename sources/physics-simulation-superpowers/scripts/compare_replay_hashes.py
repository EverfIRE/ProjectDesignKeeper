"""Compare deterministic replay hashes in JSONL or CSV files."""
import argparse
import json
import sys
from pathlib import Path

from analyze_physics_trace import TraceInputError, _number, _read_rows, _require_string_keys


class ReplayInputError(ValueError):
    """Raised when replay data violates the replay contract."""


def parse_replay(path, input_format=None):
    records = []
    try:
        rows = _read_rows(path, input_format)
    except TraceInputError as error:
        raise ReplayInputError(str(error)) from error
    for index, raw in enumerate(rows, 1):
        try:
            _require_string_keys(raw, f"row {index}")
        except TraceInputError as error:
            raise ReplayInputError(str(error)) from error
        if "tick" not in raw or "state_hash" not in raw:
            raise ReplayInputError(f"row {index}: missing required field")
        if not isinstance(raw["state_hash"], str) or not raw["state_hash"].strip():
            raise ReplayInputError(f"row {index}: state_hash must be a nonempty string")
        try:
            tick = _number(raw["tick"], f"row {index}: tick", minimum=0, integer=True)
        except TraceInputError as error:
            raise ReplayInputError(str(error)) from error
        records.append({"tick": tick, "state_hash": raw["state_hash"]})
    if len({item["tick"] for item in records}) != len(records):
        raise ReplayInputError("replay contains duplicate ticks")
    return sorted(records, key=lambda item: item["tick"])


def compare_replays(reference_records, candidate_records):
    """Return the first mismatch over ascending union tick order."""
    def indexed(records, label):
        if not isinstance(records, (list, tuple)):
            raise ReplayInputError(f"{label} records must be a list")
        result = {}
        for index, row in enumerate(records, 1):
            if not isinstance(row, dict):
                raise ReplayInputError(f"{label} row {index} must be an object")
            try:
                _require_string_keys(row, f"{label} row {index}")
            except TraceInputError as error:
                raise ReplayInputError(str(error)) from error
            if "tick" not in row or "state_hash" not in row:
                raise ReplayInputError(f"{label} row {index}: missing required field")
            try:
                tick = _number(row["tick"], f"{label} row {index}: tick", minimum=0, integer=True)
            except TraceInputError as error:
                raise ReplayInputError(str(error)) from error
            if not isinstance(row["state_hash"], str) or not row["state_hash"].strip():
                raise ReplayInputError(f"{label} row {index}: state_hash must be a nonempty string")
            if tick in result:
                raise ReplayInputError(f"{label} contains duplicate ticks")
            result[tick] = row["state_hash"]
        return result
    reference, candidate = indexed(reference_records, "reference"), indexed(candidate_records, "candidate")
    if not reference or not candidate:
        raise ReplayInputError("reference and candidate replays must be nonempty")
    for tick in sorted(set(reference) | set(candidate)):
        if tick not in reference:
            reason = "missing_in_reference"
        elif tick not in candidate:
            reason = "missing_in_candidate"
        elif reference[tick] != candidate[tick]:
            reason = "hash_mismatch"
        else:
            continue
        return {"candidate_count": len(candidate), "first_divergent_tick": tick, "passed": False, "reason": reason, "reference_count": len(reference)}
    return {"candidate_count": len(candidate), "first_divergent_tick": None, "passed": True, "reason": None, "reference_count": len(reference)}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("candidate")
    parser.add_argument("--format", choices=("jsonl", "csv"))
    args = parser.parse_args(argv)
    try:
        result = compare_replays(parse_replay(args.reference, args.format), parse_replay(args.candidate, args.format))
        payload = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (ReplayInputError, ValueError, OverflowError) as error:
        print(str(error), file=sys.stderr)
        return 2
    print(payload)
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
