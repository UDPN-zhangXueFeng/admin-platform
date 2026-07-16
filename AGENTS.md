
# 仓库指南

项目结构、目录职责和架构背景见：[Codex 项目结构说明](/Users/zhangxuefeng/pi-cwd-20260601/admin-platform/.codex/project/pro.md)。前端代码设计、命名、lint、测试和提交流程规范见：[前端代码设计与规范](/Users/zhangxuefeng/pi-cwd-20260601/admin-platform/.codex/project/rule.md)。Codex 对话沉淀见：[Codex 对话沉淀](/Users/zhangxuefeng/pi-cwd-20260601/admin-platform/.codex/project/memory.md)。历史补充资料见：[当前结构说明](/Users/zhangxuefeng/pi-cwd-20260601/admin-platform/.doc/project-structure-understanding.md) 和 [Nx 架构草案](/Users/zhangxuefeng/pi-cwd-20260601/admin-platform/.doc/nx.md)。

## 项目结构与模块组织
本仓库是以 `apps/admin` 为核心的 Nx monorepo。详细结构不要在本文件重复维护，以 `.codex/project/pro.md` 为准；代码规范不要在本文件重复维护，以 `.codex/project/rule.md` 为准。

关键约束：

- 应用层尽量薄，业务能力优先下沉到 `libs/modules/<domain>/*`
- `shared` 库不能依赖 `libs/modules/*`
- 迁移或扩展 `td-manage` 旧行为时，先保留业务语义，再适配当前 Nx 边界
- 不要复制违反当前 `scope:*` 或 `type:*` 边界的旧耦合模式

## 构建、测试与开发命令
- `npx nx dev admin`：启动本地 Next.js dev server
- `npx nx build admin`：为管理后台应用创建生产构建
- `npx nx test <project>`：运行指定 app 或 library 的 Jest 测试
- `npx nx e2e admin-e2e`：运行 Playwright 端到端测试
- `npx nx lint <project>`：运行 ESLint，并执行 Nx module-boundary 检查
- `npx nx show project admin`：查看管理后台应用可用的 targets

示例：`npx nx test modules-user-feature`、`npx nx lint shared-ui`。

## 代码规范与测试
代码风格、命名、TypeScript、React、样式、lint、format、test 规则统一见 `.codex/project/rule.md`。

执行原则：

- 保持变更克制且精准，不顺手重构无关代码
- 优先将代码放在相关领域库中，不为单次使用新增横切抽象
- 行为变化需要运行最窄相关 lint/test/build；无法运行时必须明确说明
- 当项目结构、目录职责、模块边界、技术栈、命名规范、lint/format/test 规则或代码设计约定发生变化时，必须同步更新 `.codex/project/pro.md` 或 `.codex/project/rule.md`
- 每次与 Codex 协作后，如产生可复用的新项目事实、规范、规律或踩坑经验，必须总结到 `.codex/project/memory.md`

## Commit 与 Pull Request 指南
当前 workspace 的已跟踪文档没有暴露严格的 commit convention，因此使用简短的祈使句，并让信息聚焦于本次变更，例如：`fix key-management route resolution`。

PR 应包含：
- 对问题和修复方案的简明总结
- 受影响的 apps/libs
- 测试证据（`npx nx test ...`、`npx nx e2e ...`）或明确说明的缺口
- UI 变更的截图

## 配置与路由说明
路由强制使用 locale 前缀（`/en-US/...`、`/zh-CN/...`）。编辑 `configs/*.json` 中的菜单时，确认 path 形状与 `apps/admin/src/app` 中的 App Router 结构匹配。

对于从 `td-manage` 迁移的功能，需要同时检查三层：config（`configs/*.json`）、route resolution（`apps/admin/src/app`）以及 module registry/loading（`libs/shared/util-config` 和 `libs/modules/*`）。重构期间的大多数回归都来自这些层之间不同步。
