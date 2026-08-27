'use client';

/**
 * 银行信息页（源 `views/bank/info.vue` —— 源工程孤儿页：router 未注册、
 * 无 menuKey；O-8 终裁迁移为独立可路由页 /[locale]/bank/info，仅 registry
 * 注册 bank.info 键，不进侧栏菜单树）。
 *
 * 与 onboard 内嵌银行信息卡同接口（GET /bank/info，data-access
 * useOnboardBankInfoQuery 复用），按源页面差异呈现（基线 §4.4）：
 * - 状态 ===20「Enabled」/ 其余「Disabled」标签（源 L16-18，非 20 不回退原始数字）；
 * - 限额走 fmtAmount = String(Number(v)) 原样无千分位（源 L58-60）；
 * - 多「Pushed At」推送时间字段（源 L28，onboard 内嵌卡没有）。
 */
import { Badge, Card, CardContent } from '@myorg/shared/ui';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  useOnboardBankInfoQuery,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { fmtAmount, formatTime } from './kit';
import { PageHead } from './page-head';
import {
  EmptyHint,
  LoadingBlock,
  QueryErrorRetry,
} from './state-blocks';

/** 银行信息推送状态（源 types/business.ts BankInfo.status）：20 启用，其余停用。 */
const BANK_STATUS_ENABLED = 20;

/** supportedCurrencies 逗号分隔 → 币种数组（源 computed，1:1 移植）。 */
function splitCurrencies(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 银行信息（registry bank.info 键映射；导出名不可改）。 */
export function BankInfoPage() {
  const { data: bankInfo, isLoading, isError, error, refetch } =
    useOnboardBankInfoQuery(KISSEN_GATEWAY_PROJECT_ID);

  const currencies = splitCurrencies(bankInfo?.supportedCurrencies);

  return (
    <div className="space-y-6">
      {/* 源 .page-head 为无动作区纯堆叠（eyebrow + h1）→ stacked 变体。 */}
      <PageHead variant="stacked" title="Bank Information" />
      {/* 源 el-card 无标题，直陈 empty / descriptions；py-5 ≈ el-card body 20px。 */}
      <Card>
        <CardContent className="py-5">
          {isLoading ? (
            <LoadingBlock variant="skeleton" />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
          ) : !bankInfo ? (
            <EmptyHint text="No bank information" />
          ) : (
            <DescGrid cols={2}>
              <DescField label="Bank Name" variant="boxed">
                {bankInfo.bankName || '-'}
              </DescField>
              <DescField label="Bank Code" variant="boxed">
                {bankInfo.bankCode || '-'}
              </DescField>
              <DescField label="BIC" variant="boxed">
                {bankInfo.bic || '-'}
              </DescField>
              <DescField label="Status" variant="boxed">
                {bankInfo.status === BANK_STATUS_ENABLED ? (
                  <Badge>Enabled</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </DescField>
              <DescField label="Supported Currencies" span variant="boxed">
                {currencies.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {currencies.map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  '-'
                )}
              </DescField>
              <DescField label="Single Limit" variant="boxed">
                {fmtAmount(bankInfo.singleLimit)}
              </DescField>
              <DescField label="Daily Limit" variant="boxed">
                {fmtAmount(bankInfo.dailyLimit)}
              </DescField>
              <DescField label="Account Parameters" span variant="boxed">
                {bankInfo.accountConfig || '-'}
              </DescField>
              <DescField label="Pushed At" variant="boxed">
                {formatTime(bankInfo.pushTime)}
              </DescField>
            </DescGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
