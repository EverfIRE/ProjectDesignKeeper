"""Focused contract and evidence-regression tests for real-time fluids."""

import hashlib
import json
import re
import subprocess
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "real-time-fluids-particles" / "SKILL.md"
UI = ROOT / "skills" / "real-time-fluids-particles" / "agents" / "openai.yaml"
EVALUATION = ROOT / "evaluations" / "real-time-fluids-particles" / "evaluation.json"
BASELINE_FIXTURE = ROOT / "tests" / "fixtures" / "real-time-fluids-particles-baseline-response.txt"
ATTEMPT1_FIXTURE = ROOT / "tests" / "fixtures" / "real-time-fluids-particles-enabled-attempt-1-response.txt"
ATTEMPT2_FIXTURE = ROOT / "tests" / "fixtures" / "real-time-fluids-particles-enabled-attempt-2-response.txt"
ACCEPTED_FIXTURE = ROOT / "tests" / "fixtures" / "real-time-fluids-particles-enabled-response.txt"

SCENARIO = "我想在一款 60 FPS 联机动作游戏里做“物理真实的交互水”：角色能涉水和游泳，箱子会漂浮并挡住水流，闸门打开后水会涌入另一区域，爆炸会产生浪和飞溅；远处还要看到大面积水面。当前只有 GPU 粒子特效，没有守恒水体或双向浮力。团队建议直接上 100 万个 SPH 粒子、每帧 8 个 pressure iterations，再把 viscosity 和 surface tension 调大来抑制抖动，所有玩家都同步粒子位置。目标 GPU p95 3 ms、CPU p95 1 ms、60 Hz gameplay physics；项目尚未声明世界尺度、水深/体积范围、可交互区域、最大活动角色/刚体、允许体积/散度/表面误差、目标硬件/显存、网络预算、闸门/边界精度或视觉质量档位。请给一个引擎无关、可测试的选型和开发方案。"

HEADINGS = (
    "Fluid contract",
    "Method selection and pipeline",
    "Coupling, rendering, and degradation",
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
        re.match(
            r"^\*{0,2}a\*{0,2}\s*[:：=＝]",
            text,
            re.IGNORECASE,
        )
    )


def clauses(text: str) -> list[str]:
    action = (
        r"(?:use|choose|select|adopt|set|run|test|update|sync|replicate|stream|increase|"
        r"raise|enlarge|直接|使用|采用|选择|设为|固定|测试|更新|同步|复制|提高|增大|以)"
    )
    values: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", raw_line)
        if is_control_clause(normalize(line)):
            values.append(normalize(line))
            continue
        parts = re.split(
            rf"(?<=[.!?])(?=\s|$)\s*|(?<=[。！？])\s*|[;；]|"
            rf"\s+(?:and|but|however)\s+(?=(?:(?:do not|don't|never)\s+)?{action})|"
            rf"[,，]\s*(?:(?:and\s+)?then|but|however|然后|随后|但|而|却)\s*|"
            rf"[,，]\s*(?=(?:(?:do not|don't|never|不要|不得|不能|不应)\s*)?{action})",
            line,
            flags=re.IGNORECASE,
        )
        values.extend(value for part in parts if (value := normalize(part)))
    return values


def positive_prescription_violations(text: str) -> set[str]:
    """Reject Task 13 inventions while preserving controls and negative diagnosis."""
    violations: set[str] = set()
    negation = re.compile(
        r"\b(?:do not|don't|never|not|cannot|can't|reject|avoid|forbid|unjustified|without)\b|"
        r"不要|不得|不能|不会|绝不|禁止|拒绝|避免|并非|不是|不应|不可|不能替代",
        re.IGNORECASE,
    )
    diagnosis = re.compile(
        r"^(?:current bad (?:proposal|behavior|plan|implementation)|"
        r"当前错误(?:建议|方案|行为|实现))\s*[:：]",
        re.IGNORECASE,
    )
    patterns = {
        "invented-one-million-sph": (
            r"(?:use|run|select|adopt).{0,20}(?:one million|1m|1[,.]?000[,.]?000).{0,16}sph particles?",
            r"(?:直接|使用|采用).{0,16}(?:100\s*万|一百万|1m).{0,12}sph\s*粒子",
        ),
        "invented-eight-iterations": (
            r"(?:use|set|run).{0,20}(?:eight|8).{0,12}(?:pressure )?iterations?",
            r"(?:使用|采用|设为|固定).{0,16}(?:8|八).{0,12}(?:次)?(?:pressure )?(?:iterations?|迭代)",
            r"(?:pressure )?(?:iterations?|迭代(?:次数)?).{0,16}(?:设为|固定为).{0,8}(?:8|八)(?:\s*次)?",
        ),
        "invented-viscosity-tension": (
            r"(?:set|use|increase|raise|enlarge).{0,24}(?:high\s+)?viscosity.{0,20}(?:surface )?tension",
            r"(?:设置|使用|采用|提高|增大).{0,20}(?:高)?(?:viscosity|黏度|粘度).{0,20}(?:surface tension|表面张力)",
        ),
        "invented-all-particle-sync": (
            r"(?:sync|replicate|stream|use).{0,24}(?:all[- ]particle synchronization|(?:all|every).{0,12}(?:particle positions?|particles?))",
            r"(?:all|every).{0,12}(?:clients?|players?).{0,20}(?:sync|synchronize|replicate|stream).{0,16}(?:all|every).{0,12}(?:particle positions?|particles?)",
            r"(?:同步|复制).{0,16}(?:所有|全部).{0,12}(?:粒子位置|粒子)",
            r"(?:使用|采用).{0,12}全粒子同步",
            r"(?:所有|全部).{0,12}(?:玩家|客户端).{0,16}(?:同步|复制).{0,12}(?:粒子位置|粒子)",
        ),
        "invented-cell-span": (
            r"(?:use|require|minimum|at least).{0,20}(?:4\s*[–-]\s*8|four.{0,4}eight).{0,12}(?:grid )?cells?",
            r"(?:约|至少|使用).{0,12}4\s*[～–-]\s*8\s*个(?:网格)?单元",
        ),
        "invented-network-rate": (
            r"(?:test|use|start|replicate).{0,28}10\s*[–-]\s*20\s*hz",
            r"(?:测试|采用|更新频率|以).{0,16}10\s*[～–-]\s*20\s*hz",
            r"10\s*[～–-]\s*20\s*hz.{0,16}(?:复制|同步|更新)",
        ),
        "invented-duration": (
            r"(?:run|test|sample).{0,20}(?:for |a )?(?:at least )?ten[- ]minutes?",
            r"(?:运行|测试|采样).{0,16}(?:至少)?十分钟",
        ),
        "invented-subbudgets": (
            r"(?:solver|solve).{0,12}0\.45\s*ms.{0,100}(?:coupling|query).{0,12}0\.25\s*ms",
            r"求解\s*0\.45\s*ms.{0,100}耦合.{0,12}0\.25\s*ms",
        ),
    }
    premature = (
        r"(?:use|choose|select|adopt).{0,24}(?:shallow[- ]water|shallow water/flip|hybrid).{0,12}(?:solver|now|architecture|方案)?",
        r"(?:直接|选择|采用|更合适的是).{0,20}(?:浅水|分层混合|混合求解器|hybrid).{0,12}(?:方案|架构)?",
    )
    conditional = re.compile(
        r"\b(?:if|when|only after|after).{0,48}(?:declared|required|measured)|\bscoped\b|"
        r"(?:若|如果|仅当|只有).{0,48}(?:声明|需要|测量|证据)|实测后.{0,24}(?:受限|选出)",
        re.IGNORECASE,
    )
    for clause in clauses(text):
        if is_control_clause(clause) or negation.search(clause) or diagnosis.search(clause):
            continue
        for code, variants in patterns.items():
            if any(re.search(pattern, clause, re.IGNORECASE) for pattern in variants):
                violations.add(code)
        if not conditional.search(clause) and any(
            re.search(pattern, clause, re.IGNORECASE) for pattern in premature
        ):
            violations.add("premature-method-selection")
    return violations


