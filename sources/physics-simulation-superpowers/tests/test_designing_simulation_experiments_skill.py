"""Behavioral and portability contracts for simulation experiment design."""

import hashlib
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "designing-simulation-experiments" / "SKILL.md"
REFERENCE = SKILL.parent / "references" / "experiment-design.md"
UI = SKILL.parent / "agents" / "openai.yaml"
SCENARIO = ROOT / "tests" / "fixtures" / "designing-simulation-experiments-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "designing-simulation-experiments-baseline-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "designing-simulation-experiments-enabled-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "designing-simulation-experiments-enabled-attempt-1-response.txt"
EVALUATION = ROOT / "evaluations" / "designing-simulation-experiments" / "evaluation.json"
SCHEMA = ROOT / "schemas" / "experiment-plan.schema.json"
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
import validate_research_artifact  # noqa: E402


BASELINE_BYTES = 13491
BASELINE_SHA256 = "546ecf85897ec4a64d1c73a7bc7896fa683854c25cffc973cd6e64f9751fa65f"
SCENARIO_BYTES = 992
SCENARIO_SHA256 = "ef8206cf6e440107c9ad59f508ce9c9d35a8157ad55ebfc9227e2da25f2fe058"
ATTEMPT1_BYTES = 15026
ATTEMPT1_SHA256 = "4a4c6408d1cde8bdaa7a86c9290ac35035c67564db5a1a394474662d202a4d4c"
FENCE = chr(96) * 3
JSON_FENCE = re.compile(
    re.escape(FENCE) + r"json\s*\n(?P<body>\{.*?\})\s*\n" + re.escape(FENCE),
    re.IGNORECASE | re.DOTALL,
)
HARDWARE_ASSERTION = re.compile(
    r"(?:use|run on|common hardware(?: is|:)|统一硬件(?:为|是|：)|使用)\s*"
    r"(?:an?\s*)?(?:nvidia\s*)?rtx\s*(?:4090|5090)",
    re.IGNORECASE,
)
INVENTED_THRESHOLD = re.compile(
    r"(?:quality\s*(?:target|threshold)|质量目标|容忍度|margin)"
    r"\s*(?:=|:|：|为|是)\s*\d+(?:\.\d+)?",
    re.IGNORECASE,
)


def normalized(value) -> str:
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return re.sub(r"\s+", " ", value).casefold()


def has_each(text: str, groups) -> bool:
    compact = normalized(text)
    return all(any(term.casefold() in compact for term in group) for group in groups)


def has_exact_number(text: str, number: int) -> bool:
    return re.search(
        rf"(?<![\d.]){number}(?:\.0+)?(?![\d.])",
        normalized(text),
    ) is not None


