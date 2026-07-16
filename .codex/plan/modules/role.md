# Role 模块迁移计划

## 1. 模块概述

Role（角色管理）是 RBAC 子系统下的基础模块，承担「角色 → 菜单/权限」的映射配置职责。一个角色挂载一组菜单树节点（目录/菜单/按钮），用户绑定角色后即获得对应菜单访问权。本模块是 user、workflow、permission 等模块的依赖前提（角色定义先行）。

**业务定位：** 系统管理（sys）下的权限基础设施层。列表查看角色、详情只读查看授权菜单树、新增/编辑维护角色与菜单勾选、行内启用/禁用/删除。

**新架构建议 module id：** `role`，建议挂载于 `sys` 域下（如 `libs/modules/role`，路由前缀 `/sys/role`）。

## 2. 源文件清单

| 源文件 | 行数 | 页面类型 | 路由路径 | 职责描述 |
|--------|------|----------|----------|----------|
| `src/pages/sys/role/index.tsx` | 162 | list（列表页） | `/sys/role` | 角色列表，单一筛选 `roleName` + 服务端分页；行内操作 View / Edit / Disable / Enable / Delete；顶部 Add 按钮跳编辑页 |
| `src/pages/sys/role/view.tsx` | 112 | view（详情只读页） | `/sys/role/view?id={roleId}` | 角色详情只读展示：roleName、status、已授权菜单树（`Tree` 组件 disabled + checkedKeys 高亮） |
| `src/pages/sys/role/edit.tsx` | 197 | edit（新增/编辑页） | `/sys/role/edit`（新增）<br>`/sys/role/edit?id={roleId}`（编辑） | 单表单页同时承载新增与编辑：roleName（编辑态只读）、status（Radio）、菜单勾选树（`Tree` checkable）。`query.id` 有无区分新增/更新提交 |

> 三页均为 Next.js `NextPage` + `getServerSideProps`（仅做 i18n 加载），无独立 detail 路由——详情只读走 `view.tsx`，编辑走 `edit.tsx`。

## 3. API endpoints

全部为 POST（即便语义上是查询，后端统一用 POST + body）。列表页走通用 `useCustomTable` 直接传 url；其余走 `@/lib/api/sys-role.ts` 封装（内部用 `request` from `../axios`）。

### 3.1 完整 endpoint 表

| 函数 / 调用方 | Endpoint | Method | 用途 | 关键请求字段 | 关键响应字段 |
|---------------|----------|--------|------|--------------|--------------|
| `useCustomTable` url（index.tsx） | `/api/rbac/v1/sys/role/listPage` | POST | 角色分页列表 | `{ roleName?, page, size }` | `SysRoleRespVo[]`：`roleId`、`roleName`、`status`、`describes`、`remarks?`、`menuList` |
| `useSWR`（view.tsx） | `/api/rbac/v1/sys/menu/queryAllMenu` | POST（body 为 `{}`） | 全量菜单树（用于详情页授权树渲染） | `{}` | `MenuTreeRespVo[]`：`menuId`、`menuName`、`menuType`、`children`、`selected`、`parentId`、`orgType?` |
| `useSWR`（view.tsx） | `/api/rbac/v1/sys/role/getRole` | POST | 角色详情（含已授权 menuIdList） | `{ roleId }` | `SysRoleByIdRespVo`：`roleId`、`roleName`、`status`、`menuIdList: number[]`、`remarks`、`describes` |
| `getSysRoleInfoApi`（edit.tsx） | `/api/rbac/v1/sys/role/getRole` | POST | 编辑页回填角色详情 | `{ roleId }` | 同上 `SysRoleByIdRespVo` |
| `useSWR`（edit.tsx） | `/api/rbac/v1/sys/menu/queryAllMenu` | POST | 编辑页菜单勾选树数据源 | `{}` | `MenuTreeRespVo[]` |
| `saveRoleInfoApi`（edit.tsx 新增） | `/api/rbac/v1/sys/role/save` | POST | 新建角色 | `RoleInsertReqVo`：`roleName`、`status`、`menuIdList?`、`remarks?` | `ResultInfo`（code/message） |
| `updateRoleInfoApi`（edit.tsx 编辑） | `/api/rbac/v1/sys/role/update` | POST | 更新角色 | `RoleUpdateReqVo`：`roleId`、`roleName?`、`status?`、`menuIdList?`、`remarks?` | `ResultInfo` |
| `updateRoleStatusApi`（index.tsx） | `/api/rbac/v1/sys/role/status/update` | POST | 启用/禁用角色 | `RoleStatusUpdateReqVo`：`roleId`、`status`（0 启用 / 1 禁用） | `ResultInfo` |
| `deleteRoleInfoApi`（index.tsx） | `/api/rbac/v1/sys/role/delete` | POST | 删除角色 | `RoleDeleteReqVo`：`roleId` | `ResultInfo` |

