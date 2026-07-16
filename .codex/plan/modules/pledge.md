# pledge 模块迁移计划

## 1. 业务概述

pledge 模块管理**储备资产（Reserve Asset）**与**储备资产交易（Reserve Asset Transaction）**两类业务实体，属稳定币/代币化存款场景下的储备金管理。主要操作：储备资产支持「查询列表 + 新增（Drawer）/编辑资产类别（Drawer）/启用·停用/查看详情/新增资产类别页」；储备资产交易支持「查询列表 + 新建交易页 + 跳转审批详情」；详情页含 3 个 Tabs（基本信息含 echarts 饼图 + 资产交易 + 操作记录）。页面构成：**2 个列表页 + 2 个详情/编辑类页（new-view 详情 + asset-transaction/edit 新建交易）+ 1 个独立新增页（asset-ategory 新增资产类别）+ 4 个详情页内组件 = 10 个文件**（同一 `libs/modules/pledge/` 库下分 `asset-transaction` 与 `reserve-asset-list` 两个子模块）。特殊业务规则：① **列表页 `bookStatus`（账本状态 configured/not_setup）是前端推导的"伪状态"**——后端不存此字段，前端按 `financeBookId` 有无推导，筛选时需"拉全量（pageSize=1000）→ 前端过滤 → 再切片分页"，是列表页最复杂的逻辑；② **状态机驱动行操作按钮**（status 10/15 仅 Details；20 可 Add/Edit/Deactivate/Details/NewTransaction；50 可 Add/Edit/Activate/Details/NewTransaction）；③ 详情页 echarts 饼图（仅 Basic Information Tab）需迁移到 admin-platform 的 **recharts**（目标项目无 echarts，已迁移模块均未用 echarts）。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/pledge/asset-transaction/index.tsx` | 270 | 储备资产交易**列表页**：筛选（RefNo/资产名/币种/资产类别/交易类型/创建时间/状态）+ 表格（行操作 Details 跳 `/approval-manage/view`，顶部 New/Import/Adjustment 按钮），调用 `reserve/asset/manage/tx/searches`（useCustomTable.url）+ common/currency + reserve/asset/manage/category/list 下拉 |
| `src/pages/pledge/asset-transaction/edit.tsx` | 366 | 储备资产交易**新建页**：储备资产名 Select（联动货币 + 资产类别下拉）+ 资产类别 Select + 交易类型 Radio（Inflow/Outflow）+ Quantity + 资产价值（两位小数校验），调用 `reserveAssetListApi`（`reserve/asset/list`）回填选项 + `reserveAssetManageTxSaveApi`（`reserve/asset/manage/tx/save`）提交。**注：源码 import 了 `getReserveManageDetailApi`（query.id 编辑态），但该页实际只用于新建，编辑态分支为预留/半成品** |
| `src/pages/pledge/reserve-asset-list/index.tsx` | 714 | 储备资产**列表页（最复杂）**：筛选（资产名/币种/bookStatus 前端推导/创建时间/状态）+ 表格（资产类别 Popconfirm 预览+跳详情、bookStatus 列含跳 `/financial/chart-of-accounts/view`、状态 Tag 走 i18n 动态 key）+ 新增/编辑共用 Drawer（资产类别 Checkbox.Group）+ 行操作状态机（Add/Edit/Activate/Deactivate/Details/NewTransaction），调用 `reserve/asset/listPage`（customFetch 含 bookStatus 全量拉取+前端过滤+分页重算）+ common/bank + common/currency + reserve/asset/manage/category/list + `reserveNewAccountApi`(add) + `reserveAssetEditApi`(edit) + `reserveChangeStatusAccountApi`(edit/status) |
| `src/pages/pledge/reserve-asset-list/edit.tsx` | 276 | 储备资产交易**新建页（旧版）**：银行账户只读 + 交易ID/时间/方向(Radio 1/2)/金额 + 对手方/对手方账户/代理行，调用 `reserveDetailAccountApi`（accountOverview）回填 + `reserveNewTransactionApi`（tx/save）提交。**疑为废弃/半成品——reserve-asset-list/index 的 NewTransaction 行操作跳的是 `asset-transaction/edit`（新版），而非本页；本页无路由入口，建议阶段二确认是否死代码** |
| `src/pages/pledge/reserve-asset-list/view.tsx` | 520 | 储备资产**详情页（旧版/死代码）**：账户概览卡片 + Tokens 概览（>1 走 Carousel，==1 单卡）+ 交易列表（useCustomTable url=`reserve/manage/list`）+ Drawer 交易详情，调用 `reserve/manage/list` + `reserveDetailAccountApi`(accountOverview) + `reserveTokenAccountApi`(tokensOverview) + `getReserveManageDetailApi`(manage/detail)。**无任何路由引用此页——列表页 Details/Popconfirm 均跳 `new-view`，此页为废弃旧版，不迁移（第 8 章标注）** |
| `src/pages/pledge/reserve-asset-list/new-view.tsx` | 256 | 储备资产**详情页（真正在用）**：3 Tabs 容器（Basic Information / Asset Transactions / Operation Records），拉取详情后把 `categorieList` 映射成汇总行传给 ViewBasic。**实际只调 `reserveGetAssetCategoryApi`（`reserve/asset/detail`）；`reserveDetailAccountApi` 调用被整段注释（改用 detail 返回的 accountName/currency/balance/tokenCount）**。定义 statusColorsBasic / statusColorsAssetTxn / opStatusColors 三套色映射传给子组件 |
| `src/pages/pledge/reserve-asset-list/view-basic.tsx` | 409 | 详情页**Basic Information Tab 组件**：3 卡片概览（基本信息 + 总资产价值含 **echarts 饼图** + Tokens 数）+ Reserve Asset Summary 表 + Tokens Overview（Carousel）。使用 `loadEcharts`（libs/echarts）渲染饼图。含 tokenTypeText、statusText 映射 |
| `src/pages/pledge/reserve-asset-list/view-asset-transactions.tsx` | 224 | 详情页**Asset Transactions Tab 组件**：筛选（资产类别 Select）+ 分页表（No/类别/类型/价值/创建人/时间/状态），调用 `reserveGetAssetTxListApi`（`reserve/asset/manage/tx/searches`）+ `reserveGetAssetCategoryListApi`（`reserve/asset/manage/category/list`）。含 statusText（5/10/15/35）映射 |
| `src/pages/pledge/reserve-asset-list/view-operation-records.tsx` | 227 | 详情页**Operation Records Tab 组件**：筛选（操作类型 Select）+ 分页表（类型/创建人/时间/状态/操作），调用 `reserveGetAssetOperateRecordListPageApi`（`reserve/asset/detail/operateRecordListPage`）。行 Details 跳 `/approval-manage/view`。含 operateTypeOptions（All=0..5）、内嵌 statusDict（5/10/15/20）映射 |
| `src/pages/pledge/reserve-asset-list/asset-ategory.tsx` | 157 | **新增资产类别页**（独立路由，文件名 typo，实为 asset-category）：货币/资产名只读 + `Form.List` 动态多条资产类别（50 字符 + 正则校验 + 增删），调用 `reserveAddAssetCategoryApi`（`reserve/asset/category/add`）。由 reserve-asset-list/index 的 AddAssetCategory 行操作跳入 |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段（10 文件 / 3419 行）。「用途」由 Agent 逐文件读源码判断。**关键发现**：`view.tsx`（520 行）为废弃旧版详情页，无路由引用，不迁移但第 8 章标注；`edit.tsx`（276 行）疑为废弃，阶段二需确认。真正在用的详情页是 `new-view.tsx`（+ 4 个 Tab 组件）。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面字面量 6 + api 模块封装 14）+ 源码逐文件核对（含 `@/typings/token-manage/V1` 封装的真实 endpoint）。**去重后实际 endpoint 集合 = 18 个**（不含死代码 view.tsx 独占的 3 个 + 未使用的 stablecoinInfoApi）。详见第 8 章歧义清单。**全部为 POST，无文件下载（无 blob）**。

### 3.1 列表 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/reserve/asset/listPage` | POST | `reserve-asset-list/index.tsx` 的 `useCustomTable.url`（customFetch 改写） | 储备资产分页列表查询。**customFetch 含 bookStatus 前端过滤逻辑**：传 bookStatus 时拉 pageSize=1000 全量→前端 filter→重算分页切片；不传时正常分页 |
| `/api/manage/v1/reserve/asset/manage/tx/searches` | POST | `asset-transaction/index.tsx` 的 `useCustomTable.url`；`view-asset-transactions.tsx` 的 `reserveGetAssetTxListApi` | 储备资产交易分页列表查询（列表页 + 详情页 Asset Transactions Tab 共用） |

