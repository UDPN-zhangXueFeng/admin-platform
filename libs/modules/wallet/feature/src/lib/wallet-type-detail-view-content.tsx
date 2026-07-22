'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CopyableEllipsisText } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import type {
  InterestRateTier,
  WalletTypeDetail,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  accountTypeMessageKey,
  EMPTY_DISPLAY,
  UNLIMITED_THRESHOLD,
  toMillis,
} from '@myorg/modules/wallet/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_UTC_FMT = 'YYYY-MM-DD HH:mm:ss [UTC]';

/** 时间戳格式化（秒/毫秒自适应），无值返回占位。 */
function formatTs(
  ts?: number | string | null,
  fmt = DATETIME_FMT
): string {
  const ms = toMillis(typeof ts === 'string' ? Number(ts) : ts);
  return ms ? formatDate(ms, fmt) : EMPTY_DISPLAY;
}

/**
 * 金额归一展示：≥ 阈值返回 ∞；否则千分位 + 2 位小数。
 * 迁移自源 view.tsx `reSet(value)` 与 `Number(x) >= 99999999999 ? '∞' : reSet(x)`。
 */
function reSet(value?: number | string | null): string {
  if (value === undefined || value === null || value === '') return EMPTY_DISPLAY;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY_DISPLAY;
  if (n >= UNLIMITED_THRESHOLD) return '∞';
  return n
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

/** 限额字段 + symbol 组装（迁移自源 basicItemsTier/accountItems）。 */
function amountWithSymbol(
  value: number | string | undefined,
  symbol?: string
): string {
  if (value === undefined || value === null || value === '') return EMPTY_DISPLAY;
  const base = Number(value) >= UNLIMITED_THRESHOLD ? '∞' : reSet(value);
  return symbol ? `${base} ${symbol}` : base;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/** Descriptions 卡片区段（标题 + kv 表格）。 */
function DescriptionsSection({
  title,
  rows,
}: {
  title: string;
  rows: KvRow[];
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <tbody>
            {!rows.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground">
                  {EMPTY_DISPLAY}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                    {row.label}
                  </td>
                  <td className="break-all border px-4 py-3">{row.value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface WalletTypeDetailViewContentProps {
  detail?: WalletTypeDetail;
}

/**
 * WalletTypeDetailViewContent — 常规钱包类型详情（Descriptions 多块）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/view.tsx`（511 行）。
 * 信息块按 issueType/accountType/interestFeatureEnablement 条件渲染：
 *  1. 基本信息（basicItems）— 必显；
 *  2. 限额信息（basicItemsTier）— 必显；
 *  3. accountType!=Default 且 issueType=5 时：账户费用（accountItems）+
 *     按 accountType+interestFeatureEnablement 分支的利息/透支信息块。
 *
 * 由 WalletTypeDetailPage 在 slug[1]=`view`（非 mff）时渲染。
 */
export function WalletTypeDetailViewContent({
  detail,
}: WalletTypeDetailViewContentProps) {
  const t = useTranslations('modules.wallet');

  // 源 query.issueType 默认 TD（5）；目标 detail 未携带 issueType 字段，沿用默认。
  const issueType = 5;
  const isDefaultName = detail?.name === 'Default';
  const accountType = detail?.accountType;
  const interestEnabled = detail?.interestFeatureEnablement === 2;
  const isTdCurrentAccount = issueType === 5 && accountType === 1;

  const tdSymbol = detail?.tdSymbol;

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const accountTypeKey = accountTypeMessageKey(detail.accountType);
    return [
      {
        key: 'name',
        label: t('walletType.detail.walletTypeName'),
        value: detail.name || EMPTY_DISPLAY,
      },
      {
        key: 'accountType',
        label: t('walletType.column.accountType'),
        value: accountTypeKey ? t(accountTypeKey as never) : EMPTY_DISPLAY,
      },
      {
        key: 'tokenName',
        label: t('walletType.detail.tokenName'),
        value: detail.tokenName || EMPTY_DISPLAY,
      },
      {
        key: 'blockchainName',
        label: t('walletType.detail.blockchain'),
        value: detail.blockchainName || EMPTY_DISPLAY,
      },
      {
        key: 'createUser',
        label: t('walletType.detail.updatedBy'),
        value: detail.createUser || EMPTY_DISPLAY,
      },
      {
        key: 'createTime',
        label: t('walletType.detail.updatedOn'),
        value: formatTs(detail.createTime),
      },
      {
        key: 'status',
        label: t('common.status'),
        value: (
          <WalletStatusBadge family="wallet-type" status={detail.status ?? detail.state} />
        ),
      },
    ];
  }, [detail, t]);

  const limitRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'singleTradingLimit',
        label: t('walletType.detail.singleTradingLimit'),
        value: amountWithSymbol(detail.singleTradingLimit, tdSymbol),
      },
      {
        key: 'dailyTradingLimit',
        label: t('walletType.detail.dailyTradingLimit'),
        value: amountWithSymbol(detail.dailyTradingLimit, tdSymbol),
      },
      {
        key: 'balanceLimit',
        label: t('walletType.detail.balanceLimit'),
        value: amountWithSymbol(detail.balanceLimit, tdSymbol),
      },
      {
        key: 'minimumBalance',
        label: t('walletType.field.minimumBalance'),
        value: amountWithSymbol(detail.minimumBalance, tdSymbol),
      },
      {
        key: 'dailyRedeemLimit',
        label: t('walletType.detail.dailyRedeemLimit'),
        value: amountWithSymbol(detail.dailyRedeemLimit, tdSymbol),
      },
    ];
  }, [detail, tdSymbol, t]);

  const accountFeeRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const cycleKey = detail.feeCycle
      ? `walletType.maintenanceFeeCycle.${detail.feeCycle}`
      : undefined;
    return [
      {
        key: 'maintenanceFee',
        label: t('walletType.detail.maintenanceFee'),
        value: detail.maintenanceFee
          ? `${reSet(detail.maintenanceFee)} ${tdSymbol ?? ''} ${t('walletType.detail.per')} ${
              cycleKey ? t(cycleKey as never) : ''
            }`.replace(/\s+/g, ' ').trim()
          : EMPTY_DISPLAY,
      },
      {
        key: 'minimumBalanceFee',
        label: t('walletType.detail.minimumBalanceFee'),
        value: detail.minimumBalanceFee
          ? `${reSet(detail.minimumBalanceFee)} ${tdSymbol ?? ''}`.trim()
          : EMPTY_DISPLAY,
      },
      {
        key: 'accountFeesWalletAddress',
        label:
          t('walletType.detail.walletAddress') +
          t('walletType.detail.forAccountFees'),
        value: detail.accountFeesWalletAddress ? (
          <CopyableEllipsisText
            value={detail.accountFeesWalletAddress}
            copyLabel={t('walletType.copy')}
          />
        ) : (
          EMPTY_DISPLAY
        ),
      },
    ];
  }, [detail, tdSymbol, t]);

  const arrangedAnnualRates = (detail?.arrangedAnnualInterestRates ??
    []) as unknown as InterestRateTier[];
  // 兼容源字段 arrangedInterestRate；interestRate 取首档或单一值。
  const arrangedFirstRate =
    arrangedAnnualRates[0]?.interestRate ?? detail?.arrangedInterestRate ?? '';

  const arrangedOverdraftRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'arrangedOverdraftAmount',
        label: t('walletType.detail.arrangedOverdraftAmount'),
        value: `${reSet(detail.arrangedOverdraftAmount)} ${tdSymbol ?? ''}`.trim(),
      },
      {
        key: 'overdraftBufferAmount',
        label: t('walletType.detail.overdraftBufferAmount'),
        value: `${reSet(detail.overdraftBufferAmount)} ${tdSymbol ?? ''}`.trim(),
      },
      {
        key: 'overdraftBufferPeriod',
        label: t('walletType.detail.overdraftBufferPeriod'),
        value: detail.overdraftBufferPeriod
          ? `${detail.overdraftBufferPeriod} ${t('walletType.detail.days')}`
          : EMPTY_DISPLAY,
      },
      {
        key: 'arrangedInterestPolicyName',
        label: t('walletType.detail.interestPolicyName'),
        value: detail.arrangedInterestPolicyName || EMPTY_DISPLAY,
      },
      {
        key: 'arrangedAnnualInterestRate',
        label: t('walletType.detail.annualInterestRate'),
        value: arrangedFirstRate !== '' ? `${arrangedFirstRate}%` : EMPTY_DISPLAY,
      },
      {
        key: 'arrangedEffectiveDate',
        label: t('walletType.detail.effectiveDate'),
        value: formatTs(detail.arrangedInterestEffectiveDate, DATE_UTC_FMT),
      },
    ];
  }, [detail, tdSymbol, arrangedFirstRate, t]);

  const unarrangedAnnualRates = (detail?.unarrangedAnnualInterestRates ??
    []) as unknown as InterestRateTier[];
  const unarrangedFirstRate =
    unarrangedAnnualRates[0]?.interestRate ?? detail?.unarrangedInterestRate ?? '';

  const unarrangedOverdraftRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'unarrangedOverdraftAmount',
        label: t('walletType.detail.unarrangedOverdraftAmount'),
        value: `${reSet(detail.unarrangedOverdraftAmount)} ${tdSymbol ?? ''}`.trim(),
      },
      {
        key: 'unarrangedOverdraftFee',
        label: t('walletType.detail.unarrangedOverdraftFee'),
        value: `${reSet(detail.unarrangedOverdraftFee)} ${tdSymbol ?? ''} ${t(
          'walletType.detail.per'
        )} ${t('walletType.detail.day')}`.replace(/\s+/g, ' ').trim(),
      },
      {
        key: 'unarrangedOverdraftFeeMax',
        label: t('walletType.detail.unarrangedOverdraftFeeMax'),
        value: `${reSet(detail.unarrangedOverdraftFeeMax)} ${tdSymbol ?? ''} ${t(
          'walletType.detail.per'
        )} ${t('walletType.detail.month')}`.replace(/\s+/g, ' ').trim(),
      },
      {
        key: 'unarrangedInterestPolicyName',
        label: t('walletType.detail.interestPolicyName'),
        value: detail.unarrangedInterestPolicyName || EMPTY_DISPLAY,
      },
      {
        key: 'unarrangedAnnualInterestRate',
        label: t('walletType.detail.annualInterestRate'),
        value: unarrangedFirstRate !== ''
          ? `${unarrangedFirstRate}%`
          : EMPTY_DISPLAY,
      },
      {
        key: 'unarrangedEffectiveDate',
        label: t('walletType.detail.effectiveDate'),
        value: formatTs(detail.unarrangedInterestEffectiveDate, DATE_UTC_FMT),
      },
    ];
  }, [detail, tdSymbol, unarrangedFirstRate, t]);

  // interestPolicyInformation：arrangedCalculateType 决定单一利率 vs 阶梯利率。
  const isTiered = detail?.arrangedCalculateType !== 1;
  const hasTierRange = String(arrangedFirstRate).indexOf('-') > -1;

  const interestPolicyRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const rows: KvRow[] = [
      {
        key: 'interestPolicyName',
        label: t('walletType.detail.interestPolicyName'),
        value: detail.arrangedInterestPolicyName || EMPTY_DISPLAY,
      },
      {
        key: 'annualInterestRate',
        label: t('walletType.detail.annualInterestRate'),
        value: isTiered ? (
          <div className="flex flex-col">
            {arrangedAnnualRates.length ? (
              arrangedAnnualRates.map((el, idx) => (
                <span key={idx}>
                  {reSet(el.minValue)} - {reSet(el.maxValue)}
                  {t('walletType.detail.inclusive')}
                  {el.interestRate}%
                </span>
              ))
            ) : (
              <span>{EMPTY_DISPLAY}</span>
            )}
          </div>
        ) : (
          <span>{arrangedFirstRate !== '' ? `${arrangedFirstRate}%` : EMPTY_DISPLAY}</span>
        ),
      },
      {
        key: 'effectiveDate',
        label: t('walletType.detail.effectiveDate'),
        value: formatTs(detail.arrangedInterestEffectiveDate, DATE_UTC_FMT),
      },
      {
        key: 'interestAccrualApplicationTime',
        label: t('walletType.detail.interestAccrualApplicationTime'),
        value: formatTs(detail.arrangedInterestAccrualApplicationTime),
      },
      {
        key: 'depositInterestWalletAddress',
        label:
          t('walletType.detail.walletAddress') +
          (hasTierRange
            ? t('walletType.detail.forReceivingDepositInterest')
            : t('walletType.detail.forDepositInterestPayments')),
        value: detail.depositInterestWalletAddress ? (
          <CopyableEllipsisText
            value={detail.depositInterestWalletAddress}
            copyLabel={t('walletType.copy')}
          />
        ) : (
          EMPTY_DISPLAY
        ),
      },
    ];
    // 源：interestRate 含 '-'（阶梯）时不展示 accountClosureInterestWalletAddress。
    if (!hasTierRange && detail.accountClosureInterestWalletAddress) {
      rows.push({
        key: 'accountClosureInterestWalletAddress',
        label:
          t('walletType.detail.walletAddress') +
          t('walletType.detail.forAccountClosureInterest'),
        value: (
          <CopyableEllipsisText
            value={detail.accountClosureInterestWalletAddress}
            copyLabel={t('walletType.copy')}
          />
        ),
      });
    }
    return rows;
  }, [detail, arrangedAnnualRates, arrangedFirstRate, isTiered, hasTierRange, t]);

  const walletRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'receivingOverdraftFeeWalletAddress',
        label:
          t('walletType.detail.walletAddress') +
          t('walletType.detail.forReceivingOverdraftFee'),
        value: detail.receivingOverdraftFeeWalletAddress ? (
          <CopyableEllipsisText
            value={detail.receivingOverdraftFeeWalletAddress}
            copyLabel={t('walletType.copy')}
          />
        ) : (
          EMPTY_DISPLAY
        ),
      },
      {
        key: 'receivingOverdraftInterestWalletAddress',
        label:
          t('walletType.detail.walletAddress') +
          t('walletType.detail.forReceivingOverdraftInterest'),
        value: detail.receivingOverdraftInterestWalletAddress ? (
          <CopyableEllipsisText
            value={detail.receivingOverdraftInterestWalletAddress}
            copyLabel={t('walletType.copy')}
          />
        ) : (
          EMPTY_DISPLAY
        ),
      },
    ];
  }, [detail, t]);

  const showInterestSection = issueType === 5 && !isDefaultName;

  return (
    <div className="space-y-4">
      <DescriptionsSection
        title={t('walletType.detail.basicInformation')}
        rows={basicRows}
      />
      <DescriptionsSection
        title={t('walletType.detail.walletTypeInformation')}
        rows={limitRows}
      />

      {showInterestSection ? (
        <>
          <DescriptionsSection
            title={t('walletType.detail.accountFees')}
            rows={accountFeeRows}
          />

          {isTdCurrentAccount ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {t('walletType.detail.tdCurrentAccountAlert')}
            </div>
          ) : accountType === 1 && interestEnabled ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card px-6 py-3 font-bold">
                {t('walletType.detail.interestPolicyInformation')}
              </div>
              <DescriptionsSection
                title={t('walletType.detail.arrangedOverdraftInformation')}
                rows={arrangedOverdraftRows}
              />
              <DescriptionsSection
                title={t('walletType.detail.unarrangedOverdraftInformation')}
                rows={unarrangedOverdraftRows}
              />
              <DescriptionsSection
                title={t('walletType.detail.walletInformation')}
                rows={walletRows}
              />
            </div>
          ) : accountType === 2 && interestEnabled ? (
            <DescriptionsSection
              title={t('walletType.detail.interestPolicyInformation')}
              rows={interestPolicyRows}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
