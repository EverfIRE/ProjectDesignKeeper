"""Focused contract, mutation, and artifact tests for Task 14."""

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
SKILL = ROOT / "skills" / "networked-deterministic-physics" / "SKILL.md"
UI = ROOT / "skills" / "networked-deterministic-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "networked-deterministic-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "networked-deterministic-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-baseline-response.txt"
ENABLED_ATTEMPT1 = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-enabled-attempt-1-response.txt"
ENABLED_ATTEMPT2 = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-enabled-attempt-2-response.txt"
ENABLED_ATTEMPT3 = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-enabled-attempt-3-response.txt"
ENABLED_ATTEMPT4 = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-enabled-attempt-4-response.txt"
ENABLED_ATTEMPT5 = ROOT / "tests" / "fixtures" / "networked-deterministic-physics-enabled-attempt-5-response.txt"

HEADINGS = (
    "Network contract",
    "Determinism and state contract",
    "Prediction, rollback, and correction",
    "Acceptance",
)


def read_skill(path: Path) -> tuple[dict[str, str], str]:
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", path.read_text(encoding="utf-8"), re.DOTALL)
    if not match:
        raise AssertionError("SKILL.md must have YAML frontmatter")
    fields = {key: value.strip().strip('"') for key, value in (line.split(":", 1) for line in match.group(1).splitlines())}
    return fields, match.group(2)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


def policy_window_backlog_selection_violations(text: str) -> set[str]:
    """Require causal selection whose budget reference is grounded by the response."""
    network_contract = text.split("## Determinism and state contract", 1)[0]
    normalized = normalize(text)
    bandwidth_history_budget = bool(
        re.search(r"(?:bandwidth.{0,40}history-memory|history-memory.{0,40}bandwidth).{0,40}budget", normalized)
        or re.search(r"(?:带宽.{0,40}历史内存|历史内存.{0,40}带宽).{0,40}预算", normalized)
    )
    cpu_budget = bool(
        re.search(r"(?:cpu.{0,40}(?:budget|预算)|(?:budget|预算).{0,40}cpu|cpu p95.{0,40}4 ms)", normalized)
    )
    budget_grounding_is_contradicted = False
    for clause in re.split(r"[.;。；\n]+", normalized):
        names_budget = any(term in clause for term in ("budget", "预算")) and any(
            term in clause for term in ("bandwidth", "history-memory", "cpu", "带宽", "历史内存")
        )
        names_treatment = any(
            term in clause
            for term in (
                "missing-input",
                "missing input",
                "wait window",
                "backlog",
                "输入策略",
                "缺失输入",
                "等待窗口",
                "积压处理",
                "积压策略",
            )
        )
        negates_participation = any(
            term in clause
            for term in (
                "do not participate",
                "does not participate",
                "not used",
                "must not inform",
                "must not determine",
                "unrelated to",
                "不参与",
                "不用于",
                "不影响",
                "不决定",
                "不选择",
                "无关",
                "排除",
            )
        )
        if names_budget and names_treatment and negates_participation:
            budget_grounding_is_contradicted = True
            break
    for clause in re.split(r"[.;。；\n]+", normalize(network_contract)):
        has_envelope = all(term in clause for term in ("rtt", "jitter")) and all(
            any(term in clause for term in alternatives)
            for alternatives in (
                ("loss", "丢包"),
                ("reorder", "乱序"),
                ("fault-injection", "network-fault", "evidence", "measured", "measurement", "故障注入", "证据", "测量", "实测", "测得"),
            )
        )
        has_treatments = all(
            any(term in clause for term in alternatives)
            for alternatives in (
                ("missing-input policy", "missing/late-input policy", "输入缺失策略", "缺失输入策略"),
                ("wait window", "等待窗口"),
                ("backlog treatment", "backlog policy", "积压处理", "积压策略"),
            )
        )
        has_causality = any(term in clause for term in ("select", "determine", "derive", "choose", "选择", "选定", "决定", "推导"))
        has_budget_reference = any(term in clause for term in ("budget", "预算"))
        negates_causality = any(term in clause for term in ("does not select", "not selected", "never select", "cannot select", "不得由", "不能由", "不由"))
        if (
            has_envelope
            and has_treatments
            and has_causality
            and has_budget_reference
            and bandwidth_history_budget
            and cpu_budget
            and not budget_grounding_is_contradicted
            and not negates_causality
        ):
            return set()
    return {"missing-policy-window-backlog-selection-evidence"}


