# 目标架构与模型分配参考

> 本文件供 module-migration skill 的「开发阶段」与「验收阶段」读取。
> 记录三件事：① 目标 Nx monorepo 的模块结构与注册流程；② UI 组件映射速查；
> ③ **opus / sonnet / haiku 三模型分配的落地方式**。

---

## 1. 目标项目：admin-platform（Nx monorepo）

- 老项目（td-manage 等）：Next.js Pages Router，`src/pages/<module>/...`。
- 目标项目：Nx monorepo，模块位于 `libs/modules/<slug>/`，按职责分四层。

### 1.1 四层结构

| 层 | 路径 | 职责 | 典型产物 |
|----|------|------|----------|
| data-access | `libs/modules/<slug>/data-access/src/lib/` | 类型 + API + TanStack Query | `model.ts` / `api.ts` / `+queries/*.ts` |
| feature | `libs/modules/<slug>/feature/src/lib/` | 页面（路由级组件）+ manifest | `*-list-page.tsx` / `*-detail-page.tsx` / `module-manifest.ts` |
| ui | `libs/modules/<slug>/ui/src/lib/` | 模块专属 UI 组件 | `*-status-badge.tsx` / `*-json-viewer.tsx` |
| util | `libs/modules/<slug>/util/src/lib/` | 常量、纯函数、权限/状态映射 | `<slug>.constants.ts` |

### 1.2 注册流程（每个新模块必做）

1. **Nx generator 建库**：`pnpm nx g @nx/react:library ...`（或项目既有 generator，遵循已有模块写法）。
2. **模块注册**：`libs/shared/util-config/src/lib/module-registry.ts` 注册 `<slug>`。
3. **i18n**：`libs/shared/util-i18n-messages` 新增 `modules/<slug>.json`，命名空间 `modules.<slug>`。
4. **路由 / 菜单**：按 `module-manifest.ts` 声明路由与菜单项；stablecoin 等应用若原无菜单需新建菜单项。
5. **挂载验证踩坑**（来自历史迁移经验）：模块路径必须在 `apps/admin/tsconfig.json` 的 paths 里登记，
   否则 nx 构建会误报 lazy/chunk 错误。详见 memory `sys-migration-status`。

### 1.3 历史迁移踩坑速查（来自项目 memory）

- `useCustomTable` 内部封装请求/分页/表单联动，需完整还原 `form.items` / `table.columns` / `actions`。
- 大表单（如 journal-entries edit 896 行 Form.List 嵌套）需拆 detail shell + content，避免 nx lazy 误报（加 eslint-disable）。
- 文件下载走 blob（statements），需单独处理响应类型。
- Drawer 死代码、纯 mock 页面原则上不迁移，但要在文档第 8 章标注「已知限制」。

### 1.4 路由约定 + group 机制（⚠️ 关键，违反必 404）

admin-platform 路由 `apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx` 用**通用 pageKey**（**不读 manifest.component**），由 slug 推导：
- `slug=[]` → `list`；`slug[0]=create` → `create`；`slug[0]=edit` → `edit`；**其他 → `detail`**

**registry 的 `pages` 必须用通用 key（`list`/`detail`/`create`/`edit`），禁止具体 key**（如 `node-list`/`accrual-list`）。

**多子模块必须用 group 机制**（菜单 `configs/<app>.json` 把模块配成 group：children path `/<group>/<child>`）：
1. `page.tsx` 的 `GROUP_ENABLED_KEY` 加 `<group>: '<enabledKey>'`（`sys`→`system` 是特例，其他用模块名自身如 `blockchain`→`blockchain`）
2. registry：group 容器**不进 registry**；每个子模块各自 entry（manifest + pages 通用 key）
3. manifest：每子模块一个 manifest（`id`=子模块名），routes component 用通用 key
4. 路由解析：`/<group>/<child>` → `realModule=<child>` → `loadModulePage('<child>', '<pageKey>')`

**范本**：`sys` group（`/sys/role` → realModule=role → role entry pages `{list,create,edit,detail}`）；`wallet` group。

**踩坑**（mmf/blockchain 曾中招 → 404）：迁移生成 registry 用了具体 key（`accrual-list`）+ 未注册 group → `/<group>/<child>` 被解析成 pageKey=`detail` → registry 无 `detail` → **404**。scaffold 任务（建库/manifest/registry）必须先读 sys group 范本对齐。详见 memory `module-migration-skill`、[[sys-rbac-pagination-pagenum]]。

