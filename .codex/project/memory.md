# Codex 对话沉淀

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
