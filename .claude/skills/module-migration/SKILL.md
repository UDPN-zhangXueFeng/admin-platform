---
name: module-migration
description: |
  把老项目（Next.js Pages Router，如 td-manage）的一个模块，全自动迁移到目标 Nx monorepo（admin-platform）。
  完整流程：逆向分析源码 → 生成标准 9 章节迁移文档 → 校验迁移率≥98% → 用 ultracode(Workflow) 分析文档拆任务 → 用 /loop 循环开发 → 验收率≥98%。
  开发阶段模型分配：推理/判断/拆任务/验收用 opus，页面与组件构建用 sonnet，脚本/类型/常量/样板用 haiku。
  当用户说「迁移这个模块」「把 XX 模块迁移过来」「迁移 /path/to/module」「生成迁移文档」「mmf 迁移」「按模块迁移」「迁移到 admin-platform」等，
  或给出一个老项目模块目录路径（如 .../src/pages/mmf）要求迁移时，必须使用此 skill。
  也适用于「分析这个模块怎么迁移」「为 XX 模块出迁移方案」等只要前半段（生成+校验文档）的场景。
---

# 模块迁移自动化

把老项目的一个页面模块，端到端迁移到目标 Nx monorepo，并以迁移率/验收率双 ≥98% 收尾。
该流程已在 14 个模块（chart-of-accounts / journal-entries / posting-engine / statements …）上验证过，
本 skill 把这套已验证流程固化下来。

## 五阶段总览

| 阶段 | 做什么 | 主模型 | 完成标志 |
|------|--------|--------|----------|
| 一·逆向生成文档 | 跑脚本提取事实 + 读源码写判断，套模板生成 9 章节迁移文档 | opus | 文档写入 `.codex/plan/modules/<slug>.md` |
| 二·迁移率校验 | 对照源码四维度校验文档覆盖，<98% 回阶段一补 | opus | 迁移率 ≥ 98% |
| 三·ultracode 拆任务 | Workflow 分析文档，拆成可独立开发任务，请用户确认 | opus | 用户确认任务清单 |
| 四·loop 开发 | /loop 逐任务开发，按产物类型分配 sonnet/haiku，opus 验证 | sonnet/haiku/opus | 所有任务 completed |
| 五·验收 | 对照文档第 9 章验收标准逐项核对，<98% 回阶段四 | opus | 验收率 ≥ 98% |

> 为什么分五阶段：迁移是高风险长链路工作。每阶段都有客观完成标志（迁移率/验收率/用户确认），
> 不达标就回退，避免「假装完成」。这也是项目 CLAUDE.md Rule 4（目标驱动）与 Rule 12（Fail loud）的落地。

## 触发条件

用户表达以下任一意图，且**给出了一个老项目模块路径**：
- 「迁移这个模块」「把 mmf 迁移过来」「迁移到 admin-platform」
- 「生成迁移文档」「为 XX 模块出迁移方案」
- 直接粘贴一个 `src/pages/<module>` 风格的路径要求处理

若用户只说「迁移」但没给路径 → 询问路径，不要猜测（项目 CLAUDE.md Rule 1：不沉默假设）。

## 输入

- **老项目模块路径**（必须）：如 `/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/mmf`
- 目标项目根默认为当前工作目录（admin-platform）；若 cwd 不对则询问。

## 关键路径约定

| 用途 | 路径 |
|------|------|
| 本 skill 目录 | `.claude/skills/module-migration/`（项目内，相对 admin-platform 根） |
| 提取脚本 | `<skill>/scripts/extract-module-meta.sh` |
| 文档模板 | `<skill>/references/doc-template.md` |
| 架构与模型分配参考 | `<skill>/references/target-arch.md` |
| 迁移文档输出 | `<admin-platform>/.codex/plan/modules/<slug>.md` |
| 状态文件 | `<admin-platform>/.claude/module-migration-state.json` |

`<slug>` = 模块目录 basename，转 kebab-case（如 `mmf`；`account-manage` 保持原样）。

## 模型分配（用户硬性要求，贯穿全流程）

| 工作 | 模型 | 落地 |
|------|------|------|
| 逆向理解、迁移率/验收率判定、任务拆分、疑难架构 | **opus** | 主循环；`Agent(model:'opus')`；`agent(prompt,{model:'opus'})` |
| 页面/组件 React+TS 实现 | **sonnet** | `Agent(model:'sonnet')`；`agent(prompt,{model:'sonnet'})` |
| 类型/常量/API 骨架/注册脚本/manifest | **haiku** | `Agent(model:'haiku')`；`agent(prompt,{model:'haiku'})` |

