'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
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
import {
  CrossChainStatusBadge,
  CustomInformation,
  type CustomInformationSection,
} from '@myorg/modules/cross-chain/ui';
import {
  useTokenPairDetailQuery,
  useTokenPairOperationRecordsQuery,
  type TokenPairRecordItem,
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
 * TokenPairDetailPage — 代币对详情页。
 *
 * 迁移自 td-manage src/pages/cross-chain/token-pair/view.tsx（320 行）。
 * useSWR → TanStack Query（useTokenPairDetailQuery / useTokenPairOperationRecordsQuery）。
 *
 * 结构：
 *   - 2 个 Tabs（Tab1 基本信息：左右两栏 CustomInformation + 中间 token-pair 图标 /
 *     Tab2 操作记录表）。
 *   - Tab1 左栏（getDetailInfo）：send 段（token+色块 / 链 / endpointId /
 *     合约地址 copyable / 钱包地址 copyable）+ crossChainFee 段 + 更新人 / 更新时间 / 状态段。
 *     右栏（getDetailInfo1）：receive 段（同 send 结构）。
 *     中间 token-pair-setting.svg 装饰图标。
 *   - Tab2 操作记录表（recordType 筛选 1/2/3/4）：recordType / 创建人 / 创建时间 /
 *     remarks / status 走 approval_task_status_color_${status} + common_task_status_${status}。
 *     行「查看」跳 /approval-manage/view?id=&busCode=（OP_RECORD_VIEW_BTN 权限码，3 详情页共用）。
 *   - 底部「返回」按钮。
 *
 * 硬约束（cc-12 summary + 迁移文档第 7.18 节）：
 * - tokenCrossChainId 从 query string 取（列表跳 /cross-chain/token-pair/view?id=）。
 * - 调 getTokenPairDetail（基本信息）+ queryOperationRecords（操作记录分页）。
 * - 状态 Tag 走 CrossChainStatusBadge kind="token-pair"（TOKEN_PAIR_STATUS_COLOR）。
 * - 操作记录 status 走 common 命名空间 i18n 动态色名
 *   （approval_task_status_color_${status} + common_task_status_${status}）。
 *   色名映射 antd→Tailwind（与 rd-bridge-detail OP_TONE_CLASS 同源）。
 * - 操作记录行「查看」复用 OP_RECORD_VIEW_BTN 权限码（lp/rb/tp 详情共用）。
 */
export function TokenPairDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const tCommon = useTranslations('common');
  const router = useRouter();

  // 列表页跳 /cross-chain/token-pair/view?id=<id>：
  // catch-all 路由把 slug[0]="view" 解析为 pageKey="detail"，id 走 query string。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const tokenCrossChainId = idStr !== '' ? Number(idStr) : undefined;
  const hasId =
    tokenCrossChainId != null && !Number.isNaN(tokenCrossChainId);

  const detailResult = useTokenPairDetailQuery(tokenCrossChainId, hasId);
  const detail = detailResult.data;

  // ── 操作记录子表 ──
  const [recordFilter, setRecordFilter] = React.useState<{
    recordType: string;
  }>({ recordType: ALL_VALUE });
  const [recordPagination, setRecordPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const recordParams = React.useMemo(() => {
    if (!hasId) return undefined;
    return {
      tokenCrossChainId: tokenCrossChainId as number,
      pageNum: recordPagination.pageNum,
      pageSize: recordPagination.pageSize,
      recordType:
        recordFilter.recordType !== ALL_VALUE
          ? Number(recordFilter.recordType)
          : undefined,
    };
  }, [
    hasId,
    tokenCrossChainId,
    recordPagination.pageNum,
    recordPagination.pageSize,
    recordFilter.recordType,
  ]);
  const recordList = useTokenPairOperationRecordsQuery(recordParams, hasId);
  const recordRows = recordList.data?.rows ?? [];
  const recordTotal = recordList.data?.page?.total ?? 0;
  const recordLoading = recordList.isLoading || recordList.isFetching;

  const recordTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([1, 2, 3, 4] as const).map((el) => ({
        value: String(el),
        label: t(`token_pair_operation_type_${el}`),
      })),
    ],
    [t],
  );

  // ── Tab1 左栏 getDetailInfo（3 段：send / crossChainFee / 更新人+更新时间+状态）──
  const leftSections = React.useMemo<CustomInformationSection[]>(() => {
    if (!detail) return [];
    return [
      {
        title: t('cross_chain_0088'),
        list: [
          {
            label: t('cross_chain_0044'),
            value: (
              <TokenDirectionCell
                tokenName={detail.sendTokenName}
                blockchainShortName={detail.sendBlockchainShortName}
                currencySymbol={detail.sendTokenCurrencySymbol}
                color={tCommon(
                  `blockchain_code_color_${
                    detail.sendBlockchainShortName ?? ''
                  }`,
                )}
              />
            ),
          },
          {
            label: t('cross_chain_0000'),
            value: detail.sendBlockchainName,
          },
          {
            label: t('cross_chain_0001'),
            value: detail.sendEndpointId,
          },
          {
            label: t('cross_chain_00123'),
            value: (
              <CopyableEllipsisText
                value={detail.sendCrossChainAddress}
                maxWidth={260}
              />
            ),
          },
          {
            label: t('cross_chain_0045'),
            value: (
              <CopyableEllipsisText
                value={detail.sendLiquidityPoolWalletAddress}
                maxWidth={260}
              />
            ),
          },
        ],
      },
      {
        list: [
          {
            label: t('cross_chain_0084'),
            value: `${reSet(detail.crossChainFee)} ${t('cross_chain_0090')}`,
          },
        ],
      },
      {
        list: [
          {
            label: t('field.updateBy'),
            value: detail.updateUser,
          },
          {
            label: t('field.updateOn'),
            value:
              detail.updateTime != null
                ? formatDate(Number(detail.updateTime), DATETIME_FMT)
                : EMPTY_DISPLAY,
          },
          {
            label: t('filter.status'),
            value: <CrossChainStatusBadge kind="token-pair" status={detail.status} />,
          },
        ],
      },
    ];
  }, [detail, t, tCommon]);

  // ── Tab1 右栏 getDetailInfo1（1 段：receive）──
  const rightSections = React.useMemo<CustomInformationSection[]>(() => {
    if (!detail) return [];
    return [
      {
        title: t('cross_chain_0092'),
        list: [
          {
            label: t('cross_chain_0044'),
            value: (
              <TokenDirectionCell
                tokenName={detail.receiveTokenName}
                blockchainShortName={detail.receiveBlockchainShortName}
                currencySymbol={detail.receiveTokenCurrencySymbol}
                color={tCommon(
                  `blockchain_code_color_${
                    detail.receiveBlockchainShortName ?? ''
                  }`,
                )}
              />
            ),
          },
          {
            label: t('cross_chain_0000'),
            value: detail.receiveBlockchainName,
          },
          {
            label: t('cross_chain_0001'),
            value: detail.receiveEndpointId,
          },
          {
            label: t('cross_chain_00123'),
            value: (
              <CopyableEllipsisText
                value={detail.receiveCrossChainAddress}
                maxWidth={260}
              />
            ),
          },
          {
            label: t('cross_chain_0045'),
            value: (
              <CopyableEllipsisText
                value={detail.receiveLiquidityPoolWalletAddress}
                maxWidth={260}
              />
            ),
          },
        ],
      },
    ];
  }, [detail, t, tCommon]);

  // ── 操作记录表列 ──
  const recordColumns = React.useMemo<ColumnDef<TokenPairRecordItem>[]>(
    () => [
      {
        accessorKey: 'recordType',
        header: t('cross_chain_0032'),
        cell: ({ row }) => (
          <span>
            {t(`token_pair_operation_type_${row.original.recordType ?? ''}`)}
          </span>
        ),
      },
      {
        accessorKey: 'createUser',
        header: t('field.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.createdTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(Number(row.original.createTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'remarks',
        header: t('cross_chain_0030'),
        cell: ({ row }) => (
          <span>{row.original.remarks || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => <OpRecordStatusBadge status={row.original.status} />,
      },
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
          <TabsTrigger value="records">{t('cross_chain_0031')}</TabsTrigger>
        </TabsList>

        {/* Tab1 基本信息：左右两栏 CustomInformation + 中间图标 */}
        <TabsContent value="basic" className="pt-4">
          <div className="flex items-stretch justify-between gap-4">
            <div className="w-[45%] rounded-md bg-card p-4 shadow-md">
              <CustomInformation detailsInfo={leftSections} />
            </div>
            {/* 中间装饰图标（源码 antd Image src=/stablecoin/images/token-pair-setting.svg rootClassName=w-14） */}
            <div className="flex w-14 shrink-0 items-center justify-center">
              <img
                src="/stablecoin/images/token-pair-setting.svg"
                alt=""
                className="h-14 w-14"
              />
            </div>
            <div className="w-[45%] rounded-md bg-card p-4 shadow-md">
              <CustomInformation detailsInfo={rightSections} />
            </div>
          </div>
        </TabsContent>

        {/* Tab2 操作记录表 */}
        <TabsContent value="records" className="space-y-4 pt-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-4 border-b px-6 py-3">
              <div className="w-56">
                <label
                  htmlFor="token-pair-recordType"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('cross_chain_0032')}
                </label>
                <Select
                  value={recordFilter.recordType}
                  onValueChange={(v) => {
                    setRecordFilter({ recordType: v });
                    setRecordPagination((p) => ({ ...p, pageNum: 1 }));
                  }}
                >
                  <SelectTrigger id="token-pair-recordType">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    {recordTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4">
              <DataTable
                columns={recordColumns}
                data={recordRows}
                isLoading={recordLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: recordPagination.pageNum,
                  pageSize: recordPagination.pageSize,
                  total: recordTotal,
                  onPageChange: (p) =>
                    setRecordPagination((prev) => ({ ...prev, pageNum: p })),
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
 * token 名称 + 区块链色块 + 货币符号-pegged（CustomInformation 的 value 单元）。
 *
 * 迁移自源码 view.tsx getDetailInfo 的 cross_chain_0044 字段 value 渲染：
 *   <div><span>{tokenName}</span><span style={色块}>{shortName}</span></div>
 *   <div className="text-xs">{symbol}-{cross_chain_00104}</div>
 */
function TokenDirectionCell({
  tokenName,
  blockchainShortName,
  currencySymbol,
  color,
}: {
  tokenName?: string;
  blockchainShortName?: string;
  currencySymbol?: string;
  color?: string;
}): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  return (
    <>
      <div>
        <span>{tokenName}</span>
        {blockchainShortName ? (
          <span
            className="ml-2 rounded-sm px-1 text-xs text-white"
            style={{ background: color || 'transparent' }}
          >
            {blockchainShortName}
          </span>
        ) : null}
      </div>
      <div className="text-xs">{`${currencySymbol ?? ''}-${t(
        'cross_chain_00104',
      )}`}</div>
    </>
  );
}

/**
 * antd 色名 → Tailwind badge class（与 cross-chain-status-badge TONE_CLASS 同源）。
 *
 * 操作记录 status 的配色由 i18n key `approval_task_status_color_${status}` 返回
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
 * 操作记录 status Tag（i18n 动态色名 + 文案 common_task_status_${status}）。
 *
 * 源码 view.tsx：
 *   <Tag color={t(`approval_task_status_color_${status}`)}>
 *     {t(`common_task_status_${status}`)}
 *   </Tag>
 * common 命名空间。
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

/**
 * reSet 的本地等价（迁移自源 libs/utils/index.ts:46 `reSet(value, len=2)`）。
 *
 * crossChainFee 为字符串金额，沿用源码 Number(value).toFixed(2).千分位 行为。
 */
function reSet(value: number | string | undefined | null): string {
  if (value == null || value === '') return EMPTY_DISPLAY;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return EMPTY_DISPLAY;
  return num.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}