> **分页字段（硬约束 #5）**：listPage 走后端分页，请求体 `page` 必须用 `pageNum`/`pageSize`（index.tsx customFetch 已显式写 `pageNum`）。迁移到 admin-platform `DataTable` + TanStack Query 时 api 层必须保持 `pageNum`。

### 3.2 详情 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/reserve/asset/detail` | POST（`reserveGetAssetCategoryApi`） | `new-view.tsx` 的 `useEffect` | 储备资产详情页主数据（accountName/currency/balance/tokenCount/categorieList/tokenList）。**new-view 唯一实际调用的详情接口** |
| `/api/manage/v1/reserve/asset/detail/operateRecordListPage` | POST（`reserveGetAssetOperateRecordListPageApi`） | `view-operation-records.tsx` 的 `handleQuery` | 详情页 Operation Records Tab 分页列表（参数含 operateType，0 转空串） |

### 3.3 写操作 / 其他 API（创建 / 状态变更 / 子查询）

| Endpoint | Method | 封装函数 / 调用方 | 触发场景 |
|----------|--------|------------------|----------|
| `/api/manage/v1/reserve/asset/add` | POST（`reserveNewAccountApi`） | `reserve-asset-list/index.tsx` 的 `onFinish`（drawerInfo.type==='new'） | 新增储备资产（Drawer），默认塞 Cash 资产类别 ID |
| `/api/manage/v1/reserve/asset/edit` | POST（`reserveAssetEditApi`，来自 typings） | `reserve-asset-list/index.tsx` 的 `onFinish`（drawerInfo.type==='edit'） | 编辑储备资产资产类别（name→id 映射，含 nameToIdMap） |
| `/api/manage/v1/reserve/asset/edit/status` | POST（`reserveChangeStatusAccountApi`） | `reserve-asset-list/index.tsx` 的 `actionClick`（Deactivate→50 / Activate→20） | 启用/停用储备资产 |
| `/api/manage/v1/reserve/asset/category/add` | POST（`reserveAddAssetCategoryApi`） | `asset-ategory.tsx` 的 `onFinish` | 新增资产类别（categoryNameList 数组 + reserveAccountId） |
| `/api/manage/v1/reserve/asset/manage/tx/save` | POST（`reserveAssetManageTxSaveApi` 来自 typings / `reserveNewTransactionApi` 来自 pledge.ts，**同 endpoint 两个封装**） | `asset-transaction/edit.tsx`（新版）/ `edit.tsx`（旧版） | 新建储备资产交易 |
| `/api/manage/v1/reserve/asset/list` | POST（`reserveAssetListApi`，来自 typings） | `asset-transaction/edit.tsx` 的 `useSWR` | 储备资产列表（新建交易页的下拉选项源，无分页） |
| `/api/manage/v1/reserve/manage/detail` | POST（`getReserveManageDetailApi`） | `asset-transaction/edit.tsx`（query.id 编辑态，半成品）/ `view.tsx`（死代码 Drawer 详情） | 交易详情。**asset-transaction/edit 实际只新建，编辑态为预留；view.tsx 死代码** |
| `/api/manage/v1/reserve/manage/updateReserveAccount` | POST（`reserveEditAccountApi`，pledge.ts:49） | **无调用方（死代码）** | 阶段二 grep 确认：pledge.ts 定义但 pages/pledge 与全仓 src 均无调用。与 typings 的 `reserveAssetEditApi`（reserve/asset/edit）是不同 endpoint，勿混淆。**不迁移** |
| `/api/manage/v1/reserve/manage/updateTransaction` | POST（`reserveEditTransactionApi`，pledge.ts:86） | **无调用方（死代码）** | 阶段二 grep 确认：pledge.ts 定义但全仓无调用。**不迁移** |

