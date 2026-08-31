"""Flagship contract, semantic-mutation, provenance, and archive tests."""

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
SKILL = ROOT / "skills" / "unreal-chaos-physics" / "SKILL.md"
REFERENCE = ROOT / "skills" / "unreal-chaos-physics" / "references" / "unreal-chaos.md"
UI = ROOT / "skills" / "unreal-chaos-physics" / "agents" / "openai.yaml"
AUDIT = ROOT / "references" / "unreal-chaos-physics-source-audit.md"
EVALUATION = ROOT / "evaluations" / "unreal-chaos-physics" / "evaluation.json"
SCENARIO = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-scenario.txt"
BASELINE = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-baseline-response.txt"
ATTEMPT1 = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-enabled-attempt-1-response.txt"
ATTEMPT2 = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-enabled-attempt-2-response.txt"
ATTEMPT3 = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-enabled-attempt-3-response.txt"
ATTEMPT4 = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-enabled-attempt-4-response.txt"
ATTEMPT5 = ROOT / "tests" / "fixtures" / "unreal-chaos-physics-enabled-attempt-5-response.txt"
ATTEMPT5_INVOCATION = ROOT / "evaluations" / "unreal-chaos-physics" / "attempt-5-evaluator-invocation.txt"
ATTEMPT5_PROVENANCE = ROOT / "evaluations" / "unreal-chaos-physics" / "attempt-5-provenance.json"

HEADINGS = ("Version gate and ownership", "Chaos workflow map", "Evidence and migration", "Acceptance")
ROUTES = (
    "rigid-body-collision-contact", "architecting-real-time-physics",
    "constraints-ragdolls-active-physics", "character-controller-movement",
    "networked-deterministic-physics", "vehicle-physics", "cloth-rope-soft-bodies",
    "destruction-fracture-fields", "debugging-testing-physics",
    "profiling-scaling-physics", "surveying-real-time-physics-research",
    "reproducing-simulation-papers",
)
LEGACY = ("PhysXScene", "PxScene", "PVD", "UDestructibleComponent", "APEX Destruction", "PxVehicleDrive4W")

APPLIED_OUTPUT_TERMS = (
    "Every applied answer explicitly",
    "feature/version-gated",
    "plugin/asset/runtime context",
    "old advice, last verified context, current Chaos concept, supported surface, verification source, owner, replacement status, and test",
    "replication/prediction model, history length, correction thresholds, event semantics, packet-fault matrix",
    "fatal-stop conditions",
    "Before finalizing",
    "response as incomplete unless",
    "prose or compact tables",
    "no fixed answer template",
    "when research applies, explicitly name",
    "when paper reproduction applies, explicitly name",
)

COMPLIANT_EN = """## Version gate and ownership
Exact major/minor/patch, Launcher/source commit, platform/build target, enabled plugins and maturity are unknown blockers. Blueprint, C++, console/config and editor/debug surfaces are feature/version-gated. Authority, thread, asset and authoritative/cosmetic owners are declared. Reject PhysXScene, PxScene, PVD, UDestructibleComponent, APEX Destruction and PxVehicleDrive4W as legacy.
## Chaos workflow map
Collision query/contact/CCD and simple-versus-complex -> rigid-body-collision-contact; fixed/substep/async state handoff and callback -> architecting-real-time-physics; Physics Asset constraints/drives/ragdoll -> constraints-ragdolls-active-physics; character/controller -> character-controller-movement; replication/prediction -> networked-deterministic-physics; Chaos Vehicles -> vehicle-physics; Chaos Cloth and Chaos Flesh -> cloth-rope-soft-bodies; Geometry Collection fracture/fields -> destruction-fracture-fields; evidence -> debugging-testing-physics; cost -> profiling-scaling-physics; research -> surveying-real-time-physics-research; paper reproduction -> reproducing-simulation-papers. Each domain names plugin/asset/runtime context, evidence, owner and version/maturity boundary.
## Evidence and migration
Use CVD for physics state, query and solver evidence paired with Unreal Insights timing attribution; report p50/p95/p99 and matched capture ID with exactly one change. Declare the replication/prediction model, history length, correction thresholds, event semantics, packet-fault matrix, hash/state comparisons and replay/resimulation acceptance. Include a migration ledger with old advice, last verified context, current Chaos concept, supported surface, verification source, owner, replacement status and test. Include an official Epic source/version matrix with URL/path, version selector, maturity, surface, claims and limitations. Community examples remain quoted/rejected only.
## Acceptance
On target hardware require 60 Hz, physics CPU p95 <= 3 ms, collision/constraint invariants and packet/replay/rollback tests. Exact symbols compile and node/setting verification occurs in the declared build. Fatal-stop conditions: non-finite state, authority/history corruption, thread-unsafe access, unsupported geometry/plugin/API, missing capture provenance, unsafe budget breach or irreproducible migration advice.
"""

COMPLIANT_ZH = """## Version gate and ownership
精确 major/minor/patch、Launcher/source commit、平台/构建目标、插件和成熟度未知时均为阻塞项。Blueprint、C++、console/config、editor/debug 表面必须按 feature/version-gated 门控。声明权威、线程、资产及 authoritative/cosmetic owner。迁移清单中拒绝旧版 PhysXScene、PxScene、PVD、UDestructibleComponent、APEX Destruction 与 PxVehicleDrive4W。
## Chaos workflow map
按任务路由：simple-versus-complex 碰撞/query/contact/CCD 到 rigid-body-collision-contact；fixed/substep/async 状态交接与回调到 architecting-real-time-physics；Physics Asset 约束/驱动/布娃娃到 constraints-ragdolls-active-physics；角色/controller 到 character-controller-movement；复制/预测到 networked-deterministic-physics；车辆到 vehicle-physics；Chaos Cloth 与 Chaos Flesh 到 cloth-rope-soft-bodies；Geometry Collection 破碎/场到 destruction-fracture-fields；证据到 debugging-testing-physics；成本到 profiling-scaling-physics；研究到 surveying-real-time-physics-research；论文复现到 reproducing-simulation-papers。每域声明 plugin/asset/runtime context、证据、owner 与 version/maturity boundary。
## Evidence and migration
CVD 提供 physics state、查询、solver 证据，并与 Unreal Insights timing 归因配对；报告 p50/p95/p99、capture ID，一次只改一个变量。声明复制/预测模型、历史长度、校正阈值、事件语义、数据包故障矩阵、hash/state 对比与回放/resimulation 验收。迁移 ledger 包含旧建议、最后验证、当前 Chaos 概念、支持表面、验证来源、负责人、替换状态、测试。Epic 官方来源/版本矩阵含 URL/path、版本选择器、成熟度、surface、claims、limitations；社区例子只能作为已引用并拒绝的库存。
## Acceptance
目标硬件要求 60 Hz、physics CPU p95 不超过 3 ms、碰撞/约束不变量及数据包/回放/回滚矩阵。精确符号必须编译，节点/设置必须在声明构建验证。致命停止条件：非有限状态、权威/历史损坏、线程不安全访问、不支持的几何/插件/API、缺少捕获来源、不安全预算超限或不可复现迁移建议。
"""


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold().strip()


def semantic_clauses(text: str) -> list[str]:
    """Split claims at sentence and contrast boundaries while retaining quotations."""
    statements = re.split(r"[。！？!?；;\r\n]+", text)
    clauses = []
    contrast = re.compile(
        r"(?i)(?:,\s*|\s+)(?:but|however|yet)\s+|(?:，|,)?\s*(?:但是|但|然而|不过|却)\s*"
    )
    for statement in statements:
        clauses.extend(part.strip() for part in contrast.split(statement) if part.strip())
    return clauses


