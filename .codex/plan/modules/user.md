# User 模块迁移计划

## 1. 模块概述（业务定位）

User（系统用户管理）是 RBAC 子系统的核心实体模块，归属 `sys` 命名空间（旧路由 `/sys/user/*`）。业务职责：

- 维护后台系统的用户账号生命周期（创建、编辑、查看、启停、重置密码、删除）。
- 为每个用户分配**角色**（role，多对多，`roleIds: number[]`）——角色决定了用户能访问哪些菜单/权限。
- 为每个用户分配**可访问的稳定币/链（TD, stablecoin + blockchain）范围**（`tdIds: number[]`）——多租户/多链隔离的核心数据。
- 特殊联动：当用户被分配「管理员角色」（`roleType === 0`）时，自动勾选全部 TD，且 TD 选择框禁用。

> 注：旧项目里「user」一词同时存在于 `sys/user`（后台账号）与业务侧钱包用户（`user-wallet` 等）。本文档仅针对 `sys/user` 后台账号管理。admin-platform 中的 `libs/modules/user` 是后台账号管理的迁移目标，二者业务语义一致。

## 2. 页面清单（源文件 → 页面）

| 旧源文件 | 页面类型 | 旧路由 | 行数 | 职责 |
|----------|----------|--------|------|------|
| `src/pages/sys/user/index.tsx` | 列表页 List | `/sys/user` | 200 | 用户列表 + 服务端分页 + 行内操作（View/Edit/Disable/Enable/Reset/Delete） |
| `src/pages/sys/user/view.tsx` | 详情页 View（只读） | `/sys/user/view?id=` | 140 | 用户详情展示：基本信息 + 角色多选回显 + TD 多选回显 |
| `src/pages/sys/user/edit.tsx` | 表单页 Form（新增/编辑复用） | `/sys/user/edit` / `/sys/user/edit?id=` | 258 | 用户创建/编辑表单，含角色联动 TD 的特殊逻辑 |

> 无独立 `detail.tsx`，列表/视图/表单三页即全部页面。

## 3. API endpoints（method + url + 用途）

### 3.1 列表页 `index.tsx` 调用

| 函数 / 调用方式 | Endpoint | Method | 用途 | 关键字段 |
|----------------|----------|--------|------|----------|
| `useCustomTable({ url })` 内置分页 | `/api/rbac/v1/user/listPage` | POST | 用户分页列表 | 入参：`userName`、`email`（筛选）+ 分页；出参：`UserRespVo[]` |
| `updateSysUserStatusApi` | `/api/rbac/v1/user/status/update` | POST | 启用/禁用用户 | `{ userId, status }`（0 启用 / 1 禁用） |
| `resetSysUserPasswordApi` | `/api/rbac/v1/user/password/reset` | POST | 重置密码 | `{ userId }` |
| `deleteSysUserInfoApi` | `/api/rbac/v1/user/delete` | POST | 删除用户 | `{ userId }` |

### 3.2 详情页 `view.tsx` 调用（裸 SWR，无 api 封装）

| 调用方式 | Endpoint | Method | 用途 | 关键字段 |
|----------|----------|--------|------|----------|
| `useSWR(['/api/rbac/v1/user/detail', { userId }])` | `/api/rbac/v1/user/detail` | POST | 用户详情 | 入参 `{ userId }`；出参 `UserRespVo` |
| `useSWR(['/api/rbac/v1/sys/role/list', {}])` | `/api/rbac/v1/sys/role/list` | POST | 角色列表（用于回显角色名） | 出参 `SysRoleRespVo[]`（`roleId`、`roleName`、`roleType`、`status`） |
| `useSWR(['/api/rbac/v1/user/td/list', {}])` | `/api/rbac/v1/user/td/list` | POST | TD（稳定币/链）列表 | 出参 `{ stablecoinId, stablecoinName, blockchainName }[]` |

### 3.3 表单页 `edit.tsx` 调用

