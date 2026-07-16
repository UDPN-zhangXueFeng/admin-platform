/**
 * OverviewRecordsTab — 运营总览页 Tab1 铸销记录。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 getItem() Tab1（3 分支）：
 * - 质押铸造（mintMethod===1 && pledgeType===1）：customTable（/td/manage/searches/record）
 * - MMF（mintMethod===20 && pledgeType===0）：嵌入 `<Summary tokenCode={code} />`（td-21）
 * - SP 直铸（其余 mintMethod/pledgeType 组合）：customTableSp（/transaction/getDirectMintingTxList）
 *
 * ## 三分支判断顺序（严格对齐源码 getItem 第 1123-1139 行）
 *
 * 源码是 if/else if/else 链：先匹配质押，再匹配 MMF，最后兜底 SP。
 * 故 SP 分支并非「mintMethod===20」，而是「非质押且非 MMF 的所有组合」。
 * 任务描述称「SP 直铸 mintMethod===20」与源码相反 —— **以源码为准**（见返回说明）。
 *
 * ## 数据过滤（react-hook-form 隐式）
 *
 * 源 customTable / customTableSp 均 `form hidden: true, items: []`，仅靠
 * initialValues（stablecoinCode / stablecoinId）作为隐式过滤条件传给后端，无 UI 筛选。
 * 这里等价：直接把标识塞进 query params，不引入 form。
 *
 * ## 行操作 View（跨模块跳转 /approval-manage/view）
 *
 * - 质押分支：恒可点（源 disabled: false）。
 * - SP 分支：`taskId === null` 时 disabled（源 disabled: data.taskId === null ? true : false）。
 * 两者均跳 `/approval-manage/view?id={taskId}&busCode={businessCode}`。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable } from '@myorg/shared/ui';
import { Button } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import { formatNumber } from '@myorg/shared/util-formatting';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  MINT_METHOD,
  ORDER_TYPE_KEY_PREFIX,
  PLEDGE_TYPE,
  RECORD_TYPE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/tokenized-deposit/util';
import {
  useSPRecordQuery,
  useTDRecordQuery,
  type ApplyListItem,
  type SPRecordItem,
  type TDRecordItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '@myorg/modules/tokenized-deposit/ui';
import { Summary } from '../summary';

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 数值格式化 locale（与 overview-info-card reSet 等价实现一致）。 */
const NUMBER_LOCALE = 'en-US';

/** 审批详情路由（跨模块跳转，源 pathname '/approval-manage/view'）。 */
const APPROVAL_VIEW_ROUTE = '/approval-manage/view';

/**
 * 安全数值格式化（千分位 + 2 位小数）。
 *
 * 对齐源码 `reSet(value)`：value>=0 千分位 + 2 位小数，否则 '--'。
 * 与 overview-info-card 的 formatStat 同语义，本表直接用 formatNumber 等价实现。
 */
