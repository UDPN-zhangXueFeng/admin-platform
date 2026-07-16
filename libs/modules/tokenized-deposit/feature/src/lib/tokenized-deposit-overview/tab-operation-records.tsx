/**
 * OverviewOperationRecordsTab — 运营总览页 Tab4 操作记录。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 customTable3
 * （active==='4'，tokenized_deposit_0055「Operation Records」）。
 *
 * ## 数据源（对齐源 873-958 行）
 *
 * endpoint: POST /api/manage/v1/td/records/listPage
 * initialValues: stablecoinCode（源 getUsablePrice.code，注入 query params）。
 * rowKey: recordId。
 *
 * 源 customTable3 `form hidden: true, items: []`，无 UI 筛选，仅靠
 * initialValues 隐式过滤。这里等价：直接把 stablecoinCode 塞进 query params。
 *
 * ## 列（对齐源 886-931 行，逐列）
 *
 * - tokenized_deposit_0042：recordType → record_type_${recordType}（纯文案）
 * - tokenized_deposit_0056：createUser
 * - tokenized_deposit_0057：createTime → formatDate
 * - tokenized_deposit_0060：txHash → Copy + 浏览器 href，空 → '--'
 * - tokenized_deposit_0061：txTime → formatDate
 * - PUB_Status：state → Badge task（源 dataIndex 'state'，注意非 'status'）
 *
 * 注意：操作记录表的状态字段名是 `state`（区别于铸销记录表的 `status`），
 * 与源码 customTable3 dataIndex 'state' 一致。
 *
 * ## 行操作 View（跨模块跳转 /approval-manage/view，对齐源 944-956 行）
 *
 * 源 actionClick 'View'：跳 `/approval-manage/view?id={taskId}&busCode={busCode}`。
 * 注意操作记录表的业务编码字段是 `busCode`（区别于铸销记录表的 `businessCode`）。
 * 源 disabled: false（恒可点）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  OPERATION_RECORD_TYPE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/tokenized-deposit/util';
import {
  useOperationRecordQuery,
  type ApplyListItem,
  type OperationRecordItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '@myorg/modules/tokenized-deposit/ui';

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 审批详情路由（跨模块跳转，源 pathname '/approval-manage/view'）。 */
const APPROVAL_VIEW_ROUTE = '/approval-manage/view';

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

export interface OverviewOperationRecordsTabProps {
  /** 当前选中 TD（源 getUsablePrice）。提供 code（注入 stablecoinCode 过滤）。 */
  td: ApplyListItem;
}

/**
 * 渲染 Tab4 操作记录。
 *
 * 用法（在 OverviewShell TabsContent value="4" 内）：
 * ```tsx
 * <OverviewOperationRecordsTab td={currentTd} />
 * ```
 */
export function OverviewOperationRecordsTab({
  td,
}: OverviewOperationRecordsTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // stablecoinCode 注入（源 initialValues.stablecoinCode = getUsablePrice.code）。
  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinCode: td?.code ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.code],
  );

  const query = useOperationRecordQuery(params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // 行操作 View：跳审批详情（源 actionClick 'View'）。
  // 业务编码字段是 busCode（区别于铸销记录表的 businessCode）。
  const handleView = React.useCallback(
    (row: OperationRecordItem) => {
      router.push(
        `${APPROVAL_VIEW_ROUTE}?id=${row.taskId ?? ''}&busCode=${
          row.busCode ?? ''
        }`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<OperationRecordItem>[]>(
    () => [
      {
        // tokenized_deposit_0042：record_type_{recordType}
        accessorKey: 'recordType',
        header: t('tokenized_deposit_0042'),
        cell: ({ getValue }) => {
          const recordType = getValue<number>();
          if (recordType == null) return <span>{EMPTY_DISPLAY}</span>;
          return (
            <span>{t(`${OPERATION_RECORD_TYPE_KEY_PREFIX}${recordType}`)}</span>
          );
        },
      },
      {
        // tokenized_deposit_0056：createUser（源无 render）
        accessorKey: 'createUser',
        header: t('tokenized_deposit_0056'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0057：createTime → formatDate
        accessorKey: 'createTime',
        header: t('tokenized_deposit_0057'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // tokenized_deposit_0060：txHash → Copy + 浏览器 href，空 → '--'
        accessorKey: 'txHash',
        header: t('tokenized_deposit_0060'),
        cell: ({ row }) => {
          const hash = row.original.txHash;
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
        // tokenized_deposit_0061：txTime → formatDate
        accessorKey: 'txTime',
        header: t('tokenized_deposit_0061'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：state（注意非 status）→ Badge task
        // 源 dataIndex 'state'，color=approval_task_status_color_{state}，
        // label=common_task_status_{state}。
        accessorKey: 'state',
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
          // 源 limit '61dea32a...'（TD_PERMISSIONS.VIEW_OPERATION_RECORD），disabled: false。
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_OPERATION_RECORD}>
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
