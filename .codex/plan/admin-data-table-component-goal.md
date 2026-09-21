# Admin Data Table Component Goal Prompt

你正在 `admin-platform` 中工作。这是一个 Nx + Next.js App Router 管理后台 monorepo，核心约束以 `.codex/project/pro.md` 和 `.codex/project/rule.md` 为准。

## 背景

旧系统 `/Users/zhangxuefeng/reddate/poc/td-manage/libs/components/CustomTable.tsx` 是一个高度集成的列表页模板组件。它同时承担：

- 查询表单 schema 渲染
- SWR 请求与分页参数维护
- Antd Table 渲染
- 操作列生成
- localStorage 权限过滤
- 单元格 tooltip 复制
- 标题区按钮
- ref 暴露刷新方法

这个组件在旧系统中能快速产出 CRUD 列表页，但它把 UI、请求协议、权限、路由特例、环境变量和业务动作耦合在一起。新仓库不能原样迁移。

本次目标是基于旧组件的业务语义，设计并实现一个适配当前 `admin-platform` 的生产级列表组件能力。

## 当前项目事实

- 当前仓库已有低阶表格组件：`libs/shared/ui/src/lib/data-table/data-table.tsx`。
- 该表格基于 `@tanstack/react-table`，已支持 columns、data、loading、pagination、selection、empty state。
- 当前仓库使用 Radix UI、Tailwind CSS、lucide-react、React Hook Form、Zod、TanStack Query。
- API 请求、query key、mutation、缓存失效应放在对应 `libs/modules/<domain>/data-access`，不应放进通用 UI 组件。
- `shared` 不能依赖 `libs/modules/*`。
- `apps/admin` 应保持薄层，只做路由、layout、providers 和模块装配。

## 关键产品判断

API 部分不放进这个组件。调用方直接传入已经整理好的数据结构：

```ts
export interface AdminTablePage<TData> {
  rows: TData[];
  page: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

或者使用当前 `DataTable` 已有的拆分式 props：

```ts
data: TData[];
pagination: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};
```

组件只负责展示、交互和事件回调，不负责请求、缓存、路由跳转或权限来源读取。

## 推荐实现方向

不要重写一个新的旧版 `CustomTable`。推荐在现有 `DataTable` 上迭代：

1. 保留 `DataTable` 作为低阶基础表格。
2. 新增一个更高阶的后台列表组合组件，例如 `AdminDataTable` 或 `DataTablePanel`。
3. 高阶组件只组合：
   - header/title/extra actions
   - filter slot
   - table
   - row actions
   - copyable cell helper
   - loading/empty/error display
4. 查询表单建议通过 `filter`/`filterSlot` 传入，而不是在组件内部定义旧式 `form.items` schema。

推荐落点：

```text
libs/shared/ui/src/lib/data-table/
├── data-table.tsx
├── data-table-panel.tsx
├── data-table-actions.tsx
├── data-table-copyable-cell.tsx
├── data-table.types.ts
└── index.ts
```

如果实现中需要强依赖 React Hook Form 字段组件，优先把表单组合留在业务 `feature` 或 `libs/shared/ui-forms`，避免 `shared/ui` 与 `shared/ui-forms` 形成不必要的反向依赖。

## 建议公共类型

```ts
export interface DataTableAction<TData> {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  permission?: string;
  confirm?: {
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel?: React.ReactNode;
  };
  onSelect: (row: TData) => void | Promise<void>;
}