NEGATION = re.compile(
    r"(?i)\b(?:not|no|never|cannot|can't|won't|must\s+not|should\s+not|"
    r"do\s+not|does\s+not|is\s+not|are\s+not|without|reject(?:ed)?|"
    r"legacy|removed|unsupported|forbid(?:den)?|insufficient|unable|"
    r"fail(?:s|ed)?\s+to)\b|"
    r"不|非|拒绝|禁止|旧版|遗留|已移除|不支持|无法|不足以|未能|不够"
)

DOUBLE_NEGATION = re.compile(
    r"(?i)\b(?:not\s+(?:insufficient|unable)|do(?:es)?\s+not\s+fail\s+to)\b|"
    r"(?:并非|不是)(?:不足以|无法|未能|不能)"
)


def claim_is_negated(clause: str, match: re.Match[str]) -> bool:
    """Return whether a matched claim is locally denied or explicitly rejected."""
    return span_is_negated(clause, match.start(), match.end())


def span_is_negated(clause: str, start: int, end: int) -> bool:
    """Return whether a source span is locally denied, honoring double negation."""
    window = clause[max(0, start - 32):min(len(clause), end + 32)]
    window = DOUBLE_NEGATION.sub("", window)
    return bool(NEGATION.search(window))


def answer_sections(response: str) -> tuple[bool, dict[str, str]]:
    """Parse the four exact H2 sections and reject all other H1/H2/H3 substitutes."""
    markdown_headings = re.findall(r"(?m)^(#{1,3})[ \t]+([^\r\n]+?)[ \t]*\r?$", response)
    expected = [("##", heading) for heading in HEADINGS]
    bare_required = re.search(
        rf"(?m)^(?:{'|'.join(map(re.escape, HEADINGS))})[ \t]*\r?$",
        response,
    )
    exact = markdown_headings == expected and bare_required is None
    matches = list(
        re.finditer(
            rf"(?m)^## ({'|'.join(map(re.escape, HEADINGS))})[ \t]*\r?$",
            response,
        )
    )
    sections: dict[str, str] = {}
    if len(matches) == len(HEADINGS):
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(response)
            sections[match.group(1)] = response[match.end():end]
    return exact, sections


LEGACY_AFFIRM = re.compile(
    r"(?i)\b(?:use|call|create|obtain|enable|recommend|select|open|run|"
    r"used|called|created|obtained|enabled|recommended)\b|"
    r"使用|调用|创建|取得|启用|建议|选择|打开|运行"
)
LEGACY_DENY = re.compile(
    r"(?i)\b(?:reject(?:ed)?|legacy|removed|unsupported|forbid(?:den)?)\b|"
    r"拒绝|禁止|不要|不得|旧版|遗留|已移除|不支持"
)
COLLECTIVE_OBJECT = re.compile(
    r"(?i)^\s*(?:both|all|them|it|this recommendation|that recommendation|"
    r"the recommendation|the inventory|两者|二者|全部|它们|这些|该建议|该清单)\b"
)


def quoted_legacy_is_denied(surrounding: str, mentioned: list[str]) -> bool:
    """Require an explicit rejection tied to the quoted entity or quotation itself."""
    denial = r"(?:reject(?:ed)?|legacy|removed|unsupported|forbid(?:den)?|拒绝|禁止|旧版|遗留|已移除|不支持)"
    for term in mentioned:
        entity = re.escape(term)
        if re.search(rf"(?i)(?:{denial}).{{0,24}}{entity}|{entity}.{{0,24}}(?:{denial})", surrounding):
            return True
    subject = r"(?:recommendation|inventory|建议|清单)"
    passive = rf"(?i){subject}.{{0,36}}(?:is|are|was|were|已被|被|属于|标记为).{{0,12}}{denial}"
    active_collective = (
        rf"(?i){subject}.{{0,56}}(?:reject|forbid|拒绝|禁止).{{0,16}}"
        r"(?:both|all|them|it|the recommendation|两者|二者|全部|它们|这些|该建议)"
    )
    denial_of_collective = (
        rf"(?i)(?:reject|forbid|拒绝|禁止).{{0,16}}"
        r"(?:both|all|them|it|the recommendation|两者|二者|全部|它们|这些|该建议)"
    )
    adjectival = rf"(?i)(?:legacy|unsupported|旧版|遗留|不支持).{{0,12}}{subject}|{subject}.{{0,12}}(?:legacy|unsupported|旧版|遗留|不支持)"
    return any(re.search(pattern, surrounding) for pattern in (passive, active_collective, denial_of_collective, adjectival))


def has_affirmative_legacy_path(response: str) -> bool:
    """Detect affirmative legacy use without letting another entity's rejection shield it."""
    units = re.split(r"[。！？!?\r\n]+", response)
    quote_pattern = re.compile(r'"([^"\r\n]*)"|“([^”\r\n]*)”')
    for unit in units:
        if not unit.strip():
            continue
        quoted_spans: list[tuple[int, int]] = []
        for quote in quote_pattern.finditer(unit):
            quoted_spans.append(quote.span())
            payload = quote.group(1) if quote.group(1) is not None else quote.group(2)
            mentioned = [term for term in LEGACY if term.casefold() in payload.casefold()]
            if not mentioned or not LEGACY_AFFIRM.search(payload):
                continue
            surrounding = unit[:quote.start()] + unit[quote.end():]
            if not quoted_legacy_is_denied(surrounding, mentioned):
                return True

        unquoted = list(unit)
        for start, end in quoted_spans:
            unquoted[start:end] = " " * (end - start)
        for plain in "".join(unquoted).split("|"):
            positive_cues = list(LEGACY_AFFIRM.finditer(plain))
            denial_cues = list(LEGACY_DENY.finditer(plain))
            entities = sorted(
                (
                    match.start(),
                    match.end(),
                    term,
                )
                for term in LEGACY
                for match in re.finditer(re.escape(term), plain, re.I)
            )
            for start, end, _term in entities:
                positive = min(
                    positive_cues,
                    key=lambda cue: min(abs(cue.end() - start), abs(cue.start() - end)),
                    default=None,
                )
                if positive is None:
                    continue
                positive_distance = min(abs(positive.end() - start), abs(positive.start() - end))
                if positive_distance > 48:
                    continue
                nearest_denial = min(
                    denial_cues,
                    key=lambda cue: min(abs(cue.end() - start), abs(cue.start() - end)),
                    default=None,
                )
                denial_distance = (
                    min(abs(nearest_denial.end() - start), abs(nearest_denial.start() - end))
                    if nearest_denial is not None
                    else 10_000
                )
                passive_denial = re.search(
                    r"(?i)^\s*(?:is|are|was|were|已被|被)?\s*"
                    r"(?:rejected|legacy|removed|unsupported|拒绝|禁止|旧版|遗留|已移除|不支持)",
                    plain[end:end + 48],
                )
                collective_denial = any(
                    cue.start() > end
                    and COLLECTIVE_OBJECT.search(plain[cue.end():cue.end() + 32])
                    for cue in denial_cues
                )
                if denial_distance < positive_distance or passive_denial or collective_denial:
                    continue
                return True
    return False


def read_frontmatter_and_body(path: Path) -> tuple[dict[str, str], str]:
    content = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", content, re.DOTALL)
    if not match:
        raise AssertionError("SKILL.md must have YAML frontmatter")
    fields = {}
    for line in match.group(1).splitlines():
        key, value = line.split(":", 1)
        fields[key] = value.strip().strip('"')
    return fields, match.group(2)


