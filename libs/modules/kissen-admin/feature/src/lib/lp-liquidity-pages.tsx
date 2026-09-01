'use client';

/**
 * LP / 流动性业务组页面（源 `kissen-admin-frontend/src/views/onboard/{lp,lp-pair}` +
 * `views/liquidity/pool`；v2.0 token 化全量同步）。
 *
 * 注册页（module-page-registry 契约，仅 5 个导出）：
 *  - lp-info: LpInfoListPage / LpInfoFormPage / LpInfoDetailPage
 *  - lp-pair: LpTokenPairListPage
 *  - pool:    LpPoolListPage
 * v2.0 变更（对照上游 tokenization）：
 *  - LP 模型：splitRatio/minLiquidity/initialPairIds 移除（分成挂 lp-pair、最低
 *    流动性挂 token 级），新增 contact 三件套 + settleCycle。
 *  - lp-pair 端点切换 /manage/lp-token-pair/*；页面仅 查看/设置分成/停用/恢复草稿。
 *  - pool 页为纯监控视图（水位条 + 预授权快照），零行操作。
 *  - lp-preauth / lp-topup / lp-currency-pair 页面已删除（域内 API 层保留）。
 * 迁移决策（CONVENTIONS）：
 *  - 确认流一律 shared AlertDialog（禁 window.confirm）；错误 toast 唯一出口
 *    sonner（useToast），onError 透出后端 message（对齐源拦截器统一提示）。
 *  - 一次性口令等 secret 仅在 Dialog 内一次性展示 + Copy 按钮。
 *  - LP 选项直接消费 lp 域 hooks（同包内跨域复用）；token 对选项走 lp-pair 域薄调用。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Copy, Info, TriangleAlert } from 'lucide-react';

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
  CopyableEllipsisText,
  createActionColumn,
  type TableRowAction,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  LP_PAIR_STATUS_LABEL,
  LP_PAIR_STATUS_VARIANT,
  LP_PAIR_TARGET_STATUS,
  LP_POOL_STATUS_LABEL,
  LP_POOL_STATUS_VARIANT,
  LP_STATUS_LABEL,
  LP_STATUS_VARIANT,
  SETTLE_CYCLE_MAP,
  type LpOption,
  type LpPairRow,
  type LpPoolRow,
  type LpPoolRowWithBank,
  type LpRow,
  type LpSaveReq,
  useLpDetailQuery,
  useLpFreezeToggleMutation,
  useLpListQuery,
  useLpPairListQuery,
  useLpPairTokenPairOptionsQuery,
  useLpPoolListQuery,
  usePortalAccountQuery,
  usePortalAccountResetMutation,
  useSaveLpMutation,
  useSetLpPairSplitMutation,
  useSubmitLpOnboardMutation,
  useUpdateLpPairStatusMutation,
} from '@myorg/modules/kissen-admin/data-access';

/* ================================================================== */
/* 共享常量与工具                                                       */
/* ================================================================== */
const PROJECT_ID = KISSEN_PROJECT_ID;

/** 表格行：后端 id（number）被 DataTable 行键覆盖为 string。 */
type LpPairTableRow = Omit<LpPairRow, 'id'> & { id: string };
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const LP_BASE = '/lp-liquidity';

