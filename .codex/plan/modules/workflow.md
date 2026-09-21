# Workflow 模块迁移计划（sys-workflow）

## 1. 业务概述

Workflow（审批工作流配置）属于 System 管理域，用于为各类业务操作（铸币 MINT_TOKEN、融币 MELT_TOKEN、SP 充提、资金冻结/解冻、Token 上下架等）配置多级审批流程。管理员创建工作流，定义审批节点（Node）序列、每个节点指派审批人（Approver），并配置三项流程级开关：Withdraw（撤回）、Revert（退回上一步）、Escalate（升级加签）。

每个工作流绑定一个 Business Function（businessCode），节点为有序列表：第一个节点固定为「发起人」（stepType = Create），后续节点为「审批人」（stepType = Approve，code = 5/10）。审批人通过抽屉里的用户列表（受 businessCode 权限过滤）多选指定。

### 1.1 对应新架构 module id（重点）

`configs/stablecoin.json` 中存在两个含「workflow」的条目，语义完全不同，**本模块对应的是后者**：

| stablecoin.json 位置 | id | label | path | 语义 | 是否本模块 |
|---|---|---|---|---|---|
| `modules.order[]` 顶级 | `workflow` | Workflow Tasks | （待建） | 用户视角的**审批待办/任务中心**（我发起的、待我审批的） | 否 |
| `modules.order[]` → `system` 子项 | `sys-workflow` | Workflow | `/sys/workflow` | 管理员视角的**审批流程配置**（建/改/启停/删流程模板） | **是** |

迁移时 module id 建议用 `sys-workflow`（与新架构 system 域下 role/user/sysLog 一致的前缀风格），挂载到 `/sys/workflow` 路由。顶级 `workflow`（Tasks）属于另一个独立模块（待办中心），不在本次范围，但两者数据上有关联（Tasks 模块消费 Workflow 配置产出的流程实例）。

---

## 2. 【重点】edit.tsx vs t_edit.tsx 区别

这是本模块迁移的主体与最大难点。两个文件都是「新建工作流」表单，**结构高度相似但实现状态完全不同**。

### 2.1 本质区别（一句话）

`edit.tsx` 是**已联调线上、对接真实 API 的生产版**（含详情回填、保存、状态切换）；`t_edit.tsx` 是**同一个表单的「阈值规则（Threshold）增强原型」**，t_ 前缀代表 **threshold（金额阈值审批分支）**，目前是纯前端 mock 原型，未接 API，等待后端支持后合并回 edit。

### 2.2 详细对比

| 维度 | edit.tsx（生产版） | t_edit.tsx（阈值原型） |
|---|---|---|
| 行数 | 721 | 685 |
| 状态 | 已联调，调用真实 API | 纯前端 mock，`onFinish` 仅 `console.log` |
| 业务列表数据源 | `useSWR('api/config/v1/common/business/list')` 真实接口 | 写死的 `businessList` 常量（8 个 code） |
| 用户列表数据源 | `workflowUserListApi`（POST `/v1/common/user/list`）真实接口 | 写死的 mock `tableData`（3 条） |
| 详情回填 | 有（`query.id` → `workflowDetailApi`） | 无（仅初始化默认值） |
| 新增/编辑复用 | 是（`query.id` 判断 add/edit） | 仅新增 |
| t_ 前缀含义 | — | **threshold**（阈值规则） |
| 核心增强字段 | — | 每个审批节点新增 `enableThreshold`（开关）+ `thresholdAmount`（金额） |
| 阈值业务范围 | — | `THRESHOLD_BUSINESS_CODES` 白名单（MINT_TOKEN / MELT_TOKEN / SP_TOP_UP / SP_WITHDRAW / FREEZE_FUNDS / UNFREEZE_FUNDS）才显示阈值列 |
| 阈值校验 | — | `validateThresholdAmount`：当前节点金额必须**大于**上一个启用阈值的节点金额 |
| 用户列名展示 | `selectUser.join(' / ')`（斜杠） | `selectUser.join(', ')`（逗号） |
| 文案 | 全量 i18n（`t('sys_workflow_*')`） | 硬编码英文（未接 i18n） |
| UI 布局 | 分段卡片 + 边框分隔 | 多个 `Card`（Basic Info / Workflow Process / Workflow Configuration） |
| 用户表分页 | 服务端分页（`workflowUserListApi` 带 page/data） | `pagination={false}`（mock 全量） |
| stepName 持久化 | 用户名 join 后存 `stepName`，后端再 split('-') | 同逻辑但 join(',') |