| 函数 / 调用方式 | Endpoint | Method | 用途 | 关键字段 |
|----------------|----------|--------|------|----------|
| `getSysUserInfoApi` | `/api/rbac/v1/user/detail` | POST | 编辑回填 | `{ userId }` |
| `saveSysUserApi`（新增） | `/api/rbac/v1/user/save` | POST | 创建用户 | `UserSaveReqVo`：`{ userName, loginName, email, phoneNumber, roleIds, tdIds, orgId:1 }` |
| `updateSysUserApi`（编辑） | `/api/rbac/v1/user/update` | POST | 更新用户 | `UserUpdateReqVo`：`{ userId, userName, email, phoneNumber, roleIds, tdIds, orgId:1 }` |
| `useSWR(['/api/rbac/v1/sys/role/list', {}])` | `/api/rbac/v1/sys/role/list` | POST | 角色多选 | 同上 |
| `useSWR(['/api/rbac/v1/user/td/list', {}])` | `/api/rbac/v1/user/td/list` | POST | TD 多选 | 同上 |

### 3.4 去重后的唯一 endpoint 清单（共 7 个）

| # | Endpoint | Method | 用途 |
|---|----------|--------|------|
| 1 | `/api/rbac/v1/user/listPage` | POST | 用户分页列表 |
| 2 | `/api/rbac/v1/user/detail` | POST | 用户详情 / 编辑回填 |
| 3 | `/api/rbac/v1/user/save` | POST | 创建用户 |
| 4 | `/api/rbac/v1/user/update` | POST | 更新用户 |
| 5 | `/api/rbac/v1/user/status/update` | POST | 启停用户 |
| 6 | `/api/rbac/v1/user/password/reset` | POST | 重置密码 |
| 7 | `/api/rbac/v1/user/delete` | POST | 删除用户 |

> 另有 2 个跨模块依赖 endpoint（不属于 user 自身）：`/api/rbac/v1/sys/role/list`、`/api/rbac/v1/user/td/list`。

## 4. 数据模型（用户实体 TS 类型）

来源：旧项目 `types/models/user-resp-vo.ts` 等 OpenAPI 生成文件。

### 4.1 用户响应实体 `UserRespVo`

```ts
export interface UserRespVo {
  userId: number;        // 主键
  userName: string;      // 用户名（账号名，编辑时禁用修改）
  loginName: string;     // 登录名（创建时 = userName）
  email: string;         // 邮箱
  phoneNumber: string;   // 手机号（可空）
  status: number;        // 账号状态：0 正常 / 1 禁用
  roleIds: number[];     // 角色 id 集合
  roleName: string;      // 角色名（列表展示）
  tdIds: number[];       // 可访问的稳定币/链 id 集合
  tdName: string;        // TD 名称（列表展示，逗号分隔）
  createTime: number;    // 创建时间（毫秒时间戳）
  updateTime: number;    // 更新时间（毫秒时间戳）
}
```

### 4.2 创建 DTO `UserSaveReqVo`

```ts
export interface UserSaveReqVo {
  userName: string;
  loginName: string;
  email: string;
  phoneNumber: string;
  roleIds: number[];
  tdIds: number[];
}
// 注：edit.tsx 提交时额外硬编码 orgId: 1
```

### 4.3 更新 DTO `UserUpdateReqVo`

```ts
export interface UserUpdateReqVo {
  userId: number;
  userName: string;
  email: string;
  phoneNumber: string;
  roleIds: number[];
  tdIds: number[];
}
```

### 4.4 状态变更 DTO `UserStatusUpdateReqVo` / 删除 DTO `UserIdReqVo`

```ts
export interface UserStatusUpdateReqVo { userId: number; status: number; } // 0 启用 1 禁用
export interface UserIdReqVo { userId: number; }
```

### 4.5 跨模块实体 `SysRoleRespVo`（role 模块，仅关键字段）

```ts
export interface SysRoleRespVo {
  roleId: number;
  roleName: string;
  roleType: number;   // 0 = 管理员角色（触发 TD 全选联动）
  status: number;     // 1 = 禁用（该角色 checkbox 禁用）
}
```

## 5. 关键交互与状态

