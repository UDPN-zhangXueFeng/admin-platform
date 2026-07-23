'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { ArrowRightCircle } from 'lucide-react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import {
  formatTimestamp,
  reSet,
} from '@myorg/modules/approval-manage/util';

/**
 * TokenPairApproval — 跨链代币对审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/token-pair.tsx`，166 行）。
 *
 * busCode: save/update/activate/deactivate_token_pair（无 type，recordType 驱动操作类型展示）。
 * 只读展示：send/receive token + blockchain_code_color 色块 + ArrowRightCircle 箭头布局，
 * 跨链手续费（crossChainFee）新旧差异（recordType===2 且 oldCrossChainFee!==crossChainFee 时显示
 * 「Update from X to Y」），收链交易状态走 taskStatus badge。
 *
 * 字段照源逐一对齐（source token-pair.tsx:22-150）；i18n 收敛到 modules.approval-manage
 * （§14），blockchain_code_color_* 为全局 common 命名空间 key（同 cross-chain 模块 BlockchainCodeChip）。
 *
 * NOTE: detailInfo 为 dispatcher 透传的 businessContent（源 BCMP.ANY），
 * 采用宽松类型 + 组件内防御读取（沿用 dispatcher 的 ApprovalComponentProps.detailInfo 语义，
 * 不重建业务实体类型，见迁移文档 §5 复用策略）。
 */

/** 业务内容（宽松类型；字段名照源 detailInfo?.xxx，逐一对齐）。 */
interface TokenPairBusinessContent {
  recordType?: number;
  sendTokenName?: string;
  sendBlockchainShortName?: string;
  sendTokenCurrencySymbol?: string;
  receiveTokenName?: string;
  receiveBlockchainShortName?: string;
  receiveTokenCurrencySymbol?: string;
  crossChainFee?: string | number;
  oldCrossChainFee?: string | number;
  tokenSymbol?: string;
  createUser?: string;
  createTime?: string | number;
  sendTxHash?: string;
  sendTxTime?: string | number;
  receiveTxHash?: string;
  receiveTxTime?: string | number;
  status?: number;
}

export interface TokenPairApprovalProps {
  /** businessContent（dispatcher 透传）。 */
  detailInfo?: Record<string, unknown>;
}

/**
 * blockchain_code_color 色块（迁移自源 token-pair.tsx:42-71 inline span）。
 * 与 cross-chain 模块 BlockchainCodeChip 同款实现：ml-2 + rounded-sm + 白字 + i18n 色值背景。
 * 无 name 时不渲染（避免空色块）。
 */
function BlockchainCodeChip({
  name,
  color,
}: {
  name?: string;
  color?: string;
}) {
  if (!name) return null;
  return (
    <span
      className="ml-2 rounded-sm px-1 text-xs text-white"
      style={{ background: color || 'transparent' }}
    >
      {name}
    </span>
  );
}

export function TokenPairApproval({ detailInfo }: TokenPairApprovalProps) {
  const t = useTranslations('modules.approval-manage');
  const tCommon = useTranslations('common');

  const d = (detailInfo ?? {}) as TokenPairBusinessContent;

  const sections = useMemo<ApprovalDetailSection[]>(() => {
    // 跨链手续费：recordType===2 且新旧不同 →「Update from X to Y」（源 token-pair.tsx:82-101）。
    const feeUpdated =
      d.recordType === 2 && d.oldCrossChainFee !== d.crossChainFee;
    const feeValue = feeUpdated
      ? `${t('cross_chain_00118')} ${t('cross_chain_00119')} ${reSet(
          d.oldCrossChainFee,
        )} ${d.tokenSymbol ?? ''} ${t('cross_chain_00120')} ${reSet(
          d.crossChainFee,
        )} ${d.tokenSymbol ?? ''} ${t('cross_chain_0090')}`
      : `${reSet(d.crossChainFee)} ${t('cross_chain_0090')}`;

    return [
      {
        list: [
          {
            label: t('cross_chain_0032'),
            value: t(`token_pair_operation_type_${d.recordType}`),
          },
        ],
      },
      {
        title: t('cross_chain_00108'),
        list: [
          {
            label: t('cross_chain_0083'),
            value: (
              <div className="flex items-start">
                <div>
                  <div>
                    <span>{d.sendTokenName}</span>
                    <BlockchainCodeChip
                      name={d.sendBlockchainShortName}
                      color={tCommon(
                        `blockchain_code_color_${d.sendBlockchainShortName ?? ''}`,
                      )}
                    />
                  </div>
                  <div className="text-xs">{`${d.sendTokenCurrencySymbol ?? ''}-${t(
                    'cross_chain_00104',
                  )}`}</div>
                </div>
                <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div>
                    <span>{d.receiveTokenName}</span>
                    <BlockchainCodeChip
                      name={d.receiveBlockchainShortName}
                      color={tCommon(
                        `blockchain_code_color_${d.receiveBlockchainShortName ?? ''}`,
                      )}
                    />
                  </div>
                  <div className="text-xs">{`${d.receiveTokenCurrencySymbol ?? ''}-${t(
                    'cross_chain_00104',
                  )}`}</div>
                </div>
              </div>
            ),
          },
          { label: t('cross_chain_0066'), value: feeValue },
          { label: t('PUB_Creater'), value: d.createUser },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(Number(d.createTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('cross_chain_00109'),
        list: [
          {
            label: t('cross_chain_0060'),
            value: <CopyableEllipsisText value={d.sendTxHash ?? ''} />,
          },
          {
            label: t('cross_chain_0061'),
            value: formatTimestamp(Number(d.sendTxTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('cross_chain_00113'),
        list: [
          {
            label: t('cross_chain_0060'),
            value: <CopyableEllipsisText value={d.receiveTxHash ?? ''} />,
          },
          {
            label: t('cross_chain_0061'),
            value: formatTimestamp(Number(d.receiveTxTime)),
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
  }, [d, t, tCommon]);

  return <ApprovalDetailGrid sections={sections} />;
}

export default TokenPairApproval;
