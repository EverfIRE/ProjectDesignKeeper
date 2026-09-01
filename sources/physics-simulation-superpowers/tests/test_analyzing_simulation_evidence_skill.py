"""Behavioral contracts for evidence-calibrated simulation analysis."""

import copy
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
SKILL = ROOT / "skills" / "analyzing-simulation-evidence" / "SKILL.md"
REFERENCE = SKILL.parent / "references" / "evidence-analysis.md"
UI = SKILL.parent / "agents" / "openai.yaml"
SCENARIO = ROOT / "tests" / "fixtures" / "analyzing-simulation-evidence-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "analyzing-simulation-evidence-baseline-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "analyzing-simulation-evidence-enabled-attempt-1-response.txt"
ATTEMPT2 = ROOT / "tests" / "fixtures" / "analyzing-simulation-evidence-enabled-attempt-2-response.txt"
ENABLED = ROOT / "tests" / "fixtures" / "analyzing-simulation-evidence-enabled-response.txt"
EVALUATION = ROOT / "evaluations" / "analyzing-simulation-evidence" / "evaluation.json"

SCENARIO_BYTES = 1024
SCENARIO_SHA256 = "b69108ca6378cc22dfda5ce4f8c738e21744cf1eca9a6f1aff5983634cd94f87"
BASELINE_BYTES = 5245
BASELINE_SHA256 = "4aeb731728649b94a0c78a65c0339d5644b1c3ab62483902658b657c23e138cb"
ATTEMPT1_BYTES = 7843
ATTEMPT1_SHA256 = "c9d4d1502bfa0beefd23d93076d97a772121899fff35106062817aeb55682442"
ATTEMPT2_BYTES = 8125
ATTEMPT2_SHA256 = "88384089d5207b3a1b644086b68977238b809c243f7dedd78ce92b674dde0978"
EVALUATOR = "fresh isolated evaluator"
ALLOWED_INPUTS = [
    "tests/fixtures/analyzing-simulation-evidence-scenario.txt",
    "skills/analyzing-simulation-evidence/SKILL.md",
    "skills/analyzing-simulation-evidence/references/evidence-analysis.md",
    "skills/analyzing-simulation-evidence/agents/openai.yaml",
]
ATTEMPT1_FORBIDDEN_INPUTS = [
    "baseline response",
    "tests and test fixtures other than the scenario",
    "evaluation records",
    "source-research map/controller artifact",
    "task brief, plans, report, Git metadata/history, and conversation",
]
ATTEMPT2_FORBIDDEN_INPUTS = [
    "baseline response and enabled attempt 1",
    "tests and test fixtures other than the scenario",
    "evaluation records",
    "source-research map/controller artifact",
    "task brief, plans, report, Git metadata/history, and conversation",
]
ATTEMPT_TOOL_EXECUTION = (
    "No bundled analysis script was executed; no valid raw trace or comparison JSON "
    "was supplied."
)
TOP_LEVEL_EXECUTION_STATUS = "Neither script was executed for this evaluation."
PUBLISHABLE_CLAIM = re.compile(
    r"(?:\bwinner\b|赢家|overall\s+better|总体更好|(?:1\.57\s*[x×]).{0,24}"
    r"(?:speedup|faster|快|加速|提升)|(?:speedup|faster|快|加速|提升).{0,24}"
    r"(?:1\.57\s*[x×]))",
    re.IGNORECASE,
)
CLAIM_DENIAL = re.compile(
    r"(?:\bnot\b|\bunsupported\b|\bcannot\b|\bcan't\b|\bmust\s+not\b|"
    r"\bshould\s+not\b|\bno\s+publishable\b|\bunknown\b|\bunavailable\b|"
    r"\bundetermined\b|不是|不等于|不支持|不受支持|未证实|未知|不明|未确定|"
    r"\bdoes\s+not\s+prove\b|不能|不得|不可|不应|没有|不证明|无法|阻塞)",
    re.IGNORECASE,
)
EN_DISCOURSE_ACTION = (
    r"(?:claim\w*|conclud\w*|infer\w*|assert\w*|state\w*|publish\w*|"
    r"determin\w*|judg\w*|prov(?:e|es|ed|ing|en)|establish(?:es|ed|ing)?|"
    r"demonstrat(?:e|es|ed|ing)|show(?:s|ed|ing|n)?|confirm(?:s|ed|ing)?|"
    r"indicat(?:e|es|ed|ing)|verif(?:y|ies|ied|ying))"
)
EN_DISCOURSE_NOUN = r"(?:claim|conclusion|inference|assertion|finding|verdict|judgment)"
EN_EVIDENCE_NOUN = r"(?:observations?|evidence|record|measurements?)"
ZH_EVIDENCE_NOUN = r"(?:证据|观察|记录|测量)"
EN_RELATION_HEAD = (
    r"(?:according(?:\s+to)?|around|using|via|from|under|with|on|in|for|of|"
    r"within|during|across|per|based(?:\s+on)?)"
)
EN_AGENT_CLASSIFIER = (
    rf"(?!(?:{EN_RELATION_HEAD})\b)[A-Za-z][\w'’.-]*"
)
EN_AGENT_CATEGORY = r"(?:teams?|groups?|committees?)"
EN_EVIDENCE_AGENT_SUBJECT = (
    rf"(?:{EN_AGENT_CLASSIFIER}\s+{EN_AGENT_CATEGORY}|"
    r"people|persons?|reviewers?|researchers?|analysts?|authors?|staff|teams?|"
    r"groups?|committees?|experiments?|laborator(?:y|ies)|organizations?|associations?|"
    r"foundations?|alliances?|institutions?|compan(?:y|ies)|universit(?:y|ies)|colleges?|"
    r"departments?|systems?|we|they|he|she|i)"
)
ZH_COMMON_FAMILY_NAME = (
    r"[赵钱孙李周吴郑王冯陈蒋沈韩杨朱秦许何吕张曹金魏姜谢邹苏潘葛范彭"
    r"鲁韦马方俞任袁柳史唐费薛雷贺倪汤罗毕郝安傅齐康伍余顾孟黄萧尹姚"
    r"邵汪毛米戴宋熊舒董梁杜阮蓝季贾江郭梅林钟徐邱高夏蔡田樊胡霍卢莫程"
    r"曹曾谭廖刘叶阎潘龚文]"
)
ZH_ORGANIZATION_SUBJECT = (
    r"(?:机构|组织|协会|学会|基金会|联盟|实验室|研究所|研究院|中心|部门|公司|学院|大学|项目组|课题组|工作组|"
    r"委员会|评审组|审查组|研究团队|团队|实验人员|研究小组|小组|人员)"
)
ZH_AGENT_SUBJECT = (
    r"(?:"
    r"我|我们|咱|咱们|你|你们|他|她|它|他们|她们|它们|本人|"
    r"评审|审稿人|专家|分析员|研究员|工程师|实验员|技术员|作者|审查者|研究者|"
    r"教授|博士|"
    rf"{ZH_ORGANIZATION_SUBJECT}|"
    rf"{ZH_COMMON_FAMILY_NAME}[\u4e00-\u9fff]{{0,2}}(?:教授|博士|工程师|研究员|分析员|工)"
    r")"
)
ZH_EVIDENCE_DETERMINER = r"(?:(?:现有|已有|当前|这些|此|有限|可用))?"
ZH_EVIDENTIARY_ADJUNCT = (
    rf"(?:(?=[\u4e00-\u9fff]{{0,12}}{ZH_EVIDENCE_NOUN})"
    rf"[\u4e00-\u9fff]{{2,12}}?|据此)"
)
ZH_DISCOURSE_MODIFIER = (
    rf"(?:{ZH_EVIDENTIARY_ADJUNCT}|充分|明确|审慎|负责任地)"
)
EN_GOVERNING_NEGATION = (
    r"(?:\b(?:cannot|can't|(?:can|could|may|might|must|should|would)\s+not)\s+|"
    r"\b(?:[A-Za-z][\w'’.-]*\s+){1,4}(?:do|does|did)\s+not\s+)"
)
GOVERNING_CLAIM_DENIAL = re.compile(
    rf"{EN_GOVERNING_NEGATION}(?:"
    rf"(?:[A-Za-z][\w'’.-]*\s+){{0,3}}{EN_DISCOURSE_ACTION}|"
    rf"(?:[A-Za-z][\w'’.-]*\s+){{0,2}}(?:reach|form|make|issue|draw|support)\s+"
    rf"(?:a|the)\s+{EN_DISCOURSE_NOUN})"
    rf"(?=\s+(?:that|whether)\b|\s*[:：])|"
    rf"(?:不能|不得|不可|不应|无法)(?:{ZH_DISCOURSE_MODIFIER}){{0,2}}"
    rf"(?:"
    rf"主张|发布|断言|声明|推断|推论|归纳|判定|认定|论证|结论|裁定|证明|证实|说明|阐明|"
    rf"(?:形成|得出|作出)(?:结论|推论|判断)"
    rf")"
    rf"(?=\s*[:：])",
    re.IGNORECASE,
)
VERDICT_DENIAL = re.compile(
    r"\b(?:not\s+supported|unsupported|reject(?:ed|ion)?|fail(?:ed|ure)?|no)\b|"
    r"不支持|拒绝|失败|否",
    re.IGNORECASE,
)
SHARED_CLAIM_DENIAL_BRIDGE = re.compile(
    r"\b(?:whether|that|claim|publish|support|prove|establish)\w*\b|"
    r"主张|发布|支持|证明|证实|[\"“]",
    re.IGNORECASE,
)
EN_WORD = r"[A-Za-z][\w'’.-]*"
EN_CLAIM_REFERENT = (
    r"(?:FastFluid|ReferenceFluid|"
    r"(?:(?:the|this|that)\s+)?(?:method|solver|approach))"
)
EN_CLAIM_SUBJECT = (
    rf"(?:(?:the|this|that|a|an)\s+{EN_WORD}(?:\s+{EN_WORD}){{0,2}}|{EN_WORD})"
)
EN_INDEPENDENT_CLAUSE = re.compile(
    rf"^\s*(?:"
    rf"{EN_CLAIM_SUBJECT}"
    rf"\s+{EN_WORD}(?:\s+{EN_WORD}){{0,2}}\s+{EN_CLAIM_REFERENT}\b|"
    rf"{EN_CLAIM_REFERENT}\s+{EN_WORD}\b)",
    re.IGNORECASE,
)
EN_LOCAL_CLAIM_DENIAL = re.compile(
    rf"^\s*(?:"
    rf"{EN_CLAIM_SUBJECT}\s+never\s+{EN_WORD}(?:\s+{EN_WORD}){{0,2}}"
    rf"\s+{EN_CLAIM_REFERENT}\b|"
    rf"(?:nobody|no\s+one)\s+{EN_WORD}(?:\s+{EN_WORD}){{0,2}}"
    rf"\s+{EN_CLAIM_REFERENT}\b|"
    rf"no\s+{EN_WORD}(?:\s+{EN_WORD}){{0,2}}\s+{EN_WORD}"
    rf"(?:\s+{EN_WORD}){{0,2}}\s+{EN_CLAIM_REFERENT}\b)",
    re.IGNORECASE,
)
ZH_CLAIM_REFERENT = r"(?:FastFluid|ReferenceFluid|该方法|此方法|这个方法|该求解器|求解器|方法)"
CONTROLLED_CLAIM_REFERENT = re.compile(
    rf"(?:{EN_CLAIM_REFERENT}|{ZH_CLAIM_REFERENT})", re.IGNORECASE
)
ZH_INDEPENDENT_CLAIM = re.compile(
    rf"^\s*[\u4e00-\u9fff]{{1,8}}[\u4e00-\u9fff]{{1,8}}"
    rf"\s*{ZH_CLAIM_REFERENT}(?=$|\s|是|为)",
    re.IGNORECASE,
)
ZH_PROTECTED_ER_PHRASE = re.compile(
    r"总而言之|简而言之|然而|因而|从而|反而|进而|继而|幸而|故而|时而|偶而|而且"
)
ZH_LOCAL_CLAIM_DENIAL = re.compile(
    rf"^\s*(?:"
    rf"[\u4e00-\u9fff]{{1,12}}(?:从不|绝不|从未).{{0,18}}{ZH_CLAIM_REFERENT}|"
    rf"(?:无人|没有人|没有[\u4e00-\u9fff]{{1,8}}).{{0,18}}{ZH_CLAIM_REFERENT})",
    re.IGNORECASE,
)
PRESCRIPTION_ACTION = re.compile(
    r"\b(?:use|used|choose|chosen|set|assume|assumed|adopt|adopted)\b|"
    r"(?:使用|用作|选择|选用|设定|设为|采用|假定|填入)",
    re.IGNORECASE,
)
PRESCRIPTION_TARGETS = (
    re.compile(
        r"(?:rtx\s*\d{3,4}|a100|h100|mi\d{3,4}|"
        r"(?:intel|amd)\s+[a-z0-9 -]*\d[a-z0-9 -]*)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:(?:seed(?:\s+count)?|种子(?:数|数量|个数)?)"
        r".{0,20}\d+|\d+\s*(?:seeds?|个?种子))",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:(?:repetition|repeat|run\s+count|重复(?:次数|数)?|运行次数)"
        r".{0,20}\d+|\d+\s*(?:repetitions?|runs?|次重复|次运行))",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:(?:confidence|interval\s+method|bootstrap|置信水平|置信区间|区间方法)"
        r".{0,20}(?:\d{2,3}\s*%|bootstrap|t[- ]?interval|百分之\d+)|"
        r"(?:\d{2,3}\s*%|百分之\d+).{0,20}(?:confidence|bootstrap|置信区间|置信水平))",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:warm[- ]?up|预热).{0,20}"
        r"\d+(?:\.\d+)?\s*(?:seconds?|s\b|frames?|ticks?|秒|帧|步)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:quality\s*(?:threshold|metric)|质量(?:阈值|指标))"
        r".{0,25}(?:\d+(?:\.\d+)?|rmse|l2|ssim|iou|energy\s+error|均方根误差)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:generated[^ ]*\.jsonl|raw\s+trace|原始\s*trace|\.jsonl\b)", re.IGNORECASE),
    re.compile(r"frame[- ]?time.{0,24}(?:p\d+|\d+(?:\.\d+)?\s*ms)", re.IGNORECASE),
    re.compile(r"(?:windows\s*\d+|linux\s+[a-z0-9._-]+|(?:作为|as\s+the?)\s*os\b)", re.IGNORECASE),
    re.compile(r"(?:driver|驱动).{0,16}\d+(?:\.\d+)+", re.IGNORECASE),
    re.compile(r"(?:release|debug|optimized|优化).{0,12}(?:build|构建)|(?:build|构建).{0,12}(?:release|debug|v?\d+)", re.IGNORECASE),
    re.compile(r"(?:cityflood|dambreak|as\s+(?:the\s+)?(?:scene|workload)|作为(?:场景|工作负载))", re.IGNORECASE),
    re.compile(r"(?:asset\s+version|资产版本).{0,16}v?\d+", re.IGNORECASE),
    re.compile(r"(?:resolution|分辨率).{0,20}\d+\s*[x×]\s*\d+", re.IGNORECASE),
    re.compile(r"(?:particle\s+count|粒子数).{0,20}\d+", re.IGNORECASE),
    re.compile(r"(?:timestep|substeps?|时间步|子步).{0,24}\d+(?:\.\d+)?", re.IGNORECASE),
    re.compile(r"(?:simulation\s+duration|run\s+duration|模拟时长|运行时长).{0,20}\d+", re.IGNORECASE),
    re.compile(r"(?:blocking\s+synchronization|同步阻塞|阻塞同步)", re.IGNORECASE),
    re.compile(r"(?:timing\s+boundary|timed\s+boundary|计时边界).{0,30}|(?:first|前)\s*\d+\s*(?:seconds?|秒).{0,18}(?:timing|计时)", re.IGNORECASE),
    re.compile(r"(?:renderer\s+(?:inclusion|included)|renderer\s*计入|计入\s*renderer)", re.IGNORECASE),
    re.compile(r"(?:zero|no|0|零).{0,12}(?:failures?|失败)|(?:failures?|失败(?:数)?).{0,12}(?:zero|none|0|零)", re.IGNORECASE),
)
TOOL_EXECUTION_ACTION = re.compile(
    r"\b(?:ran|executed|called|invoked)\b|"
    r"\b(?:did|has|had)\s+(?:run|execute(?:d)?|call(?:ed)?|invoke(?:d)?)\b|"
    r"\b(?:i|we|they)\s+run\b|\b(?:was|were|is|are|been)\s+run\b|"
    r"(?:(?:已|已经|曾|曾经)?(?:运行|执行|调用)了|"
    r"(?:已|已经|曾|曾经)(?:运行|执行|调用)|"
    r"(?:已|已经)被(?:运行|执行|调用)|被(?:运行|执行|调用)过)",
    re.IGNORECASE,
)
TOOL_NAME = re.compile(
    r"(?:analyze_physics_trace\.py|compare_reported_results\.py)", re.IGNORECASE
)
ACTION_NEGATION = re.compile(
    r"(?:\b(?:do|does|did|must|should|can)\s+not(?:\s+be)?|"
    r"\b(?:is|are|was|were|be|been)\s+not|\bcannot(?:\s+be)?|\bcan't(?:\s+be)?|"
    r"\bnever|(?:不得|不能|不可|不要|不应|未|没有)(?:被)?)\s*$",
    re.IGNORECASE,
)
POSITIVE_OUTCOME = re.compile(
    r"\bpass(?:es|ed)?\b|\bsuccess(?:ful|fully)?\b|(?<!未)通过|成功|有效",
    re.IGNORECASE,
)
NEGATIVE_OUTCOME = re.compile(
    r"\bfail(?:s|ed|ure)?\b|\binvalid\b|失败|未通过|无效",
    re.IGNORECASE,
)
INVALID_INPUT_CATEGORY = re.compile(
    r"\b(?:cli|command line|input|validation)\b|命令行|输入|校验|验证",
    re.IGNORECASE,
)
TRACE_THRESHOLD_CATEGORY = re.compile(r"\bthresholds?\b|阈值", re.IGNORECASE)
COMPARISON_RULE_CATEGORY = re.compile(
    r"\b(?:equality|tolerance|rule)\b|相等|等值|容差|规则", re.IGNORECASE
)
FAILURE_NEGATION = re.compile(
    r"\bnot\b(?!\s+only\b)|\b(?:no|never|without|cannot|unable\s+to)\b|"
    r"\bcan\s+not\b(?!\s+only\b)|\b[A-Za-z]+n['’]t\b|"
    r"不是|并非|没有|无法|不能",
    re.IGNORECASE,
)


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold()


