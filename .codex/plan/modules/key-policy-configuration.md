# Key Policy Configuration 模块迁移计划

> key-management 第 5 个（最后一个）迁入子模块。源：
> `td-manage/src/pages/key-management/key-policy-configuration`（4 文件 / 1768 行）。
> 目标：复用 `libs/modules/key-management/*` + managed-wallets / user-wallets 已打通的接入机制。
> **纯 mock 模块**：脚本 `API_ENDPOINTS = none`，无任何真实 API；所有数据为源码内联静态数组。

---

## 1. 业务概述

Key Policy Configuration（密钥轮换策略配置）管理各业务角色（Contract Owner / Gas Fee / Cold Minter 等
22 种业务角色）的密钥轮换策略：轮换频率、轮换时间、轮换方式（系统自动 / 人工审批）。

主要操作：列表查询（含 4 筛选字段 + 按状态驱动行操作按钮）、新建策略、编辑策略、查看详情
（含两 Tab：Basic Information + Operation Records 操作记录），以及列表页内的 Disable / Enable
弹窗（带 Comments 必填）。4 页面构成：list(index) + new + edit + detail。

**特殊业务规则**：①两套不同状态机——列表/详情页内各自独立（见 §6）；②行操作按状态条件渲染
（Processing 仅 Details / Rejected 仅 Resubmit+Details / Enabled 有 Edit+Disable+Details /
Disabled 有 Edit+Enable+Details）；③轮换频率为复合字段（数字 + 单位 Day/Month），edit 页需
用正则 `parseRotationFrequency` 从字符串 `"3 months"` 反解析。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 717 | 列表页：4 筛选字段（Role Name 下拉 22 项 / Rotation Methods / Creation Date RangePicker / Status）+ 8 列表格；**纯前端筛选** `staticData`（22 条内联）；状态驱动行操作；Disable / Enable 弹窗（Comments 必填，mock 提交仅 console.log）；跳 new / edit / detail |
| `new.tsx` | 345 | 新建页：Business Name 下拉（联动 Description 只读填充）+ Rotation Period（frequencyNumber×frequencyUnit 复合 + TimePicker `HH:mm:ss` + Rotation Method Radio）；mock 提交仅 console.log 跳回列表 |
| `edit.tsx` | 414 | 编辑页：读 URL `?id=`，从内联 `staticData`（4 条，与 index 不同）find 记录回填表单；Business Name 禁用；用 dayjs 解析 `rotationTime`、正则解析 `rotationFrequency`；mock 提交仅 console.log |
| `detail.tsx` | 292 | 详情页：两 Tab。Tab1 Basic Information（CustomIBasicDetailsInfo 渲染 10 字段 + Back）；Tab2 Operation Records（Operation Type 下拉 5 项 + 前端筛选 + 6 列表格 mock）；mock 内联 `keyPolicyData` 单条 + `operationRecordsData` 5 条 |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段。「用途」由 Agent 读源码判断。
> 4 个文件均含 `getServerSideProps`（仅 i18n 注入，无数据预取）。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS` 段 = **none**。

### 3.1 列表 / 详情 API

- **无真实 API**。列表数据 `staticData`（index.tsx:72-305，22 条）与 edit 回填数据 `staticData`
  （edit.tsx:157-197，4 条，字段略不同）**均为源码内联静态数组**，筛选在前端 `handleQuery` 完成。
- 详情页 `keyPolicyData`（detail.tsx:16-28，1 条）与 `operationRecordsData`（detail.tsx:31-72，5 条）
  同样**内联静态**。

### 3.2 写操作 API

- **无真实 API**。new/edit 提交（`handleSubmit`）仅 `console.log('Submit:', values)`；
  Disable/Enable 弹窗提交（`handleDisableSubmit`/`handleEnableSubmit`）仅 `console.log`，无跳转。
  所有写操作均为 mock，**无后端 endpoint**。

### 3.4 公共下拉数据源

- **无 common 接口调用**。所有下拉为源码内联常量：
  - Role Name 22 项（index.tsx:31-61 `businessNameOptions`，含 All）
  - Rotation Methods 2 项（index.tsx:572-579 硬编码 System-initiated / Manual approval）
  - Status 4 项（index.tsx:593-598 Processing/Rejected/Enabled/Disabled）
  - Business Name 22 项 + description（new.tsx:29-152 / edit.tsx:31-154 `businessNameData`，无 All）
  - Frequency Unit 2 项（Day(s)/Month(s)）
  - Operation Type 5 项（detail.tsx:234-241 Enable/Disable/Edit/Resubmit/Add）

### 3.5 依赖共享组件 / 工具

- `useHook`（`libs/components`）— `routerPush` / `routerBack`（index/new/detail），edit 用 `next/router` `useRouter` 读 `query.id`
- `CustomIBasicDetailsInfo`（`libs/components/CustomIBasicDetailsInfo`）— detail Tab1 详情容器
- `formatTimestamp` / `getServerSidePropsResult`（`libs/utils`）
- antd：Table / Form / Modal / Select / DatePicker.RangePicker / TimePicker / Radio.Group / Tabs / Tag
- dayjs（edit.tsx — 仅用于 `dayjs(record.rotationTime, 'HH:mm:ss')` 解析时间字符串回填 TimePicker）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | 中 |
| 固难分数 | 3/5 |
| 主要难点 | ①**纯 mock**（无 API）— data-access 层无 api/queries，仅 model + mock-data；②**4 页面路由**（list/new/edit/detail）需扩展 `modulePageKey` IIFE 支持 `<sub>/{new,edit,detail}`（现仅支持 `<sub>/detail`）；③**两套状态机**（index 4 态 vs detail 操作记录 3 态），需分别建常量；④**复合字段表单**（频率 = number×unit + TimePicker + Radio + 联动 Description）；⑤edit 需正则反解析 `rotationFrequency` + 时间字符串解析（dayjs 无目标侧依赖，需降级）；⑥状态驱动行操作（4 种 status → 不同 action 集合）+ Disable/Enable 弹窗 |
| 建议负责人 | 中-高级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/key-management/
├── data-access/src/lib/key-policy-configuration/   # 新子目录（纯 mock：model + mock-data，无 api/keys/queries）
│   ├── key-policy-configuration.model.ts           # 类型：PolicyListItem / PolicyDetail / OperationRecord / PolicyFormValues
│   └── key-policy-configuration.mock-data.ts       # mock：policyList (22) + policyEditList (4) + policyDetail (1) + operationRecords (5)
├── data-access/src/index.ts                        # +barrel（仅类型 + mock 数据，无 hooks/api）
├── feature/src/lib/
│   ├── key-policy-configuration-list-page.tsx      # 列表页（4 筛选 + 8 列 + 状态驱动操作 + Disable/Enable Dialog）
│   ├── key-policy-configuration-new-page.tsx       # 新建页（Business Name + 复合频率表单）
│   ├── key-policy-configuration-edit-page.tsx      # 编辑页（读 ?id 回填 + Business Name 禁用）
│   └── key-policy-configuration-detail-page.tsx    # 详情页（两 Tab + Operation Records 前端筛选）
├── feature/src/index.ts                            # +barrel（4 个 page 导出）
└── util/src/lib/constants.ts                       # +keyPolicyStatusMap (4 态) + operationRecordStatusMap (3 态) + roleNameOptions (22) + rotationMethodOptions (2) + operationTypeOptions (5)

（接入点 — 第 8 章详述）
apps/admin/.../[[...slug]]/module-page-registry.ts   # keyManagementPages +4 loader（list/new/edit/detail）
apps/admin/.../[[...slug]]/page.tsx                  # keyManagementPageKeys +'key-policy-configuration' + modulePageKey IIFE 扩展（支持 new/edit/detail）
configs/stablecoin.json                             # 菜单已存在（行 119-123），无需改
i18n messages/key-management.json                   # 无新 key（复用 PUB_*；纯 mock 文案内联）
```

