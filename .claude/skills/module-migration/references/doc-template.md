# 迁移文档模板（9 章节标准结构）

> **本文件用途**：module-migration skill 的「阶段一·逆向生成文档」套用此模板产出
> `.codex/plan/modules/<module>.md`。结构与历史 14 份迁移文档（audit-trail / travel-rule /
> statements / journal-entries …）完全一致，**不要增删章节**，无内容的章节写「无」并说明原因。
>
> **填写规则**：
> - `{{占位符}}` 由生成 Agent 根据源码 + `extract-module-meta.sh` 输出填写。
> - 第 2、3 章的「事实」（文件清单、API）必须来自脚本输出，禁止凭记忆/猜测填写。
> - 第 1、4、7、8、9 章是「判断」，由 opus 模型基于源码理解填写。

---

# {{MODULE_NAME}} 模块迁移计划

## 1. 业务概述

{{2–4 句话。必含：① 核心业务实体（如「结算记录」「计提记录」）；② 主要操作
（查询/创建/审批/导出/查看详情）；③ 页面构成（几个列表页、几个详情页、是否有编辑/审批页）。
若有特殊业务规则（审批流、状态机、金额计算）一句话点出。}}

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/{{module}}/{{sub}}/index.tsx` | {{lines}} | {{列表页：筛选表单 + 表格，调用 XXX list API}} |
| `src/pages/{{module}}/{{sub}}/view.tsx` | {{lines}} | {{详情页：展示单条记录详情，调用 XXX detail API}} |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段。「用途」列由 Agent
> 读源码判断（列表 / 详情 / 编辑 / 创建 / 组件）。每个 `.ts/.tsx` 文件必须出现一行，不得遗漏。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS` + `SHARED_IMPORTS` 段。
> 按「用途」分组，每个 endpoint 标注「调用方文件」与「触发场景」。

### 3.1 列表 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/.../list` | POST | `index.tsx` 的 `useCustomTable.url` | 分页列表查询 |

### 3.2 详情 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/.../detail` | POST | `view.tsx` 的 `useSWR` | 详情页获取单条记录 |

### 3.3 写操作 / 其他 API（创建 / 审批 / 申报 / 导出 / 子查询）

> 若无写「无」。注意三类来源都要覆盖：
> ① 页面内字面量调用；② 封装在 `@/lib/api/*` 的写操作（脚本 `API_ENDPOINTS`「api 模块封装」组，最易漏）；
> ③ 导出类 API 需标注是否涉及文件下载（blob）。

### 3.4 公共下拉数据源

- `/api/manage/v1/common/...`（标注：哪个筛选项用它）

### 3.5 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `useHook`（来自 `libs/components`）
- `formatTimestamp` / `getServerSidePropsResult`（来自 `libs/utils`）
- {{其他来自 SHARED_IMPORTS 的依赖}}

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | {{低 / 中 / 高}} |
| 困难分数 | {{x}}/5 |
| 主要难点 | {{如：useCustomTable 需拆为 DataTable+TanStack Query；嵌套 Form.List；多状态机；文件下载}} |
| 建议负责人 | {{初级 / 中级 / 高级前端}} |

## 5. 迁移后目标文件清单

```text
libs/modules/{{slug}}/
├── data-access/
│   └── src/lib/
│       ├── {{slug}}.model.ts          # 类型定义
│       ├── {{slug}}.api.ts            # API 函数
│       └── +queries/
│           ├── {{slug}}.keys.ts       # Query key 工厂
│           ├── {{slug}}.queries.ts    # 查询 hooks
│           └── {{slug}}.mutations.ts  # 写操作 hooks（无则不建）
├── feature/
│   └── src/lib/
│       ├── {{slug}}-list-page.tsx
│       ├── {{slug}}-detail-page.tsx
│       └── module-manifest.ts         # 菜单/路由/权限注册
├── ui/
│   └── src/lib/
│       └── {{slug}}-xxx.tsx           # 模块专属 UI 组件
└── util/
    └── src/lib/
        └── {{slug}}.constants.ts      # 状态/权限/枚举常量
```

> 四层结构与组件映射详见 `references/target-arch.md`。

**子模块变体**（如 mmf 含 settlement + accrual 两个子模块）：同一 `libs/modules/{{slug}}/` 库下，
feature 层用子模块前缀区分，data-access/ui/util 共用。示例：

```text
libs/modules/{{slug}}/feature/src/lib/
├── {{sub-a}}-list-page.tsx        # 子模块 A 列表页
├── {{sub-a}}-detail-page.tsx
├── {{sub-b}}-list-page.tsx        # 子模块 B 列表页
├── {{sub-b}}-detail-page.tsx
└── module-manifest.ts             # 注册所有子模块路由/菜单
```

