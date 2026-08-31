"""Focused Task 15 contract, mutation, provenance, and archive tests."""

import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "debugging-testing-physics" / "SKILL.md"
UI = ROOT / "skills" / "debugging-testing-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "debugging-testing-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "debugging-testing-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "debugging-testing-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "debugging-testing-physics-baseline-response.txt"
ENABLED_ATTEMPT1 = ROOT / "tests" / "fixtures" / "debugging-testing-physics-enabled-attempt-1-response.txt"
ENABLED_ATTEMPT2 = ROOT / "tests" / "fixtures" / "debugging-testing-physics-enabled-attempt-2-response.txt"

HEADINGS = (
    "Reproducer and evidence",
    "Hypothesis ladder",
    "Controlled experiments",
    "Regression acceptance",
)
LADDER = (
    "units/scale and mass/inertia ratios",
    "fixed-step accumulator, dt/substep scheduling and backlog",
    "collision geometry, initial penetration, margins, normals, manifolds and ccd",
    "constraint frames, rank, limits, motors, warm-start and feedback loops",
    "forces/impulses/torques, units, application points, double application and controller ownership",
    "solver settings only as a diagnostic sensitivity test",
    "threading order, races and stable reduction",
    "network authority, serialization, restore caches, rng/events and replay hashes",
)


def read_skill(path: Path) -> tuple[dict[str, str], str]:
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", path.read_text(encoding="utf-8"), re.DOTALL)
    if not match:
        raise AssertionError("SKILL.md must have YAML frontmatter")
    fields = {key: value.strip().strip('"') for key, value in (line.split(":", 1) for line in match.group(1).splitlines())}
    return fields, match.group(2)


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


def contract_violations(text: str) -> set[str]:
    """Semantic-enough contract gate; it deliberately tests EN/ZH positive polarity."""
    value = normalized(text)
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    required_groups = {
        "reject-masking": ("reject batch/random tuning", "nan-to-zero", "velocity clamps", "restore the exact original configuration", "quarantine", "fail the run"),
        "manifest": ("build/backend/version and flags", "platform/architecture/thread mode", "units/world scale", "fixed 60 hz", "seed", "ordered inputs/events", "authority", "complete rollback state", "stable ids", "unknown values remain blockers"),
        "reproduction": ("preserve the failing artifact", "fresh process", "occurrence tick/time", "failure rate", "declared seeds/repetitions/platforms", "one controlled deletion", "first-failure signature"),
        "instrumentation": ("every tick", "pre/post integration and solver", "tick/body/shape/contact/constraint/island/thread/job", "dt/substeps", "finite flags", "poses/normalized quaternions", "forces/impulses/torques", "normals/depth/relative speed/manifold/impulses", "motor targets/error/residual/impulse", "authority/rollback/restore/hash/event cursors", "cpu time"),
        "invariants": ("ingest, force generation, pre-step, collision/manifold, constraint assembly/solve, integration, serialization/restore, and post-step", "positive finite mass/inertia", "valid normalized rotations", "first invalid writer and dependency chain"),
        "analyzers": ("scripts/analyze_physics_trace.py", "scripts/compare_replay_hashes.py", "first divergent tick/layer/state component", "not infer causality from a late nan or final screenshot"),
        "hypothesis-tuples": ("observable", "one-variable intervention", "predicted result", "falsifier", "rollback/reset"),
        "ab": ("a is the restored failing configuration", "original multi-change proposal disabled", "b changes one factor tied to one hypothesis", "scene/input/seed/build/tick/budget fixed", "do not invent counts, duration or tolerances"),
        "test-separation": ("invariant/property", "deterministic replay/hash", "golden traces", "stress/fuzz/metamorphic", "platform/thread/network matrices", "exact floating-point equality is not silently generalized"),
        "acceptance": ("old build/config reliably triggers", "minimal reproducer fails before and passes after", "causal fix", "no masking clamp/nan reset", "fixed 60 hz", "physics cpu p95 <= 3 ms", "fatal-stop"),
    }
    for code, phrases in required_groups.items():
        if any(phrase not in value for phrase in phrases):
            violations.add(code)
    positions = [value.find(phrase) for phrase in LADDER]
    if any(position < 0 for position in positions) or positions != sorted(positions):
        violations.add("ordered-ladder")
    # Prescriptions are unsafe even if an otherwise-complete guide quotes the baseline.
    forbidden = {
        "batch-tune-fix": r"(?:apply|use|set|将|把).{0,100}(?:8.{0,16}32|1.{0,16}4|0\.2.{0,16}0\.95).{0,100}(?:fix|修复|解决)",
        "mask-nan-fix": r"(?:nan.{0,35}(?:to|with).{0,35}zero|将.{0,25}nan.{0,25}(?:置零|替换为.{0,10}0)).{0,80}(?:fix|修复|accept|验收)",
        "clamp-fix": r"(?:velocity clamp.{0,35}20|速度.{0,25}(?:clamp|钳制).{0,25}20).{0,80}(?:fix|修复|accept|验收)",
        "solver-first": r"(?:start|begin|first|先).{0,45}(?:with|from|调).{0,45}(?:solver|迭代|substeps?)",
        "one-second-only": r"(?:only|just|仅).{0,30}(?:final|one-second|每秒|最终).{0,60}(?:sample|state|日志|状态)",
        "invented-unknowns": r"(?:repeat|repetition|duration|tolerance|次数|时长|容差).{0,25}(?:exactly|use|set|固定为|设为).{0,25}\d+",
    }
    clauses = re.split(r"[!?。\r\n]+", text.casefold())
    for code, pattern in forbidden.items():
        for clause in clauses:
            if re.search(pattern, clause) and not re.search(r"\b(?:reject|never)\b|拒绝|不得", clause):
                violations.add(code)
                break
    return violations


