'use client';

/**
 * Token 对页（源 `src/views/pair/index.vue` §D7 1:1 迁移，FR-LW-04）。
 *
 * 双 tab：Mine「我的 token 对」8 列 / Eligible「可申请」6 列含操作列
 * （迁移矩阵 D7 行写 7 列，实对拍源模板 el-table-column 仅 6 列，以源为准，
 * 见交付自报表）。两 tab 各自独立 useQuery（pairKeys.list / .eligible），
 * Radix Tabs 未激活内容不挂载 ⇒ Eligible 首次切入才发请求（源懒加载等价）；
 * 缓存互不干扰。源无关键词筛选、无状态下拉、无分页控件（两接口全量返回），
 * 故不加任何筛选/分件（禁臆造）。
 *
 * 申请参与：行内 link 按钮（源无 v-perm 指令，不加 PermButton——禁臆造权限键）
 * → AlertDialog 确认（工单硬性要求新增的确认步，文案按源语义英译）→ POST
 * /pair/apply 成功 toast 后切回 Mine 并家族级失效重载。失败提示统一走
 * lp-client 拦截器 sonner toast，本页静默不二次弹错。SyncRefreshButton
 * domain='pair' 照源存在：刷新失效两 key，激活 tab 立即重查、未激活 tab
 * 下次挂载时刷新（源 loadAll 两视图同刷的可见行为等价）。
 *
 * 口径：金额/比率右对齐等宽字；状态/tag 色映射照源逐码
 * （STATUS_TAG warning/danger/success/info → R1 先例 outline/destructive/
 * default/secondary）；1280 主口径容器由壳层承担，页面仅纵向堆叠。
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
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

import {
  LP_PROJECT_ID,
  PAIR_STATUS_TEXT,
  PAIR_STATUS_VARIANT,
  usePairApplyMutation,
  usePairEligibleQuery,
  usePairListQuery,
  type EligiblePairRow,
  type PairRow,
  pairKeys,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { formatTime } from './format';

/* ================================================================== */
/* 文案与渲染辅助                                                        */
/* ================================================================== */

const LBL = {
  eyebrow: 'MARKET',
  title: 'Token Pairs',
  mineTab: 'My Token Pairs',
  eligibleTab: 'Eligible',
  eligibleAlert:
    'Only token pairs with liquidity pools opened on BOTH sides can apply for participation (KLP-approved; the overriding split ratio is set during approval). Please open the liquidity pool for the missing side first.',
  /** 源申请成功 toast 直译。 */
  applyToast:
    'Application accepted (KLP approval pending); the result will sync automatically to My Token Pairs.',
  dialogTitle: 'Apply for Participation',
  dialogBody:
    'Submit a participation application for this token pair? It goes to KLP approval in real time, and the overriding split ratio may be set during approval.',
  dialogCancel: 'Cancel',
  dialogConfirm: 'Submit Application',
  status5Hint:
    'The admin side may override the split ratio upon approval; this is the current reference value.',
  rejectReasonPrefix: 'Rejection reason: ',
  missingPoolTooltip:
    'Please open the liquidity pool for the missing-side token on the Liquidity Pools page first.',
  emptyMine:
    'Not participating in any token pairs yet — switch to the Eligible tab to apply.',
  emptyEligible: 'No eligible token pairs available.',
  actionApply: 'Apply',
  actionNoPool: 'No Pool',
} as const;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 比率（0〜1 小数）→ 百分比文本两位小数，空显 '-'（源 percentText 1:1）。 */
function percentText(v: string | number | null | undefined): string {
  return v == null || v === '' ? '-' : `${(Number(v) * 100).toFixed(2)}%`;
}

/** 数值文本（源 .num 类：等宽字体 + 表格数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs tabular-nums">{children}</span>;
}

/** 右对齐数值列表头（比率列锁步）。 */
function NumHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

/** 参与状态 Badge 文案（未知码显原值）。 */
function statusText(status: number): string {
  return PAIR_STATUS_TEXT[status] ?? String(status);
}

/** 状态 tag 兜底色 info→secondary（源 statusTagType ?? 'info' 等价）。 */
function statusVariant(status: number): BadgeVariant {
  return PAIR_STATUS_VARIANT[status] ?? 'secondary';
}

