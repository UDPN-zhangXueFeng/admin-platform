# Wallet 模块迁移计划（td-manage → admin-platform）

> 源：`/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/wallet/*`（3 子模块 / 10 页 / ~6411 行 / ~40 endpoint）。
> 目标：`libs/modules/wallet/`（Nx 四层 util/data-access/ui/feature，**单一 wallet 库，三套路由入口**）。
> 完成定义：页面不报错（curl SSR 200 + 4 层 lint + app tsc 本模块零错）+ 功能完整（筛选/分页/详情/编辑/弹窗/抽屉 1:1 迁移）。
> 复用既定模式：[[coa-migration-status]] / [[journal-entries-new-migration]] / [[posting-engine-migration]]。

---

## 0. 拓扑决策（关键，与既有模块不同）

源 `wallet/` 下 3 子模块，源菜单为 `/wallet/<child>` 两段路径。**`configs/stablecoin.json` 已预置**：
- `"wallet"` 已在 `modules.enabled`（line 61）。
- `order` 数组已存在 `wallet` 父分组（line 178-203），3 子项 path 写死 `/wallet/wallet-type`、`/wallet/user-wallet`、`/wallet/operational-wallet`。

因此 **wallet 必须是「分组模块」**，类比 dispatcher 已有的 `sys` 分组（`apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx`）：`/wallet/wallet-type` → `module=wallet, slug[0]=wallet-type` → realModule=`wallet-type`。posting-engine 用的「顶层模块」路径在此不适用（nav 已写死两段路径）。

**dispatcher 改造（对称扩展 sys，surgical）**：把 `isSysGroup`（module==='sys'）泛化为分组集合，新增 `wallet`：
```ts
// 分组模块：第一段 slug 当子模块名，剩余 slug 透传。enabled key 见映射。
const GROUP_ENABLED_KEY: Record<string, string> = { sys: 'system', wallet: 'wallet' };
const groupKey = GROUP_ENABLED_KEY[module];              // undefined = 非分组
const isGroup = Boolean(groupKey);
const realModule = (isGroup && slug && slug.length > 0 ? slug[0] : module).toLowerCase();
const realSlug = isGroup ? (slug ? slug.slice(1) : []) : slug;
const isEnabled = isGroup
  ? config.modules.enabled.includes(groupKey)
  : config.modules.enabled.includes(module);
```
裸 `/wallet`（无 slug）→ realModule=`wallet` 无 registry 项 → "Page Not Found"（菜单不链接裸路径，同 sys 行为，可接受）。

**module-registry 注册 3 项**（均指向单一 wallet feature barrel）：
- `wallet-type`：pages `{ list, detail, edit }`（detail 按 slug[0] 分支 `view`/`mff-view`；edit 分支 `edit`/`mff-add`，见路由图）
- `user-wallet`：pages `{ list, detail }`（detail 按 slug[0] 分支 `view`/`history`）
- `operational-wallet`：pages `{ list, detail }`（detail = `view`）

**为什么单库而非 3 库**：3 子模块共享 common endpoint（stablecoin/blockchain/keystore/resources）、共享状态码映射族、共享加密 util；单库省 2/3 模板（~25 文件 vs ~60），data-access/util 集中。feature barrel 导出 3 个 manifest + 全部页组件，registry 3 项各自 import。

---

## 1. 源码地图（ condensed ）