### 3.4 公共下拉数据源

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/currency/list` | GET（useSWR） | `asset-transaction/index.tsx`、`reserve-asset-list/index.tsx` | Currency 筛选/表单下拉（label=key, value=value） |
| `/api/manage/v1/common/bank/list` | GET（useSWR） | `reserve-asset-list/index.tsx`、`edit.tsx`（旧版） | Bank 下拉（label=bankName, value=bankId）。**注：index.tsx 的 bankId 筛选项被注释掉，bankList 仅在旧版 edit.tsx 用** |
| `/api/manage/v1/reserve/asset/manage/category/list` | POST（useSWR / `reserveGetAssetCategoryListApi`） | `asset-transaction/index.tsx`、`asset-transaction/edit.tsx`、`reserve-asset-list/index.tsx`、`view-asset-transactions.tsx` | 资产类别下拉（参数 reserveAccountId + state）。多页共用 |

### 3.5 依赖共享组件 / 工具

- `CustomTable` / `CustomTableTitle` / `useCustomTable` / `useHook`（来自 `libs/components`）— 列表页核心，含 customFetch 钩子（index.tsx 用它实现 bookStatus 前端过滤）
- `formatTimestamp` / `reSet` / `getServerSidePropsResult`（来自 `libs/utils`）— 时间格式化 + 金额千分位
- `getTimestamp`（来自 `libs/utils/get/getDateFormat`）— 旧版 edit.tsx 用，DatePicker 转时间戳
- `loadEcharts`（来自 `libs/echarts`）— view-basic.tsx 饼图（**迁移目标：recharts**）
- `@heroicons/react`（20/solid、24/outline）— Drawer 关闭、外链图标
- `dayjs` — 旧版 edit.tsx DatePicker 禁选未来日期
- 第三方：antd（Table/Form/Drawer/Tag/Tabs/Carousel/Popconfirm/Checkbox 等）、swr、next、next-i18next

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | **3.5**/5 |
| 主要难点 | ① **reserve-asset-list/index.tsx（714 行）的 bookStatus 前端过滤+伪分页**——后端无 bookStatus 字段，前端按 financeBookId 推导，筛选时拉 pageSize=1000 全量→前端 filter→按 pageNum/pageSize 重算切片与 total，迁移到 DataTable+TanStack Query 需完整还原这段 customFetch 逻辑（最易出错点）；② **状态机驱动行操作**（status 10/15/20/50 四态分支不同按钮集 + Deactivate/Activate 走 Popconfirm confimStr + 直接调 mutation）；③ **新增/编辑共用 Drawer**（form1 双表单实例 + type 分支 + Checkbox.Group vs Input Cash 分支 + name→id 映射）；④ **echarts 饼图迁移到 recharts**（目标项目无 echarts，view-basic 需重写图表层，数据是 categorieList 的 proportion/assetTypeName）；⑤ **多页共用同一 endpoint 但参数/回填逻辑不同**（category/list 在 4 个文件各有一套 options 构建逻辑，需统一）；⑥ **死代码/半成品识别**（view.tsx 整页废弃、edit.tsx 疑废弃、stablecoinInfoApi 未用） |
| 建议负责人 | **高级前端**（index.tsx 714 行 + echarts 迁移 + bookStatus 逻辑需有经验者）；Tab 组件与 asset-transaction 子模块可中级 |

## 5. 迁移后目标文件清单

```text
libs/modules/pledge/
├── data-access/
│   └── src/lib/
│       ├── pledge.model.ts                 # 类型：列表项/查询参数/详情/表单值/资产类别/交易/操作记录
│       ├── pledge.api.ts                   # 全部 18 个 API 函数（含 listPage 的 bookStatus 透传参数）
│       └── +queries/
│           ├── pledge.keys.ts              # Query key 工厂
│           ├── pledge.queries.ts           # listPage / txSearches / assetDetail / operateRecordListPage / categoryList / assetList 查询
│           └── pledge.mutations.ts         # add / edit / editStatus / categoryAdd / txSave 写操作
├── feature/
│   └── src/lib/
│       ├── asset-transaction-list-page.tsx        # 子模块A：交易列表页
│       ├── asset-transaction-edit-page.tsx        # 子模块A：新建交易页
│       ├── reserve-asset-list-page.tsx            # 子模块B：储备资产列表页（含 Drawer）
│       ├── reserve-asset-detail-page.tsx          # 子模块B：详情页（new-view，3 Tabs 容器）
│       ├── reserve-asset-category-add-page.tsx    # 子模块B：新增资产类别页（asset-ategory）
│       ├── reserve-asset-drawer.tsx               # 子模块B：新增/编辑 Drawer（从 index 抽出，避免单文件过大）
│       ├── view-basic.tsx                         # 详情 Tab 组件：基本信息（含饼图）
│       ├── view-asset-transactions.tsx            # 详情 Tab 组件：资产交易
│       ├── view-operation-records.tsx             # 详情 Tab 组件：操作记录
│       └── module-manifest.ts                     # 菜单/路由/权限注册（含 group 机制）
├── ui/
│   └── src/lib/
│       ├── pledge-status-badge.tsx        # 状态 Tag/badge（统一 statusColorsBasic/AssetTxn/opStatus 映射）
│       └── pledge-asset-category-pie-chart.tsx    # recharts 饼图组件（替代 echarts）
└── util/
    └── src/lib/
        ├── pledge.constants.ts            # 状态枚举 + 色映射 + tokenType + operateType + 12 权限码 + bookStatus 推导 + BOOK_STATUS_PAGE_SIZE
        └── pledge.format.ts               # formatValue（银行卡4位分组）/ formatCurrency（Intl 兜底）/ 小数位校验
