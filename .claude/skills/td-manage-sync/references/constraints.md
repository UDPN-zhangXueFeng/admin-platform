# 锁定约束（td-manage-sync，apps/admin 侧，2026-09-17 建档）

沿用本仓库 `.codex/project/rule.md` 与 `.codex/project/pro.md`；若用户另有裁决以最新指令为准并回填本文件。

1. **双语文案**：用户可见文案 en-US / zh-CN 双份 messages 回填（`libs/shared/util-i18n-messages` 及模块内消息文件），键数两侧对齐。时间格式沿用现有 util-dates，不自造格式化。
2. **权限双体系不得混用**（2026-08-04 裁决）：
   - 模块级 `module-manifest.ts` 的 `permissions` 用**语义码**（`'order:read'` 等），决定路由/菜单可见性；
   - 按钮级 `PermissionGuard` / `useAuth().permissions.has()` 必须用**后端 UUID**（从旧页 `useCustomTable` 的 `actions[].limit` 原样取），决定行内按钮可见性。
   - 迁移按钮权限「语义化」UUID 是已发生过的回归（approval-manage 全部按钮消失）。
3. **API HTTP 方法以上游源契约为准**（2026-09-04 裁决）：
   - td-manage 全局 fetcher（`src/lib/axios.ts`）签名 `([url, param?])`：`useSWR([url])` 单元素 = GET，`[url, payload]` 双元素 = POST；显式 `request(url,{method})` 以 method 字段为准；
   - 公共下拉接口（common/* 域、各模块 new/*List 域）本仓库统一 GET，blockchain/mmf/journal-entries 是范本；
   - 后端对方法宽容（GET/POST 都 200）不代表方法正确——不能只看 URL 猜方法，curl 只验证可达性。
4. **三层一致性**：`configs/*.json`（order + enabled）+ `apps/admin/src/app` 路由解析 + registry，同轮改，漏一处整组 404 或菜单错位。无 path 的 order 占位项会被 `sidebar-layout.tsx` 回退成 `/{id}` 并尝试匹配同名 registry key——占位项要么给明确 path，要么连 enabled 一起删。
5. **范围隔离**：只动 `apps/admin` 体系与 `libs/modules/*`（非 kissen）；`apps/kissen-*`、`apps/lp-portal` 与 `libs/modules/kissen-*` 零改动；跨应用仅 `libs/shared/*` 可共用。`shared` 不得依赖 `libs/modules/*`；新模块动态加载接入 `apps/admin` 装配层。
6. **零新增外部依赖**：需要新依赖必须先问用户。
7. **数值防御**：后端数值字段实际可能是 string，格式化统一 `Number(value)` 前置转换（`reSet` 类函数不得假设 number）。

## 模块显示名三层来源（重命名/对齐文案时逐一核对）

`config.modules.order[].label`（侧栏+面包屑，单语字面量）、i18n `modules.<id>.title` / `list.title`（页面标题，locale-aware）、`module-manifest` 的 `name`/`routes[].label`（元数据）。三层不同步是高频回归。

## 术语一致性

上游中文术语首次同步时在 en-US/zh-CN messages 中定稿；同一术语跨模块保持同一 key 命名。后端数据自带的 CJK（busDesc、审批节点名等）是数据直显，与上游一致不算违规。
