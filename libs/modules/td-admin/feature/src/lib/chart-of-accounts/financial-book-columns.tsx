import type { ColumnDef } from '@tanstack/react-table';
import { CopyableEllipsisText } from '@myorg/shared/ui';
import { CHART_OF_ACCOUNTS_PERMISSIONS, type ChartOfAccountsItem } from '@myorg/modules/td-admin/data-access';
import { createRowActionsColumn, type RowAction } from '../row-actions';
import { ChartOfAccountsStatusTag } from './coa-status-tag';
import { formatEodCutoffTime, formatLastEodPostingRun } from './book-time';

export type DetailTab = 'basic-information' | 'chart-of-accounts' | 'eod-balances';
const EMPTY_DISPLAY = '--';

/** 无任何可见操作时旧 cell 的占位列（保留 EMPTY_DISPLAY 行为）。 */
const EMPTY_ACTIONS_COLUMN: ColumnDef<ChartOfAccountsItem> = {
  id: 'actions',
  header: 'Actions',
  enableSorting: false,
  meta: { overflow: 'none', stickyRight: true },
  cell: () => (
    <div className="flex justify-center text-muted-foreground">
      {EMPTY_DISPLAY}
    </div>
  ),
};

export function buildFinancialBookColumns({
  t, statusCodes, tokenTypeLabelMap, hasPermission, goToDetail, canSeeActions,
}: {
  t: (key: string) => string;
  statusCodes: { active: number; inactive: number };
  tokenTypeLabelMap: ReadonlyMap<number, string>;
  hasPermission: (uuid: string) => boolean;
  goToDetail: (book: ChartOfAccountsItem, tab: DetailTab) => void;
  canSeeActions: boolean;
}): ColumnDef<ChartOfAccountsItem>[] {
  return [
      {
        accessorKey: 'bookName',
        header: t('field.bookName'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookName} maxWidth={220} />
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('field.bookId'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.bookNo} maxWidth={130} />
        ),
      },
      {
        accessorKey: 'reserveAssetName',
        header: t('field.reserveAssetName'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.reserveAssetName}
            maxWidth={190}
          />
        ),
      },
      {
        accessorKey: 'currencyCode',
        header: t('field.currency'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.currencyCode}
            copyable={false}
            maxWidth={70}
          />
        ),
      },
      {
        accessorKey: 'eodCutoffTime',
        header: t('field.eodCutoffTime'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={formatEodCutoffTime(
              row.original.eodCutoffTime,
              row.original.timeZone
            )}
            copyable={false}
            maxWidth={140}
          />
        ),
      },
      {
        accessorKey: 'lastEodPostingRun',
        header: t('field.lastEodPostingRun'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={formatLastEodPostingRun(row.original.lastEodPostingRun)}
            copyable={false}
            maxWidth={240}
          />
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('field.tokenType'),
        cell: ({ row }) => {
          const { tokenType } = row.original;
          if (tokenType === undefined || tokenType === null) {
            return <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>;
          }
          return (
            <span>
              {tokenTypeLabelMap.get(tokenType) ?? String(tokenType)}
            </span>
          );
        },
      },
      {
        accessorKey: 'tokens',
        header: t('field.tokens'),
        cell: ({ row }) => {
          const tokenNames = (row.original.tokens ?? [])
            .map((item) => item.tokenName)
            .filter((item): item is string => Boolean(item));

          return (
            <CopyableEllipsisText
              value={tokenNames.length ? tokenNames.join(', ') : undefined}
              maxWidth={300}
            />
          );
        },
      },
      {
        id: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const { status, statusName } = row.original;
          const isActive =
            Number(status) === statusCodes.active ||
            (statusName ?? '').trim().toLowerCase() === 'active';
          const isInactive =
            (status != null && Number(status) === statusCodes.inactive) ||
            (statusName ?? '').trim().toLowerCase() === 'inactive';

          const tone = isActive
            ? 'active'
            : isInactive
              ? 'inactive'
              : 'default';

          const label = isActive
            ? t('status.active')
            : isInactive
              ? t('status.inactive')
              : statusName ||
                (status === undefined || status === null
                  ? EMPTY_DISPLAY
                  : String(status));

          return <ChartOfAccountsStatusTag tone={tone} label={label} />;
        },
      },
      canSeeActions
        ? createRowActionsColumn<ChartOfAccountsItem>({
            header: t('field.actions'),
            detail: (row) =>
              hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Detail)
                ? {
                    label: t('action.detail'),
                    onClick: () => goToDetail(row, 'basic-information'),
                  }
                : undefined,
            menu: (row) => {
              const items: RowAction<ChartOfAccountsItem>[] = [];
              if (hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.Edit)) {
                items.push({
                  label: t('action.edit'),
                  onClick: () => goToDetail(row, 'chart-of-accounts'),
                });
              }
              if (hasPermission(CHART_OF_ACCOUNTS_PERMISSIONS.ViewStatements)) {
                items.push({
                  label: t('action.viewStatements'),
                  onClick: () => goToDetail(row, 'eod-balances'),
                });
              }
              return items;
            },
          })
        : { ...EMPTY_ACTIONS_COLUMN, header: t('field.actions') },
  ];
}
