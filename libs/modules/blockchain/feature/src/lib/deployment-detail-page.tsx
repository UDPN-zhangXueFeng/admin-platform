'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useDeploymentDetailQuery,
  type DeploymentContractRow,
} from '@myorg/modules/blockchain/data-access';
import {
  CONTRACT_NAME_LABEL_KEY_PREFIX,
  EMPTY_DISPLAY,
} from '@myorg/modules/blockchain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 状态列写死 success（源码 deployment/view.tsx:83-88 遗留：
 * render: () => <Tag color="success">{t('token_task_status_10')}</Tag>，
 * 不论实际 status 值，永远显示成功态）。见迁移文档第 8 章「已知限制」。
 * 与 deployment-list-page 的 StatusSuccessBadge 同款实现。
 */
function StatusSuccessBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      {label}
    </span>
  );
}

/**
 * 为静态表格行注入 DataTable 契约要求的 `id`（DeploymentContractRow 本身无主键，
 * 以 行索引 兜底，仅静态展示用，无业务语义）。
 */
function withRowId(rows: DeploymentContractRow[] | undefined) {
  return (rows ?? []).map((row, index) => ({
    ...row,
    id: String(index),
  }));
}

/**
 * DeploymentDetailPage — 合约部署详情页。
 *
 * 迁移自 td-manage src/pages/blockchain/deployment/view.tsx（114 行）。
 * useSWR → TanStack Query（useDeploymentDetailQuery），antd Table → DataTable。
 *
 * 结构：
 *   1. 标题区：`tdName + 部署详情`（blockchain_0024）+ 包名/版本（blockchain_0025 + V{packageVersion}）
 *      + 部署时间（deployTime 时间戳格式化）。
 *   2. 内嵌静态 DataTable（detailList 合约清单，无服务端分页），8 列：
 *      contractName（contractName_${n}）/ contractVersion / contractAddress（ellipsis）/
 *      contractHash（ellipsis）/ blockchainName / ownerAddress（ellipsis）/
 *      txHash（ellipsis）/ status（写死 success）。
 *   3. 底部「返回」按钮。
 *
 * 硬约束（本模块特有）：
 * - 调 deployment/details，入参 recordId（详情接口 endpoint 保持 'details' 拼写，data-access 层已封装）。
 * - recordId 从 query string 取（列表页 router.push('/blockchain/deployment/view?recordId=')），
 *   兼容 useParams 的 dynamic 段以备路径式调用。
 * - 状态列写死 success（源码遗留，见上方 StatusSuccessBadge 注释）。
 */
export function DeploymentDetailPage() {
  const t = useTranslations('modules.blockchain');
  const router = useRouter();

  // 列表页跳转 /blockchain/deployment/view?recordId=<id>：
  // catch-all 路由把 slug[0]="view" 解析为 pageKey="detail"，recordId 走 query string。
  const searchParams = useSearchParams();
  const params = useParams<{ recordId?: string }>();
  const recordId =
    searchParams.get('recordId') ?? params?.recordId ?? undefined;

  const { data: detail, isLoading } = useDeploymentDetailQuery(recordId);

  const rows = React.useMemo(() => withRowId(detail?.detailList), [detail]);

  const columns = React.useMemo<ColumnDef<DeploymentContractRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'contractName',
        header: t('blockchain_0007'),
        cell: ({ row }) => {
          const n = row.original.contractName;
          return n == null ? (
            <span>{EMPTY_DISPLAY}</span>
          ) : (
            <span>{t(`${CONTRACT_NAME_LABEL_KEY_PREFIX}${Number(n)}`)}</span>
          );
        },
      },
      {
        accessorKey: 'contractVersion',
        header: t('blockchain_0011'),
        cell: ({ row }) => (
          <span>{row.original.contractVersion || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'contractAddress',
        header: t('blockchain_0026'),
        // 源码 ellipsis: true → CopyableEllipsisText（截断 + tooltip 全文 + 复制）。
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.contractAddress}
            emptyText={EMPTY_DISPLAY}
          />
        ),
      },
      {
        accessorKey: 'contractHash',
        header: t('blockchain_0037'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.contractHash}
            emptyText={EMPTY_DISPLAY}
          />
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('blockchain_0016'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'ownerAddress',
        header: t('blockchain_0019'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.ownerAddress}
            emptyText={EMPTY_DISPLAY}
          />
        ),
      },
      {
        accessorKey: 'txHash',
        header: t('blockchain_0027'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.txHash}
            emptyText={EMPTY_DISPLAY}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        // 写死 success（源码遗留：只展示成功部署记录）。
        cell: () => <StatusSuccessBadge label={t('token_task_status_10')} />,
      },
    ],
    [t],
  );

  const deployTime = detail?.deployTime;
  const deployTimeText = deployTime
    ? formatDate(deployTime, DATETIME_FMT)
    : EMPTY_DISPLAY;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card shadow-sm">
        {/* 标题区：tdName + 部署详情 */}
        <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-4">
          <div className="text-base font-semibold">
            {detail?.tdName
              ? `${detail.tdName} ${t('blockchain_0024')}`
              : t('blockchain_0024')}
          </div>
        </div>
        {/* 包名 / 版本 / 部署时间 */}
        <div className="space-y-4 px-6 py-6">
          <div className="text-sm font-semibold">
            {t('blockchain_0025')}
            {detail?.packageVersion
              ? ` V${detail.packageVersion}`
              : ''}
          </div>
          <div className="text-sm text-muted-foreground">{deployTimeText}</div>
        </div>

        {/* 内嵌静态合约清单表格（无服务端分页） */}
        <div className="px-4 pb-6">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
