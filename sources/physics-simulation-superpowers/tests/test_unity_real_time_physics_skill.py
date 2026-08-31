"""Concise Unity 6 integration-map and behavioral evaluation contracts."""

import hashlib
import json
import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import urlparse

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "unity-real-time-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "unity-real-time-physics" / "references" / "unity-physics.md"
UI = ROOT / "skills" / "unity-real-time-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "unity-real-time-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "unity-real-time-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "unity-real-time-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "unity-real-time-physics-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "unity-real-time-physics-enabled-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "unity-real-time-physics-enabled-attempt-1-response.txt"
ATTEMPT2 = ENABLED

ROUTES = (
    "architecting-real-time-physics",
    "rigid-body-collision-contact",
    "constraints-ragdolls-active-physics",
    "character-controller-movement",
    "networked-deterministic-physics",
    "debugging-testing-physics",
    "profiling-scaling-physics",
    "nvidia-physx-sdk",
)

FIXTURE_DIGESTS = {
    SCENARIO: (1435, "41cf5dcb9916d5ae369c5c684410fcfdc040200abae6f2350ba2c12f0126cb8f"),
    BASELINE: (6494, "d99721efa6b79f651c2470ec841ea588c0a2b8b998dc2a883dda3c9d9a2b2f95"),
    ATTEMPT1: (6109, "32be8a62f57a332335dbc1a3fee5bc8b570ccaaf9d703c307a038fd66a4a68de"),
    ENABLED: (5399, "f21d9748c4f7b466580e6a7e6e0af88acc9b8c66ca9421e440c666175c79f679"),
}


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


def response_violations(text: str) -> set[str]:
    """Check the applied integration decisions taught by this concise adapter."""
    value = normalized(text)
    violations = set()
    groups = {
        "source-snapshot": ("unity 6.3 lts", "6000.3", "2026-08-28"),
        "project-version-gate": (
            "application.unityversion", "projectversion.txt", "manifest.json", "packages-lock.json"
        ),
        "backend-boundaries": (
            "built-in 3d", "physx", "built-in 2d", "box2d", "dots", "com.unity.physics"
        ),
        "current-api-surface": (
            "linearvelocity", "lineardamping", "angulardamping", "physics.simulationmode"
        ),
        "separate-worlds": ("physicsscene", "physicsscene2d", "collisionworld"),
        "single-writer": ("一个", "写入者", "transform", "fixedupdate", "update"),
        "targeted-controls": ("interpolation", "ccd", "joint", "quer"),
        "evidence": ("player", "profiler", "p50", "p95", "p99", "2 ms"),
    }
    for label, terms in groups.items():
        if not all(term in value for term in terms):
            violations.add(label)
    if not (
        "60 hz" in value
        or ("60 个模拟 tick/s" in value and "1/60" in value)
    ) or not all(term in value for term in ("零次", "多次", "accumulator")):
        violations.add("fixed-step-reality")
    exact_build_safe = (
        all(term in value for term in ("编译", "锁定", "版本", "不得猜"))
        or all(term in value for term in ("检查或编译", "锁定", "版本", "不得根据", "猜测"))
        or all(term in value for term in ("编译", "锁定", "版本", "不猜"))
    )
    authority_replay_safe = all(
        term in value for term in ("服务器权威", "回放", "不", "确定")
    ) and any(
        term in value
        for term in ("transform-only", "只复制 transform", "仅复制 transform", "不是复制 transform")
    )
    unsafe_claims = {
        "backend-boundaries": ("后端可以互换",),
        "current-api-surface": ("旧 api 是当前首选",),
        "single-writer": ("动态体继续逐帧写 transform", "多个写入者并存"),
        "targeted-controls": (
            "interpolation 可以修复碰撞",
            "interpolation 能修复碰撞",
            "interpolation 可以修复回放",
            "interpolation 能修复回放",
            "建议全体开启 continuous dynamic",
            "无证据提升 solver iterations",
        ),
        "exact-build-verification": ("不必在冻结工程检查或编译", "根据 unity 6 猜测"),
        "authority-replay": ("不需要 server authority", "仅复制 transform 就足以"),
    }
    for label, claims in unsafe_claims.items():
        if any(claim in value for claim in claims):
            violations.add(label)
    if not exact_build_safe:
        violations.add("exact-build-verification")
    if not authority_replay_safe:
        violations.add("authority-replay")
    missing_routes = [route for route in ROUTES if route not in text]
    if missing_routes:
        violations.add("explicit-routes")
    return violations


class UnityRealTimePhysicsSkillTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE, ENABLED):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), f"missing Task 18 artifact: {path.relative_to(ROOT)}")

    def test_adapter_entrypoint_is_concise_and_routes_instead_of_duplication(self):
        text = SKILL.read_text(encoding="utf-8")
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", text)), 400)
        self.assertIn("description: \"Use when", text)
        self.assertIn("references/unity-physics.md", text)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, text)
        self.assertIn("Own only Unity integration", text)

    def test_reference_is_a_compact_versioned_integration_map(self):
        text = REFERENCE.read_text(encoding="utf-8")
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", text)), 1800)
        for term in (
            "Unity 6.3 LTS", "6000.3", "2026-08-28", "Built-in 3D", "Nvidia PhysX",
            "Built-in 2D", "Box2D", "Unity Physics", "com.unity.physics",
            "Rigidbody.linearVelocity", "Rigidbody.linearDamping", "Rigidbody.angularDamping",
            "Physics.simulationMode", "PhysicsScene2D", "CollisionWorld", "Profiler",
        ):
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_source_audit_uses_only_official_unity_authorities(self):
        text = AUDIT.read_text(encoding="utf-8")
        self.assertIn("Read on 2026-08-28", text)
        self.assertIn("Unity 6.3 LTS", text)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertGreaterEqual(len(links), 10)
        for link in links:
            with self.subTest(link=link):
                self.assertIn(urlparse(link).hostname, {"docs.unity3d.com", "unity.com"})

    def test_source_audit_has_the_official_three_backend_mapping(self):
        text = AUDIT.read_text(encoding="utf-8")
        self.assertIn(
            "https://docs.unity3d.com/6000.3/Documentation/Manual/physics-integrations.html",
            text,
        )
        for term in ("Built-in 3D", "Nvidia PhysX", "Built-in 2D", "Box2D", "DOTS", "Unity Physics"):
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_baseline_is_exact_and_exposes_the_actual_teaching_gap(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 6494)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "d99721efa6b79f651c2470ec841ea588c0a2b8b998dc2a883dda3c9d9a2b2f95",
        )
        violations = response_violations(raw.decode("utf-8"))
        self.assertIn("source-snapshot", violations)
        self.assertIn("explicit-routes", violations)
        self.assertNotIn("backend-boundaries", violations)
        self.assertNotIn("single-writer", violations)

    def test_baseline_has_only_the_two_real_teaching_gaps(self):
        self.assertEqual(
            response_violations(BASELINE.read_text(encoding="utf-8")),
            {"source-snapshot", "explicit-routes"},
        )

    def test_unsafe_mutations_are_rejected_by_direction_not_keyword_presence(self):
        clean = ENABLED.read_text(encoding="utf-8")
        mutations = {
            "backend-boundaries": "\n后端可以互换，3D、2D 与 DOTS 可以共用同一实现。",
            "current-api-surface": "\n旧 API 是当前首选，应优先使用 velocity、drag 和 autoSimulation。",
            "single-writer": "\n动态体继续逐帧写 Transform，并允许多个写入者并存。",
            "targeted-controls": "\nInterpolation 可以修复碰撞和回放；建议全体开启 Continuous Dynamic，并无证据提升 solver iterations。",
            "exact-build-verification": "\n不必在冻结工程检查或编译，直接根据 Unity 6 猜测符号和设置。",
            "authority-replay": "\n不需要 server authority 或回放历史；仅复制 transform 就足以证明物理一致。",
        }
        for expected, mutation in mutations.items():
            with self.subTest(expected=expected):
                self.assertIn(expected, response_violations(clean + mutation))

    def test_interpolation_collision_replay_direction_is_polarity_aware(self):
        clean = ENABLED.read_text(encoding="utf-8")
        self.assertIn(
            "targeted-controls",
            response_violations(clean + "\nInterpolation 能修复碰撞/回放。"),
        )
        self.assertNotIn(
            "targeted-controls",
            response_violations(
                clean + "\nInterpolation 只用于表现平滑；不修复碰撞、服务器同步或回放正确性。"
            ),
        )

    def test_fixture_bytes_tracking_and_attributes_are_exact(self):
        for path, (byte_count, digest) in FIXTURE_DIGESTS.items():
            with self.subTest(path=path.relative_to(ROOT)):
                raw = path.read_bytes()
                self.assertEqual(len(raw), byte_count)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)

        if (ROOT / ".git").exists():
            for path in FIXTURE_DIGESTS:
                result = subprocess.run(
                    ["git", "ls-files", "--error-unmatch", str(path.relative_to(ROOT))],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                with self.subTest(tracked=path.relative_to(ROOT)):
                    self.assertEqual(result.returncode, 0, result.stderr)

        attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")
        for path in FIXTURE_DIGESTS:
            expected = f"{path.relative_to(ROOT).as_posix()} -text whitespace=-trailing-space"
            with self.subTest(attributes=expected):
                self.assertIn(expected, attributes)

    def test_chinese_semantic_equivalents_do_not_create_false_violations(self):
        violations = response_violations(ATTEMPT1.read_text(encoding="utf-8"))
        self.assertNotIn("fixed-step-reality", violations)
        self.assertNotIn("authority-replay", violations)
        self.assertEqual(
            violations,
            {"source-snapshot", "exact-build-verification", "explicit-routes"},
        )

    def test_attempt1_regression_input_is_a_tracked_fixture(self):
        self.assertEqual(
            ATTEMPT1,
            ROOT / "tests" / "fixtures" / "unity-real-time-physics-enabled-attempt-1-response.txt",
        )

    def test_attempt2_chinese_semantic_equivalents_clear_the_gate(self):
        self.assertEqual(response_violations(ATTEMPT2.read_text(encoding="utf-8")), set())

    def test_enabled_response_clears_the_applied_behavior_gate(self):
        self.assertEqual(response_violations(ENABLED.read_text(encoding="utf-8")), set())

    def test_evaluation_record_is_valid_and_preserves_exact_responses(self):
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "unity-real-time-physics")
        self.assertEqual(data["verdict"], "pass")
        self.assertEqual(data["scenario"], SCENARIO.read_text(encoding="utf-8"))
        self.assertEqual(data["baseline"]["response"], BASELINE.read_text(encoding="utf-8"))
        self.assertEqual(data["enabled"]["response"], ENABLED.read_text(encoding="utf-8"))

    def test_ui_metadata_is_explicitly_invocable_and_implicitly_discoverable(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn('display_name: "Unity Real-Time Physics"', text)
        self.assertIn("$unity-real-time-physics", text)
        self.assertIn("allow_implicit_invocation: true", text)


if __name__ == "__main__":
    unittest.main()
