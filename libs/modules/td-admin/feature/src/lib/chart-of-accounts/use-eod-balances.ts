'use client';

import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import {
  buildEodStatementDetail,
  buildEodStatementRows,
  getUtc8DayTimestampRange,
  parseCurrencyAmount,
  useEodBalancesQuery,
  useEodStatementDetailQuery,
  type CoaRow,
  type EodClearingStatus,
  type EodStatementDetail,
  type EodStatementRow,
  type PostToSuspenseConfig,
} from '@myorg/modules/td-admin/data-access';

import { getFinancialBookMetaById } from './financial-book-meta';
import { buildEodColumns, buildFirstBookEodColumns } from './eod-columns';

export interface UseEodBalancesOptions {
  financeBookId: number | undefined;
  /** 账本 meta id（'1' / '2'）。 */
  detailId: string;
  /** 账本货币（fallback + 金额格式化）。 */
  currency: string;
  /** COA 树行（Post to Suspense 借贷账户选项与默认值）。 */
  coaRows: CoaRow[];
  enabled?: boolean;
}

/**
 * useEodBalances — EOD Statements tab 的状态与操作。
 *
 * 迁移自源 useChartOfAccounts 的 EOD 部分：余额列表（服务端按 range 查询 + 客户端
 * clearingStatus 过滤）、明细（drawer / review modal）、post-to-suspense（modal）。
 */