> 注：列表 url `/sys/role/listPage` 与详情/CRUD 的 `/sys/role/getRole|save|update|status/update|delete` 是两个不同粒度的 endpoint，前者分页、后者单实体操作，迁移时不要混用。

## 4. 数据模型

类型来源：`td-manage/types/models/*`（OpenAPI 自动生成，含 `@ts-nocheck`）。

### 4.1 `SysRoleRespVo`（列表行 / `sys-role-resp-vo.ts`）

| 字段 | 类型 | 含义 |
|------|------|------|
| `roleId` | `number` | 角色 ID（列表 rowKey） |
| `roleName` | `string` | 角色名称 |
| `status` | `number` | 状态（0 正常 / 1 禁用） |
| `describes` | `number` | 角色描述标识（源码注释为 "describes"，类型为 number，疑似后端字段语义遗留） |
| `remarks?` | `string` | 备注（列表列被注释未展示） |
| `menuList` | `MenuTreeRespVo[]` | 角色关联菜单（列表场景未使用） |

### 4.2 `SysRoleByIdRespVo`（详情 / 编辑回填 / `sys-role-by-id-resp-vo.ts`）

| 字段 | 类型 | 含义 |
|------|------|------|
| `roleId` | `number` | 角色 ID |
| `roleName` | `string` | 角色名称 |
| `status` | `number` | 状态 |
| `menuIdList` | `number[]` | 已授权菜单 ID 列表（驱动 Tree checkedKeys） |
| `remarks` | `string` | 备注 |
| `describes` | `number` | 描述标识 |

### 4.3 `MenuTreeRespVo`（菜单树节点 / `menu-tree-resp-vo.ts`）

| 字段 | 类型 | 含义 |
|------|------|------|
| `menuId` | `number` | 节点 ID（Tree key） |
| `menuName` | `string` | 节点名称（i18n key，前端再 `t()`） |
| `menuCode` | `string` | 菜单编码 |
| `menuKey` | `string` | 菜单 key |
| `menuType` | `number` | 类型：0 目录 / 1 菜单 / 2 按钮 |
| `parentId` | `number` | 父节点 ID |
| `orderNum` | `number` | 排序号 |
| `icon` | `string` | 图标 |
| `selected` | `number` | 是否选中：1 是 / 2 否 |
| `orgType?` | `number` | 组织类型：1 operation / 5 central / 10 commercial / 15 other |
| `children` | `MenuTreeRespVo[]` | 子节点 |

### 4.4 请求 DTO

- `RoleInsertReqVo`：`roleName`（必填 string）、`status`（必填 number，0 正常 / 1 禁用）、`menuIdList?`（number[]）、`remarks?`（string）
- `RoleUpdateReqVo`：`roleId`（必填）、`roleName?`、`status?`、`menuIdList?`、`remarks?`
- `RoleStatusUpdateReqVo`：`roleId`、`status`（0 启用 / 1 禁用）
- `RoleDeleteReqVo`：`roleId`
- `RoleReqVo`：`roleId`（getRole 入参）
- `RoleQueryReqVo`：`roleName?`、`status?`

## 5. 关键交互与状态

### 5.1 列表页（index.tsx）

- **筛选：** 仅 `roleName`（Input，单字段查询）。
- **分页：** 服务端分页，由 `useCustomTable` 内置处理（page/size）。
- **列：** 序号（`roleId` 渲染为行号 `${index+1}`，**注意不是真实 ID**）、`roleName`、status（`Tag` + i18n `sys_user_status_color_${status}` / `sys_user_state_${status}`）。
- **Add 按钮：** `routerPush('/sys/role/edit')`，权限点 `8ba396dfb64b44f29bd4efcf1b4c5522`。
- **行操作（含权限点 + 禁用条件 + 确认弹窗）：**

