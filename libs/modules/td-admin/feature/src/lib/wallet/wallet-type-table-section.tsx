'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Button,
  Card,
  DataTable,
} from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import { formatAdminDate, formatAdminTimestamp } from '../format-admin-time';
import { createRowActionsColumn } from '../row-actions';
import { ApprovalStatusBadge } from '../approval-manage';
import {
  getCommonResource,
  openCommonResource,
  useWalletTypeTableQuery,
  type StablecoinSearchOption,
  type WalletTypeTableRow,
  type WalletListParams,
} from '@myorg/modules/td-admin/data-access';
import {
  accountTypeMessageKey,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatLimitAmount,
  toMillis,
  WALLET_TYPE_ACTION_PERMISSIONS,
} from '.';

export interface WalletTypeTableSectionProps {
  /** 当前 stablecoin（提供 issueType / stablecoinId 等上下文）。 */
  stablecoin?: StablecoinSearchOption;
}

/**
 * WalletTypeTableSection — 钱包类型两张表（常规 / MMF，按 issueType 切换列集）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx` 第 100-419 行的两张
 * CustomTable（均打 `/wallet/type/list` 同一 endpoint，列按 issueType===20 分流）。
 *
 * 忠实源逻辑：
 * - 服务端分页（pageNum/pageSize，列表 hook 已配 keepPreviousData）。
 * - 列按 issueType 分流：
 *   - 常规（issueType !== 20）：name / accountType / 单笔 / 日 / 稳定币 / 最低余额 /
 *     最大赎回 / 创建人 / 创建时间 / 状态。
 *   - MMF（issueType === 20）：name / walletTypeCode / 基金类型 / 风险 / 净值 /
 *     成立日 / 创建人 / 创建时间 / 状态。
 * - 状态列 ApprovalStatusBadge（task 族：common_task_status_1/3/5/10/15/20/25）。
 * - 表头 Add 按钮（跳新增路径，按 issueType 分流 mff/常规）。
 * - MMF 表头额外 API 文档按钮（resources/search + sftp/download）。
 * - 行操作 View：跳 `/approval-manage/view?id=taskId&busCode=businessCode`（源 actionClick
 *   View 忠实保留——表行是审批记录维度，非钱包类型详情）。
 * - stablecoin 未选 / state===2 时：表头写操作禁用；stablecoinId 缺失则 hook 不请求。
 */
