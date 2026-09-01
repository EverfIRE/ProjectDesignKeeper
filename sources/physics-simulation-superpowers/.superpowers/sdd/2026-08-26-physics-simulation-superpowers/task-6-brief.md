### Task 6: `architecting-real-time-physics`

**Files:** Create `skills/architecting-real-time-physics/SKILL.md`, its `agents/openai.yaml`, `evaluations/architecting-real-time-physics/evaluation.json`, `tests/test_core_skill_contracts.py`, and the ignored SDD task report.

## Behavioral contract

- Description starts `Use when` and triggers on new or changing real-time physics architecture, units/scale, fixed timestep, authority, budgets, and Chinese terms such as 物理架构、固定步长、单位比例. It must not summarize the workflow.
- English body targets <=500 words. Core principle: write and validate the physics contract before selecting tuning constants. Stay engine-neutral; route versioned API symbols to the relevant adapter.
- Workflow/output must produce a compact `Physics Contract` with all of: gameplay authority and cosmetic boundaries; coordinate/units/scale and plausible mass/speed ranges; render FPS versus fixed `physics_hz`/`fixed_dt_seconds`; max substeps and overload/catch-up policy; body/collision/CCD representation; network authority, prediction and determinism scope; target platform plus CPU/GPU/memory/active-body/contact budgets; seed and observable trace metrics; acceptance scenes/tolerances; and a degradation ladder/stop conditions.
- Default to a measured 60 FPS product target and an explicit 60 Hz physics starting hypothesis, not an invariant law. Preserve real seconds and decouple render cadence. Explain scaling: a 30 FPS renderer may retain 60 Hz physics if gameplay needs it; 120 Hz physics is adopted only when measured benefit justifies roughly doubled step work. Do not naively multiply forces, impulses, damping, or solver iterations with frame rate; revalidate stability, compliance, controller gains, and budgets whenever the step changes.
- Refuse magic coefficient tuning while scale, timestep, authority, or budget is unknown. The response should state assumptions, request only decision-changing facts, propose instrumentation/acceptance tests, and may give dimensioned formulas or ranges only after the contract is bounded.
- Common mistakes must include variable-delta authoritative stepping, treating render FPS as physics Hz, tuning around unit errors, unlimited catch-up/substeps, claiming deterministic networking without a defined scope, and using average FPS as the only budget evidence.
- Source anchors are primary fixed-timestep/numerical-stability literature plus versioned official engine/backend documentation owned by adapters; the pinned source snapshot will be supplied by Task 30. Do not add stale API names or unverified constants.

## Test contract

- Add a reusable stdlib `tests/test_core_skill_contracts.py` with a Task 6 test that reads frontmatter/body and behaviorally asserts the exact Physics Contract fields, `60 FPS`, `30 FPS`, `120 Hz`, render/physics decoupling, step-change retesting, absence of engine API symbols, magic-number guard, observability/acceptance/degradation, source-anchor statement, and common mistakes. Include negative mutation tests proving deletion of scale/authority/budget/overload fields or reversal of the “contract before constants” rule fails.
- Shared skill-contract tests must discover the new skill, UI metadata, and completed evaluation automatically. UI: display `Real-Time Physics Architecture`, 25–64 character English description, one-sentence prompt naming `$architecting-real-time-physics`, implicit discovery enabled.

## Evaluation protocol

Scenario (verbatim):

`我的多人实时游戏里箱子手感太轻，爆炸一触发物体就乱飞。请直接告诉我质量、线性/角阻尼、重力、求解器迭代和爆炸力各设多少；目标是稳定 60 FPS。项目的单位比例、物理固定步长、子步、服务器/客户端权威和平台预算我还没整理。`

Fresh baseline before authoring:

> 先给一套可作为起点的配置（假设 1 Unity 单位≈1 米、60 Hz 物理步）：
>
> - 箱子质量：20–50 kg；常见木箱先用 **30 kg**
> - 线性阻尼：**0.8–1.5**
> - 角阻尼：**3–6**
> - 重力：保持默认 **9.81 m/s²**，不要靠加重力解决“轻飘”
> - 求解器迭代：位置 **8–12**，速度 **2–4**
> - 爆炸：使用随距离衰减的脉冲力；对 30 kg 箱子，近距离峰值先控制在 **600–1,200 N·s**，并限制最大线速度约 **8–12 m/s**、角速度约 **8–12 rad/s**
>
> 避免对每个碎物施加同样的大力；爆炸中心附近可略抬升，但水平冲量应更小。多人游戏里由服务器权威计算爆炸结果并同步初速度/状态，客户端只做预测或表现，能显著减少“乱飞”不同步。稳定 60 FPS 的核心是控制同时活跃的刚体数量、爆炸影响半径和迭代次数。

Baseline observation: it invented Unity-like scale and 60 Hz assumptions, emitted specific mass/damping/iteration/impulse values before a contract existed, only partially addressed authority/performance, and omitted overload policy, observability, acceptance tolerances, and degradation.

- Phase A: author skill, UI, specific tests, baseline/template evaluation and report; run tests possible, then stop `READY_FOR_ENABLED_EVAL` without a commit or fabricated response.
- Controller will run the same scenario in a fresh context with only this skill. Passing enabled behavior must avoid arbitrary coefficients, produce the complete contract/missing decisions and measurable first experiment, distinguish 60 FPS from physics Hz, and state server/cosmetic boundaries.
- Phase B after controller response: write exact enabled response/observations, verdict/evidence, run focused/full tests and official quick validator, update report, then commit `feat: add real-time physics architecture skill`.

## Scope

- Build on `ca4154f`; use apply_patch; preserve prior work. Do not author other skills, governance, install/package artifacts, or marketplace state. Do not edit progress ledger, browse, dispatch subagents, amend commits, or weaken tests.