```

**子模块变体（group 机制，⚠️ 关键）**：pledge 含 `asset-transaction`（交易）与 `reserve-asset-list`（储备资产）两个子模块，同一 `libs/modules/pledge/` 库下 feature 层用文件名前缀区分（`asset-transaction-*` / `reserve-asset-*`），data-access/ui/util 共用。**因两个子模块需在菜单挂成 group**（`/pledge/asset-transaction` 与 `/pledge/reserve-asset-list`），必须按 target-arch §1.4 group 机制实现：

1. `page.tsx` 的 `GROUP_ENABLED_KEY` 加 `pledge: 'pledge'`（模块名自身作 enabledKey）。
2. registry：**group 容器 `pledge` 不进 registry**；每个子模块各自一个 entry（manifest id=`asset-transaction` / `reserve-asset-list`），pages 用**通用 key**（`list`/`detail`/`create`/`edit`），**禁止** `asset-transaction-list` 等具体 key。
3. 菜单 configs：group children path `/pledge/asset-transaction`、`/pledge/reserve-asset-list`。
4. 路由解析：`/pledge/<child>` → `realModule=<child>` → `loadModulePage('<child>', '<pageKey>')`。详情页走 `[[...slug]]` 的 detail 分支，但 reserve-asset-list 详情有 3 种入口（列表 Details、Popconfirm、asset-ategory 提交后返回），统一映射到 detail pageKey。

**详情页路由注意**：new-view 是详情页（query.id=reserveAccountId），asset-ategory 是独立创建页，asset-transaction/edit 是创建页（query.type=asset + reserveAccountId 预填）。manifest 需为 reserve-asset-list 配 `list`+`detail`+`create`（asset-ategory）；为 asset-transaction 配 `list`+`create`（edit）。

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable`（含 customFetch） | `DataTable` + TanStack Query + `react-hook-form`（**customFetch 的 bookStatus 前端过滤逻辑移到 query 的 select 或页面层**） |
| `Form` / `Form.Item` / `Form.useForm` / `Form.List` | `react-hook-form` + `useFieldArray`（asset-ategory 的多条资产类别）+ `FormField` |
| `Input` / `Input.TextArea` / `InputNumber` | `@myorg/shared/ui` Input / NumberInput |
| `Select` / `Radio.Group` / `Checkbox.Group` | `@myorg/shared/ui` Select / RadioGroup / CheckboxGroup |
| `DatePicker` / `RangePicker` | `FormDatePicker` / 自定义 RangePicker |
| `Button` / `Tag` | `@myorg/shared/ui` Button / Badge（Tailwind） |
| `Drawer` / `Popconfirm` | `@myorg/shared/ui` Drawer / Dialog（Popconfirm 行为可用 Dialog 或保留 antd） |
| `Table`（静态，详情 Tab） | `@myorg/shared/ui` DataTable |
| `Tabs` / `Carousel` / `Card` / `Image` | antd 同名组件（admin-platform 仍用 antd）或等价组件 |
| `loadEcharts`（饼图） | **recharts `PieChart`**（`libs/shared/ui-charts` 目前空壳，直接在 ui 层用 recharts） |
| `Typography.Paragraph` copyable | CopyableEllipsisText 或带 copy 的 Typography |
| `useHook(['ns'])` + `t('key')` | i18n hook + `modules.pledge` 命名空间 |
| `getServerSidePropsResult` + `serverSideTranslations` | 客户端 i18n（目标 CSR/SPA，无需 SSP） |

