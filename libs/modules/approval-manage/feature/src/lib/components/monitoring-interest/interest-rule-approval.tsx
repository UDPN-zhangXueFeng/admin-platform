'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailItem,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import {
  formatTimestamp,
  getCalculateDayOrdinalKey,
  reSet,
} from '@myorg/modules/approval-manage/util';

/**
 * InterestRuleTypeApproval — 利息规则审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/interest-rule.tsx`，272 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent）与可选 `type`
 * （busCode 派生 1/2/3/4 = save/update/activate/deactivate）。
 *
 * 迁移要点（§7 步骤 9）：
 * - **计息日序数词本地化**：calculateDayMonth（1/21/31→st, 2/22→nd, 3/23→rd, 其余→th）
 *   经 util `getCalculateDayOrdinalKey` 取 i18n key，拼装 `{day}{ordinal} {interest_00127}`；
 *   interestType===1 时展示 interest_00124（固定文案）替代序数词。
 * - **阶梯利率表**：interestCalculationMethod===1 显示单档 interestRate%；否则 details 阶梯表
 *   （区间 `(min - max]` + interestRate%）。update 额外显示 oldDetails 旧表。
 * - **疑似源 bug（§8②，保留）**：计息月字段判定 `oldCalculateDayMonth !== calculateTimeMonth`
 *   （应为 `calculateDayMonth`），迁移**照源保留**此判定（Rule 11/12：不静默修正，留待后端确认）。
 * - **剔除死代码**：源注释的 calculateDigitDay/calculateDigitMonth（§8 死代码）不迁移。
 *
 * **类型策略**：detailInfo 宽松 `Record<string, unknown>`，局部取值。
 * **i18n**：扁平 key；动态前缀（interest_operation_type_/interest_account_type_/
 * interest_*）T14 统一补全。
 */

type DetailInfo = Record<string, unknown>;

/** 阶梯利率行（details / oldDetails 元素）。 */
interface RateTier {
  minValue?: number | string;
  maxValue?: number | string;
  interestRate?: number | string;
}

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** 安全读取阶梯数组。 */
function readTiers(value: unknown): RateTier[] {
  return Array.isArray(value) ? (value as RateTier[]) : [];
}

export interface InterestRuleTypeApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
  /** 操作类型 1/2/3/4 = save/update/activate/deactivate（busCode 派生）。 */
  type?: number;
}

/**
 * 计息日展示（迁移自源 interest-rule.tsx:160-218 的序数词拼装逻辑）。
 *
 * 语义（照源）：
 * - interestType===1 → interest_00124（固定文案，如 "Last day"）。
 * - 否则 → `{day}{ordinalKey} {interest_00127}`（如 "1st of month"）。
 *
 * ordinalKey 经 util getCalculateDayOrdinalKey 计算（1/21/31→st, 2/22→nd, 3/23→rd, 其余→th）。
 * 返回 ReactNode（含 i18n 文案）。
 */
function formatCalculateDay(
  t: ReturnType<typeof useTranslations>,
  day: number | undefined,
  interestType: unknown,
): React.ReactNode {
  if (toNum(interestType) === 1) {
    return t('interest_00124');
  }
  if (day === undefined) return null;
  const ordinalKey = getCalculateDayOrdinalKey(day);
  // 源格式：`${day}${ordinalKey} ${interest_00127}`（序数词 + 单位词）。
  return `${day}${t(ordinalKey as never)} ${t('interest_00127')}`;
}

/**
 * 阶梯利率表（迁移自源 antd <Table>，columns：区间 `(min - max]` / interestRate%）。
 * 用原生 <table>（同 posting-engine book-detail 模式）。
 */
