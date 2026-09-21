---
name: lp-sync
description: 把上游 GitLab Vue 项目（kissen-lp-portal-frontend）的新增/变更功能增量同步到 apps/lp-portal。当用户说「同步上游」「lp-sync」「上游 Vue 项目更新了」「拉一下上游变更」或询问上游功能与 lp-portal 的差异时，必须使用此 skill。核心语义：上游代码是行为规格说明书，不是搬运模板——UI 一律用本项目体系重新实现。
---

# lp-sync：上游 Vue 项目 → apps/lp-portal 增量同步

## 角色与边界

- **上游**：`kissen-lp-portal-frontend`（Vue3 + Element Plus + vite），本地 clone 于状态文件 `clonePath` 指定路径，不定时更新。
- **下游**：本仓库 `apps/lp-portal` + `libs/modules/lp-portal/{feature,data-access}`（Next.js App Router + shared UI + tailwind）。
- **同步对象是行为，不是代码**：从上游提取数据流、校验规则、状态机、API 语义、边界情况、易漏细节；UI 结构、文案语言、提示通道、组件实现全部按本项目约定重写。
- **行为规格基线**：`.doc/kissen/project/LP/01-Vue功能全量清单与迁移矩阵.md`（下称「文档 01」）§A–§F。它是按钮级规格 + 20 条陷阱清单，锚定在上游 commit `specBaselineSha`（见 sync-state.json）。文档会随同步更新，是活文档。

## 锁定约束（任何同步不得违反，全文见 references/constraints.md）

1. 全局默认英文，用户可见文案零 CJK
2. 提示通道唯一：sonner toast；确认流用 shared alert-dialog
3. 登录页铺满视口
4. 每页 1280×800 主验收，1280–4K 断点逐页校验
5. admin 模块完全隔离，跨系统仅 shared UI 可共用
6. 原则上零新增外部依赖，需加先问用户

## 同步流程（六步，顺序执行）

### 第 1 步：差量计算（确定性，跑脚本）

```bash
bash .claude/skills/lp-sync/scripts/diff-upstream.sh
```

脚本读取 `.doc/kissen/project/LP/sync-state.json`，fetch 上游，输出 `lastSyncedSha..origin/<branch>` 的变更文件清单（新增/修改/删除）。**输出为空时**：告知用户无变更，结束。

### 第 2 步：映射受影响功能

用 sync-state.json 的 `features` 表把变更文件映射到功能单元。映射规则：

- `src/views/<page>/**` → 对应 feature 页面组（`features` 表有精确映射）
- `src/api/<module>.ts` → `libs/modules/lp-portal/data-access/src/lib/<module>/`
- `src/router/**`、`src/components/MainLayout/**` → `module-page-registry.ts` + `lp-routes.ts` + `lp-app-shell.tsx` + `apps/admin` 的 `configs/*.json` 菜单（**四层联动，见 references/conventions.md**）
- **新增 views 目录**（表里没有的）→ 新功能，走「新功能接入」流程（conventions.md §4）
- 无法映射的文件 → 列出来问用户，不要猜

### 第 3 步：规格保鲜（先改文档，后改代码）

对每个受影响功能，重读上游变更后的源文件，对照文档 01 对应 §D 条目：

- 行为有变化 → **先修订文档 01 的 §D 条目**（注明修订日期与来源 commit），§E 陷阱清单有新增/失效同样更新
- 行为无变化（如纯样式/重构）→ 在 §D 条目标注「<commit> 已核对无行为变化」，代码层仅当 registry/约定受影响时才动
- 上游新增页面（无 §D 条目）→ 新写 §D 条目，完整按钮级盘点，格式对齐现有条目

此步是纪律核心：**文档 01 必须始终描述「当前上游 HEAD 的行为」**，否则增量同步失去基准。修订文档后再进入实现。

### 第 4 步：实现（逐功能）

按修订后规格实现，遵守 references/conventions.md 的翻译约定。重点：
涉及颜色/品牌：一律映射主题 token，禁止上游色值直写（conventions.md §6 品牌主题系统）。

- 状态映射、格式化口径、tooltip/空态语义逐条对照 §E 陷阱清单，**不得回退已保真的陷阱行为**
- 文案：上游中文 → 英文（constraints.md 术语表），语义不得丢失
- data-access 变更同步更新 `types.ts` 与 barrel export

### 第 5 步：验证（逐功能）

- 最窄验证：`npx nx build lp-portal` + `npx nx lint lp-portal`（或最小范围 jest，若涉及 libs）
- 行为验证：`npx nx dev admin`（或 lp-portal dev）+ browser 冒烟，覆盖变更页面的主流程与 §E 涉及的陷阱点
- 涉及响应式：1280×800 截图核对（对照 `.doc/kissen/project/LP/verify/` 存档口径）

### 第 6 步：收尾

- `diff-upstream.sh --apply <sha>` 推进 `lastSyncedSha`（sha = 本次同步到的上游 commit）
- 在 sync-state.json 的对应 feature 上更新 `lastSyncedSha`
- 把本次踩到的新约定/新陷阱沉淀进 references/ 或文档 01 §E

## 参考文件

| 文件 | 何时读 |
|---|---|
| `references/constraints.md` | 每次实现前；含英文术语表 |
| `references/conventions.md` | 每次实现前；四层路由联动、翻译约定、新功能接入 |
| `references/pitfalls.md` | 实现与验证时逐条核对 |
| `.doc/kissen/project/LP/01-*.md` | 规格修订与查询的唯一基线 |

## 状态文件

`.doc/kissen/project/LP/sync-state.json`：上游 remote/clonePath/branch、`specBaselineSha`（文档 01 锚定的上游 commit，只读）、`lastSyncedSha`（已同步水位线）、`features` 映射表。**不要手工改 `lastSyncedSha`，一律通过脚本 `--apply` 推进**。