不拆成两个库——共用 model/api/constants，避免重复。

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form` |
| `Form` / `Form.Item` | `react-hook-form` + `FormField` / `FormSelect` |
| `Button` / `Input` / `Select` | `@myorg/shared/ui` 同名组件 |
| `DatePicker.RangePicker` | `FormDatePicker` |
| `Tag` | Tailwind badge / Badge 组件 |
| `Drawer` / `Modal` | `@myorg/shared/ui` Drawer / Dialog |
| `CopyableEllipsisText` | `@myorg/modules/<related>/ui` CopyableEllipsisText |
| {{状态 Tag 颜色对象}} | util/constants.ts + Badge variant 映射 |

> 状态/枚举映射数据来源：`extract-module-meta.sh` 的 `STATUS_ENUMS` 段（已 dump 完整键值，含 file:line）。
> 照搬键值到 `constants.ts`。**合并规则**：多处定义若键值完全相同（如 4 个文件都定义同一 `xxxStatus`），
> 合并为一个常量；键值不同则分常量。另：脚本 `LIMIT_PERMISSIONS`（按钮权限码）写入 `constants.ts`，
> `CROSS_MODULE_ROUTES`（跨模块跳转）在第 8 章记录为迁移依赖。

## 7. 迁移步骤

1. 用 Nx generator 创建 `{{slug}}` 模块（data-access / feature / ui / util）。
2. 在 `module-registry.ts` 注册；在 i18n messages 新增 `modules/{{slug}}.json`。
3. 定义类型（`model.ts`）：列表项、查询参数、详情、表单值。
4. 实现 API 函数（`api.ts`）+ TanStack Query hooks。
5. 实现 `ListPage`：`react-hook-form` 筛选 + `DataTable` + 导出/操作按钮。
6. 实现 `DetailPage`：读 URL 参数 + 详情查询 + 字段渲染。
7. {{若有}}：实现编辑/审批页、文件下载、嵌套表单。
8. 单测 + `pnpm nx lint/test {{slug}}`。

> 步骤粒度：每步应对应一个可独立开发的 loop 任务（详见 skill 阶段三）。

## 8. 风险与注意事项

- {{源码中歧义点，如 audit-trail 的「导出按钮实际调哪个 API」}}
- {{性能隐患，如大 JSON 详情页}}
- {{useCustomTable 的 form.items / table.columns / actions 隐式封装，迁移需完整还原}}
- {{i18n key 是否齐全、状态色是否对齐主题}}
- **运行时坑清单（见 `target-arch.md` §1.5，阶段四 verify 必须 grep 拦截、阶段五跑应用冒烟）**：
  `ALL_VALUE` 非空（`'all'` 非 `''`，否则 `SelectItem value=""` 崩溃）/ i18n key 无双重 `<slug>.` 前缀（否则 MISSING_MESSAGE）/ ICU `{{}}` 转 next-intl `{}`（否则 INVALID_MESSAGE）/ list 请求体含 `pageNum`（否则数据不显示）/ 下拉数据过滤空 id 与 null（FormSelect 已组件级兜底，手写 `SelectItem` 仍需自查）。
- {{已知限制：mock 页面、Drawer 死代码不迁移 等}}

## 9. 验收标准

- {{列表页支持所有原筛选条件并正确分页}}
- {{详情页字段完整，跳转正确}}
- {{导出/审批等操作调用正确 API 并有反馈}}
- {{所有文案 i18n 化，权限控制正确}}
- {{状态 Tag 颜色与源码一致}}
- `pnpm nx lint {{slug}}` / `pnpm nx test {{slug}}` / build 通过

> 验收标准项是阶段五「验收率 ≥98%」的分子来源，每项必须可客观验证（能跑、能看到、能对照）。

---

## 生成 Agent（阶段一）的操作约束

1. **先跑脚本**：`bash <skill>/scripts/extract-module-meta.sh <module-path> /tmp/meta.txt`，
   把输出作为第 2、3、6 章的事实基础。
2. **读源码补判断**：第 1、4、7、8、9 章必须实际 Read 源文件，不得仅凭脚本输出臆测。
3. **状态映射完整搬运**：`STATUS_ENUMS` 定位到的每个对象，都要读源文件把完整键值写进文档第 6 章和 `constants.ts` 规划。
4. **输出路径**：`<admin-platform>/.codex/plan/modules/<module>.md`（模块名取目录 basename，kebab-case）。
5. **完成后自检**：对照「迁移率校验四维度」（见 SKILL.md 阶段二）逐项核对，未覆盖的补到文档里再交付校验。
