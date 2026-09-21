---
name: gateway-sync
description: 把上游 GitLab Vue 项目（kissen-bank-gateway-frontend）的新增/变更功能增量同步到 apps/kissen-gateway-portal。当用户说「同步网关上游」「gateway-sync」「网关 Vue 上游更新了」或询问上游功能与 kissen-gateway-portal 的差异时，必须使用此 skill。核心语义：上游代码是行为规格说明书，不是搬运模板——UI 一律用本项目体系重新实现。
---

# gateway-sync：上游 Vue 项目 → apps/kissen-gateway-portal 增量同步

## 角色与边界

- **上游**：`kissen-bank-gateway-frontend`（Vue3 + vite），本地 clone 于状态文件 `clonePath`，不定时更新。
- **下游**：本仓库 `apps/kissen-gateway-portal` + `libs/modules/kissen-gateway/{feature,data-access}`。
- **同步对象是行为，不是代码**：提取数据流、校验规则、状态机、API 语义、边界情况；UI 按本项目约定重写。
- **行为规格基线**：`.doc/kissen/project/gateway/01-Vue功能全量清单与迁移矩阵.md`（下称「文档 01」），§7 十八条易漏口径是验证核对清单。文档锚定在上游 `specBaselineSha`（见 sync-state.json），是活文档。
- **历史包袱**：下游曾基于旧快照 `1a775c1` 语义；`1a775c1..a82d82c` 的 v2.0 差距已由用户裁决「单独立项」（gateway/00-README.md §3 O-1），不在本 skill 范围，追踪见 `2026-08-27-gateway更新总结.md`。

## 锁定约束（任何同步不得违反，全文见 references/constraints.md）

1. 全局默认英文，用户可见文案零 CJK
2. 提示通道唯一：sonner toast；确认流用 shared alert-dialog
3. 登录页铺满视口
4. 每页 1280×800 主验收，六断点逐页校验
5. 禁止 admin 功能出现，跨系统仅 shared UI 可共用
6. 原则上零新增外部依赖，需加先问用户

## 同步流程（六步，顺序执行）

### 第 1 步：差量计算（确定性，跑脚本）

```bash
bash .claude/skills/gateway-sync/scripts/diff-upstream.sh
```

输出 `lastSyncedSha..origin/<branch>` 变更文件清单。**为空时告知用户无变更，结束。**

### 第 2 步：映射受影响功能

用 sync-state.json 的 `features` 表映射：

- `src/views/<page>/**` → 对应 feature 页面组
- `src/api/<module>.ts` → `libs/modules/kissen-gateway/data-access/src/lib/`
- `src/router/**`、layout/store → `module-page-registry.ts` + `kissen-app-shell.tsx` + `apps/admin/configs/*.json` 菜单（**四层联动，见 references/conventions.md**）
- 表里没有的新 views 目录 → 新功能，走「新功能接入」（conventions.md §4）
- 无法映射的文件 → 列出来问用户，不要猜

### 第 3 步：规格保鲜（先改文档，后改代码）

对每个受影响功能，重读上游变更后的源文件，对照文档 01 对应条目：行为有变 → **先修订文档 01**（注明日期与来源 commit），§7 易漏口径同步增删；行为无变 → 标注「<commit> 已核对无行为变化」；上游新增页面 → 新写按钮级条目。**文档 01 必须始终描述当前上游 HEAD 的行为。**

### 第 4 步：实现（逐功能）

按修订后规格实现，遵守 references/conventions.md；§7 易漏口径逐条核对不得回退；上游中文文案 → 英文（constraints.md 术语表）。
涉及颜色/品牌：一律映射主题 token，禁止上游色值直写（conventions.md §6 品牌主题系统；本项目目标态为独立 3 套自定义主题）。

### 第 5 步：验证（逐功能）

- 先跑 `references/pitfalls.md` 逐条核对（诊断口径/类型收敛/冒烟工程，与 admin-sync/lp-sync 共享条目三处同步改）
- 类型收敛：`cd apps/kissen-gateway-portal && npx tsc --noEmit` 一次枚举全量类型错再批量修（勿用 nx build 逐轮暴露）
- `npx nx build kissen-gateway-portal` + `npx nx lint kissen-gateway-portal`
- dev 冒烟 + browser 驱动变更页面，覆盖 §7 涉及点（批量拆批 ≤4 页 + 显式 timeout；截图用 `page.screenshot({path})` 直存）
- 响应式：1280×800 截图核对（对照 `.doc/kissen/project/gateway/verify/` 存档）
- 「缺功能/缺菜单」先分诊：仓库增量（`git ls-remote` 对 tip）vs 后端 menuTree 运行时数据（pitfalls §1）

### 第 6 步：收尾

- `diff-upstream.sh --apply <sha>` 推进 `lastSyncedSha`
- 新踩的坑沉淀进文档 01 §7 或 references/

## 参考文件

| 文件 | 何时读 |
|---|---|
| `.doc/kissen/project/gateway/01-*.md` | 规格修订与查询的唯一基线（含 §7 易漏口径） |
| `references/constraints.md` | 每次实现前；含英文术语表 |
| `references/conventions.md` | 每次实现前；四层联动、翻译约定、新功能接入 |

## 状态文件

`.doc/kissen/project/gateway/sync-state.json`。`specBaselineSha`（文档 01 锚点）只读；`lastSyncedSha` 只能通过脚本 `--apply` 推进。