def network_response_violations(text: str) -> set[str]:
    """Reject omissions and Task 14 polarity shortcuts without evaluator fixtures."""
    normalized = normalize(text)
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    required = {
        "architecture": ("server-authoritative", "client prediction", "snapshot interpolation", "authoritative convergence", "anti-cheat"),
        "unknown-blockers": ("authority model", "platform/compiler/build/backend matrix", "active body/contact/constraint caps", "rtt, jitter, loss, reorder", "bandwidth/history-memory budgets", "permitted correction", "rollback window", "snapshot/hash rates", "determinism tier"),
        "timeline": ("60 hz gameplay tick", "sequence/tick/ack", "input quantization", "stable ordering", "late/duplicate/reordered", "render interpolation", "backlog"),
        "state": ("gameplay state", "rigid pose", "linear/angular velocity", "mass/inertia", "flags/sleep", "shapes/material/filter", "constraints/motors/warm-start", "contact/ccd/query caches", "rng streams/substreams", "authority/event cursors"),
        "environment": ("precision, rounding mode, denormals", "fma/simd", "math-library/compiler fast-math", "asset cooking", "backend/version"),
        "ordering": ("objects, shapes, constraints, contacts, inputs, events, rng streams", "broadphase/manifold/island/solver", "jobs, callbacks"),
        "serialization": ("schema/version, units, quantization, byte order, nan policy", "stable field/entity order"),
        "hashes": ("inputs, gameplay, physics, events, checkpoints", "first divergent tick", "smallest differing layer", "smallest differing state component", "scripts/compare_replay_hashes.py"),
        "rollback": ("tick-indexed inputs/full restorable states", "discard/rebuild invalid caches", "idempotent/tick-keyed", "cosmetics", "hard-resync"),
        "ab": ("a=current input-only cross-platform lockstep", "b=server authority + client prediction/rollback + snapshot interpolation", "no-thread/three-decimal/single-seed/ieee claims"),
        "scenarios": ("rest, piles, joint chains and motors", "sleep/wake", "ccd/high-speed impact", "simultaneous contacts", "spawn/despawn", "moving platforms", "rng and events", "authority transfer", "join-in-progress/reconnect", "history boundary", "loss/reorder/duplicates", "platform/build"),
        "metrics": ("layered hashes", "state diffs including caches/rng/events", "correction error", "rollback depth and resimulation ticks", "side-effect duplicates/cancellations", "snapshot bytes, bandwidth and history memory", "active bodies/contacts/constraints/islands", "cpu distributions for capture/hash/restore/resimulation", "cap misses and hard resyncs"),
        "outcomes": ("accept", "reject", "fatal", "server physics cpu p95 <= 4 ms"),
    }
    for code, phrases in required.items():
        if any(phrase not in normalized for phrase in phrases):
            violations.add(code)
    if not all(term in normalized for term in ("one local run", "same build/config", "same binary/architecture/platform", "cross-build/platform reproducibility", "authoritative convergence is not deterministic replay")):
        violations.add("tiers")
    if "same seed, ieee floating point, disabled threading, and rounding live state are not proof" not in normalized:
        violations.add("false-determinism-rejection")
    if "if engine-internal state cannot be captured or deterministically rebuilt, full rollback/lockstep is blocked" not in normalized:
        violations.add("rollback-blocker")
    if "do not round live simulation position/velocity to three decimals" not in normalized:
        violations.add("rounding-rejection")
    positive = {
        "false-cross-platform-proof": r"(?:same seed|ieee float|no threads|three-decimal).{0,90}\bprove(?:s)?\b.{0,50}cross-platform determinism",
        "input-only-lockstep": r"(?:retain|use|choose)\b.{0,30}input-only lockstep\b.{0,100}(?:without|no)\b.{0,40}(?:authority|correction)",
        "transform-velocity-snapshot": r"snapshots?\b.{0,30}(?:only|just)\b.{0,70}(?:transform|pose).{0,70}linear velocity",
        "invented-network-number": r"(?:snapshot|hash|rollback|tolerance|cap|rtt|jitter|loss).{0,24}\b\d+(?:\.\d+)?\s*(?:hz|ticks?|ms|%|bodies|contacts|constraints)",
        "invented-missing-input-window": r"(?:missing[- ]input|hold(?:ing)? (?:the )?last (?:valid )?input|保持.{0,20}(?:最后|上一).{0,20}输入).{0,30}(?:one|1|一)\s*(?:tick|帧)",
        "contradictory-client-authority": r"clients?\b.{0,50}\bauthoritative\b.{0,80}(?:gameplay|physics|state)",
    }
    for code, pattern in positive.items():
        if re.search(pattern, normalized):
            violations.add(code)
    if not re.search(r"parameterize.{0,80}missing-input policy/window.{0,100}backlog", normalized):
        violations.add("parameterized-missing-input")
    if not re.search(r"rtt/jitter/loss/reorder fault-injection evidence.{0,80}bandwidth/history-memory/cpu budgets.{0,140}each stays blocked until selected", normalized):
        violations.add("network-envelope-evidence")
    if not re.search(r"never set numeric/example defaults.{0,100}undeclared rates, thresholds, tolerances, caps, cadences, or windows", normalized):
        violations.add("no-invented-unknowns")
    violations.update(policy_window_backlog_selection_violations(text))
    return violations


