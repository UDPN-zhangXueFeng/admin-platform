# 陷阱保真清单（来源：文档 01 §E，2026-08-27 实测于上游 dd9e950）

用途：实现与验证时**逐条核对**。任何一条在同步中被回退即为 bug。随同步更新：上游行为变化时修订对应条目（注明 commit），新增陷阱追加。权威版本在文档 01 §E，本文件是同步执行视角的镜像，两处需同步改。

## 状态与数据口径

1. `firstLogin===0` = 首登待改密（语义反直觉，≠ kissen-gateway）
2. `rootRedirect` 动态落点：menuKeys 全不命中 → `/placeholder`，禁止硬编码 `/`
3. `completedTime===0` 显式 `-`（formatTime 对 0 不设防）
4. 金额两个口径并存且都要保真：全局 formatMoney（千分位、保留原小数位）vs chain-drawer fmtAmount（min 2 / max 8 位小数）
5. 时间格式统一裁决为 en-US 口径（上游 zh-CN 私有变体不迁移）
6. TX 13 态：tag 色 40=success；90/70=danger；60/80=info；**其余 primary（35 列表 primary、抽屉 success）**
7. 多套状态映射互异：pool{5,15,20,50} vs pair{20=参与生效} vs TX 13 态——不得合并成一张表
8. split detail 的 summary 独立响应结构，**不走 ResultData 包装**
9. rate participated 置顶为客户端布尔稳定排序

## 交互与流程

10. SyncRefreshButton 域映射陷阱：**split→pair（复用 pair 域）**；settle→**settle_order（只刷结算单不刷 settle_record）**
11. user 状态 el-switch 走 before-change 确认流（确认→本地翻转+toast+reload 双写）；后端拒停自己/最后管理员 23_0008 不做前端预检
12. roleType===0 内置角色**前端 disabled 禁删**（gateway 是 confirm 报错拦截——两系统各自保真，不得混用）
13. assign-menu 回显仅 setCheckedKeys 叶子 id（filterLeafIds 交集）防父键级联误勾；保存 = checked+halfChecked union 去重；空结果二次 confirm「将清空该角色的全部菜单」
14. 菜单管理 `menuId===0` 是本地新建标记；update 不携带 menuKey/menuType/parentId；保存成功特殊 toast「保存成功，重新登录后菜单生效」（英文等价）
15. 接口权限面板：已入库行（row.id 存在）禁移除；savePerms 仅提交新行逐条循环；空集 info 提示；23_0009/23_0010 后端拒绝场景由 confirm 文案预告
16. user 新建成功 → dialog 弹一次性密码 +「我已抄送」确认；saving 中守卫关闭

## 壳层与横切

17. 通知中心：无全局轮询；unreadCount 只统计当前页 rows；markRead 失败静默；badge max99 且 0 隐藏
18. bootstrapPending 横幅（bootstrapReady===false）：提示不硬拒
19. 登录响应即菜单/权限来源，无独立菜单接口；menuTree 递归过滤 menuType!==4 且 visible!==1，orderNum 升序
20. 请求层：code==='2'|2 → 清会话+过期登录跳转；MSG_23_0024 → 静默 reject 交 ServiceDownAlert（保留已有列表数据）；HTTP 401 同过期、403 固定文案

## 待首次同步裁决（上游 dd9e950 之后的变化，diff dd9e950..171ee44）

- 902c11c（v2.3）：新增 dashboard 页；汇率并入 token 对（rate 目录与 source-receipt 真页均被删除，receipt 回到占位态）——rate-pages 的存废需裁决
- 6636680 的 source-receipt 真页已被 902c11c 撤销，文档 01「占位保真 P1」对 HEAD 仍有效，不需同步
- e204ac1：12 项体验批次（FX 管理组/审批定向推送/列表重构/折线图）
- 171ee44（2026-08-28）：token 对展示统一 SRC/TGT 紧凑式（pair/split/tx-flow/dashboard/详情抽屉）

## 跨 app 通用陷阱（来源：admin-sync 2026-08-28 v2.0 全量补同步，三 skill 共享条目）

- 「远程新增功能/菜单没同步」先分诊两类根因：①前端仓库增量（`git ls-remote` 对 branch tip vs lastSyncedSha）；②后端运行时数据（侧栏菜单 = 登录响应 menuTree 驱动，后端重构菜单时仓库无 diff 也会缺功能）。LP 侧已是 menuTree + MENU_LABELS 模式，此项天然免疫②，但诊断顺序通用。
- 上游脏数据不照搬：残留无 view 的路由键、链向已删页面的死链——保语义、去死链、留档。
- 端点机械 diff 三种假缺失：①泛型调用 `post<T>('/x')` 漏配正则（用 `(?:<[^>]*>)?\(` 兼容）；②分页走包装 helper（本仓 `kissenPage`），URL 不在主 client 调用面；③view 内联 request 直调不在 api 文件。判定缺失前先追调用点（admin 实测 naive diff 误报 31 条，修正后 82/82）。
- 整文件重写页面最易丢 import（典型：块注释未闭合吞掉整个 import 区）；收敛用 `cd apps/lp-portal && npx tsc --noEmit` 一次枚举全量类型错再批量修，勿 nx build 逐轮暴露。
- DataTable 行键覆盖 × model 自带 `id: number`：`{...r, id:String(r.id)}` 使 `T & {id:string}` 的 id 变 never；用 `Omit<T,'id'> & {id:string}` 模块级别名统一列/回调/弹窗 props。
- 浏览器批量走查：工具默认 30s 超时，拆批 ≤4 页 + 显式 timeout；截图用 `page.screenshot({path})` 直存（`tab.screenshot()` 不收路径）；登录态会中途过期把批内后半踢到登录页（同时是 code='2' 分支实测机会），批前先登录。
- 写操作流程的运行时实证需后端种子数据；无种子以「渲染全绿 + 只读交互实测 + 按钮级矩阵静态保证」收口并明示边界。
