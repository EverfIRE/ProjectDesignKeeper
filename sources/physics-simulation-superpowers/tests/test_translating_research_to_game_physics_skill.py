"""Behavioral and portability contracts for research-to-game transfer."""

import hashlib
import json
import re
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "translating-research-to-game-physics" / "SKILL.md"
REFERENCE = SKILL.parent / "references" / "transfer-brief.md"
UI = SKILL.parent / "agents" / "openai.yaml"
SCENARIO = ROOT / "tests" / "fixtures" / "translating-research-to-game-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "translating-research-to-game-physics-baseline-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "translating-research-to-game-physics-enabled-attempt-1-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "translating-research-to-game-physics-enabled-response.txt"
EVALUATION = ROOT / "evaluations" / "translating-research-to-game-physics" / "evaluation.json"

SCENARIO_BYTES = 1822
SCENARIO_SHA256 = "80fda30e4f3e3f1d0a5cbf3a2a088761ec37a2d4a0db4c80eab237cf3eaaf2f6"
BASELINE_BYTES = 12446
BASELINE_SHA256 = "7e46cbfa89a2baacc317815bba609ebeb07d0ec6d75786cb668a234563fbdd94"
ATTEMPT1_BYTES = 20384
ATTEMPT1_SHA256 = "239503598d5463f7caedfc37f62775d17d2c84c1596b28adf4a8c24f63d0456f"