### 1.5 运行时验证 + 常见运行时 bug（⚠️ 静态 verify 覆盖不到）

阶段四的 verify（lint/test/tsc）是**静态检查**，覆盖不到运行时 bug。以下坑都需**跑应用**才暴露——阶段五必须做**运行时冒烟**（`/verify` 跑应用，逐页打开看控制台无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE，列表有数据）。已踩的运行时坑（mmf/blockchain 跑应用后才发现）：

1. **i18n key 双重前缀**：页面 `useTranslations('modules.<slug>')` 已在 `<slug>` namespace，常量 `labelKey`/`KEY_PREFIX` **不要再带 `<slug>.` 前缀**（否则拼成 `modules.X.X.key` → `MISSING_MESSAGE`）。labelKey 用相对 key（如 `node_status_1`，非 `blockchain.node_status_1`）。

2. **Radix Select 禁止 SelectItem value 为空串——`ALL_VALUE` 必须非空**：`ALL_VALUE`（"全部"占位）必须用 **`'all'`**（非 `''`）——无论 `FormSelect` 的 options 还是手写 `Select`+`SelectItem`（per-option `disabled` 场景）。空串保留给清空 placeholder → 否则 `Runtime Error: Select.Item must have value not empty`。筛选用 `!== ALL_VALUE` 判断（`'all'` → `undefined` 不传后端，语义一致）。**verify 子 agent 必须 grep `ALL_VALUE\s*=\s*''` 确保无空串定义**（静态可抓，不必跑应用）——**反例**：cross-chain cc-8~cc-15 七个页面文件全部 `const ALL_VALUE = ''`，迁移 agent 普遍疏漏此约束，静态 lint/test 全绿但运行时崩，直到阶段五跑应用才暴露。注：`FormSelect` 组件级已过滤空 value option（见第 4 条），但手写 `SelectItem` 无兜底，且 `FormSelect` 的"全部"选项会被静默丢弃（用户看不到），故 `ALL_VALUE` 必须从源头非空。

3. **i18n 插值语法**：admin-platform 用 **next-intl（ICU 单花括号 `{var}`）**，非老项目 i18next 的双花括号 `{{var}}`。从老项目抄 i18n message 时，`{{xxx}}` → `{xxx}`，否则 `INVALID_MESSAGE: MALFORMED_ARGUMENT`。

4. **下拉数据防御（三层，Radix Select 禁止 `SelectItem value=""` 否则 `Runtime Error: Select.Item must have value not empty`）**：后端下拉接口可能返回非数组（`{rows}`）、`null` 项、或**空 id 项**（`stablecoinId`/`blockchainId`/`key` 为 `''`）。
   - **组件级（FormSelect 已兜底，2026-07-14）**：`FormSelect.uniqueOptions` 已过滤 `value === '' | null` 的 option——页面传入含空 value 的 options 不再崩溃（空项被静默丢弃）。**手写 `Controller`+`Select`+`SelectItem` 场景（per-option `disabled`，FormSelect 不支持）无此兜底**，需自己 filter + `ALL_VALUE` 用 `'all'` 非 `''`。
   - **query hook 级（推荐，一处覆盖所有页面）**：`select: (data) => Array.isArray(data) ? data.filter(o => o != null && o.<idField> !== '') : []`。
   - **页面级**：`map` 出 options 前先 `.filter(o => o.<idField> != null && o.<idField> !== '')`，再 `String(id)`。
   - **案例**：cross-chain `liquidity-pool-list` 的 `tokenOptions`（stablecoin searches）后端返回空 `stablecoinId` 项，页面 `String(el.stablecoinId)` 得 `''`，FormSelect（修复前）渲染 `SelectItem value=""` 崩溃。修复：FormSelect 组件级过滤 + 页面 map 前 filter。blockchain 曾因只在单页面 filter、漏 deployment-list 反复报错。

5. **分页字段 pageNum**（见 [[sys-rbac-pagination-pagenum]]）：sys/RBAC 域 list 接口要 `pageNum` 非 `page`，否则数据不显示。

**阶段五运行时冒烟检查清单**（每页都要过）：
- 控制台无 Runtime Error（SelectItem 空串、`null.map`、组件 prop null）
- 无 MISSING_MESSAGE（i18n key 解析，注意双重前缀）
- 无 INVALID_MESSAGE（ICU `{{}}` 语法）
- 列表/详情数据能显示（API 字段映射、分页 `pageNum`）
- 筛选下拉、写操作（弹窗/Mutation）可交互

---

## 2. UI 组件映射速查

