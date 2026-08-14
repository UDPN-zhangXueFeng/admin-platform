'use client';

/**
 * LP / 流动性业务组页面（源 `kissen-admin-frontend-main/src/views/liquidity` + `views/onboard`）。
 *
 * 路由组 `lp-liquidity`，子模块：lp-info / lp-pool / lp-preauth / lp-currency-pair / lp-topup /
 * lp-water-level（无源码 → 保留 mock）。
 *
 * 关键迁移决策（CONVENTIONS）：
 *  - message key 未在 kissen-admin messages 中注册，全部中文硬编码，避免 MISSING_MESSAGE 崩溃。
 *  - 列表筛选 text → FormField(register)；下拉 → FormSelect(control)；datetime 用原生
 *    `<input type="datetime-local">`（共享 UI 仅 FormDatePicker 日期粒度，预授权需时分）。
 *  - LP 入网/冻结/解冻、货币对状态变更、预授权撤销均为源内确认即生效（window.confirm）。
 *  - 无独立 detail 接口的域（pool/pair/preauth/topup），编辑回填与详情按主键扫首页 200 条定位
 *    （源这些对象 view/编辑均在弹窗内 backfill 整行；route 化后仅传 id，无 detail 端点可用）。
 *  - lp-currency-pair 在源中无独立路由（增删改查均在弹窗），目标无 create/edit 路由 → 增改用
 *    页内 Dialog；查看走 detail 路由。lp-topup 声明补资同理用页内 Dialog。
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
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  MockListPage,
  Textarea,
  useToast,
  type MockColumn,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

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
const PAGE_SIZE = 10;
const LP_BASE = '/lp-liquidity';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const LBL = {
  query: '查询',
  reset: '重置',
  records: '记录列表',
  empty: '暂无数据',
  loading: '加载中…',
  add: '新增',
  view: '查看',
  edit: '编辑',
  cancel: '取消',
  save: '保存',
  saving: '保存中…',
  back: '返回',
  saveSuccess: '保存成功',
  saveFailed: '保存失败',
  opSuccess: '操作成功',
  opFailed: '操作失败',
  invalidParam: '参数错误：缺少 id',
  notFound: '未找到对应记录',
  all: '全部',
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

/** 时间戳/ISO → 本地化日期时间串（后端时间为 ms 时间戳 number）。 */
function formatDateTime(
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') return '--';
  const n = typeof value === 'number' ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('zh-CN', { hour12: false });
}

/** 金额/比例展示：去掉无效尾零，最多 8 位小数。 */
function formatAmount(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return String(parseFloat(n.toFixed(8)));
}


/** 后端 datetime（ms 时间戳或 ISO）→ datetime-local 控件值 `YYYY-MM-DDTHH:mm`。 */
function toDatetimeLocal(
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** label map → 下拉选项（状态筛选用）。 */
function statusOptions(
  labelMap: Record<number, string>,
): SelectOption[] {
  return Object.entries(labelMap).map(([k, v]) => ({
    value: k,
    label: v,
  }));
}

/** LP 选项 → 下拉选项。 */
function lpToOptions(list: LpOption[] | undefined): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.lpId),
    label: o.lpName,
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

/** 资金池选项 → 下拉选项（currency 展示）。 */
function poolToOptions(
  list: LpPoolOption[] | undefined,
): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.poolId),
    label: `${o.currency} · ${o.accountAddress.slice(0, 10)}…`,
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
      {labelMap[status] ?? `状态 ${status}`}
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
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
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
  pageSize: number;
  lpName?: string;
  lpCode?: string;
  status?: number;
}

