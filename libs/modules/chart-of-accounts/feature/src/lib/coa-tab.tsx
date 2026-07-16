'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import type { CoaRow } from '@myorg/modules/chart-of-accounts/data-access';

/**
 * Chart of Accounts tab 容器（迁移自源 ChartOfAccountsTab.tsx）。
 *
 * 仅负责呈现：描述 / 提示 / DataTable（COA 树行）/ 返回 + 保存草稿按钮。
 * columns、rows、handlers 由上层 useCoaTree hook 提供（保持容器 dumb）。
 * antd Table + Alert → shared/ui DataTable + Tailwind 提示条。
 */
export interface CoaTabProps {
  description: string;
  alertMessage: string;
  rows: CoaRow[];
  columns: ColumnDef<CoaRow>[];
  loading: boolean;
  emptyMessage?: string;
  onBack: () => void;
  backLabel: string;
  onSave?: () => void;
  saveLabel?: string;
  saveLoading?: boolean;
  saveDisabled?: boolean;
}

export function CoaTab({
  description,
  alertMessage,
  rows,
  columns,
  loading,
  emptyMessage,
  onBack,
  backLabel,
  onSave,
  saveLabel,
  saveLoading,
  saveDisabled,
}: CoaTabProps) {
  return (
    <div className="space-y-4">
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}

      <div className="rounded-lg border bg-card shadow-sm">
        {alertMessage ? (
          <div className="m-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            {alertMessage}
          </div>
        ) : null}
        <div className={alertMessage ? 'px-4 pb-4' : 'p-4'}>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={loading}
            emptyMessage={emptyMessage ?? '--'}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {onSave && saveLabel ? (
          <Button onClick={onSave} disabled={saveDisabled || saveLoading}>
            {saveLoading ? '...' : saveLabel}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onBack}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
