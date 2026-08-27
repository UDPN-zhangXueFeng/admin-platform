---
name: update-gateway
description: |
  同步 Kissen 网关前端上游（GitLab 私库 kissen-bank-gateway-frontend，Vue 源码）到
  apps/kissen-gateway-portal（本 skill 唯一目标项目），端到端流程：
  检查上游是否有更新 → 生成按日期命名的更新总结开发文档 → ultrathink 深度推理产出开发计划 →
  用 orchestration 编排开发 → 子 agent 校验循环直到全部通过。仅限 admin-platform 项目使用。
  当用户说「update-gateway」「更新网关」「同步网关」「gateway 上游有没有更新」「同步 kissen-bank-gateway-frontend」，
  或要求把网关上游最新变更落到 admin-platform 时，必须使用此 skill。
---

# 网关上游同步（update-gateway）

把 GitLab 上游 `kissen-bank-gateway-frontend`（Vue 源码）的增量变更，
同步到 `apps/kissen-gateway-portal`，
以「总结文档 → 开发计划 → 编排开发 → 子 agent 校验循环」四段流水线收尾。

## 前置事实（勿重复探测，直接使用）

| 项 | 值 |
|----|----|
| 上游仓库 | `http://10.0.6.203:8088/udpn-kissen/source-code/kissen-bank-gateway-frontend.git`（project id 2115，默认分支 main） |
| 上游访问方式 | 项目访问令牌，存于 `<admin-platform>/.doc/kissen/.gitlab-token`（gitignore 内，勿入库勿外传）；脚本自动读取并以 `oauth2:<token>@` 访问，令牌缺失时回退本机 git 凭证。GitLab 匿名 API 404；如需 API 一律带 `Private-Token` 头 |
| 本地克隆缓存 | `<admin-platform>/.doc/kissen/.cache/kissen-bank-gateway-frontend`（.doc/ 已 gitignore） |
| 检查脚本 | `<skill>/scripts/check-updates.sh`（确定性：clone/fetch + diff 事实输出） |
| 总结文档目录 | `<admin-platform>/.doc/kissen/project/gateway/` |
| 状态文件 | `<admin-platform>/.claude/update-gateway-state.json` |
| 目标实现 | `apps/kissen-gateway-portal`（**唯一目标**，本 skill 不处理其他 app/libs） |
| 本 skill 范围 | 仅 admin-platform 项目；cwd 不是 admin-platform 根时直接报错，不猜测 |

## 流程总览

| 阶段 | 做什么 | 完成标志 |
|------|--------|----------|
| 一·检查更新 | 跑脚本 fetch 上游，对比 state 里 lastSyncedSHA | 确认「有/无更新」及变更事实 |
| 二·更新总结 | 读 diff + 变更文件源码，写按日期命名的开发文档 | 总结文档落盘，state.phase=summarized |
| 三·ultrathink 规划 | 最强推理把总结文档转为可开发计划文档 | 计划文档落盘，phase=planned |
| 四·orchestrate 开发 | 按 orchestration skill 编排执行计划 | 计划内任务全部实现，phase=developed |
| 五·校验循环 | 独立 reviewer 子 agent 对照计划校验，问题→修复→重验 | 全项通过，phase=verified，写回 lastSyncedSHA |

> 为什么分五段：上游 diff 是事实（脚本出），业务影响是判断（模型出）；
> 开发与校验必须由不同 agent 承担，避免「自验偏见」；lastSyncedSHA 只有校验通过才推进，
> 防止「拉了代码没落地就算同步完成」（CLAUDE.md Rule 12 Fail loud）。

## 状态文件

每次进入 skill 先读状态文件，按 `phase` 续跑；退出前写回：

```json
{
  "repoUrl": "http://10.0.6.203:8088/udpn-kissen/source-code/kissen-bank-gateway-frontend.git",
  "branch": "<上游默认分支>",
  "lastSyncedSHA": "<上次校验通过时的上游 commit>",
  "lastSyncedAt": "<ISO 时间>",
  "summaryDoc": "<本次总结文档绝对路径>",
  "planDoc": "<本次计划文档绝对路径>",
  "phase": "checked | summarized | planned | developed | verified",
  "verifyRounds": 0
}
```

---

## 阶段一：检查上游更新（确定性，禁止跳过脚本）

```bash
bash .claude/skills/update-gateway/scripts/check-updates.sh "$LAST_SYNCED_SHA"
```

脚本输出（KEY=VALUE 分段）：`BRANCH` / `NEW_SHA` / `OLD_SHA`，
有增量时追加 `COMMITS`（`hash|date|author|subject`，已滤 merge）、`DIFF_STAT`、`CHANGED_FILES`（name-status）。

判定：
- `NEW_SHA == OLD_SHA` → 无更新，告知用户当前基线（短 SHA + 日期）后结束，不产生文档。
- 有增量 → 建状态文件（`phase: checked`），进入阶段二。
- 脚本输出 `HISTORY_REWRITTEN=1`（force push/rebase）→ 停下向用户说明，确认后以 merge-base 为界继续。

**首次运行（无 lastSyncedSHA）**：脚本只建立克隆缓存并报当前 HEAD。
默认以当前 `NEW_SHA` 为初始基线、不生成文档；用户说「全量初始化」时才对全量源码做一次总结。

## 阶段二：生成更新总结文档（按日期命名）

输出：`.doc/kissen/project/gateway/YYYY-MM-DD-gateway更新总结.md`（日期 = 当天）。

- 当天已有同名文档且是**不同批次**（SHA 区间不同）→ 在文档末尾追加
  `## 批次 N：<old短SHA>..<new短SHA>` 章节继续写，不覆盖已有内容；
