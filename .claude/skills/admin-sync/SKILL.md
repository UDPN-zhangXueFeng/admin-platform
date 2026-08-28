---
name: admin-sync
description: 把上游 GitLab Vue 项目（kissen-admin-frontend，v2.0-tokenization 分支）的新增/变更功能增量同步到 apps/kissen-admin。当用户说「同步 admin 上游」「admin-sync」「kissen-admin 上游更新了」或询问上游功能与 kissen-admin 的差异时，必须使用此 skill。核心语义：上游代码是行为规格说明书，不是搬运模板——UI 一律用本项目体系重新实现。
---

# admin-sync：上游 Vue 项目 → apps/kissen-admin 增量同步

## 角色与边界

- **上游**：`kissen-admin-frontend`，**分支 `v2.0-tokenization`**（v2.0 token 化改造主战场，非 main），本地 clone 于状态文件 `clonePath`，不定时更新。
- **下游**：本仓库 `apps/kissen-admin` + `libs/modules/kissen-admin/{feature,data-access}`。
- **同步对象是行为，不是代码**：提取数据流、校验规则、状态机、API 语义、边界情况；UI 按本项目约定重写。
- **⚠️ 与 lp-sync/gateway-sync 的关键差异：admin 没有迁移文档基线**（无六件套）。行为规格文档待首次盘点建立（见下）。

## 锁定约束（任何同步不得违反，全文见 references/constraints.md）

1. 全局默认英文，用户可见文案零 CJK
2. 提示通道唯一：sonner toast；确认流用 shared alert-dialog
3. 登录页铺满视口
4. 每页 1280×800 主验收，全断点逐页校验
5. 与 LP / gateway 门户功能完全隔离，跨系统仅 shared UI 可共用
6. 原则上零新增外部依赖，需加先问用户

## 首次运行：盘点模式（建立基线，一次性）

状态文件 `specBaselineSha` 为 null 时必须先走本模式，不得直接同步：

1. 跑 `scripts/diff-upstream.sh` 查看 `lastSyncedSha..origin/v2.0-tokenization` 积压（当前锚点 `99dcd0c`，monorepo 侧最后 kissen-admin 工作日 2026-08-19 之前的最近上游 commit，保守方向锚定）。
2. 与用户确认积压处理口径（全部补同步 / 只同步部分 / 以现状为准推进水位线）。
3. 逐 view 盘点下游现状 vs 上游 HEAD：建 `.doc/kissen/project/admin/01-功能全量清单与迁移矩阵.md`，格式对齐 gateway/LP 的 01（路由表、横切面、api 全表、每页按钮级清单、易漏细节、迁移矩阵），锚定 `specBaselineSha` = 盘点时的上游 HEAD。
4. 状态文件回填 `specBaselineSha`。

盘点期间发现的历史漂移（下游与上游语义不一致处）单独列表，经用户裁决后处理，不静默改。

## 日常同步流程（六步，顺序执行）

### 第 1 步：差量计算（确定性，跑脚本）

```bash
bash .claude/skills/admin-sync/scripts/diff-upstream.sh
```

输出 `lastSyncedSha..origin/v2.0-tokenization` 变更文件清单。**为空时告知用户无变更，结束。**

### 第 2 步：映射受影响功能

用 sync-state.json 的 `features` 表映射（`src/views/<page>/**` → feature 页面组；`src/api/` → data-access；router/layout/store → registry + shell + configs 四层联动，见 references/conventions.md）。表里没有的新 views 目录 → 新功能接入流程；**映射存疑的文件（历史上 feature 文件与 views 目录非一一对应，如 risk-pages / currency-pages）→ 列出来问用户，不要猜。**

### 第 3 步：规格保鲜（先改文档，后改代码）

对每个受影响功能，重读上游变更后的源文件，对照 `01-功能全量清单与迁移矩阵.md` 对应条目：行为有变 → **先修订文档**（注明日期与来源 commit）；行为无变 → 标注「<commit> 已核对无行为变化」；上游新增页面 → 新写按钮级条目。**文档必须始终描述当前上游 HEAD 的行为。**

### 第 4 步：实现（逐功能）

按修订后规格实现，遵守 references/conventions.md；易漏细节逐条核对不得回退；上游中文文案 → 英文（constraints.md 术语表）。
涉及颜色/品牌：一律映射主题 token，禁止上游色值直写（conventions.md §6 品牌主题系统；本项目目标态为独立 3 套自定义主题）。

### 第 5 步：验证（逐功能）

- 先跑 `references/pitfalls.md` 逐条核对（诊断口径/菜单契约/类型收敛/冒烟工程）
- 类型收敛：`cd apps/kissen-admin && npx tsc --noEmit` 一次枚举全量类型错再批量修（勿用 nx build 逐轮暴露）
- `npx nx build kissen-admin` + `npx nx lint kissen-admin`
- dev 冒烟 + browser 驱动变更页面（批量拆批 ≤4 页 + 显式 timeout；截图用 `page.screenshot({path})` 直存）
- 响应式：1280×800 截图核对
- 「缺功能/缺菜单」先分诊：仓库增量（`git ls-remote` 对 tip）vs 后端 menuTree 运行时数据（pitfalls §1）

### 第 6 步：收尾

- `diff-upstream.sh --apply <sha>` 推进 `lastSyncedSha`
- 新踩的坑沉淀进文档 01 或 references/

## 分支注意

上游以 `v2.0-tokenization` 为准（脚本 fetch 后对比 `origin/v2.0-tokenization`）。若用户提到 main 分支有需要同步的内容，先问清是否合入 v2.0-tokenization 再操作，不要擅自切分支。

## 参考文件

| 文件 | 何时读 |
|---|---|
| `.doc/kissen/project/admin/01-*.md` | 规格修订与查询的唯一基线（盘点后存在） |
| `references/constraints.md` | 每次实现前；含英文术语表 |
| `references/pitfalls.md` | 验证前逐条核对；诊断口径、菜单契约、类型收敛、冒烟工程（2026-08-28 v2.0 同步沉淀） |

## 状态文件

`.doc/kissen/project/admin/sync-state.json`。`specBaselineSha`（文档锚点）盘点后只读；`lastSyncedSha` 只能通过脚本 `--apply` 推进。
