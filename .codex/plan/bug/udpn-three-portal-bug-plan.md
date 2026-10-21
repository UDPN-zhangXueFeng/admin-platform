# 三端 Bug 修复计划（待确认）

> **状态：S 档代码已实施；LP Dashboard/Split & Settlement 与 Gateway Transaction Detail 的浏览器 smoke 已通过；kissen-admin 数据页验证因后端连接超时受阻；M/L/XL 尚未开始。** 本次三 app build、三 feature lint 通过；LP 与 Gateway feature test target 以“无测试”状态退出 0。下表“需求就绪度”是基于现有截图、代码和 API 证据的可实施程度估计，不代表代码完成百分比。

## Objective

按飞书文档《UDPN组 2026年10月20日》及配图修复 kissen-admin、LP Portal、Gateway 三端的展示、状态、分页与结算相关问题。先核准截图对应页面和后端数据口径；再按当前 Nx 分层做最小改动。

## Scope and constraints

- 可改范围：`apps/kissen-admin`、`apps/lp-portal`、`apps/kissen-gateway-portal`，及对应的 `libs/modules/kissen-admin`、`libs/modules/lp-portal`、`libs/modules/kissen-gateway`。
- 不改 `libs/shared/*`、根配置或后端。分页复用现有 `DataTable`；只调整允许范围内的调用页，不改共享表格实现。
- 不在前端推导/伪算财务汇总，不用静态值掩盖缺失数据。交易详情已有源/目标币种展示的页面先复核真实数据和截图，避免重复重做。
- 跨系统统一采用各应用现有组件和代码风格，不新增 shared 抽象。
- 路由均已注册；本计划不预设新增路由。

## 实施前基线（S 档改动前）

> 以下描述为本次 S 档实施前的代码状态；实施后以“修改评估排序”和“S 档实施记录”为准。

- **kissen-admin Supported Token Pairs**：`libs/modules/kissen-admin/feature/src/lib/lp-liquidity-pages.tsx` 的 `LpTokenPairListPage` 与 `LpInfoDetailPage` 分成单元格在无覆盖值时显示 `-`；`lp-pair.model.ts` 已有 `defaultSplitRatio`，且注明 `splitRatio=0` 应回退默认分成。
- **结算显示**：kissen-admin `settlement-pages.tsx` 的订单行、详情副标题和详情字段都显示 Statement ID；分项表已按 pair 组织，金额按源 token 精度格式化但不显示币种单位。LP `split-settle-pages.tsx` 当前有单独 `Token` 列与 `Token Pair` 列，金额无单位后缀。
- **LP Dashboard / Pool / Pair**：`dashboard-pages.tsx` 的资金池筛选默认 `all`，有 `Below Minimum`；`Revenue & Settlement` 为静态 filler。`pool-pages.tsx` 的 Basic Information、Balance & Authorization、Transactions 为三 Tab，Transactions 是硬编码空表且当前模块没有按池地址取交易的 API。`pair-pages.tsx` 有 Standard Share 与 Readiness（含 Pool ready）列，Pair Code/Status 是本地筛选。
- **LP 收益结算**：`split-settle-pages.tsx` 的 My Share (MTD) 是静态 fallback，当前 tabs 顺序为 effective/details/statements；模型包含周期字段和 per-order pair items，但生成/计算逻辑属于 LP 后端。
- **交易详情**：kissen-admin `transaction-pages.tsx` 和 LP `tx-flow-pages.tsx` 已显示 source/target 金额及币种。Gateway `tx-pages.tsx` 也显示两侧币种，但另有 Transaction Log 和 Transaction Chain。LP 详情依赖列表行暂存与 chain 请求；直接深链缺少暂存行时会显示 not-found，改版须保留该语义。
- **状态**：同一交易状态码的前端文案不一致：例如 code 35 在 LP data-access 模型为 Completed、LP feature 为 Credited、kissen-admin 为 Settled；Gateway feature 也有 Credited 显示，而 data-access 码表将 35/40 都标作 Completed。必须先由后端确认权威状态语义。kissen-admin Cycle Settings 另有独立状态映射，需确认 15:57 截图对应哪一页。
- **分页**：kissen-admin Cycle Settings、用户、角色、操作日志等列表未传 `onPageSizeChange`；Gateway 操作日志仍用自定义 `LogPager`；LP 同时存在服务端分页、未分页列表和卡片自定义分页。现有 DataTable 只有在传入 `onPageSizeChange` 时显示页大小选择器；LP pair/pool 接口未提供服务端分页参数。
- **管理页**：kissen-admin 与 LP 菜单管理都使用左树+右侧 Menu Details 表单。kissen-admin 右侧是现有菜单新增/编辑/权限配置入口；整块删除会移除功能。LP Portal 登录后标题来自 shell 传入的项目名，`AppShell` 已支持隐藏项目名。