### 状态枚举 / 色映射（完整搬运到 `util/pledge.constants.ts`）

> 来源：`extract-module-meta.sh` STATUS_ENUMS + 源码逐文件核对完整键值。**合并规则**：键值完全相同的合并；不同的分常量。

```ts
// 1. 交易方向（asset-transaction/index.tsx 筛选 options + edit.tsx Radio）
//    index 筛选用数字：0=All,1=Inflow,2=Outflow,3=Refund
export const TRANSACTION_DIRECTION_FILTER = [
  { label: 'All', value: 0 },
  { label: 'Inflow', value: 1 },
  { label: 'Outflow', value: 2 },
  { label: 'Refund', value: 3 },
];
//    edit.tsx Radio 用字符串：'Inflow' | 'Outflow'（提交时 Inflow→1, Outflow→2）
export const TRANSACTION_TYPE_OPTIONS = [
  { label: 'Inflow', value: 'Inflow' },
  { label: 'Outflow', value: 'Outflow' },
];

// 2. bookStatus（reserve-asset-list/index.tsx）—— 前端推导的伪状态
export type BookStatusValue = 'not_setup' | 'configured';
export const getBookStatus = (financeBookId?: number | string): BookStatusValue =>
  financeBookId ? 'configured' : 'not_setup';
export const BOOK_STATUS_PAGE_SIZE = 1000; // 全量拉取过滤用
export const BOOK_STATUS_OPTIONS = [
  { label: 'All', value: '' },          // ⚠️ 迁移后 ALL_VALUE 改 'all'
  { label: 'reserve_asset_book_status_not_setup', value: 'not_setup' },
  { label: 'reserve_asset_book_status_configured', value: 'configured' },
];

// 3. 储备资产状态色（new-view.tsx statusColorsBasic，传给 view-basic）
//    + index.tsx 筛选 status options（值字符串）+ view-basic statusText
export const RESERVE_STATUS_COLOR = { 10: 'processing', 15: 'error', 20: 'success', 50: 'gray' };
export const RESERVE_STATUS_TEXT   = { 10: 'Processing', 15: 'Rejected', 20: 'Active', 50: 'Inactive' };
export const RESERVE_STATUS_FILTER = [
  { label: 'All', value: '' },
  { value: '10', label: 'pledge_status_10' },
  { value: '15', label: 'pledge_status_15' },
  { value: '20', label: 'pledge_status_20' },
  { value: '50', label: 'pledge_status_50' },
];
//    index.tsx 行状态 Tag：color 走 i18n 动态 key `pledge_status_color_${status}`，文案 `pledge_status_${status}`

// 4. 储备资产交易状态色（new-view.tsx statusColorsAssetTxn，传给 view-asset-transactions）
export const ASSET_TXN_STATUS_COLOR = { 5: 'orange', 10: 'orange', 15: 'error', 35: 'success' };
export const ASSET_TXN_STATUS_TEXT   = { 5: 'Pending Approval', 10: 'Under Approval', 15: 'Rejected', 35: 'Approved' };
//    asset-transaction/index.tsx 列表筛选 status options 同此（0=All,5,10,15,35）

// 5. 操作记录状态色（new-view.tsx opStatusColors 数组 ['warning','success','error']）
//    ⚠️ view-operation-records.tsx 实际用的是内嵌 statusDict（非 opStatusColors 数组）：
export const OP_RECORD_STATUS = {
  5:  { label: 'Pending Approval', color: 'orange' },
  10: { label: 'Under Approval',   color: 'orange' },
  15: { label: 'Rejected',         color: 'error' },
  20: { label: 'Approved',         color: 'success' },
};
//    （new-view 传入的 opStatusColors 数组与实际 statusDict 键不一致，是死参数，迁移时以 view-operation-records 内嵌 statusDict 为准）

// 6. tokenType（view-basic.tsx）
export const TOKEN_TYPE_TEXT = { 1: 'Stablecoin', 5: 'Tokenized Deposit' };

// 7. 操作类型（view-operation-records.tsx operateTypeOptions）
export const OPERATE_TYPE_OPTIONS = [
  { label: 'All', value: 0 },
  { label: 'Add', value: 1 },
  { label: 'Edit', value: 2 },
  { label: 'Activate', value: 3 },
  { label: 'Deactivate', value: 4 },
  { label: 'Add Asset Category', value: 5 },
];
//    提交时：value===0 转空串 ''（不传后端）

// 8. 行操作状态机（reserve-asset-list/index.tsx actions 分支）
//    status 10/15 → [Details]
//    status 20   → [AddAssetCategory, Edit, Deactivate(confimStr), Details, NewTransaction]
//    status 50   → [AddAssetCategory, Edit, Activate(confimStr), Details, NewTransaction]

// 权限码（12 个，LIMIT_PERMISSIONS，进 constants.ts，挂到对应按钮 limit）
export const PLEDGE_PERMISSIONS = {
  reserveAssetAdd:              '0420ca87bee54b22b52e6de7f1fe47d2', // 列表 Add 按钮
  newTransaction:               '279dda9e222c41999cdf40f4abfb95b3', // 交易列表 New
  importTransactions:           '9ff729760d214aeca8031ece0c2abfe3', // 交易列表 Import
  adjustment:                   '30164ccf62fc40e48f39ea0f2bb45780', // 交易列表 Adjustment（disabled）
  txnDetails:                   '2b20163b55494e8f8c69b900f8fec099', // 交易行 Details
  newTransactionRow:            '37385ae8b9e34ef08b27c8b12da04092', // 储备资产行 NewTransaction
  reserveAssetEdit:             '70d0a3630da2406d8e73408823904483', // 储备资产行 Edit
  activate:                     '2dbae32431464e5eb9e411c72758803a', // 储备资产行 Activate
  deactivate:                   'a9cdbde98d2f45b2bd35e750b73bacbf', // 储备资产行 Deactivate
  reserveAssetDetails:          'd417248e488d4da5ae8fa43434319a6f', // 储备资产行 Details
  addAssetCategory:             'ea7dcfcfbd174b4386fef85c6773d225', // 储备资产行 AddAssetCategory
  txnDrawerDetail:              'd35de3e80ee440f5ac720baee7d45ae9', // view.tsx（死代码）Drawer Detail —— 不迁移
} as const;
```

