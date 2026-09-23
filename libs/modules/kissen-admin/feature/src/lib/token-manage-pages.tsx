'use client';

/**
 * Token 管理页 + 网关实例管理页（registry token → TokenManageListPage、
 * instance → GatewayInstanceListPage）。
 *
 * 行为规格：KNMS 原型页（2026-09-23 P3 对齐）TokenManagementPage / GatewayManagementPage
 * ——列序/筛选/动作菜单/确认弹窗文案逐字对齐，UI 用本仓库组件体系重实现；
 * 文案真源 /tmp/kissen_prototype/udpn-kissen-network-mgt/client/src/pages/。
 *
 * 历史行为规格（保留口径）：
 * - token 页 6026e51（移除 csTokenCode 列）/ c3840b3（列序）/ 84676f8（精度口径）/ 3499a7e（bank 下拉）
 * - instance 页 7d338aa（verify 对 status=1 已登记可见）/ e13cd37（心跳历史）
 * - ElMessageBox prompt/confirm → PromptDialog / ActionConfirmDialog；el-message → toast。
 */

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import {
  CircleCheck,
  CirclePause,
  Copy,
  Info,
  KeyRound,
  MoreHorizontal,
} from 'lucide-react';
import type { TableRowAction } from '@myorg/shared/ui';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  createActionColumn,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  PasswordField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  CONNECTIVITY_STATUS_LABEL,
  CS_TYPE_OPTIONS,
  KISSEN_PROJECT_ID,
  SPENDER_STATUS_LABEL,
  SPENDER_STATUS_VARIANT,
  gatewayInstanceKeys,
  tokenKeys,
  useBankListQuery,
  useInstanceDisableMutation,
  useInstanceEnableMutation,
  useInstanceHeartbeatQuery,
  useInstanceListQuery,
  useInstanceRegisterMutation,
  useInstanceResetKeyMutation,
  useInstanceVerifyMutation,
  useSpenderListQuery,
  useSpenderSaveMutation,
  useSpenderStatusMutation,
  useTokenAdjustMinLiquidityMutation,
  useTokenApproveMutation,
  useTokenDisableMutation,
  useTokenEnableMutation,
  useTokenListQuery,
  useTokenRejectMutation,
  type HeartbeatRow,
  type InstanceRow,
  type TokenListFilter,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

import { stashRow } from './row-stash';
import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
import { formatTokenAmount, formatUtc8 } from './proto-format';
import {
  PROTO_INSTANCE_STATUS,
  PROTO_TOKEN_STATUS,
  protoStatusLabel,
} from './proto-enums';

const STATUS_ALL = 'all';
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

/* ================================================================== */
/* 共用展示 helper                                                     */
/* ================================================================== */

/**
 * 毫秒时间戳 → 本仓 en-US 长格式（Spender 抽屉「Updated At」沿用；
 * 表格时间列已统一换原型口径 formatUtc8，见 proto-format）。
 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

/** 输入框中的最低流动性按管理端约定固定显示两位小数。 */
function formatLiquidityInput(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/**
 * 最低流动性校验：小数位跟随该 token 的 decimalDigits（源 liquidityRule，
 * 缺省 8；审核通过 / 调整两处复用同一精度口径）。
 */
function liquidityRule(decimalDigits: number): { pattern: RegExp; tip: string } {
  const d = decimalDigits && decimalDigits > 0 ? decimalDigits : 8;
  return {
    pattern: new RegExp(`^\\d+(\\.\\d{1,${d}})?$`),
    tip: `Enter a valid number (up to ${d} decimal places, matching the token precision)`,
  };
}

/* ================================================================== */
/* 状态徽标（原型口径：文案 proto-enums + 语义 tone + 带点徽章）          */
/* ================================================================== */

/** KNMS TokenManagementPage D3：5 待审/15 驳回/20 激活/50 停用。 */
const TOKEN_STATUS_TONES: Record<number, ProtoStatusTone> = {
  5: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

/** KNMS GatewayManagementPage D3：1 已登记未验证/10 待激活/20 激活/50 停用。 */
const INSTANCE_STATUS_TONES: Record<number, ProtoStatusTone> = {
  1: 'warning',
  10: 'info',
  20: 'success',
  50: 'muted',
};

/**
 * 原型连通性三态 Connected/Disconnected/Not verified 映射后端码表
 * （1 Online→Connected、2 Offline→Disconnected）；后端 0 Degraded 为原型外
 * 真实态，保留 data-access 文案并以 muted 呈现（GAP-ADM-08 同族：不编造）。
 */
const CONNECTIVITY_TONES: Record<number, ProtoStatusTone> = {
  1: 'success',
  2: 'danger',
};

function connectivityText(status: number | undefined): string {
  if (status === 1) return 'Connected';
  if (status === 2) return 'Disconnected';
  return CONNECTIVITY_STATUS_LABEL[status ?? -1] ?? 'Not verified';
}

export function TokenStatusBadge({
  status,
  rejectReason,
}: {
  status: number;
  rejectReason?: string;
}) {
  const badge = (
    <ProtoStatusBadge tone={TOKEN_STATUS_TONES[status] ?? 'muted'}>
      {protoStatusLabel(PROTO_TOKEN_STATUS, status)}
    </ProtoStatusBadge>
  );
  // 源：status=15 且有 rejectReason 时徽章外包 tooltip「驳回原因：xxx」。
  if (status === 15 && rejectReason) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{badge}</span>
          </TooltipTrigger>
          <TooltipContent>Rejection reason: {rejectReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return badge;
}

export function ConnectivityBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={CONNECTIVITY_TONES[status] ?? 'muted'}>
      {connectivityText(status)}
    </ProtoStatusBadge>
  );
}

export function InstanceStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={INSTANCE_STATUS_TONES[status] ?? 'muted'}>
      {protoStatusLabel(PROTO_INSTANCE_STATUS, status)}
    </ProtoStatusBadge>
  );
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  /** 破坏性动作（驳回/停用）→ destructive 按钮样式。 */
  destructive?: boolean;
  onConfirm: () => void;
}

