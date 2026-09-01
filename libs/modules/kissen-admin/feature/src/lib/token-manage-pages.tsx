'use client';

/**
 * Token 管理页 + 网关实例管理页（源 views/onboard/token/index.vue 与
 * views/onboard/instance/index.vue + heartbeat-drawer.vue，v2.0 新域）。
 *
 * 行为规格：
 * - token 页 6026e51（移除 csTokenCode 列）/ c3840b3（列序 + fmt2）/ 84676f8（精度口径）
 * - instance 页 7d338aa（verify 对 status=1 已登记可见）/ e13cd37 + c3840b3（心跳列 + 抽屉）
 * - ElMessageBox prompt/confirm → Dialog+Input prompt / AlertDialog confirm；
 *   el-message → sonner toast（唯一出口）；时间 en-US 24h。
 */

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Info } from 'lucide-react';
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

import {
  CONNECTIVITY_STATUS_LABEL,
  CONNECTIVITY_STATUS_VARIANT,
  INSTANCE_STATUS_LABEL,
  INSTANCE_STATUS_VARIANT,
  KISSEN_PROJECT_ID,
  SPENDER_STATUS_LABEL,
  SPENDER_STATUS_VARIANT,
  TOKEN_STATUS_LABEL,
  TOKEN_STATUS_VARIANT,
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
  type InstanceRow,
  type TokenListFilter,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

const STATUS_ALL = 'all';
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const HEARTBEAT_PAGE_SIZE = 10;

/* ================================================================== */
/* 共用展示 helper                                                     */
/* ================================================================== */

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss（en-US + 24h，手写不引 dayjs）。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 金额展示：千分位 + 强制两位小数（源 fmt2，2026-08-27 用户反馈）；非数字原样。 */
function fmt2(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '--';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
/* 状态徽标 + 确认/输入弹窗（约定 §5：纯展示/流程组件 co-locate，不导出） */
/* ================================================================== */

function TokenStatusBadge({ status, rejectReason }: { status: number; rejectReason?: string }) {
  const badge = (
    <Badge variant={TOKEN_STATUS_VARIANT[status] ?? 'outline'}>
      {TOKEN_STATUS_LABEL[status] ?? status}
    </Badge>
  );
  // 源：status=15 且有 rejectReason 时 tag 外包 tooltip「驳回原因：xxx」。
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

function ConnectivityBadge({ status }: { status: number }) {
  const s = status ?? 0;
  return (
    <Badge variant={CONNECTIVITY_STATUS_VARIANT[s] ?? 'secondary'}>
      {CONNECTIVITY_STATUS_LABEL[s] ?? 'Unknown'}
    </Badge>
  );
}

function InstanceStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={INSTANCE_STATUS_VARIANT[status] ?? 'outline'}>
      {INSTANCE_STATUS_LABEL[status] ?? status}
    </Badge>
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
          {request?.multiline ? (
            <Textarea
              autoFocus
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

/** 过滤表单值（string 态便于 Select 绑定；提交时转 TokenListFilter）。 */
interface TokenFilterForm {
  tokenCode: string;
  bankId: string;
  status: string;
}
const EMPTY_TOKEN_FILTER: TokenFilterForm = {
  tokenCode: '',
  bankId: STATUS_ALL,
  status: STATUS_ALL,
};

function tokenFormToFilter(form: TokenFilterForm): TokenListFilter {
  const filter: TokenListFilter = {};
  const code = form.tokenCode.trim();
  if (code) filter.tokenCode = code;
  if (form.bankId !== STATUS_ALL) filter.bankId = Number(form.bankId);
  if (form.status !== STATUS_ALL) filter.status = Number(form.status);
  return filter;
}

export function TokenManageListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TokenFilterForm>(EMPTY_TOKEN_FILTER);
  const [filter, setFilter] = React.useState<TokenListFilter>({});

  const { data, isLoading, isError, dataUpdatedAt } = useTokenListQuery(KISSEN_PROJECT_ID, filter);
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

  // 弹窗状态：prompt（审核/驳回/调整）+ confirm（停用/启用）。
  // 解付 Spender 抽屉（源 spenderToken ref；v-if 卸载式，关闭不刷新主列表）。
  const [spenderToken, setSpenderToken] = React.useState<TokenRow | null>(null);
  const [promptRequest, setPromptRequest] = React.useState<PromptRequest | null>(null);
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest | null>(null);

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
      const rule = liquidityRule(row.decimalDigits);
      setPromptRequest({
        title: 'Adjust Minimum Liquidity',
        description: `Adjust the minimum liquidity of "${row.tokenCode}" (current ${row.minLiquidity}; takes effect immediately on related pool levels and alert baselines; up to ${
          row.decimalDigits || 8
        } decimal places):`,
        initialValue: String(row.minLiquidity ?? ''),
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

  const onDisable = React.useCallback(
    (row: TokenRow) => {
      setConfirmRequest({
        title: 'Disable Token',
        message: `Confirm disabling token "${row.tokenCode}"? After disabling, it is excluded from new token pairs and quotes, and no new pools can be created (existing pools are kept but removed from matching candidates). In-flight transactions are unaffected.`,
        confirmText: 'Disable',
        destructive: true,
        onConfirm: () => {
          disableMutation.mutate(row.tokenId, {
            onSuccess: () => {
              toast.success('Disabled');
              refresh();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [disableMutation, refresh, toast],
  );

  const onEnable = React.useCallback(
    (row: TokenRow) => {
      setConfirmRequest({
        title: 'Enable Token',
        message: `Confirm enabling token "${row.tokenCode}"?`,
        confirmText: 'Enable',
        onConfirm: () => {
          enableMutation.mutate(row.tokenId, {
            onSuccess: () => {
              toast.success('Enabled');
              refresh();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [enableMutation, refresh, toast],
  );

  // 列序（2026-08-27 用户指定）：名称/symbol/tokenNo/锚定法币/银行/链/code/最低流动性/状态/时间。
  const columns = React.useMemo<ColumnDef<TokenRow & { id: string }>[]>(() => {
    return [
      {
        accessorKey: 'tokenName',
        header: 'Token Name',
        cell: ({ row }) => <span>{row.original.tokenName || '--'}</span>,
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.symbol || '--'}</span>
        ),
      },
      {
        accessorKey: 'tokenNo',
        header: 'Token No (Network-wide Unique)',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.tokenNo || '(Assigned after approval)'}
          </span>
        ),
      },
      {
        accessorKey: 'anchorFiat',
        header: 'Anchor Fiat',
        cell: ({ row }) => <span>{row.original.anchorFiat || '--'}</span>,
      },
      {
        id: 'bank',
        header: 'Bank',
        cell: ({ row }) => (
          <span>
            {row.original.bankName || '--'}
            {row.original.bankCode ? ` (${row.original.bankCode})` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'chainType',
        header: 'Chain',
        cell: ({ row }) => <span>{row.original.chainType || '--'}</span>,
      },
      {
        accessorKey: 'tokenCode',
        header: 'Token Code',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.tokenCode}</span>
        ),
      },
      {
        accessorKey: 'minLiquidity',
        header: 'Min Liquidity',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {fmt2(row.original.minLiquidity)}
          </span>
        ),
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
        header: 'Registered At',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.createTime)}</span>
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
            { label: 'Adjust Min Liquidity', onClick: () => onAdjustMinLiquidity(item) },
            { label: 'Disburse Spender', onClick: () => setSpenderToken(item) },
            { label: 'Disable', destructive: true, onClick: () => onDisable(item) },
          );
        }
        if (item.status === 50) {
          actions.push({ label: 'Enable', onClick: () => onEnable(item) });
        }
        return actions;
      }),
    ];
  }, [onApprove, onReject, onAdjustMinLiquidity, onDisable, onEnable]);

  const tableData = React.useMemo(
    () => (data ?? []).map((r) => ({ ...r, id: String(r.tokenId) })),
    [data],
  );

  return (
    <div className="space-y-4">
      {/* 页头（源 page-head：eyebrow + 标题） */}
      <div>
        <div className="text-xs text-muted-foreground">TOKEN</div>
        <h1 className="text-xl font-semibold">Token Management</h1>
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Tokens
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Token Code
              </label>
              <Input
                value={form.tokenCode}
                placeholder="Fuzzy match"
                onChange={(e) => setForm((prev) => ({ ...prev, tokenCode: e.target.value }))}
              />
            </div>
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
                      {`${b.bankName} (${b.bankCode})`}
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
                onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  <SelectItem value="5">{TOKEN_STATUS_LABEL[5]}</SelectItem>
                  <SelectItem value="15">{TOKEN_STATUS_LABEL[15]}</SelectItem>
                  <SelectItem value="20">{TOKEN_STATUS_LABEL[20]}</SelectItem>
                  <SelectItem value="50">{TOKEN_STATUS_LABEL[50]}</SelectItem>
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
              emptyMessage="No tokens registered yet"
            />
          )}
        </div>
      </section>

      <PromptDialog request={promptRequest} onClose={() => setPromptRequest(null)} />
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
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

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {/* 源 el-alert info：抽屉定位说明 */}
          <Alert>
            <Info className="h-4 w-4 shrink-0" />
            <AlertTitle>Disbursement signing wallet for this token</AlertTitle>
            <AlertDescription>
              The LP must authorize the pool wallet to the Spender address for
              this tokenCode in the currency system before Kissen can execute
              disbursement transfers.
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
              Not configured — disbursement for this token will fail. Register a
              spender below.
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

/** 心跳历史抽屉（源 heartbeat-drawer.vue；v-if 卸载式，打开即取第 1 页）。 */
function HeartbeatDrawer({
  instanceId,
  instanceLabel,
  onClose,
}: {
  instanceId: number;
  instanceLabel: string;
  onClose: () => void;
}) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useInstanceHeartbeatQuery(
    KISSEN_PROJECT_ID,
    instanceId,
    page,
    HEARTBEAT_PAGE_SIZE,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const columns = React.useMemo<ColumnDef<HeartbeatRowWithId>[]>(() => {
    return [
      {
        accessorKey: 'probeTime',
        header: 'Probe Time',
        cell: ({ row }) => <span>{formatTime(row.original.probeTime)}</span>,
      },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) =>
          row.original.ok === 1 ? (
            <Badge variant="default">Normal</Badge>
          ) : (
            <Badge variant="destructive">Failed</Badge>
          ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span>
            {row.original.mode === 'SIGNED'
              ? 'Signed probe'
              : row.original.mode === 'BARE'
                ? 'Bare probe'
                : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Latency',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        accessorKey: 'detail',
        header: 'Detail',
        cell: ({ row }) => <span>{row.original.detail || '--'}</span>,
      },
    ];
  }, []);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.logId) })),
    [rows],
  );

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="w-full max-w-none sm:w-[520px]">
        <DrawerHeader>
          <DrawerTitle>Heartbeat History</DrawerTitle>
          <DrawerDescription className="font-mono">{instanceLabel}</DrawerDescription>
        </DrawerHeader>
        {/* DataTable 自带容器边框：不再包 panel，仅补抽屉内边距（§6.3 快速核对） */}
        <div className="mt-2 overflow-auto px-4 pb-4">
          {/* 源分页 layout 无 sizes → 不传 onPageSizeChange，页大小固定 10。 */}
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No data"
            pagination={{
              page,
              pageSize: HEARTBEAT_PAGE_SIZE,
              total,
              onPageChange: setPage,
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type HeartbeatRowWithId = { id: string } & {
  logId: number;
  ok: number;
  mode: string;
  latencyMs: number;
  detail: string;
  probeTime: number;
};

export function GatewayInstanceListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<InstanceFilterForm>(EMPTY_INSTANCE_FILTER);
  const [req, setReq] = React.useState(() => ({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    filter: instanceFormToFilter(EMPTY_INSTANCE_FILTER),
  }));

  const { data, isLoading, dataUpdatedAt } = useInstanceListQuery(KISSEN_PROJECT_ID, req);
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
    setReq((prev) => ({ ...prev, pageNum: 1, filter: instanceFormToFilter(form) }));
  }, [form]);

  const onReset = React.useCallback(() => {
    setForm(EMPTY_INSTANCE_FILTER);
    setReq((prev) => ({
      ...prev,
      pageNum: 1,
      filter: instanceFormToFilter(EMPTY_INSTANCE_FILTER),
    }));
  }, []);

  // 弹窗状态。
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest | null>(null);
  const [heartbeatRow, setHeartbeatRow] = React.useState<InstanceRow | null>(null);
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [registerForm, setRegisterForm] = React.useState({
    bankId: STATUS_ALL,
    instanceCode: '',
    instanceName: '',
    endpointUrl: '',
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
    });
    setRegisterErrors({});
    setRegisterOpen(true);
  }, []);

  // 源无 el-form rules，全手写校验：缺银行或接入地址 → warning toast。
  const submitRegister = React.useCallback(() => {
    const bankId = registerForm.bankId !== STATUS_ALL ? Number(registerForm.bankId) : 0;
    if (!bankId || !registerForm.endpointUrl) {
      setRegisterErrors({
        bankId: !bankId ? 'Select a bank' : undefined,
        endpointUrl: !registerForm.endpointUrl ? 'Fill in the endpoint URL' : undefined,
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

  /** 联通验证并激活：status=1 已登记或 10 公钥已推送均可见（7d338aa 修正）。 */
  const onVerify = React.useCallback(
    (row: InstanceRow) => {
      setConfirmRequest({
        title: 'Connectivity Verification & Activation',
        message: `Confirm connectivity verification and activation for instance ${
          row.instanceCode || row.instanceId
        }? On success, a downstream key pair will be generated, the instance activated, and all access keys of the bank revoked automatically.`,
        confirmText: 'Verify & Activate',
        onConfirm: () => {
          verifyMutation.mutate(row.instanceId, {
            onSuccess: (res) => {
              toast.success(
                `Instance activated (downstream key fingerprint ${res.downKeyFingerprint || '-'})`,
              );
              refresh();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [refresh, toast, verifyMutation],
  );

  const onResetKey = React.useCallback(
    (row: InstanceRow) => {
      setConfirmRequest({
        title: 'Reset Downstream Key',
        message: `Confirm resetting the downstream key of instance ${
          row.instanceCode || row.instanceId
        }? A new key pair will be generated and the new public key pushed; the old private key becomes invalid immediately.`,
        confirmText: 'Reset Key',
        onConfirm: () => {
          resetKeyMutation.mutate(row.instanceId, {
            onSuccess: (res) => {
              toast.success(`Reset (new fingerprint ${res.downKeyFingerprint || '-'})`);
              refresh();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [refresh, toast, resetKeyMutation],
  );

  /** 停用/启用共用 onToggle（源同构）；toast 文案共用。 */
  const onToggle = React.useCallback(
    (row: InstanceRow, disable: boolean) => {
      setConfirmRequest({
        title: disable ? 'Disable Instance' : 'Enable Instance',
        message: disable
          ? `Confirm disabling instance ${
              row.instanceCode || row.instanceId
            }? After disabling, it no longer receives pushes or upstream requests, and its tokens are excluded from new quotes (in-flight transactions continue per the state machine).`
          : `Confirm enabling instance ${row.instanceCode || row.instanceId}?`,
        confirmText: disable ? 'Disable' : 'Enable',
        destructive: disable,
        onConfirm: () => {
          const mutation = disable ? disableMutation : enableMutation;
          mutation.mutate(row.instanceId, {
            onSuccess: () => {
              toast.success('Operation successful');
              refresh();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [disableMutation, enableMutation, refresh, toast],
  );

  const columns = React.useMemo<ColumnDef<InstanceRow & { id: string }>[]>(() => {
    return [
      {
        id: 'bank',
        header: 'Bank',
        cell: ({ row }) => (
          <span>
            {row.original.bankName || '--'}
            {row.original.bankCode ? ` (${row.original.bankCode})` : ''}
          </span>
        ),
      },
      {
        id: 'instance',
        header: 'Instance',
        cell: ({ row }) => (
          <span>
            {row.original.instanceCode || '--'}
            {row.original.instanceName ? ` ${row.original.instanceName}` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'endpointUrl',
        header: 'Endpoint URL',
      },
      {
        accessorKey: 'upKeyFingerprint',
        header: 'Upstream Public Key Fingerprint',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.upKeyFingerprint || '(Not pushed)'}
          </span>
        ),
      },
      {
        accessorKey: 'downKeyFingerprint',
        header: 'Downstream Key Fingerprint',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.downKeyFingerprint || '(Not generated)'}
          </span>
        ),
      },
      {
        id: 'connectivity',
        header: 'Connectivity',
        cell: ({ row }) => <ConnectivityBadge status={row.original.connectivityStatus} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <InstanceStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'lastHeartbeatTime',
        header: 'Last Heartbeat',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.lastHeartbeatTime)}
          </span>
        ),
      },
      createActionColumn<InstanceRow & { id: string }>((item) => {
        const actions: TableRowAction<InstanceRow & { id: string }>[] = [];
        // 7d338aa：verify 对 status=1（已登记未验证）同样可见，仅 10 会漏已登记态。
        if (item.status === 1 || item.status === 10) {
          actions.push({ label: 'Verify & Activate', onClick: () => onVerify(item) });
        }
        if (item.status === 20) {
          actions.push(
            { label: 'Reset Downstream Key', onClick: () => onResetKey(item) },
            // 心跳历史入口不限状态（所有行可见）。
            {
              label: 'Heartbeat History',
              onClick: () => setHeartbeatRow(item),
            },
            { label: 'Disable', destructive: true, onClick: () => onToggle(item, true) },
          );
        }
        if (item.status === 50) {
          actions.push(
            {
              label: 'Heartbeat History',
              onClick: () => setHeartbeatRow(item),
            },
            { label: 'Enable', onClick: () => onToggle(item, false) },
          );
        }
        return actions;
      }),
    ];
  }, [onVerify, onResetKey, onToggle]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.instanceId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* 页头（源 page-head：eyebrow + 标题）。 */}
      <div>
        <div className="text-xs text-muted-foreground">GATEWAY INSTANCE</div>
        <h1 className="text-xl font-semibold">Instance Management</h1>
      </div>

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
                onValueChange={(v) => setForm((prev) => ({ ...prev, bankId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  {bankOptions.map((b) => (
                    <SelectItem key={b.bankId} value={String(b.bankId)}>
                      {`${b.bankName} (${b.bankCode})`}
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
                onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  <SelectItem value="1">{INSTANCE_STATUS_LABEL[1]}</SelectItem>
                  <SelectItem value="10">{INSTANCE_STATUS_LABEL[10]}</SelectItem>
                  <SelectItem value="20">{INSTANCE_STATUS_LABEL[20]}</SelectItem>
                  <SelectItem value="50">{INSTANCE_STATUS_LABEL[50]}</SelectItem>
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
            emptyMessage="No gateway instances registered"
            pagination={
              paginationMeta
                ? {
                    page: paginationMeta.page,
                    pageSize: paginationMeta.pageSize,
                    total: paginationMeta.total,
                    onPageChange: (page) =>
                      setReq((prev) => ({ ...prev, pageNum: page })),
                    onPageSizeChange: (n) =>
                      // 源 size-change → onSearch（回第 1 页）。
                      setReq((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
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
                  aria-describedby={registerErrors.bankId ? 'register-bank-error' : undefined}
                >
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {bankOptions.map((b) => (
                    <SelectItem key={b.bankId} value={String(b.bankId)}>
                      {`${b.bankName} (${b.bankCode})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registerErrors.bankId && (
                <p id="register-bank-error" role="alert" className="text-sm text-destructive">
                  {registerErrors.bankId}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Instance Code</label>
              <Input
                value={registerForm.instanceCode}
                placeholder="Unique within the bank, e.g. prod / dr"
                maxLength={50}
                onChange={(e) =>
                  setRegisterForm((prev) => ({ ...prev, instanceCode: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Instance Name</label>
              <Input
                value={registerForm.instanceName}
                placeholder="e.g. Production"
                maxLength={100}
                onChange={(e) =>
                  setRegisterForm((prev) => ({ ...prev, instanceName: e.target.value }))
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
                aria-describedby={registerErrors.endpointUrl ? 'register-endpoint-error' : undefined}
                onChange={(e) => {
                  setRegisterForm((prev) => ({ ...prev, endpointUrl: e.target.value }));
                  setRegisterErrors((prev) => ({ ...prev, endpointUrl: undefined }));
                }}
              />
              {registerErrors.endpointUrl && (
                <p id="register-endpoint-error" role="alert" className="text-sm text-destructive">
                  {registerErrors.endpointUrl}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={submitRegister}>
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      {/* 源 v-if 卸载式：条件渲染，关闭即卸载（非 keep-alive）。 */}
      {heartbeatRow ? (
        <HeartbeatDrawer
          instanceId={heartbeatRow.instanceId}
          instanceLabel={heartbeatRow.instanceCode || String(heartbeatRow.instanceId)}
          onClose={() => setHeartbeatRow(null)}
        />
      ) : null}
    </div>
  );
}