def enabled_attempt1_violations(text: str) -> set[str]:
    """Evaluate the captured response, not a hypothetical future response."""
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    if "scripts/analyze_physics_trace.py" not in text:
        violations.add("missing-trace-analyzer-path")
    if "scripts/compare_replay_hashes.py" not in text:
        violations.add("missing-replay-comparator-path")
    ladder_positions = [text.find(prefix) for prefix in (
        "1. 单位/尺度", "2. 固定步进", "3. 碰撞几何", "4. 关节 frame",
        "5. 力/冲量", "6. solver", "7. 线程顺序", "8. 网络 authority",
    )]
    if any(position < 0 for position in ladder_positions) or ladder_positions != sorted(ladder_positions):
        violations.add("ordered-ladder")
    step_section = text.split("3. 碰撞几何", 1)[0].split("2. 固定步进", 1)[-1]
    if re.search(r"(?:单线程|thread).{0,30}(?:调度|schedule)|(?:调度|schedule).{0,30}(?:单线程|thread)", step_section, re.IGNORECASE):
        violations.add("step-layer-uses-threading-intervention")
    return violations


def applied_response_violations(text: str) -> set[str]:
    """Require literal evidence tools while permitting downstream thread diagnosis."""
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    if "scripts/analyze_physics_trace.py" not in text:
        violations.add("missing-trace-analyzer-path")
    if "scripts/compare_replay_hashes.py" not in text:
        violations.add("missing-replay-comparator-path")
    ladder = text.split("## Controlled experiments", 1)[0].split("## Hypothesis ladder", 1)[-1]
    match = re.search(r"(?:^|\n)2\.\s.*?(?=(?:\n3\.\s)|\Z)", ladder, re.DOTALL)
    if match:
        for clause in re.split(r"[。.!?\r\n]+", match.group(0).casefold()):
            has_thread_term = bool(re.search(r"single-thread|thread mode|job order|单线程|线程模式|job 顺序", clause))
            has_intervention = bool(re.search(r"only|toggle|switch|change|run|set|仅|切换|改|运行|设为", clause))
            has_negation = bool(re.search(r"do not|never|must not|不得|不能|不改变|不切换", clause))
            if has_thread_term and has_intervention and not has_negation:
                violations.add("step-layer-uses-threading-intervention")
                break
    return violations