EXPECTED_H2 = (
    "Transfer decision",
    "Approximation and implementation slice",
    "Runtime production contract",
    "Gates and acceptance",
)
INVENTED_SUBALLOCATION = re.compile(
    r"(?:输入打包|近似推理|模型/表|状态\s*delta|序列化|埋点|"
    r"(?:input|feature)\s+pack(?:ing)?|inference|model(?:/table)?|table|"
    r"state\s+delta|serialization|telemetry)\s*[:=]?\s*\d+(?:\.\d+)?",
    re.IGNORECASE,
)
REVERSED_BUDGET = re.compile(
    r"(?:server\s*cpu.{0,24}p95|(?:server\s*)?gpu.{0,24}p95|"
    r"(?:resident|常驻)\s*(?:memory|内存)|(?:per[- ]object|每个相关对象).{0,20}(?:bandwidth|带宽))"
    r"\s*(?:>=|≥|>|at\s+least|不少于)",
    re.IGNORECASE,
)
AUTHORITY_DENIAL = re.compile(
    r"(?:server|服务器).{0,35}(?:does\s+not|doesn't|is\s+not|isn't|not|不|非)"
    r".{0,30}(?:own|authoritative|authority|accept|拥有|权威|接受)"
    r".{0,50}(?:physics|gameplay|state|状态)",
    re.IGNORECASE,
)
CONTRADICTORY_OPTIMIZER = re.compile(
    r"(?:python|cuda|reverse-mode|optimizer).{0,60}"
    r"(?:cannot|can't|must\s+not|不能|不得|不应).{0,35}(?:offline|离线)"
    r".{0,40}(?:and|but|then|而|却).{0,40}(?:must|should|will|必须|应)"
    r".{0,40}(?:authoritative\s+tick|online|runtime|在线)",
    re.IGNORECASE,
)
OFFLINE_BOUNDARY_REVERSAL = re.compile(
    r"(?:python|cuda|reverse-mode|optimizer).{0,50}"
    r"(?:must\s+not|should\s+not|cannot|can't|不得|不能|不应)\s+"
    r"(?:(?:remain|stay|be|run|operate|保持|留在|运行)\s+){0,3}(?:offline|离线)",
    re.IGNORECASE,
)
SUBALLOCATION_NARROW = re.compile(
    r"(?:input|feature)\s+pack(?:ing)?|inference|optimizer|model(?:/table)?|table|"
    r"state\s+delta|serialization|telemetry|upload|download|synchronization|"
    r"输入打包|特征构造|近似推理|优化器|模型/表|模型|查表|状态\s*delta|序列化|埋点|遥测|上传|下载|同步",
    re.IGNORECASE,
)
SUBALLOCATION_BROAD = re.compile(
    r"(?:cpu|gpu|memory|bandwidth|solver|chaos|network)|"
    r"(?:处理器|显卡|内存|带宽|求解器|网络)|"
    + SUBALLOCATION_NARROW.pattern,
    re.IGNORECASE,
)
RESOURCE_QUANTITY = re.compile(
    r"\d+(?:\.\d+)?\s*(?:ms|mb|gb|kb/s|bytes?/s|%)",
    re.IGNORECASE,
)
ALLOCATION_VERB = re.compile(
    r"\b(?:allocate|assign|reserve|allot|apportion|budget|give|grant|provide|set|create)\b|"
    r"分配|预留|划给|配给|给予|给出|设定|设置",
    re.IGNORECASE,
)
BUDGET_RESOURCE = re.compile(
    r"server\s*cpu|(?:server\s*)?gpu|resident\s+memory|per[- ]object\s+bandwidth|"
    r"服务器\s*cpu|gpu|常驻内存|每个相关对象.{0,10}带宽",
    re.IGNORECASE,
)
BUDGET_REVERSED_DIRECTION = re.compile(
    r">=|≥|\bat\s+least\b|\b(?:is|as)\s+(?:a\s+)?(?:minimum|floor)\b|"
    r"\bnot\s+(?:a\s+)?cap\b|不少于|至少|下限|不是.{0,8}上限",
    re.IGNORECASE,
)
BUDGET_OVER_CAP_ACCEPTED = re.compile(
    r"(?:\babove\b|\bover\b|\bexceed(?:s|ed|ing)?\b|\bgreater\s+than\b|超过|高于)"
    r".{0,35}(?:\bpass(?:es|ed)?\b|\baccept(?:able|ed)?\b|\ballow(?:ed)?\b|\bgo\b|通过|可接受|允许)|"
    r"(?:\bpass(?:es|ed)?\b|\baccept(?:able|ed)?\b|\ballow(?:ed)?\b|\bgo\b|通过|可接受|允许)"
    r".{0,35}(?:\babove\b|\bover\b|\bexceed(?:s|ed|ing)?\b|\bgreater\s+than\b|超过|高于)",
    re.IGNORECASE,
)
ONLINE_OPTIMIZER_PRESCRIPTION = re.compile(
    r"(?:\b(?:run|execute|put|integrate|ship)\b|运行|执行|放入|接入|集成)"
    r".{0,30}(?:python|cuda|reverse-mode|optimizer).{0,50}"
    r"(?:server|authoritative|服务器|权威).{0,25}(?:physics|simulation|物理|仿真)"
    r".{0,15}(?:loop|tick|step|update|循环|步进|更新)|"
    r"(?:python|cuda|reverse-mode|optimizer).{0,30}"
    r"(?:\b(?:run|execute|put|integrate|ship)\b|运行|执行|放入|接入|集成)"
    r".{0,50}(?:server|authoritative|服务器|权威).{0,25}"
    r"(?:physics|simulation|物理|仿真).{0,15}(?:loop|tick|step|update|循环|步进|更新)",
    re.IGNORECASE,
)
REMOVE_OFFLINE_TEACHER_BOUNDARY = re.compile(
    r"(?:\b(?:remove|drop|delete|bypass|erase)\b|取消|删除|移除|绕过)"
    r".{0,35}(?:offline\s+teacher|offline.{0,15}boundary|离线.{0,15}(?:teacher|边界))",
    re.IGNORECASE,
)


def normalized(value) -> str:
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return re.sub(r"\s+", " ", value).casefold()


def has_each(text: str, groups) -> bool:
    compact = normalized(text)
    return all(any(term.casefold() in compact for term in group) for group in groups)


def h2_sections(text: str) -> tuple[list[str], dict[str, str]]:
    matches = list(
        re.finditer(
            r"^##\s+(?P<heading>[^\r\n]+)\n(?P<body>.*?)(?=^##\s|\Z)",
            text,
            flags=re.MULTILINE | re.DOTALL,
        )
    )
    headings = [match.group("heading").strip() for match in matches]
    return headings, {
        match.group("heading").strip(): match.group("body") for match in matches
    }