| Action | 权限点 UUID | disabled 条件 | 确认文案 |
|--------|-------------|---------------|----------|
| View | `d3a1e3209f3e48cc81c376c08ef0dfe1` | 恒 false | — |
| Edit | `1027ce0cb0bb40148dbf66b7b2d53b26` | `!(status===1 && roleType!==0)` | — |
| Disable | `b8304095843a46adb10effb4bdfa778e` | `!(status==0 && roleType!==0)` | `sys_role_confim_002/003` |
| Enable | `2c0092da156e4473ac06c2a5d7e8b6a1` | `!(status==1 && roleType!==0)` | `sys_role_confim_001` |
| Delete | `696ebbe9e238431fa22f60ec51863cb3` | `!(status==1 && roleType!==0)` | `sys_role_confim_004/005` |

> **风险点：** 列表 disabled 条件引用了 `data.roleType`，但 `SysRoleRespVo` 类型定义中**没有 `roleType` 字段**（只有 `describes`）。这是源码与类型定义的矛盾——`roleType` 来自后端实际响应但未在 OpenAPI 模型声明。迁移时需向后端确认该字段是否真实存在；若不存在，所有行操作除 View 外的 disabled 逻辑会失效（恒为 `false`，即恒可点）。详见第 7 节。

### 5.2 详情页（view.tsx）

- 只读展示 roleName、status（`Tag` 颜色：0 绿 / 其他灰）。
- **授权菜单树：** `Tree` `disabled` + `checkable` + `defaultExpandAll`，`fieldNames` 映射 `menuName/menuId/children`，`titleRender` 对 `menuName` 做 `t()` 国际化。
- **checkedKeys 过滤逻辑（关键）：** 代码遍历 `menuList` 收集所有「有 children 的父节点 menuId」存入 `treeState`，然后用 `detailInfo.menuIdList.filter(ite => treeState.indexOf(Number(ite)) < 0)` 排除父节点——即只把叶子节点作为 checkedKeys 传给 Tree。这是因为 antd Tree 的 `checkedKeys` 若含父节点会自动全选所有子节点，导致误展示。**view 与 edit 共享同一段逻辑。**

### 5.3 编辑页（edit.tsx）

- **新增/编辑二合一：** 通过 `query.id` 有无区分。新增时 `getSysRoleInfoApi` 不触发。
- **表单字段：**
  - `roleId`（hidden）
  - `roleName`：Input maxLength 20，**编辑态 disabled**（不可改名），必填
  - `status`：Radio.Group，值为字符串 `'0'/'1'`，初始值 `'0'`，必填（enum 校验）
  - `menuIdList`：Tree checkable，必填（array 校验）
- **编辑回填：** `getSysRoleInfoApi` 返回后，`status` 转 string、`remarks` 转 string，`menuIdList` 同时 setFieldValue。
- **菜单勾选提交（关键）：** `onCheck` 时把 `checkedKeys`（叶子）和 `e.halfCheckedKeys`（半选父节点）**合并**写入 `menuIdList`。提交给后端的是「叶子 + 半选父节点」全集，而后端返回的 `menuIdList` 在回填时又会被前端 filter 掉父节点用于渲染——形成「存全集、渲染只读用叶子」的对称设计。**迁移时务必保留 halfCheckedKeys 合并逻辑，否则会丢失父级菜单授权。**
- **提交：** `onFinish` 根据 `query.id` 调用 `updateRoleInfoApi` 或 `saveRoleInfoApi`。
- **remarks 字段：** 类型中存在但 UI 上被注释（index 列表、view 详情、edit 表单三处均注释），属于历史保留，迁移可暂不实现。

## 6. 跨模块依赖

### 6.1 共享组件 / 工具（来自 `libs/components`、`libs/utils`）

- `CustomTable`、`useCustomTable`、`CustomTableTitle`（列表页核心，封装分页 + 筛选 + 操作列 + 权限点 limit）
- `CustomDetails`（详情页只读卡片渲染）
- `CustomForms`（编辑页表单 + 卡片 + 按钮容器）
- `useHook`（提供 `t`、`query`、`routerPush`，统一 i18n + 路由）
- `getServerSidePropsResult` + `serverSideTranslations`（SSR i18n）

