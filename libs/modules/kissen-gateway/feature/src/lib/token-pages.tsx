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
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';

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
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';

import {
  tokenStatusText,
  tokenStatusVariant,
  useSubmitTokenMutation,
  useTokenListQuery,
  type TokenInfo,
} from '@myorg/modules/kissen-gateway/data-access';

import { fmtAmount, formatTime } from './kit';
import { PageHead } from './page-head';
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

        <form onSubmit={onSubmit} className="space-y-4">
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
          <FormField
            name="issuerDesc"
            label="Issuer Description"
            maxLength={128}
            placeholder="Optional"
            error={formState.errors.issuerDesc?.message}
            register={register('issuerDesc')}
          />
          <div className="space-y-1.5">
            <label htmlFor="gw-token-remark" className="block text-sm font-medium text-foreground">
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
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { data, isLoading, isError, error, refetch } = useTokenListQuery();

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
          <div className="text-right tabular-nums">{row.original.decimalDigits}</div>
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
          <div className="text-right tabular-nums">
            {fmtAmount(row.original.minLiquidity)}
          </div>
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
          <span className="font-mono">{formatTime(row.original.pushTime)}</span>
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
      <PageHead variant="toolbar" title="Token Management">
        {/* 源 v-perm="'bank:token:submit'"：未命中 menuKeys 不渲染。 */}
        {hasPerm(TOKEN_SUBMIT_PERM) && (
          <Button onClick={() => setDialogOpen(true)}>Register Token</Button>
        )}
      </PageHead>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
        />
        {/* 源 .footnote（12px 灰）：注册前置/幂等/审核结果推送通道三段说明
            （39c8a2b「同步状态」兜底字样移除）。 */}
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          Prerequisites: the instance is activated and the bank is onboarded.
          Submitting an existing token code again returns the original application
          status (idempotent). Review results are written back via platform
          biz-event pushes.
        </p>
      </div>

      {dialogOpen && (
        <TokenSubmitDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}
