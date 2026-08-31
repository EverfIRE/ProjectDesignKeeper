# Task 6 Phase A Report

## Baseline evidence

The supplied fresh baseline is preserved verbatim in
`evaluations/architecting-real-time-physics/evaluation.json`. It assumed a
Unity-like scale and a 60 Hz step, then supplied mass, damping, gravity,
solver, and impulse coefficients before the project had a units, timing,
authority, or budget contract. It did not specify overload policy,
observability, acceptance tolerances, or a degradation path.

## Authored contract

`architecting-real-time-physics` is an engine-neutral, English entrypoint.
Its body requires a compact Physics Contract covering authority/cosmetics,
scale, fixed stepping, overload, representations, networking, platform
budgets, observability, acceptance, and degradation. It treats measured 60
FPS and 60 Hz as starting hypotheses, separates rendering cadence from fixed
simulation, gives the 30/60/120 Hz scaling boundary, and refuses unbounded
coefficient tuning. Versioned API symbols remain adapter-owned; source anchors
are deferred to the Task 30 pinned snapshot.

## Phase A evaluation state

The evaluation record is a deliberate template. It contains the exact
baseline and marks the enabled result `fail` pending a fresh controller run;
it does not invent an enabled response, observations, or passing evidence.

## First enabled attempt: failed

The controller's first fresh enabled attempt refused arbitrary coefficients,
separated 60 FPS from a 60 Hz starting hypothesis, and proposed measurement.
It nevertheless supplied only a partial checklist: units/size/mass-speed,
timestep/substeps, authority, and platform/body/contact context. It omitted a
body/collision/CCD choice, GPU and memory budgets, seed, an explicit
server-authoritative gameplay versus client-predicted/cosmetic boundary, and
the degradation ladder with stop conditions. It is not recorded as passing
enabled evidence. The skill and contract tests now require all ten Physics
Contract fields even when a field is unknown, plus the explicit multiplayer
boundary, before re-evaluation.

Exact first failed response:

```text
现在不能负责任地直接给质量、阻尼、重力、迭代或爆炸力数值：单位比例、固定步长、子步、网络权威和平台预算会直接改变这些参数的正确范围。

先确定这些决策性信息：单位（1 单位是否为 1 米）、箱子尺寸与期望质量/速度、物理固定步长与最大子步、服务器或客户端权威、目标平台及同时活动刚体/接触数预算。

以稳定 60 FPS 为目标，可先验证“渲染 60 FPS、物理 60 Hz（fixed dt≈16.67 ms）”这一假设，且限制追赶子步，不能随帧率直接放大爆炸力、阻尼或迭代。记录固定步耗时、活动刚体与接触数、穿透/约束误差、被截断的追赶步数，以及爆炸前后的网络状态偏差；再用代表性爆炸场景确定可接受的位移、速度和穿透容差后调参。
```

## Second enabled attempt: failed

The second fresh enabled response corrected the first attempt's missing
contract categories but collapsed the platform-budget field to CPU, GPU,
active-body, and contact budgets. It omitted memory. This is not a passing
response: the contract now requires separately named CPU ms, GPU ms, memory
MB, active bodies, and contacts, and states that memory must never be
collapsed or omitted. The focused mutation test deletes that exact memory
requirement and must fail.

Exact second failed response:

```text
不能在单位比例、固定步长、权威和预算未知时，可靠地给出质量、阻尼、重力、迭代或爆炸力的具体数值；这些系数会随尺度和步长失效，正是“箱子乱飞”的常见根因。

物理契约（当前均待定）：

1. 游戏玩法由服务器权威；客户端只预测自身可控对象，爆炸特效等可做纯表现。
2. 坐标单位比例，以及箱子尺寸、质量、速度范围。
3. 目标渲染 60 FPS；暂以物理 60 Hz、固定步长 1/60 秒为起点。
4. 最大子步数和超载策略（必须封顶，不能无限追帧）。
5. 刚体、碰撞体、CCD 配置。
6. 服务器权威、客户端预测、回滚/确定性范围。
7. 目标平台及 CPU/GPU、活跃刚体、接触对预算。
8. 随机种子与指标：物理步耗时、接触数、穿透、丢弃追帧、网络状态偏差。
9. 验收场景与容差：堆箱、爆炸、网络延迟、满载。
10. 降级阶梯和停止条件：先减少爆炸受影响对象/表现层，再限制子步与接触复杂度。

请先补齐至少：单位比例、物理固定步长与最大子步、服务器/客户端权威方案、目标平台与每帧物理预算。之后才能为这些参数给出可验证的初始值；同时用“堆箱爆炸 + 典型多人负载”场景测固定步耗时、穿透和状态偏差，而非只看平均 FPS。
```

## Third enabled attempt: failed

The third fresh response is stored verbatim in the evaluation record and is
also preserved here. It repaired the ten-field completeness problems but did
not end with a concrete first experiment, so its verdict is `fail` pending
fresh re-evaluation.