- 只有日期没有第二份文件，保持单文件单日期。

写法（事实与判断分离，参照 module-migration 的成熟做法）：
1. **事实段**（来自脚本，零改动照搬）：SHA 区间、时间范围、commit 列表、diff stat、变更文件清单。
2. **判断段**（读上游仓库缓存里变更文件的**实际源码**后写，禁止只翻译 commit message）：
   - 按功能域分组（页面/路由、组件、API 封装、i18n 文案、状态枚举、权限码、构建配置）；
   - 每组写清：上游改了什么 → 对 `apps/kissen-gateway-portal`
     哪些现有文件有影响 → 新增/修改/删除分别对应目标侧什么动作；
   - 纯上游内部事务（lint 配置、CI、lock 文件等）归入「无需同步」小节并给理由。

文档骨架（ALWAYS 套用）：

```markdown
# Gateway 上游更新总结（YYYY-MM-DD）

## 1. 更新范围（事实）
<SHA 区间 / 时间 / commits / diff stat / 变更文件清单>

## 2. 变更分析（按功能域）
### 2.x <功能域名>
- 上游变更：<文件 + 行为级描述>
- 目标侧影响：<具体文件 / 需要的动作>
## 3. 无需同步项
## 4. 风险与依赖顺序
```

写完置 `phase: summarized`，`summaryDoc` 记入状态。

## 阶段三：ultrathink 规划为开发计划

对总结文档做 ultrathink 级深度推理（放慢、逐项推演目标侧文件改动与边界），产出：
`.doc/kissen/project/gateway/YYYY-MM-DD-gateway开发计划.md`（与总结文档同日期）。

计划必须可执行、可验收，每个任务包含：

```markdown
## 任务 T<n>：<名称>
- 目标：<一句话>
- 目标侧文件：<apps/libs 具体路径>
- 上游依据：<总结文档 §2.x / 上游文件路径>
- 步骤：<改动序列>
- 依赖：<T<m> 或 无>
- 验收标准：<可核对条目，供阶段五逐项校验>
```

规划原则：基础数据/类型/常量在前，页面与交互在后，删除类任务独立成任务；
遵循 admin-platform 现有约定（Nx 边界、i18n 命名空间、`libs/shared` 不依赖 `libs/modules/*`）。
**计划落盘后先向用户展示任务清单（表格：编号|名称|目标文件|依赖|验收点），确认后再开发**——
任务边界错了返工成本极高（CLAUDE.md Rule 1）。确认后 `phase: planned`。

## 阶段四：orchestrate 开发

1. **先读 `skill://orchestration`**，按其方式编排执行开发计划（这是用户指定的 orchestrate 命令语义）。
   该 skill 不可用时降级为 `task` 子 agent 并行切片（按任务依赖分波），并在输出中说明降级。
2. 每个任务派发时必须携带：计划文档路径 + 该任务的「目标侧文件 / 上游依据 / 验收标准」全文，
   子 agent 无会话历史，不能只给编号。
3. 上游源码参照统一用克隆缓存路径，禁止子 agent 自行重新 clone。
4. 全部任务完成后 `phase: developed`，进入阶段五。

## 阶段五：子 agent 校验循环（问题→修复→重验，直到通过）

1. **独立 reviewer 子 agent**（未参与开发的 agent，如 `reviewer`），输入：
   计划文档 + 本次变更的目标侧文件清单 + 总结文档路径。逐条核对每个任务的「验收标准」，
   输出 `{item, passed, evidence}`；命中任一即视为未通过：
   - 验收标准任一条不满足；
   - 与上游变更语义不一致（字段名、枚举值、路由、i18n key 漏改错改）；
   - 破坏 admin-platform 现有约定（Nx boundary、i18n 前缀、shared 依赖方向）。
2. **最窄验证**（与变更项目相关）：`npx nx lint kissen-gateway-portal`，
   改动波及该 app 消费的库（如 `libs/modules/kissen-gateway`）时一并 lint/test 对应 project；
   快速 tsc 环参照 memory：`cd apps/kissen-gateway-portal && pnpm exec tsc --noEmit`（TS6305 为既有噪音）。
3. 未通过 → 列出问题清单交开发 agent 修复（同一任务同一 agent 连续修）→ 回到本阶段第 1 步重验，
   `verifyRounds+1`。**同一问题连续 2 轮未修复或总轮数 ≥ 5 → 停下向用户汇报，不得静默放弃**。
4. 全部通过 → `phase: verified`，把 `NEW_SHA` / 当前时间写入 `lastSyncedSHA` / `lastSyncedAt`，
   输出总结：同步区间、任务完成度、校验轮数与发现并修复的问题、遗留风险。

---

## 注意事项

1. **lastSyncedSHA 是同步进度的唯一事实**：只有阶段五全过才推进；中途断掉重进 skill 时，
   按 `phase` 从对应阶段续跑，不重复拉取。
2. **令牌安全**：令牌只存在于 `.doc/kissen/.gitlab-token`（`.claude/` 被 git 跟踪，禁止把令牌写进 skill、脚本或任何入库文档）。上游访问统一走脚本；禁止匿名 GitLab API（404 已实证），API 必须带 `Private-Token`。
3. 上游是 Vue 源码、目标是 Next.js/Nx 实现——同步的是**业务语义**（路由、字段、枚举、文案、交互），
   不是逐行翻译；组件层按 admin-platform 现有组件映射。
4. 删除/重命名的上游文件 → 目标侧对应代码按计划走 clean cutover，不留废弃垫片。
5. 本 skill 只管网关上游同步；用户若同时要求迁移全新模块，转 `skill://module-migration`。
