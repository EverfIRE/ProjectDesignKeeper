# ProjectDesign 插件 Monorepo 发布设计

日期：2026-08-31
状态：已批准，待实施

## 目标

把 `EverfIRE/ProjectDesign` 建设为可同时维护多个插件的仓库，并发布 `physics-simulation-superpowers` 0.1.0。完整开发源码与可安装发布树必须分离，物理插件不得与 ProjectDesignKeeper 源码混放。

本次迁移同时统一现有 ProjectDesignKeeper 布局、仓库 marketplace、CI、发布元数据和分发验证。原物理插件仓库保留为可恢复副本。

## 规范依据

OpenAI 官方插件规范要求每个插件以 `.codex-plugin/plugin.json` 为入口，可在插件根目录包含 `skills/`、运行配置、assets 和 hooks；仓库 marketplace 位于 `$REPO_ROOT/.agents/plugins/marketplace.json`，插件通常位于 `$REPO_ROOT/plugins/<plugin-name>/`，`source.path` 使用仓库内 `./` 相对路径。Git-backed marketplace 可以指向仓库子目录。

依据：<https://developers.openai.com/plugins/build/plugins>

## 选定方案

采用派生发布树：`sources/` 是唯一手工维护的完整源码区；`plugins/` 是由各插件打包器生成、提交到 Git、可由 repo marketplace 直接安装的发布区。CI 重新生成发布树并逐字节比较，禁止手工漂移。

未采用的方案：

- 完整复制源码到 `plugins/`：会把测试、评测和开发文档重复带入安装包。
- 子模块或多仓库：隔离更强，但增加版本同步、安装和贡献成本，不符合本次单仓库目标。

## 目标目录

```text
ProjectDesign/
├─ .agents/
│  └─ plugins/
│     └─ marketplace.json
├─ sources/
│  ├─ project-design-keeper/
│  │  ├─ src/
│  │  ├─ test/
│  │  ├─ scripts/
│  │  └─ package.json
│  └─ physics-simulation-superpowers/
│     ├─ .codex-plugin/
│     ├─ skills/
│     ├─ scripts/
│     ├─ schemas/
│     ├─ references/
│     ├─ tests/
│     ├─ evaluations/
│     └─ docs/
├─ plugins/
│  ├─ project-design-keeper/
│  └─ physics-simulation-superpowers/
├─ test/
│  └─ distribution.test.mjs
├─ docs/superpowers/
└─ .github/workflows/ci.yml
```

## 源码迁移

### ProjectDesignKeeper

把现有 `source/` 通过 Git 可追踪重命名迁移到 `sources/project-design-keeper/`。同步更新：

- GitHub Actions 的 working directory、cache lockfile 和 diff 路径；
- 根级 distribution tests；
- package metadata 的 repository directory；
- README、构建命令和所有仓库相对路径；
- 打包器的 release 输出路径。

### Physics Simulation Superpowers

从独立源码仓库导入提交 `690f0295d406a4007d50fa6133dc4671345092ad` 的干净快照到 `sources/physics-simulation-superpowers/`。不合并无关 Git 历史；迁移记录保存来源路径、分支、提交 SHA、插件版本和已验证发布树哈希。

独立源码仓库不删除。导入后，ProjectDesign 中的 `sources/physics-simulation-superpowers/` 成为后续维护的规范源码。

## 发布树边界

### ProjectDesignKeeper

保留现有最小运行包语义：编译产物、patch 配置、package metadata、插件 manifest 和 skill resources。源码、测试和构建脚本不进入 `plugins/project-design-keeper/`。

### Physics Simulation Superpowers

`plugins/physics-simulation-superpowers/` 只包含：

- `.codex-plugin/plugin.json`；
- `skills/` 及其 references、agents metadata；
- 用户运行时需要的 `scripts/`；
- `schemas/`；
- 运行时来源与许可需要的 `references/`；
- `assets/`；
- `LICENSE`、`THIRD_PARTY_NOTICES.md` 和面向用户的 README。

以下内容仅存在于源码树：`tests/`、`evaluations/`、`docs/`、`.superpowers/`、缓存、临时文件和本地 ZIP 输出。

物理插件打包器维护显式发布白名单，拒绝符号链接、junction、目录逃逸、重复成员、目标覆盖和非确定 ZIP metadata。发布树和 ZIP 使用相同白名单生成。

## Marketplace 与发布元数据

`.agents/plugins/marketplace.json` 使用：

- `name`: `project-design`
- `interface.displayName`: `ProjectDesign`
- 两个插件条目：`project-design-keeper` 与 `physics-simulation-superpowers`
- 每个条目都包含 `policy.installation`、`policy.authentication` 和 `category`
- 每个本地路径均为 `./plugins/<plugin-name>`，且不能逃出仓库根目录

