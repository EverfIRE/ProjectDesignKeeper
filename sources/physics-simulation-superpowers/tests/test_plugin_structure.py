"""Integration checks for the plugin discovery manifest."""

import json
from pathlib import Path
import unittest


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = PLUGIN_ROOT / ".codex-plugin" / "plugin.json"


class PluginStructureTests(unittest.TestCase):
    def test_manifest_exposes_the_physics_simulation_plugin_contract(self) -> None:
        """A discoverable plugin advertises the requested public interface."""
        with MANIFEST_PATH.open(encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)

        self.assertEqual("physics-simulation-superpowers", manifest["name"])
        self.assertEqual("0.1.0", manifest["version"])
        self.assertEqual("Apache-2.0", manifest["license"])
        self.assertEqual("./skills/", manifest["skills"])
        self.assertTrue((PLUGIN_ROOT / manifest["skills"]).is_dir())

        interface = manifest["interface"]
        self.assertEqual("Physics Simulation Superpowers", interface["displayName"])
        self.assertEqual("Developer Tools", interface["category"])
        self.assertEqual(["Research", "Analysis", "Code"], interface["capabilities"])

        prompts = interface["defaultPrompt"]
        self.assertIsInstance(prompts, list)
        self.assertTrue(prompts)
        self.assertLessEqual(len(prompts), 3)
        self.assertTrue(
            all(
                isinstance(prompt, str)
                and any("\u4e00" <= character <= "\u9fff" for character in prompt)
                for prompt in prompts
            )
        )
        self.assertNotIn("mcp", manifest)
        self.assertNotIn("mcpServers", manifest)
        self.assertNotIn("apps", manifest)


class EvaluationContractTests(unittest.TestCase):
    def test_evaluation_record_requires_complete_observable_outcomes(self) -> None:
        """Missing outcome evidence is rejected instead of producing a false pass."""
        from tests.evaluation_contract import validate_evaluation_record

        valid_record = {
            "skill": "rigid-body-collision-contact",
            "scenario": "A projectile tunnels through a thin wall.",
            "baseline": {
                "response": "Increase the collision radius.",
                "observations": "No diagnosis or measurement plan.",
            },
            "enabled": {
                "response": "Check CCD, timestep, and collision shape.",
                "observations": "Includes a measurable replay check.",
            },
            "verdict": "pass",
            "evidence": ["evaluation transcript"],
        }

        self.assertEqual([], validate_evaluation_record(valid_record))

        invalid_cases = [
            ("non-dictionary record", [], "evaluation record must be a dictionary"),
            ("missing skill", {**valid_record, "skill": None}, "skill must be a nonempty string"),
            ("blank skill", {**valid_record, "skill": " "}, "skill must be a nonempty string"),
            ("missing scenario", {**valid_record, "scenario": None}, "scenario must be a nonempty string"),
            ("blank scenario", {**valid_record, "scenario": " "}, "scenario must be a nonempty string"),
            ("non-dictionary baseline", {**valid_record, "baseline": []}, "baseline must be a dictionary"),
            ("non-dictionary enabled", {**valid_record, "enabled": []}, "enabled must be a dictionary"),
            ("missing baseline response", {**valid_record, "baseline": {"observations": "Observed."}}, "baseline.response must be a nonempty string"),
            ("blank baseline response", {**valid_record, "baseline": {"response": " ", "observations": "Observed."}}, "baseline.response must be a nonempty string"),
            ("missing baseline observations", {**valid_record, "baseline": {"response": "Responded."}}, "baseline.observations must be a nonempty string"),
            ("blank baseline observations", {**valid_record, "baseline": {"response": "Responded.", "observations": " "}}, "baseline.observations must be a nonempty string"),
            ("missing enabled response", {**valid_record, "enabled": {"observations": "Observed."}}, "enabled.response must be a nonempty string"),
            ("blank enabled response", {**valid_record, "enabled": {"response": " ", "observations": "Observed."}}, "enabled.response must be a nonempty string"),
            ("missing enabled observations", {**valid_record, "enabled": {"response": "Responded."}}, "enabled.observations must be a nonempty string"),
            ("blank enabled observations", {**valid_record, "enabled": {"response": "Responded.", "observations": " "}}, "enabled.observations must be a nonempty string"),
            (
                "invalid verdict",
                {**valid_record, "verdict": "maybe"},
                "verdict must be 'pass', 'fail', or 'accept_with_limitations'",
            ),
            ("blank evidence", {**valid_record, "evidence": [""]}, "evidence must be a nonempty list of strings"),
        ]
        for name, record, expected_error in invalid_cases:
            with self.subTest(name=name):
                self.assertIn(expected_error, validate_evaluation_record(record))


if __name__ == "__main__":
    unittest.main()