def assert_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter["name"] == "unreal-chaos-physics"
    description = frontmatter["description"]
    assert description.startswith("Use when")
    for trigger in ("Unreal Engine", "Chaos", "UE5", "collision", "async physics", "networked physics", "vehicle", "Physics Asset", "cloth", "flesh", "Geometry Collection", "CVD", "Unreal Insights", "multiplayer"):
        assert trigger in description
    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    assert re.findall(r"^## (.+)$", body, re.MULTILINE) == list(HEADINGS)
    assert "[references/unreal-chaos.md](references/unreal-chaos.md)" in body
    assert "read only" in body.casefold() and "after the gate" in body.casefold()
    for route in ROUTES:
        assert route in body
    for term in APPLIED_OUTPUT_TERMS:
        assert term.casefold() in body.casefold()
    for required in (
        "major/minor/patch", "Launcher or source commit", "platform/build target",
        "enabled plugins", "feature maturity", "Blueprint", "C++", "console/config",
        "editor/debug", "game thread", "physics thread", "async callback",
        "authoritative", "cosmetic", "fixed", "substep", "async",
        "simple-versus-complex", "history", "correction", "replay/resimulation",
        "CVD", "Unreal Insights", "exactly one change", "60 Hz", "p95 <= 3 ms",
        "compile", "fatal-stop", "non-finite", "capture provenance",
    ):
        assert required.casefold() in body.casefold()
    for legacy in LEGACY:
        assert legacy in body
    assert re.search(r"(?:reject|legacy).{0,160}PhysXScene", body, re.IGNORECASE | re.DOTALL)