> **合并说明**：RESERVE_STATUS 与 ASSET_TXN_STATUS 键值不同（10/15/20/50 vs 5/10/15/35），分两个常量。OP_RECORD_STATUS 的 20=Approved/success 与 ASSET_TXN 的 35=Approved/success 不同，独立。statusText（view-basic `10:Processing...`）与 statusText（view-asset-transactions `5:Pending...`）键值不同，并入各自 STATUS_TEXT。

## 7. 迁移步骤

> 每步对应一个可独立开发的 loop 任务。按子模块分组 + 模型分配（scaffold→haiku，页面→sonnet，推理/验收→opus）。

1. **scaffold（haiku）**：用 Nx generator 建 `pledge` 四层库（data-access/feature/ui/util）；在 `apps/admin/tsconfig.json` paths 登记模块路径（防 nx lazy 误报，参考 sys 踩坑）；在 `module-registry.ts` 注册两个子模块 entry（`asset-transaction` + `reserve-asset-list`，**通用 key**）；`page.tsx` 的 `GROUP_ENABLED_KEY` 加 `pledge`；菜单 configs 配 group（children `/pledge/asset-transaction`、`/pledge/reserve-asset-list`）；i18n 新增 `modules/pledge.json`。
2. **constants + format（haiku）**：实现 `util/pledge.constants.ts`（第 6 章全部枚举 + 12 权限码 + getBookStatus + BOOK_STATUS_PAGE_SIZE）、`util/pledge.format.ts`（formatValue/formatCurrency/小数位）。
3. **model + api + queries（haiku）**：`pledge.model.ts` 全类型；`pledge.api.ts` 18 个函数（listPage 的 customFetch bookStatus 逻辑暂放页面层，api 只透传 bookStatus 到 data）；keys/queries/mutations。
4. **reserve-asset-list-page（sonnet，高级把关）**：实现列表页——react-hook-form 筛选（含 bookStatus）+ DataTable + **bookStatus 前端过滤逻辑**（query select 层：传 bookStatus 时拉 pageSize=1000 全量→filter→重算分页切片与 total，不传时正常分页）+ 状态机行操作（4 态分支）+ Popconfirm 资产类别预览跳详情 + bookStatus 列跳 `/financial/chart-of-accounts/view`。
5. **reserve-asset-drawer（sonnet）**：从 index 抽出新增/编辑 Drawer（type 分支、Checkbox.Group vs Cash Input、name→id 映射），调 add/edit mutation。
6. **reserve-asset-detail-page + 3 Tab 组件（sonnet）**：实现 new-view 容器（3 Tabs）+ view-asset-transactions + view-operation-records（含跳 `/approval-manage/view`）。
7. **view-basic + 饼图迁移（sonnet，高级把关）**：实现 view-basic（3 卡片 + Summary 表 + Tokens Overview Carousel）+ **echarts 饼图迁移到 recharts**（数据源 categorieList 的 proportion/assetTypeName，PieChart 替代 loadEcharts；含 resize/dispose 处理）。
8. **reserve-asset-category-add-page（sonnet）**：实现新增资产类别页（useFieldArray 多条 + 校验 + categoryAdd mutation + 提交后返回列表）。
9. **asset-transaction-list-page（sonnet）**：实现交易列表页（筛选 + 表格 + 行 Details 跳 `/approval-manage/view` + New 跳 create + Import/Adjustment 占位）。
10. **asset-transaction-edit-page（sonnet）**：实现新建交易页（储备资产 Select 联动货币+类别 + Radio + 小数位校验 + txSave mutation + query.type=asset 预填 reserveAccountId）。
11. **i18n + 权限挂载 + 单测（sonnet/haiku）**：补全 pledge namespace 文案（注意无双重前缀、ICU `{}`）；权限码挂到按钮；单测覆盖 bookStatus 过滤、状态机、name→id 映射。
12. **lint/test/build（haiku 触发，opus 验收）**：`pnpm nx lint pledge` / `test` / `build` 通过。

