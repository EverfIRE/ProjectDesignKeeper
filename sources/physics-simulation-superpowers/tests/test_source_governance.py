"""Task 30 source-governance, notices, license, and Chinese-guide contracts."""

import copy
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "references" / "source-audit.md"
LOCK = ROOT / "references" / "sources.lock.json"
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"
LICENSE = ROOT / "LICENSE"
README = ROOT / "README.zh-CN.md"

GOVERNED_SKILLS = {
    "unreal-chaos-physics",
    "unity-real-time-physics",
    "godot-jolt-physics",
    "native-jolt-physics",
    "nvidia-physx-sdk",
    "rapier-physics",
    "box2d-physics",
    "surveying-real-time-physics-research",
    "reviewing-simulation-papers",
    "designing-simulation-experiments",
    "analyzing-simulation-evidence",
    "reproducing-simulation-papers",
    "translating-research-to-game-physics",
}
SCORE_KEYS = {
    "correctness",
    "licensing",
    "authority",
    "real_time_relevance",
    "actionability",
    "maintainability",
}
DIRECT_ADAPTATION_LICENSES = {
    "Apache-2.0",
    "MIT",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC-BY-4.0",
}
SCRIPT_PATHS = (
    "scripts/analyze_physics_trace.py",
    "scripts/compare_replay_hashes.py",
    "scripts/compare_step_sweep.py",
    "scripts/validate_run_manifest.py",
    "scripts/validate_research_artifact.py",
    "scripts/inventory_artifact.py",
    "scripts/compare_reported_results.py",
)
USAGE_EXIT_TWO = {"scripts/validate_research_artifact.py"}


def source_errors(source: dict) -> list[str]:
    errors: list[str] = []
    required = {
        "id",
        "title",
        "url",
        "retrieved_at",
        "authority",
        "identity",
        "license",
        "score",
        "decision",
        "influenced_skills",
    }
    missing = sorted(required - set(source))
    if missing:
        return [f"missing fields: {', '.join(missing)}"]

    for field in ("id", "title", "url", "retrieved_at"):
        if not isinstance(source[field], str) or not source[field].strip():
            errors.append(f"{field} must be a nonempty string")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", source.get("id", "")):
        errors.append("id must be lowercase hyphenated")
    if not source.get("url", "").startswith("https://"):
        errors.append("url must use https")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", source.get("retrieved_at", "")):
        errors.append("retrieved_at must be YYYY-MM-DD")
    if source.get("authority") not in {"official", "primary", "community"}:
        errors.append("authority must be official, primary, or community")
    if source.get("decision") not in {"adopted", "reference-only", "rejected"}:
        errors.append("decision must be adopted, reference-only, or rejected")

    identity = source.get("identity")
    if not isinstance(identity, dict):
        errors.append("identity must be an object")
    else:
        for field in ("version", "commit"):
            if not isinstance(identity.get(field), str) or not identity[field].strip():
                errors.append(f"identity.{field} must be a nonempty string")

    license_record = source.get("license")
    if not isinstance(license_record, dict):
        errors.append("license must be an object")
        spdx = ""
        content_use = ""
    else:
        spdx = license_record.get("spdx", "")
        content_use = license_record.get("content_use", "")
        if not isinstance(spdx, str) or not spdx.strip():
            errors.append("license.spdx must be nonempty")
        if content_use not in {"reference-only", "direct-adaptation", "excluded"}:
            errors.append("license.content_use has an invalid value")
        if spdx.startswith("LicenseRef-"):
            if not license_record.get("url", "").startswith("https://"):
                errors.append("LicenseRef records require a terms URL")
            if not isinstance(license_record.get("scope"), str) or not license_record["scope"].strip():
                errors.append("LicenseRef records require a nonempty scope")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", license_record.get("verified_at", "")):
                errors.append("LicenseRef records require a verification date")
        if spdx in DIRECT_ADAPTATION_LICENSES:
            if not license_record.get("url", "").startswith("https://"):
                errors.append("permissive license claims require a verified https URL")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", license_record.get("verified_at", "")):
                errors.append("permissive license claims require a verification date")

    score = source.get("score")
    if not isinstance(score, dict):
        errors.append("score must be an object")
        score_values = {}
    else:
        score_values = {key: score.get(key) for key in SCORE_KEYS}
        if set(score) != SCORE_KEYS | {"total"}:
            errors.append("score must contain exactly the six dimensions and total")
        for key, value in score_values.items():
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 5:
                errors.append(f"score.{key} must be an integer from 0 to 5")
        numeric_values = [value for value in score_values.values() if isinstance(value, int)]
        if len(numeric_values) == len(SCORE_KEYS) and score.get("total") != sum(numeric_values):
            errors.append("score.total must equal the six dimensions")

    decision = source.get("decision")
    total = score.get("total") if isinstance(score, dict) else None
    if decision == "adopted":
        if not isinstance(total, int) or total < 24:
            errors.append("adopted sources require score >= 24/30")
        if score_values.get("correctness", 0) <= 0:
            errors.append("adopted sources require nonzero correctness")
        if score_values.get("licensing", 0) <= 0:
            errors.append("adopted sources require nonzero licensing")

    normalized_license = re.sub(r"[^a-z0-9]+", "-", spdx.casefold()).strip("-")
    incompatible = (
        not normalized_license
        or normalized_license in {"unknown", "noassertion", "none", "unlicensed", "no-license"}
        or "unknown" in normalized_license
        or "unlicensed" in normalized_license
        or "no-license" in normalized_license
        or "without-license" in normalized_license
        or re.search(r"(?:^|-)nc(?:-|$)", normalized_license) is not None
        or "non-commercial" in normalized_license
        or "noncommercial" in normalized_license
    )
    if incompatible and decision != "rejected":
        errors.append("unknown or noncommercial licenses must be rejected")
    if content_use == "direct-adaptation":
        if spdx not in DIRECT_ADAPTATION_LICENSES:
            errors.append("direct adaptation requires an approved permissive license")
        if decision != "adopted":
            errors.append("direct adaptation requires an adopted source")
    if content_use == "excluded" and decision != "rejected":
        errors.append("excluded content requires a rejected source")

    skills = source.get("influenced_skills")
    if not isinstance(skills, list) or not all(
        isinstance(skill, str) and skill.strip() for skill in skills
    ):
        errors.append("influenced_skills must be a nonempty string array")
    elif decision == "adopted":
        missing_skills = [
            skill for skill in skills if not (ROOT / "skills" / skill / "SKILL.md").is_file()
        ]
        if missing_skills:
            errors.append(f"unknown influenced skills: {missing_skills}")
    return errors