def response_violations(response: str) -> set[str]:
    """Return semantic failures for the exact held-out pressure scenario."""
    violations = set()
    exact_sections, sections = answer_sections(response)
    if not exact_sections:
        violations.add("sections")
    normalized = normalize(response)
    clauses = semantic_clauses(response)
    if has_affirmative_legacy_path(response):
        violations.add("affirmative-legacy-path")
    action = (
        r"(?:(?i:\b(?:use|call|set|enable|configure|invoke|create|select|open|run|"
        r"used|called|configured|invoked|created|selected|opened|run)\b)|"
        r"使用|调用|设置|启用|配置|创建|选择|打开|运行)"
    )
    surface = (
        r"(?:U[A-Z][A-Za-z_]\w+|F[A-Z][A-Za-z_]\w+|"
        r"[A-Za-z_]\w*::[A-Za-z_]\w*(?:\([^\r\n)]*\))?|"
        r"(?:p|r|np2|Chaos|au|gc|net)\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*=\s*[^\s,;]+)?|"
        r"b[A-Z][A-Za-z0-9_]*\s*=\s*(?i:true|false|0|1)|"
        r"(?:[A-Z][A-Za-z0-9+]*[ \t]+){1,6}Blueprint[ \t]+(?:node|节点)|"
        r"(?i:Project Settings|项目设置)\s*(?:>|/|→))"
    )
    actions = re.compile(action)
    surfaces = re.compile(surface)
    for clause in clauses:
        action_matches = list(actions.finditer(clause))
        for surface_match in surfaces.finditer(clause):
            nearby = [
                match
                for match in action_matches
                if min(
                    abs(match.end() - surface_match.start()),
                    abs(surface_match.end() - match.start()),
                ) <= 70
            ]
            if not nearby:
                continue
            action_match = min(
                nearby,
                key=lambda match: min(
                    abs(match.end() - surface_match.start()),
                    abs(surface_match.end() - match.start()),
                ),
            )
            start = min(action_match.start(), surface_match.start())
            end = max(action_match.end(), surface_match.end())
            if not span_is_negated(clause, start, end):
                violations.add("version-ungated-exact-surface")
                break
        if "version-ungated-exact-surface" in violations:
            break
    bad_patterns = {
        "bitwise-determinism-claim": r"Chaos.{0,50}(?:cross-platform|跨平台).{0,30}(?:bitwise|位级).{0,16}(?:determin|确定)",
        "transform-guarantees-replay": r"(?:replicat\w* transform|复制.{0,12}transform).{0,50}(?:guarantee|保证).{0,30}(?:replay|回放)",
        "async-automatic-claim": r"async physics.{0,40}(?:automatically|always).{0,25}(?:faster|thread-safe)|异步物理.{0,35}(?:自动|必然).{0,20}(?:更快|线程安全)",
        "global-solver-collapse": r"(?:one|一个).{0,16}(?:global|全局).{0,16}(?:solver|求解器).{0,35}(?:vehicle|车辆).{0,60}(?:ragdoll|布娃娃).{0,60}(?:cloth|布料).{0,60}flesh.{0,60}(?:destruction|破坏)",
        "community-as-api-authority": r"(?:forum|community post|论坛|社区帖子).{0,35}(?:proves?|authoritative|current api|当前 api|官方依据)",
    }
    for code, pattern in bad_patterns.items():
        for clause in clauses:
            match = re.search(pattern, clause, re.I)
            if match and not claim_is_negated(clause, match):
                violations.add(code)
                break
    single_signal = re.compile(
        r"(?:(?:CVD|FPS).{0,35}(?:alone|only|单独|仅凭)|"
        r"(?:alone|only|单独|仅凭).{0,15}(?:CVD|FPS)).{0,40}"
        r"(?:proof|prove|sufficient|enough|attribut|证明|归因|足以|足够)",
        re.I,
    )
    for clause in clauses:
        match = single_signal.search(clause)
        if match and not claim_is_negated(clause, match):
            violations.add("single-signal-performance-proof")
            break
    safe_experiment = r"do not|must not|not as a package|not.{0,20}simultaneous|one at a time|一次只|每次只|不得|禁止|不能|不要.{0,120}套餐|不是.{0,30}(?:套餐|同时)|\|\s*rejected\s*\|"
    if any(sum(bool(re.search(term, clause, re.I)) for term in (r"substeps?|子步", r"async|异步", r"iterations?|迭代", r"CCD")) >= 3 and not re.search(safe_experiment, clause, re.I) for clause in clauses):
        violations.add("multi-toggle-fix")
    iteration_prescription = r"(?:(?:set|raise|increase|设为|增加|提高).{0,30}(?:solver )?(?:iterations?|迭代)|(?:solver iterations?|求解器迭代).{0,30}(?:to|at|设为|增加|提高))"
    if any(re.search(iteration_prescription, clause, re.I) and not re.search(r"evidence|measure|experiment|package|证据|测量|实验|套餐|不得|不要", clause, re.I) for clause in clauses):
        violations.add("unevidenced-iteration-count")
    required = {
        "collision-domain": (r"simple.{0,16}complex|简单.{0,16}复杂", r"rigid-body-collision-contact"),
        "constraint-domain": (r"physics asset", r"drive|驱动", r"constraints-ragdolls-active-physics"),
        "schedule-domain": (r"state handoff|状态交接", r"callback|回调", r"architecting-real-time-physics"),
        "network-domain": (r"replication.{0,20}prediction model|复制.{0,20}预测模型|复制/预测模型|server.authoritative.{0,12}(?:model|模型)|服务器权威.{0,12}模型|模型.{0,20}server authority", r"history length|history.{0,6}长度|历史长度", r"correction threshold|correction.{0,6}阈值|纠错阈值|校正阈值", r"event semantics|事件语义", r"packet.fault.{0,8}(?:matrix|矩阵)|数据包故障矩阵|(?:rtt|loss).{0,120}(?:fault matrix|故障矩阵)", r"replay.{0,20}resimulation|回放.{0,20}(?:重模拟|resimulation)|rewind.resimulation", r"networked-deterministic-physics"),
        "vehicle-domain": (r"chaos vehicles|车辆", r"vehicle-physics"),
        "cloth-domain": (r"chaos cloth|布料", r"cloth-rope-soft-bodies"),
        "flesh-domain": (r"chaos flesh|flesh", r"cloth-rope-soft-bodies"),
        "destruction-domain": (r"geometry collection", r"fracture|破碎", r"fields|场", r"destruction-fracture-fields"),
        "character-domain": (r"character|角色", r"character-controller-movement"),
        "research-routes": (r"surveying-real-time-physics-research", r"reproducing-simulation-papers"),
        "paired-evidence": (r"cvd", r"query|查询", r"solver|求解", r"unreal insights", r"p50", r"p95", r"p99", r"exactly one|一次只|单一变化|只有一个变化|只(?:改变|改动|修改)一个(?:变量|因素)", r"capture id|捕获 id"),
        "performance-percentiles": (r"p50", r"p95", r"p99"),
        "migration-ledger": (r"old symbol|old advice|旧符号|旧建议", r"last verified|最后验证", r"current chaos concept|当前 chaos 概念", r"supported surface|支持表面", r"verification source|验证来源", r"owner|负责人", r"replacement status|替换状态", r"test|测试"),
        "source-boundaries": (r"source.{0,20}matrix|来源.{0,20}矩阵", r"version selector|版本选择器|ue\s*5\.8", r"maturity|成熟度", r"surface|表面", r"official.{0,20}epic|epic.{0,20}official|epic.{0,20}官方|官方.{0,20}epic|官方来源|epic ue"),
        "surface-boundaries": (r"blueprint", r"c\+\+", r"console.{0,20}(?:config|variable|setting)|控制台.{0,20}配置|project setting", r"editor.{0,20}(?:debug|path)|编辑器.{0,20}(?:调试|路径)|cvd", r"feature.version.gat|功能.版本.{0,10}门控|版本.构建.功能成熟度.{0,12}门禁|版本.{0,20}门禁"),
        "exact-build-verification": (r"exact symbol.{0,20}compile|精确符号.{0,20}编译|具体.{0,20}(?:c\+\+.)?符号.{0,20}(?:compile|编译)|c\+\+.{0,10}符号.{0,30}编译", r"(?:blueprint.)?node.{0,20}(?:load.execute|verification|verified)|(?:blueprint.)?节点.{0,20}(?:load.execute|验证|加载.{0,8}执行)", r"setting.{0,20}(?:exist|verification|verified|存在|验证)|设置.{0,20}(?:存在|验证)", r"declared build|声明构建|声明 build|该 build"),
        "fatal-stop": (r"fatal.stop|致命停止|致命.{0,6}条件|任一.{0,8}立即停止|立即停止(?:发布|继续调参)", r"non.finite|非有限", r"authority.{0,12}history.{0,12}(?:corruption|损坏)|权威.{0,12}历史.{0,12}损坏", r"thread.unsafe|线程不安全|未证明安全.{0,12}跨线程|跨线程.{0,12}(?:不安全|未证明安全)", r"unsupported.{0,20}geometry.{0,20}plugin.{0,20}api|不支持.{0,20}(?:几何|geometry).{0,20}(?:plugin|插件).{0,20}api|不受支持.{0,20}(?:几何|geometry).{0,20}(?:plugin|插件).{0,20}api", r"missing capture provenance|capture provenance.{0,8}缺失|缺失.{0,8}capture provenance|缺少捕获来源", r"unsafe budget breach|安全预算突破|不安全预算超限|p95.{0,20}(?:超过|超出).{0,40}(?:不安全|backlog|dropped time)", r"irreproducible.{0,8}migration|不可复现.{0,8}迁移|迁移.{0,30}无法.{0,20}复现"),
        "acceptance": (r"60\s*hz", r"p95.{0,12}(?:<=|≤|不超过).{0,6}3\s*ms", r"collision|碰撞|刚体", r"constraint|约束", r"packet|数据包|fault matrix|故障矩阵", r"replay|回放", r"rollback|回滚"),
    }
    network = list(required["network-domain"])
    network[3] += r"|事件.{0,100}(?:唯一\s*id|顺序).{0,30}(?:重复|撤销).{0,20}语义"
    network[4] += r"|网络故障.{0,120}(?:rtt|jitter|loss).{0,120}(?:reorder|duplicate|drop)"
    required["network-domain"] = tuple(network)
    build = list(required["exact-build-verification"])
    build[0] += r"|精确.{0,12}c\+\+\s*symbols?.{0,40}(?:编译|compile)|c\+\+\s*symbols?.{0,40}(?:编译|compile)"
    build[1] += r"|blueprint\s*nodes?.{0,30}加载.{0,10}执行"
    required["exact-build-verification"] = tuple(build)
    fatal = list(required["fatal-stop"])
    fatal[2] += r"|authority.{0,30}(?:input/state\s*)?history.{0,12}(?:corruption|损坏)"
    fatal[7] += r"|迁移建议.{0,100}irreproducible"
    required["fatal-stop"] = tuple(fatal)
    section_requirements = {
        "version-section": (
            "Version gate and ownership",
            (
                r"major/minor/patch",
                r"feature.version.gat|版本.{0,20}门控|版本.{0,20}门禁",
                r"owner|所有权|负责人",
                r"legacy|旧版|遗留",
                r"physxscene",
                r"pvd",
            ),
        ),
        "workflow-section": (
            "Chaos workflow map",
            tuple(re.escape(route) for route in ROUTES)
            + (
                r"simple.{0,16}complex|简单.{0,16}复杂",
                r"plugin.asset.runtime context|插件.资产.运行",
                r"version.maturity boundary|版本.成熟度",
            ),
        ),
        "evidence-section": (
            "Evidence and migration",
            (
                r"cvd",
                r"unreal insights",
                r"p50",
                r"p95",
                r"p99",
                r"capture id",
                r"history length|history.{0,6}长度|历史长度",
                r"correction threshold|correction.{0,6}阈值|纠错阈值|校正阈值",
                r"migration ledger|迁移账本|迁移 ledger",
                r"source.{0,20}matrix|来源.{0,20}矩阵|官方来源.版本.成熟度.表面矩阵",
            ),
        ),
        "acceptance-section": (
            "Acceptance",
            (
                r"60\s*hz",
                r"p95.{0,12}(?:<=|≤|不超过).{0,6}3\s*ms",
                r"exact symbols?.{0,20}(?:compile|编译)|c\+\+.{0,16}symbols?.{0,30}(?:compile|编译)|精确.{0,20}符号.{0,20}编译",
                r"(?:blueprint.{0,12})?(?:nodes?|节点).{0,30}(?:load|execute|verification|加载|执行|验证)|node.setting verification",
                r"fatal.stop|致命停止|fatal stop",
                r"non.finite|非有限",
                r"thread.unsafe|线程不安全",
                r"capture provenance|捕获来源",
            ),
        ),
    }
    for code, (heading, patterns) in section_requirements.items():
        section = normalize(sections.get(heading, ""))
        if any(not re.search(pattern, section, re.I) for pattern in patterns):
            violations.add(code)
    for code, patterns in required.items():
        if any(not re.search(pattern, normalized, re.I) for pattern in patterns):
            violations.add(code)
    return violations