> **data-access 设计说明**：纯 mock 模块，按 skill 边界情况「纯 mock 静态页 → 保留 mock」处理。
> 不建 `api.ts` / `keys.ts` / `queries.ts`（无 API、无 TanStack Query）。仅 `model.ts`（类型）+
> `mock-data.ts`（4 份内联静态数据从源码原样搬入，供 list/edit/detail/new 共享与按 id 查询）。
> feature 层 page 直接 `import { policyList, policyDetail, ... } from data-access`。

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `Table`（antd 直接用，非 CustomTable） | `DataTable` + 前端分页（mock 数据，无 server pagination） |
| `Form` / `Form.Item` / `Form.useForm` | `react-hook-form` + `FormField` / 原生 label |
| `Select`（筛选下拉） | `FormSelect`（All value 用 `'all'` 哨兵，非空串 — 见 §8 坑清单） |
| `Select`（Business Name 联动 Description） | `FormSelect` + `watch` 联动只读 `Textarea` |
| `DatePicker.RangePicker` | 两个 `Input[type=date]` 降级（对齐 managed-wallets 模式） |
| `TimePicker`（`HH:mm:ss`） | 目标侧无 TimePicker 组件 → **降级为 `Input[type=time]`**（HTML 原生），值为 `'HH:mm:ss'` 字符串 |
| `Radio.Group`（Rotation Method） | 目标侧 `RadioGroup` 或两个 `Radio`（`@myorg/shared/ui`） |
| `Space.Compact`（频率数字+单位并排） | flex 容器并排两个 `FormSelect` |
| `Modal`（Disable / Enable） | `Dialog` / `@myorg/shared/ui` Dialog（footer 自定义 Cancel + Confirm） |
| `Tabs`（detail 两 Tab） | `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`（对齐 managed-wallets-detail） |
| `Tag`（status，两套色映射） | Tailwind badge span（`rounded-full border px-2.5 py-0.5 text-xs font-semibold`）+ tone class |
| `CustomIBasicDetailsInfo`（detail Tab1） | 自建 `DetailItem` 组件（对齐 key-signed-transactions-detail / managed-wallets-detail 模式） |
| `Card` | shadcn card（`rounded-lg border bg-card`） |
| `useHook.routerPush/routerBack` | `useRouter` from `@myorg/shared/util-i18n`（`router.push` / `router.back`） |
| `next/router` `useRouter`（edit 读 id） | `useSearchParams` from `next/navigation`（对齐 managed-wallets-detail 读 id 模式） |

