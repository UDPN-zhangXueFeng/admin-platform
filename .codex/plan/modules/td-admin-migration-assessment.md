# TD Admin 迁移深度评估

> 评估日期：2026-10-26
> 目标应用：`apps/admin`
> 旧项目：`/Users/rnail/orca/td-manage`
> 同步基线：`feature/zxf@be1c337`（admin commit `df8dc852` 消费的 `7cce629..be1c337`）
> 当前源 tip：`feature/zxf@d6eba908`（本地与 `origin/feature/zxf` 一致；其后变更仅涉及 Kissen transfer 等文件，未改变本次 TD 模块源文件）
> 目标分支：`feat/prototype-content-pages@b0086c8`（本地、`origin` 与 `gitlab` 同步）

## 1. 评估口径

本评估由 5 个只读审计分片完成：迁移清单、API 合约、路由/权限/i18n、页面行为、证据与验收。审计阶段未运行测试、构建或浏览器冒烟；因此“静态存在”不等于“运行时完成”。

验收分四层：

1. 源文件与业务页面覆盖；
2. API、路由、模块注册和消息 namespace 装配；
3. 页面交互与业务行为；
4. 真实后端/浏览器冒烟证据。

任何一层缺少证据，只能标记为未验证或条件通过。

## 2. 静态覆盖结论

| 维度 | 当前结果 | 口径与限制 |
|---|---:|---|
| 源业务叶子模块 → 目标代码 | 约 51/52（98.1%） | 目录/注册静态盘点；`change-password` 尚未迁移 |
| 源页面 → 目标页面 | 约 123/125（98.4%） | 页面文件和注册关系盘点；不代表交互等价 |
| 路由菜单叶子可达 | 约 47/51（92%） | 静态配置与 catch-all route 盘点 |
| API 合约 | 约 288/297（约 97%） | 仅已审计集合；COA、SP Access、Travel Rule、交易导出仍有缺口/决策项 |
| 迁移计划文档 | 约 42/52（80.8%） | 部分已有文档章节/验收格式漂移 |
| 运行时验收 | 未完成 | 现有 state 文件只描述 screening-monitoring，不能外推到全仓 |

上述比例是定位缺口的静态指标，不是发布质量分数。

## 3. 已确认阻塞项

### P0：Chart of Accounts 不完整

旧项目 COA 详情还包含：

- Trial Balance；
- Trial Balance Activity；
- Operation Records。

对应接口：

- `GET /api/finance/v1/finance/coa/detail/trial-balance/{financeBookId}`；
- `GET /api/finance/v1/finance/coa/detail/trial-balance/{financeBookId}/activity`；
- `POST /api/finance/v1/finance/coa/book/records/{financeBookId}`。

当前目标只有 Basic Information、Chart of Accounts、EOD Statements 三个 Tab，尚未接入上述接口、筛选、活动抽屉和操作记录交互。`chart-of-accounts.md` 已记录该缺口；补齐后才能做完整 COA 验收。

### P1：SP Access 业务不完整

旧项目的 `sp-access/approval.tsx` 尚未迁移；当前注册项不能正确覆盖 approval slug。详情页的两个密钥下载入口仍是 unsupported stub，旧项目对应真实下载接口。旧项目另外存在 service-access audit/cancel/save 等接口，需要确认这些能力是否由统一 `approval-manage` 替代，不能仅靠重命名判定等价。

### P1：Transaction Flow 缺少筛选和导出

当前目标筛选只提供 `all`，旧项目还有稳定币、区块链、Token Type 等动态选项；旧项目的稳定币交易导出和资金池导出也未接入。

### P1：Change Password 缺失

旧项目 `src/pages/change-password/index.tsx` 是真实功能，目标注册与页面均未发现。

## 4. 已修复的确定性装配/行为问题

- `configs/stablecoin.json` 保留菜单分组 ID，同时补齐 `screening-monitoring`、`screening-providers`、`statistics-reports`、`workflow` 的精确 enabled ID，修复消息 namespace 被过滤导致的运行时缺文案。
- 移除无 registry/route 的死菜单 `/financial/normalization-engine`。
- 接入 Journal Entries 的 subject save：校验科目编码和名称，调用 `saveBillSubject`，刷新 subject list，并显示成功/失败提示。
- 接入 Data Export 的 enabled 配置和独立 `modules.data-export` 中英文 namespace；页面/manifest 不再引用不存在的 `modules.financial` namespace。
- 修正 screening-monitoring state 的旧源路径，固定同步基线 `be1c337`，并记录当前源 tip `d6eba908`；静态检查不再伪装成运行时验收，`acceptanceRate` 已降为未验收。
- 删除 `apps/admin/specs/index.spec.tsx` 中引用不存在页面的无效脚手架测试。

## 5. 非阻塞但需要后续决策/验证的风险

- Travel Rule 目标列表仍使用 mock，旧页面本身也未调用后端；但旧项目 `src/lib/api/financial.ts` 已声明真实详情契约 `GET /api/finance/v1/finance/journal/travel-rule/{tdTxId}`。它不是当前列表 mock 的直接替代接口，是否新增详情/列表接线必须先确认后端契约，不能继续归类为“源码完全没有真实 API”。
- Statistics Reports 的 PDF 导出按钮当前没有行为；旧项目通过隐藏报告组件和 `html2canvas/jsPDF` 生成 PDF。直接改成普通下载或 `window.print()` 都不等价，需要决定是否保留 PDF 方案。
- SP Access 两个密钥下载入口、文档 PDF 下载、Transaction Flow 导出需要真实后端冒烟，不能用 toast 或空处理替代。
- 旧项目按用户资源权限控制模块级菜单；目标静态 sidebar 目前主要依赖 enabled 配置，`ModuleManifest.permissions` 未证明覆盖旧 `userPermission` 语义。
- `sidebar-item.tsx`、`breadcrumb.tsx` 的 locale link 需验证是否会绕过 `localePrefix: 'always'`；这是跨模块共享导航风险。
- `zh-CN` 的部分旧模块文案仍是英文或状态 token 未完全翻译，属于体验/文案缺口，不应当按 API 覆盖率计算为完成。

## 6. 验收门槛

发布前至少需要：

1. 以同步基线 `td-manage@be1c337` 重跑确定性迁移清单，并以当前源 tip `d6eba908` 做 TD 文件范围复核；
2. 补齐 COA 三个接口、两个 Tab 及对应活动/操作记录交互，或由产品明确书面裁剪范围；
3. 明确 SP Access approval/download、Travel Rule、Statistics PDF、Transaction Flow export 的后端契约；
4. 为每个已启用模块至少完成一次真实路由加载和关键写操作/下载/导出冒烟；
5. 将每次冒烟的环境、路由、接口、结果写入对应模块文档/state，不再使用单一 screening state 代表全仓；
6. 运行 `npx nx lint`、相关 `npx nx test` 和 `npx nx build admin`，并记录结果。

当前结论：迁移骨架和大部分接口已落地，但不能宣称 TD Admin 全量迁移完成；COA、SP Access、Transaction Flow、Change Password 和运行时验收仍是主要剩余工作。
