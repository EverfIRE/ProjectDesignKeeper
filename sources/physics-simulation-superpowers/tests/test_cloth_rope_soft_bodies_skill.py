"""Focused contract and evidence-regression tests for deformable simulation."""

import hashlib
import json
import re
import unittest
from pathlib import Path

from tests.evaluation_contract import validate_evaluation_record


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "cloth-rope-soft-bodies" / "SKILL.md"
EVALUATION = ROOT / "evaluations" / "cloth-rope-soft-bodies" / "evaluation.json"
BASELINE_FIXTURE = ROOT / "tests" / "fixtures" / "cloth-rope-soft-bodies-baseline-response.txt"
ATTEMPT1_FIXTURE = ROOT / "tests" / "fixtures" / "cloth-rope-soft-bodies-enabled-attempt-1-response.txt"
ENABLED_FIXTURE = ROOT / "tests" / "fixtures" / "cloth-rope-soft-bodies-enabled-response.txt"

SCENARIO = "我在做一件可抓取、可撕裂的角色披风，同时场景里还有几根能缠绕柱子的绳子和一个被挤压的软体道具。目标 60 FPS，所有这些变形体合计 CPU p95 预算 2 ms。现在披风用位置约束，换到 30 FPS 渲染时更容易拉长；把 stretch stiffness 调大后开始爆炸，自碰撞会把顶点瞬间弹飞，快速移动的角色会穿过披风。绳子在附着点附近越拉越长，软体体积逐渐塌缩。团队建议把 solver iterations 提到 20、每帧做 4 个 substeps、collision thickness 加倍，再对所有顶点开 self-collision。请给一个引擎无关、可测试、能按距离降级的方案。项目尚未声明布料/绳子/软体的尺寸与质量、网格分辨率、材料参数、撕裂规则、角色碰撞代理、允许拉伸/穿透/体积误差或同时活跃数量。"