### 2.3 t_edit.tsx 的「阈值规则」业务含义

阈值规则是审批流程的**条件分支**：当业务操作金额（如铸币数量）超过某节点的 `thresholdAmount` 时，流程需额外触发该节点审批。节点 1（发起人）不参与阈值，仅审批节点（key > 0）在特定 businessCode 下出现阈值列。`validateThresholdAmount` 强制阈值金额随节点递增（后置节点门槛须高于前置），形成阶梯式审批门槛。

**迁移决策建议**：以 `edit.tsx` 为基线迁移（它有完整 API 与回填），把 `t_edit.tsx` 的阈值字段（`enableThreshold` / `thresholdAmount` / `THRESHOLD_BUSINESS_CODES` / `validateThresholdAmount`）作为**可选增强**合入，用 feature flag 或后端字段存在性控制显隐。迁移前必须与后端确认阈值字段是否已在 add/edit/detail DTO 中落地。

---

## 3. 源文件清单（页面）

| 文件 | 行数 | 页面类型 | 路由 | 职责 |
|---|---|---|---|---|
| `index.tsx` | 227 | 列表 | `/sys/workflow` | 工作流列表：筛选（名称/业务/创建时间/状态）+ 服务端分页 + 行操作（View/Edit/Disable/Enable/Delete）+ 两个新增入口 |
| `view.tsx` | 186 | 详情 | `/sys/workflow/view?id=` | 工作流详情：基础信息描述列表（CustomIBasicDetailsInfo）+ 流程节点 Steps（垂直点状进度） |
| `edit.tsx` | 721 | 表单 | `/sys/workflow/edit` 或 `/sys/workflow/edit?id=` | 新建/编辑工作流（生产版）：基础信息 + 动态审批节点列表 + 三项配置开关 + 选人抽屉 |
| `t_edit.tsx` | 685 | 表单（原型） | `/sys/workflow/t_edit` | 阈值规则增强原型：同 edit 结构 + 每节点阈值开关/金额 + 阶梯校验 |

> 注：`index.tsx` 列表头部配置了**两个** label 完全相同（`t('Router_0010_4_1')`=Add）的新增按钮，分别跳 `edit` 和 `t_edit`，靠不同的权限 limit 区分。这是线上把原型入口临时挂上的做法，迁移时应二选一或改为单一入口 + 内部 feature flag。

---

## 4. API endpoints（从源码与 `src/lib/api/workflow.ts` 提取，全部真实）

所有接口前缀 `${process.env.NEXT_PUBLIC_CONFIG_ID}`（即 `api/config/`），method 均为 **POST**。

| 函数 | Endpoint | Method | 用途 | 关键字段 / 调用方 |
|---|---|---|---|---|
| —（内联 useSWR） | `v1/workflow/list` | POST | 工作流列表（服务端分页） | index 列表，`CustomTable` url 配置；筛选 workflowName/businessCode/beginDate-endDate/status |
| —（内联 useSWR） | `v1/common/business/list` | GET（useSWR 默认） | 业务功能下拉 | index（筛选 + 列表展示 businessName）、edit（业务 Select）|
| `workflowDetailApi` | `v1/workflow/detial`（源码拼写如此，疑 typo for detail） | POST | 工作流详情 | edit（编辑回填）、view（详情展示）；参数 `{ workflowId }` |
| `workflowAddApi` | `v1/workflow/add` | POST | 新建工作流 | edit（无 query.id 时）；payload 见 6.2 |
| `workflowEditApi` | `v1/workflow/edit` | POST | 编辑工作流 | edit（有 query.id 时）；payload = `{ workflowId, ... }` |
| `workflowModifyStatusApi` | `v1/workflow/modifyStatus` | POST | 启用/禁用/删除 | index 行操作；payload `{ workflowId, status }`（1=Enable,2=Disable,3=Delete）|
| `workflowUserListApi` | `v1/common/user/list` | POST | 审批人候选列表（按 businessCode 过滤） | edit 选人抽屉；参数 `{ page:{pageSize,pageNum}, data:{ businessCode, userName } }` |

> 共 **7 个 endpoint**（6 POST + 1 GET）。`t_edit.tsx` 因是原型未新增 API，仅 mock 了 business/list 与 user/list。

---