**枚举（两套状态机，分建常量 — 第 3.6 章 STATUS_ENUMS 完整键值）**：

```text
// util/src/lib/constants.ts 追加

/** 列表页状态机（index.tsx:64-69，4 态）— 与详情操作记录状态机【不同】，分建 */
export const keyPolicyStatusMap: Record<string, { label: string; tone: string }> = {
  Processing: { label: 'Processing', tone: 'processing' },
  Rejected:   { label: 'Rejected',   tone: 'error' },
  Enabled:    { label: 'Enabled',    tone: 'success' },
  Disabled:   { label: 'Disabled',   tone: 'default' },
};

/** 详情页 Operation Records 状态机（detail.tsx:137-148，3 态）— 与列表页【不同】 */
export const operationRecordStatusMap: Record<string, { label: string; tone: string }> = {
  'Pending Approval': { label: 'Pending Approval', tone: 'warning' },
  Approved:           { label: 'Approved',         tone: 'success' },
  Rejected:           { label: 'Rejected',         tone: 'error' },
};

/** 22 业务角色（index.businessNameOptions + new/edit.businessNameData 合并去重；All 仅列表筛选用） */
export const roleNameOptions: { label: string; value: string; description: string }[] = [ /* 22 项，从源搬入 */ ];

/** 轮换方式（2 项，含 value/label；注意源 new/edit 用 kebab value，index 用 Title Case label） */
export const rotationMethodOptions = [
  { label: 'System-initiated', value: 'system-initiated' },
  { label: 'Manual approval',  value: 'manual-approval' },
];

/** 详情 Operation Type 筛选（detail.tsx:234-241，5 项） */
export const operationTypeOptions = [
  { label: 'Enable',   value: 'Enable' },
  { label: 'Disable',  value: 'Disable' },
  { label: 'Edit',     value: 'Edit' },
  { label: 'Resubmit', value: 'Resubmit' },
  { label: 'Add',      value: 'Add' },
];
```

> **合并规则**：两套状态机键值不同（index 的 4 态 vs detail 的 3 态），**不可合并**，分别建两个常量。
> `rotationMethodOptions`：源 new/edit Radio 用 kebab-case value（`system-initiated` / `manual-approval`），
> 但 index 列表筛选 / 数据用 Title Case（`System-initiated` / `Manual approval`）。迁移统一为 kebab
> value + Title label，数据层 mock 保留源 Title Case（编辑回填需 Title→kebab 映射，见 §8）。

## 7. 迁移步骤