HEADINGS = (
    "Deformable contract",
    "Staged diagnosis",
    "Collision, coupling, and LOD",
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


def positive_prescription_violations(text: str) -> set[str]:
    """Detect only positive Task 11 shortcuts, preserving negative diagnosis."""
    violations: set[str] = set()
    negation = re.compile(
        r"\b(?:do not|don't|never|remove|delete|reject|avoid|forbid)\b|"
        r"不要|不得|不能|绝不|禁止|删除|移除|拒绝|避免|并非|不是",
        re.IGNORECASE,
    )
    trailing_retraction = re.compile(
        r"^(?:never|absolutely not|no)[.!?]?$|^(?:绝不|绝非|不行)[。！？]?$|"
        r"^(?:remove|delete|reject|avoid|forbid)\s+(?:it|this|that|the\s+(?:proposal|setting|configuration))\b|"
        r"^(?:删除|移除|拒绝|避免|禁止)(?:它|该|此|这个|此项|该方案)",
        re.IGNORECASE,
    )
    patterns = {
        "positive-solver-prescription": (
            r"(?:set|use|raise|increase|fix(?:ed)?(?: at)?|run).{0,30}(?:(?:solver\s*)?iterations?.{0,16}(?:20|12|twenty|twelve)|(?:20|12|twenty|twelve).{0,16}(?:solver\s*)?iterations?)",
            r"(?:将|把|使用|采用|固定|设为|改为|提高|增加).{0,24}(?:(?:solver iterations?|求解器迭代|迭代次数).{0,16}(?:20|12|二十|十二)|(?:20|12|二十|十二).{0,16}(?:solver iterations?|求解器迭代|迭代次数))",
            r"(?:solver iterations?|求解器迭代|迭代次数).{0,12}(?:设为|使用|采用|固定|提高|增加).{0,8}(?:20|12|二十|十二)",
        ),
        "positive-substep-prescription": (
            r"(?:use|set|run|do|fix(?:ed)?(?: at)?).{0,24}(?:(?:four|4).{0,16}(?:physics\s*)?substeps?|(?:physics\s*)?substeps?.{0,16}(?:four|4))",
            r"(?:每帧|每个渲染帧|固定|使用|采用|设为).{0,20}(?:(?:四|4).{0,12}(?:物理)?(?:substeps?|子步)|(?:物理)?(?:substeps?|子步).{0,12}(?:四|4))",
            r"(?:物理)?(?:substeps?|子步).{0,12}(?:固定为|设为|使用|采用).{0,8}(?:四|4)",
        ),
        "positive-thickness-prescription": (
            r"double.{0,24}(?:collision\s*)?thickness",
            r"(?:set|use|increase|raise).{0,24}(?:collision\s*)?thickness.{0,30}(?:twice|double|twofold|factor of two|2\s*[x×]|\d\s*(?:cm|mm))",
            r"(?:set|use|increase|raise).{0,24}(?:twice|double|twofold|factor of two|2\s*[x×]).{0,16}(?:collision\s*)?thickness",
            r"(?:碰撞厚度|collision thickness).{0,30}(?:加倍|两倍|2\s*倍|设为\s*\d\s*(?:厘米|毫米|cm|mm))",
            r"(?:采用|使用|设为|提高|增加).{0,16}(?:两倍|2\s*倍|加倍).{0,12}(?:碰撞厚度|collision thickness)",
        ),
        "positive-all-self-collision": (
            r"(?:enable|use).{0,28}self-collision.{0,20}(?:all|every|100\s*%).{0,16}(?:vertices|particles)",
            r"(?:enable|use).{0,20}(?:all[- ](?:vertex|particle)|every[- ](?:vertex|particle)|100\s*%.{0,8}(?:vertices|particles)).{0,16}self-collision",
            r"(?:所有|全部|100\s*%).{0,12}(?:顶点|粒子).{0,16}(?:开|开启|启用|使用).{0,8}(?:自碰撞|self-collision)",
            r"(?:开|开启|启用|使用).{0,8}(?:全|所有|全部|100\s*%).{0,8}(?:顶点|粒子).{0,8}(?:自碰撞|self-collision)",
        ),
        "render-dt-dependence": (
            r"(?:update|solve|integrate).{0,30}(?:constraints?|deformables?).{0,24}render(?:ing)?\s*(?:dt|delta(?:time)?)",
            r"(?:使用|按).{0,16}渲染(?:帧)?\s*(?:dt|deltatime|时间步).{0,20}(?:更新|求解|积分).{0,12}(?:约束|形变体)",
        ),
        "blanket-xpbd-choice": (
            r"(?:use|choose|switch).{0,20}xpbd.{0,30}cloth.{0,20}rope.{0,24}soft bod",
            r"(?:布料|披风).{0,16}(?:绳索|绳子).{0,16}(?:软体).{0,24}(?:统一|全部).{0,12}(?:xpbd)",
        ),
    }
    for raw_line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", raw_line)
        clauses = [
            normalize(raw_clause)
            for raw_clause in re.split(
                r"(?<=[.!?。！？])\s*|[;；]|"
                r"[,，]\s*(?=(?:(?:use|set|run|enable|increase|raise|double|switch)\b|改为|使用|采用|设置|设为|启用|开启|增加|提高|固定))|"
                r"\s*[—–]\s*(?=(?:(?:use|set|run|enable|increase|raise|double|switch)\b|改为|使用|采用|设置|设为|启用|开启|增加|提高|固定))",
                line,
                flags=re.IGNORECASE,
            )
            if normalize(raw_clause)
        ]
        for index, clause in enumerate(clauses):
            if not clause or negation.search(clause):
                continue
            if index + 1 < len(clauses) and trailing_retraction.search(clauses[index + 1]):
                continue
            for code, variants in patterns.items():
                if any(re.search(pattern, clause, re.IGNORECASE) for pattern in variants):
                    violations.add(code)
    return violations


def assert_deformable_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter["name"] == "cloth-rope-soft-bodies"
    description = frontmatter["description"]
    assert description.startswith("Use when")
    for trigger in (
        "cloth", "cape", "rope", "cable", "soft body", "deformable", "PBD",
        "XPBD", "compliance", "self-collision", "tearing", "LOD", "布料",
        "披风", "绳索", "软体", "形变", "自碰撞", "撕裂",
    ):
        assert trigger in description

    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    assert re.findall(r"^## (.+)$", body, re.MULTILINE) == list(HEADINGS)

    required_contract = (
        "Sources: primary PBD/XPBD, cloth, rope, FEM/projective, collision, and tearing literature; audited official backends. APIs adapter-owned.",
        "gameplay role/authority/topology class",
        "mass-spring/PBD/XPBD/FEM-projective/cosmetic",
        "Unknown method choices block tuning and acceptance.",
        "world/gravity/units; rest geometry; particle/element masses or densities and distribution",
        "fixed-dt; render-input/kinematic-target sampling; fixed-tick consumption; interpolation",
        "stretch/shear/bend/area/volume constraints-or-energies; constitutive/compliance parameters; damping/drag",
        "solver order/warm-start/substep-iteration policy; label values physical or iteration-dependent",
        "local attachment frames; one-/two-way coupling and reaction transfer",
        "previous/current animated-collider transforms; teleport/discontinuity policy",
        "proxies/masks/sidedness/thickness-margin; discrete/continuous collision; initial overlaps/friction",
        "self-collision adjacency exclusions/broad phase/contact caps",
        "tearing/plasticity trigger/hysteresis/topology mutation/conservation/limits/authority/replication",
        "skinning/normals/simulation-render mapping; LOD state transfer; sleep/wake/offscreen behavior",
        "determinism and replay scope; active counts; memory/CPU budgets; observables/tolerances/rollback/degradation",
        "Never infer 20 iterations, 4 substeps, doubled thickness, or all-vertex self-collision.",
    )
    for field in required_contract:
        assert field in body

    stages = (
        "freeze one pose/state authority",
        "isolate cloth, rope, and soft-body representations without collision",
        "sweep fixed dt/substeps/iterations only as controlled variables",
        "add attachments and animated colliders",
        "add external collision before self-collision",
        "add budgeted self-collision",
        "add area/volume preservation, then tearing/plasticity",
        "profile worst-case declared active counts",
    )
    for stage in stages:
        assert stage in body
    assert [body.index(stage) for stage in stages] == sorted(body.index(stage) for stage in stages)

    for invariant in (
        "rest-relative stretch and signed oriented-rest-volume error",
        "signed proxy/thickness separation",
        "direct particle teleport is reset-only",
        "no duplicate/opposed pair contacts",
        "cap hits observable",
        "atomic topology/adjacency/render/state/conservation update",
        "preserve attachments/gameplay contacts/authority/collision safety/bounded state",
        "projection/state transfer and hysteresis",
        "never skip random bodies/ticks",
    ):
        assert invariant in body

    for evidence in (
        "identical-seed/input A/B",
        "A=current render-dependent/high-stiffness/all-self-collision/doubled-thickness/iteration proposal",
        "B=staged fixed-tick candidate",
        "render 30/60/120 FPS; physics 60 Hz",
        "hanging/sag/prescribed deformation/attachment/collider/fold/rope/soft-body/tear/teleport/sleep/LOD/worst-count",
        "max/p50/p95 stretch error",
        "shear error",
        "bend error",
        "area error",
        "volume error",
        "attachment error",
        "penetration duration; candidate/contact/exclusion/duplicate/cap counts",
        "force residual",
        "multipliers/impulses/energy/work/nonfinite state",
        "tear topology counts and mass change",
        "LOD transition counts and projection/pop evidence",
        "active particles/elements/bodies; memory; CPU p50/p95/p99",
        "CPU p95 <=2 ms",
        "Ordinary reject",
        "Fatal stop and roll back",
        "Undeclared method decisions, tolerances, or active counts block tuning and acceptance.",
    ):
        assert evidence in body

    for api_symbol in (
        "ChaosCloth", "NvCloth", "UnityEngine.Cloth", "PxSoftBody",
        "SoftBody3D", "UChaosClothComponent", "FClothingSimulation",
    ):
        assert api_symbol not in body
    assert positive_prescription_violations(body) == set()


def deformable_response_violations(response: str) -> set[str]:
    """Return scoped failures for the exact Task 11 scenario and mutations."""
    violations = positive_prescription_violations(response)
    headings = re.findall(r"(?m)^##[ \t]+(.+?)[ \t]*$", response)
    if headings != list(HEADINGS):
        violations.add("sections")

    normalized = normalize(response)
    baseline_magic = {
        "invented-beta": r"β.{0,24}0[.]5|beta.{0,24}0[.]5",
        "invented-substep-ranges": r"1\s*[～~–—-]\s*4.{0,24}(?:substeps?|子步)|1\s*[～~–—-]\s*2.{0,24}(?:substeps?|子步)",
        "invented-1.6ms-target": r"1[.]6\s*ms",
        "invented-lod-recipes": r"l0\s*交互级.{0,500}l1\s*近景级.{0,500}l2\s*远景级.{0,500}l3\s*非活跃级",
        "blanket-xpbd-choice": r"披风、绳子和软体.{0,40}统一改成\s*xpbd",
    }
    for code, pattern in baseline_magic.items():
        if re.search(pattern, normalized, re.IGNORECASE):
            violations.add(code)

    required_groups = {
        "method-authority-contract": (
            r"gameplay role|玩法角色", r"authority|权威", r"topology class|拓扑类别",
            r"cloth|披风|布料", r"rope|绳子|绳索", r"soft bod|软体",
            r"pbd|xpbd|fem|projective|有限元|投影动力学|cosmetic|装饰",
            r"gameplay.{0,30}budget|玩法.{0,30}预算|材料行为.{0,30}预算.{0,30}误差",
        ),
        "timing-material-contract": (
            r"rest geometry|静止几何|静息几何", r"mass distribution|质量分布",
            r"fixed.dt|固定时间步|固定\s*tick", r"render.{0,30}interpol|渲染.{0,30}插值",
            r"warm.start|热启动",
            r"physical.{0,30}iteration.dependent|物理量.{0,40}依赖迭代|物理.{0,30}迭代相关",
        ),
        "coupling-reaction-contract": (
            r"local anchor|local attachment|局部锚点|局部附着|局部框架",
            r"one.way|单向", r"two.way|双向", r"reaction transfer|反作用传递|反作用.{0,20}(?:交给|回传)|回传力",
            r"previous.{0,20}current.{0,30}(?:collider|transform)|碰撞体.{0,50}前一/当前变换|碰撞体.{0,30}前一.{0,20}当前|碰撞体历史.{0,80}上一.{0,20}当前物理变换",
            r"teleport|瞬移|不连续",
        ),
        "collision-contract": (
            r"proxies|代理", r"masks?|掩码", r"sidedness|单/双面|单双面|侧面规则|面向性",
            r"initial overlap|初始重叠", r"friction|摩擦", r"adjacency exclusion|邻接排除",
            r"broad phase|broad.phase|宽相", r"contact caps?|接触上限", r"cap hits?|上限命中",
        ),
        "tear-contract": (
            r"trigger|触发", r"hysteresis|滞回|迟滞",
            r"maximum.{0,20}(?:events|pieces)|最大.{0,20}(?:事件|碎片)|每.{0,12}(?:tick|帧).{0,20}(?:拓扑变化|撕裂).{0,12}上限|撕裂限制.{0,50}每\s*tick",
            r"replication event|复制事件|复制语义|同步事件|权威事件", r"atomic|原子", r"mass.{0,20}conserv|质量.{0,20}守恒",
        ),
        "lod-contract": (
            r"state transfer|状态传递|状态转移|转移.{0,60}求解状态", r"projection|投影", r"hysteresis|滞回|迟滞",
            r"preserve.{0,50}attachments|保留.{0,50}附着|保留.{0,20}抓点", r"gameplay contacts|玩法接触",
            r"collision safety|碰撞安全", r"never skip random|不得随机跳过|不能随机跳过",
        ),
        "acceptance-evidence": (
            r"identical.seed|相同随机种子|相同\s*seed|相同初态.{0,20}随机种子", r"a/b", r"30.{0,12}60.{0,12}120.{0,20}fps",
            r"p50", r"p95", r"p99", r"penetration duration|穿透.{0,12}持续",
            r"duplicate pairs?|重复对|重复接触", r"projection error|投影误差", r"cpu.{0,20}2\s*ms",
        ),
    }
    for code, patterns in required_groups.items():
        if any(not re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns):
            violations.add(code)

    english_method_blocker = bool(re.search(
        r"(?:unknown|undeclared|未声明|未知).{0,40}(?:method|方法|method decisions|方法决策).{0,80}"
        r"(?:block|阻塞).{0,30}(?:tuning|调参).{0,30}(?:acceptance|验收)",
        normalized,
    ))
    chinese_method_blocker = bool(
        re.search(r"方法选择尚未完成.{0,30}阻塞.{0,20}调参", normalized)
        and re.search(r"阻塞.{0,40}方法选择.{0,240}不得.{0,40}最终接受或拒绝", normalized)
    )
    method_blocker = english_method_blocker or chinese_method_blocker
    english_tolerance_blocker = bool(re.search(
        r"(?:unknown|undeclared|未声明|未知).{0,40}(?:tolerances?|容差).{0,80}"
        r"(?:block|阻塞).{0,30}(?:tuning|调参).{0,30}(?:acceptance|验收)",
        normalized,
    ))
    chinese_tolerance_blocker = bool(
        re.search(r"误差容(?:限|差).{0,100}调参.{0,80}验收.{0,30}阻塞", normalized)
        or re.search(r"误差容(?:限|差).{0,80}(?:未知|未声明).{0,30}阻塞.{0,20}调参.{0,20}验收", normalized)
        or re.search(r"阻塞.{0,120}误差容(?:限|差).{0,240}不得.{0,40}最终接受或拒绝", normalized)
    )
    tolerance_blocker = english_tolerance_blocker or chinese_tolerance_blocker
    if not method_blocker:
        violations.add("unknown-method-blocker")
    if not tolerance_blocker:
        violations.add("unknown-tolerance-blocker")

    acceptance = re.search(r"(?ms)^## Acceptance\s*(.*)\Z", response)
    acceptance_text = normalize(acceptance.group(1)) if acceptance else ""
    if not re.search(r"ordinary reject|普通拒绝|普通不通过", acceptance_text):
        violations.add("ordinary-reject")
    if not (
        re.search(r"fatal stop|致命停止", acceptance_text)
        and re.search(r"roll back|rollback|回滚", acceptance_text)
    ):
        violations.add("fatal-stop-rollback")

    has_determinism_scope = bool(re.search(
        r"determin(?:ism|istic) scope|确定性范围|确定性作用域|确定性边界",
        normalized,
    ))
    has_replay_scope = bool(re.search(
        r"replay|state hash|回放|重放|状态哈希",
        normalized,
    ))
    if not (has_determinism_scope and has_replay_scope):
        violations.add("determinism-replay-scope")

    has_memory_budget_contract = bool(re.search(
        r"(?:memory budget|内存预算).{0,80}(?:unknown|undeclared|block|未知|未声明|阻塞|<=|≤|limit|上限)"
        r"|(?:unknown|undeclared|block|未知|未声明|阻塞).{0,80}(?:memory budget|内存预算)",
        normalized,
    ))
    if not has_memory_budget_contract:
        violations.add("memory-budget-blocker")

    deformation_metric_terms = (
        r"stretch|拉伸",
        r"shear|剪切",
        r"bend|弯曲",
        r"area|面积",
        r"volume|体积",
        r"attachment|附着",
    )
    if any(not re.search(pattern, acceptance_text) for pattern in deformation_metric_terms):
        violations.add("deformation-component-metrics")
    if not re.search(r"force residual|力残差|力的残差", acceptance_text):
        violations.add("force-residual-metrics")
    if not (
        re.search(r"topology (?:count|counts)|拓扑(?:数量|计数)|(?:顶点|边|面|单元)(?:数|数量|计数)", acceptance_text)
        and re.search(r"mass change|质量(?:变化|改变量)", acceptance_text)
    ):
        violations.add("tear-topology-count-mass-change-metrics")
    if not re.search(
        r"lod (?:transition|transitions|transition count)|lod\s*(?:切换|转换)(?:次数|计数|数量)",
        acceptance_text,
    ):
        violations.add("lod-transition-metrics")
    return violations


class ClothRopeSoftBodiesSkillTests(unittest.TestCase):
    def test_skill_exposes_complete_engine_neutral_contract(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_deformable_skill_contract(frontmatter, body)

    def test_contract_mutations_cannot_drop_decisions_stages_or_stop_rules(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        for required in (
            "mass-spring/PBD/XPBD/FEM-projective/cosmetic",
            "Unknown method choices block tuning and acceptance.",
            "one-/two-way coupling and reaction transfer",
            "self-collision adjacency exclusions/broad phase/contact caps",
            "add external collision before self-collision",
            "atomic topology/adjacency/render/state/conservation update",
            "projection/state transfer and hysteresis",
            "Ordinary reject",
            "Fatal stop and roll back",
        ):
            with self.subTest(required=required):
                with self.assertRaises(AssertionError):
                    assert_deformable_skill_contract(frontmatter, body.replace(required, ""))

    def test_replay_scope_and_each_named_metric_are_deletion_protected(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_deformable_skill_contract(frontmatter, body)
        for required in (
            "replay scope",
            "stretch error",
            "shear error",
            "bend error",
            "area error",
            "volume error",
            "attachment error",
            "force residual",
            "tear topology counts",
            "mass change",
            "LOD transition counts",
        ):
            with self.subTest(required=required):
                with self.assertRaises(AssertionError):
                    assert_deformable_skill_contract(frontmatter, body.replace(required, ""))

    def test_named_source_scopes_and_explicit_ab_sides_are_deletion_protected(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_deformable_skill_contract(frontmatter, body)
        for required in (
            "primary PBD/XPBD",
            "cloth",
            "rope",
            "FEM/projective",
            "collision",
            "tearing literature",
            "A=current render-dependent",
            "high-stiffness",
            "all-self-collision",
            "doubled-thickness/iteration proposal",
            "B=staged fixed-tick candidate",
        ):
            with self.subTest(required=required):
                with self.assertRaises(AssertionError):
                    assert_deformable_skill_contract(frontmatter, body.replace(required, ""))

    def test_skill_rejects_magic_tuning_and_engine_api_mutations(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        shortcuts = (
            "Set solver iterations to 20.",
            "Use exactly four substeps.",
            "Double collision thickness to 2 cm.",
            "Enable self-collision for 100% of vertices.",
            "Update cloth constraints using render deltaTime.",
            "Use XPBD for cloth, rope, and soft bodies.",
            "Use UnityEngine.Cloth for the cape.",
        )
        for shortcut in shortcuts:
            with self.subTest(shortcut=shortcut):
                with self.assertRaises(AssertionError):
                    assert_deformable_skill_contract(frontmatter, f"{body}\n{shortcut}")

    def test_baseline_is_exact_and_fails_named_scoped_evidence_gates(self):
        raw = BASELINE_FIXTURE.read_bytes()
        baseline = raw.decode("utf-8")
        evaluation = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 7662)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "c9519626498067478406948079ad1d8ab1c17462c29bba5d6803bfe4fead0e2b",
        )
        self.assertEqual(validate_evaluation_record(evaluation), [])
        self.assertEqual(evaluation["skill"], "cloth-rope-soft-bodies")
        self.assertEqual(evaluation["scenario"], SCENARIO)
        self.assertEqual(evaluation["baseline"]["response"].encode("utf-8"), raw)
        provenance = " ".join(evaluation["evidence"])
        self.assertIn("7,662 UTF-8 bytes", provenance)
        self.assertIn("c9519626498067478406948079ad1d8ab1c17462c29bba5d6803bfe4fead0e2b", provenance)
        violations = deformable_response_violations(baseline)
        expected = {
            "sections",
            "invented-beta",
            "invented-substep-ranges",
            "invented-1.6ms-target",
            "invented-lod-recipes",
            "blanket-xpbd-choice",
            "method-authority-contract",
            "coupling-reaction-contract",
            "collision-contract",
            "tear-contract",
            "lod-contract",
            "unknown-method-blocker",
            "unknown-tolerance-blocker",
            "ordinary-reject",
            "fatal-stop-rollback",
        }
        self.assertTrue(expected.issubset(violations), violations)

    def test_positive_numeric_mutations_reject_in_english_and_chinese(self):
        mutations = {
            "positive-solver-prescription": (
                "Set solver iterations to 20.",
                "Use 20 solver iterations.",
                "Use 12 solver iterations.",
                "把求解器迭代次数设为20次。",
                "采用20次求解器迭代。",
                "求解器迭代使用12次。",
            ),
            "positive-substep-prescription": (
                "Use exactly four substeps.",
                "Run 4 physics substeps.",
                "Use physics substeps: 4.",
                "每个渲染帧固定使用4个substeps。",
                "采用四个物理子步。",
                "物理子步固定为4个。",
            ),
            "positive-thickness-prescription": (
                "Double collision thickness.",
                "Set collision thickness to 2 cm.",
                "Increase collision thickness by a factor of two.",
                "Increase collision thickness 2x.",
                "Use 2x collision thickness.",
                "把collision thickness加倍。",
                "collision thickness设为2厘米。",
                "把碰撞厚度提高到原来的2倍。",
                "采用2倍碰撞厚度。",
            ),
            "positive-all-self-collision": (
                "Enable self-collision on all vertices.",
                "Enable self-collision for 100% of vertices.",
                "Enable all-vertex self-collision.",
                "对所有顶点开self-collision。",
                "对100%的顶点开启自碰撞。",
                "启用全顶点自碰撞。",
            ),
        }
        for code, variants in mutations.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    self.assertIn(code, positive_prescription_violations(variant))

    def test_negative_clause_cannot_mask_a_later_positive_prescription(self):
        mutations = (
            "Do not set solver iterations to 20; set solver iterations to 12.",
            "Do not use 20 solver iterations; use 12 solver iterations.",
            "Do not use 20 solver iterations, use 12 solver iterations.",
            "Do not use 20 solver iterations — use 12 solver iterations.",
            "不要把求解器迭代次数设为20次；改为12次求解器迭代。",
            "不要采用20次求解器迭代；求解器迭代使用12次。",
            "不要使用20次求解器迭代，改为12次求解器迭代。",
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                self.assertIn(
                    "positive-solver-prescription",
                    positive_prescription_violations(mutation),
                )

    def test_trailing_negative_retractions_preserve_diagnosis(self):
        diagnoses = (
            "Use 20 solver iterations? Never.",
            "使用20次求解器迭代？绝不。",
        )
        for diagnosis in diagnoses:
            with self.subTest(diagnosis=diagnosis):
                self.assertEqual(positive_prescription_violations(diagnosis), set())

    def test_negative_diagnosis_of_numeric_shortcuts_is_allowed(self):
        diagnoses = (
            "Do not set solver iterations to 20.",
            "不要把求解器迭代次数设为20次。",
            "The current proposal uses four substeps per render frame; remove it.",
            "删除每个渲染帧固定使用4个substeps的旧方案。",
            "Do not set collision thickness to 2 cm or double it.",
            "不要把collision thickness设为2厘米或加倍。",
            "Reject self-collision for 100% of vertices.",
            "拒绝对100%的顶点开启自碰撞。",
        )
        for diagnosis in diagnoses:
            with self.subTest(diagnosis=diagnosis):
                self.assertEqual(positive_prescription_violations(diagnosis), set())

    def test_unknown_methods_and_tolerances_remain_acceptance_blockers(self):
        missing_method = (
            "Unknown tolerances block tuning and acceptance. "
            "Cloth, rope, and soft-body methods are listed but not selected."
        )
        missing_tolerance = (
            "Unknown method decisions block tuning and acceptance. "
            "Error tolerances are not declared."
        )
        self.assertIn("unknown-method-blocker", deformable_response_violations(missing_method))
        self.assertIn("unknown-tolerance-blocker", deformable_response_violations(missing_tolerance))

    def test_first_enabled_attempt_is_exact_and_fails_only_real_scoped_gaps(self):
        raw = ATTEMPT1_FIXTURE.read_bytes()
        response = raw.decode("utf-8")
        evaluation = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 9251)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "ea523247c1ff083b2cd42950c0ae98a0404e1807a6486949fc936a0956fa01df",
        )
        self.assertIn("first fresh exact enabled attempt fails", evaluation["enabled"]["observations"])
        self.assertEqual(
            deformable_response_violations(response),
            {
                "determinism-replay-scope",
                "memory-budget-blocker",
                "deformation-component-metrics",
                "force-residual-metrics",
                "tear-topology-count-mass-change-metrics",
                "lod-transition-metrics",
            },
        )
        provenance = " ".join(evaluation["evidence"])
        self.assertIn("9,251 UTF-8 bytes", provenance)
        self.assertIn("ea523247c1ff083b2cd42950c0ae98a0404e1807a6486949fc936a0956fa01df", provenance)

    def test_second_enabled_attempt_is_exact_and_passes_scoped_evidence_gate(self):
        raw = ENABLED_FIXTURE.read_bytes()
        response = raw.decode("utf-8")
        evaluation = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(len(raw), 18917)
        self.assertEqual(
            hashlib.sha256(raw).hexdigest(),
            "ea06c54b7c22a1743e89b871a1488e0a0951973a35049f28a6433ccd12120d58",
        )
        self.assertEqual(evaluation["enabled"]["response"].encode("utf-8"), raw)
        self.assertIn("first fresh exact enabled attempt fails", evaluation["enabled"]["observations"])
        self.assertIn("second fresh exact enabled attempt passes", evaluation["enabled"]["observations"])
        self.assertEqual(evaluation["verdict"], "pass")
        self.assertEqual(deformable_response_violations(response), set())
        provenance = " ".join(evaluation["evidence"])
        self.assertIn("9,251 UTF-8 bytes", provenance)
        self.assertIn("ea523247c1ff083b2cd42950c0ae98a0404e1807a6486949fc936a0956fa01df", provenance)
        self.assertIn("18,917 UTF-8 bytes", provenance)
        self.assertIn("ea06c54b7c22a1743e89b871a1488e0a0951973a35049f28a6433ccd12120d58", provenance)

    def test_enabled_gate_requires_exactly_the_four_markdown_h2_sections(self):
        response = ENABLED_FIXTURE.read_text(encoding="utf-8")
        extra_section = f"{response}\n## Notes\nNo contract changes.\n"
        wrong_level = response.replace("## Deformable contract", "# Deformable contract", 1)
        self.assertIn("sections", deformable_response_violations(extra_section))
        self.assertIn("sections", deformable_response_violations(wrong_level))


if __name__ == "__main__":
    unittest.main()
