'use client';

/**
 * 资金池页（源 `src/views/pool/index.vue` 1:1 迁移，FAIL 修复 B，基线 01 §D4）。
 *
 * 源语义要点（行号对照源文件）：
 * - 头部：eyebrow LIQUIDITY + 标题（源 6-7）；右 SyncRefreshButton domain=pool，
 *   刷新成功重拉当前列表（源 10 @refreshed="load"）；主按钮「申请开通资金池」
 *   经 PermButton 页面键门禁（源 11 el-button primary，LP 侧按钮粒度取页面键，
 *   同 user/role/menu 先例）。
 * - 表格 8 列全列序（源 17-58）：池 ID / Token tag / 池地址 maskAddress+tooltip
 *   原文 / 可用余额 formatMoney 右对齐 / 水位条(level null→'-') /
 *   余额数据时间(balanceUpdateTime falsy→'-') / 状态 tag(status===15 且
 *   rejectReason 有值时 tooltip 驳回原因) / 数据时间。
 * - STATUS 四码表：5 Pending / 15 Rejected / 20 Active / 50 Disabled（域模型）。
 * - 开池弹窗 520px（源 63-93）：顶部固定 info alert；token 下拉（选项来自
 *   token 列表接口，label `${tokenCode} (${bankName})`，选中后提示最低流动性
 *   与链型）；池地址必填；货币系统形态 select 默认 1；补资提醒阈值 0〜1
 *   step0.05 默认 0.2。手写校验缺 token 或地址 → warning toast（源 submitApply）；
 *   成功 toast + 关窗 + 重载（源 ElMessage.success → close → load）。
 * - 空态引导文案（源 60 empty description 英文化）；单页只读 + 页内弹窗，
 *   无 create/edit/detail 子路由（barrel 导出 PoolListPage 不变）。
 */

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  POOL_STATUS_TEXT,
  POOL_STATUS_VARIANT,
  POOL_SYSTEM_TYPE_TEXT,
  usePoolApplyMutation,
  usePoolListQuery,
  useTokenListQuery,
  type PoolRow,
  type TokenRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { PermButton } from './perm-button';
import { formatMoney, formatTime, maskAddress } from './format';

/* ================================================================== */
/* 常量                                                                 */
/* ================================================================== */

const LBL = {
  eyebrow: 'LIQUIDITY',
  title: 'Liquidity Pools',
  apply: 'Apply for Liquidity Pool',
  dialogTitle: 'Apply for Liquidity Pool',
  alertTitle: 'KLPP approval required',
  alertBody:
    'Applications are activated after admin-side (KLPP) approval; pools do not join matching until approved. Initial funding is topped up directly in the currency system once approval passes.',
  empty:
    'No liquidity pools yet — pick a token from the Token overview to submit an application',
} as const;

/** 开池弹窗表单状态（源 reactive form 四字段同构）。 */
interface ApplyFormState {
  tokenId?: number;
  accountAddress: string;
  currencySystemType: number;
  /** 水位提醒阈值，比率 0〜1，步进 0.05，默认 0.2（源 el-input-number 口径）。 */
  remindThreshold: number;
}

const APPLY_INITIAL: ApplyFormState = {
  accountAddress: '',
  currencySystemType: 1,
  remindThreshold: 0.2,
};

/** 货币系统形态下拉项（源三枚硬编码 option 的码表化）。 */
const SYSTEM_TYPE_OPTIONS = [1, 2, 3].map((v) => ({
  value: String(v),
  label: POOL_SYSTEM_TYPE_TEXT[v],
}));

/* ================================================================== */
/* 单元格渲染                                                           */
/* ================================================================== */

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 数值文本（源 .num 类：等宽字体 + 数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs tabular-nums">{children}</span>;
}

/** 金额单元格：formatMoney + 右对齐（源「可用余额」列 align="right"）。 */
function MoneyCell({ v }: { v: number | string }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatMoney(v)}
    </span>
  );
}

/** 小数比率 → 百分比文本，保留 1 位小数（源 percentText）；空（含 undefined）→ '-'。 */
function percentText(v: number | string | null | undefined): string {
  return v == null ? '-' : `${(Number(v) * 100).toFixed(1)}%`;
}

/** 水位条宽 = clamp(level×100, 0, 100)%（源 levelBarWidth）。 */
function levelBarWidth(row: PoolRow): string {
  return `${Math.min(100, Math.max(0, Number(row.level) * 100))}%`;
}

/**
 * 池状态 Badge：未知码显原值，variant 兜底 secondary（源兜底 info 的中性映射）；
 * status===15 且 rejectReason 有值时挂 tooltip 展示驳回原因（源状态列三元分支）。
 */