> 每步对应一个可独立开发的 loop 任务。模型分配：scaffold/constants = haiku；
> 4 个 page + 路由扩展 = opus（表单逻辑 / 状态机判断较重）。

1. **scaffold + 类型 + mock 数据 + 常量**（haiku）
   - 新建 `data-access/src/lib/key-policy-configuration/` 目录：
     - `key-policy-configuration.model.ts`：`PolicyListItem`（id/businessName/description/rotationFrequency/
       rotationTime/rotationMethods/createdOn/status）、`PolicyDetail`（+createdBy/updatedBy/updatedOn）、
       `OperationRecord`（key/operationType/createdBy/createdOn/comments/status）、`PolicyFormValues`
       （businessName/frequencyNumber/frequencyUnit/rotationTime/rotationMethod）。
     - `key-policy-configuration.mock-data.ts`：原样搬入 4 份数据 — `policyList`（index staticData 22 条）、
       `policyEditList`（edit staticData 4 条）、`policyDetail`（detail keyPolicyData 1 条）、
       `operationRecords`（detail operationRecordsData 5 条）。
   - `util/src/lib/constants.ts` 追加 5 个常量（§6）。更新 `util/src/index.ts` barrel。
   - 更新 `data-access/src/index.ts` barrel（re-export 类型 + mock 数据，**无 hooks/api**）。
   - **验证**：`pnpm nx lint key-management-*` + admin tsc 不新增错误。

2. **list 页**（opus）
   - `key-policy-configuration-list-page.tsx`：
     - react-hook-form（4 字段：roleName / rotationMethods / status + creationDate 两个 date input）；
       All option value=`'all'`。
     - mock 数据来自 `policyList`（import），**前端 useMemo 筛选**（对齐源 `handleQuery` 逻辑：
       roleName 精确匹配 / rotationMethods 精确匹配 / status 精确匹配 / 日期范围 createdOn 比较）。
     - 8 列（Role Name / Description / Rotation Frequency / Rotation Time / Rotation Methods /
       Created on[formatTimestamp] / Status[badge via keyPolicyStatusMap] / Actions）。
     - **状态驱动行操作**（`getActions`）：Processing→Details；Rejected→Resubmit+Details；
       Enabled→Edit+Disable+Details；Disabled→Edit+Enable+Details。按钮用 `Button variant="link"`。
       Resubmit/Edit 跳 `/key-management/key-policy-configuration/edit?id=`；Details 跳 `/.../detail?id=`。
     - `+ New` 按钮跳 `/key-management/key-policy-configuration/new`。
     - Disable / Enable **Dialog**（Comments 必填 `Textarea`，maxLength 200 showCount；Business Name 只读展示），
       提交仅 console.log + 关闭弹窗（忠实源 mock 行为）。
     - 前端分页（DataTable pagination，total = filtered.length）。

3. **new 页**（opus）
   - `key-policy-configuration-new-page.tsx`：react-hook-form + zod（required 校验）。
     - Business Name `FormSelect`（22 项，`watch` 联动只读 Description Textarea）。
     - Rotation Frequency：两个并排 `FormSelect`（frequencyNumber 1-12 + frequencyUnit Day/Month），
       initialValues `{frequencyNumber:1, frequencyUnit:'months'}`。
     - Rotation Time：`Input[type=time]`（降级 TimePicker），placeholder `'02:00:00'`。
     - Rotation Method：RadioGroup（2 项），system-initiated 选中时显示蓝色 InfoCircle 提示文案。
     - Buttons：Back（`router.back()`）+ Submit（`handleSubmit` console.log，**不跳转** — 忠实源）。
     - 页头标题 `New Key Rotation Policy Configuration`。

4. **edit 页**（opus）
   - `key-policy-configuration-edit-page.tsx`：读 `?id=`（`useSearchParams`），从 `policyEditList`
     find 记录（`useEffect` 回填 form，对齐源 edit.tsx:232-254）。
     - Business Name `FormSelect` **disabled**（编辑不可改角色）。
     - **反解析逻辑**：
       - `rotationFrequency`（如 `'3 months'`）→ `parseRotationFrequency` 正则 `/(\d+)\s*(day|month)/i`
         拆为 frequencyNumber + frequencyUnit（day→days / month→months）。
       - `rotationTime`（如 `'02:00:00'`）→ 直接用作 `Input[type=time]` value（源用 `dayjs(str,'HH:mm:ss')`，
         目标无 dayjs 依赖，**降级为字符串直传**，时间字符串本身即 `HH:mm:ss` 兼容 input）。
       - `rotationMethods`（Title Case `System-initiated`）→ kebab value（`system-initiated`）。
     - 其余字段同 new 页。Submit mock console.log。Back `router.back()`。

