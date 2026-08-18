'use client';

/**
 * 行情三页（源 `views/business/currency-pair.vue` / `lp.vue` / `rate.vue`）。
 *
 * 路由（configs/kissen-gateway.json market 组）：
 *  - /market/currencypair 货币对列表（行点击 → /market/lp?pairId=，源 onRowClick 语义）
 *  - /market/lp           LP 列表（货币对选择器联动过滤 pairId；支持 ?pairId= 直达）
 *  - /market/rate         最新汇率（货币对选择器 → 单条快照描述视图）
 *
 * 迁移决策：
 *  - 源无独立详情路由，detail 键渲染单条记录只读视图（字段与列表一致）：
 *    currencypair/lp 按 ?id=（兜底路径尾段）在列表内查找记录；
 *    rate 按 ?pairId=（兜底路径尾段）取该货币对快照。
 *  - 筛选表单用 React Hook Form（单下拉、无校验字段，与 kissen-admin 筛选
 *    表单一致不挂 zodResolver）；下拉 watch 驱动查询，等价源 el-select @change=load。
 *  - el-select clearable → 选中态旁置清除按钮（×），清空值回落 placeholder
 *    （Radix Select 空串即 placeholder），lp 清空=全量、rate 清空=空态提示。
 *  - 货币对列表行点击是核心交互且 shared DataTable 不支持 onRowClick，
 *    该页用与 DataTable 同视觉语言的原生 table（含 loading 骨架/空态）；
 *    LP 列表无行点击，直接用 shared DataTable。
 *  - 服务端状态 TanStack Query；loading/empty/error 三态均显式可感知。
 */

import * as React from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, X } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  CURRENCY_PAIR_STATUS_LABEL,
  CURRENCY_PAIR_STATUS_VARIANT,
  LP_STATUS_LABEL,
  LP_STATUS_VARIANT,
  useCurrencypairListQuery,
  useLatestRateQuery,
  useLpListQuery,
  type CurrencyPair,
  type LpItem,
  type RateSnapshot,
} from '@myorg/modules/kissen-gateway/data-access';

/* ================================================================== */
/* 常量与格式化（源 currency-pair.vue / lp.vue / rate.vue fmtRate/fmtTime）*/
/* ================================================================== */

const MARKET_BASE = '/market';

/** 源三页统一的 eyebrow（page-head 上方小标）。 */
const PAGE_EYEBROW = 'BUSINESS';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface PairFilterForm {
  /** 货币对下拉值：'' = 未选（lp 全量 / rate 空态），否则为 pairId 字符串。 */
  pairId: string;
}

/** 汇率展示：null/undefined → '-'；Number() 归一去掉无效尾零（源 fmtRate）。 */
function formatRate(value: number | null | undefined): string {
  return value == null ? '-' : String(Number(value));
}

/** 毫秒时间戳 → zh-CN 本地化时间（24 小时制）；空值 → '-'（源 fmtTime）。 */
function formatTime(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** 源 lp.vue 的 query 解析语义：Number() 后 falsy（''/0/NaN）一律视为未选择。 */
function parseIdParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return n ? n : undefined;
}

/** 路径尾段数字（如 /market/lp/12 → 12）作为 detail 定位兜底。 */
function parsePathTrailingId(pathname: string | null): number | undefined {
  if (!pathname) return undefined;
  const segments = pathname.split('/').filter(Boolean);
  return parseIdParam(segments[segments.length - 1] ?? null);
}

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 货币对选项 → 下拉选项（label 为 源/目标 展示，源 lp.vue / rate.vue el-option）。 */
function pairToOptions(
  list: CurrencyPair[] | undefined,
): Array<{ value: string; label: string }> {
  return (list ?? []).map((p) => ({
    value: String(p.pairId),
    label: `${p.sourceCurrency}/${p.targetCurrency}`,
  }));
}

/* ================================================================== */
/* 通用展示组件                                                         */
/* ================================================================== */

/** 页头（源 page-head：eyebrow + 标题）。 */
function PageHead({ title }: { title: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {PAGE_EYEBROW}
      </div>
      <h1 className="mt-1 text-xl font-semibold">{title}</h1>
    </div>
  );
}

