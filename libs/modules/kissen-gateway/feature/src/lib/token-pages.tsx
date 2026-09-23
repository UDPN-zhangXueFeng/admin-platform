'use client';

/**
 * Token 管理域三页（plan/12 §5 P2：BP 原型 TokenManagementPage.jsx /
 * RegisterTokenPage.jsx / TokenDetailPage.jsx 行为规格落地）。
 *
 * - 列表 /token/manage：筛选卡（Token Code 模糊 / Pegged Currency /
 *   BlockChain / Status 精确）+ 10 列（39c8a2b 列序去 tokenNo 列，tokenNo
 *   仅详情 Status & Sync 卡展示）+ 列偏好 localStorage 持久化 + 表头排序 +
 *   Register Token 跳页面化注册（原型 2026-09-20「弹窗→页」）。
 * - 注册 /token/create：单卡三分区表单（Token Identity / Value & Anchor /
 *   Additional Information），校验文案逐字对齐原型 validate()；幂等重复提交
 *   → 页内 warning 横幅（原型 409 分支；后端以 resp.idempotent 表达）。
 * - 详情 /token/manage/detail?code=：3 Tab（basic/transactions/operations），
 *   ?tab= 写 URL、basic 缺省不写；transactions/operations 为 GAP-GW-01
 *   静态空表（列契约先落地）。
 * - 筛选/排序为前端本地处理（/token/list 无查询入参；本地过滤过渡，
 *   后端分页/筛选参数就绪后回写为服务端检索）。
 * - 保留项（plan §7 有意偏差）：Register Token 的 'bank:token:submit'
 *   权限码门控；状态列驳回原因 Tooltip；footnote 三段口径。
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  Loader2,
  Plus,
  TriangleAlert,
} from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  tokenScopeText,
  tokenTypeText,
  useSubmitTokenMutation,
  useTokenDetailQuery,
  useTokenListQuery,
  type TokenInfo,
} from '@myorg/modules/kissen-gateway/data-access';

import { CopyableId, ProtoStatusBadge, type ProtoStatusTone } from './proto-ui';
import { formatTokenAmount, formatUtc8 } from './proto-format';
import {
  PROTO_TOKEN_STATUS,
  protoStatusRank,
  protoStatusText,
} from './proto-enums';
import { DescField, DescGrid } from './desc-grid';
import { orDash } from './kit';
import { EmptyHint, MissingIdBlock } from './state-blocks';
import { useGatewayPerm } from './use-gateway-perm';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';

/** token 提交权限码（源 v-perm="'bank:token:submit'"，头部注册入口）。 */
const TOKEN_SUBMIT_PERM = 'bank:token:submit';

const TOKEN_LIST_PATH = '/token/manage';
const TOKEN_CREATE_PATH = '/token/create';
const TOKEN_DETAIL_PATH = '/token/manage/detail';

/** 锚定法币合法取值（原型 RegisterTokenPage PEGGED_CURRENCIES：ISO 4217
 * 主数据固定集，与筛选区「选项来自接口」不同源）。 */
const PEGGED_CURRENCIES = ['USD', 'EUR', 'CNY', 'SGD', 'GBP', 'JPY'];

/* ─────────────────── 列表：列定义 / 排序 / 列偏好 ─────────────────── */

/** 列契约（原型 COLUMNS 逐字）；排序/列偏好公共件见 proto-table。 */

const TOKEN_COLUMNS: ProtoColumnDef[] = [
  { id: 'name', label: 'Token Name', required: true },
  { id: 'symbol', label: 'Symbol' },
  { id: 'decimals', label: 'Decimals' },
  { id: 'peggedCurrency', label: 'Pegged Currency' },
  { id: 'chain', label: 'BlockChain' },
  { id: 'tokenCode', label: 'Token Code (Currency System)' },
  { id: 'minLiquidity', label: 'Min. Liquidity' },
  { id: 'syncedAt', label: 'Synced on (UTC+8)' },
  { id: 'status', label: 'Status', required: true },
  { id: 'actions', label: 'Actions', required: true },
];

/** 列偏好 localStorage 键（原型 useTableColumnPreferences 同语义）。 */
const TOKEN_COLUMN_PREF_KEY = 'gw.token-list.columns';