5. **detail 页**（opus）
   - `key-policy-configuration-detail-page.tsx`：两 Tab（`Tabs`，对齐 managed-wallets-detail）。
     - 读 `?id=`（语义化，但源 detail **不按 id 查** — 直接展示内联 `policyDetail` 单条；
       迁移保持：读 id 但 mock 数据固定展示 `policyDetail`，§8 标注此 mock 局限）。
     - Tab1 Basic Information：自建 `DetailItem`（对齐 key-signed-transactions-detail）渲染 10 字段
       （Business Name / Status[badge] / Description / Rotation Frequency / Rotation Time /
       Rotation Methods / Created by / Created on / Updated by / Updated on）+ Back 按钮。
       Status 用源固定 `green`（detail.tsx:88 hardcode），或映射到 keyPolicyStatusMap（源此 Tag 走
       `getStatusColor` 但 Tab1 直接 hardcode green — 忠实源用固定 tone）。
     - Tab2 Operation Records：Operation Type `Select`（5 项，对齐源，value/label）+ Reset + Query 按钮；
       **前端 useMemo 筛选** `operationRecords`（按 operationType）；6 列表格（Operation Type / Created by /
       Created on / Comments / Status[badge via operationRecordStatusMap] / Actions[Details 占位]）；
       前端分页。底部 Back 按钮。

6. **接入：registry + page.tsx 路由扩展 + feature barrel**（haiku + opus 路由扩展）
   - `module-page-registry.ts`：`keyManagementPages` 追加 4 loader：
     `'key-policy-configuration'`（list）/ `'key-policy-configuration-new'` /
     `'key-policy-configuration-edit'` / `'key-policy-configuration-detail'`。
   - `feature/src/index.ts`：导出 4 个 page 组件。
   - `page.tsx`：`keyManagementPageKeys` 追加 `'key-policy-configuration'`；**扩展 `modulePageKey` IIFE**
     支持 `<sub>/{new,edit,detail}`（§8 给具体代码）。
   - **验证**：grep 路由 key 一致；lint/tsc。

7. **verify**（opus）
   - `pnpm nx lint key-management-*` + `pnpm nx test`（若有）+ admin build。
   - grep 运行时坑（§8）；路由 4 条均 307 非 404；4 页面冒烟（list 筛选 / new 表单校验 / edit 回填 /
     detail 两 Tab）。

## 8. 风险与注意事项

### 8.A 路由扩展（核心接入改动）

**现状**：`apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx` 的 `modulePageKey` IIFE
（94-104 行）只支持 `<sub>/detail` 两段路由（managed-wallets 引入）：

```ts
const modulePageKey: string | null = (() => {
  if (module !== 'key-management' || !realSlug?.[0]) return pageKey;
  const subSlug = realSlug[0];
  const mapped = keyManagementPageKeys[subSlug];
  if (mapped) {
    return realSlug[1] === 'detail' ? `${mapped}-detail` : mapped;
  }
  return KEY_MANAGEMENT_STANDARD_ROUTES.has(subSlug) ? pageKey : null;
})();
```

**问题**：key-policy-configuration 有 new / edit（源用 `'new'` 非 `'create'`，注意
`KEY_MANAGEMENT_STANDARD_ROUTES` 含 `'create'` 不含 `'new'`）。当访问
`/key-management/key-policy-configuration/new` 时，`realSlug = ['key-policy-configuration', 'new']`，
`mapped = 'key-policy-configuration'`，`realSlug[1] === 'new'` ≠ `'detail'` → 返回 `'key-policy-configuration'`
（**误命中 list loader，错误**）。同理 edit。

**扩展代码**（向后兼容：第二段为 undefined / 非已知词时保持原 list 行为）：