> 完整映射与 Workflow/Agent 写法见 `references/target-arch.md` §3。验证/验收类子 agent 一律 opus。

## 状态管理

每次进入 skill 先读状态文件，按 `phase` 字段定位到对应阶段继续：

```json
{
  "modulePath": "/abs/old/module",
  "moduleName": "mmf",
  "slug": "mmf",
  "docPath": "/abs/admin-platform/.codex/plan/modules/mmf.md",
  "phase": "doc-generating | doc-verified | tasks-planned | developing | accepted",
  "migrationRate": 0.0,
  "acceptanceRate": 0.0,
  "coverage": {
    "sourceFiles":  { "covered": 0, "total": 0, "missing": [] },
    "apis":         { "covered": 0, "total": 0, "missing": [] },
    "pages":        { "covered": 0, "total": 0, "missing": [] },
    "uiMappings":   { "covered": 0, "total": 0, "missing": [] }
  },
  "tasks": [{ "id": "T1", "name": "", "kind": "scaffold|page|verify", "model": "haiku|sonnet|opus", "status": "pending", "deps": [] }],
  "currentIndex": 0
}
```

---

## 阶段一：逆向分析生成迁移文档

1. **推断路径**：模块名/slug、老项目根、admin-platform 根、文档输出路径、状态文件路径。建状态文件（`phase: doc-generating`）。
2. **跑脚本提取事实**（确定性，禁止跳过）：
   ```bash
   bash .claude/skills/module-migration/scripts/extract-module-meta.sh <module-path> /tmp/<slug>-meta.txt
   ```
   产出分段：`SOURCE_FILES`（行数）、`API_ENDPOINTS`（分「页面字面量」与「api 模块封装」两组）、
   `PAGES_ROUTES`、`SHARED_IMPORTS`、`I18N_HINTS`、`STATUS_ENUMS`（完整键值 dump，跨行）、
   `LIMIT_PERMISSIONS`（按钮权限码）、`CROSS_MODULE_ROUTES`（跨模块跳转）。
3. **opus 读源码 + 写文档**：用 `Agent(model:'opus')` 或主循环，以脚本输出为**下限事实**基础，
   实际 Read 源文件写第 1/4/7/8/9 章判断。**严格套用 `references/doc-template.md` 的 9 章节结构**。
   - **脚本输出是下限，不是上限**：脚本已覆盖页面字面量 + `@/lib/api/*` 封装 endpoint，但仍可能漏
     动态拼接的 URL（如 `` `/api/${x}/y` ``）。Read 源码后若发现脚本遗漏，**以源码为准**并在第 8 章标注差异。
   - 状态映射：脚本 `STATUS_ENUMS` 已 dump 完整键值；文档第 6 章照搬，多处相同键值合并为同一常量。
   - 权限码 / 跳转：脚本 `LIMIT_PERMISSIONS` / `CROSS_MODULE_ROUTES` 的项必须进文档第 6 章 / 第 8 章。
4. **写入** `.codex/plan/modules/<slug>.md`，状态 `phase` 留 `doc-generating`，进入阶段二。

> 为什么先脚本后模型：源文件/API/行数是事实（CLAUDE.md Rule 5），交给脚本零幻觉；
> 业务理解/迁移步骤是判断，交给 opus。两者结合才能产出可校验的文档。

## 阶段二：迁移率校验（≥ 98%）

迁移率 = 文档对源码「事实要素」的覆盖比例。用户已选定**四维度全校验**：

| 维度 | 分子（文档已覆盖） | 分母（源码真实存在） | 数据来源 |
|------|--------------------|----------------------|----------|
| 源文件覆盖 | 文档第 2 章列出的文件数 | 脚本 `SOURCE_FILES` 总数 | 脚本 |
| API endpoint 覆盖 | 文档第 3 章列出的 endpoint 数 | 脚本 `API_ENDPOINTS`（页面 + api 模块两组） | 脚本 + 源码核对 |
| 页面/路由覆盖 | 文档描述的页面数 | 脚本 `PAGES_ROUTES` 总数 | 脚本 |
| UI 组件 + 字段映射覆盖 | 文档第 6 章映射项（源组件 + 状态枚举 + 权限码 + 跳转） | 脚本 `SHARED_IMPORTS` + `STATUS_ENUMS` + `LIMIT_PERMISSIONS` + `CROSS_MODULE_ROUTES` | 脚本 |

迁移率 = Σ(各维度 covered) / Σ(各维度 total)。

