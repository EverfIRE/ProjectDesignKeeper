"""Focused Phase-A contract, mutation, provenance, and archive tests."""

import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
import unittest

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "profiling-scaling-physics" / "SKILL.md"
UI = ROOT / "skills" / "profiling-scaling-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "profiling-scaling-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "profiling-scaling-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "profiling-scaling-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "profiling-scaling-physics-baseline-response.txt"
ENABLED_ATTEMPT1 = ROOT / "tests" / "fixtures" / "profiling-scaling-physics-enabled-attempt-1-response.txt"
ENABLED_ATTEMPT2 = ROOT / "tests" / "fixtures" / "profiling-scaling-physics-enabled-attempt-2-response.txt"
ENABLED_ATTEMPT3 = ROOT / "tests" / "fixtures" / "profiling-scaling-physics-enabled-attempt-3-response.txt"

HEADINGS = (
    "Budget and capture contract",
    "Attribution and scaling",
    "Reversible quality tiers",
    "Acceptance",
)


def read_skill(path: Path) -> tuple[dict[str, str], str]:
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", path.read_text(encoding="utf-8"), re.DOTALL)
    if not match:
        raise AssertionError("SKILL.md must have YAML frontmatter")
    return {
        key: value.strip().strip('"')
        for key, value in (line.split(":", 1) for line in match.group(1).splitlines())
    }, match.group(2)


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


def section(text: str, heading: str) -> str:
    """Return one headed answer section without relying on paragraph order inside it."""
    match = re.search(rf"^## {re.escape(heading)}\s*$([\s\S]*?)(?=^## |\Z)", text, re.MULTILINE)
    return "" if match is None else match.group(1)


def facts_present(text: str, facts: tuple[tuple[str, ...], ...]) -> bool:
    """Each fact has EN/ZH semantic alternatives; avoid a single answer template."""
    value = normalized(text)
    return all(any(option in value for option in alternatives) for alternatives in facts)


def role_clauses(text: str, role: str) -> list[str]:
    """Collect marker-bounded A/B spans; repeated same-role references stay merged."""
    marker = re.compile(r"(?:\b[AB]\b\s*(?:is|为|是|组|中|:|：)|[AB]\s*(?:中|：|:)|\bin\s+[AB]\b\s*[,，:：])", re.IGNORECASE)
    spans = list(marker.finditer(text))
    selected: list[str] = []
    selected_marker = re.compile(rf"(?:\b{role}\b\s*(?:is|为|是|组|中|:|：)|{role}\s*(?:中|：|:)|\bin\s+{role}\b\s*[,，:：])", re.IGNORECASE)
    for index, match in enumerate(spans):
        if selected_marker.fullmatch(match.group(0)):
            same_previous_role = index and selected_marker.fullmatch(spans[index - 1].group(0))
            between_markers = text[spans[index - 1].end():match.start()] if index else ""
            if same_previous_role and not re.search(r"[。.!?！？\n]", between_markers):
                continue
            next_marker = next(
                (candidate.start() for candidate in spans[index + 1:] if not selected_marker.fullmatch(candidate.group(0))),
                len(text),
            )
            terminator = re.search(r"[。.!?！？\n]", text[match.end():])
            sentence_end = match.end() + terminator.start() if terminator else len(text)
            end = min(next_marker, sentence_end)
            selected.append(text[match.start():end])
    return selected


def proposal_batch_present(text: str) -> bool:
    value = normalized(text)
    half_iterations = bool(re.search(r"(?:half|halve|halved|减半|半)[-\s]*(?:solver[-\s]*)?(?:iterations?|迭代)|(?:iterations?|迭代)[-\s]*(?:halved|减半)", value))
    every_four_ticks = bool(re.search(r"(?:every|each|每)\s*[- ]?4\s*[- ]?ticks?|4\s*[- ]?tick", value))
    return half_iterations and "ccd" in value and every_four_ticks and "gpu" in value


def disabled_batch_in_role(text: str, role: str) -> bool:
    return any(
        proposal_batch_present(clause)
        and any(token in normalized(clause) for token in ("disabled", "disable", "禁用", "关闭"))
        for clause in role_clauses(text, role)
    )


def has_exact_ab_contract(text: str) -> bool:
    """Accept semantic EN/ZH variants, but require all paired comparison facts."""
    value = normalized(text)
    original_unmatched = (
        all(token in value for token in ("120 fps", "138 fps", "unmatched"))
        or all(token in value for token in ("120 fps", "138 fps"))
        and any(token in value for token in ("不匹配", "未匹配"))
        or all(token in value for token in ("current", "unmatched", "fps"))
        or all(token in value for token in ("当前", "未匹配", "fps"))
    )
    a_clauses = role_clauses(text, "A")
    a_current = any(
        facts_present(clause, (("current", "当前", "restored", "恢复当前", "恢复"),))
        for clause in a_clauses
    )
    b_clauses = role_clauses(text, "B")
    b_matched_single_change = any(
        facts_present(clause, (
            ("matched", "匹配", "same manifest", "同一 a manifest", "同一清单", "exact a manifest"),
            ("one", "一个", "仅启用一个", "只改一个"),
            ("change", "改动", "因素"),
        ))
        for clause in b_clauses
    )
    identical_evidence = any(
        facts_present(clause, (
            ("identical", "相同", "完全一致"),
            ("correctness", "正确性"),
            ("cpu/gpu timelines", "cpu/gpu timeline", "cpu/gpu 时间线"),
        ))
        for clause in b_clauses
    )
    return original_unmatched and a_current and disabled_batch_in_role(text, "A") and b_matched_single_change and identical_evidence