export function WalletTypeTableSection({
  stablecoin,
}: WalletTypeTableSectionProps): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const { permissions } = useAuth();
  const canAdd = permissions.has(WALLET_TYPE_ACTION_PERMISSIONS.add);
  const canViewDetail = permissions.has(WALLET_TYPE_ACTION_PERMISSIONS.viewRecord);

  const isMmf = stablecoin?.issueType === 20;
  const stablecoinDisabled = stablecoin?.state === 2;
  const stablecoinId = stablecoin?.stablecoinId;

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [apiDocLoading, setApiDocLoading] = React.useState(false);

  const handleOpenApiDoc = React.useCallback(async () => {
    setApiDocLoading(true);
    try {
      const resource = await getCommonResource(WALLET_TYPE_ACTION_PERMISSIONS.add);
      if (resource?.busId === undefined || resource.busType === undefined) {
        throw new Error('API document resource is not configured');
      }
      await openCommonResource(resource.busId, resource.busType);
    } catch {
      toast.error(t('walletType.apiDocFailed'));
    } finally {
      setApiDocLoading(false);
    }
  }, [t]);

  const params = React.useMemo<
    WalletListParams<Record<string, unknown>>
  >(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: { stablecoinId },
    }),
    [pagination.pageNum, pagination.pageSize, stablecoinId]
  );

  const listResult = useWalletTypeTableQuery(stablecoinId, params, Boolean(stablecoinId));
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const buildAddPath = React.useCallback((): string => {
    if (!stablecoin) return '';
    const base = isMmf
      ? '/wallet/wallet-type/mff/mff-add'
      : '/wallet/wallet-type/edit';
    const params = new URLSearchParams({
      type: 'add',
      stablecoinId: String(stablecoin.stablecoinId),
      name: `${stablecoin.name ?? ''} (${stablecoin.blockchainNameAbbreviation ?? ''})`,
      symbol: isMmf
        ? stablecoin.currencySymbol ?? ''
        : stablecoin.symbol ?? '',
      issueType: String(stablecoin.issueType ?? ''),
    });
    return `${base}?${params.toString()}`;
  }, [stablecoin, isMmf]);

  const columns = React.useMemo<ColumnDef<WalletTypeTableRow>[]>(() => {
    const common: ColumnDef<WalletTypeTableRow>[] = [
      {
        id: 'name',
        header: t('walletType.column.name'),
        cell: ({ row }) => (
          <span>{row.original.name || EMPTY_DISPLAY}</span>
        ),
      },
    ];

    if (isMmf) {
      return [
        ...common,
        {
          id: 'walletTypeCode',
          header: t('walletType.column.walletTypeCode'),
          cell: ({ row }) => (
            <span>
              {(row.original as WalletTypeTableRow & { walletTypeCode?: string }).walletTypeCode ||
                EMPTY_DISPLAY}
            </span>
          ),
        },
        {
          id: 'fundType',
          header: t('walletType.column.fundType'),
          cell: ({ row }) => {
            const fundType = row.original.fundType;
            return (
              <span>
                {fundType
                  ? t(`walletType.mmfFundType.${fundType}` as never)
                  : EMPTY_DISPLAY}
              </span>
            );
          },
        },
        {
          id: 'riskLevel',
          header: t('walletType.column.riskLevel'),
          cell: ({ row }) => {
            const riskLevel = row.original.riskLevel;
            return (
              <span>
                {riskLevel
                  ? t(`walletType.mmfRiskLevel.${riskLevel}` as never)
                  : EMPTY_DISPLAY}
              </span>
            );
          },
        },
        {
          id: 'fundAssetValue',
          header: t('walletType.column.fundAssetValue'),
          cell: ({ row }) => {
            const value = row.original.fundAssetValue;
            if (value === undefined || value === null || value === '') {
              return <span>{EMPTY_DISPLAY}</span>;
            }
            const symbol = row.original.currencySymbol ?? '';
            return <span>{`${value} ${symbol}`.trim()}</span>;
          },
        },
        {
          id: 'fundInceptionTime',
          header: t('walletType.column.fundInceptionTime'),
          cell: ({ row }) => (
            <span>
              {formatAdminDate(
                toMillis(Number(row.original.fundInceptionTime))
              )}
            </span>
          ),
        },
        {
          id: 'createUser',
          header: t('walletType.column.creator'),
          cell: ({ row }) => (
            <span>{row.original.createUser || EMPTY_DISPLAY}</span>
          ),
        },
        {
          id: 'createTime',
          header: t('common.createTime'),
          cell: ({ row }) => (
            <span>
              {formatAdminTimestamp(toMillis(Number(row.original.createTime)))}
            </span>
          ),
        },
        {
          id: 'state',
          header: t('common.status'),
          cell: ({ row }) => (
            <ApprovalStatusBadge
              family="task"
              status={row.original.state}
            />
          ),
        },
        canViewDetail
          ? createRowActionsColumn<WalletTypeTableRow>({
              detail: {
                label: t('common.detail'),
                onClick: (row) =>
                  router.push(
                    `/approval-manage/view?id=${encodeURIComponent(
                      row.taskId ?? ''
                    )}&busCode=${encodeURIComponent(row.businessCode ?? '')}`
                  ),
              },
            })
          : {
              id: 'actions',
              header: 'Actions',
              cell: () => (
                <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
              ),
            },
      ];
    }

    return [
      ...common,
      {
        id: 'accountType',
        header: t('walletType.column.accountType'),
        cell: ({ row }) => {
          const accountType = row.original.accountType;
          if (accountType === 0) {
            return <span>{t('accountType.0')}</span>;
          }
          const key = accountTypeMessageKey(accountType);
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'maxTxCountPer',
        header: t('walletType.column.maxTxCountPer'),
        cell: ({ row }) => (
          <span>{formatLimitAmount(Number(row.original.maxTxCountPer))}</span>
        ),
      },
      {
        id: 'maxTxCountDaily',
        header: t('walletType.column.maxTxCountDaily'),
        cell: ({ row }) => (
          <span>{formatLimitAmount(Number(row.original.maxTxCountDaily))}</span>
        ),
      },
      {
        id: 'stablecoinCount',
        header: t('walletType.column.stablecoinCount'),
        cell: ({ row }) => (
          <span>{formatLimitAmount(Number(row.original.stablecoinCount))}</span>
        ),
      },
      {
        id: 'minimumBalance',
        header: t('walletType.column.minimumBalance'),
        cell: ({ row }) => (
          <span>{formatLimitAmount(Number(row.original.minimumBalance))}</span>
        ),
      },
      {
        id: 'maximumRedeemLimit',
        header: t('walletType.column.maximumRedeemLimit'),
        cell: ({ row }) => (
          <span>
            {formatLimitAmount(
              Number(
                (row.original as WalletTypeTableRow & {
                  maximumRedeemLimit?: number;
                }).maximumRedeemLimit
              )
            )}
          </span>
        ),
      },
      {
        id: 'createUser',
        header: t('walletType.column.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createTime',
        header: t('common.createTime'),
        cell: ({ row }) => (
          <span>
            {formatAdminTimestamp(toMillis(Number(row.original.createTime)))}
          </span>
        ),
      },
      {
        id: 'state',
        header: t('common.status'),
        cell: ({ row }) => (
          <ApprovalStatusBadge
            family="task"
            status={row.original.state}
          />
        ),
      },
      canViewDetail
        ? createRowActionsColumn<WalletTypeTableRow>({
            detail: {
              label: t('common.detail'),
              onClick: (row) =>
                router.push(
                  `/approval-manage/view?id=${encodeURIComponent(
                    row.taskId ?? ''
                  )}&busCode=${encodeURIComponent(row.businessCode ?? '')}`
                ),
            },
          })
        : {
            id: 'actions',
            header: 'Actions',
            cell: () => (
              <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
            ),
          },
    ];
  }, [t, isMmf, canViewDetail, router]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="text-sm font-semibold">
          {isMmf ? t('walletType.mmfRecords') : t('walletType.records')}
        </div>
        {stablecoin && !stablecoinDisabled && canAdd ? (
          <div className="flex gap-2">
            {isMmf ? (
              <Button
                variant="outline"
                size="sm"
                disabled={apiDocLoading}
                onClick={() => {
                  void handleOpenApiDoc();
                }}
              >
                {t('walletType.action.apiDoc')}
              </Button>
            ) : null}
              <Button size="sm" onClick={() => router.push(buildAddPath())}>
                {t('walletType.action.add')}
              </Button>
          </div>
        ) : null}
      </div>
      <div className="p-4">
        {!stablecoinId ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('walletType.invalidStablecoin')}
          </div>
        ) : listResult.isError ? (
          <p role="alert" className="text-sm text-destructive">{t('walletType.loadFailed')}</p>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('common.noData')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
              onPageSizeChange: (size) =>
                setPagination({ pageNum: 1, pageSize: size }),
            }}
          />
        )}
      </div>
    </Card>
  );
}
