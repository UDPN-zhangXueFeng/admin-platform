# Dashboard 上游同步规格（2026-09-30）

依据 admin-sync fetch 后的 v2.0-tokenization HEAD d852329；主要行为源于 35b423e。

- GET /manage/dashboard/summary：五格生效统计、最低水位 Top 8、异常今日/近7日分组。金额 available/shortfall 成串直显，不由前端重算水位或金额。
- GET /manage/dashboard/pair?days=1|7|30：默认今日，全状态；Top 10 + Other，条宽按最大单对笔数、占比按全部行合计。
- GET /manage/dashboard/trend?days=7|14|30：默认7天，UTC+8 日切，稀疏日期补零；全部交易面积、异常折线，hover 计数及图例切换。
- summary/pair/trend 独立失败态；Refresh 同时重拉三个接口。异常窗口只切 summary 已带回的计数，不请求。
- 五卡跳转对应列表；低水位 View all 跳 /liquidity/pool；异常 View details 跳 /transfer/tx?status=70。
- 当前旧版资金池总览、网络总览及前端分页拼统计退役；现有组件/品牌主题重实现，全英文。
- 仅同步 Dashboard，其他上游变更尚未处理，不推进全局 lastSyncedSha。

## 验证记录

- Dashboard 与新 data-access 文件 ESLint 通过，git diff --check 通过。
- NX_DAEMON=false npx nx build kissen-admin 生产构建通过。构建后图表色值已按本仓 HSL 变量修正为 hsl(var(--...))，ESLint 复验通过。
- 使用已有 Recharts，无新增依赖；旧前端分页聚合请求从 Dashboard 中移除。
- 未运行浏览器冒烟、真实接口数据核对及响应式截图，因此不能声称已完成视觉验收。
- 本轮实现超过 4,000-token 单任务预算，已向用户报告，未扩展同步其他上游域。