function PoolStatusCell({ row }: { row: PoolRow }) {
  const variant: BadgeVariant = POOL_STATUS_VARIANT[row.status] ?? 'secondary';
  const badge = (
    <Badge variant={variant}>
      {POOL_STATUS_TEXT[row.status] ?? row.status}
    </Badge>
  );
  if (row.status === 15 && row.rejectReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">
          Rejection reason: {row.rejectReason}
        </TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}

/** 水位单元格：level 非 null 显 96px 宽进度条 + 百分比；null（分母缺失）显 '-'。 */
function LevelCell({ row }: { row: PoolRow }) {
  if (row.level == null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {/* 96px 进度条：源 .level-bar/.level-fill 同款尺寸 */}
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: levelBarWidth(row) }}
        />
      </div>
      <Num>{percentText(row.level)}</Num>
    </div>
  );
}

/* ================================================================== */
/* 开池申请弹窗（FR-LW-03）                                             */
/* ================================================================== */

function ApplyPoolDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const toast = useToast();
  const applyMutation = usePoolApplyMutation();
  // token 下拉数据源（token 域 list，body {} 即已生效全集；TanStack 缓存
  // 天然承接源「缓存空时拉取」，重复打开不重复请求新页面实例之外的负担）
  const { data: tokens, isPending: loadingTokens } =
    useTokenListQuery(LP_PROJECT_ID);
  const [form, setForm] = React.useState<ApplyFormState>(APPLY_INITIAL);

  // 源 openApply 语义：每次打开先重置四字段再展示
  React.useEffect(() => {
    if (open) setForm(APPLY_INITIAL);
  }, [open]);

  const patchForm = (patch: Partial<ApplyFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const tokenOptions = React.useMemo(
    () =>
      (tokens ?? []).map((t: TokenRow) => ({
        value: String(t.tokenId),
        // 半角括号英文风格（工单指定；源为全角括号）
        label: `${t.tokenCode} (${t.bankName})`,
      })),
    [tokens],
  );

  const selectedToken = (tokens ?? []).find((t) => t.tokenId === form.tokenId);

  /** 阈值输入收敛：NaN→0、限幅 0〜1、precision 2（源 :min/:max/:precision）。 */
  const handleThresholdChange = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      patchForm({ remindThreshold: 0 });
      return;
    }
    const clamped = Math.min(1, Math.max(0, n));
    patchForm({ remindThreshold: Math.round(clamped * 100) / 100 });
  };

  const submitApply = () => {
    // 手写校验同源 submitApply：缺 token 或地址 → warning toast
    if (!form.tokenId || !form.accountAddress.trim()) {
      toast.warning('Please choose a token and enter the pool address');
      return;
    }
    applyMutation.mutate(
      {
        tokenId: form.tokenId,
        accountAddress: form.accountAddress.trim(),
        currencySystemType: form.currencySystemType,
        remindThreshold: form.remindThreshold,
      },
      {
        onSuccess: () => {
          toast.success(
            'Application received — pending KLPP approval; the result will sync into this list automatically',
          );
          onOpenChange(false);
        },
        // 错误链路由 lp-client 拦截器统一提示（源 catch 静默等价）
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- silent: lp-client interceptor owns error surfacing
        onError: () => {},
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{LBL.dialogTitle}</DialogTitle>
        </DialogHeader>

        {/* 固定 info 提示（源 el-alert info 文案位） */}
        <Alert>
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <AlertTitle>{LBL.alertTitle}</AlertTitle>
            <AlertDescription>{LBL.alertBody}</AlertDescription>
          </div>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Token</Label>
            <SelectField
              value={form.tokenId != null ? String(form.tokenId) : ''}
              onValueChange={(v) => patchForm({ tokenId: Number(v) })}
              placeholder="Select an active token"
              options={tokenOptions}
              disabled={loadingTokens}
            />
            {selectedToken && (
              <p className="mt-1 text-xs text-muted-foreground">
                Min liquidity {formatMoney(selectedToken.minLiquidity)} · Chain{' '}
                {selectedToken.chainType || '-'}
              </p>
            )}
          </div>

          <FormField
            name="accountAddress"
            label="Pool Address"
            required
            placeholder="Account address in the currency system"
            value={form.accountAddress}
            onChange={(e) => patchForm({ accountAddress: e.target.value })}
          />

          <div>
            <Label className="mb-1.5 block">Currency System Type</Label>
            <SelectField
              value={String(form.currencySystemType)}
              onValueChange={(v) =>
                patchForm({ currencySystemType: Number(v) })
              }
              options={SYSTEM_TYPE_OPTIONS}
            />
          </div>

          <div>
            <FormField
              name="remindThreshold"
              label="Top-up Reminder Threshold"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={String(form.remindThreshold)}
              onChange={(e) => handleThresholdChange(e.target.value)}
            />
            <p className="-mt-1 text-xs text-muted-foreground">
              Level ratio, 0–1
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submitApply} disabled={applyMutation.isPending}>
            Submit Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

/**
 * 受控 Select 薄封装（Radix）：弹窗内两处下拉共用；options 已由上游保证
 * value 非空唯一（tokenId 主键 / 固定码表）。
 */
function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PoolListPage() {
  const [applyOpen, setApplyOpen] = React.useState(false);

  // 主表数据源（不分页全量；源 load() 直连 poolApi.list 等价）
  const listQuery = usePoolListQuery(LP_PROJECT_ID);
  const rows = listQuery.data ?? [];

  const columns = React.useMemo<ColumnDef<PoolRow & { id: string }>[]>(
    () => [
      // 源列序 1：池 ID（width 90，num）
      {
        accessorKey: 'poolId',
        header: 'Pool ID',
        cell: ({ row }) => <Num>{row.original.poolId}</Num>,
      },
      // 源列序 2：Token（plain round tag + 银行行；v2.4 两行式）
      {
        accessorKey: 'tokenCode',
        header: 'Token',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Badge
              variant="outline"
              className="w-fit rounded-full font-normal font-mono"
            >
              {row.original.tokenCode}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {row.original.bankName || row.original.bankCode || '-'}
            </div>
          </div>
        ),
      },
      // 源列序 3：池地址（maskAddress + tooltip 全文）
      {
        accessorKey: 'poolAddress',
        header: 'Pool Address',
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs">
                {maskAddress(row.original.poolAddress)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm break-all font-mono text-xs">
              {row.original.poolAddress}
            </TooltipContent>
          </Tooltip>
        ),
      },
      // 源列序 4：可用余额（formatMoney 右对齐）
      {
        accessorKey: 'availableBalanceCache',
        header: 'Available Balance',
        cell: ({ row }) => <MoneyCell v={row.original.availableBalanceCache} />,
      },
      // 源列序 5（v2.4 新增）：授权额度（preauthAuthAmount；null → '-'
      // 挂 tooltip「暂无预授权快照」——preauth 独立页退役后快照并入池列表）
      {
        accessorKey: 'preauthAuthAmount',
        header: 'Authorized Amount',
        cell: ({ row }) =>
          row.original.preauthAuthAmount == null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>-</span>
              </TooltipTrigger>
              <TooltipContent>No pre-authorization snapshot</TooltipContent>
            </Tooltip>
          ) : (
            <MoneyCell v={row.original.preauthAuthAmount} />
          ),
      },
      // 源列序 6（v2.4 新增）：可用授权额度（null → '-'，无 tooltip）
      {
        accessorKey: 'preauthAvailableAmount',
        header: 'Available Authorization',
        cell: ({ row }) =>
          row.original.preauthAvailableAmount == null ? (
            <span>-</span>
          ) : (
            <MoneyCell v={row.original.preauthAvailableAmount} />
          ),
      },
      // 源列序 7：水位（level!=null → 进度条 + 百分比；null → '-'）
      {
        accessorKey: 'level',
        header: 'Level',
        cell: ({ row }) => <LevelCell row={row.original} />,
      },
      // 源列序 8：余额数据时间（balanceUpdateTime falsy → '-'）
      {
        accessorKey: 'balanceUpdateTime',
        header: 'Balance Data Time',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.balanceUpdateTime
              ? formatTime(row.original.balanceUpdateTime)
              : '-'}
          </span>
        ),
      },
      // 源列序 7：状态（15 && rejectReason → tooltip 驳回原因）
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PoolStatusCell row={row.original} />,
      },
      // 源列序 8：数据时间
      {
        accessorKey: 'syncTime',
        header: 'Data Time',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {formatTime(row.original.syncTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.poolId) })),
    [rows],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {LBL.eyebrow}
            </div>
            <h1 className="text-xl font-semibold">{LBL.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 源 @refreshed="load"：仅重拉当前视图 */}
            <SyncRefreshButton
              domain="pool"
              onRefreshed={() => void listQuery.refetch()}
            />
            {/* 源主按钮（页面键门禁，v-perm 移除语义等价） */}
            <PermButton
              menuKey="lp:pool"
              onClick={() => {
                setApplyOpen(true);
              }}
            >
              {LBL.apply}
            </PermButton>
          </div>
        </div>

        <div className="rounded-lg border-border/60 bg-card shadow-float">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={listQuery.isPending}
            emptyMessage={LBL.empty}
          />
        </div>

        <ApplyPoolDialog open={applyOpen} onOpenChange={setApplyOpen} />
      </div>
    </TooltipProvider>
  );
}