## 5. 数据模型

源码无独立 `.d.ts`，类型散落在组件内（大量 `BCMP.Objects` / `GlobalAny`）。以下为根据表单/接口反推的核心类型，迁移时应落地为正式 TS 接口。

```ts
// 工作流状态
type WorkflowStatus = 1 | 2 | 3; // 1=Active, 2=Inactive, 3=Deleted(逻辑删)

// 节点类型
type StepType = 5 | 10; // 5/10 均映射为 Approve（workflow_step_type_5/10）

// 业务功能
interface BusinessItem { code: string; value: string } // 如 { code:'MINT_TOKEN', value:'Mint Token' }

// 流程开关（Yes=1 / No=2）
type SwitchType = 1 | 2;

// 列表行（index）
interface WorkflowListItem {
  workflowId: number;
  workflowName: string;
  businessCode?: string;
  businessName: string;
  workflowNodes: number;        // 节点数（列表展示用）
  createdDate: number;          // 时间戳
  status: WorkflowStatus;
}

// 节点（edit 表单内部结构）
interface WorkflowNodeForm {
  stepOrder: number;            // 序号，1=发起人
  stepType: StepType;           // 权限/节点类型
  stepName: string;             // 审批人名 join 串（' / ' 或 '-'）
  executionMode: string;        // 固定 'One Assignee Required...'（i18n 文案）
  userId: number[];             // 审批人 id 列表
  selectUser: string[];         // 审批人名列表（回填用）
  // —— t_edit.tsx 额外字段 ——
  enableThreshold?: boolean;
  thresholdAmount?: number | null;
}

// 详情（detail/detial 返回）
interface WorkflowDetail {
  workflowId: number;
  workflowName: string;
  businessId: number;
  businessCode: string;
  businessName: string;
  escalationType: SwitchType;
  previousStepType: SwitchType; // Revert
  withdrawType: SwitchType;
  createdDate: number;
  status: WorkflowStatus;
  nodes: DetailNode[];          // 注意：detail 里 nodes 是数组，但 view.tsx 用 workflowDetail.nodes（疑似 detail 返回了 {nodes, ...node字段} 混合）
}
interface DetailNode {
  stepOrder: number;
  stepType: StepType;
  stepName: string;
  stepUsers: { userId: number; userName: string }[];
}

// 保存 payload（add/edit）
interface SaveWorkflowDTO {
  businessCode: string;
  escalationType: SwitchType;
  previousStepType: SwitchType;
  withdrawType: SwitchType;
  workflowName: string;
  nodes: {
    stepName: string;           // 注意：提交前 ' / ' 被 replaceAll 成 '-'
    stepOrder: number;          // 提交前 -1（去掉发起人占位的偏移）
    stepType: StepType;
    stepUsers: { userId: number }[];
  }[];
  workflowId?: number;          // edit 时带
}

// 候选审批人（user/list）
interface CandidateUser { userId: number; userName: string; roles: string[] }
```

> 风险点：`stepName` 在前端用 `' / '` 或 `'-'` 作为人名分隔符做 split/join 来回转换（edit 详情回填 `replaceAll('-', ' / ')`，提交 `replaceAll(' / ', '-')`）。这是把展示串当数据存的脆弱设计，迁移时应改用独立的 `userId[]` + 展示层计算。

---

## 6. 关键交互与状态

### 6.1 列表页（index）状态机

- 行操作可用性由 `status` 驱动：`Disable` 仅 status=1 可用；`Enable`/`Edit`/`Delete` 仅 status=2 可用。
- `Disable/Enable/Delete` 均走 `workflowModifyStatusApi`（status: 1/2/3），Delete 为逻辑删除（status=3）。
- 二次确认：Disable/Enable/Delete 各有 i18n 确认文案，`replace('${name}', workflowName)`。
- 权限：每个操作绑定唯一 `limit`（权限码 hash），迁移时需映射到新架构权限模型。

### 6.2 edit.tsx 表单字段与交互

**基础信息区**：`workflowName`（Input，maxLength 50，编辑态 disabled）、`businessCode`（Select，编辑态 disabled，切换时重置节点列表为初始 2 节点并清空已选人）。

