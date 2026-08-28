# Codex 对话沉淀

## 2026-08-28 kissen-gateway 品牌主题系统接入（jade/plum/bronze）

1. **三主题家族定稿**：jade(165°, 默认, #0B6B53=DEFAULT_BRAND.primaryColor)/plum(286°)/bronze(27°)——gateway 自有绿系品牌 + 两个此前三项目均未占用的家族。初稿 sapphire(224° 蓝系)被否：admin 已整占蓝系（azure 210/midnight 222/cobalt 220），「配色不复制」要按家族维度避让，不是逐 hex 比对。每主题 18 键（2 tailwind + 2 brand + 3 login-grad + 5 banner + 6 illus；conventions 里「19 键」是笔误，LP 实际 18）。
2. **BrandProvider 内联覆盖会压垮主题块**：gateway 存量 BrandProvider（源 MainLayout 品牌 API 驱动）用 `root.style.setProperty('--primary')` 注入，documentElement 内联样式优先级高于任何 `[data-theme]` CSS 块——主题系统接入时必须给这类运行时注入加让位条件（`documentElement.dataset.theme` 存在即让位，防闪脚本在 themes 非空时首帧前必写该属性，可作开关）。源语义变量（--ks-clearing/--el-color-primary）保留不动。
3. **品牌 API 主色与主题并存口径**：登录页 Sign In 按钮原 `style={{backgroundColor: brand.primaryColor}}` 改 `bg-primary`（跟随主题）；品牌名/副标题仍 API 驱动。dev 环境真实后端 /bankgw/brand 返回 #1E4D8C（海军蓝），证明让位逻辑必要——否则切主题主色纹丝不动。
4. 验证：tsc/build/lint 清零；实测 jade→plum→bronze 切换（下拉键盘路径，Radix 点击偶发不开是 admin 期已知坑）、防闪（domcontentloaded 时 data-theme 已就位）、localStorage['gw-theme'] 持久化、内联 LogoMark fill 跟随、--primary/--brand-deep/--login-grad-* 联动、BrandProvider 让位（--ks-clearing=#1E4D8C 而 --primary=jade）。截图 `.doc/kissen/project/gateway/verify/theme/`。

## 目的

本文件用于记录每次与 Codex 协作后沉淀出的可复用经验，包括：

- 新学到的项目事实
- 新增或调整的工程规范
- 反复出现的问题规律
- 已确认的实现偏好
- 后续处理同类任务时应优先检查的路径或命令

这里不记录一次性聊天过程，也不替代 `pro.md` 和 `rule.md`：

- 项目结构、目录职责、技术栈事实更新到 `pro.md`
- 代码设计、命名、lint、测试等规范更新到 `rule.md`
- 对话中总结出的经验、规律、踩坑记录更新到本文档

## 记录格式

按时间倒序追加记录。每条记录建议包含：

```text
## YYYY-MM-DD

- 背景：
- 结论：
- 影响：
- 后续同类任务：
```

## 2026-08-26

- 背景：kissen-gateway-portal 迭代重评估。参考快照 `~/Downloads/临时（可删除）/kissen-bank-gateway-frontend-main`（Vue 3.5 独立仓，无 git 历史）× monorepo `apps/kissen-gateway-portal` × 详设 v1.7 三方对照（scout 双盘点 + 人工核验）。
- 结论：(1) **功能迁移等价度 ~100%**：9 页面/34 接口/全部枚举（TX 13 态、onboard 5/15/20、menuType 0-4）逐项一致，代码内「源 xxx」注释是移植对齐纪律的痕迹。(2) 真实差距在工程不在功能：portal 无 Dockerfile、`docker-compose.kissen.yml` 只构建 kissen-admin（P0）；文案英文硬编码未资源化（P1）；交易导出与 menu-permission UI 双侧未实现（P0/P1）。(3) **规划漂移**：plan 06 Step9 的 6 库拆分从未执行（实际单聚合库 `kissen-gateway/{feature,data-access}`），plan 08 filter-repo 路径清单全部过期——裁定接受现状回写计划，不补拆。(4) 后端契约口径以参考项目为准：`GET /menu/tree`（详设写 POST）、信封 `code:'0'` 字符串 + 自定义 `token` 头（admin 数字 code 不同构）、入网开关纯靠后端差异化 menuKeys（bankStatus 字段不存在）、交易链路=本地 `/tx/messages` 报文（无 /tx/chain 代理）。
- 影响：新增 `.doc/kissen/project/kissen-bank-gateway-frontend/迭代需求重评估--v1.0-2026-08-26.md` 与 `.doc/kissen/project/kissen-gateway-portal/迁移工程重评估--v1.0-2026-08-26.md`（文档开始按实施项目分子目录存放）。两个易误判点已澄清：**middleware 强制 en-US 是有意决策**（middleware.ts:8-12 注释明确拒绝 Accept-Language 协商），i18n 债指「文案未资源化」而非「zh-CN 不可达」；**indigo 主题是有意分歧**（提交 5b2be93），参考项目 M19 常青绿私行风不迁移。
- 后续同类任务：(a) scout 盘点给出的 gap 候选必须人工核验后才能写进文档——本轮 8 条候选中 3 条（log traceId 列、roleType 内置禁删、超管徽标）实际已存在，直接采信会误报。(b) 无 git 历史的参考项目无法做版本 diff，评估方法=「参考当前态 × 实施当前态 × 设计基线」三方对照，须在文档中声明此局限。(c) portal 容器化照 kissen-admin Dockerfile 模式（NX_PROJECT_ID=kissen-gateway、NEXT_PUBLIC_API_BASE_URL=/kissen-api/bankgw/portal），但 nginx 语义不同：admin 走 `/v1/` 前缀保留，portal 依赖 Next rewrites 剥 `/kissen-api` 前缀（standalone Node 服务内生效），nginx 只需 `/` 透传。

## 2026-08-07

- 背景：校验 key-management 模块迁移完整性（5 子模块：key-service-configuration / key-policy-configuration / key-signed-transactions / managed-wallets / user-wallets），对照旧项目 td-manage。scout 基线审计发现整体约 78%：最大缺口在 key-service-configuration（仅约 20%——detail/edit/configure 三页全缺、list 缺操作列与停用弹窗）和 key-signed-transactions（5 个 API 缺 /api 前缀、detail 方法 GET 应 POST、detail 路由未注册、list 无详情导航）；managed-wallets 约 95%、user-wallets 与 key-policy-configuration 约 100%。经「scout 审计 → 缺口清单 → 并行补齐（KSC 全套 + key-signed 修复，无文件重叠）→ opus 子 agent 逐字段对照旧源校验 → 残留清单 → 补齐 → 重校」循环，最终逐字段 100%、0 残留。
- 结论：(1) **API /api 前缀与方法**：key-signed 5 个端点（signedTransactions / signedTransactionDetail / keyServices / common stablecoin / blockchain）迁移时漏掉 `/api` 前缀且 detail 误用 GET，后端 404/405。修复：全部补 `/api`、detail 改 POST `{txRecordId}`（与 2026-08-06 screening、2026-08-04 cross-chain 同批 common 接口 GET/POST 误用规律一致——迁移者系统性把 td-manage `useSWR([url])` 单元素 GET 误写成 POST，且漏 /api 前缀）。(2) **KSC data-access**：detail POST `/api/manage/v1/key/config/detail {keyServiceCode}`、operationRecords POST `/api/manage/v1/key/config/operationRecords {data:{keyServiceCode,operationType?},page:{pageNum,pageSize}}`、listKeyService POST（配置页用，旧 V1.ts:3422）。(3) **KSC 三页**：detail（双 Tab——Basic Info 三卡 9 字段+Access Parameters 表+Supported Chains 表 / Operation Records operationType 筛选+分页表）；edit/configure（共享 3 区块表单：Key Service name+Wallet Attribute hot/cold 复选+条件 Wallet Group ID+Access Configuration url 必填+动态 Parameters 行+3 链，用 mode prop 复用 RHF+zod superRefine）；list 改造（Configure 按钮+状态驱动操作列 Edit/Deprecate/Resubmit/Details+Deprecate 弹窗 comments 必填 max200+supportedChains 「>2 显 +N」折叠）。(4) **路由**：module-page-registry 注册 key-service-configuration-{detail,edit,configure}+key-signed-transactions-detail 四个 loader；page.tsx 补 `if (sub === 'configure') return ${mapped}-configure` 分支（之前 /configure 落 fallback 到 list）。
- 影响（3 个可复用沉淀）：(1) **新 lint 踩坑**：补齐代码写了 `// eslint-disable-next-line react-hooks/exhaustive-deps`，但本项目 ESLint **未注册 react-hooks 插件**，引用未定义规则直接报 error（"Definition for rule 'react-hooks/exhaustive-deps' was not found"），4 处 disable 注释导致 feature lint 失败。修复=删除注释（规则未启用，注释多余且报错）。(2) **antd RangePicker 迁移约定（重要，全仓库统一）**：旧 td-manage 用 antd Form `RangePicker`（name `xxxStart-xxxEnd` 透传，后端拆 `xxxStart`/`xxxEnd` 两字段）。新项目统一：用**两个** FormDatePicker（RHF 场景）或 DatePicker（受控场景），value 为 `YYYY-MM-DD` 字符串；filters/submit 时用 `startOfDay(parseISO(x)).getTime()`（起）/ `endOfDay(parseISO(x)).getTime()`（止）转 number 时间戳，字段名保持 `xxxStart`/`xxxEnd`。范本 cross-chain-transactions-list-page.tsx formToFilters:101-120；blockchain/audit-trail/interest/journal-entries/chart-of-accounts 全部如此。本轮 KSC list 创建时间筛选（startCreateDate/endCreateDate）按此补齐。(3) **表单模式冲突（surface，未统一）**：KSC list 主筛选用 useState 受控（补齐 agent 选择），而项目主流 list 页（cross-chain 等）用 RHF+FormDatePicker+handleSubmit。本轮补 date 时保持 useState 一致（surgical，不重构 agent 已有结构），但这是仓库内两套表单模式并存，后续统一表单模式时 KSC list 是待收敛点。
- 后续同类任务：(a) 校验迁移模块不能只看「文件存在」，必须对照旧源逐字段逐操作（detail 字段/操作列按钮/弹窗/路由 slug→pageKey→loader 链路）；scout 审计+opus 逐字段校验+残留补齐+重校循环已验证有效。(b) 写 useMemo/useEffect 的 eslint-disable 注释前先确认规则已注册（本项目无 react-hooks 规则），否则 lint 报 "Definition for rule not found" error。(c) 迁移含日期范围筛选的列表，按 RangePicker→FormDatePicker×2/DatePicker×2 + date-fns startOfDay/endOfDay/parseISO 转 number 约定补齐，字段拆 xxxStart/xxxEnd。(d) detail 页的显式 Query 按钮可被 RHF watch() 自动查询替代（功能超集），属合理改进非缺失。(e) KSC list 的 useState 受控表单是已知偏差，统一表单模式时优先改它对齐 RHF。

## 2026-08-06
- 背景：校验 screening-monitoring 模块（`/screening-monitoring/<child>`，3 子模块：rule / transaction-monitoring / screening-providers）。四库 lint 通过（util-config 47 个 `@nx/enforce-module-boundaries` 错误是预存架构债，见下）、ui 无测试文件、`nx build admin` 通过（105s）。逐文件对照 td-manage 源（`src/pages/screening-monitoring/**` + `src/lib/api/screening-monitoring.ts`）发现 2 个问题。
- 结论：(1) **API 方法**：`fetchStablecoinOptions`（`/common/stablecoin/enabled/searches`）和 `fetchBlockchainOptions`（`/common/blockchain/list`）误写成 POST——td-manage 用 `useSWR([url])` 单元素即 GET（与 cross-chain 完全相同的两个 common 下拉 URL，同一迁移者同一批错误）。修复：改 `apiClient.get`。其余 14 个端点（list/detail/operate/save/edit/suspicious 系列 + `business/type/unit`）方法均正确（POST）。(2) **路由 pageKey 漏注册**：td-manage rule list 页有两个"新建"按钮——`Add` → `/rule/edit`（自定义规则）、`Add1` → `/rule/t_edit`（第三方规则增强版，1398 行静态原型页）。admin 镜像了这两个按钮，但 catch-all 路由的 `pageKey` 解析只识别 `create/edit/mff/onboard`，`t_edit` 落到 fallback `'detail'` → 加载 `RuleDetailPage` 而非 `RuleTEditPage`，第三方规则新建页永远无法渲染。修复：page.tsx 加 `if (realSlug[0] === 't_edit') return 't_edit'`（onboard 同模式），module-registry.ts 注册 `rule.pages.t_edit` → `RuleTEditPage`。
- 影响：t_edit bug 属于**迁移盲区**——页面组件已迁移（`rule-t-edit-page.tsx` 完整 133 行）、feature index 已导出（`RuleTEditPage`）、list 按钮已镜像，唯独 catch-all 路由解析未覆盖该 slug，导致组件虽存在却永不挂载。这种"组件齐全但路由断链"比"组件缺失"更隐蔽：lint/test/build 全绿，静态审查页面文件也发现不了，只有追到 `pageKey` 的 fallback 分支才暴露。校验新模块时不能只看 registry/pages 文件存在性，必须追踪**每个导航入口的 slug → pageKey → loader** 完整链路。其余维度均无问题：3 group 路由解析（`GROUP_ENABLED_KEY['screening-monitoring']`）、ID 用 searchParams query string、i18n 95+30 键 en/zh 对齐、9 个 UUID 权限码、菜单 3 子项 path 与 registry 一致、mutations 全在事件处理器中。
- 后续同类任务：(a) **非标准路由词排查**：td-manage 页面 slug 不一定是 `index/view/edit`，可能有 `t_edit`、`onboard`、`mff` 等业务命名。校验每个 list 页的"新建"按钮 `routerPush/onClick` 目标 slug，确认该 slug 在 catch-all `pageKey` 解析里有显式分支（非 fallback detail）。对照清单：page.tsx 当前识别 `create/edit/mff/onboard/t_edit` + 单段为 detail。(b) **common 下拉 GET/POST 是高频迁移错误**：这是第二次发现（cross-chain 5 个 + screening 2 个 = 7 个），同一批 common 接口（`stablecoin/enabled/searches`、`blockchain/list`、`business/type/unit` 注意 unit 是 POST）。校验新模块时直接 grep `apiClient.post.*common` 快速定位疑似错误。(c) `module-registry.ts` 的 `@nx/enforce-module-boundaries` 违规是已知架构妥协——中央注册表必须 import 所有 `@myorg/modules/*`，scope:shared 边界不适用，不阻塞 build，勿当本次回归。


- 背景：校验 cross-chain 模块（`/cross-chain/<child>`，5 子模块：cross-chain-transactions / fx-rate / liquidity-pool / rd-bridge / token-pair）。四库 lint 通过、ui test 33 个通过、`nx build admin` 通过。逐文件对照 td-manage 源（`src/lib/api/cross-chain.ts` + 各页面 `useSWR([url])`）发现 5 个公共下拉接口 HTTP 方法错误。
- 结论：td-manage 全局 fetcher（`src/lib/axios.ts:156`）签名 `([url, param?])`，单元素数组 `[url]` → `method: GET`，双元素 `[url, payload]` → `method: POST`。cross-chain 的 5 个下拉（`getCommonBlockchainList` / `getCommonBlockchainEnableList` / `getStablecoinSearches` / `getLiquidityPoolTokenList` / `getSendTokenList`）在 td-manage 均用 `useSWR([url])` 即 GET，迁移版却写成 `apiClient.post(url, {}, config)`。注意区分：`getRdBridgeBlockchainList`（`getBlockChainListApi`）和 `getRdBridgeAllUserEmailList`（`getAllUserEmailListApi`）在 td-manage 是显式 `request(url,{method:'POST',data})`，迁移版保持 POST 正确。修复：5 个下拉改 `apiClient.get(url, config)`（commit 待提）。
- 影响：这是**仓库内一致性破坏**——同接口 `getStablecoinSearches` / `getCommonBlockchainList` 在 blockchain / mmf / journal-entries / audit-trail 全部用 GET，唯独 cross-chain 用 POST（Rule 7 两套并存）。后端当前对 GET/POST 都返回 200（curl 实测），所以不会 405、功能"看似"可用，但违反 td-manage 源契约与全仓库约定，且一旦后端收紧方法校验（如 blockchain `nodeLocation` 之前报 405）就会暴露。校验时其余维度均无问题：group 路由解析（`realModule=slug[0]`、pageKey 落 detail）、searchParams 取 ID、reSet 数字防御（`Number(value)`）、mutations 解构稳定引用、i18n 208 键 en/zh 完全对齐、18 个 UUID 权限码、菜单 5 子项 path 与 registry 一致。
- 后续同类任务：(a) 校验迁移模块的 API 层时，**必须对照 td-manage 源的 fetcher 语义**——`useSWR([url])` 单元素是 GET，`useSWR([url, payload])` 双元素是 POST；td-manage 显式 `request(url, {method})` 以 method 字段为准。不能只看 URL 猜方法。(b) 公共下拉接口（common/* 域、各模块 new/*List 域）在本仓库统一约定为 GET，blockchain/mmf/journal-entries 是范本；发现某模块用 POST 时优先怀疑迁移错误而非后端要求。(c) 后端对方法宽容（GET/POST 都 200）不代表方法正确——以源码契约为准，curl 只用于确认接口可达性，不能替代契约一致性判断。

## 2026-08-04

- 背景：approval-manage（侧栏菜单 "Workflow Tasks"，`/approval-manage`）三 Tab 列表的 actions 列全部显示 `--`，而旧项目 td-manage 同页有 Detail / Withdraw 按钮。
- 结论：后端 `useAuth().permissions` 下发的是旧 td-manage 的 **UUID** 权限码（Detail `82536c63366b40a586774192751e7060`、Withdrawal `5f1c684ec8374caf9a8d5e4b1f26796a`）。迁移时 `APPROVAL_PERMISSIONS` 被误改成自造语义串 `'approval-manage:view'/'approval-manage:withdraw'`，list-page 的 `canView/canWithdraw` 用 `.has(语义串)` 永不命中 → 恒为 false → cell 回退 `EMPTY_FIELD_VALUE('--')`，三 Tab 所有按钮消失。修复：常量改回真实 UUID，list-page 引用常量（`027b1c2`）。
- 影响：仓库存在**两套并存权限体系，不可混淆**——(1) 模块级 `module-manifest.ts` 的 `permissions` 字段用**语义码**（`'order:read'`、`'role:read'`，符合 `module.model.ts` 注释示例，决定路由/菜单可见性，几乎所有模块如此）；(2) 按钮级 `PermissionGuard` / `useAuth().permissions.has()` 必须用**后端 UUID**（决定行内按钮可见性，journal-entries `df7766...`、posting-engine、reconciliation `RECONCILIATION_PERMISSIONS`、cross-chain/blockchain/mmf/pledge/product 全部如此，`role.constants.ts` 注释佐证）。迁移按钮权限务必从旧 `useCustomTable` 的 `actions[].limit` 取真实 UUID，不能"语义化"。
- 后续同类任务：迁移含行级按钮权限的列表页时，对照旧页 `actions[].limit`（UUID）原样落到模块 util 的 `*_PERMISSIONS` 常量；若列表按钮全部隐藏或变占位符，优先查 `canView`/`PermissionGuard` 的权限码是否与后端下发格式（UUID）匹配，而非怀疑 DataTable 列定义。

- 背景：MMF 模块（`/mmf/accrual` + `/mmf/settlement`，各 list + detail + batch-apply modal）迁移后浏览器测试发现 3 个 runtime bug：(1) accrual 列表页 `value.toFixed is not a function` 崩溃；(2) accrual/settlement 详情页只显示标题、无数据；(3) Batch Apply 弹窗触发 `Maximum update depth exceeded` + 后端 429 Too Many Requests。
- 结论（3 个独立根因）：
  (1) **reSet 数字格式化函数**：后端返回的数值字段（`accrualUnits`、`totalWalletBalance` 等）实际类型是 **string** 而非 model 声明的 number。td-manage 源 `reSet` 接受 `any` 并用 `.toString()` 处理；迁移版假设 number 直接 `.toFixed(2)` → string 上调用崩溃。修复：`Number(value).toFixed(2)` + 放宽类型到 `string | number | undefined | null`。5 个文件各有一份 reSet 副本（accrual-apply-modal / accrual-detail-page / accrual-list-page / settlement-detail-page / settlement-list-page），全部同步修复。
  (2) **catch-all 路由 ID 提取**：App Router 动态路由 `[locale]/(app)/[module]/[[...slug]]` 的 `useParams()` 返回 `{locale, module, slug}`，**没有** `id` 字段。MMF 是 group 路由（`module=mmf`，`slug[0]` = 子模块名 "accrual"/"settlement"，`slug[1]` = 业务 ID）。两个 detail 页错误地用 `useParams<{id?: string}>()` → `params.id` 恒为 undefined → `hasId=false` → 只渲染空壳占位。修复：改为 `useParams<{slug?: string[]}>()` → `params.slug?.[1]`。其他模块（posting-engine、statements、wallet）已正确使用 slug 数组或 searchParams 取 ID。
  (3) **React Query mutation 对象稳定性**：`useBatchApplyListMutation()` 返回的对象**每次 render 都是新引用**。原代码 `useCallback(fn, [batchListMutation])` → doQuery 每次 render 重建 → `useEffect(..., [open, defaultRuleId, reset, doQuery])` 无限重跑 → `batchListMutation.mutate()` 循环调用 → 后端 429 + React Maximum update depth。修复：从 mutation 解构 `const { data, mutate, isPending } = useBatchApplyListMutation()`，`useCallback(fn, [batchMutate])`（React Query 保证 `mutate` 引用稳定）。此 bug 此前被 reSet crash 遮蔽——列表页渲染就崩了，根本到不了 modal。
- 影响：commit `3c026f0`。所有 4 个 MMF 页面（accrual list/detail、settlement list/detail）+ batch-apply modal 浏览器验证零 runtime error，`nx build admin` 通过。
- 后续同类任务：(a) 迁移数字格式化函数时，后端返回的数值字段可能是 string——始终用 `Number(value)` 做防御转换，不能信任 model 类型标注。(b) catch-all 路由 `[[...slug]]` 下，detail 页的 ID 在 `slug` 数组中——group 路由（mmf/wallet/sys 等）是 `slug[1]`，非 group 路由是 `slug[0]`。检查 detail 页是否用 `useParams<{id?: string}>()` 是快速排查"详情页空白"的方法。(c) React Query `useMutation` 返回对象不稳定——在 `useCallback`/`useEffect` 依赖中使用时必须解构出 `mutate`（稳定引用），不能直接依赖整个 mutation 对象。

## 2026-07-23

- 背景：approval-manage 三列表（queryTodoList/queryCompletedList/queryCreateList）运行时空表 "No data"，但旧系统 td-manage 同页有 7 行数据。根因不是前端渲染或权限，而是 `apps/admin/.env.local` **漏设 `NEXT_PUBLIC_CONFIG_ID`**。该变量在 `approval-manage.api.ts` 用于动态拼 URL：`TODO_LIST_URL = ${CONFIG_ID}v1/task/queryTodoList`，`CONFIG_ID = process.env.NEXT_PUBLIC_CONFIG_ID ?? ''`。缺失时 URL 退化为 `v1/task/queryTodoList`（无前缀），axios baseURL=/aps 合并后请求 `/aps/v1/task/queryTodoList`，经 Next.js rewrite 代理到 `http://10.0.48.123:30001/v1/task/queryTodoList`，后端无此路径 → 404 → query 失败 → 空表。
- 结论：迁移 td-manage 时必须把 `.env` 的公共前缀变量同步到 `apps/admin/.env.local`。旧 `.env` 生效值：`NEXT_PUBLIC_AGENT_ID=/aps`（axios baseURL，新项目改名 `NEXT_PUBLIC_API_BASE_URL=/aps`）、`NEXT_PUBLIC_CONFIG_ID=/api/base/`（task/workflow/common 动态 URL 前缀）、`NEXT_PUBLIC_MESSAGE_ID=/api/base/`、`NEXT_PUBLIC_FILE_ID=/api/base/`、`NEXT_SERVICE_SERVER_URL=http://10.0.48.120:30001/`（新项目用 48.123）。`CONFIG_ID` 是完整路径段前缀，axios 对相对路径合并 baseURL，行为与旧 `request(...)` 一致。
- 影响：`.env.local` 已补 `NEXT_PUBLIC_CONFIG_ID=/api/base/`。验证（curl POST，无 token）：修复前路径 `/aps/v1/task/queryTodoList` → `404 {"path":"/v1/task/queryTodoList","error":"Not Found"}`；修复后路径 `/aps/api/base/v1/task/queryTodoList` → `200 {"code":3,"message":"MSG_00_0004"}`。`code:3` 是后端"会话未认证"（axios-client.ts 响应拦截器对 code 3/4 触发登录重定向），不是"无数据"——用户带 session token 请求将得 `code:0` + 列表。
- 后续：若其他模块列表也空，优先查是否缺 `MESSAGE_ID`/`FILE_ID` 等同类前缀变量。注意新系统后端 `10.0.48.123` 与旧 `10.0.48.120` 不同 IP——若修复 CONFIG_ID 后某模块仍无数据，可能是后端环境数据差异，需对齐 `.env.local` 的 `NEXT_SERVICE_SERVER_URL`。`NEXT_PUBLIC_*` 变量在进程启动时内联，改 env 必须重启 dev（`hub restart admin-dev`），HMR 不够。

## 2026-07-23

- 背景：侧栏菜单 label 已改为 "Workflow Tasks"，但 approval-manage 模块页面内部仍是 "Approval Manage"（面包屑）和 "Approval Management"（section 标题、manifest name），面向用户的模块名三个来源不同步。
- 结论：模块显示名有三个独立来源——`config.modules.order[].label`（侧栏菜单）、i18n `modules.<id>.title` / `list.title`（页面 section 标题，locale-aware）、`module-manifest` 的 `name`/`routes[].label`（模块元数据）。重命名模块面向用户的名字时三层都要同步。本次把 approval-manage 的 i18n（en `Workflow Tasks` / zh `工作流任务`）和 manifest name/label 改为 Workflow Tasks。
- 影响：关键架构改进——`breadcrumb.tsx` 原本 `humanize(segment)` 全靠 URL slug 推导（`approval-manage`→`Approval Manage`），导致面包屑与侧栏菜单不同步。现改为第一段（module）查 `config.modules.order` 的 label，其余段继续 humanize。这样面包屑与侧栏菜单同源（config order label）；`ModuleMenuItem.label` 是必填字段，所以 `?.label ?? humanize` 的 fallback 实际不会触发。id/path/registry 不变时，模块改名只需改 config label（菜单+面包屑）+ i18n（页面标题）。
- 后续同类任务：模块重命名/对齐文案时，依次检查 config order label、i18n title/list.title、manifest name 三层；面包屑自本次起与 config order 同源，不再单独维护。注意 config label 是单语字面量（无 locale 查找），zh-CN 下侧栏与面包屑仍显示该字面量；若需 locale-aware 菜单名，需改 config label 机制（当前未做）。

## 2026-07-23

- 背景：`stablecoin.json` 的 `modules.order` 同时存在顶级 `workflow`（label "Workflow Tasks"，无 path）与 `approval-manage`（label "Approval Manage"，path `/approval-manage`）两条菜单，实际承载的都是旧项目 `/approval-manage` 审批待办中心（Pending/Actioned/Sent）。旧项目侧栏该项显示 "Workflow Tasks"，新项目却显示 "Approval Manage"，且顶级 `workflow` 占位项点击后进入的是 sys-workflow 管理员配置页而非待办。
- 结论：审批待办中心的路由/registry 标识保留 `approval-manage`（`module-registry.ts` 的 `'approval-manage'` key + `libs/modules/approval-manage`，path `/approval-manage`），但菜单 label 必须用业务名 "Workflow Tasks"。删除顶级 `workflow` 占位项及其 `modules.enabled` 条目，把 `approval-manage` 项移到主区第二位（Dashboard 之后，`group: ""`）并改 label 为 "Workflow Tasks"。id/path/registry 不动。
- 影响：关键陷阱 —— `libs/shared/ui-layout/.../sidebar-layout.tsx:46` 的 path 回退规则 `mod.path ?? \`/${mod.id}\`` 会把无 path 的占位菜单变成可点击链接。顶级 `workflow` 占位项因此被补成 `/workflow`，点击命中 registry `workflow` key（= `libs/modules/workflow`，即 sys-workflow 管理员配置页 `/sys/workflow`），而非审批待办。registry key `workflow` 已被 sys-workflow 占用，不能再用于审批待办占位。
- 后续同类任务：调整侧栏菜单时区分三层——菜单 order（显示）、`modules.enabled`（白名单）、`module-registry` key（路由解析）。无 path 的 order 项不是"死占位"，会被回退成 `/{id}` 并尝试匹配同名 registry key；占位项要么给明确 path，要么彻底删除（含 enabled）。业务名（菜单 label）与路由名（id/path/registry key）分离时，label 对齐旧项目用户可见名，id/path 保持与 registry 一致；同名 registry key（如 `workflow`）被多个语义复用时尤其要核对路由回退结果。

## 2026-07-22

- 背景：Tokenized Deposit 概览卡从旧系统迁移后，左栏仅保留 `bg-cover` 而没有背景，白色文本在浅色页面不可见；右栏统计图标仍是空色块。
- 结论：概览卡使用 `--banner-*` 主题变量构成局部 SVG 渐变动效，不复用旧系统 176 KB 位图；统计字段按 `valueKey` 映射至既有 `lucide-react` 图标和局部类别色。布局以 `lg` 为双栏边界，避免在 768px 过早横排，并由内容决定卡片高度；信息项使用 `dl/dt/dd` 和稳定 key，统计使用 `valueKey` 作为 key。SVG 沿用 Header 的低频动画类，并通过 `prefers-reduced-motion` 全局降级。
- 影响：Tokenized Deposit 的真实数据、储备区显示条件和质押/非质押统计分支不变；浅色、深色和窄屏均不依赖缺失静态资源，减少动效偏好下不会播放背景动画。
- 后续同类任务：迁移旧系统卡片时先确认背景和图标资源是否已进入当前仓库；资源缺失时优先使用现有 CSS 主题变量与已安装图标库，不以透明/空色块作为长期占位。为展示分支补测试时覆盖 `0` 值、条件区块和条目数量，不测试 Tailwind 实现细节。

## 2026-07-22

- 背景：Tokenized Deposit 概览页的部署历史接口在当前 token 没有记录时返回空数组，TanStack Query 随后报 `Query data cannot be undefined`。
- 结论：TanStack Query 的 `queryFn` 不能以 `undefined` 表示成功但无数据。可选单对象查询统一将空数组、`null` 或缺失响应归一化为 `null`；列表归一化为空数组。`useContractDeployHistoryQuery` 仅在部署历史弹窗打开后启用，避免概览加载阶段预取非必要数据。
- 影响：Tokenized Deposit data-access 中部署历史、部署步骤、Financial Book 和 mock 角色钱包详情的 query 契约均已移除 `undefined` 成功结果，并有 QueryClient 回归测试覆盖空部署历史/步骤不会进入 error 状态。
- 后续同类任务：新增或迁移 TanStack Query 时，先确认 queryFn 的成功返回值在所有分支均为非 `undefined`；详情无数据建模为 `null`，并为允许为空的接口补充“查询保持 success + 空值”的测试。

## 2026-07-22

- 背景：检查管理后台当前 TypeScript 类型是否满足生产构建标准。
- 结论：`npx nx build admin` 已通过 Webpack、Next TypeScript 检查、静态页面生成和构建收尾，exit code 为 0；因此 `apps/admin` 的真实生产构建类型门禁当前通过。独立执行 `npx tsc -b` 仍失败，主要集中在库级 project references 未完整声明、缺少 `baseUrl`、共享库 `lib` 仍为 `es2022` 与 `Intl.NumberFormat` 的 `roundingMode` 不匹配等工程配置问题。
- 影响：后续报告类型检查时必须区分 Next app build 与 workspace-wide `tsc -b`：前者当前可作为应用发布门禁，后者不能宣称通过；`libs/shared/util-formatting` 的 `roundingMode` 和各库 project reference 应作为独立工程债务处理。
- 后续同类任务：先运行 `npx nx build admin` 判断实际发布链路，再运行 `npx tsc -b` 检查库级声明/引用完整性；不要把 `TS6059/TS6307/TS6305` 的 project reference 级联错误直接等同于应用业务类型错误。

## 2026-07-21

- 背景：Dashboard 的 Token Management 选择器同时展示 Stablecoin、Tokenized Deposit 与 Tokenized MMF，原先仅支持链名称与关键字筛选。
- 结论：`TokenSelector` 使用 `S`、`TD`、`M` 映射的第一层 Token Type 筛选（默认 All），链名称保留为第二层；Token Type、链与关键字取交集，筛选操作不得隐式改变当前 Dashboard 的选中 Token。
- 影响：新增 Token Type 文案必须同步维护 `en-US`、`zh-CN` Dashboard 消息；三类资产共存时选择器标题应使用 Token Management，而不是 Stablecoin。
- 后续同类任务：扩展 Token 筛选维度时优先在 `modules-tokenized-deposit/ui` 的通用选择器实现，并在应用层测试 API `issueType` 到 `S`/`TD`/`M` 映射后的组合筛选。

## 2026-07-21

- 背景：Tokenized Deposit onboarding 的全局 form handler 可能在 Review 前被原生 submit 事件触发，过早打开提交确认。
- 结论：Add Wizard 仅在最后一步执行 `form.handleSubmit(onSubmit)`；Continue 和 Submit 使用不同 React key，步骤切换时不复用已聚焦的按钮节点。
- 影响：第 3 步只进入 Review，第 4 步必须由用户点击 Submit 才会打开确认并提交。
- 后续同类任务：多步表单不能把全局 onSubmit 直接暴露给所有步骤；最后一步前需显式阻断原生 submit，并测试 Continue 到 Submit 的节点切换。

## 2026-07-21

- 背景：Tokenized Deposit onboarding 的 Key Custody 和 Admin Wallet 区域存在非业务性的视觉干扰。
- 结论：Key Custody 单字段容器在向导大屏下使用 `max-w-[40rem]`；Admin Wallet 三张角色卡移除只表示地址就绪状态的右上角图标。
- 影响：钱包完成数量仍由地址字段派生并展示在 section badge，移除图标不影响表单、生成钱包或提交逻辑。
- 后续同类任务：重复状态信息优先保留汇总 badge，避免在每张操作卡中增加无交互价值的装饰性图标。

## 2026-07-21

- 背景：Tokenized Deposit 新建表单的 Meta Transactions/Gas Station 单选项需要默认选择 Yes。
- 结论：`TDEditFormValues.metaType` 使用 `5 = Yes`、`1 = No`；`DEFAULT_FORM_VALUES` 必须设置 `metaType: 5`，从而覆盖首次进入、Reset 和未含该字段的草稿恢复。
- 影响：Tron 链联动仍会将该字段强制设为 `1`，不改变链级业务限制。
- 后续同类任务：迁移旧表单时，除控件定义外还要核对旧 `initialValues`，并为关键默认值增加 hook 测试断言。

## 2026-07-21

- 背景：Tokenized Deposit onboard 向导的 Key Custody 单字段选择器在大屏下比其他表单列明显偏窄。
- 结论：`KeyCustodySection` 的字段组使用 `max-w-xl`，而不是 `max-w-md`，使 Select 在向导中保持半列级别的可扫描宽度。
- 影响：Select 本身保持 `w-full`，仅由字段组上限控制，不影响移动端宽度。
- 后续同类任务：向导中单字段区域优先与两列表单的一列宽度对齐，避免无业务原因的窄控件和右侧空白。

## 2026-07-21

- 背景：Tokenized Deposit 的 reconciliation 区域按锁定状态切换说明文案，普通状态 key 曾缺失。
- 结论：`tokenized_deposit_recon_reserve_desc` 必须与 `tokenized_deposit_recon_reserve_locked` 同时维护，并在 `en-US`、`zh-CN` 的模块消息文件中保持键集合一致。
- 影响：next-intl 不会对缺失 key 降级，组件 render 时直接报 `MISSING_MESSAGE`。
- 后续同类任务：添加状态分支的 i18n key 时，搜索所有分支 key 并同步双语消息；至少执行 JSON 解析和 `shared-util-i18n-messages` lint。

## 2026-07-21

- 背景：Tokenized Deposit COA 的 setup-required 页面需要回显默认模板、时区和 EOD，但这些参考字段不允许用户修改。
- 结论：仅 Financial Book Name 在 `setup_required` 下可编辑；Account Template、Time Zone、EOD Cut-off Time 始终 disabled。原生 `input[type=time]` 已提供浏览器时钟，不能额外叠加自定义时钟图标。
- 影响：EOD 采用 `step={1}` 保留秒位，同时移除重复图标；disabled 后不再出现原生时间分段输入的焦点选中样式。
- 后续同类任务：对浏览器原生控件先检查其内置 affordance，再决定是否增加图标；只读策略应按字段而非整张卡片统一推断。

## 2026-07-21

- 背景：Tokenized Deposit COA 下拉在新系统中沿用旧接口，但返回结构并不总是当前模型声明的字段名。
- 结论：Finance Template 需兼容 `bookTemplateId/bookTemplateName` 与 `templateCode/templateName`；Time Zone 需兼容新 `{ value, label }` 和旧 `{ key, value }`。映射后再执行默认模板与浏览器时区回退。
- 影响：直接以未经归一化的 API 字段作为受控 Select 的 `value` 会导致选项存在但显示为空。
- 后续同类任务：迁移旧下拉接口时，必须对照旧页面的字段映射，而不能仅依据新 TypeScript model 推断响应结构；应以兼容映射测试固定两种结构。

## 2026-07-21

- 背景：Tokenized Deposit 的 COA 配置态字段在旧系统中虽不可编辑，仍展示模板、浏览器时区和秒级 EOD 时间。
- 结论：`configured` COA 的 Account Template 与 Time Zone 缺失时，分别回退模板列表首项和 `Intl.DateTimeFormat().resolvedOptions().timeZone`；已有后端值不可覆盖。原生 `input[type=time]` 必须设置 `step={1}`，才能与旧系统的 `HH:mm:ss` EOD 语义一致。
- 影响：仅有时区 label 的后端回填需先映射到 timezone option 的 value，避免只读 Select 无法显示选中项。
- 后续同类任务：迁移只读表单字段时，不能将 disabled 误实现为空值展示；需分别核对旧系统的默认值、回填逻辑和格式精度。

## 2026-07-21

- 背景：登录页图形验证码需要在未提交表单期间自动轮换，避免长期停留页面后继续提交失效 challenge。
- 结论：`modules-auth-ui` 的 `LoginForm` 在初次获取后，以组件级 `setInterval` 每 15 分钟刷新验证码；自动刷新成功后清空 production 环境的旧输入，development 继续采用接口响应中的 `captchacode` 预填。卸载时必须清理 interval。
- 影响：定时刷新复用既有 `setCaptcha`，因此旧 blob URL 仍由 store 回收；手动点击刷新和登录失败后的刷新保持原有输入行为。
- 后续同类任务：涉及图形验证码轮换时，测试至少覆盖刷新时间边界、替换后的随机串/图片、旧输入失效以及组件卸载后不再发请求；JSDOM 未实现 `URL.createObjectURL` 时只在测试中局部 mock。

## 2026-07-21

- 背景：管理后台需要在用户连续 30 分钟无操作后自动退出，同时开发环境不能影响调试流程。
- 结论：项目配置使用 `features.inactivityLogout` 控制该安全策略，schema 默认关闭；运行时还必须以 `NODE_ENV !== 'development'` 作为硬门槛。`stablecoin` production 配置开启，其余项目关闭。
- 影响：空闲计时用 wall-clock 时间而不是仅依赖 timer；页面从后台或系统休眠恢复时会立即检查到期。会话清理同时删除最后活动时间，避免新登录会话继承旧计时。
- TypeScript 实践：会被嵌套或异步回调捕获的可变状态不能依赖外层分支 narrowing；读取可空持久化状态后，先通过 `storedValue ?? fallback` 归一化为明确类型，而不是使用非空断言。
- 后续同类任务：新增认证相关 feature flag 时，同时更新 Zod schema、ProjectConfig 类型、JSON schema、各项目 JSON 和项目结构说明；前端超时策略不能替代后端 token expiry 或撤销机制。

## 2026-07-21

- 背景：Header 用户菜单的 `Log Out` 入口会在点击后立刻结束会话，用户没有撤销机会。
- 结论：登出这类不可逆会话操作应使用共享 `AlertDialog` 二次确认；菜单点击只打开受控对话框，只有确认按钮复用既有 `logoutApi` 与本地 `logoutAndRedirect` 链路。
- 影响：取消、Esc 与关闭对话框均不触发服务端登出或本地会话清理；服务端 session 已失效时“确认登出仍完成本地退出”的既有容错语义保持不变。
- 后续同类任务：在 Header 增加高影响账户操作时，优先使用 `AlertDialog` 并为“未确认不得产生副作用”添加组件测试。

## 2026-07-20

- 背景：迁移后的用户与角色列表在同一 RBAC 后端下为空，同时 token 失效响应未稳定跳转登录页。
- 结论：RBAC `listPage` 请求遵循 `DataTable` envelope，必须发送 `{ page: { pageNum, pageSize }, data: filters }`，不能拍平成 `{ pageNum, pageSize, ...filters }`；会话失效业务码需兼容数字和字符串形式的 `3/4`。
- 影响：`getRbacPaginated` 是 user、role、syslog 的共享请求边界，修改请求 DTO 会同时影响三个模块；Axios response interceptor 在识别失效码后统一清理 session 并跳转 locale 登录页。
- 后续同类任务：迁移 `listPage` 时先核对旧 `CustomTable` payload 与 OpenAPI `DataTableOf*` 类型，并用 API contract test 同时锁定请求 envelope 和响应 `{ rows, page }` 适配；认证业务码不能假设后端只返回 number。

- 背景：侧栏同时存在主菜单 `Token Management` 与 `MORE` 下的 `Tokenized Deposit`，两者都指向同一业务模块。
- 结论：主菜单 `token-management` 已通过 `path: /tokenized-deposit` 提供入口；移除 `MORE` 中 `tokenized-deposit` 的 order 配置即可去重，不应同时从 `modules.enabled` 删除模块。
- 后续同类任务：调整侧栏菜单时先区分菜单 order、模块 enabled 和路由 registry；仅隐藏入口时只改 order，避免意外禁用现有页面。

- 背景：Jenkins 使用 Docker-outside-of-Docker 部署时，每次源码变更都会重新安装 pnpm 依赖，并在 build 前停止容器和清理镜像，造成构建慢且延长停机。
- 结论：Dockerfile 必须先复制 root/workspace manifest 再安装依赖，并以 BuildKit cache mount 保留 pnpm store；app 镜像按 commit tag 复用，Jenkins 仅在本地不存在该 tag 时构建；容器只在镜像就绪后 `up --force-recreate`，默认不执行 image prune。
- 影响：该缓存依赖 Jenkins 节点的 Docker builder 持久化；临时 agent 无法跨节点复用，需要后续接 registry cache 或远端镜像仓库。
- 后续同类任务：部署流水线优化时先确认 Docker BuildKit/buildx 能力，再验证 `docker-compose config`、缓存命中日志和首次/热构建耗时；不要在 build 前清理会影响 layer cache 的镜像。

## 2026-07-16

- 背景：参考 `tokenized-deposit-system` 的顶部 Banner，为当前共享 App Header 增加低干扰 SVG 渐变动效，并统一主色为 `#5D5AE8`。
- 结论：Banner 背景 SVG 只消费 `--banner-start`、`--banner-mid`、`--banner-end`、`--banner-glow`、`--banner-highlight`、`--banner-wave` 六个变量；浅色和深色变量均定义于 `apps/admin/src/app/globals.css`。动效通过全局 CSS keyframes 实现，并对 `prefers-reduced-motion: reduce` 关闭，Header 本身不硬编码这些主题色。
- 影响：主题调整只改变量，不改 SVG 或 Header 结构；共享 Header 的菜单、通知、账户菜单和登出行为保持不变。`shared-ui-layout` 现有 lint 受 Header 直接依赖 `modules-auth-data-access` 的边界违规阻断，test target 还指向不存在的 `jest.config.ts`。
- 后续同类任务：更新 Header 视觉时优先保留现有 action 的 a11y 和交互，色彩由 CSS 变量统一驱动；动画必须提供 reduced-motion 降级，不新增动画运行时依赖。

- 背景：Dashboard 刷新按钮点击后持续旋转，切换 token 时也无法判断请求是否真正完成。
- 结论：`refreshPulse` 这种仅递增、不与请求完成事件绑定的 UI 状态会造成永久 loading；刷新图标与 disabled 状态必须直接使用 TanStack Query 的 `isFetching`。这样手动 refetch、token 切换和时间范围切换都以同一个请求生命周期收敛，完成或失败后都会停止。
- 影响：不要为服务端请求另建“旋转次数/布尔 loading”状态，除非它由 mutation/query 的 settled 生命周期明确复位；同一请求进行中应禁用对应刷新按钮以避免重复提交。
- 后续同类任务：出现永久 spinner 时，先搜索所有本地 loading state 是否在 `finally/onSettled` 复位；优先删除派生状态，直接使用 query 的 `isFetching/isLoading/isError`。

- 背景：当前 Dashboard token selector 能加载 token，但概览和两张趋势图没有数据；需以旧 `statistic-analysis/index.tsx` 恢复真实接口链路。
- 结论：TD Dashboard 不是全局聚合接口。概览必须调用 `POST /api/manage/v1/td/dashboard/stablecoin/statistics` 并传 `{stablecoinCode}`；钱包和交易趋势必须传 `{stablecoinCode,startTime,endTime}`（毫秒时间戳），响应为逐日行数组，字段分别是 `statisticsDay/walletNumber/walletNewNumber` 与 `statisticsDay/topUpTotal/transferTotal/withdrawalTotal`。`symbol` 仅用于展示，不能代替 `code` 作为后端请求标识。
- 影响：Dashboard data-access 的 query key 必须包含 stablecoinCode；切换 selector 后概览与趋势必须随 code 重取。不要使用迁移时臆造的 `statisticsType/statisticsDateType` 或 `dateList/statisticsCount` 结构。
- 后续同类任务：接口看似成功但图表为空时，优先对照旧页的请求 body 和响应行模型，而不是只检查 endpoint；至少用 data-access API contract test 锁定 URL、code 和时间范围。

- 背景：Dashboard 需要参考外部 `usd-coin` 的数据工作台视觉迭代，同时明确冻结 Stablecoin token selector（筛选、搜索、视图切换、token 卡片和折叠区）。
- 结论：Dashboard 仅调整 selector 外的 Header、概览指标卡和图表容器；保留 `StablecoinTabs → TokenSelector` 的实现、受控 props、API/query 与 token 选择逻辑。指标卡可以采用紧凑数值与完整数值并存的展示，但不能用 mock 数据替换现有接口结果。
- 影响：Dashboard 视觉迭代时，应将 token selector 视为独立、已验收的 UI 边界；不要因页面重构改变其布局、状态机或数据映射。Admin 全量 lint/test 目前分别受既有 selector boundary 与 `specs/index.spec.tsx` 路径错误阻断，定向 selector 测试可用 `apps/admin` cwd + `jest.config.cts --runTestsByPath` 验证。
- 后续同类任务：先确认用户是否冻结某一视觉组件；冻结时对该文件执行零 diff 检查，并只验证它的既有测试，不擅自改动以解决页面级样式需求。

- 背景：需要基于当前仓库生成一份足够详细、可约束后续研发方向的整体框架与开发约束文档。
- 结论：新增 `.doc/project-framework-and-development-constraints.md`，以实际源码和 Nx 配置为基线，将“当前事实、强制约束、已知债务、演进目标”分开描述；基线确认仓库当前包含 29 个业务 domain、112 个领域 library project 和 17 个 shared library project。
- 影响：后续涉及目录职责、依赖边界、配置/路由/registry/i18n 接入、API business code、auth、测试门禁或 Definition of Done 时，应优先用该文档做完整性检查；`.doc/nx.md` 仍视为历史架构草案，不能覆盖当前代码事实。
- 后续同类任务：重点避免扩大 shared 反向依赖 domain、未覆盖的新 domain scope constraint、root/app alias 与 Next 编译清单漂移、配置菜单存在但页面未接通等问题；新增模块必须把 config、route、app-local registry、compile、i18n、domain 和 verification 作为一条接入链验证。

## 2026-07-15

- 背景：Dashboard 顶部 Stablecoin 选择器需要采用外部 `token-management-ui` 的交互设计，但继续使用当前真实 API 数据。
- 结论：迁移组件时只复用搜索、动态网络筛选、Tab/Dropdown 双模式、折叠和选中详情；不迁入 mock token 数据、独立页面壳或无回调的 Onboard 按钮。`StablecoinTabs` 仍保持受控 `value/mode` API，token id 按 `stablecoinId ?? code ?? symbol` 稳定解析，确保下方统计查询语义不变。
- 影响：Dashboard token 选择 UI 位于 app-local `apps/admin/src/app/[locale]/(app)/components/StablecoinTabs.tsx`，因为它负责应用装配并直接组合 dashboard data-access；网络筛选项必须从 API options 动态派生，不能维护固定网络清单。
- 后续同类任务：从独立 UI 原型迁移组件时，先剥离 mock 数据与依赖，再适配现有受控 props、i18n 和真实字段；不要用原型状态替换业务页面已有状态源。

- 背景：同一 Token Selector 还需要替换 `/tokenized-deposit` 的 `TdSwitcher`，形成 Dashboard 与 Tokenized Deposit 两个真实消费者。
- 结论：选择器下沉到 `modules-tokenized-deposit-ui`，只接受领域无关的 `TokenSelectorOption`、labels 和受控 value/mode；Dashboard 将 enabled options 映射为 active，Tokenized Deposit 将 `ApplyListItem.state` 映射为 active/pending/inactive，并通过 action slot 保留权限化 Onboard。
- 影响：应用层和 feature 层都不复制搜索/网络筛选/折叠/下拉状态机；UI 库不依赖 data-access 或 next-intl，符合 `type:ui` 边界。
- 后续同类任务：第二个消费者出现时再下沉稳定组件；业务字段和 i18n 留在各自 wrapper，通用 UI 只接收显示模型与回调。

- 背景：登录页需要迁移旧 `td-manage` 的双栏视觉，并要求左侧 SVG 动效资源保持轻量。
- 结论：旧 `public/stablecoin/images/login/pc.svg` 实际内嵌约 260 KB PNG，不应继续复用；当前登录页使用纯矢量 `apps/admin/public/login-network.svg`，通过 SVG 内部 CSS 实现低频动画，并为 `prefers-reduced-motion` 提供静态降级。系统标题读取 `config.project.name`，认证、验证码和 MetaMask 数据流仍保留在现有 auth 分层内。
- 影响：后续调整登录品牌视觉时优先修改可缓存的轻量 SVG 和 auth feature/ui，不要把项目名或登录业务状态硬编码进应用 layout。
- 后续同类任务：检查所谓 SVG 是否包含 base64 bitmap；视觉资源应记录实际字节大小，并验证桌面双栏与移动端单栏。

## 2026-07-14

- 背景：仓库根目录 `README.md` 仍是 Nx 初始化模板，未反映当前管理后台的真实启动方式、配置系统和架构边界。
- 结论：根 README 应作为新成员入口，维护 pnpm/Nx 命令、`apps/admin/.env.local` 的变量名、locale 访问形式、`NX_PROJECT_ID` 项目切换和配置/路由/registry 三层检查；项目结构与细粒度代码规范仍以 `pro.md`、`rule.md` 为唯一详细来源，避免重复维护。
- 影响：后续修改开发命令、环境变量、配置加载方式或根目录职责时，需要同步校验 README；README 不记录真实内网后端地址、密钥或易变的完整模块清单。
- 后续同类任务：更新对外入口文档前，优先以 `package.json`、Nx project 配置、环境变量读取代码和实际配置 loader 为证据；发现注释与实现不一致时，按实现描述并将注释修正留给相应代码变更。

## 2026-07-14

- 背景：`stablecoin.json` 已配置 `/key-management/key-service-configuration` 菜单，但动态模块路由会把未知第一层 slug 归为 `detail`，导致该入口加载 Key-Signed Transactions 详情页并因缺少 `id` 显示 “Transaction record not found”。
- 结论：保留旧模块菜单时，必须在 app-local `module-page-registry.ts` 为有语义的子路径建立显式映射；本次 Key Service Configuration 的列表使用 `/api/manage/v1/key/config/keyServiceList`（注意 `/aps` 基地址后的后端路径需保留 `/api` 前缀），而不是复用交易详情 loader。
- 影响：`key-management` 的其他旧菜单项（Key Policy、Management Wallets、User Wallets）仍未迁移，访问它们不会自动成为已实现功能，后续迁移需要分别补充 data-access、feature 和显式路由映射。
- 后续同类任务：排查菜单页面异常时，依次核对菜单 path、动态路由的 slug 解析、app-local loader、feature export 和 endpoint 前缀；不要只因 `modules.enabled` 已包含模块就认为所有子菜单可用。

## 2026-07-13

- 背景：迁移页面传入 Moment 风格的 `YYYY-MM-DD HH:mm:ss` 时，date-fns 4 抛出 Unicode token `RangeError`。
- 结论：`shared-util-dates` 在 date-fns 调用前将遗留日历年和月份日 token `YYYY`/`YY`/`DD` 归一化为 Unicode token `yyyy`/`yy`/`dd`，同时覆盖 `formatDate`、`formatTime` 和 locale-aware formatter，避免各业务页面重复迁移相同格式字符串。
- 影响：业务模块继续保留已有展示格式；新增代码应优先直接使用 date-fns Unicode token，避免将 `YYYY`/`YY`/`DD` 作为新约定。
- 后续同类任务：遇到 date-fns token 报错时，先检查是否经过 `shared-util-dates`；如使用其它 date-fns 入口，必须使用 `yyyy` 和 `dd`，而不是 `YYYY` 和 `DD` 表示日历年月日。

- 背景：`key-management` 页面调用 `useTranslations('modules.key-management')` 时，`en-US` 报 `MISSING_MESSAGE`。
- 结论：`libs/shared/util-i18n-messages/src/lib/merge-messages.ts` 使用静态 import 与 `messageMap`，新增模块翻译必须同时新增双语 JSON、静态 import 和 `modules/<module-id>` 映射；只添加消息文件不会被运行时加载。
- 影响：模块 ID、manifest 的 `i18nNamespace` 与消息映射键必须保持一致，且该模块需要出现在项目配置的 `modules.enabled` 中。
- 后续同类任务：遇到 namespace 缺失时，依次核对组件 namespace、`mergeMessages` 静态映射、`configs/*.json` 的 enabled modules 和实际 locale JSON；最后用 `mergeMessages` 断言消息树中存在对应路径。

## 2026-06-17

- 背景：根据旧项目 `sp-access` 需求分析，在当前 `Nx + Next App Router` monorepo 中新增 `sp-access` 领域模块。
- 结论：`configs/*.json` 中把模块加入 `modules.enabled` 和菜单顺序，只能让配置层“知道这个模块”；模块要真正可访问，还必须同时补齐 `libs/modules/<module>/*`、App Router 动态页面加载表、`apps/admin/next.config.ts` 的 `transpilePackages`，以及 `apps/admin/tsconfig.json` 的 path 映射。
- 影响：以后迁移旧模块时，看到菜单里已有模块 ID，不代表代码层已经接通；需要把“配置、registry、transpilePackages、tsconfig paths”作为一组检查项。
- 后续同类任务：新增模块时先按 `data-access + util + feature + manifest` 建骨架，再同步接入 app-local module page registry 和 `apps/admin` 编译配置；否则动态路由会显示模块不存在，或 Next 构建阶段报找不到包。

## 2026-06-18

- 背景：`sp-access` 接入动态路由时，`shared-util-config` 的历史 `module-registry.ts` 本来静态依赖 user/order/key-management 等业务模块，违反 `scope:shared` 边界；新增 `sp-access` 条目会扩大同类问题。
- 结论：新增业务模块不要继续把页面 registry 放进 `libs/shared/util-config`。本次将 `sp-access` 页面加载表放到 `apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/module-page-registry.ts`，动态路由对 `sp-access` 走 app-local loader，其他历史模块仍 fallback 到 shared legacy loader。
- 影响：`npx nx lint admin` 可以通过，`shared-util-config` 仍因历史 `config.loader.ts` 相对导入 configs 和 legacy `module-registry.ts` 依赖旧模块而失败，但失败不再包含 `sp-access`。
- 后续同类任务：迁移新模块时优先在 app 层装配页面动态加载；不要为了让 shared registry 通过而给旧 user/order 强行加 `scope:modules`，这会暴露旧模块自身跨 scope 依赖并扩大改动面。

- 背景：继续验证 `sp-access` edit 成功路径，不能只停留在 `MSG_03_3025` 阻塞样本。
- 结论：真实后端中 `spId=57, spRecordId=117, spCode=e7a1f8bca86e42ccb080309b7815dfeb` 可作为 edit 成功验证样本。原样提交 `/api/manage/v1/sp/access/edit` 后，`operationRecords` 最新记录变为 `spRecordId=150,type=2,state=5,taskId=5333,businessCode=td_edit_sp`，说明 edit 请求已被后端接受并进入审批流程；这与 `spId=65/63` 返回 `MSG_03_3025` 的处理中状态阻塞不同。
- 影响：验收 `sp-access` edit 时要区分“提交创建了 edit operation，进入审批”与“审批最终完成”；本模块目标是发起 edit 并保持 payload round-trip，不负责 approval-manage 审批通过。
- 后续同类任务：找可编辑样本时，先用 listPage 筛 `state=1/2`，再查 `operationRecords` 和 `detail/basicInfo`；部分 `spId=62/61/60/59/58` 当前 detail 返回业务 `code=500`，应归类为后端数据问题。

- 背景：`npx nx test modules-sp-access-util` 在本机因 watchman 写 `~/Library/LaunchAgents/com.github.facebook.watchman.plist` 失败。
- 结论：不要把 `watchman:false` 放进 Jest 30 config，Jest 会报 unknown option；可用 `npx nx test modules-sp-access-util --no-watchman` 作为本仓库当前环境下的干净验证命令。
- 影响：后续报告测试结果时要说明普通命令受本机 watchman 影响，但 `--no-watchman` 版本已通过，不能把 watchman 环境问题误报为业务测试失败。
- 后续同类任务：遇到 Jest watchman 权限错误，优先尝试 `--no-watchman`，再考虑是否需要调整全局测试配置。

- 背景：补强 `sp-access` 详情页时，对照旧新版 `src/lib/components/sp-access/BaseInfo.tsx` 和当前真实页面验证 KYC / 下载行为。
- 结论：token permission 的 `kycRequired` 语义来自旧新版 `BaseInfo`：`2 => Yes`，`1/0 => No`；但 user wallet 列表的 `kycRequired` 语义来自 `UserWallets`：`1 => Yes`，其他为 No，两者不能混用同一个 formatter。当前 app 还没有挂载 shared `Toaster`，页面级 fail-loud 不应依赖 toast。
- 影响：实现详情页下载入口时，如果后端 detail 没有 API doc / secret key 资源，必须用本地可见错误提示而不是假链接或 toast；否则用户点击后没有反馈，真实验收会误判。
- 后续同类任务：迁移字段名相同但接口上下文不同的枚举时，优先查对应旧组件而不是全局复用格式化函数；使用 `useToast` 前先确认 app root 已挂载 `<Toaster />`。

- 背景：继续按新版 `t_edit.tsx` / `t_view.tsx` 迁移并真实联调 `sp-access`，完成 create、detail、edit hydration 和 edit submit 验证。
- 结论：真实 `walletRule/searches` 返回的规则 ID 可能是 `ruleId`，不是旧前端假设的 `walletRuleId`；缺失 `state` 不应默认视为禁用，否则会把可用 wallet rule 过滤掉，导致 `permissionsList: []` 并触发 `MSG_03_3016`。edit 路由也需要动态路由显式识别 `/sp-access/edit`，不能复用 `/create?...` 伪编辑路径。
- 影响：以后实现 token permission 序列化时，必须在 data-access 层显式映射真实后端字段，并在提交前 fail loud 校验启用的 API/Contract access 至少有权限组；否则 UI 看似已勾选，实际 payload 为空。
- 后续同类任务：验证 edit 时同时检查 hydration 和 submit payload。当前样例 `spCode=846e7f8a7aae41208757adcc0f987178` 的 edit payload 已保留 `privateKeyCustodyModel:"2,3"` 与 `transactionPolicy:"1,2"`，但真实后端返回 `code=1,message=MSG_03_3025`，属于后端流程状态阻塞，不能宣称 edit 端到端成功。

- 背景：为覆盖 `sp-access` 动态路由和 registry 改动，额外执行 `npx nx lint shared-util-config`。
- 结论：`shared-util-config` 当前存在既有 Nx 边界冲突：`scope:shared` 项目中的 `config.loader.ts` 使用相对路径导入外部 config，`module-registry.ts` 静态 import 多个 `libs/modules/*`，违反 “shared 只能依赖 shared” 的 module-boundary 规则；本次新增 `sp-access` registry 条目会增加同类报错，但不是单个模块内可局部修复的问题。
- 影响：模块迁移的最窄 lint 可以用 `modules-<domain>-*` 和 `admin` 验证；若要让 `shared-util-config` lint 通过，需要单独调整动态模块 registry 的归属或边界配置，不能在业务模块迁移里顺手改。
- 后续同类任务：涉及 `module-registry.ts` 时，最终报告要区分“新增条目带来的同类 lint 命中”和“registry 架构已有边界问题”，避免误判为业务 feature lint 失败。

- 背景：对 `sp-access` 进行真实接口编辑联调时，浏览器页面曾在 `POST /api/manage/v1/sp/access/edit` 后直接返回详情页，但后端实际业务返回为失败。
- 结论：当前项目的共享 `libs/shared/data-access-api` 不能只按 HTTP 状态判断成功；后端广泛使用 `{ code, message, data }` 包装，`code !== 0` 即业务失败，必须在 Axios 响应拦截器里统一 reject。否则 UI 会把“HTTP 200 + 业务失败”误当成功，产生假阳性联调结论。
- 影响：以后做真实接口验证时，看到 network 里的 `200` 不能直接判定通过；需要同时确认响应体业务 `code`，或依赖已经修好的 `apiClient` 抛错语义。
- 后续同类任务：凡是走 `apiClient` 的模块，联调失败时先看 `code/message` 是否被正确透传到 UI；如果页面出现“提交后跳转但数据没变”，优先排查共享 API 层是否吞掉了业务失败码。

- 背景：`sp-access` 编辑页使用真实登录态联调 `POST /api/manage/v1/sp/access/edit`，同一 payload 通过浏览器和 `curl` 均可复现。
- 结论：截至 2026-06-18，本地代理到真实后端时，该接口对当前样例 `spCode=aea70d3ae55749f0a479ee7dce2a38e3` 返回业务失败 `code=1, message=MSG_03_3025`；因此当前阻塞不是前端未发请求，而是后端拒绝该编辑请求或还缺少前置字段/状态条件。`detail/basicInfo` 返回的 `spDesc`/`operationSpDesc` 双字段也说明该域存在“基础值”和“操作中值”并存语义。
- 影响：`sp-access` goal 在“真实 edit/save 成功闭环”上仍未完成，不能因为页面已能加载、回填或发出请求就标记完成。
- 后续同类任务：继续排查 `MSG_03_3025` 时，优先从真实后端契约、审批/操作中状态约束、是否缺失隐藏字段或错误 token-permission 组合入手，而不是重复怀疑列表/详情读取链路。

- 背景：完成 `sp-access` 第一版实现并要求“使用真实接口验证”。
- 结论：当前仓库的 `sp-access` 真实后端路径应统一走 `/api/manage/v1/sp/access/*`，并通过 `apps/admin/.env.local` 中的 `NEXT_PUBLIC_API_BASE_URL=/aps` 与 `NEXT_SERVICE_SERVER_URL=http://10.0.48.123:30001/` 由 Next.js rewrite 代理。`/api/manage/v1/sp/access/listPage`、`detail/basicInfo`、`walletRule/searches`、`type/searches`、`stablecoin/enabled` 均可从本机 `http://localhost:3000/aps/...` 命中真实后端。
- 影响：以后联调 `sp-access` 时，不需要再重新猜接口前缀；若返回 `{"code":3,"message":"MSG_00_0004"}`，说明路径是通的，阻塞点是登录态而不是路由或 API 地址错误。
- 后续同类任务：真实联调前优先验证登录态；若要改 `save/edit/detail`，重点检查旧 DTO 语义是否完整覆盖 `spName/contactName/email/phone/fileId/spType/metaType/reconciliationFrequency/privateKeyCustodyModel/transactionPolicy/tdAccessList.accessList`，尤其注意 `transactionPolicy` 需要 parse/serialize round-trip 一致，不能像旧版 `t_edit.tsx` 那样只写不回填。

- 背景：分析旧项目 `td-manage/libs/components/CustomTable.tsx`，为当前 Nx 管理后台沉淀可迭代的列表组件实现提示词。
- 结论：旧 `CustomTable` 同时耦合查询表单、SWR 请求、Antd Table、权限、复制、操作列、路由特例和环境变量；当前项目应吸收业务语义，但不要原样迁移。新组件应基于现有 `libs/shared/ui` 的 TanStack `DataTable` 组合增强，API 数据由调用方传入，请求和 query 留在模块 `data-access`。
- 影响：后续迁移旧列表页时，不应把 `pageNum/pageSize/data` 协议、localStorage 权限读取、router 特例或 SWR 刷新 ref 放入 shared UI。
- 后续同类任务：先区分低阶表格、列表面板、业务查询表单和模块 data-access；通用组件只接收 `rows/pagination/loading/error/actions/permissions` 等明确 props。

- 背景：整理 token / coin / network 上下文选择器需求文档，计划后续实现 `Tabs` 与 `Dropdown Lists` 两种展示模式，并补充 Storybook 创建提示词。
- 结论：当前仓库未发现 `@storybook/*` 依赖、`.storybook` 配置或 `.stories.*` 文件；后续需要 Storybook 时，应先检查目标 project 是否已有 target，没有则优先使用 Nx Storybook generator 接入，而不是手写零散配置。
- 影响：涉及组件可视化验收的需求文档需要明确 Storybook 前置条件，避免默认假设 Storybook 已可运行。
- 后续同类任务：先用 `rg` 检查 Storybook 依赖、配置和 stories，再决定是新增 story 还是先补齐 project 的 Storybook configuration。

- 背景：创建 `goal-execution-loop` skill，用于承接 `goal-prompt-from-requirement` 生成的 goal prompt，并进入确认、执行、监督、验收、修复循环。
- 结论：复杂实现任务需要拆成主流程 + 两类子 agent：监督子 agent 在构建过程中检查是否偏离 goal；验收子 agent 在实现后按需求和验证结果判断 PASS/FAIL。
- 影响：这类任务不能只由主流程自测后结束；只有成功标准满足、无阻塞报错、验收子 agent 通过后，才能认为任务完成。
- 后续同类任务：执行 goal prompt 时先确认任务，再实现；构建中引入监督子 agent，完成后引入验收子 agent；若验收失败，主流程修复后重新验证并复审，直到通过。

- 背景：在 `.agents/skills` 下创建 `goal-prompt-from-requirement` skill，用于把需求 Markdown 转成 Codex goal prompt。
- 结论：项目级 skill 放在 `.agents/skills/<skill-name>/`，最小结构包含 `SKILL.md` 和 `agents/openai.yaml`；`SKILL.md` 的 frontmatter 只保留 `name` 与 `description`，description 需要写清触发场景。
- 影响：`.agents` 目录可能受沙箱限制，使用官方 `skill-creator/scripts/init_skill.py` 初始化时可能需要升级权限；初始化后必须删除模板 TODO 并运行或手工执行结构校验。
- 后续同类任务：优先用 `skill-creator` 官方脚本初始化 skill；如果 `quick_validate.py` 因本机缺少 `yaml` 失败，至少检查 frontmatter、TODO 残留、必要文件结构和 `agents/openai.yaml` 默认提示词。

- 背景：整理 Codex 项目上下文文档，将原本集中在 `AGENTS.md` 的项目说明拆分到 `.codex/project/pro.md` 和 `.codex/project/rule.md`。
- 结论：`AGENTS.md` 只保留仓库入口、关键约束和执行提醒；详细项目结构由 `pro.md` 维护，详细代码规范由 `rule.md` 维护。
- 影响：后续修改项目结构、模块边界、技术栈、命名规范、lint/format/test 规则或代码设计约定时，需要同步更新对应文档。
- 后续同类任务：先判断信息属于项目事实、代码规范还是对话经验，再分别写入 `pro.md`、`rule.md` 或 `memory.md`，避免多个文档重复维护同一段内容。

## 2026-07-16

- 背景：MacBook 紧凑桌面密度下，侧栏宽高缩小后 14px 菜单字体仍显得偏大。
- 结论：1024–1599px 的 Sidebar 一级、二级和收起态 flyout 菜单统一使用 13px，1600px 以上恢复 14px；分组标题继续使用 12px。
- 影响：侧栏视觉密度与 240px 宽度及 40px 菜单高度匹配，不影响页面正文、表格和表单字体。
- 后续同类任务：紧凑密度的字体调整应限制在高频导航等局部区域，不全局缩小正文基准字号。

- 背景：当前后台在 4K 显示器下合适，但 MacBook 13/14/15 英寸逻辑视口中整体显得过大。
- 结论：采用双桌面密度：1024–1599px 使用紧凑 Shell（64px Header、240/64px Sidebar、16px 内容边距）和较低 Dashboard 栅格密度；1600px 以上保留原舒适尺寸。
- 影响：不通过全局 zoom 或根字号缩放，避免 Radix Portal、固定 px 与可访问点击区域失真；Dashboard 在紧凑桌面使用三列指标卡、单列 280px 图表。
- 后续同类任务：新页面的 4K 多列布局统一延后到 `min-[1600px]`，MacBook 档位优先降低间距和列数，而不是缩小正文可读字号。

- 背景：Dashboard 页面内容区的 H1 与 Breadcrumb 当前页名称重复。
- 结论：Dashboard 移除内容区的重复 H1，仅通过 Breadcrumb 表示当前位置；Token Selector 直接作为内容区起始。
- 影响：减少首屏无业务信息的垂直占用，不影响 dashboard 数据请求和可访问的页面上下文。
- 后续同类任务：已有 Breadcrumb 表示单一页面名称时，不额外渲染同文案的页面 H1，除非标题承担独立说明作用。

- 背景：侧栏右侧边框与内容区的弱分隔视觉不一致。
- 结论：Sidebar 移除 `border-r`，使用轻量右向阴影替代，和 Breadcrumb 工具栏的无边框弱分隔风格一致。
- 影响：侧栏与内容区保持层级，但避免明显实线切割。
- 后续同类任务：同一页面的区域分隔应统一使用 border 或低对比 shadow 中的一种，不混用。

- 背景：移除面包屑底线后仍需要轻微的层级分隔。
- 结论：Breadcrumb 工具栏使用低不透明度、负扩散半径的底部阴影替代实线边框。
- 影响：内容区有轻微层次感，不增加显著视觉噪音或额外高度。
- 后续同类任务：需要弱分隔时优先采用低对比阴影，不同时叠加 border 和 shadow。

- 背景：面包屑工具栏占用垂直空间过大，且底部分隔线不需要。
- 结论：`SidebarLayout` 的 Breadcrumb 工具栏使用 40px 高度并取消 `border-b`；其中的侧栏按钮缩至 32px，保留可操作性。
- 影响：页面可用纵向空间增加 8px，面包屑与内容区视觉上连续。
- 后续同类任务：紧凑辅助导航优先使用 40px 工具栏；若没有层级分隔需求，不额外添加边框。

- 背景：原生 `input[type="date"]` 的显示应跟随操作系统/浏览器语言，而不是应用路由语言。
- 结论：`FormDatePicker` 不向原生 input 传递 `lang`，避免 `next-intl` 的 `zh-CN` locale 强制覆盖浏览器的系统格式。
- 影响：所有复用 `FormDatePicker` 的筛选和表单使用浏览器原生日期显示；日期值仍保留 HTML date 的 ISO 格式，接口契约不变。
- 后续同类任务：只有需求明确要求“跟随应用语言”时才设置 `lang`；“跟随系统”应保留原生控件的浏览器默认 locale。

- 背景：侧栏收起后，选中一级菜单的背景需要保持正方形。
- 结论：收起态的普通项和含 children 的父项统一使用 `size-11`，使点击区域和激活背景固定为 44×44px；展开态不受影响。
- 影响：图标菜单的视觉密度与点击目标一致，避免背景随图标或内边距形成非正方形。
- 后续同类任务：收起态图标导航必须同时固定宽高，不能只固定高度或依赖内容宽度。

- 背景：收起态打开二级 flyout 后，点击普通一级菜单时浮层未关闭。
- 结论：普通 `SidebarItem` 提供可选 `onClick`，由 Sidebar 在收起态注入 flyout close 回调；路由跳转仍由 Link 处理，不将关闭行为散落到各菜单配置。
- 影响：收起态下的一级导航不会遗留悬浮菜单；带 children 的一级项仍通过同一 flyout state 完成切换。
- 后续同类任务：浮层状态与触发导航的叶子项必须同步；为通用导航项提供可选交互回调，而不是依赖路由切换时机隐式清理。

- 背景：收起侧栏后仍需访问父级菜单的二级路由。
- 结论：`shared-ui` Sidebar 在收起态对含 children 的菜单项使用 fixed portal flyout；浮层从原菜单按钮的 viewport top 定位，子项继续使用配置中的真实 `path`、`disabled` 和当前路由高亮，而不是复制菜单数据。
- 影响：桌面侧栏可以收缩为图标模式而不丢失二级导航；展开态仍使用原有的内联折叠子菜单。
- 后续同类任务：收起态浮层应渲染在 `document.body`，避免被侧栏的滚动和 overflow 裁切；子项动作必须沿用真实 Link 路由。

- 背景：侧栏收缩入口需要从顶部 Header 移至内容区的面包屑前方。
- 结论：桌面端收缩按钮由 `SidebarLayout` 在 Breadcrumb 工具栏内渲染，Header 只保留移动端抽屉菜单按钮；Breadcrumb 关闭时工具栏和收缩入口仍保留。
- 影响：品牌 Banner 不再承担桌面布局控制，侧栏操作与当前页面上下文保持相邻。
- 后续同类任务：布局控件应放在其控制对象或相关上下文附近；Header 仅承载全局操作。

- 背景：管理后台 Header 需要使用 UDPN 新标识，且不再依赖旧 `/logo.svg` 静态资源。
- 结论：Header 固定使用下载至 `apps/admin/public/logo-icon.svg` 的本地 UDPN SVG，不读取 `config.project.logo`；项目配置中的 logo 字段仍保留，避免改变通用配置 schema。
- 影响：Header 的品牌标识不依赖内网运行时访问，且由可缓存的本地静态资源提供；后续若要支持每项目不同品牌，需要再将 Logo 作为受控组件或明确的配置类型扩展。
- 后续同类任务：替换固定 Header 品牌时将已审核的资源放入应用 public 目录；不要为了单一固定标识修改所有项目 config。

- 背景：Stablecoin 管理后台需要参考新的侧栏菜单样式和布局迭代现有导航。
- 结论：菜单内容仍由 `configs/stablecoin.json` 保持原有 `id`、`path`、`enabled` 与 `disabled`；视觉统一在 `shared-ui` 的 Sidebar 实现，采用 288px 卡片式侧栏、44px 圆角一级菜单、实色激活态，以及带左侧引导线的紧凑子菜单。
- 影响：侧栏视觉会被使用 shared Sidebar 的项目复用，原有路由匹配、折叠和移动端抽屉行为不受影响。
- 后续同类任务：菜单内容变更与视觉变更分别落在 config 和 shared Sidebar；仅有视觉需求时不要修改业务菜单配置。

- 背景：按旧系统 `td-manage/src/pages/tokenized-deposit/edit.tsx` 审计当前 Tokenized Deposit 编辑页的迁移完整性。
- 结论：当前编辑入口由 `tokenized-deposit` registry 的 `edit` 页加载，`TokenizedDepositEditPage` 从 query `code` 回填；详情、下拉、钱包生成及新增/编辑提交沿用旧页面 endpoint 和 payload 语义。COA 的 `setup_required` 初始值仍是本地 mock（旧实现同样如此），因此不能据此宣称真实后端端到端验收完成。
- 影响：后续改动该页时必须同时核对 `code` 路由、`useDetailInit` 回填、`useBlockchainEffect` 联动和 `useTokenizedDepositSubmit` 的 `createTDApply`/`editTDOperation` 分支；应补充至少覆盖回填和两条提交 payload 的 feature 测试。
- 后续同类任务：`modules-tokenized-deposit-feature` 当前没有测试文件；普通 Jest 命令可能被 Watchman socket 权限阻塞，必要时以允许 Watchman 访问的环境运行，并明确区分“零测试通过”与“行为已覆盖”。

## 2026-07-17

- 背景：Keystore 路径的 Generate Wallet 弹窗在 Confirm 后没有提交中反馈，且生成请求失败时 `finally` 仍会关闭弹窗。
- 结论：弹窗本地 `isSubmitting` 必须 await 真实 `onSubmit`，期间禁用输入、取消和 Dialog dismiss，并在 Confirm 保留文本的同时显示 spinner；钱包 hook 仅在生成接口返回结果后 reset/close，失败时保留弹窗供重试。
- 影响：用户能看到生成过程，重复请求被阻止，失败不会丢失密码输入。
- 后续同类任务：异步弹窗的关闭应由成功路径决定，不能放在无条件 `finally`；若业务 hook 吞掉异常，组件仍应在 await 返回后恢复可操作状态。

- 背景：Tokenized Deposit Onboard 的 COA 已回显默认 Account Template、Time Zone 和 EOD，但后三个控件仍被硬编码禁用，与旧系统及 TD `setup_required` 的可编辑语义不一致。
- 结论：`CoaSetupCard` 的四个字段统一以 `readonly || status !== 'setup_required'` 决定禁用状态；TD `setup_required` 可编辑，Stablecoin `configured` 仍由父层传入 `readonly` 保持只读。
- 影响：默认回显不再阻止用户调整模板、时区和 EOD，提交侧既有 COA 校验与 payload 路径无需变更；嵌入式标题将状态标签置于标题旁，收紧两列字段间距。
- 后续同类任务：不要为“默认回显”单独硬编码禁用控件；必须从状态语义和父层 readonly 一起推导，并以组件测试覆盖可编辑和只读分支。

- 背景：Tokenized Deposit 表单的默认 mint method 用于初始化 state 时，被 TypeScript 推断为字面量类型 `1`，而回填回调传入的是 `number`，导致 Jenkins 的 production build 在 `setTokenTypeId(type)` 失败。
- 结论：会接收接口或回调数值的 React state 必须显式声明为 `useState<number>(...)`，不能依赖常量初始值的字面量推断；扩展 `TokenSelectorLabels` 时必须同一次同步所有调用方和 `en-US` / `zh-CN` 消息 key。
- 影响：`npx nx build admin` 已通过 TypeScript 与完整 Next.js production build；类型筛选的 Stablecoin / Tokenized Deposit / Tokenized MMF 文案也不会在运行时缺失。
- 后续同类任务：提交前至少运行受影响 app 的 production build；开发服务器不会覆盖所有 Next.js TypeScript 检查和跨包接口完整性。

- 背景：Stablecoin 的储备资产已锁定对账时，Onboard 渲染 `tokenized_deposit_recon_reserve_locked` 报 `MISSING_MESSAGE`。
- 结论：条件分支的 i18n key 必须同时写入 `en-US` 与 `zh-CN` 的模块消息 JSON；本次补齐“储备资产已要求对账，不能更改”文案。`shared-util-i18n-messages` 当前 test target 指向不存在的 Jest config，暂以 lint 和 JSON/key 存在性检查验证。
- 影响：锁定储备资产的 Onboard 页面不再因 i18n 缺失中断渲染。
- 后续同类任务：为新条件分支增加 `t(key)` 前，先用 `rg` 对照所有 locale 文件；消息库 test target 修复前，不能把 `npx nx test shared-util-i18n-messages` 的配置错误误报为业务测试失败。

- 背景：Tokenized Deposit 的 Significant Stablecoin Issuer Threshold 在新 Onboard 页面被禁用，但旧系统允许编辑。
- 结论：旧组件允许编辑 `thresholdType`（Volume/TXN Count）、`thresholdFrequency`（Daily/Monthly/Yearly）和非负、两位精度的 `thresholdValue`，仅单位展示框只读；但旧、新提交 payload 都曾遗漏这三个字段，直接恢复 UI 会产生可填写但不保存的假功能。当前按同名字段假设将其接入 Stablecoin create/edit payload，并在详情同名字段存在时回填。
- 影响：阈值仅对 Stablecoin 展示和提交，非 Stablecoin 的草稿残留不得进入 payload；`thresholdValue` 在 API payload 中归一为 number，空值不提交。
- 后续同类任务：迁移遗留表单时必须同时审计“控件可编辑性、详情回填、提交 payload”三层；旧 UI 能输入不能证明后端实际持久化，接口契约未在仓库定义时需在真实联调中确认字段名和响应回显。

- 背景：Tokenized Deposit Onboard 的 Continue 校验虽调用 `toast.error`，但用户无法看到提示。
- 结论：当前 `apps/admin` 没有在根 layout 挂载 `Toaster`；在未完成全局装配前，使用 toast 的独立 feature 必须在自身页面挂载一次 `Toaster`。同时，Radix Select 与卡片式 radio 未注册原生 RHF ref，向导校验失败时应按字段 ID 显式滚动、聚焦到首个无效控件。
- 影响：`/tokenized-deposit/onboard` 现在会显示校验提示，并将 Continue 失败定位到首个错误字段；Stablecoin 默认值还必须同步 `mintMethod`、契约查询 tokenType 与 reset/draft fallback，避免 UI 与数据查询分歧。
- 后续同类任务：为后台统一补齐 root `<Toaster />` 时，移除 feature 内重复挂载；涉及 Radix 受控字段的表单校验，不要只依赖 `trigger({ shouldFocus: true })`，须验证实际聚焦目标。

- 背景：按 `/Users/zhangxuefeng/Downloads/临时（可删除）/token` 的表单参考重构 Tokenized Deposit Onboard 页面。
- 结论：参考表单的有效结构是四步 Basic / Accounting / Custody / Review；当前页面外围 Header、Summary 和真实 TanStack Query/API 提交流程保持不变，Onboard 表单通过现有 RHF 字段和 COA 校验接入分步 Continue/Back/Review。
- 影响：`TokenizedDepositFormContent` 只在 add 模式启用四步编排，edit 模式继续保留完整连续编辑表单；COA、账户类型、对账、密钥托管和管理员钱包组件增加 `embedded` 展示模式。
- 后续同类任务：参考外部组件时先区分“表单交互/字段结构”和“页面外围布局”；涉及共享 add/edit 内核时优先用 embedded 或 mode 分支隔离视觉变化，避免误改编辑页行为。

## kissen-admin 迁移验证收尾（2026-08-17）
- Radix `Select.Item` 禁止 `value=""`（运行时抛错，tsc/build 均不报）。「全部」选项须用哨兵值（各文件已有 `STATUS_ALL`），查询前 `!== STATUS_ALL` 过滤。
- Radix Tabs 的 `element.click()` 合成点击不生效（aria-selected 不变、不触发 onValueChange）；须派发完整 pointerdown→mousedown→pointerup→mouseup→click 序列。DataTable 列头 Tooltip 须 `header: () => (<TooltipProvider>…)` 回调形式，直接 JSX Element 类型不过。
- 运行时会话模拟三件套缺一不可：cookie `admin_platform_token` + localStorage `admin_platform_access_token` + `userInfo`（含 token 字段）；任一缺失→客户端 401→`clearSessionStorage`+`?expired=1` 踢回登录。kissen 后端鉴权用 `token` 头（非 Bearer），分页体为 `{page:{pageNum,pageSize},data:{}}` 嵌套结构。
- RHF 规则存在但 `formState.errors` 未渲染 = 静默阻断提交，须配 `<p role="alert" className="text-sm text-destructive">`；规范样例 settlement-pages.tsx。
- Phase 3 完整度审计结论：8 域对源 Vue 逐项对照，修复 8 项 partial 后全部 100%（矩阵 '/Users/zhangxuefeng/.omp/agent/sessions/-pi-cwd-20260601-admin-platform/2026-08-14T02-36-38-006Z_019ffe20-eaf6-7000-9ba2-315a4e54e0fa/local/kissen-completeness-matrix.json）。'

## kissen-gateway 迁移三轮收尾（2026-08-18）
- 代理链路：`next.config.ts` rewrite 用 `/kissen-api/:path*` 整段前缀剥离，后端收到 `/bankgw/portal/...` 原样路径；`/bankgw/brand` 在 /portal 外，用独立 baseURL `/kissen-api/bankgw`、不带 token、失败回退默认值。ResultInfo `code:'0'` 成功、`'2'` 未登录、`'MSG_24_0002'` 用户名或密码错误。
- 首登语义（源 store 仅 localStorage）：目标 middleware 服务端只能读 cookie，登录时双写 localStorage（`bankgw.token`/`bankgw.user`，axios 拦截器用）+ cookie `kissen_gateway_token`（SameSite=Lax）；`firstLogin===0` 由客户端 session-guard 强制跳 `/change-pwd`。middleware 未登录重定向必须携带 `?redirect=`（源 `to.fullPath` 语义），login 页 `searchParams.redirect || '/onboard'` 消费。
- `createFormResolver` 必须镜像 zodResolver 的 zod4 泛型签名 `<TFieldValues extends FieldValues, TContext, TOutput>`（`schema: z.ZodType<TOutput, TFieldValues>`），否则所有 `useForm+resolver` 调用点 TS2769/TS2344。
- 跨切片并行契约由主控预写数据域（如 menu 域 api/model/queries/keys）再 fan-out，角色分配/菜单管理/侧栏过滤三方消费同一确定性导出，避免并行切片各自定义漂移。feature index 的组件导出名是 registry 契约，拆分 system-pages.tsx 为四域文件时导出名不可变。
- 红线：确认弹窗一律 shared/ui AlertDialog（受控 target state + destructive Action），`window.confirm` 违反「UI 用本项目体系」按 0.5 扣分（R2 曾因此 93.33%）；全仓 kissen-gateway 范围 grep `confirm(` 应为 0。
- 菜单权限：源 `filterTree`（保留自身或后代命中 menuKey 的节点）+ `MENU_ROUTE_MAP`（menuKey→path 9 项）折算允许路径过滤 config 菜单；树加载失败回退全量。按钮级 `v-perm` 等价 `useGatewayPerm()`（menuKeys Set 动态判定）。
- 源死代码实证：`views/bank/info.vue` 零路由引用，`getBankInfo` 唯一消费方是 onboard 银行信息卡 → 并入 onboard 域（OnboardBankInfo），不迁移独立页面。dashboard 源项目不存在（'/' redirect /onboard），MockDashboardPage 连同 config/registry/index 导出全部清零。
- tsc 快速环：`cd apps/kissen-gateway-portal && pnpm exec tsc --noEmit | grep "error TS" | grep -v TS6305`（TS6305 为 monorepo dist 既有噪音），比 nx build（~2-3 分钟/轮）快一个量级，适合修复循环；终验仍须 nx build + nx lint。

- 背景：admin app（td-manage 迁移）登录失败曾静默（catch 只刷新验证码），且根 layout 未挂 `Toaster`，toast 全局不可见。
- 结论：登录失败提示统一走 `@myorg/shared/ui` 的 `useToast().error((e as Error).message || t('auth.loginFailed'))`（ApiError.message 已由 `normalizeApiError`/`getMessage` 规范化）；`apps/admin/src/app/[locale]/layout.tsx` 已挂 root `<Toaster />`，`tokenized-deposit-add-form.tsx` 内 feature 级重复 `<Toaster />` 已移除（sonner 多 Toaster 同 app 双挂会重复弹）。`libs/modules/*` 直接 `import { toast } from 'sonner'` 与统一入口是同一 sonner 实例，运行时无差异，仅依赖治理层面待收敛（lp-portal/data-access 因 type 边界禁止依赖 shared/ui 属合法例外）。
- 影响：admin 内所有 useToast/toast 调用点现在可见；后续新 feature 不再需要自挂 Toaster。
- 后续同类任务：modules-auth-ui 的 `type:ui → data-access` lint error（login-form/metamask-button/two-factor-form）与 admin 的 StablecoinTabs scope error 均为既有债，与 toast 改动无关，待专项清理。
- 登录页插画按 app 刻意差异化，勿再跨 app 同步 `public/login-illustration.svg`：kissen-admin=等距清算立方体（蓝）、kissen-gateway-portal=网关拱门+数据流（靛蓝/青）、lp-portal=三级流动性池+液流（紫/洋红）。共用约定：720×560 viewBox + `.float-a/.float-b/.pulse/.flow` CSS 动画 + prefers-reduced-motion 降级；新增浮动元素时 transform 定位须放外层 `<g>`，动画 class 放内层（CSS transform 会覆盖 transform 属性）。

## 2026-08-19 kissen 三系统 English-only + 隔离收尾（orchestrator）

- 共享 Header 的登出默认值不得 import 业务模块：`libs/shared/ui-layout/src/lib/header/header.tsx` 曾静态 import `@myorg/modules/auth/data-access` 的 `logoutApi`，导致所有消费方（含 kissen 三 app）tsc 报 TS6305 且 bundle 拖入 admin rbac。现默认分支仅 `logoutAndRedirect()`（本地清理+跳转）；有服务端会话的 app 传 `onLogout` 全权接管 —— admin 已在 `apps/admin/src/app/[locale]/(app)/admin-app-shell.tsx`（client 包装，因 layout 是 server component 不能传函数 prop）接管 `logoutApi()+logoutAndRedirect()`。
- shared barrel 再导出会保留动态 import：`util-config/index.ts` 再导出 module-registry（40 个 admin feature 的 `() => import(...)`），即使 kissen app 只用 `loadProjectConfig`，webpack 仍把全部 admin feature 打成异步 chunk。教训：**shared 包里任何可达的动态 import 都是隐性公共依赖**；验证手段是生产构建后对 chunk 做 fingerprint grep（如 `approval-manage/view`、`walletTypeManifest`、`/api/rbac/v1`），而不是只看 import 语句。
- 残留的 admin 痕迹属惰性数据而非代码：defaultConfig 的菜单 JSON（client chunk）与 i18n 全量 zh-CN catalog（server chunk）仍含 admin 菜单 id/文案，不构成功能泄漏；如需收敛须重构 config.defaults 与 messages 打包口径。
- 网关门户登录页品牌名（如「测试银行」）来自后端 `GET /kissen-api/bankgw/brand` 实时数据（next.config rewrite 指向测试环境），非 UI 硬编码；English-only 校验时勿误判为代码回归。
- lint：`// eslint-disable-next-line react-hooks/exhaustive-deps` 在本仓库 flat config 未注册该规则，每处都是 error；发现即删（共 6 处，lp-portal feature）。
- admin 既有债（勿归因新改动）：StablecoinTabs scope error、auth feature/data-access TS6305（需 nx 依赖构建而非裸 tsc）、admin layout 曾被用户 WIP 删掉 SessionGuard import。
- 浮动卡片规范（2026-08-19）：四 app 的 tailwind.config.ts（字节相同拷贝，须四处同步改）定义 `boxShadow.float/float-lg` 分层柔影；容器类组件统一「弱边框 + 浮影」：外层卡片 `border-border/60 + shadow-float`（Card 组件另有 hover:shadow-float-lg），内层表格/分隔线 `border-border/50`（DataTable wrapper、divide 行线、卡片标题 border-b）。页面级手写卡片容器（`rounded-lg border bg-card ... shadow-sm` 模式，~124 处，kissen-admin/kissen-gateway/lp-portal 三树已 codemod）新增页面时直接写 `rounded-lg border-border/60 bg-card ... shadow-float`，勿再引入 shadow-sm 边框卡片。表单控件（border-input + shadow-sm）不在该规范内。

## 2026-08-27 kissen-gateway-portal 迁移 P4 收尾（orchestrator）

- **后端环境事实要带时间戳**：10.0.7.87 的 currencypair/tx 接口曾在 verify 阶段返回 code 1（当时以 stub 留档），P4 终验时已恢复真实数据；`/bank/info` 仍 code 1。写报告必须写明「当日实测」，后续轮次先复测再引用旧结论。
- **侧栏 orderNum 排序的复合键模式**：后端菜单树父组与叶子各有 orderNum（如 `bank:system=100`、子项 1-4）。侧栏若按「叶子自身 orderNum」排序会把 system 组（子项最小=1）顶到最前；正确做法是复合键 `父组 orderNum×10000 + 叶 orderNum`，父组间次序由父节点决定（`apps/kissen-gateway-portal/src/app/[locale]/(app)/kissen-app-shell.tsx` collectAllowedPaths/sortModuleItems）。
- **bank_admin 的菜单树本就不含 market 键**（currencypair/lp/rate 不在其树中，overview/token/fx/bankquery 键不属于 gateway 的 MENU_ROUTE_MAP 9 键）——Business View 组不显示是权限过滤正确行为，勿当缺陷修。
- **shared 层默认行为变更必须留档**：`Breadcrumb` 的 findModuleLabel 让非首段命中 config id 时取 config label（原为 humanize slug），影响所有同仓 app；已按「路由 slug 与模块 id 同源」论证无害并在 shell-layer.md 附记披露。同类改动要么 opt-in 要么显式披露，不能默默改默认。
- **CDP 遍历 SPA 的坑**：`history.pushState` + `next.router.push` 混用会导致 h1 滞后 1-2 路由；纯 `await window.next.router.push(url, url)` + 固定延时才可靠。另 ErrorBlock 有 TanStack 重试退避，2200ms 内可能尚未出现，断言失败先怀疑时序。
- **verify 报告会滞后于并行修复**：终审发现两处「报告称有问题、代码已被兄弟 agent 修好」（toast 措辞、陈旧注释）。闭环方式是在原报告追加「主控闭环」附记，不改历史结论。
- `apps/kissen-gateway-portal/.env.local` 的 `NEXT_PUBLIC_DEV_LOGIN_*` 已被移除（W-4 治理后现状），登录页不预填；smoke 需手填凭据。另 admin/kissen-admin/lp-portal 的 .env.local 仍被 git 跟踪（跨 app 决策，待用户裁定）。

## 2026-08-27 update-gateway skill 落地（网关上游同步）

- 新增项目级 skill `.claude/skills/update-gateway/`：同步 GitLab 上游 `kissen-bank-gateway-frontend`（project id 2115，默认分支 main）增量到 `apps/kissen-gateway-portal`（用户明确：唯一目标，不含其他 app/libs）。流程：脚本检查更新 → 按日期总结文档（`.doc/kissen/project/gateway/`）→ ultrathink 规划 → orchestration 编排开发 → 独立 reviewer 子 agent 校验循环；进度事实在 `.claude/update-gateway-state.json` 的 `lastSyncedSHA`（仅校验通过才推进）。
- GitLab（10.0.6.203:8088）匿名 API 一律 404；项目访问令牌放 `.doc/kissen/.gitlab-token`（.doc/ 已 gitignore，`.claude/` 被 git 跟踪故令牌绝不入库），脚本 `check-updates.sh` 读它拼 `oauth2:<token>@` 远端 URL，缺失时回退本机凭证。
- 上游克隆缓存在 `.doc/kissen/.cache/kissen-bank-gateway-frontend`（.doc/ gitignore 内，勿再克隆第二份）；force push/rebase 由脚本以 `HISTORY_REWRITTEN=1` + merge-base 兜底。
- 踩坑：`git ls-remote --symref origin HEAD` 的 ref 行 `$2` 是 `refs/heads/<b>`，awk 需 `sub(/^refs\/heads\//,"",$2)`，勿带 `ref:` 前缀匹配（会拼出 `origin/refs/heads/main`）。
- 2026-08-27 实测上游有待同步增量 `8a6034b..a82d82c`（GW-14 UDPN 菜单对齐 + bug fixed），首轮执行 update-gateway 时应从此区间开始。

## 2026-08-27 LP Portal 重置迁移收尾（orchestrator）

- **后端 code 语义要以实测定**：LP 后端（10.0.7.87:8090）`{code:"2"}` 实测＝未登录/过期
 （message「未登录或登录已过期」）；`MSG_23_0024`＝下游 kissen-api 不可达（真降级码）。lp-client 的
 「code '2'→清会话回登录、0024→静默+页面 ServiceDownAlert」双分支经实测均正确。
- **后端菜单树 menuName 是中文，侧栏英文化要在前端映射**：`apps/lp-portal/src/lib/lp-routes.ts`
 新增 `MENU_LABELS`（menuKey→英文，叶子对齐各页 h1），未知键回退 menuName。同构 app（gateway）
 如遇同问题可复用该模式；纯靠后端改数据不可行。
- **LP 后端端点缺口要区分三类再定性**：404（/lp/token/list、/lp/split/list 等部署缺口）、
 0024（pool/pair 下游不可用）、正常（notification/user/log/tx-flow/settle）。前端端点与 Vue 源
 api/*.ts 逐一比对一致后即可判定非移植缺陷；报告里按三类留档
 （`.doc/kissen/project/LP/verify/responsive-sampling.md`）。
- **浏览器验证无 vision 模型时的替代**：DOM 级核验够用——`documentElement.scrollWidth>clientWidth`
 扫横向溢出 + `body.innerText.match(/\p{Han}/)`（剔注释无法在 DOM 做，innerText 即用户可见口径）
 + 表格 rows/cells/emptyCells 统计。全页截图用 puppeteer 原生 `page.screenshot({path})` 直存，
 `tab.screenshot()` 不接收路径且落盘目录难回溯。
- **topup 孤儿清理边界**：feature 页 + data-access 域整删；但 sync 域 `SyncDomainCode` 的 `'topup'`
 是后端 wire 枚举成员（1:1 对齐源契约）必须保留——删代码时先分清「页面/域孤儿」与「协议枚举值」。
- **评审编排效率样本**：三路 reviewer（Shell/auth、Market/Liquidity、Biz/System）并行 + 修复批
 三 agent 并行 + 单复核 agent 收口。复核轮抓到两个自报冲突（D7 列数文档笔误、源 apply 无确认弹窗）
 ——agent 以源为最高约束并写入文件头注释的做法值得沿用；基线文档笔误用【勘误】行内标注不改写历史。
- **config 驱动品牌主题模式（LP 主题系统）**：主题定义全部放 `configs/lp-portal.json`
 `theme.themes[{id,label,colors}]` + `defaultTheme`，ThemeInjector（layout.tsx）渲染
 `:root` 基线（merge defaultTheme）+ `[data-theme='id']` 块 + 防闪 inline script（读
 `localStorage['lp-theme']`）。加/调主题只改 JSON 不动 CSS。键名分两类：tailwind 消费键
 （primary/ring 给 HSL 三段式）、raw 整值键（brand-*/login-grad-*/banner-*/illus-*）。
- **SVG 跟主题必须内联**：`<img>` 加载的 SVG 是隔离文档吃不到页面 CSS 变量；mask/currentColor
 仅单色，不适用于双色 logo/多色插画。LP 的 LogoMark/login-illustration 均为 app 本地内联组件
 （`apps/lp-portal/src/components/brand/`），fill/stopColor 写 `var(--token, 原hex)` 双保险。
- **shared 层 opt-in 插槽先例**：mock-login 的 `illustration?: ReactNode`（替代 svgPath img）、
 AppShell/Header 的 `logo?: ReactNode`（替代 /logo-icon.svg img）——不传则原行为逐像素不变
 （gateway 实测回归：渐变首色 #c6c7ff、无 data-theme、仍用 img 插画）。跨系统共用组件的默认值
 一律保留原字面量，var 化由调用方传参完成。
- **feature 库 index.ts 不能导出非组件值**：`module-page-registry` 用
 `(m as Record<string, ComponentType>)` 取导出，导出 string 常量（如 LP_THEME_STORAGE_KEY）
 会炸 LP 生产构建的 TS 检查——常量留在组件文件内即可。
- **共享 layout 透传链最小化**：trailing/logo 只穿 AppShell→sidebar-layout→Header；top-nav/
 compact/dual-panel 三个 layout 本就未接 trailing，不加死管道，需要时再补。
- **util-config 既有闸门缺口（HEAD 上已存在）**：lint 挂在 config.loader.ts 相对路径 import
 configs/*.json（@nx/enforce-module-boundaries 9 处）；test target 无 jest.config.ts 无法跑。
 与主题 schema 改动无关，未在本轮修。
- **lp-sync skill（上游 Vue → lp-portal 增量同步）**：上游 GitLab 仓
 `kissen-lp-portal-frontend` clone 于 `~/repos/kissen-lp-portal-frontend`（默认分支 main）。
 skill 在 `.claude/skills/lp-sync/`：SKILL.md（六步流程）+ `scripts/diff-upstream.sh`
 （fetch+diff，`--apply <sha>` 推进水位线并校验后代关系）+ references（constraints/pitfalls/
 conventions）。状态文件 `.doc/kissen/project/LP/sync-state.json`：`specBaselineSha=dd9e950`
 是文档 01 行为规格的锚点（经整树 diff 验证 Downloads 快照==dd9e950，只读永不推进），
 `lastSyncedSha` 是同步水位线（只能脚本推进）。核心纪律：先改文档 01（规格保鲜）再改代码；
 上游代码是行为规格不是模板，UI 一律用本项目体系重写。
- **上游漂移陷阱**：diff 只比较两端树——中间 commit 加了又删的文件（如 6636680 加的
 source-receipt 真页被 902c11c 删除）不会出现在 `A/D` 清单里，判断"上游现状"必须以 HEAD
 树为准（`git ls-tree`），不能只看 commit 信息。截至 2026-08-28 待同步：dd9e950..171ee44
 （receipt 真页加而复撤→占位仍有效；rate 并入 token 对；新增 dashboard；SRC/TGT 紧凑式）。
- **三门户同步 skill 全家福**：lp-sync / gateway-sync / admin-sync 三套同构 skill 在
 `.claude/skills/`（SKILL.md 六步流程 + scripts/diff-upstream.sh + references
 constraints/conventions），核心纪律一致：先改行为规格文档再改代码、水位线只经脚本 `--apply`
 推进、上游代码是行为规格不是模板。三上游 clone 于 ~/repos/（kissen-lp-portal-frontend
 main、kissen-bank-gateway-frontend main、kissen-admin-frontend **v2.0-tokenization 分支**）。
 状态文件分别在 .doc/kissen/project/{LP,gateway,admin}/sync-state.json。
- **gateway-sync 基线**：specBaseline=lastSynced=a82d82c（gateway 六件套 01 已刷新到该语义）；
 下游 1a775c1..a82d82c 的 v2.0 差距已裁决单独立项（00-README §3 O-1），不归 sync 管。
- **admin-sync 特殊性**：无迁移文档基线，specBaselineSha=null，首次运行必须走盘点模式
 （建 .doc/kissen/project/admin/01-功能全量清单与迁移矩阵.md）；锚点 99dcd0c 为保守锚定
 （monorepo 最后 kissen-admin 工作 2026-08-19 c3b7456 之前的最近上游 commit），积压 19
 commit 含 v2.0 token 化重构（risk/currency/topup/split-transfer 域删，token/instance/log
 域增）。admin 上游以 v2.0-tokenization 分支为准，不是 main。
- **admin 下游 feature 文件与上游 views 非一一对应**（risk-pages/currency-pages 无同名
 upstream 目录），映射待盘点校准，state 文件里有 unmapped 标记。
- **主题系统规则已入三个 sync skill**（references/conventions.md §6 + SKILL.md 第 4 步指引）：
 上游颜色值一律映射主题 token 禁止直写；权威规格=.doc/kissen/project/LP/06。现状：lp-portal.json
 themes=3（default=emerald，已从 violet 改过）；kissen-gateway.json / kissen-admin.json 有 theme
 节但 themes=0 未接入。目标态：三个项目各有独立 3 套主题、配色互不复制、config 自定义
 （加主题只改 JSON，19 键/主题；localStorage key 每项目独立；品牌 SVG 必须内联绑 var）。
- **lp-sync v2.3 首次增量同步完成**（dd9e950 → e591f850，5 commit）：rate 域/页退役
 （汇率三列并入 pair 双 tab）、receipt 占位删除、dashboard 新落地页（统计卡四宫格 +
 My Pools 水位条封顶 100% + VolumeChart 自绘 SVG 折线 + 最近交易 7 列）。
- **txNo 固定口径**（v2.3）：列表/抽屉/split 明细/settle 流水一律 `txNoText()=txNo||'-'`，
 不再回退 txUuid；txUuid 移作抽屉「Bank Idempotency No.」独立项。
- **dashboard 交易状态 tag 是独立口径**（DASHBOARD_TX_STATUS_VARIANT：35|40→default、
 60|70|90→destructive、80→outline、其余 secondary），与 tx-flow 列表口径并存都保真，
 勿"统一"两套（文档 01 §E21）。
- **useTokenMeta(projectId)**（data-access/lib/token-meta.ts）：token/list 全量建
 tokenNo+tokenCode 双键索引，出口 label/bankOf/symOf，lookup 失败回退传入标识；Vue 的
 模块级缓存+inflight 去重在 React 侧由 TanStack Query 等价承载。
- **自绘 SVG 折线（volume-chart.tsx）**：viewBox 720×240、y 全域 min~max 归一化（全等
 ±1 压中轴）、稀疏序列按 day.slice(5) 补 0、x 刻度 ≤7 全标否则首/中/尾；色板映射
 tailwind 语义类（stroke-emerald-700 等）+ 网格 stroke-border，不直写上游 hex；
 preserveAspectRatio 不可设 none（会拉伸圆点/文字）。
- **教训：块注释里写 `stroke-*/fill-*` 会提前闭合注释**导致 webpack Syntax Error；
 **edit 工具行号漂移时 PUT 会打到错行**——误编辑后必须 read 现场再修，勿凭记忆续写。
- **BFF 缺口**：10.0.7.103:8090 尚无 GET /lp/dashboard/volume（404），前端空态降级正确；
 summary 正常。待网关部署 v2.3 后补验折线有数据形态。
- 验证截图已更新 .doc/kissen/project/LP/verify/（rate/receipt 旧图已删）。

## 2026-08-28 kissen-admin v2.0 token 化全量补同步（99dcd0c → 787ccc9）

- **registry 键 = 菜单 id = 路由 slug[0]，v2.0 菜单树一次定稿**：`configs/kissen-admin.json` 的 modules.enabled/order、`module-page-registry.ts` 键位、`page.tsx` GROUP_ENABLED_KEY 三处必须同轮改，漏一处即整组页面 404。v2.0 键位：onboard/{bank,instance,token,lp,lp-pair}、fx-rate/pair、liquidity/pool、settle/{order,cycle}、transfer/tx、system/{user,role,menu,workflow,log} + 平铺 dashboard/approval。分组页（GROUP_ENABLED_KEY）只认组段前缀（onboard/fx-rate/liquidity/settle/transfer/system），叶子不再进该表。
- **registry loader helper 模式**：top-level `import type * as KissenFeature` + `const loader = (pick: (m: typeof KissenFeature) => unknown): PageLoader => () => featureImport().then(...)`，杜绝 inline `import("pkg").Type`（ts-import-type 规则会拦）；loader 参数必须是字面量字符串（webpack 静态分析）。
- **kissen-client 业务 code='2' 会话过期分支**（对齐 LP portal 已实测语义）：响应拦截器 `code==='2'` → 清会话 + `?expired=1` 跳登录，与 HTTP 401 同径。dev 冒烟中真实触发（会话过期中途被踢回登录页）——分支已被生产流量路径验证。
- **全量补同步编排**：8 agent 并行（Bank/Token/Lp/Fx/Tx/Settle/System/Dash），文件互斥独占 + 共享契约文档（'/Users/zhangxuefeng/.omp/agent/sessions/-pi-cwd-20260601-admin-platform/2026-08-28T03-23-26-171Z_01a04664-cc5b-7546-b44c-4fb1a587a4c2/local/admin-v2-contract.md）+' 跨 agent 契约只两条（tokenList/TokenRow、lpSettleCycleList/Save），一次批跑无冲突。跨 agent 契约「提供方先定签名、消费方直接按契约 import」在同批并行下可行。
- **wave 收敛踩坑**：①整文件重写的页面易丢 import（lp-liquidity 块注释未闭合吞掉整个 import 区；formatAdminDateTime/FormField/SETTLE_ORDER_STATUS_VARIANT/WorkflowRow 漏 import）——nx build 逐轮暴露太慢，用 `cd apps/<app> && npx tsc --noEmit` 一次枚举全量类型错再批量修；②DataTable 行键覆盖模式 `rows.map(r => ({...r, id: String(r.id)}))` 在 model 自带 `id: number` 时（LpPairRow）与列泛型 `LpPairRow & {id: string}` 冲突（id: number & string = never），须 `Omit<T,'id'> & {id:string}` 别名统一列/回调/弹窗 props；③上游 08-27 给 TransactionRespVO 加了 senderAccount/receiverAccount（列表 From/To 钱包列），照抄上游 interface 时要以最终上游为准。
- **上游自身不一致的处置**：v2.0 workbench 仍保留「对账差异」卡片但链到的 reconcile 页已被 v2.0 删除（§G：删页面+菜单、api 保留）——下游保留卡片计数、去掉死链按钮，不产 404 路由。
- 验证留档：build+lint 清零；dev 冒烟 17 页全绿 + 1280×800 截图存 `.doc/kissen/project/admin/verify/v2-sync/`；水位线已经 `diff-upstream.sh --apply` 推进到 787ccc93。fx 建对弹窗勾选挂行（1841ba1 核心）运行时验证需后端有 Active token 种子数据，本轮仅静态保证（ComboRow.checked 字段挂行）+ 页面渲染验证。

## 2026-08-28 kissen-admin 侧栏切 menuTree 驱动（全对齐裁决）

- **用户裁决「一个对一个功能，完全对接」推翻原 accepted divergence**：kissen-admin 侧栏原为静态 configs 驱动（kissen-app-shell.tsx 旧注释明示偏离），与上游 Vue（MainLayout 消费 store.menuTree）不一致——后端菜单重构（LP Management 组、FX Management 组并 transfer:tx 等）本地永远看不到，即「远程新增功能/菜单没同步」的根源。
- **后端 menuTree 是运行时真相**：`/rbac/login` 响应含 `menuTree`（自带 `menuNameEn`，零 CJK 无需前端映射表，优于 LP portal 的 MENU_LABELS 模式）；同 key 可在 GitLab `ls-remote` 验证前端仓库无新提交——「没同步」要区分仓库增量与后端运行时数据两类。
- 实现：login 把 `menuTree` 挂进 User 快照（索引签名透传，`userInfo` localStorage 持久化、登出随 clearSessionStorage 清除）；kissen-app-shell `toModuleItems()` 映射（visible=0 过滤、menuType=4 按钮剔除、orderNum 排序、children→分组、menuUrl→path、未知 key 落 registry placeholder）；configs 树降级为无会话/SSR 兜底。registry 增 `workbench` 键（后端 menuUrl=/workbench，`/dashboard` 保别名），enabled 增 workbench，登录默认跳转改 /workbench。
- 后端 menuTree 无 risk:reconcile/risk:monitor-hit（服务端已撤）；上游 MENU_ROUTE_MAP 残留此二键属上游过渡期脏数据，前端 views/ 亦无对应文件。

## 2026-08-28 kissen-gateway UDPN 改版增量同步（a82d82c → 39c8a2b）

- **`npx nx dev` 卡死绕行**：@nx/jest plugin 使 project graph 构建挂起（`nx reset` 无效），直接 `cd apps/kissen-gateway-portal && npx next dev -p 4200` 绕过；hub daemon 名被污染后不可复用，起 daemon 前先 ps 确认。
- **kissenPage mock 形状**：`POST */page` 回 `{code:'0', data:{rows:[...], page:{total}}}`，不是 `{records,total}`——mock 冒烟列表空必先核 kissen-gateway-client.ts 的解包字段。
- **浏览器冒烟必须 mock `GET /bank/detail` 且 `onboardStatus:20`**：useGatewayLockState 无条件拉 detail，未入网态任何受控路由都会被单向纠偏重定向到 /onboard（该纠偏本身即门控行为，非 bug）。
- **recharts dataKey 含 `/` 会被按对象路径解析**（如 `PR-A/B` 切成路径）：折线序列用 s0/s1 安全 id + `<Line name>` 展示名；UNKNOWN 键 legend 显示 'Unsynced'。零新增依赖约束下用 recharts（根 package.json ^3.8.1）替代上游 echarts。
- 英文术语定稿：Pending Review/Rejected（token 5/15）、Onboard/Registered、Up to date/Synced N items、'Unsynced'。token refresh mutation 保留仅删 UI 入口（上游 onRefresh 同构）。
- 验证：build+lint 清零；7 页浏览器 mock 冒烟全绿，截图存 `.doc/kissen/project/gateway/verify/39c8a2b-smoke/`；水位线已 `--apply` 到 39c8a2b3。sync-state.json 旧 note「1a775c1..a82d82c v2.0 差距单独立项」已过时，本次 delta 已全量同步。
- **深度审计补丁**：volume 图空态曾加严为「全零序列也显示空态」，与上游 `volumeEmpty = entries.length === 0`（有键即画平线）不符，已改为严格对齐并双场景冒烟（全零键→平线+legend；无键→EmptyHint）。教训：对齐上游时勿自行「优化」边界条件。

## 2026-08-28 kissen-admin 品牌主题系统接入（azure/midnight/cobalt）

1. **三主题蓝系家族立品牌，accent 拉开辨识度**：azure(210°, 默认)/midnight(222°)/cobalt(220°)，accent 分别钢银/琥珀金/珊瑚橙——主 hue 避开 LP(violet 241/teal 187/emerald 160)与 gateway(靛/青)，id 三项目不重复。色板经预览页(`theme-preview/preview.html`)用户确认后落地。
2. **SVG 表现属性不支持 `var()`**：内联插画组件的颜色必须走 `style={{stopColor:'var(--illus-x,#fallback)'}}` 对象形式（React JSX style 不接受字符串）；机械转换 SVG→JSX 时注意 `<g fill>` 也要进转换面、`#6B8EE5` vs `#6B8EF5` 这类仅末位差异的色值极易漏桶。
3. **登录页品牌色原来直接照抄 LP violet 的 hex**（#001a98/#00a5d5/#554eea）——主题接入时全部 de-LP 化改绑 token。教训：跨 app 复制页面时品牌色值会静默跟随来源项目，接入主题系统时是集中清除点。
4. **admin 会话 = cookie(TOKEN_COOKIE_KEY) + localStorage(userInfo) 双处**：浏览器冒烟清会话必须连 cookie 一起清，只删 localStorage 会被 auth guard 弹回 dashboard。
5. **Radix DropdownMenu 偶发鼠标点击不开**（pointer-events 正常仍无响应）：自动化测试里用 focus + Enter 键盘路径稳定打开；switcher 三项下拉已实测可切换。
6. 验证：tsc/lint ✅；实测 azure/midnight 切换、`--primary`/`--brand-deep`/`--illus-accent` 联动、刷新首帧防闪（domcontentloaded 时 data-theme 已就位）、localStorage 持久化、登录页内联插画跟随主题。截图 `.doc/kissen/project/admin/verify/theme/`。