## 8. 风险与注意事项

### 源码歧义点（阶段二校验聚焦）

1. **view.tsx（520 行）= 死代码**：无任何路由引用（index 的 Popconfirm/Details/View 全跳 `new-view`），独占 `reserve/manage/list`、`reserve/manage/detail`、`accountOverview`、`tokensOverview` 4 个 endpoint。**不迁移**，但这 4 个 endpoint 是否在 new-view 复用需确认——new-view 实际只调 `reserve/asset/detail`（accountOverview/tokensOverview 的调用在 new-view 被注释）。迁移率分母按"在用文件"算时，view.tsx 计入但不实现。
2. **edit.tsx（276 行）疑为废弃**：reserve-asset-list/index 的 NewTransaction 行操作跳 `asset-transaction/edit`（新版），不跳本页（本页无路由入口）。阶段二需 grep 全仓 `/pledge/reserve-asset-list/edit` 引用确认；若确认死代码则不迁移，其独占的 `reserve/manage/detail`（getReserveManageDetailApi 在新版 edit.tsx 也有 import 但编辑态为半成品）需重新评估。
3. **`reserve/asset/manage/tx/save` 有两个封装**：`reserveAssetManageTxSaveApi`（typings）与 `reserveNewTransactionApi`（pledge.ts），同 endpoint 不同参数结构（新版传 assetTypeId/transactionAmount/transactionDirection/unit；旧版传 correspondentBank/counterparty 等银行字段）。迁移时 api 层合一，参数以新版为准。
4. **stablecoinInfoApi（pledge.ts 定义）页面未使用**——死代码，不迁移。
5. **new-view 传入 view-operation-records 的 `opStatusColors`（['warning','success','error'] 数组）是死参数**：view-operation-records 实际用内嵌 statusDict（5/10/15/20），未用入参。迁移时忽略入参，以 statusDict 为准。
6. **`reserve/manage/list`（view.tsx 列表 url）与 `reserve/asset/list`（typings reserveAssetListApi）不同**：前者是交易列表（死代码用），后者是资产下拉（新版 edit 用）。勿混淆。
7. **asset-transaction/edit.tsx 编辑态半成品**：import 了 getReserveManageDetailApi 且有 `if (query.id)` 分支，但该页路由上只作新建（index 的 New 跳无 id；NewTransaction 行操作跳带 type=asset 无 id）。编辑态 form.setFieldsValue 的字段（reserveAssetName/currency/assetCategory/transactionType/quantity/assetValue）与提交参数（assetTypeId/transactionAmount/transactionDirection/unit）字段名不一致，回填逻辑疑似未完成。迁移以新建态为准，编辑态不实现。
8. **reserveEditAccountApi / reserveEditTransactionApi 死代码（阶段二 grep 确认）**：pledge.ts:49/86 分别封装 `reserve/manage/updateReserveAccount` 与 `reserve/manage/updateTransaction`，但 pages/pledge 未 import、全仓 src 无任何调用。与 `reserve/asset/edit`（typings 的 reserveAssetEditApi）是不同 endpoint。**不迁移**，已补入第 3.3 章死代码行与第 9 章验收清单（死代码 4→7）。
9. **index.tsx 内联 newTransaction Drawer 与 NewTransaction 跳页并存**（grep line 64/378/476-478 发现）：index.tsx 有 `useState(false)` 的 newTransaction state + setNewTransaction(true/false)（line 378/589/607/618/688），疑为内联交易创建 Drawer；同时 `case 'NewTransaction'`（line 476-478）又跳 `/pledge/asset-transaction/edit` 页面。两者并存可能是 Drawer 死代码或 Adjustment 入口。阶段四开发 reserve-asset-list-page 时须厘清：若 newTransaction Drawer 无渲染入口则按死代码忽略，仅保留 NewTransaction 跳页。

### 运行时坑清单（target-arch §1.5，阶段四 grep 拦截 + 阶段五冒烟）

