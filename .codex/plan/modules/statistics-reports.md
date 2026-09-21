# statistics-reports 模块迁移计划

## 1. 业务概述

Statistics Reports（统计报表）是仪表盘类模块，展示稳定币/Tokenized Deposit 的**总览数据、交易活动趋势和 PDF 导出**。

核心业务：① Token 类型 Tab 切换（Stablecoin / TD）；② 概览卡片（稳定币数量/SP 数量/钱包数/交易数，含饼图）；③ 活动趋势 ECharts 图表（新钱包趋势/SP 交易/ABC 交易笔数/ABC 交易量）；④ 数据明细表格（双表格模式：稳定币 12 列 vs TD 10 列）；⑤ **PDF 导出**（html2canvas + jsPDF，先渲染隐藏的 StatisticsReportsComponent 再截图导出）。

页面构成：单页（index.tsx），含 4 个组件（StablecoinsOverview + StatisticsReportsComponent + ServiceProvidersChart + StatisticsChart）。无 CRUD 页面。

---

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 678 | **主页面**：Token type Tabs 切换 → 获取 chartData/coinOptions → StablecoinsOverview 渲染（概览卡片 + 活动图表 + 表格）。含时间范围选择器（7d/14d/月/自定义）、币种下拉、PDF 导出按钮（渲染隐藏的 StatisticsReportsComponent 后截图）。4 套数据状态管理（walletData/spData/abcCountData/abcVolumeData）。 |
| `StablecoinsOverview.tsx` | 225 | **概览组件**：接收 chartData/timeRange/coinOptions 等 props。3 Card：① 概览卡片（4 个 ServiceProvidersChart 饼图）+ 下载按钮（权限码 `3ed748f21c2741eeaf53733ff2422c91`）；② 活动趋势（币种 Select + 时间范围 Select + RangePicker + StatisticsChart 折线/柱状图）；③ 数据表格（StablecoinTable props 注入，含当前时间 UTC）。 |
| `StatisticsReportsComponent.tsx` | 800 | **PDF 导出渲染组件**（forwardRef）：正常模式下 hidden，导出时显示。`useImperativeHandle` 暴露 `updateData`/`exportToPDF`。导出逻辑：html2canvas 截图 → jsPDF 拼页（概览页 + 每 2 个币种卡片一页 + 表格页）。数据：为每个 stablecoin 并发请求 4 个 API（wallet/sp/abcCount/abcVolume）+ tdList。含 2 套表格列定义（stablecoin 12 列 / TD 10 列）。 |
| `ServiceProvidersChart.tsx` | 142 | **饼图卡片组件**：title + count + ECharts 饼图（chartData 数据）。当 chartData 为空时不显示图表。 |
| `StatisticsChart.tsx` | 310 | **ECharts 趋势图组件**：4 个子图（钱包趋势折线图 / SP 交易柱状图 / ABC 交易笔数多折线 / ABC 交易量多折线）。含 table 模式（showTables 控制图表 vs 表格展示）。 |

---

## 3. 依赖的 API

> 共 **10 个唯一 endpoint**（statistics-reports.ts 9 个 + common.ts 1 个）。

### 3.1 基础数据 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/tokenType/list` | GET | index.tsx setInitData | Token 类型列表 → Tabs（status===1 的项） |
| `/api/manage/v1/statisticsReports/stablecoinsOverview` | POST | index.tsx + StatisticsReportsComponent | 概览数据（stablecoinsCount/SP/wallets/transaction + 饼图比例） |
| `/api/manage/v1/common/stablecoin/searches` | POST | index.tsx + StatisticsReportsComponent | 稳定币列表（按 tokenTypeId 筛选 → coinOptions 下拉） |

### 3.2 趋势图表 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/statisticsReports/walletQuantityStatistics` | POST | index.tsx + StatisticsReportsComponent | 新钱包数量趋势（time→numberOfNewWallets） |
| `/api/manage/v1/statisticsReports/spTransactionStatistics` | POST | index.tsx + StatisticsReportsComponent | SP 交易统计（spName→count+volume） |
| `/api/manage/v1/statisticsReports/abcTransactionCountStatistics` | POST | index.tsx + StatisticsReportsComponent | ABC 交易笔数趋势（time→topUp/transfer/withdrawal） |
| `/api/manage/v1/statisticsReports/abcTransactionVolumeStatistics` | POST | index.tsx + StatisticsReportsComponent | ABC 交易量趋势（time→topUp/transfer/withdrawal） |

### 3.3 表格/导出 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/statisticsReports/tokenizedDepositsList` | POST | index.tsx（2 个 useCustomTable） + StatisticsReportsComponent | Token 列表数据（双表格模式） |
| `/api/manage/v1/statisticsReports/td/list` | POST | StatisticsReportsComponent（setTableData） | TD 列表（导出用） |
| `/api/manage/v1/export/task/create` | POST | api 模块（exportTaskCreateApi，引用但未在页面中调用） | 导出任务创建（源码中导入但未使用——保留不删） |

### 3.4 依赖共享组件/工具

- `CustomTable` / `useCustomTable` → `DataTable` + TanStack Query
- `libs/echarts` → **recharts**（目标项目已用于 pledge 模块）
- `html2canvas` + `jsPDF` → 保留（PDF 导出核心依赖）
- `formatTimestamp` / `getDateFormat` / `reSet` / `getLS` → 已有对应

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中** |
| 困难分数 | 3/5 |
| 主要难点 | ① **ECharts → recharts 迁移**：4 种图表类型（饼图/折线/柱状/多折线）+ table 模式切换；② **PDF 导出**：html2canvas + jsPDF 多页拼页逻辑需保留；③ **StatisticsReportsComponent forwardRef + useImperativeHandle** 模式；④ **双表格模式**：stablecoin vs TD 列定义不同；⑤ **时间范围联动**：7d/14d/Month/Custom + RangePicker + dateRange 计算 |
| 建议负责人 | 中级前端（图表迁移 + PDF 导出有一定复杂度） |

