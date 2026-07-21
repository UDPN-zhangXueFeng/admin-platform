# Managed Wallets 模块迁移计划

> key-management 模块的第 3 个迁入子模块。源：`td-manage/src/pages/key-management/managed-wallets`
> （2 文件 / 843 行）。目标：复用已有 `libs/modules/key-management/*` 四层结构，照搬
> `key-signed-transactions` / `key-service-configuration` 的迁移模式。

---

## 1. 业务概述

Managed Wallets（托管钱包）管理区块链托管钱包的密钥与轮换生命周期。核心实体为**托管钱包记录**
（`chainAccountId` 唯一标识）。主要操作：列表查询（按 Role / Key ID / Token / Wallet Address /
Blockchain / 创建时间 / Status 七维筛选）与查看详情。详情页含两个 Tab：**Basic Information**
（Current Wallet Details 10 字段 + Key Rotation Details 5 字段）与 **Rotation History**
（轮换历史记录表，自带 5 维筛选 + 分页）。业务规则：钱包密钥有轮换状态机
（`rotationStatus` 8 态：1/5/10/15/20/30/35/40），钱包自身状态 3 态（Active/Inactive/Pending）。

页面构成：**1 个列表页 + 1 个详情页**（无创建/编辑/审批页）。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 280 | 列表页：7 筛选字段（roleName/keyId/tokenId/walletAddress/blockchainId/创建时间区间/status）+ 11 列表格；调 `wallets/manage/list`；token/blockchain 下拉复用 common 接口；行操作 Details 跳 detail |
| `detail.tsx` | 563 | 详情页：2 Tab。Tab1 Basic Information = 2 个 CustomIBasicDetailsInfo（Current Wallet Details 10 字段 + Key Rotation Details 5 字段）；Tab2 Rotation History = 独立查询表单（walletAddress/keyId/creationDate/transactionHash/status）+ 10 列分页表。调 `wallets/manage/detail` + `wallets/manage/rotation/history` |

> 数据来源：`extract-module-meta.sh` SOURCE_FILES。两文件均经主循环逐行通读。

## 3. 依赖的 API

> 5 个 endpoint。脚本抓到 3 个页面字面量；`walletsManageDetailApi` /
> `walletsManageRotationHistoryApi` 封装在 `@/typings/token-manage/V1.ts`（脚本未抓），
> 已通过 Read V1.ts 确认实际 URL（均为 POST）。

### 3.1 列表 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/wallets/manage/list` | POST | `index.tsx` `useCustomTable.url` | 分页列表。body `{ data: ManageWalletListReqVo, page: { pageNum, pageSize } }` |

### 3.2 详情 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/wallets/manage/detail` | POST | `detail.tsx` `walletsManageDetailApi` | 单条详情。body `{ chainAccountId }` |
| `/api/manage/v1/wallets/manage/rotation/history` | POST | `detail.tsx` `walletsManageRotationHistoryApi` | 轮换历史分页。body `{ data: { chainAccountId, walletAddress?, keyId?, creationStartDate?, creationEndDate?, transactionHash?, status? }, page: { pageNum, pageSize } }` |

### 3.3 写操作 / 其他 API

无。本模块为纯查询（list + detail + history），无创建/编辑/审批/导出。

### 3.4 公共下拉数据源（**复用现有 data-access，不重复实现**）

| Endpoint | Method | 用途 | 复用 hook |
|----------|--------|------|-----------|
| `/api/manage/v1/common/stablecoin/enabled/searches` | GET | index 页 Token 下拉 | `useStablecoinOptionsQuery`（已存在于 key-signed-transactions.api） |
| `/api/manage/v1/common/blockchain/list` | GET | index 页 Blockchain 下拉 | `useBlockchainOptionsQuery`（已存在） |

> **复用决策**：这两个 common 接口已在 `key-signed-transactions.api.ts` 实现并被
> `key-signed-transactions-list-page.tsx` 使用，managed-wallets 直接复用，不新增。
> blockchain 下拉沿用既有「过滤 `status !== 1`」语义（源码是 `disabled`，目标改为过滤，与
> key-signed-transactions 一致）。