/* ================================================================== */
/* Mine tab：我的 token 对（8 列，列序照源 §D7）                          */
/* ================================================================== */

/**
 * DataTable 行标识 id:string 与模型记录 ID:number 撞名，视图行以 recordId
 * 承载原值（首列显示不变），id 转字符串满足 TanStack 泛型约束。
 */
type MineRow = Omit<PairRow, 'id'> & { id: string; recordId: number };

function MineTable() {
  const query = usePairListQuery(LP_PROJECT_ID);
  const rows = React.useMemo<MineRow[]>(
    () =>
      (query.data ?? []).map((r) => ({
        ...r,
        id: String(r.id),
        recordId: r.id,
      })),
    [query.data],
  );

  const columns = React.useMemo<ColumnDef<MineRow>[]>(
    () => [
      {
        accessorKey: 'recordId',
        header: 'Record ID',
        cell: ({ row }) => <Num>{row.original.recordId}</Num>,
      },
      {
        accessorKey: 'pairCode',
        // 无码行回落 pairId 原值（源 row.pairCode || row.pairId）
        cell: ({ row }) => (
          <span>{row.original.pairCode || row.original.pairId}</span>
        ),
        meta: { overflow: 'ellipsis' },
      },
      {
        id: 'direction',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.sourceTokenCode} → {row.original.targetTokenCode}
          </span>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'mySplitRatio',
        header: () => <NumHeader>My Split Ratio</NumHeader>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Num>{percentText(row.original.mySplitRatio)}</Num>
            {row.original.status === 5 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="shrink-0">
                    ?
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  {LBL.status5Hint}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: () => <NumHeader>Default Ratio</NumHeader>,
        cell: ({ row }) => (
          <Num>
            <span className="block text-right">
              {percentText(row.original.defaultSplitRatio)}
            </span>
          </Num>
        ),
      },
      {
        id: 'activation',
        // 生效条件：仅 status===20 渲染两组缺口 tag，否则 '-'（源 1:1）
        cell: ({ row }) =>
          row.original.status !== 20 ? (
            <span>-</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <Badge
                variant={row.original.poolReady ? 'default' : 'destructive'}
              >
                {row.original.poolReady ? 'Pool Ready' : 'Pool Missing'}
              </Badge>
              <Badge variant={row.original.preauthOk ? 'default' : 'outline'}>
                {row.original.preauthOk ? 'Pre-auth Valid' : 'Pre-auth Not Set'}
              </Badge>
            </div>
          ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <Badge variant={statusVariant(row.original.status)}>
              {statusText(row.original.status)}
            </Badge>
          );
          // 已驳回且带原因 → tooltip 展示驳回原因（源 1:1）
          if (row.original.status === 15 && row.original.rejectReason) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                <TooltipContent className="max-w-sm break-all">
                  {LBL.rejectReasonPrefix}
                  {row.original.rejectReason}
                </TooltipContent>
              </Tooltip>
            );
          }
          return badge;
        },
      },
      {
        accessorKey: 'syncTime',
        header: 'Data Time',
        cell: ({ row }) => <Num>{formatTime(row.original.syncTime)}</Num>,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={query.isPending}
      emptyMessage={LBL.emptyMine}
    />
  );
}

/* ================================================================== */
/* Eligible tab：可申请（6 列含操作列，列序照源 §D7）                     */
/* ================================================================== */