class SourceGovernanceTests(unittest.TestCase):
    def require_text(self, path: Path) -> str:
        self.assertTrue(path.is_file(), f"missing Task 30 artifact: {path.relative_to(ROOT)}")
        return path.read_text(encoding="utf-8")

    def require_lock(self) -> dict:
        data = json.loads(self.require_text(LOCK))
        self.assertIsInstance(data, dict)
        return data

    def test_red_phase_governance_artifacts_exist(self):
        for path in (AUDIT, LOCK, NOTICES, LICENSE, README):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_lock_policy_and_source_records_are_complete(self):
        data = self.require_lock()
        self.assertEqual(data.get("schema_version"), "1")
        policy = data.get("adoption_policy")
        self.assertEqual(
            policy,
            {
                "maximum_score": 30,
                "minimum_adopted_score": 24,
                "required_nonzero_dimensions": ["correctness", "licensing"],
                "direct_adaptation_licenses": sorted(DIRECT_ADAPTATION_LICENSES),
                "unknown_or_noncommercial_license_decision": "rejected",
            },
        )
        sources = data.get("sources")
        self.assertIsInstance(sources, list)
        self.assertGreaterEqual(len(sources), 13)
        ids = [source.get("id") for source in sources]
        self.assertEqual(len(ids), len(set(ids)))
        for source in sources:
            with self.subTest(source=source.get("id")):
                self.assertEqual(source_errors(source), [])

    def test_every_adapter_and_research_skill_has_an_adopted_primary_anchor(self):
        sources = self.require_lock()["sources"]
        covered: set[str] = set()
        for source in sources:
            if source["decision"] == "adopted" and source["authority"] in {
                "official",
                "primary",
            }:
                covered.update(source["influenced_skills"])
        self.assertEqual(GOVERNED_SKILLS - covered, set())

    def test_score_and_license_mutations_are_rejected(self):
        source = copy.deepcopy(self.require_lock()["sources"][0])
        source["decision"] = "adopted"
        source["score"] = {
            "correctness": 5,
            "licensing": 5,
            "authority": 4,
            "real_time_relevance": 4,
            "actionability": 3,
            "maintainability": 2,
            "total": 23,
        }
        self.assertIn("adopted sources require score >= 24/30", source_errors(source))

        source = copy.deepcopy(self.require_lock()["sources"][0])
        source["license"] = {"spdx": "unknown", "content_use": "reference-only"}
        self.assertIn("unknown or noncommercial licenses must be rejected", source_errors(source))

        source = copy.deepcopy(self.require_lock()["sources"][0])
        source["license"] = {"spdx": "CC-BY-NC-4.0", "content_use": "direct-adaptation"}
        errors = source_errors(source)
        self.assertIn("unknown or noncommercial licenses must be rejected", errors)
        self.assertIn("direct adaptation requires an approved permissive license", errors)

        for spelling in (
            "NOASSERTION",
            "NONE",
            "unlicensed",
            "no_license",
            "LicenseRef-Non-Commercial",
            "CC BY NC 4.0",
        ):
            with self.subTest(license=spelling):
                source = copy.deepcopy(self.require_lock()["sources"][0])
                source["license"] = {"spdx": spelling, "content_use": "reference-only"}
                self.assertIn(
                    "unknown or noncommercial licenses must be rejected",
                    source_errors(source),
                )

    def test_community_threshold_and_real_exclusions_are_enforced(self):
        community = copy.deepcopy(self.require_lock()["sources"][0])
        community["authority"] = "community"
        community["score"] = {
            "correctness": 4,
            "licensing": 4,
            "authority": 4,
            "real_time_relevance": 4,
            "actionability": 4,
            "maintainability": 4,
            "total": 24,
        }
        self.assertEqual(source_errors(community), [])
        community["score"]["maintainability"] = 3
        community["score"]["total"] = 23
        self.assertIn("adopted sources require score >= 24/30", source_errors(community))

        sources = {source["id"]: source for source in self.require_lock()["sources"]}
        for source_id in ("rapier-pr-994", "tinyvbd-unlicensed-snapshot"):
            with self.subTest(source=source_id):
                source = sources[source_id]
                self.assertEqual(source["decision"], "rejected")
                self.assertEqual(source["license"]["content_use"], "excluded")
                self.assertIn("unknown", source["license"]["spdx"].casefold())

    def test_markdown_audit_covers_every_locked_source_and_scoring_field(self):
        audit = self.require_text(AUDIT)
        data = self.require_lock()
        for heading in (
            "# Physics Simulation Source Audit",
            "## Admission policy",
            "## Scoring rubric",
            "## Audited sources",
            "## Excluded-content rule",
        ):
            self.assertIn(heading, audit)
        for term in (
            "correctness",
            "licensing",
            "authority",
            "real-time relevance",
            "actionability",
            "maintainability",
            "24/30",
            "unknown",
            "noncommercial",
        ):
            self.assertIn(term.casefold(), audit.casefold())
        for source in data["sources"]:
            with self.subTest(source=source["id"]):
                self.assertIn(f"`{source['id']}`", audit)
                self.assertIn(source["url"], audit)

    def test_license_notices_and_chinese_guide_cover_distribution_contract(self):
        license_text = self.require_text(LICENSE)
        self.assertRegex(
            license_text,
            r"Apache License\s+Version 2\.0, January 2004",
        )
        self.assertIn("http://www.apache.org/licenses/", license_text)

        notices = self.require_text(NOTICES)
        self.assertIn("No third-party source code or paper text is bundled", notices)
        for source in self.require_lock()["sources"]:
            if source["decision"] != "rejected":
                with self.subTest(notice=source["id"]):
                    self.assertIn(f"`{source['id']}`", notices)

        readme = self.require_text(README)
        for heading in (
            "# Physics Simulation Superpowers 中文指南",
            "## 安装",
            "## @ 调用",
            "## 分层能力",
            "## 开发流程",
            "## Research 流程",
            "## 脚本接口",
            "## 安全边界",
            "## 示例",
        ):
            self.assertIn(heading, readme)
        for term in (
            "Unreal Engine / Chaos（旗舰）",
            "其他引擎保持精简",
            "$using-physics-simulation-superpowers",
            "$unreal-chaos-physics",
            "$surveying-real-time-physics-research",
            "$reproducing-simulation-papers",
            "$translating-research-to-game-physics",
            *SCRIPT_PATHS,
            "60 FPS",
            "30 FPS",
            "120 FPS",
        ):
            self.assertIn(term, readme)
        for relative in SCRIPT_PATHS:
            with self.subTest(script=relative):
                script = ROOT / relative
                self.assertTrue(script.is_file(), relative)
                completed = subprocess.run(
                    [sys.executable, str(script), "--help"],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=False,
                )
                self.assertIn("usage:", completed.stdout.casefold())
                expected_exit = 2 if relative in USAGE_EXIT_TWO else 0
                self.assertEqual(completed.returncode, expected_exit, completed.stderr)

    def test_task_30_files_are_tracked_and_archive_portable(self):
        paths = (
            ROOT / ".gitattributes",
            ROOT / "tests" / "test_source_governance.py",
            AUDIT,
            LOCK,
            NOTICES,
            LICENSE,
            README,
        )
        relatives = [path.relative_to(ROOT).as_posix() for path in paths]
        for relative in relatives:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", "--", relative],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(tracked.returncode, 0, tracked.stderr)
        tree = subprocess.run(
            ["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task30.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(
                ["git", "archive", "--format=tar", "--output", str(archive), tree],
                cwd=ROOT,
                check=True,
            )
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relatives:
                self.assertTrue((extract / relative).is_file(), relative)


if __name__ == "__main__":
    unittest.main()
