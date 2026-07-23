'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailItem,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import {
  formatTimestamp,
  INFINITY_AMOUNT,
  reSet,
} from '@myorg/modules/approval-manage/util';

/**
 * WalletTypeApproval — 钱包类型 Create/Update + MMF 分支审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/walletType.tsx`，622 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent）+ 可选 `type`。
 * td_add/edit/enable/disable_wallet_type（type=1/2/3/4）触发。
 *
 * 迁移要点（§7 步骤 7 / §8）：
 * - **MMF 分支 issueType===20**：MMF 钱包类型走 `getMMFDetailInfo`（独立结构），
 *   其余走 `getDetailInfo`。源 walletType.tsx:601-607 按 issueType 切换。
 * - **type===2（edit）新旧限额并列**：Create 单区块；Update 渲染「新」(approval_manage_0038)
 *   +「旧」(approval_manage_0039) 两套限额区块（maxTxCountPer/Daily/stablecoinCount/
 *   minimumBalance/maximumRedeemLimit + oldXxx 对称）。
 * - **透支/利率三区块条件渲染**（仅 issueType===5 && accountType===1 && interestFeatureEnablement===2）：
 *   arranged overdraft / unarranged overdraft / receiving wallet。
 *   accountType===2 渲染 deposit interest 区块（arrangedCalculateType===1 单利率，否则阶梯利率遍历）。
 * - **阶梯利率遍历**：arrangedAnnualInterestRates 数组每项 minValue-maxValue + interestRate%（源 :412-425）。
 * - **∞ 魔数**：源 `Number(value) >= 99999999999 ? '∞' : reSet(value)`，
 *   迁移用 util `INFINITY_AMOUNT`（99999999999）替代魔数。
 * - **剔除死代码**（§8）：源 walletType.tsx:290-304 注释的 arrangedOverdraftFee 区块不迁移。
 * - **interestRate 来源**：arrangedAnnualInterestRates[0]?.interestRate（源 :28-30），
 *   后续 `interestRate.indexOf('-')` 判断负利率分支（源 :439/448）——故 interestRate 视为字符串。
 * - **Paragraph copyable → CopyableEllipsisText**。
 * - **status 取 `state` 字段**（§6.2 note），badge family='task'。
 *
 * **i18n**：扁平 key，namespace=modules.approval-manage，无双重前缀。
 * wallet_type_task_type_/interest_account_type_/mmf_fund_type_/mmf_risk_level_/
 * maintenance_fee_call_type_/common_task_status_ 动态 key 在 T14 补全。
 */

type DetailInfo = Record<string, unknown>;

/** 阶梯利率行（arrangedAnnualInterestRates 元素）。 */
interface InterestRateTier {
  minValue?: number | string;
  maxValue?: number | string;
  interestRate?: string | number;
}

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** 安全读数组。 */
function readTiers(value: unknown): InterestRateTier[] {
  return Array.isArray(value) ? (value as InterestRateTier[]) : [];
}

/**
 * 限额值格式化（迁移自源 `Number(value) >= 99999999999 ? '∞' : reSet(value)`）。
 *
 * 用 util INFINITY_AMOUNT（99999999999）替代源魔数。>= 阈值展示 ∞，否则 reSet 千分位。
 * 不追加 symbol（调用方拼接 tdSymbol，与源一致）。
 */
function formatLimit(value: unknown): string {
  const num = Number(value);
  if (Number.isFinite(num) && num >= INFINITY_AMOUNT) return '∞';
  return reSet(value);
}

export interface WalletTypeApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
  /** 操作类型 1=save / 2=update / 3=enable / 4=disable（busCode 派生）。 */
  type?: number;
}

