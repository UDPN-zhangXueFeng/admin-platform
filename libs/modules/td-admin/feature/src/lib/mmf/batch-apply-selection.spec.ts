/**
 * 批量申报选择聚合单测 —— computeBatchSelection / buildBatchApplyPayload。
 *
 * 验收（mmf.md 第9章 / 第8章重构点）：
 *   - 选中条数 / 钱包总数 / 计提总额 聚合正确。
 *   - 边界：空选（全 0，applyReqVOList=[]）与全选（求和所有行）。
 *   - payload 形态：显式 AccrualApplyReqVO（applyReqVOList + ruleId + totalAccrualUnits），
 *     消除源码 Object.assign 副作用。
 *
 * 纯函数 spec（无 React），对齐 chart-of-accounts formatters / travel-rule matchesFilters 风格。
 */
import {
  buildBatchApplyPayload,
  computeBatchSelection,
  type BatchSelectionRow,
} from './batch-apply-selection';

function row(
  id: string,
  over: Partial<BatchSelectionRow> = {},
): BatchSelectionRow {
  return {
    id,
    accrualRecordId: Number(id),
    fundName: 'F',
    accrualUnits: 0,
    totalWallets: 0,
    tokenSymbol: 'USDC',
    ...over,
  };
}

const sampleRows: BatchSelectionRow[] = [
  row('1', { accrualUnits: 100, totalWallets: 2 }),
  row('2', { accrualUnits: 50.5, totalWallets: 3 }),
  row('3', { accrualUnits: 200, totalWallets: 5 }),
];

describe('computeBatchSelection', () => {
  it('returns all-zero aggregate for an empty selection (confirm button must stay disabled)', () => {
    expect(computeBatchSelection(sampleRows, [])).toEqual({
      selectLength: 0,
      selectTotalWallets: 0,
      totalAccrualUnits: 0,
    });
  });

  it('sums across every row when all rows are selected (full-select boundary)', () => {
    expect(
      computeBatchSelection(
        sampleRows,
        sampleRows.map((r) => r.id),
      ),
    ).toEqual({
      selectLength: 3,
      selectTotalWallets: 10, // 2 + 3 + 5
      totalAccrualUnits: 350.5, // 100 + 50.5 + 200
    });
  });

  it('aggregates only the selected rows (partial selection)', () => {
    expect(computeBatchSelection(sampleRows, ['1', '3'])).toEqual({
      selectLength: 2,
      selectTotalWallets: 7, // 2 + 5
      totalAccrualUnits: 300, // 100 + 200
    });
  });

  it('treats missing totalWallets / accrualUnits as 0 (backend may omit them)', () => {
    const rows = [row('1', { totalWallets: undefined, accrualUnits: undefined })];
    expect(computeBatchSelection(rows, ['1'])).toEqual({
      selectLength: 1,
      selectTotalWallets: 0,
      totalAccrualUnits: 0,
    });
  });

  it('ignores ids that are not present in the rows (defensive against stale selection)', () => {
    expect(computeBatchSelection(sampleRows, ['1', 'ghost'])).toEqual({
      selectLength: 1,
      selectTotalWallets: 2,
      totalAccrualUnits: 100,
    });
  });
});

describe('buildBatchApplyPayload', () => {
  it('produces an empty applyReqVOList for an empty selection (no accidental submits)', () => {
    expect(buildBatchApplyPayload(sampleRows, [], 1)).toEqual({
      applyReqVOList: [],
      ruleId: 1,
      totalAccrualUnits: 0,
    });
  });

  it('maps each selected row to { accrualRecordId, accrualUnits } and carries the ruleId + total', () => {
    const payload = buildBatchApplyPayload(sampleRows, ['2', '3'], '7');
    expect(payload.applyReqVOList).toEqual([
      { accrualRecordId: 2, accrualUnits: 50.5 },
      { accrualRecordId: 3, accrualUnits: 200 },
    ]);
    expect(payload.ruleId).toBe(7);
    expect(payload.totalAccrualUnits).toBe(250.5);
  });

  it('leaves ruleId undefined when none is chosen so the backend applies its default', () => {
    expect(buildBatchApplyPayload(sampleRows, ['1'], '').ruleId).toBeUndefined();
    expect(
      buildBatchApplyPayload(sampleRows, ['1'], undefined).ruleId,
    ).toBeUndefined();
  });

  it('keeps applyReqVOList order aligned with row order (selection membership, not selection order)', () => {
    // 实现用 rows.filter(r => selectedIds.includes(r.id))，顺序跟随行而非勾选顺序，
    // 与源码 useMemo 一致（后端对 applyReqVOList 顺序无语义要求）。
    const payload = buildBatchApplyPayload(sampleRows, ['3', '1'], 1);
    expect(payload.applyReqVOList.map((v) => v.accrualRecordId)).toEqual([1, 3]);
  });
});
