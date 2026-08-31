"""Godot 4.7/Jolt integration-map and behavior contracts."""

import hashlib
import json
import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import urlparse

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "godot-jolt-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "godot-jolt-physics" / "references" / "godot-jolt.md"
UI = ROOT / "skills" / "godot-jolt-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "godot-jolt-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "godot-jolt-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "godot-jolt-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "godot-jolt-physics-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "godot-jolt-physics-enabled-response.txt"
ATTEMPT1 = ENABLED

ROUTES = (
    "architecting-real-time-physics",
    "rigid-body-collision-contact",
    "constraints-ragdolls-active-physics",
    "character-controller-movement",
    "networked-deterministic-physics",
    "debugging-testing-physics",
    "profiling-scaling-physics",
    "native-jolt-physics",
)

FIXTURE_DIGESTS = {
    SCENARIO: (1407, "b8c26483665394fecf0eba3ff0ee31d2b1edad082ba98d9465747561e45ef8e8"),
    BASELINE: (5356, "8d19617f242783f3e3fc4569219c9808aaf2f82b9f2471d3581f67c974ec09e1"),
    ENABLED: (5076, "6ffc4c382476fe52fc10cc2850ad38601ec1f7a5a4522508d18722ea9d3a4ea7"),
}

CORE_OFFICIAL_URLS = (
    "https://godotengine.org/article/maintenance-release-godot-4-7-2/",
    "https://godotengine.org/releases/4.7/",
    "https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/physics_interpolation_introduction.html",
    "https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/using_physics_interpolation.html",
    "https://docs.godotengine.org/en/4.7/tutorials/scripting/debug/debugger_panel.html",
    "https://docs.godotengine.org/en/4.7/about/release_policy.html",
    "https://godotengine.org/releases/4.6/",
)


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


CLAUSE_BOUNDARY = re.compile(
    r"(?<=[.!?])(?=\s|$)|[;。！？；\n]+|,\s*(?=(?:and|also)\b)|，\s*(?=(?:并且|而且|同时))|"
    r"\b(?:but|however|yet|then|also)\b|(?:但是|但|不过|然而|却|然后|同时|并且|而且)",
    re.IGNORECASE,
)
DIRECT_REJECTION = re.compile(
    r"\b(?:do\s+not|don't|never|cannot|can't|must\s+not|should\s+not|does\s+not|"
    r"is\s+not|are\s+not|was\s+not|were\s+not|will\s+not|did\s+not|reject(?:ed)?|"
    r"forbid(?:den)?)\b|(?:不要|不得|不能|不应|不会|禁止|拒绝)",
    re.IGNORECASE,
)
POSTFIX_REJECTION = re.compile(
    r"^(?:do\s+not|don't|never|cannot|must\s+not|should\s+not|reject(?:ed)?|"
    r"forbid(?:den)?|不要|不得|不能|不应|禁止|拒绝)(?:\s*[.!?。！？])?\s*$",
    re.IGNORECASE,
)


def semantic_clauses(text: str) -> list[str]:
    """Split sentence and contrast scopes so one denial cannot mask another claim."""
    return [part.strip() for part in CLAUSE_BOUNDARY.split(text) if part.strip()]


def clause_is_negated(clauses: list[str], index: int, match: re.Match[str]) -> bool:
    """Accept only a direct local denial or immediate rejection after a claim."""
    clause = clauses[index]
    full_prefix = clause[:match.start()]
    prefix = full_prefix[-48:]
    claim = clause[match.start():match.end()]
    suffix = clause[match.end():]
    if DIRECT_REJECTION.search(claim):
        return True
    if DIRECT_REJECTION.search(prefix):
        return True
    if re.search(
        r"(?:do\s+not|don't|never|cannot|can't|must\s+not|should\s+not|"
        r"不要|不得|不能|不应|不会|禁止|拒绝).{0,96}(?:or|and|或|和)\s*$",
        full_prefix, re.IGNORECASE,
    ):
        return True
    return not suffix.strip(" ?!.。！？") and index + 1 < len(clauses) and bool(
        POSTFIX_REJECTION.match(clauses[index + 1])
    )


def contains_positive_claim(text: str, pattern: str) -> bool:
    """Find an affirmative claim in its own clause, preserving local rejections."""
    clauses = semantic_clauses(text)
    expression = re.compile(pattern, re.IGNORECASE)
    for index, clause in enumerate(clauses):
        for match in expression.finditer(clause):
            if not clause_is_negated(clauses, index, match):
                return True
    return False


