"""Focused contract and evidence-regression tests for vehicle-physics."""

import json
import hashlib
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "vehicle-physics" / "SKILL.md"
EVALUATION = ROOT / "evaluations" / "vehicle-physics" / "evaluation.json"
BASELINE_FIXTURE = ROOT / "tests" / "fixtures" / "vehicle-physics-baseline-response.txt"
ATTEMPT1_FIXTURE = ROOT / "tests" / "fixtures" / "vehicle-physics-enabled-attempt-1-response.txt"
ENABLED_FIXTURE = ROOT / "tests" / "fixtures" / "vehicle-physics-enabled-response.txt"

SCENARIO = "我在做一辆 60 FPS 四轮联机赛车。当前每个渲染帧读取油门/转向并对车体直接 AddForce；四个悬挂用单条向下 ray，弹簧力直接用本帧 deltaTime。平地高速时车轮开始高频跳动，压路肩会突然翻车，落地后弹跳很多次；把帧率从 120 降到 30 后加速、最高速和转向都变了。坡道起步会后溜，空中仍能像地面一样转向。服务端负责比赛结果，但客户端也在本地模拟并直接同步 transform。有人建议把 spring、damper、轮胎 friction 和 downforce 一起调大，再锁死质心。请给一个引擎无关、可测试的修复方案；目标物理 fixed tick 60 Hz，CPU p95 预算 2 ms。项目尚未给出质量、轴距、轮距、质心、悬挂行程、轮胎模型、驱动形式、最高速或网络延迟容差。"

