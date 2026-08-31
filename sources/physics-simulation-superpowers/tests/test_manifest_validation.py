import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "manifests"
sys.path.insert(0, str(ROOT / "scripts"))

import validate_research_artifact
import validate_run_manifest


def load_fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as fixture:
        return json.load(fixture)


class ManifestValidationTests(unittest.TestCase):
    def test_physics_run_accepts_valid_document(self):
        self.assertEqual(
            validate_run_manifest.validate_document(
                "physics-run", load_fixture("physics-run-valid.json")
            ),
            [],
        )

    def test_physics_run_reports_nonpositive_timestep_and_boolean_seed(self):
        diagnostics = validate_run_manifest.validate_document(
            "physics-run", load_fixture("physics-run-invalid-timestep.json")
        )
        self.assertIn("timing.fixed_dt_seconds must be > 0", diagnostics)
        self.assertIn("seed must be an integer", diagnostics)

    def test_physics_run_reports_missing_required_field(self):
        diagnostics = validate_run_manifest.validate_document(
            "physics-run", load_fixture("physics-run-invalid-missing.json")
        )
        self.assertIn("platform is required", diagnostics)

    def test_paper_record_accepts_valid_document(self):
        self.assertEqual(
            validate_research_artifact.validate_document(
                "paper-record", load_fixture("paper-record-valid.json")
            ),
            [],
        )

    def test_paper_record_reports_missing_claim_evidence(self):
        diagnostics = validate_research_artifact.validate_document(
            "paper-record", load_fixture("paper-record-invalid-evidence.json")
        )
        self.assertIn("claims[0].evidence_anchors must be a nonempty array", diagnostics)

    def test_paper_record_reports_out_of_range_confidence(self):
        diagnostics = validate_research_artifact.validate_document(
            "paper-record", load_fixture("paper-record-invalid-confidence.json")
        )
        self.assertIn("confidence must be between 0 and 1", diagnostics)

    def test_experiment_plan_accepts_valid_document(self):
        self.assertEqual(
            validate_research_artifact.validate_document(
                "experiment-plan", load_fixture("experiment-plan-valid.json")
            ),
            [],
        )

    def test_experiment_plan_reports_empty_baselines(self):
        diagnostics = validate_research_artifact.validate_document(
            "experiment-plan", load_fixture("experiment-plan-invalid-baselines.json")
        )
        self.assertIn("baselines must be a nonempty array", diagnostics)

    def test_experiment_plan_reports_invalid_repetitions(self):
        diagnostics = validate_research_artifact.validate_document(
            "experiment-plan", load_fixture("experiment-plan-invalid-repetitions.json")
        )
        self.assertIn("repetitions must be an integer >= 1", diagnostics)

    def test_reproduction_run_accepts_valid_document(self):
        self.assertEqual(
            validate_research_artifact.validate_document(
                "reproduction-run", load_fixture("reproduction-run-valid.json")
            ),
            [],
        )

    def test_reproduction_run_accepts_honest_blocked_numeric_target(self):
        self.assertEqual(
            validate_research_artifact.validate_document(
                "reproduction-run", load_fixture("reproduction-run-blocked.json")
            ),
            [],
        )

    def test_reproduction_run_limits_null_to_non_evaluated_blocked_or_fail(self):
        blocked = load_fixture("reproduction-run-blocked.json")

        numeric_placeholder = json.loads(json.dumps(blocked))
        numeric_placeholder["observed_results"][0]["observed"] = 0
        self.assertIn(
            "observed_results[0].observed must be null when outcome is not-evaluated",
            validate_research_artifact.validate_document(
                "reproduction-run", numeric_placeholder
            ),
        )

        evaluated_null = json.loads(json.dumps(blocked))
        evaluated_null["observed_results"][0]["outcome"] = "mismatch"
        self.assertIn(
            "observed_results[0].observed must be a finite number",
            validate_research_artifact.validate_document(
                "reproduction-run", evaluated_null
            ),
        )

        partial = json.loads(json.dumps(blocked))
        partial["status"] = "partial"
        self.assertIn(
            "not-evaluated observations require status blocked or fail",
            validate_research_artifact.validate_document("reproduction-run", partial),
        )

        failed_before_measurement = json.loads(json.dumps(blocked))
        failed_before_measurement["status"] = "fail"
        self.assertEqual(
            validate_research_artifact.validate_document(
                "reproduction-run", failed_before_measurement
            ),
            [],
        )

    def test_reproduction_run_status_must_match_target_evaluation_state(self):
        blocked = load_fixture("reproduction-run-blocked.json")
        measured_blocked = json.loads(json.dumps(blocked))
        measured_blocked["observed_results"][0]["observed"] = 1.8
        measured_blocked["observed_results"][0]["outcome"] = "exact-match"
        self.assertIn(
            "status blocked requires the target outcome to be not-evaluated",
            validate_research_artifact.validate_document(
                "reproduction-run", measured_blocked
            ),
        )

        passing_fail = load_fixture("reproduction-run-valid.json")
        passing_fail["status"] = "fail"
        self.assertIn(
            "status fail requires a target mismatch or not-evaluated outcome",
            validate_research_artifact.validate_document(
                "reproduction-run", passing_fail
            ),
        )

        mismatching_fail = load_fixture("reproduction-run-valid.json")
        mismatching_fail["status"] = "fail"
        mismatching_fail["observed_results"][0]["outcome"] = "mismatch"
        self.assertEqual(
            validate_research_artifact.validate_document(
                "reproduction-run", mismatching_fail
            ),
            [],
        )

        conflicting_fail = load_fixture("reproduction-run-blocked.json")
        conflicting_fail["status"] = "fail"
        second = json.loads(json.dumps(conflicting_fail["observed_results"][0]))
        second["observed"] = 1.0
        second["outcome"] = "mismatch"
        conflicting_fail["observed_results"].append(second)
        self.assertIn(
            "observed_results[1].claim_id duplicates observed_results[0].claim_id",
            validate_research_artifact.validate_document(
                "reproduction-run", conflicting_fail
            ),
        )

        measured_partial = load_fixture("reproduction-run-valid.json")
        measured_partial["status"] = "partial"
        self.assertEqual(
            validate_research_artifact.validate_document(
                "reproduction-run", measured_partial
            ),
            [],
        )

    def test_reproduction_run_rejects_false_pass(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-false-pass.json")
        )
        self.assertIn(
            "observed_results must contain an eligible target comparison when status is pass",
            diagnostics,
        )
        self.assertIn("evidence_paths must be a nonempty array when status is pass", diagnostics)

    def test_reproduction_target_rejects_unknown_nested_keys_and_blank_locator(self):
        document = load_fixture("reproduction-run-valid.json")
        document["target"]["source_anchor"]["unexpected"] = True
        document["target"]["source_anchor"]["locator"] = "   "
        diagnostics = validate_research_artifact.validate_document("reproduction-run", document)
        self.assertIn("target.source_anchor.unexpected is not allowed", diagnostics)
        self.assertIn("target.source_anchor.locator must be a nonempty string", diagnostics)

    def test_reproduction_pass_requires_the_target_claim_not_supporting_claims(self):
        document = load_fixture("reproduction-run-valid.json")
        document["observed_results"][0]["outcome"] = "mismatch"
        document["expected_results"].append({"claim_id":"supporting","result_type":"numeric-measurement","metric":"supporting metric","expected":1})
        document["observed_results"].append({"claim_id":"supporting","result_type":"numeric-measurement","metric":"supporting metric","observed":1,"outcome":"exact-match","evidence_path":"results/table2.json"})
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_target_rejects_environment_readiness_counterexample(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-target-readiness.json")
        )
        self.assertIn("target.description must not describe preflight/lifecycle work", diagnostics)
        self.assertIn("expected_results[0].metric must not describe preflight/lifecycle work", diagnostics)
        self.assertIn("observed_results must contain an eligible target comparison when status is pass", diagnostics)

    def test_reproduction_target_handles_unhashable_category_without_raising(self):
        document = load_fixture("reproduction-run-valid.json")
        document["target"]["category"] = []
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["target.category must be one of: reported-numeric-result, reported-performance-result, reported-figure-result", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_target_rejects_preflight_description(self):
        document = load_fixture("reproduction-run-valid.json")
        document["target"]["description"] = "Preflight numeric validation result"
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["target.description must not describe preflight/lifecycle work", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_run_rejects_build_only_string_observation(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-build-only.json")
        )
        self.assertIn("observed_results[0] must be an object", diagnostics)
        self.assertIn(
            "observed_results must contain an eligible target comparison when status is pass",
            diagnostics,
        )

    def test_reproduction_run_accepts_structured_measured_result(self):
        document = load_fixture("reproduction-run-valid.json")
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document), []
        )

    def test_reproduction_run_requires_claim_linked_comparison_result(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-build-status.json")
        )
        self.assertIn("observed_results[0].claim_id is required", diagnostics)
        self.assertIn("observed_results[0].result_type is required", diagnostics)
        self.assertIn("observed_results[0].observed is required", diagnostics)
        self.assertIn("observed_results must contain an eligible target comparison when status is pass", diagnostics)

    def test_reproduction_run_rejects_duplicate_expected_claim_ids(self):
        document = load_fixture("reproduction-run-valid.json")
        document["expected_results"].append(document["expected_results"][0].copy())
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["expected_results[1].claim_id duplicates expected_results[0].claim_id", "target.claim_id must reference exactly one expected_results entry", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_run_requires_observed_results_to_match_registered_claim(self):
        document = load_fixture("reproduction-run-valid.json")
        document["observed_results"][0]["metric"] = "different metric"
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["observed_results[0].metric must match expected_results claim_id penetration-table-2", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_run_rejects_lifecycle_only_claims_and_observations(self):
        observed_only = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-build-status.json")
        )
        self.assertIn("observed_results[0].claim_id is required", observed_only)
        self.assertIn("observed_results must contain an eligible target comparison when status is pass", observed_only)
        structured = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-lifecycle-claim.json")
        )
        self.assertIn("observed_results must contain an eligible target comparison when status is pass", structured)
        self.assertIn("observed_results must contain an eligible target comparison when status is pass", structured)

    def test_reproduction_run_handles_invalid_evidence_paths_without_passing(self):
        document = load_fixture("reproduction-run-valid.json")
        document["evidence_paths"] = "results/table2.json"
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["evidence_paths must be a nonempty array", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_pass_requires_comparison_evidence_in_top_level_paths(self):
        document = load_fixture("reproduction-run-valid.json")
        document["observed_results"][0]["evidence_path"] = "results/unlisted.json"
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["observed_results[0].evidence_path must appear in evidence_paths", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_reproduction_run_reports_invalid_mode(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-invalid-mode.json")
        )
        self.assertIn(
            "reproduction_mode must be one of: artifact-rerun, independent-reimplementation",
            diagnostics,
        )

    def test_reproduction_run_handles_unhashable_claim_id_without_raising(self):
        document = load_fixture("reproduction-run-valid.json")
        document["observed_results"][0]["claim_id"] = []
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["observed_results[0].claim_id must be a nonempty string", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_qualitative_behavior_cannot_independently_pass(self):
        diagnostics = validate_research_artifact.validate_document(
            "reproduction-run", load_fixture("reproduction-run-qualitative-environment.json")
        )
        self.assertEqual(
            diagnostics,
            ["observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_result_type_specific_values_are_enforced(self):
        document = load_fixture("reproduction-run-valid.json")
        document["expected_results"][0]["expected"] = "0.9"
        document["observed_results"][0]["observed"] = "0.8"
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", document),
            ["expected_results[0].expected must be a finite number", "observed_results[0].observed must be a finite number", "observed_results must contain an eligible target comparison when status is pass"],
        )

    def test_run_cli_prints_each_diagnostic_and_returns_two(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_run_manifest.py"), str(FIXTURES / "physics-run-invalid-timestep.json")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(
            result.stdout.splitlines(),
            ["timing.fixed_dt_seconds must be > 0", "seed must be an integer"],
        )

    def test_research_cli_returns_zero_for_valid_document(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_research_artifact.py"), "paper-record", str(FIXTURES / "paper-record-valid.json")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_research_cli_rejects_unknown_kind(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_research_artifact.py"), "unknown", str(FIXTURES / "paper-record-valid.json")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout.splitlines(), ["kind must be one of: paper-record, experiment-plan, reproduction-run"])

    def test_validators_reject_unknown_keys_at_fixed_shape_boundaries(self):
        physics = load_fixture("physics-run-valid.json")
        physics["unexpected"] = 1
        physics["timing"]["unexpected"] = 1
        physics["budget"]["unexpected"] = 1
        self.assertEqual(
            validate_run_manifest.validate_document("physics-run", physics),
            ["unexpected is not allowed", "timing.unexpected is not allowed", "budget.unexpected is not allowed"],
        )
        paper = load_fixture("paper-record-valid.json")
        paper["unexpected"] = 1
        paper["paper"]["unexpected"] = 1
        paper["claims"][0]["unexpected"] = 1
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", paper),
            ["unexpected is not allowed", "paper.unexpected is not allowed", "claims[0].unexpected is not allowed"],
        )
        plan = load_fixture("experiment-plan-valid.json")
        plan["unexpected"] = 1
        self.assertEqual(
            validate_research_artifact.validate_document("experiment-plan", plan),
            ["unexpected is not allowed"],
        )
        reproduction = load_fixture("reproduction-run-valid.json")
        reproduction["unexpected"] = 1
        reproduction["artifact"]["unexpected"] = 1
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", reproduction),
            ["unexpected is not allowed", "artifact.unexpected is not allowed"],
        )

    def test_validators_reject_invalid_nested_array_items(self):
        paper = load_fixture("paper-record-valid.json")
        paper["paper"]["authors"] = [""]
        paper["claims"][0]["evidence_anchors"] = [""]
        paper["methods_assumptions"] = [""]
        paper["experimental_conditions"] = [""]
        paper["limitations"] = [""]
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", paper),
            [
                "paper.authors[0] must be a nonempty string",
                "claims[0].evidence_anchors[0] must be a nonempty string",
                "methods_assumptions[0] must be a nonempty string",
                "experimental_conditions[0] must be a nonempty string",
                "limitations[0] must be a nonempty string",
            ],
        )
        plan = load_fixture("experiment-plan-valid.json")
        plan["independent_variables"] = [""]
        plan["seeds"] = [True]
        self.assertEqual(
            validate_research_artifact.validate_document("experiment-plan", plan),
            ["independent_variables[0] must be a nonempty string", "seeds[0] must be an integer"],
        )
        reproduction = load_fixture("reproduction-run-valid.json")
        reproduction["commands"] = [""]
        self.assertEqual(
            validate_research_artifact.validate_document("reproduction-run", reproduction), ["commands[0] must be a nonempty string"]
        )

    def test_physics_run_rejects_nonfinite_numbers(self):
        document = load_fixture("physics-run-valid.json")
        document["timing"]["fixed_dt_seconds"] = float("nan")
        document["budget"]["cpu_ms"] = float("inf")
        self.assertEqual(
            validate_run_manifest.validate_document("physics-run", document),
            ["timing.fixed_dt_seconds must be a finite number", "budget.cpu_ms must be a finite number"],
        )

    def test_research_validator_rejects_nonfinite_confidence(self):
        document = load_fixture("paper-record-valid.json")
        document["confidence"] = float("nan")
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", document), ["confidence must be between 0 and 1"]
        )

    def test_run_cli_rejects_nonstandard_json_constants(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_run_manifest.py"), str(FIXTURES / "physics-run-invalid-nan.json")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout.splitlines(), ["unable to parse JSON: nonstandard constant NaN"])

    def test_validators_report_nonstring_direct_api_keys_without_raising(self):
        physics = load_fixture("physics-run-valid.json")
        physics[1] = "unexpected"
        physics["timing"][2] = "unexpected"
        self.assertEqual(
            validate_run_manifest.validate_document("physics-run", physics),
            ["key 1 must be a string", "timing.key 2 must be a string"],
        )
        paper = load_fixture("paper-record-valid.json")
        paper[1] = "unexpected"
        paper["paper"][2] = "unexpected"
        paper["claims"][0][3] = "unexpected"
        self.assertEqual(
            validate_research_artifact.validate_document("paper-record", paper),
            ["key 1 must be a string", "paper.key 2 must be a string", "claims[0].key 3 must be a string"],
        )

    def test_validators_report_object_keys_without_memory_addresses(self):
        physics = load_fixture("physics-run-valid.json")
        physics[object()] = "unexpected"
        physics_diagnostics = validate_run_manifest.validate_document("physics-run", physics)
        paper = load_fixture("paper-record-valid.json")
        paper["paper"][object()] = "unexpected"
        paper_diagnostics = validate_research_artifact.validate_document("paper-record", paper)
        self.assertEqual(physics_diagnostics, ["key object must be a string"])
        self.assertEqual(paper_diagnostics, ["paper.key object must be a string"])
        self.assertNotIn("0x", "\n".join(physics_diagnostics + paper_diagnostics))

    def test_schemas_require_nonwhitespace_for_runtime_nonempty_strings(self):
        schemas = {
            path.stem.replace(".schema", ""): json.loads(path.read_text(encoding="utf-8"))
            for path in (ROOT / "schemas").glob("*.schema.json")
        }
        self.assertEqual(schemas["physics-run"]["properties"]["run_id"]["pattern"], r"\S")
        self.assertEqual(schemas["physics-run"]["properties"]["timing"]["properties"]["fixed_dt_seconds"].get("pattern"), None)
        self.assertEqual(schemas["paper-record"]["properties"]["paper"]["properties"]["title"]["pattern"], r"\S")
        self.assertEqual(schemas["paper-record"]["properties"]["paper"]["properties"]["authors"]["items"]["pattern"], r"\S")
        self.assertEqual(schemas["experiment-plan"]["properties"]["baselines"]["items"]["pattern"], r"\S")
        result_properties = schemas["reproduction-run"]["properties"]["observed_results"]["items"]["properties"]
        expected_properties = schemas["reproduction-run"]["properties"]["expected_results"]["items"]["properties"]
        target_properties = schemas["reproduction-run"]["properties"]["target"]["properties"]
        self.assertEqual(target_properties["claim_id"]["pattern"], r"\S")
        self.assertEqual(target_properties["source_anchor"]["properties"]["locator"]["pattern"], r"\S")
        self.assertFalse("claim_anchor" in expected_properties)
        self.assertEqual(expected_properties["claim_id"]["pattern"], r"\S")
        self.assertEqual(result_properties["claim_id"]["pattern"], r"\S")
        self.assertEqual(result_properties["evidence_path"]["pattern"], r"\S")
        self.assertIn({"type": "null"}, result_properties["observed"]["anyOf"])
        self.assertTrue(schemas["reproduction-run"]["properties"]["expected_results"]["items"]["allOf"])
        self.assertTrue(schemas["reproduction-run"]["properties"]["observed_results"]["items"]["allOf"])


if __name__ == "__main__":
    unittest.main()