---

## 5. 迁移后目标文件清单

```text
libs/modules/statistics-reports/
├── data-access/src/lib/
│   ├── statistics-reports.model.ts
│   ├── statistics-reports.api.ts
│   └── +queries/
│       ├── statistics-reports.keys.ts
│       ├── statistics-reports.queries.ts
│       └── statistics-reports.mutations.ts
├── feature/src/lib/
│   ├── statistics-reports-page.tsx          # 主页面（index.tsx 678行）
│   ├── statistics-reports-content.tsx       # 页面内容（拆 content 避免 nx lazy 误报）
│   ├── stablecoins-overview.tsx             # 概览组件
│   ├── service-providers-chart.tsx          # 饼图卡片
│   ├── statistics-chart.tsx                 # 趋势图表（4 子图）
│   └── module-manifest.ts
├── ui/src/lib/
│   └── statistics-pie-card.tsx              # 饼图卡片 UI（ServiceProvidersChart 替代）
└── util/src/lib/
    └── statistics-reports.constants.ts       # 时间范围选项/表格列定义/权限码
```

**说明**：statistics-reports 是单模块（非 group），只有 1 个 list 页面。`StatisticsReportsComponent.tsx`（PDF 导出渲染组件）逻辑合并到主页面 content 中，不单独建文件。

---

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|----------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query |
| `echarts` (libs/echarts) | **recharts**（PieChart/LineChart/BarChart） |
| `Card` / `Row` / `Col` (antd) | `@myorg/shared/ui` Card + Tailwind Grid |
| `Select` / `DatePicker.RangePicker` | `FormSelect` / `FormDatePicker` |
| `Button` | `@myorg/shared/ui` Button |
| `Tabs` | `@myorg/shared/ui` Tabs |
| `Spin` | Loading / Suspense |
| `Table` (antd 静态) | `@myorg/shared/ui` DataTable |
| `html2canvas` + `jsPDF` | 保留（PDF 导出） |
| `forwardRef` + `useImperativeHandle` | 保留（导出 ref 模式） |

### 6.1 状态/枚举

- 无状态枚举映射（纯图表展示模块，无 status/tag 枚举）
- 权限码：`3ed748f21c2741eeaf53733ff2422c91`（下载 PDF）
- Token 状态：`tokenStatus === 1 ? Active : Inactive`（i18n: statistics_reports_0015/0016）

### 6.2 图表类型映射

| ECharts | recharts |
|---------|----------|
| `pie` series | `<PieChart>` + `<Pie>` |
| `line` series | `<LineChart>` + `<Line>` |
| `bar` series | `<BarChart>` + `<Bar>` |
| multi-line (TopUp/Transfer/Withdrawal) | 3× `<Line>` in one `<LineChart>` |

---

## 7. 迁移步骤

1. **建库 + 注册**：创建 statistics-reports 四层库，manifest 注册单模块（list 页）。tsconfig paths + i18n namespace。
2. **类型/API/Queries/常量**：model.ts + api.ts（10 endpoint）+ queries + constants。
3. **饼图卡片组件**：recharts PieChart 替代 ECharts 饼图。
4. **趋势图表组件**：recharts LineChart/BarChart 替代 ECharts 4 子图 + table 模式。
5. **概览组件**：3 Card 布局（概览 + 活动 + 表格）。
6. **主页面**：Token type Tabs → 数据联动 → 时间范围选择 → PDF 导出（html2canvas + jsPDF）。
7. **i18n + 静态验证**。

---

## 8. 风险与注意事项

- **ECharts → recharts 迁移**：ECharts 的 `setOption` API 与 recharts 声明式组件差异大。饼图简单，但多折线图（TopUp/Transfer/Withdrawal 三线）需重构数据处理（recharts 需要 `{name, TopUp, Transfer, Withdrawal}` 格式数组）。
- **PDF 导出逻辑保留**：html2canvas + jsPDF 拼页逻辑不变，仅将 DOM 选择器 `.overview-card`/`.stablecoin-detail-card`/`.table-card` 对应到新组件 className。
- **forwardRef 模式**：`StatisticsReportsComponent` 的 `useImperativeHandle` 暴露 `updateData` 和 `exportToPDF` 需保留在 content 组件中。
- **双表格列定义**：stablecoin 模式（12 列含 reserveAccount/repositoryBalance/stablecoinsInCirculation/totalMinted/totalMelted）vs TD 模式（10 列含 stablecoinsInCirculation/totalMinted/totalMelted 且标签不同）。用 tokenTypeId 条件判断。
- **已知限制**：① exportTaskCreateApi 在源码中导入但未调用，保留不删；② PDF 导出依赖 html2canvas/jsPDF，需确保 bundle 包含；③ 该模块无 CRUD 操作，无 mutation hooks。

---

## 9. 验收标准

- Token type Tabs 切换正确，数据联动刷新
- 概览卡片 4 个饼图渲染正确
- 活动趋势图表（4 子图）数据正确，时间范围切换正常
- 双表格模式切换正确（stablecoin 12 列 vs TD 10 列）
- PDF 导出功能正常（概览页 + 币种卡片页 + 表格页）
- 所有文案 i18n 化
- `pnpm nx lint statistics-reports` / build 通过