HEADINGS = (
    "Vehicle contract",
    "Staged diagnosis",
    "Forces, controls, and networking",
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


def assert_vehicle_skill_contract(frontmatter: dict[str, str], body: str) -> None:
    assert frontmatter["name"] == "vehicle-physics"
    description = frontmatter["description"]
    assert description.startswith("Use when")
    for trigger in (
        "vehicle", "car", "wheel", "suspension", "tire", "drivetrain",
        "aero", "handling", "telemetry", "network authority", "fixed tick",
        "车辆", "汽车", "车轮", "悬挂", "轮胎", "传动", "操控", "联机",
    ):
        assert trigger in description

    assert len(re.findall(r"\b[\w'-]+\b", body)) <= 500
    headings = re.findall(r"^## (.+)$", body, re.MULTILINE)
    assert headings == list(HEADINGS)

    required_contract = (
        "arcade/hybrid/simulation fidelity",
        "ray/sweep-or-shape-cast/rigid-contact",
        "single authoritative simulation-pose owner",
        "gameplay/network authority; prediction/interpolation/correction boundaries",
        "world-up/gravity/units",
        "chassis mass/dimensions/wheelbase/tracks/COM/inertia tensor",
        "wheel radius/width/mass/inertia; driven/steered/braked layout",
        "fixed-dt; render-input sample/cache/exactly-once consumption; render interpolation",
        "substep/iteration values remain measured unknowns",
        "suspension hardpoints/axes/rest-length/travel/spring/damper/bump-droop stops",
        "unsprung representation/contact filters/initial-overlap/curb-edge policy",
        "contact-frame/normal-load/longitudinal-lateral slip/combined-slip",
        "low-speed regularization/load-sensitivity/surface/relaxation/force-caps/signs",
        "torque-curve/clutch/gears/differential/final-drive/wheel-angular dynamics",
        "brakes/handbrake/reverse/hill-hold",
        "aero application-points; drag/downforce-centers/weight-transfer; steering/assists/traction/ABS/stability/airborne policy",
        "telemetry/budgets/reversible degradation",
        "All missing project values stay unknown",
        "Unresolved fidelity OR contact representation blocks tuning AND acceptance.",
    )
    for field in required_contract:
        assert field in body

    stages = (
        "freeze networking/assists",
        "geometry/COM/inertia/filters/contact normals-points/curbs without propulsion",
        "one-wheel-or-quarter-car suspension",
        "four-wheel equilibrium/drop/landing before tires",
        "longitudinal then lateral tires/combined slip/surface transitions",
        "drivetrain/brakes/steering/assists, then aero",
        "authoritative networking/prediction/interpolation/correction/cosmetic wheels",
        "profile; measured query/substep/LOD tiers only after correctness",
    )
    for stage in stages:
        assert stage in body
    offsets = [body.index(stage) for stage in stages]
    assert offsets == sorted(offsets)

    for force_rule in (
        "relative chassis/wheel contact-point velocities projected on suspension axis",
        "compression/force signs; equal/opposite reactions when represented",
        "force-versus-impulse units match integration mode",
        "wheel circumferential speed versus patch-relative velocity",
        "near-zero-speed handling",
        "combined-slip law and available normal load",
        "drive/brake/tire-reaction torques",
        "airborne control absent unless declared arcade authority",
        "Server-authoritative competitive chassis",
        "cosmetic wheels never feed authoritative contacts",
        "authority/fixed-step/collision-safety/gameplay contacts never degrade",
    ):
        assert normalize(force_rule) in normalize(body)

    for evidence_rule in (
        "identical-seed/identical-input A/B",
        "render 30/60/120 FPS; physics 60 Hz",
        "straight/coast; circle/slalom; hill; two-sided-curb; drop/landing; jump; brake/reverse; surface-transition; server-correction",
        "per-wheel hit/point/normal/compression/travel/cap/relative-axial-speed/forces/load/slips/utilization/angular-speed/torques",
        "chassis pose/velocities/COM/inertia/contacts/penetration/energy-work/acceleration/speed/yaw-roll",
        "authority-correction/replay-hash/query-substep-count/p50-p95-p99",
        "CPU p95 <= 2 ms",
        "accept declared tolerances",
        "Reject outside tolerance",
        "Stop and roll back",
    ):
        assert evidence_rule in body

    for api_symbol in (
        "Rigidbody.AddForce", "WheelCollider", "ChaosWheeledVehicle",
        "PxVehicle", "VehicleBody3D", "b2WheelJoint",
    ):
        assert api_symbol not in body
    for unsupported in (
        "Use exactly two physics substeps.",
        "Set damping ratio to 0.7-1.0.",
        "Use an approximately 1% tolerance.",
        "Add a 144 FPS acceptance run.",
        "Lock the COM and raise downforce to cure curb flips.",
        "Client and server both directly own and sync the chassis transform.",
        "Call Rigidbody.AddForce every render frame.",
    ):
        assert unsupported not in body


def vehicle_response_violations(response: str) -> set[str]:
    """Return scoped failures for the exact Task 10 pressure scenario."""
    violations: set[str] = set()
    headings = re.findall(
        rf"(?mi)^\s*(?:#{{1,3}}\s*)?({'|'.join(map(re.escape, HEADINGS))})\s*$",
        response,
    )
    if headings != list(HEADINGS):
        violations.add("sections")

    normalized = normalize(response)
    acceptance_match = re.search(r"(?ms)^## Acceptance\s*(.*)\Z", response)
    acceptance_normalized = normalize(acceptance_match.group(1)) if acceptance_match else ""
    magic_patterns = {
        "invented-two-substeps": r"(?:fixed|固定).{0,24}(?:2|two|两个).{0,20}(?:substeps?|子步)",
        "invented-damping-range": r"0[.,]7\s*[–—-]\s*1[.,]0",
        "invented-one-percent": r"(?:约|approximately|about|~)?\s*1\s*%",
        "invented-144-fps": r"144\s*fps",
    }
    clauses = [normalize(part) for part in re.split(r"[。；;\n]", response) if part.strip()]
    negation = re.compile(
        r"\b(?:do not|don't|never|remove|reject)\b|不要|不得|不能|禁止|删除|不增加|不预设",
        re.IGNORECASE,
    )
    for code, pattern in magic_patterns.items():
        if any(
            re.search(pattern, clause, re.IGNORECASE) and not negation.search(clause)
            for clause in clauses
        ):
            violations.add(code)

    shortcut_lines = {
        normalize("Set all spring, damper, tire friction, and downforce values higher."): "magic-coefficient-cure",
        normalize("Lock the COM and raise downforce to cure curb flips."): "locked-com-downforce-cure",
        normalize("Client and server both directly own and sync the chassis transform."): "dual-pose-authority",
        normalize("Choose one downward ray per wheel without declaring fidelity or contact policy."): "unqualified-ray-contact",
    }
    for raw_line in response.splitlines():
        candidate = normalize(re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", raw_line))
        if candidate in shortcut_lines:
            violations.add(shortcut_lines[candidate])
        positive_patterns = {
            "positive-substep-prescription": (
                r"^(?:use exactly|set|fix(?:ed)?(?: at)?).{0,24}(?:four|4).{0,16}(?:physics )?substeps?",
                r"^固定使用(?:四个|4个)物理子步",
            ),
            "positive-iteration-prescription": (
                r"^set.{0,20}solver iterations?.{0,12}(?:to )?12",
                r"^将求解器迭代设为\s*12\s*次",
            ),
            "extra-render-fps": (
                r"^add.{0,20}90\s*fps.{0,24}acceptance run",
                r"^验收增加\s*90\s*fps",
            ),
            "positive-damping-prescription": (
                r"^set.{0,20}damping ratio.{0,12}(?:to )?0[.]85",
                r"^将阻尼比设为\s*0[.]85",
            ),
            "dual-pose-authority": (
                r"^let the client.{0,32}authoritative.{0,36}chassis.{0,36}server.{0,24}(?:also )?owns?",
                r"^客户端权威模拟底盘.{0,24}服务端也拥有比赛状态",
            ),
            "prescriptive-versioned-api": (
                r"^(?:use|call|configure|set up|使用|调用|配置).{0,32}(?:wheelcollider|(?:rigidbody[.])?addforce|pxvehicle|chaoswheeledvehicle|vehiclebody3d|b2wheeljoint|fbodyinstance)",
            ),
        }
        for code, patterns in positive_patterns.items():
            if any(re.search(pattern, candidate, re.IGNORECASE) for pattern in patterns):
                violations.add(code)

    required_groups = {
        "fidelity-contact-contract": (
            r"arcade|街机", r"hybrid|混合", r"simulation fidelity|simulation|仿真保真|仿真",
            r"ray", r"sweep|shape cast|形状投射|形状扫掠", r"rigid contact|刚性接触|刚体轮|刚体接触轮",
        ),
        "single-authority-contract": (
            r"server.{0,80}authorit|服务端.{0,80}权威",
            r"single authoritative simulation-pose owner|唯一.{0,30}(?:simulation|模拟|车身)?.{0,12}(?:pose|姿态|位姿).{0,12}(?:owner|所有者)",
            r"prediction|预测", r"interpolation|插值", r"correction|纠正|校正",
        ),
        "vehicle-parameter-contract": (
            r"wheelbase|轴距", r"tracks?|轮距", r"com|质心",
            r"inertia tensor|惯量张量|惯性张量", r"wheel radius|车轮半径|轮胎半径",
            r"driven.{0,12}steered.{0,12}braked|驱动.{0,12}转向.{0,12}制动",
        ),
        "same-frame-suspension-tire": (
            r"relative.{0,30}point veloc|相对.{0,20}点速度|两端相对轴向速度|vsurfaceatcontact|v_c\s*-\s*v_w",
            r"suspension axis|悬挂轴", r"equal.{0,10}opposite|等大反向|等大反作用|反作用力应成对|f_chassis.{0,80}f_wheel",
            r"circumferential|圆周速度|r\s*\*?\s*ω", r"patch.relative|接地点相对|接触斑相对|接触点相对路面",
            r"combined.slip|组合滑移|联合滑移|摩擦椭圆|摩擦圆", r"near.zero|低速.{0,20}正则|低速正则|近零速度",
        ),
        "drivetrain-wheel-dynamics": (
            r"torque curve|扭矩曲线", r"differential|差速器", r"final drive|终传|主减速",
            r"wheel angular|车轮角速度|轮角动力学", r"reaction torque|反作用扭矩|反作用力矩",
            r"hill.hold|驻坡|坡道保持", r"reverse|倒车|倒挡",
        ),
        "staged-diagnosis": (
            r"without propulsion|无推进|无动力|关闭推进", r"quarter.car|四分之一车|单轮",
            r"before tires|轮胎之前|悬挂稳定后再做轮胎|暂不启用.{0,30}轮胎力", r"longitudinal.{0,24}(?:then|再).{0,24}lateral|先纵向.{0,24}再横向|先验证纵向轮胎.{0,24}再验证横向轮胎",
            r"then aero|再气动|最后才加入空气动力|最后才接入气动", r"only after correctness|正确性证据之后|正确性通过后|最后恢复.{0,80}再进行 cpu 剖析",
        ),
        "acceptance-evidence": (
            r"accept|接受|通过标准", r"roll back|rollback|回滚",
            r"nonfinite|非有限", r"energy.{0,12}growth|能量.{0,12}增长|增长.{0,12}能量",
            r"duplicate authority|重复权威|双重权威|重复姿态所有者|重复姿态权威", r"p95.{0,12}(?:不超过|<=|≤)?.{0,6}2\s*ms",
        ),
    }
    for code, patterns in required_groups.items():
        if any(not re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns):
            violations.add(code)

    if not re.search(
        r"(?:render|渲染).{0,24}30(?:/|.{0,8})60(?:/|.{0,8})120.{0,24}(?:physics|物理).{0,16}60\s*hz",
        normalized,
    ):
        violations.add("fixed-render-matrix")
    fidelity_is_blocking = bool(re.search(
        r"(?:arcade|街机).{0,40}(?:hybrid|混合).{0,40}(?:simulation|仿真).{0,100}(?:block(?:er|ing)?|阻塞)",
        normalized,
    ))
    contact_is_gated = bool(
        re.search(r"(?:wheel.{0,12}contact|轮地接触).{0,100}(?:select one|选一种)", normalized)
        and re.search(r"(?:query type|查询类型).{0,100}(?:before|前).{0,60}(?:not freeze|不冻结)", normalized)
    )
    if not (fidelity_is_blocking and contact_is_gated):
        violations.add("fidelity-contact-blocker")
    explicit_force_vectors = bool(
        re.search(r"f_chassis\s*=\s*-\s*q\s*\*?\s*s", normalized)
        and re.search(r"f_wheel\s*=\s*\+\s*q\s*\*?\s*s", normalized)
    )
    generic_force_vectors = bool(re.search(
        r"(?:f[_ ]?chassis|车身).{0,40}(?:[-+]\s*f\s*\*?\s*a|沿.{0,8}[+-]?a|反悬挂轴).{0,100}"
        r"(?:f[_ ]?(?:wheel|surface)|轮组|地面).{0,40}(?:[-+]\s*f\s*\*?\s*a|沿.{0,8}[+-]?a|相反)",
        normalized,
    ))
    if not (explicit_force_vectors or generic_force_vectors):
        violations.add("force-reaction-signs")
    ordinary_rejection = bool(
        re.search(
            r"(?:any|任一).{0,80}(?:outside tolerance|超差|超出.{0,24}容差).{0,40}(?:reject|拒绝|判失败)",
            acceptance_normalized,
        )
        or re.search(
            r"(?:ordinary reject|普通拒绝).{0,80}(?:any|任一).{0,60}(?:outside tolerance|超差|超出.{0,24}容差)",
            acceptance_normalized,
        )
    )
    if not ordinary_rejection:
        violations.add("ordinary-reject")
    if not (
        re.search(r"stop|停止", acceptance_normalized)
        and re.search(r"roll back|rollback|回滚", acceptance_normalized)
    ):
        violations.add("fatal-stop-rollback")
    if not re.search(r"missing|unknown|未知|缺少", normalized):
        violations.add("unknown-values")
    return violations


class VehiclePhysicsSkillTests(unittest.TestCase):
    def test_skill_exposes_complete_engine_neutral_contract(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        assert_vehicle_skill_contract(frontmatter, body)

    def test_contract_mutations_cannot_drop_stages_or_decision_fields(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        for required in (
            "arcade/hybrid/simulation fidelity",
            "single authoritative simulation-pose owner",
            "substep/iteration values remain measured unknowns",
            "Unresolved fidelity OR contact representation blocks tuning AND acceptance.",
            "one-wheel-or-quarter-car suspension",
            "four-wheel equilibrium/drop/landing before tires",
            "Server-authoritative competitive chassis",
            "accept declared tolerances",
            "Stop and roll back",
        ):
            with self.subTest(required=required):
                with self.assertRaises(AssertionError):
                    assert_vehicle_skill_contract(frontmatter, body.replace(required, ""))

    def test_contract_rejects_magic_tuning_dual_authority_and_engine_apis(self):
        frontmatter, body = read_frontmatter_and_body(SKILL)
        shortcuts = (
            "Use exactly two physics substeps.",
            "Set damping ratio to 0.7-1.0.",
            "Use an approximately 1% tolerance.",
            "Add a 144 FPS acceptance run.",
            "Lock the COM and raise downforce to cure curb flips.",
            "Client and server both directly own and sync the chassis transform.",
            "Call Rigidbody.AddForce every render frame.",
        )
        for shortcut in shortcuts:
            with self.subTest(shortcut=shortcut):
                mutated = f"{body}\n{shortcut}"
                with self.assertRaises(AssertionError):
                    assert_vehicle_skill_contract(frontmatter, mutated)

    def test_baseline_is_preserved_exactly_and_fails_named_evidence_gates(self):
        baseline = BASELINE_FIXTURE.read_text(encoding="utf-8")
        enabled = ENABLED_FIXTURE.read_text(encoding="utf-8")
        evaluation = json.loads(EVALUATION.read_text(encoding="utf-8"))
        self.assertEqual(evaluation["skill"], "vehicle-physics")
        self.assertEqual(evaluation["scenario"], SCENARIO)
        self.assertEqual(evaluation["baseline"]["response"], baseline)
        self.assertEqual(evaluation["enabled"]["response"], enabled)
        self.assertEqual(evaluation["verdict"], "pass")
        self.assertIn("first fresh exact attempt failed", evaluation["enabled"]["observations"])
        self.assertIn("second fresh exact attempt passes", evaluation["enabled"]["observations"])
        provenance = " ".join(evaluation["evidence"])
        self.assertIn("e6e4d915caaca3f90b51a218ab2ffd90cf5765ea389ffcfcd374a4a7c94c9cc4", provenance)
        self.assertIn("257a8c97b7b54e140c00a537ab3ef36061f6fe6fd9a6973fac3f1f41befa4885", provenance)
        self.assertIn("2d75223a98f461d933bb31d56999851b954fef8906ef94a9eb6c1962d5727bf3", provenance)
        violations = vehicle_response_violations(baseline)
        self.assertTrue(
            {
                "sections",
                "invented-two-substeps",
                "invented-damping-range",
                "invented-one-percent",
                "invented-144-fps",
                "fidelity-contact-contract",
                "vehicle-parameter-contract",
                "same-frame-suspension-tire",
                "acceptance-evidence",
                "ordinary-reject",
                "fatal-stop-rollback",
            }.issubset(violations),
            violations,
        )

    def test_evidence_gate_rejects_realistic_shortcuts_without_enabled_fixture(self):
        baseline = BASELINE_FIXTURE.read_text(encoding="utf-8")
        shortcuts = {
            "magic-coefficient-cure": "Set all spring, damper, tire friction, and downforce values higher.",
            "locked-com-downforce-cure": "Lock the COM and raise downforce to cure curb flips.",
            "dual-pose-authority": "Client and server both directly own and sync the chassis transform.",
            "unqualified-ray-contact": "Choose one downward ray per wheel without declaring fidelity or contact policy.",
        }
        for code, shortcut in shortcuts.items():
            with self.subTest(code=code):
                self.assertIn(code, vehicle_response_violations(f"{baseline}\n{shortcut}"))

    def test_evidence_gate_rejects_positive_numeric_api_and_dual_authority_mutations(self):
        response = ENABLED_FIXTURE.read_text(encoding="utf-8").rstrip("\n")
        mutations = {
            "positive-substep-prescription": (
                "Use exactly four physics substeps.",
                "固定使用四个物理子步。",
            ),
            "positive-iteration-prescription": (
                "Set solver iterations to 12.",
                "将求解器迭代设为12次。",
            ),
            "extra-render-fps": (
                "Add a 90 FPS acceptance run.",
                "验收增加90 FPS。",
            ),
            "positive-damping-prescription": (
                "Set damping ratio to 0.85.",
                "将阻尼比设为0.85。",
            ),
            "dual-pose-authority": (
                "Let the client authoritatively simulate the chassis while the server also owns the race state.",
                "客户端权威模拟底盘，同时服务端也拥有比赛状态。",
            ),
            "prescriptive-versioned-api": (
                "Use WheelCollider for all wheels.",
                "使用 WheelCollider 实现全部车轮。",
                "Use AddForce once per fixed tick.",
                "使用 AddForce 在每个固定物理 tick 施力。",
            ),
        }
        for code, variants in mutations.items():
            for variant in variants:
                with self.subTest(code=code, variant=variant):
                    self.assertIn(code, vehicle_response_violations(f"{response}\n{variant}"))
        allowed_addforce_contexts = (
            "`AddForce` names the current render-frame path.",
            "The current path calls AddForce from render frames.",
            "Delete the AddForce legacy path.",
            "Remove the render-frame AddForce path.",
            "禁止使用 AddForce 驱动物理。",
        )
        for context in allowed_addforce_contexts:
            with self.subTest(allowed_addforce_context=context):
                self.assertEqual(vehicle_response_violations(f"{response}\n{context}"), set())

    def test_second_enabled_attempt_passes_scoped_evidence_gate(self):
        response = ENABLED_FIXTURE.read_text(encoding="utf-8")
        self.assertEqual(vehicle_response_violations(response), set())

    def test_exact_evaluator_bytes_hashes_and_attempt_history(self):
        evaluation = json.loads(EVALUATION.read_text(encoding="utf-8"))
        fixtures = (
            (
                BASELINE_FIXTURE,
                11451,
                "e6e4d915caaca3f90b51a218ab2ffd90cf5765ea389ffcfcd374a4a7c94c9cc4",
            ),
            (
                ATTEMPT1_FIXTURE,
                8994,
                "257a8c97b7b54e140c00a537ab3ef36061f6fe6fd9a6973fac3f1f41befa4885",
            ),
            (
                ENABLED_FIXTURE,
                12808,
                "2d75223a98f461d933bb31d56999851b954fef8906ef94a9eb6c1962d5727bf3",
            ),
        )
        for path, byte_count, digest in fixtures:
            with self.subTest(path=path.name):
                raw = path.read_bytes()
                self.assertEqual(len(raw), byte_count)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
        self.assertEqual(
            evaluation["baseline"]["response"].encode("utf-8"),
            BASELINE_FIXTURE.read_bytes(),
        )
        self.assertEqual(
            evaluation["enabled"]["response"].encode("utf-8"),
            ENABLED_FIXTURE.read_bytes(),
        )
        self.assertEqual(
            vehicle_response_violations(ATTEMPT1_FIXTURE.read_text(encoding="utf-8")),
            {
                "fidelity-contact-blocker",
                "force-reaction-signs",
                "ordinary-reject",
                "fatal-stop-rollback",
            },
        )
        history = evaluation["enabled"]["observations"] + " " + " ".join(evaluation["evidence"])
        self.assertIn("first fresh exact attempt failed", history)
        self.assertIn("second fresh exact attempt passes", history)


if __name__ == "__main__":
    unittest.main()