- **ALL_VALUE 非空（`'all'` 非 `''`）**：源码多处 `{ label: 'All', value: '' }`（bookStatus/currency/category/操作类型），迁移到手写 SelectItem 必须改 `'all'`，否则 `Runtime Error: Select.Item must have value not empty`。FormSelect 组件级已过滤空 value，但"全部"会被静默丢弃——故 `ALL_VALUE='all'` 从源头非空，筛选判断 `!== ALL_VALUE`。
- **i18n key 无双重 `pledge.` 前缀**：页面已 `useTranslations('modules.pledge')`，constants 的 labelKey 用相对 key（如 `reserve_asset_book_status_configured`，非 `pledge.reserve_asset_...`），否则 `MISSING_MESSAGE`。
- **ICU `{{}}` → `{}`**：从老 i18next 抄 message 时双花括号转单花括号（本模块文案多为静态字符串，动态插值少，但 confimStr 含 `{accountName}` 需注意）。
- **list 请求体含 `pageNum`**：listPage 与 tx/searches/operateRecordListPage 走后端分页，必须 `pageNum`（customFetch 已显式写，迁移勿改成 `page`）。
- **下拉过滤空 id 与 null**：category/list 后端可能返回非数组/空 assetCategoryName 项，options 构建前 `.filter(name => name.length > 0)`（view-asset-transactions 已有此逻辑，其他页迁移时补齐）；bankList/currencyList 需判空。
- **bookStatus 前端过滤的正确性**：pageSize=1000 全量拉取依赖后端单次返回足够，若数据量超 1000 会漏数据——这是源码既有限制，迁移保持一致但第 8 章标注。

### 跨模块跳转（CROSS_MODULE_ROUTES，迁移依赖）

- `/approval-manage/view`（asset-transaction/index 行 Details、view-operation-records 行 Details）——**approval-manage 模块本批未迁移**（cross-chain 经验：该路由在目标项目可能尚未落地），跳转需确认目标应用是否注册此路由，否则 404。传参：`{ busCode, id }`（交易）/ `{ busCode, opType, id }`（操作记录）。
- `/financial/chart-of-accounts/view`（reserve-asset-list/index bookStatus 列 configured 态外链）——**chart-of-accounts 已迁移完成**（见 memory），传参 `{ financeBookId, tab: 'basic-information' }`，目标路由应已存在，但 group/tab 参数格式需对齐目标 manifest。
- 模块内跳转：`/pledge/asset-transaction/edit`、`/pledge/reserve-asset-list/new-view`、`/pledge/reserve-asset-list/asset-ategory`、`/pledge/reserve-asset-list`、`/pledge/asset-transaction`——迁移后路径在 group 机制下变为 `/pledge/<child>/<pageKey>`，需在 manifest 映射（new-view→detail、asset-ategory→create、edit→create）。

### 其他风险

- **echarts→recharts 视觉对齐**：源码饼图有 8 色预定义数组 + emphasis shadow，recharts 需手动配 `fill`/`activeShape`，视觉可能有差异，非阻塞但需冒烟确认。
- **714 行单文件**：index.tsx 含列表+Drawer+状态机，迁移时按第 5 章抽出 `reserve-asset-drawer.tsx`，避免单文件过大触发 nx lazy 误报（参考 journal-entries 踩坑）。
- **Carousel/Popconfirm/Checkbox.Group**：admin-platform 若无等价组件，保留 antd（目标项目仍依赖 antd）。

## 9. 验收标准

- **可跑**：`pnpm nx lint pledge` / `pnpm nx test pledge` / `pnpm nx build pledge`（含 admin app build）全部通过；模块路径已在 `apps/admin/tsconfig.json` paths 登记。
- **可见（运行时冒烟，逐页打开控制台无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE）**：
  - 储备资产列表页：筛选（资产名/币种/bookStatus/创建时间/状态）全部生效；**bookStatus 筛选正确触发全量拉取+前端过滤+分页**；状态 Tag 颜色与源码一致（pledge_status_color_*）；行操作按状态机正确显示（10/15 仅 Details；20 含 Deactivate；50 含 Activate）；Popconfirm 资产类别预览有数据、More 跳详情；bookStatus 列 configured 态外链跳 chart-of-accounts。
  - 储备资产列表 Drawer：新增（默认 Cash）+ 编辑（Checkbox.Group + name→id 映射）提交成功并刷新列表。
  - 新增资产类别页：Form.List 多条增删 + 校验 + 提交返回列表。
  - 详情页（new-view）：3 Tabs 切换正常；Basic Information 饼图渲染（recharts，resize 正常）；Asset Transactions 筛选+分页；Operation Records 筛选（操作类型）+分页+行 Details 跳 approval-manage。
  - 交易列表页：筛选生效；行 Details 跳 approval-manage；New 跳新建页。
  - 新建交易页：储备资产 Select 联动货币+资产类别；提交成功返回列表。
- **可对照（与源码逐项）**：
  - 20 个 unique endpoint（脚本 18 + typings 引入 2）全部有交代：在用 endpoint 全部对接（method/参数/返回字段一致）；**死代码 7 个不迁移**：view.tsx 独占 4 个（manage/list、manage/detail、accountOverview、tokensOverview）+ stablecoinInfoApi + updateReserveAccount（reserveEditAccountApi）+ updateTransaction（reserveEditTransactionApi），后两个经阶段二全仓 grep 确认无调用。
  - 状态枚举/色映射与源码完全一致（第 6 章 8 组常量）。
  - 12 个权限码挂到对应按钮。
  - 跨模块跳转 2 处（approval-manage/view、financial/chart-of-accounts/view）参数正确。
  - i18n 全部文案 pledge namespace 化（无双重前缀、ICU 语法）。
- **分页字段**：所有列表请求体用 `pageNum`（非 `page`）。