### 路由图
```
/wallet/operational-wallet           index.tsx(250)   列表  → POST operational/wallet/list
  └→ /view?id={ruleWalletId}&walletAddress={..}        view.tsx(293)   3 tab(基本/交易/操作记录)
/wallet/user-wallet                  index.tsx(732)   列表 + 冻结/解冻/改类型 弹窗工作流
  ├→ /view?walletId=&tab={1..5|basic|transactions|operations|accrual|distribution}  view.tsx(867)  5 条件 tab
  └→ /history?walletId=              history.tsx(299) 2 tab(授权/已授权)
/wallet/wallet-type                  index.tsx(1177)  按 stablecoin 分组卡片网格 + 2 表 + 收益弹窗(余额→收益→派发)
  ├→ [issueType≠20] /edit?type=add|edit&id?&stablecoinId&name&symbol&issueType   edit.tsx(1242)  条件 利息/透支 表单
  ├→ [issueType≠20] /view?id=&stablecoinId&..                                    view.tsx(511)   Descriptions
  ├→ [issueType=20] /mff/mff-add?type=add|edit&id?&..                            mff-add.tsx(531) MMF 表单 + 生成钱包弹窗
  └→ [issueType=20] /mff/view?id=                                                mff/view.tsx(509) 2 tab + 股息抽屉
```
所有 detail 页面在 feature 层按 `useParams().slug[0]` 二次分支（避 useSearchParams 的 SSR Suspense 复杂度，posting-engine 已验证模式）。导航链接统一改为目标 module 顶层路径（如 `/user-wallet/view?walletId=`，去掉源 `/wallet/` 前缀的中段——因 dispatcher 会自动把 `/wallet/user-wallet/view` 解析为 module=user-wallet, slug=[view]）。

### API endpoint（base = `NEXT_PUBLIC_API_BASE_URL`，全路径原样保留；`apiClient` 自动解包 `{code,message,data}` 信封）

| 分组 | METHOD | 路径 | 用途 |
|---|---|---|---|
| common | GET | `/api/manage/v1/common/stablecoin/enabled/searches` | stablecoin 下拉（ow/uw/wt 共用） |
| common | GET | `/api/manage/v1/common/blockchain/list` | 区块链下拉 |
| common | GET | `/api/manage/v1/common/tokenType/list` | tokenType 下拉（uw） |
| common | POST | `/api/manage/v1/util/wallet/keystore` | 生成钱包（mff-add，body `{chainType:'evm', password(加密)}`） |
| common | POST | `/api/manage/v1/common/resources/search` | PDF 文档（wt-index，menuKey） |
| common | GET | `${NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=&busType=` | blob 下载（wt-index） |
| ow | POST | `/api/manage/v1/operational/wallet/list` | 列表 |
| ow | POST | `/api/manage/v1/operational/wallet/details` | 详情（body `{ruleWalletId}`） |
| ow | POST | `/api/manage/v1/operational/wallet/txList` | 交易记录 |
| ow | POST | `/api/manage/v1/operational/wallet/operatingRecord` | 操作记录 |
| uw | POST | `/api/manage/v1/user/wallet/list` | 列表 |
| uw | POST | `/api/manage/v1/user/wallet/details` | 详情 |
| uw | POST | `/api/manage/v1/user/wallet/txList` | 交易 |
| uw | POST | `/api/manage/v1/user/wallet/operatingRecord` | 操作 |
| uw | POST | `/api/manage/v1/user/wallet/accrualRecords` | 应计（tokenType=5） |
| uw | POST | `/api/manage/v1/user/wallet/distributeRecords` | 分配（tokenType=20） |
| uw | POST | `/api/manage/v1/user/wallet/authorizationRecord` | 授权记录 |
| uw | POST | `/api/manage/v1/user/wallet/authorizedRecord` | 已授权 |
| uw | POST | `/api/manage/v1/user/wallet/getAvailableWalletTypeList` | 可用类型（改类型弹窗） |
| uw | POST | `/api/manage/v1/user/wallet/funds/operate` | 冻结/解冻资金 `{type:6|7}` |
| uw | POST | `/api/manage/v1/user/wallet/operate` | 冻结/解冻钱包 `{type:2|3}` |
| uw | POST | `/api/manage/v1/user/wallet/changeWalletType` | 改类型 |
| wt | POST | `/api/manage/v1/wallet/type/head/list` | 卡片网格 `{stablecoinId}` |
| wt | POST | `/api/manage/v1/wallet/type/list` | 两张表 |
| wt | POST | `/api/manage/v1/wallet/type/update/status` | 启用/禁用 `{walletState:3|4}` |
| wt | POST | `/api/manage/v1/wallet/type/wallet/balance/calculate` | 余额 |
| wt | POST | `/api/manage/v1/wallet/type/earnings/calculate` | 每单位收益 |
| wt | POST | `/api/manage/v1/wallet/type/earnings/send` | 派发 |
| wt | POST | `/api/manage/v1/wallet/type/head/details` | 详情（edit/view/mff 共用） |
| wt | GET | `/api/manage/v1/wallet/type/accountTypeList` | 账户类型 `{stablecoinId}` |
| wt | POST | `/api/manage/v1/wallet/type/interestPolicy` | 利息策略 |
| wt | POST | `/api/manage/v1/wallet/type/add` | 新增常规 |
| wt | POST | `/api/manage/v1/wallet/type/update` | 编辑常规 |
| wt | POST | `/api/manage/v1/wallet/type/add/mmf` | 新增 MMF |
| wt | POST | `/api/manage/v1/wallet/type/update/mmf` | 编辑 MMF |
| wt | POST | `/api/manage/v1/wallet/type/accumulatedEarnings` | 累计收益（mff-view） |
| wt | POST | `/api/manage/v1/wallet/type/dividend/records/summary` | 股息汇总（抽屉） |
| wt | POST | `/api/manage/v1/wallet/type/dailyYieldList` | 每日收益表 |
| wt | POST | `/api/manage/v1/wallet/type/dividend/records/list` | 股息明细表 |