### 5.1 列表页交互

- **筛选**：`userName`（Input）、`email`（Input）。无角色/状态筛选。
- **分页**：服务端分页，由 `useCustomTable` 内置。
- **行内操作**（按 `status` 动态 disabled，均有权限 UUID）：
  - `View`（始终可用）→ `/sys/user/view?id=`
  - `Edit`（仅 `status===1` 禁用）→ `/sys/user/edit?id=`
  - `Disable`（仅 `status===0` 可点，弹确认）→ `status/update` 置 1
  - `Enable`（仅 `status===1` 可点，弹确认）→ `status/update` 置 0
  - `Reset`（仅 `status===1` 可点，弹确认）→ `password/reset`
  - `Delete`（仅 `status===1` 可点，弹确认）→ `user/delete`
- **状态展示**：`Tag` 颜色 + 文案由 i18n key `sys_user_status_color_${status}` / `sys_user_state_${status}` 驱动。
- **新增入口**：表头 `Add` 按钮 → `/sys/user/edit`（无 id 即新增）。

### 5.2 详情页交互（只读）

- 三组信息块：基本字段（userName/email/phoneNumber/createTime/updateTime/status）、TD 多选回显（`Checkbox.Group disabled`）、角色多选回显（`Checkbox.Group disabled`）。
- 角色列表、TD 列表、用户详情三个请求**并行**触发（三个独立 `useSWR`）。

### 5.3 表单页交互（创建/编辑复用，核心复杂度）

- **表单字段**：`userName`、`email`、`phoneNumber`、`roleIds`（Checkbox.Group）、`tdIds`（Checkbox.Group）。
- **校验规则**：
  - `userName`：必填，正则 `/^[a-zA-Z][a-zA-Z0-9]{0,20}$/`（字母开头，字母+数字，≤20 字符）；编辑模式 `disabled`。
  - `email`：必填 + email 类型。
  - `phoneNumber`：非必填（旧代码注释掉了 required 校验）。
  - `roleIds`：必填 array。
  - `tdIds`：非必填 array。
- **角色→TD 联动（关键业务逻辑）**：`setTokenType(roleIds, adminRoleId)` —— 当勾选的角色中包含管理员角色（`roleType===0`，启动时从 roleList 扫描得到 `adminRoleId`）时，自动勾选全部 TD 并禁用 TD 选择框；取消该管理员角色则清空 TD。
- **编辑回填**：`getSysUserInfoApi` 拿到后 `form.setFieldsValue`，并立即触发一次联动。
- **提交**：有 `id` 走 `update`（带 `userId`、`orgId:1`），无 `id` 走 `save`（`loginName = userName`、`orgId:1`）。

## 6. 跨模块依赖

| 依赖 | 来源 | 说明 |
|------|------|------|
| **role 模块** | `/api/rbac/v1/sys/role/list` + `SysRoleRespVo` | user 强依赖 role：列表回显角色名、详情/表单渲染角色 checkbox、管理员角色（`roleType===0`）触发 TD 全选联动。role 模块尚未迁移（见任务 #3）。 |
| **TD（稳定币/链）模块** | `/api/rbac/v1/user/td/list` | user 独占的 TD 列表接口，返回 `{ stablecoinId, stablecoinName, blockchainName }`。需确认该接口归属（user 模块 or 共享）。 |
| 共享组件 `CustomTable` / `CustomDetails` / `CustomForms` / `useHook` | `libs/components`（旧） | 迁移目标：`@myorg/shared/ui` DataTable + 详情/表单组件。 |
| 工具 `formatTimestamp` / `getServerSidePropsResult` | `libs/utils`（旧） | 迁移目标：`@myorg/shared/util-*`。 |
| i18n | namespace `sys-user` | 迁移目标：`modules.user`（见 module-manifest）。 |
| 权限 | 6 个操作各带 UUID（如 `f19251c8a9af489283cf578bf3d18861` = 新增） | 迁移目标：`USER_PERMISSIONS` 字符串常量（旧 UUID → 新 `user:read/write/delete`）。 |
| api client | `src/lib/axios`（旧） | 迁移目标：`@myorg/shared/data-access-api` 的 `apiClient`。 |

