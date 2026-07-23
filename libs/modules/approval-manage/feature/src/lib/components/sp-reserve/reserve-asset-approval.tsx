'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  type ApprovalDetailSection,
  ApprovalStatusBadge,
  type ApprovalComponentProps,
} from '@myorg/modules/approval-manage/ui';
import {
  EMPTY_FIELD_VALUE,
  OPERATE_TYPE_MAP,
  formatTimestamp,
} from '@myorg/modules/approval-manage/util';

/**
 * ReserveAssetApproval — 储备资产审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/reserve-asset.tsx`，106 行）。
 *
 * 5 个 busCode 命中（util BUS_CODE_MAP）：save_reserve_asset /
 * save_reserve_asset_category / update_reserve_asset /
 * activate_reserve_asset / deactivate_reserve_asset。
 *
 * **特殊 props**：`opType` 来自 URL `?opType=`（非 busCode 派生！），与其它族
 * 「type 由 busCode 派生」不同（见 util BUS_CODE_MAP reserveAsset note）。
 * 组件目前展示的「Operation Type」文案由 `detailInfo.operateType` 经
 * OPERATE_TYPE_MAP 映射（源 operateTypeLabel），opType 仅作预留（源亦未直接消费，
 * 仅声明在 props）。
 *
 * **Edit 新旧类别**：operateType===2（Edit）时，资产类别区块标题加「(Update)」，
 * 并额外展示「Asset Categories (Original)」原始类别（源 isEditOperation 分支）。
 *
 * **字段类型**：detailInfo = approvedDetail.businessContent（宽松 Record，源 GlobalAny）。
 * 资产业务字段类型复用 pledge 模块语义，此处不重建实体类型（迁移文档 §0 复用策略）。
 */
export function ReserveAssetApproval({
  detailInfo,
  opType,
}: ApprovalComponentProps) {
  const t = useTranslations('modules.approval-manage');
  const d = (detailInfo ?? {}) as Record<string, any>;

  // 操作类型展示文案（源 operateTypeLabel）
  const operateTypeLabel = React.useMemo(() => {
    const key = Number(d.operateType);
    return OPERATE_TYPE_MAP[key] ?? (d.operateType != null ? String(d.operateType) : EMPTY_FIELD_VALUE);
  }, [d.operateType]);

  // Edit 操作：operateType===2（源 isEditOperation）
  const isEditOperation = Number(d.operateType) === 2;

  // opType 仅声明，源未消费（保留以对齐 props 契约，避免 unused 告警时引用一次）。
  void opType;

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    return [
      {
        list: [
          {
            label: t('reserveAsset.operationType'),
            value: operateTypeLabel,
          },
        ],
      },
      {
        title: t('reserveAsset.informationTitle'),
        list: [
          { label: t('reserveAsset.assetName'), value: d.assetName },
          { label: t('reserveAsset.currency'), value: d.currency },
          {
            label: `${t('reserveAsset.assetCategories')}${
              isEditOperation ? ` ${t('reserveAsset.updateSuffix')}` : ''
            }`,
            value: d.assetCategorys,
          },
          ...(isEditOperation
            ? [
                {
                  label: t('reserveAsset.assetCategoriesOriginal'),
                  value: d.originalAssetCategorys,
                },
              ]
            : []),
          { label: t('reserveAsset.createdBy'), value: d.createUser },
          {
            label: t('reserveAsset.createdOn'),
            value: formatTimestamp(toNumber(d.createTime)),
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={toNumber(d.status)} />,
          },
        ],
      },
    ];
  }, [operateTypeLabel, isEditOperation, d, t]);

  return <ApprovalDetailGrid sections={sections} />;
}

/** 安全 number 化（兼容字符串数字）。 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
