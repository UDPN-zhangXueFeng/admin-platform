/**
 * SPRecordsTable — 铸销记录 Tab 分支 3：SP 直铸记录表（源 customTableSp）。
 *
 * 源: tab-records.tsx 303-480（非质押且非 MMF 的兜底分支）。由
 * OverviewRecordsTab 渲染。共享常量/工具见 records-table-helpers.ts。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { usePermission } from '@myorg/shared/util-auth';
import { formatAdminTimestamp } from '../../format-admin-time';
import { createRowActionsColumn } from '../../row-actions';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  ORDER_TYPE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useSPRecordQuery,
  type SPRecordItem,
} from '@myorg/modules/td-admin/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '..';
import {
  APPROVAL_VIEW_ROUTE,
  buildTxBrowserHref,
  formatAmount,
} from './records-table-helpers';
import type { OverviewRecordsTabProps } from './tab-records';

// ═══════════════════════════════════════════════════════════════════
// 分支 3：SP 直铸记录（customTableSp）
// ═══════════════════════════════════════════════════════════════════

/**
 * SP 直铸记录表（源 customTableSp）。
 *
 * endpoint: POST /api/manage/v1/transaction/getDirectMintingTxList
 * initialValues: stablecoinId（源 getUsablePrice.stablecoinId）。
 * rowKey: orderNumber。
 */
export function SPRecordsTable({ td }: OverviewRecordsTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();
  // 源 limit：VIEW_RECORD 包裹 Details 链接（PermissionGuard 隐藏语义 → 无权限整列空）。
  const hasViewRecordPerm = usePermission(TD_PERMISSIONS.VIEW_RECORD);

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [detailRecord, setDetailRecord] = React.useState<SPRecordItem | null>(
    null
  );

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinId: td?.stablecoinId ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.stablecoinId],
  );

  const query = useSPRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  const handleView = React.useCallback(
    (row: SPRecordItem) => {
      // 有审批任务时进入审批详情；SP 直铸记录通常没有 taskId
      // （无需审批的直接铸币），此时展示当前行完整记录，避免按钮无响应。
      if (row.taskId != null && row.businessCode) {
        router.push(
          `${APPROVAL_VIEW_ROUTE}?id=${row.taskId}&busCode=${encodeURIComponent(
            row.businessCode
          )}`
        );
        return;
      }
      setDetailRecord(row);
    },
    [router]
  );

  const columns = React.useMemo<ColumnDef<SPRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0160：spName（源 ellipsis）
        accessorKey: 'spName',
        header: t('tokenized_deposit_0160'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.spName} ellipsis />
        ),
      },
      {
        // tokenized_deposit_0161：walletAddress（源 ellipsis）
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0161'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.walletAddress}
            ellipsis
          />
        ),
      },
      {
        // transaction_flow_004：order_type_{txType}
        accessorKey: 'txType',
        header: t('transaction_flow_004'),
        cell: ({ getValue }) => {
          const txType = getValue<number>();
          if (txType == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${ORDER_TYPE_KEY_PREFIX}${txType}`)}</span>;
        },
      },
      {
        // transaction_flow_005：reSet(txAmount) + ' ' + symbol
        accessorKey: 'txAmount',
        header: t('transaction_flow_005'),
        cell: ({ row }) => (
          <span>
            {formatAmount(row.original.txAmount)} {row.original.symbol ?? ''}
          </span>
        ),
      },
      {
        // PUB_CreateTime（源 createTime 出现两次，第二次实际是占位；保留单列）
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_003：txTime
        accessorKey: 'txTime',
        header: t('transaction_flow_003'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_007：txHash → Copy + browser href（源 ellipsis）
        accessorKey: 'txHash',
        header: t('transaction_flow_007'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.txHash}
            href={buildTxBrowserHref(row.original.browserUrl, row.original.txHash)}
            ellipsis
          />
        ),
      },
      {
        // PUB_Status：Badge
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="task"
            status={getValue<number>()}
          />
        ),
      },
      {
        // Serial No.：orderNumber（源无 render）。源为硬编码英文未走 i18n，这里保持纯文本避免 MISSING_MESSAGE
        accessorKey: 'orderNumber',
        header: 'Serial No.',
        cell: ({ row }) => (
          <span>{row.original.orderNumber || EMPTY_DISPLAY}</span>
        ),
      },
      // PUB_Action：统一行操作列。有 taskId → 审批详情；
      // 无 taskId 的 SP 直铸记录 → 打开只读记录详情。
      createRowActionsColumn<SPRecordItem>(
        hasViewRecordPerm
          ? {
              detail: {
                label: t('PUB_Detail'),
                onClick: handleView,
              },
            }
          : {}
      ),
    ],
    [t, handleView, hasViewRecordPerm],
  );

  const amountLabel =
    detailRecord?.txAmount != null
      ? `${formatAmount(detailRecord.txAmount)} ${detailRecord.symbol ?? ''}`.trim()
      : EMPTY_DISPLAY;

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
        pagination={{
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total,
          onPageChange: (p) =>
            setPagination((prev) => ({ ...prev, pageNum: p })),
          onPageSizeChange: (size) =>
            setPagination((prev) => ({
              ...prev,
              pageNum: 1,
              pageSize: size,
            })),
        }}
      />

      <Dialog
        open={detailRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRecord(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('PUB_Detail')}</DialogTitle>
            <DialogDescription>
              {detailRecord?.orderNumber || EMPTY_DISPLAY}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <RecordDetailField label={t('tokenized_deposit_0160')}>
              {detailRecord?.spName || EMPTY_DISPLAY}
            </RecordDetailField>
            <RecordDetailField label={t('tokenized_deposit_0161')}>
              {detailRecord?.walletAddress ? (
                <TokenizedDepositCopy
                  text={detailRecord.walletAddress}
                  ellipsis
                />
              ) : (
                EMPTY_DISPLAY
              )}
            </RecordDetailField>
            <RecordDetailField label={t('transaction_flow_004')}>
              {detailRecord?.txType != null
                ? t(`${ORDER_TYPE_KEY_PREFIX}${detailRecord.txType}`)
                : EMPTY_DISPLAY}
            </RecordDetailField>
            <RecordDetailField label={t('transaction_flow_005')}>
              {amountLabel}
            </RecordDetailField>
            <RecordDetailField label={t('PUB_CreateTime')}>
              {detailRecord?.createTime
                ? formatAdminTimestamp(detailRecord.createTime)
                : EMPTY_DISPLAY}
            </RecordDetailField>
            <RecordDetailField label={t('transaction_flow_003')}>
              {detailRecord?.txTime
                ? formatAdminTimestamp(detailRecord.txTime)
                : EMPTY_DISPLAY}
            </RecordDetailField>
            <RecordDetailField label={t('transaction_flow_007')}>
              {detailRecord?.txHash ? (
                <TokenizedDepositCopy
                  text={detailRecord.txHash}
                  href={buildTxBrowserHref(
                    detailRecord.browserUrl,
                    detailRecord.txHash
                  )}
                  ellipsis
                />
              ) : (
                EMPTY_DISPLAY
              )}
            </RecordDetailField>
            <RecordDetailField label={t('PUB_Status')}>
              {detailRecord?.status != null ? (
                <TokenizedDepositStatusBadge
                  dimension="task"
                  status={detailRecord.status}
                />
              ) : (
                EMPTY_DISPLAY
              )}
            </RecordDetailField>
            <RecordDetailField label="Serial No.">
              {detailRecord?.orderNumber || EMPTY_DISPLAY}
            </RecordDetailField>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordDetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{children}</dd>
    </div>
  );
}
