# blockchain 模块迁移计划

## 1. 业务概述

blockchain 模块管理区块链基础设施三类业务实体：**节点（Node）**、**合约部署记录（Contract Deployment）**、**智能合约包（Smart Contract Package）**。主要操作：节点管理支持「查询 / 新增 / 编辑 / 启用 / 禁用 / 删除」完整 CRUD（含删除二次确认 Modal，要求输入 URL 校验）；合约部署记录支持「查询列表 / 查看详情」（详情页内嵌静态子表格展示合约清单）；智能合约包支持「查询列表 / 下载（.xlsx blob 文件下载）」。页面构成：**3 个列表页（deployment / node / smart-contract）+ 1 个详情页（deployment/view）+ 1 个新增/编辑共用页（node/edit）**，共 5 页。特殊业务规则：① 节点新增/编辑页的「节点参数明细」为**动态字段表单**——根据 `blockchainId + nodeLocationId` 调 `params/search` 接口拉回 `nodeParamsDetail`（`paramKey`/`paramName`/`paramValue`），运行时 `map` 出 N 个 `Input` 表单项，提交时回扫 `values` 拼装 `nodeParamsDetail`；② 节点列表的启用/禁用/删除通过同一 `updateState` 接口（`state: 1/2/3` 区分），删除走 Modal + 输入校验；③ smart-contract 下载为 **blob 响应 + 前端 `URL.createObjectURL` 触发 `<a>` 点击**，文件名从 `content-disposition` 解析（`utf-8''` 前缀分割）；④ 状态/类型文案大量走 i18n key 动态拼接（`token_type_${n}` / `type_${n}` / `node_status_${n}` / `common_task_status_color_${n}` / `contractName_${n}`），非静态对象字面量。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/blockchain/deployment/index.tsx` | 193 | 合约部署列表页：筛选表单（稳定币 / tokenType / 链 / 包名 / 类型 / 部署时间）+ 表格 + 行「查看」跳详情，调用 deployment/listPage + stablecoin + blockchain 下拉 |
| `src/pages/blockchain/deployment/view.tsx` | 114 | 合约部署详情页：标题区（tdName + 包名/版本/部署时间）+ 内嵌静态 `Table`（合约清单 detailList，无分页），调用 deployment/details |
| `src/pages/blockchain/node/index.tsx` | 336 | 节点列表页：筛选表单（链 / 节点位置 / 创建时间 / 状态）+ 表格 + 顶部「新增」按钮 + 行操作「编辑 / 禁用 / 启用 / 删除」+ 删除确认 Modal（输入 URL 校验），调用 node/manage/list + updateState + blockchain + nodeLocation 下拉 |
| `src/pages/blockchain/node/edit.tsx` | 240 | 节点新增/编辑共用页（按 `query.blockchainId` 区分）：链 / 节点位置两个 Select 触发 `params/search` 拉动态字段 → `map` 出 N 个 Input 表单项 + browserUrl（URL 正则校验）+ 提交调 save/edit，调用 node/manage 下 add/edit/detial/add/params/search |
| `src/pages/blockchain/smart-contract/index.tsx` | 163 | 智能合约列表页：筛选表单（包名 / 创建时间）+ 表格 + 顶部「新增」按钮（仅带 Tooltip 提示，无跳转）+ 行操作「下载」（blob 文件下载），调用 contract/manage/list + sftp/download |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段（5 文件 / 1046 行）。「用途」由 Agent 读源码判断。注意：实际写操作 / 下载 API 封装在 `src/lib/api/node.ts` 与 `src/lib/api/common.ts`，脚本「api 模块封装」组列出了**整组导出**（含本模块未使用的 bank/list、resources/search 等），实际被本模块引用的见第 3 章（按页面真实 import 裁剪）。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面内字面量 7 个 + api 模块封装 11 个）+ 源码补充。**脚本通过 import 解析把 `common.ts` / `node.ts` 整组导出都列进了「api 模块封装」组，但本模块实际只引用了其中一部分**。经逐文件核对（`import { detailApi, editApi, paramsSearchApi, saveApi } from '@/lib/api/node'` + `import { updateStateApi } from '@/lib/api/node'` + `import { downloadApi } from '@/lib/api/common'`），实际被引用的 api 模块函数共 **7 个**，加页面字面量 7 个 + hook 内 1 个 = **实际 15 个 endpoint**（其中 1 个下载为动态拼接 URL，脚本未抓全）。common.ts 其余 5 个导出（bank/list、resources/search、wallet/keystore、password/modify、accessKey/get）**本模块未使用，不迁移**。

### 3.1 列表 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/contract/deployment/listPage` | POST | `deployment/index.tsx` 的 `useCustomTable.url` | 合约部署记录分页列表查询 |
| `/api/manage/v1/node/manage/list` | POST | `node/index.tsx` 的 `useCustomTable.url` | 节点管理分页列表查询 |
| `/api/manage/v1/contract/manage/list` | POST | `smart-contract/index.tsx` 的 `useCustomTable.url` | 智能合约包分页列表查询 |

