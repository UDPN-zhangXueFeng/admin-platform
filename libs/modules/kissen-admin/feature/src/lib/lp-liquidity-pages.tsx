'use client';

/**
 * LP / 流动性业务组页面（源 `kissen-admin-frontend-main/src/views/liquidity` + `views/onboard`）。
 *
 * 路由组 `lp-liquidity`，子模块：lp-info / lp-pool / lp-preauth / lp-currency-pair / lp-topup
 * （lp-water-level 无源码，registry 已指向占位页）。
 * 关键迁移决策（CONVENTIONS）：
 *  - message key 未在 kissen-admin messages 中注册，全部中文硬编码，避免 MISSING_MESSAGE 崩溃。
 *  - 列表筛选 text → FormField(register)；下拉 → FormSelect(control)；datetime 用原生
 *    `<input type="datetime-local">`（共享 UI 仅 FormDatePicker 日期粒度，预授权需时分）。
 *  - LP 入网/冻结/解冻、货币对状态变更、预授权撤销均为源内确认即生效（window.confirm）。
 *  - 无独立 detail 接口的域（pool/pair/preauth/topup），编辑回填与详情优先读跳转时
 *    stashRow 缓存的行数据；缺失时按主键扫首页 200 条兜底（源 view/编辑均传整行对象）。
 *  - lp-currency-pair 在源中无独立路由（增删改查均在弹窗），目标无 create/edit 路由 → 增改用
    页内 Dialog；查看走 detail 路由。lp-topup 声明补资同理用页内 Dialog。
 *  - LP 列表选项、货币对选项、资金池选项为跨组数据，已在各域 api 内薄调用，feature 仅消费本组 data-access。
 */

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';