## 评估口径与排序规则

- **难度**综合代码改动面、交互复杂度及外部依赖：S＝局部展示/单页修改；M＝多个组件或分页交互；L＝跨页/跨端对齐或需较多行为核对；XL＝缺少后端能力、数据口径或外部设计依据，当前不能端到端完成。
- **需求就绪度**按 0–100% 估算：高＝目标页面和数据字段基本明确；中＝页面已定位但范围/验收口径仍需确认；低＝缺少权威数据、接口或设计依据。
- 排序先按难度 S→M→L→XL；同档按需求就绪度由高到低。百分比是规划估值，不是承诺工时或交付进度。
- **代码完成度**只计源代码实现与 build；S 档修改已完成，交易双币种项为源码核验（未发现需改代码），M/L/XL 尚未开始。受保护页面的视觉 smoke 未完成，不以 build 通过代替。

## 修改评估排序（由简单到困难）

| 顺序 | Bug / 拟修改内容 | 难度 | 需求就绪度 | 代码完成度 | 评估依据与限制 |
|---|---|---:|---:|---:|---|
| 1 | **复核交易详情源/目标币种两列**（15:56、16:07、16:31） | S | 95% | 源码核验满足；Gateway 实测通过，LP/admin 真实交易详情未验证 | 三端源码均显示两侧币种；Gateway 交易 125 实测 Sent 10 CF7 → Received 9.9009901 USD12。LP FX 列表返回 0 条；kissen-admin 后端 10.0.7.103:9000 连接超时。 |
| 2 | **Gateway 移除 Transaction Log**（16:07） | S | 95% | 100%* | `tx-pages.tsx` 卡片及专用渲染已移除；真实交易 125 实测页面不含 Transaction Log、保留显示 6 条 Transaction Chain 记录。 |
| 3 | **kissen-admin 默认 LP Fee Share 回退**（15:54） | S | 90% | 100%* | 两处展示均优先 override，否则回退 `defaultSplitRatio`；显式默认 0 可显示 0%，空/无效默认显示 Dash。代码与 build 完成；Admin 后端不可达，真实数据 UI 未验证。 |
| 4 | **LP 登录后 Header 移除项目名**（16:15） | S | 90% | 100%* | `lp-app-shell.tsx` 使用现有隐藏项目名选项；实测登录后 Header 不显示 LP Portal，登录页品牌未改。 |
| 5 | **LP Dashboard 默认 Below Minimum 并移除静态 Revenue & Settlement 面板**（16:23） | S | 85% | 100%* | 默认筛选、静态面板移除与全宽图表均实测通过；保留独立的 Revenue Share (MTD) KPI。旧版设计恢复另列为 XL。 |
| 6 | **LP 收益结算 tabs 调序**：交换 Revenue Share Details 与 Settlement Statements（16:41） | S | 85% | 100%* | 显示顺序已调整；`?tab=effective`、`?tab=statements`、`?tab=details` 均实测映射正确，当前 `details` 默认语义保持不变。 |
| 7 | **kissen-admin 移除 Statement ID 展示**（15:58） | S | 65% | 100%* | 列表、详情副标题、详情字段中的可见 ID 已移除；`orderId` 路由、行标识与操作保留。代码与 build 完成；Admin 后端不可达，真实数据 UI 未验证。 |
| 8 | **LP Pool Detail 合并前两 Tab**（16:27） | M | 85% | 0% | 两个已有区块可合并；第三个 Transactions Tab 为空，如何处理另列 XL，不能用假数据补齐。 |
| 9 | **Gateway Operation Logs 分页统一**（16:06） | M | 80% | 0% | `LogPager` 已定位，可接入现有 DataTable 分页；需确认统一页大小及截图覆盖范围。 |
| 10 | **kissen-admin 缺少页大小控件的列表补齐分页**（16:06） | M | 75% | 0% | Cycle Settings、用户、角色、操作日志等调用点已定位；只改模块调用方，不改 shared DataTable。 |
| 11 | **结算金额显示币种单位；移除 LP 独立 Token 列**（16:33） | M | 70% | 0% | LP 分项表有 `Token Pair` 与 `Token` 两列且金额已有 currency 数据；保留 Token Pair。kissen-admin 只有 pair 标识列，若要删除它须另行确认。 |
| 12 | **LP Token Pair Management 移除 Standard Share/Pool ready 并增加查询**（16:30） | M | 65% | 0% | 页面和本地数据已定位；要确认移除的是 Pool ready 标记还是整列、是否影响 Dashboard/Split & Settlement，以及查询是文本还是选择器。 |
| 13 | **三端交易详情布局统一**（16:31） | L | 50% | 0% | 源/目标币种已显示；需要确认 canonical 页面和区块顺序，并保留 LP 详情依赖列表暂存行的深链语义。 |
| 14 | **LP 列表分页统一**（16:06） | L | 45% | 0% | 当前有服务端分页、全量接口和卡片分页；pair/pool 无服务端分页参数。需确定覆盖页，并区分客户端分页与服务端分页。 |
| 15 | **三端用户/角色/菜单页统一及用户详情优化**（16:09、16:11、16:39） | L | 40% | 0% | 页面已定位，但管理系统基准和视觉验收点不明确。Menu Details 是编辑/权限入口，不可未经确认删除。 |
| 16 | **Gateway Overview 图表问题**（16:02） | L | 40% | 0% | 候选页是 `overview-pages.tsx` Transaction Trend；需先复现图表异常并确认期望值、图例和时间范围。 |
| 17 | **三端交易状态码文案/终态统一**（15:57） | L | 30% | 0% | code 35 在现有模型/feature 中文案不一致；需先确认后端权威映射，并确认反馈是否其实指 Cycle Settings。 |
| 18 | **LP 移除 MTD 并增加真实周期指标**（16:37） | XL | 25% | 0% | 目标周期、统计口径及 API 字段未知；不得把静态 fallback 换成另一个静态值。 |
| 19 | **Settlement Statement 按 cycle × pair 计算/生成**（16:34） | XL | 20% | 0% | UI 模型已有周期和 per-pair items，但实际生成/计算在后端且不属于本次允许改动范围。只有后端接口返回最终粒度后才能完成前端展示。 |
| 20 | **Pool Detail Transactions Tab 提供真实数据或移除**（16:27） | XL | 20% | 0% | 当前没有按 pool 取交易的 API；需后端能力或用户明确批准移除入口。 |
| 21 | **恢复 LP Dashboard“上次版本”**（16:23） | XL | 10% | 0% | 仓库内没有可恢复的旧版设计；缺少目标截图/版本，当前不能可靠实施。 |