### 3.5 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `useHook`（`libs/components`）→ `DataTable` + TanStack Query + `react-hook-form`
- `formatTimestamp` / `getServerSidePropsResult`（`libs/utils`）→ 目标侧本地 `formatTimestamp`（`new Date(ts).toLocaleString()`）
- `CustomIBasicDetailsInfo`（`libs/components`）→ shadcn card + `DetailItem` 子组件（参照 key-signed-transactions-detail-page）
- antd `Paragraph copyable` → `CopyableEllipsisText`（`@myorg/shared/ui` 已有 `copyable-ellipsis-text`）
- antd `Tabs` → `Tabs`（`@myorg/shared/ui` 已有 `tabs`）
- antd `Tag` → `Badge`（`@myorg/shared/ui` 已有 `badge`）或 span badge（与既有 detail 页一致用 span）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | 中 |
| 困难分数 | 3/5 |
| 主要难点 | ① detail 页 2 Tab 结构（Basic Info 双 card + Rotation History 独立查询表 + 表）；② **detail 路由接入需改 `page.tsx`** 支持 `<sub>/detail` 两段 slug（现有 key-management 的 detail 组件存在但 registry 未注册、list 无跳转入口，即 detail 路由实际未接通）；③ roleName 类型/枚举矛盾（见第 8 章）；④ rotationStatus 8 态状态机映射 |
| 建议负责人 | 中级前端 |

## 5. 迁移后目标文件清单

> **子模块结构**：落在已有 `libs/modules/key-management/` 下，**不新建库**。data-access 建子目录
> `managed-wallets/`（参照已有 `key-signed-transactions/`），feature 用 `managed-wallets-` 前缀，
> util 追加到现有 `constants.ts`。

```text
libs/modules/key-management/
├── data-access/src/lib/
│   ├── managed-wallets/                       # 新子目录
│   │   ├── managed-wallets.model.ts           # 类型：list req/resp、detail req/resp、history req/resp
│   │   ├── managed-wallets.api.ts             # 3 个新 API（list / detail / rotation-history）
│   │   ├── managed-wallets.keys.ts            # Query key 工厂
│   │   └── managed-wallets.queries.ts         # 3 个 query hooks（stablecoin/blockchain 复用既有）
│   └── index.ts                               # +barrel 导出 managed-wallets 类型/api/keys/queries
├── feature/src/lib/
│   ├── managed-wallets-list-page.tsx          # 列表页（7 筛选 + 11 列 + Details 跳转）
│   ├── managed-wallets-detail-page.tsx        # 详情页（2 Tab：Basic Info + Rotation History）
│   └── index.ts                               # +barrel 导出 ManagedWalletsListPage / ManagedWalletsDetailPage
├── util/src/lib/
│   └── constants.ts                           # 追加：roleNameMap / walletStatusMap / rotationStatusMap
└── util/src/index.ts                          # +barrel 导出新增常量

（跨 lib 接入点）
apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/
├── module-page-registry.ts                    # keyManagementPages + 'managed-wallets'(list) / 'managed-wallets-detail'(detail) loader
└── page.tsx                                   # keyManagementPageKeys +'managed-wallets'；modulePageKey 逻辑支持 <sub>/detail 两段

i18n messages/  modules/key-management.json    # +managed-wallets 文案（namespace modules.key-management）
```

## 6. UI 组件映射

### 6.1 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form` |
| `Form` / `Form.Item` | `react-hook-form` + `FormSelect`（`@myorg/shared/ui-forms`）+ 原生 label |
| `Input` | `@myorg/shared/ui` `Input` |
| `Select` / `Select.Option` | `FormSelect`（筛选）/ shadcn `Select`（静态） |
| `DatePicker.RangePicker` | 日期区间：shadcn 无现成 RangePicker，**降级方案**用两个 `Input[type=date]` 或复用既有模块的日期组件（开发时核对 shared/ui 与 ui-forms 是否已有 FormDatePicker；若无则最小实现） |
| `Table` | `DataTable` |
| `Tabs` | `@myorg/shared/ui` `Tabs` |
| `Tag`（status 色） | span badge（`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold`，与 key-signed-transactions-detail 一致）或 `Badge` |
| `Tooltip` + `InfoCircleOutlined` | `@myorg/shared/ui` `Tooltip` |
| `Button` | `@myorg/shared/ui` `Button` |
| `Spin` | `isLoading` → DataTable 内置 / animate-pulse skeleton |
| `message.error` | `toast`（`@myorg/shared/ui` / sonner，开发时核对既有用法） |
| `Paragraph copyable` | `CopyableEllipsisText`（`@myorg/shared/ui`） |
| `CustomIBasicDetailsInfo` | shadcn card（`rounded-lg border bg-card`）+ `DetailItem` 子组件 |
| `Col` / `Row` / `Space` | Tailwind grid / flex |

