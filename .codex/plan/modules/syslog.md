# SysLog（系统操作日志）模块迁移计划

## 1. 业务概述

SysLog（系统操作日志）记录后台管理平台所有关键操作的审计流水，用于合规追溯与安全审计。单列表页，按「日志 ID / 时间范围 / 操作人 / 模块 / 操作类型 / 源 IP」六个维度筛选，展示日志条目，支持（占位的）导出功能。日志数据为只读，无增删改、无详情页、无操作按钮，是典型的「纯查询 + 服务端分页」表格页。

> 建议新架构 module id：`syslog`，路由建议 `/system/syslog`（与 sys 父模块下的 role / user / workflow 同级）。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/sys/sysLog/index.tsx` | 261 | 列表页：六维筛选 + 服务端分页 + 只读表格 |

无 `view.tsx` / `edit.tsx`，是单页模块。

### 页面清单

| 源文件 | 页面类型 | 路由路径（旧） | 职责 |
|--------|----------|----------------|------|
| `index.tsx` | list | `/sys/sysLog` | 日志列表查询、筛选、展示、（占位）导出 |

## 3. 依赖的 API

源码同时存在两套调用方式：`index.tsx` 内通过 `useCustomTable` 的 `url` 配置隐式调用列表接口、`useSWR` 直接调用下拉接口；同时 `src/lib/api/sys-logs.ts` 封装了等价 API（当前页面未引用该封装文件，迁移时应统一到封装）。**所有 endpoint 已从源码与 `src/lib/api/sys-logs.ts` 中提取，均为真实 url。**

### 3.1 列表与下拉 API

| Endpoint | Method | 用途 | 调用方 |
|----------|--------|------|--------|
| `/api/rbac/v1/log/list` | POST | 日志列表分页查询（核心） | `useCustomTable.url`（与 `getSysLogsApi` 等价） |
| `/api/rbac/v1/log/modules` | POST | 模块下拉枚举（Module 列） | `useSWR`（与 `getSysLogsModulesApi` 等价） |
| `/api/rbac/v1/log/operation/types` | POST（推断） | 操作类型下拉枚举（Operation Type 列） | `useSWR` |
| `/api/rbac/v1/user/list` | POST（推断） | 用户下拉枚举（User 筛选 + 列） | `useSWR` |

> 注：`useCustomTable` 默认 GET；源码 `useSWR` 的 key 为 `[url, {}]` 第二参作为 query。`src/lib/api/sys-logs.ts` 显式 `method: 'POST'`，故列表与 modules 已确认为 POST；operation/types 与 user/list 同属 rbac v1，迁移时需向后端确认 method（建议统一 POST）。

### 3.2 关键请求/响应字段

**列表请求 payload（筛选项）：**

| 字段 | 类型 | 来源 |
|------|------|------|
| `logId` | string | Input「Log ID」 |
| `startLogTime` / `endLogTime` | number（秒级时间戳） | RangePicker「Log Time」拆分 |
| `userName` | string | Select「User」 |
| `module` | string | Select「Module」（值为 `TOKEN_MANAGEMENT` 这类下划线大写 code） |
| `operationType` | string/number | Select「Operation Type」（值为 code） |
| `sourceIp` | string | Input「Source IP」 |

> 注意：源码内 `onFinish` 处理（时间戳拆分、空值过滤）整段被注释，说明 `useCustomTable` 自带 form 序列化逻辑已覆盖 `startLogTime-endLogTime` → `startLogTime/endLogTime` 的拆分与空值剔除。迁移时需确认新架构 DataTable/Form 方案是否等价支持 RangePicker 字段名拆分，否则要手动实现。

**列表响应（`SysLogRespVo`）：** 见第 4 节数据模型。

**`log/modules` 响应：** `string[]`（模块 code 数组，如 `['TOKEN_MANAGEMENT', 'NODE_MANAGEMENT']`）。注意列表筛选下拉用数组项直接构造，但表格 Module 列渲染时却用 `moduleList?.find(item => item.code === module)` —— 这暗示真实 `log/modules` 响应可能是 `[{ code, name }]` 而非纯字符串数组，`index.tsx` 的下拉构造存在类型假设（`module: string`）。迁移时以后端实际 schema 为准。

**`log/operation/types` 响应：** `{ code: number }[]`，下拉 label 为 `t('sys_log_optype_${code}')`。

**`user/list` 响应：** `{ userName?, name? }[]`，下拉 label/value 取 `userName ?? name ?? String(el)`，并前置一项 `{ label: 'All', value: 0 }`。

## 4. 数据模型

源码内联定义了列表响应类型 `SysLogRespVo`：

```ts
interface SysLogRespVo {
  logId: string;         // 日志唯一 ID（rowKey）
  logTime: number;       // 日志时间（时间戳，dayjs 直接解析 → UTC+08:00 展示）
  userName: string;      // 操作人
  module: string;        // 模块 code（如 TOKEN_MANAGEMENT）
  operationType: string; // 操作类型 code（渲染时 t('sys_log_optype_' + Number(code))）
  desc: string;          // 操作描述（>50 字符截断 + "more" 链接，链接 onClick 空 preventDefault）
  sourceIp: string;      // 来源 IP
}
```

**迁移建议类型（含请求参数）：**

```ts
export interface SysLogItem {
  logId: string;
  logTime: number;
  userName: string;
  module: string;
  operationType: string;
  desc: string;
  sourceIp: string;
}

