# User Wallets 模块迁移计划

> key-management 第 4 个迁入子模块。源：`td-manage/src/pages/key-management/user-wallets`
> （1 文件 / 271 行）。目标：复用 `libs/modules/key-management/*` + managed-wallets 已打通的接入机制。
> **极简模块**：仅 1 个 list 页，无 detail / 无写操作 / 无跳转。

---

## 1. 业务概述

User Wallets（用户钱包）展示用户钱包列表，仅 1 个列表页。

**⚠️ 源页面为半成品**：筛选表单存在但**未接 API**（源码 `handleQuery` 内 `TODO: 实际项目中需要将查询参数传递给API`，index.tsx:83），所有筛选下拉为**空占位**（仅 All option，未调 common 接口填充），列表 API 为 **GET 无参**一次性返回。迁移**忠实保持源行为**（不擅自补全筛选 / 下拉数据），在第 8 章标注半成品性质与后续优化方向。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 271 | 列表页：8 筛选字段（空占位/All/RangePicker）+ 9 列表格；GET `/wallets/user/list` 无参；筛选 TODO 未接 API；前端分页 |

## 3. 依赖的 API

### 3.1 列表 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/wallets/user/list` | GET | `index.tsx` `useSWR` | **无参**。响应 `{ list: UserWalletItem[]; total: number }`（注意是 `list` 非 `rows`，无 `page` 对象） |

### 3.2 详情 / 写操作 / 下拉

- **无**。源筛选下拉为空占位（未接 stablecoin/blockchain 等 common 接口）。

### 3.5 依赖共享组件 / 工具

- 未用 `CustomTable`（直接 antd `Table`）；`useHook` / `formatTimestamp` / `getServerSidePropsResult`（`libs`）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | 低 |
| 困难分数 | 1/5 |
| 主要难点 | ①源是半成品（筛选/下拉未接，需决策保持 vs 补全——选**保持**）；②GET 响应 `{list,total}` 与 managed-wallets `{rows,page}` 不同，model.ts 单独建模；③无分页参数（前端分页） |
| 建议负责人 | 初-中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/key-management/
├── data-access/src/lib/user-wallets/            # 新子目录
│   ├── user-wallets.model.ts                    # UserWalletItem + UserWalletListResponse { list, total }
│   ├── user-wallets.api.ts                      # getUserWallets() — GET 无参
│   ├── user-wallets.keys.ts                     # userWalletKeys
│   └── user-wallets.queries.ts                  # useUserWalletsQuery
├── data-access/src/index.ts                     # +barrel
├── feature/src/lib/user-wallets-list-page.tsx   # 列表页
├── feature/src/index.ts                         # +barrel
└── util/src/lib/constants.ts                    # +kycConfig {0:'No',1:'Yes'}（walletStatusMap 已有，复用）

（接入点）
apps/admin/.../[[...slug]]/module-page-registry.ts  # keyManagementPages +'user-wallets' loader（仅 list，无 detail）
apps/admin/.../[[...slug]]/page.tsx                 # keyManagementPageKeys +'user-wallets'
i18n messages/key-management.json                   # 无新 key（复用 PUB_* + token_type_*）
```

## 6. UI 组件映射

| 源组件（antd） | 目标替代 |
|----------------|----------|
| `Table` | `DataTable` |
| `Form` / `Form.Item` | `react-hook-form` + 原生 label |
| `Input` | `@myorg/shared/ui` `Input` |
| `Select`（空占位 All） | `FormSelect`（All value='all'，无实际 options） |
| `DatePicker.RangePicker` | 两个 `Input[type=date]` 降级 |
| `Tag`（status） | span badge（复用 util `walletStatusMap`） |
| `Card` | shadcn card（`rounded-lg border bg-card`） |

**枚举**：
- `statusConfig`(1/2/3) → **复用** util `walletStatusMap`（managed-wallets 已建）
- `kycConfig`(0=No/1=Yes) → util `constants.ts` **新增**

**i18n**：namespace `modules.key-management`；复用 `PUB_Query` / `PUB_Reset` / `PUB_NoData` + `token_type_*`（既有）。无新增 key。

## 7. 迁移步骤

1. **scaffold**（haiku）：`user-wallets/` data-access（model + api GET + keys + queries）+ util `kycConfig` + 两个 barrel。
2. **page**（opus）：`user-wallets-list-page.tsx`（8 筛选空占位 + 9 列 + 前端分页，忠实源行为）。
3. **接入**（haiku）：registry `user-wallets` loader + `page.tsx` keyManagementPageKeys + feature barrel + i18n（无新 key，确认）。
4. **verify**（opus）：lint/tsc + grep 运行时坑 + 路由 307 非 404。

## 8. 风险与注意事项

- **源是半成品（核心）**：筛选表单未接 API（源 index.tsx:83 TODO），下拉为空占位。迁移**忠实保持此行为**，不擅自补全筛选逻辑或下拉数据源。**后续优化**（非本次范围）：①筛选接 API 需后端 `/wallets/user/list` 支持查询参数；②Token/Blockchain 下拉可接 `useStablecoinOptionsQuery` / `useBlockchainOptionsQuery`（managed-wallets 已有）。
- **GET 响应 `{list,total}`**：与 managed-wallets `{rows,page:{pageNum}}` 不同，model.ts 单独建模；前端分页（DataTable pagination total，请求**无 pageNum**）。
- **无 detail**：registry 只注册 `user-wallets` list loader（不需 `user-wallets-detail`）；`page.tsx` keyManagementPageKeys 加 `user-wallets` 即可（modulePageKey 逻辑已支持）。
- **运行时坑**：All option value='all'（非空串）；i18n 无双重前缀；复用既有 `token_type_*`（仅 `_1` 存在，既有约束非本次引入）。

## 9. 验收标准

- [ ] 路由 `/key-management/user-wallets` 正常渲染（不再 Page Not Found）
- [ ] 9 列完整：Wallet Address / Service Provider Name / Token Name / Token Type / Key Service Name / Blockchain / KYC Required / Created on / Status
- [ ] Status badge（复用 walletStatusMap）+ KYC（kycConfig 0/1）+ Token Type（token_type_*）渲染正确
- [ ] 8 筛选字段 UI 存在（忠实源，下拉为 All 占位）
- [ ] 前端分页正常（DataTable pagination，total 来自响应）
- [ ] `pnpm nx lint key-management-*` 通过；admin tsc 不新增错误
- [ ] 运行时冒烟：页面挂载无 Runtime Error，路由 307 非 404（数据需后端返回）