function RateTierTable({ tiers }: { tiers: RateTier[] }) {
  const t = useTranslations('modules.approval-manage');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="w-[50%] border px-2 py-1.5 text-left font-medium">
              {t('interest_0059')}
            </th>
            <th className="w-[50%] border px-2 py-1.5 text-left font-medium">
              {t('interest_0060')}
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1.5">
                ({reSet(tier.minValue)} - {reSet(tier.maxValue)}]
              </td>
              <td className="border px-2 py-1.5">{tier.interestRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InterestRuleTypeApproval({
  detailInfo,
  type,
}: InterestRuleTypeApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const opType = type ?? 0;
    const interestType = toNum(detailInfo.interestType);
    const interestCalculationMethod = toNum(detailInfo.interestCalculationMethod);
    const oldInterestCalculationMethod = toNum(detailInfo.oldInterestCalculationMethod);
    const accountType = toNum(detailInfo.accountType);
    const status = toNum(detailInfo.status);

    const details = readTiers(detailInfo.details);
    const oldDetails = readTiers(detailInfo.oldDetails);
    const oldCalculateDayMonth = toNum(detailInfo.oldCalculateDayMonth);
    const calculateDayMonth = toNum(detailInfo.calculateDayMonth);

    return [
      {
        list: [
          {
            label: t('interest_0018'),
            value: t(`interest_operation_type_${opType}` as never),
          },
        ],
      },
      {
        title: t('interest_0009'),
        list: [
          {
            label: t('interest_0002'),
            // 利息政策名变更展示「Updated from X to Y」（源 interest-rule.tsx:32-39）
            value:
              detailInfo.interestPolicyName === detailInfo.oldInterestPolicyName
                ? String(detailInfo.interestPolicyName ?? '')
                : `${t('interest_00137')}${detailInfo.oldInterestPolicyName ?? ''}${t('interest_00138')}${detailInfo.interestPolicyName ?? ''}`,
          },
          {
            label: t('interest_0094'),
            value: interestType === 1 ? t('interest_0000') : t('interest_0001'),
          },
          {
            label: t('interest_0005'),
            value:
              accountType !== undefined
                ? t(`interest_account_type_${accountType}` as never)
                : null,
          },
          {
            // label 追加「(After)」后缀（仅 update，源 interest-rule.tsx:52-55）
            label: t('interest_0006') + (opType === 2 ? t('approval_manage_0038') : ''),
            // interestCalculationMethod===1：单档利率；否则阶梯表（源 interest-rule.tsx:57-80）
            value:
              interestCalculationMethod === 1 ? (
                `${details[0]?.interestRate ?? ''}%`
              ) : (
                <RateTierTable tiers={details} />
              ),
            isTable: interestCalculationMethod !== 1,
          },
          // update：旧利率表（源 interest-rule.tsx:82-112）
          opType === 2
            ? ({
                label: t('interest_0006') + t('approval_manage_0039'),
                value:
                  oldInterestCalculationMethod === 1 ? (
                    `${oldDetails[0]?.interestRate ?? ''}%`
                  ) : (
                    <RateTierTable tiers={oldDetails} />
                  ),
                isTable: oldInterestCalculationMethod !== 1,
              } as ApprovalDetailItem)
            : ({} as ApprovalDetailItem),
          {
            label: t('interest_0003'),
            // 生效时间变更展示「Updated from X to Y」（源 interest-rule.tsx:114-129）
            value:
              opType === 2 &&
              detailInfo.oldEffectiveTime !== detailInfo.effectiveTime
                ? t('approval_manage_0040')
                    .replace(
                      '{oldEffectiveTime}',
                      formatTimestamp(toNum(detailInfo.oldEffectiveTime), 'dateutc'),
                    )
                    .replace(
                      '{effectiveTime}',
                      formatTimestamp(toNum(detailInfo.effectiveTime), 'dateutc'),
                    )
                : formatTimestamp(toNum(detailInfo.effectiveTime), 'dateutc'),
          },
        ],
      },
      {
        title: t('interest_0058'),
        list: [
          {
            label: t('interest_0012'),
            // 计息日变更展示「Updated from X to Y」（源 interest-rule.tsx:136-151）
            value:
              opType === 2 &&
              detailInfo.oldCalculateTimeDay !== detailInfo.calculateTimeDay
                ? t('approval_manage_0041')
                    .replace('{oldCalculateTimeDay}', String(detailInfo.oldCalculateTimeDay ?? ''))
                    .replace('{calculateTimeDay}', String(detailInfo.calculateTimeDay ?? ''))
                : `${t('interest_00123')} ${detailInfo.calculateTimeDay ?? ''}`,
          },
          {
            label: t('interest_0014'),
            // §8② 疑似 bug 保留：判定 oldCalculateDayMonth !== calculateTimeMonth
            // （应为 calculateDayMonth）。照源保留，待后端确认（Rule 11/12）。
            value:
              opType === 2 && oldCalculateDayMonth !== toNum(detailInfo.calculateTimeMonth)
                ? `${t('approval_manage_0042')} ${
                    formatCalculateDay(t, oldCalculateDayMonth, interestType)
                  }  ${detailInfo.oldCalculateTimeMonth ?? ''} ${t('approval_manage_0043')} ${
                    formatCalculateDay(t, calculateDayMonth, interestType)
                  } ${detailInfo.calculateTimeMonth ?? ''}`
                : `${formatCalculateDay(t, calculateDayMonth, interestType)} ${
                    detailInfo.calculateTimeMonth ?? ''
                  }`,
          },
          // 死代码剔除：源注释的 calculateDigitDay/calculateDigitMonth（§8）不迁移。
        ],
      },
      {
        list: [
          { label: t('PUB_Creater'), value: String(detailInfo.createUserName ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: status !== undefined ? <ApprovalStatusBadge family="task" status={status} /> : null,
            showBorder: true,
          },
        ],
      },
    ];
  }, [detailInfo, type, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