执行：
1. **重跑脚本** 得到分母基础。脚本已抓页面字面量 + `@/lib/api/*` 封装 endpoint，但**动态拼接的 URL
   脚本抓不到**——校验 agent 必须实际 Read 源码补全分母，以源码真实要素为准（不能只信脚本）。
2. **opus 语义校验**（`Agent(model:'opus')`，独立于生成 agent 以避免「自验偏见」）：逐项判定文档是否覆盖。
   「覆盖」是语义判断——API 可能以函数名出现、组件可能合并描述，需 opus 判断而非字符串相等。
3. 把 `coverage` 四维度的 covered/total/missing 写回状态文件，算 `migrationRate`。
4. **< 98%**：列出 `missing` 项，回到阶段一补全文档对应章节，重校。
   **≥ 98%**：`phase: doc-verified`，进入阶段三。

> 为什么用 opus 做语义匹配：API `endpoint` 与文档里的「函数名 / 描述」不是字面相等，
> 用脚本做精确匹配会误报大量「未覆盖」。让脚本出分母、opus 判分子，各司其职（Rule 5）。

## 阶段三：ultracode 分析文档拆任务

1. **调用 Workflow**（即 ultracode）分析迁移文档，opus 拆任务。
   **关键（踩坑）**：把 `docPath` **字面拼进 script 字符串**，不要用 Workflow 的 `args` 传——
   实测 args 注入不可靠，脚本会在解析期 throw `args.docPath required`。脚本骨架：
   ```javascript
   // docPath 写字面量（主循环拼好后整段传 script），不用 args
   const docPath = '<admin-platform>/.codex/plan/modules/<slug>.md'
   const TASKS_SCHEMA = { /* id/name/kind(scaffold|page|ui|verify)/model(haiku|sonnet|opus)/deps/files/summary */ }
   const result = await agent(
     `读取 ${docPath}，按第 7 章「迁移步骤」拆成可独立开发的任务。
      每个 task 标注 kind 与 deps。子模块各自成链。`,
     { model: 'opus', schema: TASKS_SCHEMA })
   return result
   ```
2. 拆分粒度：一个任务 = 一个 loop 周期可闭环（开发→验证→修复）。基础数据/类型优先，列表页次之，详情/编辑/复杂交互在后。
3. 每个任务打上 `model` 标签（scaffold→haiku，page→sonnet，verify→opus），写回状态文件 `tasks`。
4. **向用户展示任务清单**（表格：编号 | 名称 | kind | 模型 | 依赖 | 复杂度），**等待用户确认后再开发**。
   用户确认后 `phase: tasks-planned`，进入阶段四。

> 为什么必须用户确认：任务拆分决定后续所有开发节奏，错了返工成本极高（CLAUDE.md Rule 1）。

## 阶段四：loop 开发（模型分配落地）

进入本阶段前置 `phase: developing`（中断后重进 skill 可据此继续 loop）。

### 启动 /loop

```
/loop 开发 module-migration 任务：读 .claude/module-migration-state.json，执行当前 pending 任务，按 task.model 分配子 agent，完成后 opus 验证，通过则进入下一任务
```

### 每个 loop 周期

1. 读状态文件，定位当前 pending 任务，置 `in_progress`。
2. **按 `task.model` spawn subagent 实现**：
   - `scaffold`（haiku）：`model.ts` / `api.ts` / `constants.ts` / `module-manifest.ts` / 注册脚本。
   - `page`（sonnet）：ListPage / DetailPage / EditPage / 业务组件。
   - 疑难（opus）：复杂状态机、嵌套表单、文件下载等，用 `Workflow` 或 `Agent(model:'opus')`。
   - 注册/挂载：参照 `target-arch.md` §1.2，**务必在 `apps/admin/tsconfig.json` 登记 paths**（历史踩坑）。
3. **opus 验证子 agent**（`Agent(model:'opus')`）：对照迁移文档第 3 章 API、第 6 章组件映射、第 7 章步骤，
   检查「功能是否实现 / 接口字段是否匹配 / 枚举映射是否正确 / 边界条件」。**+ 静态 grep `target-arch.md` §1.5 运行时坑清单中静态可抓的项**——这些 lint/test 抓不到，必须在 verify 阶段 grep 拦截，避免拖到运行时才崩：
   - `grep -rn "ALL_VALUE\s*=\s*''"` → 必须非空（用 `'all'`），否则 `SelectItem value=""` 崩溃
   - `grep -rn "labelKey\|KEY_PREFIX"` 带 `<slug>.` 前缀 → i18n 双重前缀 MISSING_MESSAGE
   - `grep -rn "{{" i18n json` → ICU `{{}}` 必须转 next-intl `{}`，否则 INVALID_MESSAGE
   - list API 请求体缺 `pageNum` → 数据不显示
   输出 `{passed, issues}`，静态坑命中即 `severity: blocker`。