> **分页字段注意（硬约束 #5）**：三个列表接口均通过 `useCustomTable`（CustomTable）走 RBAC/sys 域后端约定，分页请求体字段是 `pageNum` / `pageSize`（非 PaginationParams 的 `page`）。迁移时若复用 admin-platform 的 `DataTable` + TanStack Query，**api 层必须确保请求体用 `pageNum`**（或在 api 层经 `getRbacPaginated` 把 `page→pageNum` 映射），否则数据不显示（sys 模块曾踩此坑）。

### 3.2 详情 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/contract/deployment/details` | POST | `deployment/view.tsx` 的 `useSWR`（参数 `{ recordId }`） | 合约部署详情页获取单条记录（含 `detailList` 合约清单） |
| `/api/manage/v1/node/manage/detial` | POST | `node/edit.tsx` 的 `detailApi`（参数 `{ blockchainId, nodeLocationId }`） | 节点编辑页回填表单（含 `nodeParamsDetail` 动态字段、`browserUrl`）。**注意源码拼写为 `detial`（typo），迁移时 endpoint 保持原样以免后端不匹配** |

### 3.3 写操作 API（新增 / 编辑 / 启停 / 删除 / 下载）

> 来源：`@/lib/api/node.ts`（updateState/paramsSearch/save/edit/detail 共 5 个）+ `@/lib/api/common.ts`（download 1 个）。均封装在 api 模块，脚本「api 模块封装」组已抓到。涉及文件下载：是（downloadApi）。

| 函数（源） | Endpoint | Method | 调用方 | 触发场景 |
|-----------|----------|--------|--------|----------|
| `updateStateApi` | `/api/manage/v1/node/manage/updateState` | POST | `node/index.tsx` 行操作「禁用(state:2)/启用(state:1)」+ 删除 Modal 确认「删除(state:3)」 | 启停直接调；删除在 Modal 内 `onFinish` 调，成功后 `message.success` + 关闭 + 由 useCustomTable 内部刷新 |
| `saveApi` | `/api/manage/v1/node/manage/add` | POST | `node/edit.tsx` 的 `onFinish`（无 query 参数时） | 新增节点，成功后 `message.success` → 1s 后 `routerPush('/blockchain/node')` |
| `editApi` | `/api/manage/v1/node/manage/edit` | POST | `node/edit.tsx` 的 `onFinish`（有 query 参数时） | 编辑节点，成功后跳回列表 |
| `paramsSearchApi` | `/api/manage/v1/node/manage/add/params/search` | POST | `node/edit.tsx` 的 `getNodeParamsDetail` | 按 `blockchainId + nodeLocationId` 拉节点参数明细（`nodeParamsDetail`），用于动态渲染表单字段 |
| `detailApi` | `/api/manage/v1/node/manage/detial` | POST | `node/edit.tsx` 的 `useEffect` | 编辑页回填（同 3.2，双用途） |
| `downloadApi` | `${NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=&busType=`（**动态拼接 URL，脚本未抓全**） | GET（`responseType:'blob'`） | `smart-contract/index.tsx` 行操作「下载」 | 下载智能合约包 .xlsx，前端从 `content-disposition` 的 `utf-8''` 解析文件名，`Blob` + `createObjectURL` + `<a>` 点击触发，成功 `message.success` |

> **脚本遗漏（硬约束 #2，第 8 章复述）**：`downloadApi` 的真实 URL 是 `${process.env.NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=${busId}&busType=${busType}`，模板字符串拼接，脚本静态扫描只抓到 `common.ts` 内字面量片段（误报为 `/api/manage/v1/common/resources/search` 等），实际下载 endpoint **不在脚本输出列表里**。迁移时 `blockchain.api.ts` 必须实现 `downloadSmartContract(busId, busType)` 并设置 `responseType: 'blob'`，文件名解析逻辑需完整搬运。

