"""Focused contract and evidence-regression tests for destruction simulation."""

import hashlib
import json
import re
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "destruction-fracture-fields" / "SKILL.md"
UI = ROOT / "skills" / "destruction-fracture-fields" / "agents" / "openai.yaml"
EVALUATION = ROOT / "evaluations" / "destruction-fracture-fields" / "evaluation.json"
BASELINE_FIXTURE = ROOT / "tests" / "fixtures" / "destruction-fracture-fields-baseline-response.txt"
ATTEMPT1_FIXTURE = ROOT / "tests" / "fixtures" / "destruction-fracture-fields-enabled-attempt-1-response.txt"
ATTEMPT2_FIXTURE = ROOT / "tests" / "fixtures" / "destruction-fracture-fields-enabled-attempt-2-response.txt"
ATTEMPT3_FIXTURE = ROOT / "tests" / "fixtures" / "destruction-fracture-fields-enabled-attempt-3-response.txt"
ENABLED_FIXTURE = ROOT / "tests" / "fixtures" / "destruction-fracture-fields-enabled-response.txt"
SCENARIO = "我在做一款 60 FPS 联机射击游戏：一栋三层建筑预切成约 3000 块，爆炸还会触发运行时二次断裂。现在客户端和服务器都会各自计算 fracture；每个活动碎块以 60 Hz 同步 transform，爆炸后服务器物理 CPU p95 达到 12 ms，带宽暴涨，客户端的裂缝和倒塌顺序也不同。所有碎块都使用高精度凸碰撞并永久参与接触，尘土与小碎屑也由刚体模拟。承重墙删除后，有时整栋楼立即一起掉落，有时悬空很久。团队建议把 solver iterations 降低、把 fracture 搬到 GPU、继续同步所有碎块，再把 debris lifetime 设成 3 秒。请给一个引擎无关、可测试、能在最坏爆炸链中把服务器物理 CPU p95 控制在 3 ms 的方案。项目尚未声明网络/内存预算、玩法必须保留的破坏尺度、可见距离、最大并发爆炸、断裂材料/应变规则、碰撞误差、复制延迟或客户端校正容差。"

HEADINGS = (
    "Destruction contract",
    "Staged build and diagnosis",
    "Authority, budgets, and degradation",
    "Acceptance",
)


def read_frontmatter_and_body(path: Path) -> tuple[dict[str, str], str]:
    content = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", content, re.DOTALL)
    if not match:
        raise AssertionError("SKILL.md must have YAML frontmatter")
    fields: dict[str, str] = {}
    for line in match.group(1).splitlines():
        key, value = line.split(":", 1)
        fields[key] = value.strip().strip('"')
    return fields, match.group(2)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).casefold().strip()


def is_control_clause(text: str) -> bool:
    return bool(
        re.match(r"^(?:a|baseline|control)\s*[:：=＝]", text, re.IGNORECASE)
        or re.search(
            r"(?:a/b|对照).{0,48}\*{0,2}a\*{0,2}\s*[:：=＝]",
            text,
            re.IGNORECASE,
        )
    )


def clauses(text: str) -> list[str]:
    results: list[str] = []
    action = (
        r"(?:set|use|cut|lower|reduce|decrease|raise|increase|move|run|execute|"
        r"offload|put|sync|replicate|stream|send|despawn|disable|author|generate|"
        r"create|compute|将|把|使用|采用|设为|固定|降低|减少|提高|增加|搬|移|"
        r"用|同步|复制|发送|生成|产生|决定|默认|一律|所有|全部)"
    )
    for raw_line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", raw_line)
        if is_control_clause(normalize(line)):
            results.append(normalize(line))
            continue
        for part in re.split(
            rf"(?<=[.!?。！？])\s*|[;；]|"
            rf"\s+(?:and|but|however)\s+(?=(?:(?:do not|don't|never)\s+)?{action})|"
            rf"[,，]\s*(?:但|而|却)?\s*(?=(?:不要|不得|不能|不应)?{action})|"
            rf"\s*[—–]\s*(?:but\s+)?(?=(?:(?:do not|don't|never)\s+)?{action})",
            line,
            flags=re.IGNORECASE,
        ):
            value = normalize(part)
            if value:
                results.append(value)
    return results


def positive_prescription_violations(text: str) -> set[str]:
    """Reject Task 12 shortcuts while allowing negative diagnosis."""
    violations: set[str] = set()
    negation = re.compile(
        r"\b(?:do not|don't|never|not|cannot|can't|reject|avoid|forbid|unjustified)\b|"
        r"不要|不得|不能|不会|绝不|禁止|拒绝|避免|并非|不是|不应|无法|不以|不按",
        re.IGNORECASE,
    )
    measured_qualifier = re.compile(
        r"after.{0,32}(?:measurement|profiling|validation|regression)|"
        r"(?:测量|实测|分析|验证|回归|已声明|声明)后",
        re.IGNORECASE,
    )
    trailing_retraction = re.compile(
        r"^(?:never|absolutely not|no)[.!?]?$|^(?:绝不|不行)[。！？]?$",
        re.IGNORECASE,
    )
    patterns = {
        "positive-solver-prescription": (
            r"(?:set|use|cut|lower|reduce|decrease|raise|increase).{0,32}(?:solver\s*)?iterations?",
            r"(?:solver\s*)?iterations?.{0,24}(?:set|use|cut|lower|reduce|decrease|raise|increase)",
            r"(?:将|把|使用|采用|设为|调低|降低|减少|提高|增加).{0,32}(?:solver iterations?|求解器迭代(?:次数)?|迭代次数)",
            r"(?:solver iterations?|求解器迭代(?:次数)?|迭代次数).{0,24}(?:设为|调低|降低|减少|提高|增加)",
        ),
        "positive-gpu-fracture": (
            r"(?:use|move|run|execute|offload|put).{0,24}(?:fracture|fracturing).{0,16}(?:to|on)\s+(?:the\s+)?gpu",
            r"(?:use|move|run|execute|offload|put).{0,20}(?:gpu).{0,20}(?:fracture|fracturing)",
            r"(?:use|run).{0,20}(?:fracture|fracturing).{0,20}(?:on\s+)?(?:the\s+)?gpu",
            r"(?:把|将).{0,16}(?:fracture|断裂).{0,16}(?:搬|移|放).{0,12}gpu",
            r"(?:用|使用|采用).{0,8}gpu.{0,20}(?:fracture|断裂)",
        ),
        "positive-all-piece-sync": (
            r"(?:sync|replicate|stream).{0,36}(?:all|every).{0,16}(?:pieces?|fragments?).{0,32}(?:60\s*hz|transforms?)",
            r"(?:all|every).{0,16}(?:pieces?|fragments?).{0,28}(?:sync|replicate|stream).{0,20}(?:60\s*hz|transforms?)",
            r"(?:同步|复制).{0,20}(?:所有|全部).{0,12}(?:碎块|碎片).{0,24}(?:60\s*hz|transform|变换)",
            r"(?:所有|全部).{0,12}(?:碎块|碎片).{0,20}(?:以|按).{0,8}60\s*hz.{0,12}(?:同步|复制)",
            r"以每秒\s*60\s*次.{0,12}(?:发送|同步|复制).{0,8}(?:全部|所有).{0,8}(?:碎块|碎片).{0,8}(?:变换|transform)",
        ),
        "positive-three-second-lifetime": (
            r"(?:set|use|fix|keep).{0,30}(?:debris\s*)?lifetime.{0,20}(?:3|three)[ -]seconds?",
            r"(?:set|use|fix|keep).{0,20}(?:3|three)[ -]seconds?.{0,20}(?:debris\s*)?lifetime",
            r"(?:debris\s*)?lifetime.{0,24}(?:set|use|fixed?|kept?).{0,16}(?:3|three)[ -]seconds?",
            r"(?:将|把|使用|采用|设为|固定).{0,30}(?:debris lifetime|残骸生命周期).{0,20}(?:3\s*秒|三秒)",
            r"(?:debris lifetime|残骸生命周期).{0,20}(?:设为|固定为).{0,8}(?:3\s*秒|三秒)",
            r"despawn.{0,16}(?:all|every).{0,8}debris.{0,16}after.{0,8}(?:3|three)[ -]seconds?",
        ),
    }
    text_clauses = clauses(text)
    for index, clause in enumerate(text_clauses):
        if is_control_clause(clause):
            continue
        if negation.search(clause) or measured_qualifier.search(clause):
            continue
        if index + 1 < len(text_clauses) and trailing_retraction.search(text_clauses[index + 1]):
            continue
        for code, variants in patterns.items():
            if any(re.search(pattern, clause, re.IGNORECASE) for pattern in variants):
                violations.add(code)
    return violations


