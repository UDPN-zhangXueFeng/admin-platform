'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@myorg/shared/ui';
import { ChartOfAccountsStatusTag } from '@myorg/modules/chart-of-accounts/ui';
import type { CoaAction, CoaRow } from '@myorg/modules/chart-of-accounts/data-access';

/**
 * COA 树表格列定义（迁移自源 useChartOfAccounts coaColumns）。
 *
 * antd ColumnsType → TanStack ColumnDef。section 行：accountCode 列显示分段标题，
 * 其余列留空；item 行：按 depth 缩进。actions 列渲染行操作按钮（由上层 onAction 分发）。
 */
export interface CoaColumnsOptions {
  t: (key: string) => string;
  onAction: (action: CoaAction, record: CoaRow) => void;
}

/** CoaAction → 本地化文案。 */
function coaActionLabel(action: CoaAction, t: (key: string) => string): string {
  switch (action) {
    case 'new-primary-account':
      return t('coa.actionNewPrimary');
    case 'new-sub-account':
      return t('coa.actionNewSub');
    case 'edit':
      return t('common.edit');
    case 'deactivate':
      return t('common.deactivate');
    case 'activate':
      return t('common.activate');
  }
}

export function buildCoaColumns({ t, onAction }: CoaColumnsOptions): ColumnDef<CoaRow>[] {
  return [
    {
      accessorKey: 'accountCode',
      header: t('coa.accountCode'),
      cell: ({ row }) => {
        const r = row.original;
        if (r.rowType === 'section') {
          return (
            <span className="text-base font-semibold">
              {r.sectionType === 'assets' ? t('coa.assets') : t('coa.liabilities')}
            </span>
          );
        }
        return (
          <div style={{ paddingLeft: `${(r.depth || 0) * 18}px` }}>{r.accountCode}</div>
        );
      },
    },
    {
      accessorKey: 'accountName',
      header: t('coa.accountName'),
      cell: ({ row }) =>
        row.original.rowType === 'section' ? (
          ''
        ) : (
          <div className="whitespace-normal break-words">{row.original.accountName}</div>
        ),
    },
    {
      accessorKey: 'description',
      header: t('coa.description'),
      cell: ({ row }) =>
        row.original.rowType === 'section' ? '' : row.original.description,
    },
    {
      accessorKey: 'balanceSide',
      header: t('coa.balanceSide'),
      cell: ({ row }) =>
        row.original.rowType === 'section' ? '' : row.original.balanceSide,
    },
    {
      accessorKey: 'allowPosting',
      header: t('coa.allowPosting'),
      cell: ({ row }) =>
        row.original.rowType === 'section'
          ? ''
          : row.original.allowPosting
            ? t('common.yes')
            : t('common.no'),
    },
    {
      accessorKey: 'suspenseAccount',
      header: t('coa.suspenseAccount'),
      cell: ({ row }) =>
        row.original.rowType === 'section'
          ? ''
          : row.original.suspenseAccount
            ? t('common.yes')
            : t('common.no'),
    },
    {
      id: 'status',
      header: t('coa.status'),
      cell: ({ row }) => {
        const r = row.original;
        if (r.rowType === 'section' || !r.status) return '';
        const tone =
          r.status === 'active'
            ? 'active'
            : r.status === 'inactive'
              ? 'inactive'
              : 'default';
        const label =
          r.status === 'active'
            ? t('coa.statusActive')
            : r.status === 'inactive'
              ? t('coa.statusInactive')
              : t('coa.statusPending');
        return <ChartOfAccountsStatusTag tone={tone} label={label} />;
      },
    },
    {
      id: 'actions',
      header: t('coa.actions'),
      cell: ({ row }) => {
        const r = row.original;
        const actions = r.actions ?? [];
        if (!actions.length) {
          return <span className="text-muted-foreground">--</span>;
        }
        return (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                variant="link"
                className="h-auto p-0 leading-5"
                onClick={() => onAction(action, r)}
              >
                {coaActionLabel(action, t)}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];
}
