'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import { CrossChainStatusBadge } from '@myorg/modules/cross-chain/ui';
import { DatePicker } from '@myorg/shared/ui-forms';
import {
  useLiquidityPoolAuthorizationQuery,
  useLiquidityPoolBasicInfoQuery,
  useLiquidityPoolOpRecordsQuery,
  useLiquidityPoolTransactionsQuery,
  type AuthorizationRecordItem,
  type LiquidityPoolBasicInfo,
  type OperationRecordItem,
  type TransactionRecordItem,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
/** 「全部」占位 value。 */
const ALL_VALUE = 'all';

/**
 * 钱包地址缩写（迁移自 td-manage src/utils/index.ts:62 `showAddress`）。
 *
 * 源码：val.substring(0, 4) + '....' + val.substring(len - 4)。
 * 详情基本信息列地址用缩写 + copyable（对齐 cct-list from/to 列）。
 */
function showAddress(val: string | undefined | null): string {
  if (!val) return EMPTY_DISPLAY;
  const len = val.length;
  return val.substring(0, 4) + '....' + val.substring(len - 4, len);
}

/**
 * 详情页基本信息描述项（label + value 键值对，与 rd-bridge-detail 同款本地实现）。
 */
interface DetailItem {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
}

/**
 * 渲染一组带标题的 key-value 描述卡片（bordered Descriptions 风格）。
 *
 * 视觉对齐 rd-bridge-detail BasicDetailsGroup：Card 容器 + 标题栏（border-b）+
 * label 窄列 muted 背景 / value 白底。
 */
function BasicDetailsGroup({
  title,
  items,
}: {
  title: React.ReactNode;
  items: DetailItem[];
}): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      {title ? (
        <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      ) : null}
      {items.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {items.map((item) => (
              <tr key={item.key} className="border-b last:border-b-0">
                <td className="w-1/3 bg-muted/40 px-4 py-3 align-top font-medium text-muted-foreground">
                  {item.label}
                </td>
                <td className="px-4 py-3 align-top">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-6 py-6 text-sm text-muted-foreground">
          {EMPTY_DISPLAY}
        </div>
      )}
    </section>
  );
}

/**
 * LiquidityPoolDetailPage — 流动性池详情页。
 *
 * 迁移自 td-manage src/pages/cross-chain/liquidity-pool/view.tsx（567 行）。
 * useSWR → TanStack Query（useLiquidityPoolBasicInfoQuery / transactions /
 * authorization / operationRecords）。
 *
 * 结构：
 *   - 4 个 Tabs。
 *   - Tab1 基本信息：2 组 Descriptions（基本信息 8 字段 + threshold/emailRecipients）。
 *   - Tab2 transactions 表：transactionType===3 显示 N/A 占位 + type===2 绿色否则红色金额 +
 *     serviceFee/fxrate 在 type===3 时为 0/N/A；行「查看」(type≠3) 跳 cross-chain-transactions/view。
 *   - Tab3 authorization 表：状态(30/35/40/50)。
 *   - Tab4 operationRecords 表：行「查看」跳 /approval-manage/view。
 *   - 底部「返回」按钮。
 *
 * 硬约束（cc-14 summary + 迁移文档第 7.12 节）：
 * - liquidityPoolId 从 query string 取（列表跳 /cross-chain/liquidity-pool/view?id=）。
 * - 调 basicInformation + 3 个子表 list。
 * - 状态色走 LIQUIDITY_POOL_TX_STATUS_COLOR（i18n key 保留源项目拼写错误 ststus），
 *   via CrossChainStatusBadge kind="liquidity-pool-tx"。
 * - Tab2 transactionType===3：transactionAmount/transactionType 列展示 N/A 占位（金额不再渲染），
 *   serviceFee=0、fxrate=N/A；行操作仅显示 N/A 不可点击（源码 actions No 分支 disabled: type===3）。
 * - Tab2 transactionType===2：金额绿色 #25855A；否则（type===1）红色 #C53030。
 * - operationRecords 行「查看」复用 OP_RECORD_VIEW_BTN 权限码（lp/rb/tp 详情共用）。
 * - authorization 表无行操作（源码 actions 返回 []）。
 */
export function LiquidityPoolDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/liquidity-pool/view?id=<id>：
  // catch-all 路由把 slug[0]="view" 解析为 pageKey="detail"，id 走 query string。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const liquidityPoolId = idStr !== '' ? Number(idStr) : undefined;
  const hasId =
    liquidityPoolId != null && !Number.isNaN(liquidityPoolId);

  const basicResult = useLiquidityPoolBasicInfoQuery(liquidityPoolId, hasId);
  const detail: LiquidityPoolBasicInfo | undefined = basicResult.data;

  // ── Tab1 基本信息两组 Descriptions ──
  // items：基本信息 8 字段（tokenName / blockchain / liquidityPoolWalletAddress / status /
  //   balance+symbol / authorized+symbol / updatedby / updatedOn）。
  const basicItems = React.useMemo<DetailItem[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'tokenName',
        label: t('cross_chain_0044'),
        value: detail.tokenName ?? EMPTY_DISPLAY,
      },
      {
        key: 'blockchain',
        label: t('cross_chain_0000'),
        value: detail.blockchain ?? EMPTY_DISPLAY,
      },
      {
        key: 'liquidityPoolWalletAddress',
        label: t('cross_chain_0045'),
        value: (
          <CopyableEllipsisText
            value={showAddress(detail.liquidityPoolWalletAddress)}
            maxWidth={260}
          />
        ),
      },
      {
        key: 'status',
        label: t('filter.status'),
        value: <CrossChainStatusBadge kind="liquidity-pool" status={detail.status} />,
      },
      {
        key: 'balance',
        label: t('cross_chain_0047'),
        value: `${detail.balance ?? ''} ${detail.symbol ?? ''}`.trim(),
      },
      {
        key: 'authorized',
        label: t('cross_chain_0048'),
        value: `${detail.authorized ?? ''} ${detail.symbol ?? ''}`.trim(),
      },
      {
        key: 'updatedby',
        label: t('field.updateBy'),
        value: detail.updatedby ?? EMPTY_DISPLAY,
      },
      {
        key: 'updatedOn',
        label: t('field.updateOn'),
        value:
          detail.updatedOn != null
            ? formatDate(Number(detail.updatedOn), DATETIME_FMT)
            : EMPTY_DISPLAY,
      },
    ];
  }, [detail, t]);

  // items1：threshold + emailRecipients（cross_chain_0055 / cross_chain_0016）。
  const alertItems = React.useMemo<DetailItem[]>(() => {
    if (!detail) return [];
    return [
      {
        key: 'threshold',
        label: t('cross_chain_0055'),
        value: `${detail.threshold ?? ''} ${detail.symbol ?? ''}`.trim(),
      },
      {
        key: 'emailRecipients',
        label: t('cross_chain_0016'),
        value: detail.emailRecipients ?? EMPTY_DISPLAY,
      },
    ];
  }, [detail, t]);

  // ── Tab2 transactions 子表 ──
  interface TxFilterForm {
    walletAddress: string;
    transactionType: string;
    transactionHash: string;
    status: string;
    transactionTimeStart: string;
    transactionTimeEnd: string;
  }
  const EMPTY_TX_FILTER: TxFilterForm = {
    walletAddress: '',
    transactionType: ALL_VALUE,
    transactionHash: '',
    status: ALL_VALUE,
    transactionTimeStart: '',
    transactionTimeEnd: '',
  };
  const [txQuery, setTxQuery] = React.useState<TxFilterForm>(EMPTY_TX_FILTER);
  const [txPagination, setTxPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const txTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([1, 2, 3] as const).map((el) => ({
        value: String(el),
        label: t(`liquidity_pool_transaction_type_${el}`),
      })),
    ],
    [t],
  );
  const txStatusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([30, 35, 40] as const).map((el) => ({
        value: String(el),
        label: t(`liquidity_pool_transaction_ststus_${el}`),
      })),
    ],
    [t],
  );

  const txParams = React.useMemo(() => {
    if (!hasId) return undefined;
    return {
      liquidityPoolId: liquidityPoolId as number,
      pageNum: txPagination.pageNum,
      pageSize: txPagination.pageSize,
      walletAddress: txQuery.walletAddress || undefined,
      transactionType:
        txQuery.transactionType !== ALL_VALUE
          ? txQuery.transactionType
          : undefined,
      transactionHash: txQuery.transactionHash || undefined,
      status: txQuery.status !== ALL_VALUE ? txQuery.status : undefined,
      transactionTimeStart: txQuery.transactionTimeStart
        ? startOfDay(parseISO(txQuery.transactionTimeStart)).getTime()
        : undefined,
      transactionTimeEnd: txQuery.transactionTimeEnd
        ? endOfDay(parseISO(txQuery.transactionTimeEnd)).getTime()
        : undefined,
    };
  }, [hasId, liquidityPoolId, txPagination, txQuery]);
  const txList = useLiquidityPoolTransactionsQuery(txParams, hasId);
  const txRows = txList.data?.rows ?? [];
  const txTotal = txList.data?.page?.total ?? 0;
  const txLoading = txList.isLoading || txList.isFetching;

  const txColumns = React.useMemo<ColumnDef<TransactionRecordItem>[]>(
    () => [
      {
        accessorKey: 'tokenName',
        header: t('cross_chain_0044'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      { accessorKey: 'from', header: t('cross_chain_0063') },
      { accessorKey: 'to', header: t('cross_chain_0064') },
      // transactionType：type===3 时源码仍渲染文案（liquidity_pool_transaction_type_3）。
      {
        accessorKey: 'transactionType',
        header: t('cross_chain_0059'),
        cell: ({ row }) => (
          <span>
            {t(
              `liquidity_pool_transaction_type_${row.original.transactionType ?? ''}`,
            )}
          </span>
        ),
      },
      // transactionAmount：type===2 绿色 #25855A 否则红色 #C53030；type===3 仍渲染金额（源码无 N/A 分支）。
      {
        accessorKey: 'transactionAmount',
        header: t('cross_chain_0065'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span
              className={r.transactionType === 2 ? 'text-[#25855A]' : 'text-[#C53030]'}
            >
              {`${r.transactionAmount ?? ''} ${r.symbol ?? ''}`.trim()}
            </span>
          );
        },
      },
      // serviceFee：type===3 时为 0；否则 serviceFee?serviceFee+symbol:0。
      {
        accessorKey: 'serviceFee',
        header: t('cross_chain_0066'),
        cell: ({ row }) => {
          const r = row.original;
          if (r.transactionType === 3) return <span>0</span>;
          return (
            <span>
              {r.serviceFee ? `${r.serviceFee} ${r.symbol ?? ''}`.trim() : '0'}
            </span>
          );
        },
      },
      // fxrate：type===3 时为 N/A。
      {
        accessorKey: 'fxrate',
        header: t('cross_chain_0067'),
        cell: ({ row }) => {
          const r = row.original;
          if (r.transactionType === 3) return <span>N/A</span>;
          return <span>{r.fxrate ?? EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'transactionTime',
        header: t('cross_chain_0061'),
        cell: ({ row }) => (
          <span>
            {row.original.transactionTime
              ? formatDate(Number(row.original.transactionTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'transactionHash',
        header: t('cross_chain_0060'),
        cell: ({ row }) => (
          <span>{row.original.transactionHash || '--'}</span>
        ),
      },
      // status：CrossChainStatusBadge kind="liquidity-pool-tx"（i18n key 保留 ststus 拼写）。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge
            kind="liquidity-pool-tx"
            status={row.original.status}
          />
        ),
      },
      // 行操作：查看(type≠3) 跳 cross-chain-transactions/view；type===3 显示 N/A 占位。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          if (r.transactionType === 3) {
            return <span className="text-muted-foreground">N/A</span>;
          }
          return (
            <PermissionGuard
              permission={CROSS_CHAIN_PERMISSIONS.OP_RECORD_VIEW_BTN}
            >
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/cross-chain/cross-chain-transactions/view?id=${
                      r.transactionId ?? ''
                    }`,
                  )
                }
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, router],
  );

  // ── Tab3 authorization 子表 ──
  interface AuthFilterForm {
    operationType: string;
    operationTimeStart: string;
    operationTimeEnd: string;
    transactionHash: string;
    transactionTimeStart: string;
    transactionTimeEnd: string;
    status: string;
  }
  const EMPTY_AUTH_FILTER: AuthFilterForm = {
    operationType: ALL_VALUE,
    operationTimeStart: '',
    operationTimeEnd: '',
    transactionHash: '',
    transactionTimeStart: '',
    transactionTimeEnd: '',
    status: ALL_VALUE,
  };
  const [authQuery, setAuthQuery] =
    React.useState<AuthFilterForm>(EMPTY_AUTH_FILTER);
  const [authPagination, setAuthPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const authOpTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([0, 1] as const).map((el) => ({
        value: String(el),
        label: t(`liquidity_pool_authorization_operation_type_${el}`),
      })),
    ],
    [t],
  );
  const authStatusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([30, 35, 40, 50] as const).map((el) => ({
        value: String(el),
        label: t(`liquidity_pool_authorization_status_${el}`),
      })),
    ],
    [t],
  );

  const authParams = React.useMemo(() => {
    if (!hasId) return undefined;
    return {
      liquidityPoolId: liquidityPoolId as number,
      pageNum: authPagination.pageNum,
      pageSize: authPagination.pageSize,
      operationType:
        authQuery.operationType !== ALL_VALUE
          ? authQuery.operationType
          : undefined,
      operationTimeStart: authQuery.operationTimeStart
        ? startOfDay(parseISO(authQuery.operationTimeStart)).getTime()
        : undefined,
      operationTimeEnd: authQuery.operationTimeEnd
        ? endOfDay(parseISO(authQuery.operationTimeEnd)).getTime()
        : undefined,
      transactionHash: authQuery.transactionHash || undefined,
      transactionTimeStart: authQuery.transactionTimeStart
        ? startOfDay(parseISO(authQuery.transactionTimeStart)).getTime()
        : undefined,
      transactionTimeEnd: authQuery.transactionTimeEnd
        ? endOfDay(parseISO(authQuery.transactionTimeEnd)).getTime()
        : undefined,
      status: authQuery.status !== ALL_VALUE ? authQuery.status : undefined,
    };
  }, [hasId, liquidityPoolId, authPagination, authQuery]);
  const authList = useLiquidityPoolAuthorizationQuery(authParams, hasId);
  const authRows = authList.data?.rows ?? [];
  const authTotal = authList.data?.page?.total ?? 0;
  const authLoading = authList.isLoading || authList.isFetching;

  const authColumns = React.useMemo<ColumnDef<AuthorizationRecordItem>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: t('cross_chain_0032'),
        cell: ({ row }) => (
          <span>
            {t(
              `liquidity_pool_authorization_operation_type_${row.original.operationType ?? ''}`,
            )}
          </span>
        ),
      },
      {
        accessorKey: 'changeType',
        header: t('cross_chain_0070'),
        cell: ({ row }) => (
          <span>
            {t(
              `liquidity_pool_authorization_change_type_${row.original.changeType ?? ''}`,
            )}
          </span>
        ),
      },
      {
        accessorKey: 'tokenName',
        header: t('cross_chain_0044'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'authorizedAmount',
        header: t('cross_chain_0071'),
        cell: ({ row }) => (
          <span>
            {`${row.original.authorizedAmount ?? ''} ${
              row.original.currencySymbol ?? ''
            }`.trim()}
          </span>
        ),
      },
      {
        accessorKey: 'operationTime',
        header: t('cross_chain_0068'),
        cell: ({ row }) => (
          <span>
            {row.original.operationTime
              ? formatDate(Number(row.original.operationTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'transactionTime',
        header: t('cross_chain_0061'),
        cell: ({ row }) => (
          <span>
            {row.original.transactionTime
              ? formatDate(Number(row.original.transactionTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'transactionHash',
        header: t('cross_chain_0060'),
        cell: ({ row }) => (
          <span>{row.original.transactionHash || '--'}</span>
        ),
      },
      // status：CrossChainStatusBadge kind="liquidity-pool-tx"（与 transactions 同色表，
      // i18n key 源码用 liquidity_pool_transaction_ststus_，保留 ststus 拼写）。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge
            kind="liquidity-pool-tx"
            status={row.original.status}
          />
        ),
      },
    ],
    [t],
  );

  // ── Tab4 operationRecords 子表 ──
  interface OpFilterForm {
    operationType: string;
  }
  const EMPTY_OP_FILTER: OpFilterForm = { operationType: ALL_VALUE };
  const [opQuery, setOpQuery] = React.useState<OpFilterForm>(EMPTY_OP_FILTER);
  const [opPagination, setOpPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const opTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([1, 2] as const).map((el) => ({
        value: String(el),
        label: t(`liquidity_pool_operation_type_${el}`),
      })),
    ],
    [t],
  );

  const opParams = React.useMemo(() => {
    if (!hasId) return undefined;
    return {
      liquidityPoolId: liquidityPoolId as number,
      pageNum: opPagination.pageNum,
      pageSize: opPagination.pageSize,
      operationType:
        opQuery.operationType !== ALL_VALUE
          ? opQuery.operationType
          : undefined,
    };
  }, [hasId, liquidityPoolId, opPagination, opQuery]);
  const opList = useLiquidityPoolOpRecordsQuery(opParams, hasId);
  const opRows = opList.data?.rows ?? [];
  const opTotal = opList.data?.page?.total ?? 0;
  const opLoading = opList.isLoading || opList.isFetching;

  const opColumns = React.useMemo<ColumnDef<OperationRecordItem>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: t('cross_chain_0032'),
        cell: ({ row }) => (
          <span>
            {t(`liquidity_pool_operation_type_${row.original.operationType ?? ''}`)}
          </span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('field.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createdBy || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createdOn',
        header: t('field.createdTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createdOn
              ? formatDate(Number(row.original.createdOn), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'transactionTime',
        header: t('cross_chain_0061'),
        cell: ({ row }) => (
          <span>
            {row.original.transactionTime
              ? formatDate(Number(row.original.transactionTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'transactionHash',
        header: t('cross_chain_0060'),
        cell: ({ row }) => (
          <span>{row.original.transactionHash || '--'}</span>
        ),
      },
      // status：走 common 命名空间动态色名（approval_task_status_color_${status} +
      //   common_task_status_${status}），与 token-pair-detail OpRecordStatusBadge 同源。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => <OpRecordStatusBadge status={row.original.status} />,
      },
      // 行「查看」跳 /approval-manage/view?id=&busCode=。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard
              permission={CROSS_CHAIN_PERMISSIONS.OP_RECORD_VIEW_BTN}
            >
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/approval-manage/view?id=${r.taskId ?? ''}&busCode=${
                      r.businessCode ?? ''
                    }`,
                  )
                }
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, router],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">{t('cross_chain_0033')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('cross_chain_0062')}</TabsTrigger>
          <TabsTrigger value="authorization">{t('cross_chain_0076')}</TabsTrigger>
          <TabsTrigger value="records">{t('cross_chain_0031')}</TabsTrigger>
        </TabsList>

        {/* Tab1 基本信息：2 组 Descriptions */}
        <TabsContent value="basic" className="space-y-6 pt-4">
          <BasicDetailsGroup title={t('cross_chain_0058')} items={basicItems} />
          <BasicDetailsGroup title={t('cross_chain_0077')} items={alertItems} />
        </TabsContent>

        {/* Tab2 transactions 表 */}
        <TabsContent value="transactions" className="space-y-4 pt-4">
          <TxFilterBar
            typeOptions={txTypeOptions}
            statusOptions={txStatusOptions}
            filter={txQuery}
            onChange={(next) => {
              setTxQuery(next);
              setTxPagination((p) => ({ ...p, pageNum: 1 }));
            }}
            onReset={() => {
              setTxQuery(EMPTY_TX_FILTER);
              setTxPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
            }}
          />
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('cross_chain_0062')}
            </div>
            <div className="p-4">
              <DataTable
                columns={txColumns}
                data={txRows}
                isLoading={txLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: txPagination.pageNum,
                  pageSize: txPagination.pageSize,
                  total: txTotal,
                  onPageChange: (p) =>
                    setTxPagination((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab3 authorization 表（无行操作） */}
        <TabsContent value="authorization" className="space-y-4 pt-4">
          <AuthFilterBar
            opTypeOptions={authOpTypeOptions}
            statusOptions={authStatusOptions}
            filter={authQuery}
            onChange={(next) => {
              setAuthQuery(next);
              setAuthPagination((p) => ({ ...p, pageNum: 1 }));
            }}
            onReset={() => {
              setAuthQuery(EMPTY_AUTH_FILTER);
              setAuthPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
            }}
          />
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('cross_chain_0069')}
            </div>
            <div className="p-4">
              <DataTable
                columns={authColumns}
                data={authRows}
                isLoading={authLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: authPagination.pageNum,
                  pageSize: authPagination.pageSize,
                  total: authTotal,
                  onPageChange: (p) =>
                    setAuthPagination((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab4 operationRecords 表 */}
        <TabsContent value="records" className="space-y-4 pt-4">
          <OpFilterBar
            opTypeOptions={opTypeOptions}
            filter={opQuery}
            onChange={(next) => {
              setOpQuery(next);
              setOpPagination((p) => ({ ...p, pageNum: 1 }));
            }}
            onReset={() => {
              setOpQuery(EMPTY_OP_FILTER);
              setOpPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
            }}
          />
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('cross_chain_0031')}
            </div>
            <div className="p-4">
              <DataTable
                columns={opColumns}
                data={opRows}
                isLoading={opLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: opPagination.pageNum,
                  pageSize: opPagination.pageSize,
                  total: opTotal,
                  onPageChange: (p) =>
                    setOpPagination((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center">
        <Button onClick={() => router.back()}>{t('action.back')}</Button>
      </div>
    </div>
  );
}

/**
 * antd 色名 → Tailwind badge class（与 cross-chain-status-badge TONE_CLASS 同源）。
 *
 * operationRecords status 的配色由 i18n key `approval_task_status_color_${status}` 返回
 * antd 色名（common 命名空间），此处做静态映射；未知色名回落 gray。
 */
const OP_TONE_CLASS: Record<string, string> = {
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

/**
 * operationRecords status Tag（common 命名空间动态色名 + common_task_status_${status}）。
 *
 * 与 token-pair-detail OpRecordStatusBadge 同源（源码 view.tsx operationRecords status 列）。
 */
function OpRecordStatusBadge({ status }: { status?: number }): React.JSX.Element {
  const tCommon = useTranslations('common');
  if (status == null) {
    return <span className="text-sm text-muted-foreground">{EMPTY_DISPLAY}</span>;
  }
  const tone = tCommon(`approval_task_status_color_${status}`);
  const label = tCommon(`common_task_status_${status}`);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        OP_TONE_CLASS[tone] ?? OP_TONE_CLASS.default
      }`}
    >
      {label}
    </span>
  );
}

// ── 子表筛选栏（受控，查询触发分页重置）──

/** transactions 子表筛选栏。 */
function TxFilterBar({
  typeOptions,
  statusOptions,
  filter,
  onChange,
  onReset,
}: {
  typeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  filter: {
    walletAddress: string;
    transactionType: string;
    transactionHash: string;
    status: string;
    transactionTimeStart: string;
    transactionTimeEnd: string;
  };
  onChange: (next: typeof filter) => void;
  onReset: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const [local, setLocal] = React.useState(filter);
  React.useEffect(() => setLocal(filter), [filter]);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label
            htmlFor="lp-tx-walletAddress"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0024')}
          </label>
          <input
            id="lp-tx-walletAddress"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={t('cross_chain_0024')}
            value={local.walletAddress}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, walletAddress: e.target.value }))
            }
          />
        </div>
        <div>
          <label
            htmlFor="lp-tx-transactionType"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0059')}
          </label>
          <Select
            value={local.transactionType}
            onValueChange={(v) =>
              setLocal((prev) => ({ ...prev, transactionType: v }))
            }
          >
            <SelectTrigger id="lp-tx-transactionType">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label
            htmlFor="lp-tx-transactionHash"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0060')}
          </label>
          <input
            id="lp-tx-transactionHash"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={t('cross_chain_0060')}
            value={local.transactionHash}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, transactionHash: e.target.value }))
            }
          />
        </div>
        <div>
          <label
            htmlFor="lp-tx-status"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('filter.status')}
          </label>
          <Select
            value={local.status}
            onValueChange={(v) => setLocal((prev) => ({ ...prev, status: v }))}
          >
            <SelectTrigger id="lp-tx-status">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DatePickerField
          id="lp-tx-transactionTimeStart"
          label={t('cross_chain_0061')}
          value={local.transactionTimeStart}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, transactionTimeStart: v }))
          }
        />
        <DatePickerField
          id="lp-tx-transactionTimeEnd"
          label={t('cross_chain_0061')}
          value={local.transactionTimeEnd}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, transactionTimeEnd: v }))
          }
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onChange(local)}>{t('filter.query')}</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {t('filter.reset')}
        </Button>
      </div>
    </div>
  );
}

/** authorization 子表筛选栏。 */
function AuthFilterBar({
  opTypeOptions,
  statusOptions,
  filter,
  onChange,
  onReset,
}: {
  opTypeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  filter: {
    operationType: string;
    operationTimeStart: string;
    operationTimeEnd: string;
    transactionHash: string;
    transactionTimeStart: string;
    transactionTimeEnd: string;
    status: string;
  };
  onChange: (next: typeof filter) => void;
  onReset: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const [local, setLocal] = React.useState(filter);
  React.useEffect(() => setLocal(filter), [filter]);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label
            htmlFor="lp-auth-operationType"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0032')}
          </label>
          <Select
            value={local.operationType}
            onValueChange={(v) =>
              setLocal((prev) => ({ ...prev, operationType: v }))
            }
          >
            <SelectTrigger id="lp-auth-operationType">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              {opTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DatePickerField
          id="lp-auth-operationTimeStart"
          label={t('cross_chain_0068')}
          value={local.operationTimeStart}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, operationTimeStart: v }))
          }
        />
        <DatePickerField
          id="lp-auth-operationTimeEnd"
          label={t('cross_chain_0068')}
          value={local.operationTimeEnd}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, operationTimeEnd: v }))
          }
        />
        <div>
          <label
            htmlFor="lp-auth-transactionHash"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0060')}
          </label>
          <input
            id="lp-auth-transactionHash"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={t('cross_chain_0060')}
            value={local.transactionHash}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, transactionHash: e.target.value }))
            }
          />
        </div>
        <DatePickerField
          id="lp-auth-transactionTimeStart"
          label={t('cross_chain_0061')}
          value={local.transactionTimeStart}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, transactionTimeStart: v }))
          }
        />
        <DatePickerField
          id="lp-auth-transactionTimeEnd"
          label={t('cross_chain_0061')}
          value={local.transactionTimeEnd}
          onChange={(v) =>
            setLocal((prev) => ({ ...prev, transactionTimeEnd: v }))
          }
        />
        <div>
          <label
            htmlFor="lp-auth-status"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('filter.status')}
          </label>
          <Select
            value={local.status}
            onValueChange={(v) => setLocal((prev) => ({ ...prev, status: v }))}
          >
            <SelectTrigger id="lp-auth-status">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onChange(local)}>{t('filter.query')}</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {t('filter.reset')}
        </Button>
      </div>
    </div>
  );
}

/** operationRecords 子表筛选栏。 */
function OpFilterBar({
  opTypeOptions,
  filter,
  onChange,
  onReset,
}: {
  opTypeOptions: { value: string; label: string }[];
  filter: { operationType: string };
  onChange: (next: typeof filter) => void;
  onReset: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const [local, setLocal] = React.useState(filter);
  React.useEffect(() => setLocal(filter), [filter]);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="w-56">
          <label
            htmlFor="lp-op-operationType"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t('cross_chain_0032')}
          </label>
          <Select
            value={local.operationType}
            onValueChange={(v) =>
              setLocal((prev) => ({ ...prev, operationType: v }))
            }
          >
            <SelectTrigger id="lp-op-operationType">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              {opTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onChange(local)}>{t('filter.query')}</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {t('filter.reset')}
        </Button>
      </div>
    </div>
  );
}

/**
 * 轻量日期选择字段（受控，value 为 '' 或 'YYYY-MM-DD' 字符串）。
 *
 * 子表筛选栏内嵌使用：直接受控于本地 useState，
 * 不依赖 react-hook-form（FormDatePicker 基于 RHF control，不便嵌入受控筛选栏）。
 * 输出 'YYYY-MM-DD' 字符串，与 startOfDay/endOfDay(parseISO(...)) 解析一致。
 * 视觉与筛选栏内 Input 文本框统一（h-9 + border-input + ring）。
 */
function DatePickerField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}): React.JSX.Element {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        ariaLabel={label}
        className="h-9 bg-transparent py-1 shadow-sm focus-visible:ring-1"
      />
    </div>
  );
}