def godot3_current_reversal(text: str) -> bool:
    """Reject only migration directions that make the Godot 3 API current."""
    dangerous_directions = (
        r"(?:use|using|choose|prefer|使用|选用|采用).{0,24}(?:the\s+)?(?:current|当前|首选)"
        r".{0,16}kinematicbody(?:\w*)?(?:\s+api)?",
        r"kinematicbody(?:\w*)?(?:\s+api)?.{0,24}(?:is|remains|仍是|是).{0,12}"
        r"(?:the\s+)?(?:current|当前|首选)(?!\s+replacement)",
        r"godot\s*3\s*api.{0,24}(?:is|remains|仍是|是).{0,16}(?:the\s+)?(?:current|当前|首选)",
        r"(?:use|using|choose|prefer|使用|选用|采用).{0,24}(?:the\s+)?(?:current\s+|当前.{0,4})?"
        r"kinematicbody(?:\w*)?(?:\s+api)?.{0,32}(?:instead\s+of|而不是).{0,24}characterbody\w*",
        r"kinematicbody\w*.{0,24}(?:replaces?\b|(?:should|must)\s+replace|"
        r"is\s+(?:the\s+)?(?:current\s+)?replacement\s+for).{0,24}characterbody\w*",
        r"(?:replace|replacing).{0,24}characterbody\w*.{0,16}with.{0,16}kinematicbody\w*",
        r"characterbody\w*.{0,24}(?:is|was|be)\s+replaced\s+by.{0,24}kinematicbody\w*",
        r"(?:migrate|migration).{0,24}(?:away\s+)?from\s+characterbody\w*.{0,24}to\s+kinematicbody\w*",
        r"kinematicbody\w*.{0,24}替代.{0,24}characterbody\w*",
        r"characterbody\w*.{0,24}被.{0,24}kinematicbody\w*.{0,24}替代",
        r"从.{0,16}characterbody\w*.{0,24}(?:迁移)?到.{0,16}kinematicbody\w*",
    )
    return any(contains_positive_claim(text, pattern) for pattern in dangerous_directions)


def has_project_gate(text: str) -> bool:
    """Require the project-local version/build/export/extension snapshot together."""
    value = normalized(text)
    return (
        "project.godot" in value
        and any(term in value for term in ("完整版本", "版本", "version"))
        and any(term in value for term in ("build", "构建"))
        and any(term in value for term in ("export templates", "导出模板"))
        and any(term in value for term in ("extension", "gdextension", "扩展"))
    )


def has_rigidbody_ownership(text: str) -> bool:
    """Require a RigidBody transform owner and an explicit no-write rule."""
    value = normalized(text)
    has_owner = any(term in value for term in (
        "simulator-owned", "simulator owned", "模拟器拥有", "physics owns",
        "_integrate_forces", "通过力", "通过力、冲量", "through force", "through forces",
    ))
    has_denial = bool(re.search(
        r"(?:do\s+not|must\s+not|should\s+not)\s+write|"
        r"(?:不得|不应|不能).{0,48}(?:写|write)", value, re.IGNORECASE,
    ))
    return "rigidbody" in value and "transform" in value and has_owner and has_denial


