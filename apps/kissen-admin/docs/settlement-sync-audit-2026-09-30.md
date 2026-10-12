# 结算单恢复与上游差异核对（2026-09-30）

## Kissen 业务基线与当前实现

当前分支 `feat/prototype-content-pages` 的结算业务基线为 GitLab `feat/kissen`（`a6ace165728977d96c3402b020a2128b3939271f`）。来源分支原交互是列表展开分项、整单详情弹窗及逐币对流水弹窗；本次按需求恢复独立单据详情页，不直接覆盖来源文件，也不引入 Vue 上游较新的 LP 汇总版。

结算单路由为 `/settle/order`，独立详情路由为 `/settle/order/detail?id={orderId}`。列表继续使用 Kissen 的服务端分页、LP/周期/状态筛选、状态 10 确认审批与作废；移除展开行和整单详情弹窗。确认/作废成功后失效结算单列表及对应详情缓存。详情由 detail API 独立加载，包含单据字段、按源 Token 精度展示的分项及按需查询的逐笔币对流水；缺失或无效 ID 不发起 detail/items/records 请求，错误与空数据分别展示。

详情页沿用当前 Admin 的独立详情卡片、语义状态徽章、返回按钮与主题色。`View transactions` 仍按 LP＋周期跳转交易列表，不代表按 orderId 精确关联流水。未恢复静态 Operations、无接口 Generate 或从有限 LP 列表拼出的 LP Code/Contact。Settlement Cycle Setup 未改。

GitLab `feat/kissen` 的 `settle-order` data-access 与当前 API/DTO 一致，本次只增加确认/作废成功后的单据详情缓存失效，没有增加接口或改变 DTO。feature barrel 已 wildcard 导出 settlement pages，详情入口注册于 kissen-admin module registry。

## 上游缺口

依据 admin-sync 状态和已 fetch 的 `origin/v2.0-tokenization`（HEAD `d852329`），结算单改版来自 `827eb1b`。核对的是远端 Git 对象；GitHub fetch 曾失败（`SSL_ERROR_SYSCALL`），不能声称已确认 GitHub 最新版本。审计范围仅结算单，不代表全站审计。

| 上游行为 | 当前仍存在的差异 | 上游证据 |
| --- | --- | --- |
| LP 维度外层汇总，展示周期、单据数、待确认数及最近周期止；周期筛选与 LP 下钻 | 无 `/manage/settle-order/lp-summary` API/model/query 和汇总页面 | `src/api/settle-order.ts`、`src/views/settle/order/index.vue` |
| LP 子页按日/周/月分组展示周期单，可刷新及展开分项 | 无 LP 子页和对应路由；当前仍为扁平分页单据列表及单据独立详情 | `src/views/settle/order/lp-detail.vue`、`src/router/index.ts` |
| 每张单据可查看整单逐笔流水，带 Token 对信息 | 无 `/manage/settle-order/order-records/{orderId}`；现有 `/items-records/{orderId}/{pairId}` 仅为单 Token 对，LP＋周期交易列表不能替代整单关联 | `src/api/settle-order.ts`、`src/views/settle/order/lp-detail.vue` |
| 分项及流水金额直接展示后端成品字符串 | 当前仍通过 `formatAmount` 按 Token 精度格式化；DTO 仍为 `string | number` | 同上 |
| 流水携带 `pairId: number | null`、`pairText`、`sourceTokenCode` | 现有 `SettleItemRecordRow` 未携带上述字段；页面使用点击分项时已有的 pair/token 信息 | `src/api/settle-order.ts` |

上游仍无手动生成结算单入口，结算单由周期任务自动生成；未恢复原型手动生成按钮。以上差异未混入本次范围，也未推进 admin-sync 全局水位线。

## 验证

- `NX_DAEMON=false npx nx build @admin-platform/kissen-admin` 通过。Next.js 输出既有多 lockfile workspace-root 推断及 middleware deprecation 警告。
- `NX_DAEMON=false npx nx lint modules-kissen-admin-feature` 与 `NX_DAEMON=false npx nx lint modules-kissen-admin-data-access` 通过。
- 本地真实浏览器登录后验证 `/en-US/settle/order`：真实列表 4 单；状态筛选显示 2 单，Reset 恢复全部，页大小切换到 `20 / page`；行内无展开项。确认审批弹窗执行 Cancel，确认/作废接口均未调用。
- 真实单据 `orderId=4` 可由列表进入并直接刷新详情 URL；`View transactions` 跳转至该单 LP＋周期条件，浏览器 Back/Forward 可往返详情与交易列表。观测到 GET `/v1/manage/settle-order/detail/4`、POST `/v1/manage/settle-order/items/4` 与 Token 列表请求；未打开币对流水前无 records 请求，点击 `Settlement details` 后才 GET `/v1/manage/settle-order/items-records/4/4`。页面金额与接口数据一致。
- 受控浏览器 fixtures 验证缺失、空、非数、0、负数、小数及超安全整数 ID 均显示 not-found 且无结算 detail/items/records 请求；detail `null` 为 not-found，HTTP 500 为错误态。items/records 空数组与 HTTP 500 错误态可区分。
- fixtures 验证 Token 精度 2 的 `8755.515` 显示 `8,755.52`，精度 0 的 `999.5` 显示 `1,000`；流水请求仅在打开对应币对后发生。
- 隔离 mutation fixtures 验证确认失败保留二次确认框、pending 时禁用重复提交、确认/作废 payload 分别为 `{ orderId: 900 }` 和 `{ orderId: 901 }`，成功后列表状态按接口响应更新。真实业务数据未提交确认或作废。
- 在 390×844、1024×768、1280×800、1600×900 检查列表/详情：文档宽度未超过视口；表格在窄宽度下由表格容器横向滚动。真实 `/en-US/settle/cycle` 页面正常加载并保持原配置界面。
- feature/data-access 项目只配置 lint target；未声称不存在的单测通过。本次使用浏览器真实 API 与隔离 fixtures 验证交互。