/** 行操作确认弹窗：源 ElMessageBox.confirm → 受控 AlertDialog（禁 window.confirm）。 */
function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={request != null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={() => request?.onConfirm()}
          >
            {request?.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface PromptRequest {
  title: string;
  description: string;
  inputLabel?: string;
  inputHint?: string;
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  /** 返回错误文案 = 校验失败（弹窗保持打开）；返回 null = 通过。 */
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
}

/** 行内输入弹窗：源 ElMessageBox.prompt（inputPattern 校验语义保真）。 */
function PromptDialog({
  request,
  onClose,
}: {
  request: PromptRequest | null;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setValue(request?.initialValue ?? '');
    setError(null);
  }, [request]);

  const submit = () => {
    if (!request) return;
    const invalid = request.validate?.(value) ?? null;
    if (invalid) {
      setError(invalid);
      return;
    }
    onClose();
    request.onConfirm(value);
  };

  return (
    <Dialog open={request != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        {/* §6.4：error 紧贴输入框正下方（与字段同组，而非弹窗级散落）。 */}
        <div className="space-y-1.5">
          {request?.inputLabel ? (
            <Label htmlFor="prompt-dialog-input">{request.inputLabel}</Label>
          ) : null}
          {request?.multiline ? (
            <Textarea
              autoFocus
              id="prompt-dialog-input"
              value={value}
              maxLength={request.maxLength}
              placeholder={request.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'prompt-dialog-error' : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          ) : (
            <Input
              autoFocus
              id="prompt-dialog-input"
              value={value}
              maxLength={request?.maxLength}
              placeholder={request?.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'prompt-dialog-error' : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          )}
          {request?.inputHint ? (
            <p className="text-xs text-muted-foreground">{request.inputHint}</p>
          ) : null}
          {error ? (
            <p id="prompt-dialog-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* Token 管理（/onboard/token；registry key: token → TokenManageListPage） */
/* ================================================================== */

/** 过滤表单值（string 态便于绑定；提交时转 TokenListFilter）。 */
interface TokenFilterForm {
  bankId: string;
  tokenCode: string;
  status: string;
}
const EMPTY_TOKEN_FILTER: TokenFilterForm = {
  bankId: STATUS_ALL,
  tokenCode: '',
  status: STATUS_ALL,
};

function tokenFormToFilter(form: TokenFilterForm): TokenListFilter {
  const filter: TokenListFilter = {};
  if (form.bankId !== STATUS_ALL) filter.bankId = Number(form.bankId);
  if (form.tokenCode.trim()) filter.tokenCode = form.tokenCode.trim();
  if (form.status !== STATUS_ALL) filter.status = Number(form.status);
  return filter;
}

export function TokenManageListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TokenFilterForm>(EMPTY_TOKEN_FILTER);
  const [filter, setFilter] = React.useState<TokenListFilter>({});

  const { data, isLoading, isError, dataUpdatedAt } = useTokenListQuery(
    KISSEN_PROJECT_ID,
    filter,
  );
  const { data: bankData } = useBankListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 100,
    filter: {},
  });
  const bankOptions = bankData?.data ?? [];

  const approveMutation = useTokenApproveMutation(KISSEN_PROJECT_ID);
  const rejectMutation = useTokenRejectMutation(KISSEN_PROJECT_ID);
  const adjustMutation = useTokenAdjustMinLiquidityMutation(KISSEN_PROJECT_ID);
  const disableMutation = useTokenDisableMutation(KISSEN_PROJECT_ID);
  const enableMutation = useTokenEnableMutation(KISSEN_PROJECT_ID);

  // 源为裸数组无分页，操作成功后 load() 全量刷新（此处走缓存失效）。
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: tokenKeys.lists(KISSEN_PROJECT_ID) });
  }, [queryClient]);

  const onSearch = React.useCallback(() => {
    setFilter(tokenFormToFilter(form));
  }, [form]);

  // 源语义：重置=清空 filters 后 load（本页无分页，无页码可重置）。
  const onReset = React.useCallback(() => {
    setForm(EMPTY_TOKEN_FILTER);
    setFilter({});
  }, []);

  // 弹窗状态：prompt（审核/驳回/调整）+ 停启用 ActionConfirmDialog。
  // 解付 Spender 抽屉（源 spenderToken ref；v-if 卸载式，关闭不刷新主列表）。
  const [spenderToken, setSpenderToken] = React.useState<TokenRow | null>(null);
  const [promptRequest, setPromptRequest] = React.useState<PromptRequest | null>(null);
  /** Deactivate/Activate 确认弹窗态（原型 D11 双段文案）。 */
  const [statusAction, setStatusAction] = React.useState<{
    row: TokenRow;
    kind: 'deactivate' | 'activate';
  } | null>(null);

  /** 审核通过：输入最低流动性（默认 1000，决策 D2），成功回显服务端分配 tokenNo。 */
  const onApprove = React.useCallback(
    (row: TokenRow) => {
      const rule = liquidityRule(row.decimalDigits);
      setPromptRequest({
        title: 'Approve',
        description: `Approve the registration of "${row.tokenCode}". Set the minimum liquidity (used as the pool-level denominator and the top-up alert baseline; up to ${
          row.decimalDigits || 8
        } decimal places, adjustable later):`,
        initialValue: '1000',
        validate: (v) => (rule.pattern.test(v) ? null : rule.tip),
        onConfirm: (value) => {
          approveMutation.mutate(
            { tokenId: row.tokenId, minLiquidity: value },
            {
              onSuccess: (res) => {
                toast.success(
                  `Approved. tokenNo=${res.tokenNo} (network-wide unique, permanent)`,
                );
                refresh();
              },
              onError: (e) => toast.error((e as Error).message),
            },
          );
        },
      });
    },
    [approveMutation, refresh, toast],
  );

  /** 驳回：原因必填 ≤200，银行侧可见。 */
  const onReject = React.useCallback(
    (row: TokenRow) => {
      setPromptRequest({
        title: 'Reject Registration',
        description:
          'Provide a rejection reason (visible to the bank side; they may revise and resubmit):',
        multiline: true,
        maxLength: 200,
        validate: (v) =>
          /^.{1,200}$/.test(v) ? null : 'Reason is required (up to 200 characters)',
        onConfirm: (value) => {
          rejectMutation.mutate(
            { tokenId: row.tokenId, reason: value },
            {
              onSuccess: () => {
                toast.success('Rejected');
                refresh();
              },
              onError: (e) => toast.error((e as Error).message),
            },
          );
        },
      });
    },
    [rejectMutation, refresh, toast],
  );

  /** 调整最低流动性：预填当前值，同精度校验，即时生效口径。 */
  const onAdjustMinLiquidity = React.useCallback(
    (row: TokenRow) => {
      const rule = liquidityRule(2);
      setPromptRequest({
        title: 'Adjust Minimum Liquidity',
        description: `Set the minimum liquidity for token "${row.tokenCode}". This takes effect immediately on related pool levels and alert baselines.`,
        inputLabel: 'Minimum Liquidity',
        inputHint: 'Up to 2 decimal places.',
        initialValue: formatLiquidityInput(row.minLiquidity),
        validate: (v) => (rule.pattern.test(v) ? null : rule.tip),
        onConfirm: (value) => {
          adjustMutation.mutate(
            { tokenId: row.tokenId, minLiquidity: value },
            {
              onSuccess: () => {
                toast.success('Adjusted');
                refresh();
              },
              onError: (e) => toast.error((e as Error).message),
            },
          );
        },
      });
    },
    [adjustMutation, refresh, toast],
  );

  /** Deactivate/Activate 共用确认提交（原型 D11：destructive / confirm 两档弹窗）。 */
  const onStatusConfirm = () => {
    if (!statusAction) return;
    const { row, kind } = statusAction;
    const mutation = kind === 'deactivate' ? disableMutation : enableMutation;
    mutation.mutate(row.tokenId, {
      onSuccess: () => {
        toast.success(kind === 'deactivate' ? 'Deactivated' : 'Activated');
        setStatusAction(null);
        refresh();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };


  // 列序（原型 D2）：名称+代码 / Symbol / 锚定法币 / 链 / 银行(BIC) /
  // 最低流动性(带小单位) / 状态 / 注册时间 / Actions。
  const columns = React.useMemo<ColumnDef<TokenRow & { id: string }>[]>(() => {
    return [
      {
        id: 'token',
        header: 'Token Name (Code)',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {row.original.tokenName || <Dash />}
            </div>
            <CopyableId value={row.original.tokenCode} />
          </div>
        ),
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.symbol || <Dash />}</span>
        ),
      },
      {
        accessorKey: 'anchorFiat',
        header: 'Pegged Currency',
        cell: ({ row }) => <span>{row.original.anchorFiat || <Dash />}</span>,
      },
      {
        accessorKey: 'chainType',
        header: 'Blockchain',
        cell: ({ row }) => <span>{row.original.chainType || <Dash />}</span>,
      },
      {
        id: 'bank',
        header: 'Bank Name (BIC)',
        cell: ({ row }) => (
          <span>
            {row.original.bankName || <Dash />}
            {row.original.bankCode ? ` (${row.original.bankCode})` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'minLiquidity',
        header: 'Min. Liquidity',
        cell: ({ row }) => {
          const raw = row.original.minLiquidity;
          if (raw === null || raw === undefined || raw === '') return <Dash />;
          // 原型 formatAmount + symbol 小单位（右对齐）。
          return (
            <span className="block text-right tabular-nums">
              {formatTokenAmount(raw)}
              {row.original.symbol ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  {row.original.symbol}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <TokenStatusBadge
            status={row.original.status}
            rejectReason={row.original.rejectReason}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Registered on (UTC+8)',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<TokenRow & { id: string }>((item) => {
        const actions: TableRowAction<TokenRow & { id: string }>[] = [];
        if (item.status === 5) {
          actions.push(
            { label: 'Approve', onClick: () => onApprove(item) },
            { label: 'Reject', destructive: true, onClick: () => onReject(item) },
          );
        }
        if (item.status === 20) {
          actions.push(
            { label: 'Adjust Liquidity', onClick: () => onAdjustMinLiquidity(item) },
            { label: 'Spender Wallet', onClick: () => setSpenderToken(item) },
            {
              label: 'Deactivate',
              destructive: true,
              onClick: () => setStatusAction({ row: item, kind: 'deactivate' }),
            },
          );
        }
        if (item.status === 50) {
          actions.push({
            label: 'Activate',
            onClick: () => setStatusAction({ row: item, kind: 'activate' }),
          });
        }
        return actions;
      }),
    ];
  }, [onApprove, onReject, onAdjustMinLiquidity, setSpenderToken, setStatusAction]);

  const tableData = React.useMemo(
    () => (data ?? []).map((r) => ({ ...r, id: String(r.tokenId) })),
    [data],
  );

  return (
    <div className="space-y-4">
      {/* 卡头标题对齐原型列表页 'Token List'（页面标题由 shell 导航给出）。 */}


      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Token List
            </div>
            {!isLoading ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {tableData.length} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="border-b border-border/50 px-4 py-3"
        >
          {/* 筛选（原型 D13-③）：Bank → Token Code（输入）→ Status。 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Bank
              </label>
              <Select
                value={form.bankId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, bankId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  {bankOptions.map((b) => (
                    <SelectItem key={b.bankId} value={String(b.bankId)}>
                      {`${b.bankName} (${b.bankBic})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Token Code
              </label>
              <Input
                value={form.tokenCode}
                maxLength={100}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tokenCode: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Status
              </label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  <SelectItem value="5">
                    {protoStatusLabel(PROTO_TOKEN_STATUS, 5)}
                  </SelectItem>
                  <SelectItem value="15">
                    {protoStatusLabel(PROTO_TOKEN_STATUS, 15)}
                  </SelectItem>
                  <SelectItem value="20">
                    {protoStatusLabel(PROTO_TOKEN_STATUS, 20)}
                  </SelectItem>
                  <SelectItem value="50">
                    {protoStatusLabel(PROTO_TOKEN_STATUS, 50)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>

        </form>
        <div className="p-4">
          {/* 源无分页/多选/导出 → 不传 pagination。 */}
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No tokens found."
            />
          )}
        </div>
      </section>

      <PromptDialog request={promptRequest} onClose={() => setPromptRequest(null)} />
      {/* 停启用确认（原型 D11 双段文案 + 语义图标）。 */}
      <ActionConfirmDialog
        open={statusAction != null}
        onOpenChange={(open) => !open && setStatusAction(null)}
        icon={statusAction?.kind === 'activate' ? CircleCheck : CirclePause}
        variant={statusAction?.kind === 'activate' ? 'confirm' : 'destructive'}
        title={
          statusAction?.kind === 'activate'
            ? 'Activate Token'
            : 'Deactivate Token'
        }
        body1={
          statusAction
            ? statusAction.kind === 'activate'
              ? `Confirm activating token "${statusAction.row.tokenCode}"?`
              : `Confirm deactivating token "${statusAction.row.tokenCode}"?`
            : null
        }
        body2={
          statusAction?.kind === 'activate'
            ? 'After activation, the token is again eligible for new token pairs, quotes and pool creation. In-flight transactions are unaffected.'
            : 'After deactivation, it is excluded from new token pairs and quotes, and no new pools can be created (existing pools are kept but removed from matching candidates). In-flight transactions are unaffected.'
        }
        confirmLabel={
          statusAction?.kind === 'activate' ? 'Activate' : 'Deactivate'
        }
        loading={
          statusAction?.kind === 'activate'
            ? enableMutation.isPending
            : disableMutation.isPending
        }
        onConfirm={onStatusConfirm}
      />
      {spenderToken ? (
        <SpenderDrawer token={spenderToken} onClose={() => setSpenderToken(null)} />
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* 解付 Spender 抽屉（源 onboard/token/spender-drawer.vue，commit       */
/* 5ace899；v-if 卸载式，打开即拉注册表）                                */
/* ================================================================== */

/**
 * token 级解付签名身份维护（2026-08-31 解付签名模型改造）：
 * 当前配置展示（地址可复制）+ 启停（AlertDialog 确认）+ 录入/轮换同一表单。
 * 私钥 write-only：密文落库不回显、不预填（PasswordField 手输可见性切换）。
 * save/status 成功后仅失效本域（tokenId 维度）缓存——源 drawer 内 load()
 * 只重取自身，抽屉关闭不刷新 Token 主列表。
 */
function SpenderDrawer({
  token,
  onClose,
}: {
  token: TokenRow;
  onClose: () => void;
}) {
  const toast = useToast();
  // token 级单条注册：rows[0] 即当前配置（源 current）。
  const { data, isLoading } = useSpenderListQuery(KISSEN_PROJECT_ID, token.tokenId);
  const current = data && data.length > 0 ? data[0] : null;

  const saveMutation = useSpenderSaveMutation(KISSEN_PROJECT_ID);
  const statusMutation = useSpenderStatusMutation(KISSEN_PROJECT_ID);

  // 源：已登记时表单默认收起（「轮换 / 修改」展开）；未登记常显录入表单。
  const [formOpen, setFormOpen] = React.useState(false);
  const [spenderAddress, setSpenderAddress] = React.useState('');
  const [privateKey, setPrivateKey] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest | null>(null);

  // 源 load()：已登记时地址/备注预填；私钥永不回显。
  React.useEffect(() => {
    setSpenderAddress(current?.spenderAddress ?? '');
    setRemarks(current?.remarks ?? '');
  }, [current]);

  /** 录入/轮换（源 onSave）：地址+私钥必填；已登记且地址变化 → 覆盖二次确认。 */
  const onSave = () => {
    const address = spenderAddress.trim();
    const key = privateKey.trim();
    if (!address || !key) {
      toast.warning('Spender address and private key are required');
      return;
    }
    const doSave = () => {
      saveMutation.mutate(
        {
          tokenId: token.tokenId,
          spenderAddress: address,
          privateKey: key,
          remarks: remarks.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success(current ? 'Rotated (enabled)' : 'Saved');
            setPrivateKey('');
            setFormOpen(false);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    };
    if (current && current.spenderAddress !== address) {
      setConfirmRequest({
        title: 'Confirm Rotation',
        message:
          'Rotation will overwrite the existing address and private key. Confirm the LP has authorized the new address in the currency system; otherwise disbursement for this token will fail.',
        confirmText: 'Rotate',
        destructive: true,
        onConfirm: doSave,
      });
      return;
    }
    doSave();
  };

  /** 启停（源 onToggle）：停用 = 该 token 解付冻结。 */
  const onToggle = () => {
    if (!current) return;
    const disable = current.status === 20;
    setConfirmRequest({
      title: disable ? 'Disable Spender' : 'Enable Spender',
      message: disable
        ? 'After disabling, disbursement for this token will be frozen (disbursement calls will fail). Confirm disabling?'
        : 'Confirm enabling this spender?',
      confirmText: disable ? 'Disable' : 'Enable',
      destructive: disable,
      onConfirm: () => {
        statusMutation.mutate(
          { tokenId: token.tokenId, disabled: disable },
          {
            onSuccess: () =>
              toast.success(disable ? 'Spender disabled' : 'Spender enabled'),
            onError: (e) => toast.error((e as Error).message),
          },
        );
      },
    });
  };

  /** 地址复制（源 copyAddress；失败提示手动选择）。 */
  const copyAddress = () => {
    if (!current) return;
    navigator.clipboard
      .writeText(current.spenderAddress)
      .then(() => toast.success('Copied'))
      .catch(() => toast.warning('Copy failed; select and copy manually'));
  };

  const showForm = !current || formOpen;

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="w-[560px] max-w-none sm:max-w-[560px]">
        <DrawerHeader>
          <DrawerTitle>Disburse Spender</DrawerTitle>
          <DrawerDescription>
            {`${token.tokenName || token.tokenCode} · ${token.bankName || '--'}`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* 源 el-alert info：抽屉定位说明 */}
          <Alert>
            <Info className="h-4 w-4 shrink-0" />
            <AlertTitle>Disbursement signing wallet for this token </AlertTitle>
            <AlertDescription>
             The LP must approve this spender address to draw from the pool wallet in the token system before UDPN Kissen can execute disbursement transfers.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : current ? (
            <>
              {/* 当前配置（源 el-descriptions） */}
              <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Spender Address</div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 break-all font-mono text-sm">
                      {current.spenderAddress}
                    </div>
                    {/* 复制贴近字段（§6.3）：与 bank-onboard 一次性密钥同式 */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={copyAddress}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                      variant={SPENDER_STATUS_VARIANT[current.status] ?? 'destructive'}
                    >
                      {SPENDER_STATUS_LABEL[current.status] ?? current.status}
                    </Badge>
                    {current.status !== 20 ? (
                      <span className="text-xs text-muted-foreground">
                        Disbursement frozen for this token
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Updated At</div>
                  <div className="text-sm tabular-nums">
                    {formatTime(current.updateTime)}
                  </div>
                </div>
                {current.remarks ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Remarks</div>
                    <div className="text-sm">{current.remarks}</div>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={current.status === 20 ? 'destructive' : 'default'}
                  disabled={statusMutation.isPending}
                  onClick={onToggle}
                >
                  {current.status === 20 ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFormOpen(true)}
                >
                  Rotate / Edit
                </Button>
              </div>
            </>
          ) : (
            /* 源 el-empty：未配置（该 token 解付将报错，请先录入） */
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Not configured — Disbursements for this token will fail until a spender is registered. 
            </div>
          )}

          {/* 录入/轮换表单（源 v-if="showForm || !current"） */}
          {showForm ? (
            <form
              className="space-y-4 rounded-lg border border-border/60 bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
            >
              {current ? (
                /* 轮换运维顺序硬提示（源 rotate-hint，warning 色） */
                <Alert variant="warning">
                  <AlertTitle>Rotation order</AlertTitle>
                  <AlertDescription>
                    ① The LP first authorizes the pool wallet to the NEW
                    spender address in the currency system → ② save the form
                    below → ③ after verifying, disable the old address. Saving
                    again immediately replaces the old key.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="spender-address">
                  Spender Address
                  <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="spender-address"
                  value={spenderAddress}
                  placeholder="0x… (Kissen trading wallet address)"
                  onChange={(e) => setSpenderAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spender-private-key">
                  Private Key
                  <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
                </Label>
                {/* write-only：不回显不预填，仅本次提交（密文落库） */}
                <PasswordField
                  id="spender-private-key"
                  value={privateKey}
                  autoComplete="off"
                  placeholder="secp256k1 private key hex (submitted once, stored encrypted, never displayed)"
                  onChange={(e) => setPrivateKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spender-remarks">Remarks</Label>
                <Input
                  id="spender-remarks"
                  value={remarks}
                  placeholder="e.g. 2026-08 rotation"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                {current ? 'Rotate Key' : 'Save'}
              </Button>
            </form>
          ) : null}
        </div>

        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      </DrawerContent>
    </Drawer>
  );
}

/* ================================================================== */
/* 网关实例管理（/onboard/instance；registry key: instance →            */
/* GatewayInstanceListPage）                                            */
/* ================================================================== */

interface InstanceFilterForm {
  bankId: string;
  status: string;
}
const EMPTY_INSTANCE_FILTER: InstanceFilterForm = {
  bankId: STATUS_ALL,
  status: STATUS_ALL,
};

function instanceFormToFilter(form: InstanceFilterForm) {
  const filter: { bankId?: number; status?: number } = {};
  if (form.bankId !== STATUS_ALL) filter.bankId = Number(form.bankId);
  if (form.status !== STATUS_ALL) filter.status = Number(form.status);
  return filter;
}

/** 心跳结果语义（后端 ok 码）：1=Success / 2=Timeout / 其他=Failed。 */
export function HeartbeatResultBadge({ ok }: { ok: number }) {
  if (ok === 1) {
    return <ProtoStatusBadge tone="success">Success</ProtoStatusBadge>;
  }
  if (ok === 2) {
    // 原型 Result 仅 success/danger 两档；Timeout 为后端真实码，warning 呈现（超集口径）。
    return <ProtoStatusBadge tone="warning">Timeout</ProtoStatusBadge>;
  }
  return <ProtoStatusBadge tone="danger">Failed</ProtoStatusBadge>;
}

/**
 * Heartbeat History 抽屉（原型列表 Actions·Heartbeat；列口径逐字：
 * Time (UTC+8) / Result / Mode / Latency / Detail）。
 */
export function HeartbeatHistoryDrawer({
  instance,
  onClose,
}: {
  instance: InstanceRow;
  onClose: () => void;
}) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useInstanceHeartbeatQuery(
    KISSEN_PROJECT_ID,
    instance.instanceId,
    page,
    PAGE_SIZE_DEFAULT,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const columns = React.useMemo<ColumnDef<HeartbeatRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'probeTime',
        header: 'Time (UTC+8)',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.probeTime)}
          </span>
        ),
      },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) => <HeartbeatResultBadge ok={row.original.ok} />,
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.mode || <Dash />}</span>
        ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Latency',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        accessorKey: 'detail',
        header: 'Detail',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.detail || <Dash />}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.logId) })),
    [rows],
  );

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="w-[720px] max-w-none sm:max-w-[720px]">
        <DrawerHeader>
          <DrawerTitle>Heartbeat History</DrawerTitle>
          <DrawerDescription>
            Instance {instance.instanceCode || instance.instanceId}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No heartbeat records found."
            pagination={
              total > 0
                ? {
                    page,
                    pageSize: PAGE_SIZE_DEFAULT,
                    total,
                    onPageChange: setPage,
                    // 后端心跳接口 pageSize 固定 10，无切页大小入口（仅保占位）。
                    onPageSizeChange: () => setPage(1),
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                  }
                : undefined
            }
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export type InstanceActionKind =
  | 'verify'
  | 'resetKey'
  | 'disable'
  | 'enable';

/**
 * 实例动作弹窗文案（verify/resetKey 逐字对齐原型动作表；disable/enable 为
 * 本仓超集动作，沿用源 onToggle 文案）。实例详情页复用。
 */
export const INSTANCE_DIALOG_COPY: Record<
  InstanceActionKind,
  {
    title: string;
    confirmLabel: string;
    variant: 'confirm' | 'destructive';
    icon: React.ComponentType<{ className?: string }>;
    body1: (row: InstanceRow) => string;
    body2?: (row: InstanceRow) => string;
  }
> = {
  verify: {
    title: 'Connectivity Verification & Activation',
    confirmLabel: 'Verify & Activate',
    variant: 'confirm',
    icon: CircleCheck,
    body1: (row) =>
      `Confirm connectivity verification and activation for instance ${
        row.instanceCode || row.instanceId
      }?`,
    body2: () =>
      'On success, a downstream key pair will be generated, the instance activated, and all access keys of the bank revoked automatically.',
  },
  resetKey: {
    title: 'Reset Downstream Key',
    confirmLabel: 'Reset Key',
    // 原型为 warning 圆 + 主按钮；ActionConfirmDialog 仅 confirm/destructive 两档，
    // 按收窄口径映射 confirm（success 圆）——登记偏差。
    variant: 'confirm',
    icon: KeyRound,
    body1: (row) =>
      `Reset the downstream key for instance ${
        row.instanceCode || row.instanceId
      }?`,
    body2: () =>
      'A new key pair will be generated, and the new public key will be pushed to the gateway. The old key will be revoked immediately.',
  },
  disable: {
    title: 'Disable Instance',
    confirmLabel: 'Disable',
    variant: 'destructive',
    icon: CirclePause,
    body1: (row) =>
      `Confirm disabling instance ${row.instanceCode || row.instanceId}?`,
    body2: () =>
      'After disabling, it no longer receives pushes or upstream requests, and its tokens are excluded from new quotes (in-flight transactions continue per the state machine).',
  },
  enable: {
    title: 'Enable Instance',
    confirmLabel: 'Enable',
    variant: 'confirm',
    icon: CircleCheck,
    body1: (row) =>
      `Confirm enabling instance ${row.instanceCode || row.instanceId}?`,
  },
};

type GatewayInstanceListRow = InstanceRow & { id: string };

export function GatewayInstanceListPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<InstanceFilterForm>(
    EMPTY_INSTANCE_FILTER,
  );
  const [req, setReq] = React.useState(() => ({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    filter: instanceFormToFilter(EMPTY_INSTANCE_FILTER),
  }));

  const { data, isLoading, dataUpdatedAt } = useInstanceListQuery(
    KISSEN_PROJECT_ID,
    req,
  );
  const { data: bankData } = useBankListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 100,
    filter: {},
  });
  const bankOptions = bankData?.data ?? [];

  const registerMutation = useInstanceRegisterMutation(KISSEN_PROJECT_ID);
  const verifyMutation = useInstanceVerifyMutation(KISSEN_PROJECT_ID);
  const resetKeyMutation = useInstanceResetKeyMutation(KISSEN_PROJECT_ID);
  const disableMutation = useInstanceDisableMutation(KISSEN_PROJECT_ID);
  const enableMutation = useInstanceEnableMutation(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: gatewayInstanceKeys.lists(KISSEN_PROJECT_ID),
    });
  }, [queryClient]);

  // 源语义：查询/重置回第 1 页；size-change 也回第 1 页。
  const onSearch = React.useCallback(() => {
    setReq((prev) => ({
      ...prev,
      pageNum: 1,
      filter: instanceFormToFilter(form),
    }));
  }, [form]);

  const onReset = React.useCallback(() => {
    setForm(EMPTY_INSTANCE_FILTER);
    setReq((prev) => ({
      ...prev,
      pageNum: 1,
      filter: instanceFormToFilter(EMPTY_INSTANCE_FILTER),
    }));
  }, []);

  // 弹窗状态：verify/resetKey/disable/enable 共用 ActionConfirmDialog；心跳抽屉按实例开。
  const [instanceAction, setInstanceAction] = React.useState<{
    row: InstanceRow;
    kind: InstanceActionKind;
  } | null>(null);
  const [heartbeatInstance, setHeartbeatInstance] =
    React.useState<InstanceRow | null>(null);
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // currencySystemType 用 string 态便于 Select ���定（提交时转 number；默认 0 未填）。
  const [registerForm, setRegisterForm] = React.useState({
    bankId: STATUS_ALL,
    instanceCode: '',
    instanceName: '',
    endpointUrl: '',
    currencySystemType: '0',
    blockchain: '',
    currencySystemName: '',
    currencySystemUrl: '',
    currencySystemDesc: '',
  });
  // §6.4：guard 判定不变，错误同步下沉到字段旁（onChange / 重新打开清除）。
  const [registerErrors, setRegisterErrors] = React.useState<{
    bankId?: string;
    endpointUrl?: string;
  }>({});
  const openRegister = React.useCallback(() => {
    setRegisterForm({
      bankId: STATUS_ALL,
      instanceCode: '',
      instanceName: '',
      endpointUrl: '',
      currencySystemType: '0',
      blockchain: '',
      currencySystemName: '',
      currencySystemUrl: '',
      currencySystemDesc: '',
    });
    setRegisterErrors({});
    setRegisterOpen(true);
  }, []);

  // 源无 el-form rules，全手写校验：缺银行或接入地址 → warning toast。
  const submitRegister = React.useCallback(() => {
    const bankId =
      registerForm.bankId !== STATUS_ALL ? Number(registerForm.bankId) : 0;
    if (!bankId || !registerForm.endpointUrl) {
      setRegisterErrors({
        bankId: !bankId ? 'Select a bank' : undefined,
        endpointUrl: !registerForm.endpointUrl
          ? 'Fill in the endpoint URL'
          : undefined,
      });
      toast.warning('Select a bank and fill in the endpoint URL');
      return;
    }
    setSubmitting(true);
    registerMutation.mutate(
      {
        bankId,
        instanceCode: registerForm.instanceCode || undefined,
        instanceName: registerForm.instanceName || undefined,
        endpointUrl: registerForm.endpointUrl,
        currencySystemType: Number(registerForm.currencySystemType) || 0,
        blockchain: registerForm.blockchain || undefined,
        currencySystemName: registerForm.currencySystemName || undefined,
        currencySystemUrl: registerForm.currencySystemUrl || undefined,
        currencySystemDesc: registerForm.currencySystemDesc || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            'Instance registered (not activated). Access keys are generated in the Access Key Ledger and then handed to the bank for deployment',
          );
          setRegisterOpen(false);
          refresh();
        },
        onError: (e) => toast.error((e as Error).message),
        onSettled: () => setSubmitting(false),
      },
    );
  }, [refresh, registerForm, registerMutation, toast]);

  /**
   * 四动作共用确认提交；verify/resetKey 成功回显下游公钥指纹（源口径），
   * disable/enable 沿用源 toast。
   */
  const onInstanceConfirm = () => {
    if (!instanceAction) return;
    const { row, kind } = instanceAction;
    const onError = (e: unknown) => toast.error((e as Error).message);
    if (kind === 'verify') {
      verifyMutation.mutate(row.instanceId, {
        onSuccess: (res) => {
          toast.success(
            `Instance activated (downstream key fingerprint ${
              res.downKeyFingerprint || '-'
            })`,
          );
          setInstanceAction(null);
          refresh();
        },
        onError,
      });
      return;
    }
    if (kind === 'resetKey') {
      resetKeyMutation.mutate(row.instanceId, {
        onSuccess: (res) => {
          toast.success(`Reset (new fingerprint ${res.downKeyFingerprint || '-'})`);
          setInstanceAction(null);
          refresh();
        },
        onError,
      });
      return;
    }
    const mutation = kind === 'disable' ? disableMutation : enableMutation;
    mutation.mutate(row.instanceId, {
      onSuccess: () => {
        toast.success(kind === 'disable' ? 'Deactivated' : 'Activated');
        setInstanceAction(null);
        refresh();
      },
      onError,
    });
  };

  // 列序（原型 D2）：银行 / 实例 ID / Endpoint / 连通性 / 状态 / 最近心跳 / Actions。
  const columns = React.useMemo<ColumnDef<GatewayInstanceListRow>[]>(() => {
    return [
      {
        id: 'bank',
        header: 'Bank Name',
        cell: ({ row }) => (
          <span>
            {row.original.bankName || <Dash />}
            {row.original.bankBic ? ` (${row.original.bankBic})` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'instanceCode',
        header: 'Instance ID',
        cell: ({ row }) => (
          <CopyableId value={row.original.instanceCode} head={6} tail={4} />
        ),
      },
      {
        accessorKey: 'endpointUrl',
        header: 'Endpoint URL',
        cell: ({ row }) => (
          <span className="truncate font-mono text-xs">
            {row.original.endpointUrl || <Dash />}
          </span>
        ),
      },
      {
        id: 'connectivity',
        header: 'Connectivity',
        cell: ({ row }) => (
          <ConnectivityBadge status={row.original.connectivityStatus} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <InstanceStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'lastHeartbeatTime',
        header: 'Last Heartbeat (UTC+8)',
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.lastHeartbeatTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { overflow: 'none', stickyRight: true },
        cell: ({ row }) => {
          const item = row.original;
          // 原型：菜单常显三项 + disabled 语义（Verify 仅未验证/待激活可用、
          // Reset Key 停用不可用）；Disable/Enable 为本仓超集动作。
          const canVerify = item.status === 1 || item.status === 10;
          const canResetKey = item.status !== 50;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow('gateway-instance', item.instanceId, item);
                  router.push(
                    `/onboard/instance/detail?id=${item.instanceId}`,
                  );
                }}
              >
                Details
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={`Actions for ${item.instanceCode || item.instanceId}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canVerify}
                    onClick={() =>
                      setInstanceAction({ row: item, kind: 'verify' })
                    }
                  >
                    Verify Connectivity
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canResetKey}
                    onClick={() =>
                      setInstanceAction({ row: item, kind: 'resetKey' })
                    }
                  >
                    Reset Key
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setHeartbeatInstance(item)}>
                    Heartbeat
                  </DropdownMenuItem>
                  {item.status === 20 ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() =>
                        setInstanceAction({ row: item, kind: 'disable' })
                      }
                    >
                      Disable
                    </DropdownMenuItem>
                  ) : null}
                  {item.status === 50 ? (
                    <DropdownMenuItem
                      onClick={() =>
                        setInstanceAction({ row: item, kind: 'enable' })
                      }
                    >
                      Enable
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [router, setInstanceAction, setHeartbeatInstance]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.instanceId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* 页头（源 page-head：eyebrow + 标题）。 */}

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Gateway Instances
            </div>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <Button type="button" size="sm" onClick={openRegister}>
            Register Instance
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Bank
              </label>
              <Select
                value={form.bankId}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, bankId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  {bankOptions.map((b) => (
                    <SelectItem key={b.bankId} value={String(b.bankId)}>
                      {`${b.bankName} (${b.bankBic})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Status
              </label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  <SelectItem value="1">
                    {protoStatusLabel(PROTO_INSTANCE_STATUS, 1)}
                  </SelectItem>
                  <SelectItem value="10">
                    {protoStatusLabel(PROTO_INSTANCE_STATUS, 10)}
                  </SelectItem>
                  <SelectItem value="20">
                    {protoStatusLabel(PROTO_INSTANCE_STATUS, 20)}
                  </SelectItem>
                  <SelectItem value="50">
                    {protoStatusLabel(PROTO_INSTANCE_STATUS, 50)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No gateway instances found."
            pagination={
              paginationMeta
                ? {
                    page: paginationMeta.page,
                    pageSize: paginationMeta.pageSize,
                    total: paginationMeta.total,
                    onPageChange: (page) =>
                      setReq((prev) => ({ ...prev, pageNum: page })),
                    onPageSizeChange: (n) => {
                      // 源 size-change → onSearch（回第 1 页）。
                      setReq((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                    },
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                  }
                : undefined
            }
          />
        </div>
      </section>

      {/* 登记实例 Dialog（源 el-dialog 520px，字段/占位/手写校验逐条照迁）。 */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Register Gateway Instance</DialogTitle>
            <DialogDescription>
              One bank may register multiple instances (e.g. prod / dr). A
              registered instance stays unverified until connectivity
              verification activates it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Bank <span className="text-destructive">*</span>
              </label>
              <Select
                value={registerForm.bankId}
                onValueChange={(v) => {
                  setRegisterForm((prev) => ({ ...prev, bankId: v }));
                  setRegisterErrors((prev) => ({ ...prev, bankId: undefined }));
                }}
              >
                <SelectTrigger
                  aria-invalid={registerErrors.bankId ? true : undefined}
                  aria-describedby={
                    registerErrors.bankId ? 'register-bank-error' : undefined
                  }
                >
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {bankOptions.map((b) => (
                    <SelectItem key={b.bankId} value={String(b.bankId)}>
                      {`${b.bankName} (${b.bankBic})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registerErrors.bankId && (
                <p
                  id="register-bank-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {registerErrors.bankId}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Instance Code
              </label>
              <Input
                value={registerForm.instanceCode}
                placeholder="Unique within the bank, e.g. prod / dr"
                maxLength={50}
                onChange={(e) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    instanceCode: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Endpoint URL <span className="text-destructive">*</span>
              </label>
              <Input
                value={registerForm.endpointUrl}
                placeholder="http://bank-gateway:8080"
                maxLength={300}
                aria-invalid={registerErrors.endpointUrl ? true : undefined}
                aria-describedby={
                  registerErrors.endpointUrl
                    ? 'register-endpoint-error'
                    : undefined
                }
                onChange={(e) => {
                  setRegisterForm((prev) => ({
                    ...prev,
                    endpointUrl: e.target.value,
                  }));
                  setRegisterErrors((prev) => ({
                    ...prev,
                    endpointUrl: undefined,
                  }));
                }}
              />
              {registerErrors.endpointUrl && (
                <p
                  id="register-endpoint-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {registerErrors.endpointUrl}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Token System Type
              </label>
              <Select
                value={registerForm.currencySystemType}
                onValueChange={(v) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    currencySystemType: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CS_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Token System Name
              </label>
              <Input
                value={registerForm.currencySystemName}
                placeholder="e.g. TD OpenAPI / Hyperledger Besu"
                maxLength={100}
                onChange={(e) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    currencySystemName: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={submitRegister}
            >
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 动作确认弹窗（文案表 INSTANCE_DIALOG_COPY）。 */}
      <ActionConfirmDialog
        open={instanceAction != null}
        onOpenChange={(open) => !open && setInstanceAction(null)}
        icon={
          instanceAction
            ? INSTANCE_DIALOG_COPY[instanceAction.kind].icon
            : undefined
        }
        variant={
          instanceAction
            ? INSTANCE_DIALOG_COPY[instanceAction.kind].variant
            : 'confirm'
        }
        title={
          instanceAction ? INSTANCE_DIALOG_COPY[instanceAction.kind].title : ''
        }
        body1={
          instanceAction
            ? INSTANCE_DIALOG_COPY[instanceAction.kind].body1(
                instanceAction.row,
              )
            : null
        }
        body2={
          instanceAction
            ? INSTANCE_DIALOG_COPY[instanceAction.kind].body2?.(
                instanceAction.row,
              )
            : undefined
        }
        confirmLabel={
          instanceAction
            ? INSTANCE_DIALOG_COPY[instanceAction.kind].confirmLabel
            : 'Confirm'
        }
        loading={
          instanceAction
            ? instanceAction.kind === 'verify'
              ? verifyMutation.isPending
              : instanceAction.kind === 'resetKey'
                ? resetKeyMutation.isPending
                : instanceAction.kind === 'disable'
                  ? disableMutation.isPending
                  : enableMutation.isPending
            : false
        }
        onConfirm={onInstanceConfirm}
      />
      {heartbeatInstance ? (
        <HeartbeatHistoryDrawer
          instance={heartbeatInstance}
          onClose={() => setHeartbeatInstance(null)}
        />
      ) : null}
    </div>
  );
}