export function useEodBalances({
  financeBookId,
  detailId,
  currency,
  coaRows,
  enabled = true,
}: UseEodBalancesOptions) {
  const t = useTranslations('modules.chart-of-accounts');
  const [appliedRange, setAppliedRange] = useState<[number, number] | null>(null);
  const [appliedClearing, setAppliedClearing] = useState<EodClearingStatus | undefined>(
    undefined
  );
  const [selectedStatement, setSelectedStatement] = useState<EodStatementRow | null>(null);
  const [postToSuspenseStatement, setPostToSuspenseStatement] =
    useState<EodStatementRow | null>(null);

  const bookMeta = useMemo(() => getFinancialBookMetaById(detailId), [detailId]);
  const isFirstBook = bookMeta.id === '1';

  const rangeTs = useMemo(() => getUtc8DayTimestampRange(appliedRange), [appliedRange]);

  const balancesQuery = useEodBalancesQuery(
    financeBookId,
    {
      startDate: rangeTs?.startDate,
      endDate: rangeTs?.endDate,
      pageNum: 1,
      pageSize: 10,
    },
    enabled
  );

  const eodRows = useMemo(
    () => buildEodStatementRows(balancesQuery.data, currency),
    [balancesQuery.data, currency]
  );

  // 客户端再过滤 clearingStatus（range 已在服务端过滤）
  const filteredEodRows = useMemo(() => {
    return eodRows.filter((row) => {
      if (appliedClearing && row.clearingStatus !== appliedClearing) return false;
      return true;
    });
  }, [eodRows, appliedClearing]);

  // 明细查询：仅 details / review-confirm 时
  const selectedEodId =
    selectedStatement &&
    (selectedStatement.actionType === 'details' ||
      selectedStatement.actionType === 'review-confirm')
      ? selectedStatement.financeBookEodId
      : undefined;
  const detailQuery = useEodStatementDetailQuery(selectedEodId, Boolean(selectedEodId));
  const selectedDetail = useMemo<EodStatementDetail | null>(
    () => buildEodStatementDetail(detailQuery.data, currency, selectedStatement),
    [detailQuery.data, currency, selectedStatement]
  );

  const openDetail = useCallback((record: EodStatementRow) => {
    if (!record.financeBookEodId) return;
    setSelectedStatement({
      ...record,
      actionType:
        record.clearingStatus === 'pending' ? 'review-confirm' : 'details',
    });
  }, []);

  const closeDetail = useCallback(() => setSelectedStatement(null), []);

  const openPostToSuspense = useCallback(
    (record: EodStatementRow) => setPostToSuspenseStatement(record),
    []
  );
  const closePostToSuspense = useCallback(() => setPostToSuspenseStatement(null), []);

  const onApplyFilters = useCallback(
    (range: [number, number] | null, clearing?: EodClearingStatus) => {
      setAppliedRange(range);
      setAppliedClearing(clearing);
    },
    []
  );

  // Post to Suspense 配置（源 `postToSuspenseConfig`）：
  // 金额取 EOD 行 variance（回退 |assets - liabilities|），方向取 assets >= liabilities；
  // 借方账户按方向取可过账 2001 / 1001（回退该方向第一个可过账科目），
  // 贷方账户取暂记科目 1900.99 / 2900.99。
  const postToSuspenseConfig = useMemo<PostToSuspenseConfig | null>(() => {
    if (!postToSuspenseStatement) return null;

    const totalAssetsValue = parseCurrencyAmount(
      postToSuspenseStatement.totalAssets
    );
    const totalLiabilitiesValue = parseCurrencyAmount(
      postToSuspenseStatement.totalLiabilities
    );
    const varianceAmount = parseCurrencyAmount(
      postToSuspenseStatement.variance
    );
    const amount =
      varianceAmount || Math.abs(totalAssetsValue - totalLiabilitiesValue);
    const isAssetGreater = totalAssetsValue >= totalLiabilitiesValue;

    const postableAccounts = coaRows.filter(
      (item) => item.rowType === 'item' && item.allowPosting
    );
    const postableAssetAccounts = postableAccounts.filter(
      (item) => item.accountType === 'assets'
    );
    const postableLiabilityAccounts = postableAccounts.filter(
      (item) => item.accountType === 'liabilities'
    );

    const suspenseAssetAccount = postableAssetAccounts.find(
      (item) => item.accountCode === '1900.99'
    );
    const suspenseLiabilityAccount = postableLiabilityAccounts.find(
      (item) => item.accountCode === '2900.99'
    );
    const defaultDebitAccount = isAssetGreater
      ? (postableLiabilityAccounts.find((item) => item.accountCode === '2001') ??
        postableLiabilityAccounts[0])
      : (postableAssetAccounts.find((item) => item.accountCode === '1001') ??
        postableAssetAccounts[0]);
    const defaultCreditAccount = isAssetGreater
      ? suspenseAssetAccount
      : suspenseLiabilityAccount;
    const eodDateMs = postToSuspenseStatement.eodDateValue;

    return {
      totalAssets: postToSuspenseStatement.totalAssets,
      totalLiabilities: postToSuspenseStatement.totalLiabilities,
      amount: amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      currency: currency || undefined,
      directionText: isAssetGreater
        ? '(Assets > Liabilities)'
        : '(Liabilities > Assets)',
      postingDate:
        Number.isFinite(eodDateMs) && eodDateMs > 0
          ? format(new Date(eodDateMs), 'yyyy-MM-dd')
          : undefined,
      defaultDebitAccount: defaultDebitAccount?.key,
      defaultCreditAccount: defaultCreditAccount?.key,
      debitOptions: (isAssetGreater
        ? postableLiabilityAccounts
        : postableAssetAccounts
      ).map((item) => ({
        label: `${item.accountCode} - ${item.accountName}`,
        value: item.key,
      })),
      creditOptions: defaultCreditAccount
        ? [
            {
              label: `${defaultCreditAccount.accountCode} - ${defaultCreditAccount.accountName}`,
              value: defaultCreditAccount.key,
            },
          ]
        : [],
    };
  }, [coaRows, currency, postToSuspenseStatement]);

  const columns = useMemo<ColumnDef<EodStatementRow>[]>(() => {
    const opts = {
      t: (key: string) => t(key),
      onOpenDetail: openDetail,
      onPostToSuspense: openPostToSuspense,
    };
    return isFirstBook ? buildFirstBookEodColumns(opts) : buildEodColumns(opts);
  }, [t, isFirstBook, openDetail, openPostToSuspense]);

  return {
    filteredEodRows,
    columns,
    isFirstBook,
    balancesLoading: balancesQuery.isLoading,
    selectedStatement,
    selectedDetail,
    detailLoading: detailQuery.isLoading,
    drawerOpen:
      !!selectedStatement && selectedStatement.actionType === 'details',
    reviewOpen:
      !!selectedStatement && selectedStatement.actionType === 'review-confirm',
    postToSuspenseStatement,
    postToSuspenseOpen: !!postToSuspenseStatement,
    postToSuspenseConfig,
    openDetail,
    closeDetail,
    openPostToSuspense,
    closePostToSuspense,
    onApplyFilters,
  };
}
