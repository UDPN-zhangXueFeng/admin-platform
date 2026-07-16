'use client';

/**
 * ViewBasic — 详情页 Basic Information Tab 组件。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/view-basic.tsx（409 行）。
 *
 * 组成：
 * 1. Reserve Asset Overview（3 卡片）：基本信息 + 总资产价值（含饼图）+ Tokens 数。
 * 2. Reserve Asset Summary 表（reserveSummaryRows：category/value/share/status/updatedBy/updatedOn）。
 * 3. Tokens Overview（tokenList）：>1 走水平滚动卡片轮播（替代源 antd Carousel，
 *    目标项目无 antd / 无 Carousel 组件），==1 单组卡片。
 *
 * 接口契约（reserve-asset-detail-page.tsx 的 ViewBasicProps）：容器预计算 basicInfo
 * / reserveSummaryRows / totalAssetValueText，本组件仅负责渲染。
 *
 * 关键迁移点：
 * - echarts 饼图 → recharts（`@myorg/modules/pledge/ui` 的 PledgeAssetCategoryPieChart）。
 *   数据源：basicInfo.categorieList → `{ value: proportion||0, name: assetTypeName||\`Category ${i+1}\` }`。
 * - status Tag → PledgeStatusBadge（基本信息卡 variant=reserve；Summary 表 variant=categoryActive
 *   二态 0/1，对齐源码 `['Inactive','Active'][s]`）。
 * - tokenType → i18n `tokenType.${tokenType}`（1=Stablecoin，5=Tokenized Deposit）。
 * - antd Carousel → 水平滚动 snap 卡片（目标项目无 antd；tokenList 通常很少）。
 * - antd Table（静态分页 pageSize=5）→ DataTable（@myorg/shared/ui）。
 * - formatTimestamp → @myorg/shared/util-dates formatDate。
 *
 * i18n namespace: `modules.pledge`，相对 key（无 'pledge.' 前缀）。
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  PledgeAssetCategoryPieChart,
  PledgeStatusBadge,
  type AssetCategoryPieDatum,
} from '@myorg/modules/pledge/ui';
import type { ReserveAssetDetail } from '@myorg/modules/pledge/data-access';
import type { ViewBasicProps } from './reserve-asset-detail-page';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const EMPTY_DISPLAY = '--';
const SUMMARY_PAGE_SIZE = 5;

/**
 * Summary 表行（DataTable 契约要求 id: string）。
 * 容器 reserveSummaryRows 用 `key: number`，view-basic 本地映射补 `id`，
 * 不改 detail-page 的 ViewBasicProps / ReserveSummaryRow 接口。
 */
type SummaryRow = ViewBasicProps['reserveSummaryRows'][number] & { id: string };

