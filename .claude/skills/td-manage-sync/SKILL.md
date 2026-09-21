---
name: td-manage-sync
description: 把上游 GitLab 项目（td-manage，feature/zxf 分支，Next.js Pages Router）的新增/变更功能增量同步到 apps/admin。当用户说「同步 td-manage」「td-manage-sync」「td-manage 上游更新了」「老项目更新了要同步到 admin」或询问上游功能与 apps/admin 的差异时，必须使用此 skill。只针对本项目 apps/admin 及其 libs/modules/*（非 kissen 系），不涉及 kissen 三门户。核心语义：上游代码是行为规格说明书，不是搬运模板——UI、API、路由一律按本仓库 Nx 体系重新实现。
---

# td-manage-sync：上游 td-manage（Pages Router）→ apps/admin 增量同步

## 角色与边界

- **上游**：`td-manage`，**分支 `feature/zxf`**，remote `http://10.0.6.203:8088/td_project/source-code/stack/td-manage`，本地 clone 于 `~/repos/td-manage`（不存在时先 clone，见脚本提示）。技术栈：Next.js Pages Router + SWR + Axios 全局 fetcher。
- **下游**：本仓库 `apps/admin` + `libs/modules/<domain>/{feature,ui,data-access,util}`（非 kissen 系）+ `configs/*.json`。
- **同步对象是行为，不是代码**：提取数据流、校验规则、状态机、API 语义（含 HTTP 方法）、边界情况；代码组织按 Nx 边界重写，不复制旧耦合。
- **与 admin-sync（kissen）的关键差异**：
  1. 上游与下游同为 Next.js，但上游是 Pages Router + SWR——不能因为「同栈」就搬代码，数据层必须落到 TanStack Query data-access；
  2. 下游是**双语文案**（next-intl，en-US/zh-CN 双份 messages），不是零 CJK——上游中文文案回填两份 locale 文件且键数对齐；
  3. 下游侧栏菜单是**静态 configs 多项目驱动**（`configs/{crm,ecommerce,education,hospital,stablecoin}.json`），没有后端 menuTree 运行时层；
  4. 下游 td-manage 侧迁移基线已全量完成（`apps/admin/src/lib/module-registry.ts` 47 模块 + app-local registry），首次运行是**锚定水位线**而非全量迁移。

## 锁定约束（任何同步不得违反，全文见 references/constraints.md）

1. 双语文案 en-US/zh-CN 同步回填，键数对齐
2. 权限双体系不得混用：模块 manifest 用语义码，按钮级 PermissionGuard 用后端 UUID
3. API HTTP 方法以上游源契约为准（fetcher 单元素=GET、双元素=POST；公共下拉统一 GET）
4. 三层一致性：configs 菜单 + 路由解析 + registry 同轮改
5. 只动 apps/admin 体系，kissen 三门户与 `libs/modules/kissen-*` 零改动
6. 原则上零新增外部依赖，需加先问用户

## 首次运行：锚定水位线（一次性）

状态文件 `.doc/td-manage/sync-state.json` 的 `lastSyncedSha` 为 null 时必须先走本模式，不得直接同步：

1. `git ls-remote http://10.0.6.203:8088/td_project/source-code/stack/td-manage feature/zxf` 拿 tip；clone/更新 `~/repos/td-manage` 后看 `git log` 候选锚点。
2. 与用户确认锚点 commit（保守方向：下游最近一次 td-manage 相关工作日之前的最近上游 commit；下游 td-manage 侧最近工作见 `.codex/project/memory.md`）。
3. `scripts/diff-upstream.sh --apply <sha>` 回填锚点；同步开始前如锚点到 tip 有积压，与用户确认口径（全部补同步 / 只同步部分 / 以现状推进）。
4. （可选但推荐）如同步涉及行为漂移裁决，建 `.doc/td-manage/01-功能全量清单与同步矩阵.md` 作为规格基线并回填 `specBaselineSha`；不建文档时以「上游 HEAD 源码即规格」逐批次 `git show` 对照。

## 日常同步流程（六步，顺序执行）

### 第 1 步：差量计算（确定性，跑脚本）

```bash
bash .claude/skills/td-manage-sync/scripts/diff-upstream.sh
```

输出 `lastSyncedSha..origin/feature/zxf` 变更文件清单。**为空时告知用户无变更，结束。**

### 第 2 步：映射受影响功能

上游文件 → 下游落点映射表见 references/conventions.md §1。要点：

- `src/pages/<module>/**` → `libs/modules/<domain>/*`；模块 key 对照 `apps/admin/src/lib/module-registry.ts`
- `src/lib/api/**` → 对应模块 data-access
- 菜单/路由类变更 → configs/*.json + `apps/admin/src/app` + 两个 registry 四层联动
- **映射存疑的文件（td-manage 页面 slug 与 registry key 非一一对应，如 group 路由 cross-chain/financial/sys 的子模块拆分）→ 列出来问用户，不要猜。**

### 第 3 步：规格保鲜（先改文档/规格，后改代码）

对每个受影响功能，重读上游变更后的源文件（`git show <sha>:<path>` 取全量）：

- 有 `.doc/td-manage/01-*.md` 时：行为有变先修订文档（注明日期与来源 commit），无变标注「已核对无行为变化」
- 无文档时：以本批次 `git show` 输出为准逐条提取行为清单（数据流/校验/状态机/方法/边界），实现前口头向用户复述关键行为变更

### 第 4 步：实现（逐功能）

按映射表落点实现，遵守 references/conventions.md；`references/pitfalls.md` 逐条核对不得回退（尤其：reSet 数字防御、slug 取 ID、mutation 解构、HTTP 方法契约、权限码口径）。

### 第 5 步：验证（逐功能）

- 先跑 `references/pitfalls.md` 逐条核对
- 受影响库：`npx nx lint <project>` + `npx nx test <project>`（有测试时）
- `npx nx build admin`（发布门禁；`npx tsc -b` 有已知库级工程债，不能作门禁）
- dev 冒烟 + browser 驱动变更页面：`npx nx dev admin`，locale 路由 `/en-US/...`；`NEXT_PUBLIC_*` 改动必须重启 dev
- 双语核对：en-US 与 zh-CN messages 键数对齐、新键两侧都有

### 第 6 步：收尾

- `diff-upstream.sh --apply <sha>` 推进 `lastSyncedSha`
- 新踩的坑沉淀进 `references/pitfalls.md`；可复用结论按 AGENTS.md 回填 `.codex/project/memory.md`

## 分支注意

上游以 `feature/zxf` 为准（脚本 fetch 后对比 `origin/feature/zxf`）。用户提到其他分支（main/master）有需要同步的内容时，先问清是否合入 feature/zxf 再操作，不要擅自切分支。

## 参考文件

| 文件 | 何时读 |
|---|---|
| `references/constraints.md` | 每次实现前；含权限双体系与 API 方法契约口径 |
| `references/conventions.md` | 映射与落点；新功能接入四层联动 |
| `references/pitfalls.md` | 实现与验证前逐条核对；源自 2026-07~09 迁移实战 |
| `.codex/project/memory.md` | 历史迁移决策与 bug 根因的第一手记录 |

## 状态文件

`.doc/td-manage/sync-state.json`。`specBaselineSha`（文档锚点）回填后只读；`lastSyncedSha` 只能通过脚本 `--apply` 推进。