### 6.2 状态 / 枚举映射（照搬源码键值 → util/constants.ts）

**walletStatusMap**（钱包状态，list + detail 共用，源 index.tsx:36 + detail.tsx:41 键值相同，合并）：
```ts
1: { label: 'Active',   tone: 'success' }
2: { label: 'Inactive', tone: 'default' }
3: { label: 'Pending',  tone: 'processing' }
```

**rotationStatusMap**（轮换历史状态，detail 专用，源 detail.tsx:47）：
```ts
1:  { label: 'Pending Generation',   tone: 'default' }
5:  { label: 'Pending Review',       tone: 'warning' }
10: { label: 'Reviewing',            tone: 'processing' }
15: { label: 'Review Rejected',      tone: 'error' }
20: { label: 'Pending Execution',    tone: 'warning' }
30: { label: 'Executing',            tone: 'processing' }
35: { label: 'Completed',            tone: 'success' }
40: { label: 'Failed',               tone: 'error' }
```

**roleNameMap**（角色名，list + detail 共用。**以页面实际使用的 1/2/3 为准**，见第 8 章矛盾）：
```ts
1: 'Contract Owner'       // detail.tsx 源码首字母大写为 'Contract owner'，统一为 'Contract Owner'
2: 'Payment of gas fee'
3: 'Management wallet'
```
（list 页筛选下拉 `roleNameOptions` 也用此 3 值 + All）

**权限码**：脚本 `LIMIT_PERMISSIONS` 为空。源 index.tsx 行操作 `limit: 'OS_P_show'`（Details 按钮），
目标侧无 limit 体系，迁移为普通行操作（不挂权限码），与 key-signed-transactions 一致。

**跨模块跳转**（脚本 `CROSS_MODULE_ROUTES`）：
- `/key-management/managed-wallets/detail`（index → detail，带 `?id=chainAccountId`）

### 6.3 i18n

- namespace：`modules.key-management`（与既有 key-management 子模块一致，**不新建 namespace**）
- 复用 key：`PUB_All` / `PUB_Query` / `PUB_Reset` / `PUB_NoData`（既有）
- 新增 key：`key_management_0067`（Wallet Address 列 Tooltip 提示）、`token_type_${n}`（token 类型，**既有 key-signed-transactions 已用，确认已存在**）
- 列标题/字段标签：源码大量硬编码英文（'Role Name' / 'Key ID' / ...），目标侧可先保留英文 label（与 key-signed-transactions-list-page 一致，未全量 i18n），或补 i18n key。**默认跟随既有模块：英文硬编码 label，仅 PUB_* 与 key_management_0067 走 i18n**。

## 7. 迁移步骤

> 每步 = 一个 loop 任务。基础数据优先 → 列表 → 详情 → 接入 → 验收。

1. **scaffold·类型**（haiku）：`managed-wallets.model.ts`。定义 `ManagedWalletListReq/Resp`、
   `ManagedWalletDetailReq/Resp`、`WalletRotationHistoryReq/Resp`、分页 `PageInfo`。照搬
   `data-contracts.ts` 字段（见第 8 章类型矛盾处理）。
2. **scaffold·API + keys + queries**（haiku）：`managed-wallets.api.ts`（3 函数：`getManagedWallets` /
   `getManagedWalletDetail` / `getManagedWalletRotationHistory`，POST，URL 带 `/api` 前缀，body 含 `pageNum`）、
   `managed-wallets.keys.ts`、`managed-wallets.queries.ts`（3 hooks）。data-access barrel + util constants 追加。
3. **scaffold·util constants**（haiku）：`walletStatusMap` / `rotationStatusMap` / `roleNameMap` + options
   派生。util barrel 导出。