REQUIRED_GROUPS = {
    "authority-network-contract": (
        "gameplay/cosmetic-role", "unique local/server-authority",
        "network-state/events/checkpoints", "determinism/replay-scope",
    ),
    "dimension-scale-contract": (
        "2d/2.5d/3d", "near-interaction/far-surface/spray", "domain/world-scale",
        "coordinates/units/gravity", "initial/boundary-volume", "water-depth/range",
        "active-regions",
    ),
    "material-timing-contract": (
        "density/viscosity/surface tension", "compressibility/free-surface-target",
        "phase/material", "temperature(if-needed)", "60-hz gameplay-tick",
        "render-sampling/interpolation", "solver-step", "cfl/stability-rule",
        "substeps/iterations/caps",
    ),
    "representation-boundary-contract": (
        "particles/grid/cells/kernels/neighbors", "shallow-water-height/velocity/bathymetry",
        "transfers/advection/projection", "mass/volume-bookkeeping",
        "static/moving/open-boundaries", "sdf/collider-resolution",
        "inflow/outflow/gates", "initial-overlap", "leakage/fast-body-policy",
    ),
    "coupling-render-budget-contract": (
        "one-/two-way rigid/character-coupling", "displaced-volume",
        "buoyancy/drag/pressure/impulse-reaction", "authority/order", "force-caps",
        "surface reconstruction/meshing/normals", "spray/foam/bubbles/wetness",
        "render-only feedback exclusion", "gpu/cpu/memory/bandwidth-budgets",
        "active-counts", "observables/fallbacks/stop-rules",
    ),
    "shortcut-rejection": (
        "never infer one-million particles", "eight pressure-iterations",
        "higher viscosity/surface-tension", "all-particle-sync",
    ),
    "method-alternatives": (
        "requirement table", "persistent-volume/flow", "depth-variation/overturning",
        "breaking/spray", "object-blocking/displacement", "two-way-gameplay-forces",
        "cosmetic-particles", "shallow-water", "pbf/sph", "flip-like-grid", "hybrid",
        "rejected-alternatives/revisit-evidence",
    ),
    "pipeline-contract": (
        "fixed-tick-event/kinematic-sample", "active-domain-update",
        "boundary/gate/inflow/outflow-update", "source/sink-mass-ledger",
        "advection/prediction", "neighbor/grid-transfer",
        "incompressibility/density solve", "declared residual/caps",
        "collisions/two-way-reaction", "velocity/state-commit",
        "surface/foam-reconstruction", "render-interpolation", "telemetry/checkpoint",
    ),
    "validation-ladder": (
        "rest-water", "manufactured/known-flow", "one-gate/rigid-body/character/explosion-forcing",
        "leakage/divergence/density/advection/boundary/coupling/render-errors",
    ),
    "seams-degradation-network": (
        "boundary-geometry/frame-history", "equal/opposite reaction",
        "exactly-once", "cosmetic spray/foam never feeds",
        "mass/height/velocity exchange", "overlap/blend-region",
        "conservation-error/hysteresis", "lod may", "preserve gates",
        "gameplay-displacement", "flooding-state", "bounded-mass",
        "never skip random ticks/cells/bodies", "compact authoritative gates/sources",
        "height/low-dimensional-state or checkpoints/corrections",
        "never all-particle-positions", "missing bandwidth/correction-tolerance blocks network-acceptance",
    ),
    "reversible-degradation-contract": (
        "degradation is reversible", "measured down/up thresholds with hysteresis",
        "upshift restores conservative mass/height/velocity/state before authority transfer",
    ),
    "ab-scope": (
        "a=current cosmetic gpu particles + proposed one-million sph/eight-iteration/high-viscosity/high-surface-tension/all-particle-sync",
        "b=selected scoped method/hybrid", "physics stays 60-hz", "render=30/60/120-fps",
    ),
    "acceptance-cases": (
        "still-water-rest", "hydrostatic/buoyancy-body", "floating/blocking-box",
        "moving-character", "gate-dam-break/flood-fill", "inflow/outflow-balance",
        "moving/fast-boundary", "explosion-wave/splash", "near/far-seam",
        "worst-declared-active-counts/network-faults",
    ),
    "acceptance-metrics": (
        "mass/volume/source/sink/boundary-flux/drift",
        "density/divergence/pressure-residuals/cap-hits",
        "free-surface/height/wave/gate-timing-error", "leakage/penetration/ccd-misses",
        "displaced-volume", "equal/opposite-mismatch", "momentum/energy/work",
        "neighbor/cell/particle/active-domain-counts", "near/far-transfer-error/pops",
        "replay-first-divergence", "correction/bandwidth", "gpu/cpu-p50/p95/p99",
        "peak-memory", "allocation/transfer-time",
    ),
    "outcomes": (
        "accept-only-declared", "ordinary reject", "fatal stop/rollback",
        "gpu-p95<=3-ms", "cpu-p95<=1-ms", "finite-bounded-mass/state",
        "one-time-coupling", "silent-cap-loss",
    ),
}