/** 排序键 → 行取值（原型 sortBy 语义；status/tokenCode/actions 不可排序）。 */
const TOKEN_SORT_ACCESSORS: Record<
  string,
  (row: TokenInfo) => string | number | null | undefined
> = {
  name: (r) => r.tokenName,
  symbol: (r) => r.symbol,
  decimals: (r) => r.decimalDigits,
  peggedCurrency: (r) => r.anchorFiat,
  chain: (r) => r.chainType,
  minLiquidity: (r) => r.minLiquidity,
  syncedAt: (r) => r.pushTime,
};

/** 状态码 → 徽章语义色（Pending Review 警示 / Active 成功 / Rejected 拒绝 / Disabled 灰）。 */
const TOKEN_STATUS_TONES: Record<number, ProtoStatusTone> = {
  5: 'warning',
  20: 'success',
  15: 'danger',
  50: 'muted',
};

/* 排序 / 列偏好公共实现见 proto-table.tsx。 */


/* ─────────────────────────── 注册表单页 ─────────────────────────── */

/**
 * 表单校验（原型 RegisterTokenPage validate() 逐字文案 + 正则）：
 * 必填 'Required field'；tokenCode 16–64 位（首字符字母数字，其余字母数字/_/-）；
 * symbol 2–12 位大写；chain ≤32；decimals 0–18 整数；可选三项仅限长。
 */
const tokenFormSchema = z.object({
  tokenCode: z
    .string()
    .trim()
    .min(1, { message: 'Required field' })
    .regex(/^[0-9a-zA-Z][0-9a-zA-Z_-]{15,63}$/, {
      message: 'Use 16–64 letters, digits, hyphen or underscore.',
    }),
  tokenName: z
    .string()
    .trim()
    .min(1, { message: 'Required field' })
    .refine((v) => v.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(v), {
      message:
        'Use letters, digits, space, dot, hyphen or underscore (max 64).',
    }),
  symbol: z
    .string()
    .trim()
    .min(1, { message: 'Required field' })
    .regex(/^[A-Z][A-Z0-9]{1,11}$/, {
      message:
        'Use 2–12 uppercase letters or digits, starting with a letter.',
    }),
  chainType: z
    .string()
    .trim()
    .min(1, { message: 'Required field' })
    .max(32, { message: 'Max 32 characters.' }),
  decimalDigits: z
    .string()
    .trim()
    .min(1, { message: 'Required field' })
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 18, {
      message: 'Enter a whole number between 0 and 18.',
    }),
  anchorFiat: z.string().min(1, { message: 'Required field' }),
  contractAddress: z
    .string()
    .trim()
    .max(128, { message: 'Max 128 characters.' }),
  issuerDesc: z.string().trim().max(500, { message: 'Max 500 characters.' }),
  remark: z.string().trim().max(500, { message: 'Max 500 characters.' }),
});

type TokenFormValues = z.infer<typeof tokenFormSchema>;

/** 原型 EMPTY_FORM 默认值（decimals '2'，其余空串）。 */
const TOKEN_FORM_DEFAULT: TokenFormValues = {
  tokenCode: '',
  tokenName: '',
  symbol: '',
  chainType: '',
  decimalDigits: '2',
  anchorFiat: '',
  contractAddress: '',
  issuerDesc: '',
  remark: '',
};

/**
 * Token 注册页（页面化，替换原弹窗；registry token.create 键映射）。
 * 路由 /token/create。单张 Card 内三分区（发丝线分隔）+ 底部操作条；
 * 提交仍走 POST /token/submit（九字段全量，可选字段空串原样上送）。
 */
