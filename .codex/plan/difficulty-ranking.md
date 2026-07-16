# Financial 模块迁移困难程度排序

本文件基于源码盘点结果，对 financial 下 9 个子模块按**迁移与重构困难程度从低到高**排序，并给出推荐开发批次、预估人天与关键阻塞项。

---

## 排序总表

| 顺序 | 模块 | 源文件数 | 代码行数 | API 数 | 表单复杂度 | 困难分数 | 推荐批次 | 预估人天 | 关键阻塞项 |
|------|------|----------|----------|--------|-----------|----------|----------|----------|------------|
| 1 | travel-rule | 1 | 346 | 0 | 低 | 1/5 | 第一批 | 1 | 无 |
| 2 | audit-trail | 2 | 777 | 2 | 低 | 1.5/5 | 第一批 | 2 | 无 |
| 3 | adjustments | 3 | 1069 | 0 | 中 | 2/5 | 第一批 | 2-3 | 需先实现 CopyableEllipsisText、Adjustment 系列共享组件 |
| 4 | chart-of-accounts | 2 | 1096 | 1 | 中 | 2.5/5 | 第一批 | 3 | 需先实现 financial-book-meta、formatEodCutoffTime |
| 5 | journal-entries-new | 2 | 1018 | 2 | 低 | 3/5 | 第二批 | 3 | 需先实现 journal API 类型 |
| 6 | statements | 3 | 1495 | 5 | 高 | 3.5/5 | 第二批 | 4 | 需 Select 多选、Drawer、文件下载 |
| 7 | journal-entries | 3 | 1590 | 6 | 高 | 4/5 | 第二批 | 5 | 需 AutoComplete、useFieldArray、动态表单 |
| 8 | posting-engine | 4 | 2487 | 3+ | 高 | 4.5/5 | 第三批 | 6-8 | 需拆 view.tsx、确认 API、tabs + matrix |
| 9 | transaction-event-configuration | 4 | 2103 | 2+ | 很高 | 5/5 | 第三批 | 6-8 | 需业务专家确认 mapping rule 逻辑、拆分 edit.tsx |

---

## 推荐开发批次

### 第一批：低风险，建立模式（1-2 周）

模块：travel-rule → audit-trail → adjustments → chart-of-accounts

**目标**：
- 建立 financial 模块基础设施（Nx libs、路由注册、i18n、权限常量）。
- 建立目标项目下的列表页、详情页、表单页统一模式。
- 完成通用工具实现：CopyableEllipsisText、公共下拉 queries、date-fns 格式化、financial-book-meta。
- 验证 DataTable + react-hook-form + TanStack Query 在真实业务场景下的可行性。

**完成后可交付**：
- 4 个可独立访问的模块页面。
- financial 通用 UI/工具库。
- 一套完整的迁移样板代码。

### 第二批：中等复杂度，验证 API 与复杂表单（2-3 周）

模块：journal-entries-new → statements → journal-entries

**目标**：
- 接入真实 financial API（journal、export task、bill rule）。
- 验证复杂表单：Drawer 表单、多选 Select、邮箱批量校验、动态字段数组。
- 验证文件下载、mutation 缓存失效、权限控制。

**完成后可交付**：
- 核心财务 API 数据层完整。
- 复杂表单模式确立。
- statements 导出任务流可用。

### 第三批：高风险，资深前端主导（2-3 周）

模块：posting-engine → transaction-event-configuration

**目标**：
- 拆解超大文件（view.tsx 1099 行、edit.tsx 870 行）。
- 实现 tabs、matrix、version history、mapping rule 等复杂业务。
- 与后端确认所有模糊 API endpoint。

**完成后可交付**：
- 过账引擎与交易事件配置完整可用。
- 所有 financial 模块迁移完成。

---

## 关键路径（Critical Path）

以下任务若未完成，会阻塞后续模块：

1. **路由方案确认**：financial 子模块是合并为 `financial` 一级模块，还是每个子模块作为独立一级模块注册？
2. **模块注册与 i18n 注册**：在 `module-registry.ts` 与 `merge-messages.ts` 中新增 financial 相关模块。
3. **通用 UI/工具实现**：
   - `CopyableEllipsisText`
   - `useTokenTypeOptions` / 公共下拉 queries
   - `formatTimestamp` / `formatEodCutoffTime`
   - `getFinancialBookMetaByBookId` / `getFinancialBookMetaById`
4. **权限模型确认**：`PermissionGuard` 是否直接支持 UUID permission string？
5. **API endpoint 确认**：posting-engine 与 transaction-event-configuration 的部分 API 通过 typings 生成文件引入，路径不清晰，需与后端对齐。

---

## 风险最高的三个模块

### 1. transaction-event-configuration（5/5）

- mapping-rule/edit.tsx 870 行，业务逻辑最复杂。
- mock 数据与真实 API 混合，需业务专家参与。
- 字段映射、条件配置、预览涉及多层动态数据结构。

### 2. posting-engine（4.5/5）

- view.tsx 1099 行，需按 tabs 大拆。
- 包含 matrix、version history、账户动态下拉等复杂交互。
- 部分 API 路径需后端确认。

### 3. journal-entries（4/5）

- edit.tsx 896 行，动态表单复杂。
- 需要 AutoComplete、useFieldArray、科目保存联动。
- 类型补齐工作量大（源文件几乎全 any）。

---

## 建议的最低可运行版本（MVP）

若资源有限，建议至少完成第一批 + journal-entries-new，即可覆盖：
- 纯静态页（travel-rule）
- 真实 API 列表+详情（audit-trail、journal-entries-new）
- 本地数据完整列表（adjustments）
- 复杂筛选+服务端分页（chart-of-accounts）

这四个模块跑通后，第二批、第三批可以按统一模式批量复制。

---

*本排序基于 2026-06-22 的源码盘点结果，实际开发中需根据后端接口就绪情况、UI 组件库完善程度动态调整。*
