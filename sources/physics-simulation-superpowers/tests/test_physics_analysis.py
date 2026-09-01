import json
import math
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "traces"
sys.path.insert(0, str(ROOT / "scripts"))

import analyze_physics_trace
import compare_replay_hashes
import compare_step_sweep


class PhysicsAnalysisTests(unittest.TestCase):
    def test_trace_summary_uses_nearest_rank_and_sparse_metrics(self):
        records = analyze_physics_trace.parse_trace(FIXTURES / "physics-trace.jsonl")
        summary = analyze_physics_trace.summarize_trace(records, metrics=["contacts", "energy", "dt_seconds"], thresholds={"contacts": 8})
        self.assertEqual(summary["row_count"], 3)
        self.assertEqual(summary["run_id"], "trace-a")
        self.assertEqual(summary["tick_range"], {"first": 0, "last": 2})
        self.assertEqual(summary["metrics"]["contacts"], {"count": 3, "mean": 14 / 3, "p50": 4, "p95": 8, "p99": 8, "max": 8})
        self.assertEqual(summary["metrics"]["energy"], {"count": 2, "mean": 3, "p50": 1, "p95": 5, "p99": 5, "max": 5})
        self.assertTrue(summary["passed"])
        self.assertEqual(summary["threshold_failures"], [])

    def test_trace_threshold_failure_and_invalid_records_are_reported(self):
        records = analyze_physics_trace.parse_trace(FIXTURES / "physics-trace.jsonl")
        failed = analyze_physics_trace.summarize_trace(records, thresholds={"contacts": 7})
        self.assertFalse(failed["passed"])
        self.assertEqual(failed["threshold_failures"], [{"metric": "contacts", "max": 8, "threshold": 7}])
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.parse_trace(FIXTURES / "physics-trace-invalid.jsonl")
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.summarize_trace([{ "run_id": "a", "tick": True, "sim_time_seconds": 0, "dt_seconds": 1 }])

    def test_trace_csv_auto_detects_and_defaults_to_present_numeric_metrics(self):
        records = analyze_physics_trace.parse_trace(FIXTURES / "physics-trace.csv")
        summary = analyze_physics_trace.summarize_trace(records)
        self.assertEqual(list(summary["metrics"]), ["contacts", "dt_seconds"])
        self.assertEqual(summary["metrics"]["contacts"]["mean"], 3)

    def test_trace_cli_emits_stable_json_and_exit_classes(self):
        command = [sys.executable, str(ROOT / "scripts" / "analyze_physics_trace.py"), str(FIXTURES / "physics-trace.jsonl"), "--threshold", "contacts=7"]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, json.dumps(json.loads(result.stdout), sort_keys=True, separators=(",", ":")) + "\n")
        invalid = subprocess.run([sys.executable, str(ROOT / "scripts" / "analyze_physics_trace.py"), str(FIXTURES / "physics-trace-invalid.jsonl")], capture_output=True, text=True, check=False)
        self.assertEqual(invalid.returncode, 2)
        self.assertTrue(invalid.stderr.strip())

    def test_replay_comparison_detects_first_union_divergence(self):
        reference = compare_replay_hashes.parse_replay(FIXTURES / "replay-reference.jsonl")
        identical = compare_replay_hashes.parse_replay(FIXTURES / "replay-identical.jsonl")
        self.assertEqual(compare_replay_hashes.compare_replays(reference, identical), {"candidate_count": 3, "first_divergent_tick": None, "passed": True, "reason": None, "reference_count": 3})
        mismatch = compare_replay_hashes.parse_replay(FIXTURES / "replay-mismatch.jsonl")
        self.assertEqual(compare_replay_hashes.compare_replays(reference, mismatch)["first_divergent_tick"], 1)
        self.assertEqual(compare_replay_hashes.compare_replays(reference, mismatch)["reason"], "hash_mismatch")
        self.assertEqual(compare_replay_hashes.compare_replays([{ "tick": 1, "state_hash": "a" }], [{ "tick": 0, "state_hash": "a" }])["reason"], "missing_in_reference")
        self.assertEqual(compare_replay_hashes.compare_replays([{ "tick": 0, "state_hash": "a" }], [{ "tick": 1, "state_hash": "a" }])["reason"], "missing_in_candidate")

    def test_replay_cli_returns_one_for_divergence_and_two_for_invalid_data(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts" / "compare_replay_hashes.py"), str(FIXTURES / "replay-reference.jsonl"), str(FIXTURES / "replay-mismatch.jsonl")], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["first_divergent_tick"], 1)
        invalid = subprocess.run([sys.executable, str(ROOT / "scripts" / "compare_replay_hashes.py"), str(FIXTURES / "replay-reference.jsonl"), str(FIXTURES / "physics-trace.jsonl")], capture_output=True, text=True, check=False)
        self.assertEqual(invalid.returncode, 2)

    def test_step_sweep_honors_tolerance_boundaries_and_zero_reference(self):
        records = compare_step_sweep.parse_sweep(FIXTURES / "step-sweep.csv")
        result = compare_step_sweep.compare_step_sweep(records, "reference", ["error", "peak_speed"], absolute_tolerances={"error": .5}, relative_tolerances={"peak_speed": .1})
        self.assertTrue(result["passed"])
        self.assertEqual([item["run_id"] for item in result["comparisons"]], ["coarse", "fine", "reference"])
        coarse_error = result["comparisons"][0]["metrics"]["error"]
        self.assertEqual(coarse_error["absolute_deviation"], .5)
        zero = compare_step_sweep.compare_step_sweep([{ "run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "error": 0 }, { "run_id": "other", "fixed_dt_seconds": 1, "max_substeps": 1, "error": 1 }], "ref", ["error"])
        self.assertIsNone(zero["comparisons"][0]["metrics"]["error"]["relative_deviation"])
        self.assertFalse(zero["passed"])

    def test_step_sweep_rejects_invalid_configuration_and_cli_exit_classes(self):
        records = compare_step_sweep.parse_sweep(FIXTURES / "step-sweep.csv")
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep(records, "unknown", ["error"])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep(records, "reference", ["missing"])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep(records, "reference", ["error"], absolute_tolerances={"unknown": 1})
        failed = subprocess.run([sys.executable, str(ROOT / "scripts" / "compare_step_sweep.py"), str(FIXTURES / "step-sweep.csv"), "--reference-run-id", "reference", "--metric", "error"], capture_output=True, text=True, check=False)
        self.assertEqual(failed.returncode, 1)
        invalid = subprocess.run([sys.executable, str(ROOT / "scripts" / "compare_step_sweep.py"), str(FIXTURES / "step-sweep.csv"), "--reference-run-id", "reference", "--metric", "error", "--absolute-tolerance", "error=-1"], capture_output=True, text=True, check=False)
        self.assertEqual(invalid.returncode, 2)

    def test_direct_apis_wrap_malformed_configuration_as_documented_value_errors(self):
        trace = analyze_physics_trace.parse_trace(FIXTURES / "physics-trace.jsonl")
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.summarize_trace(trace, metrics=[[]])
        with self.assertRaises(compare_replay_hashes.ReplayInputError):
            compare_replay_hashes.compare_replays(None, [])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep([], "reference", [[]])

    def test_trace_accepts_signed_metrics_and_signed_upper_thresholds(self):
        records = [{"run_id": "signed", "tick": 0, "sim_time_seconds": 0, "dt_seconds": 1, "force": -3}, {"run_id": "signed", "tick": 1, "sim_time_seconds": 1, "dt_seconds": 1, "force": -2}]
        summary = analyze_physics_trace.summarize_trace(records, ["force"], {"force": -2})
        self.assertTrue(summary["passed"])
        self.assertEqual(summary["metrics"]["force"]["max"], -2)

    def test_trace_rejects_nonfinite_csv_metrics_and_overflowed_derived_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nonfinite.csv"
            path.write_text("run_id,tick,sim_time_seconds,dt_seconds,force\na,0,0,1,NaN\n", encoding="utf-8")
            with self.assertRaises(analyze_physics_trace.TraceInputError):
                analyze_physics_trace.summarize_trace(analyze_physics_trace.parse_trace(path))
        records = [{"run_id": "large", "tick": 0, "sim_time_seconds": 0, "dt_seconds": 1, "force": 1e308}, {"run_id": "large", "tick": 1, "sim_time_seconds": 1, "dt_seconds": 1, "force": 1e308}]
        summary = analyze_physics_trace.summarize_trace(records, ["force"])
        self.assertEqual(summary["metrics"]["force"]["mean"], 1e308)
        self.assertTrue(math.isfinite(summary["metrics"]["force"]["mean"]))

    def test_trace_preserves_integer_percentile_and_max_json_types(self):
        records = analyze_physics_trace.parse_trace(FIXTURES / "physics-trace.jsonl")
        metrics = analyze_physics_trace.summarize_trace(records, ["contacts"])["metrics"]["contacts"]
        for field in ("p50", "p95", "p99", "max"):
            self.assertIsInstance(metrics[field], int)
        self.assertIsInstance(json.loads(json.dumps(metrics))["max"], int)

    def test_all_parsers_reject_invalid_utf8_with_clean_cli_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            invalid = Path(directory) / "invalid.jsonl"
            invalid.write_bytes(b"\xff")
            with self.assertRaises(analyze_physics_trace.TraceInputError):
                analyze_physics_trace.parse_trace(invalid)
            with self.assertRaises(compare_replay_hashes.ReplayInputError):
                compare_replay_hashes.parse_replay(invalid)
            with self.assertRaises(compare_step_sweep.SweepInputError):
                compare_step_sweep.parse_sweep(invalid)
            commands = [
                [sys.executable, str(ROOT / "scripts" / "analyze_physics_trace.py"), str(invalid)],
                [sys.executable, str(ROOT / "scripts" / "compare_replay_hashes.py"), str(FIXTURES / "replay-reference.jsonl"), str(invalid)],
                [sys.executable, str(ROOT / "scripts" / "compare_step_sweep.py"), str(invalid), "--reference-run-id", "reference", "--metric", "error"],
            ]
            for command in commands:
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertIn("unable to read input", result.stderr)

    def test_replay_requires_nonempty_sides_and_wraps_invalid_paths(self):
        for reference, candidate in (([], []), ([], [{"tick": 0, "state_hash": "a"}]), ([{"tick": 0, "state_hash": "a"}], [])):
            with self.assertRaises(compare_replay_hashes.ReplayInputError):
                compare_replay_hashes.compare_replays(reference, candidate)
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.parse_trace(None)
        with self.assertRaises(compare_replay_hashes.ReplayInputError):
            compare_replay_hashes.parse_replay(None)

    def test_step_sweep_enforces_substep_bounds_signed_metrics_and_roundoff_boundaries(self):
        base = {"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "error": -.3}
        observed = {"run_id": "candidate", "fixed_dt_seconds": 1, "max_substeps": 1, "error": -.4}
        result = compare_step_sweep.compare_step_sweep([base, observed], "ref", ["error"], absolute_tolerances={"error": .1})
        self.assertTrue(result["passed"])
        relative = compare_step_sweep.compare_step_sweep([{**base, "error": .3}, {**observed, "error": .33}], "ref", ["error"], relative_tolerances={"error": .1})
        self.assertTrue(relative["passed"])
        for invalid in (0, -1, True):
            with self.assertRaises(compare_step_sweep.SweepInputError):
                compare_step_sweep.compare_step_sweep([{**base, "max_substeps": invalid}], "ref", ["error"])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep([base], "ref", ["error"], absolute_tolerances={1: .1})

    def test_parsers_and_direct_apis_reject_bad_substeps_and_nonstrings_without_type_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sweep.jsonl"
            for value in (0, -1, True):
                path.write_text(json.dumps({"run_id": "r", "fixed_dt_seconds": 1, "max_substeps": value, "error": 0}) + "\n", encoding="utf-8")
                with self.assertRaises(compare_step_sweep.SweepInputError):
                    compare_step_sweep.parse_sweep(path)
            path.write_text('{"run_id":"r","fixed_dt_seconds":1,"max_substeps":1,"error":0}\n', encoding="utf-8")
            self.assertEqual(compare_step_sweep.parse_sweep(path)[0]["max_substeps"], 1)
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.summarize_trace([{"run_id": "a", "tick": 0, "sim_time_seconds": 0, "dt_seconds": 1, 1: 2}])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep([], "reference", ["error"], relative_tolerances={object(): .1})

    def test_tolerance_boundary_rejects_materially_over_limit_values(self):
        rows = [{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": .3}, {"run_id": "edge", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": .4}, {"run_id": "over", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": 1.3000000000005}]
        absolute = compare_step_sweep.compare_step_sweep(rows, "ref", ["metric"], absolute_tolerances={"metric": .1})
        self.assertTrue(next(row for row in absolute["comparisons"] if row["run_id"] == "edge")["passed"])
        self.assertFalse(next(row for row in absolute["comparisons"] if row["run_id"] == "over")["passed"])
        relative = compare_step_sweep.compare_step_sweep([{**rows[0], "metric": 1}, {**rows[1], "metric": 2}, {**rows[2], "metric": 2.0000000000005}], "ref", ["metric"], relative_tolerances={"metric": 1})
        self.assertTrue(next(row for row in relative["comparisons"] if row["run_id"] == "edge")["passed"])
        self.assertFalse(next(row for row in relative["comparisons"] if row["run_id"] == "over")["passed"])

    def test_sweep_rejects_unrepresentable_derived_values_and_cli_serialization(self):
        rows = [{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": -1e308}, {"run_id": "other", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": 1e308}]
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep(rows, "ref", ["metric"])
        tiny = [{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": 5e-324}, {"run_id": "other", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": 1e308}]
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep(tiny, "ref", ["metric"], relative_tolerances={"metric": 1})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "overflow.jsonl"
            path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(ROOT / "scripts" / "compare_step_sweep.py"), str(path), "--reference-run-id", "ref", "--metric", "metric"], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, "")
            self.assertTrue(result.stderr.strip())

    def test_numeric_conversion_rejects_huge_and_lossy_integer_inputs(self):
        huge = int("9" * 1001)
        with self.assertRaises(analyze_physics_trace.TraceInputError):
            analyze_physics_trace.summarize_trace([{"run_id": "a", "tick": huge, "sim_time_seconds": 0, "dt_seconds": 1}])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep([{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": huge}], "ref", ["metric"])
        with self.assertRaises(compare_step_sweep.SweepInputError):
            compare_step_sweep.compare_step_sweep([{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": 0}], "ref", ["metric"], absolute_tolerances={"metric": huge})
        for value in (Decimal("1.9"), Fraction(3, 2)):
            with self.assertRaises(analyze_physics_trace.TraceInputError):
                analyze_physics_trace.summarize_trace([{"run_id": "a", "tick": value, "sim_time_seconds": 0, "dt_seconds": 1}])
            with self.assertRaises(compare_replay_hashes.ReplayInputError):
                compare_replay_hashes.compare_replays([{"tick": value, "state_hash": "a"}], [{"tick": 1, "state_hash": "a"}])
            with self.assertRaises(compare_step_sweep.SweepInputError):
                compare_step_sweep.compare_step_sweep([{"run_id": "a", "fixed_dt_seconds": 1, "max_substeps": value, "metric": 0}], "a", ["metric"])

    def test_jsonl_and_csv_numeric_lexemes_produce_byte_equivalent_summary_json(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            jsonl = directory / "same.jsonl"
            csv = directory / "same.csv"
            jsonl.write_text('{"run_id":"same","tick":2,"sim_time_seconds":2,"dt_seconds":1,"contacts":2}\n', encoding="utf-8")
            csv.write_text("run_id,tick,sim_time_seconds,dt_seconds,contacts\nsame,2,2,1,2\n", encoding="utf-8")
            json_result = subprocess.run([sys.executable, str(ROOT / "scripts" / "analyze_physics_trace.py"), str(jsonl)], capture_output=True, text=True, check=False)
            csv_result = subprocess.run([sys.executable, str(ROOT / "scripts" / "analyze_physics_trace.py"), str(csv)], capture_output=True, text=True, check=False)
            self.assertEqual(json_result.returncode, 0)
            self.assertEqual(csv_result.returncode, 0)
            self.assertEqual(json_result.stdout, csv_result.stdout)

    def test_step_tolerances_use_exact_canonical_decimal_values(self):
        def compare(reference, observed, absolute=None, relative=None):
            return compare_step_sweep.compare_step_sweep(
                [{"run_id": "ref", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": reference}, {"run_id": "candidate", "fixed_dt_seconds": 1, "max_substeps": 1, "metric": observed}],
                "ref", ["metric"], absolute_tolerances=absolute, relative_tolerances=relative,
            )["passed"]

        self.assertTrue(compare(.3, .4, absolute={"metric": .1}))
        self.assertFalse(compare(10**16, 10**16 + 2, absolute={"metric": 1}))
        self.assertFalse(compare(-(10**16), -(10**16) - 2, absolute={"metric": 1}))
        self.assertFalse(compare(10**16, 10**16 + 2, absolute={"metric": 0}))
        self.assertFalse(compare(10**16, 10**16 + 2, relative={"metric": 1e-16}))
        self.assertFalse(compare(10**16, 10**16 + 2, relative={"metric": 0}))
        next_float = math.nextafter(1e20, math.inf)
        self.assertFalse(compare(1e20, next_float, absolute={"metric": 0}))
        self.assertFalse(compare(1e20, next_float, relative={"metric": 0}))
        self.assertTrue(compare(10**16, 10**16, absolute={"metric": 0}, relative={"metric": 0}))


if __name__ == "__main__":
    unittest.main()