> 列表 endpoint 统一 body `{ data: filters, page: { pageNum, pageSize } }`，返回 `{ page, rows[] }`；详情/选项为 `{...}` 直返。行注入字符串 `id` 满足 DataTable `{id}` 契约（journal 模式）。

### 状态码映射族（多套，需在 util 统一）
- `approvalTaskStatus {1:processing,8/10:success,5/15:gray}` — operational-wallet 列表/详情。
- `commonapprovalTaskStatus {0:processing,1:success,2/3:gray}` — user-wallet 列表/详情。
- `walletTypeCardState {10:enabled(绿),15:disabled(红),else:processing(紫)}` — wt 卡片。
- `walletTypeStatus {1:processing,5:error,10/25:success,15/20:gray}` — wt 详情/表。
- `dailyStatus {1/5/20:orange,10/30:processing,15/40:error,35:success}` — mff 日收益/股息。
- 颜色复用 posting-engine 的 `toneClass` 思路；i18n label key 迁移到模块命名空间 `modules.wallet.status.*`。

### 业务热点（实现时重点）
1. **wt-index 卡片网格 + 收益弹窗三段流**：选 stablecoin（tab）→ 卡片网格（按 accountType 分组，`getGroup` 三三分组）→ 启用/禁用（`update/status`）→ 收益弹窗：日期→`balance/calculate` 回填 totalUnits→输 totalEarnings→`earnings/calculate` 回填每单位→`earnings/send` 提交。按 `issueType===20` 分流到 mff/*。
2. **wt-edit 条件表单（1242 行）**：accountType(1 活期透支 / 2 储蓄) × interestFeatureEnablement(1/2) × issueType(5 TD) 矩阵分支；利息策略下拉（阶梯 saveDetails vs 固定）；99999999999→-1 归一；keystore 密码 `getEncryptionData` 加密。
3. **mff-add 生成钱包**：`util/wallet/keystore` 回填 address/keystore/password。
4. **uw-view 5 条件 tab**：basic/transactions/operations 必显；accrual(tokenType=5)/distribute(tokenType=20) 条件显。tab key 别名解析（`resolveWalletViewTabKey`）。
5. **uw-index 弹窗工作流**：`modalInfo.key` 驱动动态表单（冻结资金/解冻资金/冻结钱包/解冻钱包/改类型），改类型需先 `getAvailableWalletTypeList`。
6. **权限**：源 `localStorage('userPermission')` + UUID `getLimt`。目标映射为 `useAuth().permissions` 字符串集（如 `wallet-type:edit`），空集→全放行（posting-engine 模式）。语义映射非 1:1 UUID。

---

## 2. UI 原语映射（源 → 目标）

| 源（td-manage, antd + libs/components） | 目标（admin-platform, shadcn/ui + RHF） |
|---|---|
| `CustomTable`/`useCustomTable`(SWR) | `DataTable`(`@myorg/shared/ui`, tanstack) + react-query query |
| `CustomForms`/`CustomModal`(antd) | RHF `useForm` + `FormField/FormSelect/FormDatePicker/InputNumber`(`@myorg/shared/ui-forms`) + shadcn `Dialog`(`@myorg/shared/ui`) |
| `CustomIBasicDetailsInfo` | 手写 kv 网格（posting-engine book-detail 模式：label/value 两列 grid） |
| `CustomBack` | `<Button variant="ghost" onClick={()=>router.back()}>` |
| antd `Tabs` | 目标 Tabs（实现期确认 `@myorg/shared/ui` 导出，否则用简单 state tab） |
| antd `Drawer` | shadcn `Sheet`/`Drawer`（实现期确认） |
| antd `Tag`(颜色) | `<span className="badge toneClass">`（posting-engine PostingStatusBadge 模式） |
| antd `DatePicker`/`TimePicker` | `FormDatePicker` / 原生（TimePicker 实现期处理） |
| `Typography.Paragraph copyable` | `CopyableEllipsisText`（journal 模式，book-detail 已用） |
| `getEncryptionData` | 移植到 util（keystore 密码加密，纯函数） |
| `formatTimestamp`/`getTimestamp` | util helper（dayjs，posting-engine `toMillis` 模式） |

---

## 3. 目标文件结构（libs/modules/wallet/）

```
util/
  project.json, jest.config.ts, src/index.ts
  src/lib/wallet.constants.ts        # 状态码族 meta+toneClass+labelKey、枚举映射、权限常量、ALL_VALUE/DEFAULT_PAGE_SIZE/EMPTY_DISPLAY、CUSTODY_MODEL_LABEL_MAP、issueType/accountType 常量
  src/lib/wallet.helpers.ts          # resolveWalletViewTabKey、toMillis、formatLimit(∞)、parseAccountLabel、getEncryptionData(移植)、normalizeRowId
data-access/
  project.json, jest.config.ts, src/index.ts
  src/lib/wallet.model.ts            # 全部 TS 类型（按子模块分节：operational/user/wallet-type/mff），行类型注入 id
  src/lib/wallet.api.ts              # 全部 ~40 endpoint（apiClient.post/get，全路径常量）
  src/lib/+queries/wallet.keys.ts    # queryKey 工厂（按子模块）
  src/lib/+queries/wallet.queries.ts # useXxxQuery/useXxxMutation（列表 keepPreviousData，详情 enabled，弹窗 mutation）
ui/
  project.json, jest.config.ts, src/index.ts
  src/lib/wallet-status-badge.tsx     # 通用状态 badge（接 meta+toneClass，多族复用）
  src/lib/wallet-detail-grid.tsx      # kv 详情网格（替代 CustomIBasicDetailsInfo）
  src/lib/(按需补 CopyableEllipsisText 复用 shared 或本地)
feature/
  project.json, jest.config.ts, src/index.ts (barrel: 3 manifest + 全部 page 组件)
  src/lib/module-manifests.ts         # walletTypeManifest / userWalletManifest / operationalWalletManifest
  # operational-wallet
  src/lib/operational-wallet-list-page.tsx
  src/lib/operational-wallet-detail-page.tsx   # slug[0]=view → 3 tab 详情
  # user-wallet
  src/lib/user-wallet-list-page.tsx            # + 冻结/解冻/改类型 弹窗
  src/lib/user-wallet-detail-page.tsx          # slug[0] 分支 view(5 tab)/history(2 tab)
  # wallet-type
  src/lib/wallet-type-list-page.tsx            # 卡片网格 + 2 表 + 收益弹窗
  src/lib/wallet-type-detail-page.tsx          # slug[0] 分支 view / mff-view
  src/lib/wallet-type-form-page.tsx            # slug[0] 分支 edit / mff-add
```

### 注册清单（机械，照 posting-engine 抄）
1. `libs/shared/util-config/src/lib/module-registry.ts`：加 `wallet-type`/`user-wallet`/`operational-wallet` 3 项（manifest + pages）。
2. `apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx`：dispatcher 分组泛化（见 §0）。
3. `tsconfig.base.json` + **`apps/admin/tsconfig.json`**（两处 paths 都加 `@myorg/modules/wallet/*`）。
4. `merge-messages.ts`：en+zh 静态 import `modules/wallet.json` + messageMap。
5. 新建 `libs/shared/util-i18n-messages/src/lib/{en-US,zh-CN}/modules/wallet.json`。
6. `configs/stablecoin.json`：wallet 分组 + enabled **已存在**（仅需确认，不改）。

---

## 4. 分阶段执行（loop 每轮一阶段；完成定义=页面不报错+功能完整）

- **Phase 0 ✅ 本文件**：源码地图 + 拓扑 + 路由 + endpoint + UI 映射。
- **Phase 1 骨架+注册**：四层 project.json/jest/index 桩；module-registry 3 项；dispatcher 分组泛化；双 tsconfig paths；merge-messages；en/zh modules/wallet.json 空桩；3 manifest；feature barrel 导出桩 page（占位文字）。**验证**：`nx lint`×4 + `tsc -p apps/admin` 本模块零错 + curl `/en-US/wallet/wallet-type`→200（渲染占位）。
- **Phase 2 util**：constants（状态码族 + 枚举 + 权限 + ALL/EMPTY/PAGE）+ helpers（tab 解析/toMillis/formatLimit/parseAccountLabel/getEncryptionData）。
- **Phase 3 data-access**：model 全类型（行注入 id）+ api 全 endpoint + keys + queries/mutations。
- **Phase 4 operational-wallet**：list（筛选 stablecoin/blockchain/accountType/feeType/state + 服务端分页 + Detail 操作）+ detail（3 tab：基本 kv + 交易表 + 操作记录表）。
- **Phase 5 user-wallet**：list（筛选 + 冻结/解冻/改类型弹窗工作流，5 mutation）+ detail 分支（view 5 条件 tab + history 2 tab）。
- **Phase 6 wallet-type list**：卡片网格（stablecoin tab 选择 + accountType 分组卡片 + 启用/禁用）+ 两张表 + 收益弹窗三段流（balance→earnings calc→send）+ PDF 下载。
- **Phase 7 wallet-type form**：edit（常规条件表单：限制归一/利息策略阶梯/透支分支/keystore 加密）+ mff-add（MMF 字段 + 生成钱包弹窗）。
- **Phase 8 wallet-type detail**：view（Descriptions 多块条件渲染）+ mff-view（2 tab + 股息抽屉 + 汇总）。
- **Phase 9 终验**：4 层 lint + app tsc 本模块零错 + curl 三模块主路由 + 各 detail/edit 路由全 200；功能完整性核对清单逐项打勾。

---

## 5. 验证硬限制（同 COA/journal/posting-engine）
- 浏览器 e2e 受 auth 限制（无真实 token → axios session-expired 分支 logout）。用**静态检查**（4 层 `pnpm nx lint` + `pnpm exec tsc -p apps/admin/tsconfig.json --noEmit`）+ **curl**（middleware 只查 cookie `admin_platform_token` 存在性，带任意值放行）验证 SSR 编译与路由命中。
- jest 不可行（shared/ui barrel 拖入 next-intl ESM）；util 纯函数可测但本轮不补单测。
- curl 期望：HTTP 200 + SSR 渲染出 i18n 文案；HTML 内 `next-error`/`Page Not Found` 是 Next 默认错误边界样板 CSS，非错误（需区分真实 Application error）。

## 6. 已知限制（诚实标注，非缺陷）
- 无后端/真实登录 → 无法验证 API 实际返回数据（auth 限制，同前序模块），SSR 降级为 loading/empty 不崩。
- 权限 UUID → 语义化字符串映射（非 1:1）。
- 源大量 i18n key（多命名空间）→ 收敛到 `modules/wallet.*`，措辞合理即可（不必逐键同名）。
- mff-add 的 `TimePicker`（dailyStatisticalTime `HH:mm:ss`）按目标控件能力实现，必要时降级。
- PDF 下载（sftp/download blob）依赖 `NEXT_PUBLIC_FILE_ID`，环境无配置时降级为不可用按钮（不崩）。