ENABLED_CN_GROUPS = {
    "authority-network-contract": (
        r"纯视觉.{0,12}局部玩法.{0,24}服务器权威",
        r"唯一权威", r"确定性与回放范围", r"事件、检查点和纠错",
    ),
    "dimension-scale-contract": (
        r"近场、远场和飞溅.{0,32}二维.{0,8}二维半.{0,8}三维",
        r"世界单位、坐标、重力、区域尺度",
        r"水深与体积范围、初始水量、可交互区域",
        r"最大同时活动角色、刚体和闸门",
    ),
    "material-timing-contract": (
        r"密度、黏度和表面张力等材料参数",
        r"可压缩性、自由表面和玩法误差目标",
        r"60 hz tick", r"渲染只对已提交状态采样和插值",
        r"求解步长、稳定性或 cfl 规则、子步、迭代和各类上限",
    ),
    "representation-boundary-contract": (
        r"浅水模型.{0,180}水位、波速、闸门流量和障碍绕流误差",
        r"pbf/sph.{0,240}粒径或核尺度、邻域上限、密度残差",
        r"网格/flip 类.{0,240}网格尺度、边界精度、显存和压力残差",
        r"平流或位置预测", r"粒子邻域或完成粒子—网格传输",
        r"不可压缩性", r"质量账本",
        r"静态、移动和开放边界", r"碰撞体或 sdf 精度",
        r"闸门几何与开闭时序", r"入流、出流、源、汇、初始穿插、泄漏和高速物体策略",
    ),
    "coupling-render-budget-contract": (
        r"排开体积", r"浮力、阻力、压力和冲量", r"明确的权威与执行顺序",
        r"大小相等、方向相反", r"每个交换只施加一次",
        r"力或冲量上限必须显式声明和计数",
        r"重建水面、法线、泡沫和喷溅", r"只读渲染效果",
        r"gpu/cpu/内存/传输/网络预算", r"最大活动规模和视觉质量档位",
        r"输出遥测与检查点", r"降级可以缩小活动三维区域",
    ),
    "shortcut-rejection": (
        r"不能预设一百万粒子、八次压力迭代或其他数字",
        r"黏度和表面张力不能作为.{0,24}阻尼旋钮",
        r"不得同步所有粒子位置",
    ),
    "method-alternatives": (
        r"需求矩阵", r"持续体积与流动", r"深度变化", r"翻卷",
        r"破碎与飞溅", r"箱子阻流和排水", r"双向玩法力",
        r"\| 纯视觉 gpu 粒子 \|", r"\| 浅水模型 \|", r"\| pbf/sph \|",
        r"\| 网格/flip 类 \|", r"\| 混合方案 \|",
        r"当前拒绝理由", r"重新考虑证据", r"但这不是当前结论",
    ),
    "pipeline-contract": (
        r"采集权威事件、闸门状态和角色/刚体运动学快照",
        r"更新活动域以及静态、移动、开放边界",
        r"闸门、入流、出流、源和汇，并登记质量账本",
        r"平流或位置预测及外力", r"粒子邻域或完成粒子—网格传输",
        r"密度、散度、压力残差和上限下求解不可压缩性",
        r"处理碰撞及双向反作用", r"提交速度、位置、水位和守恒状态",
        r"重建水面、法线、泡沫和喷溅", r"渲染插值，输出遥测与检查点",
    ),
    "validation-ladder": (
        r"静水与已知解流动", r"单闸门", r"漂浮/阻流刚体", r"角色和爆炸强迫",
        r"泄漏、散度、密度、平流、边界、耦合和渲染误差必须分开归因",
    ),
    "seams-degradation-network": (
        r"共享同一套边界几何及其帧历史", r"大小相等、方向相反",
        r"每个交换只施加一次", r"只读渲染效果.{0,40}绝不能回写质量、压力、浮力、阻流或权威状态",
        r"质量或水高、速度与边界通量的双向交换",
        r"重叠/混合区、所有权切换、滞回和守恒误差",
        r"保留闸门、洪水状态、玩法排水、权威耦合和有界质量",
        r"不得随机跳过 tick、单元或刚体", r"不得用未记账的删除",
        r"紧凑的权威闸门/源事件、低维水位或速度状态、检查点和纠错",
        r"不得同步所有粒子位置", r"网络预算和允许纠错误差未声明前，网络验收仍被阻塞",
    ),
    "reversible-degradation-contract": (
        r"降级.{0,8}(?:必须)?可逆",
        r"(?:分别)?实测.{0,12}降级阈值.{0,12}升级阈值.{0,12}滞回",
        r"升级前.{0,16}恢复.{0,16}(?:守恒.{0,8})?质量.{0,8}水高.{0,8}速度.{0,8}状态.{0,16}(?:转移权威|权威转移)",
    ),
    "ab-scope": (
        r"相同种子、相同输入、相同场景和相同硬件",
        r"\*\*a\*\*：现有视觉 gpu 粒子.{0,120}一百万 sph 粒子.{0,80}八次压力迭代.{0,80}黏度/表面张力.{0,80}全粒子位置同步",
        r"\*\*b\*\*：完成契约和候选实测后选出的受限方法或混合方案",
        r"玩法物理均保持 60 hz", r"30、60、120 fps",
    ),
    "acceptance-cases": (
        r"覆盖静水、静水压力与浮力、漂浮并阻流的箱子、移动角色",
        r"闸门溃坝与灌水、入流/出流平衡、移动及高速边界",
        r"爆炸浪与飞溅、近远场接缝",
        r"最坏活动规模和网络故障",
    ),
    "acceptance-metrics": (
        r"质量、体积、源、汇、边界通量和累计漂移",
        r"密度、散度、压力残差及上限命中",
        r"自由表面、水位、波形和闸门到达时序误差",
        r"泄漏、穿透及连续碰撞漏检",
        r"排开体积、双方冲量、等量反向不匹配",
        r"动量、能量及外力做功", r"邻居、单元、粒子和活动域规模",
        r"近远场交换误差与可见跳变",
        r"回放首次分歧、网络带宽、纠错频率与纠错幅度",
        r"gpu/cpu 的 p50、p95、p99，峰值内存、分配和传输时间",
    ),
    "outcomes": (
        r"声明物理、玩法、视觉、回放和网络容差之后",
        r"状态和质量有限有界", r"双向作用仅执行一次",
        r"gpu p95 不超过 3 ms", r"cpu p95 不超过 1 ms",
        r"普通拒绝条件", r"立即停止该版本并回滚",
        r"非有限状态", r"持续增长的质量/散度/能量/泄漏",
        r"边界或耦合符号错误", r"静默上限丢失",
        r"无法恢复的回放或网络分歧", r"任一 p95 预算失败",
    ),
}