**暂不纳入修改排序：** 16:13 的 UI Setting 只有截图，没有文字反馈；在明确指出要改的内容前仅作参考，不计为可实施 bug。

* `100%` 表示代码修改及 app build 完成，不等于真实数据下的浏览器 smoke；具体验证限制见各行说明。

## 分档执行说明

- **S 档**：代码修改与 build 已完成；LP/Gateway S 页面 smoke 通过；kissen-admin API 验证因后端连接超时未完成。S 范围之外的修改按后续确认推进。
- **M 档**：再处理多组件展示、字段单位与分页调用。客户端分页只用于接口已经返回的全量数据；不得把它描述成服务端分页。
- **L 档**：先确认视觉基准与问题复现步骤，再实施跨页面/跨端一致性、图表和状态映射。状态映射必须有后端权威码表。
- **XL 档**：作为明确阻塞项，不得以删入口、静态值或前端估算冒充完成。需要后端接口/确认或用户补充设计资料后，另行完成。
- 所有移除项都限定在确认的截图范围：保留 `orderId`、Token Pair 关联和菜单编辑能力；保留 Gateway Transaction Chain。

## 阻塞依赖

- **后端契约**：交易状态 30/35/40 的含义；cycle × pair statement 是否由 API 返回最终结果；MTD 替代周期的真实统计字段；Pool Transactions 数据接口。
- **设计依据**：LP Dashboard“上次版本”、三端管理页统一基准、16:02 图表预期、16:11 User Details 优化样式。
- **范围确认**：Statement ID 的删除范围、Token 与 Token Pair 列的区别、Pool ready 影响页面、LP 标题是否只针对登录后 Header、分页覆盖范围。

