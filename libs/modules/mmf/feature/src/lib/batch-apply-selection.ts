/**
 * 批量申报选择聚合 —— 纯函数（无 React 依赖，可单测）。
 *
 * 迁移自 td-manage src/pages/mmf/accrual/index.tsx 的「勾选行 → 聚合统计」逻辑。
 * 原逻辑内嵌在组件 `useMemo` 中，此处抽离为纯函数以便覆盖空选 / 全选边界。
 *
 * 聚合三要素（源码报「选中条数 / 钱包总数 / 计提总额」）：
 *   - selectLength        选中行数
 *   - selectTotalWallets  选中行 totalWallets 求和
 *   - totalAccrualUnits   选中行 accrualUnits 求和（后端用此值回填）
 *
 * payload 映射（重构点：消除源码 `Object.assign` 副作用，改为显式 payload）：
 *   批量申报 = { applyReqVOList: [{ accrualRecordId, accrualUnits }], ruleId, totalAccrualUnits }
 */
import type {
  AccrualApplyReqVO,
  BatchApplyListItem,
} from '@myorg/modules/mmf/data-access';

/** 带注入 id 的批量申报行（DataTable `{ id: string }` 契约）。 */
export interface BatchSelectionRow extends BatchApplyListItem {
  id: string;
}

/** 批量申报选择聚合结果。 */
export interface BatchSelectionAggregate {
  selectLength: number;
  selectTotalWallets: number;
  totalAccrualUnits: number;
}

/**
 * 从全量行 + 已选 id 列表计算聚合统计。
 *
 * 空选（selectedIds 为空）返回全 0；全选（selectedIds 覆盖全部行）
 * 返回全部行的求和 —— 这两条是验收要求的边界。
 *
 * totalWallets / accrualUnits 缺失（undefined / null）按 0 计入，
 * 与组件内 `(r.totalWallets ?? 0)` 一致。
 */
export function computeBatchSelection(
  rows: BatchSelectionRow[],
  selectedIds: string[],
): BatchSelectionAggregate {
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  return {
    selectLength: selectedRows.length,
    selectTotalWallets: selectedRows.reduce(
      (sum, r) => sum + (r.totalWallets ?? 0),
      0,
    ),
    totalAccrualUnits: selectedRows.reduce(
      (sum, r) => sum + Number(r.accrualUnits ?? 0),
      0,
    ),
  };
}

/**
 * 由选中行 + 当前 ruleId 构造批量申报 mutation payload。
 *
 * 空选时 applyReqVOList 为 `[]`（组件层据此 disabled 确认按钮，
 * 并在强制提交时由 toast 提示「noSelection」）。
 */
export function buildBatchApplyPayload(
  rows: BatchSelectionRow[],
  selectedIds: string[],
  ruleId: number | string | undefined,
): AccrualApplyReqVO {
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const aggregate = computeBatchSelection(rows, selectedIds);
  return {
    applyReqVOList: selectedRows.map((r) => ({
      accrualRecordId: r.accrualRecordId,
      accrualUnits: r.accrualUnits,
    })),
    ruleId: ruleId != null && ruleId !== '' ? Number(ruleId) : undefined,
    totalAccrualUnits: aggregate.totalAccrualUnits,
  };
}