ATTEMPT2_CN_GROUPS = {
    "authority-network-contract": (
        r"哪些水体状态影响.{0,40}哪些仅为视觉效果",
        r"唯一的本地或服务器权威", r"事件/状态/检查点复制方式",
        r"确定性与回放范围",
    ),
    "dimension-scale-contract": (
        r"近场交互、远场水面、浪花采用 2d、2\.5d 还是 3d",
        r"世界单位、重力、坐标系", r"水深与体积范围、初始水量、活动区域",
        r"最大角色/刚体数量",
    ),
    "material-timing-contract": (
        r"密度、黏度、表面张力、可压缩性/自由表面目标",
        r"体积漂移、散度、密度、波高、闸门时序、边界泄漏和视觉误差",
        r"gameplay physics 固定为 60 hz", r"渲染只对已提交状态插值",
        r"求解步长、cfl/稳定性规则、子步数、压力/密度迭代上限和残差停止条件",
    ),
    "representation-boundary-contract": (
        r"浅水模型.{0,100}远处大面积", r"pbf/sph.{0,100}局部三维自由表面",
        r"flip 类网格.{0,100}不可压缩流", r"平流或预测",
        r"邻域查询或粒子—网格转移", r"不可压缩/密度约束",
        r"质量/体积账本", r"静态、移动、开放边界",
        r"碰撞 sdf/几何精度", r"闸门、流入/流出",
        r"初始穿插、快速刚体与 ccd 策略",
    ),
    "coupling-render-budget-contract": (
        r"双向耦合的排水体积、浮力、阻力、压力与冲量公式",
        r"执行顺序、权威和限幅策略", r"成对施加且恰好一次",
        r"表面网格、法线、泡沫、飞溅、气泡和湿润效果",
        r"只读取已提交的权威流体快照", r"不得反向写入质量、压力、浮力、阻流",
        r"目标硬件、显存/内存、传输和网络预算以及质量档位",
    ),
    "shortcut-rejection": (
        r"不得据此推定一百万粒子、八次迭代、高黏度、高表面张力或同步全部粒子",
        r"黏度或表面张力.{0,32}不是修复压力收敛和抖动的通用办法",
        r"禁止同步所有粒子位置",
    ),
    "method-alternatives": (
        r"现有 gpu 粒子：", r"浅水模型：", r"pbf/sph：", r"flip 类网格：",
        r"混合方案：", r"是否采用该方案仍须由已声明需求和实测预算决定",
        r"每种被拒方法都记录拒绝理由，以及重新考虑它所需的测量证据",
    ),
    "pipeline-contract": (
        r"输入事件与运动学采样 → 活动域更新 → 边界/闸门/流入流出更新",
        r"源汇质量账本 → 平流或预测 → 外力 → 邻域查询或粒子—网格转移",
        r"声明残差及上限下求不可压缩/密度约束",
        r"碰撞与双向反作用 → 速度和状态提交",
        r"表面、泡沫与飞溅重建 → 渲染插值 → 遥测与检查点",
    ),
    "validation-ladder": (
        r"先验证静水、静水压力和已知/制造流",
        r"再依次加入单闸门、单刚体、角色和爆炸强迫",
        r"泄漏、质量漂移、散度/密度、平流、边界、耦合与渲染误差必须分别归因",
    ),
    "seams-degradation-network": (
        r"共享同一套边界几何及帧历史", r"成对施加且恰好一次",
        r"不得反向写入质量、压力、浮力、阻流、闸门、淹没状态或网络权威",
        r"双向交换质量或水高、速度/动量和边界通量",
        r"重叠/混合区", r"闸门、排水、淹没和权威 gameplay 耦合不能随 lod 消失",
        r"不得随机跳过 tick、cell 或刚体", r"紧凑的权威闸门、源汇、低维水面状态或检查点/校正",
        r"禁止同步所有粒子位置", r"带宽、延迟、校正容差和首次回放分歧尚未声明，因此网络验收仍被阻塞",
    ),
    "reversible-degradation-contract": (
        r"降级必须是可逆状态机", r"目标硬件测试得到并冻结 `down` 阈值",
        r"同一测试得到独立的 `up` 阈值", r"up < down.{0,32}滞回区",
        r"升档时先保守恢复状态，再转移权威",
        r"转移全部质量/体积或水高、动量/速度、闸门与洪水状态、边界历史及 gameplay 耦合状态",
        r"转移账本残差必须在已声明容差内",
    ),
    "ab-scope": (
        r"完全相同的种子、输入、场景和事件时序", r"a：现有美术 gpu 粒子.{0,160}一百万 sph 粒子.{0,80}八次 pressure iterations.{0,80}viscosity/surface tension.{0,100}同步粒子位置",
        r"b：需求冻结后选定的作用域方法或守恒混合方案",
        r"gameplay physics 均保持 60 hz", r"30、60、120 fps",
    ),
    "acceptance-cases": (
        r"覆盖静水、静水压力/浮力、漂浮并阻流的箱子、移动角色",
        r"开闸溃坝与灌水、流入流出平衡、移动/快速边界",
        r"爆炸波与飞溅、近远场接缝", r"最坏活动数量和网络丢包/延迟/校正情形",
    ),
    "acceptance-metrics": (
        r"初始质量/体积、源、汇、边界通量、最终量和漂移",
        r"密度、散度、压力残差、停止原因及所有 cap 命中",
        r"自由表面、水高、波形和闸门到达时序误差",
        r"泄漏、穿透、ccd 漏检和边界误差", r"排水体积、浮力/阻力/冲量、等大反向反作用不匹配",
        r"动量、能量和外力做功", r"邻居、cell、粒子和活动域数量",
        r"近远场转移残差及视觉跳变", r"回放首次分歧、网络带宽、校正量和恢复时间",
        r"gpu/cpu p50、p95、p99、峰值内存、分配和传输时间",
    ),
    "outcomes": (
        r"全部预先声明的物理、gameplay、视觉、回放和网络容差通过",
        r"质量/状态有限且有界", r"耦合反作用恰好一次",
        r"gpu p95 ≤ 3 ms", r"cpu p95 ≤ 1 ms", r"才接受 b",
        r"普通拒绝并回到选型", r"立即停止该配置并回滚",
        r"非有限状态", r"持续增长的质量/散度/能量/泄漏",
        r"边界或耦合符号错误", r"静默 cap 丢失", r"不可恢复的回放/网络分歧",
    ),
}