def answer_contract_violations(text: str) -> set[str]:
    """Require complete answer evidence by section and role, with bilingual fact variants."""
    budget = section(text, "Budget and capture contract")
    attribution = section(text, "Attribution and scaling")
    tiers = section(text, "Reversible quality tiers")
    acceptance = section(text, "Acceptance")
    required = {
        "answer-manifest-unknowns": (budget, (
            ("capture manifest", "捕获清单"), ("authority", "权威"),
            ("cpu",), ("gpu",), ("core", "核心"), ("power", "功耗"), ("thermal", "温控", "热状态"),
            ("os",), ("driver", "驱动"), ("compiler", "编译器"), ("build",), ("backend", "后端"),
            ("thread", "线程"), ("affinity", "亲和"), ("memory", "内存"),
            ("unknown", "未声明", "未知"), ("blocker", "阻塞"),
        )),
        "answer-manifest-tick-accumulator-backlog": (budget, (
            ("fixed 60 hz", "fixed 60hz", "固定 60 hz"), ("tick",), ("accumulator",), ("backlog",),
        )),
        "answer-manifest-display-capture": (budget, (
            ("camera", "相机"), ("resolution", "分辨率"), ("vsync",), ("render cap", "帧率上限"),
        )),
        "answer-manifest-scene-inputs": (budget, (
            ("scene", "场景"), ("assets", "资源"), ("seed", "种子"), ("ordered inputs", "有序输入"),
        )),
        "answer-manifest-network-rollback": (budget, (
            ("network envelope", "network load", "网络包络", "网络负载"), ("rollback history", "rollback 历史"),
        )),
        "answer-manifest-sampling-confidence": (budget, (
            ("warm-up", "热身"), ("sample", "采样"), ("repeat", "重复"), ("confidence", "置信"),
        )),
        "answer-manifest-physics-budget": (budget, (("physics budget", "physics 预算"),)),
        "answer-manifest-capacity-quality": (budget, (
            ("capacity", "容量"), ("correctness", "正确性"), ("quality", "质量"),
        )),
        "answer-distributions": (budget, (
            ("wall-clock", "墙钟"), ("cpu",), ("gpu",), ("ms", "毫秒"), ("p50",), ("p95",), ("p99",),
            ("max",), ("deadline",), ("over-budget", "超预算"), ("backlog",), ("resimulation debt", "resimulation debt"),
        )),
        "answer-counters-timelines": (budget, (
            ("active", "sleeping", "active/sleeping"), ("body", "bodies", "物体"), ("shape",),
            ("broadphase",), ("narrowphase",), ("manifold",), ("contact",), ("island",),
            ("constraint",), ("iteration", "迭代"), ("ccd",), ("toi",), ("query",),
            ("callback", "event", "回调"), ("spawn",), ("despawn",), ("rollback",),
            ("allocation", "分配"), ("working", "工作集"), ("timeline", "时间线"),
            ("job queue", "job queue", "作业"), ("critical path", "关键路径"), ("timestamp", "时间戳"),
            ("queue", "队列"), ("transfer", "传输"), ("synchron", "同步"), ("overlap", "重叠"),
        )),
        "answer-attribution": (attribution, (
            ("input/restore",), ("broadphase",), ("narrowphase",), ("island build",), ("constraint solve",),
            ("integrate/ccd",), ("query",), ("serialization",), ("critical path", "关键路径"),
            ("normalize", "归一化"), ("one factor", "一次只改变一个", "单因素"), ("causality", "因果"),
        )),
        "answer-scaling": (attribution, (
            ("awake",), ("churn",), ("density", "密度"), ("island",), ("conditioning", "条件数"),
            ("ccd",), ("query mix",), ("spawn",), ("rollback",), ("thread", "线程"), ("hardware", "硬件"),
            ("rest/sleep", "静止/睡眠"), ("pile avalanche",), ("joint chain",), ("ccd swarm",),
            ("query storm",), ("streaming churn",), ("network-history", "网络历史"),
            ("slope", "斜率"), ("knee", "拐点"), ("saturation", "饱和"), ("tail", "尾部"),
            ("do not extrapolate", "禁止外推", "不外推"),
        )),
        "answer-gpu": (attribution, (
            ("upload", "上传"), ("readback", "回读"), ("queue", "排队"), ("synchron", "同步"),
            ("latency", "延迟"), ("determinism", "确定性"), ("authority", "权威"), ("fallback",),
            ("memory", "内存"), ("crossover",), ("correctness matrix", "正确性矩阵"),
        )),
        "answer-tiers": (tiers, (
            ("authoritative", "权威"), ("cosmetic", "secondary", "非权威"), ("eligible", "适用工作负载"),
            ("invariant", "不变量"), ("entry", "进入"), ("exit", "退出"), ("independent", "独立"),
            ("threshold", "阈值"), ("hysteresis", "滞回"), ("residency", "驻留"), ("bounded", "上界", "受限"),
            ("state mapping", "状态映射"), ("conservation", "守恒"), ("network", "网络"), ("event", "事件"),
            ("telemetry", "遥测"), ("rollback",), ("upshift", "退出", "可逆"), ("no per-frame fps", "逐帧 fps"),
        )),
        "answer-unknown-experiments": (tiers, (
            ("unknown", "未知"), ("error-versus-cost",), ("fault/load", "故障/负载"),
            ("one-at-a-time", "单变量", "一次一个", "分别作为"),
        )),
        "answer-acceptance": (f"{attribution}\n{acceptance}", (
            ("matched manifest", "匹配 manifest"), ("distribution", "分布"), ("counter", "计数"),
            ("bottleneck", "瓶颈"), ("correctness", "正确性"), ("invariant", "不变量"), ("network", "网络"),
            ("hidden work", "隐藏工作"), ("60 hz",), ("3 ms",), ("client", "客户端"), ("cpu",), ("gpu",),
            ("memory", "内存"), ("capacity", "容量"), ("worst-case matrix", "最坏场景矩阵"), ("reversible", "可逆"),
            ("average", "平均"), ("non-finite", "非有限"), ("restore",), ("instrumentation", "instrumentation"),
            ("dropped authoritative", "丢失权威"), ("cap",), ("incompatible", "不兼容"),
        )),
    }
    violations = {code for code, (content, facts) in required.items() if not facts_present(content, facts)}
    if violations:
        violations.add("missing-answer-contract")
    return violations


