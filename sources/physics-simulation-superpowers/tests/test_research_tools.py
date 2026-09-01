"""Behavioral tests for deterministic research-artifact evidence tools."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
FIXTURES = ROOT / "tests" / "fixtures" / "research"
sys.path.insert(0, str(SCRIPTS))

import compare_reported_results
import inventory_artifact


class InventoryArtifactTests(unittest.TestCase):
    def run_cli(self, *arguments):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "inventory_artifact.py"), *map(str, arguments)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_inventory_hashes_literal_binary_empty_and_nested_files_in_stable_order(self):
        """A traversal/order or raw-byte hashing change must change this hand-checked manifest."""
        result = inventory_artifact.inventory_artifact(FIXTURES / "artifact-root")
        self.assertEqual(
            result,
            {
                "algorithm": "sha256",
                "file_count": 4,
                "files": [
                    {"path": "alpha.txt", "bytes": 7, "sha256": "4a31f8a329cdbbab944056fc992eeb5ab5c0b4a78c3bc34e6d7c4a59fd6cf3b6"},
                    {"path": "binary.bin", "bytes": 4, "sha256": "00cd5b13f53c4934508827192eda1a96a90e7a99115733f91a9e9b30fa0e9f54"},
                    {"path": "empty.bin", "bytes": 0, "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
                    {"path": "nested/value.txt", "bytes": 5, "sha256": "98821156c17dbfc1864e3dfbae068df1f044408162407217f078d26c4fa099ba"},
                ],
                "total_bytes": 16,
            },
        )

    def test_inventory_excludes_builtin_directories_and_caller_file_and_directory_patterns(self):
        """Dropping an exclusion or matching only basenames must expose a file in this inventory."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "artifact"
            shutil.copytree(FIXTURES / "artifact-root", root)
            for name in (".GIT", "__PYCACHE__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".venv"):
                cache = root / name
                cache.mkdir()
                (cache / "ignored.txt").write_text("ignored", encoding="utf-8")
            (root / "drop.tmp").write_text("drop", encoding="utf-8")
            (root / "reports").mkdir()
            (root / "reports" / "drop.json").write_text("drop", encoding="utf-8")
            result = inventory_artifact.inventory_artifact(root, ["*.tmp", "reports"])
        self.assertEqual([item["path"] for item in result["files"]], ["alpha.txt", "binary.bin", "empty.bin", "nested/value.txt"])

    def test_inventory_empty_directory_and_invalid_roots_and_patterns_raise_controlled_errors(self):
        """Replacing validation with raw pathlib errors must fail these public API contracts."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(inventory_artifact.inventory_artifact(root)["file_count"], 0)
            file_root = root / "file.txt"
            file_root.write_text("x", encoding="utf-8")
            for value in (root / "missing", file_root, 123, b"not-valid-utf8-path"):
                with self.assertRaises(inventory_artifact.ArtifactInventoryError):
                    inventory_artifact.inventory_artifact(value)
            for pattern in ("", "  ", "/absolute", "../parent", "nested\\child", 3):
                with self.assertRaises(inventory_artifact.ArtifactInventoryError):
                    inventory_artifact.inventory_artifact(root, [pattern])
            with self.assertRaises(inventory_artifact.ArtifactInventoryError):
                inventory_artifact.inventory_artifact(root, "*.txt")
            with self.assertRaises(inventory_artifact.ArtifactInventoryError):
                inventory_artifact.inventory_artifact(root, {"*.txt": True})

    def test_inventory_rejects_blank_roots_and_malformed_pathlike_objects(self):
        """Treating blank roots as CWD or leaking __fspath__ exceptions is unsafe."""
        class ExplodingPath:
            def __fspath__(self):
                raise RuntimeError("path conversion failed")

        class EmptyPath:
            def __fspath__(self):
                return ""

        class WhitespacePath:
            def __fspath__(self):
                return "  "

        for root in ("", "  ", EmptyPath(), WhitespacePath(), ExplodingPath()):
            with self.assertRaises(inventory_artifact.ArtifactInventoryError):
                inventory_artifact.inventory_artifact(root)
        invalid = self.run_cli("")
        self.assertEqual(invalid.returncode, 2)
        self.assertEqual(invalid.stdout, "")
        self.assertIn("root", invalid.stderr.lower())

    def test_inventory_rejects_symlink_instead_of_silently_omitting_or_following_it(self):
        """A symlink must be an actionable invalid inventory, not escaped evidence."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "artifact"
            root.mkdir()
            target = Path(directory) / "outside.txt"
            target.write_text("outside", encoding="utf-8")
            link = root / "link.txt"
            try:
                link.symlink_to(target)
            except (NotImplementedError, OSError):
                self.skipTest("symbolic links are not available in this environment")
            with self.assertRaisesRegex(inventory_artifact.ArtifactInventoryError, "symbolic link"):
                inventory_artifact.inventory_artifact(root)

    def test_inventory_slash_globs_match_root_relative_components_not_descendants(self):
        """A slash glob must not let '*' cross a nested directory boundary."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nested").mkdir()
            (root / "nested" / "top.txt").write_text("top", encoding="utf-8")
            (root / "nested" / "deep").mkdir()
            (root / "nested" / "deep" / "c.txt").write_text("deep", encoding="utf-8")
            (root / "prefix" / "nested").mkdir(parents=True)
            (root / "prefix" / "nested" / "top.txt").write_text("prefixed", encoding="utf-8")
            result = inventory_artifact.inventory_artifact(root, ["nested/*.txt"])
            recursive = inventory_artifact.inventory_artifact(root, ["nested/**/c.txt"])
        self.assertEqual(
            [record["path"] for record in result["files"]],
            ["nested/deep/c.txt", "prefix/nested/top.txt"],
        )
        self.assertEqual(
            [record["path"] for record in recursive["files"]],
            ["nested/top.txt", "prefix/nested/top.txt"],
        )

    @unittest.skipUnless(sys.platform == "win32", "junctions are a Windows filesystem feature")
    def test_inventory_rejects_root_and_nested_junctions_when_supported(self):
        """A junction must be rejected before root resolution or nested traversal."""
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            target = directory / "target"
            target.mkdir()
            (target / "evidence.txt").write_text("evidence", encoding="utf-8")
            root_junction = directory / "root-junction"
            nested_root = directory / "nested-root"
            nested_root.mkdir()
            nested_junction = nested_root / "junction"

            def make_junction(link):
                result = subprocess.run(
                    ["cmd", "/c", "mklink", "/J", str(link), str(target)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode != 0 or inventory_artifact._link_or_reparse_kind(link) not in {"junction", "reparse point"}:
                    self.skipTest("junction creation is not available in this environment")

            make_junction(root_junction)
            with self.assertRaisesRegex(inventory_artifact.ArtifactInventoryError, "junction|reparse"):
                inventory_artifact.inventory_artifact(root_junction)
            make_junction(nested_junction)
            with self.assertRaisesRegex(inventory_artifact.ArtifactInventoryError, "junction|reparse"):
                inventory_artifact.inventory_artifact(nested_root)

    def test_inventory_cli_is_compact_deterministic_and_uses_zero_or_two(self):
        """Changing JSON formatting, output stream, or invalid-input exit handling must fail here."""
        first = self.run_cli(FIXTURES / "artifact-root")
        second = self.run_cli(FIXTURES / "artifact-root")
        self.assertEqual(first.returncode, 0)
        self.assertEqual(first.stderr, "")
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(first.stdout, json.dumps(json.loads(first.stdout), sort_keys=True, separators=(",", ":")) + "\n")
        invalid = self.run_cli(FIXTURES / "missing")
        self.assertEqual(invalid.returncode, 2)
        self.assertEqual(invalid.stdout, "")
        self.assertIn("root", invalid.stderr.lower())
        invalid_pattern = self.run_cli(FIXTURES / "artifact-root", "--exclude", "../escape")
        self.assertEqual(invalid_pattern.returncode, 2)
        self.assertEqual(invalid_pattern.stdout, "")


class CompareReportedResultsTests(unittest.TestCase):
    def run_cli(self, input_path):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "compare_reported_results.py"), str(input_path)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_exact_scalar_match_and_mismatch_without_tolerance(self):
        """Removing exact comparison must make the mismatch incorrectly pass."""
        exact = compare_reported_results.compare_results(2, 2)
        mismatch = compare_reported_results.compare_results(1, 1.2)
        self.assertTrue(exact["passed"])
        self.assertFalse(mismatch["passed"])
        self.assertIsNone(exact["absolute_within_tolerance"])
        self.assertIsNone(exact["relative_within_tolerance"])
        self.assertIsNone(exact["observed"]["sample_standard_deviation"])
        self.assertEqual(mismatch["absolute_error"], 0.2)

    def test_decimal_absolute_boundary_and_slight_overage_are_distinguished(self):
        """Using binary float tolerance decisions would fail this 0.4 - 0.3 boundary."""
        boundary = compare_reported_results.compare_results(0.3, 0.4, absolute_tolerance=0.1)
        overage = compare_reported_results.compare_results(0.3, 0.4000001, absolute_tolerance=0.1)
        self.assertTrue(boundary["passed"])
        self.assertTrue(boundary["absolute_within_tolerance"])
        self.assertFalse(overage["passed"])

    def test_cli_preserves_decimal_lexemes_for_tolerance_decisions_and_output(self):
        """Parsing JSON through float would erase the materially over-tolerance digits."""
        direct = compare_reported_results.compare_results(
            Decimal("0.3"),
            Decimal("0.4000000000000000000000000000000000000001"),
            Decimal("0.1"),
        )
        self.assertFalse(direct["passed"])
        self.assertIsInstance(direct["observed"]["mean"], Decimal)
        with tempfile.TemporaryDirectory() as directory:
            request = Path(directory) / "precise.json"
            request.write_text(
                '{"reported":0.3,"observed":0.4000000000000000000000000000000000000001,"absolute_tolerance":0.1}',
                encoding="utf-8",
            )
            result = self.run_cli(request)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr, "")
        payload = json.loads(result.stdout, parse_float=Decimal)
        self.assertFalse(payload["passed"])
        self.assertEqual(payload["observed"]["mean"], Decimal("0.4000000000000000000000000000000000000001"))

    def test_subnormal_derived_statistics_never_serialize_as_zero(self):
        """Rounding a nonzero subnormal mean/error to 0.0 is a false exact match."""
        direct = compare_reported_results.compare_results(0.0, [5e-324, 0.0, 0.0])
        self.assertNotEqual(direct["observed"]["mean"], 0)
        self.assertNotEqual(direct["signed_error"], 0)
        with tempfile.TemporaryDirectory() as directory:
            request = Path(directory) / "subnormal.json"
            request.write_text('{"reported":0.0,"observed":[5e-324,0.0,0.0]}', encoding="utf-8")
            result = self.run_cli(request)
        self.assertEqual(result.returncode, 1)
        payload = json.loads(result.stdout, parse_float=Decimal)
        self.assertNotEqual(payload["observed"]["mean"], 0)
        self.assertNotIn('"mean":0.0', result.stdout)

    def test_zero_decimal_quantums_do_not_overflow_precision_or_change_exact_match(self):
        """A zero's presentation exponent is not a computational precision requirement."""
        extreme_zero = Decimal("0e-1000000000000000000")
        direct = compare_reported_results.compare_results(extreme_zero, extreme_zero)
        self.assertTrue(direct["passed"])
        with tempfile.TemporaryDirectory() as directory:
            request = Path(directory) / "zero-quantum.json"
            request.write_text('{"reported":0e-1000000000000000000,"observed":0e-1000000000000000000}', encoding="utf-8")
            result = self.run_cli(request)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        self.assertTrue(json.loads(result.stdout)["passed"])

    def test_cli_rejects_unrepresentable_decimal_exponents_without_traceback(self):
        """Decimal parser exceptions must become an invalid-input exit, never a traceback."""
        with tempfile.TemporaryDirectory() as directory:
            request = Path(directory) / "huge-exponent.json"
            request.write_text('{"reported":1e99999999999999999999,"observed":1}', encoding="utf-8")
            result = self.run_cli(request)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertTrue(result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_relative_tolerance_or_behavior_and_zero_reported_value(self):
        """Replacing OR with AND or dividing zero reports must fail these outcomes."""
        passed_by_relative = compare_reported_results.compare_results(100, 110, absolute_tolerance=1, relative_tolerance=0.1)
        zero_mismatch = compare_reported_results.compare_results(0, 1, relative_tolerance=1)
        zero_match = compare_reported_results.compare_results(0, 0, relative_tolerance=0)
        self.assertTrue(passed_by_relative["passed"])
        self.assertFalse(passed_by_relative["absolute_within_tolerance"])
        self.assertTrue(passed_by_relative["relative_within_tolerance"])
        self.assertTrue(compare_reported_results.compare_results(2, (1, 3), relative_tolerance=0)["passed"])
        self.assertFalse(zero_mismatch["passed"])
        self.assertIsNone(zero_mismatch["relative_error"])
        self.assertEqual(zero_match["relative_error"], 0)

    def test_repeated_observations_have_hand_checked_summary_and_sample_standard_deviation(self):
        """Changing mean, extrema, n-1 deviation, or error sign must fail these literals."""
        result = compare_reported_results.compare_results(2, [1, 2, 3])
        self.assertEqual(
            result["observed"],
            {"count": 3, "mean": 2, "min": 1, "max": 3, "sample_standard_deviation": 1},
        )
        self.assertEqual(result["signed_error"], 0)
        self.assertEqual(result["absolute_error"], 0)
        self.assertEqual(result["relative_error"], 0)

    def test_input_validation_and_unrepresentable_derived_statistics_are_controlled(self):
        """Accepting JSON-incompatible numbers or leaking arithmetic exceptions must fail here."""
        invalid_calls = (
            (True, 1, None, None),
            (1, [], None, None),
            (1, (1, True), None, None),
            (1, "1", None, None),
            (1, 1, -1, None),
            (1, 1, float("inf"), None),
            (10 ** 400, 1, None, None),
            (Decimal("1e-1000"), 1, None, None),
        )
        for reported, observed, absolute, relative in invalid_calls:
            with self.assertRaises(compare_reported_results.ResultComparisonError):
                compare_reported_results.compare_results(reported, observed, absolute, relative)
        with self.assertRaises(compare_reported_results.ResultComparisonError):
            compare_reported_results.compare_results(0, [1.7976931348623157e308, -1.7976931348623157e308])

    def test_cli_accepts_only_declared_utf8_json_object_and_all_exit_classes(self):
        """Unexpected fields, nonstandard constants, bad UTF-8, and stdout leakage must fail here."""
        passed = self.run_cli(FIXTURES / "comparison-pass.json")
        failed = self.run_cli(FIXTURES / "comparison-fail.json")
        invalid_constant = self.run_cli(FIXTURES / "comparison-invalid-nan.json")
        self.assertEqual(passed.returncode, 0)
        self.assertEqual(failed.returncode, 1)
        self.assertEqual(invalid_constant.returncode, 2)
        self.assertEqual(invalid_constant.stdout, "")
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            unexpected = directory / "unexpected.json"
            unexpected.write_text('{"observed":1,"reported":1,"extra":true}', encoding="utf-8")
            invalid_utf8 = directory / "invalid-utf8.json"
            invalid_utf8.write_bytes(b'{"reported":1,"observed":\xff}')
            invalid_escape = directory / "invalid-escape.json"
            invalid_escape.write_bytes(b'{"reported":1,"observed":"\\xff"}')
            deeply_nested = directory / "deeply-nested.json"
            deeply_nested.write_bytes(b"[" * 10000 + b"0" + b"]" * 10000)
            for path in (unexpected, invalid_utf8, invalid_escape, deeply_nested):
                invalid = self.run_cli(path)
                self.assertEqual(invalid.returncode, 2)
                self.assertEqual(invalid.stdout, "")
                self.assertTrue(invalid.stderr)

    def test_cli_stdout_is_one_stable_compact_sorted_json_document(self):
        """Changing serialization stability or placing diagnostics on stdout must fail here."""
        first = self.run_cli(FIXTURES / "comparison-pass.json")
        second = self.run_cli(FIXTURES / "comparison-pass.json")
        self.assertEqual(first.returncode, 0)
        self.assertEqual(first.stderr, "")
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(first.stdout, json.dumps(json.loads(first.stdout), sort_keys=True, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    unittest.main()