/** 启用/停用状态徽标（源 el-tag：status === 20 ? 启用 : 停用；lp 列 null 显示 '-'）。 */
function StatusBadge({
  status,
  labelMap,
  variantMap,
}: {
  status: number | null | undefined;
  labelMap: Record<number, string>;
  variantMap: Record<number, BadgeVariant>;
}) {
  if (status == null) return <span>-</span>;
  return (
    <Badge variant={variantMap[status] ?? 'outline'}>
      {labelMap[status] ?? '停用'}
    </Badge>
  );
}

/** 详情描述字段（el-descriptions-item 的 React 等价）。 */
function DescField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** 详情描述网格（源 el-descriptions :column="2"）。 */
function DescGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

function LoadingBlock() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">加载中…</div>
  );
}

/** 加载失败提示 + 重试（error 状态必须可感知并可恢复）。 */
function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm">
      <span className="text-destructive">加载失败：{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/** 空态提示（源 el-empty description 的 React 等价）。 */
function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}

/** 详情页外壳：返回列表 + 标题 + 内容卡。 */
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
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {children}
      </section>
    </div>
  );
}

/** 货币对筛选下拉（源 el-select clearable：选中态旁 × 一键清空回落 placeholder）。 */
function PairSelectField({
  selectId,
  control,
  placeholder,
  options,
  clearLabel,
}: {
  selectId: string;
  control: Control<PairFilterForm>;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  clearLabel: string;
}) {
  return (
    <Controller
      name="pairId"
      control={control}
      render={({ field }) => (
        <div className="flex items-center gap-1.5">
          <div className="w-[220px]">
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={selectId}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field.value !== '' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={clearLabel}
              onClick={() => field.onChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    />
  );
}

/** 货币对选项加载失败的内联提示（选择器数据源不可用时仍可感知 + 重试）。 */
function PairOptionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="text-sm text-destructive">
      货币对列表加载失败，
      <button type="button" className="underline underline-offset-2" onClick={onRetry}>
        重试
      </button>
    </p>
  );
}

/* ================================================================== */
/* currencypair —— 货币对列表（源 currency-pair.vue）                    */
/* ================================================================== */

const CP_HEADERS = [
  'PairId',
  '源货币',
  '目标货币',
  '用户汇率',
  '状态',
  '推送时间',
] as const;

export function CurrencypairListPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useCurrencypairListQuery();
  const rows = data ?? [];

  /** 行点击 → 该货币对下的 LP 列表（源 onRowClick → /business/lp?pairId=）。 */
  const gotoLp = React.useCallback(
    (row: CurrencyPair) =>
      router.push(`${MARKET_BASE}/lp?pairId=${row.pairId}`),
    [router],
  );

  return (
    <div className="space-y-4">
      <PageHead title="货币对" />
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {isError ? (
          <ErrorBlock message={errText(error)} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {CP_HEADERS.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        {CP_HEADERS.map((header) => (
                          <td key={header} className="px-4 py-3">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={CP_HEADERS.length}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.pairId}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => gotoLp(row)}
                      >
                        <td className="px-4 py-3 align-middle tabular-nums">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              gotoLp(row);
                            }}
                          >
                            {row.pairId}
                          </Button>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {row.sourceCurrency}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {row.targetCurrency}
                        </td>
                        <td className="px-4 py-3 align-middle tabular-nums">
                          {formatRate(row.userRate)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusBadge
                            status={row.status}
                            labelMap={CURRENCY_PAIR_STATUS_LABEL}
                            variantMap={CURRENCY_PAIR_STATUS_VARIANT}
                          />
                        </td>
                        <td className="px-4 py-3 align-middle tabular-nums">
                          {formatTime(row.pushTime)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              点击行查看该货币对下的 LP 信息
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/** 货币对详情（源无独立详情；按 ?id= 在列表中定位，字段与列表一致）。 */
export function CurrencypairDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const pairId =
    parseIdParam(searchParams.get('id')) ?? parsePathTrailingId(pathname);
  const { data, isLoading, isError, error, refetch } = useCurrencypairListQuery();
  const row = data?.find((r) => r.pairId === pairId);

  return (
    <DetailShell
      title="货币对详情"
      onBack={() => router.push(`${MARKET_BASE}/currencypair`)}
    >
      {isError ? (
        <ErrorBlock message={errText(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingBlock />
      ) : !row ? (
        <EmptyHint text="未找到对应记录" />
      ) : (
        <DescGrid>
          <DescField label="PairId">
            <span className="tabular-nums">{row.pairId}</span>
          </DescField>
          <DescField label="源货币">{row.sourceCurrency}</DescField>
          <DescField label="目标货币">{row.targetCurrency}</DescField>
          <DescField label="用户汇率">
            <span className="tabular-nums">{formatRate(row.userRate)}</span>
          </DescField>
          <DescField label="状态">
            <StatusBadge
              status={row.status}
              labelMap={CURRENCY_PAIR_STATUS_LABEL}
              variantMap={CURRENCY_PAIR_STATUS_VARIANT}
            />
          </DescField>
          <DescField label="推送时间">
            <span className="tabular-nums">{formatTime(row.pushTime)}</span>
          </DescField>
        </DescGrid>
      )}
    </DetailShell>
  );
}

/* ================================================================== */
/* lp —— LP 信息列表（源 lp.vue）                                       */
/* ================================================================== */

/** DataTable 行模型：注入字符串 id 满足 `{ id: string }` 契约（LpItem.id 为后端数字主键）。 */
type LpRow = Omit<LpItem, 'id'> & { id: string };

const LP_COLUMNS: ColumnDef<LpRow>[] = [
  {
    accessorKey: 'lpId',
    header: 'LP ID',
    cell: ({ row }) => <span className="tabular-nums">{row.original.lpId}</span>,
  },
  { accessorKey: 'lpName', header: 'LP 名称' },
  {
    accessorKey: 'pairId',
    header: 'PairId',
    cell: ({ row }) => <span className="tabular-nums">{row.original.pairId}</span>,
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
    accessorKey: 'pushTime',
    header: '推送时间',
    cell: ({ row }) => (
      <span className="tabular-nums">{formatTime(row.original.pushTime)}</span>
    ),
  },
];

export function LpListPage() {
  const searchParams = useSearchParams();
  /** 源 onMounted：读取路由 ?pairId= 作为初始筛选（货币对页行点击直达）。 */
  const initialPairId = parseIdParam(searchParams.get('pairId'));
  const { control, watch, handleSubmit } = useForm<PairFilterForm>({
    defaultValues: {
      pairId: initialPairId != null ? String(initialPairId) : '',
    },
  });

  /** watch 驱动查询：下拉变更即重新加载（源 el-select @change="load"）。 */
  const pairIdStr = watch('pairId');
  const pairId = pairIdStr ? Number(pairIdStr) : undefined;

  const pairsQuery = useCurrencypairListQuery();
  const lpQuery = useLpListQuery(pairId);
  const rows = lpQuery.data ?? [];

  const options = React.useMemo(
    () => pairToOptions(pairsQuery.data),
    [pairsQuery.data],
  );
  /** DataTable 行模型要求 id: string；用后端行主键 id 保证稳定。 */
  const tableData = React.useMemo<LpRow[]>(
    () => rows.map((r) => ({ ...r, id: String(r.id) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <PageHead title="LP 信息" />
      <section className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={handleSubmit(() => lpQuery.refetch())}
        >
          <label htmlFor="lp-pair-select" className="text-sm font-medium">
            货币对
          </label>
          <PairSelectField
            selectId="lp-pair-select"
            control={control}
            placeholder="全部货币对"
            options={options}
            clearLabel="清除货币对筛选"
          />
          <Button type="submit">查询</Button>
        </form>
        {pairsQuery.isError && (
          <PairOptionsError onRetry={() => pairsQuery.refetch()} />
        )}
        {lpQuery.isError ? (
          <ErrorBlock
            message={errText(lpQuery.error)}
            onRetry={() => lpQuery.refetch()}
          />
        ) : (
          <DataTable
            columns={LP_COLUMNS}
            data={tableData}
            isLoading={lpQuery.isLoading}
            emptyMessage="暂无数据"
          />
        )}
      </section>
    </div>
  );
}

/** LP 详情（源无独立详情；按 ?id=（lpId）在列表中定位，字段与列表一致）。 */
export function LpDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const lpId = parseIdParam(searchParams.get('id')) ?? parsePathTrailingId(pathname);
  const { data, isLoading, isError, error, refetch } = useLpListQuery();
  const row = data?.find((r) => r.lpId === lpId);

  return (
    <DetailShell title="LP 详情" onBack={() => router.push(`${MARKET_BASE}/lp`)}>
      {isError ? (
        <ErrorBlock message={errText(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingBlock />
      ) : !row ? (
        <EmptyHint text="未找到对应记录" />
      ) : (
        <DescGrid>
          <DescField label="LP ID">
            <span className="tabular-nums">{row.lpId}</span>
          </DescField>
          <DescField label="LP 名称">{row.lpName}</DescField>
          <DescField label="PairId">
            <span className="tabular-nums">{row.pairId}</span>
          </DescField>
          <DescField label="状态">
            <StatusBadge
              status={row.status}
              labelMap={LP_STATUS_LABEL}
              variantMap={LP_STATUS_VARIANT}
            />
          </DescField>
          <DescField label="推送时间">
            <span className="tabular-nums">{formatTime(row.pushTime)}</span>
          </DescField>
        </DescGrid>
      )}
    </DetailShell>
  );
}

/* ================================================================== */
/* rate —— 最新汇率（源 rate.vue）                                      */
/* ================================================================== */

/** 汇率快照描述视图（源 el-descriptions :column="2"，列表/详情共用）。 */
function RateSnapshotDesc({ rate }: { rate: RateSnapshot }) {
  return (
    <DescGrid>
      <DescField label="PairId">
        <span className="tabular-nums">{rate.pairId}</span>
      </DescField>
      <DescField label="版本号">
        <span className="tabular-nums">{rate.version ?? '-'}</span>
      </DescField>
      <DescField label="基础汇率">
        <span className="tabular-nums">{formatRate(rate.baseRate)}</span>
      </DescField>
      <DescField label="加点汇率">
        <span className="tabular-nums">{formatRate(rate.markupRate)}</span>
      </DescField>
      <DescField label="用户汇率">
        <span className="tabular-nums">{formatRate(rate.userRate)}</span>
      </DescField>
      <DescField label="推送时间">
        <span className="tabular-nums">{formatTime(rate.pushTime)}</span>
      </DescField>
    </DescGrid>
  );
}

export function RateListPage() {
  const { control, watch } = useForm<PairFilterForm>({
    defaultValues: { pairId: '' },
  });
  /** watch 驱动查询：选择即取该货币对快照（源 onPairChange）。 */
  const pairIdStr = watch('pairId');
  const pairId = pairIdStr ? Number(pairIdStr) : undefined;

  const pairsQuery = useCurrencypairListQuery();
  const rateQuery = useLatestRateQuery(pairId);

  const options = React.useMemo(
    () => pairToOptions(pairsQuery.data),
    [pairsQuery.data],
  );

  return (
    <div className="space-y-4">
      <PageHead title="最新汇率" />
      <section className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <form className="flex flex-wrap items-center gap-3">
          <label htmlFor="rate-pair-select" className="text-sm font-medium">
            货币对
          </label>
          <PairSelectField
            selectId="rate-pair-select"
            control={control}
            placeholder="选择货币对"
            options={options}
            clearLabel="清除货币对选择"
          />
        </form>
        {pairsQuery.isError && (
          <PairOptionsError onRetry={() => pairsQuery.refetch()} />
        )}
        {pairId == null ? (
          <EmptyHint text="请选择货币对查看最新汇率" />
        ) : rateQuery.isError ? (
          <ErrorBlock
            message={errText(rateQuery.error)}
            onRetry={() => rateQuery.refetch()}
          />
        ) : rateQuery.isLoading ? (
          <LoadingBlock />
        ) : rateQuery.data == null ? (
          <EmptyHint text="请选择货币对查看最新汇率" />
        ) : (
          <RateSnapshotDesc rate={rateQuery.data} />
        )}
      </section>
    </div>
  );
}

/** 汇率详情（源无独立详情；按 ?pairId= 渲染该货币对快照，字段与列表一致）。 */
export function RateDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const pairId =
    parseIdParam(searchParams.get('pairId')) ?? parsePathTrailingId(pathname);
  const { data, isLoading, isError, error, refetch } = useLatestRateQuery(pairId);

  return (
    <DetailShell title="汇率详情" onBack={() => router.push(`${MARKET_BASE}/rate`)}>
      {pairId == null ? (
        <EmptyHint text="请选择货币对查看最新汇率" />
      ) : isError ? (
        <ErrorBlock message={errText(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingBlock />
      ) : data == null ? (
        <EmptyHint text="暂无汇率快照" />
      ) : (
        <RateSnapshotDesc rate={data} />
      )}
    </DetailShell>
  );
}