def contract_violations(text: str) -> set[str]:
    value = normalized(text)
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    required = {
        "fps-attribution": ("fps reciprocal", "end-to-end", "confounded", "do not call b 15% faster", "matched capture"),
        "manifest": ("versioned capture manifest", "client/server authority", "cpu/gpu/core count/power/thermal", "os/driver/compiler/build/backend/version", "physics tick and accumulator/backlog", "resolution/camera/vsync/render cap", "scene/assets/seed/ordered inputs", "network envelope/rollback history", "thread/job/affinity", "warm-up/capture/repetition/confidence", "memory/physics budgets", "unknown values remain blockers"),
        "distribution": ("wall-clock physics cpu/gpu milliseconds", "p50/p95/p99", "max", "deadline misses", "over-budget area/time", "resimulation debt", "per-thread/core timelines", "job queue/wait/steal/synchronization/idle", "critical path", "timestamps", "queue occupancy", "transfers", "asynchronous overlap", "measurement overhead"),
        "counters": ("active/sleeping bodies/shapes", "broadphase moves/pairs", "narrowphase pairs/manifolds/contact points", "islands", "constraints/rows/iterations", "ccd candidates/toi", "queries by type/count/hits/candidates", "callbacks/events", "spawn/despawn", "rollback depth/resimulated ticks", "allocations", "peak/working memory", "scripts/analyze_physics_trace.py"),
        "attribution": ("coarse stages first", "input/restore", "broadphase", "narrowphase/contact generation", "island build", "constraint solve", "integrate/ccd", "queries/callbacks", "serialization/hash", "dominant critical-path stage", "normalize per body/pair/contact/row/query/resim tick", "one factor", "correlation or lower fps is not causality"),
        "ab": ("a: restored/current unmatched fps-only comparison", "every simultaneous half-iterations/no-ccd/4-tick/gpu proposal disabled", "b matched capture starts from that exact a manifest", "exactly one named isolated change", "identical correctness checks", "cpu/gpu timelines", "fixed 60 hz", "server physics cpu p95 <= 3 ms"),
        "applied-response-contract": ("every applied response names/uses", "scripts/analyze_physics_trace.py", "distribution/counter evidence", "exact a manifest"),
        "sweeps": ("declared scene capacity", "independent workload axes", "awake bodies", "broadphase churn", "contact density/manifold points", "island size/count", "constraint rows/conditioning", "ccd workload", "query mix", "spawn/despawn", "rollback/resimulation", "thread count", "target hardware", "rest/sleep", "pile avalanche", "joint chain/motor", "ccd swarm", "query storm", "streaming churn", "network-history-boundary", "scaling slope", "knee", "saturation/imbalance", "tail behavior", "do not extrapolate"),
        "gpu": ("measured end-to-end option", "upload/readback", "queueing", "synchronization", "latency", "determinism/authority", "fallback", "memory", "small-workload crossover", "correctness matrix"),
        "tiers": ("only after baseline attribution", "authoritative gameplay", "cosmetic/secondary", "downshift/upshift", "eligible workload", "protected invariants", "entry/exit signals", "independent measured thresholds", "hysteresis/residency", "bounded transition work", "state mapping/conservation", "network authority/event semantics", "telemetry", "rollback", "no per-frame fps toggling", "deterministic/observable"),
        "unknowns": ("iterations/ccd/frequency/tier thresholds unknown", "error-versus-cost", "fault/load sweeps", "rejected baseline or one-at-a-time experiments"),
        "acceptance": ("matched manifests", "old/new distributions/counters", "bottleneck attribution", "identical correctness/invariant/network results", "no hidden work migration", "declared client cpu/gpu, memory/tail/capacity budgets", "stable reversible tier transitions", "worst-case matrix pass", "reject averages-only", "fatal-stop", "non-finite state", "corrupted authority/restore", "missing instrumentation", "dropped authoritative work", "unsafe cap/budget breach", "incompatible capture"),
    }
    for code, phrases in required.items():
        if any(phrase not in value for phrase in phrases):
            violations.add(code)
    return violations