def has_each(text: str, groups) -> bool:
    compact = normalized(text)
    return all(any(term.casefold() in compact for term in group) for group in groups)


def has_affirmative_category_failure(text: str, category: re.Pattern) -> bool:
    clauses = re.split(
        r"[,，]|\s+\b(?:and|but|yet)\b\s+|"
        r"\s*(?:并且|且|(?<!不)但是|(?<!不)但|而)\s*",
        text,
        flags=re.IGNORECASE,
    )
    for clause in clauses:
        if not category.search(clause):
            continue
        for failure in NEGATIVE_OUTCOME.finditer(clause):
            prefix = clause[max(0, failure.start() - 40):failure.start()]
            if not (
                FAILURE_NEGATION.search(prefix)
                or re.search(r"(?:未|不|不会|并不|不再)\s*$", prefix)
            ):
                return True
    return False


def local_clause(text: str, groups) -> bool:
    return any(
        has_each(part, groups)
        for part in re.split(r"[。.!?！？;；\r\n]+", text)
        if part.strip()
    )


def section_items(text: str):
    matches = list(re.finditer(r"^#{1,3}\s+(?P<title>[^\r\n]+)\n", text, re.MULTILINE))
    return [
        (
            normalized(match.group("title")),
            text[
                match.end():
                matches[index + 1].start() if index + 1 < len(matches) else len(text)
            ],
        )
        for index, match in enumerate(matches)
    ]


def sections(text: str) -> dict[str, str]:
    return dict(section_items(text))


def section_with(text: str, *terms: str) -> str:
    for title, body in section_items(text):
        if any(term.casefold() in title for term in terms):
            return body
    return ""


def specific_verdict_section(text: str) -> str:
    ranked = []
    for title, body in section_items(text):
        if "claim-support verdict" in title:
            rank = 0
        elif "verdict" in title or "判定" in title:
            rank = 1
        elif "结论" in title:
            rank = 2
        else:
            continue
        ranked.append((rank, body))
    if not ranked:
        return ""
    best = min(rank for rank, _ in ranked)
    return "\n".join(body for rank, body in ranked if rank == best)


def bounded_paragraph(text: str, groups) -> bool:
    return any(
        has_each(block, groups)
        for block in re.split(r"(?:\r?\n){2,}", text)
        if block.strip() and len(block) <= 2000
    )


def tool_local_span(text: str, tool: str, other_tool: str) -> str:
    for title, body in section_items(text):
        if tool.casefold() in title and other_tool.casefold() not in title:
            return body
    for _, body in section_items(text):
        if tool.casefold() not in normalized(body):
            continue
        blocks = []
        for paragraph in re.split(r"(?:\r?\n){2,}", body):
            if not paragraph.strip():
                continue
            blocks.extend(
                block
                for block in re.split(r"\r?\n(?=-\s)", paragraph)
                if block.strip()
            )
        target = next(
            (
                index
                for index, block in enumerate(blocks)
                if tool.casefold() in normalized(block)
                and other_tool.casefold() not in normalized(block)
            ),
            None,
        )
        if target is None:
            continue
        target_markers = (
            ("reported", "observed", "已报告标量", "观测标量", "容差")
            if tool == "compare_reported_results.py"
            else ("jsonl", "csv", "run_id", "单个 run")
        )
        other_markers = (
            ("reported", "observed", "已报告标量", "观测标量", "容差")
            if other_tool == "compare_reported_results.py"
            else ("jsonl", "csv", "run_id", "单个 run")
        )
        for index in range(target - 1, -1, -1):
            compact = normalized(blocks[index])
            if other_tool.casefold() in compact:
                break
            if any(marker.casefold() in compact for marker in target_markers):
                target = index
        end = next(
            (
                index
                for index in range(target + 1, len(blocks))
                if (
                    other_tool.casefold() in normalized(blocks[index])
                    and tool.casefold() not in normalized(blocks[index])
                )
                or any(
                    marker.casefold() in normalized(blocks[index])
                    for marker in other_markers
                )
            ),
            len(blocks),
        )
        return "\n\n".join(blocks[target:end])
    return ""


def local_record(text: str, groups) -> bool:
    return any(has_each(line, groups) for line in text.splitlines() if line.strip())


def semantic_clauses(text: str):
    clauses = []
    for sentence in re.split(r"[。!?！？;；\r\n]+|\.(?=\s|$)", text):
        clauses.extend(
            part.strip()
            for part in re.split(
                r"\s*,?\s*\b(?:but|yet|so|however|nevertheless|then)\b\s*,?\s*|"
                r"[，,]?\s*(?:但|但是|却|然而|所以|因此|随后|再)\s*[，,]?",
                sentence,
                flags=re.IGNORECASE,
            )
            if part.strip()
        )
    return clauses


def action_is_negated(clause: str, action_start: int) -> bool:
    return bool(ACTION_NEGATION.search(clause[max(0, action_start - 40):action_start]))


def has_shared_governing_claim_denial(text: str) -> bool:
    claim = PUBLISHABLE_CLAIM.search(text)
    denial = CLAIM_DENIAL.search(text)
    return bool(
        claim
        and denial
        and denial.start() < claim.start()
        and SHARED_CLAIM_DENIAL_BRIDGE.search(text[denial.end():claim.start()])
    )


def has_unclosed_quote(text: str) -> bool:
    single_open = len(re.findall(r"(?<!\w)'(?=[\w\u4e00-\u9fff])", text))
    single_close = len(re.findall(r"(?<=[\w\u4e00-\u9fff])'(?!\w)", text))
    return (
        text.count("“") > text.count("”")
        or text.count("‘") > text.count("’")
        or text.count('"') % 2 == 1
        or single_open > single_close
    )


def has_referent_governing_subject(text: str, denial_start: int) -> bool:
    local_prefix = re.split(
        r"[。.!?！？;；,，]|\b(?:and|but|while|although)\b|(?:并且|但|而)",
        text[:denial_start],
        flags=re.IGNORECASE,
    )[-1]
    return bool(CONTROLLED_CLAIM_REFERENT.search(local_prefix))


def is_bounded_evidence_subject_modifier(text: str) -> bool:
    modifier = text.strip()
    if not modifier:
        return True
    if re.match(rf"^{EN_RELATION_HEAD}\b", modifier, re.IGNORECASE):
        return False
    word = r"[A-Za-z][\w'’.-]*"
    determiner = r"(?:a|an|the|this|that|these|those)"
    chinese_modifier = r"[\u4e00-\u9fff]{1,6}"
    return bool(
        re.fullmatch(rf"{word}(?:\s+{word})?", modifier)
        or re.fullmatch(chinese_modifier, modifier)
        or re.fullmatch(
            rf"{determiner}(?:\s+(?:{word}|{chinese_modifier})){{0,2}}",
            modifier,
            re.IGNORECASE,
        )
    )


def is_postnominal_evidence_relation(text: str) -> bool:
    relation = text.strip()
    if re.fullmatch(
        rf"{EN_RELATION_HEAD}\s+(?:[A-Za-z][\w'’.-]*\s*){{1,6}}",
        relation,
        re.IGNORECASE,
    ):
        return True
    return bool(
        re.fullmatch(
            r"(?:(?:中|内|里)(?:的[\u4e00-\u9fff]{1,8})?|"
            r"所[\u4e00-\u9fff]{1,8}|"
            r"[\u4e00-\u9fff]{1,8}的[\u4e00-\u9fff]{1,8})",
            relation,
        )
    )


def has_bounded_subject_predicate_evidence_clause(text: str) -> bool:
    if re.search(
        r"[:：,，\"“”‘’]|\b(?:while|although)\b|(?:然而|并且|但是|但|而|且)",
        text,
        re.IGNORECASE,
    ):
        return False
    evidence_subject = re.search(
        rf"(?:\b{EN_EVIDENCE_NOUN}\b|{ZH_EVIDENCE_NOUN})",
        text,
        re.IGNORECASE,
    )
    if evidence_subject and is_bounded_evidence_subject_modifier(
        text[:evidence_subject.start()]
    ):
        predicate = text[evidence_subject.end():].strip()
        if (
            re.search(r"[A-Za-z\u4e00-\u9fff]", predicate)
            and not is_postnominal_evidence_relation(predicate)
        ):
            return True
    subject = re.match(
        rf"^\s*(?:(?:(?:the|this|that|these|those|a|an)\s+)?"
        rf"{EN_EVIDENCE_AGENT_SUBJECT}\b|{ZH_AGENT_SUBJECT})",
        text,
        re.IGNORECASE,
    )
    evidence = re.search(
        rf"(?:(?:(?:the|this|that|these|those|current|available|existing)\s+)?"
        rf"{EN_EVIDENCE_NOUN}\b|{ZH_EVIDENCE_DETERMINER}{ZH_EVIDENCE_NOUN})\s*$",
        text,
        re.IGNORECASE,
    )
    if not subject or not evidence or subject.end() >= evidence.start():
        return False
    predicate = text[subject.end():evidence.start()].strip()
    return bool(re.search(r"[A-Za-z\u4e00-\u9fff]", predicate))


def is_bounded_zh_possessive_evidence_tail(text: str) -> bool:
    match = re.fullmatch(
        rf"(?P<owner>{ZH_AGENT_SUBJECT})的"
        rf"(?P<modifier>[\u4e00-\u9fff]{{0,8}})"
        rf"(?P<evidence>{ZH_EVIDENCE_NOUN})",
        text,
    )
    if not match:
        return False
    modifier = match.group("modifier")
    if re.search(r"(?:然而|并且|但是|但|而|且)", modifier):
        return False
    return not has_bounded_subject_predicate_evidence_clause(
        modifier + match.group("evidence")
    )


def strip_leading_complement_adjunct(
    complement: str, marker_kind: str
) -> str:
    candidate_text = re.sub(r"^\s*[,，]\s*", "", complement, count=1)
    boundary = re.search(r"[,，]", candidate_text)
    if boundary and boundary.start() <= 120:
        candidate = candidate_text[:boundary.start()].strip()
        has_evidence_noun = bool(
            re.search(rf"\b{EN_EVIDENCE_NOUN}\b", candidate, re.IGNORECASE)
            or re.search(ZH_EVIDENCE_NOUN, candidate)
        )
        zh_possessive_evidence_tail = is_bounded_zh_possessive_evidence_tail(
            candidate
        )
        independent_evidence_clause = (
            not zh_possessive_evidence_tail
            and has_bounded_subject_predicate_evidence_clause(candidate)
        )
        bounded_adjunct = (
            has_evidence_noun
            and not independent_evidence_clause
            and not re.search(
                r"[:：\"“”‘’]|\b(?:while|although)\b|(?:然而|并且|但是|但|而|且)",
                candidate,
                re.IGNORECASE,
            )
        )
        if bounded_adjunct or candidate in ("总而言之", "简而言之"):
            return candidate_text[boundary.end():].lstrip()
    return re.sub(r"^\s*[,，]\s*", "", complement, count=1)


def has_local_claim_after_marker(
    text: str, marker_end: int, marker_kind: str
) -> bool:
    complement = text[marker_end:]
    complement = strip_leading_complement_adjunct(complement, marker_kind)
    complement = re.sub(
        r"^\s*[,，]?\s*(?:however|nevertheless|therefore|然而|因而|所以)\s*[,，]?\s*",
        "",
        complement,
        flags=re.IGNORECASE,
    )
    boundary = next(
        (
            match
            for match in re.finditer(
                r"(?P<en>\b(?:while|although)\b)|(?P<zh_contrast>然而)|"
                r"(?P<zh_er>而)|(?P<quote>[\"“”‘’])|"
                r"(?P<colon>[:：])|(?P<comma>[,，])",
                complement,
                flags=re.IGNORECASE,
            )
            if (
                (match.lastgroup != "zh_er"
                 or not is_protected_zh_er(complement, match.start()))
                and (
                    match.lastgroup != "comma"
                    or has_independent_subject_predicate(complement[match.end():])
                )
            )
        ),
        None,
    )
    if boundary:
        complement = complement[:boundary.start()]
    claim = PUBLISHABLE_CLAIM.search(complement)
    return bool(
        claim
        and CONTROLLED_CLAIM_REFERENT.search(complement[:claim.start()])
    )


def has_governed_claim_complement(text: str) -> bool:
    denial = GOVERNING_CLAIM_DENIAL.search(text)
    if not denial:
        return False
    marker = re.search(r"\b(?:that|whether)\b|[:：]", text[denial.end():])
    if not marker:
        return False
    marker_start = denial.end() + marker.start()
    marker_end = denial.end() + marker.end()
    marker_text = text[marker_start:marker_end].lower()
    marker_kind = "colon" if marker_text in (":", "：") else "clausal"
    if marker_kind == "colon" and has_referent_governing_subject(
        text, denial.start()
    ):
        return False
    return has_local_claim_after_marker(text, marker_end, marker_kind)


def has_explicit_shared_complement(text: str) -> bool:
    return has_governed_claim_complement(text)


def opens_explicit_governed_complement(text: str, continuation: str = "") -> bool:
    return bool(
        not PUBLISHABLE_CLAIM.search(text)
        and has_governed_claim_complement(f"{text}, {continuation}")
    )


def has_independent_subject_predicate(text: str) -> bool:
    claim = PUBLISHABLE_CLAIM.search(text)
    if not claim:
        return False
    before_claim = text[:claim.start()]
    return bool(
        EN_INDEPENDENT_CLAUSE.match(before_claim)
        or ZH_INDEPENDENT_CLAIM.match(before_claim)
        or re.search(
            r"(?:[A-Za-z][\w.-]*|[\u4e00-\u9fff]{1,12})\s*(?:是|为)",
            before_claim,
        )
    )


def denial_governs_conjunct(left: str, right: str) -> bool:
    return has_shared_governing_claim_denial(left) and (
        has_unclosed_quote(left)
        or has_explicit_shared_complement(left)
        or not has_independent_subject_predicate(right)
    )


def has_local_claim_denial(clause: str) -> bool:
    claim = PUBLISHABLE_CLAIM.search(clause)
    if not claim:
        return False
    before_claim = clause[:claim.start()]
    return bool(
        CLAIM_DENIAL.search(clause)
        or EN_LOCAL_CLAIM_DENIAL.match(before_claim)
        or ZH_LOCAL_CLAIM_DENIAL.match(before_claim)
    )


def is_protected_zh_er(text: str, offset: int) -> bool:
    return any(
        phrase.start() <= offset < phrase.end()
        for phrase in ZH_PROTECTED_ER_PHRASE.finditer(text)
    )


def is_independent_assertion_boundary(text: str, match: re.Match) -> bool:
    left = text[:match.start()]
    right = text[match.end():]
    if has_unclosed_quote(left):
        return False
    if match.lastgroup == "zh_er" and is_protected_zh_er(text, match.start()):
        return False
    if match.lastgroup == "colon":
        return (
            has_independent_subject_predicate(right)
            and not has_governed_claim_complement(text)
        )
    if has_governed_claim_complement(text):
        return False
    return (
        has_independent_subject_predicate(left)
        or has_independent_subject_predicate(right)
    )


def split_independent_assertion_boundaries(text: str):
    parts = []
    remainder = text
    while True:
        boundary = next(
            (
                match
                for match in re.finditer(
                    r"(?P<en_boundary>\s*,?\s*\b(?:while|although)\b\s*,?\s*)|"
                    r"(?P<zh_contrast>然而)|(?P<zh_er>而)|(?P<colon>[:：])",
                    remainder,
                    flags=re.IGNORECASE,
                )
                if is_independent_assertion_boundary(remainder, match)
            ),
            None,
        )
        if boundary is None:
            if remainder.strip():
                parts.append(remainder.strip())
            return parts
        left = remainder[:boundary.start()].strip()
        if left:
            parts.append(left)
        remainder = remainder[boundary.end():].strip()


