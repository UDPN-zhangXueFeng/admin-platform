'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import {
  EMPTY_FIELD_VALUE,
  anyHasValue,
  formatTimestamp,
} from '@myorg/modules/approval-manage/util';

/**
 * TokenApproval — TD 主单据审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/token.tsx`，268 行）。
 *
 * TD 主单据的 Create / Update / Enable / Disable 四种操作共用此组件，由 `type` 驱动
 * 新旧差异与状态字段来源（busCode→type 派生见 util TOKEN_TYPE）：
 * - type=1（td_new，Onboard）  → 新建，status 取 `applyStatus`，无交易信息段。
 * - type=2（td_edit_all，Edit）→ 编辑，name/symbol 显示新旧差异（Update from X to Y），
 *                                 decimalPrecision 显示旧值，status 取 `operateStatus`。
 * - type=3（td_enable，Enable）/ type=4（td_disable，Disable）→ 编辑态，status 取 `operateStatus`。
 *
 * **状态字段（源 token.tsx:227-243）**：`type===1 ? applyStatus : operateStatus`，
 * 走 ApprovalStatusBadge task 族（源 `common_task_status_${...}` + `approval_task_status_color_*`）。
 *
 * **条件渲染段（源 token.tsx:117-195）**：
 * - COA Setup 段：`bookTemplateName`/`eodCutoffDate`/`timeZone`/`financeBookName` 任一 hasValue。
 * - Key Custody 段：`keyServiceName`/`storageType` 任一 hasValue（段内仅展示 keyServiceName，照源）。
 * - Admin Wallet 段：`adminWalletDTOList` 非空（硬编码 [0]/[1]/[2] 索引，照源 token.tsx:164/177/188）。
 * - Transaction Information 段：仅 `type>1` 渲染（新建无链上交易）。
 *
 * **i18n 命名空间**：源用 `useHook(['tokenized-deposit','approval-manage','cross-chain'])` 三 namespace
 * （cross-chain 用于新旧差异文案 Update/from/to）。目标收敛到 `modules.approval-manage`
 * （cross_chain_00118/00119/00120 词条已补齐）。
 *
 * **字段类型**：detailInfo 为 dispatcher 透传的宽松 `Record<string, unknown>`
 * （=approvedDetail.businessContent），不重建 TD 业务实体类型（文档约束）。
 */

export interface TokenApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，源 detailInfo）。 */
  detailInfo?: Record<string, unknown>;
  /** 操作类型（busCode 派生：1=Onboard/2=Edit/3=Enable/4=Disable）。 */
  type?: number;
}

/** 从宽松 detailInfo 安全读取字符串（未知→undefined）。 */
function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/** 读取展示值：无值→EMPTY_FIELD_VALUE（迁移自源各处 `|| '--'` 兜底）。 */
function display(v: unknown): string {
  const s = str(v);
  return s && s.trim() !== '' ? s : EMPTY_FIELD_VALUE;
}

/**
 * 渲染 TD 主单据审核详情。
 *
 * section 结构 1:1 对照源 token.tsx:42-248。
 */