import {
  Badge,
  Button,
  createActionColumn,
  type TableRowAction,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';
import { peekRow, stashRow } from './row-stash';

import {
  CURRENCY_SYSTEM_TYPE_LABEL,
  KISSEN_PROJECT_ID,
  LP_PAIR_STATUS_LABEL,
  LP_PAIR_STATUS_VARIANT,
  LP_PAIR_TARGET_STATUS,
  LP_POOL_STATUS_LABEL,
  LP_POOL_STATUS_VARIANT,
  LP_PREAUTH_STATUS_LABEL,
  LP_PREAUTH_STATUS_VARIANT,
  LP_STATUS_LABEL,
  LP_STATUS_VARIANT,
  LP_TOPUP_STATUS_LABEL,
  LP_TOPUP_STATUS_VARIANT,
  type LpOption,
  type LpPairRow,
  type LpPairSaveReq,
  type LpPoolOption,
  type LpPoolRow,
  type LpPoolSaveReq,
  type LpPreauthRow,
  type LpPreauthSaveReq,
  type LpRow,
  type LpSaveReq,
  type LpTopupRow,
  type LpTopupSaveReq,
  useLpDetailQuery,
  useLpFreezeToggleMutation,
  useLpListQuery,
  useLpPairCurrencyPairOptionsQuery,
  useLpPairListQuery,
  useLpPairLpOptionsQuery,
  useLpPoolListQuery,
  useLpPoolLpOptionsQuery,
  useLpPreauthListQuery,
  useLpPreauthLpOptionsQuery,
  useLpPreauthPoolOptionsQuery,
  useSubmitLpOnboardMutation,
  useLpTopupListQuery,
  useLpTopupLpOptionsQuery,
  useLpTopupPoolOptionsQuery,
  useLpCurrencyPairOptionsQuery,
  useRemoveLpPairMutation,
  useRevokeLpPreauthMutation,
  useSaveLpMutation,
  useSaveLpPairMutation,
  useSaveLpPoolMutation,
  useSaveLpPreauthMutation,
  useSaveLpTopupMutation,
  useSubmitLpPairMutation,
  useUpdateLpPairStatusMutation,
} from '@myorg/modules/kissen-admin/data-access';

/* ================================================================== */
/* 共享常量与工具                                                       */
/* ================================================================== */

const PROJECT_ID = KISSEN_PROJECT_ID;
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const LP_BASE = '/lp-liquidity';

const LBL = {
  query: 'Search',
  reset: 'Reset',
  records: 'Record List',
  empty: 'No data',
  loading: 'Loading...',
  add: 'Add',
  view: 'View',
  edit: 'Edit',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving...',
  back: 'Back',
  saveSuccess: 'Saved successfully',
  saveFailed: 'Save failed',
  opSuccess: 'Operation successful',
  opFailed: 'Operation failed',
  invalidParam: 'Invalid parameter: missing id',
  notFound: 'No matching record found',
  all: 'All',
} as const;

/** 路由拼装：module + 可选 action(create/edit/detail) + 可选 id。 */
function lpRoute(module: string, action?: string, id?: number): string {
  if (!action) return `${LP_BASE}/${module}`;
  const qs = id != null ? `?id=${id}` : '';
  return `${LP_BASE}/${module}/${action}${qs}`;
}

/** 解析 searchParams.id（>0 的有限数；否则 undefined）。 */
function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 时间戳/ISO → 统一管理台日期时间串（后端时间为 ms 时间戳 number；0=未设置 → '--'）。 */
function formatDateTime(
  value: number | string | null | undefined,
): string {
  if (!value) return '--';
  const n = typeof value === 'number' ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return formatAdminDateTime(d);
}

/**
 * 金额/比例展示：去掉无效尾零（最多 8 位小数）并加千分位分组
 * （对齐源 `views/approval/format.ts` formatMoney）。
 */
function formatAmount(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const [int, dec] = String(parseFloat(n.toFixed(8))).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}


/** 后端 datetime（ms 时间戳或 ISO）→ datetime-local 控件值 `YYYY-MM-DDTHH:mm`。 */
function toDatetimeLocal(
  value: number | string | null | undefined,
): string {
  if (!value) return '';
  const n = typeof value === 'number' ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${d.getMinutes()}`;
}

/** label map → 下拉选项（全量）。 */
function statusOptions(
  labelMap: Record<number, string>,
): SelectOption[] {
  return Object.entries(labelMap).map(([k, v]) => ({
    value: k,
    label: v,
  }));
}

/** label map → 筛选下拉选项（仅列源筛选项；对齐源各 index.vue 的 el-option 集合）。 */
function statusFilterOptions(
  labelMap: Record<number, string>,
  statuses: number[],
): SelectOption[] {
  return statuses.map((s) => ({
    value: String(s),
    label: labelMap[s] ?? `Status ${s}`,
  }));
}

/** LP 选项 → 下拉选项（对齐源 `lpName(lpCode)` 展示）。 */
function lpToOptions(list: LpOption[] | undefined): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.lpId),
    label: `${o.lpName}(${o.lpCode})`,
  }));
}

/** 货币对选项 → 下拉选项（source/target 展示）。 */
function pairToOptions(
  list: { pairId: number; sourceCurrency: string; targetCurrency: string }[] | undefined,
): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.pairId),
    label: `${o.sourceCurrency}/${o.targetCurrency}`,
  }));
}

/** 资金池选项 → 下拉选项（currency + 完整账户地址，对齐源 topup/lp-pair Dialog）。 */
function poolToOptions(
  list: LpPoolOption[] | undefined,
): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.poolId),
    label: `${o.currency}(${o.accountAddress})`,
  }));
}

/** 通用状态 Badge。 */
function StatusBadge({
  status,
  labelMap,
  variantMap,
}: {
  status: number;
  labelMap: Record<number, string>;
  variantMap: Record<number, BadgeVariant>;
}) {
  return (
    <Badge variant={variantMap[status] ?? 'outline'}>
      {labelMap[status] ?? `Status ${status}`}
    </Badge>
  );
}

/** 详情页只读字段。 */
function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">
        {value == null || value === '' ? '--' : value}
      </div>
    </div>
  );
}

/** 详情页外壳：返回 + 标题 + 内容卡。 */
function DetailShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {LBL.back}
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {children}
      </section>
    </div>
  );
}

function LoadingBlock() {
  return <div className="py-10 text-center text-sm text-muted-foreground">{LBL.loading}</div>;
}

function NotFoundBlock({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        {LBL.back}
      </Button>
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.notFound}
      </div>
    </div>
  );
}

/* ================================================================== */
/* lp-info — LP 主数据                                                  */
/* ================================================================== */

interface LpInfoFilter {
  lpName: string;
  lpCode: string;
  status: string;
}
const LP_INFO_EMPTY: LpInfoFilter = { lpName: '', lpCode: '', status: '' };

interface LpInfoParams {
  pageNum: number;
  lpName?: string;
  lpCode?: string;
  status?: number;
}

function lpInfoFormToParams(f: LpInfoFilter): LpInfoParams {
  const p: LpInfoParams = { pageNum: 1 };
  if (f.lpName.trim()) p.lpName = f.lpName.trim();
  if (f.lpCode.trim()) p.lpCode = f.lpCode.trim();
  if (f.status) p.status = Number(f.status);
  return p;
}

export function LpInfoListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<LpInfoFilter>({
    defaultValues: LP_INFO_EMPTY,
  });
  const [params, setParams] = React.useState<LpInfoParams>(() =>
    lpInfoFormToParams(LP_INFO_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data, isLoading } = useLpListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpName: params.lpName,
      lpCode: params.lpCode,
      status: params.status,
    },
  });
  const submitMutation = useSubmitLpOnboardMutation(PROJECT_ID);
  const freezeMutation = useLpFreezeToggleMutation(PROJECT_ID);
  const toast = useToast();

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const onSearch = React.useCallback(
    (f: LpInfoFilter) => setParams(lpInfoFormToParams(f)),
    [],
  );
  const onReset = React.useCallback(() => {
    reset(LP_INFO_EMPTY);
    setParams(lpInfoFormToParams(LP_INFO_EMPTY));
  }, [reset]);

  const onSubmitOnboard = React.useCallback(
    (row: LpRow) => {
      if (!window.confirm(`Confirm submitting the onboarding application for "${row.lpName}"?`)) return;
      submitMutation.mutate(row.lpId, {
        onSuccess: () => toast.success('Onboarding application submitted'),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [submitMutation, toast],
  );

  const onToggleFreeze = React.useCallback(
    (row: LpRow) => {
      const freeze = row.status === 20;
      if (
        !window.confirm(
          freeze
            ? `Confirm freezing LP "${row.lpName}"? Once frozen, the LP immediately stops matching, and its new settlement requests will be rejected.`
            : `Confirm unfreezing LP "${row.lpName}"? Once unfrozen, the LP is re-enabled and resumes matching.`,
        )
      )
        return;
      freezeMutation.mutate(
        { targetId: row.lpId, freeze },
        {
          onSuccess: () => toast.success(freeze ? 'Frozen' : 'Unfrozen'),
          onError: () => toast.error(LBL.opFailed),
        },
      );
    },
    [freezeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      { accessorKey: 'lpCode', header: 'LP Code' },
      {
        accessorKey: 'splitRatio',
        header: 'Split Ratio',
        cell: ({ row }) => <span>{formatAmount(row.original.splitRatio)}</span>,
      },
      {
        accessorKey: 'minLiquidity',
        header: 'Minimum Liquidity',
        cell: ({ row }) => <span>{formatAmount(row.original.minLiquidity)}</span>,
      },
      {
        accessorKey: 'riskAssessment',
        header: 'Risk Assessment',
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span>{row.original.riskAssessment || '--'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_STATUS_LABEL}
            variantMap={LP_STATUS_VARIANT}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      createActionColumn<LpRow & { id: string }>((item) => {
        const s = item.status;
        const editable = s === 1 || s === 15;
        // 原 Edit 按钮 s===20 时的 title 提示无 TableRowAction 对应字段，随迁移移除。
        const actions: TableRowAction<LpRow & { id: string }>[] = [
          {
            label: LBL.view,
            onClick: () => router.push(lpRoute('lp-info', 'detail', item.lpId)),
          },
          {
            label: LBL.edit,
            disabled: !editable || submitMutation.isPending,
            onClick: () => router.push(lpRoute('lp-info', 'edit', item.lpId)),
          },
          {
            label: 'Submit Onboarding Application',
            disabled: !editable || submitMutation.isPending,
            onClick: () => onSubmitOnboard(item),
          },
          {
            label: 'Freeze',
            disabled: s !== 20 || freezeMutation.isPending,
            onClick: () => onToggleFreeze(item),
          },
          {
            label: 'Unfreeze',
            disabled: s !== 50 || freezeMutation.isPending,
            onClick: () => onToggleFreeze(item),
          },
        ];
        return actions;
      }),
    ],
    [router, onSubmitOnboard, onToggleFreeze, submitMutation.isPending, freezeMutation.isPending],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.lpId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField name="lpName" label="LP Name" register={register('lpName')} />
          <FormField name="lpCode" label="LP Code" register={register('lpCode')} />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder={LBL.all}
            options={statusFilterOptions(LP_STATUS_LABEL, [1, 5, 10, 15, 20, 50])}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(lpRoute('lp-info', 'create'))}
          >
            {LBL.add}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage={LBL.empty}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1 }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

interface LpInfoFormValues {
  lpName: string;
  lpCode: string;
  splitRatio: string;
  minLiquidity: string;
  riskAssessment: string;
  initialPairIds: number[];
}

export function LpInfoFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const isEdit = lpId != null;

  const { data: detail } = useLpDetailQuery(PROJECT_ID, lpId);
  const { data: pairOptions } = useLpCurrencyPairOptionsQuery(PROJECT_ID);
  const saveMutation = useSaveLpMutation(PROJECT_ID);

  const { control, register, handleSubmit, reset, formState: { errors } } =
    useForm<LpInfoFormValues>({
      defaultValues: {
        lpName: '',
        lpCode: '',
        splitRatio: '',
        minLiquidity: '',
        riskAssessment: '',
        initialPairIds: [],
      },
    });

  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      lpName: detail.lpName ?? '',
      lpCode: detail.lpCode ?? '',
      splitRatio: detail.splitRatio != null ? String(detail.splitRatio) : '',
      minLiquidity:
        detail.minLiquidity != null ? String(detail.minLiquidity) : '',
      riskAssessment: detail.riskAssessment ?? '',
      initialPairIds: detail.initialPairIds ?? [],
    });
  }, [detail, isEdit, reset]);
  /** 仅“审核通过”的货币对可选（源 lp-dialog.vue loadOptions 中 status===20 过滤）。 */
  const selectablePairs = (pairOptions ?? []).filter((o) => o.status === 20);

  const onSubmit = handleSubmit((values) => {
    const req: LpSaveReq = {
      lpName: values.lpName.trim(),
      lpCode: values.lpCode.trim(),
      splitRatio: values.splitRatio,
      minLiquidity: values.minLiquidity,
      riskAssessment: values.riskAssessment || undefined,
      initialPairIds: values.initialPairIds,
    };
    if (isEdit && lpId) req.lpId = lpId;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Draft)');
        router.push(lpRoute('lp-info'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit LP' : 'Add LP'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP Name<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={64}
              {...register('lpName', {
                required: 'Please enter the LP name',
                validate: (v) => v.trim().length > 0 || 'Please enter the LP name',
              })}
            />
            {errors.lpName && (
              <p className="text-sm text-destructive" role="alert">
                {errors.lpName.message}
              </p>
            )}
            <label className="text-sm font-medium">
              LP Code<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={32}
              {...register('lpCode', {
                required: 'Please enter the LP code',
                validate: (v) => v.trim().length > 0 || 'Please enter the LP code',
              })}
            />
            {errors.lpCode && (
              <p className="text-sm text-destructive" role="alert">
                {errors.lpCode.message}
              </p>
            )}
            <label className="text-sm font-medium">
              Split Ratio (0-1, up to 4 decimal places)
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('splitRatio', {
                required: 'Please enter the split ratio',
                validate: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0 || n > 1)
                    return 'Ratio must be between 0 and 1';
                  const decimals = v.includes('.')
                    ? v.split('.')[1]?.length ?? 0
                    : 0;
                  return decimals <= 4 || 'Up to 4 decimal places';
                },
              })}
            />
            {errors.splitRatio && (
              <p className="text-sm text-destructive" role="alert">
                {errors.splitRatio.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Minimum Liquidity<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('minLiquidity', {
                required: 'Please enter the minimum liquidity',
                validate: (v) => Number(v) > 0 || 'Must be greater than 0',
              })}
            />
            {errors.minLiquidity && (
              <p className="text-sm text-destructive" role="alert">
                {errors.minLiquidity.message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-medium">Risk Assessment</label>
          <Textarea rows={3} {...register('riskAssessment')} />
        </div>
      </section>

      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4 text-sm font-semibold">Initial Currency Pairs</div>
        {selectablePairs.length ? (
          <Controller
            control={control}
            name="initialPairIds"
            render={({ field }) => (
              <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                  {selectablePairs.map((o) => {
                    const checked = (field.value ?? []).includes(o.pairId);
                    return (
                      <label
                        key={o.pairId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const cur = field.value ?? [];
                            field.onChange(
                              c
                                ? [...cur, o.pairId]
                                : cur.filter((id) => id !== o.pairId),
                            );
                          }}
                        />
                        {o.sourceCurrency}/{o.targetCurrency}
                      </label>
                    );
                  })}
                </div>
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No selectable currency pairs</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(lpRoute('lp-info'))}
          disabled={saveMutation.isPending}
        >
          {LBL.cancel}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? LBL.saving : LBL.save}
        </Button>
      </div>
    </form>
  );
}

export function LpInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const { data: detail, isLoading } = useLpDetailQuery(PROJECT_ID, lpId);
  const { data: pairOptions } = useLpCurrencyPairOptionsQuery(PROJECT_ID);

  if (!lpId) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  }
  if (isLoading) return <LoadingBlock />;
  if (!detail) return <NotFoundBlock onBack={() => router.push(lpRoute('lp-info'))} />;

  const pairNames = (detail.initialPairIds ?? [])
    .map((id) => {
      const o = pairOptions?.find((p) => p.pairId === id);
      return o ? `${o.sourceCurrency}/${o.targetCurrency}` : `#${id}`;
    })
    .join(', ');

  return (
    <DetailShell title="LP Details" onBack={() => router.push(lpRoute('lp-info'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP Name" value={detail.lpName} />
        <ReadonlyField label="LP Code" value={detail.lpCode} />
        <ReadonlyField label="Split Ratio" value={formatAmount(detail.splitRatio)} />
        <ReadonlyField label="Minimum Liquidity" value={formatAmount(detail.minLiquidity)} />
        <ReadonlyField
          label="Status"
          value={
            <StatusBadge
              status={detail.status}
              labelMap={LP_STATUS_LABEL}
              variantMap={LP_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="Created At" value={formatDateTime(detail.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="Risk Assessment" value={detail.riskAssessment} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="Initial Currency Pairs" value={pairNames || '--'} />
        </div>
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-pool — LP 资金池                                                  */
/* ================================================================== */

interface LpPoolFilter {
  lpId: string;
  currency: string;
  status: string;
}
const LP_POOL_EMPTY: LpPoolFilter = { lpId: '', currency: '', status: '' };

interface LpPoolParams {
  pageNum: number;
  lpId?: number;
  currency?: string;
  status?: number;
}

function lpPoolFormToParams(f: LpPoolFilter): LpPoolParams {
  const p: LpPoolParams = { pageNum: 1 };
  if (f.lpId) p.lpId = Number(f.lpId);
  if (f.currency.trim()) p.currency = f.currency.trim();
  if (f.status) p.status = Number(f.status);
  return p;
}

export function LpPoolListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<LpPoolFilter>({
    defaultValues: LP_POOL_EMPTY,
  });
  const [params, setParams] = React.useState<LpPoolParams>(() =>
    lpPoolFormToParams(LP_POOL_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { data: lpOptions } = useLpPoolLpOptionsQuery(PROJECT_ID);

  const { data, isLoading } = useLpPoolListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpId: params.lpId,
      currency: params.currency,
      status: params.status,
    },
  });
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const columns = React.useMemo<
    ColumnDef<LpPoolRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      { accessorKey: 'currency', header: 'Currency' },
      {
        accessorKey: 'accountAddress',
        header: 'Wallet Address',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.accountAddress || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'currencySystemType',
        header: 'Currency System',
        cell: ({ row }) => (
          <span>
            {CURRENCY_SYSTEM_TYPE_LABEL[row.original.currencySystemType] ??
              row.original.currencySystemType}
          </span>
        ),
      },
      {
        accessorKey: 'minLimit',
        header: 'Minimum Limit',
        cell: ({ row }) => <span>{formatAmount(row.original.minLimit)}</span>,
      },
      {
        accessorKey: 'remindThreshold',
        header: 'Reminder Threshold',
        cell: ({ row }) => (
          <span>{formatAmount(row.original.remindThreshold)}</span>
        ),
      },
      {
        accessorKey: 'availableBalanceCache',
        header: 'Available Balance',
        cell: ({ row }) => (
          <span>{formatAmount(row.original.availableBalanceCache)}</span>
        ),
      },
      {
        accessorKey: 'balanceUpdateTime',
        header: 'Balance Updated At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.balanceUpdateTime)}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_POOL_STATUS_LABEL}
            variantMap={LP_POOL_STATUS_VARIANT}
          />
        ),
      },
      createActionColumn<LpPoolRow & { id: string }>((item) => {
        const actions: TableRowAction<LpPoolRow & { id: string }>[] = [
          {
            label: LBL.view,
            onClick: () => {
              stashRow('lp-pool', item.poolId, item);
              router.push(lpRoute('lp-pool', 'detail', item.poolId));
            },
          },
          {
            label: LBL.edit,
            onClick: () => {
              stashRow('lp-pool', item.poolId, item);
              router.push(lpRoute('lp-pool', 'edit', item.poolId));
            },
          },
          {
            label: 'Pre-Authorization',
            disabled: item.status !== 20,
            onClick: () =>
              router.push(`${LP_BASE}/lp-preauth?poolId=${item.poolId}`),
          },
        ];
        return actions;
      }),
    ],
    [router],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.poolId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit((f) => setParams(lpPoolFormToParams(f)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormField name="currency" label="Currency" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder={LBL.all}
            options={statusFilterOptions(LP_POOL_STATUS_LABEL, [1, 20, 50])}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(LP_POOL_EMPTY);
              setParams(lpPoolFormToParams(LP_POOL_EMPTY));
            }}
          >
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(lpRoute('lp-pool', 'create'))}
          >
            {LBL.add}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage={LBL.empty}
          pagination={
            pagination
                ? {
                    page: pagination.page,
                    pageSize,
                    total: pagination.total,
                    onPageChange: (page) =>
                      setParams((prev) => ({ ...prev, pageNum: page })),
                    onPageSizeChange: (n) => {
                      setPageSize(n);
                      setParams((prev) => ({ ...prev, pageNum: 1 }));
                    },
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                  }
                : undefined
          }
        />
      </div>
    </div>
  );
}

interface LpPoolFormValues {
  lpId: string;
  currency: string;
  accountAddress: string;
  currencySystemType: string;
  minLimit: string;
  remindThreshold: string;
}

/** 编辑/详情回填：优先取列表跳转时 stash 的行；无 pool detail 端点，兜底扫首页 200 条。 */
function useLpPoolRowById(poolId: number | undefined) {
  const [stashed] = React.useState(() =>
    poolId != null ? peekRow<LpPoolRow>('lp-pool', poolId) : null,
  );
  const { data, isLoading } = useLpPoolListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    poolId != null && !stashed,
  );
  const row = stashed ?? data?.data.find((r) => r.poolId === poolId);
  return { row, isLoading: stashed ? false : isLoading };
}

export function LpPoolFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const poolId = parseId(searchParams.get('id'));
  const isEdit = poolId != null;
  const { data: lpOptions } = useLpPoolLpOptionsQuery(PROJECT_ID);
  const { row, isLoading } = useLpPoolRowById(poolId);
  const saveMutation = useSaveLpPoolMutation(PROJECT_ID);
  const { register, handleSubmit, reset, control, formState: { errors } } =
    useForm<LpPoolFormValues>({
    defaultValues: {
      lpId: '',
      currency: '',
      accountAddress: '',
      currencySystemType: '1',
      minLimit: '',
      remindThreshold: '',
    },
  });

  React.useEffect(() => {
    if (!isEdit || !row) return;
    reset({
      lpId: String(row.lpId),
      currency: row.currency,
      accountAddress: row.accountAddress,
      currencySystemType: String(row.currencySystemType),
      minLimit: row.minLimit != null ? String(row.minLimit) : '',
      remindThreshold:
        row.remindThreshold != null ? String(row.remindThreshold) : '',
    });
  }, [row, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!values.lpId) {
      toast.warning('Please select an LP');
      return;
    }
    if (!values.currencySystemType) {
      toast.warning('Please select a currency system');
      return;
    }
    const req: LpPoolSaveReq = {
      lpId: Number(values.lpId),
      currency: values.currency.trim(),
      accountAddress: values.accountAddress.trim(),
      currencySystemType: Number(values.currencySystemType),
      minLimit: values.minLimit,
      remindThreshold: values.remindThreshold,
    };
    if (isEdit && poolId) req.poolId = poolId;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Enabled)');
        router.push(lpRoute('lp-pool'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  if (isEdit && isLoading) return <LoadingBlock />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit Funding Pool' : 'Add Funding Pool'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={isEdit}
            placeholder="Select an LP"
            options={lpToOptions(lpOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Currency<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              disabled={isEdit}
              {...register('currency', {
                required: 'Please enter the currency',
                validate: (v) => v.trim().length > 0 || 'Please enter the currency',
              })}
            />
            {errors.currency && (
              <p className="text-sm text-destructive" role="alert">
                {errors.currency.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">
              Wallet Address<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={100}
              className="font-mono"
              {...register('accountAddress', {
                required: 'Please enter the wallet address',
                validate: (v) => v.trim().length > 0 || 'Please enter the wallet address',
              })}
            />
            {errors.accountAddress && (
              <p className="text-sm text-destructive" role="alert">
                {errors.accountAddress.message}
              </p>
            )}
          </div>
          <FormSelect
            name="currencySystemType"
            control={control}
            label="Currency System"
            required
            placeholder="Select a currency system"
            options={Object.entries(CURRENCY_SYSTEM_TYPE_LABEL).map(
              ([k, v]) => ({ value: k, label: v }),
            )}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Minimum Limit<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('minLimit', {
                required: 'Please enter the minimum limit',
                validate: (v) => Number(v) > 0 || 'Must be greater than 0',
              })}
            />
            {errors.minLimit && (
              <p className="text-sm text-destructive" role="alert">
                {errors.minLimit.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reminder Threshold (0-1, up to 4 decimal places)
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('remindThreshold', {
                required: 'Please enter the reminder threshold',
                validate: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0 || n > 1)
                    return 'Threshold must be between 0 and 1';
                  const decimals = v.includes('.')
                    ? v.split('.')[1]?.length ?? 0
                    : 0;
                  return decimals <= 4 || 'Up to 4 decimal places';
                },
              })}
            />
            {errors.remindThreshold && (
              <p className="text-sm text-destructive" role="alert">
                {errors.remindThreshold.message}
              </p>
            )}
          </div>
          </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(lpRoute('lp-pool'))}
          disabled={saveMutation.isPending}
        >
          {LBL.cancel}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? LBL.saving : LBL.save}
        </Button>
      </div>
    </form>
  );
}

export function LpPoolDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = parseId(searchParams.get('id'));
  const { row, isLoading } = useLpPoolRowById(poolId);

  if (!poolId)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  if (isLoading) return <LoadingBlock />;
  if (!row)
    return <NotFoundBlock onBack={() => router.push(lpRoute('lp-pool'))} />;

  return (
    <DetailShell title="Funding Pool Details" onBack={() => router.push(lpRoute('lp-pool'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP Name" value={row.lpName} />
        <ReadonlyField label="Currency" value={row.currency} />
        <ReadonlyField
          label="Currency System"
          value={CURRENCY_SYSTEM_TYPE_LABEL[row.currencySystemType]}
        />
        <ReadonlyField label="Minimum Limit" value={formatAmount(row.minLimit)} />
        <ReadonlyField label="Reminder Threshold" value={formatAmount(row.remindThreshold)} />
        <ReadonlyField
          label="Status"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_POOL_STATUS_LABEL}
              variantMap={LP_POOL_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="Available Balance" value={formatAmount(row.availableBalanceCache)} />
        <ReadonlyField label="Balance Updated At" value={formatDateTime(row.balanceUpdateTime)} />
        <ReadonlyField label="Created At" value={formatDateTime(row.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="Wallet Address" value={<span className="font-mono text-xs">{row.accountAddress}</span>} />
        </div>
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-preauth — LP 预授权                                               */
/* ================================================================== */

interface LpPreauthFilter {
  lpId: string;
  poolId: string;
  currency: string;
  status: string;
}

interface LpPreauthParams {
  pageNum: number;
  lpId?: number;
  poolId?: number;
  currency?: string;
  status?: number;
}

function lpPreauthFormToParams(f: LpPreauthFilter): LpPreauthParams {
  const p: LpPreauthParams = { pageNum: 1 };
  if (f.lpId) p.lpId = Number(f.lpId);
  if (f.poolId) p.poolId = Number(f.poolId);
  if (f.currency.trim()) p.currency = f.currency.trim();
  if (f.status) p.status = Number(f.status);
  return p;
}

export function LpPreauthListPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // 支持从资金池页跳入并预填 poolId/lpId（源中预授权按池管理）。
  const seedPoolId = parseId(searchParams.get('poolId'));
  const seedLpId = parseId(searchParams.get('lpId'));

  const initial: LpPreauthFilter = {
    lpId: seedLpId != null ? String(seedLpId) : '',
    poolId: seedPoolId != null ? String(seedPoolId) : '',
    currency: '',
    status: '',
  };

  const { register, handleSubmit, reset, control, watch } =
    useForm<LpPreauthFilter>({ defaultValues: initial });
  const [params, setParams] = React.useState<LpPreauthParams>(() =>
    lpPreauthFormToParams(initial),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data: lpOptions } = useLpPreauthLpOptionsQuery(PROJECT_ID);
  const watchLpId = watch('lpId');
  const lpIdForPools = watchLpId ? Number(watchLpId) : undefined;
  const { data: poolOptions } = useLpPreauthPoolOptionsQuery(
    PROJECT_ID,
    lpIdForPools,
  );

  const { data, isLoading } = useLpPreauthListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpId: params.lpId,
      poolId: params.poolId,
      currency: params.currency,
      status: params.status,
    },
  });

  const revokeMutation = useRevokeLpPreauthMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const onRevoke = React.useCallback(
    (row: LpPreauthRow) => {
      if (!window.confirm('Confirm revoking this pre-authorization? It becomes invalid immediately once revoked.')) return;
      revokeMutation.mutate(row.preauthId, {
        onSuccess: () => toast.success('Revoked'),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [revokeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPreauthRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      { accessorKey: 'currency', header: 'Currency' },
      {
        accessorKey: 'authAmount',
        header: 'Authorized Amount',
        cell: ({ row }) => <span>{formatAmount(row.original.authAmount)}</span>,
      },
      {
        accessorKey: 'usedAmount',
        header: 'Used Amount',
        cell: ({ row }) => <span>{formatAmount(row.original.usedAmount)}</span>,
      },
      {
        id: 'remaining',
        header: 'Remaining Amount',
        cell: ({ row }) => (
          <span>
            {formatAmount(
              Number(row.original.authAmount ?? 0) -
                Number(row.original.usedAmount ?? 0),
            )}
          </span>
        ),
      },
      {
        accessorKey: 'validFrom',
        header: 'Valid From',
        cell: ({ row }) => <span>{formatDateTime(row.original.validFrom)}</span>,
      },
      {
        accessorKey: 'validTo',
        header: 'Valid To',
        cell: ({ row }) => <span>{formatDateTime(row.original.validTo)}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_PREAUTH_STATUS_LABEL}
            variantMap={LP_PREAUTH_STATUS_VARIANT}
          />
        ),
      },
      createActionColumn<LpPreauthRow & { id: string }>((item) => {
        const actions: TableRowAction<LpPreauthRow & { id: string }>[] = [
          {
            label: LBL.view,
            onClick: () => {
              stashRow('lp-preauth', item.preauthId, item);
              router.push(lpRoute('lp-preauth', 'detail', item.preauthId));
            },
          },
          {
            label: LBL.edit,
            onClick: () =>
              router.push(
                lpRoute('lp-preauth', 'edit', item.preauthId) +
                  `&lpId=${item.lpId}`,
              ),
          },
          {
            label: 'Revoke',
            destructive: true,
            disabled: item.status !== 20 || revokeMutation.isPending,
            onClick: () => onRevoke(item),
          },
        ];
        return actions;
      }),
    ],
    [router, onRevoke, revokeMutation.isPending],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.preauthId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit((f) => setParams(lpPreauthFormToParams(f)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="poolId"
            control={control}
            label="Funding Pool"
            placeholder={LBL.all}
            options={poolToOptions(poolOptions)}
          />
          <FormField name="currency" label="Currency" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder={LBL.all}
            options={statusOptions(LP_PREAUTH_STATUS_LABEL)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset({ lpId: '', poolId: '', currency: '', status: '' });
              setParams(lpPreauthFormToParams({ lpId: '', poolId: '', currency: '', status: '' }));
            }}
          >
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const qs = [
                seedLpId != null ? `lpId=${seedLpId}` : '',
                seedPoolId != null ? `poolId=${seedPoolId}` : '',
              ]
                .filter(Boolean)
                .join('&');
              router.push(
                qs
                  ? `${lpRoute('lp-preauth', 'create')}?${qs}`
                  : lpRoute('lp-preauth', 'create'),
              );
            }}
          >
            {LBL.add}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage={LBL.empty}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1 }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

interface LpPreauthFormValues {
  lpId: string;
  poolId: string;
  authAmount: string;
  validFrom: string;
  validTo: string;
  authCredential: string;
  authCsTxId: string;
}

/** 编辑/详情回填：优先取列表跳转时 stash 的行；无 preauth detail 端点，兜底扫首页 200 条。 */
function useLpPreauthRowById(preauthId: number | undefined) {
  const [stashed] = React.useState(() =>
    preauthId != null ? peekRow<LpPreauthRow>('lp-preauth', preauthId) : null,
  );
  const { data, isLoading } = useLpPreauthListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    preauthId != null && !stashed,
  );
  const row = stashed ?? data?.data.find((r) => r.preauthId === preauthId);
  return { row, isLoading: stashed ? false : isLoading };
}

export function LpPreauthFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const preauthId = parseId(searchParams.get('id'));
  const isEdit = preauthId != null;
  // 支持从资金池上下文带入 lpId/poolId 预填（新增场景）。
  const seedLpId = parseId(searchParams.get('lpId'));
  const seedPoolId = parseId(searchParams.get('poolId'));

  const { data: lpOptions } = useLpPreauthLpOptionsQuery(PROJECT_ID);
  const { row, isLoading } = useLpPreauthRowById(preauthId);
  const saveMutation = useSaveLpPreauthMutation(PROJECT_ID);

  const { register, handleSubmit, reset, control, watch, setValue, getValues, formState: { errors } } =
    useForm<LpPreauthFormValues>({
      defaultValues: {
        lpId: seedLpId != null ? String(seedLpId) : '',
        poolId: seedPoolId != null ? String(seedPoolId) : '',
        authAmount: '',
        validFrom: '',
        validTo: '',
        authCredential: '',
        authCsTxId: '',
      },
    });

  const watchLpId = watch('lpId');
  const lpIdForPools = watchLpId ? Number(watchLpId) : undefined;
  const { data: poolOptions } = useLpPreauthPoolOptionsQuery(
    PROJECT_ID,
    lpIdForPools,
  );

  // LP 变更时重置 poolId（池与 LP 强绑定）。跳过 mount 初值与编辑回填触发的变更，
  // 避免清掉 seed/backfill 预填的 poolId。
  const skipClearPoolRef = React.useRef(true);
  const backfillLpIdRef = React.useRef<number | null>(
    seedLpId != null ? seedLpId : null,
  );
  React.useEffect(() => {
    if (skipClearPoolRef.current) {
      skipClearPoolRef.current = false;
      return;
    }
    const currentLpId = watchLpId ? Number(watchLpId) : undefined;
    if (isEdit && currentLpId != null && currentLpId === backfillLpIdRef.current)
      return;
    setValue('poolId', '');
  }, [watchLpId, setValue, isEdit]);

  React.useEffect(() => {
    if (!isEdit || !row) return;
    backfillLpIdRef.current = row.lpId;
    reset({
      lpId: String(row.lpId),
      poolId: String(row.poolId),
      authAmount: row.authAmount != null ? String(row.authAmount) : '',
      validFrom: toDatetimeLocal(row.validFrom),
      validTo: toDatetimeLocal(row.validTo),
      authCredential: row.authCredential ?? '',
      authCsTxId: row.authCsTxId ?? '',
    });
  }, [row, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!values.lpId) {
      toast.warning('Please select an LP');
      return;
    }
    if (!values.poolId) {
      toast.warning('Please select a funding pool');
      return;
    }
    if (!values.validFrom || !values.validTo) return;
    const req: LpPreauthSaveReq = {
      lpId: Number(values.lpId),
      poolId: Number(values.poolId),
      authAmount: values.authAmount,
      validFrom: new Date(values.validFrom).getTime(),
      validTo: new Date(values.validTo).getTime(),
      authCredential: values.authCredential || undefined,
      authCsTxId: values.authCsTxId || undefined,
    };
    if (isEdit && preauthId) req.preauthId = preauthId;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Effective)');
        router.push(lpRoute('lp-preauth'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  if (isEdit && isLoading) return <LoadingBlock />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit Pre-Authorization' : 'Add Pre-Authorization'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={isEdit}
            placeholder="Select an LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="poolId"
            control={control}
            label="Funding Pool"
            required
            disabled={isEdit || !lpIdForPools}
            placeholder={lpIdForPools ? 'Select a funding pool' : 'Select an LP first'}
            options={poolToOptions(poolOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Authorized Amount<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('authAmount', {
                required: 'Please enter the authorized amount',
                validate: (v) => Number(v) > 0 || 'Must be greater than 0',
              })}
            />
            {errors.authAmount && (
              <p className="text-sm text-destructive" role="alert">
                {errors.authAmount.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Valid From<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('validFrom', { required: 'Please select the valid-from time' })}
            />
            {errors.validFrom && (
              <p className="text-sm text-destructive" role="alert">
                {errors.validFrom.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Valid To<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('validTo', {
                required: 'Please select the valid-to time',
                validate: (v) => {
                  const from = getValues('validFrom');
                  if (!v || !from) return true;
                  return (
                    new Date(v).getTime() > new Date(from).getTime() ||
                    'Valid-to time must be later than valid-from time'
                  );
                },
              })}
            />
            {errors.validTo && (
              <p className="text-sm text-destructive" role="alert">
                {errors.validTo.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Authorization Credential</label>
            <Input {...register('authCredential')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">On-Chain Authorization Transaction ID</label>
            <Input {...register('authCsTxId')} />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(lpRoute('lp-preauth'))}
          disabled={saveMutation.isPending}
        >
          {LBL.cancel}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? LBL.saving : LBL.save}
        </Button>
      </div>
    </form>
  );
}

export function LpPreauthDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preauthId = parseId(searchParams.get('id'));
  const { row, isLoading } = useLpPreauthRowById(preauthId);

  if (!preauthId)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  if (isLoading) return <LoadingBlock />;
  if (!row)
    return (
      <NotFoundBlock onBack={() => router.push(lpRoute('lp-preauth'))} />
    );

  return (
    <DetailShell
      title="Pre-Authorization Details"
      onBack={() => router.push(lpRoute('lp-preauth'))}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP Name" value={row.lpName} />
        <ReadonlyField label="Currency" value={row.currency} />
        <ReadonlyField label="Funding Pool ID" value={row.poolId} />
        <ReadonlyField label="Authorized Amount" value={formatAmount(row.authAmount)} />
        <ReadonlyField label="Used Amount" value={formatAmount(row.usedAmount)} />
        <ReadonlyField
          label="Remaining Amount"
          value={formatAmount(
            Number(row.authAmount ?? 0) - Number(row.usedAmount ?? 0),
          )}
        />
        <ReadonlyField label="Valid From" value={formatDateTime(row.validFrom)} />
        <ReadonlyField label="Valid To" value={formatDateTime(row.validTo)} />
        <ReadonlyField
          label="Status"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_PREAUTH_STATUS_LABEL}
              variantMap={LP_PREAUTH_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="Authorization Credential" value={row.authCredential} />
        <ReadonlyField label="On-Chain Authorization Transaction ID" value={row.authCsTxId} />
        <ReadonlyField label="Created At" value={formatDateTime(row.createTime)} />
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-currency-pair — LP 参与货币对（源 lp-pair，无独立路由，增改走页内 Dialog） */
/* ================================================================== */

interface LpPairFilter {
  lpId: string;
  pairId: string;
  status: string;
}
const LP_PAIR_EMPTY: LpPairFilter = { lpId: '', pairId: '', status: '' };

interface LpPairParams {
  pageNum: number;
  lpId?: number;
  pairId?: number;
  status?: number;
}

/**
 * DataTable 要求 `{ id: string }`，而 LpPairRow 的主键 id 为 number。
 * 列表展示用 LpPairTableRow（id 转字符串），操作回调经 toLpPairRow 还原为 LpPairRow。
 */
type LpPairTableRow = Omit<LpPairRow, 'id'> & { id: string };

function lpPairFormToParams(f: LpPairFilter): LpPairParams {
  const p: LpPairParams = { pageNum: 1 };
  if (f.lpId) p.lpId = Number(f.lpId);
  if (f.pairId) p.pairId = Number(f.pairId);
  if (f.status) p.status = Number(f.status);
  return p;
}

interface LpPairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: LpPairRow | null;
}

function LpPairFormDialog({ open, onOpenChange, editing }: LpPairDialogProps) {
  const toast = useToast();
  const { data: lpOptions } = useLpPairLpOptionsQuery(PROJECT_ID);
  const { data: pairOptions } = useLpPairCurrencyPairOptionsQuery(PROJECT_ID);
  const saveMutation = useSaveLpPairMutation(PROJECT_ID);

  const { control, register, handleSubmit, reset } = useForm<{
    lpId: string;
    pairId: string;
    remark: string;
  }>({ defaultValues: { lpId: '', pairId: '', remark: '' } });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        lpId: String(editing.lpId),
        pairId: String(editing.pairId),
        remark: editing.remark ?? '',
      });
    } else {
      reset({ lpId: '', pairId: '', remark: '' });
    }
  }, [open, editing, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!values.lpId) {
      toast.warning('Please select an LP');
      return;
    }
    if (!values.pairId) {
      toast.warning('Please select a currency pair');
      return;
    }
    const req: LpPairSaveReq = {
      lpId: Number(values.lpId),
      pairId: Number(values.pairId),
      remark: values.remark || undefined,
    };
    if (editing) req.id = editing.id;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(editing ? 'Saved' : 'Created (Draft)');
        onOpenChange(false);
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Currency Pair Participation' : 'Add Currency Pair Participation'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={!!editing}
            placeholder="Select an LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="pairId"
            control={control}
            label="Currency Pair"
            required
            disabled={!!editing}
            placeholder="Select a currency pair"
            options={pairToOptions(pairOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Remark</label>
            <Textarea rows={3} {...register('remark')} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              {LBL.cancel}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? LBL.saving : LBL.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LpCurrencyPairListPage() {
  const router = useRouter();
  const toast = useToast();
  const { handleSubmit, reset, control } = useForm<LpPairFilter>({
    defaultValues: LP_PAIR_EMPTY,
  });
  const toLpPairRow = (r: LpPairTableRow): LpPairRow => ({ ...r, id: Number(r.id) });
  const [params, setParams] = React.useState<LpPairParams>(() =>
    lpPairFormToParams(LP_PAIR_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<LpPairRow | null>(null);

  const { data: lpOptions } = useLpPairLpOptionsQuery(PROJECT_ID);
  const { data: pairOptions } = useLpPairCurrencyPairOptionsQuery(PROJECT_ID);

  const { data } = useLpPairListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpId: params.lpId,
      pairId: params.pairId,
      status: params.status,
    },
  });
  const submitMutation = useSubmitLpPairMutation(PROJECT_ID);
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const removeMutation = useRemoveLpPairMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const openCreate = React.useCallback(() => {
    setEditingRow(null);
    setDialogOpen(true);
  }, []);
  const openEdit = React.useCallback((row: LpPairRow) => {
    setEditingRow(row);
    setDialogOpen(true);
  }, []);

  const onSubmit = React.useCallback(
    (row: LpPairRow) => {
      if (!window.confirm('Confirm submitting this record for approval?')) return;
      submitMutation.mutate(row.id, {
        onSuccess: () => toast.success('Submitted for approval'),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [submitMutation, toast],
  );

  const onToggle = React.useCallback(
    (row: LpPairRow, target: number) => {
      const stopping = target === LP_PAIR_TARGET_STATUS.disable;
      if (
        !window.confirm(
          stopping
            ? 'Confirm disabling this LP currency pair participation? It takes effect immediately.'
            : 'Confirm restoring this LP currency pair participation? It must be resubmitted for approval after restoration.',
        )
      )
        return;
      statusMutation.mutate(
        { id: row.id, targetStatus: target },
        {
          onSuccess: () => toast.success(stopping ? 'Disabled' : 'Restored to Draft'),
          onError: () => toast.error(LBL.opFailed),
        },
      );
    },
    [statusMutation, toast],
  );

  const onRemove = React.useCallback(
    (row: LpPairRow) => {
      if (!window.confirm('Confirm removing this LP currency pair participation record? This cannot be undone.')) return;
      removeMutation.mutate(row.id, {
        onSuccess: () => toast.success('Removed'),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [removeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPairTableRow>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      {
        id: 'pair',
        header: 'Currency Pair',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_PAIR_STATUS_LABEL}
            variantMap={LP_PAIR_STATUS_VARIANT}
          />
        ),
      },
      {
        accessorKey: 'approvalRecordId',
        header: 'Approval Record',
        cell: ({ row }) => (
          <span>{row.original.approvalRecordId || '--'}</span>
        ),
      },
      {
        accessorKey: 'remark',
        header: 'Remark',
        cell: ({ row }) => (
          <span>{row.original.remark || '--'}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      createActionColumn<LpPairTableRow>((item) => {
        const s = item.status;
        const editable = s === 1 || s === 15;
        const actions: TableRowAction<LpPairTableRow>[] = [
          {
            label: LBL.view,
            onClick: () => {
              stashRow('lp-pair', Number(item.id), toLpPairRow(item));
              router.push(
                lpRoute('lp-currency-pair', 'detail', Number(item.id)),
              );
            },
          },
          {
            label: LBL.edit,
            disabled: !editable,
            onClick: () => openEdit(toLpPairRow(item)),
          },
          {
            label: 'Submit for Approval',
            disabled: !editable,
            onClick: () => onSubmit(toLpPairRow(item)),
          },
          {
            label: 'Disable',
            disabled: s !== 20,
            onClick: () =>
              onToggle(toLpPairRow(item), LP_PAIR_TARGET_STATUS.disable),
          },
          {
            label: 'Restore to Draft',
            disabled: s !== 50,
            onClick: () =>
              onToggle(toLpPairRow(item), LP_PAIR_TARGET_STATUS.restore),
          },
          {
            label: 'Remove',
            destructive: true,
            disabled: !editable,
            onClick: () => onRemove(toLpPairRow(item)),
          },
        ];
        return actions;
      }),
    ],
    [router, openEdit, onSubmit, onToggle, onRemove],
  );

  const tableData = React.useMemo<LpPairTableRow[]>(
    () => rows.map((r) => ({ ...r, id: String(r.id) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit((f) => setParams(lpPairFormToParams(f)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="pairId"
            control={control}
            label="Currency Pair"
            placeholder={LBL.all}
            options={pairToOptions(pairOptions)}
          />
          <FormSelect
            name="status"
            control={control}
            options={statusFilterOptions(
              LP_PAIR_STATUS_LABEL,
              [1, 3, 5, 10, 15, 20, 50],
            )}
            label="Status"
            placeholder={LBL.all}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(LP_PAIR_EMPTY);
              setParams(lpPairFormToParams(LP_PAIR_EMPTY));
            }}
          >
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button type="button" size="sm" onClick={openCreate}>
            {LBL.add}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1 }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>

      <LpPairFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingRow}
      />
    </div>
  );
}

export function LpCurrencyPairDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseId(searchParams.get('id'));
  const [stashed] = React.useState(() =>
    id != null ? peekRow<LpPairRow>('lp-pair', id) : null,
  );
  const { data, isLoading } = useLpPairListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    id != null && !stashed,
  );
  const row = stashed ?? data?.data.find((r) => r.id === id);

  if (!id)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  if (isLoading) return <LoadingBlock />;
  if (!row)
    return (
      <NotFoundBlock
        onBack={() => router.push(lpRoute('lp-currency-pair'))}
      />
    );

  return (
    <DetailShell
      title="Currency Pair Participation Details"
      onBack={() => router.push(lpRoute('lp-currency-pair'))}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP Name" value={row.lpName} />
        <ReadonlyField
          label="Currency Pair"
          value={`${row.sourceCurrency}/${row.targetCurrency}`}
        />
        <ReadonlyField
          label="Status"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_PAIR_STATUS_LABEL}
              variantMap={LP_PAIR_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="Remark" value={row.remark} />
        <ReadonlyField label="Created At" value={formatDateTime(row.createTime)} />
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-topup — LP 补资记录（无 create 路由，声明补资走页内 Dialog）       */
/* ================================================================== */

interface LpTopupFilter {
  lpId: string;
  currency: string;
  status: string;
}
const LP_TOPUP_EMPTY: LpTopupFilter = { lpId: '', currency: '', status: '' };

interface LpTopupParams {
  pageNum: number;
  lpId?: number;
  currency?: string;
  status?: number;
}

function lpTopupFormToParams(f: LpTopupFilter): LpTopupParams {
  const p: LpTopupParams = { pageNum: 1 };
  if (f.lpId) p.lpId = Number(f.lpId);
  if (f.currency.trim()) p.currency = f.currency.trim();
  if (f.status) p.status = Number(f.status);
  return p;
}

interface LpTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LpTopupDeclareDialog({ open, onOpenChange }: LpTopupDialogProps) {
  const toast = useToast();
  const { data: lpOptions } = useLpTopupLpOptionsQuery(PROJECT_ID);
  const saveMutation = useSaveLpTopupMutation(PROJECT_ID);

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<{
    lpId: string;
    poolId: string;
    amount: string;
    transferInAddress: string;
  }>({ defaultValues: { lpId: '', poolId: '', amount: '', transferInAddress: '' } });

  const watchLpId = watch('lpId');
  const lpIdForPools = watchLpId ? Number(watchLpId) : undefined;
  const { data: poolOptions } = useLpTopupPoolOptionsQuery(
    PROJECT_ID,
    lpIdForPools,
  );

  // LP 变更时重置 poolId（池与 LP 强绑定；源 topup-dialog 联动逻辑）。
  React.useEffect(() => {
    setValue('poolId', '');
  }, [watchLpId, setValue]);

  React.useEffect(() => {
    if (!open) reset({ lpId: '', poolId: '', amount: '', transferInAddress: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!values.lpId) {
      toast.warning('Please select an LP');
      return;
    }
    if (!values.poolId) {
      toast.warning('Please select a funding pool');
      return;
    }
    const addr = values.transferInAddress.trim();
    const req: LpTopupSaveReq = {
      lpId: Number(values.lpId),
      poolId: Number(values.poolId),
      amount: values.amount,
      ...(addr ? { transferInAddress: addr } : {}),
    };
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success('Top-up declaration submitted');
        onOpenChange(false);
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Declare Top-Up</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            placeholder="Select an LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="poolId"
            control={control}
            label="Funding Pool"
            required
            disabled={!lpIdForPools}
            placeholder={lpIdForPools ? 'Select a funding pool' : 'Select an LP first'}
            options={poolToOptions(poolOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Top-Up Amount<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('amount', {
                required: 'Please enter the top-up amount',
                validate: (v) => Number(v) > 0 || 'Must be greater than 0',
              })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive" role="alert">
                {errors.amount.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Transfer-In Address</label>
            <Input
              className="font-mono"
              placeholder="Leave blank to use the funding pool account address"
              {...register('transferInAddress')}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              {LBL.cancel}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? LBL.saving : 'Submit Declaration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LpTopupListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<LpTopupFilter>({
    defaultValues: LP_TOPUP_EMPTY,
  });
  const [params, setParams] = React.useState<LpTopupParams>(() =>
    lpTopupFormToParams(LP_TOPUP_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: lpOptions } = useLpTopupLpOptionsQuery(PROJECT_ID);

  const { data, isLoading } = useLpTopupListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpId: params.lpId,
      currency: params.currency,
      status: params.status,
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const columns = React.useMemo<
    ColumnDef<LpTopupRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      { accessorKey: 'currency', header: 'Currency' },
      {
        accessorKey: 'amount',
        header: 'Top-Up Amount',
        cell: ({ row }) => <span>{formatAmount(row.original.amount)}</span>,
      },
      {
        accessorKey: 'transferInAddress',
        header: 'Transfer-In Address',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.transferInAddress || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'declareTime',
        header: 'Declared At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.declareTime)}</span>
        ),
      },
      {
        accessorKey: 'confirmTime',
        header: 'Credited At',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.confirmTime)}</span>
        ),
      },
      {
        accessorKey: 'csTxId',
        header: 'On-Chain Transaction ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.csTxId || '--'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_TOPUP_STATUS_LABEL}
            variantMap={LP_TOPUP_STATUS_VARIANT}
          />
        ),
      },
      createActionColumn<LpTopupRow & { id: string }>((item) => {
        const actions: TableRowAction<LpTopupRow & { id: string }>[] = [
          {
            label: LBL.view,
            onClick: () => {
              stashRow('lp-topup', item.topupId, item);
              router.push(lpRoute('lp-topup', 'detail', item.topupId));
            },
          },
        ];
        return actions;
      }),
    ],
    [router],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.topupId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit((f) => setParams(lpTopupFormToParams(f)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormField name="currency" label="Currency" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder={LBL.all}
            options={statusOptions(LP_TOPUP_STATUS_LABEL)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(LP_TOPUP_EMPTY);
              setParams(lpTopupFormToParams(LP_TOPUP_EMPTY));
            }}
          >
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            Declare Top-Up
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage={LBL.empty}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1 }));
                  },
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                }
              : undefined
          }
        />
      </div>

      <LpTopupDeclareDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export function LpTopupDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topupId = parseId(searchParams.get('id'));
  const [stashed] = React.useState(() =>
    topupId != null ? peekRow<LpTopupRow>('lp-topup', topupId) : null,
  );
  const { data, isLoading } = useLpTopupListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    topupId != null && !stashed,
  );
  const row = stashed ?? data?.data.find((r) => r.topupId === topupId);

  if (!topupId)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  if (isLoading) return <LoadingBlock />;
  if (!row)
    return <NotFoundBlock onBack={() => router.push(lpRoute('lp-topup'))} />;

  return (
    <DetailShell title="Top-Up Record Details" onBack={() => router.push(lpRoute('lp-topup'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP Name" value={row.lpName} />
        <ReadonlyField label="Currency" value={row.currency} />
        <ReadonlyField label="Funding Pool ID" value={row.poolId} />
        <ReadonlyField label="Top-Up Amount" value={formatAmount(row.amount)} />
        <ReadonlyField label="Declared At" value={formatDateTime(row.declareTime)} />
        <ReadonlyField label="Credited At" value={formatDateTime(row.confirmTime)} />
        <ReadonlyField
          label="Status"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_TOPUP_STATUS_LABEL}
              variantMap={LP_TOPUP_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="On-Chain Transaction ID" value={row.csTxId} />
        <ReadonlyField label="Created At" value={formatDateTime(row.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField
            label="Transfer-In Address"
            value={<span className="font-mono text-xs">{row.transferInAddress}</span>}
          />
        </div>
      </div>
    </DetailShell>
  );
}