```ts
const modulePageKey: string | null = (() => {
  if (module !== 'key-management' || !realSlug?.[0]) return pageKey;
  const subSlug = realSlug[0];
  const mapped = keyManagementPageKeys[subSlug];
  if (mapped) {
    // 支持子模块的二级路由：list / new / edit / detail。
    // realSlug[1] 为 undefined 时是 list（/<sub>）；否则按段映射到对应 loader。
    // 注意：key-policy-configuration 源用 'new'（非 'create'）。
    const sub = realSlug[1];
    if (sub === undefined) return mapped;                       // list
    if (sub === 'detail') return `${mapped}-detail`;            // detail（原逻辑）
    if (sub === 'new' || sub === 'create') return `${mapped}-new`;
    if (sub === 'edit') return `${mapped}-edit`;
    return mapped;                                              // 未知二级段兜底为 list
  }
  return KEY_MANAGEMENT_STANDARD_ROUTES.has(subSlug) ? pageKey : null;
})();
```

**registry 4 loader**（`module-page-registry.ts` `keyManagementPages` 追加）：

```ts
'key-policy-configuration': () =>
  import('@myorg/modules/key-management/feature').then((m) => ({
    default: m.KeyPolicyConfigurationListPage as unknown as ComponentType<unknown>,
  })),
'key-policy-configuration-new': () =>
  import('@myorg/modules/key-management/feature').then((m) => ({
    default: m.KeyPolicyConfigurationNewPage as unknown as ComponentType<unknown>,
  })),
'key-policy-configuration-edit': () =>
  import('@myorg/modules/key-management/feature').then((m) => ({
    default: m.KeyPolicyConfigurationEditPage as unknown as ComponentType<unknown>,
  })),
'key-policy-configuration-detail': () =>
  import('@myorg/modules/key-management/feature').then((m) => ({
    default: m.KeyPolicyConfigurationDetailPage as unknown as ComponentType<unknown>,
  })),
```

> 其他子模块（managed-wallets/user-wallets）无 new/edit，`realSlug[1]` 不会是 `'new'`/`'edit'`，
> 行为不变（**向后兼容**）。

### 8.B mock 数据策略（纯 mock 模块）

- **无 API / 无 TanStack Query**。data-access 仅 `model.ts` + `mock-data.ts`，feature page 直接 import
  静态数据，**前端 useMemo 筛选**（list 筛选 / detail Operation Records 筛选）。
- mock 数据原样从源搬入（22+4+1+5 条），**字段名 / 值保持源**（含 `createdOn` 为 ms 时间戳 in index，
  但 detail 的 createdOn 为格式化字符串 `'Mar 20, 2024, 11:14:41 (UTC+8)'` — 两处格式不同，建模分类型，
  §8.C 标注）。
- 写操作（new/edit/Disable/Enable）仅 console.log mock，**忠实源行为不补真实提交**。后续接后端需：
  ①新建 submit API；②Disable/Enable API（带 comments）；③edit 回填接 detail API 替代 mock find。

### 8.C 歧义点（源码不明确处）

1. **`createdOn` 双格式**：index.tsx `staticData.createdOn` 为 ms 时间戳（`1710907481000`，经 `formatTimestamp`），
   detail.tsx `keyPolicyData.createdOn` 为**已格式化字符串**（`'Mar 20, 2024, 11:14:41 (UTC+8)'`）。
   → model.ts 分两个类型（`PolicyListItem.createdOn: number` vs `PolicyDetail.createdOn: string`），
   detail 页直接展示字符串（不再 formatTimestamp）。
2. **edit 回填数据与 index 列表数据不一致**：edit.tsx `staticData` 仅 4 条且 rotationFrequency 值
   （`'1 day'` / `'7 days'` / `'1 month'`）与 index（全 `'3 months'`）不同；id 跳跃（1/2/3/5，缺 4）。
   → 忠实源：搬入两份独立 mock（`policyList` vs `policyEditList`），edit 按 id 在 `policyEditList` find。
   若 id 不在 4 条内（如点 index 第 5 条 id=5 → edit 找不到），**源行为是表单空白**（find 返回 undefined
   不回填）— 迁移保持，§8.D 标注。
3. **detail 不按 id 查**：源 detail.tsx **完全不读 `?id=`**，直接展示硬编码 `keyPolicyData`
   （Contract Owner）。迁移读 id 但 mock 固定展示 `policyDetail`（保持源「所有 id 都看同一条」mock 行为）。
4. **Operation Records 的 Actions 列**（detail.tsx:190-198）：渲染 `Details` 文本 span 但**无 onClick**
   （死链接）。迁移保持占位文本或省略 — 倾向**保留占位**忠实源，§9 标注为已知 mock 限制。

