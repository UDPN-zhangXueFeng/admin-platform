'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CircleAlert, Info } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  DataTable,
} from '@myorg/shared/ui';
import type { CoaRow } from '@myorg/modules/td-admin/data-access';

/**
 * Chart of Accounts tab 容器（迁移自源 ChartOfAccountsTab.tsx）。
 *
 * 仅负责呈现：描述 / 提示 / 错误提示 / DataTable（COA 树行）/ 保存草稿按钮。
 * columns、rows、handlers 由上层 useCoaTree hook 提供（保持容器 dumb）。
 * antd Table + Alert → shared/ui DataTable + shared/ui Alert。
 */
export interface CoaTabProps {
  description: string;
  alertMessage: string;
  rows: CoaRow[];
  columns: ColumnDef<CoaRow>[];
  errorMessage?: string;
  loading: boolean;
  emptyMessage?: string;
  onSave?: () => void;
  saveLabel?: string;
  saveLoading?: boolean;
  saveDisabled?: boolean;
}

export function CoaTab({
  description,
  alertMessage,
  rows,
  errorMessage,
  columns,
  loading,
  emptyMessage,
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

      <Card>
        <div className="space-y-4 p-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <CircleAlert className="size-4" aria-hidden="true" />
              <AlertDescription className="text-destructive">
                {errorMessage}
              </AlertDescription>
            </Alert>
          ) : null}
          {alertMessage ? (
            <Alert variant="info">
              <Info className="size-4" aria-hidden="true" />
              <AlertDescription className="leading-relaxed">
                {alertMessage}
              </AlertDescription>
            </Alert>
          ) : null}
          {!errorMessage || rows.length > 0 ? (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={loading}
              emptyMessage={emptyMessage ?? '--'}
            />
          ) : null}
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        {onSave && saveLabel ? (
          <Button onClick={onSave} disabled={saveDisabled || saveLoading}>
            {saveLoading ? '...' : saveLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
