### Task 5: `using-physics-simulation-superpowers`

**Files:** Create `skills/using-physics-simulation-superpowers/SKILL.md`, `skills/using-physics-simulation-superpowers/agents/openai.yaml`, `evaluations/using-physics-simulation-superpowers/evaluation.json`, reusable `tests/test_skill_contracts.py`, and `.superpowers/sdd/2026-08-26-physics-simulation-superpowers/task-5-report.md`.

## Skill contract

- Frontmatter name is exactly `using-physics-simulation-superpowers`. Description is a third-person triggering condition beginning exactly `Use when`; mention real-time physics simulation and useful Chinese discovery terms, but do not summarize the workflow.
- The technical body is English and no more than 200 words after frontmatter. It is a router, not a physics tutorial. Core principle: select the minimum sufficient skill set, state missing context, and let selected skills own technical judgment.
- First gate scope: real-time game physics and transferable graphics/robotics/multibody/differentiable/GPU/numerical research are in scope; traditional CAE, molecular dynamics, and offline scientific CFD stay out unless the user explicitly requests a real-time-game transfer analysis.
- Collect only routing facts that affect selection: intent (`build|debug|profile|survey|review|experiment|analyze|reproduce|transfer`), domain, engine/backend and version, 2D/3D, authoritative/cosmetic role, network model, target platform, FPS/tick, and CPU/GPU/memory budget. Do not block if some facts are missing; output them as a concise missing-context list and proceed with safe defaults (`60 FPS`, version must be verified before API symbols).
- Route to the minimum combination of: one or more domain/core skills; one adapter when an engine/backend is named; and only the necessary research-lane skills. Architecture is used for new-system contracts; debugging and profiling are selected only when their intent/evidence is present. Do not load unrelated adapters or domains.
- The output format is exactly two compact sections: `Selected skills` (ordered skill names with one-line reasons) and `Missing context` (only facts that can change the route or acceptance criteria). Explicit invocation and implicit discovery both use this contract.
- The mixed evaluation scenario must select, in a defensible order, at least `surveying-real-time-physics-research`, `reviewing-simulation-papers`, `reproducing-simulation-papers`, `translating-research-to-game-physics`, `unreal-chaos-physics`, `vehicle-physics`, `networked-deterministic-physics`, and `profiling-scaling-physics`. It may add `designing-simulation-experiments` / `analyzing-simulation-evidence` only with a stated evidence need. It must not select Unity, Godot/Jolt, native Jolt, PhysX SDK, Rapier, Box2D, fluids, cloth, or destruction.
- Source note: the router itself makes no technical engine claim; primary/source anchors remain owned by whichever selected skill supplies technical guidance.

## UI metadata and reusable tests

- `agents/openai.yaml` contains only `interface` metadata (and optional implicit policy), quoted strings, display name `Physics Simulation Router`, a 25–64 character English `short_description`, and a one-sentence `default_prompt` explicitly naming `$using-physics-simulation-superpowers`. Automatic discovery remains enabled.
- `tests/test_skill_contracts.py` uses only stdlib and incrementally validates every existing `skills/*` directory: parse simple YAML frontmatter, require directory/name equality, `description.startswith("Use when")`, allowed frontmatter keys, `agents/openai.yaml` with display/25–64 description/default prompt naming `$skill`, a matching evaluation JSON accepted by `tests.evaluation_contract.validate_evaluation_record`, `evaluation.skill` equality, forward-slash relative Markdown links that resolve, and no unfinished TODO. Add router-specific assertions for the 200-word cap, required routing fields/skill names, negative scope, and two-section output. Do not require future skills to exist yet.

## Evaluation protocol

Scenario (preserve verbatim in the record):

`请复现一篇关于 Unreal Engine 5 Chaos 联机车辆物理的论文，并把方法移植到稳定 60 FPS 的 PC/PS5 多人游戏。服务器权威、客户端预测；论文和仓库待查。请明确列出你会调用的 Physics Simulation Superpowers skill 名称、调用顺序、为什么，并指出继续前缺少的上下文。`

Fresh unaided baseline already captured before authoring:

> 我目前没有可调用的 “Physics Simulation Superpowers” 技能，因此无法列出或按顺序调用其子技能；应先检索论文、代码仓库和 UE5/Chaos 版本信息。
>
> 在获得资料后，我会按此工程流程推进：复现实验与基准 → 审核 Chaos 车辆模型及网络同步假设 → 实现服务器权威状态与客户端输入预测/回滚校正 → 进行 PC、PS5 的 60 FPS 性能分析与降级策略验证 → 多人压力测试和确定性/一致性评估。
>
> 继续前缺少：论文链接或 DOI、对应仓库、目标 UE5 与 Chaos Vehicles 版本、目标玩家数/网络条件、车辆和赛道复杂度、PS5 开发环境与性能预算、允许的预测误差及校正策略。

Baseline observation: it recognized the engineering phases and useful missing context but explicitly could not name or order plugin skills, did not separate survey/review/reproduction/transfer, and omitted the experiment/evidence contracts.

- Author the skill and tests first, then stop and report `READY_FOR_ENABLED_EVAL` without fabricating the enabled response or committing. The controller will run the same scenario in a separate fresh context with the authored skill and return the exact response.
- After receiving that response, write `evaluation.json` with exact baseline/enabled responses, concise behavioral observations, verdict `pass` only if required and excluded routes are correct, and evidence strings that cite observable choices rather than source-text matching.

## Verification and handoff

- Run the focused skill-contract tests, the full repository suite, JSON parsing for the evaluation, and the official skill-creator `quick_validate.py` using the controller-provided validation Python environment. Run `git diff --check db4b3be..HEAD` and inspect status.
- Write the report with baseline evidence, enabled evidence, word count, validators/tests, self-review, and concerns. Commit all Task 5 work (including this brief) as `feat: add physics simulation router skill` only after enabled evaluation is captured.

## Scope

- Work only in the plugin repository on branch `feat/physics-simulation-superpowers`, building on `db4b3be`. Preserve Tasks 1–4 and do not create any other skill, source-governance file, marketplace entry, installed copy, or archive.
- Use `apply_patch` for authored edits. Do not edit the progress ledger, dispatch subagents, browse, amend prior commits, or weaken tests.