**审批节点区**（核心，`Form.List name="nodes"`）：
- 动态增删：固定首节点（发起人，只读），末尾「Add」追加节点，仅最后一个节点可 remove（`length > 2 && key === length-1`）。
- 每节点列：`stepOrder`（只读序号）、`stepType`（Select，options [5,10]，当前 disabled）、`stepName`（Input readOnly + 「Selected」按钮唤起选人抽屉）、`executionMode`（只读）。
- 节点数据变换（提交时）：过滤掉首节点 → `stepName.replaceAll(' / ','-')` → `stepOrder - 1` → `userId` 映射为 `{userId}[]`。

**配置区**（三项 Radio.Group，1=Yes/2=No）：`withdrawType`、`previousStepType`、`escalationType`，各带 Tooltip 说明文案。

**选人抽屉（Drawer）**：独立 `form1`（userName 查询）+ 用户 Table（服务端分页，按 businessCode 过滤）+ 跨页多选状态管理。

### 6.3 选人跨页多选的复杂状态（edit/t_edit 共有，最易踩坑）

抽屉内维护三段状态实现「跨页累积选择」：
- `selectedRowKeys: React.Key[]` — 当前选中 userId 集合
- `selectedRowsData` — 选中行完整数据（用于取 userName）
- `removeKeys: useRef` — 本页操作中取消选中的 userId（用于 onChange 时过滤）

`rowSelection` 三个回调协作：
- `onSelect(record, selected)`：取消选中时把 record.userId 推入 removeKeys
- `onSelectAll(selected, _, changeRows)`：全不选时把 changeRows 的 userId 全部推入 removeKeys
- `onChange(keys, rows)`：用 `Array.from(new Set([...旧, ...新])).filter(!removeKeys)` 去重并剔除本页取消项，然后清空 removeKeys

提交时再次去重 + 按 selectedRowKeys 过滤，把结果写回 `nodes[currentUserInfo.index]`。

> 这段逻辑没有用受控的 `preserveSelectedRowKeys`，而是手写状态机，迁移时建议改用 AntD `preserveSelectedRowKeys: true` + 单一 Set 状态，大幅降低复杂度。

### 6.4 t_edit.tsx 额外交互（阈值列）

- `isThresholdBusiness()` 判断当前 businessCode 是否在白名单，控制阈值列显隐（`Form.Item` 条件渲染，导致列宽动态变化）。
- `enableThreshold` Checkbox 取消时清空对应 `thresholdAmount`。
- `thresholdAmount` 用 `Form.Item shouldUpdate` 监听同节点 `enableThreshold` 切换显隐；`InputNumber` 前缀 `>`，disabled 跟随 enableThreshold。
- 校验 `validateThresholdAmount`：从当前节点向前回溯，找到首个启用阈值的节点，要求当前金额严格大于它。

### 6.5 编辑回填的特殊处理（edit）

`workflowDetailApi` 返回后，`nodes` 经逆向变换回填表单：`stepOrder + 1`、`stepName.replaceAll('-', ' / ')`、`userId` 从 stepUsers 提取、同时缓存一份 `saveEditData`（含 selectUserName）用于选人抽屉二次编辑时合并已有审批人。

---

## 7. 跨模块依赖

### 7.1 组件 / 框架依赖

| 依赖 | 来源 | 用途 |
|---|---|---|
| `useHook`、`CustomTable`、`CustomTableTitle`、`useCustomTable` | `libs/components` | 列表页（旧封装） |
| `CustomIBasicDetailsInfo` | `libs/components` | 详情页描述列表 |
| `formatTimestamp`、`getServerSidePropsResult` | `libs/utils` | 时间格式化、SSR |
| `serverSideTranslations` | `next-i18next` | i18n（namespace: common/router/sys-workflow） |
| `useSWR` | swr | business/list、detail、user/list（旧项目数据获取） |
| `request` | `@/lib/axios` | API client |
| antd：Form/Form.List/Drawer/Table/Select/Radio/Steps/Tag/Card/Checkbox/InputNumber 等 | antd | 表单与展示 |
| `@heroicons/react` | — | QuestionMarkCircleIcon、XMarkIcon |
| `@ant-design/icons` | — | PlusOutlined、MinusCircleOutlined |

### 7.2 与 role / user 模块的关联

- **审批人候选来自 user 模块**：`workflowUserListApi` → `/v1/common/user/list`，返回 userName + roles（roles 用于抽屉表格展示）。迁移时复用 user 模块的 user list query / 类型。
- 选人抽屉底部有「找不到用户？去 User Management 添加」跳转 `/sys/user`（`routerPush('/sys/user')`）。
- **business/list**：业务功能清单，可能由后端独立维护或与 role 的权限菜单同源（`common/business`），需与 role 模块确认是否共享。