export function WalletTypeApproval({ detailInfo, type }: WalletTypeApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  // MMF 分支（issueType===20）：独立结构。
  const mmfSections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];
    const status = toNum(detailInfo.state);
    const opType = type ?? 0;
    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            value: t(`wallet_type_task_type_${opType}` as never),
          },
        ],
      },
      {
        title: t('wallet_type_027'),
        list: [
          { label: t('wallet_type_047'), value: String(detailInfo.tokenName ?? '') },
          {
            label: t('wallet_type_045'),
            value: t(`interest_account_type_${detailInfo.accountType}` as never),
          },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          { label: t('wallet_type_106'), value: String(detailInfo.name ?? '') },
          { label: t('wallet_type_107'), value: String(detailInfo.walletTypeCode ?? '') },
          {
            label: t('wallet_type_101'),
            value: t(`mmf_fund_type_${detailInfo.fundType}` as never),
          },
          {
            label: t('wallet_type_102'),
            value: t(`mmf_risk_level_${detailInfo.riskLevel}` as never),
          },
          {
            label: t('wallet_type_103'),
            value: `${detailInfo.fundAssetValue ?? ''} ${detailInfo.currencySymbol ?? ''}`,
          },
          {
            label: t('wallet_type_104'),
            value: formatTimestamp(detailInfo.fundInceptionTime as number),
          },
        ],
      },
      {
        title: t('wallet_type_027'),
        list: [
          {
            label: t('wallet_type_112'),
            value: (
              <CopyableEllipsisText
                value={String(detailInfo.depositInterestWalletAddress ?? '')}
              />
            ),
          },
        ],
      },
      {
        title: t('wallet_type_147'),
        list: [
          {
            label: t('wallet_type_149'),
            value: `${t('wallet_type_151')} ${detailInfo.dailyStatisticalTime ?? ''}`,
          },
          { label: t('PUB_Creater'), value: String(detailInfo.createUser ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('tokenized_deposit_0095'),
        list: [
          { label: t('tokenized_deposit_0089'), value: String(detailInfo.txHash || '--') },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNum(detailInfo.txTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value:
              status !== undefined ? (
                <ApprovalStatusBadge family="task" status={status} />
              ) : null,
            showBorder: true,
          } satisfies ApprovalDetailItem,
        ],
      },
    ];
  }, [detailInfo, type, t]);

  // 非 MMF 分支（getDetailInfo，源 walletType.tsx:27-496）。
  const normalSections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const opType = type ?? 0;
    const status = toNum(detailInfo.state);
    const tdSymbol = String(detailInfo.tdSymbol ?? '');
    const issueType = toNum(detailInfo.issueType);
    const accountType = toNum(detailInfo.accountType);
    const interestFeatureEnablement = toNum(detailInfo.interestFeatureEnablement);

    // interestRate 来源：arrangedAnnualInterestRates[0]?.interestRate（源 :28-30）。
    const arrangedTiers = readTiers(detailInfo.arrangedAnnualInterestRates);
    const interestRate =
      arrangedTiers[0]?.interestRate !== undefined
        ? String(arrangedTiers[0].interestRate)
        : '';
    const unarrangedTiers = readTiers(detailInfo.unarrangedAnnualInterestRates);
    const unarrangedAnnualInterestRate =
      unarrangedTiers[0]?.interestRate !== undefined
        ? String(unarrangedTiers[0].interestRate)
        : '';

    // 通用限额行工厂（源 wallet_type_004/005/006/048/049 五项，type===2 时 old* 对称）。
    const limitRow = (
      labelKey: string,
      value: unknown
    ): ApprovalDetailItem => ({
      label: t(labelKey),
      value: `${formatLimit(value)} ${tdSymbol}`,
    });

    // 条件：issueType===5 && accountType===1 && interestFeatureEnablement===2
    const overdraftEnabled =
      issueType === 5 &&
      accountType === 1 &&
      interestFeatureEnablement === 2;
    // 条件：issueType===5 && accountType===2 && interestFeatureEnablement===2
    const depositInterestEnabled =
      issueType === 5 &&
      accountType === 2 &&
      interestFeatureEnablement === 2;
    // 条件：issueType===5 && name!=='Default'
    const feeEnabled = issueType === 5 && detailInfo.name !== 'Default';

    const sections: (ApprovalDetailSection | null)[] = [
      // ① 操作类型
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            value: t(`wallet_type_task_type_${opType}` as never),
          },
        ],
      },
      // ② 基本信息（accountType 仅 issueType===5 展示，源 :52-56）
      {
        title: t('wallet_type_027'),
        list: [
          { label: t('wallet_type_001'), value: String(detailInfo.name ?? '') },
          issueType === 5
            ? ({
                label: t('wallet_type_045'),
                value: t(`interest_account_type_${detailInfo.accountType}` as never),
              } as ApprovalDetailItem)
            : ({} as ApprovalDetailItem),
          { label: t('wallet_type_047'), value: String(detailInfo.tokenName ?? '') },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
        ],
      },
      // ③ 限额区块（type===2=新值；其余=普通）
      type === 2
        ? {
            title: t('wallet_type_093') + t('approval_manage_0038'),
            list: [
              limitRow('wallet_type_004', detailInfo.maxTxCountPer),
              limitRow('wallet_type_005', detailInfo.maxTxCountDaily),
              {
                ...limitRow('wallet_type_006', detailInfo.stablecoinCount),
                showBorder: true,
              },
              limitRow('wallet_type_048', detailInfo.minimumBalance),
              {
                ...limitRow('wallet_type_049', detailInfo.maximumRedeemLimit),
                showBorder: true,
              },
            ],
          }
        : {
            title: t('wallet_type_093'),
            list: [
              limitRow('wallet_type_004', detailInfo.maxTxCountPer),
              limitRow('wallet_type_005', detailInfo.maxTxCountDaily),
              limitRow('wallet_type_006', detailInfo.stablecoinCount),
              limitRow('wallet_type_048', detailInfo.minimumBalance),
              {
                ...limitRow('wallet_type_049', detailInfo.maximumRedeemLimit),
                showBorder: true,
              },
            ],
          },
      // ④ 限额旧值区块（仅 type===2）
      type === 2
        ? {
            title: t('wallet_type_093') + t('approval_manage_0039'),
            list: [
              limitRow('wallet_type_004', detailInfo.oldMaxTxCountPer),
              limitRow('wallet_type_005', detailInfo.oldMaxTxCountDaily),
              limitRow('wallet_type_006', detailInfo.oldStablecoinCount),
              limitRow('wallet_type_048', detailInfo.oldMinimumBalance),
              {
                ...limitRow('wallet_type_049', detailInfo.oldMaximumRedeemLimit),
                showBorder: true,
              },
            ],
          }
        : null,
      // ⑤ 维护费区块（issueType===5 && name!=='Default'）
      feeEnabled
        ? {
            title: t('wallet_type_038'),
            list: [
              {
                label: t('wallet_type_050'),
                value: detailInfo.maintenanceFee
                  ? `${reSet(detailInfo.maintenanceFee)} ${tdSymbol}${t(
                      'approval_manage_0044'
                    )}${t(`maintenance_fee_call_type_${detailInfo.feeCycle}` as never)}`
                  : '--',
              },
              {
                label: t('wallet_type_051'),
                value: detailInfo.minimumBalanceFee
                  ? `${reSet(detailInfo.minimumBalanceFee)} ${tdSymbol}`
                  : '--',
              },
              {
                label: `${t('wallet_type_071')} ${t('wallet_type_074')}`,
                value: detailInfo.accountFeesWalletAddress ? (
                  <CopyableEllipsisText
                    value={String(detailInfo.accountFeesWalletAddress)}
                  />
                ) : (
                  '--'
                ),
                showBorder: true,
              },
            ],
          }
        : null,
      // ⑥ arranged overdraft 区块（accountType===1）
      overdraftEnabled
        ? {
            title: t('wallet_type_076'),
            list: [
              {
                label: t('wallet_type_055'),
                value: `${reSet(detailInfo.arrangedOverdraftAmount)} ${tdSymbol}`,
              },
              {
                label: t('wallet_type_057'),
                value: `${reSet(detailInfo.overdraftBufferAmount)} ${tdSymbol}`,
              },
              { label: t('wallet_type_056'), value: String(detailInfo.overdraftBufferPeriod ?? '') },
              // NOTE: 源 walletType.tsx:290-304 注释的 arrangedOverdraftFee 死代码已剔除（§8）。
              { label: t('wallet_type_066'), value: String(detailInfo.arrangedInterestPolicyName ?? '') },
              { label: t('wallet_type_067'), value: `${interestRate}%` },
              {
                label: t('wallet_type_062'),
                value: formatTimestamp(
                  detailInfo.arrangedEffectiveDate as number,
                  'dateutc'
                ),
              },
            ],
          }
        : null,
      // ⑦ unarranged overdraft 区块（accountType===1）
      overdraftEnabled
        ? {
            title: t('wallet_type_077'),
            list: [
              {
                label: t('wallet_type_063'),
                value: `${reSet(detailInfo.unarrangedOverdraftAmount)} ${tdSymbol}`,
              },
              {
                label: t('wallet_type_064'),
                value: `${Number(detailInfo.unarrangedOverdraftFee)} ${tdSymbol}${t(
                  'approval_manage_0044'
                )}${t('approval_manage_0045')}${t('approval_manage_0046')}${Number(
                  detailInfo.unarrangedOverdraftFeeMax
                )} ${tdSymbol}${t('approval_manage_0047')}`,
              },
              { label: t('wallet_type_066'), value: String(detailInfo.unarrangedInterestPolicyName ?? '') },
              { label: t('wallet_type_067'), value: `${unarrangedAnnualInterestRate}%` },
              {
                label: t('wallet_type_062'),
                value: formatTimestamp(
                  detailInfo.unarrangedEffectiveDate as number,
                  'dateutc'
                ),
              },
            ],
          }
        : null,
      // ⑧ 收取透支费/利息钱包地址区块（accountType===1）
      overdraftEnabled
        ? {
            title: t('wallet_type_090'),
            list: [
              {
                label: `${t('wallet_type_071')}${t('wallet_type_079')}`,
                value: (
                  <CopyableEllipsisText
                    value={String(detailInfo.receivingOverdraftFeeWalletAddress ?? '')}
                  />
                ),
              },
              {
                label: `${t('wallet_type_071')}${t('wallet_type_080')}`,
                value: (
                  <CopyableEllipsisText
                    value={String(detailInfo.receivingOverdraftInterestWalletAddress ?? '')}
                  />
                ),
                showBorder: true,
              },
            ],
          }
        : null,
      // ⑨ deposit interest 区块（accountType===2）
      depositInterestEnabled
        ? {
            title: t('wallet_type_075'),
            list: [
              { label: t('wallet_type_066'), value: String(detailInfo.arrangedInterestPolicyName ?? '') },
              {
                label: t('wallet_type_067'),
                value:
                  detailInfo.arrangedCalculateType === 1 ? (
                    `${interestRate}%`
                  ) : (
                    <div className="flex flex-col">
                      {arrangedTiers.map((el, key) => (
                        <span key={key}>
                          {`${reSet(el.minValue)} - ${reSet(el.maxValue)}${t(
                            'approval_manage_0048'
                          )}${el.interestRate}%`}
                        </span>
                      ))}
                    </div>
                  ),
              },
              {
                label: t('wallet_type_062'),
                value: formatTimestamp(
                  detailInfo.arrangedEffectiveDate as number,
                  'dateutc'
                ),
              },
              {
                // 负利率分支：interestRate 含 '-' → wallet_type_084，否则 wallet_type_081。
                label: `${t('wallet_type_071')}${
                  interestRate.indexOf('-') > -1
                    ? t('wallet_type_084')
                    : t('wallet_type_081')
                }`,
                value: (
                  <CopyableEllipsisText
                    value={String(detailInfo.depositInterestWalletAddress ?? '')}
                  />
                ),
              },
              interestRate.indexOf('-') > -1
                ? ({} as ApprovalDetailItem)
                : ({
                    label: `${t('wallet_type_071')}${t('wallet_type_082')}`,
                    value: (
                      <CopyableEllipsisText
                        value={String(detailInfo.accountClosureInterestWalletAddress ?? '')}
                      />
                    ),
                  } as ApprovalDetailItem),
            ],
          }
        : null,
      // ⑩ 创建人/时间
      {
        list: [
          { label: t('PUB_Creater'), value: String(detailInfo.createUser ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
        ],
      },
      // ⑪ 链上信息
      {
        title: t('tokenized_deposit_0095'),
        list: [
          { label: t('tokenized_deposit_0089'), value: String(detailInfo.txHash || '--') },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNum(detailInfo.txTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value:
              status !== undefined ? (
                <ApprovalStatusBadge family="task" status={status} />
              ) : null,
            showBorder: true,
          } satisfies ApprovalDetailItem,
        ],
      },
    ];

    return sections.filter(
      (s): s is ApprovalDetailSection => s !== null
    );
  }, [detailInfo, type, t]);

  const isMMF = toNum(detailInfo?.issueType) === 20;

  return (
    <ApprovalDetailGrid sections={isMMF ? mmfSections : normalSections} />
  );
}
