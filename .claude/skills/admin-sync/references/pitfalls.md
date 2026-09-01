# 陷阱保真清单（admin-sync 执行视角镜像）

用途：实现与验证时**逐条核对**。来源：2026-08-28 v2.0 token 化全量补同步（99dcd0c → 787ccc9）实战。
权威版本：本文即权威（admin 无文档 01 §E 镜像关系）；与 lp-sync/gateway-sync 的 pitfalls 共享条目需三处同步改。

## 诊断口径

1. **「远程新增功能没同步」先分两类根因，勿混诊**：
   - ①前端仓库增量：`git ls-remote origin <branch>` 对 branch tip vs `lastSyncedSha`——仓库级 diff 才走同步流程；
   - ②后端运行时数据：**侧栏菜单 = 登录响应 menuTree 驱动**（非前端静态定义）。后端重构菜单（分组/顺序/增删）时，仓库无 diff 也会「缺功能/缺菜单」。
   - 本轮实例：上游仓库 tip 就是已同步的 787ccc9（main 反而是其 19 commit 祖先），「缺菜单」真因是后端 menuTree 重构而下游侧栏用静态 configs。
2. **上游脏数据不照搬**：MENU_ROUTE_MAP 残留无 view 的 `risk:*` 键、workbench 对账卡片链向已删页面（死链）。处置：保语义、去死链、留档偏差，不让下游产生 404 路由。

## 侧栏与菜单契约（admin 特有，2026-08-28 定稿）

3. **双层菜单一致性**：运行时层 = login 响应 `menuTree` 挂 User 快照（索引签名透传 → `userInfo` localStorage 持久化，登出随 `clearSessionStorage` 清除），`kissen-app-shell.tsx` 的 `toModuleItems()` 映射（`visible===0` 过滤、`menuType!==4` 剔按钮、`orderNum` 排序、`children`→分组、`menuUrl`→path、label 取 `menuNameEn`——后端自带英文，零 CJK 无需映射表）；兜底层 = `configs/kissen-admin.json` 静态树，**必须与后端 menuTree 镜像同步**（否则 SSR 首帧/无会话态展示过时分组）。未知 key 落 registry placeholder。
4. **registry 键 = 路由 slug[0]**；`configs.modules.enabled` 是双口径检查（page.tsx：组段用 GROUP_ENABLED_KEY[module]，平铺用 module 本身）——新增键三处同轮改：registry + enabled + menu 树，漏一处整组 404。后端 `menuUrl=/workbench` 需独立 registry 键（`/dashboard` 保别名）；登录默认跳转随 menuUrl 走（现为 /workbench）。
5. **registry loader 模式**：top-level `import type * as KissenFeature` + `loader((m) => m.X)`，import 路径必须字面量（webpack 静态分析）；inline `import("pkg").Type` 会被 ts-import-type lint 拦。

## 收敛与类型

6. **整文件重写页面最易丢 import**（典型：块注释未闭合吞掉整个 import 区）。收敛用 `cd apps/kissen-admin && npx tsc --noEmit` **一次枚举全量类型错再批量修**；nx build 逐轮暴露太慢。
7. **DataTable 行键覆盖 × model 自带 `id: number` 冲突**：`rows.map(r => ({...r, id: String(r.id)}))` 使列泛型 `T & {id:string}` 里 id 变 `never`。正解：模块级 `type Row = Omit<T,'id'> & {id:string}`，统一列定义/行回调/弹窗 props；需要原始 id 处 `Number(row.id)`。
8. **端点机械 diff 的三种假缺失**（对照上游 `src/api/*.ts` vs 本地 data-access 时）：①泛型调用 `post<T>('/x')` 漏配正则——用 `(?:<[^>]*>)?\(` 兼容；②分页走包装 helper（`kissenPage`），URL 不在 `kissenRequest` 调用面；③view 内联调用（如 heartbeat 在 drawer.vue 里 request 直调），api 文件扫不到。判定缺失前先追真实调用点，否则误报缺口。本轮实测： naive diff 报 31 缺，修正后 **82/82 全对齐**。

## 浏览器冒烟工程

9. 批量走查：工具默认 30s 超时，**拆批（≤4 页）+ 显式 `timeout` 参数**；页内 `tab.goto` 自带 60s。
10. 截图落盘：`tab.screenshot()` 不接收路径；用 Node 侧 puppeteer 原生 `page.screenshot({ path })` 直存 verify 目录。
11. **登录态会中途过期**：批内后半被踢到登录页 ≠ 页面 bug（同时是 `code='2'` 过期分支的实测机会）。批量走查前先登录；dev 预填凭据见 login/page.tsx（admin/Kissen@123）。React 非受控输入需 native setter + `input` 事件再 submit。
12. **写操作流程的运行时实证需后端种子数据**；无种子时以「渲染全绿 + 只读交互实测 + 按钮级矩阵静态保证」收口，报告中明示边界，勿谎称全流程已验证。

## 审批化改版同步（2023418 批次，2026-08-28）

13. **model 字段以上游 VO 全量对照，不按「页面用到多少」猜**：`TokenPairRow` 初版漏了 `targetBankCode/baseRate/markupRate/defaultSplitRatio` 四个 VO 字段（列表列与弹窗回显全依赖），feature 层大面积 TS2339 才暴露。新批次同步时先 `git show <sha>:src/api/*.ts` 把 interface 逐字段抄全，再写 UI。
14. **行内编辑工具的 auto-repair 会留旧行**（边界 echo 修复仅删重，不保证语法闭合）：大段替换后必须重读改动区域确认括号/注释闭合，本轮 3 次错位均靠「编辑响应的 syntax error 警告 + 立即重读」当场修复。
15. **审批流改造的 UI 摘除要清干净三层**：api 函数（`setTokenPairDefaultSplit`）→ mutation hook → feature 弹窗与按钮，漏一层 tsc 才报 unused/dead 引用；barrel 为 `export *` 时 api 层删除即全链路失效，无单独 barrel 改动点。

## v2.0-tokenization 增量批次（2023418..1a871d1，2026-09-01）

16. **agent 插列会留重复列定义**：往 DataTable 列数组插入新列（如 Disbursement Pool）时，实现 agent 可能并列而非替换旧列，页面上同名表头出现两次才暴露。冒烟时核对 `thead` 表头全序；事后 `CUT` 重复列 + `tsc` 复验。
17. **同一 app 不能双 dev 实例**：`.next/dev/lock` 互斥，第二个 `nx dev` 直接 exit 1。需要 stub 数据态时先停真实后端实例再起 stub 指向实例（复用同端口），测完再切回。
18. **stub fixture 的 admin 信封必须 `code:'0'`（字符串）**：kissen-client `isKissenResult` 按字符串判成功；旧 fixture 的 `code: 200`（数字）会让 kissenPage 拿到 undefined rows，页面静默空表。见 stub-server.mjs `adminOk` helper。
19. **真实后端优先冒烟，stub 兜 populated 态**：真实环境常缺新字段数据（本轮 settle 空、lp-pair baseRate 恰有值）。渲染结构走真实后端验证，数据渲染（三列换算、弹窗条目）走 stub fixture；两层都过才算冒烟完成。