def enabled_attempt2_violations(text: str) -> set[str]:
    """Broad contract check for the second capture without paragraph templating."""
    violations = applied_response_violations(text)
    required = {
        "reproducer": ("恢复原始发布配置", "未知项不得被默认值替代", "新进程", "逐次删除一个场景元素"),
        "instrumentation": ("每个 tick", "第一个非法写入者及其依赖链", "首次坏 tick", "首个分歧 tick、层级及状态分量"),
        "hypotheses": ("每项只改变一个因素", "预测", "否定", "恢复基线", "线程问题不归入步长层"),
        "ab": ("A 组为恢复后的原始失败配置", "B 组每次只实施", "固定场景、输入、seed、构建、60 hz tick 和 cpu 预算", "不虚构次数、时长或容差"),
        "regression": ("不变量/性质测试", "确定性回放与分层 hash 测试", "golden trace", "压力、fuzz、变形测试", "不得静默要求跨平台浮点逐位相等"),
        "acceptance": ("旧构建/配置能可靠触发", "最小复现修复前失败、修复后通过", "physics cpu p95 不超过 3 ms", "致命停止"),
    }
    normalized_response = normalized(text)
    for code, phrases in required.items():
        if any(normalized(phrase) not in normalized_response for phrase in phrases):
            violations.add(code)
    positions = [text.find(prefix) for prefix in (
        "1. 单位/尺度", "2. 固定步长", "3. 碰撞几何", "4. 约束帧",
        "5. 力、冲量", "6. solver", "7. 线程顺序", "8. 网络 authority",
    )]
    if any(position < 0 for position in positions) or positions != sorted(positions):
        violations.add("ordered-ladder")
    required_acceptance = {
        "acceptance-masking": "不存在 nan 重置或掩蔽性 clamp",
        "acceptance-trace-replay": "trace 与 replay-hash 门禁通过",
    }
    for code, phrase in required_acceptance.items():
        if phrase not in normalized_response:
            violations.add(code)
    for clause in re.split(r"[!?。\r\n]+", text.casefold()):
        rejection = any(marker in clause for marker in (
            "reject", "rejected baseline", "not a fix", "not acceptance", "never", "do not", "must not",
            "拒绝", "绝不能", "不得", "不能计作", "不是修复", "不计作",
        ))
        intent = any(marker in clause for marker in (
            "fix", "accepted", "acceptance", "solve", "recommend", "suggest", "adopt", "apply", "use", "set",
            "修复", "验收", "通过", "解决", "建议", "采用", "使用", "设为", "改为",
        ))
        values = (
            bool(re.search(r"(?:8\s*(?:→|->|到|至)\s*32|从\s*8\s*调到\s*32)", clause))
            and bool(re.search(r"(?:1\s*(?:→|->|到|至)\s*4|从\s*1\s*调到\s*4)", clause))
            and bool(re.search(r"(?:0\.2\s*(?:→|->|到|至)\s*0\.95|从\s*0\.2\s*调到\s*0\.95)", clause))
            and "20" in clause
            and "nan" in clause
        )
        if values and intent and not rejection:
            violations.add("batch-tune-fix")
        nan_reset = "nan" in clause and any(marker in clause for marker in ("zero", "写成 0", "置零", "→0"))
        if nan_reset and intent and not rejection:
            violations.add("mask-nan-fix")
        clamp = "clamp" in clause and "20" in clause
        if clamp and intent and not rejection:
            violations.add("clamp-fix")
        solver_first_action = bool(re.search(
            r"(?:start|begin|first).{0,30}(?:tune|adjust|increase|change|set).{0,30}solver|(?:tune|adjust|increase|change|set).{0,30}solver.{0,30}(?:first|initial)|先(?:调|调整|改|设置).{0,30}solver",
            clause,
        ))
        if solver_first_action and not rejection:
            violations.add("solver-first")
        sparse = any(marker in clause for marker in ("only", "just", "仅")) and any(
            marker in clause for marker in ("final", "one-second", "每秒", "最终")
        ) and any(marker in clause for marker in ("state", "log", "日志", "状态", "记录"))
        secondary_context = any(marker in clause for marker in (
            "secondary context", "auxiliary context", "supporting context",
            "secondary evidence", "auxiliary evidence", "supporting evidence",
            "次要上下文", "辅助上下文", "支持性上下文", "次要证据", "辅助证据", "支持性证据",
        ))
        causal_subjects = re.finditer(
            r"(?:由\s*)?(?:(?P<sparse>\b(?:they|it)\b|final(?:-state)? logs?|one-second logs?|最终状态(?:日志|记录)|每秒(?:日志|记录)|它)|"
            r"(?P<trace>tick(?:\s+traces?)?|first[- ]fault evidence|first invalid writer evidence|逐\s*tick\s*trace|首(?:个)?(?:坏|错误|故障)\s*tick(?:\s*证据)?|首个非法写入(?:者)?(?:\s*证据)?))"
            r"\s*(?:(?:alone|directly)\s+|独自|直接|才)?(?:decide|determine|决定).{0,20}(?:causality|因果)",
            clause,
        )
        sparse_is_causal = any(match.group("sparse") for match in causal_subjects) or bool(re.search(
            r"(?:ignore\s+(?:the\s+)?(?:tick(?:\s+traces?)?|first-fault)|忽略(?:逐\s*tick\s*trace|tick\s*trace|首个坏\s*tick))",
            clause,
        ))
        if sparse and not rejection and (not secondary_context or sparse_is_causal):
            violations.add("one-second-only")
        invented = any(marker in clause for marker in ("repetition", "repetitions", "duration", "tolerance", "重复", "次数", "时长", "容差")) and any(
            marker in clause for marker in ("exactly", "use", "set", "固定为", "设为", "使用")
        ) and bool(re.search(r"\d", clause))
        if invented and not rejection:
            violations.add("invented-unknowns")
    return violations