4. 通过 → `completed`，`currentIndex+1`；未通过 → 当前任务保持 `in_progress`，周期内修复。
5. 写回状态文件，输出进度（已完成/总数 + 上一任务验证结论 + 下一任务 + 阻塞）。

## 阶段五：验收（≥ 98%）

验收率 = 迁移文档「要求实现且可验证」项中，已实现且通过的比例。分子分母来源：

- 第 9 章「验收标准」每一条（可跑 / 可见 / 可对照才算）。
- 第 7 章「迁移步骤」对应产物是否落地（目标文件存在）。
- `pnpm nx lint <slug>` / `pnpm nx test <slug>` / 构建是否通过。

执行：
1. **opus 验收子 agent**（`Agent(model:'opus')`）：逐项核对，产出 `{item, passed, evidence}`。
2. **⚠️ 运行时冒烟（静态 verify 覆盖不到，硬门槛——未跑不得 `phase: accepted`）**：用 `/verify` 或手动跑应用，
   **逐页**（每个 list/detail/edit）打开看控制台——无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE，
   列表有数据，筛选下拉可交互、写操作（弹窗/Mutation）可用。常见运行时坑见 `references/target-arch.md` §1.5
   （i18n 双重前缀、SelectItem 空串/`ALL_VALUE`、ICU `{{}}`、下拉数据 null/空 id、pageNum）。
   **反例（cross-chain）**：阶段五只做静态 lint/test 就标 accepted，用户跑应用连遇 2 个 SelectItem 空串崩溃
   （① FormSelect option 空 stablecoinId ② 7 文件 `ALL_VALUE=''`），静态全绿 ≠ 运行时无 bug。
   运行时冒烟发现的问题计入验收率（未通过 → 回阶段四修）。**冒烟未执行 = 验收率 0，不得标 accepted。**
3. `acceptanceRate = passed / total`，写回状态文件。
4. **< 98%**：列出未通过项，回阶段四对应任务修复，重验。
   **≥ 98%**：`phase: accepted`，输出总结（任务完成度、关键文件、验证/验收中发现并修复的问题、已知限制、后续建议）。

---

## 注意事项

1. **事实与判断分离**：文件/API/路由/行数永远来自脚本；业务理解来自 opus 读源码。禁止用模型猜事实。
2. **状态文件是进度唯一来源**：进入 skill 先读，退出前写（CLAUDE.md Rule 10 checkpoint）。
3. **双 98% 是硬门槛**：迁移率/验收率任一不达标必须回退补齐，不得「差不多就过」（Rule 12 Fail loud）。
4. **用户确认卡点**：阶段三任务清单必须用户确认后才开发；遇到源码歧义（如 audit-trail 导出 API 不明）暂停询问。
5. **模型不得乱配**：页面实现用 sonnet、脚本用 haiku 是成本约束，但验证/验收/拆任务必须 opus，不得降级。（**当前环境 sonnet 不可用**——页面任务降级 opus，详见 memory `sonnet-unavailable`。）
6. **遵循目标项目约定**：Nx 四层结构、i18n 命名空间、组件库用法以 admin-platform 现有模块为准（Rule 11）。

## 边界情况

- 模块路径不存在 / 无 `.ts/.tsx` → 报错，要求重新提供。
- 纯 mock 静态页（脚本 `API_ENDPOINTS` 为空）→ 文档第 3 章写「无真实 API」，仍走完整流程，保留 mock（参考 travel-rule）。
- 子模块结构（如 mmf = settlement + accrual）→ 同一 `<slug>` 库下用文件名前缀区分，不拆库；任务链按子模块分组。
- Drawer 死代码 / 已废弃页面 → 不迁移，在第 8 章「已知限制」标注。
- 状态文件损坏 → 尝试重建；无法重建则从阶段一重来。
- 用户只要前半段（生成+校验文档，不开发）→ 在阶段二达标后停下，输出文档路径，不强制进入阶段三。

## 附属文件

- `scripts/extract-module-meta.sh` — 确定性提取源码元数据（源文件/API/路由/imports/i18n/状态枚举）。
- `references/doc-template.md` — 9 章节迁移文档模板（套用生成）。
- `references/target-arch.md` — 目标 Nx 架构、组件映射速查、模型分配落地写法。