def claim_scopes(text: str):
    scopes = []
    for line in text.splitlines():
        if line.lstrip().startswith("|"):
            continue
        sentences = re.split(r"[。!?！？;；]+|\.(?=\s|$)", line)
        for sentence in sentences:
            contrast_scopes = (
                part.strip()
                for part in re.split(
                    r"\s*,?\s*\b(?:but|so|however|nevertheless|then)\b\s*,?\s*|"
                    r"\s*,?\s*(?<!cannot )(?<!can't )(?<!can not )"
                    r"(?<!must not )(?<!should not )\byet\b\s*,?\s*|"
                    r"[，,]?\s*(?:但|但是|却|所以|因此|随后)\s*[，,]?",
                    sentence,
                    flags=re.IGNORECASE,
                )
                if part.strip()
            )
            for contrast_scope in contrast_scopes:
                for scope in split_independent_assertion_boundaries(contrast_scope):
                    remainder = scope
                    while True:
                        conjunction = next(
                            (
                                match
                                for match in re.finditer(
                                    r"(?P<conjunction>\s+\band\b\s+|\s*(?:并且|以及|且)\s*)|"
                                    r"(?P<comma>[,，]\s*)",
                                    remainder,
                                    flags=re.IGNORECASE,
                                )
                                if PUBLISHABLE_CLAIM.search(remainder[match.end():])
                                and (
                                    match.lastgroup != "comma"
                                    or has_independent_subject_predicate(
                                        remainder[match.end():]
                                    )
                                )
                                and not (
                                    match.lastgroup == "comma"
                                    and opens_explicit_governed_complement(
                                        remainder[:match.start()],
                                        remainder[match.end():],
                                    )
                                )
                                and not denial_governs_conjunct(
                                    remainder[:match.start()], remainder[match.end():]
                                )
                            ),
                            None,
                        )
                        if conjunction is None:
                            scopes.append(remainder.strip())
                            break
                        left = remainder[:conjunction.start()].strip()
                        if left:
                            scopes.append(left)
                        remainder = remainder[conjunction.end():].strip()
    return scopes


def has_affirmative_publishable_claim(text: str) -> bool:
    for line in text.splitlines():
        if not (line.lstrip().startswith("|") and line.rstrip().endswith("|")):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if (
            len(cells) >= 2
            and PUBLISHABLE_CLAIM.search(cells[0])
            and not VERDICT_DENIAL.search(cells[1])
        ):
            return True
    for clause in claim_scopes(text):
        if PUBLISHABLE_CLAIM.search(clause) and not has_local_claim_denial(clause):
            return True
    return False


def has_unsafe_prescription(text: str) -> bool:
    for clause in semantic_clauses(text):
        for action in PRESCRIPTION_ACTION.finditer(clause):
            window = clause[
                max(0, action.start() - 120):min(len(clause), action.end() + 160)
            ]
            if (
                any(pattern.search(window) for pattern in PRESCRIPTION_TARGETS)
                and not action_is_negated(clause, action.start())
            ):
                return True
    return False


def has_false_tool_execution(text: str) -> bool:
    for clause in semantic_clauses(text):
        tools = list(TOOL_NAME.finditer(clause))
        if not tools:
            continue
        for action in TOOL_EXECUTION_ACTION.finditer(clause):
            if action_is_negated(clause, action.start()):
                continue
            if any(
                abs(action.start() - tool.start()) <= 100
                for tool in tools
            ):
                return True
    return False


def exit_mapping_is_valid(section: str, tool: str) -> bool:
    if tool == "trace":
        outcomes = {
            "0": (
                (
                    "all declared maximum thresholds",
                    "所有声明的最大值阈值",
                    "所有声明的最大阈值",
                ),
                ("pass", "通过"),
            ),
            "1": (
                ("at least one", "至少一个"),
                ("threshold", "阈值"),
                ("fail", "失败", "未通过"),
            ),
            "2": (
                ("cli", "command line", "input", "validation", "命令行", "输入", "校验", "验证"),
                ("fail", "failure", "invalid", "失败", "无效"),
            ),
        }
    elif tool == "comparison":
        outcomes = {
            "0": (
                ("equality", "tolerance", "相等", "等值", "容差"),
                ("rule", "规则"),
                ("pass", "通过"),
            ),
            "1": (
                ("rule", "规则"),
                ("fail", "失败", "未通过"),
            ),
            "2": (
                ("cli", "command line", "input", "validation", "命令行", "输入", "校验", "验证"),
                ("fail", "failure", "invalid", "失败", "无效"),
            ),
        }
    else:
        raise ValueError(tool)

    foreign_outcome = (
        re.compile(r"\b(?:equality|tolerance|rule)\b|相等|等值|容差|规则", re.IGNORECASE)
        if tool == "trace"
        else re.compile(r"\bthresholds?\b|阈值", re.IGNORECASE)
    )
    scientific_category = (
        TRACE_THRESHOLD_CATEGORY if tool == "trace" else COMPARISON_RULE_CATEGORY
    )

    sentences = [
        sentence.strip()
        for sentence in re.split(r"[。!?！？\r\n]+|\.(?=\s|$)", section)
        if re.search(r"\bexit\b|退出码", sentence, re.IGNORECASE)
    ]
    found_complete_mapping = False
    for sentence in sentences:
        markers = list(
            re.finditer(
                r"(?:\bexit\s*|退出码\s*)(?:\*\*)?(?P<code>[012])(?:\*\*)?",
                sentence,
                re.IGNORECASE,
            )
        )
        if len(markers) != 3 or {match.group("code") for match in markers} != {"0", "1", "2"}:
            markers = list(re.finditer(r"\*\*(?P<code>[012])\*\*", sentence))
        if len(markers) != 3 or {match.group("code") for match in markers} != {"0", "1", "2"}:
            continue
        found_complete_mapping = True
        segments = {}
        for index, marker in enumerate(markers):
            end = markers[index + 1].start() if index + 1 < len(markers) else len(sentence)
            segments[marker.group("code")] = sentence[marker.start():end]
        expected = (
            all(has_each(segments[code], groups) for code, groups in outcomes.items())
            and has_affirmative_category_failure(
                segments["1"], scientific_category
            )
            and has_affirmative_category_failure(
                segments["2"], INVALID_INPUT_CATEGORY
            )
        )
        exclusive = (
            not NEGATIVE_OUTCOME.search(segments["0"])
            and not POSITIVE_OUTCOME.search(segments["1"])
            and not POSITIVE_OUTCOME.search(segments["2"])
            and not has_affirmative_category_failure(
                segments["1"], INVALID_INPUT_CATEGORY
            )
            and not has_affirmative_category_failure(
                segments["2"], scientific_category
            )
            and not any(foreign_outcome.search(segment) for segment in segments.values())
        )
        if not (expected and exclusive):
            return False
    return found_complete_mapping


def swap_exit_zero_one_in_section(text: str, heading: str) -> str:
    pattern = (
        r"(^##\s+[^\r\n]*"
        + re.escape(heading)
        + r"[^\r\n]*\n)(?P<body>.*?)(?=^##\s|\Z)"
    )

    def swap(match):
        body = re.sub(r"Exit 0", "Exit X", match.group("body"), flags=re.IGNORECASE)
        body = re.sub(r"Exit 1", "Exit 0", body, flags=re.IGNORECASE)
        body = re.sub(r"Exit X", "Exit 1", body, flags=re.IGNORECASE)
        body = body.replace("退出码 0", "退出码 X")
        body = body.replace("退出码 1", "退出码 0")
        body = body.replace("退出码 X", "退出码 1")
        body = body.replace("**0**", "**X**")
        body = body.replace("**1**", "**0**")
        body = body.replace("**X**", "**1**")
        return match.group(1) + body

    return re.sub(pattern, swap, text, count=1, flags=re.MULTILINE | re.DOTALL)


def evaluation_provenance_issues(record: dict) -> set[str]:
    issues = set()
    attempts = record.get("attempt_history") if isinstance(record, dict) else None
    expected_attempts = (
        (ATTEMPT1_FORBIDDEN_INPUTS, "attempt-1-isolation"),
        (ATTEMPT2_FORBIDDEN_INPUTS, "attempt-2-isolation"),
    )
    if not isinstance(attempts, list) or len(attempts) != len(expected_attempts):
        issues.update(label for _, label in expected_attempts)
    else:
        for attempt, (forbidden, label) in zip(attempts, expected_attempts):
            isolation = attempt.get("isolation") if isinstance(attempt, dict) else None
            if not isinstance(isolation, dict) or isolation != {
                "evaluator": EVALUATOR,
                "allowed_inputs": ALLOWED_INPUTS,
                "forbidden_inputs": forbidden,
                "tool_execution": ATTEMPT_TOOL_EXECUTION,
            }:
                issues.add(label)

    tool_facts = record.get("tool_interface_facts") if isinstance(record, dict) else None
    if (
        not isinstance(tool_facts, dict)
        or tool_facts.get("execution_status") != TOP_LEVEL_EXECUTION_STATUS
    ):
        issues.add("execution-status")
    return issues


def response_issues(text: str) -> set[str]:
    issues = set()
    if has_unsafe_prescription(text):
        issues.add("unsafe-prescription")
    if has_affirmative_publishable_claim(text):
        issues.add("contradictory-verdict")
    if has_false_tool_execution(text):
        issues.add("false-tool-execution")
    ledger = section_with(text, "evidence record", "evidence table", "证据记录", "证据表")
    if not (
        ledger
        and local_record(
            ledger,
            (("measured", "测量事实", "测得事实", "已测事实", "实测"), ("143",)),
        )
        and local_record(
            ledger,
            (("measured", "测量事实", "测得事实", "已测事实", "实测"), ("91",)),
        )
        and local_record(ledger, (("derived", "派生算术", "算术"), ("1.571", "143/91")))
        and local_record(
            ledger,
            (
                ("inference", "hypothesis", "推断", "假设"),
                (
                    "explor",
                    "待检验",
                    "not established",
                    "unsupported",
                    "未证实",
                    "不受支持",
                ),
            ),
        )
        and local_record(
            ledger,
            (("unknown", "blocker", "未知", "阻断", "阻塞"), ("hardware", "硬件")),
        )
        and local_record(
            ledger,
            (
                ("unknown", "blocker", "未知", "阻断", "阻塞"),
                ("quality", "质量"),
                ("metric", "threshold", "指标", "阈值"),
            ),
        )
    ):
        issues.add("evidence-ledger")

    descriptive = section_with(text, "descriptive", "描述性", "描述统计") or text
    if not bounded_paragraph(
        descriptive,
        (
            ("n=1", "n = 1", "single observation", "单次观测"),
            ("mean is", "descriptive mean", "均值为", "描述性均值"),
            (
                "sample sd",
                "sample standard deviation",
                "样本标准差",
            ),
            (
                "unavailable",
                "cannot estimate",
                "不可用",
                "不可得",
                "无法",
            ),
            (
                "confidence interval",
                "mean interval",
                "均值区间",
                "置信区间",
            ),
        ),
    ):
        issues.add("n1-descriptive-mean")

    uncertainty = section_with(text, "uncertainty", "不确定") or text
    unit_record = local_record(
        ledger,
        (
            ("independent run", "独立重复", "独立运行"),
            ("frame", "tick", "帧", "时刻"),
            ("block", "分块", "区组", "配对"),
            ("not", "不得", "不是", "不能"),
        ),
    )
    within_run_limit = bounded_paragraph(
        uncertainty,
        (
            ("independent run", "独立重复", "独立运行"),
            ("frame", "tick", "帧", "时刻"),
            ("depend", "相关", "依赖"),
            ("not", "不得", "不是", "不能"),
        ),
    )
    aggregation_region = uncertainty + "\n" + section_with(text, "frontier", "pareto", "前沿")
    aggregation_scope = has_each(
        aggregation_region,
        (
            ("aggregation", "estimator", "汇总", "聚合", "估计量"),
            ("uncertainty", "interval", "不确定", "区间"),
        ),
    )
    if not ((unit_record or within_run_limit) and aggregation_scope):
        issues.add("inferential-unit")

    trace = tool_local_span(
        text,
        "analyze_physics_trace.py",
        "compare_reported_results.py",
    )
    if not (
        trace
        and has_each(
            trace,
            (("jsonl",), ("csv",), ("one", "single", "单个", "一个"), ("run_id",)),
        )
        and has_each(
            trace,
            (
                ("count",),
                ("mean", "均值"),
                ("nearest-rank", "nearest rank", "最近秩"),
                ("p50",),
                ("p95",),
                ("p99",),
                ("max", "最大"),
            ),
        )
        and has_each(
            trace,
            (
                (
                    "declared threshold",
                    "maximum threshold",
                    "max-threshold",
                    "声明的阈值",
                    "外部预先声明",
                ),
                ("max > threshold", "maximum", "最大值"),
            ),
        )
        and local_clause(
            trace,
            (
                ("does not", "no ", "不检测", "不能检测", "不提供", "不会"),
                ("warm-up",),
                ("between-run", "运行间"),
                ("confidence interval", "置信区间"),
            ),
        )
        and exit_mapping_is_valid(trace, "trace")
    ):
        issues.add("trace-tool-contract")

    comparison = tool_local_span(
        text,
        "compare_reported_results.py",
        "analyze_physics_trace.py",
    )
    if not (
        comparison
        and has_each(
            comparison,
            (
                ("reported",),
                ("observed",),
                ("scalar", "标量"),
                ("tolerance", "容差"),
            ),
        )
        and has_each(
            comparison,
            (
                ("mean", "均值"),
                ("min", "最小"),
                ("max", "最大"),
                ("sample standard deviation", "sample sd", "样本标准差"),
                ("null", "none", "n=1", "n = 1"),
            ),
        )
        and has_each(
            comparison,
            (
                ("no metadata", "没有元数据", "不接收元数据", "不接受元数据"),
                ("no quality", "没有质量指标", "不接收质量", "质量指标"),
                (
                    "no causal",
                    "no hypothesis",
                    "不做因果",
                    "不做假设检验",
                    "不进行因果",
                    "不进行假设检验",
                ),
            ),
        )
        and exit_mapping_is_valid(comparison, "comparison")
    ):
        issues.add("comparison-tool-contract")

    sensitivity = section_with(text, "sensitivity", "敏感") or text
    sensitivity_strict = has_each(
        sensitivity,
        (
            ("range", "范围"),
            ("declared", "预先", "声明"),
            ("explor", "探索"),
            (
                "not confirm",
                "不能确认",
                "不等于确认",
                "不能把",
                "不能证明",
                "未测试范围",
                "普适",
                "外推",
            ),
        ),
    )
    sensitivity_cautious = has_each(
        sensitivity,
        (
            ("assumption", "假设"),
            ("vary", "change", "改变", "固定"),
            ("flip", "翻转"),
            ("cannot", "不能"),
        ),
    )
    if not (sensitivity_strict or sensitivity_cautious):
        issues.add("sensitivity-scope")
    ablation = section_with(text, "ablation", "消融") or text
    ablation_strict = has_each(
        ablation,
        (
            ("one", "single", "单一", "逐项", "只改变一个"),
            ("hold", "locked", "固定", "保持", "锁定"),
            ("interaction", "交互"),
            ("bundle", "组合", "多项", "因素组合"),
        ),
    )
    ablation_cautious = has_each(
        ablation,
        (
            ("逐项", "one at a time"),
            ("保持", "hold"),
            ("交互", "interaction"),
            ("不能", "cannot"),
            ("改进", "mechanism"),
        ),
    )
    if not (ablation_strict or ablation_cautious):
        issues.add("ablation-scope")
    frontier = section_with(text, "frontier", "pareto", "前沿") or text
    frontier_strict = has_each(
        frontier,
        (
            (
                "matched budget",
                "equal budget",
                "同等预算",
                "相同计算预算",
                "相同预算",
                "匹配预算",
                "匹配的预算",
            ),
            ("common", "共同"),
            ("direction", "方向"),
            ("metric", "指标"),
            ("non-dominated", "non dominated", "非支配"),
            ("evaluated", "已评估"),
            ("not global", "非全局", "不能证明全局", "不等于全局"),
        ),
    )
    frontier_cautious = has_each(
        frontier,
        (
            ("common", "共同"),
            ("quality", "质量"),
            ("budget", "预算"),
            ("cannot", "无法", "不能"),
            ("143",),
        ),
    )
    if not (frontier_strict or frontier_cautious):
        issues.add("frontier-scope")
    failures = section_with(text, "failure", "失败") or text
    failure_strict = has_each(
        failures,
        (
            ("retain", "保留"),
            ("failed", "失败"),
            ("capped", "timeout", "达到上限", "超时"),
            ("budget", "cap", "预算", "上限"),
            ("reason", "原因"),
        ),
    )
    failure_cautious = has_each(
        failures,
        (
            ("成功", "success"),
            ("失败", "failed"),
            ("超时", "timeout"),
            ("日志", "log"),
            ("排除", "exclude"),
        ),
    )
    if not (failure_strict or failure_cautious):
        issues.add("failure-retention")

    verdict = specific_verdict_section(text) or text
    if not (
        has_each(
            verdict,
            (("143",), ("91",), ("1.571", "143/91"), ("descriptive", "算术", "描述")),
        )
        and has_each(
            verdict,
            (("winner", "总体更好"), ("not", "cannot", "不支持", "不能"), ("publish", "发布")),
        )
        and has_each(
            verdict,
            (
                (
                    "hardware",
                    "scene",
                    "workload",
                    "fidelity",
                    "environment",
                    "硬件",
                    "场景",
                    "工作负载",
                    "保真度",
                    "环境",
                ),
                ("quality", "质量"),
                ("unknown", "missing", "未知", "缺失", "缺少", "阻断"),
            ),
        )
    ):
        issues.add("claim-local-verdict")
    return issues


