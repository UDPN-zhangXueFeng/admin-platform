'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { X } from 'lucide-react';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
  CustomInformation,
  type CustomInformationItem,
  type CustomInformationSection,
} from '@myorg/modules/cross-chain/ui';
import {
  useRdBridgeDetailQuery,
  useRdBridgeRecordDetailQuery,
  useRdBridgeRecordListQuery,
  type RdBridgeRecordDetail,
  type RdBridgeRecordItem,
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
 * reSet 的本地等价（迁移自源 libs/utils/index.ts:46 `reSet(value, len=2)`）。
 *
 * 源签名 value:any → value>=0 时 Number(value).toFixed(2).replace(千分位)，
 * 否则 '--'。verifierMonitorValue / submitterMonitorValue 为字符串金额，沿用原行为。
 *
 * 与 mmf 模块的本地 reSet（数字入参）同款语义；本页金额入参为字符串，故用本页局部实现
 * 而非跨模块复用（避免引入 cross-chain → mmf 跨模块依赖）。
 */
function reSet(value: number | string | undefined | null): string {
  if (value == null || value === '') return EMPTY_DISPLAY;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return EMPTY_DISPLAY;
  return num.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

/**
 * antd 色名 → Tailwind badge class（与 cross-chain-status-badge 的 TONE_CLASS 同源）。
 *
 * 操作记录 status 的配色由 i18n key `cross_chain_operation_status_color_${status}` 返回
 * antd 色名（processing/success/error/gray），此处做静态映射；未知色名回落 gray。
 */
const OP_TONE_CLASS: Record<string, string> = {
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

/** 操作记录 status Tag（i18n 动态色名 + 文案 cross_chain_operation_status_${status}）。 */
function OpRecordStatusBadge({ status }: { status?: number }): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  if (status == null) {
    return <span className="text-sm text-muted-foreground">{EMPTY_DISPLAY}</span>;
  }
  const tone = t(`cross_chain_operation_status_color_${status}`);
  const label = t(`cross_chain_operation_status_${status}`);
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
 * 详情页基本信息描述项（label + value 键值对，跨模块复用本地实现避免依赖 mmf ui）。
 */
interface DetailItem {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
}

/**
 * 渲染一组带标题的 key-value 描述卡片（bordered Descriptions 风格）。
 *
 * 视觉对齐 mmf-basic-details：Card 容器 + 标题栏（border-b）+ 3 列网格（label 窄列 muted 背景 / value 白底）。
 * 不耦合具体业务字段，调用方构造 items（已格式化的 ReactNode）。
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
 * RdBridgeDetailPage — RD-Bridge 跨链桥配置详情页。
 *
 * 迁移自 td-manage src/pages/cross-chain/rd-bridge/view.tsx（447 行）。
 * useSWR → TanStack Query（useRdBridgeDetailQuery / useRdBridgeRecordListQuery /
 * useRdBridgeRecordDetailQuery）。
 *
 * 结构：
 *   - 2 个 Tabs（Tab1 基本信息 3 组 Descriptions / Tab2 操作记录表 + Drawer 详情）。
 *   - Tab1：items（基础 4 字段）+ items1（合约地址 4 字段 copyable）+ items2（监控配置 5 字段
 *     含 verifier/submitter 钱包地址 copyable + 余额色块 + reSet 格式化金额 + notifyEmail）。
 *   - Tab2：recordType 筛选（1/2/3/4）+ DataTable（recordType / createUserName / createTime /
 *     comments / status 走 cross_chain_operation_status_color_${status}），行「查看」→
 *     getCrossChainRecordDetail → Drawer（CustomInformation 展示 4 组信息）。
 *   - 底部「返回」按钮。
 *
 * 硬约束（cc-10 summary + 迁移文档第 7.15 节）：
 * - crossChainId 从 query string 取（列表跳 `/cross-chain/rd-bridge/view?id=`）。
 * - 调 getCrossChainDetail（基本信息）+ getCrossChainRecordList（操作记录分页）+
 *   getCrossChainRecordDetail（Drawer 详情）。
 * - 监控配置金额用 reSet 格式化 + ' ' + gasUnit；钱包地址带余额色块（bg-theme 白字）。
 * - 操作记录 status 走 i18n 动态色名（cross_chain_operation_status_color_${status}），
 *   非静态映射（与列表 RD_BRIDGE_STATUS_COLOR 不同体系）。
 * - 操作记录行「查看」复用 OP_RECORD_VIEW_BTN 权限码（与 lp/tp 详情共用）。
 */
export function RdBridgeDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/rd-bridge/view?id=<id>：
  // catch-all 路由把 slug[0]="view" 解析为 pageKey="detail"，id 走 query string。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const crossChainId = idStr !== '' ? Number(idStr) : undefined;
  const hasId = crossChainId != null && !Number.isNaN(crossChainId);

  const detailResult = useRdBridgeDetailQuery(crossChainId, hasId);
  const detail = detailResult.data;

  // ── 操作记录子表 ──
  const [recordFilter, setRecordFilter] = React.useState<{ recordType: string }>(
    { recordType: ALL_VALUE },
  );
  const [recordPagination, setRecordPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const recordParams = React.useMemo(() => {
    if (!hasId) return undefined;
    return {
      crossChainId: crossChainId as number,
      pageNum: recordPagination.pageNum,
      pageSize: recordPagination.pageSize,
      recordType: recordFilter.recordType !== ALL_VALUE
        ? Number(recordFilter.recordType)
        : undefined,
    };
  }, [
    hasId,
    crossChainId,
    recordPagination.pageNum,
    recordPagination.pageSize,
    recordFilter.recordType,
  ]);
  const recordList = useRdBridgeRecordListQuery(recordParams, hasId);
  const recordRows = recordList.data?.rows ?? [];
  const recordTotal = recordList.data?.page?.total ?? 0;
  const recordLoading = recordList.isLoading || recordList.isFetching;

  const recordTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...([1, 2, 3, 4] as const).map((el) => ({
        value: String(el),
        label: t(`cross_chain_operation_type_${el}`),
      })),
    ],
    [t],
  );

  // ── Drawer 详情 ──
  const [drawerRecordId, setDrawerRecordId] = React.useState<
    number | undefined
  >(undefined);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const recordDetailResult = useRdBridgeRecordDetailQuery(
    drawerRecordId,
    drawerRecordId != null,
  );
  const recordDetail = recordDetailResult.data;

  const onViewRecord = React.useCallback((crossChainRecordId: number) => {
    setDrawerRecordId(crossChainRecordId);
    setDrawerOpen(true);
  }, []);

  // ── Tab1 基本信息 3 组 Descriptions ──
  // items：基础信息 4 字段（源码 span:2 即单列纵向，此处键值表逐行）。
  const basicItems: DetailItem[] = React.useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: 'blockchainName',
        label: t('cross_chain_0000'),
        value: <span>{detail.blockchainName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'status',
        label: t('filter.status'),
        // 复用列表 RD_BRIDGE_STATUS_COLOR 体系（cross_chain_status_${status}）。
        value: (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
              detail.status === 35
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-gray-200 bg-gray-50 text-gray-600'
            }`}
          >
            {t(`cross_chain_status_${detail.status ?? ''}`)}
          </span>
        ),
      },
      {
        key: 'updateUserName',
        label: t('field.updateBy'),
        value: <span>{detail.updateUserName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'updateTime',
        label: t('field.updateOn'),
        value: (
          <span>
            {detail.updateTime
              ? formatDate(Number(detail.updateTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
    ];
  }, [detail, t]);

  // items1：合约地址 4 字段（3 个地址 copyable）。
  const contractItems: DetailItem[] = React.useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: 'endpointId',
        label: t('cross_chain_0001'),
        value: <span>{detail.endpointId ?? EMPTY_DISPLAY}</span>,
      },
      {
        key: 'endpointContractAddress',
        label: t('cross_chain_0037'),
        value: (
          <CopyableEllipsisText
            value={detail.endpointContractAddress}
            maxWidth={260}
          />
        ),
      },
      {
        key: 'sendContractAddress',
        label: t('cross_chain_0035'),
        value: (
          <CopyableEllipsisText
            value={detail.sendContractAddress}
            maxWidth={260}
          />
        ),
      },
      {
        key: 'receiveContractAddress',
        label: t('cross_chain_0036'),
        value: (
          <CopyableEllipsisText
            value={detail.receiveContractAddress}
            maxWidth={260}
          />
        ),
      },
    ];
  }, [detail, t]);

  // items2：监控配置 5 字段（verifier/submitter 地址 copyable + 余额色块 + reSet 金额 + notifyEmail）。
  const monitorItems: DetailItem[] = React.useMemo(() => {
    if (!detail) return [];
    const gasUnit = detail.gasUnit ?? '';
    return [
      {
        // verifier 钱包地址 copyable + 余额色块（源码 bg-theme text-white）。
        key: 'verifierWalletAddress',
        label: t('cross_chain_0012'),
        value: (
          <div className="flex flex-col">
            <CopyableEllipsisText
              value={detail.verifierWalletAddress}
              maxWidth={260}
            />
            <div>
              <span>{`${t('cross_chain_0047')}:`}</span>
              <span className="ml-2 rounded-md bg-primary px-2 text-white">
                {`${detail.verifierWalletAddressBalance ?? '--'} ${gasUnit}`}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'verifierMonitorValue',
        label: t('cross_chain_0013'),
        value: <span>{`${reSet(detail.verifierMonitorValue)} ${gasUnit}`}</span>,
      },
      {
        key: 'submitterWalletAddress',
        label: t('cross_chain_0014'),
        value: (
          <div className="flex flex-col">
            <CopyableEllipsisText
              value={detail.submitterWalletAddress}
              maxWidth={260}
            />
            <div>
              <span>{`${t('cross_chain_0047')}:`}</span>
              <span className="ml-2 rounded-md bg-primary px-2 text-white">
                {`${detail.submitterWalletAddressBalance ?? '--'} ${gasUnit}`}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'submitterMonitorValue',
        label: t('cross_chain_0015'),
        value: (
          <span>{`${reSet(detail.submitterMonitorValue)} ${gasUnit}`}</span>
        ),
      },
      {
        key: 'notifyEmail',
        label: t('cross_chain_0016'),
        value: <span>{detail.notifyEmail || EMPTY_DISPLAY}</span>,
      },
    ];
  }, [detail, t]);

  // ── Drawer 详情 4 组信息（源码 getDetailInfo useMemo）──
  const drawerSections: CustomInformationSection[] = React.useMemo(() => {
    const d = (recordDetail ?? {}) as Partial<RdBridgeRecordDetail>;
    const gasUnit = d.gasUnit ?? '';
    return [
      {
        // 第一组无标题：操作类型 / 创建人 / 创建时间。
        list: [
          {
            label: t('cross_chain_0032'),
            value: t(`cross_chain_operation_type_${d.recordType ?? ''}`),
          },
          { label: t('field.createdBy'), value: d.createUserName },
          {
            label: t('field.createdTime'),
            value:
              d.createTime != null
                ? formatDate(Number(d.createTime), DATETIME_FMT)
                : EMPTY_DISPLAY,
          },
        ],
      },
      {
        title: t('cross_chain_0020'),
        list: [
          { label: t('cross_chain_0000'), value: d.blockchainName },
        ],
      },
      {
        title: t('cross_chain_0043'),
        list: [
          {
            label: t('cross_chain_0037'),
            value: (
              <CopyableEllipsisText
                value={d.endpointContractAddress}
                maxWidth={260}
              />
            ),
          },
          {
            label: t('cross_chain_0035'),
            value: (
              <CopyableEllipsisText
                value={d.sendContractAddress}
                maxWidth={260}
              />
            ),
          },
          {
            label: t('cross_chain_0036'),
            value: (
              <CopyableEllipsisText
                value={d.receiveContractAddress}
                maxWidth={260}
              />
            ),
          },
        ],
      },
      {
        title: t('cross_chain_0038'),
        list: [
          {
            label: t('cross_chain_0012'),
            value: d.submitterWalletAddress ? (
              <CopyableEllipsisText
                value={d.submitterWalletAddress}
                maxWidth={260}
              />
            ) : (
              EMPTY_DISPLAY
            ),
          },
          {
            label: t('cross_chain_0013'),
            value: `${reSet(d.verifierMonitorValue)} ${gasUnit}`,
          },
          {
            label: t('cross_chain_0014'),
            value: d.submitterWalletAddress ? (
              <CopyableEllipsisText
                value={d.submitterWalletAddress}
                maxWidth={260}
              />
            ) : (
              EMPTY_DISPLAY
            ),
          },
          {
            label: t('cross_chain_0015'),
            value: `${reSet(d.submitterMonitorValue)} ${gasUnit}`,
          },
          {
            label: t('cross_chain_0016'),
            value: d.notifyEmail || EMPTY_DISPLAY,
          },
        ] satisfies CustomInformationItem[],
      },
    ];
  }, [recordDetail, t]);

  // ── 操作记录表列 ──
  const recordColumns = React.useMemo<ColumnDef<RdBridgeRecordItem>[]>(
    () => [
      {
        accessorKey: 'recordType',
        header: t('cross_chain_0032'),
        cell: ({ row }) => (
          <span>
            {t(`cross_chain_operation_type_${row.original.recordType ?? ''}`)}
          </span>
        ),
      },
      {
        accessorKey: 'createUserName',
        header: t('field.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createUserName || EMPTY_DISPLAY}</span>
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
        accessorKey: 'comments',
        header: t('cross_chain_0030'),
        cell: ({ row }) => (
          <span>{row.original.comments || EMPTY_DISPLAY}</span>
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
                onClick={() => onViewRecord(r.crossChainRecordId ?? 0)}
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, onViewRecord],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">{t('cross_chain_0033')}</TabsTrigger>
          <TabsTrigger value="records">{t('cross_chain_0031')}</TabsTrigger>
        </TabsList>

        {/* Tab1 基本信息：3 组 Descriptions */}
        <TabsContent value="basic" className="space-y-6 pt-4">
          <BasicDetailsGroup title={t('cross_chain_0020')} items={basicItems} />
          <BasicDetailsGroup
            title={t('cross_chain_0029')}
            items={contractItems}
          />
          <BasicDetailsGroup title={t('cross_chain_0038')} items={monitorItems} />
        </TabsContent>

        {/* Tab2 操作记录表 */}
        <TabsContent value="records" className="space-y-4 pt-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-4 border-b px-6 py-3">
              <div className="w-56">
                <label
                  htmlFor="rd-bridge-recordType"
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
                  <SelectTrigger id="rd-bridge-recordType">
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

      {/* ── 操作记录 Drawer 详情 ── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-w-[640px]">
          <DrawerHeader>
            <DrawerTitle>
              <div className="flex items-center justify-between">
                <span>{t('cross_chain_0042')}</span>
                <button
                  type="button"
                  aria-label={t('action.cancel')}
                  onClick={() => setDrawerOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <CustomInformation detailsInfo={drawerSections} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