### 8.D Rotation Method value 命名不一致

源 index 列表数据 / 筛选用 **Title Case**（`System-initiated` / `Manual approval`），但 new/edit Radio
用 **kebab-case value**（`system-initiated` / `manual-approval`）。edit 回填时需 Title→kebab 映射
（源 edit.tsx:237-240 已做此映射）。迁移：数据层 mock 保留 Title Case（与 index 筛选一致），
`rotationMethodOptions` 用 kebab value；edit 回填复用源映射逻辑。

### 8.E dayjs 降级

源 edit.tsx 用 `dayjs(record.rotationTime, 'HH:mm:ss')` 回填 antd TimePicker。目标侧无 dayjs 依赖
（且降级为 `Input[type=time]`）。**降级**：时间字符串 `'02:00:00'` 本身即 `HH:mm:ss`，直接作为
input value，无需 dayjs 解析。new 页 TimePicker placeholder `'02:00:00'` 同理降级。

### 8.F 运行时坑清单（阶段四 verify 必须 grep 拦截）

- **All option value 必须 `'all'`**（非空串）— list 筛选 4 下拉、detail Operation Type Select 的
  All 项均用 `'all'`，避免 `SelectItem value=""` 崩溃（对齐 managed-wallets §8.G 教训）。
  - 注意：源 index 用空串 `''` 作 All value（`initialValue=""`），迁移**必须改 `'all'`**。
- **i18n key 无双重前缀**（namespace 已是 `modules.key-management`，page 内 key 不带 `key-management.` 前缀）。
- mock 数据无 `pageNum`（纯前端筛选，DataTable pagination total = filtered.length，无 server 请求）。
- 纯 mock 文案（标题 / 列名 / InfoCircle 提示）目前**内联英文**（对齐 user-wallets 决策 — 源文案未
  走 i18n，迁移暂不补全 i18n key，后续接后端时统一）。

### 8.G 已知限制

- **纯 mock**：无真实数据 / 无真实提交 / 无真实分页（前端分页）/ detail 不按 id。
- **写操作无反馈**：new/edit/Disable/Enable 仅 console.log，不跳转 / 不 toast（忠实源）。
- **Operation Records Actions 死链接**（见 §8.C.4）。
- **i18n 未补全**：复用 `PUB_Query` / `PUB_Reset` / `PUB_NoData`；页面专属文案内联英文。

## 9. 验收标准

- [ ] 路由 4 条均正常渲染（不再 Page Not Found）：
      `/key-management/key-policy-configuration`（list）、`/.../new`、`/.../edit?id=`、`/.../detail?id=`
- [ ] list 页：4 筛选字段（Role Name 22 项 / Rotation Methods 2 项 / Status 4 项 / Creation Date 范围）
      前端筛选正确；8 列完整；`formatTimestamp` 渲染 createdOn；Status badge 4 色（keyPolicyStatusMap）
- [ ] list 页行操作按状态正确显示（Processing 仅 Details / Rejected Resubmit+Details / Enabled Edit+Disable+Details / Disabled Edit+Enable+Details），跳转 edit/detail 正确
- [ ] list 页 `+ New` 跳 new；Disable/Enable Dialog 弹出（Comments 必填校验 + maxLength 200 showCount）
- [ ] new 页：Business Name 联动 Description 只读；复合频率表单（1-12 × Day/Month）；Rotation Time input；
      Rotation Method Radio + system-initiated InfoCircle 提示；required 校验；Submit console.log + Back
- [ ] edit 页：读 `?id=` 从 mock find 回填（Business Name 禁用）；`parseRotationFrequency` 正确拆分
      `'3 months'`→3+months；rotationTime 字符串直传；Title→kebab method 映射；Submit console.log + Back
- [ ] detail 页：两 Tab（Basic Information 10 字段 + Operation Records 5 列筛选）；Operation Records
      按 Operation Type 前端筛选；Status badge 3 色（operationRecordStatusMap）；Back 按钮
- [ ] 两套状态机常量独立（keyPolicyStatusMap / operationRecordStatusMap），不混淆
- [ ] `pnpm nx lint key-management-*` 通过；admin tsc 不新增错误；build exit 0
- [ ] 运行时冒烟：4 页面挂载无 Runtime Error；路由 307 非 404（纯 mock 无需后端数据）