4. **page·列表页**（sonnet 不可用→**opus**）：`managed-wallets-list-page.tsx`。react-hook-form 7 筛选 +
   `useManagedWalletsQuery` + `useStablecoinOptionsQuery` + `useBlockchainOptionsQuery` + DataTable 11 列 +
   Details 行操作跳 `/key-management/managed-wallets/detail?id=chainAccountId`。参照
   `key-signed-transactions-list-page.tsx`。
5. **page·详情页**（opus）：`managed-wallets-detail-page.tsx`。`useSearchParams` 读 `id` →
   `useManagedWalletDetailQuery`。Tabs 两页：Basic Information（2 card：Current Wallet Details 10 字段 +
   Key Rotation Details 5 字段，含 Back）+ Rotation History（react-hook-form 5 筛选 +
   `useManagedWalletRotationHistoryQuery` + DataTable 10 列分页）。参照
   `key-signed-transactions-detail-page.tsx` 的 card / DetailItem 模式。
6. **scaffold·接入点**（haiku + 主循环核对）：
   - `module-page-registry.ts`：`keyManagementPages` 加 `'managed-wallets'`（list）与
     `'managed-wallets-detail'`（detail）两个 dynamic loader。
   - `page.tsx`：`keyManagementPageKeys` 加 `'managed-wallets': 'managed-wallets'`；
     **改 `modulePageKey` 逻辑**支持 `<sub>/detail` 两段（见第 8 章 A）。
   - feature barrel 导出 2 组件。
   - i18n `modules/key-management.json` 补 `key_management_0067`。
7. **verify·静态 + 运行时冒烟**（opus）：lint/test/build + grep 运行时坑 + 逐页打开看控制台。

## 8. 风险与注意事项

### A. detail 路由接入需改 `page.tsx`（**核心架构改动**）

现有 `page.tsx` 的 `modulePageKey` 只按 `realSlug[0]` 映射（`keyManagementPageKeys[realSlug[0]]`），
单段 key 无法区分 list/detail。且现状：`key-signed-transactions` 的 detail 组件
`KeySignedTransactionsDetailPage` 虽存在并已 barrel 导出，但 **registry 未注册 detail loader、list 页无
跳转入口**——即 key-management 的 detail 路由实际从未接通。

managed-wallets 的 detail URL 为 `/key-management/managed-wallets/detail?id=chainAccountId`
（realSlug=`['managed-wallets','detail']`）。**最小向后兼容改动** `modulePageKey` 计算：

```ts
const modulePageKey: string | null = (() => {
  if (module !== 'key-management' || !realSlug?.[0]) return pageKey;
  const subSlug = realSlug[0];
  const mapped = keyManagementPageKeys[subSlug];
  if (mapped) {
    // 已迁子模块：支持 /<sub> (list) 与 /<sub>/detail (detail) 两段
    return realSlug[1] === 'detail' ? `${mapped}-detail` : mapped;
  }
  return KEY_MANAGEMENT_STANDARD_ROUTES.has(subSlug) ? pageKey : null;
})();
```

registry 对应增加 `'managed-wallets-detail'` loader。该改动**向后兼容**：现有子模块
（key-signed-transactions / key-service-configuration）的 realSlug[1] 不会是 'detail'，行为不变。
顺带让 key-management 的「子模块 detail」机制首次真正可用。

### B. roleName 类型 / 枚举矛盾（Rule 7 surface conflict）

- `data-contracts.ts` 注释：`roleName` 1:Contract Owner, 5:Role Admin, 10:Configuration Admin,
  15:Gas Fee Address, 20:To-be Burn Wallet（**5 值**）。
- `index.tsx` / `detail.tsx` 实际映射：1/2/3（**3 值**，Contract Owner / Payment of gas fee / Management wallet）。
- 类型：list `roleName?: number`；detail `roleName?: string`（**list/detail 不同**）。

**处理**：以**页面实际使用的 1/2/3** 为准（那是 UI 真实展示的）。model.ts 中 list.roleName: `number`、
detail.roleName: `string | number`（与源类型一致）。`roleNameMap` 只建 1/2/3。文档标注此矛盾，后续若后端
返回 5/10/15/20 则走 fallback 显示原值（`getDisplayRoleName` 已有此兜底）。

### C. rotationFrequency 类型矛盾