def guidance_issues(skill: str, reference: str) -> set[str]:
    issues = set()
    links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", skill)
    if links != ["references/evidence-analysis.md"]:
        issues.add("single-direct-reference")
    evidence = section_with(reference, "evidence record")
    if not has_each(
        evidence,
        tuple(
            (term,)
            for term in (
            "measured fact",
            "derived arithmetic",
            "inference",
            "unknown/blocker",
            )
        ),
    ):
        issues.add("evidence-ledger-guidance")
    if not has_each(
        evidence,
        tuple(
            (term,)
            for term in (
            "independent run",
            "frames/ticks",
            "blocked runs",
            "aggregation",
            )
        ),
    ):
        issues.add("independent-unit-guidance")
    trace = section_with(reference, "analyze_physics_trace.py")
    comparison = section_with(reference, "compare_reported_results.py")
    if not (
        trace
        and comparison
        and exit_mapping_is_valid(trace, "trace")
        and exit_mapping_is_valid(comparison, "comparison")
    ):
        issues.add("tool-guidance")
    skill_tool_contract = section_with(skill, "tool-output requirement")
    skill_trace = tool_local_span(
        skill,
        "analyze_physics_trace.py",
        "compare_reported_results.py",
    )
    skill_comparison = tool_local_span(
        skill,
        "compare_reported_results.py",
        "analyze_physics_trace.py",
    )
    if not (
        skill_tool_contract
        and has_each(
            skill_tool_contract,
            (("input",), ("capabilit",), ("limitation",)),
        )
        and exit_mapping_is_valid(skill_trace, "trace")
        and exit_mapping_is_valid(skill_comparison, "comparison")
    ):
        issues.add("entrypoint-tool-output-contract")
    modes = (
        section_with(reference, "sensitivity"),
        section_with(reference, "pareto"),
        section_with(reference, "failure cases"),
        section_with(reference, "claim-support verdict"),
    )
    if not (
        all(modes)
        and has_each(modes[0], (("ablation",),))
        and has_each(modes[1], (("non-dominated",),))
        and has_each(modes[2], (("failed",), ("capped",)))
    ):
        issues.add("analysis-modes")
    verdict = modes[-1]
    if not has_each(verdict, (("designing-simulation-experiments",),)):
        issues.add("redesign-routing")
    source_table = section_with(reference, "source boundaries", "source anchors")
    if not (
        source_table
        and has_each(
            source_table,
            (
                ("nist",),
                ("hurlbert",),
                ("mlperf",),
                ("spec cpu",),
                ("deb", "nsga-ii"),
                ("supported",),
                ("boundary", "limit"),
            ),
        )
    ):
        issues.add("source-boundaries")
    return issues