def destruction_response_violations(response: str) -> set[str]:
    """Return scoped failures for the exact Task 12 scenario and mutations."""
    violations = positive_prescription_violations(response)
    normalized = normalize(response)
    response_clauses = clauses(response)

    headings = re.findall(r"(?m)^##[ \t]+(.+?)[ \t]*$", response)
    if headings != list(HEADINGS):
        violations.add("sections")

    prebaked = re.compile(
        r"(?:runtime|secondary).{0,12}fracture.{0,36}(?:only|must|always).{0,24}(?:pre[- ]?(?:baked|fractured)|template)|"
        r"pre[- ]?baked.{0,16}fracture templates?.{0,20}exclusively.{0,16}(?:at|during) runtime|"
        r"(?:运行时|二次).{0,8}断裂.{0,36}(?:只|仅|必须).{0,24}(?:预烘焙|预切|模板)",
        re.IGNORECASE,
    )
    disabled_collision = re.compile(
        r"(?:disable|turn off).{0,28}fragment[- /]?fragment collision.{0,20}(?:by default|always)?|"
        r"(?:默认|一律).{0,12}(?:关闭|禁用).{0,16}(?:碎块|碎片).{0,4}(?:—|-|与).{0,4}(?:碎块|碎片).{0,8}碰撞|"
        r"(?:碎块|碎片).{0,8}之间.{0,8}一律.{0,8}不发生.{0,8}碰撞",
        re.IGNORECASE,
    )
    negation = re.compile(
        r"\b(?:do not|don't|must not|may not|never|not|cannot|can't|reject|unacceptable)\b|"
        r"不要|不得|不能|禁止|拒绝|不应"
    )
    if any(
        not is_control_clause(value)
        and prebaked.search(value)
        and not negation.search(value)
        for value in response_clauses
    ):
        violations.add("prebaked-only-runtime-fracture")
    if any(
        not is_control_clause(value)
        and disabled_collision.search(value)
        and not negation.search(value)
        for value in response_clauses
    ):
        violations.add("unconditional-fragment-collision-disable")

    authority_contradiction = re.compile(
        r"\bclients?\b.{0,24}\b(?:may|can|are allowed to)\b.{0,24}"
        r"(?:independently|independent).{0,20}(?:author|generate|create|compute).{0,20}"
        r"(?:gameplay\s+)?fracture|"
        r"客户端.{0,20}(?:也?可以|可|允许).{0,16}独立.{0,16}"
        r"(?:生成|产生|决定|计算).{0,20}(?:玩法)?断裂(?:真相)?",
        re.IGNORECASE,
    )
    authority_diagnosis = re.compile(
        r"\bcurrent bad (?:behavior|plan|implementation)\b|"
        r"当前(?:错误|有问题的)(?:行为|方案|实现)",
        re.IGNORECASE,
    )
    authority_denial = re.compile(
        r"\bclients?\b.{0,24}(?:\b(?:can't|cannot)\b|\bcan\s+not\b|"
        r"\b(?:may|can)\s+(?:not|never)\b|\bare\s+not\s+allowed\s+to\b|"
        r"\bare\s+allowed\s+to\s+(?:not|never)\b)\s+"
        r"(?:independently|independent).{0,20}"
        r"(?:author|generate|create|compute).{0,20}(?:gameplay\s+)?fracture|"
        r"客户端.{0,20}(?:不可以|不能|不得|不应).{0,16}独立.{0,16}"
        r"(?:生成|产生|决定|计算).{0,20}(?:玩法)?断裂(?:真相)?",
        re.IGNORECASE,
    )
    if any(
        not is_control_clause(value)
        and authority_contradiction.search(value)
        and not authority_denial.search(value)
        and not authority_diagnosis.search(value)
        for value in response_clauses
    ):
        violations.add("authority-contradiction")

    dual_actors_en = (
        r"(?:(?:both\s+)?clients?\b.{0,16}\b(?:the\s+)?server|"
        r"(?:the\s+)?server\b.{0,16}\b(?:both\s+)?clients?)"
    )
    dual_action_en = (
        r"(?:comput(?:e|ing)|determin(?:e|ing)|author(?:ing)?).{0,12}"
        r"(?:authoritative\s+)?(?:fracture(?:\s+(?:topology|truth))?|topology|truth)"
    )
    dual_actors_zh = r"(?:客户端.{0,12}服务器|服务器.{0,12}客户端)"
    dual_action_zh = (
        r"(?:计算|决定|生成|创作).{0,12}(?:权威.{0,4})?"
        r"(?:断裂(?:拓扑|真相)?|拓扑|真相)"
    )
    dual_authority = re.compile(
        rf"\b{dual_actors_en}.{{0,24}}\b(?:independently|separately)\b.{{0,16}}"
        rf"{dual_action_en}|{dual_actors_zh}.{{0,12}}(?:各自|分别|独立).{{0,12}}"
        rf"{dual_action_zh}",
        re.IGNORECASE,
    )
    dual_authority_denial = re.compile(
        rf"\b(?:do not|don't|never)\s+(?:let|allow)\s+{dual_actors_en}.{{0,24}}"
        rf"\b(?:independently|separately)\b.{{0,16}}{dual_action_en}|"
        rf"\b{dual_actors_en}.{{0,16}}(?:must\s+not|should\s+not|can't|cannot|can\s+not)"
        rf"\s+(?:independently|separately)\b.{{0,16}}{dual_action_en}|"
        rf"(?:不要|不得|不能|不应|禁止).{{0,8}}(?:让|允许)?{dual_actors_zh}.{{0,12}}"
        rf"(?:各自|分别|独立).{{0,12}}{dual_action_zh}|"
        rf"{dual_actors_zh}.{{0,8}}(?:不要|不得|不能|不应).{{0,8}}"
        rf"(?:各自|分别|独立).{{0,12}}{dual_action_zh}",
        re.IGNORECASE,
    )
    if any(
        not is_control_clause(value)
        and dual_authority.search(value)
        and not dual_authority_denial.search(value)
        and not authority_diagnosis.search(value)
        for value in response_clauses
    ):
        violations.add("authority-contradiction")

    required_groups = {
        "authority-topology-contract": (
            r"gameplay/cosmetic|玩法[/、和与 ]{0,4}(?:视觉|装饰).{0,8}(?:分层|角色|状态)",
            r"unique authority|唯一.{0,8}权威|单一权威|服务器.{0,16}唯一.{0,50}(?:权威|authority)",
            r"stable asset/cluster/piece ids|资产.{0,20}cluster.{0,20}piece.{0,40}稳定 id|稳定.{0,8}asset/cluster/piece|资产.{0,16}簇.{0,16}碎块.{0,40}稳定 id",
            r"ordered events|有序事件|事件.{0,24}确定顺序|事件.{0,16}(?:全序|有序)|seed.{0,12}全序|事件.{0,60}全局顺序",
            r"seeds?|seed|随机种子",
            r"state checkpoints?|checkpoint",
            r"prefracture/runtime/hybrid|预切.{0,24}(?:二次断裂|运行时断裂)|混合流水线",
        ),
        "support-material-contract": (
            r"rest topology|静止拓扑",
            r"hierarchy/clusters|层级 cluster|层级簇|层级/簇",
            r"bonds/support graph|bond/support graph|支撑图|静态 support graph",
            r"anchored/world supports|世界锚点|世界支撑",
            r"material/damage/strain/fatigue|材料.{0,24}损伤.{0,16}应变.{0,16}疲劳",
            r"runtime-fracture authorization|服务器授权二次断裂|权威端.{0,16}二次断裂|服务器.{0,50}运行时二次断裂.{0,12}权威|服务器授权运行时二次断裂",
        ),
        "timing-mass-contract": (
            r"mass/density/com/inertia|质量.{0,40}(?:质心|com).{0,24}惯量",
            r"fixed dt|固定 60 hz tick|固定.{0,8}(?:tick|时间步)",
            r"render-input/event sampling|输入.{0,16}事件.{0,20}(?:采样|tick 边界)|事件.{0,24}权威 tick",
            r"interpolation|插值",
            r"deterministic/replay scope|确定性范围.{0,80}回放|确定性/重放范围|canonical topology.{0,400}replay|cosmetic debris.{0,32}客户端本地生成.{0,24}视觉不同",
        ),
        "collision-contract": (
            r"collision prox(?:y|ies)|碰撞代理",
            r"filters?|过滤规则|碰撞契约.{0,160}过滤|声明碰撞过滤",
            r"ccd",
            r"contacts/manifolds/islands|contact.{0,24}manifold.{0,24}island",
            r"initial-overlap|初始重叠",
            r"fragment-fragment policy|fragment-fragment.{0,16}(?:是否|policy|接触策略|策略)",
            r"activation/sleep|激活/睡眠|激活.{0,12}睡眠",
            r"separation impulses|分离冲量",
        ),
        "atomic-topology-contract": (
            r"mass/momentum/energy|质量.{0,120}(?:线动量|动量).{0,80}能量",
            r"duplicate events|重复事件|事件重复",
            r"cache invalidation|缓存失效",
            r"atomic commit/rollback|一次性提交.{0,120}(?:撤销|恢复)|事务.{0,300}撤销|原子提交.{0,24}回滚|原子事务.{0,500}commit.{0,80}rollback",
            r"canonical[- ]topology|规范 child topology|规范拓扑",
            r"stable[- ]child ids?|稳定子 id|稳定 child id",
        ),
        "fields-contract": (
            r"shape/frame/falloff/channel/magnitude/duration/order|shape.{0,80}falloff.{0,40}channel.{0,40}magnitude.{0,40}duration.{0,24}顺序",
            r"candidate[- ]filter|候选.{0,40}过滤",
            r"overlap[- ]composition|重叠场.{0,24}组合规则|重叠合成|重叠场.{0,24}组合顺序",
            r"unbounded global loop|无界(?:全局)?循环",
            r"impulse/work/damage|impulse.{0,24}work.{0,24}damage",
        ),
        "lifecycle-contract": (
            r"debris lifecycle/state machine|debris.{0,20}状态机|生命周期.{0,16}状态机|debris lifecycle",
            r"gameplay-safe deactivation|降为 cosmetic 前.{0,40}(?:支撑|碰撞|伤害|计分)|无关对象 sleep/pool.{0,80}降级不得破坏 support",
            r"pooling/caching|pool.{0,40}(?:contact|field|topology)|缓存/池化",
            r"render/physics separation|渲染 lod 与物理 lod 分离|区分渲染与物理对象|cosmetic debris.{0,80}本地生成.{0,80}不参与 damage",
            r"dust/vfx|尘土.{0,40}vfx|小碎屑.{0,40}vfx|vfx.{0,8}尘土",
            r"restoration/checkpoint|恢复.{0,24}checkpoint|checkpoint.{0,40}重建|恢复时校验稳定映射",
        ),
        "budget-contract": (
            r"piece/cluster/contact/query/field/tear-event/active-body caps|piece.{0,40}cluster.{0,40}active body.{0,40}contact.{0,40}query.{0,40}field candidate.{0,40}tear event|piece.{0,40}cluster.{0,40}contact.{0,40}query.{0,40}field candidate.{0,40}tear[- ]?event.{0,40}active[- ]?body",
            r"cpu/memory/network budgets|cpu.{0,32}内存.{0,16}网络预算|cpu.{0,32}memory.{0,16}network|网络带宽.{0,24}预算.{0,16}内存预算",
            r"observables|可观察|记录命中次数|记录状态转换|显式记录 cap hit",
            r"cap hits?|cap hit|上限.{0,12}命中",
        ),
        "replication-degradation-contract": (
            r"tick/id/parameters/seed/order|tick.{0,40}稳定 id.{0,24}参数.{0,24}seed.{0,24}顺序|事件.{0,16}tick.{0,16}稳定 id.{0,8}参数.{0,8}seed.{0,8}全序",
            r"gameplay bodies|玩法意义.{0,12}刚体|gameplay-body",
            r"cosmetic debris|纯视觉.{0,12}碎屑|尘土.{0,30}本地生成",
            r"reversible|可逆",
            r"preserve supports/gameplay collision/damage/event order/recoverable state|保持支撑.{0,24}玩法碰撞.{0,16}事件顺序|保留支撑正确性.{0,24}gameplay collision.{0,16}damage.{0,16}事件顺序.{0,16}可恢复状态|降级不得破坏 support.{0,16}gameplay collision.{0,16}damage.{0,24}事件顺序.{0,24}可恢复性",
        ),
    }
    for code, patterns in required_groups.items():
        if any(not re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns):
            violations.add(code)

    lifecycle_lines = [
        normalize(line)
        for line in response.splitlines()
        if re.search(
            r"debris.{0,32}(?:lifecycle|state machine|状态机)|生命周期.{0,24}状态机|生命周期契约",
            line,
            re.IGNORECASE,
        )
    ]
    lifecycle_states = (
        r"gameplay",
        r"cosmetic",
        r"sleeping|睡眠",
        r"pooled|pool|池化",
        r"despawned|despawn|销毁",
    )
    if not any(
        all(re.search(pattern, line, re.IGNORECASE) for pattern in lifecycle_states)
        for line in lifecycle_lines
    ):
        violations.add("lifecycle-states")

    direct_safe_deactivation = re.search(
        r"gameplay-safe deactivation|降为 cosmetic 前.{0,40}(?:支撑|碰撞|伤害|计分)",
        normalized,
        re.IGNORECASE,
    )
    irrelevant_pooling = re.search(r"无关对象 sleep/pool", normalized, re.IGNORECASE)
    preserved_gameplay = re.search(
        r"降级不得破坏 support.{0,16}gameplay collision.{0,16}damage",
        normalized,
        re.IGNORECASE,
    )
    if not direct_safe_deactivation and not (irrelevant_pooling and preserved_gameplay):
        violations.add("lifecycle-safety")

    if not re.search(
        r"60[- ]?hz fixed tick|fixed 60[- ]?hz tick|固定.{0,8}60\s*hz.{0,8}(?:物理\s*)?tick|60\s*hz.{0,16}physics fixed tick",
        normalized,
        re.IGNORECASE,
    ):
        violations.add("fixed-60hz-tick")

    blocker_categories = {
        "topology": r"topology|拓扑|断裂方法",
        "gameplay": r"gameplay scale|玩法尺度|玩法.{0,16}破坏尺度|gameplay.{0,16}破坏尺度",
        "concurrency": r"concurrency|并发",
        "network": r"network|网络",
        "memory": r"memory|内存",
        "error": r"error|误差",
        "material": r"material|材料",
    }
    blocker_scopes: list[str] = []
    for line in response_clauses:
        if re.search(
            r"block.{0,24}tuning.{0,24}acceptance|"
            r"阻塞.{0,16}调参.{0,16}验收|调优.{0,12}验收.{0,12}blocker",
            line,
        ):
            blocker_scopes.append(line)

    for raw_line in response.splitlines():
        line = normalize(raw_line)
        if (
            "当前阻塞项包括" in line
            and re.search(r"补齐前不得选择.{0,80}保证\s*3\s*ms", line)
        ) or (
            "缺少其中任一项" in line
            and re.search(r"阻塞.{0,16}调参.{0,16}验收", line)
        ):
            blocker_scopes.append(line)

    blocker_list = re.search(
        r"(?m)^目前以下缺失项是调优和验收 blocker：\r?\n(?:\r?\n)?"
        r"(?P<items>(?:^- [^\r\n]*(?:\r?\n|$))+)(?:\r?\n)?"
        r"(?P<conclusion>^这些数值必须[^\r\n]*没有它们[^\r\n]*不能声称[^\r\n]*)",
        response,
    )
    if blocker_list:
        blocker_scopes.append(
            normalize(blocker_list.group("items") + " " + blocker_list.group("conclusion"))
        )

    required_blockers = dict(blocker_categories)
    if re.search(
        r"使用 hybrid destruction|采用.{0,32}hybrid",
        normalized,
        re.IGNORECASE,
    ):
        required_blockers.pop("topology")
    blocker_scope = " ".join(blocker_scopes)
    if not blocker_scope or any(
        not re.search(pattern, blocker_scope)
        for pattern in required_blockers.values()
    ):
        violations.add("decision-blockers")

    stages = (
        r"freeze one server gameplay authority|服务器设为唯一的玩法破坏权威|冻结服务器为唯一 gameplay 权威|固定一个服务器 gameplay authority.{0,16}60 hz physics fixed tick",
        r"validate intact mass/inertia/collision and static support graph|先验证完整建筑的质量、惯量和碰撞|验证完整建筑的质量.{0,20}惯量.{0,12}碰撞.{0,16}静态支撑图|完整建筑.{0,40}质量.{0,24}惯量.{0,16}碰撞代理.{0,40}support",
        r"validate hierarchy/bonds without secondary fracture|验证层级/bond 且暂时关闭二次断裂|加入层级.{0,16}bond.{0,16}不启用二次断裂|加入预切层级簇.{0,16}bonds.{0,16}关闭运行时二次断裂",
        r"add authorized runtime fracture once on authority|只在权威端启用一次二次断裂|只允许服务器触发一次.{0,24}运行时断裂|只允许一次服务器授权.{0,16}runtime fracture",
        r"add collision from coarse clusters to bounded fragments|加入碰撞细化|碰撞从粗 cluster.{0,24}细化.{0,24}gameplay fragments|碰撞从粗簇.{0,24}有界 gameplay fragments",
        r"add one field channel at a time|单一场通道|每次只加入一个场 channel|一次加入一个 field channel",
        r"add debris lifecycle and replication tiers|debris 生命周期和复制分层|加入 gameplay/cosmetic 分区.{0,80}分层复制|加入 replication tiers 和 debris lifecycle",
        r"stress the worst concurrent chain|最坏并发爆炸链",
    )
    stage_matches = [re.search(pattern, normalized, re.IGNORECASE) for pattern in stages]
    if any(match is None for match in stage_matches):
        violations.add("staged-order")
    elif [match.start() for match in stage_matches if match] != sorted(match.start() for match in stage_matches if match):
        violations.add("staged-order")

    acceptance_match = re.search(
        r"(?ms)^##[ \t]+(?:Acceptance|[^\n]*(?:A/B|a/b)[^\n]*)\r?\n(.*)\Z",
        response,
        re.IGNORECASE,
    )
    acceptance_raw = acceptance_match.group(1) if acceptance_match else ""
    acceptance = normalize(acceptance_raw)
    acceptance_patterns = (
        r"identical-seed/input a/b|a/b.{0,100}相同资产.{0,40}seed.{0,40}输入|同 seed、同输入 a/b|相同的资产.{0,16}seed.{0,16}输入.{0,40}a/b",
        r"b=staged authoritative events \+ gameplay/cosmetic partition|b：.{0,80}服务器单一权威.{0,40}有序事件复制.{0,40}玩法/视觉分层|\*{0,2}b\*{0,2}＝.{0,48}服务器权威事件.{0,32}gameplay/cosmetic 分区|b：上述分阶段服务器权威事件架构.{0,24}gameplay/cosmetic 分区",
        r"single-support removal|单一支撑删除|单支撑删除",
        r"below/above-threshold damage|低于和高于材料阈值|低于/高于损伤阈值|阈值以下/以上损伤",
        r"ordered simultaneous hits|同 tick 有序命中|有序同时命中",
        r"progressive collapse|渐进倒塌",
        r"runtime secondary fracture|运行时二次断裂",
        r"overlapping directional/radial fields|重叠 radial/directional fields|重叠方向场与径向场|重叠方向/径向场",
        r"worst concurrent explosion chain|最坏并发爆炸链",
        r"join-in-progress/checkpoint|加入中 checkpoint|加入中途/checkpoint",
        r"packet delay/loss/reorder|延迟、丢包.{0,16}乱序|包延迟、丢失和乱序",
        r"support/bond/connectivity/island|support/bond/connectivity/island 状态|anchor/world support.{0,24}bond 状态.{0,24}connectivity.{0,24}island|support.{0,12}bond.{0,12}connectivity.{0,12}island 状态",
        r"damage/strain/fatigue|damage.{0,16}strain.{0,16}fatigue",
        r"topology/cluster/piece|topology、cluster、piece|canonical topology/hash.{0,16}cluster/piece",
        r"mass/momentum/energy/work|质量.{0,80}动量.{0,40}能量.{0,40}功|拆分前后质量.{0,60}动量.{0,24}动能.{0,24}做功|质量.{0,60}线/角动量.{0,24}能量.{0,24}work",
        r"proxy[- ]error/penetration/ccd|碰撞代理误差.{0,20}穿透.{0,20}ccd|代理误差.{0,12}穿透.{0,12}ccd|collision proxy error.{0,16}penetration.{0,16}ccd",
        r"contacts/manifolds/islands/cap hits|contact/manifold/island 数|contacts.{0,12}manifolds.{0,12}islands.{0,24}cap hits",
        r"lifecycle transitions|active/sleep/pool/despawn counts/transitions|active/sleep/pool/despawn counts|debris 状态转换|分开的 active.{0,16}sleep.{0,16}pool.{0,16}despawn.{0,16}数量.{0,16}状态转换",
        r"field[- ]candidates/order/impulse|field 候选数.{0,20}顺序.{0,20}impulse|候选数量.{0,32}channel/order.{0,32}impulse|field candidates.{0,24}顺序.{0,24}impulse",
        r"correction[- ]error/delay|客户端校正误差与延迟|correction error.{0,16}correction delay",
        r"bytes/event/bandwidth|每事件字节数.{0,40}带宽|bytes/event.{0,24}bandwidth",
        r"memory|内存",
        r"cpu p50/p95/p99|cpu p50、p95、p99",
        r"cpu p95 <=3 ms|cpu p95 不超过 3 ms|cpu p95 ≤ 3 ms",
    )
    if any(not re.search(pattern, acceptance) for pattern in acceptance_patterns):
        violations.add("acceptance-evidence")

    world_contract = (
        r"units/gravity/scale|world units|世界单位|物理单位|单位制|单位契约|长度/质量/时间单位",
        r"gravity|重力",
        r"units/gravity/scale|world scale|世界尺度|单位比例|资产导入缩放|资产缩放",
        r"density|密度",
    )
    if any(not re.search(pattern, normalized) for pattern in world_contract):
        violations.add("world-units-gravity-density-contract")

    a_match = re.search(
        r"(?is)\*{0,2}\ba\*{0,2}\s*[:：=＝](.*?)(?=\*{0,2}\bb\*{0,2}\s*[:：=＝])",
        acceptance_raw,
    )
    a_text = normalize(a_match.group(1)) if a_match else ""
    a_scope = (
        r"a=current independent client/server fracture|a：.{0,40}双端各自 fracture|a=当前客户端与服务器各自 fracture|a=当前客户端/服务器各自 fracture",
        r"60-hz all-piece transforms|所有活动碎块.{0,16}60 hz.{0,16}transform|所有碎块.{0,8}60 hz transform 同步",
        r"permanent detailed rigid/dust|永久高精度刚体.{0,24}尘土|永久保留高细节.{0,24}刚体.{0,24}尘土|所有高精度碎块.{0,24}刚体尘土.{0,16}永久参与接触",
        r"magic solver/gpu/lifetime|solver.{0,80}gpu.{0,80}(?:lifetime|3 秒)",
    )
    if not a_match or any(not re.search(pattern, f"a={a_text}") for pattern in a_scope):
        violations.add("ab-scope")

    acceptance_metrics = (
        r"stable-id errors?|稳定 id 错误|稳定 id 冲突",
        r"first replay-divergence tick|首次(?:回放|重放|replay)?分歧 tick",
        r"active/sleep/pool/despawn counts|活跃.{0,30}睡眠.{0,30}pool.{0,30}despawn.{0,20}(?:数量|计数)|active.{0,16}sleep.{0,16}pool.{0,16}despawn.{0,16}数量",
    )
    if any(not re.search(pattern, acceptance) for pattern in acceptance_metrics):
        violations.add("acceptance-metrics")

    if not re.search(r"ordinary reject|普通拒绝|\*\*reject\*\*.{0,40}非致命", acceptance):
        violations.add("ordinary-reject")
    if not (re.search(r"fatal stop", acceptance) and re.search(r"roll ?back", acceptance)):
        if not (re.search(r"致命停止", acceptance) and re.search(r"回滚", acceptance)):
            violations.add("fatal-stop-rollback")
    return violations