function formatAmount(value: number | string | undefined | null): string {
  if (value == null || value === '') return EMPTY_DISPLAY;
  const num = Number(value);
  if (Number.isNaN(num)) return EMPTY_DISPLAY;
  return formatNumber(num, NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 构造区块链浏览器 tx 链接（对齐源 getTxBrowserHref）。
 *
 * browserUrl 末尾补 '/'（若无）后拼 'tx/{txHash}'；browserUrl / txHash 缺失返回空串。
 */
function buildTxBrowserHref(
  browserUrl?: string,
  txHash?: string,
): string {
  if (!browserUrl || !txHash) return '';
  const normalized = browserUrl.endsWith('/')
    ? browserUrl
    : `${browserUrl}/`;
  return `${normalized}tx/${txHash}`;
}

export interface OverviewRecordsTabProps {
  /** 当前选中 TD（源 getUsablePrice）。提供 mintMethod/pledgeType/code/stablecoinId。 */
  td: ApplyListItem;
}

/**
 * 渲染 Tab1。按 mintMethod/pledgeType 三分支选择表格或 Summary。
 *
 * 用法（在 OverviewShell TabsContent value="1" 内）：
 * ```tsx
 * <OverviewRecordsTab td={currentTd} />
 * ```
 */
export function OverviewRecordsTab({
  td,
}: OverviewRecordsTabProps): React.JSX.Element {
  const mintMethod = td?.mintMethod;
  const pledgeType = td?.pledgeType;

  // 分支顺序严格对齐源码 getItem if/else if/else。
  if (mintMethod === MINT_METHOD.STABLECOIN && pledgeType === PLEDGE_TYPE.PLEDGE) {
    return <PledgeRecordsTable td={td} />;
  }
  if (mintMethod === MINT_METHOD.MMF && pledgeType === PLEDGE_TYPE.SP) {
    return <Summary tokenCode={td?.code ?? ''} />;
  }
  return <SPRecordsTable td={td} />;
}

// ═══════════════════════════════════════════════════════════════════
// 分支 1：质押铸造记录（customTable）
// ═══════════════════════════════════════════════════════════════════

/**
 * 质押铸造铸销记录表（源 customTable）。
 *
 * endpoint: POST /api/manage/v1/td/manage/searches/record
 * initialValues: stablecoinCode（源 getUsablePrice.code）。
 * rowKey: recordId。
 */
function PledgeRecordsTable({ td }: OverviewRecordsTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinCode: td?.code ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.code],
  );

  const query = useTDRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  const handleView = React.useCallback(
    (row: TDRecordItem) => {
      router.push(
        `${APPROVAL_VIEW_ROUTE}?id=${row.taskId ?? ''}&busCode=${
          row.businessCode ?? ''
        }`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<TDRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0135：recordType===1 取 to，否则取 from（源 dataIndex 'from' + render）
        accessorKey: 'from',
        header: t('tokenized_deposit_0135'),
        cell: ({ row }) => {
          const r = row.original;
          const val = r.recordType === 1 ? r.to : r.from;
          return <span>{val || EMPTY_DISPLAY}</span>;
        },
      },
      {
        // tokenized_deposit_0087：stablecoin_record_type_{recordType}
        accessorKey: 'recordType',
        header: t('tokenized_deposit_0087'),
        cell: ({ getValue }) => {
          const recordType = getValue<number>();
          if (recordType == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${RECORD_TYPE_KEY_PREFIX}${recordType}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0088：reSet(amount) + ' ' + symbol
        accessorKey: 'amount',
        header: t('tokenized_deposit_0088'),
        cell: ({ row }) => (
          <span>
            {formatAmount(row.original.amount)} {row.original.symbol ?? ''}
          </span>
        ),
      },
      {
        // PUB_Creater
        accessorKey: 'createUser',
        header: t('PUB_Creater'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_CreateTime：formatTimestamp(Number(createTime))
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // tokenized_deposit_0089：transactionHash → Copy + browser href
        accessorKey: 'transactionHash',
        header: t('tokenized_deposit_0089'),
        cell: ({ row }) => {
          const hash = row.original.transactionHash;
          if (!hash) return <span>{EMPTY_DISPLAY}</span>;
          return (
            <TokenizedDepositCopy
              text={hash}
              href={buildTxBrowserHref(row.original.browserUrl, hash)}
              ellipsis
            />
          );
        },
      },
      {
        // tokenized_deposit_0086：transactionTime
        accessorKey: 'transactionTime',
        header: t('tokenized_deposit_0086'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：approval_task_status_color_ + common_task_status_
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="task"
            status={getValue<number>()}
          />
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => (
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_RECORD}>
            {/* 源 disabled: false（质押分支恒可点） */}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => handleView(row.original)}
            >
              {t('PUB_Detail')}
            </Button>
          </PermissionGuard>
        ),
      },
    ],
    [t, handleView],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage={t('empty')}
      pagination={{
        page: pagination.pageNum,
        pageSize: pagination.pageSize,
        total,
        onPageChange: (p) =>
          setPagination((prev) => ({ ...prev, pageNum: p })),
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// 分支 3：SP 直铸记录（customTableSp）
// ═══════════════════════════════════════════════════════════════════

/**
 * SP 直铸记录表（源 customTableSp）。
 *
 * endpoint: POST /api/manage/v1/transaction/getDirectMintingTxList
 * initialValues: stablecoinId（源 getUsablePrice.stablecoinId）。
 * rowKey: orderNumber。
 */
function SPRecordsTable({ td }: OverviewRecordsTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinId: td?.stablecoinId ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.stablecoinId],
  );

  const query = useSPRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  const handleView = React.useCallback(
    (row: SPRecordItem) => {
      router.push(
        `${APPROVAL_VIEW_ROUTE}?id=${row.taskId ?? ''}&busCode=${
          row.businessCode ?? ''
        }`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<SPRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0160：spName（源 ellipsis）
        accessorKey: 'spName',
        header: t('tokenized_deposit_0160'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.spName} ellipsis />
        ),
      },
      {
        // tokenized_deposit_0161：walletAddress（源 ellipsis）
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0161'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.walletAddress}
            ellipsis
          />
        ),
      },
      {
        // transaction_flow_004：order_type_{txType}
        accessorKey: 'txType',
        header: t('transaction_flow_004'),
        cell: ({ getValue }) => {
          const txType = getValue<number>();
          if (txType == null) return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${ORDER_TYPE_KEY_PREFIX}${txType}`)}</span>;
        },
      },
      {
        // transaction_flow_005：reSet(txAmount) + ' ' + symbol
        accessorKey: 'txAmount',
        header: t('transaction_flow_005'),
        cell: ({ row }) => (
          <span>
            {formatAmount(row.original.txAmount)} {row.original.symbol ?? ''}
          </span>
        ),
      },
      {
        // PUB_CreateTime（源 createTime 出现两次，第二次实际是占位；保留单列）
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_003：txTime
        accessorKey: 'txTime',
        header: t('transaction_flow_003'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // transaction_flow_007：txHash → Copy + browser href（源 ellipsis）
        accessorKey: 'txHash',
        header: t('transaction_flow_007'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.txHash}
            href={buildTxBrowserHref(row.original.browserUrl, row.original.txHash)}
            ellipsis
          />
        ),
      },
      {
        // PUB_Status：Badge
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="task"
            status={getValue<number>()}
          />
        ),
      },
      {
        // Serial No.：orderNumber（源无 render）。源为硬编码英文未走 i18n，这里保持纯文本避免 MISSING_MESSAGE
        accessorKey: 'orderNumber',
        header: 'Serial No.',
        cell: ({ row }) => (
          <span>{row.original.orderNumber || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const disabled = row.original.taskId == null;
          return (
            <PermissionGuard permission={TD_PERMISSIONS.VIEW_RECORD}>
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={disabled}
                onClick={() => handleView(row.original)}
              >
                {t('PUB_Detail')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, handleView],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage={t('empty')}
      pagination={{
        page: pagination.pageNum,
        pageSize: pagination.pageSize,
        total,
        onPageChange: (p) =>
          setPagination((prev) => ({ ...prev, pageNum: p })),
      }}
    />
  );
}