### 3.4 公共下拉数据源

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/blockchain/list` | POST（useSWR） | `deployment/index.tsx`、`node/index.tsx`、`node/edit.tsx` | 「链（Blockchain）」下拉，`{ key, value, status, browserUrl }`；`status===1` 可选，否则 disabled（node/edit 还取 `browserUrl` 预填） |
| `/api/manage/v1/common/nodeLocation/list` | POST（useSWR） | `node/index.tsx`、`node/edit.tsx` | 「节点位置（Node Location）」下拉，`{ key, value }` |
| `/api/manage/v1/common/stablecoin/enabled/searches` | POST（useSWR） | `deployment/index.tsx` | 「稳定币（Token）」下拉，`{ stablecoinId, name }` |
| `/api/manage/v1/common/tokenType/list` | GET（useSWR，封装在 `useTokenTypeOptions` hook） | `deployment/index.tsx`（经 hook） | 「TokenType」下拉，`{ tokenTypeId, tokenTypeName, status }`，`status===0` disabled |

### 3.5 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `CustomTableTitle` / `CustomModal` / `useHook`（来自 `libs/components`）
- `CustomCopy`（来自 `libs/components/CustomCopy`，节点列表 URL 列复制）
- `formatTimestamp` / `getServerSidePropsResult`（来自 `libs/utils`）
- `useTokenTypeOptions`（来自 `@/lib/hooks/useTokenTypeOptions`，封装 tokenType 下拉）
- `request`（来自 `lib/api/axios`，封装 `@/lib/api/node.ts` 与 `common.ts`）
- `QuestionMarkCircleIcon`（`@heroicons/react/24/solid`，smart-contract 新增按钮 Tooltip 图标）
- `useSWR`（swr，下拉 / 详情数据获取）
- `types/models` 的 `ResultInfo`（列表分页响应类型）
- i18n 命名空间：`blockchain`（主），`common` / `router`（getServerSideProps）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中** |
| 困难分数 | 3/5 |
| 主要难点 | ① **5 页、3 子模块、15 个 endpoint**（含 1 个动态拼接的下载 URL、1 个拼写错误的 `detial`），规模中等；② **node/edit 的动态字段表单**：字段集合不固定，由 `paramsSearchApi` 返回的 `nodeParamsDetail` 运行时 `map` 出 N 个 `Input`，提交时需回扫 `values` 与 `filedArrObj` 按 `paramKey` 匹配拼装，且新增/编辑共用一个 `onFinish`（按 query 分支 save/edit），编辑态还要用 `detailApi` 回填——这是本模块最复杂的一页；③ **node/index 的删除 Modal**：要求用户输入完整 URL 字符串与 `modalInfo.url` 严格相等才通过校验，迁移到 react-hook-form 需用自定义 validator；④ smart-contract 下载为 **blob + 文件名解析 + `<a>` 触发**，非普通 JSON 调用，api 层需特殊处理 `responseType`；⑤ 状态/类型文案大量走 **i18n key 动态拼接**（`token_type_${n}` / `type_${n}` / `node_status_${n}` / `common_task_status_color_${n}` / `contractName_${n}`），无静态 STATUS_ENUMS 对象，迁移时需保留拼接模式或抽常量；⑥ deployment 列表/详情两处 status 列**写死 `success` + 固定文案**（只展示成功态，源码 `render: () => <Tag color={'success'}>{t('token_task_status_10')}</Tag>`），迁移时确认是否照搬写死。 |
| 建议负责人 | 中级前端（动态字段表单与 blob 下载是主要难点，但模式清晰、无嵌套 Form.List、无跨模块审批流） |

## 5. 迁移后目标文件清单

> 子模块处理：blockchain 含 **deployment（列表+详情）**、**node（列表+编辑）**、**smart-contract（列表）** 三个子模块。同一 `libs/modules/blockchain/` 库下用文件名前缀区分（deployment-*/node-*/smart-contract-*），**不拆成三个库**——共用 model/api/constants，避免重复。

```text
libs/modules/blockchain/
├── data-access/
│   └── src/lib/
│       ├── blockchain.model.ts                    # 类型：DeploymentRecordItem / DeploymentDetail / DeploymentContractRow / NodeItem / NodeParamsDetailField / NodeEditFormValues / SmartContractItem / 各列表查询参数 / 下载参数
│       ├── blockchain.api.ts                      # 15 个 API 函数（3 list + 2 detail + 5 node 写操作 + 1 下载 + 4 公共下拉），下载函数 blob 响应
│       └── +queries/
│           ├── blockchain.keys.ts                 # Query key 工厂
│           ├── blockchain.queries.ts              # 列表/详情/下拉查询 hooks
│           └── blockchain.mutations.ts            # node 写操作（save/edit/updateState）+ smart-contract 下载 mutation
├── feature/
│   └── src/lib/
│       ├── deployment-list-page.tsx               # 合约部署列表页
│       ├── deployment-detail-page.tsx             # 合约部署详情页（内嵌静态表格）
│       ├── node-list-page.tsx                     # 节点列表页（含删除 Modal）
│       ├── node-delete-modal.tsx                  # 删除确认 Modal（输入 URL 校验），从列表页拆出避免大文件
│       ├── node-edit-page.tsx                     # 节点新增/编辑共用页（动态字段表单）
│       ├── smart-contract-list-page.tsx           # 智能合约列表页（含下载）
│       └── module-manifest.ts                     # 菜单/路由/权限注册（5 路由 + 3 菜单项）
├── ui/
│   └── src/lib/
│       └── blockchain-status-badge.tsx            # 状态 Badge（node 状态走 i18n key 动态取色；deployment 写死 success）
└── util/
    └── src/lib/
        └── blockchain.constants.ts                # 状态/类型 i18n key 前缀常量 + 8 个 limit 权限码 + 节点 state 枚举(1/2/3)
