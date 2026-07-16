'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import {
  useReserveAssetDetailQuery,
  type ReserveAssetDetail,
  type AssetCategory,
} from '@myorg/modules/pledge/data-access';
import { formatCurrency } from '@myorg/modules/pledge/util';
import { ViewAssetTransactions } from './view-asset-transactions';
import { ViewBasic } from './view-basic';
import { ViewOperationRecords } from './view-operation-records';

/**
 * ReserveAssetDetailPage — 储备资产详情页（new-view，3 Tabs 容器）。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/new-view.tsx（256 行）。
 *
 * **唯一实际接口**：`reserve/asset/detail`（`useReserveAssetDetailQuery`）。
 * 源 new-view.tsx 的 `reserveDetailAccountApi`（accountOverview）调用已被整段注释——
 * accountName/currency/balance/tokenCount/categorieList/tokenList 全部取自 detail 返回。
 * view.tsx（死代码）独占的 manage/list、manage/detail、accountOverview、tokensOverview **不调用**。
 *
 * 路由：列表页 Details/Popconfirm/asset-ategory 提交后均跳
 * `/pledge/reserve-asset-list/view?id=<reserveAccountId>`，catch-all 把 slug[0]=view 解析为
 * pageKey=detail，id 走 query string（`useSearchParams`）。
 *
 * Tabs（shadcn 风格 Tabs，对齐 order-detail-page 约定）：
 * - basic：Basic Information（view-basic，pl-7 实现；此处占位，预留 ViewBasicProps）。
 * - assetTransactions：Asset Transactions（ViewAssetTransactions，传 reserveAccountId）。
 * - operationRecords：Operation Records（ViewOperationRecords，传 reserveAccountId）。
 *
 * categorieList → reserveSummaryRows 映射：pl-7 的 view-basic 渲染 Reserve Asset Summary 表 +
 * recharts 饼图（proportion/assetTypeName）所需数据，此处预计算并随 ViewBasicProps 透传。
 */

/**
 * 储备资产汇总行（详情 Basic Information Tab 的 Reserve Asset Summary 表 + 饼图数据源）。
 * 由 detail.categorieList 映射，pl-7 的 view-basic 消费。
 */
export interface ReserveSummaryRow {
  /** 行 key（1-based）。 */
  key: number;
  /** 资产类别名（assetTypeName）。 */
  category: string;
  /** 资产价值（assetBalance + currency 格式化）。 */
  value: string;
  /** 占比（proportion + '%'）。 */
  share: string;
  /** 更新人（updateUser）。 */
  updatedBy: string;
  /** 更新时间戳（updateTime）。 */
  updatedOn: number;
  /** 状态（status）。 */
  status: number;
}

/**
 * Basic Information Tab 组件 Props（pl-7 的 view-basic 实现契约）。
 *
 * 容器预计算所有 basic 展示数据，view-basic 仅负责渲染（3 卡片 + Summary 表 + Tokens Overview +
 * recharts 饼图）。pl-7 实现该组件时须匹配此接口。
 */
export interface ViewBasicProps {
  /** 基本信息（reserveAssetName/currency/createdOn/status/balance/tokenCount/tokenList）。 */
  basicInfo: {
    reserveAssetName: string;
    currency: string;
    createdOn: number;
    status: number;
    balance: number;
    tokenCount: number;
    tokenList: ReserveAssetDetail['tokenList'];
    categorieList: AssetCategory[];
  };
  /** Reserve Asset Summary 表行（由 categorieList 映射）。 */
  reserveSummaryRows: ReserveSummaryRow[];
  /** 总资产价值文案（balance + currency 格式化）。 */
  totalAssetValueText: string;
}

