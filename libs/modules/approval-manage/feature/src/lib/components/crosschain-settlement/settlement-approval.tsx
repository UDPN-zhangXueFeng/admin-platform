'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailSection,
  type ApprovalDetailItem,
} from '@myorg/modules/approval-manage/ui';
import { formatTimestamp } from '@myorg/modules/approval-manage/util';

/**
 * SettlementApproval — MMF settlement（分红分配）审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/settlement.tsx`，124 行）。
 *
 * busCode: apply_mmf_settlement（固定 Create，operationType 文案恒为
 * mmf_settlement_operation_type_1）。
 *
 * 跨 4 namespace 字段（源 useHook 4 namespace）：tokenized-deposit（tokenName）/ wallet-type
 * （section title + fund/wallet/dividend 字段）/ mmf（settlement no + operation type）/ common。
 * 迁移后收敛到 modules.approval-manage（§14）。
 *
 * 字段名特殊点（迁移文档 §8 字段命名不统一）：创建人用 `createBy`（非 createUser/createdBy），
 * 创建时间用 `createTime`（非 createdOn），照源逐一对齐，勿统一。
 *
 * 死代码剔除（§8）：源 import reSet 未使用（行 9-10 eslint-disable 死引入），不迁移；
 * 源行 79-83 注释的 remarks 字段（mmf_0023）不迁移。
 *
 * NOTE: detailInfo 为 dispatcher 透传的 businessContent（源 BCMP.ANY），宽松类型 + 防御读取，
 * 不重建业务实体类型（迁移文档 §5 复用策略）。
 */

/** 业务内容（宽松类型；字段名照源 detailInfo?.xxx，逐一对齐）。 */
interface SettlementBusinessContent {
  settlementCode?: string;
  createTime?: string | number;
  tokenName?: string;
  blockchainName?: string;
  fundName?: string;
  totalUnits?: string | number;
  totalUnitsSymbol?: string;
  totalWallets?: string | number;
  dividendMethod?: string;
  createBy?: string;
  status?: number;
}

export interface SettlementApprovalProps {
  /** businessContent（dispatcher 透传）。 */
  detailInfo?: Record<string, unknown>;
}

export function SettlementApproval({ detailInfo }: SettlementApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const d = (detailInfo ?? {}) as SettlementBusinessContent;

  const sections = useMemo<ApprovalDetailSection[]>(() => {
    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            // 固定 Create（源 settlement.tsx:33，mmf_settlement_operation_type_1）。
            value: t('mmf_settlement_operation_type_1'),
          },
        ],
      },
      {
        title: t('wallet_type_013'),
        list: [
          {
            label: t('mmf_0016'),
            value: (
              <CopyableEllipsisText value={d.settlementCode ?? ''} />
            ),
          },
          {
            label: t('wallet_type_159'),
            value: formatTimestamp(Number(d.createTime), 'date'),
          },
          {
            label: t('tokenized_deposit_0000'),
            value: d.tokenName,
          },
          {
            label: t('PUB_Blockchain'),
            value: d.blockchainName,
          },
          {
            label: t('wallet_type_106'),
            value: d.fundName,
          },
          {
            label: t('wallet_type_165'),
            value: `${d.totalUnits ?? ''} ${d.totalUnitsSymbol ?? ''}`,
          },
          // totalWallets 仅在有值时渲染（源 settlement.tsx:69-74 三元）。
          d.totalWallets
            ? ({
                label: t('wallet_type_129'),
                value: d.totalWallets,
              } as ApprovalDetailItem)
            : ({} as ApprovalDetailItem),
          {
            label: t('wallet_type_132'),
            value: d.dividendMethod,
          },
          {
            label: t('PUB_Creater'),
            value: d.createBy,
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={d.status} />,
            showBorder: true,
          },
        ],
      },
    ];
  }, [d, t]);

  return <ApprovalDetailGrid sections={sections} />;
}

export default SettlementApproval;