```

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form`（3 处列表：deployment / node / smart-contract；**分页请求体用 `pageNum` 非 `page`**） |
| `CustomTableTitle`（表格标题 + 顶部按钮） | `DataTable` 工具栏 + `@myorg/shared/ui` Button |
| `CustomModal`（node 删除确认） | `@myorg/shared/ui` Dialog / Drawer |
| `Form` / `Form.Item` / `Form.useForm`（4 个 form：3 列表筛选 + node/edit + 删除 Modal） | `react-hook-form` + `useForm` + `FormField` / `FormSelect` |
| `Select` / `Input` | `@myorg/shared/ui` Select / Input |
| `DatePicker.RangePicker` | `FormDatePicker`（3 处：deployment 部署时间 / node 创建时间 / smart-contract 创建时间） |
| `Table`（deployment 详情静态子表格，无分页） | `@myorg/shared/ui` DataTable（静态数据模式，无服务端分页） |
| `CustomCopy`（node 列表 URL 列复制） | `@myorg/modules/<related>/ui` CopyableEllipsisText 或 `@myorg/shared/ui` Copy 组件 |
| `Tag`（状态色） | Tailwind badge / Badge 组件 |
| `Tooltip` + `QuestionMarkCircleIcon`（smart-contract 新增按钮提示） | `@myorg/shared/ui` Tooltip + lucide-react 同名图标 |
| `Button` / `message` | `@myorg/shared/ui` Button + Toast |
| `formatTimestamp` / `getServerSidePropsResult` | `@myorg/shared/util` 对应工具（迁移时确认目标库已有，否则补） |
| `useHook(['blockchain'])` + `t('key')` | i18n hook + `modules.blockchain` 命名空间 |
| 状态/类型 i18n key 动态拼接 | 保留拼接 + util/constants.ts 存 key 前缀（见 6.1） |

### 6.1 状态/枚举映射（完整搬运，写入 `util/blockchain.constants.ts`）

> 数据来源：`extract-module-meta.sh` 的 `STATUS_ENUMS` 段输出为「no obvious status/enum map」。经 Agent 逐文件读源码确认——本模块**无静态 `Record<status,color>` 对象字面量**，状态/类型文案与配色全部走 **i18n key 动态拼接**（与 mmf 的静态对象不同）。以下为源码中所有拼接点的完整记录，迁移时保留拼接模式并抽取 key 前缀常量。

**① node/index.tsx:96-98 — 节点状态筛选下拉（options，2 个状态）**

```ts
// node 列表筛选「状态」options（字符串 value）
export const NODE_STATUS_OPTIONS = [
  { value: '1', labelKey: 'blockchain.node_status_1' },
  { value: '2', labelKey: 'blockchain.node_status_2' }
];
```

**② node/index.tsx:144-152 — 节点列表行状态 Tag（动态 i18n key 取色 + 取文案）**

源码：
```tsx
<Tag color={t(`common_task_status_color_${status}`)}>
  {t(`node_status_${status}`)}
</Tag>
```
迁移策略：**保留 i18n key 动态拼接**（色值走 `common_task_status_color_${status}`，文案走 `node_status_${status}`），与 settlement 审批记录同模式。在 constants 抽前缀：

```ts
export const NODE_STATUS_COLOR_KEY_PREFIX = 'blockchain.common_task_status_color_';
export const NODE_STATUS_LABEL_KEY_PREFIX = 'blockchain.node_status_';
// status 取值：1（正常/启用）、2（禁用）；color key 复用 common 全局约定，确认目标 i18n 已有
```