export function ReserveAssetDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.pledge');

  // 列表页跳 /pledge/reserve-asset-list/view?id=<reserveAccountId>：
  // catch-all 路由 slug[0]=view → pageKey=detail，id 走 query string。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const reserveAccountId = React.useMemo(
    () => (idStr !== '' ? Number(idStr) : NaN),
    [idStr],
  );
  const hasId = !Number.isNaN(reserveAccountId) && reserveAccountId > 0;

  // 详情主数据（reserve/asset/detail）。id 缺失时 enabled=false 不发起（queries 层已守卫）。
  const detailResult = useReserveAssetDetailQuery(
    hasId ? reserveAccountId : undefined,
  );
  const detail: ReserveAssetDetail | undefined = detailResult.data;
  const loading = detailResult.isLoading || detailResult.isFetching;

  // 基本信息（源 new-view basicInfo useMemo）。
  const basicInfo = React.useMemo<ViewBasicProps['basicInfo']>(() => {
    if (!detail || Object.keys(detail).length === 0) {
      return {
        reserveAssetName: '--',
        currency: '--',
        createdOn: 0,
        status: 0,
        balance: 0,
        tokenCount: 0,
        tokenList: [],
        categorieList: [],
      };
    }
    return {
      reserveAssetName: detail.accountName ?? '--',
      currency: detail.currency ?? '--',
      createdOn: detail.createTime ?? 0,
      status: detail.status ?? 0,
      balance: detail.balance ?? 0,
      tokenCount: detail.tokenCount ?? 0,
      tokenList: detail.tokenList ?? [],
      categorieList: detail.categorieList ?? [],
    };
  }, [detail]);

  // categorieList → Reserve Asset Summary 汇总行（源 new-view reserveSummaryRows 映射）。
  const reserveSummaryRows = React.useMemo<ReserveSummaryRow[]>(() => {
    const list = detail?.categorieList ?? [];
    const ccy = detail?.currency ?? basicInfo.currency ?? 'HKD';
    return list.map((item, idx) => {
      const amount = Number(item.assetBalance ?? 0);
      return {
        key: idx + 1,
        category: String(item.assetTypeName ?? '--'),
        value: `${formatCurrency(amount, String(item.currency ?? ccy))}`,
        share:
          typeof item.proportion === 'number'
            ? `${item.proportion}%`
            : `${Number(item.proportion ?? 0)}%`,
        updatedBy: String(item.updateUser ?? '--'),
        updatedOn: Number(item.updateTime ?? 0),
        status: Number(item.status ?? 0),
      };
    });
  }, [detail, basicInfo.currency]);

  // 总资产价值文案（balance + currency）。
  const totalAssetValueText = React.useMemo(() => {
    if (!basicInfo.balance) return '0';
    return formatCurrency(Number(basicInfo.balance), basicInfo.currency);
  }, [basicInfo.balance, basicInfo.currency]);

  return (
    <div className="relative">
      {loading ? (
        <div className="absolute right-0 top-0 z-10 text-xs text-muted-foreground">
          {/* 轻量 loading 提示（shared/ui 无 Spin，对齐 cross-chain 用 isLoading 传 DataTable 的约定） */}
        </div>
      ) : null}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
          <TabsTrigger value="assetTransactions">
            {t('tabs.assetTransactions')}
          </TabsTrigger>
          <TabsTrigger value="operationRecords">
            {t('tabs.operationRecords')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <ViewBasic
            basicInfo={basicInfo}
            reserveSummaryRows={reserveSummaryRows}
            totalAssetValueText={totalAssetValueText}
          />
        </TabsContent>

        <TabsContent value="assetTransactions" className="mt-4">
          {hasId ? (
            <ViewAssetTransactions reserveAccountId={reserveAccountId} />
          ) : (
            <div className="text-sm text-muted-foreground">{t('empty')}</div>
          )}
        </TabsContent>

        <TabsContent value="operationRecords" className="mt-4">
          {hasId ? (
            <ViewOperationRecords reserveAccountId={reserveAccountId} />
          ) : (
            <div className="text-sm text-muted-foreground">{t('empty')}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReserveAssetDetailPage;