export function RegisterTokenPage() {
  const router = useRouter();
  const toast = useToast();
  const submitMutation = useSubmitTokenMutation();
  /** 幂等重复提交的 tokenCode（原型 409 分支 → 页内 warning 横幅）。 */
  const [duplicateCode, setDuplicateCode] = React.useState<string | null>(null);

  const { register, handleSubmit, control, formState } =
    useForm<TokenFormValues>({
      resolver: createFormResolver(tokenFormSchema),
      mode: 'onTouched',
      defaultValues: TOKEN_FORM_DEFAULT,
    });

  const onSubmit = handleSubmit((v) => {
    setDuplicateCode(null);
    // schema 已 trim；九字段全量上送（与原弹窗一致，可选字段空串原样）。
    submitMutation.mutate(
      {
        tokenCode: v.tokenCode,
        tokenName: v.tokenName,
        symbol: v.symbol,
        decimalDigits: Number(v.decimalDigits),
        chainType: v.chainType,
        anchorFiat: v.anchorFiat,
        contractAddress: v.contractAddress,
        issuerDesc: v.issuerDesc,
        remark: v.remark,
      },
      {
        onSuccess: (resp) => {
          if (resp.idempotent) {
            // 幂等：同编码已登记，返回其当前状态；表单保留以便修改或查看。
            setDuplicateCode(v.tokenCode);
            return;
          }
          if (resp.status === 5) {
            toast.success(
              'Registration submitted, waiting for platform review',
            );
          } else {
            toast.success(
              `Submitted successfully (status: ${protoStatusText(
                PROTO_TOKEN_STATUS,
                resp.status,
              )})`,
            );
          }
          router.replace(
            `${TOKEN_DETAIL_PATH}?code=${encodeURIComponent(v.tokenCode)}`,
          );
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：无 Back，靠 Cancel 返回列表）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Token
        </div>
        <h1 className="text-xl font-semibold">Register Token</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a new token for Kissen review. The review result is written
          back automatically.
        </p>
      </div>

      {/* 幂等重复提交横幅（原型 AlertBanner tone=warning + View existing token）。 */}
      {duplicateCode && (
        <Alert variant="warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <AlertTitle>This token code is already registered.</AlertTitle>
            <AlertDescription>
              Re-submitting an existing token code returns its current status.
            </AlertDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() =>
              router.push(
                `${TOKEN_DETAIL_PATH}?code=${encodeURIComponent(duplicateCode)}`,
              )
            }
          >
            View existing token
          </Button>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="rounded-lg border border-border/60 bg-card">
          {/* 分区 1：Token Identity */}
          <section className="p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Token Identity
              </h2>
              <p className="text-sm text-muted-foreground">
                What this token is and the chain it lives on
              </p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <FormField
                  name="tokenCode"
                  label="Token Code"
                  required
                  maxLength={64}
                  error={formState.errors.tokenCode?.message}
                  register={register('tokenCode')}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Unique within this instance; also used as the currency system
                  code.
                </p>
              </div>
              <FormField
                name="tokenName"
                label="Token Name"
                required
                maxLength={64}
                error={formState.errors.tokenName?.message}
                register={register('tokenName')}
              />
              {/* 原型输入即 toUpperCase（用户键入小写自动转大写）。 */}
              <Controller
                control={control}
                name="symbol"
                render={({ field }) => (
                  <FormField
                    name="symbol"
                    label="Symbol"
                    required
                    maxLength={12}
                    error={formState.errors.symbol?.message}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <div>
                <FormField
                  name="chainType"
                  label="BlockChain"
                  required
                  maxLength={32}
                  error={formState.errors.chainType?.message}
                  register={register('chainType')}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The chain this token is issued on.
                </p>
              </div>
            </div>
          </section>

          {/* 分区 2：Value & Anchor */}
          <section className="border-t border-border/60 p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Value &amp; Anchor
              </h2>
              <p className="text-sm text-muted-foreground">
                Monetary precision and how the token value is anchored
              </p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <FormField
                name="decimalDigits"
                label="Decimals"
                required
                type="number"
                min={0}
                max={18}
                step={1}
                error={formState.errors.decimalDigits?.message}
                register={register('decimalDigits')}
              />
              {/* 固定主数据 Select（非 datalist 可输；原型表单主数据集）。 */}
              <FormSelect
                name="anchorFiat"
                control={control}
                label="Pegged Currency"
                required
                placeholder="Select Pegged Currency"
                error={formState.errors.anchorFiat?.message}
                options={PEGGED_CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <div className="sm:col-span-2">
                <FormField
                  name="contractAddress"
                  label="Contract Address"
                  maxLength={128}
                  error={formState.errors.contractAddress?.message}
                  register={register('contractAddress')}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Optional, for Kissen-side registration.
                </p>
              </div>
            </div>
          </section>

          {/* 分区 3：Additional Information */}
          <section className="border-t border-border/60 p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Additional Information
              </h2>
              <p className="text-sm text-muted-foreground">
                Optional context for Kissen&apos;s review
              </p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <FormField
                name="issuerDesc"
                label="Issuer Description"
                maxLength={500}
                error={formState.errors.issuerDesc?.message}
                register={register('issuerDesc')}
              />
              <FormField
                name="remark"
                label="Remarks"
                maxLength={500}
                error={formState.errors.remark?.message}
                register={register('remark')}
              />
            </div>
          </section>

          {/* 操作条落卡底（原型 FormActions：Cancel + Submit Registration）。 */}
          <div className="flex items-center justify-end gap-2 border-t border-border/60 p-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(TOKEN_LIST_PATH)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending && (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              )}
              Submit Registration
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────── 列表页 ─────────────────────────── */

type TokenFilters = {
  code: string;
  peggedCurrency: string;
  chain: string;
  status: string;
};

const TOKEN_FILTER_DEFAULT: TokenFilters = {
  code: '',
  peggedCurrency: '',
  chain: '',
  status: '',
};

/** 字符串数组去重排序（筛选项从当前数据派生：原型 options 来自接口）。 */
function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Token 管理页（registry token.list；/token/manage）。 */
export function TokenListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useTokenListQuery();

  const rows = data ?? [];
  const [filters, setFilters] = React.useState<TokenFilters>(TOKEN_FILTER_DEFAULT);
  const { sort, toggle } = useTableSort('syncedAt', 'desc');
  const columnPreferences = useColumnPreferences(
    TOKEN_COLUMN_PREF_KEY,
    TOKEN_COLUMNS,
  );

  // 列表失败 toast + Retry（tx/user 页约定；源 catch 静默靠拦截器）。
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load tokens', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  // 筛选下拉 options 从当前数据派生（Status 按生命周期 rank 排序）。
  const peggedOptions = React.useMemo(
    () => uniqueSorted(rows.map((r) => r.anchorFiat)),
    [rows],
  );
  const chainOptions = React.useMemo(
    () => uniqueSorted(rows.map((r) => r.chainType)),
    [rows],
  );
  const statusOptions = React.useMemo(
    () =>
      [...new Set(rows.map((r) => r.status))]
        .sort((a, b) => protoStatusRank(PROTO_TOKEN_STATUS, a) - protoStatusRank(PROTO_TOKEN_STATUS, b)),
    [rows],
  );

  // 本地过滤过渡（/token/list 无查询入参；后端参数就绪后回写为服务端检索）。
  const filtered = React.useMemo(() => {
    const q = filters.code.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || r.tokenCode.toLowerCase().includes(q)) &&
        (!filters.peggedCurrency || r.anchorFiat === filters.peggedCurrency) &&
        (!filters.chain || r.chainType === filters.chain) &&
        (!filters.status || String(r.status) === filters.status),
    );
  }, [rows, filters]);

  const sorted = React.useMemo(() => {
    const accessor = sort.key ? TOKEN_SORT_ACCESSORS[sort.key] : undefined;
    if (!accessor) return filtered;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...filtered].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [filtered, sort]);

  const tableData = React.useMemo(
    () => sorted.map((r) => ({ ...r, id: String(r.tokenId) })),
    [sorted],
  );

  const hasFilter =
    filters.code !== '' ||
    filters.peggedCurrency !== '' ||
    filters.chain !== '' ||
    filters.status !== '';
  const handleFilterReset = () => setFilters(TOKEN_FILTER_DEFAULT);

  const columns = React.useMemo<
    ColumnDef<TokenInfo & { id: string }>[]
  >(() => {
    const cols: ColumnDef<TokenInfo & { id: string }>[] = [
      {
        id: 'name',
        header: () => (
          <SortHeader
            label="Token Name"
            direction={sort.key === 'name' ? sort.direction : null}
            onToggle={() => toggle('name')}
          />
        ),
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold text-foreground">
              {row.original.tokenName || '-'}
            </span>
            {row.original.symbol ? (
              <span className="text-xs text-muted-foreground">
                {row.original.symbol}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'symbol',
        header: () => (
          <SortHeader
            label="Symbol"
            direction={sort.key === 'symbol' ? sort.direction : null}
            onToggle={() => toggle('symbol')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.symbol)}</span>
        ),
      },
      {
        id: 'decimals',
        header: () => (
          <SortHeader
            label="Decimals"
            direction={sort.key === 'decimals' ? sort.direction : null}
            onToggle={() => toggle('decimals')}
            numeric
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {orDash(row.original.decimalDigits)}
          </span>
        ),
      },
      {
        id: 'peggedCurrency',
        header: () => (
          <SortHeader
            label="Pegged Currency"
            direction={sort.key === 'peggedCurrency' ? sort.direction : null}
            onToggle={() => toggle('peggedCurrency')}
          />
        ),
        cell: ({ row }) => orDash(row.original.anchorFiat),
      },
      {
        id: 'chain',
        header: () => (
          <SortHeader
            label="BlockChain"
            direction={sort.key === 'chain' ? sort.direction : null}
            onToggle={() => toggle('chain')}
          />
        ),
        cell: ({ row }) => orDash(row.original.chainType),
      },
      {
        // GW-16 合一：tokenCode 同时是货币系统标识。
        id: 'tokenCode',
        header: 'Token Code (Currency System)',
        cell: ({ row }) => <CopyableId value={row.original.tokenCode} />,
      },
      {
        id: 'minLiquidity',
        header: () => (
          <SortHeader
            label="Min. Liquidity"
            direction={sort.key === 'minLiquidity' ? sort.direction : null}
            onToggle={() => toggle('minLiquidity', 'desc')}
            numeric
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatTokenAmount(row.original.minLiquidity)}
          </span>
        ),
      },
      {
        id: 'syncedAt',
        header: () => (
          <SortHeader
            label="Synced on (UTC+8)"
            direction={sort.key === 'syncedAt' ? sort.direction : null}
            onToggle={() => toggle('syncedAt', 'desc')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.pushTime)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <ProtoStatusBadge
              label={protoStatusText(PROTO_TOKEN_STATUS, row.original.status)}
              tone={TOKEN_STATUS_TONES[row.original.status] ?? 'muted'}
            />
          );
          // 源 el-tooltip :disabled="!row.rejectReason"：仅驳回原因存在时悬浮展示。
          return row.original.rejectReason ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default">{badge}</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {`Reject reason: ${row.original.rejectReason}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            badge
          );
        },
      },
      {
        // eafcab0：源行点击 openDetail → 操作列按钮（术语对齐原型 'Details'）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(
                `${TOKEN_DETAIL_PATH}?code=${encodeURIComponent(
                  row.original.tokenCode,
                )}`,
              )
            }
          >
            Details
          </Button>
        ),
      },
    ];
    return cols;
  }, [router, sort, toggle]);

  // 列偏好：required 列恒显，其余按用户选择过滤。
  const visibleColumns = React.useMemo(
    () => filterVisibleColumns(columns, TOKEN_COLUMNS, columnPreferences.isColumnVisible),
    [columns, columnPreferences],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 一句话口径）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Token
        </div>
        <h1 className="text-xl font-semibold">Token Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens this bank instance has registered, with the review status
          returned by Kissen.
        </p>
      </div>

      {/* 筛选卡（原型 Filters embedded：即时生效，无 Query 按钮）。 */}
      <section className="rounded-lg border border-border/60 bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="min-w-0">
            <Label className="mb-1.5 block">Token Code</Label>
            <Input
              value={filters.code}
              onChange={(e) =>
                setFilters((f) => ({ ...f, code: e.target.value }))
              }
              placeholder="Fuzzy match"
            />
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5 block">Pegged Currency</Label>
            <Select
              value={filters.peggedCurrency || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  peggedCurrency: v === 'all' ? '' : v,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {peggedOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5 block">BlockChain</Label>
            <Select
              value={filters.chain || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, chain: v === 'all' ? '' : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {chainOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5 block">Status</Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v === 'all' ? '' : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statusOptions.map((code) => (
                  <SelectItem key={code} value={String(code)}>
                    {protoStatusText(PROTO_TOKEN_STATUS, code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasFilter}
              onClick={handleFilterReset}
            >
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Tokens
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {tableData.length} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ColumnPicker
              columns={TOKEN_COLUMNS}
              isColumnVisible={columnPreferences.isColumnVisible}
              onColumnVisibilityChange={columnPreferences.setColumnVisible}
              onReset={columnPreferences.resetColumns}
            />
            {/* 源 v-perm="'bank:token:submit'"：未命中 menuKeys 不渲染；
                注册入口由弹窗改为页面（/token/create）。 */}
            {hasPerm(TOKEN_SUBMIT_PERM) && (
              <Button onClick={() => router.push(TOKEN_CREATE_PATH)}>
                <Plus className="size-4" aria-hidden="true" />
                Register Token
              </Button>
            )}
          </div>
        </div>

        <div className="p-4">
          <DataTable
            columns={visibleColumns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No tokens found. Try adjusting the filters, or register the first token."
          />
          {/* 源 .footnote（d764217 三段口径：注册前置/幂等/审核结果同步）。 */}
          <p className="mt-4 text-xs text-muted-foreground">
            Tokens are registered on the platform after your gateway instance
            is activated. Registering a token that already exists simply
            returns its current status. Registration results appear here
            automatically once review is complete.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── 详情页 ─────────────────────────── */

/** STATIC-FILLER(GAP-GW-01): /tx/page 无 tokenCode 过滤参数，按 token 关联的
 * 交易列表待后端；列契约按原型 transactions 表落地，数据恒 []。 */
const TX_TAB_COLUMNS: ColumnDef<{ id: string }>[] = [
  { id: 'transactionNo', header: 'Transaction No.' },
  { id: 'tokens', header: 'Tokens' },
  { id: 'from', header: 'From' },
  { id: 'to', header: 'To' },
  { id: 'createdAt', header: 'Created on (UTC+8)' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' },
];

/** STATIC-FILLER(GAP-GW-01): /log/page 仅 userId/module/时间区间过滤，无
 * entityType/entityKey 按业务对象关联参数，操作记录 Tab 无法按 token 过滤；
 * 列契约按原型 operations 表落地，数据恒 []（缺口与 GAP-GW-01 同族）。 */
const OPS_TAB_COLUMNS: ColumnDef<{ id: string }>[] = [
  { id: 'createdAt', header: 'Timestamp (UTC+8)' },
  { id: 'operation', header: 'Operation' },
  { id: 'result', header: 'Result' },
  { id: 'operator', header: 'Operator' },
];

const STATIC_EMPTY_ROWS: { id: string }[] = [];

/**
 * token 详情页（registry token.detail；/token/manage/detail?code={tokenCode}）。
 * 原型 2026-09-22 版式：页头（Back + tokenName + 状态徽章 + meta 行 Token Code |
 * Synced on）→ 页面级 Tabs（basic/transactions/operations，?tab= 写 URL）→ 各
 * Tab 面板卡；未命中（null）→ 空态（详情仅本行本实例可见）。
 */
export function TokenDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenCode = searchParams.get('code')?.trim() ?? '';

  const {
    data: token,
    isLoading,
    isError,
    error,
    refetch,
  } = useTokenDetailQuery(tokenCode || undefined);

  const toast = useToast();
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load token detail', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab =
    tabParam === 'transactions' || tabParam === 'operations'
      ? tabParam
      : 'basic';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    params.set('code', tokenCode);
    if (next !== 'basic') params.set('tab', next);
    router.replace(
      `${TOKEN_DETAIL_PATH}?${params.toString()}`,
      { scroll: false },
    );
  };

  if (!tokenCode) {
    return (
      <MissingIdBlock
        message="Missing a token code. Unable to view details."
        backTo={TOKEN_LIST_PATH}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头：Back + tokenName + 状态徽章 + meta 行（Token Code | Synced on）。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to token list"
          onClick={() => router.push(TOKEN_LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-all text-xl font-semibold">
              {token ? token.tokenName || 'Token Details' : 'Token Details'}
            </h1>
            {token ? (
              <ProtoStatusBadge
                label={protoStatusText(PROTO_TOKEN_STATUS, token.status)}
                tone={TOKEN_STATUS_TONES[token.status] ?? 'muted'}
              />
            ) : null}
          </div>
          {token ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                Token Code: <CopyableId value={token.tokenCode} />
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Synced on {formatUtc8(token.pushTime)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {token ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Tabs 条独立于 Card（原型 §3.3）；计数为列表 total（静态 Tab 恒 0）。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="transactions">
              Transactions
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                0
              </span>
            </TabsTrigger>
            <TabsTrigger value="operations">
              Operation Records
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                0
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1：basic = Basic Information 卡 + Status & Sync 卡。 */}
          <TabsContent value="basic" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-border/60 bg-card p-4">
                <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                  Basic Information
                </h2>
                <DescGrid cols={2}>
                  <DescField label="Token Code (Currency System)">
                    <CopyableId value={token.tokenCode} />
                  </DescField>
                  <DescField label="Token Name">
                    {token.tokenName || '-'}
                  </DescField>
                  <DescField label="Symbol">
                    <span className="font-mono">{orDash(token.symbol)}</span>
                  </DescField>
                  <DescField label="Decimals">
                    <span className="tabular-nums">
                      {orDash(token.decimalDigits)}
                    </span>
                  </DescField>
                  <DescField label="BlockChain">
                    {orDash(token.chainType)}
                  </DescField>
                  <DescField label="Pegged Currency">
                    {orDash(token.anchorFiat)}
                  </DescField>
                  {/* 原型 formatAmount：千分位、小数位原样保留（proto-format
                      formatTokenAmount 同口径，替换旧 toFixed(2)）。 */}
                  <DescField label="Min. Liquidity">
                    <span className="tabular-nums">
                      {formatTokenAmount(token.minLiquidity)}
                    </span>
                  </DescField>
                  <DescField label="Token Type">
                    {tokenTypeText(token.tokenType)}
                  </DescField>
                </DescGrid>
              </section>

              <section className="rounded-lg border border-border/60 bg-card p-4">
                <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                  Status &amp; Sync
                </h2>
                <DescGrid cols={2}>
                  {/* 状态徽章已在页头常驻，正文不重复（原型 §3.15）。 */}
                  <DescField label="Reject Reason">
                    <span className="break-words">
                      {orDash(token.rejectReason)}
                    </span>
                  </DescField>
                  <DescField label="Token No (Network-wide Unique)">
                    {token.tokenNo ? (
                      <CopyableId value={token.tokenNo} />
                    ) : (
                      /* 源 tokenNo 空 → 「Pending」占位（平台登记后下发）。 */
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </DescField>
                  <DescField label="Scope">
                    {tokenScopeText(token.tokenScope)}
                  </DescField>
                  <DescField label="Version">
                    <span className="tabular-nums">
                      {orDash(token.version)}
                    </span>
                  </DescField>
                  <DescField label="Synced on">
                    <span className="tabular-nums">
                      {formatUtc8(token.pushTime)}
                    </span>
                  </DescField>
                </DescGrid>
              </section>
            </div>
          </TabsContent>

          {/* Tab 2：transactions（GAP-GW-01 静态空表）。 */}
          <TabsContent value="transactions" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Transactions
                </h2>
              </div>
              <div className="p-4">
                <DataTable
                  columns={TX_TAB_COLUMNS}
                  data={STATIC_EMPTY_ROWS}
                  emptyMessage="No transactions found. Transactions involving this token will appear here."
                />
              </div>
            </section>
          </TabsContent>

          {/* Tab 3：operations（GAP-GW-01 同族静态空表）。 */}
          <TabsContent value="operations" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Operation Records
                </h2>
              </div>
              <div className="p-4">
                <DataTable
                  columns={OPS_TAB_COLUMNS}
                  data={STATIC_EMPTY_ROWS}
                  emptyMessage="No operation records yet. Operations on this record will appear here."
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <EmptyHint text="Token not found (possibly not synced, or not visible to this bank)." />
        </section>
      )}
    </div>
  );
}