class AnalyzingSimulationEvidenceSkillTests(unittest.TestCase):
    def require_text(self, path: Path) -> str:
        self.assertTrue(
            path.is_file(),
            f"missing required Task 27 file: {path.relative_to(ROOT)}",
        )
        return path.read_text(encoding="utf-8")

    def test_required_initial_skill_artifacts_exist(self):
        for path in (SKILL, REFERENCE, UI):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertTrue(path.is_file(), path)

    def test_frozen_inputs_and_attempt_history_have_exact_controller_bytes(self):
        for path, length, digest in (
            (SCENARIO, SCENARIO_BYTES, SCENARIO_SHA256),
            (BASELINE, BASELINE_BYTES, BASELINE_SHA256),
            (ATTEMPT1, ATTEMPT1_BYTES, ATTEMPT1_SHA256),
            (ATTEMPT2, ATTEMPT2_BYTES, ATTEMPT2_SHA256),
            (ENABLED, ATTEMPT2_BYTES, ATTEMPT2_SHA256),
        ):
            with self.subTest(path=path.name):
                raw = path.read_bytes()
                self.assertEqual(len(raw), length)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
                self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
                self.assertNotIn(b"\r", raw)
                self.assertTrue(raw.endswith(b"\n"))
                self.assertFalse(raw.endswith(b"\n\n"))
        self.assertEqual(ENABLED.read_bytes(), ATTEMPT2.read_bytes())

    def test_baseline_strengths_are_credited_and_only_observed_gaps_fail(self):
        issues = response_issues(self.require_text(BASELINE))
        self.assertEqual(
            issues,
            {
                "comparison-tool-contract",
                "evidence-ledger",
                "inferential-unit",
                "n1-descriptive-mean",
                "trace-tool-contract",
            },
        )
        for credited in (
            "sensitivity-scope",
            "ablation-scope",
            "frontier-scope",
            "failure-retention",
            "claim-local-verdict",
        ):
            self.assertNotIn(credited, issues)

    def test_attempt1_fails_exactly_the_two_real_exit_mapping_gaps(self):
        attempt = self.require_text(ATTEMPT1)
        self.assertEqual(
            response_issues(attempt),
            {"trace-tool-contract", "comparison-tool-contract"},
        )

    def test_attempt2_semantic_forms_pass_and_are_promoted_verbatim(self):
        attempt = self.require_text(ATTEMPT2)
        self.assertEqual(response_issues(attempt), set())
        self.assertEqual(ENABLED.read_bytes(), ATTEMPT2.read_bytes())

        wrong_maps = swap_exit_zero_one_in_section(attempt, "仓库脚本")
        self.assertEqual(
            response_issues(wrong_maps)
            & {"trace-tool-contract", "comparison-tool-contract"},
            {"trace-tool-contract", "comparison-tool-contract"},
        )

        missing_trace_map = attempt.replace(
            "**0** 表示所有声明的最大阈值通过；", "", 1
        )
        self.assertIn("trace-tool-contract", response_issues(missing_trace_map))
        missing_comparison_map = attempt.replace(
            "**0** 表示等值/容差规则通过；", "", 1
        )
        self.assertIn(
            "comparison-tool-contract", response_issues(missing_comparison_map)
        )

        relocated_map = missing_trace_map + (
            "\n\n## 无关全局词汇\n\n**0** 表示所有声明的最大阈值通过。\n"
        )
        self.assertIn("trace-tool-contract", response_issues(relocated_map))

        missing_local_unknown = attempt.replace(
            "| 未知/阻塞项 | 缺少共同 quality/error 指标及接受阈值；这阻塞质量保持、可接受性、Pareto 比较和“总体更好”结论。 |",
            "| 备注 | 共同 quality/error 指标及接受阈值。 |",
            1,
        )
        self.assertIn("evidence-ledger", response_issues(missing_local_unknown))

        missing_n1_limit = attempt.replace("样本标准差不可得", "离散性未知", 1)
        self.assertIn("n1-descriptive-mean", response_issues(missing_n1_limit))

        missing_unit_limit = attempt.replace(
            "而不是单个启动画面或其中的帧", "并记录启动画面及其中的帧", 1
        ).replace("相互依赖，不能当作独立运行重复", "组成序列", 1)
        self.assertIn("inferential-unit", response_issues(missing_unit_limit))

    def test_attempt1_semantic_forms_pass_when_exit_maps_are_added_locally(self):
        attempt = self.require_text(ATTEMPT1)
        trace_map = (
            "退出码 0 表示所有声明的最大值阈值通过；退出码 1 表示至少一个阈值失败；"
            "退出码 2 表示命令行、输入或验证失败。"
        )
        comparison_map = (
            "退出码 0 表示相等或容差规则通过；退出码 1 表示该规则失败；"
            "退出码 2 表示命令行、输入或验证失败。"
        )
        corrected = attempt.replace(
            "因此不能用它把单次 trace 变成发布级比较。",
            "因此不能用它把单次 trace 变成发布级比较。" + trace_map,
            1,
        ).replace(
            "不证明科学结论或 winner claim。",
            "不证明科学结论或 winner claim。" + comparison_map,
            1,
        )
        self.assertEqual(response_issues(corrected), set())

        wrong_maps = swap_exit_zero_one_in_section(corrected, "脚本的恰当使用")
        self.assertEqual(
            response_issues(wrong_maps)
            & {"trace-tool-contract", "comparison-tool-contract"},
            {"trace-tool-contract", "comparison-tool-contract"},
        )

        descriptive_soup = corrected.replace(
            "样本标准差、运行间均值的常规置信区间",
            "离散性与运行间区间",
            1,
        ) + "\n\n## 词汇堆\n\n样本标准差不可用，置信区间不可用。\n"
        self.assertIn("n1-descriptive-mean", response_issues(descriptive_soup))

        verdict_soup = re.sub(
            r"(^## Claim-support verdict\s*$)(?P<body>.*)\Z",
            lambda match: match.group(1)
            + match.group("body").replace("质量", "验收"),
            corrected,
            count=1,
            flags=re.MULTILINE | re.DOTALL,
        ).replace(
            "当前证据只支持",
            "共同质量指标。当前证据只支持",
            1,
        )
        self.assertIn("claim-local-verdict", response_issues(verdict_soup))

        relocated_exit = corrected.replace(trace_map, "", 1)
        relocated_exit += "\n\n## 无关词汇\n\n" + trace_map + "\n"
        self.assertIn("trace-tool-contract", response_issues(relocated_exit))

    def test_oracle_rejects_bilingual_prescriptions_without_flagging_refusals(self):
        baseline = self.require_text(BASELINE)
        baseline_issues = response_issues(baseline)
        unsafe = (
            "Use an NVIDIA RTX 5090 for both methods.",
            "使用 RTX 4090 作为统一硬件。",
            "Use 12 seeds.",
            "使用 12 个种子。",
            "Set repetitions to 30.",
            "设定重复次数为 30。",
            "Use a 95% confidence level with bootstrap.",
            "设定置信水平为 95%，采用 bootstrap。",
            "Set warm-up to 10 seconds.",
            "设定 warm-up 为 10 秒。",
            "Set quality threshold to 0.01.",
            "设定质量阈值为 0.01。",
            "Set quality metric to RMSE.",
            "设定质量指标为 RMSE。",
        )
        for addition in unsafe:
            with self.subTest(unsafe=addition):
                issues = response_issues(baseline + "\n" + addition)
                self.assertEqual(issues - baseline_issues, {"unsafe-prescription"})

        safe = (
            "Do not use RTX 5090; hardware remains unknown.",
            "不得使用 RTX 4090；硬件保持未知。",
            "Do not use 12 seeds; seed count remains unknown.",
            "不得使用 12 个种子；种子数未提供。",
            "Do not set repetitions to 30; repetition count remains unknown.",
            "不得设定重复次数为 30；重复次数未提供。",
            "Do not use a 95% bootstrap confidence interval; confidence policy is missing.",
            "不得设定 95% bootstrap 置信区间；置信政策未知。",
            "Do not set warm-up to 10 seconds; warm-up remains unknown.",
            "不得设定 warm-up 为 10 秒；warm-up 时长未知。",
            "Do not set quality threshold to 0.01 or quality metric to RMSE; both are missing.",
            "不得设定质量阈值 0.01 或质量指标 RMSE；两者均未提供。",
        )
        for addition in safe:
            with self.subTest(safe=addition):
                self.assertEqual(
                    response_issues(baseline + "\n" + addition),
                    baseline_issues,
                )

    def test_action_local_polarity_rejects_claims_and_every_named_blocker_fill(self):
        canonical = self.require_text(ENABLED)
        self.assertEqual(response_issues(canonical), set())

        affirmative_claims = (
            "FastFluid is a publishable winner.",
            "A publishable winner is FastFluid.",
            "The 1.57x speedup is publishable.",
            "FastFluid 是可发布的赢家。",
            "可发布的赢家是 FastFluid。",
            "1.57× 加速可发布。",
            "The inputs are missing, but FastFluid is the publishable winner.",
            "输入缺失，但 FastFluid 总体更好且可发布。",
        )
        for addition in affirmative_claims:
            with self.subTest(affirmative_claim=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        denied_claims = (
            "FastFluid is not a publishable winner.",
            "A publishable 1.57x speedup is not supported.",
            "FastFluid 不是可发布的赢家。",
            "1.57× 可发布加速当前不受支持。",
        )
        for addition in denied_claims:
            with self.subTest(denied_claim=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        blocker_fills = (
            "Evidence is missing, so use generated.jsonl as the raw trace.",
            "Set frame-time p95 to 8 ms.",
            "Use 12 seeds and 30 repetitions.",
            "Hardware is unknown, so use RTX 4090.",
            "Use Windows 11 as the OS.",
            "Use driver 555.1.",
            "Use a Release build.",
            "Use CityFlood as the scene.",
            "Use asset version v2.",
            "Set resolution to 1920x1080.",
            "Set particle count to 1000000.",
            "Set timestep to 0.01 seconds and substeps to 4.",
            "Set simulation duration to 60 seconds.",
            "Set warm-up to 10 seconds.",
            "Use blocking synchronization.",
            "Use the first 30 seconds as the timing boundary.",
            "Set renderer inclusion to true.",
            "Assume zero failures.",
            "Use a 95% bootstrap confidence interval.",
            "Set quality metric to RMSE and quality threshold to 0.01.",
            "证据缺失，所以使用 generated.jsonl 作为原始 trace。",
            "设定 frame-time p95 为 8 ms。",
            "使用 12 个种子并重复 30 次。",
            "硬件未知，所以使用 RTX 4090。",
            "使用 Windows 11 作为 OS。",
            "使用 driver 555.1。",
            "采用 Release build。",
            "使用 CityFlood 作为场景。",
            "使用资产版本 v2。",
            "设定分辨率为 1920x1080。",
            "设定粒子数为 1000000。",
            "设定 timestep 为 0.01 秒且 substeps 为 4。",
            "设定模拟时长为 60 秒。",
            "设定 warm-up 为 10 秒。",
            "使用阻塞同步。",
            "使用前 30 秒作为计时边界。",
            "设定 renderer 计入。",
            "假定失败数为零。",
            "设定 95% bootstrap 置信区间。",
            "设定质量指标为 RMSE 且质量阈值为 0.01。",
            "RTX 4090 should be used as the hardware.",
            "CityFlood 应被用作场景。",
        )
        for addition in blocker_fills:
            with self.subTest(blocker_fill=addition):
                self.assertIn(
                    "unsafe-prescription", response_issues(canonical + "\n" + addition)
                )

        denied_fills = (
            "Hardware is unknown, so do not use RTX 4090.",
            "Do not use CityFlood as the scene; the scene remains unknown.",
            "硬件未知，所以不得使用 RTX 4090。",
            "不得使用 CityFlood 作为场景；场景保持未知。",
        )
        for addition in denied_fills:
            with self.subTest(denied_fill=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_claim_polarity_is_bound_to_each_sentence_and_connector_scope(self):
        canonical = self.require_text(ENABLED)
        affirmative_after_denial = (
            "FastFluid is not a winner. FastFluid is a publishable winner.",
            "FastFluid is not a winner; however, FastFluid is the publishable winner.",
            "Winner status remains unknown. Yet FastFluid is a publishable winner.",
            "FastFluid 不是赢家。FastFluid 是可发布的赢家。",
            "FastFluid 不是赢家，但 FastFluid 是可发布的赢家。",
            "赢家状态仍未知。因此 FastFluid 总体更好且可发布。",
        )
        for addition in affirmative_after_denial:
            with self.subTest(affirmative_after_denial=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        unknown_or_denied = (
            "Winner status remains unknown.",
            "It is unknown whether FastFluid is a winner.",
            "FastFluid is not a winner. The 1.57x speedup is unsupported.",
            "赢家状态仍未知。",
            "FastFluid 是否是赢家仍然未知。",
            "FastFluid 不是赢家。1.57× 加速当前不受支持。",
        )
        for addition in unknown_or_denied:
            with self.subTest(unknown_or_denied=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_claim_verdict_polarity_is_bound_to_table_cell_and_new_claim(self):
        canonical = self.require_text(ENABLED)
        positive_table_mutations = (
            canonical.replace(
                "| “FastFluid 比 ReferenceFluid 快 1.57×。” | 不支持 |",
                "| “FastFluid 比 ReferenceFluid 快 1.57×。” | 支持 |",
                1,
            ),
            canonical.replace(
                "| “FastFluid 是可发布的 winner。” | 不支持 |",
                "| “FastFluid 是可发布的 winner。” | 支持 |",
                1,
            ),
            canonical
            + "\n| Claim | Verdict | Evidence |\n"
            + "| FastFluid is a publishable winner. | Supported | The limits cannot establish generality. |\n",
            canonical
            + "\n| 主张 | 判定 | 证据 |\n"
            + "| FastFluid 是可发布的赢家。 | 支持 | 证据不能证明普适性。 |\n",
        )
        for mutated in positive_table_mutations:
            with self.subTest(positive_table=mutated[-180:]):
                self.assertIn("contradictory-verdict", response_issues(mutated))

        affirmative_after_conjunction = (
            "Winner status is unknown and FastFluid is a publishable winner.",
            "Winner status is not established, yet FastFluid is the publishable winner.",
            "赢家状态未知，并且 FastFluid 是可发布的赢家。",
            "FastFluid 不是赢家，但 FastFluid 总体更好且可发布。",
        )
        for addition in affirmative_after_conjunction:
            with self.subTest(affirmative_after_conjunction=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        negative_controls = (
            "Winner status remains unknown.",
            "| Claim | Verdict | Evidence |\n"
            "| FastFluid is a publishable winner. | Unsupported | Evidence is incomplete. |",
            "| 主张 | 判定 | 证据 |\n"
            "| FastFluid 是可发布的赢家。 | 不支持 | 证据不完整。 |",
        )
        for addition in negative_controls:
            with self.subTest(negative_control=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_dangerous_table_claim_requires_explicit_verdict_denial(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "| FastFluid is a publishable winner. | Confirmed | This cannot establish generality. |",
            "| FastFluid is overall better. | Verified | The evidence does not prove generality. |",
            "| FastFluid has a 1.57x speedup. | Inconclusive | The limits cannot support publication. |",
            "| FastFluid 是可发布的赢家。 | 已确认 | 证据不能证明普适性。 |",
        )
        for addition in unsafe:
            with self.subTest(unsafe_table_verdict=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "| FastFluid is a publishable winner. | Unsupported | Evidence is incomplete. |",
            "| FastFluid is overall better. | Rejected | Evidence is incomplete. |",
            "| FastFluid has a 1.57x speedup. | No | Evidence is incomplete. |",
            "| FastFluid 是可发布的赢家。 | 不支持 | 证据不完整。 |",
            "| FastFluid 总体更好。 | 拒绝 | 证据不完整。 |",
            "| FastFluid 有 1.57× 加速。 | 否 | 证据不完整。 |",
        )
        for addition in safe:
            with self.subTest(safe_table_verdict=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_generic_conjunction_starts_a_new_claim_scope(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "Winner status is unknown and the method is the publishable winner.",
            "Winner status is not established and this solver is overall better.",
            "赢家状态未知，并且该方法是可发布的赢家。",
            "赢家状态不明，且这个求解器总体更好。",
        )
        for addition in unsafe:
            with self.subTest(unsafe_generic_conjunction=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "Winner status remains unknown.",
            "Winner status is unknown and the method is not a publishable winner.",
            "赢家状态仍未知。",
            "赢家状态未知，并且该方法不是可发布的赢家。",
        )
        for addition in safe:
            with self.subTest(safe_generic_conjunction=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_publishable_claim_polarity_is_local_to_each_conjunct(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "Winner status is unknown and the team declares FastFluid the publishable winner.",
            "Winner status is unsupported, yet reviewers call FastFluid the overall better method.",
            "Not a winner, and the team declares FastFluid the publishable winner.",
            "赢家状态未知，并且团队宣布 FastFluid 是可发布的赢家。",
            "赢家状态不受支持，且评审把 FastFluid 称为总体更好的方法。",
            "不是赢家，并且团队宣布 FastFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(unsafe_predicate_conjunct=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "Winner status remains unknown.",
            "Winner status is unknown and the team does not declare FastFluid the publishable winner.",
            "The team declares that FastFluid is not the publishable winner.",
            "It is unknown whether FastFluid is a winner and overall better.",
            "赢家状态仍未知。",
            "赢家状态未知，并且团队没有宣布 FastFluid 是可发布的赢家。",
            "团队宣布 FastFluid 不是可发布的赢家。",
            "不能发布“FastFluid 是赢家，并且总体更好”的结论。",
        )
        for addition in safe:
            with self.subTest(safe_predicate_conjunct=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_shared_claim_denial_stops_at_quote_and_predicate_boundaries(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish FastFluid as the winner and the team declares FastFluid the publishable winner.",
            "We cannot publish FastFluid as the winner and the group labels FastFluid the overall better method.",
            "不能发布“FastFluid 是赢家”的结论，并且团队宣布 FastFluid 是可发布的赢家。",
            "不能发布“FastFluid 是赢家”的结论，且小组认定 FastFluid 为总体更好的方法。",
        )
        for addition in unsafe:
            with self.subTest(unsafe_denial_boundary=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "We cannot claim FastFluid is a winner and overall better.",
            "不能主张 FastFluid 是赢家且总体更好。",
            "We cannot publish “FastFluid is the winner and overall better” as a conclusion.",
            "不能发布“FastFluid 是赢家，并且总体更好”的结论。",
        )
        for addition in safe:
            with self.subTest(safe_shared_denial=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_shared_denial_handles_plural_predicates_complements_and_single_quotes(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish FastFluid as the winner and reviewers call FastFluid the publishable winner.",
            "We can't publish FastFluid as the winner and analysts label FastFluid the overall better method.",
            "不能发布 FastFluid 为赢家，并且评审称 FastFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(unsafe_plural_predicate=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "We cannot claim that FastFluid is the winner and ReferenceFluid is overall better.",
            "We cannot claim whether FastFluid is the winner and ReferenceFluid is overall better.",
            "We cannot publish 'FastFluid is the winner and the team declares FastFluid the publishable winner.",
            "不能主张：FastFluid 是赢家并且 ReferenceFluid 是总体更好的方法。",
            "不能发布 'FastFluid 是赢家并且团队宣布 FastFluid 是可发布的赢家。",
        )
        for addition in safe:
            with self.subTest(safe_shared_complement=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_shared_denial_stops_at_structural_claim_predicates(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish FastFluid as the winner and they call FastFluid the publishable winner.",
            "We cannot publish FastFluid as the winner and people call FastFluid the publishable winner.",
            "We cannot publish 'FastFluid is the winner' and they call FastFluid the publishable winner.",
            "We cannot publish FastFluid as the winner and the panel labels FastFluid the overall better method.",
            "We cannot publish FastFluid as the winner and researchers declare FastFluid the publishable winner.",
            "We cannot publish FastFluid as the winner and they assert FastFluid is overall better.",
        )
        for addition in unsafe:
            with self.subTest(unsafe_claim_predicate=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "We cannot claim that FastFluid is the winner and they call ReferenceFluid overall better.",
            "We cannot publish 'FastFluid is the winner and they call FastFluid the publishable winner.",
            "不能主张：FastFluid 是赢家并且团队称 ReferenceFluid 总体更好。",
            "不能发布 'FastFluid 是赢家并且团队宣布 FastFluid 是可发布的赢家。",
        )
        for addition in safe:
            with self.subTest(safe_shared_scope=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_shared_denial_uses_clause_structure_not_claim_verb_whitelists(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish “FastFluid is the winner” and they proclaim FastFluid the publishable winner.",
            "We cannot publish “FastFluid is the winner” and they deem FastFluid the publishable winner.",
            "We cannot publish “FastFluid is the winner” and they name FastFluid the publishable winner.",
            "We cannot publish “FastFluid is the winner” and staff proclaim FastFluid the publishable winner.",
            "We cannot publish 'FastFluid is the winner' and the review team proclaims FastFluid the publishable winner.",
            "We cannot publish “FastFluid is the winner” and the independent review panel deems this method overall better.",
        )
        for addition in unsafe:
            with self.subTest(unsafe_structural_clause=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "We cannot claim that FastFluid is the winner and they proclaim FastFluid overall better.",
            "We cannot claim whether FastFluid is the winner and staff deem this method overall better.",
            "We cannot claim: FastFluid is the winner and the review team names FastFluid overall better.",
            "We cannot publish “FastFluid is the winner and they proclaim FastFluid the publishable winner.",
            "We cannot publish 'FastFluid is the winner and staff deem this method overall better.",
        )
        for addition in safe:
            with self.subTest(safe_governed_scope=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_independent_claim_structure_covers_both_scenario_methods(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish FastFluid as the winner and they proclaim ReferenceFluid the publishable winner.",
            "We cannot publish “FastFluid is the winner” and staff deem ReferenceFluid overall better.",
            "We cannot publish 'FastFluid is the winner' and the review team names ReferenceFluid the publishable winner.",
        )
        for addition in unsafe:
            with self.subTest(reference_method_claim=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        controlled_generic_referents = (
            "We cannot publish FastFluid as the winner and they proclaim this method the publishable winner.",
            "We cannot publish FastFluid as the winner and staff deem the solver overall better.",
            "We cannot publish FastFluid as the winner and reviewers name that approach the publishable winner.",
        )
        for addition in controlled_generic_referents:
            with self.subTest(controlled_generic_referent=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_independent_claim_negation_is_bound_to_its_subject_and_action(self):
        canonical = self.require_text(ENABLED)
        locally_denied = (
            "We cannot publish FastFluid as the winner and they never proclaim FastFluid the publishable winner.",
            "No reviewer proclaims FastFluid the publishable winner.",
            "Nobody names ReferenceFluid the publishable winner.",
            "No one deems this method overall better.",
            "他们从不宣布 FastFluid 是可发布的赢家。",
            "没有评审宣布 ReferenceFluid 是可发布的赢家。",
            "无人称该方法总体更好。",
        )
        for addition in locally_denied:
            with self.subTest(locally_denied_claim=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        positive_and_mixed_scope = (
            "They proclaim FastFluid the publishable winner.",
            "A reviewer proclaims ReferenceFluid the publishable winner.",
            "Somebody names this method the publishable winner.",
            "No evidence is available, reviewers proclaim FastFluid the publishable winner.",
            "No reviewer rejected the baseline, but they proclaim ReferenceFluid the publishable winner.",
            "他们宣布 FastFluid 是可发布的赢家。",
            "评审宣布 ReferenceFluid 是可发布的赢家。",
            "有人称该方法总体更好。",
            "没有证据，评审宣布 FastFluid 是可发布的赢家。",
            "无人质疑基线，但评审宣布 ReferenceFluid 是可发布的赢家。",
        )
        for addition in positive_and_mixed_scope:
            with self.subTest(affirmative_or_unrelated_denial=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_claim_denial_complements_stop_at_independent_assertion_boundaries(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot claim that, according to the available evidence, ReferenceFluid is overall better.",
            "不能主张：根据现有证据，FastFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(governed_complement=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        unsafe = (
            "Reviewers proclaim FastFluid the publishable winner although the evidence is unavailable.",
            "No evidence exists while reviewers proclaim FastFluid the publishable winner.",
            "没有证据而评审宣布 ReferenceFluid 是可发布的赢家。",
            "证据未知 while reviewers proclaim FastFluid the publishable winner.",
        )
        for addition in unsafe:
            with self.subTest(independent_assertion=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        existing_controls = (
            ("We cannot claim that FastFluid is the winner.", set()),
            ("不能主张：ReferenceFluid 总体更好。", set()),
            (
                "Reviewers proclaim FastFluid the publishable winner.",
                {"contradictory-verdict"},
            ),
            (
                "评审宣布 ReferenceFluid 是可发布的赢家。",
                {"contradictory-verdict"},
            ),
            (
                "No evidence exists, but reviewers proclaim FastFluid the publishable winner.",
                {"contradictory-verdict"},
            ),
            ("然而不能主张 FastFluid 是赢家。", set()),
            ("不能主张：从而得出 FastFluid 是赢家。", set()),
        )
        for addition, expected in existing_controls:
            with self.subTest(boundary_control=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), expected)

    def test_claim_boundaries_respect_quotes_governing_actions_and_chinese_structure(self):
        canonical = self.require_text(ENABLED)
        safe = (
            'We cannot publish "FastFluid is the winner while ReferenceFluid is overall better" as a conclusion.',
            "We cannot publish “FastFluid is the winner although ReferenceFluid is overall better” as a conclusion.",
            "不能发布“FastFluid 是赢家而 ReferenceFluid 总体更好”的结论。",
            "不能主张：总而言之，FastFluid 是赢家。",
            "不能主张：简而言之，FastFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(governed_or_quoted_claim=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        unsafe = (
            "没有证据而评审称 ReferenceFluid 总体更好。",
            "Winner status is unknown: reviewers proclaim FastFluid the publishable winner.",
            "赢家状态未知：评审宣布 ReferenceFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(independent_claim=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_explicit_denial_complement_governs_only_its_internal_boundaries(self):
        canonical = self.require_text(ENABLED)
        governed = (
            "We cannot claim that FastFluid is the winner while ReferenceFluid is overall better.",
            "We cannot publish: FastFluid is the winner although ReferenceFluid is overall better.",
            "不能主张：FastFluid 是赢家而 ReferenceFluid 总体更好。",
            "不能主张：然而 FastFluid 是赢家。",
            "不能主张：因而得出 FastFluid 是赢家。",
        )
        for addition in governed:
            with self.subTest(governed_internal_boundary=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        independent_controls = (
            "Evidence is unavailable while reviewers proclaim FastFluid the publishable winner.",
            "证据未知而评审称 ReferenceFluid 总体更好。",
            "No evidence exists while 评审宣布 FastFluid 是可发布的赢家。",
            "证据未知，然而评审宣布 ReferenceFluid 是可发布的赢家。",
        )
        for addition in independent_controls:
            with self.subTest(independent_boundary=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_governing_complements_and_chinese_assertions_use_structure_not_verbs(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot conclude that, given the available evidence, FastFluid is the winner.",
            "We cannot responsibly claim that, according to the record, FastFluid is the winner.",
            "不能据此发布：FastFluid 是赢家。",
            "不能断言：根据现有证据，ReferenceFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(structurally_governed=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        unsafe = (
            "证据未知而评审报告 ReferenceFluid 总体更好。",
            "没有证据而评审主张 FastFluid 总体更好。",
            "证据未知：评审报告 ReferenceFluid 总体更好。",
            "Evidence is unavailable while 评审报告 ReferenceFluid 总体更好。",
        )
        for addition in unsafe:
            with self.subTest(structurally_independent=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_unlisted_predicate_slots_follow_the_same_claim_structure(self):
        canonical = self.require_text(ENABLED)
        unlisted_slots = (
            ("委员会", "归纳"),
            ("审查组", "记述"),
            ("研究团队", "写明"),
        )
        for subject, predicate in unlisted_slots:
            addition = f"证据未知而{subject}{predicate} ReferenceFluid 总体更好。"
            with self.subTest(subject=subject, unlisted_predicate=predicate):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

        governed_slots = (
            "We cannot tentatively infer that, given the record, FastFluid is the winner.",
            "不能审慎归纳：ReferenceFluid 是赢家。",
        )
        for addition in governed_slots:
            with self.subTest(unlisted_governing_action=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_non_claim_objects_and_operations_do_not_govern_later_claims(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "We cannot publish the trace: reviewers proclaim FastFluid the publishable winner.",
            "FastFluid cannot beat ReferenceFluid: reviewers proclaim FastFluid the publishable winner.",
            "The system cannot do that while reviewers proclaim ReferenceFluid the publishable winner.",
            "FastFluid不能运行：评审称 ReferenceFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(non_governing_structure=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_complement_markers_require_claim_discourse_and_a_local_claim_clause(self):
        canonical = self.require_text(ENABLED)
        governed = (
            "We cannot reach the conclusion that, from this record, FastFluid is the winner.",
            "We cannot responsibly infer whether, from this record, ReferenceFluid is the winner.",
            "不能据此形成结论：FastFluid 是赢家。",
            "不能审慎推断：ReferenceFluid 是赢家。",
        )
        for addition in governed:
            with self.subTest(claim_governing_complement=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        non_governing = (
            "We cannot inspect that while reviewers proclaim FastFluid the publishable winner.",
            "We cannot archive the report: reviewers proclaim ReferenceFluid the publishable winner.",
            "The system cannot keep that while 评审称 FastFluid 是可发布的赢家。",
            "ReferenceFluid不能更新状态：评审称 FastFluid 是可发布的赢家。",
        )
        for addition in non_governing:
            with self.subTest(object_or_operation=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_that_and_colon_complements_have_distinct_local_boundaries(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot prove that, from these observations, FastFluid is the winner.",
            "We cannot establish whether, from this evidence, ReferenceFluid is overall better.",
            "We cannot support the claim that, on this record, FastFluid is the winner.",
            "We cannot draw the conclusion that, on this record, ReferenceFluid is the winner.",
            "We cannot yet conclude that, from this record, FastFluid is the winner.",
            "不能据此证明：FastFluid 是赢家。",
            "无法充分说明：ReferenceFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(local_governed_complement=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        unsafe = (
            "We cannot publish that trace: reviewers proclaim FastFluid the publishable winner.",
            "We cannot state that result: reviewers proclaim ReferenceFluid the publishable winner.",
            "We cannot publish that trace, reviewers proclaim FastFluid the publishable winner.",
            "We cannot conclude that the evidence is sufficient: reviewers proclaim FastFluid the publishable winner.",
            "不能推断：证据充分：评审宣布 ReferenceFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(independent_after_object_or_boundary=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_complement_pairs_cover_unlisted_actions_modifiers_and_second_boundaries(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot at present demonstrate that, from this record, FastFluid is the winner.",
            "We cannot form a finding that, on this record, ReferenceFluid is the winner.",
            "无法据此阐明：FastFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(unlisted_governed_form=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        unsafe = (
            "We cannot demonstrate that result, reviewers proclaim FastFluid the publishable winner.",
            "We cannot form that report: reviewers proclaim ReferenceFluid the publishable winner.",
            "无法据此阐明：证据充分：评审宣布 FastFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(unlisted_independent_boundary=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_evidentiary_adjuncts_and_scientific_denials_govern_local_claims(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot prove that from these observations, FastFluid is the winner.",
            "We cannot establish whether under this evidence, ReferenceFluid is overall better.",
            "We cannot demonstrate that with this record, FastFluid is the winner.",
            "We cannot show that, from this record, ReferenceFluid is the winner.",
            "We cannot confirm whether, on this evidence, FastFluid is the winner.",
            "This evidence does not establish that, from these observations, ReferenceFluid is the winner.",
            "不能基于现有证据证明：FastFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(local_evidentiary_claim=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_governor_matrix_separates_evidence_adjuncts_from_objects_and_operations(self):
        canonical = self.require_text(ENABLED)
        actions = ("prove", "establish", "demonstrate", "show", "confirm")
        negations = (
            "We cannot {action}",
            "We must not {action}",
            "This evidence does not {action}",
        )
        adjuncts = (
            "from these observations",
            "under this evidence",
            "with this record",
            "on this evidence",
            "based on this record",
        )
        for action in actions:
            for negation in negations:
                for adjunct in adjuncts:
                    addition = (
                        f"{negation.format(action=action)} that {adjunct}, "
                        "FastFluid is the winner."
                    )
                    with self.subTest(
                        governed_action=action,
                        governed_negation=negation,
                        governed_adjunct=adjunct,
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + addition), set()
                        )

        zh_negations = ("不能", "无法")
        zh_adjuncts = ("基于现有证据", "根据这些观察", "凭此记录")
        zh_actions = ("证明", "说明", "阐明")
        for negation in zh_negations:
            for adjunct in zh_adjuncts:
                for action in zh_actions:
                    addition = (
                        f"{negation}{adjunct}{action}：ReferenceFluid 是赢家。"
                    )
                    with self.subTest(
                        zh_negation=negation,
                        zh_adjunct=adjunct,
                        zh_action=action,
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + addition), set()
                        )

        unsafe = (
            "We cannot prove that result, reviewers proclaim FastFluid the publishable winner.",
            "This evidence does not establish that trace: reviewers proclaim ReferenceFluid the publishable winner.",
            "We cannot show that the evidence is sufficient, reviewers proclaim FastFluid the publishable winner.",
            "We cannot process that from this record, reviewers proclaim ReferenceFluid the publishable winner.",
            "不能基于现有证据运行：评审宣布 FastFluid 是可发布的赢家。",
            "无法根据这些观察处理：评审宣布 ReferenceFluid 是可发布的赢家。",
        )
        for addition in unsafe:
            with self.subTest(ungoverned_object_or_operation=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_negation_morphology_and_arbitrary_evidence_adjuncts_govern_claims(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "It cannot be proven that, from these observations, FastFluid is the winner.",
            "These observations do not prove that, from this record, ReferenceFluid is the winner.",
            "The experiment did not demonstrate that, under this evidence, FastFluid is overall better.",
            "This evidence does not indicate that, from these measurements, ReferenceFluid is the winner.",
            "We cannot verify whether, on this evidence, FastFluid is the winner.",
            "不能基于现有证据证实：ReferenceFluid 是赢家。",
            "We cannot prove that in light of this evidence, ReferenceFluid is overall better.",
            "We cannot establish whether using these observations, FastFluid is the winner.",
            "无法鉴于这些观察证明：FastFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(morphology_or_evidence_adjunct=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_morphology_matrix_rejects_objects_operations_and_independent_adjunct_clauses(self):
        canonical = self.require_text(ENABLED)
        action_forms = (
            ("prove", "proven"),
            ("establish", "established"),
            ("demonstrate", "demonstrated"),
            ("indicate", "indicated"),
            ("verify", "verified"),
        )
        negation_forms = (
            "It cannot be {passive} that",
            "These observations do not {base} that",
            "This evidence does not {base} that",
            "The experiment did not {base} that",
        )
        adjuncts = (
            "in light of this evidence",
            "using these observations",
            "after reviewing the record",
            "on measurements in this trial",
            "with only the available evidence",
        )
        for base, passive in action_forms:
            for negation in negation_forms:
                for adjunct in adjuncts:
                    addition = (
                        f"{negation.format(base=base, passive=passive)} "
                        f"{adjunct}, FastFluid is the winner."
                    )
                    with self.subTest(
                        action=(base, passive),
                        negation=negation,
                        arbitrary_evidence_adjunct=adjunct,
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + addition), set()
                        )

        zh_negations = ("不能", "无法")
        zh_adjuncts = (
            "基于现有证据",
            "鉴于这些观察",
            "考虑到当前记录",
            "结合这些测量",
        )
        zh_actions = ("证明", "证实", "说明")
        for negation in zh_negations:
            for adjunct in zh_adjuncts:
                for action in zh_actions:
                    addition = (
                        f"{negation}{adjunct}{action}：ReferenceFluid 是赢家。"
                    )
                    with self.subTest(
                        zh_negation=negation,
                        zh_evidence_adjunct=adjunct,
                        zh_action=action,
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + addition), set()
                        )

        unsafe = (
            "We cannot prove that result, reviewers proclaim FastFluid the publishable winner.",
            "The experiment did not process that trace: reviewers proclaim ReferenceFluid the publishable winner.",
            "It cannot be processed that, from this evidence, reviewers proclaim FastFluid the publishable winner.",
            "We cannot prove that reviewers examined this evidence, FastFluid is the winner.",
            "We cannot establish whether the experiment used these observations, ReferenceFluid is the winner.",
            "不能鉴于现有证据运行：评审宣布 FastFluid 是可发布的赢家。",
            "不能证明：评审审查现有证据，ReferenceFluid 是赢家。",
        )
        for addition in unsafe:
            with self.subTest(object_operation_or_independent_clause=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_modal_negation_and_chinese_predicate_spans_keep_claim_polarity_local(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "It cannot be shown that, from these observations, FastFluid is the winner.",
            "We could not prove that, from this record, ReferenceFluid is the winner.",
        )
        for addition in safe:
            with self.subTest(modal_or_irregular_passive=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        addition = "无法说明：团队读取当前记录，FastFluid 是赢家。"
        self.assertIn(
            "contradictory-verdict", response_issues(canonical + "\n" + addition)
        )

    def test_modal_matrix_and_chinese_clause_shape_do_not_depend_on_predicate_lists(self):
        canonical = self.require_text(ENABLED)
        modals = ("can", "could", "may", "might", "must", "should", "would")
        action_forms = (
            ("prove", "proven"),
            ("show", "shown"),
            ("establish", "established"),
            ("verify", "verified"),
        )
        for modal in modals:
            for base, passive in action_forms:
                active = (
                    f"We {modal} not {base} that, from this record, "
                    "FastFluid is the winner."
                )
                passive_sentence = (
                    f"It {modal} not be {passive} that, under this evidence, "
                    "ReferenceFluid is the winner."
                )
                for addition in (active, passive_sentence):
                    with self.subTest(
                        modal=modal,
                        action=(base, passive),
                        sentence=addition,
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + addition), set()
                        )

        safe_zh_adjuncts = (
            "无法说明：鉴于当前记录，FastFluid 是赢家。",
            "不能证明：结合这些测量，ReferenceFluid 是赢家。",
            "无法证实：基于现有证据，FastFluid 是赢家。",
        )
        for addition in safe_zh_adjuncts:
            with self.subTest(subjectless_evidence_adjunct=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        subjects = ("团队", "评审组", "实验人员", "研究小组")
        predicates = ("读取", "浏览", "汇总", "复核")
        for subject in subjects:
            for predicate in predicates:
                addition = (
                    f"无法说明：{subject}{predicate}当前记录，FastFluid 是赢家。"
                )
                with self.subTest(
                    independent_subject=subject,
                    unlisted_predicate=predicate,
                ):
                    self.assertIn(
                        "contradictory-verdict",
                        response_issues(canonical + "\n" + addition),
                    )

        unsafe_operational = (
            "We could not process that trace: reviewers proclaim FastFluid the publishable winner.",
            "It might not be processed that, from this evidence, reviewers proclaim ReferenceFluid the publishable winner.",
        )
        for addition in unsafe_operational:
            with self.subTest(operational_modal=addition):
                self.assertIn(
                    "contradictory-verdict", response_issues(canonical + "\n" + addition)
                )

    def test_chinese_subject_predicate_split_handles_short_clauses_and_relations(self):
        canonical = self.require_text(ENABLED)
        unsafe = "无法说明：他读记录，FastFluid 是赢家。"
        with self.subTest(short_subject_predicate=unsafe):
            self.assertIn(
                "contradictory-verdict", response_issues(canonical + "\n" + unsafe)
            )

        safe = (
            "无法说明：按照当前记录，FastFluid 是赢家。",
            "不能证明：参照这些测量，ReferenceFluid 是赢家。",
        )
        for addition in safe:
            with self.subTest(subjectless_relation=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_chinese_agent_subjects_use_an_open_predicate_slot(self):
        canonical = self.require_text(ENABLED)
        subjects = (
            "他",
            "她们",
            "李工",
            "分析员",
            "评审",
            "团队",
            "委员会",
            "研究小组",
        )
        predicates = ("读", "看", "查", "审", "翻阅", "核对", "整理")
        evidence_nouns = ("记录", "证据", "观察", "测量")
        for subject in subjects:
            for predicate in predicates:
                for evidence_noun in evidence_nouns:
                    addition = (
                        f"无法说明：{subject}{predicate}{evidence_noun}，"
                        "FastFluid 是赢家。"
                    )
                    with self.subTest(
                        agent_subject=subject,
                        open_predicate=predicate,
                        short_evidence_noun=evidence_noun,
                    ):
                        self.assertIn(
                            "contradictory-verdict",
                            response_issues(canonical + "\n" + addition),
                        )

        subjectless_relations = (
            "按照当前记录",
            "参照这些测量",
            "依照现有证据",
            "对照这些观察",
            "借助当前记录",
            "围绕现有证据",
            "关于这些测量",
        )
        noun_modifiers = ("当前记录", "这些测量", "现有证据", "此观察")
        for adjunct in subjectless_relations + noun_modifiers:
            addition = f"不能证明：{adjunct}，ReferenceFluid 是赢家。"
            with self.subTest(non_agent_evidence_adjunct=adjunct):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_chinese_agent_subject_categories_do_not_consume_relationship_adjuncts(self):
        canonical = self.require_text(ENABLED)
        cases = (
            ("unsafe", "无法说明：我读记录，FastFluid 是赢家。"),
            ("unsafe", "无法说明：机构分析证据，FastFluid 是赢家。"),
            ("unsafe", "无法说明：张教授读测量，FastFluid 是赢家。"),
            ("safe", "无法说明：依据分析员现有记录，FastFluid 是赢家。"),
            ("safe", "不能证明：关于研究团队当前观察，ReferenceFluid 是赢家。"),
        )
        for expected, addition in cases:
            with self.subTest(expected=expected, addition=addition):
                issues = response_issues(canonical + "\n" + addition)
                if expected == "unsafe":
                    self.assertIn("contradictory-verdict", issues)
                else:
                    self.assertEqual(issues, set())

    def test_chinese_agent_subjects_are_anchored_against_relationship_modifiers(self):
        canonical = self.require_text(ENABLED)
        pairs = (
            ("我", "读", "记录", "依据我当前记录"),
            ("我们", "复核", "观察", "关于我们现有观察"),
            ("咱们", "浏览", "测量", "围绕咱们这些测量"),
            ("机构", "分析", "证据", "借助机构现有证据"),
            ("组织", "汇总", "记录", "参照组织当前记录"),
            ("张教授", "看", "测量", "依据张教授现有测量"),
            ("分析员", "审", "记录", "依据分析员现有记录"),
            ("研究团队", "查", "观察", "关于研究团队当前观察"),
        )
        for subject, predicate, evidence_noun, relationship_adjunct in pairs:
            unsafe = (
                f"无法说明：{subject}{predicate}{evidence_noun}，FastFluid 是赢家。"
            )
            with self.subTest(agent_subject=subject, open_predicate=predicate):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + unsafe),
                )

            safe = f"不能证明：{relationship_adjunct}，ReferenceFluid 是赢家。"
            with self.subTest(relationship_modifier=relationship_adjunct):
                self.assertEqual(response_issues(canonical + "\n" + safe), set())

    def test_chinese_experimental_lab_is_an_independent_organization_subject(self):
        canonical = self.require_text(ENABLED)
        addition = "无法说明：实验室复核记录，FastFluid 是赢家。"
        self.assertIn(
            "contradictory-verdict",
            response_issues(canonical + "\n" + addition),
        )

    def test_chinese_organization_subjects_are_bounded_against_relationship_modifiers(self):
        canonical = self.require_text(ENABLED)
        pairs = (
            ("机构", "分析", "证据", "围绕机构现有证据"),
            ("实验室", "浏览", "证据", "围绕实验室现有记录"),
            ("研究所", "复核", "记录", "关于研究所当前证据"),
            ("中心", "汇总", "观察", "依据中心现有观察"),
            ("部门", "查阅", "测量", "参照部门当前测量"),
            ("公司", "审阅", "记录", "借助公司现有记录"),
            ("学院", "整理", "证据", "围绕学院当前证据"),
            ("大学", "核对", "观察", "关于大学现有观察"),
            ("项目组", "阅读", "测量", "依据项目组当前测量"),
            ("工作组", "分析", "记录", "参照工作组现有记录"),
            ("委员会", "复核", "证据", "围绕委员会当前证据"),
            ("团队", "浏览", "观察", "关于团队现有观察"),
        )
        for subject, predicate, evidence_noun, relationship_adjunct in pairs:
            unsafe = (
                f"无法说明：{subject}{predicate}{evidence_noun}，FastFluid 是赢家。"
            )
            with self.subTest(organization=subject, open_predicate=predicate):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + unsafe),
                )

            safe = f"不能证明：{relationship_adjunct}，ReferenceFluid 是赢家。"
            with self.subTest(relationship_modifier=relationship_adjunct):
                self.assertEqual(response_issues(canonical + "\n" + safe), set())

    def test_chinese_subject_categories_and_possessives_keep_claim_polarity_local(self):
        canonical = self.require_text(ENABLED)
        cases = (
            ("unsafe", "无法说明：研究院复核记录，FastFluid 是赢家。"),
            ("unsafe", "无法说明：课题组整理证据，ReferenceFluid 是赢家。"),
            ("unsafe", "无法说明：王小明教授检查测量，ReferenceFluid 是赢家。"),
            ("unsafe", "无法说明：审稿人汇总证据，FastFluid 是赢家。"),
            ("safe", "不能证明：张教授的现有测量，ReferenceFluid 是赢家。"),
            ("safe", "无法说明：分析员的这些观察，FastFluid 是赢家。"),
        )
        for expected, addition in cases:
            with self.subTest(expected=expected, addition=addition):
                issues = response_issues(canonical + "\n" + addition)
                if expected == "unsafe":
                    self.assertIn("contradictory-verdict", issues)
                else:
                    self.assertEqual(issues, set())

    def test_chinese_agent_actions_are_distinct_from_possessive_evidence_tails(self):
        canonical = self.require_text(ENABLED)
        subjects_by_category = {
            "organization": ("研究院", "课题组", "实验室", "项目组"),
            "role": ("审稿人", "分析员", "研究员", "评审"),
            "named_role": ("张教授", "王小明教授", "李华博士", "陈晓峰研究员"),
        }
        action_cases = (
            ("读", "记录"),
            ("检查", "测量"),
            ("整理", "证据"),
            ("汇总", "观察"),
        )
        possessive_cases = (
            ("现有", "测量"),
            ("这些", "观察"),
            ("当前", "记录"),
            ("已有", "证据"),
        )
        for category, subjects in subjects_by_category.items():
            for subject in subjects:
                for predicate, evidence_noun in action_cases:
                    unsafe = (
                        f"无法说明：{subject}{predicate}{evidence_noun}，"
                        "FastFluid 是赢家。"
                    )
                    with self.subTest(
                        category=category,
                        agent=subject,
                        open_predicate=predicate,
                    ):
                        self.assertIn(
                            "contradictory-verdict",
                            response_issues(canonical + "\n" + unsafe),
                        )

                for determiner, evidence_noun in possessive_cases:
                    safe = (
                        f"不能证明：{subject}的{determiner}{evidence_noun}，"
                        "ReferenceFluid 是赢家。"
                    )
                    with self.subTest(
                        category=category,
                        possessive_agent=subject,
                        evidence_tail=(determiner, evidence_noun),
                    ):
                        self.assertEqual(
                            response_issues(canonical + "\n" + safe), set()
                        )

    def test_bounded_evidence_clauses_and_possessives_cover_all_review_cases(self):
        canonical = self.require_text(ENABLED)
        cases = (
            ("unsafe", "无法说明：协会审阅记录，FastFluid 是赢家。"),
            ("unsafe", "We cannot prove that people read record, FastFluid is the winner."),
            ("unsafe", "We cannot prove that 团队 reviewed 当前记录, ReferenceFluid is the winner."),
            ("safe", "不能证明：张教授的本次测量，ReferenceFluid 是赢家。"),
            ("safe", "无法说明：分析员的所有记录，FastFluid 是赢家。"),
        )
        for expected, addition in cases:
            with self.subTest(expected=expected, addition=addition):
                issues = response_issues(canonical + "\n" + addition)
                if expected == "unsafe":
                    self.assertIn("contradictory-verdict", issues)
                else:
                    self.assertEqual(issues, set())

    def test_exact_organization_subjects_remain_distinct_from_relationship_adjuncts(self):
        canonical = self.require_text(ENABLED)
        organizations = ("协会", "学会", "基金会", "联盟", "组织")
        action_cases = (
            ("审阅", "记录"),
            ("核对", "测量"),
            ("汇总", "证据"),
            ("检查", "观察"),
        )
        for organization in organizations:
            for predicate, evidence_noun in action_cases:
                unsafe = (
                    f"无法说明：{organization}{predicate}{evidence_noun}，"
                    "FastFluid 是赢家。"
                )
                with self.subTest(
                    organization=organization,
                    open_predicate=predicate,
                    evidence_noun=evidence_noun,
                ):
                    self.assertIn(
                        "contradictory-verdict",
                        response_issues(canonical + "\n" + unsafe),
                    )

                safe = (
                    f"不能证明：围绕{organization}现有{evidence_noun}，"
                    "ReferenceFluid 是赢家。"
                )
                with self.subTest(
                    relationship_modifier=(organization, evidence_noun)
                ):
                    self.assertEqual(response_issues(canonical + "\n" + safe), set())

    def test_bounded_subject_predicate_evidence_clauses_are_script_agnostic(self):
        canonical = self.require_text(ENABLED)
        independent_clauses = (
            "people read record",
            "reviewers review measurements",
            "teams check evidence",
            "committees summarize observations",
            "团队 reviewed 当前记录",
            "协会 checked 这些测量",
            "people 读取 record",
            "reviewers 汇总 evidence",
            "团队 reviewed record",
        )
        for clause in independent_clauses:
            addition = (
                f"We cannot prove that {clause}, FastFluid is the winner."
            )
            with self.subTest(independent_evidence_clause=clause):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

        subjectless_adjuncts = (
            "We cannot prove that according to record, FastFluid is the winner.",
            "We cannot prove that using current observations, ReferenceFluid is the winner.",
            "不能证明：基于当前记录，FastFluid 是赢家。",
            "We cannot prove that 基于当前记录, ReferenceFluid is the winner.",
            "不能证明：according to record，FastFluid 是赢家。",
        )
        for addition in subjectless_adjuncts:
            with self.subTest(subjectless_evidence_adjunct=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_possessive_evidence_modifiers_are_open_but_do_not_cross_clauses(self):
        canonical = self.require_text(ENABLED)
        subjects = ("张教授", "分析员", "研究院", "协会")
        modifier_cases = (
            ("本次", "测量"),
            ("所有", "记录"),
            ("近期", "观察"),
            ("本轮采集的", "证据"),
        )
        for subject in subjects:
            for modifier, evidence_noun in modifier_cases:
                addition = (
                    f"不能证明：{subject}的{modifier}{evidence_noun}，"
                    "ReferenceFluid 是赢家。"
                )
                with self.subTest(
                    possessive_subject=subject,
                    bounded_modifier=modifier,
                    evidence_noun=evidence_noun,
                ):
                    self.assertEqual(response_issues(canonical + "\n" + addition), set())

        independent_controls = (
            "不能证明：张教授的团队读取当前记录，FastFluid 是赢家。",
            "无法说明：分析员的协会审阅记录，ReferenceFluid 是赢家。",
            "不能证明：张教授的本次测量而团队读取记录，FastFluid 是赢家。",
        )
        for addition in independent_controls:
            with self.subTest(possessive_does_not_cross_clause=addition):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

    def test_agent_number_compounds_and_evidence_subjects_cover_all_review_cases(self):
        canonical = self.require_text(ENABLED)
        additions = (
            "We cannot prove that company reviews record, FastFluid is the winner.",
            "We cannot prove that university checks evidence, ReferenceFluid is the winner.",
            "We cannot prove that the review team reads measurements, FastFluid is the winner.",
            "We cannot prove that review team 汇总 evidence, FastFluid is the winner.",
            "We cannot prove that the available evidence shows instability, FastFluid is the winner.",
            "无法说明：当前记录显示异常，FastFluid 是赢家。",
            "不能证明：这些测量支持结论，ReferenceFluid 是赢家。",
        )
        for addition in additions:
            with self.subTest(unsafe_review_case=addition):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

    def test_english_agent_number_and_compound_classifiers_are_bounded(self):
        canonical = self.require_text(ENABLED)
        number_cases = (
            ("company", "reviews"),
            ("companies", "review"),
            ("university", "checks"),
            ("universities", "check"),
            ("college", "reads"),
            ("colleges", "read"),
            ("laboratory", "summarizes"),
            ("laboratories", "summarize"),
        )
        for subject, predicate in number_cases:
            for action, evidence_noun in (
                (predicate, "record"),
                ("汇总", "evidence"),
            ):
                addition = (
                    f"We cannot prove that {subject} {action} {evidence_noun}, "
                    "FastFluid is the winner."
                )
                with self.subTest(
                    number_normalized_subject=subject,
                    mixed_predicate=action,
                ):
                    self.assertIn(
                        "contradictory-verdict",
                        response_issues(canonical + "\n" + addition),
                    )

        classifiers = ("review", "research", "audit")
        categories = ("team", "group", "committee")
        for classifier in classifiers:
            for category in categories:
                for article in ("", "the "):
                    subject = f"{article}{classifier} {category}"
                    for predicate, evidence_noun in (
                        ("reads", "measurements"),
                        ("汇总", "evidence"),
                    ):
                        addition = (
                            f"We cannot prove that {subject} {predicate} "
                            f"{evidence_noun}, ReferenceFluid is the winner."
                        )
                        with self.subTest(
                            classifier=classifier,
                            category=category,
                            article=article,
                            mixed_predicate=predicate,
                        ):
                            self.assertIn(
                                "contradictory-verdict",
                                response_issues(canonical + "\n" + addition),
                            )

        relation_controls = (
            "We cannot prove that around the review team record, FastFluid is the winner.",
            "We cannot prove that using company record, ReferenceFluid is the winner.",
            "We cannot prove that according to university evidence, FastFluid is the winner.",
        )
        for addition in relation_controls:
            with self.subTest(relation_is_not_agent_subject=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_evidence_leading_subjects_use_bounded_open_modifiers(self):
        canonical = self.require_text(ENABLED)
        cases = (
            ("the available", "evidence", "shows instability"),
            ("current", "record", "indicates drift"),
            ("these reported", "measurements", "support the conclusion"),
            ("当前", "记录", "显示异常"),
            ("这些", "测量", "支持结论"),
            ("现有", "证据", "表明波动"),
            ("the 当前", "记录", "shows instability"),
            ("这些", "evidence", "supports the conclusion"),
        )
        for modifier, evidence_noun, predicate in cases:
            clause = f"{modifier} {evidence_noun} {predicate}" if re.search(
                r"[A-Za-z]", modifier + evidence_noun + predicate
            ) else f"{modifier}{evidence_noun}{predicate}"
            addition = (
                f"We cannot prove that {clause}, FastFluid is the winner."
            )
            with self.subTest(
                bounded_modifier=modifier,
                evidence_noun=evidence_noun,
                open_predicate=predicate,
            ):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

        adjunct_controls = (
            "We cannot prove that according to the available evidence, FastFluid is the winner.",
            "We cannot prove that using these measurements, ReferenceFluid is the winner.",
            "不能证明：基于当前记录，FastFluid 是赢家。",
            "不能证明：张教授的当前记录，ReferenceFluid 是赢家。",
        )
        for addition in adjunct_controls:
            with self.subTest(non_subject_evidence_phrase=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_postnominal_relations_are_not_evidence_subject_predicates(self):
        canonical = self.require_text(ENABLED)
        safe_clauses = (
            "the available evidence from this run",
            "via record from this run",
            "these measurements in the benchmark",
            "available observations for this scene",
            "当前记录中的数据",
            "依据记录所示",
            "这些测量里的结果",
            "基于证据得到的结果",
        )
        for clause in safe_clauses:
            addition = (
                f"We cannot prove that {clause}, FastFluid is the winner."
                if re.search(r"[A-Za-z]", clause)
                else f"不能证明：{clause}，FastFluid 是赢家。"
            )
            with self.subTest(postnominal_relation=clause):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_postnominal_modifiers_and_open_subjects_cover_all_review_cases(self):
        canonical = self.require_text(ENABLED)
        safe = (
            "We cannot prove that the available evidence from this run, FastFluid is the winner.",
            "We cannot prove that via record from this run, ReferenceFluid is the winner.",
            "不能证明：当前记录中的数据，FastFluid 是赢家。",
            "不能证明：依据记录所示，ReferenceFluid 是赢家。",
        )
        unsafe = (
            "We cannot prove that a current record shows drift, FastFluid is the winner.",
            "We cannot prove that the currently available evidence shows instability, ReferenceFluid is the winner.",
            "无法说明：本次现有记录显示异常，FastFluid 是赢家。",
            "We cannot prove that benchmark team checks record, FastFluid is the winner.",
            "We cannot prove that evaluation committee 汇总 evidence, ReferenceFluid is the winner.",
        )
        for addition in safe:
            with self.subTest(safe_review_case=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())
        for addition in unsafe:
            with self.subTest(unsafe_review_case=addition):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

    def test_evidence_subject_premodifiers_remain_bounded_but_open(self):
        canonical = self.require_text(ENABLED)
        unsafe_clauses = (
            "a current record shows drift",
            "the currently available evidence shows instability",
            "the newly captured measurements indicate noise",
            "this available record supports the conclusion",
            "本次现有记录显示异常",
            "当前记录支持结论",
            "这些已有测量表明波动",
            "本轮当前 evidence shows instability",
        )
        for clause in unsafe_clauses:
            addition = (
                f"We cannot prove that {clause}, ReferenceFluid is the winner."
                if re.search(r"[A-Za-z]", clause)
                else f"无法说明：{clause}，ReferenceFluid 是赢家。"
            )
            with self.subTest(bounded_open_premodifier=clause):
                self.assertIn(
                    "contradictory-verdict",
                    response_issues(canonical + "\n" + addition),
                )

    def test_compound_agent_classifier_is_open_but_not_relation_led(self):
        canonical = self.require_text(ENABLED)
        for classifier in ("benchmark", "evaluation", "physics"):
            for category in ("team", "group", "committee"):
                for article in ("", "the "):
                    subject = f"{article}{classifier} {category}"
                    for predicate, evidence_noun in (
                        ("checks", "record"),
                        ("汇总", "evidence"),
                    ):
                        addition = (
                            f"We cannot prove that {subject} {predicate} "
                            f"{evidence_noun}, FastFluid is the winner."
                        )
                        with self.subTest(
                            open_classifier=classifier,
                            category=category,
                            article=article,
                            predicate=predicate,
                        ):
                            self.assertIn(
                                "contradictory-verdict",
                                response_issues(canonical + "\n" + addition),
                            )

        relation_controls = (
            "We cannot prove that using team benchmark record, FastFluid is the winner.",
            "We cannot prove that around committee audit evidence, ReferenceFluid is the winner.",
            "We cannot prove that via group comparison measurements, FastFluid is the winner.",
        )
        for addition in relation_controls:
            with self.subTest(relation_head_is_not_classifier=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_tool_execution_polarity_is_bound_to_the_execution_action(self):
        canonical = self.require_text(ENABLED)
        unsafe = (
            "Input is missing, but I ran analyze_physics_trace.py.",
            "The input is missing; compare_reported_results.py was executed.",
            "输入缺失，但我执行了 analyze_physics_trace.py。",
            "输入缺失；compare_reported_results.py 已被调用。",
        )
        for addition in unsafe:
            with self.subTest(unsafe_execution=addition):
                self.assertIn(
                    "false-tool-execution", response_issues(canonical + "\n" + addition)
                )

        safe = (
            "Input is missing, so I did not run analyze_physics_trace.py.",
            "compare_reported_results.py was not executed because input is missing.",
            "输入缺失，所以未运行 analyze_physics_trace.py。",
            "由于输入缺失，compare_reported_results.py 未被调用。",
        )
        for addition in safe:
            with self.subTest(safe_execution=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

    def test_execution_auxiliaries_and_chinese_passive_negation_are_local(self):
        canonical = self.require_text(ENABLED)
        positive_execution = (
            "analyze_physics_trace.py did run.",
            "compare_reported_results.py has run.",
            "analyze_physics_trace.py had run.",
            "I did run compare_reported_results.py.",
            "analyze_physics_trace.py 已运行。",
            "compare_reported_results.py 已经执行。",
            "已经调用 analyze_physics_trace.py。",
            "我已执行 compare_reported_results.py。",
        )
        for addition in positive_execution:
            with self.subTest(positive_execution=addition):
                self.assertIn(
                    "false-tool-execution", response_issues(canonical + "\n" + addition)
                )

        denied_execution = (
            "analyze_physics_trace.py did not run.",
            "compare_reported_results.py has not run.",
            "analyze_physics_trace.py had not run.",
            "analyze_physics_trace.py 未运行。",
            "compare_reported_results.py 没有执行。",
            "analyze_physics_trace.py 不应被运行。",
        )
        for addition in denied_execution:
            with self.subTest(denied_execution=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        denied_prescriptions = (
            "CityFlood 不应被用作场景。",
            "CityFlood 不得被用作场景。",
            "CityFlood 不能被用作场景。",
            "CityFlood 不可被用作场景。",
            "CityFlood 未被用作场景。",
            "CityFlood 没有被用作场景。",
        )
        for addition in denied_prescriptions:
            with self.subTest(denied_prescription=addition):
                self.assertEqual(response_issues(canonical + "\n" + addition), set())

        positive_prescriptions = (
            "硬件未知，但已使用 RTX 4090。",
            "CityFlood 已被用作场景。",
        )
        for addition in positive_prescriptions:
            with self.subTest(positive_prescription=addition):
                self.assertIn(
                    "unsafe-prescription", response_issues(canonical + "\n" + addition)
                )

    def test_oracle_rejects_contradictions_and_false_tool_execution_bilingually(self):
        baseline = self.require_text(BASELINE)
        baseline_issues = response_issues(baseline)
        mutations = {
            "contradictory-verdict": (
                "Therefore FastFluid is the winner and this is publishable.",
                "因此 FastFluid 总体更好，结论可发布。",
            ),
            "false-tool-execution": (
                "I ran analyze_physics_trace.py and obtained the values above.",
                "I executed compare_reported_results.py and obtained a pass.",
                "I called analyze_physics_trace.py for this evidence.",
                "我执行了 analyze_physics_trace.py 并得到上述数值。",
                "我调用了 compare_reported_results.py 并得到通过结果。",
            ),
        }
        for expected, additions in mutations.items():
            for addition in additions:
                with self.subTest(expected=expected, addition=addition):
                    issues = response_issues(baseline + "\n" + addition)
                    self.assertEqual(issues - baseline_issues, {expected})

        safe_execution = (
            "I did not run analyze_physics_trace.py because no trace exists.",
            "I did not call compare_reported_results.py because inputs are missing.",
            "未运行 analyze_physics_trace.py，因为没有 trace。",
            "没有调用 compare_reported_results.py，因为输入缺失。",
        )
        for addition in safe_execution:
            with self.subTest(safe_execution=addition):
                self.assertEqual(
                    response_issues(baseline + "\n" + addition),
                    baseline_issues,
                )

    def test_exit_codes_are_bound_to_outcomes_and_permutations_fail_both_oracles(self):
        skill = self.require_text(SKILL)
        reference = self.require_text(REFERENCE)
        self.assertNotIn("trace-tool-contract", response_issues(reference))
        self.assertNotIn("comparison-tool-contract", response_issues(reference))
        for heading, response_issue in (
            ("analyze_physics_trace.py", "trace-tool-contract"),
            ("compare_reported_results.py", "comparison-tool-contract"),
        ):
            with self.subTest(heading=heading):
                permuted = swap_exit_zero_one_in_section(reference, heading)
                self.assertNotEqual(permuted, reference)
                self.assertIn(response_issue, response_issues(permuted))
                self.assertIn("tool-guidance", guidance_issues(skill, permuted))

    def test_tool_spans_need_distinct_anchors_and_exit_outcomes_are_exclusive(self):
        combined = (
            "# Combined tool soup\n\n"
            "## analyze_physics_trace.py and compare_reported_results.py\n\n"
            "JSONL CSV one run_id count mean nearest-rank p50 p95 p99 max; "
            "declared threshold max > threshold; does not handle warm-up, between-run "
            "inference, or confidence interval. reported observed scalar tolerance mean "
            "min max sample standard deviation n=1 null; no metadata, no quality, no "
            "causal test. Exit 0 all declared maximum thresholds pass and equality "
            "tolerance rule passes; Exit 1 at least one threshold fails and the rule "
            "fails; Exit 2 CLI input validation failure.\n"
        )
        self.assertEqual(
            tool_local_span(
                combined, "analyze_physics_trace.py", "compare_reported_results.py"
            ),
            "",
        )
        self.assertEqual(
            tool_local_span(
                combined, "compare_reported_results.py", "analyze_physics_trace.py"
            ),
            "",
        )

        canonical = self.require_text(ENABLED)
        trace = tool_local_span(
            canonical, "analyze_physics_trace.py", "compare_reported_results.py"
        )
        comparison = tool_local_span(
            canonical, "compare_reported_results.py", "analyze_physics_trace.py"
        )
        self.assertNotEqual(trace, comparison)
        self.assertTrue(exit_mapping_is_valid(trace, "trace"))
        self.assertTrue(exit_mapping_is_valid(comparison, "comparison"))

        contradictory_maps = (
            (
                "所有声明的最大阈值通过",
                "所有声明的最大阈值通过并失败",
                "trace-tool-contract",
            ),
            (
                "至少一个阈值失败",
                "至少一个阈值失败并通过",
                "trace-tool-contract",
            ),
            (
                "CLI、输入或验证失败",
                "CLI、输入或验证失败但输入有效",
                "trace-tool-contract",
            ),
            (
                "等值/容差规则通过",
                "等值/容差规则通过并失败",
                "comparison-tool-contract",
            ),
            (
                "该规则失败",
                "该规则失败并通过",
                "comparison-tool-contract",
            ),
        )
        for old, new, expected in contradictory_maps:
            with self.subTest(contradictory_mapping=new):
                mutated = canonical.replace(old, new, 1)
                self.assertIn(expected, response_issues(mutated))

    def test_exit_mapping_rejects_cross_code_failure_categories(self):
        canonical = self.require_text(ENABLED)
        mutations = (
            (
                "**1** 表示至少一个阈值失败；",
                "**1** 表示至少一个阈值失败且 CLI、输入或验证失败；",
                "trace-tool-contract",
            ),
            (
                "**2** 表示 CLI、输入或验证失败。",
                "**2** 表示 CLI、输入或验证失败且至少一个阈值失败。",
                "trace-tool-contract",
            ),
            (
                "**1** 表示该规则失败；",
                "**1** 表示该规则失败且 CLI、输入或验证失败；",
                "comparison-tool-contract",
            ),
            (
                "**1** 表示该规则失败；**2** 表示 CLI、输入或验证失败。",
                "**1** 表示该规则失败；**2** 表示 CLI、输入或验证失败且该规则失败。",
                "comparison-tool-contract",
            ),
        )
        for old, new, expected in mutations:
            with self.subTest(cross_code_mapping=new):
                self.assertIn(old, canonical)
                mutated = canonical.replace(old, new, 1)
                self.assertIn(expected, response_issues(mutated))

    def test_exit_mapping_rejects_partial_cross_category_failures(self):
        partial_sections = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails and input validation failed; "
                "Exit 2 CLI input validation failed.",
            ),
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails; "
                "Exit 2 CLI input validation failed and threshold failed.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 rule fails and input validation failed; "
                "Exit 2 CLI input validation failed.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 rule fails; "
                "Exit 2 CLI input validation failed and tolerance failed.",
            ),
        )
        for tool, section in partial_sections:
            with self.subTest(tool=tool, partial_section=section):
                self.assertFalse(exit_mapping_is_valid(section, tool))

        canonical = self.require_text(ENABLED)
        response_mutations = (
            (
                "**1** 表示至少一个阈值失败；",
                "**1** 表示至少一个阈值失败且输入验证失败；",
                "trace-tool-contract",
            ),
            (
                "**2** 表示 CLI、输入或验证失败。",
                "**2** 表示 CLI、输入或验证失败且阈值失败。",
                "trace-tool-contract",
            ),
            (
                "**1** 表示该规则失败；",
                "**1** 表示该规则失败且输入验证失败；",
                "comparison-tool-contract",
            ),
            (
                "**1** 表示该规则失败；**2** 表示 CLI、输入或验证失败。",
                "**1** 表示该规则失败；**2** 表示 CLI、输入或验证失败且容差检查失败。",
                "comparison-tool-contract",
            ),
        )
        for old, new, expected in response_mutations:
            with self.subTest(partial_response_mapping=new):
                mutated = canonical.replace(old, new, 1)
                self.assertIn(expected, response_issues(mutated))

    def test_exit_mapping_uses_local_failure_polarity(self):
        valid_with_cross_category_denials = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails, not an input validation failure; "
                "Exit 2 CLI input validation failure, not a threshold failure.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 rule fails, not an input validation failure; "
                "Exit 2 CLI input validation failure, not a tolerance rule failure.",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败，并非输入验证失败；"
                "退出码 2 CLI、输入或验证失败，并非阈值失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则失败，不是输入验证失败；"
                "退出码 2 CLI、输入或验证失败，不是容差规则失败。",
            ),
        )
        for tool, section in valid_with_cross_category_denials:
            with self.subTest(tool=tool, cross_category_denial=section):
                self.assertTrue(exit_mapping_is_valid(section, tool))

        invalid_with_negated_own_outcome = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold does not fail; "
                "Exit 2 CLI input validation fails.",
            ),
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails; "
                "Exit 2 CLI input validation does not fail.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 the rule does not fail; "
                "Exit 2 CLI input validation fails.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 the rule fails; "
                "Exit 2 CLI input validation does not fail.",
            ),
        )
        for tool, section in invalid_with_negated_own_outcome:
            with self.subTest(tool=tool, negated_own_outcome=section):
                self.assertFalse(exit_mapping_is_valid(section, tool))

    def test_exit_mapping_splits_contrast_before_failure_polarity(self):
        valid_contrastive_exclusions = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails but not from input validation; "
                "Exit 2 input validation fails but not a threshold failure.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 rule fails yet not from input validation; "
                "Exit 2 input validation fails yet not a tolerance rule failure.",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败但不是输入验证失败；"
                "退出码 2 CLI、输入或验证失败但是并非阈值失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则失败而不是输入验证失败；"
                "退出码 2 CLI、输入或验证失败而不是容差规则失败。",
            ),
        )
        for tool, section in valid_contrastive_exclusions:
            with self.subTest(tool=tool, contrastive_exclusion=section):
                self.assertTrue(exit_mapping_is_valid(section, tool))

    def test_exit_mapping_binds_chinese_negation_to_own_failure(self):
        negated_own_outcomes = (
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值未失败；退出码 2 输入验证失败。",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败；退出码 2 输入验证未失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则未失败；退出码 2 输入验证失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则失败；退出码 2 输入验证不失败。",
            ),
        )
        for tool, section in negated_own_outcomes:
            with self.subTest(tool=tool, negated_own_outcome=section):
                self.assertFalse(exit_mapping_is_valid(section, tool))

        affirmative_budan_outcomes = (
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值不但失败而且超过上限；"
                "退出码 2 输入验证失败。",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败；"
                "退出码 2 输入验证不但失败而且无效。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则不但失败而且不满足容差；"
                "退出码 2 输入验证失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；退出码 1 规则失败；"
                "退出码 2 输入验证不但失败而且无效。",
            ),
        )
        for tool, section in affirmative_budan_outcomes:
            with self.subTest(tool=tool, affirmative_budan=section):
                self.assertTrue(exit_mapping_is_valid(section, tool))

    def test_exit_mapping_binds_compound_negation_to_failure(self):
        negated_own_outcomes = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold doesn't fail; "
                "Exit 2 input validation fails.",
            ),
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails; "
                "Exit 2 input validation isn't a failure.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; Exit 1 the rule didn't fail; "
                "Exit 2 input validation fails.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; Exit 1 the rule fails; "
                "Exit 2 input validation doesn't fail.",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值不会失败；退出码 2 输入验证失败。",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败；退出码 2 输入验证并不失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则不再失败；退出码 2 输入验证失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则失败；退出码 2 输入验证不会失败。",
            ),
        )
        for tool, section in negated_own_outcomes:
            with self.subTest(tool=tool, compound_negation=section):
                self.assertFalse(exit_mapping_is_valid(section, tool))

    def test_exit_mapping_handles_inability_and_not_only_polarity(self):
        negated_own_outcomes = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold cannot fail; Exit 2 input validation fails.",
            ),
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold fails; Exit 2 input validation cannot fail.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; Exit 1 the rule cannot fail; "
                "Exit 2 input validation fails.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; Exit 1 the rule fails; "
                "Exit 2 input validation cannot fail.",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值无法失败；退出码 2 输入验证失败。",
            ),
            (
                "trace",
                "退出码 0 所有声明的最大阈值通过；"
                "退出码 1 至少一个阈值失败；退出码 2 输入验证无法失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则无法失败；退出码 2 输入验证失败。",
            ),
            (
                "comparison",
                "退出码 0 等值/容差规则通过；"
                "退出码 1 规则失败；退出码 2 输入验证无法失败。",
            ),
        )
        for tool, section in negated_own_outcomes:
            with self.subTest(tool=tool, inability_negation=section):
                self.assertFalse(exit_mapping_is_valid(section, tool))

        affirmative_not_only_outcomes = (
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; "
                "Exit 1 at least one threshold not only fails but exceeds its limit; "
                "Exit 2 input validation fails.",
            ),
            (
                "trace",
                "Exit 0 all declared maximum thresholds pass; Exit 1 at least one threshold fails; "
                "Exit 2 input validation not only fails but is invalid.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; "
                "Exit 1 the rule not only fails but violates tolerance; "
                "Exit 2 input validation fails.",
            ),
            (
                "comparison",
                "Exit 0 equality tolerance rule passes; Exit 1 the rule fails; "
                "Exit 2 input validation not only fails but is invalid.",
            ),
        )
        for tool, section in affirmative_not_only_outcomes:
            with self.subTest(tool=tool, affirmative_not_only=section):
                self.assertTrue(exit_mapping_is_valid(section, tool))

    def test_skill_contract_is_local_semantic_and_resists_deletions(self):
        skill = self.require_text(SKILL)
        reference = self.require_text(REFERENCE)
        self.assertEqual(guidance_issues(skill, reference), set())
        permuted_entrypoint = swap_exit_zero_one_in_section(
            skill, "Tool-output requirement"
        )
        self.assertIn(
            "entrypoint-tool-output-contract",
            guidance_issues(permuted_entrypoint, reference),
        )
        missing_limit = skill.replace("limitations", "details", 1)
        self.assertIn(
            "entrypoint-tool-output-contract",
            guidance_issues(missing_limit, reference),
        )
        mutations = {
            "evidence-ledger-guidance": reference.replace("measured fact", "fact", 1),
            "independent-unit-guidance": re.sub(
                r"frames/ticks", "samples", reference, count=1, flags=re.IGNORECASE
            ),
            "redesign-routing": reference.replace(
                "designing-simulation-experiments", "another workflow", 1
            ),
        }
        for expected, mutated in mutations.items():
            with self.subTest(expected=expected):
                self.assertIn(expected, guidance_issues(skill, mutated))
        removed_tool_section = re.sub(
            r"^## analyze_physics_trace\.py.*?(?=^## |\Z)",
            "",
            reference,
            count=1,
            flags=re.MULTILINE | re.DOTALL,
        )
        self.assertIn("tool-guidance", guidance_issues(skill, removed_tool_section))

    def test_skill_entrypoint_and_ui_are_discoverable_and_minimal(self):
        skill = self.require_text(SKILL)
        match = re.match(
            r"---\n(?P<frontmatter>.*?)\n---\n(?P<body>.*)\Z",
            skill,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        frontmatter = match.group("frontmatter")
        body = match.group("body")
        self.assertIn("name: analyzing-simulation-evidence", frontmatter)
        description_match = re.search(
            r"^description:\s*(.+)$", frontmatter, re.MULTILINE
        )
        self.assertIsNotNone(description_match)
        description = description_match.group(1).strip(' "')
        self.assertTrue(description.startswith("Use when"))
        self.assertLess(len(description), 500)
        self.assertLess(len(re.findall(r"\b[\w'-]+\b", body)), 500)
        self.assertIsNone(
            re.search(r"[\u4e00-\u9fff]", body),
            "technical SKILL.md body must be English",
        )
        ui = self.require_text(UI)
        self.assertIn("$analyzing-simulation-evidence", ui)
        self.assertIn("allow_implicit_invocation: true", ui)
        self.assertRegex(ui, r"display_name:.*[\u4e00-\u9fff]")
        self.assertRegex(ui, r"short_description:.*[\u4e00-\u9fff]")

    def test_evaluation_freezes_provenance_adjudications_and_verdicts(self):
        record = json.loads(self.require_text(EVALUATION))
        self.assertEqual(validate_evaluation_record(record), [])
        self.assertEqual(record["skill"], "analyzing-simulation-evidence")
        self.assertEqual(record["scenario"], self.require_text(SCENARIO))
        self.assertEqual(record["baseline"]["response"], self.require_text(BASELINE))
        self.assertEqual(record["enabled"]["response"], self.require_text(ENABLED))
        self.assertEqual(record["baseline_verdict"], "fail")
        self.assertEqual(record["enabled_verdict"], "pass")
        self.assertEqual(record["verdict"], "pass")
        self.assertEqual(
            record["baseline"]["violations"],
            sorted(response_issues(self.require_text(BASELINE))),
        )
        self.assertEqual(record["enabled"]["violations"], [])

        attempts = record["attempt_history"]
        self.assertEqual(len(attempts), 2)
        self.assertEqual(attempts[0]["violations"], [
            "comparison-tool-contract", "trace-tool-contract"
        ])
        self.assertEqual(attempts[1]["violations"], [])
        for attempt, fixture, length, digest, forbidden in (
            (
                attempts[0], ATTEMPT1, ATTEMPT1_BYTES, ATTEMPT1_SHA256,
                ATTEMPT1_FORBIDDEN_INPUTS,
            ),
            (
                attempts[1], ATTEMPT2, ATTEMPT2_BYTES, ATTEMPT2_SHA256,
                ATTEMPT2_FORBIDDEN_INPUTS,
            ),
        ):
            self.assertEqual(attempt["fixture"], fixture.relative_to(ROOT).as_posix())
            self.assertEqual(attempt["response_bytes"], length)
            self.assertEqual(attempt["response_sha256"], digest)
            self.assertEqual(
                attempt["isolation"]["allowed_inputs"],
                ALLOWED_INPUTS,
            )
            self.assertEqual(attempt["isolation"]["evaluator"], EVALUATOR)
            self.assertEqual(attempt["isolation"]["forbidden_inputs"], forbidden)
            self.assertEqual(
                attempt["isolation"]["tool_execution"], ATTEMPT_TOOL_EXECUTION
            )
        self.assertEqual(
            record["tool_interface_facts"]["execution_status"],
            TOP_LEVEL_EXECUTION_STATUS,
        )
        self.assertEqual(evaluation_provenance_issues(record), set())

        forbidden_access_claims = (
            "tests/fixtures/analyzing-simulation-evidence-baseline-response.txt",
            "enabled attempt 1 and attempt history",
            "tests/test_analyzing_simulation_evidence_skill.py",
            "evaluations/analyzing-simulation-evidence/evaluation.json",
            ".superpowers/source-research-map.md",
            ".superpowers/task-27-brief.md",
            ".superpowers/task-27-plan.md",
            ".superpowers/task-27-report.md",
            ".git/HEAD",
            "conversation transcript",
        )
        for attempt_index in (0, 1):
            for claim in forbidden_access_claims:
                with self.subTest(attempt=attempt_index + 1, access_claim=claim):
                    mutated = copy.deepcopy(record)
                    mutated["attempt_history"][attempt_index]["isolation"][
                        "allowed_inputs"
                    ].append(claim)
                    self.assertIn(
                        f"attempt-{attempt_index + 1}-isolation",
                        evaluation_provenance_issues(mutated),
                    )

        for attempt_index in (0, 1):
            with self.subTest(attempt=attempt_index + 1, field="evaluator"):
                mutated = copy.deepcopy(record)
                mutated["attempt_history"][attempt_index]["isolation"][
                    "evaluator"
                ] = "evaluator with baseline and Git history access"
                self.assertIn(
                    f"attempt-{attempt_index + 1}-isolation",
                    evaluation_provenance_issues(mutated),
                )
            with self.subTest(attempt=attempt_index + 1, field="forbidden_inputs"):
                mutated = copy.deepcopy(record)
                mutated["attempt_history"][attempt_index]["isolation"][
                    "forbidden_inputs"
                ] = []
                self.assertIn(
                    f"attempt-{attempt_index + 1}-isolation",
                    evaluation_provenance_issues(mutated),
                )
            with self.subTest(attempt=attempt_index + 1, field="tool_execution"):
                mutated = copy.deepcopy(record)
                mutated["attempt_history"][attempt_index]["isolation"][
                    "tool_execution"
                ] = "analyze_physics_trace.py was executed successfully."
                self.assertIn(
                    f"attempt-{attempt_index + 1}-isolation",
                    evaluation_provenance_issues(mutated),
                )

        mutated = copy.deepcopy(record)
        mutated["tool_interface_facts"]["execution_status"] = (
            "compare_reported_results.py was executed for this evaluation."
        )
        self.assertIn("execution-status", evaluation_provenance_issues(mutated))
        self.assertEqual(
            attempts[0]["adjudication"]["real_issues"],
            ["comparison-tool-contract", "trace-tool-contract"],
        )
        self.assertEqual(attempts[1]["adjudication"]["real_issues"], [])
        self.assertEqual(record["hashes"]["scenario_sha256"], SCENARIO_SHA256)
        self.assertEqual(record["hashes"]["baseline_response_sha256"], BASELINE_SHA256)
        self.assertEqual(record["hashes"]["enabled_attempt_1_sha256"], ATTEMPT1_SHA256)
        self.assertEqual(record["hashes"]["enabled_attempt_2_sha256"], ATTEMPT2_SHA256)
        self.assertEqual(record["hashes"]["enabled_response_sha256"], ATTEMPT2_SHA256)
        self.assertTrue(record["promotion"]["byte_identical"])

    def test_task_27_files_are_tracked_and_portable_from_staged_archive(self):
        paths = (
            ROOT / ".gitattributes",
            SKILL,
            REFERENCE,
            UI,
            ROOT / "tests" / "test_analyzing_simulation_evidence_skill.py",
            SCENARIO,
            BASELINE,
            ATTEMPT1,
            ATTEMPT2,
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
            archive = Path(temporary) / "task27.tar"
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
                "from tests.test_analyzing_simulation_evidence_skill import "
                "AnalyzingSimulationEvidenceSkillTests as C; "
                "excluded = {'test_task_27_files_are_tracked_and_portable_from_staged_archive'}; "
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