| 源（antd / libs/components） | 目标（admin-platform） |
|------------------------------|------------------------|
| `CustomTable` + `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form` |
| `Form` / `Form.Item` / `Form.useForm` | `react-hook-form` + `useForm` + `FormField` / `FormSelect` |
| `Input` / `Input.TextArea` | `@myorg/shared/ui` Input / TextArea |
| `Select` | `@myorg/shared/ui` Select |
| `DatePicker.RangePicker` | `FormDatePicker` / 自定义 RangePicker |
| `Button` | `@myorg/shared/ui` Button |
| `Tag`（含颜色映射对象） | Tailwind badge / Badge 组件 + util/constants.ts 映射 |
| `Drawer` / `Modal` | `@myorg/shared/ui` Drawer / Dialog |
| `Table`（静态） | `@myorg/shared/ui` DataTable |
| `CopyableEllipsisText` | `@myorg/modules/<related>/ui` CopyableEllipsisText |
| `useHook(['ns'])` + `t('key')` | i18n hook + `modules.<slug>` 命名空间 |
| `getServerSidePropsResult` + `serverSideTranslations` | 客户端 i18n（目标为 CSR/SPA，无需 SSP） |

---

## 3. 模型分配落地（核心）

用户硬性要求：**推理用 opus、页面构建用 sonnet、脚本/样板构建用 haiku**。
落地方式是在 `Workflow` 的 `agent()` 或 `Agent` 工具调用时显式传 `model` 参数。

> 原则：判断与设计类工作给最强模型（opus），高产出但模式化的页面实现给 sonnet，
> 纯结构化/低歧义产物给 haiku。这样在保证质量的同时压低 token 成本。

### 3.1 分配表

| 工作类型 | 模型 | 典型任务 | 落地写法 |
|----------|------|----------|----------|
| 推理 / 判断 / 设计 | **opus** | 逆向理解源码业务、迁移率语义校验、任务拆分、疑难架构决策、验收判定 | 主循环自身（继承）；或 `agent(prompt, {model:'opus'})` / `Agent(model:'opus')` |
| 页面 / 组件构建 | **sonnet** | ListPage / DetailPage / EditPage / 业务组件的 React+TS 实现 | `agent(prompt, {model:'sonnet'})` / `Agent(model:'sonnet')` |
| 脚本 / 类型 / 样板 | **haiku** | `model.ts` 类型、`api.ts` 函数骨架、`constants.ts`、注册脚本、`module-manifest.ts` | `agent(prompt, {model:'haiku'})` / `Agent(model:'haiku')` |

### 3.2 在 Workflow（ultracode）中的用法

Workflow 的 `agent(prompt, opts)` 第二参数支持 `model`。编排示例（分析拆任务阶段）：

```javascript
// 推理拆任务：opus
const plan = await agent(`基于迁移文档 ${docPath} 拆分可独立开发的任务清单...`,
  { label: 'plan-tasks', model: 'opus', schema: TASKS_SCHEMA })

// 开发阶段，按产物类型分配模型
await pipeline(tasks,
  // 类型/常量/API 骨架 → haiku
  t => t.kind === 'scaffold'
    ? agent(buildScaffoldPrompt(t), { label: `scaffold:${t.id}`, model: 'haiku' })
    : null,
  // 页面/组件实现 → sonnet
  t => t.kind === 'page'
    ? agent(buildPagePrompt(t), { label: `page:${t.id}`, model: 'sonnet' })
    : null,
)
```

### 3.3 在 Agent 工具中（loop 周期内单任务）的用法

`Agent` 工具的 `model` 参数取 `'opus' | 'sonnet' | 'haiku'`：

```
Agent(subagent_type='general-purpose',
      model='sonnet',          # ← 页面构建
      prompt='实现 libs/modules/mmf/feature/src/lib/settlement-list-page.tsx ...')
```

### 3.4 验证/验收子 agent 一律 opus

需求逻辑验证、实现质量校验、迁移率/验收率判定这类「需要对照源码与文档做语义判断」
的工作，始终用 opus（`model:'opus'`），因为误判代价高于算力成本。

---

## 4. 何时读本文件

- **阶段三（ultracode 分析）**：读 §3 决定 Workflow 内各 agent 的 model 分配。
- **阶段四（loop 开发）**：每个任务 spawn subagent 前查 §3.1 选模型；读 §1.2 §2 还原注册与组件映射。
- **阶段五（验收）**：读 §1.3 踩坑 + 迁移文档第 9 章逐项核对。
