'use client';

/**
 * Token 管理页（源 `views/token/manage.vue`：10 列表格 + 注册 dialog）。
 * 路由 /token/manage（registry：token → list）。
 *
 * - 10 列（39c8a2b UDPN 列序）：tokenName/symbol/decimalDigits/anchorFiat/
 *   chainType/tokenCode/tokenNo/minLiquidity/status/pushTime。
 * - 状态列驳回原因：源 el-tooltip(:disabled="!row.rejectReason") → Badge 外
 *   包 span 的 Radix Tooltip（Badge 不转发 ref，asChild 需原生 span）。
 * - 39c8a2b：「同步状态」按钮与 status 驳回态行内「Resubmit」入口一并移除
 *   （审核结果由平台 biz-event 推送回写）；仅头部「Register Token」保留
 *   'bank:token:submit' 权限门控（源 v-perm 未命中即不渲染）。
 * - 源 el-select filterable allow-create（链类型/锚定法币可输入自定义值）→
 *   原生 input[datalist] 组合框（禁新依赖下最贴近的等价物：可选可输）。
 * - 服务端状态 TanStack Query；列表失败 toast + Retry（tx/user 页约定）。
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Skeleton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  tokenScopeText,
  tokenStatusText,
  tokenStatusVariant,
  tokenTypeText,
  useSubmitTokenMutation,
  useTokenDetailQuery,
  useTokenListQuery,
  type TokenInfo,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { fmtAmount, formatTime, orDash } from './kit';
import { PageHead } from './page-head';
import { EmptyHint, MissingIdBlock } from './state-blocks';
import { useGatewayPerm } from './use-gateway-perm';

/** token 提交权限码（源 v-perm="'bank:token:submit'"，头部注册入口）。 */
const TOKEN_SUBMIT_PERM = 'bank:token:submit';


/** 源 chainOptions（el-select allow-create 枚举，输入自定义值亦合法）。 */
const CHAIN_OPTIONS = ['Ethereum', 'BSC', 'TRON', 'Aptos', 'Polygon', 'Arbitrum'];

/** 源 fiatOptions（ISO 4217 锚定法币枚举，同样 allow-create）。 */
const FIAT_OPTIONS = ['USD', 'CNY', 'EUR', 'HKD', 'JPY', 'KRW', 'SGD', 'GBP'];


/* ================================================================== */
/* 注册对话框（源 el-dialog 9 字段 + formRules 六项必填）           */
/* ================================================================== */

/**
 * 表单校验（源 formRules 逐字等义）：必填五项文案 + decimalDigits 的
 * el-input-number :min="0" :max="18" 机械约束。
 */
const tokenFormSchema = z.object({
  tokenCode: z.string().min(1, { message: 'Please enter the token code' }),
  tokenName: z.string().min(1, { message: 'Please enter the token name' }),
  symbol: z.string().min(1, { message: 'Please enter the symbol' }),
  decimalDigits: z
    .string()
    .min(1, { message: 'Please enter the decimal places' })
    .refine((v) => Number(v) >= 0 && Number(v) <= 18, {
      message: 'Decimal places must be a number between 0 and 18',
    }),
  chainType: z.string().min(1, { message: 'Please select a chain type' }),
  anchorFiat: z
    .string()
    .min(1, { message: 'Please select the anchor fiat currency' }),
  contractAddress: z.string(),
  issuerDesc: z.string(),
  remark: z.string(),
});

type TokenFormValues = z.infer<typeof tokenFormSchema>;

/** 源 emptyForm() 默认值（decimalDigits 8，其余空串）。 */
const TOKEN_FORM_DEFAULT: TokenFormValues = {
  tokenCode: '',
  tokenName: '',
  symbol: '',
  decimalDigits: '8',
  chainType: '',
  anchorFiat: '',
  contractAddress: '',
  issuerDesc: '',
  remark: '',
};

/**
 * 注册对话框。由父级条件渲染——每次打开重新挂载（等价源 openCreate 的
 * Object.assign(form, emptyForm()) + nextTick clearValidate）；39c8a2b 后
 * 仅注册态（驳回重提流程已随「同步状态」一并移除）。
 */
function TokenSubmitDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const submitMutation = useSubmitTokenMutation();

  const { register, handleSubmit, control, formState } =
    useForm<TokenFormValues>({
      resolver: createFormResolver(tokenFormSchema),
      mode: 'onTouched',
      defaultValues: TOKEN_FORM_DEFAULT,
    });

  const onSubmit = handleSubmit((v) => {
    // 源提交 {...form}：九字段全量（可选字段空串原样上送）。
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
            // 源 warning：已存在同编码申请（当前状态:xx）,未重复上行。
            toast.warning(
              `An application with this token code already exists (current status: ${tokenStatusText(
                resp.status,
              )}); the request was not sent again`,
            );
          } else if (resp.status === 5) {
            // 源 success：已提交注册,等待平台审核。
            toast.success('Registration submitted, waiting for platform review');
          } else {
            // 源 success：提交成功（状态:xx）。
            toast.success(
              `Submitted successfully (status: ${tokenStatusText(resp.status)})`,
            );
          }
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* 源 el-dialog width="560px"。 */}
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Register Token</DialogTitle>
          <DialogDescription>
            Register a new token for this instance
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* 轻分节（§6.4）：身份 / 价值锚定 / 补充说明三组，字段语义就近。 */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Token Identity
              </h3>
              <p className="text-sm text-muted-foreground">
                What this token is and the chain it lives on
              </p>
            </div>
            <FormField
              name="tokenCode"
              label="Token Code"
              required
              maxLength={32}
              placeholder="e.g. CNB-001 (unique within this instance; also the currency system code)"
              error={formState.errors.tokenCode?.message}
              register={register('tokenCode')}
            />
            <FormField
              name="tokenName"
              label="Token Name"
              required
              maxLength={64}
              placeholder="e.g. Kissen CNY Bond"
              error={formState.errors.tokenName?.message}
              register={register('tokenName')}
            />
            <FormField
              name="symbol"
              label="Symbol"
              required
              maxLength={16}
              placeholder="e.g. kCNY"
              error={formState.errors.symbol?.message}
              register={register('symbol')}
            />
            {/* 源 el-select filterable allow-create → input + datalist 组合框。 */}
            <Controller
              control={control}
              name="chainType"
              render={({ field }) => (
                <>
                  <datalist id="gw-token-chain-options">
                    {CHAIN_OPTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <FormField
                    name="chainType"
                    label="Chain Type"
                    required
                    placeholder="Select or enter a chain type"
                    className="max-w-[180px]"
                    error={formState.errors.chainType?.message}
                    list="gw-token-chain-options"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </>
              )}
            />
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Value &amp; Anchor
              </h3>
              <p className="text-sm text-muted-foreground">
                Monetary precision and how the token value is anchored
              </p>
            </div>
            <FormField
              name="decimalDigits"
              label="Decimal Places"
              required
              type="number"
              min={0}
              max={18}
              step={1}
              placeholder="0-18"
              className="max-w-[180px]"
              error={formState.errors.decimalDigits?.message}
              register={register('decimalDigits')}
            />
            <Controller
              control={control}
              name="anchorFiat"
              render={({ field }) => (
                <>
                  <datalist id="gw-token-fiat-options">
                    {FIAT_OPTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <FormField
                    name="anchorFiat"
                    label="Anchor Fiat"
                    required
                    placeholder="ISO 4217 fiat code"
                    className="max-w-[180px]"
                    error={formState.errors.anchorFiat?.message}
                    list="gw-token-fiat-options"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </>
              )}
            />
            <FormField
              name="contractAddress"
              label="Contract Address"
              maxLength={128}
              placeholder="Optional, for admin-side registration"
              error={formState.errors.contractAddress?.message}
              register={register('contractAddress')}
            />
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Additional Information
              </h3>
              <p className="text-sm text-muted-foreground">
                Optional context for the platform review
              </p>
            </div>
            <FormField
              name="issuerDesc"
              label="Issuer Description"
              maxLength={128}
              placeholder="Optional"
              error={formState.errors.issuerDesc?.message}
              register={register('issuerDesc')}
            />
            <div>
              <label
                htmlFor="gw-token-remark"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Remarks
              </label>
              <Textarea
                id="gw-token-remark"
                rows={2}
                maxLength={200}
                placeholder="Optional"
                {...register('remark')}
              />
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="animate-spin" />}
              Submit Registration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

/** Token 管理页（registry token.list 键映射；导出名不可改）。 */
export function TokenListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useTokenListQuery();

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const rows = data ?? [];

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

  const columns = React.useMemo<ColumnDef<TokenInfo & { id: string }>[]>(
    () => [
      { accessorKey: 'tokenName', header: 'Token Name' },
      {
        id: 'symbol',
        header: 'Token Symbol',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.symbol}</span>
        ),
      },
      {
        id: 'decimalDigits',
        header: 'Decimals',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.decimalDigits}
          </span>
        ),
      },
      { accessorKey: 'anchorFiat', header: 'Anchored Fiat' },
      { accessorKey: 'chainType', header: 'Chain' },
      {
        // GW-16 合一：tokenCode 同时是货币系统标识（源列头「tokenCode（货币系统 code）」）。
        id: 'tokenCode',
        header: 'tokenCode (currency system code)',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.tokenCode}</span>
        ),
      },
      {
        id: 'tokenNo',
        header: 'Token No. (assigned once active)',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.tokenNo || '-'}</span>
        ),
      },
      {
        id: 'minLiquidity',
        header: 'Min Liquidity',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {fmtAmount(row.original.minLiquidity)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <Badge variant={tokenStatusVariant(row.original.status)}>
              {tokenStatusText(row.original.status)}
            </Badge>
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
        id: 'pushTime',
        header: 'Push Time',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.pushTime)}</span>
        ),
      },
      {
        // eafcab0：源行点击 openDetail → 操作列 Detail 按钮（下游列表约定）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(
                `/token/manage/detail?code=${encodeURIComponent(row.original.tokenCode)}`,
              )
            }
          >
            Detail
          </Button>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.tokenId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <PageHead variant="toolbar" title="Token Management" />

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Tokens
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {rows.length} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 源 v-perm="'bank:token:submit'"：未命中 menuKeys 不渲染。 */}
          {hasPerm(TOKEN_SUBMIT_PERM) && (
            <Button onClick={() => setDialogOpen(true)}>Register Token</Button>
          )}
        </div>

        <div className="p-4">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No tokens registered yet"
          />
          {/* 源 .footnote（12px 灰）：注册前置/幂等/审核结果推送通道三段说明
              （39c8a2b「同步状态」兜底字样移除）。 */}
          <p className="mt-4 text-xs text-muted-foreground">
            Prerequisites: the instance is activated and the bank is onboarded.
            Submitting an existing token code again returns the original
            application status (idempotent). Review results are written back via
            platform biz-event pushes.
          </p>
        </div>
      </section>

      {dialogOpen && (
        <TokenSubmitDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}

/* ================================================================== */
/* 详情页（eafcab0 源 `views/token/detail.vue`）                      */
/* ================================================================== */

/**
 * token 详情页（registry token.detail；/token/manage/detail?code={tokenCode}）。
 * 源布局：eyebrow TOKEN + tokenName + 状态 tag，Basic Information /
 * Status & Sync 两卡；未命中（null）→ 空态（详情仅本行本实例可见）。
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

  if (!tokenCode) {
    return (
      <MissingIdBlock
        message="Missing a token code. Unable to view details."
        backTo="/token/manage"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* §6.3 Hero：eyebrow TOKEN（源页面 eyebrow）+ tokenName + 状态 Badge + Back。 */}
      <section className="rounded-lg border border-border/60 bg-card panel-pad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Token
              </div>
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                {token ? token.tokenName : 'Token Detail'}
              </h1>
            </div>
            {token ? (
              <Badge variant={tokenStatusVariant(token.status)}>
                {tokenStatusText(token.status)}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/token/manage')}
          >
            Back
          </Button>
        </div>
      </section>

      {token ? (
        <>
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <h2 className="mb-2.5 text-sm font-semibold text-foreground">
              Basic Information
            </h2>
            <DescGrid cols={2}>
              <DescField label="tokenCode (currency system code)">
                <span className="font-mono">{token.tokenCode}</span>
              </DescField>
              <DescField label="csTokenCode">
                <span className="font-mono">{orDash(token.csTokenCode)}</span>
              </DescField>
              <DescField label="Token Name">{token.tokenName}</DescField>
              <DescField label="Symbol">
                <span className="font-mono">{token.symbol}</span>
              </DescField>
              <DescField label="Decimals">
                <span className="tabular-nums">{token.decimalDigits}</span>
              </DescField>
              <DescField label="Chain">{orDash(token.chainType)}</DescField>
              <DescField label="Anchored Fiat">
                {orDash(token.anchorFiat)}
              </DescField>
              <DescField label="Min Liquidity">
                <span className="t-data tabular-nums">
                  {fmtAmount(token.minLiquidity)}
                </span>
              </DescField>
              <DescField label="Token Type">
                {tokenTypeText(token.tokenType)}
              </DescField>
            </DescGrid>
          </section>

          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <h2 className="mb-2.5 text-sm font-semibold text-foreground">
              Status &amp; Sync
            </h2>
            <DescGrid cols={2}>
              <DescField label="Status">
                <Badge variant={tokenStatusVariant(token.status)}>
                  {tokenStatusText(token.status)}
                </Badge>
              </DescField>
              <DescField label="Reject Reason">
                <span className="break-words">{orDash(token.rejectReason)}</span>
              </DescField>
              <DescField label="Token No. (assigned once active)">
                {/* 源 tokenNo 空 → 「Pending」占位。 */}
                {token.tokenNo ? (
                  <span className="font-mono">{token.tokenNo}</span>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </DescField>
              <DescField label="Scope">
                {tokenScopeText(token.tokenScope)}
              </DescField>
              <DescField label="Version">
                <span className="tabular-nums">{orDash(token.version)}</span>
              </DescField>
              <DescField label="Push Time">
                <span className="font-mono">{formatTime(token.pushTime)}</span>
              </DescField>
            </DescGrid>
          </section>
        </>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card panel-pad">
          <EmptyHint text="Token not found (possibly not synced, or not visible to this bank)." />
        </section>
      )}
    </div>
  );
}