list `rotationFrequency?: number`（@format int32），detail `rotationFrequency?: string`。源 index.tsx
渲染 `record.rotationFrequency || '3 months'`（number truthy → fallback 字符串）。
**处理**：model.ts list 用 `number`、detail 用 `string`（与源类型一致），渲染均做 `|| '--'`（目标侧不
硬编码 '3 months' 兜底，改 '--'，避免误导）。

### D. list req 的 roleName 必填 vs UI 允许 All

`ManageWalletListReqVo.roleName: number`（必填），但 index.tsx 筛选 initialValue=''（All）。
**处理**：目标 model.ts 中 list filters 的 `roleName` 设为**可选**（`number | undefined`），与 UI 行为
一致；不传时后端应返回全部（若后端强制必填，运行时冒烟会暴露，届时补默认值）。

### E. apiClient URL 前缀 `/api` 不统一（既有瑕疵）

`getKeySignedTransactions` 用 `/manage/v1/...`（无 /api），`getKeyServiceConfigurations` 与本模块源码用
`/api/manage/v1/...`（有 /api），同库共存。baseURL = `NEXT_PUBLIC_API_BASE_URL`。
**处理**：managed-wallets 三个 API 一律用 `/api/manage/v1/...`（与源码 + getKeyServiceConfigurations 一致）。

### F. RangePicker 降级

目标 shared/ui 无现成 antd RangePicker 等价物。开发时先核对 ui-forms 是否有 FormDatePicker；
若无，Rotation History 的 creationDate 区间用两个 `Input[type=date]` 或单 Input 起止最小实现
（该筛选非核心，降级可接受）。**在第 9 章标注为已知限制**。

### G. 运行时坑清单（阶段四 verify 必须 grep 拦截、阶段五跑应用冒烟）

- `ALL_VALUE` 非空：roleName/status 下拉的 "All" option 用 `'all'`（非 `''`），否则 `SelectItem value=""` 崩溃。
- i18n key 无双重 `modules.key-management.` 前缀（namespace 已是 `modules.key-management`，页面 `t('xxx')` 不要再写 `modules.key-management.xxx`）。
- ICU `{{}}` → next-intl `{}`（新增 i18n 文案注意）。
- list / history 请求体必含 `pageNum`（否则数据不显示）。
- 下拉数据过滤空 id / null（FormSelect 已组件级兜底；手写 SelectItem 自查）。
- `useSearchParams` 需 Suspense boundary（既有 detail 页已在 Suspense 下，核对 layout）。

## 9. 验收标准

- [ ] 列表页 `/key-management/managed-wallets` 正常渲染（不再 Page Not Found），7 个筛选条件全部生效，
      分页正确（请求体含 `pageNum`）。
- [ ] 列表 11 列字段完整，Role Name（1/2/3 映射）/ Status（3 态 badge）/ 时间列（formatTimestamp）渲染正确；
      Token 列双行（tokenName + token_type）。
- [ ] Token / Blockchain 下拉数据来自复用的 `useStablecoinOptionsQuery` / `useBlockchainOptionsQuery`，
      Blockchain 过滤 `status===1`。
- [ ] 行操作 Details 跳转 `/key-management/managed-wallets/detail?id=<chainAccountId>` 正确进入详情页。
- [ ] 详情页 Tab1 Basic Information：Current Wallet Details（10 字段）+ Key Rotation Details（5 字段）
      完整渲染，Key ID / Wallet Address / Public Key 支持 copy，Back 按钮可用。
- [ ] 详情页 Tab2 Rotation History：5 筛选生效，10 列分页表正常（请求体含 `pageNum`），Status（8 态 badge）正确。
- [ ] `page.tsx` 的 `modulePageKey` 改动向后兼容（现有 key-signed-transactions / key-service-configuration
      路由无回归）。
- [ ] i18n：`key_management_0067`（Wallet Address Tooltip）有文案；无 MISSING_MESSAGE / INVALID_MESSAGE。
- [ ] `pnpm nx lint key-management` / `pnpm nx test key-management` 通过；admin build 不新增错误。
- [ ] 运行时冒烟：逐页（list / detail 两个 Tab）打开，控制台无 Runtime Error，列表有数据或正常空态。

> 已知限制（验收时标注，不阻塞）：RangePicker 降级为原生 date input（见第 8 章 F）；roleName 以页面
> 1/2/3 为准（见 B）；无真实后端时数据为空属正常（与既有模块一致，由用户在已登录环境验证数据）。