export function TokenApproval({ detailInfo, type }: TokenApprovalProps) {
  const t = useTranslations('modules.approval-manage');
  const opType = type ?? 0;

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    // ── COA / Key Custody 段条件（源 token.tsx:31-40） ──────────────────────────
    const hasCoaSetup = anyHasValue([
      detailInfo?.bookTemplateName,
      detailInfo?.eodCutoffDate,
      detailInfo?.timeZone,
      detailInfo?.financeBookName,
    ]);
    const hasKeyCustody = anyHasValue([
      detailInfo?.keyServiceName,
      detailInfo?.storageType,
    ]);

    // ── name/symbol 新旧差异（源 token.tsx:56-83） ─────────────────────────────
    // type==2 且新旧不同 → "Update from {old} to {new}"，否则 name||newName。
    const oldName = str(detailInfo?.oldName);
    const newName = str(detailInfo?.newName);
    const nameValue =
      oldName !== newName && opType === 2
        ? `${t('cross_chain_00118')} ${t('cross_chain_00119')} ${oldName ?? ''} ${t(
            'cross_chain_00120'
          )} ${newName ?? ''}`
        : str(detailInfo?.name) ?? newName ?? EMPTY_FIELD_VALUE;

    const oldSymbol = str(detailInfo?.oldSymbol);
    const newSymbol = str(detailInfo?.newSymbol);
    const symbolValue =
      oldSymbol !== newSymbol && opType === 2
        ? `${t('cross_chain_00118')} ${t('cross_chain_00119')} ${oldSymbol ?? ''} ${t(
            'cross_chain_00120'
          )} ${newSymbol ?? ''}`
        : str(detailInfo?.symbol) ?? newSymbol ?? EMPTY_FIELD_VALUE;

    // 价格展示用 symbol（源 token.tsx:94 `symbol || newSymbol`）。
    const priceSymbol = str(detailInfo?.symbol) ?? newSymbol ?? '';
    const priceValue = [
      str(detailInfo?.stablecoinCount) ?? '',
      priceSymbol,
      '=',
      str(detailInfo?.usPrice) ?? '',
      str(detailInfo?.currencySymbol) ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    // ── decimalPrecision（源 token.tsx:101-108） ───────────────────────────────
    // type>=2 且新旧不同 → 显示旧值；否则当前值。
    const oldDecimalPrecision = str(detailInfo?.oldDecimalPrecision);
    const decimalPrecision = str(detailInfo?.decimalPrecision);
    const decimalValue =
      opType >= 2 && oldDecimalPrecision !== decimalPrecision
        ? display(oldDecimalPrecision)
        : display(decimalPrecision);

    // ── Admin Wallet 段（源 token.tsx:152-195，硬编码 [0][1][2]） ───────────────
    const adminWalletList = Array.isArray(detailInfo?.adminWalletDTOList)
      ? (detailInfo?.adminWalletDTOList as Array<{ walletAddress?: unknown }>)
      : [];
    const hasAdminWallet = adminWalletList.length > 0;
    const walletAddress = (i: number): string =>
      str(adminWalletList[i]?.walletAddress) ?? '';

    // ── 状态字段（源 token.tsx:227-243） ───────────────────────────────────────
    const statusRaw =
      opType === 1 ? detailInfo?.applyStatus : detailInfo?.operateStatus;
    const status =
      statusRaw == null ? undefined : Number(statusRaw);

    return [
      // section 1：操作类型
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            value: t(`td_operation_type_edit_${opType}`),
          },
        ],
      },
      // section 2：代币信息
      {
        title: t('tokenized_deposit_0010'),
        list: [
          { label: t('tokenized_deposit_0000'), value: nameValue },
          { label: t('tokenized_deposit_0006'), value: symbolValue },
          {
            label: t('tokenized_deposit_0062'),
            value: t(`token_type_${detailInfo?.mintMethod}`),
          },
          { label: t('tokenized_deposit_0011'), value: priceValue },
          { label: t('tokenized_deposit_0002'), value: decimalValue },
          {
            label: t('tokenized_deposit_0007'),
            value: display(detailInfo?.blockchainName),
            showBorder: true,
          },
        ],
      },
      // section 3：COA Setup（条件）
      hasCoaSetup
        ? {
            title: t('tokenized_deposit_coa_title'),
            list: [
              {
                label: t('tokenized_deposit_coa_financial_book_name'),
                value: display(detailInfo?.financeBookName),
              },
              {
                label: t('tokenized_deposit_coa_account_template'),
                value: display(detailInfo?.bookTemplateName),
              },
              {
                label: t('tokenized_deposit_coa_eod_cutoff'),
                value: display(detailInfo?.eodCutoffDate),
              },
              {
                label: t('tokenized_deposit_coa_time_zone'),
                value: display(detailInfo?.timeZone),
                showBorder: true,
              },
            ],
          }
        : { list: [] },
      // section 4：Key Custody（条件，段内仅展示 keyServiceName）
      hasKeyCustody
        ? {
            title: t('tokenized_deposit_key_custody_title'),
            list: [
              {
                label: t('tokenized_deposit_key_service_name'),
                value: display(detailInfo?.keyServiceName),
              },
            ],
          }
        : { list: [] },
      // section 5：Admin Wallet（条件，硬编码 [0][1][2]）
      hasAdminWallet
        ? {
            title: t('tokenized_deposit_0115'),
            list: [
              {
                label: t('tokenized_deposit_0112'),
                value: <CopyableEllipsisText value={walletAddress(0)} />,
              },
              {
                label: t('tokenized_deposit_0113'),
                value: <CopyableEllipsisText value={walletAddress(1)} />,
              },
              {
                label: t('tokenized_deposit_0114'),
                value: <CopyableEllipsisText value={walletAddress(2)} />,
                showBorder: true,
              },
            ],
          }
        : { list: [] },
      // section 6：创建信息
      {
        list: [
          { label: t('PUB_Creater'), value: display(detailInfo?.createUserName) },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(Number(detailInfo?.createTime)),
            showBorder: true,
          },
        ],
      },
      // section 7：交易信息（仅 type>1）
      opType > 1
        ? {
            title: t('tokenized_deposit_0095'),
            list: [
              {
                label: t('tokenized_deposit_0089'),
                value: display(detailInfo?.txHash),
              },
              {
                label: t('tokenized_deposit_0086'),
                value: formatTimestamp(Number(detailInfo?.txTime)),
                showBorder: true,
              },
            ],
          }
        : { list: [] },
      // section 8：状态（type===1?applyStatus:operateStatus）
      {
        list: [
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={status} />,
            showBorder: true,
          },
        ],
      },
    ];
  }, [detailInfo, opType, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