const LBL = {
  query: 'Search',
  reset: 'Reset',

  loading: 'Loading...',
  add: 'Add',
  view: 'View',
  edit: 'Edit',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving...',
  back: 'Back',
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
      <section className="rounded-lg border border-border/60 bg-card p-4 sm:p-6">
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

/** 确认请求（源 window.confirm 语义的 AlertDialog 化）。 */
interface ConfirmRequest {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * 受控确认弹窗：AlertDialogCancel 关闭；Action preventDefault 后交由
 * onConfirm 执行异步 mutation（弹窗关闭时机由调用方控制）。
 */
function ConfirmDialog({
  request,
  onDismiss,
}: {
  request: ConfirmRequest | null;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog open={request != null} onOpenChange={(open) => !open && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{LBL.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              request?.onConfirm();
            }}
          >
            {request?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 单选下拉筛选（change 即查，无查询按钮——对齐源各 index.vue 的 change 自动 reload）。 */
function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-snug">{label}</label>
      <Select value={value} onValueChange={onChange}>
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

/** 门户账号弹窗目标（status=20 行触发）。 */
interface PortalAccountTarget {
  lpId: number;
  lpCode: string;
  lpName: string;
}

/**
 * LP 门户账号弹窗（源 onboard/lp/portal-account-dialog.vue）。
 * 打开即查状态；未开通（KLO 审批未通过）时禁用重置；
 * 重置返回的一次性口令仅本次展示，提供 Copy。
 */
function PortalAccountDialog({
  target,
  onClose,
}: {
  target: PortalAccountTarget;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: account, isLoading } = usePortalAccountQuery(
    PROJECT_ID,
    target.lpId,
    true,
  );
  const resetMutation = usePortalAccountResetMutation(PROJECT_ID);
  const resetResult = resetMutation.data;

  const onReset = React.useCallback(() => {
    resetMutation.mutate(target.lpId, {
      onError: (e) => toast.error((e as Error).message),
    });
  }, [resetMutation, target.lpId, toast]);

  const onCopy = React.useCallback(() => {
    if (!resetResult) return;
    navigator.clipboard
      .writeText(resetResult.oneTimePassword)
      .then(() => toast.success('Copied'))
      .catch(() => toast.warning('Copy failed; select and copy manually'));
  }, [resetResult, toast]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Portal Account — {target.lpName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <Alert>
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertTitle>First portal admin</AlertTitle>
              <AlertDescription>
                Provisioned automatically once the KLO onboarding approval
                passes (login name = {target.lpCode}_admin). The initial
                password is recorded in the approval record detail; use this
                dialog to check provisioning and reset a lost password.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadonlyField
                label="Status"
                value={
                  account?.provisioned ? (
                    <Badge variant="default">Provisioned</Badge>
                  ) : (
                    <Badge variant="outline">
                      Not Provisioned (KLO approval required)
                    </Badge>
                  )
                }
              />
              <ReadonlyField
                label="Admin Login Name"
                value={
                  account?.loginName ? (
                    <span className="font-mono">{account.loginName}</span>
                  ) : (
                    '--'
                  )
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              LP code for sign-in: <span className="font-mono">{target.lpCode}</span>
            </p>

            {resetResult ? (
              <div className="space-y-2">
                <Alert>
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <AlertTitle>One-time password</AlertTitle>
                  <AlertDescription>
                    Shown only once — copy it now and hand it to the LP. The
                    password must be changed on first sign-in.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
                  <span className="font-mono text-base font-semibold tracking-widest">
                    {resetResult.oneTimePassword}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={onCopy}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in with LP code{' '}
                  <span className="font-mono">{resetResult.lpCode}</span> and
                  login name{' '}
                  <span className="font-mono">{resetResult.loginName}</span>.
                </p>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onReset}
                  disabled={!account?.provisioned || resetMutation.isPending}
                >
                  {resetMutation.isPending ? 'Resetting…' : 'Reset Initial Password'}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
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
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [portalTarget, setPortalTarget] = React.useState<PortalAccountTarget | null>(
    null,
  );

  const { data, isLoading, isError, dataUpdatedAt } = useLpListQuery(PROJECT_ID, {
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

  /** 提交入网（1/15）：进入审批中心待办。 */
  const confirmSubmitOnboard = React.useCallback(
    (row: LpRow) => {
      submitMutation.mutate(row.lpId, {
        onSuccess: () => {
          toast.success('Onboarding application submitted');
          setConfirm(null);
        },
        onError: (e) => toast.error((e as Error).message),
      });
    },
    [submitMutation, toast],
  );

  /** 冻结/解冻（20↔50）：立即生效不走审批（规格 R-4）。 */
  const confirmToggleFreeze = React.useCallback(
    (row: LpRow, freeze: boolean) => {
      freezeMutation.mutate(
        { targetId: row.lpId, freeze },
        {
          onSuccess: () => {
            toast.success(freeze ? 'Frozen' : 'Unfrozen');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
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
        accessorKey: 'settleCycle',
        header: 'Settle Cycle',
        cell: ({ row }) => (
          <span>{SETTLE_CYCLE_MAP[row.original.settleCycle] ?? '--'}</span>
        ),
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
          <span className="tabular-nums">
            {formatDateTime(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<LpRow & { id: string }>((item) => {
        const s = item.status;
        const editable = s === 1 || s === 15;
        // status=20 的 Edit 为禁用态（已审批 LP 页面不可改）；源按钮的
        // title 提示无 TableRowAction 对应字段，随迁移移除（沿 wave-1 裁决）。
        const actions: TableRowAction<LpRow & { id: string }>[] = [
          {
            label: LBL.view,
            onClick: () => router.push(lpRoute('lp-info', 'detail', item.lpId)),
          },
        ];
        if (editable || s === 20) {
          actions.push({
            label: LBL.edit,
            disabled: s === 20 || submitMutation.isPending,
            onClick: () => router.push(lpRoute('lp-info', 'edit', item.lpId)),
          });
        }
        if (editable) {
          actions.push({
            label: 'Submit Onboarding',
            disabled: submitMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Submit Onboarding Application',
                description: `Submit the onboarding application for "${item.lpName}"? It will enter the approval center todo list.`,
                actionLabel: 'Submit',
                onConfirm: () => confirmSubmitOnboard(item),
              }),
          });
        }
        if (s === 20) {
          actions.push(
            {
              label: 'Portal Account',
              onClick: () =>
                setPortalTarget({
                  lpId: item.lpId,
                  lpCode: item.lpCode,
                  lpName: item.lpName,
                }),
            },
            {
              label: 'Freeze',
              disabled: freezeMutation.isPending,
              onClick: () =>
                setConfirm({
                  title: 'Freeze LP',
                  description: `Freeze LP "${item.lpName}"? It immediately stops matching, and its new settlement requests will be rejected.`,
                  actionLabel: 'Freeze',
                  destructive: true,
                  onConfirm: () => confirmToggleFreeze(item, true),
                }),
            },
          );
        }
        if (s === 50) {
          actions.push({
            label: 'Unfreeze',
            disabled: freezeMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Unfreeze LP',
                description: `Unfreeze LP "${item.lpName}"? It is re-enabled and resumes matching.`,
                actionLabel: 'Unfreeze',
                onConfirm: () => confirmToggleFreeze(item, false),
              }),
          });
        }
        return actions;
      }),
    ],
    [
      router,
      submitMutation.isPending,
      freezeMutation.isPending,
      confirmSubmitOnboard,
      confirmToggleFreeze,
    ],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.lpId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LPs
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(lpRoute('lp-info', 'create'))}
          >
            {LBL.add}
          </Button>
        </div>
        <form
          onSubmit={handleSubmit(onSearch)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField name="lpName" label="LP Name" register={register('lpName')} />
            <FormField name="lpCode" label="LP Code" register={register('lpCode')} />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              placeholder={LBL.all}
              options={statusFilterOptions(LP_STATUS_LABEL, [1, 5, 10, 15, 20, 50])}
            />
            <div className="flex items-end gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                {LBL.reset}
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No LPs yet"
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
          )}
        </div>
      </section>

      <ConfirmDialog request={confirm} onDismiss={() => setConfirm(null)} />
      {portalTarget && (
        <PortalAccountDialog
          target={portalTarget}
          onClose={() => setPortalTarget(null)}
        />
      )}
    </div>
  );
}

interface LpInfoFormValues {
  lpName: string;
  lpCode: string;
  contactName: string;
  contactEmail: string;
  address: string;
  riskAssessment: string;
}

/** LP 新建/编辑（v2.0 表单：contact 三件套；settleCycle 不在表单设置）。 */
export function LpInfoFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const isEdit = lpId != null;

  const { data: detail } = useLpDetailQuery(PROJECT_ID, lpId);
  const saveMutation = useSaveLpMutation(PROJECT_ID);

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<LpInfoFormValues>({
      defaultValues: {
        lpName: '',
        lpCode: '',
        contactName: '',
        contactEmail: '',
        address: '',
        riskAssessment: '',
      },
    });

  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      lpName: detail.lpName ?? '',
      lpCode: detail.lpCode ?? '',
      contactName: detail.contactName ?? '',
      contactEmail: detail.contactEmail ?? '',
      address: detail.address ?? '',
      riskAssessment: detail.riskAssessment ?? '',
    });
  }, [detail, isEdit, reset]);

  const onSubmit = handleSubmit((values) => {
    const req: LpSaveReq = {
      lpName: values.lpName.trim(),
      lpCode: values.lpCode.trim(),
      contactName: values.contactName.trim() || undefined,
      contactEmail: values.contactEmail.trim() || undefined,
      address: values.address.trim() || undefined,
      riskAssessment: values.riskAssessment.trim() || undefined,
    };
    if (isEdit && lpId) req.lpId = lpId;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Draft)');
        router.push(lpRoute('lp-info'));
      },
      onError: (e) => toast.error((e as Error).message),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit LP' : 'Add LP'}
        </div>

        {/* §6.4 Section：基本信息 / 联系 / 风评（标题 + 说明 + 分隔）。 */}
        <div className="mb-4">
          <div className="text-sm font-medium">Basic Information</div>
          <p className="text-sm text-muted-foreground">
            Identity of the LP; name and code are required.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP Name<span className="ml-0.5 text-destructive">*</span>
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
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP Code<span className="ml-0.5 text-destructive">*</span>
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
          </div>
        </div>
        <div className="mt-6 border-t border-border/50 pt-6">
          <div className="mb-4">
            <div className="text-sm font-medium">Contact</div>
            <p className="text-sm text-muted-foreground">
              Operational contact and mailing address (optional).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Name</label>
            <Input maxLength={50} {...register('contactName')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Email</label>
            <Input
              maxLength={100}
              {...register('contactEmail', {
                validate: (v) =>
                  !v.trim() ||
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
                  'Invalid email format',
              })}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive" role="alert">
                {errors.contactEmail.message}
              </p>
            )}
          </div>
        </div>
          <div className="mt-4 space-y-1.5">
            <label className="text-sm font-medium">Address</label>
            <Input maxLength={300} {...register('address')} />
          </div>
        </div>
        <div className="mt-6 border-t border-border/50 pt-6">
          <label htmlFor="riskAssessment" className="block text-sm font-medium">
            Risk Assessment
          </label>
          <p className="mb-4 text-sm text-muted-foreground">
            Internal risk evaluation notes (optional).
          </p>
          <Textarea id="riskAssessment" rows={3} {...register('riskAssessment')} />
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border-border/60 bg-card p-4 text-card-foreground shadow-float">
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

  if (!lpId) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {LBL.invalidParam}
      </div>
    );
  }
  if (isLoading) return <LoadingBlock />;
  if (!detail) return <NotFoundBlock onBack={() => router.push(lpRoute('lp-info'))} />;

  return (
    <DetailShell title="LP Details" onBack={() => router.push(lpRoute('lp-info'))}>
      {/* Hero Summary：LP 名 + 状态 + 编码（可复制）+ 创建时间（§6.3） */}
      <div className="flex flex-col gap-1.5 border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base font-semibold leading-6 text-foreground">
            {detail.lpName || '--'}
          </span>
          <StatusBadge
            status={detail.status}
            labelMap={LP_STATUS_LABEL}
            variantMap={LP_STATUS_VARIANT}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <CopyableEllipsisText
            value={detail.lpCode}
            emptyText="--"
            maxWidth={200}
            className="font-mono"
          />
          <span className="tabular-nums">
            Created {formatDateTime(detail.createTime)}
          </span>
        </div>
      </div>

      {/* 正文：结算参数（核心）+ 联系信息（运营）；长文本单独占行，§6.3 */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField
          label="Settle Cycle"
          value={SETTLE_CYCLE_MAP[detail.settleCycle] ?? '--'}
        />
        <ReadonlyField label="Contact Name" value={detail.contactName} />
        <ReadonlyField label="Contact Email" value={detail.contactEmail} />
        <div className="sm:col-span-2 lg:col-span-3">
          <ReadonlyField label="Address" value={detail.address} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <ReadonlyField label="Risk Assessment" value={detail.riskAssessment} />
        </div>
      </div>
    </DetailShell>
  );
}

/* ================================================================== */
/* lp-pair — LP×Token 对参与关系                                        */
/* ================================================================== */

/** 分成百分比输入：1-3 位整数 + 至多 4 位小数；允许空（清除覆盖）。 */
const LP_PAIR_SPLIT_PCT_PATTERN = /^(\d{1,3}(\.\d{1,4})?)?$/;

interface LpPairViewFilter {
  lpId: string;
  pairId: string;
  tab: 'approved' | 'others';
}
const LP_PAIR_VIEW_EMPTY: LpPairViewFilter = { lpId: '', pairId: '', tab: 'approved' };

/**
 * 用户汇率 = 基础汇率 ÷ (1 + 加价率)（与 FX Rate Management 页/GW 口径一致，前端派生；
 * base 缺失/非数 → '-'；markup null/非数按 0）。空串 base 需显式排除——Number('') 会静默转 0。
 */
function lpPairUserRateText(row: Pick<LpPairRow, 'baseRate' | 'markupRate'>): string {
  const raw = row.baseRate;
  const base = raw == null || raw === '' ? Number.NaN : Number(raw);
  if (Number.isNaN(base)) return '-';
  const markupRaw = row.markupRate == null ? 0 : Number(row.markupRate);
  const markup = Number.isNaN(markupRaw) ? 0 : markupRaw;
  return (base / (1 + markup)).toFixed(4);
}

/**
 * LP×Token 对紧凑单元格：token 对多行式（tokens/银行/激活池地址/pairCode，
 * 源 index.vue el-tooltip 展示银行名+pairCode；池地址行收=源侧/付=解付出款，title 显完整地址）。
 */
function LpPairCell({ row }: { row: LpPairTableRow }) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-sm font-semibold">
        {row.sourceCurrency} / {row.targetCurrency}
      </div>
      <div className="text-xs text-muted-foreground">
        {row.sourceBankName || '--'} → {row.targetBankName || '--'}
      </div>
      {row.sourcePoolAddress ? (
        <div
          className="truncate font-mono text-xs text-muted-foreground"
          title={`Recv ${row.sourcePoolAddress} — source-side active pool (receiving address)`}
        >
          Recv {row.sourcePoolAddress}
        </div>
      ) : null}
      {row.targetPoolAddress ? (
        <div
          className="truncate font-mono text-xs text-muted-foreground"
          title={`Pay ${row.targetPoolAddress} — target-side active pool (payout address)`}
        >
          Pay {row.targetPoolAddress}
        </div>
      ) : null}
      <div className="font-mono text-xs text-muted-foreground">
        {row.pairCode || '--'}
      </div>
    </div>
  );
}

/** Override split change dialog (source lp-pair/index.vue prompt; 2023418: submits a KLS approval — empty/0 clears the override and falls back to the pair default). */
function LpPairSplitDialog({
  row,
  onClosed,
}: {
  row: LpPairTableRow;
  onClosed: () => void;
}) {
  const toast = useToast();
  const currentPct =
    Number(row.splitRatio) > 0 ? (Number(row.splitRatio) * 100).toFixed(2) : '';
  const [value, setValue] = React.useState(currentPct);
  const [error, setError] = React.useState<string | null>(null);
  const splitMutation = useSetLpPairSplitMutation(PROJECT_ID);

  const onSave = React.useCallback(() => {
    const v = value.trim();
    if (!LP_PAIR_SPLIT_PCT_PATTERN.test(v)) {
      setError('Enter a percentage between 0 and 100, e.g. 30 for 30%');
      return;
    }
    setError(null);
    const ratio = v === '' || Number(v) === 0 ? 0 : Number(v) / 100;
    splitMutation.mutate(
      { id: Number(row.id), splitRatio: ratio },
      {
        onSuccess: () => {
          toast.success(
            'LP split change submitted for approval (KLS); the current value stays effective until approved',
          );
          onClosed();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [onClosed, row.id, splitMutation, toast, value]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClosed()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Change LP Split</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Change the LP share of the markup override for {row.lpName}{' '}
            {row.sourceCurrency}/{row.targetCurrency}. Leave empty or 0 to clear
            the override and fall back to the token pair default split. The
            change enters approval (KLS); the current value stays effective
            until it is approved.
          </p>
          <FormField
            name="lpPairSplitPercent"
            label="LP Split (%)"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
            inputMode="decimal"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClosed}>
            {LBL.cancel}
          </Button>
          <Button type="button" onClick={onSave} disabled={splitMutation.isPending}>
            {splitMutation.isPending ? LBL.saving : LBL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 查看弹窗（props.row 直读，lp-pair 无 detail 接口——源查看即弹窗回显）。 */
function LpPairViewDialog({
  row,
  onClosed,
}: {
  row: LpPairTableRow;
  onClosed: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClosed()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Participation Details</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadonlyField label="LP" value={row.lpName} />
          <ReadonlyField label="Status" value={
            <StatusBadge
              status={row.status}
              labelMap={LP_PAIR_STATUS_LABEL}
              variantMap={LP_PAIR_STATUS_VARIANT}
            />
          } />
          <ReadonlyField
            label="Token Pair"
            value={
              <span className="font-mono">
                {row.sourceCurrency} / {row.targetCurrency}
              </span>
            }
          />
          <ReadonlyField
            label="Pair Code"
            value={<span className="font-mono">{row.pairCode || '--'}</span>}
          />
          <ReadonlyField
            label="Created At"
            value={formatDateTime(row.createTime)}
          />
          <div className="sm:col-span-2">
            <ReadonlyField label="Remark" value={row.remark} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClosed}>
            {LBL.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * LP×Token 对参与列表（源 onboard/lp-pair/index.vue）。
 * 参与由 LP 门户发起（KLP 审批）；本页仅 查看/设置分成/停用/恢复草稿。
 * Tab：Approved / In Progress & Rejected（notApproved）；筛选 change 即查。
 */
export function LpTokenPairListPage() {
  const [filter, setFilter] = React.useState<LpPairViewFilter>(LP_PAIR_VIEW_EMPTY);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [viewRow, setViewRow] = React.useState<LpPairTableRow | null>(null);
  const [splitRow, setSplitRow] = React.useState<LpPairTableRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const { data: tokenPairOptions } = useLpPairTokenPairOptionsQuery(PROJECT_ID);

  const { data, isLoading, isError, dataUpdatedAt } = useLpPairListQuery(PROJECT_ID, {
    pageNum,
    pageSize,
    filter: {
      lpId: filter.lpId ? Number(filter.lpId) : undefined,
      pairId: filter.pairId ? Number(filter.pairId) : undefined,
      notApproved: filter.tab === 'others' ? true : undefined,
    },
  });
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const toast = useToast();

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const patchFilter = React.useCallback(
    (patch: Partial<LpPairViewFilter>) => {
      setFilter((prev) => ({ ...prev, ...patch }));
      setPageNum(1);
    },
    [],
  );

  /** 停用（仅 20）：targetStatus=50，立即移出匹配候选。 */
  const confirmDisable = React.useCallback(
    (row: LpPairTableRow) => {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.disable },
        {
          onSuccess: () => {
            toast.success('Disabled');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [statusMutation, toast],
  );

  /** 恢复草稿（仅 50）：targetStatus=1，回到草稿待重新提交审批。 */
  const confirmRestore = React.useCallback(
    (row: LpPairTableRow) => {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.restore },
        {
          onSuccess: () => {
            toast.success('Restored to draft');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [statusMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPairTableRow>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => <LpPairCell row={row.original} />,
      },
      {
        accessorKey: 'baseRate',
        header: 'Base Rate',
        cell: ({ row }) => {
          const raw = row.original.baseRate;
          const n = raw == null || raw === '' ? Number.NaN : Number(raw);
          return (
            <span className="block text-right font-mono tabular-nums">
              {Number.isNaN(n) ? '-' : n.toFixed(4)}
            </span>
          );
        },
      },
      {
        accessorKey: 'markupRate',
        header: 'Markup Rate',
        cell: ({ row }) => {
          const n =
            row.original.markupRate == null ? 0 : Number(row.original.markupRate);
          return (
            <span className="block text-right font-mono tabular-nums">
              {(n * 100).toFixed(2)}%
            </span>
          );
        },
      },
      {
        id: 'userRate',
        header: 'User Rate',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {lpPairUserRateText(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'splitRatio',
        header: 'LP Split',
        cell: ({ row }) => {
          const ratio = Number(row.original.splitRatio);
          return ratio > 0 ? (
            <span className="block text-right font-mono tabular-nums">
              {(ratio * 100).toFixed(2)}%
            </span>
          ) : (
            <span className="block text-right text-muted-foreground">Default</span>
          );
        },
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
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateTime(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<LpPairTableRow>((item) => {
        const s = item.status;
        const pairLabel = `${item.sourceCurrency}/${item.targetCurrency}`;
        const actions: TableRowAction<LpPairTableRow>[] = [
          { label: LBL.view, onClick: () => setViewRow(item) },
        ];
        if (s === 20) {
          actions.push(
            {
              label: Number(item.pendingSplit) > 0 ? 'Split In Approval' : 'Set Split',
              disabled: statusMutation.isPending || Number(item.pendingSplit) > 0,
              onClick: () => setSplitRow(item),
            },
            {
              label: 'Disable',
              disabled: statusMutation.isPending,
              destructive: true,
              onClick: () =>
                setConfirm({
                  title: 'Disable Participation',
                  description: `Disable ${item.lpName} ${pairLabel}? The pair is removed from matching candidates immediately.`,
                  actionLabel: 'Disable',
                  destructive: true,
                  onConfirm: () => confirmDisable(item),
                }),
            },
          );
        }
        if (s === 50) {
          actions.push({
            label: 'Restore Draft',
            disabled: statusMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Restore to Draft',
                description: `Restore ${item.lpName} ${pairLabel} to draft? It stays out of the matching candidates until it is submitted and approved again.`,
                actionLabel: 'Restore Draft',
                onConfirm: () => confirmRestore(item),
              }),
          });
        }
        return actions;
      }),
    ],
    [statusMutation.isPending, confirmDisable, confirmRestore],
  );
  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.id) })),
    [rows],
  );

  const pairOptions: SelectOption[] = (tokenPairOptions ?? []).map((o) => ({
    value: String(o.pairId),
    label: `${o.sourceTokenCode}/${o.targetTokenCode}`,
  }));

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTitle>Portal-driven participation</AlertTitle>
        <AlertDescription>
          Participation requests are initiated by the LP on the portal (KLP
          approval); this page provides view, enable/disable and split ratio
          maintenance only.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LP Participations
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="LP"
              value={filter.lpId}
              placeholder={LBL.all}
              options={lpToOptions(lpList?.data)}
              onChange={(v) => patchFilter({ lpId: v })}
            />
            <FilterSelect
              label="Token Pair"
              value={filter.pairId}
              placeholder={LBL.all}
              options={pairOptions}
              onChange={(v) => patchFilter({ pairId: v })}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug">
                Approval View
              </label>
              <RadioGroup
                value={filter.tab}
                onValueChange={(v) => patchFilter({ tab: v as LpPairViewFilter['tab'] })}
                className="flex h-10 items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="approved" id="lp-pair-tab-approved" />
                  <Label htmlFor="lp-pair-tab-approved" className="text-sm font-normal">
                    Approved
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="others" id="lp-pair-tab-others" />
                  <Label htmlFor="lp-pair-tab-others" className="text-sm font-normal">
                    In Progress / Rejected
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilter(LP_PAIR_VIEW_EMPTY);
                  setPageNum(1);
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No participation records yet"
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) => setPageNum(page),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {viewRow && (
        <LpPairViewDialog row={viewRow} onClosed={() => setViewRow(null)} />
      )}
      {splitRow && (
        <LpPairSplitDialog row={splitRow} onClosed={() => setSplitRow(null)} />
      )}
      <ConfirmDialog request={confirm} onDismiss={() => setConfirm(null)} />
    </div>
  );
}

/* ================================================================== */
/* pool — LP 资金池（纯监控）                                            */
/* ================================================================== */

/**
 * 水位单元格（源 liquidity/pool/index.vue 自绘水位条）：
 * level = 余额 ÷ token 级最低流动性；低于提醒阈值=Low（红），>1=Sufficient（绿）。
 * minLiquidity 缺失/≤0 或余额未快照 → 整列 '--'。
 */
function WaterLevelCell({ row }: { row: LpPoolRow }) {
  const balanceRaw = row.availableBalanceCache;
  const min = Number(row.minLiquidity);
  const threshold = Number(row.remindThreshold);
  const hasLevel =
    balanceRaw != null &&
    balanceRaw !== '' &&
    Number.isFinite(Number(balanceRaw)) &&
    Number.isFinite(min) &&
    min > 0;
  if (!hasLevel) return <span>--</span>;

  const level = Number(balanceRaw) / min;
  const isLow = Number.isFinite(threshold) && level < threshold;
  const isOverflow = level > 1;
  const percent = `${(level * 100).toFixed(1)}%`;
  const barWidth = Math.min(100, Math.max(0, level * 100));
  const markLeft = Number.isFinite(threshold)
    ? Math.min(100, Math.max(0, threshold * 100))
    : 0;
  const barColor = isLow
    ? 'bg-destructive'
    : isOverflow
      ? 'bg-emerald-500'
      : 'bg-primary';
  const badgeVariant: BadgeVariant = isLow
    ? 'destructive'
    : isOverflow
      ? 'default'
      : 'outline';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-[130px] cursor-default space-y-1">
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-foreground/50"
                style={{ left: `${markLeft}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="tabular-nums text-xs text-muted-foreground">
                {percent}
              </span>
              <Badge variant={badgeVariant}>
                {isLow ? 'Low' : isOverflow ? 'Sufficient' : 'Normal'}
              </Badge>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Balance {formatAmount(balanceRaw)} ÷ min liquidity{' '}
          {formatAmount(row.minLiquidity)}
          {Number.isFinite(threshold)
            ? `, remind threshold ${(threshold * 100).toFixed(1)}%`
            : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * LP 资金池监控列表（源 liquidity/pool/index.vue）。
 * 池由 LP 门户申请（KLPP 审批）；本页纯监控零操作：余额/水位/预授权快照。
 */
export function LpPoolListPage() {
  const [lpId, setLpId] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });

  const { data, isLoading, isError, dataUpdatedAt } = useLpPoolListQuery(PROJECT_ID, {
    pageNum,
    pageSize,
    filter: {
      lpId: lpId ? Number(lpId) : undefined,
      status: status ? Number(status) : undefined,
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const columns = React.useMemo<
    ColumnDef<LpPoolRowWithBank & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      {
        id: 'token',
        header: 'Token',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-fit cursor-default font-mono text-sm font-semibold">
                    {row.original.tokenSymbol || row.original.tokenCode || '--'}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  tokenCode: {row.original.tokenCode || '--'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-xs text-muted-foreground">
              {row.original.tokenBankName || '--'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'accountAddress',
        header: 'Pool Address',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.accountAddress || '--'}
          </span>
        ),
      },
      {
        id: 'activeFlag',
        header: 'Disbursement Pool',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.activeFlag === 1 ? (
              <Badge variant="success" size="sm">
                Active
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'availableBalanceCache',
        header: 'Available Balance',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatAmount(row.original.availableBalanceCache)}
          </span>
        ),
      },
      {
        id: 'waterLevel',
        header: 'Water Level',
        enableSorting: false,
        cell: ({ row }) => <WaterLevelCell row={row.original} />,
      },
      {
        id: 'authAmount',
        header: 'Auth Amount',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.authAmount == null ? (
            <Badge variant="secondary">Not Set</Badge>
          ) : (
            <span className="block text-right font-mono tabular-nums">
              {formatAmount(row.original.authAmount)}
            </span>
          ),
      },
      {
        id: 'preauthAvailable',
        header: 'Available Auth',
        enableSorting: false,
        cell: ({ row }) => {
          const n = Number(row.original.preauthAvailable);
          return (
            <span
              className={`block text-right font-mono tabular-nums ${
                row.original.preauthAvailable != null && n <= 0
                  ? 'font-semibold text-destructive'
                  : ''
              }`}
            >
              {formatAmount(row.original.preauthAvailable)}
            </span>
          );
        },
      },
      {
        id: 'snapshotTime',
        header: 'Data Time',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs tabular-nums">
            <div>
              <span className="text-muted-foreground">Bal </span>
              {formatDateTime(row.original.balanceUpdateTime)}
            </div>
            <div className="text-muted-foreground">
              <span>Preauth </span>
              {row.original.preauthSnapshotTime
                ? formatDateTime(row.original.preauthSnapshotTime)
                : '--'}
            </div>
          </div>
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
    ],
    [],
  );

  const tableData = React.useMemo(
    () =>
      (rows as LpPoolRowWithBank[]).map((r) => ({ ...r, id: String(r.poolId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTitle>Monitoring only</AlertTitle>
        <AlertDescription>
          Pools are requested by the LP on the portal (KLPP approval). Top-ups
          and pre-authorization are handled by the LP in the currency system;
          snapshots refresh periodically via the bank gateway — no operations
          here.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LP Pools
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="LP"
              value={lpId}
              placeholder={LBL.all}
              options={lpToOptions(lpList?.data)}
              onChange={(v) => {
                setLpId(v);
                setPageNum(1);
              }}
            />
            <FilterSelect
              label="Status"
              value={status}
              placeholder={LBL.all}
              options={statusFilterOptions(LP_POOL_STATUS_LABEL, [5, 15, 20, 50])}
              onChange={(v) => {
                setStatus(v);
                setPageNum(1);
              }}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLpId('');
                  setStatus('');
                  setPageNum(1);
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No pools yet"
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) => setPageNum(page),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
