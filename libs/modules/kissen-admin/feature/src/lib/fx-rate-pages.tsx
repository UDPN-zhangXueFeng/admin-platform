'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
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

/** 毫秒时间戳 → toLocaleString；0/空 → '--'（conventions §4）。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  return new Date(Number(ms)).toLocaleString();
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
          `确认提交「${row.sourceCurrency}/${row.targetCurrency}」启用审批?审批通过后货币对启用并推送银行网关。`,
        )
      )
        return;
      enableMutation.mutate(
        { pairId: row.pairId },
        {
          onSuccess: () => toast.success('已提交启用审批'),
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
          `确认提交「${row.sourceCurrency}/${row.targetCurrency}」停用审批?审批通过后货币对全网停用并拒单。`,
        )
      )
        return;
      disableMutation.mutate(
        { pairId: row.pairId },
        {
          onSuccess: () => toast.success('已提交停用审批'),
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
          `确认冻结货币对「${row.sourceCurrency}/${row.targetCurrency}」?冻结后该对立即退出报价与接单,状态变为停用。`,
        )
      )
        return;
      freezeMutation.mutate(
        { pairId: row.pairId, freeze: true },
        {
          onSuccess: () => toast.success('已冻结'),
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
          `确认解冻货币对「${row.sourceCurrency}/${row.targetCurrency}」?解冻后该对恢复启用,重新参与报价。`,
        )
      )
        return;
      freezeMutation.mutate(
        { pairId: row.pairId, freeze: false },
        {
          onSuccess: () => toast.success('已解冻'),
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
        header: '货币对',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: '管理侧加价率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.markupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'slippageThreshold',
        header: '滑点阈值',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.slippageThreshold)}
          </span>
        ),
      },
      {
        accessorKey: 'baseRate',
        header: '基础汇率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.baseRate)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <PairStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: '创建时间',
        cell: ({ row }) => (
          <span>{formatTime(row.original.createTime)}</span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const item = row.original;
          const enabled = item.status === CurrencyPairStatus.Enabled;
          const disabled = item.status === CurrencyPairStatus.Disabled;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow('currency-pair', item.pairId, item);
                  router.push(`/currency-pair/detail?id=${item.pairId}`);
                }}
              >
                查看
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow('currency-pair', item.pairId, item);
                  router.push(`/currency-pair/edit?id=${item.pairId}`);
                }}
              >
                编辑
              </Button>
              {!enabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => submitEnable(item)}
                >
                  提交启用
                </Button>
              )}
              {enabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => submitDisable(item)}
                >
                  提交停用
                </Button>
              )}
              {enabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setMarkupRow(item)}
                >
                  调整加价率
                </Button>
              )}
              {enabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setBaseRateRow(item)}
                >
                  维护基础汇率
                </Button>
              )}
              {enabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onFreeze(item)}
                >
                  冻结
                </Button>
              )}
              {disabled && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onUnfreeze(item)}
                >
                  解冻
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setHistoryRow(item)}
              >
                变更记录
              </Button>
            </div>
          );
        },
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="sourceCurrency"
            label="源币种"
            placeholder="精确匹配,如 USD"
            register={register('sourceCurrency')}
          />
          <FormField
            name="targetCurrency"
            label="目标币种"
            placeholder="精确匹配,如 EUR"
            register={register('targetCurrency')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              状态
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
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>全部</SelectItem>
                    <SelectItem value="1">保存(草稿)</SelectItem>
                    <SelectItem value="20">审核通过</SelectItem>
                    <SelectItem value="50">停用</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">货币对管理</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/currency-pair/create')}
          >
            新建货币对
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
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
      toast.error('请输入新加价率');
      return;
    }
    if (n < 0) {
      toast.error('加价率不能为负');
      return;
    }
    mutation.mutate(
      { pairId: row.pairId, markupRate: n },
      {
        onSuccess: () => {
          toast.success('已提交加价率变更审批');
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
          <DialogTitle>调整加价率</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">货币对</label>
            <p className="text-sm">
              {row.sourceCurrency}/{row.targetCurrency}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">当前加价率</label>
            <p className="text-sm tabular-nums">{formatRate(row.markupRate)}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              新加价率<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={markupRate}
              onChange={(e) => setMarkupRate(e.target.value)}
              placeholder="请输入新加价率"
            />
            <p className="text-xs text-muted-foreground">
              审批通过后写入货币对并推送银行网关
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            提交
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
      toast.error('请输入新基础汇率');
      return;
    }
    if (n <= 0) {
      toast.error('基础汇率必须大于 0');
      return;
    }
    mutation.mutate(
      { pairId: row.pairId, baseRate: n },
      {
        onSuccess: () => {
          toast.success('已保存基础汇率');
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
          <DialogTitle>维护基础汇率</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">货币对</label>
            <p className="text-sm">
              {row.sourceCurrency}/{row.targetCurrency}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">当前基础汇率</label>
            <p className="text-sm tabular-nums">{formatRate(row.baseRate)}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              新基础汇率<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              placeholder="请输入新基础汇率"
            />
            <p className="text-xs text-muted-foreground">
              保存后立即生效,报价与超时重报价将使用新汇率(首版不走审批)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            提交
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
        header: '原加价率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.oldMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'newMarkupRate',
        header: '新加价率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.newMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'changeType',
        header: '变更类型',
        cell: ({ row }) => (
          <span>
            {RATE_CHANGE_TYPE_LABEL[row.original.changeType] ??
              String(row.original.changeType)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <RateStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'approvalRecordId',
        header: '审批记录',
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
        header: '创建时间',
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
            变更记录:{row.sourceCurrency}/{row.targetCurrency}
          </DialogTitle>
        </DialogHeader>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="暂无变更记录"
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
            关闭
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

  const { control, register, handleSubmit, reset, watch } =
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
        toast.success(isEdit ? '已保存' : '已创建(草稿)');
        router.push('/currency-pair');
      },
      onError: (err) => toast.error((err as Error).message),
    });
  });

  const submitting = saveMutation.isPending;
  const sourceCurrency = watch('sourceCurrency');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? '编辑货币对' : '新建货币对'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 源币种：Select 已入网银行支持币种并集；编辑态禁用 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              源币种<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="sourceCurrency"
              rules={{ required: '请选择源币种' }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit || currenciesEmpty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择源币种" />
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
                暂无已入网银行支持的币种
              </p>
            )}
          </div>

          {/* 目标币种：同源币种数据源；编辑态禁用 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              目标币种<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="targetCurrency"
              rules={{
                required: '请选择目标币种',
                validate: (v) =>
                  !v || v !== sourceCurrency || '源币种与目标币种不能相同',
              }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit || currenciesEmpty}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择目标币种" />
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
          </div>

          {/* 管理侧加价率：已启用(status=20)编辑态锁定 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              管理侧加价率<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              disabled={markupLocked}
              {...register('markupRate', {
                validate: (v) => {
                  if (v === '') return '请输入管理侧加价率';
                  const n = Number(v);
                  if (!Number.isFinite(n)) return '请输入管理侧加价率';
                  if (n < 0) return '加价率不能为负';
                  return true;
                },
              })}
            />
            {markupLocked && (
              <p className="text-xs text-muted-foreground">
                已启用货币对加价率变更走行操作「调整加价率」审批
              </p>
            )}
          </div>

          {/* 滑点阈值：基础汇率百分比，选填 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">滑点阈值</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="默认 0"
              {...register('slippageThreshold', {
                validate: (v) => {
                  if (v === '') return true;
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) return '滑点阈值不能为负';
                  return true;
                },
              })}
            />
            <p className="text-xs text-muted-foreground">
              基础汇率百分比,选填
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
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          保存
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
        <div className="text-base font-semibold">货币对详情</div>
        <Button variant="outline" onClick={() => router.push('/currency-pair')}>
          返回
        </Button>
      </div>
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">
            未找到该货币对（可能不在列表首页范围）。
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="货币对">
              {detail.sourceCurrency}/{detail.targetCurrency}
            </DetailField>
            <DetailField label="管理侧加价率">
              <span className="tabular-nums">
                {formatRate(detail.markupRate)}
              </span>
            </DetailField>
            <DetailField label="滑点阈值">
              <span className="tabular-nums">
                {formatRate(detail.slippageThreshold)}
              </span>
            </DetailField>
            <DetailField label="基础汇率">
              <span className="tabular-nums">
                {formatRate(detail.baseRate)}
              </span>
            </DetailField>
            <DetailField label="状态">
              <PairStatusBadge status={detail.status} />
            </DetailField>
            <DetailField label="创建时间">
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
        header: '货币对',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'oldMarkupRate',
        header: '原加价率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.oldMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'newMarkupRate',
        header: '新加价率',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.newMarkupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'changeType',
        header: '变更类型',
        cell: ({ row }) => (
          <span>
            {RATE_CHANGE_TYPE_LABEL[row.original.changeType] ??
              String(row.original.changeType)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <RateStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'approvalRecordId',
        header: '审批记录',
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
        header: '创建时间',
        cell: ({ row }) => (
          <span>{formatTime(row.original.createTime)}</span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(`/rate-config/detail?id=${row.original.recordId}`)
            }
          >
            查看
          </Button>
        ),
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="pairId"
            label="货币对ID"
            placeholder="精确匹配,如 1"
            register={register('pairId')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              状态
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
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>全部</SelectItem>
                    <SelectItem value="5">待生效</SelectItem>
                    <SelectItem value="15">已关闭</SelectItem>
                    <SelectItem value="20">已生效</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">加价率变更记录</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/rate-config/create')}
          >
            提交加价率变更
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
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
      toast.error('请选择货币对');
      return;
    }
    const markupNum = Number(values.markupRate);
    if (values.markupRate === '' || !Number.isFinite(markupNum)) {
      toast.error('请输入新加价率');
      return;
    }
    if (markupNum < 0) {
      toast.error('加价率不能为负');
      return;
    }
    mutation.mutate(
      { pairId: pairIdNum, markupRate: markupNum },
      {
        onSuccess: () => {
          toast.success('已提交加价率变更审批');
          router.push('/rate-config');
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  });

  const submitting = mutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? '调整加价率' : '提交加价率变更'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 货币对：新建态选择启用对；编辑态锁定 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              货币对<span className="ml-0.5 text-destructive">*</span>
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
                rules={{ required: '请选择货币对' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择启用的货币对" />
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
              新加价率<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="请输入新加价率"
              {...register('markupRate')}
            />
            <p className="text-xs text-muted-foreground">
              审批通过后写入货币对并推送银行网关
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
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          提交
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
        <div className="text-base font-semibold">变更记录详情</div>
        <Button variant="outline" onClick={() => router.push('/rate-config')}>
          返回
        </Button>
      </div>
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : !record ? (
          <p className="text-sm text-muted-foreground">
            未找到该变更记录（可能不在列表首页范围）。
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="货币对">
              {record.sourceCurrency}/{record.targetCurrency}
            </DetailField>
            <DetailField label="原加价率">
              <span className="tabular-nums">
                {formatRate(record.oldMarkupRate)}
              </span>
            </DetailField>
            <DetailField label="新加价率">
              <span className="tabular-nums">
                {formatRate(record.newMarkupRate)}
              </span>
            </DetailField>
            <DetailField label="变更类型">
              {RATE_CHANGE_TYPE_LABEL[record.changeType] ??
                String(record.changeType)}
            </DetailField>
            <DetailField label="状态">
              <RateStatusBadge status={record.status} />
            </DetailField>
            <DetailField label="审批记录">
              <span className="tabular-nums">
                {record.approvalRecordId
                  ? String(record.approvalRecordId)
                  : '-'}
              </span>
            </DetailField>
            <DetailField label="创建时间">
              {formatTime(record.createTime)}
            </DetailField>
          </dl>
        )}
      </section>
    </div>
  );
}
