/**
 * Suspense Adjustment 依赖业务 Domain 的转换函数。
 *
 * 迁移自 td-manage src/lib/components/financial/adjustments/helpers.ts 的
 * getSuspenseAccountLine / getOffsettingEntryFor / buildAdjustPayload。
 * 这些函数依赖业务 Domain Model，故放 data-access 层（util 不可依赖 data-access）。
 */
import type { DrCr } from '@myorg/modules/suspense-adjustment/util';
import { dateStringToEpoch } from '@myorg/modules/suspense-adjustment/util';
import type {
  NewAdjustmentForm,
  SuspenseAdjustmentDetail,
  SuspenseEntryLine,
} from './suspense-adjustment.model';

/** 提交调账请求体（对应后端 /adjust 的 SuspenseAdjustReqVo）。 */
export interface AdjustPayload {
  suspenseRecordId: number;
  suspenseTxnId: string;
  postingDate: number;
  entries: Array<{
    accountCode: string;
    accountName: string;
    direction: number;
    amount: number;
  }>;
  adjustmentReason: string;
}

const drCrToDirectionCode = (drCr: DrCr): number => (drCr === 'Dr' ? 1 : 2);

/**
 * 从暂记分录中派生「暂记科目」（用于 Offsetting Entry For 文案来源）。
 * 取与该笔异常「暂记方向」一致的分录行（一笔异常含两条分录，其一为暂记科目，
 * 另一为对端）。取第一条非零 amount 的方向作为暂记方向。
 */
export const getSuspenseAccountLine = (
  detail: Pick<SuspenseAdjustmentDetail, 'suspenseEntries'>,
): SuspenseEntryLine | undefined => {
  const first = detail.suspenseEntries?.find((e) => e.amount > 0);
  if (!first) return detail.suspenseEntries?.[0];
  return detail.suspenseEntries?.find((e) => e.drCr === first.drCr) ?? first;
};

/**
 * Offsetting Entry for 只读文案。
 * 格式 `<抵账方向> <暂记科目展示串>`，例如 `Cr 1900.99 - Suspense Account - Asset`。
 * 方向取暂记方向的反向；科目取暂记科目分录的 accountDisplay。
 */
export const getOffsettingEntryFor = (
  detail: Pick<SuspenseAdjustmentDetail, 'suspenseEntries'>,
): string => {
  const line = getSuspenseAccountLine(detail);
  if (!line) return '';
  const direction: DrCr = line.drCr === 'Dr' ? 'Cr' : 'Dr';
  return `${direction} ${line.accountDisplay}`.trim();
};

/**
 * 由 New Adjustment 表单构造 /adjust 请求体。
 * - postingDate 字符串 → epoch millis。
 * - entries 取 accountCode / accountName / direction / amount，过滤空行与非法金额。
 */
export const buildAdjustPayload = (form: NewAdjustmentForm): AdjustPayload => {
  const postingDate = dateStringToEpoch(form.postingDate) ?? Date.now();
  const entries = form.entries
    .map((e) => ({
      accountCode: e.accountCode,
      accountName: e.accountName,
      direction: drCrToDirectionCode(e.drCr),
      amount: e.amount as number,
    }))
    .filter(
      (e) =>
        e.accountCode &&
        Number.isFinite(e.amount) &&
        typeof e.amount === 'number' &&
        e.amount > 0,
    );
  return {
    suspenseRecordId: form.suspenseRecordId,
    suspenseTxnId: form.suspenseTxnId,
    postingDate,
    entries,
    adjustmentReason: form.adjustmentReason?.trim() ?? '',
  };
};