def assert_destruction_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter["name"] == "destruction-fracture-fields"
    description = frontmatter["description"]
    assert description.startswith("Use when")
    for trigger in (
        "destruction", "fracture", "debris", "clustering", "support graph", "damage",
        "strain", "field", "cache", "network", "破坏", "断裂", "碎块", "支撑图",
        "应变", "损伤", "场", "残骸",
    ):
        assert trigger in description
    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    assert re.findall(r"^## (.+)$", body, re.MULTILINE) == list(HEADINGS)
    for required in (
        "primary fracture/destruction",
        "support-graph",
        "rigid-clustering",
        "damage/strain/field",
        "networking literature",
        "A=current independent client/server fracture + 60-Hz all-piece transforms + permanent detailed rigid/dust + magic solver/GPU/lifetime",
        "B=staged authoritative events + gameplay/cosmetic partition",
    ):
        assert required in body
    assert destruction_response_violations(body) == set()
    assert positive_prescription_violations(body) == set()
    for api_symbol in (
        "GeometryCollection", "UChaosDestructionListener", "UnityEngine", "PhysX",
        "PxScene", "JPH::", "RigidBody3D", "Rapier",
    ):
        assert api_symbol not in body


class DestructionFractureFieldsSkillTests(unittest.TestCase):
    def test_skill_exposes_complete_engine_neutral_contract(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_destruction_skill_contract(frontmatter, body)

    def test_contract_mutations_cannot_drop_required_decisions_or_outcomes(self):
        _, body = read_frontmatter_and_body(SKILL)
        mutations = (
            "prefracture/runtime/hybrid",
            "60-Hz fixed tick",
            "bonds/support graph",
            "mass/momentum/energy",
            "atomic commit/rollback",
            "shape/frame/falloff/channel/magnitude/duration/order",
            "debris lifecycle/state machine",
            "CPU/memory/network budgets",
            "Ordinary reject",
            "Fatal stop and roll back",
        )
        for phrase in mutations:
            with self.subTest(phrase=phrase):
                mutated = body.replace(phrase, "")
                self.assertNotEqual(mutated, body)
                self.assertTrue(destruction_response_violations(mutated))

    def test_each_unknown_decision_independently_blocks_tuning_and_acceptance(self):
        _, body = read_frontmatter_and_body(SKILL)
        blocker = "Unknown topology, gameplay scale, concurrency, network, memory, error, and material decisions block tuning and acceptance."
        self.assertIn(blocker, body)
        for term in ("topology", "gameplay scale", "concurrency", "network", "memory", "error", "material"):
            with self.subTest(term=term):
                mutated_blocker = blocker.replace(term, "", 1)
                mutated = body.replace(blocker, mutated_blocker, 1)
                self.assertIn("decision-blockers", destruction_response_violations(mutated))

    def test_attempt3_blocker_scope_cannot_borrow_categories_from_other_sections(self):
        response = ATTEMPT3_FIXTURE.read_text(encoding="utf-8")
        blocker = """目前以下缺失项是调优和验收 blocker：

- 网络带宽与事件/状态预算、内存预算；
- 必须保留的 gameplay 破坏尺度及 gameplay/cosmetic 分界；
- 可见距离、相关性和 LOD 规则；
- 最大并发爆炸及最坏链定义；
- 各材料的 bond、damage、strain、fatigue、断裂阈值与 hysteresis；
- 允许的代理误差、穿透、CCD 漏检和接触误差；
- 复制延迟、丢包/乱序恢复以及客户端校正容差；
- piece、cluster、contact、query、field candidate、tear-event、active-body 的有限 caps。
"""
        self.assertIn(blocker, response)
        mutations = {
            "gameplay": blocker.replace(
                "- 必须保留的 gameplay 破坏尺度及 gameplay/cosmetic 分界；\n", ""
            ),
            "concurrency": blocker.replace(
                "- 最大并发爆炸及最坏链定义；\n", ""
            ),
            "network": blocker.replace(
                "网络带宽与事件/状态预算、", ""
            ).replace("- 复制延迟、丢包/乱序恢复以及客户端校正容差；\n", ""),
            "memory": blocker.replace("内存预算", ""),
            "error": blocker.replace(
                "- 允许的代理误差、穿透、CCD 漏检和接触误差；\n", ""
            ).replace("以及客户端校正容差", ""),
            "material": blocker.replace(
                "- 各材料的 bond、damage、strain、fatigue、断裂阈值与 hysteresis；\n",
                "",
            ),
        }
        for category, mutated_blocker in mutations.items():
            with self.subTest(category=category):
                mutated = response.replace(blocker, mutated_blocker, 1)
                self.assertIn("decision-blockers", destruction_response_violations(mutated))

    def test_primary_source_scope_and_exact_ab_sides_are_deletion_protected(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        phrases = (
            "primary fracture/destruction",
            "support-graph",
            "rigid-clustering",
            "damage/strain/field",
            "networking literature",
            "A=current independent client/server fracture + 60-Hz all-piece transforms + permanent detailed rigid/dust + magic solver/GPU/lifetime",
            "B=staged authoritative events + gameplay/cosmetic partition",
        )
        for phrase in phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                with self.assertRaises(AssertionError):
                    assert_destruction_skill_contract(frontmatter, body.replace(phrase, "", 1))

    def test_positive_shortcuts_reject_in_english_and_chinese(self):
        cases = {
            "Lower solver iterations.": "positive-solver-prescription",
            "Use six solver iterations.": "positive-solver-prescription",
            "把 solver iterations 降低。": "positive-solver-prescription",
            "将求解器迭代次数设为 6。": "positive-solver-prescription",
            "Move fracture to the GPU.": "positive-gpu-fracture",
            "Run fracture on GPU.": "positive-gpu-fracture",
            "把 fracture 搬到 GPU。": "positive-gpu-fracture",
            "使用 GPU 做断裂。": "positive-gpu-fracture",
            "Synchronize every fragment transform at 60 Hz.": "positive-all-piece-sync",
            "Stream all pieces at 60 Hz.": "positive-all-piece-sync",
            "同步所有碎块 transform，频率为 60 Hz。": "positive-all-piece-sync",
            "所有碎片都以 60 Hz 同步。": "positive-all-piece-sync",
            "Set debris lifetime to 3 seconds.": "positive-three-second-lifetime",
            "Use a three-second debris lifetime.": "positive-three-second-lifetime",
            "把 debris lifetime 设为 3 秒。": "positive-three-second-lifetime",
            "残骸生命周期固定为三秒。": "positive-three-second-lifetime",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

    def test_reviewer_shortcut_vocabulary_is_rejected_exactly(self):
        positive_cases = {
            "Cut solver iterations to four to meet the budget.": "positive-solver-prescription",
            "Use GPU fracture to cure the server CPU spike.": "positive-gpu-fracture",
            "以每秒 60 次的频率发送全部碎块变换。": "positive-all-piece-sync",
            "Despawn all debris after three seconds.": "positive-three-second-lifetime",
        }
        for text, expected in positive_cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

        scoped_cases = {
            "Use pre-baked fracture templates exclusively at runtime.":
                "prebaked-only-runtime-fracture",
            "碎块之间一律不发生碰撞。":
                "unconditional-fragment-collision-disable",
        }
        for text, expected in scoped_cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, destruction_response_violations(text))

        mixed = "Do not lower solver iterations and run fracture on the GPU."
        violations = positive_prescription_violations(mixed)
        self.assertNotIn("positive-solver-prescription", violations)
        self.assertIn("positive-gpu-fracture", violations)

    def test_reviewer_vocabulary_true_negatives_and_control_arms_are_allowed(self):
        negatives = (
            "Do not cut solver iterations and do not run fracture on the GPU.",
            "Never despawn all debris after three seconds.",
            "不要以每秒 60 次的频率发送全部碎块变换。",
            "不要在运行时只使用预烘焙断裂模板。",
            "碎块之间不应一律不发生碰撞。",
        )
        for text in negatives:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())
                self.assertFalse(
                    {
                        "prebaked-only-runtime-fracture",
                        "unconditional-fragment-collision-disable",
                    }
                    & destruction_response_violations(text)
                )

        control = (
            "A: Cut solver iterations to four, use GPU fracture, send all fragment "
            "transforms 60 times per second, and despawn all debris after three seconds."
        )
        self.assertEqual(positive_prescription_violations(control), set())

    def test_appended_authority_contradictions_fail_outside_controls_or_diagnosis(self):
        response = ATTEMPT3_FIXTURE.read_text(encoding="utf-8")
        positives = (
            "Clients may independently author gameplay fracture whenever latency is high.",
            "Clients may independently author gameplay fracture and do not require server approval.",
            "Clients may, not servers, independently author gameplay fracture.",
            "高延迟时客户端也可以独立生成玩法断裂真相。",
        )
        for text in positives:
            with self.subTest(text=text):
                self.assertIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )

        denials = (
            "Clients must not independently author gameplay fracture when latency is high.",
            "Clients may not independently author gameplay fracture without server approval.",
            "Clients can't independently author gameplay fracture.",
            "Clients cannot independently author gameplay fracture.",
            "Clients can not independently author gameplay fracture.",
            "高延迟时客户端也不能独立生成玩法断裂真相。",
            "客户端不可以独立生成玩法断裂真相。",
            "A: Clients may independently author gameplay fracture whenever latency is high.",
        )
        for text in denials:
            with self.subTest(text=text):
                self.assertNotIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )

        diagnoses = (
            (
                "Current bad behavior: clients may independently author gameplay fracture.",
                "Current bad behavior: ",
            ),
            (
                "当前错误行为：客户端可以独立生成玩法断裂真相。",
                "当前错误行为：",
            ),
        )
        for text, prefix in diagnoses:
            with self.subTest(text=text):
                self.assertNotIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )
                self.assertIn(
                    "authority-contradiction",
                    destruction_response_violations(
                        response + "\n" + text.removeprefix(prefix)
                    ),
                )

    def test_scenario_core_dual_authority_rejects_only_positive_instructions(self):
        response = ATTEMPT3_FIXTURE.read_text(encoding="utf-8")
        positives = (
            "Let both clients and the server independently compute authoritative fracture topology.",
            "Both clients and the server should independently compute authoritative fracture topology.",
            "让客户端和服务器各自计算权威断裂拓扑。",
        )
        for text in positives:
            with self.subTest(text=text):
                self.assertIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )

        allowed = (
            "A: Let both clients and the server independently compute authoritative fracture topology.",
            "Do not let both clients and the server independently compute authoritative fracture topology.",
            "Both clients and the server should not independently compute authoritative fracture topology.",
            "不要让客户端和服务器各自计算权威断裂拓扑。",
        )
        for text in allowed:
            with self.subTest(text=text):
                self.assertNotIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )

        diagnoses = (
            (
                "Current bad behavior: both clients and the server should independently compute authoritative fracture topology.",
                "Current bad behavior: ",
            ),
            (
                "当前错误行为：让客户端和服务器各自计算权威断裂拓扑。",
                "当前错误行为：",
            ),
        )
        for text, prefix in diagnoses:
            with self.subTest(text=text):
                self.assertNotIn(
                    "authority-contradiction",
                    destruction_response_violations(response + "\n" + text),
                )
                self.assertIn(
                    "authority-contradiction",
                    destruction_response_violations(
                        response + "\n" + text.removeprefix(prefix)
                    ),
                )

    def test_negative_diagnosis_of_shortcuts_is_allowed(self):
        cases = (
            "Do not lower solver iterations as a shortcut.",
            "Moving fracture to the GPU is not justified without evidence.",
            "Never synchronize every fragment transform at 60 Hz.",
            "Do not set debris lifetime to 3 seconds.",
            "不要降低 solver iterations 来掩盖问题。",
            "把 fracture 搬到 GPU 并不能消除网络和接触成本。",
            "不得以 60 Hz 同步所有碎块 transform。",
            "不能把 debris lifetime 设为 3 秒。",
        )
        for text in cases:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

    def test_negative_clause_cannot_mask_a_later_positive_prescription(self):
        cases = {
            "Do not lower solver iterations; move fracture to the GPU.": "positive-gpu-fracture",
            "Do not move fracture to the GPU, synchronize every fragment transform at 60 Hz.": "positive-all-piece-sync",
            "Never stream all pieces at 60 Hz — set debris lifetime to 3 seconds.": "positive-three-second-lifetime",
            "不要降低 solver iterations；把 fracture 搬到 GPU。": "positive-gpu-fracture",
            "不要把 fracture 搬到 GPU，所有碎片都以 60 Hz 同步。": "positive-all-piece-sync",
            "不得以 60 Hz 同步所有碎块 transform；把 debris lifetime 设为 3 秒。": "positive-three-second-lifetime",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

    def test_trailing_negative_retractions_preserve_diagnosis(self):
        cases = (
            "Lower solver iterations? Never.",
            "Move fracture to the GPU? Absolutely not.",
            "Synchronize every fragment transform at 60 Hz? No.",
            "Set debris lifetime to 3 seconds? Never.",
            "降低 solver iterations？绝不。",
            "把 fracture 搬到 GPU？绝不。",
            "所有碎片都以 60 Hz 同步？不行。",
            "把 debris lifetime 设为 3 秒？绝不。",
        )
        for text in cases:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

    def test_prebaked_only_and_unconditional_collision_policy_are_rejected(self):
        cases = {
            "Runtime fracture must only use pre-baked templates.": "prebaked-only-runtime-fracture",
            "运行时断裂只允许使用预烘焙模板。": "prebaked-only-runtime-fracture",
            "Disable fragment-fragment collision by default.": "unconditional-fragment-collision-disable",
            "默认关闭碎块—碎块碰撞。": "unconditional-fragment-collision-disable",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, destruction_response_violations(text))

    def test_baseline_is_exact_and_fails_named_scoped_gates(self):
        raw = BASELINE_FIXTURE.read_bytes()
        self.assertEqual(len(raw), 6149)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "557f06040dc668f9c78093f604b8c81b04672839e98b73126d9397a66112d846",
        )
        baseline = raw.decode("utf-8")
        violations = destruction_response_violations(baseline)
        self.assertTrue(
            {
                "prebaked-only-runtime-fracture",
                "unconditional-fragment-collision-disable",
                "sections",
                "atomic-topology-contract",
                "fields-contract",
                "lifecycle-contract",
                "decision-blockers",
                "ordinary-reject",
                "fatal-stop-rollback",
            }.issubset(violations)
        )

    def test_evaluation_preserves_exact_baseline(self):
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "destruction-fracture-fields")
        self.assertEqual(data["scenario"], SCENARIO)
        self.assertEqual(data["baseline"]["response"].encode("utf-8"), BASELINE_FIXTURE.read_bytes())

    def test_first_enabled_attempt_fails_only_actual_scoped_gaps(self):
        response = ATTEMPT1_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(
            destruction_response_violations(response),
            {
                "sections",
                "world-units-gravity-density-contract",
                "ab-scope",
                "acceptance-metrics",
            },
        )

    def test_first_enabled_attempt_is_exact_and_truthfully_archived(self):
        raw = ATTEMPT1_FIXTURE.read_bytes()
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 9585)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "12dbbd879a53f357316b73b495493f8d5b35584861289626a349b7ffd75536ca",
        )
        self.assertTrue(
            any(
                "12dbbd879a53f357316b73b495493f8d5b35584861289626a349b7ffd75536ca" in item
                for item in data["evidence"]
            )
        )

    def test_second_enabled_attempt_fails_only_missing_fixed_60hz_tick(self):
        response = ATTEMPT2_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(
            destruction_response_violations(response),
            {"fixed-60hz-tick"},
        )

    def test_second_enabled_attempt_is_exact_and_truthfully_archived(self):
        raw = ATTEMPT2_FIXTURE.read_bytes()
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 10141)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "5488ada10deaf1df8c97bc2404335fb466f20c89749776a37fb0b1928ed44e1e",
        )
        self.assertTrue(
            any(
                "5488ada10deaf1df8c97bc2404335fb466f20c89749776a37fb0b1928ed44e1e" in item
                for item in data["evidence"]
            )
        )

    def test_third_enabled_attempt_passes_all_scoped_gates(self):
        response = ATTEMPT3_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(destruction_response_violations(response), set())

    def test_third_enabled_attempt_lifecycle_has_all_states_and_safe_deactivation(self):
        response = ATTEMPT3_FIXTURE.read_text(encoding="utf-8")
        lifecycle = (
            "加入 replication tiers 和 debris lifecycle："
            "`gameplay → sleeping → pooled/despawned`；"
            "cosmetic debris 与 dust/VFX 本地生成，不参与 damage、blocking 或 scoring。"
        )
        self.assertIn(lifecycle, response)
        for state in ("gameplay", "cosmetic", "sleeping", "pooled", "despawned"):
            with self.subTest(state=state):
                lifecycle_line = next(
                    line for line in response.splitlines()
                    if "加入 replication tiers 和 debris lifecycle" in line
                )
                mutated_line = lifecycle_line.replace(state, "")
                if state == "pooled":
                    mutated_line = mutated_line.replace("pool", "")
                mutated = response.replace(lifecycle_line, mutated_line, 1)
                self.assertIn("lifecycle-states", destruction_response_violations(mutated))
        unsafe = response.replace("让无关对象 sleep/pool", "让对象 sleep/pool", 1)
        self.assertIn("lifecycle-safety", destruction_response_violations(unsafe))
        unsafe = response.replace(
            "降级不得破坏 support、gameplay collision、damage",
            "降级可以破坏 support、gameplay collision、damage",
            1,
        )
        self.assertIn("lifecycle-safety", destruction_response_violations(unsafe))

    def test_third_enabled_attempt_is_exact_accepted_and_truthfully_recorded(self):
        raw = ATTEMPT3_FIXTURE.read_bytes()
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 9236)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "f261955d3621f1022a0896f55f361cd37f89c20e241da179aa26916ee9bb7585",
        )
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), raw)
        self.assertIn(
            "gameplay, cosmetic, sleeping, pooled, and despawned",
            data["enabled"]["observations"],
        )
        self.assertIn("safe deactivation", data["enabled"]["observations"])
        self.assertEqual(data["verdict"], "pass")
        self.assertTrue(ENABLED_FIXTURE.exists())
        self.assertEqual(ENABLED_FIXTURE.read_bytes(), raw)

    def test_ui_metadata_is_minimal_and_invocable(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn('display_name: "Destruction, Fracture, and Fields"', text)
        self.assertIn('short_description: "Design bounded, authoritative destruction"', text)
        self.assertIn("Use $destruction-fracture-fields", text)
        self.assertIn("allow_implicit_invocation: true", text)

    def test_gate_requires_exactly_the_four_markdown_h2_sections(self):
        _, body = read_frontmatter_and_body(SKILL)
        self.assertEqual(destruction_response_violations(body), set())
        mutated = body + "\n## Notes\nExtra section.\n"
        self.assertIn("sections", destruction_response_violations(mutated))


if __name__ == "__main__":
    unittest.main()