function lpInfoFormToParams(f: LpInfoFilter): LpInfoParams {
  const p: LpInfoParams = { pageNum: 1, pageSize: PAGE_SIZE };
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

  const { data, isLoading } = useLpListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
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
      if (!window.confirm(`确认提交 LP「${row.lpName}」入网申请?`)) return;
      submitMutation.mutate(row.lpId, {
        onSuccess: () => toast.success('已提交入网申请'),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [submitMutation, toast],
  );

  const onToggleFreeze = React.useCallback(
    (row: LpRow) => {
      const freeze = row.status === 20;
      if (!window.confirm(`确认${freeze ? '冻结' : '解冻'} LP「${row.lpName}」?`))
        return;
      freezeMutation.mutate(
        { targetId: row.lpId, freeze },
        {
          onSuccess: () => toast.success(LBL.opSuccess),
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
      { accessorKey: 'lpName', header: 'LP 名称' },
      { accessorKey: 'lpCode', header: 'LP 编码' },
      {
        accessorKey: 'splitRatio',
        header: '分润比例',
        cell: ({ row }) => <span>{formatAmount(row.original.splitRatio)}</span>,
      },
      {
        accessorKey: 'minLiquidity',
        header: '最低流动性',
        cell: ({ row }) => <span>{formatAmount(row.original.minLiquidity)}</span>,
      },
      {
        accessorKey: 'riskAssessment',
        header: '风险评级',
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[200px]">
            {row.original.riskAssessment || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
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
        header: '创建时间',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const s = row.original.status;
          const editable = s === 1 || s === 15;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(lpRoute('lp-info', 'detail', row.original.lpId))
                }
              >
                {LBL.view}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={!editable || submitMutation.isPending}
                onClick={() =>
                  router.push(lpRoute('lp-info', 'edit', row.original.lpId))
                }
              >
                {LBL.edit}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={!editable || submitMutation.isPending}
                onClick={() => onSubmitOnboard(row.original)}
              >
                提交入驻
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={s !== 20 || freezeMutation.isPending}
                onClick={() => onToggleFreeze(row.original)}
              >
                冻结
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={s !== 50 || freezeMutation.isPending}
                onClick={() => onToggleFreeze(row.original)}
              >
                解冻
              </Button>
            </div>
          );
        },
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField name="lpName" label="LP 名称" register={register('lpName')} />
          <FormField name="lpCode" label="LP 编码" register={register('lpCode')} />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder={LBL.all}
            options={statusOptions(LP_STATUS_LABEL)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {LBL.reset}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
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
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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

  const { control, register, handleSubmit, reset } =
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
        toast.success(LBL.saveSuccess);
        router.push(lpRoute('lp-info'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? '编辑 LP' : '新增 LP'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP 名称<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={64}
              {...register('lpName', {
                required: '请输入 LP 名称',
                validate: (v) => v.trim().length > 0 || '请输入 LP 名称',
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP 编码<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={32}
              {...register('lpCode', {
                required: '请输入 LP 编码',
                validate: (v) => v.trim().length > 0 || '请输入 LP 编码',
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              分润比例（0-1，4 位小数）
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('splitRatio', {
                required: '请输入分润比例',
                validate: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0 || n > 1)
                    return '比例需在 0-1 之间';
                  const decimals = v.includes('.')
                    ? v.split('.')[1]?.length ?? 0
                    : 0;
                  return decimals <= 4 || '最多 4 位小数';
                },
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              最低流动性<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('minLiquidity', {
                required: '请输入最低流动性',
                validate: (v) => Number(v) > 0 || '需大于 0',
              })}
            />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-medium">风险评级</label>
          <Textarea rows={3} {...register('riskAssessment')} />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">初始参与货币对</div>
        {pairOptions?.length ? (
          <Controller
            control={control}
            name="initialPairIds"
            render={({ field }) => (
              <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pairOptions.map((o) => {
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
              </div>
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">暂无可选货币对</p>
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
    .join('、');

  return (
    <DetailShell title="LP 详情" onBack={() => router.push(lpRoute('lp-info'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP 名称" value={detail.lpName} />
        <ReadonlyField label="LP 编码" value={detail.lpCode} />
        <ReadonlyField label="分润比例" value={formatAmount(detail.splitRatio)} />
        <ReadonlyField label="最低流动性" value={formatAmount(detail.minLiquidity)} />
        <ReadonlyField
          label="状态"
          value={
            <StatusBadge
              status={detail.status}
              labelMap={LP_STATUS_LABEL}
              variantMap={LP_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="创建时间" value={formatDateTime(detail.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="风险评级" value={detail.riskAssessment} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="初始参与货币对" value={pairNames || '--'} />
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
  pageSize: number;
  lpId?: number;
  currency?: string;
  status?: number;
}

function lpPoolFormToParams(f: LpPoolFilter): LpPoolParams {
  const p: LpPoolParams = { pageNum: 1, pageSize: PAGE_SIZE };
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
  const { data: lpOptions } = useLpPoolLpOptionsQuery(PROJECT_ID);

  const { data, isLoading } = useLpPoolListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
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
      { accessorKey: 'lpName', header: 'LP 名称' },
      { accessorKey: 'currency', header: '币种' },
      {
        accessorKey: 'accountAddress',
        header: '钱包地址',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.accountAddress || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'currencySystemType',
        header: '币种体系',
        cell: ({ row }) => (
          <span>
            {CURRENCY_SYSTEM_TYPE_LABEL[row.original.currencySystemType] ??
              row.original.currencySystemType}
          </span>
        ),
      },
      {
        accessorKey: 'minLimit',
        header: '最低限额',
        cell: ({ row }) => <span>{formatAmount(row.original.minLimit)}</span>,
      },
      {
        accessorKey: 'remindThreshold',
        header: '提醒阈值',
        cell: ({ row }) => (
          <span>{formatAmount(row.original.remindThreshold)}</span>
        ),
      },
      {
        accessorKey: 'availableBalanceCache',
        header: '可用余额',
        cell: ({ row }) => (
          <span>{formatAmount(row.original.availableBalanceCache)}</span>
        ),
      },
      {
        accessorKey: 'balanceUpdateTime',
        header: '余额更新时间',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.balanceUpdateTime)}</span>
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
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_POOL_STATUS_LABEL}
            variantMap={LP_POOL_STATUS_VARIANT}
          />
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(lpRoute('lp-pool', 'detail', row.original.poolId))
                }
              >
                {LBL.view}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(lpRoute('lp-pool', 'edit', row.original.poolId))
                }
              >
                {LBL.edit}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={s !== 20}
                onClick={() =>
                  router.push(
                    `${LP_BASE}/lp-preauth?poolId=${row.original.poolId}`,
                  )
                }
              >
                预授权
              </Button>
            </div>
          );
        },
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormField name="currency" label="币种" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder={LBL.all}
            options={statusOptions(LP_POOL_STATUS_LABEL)}
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

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
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
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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

/** 编辑回填：无 pool detail 端点，扫首页 200 条按 poolId 定位（源弹窗 backfill 整行）。 */
function useLpPoolRowById(poolId: number | undefined) {
  const { data, isLoading } = useLpPoolListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    poolId != null,
  );
  const row = data?.data.find((r) => r.poolId === poolId);
  return { row, isLoading };
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

  const { register, handleSubmit, reset, control } = useForm<LpPoolFormValues>({
    defaultValues: {
      lpId: '',
      currency: '',
      accountAddress: '',
      currencySystemType: '',
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
        toast.success(LBL.saveSuccess);
        router.push(lpRoute('lp-pool'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  if (isEdit && isLoading) return <LoadingBlock />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? '编辑资金池' : '新增资金池'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={isEdit}
            placeholder="选择 LP"
            options={lpToOptions(lpOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              币种<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              disabled={isEdit}
              {...register('currency', {
                required: '请输入币种',
                validate: (v) => v.trim().length > 0 || '请输入币种',
              })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">
              钱包地址<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={100}
              className="font-mono"
              {...register('accountAddress', {
                required: '请输入钱包地址',
                validate: (v) => v.trim().length > 0 || '请输入钱包地址',
              })}
            />
          </div>
          <FormSelect
            name="currencySystemType"
            control={control}
            label="币种体系"
            required
            placeholder="选择币种体系"
            options={Object.entries(CURRENCY_SYSTEM_TYPE_LABEL).map(
              ([k, v]) => ({ value: k, label: v }),
            )}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              最低限额<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('minLimit', {
                required: '请输入最低限额',
                validate: (v) => Number(v) > 0 || '需大于 0',
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              提醒阈值（0-1，4 位小数）
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('remindThreshold', {
                required: '请输入提醒阈值',
                validate: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0 || n > 1)
                    return '阈值需在 0-1 之间';
                  const decimals = v.includes('.')
                    ? v.split('.')[1]?.length ?? 0
                    : 0;
                  return decimals <= 4 || '最多 4 位小数';
                },
              })}
            />
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
    <DetailShell title="资金池详情" onBack={() => router.push(lpRoute('lp-pool'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP 名称" value={row.lpName} />
        <ReadonlyField label="币种" value={row.currency} />
        <ReadonlyField
          label="币种体系"
          value={CURRENCY_SYSTEM_TYPE_LABEL[row.currencySystemType]}
        />
        <ReadonlyField label="最低限额" value={formatAmount(row.minLimit)} />
        <ReadonlyField label="提醒阈值" value={formatAmount(row.remindThreshold)} />
        <ReadonlyField
          label="状态"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_POOL_STATUS_LABEL}
              variantMap={LP_POOL_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="可用余额" value={formatAmount(row.availableBalanceCache)} />
        <ReadonlyField label="余额更新时间" value={formatDateTime(row.balanceUpdateTime)} />
        <ReadonlyField label="创建时间" value={formatDateTime(row.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField label="钱包地址" value={<span className="font-mono text-xs">{row.accountAddress}</span>} />
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
  pageSize: number;
  lpId?: number;
  poolId?: number;
  currency?: string;
  status?: number;
}

function lpPreauthFormToParams(f: LpPreauthFilter): LpPreauthParams {
  const p: LpPreauthParams = { pageNum: 1, pageSize: PAGE_SIZE };
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

  const { data: lpOptions } = useLpPreauthLpOptionsQuery(PROJECT_ID);
  const watchLpId = watch('lpId');
  const lpIdForPools = watchLpId ? Number(watchLpId) : undefined;
  const { data: poolOptions } = useLpPreauthPoolOptionsQuery(
    PROJECT_ID,
    lpIdForPools,
  );

  const { data, isLoading } = useLpPreauthListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
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
      if (!window.confirm('确认撤销该预授权?')) return;
      revokeMutation.mutate(row.preauthId, {
        onSuccess: () => toast.success(LBL.opSuccess),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [revokeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPreauthRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP 名称' },
      { accessorKey: 'currency', header: '币种' },
      {
        accessorKey: 'authAmount',
        header: '授权额度',
        cell: ({ row }) => <span>{formatAmount(row.original.authAmount)}</span>,
      },
      {
        accessorKey: 'usedAmount',
        header: '已用额度',
        cell: ({ row }) => <span>{formatAmount(row.original.usedAmount)}</span>,
      },
      {
        id: 'remaining',
        header: '剩余额度',
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
        header: '生效时间',
        cell: ({ row }) => <span>{formatDateTime(row.original.validFrom)}</span>,
      },
      {
        accessorKey: 'validTo',
        header: '失效时间',
        cell: ({ row }) => <span>{formatDateTime(row.original.validTo)}</span>,
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_PREAUTH_STATUS_LABEL}
            variantMap={LP_PREAUTH_STATUS_VARIANT}
          />
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  lpRoute('lp-preauth', 'detail', row.original.preauthId),
                )
              }
            >
              {LBL.view}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  lpRoute('lp-preauth', 'edit', row.original.preauthId) +
                    `&lpId=${row.original.lpId}`,
                )
              }
            >
              {LBL.edit}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              disabled={row.original.status !== 20 || revokeMutation.isPending}
              onClick={() => onRevoke(row.original)}
            >
              撤销
            </Button>
          </div>
        ),
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
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
            label="资金池"
            placeholder={LBL.all}
            options={poolToOptions(poolOptions)}
          />
          <FormField name="currency" label="币种" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="状态"
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

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(lpRoute('lp-preauth', 'create'))}
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
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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

/** 编辑回填：无 preauth detail 端点，扫首页 200 条按 preauthId 定位。 */
function useLpPreauthRowById(preauthId: number | undefined) {
  const { data, isLoading } = useLpPreauthListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    preauthId != null,
  );
  const row = data?.data.find((r) => r.preauthId === preauthId);
  return { row, isLoading };
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

  const { register, handleSubmit, reset, control, watch, setValue } =
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

  // LP 变更时重置 poolId（池与 LP 强绑定）。
  React.useEffect(() => {
    setValue('poolId', '');
  }, [watchLpId, setValue]);

  React.useEffect(() => {
    if (!isEdit || !row) return;
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
    if (!values.validFrom || !values.validTo) return;
    if (new Date(values.validTo) <= new Date(values.validFrom)) {
      toast.error('失效时间需晚于生效时间');
      return;
    }
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
        toast.success(LBL.saveSuccess);
        router.push(lpRoute('lp-preauth'));
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  if (isEdit && isLoading) return <LoadingBlock />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? '编辑预授权' : '新增预授权'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={isEdit}
            placeholder="选择 LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="poolId"
            control={control}
            label="资金池"
            required
            disabled={isEdit || !lpIdForPools}
            placeholder={lpIdForPools ? '选择资金池' : '请先选择 LP'}
            options={poolToOptions(poolOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              授权额度<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('authAmount', {
                required: '请输入授权额度',
                validate: (v) => Number(v) > 0 || '需大于 0',
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              生效时间<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('validFrom', { required: '请选择生效时间' })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              失效时间<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('validTo', { required: '请选择失效时间' })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">授权凭证</label>
            <Input {...register('authCredential')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">链上授权交易 ID</label>
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
      title="预授权详情"
      onBack={() => router.push(lpRoute('lp-preauth'))}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP 名称" value={row.lpName} />
        <ReadonlyField label="币种" value={row.currency} />
        <ReadonlyField label="资金池 ID" value={row.poolId} />
        <ReadonlyField label="授权额度" value={formatAmount(row.authAmount)} />
        <ReadonlyField label="已用额度" value={formatAmount(row.usedAmount)} />
        <ReadonlyField
          label="剩余额度"
          value={formatAmount(
            Number(row.authAmount ?? 0) - Number(row.usedAmount ?? 0),
          )}
        />
        <ReadonlyField label="生效时间" value={formatDateTime(row.validFrom)} />
        <ReadonlyField label="失效时间" value={formatDateTime(row.validTo)} />
        <ReadonlyField
          label="状态"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_PREAUTH_STATUS_LABEL}
              variantMap={LP_PREAUTH_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="授权凭证" value={row.authCredential} />
        <ReadonlyField label="链上授权交易 ID" value={row.authCsTxId} />
        <ReadonlyField label="创建时间" value={formatDateTime(row.createTime)} />
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
  pageSize: number;
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
  const p: LpPairParams = { pageNum: 1, pageSize: PAGE_SIZE };
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
    const req: LpPairSaveReq = {
      lpId: Number(values.lpId),
      pairId: Number(values.pairId),
      remark: values.remark || undefined,
    };
    if (editing) req.id = editing.id;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(LBL.saveSuccess);
        onOpenChange(false);
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑参与货币对' : '新增参与货币对'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            disabled={!!editing}
            placeholder="选择 LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="pairId"
            control={control}
            label="货币对"
            required
            disabled={!!editing}
            placeholder="选择货币对"
            options={pairToOptions(pairOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">备注</label>
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
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<LpPairRow | null>(null);

  const { data: lpOptions } = useLpPairLpOptionsQuery(PROJECT_ID);
  const { data: pairOptions } = useLpPairCurrencyPairOptionsQuery(PROJECT_ID);

  const { data, isLoading } = useLpPairListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
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
      if (!window.confirm('确认提交该货币对参与记录?')) return;
      submitMutation.mutate(row.id, {
        onSuccess: () => toast.success(LBL.opSuccess),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [submitMutation, toast],
  );

  const onToggle = React.useCallback(
    (row: LpPairRow, target: number) => {
      const verb = target === LP_PAIR_TARGET_STATUS.disable ? '停用' : '恢复';
      if (!window.confirm(`确认${verb}该货币对参与记录?`)) return;
      statusMutation.mutate(
        { id: row.id, targetStatus: target },
        {
          onSuccess: () => toast.success(LBL.opSuccess),
          onError: () => toast.error(LBL.opFailed),
        },
      );
    },
    [statusMutation, toast],
  );

  const onRemove = React.useCallback(
    (row: LpPairRow) => {
      if (!window.confirm('确认删除该货币对参与记录?删除后不可恢复。')) return;
      removeMutation.mutate(row.id, {
        onSuccess: () => toast.success(LBL.opSuccess),
        onError: () => toast.error(LBL.opFailed),
      });
    },
    [removeMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPairTableRow>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP 名称' },
      {
        id: 'pair',
        header: '货币对',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}/{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
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
        header: '审批记录',
        cell: ({ row }) => (
          <span>{row.original.approvalRecordId || '--'}</span>
        ),
      },
      {
        accessorKey: 'remark',
        header: '备注',
        cell: ({ row }) => (
          <span>{row.original.remark || '--'}</span>
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
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const s = row.original.status;
          const editable = s === 1 || s === 15;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    lpRoute('lp-currency-pair', 'detail', Number(row.original.id)),
                  )
                }
              >
                {LBL.view}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={!editable}
                onClick={() => openEdit(toLpPairRow(row.original))}
              >
                {LBL.edit}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={!editable}
                onClick={() => onSubmit(toLpPairRow(row.original))}
              >
                提交
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={s !== 20}
                onClick={() =>
                  onToggle(toLpPairRow(row.original), LP_PAIR_TARGET_STATUS.disable)
                }
              >
                停用
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={s !== 50}
                onClick={() =>
                  onToggle(toLpPairRow(row.original), LP_PAIR_TARGET_STATUS.restore)
                }
              >
                恢复
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
                disabled={!editable}
                onClick={() => onRemove(toLpPairRow(row.original))}
              >
                移除
              </Button>
            </div>
          );
        },
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
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
            label="货币对"
            placeholder={LBL.all}
            options={pairToOptions(pairOptions)}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder={LBL.all}
            options={statusOptions(LP_PAIR_STATUS_LABEL)}
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

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button type="button" size="sm" onClick={openCreate}>
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
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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
  const { data, isLoading } = useLpPairListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    id != null,
  );
  const row = data?.data.find((r) => r.id === id);

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
      title="参与货币对详情"
      onBack={() => router.push(lpRoute('lp-currency-pair'))}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP 名称" value={row.lpName} />
        <ReadonlyField
          label="货币对"
          value={`${row.sourceCurrency}/${row.targetCurrency}`}
        />
        <ReadonlyField
          label="状态"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_PAIR_STATUS_LABEL}
              variantMap={LP_PAIR_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="备注" value={row.remark} />
        <ReadonlyField label="创建时间" value={formatDateTime(row.createTime)} />
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
  pageSize: number;
  lpId?: number;
  currency?: string;
  status?: number;
}

function lpTopupFormToParams(f: LpTopupFilter): LpTopupParams {
  const p: LpTopupParams = { pageNum: 1, pageSize: PAGE_SIZE };
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

  const { control, register, handleSubmit, reset, watch, setValue } = useForm<{
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
    const addr = values.transferInAddress.trim();
    const req: LpTopupSaveReq = {
      lpId: Number(values.lpId),
      poolId: Number(values.poolId),
      amount: values.amount,
      ...(addr ? { transferInAddress: addr } : {}),
    };
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success('已提交补资声明');
        onOpenChange(false);
      },
      onError: () => toast.error(LBL.saveFailed),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>声明补资</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            placeholder="选择 LP"
            options={lpToOptions(lpOptions)}
          />
          <FormSelect
            name="poolId"
            control={control}
            label="资金池"
            required
            disabled={!lpIdForPools}
            placeholder={lpIdForPools ? '选择资金池' : '请先选择 LP'}
            options={poolToOptions(poolOptions)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              补资金额<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              {...register('amount', {
                required: '请输入补资金额',
                validate: (v) => Number(v) > 0 || '需大于 0',
              })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">转入地址</label>
            <Input
              className="font-mono"
              placeholder="留空使用资金池账户地址"
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
              {saveMutation.isPending ? LBL.saving : '提交声明'}
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
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: lpOptions } = useLpTopupLpOptionsQuery(PROJECT_ID);

  const { data, isLoading } = useLpTopupListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
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
      { accessorKey: 'lpName', header: 'LP 名称' },
      { accessorKey: 'currency', header: '币种' },
      {
        accessorKey: 'amount',
        header: '补资金额',
        cell: ({ row }) => <span>{formatAmount(row.original.amount)}</span>,
      },
      {
        accessorKey: 'transferInAddress',
        header: '转入地址',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.transferInAddress || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'declareTime',
        header: '声明时间',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.declareTime)}</span>
        ),
      },
      {
        accessorKey: 'confirmTime',
        header: '到账时间',
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.confirmTime)}</span>
        ),
      },
      {
        accessorKey: 'csTxId',
        header: '链上交易 ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.csTxId || '--'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_TOPUP_STATUS_LABEL}
            variantMap={LP_TOPUP_STATUS_VARIANT}
          />
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(lpRoute('lp-topup', 'detail', row.original.topupId))
              }
            >
              {LBL.view}
            </Button>
          </div>
        ),
      },
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder={LBL.all}
            options={lpToOptions(lpOptions)}
          />
          <FormField name="currency" label="币种" register={register('currency')} />
          <FormSelect
            name="status"
            control={control}
            label="状态"
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

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{LBL.records}</div>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            声明补资
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
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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
  const { data, isLoading } = useLpTopupListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    topupId != null,
  );
  const row = data?.data.find((r) => r.topupId === topupId);

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
    <DetailShell title="补资记录详情" onBack={() => router.push(lpRoute('lp-topup'))}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField label="LP 名称" value={row.lpName} />
        <ReadonlyField label="币种" value={row.currency} />
        <ReadonlyField label="资金池 ID" value={row.poolId} />
        <ReadonlyField label="补资金额" value={formatAmount(row.amount)} />
        <ReadonlyField label="声明时间" value={formatDateTime(row.declareTime)} />
        <ReadonlyField label="到账时间" value={formatDateTime(row.confirmTime)} />
        <ReadonlyField
          label="状态"
          value={
            <StatusBadge
              status={row.status}
              labelMap={LP_TOPUP_STATUS_LABEL}
              variantMap={LP_TOPUP_STATUS_VARIANT}
            />
          }
        />
        <ReadonlyField label="链上交易 ID" value={row.csTxId} />
        <ReadonlyField label="创建时间" value={formatDateTime(row.createTime)} />
        <div className="md:col-span-2 lg:col-span-3">
          <ReadonlyField
            label="转入地址"
            value={<span className="font-mono text-xs">{row.transferInAddress}</span>}
          />
        </div>
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-water-level — 水位监控（无源码 → 保留 mock）                       */
/* ================================================================== */

const lpWaterLevelColumns: MockColumn[] = [
  { key: 'poolId', label: 'Pool ID' },
  { key: 'lpName', label: 'Owning LP' },
  { key: 'currency', label: 'Currency' },
  { key: 'balance', label: 'Current Balance' },
  { key: 'lowWaterMark', label: 'Low Water Level' },
  { key: 'alert', label: 'Alert' },
];

const lpWaterLevelRows = [
  { poolId: 'POOL001', lpName: 'Sample LP Alpha', currency: 'USDT', balance: '1,200,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">Normal</Badge> },
  { poolId: 'POOL002', lpName: 'Sample LP Alpha', currency: 'USDC', balance: '850,000', lowWaterMark: '200,000', alert: <Badge variant="secondary">Normal</Badge> },
  { poolId: 'POOL003', lpName: 'Sample LP Gamma', currency: 'USDT', balance: '180,000', lowWaterMark: '200,000', alert: <Badge variant="destructive">Below Threshold</Badge> },
  { poolId: 'POOL004', lpName: 'Sample LP Delta', currency: 'USDC', balance: '0', lowWaterMark: '100,000', alert: <Badge variant="destructive">Depleted</Badge> },
];

export function LpWaterLevelListPage() {
  return <MockListPage title="Water Level Monitor" columns={lpWaterLevelColumns} rows={lpWaterLevelRows} />;
}