def enabled_attempt1_violations(text: str) -> set[str]:
    """Narrow bilingual gate for the captured enabled attempt, not a pass oracle."""
    normalized = normalize(text)
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    required_groups = {
        "architecture": ("服务器权威", "客户端预测/回滚", "快照插值", "反作弊", "权威状态"),
        "unknown-blockers": ("平台/cpu/编译器/构建选项/物理后端矩阵", "最大活动刚体/接触/约束/island", "rtt/jitter/loss/reorder", "带宽和历史内存预算", "允许的校正误差", "回滚窗口", "快照与哈希频率", "确定性等级"),
        "state-and-environment": ("线速度和角速度", "约束/马达/warm-start", "contact/ccd/query cache", "rng stream/substream", "fma/simd", "fast-math", "资产烘焙", "nan 策略"),
        "ordering-and-correction": ("稳定 id 和稳定排序", "丢弃或按确定规则重建失效 cache", "权威 tick + 事件 id", "hard-resync"),
        "ab-coverage-metrics": ("a 为当前跨平台纯输入 lockstep", "b 为服务器权威、客户端预测/回滚、远端快照插值", "断线重连/中途加入", "快照字节数/带宽/历史内存", "服务器物理 cpu p95 ≤ 4 ms"),
    }
    for code, phrases in required_groups.items():
        if any(phrase not in normalized for phrase in phrases):
            violations.add(code)
    if "scripts/compare_replay_hashes.py" not in text:
        violations.add("missing-bundled-comparator")
    if not re.search(r"(?:最小分歧(?:层|状态组件)|smallest differing (?:layer|state component)).{0,36}(?:状态组件|state component)", normalized):
        violations.add("missing-smallest-state-component")
    if not all(term in normalized for term in ("同构建/配置", "同二进制/架构/平台", "跨构建/平台")):
        violations.add("incomplete-repeatability-tier-qualifiers")
    return violations


def enabled_attempt2_violations(text: str) -> set[str]:
    """Attempt 2 fixes attempt 1 but must not invent the missing-input window."""
    violations: set[str] = set()
    if re.search(r"(?:保持最后一个有效输入一\s*tick|hold(?:ing)? (?:the )?last (?:valid )?input.{0,12}(?:one|1)\s*tick)", normalize(text)):
        violations.add("invented-missing-input-window")
    return violations


def enabled_attempt3_violations(text: str) -> set[str]:
    """Attempt 3 must tie the undeclared input policy/window to determining evidence."""
    network_contract = text.split("## Determinism and state contract", 1)[0]
    if re.search(r"(?:缺失输入|missing[- ]input).{0,100}(?:证据|测量|fault injection|network-fault)", normalize(network_contract)):
        return set()
    return {"missing-input-evidence-determination"}


def enabled_attempt4_violations(text: str) -> set[str]:
    """Attempt 4 declares the unknowns but does not select each with the envelope evidence."""
    return policy_window_backlog_selection_violations(text)


def assert_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter == {
        "name": "networked-deterministic-physics",
        "description": "Use when multiplayer physics, rollback, lockstep, prediction, snapshots, reconciliation, or cross-platform determinism need an explicit network contract.",
    }
    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    assert network_response_violations(body) == set(), network_response_violations(body)
    for api in ("Rigidbody", "PxScene", "PhysicsSystem", "BodyInterface", "NetworkTransform"):
        assert api not in body