def response_violations(text: str) -> set[str]:
    """Reject unsafe Godot advice while retaining explicit safety statements."""
    value = normalized(text)
    violations = set()
    groups = {
        "source-snapshot": ("godot 4.7.2", "4.7", "2026-08-28"),
        "two-d-three-d-boundary": ("2d", "3d", "jolt", "physicsserver2d", "physicsserver3d"),
        "character-api": ("characterbody", "_physics_process", "move_and_slide", "velocity"),
        "presentation-evidence": ("interpolation", "profiler", "performance", "p95"),
        "authority-replay": ("服务器", "回放", "确定", "transform"),
    }
    for label, terms in groups.items():
        if not all(term in value for term in terms):
            violations.add(label)
    if not has_project_gate(text):
        violations.add("project-gate")
    if not has_rigidbody_ownership(text):
        violations.add("ownership")
    if godot3_current_reversal(text):
        violations.add("godot3-current-reversal")
    unsafe_claims = {
        "process-physics": (
            r"characterbody\w*.{0,48}_process|_process.{0,48}characterbody\w*|"
            r"characterbody\w*.{0,48}(?:每帧|every).{0,24}_process|"
            r"(?<![\w])_process.{0,40}(?:physics|物理).{0,24}(?:movement|运动)|"
            r"(?:physics|物理).{0,12}(?:movement|运动).{0,40}(?<!not )(?<![\w])_process",
        ),
        "slide-delta": (
            r"move_and_slide\s*\(\s*(?:velocity\s*\*\s*delta|delta\s*\*\s*velocity)|"
            r"(?:pass|传(?:给|入)?).{0,32}(?:velocity\s*\*\s*delta|delta\s*\*\s*velocity).{0,32}move_and_slide|"
            r"(?:velocity\s*\*\s*delta|delta\s*\*\s*velocity).{0,32}(?:to|传(?:给|入)?).{0,32}move_and_slide",
        ),
        "rigidbody-transform": (
            r"(?:set|write|assign|设置|写).{0,32}rigidbody\w*.{0,32}(?:global_)?transform.{0,32}(?:every|每帧|render)|"
            r"(?:every|每帧|渲染帧|render).{0,32}(?:set|write|assign|设置|写).{0,32}rigidbody\w*.{0,32}(?:global_)?transform|"
            r"(?:update|更新).{0,32}(?:every|每个).{0,32}rigidbody\w*.{0,32}(?:global_)?transform.{0,32}(?:render\s+loop|渲染循环)|"
            r"(?:render\s+loop|渲染循环).{0,32}(?:update|更新).{0,32}(?:every|每个).{0,32}rigidbody\w*.{0,32}(?:global_)?transform",
        ),
        "jolt-2d-migration": (
            r"(?:godot\s*)?2d.{0,40}(?:run|runs|use|uses|运行|使用).{0,40}jolt|"
            r"(?:godot\s*)?2d.{0,40}(?:powered|驱动).{0,40}jolt|"
            r"(?:godot\s*)?2d.{0,40}jolt.{0,40}(?:powered|驱动)|"
            r"jolt.{0,40}(?:run|runs|use|uses|运行|使用|powered|驱动|migrat|迁移|replace|替换).{0,40}(?:godot\s*)?2d",
        ),
        "existing-default": (
            r"(?:existing|已有).{0,40}(?:automatic(?:ally)?|自动).{0,40}(?:jolt|switch|selected|select|default|切换|选中|默认)|"
            r"jolt.{0,40}(?:automatic(?:ally)?|自动).{0,40}(?:existing|已有)",
        ),
        "extension-built-in": (
            r"(?:mix|mixed|混用).{0,48}(?:built.?in|内置).{0,48}(?:legacy|old|旧.{0,12}扩展|extension)|"
            r"(?:mix|mixed|混用).{0,48}(?:legacy|old|旧.{0,12}扩展|extension).{0,48}(?:built.?in|内置)|"
            r"(?:built.?in|内置).{0,48}(?:mix|mixed|混用).{0,48}(?:legacy|old|旧.{0,12}扩展|extension)|"
            r"(?:built.?in|内置).{0,48}(?:legacy|old|旧.{0,12}扩展|extension).{0,48}(?:mix|mixed|混用)|"
            r"(?:legacy|old|旧.{0,12}扩展|extension).{0,48}(?:mix|mixed|混用).{0,48}(?:built.?in|内置)",
        ),
        "manual-server-step": (
            r"(?:manually|手动).{0,24}(?:step|推进).{0,32}physicsserver|"
            r"physicsserver\w*\.step\s*\(\s*\).{0,32}(?:yourself|manual(?:ly)?|自己|手动)|"
            r"(?:call|调用).{0,24}physicsserver\w*\.step\s*\(\s*\)",
        ),
        "interpolation-correctness": (
            r"interpolation.{0,40}(?:fix|fixed|repair|修复).{0,40}(?:collision|碰撞|replay|回放)|"
            r"(?:collision|碰撞|replay|回放).{0,40}(?:fix|fixed|repair|修复).{0,40}interpolation|"
            r"(?:collision|碰撞|replay|回放).{0,40}interpolation.{0,40}(?:fix|fixed|repair|修复)|"
            r"interpolation.{0,40}(?:make|makes|让).{0,40}(?:collision|碰撞).{0,40}(?:correct|正确)|"
            r"(?:collision|碰撞).{0,40}interpolation.{0,40}(?:correct|正确)",
        ),
        "blanket-solver": (
            r"(?:raise|increase|increased|提高).{0,40}(?:global|全局).{0,40}(?:solver|求解)|"
            r"(?:global|全局).{0,40}(?:solver|求解).{0,40}(?:raise|increase|increased|提高)|"
            r"(?:solver|求解).{0,24}(?:iterations?|迭代).{0,40}(?:higher|increase|提高).{0,40}(?:project.?wide|全项目|全局)|"
            r"(?:project.?wide|全项目|全局).{0,40}(?:solver|求解).{0,40}(?:higher|increase|提高)|"
            r"(?:project.?wide|全项目|全局).{0,40}(?:higher|increase|提高).{0,40}(?:solver|求解)",
        ),
        "cross-platform-lockstep": (
            r"(?:cross.platform|windows.{0,24}linux).{0,48}(?:bitwise|byte.identical|逐位|字节一致|deterministic|确定)|"
            r"(?:bitwise|byte.identical).{0,48}(?:cross.platform|windows.{0,24}linux)|"
            r"jolt.{0,32}(?:跨平台|cross.platform).{0,32}(?:逐位|字节一致|deterministic|确定)|"
            r"(?:windows.{0,32}linux|linux.{0,32}windows).{0,48}(?:lockstep|锁步)|"
            r"(?:lockstep|锁步).{0,48}(?:windows.{0,32}linux|linux.{0,32}windows)",
        ),
        "transform-only-replay": (
            r"(?:copy(?:ing)?\s+only|仅复制|只复制).{0,32}transform.{0,48}(?:prove|proves|guarantee|保证|证明).{0,32}(?:replay|回放)|"
            r"(?:replay|回放).{0,48}(?:prove|proves|guarantee|保证|证明).{0,48}(?:copy(?:ing)?\s+only|仅复制|只复制).{0,32}transform|"
            r"(?:replay|回放).{0,48}(?:guarantee|保证).{0,48}(?:replicate|复制).{0,24}(?:just|only|仅|只).{0,24}transform",
        ),
    }
    for label, claims in unsafe_claims.items():
        if any(contains_positive_claim(text, claim) for claim in claims):
            violations.add(label)
    if any(route not in text for route in ROUTES):
        violations.add("explicit-routes")
    return violations


class GodotJoltPhysicsSkillTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE, ENABLED):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), f"missing Task 19 artifact: {path.relative_to(ROOT)}")

    def test_adapter_and_reference_stay_concise_and_route_boundaries(self):
        skill = SKILL.read_text(encoding="utf-8")
        reference = REFERENCE.read_text(encoding="utf-8")
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", skill)), 400)
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", reference)), 1800)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/godot-jolt.md", skill)
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, skill)
        for term in (
            "Godot 4.7.2", "2026-08-28", "Jolt", "2D", "3D", "CharacterBody",
            "move_and_slide", "move_and_collide", "_physics_process", "RigidBody",
            "PhysicsServer2D", "PhysicsServer3D", "interpolation", "Profiler", "Performance",
        ):
            with self.subTest(term=term):
                self.assertIn(term, reference)

    def test_audit_uses_only_official_godot_and_jolt_sources_with_limitations(self):
        text = AUDIT.read_text(encoding="utf-8")
        self.assertIn("Read on 2026-08-28", text)
        self.assertIn("Godot 4.7.2", text)
        links = re.findall(r"\[[^]]+\]\((https?://[^)]+)\)", text)
        self.assertGreaterEqual(len(links), 13)
        for link in links:
            with self.subTest(link=link):
                self.assertIn(urlparse(link).hostname, {"docs.godotengine.org", "godotengine.org", "github.com"})
        for term in ("claim", "limitation", "4.7.2", "Using Jolt Physics", "jrouwe/JoltPhysics"):
            self.assertIn(term.casefold(), text.casefold())

    def test_controller_verified_core_official_urls_are_locked_in_reference_and_audit(self):
        reference = REFERENCE.read_text(encoding="utf-8")
        audit = AUDIT.read_text(encoding="utf-8")
        for url in CORE_OFFICIAL_URLS:
            with self.subTest(url=url):
                self.assertIn(url, reference)
                self.assertIn(url, audit)

    def test_baseline_is_hash_locked_and_has_only_real_gaps(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 5356)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), FIXTURE_DIGESTS[BASELINE][1])
        self.assertEqual(response_violations(raw.decode("utf-8")), {"source-snapshot", "explicit-routes"})

    def test_enabled_attempt1_clears_the_corrected_applied_behavior_gate(self):
        self.assertEqual(response_violations(ENABLED.read_text(encoding="utf-8")), set())

    def test_project_gate_and_rigidbody_ownership_predicates_are_independent(self):
        project_gate = "Freeze complete version, build, export templates, project.godot, and extension/package before API/default verification."
        project_gate_zh = "冻结完整版本、构建标识、导出模板、project.godot 和 extension/package，再验证 API/默认值。"
        self.assertNotIn("project-gate", response_violations(project_gate))
        self.assertNotIn("project-gate", response_violations(project_gate_zh))
        for removed in (
            project_gate.replace("project.godot, and ", ""),
            project_gate.replace("export templates, ", ""),
            project_gate.replace("extension/package", "package mapping"),
        ):
            with self.subTest(removed=removed):
                self.assertIn("project-gate", response_violations(removed))

        ownership = "RigidBody3D transform is simulator-owned; do not write global_transform on rendered frames."
        ownership_zh = "RigidBody3D 的 transform 由模拟器拥有；不得在渲染帧写 global_transform。"
        self.assertNotIn("ownership", response_violations(ownership))
        self.assertNotIn("ownership", response_violations(ownership_zh))
        for removed in (
            ownership.replace("RigidBody3D ", ""),
            ownership.replace("simulator-owned", "documented"),
            ownership.replace("do not write", "may write"),
        ):
            with self.subTest(removed=removed):
                self.assertIn("ownership", response_violations(removed))

    def test_dangerous_phrases_are_rejected_but_safety_phrases_are_allowed(self):
        safe = BASELINE.read_text(encoding="utf-8") + "\nGodot 4.7.2 4.7 snapshot read 2026-08-28. " + " ".join(ROUTES)
        for safety in (
            "Godot 3 KinematicBody is migration input; CharacterBody is current.",
            "Use _physics_process for physics movement, not _process.",
            "move_and_slide() uses velocity; do not pass velocity * delta.",
            "Do not write a dynamic RigidBody transform every render frame.",
            "Jolt does not migrate 2D, and existing projects do not automatically switch to Jolt.",
            "Do not mix the old extension and built-in settings or manually step PhysicsServer.",
            "Interpolation does not fix collision or replay; do not raise the global solver without evidence.",
            "Do not promise cross-platform bitwise deterministic physics; copying only transforms does not prove replay.",
        ):
            with self.subTest(safety=safety):
                self.assertEqual(response_violations(safe + "\n" + safety), set())
        mutations = {
            "godot3-current-reversal": "KinematicBody is the current API.",
            "process-physics": "_process is the physics movement loop.",
            "slide-delta": "move_and_slide(velocity * delta)",
            "rigidbody-transform": "Write a dynamic RigidBody transform every render frame.",
            "jolt-2d-migration": "Jolt migrates 2D.",
            "existing-default": "Existing projects automatically switch to Jolt.",
            "extension-built-in": "Mix the old extension and built-in settings.",
            "manual-server-step": "Manually step PhysicsServer.",
            "interpolation-correctness": "Interpolation fixes collision and interpolation fixes replay.",
            "blanket-solver": "Raise the global solver.",
            "cross-platform-lockstep": "Cross-platform bitwise deterministic.",
            "transform-only-replay": "Copying only transforms proves replay.",
        }
        for expected, mutation in mutations.items():
            with self.subTest(expected=expected):
                self.assertIn(expected, response_violations(safe + "\n" + mutation))

    def test_clause_local_polarity_rejects_realistic_unsafe_probes_and_allows_rejections(self):
        safe = ENABLED.read_text(encoding="utf-8")
        unsafe_probes = {
            "godot3-current-reversal": ("KinematicBody is the current API.", "Godot 3 API 是当前首选。"),
            "process-physics": ("Use _process for physics movement.", "把 _process 作为物理运动循环。"),
            "slide-delta": ("move_and_slide(delta * velocity)", "调用 move_and_slide(velocity * delta)。"),
            "rigidbody-transform": ("Set RigidBody3D.global_transform on every rendered frame.", "每帧写 RigidBody3D 的 global_transform。"),
            "jolt-2d-migration": ("Jolt migrates 2D physics.", "Jolt 会迁移并替换 2D 物理。"),
            "existing-default": ("Existing projects automatically switch to Jolt.", "已有项目会自动切换到 Jolt。"),
            "extension-built-in": ("Mix the old extension and built-in settings.", "混用旧扩展与内置 Jolt 设置。"),
            "manual-server-step": ("Do not mix old settings, but manually step PhysicsServer.", "不要混用旧扩展和内置设置。Manually step PhysicsServer."),
            "interpolation-correctness": ("Interpolation fixes collision correctness.", "Interpolation 可以修复回放正确性。"),
            "blanket-solver": ("Raise the global solver iterations.", "提高全局求解器迭代。"),
            "cross-platform-lockstep": ("Jolt gives byte-identical simulation on Windows and Linux.", "Jolt 保证跨平台逐位确定。"),
            "transform-only-replay": ("Copying only transforms proves replay consistency.", "只复制 transform 就能保证回放。"),
        }
        for expected, probes in unsafe_probes.items():
            for probe in probes:
                with self.subTest(expected=expected, probe=probe):
                    self.assertIn(expected, response_violations(safe + "\n" + probe))
        for rejection in (
            "Do not manually step PhysicsServer.",
            "Manually step PhysicsServer? Do not.",
            "不要手动推进 PhysicsServer。",
            "不要混用旧扩展和内置设置；不得手动 step PhysicsServer。",
        ):
            with self.subTest(rejection=rejection):
                self.assertNotIn("manual-server-step", response_violations(safe + "\n" + rejection))

    def test_round_two_clause_local_polarity_rejects_reviewer_probes(self):
        safe = ENABLED.read_text(encoding="utf-8")
        unsafe_probes = {
            "godot3-current-reversal": (
                "KinematicBody remains the current Godot 3 API.",
                "Godot 3 API 仍是当前首选。",
            ),
            "process-physics": (
                "Move CharacterBody3D in _process() every frame.",
                "每帧在 _process() 移动 CharacterBody3D。",
            ),
            "slide-delta": (
                "Pass delta * velocity to move_and_slide.",
                "把 velocity * delta 传给 move_and_slide。",
            ),
            "rigidbody-transform": (
                "Set RigidBody3D.global_transform on every rendered frame.",
                "在每个渲染帧写 RigidBody3D 的 global_transform。",
            ),
            "jolt-2d-migration": (
                "Godot 2D physics runs on Jolt.",
                "Godot 的 2D 物理使用 Jolt 运行。",
            ),
            "existing-default": (
                "Jolt is automatically selected for existing projects.",
                "Jolt 会为已有项目自动选中。",
            ),
            "extension-built-in": (
                "Built-in Jolt settings can be mixed with the legacy extension.",
                "内置 Jolt 设置可以和旧扩展混用。",
            ),
            "manual-server-step": (
                "Manually step PhysicsServer, and do not mix the legacy extension settings.",
                "不要猜默认值，同时手动推进 PhysicsServer。",
                "Not only should we manually step PhysicsServer.",
                "Call PhysicsServer3D.step() yourself at 60 Hz.",
            ),
            "interpolation-correctness": (
                "Collision correctness is fixed by interpolation.",
                "碰撞正确性可由 interpolation 修复。",
            ),
            "blanket-solver": (
                "Global solver iterations should be increased.",
                "应该提高全局求解器迭代。",
            ),
            "cross-platform-lockstep": (
                "Windows/Linux simulation is byte-identical with Jolt.",
                "Jolt 让 Windows 与 Linux 逐位一致。",
            ),
            "transform-only-replay": (
                "Replay is guaranteed by copying only transforms.",
                "只复制 transform 就保证回放。",
            ),
        }
        for expected, probes in unsafe_probes.items():
            for probe in probes:
                with self.subTest(expected=expected, probe=probe):
                    self.assertIn(expected, response_violations(safe + "\n" + probe))
        safe_rejections = {
            "manual-server-step": (
                "Do not manually step PhysicsServer.",
                "Manually step PhysicsServer? Do not.",
                "不要手动推进 PhysicsServer。",
            ),
            "jolt-2d-migration": ("Godot 2D physics does not run on Jolt.",),
            "existing-default": ("Jolt is not automatically selected for existing projects.",),
            "extension-built-in": ("Do not mix built-in Jolt settings with the legacy extension.",),
            "interpolation-correctness": ("Collision correctness is not fixed by interpolation.",),
            "transform-only-replay": ("Replay is not guaranteed by copying only transforms.",),
        }
        for expected, rejections in safe_rejections.items():
            for rejection in rejections:
                with self.subTest(expected=expected, rejection=rejection):
                    self.assertNotIn(expected, response_violations(safe + "\n" + rejection))
        self.assertNotIn(
            "rigidbody-transform",
            response_violations(safe + "\nSet the camera transform every rendered frame."),
        )

    def test_round_three_reordered_claims_and_comma_scopes(self):
        safe = ENABLED.read_text(encoding="utf-8")
        unsafe_probes = {
            "process-physics": ("角色物理运动放在 _process() 中。", "Put CharacterBody3D movement in _process()."),
            "godot3-current-reversal": ("Use the current KinematicBody API in Godot 4.", "Godot 4 仍使用当前 KinematicBody API。"),
            "blanket-solver": ("Set solver iterations higher project-wide.", "在全项目范围提高 solver iterations。"),
            "cross-platform-lockstep": ("Windows and Linux stay in lockstep under Jolt.", "Jolt 下 Windows 和 Linux 保持锁步。"),
            "transform-only-replay": ("Replay is guaranteed if we replicate just the transforms.", "只复制 transform 就能保证 replay。"),
            "jolt-2d-migration": ("Godot 2D physics is powered by Jolt.", "Godot 2D 物理由 Jolt 驱动。"),
            "interpolation-correctness": ("Interpolation makes collision behavior correct.", "Interpolation 让碰撞行为正确。"),
            "rigidbody-transform": ("Update every RigidBody3D transform from the render loop.", "从渲染循环更新每个 RigidBody3D transform。"),
            "manual-server-step": ("Do not mix legacy settings, and manually step PhysicsServer.", "不要混用旧设置，并且手动推进 PhysicsServer。"),
        }
        for expected, probes in unsafe_probes.items():
            for probe in probes:
                with self.subTest(expected=expected, probe=probe):
                    self.assertIn(expected, response_violations(safe + "\n" + probe))
        for rejection in (
            "Do not mix legacy settings or manually step PhysicsServer.",
            "不要混用旧设置或手动推进 PhysicsServer。",
        ):
            with self.subTest(rejection=rejection):
                self.assertNotIn("manual-server-step", response_violations(safe + "\n" + rejection))

    def test_round_four_migration_denials_and_comma_or_lists(self):
        safe = ENABLED.read_text(encoding="utf-8")
        for migration in (
            "CharacterBody3D is the current replacement for KinematicBody in Godot 4.",
            "Use the current CharacterBody API instead of KinematicBody.",
            "当前应使用 CharacterBody 替代 KinematicBody。",
        ):
            with self.subTest(migration=migration):
                self.assertNotIn("godot3-current-reversal", response_violations(safe + "\n" + migration))

        for rejection in (
            "Do not mix legacy settings, or manually step PhysicsServer.",
            "Do not install the extension, copy its settings, or manually step PhysicsServer.",
            "不要混用旧设置，或手动推进 PhysicsServer。",
        ):
            with self.subTest(rejection=rejection):
                self.assertNotIn("manual-server-step", response_violations(safe + "\n" + rejection))

        for prescription in (
            "Do not mix legacy settings, and manually step PhysicsServer.",
            "不要混用旧设置，并且手动推进 PhysicsServer。",
        ):
            with self.subTest(prescription=prescription):
                self.assertIn("manual-server-step", response_violations(safe + "\n" + prescription))

    def test_round_five_controller_migration_reversals_are_rejected(self):
        safe = ENABLED.read_text(encoding="utf-8")
        for reversal in (
            "Use the current KinematicBody API instead of CharacterBody in Godot 4.",
            "KinematicBody is the current replacement for CharacterBody in Godot 4.",
            "当前应使用 KinematicBody 替代 CharacterBody。",
        ):
            with self.subTest(reversal=reversal):
                self.assertIn(
                    "godot3-current-reversal",
                    response_violations(safe + "\n" + reversal),
                )

    def test_round_five_migration_direction_pairs_and_local_denial(self):
        safe = ENABLED.read_text(encoding="utf-8")
        direction_pairs = (
            (
                "Use the current CharacterBody API instead of KinematicBody in Godot 4.",
                "Use the current KinematicBody API instead of CharacterBody in Godot 4.",
            ),
            (
                "CharacterBody is the current replacement for KinematicBody in Godot 4.",
                "KinematicBody is the current replacement for CharacterBody in Godot 4.",
            ),
            (
                "CharacterBody replaces KinematicBody in Godot 4.",
                "KinematicBody replaces CharacterBody in Godot 4.",
            ),
            (
                "KinematicBody is replaced by CharacterBody in Godot 4.",
                "CharacterBody is replaced by KinematicBody in Godot 4.",
            ),
            (
                "Migrate away from KinematicBody to CharacterBody.",
                "Migrate away from CharacterBody to KinematicBody.",
            ),
            (
                "CharacterBody 替代 KinematicBody。",
                "KinematicBody 替代 CharacterBody。",
            ),
            (
                "KinematicBody 被 CharacterBody 替代。",
                "CharacterBody 被 KinematicBody 替代。",
            ),
            (
                "从 KinematicBody 迁移到 CharacterBody。",
                "从 CharacterBody 迁移到 KinematicBody。",
            ),
        )
        for safe_direction, dangerous_direction in direction_pairs:
            with self.subTest(safe_direction=safe_direction):
                self.assertNotIn(
                    "godot3-current-reversal",
                    response_violations(safe + "\n" + safe_direction),
                )
            with self.subTest(dangerous_direction=dangerous_direction):
                self.assertIn(
                    "godot3-current-reversal",
                    response_violations(safe + "\n" + dangerous_direction),
                )

        for direct_reversal in (
            "Use the current KinematicBody API in Godot 4.",
            "Godot 3 API is the current API in Godot 4.",
        ):
            with self.subTest(direct_reversal=direct_reversal):
                self.assertIn(
                    "godot3-current-reversal",
                    response_violations(safe + "\n" + direct_reversal),
                )

        self.assertNotIn(
            "godot3-current-reversal",
            response_violations(safe + "\nDo not replace CharacterBody with KinematicBody."),
        )

    def test_46_release_owns_jolt_default_and_existing_project_attribution(self):
        reference = REFERENCE.read_text(encoding="utf-8")
        audit = AUDIT.read_text(encoding="utf-8")
        for text in (reference, audit):
            self.assertIn("https://godotengine.org/releases/4.6/", text)
        self.assertIn("experimental removal", audit.casefold())
        self.assertIn("existing projects unaffected", audit.casefold())

    def test_fixtures_are_tracked_hash_locked_and_protected(self):
        for path, (byte_count, digest) in FIXTURE_DIGESTS.items():
            raw = path.read_bytes()
            self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (byte_count, digest))
            if (ROOT / ".git").exists():
                result = subprocess.run(
                    ["git", "ls-files", "--error-unmatch", str(path.relative_to(ROOT))],
                    cwd=ROOT, capture_output=True, text=True, check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
            expected = f"{path.relative_to(ROOT).as_posix()} -text whitespace=-trailing-space"
            self.assertIn(expected, (ROOT / ".gitattributes").read_text(encoding="utf-8"))

    def test_evaluation_preserves_exact_fixtures_and_truthfully_promotes_attempt1(self):
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "godot-jolt-physics")
        self.assertEqual(data["scenario"], SCENARIO.read_text(encoding="utf-8"))
        self.assertEqual(data["baseline"]["response"], BASELINE.read_text(encoding="utf-8"))
        self.assertEqual(data["enabled"]["response"], ENABLED.read_text(encoding="utf-8"))
        self.assertEqual(data["verdict"], "pass")
        self.assertIn("attempt 1", " ".join(data["evidence"]).casefold())

    def test_ui_is_explicit_and_implicit(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn("$godot-jolt-physics", text)
        self.assertIn("allow_implicit_invocation: true", text)

    def test_skill_is_readable_by_the_validator_windows_default_codec(self):
        SKILL.read_bytes().decode("gbk")


if __name__ == "__main__":
    unittest.main()