export interface DataTablePanelProps<TData extends { id: string }> {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  filter?: React.ReactNode;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  error?: React.ReactNode;
  emptyMessage?: string;
  pagination?: DataTablePagination;
  selection?: DataTableSelection;
  getRowActions?: (row: TData) => DataTableAction<TData>[];
  allowedPermissions?: string[];
  onRefresh?: () => void;
  className?: string;
}
```

设计理由：

- `allowedPermissions` 由调用方传入，组件不读 localStorage。
- `getRowActions` 只描述当前 row 能做什么，具体业务跳转和 mutation 由调用方处理。
- `confirm` 只描述确认弹窗 UI，实际 action 仍由 `onSelect` 执行。
- `filter` 使用 slot，避免过早复制旧 `form.items` DSL。
- `onRefresh` 可选，替代旧组件 `ref.mutate()` 的隐式刷新方式。

## 行为要求

- 表格必须支持受控服务端分页。
- 分页变化只通过 `pagination.onPageChange` 通知调用方。
- 组件不构造 API 参数，不知道 `pageNum/pageSize/data` 这类旧后端协议。
- 操作列仅在 `getRowActions` 返回可见动作时显示。
- 多个动作使用 dropdown menu；一个动作可以直接显示按钮或仍保持 menu，按现有 UI 一致性决定。
- 权限过滤只基于传入的 `allowedPermissions`，并允许无权限参数时默认展示。
- destructive action 必须有视觉区分。
- confirm action 使用现有 `AlertDialog` / `Dialog` 能力，不引入 Antd Modal。
- copyable cell 使用现有 `Tooltip`/toast 能力，不引入 `copy-to-clipboard`，优先使用 `navigator.clipboard` 并处理失败状态。
- loading、empty、error 状态必须明确可见。
- 不硬编码旧系统路由特例，例如 `/transaction-flow/stablecoin`、`/wallet/user-wallet`。
- 不硬编码 `NEXT_PUBLIC_SYS_ENV === 'TDManage'`。

## 非目标

- 不实现 API 请求。
- 不实现 TanStack Query hook。
- 不迁移旧项目所有调用方。
- 不引入 Antd、SWR、Headless UI 或新的 UI 基础库。
- 不把旧 `CustomTableProps` 原样搬进当前项目。
- 不为了兼容旧系统保留 `GlobalAny`、`BCMP.Objects` 这类宽泛类型。

## 分阶段迭代

### Iteration 1：纯展示组合

成功标准：

- 新增 `DataTablePanel`，组合 title、extra、filter、DataTable。
- 复用现有 `DataTable`，不破坏原 public API。
- 支持 loading、empty、error。
- 导出入口更新到 `libs/shared/ui/src/index.ts`。
- 增加最窄组件测试，覆盖 title/filter/table/empty/loading。

验证：

```bash
pnpm exec nx lint shared-ui
pnpm exec nx test shared-ui
```

### Iteration 2：操作列

成功标准：

- 支持 `getRowActions(row)`。
- 支持 `allowedPermissions` 过滤。
- 支持 disabled/destructive 样式。
- 支持 confirm action。
- action 点击只调用传入回调，不处理业务路由和 mutation。
- 测试覆盖权限过滤、disabled、confirm、async action。

验证：

```bash
pnpm exec nx lint shared-ui
pnpm exec nx test shared-ui
```

### Iteration 3：复制单元格能力

成功标准：

- 提供 `DataTableCopyableCell` 或 column helper。
- 文本过长时 ellipsis，不撑破 table。
- 点击复制后出现成功 toast。
- Clipboard API 不可用或失败时显示失败 toast。
- ReactNode cell 不默认复制，除非显式传入 copyText。

验证：

```bash
pnpm exec nx lint shared-ui
pnpm exec nx test shared-ui
```

### Iteration 4：业务页面试点

成功标准：

- 选择一个当前模块列表页试点接入。
- API/query 仍保留在对应 `libs/modules/<domain>/data-access`。
- 页面 feature 负责把 API response 映射为 `rows + pagination`。
- 页面 feature 负责 filter form、query params、mutation invalidate。
- 组件不新增跨层依赖。

验证：

```bash
pnpm exec nx lint <target-project>
pnpm exec nx test <target-project>
```

## 实现前必须阅读

- `.codex/project/pro.md`
- `.codex/project/rule.md`
- `libs/shared/ui/src/lib/data-table/data-table.tsx`
- `libs/shared/ui/src/index.ts`
- `libs/shared/ui/project.json`
- 如果涉及表单试点，阅读 `libs/shared/ui-forms/src/lib/*`
- 如果涉及业务试点，阅读目标模块的 `feature`、`data-access`、`ui`、`src/index.ts`

## 实现提示词

```text
请在当前 `admin-platform` Nx monorepo 中实现一个适配后台管理场景的 DataTablePanel 组件能力。

目标不是迁移旧 `td-manage` 的 `CustomTable`，而是吸收它的业务语义，并按当前项目架构重做：
- API 请求不放进组件。
- 调用方直接传入 rows、pagination、loading、error。
- 查询表单通过 filter slot 传入。
- 操作列通过 getRowActions(row) 描述。
- 权限通过 allowedPermissions 传入。
- 复制能力通过显式 copyable cell/helper 提供。

请优先复用 `libs/shared/ui/src/lib/data-table/data-table.tsx`，保持现有 DataTable public API 兼容。

实现约束：
- 使用 React 19、TypeScript strict、Tailwind CSS、Radix UI、lucide-react、@tanstack/react-table。
- 不引入 Antd、SWR、Headless UI、copy-to-clipboard 或新的 UI 基础库。
- 不在 shared/ui 中依赖任何 `libs/modules/*`。
- 不读取 localStorage、router、env 来决定组件行为。
- 不硬编码旧系统路由或后端协议。
- 类型必须清晰，不使用 `any` 绕过约束。
- 文件命名使用 kebab-case。
- 变更保持外科手术式，只触碰必要文件。

第一轮只完成 Iteration 1。如果需要继续，再按 Iteration 2、3、4 分步推进。每轮完成后运行最窄 lint/test，并报告未验证项。
```

## 验收口径

实现完成后，不能只说“组件完成”。必须明确回答：

- 组件是否仍然不负责 API 请求。
- 是否复用了现有 `DataTable`。
- 是否保持 `shared` 不依赖 `modules`。
- 是否覆盖 loading/empty/error。
- 是否运行了对应 lint/test。
- 是否存在未验证风险。

## 假设

- 这个能力会被多个业务模块复用，因此基础展示能力可以进入 `libs/shared/ui`。
- 具体查询表单和 API response mapping 仍属于业务 feature/data-access。
- 当前任务先沉淀组件 prompt，不直接实现代码。