class UnrealChaosPhysicsSkillTests(unittest.TestCase):
    def test_skill_artifacts_are_available(self):
        self.assertTrue(SKILL.is_file(), "unreal-chaos-physics behavior is absent")

    def test_compact_skill_is_a_complete_routing_and_safety_contract(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_skill_contract(frontmatter, body)

    def test_complete_skill_file_is_english_and_at_most_500_words(self):
        content = SKILL.read_text(encoding="utf-8")
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", content)), 500)
        self.assertIsNone(
            re.search(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]", content),
            "the complete SKILL.md, including frontmatter, must be English-only",
        )

    def test_skill_mutations_cannot_drop_version_ownership_routes_or_evidence(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        for required in ("major/minor/patch", "game thread", "simple-versus-complex", "character-controller-movement", "surveying-real-time-physics-research", "CVD", "Unreal Insights", "exactly one change", "p95 <= 3 ms", "fatal-stop"):
            with self.subTest(required=required):
                with self.assertRaises(AssertionError):
                    assert_skill_contract(
                        frontmatter,
                        re.sub(re.escape(required), "", body, flags=re.IGNORECASE),
                    )

    def test_reference_is_deep_task_oriented_and_source_versioned(self):
        reference = REFERENCE.read_text(encoding="utf-8")
        for term in (
            "Applied-answer contract (mandatory)",
            "visible answer content",
            "not background-only guidance",
        ):
            self.assertIn(term, reference)
        expected = ("Source/version and surface matrix", "Reproduction manifest and ownership", "Collision/contact/query/CCD", "Constraints, Physics Assets and ragdolls", "Fixed, substepped and async scheduling", "Networked physics, prediction and resimulation", "Chaos Vehicles", "Chaos Cloth and Flesh", "Geometry Collections, Fracture and Fields", "CVD, Insights, profiling and automation", "PhysX/APEX migration ledger", "Acceptance matrices and core/research routes")
        self.assertEqual(re.findall(r"^## (.+)$", reference, re.M), list(expected))
        for field in ("URL/path", "Page/version selector or source tag/commit", "Access date", "Feature", "Maturity/surface", "Claims used", "Limitations"):
            self.assertIn(field, reference)
        for url in ("physics-in-unreal-engine", "simple-versus-complex-collision-in-unreal-engine", "physics-sub-stepping-in-unreal-engine", "networked-physics-overview", "getting-started-with-chaos-visual-debugger", "timing-insights-in-unreal-engine", "chaos-vehicles", "chaos-flesh-overview", "geometry-collections-user-guide"):
            self.assertIn(url, reference)
        for term in ("plugin/asset/runtime context", "core route", "version/maturity boundary", "simple-versus-complex", "state handoff", "packet-fault", "event semantics", "hash/state", "capture ID", "unsupported", "removed", "experimental", "unknown", "version-specific"):
            self.assertIn(term.casefold(), reference.casefold())

    def test_baseline_is_exact_and_fails_named_flagship_gaps(self):
        raw = BASELINE.read_bytes()
        self.assertEqual(len(raw), 5270)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "12009c5bdb0d79c1d18512b0edfbc3a060133c8caa7e8595c83f20bb1e31f968")
        violations = response_violations(raw.decode("utf-8"))
        self.assertTrue({"collision-domain", "constraint-domain", "schedule-domain", "character-domain", "research-routes", "paired-evidence", "migration-ledger", "source-boundaries", "acceptance"}.issubset(violations), violations)

    def test_attempt1_is_exact_and_truthfully_fails_reviewed_answer_gaps(self):
        raw = ATTEMPT1.read_bytes()
        self.assertEqual(len(raw), 6506)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "0f0c6d530b57c687a085c855c999aa1277270c51cf11071e9c23a5aacda17b3f")
        violations = response_violations(raw.decode("utf-8"))
        self.assertTrue(
            {
                "character-domain", "research-routes", "paired-evidence",
                "migration-ledger", "source-boundaries", "surface-boundaries",
                "network-domain", "exact-build-verification", "fatal-stop",
            }.issubset(violations),
            violations,
        )
        self.assertNotIn("multi-toggle-fix", violations)
        self.assertNotIn("unevidenced-iteration-count", violations)
        self.assertNotIn("version-ungated-exact-surface", violations)

    def test_attempt2_is_exact_and_truthfully_fails_reviewed_answer_gaps(self):
        raw = ATTEMPT2.read_bytes()
        self.assertEqual(len(raw), 3824)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "940260254e4410201d4e6b233532f18f1d34489fc821df97a3e34570da171bb7")
        violations = response_violations(raw.decode("utf-8"))
        self.assertTrue(
            {
                "character-domain", "research-routes", "paired-evidence",
                "performance-percentiles", "migration-ledger", "source-boundaries",
                "surface-boundaries", "network-domain", "exact-build-verification",
                "fatal-stop",
            }.issubset(violations),
            violations,
        )
        self.assertNotIn("affirmative-legacy-path", violations)
        self.assertNotIn("multi-toggle-fix", violations)
        self.assertNotIn("unevidenced-iteration-count", violations)
        self.assertNotIn("version-ungated-exact-surface", violations)

    def test_attempt3_is_exact_and_fails_research_plus_stricter_section_locality(self):
        raw = ATTEMPT3.read_bytes()
        self.assertEqual(len(raw), 10759)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "b742fb4da750400db0ee4196b4d998198c46b5ab6d7f93fe1641a2338c3791ca")
        self.assertEqual(
            response_violations(raw.decode("utf-8")),
            {"research-routes", "version-section", "workflow-section", "acceptance-section"},
        )

    def test_attempt4_is_exact_and_fails_the_stricter_section_locality_gate(self):
        raw = ATTEMPT4.read_bytes()
        self.assertEqual(len(raw), 15402)
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "3e3ec891fcfdc575a3eb301b76dc9de0cbfa43071b14e02fb0590443699e2367")
        response = raw.decode("utf-8")
        self.assertEqual(
            response_violations(response),
            {"workflow-section", "evidence-section", "acceptance-section"},
        )

    def test_attempt5_is_exact_and_clears_the_final_semantic_promotion_gate(self):
        raw = ATTEMPT5.read_bytes()
        self.assertEqual(len(raw), 18116)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "4d6fe1b8e467291f994c1040481d0d56020a309c4a136f613eab6062b2970c82",
        )
        self.assertEqual(response_violations(raw.decode("utf-8")), set())

    def test_semantic_english_and_chinese_compliant_answers_pass(self):
        self.assertEqual(response_violations(COMPLIANT_EN), set())
        self.assertEqual(response_violations(COMPLIANT_ZH), set())
        compact_matrix = COMPLIANT_EN.replace(
            "Use CVD for physics state, query and solver evidence paired with Unreal Insights timing attribution; report p50/p95/p99 and matched capture ID with exactly one change.",
            "| Evidence | CVD: physics state/query/solver | Timing | Unreal Insights attribution: p50, p95, p99 | Experiment | matched capture ID; exactly one change |",
        )
        self.assertEqual(response_violations(compact_matrix), set())

    def test_only_exact_h2_contract_headings_are_accepted(self):
        for label, response in (
            ("h1", COMPLIANT_EN.replace("## ", "# ")),
            ("h3", COMPLIANT_EN.replace("## ", "### ")),
            ("bare", COMPLIANT_EN.replace("## ", "")),
        ):
            with self.subTest(label=label):
                self.assertIn("sections", response_violations(response))

    def test_sections_reject_extra_headings_and_require_local_contract_facts(self):
        structural_mutations = {
            "extra-h2": COMPLIANT_EN + "\n## Extra diagnostics\nOptional notes.\n",
            "extra-h1": COMPLIANT_EN + "\n# Extra diagnostics\nOptional notes.\n",
            "extra-h3": COMPLIANT_EN + "\n### Extra diagnostics\nOptional notes.\n",
            "duplicate-required-h2": COMPLIANT_EN + "\n## Acceptance\nDuplicate.\n",
        }
        for label, response in structural_mutations.items():
            with self.subTest(label=label):
                self.assertIn("sections", response_violations(response))

        sections = {
            heading: COMPLIANT_EN.split(f"## {heading}\n", 1)[1].split("\n## ", 1)[0]
            for heading in HEADINGS
        }
        locality_codes = {
            "Version gate and ownership": "version-section",
            "Chaos workflow map": "workflow-section",
            "Evidence and migration": "evidence-section",
            "Acceptance": "acceptance-section",
        }
        for heading, code in locality_codes.items():
            with self.subTest(heading=heading, control="deleted"):
                deleted = dict(sections)
                deleted[heading] = ""
                response = "\n".join(f"## {name}\n{deleted[name]}" for name in HEADINGS)
                self.assertIn(code, response_violations(response))
            with self.subTest(heading=heading, control="relocated"):
                relocated = dict(sections)
                recipient = next(name for name in HEADINGS if name != heading)
                relocated[recipient] += "\n" + relocated[heading]
                relocated[heading] = ""
                response = "\n".join(f"## {name}\n{relocated[name]}" for name in HEADINGS)
                self.assertIn(code, response_violations(response))

        keyword_dump = re.sub(r"(?m)^## .+\n?", "", COMPLIANT_EN)
        misplaced = (
            f"## {HEADINGS[0]}\n{keyword_dump}\n"
            + "\n".join(f"## {heading}\n" for heading in HEADINGS[1:])
        )
        self.assertTrue(
            {"workflow-section", "evidence-section", "acceptance-section"}.issubset(
                response_violations(misplaced)
            )
        )

    def test_statement_local_polarity_rejects_unsafe_en_zh_recommendations(self):
        mutations = {
            "version-ungated-exact-surface": (
                "Use the Add Force Blueprint node now.",
                "Set Chaos.DebugDraw.Enabled=1 now.",
                "Call UPrimitiveComponent::AddForce() now.",
                "Chaos.DebugDraw.Enabled is now set to 1.",
                "Set bSubstepping=True now.",
                "bSubstepping=False should be configured now.",
                "The Add Force Blueprint node should be used now.",
                "UPrimitiveComponent::AddForce() should be called now.",
                "现在使用 Add Force Blueprint 节点。",
                "现在设置 Chaos.DebugDraw.Enabled=1。",
                "Chaos.DebugDraw.Enabled 现在设置为 1。",
                "bSubstepping=True 现在就配置。",
                "Add Force Blueprint 节点现在就使用。",
            ),
            "affirmative-legacy-path": (
                "Reject PxScene, but use PVD to debug UE5.",
                "Reject PxScene and use PVD to debug UE5.",
                "Use PVD to debug UE5 and reject PxScene.",
                "Use PVD and reject PxScene as legacy inventory.",
                'Recommendation: "Use PVD to debug UE5."',
                'Reject PxScene; recommendation: "Use PVD to debug UE5".',
                'Recommendation: "Use PVD to debug UE5"; reject PxScene.',
                "拒绝 PxScene，但使用 PVD 调试 UE5。",
                "拒绝 PxScene 并使用 PVD 调试 UE5。",
                "使用 PVD 调试 UE5 并拒绝 PxScene。",
                "使用 PVD 并拒绝 PxScene 作为旧版清单。",
                "建议：“使用 PVD 调试 UE5。”",
                "拒绝 PxScene；建议：“使用 PVD 调试 UE5”。",
                "建议：“使用 PVD 调试 UE5”；拒绝 PxScene。",
            ),
            "single-signal-performance-proof": (
                "CVD alone is sufficient for CPU attribution.",
                "仅凭 CVD 足以进行 CPU 归因。",
            ),
        }
        for code, variants in mutations.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    response = COMPLIANT_ZH if re.search(r"[\u4e00-\u9fff]", variant) else COMPLIANT_EN
                    self.assertIn(code, response_violations(f"{response}\n{variant}"))

    def test_statement_local_polarity_allows_negative_and_rejected_en_zh_claims(self):
        controls = {
            "bitwise-determinism-claim": (
                "Chaos is not cross-platform bitwise deterministic.",
                "Chaos 不是跨平台位级确定的。",
            ),
            "transform-guarantees-replay": (
                "Replicated transforms do not guarantee replay consistency.",
                "Replicated transforms are insufficient to guarantee replay consistency.",
                "Replicated transforms are unable to guarantee replay consistency.",
                "Replicated transforms fail to guarantee replay consistency.",
                "复制 transform 不能保证回放一致。",
                "复制 transform 无法保证回放一致。",
                "复制 transform 不足以保证回放一致。",
            ),
            "async-automatic-claim": (
                "Async physics is not automatically faster or thread-safe.",
                "异步物理不会自动更快，也不能保证线程安全。",
            ),
            "global-solver-collapse": (
                "One global solver cannot fix vehicle, ragdoll, cloth, flesh, and destruction.",
                "One global solver is insufficient to fix vehicle, ragdoll, cloth, flesh, and destruction.",
                "One global solver fails to fix vehicle, ragdoll, cloth, flesh, and destruction.",
                "一个全局求解器不能修复车辆、布娃娃、布料、Flesh 和破坏。",
                "一个全局求解器不足以修复车辆、布娃娃、布料、Flesh 和破坏。",
                "一个全局求解器无法修复车辆、布娃娃、布料、Flesh 和破坏。",
            ),
            "community-as-api-authority": (
                "A community post is not authoritative for the current API.",
                "社区帖子不是当前 API 的官方依据。",
            ),
            "affirmative-legacy-path": (
                'Migration inventory: "Use PxScene and PVD"; reject both as legacy guidance.',
                "Reject PxScene and PVD as legacy guidance.",
                'The recommendation "Use PVD to debug UE5" is rejected as legacy guidance.',
                "PVD is unsupported and PxScene is legacy in UE5.",
                "迁移清单引用“使用 PxScene 与 PVD”，并明确拒绝它们作为当前接口。",
                "拒绝 PxScene 与 PVD，二者都是旧版指导。",
                "建议“使用 PVD 调试 UE5”已被明确拒绝为旧版指导。",
                "PVD 不受支持，PxScene 属于旧版接口。",
            ),
            "version-ungated-exact-surface": (
                "Discuss Blueprint, C++, console/config, and editor/debug surfaces without naming exact APIs.",
                "Explain Add Force conceptually without naming a Blueprint node.",
                "bSubstepping is a conceptual configuration field whose exact availability is unknown.",
                "Chaos.DebugDraw.Enabled is feature/version-gated and must be verified in the declared build.",
                "Do not set bSubstepping=True without exact-build evidence.",
                "Set bSubstepping=True is rejected until exact-build verification.",
                "讨论 Blueprint、C++、console/config 与 editor/debug 的概念，不提供精确 API。",
                "Chaos.DebugDraw.Enabled 必须按版本门控，在声明构建验证前不得设置。",
            ),
        }
        for code, variants in controls.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    response = COMPLIANT_ZH if re.search(r"[\u4e00-\u9fff]", variant) else COMPLIANT_EN
                    self.assertNotIn(code, response_violations(f"{response}\n{variant}"))

    def test_double_negation_does_not_disguise_affirmative_en_zh_claims(self):
        mutations = {
            "transform-guarantees-replay": (
                "Replicated transforms are not insufficient to guarantee replay consistency.",
                "Replicated transforms are not unable to guarantee replay consistency.",
                "Replicated transforms do not fail to guarantee replay consistency.",
                "复制 transform 并非不足以保证回放一致。",
                "复制 transform 不是无法保证回放一致。",
                "复制 transform 并非不能保证回放一致。",
            ),
            "global-solver-collapse": (
                "One global solver is not unable to fix vehicle, ragdoll, cloth, flesh, and destruction.",
                "One global solver does not fail to fix vehicle, ragdoll, cloth, flesh, and destruction.",
                "一个全局求解器并非不足以修复车辆、布娃娃、布料、Flesh 和破坏。",
                "一个全局求解器不是无法修复车辆、布娃娃、布料、Flesh 和破坏。",
                "一个全局求解器并非不能修复车辆、布娃娃、布料、Flesh 和破坏。",
            ),
        }
        for code, variants in mutations.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    response = COMPLIANT_ZH if re.search(r"[\u4e00-\u9fff]", variant) else COMPLIANT_EN
                    self.assertIn(code, response_violations(f"{response}\n{variant}"))

    def test_each_required_performance_percentile_is_independent_in_en_and_zh(self):
        for response in (COMPLIANT_EN, COMPLIANT_ZH):
            for percentile in ("p50", "p95", "p99"):
                with self.subTest(language="zh" if response is COMPLIANT_ZH else "en", percentile=percentile):
                    self.assertIn(
                        "performance-percentiles",
                        response_violations(response.replace(percentile, "")),
                    )

    def test_answer_contract_deletions_fail_independently_without_one_template(self):
        deletions = (
            ("CVD for physics state, query and solver evidence paired with Unreal Insights timing attribution", "paired-evidence"),
            ("character/controller -> character-controller-movement", "character-domain"),
            ("old advice, last verified context, current Chaos concept, supported surface, verification source, owner, replacement status and test", "migration-ledger"),
            ("official Epic source/version matrix", "source-boundaries"),
            ("feature/version-gated", "surface-boundaries"),
            ("history length", "network-domain"),
            ("Exact symbols compile and node/setting verification occurs in the declared build", "exact-build-verification"),
            ("Fatal-stop conditions", "fatal-stop"),
        )
        for removed, code in deletions:
            with self.subTest(code=code):
                self.assertIn(code, response_violations(COMPLIANT_EN.replace(removed, "", 1)))

    def test_semantic_gate_rejects_realistic_en_zh_mutations_and_allows_rejection(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        mutations = {
            "affirmative-legacy-path": ("Use PxScene and PVD to debug UE5.", "建议调用 UDestructibleComponent 并启用 APEX Destruction。"),
            "version-ungated-exact-surface": ("Use UChaosWheeledVehicleMovementComponent now.", "设置 p.Chaos.Solver.Iterations=16。"),
            "bitwise-determinism-claim": ("Chaos is cross-platform bitwise deterministic.", "Chaos 能保证跨平台位级确定。"),
            "transform-guarantees-replay": ("Replicated transforms guarantee replay consistency.", "复制 transform 就能保证回放一致。"),
            "single-signal-performance-proof": ("CVD alone proves CPU attribution.", "仅凭 FPS 就能证明性能归因。"),
            "multi-toggle-fix": ("Enable substeps and async, raise iterations, and disable CCD.", "打开子步和异步、提高迭代并关闭 CCD。"),
            "unevidenced-iteration-count": ("Set solver iterations to 16.", "将求解器迭代设为 16。"),
            "async-automatic-claim": ("Async physics is automatically faster and thread-safe.", "异步物理自动更快且线程安全。"),
            "global-solver-collapse": ("One global solver fixes vehicle, ragdoll, cloth, flesh, and destruction.", "一个全局求解器可修复车辆、布娃娃、布料、Flesh 和破坏。"),
            "community-as-api-authority": ("A forum post proves the current API.", "社区帖子是当前 API 的官方依据。"),
        }
        for code, variants in mutations.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    self.assertIn(code, response_violations(f"{baseline}\n{variant}"))
        for allowed in ("Migration inventory: reject PxScene and PVD as legacy.", "迁移清单：拒绝旧版 PxVehicleDrive4W，不得作为当前接口。"):
            self.assertNotIn("affirmative-legacy-path", response_violations(f"{baseline}\n{allowed}"))

    def test_ui_audit_and_promoted_attempt5_are_self_contained(self):
        ui = UI.read_text(encoding="utf-8")
        self.assertIn('display_name: "Unreal Chaos Physics"', ui)
        self.assertIn("$unreal-chaos-physics", ui)
        audit = AUDIT.read_text(encoding="utf-8")
        for term in ("Read on 2026-08-27", "Unreal Engine 5.8 Documentation", "No licensed Epic source checkout", "version-specific"):
            self.assertIn(term, audit)
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "unreal-chaos-physics")
        self.assertEqual(data["scenario"], SCENARIO.read_text(encoding="utf-8").removesuffix("\n"))
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE.read_bytes())
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ATTEMPT5.read_bytes())
        self.assertEqual(data["verdict"], "pass")
        self.assertIn("attempt 5", data["enabled"]["observations"])
        self.assertIn("promoted", data["enabled"]["observations"])
        self.assertEqual(
            data["current_attempt"],
            {
                "attempt": 5,
                "status": "pass",
                "invocation": ATTEMPT5_INVOCATION.relative_to(ROOT).as_posix(),
                "provenance": ATTEMPT5_PROVENANCE.relative_to(ROOT).as_posix(),
                "response": ATTEMPT5.relative_to(ROOT).as_posix(),
            },
        )
        self.assertIn("12009c5bdb0d79c1d18512b0edfbc3a060133c8caa7e8595c83f20bb1e31f968", " ".join(data["evidence"]))
        self.assertIn("0f0c6d530b57c687a085c855c999aa1277270c51cf11071e9c23a5aacda17b3f", " ".join(data["evidence"]))
        self.assertIn("940260254e4410201d4e6b233532f18f1d34489fc821df97a3e34570da171bb7", " ".join(data["evidence"]))
        self.assertIn("b742fb4da750400db0ee4196b4d998198c46b5ab6d7f93fe1641a2338c3791ca", " ".join(data["evidence"]))
        self.assertIn("3e3ec891fcfdc575a3eb301b76dc9de0cbfa43071b14e02fb0590443699e2367", " ".join(data["evidence"]))
        self.assertIn("4d6fe1b8e467291f994c1040481d0d56020a309c4a136f613eab6062b2970c82", " ".join(data["evidence"]))
        self.assertIn("evaluation-harness failure", " ".join(data["evidence"]))

    def test_promoted_attempt5_invocation_response_and_provenance_are_self_contained(self):
        self.assertTrue(ATTEMPT5_INVOCATION.is_file(), "attempt 5 invocation fixture is absent")
        self.assertTrue(ATTEMPT5_PROVENANCE.is_file(), "attempt 5 provenance manifest is absent")
        invocation_raw = ATTEMPT5_INVOCATION.read_bytes()
        provenance = json.loads(ATTEMPT5_PROVENANCE.read_text(encoding="utf-8"))
        self.assertEqual(provenance["attempt"], 5)
        self.assertEqual(provenance["status"], "pass")
        self.assertEqual(provenance["evaluation_date"], "2026-08-28")
        self.assertEqual(provenance["collaboration_task_name"], "/root/task17_enabled_eval5_injected")
        self.assertEqual(
            provenance["evaluator"],
            {"model": "gpt-5.6-sol", "reasoning": "high", "fork_turns": "none"},
        )
        self.assertEqual(
            provenance["isolation"],
            {
                "injected_inputs_only": True,
                "tools": False,
                "browse": False,
                "repository_access": False,
                "prior_attempt_context": False,
            },
        )
        self.assertEqual(provenance["source_snapshot"]["base_commit"], "64fb9a7b02542a0b31c2fe21fb4a45fc2778e85b")
        source_commit = provenance["source_snapshot"]["source_commit"]
        self.assertEqual(source_commit, "d4ca82962daa06b7edba5b33461ef3441302f818")
        self.assertEqual(provenance["invocation"]["path"], ATTEMPT5_INVOCATION.relative_to(ROOT).as_posix())
        self.assertEqual(provenance["invocation"]["bytes"], len(invocation_raw))
        self.assertEqual(provenance["invocation"]["sha256"], hashlib.sha256(invocation_raw).hexdigest())
        self.assertEqual(provenance["result"]["response_path"], ATTEMPT5.relative_to(ROOT).as_posix())
        self.assertEqual(provenance["result"]["response_bytes"], len(ATTEMPT5.read_bytes()))
        self.assertEqual(provenance["result"]["response_sha256"], hashlib.sha256(ATTEMPT5.read_bytes()).hexdigest())
        self.assertEqual(provenance["result"]["semantic_gate_violations"], [])
        self.assertEqual(
            provenance["result"]["preservation_source_path"],
            r"C:\Users\qiupeng\Documents\Codex\2026-08-26\new-chat\.superpowers\sdd\2026-08-26-physics-simulation-superpowers\task-17-enabled-5-exact.txt",
        )
        self.assertEqual(provenance["result"]["external_run_id"], None)
        self.assertIn("None is invented", provenance["result"]["external_run_id_note"])

        component_paths = {
            "scenario": SCENARIO,
            "skill": SKILL,
            "one_level_reference": REFERENCE,
        }
        self.assertEqual(
            {component["role"] for component in provenance["source_snapshot"]["components"]},
            set(component_paths),
        )
        for component in provenance["source_snapshot"]["components"]:
            path = component_paths[component["role"]]
            self.assertTrue(path.is_file())
            self.assertEqual(component["path"], path.relative_to(ROOT).as_posix())

        invocation = invocation_raw.decode("utf-8")
        for phrase in (
            "Do not use tools of any kind.",
            "Do not browse the internet.",
            "Do not read, inspect, or rely on any repository",
            "Do not use or infer from any prior evaluator attempt",
            "Return only the final answer",
            "Write the answer in Chinese.",
            "Do not use H1, H3, bare, renamed, reordered, or additional H2 headings.",
        ):
            self.assertIn(phrase, invocation)
        for heading in HEADINGS:
            self.assertIn(f"`## {heading}`", invocation)

        embedded = (
            ("<<<BEGIN EXACT SKILL.md>>>\n", "<<<END EXACT SKILL.md>>>", SKILL),
            (
                "<<<BEGIN EXACT references/unreal-chaos.md>>>\n",
                "<<<END EXACT references/unreal-chaos.md>>>",
                REFERENCE,
            ),
            (
                "<<<BEGIN EXACT HELD-OUT SCENARIO>>>\n",
                "<<<END EXACT HELD-OUT SCENARIO>>>",
                SCENARIO,
            ),
        )
        for begin, end, path in embedded:
            with self.subTest(path=path.name):
                payload = invocation.split(begin, 1)[1].split(end, 1)[0]
                payload_bytes = payload.encode("utf-8")
                component = next(
                    item
                    for item in provenance["source_snapshot"]["components"]
                    if item["path"] == path.relative_to(ROOT).as_posix()
                )
                self.assertEqual(component["bytes"], len(payload_bytes))
                self.assertEqual(
                    component["sha256"], hashlib.sha256(payload_bytes).hexdigest()
                )

    def test_artifacts_are_staged_and_fresh_git_archive_runs_this_suite(self):
        paths = (
            SKILL, REFERENCE, UI, AUDIT, EVALUATION, SCENARIO, BASELINE,
            ATTEMPT1, ATTEMPT2, ATTEMPT3, ATTEMPT4, ATTEMPT5,
            ATTEMPT5_INVOCATION, ATTEMPT5_PROVENANCE,
        )
        relative = [path.relative_to(ROOT).as_posix() for path in paths]
        if not (ROOT / ".git").exists():
            for item in relative:
                self.assertTrue((ROOT / item).is_file(), item)
            return
        for item in relative:
            tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "--", item], cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(tracked.returncode, 0, item)
        if os.environ.get("TASK17_ARCHIVE_CHECK"):
            return
        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "task17.tar"
            extract = Path(temporary) / "extract"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), tree], cwd=ROOT, check=True)
            with tarfile.open(archive) as contents:
                contents.extractall(extract, filter="data")
            for item in relative:
                self.assertTrue((extract / item).is_file(), item)
            archived = extract / BASELINE.relative_to(ROOT)
            self.assertEqual(len(archived.read_bytes()), 5270)
            self.assertEqual(hashlib.sha256(archived.read_bytes()).hexdigest(), "12009c5bdb0d79c1d18512b0edfbc3a060133c8caa7e8595c83f20bb1e31f968")
            archived_attempt = extract / ATTEMPT1.relative_to(ROOT)
            self.assertEqual(len(archived_attempt.read_bytes()), 6506)
            self.assertEqual(hashlib.sha256(archived_attempt.read_bytes()).hexdigest(), "0f0c6d530b57c687a085c855c999aa1277270c51cf11071e9c23a5aacda17b3f")
            archived_attempt2 = extract / ATTEMPT2.relative_to(ROOT)
            self.assertEqual(len(archived_attempt2.read_bytes()), 3824)
            self.assertEqual(hashlib.sha256(archived_attempt2.read_bytes()).hexdigest(), "940260254e4410201d4e6b233532f18f1d34489fc821df97a3e34570da171bb7")
            archived_attempt3 = extract / ATTEMPT3.relative_to(ROOT)
            self.assertEqual(len(archived_attempt3.read_bytes()), 10759)
            self.assertEqual(hashlib.sha256(archived_attempt3.read_bytes()).hexdigest(), "b742fb4da750400db0ee4196b4d998198c46b5ab6d7f93fe1641a2338c3791ca")
            archived_attempt4 = extract / ATTEMPT4.relative_to(ROOT)
            self.assertEqual(len(archived_attempt4.read_bytes()), 15402)
            self.assertEqual(hashlib.sha256(archived_attempt4.read_bytes()).hexdigest(), "3e3ec891fcfdc575a3eb301b76dc9de0cbfa43071b14e02fb0590443699e2367")
            archived_attempt5 = extract / ATTEMPT5.relative_to(ROOT)
            self.assertEqual(len(archived_attempt5.read_bytes()), 18116)
            self.assertEqual(hashlib.sha256(archived_attempt5.read_bytes()).hexdigest(), "4d6fe1b8e467291f994c1040481d0d56020a309c4a136f613eab6062b2970c82")
            archived_invocation = extract / ATTEMPT5_INVOCATION.relative_to(ROOT)
            self.assertEqual(len(archived_invocation.read_bytes()), 27518)
            self.assertEqual(hashlib.sha256(archived_invocation.read_bytes()).hexdigest(), "d17fd8acac85977e17ef01d54f5e3e2aeb817afd4b89a66345ec3ec9a8a7b931")
            env = os.environ | {"TASK17_ARCHIVE_CHECK": "1"}
            subprocess.run([sys.executable, "-m", "unittest", "tests.test_unreal_chaos_physics_skill"], cwd=extract, env=env, check=True)


if __name__ == "__main__":
    unittest.main()
