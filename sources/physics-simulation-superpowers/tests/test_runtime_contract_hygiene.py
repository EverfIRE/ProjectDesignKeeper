"""Cross-skill runtime, provenance, and self-containment release gates."""

import importlib.util
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "references" / "sources.lock.json"
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"
THIS_TEST = Path(__file__).resolve()

BUDGET_RUNTIME_FILES = (
    "skills/rigid-body-collision-contact/SKILL.md",
    "skills/constraints-ragdolls-active-physics/SKILL.md",
    "skills/character-controller-movement/SKILL.md",
    "skills/vehicle-physics/SKILL.md",
    "skills/cloth-rope-soft-bodies/SKILL.md",
    "skills/destruction-fracture-fields/SKILL.md",
    "skills/real-time-fluids-particles/SKILL.md",
    "skills/networked-deterministic-physics/SKILL.md",
    "skills/debugging-testing-physics/SKILL.md",
    "skills/profiling-scaling-physics/SKILL.md",
    "skills/unreal-chaos-physics/SKILL.md",
    "skills/unity-real-time-physics/references/unity-physics.md",
    "skills/unreal-chaos-physics/references/unreal-chaos.md",
)
TEXT_SUFFIXES = {".json", ".md", ".py", ".txt", ".yaml", ".yml"}
LEDGER_FILES = {
    ROOT / "references" / "source-audit.md",
    LOCK,
    THIS_TEST,
    ROOT / "tests" / "test_source_governance.py",
}


def load_packager():
    path = ROOT / "scripts" / "package_plugin.py"
    spec = importlib.util.spec_from_file_location("physics_plugin_packager", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class RuntimeContractHygieneTests(unittest.TestCase):
    def test_numeric_budget_gates_are_scoped_to_the_active_request(self):
        numeric_gate = re.compile(
            r"p95[^.\n]{0,48}(?:<=|≤|at or below)\s*[1-4](?:\.0)?\s*(?:ms|-ms)",
            re.IGNORECASE,
        )
        for relative in BUDGET_RUNTIME_FILES:
            with self.subTest(path=relative):
                text = (ROOT / relative).read_text(encoding="utf-8")
                compact = text.casefold()
                self.assertIn("active request", compact)
                self.assertRegex(
                    compact,
                    r"(?:undeclared|not declared).{0,80}block(?:s|ed)? acceptance",
                )
                matches = list(numeric_gate.finditer(text))
                self.assertTrue(matches, "expected the bundled evaluation gate")
                for match in matches:
                    line_start = text.rfind("\n", 0, match.start()) + 1
                    line_end = text.find("\n", match.end())
                    if line_end == -1:
                        line_end = len(text)
                    self.assertIn(
                        "bundled evaluation",
                        text[line_start:line_end].casefold(),
                        f"unscoped numeric gate: {match.group(0)}",
                    )

    def test_assertive_cadences_are_scoped_to_bundled_evaluation(self):
        assertive_cadence = re.compile(
            r"\b(?:stays?|remains?|runs?|uses?|preserves?|fixed)\b[^.\n]{0,48}"
            r"60[- ]hz",
            re.IGNORECASE,
        )
        for relative in BUDGET_RUNTIME_FILES:
            with self.subTest(path=relative):
                text = (ROOT / relative).read_text(encoding="utf-8")
                for line in text.splitlines():
                    if assertive_cadence.search(line):
                        self.assertIn(
                            "bundled evaluation",
                            line.casefold(),
                            f"unscoped cadence: {line}",
                        )

        text = (
            ROOT / "skills" / "networked-deterministic-physics" / "SKILL.md"
        ).read_text(encoding="utf-8")
        self.assertNotIn("Run a 60 Hz gameplay tick.", text)
        self.assertRegex(
            text.casefold(),
            r"active request.{0,80}gameplay tick.{0,80}bundled evaluation.{0,40}60 hz",
        )

    def test_rejected_sources_cannot_enter_the_real_package_input(self):
        lock = json.loads(LOCK.read_text(encoding="utf-8"))
        rejected = [source for source in lock["sources"] if source["decision"] == "rejected"]
        self.assertTrue(rejected)
        packager = load_packager()
        package_files = [
            ROOT / relative
            for relative in packager.collect_files(ROOT)
            if (ROOT / relative).suffix.casefold() in TEXT_SUFFIXES
            and (ROOT / relative).resolve() not in LEDGER_FILES
        ]
        for source in rejected:
            markers = source.get("runtime_exclusion_markers")
            self.assertIsInstance(markers, list, source["id"])
            self.assertTrue(markers, source["id"])
            self.assertTrue(all(isinstance(marker, str) and marker for marker in markers))
            for marker in (source["id"], source["url"], *markers):
                leaked = [
                    path.relative_to(ROOT).as_posix()
                    for path in package_files
                    if marker.casefold()
                    in path.read_text(encoding="utf-8", errors="strict").casefold()
                ]
                self.assertEqual(leaked, [], f"rejected marker leaked: {marker}")

    def test_rapier_javascript_has_an_independent_locked_identity_and_notice(self):
        lock = json.loads(LOCK.read_text(encoding="utf-8"))
        sources = {source["id"]: source for source in lock["sources"]}
        source = sources["rapier-js-0-20-0"]
        self.assertEqual(source["decision"], "adopted")
        self.assertEqual(source["authority"], "official")
        self.assertEqual(source["identity"]["version"], "js-v0.20.0 / npm 0.20.0")
        self.assertEqual(
            source["identity"]["commit"],
            "3e12c2679cb1940a876bde93af9cec0cf2f57944",
        )
        self.assertEqual(source["license"]["spdx"], "Apache-2.0")
        self.assertEqual(source["license"]["content_use"], "reference-only")
        self.assertIn("rapier-js-0-20-0", NOTICES.read_text(encoding="utf-8"))

    def test_shipped_skill_documents_do_not_reference_internal_task_numbers(self):
        task_reference = re.compile(r"\bTask[- ]?\d+\b", re.IGNORECASE)
        leaked = []
        for path in sorted((ROOT / "skills").rglob("*.md")):
            if task_reference.search(path.read_text(encoding="utf-8")):
                leaked.append(path.relative_to(ROOT).as_posix())
        self.assertEqual(leaked, [])

    def test_validate_run_manifest_help_is_discoverable(self):
        completed = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_run_manifest.py"), "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("usage:", completed.stdout.casefold())


if __name__ == "__main__":
    unittest.main()