### 7.3 API client 归属

`src/lib/api/workflow.ts` 内所有函数（detail/add/edit/modifyStatus/userList）都拼 `${NEXT_PUBLIC_CONFIG_ID}` 前缀。迁移到新架构时应统一归入 `sys-workflow/data-access`，business/list 作为共享 common 接口（可能已被其他模块引用）。

---

## 8. 迁移注意点

1. **edit vs t_edit 二选一基线**：以 `edit.tsx`（生产、有 API）为基线，把 `t_edit.tsx` 的阈值增强作为可选合入。**迁移前必须向后端确认阈值字段（enableThreshold/thresholdAmount）是否已在 add/edit/detail DTO 落地**，否则只能做成前端 feature flag 占位。文档第 2 节是迁移成败的关键。

2. **复杂表单拆分策略**（edit 721 行 / t_edit 685 行，建议拆为）：
   - `workflow-form-page.tsx`（页面壳 + 编排 + add/edit 分支 + 详情回填）
   - `workflow-basic-info-section.tsx`（名称 + 业务下拉）
   - `workflow-node-list.tsx`（`useFieldArray` 动态节点，替代 Form.List）
   - `workflow-node-row.tsx`（单节点行，含阈值列条件渲染）
   - `workflow-config-switches.tsx`（Withdraw/Revert/Escalate 三开关）
   - `workflow-user-picker-drawer.tsx`（选人抽屉，独立封装，用 `preserveSelectedRowKeys` 简化）
   - util：`workflow.constants.ts`（THRESHOLD_BUSINESS_CODES、stepType 映射）、`workflow.schema.ts`（Zod，含阈值阶梯校验）、`workflow.transform.ts`（提交/回填的 stepName、stepOrder 变换）

3. **旧耦合与脆弱点**：
   - **stepName 当数据传输**：人名用 `' / '` / `'-'` 分隔符 split/join 来回转，一旦人名含分隔符即破。迁移改为 `userId[]` 为主、展示层计算。
   - **detail 接口拼写** `detial`（typo），需确认后端实际路径是否也拼错，还是前端拼错；迁移时统一为 `detail` 并与后端对齐。
   - **detail 数据结构歧义**：view.tsx 同时用 `workflowDetail.workflowNodes`（数字）和 `workflowDetail.nodes`（节点数组），疑似 detail 返回了扁平字段 + nodes 数组混合，需抓真实响应确认。
   - **i18n key 文案兜底**：t_edit 全硬编码英文，迁移必须接 i18n（复用 sys-workflow namespace，补充阈值相关 key）。
   - **权限码 hash**：index 每个按钮/操作带 `limit`（MD5-like hash），需逐一映射到新架构权限点。

4. **状态机风险**：
   - 列表 Disable/Enable/Delete 全靠 status 数字，迁移保留并补充 TS 联合类型防误用。
   - 选人跨页多选状态机（removeKeys + 三回调）极易漏选/重复，必须用单测覆盖「翻页后取消选中」「全选再取消」分支。

5. **路由与入口**：列表两个相同 label 的 Add 按钮是临时挂原型，迁移应收敛为单一新增入口；若要保留阈值增强，用 feature flag 控制而非双入口。

6. **后端字段确认清单**（迁移前必须对齐）：阈值字段是否落地、detail 真实路径与结构、business/list 数据源、user/list 是否支持 businessCode 过滤、modifyStatus 的 status=3 是否物理/逻辑删除。

---

## 9. 复杂度评估

| 维度 | 评估 |
|---|---|
| 复杂度等级 | **高** |
| 困难分数 | 4/5 |
| 主要难点 | edit(721)+t_edit(685) 双表单需合并；动态审批节点 + 选人跨页多选状态机；阈值阶梯校验；stepName 分隔符脆弱设计；detail 接口拼写/结构歧义 |
| 建议负责人 | 高级前端 + 业务/后端联调 |

---

## 10. 难度评估（一句话）

**高**。难点不在单一文件体量，而在于 edit（生产）与 t_edit（阈值原型）双表单的合并决策、选人抽屉手写跨页多选状态机的等价重写、以及阈值阶梯校验与后端字段未对齐的不确定性，是 sys 域里业务分支最多、前后端约定最易踩坑的模块。