**③ node/index.tsx:182-194 — Disable/Enable 按钮 disabled 逻辑 + 确认文案（含占位符替换）**

源码用 `t('blockchain_0021').replace('****', t('blockchain_0035'/'0036')).replace('{type}', data.blockchainName)` 做模板替换。迁移时注意 i18n 框架若支持插值（如 `t(key, { type, action })`）应改用框架插值，否则保留 `replace`（标注意义）。

**④ deployment/index.tsx:147-152 + deployment/view.tsx:83-88 — 部署状态写死 success**

源码两处均为：
```tsx
<Tag color={'success'}>{t('token_task_status_10')}</Tag>
```
> **写死单态**（不论实际 status 值，永远显示 success 色 + `token_task_status_10` 文案）。迁移时**照搬写死**，但在第 8 章标注（可能是源码遗留，详情/列表只展示成功部署记录）。

**⑤ deployment/index.tsx:91-99 + smart-contract/index.tsx:70 — 类型 type 枚举（1/5）**

```ts
// deployment 筛选 options + 列表 render + smart-contract render 共用
// deployment: type ∈ {1, 5}；smart-contract: type===1 ? t('type_1') : t('type_5')
export const DEPLOYMENT_TYPE_OPTIONS = [
  { value: 1, labelKey: 'blockchain.type_1' },
  { value: 5, labelKey: 'blockchain.type_5' }
];
```

**⑥ deployment/index.tsx:118 + 132 — tokenType / type 列 i18n key 拼接**

```ts
// 列 render: t(`token_type_${Number(tokenType)}`) / t(`type_${Number(type)}`)
export const TOKEN_TYPE_LABEL_KEY_PREFIX = 'blockchain.token_type_';
export const DEPLOYMENT_TYPE_LABEL_KEY_PREFIX = 'blockchain.type_';
```

**⑦ deployment/view.tsx:50 — 合约名 i18n key 拼接**

```ts
// detailList 行 render: t(`contractName_${Number(contractName)}`)
export const CONTRACT_NAME_LABEL_KEY_PREFIX = 'blockchain.contractName_';
```

**⑧ node/index.tsx updateState 的 state 值（非 Tag，是接口入参语义）**

```ts
export const NODE_STATE = {
  ENABLE: 1,   // 启用
  DISABLE: 2,  // 禁用
  DELETE: 3    // 删除
} as const;
```

### 6.2 limit 权限码（按钮可见性，写入 constants.ts）

> 来源：脚本 `LIMIT_PERMISSIONS`（8 个）+ 源码逐一定位调用点。

```ts
export const BLOCKCHAIN_PERMISSIONS = {
  // node 子模块
  NODE_ADD_BTN:      '3b95cac8b3fd4df983ebe31ae3570351', // node 列表顶部「新增」按钮 → 跳 /blockchain/node/edit
  NODE_EDIT_BTN:     '1b97b11ad5574b979c4e1d6600972191', // node 列表行「编辑」→ 跳 /blockchain/node/edit?(blockchainId,nodeLocationId)
  NODE_DISABLE_BTN:  'be093898366f4beabeb412d581c3ecac', // node 列表行「禁用」(status===2 时 disabled)
  NODE_ENABLE_BTN:   'eea4afc3903640d19a0c3d8f9b1e4983', // node 列表行「启用」(status===1 时 disabled)
  NODE_DELETE_BTN:   '046da3258f3648caaf87957df830727f', // node 列表行「删除」→ 弹确认 Modal
  // smart-contract 子模块
  SC_ADD_BTN:        '9b11eb88799b4266a1b34100ec90db2c', // smart-contract 列表顶部「新增」按钮（仅 Tooltip，无跳转）
  SC_DOWNLOAD_BTN:   '2e25e8caeda242b4b4b70db7c7541bda', // smart-contract 列表行「下载」→ blob 下载
  // deployment 子模块
  DEPLOYMENT_VIEW_BTN: 'f90a33b77b1e4dd9bad371f14f217958' // deployment 列表行「查看」→ 跳 /blockchain/deployment/view?recordId=
};
```

## 7. 迁移步骤

