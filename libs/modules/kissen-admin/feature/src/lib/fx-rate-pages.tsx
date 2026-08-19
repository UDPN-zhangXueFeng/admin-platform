'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  createActionColumn,
  type TableRowAction,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';
import { peekRow, stashRow } from './row-stash';

import {
  KISSEN_PROJECT_ID,
  // currency-pair domain
  useCurrencyPairListQuery,
  useCurrencyPairDetailQuery,
  useCurrencyPairBankCurrenciesQuery,
  useSaveCurrencyPairMutation,
  useEnableCurrencyPairMutation,
  useDisableCurrencyPairMutation,
  useFreezeCurrencyPairMutation,
  CurrencyPairStatus,
  CURRENCY_PAIR_STATUS_LABEL,
  CURRENCY_PAIR_STATUS_VARIANT,
  type CurrencyPairRow,
  type CurrencyPairSaveReq,
  type CurrencyPairListFilter,
  // rate domain
  useRateListQuery,
  useRateHistoryQuery,
  useRateDetailQuery,
  useSaveRateMutation,
  useSaveExchangeRateMutation,
  RATE_CHANGE_TYPE_LABEL,
  RATE_STATUS_LABEL,
  RATE_STATUS_VARIANT,
  type RateRecordRow,
  type RateListFilter,
} from '@myorg/modules/kissen-admin/data-access';

const PROJECT_ID = KISSEN_PROJECT_ID;

/** 列表默认每页条数（源 el-pagination page-size 10）。 */
const PAGE_SIZE_DEFAULT = 10;

// ---------------------------------------------------------------------------
// 共享展示工具
// ---------------------------------------------------------------------------