def text_records(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from text_records(child, path + (str(key),))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from text_records(child, path + (str(index),))
    elif isinstance(value, str):
        yield path, value


def declared_caps_within_limits(value) -> bool:
    for path, text in text_records(value):
        context = normalized(" ".join(path) + " " + text).replace("_", " ")
        if not any(
            marker in context
            for marker in (
                "global",
                "hard cap",
                "total cap",
                "total limit",
                "overall cap",
                "总上限",
                "总计",
                "硬上限",
                "全局",
            )
        ):
            continue
        gpu_hours = (
            float(match.group("value"))
            for match in re.finditer(
                r"(?<![\d.])(?P<value>\d+(?:\.\d+)?)\s*gpu[\s-]*hours?\b",
                context,
            )
        )
        wall_hours = (
            float(match.group("value"))
            for match in re.finditer(
                r"(?<![\d.])(?P<value>\d+(?:\.\d+)?)\s*"
                r"(?:(?:wall(?:-clock)?\s*)?hours?\b|小时)",
                context,
            )
        )
        if any(hours > 6 for hours in gpu_hours) or any(
            hours > 48 for hours in wall_hours
        ):
            return False
    return True


def has_local_record(text: str, groups) -> bool:
    return any(
        has_each(line, groups)
        for line in text.splitlines()
        if line.strip()
    )


def has_local_clause(text: str, groups) -> bool:
    return any(
        has_each(clause, groups)
        for clause in re.split(r"[。.!?！？;；\r\n]+", text)
        if clause.strip()
    )


def section_containing(text: str, *heading_terms: str) -> str:
    for match in re.finditer(
        r"^##\s+(?P<heading>[^\r\n]+)\n(?P<body>.*?)(?=^##\s|^"
        + re.escape(FENCE)
        + r"json\s*$|\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    ):
        heading = normalized(match.group("heading"))
        if any(term.casefold() in heading for term in heading_terms):
            return match.group("body")
    return ""


def extract_tail_adapter(text: str) -> dict:
    matches = list(JSON_FENCE.finditer(text))
    if len(matches) != 1:
        raise ValueError("response must contain exactly one fenced JSON adapter")
    match = matches[0]
    if text[match.end():].strip():
        raise ValueError("the JSON adapter must be the final response block")
    value = json.loads(match.group("body"))
    if not isinstance(value, dict):
        raise ValueError("the JSON adapter must be an object")
    return value


def response_with_adapter(text: str, adapter: dict) -> str:
    match = JSON_FENCE.search(text)
    if match is None:
        raise ValueError("response has no JSON adapter")
    return (
        text[: match.start()]
        + FENCE
        + "json\n"
        + json.dumps(adapter, ensure_ascii=False, indent=2)
        + "\n"
        + FENCE
        + "\n"
    )


def replace_named_section(text: str, heading_term: str, body: str) -> str:
    pattern = (
        r"(^##\s+[^\r\n]*"
        + re.escape(heading_term)
        + r"[^\r\n]*\n).*?(?=^##\s|^"
        + re.escape(FENCE)
        + r"json\s*$)"
    )
    return re.sub(
        pattern,
        lambda match: match.group(1) + body.rstrip() + "\n\n",
        text,
        count=1,
        flags=re.MULTILINE | re.DOTALL,
    )


def adapter_issues(text: str) -> list[str]:
    try:
        adapter = extract_tail_adapter(text)
    except (ValueError, json.JSONDecodeError) as error:
        return [str(error)]
    issues = validate_research_artifact.validate_document("experiment-plan", adapter)
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    if set(adapter) != set(schema["required"]):
        issues.append("adapter fields must equal the schema required-field set")
    return issues


def plan_semantic_issues(adapter: dict) -> set[str]:
    issues = set()
    hypothesis = normalized(adapter.get("hypothesis", ""))
    fixed_budget_terms = ("fixed-budget", "equal budget", "同等预算", "相等预算")
    fixed_quality_terms = ("fixed-quality", "equal quality", "同等质量", "同一质量目标")
    blocking_terms = (
        "block",
        "no claim",
        "cannot claim",
        "claim-blocked",
        "阻断",
        "不得主张",
        "不能主张",
    )
    fixed_budget_is_testable = has_local_clause(
        hypothesis,
        (
            fixed_budget_terms,
            ("quality", "error", "质量", "误差"),
            ("lower", "better", "higher quality", "less error", "improv", "更低", "更好", "改善", "提高"),
        ),
    ) or has_local_clause(hypothesis, (fixed_budget_terms, blocking_terms))
    fixed_quality_is_testable = has_local_clause(
        hypothesis,
        (
            fixed_quality_terms,
            ("time", "latency", "耗时", "时间", "时延"),
            ("shorter", "faster", "less time", "lower latency", "更短", "更快", "较短", "较快"),
        ),
    ) or has_local_clause(hypothesis, (fixed_quality_terms, blocking_terms))
    if not (
        has_each(hypothesis, (("flowx",), ("fluidbase",)))
        and fixed_budget_is_testable
        and fixed_quality_is_testable
    ):
        issues.add("falsifiable-hypothesis")

    baselines = normalized(adapter.get("baselines", []))
    if HARDWARE_ASSERTION.search(baselines):
        issues.add("invented-hardware")
    if not has_each(
        baselines,
        (
            ("fluidbase",),
            ("version", "commit", "revision", "版本"),
            ("same", "matched", "共同", "相同"),
        ),
    ):
        issues.add("baseline-provenance")

    scenes = normalized(adapter.get("scenes", []))
    if not has_each(
        scenes,
        (
            ("cityflood",),
            ("dambreak",),
            ("same", "matched", "hash", "共同", "相同"),
        ),
    ):
        issues.add("common-scenes")

    metrics = normalized(
        {
            "dependent_variables": adapter.get("dependent_variables", []),
            "metrics": adapter.get("metrics", []),
        }
    )
    if not has_each(
        metrics,
        (
            ("time", "latency", "performance", "帧时", "耗时"),
            ("quality", "error", "质量", "误差"),
            ("stability", "nan", "drift", "稳定"),
            ("real-time", "realtime", "over-budget", "实时", "超预算"),
        ),
    ):
        issues.add("metric-coverage")

    budgets = normalized(adapter.get("fixed_budgets", {}))
    resources = normalized(adapter.get("resource_estimate", {}))
    if not (
        has_exact_number(budgets, 6)
        and has_exact_number(budgets, 48)
        and has_exact_number(resources, 6)
        and has_exact_number(resources, 48)
        and declared_caps_within_limits(adapter.get("fixed_budgets", {}))
        and declared_caps_within_limits(adapter.get("resource_estimate", {}))
        and has_each(
            budgets + " " + resources,
            (
                ("fixed-budget", "fixed_budget", "equal budget", "同等预算", "相等预算"),
                ("fixed-quality", "fixed_quality", "time-to-target", "同等质量"),
            ),
        )
    ):
        issues.add("resource-bounds")

    tolerances = normalized(adapter.get("tolerances", {}))
    if INVENTED_THRESHOLD.search(tolerances):
        issues.add("invented-threshold")
    if not has_each(
        tolerances,
        (
            ("unknown", "unprovided", "owner", "stakeholder", "待提供", "未提供", "负责人", "未知"),
            ("block", "no claim", "cannot", "阻止", "阻断", "不得", "不可", "不能"),
        ),
    ):
        issues.add("unknown-tolerances")

    if not has_each(
        resources,
        (
            ("preflight", "pilot", "预检", "试运行"),
            ("seed", "种子"),
            ("repetition", "重复"),
            ("confirmatory", "confirmation", "确认性"),
            ("unknown", "owner", "measured", "待定", "批准", "实测"),
        ),
    ):
        issues.add("replication-rationale")

    ablations = normalized(adapter.get("ablations", []))
    if not has_each(
        ablations,
        (
            ("one", "single", "一次", "单个"),
            ("locked", "same", "保持", "固定"),
            ("documented", "exists", "可用", "存在", "文档"),
        ),
    ):
        issues.add("controlled-ablations")

    stops = normalized(adapter.get("stop_conditions", []))
    if not has_each(
        stops,
        (
            ("hardware", "machine", "硬件"),
            ("quality", "tolerance", "质量", "容差"),
            ("6", "gpu-hour", "budget", "预算"),
            ("censor", "capped", "failure", "nan", "截尾", "失败"),
        ),
    ):
        issues.add("stopping-and-censoring")
    return issues


def prose_violations(prose: str) -> set[str]:
    violations = set()
    if HARDWARE_ASSERTION.search(prose):
        violations.add("invented-hardware")
    claim_scope = section_containing(prose, "结论范围", "claim scope", "hypothesis")
    fairness = section_containing(prose, "公平性合同", "fairness")
    measurement = section_containing(prose, "测量", "analysis", "统计")
    comparisons = section_containing(prose, "明确区分的比较", "comparisons")
    historical_region = claim_scope or prose
    if not has_each(
        historical_region,
        (
            ("cityflood",),
            ("dambreak",),
            (
                "not comparable",
                "不可直接比较",
                "不能直接比较",
                "不可比较",
                "不能用来支持",
                "不能相除",
                "不构成可比较",
            ),
            ("hardware", "gpu", "硬件"),
            ("resolution", "分辨率"),
            ("timestep", "时间步", "步频", "步长"),
            ("warm-up", "warmup"),
            ("renderer", "渲染器"),
        ),
    ):
        violations.add("historical-comparison")
    if fairness:
        matched_fidelity = has_local_record(
            fairness,
            (
                ("same", "matched", "相同", "共同", "固定"),
                ("timestep", "步频", "步长"),
                ("resolution", "分辨率"),
            ),
        )
        matched_environment = has_each(
            fairness,
            (
                (
                    "same hardware",
                    "common hardware",
                    "common gpu",
                    "同一硬件",
                    "共同硬件",
                    "同一台机器",
                    "共同 gpu",
                    "共同机器",
                ),
                ("warm-up", "warmup"),
                ("synchron", "同步"),
            ),
        )
        randomized_pairs = has_local_record(
            measurement,
            (
                ("paired", "配对", "成对"),
                ("block", "分块"),
                ("random", "随机"),
                ("balance", "平衡"),
            ),
        )
        fairness_ok = matched_fidelity and matched_environment and randomized_pairs
    else:
        fairness_ok = has_each(
            prose,
            (
                ("same hardware", "common hardware", "同一硬件", "共同硬件", "同一台机器"),
                ("same timestep", "fixed timestep", "相同步长", "相同步频", "步频档位"),
                ("same resolution", "相同分辨率", "同一分辨率"),
                ("random", "随机"),
                ("paired", "配对"),
                ("warm-up", "warmup"),
                ("synchron", "同步"),
            ),
        )
    if not fairness_ok:
        violations.add("fairness-contract")
    mode_region = (comparisons + "\n" + measurement) if comparisons else prose
    if not has_each(
        mode_region,
        (
            ("fixed-budget", "固定预算", "同等预算"),
            ("fixed-quality", "固定质量", "同等质量"),
            ("time-to-target", "达到", "目标质量"),
            ("confidence", "interval", "置信", "区间"),
            ("censor", "capped", "截尾", "上限"),
        ),
    ):
        violations.add("two-mode-analysis")
    return violations


def response_violations(text: str) -> set[str]:
    violations = set()
    try:
        adapter = extract_tail_adapter(text)
    except (ValueError, json.JSONDecodeError):
        return {"adapter-contract"}
    if adapter_issues(text):
        violations.add("adapter-contract")
    violations.update(plan_semantic_issues(adapter))
    match = JSON_FENCE.search(text)
    violations.update(prose_violations(text[: match.start()]))
    return violations


class DesigningSimulationExperimentsSkillTests(unittest.TestCase):
    def require_text(self, path: Path) -> str:
        self.assertTrue(path.is_file(), f"missing required Task 26 file: {path.relative_to(ROOT)}")
        return path.read_text(encoding="utf-8")

    def test_red_phase_required_skill_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_frozen_baseline_has_exact_controller_bytes(self):
        scenario_raw = SCENARIO.read_bytes()
        self.assertEqual(len(scenario_raw), SCENARIO_BYTES)
        self.assertEqual(hashlib.sha256(scenario_raw).hexdigest(), SCENARIO_SHA256)
        self.assertNotIn(b"\r", scenario_raw)
        self.assertTrue(scenario_raw.endswith(b"\n"))
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), BASELINE_BYTES)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), BASELINE_SHA256)
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        for path in (ATTEMPT1, ENABLED):
            with self.subTest(path=path.name):
                enabled_raw = path.read_bytes()
                self.assertEqual(len(enabled_raw), ATTEMPT1_BYTES)
                self.assertEqual(hashlib.sha256(enabled_raw).hexdigest(), ATTEMPT1_SHA256)
                self.assertFalse(enabled_raw.startswith(b"\xef\xbb\xbf"))
                self.assertNotIn(b"\r", enabled_raw)
                self.assertTrue(enabled_raw.endswith(b"\n"))
                self.assertFalse(enabled_raw.endswith(b"\n\n"))
        self.assertEqual(ATTEMPT1.read_bytes(), ENABLED.read_bytes())

    def test_baseline_adapter_truthfully_fails_the_real_existing_validator(self):
        baseline = self.require_text(BASELINE)
        validator_issues = validate_research_artifact.validate_document(
            "experiment-plan", extract_tail_adapter(baseline)
        )
        self.assertEqual(len(validator_issues), 25)
        self.assertIn("study_id is not allowed", validator_issues)
        self.assertIn("hypothesis is required", validator_issues)
        self.assertIn("seeds must be a nonempty array", validator_issues)
        self.assertIn("scenes[0] must be a nonempty string", validator_issues)
        self.assertIn("ablations must be a nonempty array", validator_issues)

    def test_baseline_semantics_are_not_misrepresented_as_an_adapter_failure_only(self):
        baseline = self.require_text(BASELINE)
        prose = baseline[: JSON_FENCE.search(baseline).start()]
        violations = prose_violations(prose)
        self.assertNotIn("historical-comparison", violations)
        self.assertNotIn("fairness-contract", violations)
        self.assertNotIn("two-mode-analysis", violations)

    def test_tail_adapter_parser_uses_real_schema_and_rejects_mutations(self):
        adapter = json.loads(
            (ROOT / "tests" / "fixtures" / "manifests" / "experiment-plan-valid.json").read_text(
                encoding="utf-8"
            )
        )
        response = "Executable plan.\n\n" + FENCE + "json\n"
        response += json.dumps(adapter, ensure_ascii=False) + "\n" + FENCE + "\n"
        self.assertEqual(adapter_issues(response), [])
        with self.assertRaisesRegex(ValueError, "final response block"):
            extract_tail_adapter(response + "afterword\n")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            extract_tail_adapter(response + FENCE + "json\n{}\n" + FENCE + "\n")
        weakened = dict(adapter)
        weakened["seeds"] = {"values": [1, 2, 3]}
        mutated = FENCE + "json\n" + json.dumps(weakened) + "\n" + FENCE + "\n"
        self.assertIn("seeds must be a nonempty array", adapter_issues(mutated))

    def test_enabled_vocabulary_and_schema_field_placement_are_semantically_valid(self):
        attempt = self.require_text(ATTEMPT1)
        self.assertEqual(response_violations(attempt), set())

    def test_hypothesis_requires_mode_specific_prediction_or_blocker(self):
        attempt = self.require_text(ATTEMPT1)
        adapter = extract_tail_adapter(attempt)
        weak_hypotheses = (
            "FlowX and FluidBase will be compared under fixed-budget and fixed-quality.",
            "FlowX and FluidBase predict lower error at fixed-budget; fixed-quality will be compared.",
            "FlowX and FluidBase will be compared at fixed-budget; fixed-quality predicts shorter time-to-target.",
        )
        for hypothesis in weak_hypotheses:
            with self.subTest(hypothesis=hypothesis):
                mutated = dict(adapter)
                mutated["hypothesis"] = hypothesis
                self.assertIn(
                    "falsifiable-hypothesis",
                    response_violations(response_with_adapter(attempt, mutated)),
                )

        explicitly_blocked = dict(adapter)
        explicitly_blocked["hypothesis"] = (
            "FlowX and FluidBase fixed-budget claim is blocked until its budget is approved; "
            "their fixed-quality claim is blocked until its quality target is approved."
        )
        self.assertNotIn(
            "falsifiable-hypothesis",
            plan_semantic_issues(explicitly_blocked),
        )

    def test_resource_bounds_reject_contradictory_declared_totals(self):
        attempt = self.require_text(ATTEMPT1)
        adapter = extract_tail_adapter(attempt)
        self.assertNotIn("resource-bounds", plan_semantic_issues(adapter))
        contradictory_text = (
            "The reference numbers are 6 GPU-hours and 48 hours, but the declared "
            "total caps are 60 GPU-hours and 480 hours."
        )
        mutations = (
            ("fixed_budgets", "global_hard_caps"),
            ("resource_estimate", "known_limits"),
        )
        for field, record in mutations:
            with self.subTest(field=field, record=record):
                mutated = dict(adapter)
                mutated[field] = dict(adapter[field])
                mutated[field][record] = contradictory_text
                self.assertIn(
                    "resource-bounds",
                    response_violations(response_with_adapter(attempt, mutated)),
                )

    def test_oracle_rejects_adapter_semantic_deletions_after_accepting_synonyms(self):
        attempt = self.require_text(ATTEMPT1)
        adapter = extract_tail_adapter(attempt)

        weak_hypothesis = dict(adapter)
        weak_hypothesis["hypothesis"] = "FlowX and FluidBase will be compared."
        self.assertIn(
            "falsifiable-hypothesis",
            response_violations(response_with_adapter(attempt, weak_hypothesis)),
        )

        weak_metrics = dict(adapter)
        weak_metrics["dependent_variables"] = [adapter["dependent_variables"][0]]
        weak_metrics["metrics"] = [adapter["metrics"][2]]
        self.assertIn(
            "metric-coverage",
            response_violations(response_with_adapter(attempt, weak_metrics)),
        )

        weak_resources = dict(adapter)
        weak_resources["fixed_budgets"] = {
            "global_hard_caps": adapter["fixed_budgets"]["global_hard_caps"],
            "preflight": adapter["fixed_budgets"]["preflight"],
        }
        self.assertIn(
            "resource-bounds",
            response_violations(response_with_adapter(attempt, weak_resources)),
        )

        weak_tolerances = dict(adapter)
        weak_tolerances["tolerances"] = {
            "status": "未知；owner 后续提供 quality target 和 confidence level。"
        }
        self.assertIn(
            "unknown-tolerances",
            response_violations(response_with_adapter(attempt, weak_tolerances)),
        )

        invented_hardware = dict(adapter)
        invented_hardware["baselines"] = list(adapter["baselines"])
        invented_hardware["baselines"][2] = "Common hardware: use RTX 5090 for both methods."
        self.assertIn(
            "invented-hardware",
            response_violations(response_with_adapter(attempt, invented_hardware)),
        )

        invented_threshold = dict(adapter)
        invented_threshold["tolerances"] = dict(adapter["tolerances"])
        invented_threshold["tolerances"]["quality_target_and_margin"] = (
            "quality target = 0.01; owner approval remains unknown and claims stay blocked."
        )
        self.assertIn(
            "invented-threshold",
            response_violations(response_with_adapter(attempt, invented_threshold)),
        )

        oversized = dict(adapter)
        oversized["fixed_budgets"] = json.loads(
            json.dumps(adapter["fixed_budgets"], ensure_ascii=False)
            .replace("6 GPU-hours", "60 GPU-hours")
            .replace("48 wall-clock hours", "480 wall-clock hours")
        )
        oversized["resource_estimate"] = json.loads(
            json.dumps(adapter["resource_estimate"], ensure_ascii=False)
            .replace("6 GPU-hours", "60 GPU-hours")
            .replace("48 小时", "480 小时")
        )
        self.assertIn(
            "resource-bounds",
            response_violations(response_with_adapter(attempt, oversized)),
        )

    def test_oracle_requires_historical_and_fairness_evidence_in_local_sections(self):
        attempt = self.require_text(ATTEMPT1)
        historical_soup = replace_named_section(
            attempt,
            "结论范围",
            "FlowX 与 FluidBase 将在实验中比较。",
        ).replace(
            "\n## 两阶段",
            "\n## 词汇表\n\n不能相除、不构成可比较、GPU、分辨率、timestep、CityFlood、"
            "DamBreak、renderer、warm-up。\n\n## 两阶段",
            1,
        )
        self.assertIn("historical-comparison", response_violations(historical_soup))

        fairness_body = (
            "锁定 FlowX 与 FluidBase revision，并记录共同环境。\n\n"
            "词汇保留：timestep resolution paired random warm-up synchronization。"
        )
        fairness_soup = replace_named_section(attempt, "公平性合同", fairness_body)
        self.assertIn("fairness-contract", response_violations(fairness_soup))

    def test_fresh_enabled_attempt_is_semantic_schema_valid_and_promoted_verbatim(self):
        attempt = self.require_text(ATTEMPT1)
        raw = ATTEMPT1.read_bytes()
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(response_violations(attempt), set())
        self.assertEqual(ENABLED.read_bytes(), raw)

    def test_evaluation_freezes_attempt_provenance_and_verdicts(self):
        record = json.loads(self.require_text(EVALUATION))
        self.assertEqual(validate_evaluation_record(record), [])
        self.assertEqual(record["skill"], "designing-simulation-experiments")
        self.assertEqual(record["scenario"], self.require_text(SCENARIO))
        self.assertEqual(record["baseline"]["response"], self.require_text(BASELINE))
        self.assertEqual(record["enabled"]["response"], self.require_text(ENABLED))
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(
            record["baseline"]["violations"],
            sorted(response_violations(self.require_text(BASELINE))),
        )
        self.assertEqual(record["enabled"]["violations"], [])
        self.assertEqual(record["baseline"]["validator_issue_count"], 25)
        self.assertEqual(record["enabled"]["validator_issue_count"], 0)
        attempt = record["attempt_history"][0]
        self.assertEqual(attempt["fixture"], ATTEMPT1.relative_to(ROOT).as_posix())
        self.assertEqual(attempt["response_bytes"], len(ATTEMPT1.read_bytes()))
        self.assertEqual(
            attempt["response_sha256"], hashlib.sha256(ATTEMPT1.read_bytes()).hexdigest()
        )
        self.assertEqual(
            attempt["isolation"]["allowed_inputs"],
            [
                "tests/fixtures/designing-simulation-experiments-scenario.txt",
                "skills/designing-simulation-experiments/SKILL.md",
                "skills/designing-simulation-experiments/references/experiment-design.md",
                "schemas/experiment-plan.schema.json",
            ],
        )
        self.assertEqual(
            attempt["isolation"]["forbidden_inputs"],
            [
                "baseline response",
                "tests and test fixtures other than the scenario",
                "evaluation records",
                "agents/openai.yaml",
                "source-research controller artifact",
                "task brief, plans, report, Git metadata/history, and conversation",
            ],
        )
        self.assertEqual(record["hashes"]["scenario_sha256"], SCENARIO_SHA256)
        self.assertEqual(record["hashes"]["baseline_response_sha256"], BASELINE_SHA256)
        self.assertEqual(record["hashes"]["enabled_attempt_1_sha256"], ATTEMPT1_SHA256)
        self.assertEqual(record["hashes"]["enabled_response_sha256"], ATTEMPT1_SHA256)
        self.assertEqual(record["hashes"]["enabled_response_bytes"], ATTEMPT1_BYTES)

    def test_task_26_files_are_tracked_and_portable_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            ROOT / "tests" / "test_designing_simulation_experiments_skill.py",
            SCENARIO,
            BASELINE,
            ENABLED,
            ATTEMPT1,
            EVALUATION,
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
            archive = Path(temporary) / "task26.tar"
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
            archive_test = (
                "import sys, unittest; "
                "from tests.test_designing_simulation_experiments_skill import "
                "DesigningSimulationExperimentsSkillTests as C; "
                "excluded = {'test_task_26_files_are_tracked_and_portable_from_staged_archive'}; "
                "suite = unittest.TestSuite(test for test in "
                "unittest.defaultTestLoader.loadTestsFromTestCase(C) "
                "if test._testMethodName not in excluded); "
                "result = unittest.TextTestRunner(verbosity=2).run(suite); "
                "sys.exit(not result.wasSuccessful())"
            )
            result = subprocess.run(
                [sys.executable, "-c", archive_test],
                cwd=extract,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
