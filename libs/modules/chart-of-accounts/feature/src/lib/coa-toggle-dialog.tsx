'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
} from '@myorg/shared/ui';
import type { CoaRow, CoaToggleFormValues } from '@myorg/modules/chart-of-accounts/data-access';

/**
 * 启用 / 停用账户 Dialog（迁移自源 DeactivateModal.tsx）。
 *
 * antd Modal + Form + Checkbox.Group → shared/ui Dialog + 本地受控 state
 * （表单简单：comment + 子账户多选，无需 RHF）。
 *
 * 停用时子账户多选禁用（仅展示）；启用时可勾选要一并启用的子账户。
 */
export interface CoaToggleDialogProps {
  open: boolean;
  /** true=停用，false=启用。 */
  isDeactivate: boolean;
  recordName: string;
  childAccounts: CoaRow[];
  submitting: boolean;
  title: string;
  alertMessage: string;
  recordLabel: string;
  childAccountsLabel: string;
  commentLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSubmit: (values: CoaToggleFormValues) => void;
  onCancel: () => void;
}

export function CoaToggleDialog({
  open,
  isDeactivate,
  recordName,
  childAccounts,
  submitting,
  title,
  alertMessage,
  recordLabel,
  childAccountsLabel,
  commentLabel,
  cancelLabel,
  confirmLabel,
  onSubmit,
  onCancel,
}: CoaToggleDialogProps) {
  const [comment, setComment] = useState('');
  const [childKeys, setChildKeys] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setComment('');
      setChildKeys([]);
    }
  }, [open]);

  const toggleChild = (key: string, checked: boolean) => {
    setChildKeys((prev) =>
      checked ? [...prev, key] : prev.filter((item) => item !== key)
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={
              isDeactivate
                ? 'rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                : 'rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'
            }
          >
            {alertMessage}
          </div>

          <div className="space-y-1">
            <Label>{recordLabel}</Label>
            <input
              value={recordName}
              readOnly
              disabled
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm opacity-60"
            />
          </div>

          {childAccounts.length ? (
            <div className="space-y-2">
              <Label>{childAccountsLabel}</Label>
              <div
                className={`flex flex-col gap-2 ${isDeactivate ? 'opacity-60' : ''}`}
              >
                {childAccounts.map((item) => {
                  const key = String(item.bookAccountId);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={childKeys.includes(key)}
                        disabled={isDeactivate}
                        onCheckedChange={(checked) =>
                          toggleChild(key, checked === true)
                        }
                      />
                      <span>
                        {item.accountCode || '--'} - {item.accountName || '--'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>{commentLabel}</Label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={200}
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() =>
                onSubmit({ comment: comment.trim() || undefined, childAccountKeys: childKeys })
              }
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
