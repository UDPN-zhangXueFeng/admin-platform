'use client';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import type {
  OperationRecordRow,
  OperationType,
} from '@myorg/modules/td-admin/data-access';

import { OperationStatusBadge } from './operation-status-badge';

export interface OperationRecordDrawerProps {
  open: boolean;
  record: OperationRecordRow | null;
  basicInfo: { financialBookName: string };
  t: (key: string) => string;
  tCommon: (key: string) => string;
  onClose: () => void;
}

function operationTypeLabel(
  operationType: OperationType | undefined,
  t: (key: string) => string
): string {
  switch (operationType) {
    case 'create':
      return t('operationRecords.create');
    case 'update':
      return t('operationRecords.update');
    case 'activate':
      return t('operationRecords.activate');
    case 'deactivate':
      return t('operationRecords.deactivate');
    default:
      return '--';
  }
}

/** 操作记录明细抽屉（迁移自源 `OperationRecordDrawer.tsx`）。 */
export function OperationRecordDrawer({
  open,
  record,
  basicInfo,
  t,
  tCommon,
  onClose,
}: OperationRecordDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent className="max-w-xl sm:w-[min(640px,100vw)]">
        <DrawerHeader>
          <DrawerTitle>{t('operationRecords.drawerTitle')}</DrawerTitle>
        </DrawerHeader>

        {record ? (
          <div className="flex max-h-[80vh] flex-col gap-5 overflow-auto px-4 pb-6 text-sm text-muted-foreground">
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="mb-3 text-base font-semibold text-foreground">
                {operationTypeLabel(record.operationType, t)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('operationRecords.createdBy')}
                  </div>
                  <div className="text-foreground">{record.createdBy}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('operationRecords.createdOn')}
                  </div>
                  <div className="text-foreground">{record.createdOn}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('operationRecords.status')}
                  </div>
                  <div className="text-foreground">
                    <OperationStatusBadge
                      status={record.status}
                      tCommon={tCommon}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('operationRecords.financialBook')}
                  </div>
                  <div className="text-foreground">
                    {basicInfo.financialBookName}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">
                {t('operationRecords.comment')}
              </div>
              <div className="rounded-md border p-4">{record.comments}</div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">
                {t('operationRecords.notes')}
              </div>
              <div className="rounded-md border p-4">
                {record.detailNotes.map((item) => (
                  <div key={item} className="mb-2 last:mb-0">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
