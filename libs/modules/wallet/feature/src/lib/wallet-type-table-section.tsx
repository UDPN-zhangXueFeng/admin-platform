'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
} from '@myorg/shared/ui';
import { useAuth } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  useWalletTypeTableQuery,
  type StablecoinSearchOption,
  type WalletTypeTableRow,
  type WalletListParams,
} from '@myorg/modules/wallet/data-access';
import {
  accountTypeMessageKey,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatLimit,
  toMillis,
  WALLET_PERMISSIONS,
} from '@myorg/modules/wallet/util';

/** 限额/时间展示格式（与 operational-wallet 一致）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * `NEXT_PUBLIC_FILE_ID` PDF 下载基址（源 sftp/download blob）。
 *
 * KNOWN LIMITATION：data-access 未暴露 resources/search + sftp/download blob 端点，
 * 且 apiClient 只解包 `{code,message,data}` 信封（无 responseType=blob 能力）。
 * 环境未配置 `NEXT_PUBLIC_FILE_ID` 时，API 文档按钮降级为 disabled（不崩）。
 * 后续接入需：① data-access 新增 getResources/getDownloadBlob；② apiClient 支持
 * responseType=blob。详见迁移文档 §6 已知限制。
 */
const FILE_ID_BASE = process.env.NEXT_PUBLIC_FILE_ID ?? '';
const PDF_DOWNLOAD_AVAILABLE = Boolean(FILE_ID_BASE);

export interface WalletTypeTableSectionProps {
  /** 当前 stablecoin（提供 issueType / stablecoinId 等上下文）。 */
  stablecoin?: StablecoinSearchOption;
}

/**
 * WalletTypeTableSection — 钱包类型两张表（常规 / MMF，按 issueType 切换列集）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx` 第 100-419 行的两张
 * CustomTable（均打 `/wallet/type/list` 同一 endpoint，列按 issueType===20 分流）。
 *
 * 忠实源逻辑：
 * - 服务端分页（pageNum/pageSize，列表 hook 已配 keepPreviousData）。
 * - 列按 issueType 分流：
 *   - 常规（issueType !== 20）：name / accountType / 单笔 / 日 / 稳定币 / 最低余额 /
 *     最大赎回 / 创建人 / 创建时间 / 状态。
 *   - MMF（issueType === 20）：name / walletTypeCode / 基金类型 / 风险 / 净值 /
 *     成立日 / 创建人 / 创建时间 / 状态。
 * - 状态列 WalletStatusBadge（wallet-type 族：1/5/10/15/20/25）。
 * - 表头 Add 按钮（跳新增路径，按 issueType 分流 mff/常规）。
 * - MMF 表头额外 API 文档按钮（PDF 下载，依赖 NEXT_PUBLIC_FILE_ID，无则 disabled）。
 * - 行操作 View：跳 `/approval-manage/view?id=taskId&busCode=businessCode`（源 actionClick
 *   View 忠实保留——表行是审批记录维度，非钱包类型详情）。
 * - stablecoin 未选 / state===2 时：表头写操作禁用；stablecoinId 缺失则 hook 不请求。
 */