## 7. 已迁移对比结论（libs/modules/user vs sys/user）

**结论：libs/modules/user 是一个面向通用「项目用户管理」的脚手架式实现，并非 sys/user 的逐字迁移。二者业务同名但数据模型、API、交互均不匹配，覆盖度低。**

### 7.1 页面对比

| 旧页面 | 旧路由 | 新 feature 文件 | 是否覆盖 | 说明 |
|--------|--------|----------------|----------|------|
| 列表 List | `/sys/user` | `user-list-page.tsx` | 部分（壳） | 页面骨架存在，但筛选/列/操作均不匹配 |
| 详情 View | `/sys/user/view?id=` | `user-detail-page.tsx` | 部分（壳） | 缺角色多选回显、TD 多选回显（核心信息块） |
| 表单 Edit | `/sys/user/edit[?id=]` | `user-form-page.tsx` | 部分（壳） | 缺角色→TD 联动、缺 userName 正则、缺 orgId |

### 7.2 API endpoints 覆盖度（7 个旧 endpoint）

| 旧 Endpoint | 旧 Method | 新 `user.api.ts` 对应 | 覆盖 |
|-------------|-----------|----------------------|------|
| `/api/rbac/v1/user/listPage` | POST | `getUsers` → `GET /users` | **否**（url + method 全错） |
| `/api/rbac/v1/user/detail` | POST | `getUser` → `GET /users/:id` | **否**（url + method 全错） |
| `/api/rbac/v1/user/save` | POST | `createUser` → `POST /users` | **否**（url 错，且无 `loginName`/`orgId`/`tdIds`） |
| `/api/rbac/v1/user/update` | POST | `updateUser` → `PATCH /users/:id` | **否**（url + method 错） |
| `/api/rbac/v1/user/status/update` | POST | — | **缺失**（启停功能不存在） |
| `/api/rbac/v1/user/password/reset` | POST | — | **缺失**（重置密码不存在） |
| `/api/rbac/v1/user/delete` | POST | `deleteUser` → `DELETE /users/:id` | **否**（url + method 错） |

> **API 命中率：0 / 7。** 新 `user.api.ts` 用的是 RESTful 占位 `/users`（GET/PATCH/DELETE），与旧 RBAC POST 风格完全不同，且无启停、重置密码两个操作。新代码看起来是模板生成的 CRUD，未对接真实后端。

### 7.3 数据模型字段对齐

| 旧 `UserRespVo` 字段 | 新 `User` 字段 | 对齐 |
|----------------------|----------------|------|
| `userId: number` | `id: string` | 否（类型 + 命名） |
| `userName: string` | `name: string` | 命名偏差 |
| `email` | `email` | 是 |
| `phoneNumber` | — | **缺失** |
| `status: number (0/1)` | `status: 'active'\|'inactive'\|'pending'` | **语义不符**（数字 vs 字符串枚举） |
| `roleIds: number[]` | `role: UserRole`（单值字符串） | **严重不符**（多对多 → 单值） |
| `tdIds: number[]` | — | **缺失**（TD 多租户维度整体丢失） |
| `createTime: number` | `createdAt: string` | 类型不符 |
| `updateTime: number` | `updatedAt: string` | 类型不符 |
| `loginName` | — | 缺失 |
| `avatar?` | `avatar?` | 旧无此字段（新增） |

> 关键缺失：**`roleIds`（多角色）与 `tdIds`（多链范围）是 sys/user 的核心业务字段，新模型完全未建模**。新模型的 `role` 是单值字符串（'admin'/'manager'/'editor'/'viewer'），与旧的「多角色 id 集合 + 角色→TD 联动」业务无关。

### 7.4 关键交互缺失清单