### 6.2 API client

- `@/lib/api/sys-role.ts` → `request` from `../axios`（统一 axios 封装，`BCMP.GetRequestData<P, R>` 类型约束）
- 列表/菜单树直接用 `useSWR([url, payload])`，未走 sys-role 封装

### 6.3 类型（`types/models`）

- `SysRoleRespVo`、`SysRoleByIdRespVo`、`MenuTreeRespVo`
- `RoleInsertReqVo`、`RoleUpdateReqVo`、`RoleStatusUpdateReqVo`、`RoleDeleteReqVo`、`RoleReqVo`、`RoleQueryReqVo`、`ResultInfo`

### 6.4 i18n namespace

- `common`、`router`、`sys-user`（复用用户模块的状态文案）、`sys-role`、`permission-code`（edit 页引入）

### 6.5 权限点（limit UUID）

共 6 个，见 5.1 表格（Add / View / Edit / Disable / Enable / Delete）。这些 UUID 是后端权限码，迁移需原样保留并接入新权限系统。

### 6.6 关联模块

- **菜单模块（menu）：** `queryAllMenu` 是共享接口，role 与 menu 模块都依赖。建议菜单树数据走共享 data-access。
- **用户模块（user）：** user 绑定 role，role 是 user 的前置依赖。

## 7. 迁移注意点

### 7.1 `roleType` 字段缺失（高优先级）

列表行操作 disabled 条件全部依赖 `data.roleType !== 0`，但 `SysRoleRespVo` 无此字段。两种可能：
1. 后端实际返回了 `roleType`（如区分「系统内置角色 0」vs「自定义角色」），OpenAPI 模型未更新——需后端确认并补类型。
2. 字段已废弃，disabled 逻辑失效。

迁移时务必先与后端对齐 `roleType` / `describes` 的真实语义，再决定是否保留「系统内置角色不可编辑/删除」的守卫逻辑。

### 7.2 Tree checkedKeys 的父子节点过滤（高优先级，易踩坑）

view 与 edit 都有「收集所有有 children 的父节点 menuId → 从 menuIdList 中排除」的逻辑。这段逻辑在两份源码中**完全重复**（约 15 行），迁移时应：
- 抽成共享 util（如 `collectParentMenuIds(menuList)` + `filterLeafMenuIds(ids, parentIds)`）。
- 放入 `role/util` 或 menu 共享 util，避免重复。
- **务必迁移正确**，否则详情页会误勾所有子菜单、编辑页会漏存父节点。

### 7.3 旧耦合模式

- `useCustomTable` / `CustomForms` / `CustomDetails` 是旧框架的「全功能黑盒组件」，内部封装了表单、分页、权限点、i18n、确认弹窗。新架构需拆解为：`react-hook-form` + `shared/ui` DataTable + 权限 hook + 确认对话框。
- 行操作通过 `actions()` 返回数组 + `actionClick` switch 分发，配合 `limit` UUID 做权限控制——需映射到新权限系统（如 `usePermission(limit)` + DropdownMenu）。
- 列表序号列用 `roleId` 作 dataIndex 但渲染为行号——迁移时直接用 DataTable 的 index 列，rowKey 仍用 `roleId`。
- `getServerSideProps` 仅做 i18n，迁移到客户端 i18n 后可删除。

### 7.4 状态值不一致风险

- `RoleInsertReqVo.status` 注释为「0 Normal 1 Disabled」，`RoleStatusUpdateReqVo.status` 注释为「0 enabled 1 disabled」，`RoleUpdateReqVo.status` 注释为「0 Enabled 1 Disabled」——**语义一致（0 启用 / 1 禁用）但注释措辞不统一**。
- 但 index.tsx 行操作里：Disable 调 `status: 1`（条件 `status==0` 时可禁用），Enable 调 `status: 0`（条件 `status==1` 时可启用）——**与上述一致**。
- 注意 edit.tsx 中 status 是字符串 `'0'/'1'`，提交时若直接透传可能需转 number（源码未显式转换，依赖后端容错或 axios 拦截器）。迁移时建议在 schema 层统一为 number。