1. **Nx generator 建 `blockchain` 库**（data-access / feature / ui / util 四层），在 `module-registry.ts` 注册；i18n 新增 `modules/blockchain.json`（命名空间 `modules.blockchain`，迁入 `blockchain` + 复用 `common`/`router` 的 key，含 `node_status_*` / `common_task_status_color_*` / `token_type_*` / `type_*` / `contractName_*` / `token_task_status_10` / `blockchain_*` 系列）；**在 `apps/admin/tsconfig.json` 的 paths 登记 blockchain 库路径**（防 nx 误报 lazy，见 memory sys-migration-status）。
2. **类型定义（`blockchain.model.ts`，haiku）**：`DeploymentRecordItem`、`DeploymentDetail`（含 `detailList: DeploymentContractRow[]`）、`DeploymentContractRow`、`NodeItem`、`NodeParamsDetailField`（`{ paramKey, paramName, paramValue }`）、`NodeEditFormValues`、`NodeSaveReqVO` / `NodeEditReqVO`、`SmartContractItem`、`BlockchainOption`（含 `browserUrl`）、`NodeLocationOption`、`StablecoinOption`、`TokenTypeOption`、各列表查询参数、`DownloadParams`（`{ busId, busType }`）。
3. **常量（`blockchain.constants.ts`，haiku）**：搬运 6.1 的 i18n key 前缀常量 + `NODE_STATUS_OPTIONS` + `DEPLOYMENT_TYPE_OPTIONS` + `NODE_STATE` + 6.2 的 8 个权限码（`BLOCKCHAIN_PERMISSIONS`）。
4. **API 函数（`blockchain.api.ts` + queries/keys，haiku）**：15 个 endpoint 函数（3 list + 2 detail 含拼写错误的 `detial` + 5 node 写操作 + 1 下载 + 4 公共下拉）+ Query key 工厂 + 列表/详情/下拉 TanStack Query hooks。**关键：① 三个 list 函数请求体用 `pageNum`/`pageSize`（非 `page`）；② 下载函数 `downloadSmartContract(busId, busType)` 用 `responseType:'blob'`，URL 为文件服务域名拼接；③ `getNodeParamsDetail` 返回 `nodeParamsDetail` 数组**。
5. **mutations（`blockchain.mutations.ts`，haiku）**：`useSaveNodeMutation` / `useEditNodeMutation` / `useUpdateNodeStateMutation`（启停删共用，传 `state`）/ `useDownloadSmartContractMutation`（成功后 invalidate smart-contract list）。
6. **deployment 列表页（`deployment-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（稳定币 Select / tokenType Select（经 useTokenTypeOptions hook 或迁移后的等价 hook）/ 链 Select（`status===1` 可选）/ 包名 Input / 类型 Select（1/5）/ 部署时间 RangePicker）+ `DataTable` + 行「查看」跳详情（带 `recordId`）。tokenType 列用 `token_type_${n}` 拼接文案，type 列用 `type_${n}`。状态列**写死 success**。
7. **deployment 详情页（`deployment-detail-page.tsx`，sonnet）**：标题区（tdName + 包名/版本/部署时间）+ 静态 `DataTable`（`detailList`，列：contractName（`contractName_${n}`）/ contractVersion / contractAddress（ellipsis）/ contractHash（ellipsis）/ blockchainName / ownerAddress（ellipsis）/ txHash（ellipsis）/ status（写死 success））。底部「返回」按钮。
8. **node 列表页（`node-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（链 Select（`status===1` 可选）/ 节点位置 Select / 创建时间 RangePicker / 状态 Select（1/2））+ `DataTable` + 顶部「新增」按钮跳 `/blockchain/node/edit` + 行操作「编辑（跳 edit 带 blockchainId+nodeLocationId）/ 禁用（status===2 disabled）/ 启用（status===1 disabled）/ 删除（弹 Modal）」。URL 列用 Copy 组件，browserUrl 列为外链 `<a target="_blank">`。状态列走 `common_task_status_color_${status}` + `node_status_${status}` 动态拼接。启停直接调 updateStateMutation，删除走 Modal。
9. **node 删除 Modal（`node-delete-modal.tsx`，sonnet）**：从列表页拆出。展示提示 + URL（`blockchain_0023` 插值）+ Input（自定义 validator：值必须严格等于 `modalInfo.url`）+ 取消/提交。提交调 updateStateMutation（`state:3`），成功 Toast + 关闭 + 刷新列表。
10. **node 编辑页（`node-edit-page.tsx`，sonnet，本模块最复杂）**：按 `query.blockchainId` 区分新增/编辑。两个 Select（链 / 节点位置，编辑态 disabled）`onChange` 触发 `paramsSearchApi` 拉 `nodeParamsDetail` → `map` 出 N 个动态 Input（`name=paramKey`，`label=paramName`，required）+ browserUrl Input（URL 正则校验）。编辑态 `useEffect` 调 `detailApi` 回填所有字段。`onFinish` 回扫 `values` 与 `filedArrObj` 按 `paramKey` 匹配拼装 `nodeParamsDetail`，按分支调 save/edit，成功后 1s 跳回 `/blockchain/node`。链 Select onChange 时预填 `browserUrl`。
11. **smart-contract 列表页（`smart-contract-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（包名 Input / 创建时间 RangePicker）+ `DataTable`（序号列 `index+1`）+ 顶部「新增」按钮（**仅 Tooltip 提示，无跳转/无 actionClick**，迁移时保留为带提示的 disabled/信息按钮）+ 行操作「下载」。下载调 `downloadSmartContract` mutation：blob → 解析 `content-disposition` 的 `utf-8''` 取文件名 → `createObjectURL` + `<a>` 点击 → 成功 Toast。
12. **单测 + `pnpm nx lint/test blockchain` + build**。重点覆盖：node/edit 动态字段拼装逻辑、删除 Modal URL 校验、下载 blob 文件名解析、`pageNum` 分页字段、8 个权限码可见性。

## 8. 风险与注意事项

- **脚本漏抓下载 endpoint 的真实 URL（高优，硬约束 #2）**：`downloadApi`（`common.ts`）的真实 URL 是模板字符串拼接 `${process.env.NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=${busId}&busType=${busType}`，脚本静态扫描抓不到，输出里把它误归为 `/api/manage/v1/common/resources/search` 等。**实际下载 endpoint 不在脚本列表**，迁移率校验若以脚本为准会漏。`blockchain.api.ts` 必须实现 `downloadSmartContract`，且文件服务域名（`NEXT_PUBLIC_FILE_ID`）需在目标项目配置对应环境变量。文件名解析（`content-disposition` 的 `utf-8''` 分割）与 `<a>` 触发逻辑需完整搬运。
- **api 模块整组导出的误报（硬约束 #2）**：脚本通过 import 解析把 `common.ts` / `node.ts` 整组导出都列入「api 模块封装」（11 个），但本模块实际只引用 `downloadApi` + node 的 5 个。`common.ts` 的 `bank/list`、`resources/search`、`tokenType/list`（独立函数，页面走 hook）、`wallet/keystore`、`password/modify`、`accessKey/get` **本模块均未使用，不迁移**（tokenType 经 `useTokenTypeOptions` hook 内部 useSWR 调用，已单列在 3.4）。迁移率分母应为 **15 个真实 endpoint**，不是脚本的 18 个。
- **分页字段 `pageNum` vs `page`（硬约束 #5）**：三个列表接口（deployment/node/smart-contract）走 RBAC/sys 域后端，请求体分页字段是 `pageNum`/`pageSize`。admin-platform 的 `PaginationParams` 若用 `page`，api 层必须映射（或在 api 函数内固定用 `pageNum`），否则列表数据不显示（sys 模块曾踩此坑）。文档第 3.1 / 步骤 4 已标注。
- **node/edit 动态字段表单（核心难点）**：字段集合由接口返回，运行时 `map`，提交时回扫拼装。react-hook-form 下动态字段用 `useFieldArray` 或直接受控 `map` + `register`；编辑态回填需在 `detailApi` 返回后 `setValue`。注意 `getNodeParamsDetail` 里 `filedArrObj.forEach(form.setFieldValue)` 在 `setFiledArrObj([])` 之后、`paramsSearchApi` 异步返回之前执行（旧代码有时序 bug，首次拉到的旧值会 set 空集合），迁移时修正为在 `.then` 内回填。
- **node 删除 Modal 的 URL 严格相等校验**：validator 要求用户输入与 `modalInfo.url` 完全相等（含协议/路径）。迁移到 react-hook-form 用自定义 `validate` 函数，错误文案动态拼接（`t('Please fill in ' + modalInfo.url)`）。
- **`detial` 拼写错误（硬约束，第 3.2 已注）**：`node.ts` 的 `detailApi` endpoint 是 `/node/manage/detial`（typo），迁移时 endpoint 字符串保持原样，后端匹配依赖此拼写，**不要"修正"为 `detail`**。
- **deployment 状态列写死 success（已知限制）**：列表 + 详情两处 status 列均 `render: () => <Tag color={'success'}>{t('token_task_status_10')}</Tag>`，不论真实 status 值。可能是源码遗留（只展示成功部署）。迁移时**照搬写死**，但标注为可疑点，验收时确认业务是否接受。
- **smart-contract「新增」按钮无 actionClick（已知限制）**：`CustomTableTitle` 的 Add 按钮 `key:'Add'`，有 `limit` + `Tooltip` 提示（`blockchain_0013`），但 `actionClick` 的 switch 里**没有 `case 'Add'` 分支**——点击无效果。迁移时保留为「带 Tooltip 提示的信息按钮」（可能引导用户去别处新增，或纯占位），不实现跳转。验收确认业务意图。
- **`message.success(t('succesblockchainIdsfully deleted!'))` 拼写错误**：node/index 删除成功文案 key 是 `succesblockchainIdsfully deleted!`（疑似误编辑），非常规 i18n key。迁移时确认目标 i18n 是否保留此 key 或改用 `PUB_Success` 替换模式。
- **跨模块跳转（硬约束 #6，2 个）**：① `/blockchain/node`（node/edit 保存/编辑成功后跳回列表）；② `/blockchain/node/edit`（node 列表「新增」+ 行「编辑」跳转，编辑带 `blockchainId` + `nodeLocationId`）。同模块内跳转，无外部模块依赖，但需在 module-manifest 注册这两个路由。
- **i18n key 动态拼接（硬约束 #7）**：状态/类型文案无静态 STATUS_ENUMS 对象，全走 `t(\`prefix_${n}\`)` 拼接（node_status / common_task_status_color / token_type / type / contractName）。迁移时保留拼接模式，目标项目 i18n 需含这些 key（`common_task_status_color_*` 属全局 common 约定，确认已存在）。constants 抽前缀常量而非静态映射表。
- **antd Tag color 映射**：源用 antd 内置色（`success`）+ i18n key 返回的色名（`common_task_status_color_*`）。目标若用 Tailwind Badge variant，需建色名映射表（`success→success` 等），并处理 i18n 返回的 antd 色名到 variant 的转换。

## 9. 验收标准

- deployment 列表页支持全部 6 个筛选条件（稳定币 / tokenType / 链（`status===1` 可选，否则 disabled）/ 包名 / 类型（1/5）/ 部署时间范围），正确分页（**请求体 `pageNum`**），tokenType 与 type 列文案走 i18n 拼接正确，状态列显示 success 色。
- deployment 详情页标题区（tdName + 包名/版本/部署时间）+ 合约清单静态表格 8 列完整（contractName 走 `contractName_${n}`、3 个 ellipsis 列、status 写死 success），底部「返回」可用。
- node 列表页支持全部 4 个筛选条件（链 / 节点位置 / 创建时间 / 状态（1/2）），正确分页（`pageNum`），URL 列 Copy 可用，browserUrl 外链可新窗打开，状态列色值走 `common_task_status_color_${status}` + 文案 `node_status_${status}`。
- node 列表「新增」按钮跳 `/blockchain/node/edit`（无参）；行「编辑」跳同页带 `blockchainId` + `nodeLocationId`；「禁用」仅在 `status!==2` 可用、「启用」仅在 `status!==1` 可用，点击调 updateState（state 1/2）成功刷新；「删除」弹 Modal。
- node 删除 Modal：Input 必须严格等于 URL 才通过校验，提交调 updateState（state:3）成功后 Toast + 关闭 + 刷新。
- node 编辑页：链/节点位置 Select onChange 触发 `params/search` 动态渲染 N 个参数 Input + 预填 browserUrl；编辑态 `detailApi` 回填全部字段；提交按分支调 save/edit，`nodeParamsDetail` 正确拼装（回扫 values 与 filedArrObj 按 paramKey 匹配），成功后 1s 跳回 `/blockchain/node`；browserUrl URL 正则校验生效。
- smart-contract 列表页支持 2 个筛选条件（包名 / 创建时间），序号列 `index+1`，「新增」按钮带 Tooltip 提示且无跳转（照搬），行「下载」正确触发 blob 下载（文件名从 `content-disposition` 解析、`<a>` 点击、成功 Toast）。
- 8 个 limit 权限码（`BLOCKCHAIN_PERMISSIONS`）正确控制 8 个按钮可见性。
- 15 个 endpoint（含动态拼接的 sftp/download、拼写错误的 `detial`、api 模块封装的 5 个 node 写操作）全部在 `blockchain.api.ts` 实现，迁移率 ≥98%（分母=15 真实 endpoint，非脚本 18）。
- 所有文案 i18n 化（`modules.blockchain` + 复用 `common`/`router`，含动态拼接的 `node_status_*`/`common_task_status_color_*`/`token_type_*`/`type_*`/`contractName_*`/`token_task_status_10`），无硬编码中文（源码里的英文 key 如 `Please fill in...` 迁移为规范 key 或保留并标注）。
- `pnpm nx lint blockchain` / `pnpm nx test blockchain` / build 通过。