## Success criteria

- 未设置 LP 分成时，kissen-admin 的列表与详情都显示 pair 默认分成；显式覆盖值优先。
- 交易状态文案与后端权威码表一致，列表、详情 badge 与链路终态不互相矛盾。
- 结算金额单位明确；statement 粒度与金额只展示后端确认的数据，不跨币种相加、不由 UI 推算。
- LP Dashboard 默认展示已确认的不健康池集合，Revenue & Settlement 静态卡片不再出现；Pool Detail 无假数据空表。
- Gateway 详情不显示 Transaction Log，降级文案无失效引用，Transaction Chain 保留。
- 指定列表按统一分页规格工作，筛选、翻页、改变页大小、重置后页码一致。
- 选定的用户/系统/菜单页在各门户视觉一致，且菜单编辑、权限配置能力仍可达。
- LP header 只移除确认范围内的项目名；登录品牌保持不变。

## Verification plan（实施后）

- Build：`pnpm exec nx build @admin-platform/kissen-admin`、`pnpm exec nx build @admin-platform/lp-portal`、`pnpm exec nx build @admin-platform/kissen-gateway-portal`。
- Lint：`modules-kissen-admin-feature` / `modules-kissen-admin-data-access`、`modules-lp-portal-feature` / `modules-lp-portal-data-access`、`modules-kissen-gateway-feature` / `modules-kissen-gateway-data-access` 中实际改动的项目。
- Tests：LP 与 Gateway feature/data-access 有 Nx test target，但当前模块未发现 feature spec；Gateway 现有测试主要在 data-access。kissen-admin feature/data-access 当前只有 lint target。对状态码、分成 fallback、pair/cycle 数据展示补可验证的行为回归；测试配置缺口不通过修改 shared/root 配置绕过。
- Browser smoke：通过 locale 前缀路由走查 Supported Token Pairs、Settlement Statements/Cycle Settings、LP Dashboard/Pool Detail/Token Pair/Split & Settlement、Gateway Overview/Transaction Detail/Operation Logs，以及纳入统一范围的 User/Role/Menu 页面；使用真实 API 样例验证状态、币种单位、过滤、分页与空态，并保存 UI 对照截图。

## S 档实施记录