class NetworkedDeterministicPhysicsSkillTests(unittest.TestCase):
    def test_networked_deterministic_physics_skill_is_available(self):
        skill_names = {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()}
        self.assertIn("networked-deterministic-physics", skill_names)

    def test_skill_contract_is_complete_engine_neutral_and_bounded(self):
        frontmatter, body = read_skill(SKILL)
        assert_skill_contract(frontmatter, body)

    def test_required_contract_phrases_are_deletion_protected(self):
        frontmatter, body = read_skill(SKILL)
        for phrase, code in (
            ("server-authoritative", "architecture"),
            ("Same seed, IEEE floating point, disabled threading, and rounding live state are not proof", "false-determinism-rejection"),
            ("schema/version, units, quantization, byte order, NaN policy", "serialization"),
            ("scripts/compare_replay_hashes.py", "hashes"),
            ("discard/rebuild invalid caches", "rollback"),
            ("server physics CPU p95 <= 4 ms", "outcomes"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                self.assertIn(code, network_response_violations(body.replace(phrase, "", 1)))
                with self.assertRaises(AssertionError):
                    assert_skill_contract(frontmatter, body.replace(phrase, "", 1))

    def test_mutation_gate_rejects_realistic_polarity_variants(self):
        _, body = read_skill(SKILL)
        mutations = {
            "false-cross-platform-proof": "Same seed, IEEE float, no threads, and three-decimal live-state rounding prove cross-platform determinism.",
            "input-only-lockstep": "Use input-only lockstep without authority or correction.",
            "transform-velocity-snapshot": "Snapshots contain only transform and linear velocity.",
            "invented-network-number": "Send a snapshot at 20 Hz before budgets are measured.",
            "invented-missing-input-window": "Hold the last valid input for one tick before declared policy and windows exist.",
            "contradictory-client-authority": "Clients are authoritative for gameplay physics state.",
        }
        for expected, mutation in mutations.items():
            with self.subTest(expected=expected):
                self.assertIn(expected, network_response_violations(f"{body}\n{mutation}"))

    def test_exact_baseline_is_tracked_and_fails_named_contract_gates(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 6618)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "5b1175bb117f893063f16433f83c337e314256a37d99750c2660cee5d14413a5")
        violations = network_response_violations(raw.decode("utf-8"))
        self.assertTrue({"headings", "serialization", "hashes", "rollback", "ab", "tiers", "outcomes"}.issubset(violations), violations)

    def test_exact_enabled_attempt_is_tracked_and_truthfully_remains_failed(self):
        raw = ENABLED_ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), 5223)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "f159f7d8ca5d788e8efaecf71baa7281da6d25c24913e52ba1ec5e63d1926b2c")
        self.assertEqual(
            enabled_attempt1_violations(raw.decode("utf-8")),
            {
                "incomplete-repeatability-tier-qualifiers",
                "missing-bundled-comparator",
                "missing-smallest-state-component",
            },
        )

    def test_exact_enabled_attempt2_is_tracked_and_rejects_the_invented_input_window(self):
        raw = ENABLED_ATTEMPT2.read_bytes()
        self.assertEqual(len(raw), 5352)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "a47d3c8ea3b9303673bf098db8d56bb46b1d08c1750914d609f6675cc9f57948")
        self.assertEqual(enabled_attempt2_violations(raw.decode("utf-8")), {"invented-missing-input-window"})

    def test_exact_enabled_attempt3_is_tracked_and_requires_missing_input_evidence(self):
        raw = ENABLED_ATTEMPT3.read_bytes()
        self.assertEqual(len(raw), 4996)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "29f826ebea8ec771589d1f363cad801b5e7d8f19ff4ff9b152cfd3bb51de2078")
        self.assertEqual(enabled_attempt3_violations(raw.decode("utf-8")), {"missing-input-evidence-determination"})

    def test_exact_enabled_attempt4_is_tracked_and_requires_policy_window_backlog_selection_evidence(self):
        raw = ENABLED_ATTEMPT4.read_bytes()
        self.assertEqual(len(raw), 5559)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "f42c56ac9ea19a6a0c3efa72ae1e4cde65795644f9cee50a29592a9083062ace")
        self.assertEqual(enabled_attempt4_violations(raw.decode("utf-8")), {"missing-policy-window-backlog-selection-evidence"})

    def test_exact_enabled_attempt5_is_tracked_and_substantively_passes(self):
        raw = ENABLED_ATTEMPT5.read_bytes()
        self.assertEqual(len(raw), 5026)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "1b435b99ea8dbc6da3e50f39e3d3eb04ac81c4ead4329f2eed32c16119af353f")
        response = raw.decode("utf-8")
        self.assertEqual(re.findall(r"^## (.+)$", response, re.MULTILINE), list(HEADINGS))
        self.assertEqual(enabled_attempt4_violations(response), set())

    def test_attempt5_cross_sentence_budget_reference_is_semantically_complete(self):
        response = ENABLED_ATTEMPT5.read_text(encoding="utf-8")
        self.assertEqual(enabled_attempt4_violations(response), set())
        mutations = {
            "missing-measurement-evidence": response.replace("实测 RTT", "RTT", 1),
            "missing-budget-reference": response.replace("及预算结果", "", 1),
            "negative-causality": response.replace("必须由实测", "不得由实测", 1),
            "missing-wait-window": response.replace("等待窗口和", "", 1),
            "missing-bandwidth-history-budget": response.replace("带宽与历史内存预算", "", 1).replace("历史内存与带宽预算", "", 1),
            "missing-cpu-budget": response.replace("服务器物理 CPU p95 必须不高于 4 ms", "", 1),
        }
        for name, mutation in mutations.items():
            with self.subTest(name=name):
                self.assertEqual(
                    enabled_attempt4_violations(mutation),
                    {"missing-policy-window-backlog-selection-evidence"},
                )

    def test_cross_sentence_budget_grounding_rejects_explicit_nonparticipation(self):
        response = ENABLED_ATTEMPT5.read_text(encoding="utf-8")
        contradictions = (
            "带宽与历史内存预算不参与选择缺失输入策略、等待窗口或积压处理。",
            "CPU 预算不用于决定缺失输入策略、等待窗口或积压处理。",
            "Bandwidth/history-memory and CPU budgets do not participate in selecting missing-input policy, wait window, or backlog treatment.",
        )
        for contradiction in contradictions:
            with self.subTest(contradiction=contradiction):
                mutation = response.replace("## Determinism and state contract", contradiction + "\n\n## Determinism and state contract", 1)
                self.assertEqual(
                    enabled_attempt4_violations(mutation),
                    {"missing-policy-window-backlog-selection-evidence"},
                )

    def test_budget_treatment_negation_does_not_require_a_positive_selection_verb(self):
        response = ENABLED_ATTEMPT5.read_text(encoding="utf-8")
        contradictions = (
            "Bandwidth/history-memory and CPU budgets are unrelated to missing-input policy, wait window, or backlog treatment.",
            "Bandwidth/history-memory and CPU budgets are not used for missing-input policy, wait window, or backlog treatment.",
            "带宽与历史内存预算与缺失输入策略、等待窗口或积压处理无关。",
            "CPU 预算与缺失输入策略、等待窗口或积压处理无关。",
        )
        for contradiction in contradictions:
            with self.subTest(contradiction=contradiction):
                mutation = response.replace("## Determinism and state contract", contradiction + "\n\n## Determinism and state contract", 1)
                self.assertEqual(
                    enabled_attempt4_violations(mutation),
                    {"missing-policy-window-backlog-selection-evidence"},
                )
        generic = response.replace(
            "## Determinism and state contract",
            "Bandwidth and CPU budget dashboards are unrelated to presentation telemetry.\n\n## Determinism and state contract",
            1,
        )
        self.assertEqual(enabled_attempt4_violations(generic), set())

    def test_attempt4_regression_requires_causal_selection_of_each_network_treatment(self):
        """The exact failure must become a semantic mutation/deletion gate for the skill."""
        attempt4 = ENABLED_ATTEMPT4.read_text(encoding="utf-8")
        self.assertEqual(
            enabled_attempt4_violations(attempt4),
            {"missing-policy-window-backlog-selection-evidence"},
        )
        causal_mapping = (
            "测得的 RTT、jitter、丢包、乱序故障注入证据在带宽、历史内存和 CPU 预算约束下"
            "决定输入缺失策略、等待窗口和积压处理。\n\n"
        )
        repaired_attempt4 = attempt4.replace(
            "定义带版本的输入/快照协议",
            causal_mapping + "定义带版本的输入/快照协议",
            1,
        )
        self.assertEqual(enabled_attempt4_violations(repaired_attempt4), set())
        _, body = read_skill(SKILL)
        selection_clause = next(clause for clause in body.split(". ") if "selects each" in clause)
        for phrase in (
            "fault-injection evidence",
            "bandwidth/history-memory/CPU budgets",
            "selects each",
            "missing-input policy",
            "wait window",
            "backlog treatment",
        ):
            with self.subTest(phrase=phrase):
                changed_clause = selection_clause.replace(phrase, "", 1)
                if phrase == "fault-injection evidence":
                    changed_clause = changed_clause.replace("Measured ", "", 1)
                mutation = body.replace(selection_clause, changed_clause, 1)
                self.assertIn(
                    "missing-policy-window-backlog-selection-evidence",
                    network_response_violations(mutation),
                )

    def test_attempt3_regression_requires_network_envelope_evidence_for_policy_window_and_backlog(self):
        """The RED capture remains failed until a future enabled response replaces it."""
        self.assertEqual(
            enabled_attempt3_violations(ENABLED_ATTEMPT3.read_text(encoding="utf-8")),
            {"missing-input-evidence-determination"},
        )

    def test_attempt2_regression_requires_parameterized_missing_input_policy(self):
        """The RED capture remains failed until a future enabled response replaces it."""
        self.assertEqual(
            enabled_attempt2_violations(ENABLED_ATTEMPT2.read_text(encoding="utf-8")),
            {"invented-missing-input-window"},
        )

    def test_missing_input_and_unknown_numeric_defaults_are_independently_protected(self):
        _, body = read_skill(SKILL)
        for phrase, code in (
            ("Parameterize missing-input policy/window", "parameterized-missing-input"),
            ("each stays blocked until selected", "network-envelope-evidence"),
            ("RTT/jitter/loss/reorder fault-injection evidence", "missing-policy-window-backlog-selection-evidence"),
            ("bandwidth/history-memory/CPU budgets", "missing-policy-window-backlog-selection-evidence"),
            ("Never set numeric/example defaults", "no-invented-unknowns"),
            ("undeclared rates, thresholds, tolerances, caps, cadences, or windows", "no-invented-unknowns"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                self.assertIn(code, network_response_violations(body.replace(phrase, "", 1)))

    def test_attempt1_regression_preserves_the_three_required_omissions(self):
        """The RED capture stays failed until a future enabled response replaces it."""
        response = ENABLED_ATTEMPT1.read_text(encoding="utf-8")
        self.assertEqual(
            enabled_attempt1_violations(response),
            {
                "incomplete-repeatability-tier-qualifiers",
                "missing-bundled-comparator",
                "missing-smallest-state-component",
            },
        )

    def test_tier_and_replay_evidence_details_are_independently_deletion_protected(self):
        _, body = read_skill(SKILL)
        for phrase, code in (
            ("one local run", "tiers"),
            ("same build/config", "tiers"),
            ("same binary/architecture/platform", "tiers"),
            ("cross-build/platform reproducibility", "tiers"),
            ("authoritative convergence is not deterministic replay", "tiers"),
            ("scripts/compare_replay_hashes.py", "hashes"),
            ("smallest differing layer", "hashes"),
            ("smallest differing state component", "hashes"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                self.assertIn(code, network_response_violations(body.replace(phrase, "", 1)))

    def test_source_audit_records_only_read_primary_or_official_sources(self):
        audit = AUDIT.read_text(encoding="utf-8")
        for url in (
            "https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md",
            "https://github.com/mas-bandwidth/gafferongames/blob/main/content/post/what_every_programmer_needs_to_know_about_game_networking.md",
            "https://gafferongames.com/post/state_synchronization/",
            "https://gafferongames.com/post/snapshot_interpolation/",
            "https://www.gafferongames.com/post/client_server_connection/",
        ):
            self.assertIn(url, audit)
        self.assertIn("Claims used in SKILL.md", audit)
        self.assertIn("2026-08-27", audit)

    def test_ui_and_evaluation_preserve_the_exact_latest_attempt_and_history(self):
        ui = UI.read_text(encoding="utf-8")
        self.assertIn('display_name: "Networked Deterministic Physics"', ui)
        self.assertIn("Use $networked-deterministic-physics", ui)
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "networked-deterministic-physics")
        exact_scenario = SCENARIO.read_text(encoding="utf-8").removesuffix("\n")
        self.assertEqual(len(exact_scenario), 533)
        self.assertEqual(data["scenario"], exact_scenario)
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ENABLED_ATTEMPT5.read_bytes())
        self.assertEqual(data["verdict"], "pass")
        self.assertIn("cross-sentence", data["enabled"]["observations"].lower())
        history = " ".join(data["evidence"])
        self.assertIn("f159f7d8ca5d788e8efaecf71baa7281da6d25c24913e52ba1ec5e63d1926b2c", history)
        self.assertIn("a47d3c8ea3b9303673bf098db8d56bb46b1d08c1750914d609f6675cc9f57948", history)
        self.assertIn("29f826ebea8ec771589d1f363cad801b5e7d8f19ff4ff9b152cfd3bb51de2078", history)
        self.assertIn("f42c56ac9ea19a6a0c3efa72ae1e4cde65795644f9cee50a29592a9083062ace", history)
        self.assertIn("1b435b99ea8dbc6da3e50f39e3d3eb04ac81c4ead4329f2eed32c16119af353f", history)

    def test_artifacts_are_tracked_and_a_fresh_git_archive_contains_every_opened_file(self):
        paths = (SKILL, UI, AUDIT, EVALUATION, SCENARIO, BASELINE, ENABLED_ATTEMPT1, ENABLED_ATTEMPT2, ENABLED_ATTEMPT3, ENABLED_ATTEMPT4, ENABLED_ATTEMPT5)
        relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
        if not (ROOT / ".git").exists():
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((ROOT / relative).is_file())
            return
        for relative in relative_paths:
            tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "--", relative], cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(tracked.returncode, 0, relative)
        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task14.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), tree], cwd=ROOT, check=True)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for relative in relative_paths:
                with self.subTest(relative=relative):
                    self.assertTrue((extract / relative).is_file())
            archived_baseline = extract / BASELINE.relative_to(ROOT)
            self.assertEqual(len(archived_baseline.read_bytes()), 6618)
            self.assertEqual(
                hashlib.sha256(archived_baseline.read_bytes()).hexdigest(),
                "5b1175bb117f893063f16433f83c337e314256a37d99750c2660cee5d14413a5",
            )
            archived_enabled = extract / ENABLED_ATTEMPT1.relative_to(ROOT)
            self.assertEqual(len(archived_enabled.read_bytes()), 5223)
            self.assertEqual(
                hashlib.sha256(archived_enabled.read_bytes()).hexdigest(),
                "f159f7d8ca5d788e8efaecf71baa7281da6d25c24913e52ba1ec5e63d1926b2c",
            )
            archived_enabled2 = extract / ENABLED_ATTEMPT2.relative_to(ROOT)
            self.assertEqual(len(archived_enabled2.read_bytes()), 5352)
            self.assertEqual(
                hashlib.sha256(archived_enabled2.read_bytes()).hexdigest(),
                "a47d3c8ea3b9303673bf098db8d56bb46b1d08c1750914d609f6675cc9f57948",
            )
            archived_enabled3 = extract / ENABLED_ATTEMPT3.relative_to(ROOT)
            self.assertEqual(len(archived_enabled3.read_bytes()), 4996)
            self.assertEqual(
                hashlib.sha256(archived_enabled3.read_bytes()).hexdigest(),
                "29f826ebea8ec771589d1f363cad801b5e7d8f19ff4ff9b152cfd3bb51de2078",
            )
            archived_enabled4 = extract / ENABLED_ATTEMPT4.relative_to(ROOT)
            self.assertEqual(len(archived_enabled4.read_bytes()), 5559)
            self.assertEqual(
                hashlib.sha256(archived_enabled4.read_bytes()).hexdigest(),
                "f42c56ac9ea19a6a0c3efa72ae1e4cde65795644f9cee50a29592a9083062ace",
            )
            archived_enabled5 = extract / ENABLED_ATTEMPT5.relative_to(ROOT)
            self.assertEqual(len(archived_enabled5.read_bytes()), 5026)
            self.assertEqual(
                hashlib.sha256(archived_enabled5.read_bytes()).hexdigest(),
                "1b435b99ea8dbc6da3e50f39e3d3eb04ac81c4ead4329f2eed32c16119af353f",
            )
            environment = os.environ | {"TASK14_ARCHIVE_CHECK": "1"}
            subprocess.run(
                [sys.executable, "-m", "unittest", "tests.test_networked_deterministic_physics_skill"],
                cwd=extract,
                env=environment,
                check=True,
            )


if __name__ == "__main__":
    unittest.main()
