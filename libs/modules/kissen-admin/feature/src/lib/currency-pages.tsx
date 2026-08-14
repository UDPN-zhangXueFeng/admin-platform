'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import {
  KISSEN_PROJECT_ID,
  useCurrencyListQuery,
  useSaveCurrencyMutation,
  useToggleCurrencyStatusMutation,
  CURRENCY_STATUS_LABEL,
  type CurrencyRow,
  type CurrencySaveReq,
} from '@myorg/modules/kissen-admin/data-access';

/**
 * 币种管理（源 `views/system/currency/index.vue` + `currency-dialog.vue`）。
 *
 * 功能与源对齐：
 * - 分页列表（币种代码 / 币种名称 / 小数位 / 创建时间 / 操作）
 * - 新建 / 编辑（弹窗，编辑态 currencyCode disabled）
 * - 启停切换（源 toggle-status，服务端 20↔50 翻转）
 *
 * 保留弹窗形式而非路由拆分——源即弹窗 + 单一 save 端点（无 by-PK detail），
 * 路由化无收益且偏离源交互。
 */

const PAGE_SIZE_DEFAULT = 20;

const STATUS_VARIANT: Record<number, 'default' | 'secondary'> = {
  20: 'default',
  50: 'secondary',
};

function formatDateTime(value: number | null | undefined): string {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function CurrencyListPage() {
  const toast = useToast();

  const { register, handleSubmit, reset } = useForm<{ currencyCode: string }>({
    defaultValues: { currencyCode: '' },
  });

  const [params, setParams] = React.useState({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    filter: {},
  });
  const { data, isLoading } = useCurrencyListQuery(KISSEN_PROJECT_ID, params);

  const toggleMutation = useToggleCurrencyStatusMutation(KISSEN_PROJECT_ID);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CurrencyRow | null>(null);

  const rows = (data?.data ?? []) as CurrencyRow[];

  const onSearch = handleSubmit((form) => {
    setParams((p) => ({
      ...p,
      pageNum: 1,
      filter: { currencyCode: form.currencyCode.trim() || undefined },
    }));
  });

  const onResetSearch = () => {
    reset({ currencyCode: '' });
    setParams({ pageNum: 1, pageSize: PAGE_SIZE_DEFAULT, filter: {} });
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: CurrencyRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const onToggle = (row: CurrencyRow) => {
    const verb = row.status === 20 ? '停用' : '启用';
    if (!window.confirm(`确认${verb}币种「${row.currencyCode}」?`)) return;
    toggleMutation.mutate(
      { currencyId: row.currencyId },
      {
        onSuccess: () => toast.success(`已${verb}`),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const columns = React.useMemo<
    ColumnDef<CurrencyRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'currencyCode', header: '币种代码' },
      { accessorKey: 'currencyName', header: '币种名称' },
      {
        accessorKey: 'decimalDigits',
        header: '小数位',
        cell: ({ row }) => (
          <span>{row.original.decimalDigits}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: '创建时间',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      {
        id: 'status',
        header: '状态',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>
            {CURRENCY_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => openEdit(row.original)}
            >
              编辑
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onToggle(row.original)}
            >
              {row.original.status === 20 ? '停用' : '启用'}
            </Button>
          </div>
        ),
      },
    ],
    [toggleMutation, toast],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.currencyId) })),
    [rows],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">币种管理</h1>
        <Button onClick={openCreate}>新建币种</Button>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-48">
          <FormField
            name="currencyCode"
            label="币种代码"
            register={register('currencyCode')}
          />
        </div>
        <Button type="submit">查询</Button>
        <Button type="button" variant="outline" onClick={onResetSearch}>
          重置
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        pagination={{
          page: params.pageNum,
          pageSize: params.pageSize,
          total: data?.pagination?.total ?? 0,
          onPageChange: (page: number) =>
            setParams((p) => ({ ...p, pageNum: page })),
        }}
      />

      <CurrencySaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 新建/编辑弹窗（源 currency-dialog.vue）
// ---------------------------------------------------------------------------

interface CurrencySaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CurrencyRow | null;
}

function CurrencySaveDialog({
  open,
  onOpenChange,
  editing,
}: CurrencySaveDialogProps) {
  const toast = useToast();
  const mutation = useSaveCurrencyMutation(KISSEN_PROJECT_ID);

  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Omit<CurrencySaveReq, 'currencyId'>>({
    defaultValues: { currencyCode: '', currencyName: '', decimalDigits: 2 },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              currencyCode: editing.currencyCode,
              currencyName: editing.currencyName,
              decimalDigits: editing.decimalDigits,
            }
          : { currencyCode: '', currencyName: '', decimalDigits: 2 },
      );
    }
  }, [open, editing, reset]);

  const onSubmit = handleSubmit((values) => {
    const req: CurrencySaveReq = {
      ...values,
      decimalDigits: Number(values.decimalDigits),
      ...(editing ? { currencyId: editing.currencyId } : {}),
    };
    mutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? '币种已更新' : '币种已创建');
        onOpenChange(false);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑币种' : '新建币种'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改币种信息' : '创建新的币种'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currencyCode">币种代码</Label>
            <Input
              id="currencyCode"
              placeholder="如 USD"
              maxLength={10}
              disabled={isEdit}
              {...register('currencyCode', { required: '请输入币种代码' })}
            />
            {errors.currencyCode && (
              <p className="text-sm text-destructive">
                {errors.currencyCode.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currencyName">币种名称</Label>
            <Input
              id="currencyName"
              placeholder="如 美元"
              maxLength={50}
              {...register('currencyName', { required: '请输入币种名称' })}
            />
            {errors.currencyName && (
              <p className="text-sm text-destructive">
                {errors.currencyName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decimalDigits">小数位</Label>
            <Input
              id="decimalDigits"
              type="number"
              min={0}
              max={18}
              step={1}
              {...register('decimalDigits', {
                required: '请输入小数位',
                min: { value: 0, message: '最小 0' },
                max: { value: 18, message: '最大 18' },
              })}
            />
            {errors.decimalDigits && (
              <p className="text-sm text-destructive">
                {errors.decimalDigits.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