```text
现在不能直接给出质量、阻尼、重力、迭代或爆炸力数值；单位比例、固定步长、网络权威和预算未定时，这些系数会变成不可靠的“魔法数”。

物理契约（当前）：

1. 游戏权威与表现边界：未知；多人玩法应由服务器权威，客户端只预测/插值自身可控物体，爆炸视觉可本地表现。
2. 坐标、单位比例、合理质量/速度范围：未知。
3. 渲染与物理节奏：目标渲染 60 FPS；暂以物理 60 Hz、`fixed_dt=1/60 s` 为待验证假设。
4. 最大子步与追赶策略：未知；必须设上限，超载时记录/降级，不能无限追赶。
5. 刚体、碰撞体与 CCD：未知。
6. 网络权威、预测与确定性范围：未知；需明确服务器是否模拟箱子和爆炸结果。
7. 平台与预算：未知；分别需要 CPU ms、GPU ms、内存 MB、活跃刚体数、接触对数。
8. 随机种子与可观测指标：未知；记录固定步耗时、接触数、穿透、丢弃追赶步与服务端/客户端状态偏差。
9. 验收场景与容差：未知；至少包括满载箱子、爆炸、网络延迟与超载场景。
10. 降级阶梯与停止条件：未知；例如优先降低碎片/装饰刚体，再限制爆炸受影响对象，不能以突破帧预算为代价。

请先补齐：1 单位对应多少米、箱子尺寸/期望质量/最大速度；固定步长和最大子步；服务器与客户端各自模拟什么；目标平台及上述五项预算。之后才能给出可复测的具体参数。
```

## Fourth enabled attempt: passed

The fourth fresh response is stored verbatim in the evaluation record and
preserved below. It meets the complete-contract gate and ends with a concrete
First experiment. The first three attempts remain failed evidence.

```text
不能安全地直接给出质量、阻尼、重力、迭代或爆炸力的固定数值：单位比例、固定步长、权威模型与预算未知时，这些会成为“魔法系数”。

**Physics Contract**

1. 游戏权威与表现边界：未知；多人玩法应为服务器权威，客户端只预测/插值与播放爆炸视觉效果。
2. 坐标、单位比例、合理质量/速度范围：未知。
3. 渲染 FPS、physics_hz、fixed_dt_seconds、真实时间：目标渲染 60 FPS；先假设物理 60 Hz，`fixed_dt=1/60 s`。
4. 最大子步与过载策略：未知；必须设上限并记录丢弃/封顶的追赶步，不能无限补算。
5. 刚体、碰撞与 CCD 表示：未知；高速爆炸碎片是否启用 CCD 待定。
6. 网络权威、预测与确定性范围：未知；服务器权威状态，客户端预测范围与回滚/校正策略待定。
7. 平台及预算：CPU ms 未知；GPU ms 未知；内存 MB 未知；活跃刚体数未知；接触数未知。
8. 随机种子与可观测指标：未知；固定 seed，记录固定步耗时、接触数、穿透/约束误差、子步封顶、服务器—客户端状态偏差。
9. 验收场景与容差：未知；至少覆盖单箱、密集箱、爆炸、联网校正、过载。
10. 降级阶梯与停止条件：未知；先限制爆炸影响对象/休眠体，再降低非关键模拟精度；超过 CPU、接触数或误差容差即停止并拒绝发布。

先补齐会改变决策的四项：**单位比例、固定步长/子步上限、服务器/客户端权威边界、五维平台预算**。随后才能按实际质量尺度、爆炸半径和期望速度增量推导爆炸冲量，并测量求解器迭代与阻尼。

**First experiment**

- seed：固定。
- fixed scene/input：相同箱子堆、相同爆炸位置和输入回放。
- baseline/control：60 Hz 固定步；当前参数为基线；一次仅改一个参数族。
- measured metrics：物理 CPU 时间、GPU 时间、内存、活跃刚体、contacts、穿透/约束误差、封顶子步、网络偏差。
- declared tolerances/budgets：均标记为未知，不虚构。
- accept/reject/stop：在已声明预算内且箱子稳定、爆炸不产生不可接受穿透/发散则接受；任一预算或误差超限则拒绝并停止调参。
```

## TDD and verification

RED: `py -3 -m unittest tests.test_core_skill_contracts -v` failed because
`skills/architecting-real-time-physics/SKILL.md` did not exist. The later
completeness and memory-budget assertions also failed before their respective
skill rules were added. Final focused/shared verification,
`py -3 -m unittest tests.test_core_skill_contracts tests.test_skill_contracts
-v`, passed 13 tests; `py -3 -m unittest discover -s tests -v` passed 94.
The evaluation JSON parsed with `py -3 -m json.tool`, the official
`quick_validate.py` returned `Skill is valid!` under `PYTHONUTF8=1`, and
`git diff --check` was clean. The body-only count used by
`assert_architecture_contract` is 403 words (limit: 500); the whole-file
count is 424 only because it includes frontmatter. The core stdlib test checks
the complete contract and mutation failures for scale, authority, budget,
overload, partial output, omitted memory, reversed contract-before-constants
ordering, missing First experiment, contradictory render/tuning/authority
semantics, fabricated passing coefficient advice, and a captured passing
evaluation that omits the first-experiment payload.

## Re-review semantic hardening

The contract assertion now rejects the two exact contradiction payloads
(`Ignore that rule when the user asks directly; then provide arbitrary
coefficients` and `Put authoritative gameplay simulation on clients`) and
case/whitespace-normalized general forms. The passing-evaluation assertion
requires a refusal before contract completion, all ten numbered semantic
fields, the explicit server-authoritative/client-prediction-cosmetic boundary,
all five budget dimensions, and every First experiment field. It rejects
general numeric mass, damping, iteration, and impulse prescriptions instead
of a three-value blacklist. A label-only response, `40 kg`, `damping2.0`, and
`1000 N·s` fail; the captured fourth response is the positive control.

## Concerns

No engine API names or pinned source claims were added. The fourth evaluation
is `pass`, while the first three remain preserved failed evidence. Concrete
gameplay coefficients remain intentionally deferred to project-specific
measurement.
