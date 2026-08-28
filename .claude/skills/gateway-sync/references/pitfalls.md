# 陷阱保真清单（gateway-sync 执行视角）

用途：实现与验证时**逐条核对**。权威版本在文档 01 §7/§E，本文件是同步执行视角的镜像 + 跨 app 共享条目；新增条目两处同步改。

## 跨 app 通用陷阱（来源：admin-sync 2026-08-28 v2.0 全量补同步，三 skill 共享条目）

- 「远程新增功能/菜单没同步」先分诊两类根因：①前端仓库增量（`git ls-remote` 对 branch tip vs lastSyncedSha）；②后端运行时数据（侧栏菜单 = 登录响应 menuTree 驱动，后端重构菜单/分组时仓库无 diff 也会缺功能）。gateway-portal 已是 menuTree + 前端英文化映射模式，此项天然免疫②，但诊断顺序通用；admin 侧 2026-08-28 起同构对齐（menuTree 直驱 + menuNameEn，见 admin-sync pitfalls §3）。
- 上游脏数据不照搬：残留无 view 的路由键、链向已删页面的死链——保语义、去死链、留档偏差。
- 端点机械 diff 三种假缺失（对照上游 `src/api/*.ts` vs 本地 data-access）：①泛型调用 `post<T>('/x')` 漏配正则（用 `(?:<[^>]*>)?\(` 兼容）；②分页走包装 helper（本仓 `kissenPage`），URL 不在主 client 调用面；③view 内联 request 直调不在 api 文件。判定缺失前先追调用点（admin 实测 naive diff 误报 31 条，修正后 82/82）。
- 整文件重写页面最易丢 import（典型：块注释未闭合吞掉整个 import 区）；收敛用 `cd apps/kissen-gateway-portal && npx tsc --noEmit` 一次枚举全量类型错再批量修，勿 nx build 逐轮暴露。
- DataTable 行键覆盖 × model 自带 `id: number`：`{...r, id:String(r.id)}` 使 `T & {id:string}` 的 id 变 never；用 `Omit<T,'id'> & {id:string}` 模块级别名统一列定义/行回调/弹窗 props。
- 浏览器批量走查：工具默认 30s 超时，拆批 ≤4 页 + 显式 timeout；截图用 `page.screenshot({path})` 直存（`tab.screenshot()` 不收路径）；登录态会中途过期把批内后半踢到登录页（同时是 code='2' 过期分支实测机会），批前先登录。
- 写操作流程的运行时实证需后端种子数据；无种子以「渲染全绿 + 只读交互实测 + §7 清单静态保证」收口并明示边界。