- **代码变更**：完成 Gateway Transaction Log 移除、kissen-admin LP Fee Share 默认值回退与 Statement ID 隐藏、LP Header 项目名隐藏、Dashboard 默认 Below Minimum/静态面板移除、Settlement tabs 调序。交易双币种项经源码检查已满足，未额外改动。
- **Build**：`pnpm exec nx run-many --target=build --projects=@admin-platform/kissen-admin,@admin-platform/lp-portal,@admin-platform/kissen-gateway-portal --parallel=2` 成功。
- **Lint**：三个受影响 feature 项目均通过：`modules-kissen-admin-feature`、`modules-lp-portal-feature`、`modules-kissen-gateway-feature`。
- **Tests**：LP 与 Gateway feature test target 均退出 0，但 Jest 输出 `No tests found`；kissen-admin feature 当前没有 test target。
- **LP smoke**：Dashboard 实测默认选中 Below Minimum、保留 Revenue Share (MTD) KPI、无独立 Revenue & Settlement 面板、Volume 卡片与池区同宽；登录后 Header 不显示项目名。Split & Settlement 标签顺序及 `?tab=effective`、`?tab=statements`、`?tab=details` 均通过。FX Transactions 返回 0 条，未能真实核验 LP 交易详情。
- **Gateway smoke**：真实交易 `id=125` 显示 Sent `10 CF7`、Received `9.9009901 USD12`；页面无 Transaction Log，Transaction Chain 显示 6 条记录。
- **kissen-admin smoke 阻塞**：Supported Token Pairs 列表页 shell 可渲染，但 `/v1/manage/*` 请求未返回；直连 `http://10.0.7.103:9000/` 经 curl 8 秒连接超时。Fee Share 与 Statement ID 的真实数据 UI 验证未完成。


## 待用户确认

1. 15:57 状态问题具体属于交易状态还是 Cycle Settings？交易状态码 30/35/40 的权威后端文案是什么？
2. 16:02 是否为 Gateway Overview 的 Transaction Trend 图？预期图形、数值、图例和时间范围应如何显示？
3. Settlement Statement 的 cycle × pair 由哪个后端接口保证？当前 per-order items 是否为最终计算值？周期边界、单位和舍入是否有要求？
4. 是否还要求从 LP Portal 移除 Statement No.？16:33 要移除的是 LP 独立 Token 列，还是 Token Pair 列？
5. MTD 要替换成哪个周期指标及真实字段？
6. Pool Detail 的空 Transactions tab 要接真实数据还是移除？“按上次版本改”对应哪份旧版/截图？
7. Token Pair 查询采用文本还是 pair 选择器？Standard Share/Pool ready 的移除范围仅列表页还是也包括 Dashboard/Split & Settlement？
8. 管理页统一以哪个系统为基准？16:09/16:39 的视觉验收点是什么？kissen-admin Menu Details 的“去掉”是隐藏空态、改成弹窗还是移除其他元素？
9. LP Portal 标题是否也要从登录页移除？当前只在登录后 Header 隐藏。
10. 分页统一覆盖哪些列表，是否采用现有 DataTable 页大小控件？无服务端分页 API 的全量列表是否接受客户端分页？
11. 16:11 User Details 的具体优化点是什么？16:13 UI Setting 截图是否只有参考作用，还是另有明确修改要求？

## 建议执行顺序

1. **完成 S 档 Admin smoke**：恢复到 10.0.7.103:9000 的网络可达性后，核验 LP Fee Share 默认回退与 Statement ID 隐藏；LP/Gateway smoke 已完成，不需重跑。
2. **M 档**：范围确认后处理 Pool Detail 合并、Statement 金额单位、Token Pair 查询和分页调用。
3. **L 档**：补齐图表复现、状态码权威来源和视觉基准，再做跨端交易详情、管理页面、分页及状态一致性。
4. **XL 档**：等待后端契约、真实数据接口或旧版设计资料；若超出本仓库权限，另行授权后端工作，不在前端降级伪造。
5. 每个档位实施后执行对应 app build、模块 lint/可用测试及浏览器 smoke；验证内容以本计划的 Verification plan 为准。

**暂停点：** S 档代码、build/lint 与 LP/Gateway 浏览器 smoke 已完成；Admin 真实数据验证因 10.0.7.103:9000 连接超时受阻，恢复后端可达性后继续。M/L/XL 未实施，需后续确认后推进。