def fluid_response_violations(response: str) -> set[str]:
    violations = positive_prescription_violations(response)
    normalized = normalize(response)
    if re.search(r"小于约\s*4\s*[～–-]\s*8\s*个(?:网格)?单元", response):
        violations.add("invented-cell-span")
    headings = re.findall(r"(?m)^##[ \t]+(.+?)[ \t]*$", response)
    if headings != list(HEADINGS):
        violations.add("sections")
    for code, phrases in REQUIRED_GROUPS.items():
        english_complete = all(phrase in normalized for phrase in phrases)
        chinese_variants = (
            ENABLED_CN_GROUPS.get(code, ()),
            ATTEMPT2_CN_GROUPS.get(code, ()),
        )
        chinese_complete = any(
            bool(patterns) and all(
                re.search(pattern, normalized, re.IGNORECASE)
                for pattern in patterns
            )
            for patterns in chinese_variants
        )
        if not english_complete and not chinese_complete:
            violations.add(code)

    blocker_match = re.search(
        r"unknown (?P<items>[^.]+) each block method selection, tuning, and acceptance\.",
        normalized,
    )
    blocker_text = blocker_match.group("items") if blocker_match else ""
    english_blockers = all(
        term in blocker_text
        for term in (
            "gameplay role", "authority", "dimensionality", "scale", "method",
            "coupling", "active counts", "hardware", "memory", "network",
            "error budgets",
        )
    )
    fluid_contract = response.split("## Method selection and pipeline", 1)[0]
    chinese_blockers = (
        "以下任一项未决，都构成阻塞条件" in fluid_contract
        and "不能选定方法、调参或验收" in fluid_contract
        and all(
            re.search(pattern, fluid_contract, re.IGNORECASE)
            for pattern in (
                r"纯视觉.{0,12}局部玩法.{0,24}服务器权威", r"唯一权威",
                r"区域尺度", r"二维.{0,8}二维半.{0,8}三维", r"不能选定方法",
                r"耦合误差", r"最大同时活动", r"目标硬件", r"内存",
                r"网络预算", r"可接受的.{0,120}误差",
            )
        )
    )
    chinese_blockers_attempt2 = (
        "这些任一未知项都阻塞方法选择、数值调参和最终验收" in fluid_contract
        and all(
            re.search(pattern, fluid_contract, re.IGNORECASE)
            for pattern in (
                r"gameplay/纯视觉边界", r"权威模型", r"维度", r"世界尺度",
                r"活动数量", r"耦合顺序与精度", r"目标硬件", r"内存/网络预算",
                r"物理和视觉误差预算",
            )
        )
    )
    if not english_blockers and not chinese_blockers and not chinese_blockers_attempt2:
        violations.add("decision-blockers")

    feedback_claim = re.compile(
        r"(?:spray|foam).{0,28}(?:feeds|contributes).{0,20}"
        r"(?:mass|pressure|buoyancy|blocking|authority)",
        re.IGNORECASE,
    )
    feedback_denial = re.compile(r"\b(?:never|not|cannot|can't)\b|不(?:会|得|能|应)")
    has_feedback_exclusion = (
        "render-only feedback exclusion" in normalized
        or bool(re.search(r"只读渲染效果.{0,40}绝不能回写", normalized))
        or bool(re.search(r"只读取已提交的权威流体快照.{0,100}不得反向写入", normalized))
    )
    if not has_feedback_exclusion or any(
        feedback_claim.search(clause) and not feedback_denial.search(clause)
        for clause in clauses(response)
        if not is_control_clause(clause)
    ):
        violations.add("render-feedback")
    return violations


def assert_fluids_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter["name"] == "real-time-fluids-particles"
    description = frontmatter["description"]
    assert description.startswith("Use when")
    for trigger in (
        "fluid", "water", "liquid", "particles", "PBF", "SPH", "grid",
        "shallow water", "free surface", "incompressibility", "buoyancy", "coupling",
        "流体", "水体", "液体", "粒子", "浅水", "不可压缩", "浮力", "耦合",
    ):
        assert trigger in description
    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    assert re.findall(r"^## (.+)$", body, re.MULTILINE) == list(HEADINGS)
    for source in (
        "primary PBF/SPH", "FLIP/grid", "shallow-water", "free-surface",
        "fluid-rigid coupling", "real-time reconstruction", "audited official backends",
    ):
        assert source in body
    assert fluid_response_violations(body) == set()
    for api_symbol in (
        "Niagara", "ChaosFluids", "UnityEngine", "PhysX", "PxScene",
        "JPH::", "RigidBody3D", "Rapier",
    ):
        assert api_symbol not in body