@unittest.skipUnless(SKILL.is_file(), "Task 15 production artifacts are not written during RED")
class DebuggingTestingPhysicsSkillTests(unittest.TestCase):
    def test_skill_contract_is_complete_engine_neutral_and_bounded(self):
        frontmatter, body = read_skill(SKILL)
        self.assertEqual(frontmatter, {
            "name": "debugging-testing-physics",
            "description": "Use when physics jitter, tunneling, NaN, explosions, platform-only failures, replay divergence, or unstable regression tests need a root-cause investigation.",
        })
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", body)), 500)
        self.assertEqual(contract_violations(body), set())
        for api in ("Rigidbody", "PxScene", "PhysicsSystem", "BodyInterface", "b2World"):
            self.assertNotIn(api, body)

    def test_contract_deletions_and_bilingual_polarity_variants_are_rejected(self):
        _, body = read_skill(SKILL)
        for phrase, code in (
            ("scripts/analyze_physics_trace.py", "analyzers"),
            ("scripts/compare_replay_hashes.py", "analyzers"),
            ("Restore the exact original configuration", "reject-masking"),
            ("first invalid writer and dependency chain", "invariants"),
            ("one-variable intervention", "hypothesis-tuples"),
            ("physics CPU p95 <= 3 ms", "acceptance"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                self.assertIn(code, contract_violations(body.replace(phrase, "", 1)))
        mutations = {
            "batch-tune-fix": "Apply 8→32 iterations, 1→4 substeps, 0.2→0.95 damping, clamp velocity to 20, and replace NaN with zero as the fix.",
            "mask-nan-fix": "将 NaN 置零作为验收修复。",
            "clamp-fix": "把速度 clamp 到 20 作为修复和验收。",
            "solver-first": "先调 solver iterations，再调查其他层。",
            "one-second-only": "仅每秒记录最终状态。",
            "invented-unknowns": "Use repetitions exactly 10 before the observed rate is known.",
        }
        for code, mutation in mutations.items():
            with self.subTest(code=code):
                self.assertIn(code, contract_violations(f"{body}\n{mutation}"))

    def test_exact_tracked_baseline_truthfully_fails_named_gates(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 5758)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "87cc7680d38105bc4967cf8339649d0858bdce22c5585f054580f9255c12085e")
        violations = contract_violations(raw.decode("utf-8"))
        self.assertTrue({"headings", "ordered-ladder", "analyzers", "hypothesis-tuples", "ab", "test-separation", "acceptance"}.issubset(violations), violations)

    def test_exact_enabled_attempt1_is_tracked_and_truthfully_remains_failed(self):
        raw = ENABLED_ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), 6070)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "c03ffbf7b30bc97cd4e7b93e2009aaade4dbac40422e2a3272b0aeb9da613e7b")
        self.assertEqual(
            enabled_attempt1_violations(raw.decode("utf-8")),
            {
                "missing-trace-analyzer-path",
                "missing-replay-comparator-path",
                "step-layer-uses-threading-intervention",
            },
        )

    def test_attempt1_regression_requires_analyzers_and_layer_isolation(self):
        response = ENABLED_ATTEMPT1.read_text(encoding="utf-8")
        self.assertEqual(
            applied_response_violations(response),
            {
                "missing-trace-analyzer-path",
                "missing-replay-comparator-path",
                "step-layer-uses-threading-intervention",
            },
        )

    def test_exact_enabled_attempt2_is_tracked_and_meets_the_full_contract(self):
        raw = ENABLED_ATTEMPT2.read_bytes()
        self.assertEqual(len(raw), 5349)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "6ab7411689ff13e909802b43b3414c630d42c30d49b77a8c1bc70b5aa0cfaa8f")
        self.assertEqual(enabled_attempt2_violations(raw.decode("utf-8")), set())

    def test_enabled_attempt2_validator_rejects_polarity_mutations_and_acceptance_deletions(self):
        response = ENABLED_ATTEMPT2.read_text(encoding="utf-8")
        mutations = {
            "batch-tune-fix": "Apply 8→32 iterations, 1→4 substeps, 0.2→0.95 damping, clamp velocity to 20, and replace NaN with zero as the accepted fix.",
            "mask-nan-fix": "将 NaN 置零作为通过验收的修复。",
            "clamp-fix": "把速度 clamp 到 20 作为验收修复。",
            "solver-first": "先调 solver iterations，再调查其他层。",
            "one-second-only": "仅每秒记录最终状态。",
            "invented-unknowns": "Use exactly 10 repetitions, 20 minutes, and tolerance 0.1 before observing failure rate.",
        }
        for code, mutation in mutations.items():
            with self.subTest(code=code):
                self.assertIn(code, enabled_attempt2_violations(f"{response}\n{mutation}"))
        for phrase, code in (
            ("不存在 NaN 重置或掩蔽性 clamp；", "acceptance-masking"),
            ("trace 与 replay-hash 门禁通过；", "acceptance-trace-replay"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(code, enabled_attempt2_violations(response.replace(phrase, "", 1)))
        controls = (
            "Quoted rejected baseline: 8→32, 1→4, 0.2→0.95, clamp 20, and NaN-to-zero are not a fix.",
            "NaN quarantine preserves evidence, fails the run, and is not acceptance.",
        )
        for control in controls:
            with self.subTest(control=control):
                self.assertEqual(enabled_attempt2_violations(f"{response}\n{control}"), set())

    def test_enabled_attempt2_validator_distinguishes_prescription_from_capture_or_secondary_context(self):
        response = ENABLED_ATTEMPT2.read_text(encoding="utf-8")
        prescriptions = (
            "Use 8→32 iterations, 1→4 substeps, 0.2→0.95 damping, clamp velocity to 20, and replace NaN with zero to solve the issue.",
            "Adopt 8→32 iterations, 1→4 substeps, 0.2→0.95 damping, clamp velocity to 20, and replace NaN with zero.",
            "建议把 iterations 从 8 调到 32、substeps 从 1 调到 4、damping 从 0.2 调到 0.95、速度 clamp 到 20，并将 NaN 置零来解决问题。",
            "采用把 iterations 从 8 调到 32、substeps 从 1 调到 4、damping 从 0.2 调到 0.95、速度 clamp 到 20，并将 NaN 置零的方案。",
        )
        for prescription in prescriptions:
            with self.subTest(prescription=prescription):
                violations = enabled_attempt2_violations(f"{response}\n{prescription}")
                self.assertTrue({"batch-tune-fix", "mask-nan-fix", "clamp-fix"}.issubset(violations), violations)
        controls = (
            "At the solver stage, capture the first invalid writer and residual before changing settings.",
            "Use final-state logs only as secondary context; tick traces decide causality.",
        )
        for control in controls:
            with self.subTest(control=control):
                self.assertEqual(enabled_attempt2_violations(f"{response}\n{control}"), set())

    def test_enabled_attempt2_validator_rejects_exclusive_sparse_context_evasion(self):
        response = ENABLED_ATTEMPT2.read_text(encoding="utf-8")
        evasions = (
            "Use final-state logs only as context; they decide causality.",
            "Use one-second logs only as context and ignore tick traces.",
            "仅将最终状态日志作为 context；由它决定因果。",
            "仅将每秒日志作为 context，并忽略逐 tick trace。",
            "Use final-state logs only as secondary context; they decide causality.",
            "仅将最终状态日志作为次要上下文；由它决定因果。",
        )
        for evasion in evasions:
            with self.subTest(evasion=evasion):
                self.assertIn("one-second-only", enabled_attempt2_violations(f"{response}\n{evasion}"))
        controls = (
            "Use final-state logs only as secondary context; tick traces decide causality.",
            "仅将最终状态日志作为次要上下文；逐 tick trace 决定因果。",
            "仅将每秒日志作为辅助证据；tick trace 决定因果。",
        )
        for control in controls:
            with self.subTest(control=control):
                self.assertEqual(enabled_attempt2_violations(f"{response}\n{control}"), set())

    def test_applied_response_gate_uses_semantic_mutation_and_allows_downstream_observation(self):
        response = ENABLED_ATTEMPT1.read_text(encoding="utf-8")
        repaired = response.replace(
            "对重放 hash，定位首个分歧 tick、层和状态组件；",
            "使用 scripts/analyze_physics_trace.py 获取 trace 证据，并使用 scripts/compare_replay_hashes.py 定位首个分歧 tick、层和状态组件；",
        ).replace(
            "或单线程调度。",
            "；线程问题仅作为层 7 的下游观察，不改变线程模式。",
        )
        self.assertEqual(applied_response_violations(repaired), set())
        for path, code in (
            ("scripts/analyze_physics_trace.py", "missing-trace-analyzer-path"),
            ("scripts/compare_replay_hashes.py", "missing-replay-comparator-path"),
        ):
            with self.subTest(path=path):
                self.assertIn(code, applied_response_violations(repaired.replace(path, "", 1)))
        self.assertIn(
            "step-layer-uses-threading-intervention",
            applied_response_violations(repaired.replace("不改变线程模式", "切换线程模式", 1)),
        )
        _, body = read_skill(SKILL)
        self.assertIn("Every applied response must literally name/use", body)
        self.assertIn("Layer 2 changes timing/scheduling only", body)

    def test_ui_source_audit_and_fail_state_evaluation_are_exact_and_self_contained(self):
        self.assertIn('display_name: "Physics Debugging and Testing"', UI.read_text(encoding="utf-8"))
        audit = AUDIT.read_text(encoding="utf-8")
        for url in (
            "https://box2d.org/documentation/md_simulation.html",
            "https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md",
            "https://pm.st.cs.uni-sb.de/papers/tse2002/?lang=en",
        ):
            self.assertIn(url, audit)
        self.assertNotIn("Units/scale, stable order", audit)
        self.assertIn("Claims used in SKILL.md", audit)
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "debugging-testing-physics")
        self.assertEqual(data["scenario"], SCENARIO.read_text(encoding="utf-8").removesuffix("\n"))
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ENABLED_ATTEMPT2.read_bytes())
        self.assertEqual(data["verdict"], "pass")
        observations = data["enabled"]["observations"]
        self.assertIn("passes", observations.lower())
        history = " ".join(data["evidence"])
        self.assertIn("c03ffbf7b30bc97cd4e7b93e2009aaade4dbac40422e2a3272b0aeb9da613e7b", history)
        self.assertIn("6ab7411689ff13e909802b43b3414c630d42c30d49b77a8c1bc70b5aa0cfaa8f", history)

    def test_artifacts_are_staged_and_a_fresh_git_archive_runs_this_suite(self):
        paths = (SKILL, UI, AUDIT, EVALUATION, SCENARIO, BASELINE, ENABLED_ATTEMPT1, ENABLED_ATTEMPT2)
        relative = [path.relative_to(ROOT).as_posix() for path in paths]
        if not (ROOT / ".git").exists():
            for item in relative:
                self.assertTrue((ROOT / item).is_file(), item)
            raw = BASELINE.read_bytes()
            self.assertEqual(len(raw), 5758)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), "87cc7680d38105bc4967cf8339649d0858bdce22c5585f054580f9255c12085e")
            return
        for item in relative:
            tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "--", item], cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(tracked.returncode, 0, item)
        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task15.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), tree], cwd=ROOT, check=True)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for item in relative:
                self.assertTrue((extract / item).is_file(), item)
            archived_baseline = extract / BASELINE.relative_to(ROOT)
            self.assertEqual(len(archived_baseline.read_bytes()), 5758)
            self.assertEqual(hashlib.sha256(archived_baseline.read_bytes()).hexdigest(), "87cc7680d38105bc4967cf8339649d0858bdce22c5585f054580f9255c12085e")
            archived_attempt = extract / ENABLED_ATTEMPT1.relative_to(ROOT)
            self.assertEqual(len(archived_attempt.read_bytes()), 6070)
            self.assertEqual(hashlib.sha256(archived_attempt.read_bytes()).hexdigest(), "c03ffbf7b30bc97cd4e7b93e2009aaade4dbac40422e2a3272b0aeb9da613e7b")
            archived_attempt2 = extract / ENABLED_ATTEMPT2.relative_to(ROOT)
            self.assertEqual(len(archived_attempt2.read_bytes()), 5349)
            self.assertEqual(hashlib.sha256(archived_attempt2.read_bytes()).hexdigest(), "6ab7411689ff13e909802b43b3414c630d42c30d49b77a8c1bc70b5aa0cfaa8f")
            environment = os.environ | {"TASK15_ARCHIVE_CHECK": "1"}
            subprocess.run([sys.executable, "-m", "unittest", "tests.test_debugging_testing_physics_skill"], cwd=extract, env=environment, check=True)


class DebuggingTestingPhysicsAvailabilityTests(unittest.TestCase):
    def test_debugging_testing_physics_skill_is_available(self):
        skill_names = {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()}
        self.assertIn("debugging-testing-physics", skill_names)

    def test_enabled_attempt1_fixture_is_tracked_before_it_is_assessed(self):
        fixtures = {path.name for path in (ROOT / "tests" / "fixtures").iterdir()}
        self.assertIn(ENABLED_ATTEMPT1.name, fixtures)

    def test_enabled_attempt2_fixture_is_tracked_before_it_is_assessed(self):
        fixtures = {path.name for path in (ROOT / "tests" / "fixtures").iterdir()}
        self.assertIn(ENABLED_ATTEMPT2.name, fixtures)


if __name__ == "__main__":
    unittest.main()