/** 比率/金额千分位分组（源 approval/format.ts formatMoney，保留原小数位）；null/undefined/空 → '-'。 */
function formatRate(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const [int, dec] = String(v).split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 毫秒时间戳 → 统一管理台时间格式；0/空/非法 → '--'（conventions §4）。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

/** 路由 ?id= 解析为正整数；无值视为新建。 */
function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 货币对状态徽章（co-locate 展示组件，conventions §5）。 */
function PairStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={CURRENCY_PAIR_STATUS_VARIANT[status] ?? 'outline'}>
      {CURRENCY_PAIR_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

/** 变更记录状态徽章。 */
function RateStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={RATE_STATUS_VARIANT[status] ?? 'outline'}>
      {RATE_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

/** 详情字段：label + 只读值（照 user-detail-page DetailField）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/* ======================================================================= */
/* currency-pair — 货币对管理（源 fx-rate/pair/index.vue + pair-dialog.vue）*/
/* ======================================================================= */

interface PairFilterForm {
  sourceCurrency?: string;
  targetCurrency?: string;
  status?: number;
}

const PAIR_EMPTY_FILTER: PairFilterForm = {
  sourceCurrency: '',
  targetCurrency: '',
  status: undefined,
};

/** 状态筛选 Select 的「全部」哨兵值（shadcn Select 无原生 clearable）。 */
const STATUS_ALL = 'ALL';

/**
 * CurrencyPairListPage — 货币对管理列表页。
 *
 * 迁移自源 `views/fx-rate/pair/index.vue`。
 * - 筛选：源币种 / 目标币种（精确 Input）/ 状态（Select）。
 * - 列：货币对 / 管理侧加价率 / 滑点阈值 / 基础汇率 / 状态 / 创建时间。
 * - 行操作：查看(路由) / 编辑(路由) / 提交启用(status≠20) / 提交停用(status=20)
 *   / 调整加价率(status=20,MarkupDialog) / 维护基础汇率(status=20,BaseRateDialog)
 *   / 冻结(status=20) / 解冻(status=50) / 变更记录(RateHistoryDialog)。
 * - 提交启停 / 冻结解冻用 window.confirm（与 user 模块一致）。
 */
export function CurrencyPairListPage() {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset, control } =
    useForm<PairFilterForm>({ defaultValues: PAIR_EMPTY_FILTER });

  const [params, setParams] = React.useState<{
    pageNum: number;
    pageSize: number;
    filter: CurrencyPairListFilter;
  }>({ pageNum: 1, pageSize: PAGE_SIZE_DEFAULT, filter: {} });

  const { data, isLoading } = useCurrencyPairListQuery(PROJECT_ID, params);
  const enableMutation = useEnableCurrencyPairMutation(PROJECT_ID);
  const disableMutation = useDisableCurrencyPairMutation(PROJECT_ID);
  const freezeMutation = useFreezeCurrencyPairMutation(PROJECT_ID);

  // 行内弹窗状态（MarkupDialog / BaseRateDialog / RateHistoryDialog）。
  const [markupRow, setMarkupRow] = React.useState<CurrencyPairRow | null>(null);
  const [baseRateRow, setBaseRateRow] = React.useState<CurrencyPairRow | null>(
    null,
  );
  const [historyRow, setHistoryRow] = React.useState<CurrencyPairRow | null>(
    null,
  );

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: PairFilterForm) => {
    setParams((p) => ({ ...p, pageNum: 1, filter: form }));
  }, []);

  const onReset = React.useCallback(() => {
    reset(PAIR_EMPTY_FILTER);
    setParams((p) => ({ ...p, pageNum: 1, filter: {} }));
  }, [reset]);

  const submitEnable = React.useCallback(
    (row: CurrencyPairRow) => {
      if (
        !window.confirm(
          `Submit enable approval for "${row.sourceCurrency}/${row.targetCurrency}"? Once approved, the currency pair will be enabled and pushed to the bank gateway.`,
        )
      )
        return;
      enableMutation.mutate(
        { pairId: row.pairId },
        {
          onSuccess: () => toast.success('Enable approval submitted'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [enableMutation, toast],
  );

  const submitDisable = React.useCallback(
    (row: CurrencyPairRow) => {
      if (
        !window.confirm(
          `Submit disable approval for "${row.sourceCurrency}/${row.targetCurrency}"? Once approved, the currency pair will be disabled network-wide and will reject orders.`,
        )
      )
        return;
      disableMutation.mutate(
        { pairId: row.pairId },
        {
          onSuccess: () => toast.success('Disable approval submitted'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [disableMutation, toast],
  );

  /** 冻结：status 20→50，立即生效不走审批（FR-C-03）。 */
  const onFreeze = React.useCallback(
    (row: CurrencyPairRow) => {
      if (
        !window.confirm(
          `Freeze currency pair "${row.sourceCurrency}/${row.targetCurrency}"? The pair will immediately exit quoting and order taking, and its status will become Disabled.`,
        )
      )
        return;
      freezeMutation.mutate(
        { pairId: row.pairId, freeze: true },
        {
          onSuccess: () => toast.success('Frozen'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [freezeMutation, toast],
  );

  /** 解冻：status 50→20，恢复启用。 */
  const onUnfreeze = React.useCallback(
    (row: CurrencyPairRow) => {
      if (
        !window.confirm(
          `Unfreeze currency pair "${row.sourceCurrency}/${row.targetCurrency}"? The pair will be re-enabled and resume quoting.`,
        )
      )
        return;
      freezeMutation.mutate(
        { pairId: row.pairId, freeze: false },
        {
          onSuccess: () => toast.success('Unfrozen'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [freezeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<CurrencyPairRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'sourceCurrency',
        header: 'Currency Pair',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: 'Admin Markup Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.markupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'slippageThreshold',
        header: 'Slippage Threshold',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.slippageThreshold)}
          </span>
        ),
      },
      {
        accessorKey: 'baseRate',
        header: 'Base Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.baseRate)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PairStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatTime(row.original.createTime)}</span>
        ),
      },
      createActionColumn<CurrencyPairRow & { id: string }>((item) => {
        const enabled = item.status === CurrencyPairStatus.Enabled;
        const disabled = item.status === CurrencyPairStatus.Disabled;
        const actions: TableRowAction<CurrencyPairRow & { id: string }>[] = [
          {
            label: 'View',
            onClick: () => {
              stashRow('currency-pair', item.pairId, item);
              router.push(`/currency-pair/detail?id=${item.pairId}`);
            },
          },
          {
            label: 'Edit',
            onClick: () => {
              stashRow('currency-pair', item.pairId, item);
              router.push(`/currency-pair/edit?id=${item.pairId}`);
            },
          },
        ];
        if (!enabled) {
          actions.push({
            label: 'Submit for Enable',
            onClick: () => submitEnable(item),
          });
        }
        if (enabled) {
          actions.push({
            label: 'Submit for Disable',
            destructive: true,
            onClick: () => submitDisable(item),
          });
          actions.push({
            label: 'Adjust Markup Rate',
            onClick: () => setMarkupRow(item),
          });
          actions.push({
            label: 'Maintain Base Rate',
            onClick: () => setBaseRateRow(item),
          });
          actions.push({
            label: 'Freeze',
            onClick: () => onFreeze(item),
          });
        }
        if (disabled) {
          actions.push({
            label: 'Unfreeze',
            onClick: () => onUnfreeze(item),
          });
        }
        actions.push({
          label: 'Change History',
          onClick: () => setHistoryRow(item),
        });
        return actions;
      }),
    ],
    [
      router,
      submitEnable,
      submitDisable,
      onFreeze,
      onUnfreeze,
    ],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.pairId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="sourceCurrency"
            label="Source Currency"
            placeholder="Exact match, e.g. USD"
            register={register('sourceCurrency')}
          />
          <FormField
            name="targetCurrency"
            label="Target Currency"
            placeholder="Exact match, e.g. EUR"
            register={register('targetCurrency')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Status
            </label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : STATUS_ALL}
                  onValueChange={(v) =>
                    field.onChange(v === STATUS_ALL ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>All</SelectItem>
                    <SelectItem value="1">Saved (Draft)</SelectItem>
                    <SelectItem value="20">Approved</SelectItem>
                    <SelectItem value="50">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Currency Pair Management</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/currency-pair/create')}
          >
            New Currency Pair
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) =>
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
                }
              : undefined
          }
        />
      </div>

      {/* 调整加价率弹窗（源 markup-dialog.vue，rateSave KRC 审批） */}
      {markupRow && (
        <MarkupDialog
          row={markupRow}
          onClose={() => setMarkupRow(null)}
        />
      )}
      {/* 维护基础汇率弹窗（源 base-rate-dialog.vue，exchangeRateSave 立即生效） */}
      {baseRateRow && (
        <BaseRateDialog
          row={baseRateRow}
          onClose={() => setBaseRateRow(null)}
        />
      )}
      {/* 变更记录弹窗（源 rate-history-dialog.vue，rateList by pairId） */}
      {historyRow && (
        <RateHistoryDialog
          row={historyRow}
          onClose={() => setHistoryRow(null)}
        />
      )}
    </div>
  );
}

/**
 * MarkupDialog — 调整加价率弹窗。
 * 迁移自源 `markup-dialog.vue`。提交加价率变更（rateSave → KRC 审批）。
 */
function MarkupDialog({
  row,
  onClose,
}: {
  row: CurrencyPairRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const mutation = useSaveRateMutation(PROJECT_ID);
  const [markupRate, setMarkupRate] = React.useState('');

  const handleSubmit = () => {
    const n = Number(markupRate);
    if (markupRate === '' || !Number.isFinite(n)) {
      toast.error('Enter a new markup rate');
      return;
    }
    if (n < 0) {
      toast.error('Markup rate cannot be negative');
      return;
    }
    mutation.mutate(
      { pairId: row.pairId, markupRate: n },
      {
        onSuccess: () => {
          toast.success('Markup rate change approval submitted');
          onClose();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Adjust Markup Rate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency Pair</label>
            <p className="text-sm">
              {row.sourceCurrency}/{row.targetCurrency}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Markup Rate</label>
            <p className="text-sm tabular-nums">{formatRate(row.markupRate)}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              New Markup Rate<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={markupRate}
              onChange={(e) => setMarkupRate(e.target.value)}
              placeholder="Enter new markup rate"
            />
            <p className="text-xs text-muted-foreground">
              Once approved, it will be written to the currency pair and pushed to the bank gateway
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * BaseRateDialog — 维护基础汇率弹窗。
 * 迁移自源 `base-rate-dialog.vue`。基础汇率手工维护（exchangeRateSave，立即生效）。
 */
function BaseRateDialog({
  row,
  onClose,
}: {
  row: CurrencyPairRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const mutation = useSaveExchangeRateMutation(PROJECT_ID);
  const [baseRate, setBaseRate] = React.useState('');

  const handleSubmit = () => {
    const n = Number(baseRate);
    if (baseRate === '' || !Number.isFinite(n)) {
      toast.error('Enter a new base rate');
      return;
    }
    if (n <= 0) {
      toast.error('Base rate must be greater than 0');
      return;
    }
    mutation.mutate(
      { pairId: row.pairId, baseRate: n },
      {
        onSuccess: () => {
          toast.success('Base rate saved');
          onClose();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Maintain Base Rate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency Pair</label>
            <p className="text-sm">
              {row.sourceCurrency}/{row.targetCurrency}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Base Rate</label>
            <p className="text-sm tabular-nums">{formatRate(row.baseRate)}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              New Base Rate<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              placeholder="Enter new base rate"
            />
            <p className="text-xs text-muted-foreground">
              Takes effect immediately after saving; quoting and timeout re-quoting will use the new rate (no approval in the first version)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * RateHistoryDialog — 变更记录弹窗。
 * 迁移自源 `rate-history-dialog.vue`。按 pairId 查加价率变更记录列表。
 */
function RateHistoryDialog({
  row,
  onClose,
}: {
  row: CurrencyPairRow;
  onClose: () => void;
}) {
  const [pageNum, setPageNum] = React.useState(1);
  const { data, isLoading } = useRateHistoryQuery(
    PROJECT_ID,
    row.pairId,
    pageNum,
    10,
  );

  const rows = (data?.data ?? []).map((r) => ({ ...r, id: String(r.recordId) }));
  const paginationMeta = data?.pagination;

  const columns = React.useMemo<
    ColumnDef<RateRecordRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'oldMarkupRate',
        header: 'Old Markup Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.oldMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'newMarkupRate',
        header: 'New Markup Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.newMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'changeType',
        header: 'Change Type',
        cell: ({ row }) => (
          <span>
            {RATE_CHANGE_TYPE_LABEL[row.original.changeType] ??
              String(row.original.changeType)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <RateStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'approvalRecordId',
        header: 'Approval Record',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.approvalRecordId
              ? String(row.original.approvalRecordId)
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatTime(row.original.createTime)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            Change History: {row.sourceCurrency}/{row.targetCurrency}
          </DialogTitle>
        </DialogHeader>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No change history"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: setPageNum,
                }
              : undefined
          }
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CurrencyPairFormPage — 货币对新建/编辑页。
 *
 * 迁移自源 `pair-dialog.vue`（create/edit 模式）。
 * - 源/目标币种：Select 已入网银行支持币种并集（编辑态禁用）。
 * - 管理侧加价率：编辑态且 status=20 时锁定（走行操作「调整加价率」审批）。
 * - 滑点阈值：选填，基础汇率百分比。
 * - 校验：源/目标必选且不相同；加价率必填非负。
 */
export function CurrencyPairFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const pairId = parseId(searchParams.get('id'));
  const isEdit = pairId != null;

  const { data: currencies } = useCurrencyPairBankCurrenciesQuery(PROJECT_ID);
  const { data: detail } = useCurrencyPairDetailQuery(PROJECT_ID, pairId);
  const saveMutation = useSaveCurrencyPairMutation(PROJECT_ID);

  /** 列表跳转前 stashRow 的行优先；无暂存（直链/刷新）回退列表扫描。 */
  const [stashedRow] = React.useState(() =>
    pairId != null ? peekRow<CurrencyPairRow>('currency-pair', pairId) : null,
  );
  const pairRow = detail ?? stashedRow;

  const currencyOptions = currencies ?? [];
  const currenciesEmpty = currencyOptions.length === 0;
  /** 已启用货币对加价率锁定（改加价率走 KRC/M6）。 */
  const markupLocked =
    isEdit && pairRow?.status === CurrencyPairStatus.Enabled;

  const { control, register, handleSubmit, reset, watch, formState: { errors } } =
    useForm<PairFormValues>({
      defaultValues: {
        sourceCurrency: '',
        targetCurrency: '',
        markupRate: '',
        slippageThreshold: '',
      },
    });

  React.useEffect(() => {
    if (!isEdit || !pairRow) return;
    reset({
      sourceCurrency: pairRow.sourceCurrency ?? '',
      targetCurrency: pairRow.targetCurrency ?? '',
      markupRate:
        pairRow.markupRate != null ? String(pairRow.markupRate) : '',
      slippageThreshold:
        pairRow.slippageThreshold != null
          ? String(pairRow.slippageThreshold)
          : '',
    });
  }, [pairRow, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    const req: CurrencyPairSaveReq = {
      pairId: isEdit ? pairId : undefined,
      sourceCurrency: values.sourceCurrency,
      targetCurrency: values.targetCurrency,
      markupRate: values.markupRate !== '' ? Number(values.markupRate) : 0,
    };
    if (values.slippageThreshold !== '') {
      req.slippageThreshold = Number(values.slippageThreshold);
    }
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Draft)');
        router.push('/currency-pair');
      },
      onError: (err) => toast.error((err as Error).message),
    });
  });

  const submitting = saveMutation.isPending;
  const sourceCurrency = watch('sourceCurrency');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit Currency Pair' : 'New Currency Pair'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 源币种：Select 已入网银行支持币种并集；编辑态禁用 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Source Currency<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="sourceCurrency"
              rules={{ required: 'Select source currency' }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit || currenciesEmpty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select source currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {currenciesEmpty && (
              <p className="text-xs text-muted-foreground">
                No currencies supported by onboarded banks
              </p>
            )}
            {errors.sourceCurrency && (
              <p className="text-sm text-destructive" role="alert">
                {errors.sourceCurrency.message}
              </p>
            )}
          </div>

          {/* 目标币种：同源币种数据源；编辑态禁用 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Target Currency<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="targetCurrency"
              rules={{
                required: 'Select target currency',
                validate: (v) =>
                  !v || v !== sourceCurrency || 'Source and target currencies cannot be the same',
              }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit || currenciesEmpty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.targetCurrency && (
              <p className="text-sm text-destructive" role="alert">
                {errors.targetCurrency.message}
              </p>
            )}
          </div>

          {/* 管理侧加价率：已启用(status=20)编辑态锁定 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Admin Markup Rate<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              disabled={markupLocked}
              {...register('markupRate', {
                validate: (v) => {
                  if (v === '') return 'Enter admin markup rate';
                  const n = Number(v);
                  if (!Number.isFinite(n)) return 'Enter admin markup rate';
                  if (n < 0) return 'Markup rate cannot be negative';
                  return true;
                },
              })}
            />
            {errors.markupRate && (
              <p className="text-sm text-destructive" role="alert">
                {errors.markupRate.message}
              </p>
            )}
            {markupLocked && (
              <p className="text-xs text-muted-foreground">
                Markup rate changes for enabled pairs go through the "Adjust Markup Rate" row action approval
              </p>
            )}
          </div>

          {/* 滑点阈值：基础汇率百分比，选填 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Slippage Threshold</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Default 0"
              {...register('slippageThreshold', {
                validate: (v) => {
                  if (v === '') return true;
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) return 'Slippage threshold cannot be negative';
                  return true;
                },
              })}
            />
            {errors.slippageThreshold && (
              <p className="text-sm text-destructive" role="alert">
                {errors.slippageThreshold.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Percentage of base rate, optional
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/currency-pair')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Save
        </Button>
      </div>
    </form>
  );
}

interface PairFormValues {
  sourceCurrency: string;
  targetCurrency: string;
  markupRate: string;
  slippageThreshold: string;
}

/**
 * CurrencyPairDetailPage — 货币对详情只读页。
 * 迁移自源 `pair-dialog.vue` view 模式。无 detail 端点，列表回查定位。
 */
export function CurrencyPairDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pairId = parseId(searchParams.get('id'));
  const [stashedRow] = React.useState(() =>
    pairId != null ? peekRow<CurrencyPairRow>('currency-pair', pairId) : null,
  );
  const { data: scanned, isLoading } = useCurrencyPairDetailQuery(
    PROJECT_ID,
    pairId,
  );
  /** 列表跳转前 stashRow 的行优先；无暂存（直链/刷新）回退列表扫描。 */
  const detail = scanned ?? stashedRow;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Currency Pair Details</div>
        <Button variant="outline" onClick={() => router.push('/currency-pair')}>
          Back
        </Button>
      </div>
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">
            Currency pair not found (it may be outside the first page of the list).
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Currency Pair">
              {detail.sourceCurrency}/{detail.targetCurrency}
            </DetailField>
            <DetailField label="Admin Markup Rate">
              <span className="tabular-nums">
                {formatRate(detail.markupRate)}
              </span>
            </DetailField>
            <DetailField label="Slippage Threshold">
              <span className="tabular-nums">
                {formatRate(detail.slippageThreshold)}
              </span>
            </DetailField>
            <DetailField label="Base Rate">
              <span className="tabular-nums">
                {formatRate(detail.baseRate)}
              </span>
            </DetailField>
            <DetailField label="Status">
              <PairStatusBadge status={detail.status} />
            </DetailField>
            <DetailField label="Created At">
              {formatTime(detail.createTime)}
            </DetailField>
          </dl>
        )}
      </section>
    </div>
  );
}

/* ======================================================================= */
/* rate-config — 加价率变更记录（源 rate.ts rateList / rateSave）          */
/* ======================================================================= */

interface RateFilterForm {
  pairId?: string;
  status?: number;
}

const RATE_EMPTY_FILTER: RateFilterForm = { pairId: '', status: undefined };

/**
 * RateConfigListPage — 加价率变更记录列表。
 * 迁移自源 `rate-history-dialog.vue` 的 rateList（独立全量视图）。
 * - 筛选：pairId（精确）/ 状态（Select）。
 * - 列：货币对 / 原加价率 / 新加价率 / 变更类型 / 状态 / 审批记录 / 创建时间。
 * - 行操作：查看（detail 路由）。
 */
export function RateConfigListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<RateFilterForm>({
    defaultValues: RATE_EMPTY_FILTER,
  });

  const [params, setParams] = React.useState<{
    pageNum: number;
    pageSize: number;
    filter: RateListFilter;
  }>({ pageNum: 1, pageSize: PAGE_SIZE_DEFAULT, filter: {} });

  const { data, isLoading } = useRateListQuery(PROJECT_ID, params);
  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: RateFilterForm) => {
    const filter: RateListFilter = {};
    const pid = Number(form.pairId);
    if (form.pairId && Number.isFinite(pid) && pid > 0) filter.pairId = pid;
    if (form.status != null) filter.status = form.status;
    setParams({ pageNum: 1, pageSize: PAGE_SIZE_DEFAULT, filter });
  }, []);

  const onReset = React.useCallback(() => {
    reset(RATE_EMPTY_FILTER);
    setParams((p) => ({ ...p, pageNum: 1, filter: {} }));
  }, [reset]);

  const columns = React.useMemo<
    ColumnDef<RateRecordRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'sourceCurrency',
        header: 'Currency Pair',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'oldMarkupRate',
        header: 'Old Markup Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.oldMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'newMarkupRate',
        header: 'New Markup Rate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.newMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'changeType',
        header: 'Change Type',
        cell: ({ row }) => (
          <span>
            {RATE_CHANGE_TYPE_LABEL[row.original.changeType] ??
              String(row.original.changeType)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <RateStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'approvalRecordId',
        header: 'Approval Record',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.approvalRecordId
              ? String(row.original.approvalRecordId)
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatTime(row.original.createTime)}</span>
        ),
      },
      createActionColumn<RateRecordRow & { id: string }>((item) => [
        {
          label: 'View',
          onClick: () =>
            router.push(`/rate-config/detail?id=${item.recordId}`),
        },
      ]),
    ],
    [router],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.recordId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="pairId"
            label="Currency Pair ID"
            placeholder="Exact match, e.g. 1"
            register={register('pairId')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Status
            </label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : STATUS_ALL}
                  onValueChange={(v) =>
                    field.onChange(v === STATUS_ALL ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>All</SelectItem>
                    <SelectItem value="5">Pending</SelectItem>
                    <SelectItem value="15">Closed</SelectItem>
                    <SelectItem value="20">Effective</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Markup Rate Change History</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/rate-config/create')}
          >
            Submit Markup Rate Change
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) =>
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

interface RateFormValues {
  pairId: string;
  markupRate: string;
}

/**
 * RateConfigFormPage — 提交加价率变更表单。
 * 迁移自源 `markup-dialog.vue` 的独立路由版（rateSave → KRC 审批）。
 * - 新建：选择启用(status=20)货币对 + 输入新加价率。
 * - 编辑：pairId 锁定（来自记录），加价率回填 newMarkupRate。
 * - 校验：pairId 必选；加价率必填非负。
 */
export function RateConfigFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const recordId = parseId(searchParams.get('id'));
  const isEdit = recordId != null;

  // 启用货币对选项（仅新建态需要选择；本域 query，无跨组耦合）。
  const { data: enabledPairsData } = useCurrencyPairListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: { status: CurrencyPairStatus.Enabled } },
    !isEdit,
  );
  const { data: record } = useRateDetailQuery(PROJECT_ID, recordId);
  const mutation = useSaveRateMutation(PROJECT_ID);

  const enabledPairs = enabledPairsData?.data ?? [];

  const { control, register, handleSubmit, reset } =
    useForm<RateFormValues>({
      defaultValues: { pairId: '', markupRate: '' },
    });

  React.useEffect(() => {
    if (!isEdit || !record) return;
    reset({
      pairId: String(record.pairId),
      markupRate:
        record.newMarkupRate != null ? String(record.newMarkupRate) : '',
    });
  }, [record, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    const pairIdNum = Number(values.pairId);
    if (!values.pairId || !Number.isFinite(pairIdNum) || pairIdNum <= 0) {
      toast.error('Select a currency pair');
      return;
    }
    const markupNum = Number(values.markupRate);
    if (values.markupRate === '' || !Number.isFinite(markupNum)) {
      toast.error('Enter a new markup rate');
      return;
    }
    if (markupNum < 0) {
      toast.error('Markup rate cannot be negative');
      return;
    }
    mutation.mutate(
      { pairId: pairIdNum, markupRate: markupNum },
      {
        onSuccess: () => {
          toast.success('Markup rate change approval submitted');
          router.push('/rate-config');
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  });

  const submitting = mutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Adjust Markup Rate' : 'Submit Markup Rate Change'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 货币对：新建态选择启用对；编辑态锁定 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Currency Pair<span className="ml-0.5 text-destructive">*</span>
            </label>
            {isEdit ? (
              <Input
                value={
                  record
                    ? `${record.sourceCurrency}/${record.targetCurrency}`
                    : ''
                }
                disabled
              />
            ) : (
              <Controller
                control={control}
                name="pairId"
                rules={{ required: 'Select a currency pair' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an enabled currency pair" />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledPairs.map((p) => (
                        <SelectItem key={p.pairId} value={String(p.pairId)}>
                          {p.sourceCurrency}/{p.targetCurrency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>

          {/* 新加价率 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              New Markup Rate<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Enter new markup rate"
              {...register('markupRate')}
            />
            <p className="text-xs text-muted-foreground">
              Once approved, it will be written to the currency pair and pushed to the bank gateway
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/rate-config')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Submit
        </Button>
      </div>
    </form>
  );
}

/**
 * RateConfigDetailPage — 加价率变更记录详情只读页。
 * 无 detail 端点，列表回查定位（rateList 返回完整记录）。
 */
export function RateConfigDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = parseId(searchParams.get('id'));
  const { data: record, isLoading } = useRateDetailQuery(PROJECT_ID, recordId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Change History Details</div>
        <Button variant="outline" onClick={() => router.push('/rate-config')}>
          Back
        </Button>
      </div>
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : !record ? (
          <p className="text-sm text-muted-foreground">
            Change record not found (it may be outside the first page of the list).
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Currency Pair">
              {record.sourceCurrency}/{record.targetCurrency}
            </DetailField>
            <DetailField label="Old Markup Rate">
              <span className="tabular-nums">
                {formatRate(record.oldMarkupRate)}
              </span>
            </DetailField>
            <DetailField label="New Markup Rate">
              <span className="tabular-nums">
                {formatRate(record.newMarkupRate)}
              </span>
            </DetailField>
            <DetailField label="Change Type">
              {RATE_CHANGE_TYPE_LABEL[record.changeType] ??
                String(record.changeType)}
            </DetailField>
            <DetailField label="Status">
              <RateStatusBadge status={record.status} />
            </DetailField>
            <DetailField label="Approval Record">
              <span className="tabular-nums">
                {record.approvalRecordId
                  ? String(record.approvalRecordId)
                  : '-'}
              </span>
            </DetailField>
            <DetailField label="Created At">
              {formatTime(record.createTime)}
            </DetailField>
          </dl>
        )}
      </section>
    </div>
  );
}