class RealTimeFluidsParticlesSkillTests(unittest.TestCase):
    def test_skill_exposes_complete_engine_neutral_contract(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_fluids_skill_contract(frontmatter, body)

    def test_contract_mutations_cannot_drop_required_decisions_or_outcomes(self):
        _, body = read_frontmatter_and_body(SKILL)
        for phrase in (
            "2D/2.5D/3D", "incompressibility/density solve", "declared residual/caps",
            "equal/opposite reaction", "render-only feedback exclusion",
            "mass/height/velocity exchange", "never skip random ticks/cells/bodies",
            "Never infer one-million particles",
            "Ordinary reject", "Fatal stop/rollback",
        ):
            with self.subTest(phrase=phrase):
                mutated = body.replace(phrase, "", 1)
                self.assertNotEqual(mutated, body)
                self.assertTrue(fluid_response_violations(mutated))

    def test_each_unknown_decision_independently_blocks_tuning_and_acceptance(self):
        _, body = read_frontmatter_and_body(SKILL)
        blocker = "Unknown gameplay role, authority, dimensionality, scale, method, coupling, active counts, hardware, memory, network, or error budgets each block method selection, tuning, and acceptance."
        self.assertIn(blocker, body)
        for term in (
            "gameplay role", "authority", "dimensionality", "scale", "method",
            "coupling", "active counts", "hardware", "memory", "network",
            "error budgets",
        ):
            with self.subTest(term=term):
                mutated = body.replace(blocker, blocker.replace(term, "", 1), 1)
                self.assertIn("decision-blockers", fluid_response_violations(mutated))

    def test_runtime_opened_paths_are_tracked_and_archive_portable(self):
        opened_paths = {
            name: value
            for name, value in globals().items()
            if isinstance(value, Path) and name != "ROOT"
        }
        allowed_prefixes = ("skills/", "evaluations/", "tests/fixtures/")
        for name, path in opened_paths.items():
            with self.subTest(name=name):
                relative = path.relative_to(ROOT).as_posix()
                self.assertTrue(relative.startswith(allowed_prefixes), relative)
                if not path.exists():
                    self.assertEqual(name, "ACCEPTED_FIXTURE")
                elif (ROOT / ".git").exists():
                    tracked = subprocess.run(
                        ["git", "ls-files", "--error-unmatch", "--", relative],
                        cwd=ROOT,
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertEqual(tracked.returncode, 0, relative)

    def test_primary_source_scope_and_exact_ab_sides_are_deletion_protected(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        phrases = (
            "primary PBF/SPH", "FLIP/grid", "shallow-water", "free-surface",
            "fluid-rigid coupling", "real-time reconstruction", "audited official backends",
            "A=current cosmetic GPU particles + proposed one-million SPH/eight-iteration/high-viscosity/high-surface-tension/all-particle-sync",
            "B=selected scoped method/hybrid",
        )
        for phrase in phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
                with self.assertRaises(AssertionError):
                    assert_fluids_skill_contract(frontmatter, body.replace(phrase, ""))

    def test_positive_shortcuts_reject_in_english_and_chinese(self):
        cases = {
            "Use one million SPH particles.": "invented-one-million-sph",
            "直接使用 100 万个 SPH 粒子。": "invented-one-million-sph",
            "Set eight pressure iterations.": "invented-eight-iterations",
            "将 pressure iterations 设为 8 次。": "invented-eight-iterations",
            "Increase viscosity and surface tension.": "invented-viscosity-tension",
            "增大黏度和表面张力。": "invented-viscosity-tension",
            "Synchronize all particle positions.": "invented-all-particle-sync",
            "同步所有粒子位置。": "invented-all-particle-sync",
            "Require at least 4-8 grid cells.": "invented-cell-span",
            "至少使用 4-8 个网格单元。": "invented-cell-span",
            "Test updates at 10-20 Hz.": "invented-network-rate",
            "更新频率测试 10-20 Hz。": "invented-network-rate",
            "Run the stress test for ten minutes.": "invented-duration",
            "压力测试运行十分钟。": "invented-duration",
            "Choose a shallow-water hybrid now.": "premature-method-selection",
            "直接采用分层混合方案。": "premature-method-selection",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

    def test_reviewer_shortcut_variants_and_b_arms_are_not_exempt(self):
        cases = {
            "B: Use one million SPH particles.": "invented-one-million-sph",
            "B：直接使用 100 万个 SPH 粒子。": "invented-one-million-sph",
            "Use 1M SPH particles.": "invented-one-million-sph",
            "使用 1M SPH 粒子。": "invented-one-million-sph",
            "Set high viscosity and surface tension.": "invented-viscosity-tension",
            "设置高黏度和表面张力。": "invented-viscosity-tension",
            "Use all-particle synchronization.": "invented-all-particle-sync",
            "使用全粒子同步。": "invented-all-particle-sync",
            "Replicate water state at 10-20 Hz.": "invented-network-rate",
            "以 10-20 Hz 复制水体状态。": "invented-network-rate",
            "Run a ten-minute stress test.": "invented-duration",
            "运行十分钟压力测试。": "invented-duration",
            "Adopt a hybrid solver.": "premature-method-selection",
            "采用混合求解器。": "premature-method-selection",
            "Team suggests: Use 1M SPH particles.": "invented-one-million-sph",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

    def test_reviewer_shortcut_true_negatives_and_exact_a_control_pass(self):
        negatives = (
            "Do not use 1M SPH particles.",
            "Do not set high viscosity and surface tension.",
            "Do not use all-particle synchronization.",
            "Do not replicate water state at 10-20 Hz.",
            "Do not run a ten-minute stress test.",
            "Do not adopt a hybrid solver.",
            "不要使用 1M SPH 粒子。",
            "不要设置高黏度和表面张力。",
            "不要使用全粒子同步。",
            "不要以 10-20 Hz 复制水体状态。",
            "不要运行十分钟压力测试。",
            "不要采用混合求解器。",
        )
        for text in negatives:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

        controls = (
            "A: Use 1M SPH particles, high viscosity and surface tension, all-particle synchronization, 10-20 Hz replication, a ten-minute run, and a hybrid solver.",
            "A：使用 1M SPH 粒子、高黏度和表面张力、全粒子同步、10-20 Hz 复制、十分钟测试和混合求解器。",
        )
        for text in controls:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

    def test_current_bad_diagnosis_is_narrow_and_prefix_removal_rejects(self):
        diagnoses = (
            ("Current bad proposal: Use 1M SPH particles.", "Current bad proposal: "),
            ("当前错误建议：使用 1M SPH 粒子。", "当前错误建议："),
        )
        for text, prefix in diagnoses:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())
                self.assertIn(
                    "invented-one-million-sph",
                    positive_prescription_violations(text.removeprefix(prefix)),
                )

    def test_clause_polarity_allows_true_negative_diagnosis_and_controls(self):
        negatives = (
            "Do not use one million SPH particles.",
            "Eight pressure iterations are not an acceptance criterion.",
            "Never increase viscosity and surface tension to hide instability.",
            "Do not synchronize all particle positions.",
            "不要直接使用 100 万个 SPH 粒子。",
            "不能把 pressure iterations 设为 8 次。",
            "不得增大黏度和表面张力来掩盖抖动。",
            "不要同步所有粒子位置。",
            "Current bad proposal: choose a shallow-water hybrid now.",
            "当前错误建议：直接采用分层混合方案。",
        )
        for text in negatives:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

        controls = (
            "A: Use one million SPH particles, eight iterations, high viscosity and surface tension, and synchronize all particle positions.",
            "A：直接使用 100 万 SPH 粒子、8 次迭代、高黏度和表面张力并同步全部粒子位置。",
        )
        for text in controls:
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), set())

    def test_negative_clause_cannot_mask_later_positive_prescription(self):
        cases = {
            "Do not use one million SPH particles; set eight pressure iterations.": "invented-eight-iterations",
            "Do not increase viscosity; synchronize all particle positions.": "invented-all-particle-sync",
            "不要使用 100 万个 SPH 粒子；更新频率测试 10-20 Hz。": "invented-network-rate",
            "不得增大黏度；直接采用分层混合方案。": "premature-method-selection",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertIn(expected, positive_prescription_violations(text))

    def test_then_starts_a_new_prescription_scope_after_negation_or_diagnosis(self):
        cases = {
            "Do not set high viscosity and surface tension, then use 1M SPH particles.": "invented-one-million-sph",
            "不要设置高黏度和表面张力，然后使用 1M SPH 粒子。": "invented-one-million-sph",
            "Do not use 1M SPH particles, then set eight pressure iterations.": "invented-eight-iterations",
            "不要使用 1M SPH 粒子，然后将 pressure iterations 设为 8 次。": "invented-eight-iterations",
            "Do not use 1M SPH particles, then set high viscosity and surface tension.": "invented-viscosity-tension",
            "不要使用 1M SPH 粒子，然后设置高黏度和表面张力。": "invented-viscosity-tension",
            "Do not use 1M SPH particles, then all clients synchronize every particle position.": "invented-all-particle-sync",
            "不要使用 1M SPH 粒子，然后所有客户端同步全部粒子位置。": "invented-all-particle-sync",
            "Do not use 1M SPH particles, then require at least 4-8 grid cells.": "invented-cell-span",
            "不要使用 1M SPH 粒子，然后至少使用 4-8 个网格单元。": "invented-cell-span",
            "Do not sync particle positions, then use water updates at 10-20 Hz.": "invented-network-rate",
            "Do not use 1M SPH particles, then start water updates at 10-20 Hz.": "invented-network-rate",
            "Current bad proposal: Do not use 1M SPH particles, then adopt a hybrid solver.": "premature-method-selection",
            "不要同步粒子位置，然后以 10-20 Hz 更新水体。": "invented-network-rate",
            "不要使用 1M SPH 粒子，然后更新频率采用 10-20 Hz。": "invented-network-rate",
            "Do not use 1M SPH particles, then sample for ten minutes.": "invented-duration",
            "不要使用 1M SPH 粒子，然后采样十分钟。": "invented-duration",
            "Do not use 1M SPH particles, then solver 0.45 ms and coupling 0.25 ms.": "invented-subbudgets",
            "不要使用 1M SPH 粒子，然后求解 0.45 ms、耦合 0.25 ms。": "invented-subbudgets",
            "当前错误建议：不要使用 1M SPH 粒子，然后采用混合求解器。": "premature-method-selection",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(positive_prescription_violations(text), {expected})

    def test_baseline_is_exact_and_fails_named_scoped_gates(self):
        raw = BASELINE_FIXTURE.read_bytes()
        self.assertEqual(len(raw), 7164)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "b0797c8a46e0d75973e9ea594587fbba488f67f1d02e14601a047804ab96efdd",
        )
        violations = fluid_response_violations(raw.decode("utf-8"))
        self.assertTrue(
            {
                "invented-cell-span", "invented-network-rate", "invented-duration",
                "invented-subbudgets", "premature-method-selection", "sections",
                "method-alternatives", "pipeline-contract", "seams-degradation-network",
                "ab-scope", "acceptance-metrics", "outcomes", "decision-blockers",
                "render-feedback",
            }.issubset(violations)
        )

    def test_evaluation_preserves_exact_baseline_and_promotes_attempt2(self):
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(validate_evaluation_record(data), [])
        self.assertEqual(data["skill"], "real-time-fluids-particles")
        self.assertEqual(data["scenario"], SCENARIO)
        self.assertEqual(
            data["baseline"]["response"].encode("utf-8"),
            BASELINE_FIXTURE.read_bytes(),
        )
        self.assertIn("4–8", data["baseline"]["observations"])
        self.assertIn("10–20 Hz", data["baseline"]["observations"])
        self.assertIn("ten-minute", data["baseline"]["observations"])
        self.assertIn("premature shallow-water/hybrid", data["baseline"]["observations"])
        self.assertEqual(data["enabled"]["response"].encode("utf-8"), ATTEMPT2_FIXTURE.read_bytes())
        self.assertEqual(data["verdict"], "pass")
        self.assertIn("measured DOWN and independent UP thresholds", data["enabled"]["observations"])
        self.assertIn("conservative upshift restoration", data["enabled"]["observations"])
        self.assertTrue(ACCEPTED_FIXTURE.exists())
        self.assertEqual(ACCEPTED_FIXTURE.read_bytes(), ATTEMPT2_FIXTURE.read_bytes())

    def test_first_enabled_attempt_fails_only_reversible_degradation_contract(self):
        response = ATTEMPT1_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(
            fluid_response_violations(response),
            {"reversible-degradation-contract"},
        )

    def test_first_enabled_attempt_contracts_are_deletion_protected(self):
        response = ATTEMPT1_FIXTURE.read_text(encoding="utf-8")
        mutations = {
            "method-alternatives": "但这不是当前结论。",
            "material-timing-contract": "玩法物理固定为 **60 Hz tick**",
            "representation-boundary-contract": "静态、移动和开放边界",
            "pipeline-contract": "在已声明的密度、散度、压力残差和上限下求解不可压缩性",
            "seams-degradation-network": "每个交换只施加一次",
            "render-feedback": "但始终是只读渲染效果，绝不能回写质量、压力、浮力、阻流或权威状态",
            "ab-scope": "- **A**：现有视觉 GPU 粒子，加上团队原提案原样实现的一百万 SPH 粒子、每帧八次压力迭代、增大的黏度/表面张力以及全粒子位置同步。",
            "acceptance-metrics": "回放首次分歧、网络带宽、纠错频率与纠错幅度",
            "outcomes": "普通拒绝条件是有限且可诊断的容差、预算或上限超标。",
        }
        for expected, phrase in mutations.items():
            with self.subTest(expected=expected):
                self.assertIn(phrase, response)
                mutated = response.replace(phrase, "")
                self.assertIn(expected, fluid_response_violations(mutated))

    def test_first_enabled_attempt_each_unknown_blocks_tuning_and_acceptance(self):
        response = ATTEMPT1_FIXTURE.read_text(encoding="utf-8")
        fluid_contract = response.split("## Method selection and pipeline", 1)[0]
        replacements = {
            "scale": "区域尺度",
            "dimensionality": "二维、二维半还是三维",
            "method": "当前不能选定方法",
            "coupling": "耦合误差",
            "active-counts": "最大同时活动",
            "hardware": "目标硬件",
            "memory": "内存",
            "network": "网络预算",
            "errors": "可接受的质量或体积漂移、密度误差、散度、压力残差、表面或水位误差、闸门通过量误差、泄漏、穿透、耦合误差、网络纠错误差和回放差异。",
        }
        for category, phrase in replacements.items():
            with self.subTest(category=category):
                self.assertIn(phrase, fluid_contract)
                mutated = response.replace(phrase, "", 1)
                self.assertIn("decision-blockers", fluid_response_violations(mutated))

    def test_reversible_degradation_requires_explicit_thresholds_and_restoration(self):
        _, body = read_frontmatter_and_body(SKILL)
        contract = "Degradation is reversible: measured down/up thresholds with hysteresis; upshift restores conservative mass/height/velocity/state before authority transfer."
        self.assertIn(contract, body)
        self.assertIn(
            "reversible-degradation-contract",
            fluid_response_violations(body.replace(contract, "", 1)),
        )

        response = ATTEMPT1_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(
            fluid_response_violations(response),
            {"reversible-degradation-contract"},
        )

        contract_cn = "降级必须可逆：分别实测降级阈值和升级阈值并使用滞回；升级前恢复守恒的质量、水高、速度和状态，然后才转移权威。"
        qualified = response + "\n\n" + contract_cn
        self.assertEqual(fluid_response_violations(qualified), set())
        for phrase in (
            "降级必须可逆",
            "分别实测降级阈值和升级阈值",
            "使用滞回",
            "升级前恢复守恒的质量、水高、速度和状态",
            "然后才转移权威",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, qualified)
                self.assertIn(
                    "reversible-degradation-contract",
                    fluid_response_violations(qualified.replace(phrase, "", 1)),
                )

    def test_first_enabled_attempt_remains_exact_failed_history(self):
        raw = ATTEMPT1_FIXTURE.read_bytes()
        data = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 8140)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "be5e2eef3003b190388d50b77431bf4b42c6f2317b143abaff03d82b4a52a4d0",
        )
        self.assertEqual(
            fluid_response_violations(raw.decode("utf-8")),
            {"reversible-degradation-contract"},
        )
        evidence = " ".join(data["evidence"])
        self.assertIn("Attempt 1", evidence)
        self.assertIn("be5e2eef3003b190388d50b77431bf4b42c6f2317b143abaff03d82b4a52a4d0", evidence)
        self.assertIn("reversible-degradation-contract", evidence)

    def test_second_enabled_attempt_is_exact_and_passes_all_scoped_gates(self):
        raw = ATTEMPT2_FIXTURE.read_bytes()
        self.assertEqual(len(raw), 7666)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "f62033c11036782186a3cab8844526e1f11bb8e413ff89e76fc9c21bd98ca0dc",
        )
        self.assertEqual(fluid_response_violations(raw.decode("utf-8")), set())

    def test_attempt2_reversible_upshift_state_is_deletion_protected(self):
        response = ATTEMPT2_FIXTURE.read_text(encoding="utf-8")
        phrases = (
            "通过目标硬件测试得到并冻结 `DOWN` 阈值",
            "通过同一测试得到独立的 `UP` 阈值",
            "两者之间保持当前档位，形成可验证的滞回区",
            "升档时先保守恢复状态，再转移权威",
            "全部质量/体积或水高",
            "动量/速度",
            "闸门与洪水状态",
            "边界历史",
            "gameplay 耦合状态",
        )
        for phrase in phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, response)
                self.assertIn(
                    "reversible-degradation-contract",
                    fluid_response_violations(response.replace(phrase, "", 1)),
                )

    def test_ui_metadata_is_minimal_and_invocable(self):
        text = UI.read_text(encoding="utf-8")
        self.assertIn('display_name: "Real-Time Fluids and Particles"', text)
        self.assertIn('short_description: "Design bounded interactive fluid simulation"', text)
        self.assertIn("Use $real-time-fluids-particles", text)
        self.assertIn("allow_implicit_invocation: true", text)

    def test_gate_requires_exactly_the_four_markdown_h2_sections(self):
        _, body = read_frontmatter_and_body(SKILL)
        self.assertEqual(fluid_response_violations(body), set())
        self.assertIn(
            "sections",
            fluid_response_violations(body + "\n## Notes\nExtra section.\n"),
        )


if __name__ == "__main__":
    unittest.main()