def h3_region(text: str, gate: int) -> str:
    match = re.search(
        rf"^###\s+Gate\s+{gate}\b[^\r\n]*\n(?P<body>.*?)(?=^###\s+Gate\s+\d+\b|\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    return match.group("body") if match else ""


def semantic_clauses(text: str) -> list[str]:
    return [
        clause.strip()
        for clause in re.split(
            r"[。！？;；\r\n]+|(?<!\d)[.!?](?!\d)|"
            r"\b(?:but|then|instead)\b|但是|但|而是|然后",
            text,
            flags=re.IGNORECASE,
        )
        if clause.strip()
    ]


def has_invented_suballocation(text: str) -> bool:
    if INVENTED_SUBALLOCATION.search(text):
        return True
    denial = re.compile(r"\b(?:do\s+not|must\s+not|never|reject)\b|不得|禁止|拒绝", re.I)
    total_cap = re.compile(r"\b(?:total|overall|supplied)\b.{0,20}\bcap\b|总上限|总预算", re.I)
    for clause in semantic_clauses(text):
        if denial.search(clause):
            continue
        quantity = RESOURCE_QUANTITY.search(clause)
        if not quantity:
            continue
        if ALLOCATION_VERB.search(clause) and SUBALLOCATION_BROAD.search(clause):
            if not total_cap.search(clause):
                return True
        narrow = SUBALLOCATION_NARROW.search(clause)
        if narrow and re.search(
            rf"{RESOURCE_QUANTITY.pattern}.{{0,28}}(?:to|for|用于|给)\s*(?:{SUBALLOCATION_NARROW.pattern})",
            clause,
            flags=re.IGNORECASE,
        ):
            return True
    return False


def has_reversed_budget(text: str) -> bool:
    if REVERSED_BUDGET.search(text):
        return True
    acceptance_denial = re.compile(
        r"\b(?:not|never|cannot|can't|must\s+not)\b.{0,12}"
        r"(?:pass|accept|allow|go)|不得.{0,12}(?:通过|接受|允许)|不能.{0,12}(?:通过|接受)",
        re.IGNORECASE,
    )
    for clause in semantic_clauses(text):
        if not (BUDGET_RESOURCE.search(clause) and RESOURCE_QUANTITY.search(clause)):
            continue
        if BUDGET_REVERSED_DIRECTION.search(clause):
            return True
        if BUDGET_OVER_CAP_ACCEPTED.search(clause) and not acceptance_denial.search(clause):
            return True
    return False


def has_unsafe_authority_relation(text: str) -> bool:
    for clause in semantic_clauses(text):
        compact = normalized(clause)
        state_not_server = re.search(
            r"(?:gameplay|physics|state|状态).{0,35}"
            r"(?:does\s+not|doesn't|is\s+not|isn't|not|不属于|不归).{0,25}"
            r"(?:belong|owned|server|服务器)",
            compact,
        ) or re.search(
            r"(?:server|服务器).{0,30}(?:does\s+not|doesn't|is\s+not|isn't|not|不|非)"
            r".{0,25}(?:own|拥有).{0,35}(?:state|physics|状态)",
            compact,
        )
        client_is_authoritative = re.search(
            r"\bclients?\b.{0,18}\b(?:is|are|become|remain|act\s+as)\b"
            r".{0,12}\bauthoritative\b|客户端.{0,20}(?:成为|作为|是).{0,10}权威",
            compact,
        )
        client_authority_denial = re.search(
            r"\bclients?\b.{0,25}\b(?:not|never|must\s+not|cannot|can't)\b"
            r".{0,18}\bauthoritative\b|"
            r"客户端.{0,25}(?:不得|不能|不可|不是|不应).{0,18}权威",
            compact,
        )
        client_owns_state = re.search(
            r"\bclients?\b(?:(?!\bserver\b).){0,28}\b(?:own|control|authoritative)\b"
            r".{0,30}(?:gameplay|physics|state)|"
            r"(?:gameplay|physics|state).{0,30}\b(?:owned|controlled)\b.{0,18}\bclients?\b|"
            r"客户端(?:(?!服务器).){0,28}(?:拥有|控制|权威).{0,25}(?:gameplay|physics|状态)",
            compact,
        )
        client_ownership_denial = re.search(
            r"\bclients?\b.{0,20}\b(?:not|never|must\s+not|cannot|can't)\b"
            r".{0,18}\b(?:own|control|authoritative)\b|"
            r"客户端.{0,22}(?:不得|不能|不可|不应).{0,15}(?:拥有|控制|权威)",
            compact,
        )
        relation_denial = re.search(
            r"\b(?:no-go|reject(?:ed)?|fail/stop)\b|立即\s*fail|拒绝|禁止|不得|不能",
            compact,
        )
        if (
            state_not_server
            or (client_is_authoritative and not client_authority_denial)
            or (
                client_owns_state
                and not client_ownership_denial
                and not relation_denial
            )
        ):
            return True
    return False


def has_online_optimizer_prescription(text: str) -> bool:
    denial = re.compile(
        r"\b(?:do\s+not|must\s+not|should\s+not|cannot|can't|never|reject)\b|"
        r"不得|禁止|不能|不应|拒绝|no-go",
        re.IGNORECASE,
    )
    return any(
        not denial.search(clause)
        and (
            ONLINE_OPTIMIZER_PRESCRIPTION.search(clause)
            or REMOVE_OFFLINE_TEACHER_BOUNDARY.search(clause)
        )
        for clause in semantic_clauses(text)
    )


def has_runtime_cap_contract(text: str) -> bool:
    compact = normalized(text)
    return all(
        re.search(pattern, compact)
        for pattern in (
            r"server\s*cpu\s*p95\s*(?:≤|<=)\s*0\.6\s*ms",
            r"gpu\s*p95\s*(?:≤|<=)\s*1\.0\s*ms",
            r"(?:resident\s+memory|常驻内存)\s*(?:≤|<=)\s*128\s*mb",
            r"(?:per[- ]object.{0,20}bandwidth|每个相关对象带宽)\s*(?:≤|<=)\s*8\s*kb/s",
        )
    )


def has_runtime_authority_contract(text: str) -> bool:
    compact = normalized(text)
    server_owns_state = re.search(
        r"(?:server.{0,35}(?:authoritative|owns?).{0,30}(?:state|physics)|"
        r"服务器.{0,35}(?:计算并接受|拥有|权威).{0,30}(?:state|状态))",
        compact,
    )
    client_sends_intent = re.search(
        r"(?:client.{0,20}(?:only|solely).{0,20}(?:intent|input)|"
        r"客户端.{0,20}(?:只|仅).{0,20}输入意图)",
        compact,
    )
    return bool(server_owns_state and client_sends_intent)


def baseline_gap_issues(text: str) -> set[str]:
    issues = set()
    if has_invented_suballocation(text):
        issues.add("invented-suballocations")
    gate_match = re.search(
        r"^##[^\r\n]*(?:最小\s*prototype|minimum\s+prototype)[^\r\n]*\n(?P<body>.*)\Z",
        text,
        flags=re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    gate = gate_match.group("body") if gate_match else ""
    if not gate or has_each(
        gate,
        (
            ("20",),
            ("a/b", "玩家价值", "product value"),
            ("同时满足", "only if all", "才 go"),
        ),
    ):
        issues.add("prototype-stage-collapse")
    return issues


def unsafe_direction_issues(text: str) -> set[str]:
    issues = set()
    if (
        AUTHORITY_DENIAL.search(text)
        or CONTRADICTORY_OPTIMIZER.search(text)
        or OFFLINE_BOUNDARY_REVERSAL.search(text)
        or has_unsafe_authority_relation(text)
        or has_online_optimizer_prescription(text)
    ):
        issues.add("unsafe-transfer-direction")
    denial = re.compile(
        r"拒绝|禁止|不得|不能|不可|不要|不把|不进入|不运行|只可在离线|"
        r"未(?:被)?(?:证明|验证|测量|授权)|没有证据|无证据|no-go|"
        r"fail/stop|立即\s*fail|"
        r"\b(?:never|must not|cannot|can't|do not|does not|not authoritative|rejected)\b",
        re.IGNORECASE,
    )
    risk = re.compile(
        r"(?:python|cuda|reverse-mode|optimizer).{0,60}(?:authoritative\s+tick|(?<!离)在线|runtime)|"
        r"客户端.{0,50}(?:transform|状态).{0,30}(?:权威|服务器采纳)|"
        r"client.{0,50}(?:transform|state).{0,30}authoritative|"
        r"(?:build|demo|目测).{0,50}(?:production|上线|ship|pass)|"
        r"少跑.{0,20}迭代.{0,40}(?:即可|默认|上线)",
        re.IGNORECASE,
    )
    for clause in re.split(r"[。.!?！？;；\r\n]+", text):
        if risk.search(clause) and not denial.search(clause):
            issues.add("unsafe-transfer-direction")
    return issues


def response_issues(text: str) -> set[str]:
    issues = unsafe_direction_issues(text)
    if has_invented_suballocation(text):
        issues.add("invented-suballocations")
    if has_reversed_budget(text):
        issues.add("budget-direction")
    headings, sections = h2_sections(text)
    if tuple(headings) != EXPECTED_H2:
        issues.add("output-structure")
        return issues

    decision = sections[EXPECTED_H2[0]]
    approximation = sections[EXPECTED_H2[1]]
    runtime = sections[EXPECTED_H2[2]]
    gates = sections[EXPECTED_H2[3]]

    if not has_each(
        decision,
        (
            ("single", "单个"),
            ("10",),
            ("offline", "离线"),
            ("35",),
            ("28",),
            ("±4", "+/-4", "4%"),
            ("partial",),
            ("45",),
            ("200",),
            ("12 gb", "12gb"),
            ("direct", "直接"),
            ("no-go", "禁止", "拒绝"),
        ),
    ):
        issues.add("retained-claim")
    if not has_each(
        decision,
        (
            ("scientific validity",),
            ("partial",),
            ("implementation feasibility",),
            ("direct", "直接"),
            ("no-go",),
            ("product value",),
            ("unknown", "未知"),
            ("not prove", "未证明", "不能迁移", "没有证据证明"),
        ),
    ):
        issues.add("three-decision-separation")

    if not has_each(
        approximation,
        (
            ("offline teacher", "离线 teacher", "离线优化", "离线、可复现"),
            ("surrogate", "distill", "蒸馏", "降阶"),
            ("runtime", "运行时"),
            (
                "no reverse-mode",
                "不运行 reverse-mode",
                "禁止在线反向",
                "reverse-mode optimizer 只可在离线",
            ),
            ("input", "输入"),
            ("output", "输出"),
            ("ood", "分布外"),
            ("clamp", "限幅"),
            ("one object", "单对象", "一个对象"),
            ("baseline", "control", "基线"),
            ("treatment", "候选"),
            ("same", "相同"),
            ("license", "许可证"),
            ("hash", "哈希"),
            ("train", "训练"),
            ("test", "测试"),
        ),
    ):
        issues.add("approximation-and-slice")

    if not has_each(
        runtime,
        (
            ("unreal",),
            ("chaos",),
            ("version", "版本"),
            ("unknown", "未知", "未提供"),
            ("no api", "不写 api", "不得虚构", "不命名或假定任何 api"),
            ("physics tick",),
            ("60 fps",),
            ("not", "不等于", "不是"),
            ("0.6",),
            ("1.0", "1 ms", "1ms"),
            ("128",),
            ("8 kb/s", "8kb/s"),
            ("p95",),
            ("p99",),
            ("sub-budget", "子预算", "分项", "整个功能的新增总上限"),
            ("unknown", "待实测", "不拆分"),
            ("server", "服务器"),
            ("authoritative", "权威"),
            ("intent", "输入意图"),
            ("cosmetic", "外观"),
            ("reconcil", "纠错", "收敛"),
            ("lod",),
            ("hysteresis", "迟滞"),
            ("fallback", "回退"),
            ("reversible", "可逆"),
        ),
    ) or not has_runtime_cap_contract(runtime) or not has_runtime_authority_contract(runtime):
        issues.add("runtime-contract")

    all_h3 = re.findall(r"^###\s+([^\r\n]+)", gates, flags=re.MULTILINE)
    gate_numbers = [
        match.group(1)
        for heading in all_h3
        if (match := re.match(r"Gate\s+(\d+)\b", heading, flags=re.IGNORECASE))
    ]
    if len(all_h3) != 4 or gate_numbers != ["1", "2", "3", "4"]:
        issues.add("gate-structure")

    gate1 = h3_region(gates, 1)
    gate2 = h3_region(gates, 2)
    gate3 = h3_region(gates, 3)
    gate4 = h3_region(gates, 4)
    if not has_each(
        gate1,
        (
            ("one object", "单对象", "一个对象"),
            ("go", "pass"),
            ("scale", "扩展", "规模"),
            ("not production", "不代表 production", "不授权上线", "不授权玩家实验、production"),
        ),
    ) or any(term in normalized(gate1) for term in ("20 objects", "20 个对象", "player a/b")):
        issues.add("minimal-prototype-gate")
    if not has_each(gate2, (("20",), ("network", "网络"), ("budget", "预算"))):
        issues.add("scale-and-network-gate")
    if not has_each(
        gate3,
        (("a/b",), ("player", "玩家"), ("product value", "产品价值", "玩家价值"), ("guardrail", "护栏")),
    ):
        issues.add("product-value-gate")
    if not has_each(
        gate4,
        (("rollout", "发布"), ("feature flag", "feature-flag"), ("fallback", "回退"), ("stop", "停止")),
    ):
        issues.add("rollout-gate")
    if not has_each(
        gates,
        (
            ("cpu",),
            ("gpu",),
            ("memory", "内存"),
            ("bandwidth", "带宽"),
            ("nan",),
            ("penetration", "穿透"),
            ("correction", "纠错"),
            ("ood",),
            ("fixed seed", "固定 seed"),
            ("telemetry", "遥测"),
            ("stop", "停止"),
        ),
    ):
        issues.add("regression-and-stop")
    return issues


class TranslatingResearchToGamePhysicsSkillTests(unittest.TestCase):
    def require_text(self, path: Path) -> str:
        self.assertTrue(path.is_file(), f"missing required Task 29 file: {path.relative_to(ROOT)}")
        return path.read_text(encoding="utf-8")

    def test_red_phase_required_skill_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI, ATTEMPT1, ENABLED, EVALUATION):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_frozen_scenario_and_baseline_have_exact_controller_bytes(self):
        for path, size, digest in (
            (SCENARIO, SCENARIO_BYTES, SCENARIO_SHA256),
            (BASELINE, BASELINE_BYTES, BASELINE_SHA256),
        ):
            raw = path.read_bytes()
            with self.subTest(path=path.name):
                self.assertEqual(len(raw), size)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
                self.assertNotIn(b"\r", raw)
                self.assertTrue(raw.endswith(b"\n"))
                self.assertFalse(raw.endswith(b"\n\n"))

    def test_blind_baseline_has_only_the_two_decision_gaps(self):
        baseline = self.require_text(BASELINE)
        self.assertEqual(
            baseline_gap_issues(baseline),
            {"invented-suballocations", "prototype-stage-collapse"},
        )
        for term in (
            "Scientific validity",
            "Implementation feasibility",
            "Product value",
            "server CPU",
            "0.60 ms p95",
            "客户端预测不得上传",
            "fallback",
        ):
            self.assertIn(normalized(term), normalized(baseline))

    def test_enabled_response_satisfies_the_transfer_contract(self):
        self.assertEqual(response_issues(self.require_text(ENABLED)), set())

    def test_unsafe_transfer_mutations_are_rejected_and_explicit_denials_are_safe(self):
        unsafe = (
            "Python/CUDA optimizer 运行在 authoritative tick。",
            "客户端 transform 作为服务器权威状态。",
            "Demo 目测正确即可 ship。",
            "少跑 10 次迭代即可上线。",
        )
        for addition in unsafe:
            with self.subTest(unsafe=addition):
                self.assertEqual(unsafe_direction_issues(addition), {"unsafe-transfer-direction"})

        safe = (
            "不得把 Python/CUDA optimizer 放入 authoritative tick。",
            "客户端 transform 不得成为服务器权威状态。",
            "Demo 目测成功不能直接 ship。",
            "少跑 10 次迭代不能作为上线证据。",
        )
        for addition in safe:
            with self.subTest(safe=addition):
                self.assertEqual(unsafe_direction_issues(addition), set())

    def test_budget_stage_and_contract_mutations_are_rejected(self):
        canonical = self.require_text(ENABLED)

        self.assertIn(
            "invented-suballocations",
            response_issues(canonical + "\n输入打包 0.05 ms；状态 delta 5 KB/s。\n"),
        )

        collapsed = canonical.replace(
            "### Gate 2",
            "只有同时通过 20 objects 与 player A/B 才 go。\n\n### Gate 2",
            1,
        )
        self.assertIn("minimal-prototype-gate", response_issues(collapsed))

        decision_start = canonical.index("## Transfer decision")
        decision_end = canonical.index("## Approximation and implementation slice")
        decision = canonical[decision_start:decision_end]
        stripped_decision = re.sub(r"35|28|±4|45|200|12\s*GB", "[removed]", decision)
        without_claim = canonical[:decision_start] + stripped_decision + canonical[decision_end:]
        self.assertIn("retained-claim", response_issues(without_claim))

        without_budgets = canonical
        for token in ("0.6", "1.0", "128", "8 KB/s"):
            without_budgets = without_budgets.replace(token, "[removed]")
        self.assertIn("runtime-contract", response_issues(without_budgets))

        without_intent = canonical.replace("客户端只发输入意图", "客户端提供状态")
        self.assertIn("runtime-contract", response_issues(without_intent))

    def test_reviewed_polarity_budget_and_gate_structure_mutations_are_rejected(self):
        canonical = self.require_text(ENABLED)
        mutations = (
            (
                "budget-direction",
                canonical.replace(
                    "server CPU p95 ≤ 0.6 ms", "server CPU p95 ≥ 0.6 ms", 1
                ),
            ),
            (
                "unsafe-transfer-direction",
                canonical + "\n服务器不拥有 gameplay physics state；客户端只发输入意图。\n",
            ),
            (
                "unsafe-transfer-direction",
                canonical
                + "\nPython optimizer cannot stay offline and must run in authoritative tick.\n",
            ),
            (
                "unsafe-transfer-direction",
                canonical
                + "\nThe Python optimizer must not remain offline; it must run in the authoritative tick.\n",
            ),
            (
                "unsafe-transfer-direction",
                canonical
                + "\nGameplay physics state does not belong to the server; clients are authoritative.\n",
            ),
            (
                "invented-suballocations",
                canonical + "\nInference 0.20 ms; model 32 MB.\n",
            ),
            (
                "invented-suballocations",
                canonical + "\nAllocate 0.20 ms to inference and 32 MB to the model.\n",
            ),
            (
                "budget-direction",
                canonical
                + "\nThe 0.6 ms server CPU p95 budget is a minimum, not a cap.\n",
            ),
            (
                "budget-direction",
                canonical + "\nTreat server CPU p95 above 0.6 ms as a pass.\n",
            ),
            (
                "unsafe-transfer-direction",
                canonical
                + "\nThe client must own gameplay physics state; the server only observes it.\n",
            ),
            (
                "invented-suballocations",
                canonical + "\nGive inference a 0.20 ms sub-budget.\n",
            ),
            (
                "unsafe-transfer-direction",
                canonical
                + "\nRun the Python optimizer in the server physics loop and remove the offline teacher boundary.\n",
            ),
            ("gate-structure", canonical + "\n### Gate 5\nShip review.\n"),
            (
                "gate-structure",
                canonical.replace("### Gate 1", "### Gate X", 1).replace(
                    "### Gate 2", "### Gate 1", 1
                ).replace("### Gate X", "### Gate 2", 1),
            ),
            ("gate-structure", canonical + "\n### Gate 4\nDuplicate rollout.\n"),
        )
        for expected, mutated in mutations:
            with self.subTest(expected=expected):
                self.assertIn(expected, response_issues(mutated))

    def test_relation_oracle_preserves_total_caps_and_explicit_safe_polarity(self):
        safe_directions = (
            "Python optimizer must not run in authoritative tick; it must stay offline.",
            "Do not run the Python optimizer in the server physics loop; retain the offline teacher boundary.",
            "Clients are not authoritative; the server owns gameplay physics state.",
            "The client must not own gameplay physics state; the server owns it.",
            "客户端不得成为权威；服务器拥有 gameplay physics state。",
        )
        for statement in safe_directions:
            with self.subTest(statement=statement):
                self.assertEqual(unsafe_direction_issues(statement), set())

        supplied_total = (
            "The supplied total server CPU p95 cap is 0.6 ms; "
            "the inference sub-budget is unknown and none is allocated."
        )
        self.assertFalse(has_invented_suballocation(supplied_total))
        self.assertFalse(has_reversed_budget(supplied_total))
        self.assertFalse(
            has_invented_suballocation("Do not give inference a 0.20 ms sub-budget.")
        )
        self.assertFalse(
            has_reversed_budget(
                "Treat server CPU p95 above 0.6 ms as a fail and keep the cap."
            )
        )

    def test_entry_reference_and_ui_are_compact_and_routable(self):
        skill = self.require_text(SKILL)
        reference = self.require_text(REFERENCE)
        ui = self.require_text(UI)
        self.assertTrue(skill.isascii())
        words = re.findall(r"\b[A-Za-z0-9][A-Za-z0-9'_-]*\b", skill)
        self.assertLessEqual(len(words), 500)
        self.assertIn('description: "Use when', skill)
        self.assertIn("references/transfer-brief.md", skill)
        self.assertEqual(skill.count("references/"), 1)
        self.assertIn("$translating-research-to-game-physics", ui)
        self.assertIn("allow_implicit_invocation: true", ui)
        self.assertLessEqual(len(ui.splitlines()), 8)
        for term in (
            "DiffTaichi",
            "DiffPD",
            "Unreal Engine",
            "Networked Physics",
            "scientific validity",
            "implementation feasibility",
            "product value",
        ):
            with self.subTest(term=term):
                self.assertIn(term, reference)

    def test_attempt_is_frozen_and_promoted_verbatim(self):
        raw = ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), ATTEMPT1_BYTES)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), ATTEMPT1_SHA256)
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(response_issues(raw.decode("utf-8")), set())
        self.assertEqual(ENABLED.read_bytes(), raw)

    def test_evaluation_freezes_provenance_and_verdicts(self):
        record = json.loads(self.require_text(EVALUATION))
        self.assertEqual(validate_evaluation_record(record), [])
        self.assertEqual(record["skill"], "translating-research-to-game-physics")
        self.assertEqual(record["scenario"], self.require_text(SCENARIO))
        self.assertEqual(record["baseline"]["response"], self.require_text(BASELINE))
        self.assertEqual(record["enabled"]["response"], self.require_text(ENABLED))
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(
            set(record["baseline"]["violations"]),
            {"invented-suballocations", "prototype-stage-collapse"},
        )
        self.assertEqual(record["enabled"]["violations"], [])
        self.assertEqual(record["hashes"]["scenario_sha256"], SCENARIO_SHA256)
        self.assertEqual(record["hashes"]["baseline_response_sha256"], BASELINE_SHA256)
        self.assertEqual(record["hashes"]["enabled_response_sha256"], ATTEMPT1_SHA256)

    def test_task_29_files_are_tracked_and_portable_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            ROOT / "tests" / "test_translating_research_to_game_physics_skill.py",
            SCENARIO,
            BASELINE,
            ATTEMPT1,
            ENABLED,
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
            archive = Path(temporary) / "task29.tar"
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