export interface SysLogListParams {
  logId?: string;
  startLogTime?: number;
  endLogTime?: number;
  userName?: string;
  module?: string;
  operationType?: string;
  sourceIp?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface SysLogModuleOption {
  code: string;
  name: string;
}

export interface SysLogOperationTypeOption {
  code: number;
}
```

## 5. 关键交互与状态

### 5.1 筛选条件（共 6 个）

| 字段名 | label i18n key | 控件 | 默认值 | 选项来源 |
|--------|----------------|------|--------|----------|
| `logId` | `sys_log_002` Log ID | Input | - | - |
| `startLogTime-endLogTime` | `sys_log_003` Log Time | RangePicker | - | - |
| `userName` | `sys_log_004` User | Select | `0`（All） | `user/list` |
| `module` | `sys_log_005` Module | Select | `''` | `log/modules`（All 项 value=`'all'`） |
| `operationType` | `sys_log_006` Operation Type | Select | `''` | `log/operation/types`（All 项 value=`''`） |
| `sourceIp` | `sys_log_008` Source IP | Input | - | - |

- labelCol `{ flex: '10rem' }`。
- All 占位项在不同字段 value 不一致：userName=`0`、module=`'all'`、operationType=`''`。迁移时应统一空值约定，避免后端过滤歧义。

### 5.2 分页

服务端分页，由 `useCustomTable` 内部承载（`url: '/api/rbac/v1/log/list'`），rowKey=`logId`。

### 5.3 表格列（7 列）

| 列标题（i18n） | dataIndex | width | 渲染逻辑 |
|----------------|-----------|-------|----------|
| Log ID（`sys_log_002`） | `logId` | 12% | 纯文本 |
| Log Time（`sys_log_003`） | `logTime` | 18% | `dayjs(logTime).format('MMM DD, YYYY, HH:mm:ss [UTC+08:00]')`，空值 `--` |
| User（`sys_log_004`） | `userName` | 10% | 纯文本 |
| Module（`sys_log_005`） | `module` | 15% | 下划线大写 → Title Case（`TOKEN_MANAGEMENT` → `Token Management`），优先匹配 moduleList.name |
| Operation Type（`sys_log_006`） | `operationType` | 15% | `t('sys_log_optype_' + Number(code))` |
| Description（`sys_log_007`） | `desc` | 20% | >50 字符截断 + `more` 链接（`<a href="#" onClick preventDefault>`，**占位无实际展开**） |
| Source IP（`sys_log_008`） | `sourceIp` | 10% | 纯文本 |

- `actions: () => []` —— 无操作列，是纯只读审计页。

### 5.4 表头操作

表头 `CustomTableTitle` 含一个 Export 按钮（`sys_log_018` Export，权限 `OS_P_show`），`onClick` 仅 `console.log('Export logs')`，**为占位实现，无真实导出能力**。迁移时需与产品确认导出需求，或暂留入口待后端支持。

## 6. 跨模块依赖

### 6.1 共享组件 / Hook（来自 `libs/components` 工作区库）

- `CustomTable`、`CustomTableTitle`、`useCustomTable`：核心表格 + 筛选 + 分页容器，承载 form 序列化与服务端分页。
- `useHook(['common', 'sys-log'])`：i18n hook。

### 6.2 工具（来自 `libs/utils`）

- `getServerSidePropsResult`：SSR props 包装。
- `serverSideTranslations`（next-i18next）：locale 文件加载（`common` / `router` / `sys-log`）。

### 6.3 第三方

- `swr`（列表外的下拉数据）、`dayjs`（时间格式化）、`next`（`NextPage`、`GetServerSideProps`）。

### 6.4 API client

- 旧封装：`src/lib/api/sys-logs.ts` → `getSysLogsApi`、`getSysLogsModulesApi`（基于 `src/lib/axios` 的 `request`，POST）。
- 迁移后建议统一走新架构 api client（TanStack Query），废弃 SWR。

## 7. 迁移后目标文件清单（建议）

```text
libs/modules/syslog/
├── data-access/
│   └── src/lib/
│       ├── syslog.model.ts
│       ├── syslog.api.ts
│       └── +queries/
│           ├── syslog.keys.ts
│           └── syslog.queries.ts      # useSysLogListQuery + useSysLogModules/OperationTypes/UsersQuery
├── feature/
│   └── src/lib/
│       ├── syslog-list-page.tsx
│       └── module-manifest.ts
└── util/
    └── src/lib/
        ├── syslog.constants.ts        # 权限 OS_P_show、模块 Title Case 转换
        └── syslog.schema.ts           # 筛选 schema（含 RangePicker 拆分）
```

## 8. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `useCustomTable` + `CustomTable` | `@myorg/shared/ui` DataTable + 独立 FilterBar（react-hook-form） |
| `RangePicker` | `FormDatePicker`（需支持字段名拆分为 start/end） |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `CustomTableTitle` 按钮 | `@myorg/shared/ui` Button（权限控制） |
| `dayjs` | `date-fns`（注意 UTC+08:00 格式串迁移） |

## 9. 迁移步骤

1. 创建 `syslog` 模块库并注册路由（`/system/syslog`）、i18n（`sys-log` namespace）、权限（`OS_P_show`）。
2. 与后端确认 4 个 endpoint 的 method 与真实 schema（重点：`log/modules` 是 `string[]` 还是 `{code,name}[]`；`log/operation/types` 与 `user/list` 的 method）。
3. 定义类型：`SysLogItem`、`SysLogListParams`、`SysLogModuleOption`、`SysLogOperationTypeOption`。
4. 实现 API + TanStack Query hooks（list、modules、operationTypes、users）。
5. 实现列表页：
   - 六维筛选表单，All 占位值统一为空串或后端约定的「不传」。
   - RangePicker 提交时拆分为 `startLogTime` / `endLogTime`（秒级时间戳），并剔除空值（旧 `onFinish` 被注释，迁移时必须显式实现这套序列化）。
   - DataTable 七列渲染，复刻 Module Title Case、Operation Type i18n、desc 截断逻辑。
6. 时间格式 `MMM DD, YYYY, HH:mm:ss [UTC+08:00]` 用 date-fns 等价实现，确认时区。
7. Export 按钮按产品需求实现或保留占位（标注 TODO）。
8. 单测：筛选 payload 序列化（含时间拆分/空值剔除）、Module Title Case 转换、desc 截断。

## 10. 风险与注意事项

- **`log/modules` schema 不一致风险**：下拉按 `string[]` 构造，表格列又按 `{code,name}[]` find。迁移前必须用后端真实返回对齐，二选一后统一类型，不要「平均」两种假设（违反 Rule 7）。
- **筛选序列化被注释**：旧 `onFinish` 整段注释，依赖 `useCustomTable` 内部魔法实现时间戳拆分与空值过滤。迁移到新 DataTable/Form 时这套逻辑不存在，必须显式补回，否则筛选会带空值/带错误的 RangePicker 对象发请求。
- **All 占位值不统一**（`0` / `'all'` / `''`）：迁移时统一为后端能正确忽略的空值约定，否则可能把 `0`/`'all'` 当作真实筛选条件发出去。
- **operationTypes / user/list 的 method 未在源码显式声明**：`useSWR([url, {}])` 形式默认走 GET，但同模块 log 接口是 POST。需后端确认，避免 method 错配。
- **导出占位**：旧实现无真实导出，迁移勿凭空补全，先与产品确认。
- **i18n key 量大**：`sys_log_optype_*` 共 80+ 个操作类型 key，需整批迁移到新 locale 文件，避免漏译。

## 11. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **低** |
| 困难分数 | 1.5/5 |
| 主要难点 | 单页无详情无操作、无增删改；唯一需谨慎点是 RangePicker 字段拆分序列化与 `log/modules` schema 对齐 |
| 建议负责人 | 初-中级前端 |

## 12. 验收标准

- 六个筛选条件能正确构建列表请求 payload（含时间戳拆分、空值剔除）。
- 服务端分页与总条数正确。
- Module 列 Title Case、Operation Type 列 i18n、desc 截断展示与源项目一致。
- 模块/操作类型/用户三个下拉数据加载与 All 占位项正确。
- Export 入口按产品决策实现或明确标注占位。
- i18n key 全量迁移。
- lint / test 通过。

---

**迁移难度评估：低** —— 单页只读审计表格，无详情/编辑/操作，唯一需注意筛选表单的 RangePicker 字段拆分与空值序列化（旧代码被注释、依赖旧表格容器内部实现），以及 `log/modules` 下拉/列渲染的 schema 不一致需后端对齐。