def applied_response_violations(text: str, *, require_contract: bool = False) -> set[str]:
    """Reject affirmative EN/ZH unsafe claims while allowing rejected baselines."""
    violations: set[str] = set()
    for clause in re.split(r"[。!?\r\n]+", text.casefold()):
        rejected = any(token in clause for token in (
            "reject", "rejected", "not a win", "not a fix", "never", "do not", "does not", "must not", "disabled",
            "拒绝", "不是", "不得", "不能", "不应", "不可", "仅作为", "禁用",
        ))
        intent = any(token in clause for token in (
            "merge", "faster", "win", "fix", "accept", "recommend", "suggest", "adopt", "apply", "use", "set", "toggle", "cull",
            "合并", "更快", "胜", "修复", "验收", "建议", "采用", "使用", "设为", "开启", "切换", "剔除",
        ))
        fps_win = bool(re.search(r"(?:138\s*(?:fps)?\s*(?:vs|versus|对比|比)\s*120|120\s*(?:fps)?\s*(?:vs|versus|对比|比)\s*138).{0,90}(?:15\s*%|15\s*％).{0,80}(?:physics|物理)", clause))
        if fps_win and intent and not rejected:
            violations.add("fps-physics-win")
        batch = all(token in clause for token in ("iterations", "ccd", "gpu")) and ("4 tick" in clause or "4 tick" in clause.replace("每", ""))
        batch = batch or ("迭代" in clause and "ccd" in clause and "gpu" in clause and ("每 4 tick" in clause or "每4 tick" in clause))
        if batch and intent and not rejected:
            violations.add("batch-quality-prescription")
        average_only = any(token in clause for token in ("average fps", "only fps", "平均 fps", "只看 fps", "仅看 fps"))
        if average_only and intent and not rejected:
            violations.add("fps-average-only")
        gpu_without_cost = "gpu" in clause and any(token in clause for token in ("move", "offload", "搬到", "迁移")) and not any(token in clause for token in ("upload", "readback", "transfer", "sync", "crossover", "上传", "回读", "传输", "同步", "交叉"))
        if gpu_without_cost and intent and not rejected:
            violations.add("gpu-without-end-to-end-evidence")
        fps_toggle = bool(re.search(r"(?:per[- ]frame|fps|每帧).{0,55}(?:toggle|switch|tier|开关|切换|层级)", clause))
        if fps_toggle and intent and not rejected:
            violations.add("fps-tier-toggle")
        authority_drop = bool(re.search(r"(?:drop|cull|remove|skip|丢弃|剔除|移除|跳过).{0,45}(?:authoritative|gameplay|权威|玩法).{0,45}(?:bod(?:y|ies)|event|物体|事件)", clause))
        if authority_drop and intent and not rejected:
            violations.add("authoritative-drop")
        same_threshold = bool(re.search(r"(?:same|identical|同一|相同).{0,35}(?:entry|down|进入|降级).{0,35}(?:exit|up|退出|升级).{0,35}(?:threshold|阈值)", clause))
        if same_threshold and intent and not rejected:
            violations.add("no-hysteresis")
        no_residency_or_mapping = bool(re.search(r"(?:tier|层级).{0,80}(?:no|without|无).{0,35}(?:residency|state mapping|驻留|状态映射)", clause))
        if no_residency_or_mapping and intent and not rejected:
            violations.add("no-tier-residency-or-mapping")
        no_upshift_or_rollback = bool(re.search(r"(?:downshift|降级).{0,80}(?:no|without|无).{0,35}(?:upshift|rollback|升级|回滚)", clause))
        if no_upshift_or_rollback and intent and not rejected:
            violations.add("no-upshift-or-rollback")
        causal = bool(re.search(r"(?:correlation|相关).{0,45}(?:proves?|demonstrates?|证明).{0,35}(?:causality|因果)", clause))
        if causal and not rejected:
            violations.add("correlation-is-causation")
        invented = any(token in clause for token in ("client budget", "客户端预算", "sample", "samples", "threshold", "hysteresis", "样本", "阈值", "滞回")) and any(token in clause for token in ("exactly", "set", "use", "固定为", "设为", "使用")) and bool(re.search(r"\d", clause))
        if invented and not rejected:
            violations.add("invented-unknowns")
    if require_contract:
        if "scripts/analyze_physics_trace.py" not in text:
            violations.add("missing-trace-analyzer-path")
        if not has_exact_ab_contract(text):
            violations.add("missing-exact-ab-contract")
        if disabled_batch_in_role(text, "B"):
            violations.add("batch-disabled-in-b-not-a")
        if any(re.search(r"(?:several|multiple|many|多个|数个).{0,100}(?:changes?|factors?|改动|因素)", clause, re.IGNORECASE) for clause in role_clauses(text, "B")):
            violations.add("b-changes-several-factors")
        violations.update(answer_contract_violations(text))
    return violations


def enabled_attempt1_violations(text: str) -> set[str]:
    """Assess the captured attempt without treating its correct headings as a pass."""
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    if "scripts/analyze_physics_trace.py" not in text:
        violations.add("missing-trace-analyzer-path")
    if not has_exact_ab_contract(text):
        violations.add("missing-exact-ab-contract")
    return violations


def enabled_attempt2_violations(text: str) -> set[str]:
    """Assess semantic A/B authority, not merely the four heading strings."""
    violations: set[str] = set()
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    if "scripts/analyze_physics_trace.py" not in text:
        violations.add("missing-trace-analyzer-path")
    if disabled_batch_in_role(text, "B"):
        violations.add("batch-disabled-in-b-not-a")
    return violations


def enabled_attempt3_violations(text: str) -> set[str]:
    """Attempt 3 passes only when its whole-answer A/B contract is safe."""
    violations = applied_response_violations(text, require_contract=True)
    if re.findall(r"^## (.+)$", text, re.MULTILINE) != list(HEADINGS):
        violations.add("headings")
    return violations