- 缺角色多选（`roleIds` Checkbox.Group）与角色列表加载（`/sys/role/list`）。
- 缺 TD 多选（`tdIds` Checkbox.Group）与 TD 列表加载（`/user/td/list`）。
- 缺**管理员角色→TD 全选联动**（`setTokenType` 逻辑，业务最核心规则）。
- 缺列表行内 6 操作中的 4 个：Disable/Enable（启停）、Reset（重置密码）、Delete（实际有按钮但 url 错）；仅保留 Edit/Delete 壳。
- 缺 `userName` 字母开头正则校验、编辑模式禁用 userName。
- 缺 `orgId`、`loginName` 提交字段。
- 缺状态码数字↔枚举映射（旧 `0/1` vs 新 `'active'/'inactive'`）。
- 缺 i18n（新用 `modules.user`，旧用 `sys-user`，key 完全不同，需重建）。
- 缺权限 UUID 映射（旧 6 个 UUID → 新 `user:read/write/delete`）。

## 8. 迁移注意点与剩余工作

**当前状态：libs/modules/user 提供了标准化的四层目录（data-access/feature/ui/util）与页面骨架，但内容是通用脚手架，不是 sys/user 的真实迁移。需要按旧业务重写。**

### 8.1 必须重写的部分

1. **`user.api.ts`**：全部 7 个 endpoint 改回 RBAC POST 风格（`/api/rbac/v1/user/listPage`、`/detail`、`/save`、`/update`、`/status/update`、`/password/reset`、`/delete`），删除占位 `/users`。
2. **`user.model.ts`**：对齐 `UserRespVo`（`userId:number`、`roleIds:number[]`、`tdIds:number[]`、`status:number`、`loginName`、`phoneNumber`、时间戳数字）。`CreateUserDTO`/`UpdateUserDTO` 补 `loginName`、`orgId`、`tdIds`。
3. **`user-types.ts`**：`UserStatus` 改为数字枚举（0/1）或建映射；`UserRole` 移除（改为 `roleIds: number[]`）。
4. **`user-validation.ts`**：`userName` 正则 `/^[a-zA-Z][a-zA-Z0-9]{0,20}$/`；`roleIds` array 必填；`tdIds` array 选填。
5. **`user-list-page.tsx`**：筛选改为 userName/email；列改为 序号/userName/email/phoneNumber/tdName/createTime/status(Tag)；行操作补 View/Disable/Enable/Reset/Delete；补 `status/update`、`password/reset` mutation。
6. **`user-detail-page.tsx`**：补角色多选回显 + TD 多选回显两个信息块。
7. **`user-form-page.tsx`**：补角色 Checkbox.Group + TD Checkbox.Group + 管理员角色→TD 全选联动（`setTokenType`）+ 编辑回填 + userName 编辑禁用。
8. **新增 mutation hooks**：`useUpdateUserStatusMutation`、`useResetUserPasswordMutation`。

### 8.2 跨模块阻塞

- **role 模块（`/sys/role/list` + `SysRoleRespVo`）必须先迁移或先抽共享 hook**，否则 user 的角色多选/联动无法实现（任务 #3 未完成）。
- TD 列表（`/user/td/list`）归属需确认：若属 user 则纳入本模块，若属独立 TD 模块则建跨模块依赖。

### 8.3 仅需接线的部分（已就绪）

- 四层目录结构、`module-manifest.ts`（路由 `/user`、`/user/create`、`/user/:id`、`/user/:id/edit`）、`userKeys` 工厂、TanStack Query list/detail 壳、Zustand store（filter/ui）、PermissionGuard 集成骨架均已存在，无需重建。

### 8.4 建议执行顺序

1. 迁移 role 模块（或抽 `useSysRoleListQuery` 共享 hook）→ 解除阻塞。
2. 重写 `user.model.ts` + `user-types.ts`（数据模型是后续一切的基础）。
3. 重写 `user.api.ts`（7 个 endpoint）+ 补 status/reset mutation。
4. 重写三个 page（list → detail → form，form 最后因含联动最复杂）。
5. 接路由（manifest 已就绪，需挂到 `sys` 命名空间路由）+ i18n（`sys-user` → `modules.user`）+ 权限 UUID 映射。
6. 三层校验 + dev 启动验证（任务 #7）。