/** 数值格式化：保留两位小数 + 千分位（源 view-basic formatNumber）。 */
function formatNumber(n?: number | string | null): string {
  if (n === undefined || n === null) return EMPTY_DISPLAY;
  const num = typeof n === 'string' ? Number(n) : n;
  if (num === undefined || num === null || Number.isNaN(num)) {
    return EMPTY_DISPLAY;
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Token 概览行类型（data-access TokenOverview 的本地别名，便于列引用）。 */
type TokenInfo = NonNullable<ReserveAssetDetail['tokenList']>[number];

/**
 * Token Price 格式化：`1 <symbol> = <price> <currencySymbol>`（源 formatTokenPrice）。
 * symbol / currencySymbol / price 任一缺失返回 '--'。
 */
function formatTokenPrice(token: TokenInfo, t: (k: string) => string): string {
  const sym = token?.symbol || '';
  const curr = token?.currencySymbol || '';
  const priceText = formatNumber(token?.tokenPrice);
  if (!sym || !curr || priceText === EMPTY_DISPLAY) return EMPTY_DISPLAY;
  void t; // tokenType 文案由调用处渲染；此处仅价格
  return `1 ${sym} = ${priceText} ${curr}`;
}

/**
 * ViewBasic —— Basic Information Tab。
 *
 * 接收容器预计算的 ViewBasicProps（basicInfo / reserveSummaryRows /
 * totalAssetValueText）。basicInfo 为空对象（容器 loading 兜底）时各字段已是 '--'，
 * 直接渲染即可（源码 `if (!basicInfo) return Loading` 的分支由容器保证 basicInfo 恒存在）。
 */
export function ViewBasic({
  basicInfo,
  reserveSummaryRows,
  totalAssetValueText,
}: ViewBasicProps): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();

  // 饼图数据（源 chartData useMemo）：categorieList → { value, name }
  const pieData = React.useMemo<AssetCategoryPieDatum[]>(() => {
    const list = basicInfo.categorieList ?? [];
    return list.map((item, index) => ({
      value: Number(item.proportion ?? 0) || 0,
      name: String(item.assetTypeName ?? `Category ${index + 1}`),
    }));
  }, [basicInfo.categorieList]);

  // 创建时间格式化（源 createdOnText useMemo）
  const createdOnText = React.useMemo(() => {
    if (!basicInfo.createdOn) return EMPTY_DISPLAY;
    return formatDate(basicInfo.createdOn, DATETIME_FMT);
  }, [basicInfo.createdOn]);

  // Summary 表列定义（源 reserveSummaryColumns）
  const summaryColumns = React.useMemo<ColumnDef<SummaryRow>[]>(
    () => [
      {
        accessorKey: 'category',
        header: t('viewBasic.summaryCategory'),
        cell: ({ row }) => (
          <span>{row.original.category || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'value',
        header: t('viewBasic.summaryValue'),
        cell: ({ row }) => <span>{row.original.value}</span>,
      },
      {
        accessorKey: 'share',
        header: t('viewBasic.summaryShare'),
        cell: ({ row }) => <span>{row.original.share}</span>,
      },
      {
        accessorKey: 'updatedBy',
        header: t('viewBasic.summaryUpdatedBy'),
        cell: ({ row }) => (
          <span>{row.original.updatedBy || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'updatedOn',
        header: t('viewBasic.summaryUpdatedOn'),
        cell: ({ row }) => (
          <span>
            {row.original.updatedOn
              ? formatDate(row.original.updatedOn, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        // Summary 表 status 二态 0/1（源 `['Inactive','Active'][s]`）→ categoryActive variant
        accessorKey: 'status',
        header: t('viewBasic.summaryStatus'),
        cell: ({ row }) => (
          <PledgeStatusBadge
            variant="categoryActive"
            status={row.original.status}
          />
        ),
      },
    ],
    [t],
  );

  // Tokens Overview 列表
  const tokenList = basicInfo.tokenList ?? [];

  // Summary 表前端分页（源 antd Table `pagination={{ pageSize: 5 }}` 自动切片；
  // DataTable 为 manualPagination，需调用方自行切片当前页数据）。
  // 同时补 id（DataTable 契约要求 { id: string }，源行用 key: number）。
  const [summaryPage, setSummaryPage] = React.useState(1);
  const summaryTotal = reserveSummaryRows.length;
  const summaryPageRows = React.useMemo<SummaryRow[]>(
    () =>
      reserveSummaryRows
        .slice(
          (summaryPage - 1) * SUMMARY_PAGE_SIZE,
          summaryPage * SUMMARY_PAGE_SIZE,
        )
        .map((row) => ({ ...row, id: String(row.key) })),
    [reserveSummaryRows, summaryPage],
  );

  return (
    <div className="space-y-6">
      {/* 1. Reserve Asset Overview（3 卡片） */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold">
          {t('viewBasic.overviewTitle')}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 基本信息卡片 */}
          <div className="rounded-lg border bg-card p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {t('viewBasic.reserveAssetName')}
                </dt>
                <dd className="font-medium">
                  {basicInfo.reserveAssetName || EMPTY_DISPLAY}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {t('viewBasic.currency')}
                </dt>
                <dd className="font-medium">{basicInfo.currency || EMPTY_DISPLAY}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {t('viewBasic.createdOn')}
                </dt>
                <dd className="font-medium">{createdOnText}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('viewBasic.status')}</dt>
                <dd>
                  <PledgeStatusBadge
                    variant="reserve"
                    status={basicInfo.status}
                  />
                </dd>
              </div>
            </dl>
          </div>

          {/* 总资产价值卡片（含饼图） */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex h-full items-center">
              <div className="flex-1">
                <div className="mb-3 flex items-center">
                  <div className="mr-2 flex h-8 w-8 items-center justify-center rounded bg-blue-500">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="font-medium text-muted-foreground">
                    {t('viewBasic.totalAssetValue')}
                  </span>
                </div>
                <div className="ml-10 text-2xl font-bold">
                  {totalAssetValueText}
                </div>
              </div>
              {/* 饼图：recharts（替代 echarts）。父容器固定宽度 w-40 */}
              <div className="ml-4 w-40">
                <PledgeAssetCategoryPieChart data={pieData} />
              </div>
            </div>
          </div>

          {/* Tokens 数卡片 */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex h-full items-center">
              <div className="flex-1">
                <div className="mb-3 flex items-center">
                  <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <span className="font-medium text-muted-foreground">
                    {t('viewBasic.tokens')}
                  </span>
                </div>
                <div className="ml-10 text-2xl font-bold">
                  {basicInfo.tokenCount ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Reserve Asset Summary 表 */}
      <section>
        <h3 className="mb-2 text-base font-semibold">
          {t('viewBasic.summaryTitle')}
        </h3>
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-4">
            <DataTable
              columns={summaryColumns}
              data={summaryPageRows}
              emptyMessage={t('empty')}
              pagination={{
                page: summaryPage,
                pageSize: SUMMARY_PAGE_SIZE,
                total: summaryTotal,
                onPageChange: (p) => setSummaryPage(p),
              }}
            />
          </div>
        </div>
      </section>

      {/* 3. Tokens Overview（tokenList 存在时显示） */}
      {tokenList.length > 0 ? (
        <section className="rounded-lg border bg-[#f3f0ff] p-6">
          <h3 className="mb-4 text-base font-semibold">
            {t('viewBasic.tokensOverview')}
          </h3>
          {/*
           * 源码：tokenList>1 走 antd Carousel，==1 单卡。
           * 目标项目无 antd / 无 Carousel：改用水平滚动 + snap 卡片容器
           * （语义最接近轮播，token 数通常很少）。无 token 时不渲染本区块。
           */}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {tokenList.map((token, idx) => (
              <div
                key={`${token.symbol ?? ''}-${idx}`}
                className="min-w-full snap-start"
              >
                <TokenRow token={token} t={t} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 返回按钮（源 view-basic 末尾 Go Back） */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('viewBasic.goBack')}
        </Button>
      </div>
    </div>
  );
}

/**
 * 渲染单个 Token 的两列卡片（左 Token Details，右 In Circulation）。
 * 迁移源 view-basic renderTokenRow。
 */
function TokenRow({
  token,
  t,
}: {
  token: TokenInfo;
  t: (k: string) => string;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Token Details 卡片 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center">
          <div className="mr-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500">
            <span className="text-lg font-bold text-white">
              {token.symbol || '—'}
            </span>
          </div>
          <dl className="flex-1 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('viewBasic.tokenName')}</dt>
              <dd className="font-medium">{token.tokenName || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('viewBasic.tokenType')}</dt>
              <dd className="font-medium">
                {token.tokenType ? t(`tokenType.${token.tokenType}`) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('viewBasic.tokenPrice')}</dt>
              <dd className="font-medium">{formatTokenPrice(token, t)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('viewBasic.blockchain')}</dt>
              <dd className="font-medium">{token.blockchain || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* In Circulation 卡片 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mt-4 flex items-center justify-center">
          <div>
            <div className="mb-4 text-base font-medium text-muted-foreground">
              {t('viewBasic.inCirculation')}
            </div>
            <div className="ml-2 text-2xl font-bold">
              {formatNumber(token.inCirculation)} {token.symbol || ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewBasic;