export function WalletTypeTableSection({
  stablecoin,
}: WalletTypeTableSectionProps): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();

  const canEdit =
    authPermissions.size === 0 || authPermissions.has(WALLET_PERMISSIONS.WalletTypeEdit);
  const canViewDetail =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.WalletTypeDetail);

  const isMmf = stablecoin?.issueType === 20;
  const stablecoinDisabled = stablecoin?.state === 2;
  const stablecoinId = stablecoin?.stablecoinId;

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // stablecoin 切换时重置到第 1 页（源切 tab 后表重新加载）。
  React.useEffect(() => {
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [stablecoinId]);

  const params = React.useMemo<
    WalletListParams<Record<string, unknown>>
  >(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: { stablecoinId },
    }),
    [pagination.pageNum, pagination.pageSize, stablecoinId]
  );

  const listResult = useWalletTypeTableQuery(stablecoinId, params, Boolean(stablecoinId));
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const buildAddPath = React.useCallback((): string => {
    if (!stablecoin) return '';
    const base = isMmf
      ? '/wallet/wallet-type/mff/mff-add'
      : '/wallet/wallet-type/edit';
    const params = new URLSearchParams({
      type: 'add',
      stablecoinId: String(stablecoin.stablecoinId),
      name: `${stablecoin.name ?? ''} (${stablecoin.blockchainNameAbbreviation ?? ''})`,
      symbol: isMmf
        ? stablecoin.currencySymbol ?? ''
        : stablecoin.symbol ?? '',
      issueType: String(stablecoin.issueType ?? ''),
    });
    return `${base}?${params.toString()}`;
  }, [stablecoin, isMmf]);

  const columns = React.useMemo<ColumnDef<WalletTypeTableRow>[]>(() => {
    const common: ColumnDef<WalletTypeTableRow>[] = [
      {
        id: 'name',
        header: t('walletType.column.name'),
        cell: ({ row }) => (
          <span>{row.original.name || EMPTY_DISPLAY}</span>
        ),
      },
    ];

    if (isMmf) {
      return [
        ...common,
        {
          id: 'walletTypeCode',
          header: t('walletType.column.walletTypeCode'),
          cell: ({ row }) => (
            <span>
              {(row.original as WalletTypeTableRow & { walletTypeCode?: string }).walletTypeCode ||
                EMPTY_DISPLAY}
            </span>
          ),
        },
        {
          id: 'createTime',
          header: t('common.createTime'),
          cell: ({ row }) => {
            const ms = toMillis(Number(row.original.createTime));
            return (
              <span>{ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY}</span>
            );
          },
        },
        {
          id: 'state',
          header: t('common.status'),
          cell: ({ row }) => (
            <WalletStatusBadge
              family="wallet-type"
              status={row.original.state}
            />
          ),
        },
        {
          id: 'actions',
          header: t('common.operate'),
          cell: ({ row }) =>
            canViewDetail ? (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/approval-manage/view?id=${encodeURIComponent(
                      row.original.taskId ?? ''
                    )}&busCode=${encodeURIComponent(row.original.businessCode ?? '')}`
                  )
                }
              >
                {t('common.detail')}
              </Button>
            ) : (
              <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
            ),
        },
      ];
    }

    return [
      ...common,
      {
        id: 'accountType',
        header: t('walletType.column.accountType'),
        cell: ({ row }) => {
          const key = accountTypeMessageKey(row.original.accountType);
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'maxTxCountPer',
        header: t('walletType.column.maxTxCountPer'),
        cell: ({ row }) => (
          <span>{formatLimit(Number(row.original.maxTxCountPer))}</span>
        ),
      },
      {
        id: 'maxTxCountDaily',
        header: t('walletType.column.maxTxCountDaily'),
        cell: ({ row }) => (
          <span>{formatLimit(Number(row.original.maxTxCountDaily))}</span>
        ),
      },
      {
        id: 'stablecoinCount',
        header: t('walletType.column.stablecoinCount'),
        cell: ({ row }) => (
          <span>{formatLimit(Number(row.original.stablecoinCount))}</span>
        ),
      },
      {
        id: 'minimumBalance',
        header: t('walletType.column.minimumBalance'),
        cell: ({ row }) => (
          <span>{formatLimit(Number(row.original.minimumBalance))}</span>
        ),
      },
      {
        id: 'maximumRedeemLimit',
        header: t('walletType.column.maximumRedeemLimit'),
        cell: ({ row }) => (
          <span>
            {formatLimit(
              Number(
                (row.original as WalletTypeTableRow & {
                  maximumRedeemLimit?: number;
                }).maximumRedeemLimit
              )
            )}
          </span>
        ),
      },
      {
        id: 'createUser',
        header: t('walletType.column.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createTime',
        header: t('common.createTime'),
        cell: ({ row }) => {
          const ms = toMillis(Number(row.original.createTime));
          return (
            <span>{ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'state',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge
            family="wallet-type"
            status={row.original.state}
          />
        ),
      },
      {
        id: 'actions',
        header: t('common.operate'),
        cell: ({ row }) =>
          canViewDetail ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/approval-manage/view?id=${encodeURIComponent(
                    row.original.taskId ?? ''
                  )}&busCode=${encodeURIComponent(row.original.businessCode ?? '')}`
                )
              }
            >
              {t('common.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
          ),
      },
    ];
  }, [t, isMmf, canViewDetail, router]);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="text-sm font-semibold">
          {isMmf ? t('walletType.mmfRecords') : t('walletType.records')}
        </div>
        {stablecoin && !stablecoinDisabled ? (
          <div className="flex gap-2">
            {isMmf ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!PDF_DOWNLOAD_AVAILABLE || !canEdit}
                onClick={() => {
                  // KNOWN LIMITATION：PDF 下载需 resources/search + sftp/blob，
                  // data-access 未建模、apiClient 无 blob 能力。环境配置 FILE_ID 后
                  // 方可启用（task §6）。当前仅保留 UI 入口，点击无副作用。
                  if (!PDF_DOWNLOAD_AVAILABLE) return;
                }}
              >
                {t('walletType.action.apiDoc')}
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" onClick={() => router.push(buildAddPath())}>
                {t('walletType.action.add')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="p-4">
        {!stablecoinId ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('walletType.invalidStablecoin')}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('common.noData')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        )}
      </div>
    </div>
  );
}