两个插件的 homepage、repository、issues 和 publisher metadata 统一指向：

- 仓库：`https://github.com/EverfIRE/ProjectDesign`
- 发布者：`https://github.com/EverfIRE`

物理插件保持 Apache-2.0 许可证和完整第三方声明。

## 构建与数据流

```text
sources/<plugin>/
    │
    ├─ plugin-specific build/tests
    │
    ├─ deterministic packager ──> plugins/<plugin>/
    │                               │
    │                               ├─ repo marketplace install
    │                               └─ deterministic ZIP
    │
    └─ repository distribution gate compares source-derived output byte-for-byte
```

ProjectDesignKeeper 继续使用 Node 打包器。物理插件使用 Python 打包器，新增 release tree 输出和最小白名单。根级 distribution gate 调用两个打包器，验证发布树、marketplace 和仓库隔离合同。

ZIP 从已验证的 `plugins/physics-simulation-superpowers/` 生成，不直接压缩开发源码。ZIP 不提交 Git。

## CI 设计

单一 `.github/workflows/ci.yml` 包含三个隔离 job：

### `project-design-keeper`

- Node 20 安装与 lockfile cache；
- typecheck、完整测试、coverage、build、smoke 和性能测试；
- package verify；
- Windows 安装态 smoke；
- Ubuntu portable 验证。

### `physics-simulation-superpowers`

- 固定受支持 Python 版本；
- 解析全部 JSON；
- 运行插件全部单元与合同测试；
- 校验 manifest、25 个 skill 和运行时文件边界；
- 重新生成发布树与确定性 ZIP；
- 比较源码白名单、发布树和 ZIP 成员哈希。

### `distribution`

- 验证两个源码目录和两个发布目录均存在；
- 验证发布树不含开发源码、测试、评测、计划或缓存；
- 验证两个打包器输出与已提交发布树逐字节相同；
- 验证 marketplace 名称、显示名、条目顺序、策略和路径；
- 验证 ZIP、临时输出和旧单数 `source/` 未进入 Git。

## GitHub 发布流程

1. 在 `feat/plugin-monorepo-publishing` 完成迁移。
2. 运行两个插件完整测试、打包验证和根级 distribution gate。
3. 推送功能分支并创建面向 `main` 的 PR。
4. 等待 GitHub Actions 全绿后合并。
5. 从合并提交生成确定性物理插件 ZIP 与 `SHA256SUMS.txt`。
6. 确认目标 tag 不存在后创建 `physics-simulation-superpowers-v0.1.0`。
7. 创建同名 GitHub Release，上传 ZIP 与 checksum 文件。
8. 下载或读取 Release 附件并复核 SHA-256。

后续 tag 使用 `<plugin-name>-v<version>`，避免多插件版本冲突。既有 ProjectDesignKeeper `v1.0.0` 和 `v1.0.1` 标签保留。

## 失败处理与安全边界

- 任一迁移、测试、构建或逐字节比较失败，停止在功能分支，不修改 tag 或 Release。
- 发布前验证 GitHub CLI 登录身份、目标仓库、默认分支和 tag 唯一性。
- 身份、权限或仓库目标不确定时停止，不尝试绕过。
- 目录移动必须可由 Git 追踪；禁止删除原物理插件仓库。
- 发布目录拒绝手工覆盖；先在临时目录生成并验证，再原子替换精确目标。
- ZIP 使用固定时间戳、固定文件模式、排序成员和稳定压缩设置。
- marketplace 路径必须保持在仓库根目录内部。
- Release 上传失败时保留本地 ZIP、checksum 和完整日志，不创建虚假成功记录。

## 验收标准

- `sources/project-design-keeper/` 与 `sources/physics-simulation-superpowers/` 独立存在；
- `plugins/project-design-keeper/` 与 `plugins/physics-simulation-superpowers/` 可独立安装；
- repo marketplace 同时暴露两个插件；
- 两个插件的完整测试与仓库 distribution gate 全绿；
- CI 在 PR 与主分支上全绿；
- PR 已合并到 `main`；
- tag `physics-simulation-superpowers-v0.1.0` 与 GitHub Release 存在；
- Release 包含 ZIP 与 `SHA256SUMS.txt`，附件哈希匹配；
- 原物理插件仓库仍可恢复；
- 重启 Codex 后可从 repo marketplace 安装，并在新任务中调用 `@physics-simulation-superpowers`。当前会话若不能热刷新，只记录为外部 UI 冒烟步骤。

## 已知知识上下文缺口

仓库当前没有 `docs/project-design/index.md`，因此 Project Design Keeper 的知识包查询和同步流程不可用。本设计以 README、CI、distribution tests、package metadata、Git 状态和用户批准的约束为依据。实现若改变规范，应在知识包可用后补建或刷新项目设计记录。
