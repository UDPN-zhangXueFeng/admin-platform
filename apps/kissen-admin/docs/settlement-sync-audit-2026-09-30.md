# 结算单恢复与上游差异核对（2026-09-30）

## 本次范围

当前分支 `feat/prototype-content-pages` 的 Settlement Statements 整块回退到本地 `feat/kissen`（07f16b4）的列表、详情弹窗及逐笔明细实现，去掉独立详情页及其 registry 入口。保留当前分支代码规范：既有 shared UI、TypeScript 类型与 Hooks、Prettier 配置，仅格式化恢复区块，并适配与当前周期页共存所需 imports。

已 fetch GitLab，最新 `gitlab/feat/kissen`（a6ace16）的结算单代码与本地来源一致。GitHub fetch 失败（SSL_ERROR_SYSCALL），不能声称已确认 GitHub 最新版本。

恢复列表服务端分页（10/20/50）与 LP/周期/状态筛选、Statement ID、详情弹窗、分项展开、按 Token 对查询逐笔结算明细、确认审批与作废二次确认。移除原型手动生成按钮及静态 Operations 内容。当前分支 Settlement Cycle Setup 逐字保留。旧 `/settle/order/detail` 链接不再提供原独立详情页。

结算明细按 `orderId + pairId` 查询，包含本金、加价、管理分成、LP 分成及时间；仅打开时请求，金额按源 Token 精度展示。View transactions 仍按 LP + 周期跳转交易列表，这是 Kissen 原有行为，不能等同于按 orderId 查询整单结算流水。

## 上游缺口

依据 admin-sync 的状态文件和 fetch 后的 `origin/v2.0-tokenization`，HEAD 为 `d852329`；结算单改版来自 `827eb1b`。核对的是远端 Git 对象，不是仍停留在旧提交的 clone 工作区。审计范围仅结算单，不代表全站审计。

| 上游行为 | 本次调整后的缺口 | 上游证据 |
| --- | --- | --- |
| LP 维度外层汇总，展示周期、单据数、待确认数及最近周期止；周期筛选与 LP 下钻 | 无 `/manage/settle-order/lp-summary` API/model/query 和汇总页面 | `src/api/settle-order.ts`、`src/views/settle/order/index.vue` |
| LP 子页按日/周/月分组展示周期单，可刷新及展开分项 | 无 LP 子页和对应路由；仍为扁平分页列表 | `src/views/settle/order/lp-detail.vue`、`src/router/index.ts` |
| 每张单据可查看整单逐笔流水，带 Token 对信息 | 无 `/manage/settle-order/order-records/{orderId}`；现有 `/items-records/{orderId}/{pairId}` 仅为单 Token 对，按 LP 和时间跳转交易列表不能替代精确整单关联 | `src/api/settle-order.ts`、`src/views/settle/order/lp-detail.vue` |
| 分项及流水金额直接展示后端成品字符串 | 仍调用 `formatAmount` 依赖 Token 精度后再次舍入；DTO 仍为 `string | number` | 同上 |
| 流水携带 `pairId: number | null`、`pairText`、`sourceTokenCode` | 现有 `SettleItemRecordRow` 缺上述三字段 | `src/api/settle-order.ts` |

确认审批、作废、状态 10/20/35/45、分项接口及单 Token 对流水接口已有实现。上游仍无手动生成结算单入口，结算单由周期任务自动生成；原型的手动生成按钮删除符合上游业务语义。

以上缺口仅记录，未擅自混入 Kissen 内容回归版本。未推进 admin-sync 全局水位线，因为其他功能及本次列出的缺口尚未同步。

## 验证

- settlement-pages.tsx 和 module-page-registry.ts ESLint 通过。
- TypeScript AST 规范化对照：除 imports 适配外，整个结算单区块的代码与 feat/kissen 一致；结算周期配置与当前 HEAD 逐字一致。
- `tsc --noEmit -p apps/kissen-admin/tsconfig.json` 被既有 TS6053 阻断：引用已不存在的 `libs/modules/auth/feature`。
- `NX_DAEMON=false npx nx build kissen-admin` 生产构建通过；随后仅格式化恢复区块并清理行尾空格，ESLint 与 `git diff --check` 再次通过。
- 未运行浏览器交互及真实确认/作废写操作验证。