function EligibleTable({ onApplied }: { onApplied: () => void }) {
  const toast = useToast();
  const query = usePairEligibleQuery(LP_PROJECT_ID);
  const apply = usePairApplyMutation(LP_PROJECT_ID);

  /** 待确认申请目标；非空即打开确认弹窗（工单要求的新增确认步）。 */
  const [applyTarget, setApplyTarget] = React.useState<EligiblePairRow | null>(
    null,
  );

  const rows = React.useMemo(
    () => (query.data ?? []).map((r) => ({ ...r, id: String(r.pairId) })),
    [query.data],
  );

  function confirmApply(target: EligiblePairRow) {
    apply.mutate(target.pairId, {
      onSuccess: () => {
        toast.success(LBL.applyToast);
        setApplyTarget(null);
        onApplied();
      },
      // 错误链路由 lp-client 拦截器统一提示（源 catch 静默等价）。
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- silent: lp-client interceptor owns error surfacing
      onError: () => {},
    });
  }

  const columns = React.useMemo<ColumnDef<EligiblePairRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'pairCode',
        // 无码行回落 pairId 原值（源 row.pairCode || row.pairId）
        cell: ({ row }) => (
          <span>{row.original.pairCode || row.original.pairId}</span>
        ),
        meta: { overflow: 'ellipsis' },
      },
      {
        id: 'direction',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.sourceTokenCode} → {row.original.targetTokenCode}
          </span>
        ),
        meta: { overflow: 'none' },
      },
      {
        id: 'sourcePooled',
        header: 'Source Pool',
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant={row.original.sourcePooled ? 'default' : 'destructive'}>
              {row.original.sourcePooled ? 'Opened' : 'Not Opened'}
            </Badge>
          </div>
        ),
        meta: { overflow: 'none' },
      },
      {
        id: 'targetPooled',
        header: 'Target Pool',
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant={row.original.targetPooled ? 'default' : 'destructive'}>
              {row.original.targetPooled ? 'Opened' : 'Not Opened'}
            </Badge>
          </div>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: () => <NumHeader>Default Split</NumHeader>,
        cell: ({ row }) => (
          <Num>
            <span className="block text-right">
              {percentText(row.original.defaultSplitRatio)}
            </span>
          </Num>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { overflow: 'none', stickyRight: true },
        cell: ({ row }) =>
          row.original.eligible ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={apply.isPending}
              onClick={() => setApplyTarget(row.original)}
            >
              {LBL.actionApply}
            </Button>
          ) : (
            // 缺侧池灰化 + tooltip 提示先开池（disabled 吞 hover，用 span 承接）
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-not-allowed">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground"
                    disabled
                  >
                    {LBL.actionNoPool}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                {LBL.missingPoolTooltip}
              </TooltipContent>
            </Tooltip>
          ),
      },
    ],
    [apply.isPending],
  );

  return (
    <>
      <Alert className="mb-3">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
        <AlertDescription>{LBL.eligibleAlert}</AlertDescription>
      </Alert>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isPending}
        emptyMessage={LBL.emptyEligible}
      />

      {/* 申请确认弹窗（工单硬性要求的确认步；文案源意译英文） */}
      <AlertDialog
        open={applyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApplyTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{LBL.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {applyTarget
                ? `${applyTarget.pairCode || applyTarget.pairId}: ${LBL.dialogBody}`
                : LBL.dialogBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>
              {LBL.dialogCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={apply.isPending || !applyTarget}
              onClick={(e) => {
                e.preventDefault(); // 保持弹窗受控：成功后才关闭并切 tab
                if (applyTarget) confirmApply(applyTarget);
              }}
            >
              {apply.isPending ? 'Submitting…' : LBL.dialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ================================================================== */
/* 页面装配                                                              */
/* ================================================================== */

export function PairListPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'mine' | 'eligible'>('mine');

  /**
   * 源 SyncRefreshButton @refreshed='loadAll'：两视图都刷。这里失效整个
   * pair 家族——激活 tab 的活动查询立即重查；未挂载的 tab 缓存被标记失效，
   * 下次切入自动重查（用户可见行为与 loadAll 等价，不会后台盲拉隐藏表）。
   */
  const refreshAll = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: pairKeys.all(LP_PROJECT_ID),
    });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        <SyncRefreshButton domain="pair" onRefreshed={refreshAll} />
      </div>

      <Card>
        <CardContent className="pb-6">
          <TooltipProvider delayDuration={200}>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="mine">{LBL.mineTab}</TabsTrigger>
                <TabsTrigger value="eligible">{LBL.eligibleTab}</TabsTrigger>
              </TabsList>
              <TabsContent value="mine" className="mt-4">
                <MineTable />
              </TabsContent>
              <TabsContent value="eligible" className="mt-4">
                <EligibleTable onApplied={() => setTab('mine')} />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