@unittest.skipUnless(SKILL.is_file(), "Task 16 production artifacts are not written during RED")
class ProfilingScalingPhysicsSkillTests(unittest.TestCase):
    def test_skill_contract_is_complete_engine_neutral_and_bounded(self):
        frontmatter, body = read_skill(SKILL)
        self.assertEqual(frontmatter, {
            "name": "profiling-scaling-physics",
            "description": "Use when physics performance, CPU/GPU budgets, bottlenecks, scaling, offload, LOD, culling, or quality tiers need attributable evidence.",
        })
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", body)), 500)
        self.assertEqual(contract_violations(body), set())
        for api in ("Rigidbody", "PxScene", "PhysicsSystem", "BodyInterface", "b2World"):
            self.assertNotIn(api, body)

    def test_contract_deletions_and_bilingual_polarity_mutations_are_rejected(self):
        _, body = read_skill(SKILL)
        for phrase, code in (
            ("scripts/analyze_physics_trace.py", "counters"),
            ("Every applied response names/uses", "applied-response-contract"),
            ("do not call B 15% faster", "fps-attribution"),
            ("p50/p95/p99", "distribution"),
            ("per-thread/core timelines", "distribution"),
            ("broadphase moves/pairs", "counters"),
            ("exactly one named isolated change", "ab"),
            ("small-workload crossover", "gpu"),
            ("state mapping/conservation", "tiers"),
            ("hysteresis/residency", "tiers"),
            ("telemetry, rollback", "tiers"),
            ("Fatal-stop", "acceptance"),
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                self.assertIn(code, contract_violations(body.replace(phrase, "", 1)))
        baseline = BASELINE.read_text(encoding="utf-8")
        mutations = {
            "fps-physics-win": "138 FPS vs 120 FPS proves a 15% physics win, so merge B.",
            "batch-quality-prescription": "建议把 solver iterations 减半、关闭 CCD、远处 body 每4 tick 更新，并把 collision/solver 全搬到 GPU 作为修复。",
            "fps-average-only": "Use average FPS only as the accepted physics metric.",
            "gpu-without-end-to-end-evidence": "Move physics to GPU and merge it as the fast fix.",
            "fps-tier-toggle": "按每帧 FPS 自动切换质量层级。",
            "authoritative-drop": "Cull authoritative gameplay bodies and events to meet budget.",
            "no-hysteresis": "Use the same entry and exit threshold for tier switching.",
            "no-tier-residency-or-mapping": "Set tier entry and exit signals with no residency or state mapping.",
            "no-upshift-or-rollback": "Apply a downshift with no upshift or rollback semantics.",
            "correlation-is-causation": "相关性证明因果。",
            "invented-unknowns": "Set client budget to 2 ms and use exactly 30 samples before values are declared.",
        }
        for code, mutation in mutations.items():
            with self.subTest(code=code):
                self.assertIn(code, applied_response_violations(f"{baseline}\n{mutation}"))
        controls = (
            "Rejected baseline: 138 FPS versus 120 FPS is not a 15% physics win.",
            "将关闭 CCD、每4 tick 更新和 GPU 搬运仅作为一次一变量实验，而不是处方。",
            "Correlation does not prove causality.",
        )
        for control in controls:
            with self.subTest(control=control):
                self.assertEqual(applied_response_violations(f"{baseline}\n{control}"), set())

    def test_exact_tracked_baseline_truthfully_fails_named_gates(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 5823)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "4a959de995a29fa890e7ace2f4d0fb4233cb978bcc1f915bf1a787eba34bc935")
        violations = contract_violations(raw.decode("utf-8"))
        self.assertTrue({"headings", "ab", "sweeps", "tiers", "unknowns"}.issubset(violations), violations)

    def test_exact_enabled_attempt1_is_tracked_and_truthfully_remains_failed(self):
        raw = ENABLED_ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), 5781)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "9729786641d577f05eaed056bea17452803977ff64f2a592da25a60c438bae3d")
        self.assertEqual(
            enabled_attempt1_violations(raw.decode("utf-8")),
            {"missing-trace-analyzer-path", "missing-exact-ab-contract"},
        )

    def test_exact_enabled_attempt2_is_tracked_and_truthfully_remains_failed(self):
        raw = ENABLED_ATTEMPT2.read_bytes()
        self.assertEqual(len(raw), 5115)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "ccc36c9ceec4d6975012f255ee26cf0620bcdd457a4fcef455fd226686fc5b56")
        self.assertEqual(enabled_attempt2_violations(raw.decode("utf-8")), {"batch-disabled-in-b-not-a"})

    def test_exact_enabled_attempt3_is_tracked_and_truthfully_passes(self):
        raw = ENABLED_ATTEMPT3.read_bytes()
        self.assertEqual(len(raw), 4729)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "35fd2d2d59f6faa422337377d3c21a4ee7d0ec9ae8020dc8a3b921b38204a454")
        self.assertEqual(enabled_attempt3_violations(raw.decode("utf-8")), set())

    def test_attempt2_is_rejected_by_the_applied_response_contract_gate(self):
        violations = applied_response_violations(
            ENABLED_ATTEMPT2.read_text(encoding="utf-8"),
            require_contract=True,
        )
        self.assertIn("batch-disabled-in-b-not-a", violations)

    def test_attempt1_is_rejected_by_the_applied_response_contract_gate(self):
        violations = applied_response_violations(
            ENABLED_ATTEMPT1.read_text(encoding="utf-8"),
            require_contract=True,
        )
        self.assertTrue(
            {"missing-trace-analyzer-path", "missing-exact-ab-contract"}.issubset(violations),
            violations,
        )

    def test_applied_contract_accepts_semantic_english_and_chinese_variants(self):
        controls = (
            "A is the current unmatched FPS-only evidence and the half-iterations/no-CCD/4-tick/GPU proposal is disabled. B is a matched capture with the same manifest, one isolated change, identical correctness checks and CPU/GPU timelines. Use scripts/analyze_physics_trace.py for distribution/counter evidence.",
            "A 为当前未匹配的 FPS-only 证据，减半 iterations、关闭 CCD、每 4 tick 与 GPU 方案均禁用。B 为同一清单下的匹配捕获，只改一个因素，并有相同正确性检查及 CPU/GPU 时间线；使用 scripts/analyze_physics_trace.py 获取分布/计数器证据。",
        )
        for control in controls:
            with self.subTest(control=control):
                self.assertTrue(has_exact_ab_contract(control))
                self.assertEqual(applied_response_violations(control), set())
        bad_b = "A is the current unmatched FPS-only evidence and the half-iterations/no-CCD/4-tick/GPU proposal is disabled. B is a matched capture with the same manifest, but changes several factors; it retains identical correctness checks and CPU/GPU timelines. Use scripts/analyze_physics_trace.py for distribution/counter evidence."
        self.assertIn("b-changes-several-factors", applied_response_violations(bad_b, require_contract=True))

    def test_promotion_gate_rejects_analyzer_and_ab_only_stub(self):
        """A pass requires answer-level evidence, not merely four headings and A/B words."""
        stub = """## Budget and capture contract
Use scripts/analyze_physics_trace.py.

## Attribution and scaling
Intro. A is current unmatched FPS-only evidence; half iterations, no CCD, 4-tick and GPU proposal disabled. B is matched capture with exact A manifest, one isolated change, identical correctness checks and CPU/GPU timelines.

## Reversible quality tiers
TBD

## Acceptance
TBD
"""
        self.assertIn("missing-answer-contract", applied_response_violations(stub, require_contract=True))

    def test_promotion_gate_rejects_batch_disabled_in_b_in_any_term_order(self):
        """The simultaneous disabled proposal belongs to A even when B words are reordered."""
        b_disabled = """## Budget and capture contract
Use scripts/analyze_physics_trace.py.

## Attribution and scaling
Intro. A is current unmatched FPS-only evidence. B is matched capture with exact A manifest, one isolated change, identical correctness checks and CPU/GPU timelines; GPU, 4-tick updates, no CCD and half iterations are disabled in B.

## Reversible quality tiers
TBD

## Acceptance
TBD
"""
        self.assertIn("batch-disabled-in-b-not-a", applied_response_violations(b_disabled, require_contract=True))

    def test_promotion_gate_requirement_deletions_and_reordered_a_controls(self):
        """Each answer-level requirement has a separate mutation; A may reorder its disabled terms."""
        complete = ENABLED_ATTEMPT3.read_text(encoding="utf-8")
        deletions = (
            ("版本化 capture manifest", "answer-manifest-unknowns"),
            ("p50/p95/p99、max、deadline miss、超预算面积/时长、tick backlog、resimulation debt", "answer-distributions"),
            ("GPU 方案只能作为端到端实验：测 upload/readback、排队、同步、延迟、确定性与权威性、fallback、内存、小工作量 crossover，以及正确性矩阵；不能把 CPU 阶段“迁移”后只报告局部 GPU 时间。", "answer-gpu"),
            ("状态映射/守恒", "answer-tiers"),
            ("最坏场景矩阵", "answer-acceptance"),
        )
        for deleted, code in deletions:
            with self.subTest(code=code):
                self.assertIn(code, applied_response_violations(complete.replace(deleted, "", 1), require_contract=True))
        reordered_english = "A is the current unmatched 120 FPS versus 138 FPS-only evidence, and GPU, every 4-tick update, no CCD, and half iterations are disabled in A. B is a matched capture from the exact A manifest with one isolated change and identical correctness checks and CPU/GPU timelines."
        reordered_chinese = "A：恢复当前未匹配的 120 FPS/138 FPS 证据，GPU 搬运、每 4 tick 更新、关闭 CCD 与减半 iterations 均在 A 中禁用。B：从同一 A manifest 开始，仅启用一个具名改动，正确性检查和 CPU/GPU timeline 完全一致。"
        self.assertTrue(has_exact_ab_contract(reordered_english))
        self.assertTrue(has_exact_ab_contract(reordered_chinese))

    def test_promotion_gate_manifest_group_deletions_are_independent(self):
        """Each frozen manifest group must be a separate answer-level requirement."""
        complete = ENABLED_ATTEMPT3.read_text(encoding="utf-8")
        deletions = (
            ("固定 60 Hz tick、accumulator、backlog", "answer-manifest-tick-accumulator-backlog"),
            ("相机、分辨率、VSync、帧率上限", "answer-manifest-display-capture"),
            ("场景、资源、随机种子、有序输入", "answer-manifest-scene-inputs"),
            ("RTT/jitter/loss、网络负载、rollback 历史", "answer-manifest-network-rollback"),
            ("热身长度、采样长度、重复次数、置信规则", "answer-manifest-sampling-confidence"),
            ("内存/physics 预算", "answer-manifest-physics-budget"),
            ("场景容量上限、正确性不变量、容许物理误差与质量限制", "answer-manifest-capacity-quality"),
        )
        for deleted, code in deletions:
            with self.subTest(code=code):
                self.assertIn(code, answer_contract_violations(complete.replace(deleted, "", 1)))

    def test_role_spans_split_semicolon_bounded_english_and_chinese_ab(self):
        """A's disabled batch must not leak across EN/ZH semicolon role boundaries."""
        valid_english = "A: current unmatched 120 FPS versus 138 FPS evidence; half iterations, no CCD, every 4 tick and GPU are disabled; B: matched capture from exact A manifest, one isolated change, identical correctness checks and CPU/GPU timelines."
        valid_chinese = "A：恢复当前未匹配的 120 FPS/138 FPS 证据，GPU、每 4 tick、关闭 CCD、减半 iterations 均禁用；B：从同一 A manifest 开始，仅启用一个具名改动，正确性检查和 CPU/GPU timeline 完全一致。"
        invalid_b = "A: current unmatched 120 FPS versus 138 FPS evidence; B: matched capture from exact A manifest, one isolated change, identical correctness checks and CPU/GPU timelines; GPU, every 4 tick, no CCD and half iterations are disabled in B."
        self.assertTrue(has_exact_ab_contract(valid_english))
        self.assertTrue(has_exact_ab_contract(valid_chinese))
        self.assertFalse(disabled_batch_in_role(valid_english, "B"))
        self.assertFalse(disabled_batch_in_role(valid_chinese, "B"))
        self.assertIn("batch-disabled-in-b-not-a", applied_response_violations(invalid_b, require_contract=True))

    def test_role_spans_merge_repeated_same_role_markers_in_natural_chinese(self):
        """A later `A 中` reference must remain in the initial A span, not drop its disable predicate."""
        natural_chinese = "A：恢复当前未匹配的 120 FPS/138 FPS 证据，GPU、每4 tick、CCD 与减半 iterations 均在 A 中禁用；B：从同一 A manifest 开始，仅启用一个具名改动，正确性检查和 CPU/GPU timeline 完全一致。"
        self.assertTrue(has_exact_ab_contract(natural_chinese))
        self.assertFalse(disabled_batch_in_role(natural_chinese, "B"))
        self.assertEqual(len(role_clauses(natural_chinese, "A")), 1)

    def test_role_spans_preserve_chinese_same_role_sentence_continuation(self):
        """Facts may aggregate across distinct A spans separated by a Chinese sentence boundary."""
        continuation = "A：恢复当前未匹配的 120 FPS/138 FPS 证据。A 中禁用 GPU、每4 tick、CCD 与减半 iterations。B：从同一 A manifest 开始，仅启用一个具名改动，正确性检查和 CPU/GPU timeline 完全一致。"
        self.assertTrue(has_exact_ab_contract(continuation))
        self.assertTrue(disabled_batch_in_role(continuation, "A"))
        self.assertFalse(disabled_batch_in_role(continuation, "B"))
        self.assertEqual(len(role_clauses(continuation, "A")), 2)

    def test_role_spans_preserve_english_same_role_sentence_continuation(self):
        """Facts may aggregate across distinct A spans separated by an English sentence boundary."""
        continuation = "A is the current unmatched 120 FPS versus 138 FPS evidence. A: GPU, every 4 tick, CCD and half iterations are disabled. B: matched capture from the exact A manifest, one isolated change, identical correctness checks and CPU/GPU timelines."
        self.assertTrue(has_exact_ab_contract(continuation))
        self.assertTrue(disabled_batch_in_role(continuation, "A"))
        self.assertFalse(disabled_batch_in_role(continuation, "B"))
        self.assertEqual(len(role_clauses(continuation, "A")), 2)

    def test_full_answer_accepts_preposed_in_a_continuation(self):
        """Natural `In A, ...` wording must retain the full answer's safe A/B contract."""
        complete = ENABLED_ATTEMPT3.read_text(encoding="utf-8")
        original = "- A：恢复当前版本，但禁用“减半 iterations、关闭 CCD、每 4 tick 更新、GPU 搬运”等所有提案，使用完整 manifest。\n- B：从同一 A manifest 起始，仅启用一个具名改动；正确性检查、CPU/GPU timeline 完全一致。"
        continuation = "A is the current unmatched 120 FPS versus 138 FPS evidence. In A, GPU, every 4 tick, CCD and half iterations are disabled. B is a matched capture from the exact A manifest with one isolated change and identical correctness checks and CPU/GPU timelines."
        self.assertEqual(complete.count(original), 1)
        self.assertEqual(enabled_attempt3_violations(complete.replace(original, continuation)), set())

    def test_full_answer_rejects_preposed_in_b_disabled_batch(self):
        """Natural `In B, ...` wording must not escape the unsafe B-assignment gate."""
        complete = ENABLED_ATTEMPT3.read_text(encoding="utf-8")
        invalid = f"{complete}\n\nIn B, GPU, every 4 tick, CCD and half iterations are disabled.\n"
        self.assertIn("batch-disabled-in-b-not-a", enabled_attempt3_violations(invalid))

    def test_ui_source_audit_and_pass_state_evaluation_are_exact_and_self_contained(self):
        self.assertIn('display_name: "Physics Profiling and Scaling"', UI.read_text(encoding="utf-8"))
        audit = AUDIT.read_text(encoding="utf-8")
        for url in (
            "https://box2d.org/documentation/md_simulation.html",
            "https://sre.google/sre-book/service-level-objectives/",
            "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html",
            "https://gpuweb.github.io/gpuweb/",
            "https://learn.microsoft.com/uk-ua/windows-hardware/drivers/display/gpuview-main-window",
        ):
            self.assertIn(url, audit)
        self.assertIn("Claims used in SKILL.md", audit)
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "profiling-scaling-physics")
        scenario = SCENARIO.read_bytes()
        self.assertEqual(len(scenario), 1400)
        self.assertEqual(hashlib.sha256(scenario).hexdigest(), "2e462f7f37dc9be3f3c3b97031d54cd2ffaad36f8c6677dd3ec2afe561bdcba7")
        self.assertEqual(data["scenario"], scenario.decode("utf-8").removesuffix("\n"))
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled_attempt1"]["response"].encode("utf-8"), ENABLED_ATTEMPT1.read_bytes())
        self.assertEqual(data["enabled_attempt2"]["response"].encode("utf-8"), ENABLED_ATTEMPT2.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ENABLED_ATTEMPT3.read_bytes())
        self.assertEqual(data["verdict"], "pass")
        self.assertIn("9729786641d577f05eaed056bea17452803977ff64f2a592da25a60c438bae3d", " ".join(data["evidence"]))
        self.assertIn("ccc36c9ceec4d6975012f255ee26cf0620bcdd457a4fcef455fd226686fc5b56", " ".join(data["evidence"]))
        self.assertIn("35fd2d2d59f6faa422337377d3c21a4ee7d0ec9ae8020dc8a3b921b38204a454", " ".join(data["evidence"]))

    def test_artifacts_are_staged_and_a_fresh_git_archive_runs_this_suite(self):
        paths = (SKILL, UI, AUDIT, EVALUATION, SCENARIO, BASELINE, ENABLED_ATTEMPT1, ENABLED_ATTEMPT2, ENABLED_ATTEMPT3)
        relative = [path.relative_to(ROOT).as_posix() for path in paths]
        if not (ROOT / ".git").exists():
            for item in relative:
                self.assertTrue((ROOT / item).is_file(), item)
            raw = BASELINE.read_bytes()
            self.assertEqual(len(raw), 5823)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), "4a959de995a29fa890e7ace2f4d0fb4233cb978bcc1f915bf1a787eba34bc935")
            attempt = ENABLED_ATTEMPT1.read_bytes()
            self.assertEqual(len(attempt), 5781)
            self.assertEqual(hashlib.sha256(attempt).hexdigest(), "9729786641d577f05eaed056bea17452803977ff64f2a592da25a60c438bae3d")
            attempt2 = ENABLED_ATTEMPT2.read_bytes()
            self.assertEqual(len(attempt2), 5115)
            self.assertEqual(hashlib.sha256(attempt2).hexdigest(), "ccc36c9ceec4d6975012f255ee26cf0620bcdd457a4fcef455fd226686fc5b56")
            attempt3 = ENABLED_ATTEMPT3.read_bytes()
            self.assertEqual(len(attempt3), 4729)
            self.assertEqual(hashlib.sha256(attempt3).hexdigest(), "35fd2d2d59f6faa422337377d3c21a4ee7d0ec9ae8020dc8a3b921b38204a454")
            return
        for item in relative:
            tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "--", item], cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(tracked.returncode, 0, item)
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 5823)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "4a959de995a29fa890e7ace2f4d0fb4233cb978bcc1f915bf1a787eba34bc935")
        attempt = ENABLED_ATTEMPT1.read_bytes()
        self.assertEqual(len(attempt), 5781)
        self.assertEqual(hashlib.sha256(attempt).hexdigest(), "9729786641d577f05eaed056bea17452803977ff64f2a592da25a60c438bae3d")
        attempt2 = ENABLED_ATTEMPT2.read_bytes()
        self.assertEqual(len(attempt2), 5115)
        self.assertEqual(hashlib.sha256(attempt2).hexdigest(), "ccc36c9ceec4d6975012f255ee26cf0620bcdd457a4fcef455fd226686fc5b56")
        attempt3 = ENABLED_ATTEMPT3.read_bytes()
        self.assertEqual(len(attempt3), 4729)
        self.assertEqual(hashlib.sha256(attempt3).hexdigest(), "35fd2d2d59f6faa422337377d3c21a4ee7d0ec9ae8020dc8a3b921b38204a454")
        if os.environ.get("TASK16_ARCHIVE_CHECK"):
            return
        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task16.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), tree], cwd=ROOT, check=True)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for item in relative:
                self.assertTrue((extract / item).is_file(), item)
            archived = extract / BASELINE.relative_to(ROOT)
            self.assertEqual(len(archived.read_bytes()), 5823)
            self.assertEqual(hashlib.sha256(archived.read_bytes()).hexdigest(), "4a959de995a29fa890e7ace2f4d0fb4233cb978bcc1f915bf1a787eba34bc935")
            archived_scenario = extract / SCENARIO.relative_to(ROOT)
            self.assertEqual(len(archived_scenario.read_bytes()), 1400)
            self.assertEqual(hashlib.sha256(archived_scenario.read_bytes()).hexdigest(), "2e462f7f37dc9be3f3c3b97031d54cd2ffaad36f8c6677dd3ec2afe561bdcba7")
            archived_attempt = extract / ENABLED_ATTEMPT1.relative_to(ROOT)
            self.assertEqual(len(archived_attempt.read_bytes()), 5781)
            self.assertEqual(hashlib.sha256(archived_attempt.read_bytes()).hexdigest(), "9729786641d577f05eaed056bea17452803977ff64f2a592da25a60c438bae3d")
            archived_attempt2 = extract / ENABLED_ATTEMPT2.relative_to(ROOT)
            self.assertEqual(len(archived_attempt2.read_bytes()), 5115)
            self.assertEqual(hashlib.sha256(archived_attempt2.read_bytes()).hexdigest(), "ccc36c9ceec4d6975012f255ee26cf0620bcdd457a4fcef455fd226686fc5b56")
            archived_attempt3 = extract / ENABLED_ATTEMPT3.relative_to(ROOT)
            self.assertEqual(len(archived_attempt3.read_bytes()), 4729)
            self.assertEqual(hashlib.sha256(archived_attempt3.read_bytes()).hexdigest(), "35fd2d2d59f6faa422337377d3c21a4ee7d0ec9ae8020dc8a3b921b38204a454")
            environment = os.environ | {"TASK16_ARCHIVE_CHECK": "1"}
            subprocess.run([sys.executable, "-m", "unittest", "tests.test_profiling_scaling_physics_skill"], cwd=extract, env=environment, check=True)


class ProfilingScalingPhysicsAvailabilityTests(unittest.TestCase):
    def test_profiling_scaling_physics_skill_is_available(self):
        skill_names = {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()}
        self.assertIn("profiling-scaling-physics", skill_names)

    def test_enabled_attempt1_fixture_is_tracked_before_it_is_assessed(self):
        fixtures = {path.name for path in (ROOT / "tests" / "fixtures").iterdir()}
        self.assertIn(ENABLED_ATTEMPT1.name, fixtures)

    def test_enabled_attempt2_fixture_is_tracked_before_it_is_assessed(self):
        fixtures = {path.name for path in (ROOT / "tests" / "fixtures").iterdir()}
        self.assertIn(ENABLED_ATTEMPT2.name, fixtures)

    def test_enabled_attempt3_fixture_is_tracked_before_it_is_assessed(self):
        fixtures = {path.name for path in (ROOT / "tests" / "fixtures").iterdir()}
        self.assertIn(ENABLED_ATTEMPT3.name, fixtures)


if __name__ == "__main__":
    unittest.main()
