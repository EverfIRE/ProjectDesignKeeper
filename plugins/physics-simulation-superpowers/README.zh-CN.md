# Physics Simulation Superpowers 中文指南

这是一个面向 Codex 的物理仿真插件：既覆盖实时物理开发，也覆盖全网文献检索、证据分析、实验设计、论文复现，以及把研究结果安全迁移到游戏运行时。能力按“核心方法 → 引擎适配 → Research → 交付”分层；Unreal Engine / Chaos（旗舰），其他引擎保持精简，只有 Jolt、PhysX、Rapier、Box2D 等物理能力突出的后端保留较深的原生适配。

## 安装

从 `EverfIRE/ProjectDesign` 仓库 marketplace 安装。先在终端添加 marketplace；已添加时用第二条命令刷新：

```powershell
codex plugin marketplace add EverfIRE/ProjectDesign --ref main
codex plugin marketplace upgrade project-design
```

然后重启 Codex，在 marketplace 中安装 `physics-simulation-superpowers`。安装后必须再新建任务，并在新任务中用 `@physics-simulation-superpowers` 激活；当前任务不会热刷新刚安装的插件。先用 `codex help plugin` 检查当前 CLI 是否提供这些插件子命令；若返回不识别，停止执行并先更新或重启 Codex。

维护者从本源码根目录验证确定性归档与一次性安装树时运行：

```powershell
python -X utf8 scripts/package_plugin.py --source . --archive outputs/physics-simulation-superpowers-0.1.0.zip --install-dir C:/Users/qiupeng/plugins/physics-simulation-superpowers
```

打包器会确定性生成 ZIP，在临时目录安装并逐文件核对哈希，然后原子发布；`--install-dir` 必须是尚不存在的精确目录。更新时不要把新包强制合并进旧目录：先核对并备份精确安装目标，再移除可由源码或 ZIP 恢复的旧副本，最后重跑同一命令。只安装通过哈希与归档校验的输出；版本、提交、许可和采用决定见 `references/sources.lock.json`。

## @ 调用

在 Codex 输入 `@physics-simulation-superpowers` 可发现插件能力，也可以直接点名 skill，例如：

- `$using-physics-simulation-superpowers`：总路由与安全门。
- `$unreal-chaos-physics`：Unreal / Chaos 旗舰适配。
- `$surveying-real-time-physics-research`：可审计的全网研究检索。
- `$reproducing-simulation-papers`：在隔离、冻结环境中复现论文。
- `$translating-research-to-game-physics`：把已验证研究转成 Unreal-first 的游戏物理方案。

调用时提供引擎与精确版本、平台/构建、目标场景、性能或质量预算，以及现有日志、最小复现或论文身份。未知版本会停留在概念级建议，不会虚构 API。

## 分层能力

1. 核心：步进、碰撞、约束、角色、载具、软体、流体、网络确定性、调试、测试与性能剖析。
2. 引擎：Unreal Chaos 为旗舰；Unity、Godot/Jolt 保持项目版本门；原生 Jolt、NVIDIA PhysX、Rapier、Box2D 提供后端级生命周期和证据合同。
3. Research：检索与去重、论文精读、实验设计、统计分析、受控复现、研究到实时游戏的转化。
4. 交付：来源治理、可移植清单、自动校验、报告和安装包。

## 开发流程

先冻结项目身份和权威状态，复现问题并记录可观察量；再用最小变更建立 RED 测试，实施修复，运行聚焦测试与完整回归，最后给出回滚方案和证据。时间步、线程、CPU/GPU、资产 cooking、网络 authority 与 presentation 必须分别说明。性能目标应写成帧预算：60 FPS 约 16.67 ms，30 FPS 约 33.33 ms，120 FPS 约 8.33 ms；物理只能占其中明确分配的一部分。

## Research 流程

1. 写明问题、时间范围、数据库/站点、完整查询、筛选标准和停止规则。
2. 用 DOI、arXiv 版本、发布记录、仓库提交和工件哈希消歧；索引只用于发现，结论回到一手来源。
3. 分开审查论文主张、代码/数据身份、许可证、工件徽章、独立复现和实时适用性。
4. 先设计实验单位、因素、随机化/分块、重复、指标和停止门，再分析不确定性、失败/删失和多目标权衡。
5. 复现未知代码时默认不联网、最小权限、只读输入、资源上限；只有通过预检才执行。
6. 转化到游戏时区分离线优化、构建期生成、加载期产物和运行时 authority；论文结果不会自动成为 Chaos 的实时预算或网络保证。

## 脚本接口

- `scripts/analyze_physics_trace.py`：分析固定 schema 的物理 trace 与尾延迟。
- `scripts/compare_replay_hashes.py`：比较重放状态、首次分歧和容差。
- `scripts/compare_step_sweep.py`：扫描 timestep、substep 与 solver 配置。
- `scripts/validate_run_manifest.py FILE.json`：校验固定 schema 的物理运行清单。
- `scripts/validate_research_artifact.py KIND FILE.json`：校验研究清单、哈希与安全预检；`KIND` 为 `paper-record`、`experiment-plan` 或 `reproduction-run`。
- `scripts/inventory_artifact.py`：只读盘点论文工件文件与许可线索。
- `scripts/compare_reported_results.py`：把复现实测与论文表格/图中报告值按合同比较。
- `scripts/package_plugin.py`：确定性生成 ZIP，并可创建拒绝覆盖、逐文件校验的安装副本。

除上述研究工件验证器使用显式 `KIND FILE.json` 外，先运行各脚本的 `--help`。把输入复制到可恢复的工作区，并保存命令、环境、stdout/stderr、退出码和输出哈希。脚本输出是证据，不是自动通过结论。

## 安全边界

- 不执行来历不明的脚本、二进制、容器或安装钩子，除非隔离预检明确通过。
- 不把公开仓库等同于开源许可；未知或 noncommercial 许可内容拒绝进入插件。
- 不把文档默认值、示例参数、社区经验或论文帧率当作用户项目事实。
- 不宣称跨平台 bitwise determinism、完整 rollback 状态、GPU fallback 或生产可用性，除非冻结环境中的测试直接支持。
- Unreal API、cvar、插件成熟度和网络模式必须按精确引擎补丁与构建验证。

## 示例

```text
@physics-simulation-superpowers
请用 $unreal-chaos-physics 分析 UE 5.8 Windows Shipping 中高速刚体穿透；
目标 60 FPS，物理线程 p95 不超过 3.0 ms。先列最小证据包和 RED 测试，不要猜 cvar。
```

```text
@physics-simulation-superpowers
请用 $surveying-real-time-physics-research 检索近五年可用于实时可微物理的工作，
再用 $reproducing-simulation-papers 对选定论文做隔离预检，最后用
$translating-research-to-game-physics 给出 Unreal Chaos 的离线/运行时分层迁移方案。
```