### 7.5 菜单树 `queryAllMenu` body 为 `{}`

该接口虽是查询但用 POST 且 body 为空对象。新架构若用 GET 风格封装需注意，建议保留 POST 或与后端协商。

### 7.6 编辑页角色名不可改

编辑态 `roleName` disabled。这是业务约束（角色名一旦创建不可修改），迁移需保留该交互。

## 8. 迁移后目标文件清单（建议）

```text
libs/modules/role/
├── data-access/
│   └── src/lib/
│       ├── role.model.ts              # SysRoleRespVo / SysRoleByIdRespVo / MenuTreeRespVo / 各 ReqVo
│       ├── role.api.ts                # getRole / save / update / statusUpdate / delete + listPage
│       └── +queries/
│           ├── role.keys.ts
│           ├── role.queries.ts        # useRoleList / useRoleDetail / useMenuTree
│           └── role.mutations.ts      # useSaveRole / useUpdateRole / useUpdateRoleStatus / useDeleteRole
├── feature/
│   └── src/lib/
│       ├── role-list-page.tsx         # 对应 index.tsx
│       ├── role-view-page.tsx         # 对应 view.tsx（只读）
│       ├── role-form-page.tsx         # 对应 edit.tsx（新增/编辑二合一）
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── role-menu-tree.tsx         # 封装 Tree + 父子过滤逻辑（view/edit 共用）
│       ├── role-status-tag.tsx
│       └── role-form.tsx              # 抽出表单字段
└── util/
    └── src/lib/
        ├── role.constants.ts          # 6 个权限点 UUID + i18n namespace
        ├── role.schema.ts             # zod schema（status 统一 number）
        └── menu-tree.util.ts          # collectParentMenuIds / filterLeafMenuIds（可放 menu 共享 util）
```

## 9. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `CustomTable` + `useCustomTable` | `@myorg/shared/ui` DataTable + 筛选表单 + `useRoleListQuery` |
| `CustomTableTitle` | 列表页头部 + 按钮（含权限） |
| `CustomForms` + `Form`/`Form.Item` | `react-hook-form` + `FormField` |
| `CustomDetails` | 详情只读卡片组件 |
| antd `Tree` | antd `Tree`（保留）或自研 Tree；checkedKeys 逻辑需复刻 |
| antd `Input` / `Radio` | `@myorg/shared/ui` Input / RadioGroup |
| antd `Tag` | Tailwind badge / StatusTag |
| `useHook`（t/query/routerPush） | `useTranslation` + `useSearchParams` + `useNavigate` |
| `useSWR` | TanStack Query |
| 行操作 `actions()` + `actionClick` | DropdownMenu + `usePermission` |

## 10. 风险与注意事项

- **`roleType` 字段缺失**（7.1）—— 迁移前必须向后端确认，否则行操作守卫逻辑无法正确实现。
- **Tree 父子节点过滤逻辑**（7.2）—— view/edit 重复实现，迁移必须抽共享 util 且不可写错，否则授权数据会失真（详情误勾全选 / 编辑漏存父节点）。
- **status 类型 string vs number**（7.4）—— 编辑页用字符串、DTO 是 number，源码靠后端容错，迁移应在 schema 层统一。
- **菜单树接口是 POST + `{}`**（7.5）—— 封装时注意 method。
- **6 个权限点 UUID** 需接入新权限系统，建议集中到 `role.constants.ts`。
- **`CustomTable` 黑盒拆解** 是主要工作量，需复刻其分页、筛选、操作列、确认弹窗、权限点控制。

## 11. 迁移难度评估

**难度：低。**

理由：模块规模小（三页共约 470 行，无 tabs、无复杂联动、无历史版本对比），业务逻辑线性（列表 → 查看/编辑）；唯一的技术难点是 antd Tree 的父子节点勾选过滤逻辑（需复刻且抽共享 util），以及 `roleType` 字段语义需后端确认。API 端点清晰（7 个，全部 POST），数据模型由 OpenAPI 生成、字段明确。主要工作量在拆解 `CustomTable/CustomForms/CustomDetails` 三个旧框架黑盒组件到新架构，属于机械迁移而非业务难点。
